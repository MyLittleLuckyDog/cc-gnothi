#!/usr/bin/env node
/**
 * inject-spec-fields.js — backfill PR #3/#4 + Arbor fields into spec .md
 *
 * The analyze-command.md prompt template tags every new field as
 * `(optional)`, and LLMs reliably read that as "skip unless useful." So
 * across the v2.1.132 baseline only `init.md` carried the new rows; the
 * other 95 specs went out without any of them.
 *
 * Rather than re-running 96+ analyses (3 h, claude-gateway tokens) just
 * to get a few rows in, this script reads the cached index and appends
 * the missing rows directly to each spec's Registration table.
 * Idempotent — running it a second time is a no-op.
 *
 * Fields injected when present on the registration:
 *   loc_byte_end, handler_method, handler_method_start/end, load_ident,
 *   prompt_body.length, prompt_body.trace, dynamic_name,
 *   arbor_handler.{name, kind, fqn, resolution_path, n_hits}
 *
 * Usage:
 *   node scripts/inject-spec-fields.js --version 2.1.132 [--dir <path>]
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

function parseArgs() {
  const a = process.argv.slice(2);
  const opts = { version: null, dir: null };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--version') opts.version = a[++i];
    else if (a[i] === '--dir') opts.dir = a[++i];
  }
  return opts;
}

/** Find the Registration section's table boundaries inside `text`. */
function findRegistrationTable(text) {
  const headerIdx = text.indexOf('\n## Registration');
  if (headerIdx < 0) return null;
  const afterHeader = headerIdx + 1;
  const nextSectionMatch = text.slice(afterHeader + 1).search(/\n## /);
  const sectionEnd =
    nextSectionMatch < 0 ? text.length : afterHeader + 1 + nextSectionMatch;
  const section = text.slice(afterHeader, sectionEnd);
  const lines   = section.split('\n');
  // Table lines start with `|`. We accept either pipe-pipe or pipe-...-pipe.
  let tStart = -1, tEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trimEnd();
    if (l.startsWith('|') && l.endsWith('|')) {
      if (tStart < 0) tStart = i;
      tEnd = i;
    } else if (tStart >= 0 && tEnd === i - 1) {
      break;
    }
  }
  if (tStart < 0) return null;
  return { sectionStart: afterHeader, sectionEnd, tStart, tEnd, lines };
}

/**
 * Inject any missing PR #3/#4/Arbor fields into the registration table.
 * Returns `{text, added}` — `text` is the (possibly) modified document,
 * `added` is how many rows were appended.
 */
function injectRows(text, reg) {
  const found = findRegistrationTable(text);
  if (!found) return { text, added: 0, reason: 'no Registration table' };

  const { sectionStart, sectionEnd, tStart, tEnd, lines } = found;
  const tableText = lines.slice(tStart, tEnd + 1).join('\n').toLowerCase();

  const newRows = [];
  const seen    = new Set();
  const add = (key, value) => {
    if (value == null || value === '') return;
    if (seen.has(key)) return;
    seen.add(key);
    // Idempotency: skip if a row with this key name already exists,
    // however the LLM happened to format it (backticks optional).
    const k = key.toLowerCase();
    if (
      tableText.includes(`| \`${k}\` |`) ||
      tableText.includes(`| ${k} |`)
    ) return;
    newRows.push(`| \`${key}\` | ${value} |`);
  };

  const truncate = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);

  if (Number.isInteger(reg.loc_byte_end)) {
    add('loc_byte_end', `\`${reg.loc_byte_end}\``);
  }
  if (reg.handler_method) {
    add('handler_method', `\`${reg.handler_method}\` (inline ObjectMethod)`);
  }
  if (Number.isInteger(reg.handler_method_start)) {
    add('handler_method_start', `\`${reg.handler_method_start}\``);
  }
  if (Number.isInteger(reg.handler_method_end)) {
    add('handler_method_end', `\`${reg.handler_method_end}\``);
  }
  if (reg.load_ident) {
    add('load_ident', `\`${reg.load_ident}\``);
  }
  if (reg.prompt_body) {
    if (reg.prompt_body.length) {
      add('prompt_body.length', `\`${reg.prompt_body.length}\` chars`);
    }
    if (reg.prompt_body.trace) {
      add('prompt_body.trace', `\`${truncate(reg.prompt_body.trace, 100)}\``);
    }
  }
  if (reg.dynamic_name) {
    add('dynamic_name', '`true` (prefix-class registration)');
  }
  if (reg.arbor_handler) {
    const ah = reg.arbor_handler;
    if (ah.name) add('arbor_handler.name', `\`${ah.name}\``);
    if (ah.kind) add('arbor_handler.kind', `\`${ah.kind}\``);
    if (ah.resolution_path) add('arbor_handler.resolution_path', `\`${ah.resolution_path}\``);
    if (ah.fqn) add('arbor_handler.fqn', `\`${ah.fqn}\``);
    if (Number.isInteger(ah.n_hits)) add('arbor_handler.n_hits', `\`${ah.n_hits}\``);
  }

  if (newRows.length === 0) {
    return { text, added: 0, reason: 'already up to date' };
  }

  const newLines = [...lines];
  newLines.splice(tEnd + 1, 0, ...newRows);
  const newSection = newLines.join('\n');
  const newText = text.slice(0, sectionStart) + newSection + text.slice(sectionEnd);
  return { text: newText, added: newRows.length };
}

function processVersion(ver, dir) {
  const indexPath = path.join(os.homedir(), '.cc-gnothi/cache', `index-${ver}.json`);
  if (!fs.existsSync(indexPath)) {
    console.error(`index not found: ${indexPath}`);
    process.exit(1);
  }
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  const repoRoot = path.resolve(__dirname, '..');
  const verDir = dir || path.join(repoRoot, 'versions', `v${ver}`);
  if (!fs.existsSync(verDir)) {
    console.error(`version dir not found: ${verDir}`);
    process.exit(1);
  }

  let modified = 0, idempotent = 0, missingTable = 0, notInIndex = 0;
  let totalRows = 0;
  const files = fs.readdirSync(verDir).filter(f => f.endsWith('.md') && !f.startsWith('_'));
  for (const f of files) {
    const cmd = f.replace(/\.md$/, '');
    const reg = index.commands[cmd] || (index.dynamicCommands || {})[cmd];
    if (!reg) { notInIndex++; continue; }
    const filePath = path.join(verDir, f);
    const text = fs.readFileSync(filePath, 'utf8');
    const r = injectRows(text, reg);
    if (r.added > 0) {
      fs.writeFileSync(filePath, r.text);
      modified++;
      totalRows += r.added;
    } else if (r.reason === 'no Registration table') {
      missingTable++;
    } else {
      idempotent++;
    }
  }
  console.log(
    `v${ver}: modified=${modified} (${totalRows} rows total)` +
    ` idempotent=${idempotent} missing_table=${missingTable}` +
    ` not_in_index=${notInIndex}`
  );
}

const opts = parseArgs();
if (!opts.version) {
  console.error('Usage: inject-spec-fields.js --version <ver> [--dir <dir>]');
  process.exit(1);
}
processVersion(opts.version, opts.dir);
