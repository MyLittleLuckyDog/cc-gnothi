#!/usr/bin/env node
/**
 * arbor-handler-lookup.js — Phase B-2 integration PoC.
 *
 * For each command in cc-gnothi's index, finds the unique handler
 * method that lives inside the registration object's
 * (loc_byte, loc_byte_end) span — disambiguating same-name methods
 * like `getPromptForCommand` (29 occurrences in v2.1.158) down to
 * the single one this command owns.
 *
 * In-process design (no shell-out per call):
 *
 *   1. Read Arbor's saved graph snapshot once
 *      (`<bundle-dir>/.arbor/graph.json`, produced by
 *      `arbor index --save`).
 *   2. Build a per-line byte-start table over the bundle source
 *      so we can convert each command's byte range to (line, col)
 *      once.
 *   3. Filter Arbor symbols inside each command's span — pure JS,
 *      sub-second total for ~100 commands × ~20k symbols.
 *
 * This mirrors the MCP-server pattern that production cc-gnothi
 * would use (one Arbor process holding the graph in memory, many
 * tool calls against it), not the per-command shell-out path.
 *
 * Usage:
 *   node scripts/arbor-handler-lookup.js \
 *       --bundle path/to/claude-X.Y.Z.js --version X.Y.Z
 *
 * Output (stdout): JSON { totals, per_command, unresolved }
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function parseArgs() {
  const argv = process.argv.slice(2);
  const opts = { bundle: null, version: null, index: null, graph: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--bundle')  opts.bundle  = argv[++i];
    else if (a === '--version') opts.version = argv[++i];
    else if (a === '--index')   opts.index   = argv[++i];
    else if (a === '--graph')   opts.graph   = argv[++i];
  }
  if (!opts.bundle || !opts.version) {
    process.stderr.write(
      'Usage: arbor-handler-lookup.js --bundle <path> --version <ver>\n' +
      '                               [--index <index.json>] [--graph <graph.json>]\n'
    );
    process.exit(2);
  }
  const bundleDir = path.dirname(path.resolve(opts.bundle));
  if (!opts.index) {
    opts.index = path.join(os.homedir(), '.cc-gnothi/cache/index-' + opts.version + '.json');
  }
  if (!opts.graph) {
    opts.graph = path.join(bundleDir, '.arbor', 'graph.json');
  }
  return opts;
}

/** Build a 1-indexed line → byte-offset table from the bundle source. */
function computeLineStarts(src) {
  const out = [0, 0];
  for (let i = 0; i < src.length; i++) {
    if (src.charCodeAt(i) === 10 /* \n */) out.push(i + 1);
  }
  return out;
}

/** Inverse of computeLineStarts: convert byte → (line, col). */
function byteToLineCol(lineStarts, byte) {
  // Binary search line whose start ≤ byte
  let lo = 1, hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= byte) lo = mid; else hi = mid - 1;
  }
  return [lo, byte - lineStarts[lo]];
}

/** Compare two (line, col) tuples lexicographically. */
function lessOrEq(a, b) {
  return a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);
}

/** True iff symbol's [start..end] span intersects query [qStart..qEnd]. */
function overlaps(sym, qStart, qEnd) {
  const s = [sym.location.start_line, sym.location.start_col];
  const e = [sym.location.end_line,   sym.location.end_col];
  // No overlap if symbol ends before query starts, or starts after query ends.
  if (!lessOrEq(qStart, e)) return false;
  if (!lessOrEq(s, qEnd))   return false;
  return true;
}

const HANDLER_KINDS = new Set([
  'Function', 'AsyncFunction', 'Method', 'AsyncMethod',
]);

/** Score for picking among multiple hits: inner-first (smaller span). */
function spanSize(sym) {
  const dl = sym.location.end_line - sym.location.start_line;
  if (dl > 0) return dl * 1_000_000 + sym.location.end_col;
  return Math.max(0, sym.location.end_col - sym.location.start_col);
}

// Method names that are real handlers, in priority order. When multiple
// hits live inside a registration object, pick the highest-ranked of
// these before falling back to inner-first ordering.
const HANDLER_METHOD_PRIORITY = [
  'load', 'getPromptForCommand', 'call', 'handler', 'run',
];

// Method names that are *metadata accessors* on the registration object,
// not handlers. If pickHandler would otherwise return one of these, we
// return null instead and let the caller try the module_id / load_ident
// paths — they're more likely to point at the real handler.
const METADATA_ACCESSORS = new Set([
  'isHidden', 'isEnabled', 'requires',
  'description', 'userFacingName', 'argumentHint',
  'immediate', 'supportsNonInteractive', 'thinClientDispatch',
]);

function pickHandler(hits, preferredName) {
  // 1. honour the explicit hint (e.g. prompt-type's handler_method).
  if (preferredName) {
    const named = hits.filter((h) => h.name === preferredName);
    if (named.length > 0) {
      named.sort((a, b) => spanSize(a) - spanSize(b));
      return named[0];
    }
  }
  // 2. prefer one of the known handler method names.
  for (const name of HANDLER_METHOD_PRIORITY) {
    const named = hits.filter((h) => h.name === name);
    if (named.length > 0) {
      named.sort((a, b) => spanSize(a) - spanSize(b));
      return named[0];
    }
  }
  // 3. fall back to inner-first, but reject pure-metadata hits so the
  //    caller's path 2 / path 3 gets a chance at the real handler.
  const sorted = [...hits].sort((a, b) => spanSize(a) - spanSize(b));
  const first = sorted[0];
  if (!first) return null;
  if (METADATA_ACCESSORS.has(first.name)) {
    // Check whether *any* hit is non-metadata; if so use it.
    const nonMeta = sorted.find((h) => !METADATA_ACCESSORS.has(h.name));
    if (nonMeta) return nonMeta;
    return null;
  }
  return first;
}

/**
 * Library entry point. Same logic as the CLI `main()` below, but takes
 * a pre-loaded index object (so `extract-ast.js --build-index` can call
 * it mid-build before the index file has been written to disk) and
 * returns the result structurally instead of writing JSON to stdout.
 *
 *   opts: {
 *     bundle:  string  — path to bundle.js
 *     version: string
 *     graph:   string  — path to .arbor/graph.json (auto-generated by
 *                        runArborIndex if missing)
 *     index:   object  — the in-memory cc-gnothi index
 *     src?:    string  — already-loaded bundle source (optional)
 *   }
 */
function resolveHandlers(opts) {
  const t0 = Date.now();
  const src = opts.src || fs.readFileSync(opts.bundle, 'utf8');
  const lineStarts = computeLineStarts(src);
  const index = opts.index;
  const graph = JSON.parse(fs.readFileSync(opts.graph, 'utf8'));

  // Pre-filter to handler-shaped symbols. The caller now indexes each
  // bundle in an isolated tmp dir (ensureArborGraph), so the graph file
  // only carries symbols from this one bundle — no per-file disambiguation
  // is needed here.
  const bundleAbs = fs.realpathSync(path.resolve(opts.bundle));
  const symbols = graph.symbols.filter(
    (s) => HANDLER_KINDS.has(s.kind) && s.location
  );
  process.stderr.write(
    'loaded ' + symbols.length + ' handler-kind symbols (' +
    ((Date.now() - t0) / 1000).toFixed(1) + 's)\n'
  );

  const cmds = index.commands;
  const moduleExports = index.moduleExports || {};
  // Name → first symbol with that name (Arbor's index can have many
  // same-name entries; we want the *declared* one, typically a
  // top-level Function / Method / AsyncFunction / Struct).
  const byName = new Map();
  for (const s of graph.symbols) {
    if (!s.name) continue;
    if (!byName.has(s.name)) byName.set(s.name, s);
  }
  // Property name → ranking for picking the "real" handler when a
  // module exports several. Lower = preferred.
  const HANDLER_PROP_RANK = {
    default: 0, call: 1, handler: 2, run: 3, default_1: 4,
  };

  const totals = {
    total:                  0,
    with_byte_range:        0,
    direct_hit:             0,        // path 1 — symbol-in-range
    via_module_id:          0,        // path 2 — module_id → arbor name lookup
    via_load_ident:         0,        // path 3 — load_ident → arbor name lookup
    handler_resolved:       0,
    no_resolution:          0,
    multi_hit_disambiguated: 0,
    single_hit:             0,
  };
  const perCmd = [];
  const unresolved = [];

  function lookupViaLoadIdent(reg) {
    const id = reg.load_ident;
    if (!id) return null;
    const sym = byName.get(id);
    if (!sym) return null;
    return { sym, via: { load_ident: id } };
  }

  function lookupViaModuleId(reg) {
    const mid = reg.module_id;
    if (!mid) return null;
    const exports = moduleExports[mid];
    if (!exports || Object.keys(exports).length === 0) return null;
    // Rank exports: prefer known handler property names; otherwise
    // take the lowest-ranked (= first declared) property whose ident
    // resolves in Arbor's symbol set.
    const entries = Object.entries(exports);
    entries.sort((a, b) => {
      const ra = HANDLER_PROP_RANK[a[0]] ?? 100 + a[0].length;
      const rb = HANDLER_PROP_RANK[b[0]] ?? 100 + b[0].length;
      return ra - rb;
    });
    for (const [propName, identName] of entries) {
      const sym = byName.get(identName);
      if (sym) {
        return { sym, via: { module_id: mid, prop: propName, ident: identName } };
      }
    }
    return null;
  }

  for (const [name, reg] of Object.entries(cmds)) {
    totals.total++;
    if (typeof reg.loc_byte !== 'number' || typeof reg.loc_byte_end !== 'number') {
      unresolved.push({ name, reason: 'no byte range' });
      continue;
    }
    totals.with_byte_range++;

    const qStart = byteToLineCol(lineStarts, reg.loc_byte);
    const qEnd   = byteToLineCol(lineStarts, reg.loc_byte_end);

    const hits = symbols.filter((s) => overlaps(s, qStart, qEnd));
    let handler = null;
    let resolutionPath = null;

    if (hits.length > 0) {
      handler = pickHandler(hits, reg.handler_method);
      if (handler) {
        resolutionPath = 'direct';
        totals.direct_hit++;
        if (hits.length === 1) totals.single_hit++;
        else if (handler.name === reg.handler_method) totals.multi_hit_disambiguated++;
      }
    }

    // Path 2 — anonymous arrow only (e.g. usage-credits): no named
    // symbol inside the byte range. Follow module_id into the
    // moduleExports map and resolve the export identifier in Arbor's
    // global symbol table.
    let viaModuleId = null;
    if (!handler) {
      const r = lookupViaModuleId(reg);
      if (r) {
        handler = r.sym;
        viaModuleId = r.via;
        resolutionPath = 'module_id';
        totals.via_module_id++;
      }
    }

    // Path 3 — `load:()=>Promise.resolve({call: IDENT})` shape: no
    // module_id, no anchor inside the byte range, but Pass-3 left
    // load_ident on the registration. Resolve directly through
    // Arbor's name index.
    let viaLoadIdent = null;
    if (!handler) {
      const r = lookupViaLoadIdent(reg);
      if (r) {
        handler = r.sym;
        viaLoadIdent = r.via;
        resolutionPath = 'load_ident';
        totals.via_load_ident++;
      }
    }

    if (handler) {
      totals.handler_resolved++;
      perCmd.push({
        cmd:        name,
        type:       reg.type,
        byte_range: [reg.loc_byte, reg.loc_byte_end],
        line_range: [qStart, qEnd],
        handler: {
          name: handler.name,
          fqn:  handler.fqn,
          kind: handler.kind,
          loc:  handler.location,
        },
        n_hits:           hits.length,
        hint:             reg.handler_method || null,
        resolution_path:  resolutionPath,
        via_module_id:    viaModuleId,
        via_load_ident:   viaLoadIdent,
      });
    } else {
      totals.no_resolution++;
      unresolved.push({
        name,
        reason: hits.length === 0 ? 'no symbols in range, no module_id resolution'
                                   : 'pickHandler returned null',
        module_id: reg.module_id || null,
        module_exports_known: !!(reg.module_id && moduleExports[reg.module_id]),
      });
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  return {
    bundle:    bundleAbs,
    version:   opts.version,
    elapsed_s: parseFloat(elapsed),
    totals,
    per_command: perCmd,
    unresolved,
  };
}

/**
 * Run `arbor index <isolated-dir>/<bundle.js> --save=<graph.json>` if the
 * graph file is missing. Each bundle is indexed in its own throwaway
 * directory so the graph only carries symbols from that one bundle —
 * indexing the shared caludeCodeAVX2/artifacts/ directory blows past
 * V8's 512 MB max-string limit when the resulting JSON is read back.
 *
 * Returns true on success / pre-existing, false if Arbor is not on
 * this host so callers can degrade gracefully.
 */
function ensureArborGraph(bundlePath, graphPath) {
  if (fs.existsSync(graphPath)) return true;
  const { spawnSync } = require('child_process');
  const arborBin = process.env.ARBOR_BIN
    || path.join(os.homedir(), '.cargo/bin/arbor');
  if (!fs.existsSync(arborBin)) return false;

  // Isolate this bundle in a fresh tmp dir so `arbor index` only sees one
  // input file and produces a per-bundle graph (~30 MB), not the union of
  // every bundle sitting next to it (~1 GB).
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arbor-handler-'));
  const isolated = path.join(tmpDir, path.basename(bundlePath));
  try {
    fs.copyFileSync(bundlePath, isolated);
    fs.mkdirSync(path.dirname(graphPath), { recursive: true });
    const r = spawnSync(arborBin, ['index', tmpDir, `--save=${graphPath}`], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    });
    return r.status === 0 && fs.existsSync(graphPath);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

module.exports = { resolveHandlers, ensureArborGraph, pickHandler };

function main() {
  const opts = parseArgs();
  for (const f of [opts.bundle, opts.index]) {
    if (!fs.existsSync(f)) {
      process.stderr.write('missing: ' + f + '\n');
      process.exit(1);
    }
  }
  if (!ensureArborGraph(opts.bundle, opts.graph)) {
    process.stderr.write('arbor graph missing and `arbor` not available: ' + opts.graph + '\n');
    process.exit(1);
  }

  const index = JSON.parse(fs.readFileSync(opts.index, 'utf8'));
  const payload = resolveHandlers({
    bundle:  opts.bundle,
    version: opts.version,
    graph:   opts.graph,
    index,
  });
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');

  const t = payload.totals;
  process.stderr.write('\n=== Phase B-2 PoC summary (v' + opts.version + ') ===\n');
  process.stderr.write('  total cmds:                ' + t.total + '\n');
  process.stderr.write('  with byte range:           ' + t.with_byte_range + '\n');
  process.stderr.write('  handler resolved:          ' + t.handler_resolved + '\n');
  process.stderr.write('    via direct byte range:   ' + t.direct_hit + '\n');
  process.stderr.write('      (single hit:           ' + t.single_hit + ')\n');
  process.stderr.write('      (name disambiguation:  ' + t.multi_hit_disambiguated + ')\n');
  process.stderr.write('    via module_id follow:    ' + t.via_module_id + '\n');
  process.stderr.write('    via load_ident lookup:   ' + t.via_load_ident + '\n');
  process.stderr.write('  unresolved:                ' + t.no_resolution + '\n');
  process.stderr.write('  elapsed:                   ' + payload.elapsed_s + 's\n');
}

if (require.main === module) main();
