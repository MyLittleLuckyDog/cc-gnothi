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

function pickHandler(hits, preferredName) {
  if (preferredName) {
    const named = hits.filter((h) => h.name === preferredName);
    if (named.length > 0) {
      named.sort((a, b) => spanSize(a) - spanSize(b));
      return named[0];
    }
  }
  const sorted = [...hits].sort((a, b) => spanSize(a) - spanSize(b));
  return sorted[0] || null;
}

function main() {
  const opts = parseArgs();
  for (const f of [opts.bundle, opts.index, opts.graph]) {
    if (!fs.existsSync(f)) {
      process.stderr.write('missing: ' + f + '\n');
      process.exit(1);
    }
  }

  const t0 = Date.now();
  process.stderr.write('reading bundle + line-start table...\n');
  const src = fs.readFileSync(opts.bundle, 'utf8');
  const lineStarts = computeLineStarts(src);

  process.stderr.write('reading cc-gnothi index...\n');
  const index = JSON.parse(fs.readFileSync(opts.index, 'utf8'));

  process.stderr.write('reading Arbor graph snapshot (73 MB)...\n');
  const graph = JSON.parse(fs.readFileSync(opts.graph, 'utf8'));

  // Pre-filter to handler-shaped symbols inside this bundle. Cuts down
  // the per-command scan substantially.
  //
  // Arbor canonicalises paths at index time, so the graph carries
  // `/private/tmp/...` while node's path.resolve gives `/tmp/...` on
  // macOS. Use fs.realpathSync to compare canonical paths.
  const bundleAbs = fs.realpathSync(path.resolve(opts.bundle));
  const symbols = graph.symbols.filter(
    (s) => HANDLER_KINDS.has(s.kind) && s.location && s.location.file === bundleAbs
  );
  process.stderr.write(
    'loaded ' + symbols.length + ' handler-kind symbols (' +
    ((Date.now() - t0) / 1000).toFixed(1) + 's)\n'
  );

  const cmds = index.commands;
  const totals = {
    total:                 0,
    with_byte_range:       0,
    arbor_returned_hits:   0,
    handler_resolved:      0,
    multi_hit_disambiguated: 0,
    single_hit:            0,
    no_hits:               0,
  };
  const perCmd = [];
  const unresolved = [];

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
    if (hits.length === 0) {
      totals.no_hits++;
      unresolved.push({ name, reason: 'no symbols in range' });
      continue;
    }
    totals.arbor_returned_hits++;

    const handler = pickHandler(hits, reg.handler_method);
    if (handler) {
      totals.handler_resolved++;
      if (hits.length === 1) totals.single_hit++;
      else if (handler.name === reg.handler_method) totals.multi_hit_disambiguated++;
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
        n_hits: hits.length,
        hint:   reg.handler_method || null,
      });
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const payload = {
    bundle:   bundleAbs,
    version:  opts.version,
    elapsed_s: parseFloat(elapsed),
    totals,
    per_command: perCmd,
    unresolved,
  };
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');

  process.stderr.write('\n=== Phase B-2 PoC summary (v' + opts.version + ') ===\n');
  process.stderr.write('  total cmds:                ' + totals.total + '\n');
  process.stderr.write('  with byte range:           ' + totals.with_byte_range + '\n');
  process.stderr.write('  arbor returned >=1 hit:    ' + totals.arbor_returned_hits + '\n');
  process.stderr.write('  handler resolved:          ' + totals.handler_resolved + '\n');
  process.stderr.write('    via single hit:          ' + totals.single_hit + '\n');
  process.stderr.write('    via name disambiguation: ' + totals.multi_hit_disambiguated + '\n');
  process.stderr.write('  no hits:                   ' + totals.no_hits + '\n');
  process.stderr.write('  elapsed:                   ' + elapsed + 's\n');
}

main();
