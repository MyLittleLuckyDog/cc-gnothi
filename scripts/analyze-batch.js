#!/usr/bin/env node
/**
 * analyze-batch.js — generate feature-specs for N commands in a
 * single long-lived node process, reusing one Anthropic client.
 *
 * Why this exists: `analyze-all.sh` shells out one
 * `node call-api.js` per command, which means N new node processes,
 * N new TCP connections, and N new gateway sessions. Each fresh
 * session breaks Anthropic's prompt-cache key, so 99% of every
 * prompt's 12+k template tokens get re-billed every call.
 *
 * This driver reuses one `Anthropic` client across the batch.
 * The X-Session-Id header is pinned at client construction (per
 * scripts/lib/api.js::makeClient), so the gateway maps every call
 * to the same `metadata.user_id` and the cache stays hot. The
 * extract-ast `--cmd` step still shells out per command (cheap;
 * runs locally; no API tokens involved).
 *
 * Usage:
 *   node scripts/analyze-batch.js \
 *       --bundle <path/to/claude-X.Y.Z.js> \
 *       --version X.Y.Z \
 *       --out-dir versions/vX.Y.Z \
 *       [--commands cmd1,cmd2,...]   # default: all commands in the bundle
 *       [--max-tokens N]             # default: 16000
 *       [--prompt-template path]     # default: scripts/prompts/analyze-command.md
 *       [--depth N]                  # default: 2 (passed to extract-ast --cmd)
 *
 * Environment:
 *   CC_GNOTHI_SESSION_ID — override the pinned X-Session-Id
 *                          (default: `cc-gnothi-batch-${version}`)
 *
 * Exit codes:
 *   0  all commands succeeded
 *   1  fatal error (template missing, bundle missing, auth, …)
 *   2  one or more per-command failures (the summary line names them)
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  makeClient,
  callApi,
  CACHE_BREAKPOINT_MARKER,
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
} = require('./lib/api');

const SCRIPT_DIR = path.dirname(__filename);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_PROMPT = path.join(SCRIPT_DIR, 'prompts', 'analyze-command.md');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    bundle: null,
    version: null,
    outDir: null,
    commands: null,
    model: DEFAULT_MODEL,
    maxTokens: DEFAULT_MAX_TOKENS,
    promptTemplate: DEFAULT_PROMPT,
    depth: 2,
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--bundle':         opts.bundle = args[++i]; break;
      case '--version':        opts.version = args[++i]; break;
      case '--out-dir':        opts.outDir = args[++i]; break;
      case '--commands':       opts.commands = args[++i].split(',').map((s) => s.trim()).filter(Boolean); break;
      case '--model':          opts.model = args[++i]; break;
      case '--max-tokens':     opts.maxTokens = parseInt(args[++i], 10); break;
      case '--prompt-template': opts.promptTemplate = args[++i]; break;
      case '--depth':          opts.depth = parseInt(args[++i], 10); break;
      default:
        process.stderr.write(`unknown arg: ${args[i]}\n`);
        process.exit(1);
    }
  }
  return opts;
}

function log(...a) {
  process.stderr.write('[batch] ' + a.join(' ') + '\n');
}

function listCommandsFromIndex(indexPath) {
  if (!fs.existsSync(indexPath)) return [];
  const idx = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  return Object.keys(idx.commands ?? {});
}

function extractCmdJson(opts, cmd) {
  // Cheap local subprocess; no API tokens involved. Returns stdout
  // as a JSON string.
  return execFileSync(
    'node',
    [
      path.join(SCRIPT_DIR, 'extract-ast.js'),
      '--cmd', cmd,
      '--bundle', opts.bundle,
      '--version', opts.version,
      '--depth', String(opts.depth),
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
}

function buildPrompt(template, opts, cmd, cmdJson) {
  // Keep the template raw — `{COMMAND}` / `{VERSION}` placeholders
  // stay in the cached prefix. The per-call substitution values
  // and the JSON go below the cache breakpoint. Anthropic caches
  // by content hash; sharing the raw template across all commands
  // in a batch lets the 2nd call onward hit `cache_read`.
  //
  // The substitution block tells the model what to plug in for
  // each placeholder — a one-shot in-prompt mapping table is
  // sufficient for the analyze-command.md surface.
  const substitutions =
    `Per-call substitutions for the template's placeholders:\n` +
    `  - {COMMAND} → ${cmd}\n` +
    `  - {VERSION} → ${opts.version}\n` +
    `Apply these substitutions wherever the corresponding placeholder appears in the template above, including inside the YAML frontmatter you emit.\n`;
  return [
    template,
    CACHE_BREAKPOINT_MARKER,
    substitutions,
    '```json',
    cmdJson,
    '```',
    '',
  ].join('\n');
}

async function main() {
  const opts = parseArgs();
  for (const k of ['bundle', 'version', 'outDir']) {
    if (!opts[k]) {
      log(`missing required --${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}`);
      process.exit(1);
    }
  }
  if (!fs.existsSync(opts.bundle)) {
    log(`bundle not found: ${opts.bundle}`);
    process.exit(1);
  }
  if (!fs.existsSync(opts.promptTemplate)) {
    log(`prompt template not found: ${opts.promptTemplate}`);
    process.exit(1);
  }
  if (!fs.existsSync(opts.outDir)) {
    fs.mkdirSync(opts.outDir, { recursive: true });
  }

  // Default command list: pull from the build-index cache.
  let commands = opts.commands;
  if (!commands) {
    const indexPath = path.join(os.homedir(), '.cc-gnothi', 'cache', `index-${opts.version}.json`);
    commands = listCommandsFromIndex(indexPath);
    if (commands.length === 0) {
      log(`no commands in index (${indexPath}). Run extract-ast.js --build-index first, or pass --commands.`);
      process.exit(1);
    }
  }

  const sessionId =
    process.env.CC_GNOTHI_SESSION_ID ?? `cc-gnothi-batch-${opts.version}`;
  const client = makeClient({ sessionId });
  const template = fs.readFileSync(opts.promptTemplate, 'utf8');

  log(`model=${opts.model} session=${sessionId} commands=${commands.length} out=${opts.outDir}`);

  const failures = [];
  const stats = {
    totalCacheCreate: 0,
    totalCacheRead: 0,
    totalInput: 0,
    totalOutput: 0,
  };
  const t0 = Date.now();

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const tag = `[${i + 1}/${commands.length} ${cmd}]`;
    try {
      const cmdJson = extractCmdJson(opts, cmd);
      const prompt = buildPrompt(template, opts, cmd, cmdJson);
      const { text, usage, stopReason } = await callApi(client, opts, prompt);

      const cacheCreate = usage.cache_creation_input_tokens ?? 0;
      const cacheRead = usage.cache_read_input_tokens ?? 0;
      stats.totalCacheCreate += cacheCreate;
      stats.totalCacheRead += cacheRead;
      stats.totalInput += usage.input_tokens ?? 0;
      stats.totalOutput += usage.output_tokens ?? 0;

      const outPath = path.join(opts.outDir, `${cmd}.md`);
      fs.writeFileSync(outPath, text);
      log(
        `${tag} ok ` +
        `cache_create=${cacheCreate} cache_read=${cacheRead} ` +
        `input=${usage.input_tokens ?? '?'} output=${usage.output_tokens ?? '?'} ` +
        `stop=${stopReason} → ${outPath}`
      );
    } catch (err) {
      log(`${tag} FAIL: ${err.message}`);
      failures.push(cmd);
    }
  }

  const wall = ((Date.now() - t0) / 1000).toFixed(1);
  log('──');
  log(`done in ${wall}s   ok=${commands.length - failures.length}/${commands.length}   failures=${failures.length}`);
  log(`cache_create=${stats.totalCacheCreate}  cache_read=${stats.totalCacheRead}  ` +
      `uncached_input=${stats.totalInput}  output=${stats.totalOutput}`);
  const cacheable = stats.totalCacheCreate + stats.totalCacheRead;
  if (cacheable > 0) {
    const ratio = (stats.totalCacheRead / cacheable * 100).toFixed(1);
    log(`cache hit ratio (read / cacheable): ${ratio}%`);
  }
  if (failures.length) {
    log(`failed commands: ${failures.join(', ')}`);
    process.exit(2);
  }
}

main().catch((err) => {
  process.stderr.write(`[batch] fatal: ${err.message}\n${err.stack}\n`);
  process.exit(1);
});
