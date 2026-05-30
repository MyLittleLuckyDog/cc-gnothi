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

// Resolve the leftmost StringLiteral of a `+`-chained BinaryExpression — the
// static prefix used by dynamic command names. Returns null if the leftmost
// leaf is not a StringLiteral. Used to surface `mcp__`-prefixed MCP-prompt
// registrations: `{type:"prompt", name:"mcp__"+FK(srv)+"__"+q.name, …}`.
function getDynamicNamePrefix(nameNode) {
  let n = nameNode;
  while (n && n.type === 'BinaryExpression' && n.operator === '+') {
    n = n.left;
  }
  return n && n.type === 'StringLiteral' ? n.value : null;
}

// Trace a local identifier inside a method body to the external string/template
// variable(s) it is assigned from. Handles three common shapes:
//
//   let X = EXT_VAR                                  → pull EXT_VAR
//   let X = cond ? A : EXT_VAR                       → pull both A and EXT_VAR
//   let X = EXT_VAR.replaceAll(…).replaceAll(…)      → walk MemberExpression
//                                                       to leftmost Identifier
//
// Stops at one local hop (e.g., `$ = _.replaceAll(...)` then `_ = ... : EXT`)
// to keep the search bounded; deeper chains have not shown up in CC bundles.
function traceLocalVar(methodBody, localName, variables, depth) {
  if (depth >= 2) return [];
  const out = [];
  const seen = new Set();
  const pullIdent = (id) => {
    if (seen.has(id.name)) return;
    seen.add(id.name);
    // Same local-scope-first rule as the outer resolveText: minifier
    // recycles `_`, `$`, … across many bodies, so a top-level
    // `variables[name]` is almost always a different command's definition.
    const local = traceLocalVar(methodBody, id.name, variables, depth + 1);
    if (local.length) { out.push(...local); return; }
    const v = variables && variables[id.name];
    if (v) out.push(v.value);
  };
  // Recursively visit an expression tree, calling pullIdent on every Identifier
  // we can reach through string-building operators. Covers:
  //   X            → Identifier
  //   X + Y        → BinaryExpression('+')
  //   X && Y, A || B → LogicalExpression (logical fallback string ?: pattern)
  //   cond ? A : B → ConditionalExpression
  //   X.replaceAll(...).replaceAll(...)  → CallExpression with Member chain
  //   `…${X}…`     → TemplateLiteral with embedded expressions
  const traceExpr = (e) => {
    if (!e) return;
    if (e.type === 'Identifier') {
      pullIdent(e);
    } else if (e.type === 'BinaryExpression' || e.type === 'LogicalExpression') {
      traceExpr(e.left);
      traceExpr(e.right);
    } else if (e.type === 'ConditionalExpression') {
      traceExpr(e.consequent);
      traceExpr(e.alternate);
    } else if (e.type === 'CallExpression') {
      if (e.callee.type === 'MemberExpression') traceExpr(e.callee.object);
    } else if (e.type === 'TemplateLiteral') {
      for (const expr of e.expressions) traceExpr(expr);
    }
  };
  walk(methodBody, {
    VariableDeclarator(node) {
      if (!node.id || node.id.type !== 'Identifier' || node.id.name !== localName) return;
      traceExpr(node.init);
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

  // Strip wrappers that just thread a value through — AwaitExpression and
  // parenthesization carry no extraction information, only the inner node
  // matters. Without this, v2.1.132~v2.1.150's `commit`/`commit-push-pr`
  // hit `text: await lt(_, {...}, "/commit")` and the resolver gave up on
  // an `AwaitExpression` it didn't recognise.
  const unwrap = (n) => {
    while (n) {
      if (n.type === 'AwaitExpression')           n = n.argument;
      else if (n.type === 'ParenthesizedExpression') n = n.expression;
      else break;
    }
    return n;
  };

  // Resolve a value node sitting in the `text:` slot. ConditionalExpression
  // recurses on both branches — CC bundles use that to flag-gate prompts
  // (e.g., init's `HH5()?AH5:_H5`).
  const resolveText = (v) => {
    v = unwrap(v);
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
      // Local-scope resolution first: minifier reuses short names like `_`
      // and `$` across many sites, and the top-level functions/variables
      // maps record only one definition per name (last-write-wins). A
      // `let $ = ...` *inside this method* is always the right answer when
      // present, regardless of whatever else `$` happens to be at module
      // scope.
      const traced = traceLocalVar(method.body, v.name, variables, 0);
      if (traced.length) {
        parts.push(...traced);
        traces.push(`identifier→${v.name} (local→${traced.length} ext vars)`);
      } else {
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

  // Fallback: nothing extractable through `text:` chains — scan the method
  // body itself for substantial inline literals. Earlier versions also
  // scanned every Identifier and pulled from `variables` if it matched, but
  // that lit up on minified single-letter names that overlap across many
  // unrelated commands (so `mcp__` came back with a PowerShell snippet,
  // `team-onboarding` came back with `/loop` body). Locals are now resolved
  // only through the `text:` slot's traceLocalVar path above; this fallback
  // catches genuinely inline `\`...\`` / "..." in the method itself.
  if (parts.length === 0) {
    const bodyText = src.slice(method.start, method.end);
    let bodyAst;
    try {
      bodyAst = parser.parse(bodyText, { sourceType: 'script', errorRecovery: true, strictMode: false });
    } catch { bodyAst = null; }
    if (bodyAst) {
      walk(bodyAst, {
        StringLiteral(n) { if (n.value && n.value.length >= 200) parts.push(n.value); },
        TemplateLiteral(n) { const t = cooked(n); if (t.length >= 200) parts.push(t); },
      });
      if (parts.length) traces.push(`method-body inline literals (${parts.length})`);
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
  // Registrations whose `name` is a runtime-built BinaryExpression carrying a
  // static StringLiteral prefix (currently: `mcp__`-prefixed MCP-prompt
  // commands). Kept out of `commands` to avoid generating per-name spec
  // files for what is really one prefix-class.
  const dynamicCommands = {};
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

  // Pass 2a — collect candidate module-wrapper callees by finding the
  // `var MODID = {};` pattern. The wrapper convention is:
  //
  //     var oF_ = {};
  //     X6(oF_, { call:()=>LE6, ... });
  //
  // Earlier minifier builds used w6 / P6 as the wrapper name; v2.1.158
  // ships X6 (and ~432 other instances of the same shape). Hard-coding
  // the wrapper name has been the silent-누락 source up to PR #1. We
  // now auto-detect: any function called with (MODID, {...}) where
  // MODID was previously assigned `{}` counts as a module-export call.
  const emptyObjModIds = new Set();
  walk(ast, {
    VariableDeclarator(node) {
      if (node.id?.type !== 'Identifier') return;
      if (node.init?.type !== 'ObjectExpression') return;
      if ((node.init.properties || []).length !== 0) return;
      emptyObjModIds.add(node.id.name);
    },
  });

  // Pass 2b — MODULE_WRAPPER(MODULE_OBJ, { PROP: () => HANDLER_IDENT })
  // for any wrapper that targets one of the empty-object module ids.
  walk(ast, {
    CallExpression(node) {
      const callee = node.callee;
      if (callee.type !== 'Identifier') return;
      const [target, exportsObj] = node.arguments;
      if (!target || target.type !== 'Identifier') return;
      if (!emptyObjModIds.has(target.name)) return;
      if (!exportsObj || exportsObj.type !== 'ObjectExpression') return;
      const modId = target.name;
      if (!moduleExports[modId]) moduleExports[modId] = {};
      for (const prop of exportsObj.properties) {
        if (prop.type !== 'ObjectProperty') continue;
        const propName = prop.key.name || prop.key.value;
        if (!propName) continue;
        // () => IDENT  →  record IDENT  (the common shape)
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
      // CC keeps adding new registration types as the agent surface grows,
      // and the same `{type, name, ...}` envelope is reused outside command
      // registrations too — for MCP transport descriptors, plugin lifecycle
      // objects, installation status emissions, message-stream payloads, etc.
      // To avoid silently dropping real commands or noisily warning on every
      // non-command object, we keep three sets:
      //
      //   KNOWN_TYPES         — explicit command-registration types
      //   KNOWN_TYPE_PATTERNS — versioned schema names (e.g., `advisor_<yyyymmdd>`)
      //   IGNORE_TYPES        — same envelope, not a command — skip silently
      //
      // Any value not in one of the three still falls through to a stderr
      // warning so the next regression (a genuinely new command-style type)
      // surfaces visibly instead of accumulating as silent "분석 누락".
      const KNOWN_TYPES = new Set([
        'local', 'local-jsx',         // original cmd / JSX cmd
        'prompt',                     // prompt-style commands (init, review, etc.)
        'tool',                       // tool-style commands (web_search, etc.)
        'callback', 'function',       // newer registration shapes
      ]);
      const KNOWN_TYPE_PATTERNS = [
        // Versioned schema names (advisor_20260301, web_search_20250305, …) —
        // CC stamps date suffixes on schema-bound command registrations so an
        // older client can refuse a newer envelope shape.
        /^[a-z][a-z0-9_]*_\d{8}$/,
      ];
      const IGNORE_TYPES = new Set([
        // MCP transport / server / resource — not command registrations
        'mcp', 'mcp_resource', 'mcp_resource_template', 'stdio',
        // Plugin lifecycle objects (registration listing UI, not commands)
        'plugin', 'failed-plugin', 'flagged-plugin',
        // SDK / state-flag wrappers around messages
        'sdk', 'disabled', 'pending',
        // Installation status objects
        'installing', 'installed', 'failed',
        // Message-stream payloads sharing the {type, name} envelope
        'tool_use', 'system',
        // AWS SDK endpoint param + similar config envelope (not a command)
        'builtInParams',
        // Branch descriptor in flow control objects (dynamic name, not cmd)
        'branch',
        // Agent / task envelope types — task type tags, not commands
        'local_workflow', 'remote_agent', 'in_process_teammate', 'dream',
        'local_agent', 'local_bash',
        // CommonJS module wrappers (e.g., `sharp` image lib)
        'commonjs',
      ]);
      // Dynamic-valued type — registration computed at runtime; skip silently.
      if (typeof typeVal !== 'string') return;
      // Resolve a static prefix if the name is a `+`-chained dynamic string
      // (currently the `mcp__`-prefixed MCP-prompt registrations). When found,
      // we keep going so the entry lands in `dynamicCommands` below.
      let dynamicNamePrefix = null;
      if (typeof nameVal !== 'string') {
        dynamicNamePrefix = getDynamicNamePrefix(nameNode);
        if (!dynamicNamePrefix) return; // truly dynamic, skip
      }
      // Namespaced types like `Certificate.TBSCertificate.extensions` or
      // `rsapss.hashAlgorithm` come from ASN.1/X.509 schema descriptors
      // bundled inside vendored dependencies — never a CC command.
      if (typeVal.includes('.')) return;
      if (IGNORE_TYPES.has(typeVal)) return;
      const isKnown =
        KNOWN_TYPES.has(typeVal) ||
        KNOWN_TYPE_PATTERNS.some((re) => re.test(typeVal));
      if (!isKnown) {
        process.stderr.write(`[unknown type] ${typeVal}:${nameVal ?? dynamicNamePrefix}\n`);
        return;
      }

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
        if (methodNode) {
          reg.handler_method = 'getPromptForCommand';
          // Byte range of the inline handler method itself. extractCommand's
          // path-3 fallback (when there's no module_id) uses this to BFS the
          // handler body so callGraph / telemetry / literals are not empty
          // for prompt-type commands.
          reg.handler_method_start = methodNode.start;
          reg.handler_method_end   = methodNode.end;
        }
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

          // Additional pattern: `load: () => Promise.resolve({call: IDENT})`
          // appears on 3 commands in v2.1.158 (bridge-kick, version, recap)
          // and uses no module_id — the call ident is inlined into the
          // Promise.resolve argument instead of going through a
          // moduleExports wrapper. Pull it out so path 2 / Arbor name
          // lookup can resolve the handler.
          if (firstCall &&
              firstCall.callee?.type === 'MemberExpression' &&
              firstCall.callee.object?.type === 'Identifier' &&
              firstCall.callee.object.name === 'Promise' &&
              firstCall.callee.property?.name === 'resolve' &&
              firstCall.arguments?.[0]?.type === 'ObjectExpression') {
            for (const p of firstCall.arguments[0].properties) {
              if (p.type === 'ObjectProperty' &&
                  (p.key?.name === 'call' || p.key?.value === 'call') &&
                  p.value?.type === 'Identifier') {
                reg.load_ident = p.value.name;
                break;
              }
            }
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

      if (dynamicNamePrefix) {
        // Index by the static prefix string itself ("mcp__"). First wins so
        // multiple registration sites for the same prefix don't multiply.
        reg.name = dynamicNamePrefix;
        reg.dynamic_name = true;
        if (!dynamicCommands[dynamicNamePrefix]) {
          dynamicCommands[dynamicNamePrefix] = reg;
        }
      } else if (!commands[nameVal]) {
        commands[nameVal] = reg;
      }
    },
  });

  const result = {
    version,
    built: new Date().toISOString().slice(0, 10),
    commands,
    dynamicCommands,
    moduleExports,
    functions,
    variables,
  };
  // Optional: enrich each command with Arbor's handler resolution
  // (`arbor_handler` field on the registration). Skipped silently when
  // ARBOR_BIN is not on this host. The marker is what analyze-command.md
  // teaches the LLM to read.
  enrichWithArborHandlers(result, src, version);
  return result;
}

/**
 * Run the Arbor handler-lookup PoC in-process and merge its per-command
 * result into `index.commands[name].arbor_handler`. Tolerant of every
 * failure mode — Arbor not installed, graph build fails, no bundle path
 * — so a host without Arbor still produces a usable index.
 */
function enrichWithArborHandlers(index, src, version) {
  // Bundle path: the caller (main) didn't pass it down; we recover it
  // from the same env extract-ast uses. Skip silently if unset.
  const bundlePath = process.env.CC_GNOTHI_BUNDLE_PATH;
  if (!bundlePath) return;
  let arbor;
  try { arbor = require('./arbor-handler-lookup'); }
  catch { return; }
  // Per-version graph cache under ~/.cc-gnothi/cache/. Avoids putting
  // `.arbor/` next to the bundles (where the 19 versions would share one
  // file) and keeps subsequent --build-index runs warm.
  const graphPath = path.join(
    os.homedir(), '.cc-gnothi', 'cache', `arbor-graph-${version}.json`
  );
  if (!arbor.ensureArborGraph(bundlePath, graphPath)) {
    process.stderr.write('arbor handler lookup skipped: arbor not available\n');
    return;
  }
  let payload;
  try {
    payload = arbor.resolveHandlers({
      bundle: bundlePath, version, graph: graphPath, index, src,
    });
  } catch (e) {
    process.stderr.write('arbor handler lookup failed: ' + e.message + '\n');
    return;
  }
  for (const r of payload.per_command) {
    const reg = index.commands[r.cmd];
    if (!reg) continue;
    reg.arbor_handler = {
      name:            r.handler.name,
      fqn:             r.handler.fqn,
      kind:            r.handler.kind,
      resolution_path: r.resolution_path,
      n_hits:          r.n_hits,
    };
  }
  process.stderr.write(
    `arbor handlers: ${payload.totals.handler_resolved}/${payload.totals.total} ` +
    `(direct ${payload.totals.direct_hit}, module_id ${payload.totals.via_module_id}, ` +
    `load_ident ${payload.totals.via_load_ident}) in ${payload.elapsed_s}s\n`
  );
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

  // Entry points: try three paths in order.
  //
  //   Path 1 — module_id → moduleExports → entry functions
  //   Path 2 — load_ident (inline `load:()=>Promise.resolve({call: IDENT})`,
  //            no module_id; PR #4)
  //   Path 3 — handler_method byte range (prompt-type commands carry an
  //            inline `async getPromptForCommand(){…}` and have no
  //            module_id at all). The method's own byte span is registered
  //            as a synthetic function and BFS'd from there.
  //
  // Without path 2/3 the prompt-type commands' callGraph / telemetry /
  // literals all came back empty, even though the handler is right there
  // in the registration object — the analyze step then had no behavioural
  // signals beyond the prompt body itself.
  const modId = reg.module_id;
  const entryFns = [];
  if (modId && index.moduleExports[modId]) {
    for (const [prop, fnId] of Object.entries(index.moduleExports[modId])) {
      if (index.functions[fnId]) entryFns.push({ fn: fnId, via: `module:${prop}` });
    }
  }
  if (entryFns.length === 0 && reg.load_ident && index.functions[reg.load_ident]) {
    entryFns.push({ fn: reg.load_ident, via: 'load_ident' });
  }
  if (
    entryFns.length === 0 &&
    Number.isInteger(reg.handler_method_start) &&
    Number.isInteger(reg.handler_method_end)
  ) {
    const synth = `__handler_${cmdName}`;
    // Add a temporary entry in `index.functions` so the existing bfs() can
    // pick it up by name. Idempotent — repeated --cmd calls reuse the slot.
    index.functions[synth] = {
      start: reg.handler_method_start,
      end:   reg.handler_method_end,
    };
    entryFns.push({ fn: synth, via: `handler_method:${reg.handler_method ?? 'inline'}` });
  }
  // Path 4 — Arbor-resolved handler. Covers tool / callback / function
  // shapes that have neither module_id nor load_ident nor inline method,
  // but Arbor's symbol-in-range did find their entry function. The
  // bundle-level function lookup still anchors the BFS in extract-ast's
  // Babel-parsed `functions` map; arbor_handler.name only tells us which
  // top-level function to start from.
  if (entryFns.length === 0 && reg.arbor_handler && index.functions[reg.arbor_handler.name]) {
    entryFns.push({
      fn: reg.arbor_handler.name,
      via: `arbor_handler:${reg.arbor_handler.resolution_path}`,
    });
  }

  if (entryFns.length === 0) {
    const reason = modId
      ? `module '${modId}' has no exports`
      : `no module_id / load_ident / handler_method / arbor_handler on registration`;
    result.note = `no entry functions found (${reason})`;
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
    // enrichWithArborHandlers picks the bundle path up from the env so we
    // don't have to thread it through buildIndex's signature (which is also
    // called by arbor-fallback.js with a different code path).
    process.env.CC_GNOTHI_BUNDLE_PATH = opts.bundle;
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
    // PR #1 follow-up: when the index was built via Arbor (because Babel
    // tripped on the bundle), propagate the marker so analyze-all.sh /
    // call-api.js can flag the resulting spec for reduced confidence.
    if (index._arbor_fallback) out._arbor_fallback = true;
    process.stdout.write(JSON.stringify(out, null, 2));
    return;
  }
}

main();
