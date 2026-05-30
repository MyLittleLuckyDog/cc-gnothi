#!/usr/bin/env node
/**
 * arbor-fallback.js — Arbor-based parsing fallback for cc-gnothi
 * extract-ast.js
 *
 * Used when @babel/parser fails on a Claude Code bundle. The CC bundle
 * stream has been migrating to minifier output that @babel/parser's
 * errorRecovery mode trips on starting around v2.1.153; tree-sitter's
 * error recovery handles the same input cleanly (5/5 of v2.1.153–158
 * indexed in 3 s each — see
 * docs/measurements/G1_arbor_parses_cc_bundles.md in
 * MyLittleLuckyDog/Arbor-Vitae).
 *
 * Strategy
 *
 *   1. Write the bundle to a temp dir and run
 *        arbor index <dir> --save=<graph.json>
 *      tree-sitter front end produces a function/method/class graph
 *      JSON.
 *   2. Project graph.json's Function/Method/AsyncFunction symbols into
 *      the `{name: {start, end}}` byte-offset shape buildIndex()'s
 *      downstream consumers (command extraction, hash computation,
 *      AST re-slice) expect. Line + column → byte offset is computed
 *      from a per-line byte-start table over the bundle source.
 *   3. The Pass-2 (w6/P6 module exports) and Pass-3 (command
 *      registration) patterns aren't structural — they're regex-shaped
 *      object literals — so we re-extract them with straight regexes
 *      over the bundle source. On v2.1.153 this recovers 38 command
 *      registrations cleanly.
 *
 * Result is the exact same shape buildIndex() returns on a successful
 * @babel/parser pass, with an additional `_arbor_fallback: true`
 * marker the caller can log / surface to downstream stages.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ARBOR_BIN = process.env.ARBOR_BIN
  || path.join(os.homedir(), '.cargo/bin/arbor');

/**
 * Run Arbor on `src` and produce a buildIndex-compatible result.
 *
 * Throws if Arbor isn't installed or fails to index the bundle.
 */
function arborFallback(src, version) {
  // 1. write bundle to a temp dir and run `arbor index --save`
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arbor-fallback-'));
  const bundlePath = path.join(tmpDir, 'bundle.js');
  fs.writeFileSync(bundlePath, src);
  const graphPath = path.join(tmpDir, 'graph.json');

  process.stderr.write(
    `arbor-fallback: indexing via ${ARBOR_BIN}\n`
  );
  const r = spawnSync(
    ARBOR_BIN,
    ['index', tmpDir, `--save=${graphPath}`],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
  );
  if (r.status !== 0) {
    throw new Error(
      `arbor index exited ${r.status}: ${(r.stderr || '').slice(0, 300)}`
    );
  }
  if (!fs.existsSync(graphPath)) {
    throw new Error(`arbor index produced no snapshot at ${graphPath}`);
  }

  // 2. read graph + project to {name: {start, end}} via byte-offset table
  const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  const functions = {};
  const lineStarts = computeLineStarts(src);

  let projected = 0;
  for (const sym of graph.symbols) {
    if (!['Function', 'Method', 'AsyncFunction'].includes(sym.kind)) continue;
    if (!sym.name || !sym.location) continue;
    const loc = sym.location;
    const start = (lineStarts[loc.start_line] ?? 0) + (loc.start_col ?? 0);
    const end   = (lineStarts[loc.end_line]   ?? 0) + (loc.end_col   ?? 0);
    if (end <= start) continue;
    // Earliest occurrence per name — minifier rename means many
    // functions share a single-letter name; we keep the first one.
    if (!(sym.name in functions) || start < functions[sym.name].start) {
      functions[sym.name] = { start, end };
      projected++;
    }
  }
  process.stderr.write(
    `arbor-fallback: ${projected} functions projected from graph (${graph.symbols.length} total symbols)\n`
  );

  // 3. regex-extract commands + module exports
  const commands = extractCommands(src);
  const moduleExports = extractModuleExports(src);
  process.stderr.write(
    `arbor-fallback: ${Object.keys(commands).length} commands, ${Object.keys(moduleExports).length} module exports\n`
  );

  // cleanup temp
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

  return {
    version,
    built: new Date().toISOString().slice(0, 10),
    commands,
    moduleExports,
    functions,
    _arbor_fallback: true,
  };
}

/**
 * 1-indexed line → byte offset of that line's first byte.
 * `out[1]` = 0, `out[2]` = bytes-past-first-newline, ...
 *
 * Assumes \n line endings (CC bundles are LF-only); a CR-LF source
 * would be off by one per line but the bundles here are LF.
 *
 * NB: assumes single-byte ASCII for cross-line offset; CC bundles
 * are essentially all ASCII (minifier rename gives a/b/c... names,
 * and strings stay within the ASCII range except for occasional
 * UTF-8 inside `description:"…"` fields — which is fine because we
 * never use the byte offset to compute string spans, only function
 * spans, and function bodies are ASCII operators.)
 */
function computeLineStarts(src) {
  const out = [0, 0];
  let pos = 0;
  for (let i = 0; i < src.length; i++) {
    if (src.charCodeAt(i) === 10 /* \n */) {
      pos = i + 1;
      out.push(pos);
    }
  }
  return out;
}

/**
 * Extract command registrations matching
 *   { type: "local" | "local-jsx", name: "...", description: "...", ... }
 *
 * Matches the same shape Pass 3 of buildIndex() scans the AST for, just
 * over the raw source instead of an AST walk. First-occurrence per name
 * wins (mirrors Pass 3's effective de-dup).
 */
function extractCommands(src) {
  const re = /\{type:"(local(?:-jsx)?)",name:"([^"]+)",description:"((?:[^"\\]|\\.)*)"/g;
  const out = {};
  let m;
  while ((m = re.exec(src)) !== null) {
    const [full, type, name, description] = m;
    if (name in out) continue;
    out[name] = {
      type,
      name,
      description,
      loc_byte: m.index,
      loc_line: null,
    };
  }
  return out;
}

/**
 * Detect w6/P6(MODULE_IDENT, { ... }) module-exports invocations.
 *
 * The Pass-2 AST walk fills in per-property mappings (PROP: () => FN_ID).
 * That mapping requires reading an arbitrary nested object literal, which
 * regex doesn't do safely. We surface presence + the module identifier so
 * downstream stages can detect "module exports detected but unmapped" and
 * fall back to literal-anchored lookups.
 */
function extractModuleExports(src) {
  const re = /\b([wP])6\(([a-zA-Z_$][a-zA-Z0-9_$]*),\{/g;
  const out = {};
  let m;
  while ((m = re.exec(src)) !== null) {
    const modId = m[2];
    if (!out[modId]) out[modId] = { _present: true, _unmapped_fallback: true };
  }
  return out;
}

module.exports = { arborFallback };

// Allow direct CLI use for debugging: `node arbor-fallback.js <bundle> <version>`
if (require.main === module) {
  const [bundle, version] = process.argv.slice(2);
  if (!bundle || !version) {
    process.stderr.write('Usage: node arbor-fallback.js <bundle.js> <version>\n');
    process.exit(2);
  }
  const src = fs.readFileSync(bundle, 'utf8');
  const out = arborFallback(src, version);
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}
