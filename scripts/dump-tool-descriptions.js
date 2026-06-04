#!/usr/bin/env node
/**
 * dump-tool-descriptions.js — B 단계
 *
 * tools-{VERSION}.json 카탈로그를 읽어 각 도구의 description_fn / prompt_fn 에서:
 *   1. Babel 파싱으로 template literal / string literal 추출 (실제 설명 텍스트)
 *   2. arbor context --fqn 으로 callee 구조 추출
 * 결과를 tool-descriptions-{VERSION}.json 으로 저장.
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync } = require('child_process');
const parser = require('@babel/parser');

// ── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let version = null, bundlePath = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--version') version  = args[++i];
  if (args[i] === '--bundle')  bundlePath = args[++i];
}
if (!version || !bundlePath) {
  console.error('Usage: dump-tool-descriptions.js --bundle <path> --version <ver>');
  process.exit(1);
}

const CACHE_DIR  = path.join(os.homedir(), '.cc-gnothi', 'cache');
const TOOLS_PATH = path.join(CACHE_DIR, `tools-${version}.json`);
const INDEX_PATH = path.join(CACHE_DIR, `index-${version}.json`);
const GRAPH_PATH = path.join(CACHE_DIR, `arbor-graph-${version}.json`);

if (!fs.existsSync(TOOLS_PATH)) { console.error(`Not found: ${TOOLS_PATH}`); process.exit(1); }
if (!fs.existsSync(INDEX_PATH)) { console.error(`Not found: ${INDEX_PATH}`); process.exit(1); }

const toolCatalog = JSON.parse(fs.readFileSync(TOOLS_PATH, 'utf8'));
const index       = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
const src         = fs.readFileSync(bundlePath, 'utf8');
const bundleDir   = path.dirname(path.resolve(bundlePath));

// ── AST 유틸 ─────────────────────────────────────────────────────────────────
function walk(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (node.type && visitor[node.type]) visitor[node.type](node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'extra') continue;
    const val = node[key];
    if (Array.isArray(val)) val.forEach(c => walk(c, visitor));
    else if (val && typeof val === 'object' && val.type) walk(val, visitor);
  }
}

function cookedTemplate(node) {
  const parts = node.quasis.map(q => q.value.cooked ?? q.value.raw ?? '');
  if (node.expressions.length === 0) return parts.join('');
  return parts.join(' {…} ');
}

// ── 함수 슬라이스에서 strings 추출 ────────────────────────────────────────────
function extractStringsFromFn(fnName) {
  const loc = index.functions[fnName];
  if (!loc) return { error: `'${fnName}' not in index`, strings: [], numbers: [] };

  const slice = src.slice(loc.start, loc.end);
  let ast;
  try {
    ast = parser.parse(slice, { sourceType: 'script', errorRecovery: true, strictMode: false });
  } catch(e) {
    return { error: `parse error: ${e.message}`, strings: [], numbers: [] };
  }

  const strings = [], numbers = [];
  const NOISE = new Set(['true','false','','null','undefined']);

  walk(ast, {
    TemplateLiteral(node) {
      const text = cookedTemplate(node);
      if (text.length >= 20) {
        strings.push({ value: text, byte_offset: loc.start + node.start, kind: 'template' });
      }
    },
    StringLiteral(node) {
      const v = node.value;
      if (v && v.length >= 4 && !NOISE.has(v)) {
        strings.push({ value: v, byte_offset: loc.start + node.start, kind: 'string' });
      }
    },
    NumericLiteral(node) {
      numbers.push({ value: node.value, byte_offset: loc.start + node.start });
    },
  });

  return {
    fn_name:    fnName,
    byte_start: loc.start,
    byte_end:   loc.end,
    length:     loc.end - loc.start,
    strings:    strings.sort((a,b) => b.value.length - a.value.length),  // longest first
    numbers,
  };
}

// ── arbor context 호출 ────────────────────────────────────────────────────────
function getArborContext(fnName) {
  if (!fs.existsSync(GRAPH_PATH)) return null;
  try {
    return execSync(
      `arbor context --fqn "claude-${version}::${fnName}" ` +
      `--path "${bundleDir}" --graph "${GRAPH_PATH}" --depth 1 --output json`,
      { timeout: 10000 }
    ).toString();
  } catch(e) {
    return null;
  }
}

// ── 메인 처리 ─────────────────────────────────────────────────────────────────
const results = {};
const tools   = toolCatalog.tools;
let processed = 0;

for (const [toolName, meta] of Object.entries(tools)) {
  const targetFn = meta.description_fn || meta.prompt_fn;
  if (!targetFn) {
    results[toolName] = { name: toolName, hint: meta.hint, note: 'no description_fn or prompt_fn' };
    continue;
  }

  process.stderr.write(`[${toolName}] fn=${targetFn} ...\n`);

  const strings = extractStringsFromFn(targetFn);

  // arbor context (선택적 — 느릴 수 있음)
  let arborCtx = null;
  if (fs.existsSync(GRAPH_PATH)) {
    const raw = getArborContext(targetFn);
    if (raw) {
      try { arborCtx = JSON.parse(raw); } catch { arborCtx = null; }
    }
  }

  results[toolName] = {
    name:    toolName,
    hint:    meta.hint,
    fn:      targetFn,
    fn_type: meta.description_fn ? 'description_fn' : 'prompt_fn',
    byte_start: strings.byte_start,
    byte_end:   strings.byte_end,
    fn_length:  strings.length,
    // 가장 긴 string이 보통 설명 본문
    description_candidate: strings.strings[0] || null,
    all_strings:  strings.strings,
    all_numbers:  strings.numbers,
    arbor_callees: arborCtx?.reachable_callees || [],
    error: strings.error || null,
  };
  processed++;
}

const output = {
  version,
  extracted: new Date().toISOString().slice(0, 10),
  bundle:    bundlePath,
  tools_with_fn: processed,
  tools:     results,
};

const outPath = path.join(CACHE_DIR, `tool-descriptions-${version}.json`);
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
process.stderr.write(`\n완료: ${outPath} (${processed}개 도구 설명 추출)\n`);
console.log(JSON.stringify({ written: outPath, tools_with_fn: processed }));
