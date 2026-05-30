#!/usr/bin/env node
/**
 * extract-ast.js — static analysis tool for cc-gnothi
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
    mode: null,       // 'index' | 'cmd' | 'hash' | 'system-context'
    cmd: null,
    bundle: null,
    version: null,
    indexPath: null,
    depth: 2,
    minStringLen: 500,
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--build-index':         opts.mode = 'index'; break;
      case '--hash-commands':       opts.mode = 'hash';  break;
      case '--dump-system-context': opts.mode = 'system-context'; break;
      case '--dump-prompts':        opts.mode = 'dump-prompts'; break;
      case '--cmd':                 opts.mode = 'cmd'; opts.cmd = args[++i]; break;
      case '--bundle':      opts.bundle = args[++i]; break;
      case '--version':     opts.version = args[++i]; break;
      case '--index':       opts.indexPath = args[++i]; break;
      case '--out-dir':     opts.outDir = args[++i]; break;
      case '--depth':       opts.depth = parseInt(args[++i], 10); break;
      case '--min-len':     opts.minStringLen = parseInt(args[++i], 10); break;
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

// ── Helpers shared across passes ──────────────────────────────────────────────

// Concatenate static parts of a TemplateLiteral; mark interpolations as " ... ".
function cooked(templateLiteralNode) {
  const parts = templateLiteralNode.quasis.map((q) => q.value.cooked ?? q.value.raw);
  if (templateLiteralNode.expressions.length === 0) return parts.join('');
  return parts.join(' ... ');
}

// Extract a getter's static return value, if simple.
// Handles: return "X" / return `X` / return cond ? "A" : "B".
// Returns null when the getter is dynamic enough that there's no single value.
function staticGetterValue(methodNode) {
  if (!methodNode || methodNode.type !== 'ObjectMethod' || methodNode.kind !== 'get') return null;
  const body = methodNode.body;
  if (!body || body.type !== 'BlockStatement') return null;
  for (const stmt of body.body) {
    if (stmt.type !== 'ReturnStatement' || !stmt.argument) continue;
    const arg = stmt.argument;
    if (arg.type === 'StringLiteral') return arg.value;
    if (arg.type === 'TemplateLiteral') return cooked(arg);
    if (arg.type === 'ConditionalExpression') {
      const a = arg.consequent && arg.consequent.type === 'StringLiteral' ? arg.consequent.value : null;
      const b = arg.alternate  && arg.alternate.type  === 'StringLiteral' ? arg.alternate.value  : null;
      if (a && b) return `${a} | ${b}`;
      return a || b;
    }
  }
  return null;
}

// Scan one function slice for substantial string/template literals.
// Used to chase `getPromptForCommand` → external function references (1 hop).
function extractTextLiteralsFromFn(src, fnLoc, minLen = 80) {
  const slice = src.slice(fnLoc.start, fnLoc.end);
  let ast;
  try {
    ast = parser.parse(slice, { sourceType: 'script', errorRecovery: true, strictMode: false });
  } catch { return []; }
  const out = [];
  walk(ast, {
    StringLiteral(node) {
      if (node.value && node.value.length >= minLen) out.push(node.value);
    },
    TemplateLiteral(node) {
      const t = cooked(node);
      if (t.length >= minLen) out.push(t);
    },
  });
  return out;
}

// Extract a prompt body from a registration object's `getPromptForCommand` method.
// Handles four return shapes that show up in actual CC bundles (v2.1.158):
//
//   1. `return [{text:"..." | `...`}]`                — inline literal
//   2. `return [{text: FN}]` or `[{text: FN(...)}]`   — 1-hop into FN's body
//   3. `return [{text: COND ? A : B}]`                — both branches
//   4. `return EXPR, [{text: $}]` with $ a local var  — fallback: scan method body
//
// `functions` is the buildIndex Pass-1 result; 1-hop lookups land there.
// Returns `null` when no text could be recovered (e.g., the method dispatches
// fully dynamically and the body has no substantial inline strings).
function extractPromptBody(propsArr, functions, variables, src) {
  if (!Array.isArray(propsArr)) return null;
  const method = propsArr.find(p =>
    p.type === 'ObjectMethod'
    && (p.key.name === 'getPromptForCommand' || p.key.value === 'getPromptForCommand')
  );
  if (!method || !method.body || method.body.type !== 'BlockStatement') return null;

  const parts = [];
  const traces = [];

  // Resolve a value node sitting in the `text:` slot. ConditionalExpression
  // recurses on both branches — CC bundles use that to flag-gate prompts
  // (e.g., init's `HH5()?AH5:_H5`).
  const resolveText = (v) => {
    if (!v) return;
    if (v.type === 'StringLiteral') {
      parts.push(v.value);
      traces.push('inline string');
    } else if (v.type === 'TemplateLiteral') {
      parts.push(cooked(v));
      traces.push('inline template');
    } else if (v.type === 'ConditionalExpression') {
      traces.push('conditional');
      resolveText(v.consequent);
      resolveText(v.alternate);
    } else if (v.type === 'Identifier') {
      const fnLoc = functions[v.name];
      const variable = variables && variables[v.name];
      if (fnLoc) {
        const lits = extractTextLiteralsFromFn(src, fnLoc);
        if (lits.length) parts.push(...lits);
        traces.push(`identifier→${v.name} (fn, ${lits.length} literals)`);
      } else if (variable) {
        parts.push(variable.value);
        traces.push(`identifier→${v.name} (var ${variable.kind}, ${variable.value.length} chars)`);
      } else {
        traces.push(`identifier→${v.name} (unresolved)`);
      }
    } else if (v.type === 'CallExpression' && v.callee && v.callee.type === 'Identifier') {
      const loc = functions[v.callee.name];
      if (loc) {
        const lits = extractTextLiteralsFromFn(src, loc);
        if (lits.length) parts.push(...lits);
        traces.push(`call→${v.callee.name}(...) (${lits.length} literals)`);
      } else {
        traces.push(`call→${v.callee.name}(...) (unresolved)`);
      }
    } else {
      traces.push(`unhandled ${v.type}`);
    }
  };

  // Walk every `return` in the method; handle `return EXPR, ARR` SequenceExpression
  // by taking the trailing expression as the array.
  for (const stmt of method.body.body) {
    if (stmt.type !== 'ReturnStatement' || !stmt.argument) continue;
    let arr = stmt.argument;
    if (arr.type === 'SequenceExpression') {
      arr = arr.expressions[arr.expressions.length - 1];
    }
    if (!arr || arr.type !== 'ArrayExpression') continue;
    for (const elem of arr.elements) {
      if (!elem || elem.type !== 'ObjectExpression') continue;
      const textProp = elem.properties.find(p =>
        p.type === 'ObjectProperty' && (p.key.name === 'text' || p.key.value === 'text')
      );
      if (!textProp) continue;
      resolveText(textProp.value);
    }
  }

  // Fallback: nothing extractable through `text:` chains alone — scan the
  // method body itself for substantial literals + variable references.
  // Catches the shape where the body is assembled into a local variable and
  // returned as `[{text:$}]` (team-onboarding etc.), by pulling values from
  // any top-level string/template variables referenced inside the method.
  if (parts.length === 0) {
    const bodyText = src.slice(method.start, method.end);
    let bodyAst;
    try {
      bodyAst = parser.parse(bodyText, { sourceType: 'script', errorRecovery: true, strictMode: false });
    } catch { bodyAst = null; }
    if (bodyAst) {
      const seen = new Set();
      walk(bodyAst, {
        StringLiteral(n) { if (n.value && n.value.length >= 200) parts.push(n.value); },
        TemplateLiteral(n) { const t = cooked(n); if (t.length >= 200) parts.push(t); },
        Identifier(n) {
          if (!variables) return;
          const v = variables[n.name];
          if (v && !seen.has(n.name)) {
            seen.add(n.name);
            parts.push(v.value);
          }
        },
      });
      if (parts.length) {
        traces.push(`method-body scan (${parts.length} chunks, vars: ${[...seen].join(',') || 'none'})`);
      }
    }
  }

  if (parts.length === 0) return null;
  return { text: parts.join('\n\n---\n\n'), trace: traces.join('; ') };
}

// ── Index build ───────────────────────────────────────────────────────────────

function buildIndex(src, version) {
  let ast;
  try {
    ast = parser.parse(src, {
      sourceType: 'script',
      errorRecovery: true,
      strictMode: false,
    });
  } catch (err) {
    // @babel/parser failed (observed starting around CC v2.1.153) — fall back
    // to Arbor's tree-sitter front end, which has stronger error recovery
    // on this minifier profile at this bundle size. See
    // scripts/arbor-fallback.js for the strategy.
    process.stderr.write(
      `@babel/parser failed at bundle parse stage: ${err.message}\n` +
      `Falling back to Arbor (tree-sitter)...\n`
    );
    const { arborFallback } = require('./arbor-fallback');
    return arborFallback(src, version);
  }

  const commands = {};
  const moduleExports = {};
  const functions = {};
  // Top-level string/template constants — needed for prompt-body resolution
  // (e.g., init's `text: AH5` where AH5 is `var AH5 = "Initialize ..."`).
  // Threshold 200 chars filters minifier noise (short labels, classnames).
  const variables = {};

  // Pass 1: function locations + substantial string/template variables
  walk(ast, {
    FunctionDeclaration(node) {
      if (node.id) functions[node.id.name] = { start: node.start, end: node.end };
    },
    VariableDeclarator(node) {
      if (!node.id || node.id.type !== 'Identifier') return;
      const init = node.init;
      if (!init) return;
      const name = node.id.name;
      if (
        init.type === 'FunctionExpression' ||
        init.type === 'ArrowFunctionExpression'
      ) {
        functions[name] = { start: init.start, end: init.end };
      } else if (init.type === 'StringLiteral' && init.value.length >= 200) {
        variables[name] = { kind: 'string', value: init.value };
      } else if (init.type === 'TemplateLiteral') {
        const t = cooked(init);
        if (t.length >= 200) variables[name] = { kind: 'template', value: t };
      }
    },
  });

  // Pass 2: w6/P6(MODULE_OBJ, { PROP: () => FN_ID }) — module exports (P6 since v2.1.150)
  walk(ast, {
    CallExpression(node) {
      const callee = node.callee;
      if (callee.type !== 'Identifier' || !['w6', 'P6'].includes(callee.name)) return;
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

      // Note: registration objects mix ObjectProperty (description:"...") and
      // ObjectMethod (`get description(){...}` / `async getPromptForCommand(){...}`).
      // `get()` flattens both into a {value} shape where possible; methods that
      // can't be reduced to a single value return {_method:true, _node} so the
      // caller can inspect the AST node itself (see `extractPromptBody`).
      const get = (key) => {
        const p = props.find(
          (p) =>
            (p.type === 'ObjectProperty' || p.type === 'ObjectMethod') &&
            (p.key.name === key || p.key.value === key)
        );
        if (!p) return null;
        if (p.type === 'ObjectMethod') {
          if (p.kind === 'get') {
            const sv = staticGetterValue(p);
            if (sv != null) return { value: sv };
          }
          return { _method: true, _kind: p.kind, _node: p };
        }
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
      // CC keeps adding new registration types as the agent surface grows.
      // Pre-fix: only `local` and `local-jsx` were accepted, which silently
      // dropped `prompt` (init, review, insights, team-onboarding,
      // init-verifiers, mcp__), `tool` (web_search, explain_command),
      // `callback`, and `function` registrations from v2.1.158. We now
      // accept the known type set and skip with a stderr warning on any
      // unfamiliar type so a future regression surfaces visibly instead of
      // accumulating as silent "분석 누락" downstream.
      const KNOWN_TYPES = new Set([
        'local', 'local-jsx',         // original cmd / JSX cmd
        'prompt',                     // prompt-style commands (init, review, etc.)
        'tool',                       // tool-style commands (web_search, etc.)
        'callback', 'function',       // newer registration shapes
      ]);
      if (!KNOWN_TYPES.has(typeVal)) {
        process.stderr.write(`[unknown type] ${typeVal}:${nameVal}\n`);
        return;
      }
      if (typeof nameVal !== 'string') return;

      const reg = {
        type: typeVal,
        name: nameVal,
        description: get('description')?.value ?? null,
        loc_byte: node.start,
        // loc_byte_end records the registration object's closing brace
        // offset (inclusive). Downstream consumers can pass the
        // (loc_byte, loc_byte_end) span to `arbor symbol-in-range` to
        // pull out exactly the handler methods that live inside this
        // object — disambiguating same-name methods like
        // `getPromptForCommand` that appear in many command registrations.
        loc_byte_end: node.end,
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

      // Some registration shapes don't use `load:` at all. `prompt`-type
      // commands carry `async getPromptForCommand(...) { ... }` instead;
      // surface the method's presence so downstream knows the handler is
      // inline at the registration object itself.
      if (typeVal === 'prompt') {
        const methodNode = props.find(
          (p) => p.type === 'ObjectMethod' &&
                 (p.key.name === 'getPromptForCommand' ||
                  p.key.value === 'getPromptForCommand')
        );
        if (methodNode) reg.handler_method = 'getPromptForCommand';
      }

      // load: () => Promise.resolve().then(() => (INIT_FN(), MODULE_OBJ))
      const loadNode = get('load');
      // get() returns ObjectProperty values only. For ObjectMethod (method
      // shorthand) declarations like `async load() { ... }` we need a
      // separate lookup.
      const loadMethodNode = loadNode ? null : props.find(
        (p) => p.type === 'ObjectMethod' &&
               (p.key.name === 'load' || p.key.value === 'load')
      );
      const effectiveLoadNode = loadNode || loadMethodNode;
      if (effectiveLoadNode) {
        // Existing: module_id extraction (for the dynamic-import shape)
        const modId = extractLoadModuleId(effectiveLoadNode);
        if (modId) reg.module_id = modId;

        // Phase B (cc-gnothi PR #2) — also extract the load handler
        // identifier so downstream stages can ask Arbor's
        // `arbor_dependencies` for the handler's call graph. Patterns:
        //   load: IDENT                          → reg.load_ident
        //   load: async () => handler(...)       → reg.load_ident + load_inline
        //   async load() { return handler() }    → reg.load_ident + load_inline
        // (effectiveLoadNode is either an ObjectProperty value or an
        // ObjectMethod with a BlockStatement body.)
        if (effectiveLoadNode.type === 'Identifier') {
          reg.load_ident = effectiveLoadNode.name;
        } else {
          reg.load_inline = true;
          const body = effectiveLoadNode.body;
          let firstCall = null;
          if (body && body.type === 'CallExpression') {
            firstCall = body;
          } else if (body && body.type === 'BlockStatement') {
            for (const stmt of body.body) {
              if (stmt.type === 'ReturnStatement' && stmt.argument) {
                const arg = stmt.argument.type === 'AwaitExpression'
                  ? stmt.argument.argument
                  : stmt.argument;
                if (arg?.type === 'CallExpression') { firstCall = arg; break; }
              }
              if (stmt.type === 'ExpressionStatement' &&
                  stmt.expression.type === 'CallExpression') {
                firstCall = stmt.expression; break;
              }
            }
          }
          if (firstCall && firstCall.callee?.type === 'Identifier') {
            reg.load_ident = firstCall.callee.name;
          }
        }
      }

      // For `prompt` type, capture the body text from `getPromptForCommand`.
      // The body often lives in an external function (e.g., `text: R45(H)`);
      // we chase one hop into `functions`. Storing the full text here keeps
      // `--dump-prompts` a pure index→file projection (no re-parse needed).
      if (typeVal === 'prompt') {
        const body = extractPromptBody(props, functions, variables, src);
        if (body) {
          reg.prompt_body = {
            length: body.text.length,
            trace: body.trace,
            text:  body.text,
          };
        }
      }

      if (!commands[nameVal]) {
        commands[nameVal] = reg;
      }
    },
  });

  return { version, built: new Date().toISOString().slice(0, 10), commands, moduleExports, functions, variables };
}

// Extract module identifier from Bun load pattern:
//   () => Promise.resolve().then(() => (INIT_FN(), MODULE_OBJ))
function extractLoadModuleId(node) {
  // Outer: ArrowFunctionExpression OR FunctionExpression (method shorthand
  // form: `async load(){...}` — used by autofix-pr and similar local-jsx
  // commands declared with method shorthand instead of arrow assignment)
  if (node.type !== 'ArrowFunctionExpression' &&
      node.type !== 'FunctionExpression') return null;
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
  // Method-shorthand body (`async load(){ return await Promise.resolve()
  // .then(()=>(M(),X)) }`) wraps the inner expression in BlockStatement +
  // ReturnStatement + AwaitExpression. Unwrap and re-check.
  if (innerBody.type === 'BlockStatement') {
    for (const stmt of innerBody.body) {
      if (stmt.type === 'ReturnStatement' && stmt.argument) {
        const v = stmt.argument.type === 'AwaitExpression'
          ? stmt.argument.argument
          : stmt.argument;
        if (v?.type === 'Identifier') return v.name;
        if (v?.type === 'SequenceExpression') {
          const last = v.expressions[v.expressions.length - 1];
          if (last?.type === 'Identifier') return last.name;
        }
      }
    }
  }

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

// ── System context extraction ─────────────────────────────────────────────────
// Two-pass approach:
//   Pass A (full AST): find top-level string variable declarations (var X = "..." / `...`)
//   Pass B (index slices): scan each indexed function for StringLiteral + TemplateLiteral
// Content is included for internal analysis only — never reproduce in output spec.

function cooked(templateLiteralNode) {
  // Join static quasis parts; for dynamic templates, separate parts with " ... "
  const parts = templateLiteralNode.quasis.map((q) => q.value.cooked ?? q.value.raw);
  if (templateLiteralNode.expressions.length === 0) return parts.join('');
  // Dynamic: interleave " ... " placeholders so total length remains meaningful
  return parts.join(' ... ');
}

function makeLargeString(text, loc_byte) {
  const cap = 4000;
  return {
    len: text.length,
    loc_byte,
    // Content included for internal analysis only — DO NOT reproduce in output spec
    content: text.length > cap ? text.slice(0, cap) + '…[truncated]' : text,
  };
}

function extractSystemContext(src, index, minStringLen, version) {
  const candidates = new Map(); // identifier → entry

  function upsert(id, byteOffset, ls, tel) {
    if (!candidates.has(id)) {
      candidates.set(id, { identifier: id, byteOffset, totalStringChars: 0, largeStrings: [], telemetryEvents: [] });
    }
    const e = candidates.get(id);
    e.largeStrings.push(ls);
    e.totalStringChars += ls.len;
    for (const t of tel) if (!e.telemetryEvents.includes(t)) e.telemetryEvents.push(t);
  }

  // ── Pass A: full AST walk for top-level string variable declarations ─────────
  process.stderr.write(`Pass A: parsing full bundle for string variable declarations (~4s)...\n`);
  const ast = parser.parse(src, {
    sourceType: 'script',
    errorRecovery: true,
    strictMode: false,
  });

  walk(ast, {
    VariableDeclarator(node) {
      if (!node.id || node.id.type !== 'Identifier') return;
      const init = node.init;
      if (!init) return;

      let text = null;
      if (init.type === 'StringLiteral') {
        text = init.value;
      } else if (init.type === 'TemplateLiteral') {
        text = cooked(init);
      }

      if (text && text.length >= minStringLen) {
        upsert(node.id.name, node.start, makeLargeString(text, init.start), []);
      }
    },
  });

  process.stderr.write(`Pass A done: ${candidates.size} string variable candidates.\n`);

  // ── Pass B: scan each indexed function slice for StringLiteral + TemplateLiteral ─
  const fns = Object.entries(index.functions);
  process.stderr.write(`Pass B: scanning ${fns.length} function slices...\n`);

  let scanned = 0;
  for (const [fnId, loc] of fns) {
    if (loc.end - loc.start < minStringLen) { scanned++; continue; }

    const slice = src.slice(loc.start, loc.end);
    let fnAst;
    try {
      fnAst = parser.parse(slice, { sourceType: 'script', errorRecovery: true, strictMode: false });
    } catch { scanned++; continue; }

    const telHere = [];
    walk(fnAst, {
      StringLiteral(node) {
        const v = node.value;
        if (!v) return;
        if (/^tengu_/.test(v)) telHere.push(v);
        if (v.length >= minStringLen) {
          upsert(fnId, loc.start, makeLargeString(v, loc.start + node.start), []);
        }
      },
      TemplateLiteral(node) {
        const text = cooked(node);
        if (text && text.length >= minStringLen) {
          upsert(fnId, loc.start, makeLargeString(text, loc.start + node.start), []);
        }
      },
    });

    if (telHere.length > 0) {
      if (!candidates.has(fnId)) {
        candidates.set(fnId, { identifier: fnId, byteOffset: loc.start, totalStringChars: 0, largeStrings: [], telemetryEvents: [] });
      }
      for (const t of telHere) {
        if (!candidates.get(fnId).telemetryEvents.includes(t)) candidates.get(fnId).telemetryEvents.push(t);
      }
    }

    scanned++;
    if (scanned % 3000 === 0) {
      process.stderr.write(`  ${scanned}/${fns.length} scanned\n`);
    }
  }

  // ── Pass C: find system prompt assembler and force-include its callees ────────
  // Phase 1 (anchor): find a function calling OU7() — works for *U7 namespace versions.
  // Phase 2 (fallback): find the function calling the most already-known candidates.
  //   Section-builders are string-heavy and land in `candidates` after Pass A/B regardless
  //   of their namespace. The assembler is the function that calls the most of them.

  process.stderr.write('Pass C: tracing system prompt assembler call graph...\n');

  // Shared: extract and force-include all indexed callees of a confirmed assembler.
  const applyAssembler = (assemblerFnId, indexedCallees) => {
    for (const calleeId of indexedCallees) {
      if (calleeId === assemblerFnId) continue;
      const calleeLoc = index.functions[calleeId];
      const calleeSlice = src.slice(calleeLoc.start, calleeLoc.end);
      let calleeAst;
      try {
        calleeAst = parser.parse(calleeSlice, { sourceType: 'script', errorRecovery: true, strictMode: false });
      } catch { continue; }
      walk(calleeAst, {
        StringLiteral(node) {
          const v = node.value;
          if (v && v.length >= Math.min(minStringLen, 80)) {
            upsert(calleeId, calleeLoc.start, makeLargeString(v, calleeLoc.start + node.start), []);
          }
        },
        TemplateLiteral(node) {
          const text = cooked(node);
          if (text && text.length >= Math.min(minStringLen, 80)) {
            upsert(calleeId, calleeLoc.start, makeLargeString(text, calleeLoc.start + node.start), []);
          }
        },
      });
      if (!candidates.has(calleeId)) {
        candidates.set(calleeId, {
          identifier: calleeId, byteOffset: calleeLoc.start,
          totalStringChars: 0, largeStrings: [], telemetryEvents: [],
        });
      }
      candidates.get(calleeId).__assemblerCall = true;
    }
  };

  let assemblerFound = false;

  // Phase 1: OU7() anchor
  for (const [fnId, loc] of Object.entries(index.functions)) {
    const fnLen = loc.end - loc.start;
    if (fnLen > 8000 || fnLen < 100) continue;

    const slice = src.slice(loc.start, loc.end);
    // Must call OU7() (not be OU7 itself) — finds the section assembler, not OU7 itself
    if (fnId === 'OU7' || !slice.includes('OU7(')) continue;

    let fnAst;
    try {
      fnAst = parser.parse(slice, { sourceType: 'script', errorRecovery: true, strictMode: false });
    } catch { continue; }

    const indexedCallees = new Set();
    walk(fnAst, {
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && index.functions[node.callee.name]) {
          indexedCallees.add(node.callee.name);
        }
      },
    });

    if (indexedCallees.size < 2) continue;

    process.stderr.write(
      `  Assembler (anchor): ${fnId} (${fnLen} bytes, ${indexedCallees.size} indexed callees): `
      + [...indexedCallees].slice(0, 8).join(', ') + '\n'
    );

    applyAssembler(fnId, indexedCallees);
    assemblerFound = true;
    break;
  }

  // Phase 2: fallback — find function calling the most known candidates.
  // Namespace-agnostic: section-builders are in `candidates` regardless of their identifier.
  if (!assemblerFound) {
    process.stderr.write('  Phase 1 anchor not found — trying candidate-callee heuristic...\n');

    let bestFnId = null, bestFnLoc = null, bestFnLen = 0, bestFnSlice = null, bestCount = 0;

    for (const [fnId, loc] of Object.entries(index.functions)) {
      const fnLen = loc.end - loc.start;
      if (fnLen > 8000 || fnLen < 200) continue;
      if (candidates.has(fnId)) continue; // section-builders are not the assembler

      const slice = src.slice(loc.start, loc.end);
      let fnAst;
      try {
        fnAst = parser.parse(slice, { sourceType: 'script', errorRecovery: true, strictMode: false });
      } catch { continue; }

      const candidateCallees = new Set();
      walk(fnAst, {
        CallExpression(node) {
          if (node.callee.type === 'Identifier' && candidates.has(node.callee.name)) {
            candidateCallees.add(node.callee.name);
          }
        },
      });

      if (candidateCallees.size > bestCount) {
        bestCount = candidateCallees.size;
        bestFnId = fnId; bestFnLoc = loc; bestFnLen = fnLen; bestFnSlice = slice;
      }
    }

    if (bestFnId && bestCount >= 6) { // bestCount = unique candidate callees
      let fnAst;
      try {
        fnAst = parser.parse(bestFnSlice, { sourceType: 'script', errorRecovery: true, strictMode: false });
      } catch { fnAst = null; }

      const indexedCallees = new Set();
      if (fnAst) {
        walk(fnAst, {
          CallExpression(node) {
            if (node.callee.type === 'Identifier' && index.functions[node.callee.name]) {
              indexedCallees.add(node.callee.name);
            }
          },
        });
      }

      process.stderr.write(
        `  Assembler (fallback): ${bestFnId} (${bestFnLen} bytes, ${indexedCallees.size} indexed / ${bestCount} candidate callees): `
        + [...indexedCallees].slice(0, 8).join(', ') + '\n'
      );

      applyAssembler(bestFnId, indexedCallees);
      assemblerFound = true;
    }
  }

  if (!assemblerFound) process.stderr.write('  No assembler found via heuristic.\n');
  process.stderr.write('Pass C done.\n');

  // ── Score and sort: system-prompt patterns first, then prose, then keywords ───
  const all = Array.from(candidates.values());

  // Deduplicate largeStrings by loc_byte within each candidate
  for (const c of all) {
    const seen = new Set();
    c.largeStrings = c.largeStrings.filter((s) => {
      if (seen.has(s.loc_byte)) return false;
      seen.add(s.loc_byte);
      return true;
    });
    c.totalStringChars = c.largeStrings.reduce((s, x) => s + x.len, 0);
  }

  function syspromptScore(entry) {
    // Use MAX for rare high-value signals (not additive across strings).
    // Prose bonuses capped per candidate. Penalties additive.
    let maxRare = 0;
    let proseBonus = 0;
    let penalty = 0;

    for (const s of entry.largeStrings) {
      const c = s.content;
      // Rare signals: take the max from any one string
      if (c.startsWith('IMPORTANT:')) maxRare = Math.max(maxRare, 2000);
      if (c.startsWith('# ') && s.len < 6000) maxRare = Math.max(maxRare, 1500);
      if (c.includes('${') && s.len < 2000) maxRare = Math.max(maxRare, 800);
      // Prose bonuses: capped at 400 total (prevents accumulation across many strings)
      if (c.includes('\n') && s.len < 5000) proseBonus = Math.max(proseBonus, 300);
      if (c.includes('.') && c.includes(' ') && s.len >= 100 && s.len < 5000)
        proseBonus = Math.max(proseBonus, 400);
      // Penalties (additive — each bad string contributes)
      if (c.includes('\n') && s.len > 8000) penalty += 600;
      if (!c.includes('\n') && s.len > 5000) penalty += 1000;
    }
    // Bonus for multi-string candidates (array-based section builders like OU7, zU7)
    // Each function with 3+ prose strings gets +100 bonus (up to 400) to surface them
    const proseStrings = entry.largeStrings.filter(
      (s) => s.content.includes('.') && s.content.includes(' ') && s.len >= 100 && s.len < 5000
    );
    const multiBonus = Math.min(400, Math.max(0, (proseStrings.length - 2) * 100));
    return maxRare + proseBonus + multiBonus - penalty;
  }

  all.sort((a, b) => {
    // Assembler callees always come first (guaranteed to be system prompt sections)
    if (a.__assemblerCall && !b.__assemblerCall) return -1;
    if (b.__assemblerCall && !a.__assemblerCall) return 1;
    const diff = syspromptScore(b) - syspromptScore(a);
    if (diff !== 0) return diff;
    return b.totalStringChars - a.totalStringChars;
  });

  const top = all.slice(0, 30);
  process.stderr.write(`Done. ${all.length} total candidates → top ${top.length} returned.\n`);

  return {
    version,
    extracted: new Date().toISOString().slice(0, 10),
    minStringLen,
    totalFunctions: fns.length,
    note: 'largeStrings.content is for analysis only — DO NOT reproduce verbatim in output spec',
    systemContextFunctions: top,
  };
}

// ── Prompt body dump ──────────────────────────────────────────────────────────

// Project `index.commands[name].prompt_body.text` into one file per command
// under `outDir`. Outputs are header-prefixed (one comment block at the top
// describing source/version/trace) and the rest is the raw extracted body —
// suitable for inclusion verbatim in an analyze prompt.
function dumpPrompts(index, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  let written = 0;
  let skipped = 0;
  for (const [name, reg] of Object.entries(index.commands || {})) {
    if (!reg.prompt_body || !reg.prompt_body.text) { skipped++; continue; }
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const outPath = path.join(outDir, `${safeName}.txt`);
    const header = [
      `# command: ${name}`,
      `# type: ${reg.type}`,
      `# bundle_version: ${index.version}`,
      `# loc_byte: ${reg.loc_byte}`,
      `# extraction: ${reg.prompt_body.trace}`,
      `# length: ${reg.prompt_body.length}`,
      '',
      '',
    ].join('\n');
    fs.writeFileSync(outPath, header + reg.prompt_body.text);
    written++;
  }
  return { written, skipped };
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

  if (opts.mode === 'hash') {
    if (!opts.bundle || !opts.version) {
      console.error('--hash-commands requires --bundle and --version');
      process.exit(1);
    }
    const crypto = require('crypto');
    const cacheDir = path.join(os.homedir(), '.cc-gnothi', 'cache');
    const indexPath = opts.indexPath ?? path.join(cacheDir, `index-${opts.version}.json`);

    if (!fs.existsSync(indexPath)) {
      process.stderr.write(`Building index for v${opts.version} first...\n`);
      const src0 = fs.readFileSync(opts.bundle, 'utf8');
      const index0 = buildIndex(src0, opts.version);
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(indexPath, JSON.stringify(index0, null, 2));
    }

    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    process.stderr.write(`Loading bundle ${opts.bundle}...\n`);
    const src = fs.readFileSync(opts.bundle, 'utf8');

    const hashes = {};
    const cmdNames = Object.keys(index.commands);
    process.stderr.write(`Computing structural fingerprints for ${cmdNames.length} commands...\n`);

    for (const cmdName of cmdNames) {
      const extracted = extractCommand(src, index, cmdName, opts.depth);
      const lits = new Set(
        (extracted.literals || []).filter(x => x.kind === 'string').map(x => x.value)
      );
      const tels = new Set((extracted.telemetry || []).map(x => x.event));
      const sig = [...lits, ...tels].sort().join('|');
      hashes[cmdName] = crypto.createHash('sha256').update(sig).digest('hex').slice(0, 16);
    }

    fs.mkdirSync(cacheDir, { recursive: true });
    const outPath = path.join(cacheDir, `hashes-${opts.version}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ version: opts.version, commands: hashes }, null, 2));
    process.stderr.write(`Hashes written: ${outPath} (${cmdNames.length} commands)\n`);
    return;
  }

  if (opts.mode === 'system-context') {
    if (!opts.bundle || !opts.version) {
      console.error('--dump-system-context requires --bundle and --version');
      process.exit(1);
    }

    const cacheDir = path.join(os.homedir(), '.cc-gnothi', 'cache');
    const indexPath = opts.indexPath ?? path.join(cacheDir, `index-${opts.version}.json`);

    if (!fs.existsSync(indexPath)) {
      process.stderr.write(`Building index for v${opts.version} first...\n`);
      const src0 = fs.readFileSync(opts.bundle, 'utf8');
      const index0 = buildIndex(src0, opts.version);
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(indexPath, JSON.stringify(index0, null, 2));
    }

    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    process.stderr.write(`Loading bundle ${opts.bundle}...\n`);
    const src = fs.readFileSync(opts.bundle, 'utf8');

    const result = extractSystemContext(src, index, opts.minStringLen, opts.version);

    fs.mkdirSync(cacheDir, { recursive: true });
    const outPath = path.join(cacheDir, `system-context-${opts.version}.json`);
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    process.stderr.write(
      `System context written: ${outPath} (${result.systemContextFunctions.length} candidates)\n`
    );
    return;
  }

  if (opts.mode === 'dump-prompts') {
    if (!opts.version) {
      console.error('--dump-prompts requires --version');
      process.exit(1);
    }
    const cacheDir = path.join(os.homedir(), '.cc-gnothi', 'cache');
    const indexPath = opts.indexPath ?? path.join(cacheDir, `index-${opts.version}.json`);

    if (!fs.existsSync(indexPath)) {
      if (!opts.bundle) {
        console.error(`Index not found: ${indexPath}. Pass --bundle to build, or run --build-index first.`);
        process.exit(1);
      }
      process.stderr.write(`Building index for v${opts.version} first...\n`);
      const src0 = fs.readFileSync(opts.bundle, 'utf8');
      const index0 = buildIndex(src0, opts.version);
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(indexPath, JSON.stringify(index0, null, 2));
    }

    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    const repoRoot = path.resolve(__dirname, '..');
    const outDir = opts.outDir
      ?? path.join(repoRoot, 'versions', `v${opts.version}`, '_raw');

    const r = dumpPrompts(index, outDir);
    process.stderr.write(
      `Dumped ${r.written} prompt bodies to ${outDir} (${r.skipped} commands without extractable body)\n`
    );
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
