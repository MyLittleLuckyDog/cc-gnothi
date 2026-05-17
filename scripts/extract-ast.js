#!/usr/bin/env node
/**
 * extract-ast.js — Bun bundle AST extractor for cc-gnothi
 *
 * Usage:
 *   node scripts/extract-ast.js --build-index --bundle <path> --version <ver>
 *   node scripts/extract-ast.js --cmd <name>   --bundle <path> --index <path>
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const parser = require('@babel/parser');

// ── Args ──────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    mode: null,       // 'index' | 'cmd'
    cmd: null,
    bundle: null,
    version: null,
    indexPath: null,
    depth: 2,
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--build-index': opts.mode = 'index'; break;
      case '--cmd':         opts.mode = 'cmd'; opts.cmd = args[++i]; break;
      case '--bundle':      opts.bundle = args[++i]; break;
      case '--version':     opts.version = args[++i]; break;
      case '--index':       opts.indexPath = args[++i]; break;
      case '--depth':       opts.depth = parseInt(args[++i], 10); break;
    }
  }
  return opts;
}

// ── AST walk ──────────────────────────────────────────────────────────────────

function walk(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (node.type && visitor[node.type]) visitor[node.type](node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'extra') continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const child of val) walk(child, visitor);
    } else if (val && typeof val === 'object' && val.type) {
      walk(val, visitor);
    }
  }
}

// ── Index build ───────────────────────────────────────────────────────────────

function buildIndex(src, version) {
  const ast = parser.parse(src, {
    sourceType: 'script',
    errorRecovery: true,
    strictMode: false,
  });

  const commands = {};
  const moduleExports = {};
  const functions = {};

  // Pass 1: function locations
  walk(ast, {
    FunctionDeclaration(node) {
      if (node.id) functions[node.id.name] = { start: node.start, end: node.end };
    },
    VariableDeclarator(node) {
      if (!node.id || node.id.type !== 'Identifier') return;
      const init = node.init;
      if (!init) return;
      if (
        init.type === 'FunctionExpression' ||
        init.type === 'ArrowFunctionExpression'
      ) {
        functions[node.id.name] = { start: init.start, end: init.end };
      }
    },
  });

  // Pass 2: w6(MODULE_OBJ, { PROP: () => FN_ID }) — module exports
  walk(ast, {
    CallExpression(node) {
      const callee = node.callee;
      if (callee.type !== 'Identifier' || callee.name !== 'w6') return;
      const [target, exportsObj] = node.arguments;
      if (!target || target.type !== 'Identifier') return;
      if (!exportsObj || exportsObj.type !== 'ObjectExpression') return;
      const modId = target.name;
      if (!moduleExports[modId]) moduleExports[modId] = {};
      for (const prop of exportsObj.properties) {
        if (prop.type !== 'ObjectProperty') continue;
        const propName = prop.key.name || prop.key.value;
        if (!propName) continue;
        // () => IDENT  →  record IDENT
        const val = prop.value;
        if (
          val.type === 'ArrowFunctionExpression' &&
          val.body.type === 'Identifier'
        ) {
          moduleExports[modId][propName] = val.body.name;
        }
      }
    },
  });

  // Pass 3: command registrations
  // Pattern: { type:"local[-jsx]", name:"...", description:"...", load:...  }
  walk(ast, {
    ObjectExpression(node) {
      const props = node.properties;
      if (!Array.isArray(props)) return;

      const get = (key) => {
        const p = props.find(
          (p) =>
            p.type === 'ObjectProperty' &&
            (p.key.name === key || p.key.value === key)
        );
        if (!p) return null;
        const v = p.value;
        // !0 → true, !1 → false (minifier pattern)
        if (v.type === 'UnaryExpression' && v.operator === '!' && v.argument.type === 'NumericLiteral') {
          return { value: v.argument.value === 0 };
        }
        return v;
      };

      const typeNode = get('type');
      const nameNode = get('name');
      if (!typeNode || !nameNode) return;

      const typeVal = typeNode.value;
      const nameVal = nameNode.value;
      if (typeVal !== 'local' && typeVal !== 'local-jsx') return;
      if (typeof nameVal !== 'string') return;

      const reg = {
        type: typeVal,
        name: nameVal,
        description: get('description')?.value ?? null,
        loc_byte: node.start,
        loc_line: node.loc?.start?.line ?? null,
      };

      // Optional fields
      for (const field of [
        'argumentHint', 'immediate', 'supportsNonInteractive',
        'thinClientDispatch', 'isHidden',
      ]) {
        const n = get(field);
        if (n) reg[field] = n.value ?? null;
      }

      // aliases: array of strings
      const aliasNode = get('aliases');
      if (aliasNode && aliasNode.type === 'ArrayExpression') {
        reg.aliases = aliasNode.elements
          .filter((e) => e && e.type === 'StringLiteral')
          .map((e) => e.value);
      }

      // load: () => Promise.resolve().then(() => (INIT_FN(), MODULE_OBJ))
      const loadNode = get('load');
      if (loadNode) {
        const modId = extractLoadModuleId(loadNode);
        if (modId) reg.module_id = modId;
      }

      if (!commands[nameVal]) {
        commands[nameVal] = reg;
      }
    },
  });

  return { version, built: new Date().toISOString().slice(0, 10), commands, moduleExports, functions };
}

// Extract module identifier from Bun load pattern:
//   () => Promise.resolve().then(() => (INIT_FN(), MODULE_OBJ))
function extractLoadModuleId(node) {
  // Outer: ArrowFunctionExpression
  if (node.type !== 'ArrowFunctionExpression') return null;
  const body = node.body;

  // body: CallExpression = Promise.resolve().then(...)
  if (body.type !== 'CallExpression') return null;
  const thenArgs = body.arguments;
  if (!thenArgs || thenArgs.length === 0) return null;

  // inner: () => (INIT_FN(), MODULE_OBJ)
  const inner = thenArgs[0];
  if (inner.type !== 'ArrowFunctionExpression') return null;
  const innerBody = inner.body;

  // innerBody: SequenceExpression (A, B) where B is MODULE_OBJ identifier
  if (innerBody.type === 'SequenceExpression') {
    const exprs = innerBody.expressions;
    const last = exprs[exprs.length - 1];
    if (last && last.type === 'Identifier') return last.name;
  }
  // innerBody could also just be the identifier directly
  if (innerBody.type === 'Identifier') return innerBody.name;

  return null;
}

// Generic single-char strings and booleans that appear everywhere
const NOISE_STRINGS = new Set([
  'true', 'false', '0', '1', '2', '', ' ', '\n', '\t',
  'undefined', 'null', 'string', 'number', 'boolean', 'object', 'function',
]);

// ── Command extraction ────────────────────────────────────────────────────────

function extractCommand(src, index, cmdName, maxDepth) {
  const reg = index.commands[cmdName];
  if (!reg) return { error: `command '${cmdName}' not found in index` };

  const result = {
    command: cmdName,
    registration: { ...reg },
    callGraph: [],
    literals: [],
    telemetry: [],
    identifiers: new Set(),
  };

  // Entry points: functions reachable from module exports
  const modId = reg.module_id;
  const entryFns = [];
  if (modId && index.moduleExports[modId]) {
    for (const [prop, fnId] of Object.entries(index.moduleExports[modId])) {
      if (index.functions[fnId]) entryFns.push({ fn: fnId, via: prop });
    }
  }

  if (entryFns.length === 0) {
    result.note = `no entry functions found for module '${modId}'`;
    return serialize(result);
  }

  const visited = new Set();

  function bfs(fnId, depth) {
    if (depth > maxDepth || visited.has(fnId)) return;
    visited.add(fnId);
    result.identifiers.add(fnId);

    const loc = index.functions[fnId];
    if (!loc) return;

    const slice = src.slice(loc.start, loc.end);
    let ast;
    try {
      ast = parser.parse(slice, {
        sourceType: 'script',
        errorRecovery: true,
        strictMode: false,
      });
    } catch {
      return;
    }

    walk(ast, {
      CallExpression(node) {
        let calleeId = null;
        if (node.callee.type === 'Identifier') {
          calleeId = node.callee.name;
        } else if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier'
        ) {
          calleeId = `${node.callee.object.name}.${node.callee.property.name || node.callee.property.value}`;
        }
        if (calleeId) {
          result.callGraph.push({
            from: fnId,
            to: calleeId,
            loc_byte: loc.start + node.start,
          });
          const baseId = calleeId.split('.')[0];
          if (index.functions[baseId]) bfs(baseId, depth + 1);
        }
      },

      StringLiteral(node) {
        const v = node.value;
        if (!v || v.length > 200) return;
        const lbyte = loc.start + node.start;
        if (/^tengu_/.test(v)) {
          result.telemetry.push({ event: v, loc_byte: lbyte });
        } else if (!NOISE_STRINGS.has(v) && v.length > 1) {
          result.literals.push({ kind: 'string', value: v, loc_byte: lbyte });
        }
      },

      NumericLiteral(node) {
        result.literals.push({
          kind: 'number',
          value: node.value,
          loc_byte: loc.start + node.start,
        });
      },
    });
  }

  for (const { fn } of entryFns) bfs(fn, 0);

  return serialize(result);
}

function serialize(result) {
  return {
    ...result,
    identifiers: Array.from(result.identifiers),
    callGraph: dedupe(result.callGraph, (e) => `${e.from}->${e.to}`),
    literals: dedupe(result.literals, (e) => `${e.kind}:${e.value}`),
    telemetry: dedupe(result.telemetry, (e) => e.event),
  };
}

function dedupe(arr, key) {
  const seen = new Set();
  return arr.filter((e) => {
    const k = key(e);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const opts = parseArgs();

  if (!opts.mode) {
    console.error('Usage: extract-ast.js --build-index | --cmd <name>');
    process.exit(1);
  }

  if (opts.mode === 'index') {
    if (!opts.bundle || !opts.version) {
      console.error('--build-index requires --bundle and --version');
      process.exit(1);
    }

    process.stderr.write(`Parsing bundle: ${opts.bundle}\n`);
    const src = fs.readFileSync(opts.bundle, 'utf8');
    const t = Date.now();
    const index = buildIndex(src, opts.version);
    const elapsed = Date.now() - t;

    const cmdCount = Object.keys(index.commands).length;
    const fnCount = Object.keys(index.functions).length;
    process.stderr.write(`Done in ${elapsed}ms. Commands: ${cmdCount}, Functions: ${fnCount}\n`);

    const cacheDir = path.join(os.homedir(), '.cc-gnothi', 'cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    const outPath = path.join(cacheDir, `index-${opts.version}.json`);
    fs.writeFileSync(outPath, JSON.stringify(index, null, 2));
    process.stderr.write(`Index written: ${outPath}\n`);
    return;
  }

  if (opts.mode === 'cmd') {
    if (!opts.cmd || !opts.bundle) {
      console.error('--cmd requires --bundle and (optionally) --index');
      process.exit(1);
    }

    const indexPath = opts.indexPath
      ?? path.join(os.homedir(), '.cc-gnothi', 'cache', `index-${opts.version ?? '?'}.json`);

    if (!fs.existsSync(indexPath)) {
      console.error(`Index not found: ${indexPath}. Run --build-index first.`);
      process.exit(1);
    }

    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    const src = fs.readFileSync(opts.bundle, 'utf8');
    const out = extractCommand(src, index, opts.cmd, opts.depth);
    process.stdout.write(JSON.stringify(out, null, 2));
    return;
  }
}

main();
