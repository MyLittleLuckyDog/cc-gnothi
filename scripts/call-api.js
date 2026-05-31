#!/usr/bin/env node
/**
 * call-api.js — thin cli wrapper around scripts/lib/api.js.
 *
 * Send a prompt (file or stdin) to claude-gateway (or direct
 * Anthropic API) and write the response text to stdout.
 *
 * Usage:
 *   node scripts/call-api.js --prompt-file <path> [--model <id>] [--max-tokens <n>]
 *
 * Environment:
 *   CLAUDE_GATEWAY_URL      Base URL for gateway   (default: http://localhost:8765)
 *   ANTHROPIC_API_KEY       API key if hitting API directly (default: "gateway")
 *   CALL_API_MODEL          Model override
 *   CC_GNOTHI_SESSION_ID    Stable session id for prompt-cache continuity
 *
 * Stdout:  response text only
 * Stderr:  progress / usage / error logs
 *
 * Exit codes:
 *   0  success
 *   1  fatal error (auth, parse failure, etc.)
 *   2  rate limited and max retries exceeded
 *
 * Backward-compat: identical cli surface to the pre-library version
 * so existing analyze-all.sh callers keep working unchanged. Batch
 * workloads should use scripts/analyze-batch.js instead so they share
 * one Anthropic client (and one cache window).
 */

'use strict';

const fs = require('fs');
const {
  makeClient,
  callApi,
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
  GATEWAY_URL,
} = require('./lib/api');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    promptFile: null,
    model: DEFAULT_MODEL,
    maxTokens: DEFAULT_MAX_TOKENS,
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--prompt-file': opts.promptFile = args[++i]; break;
      case '--model':       opts.model = args[++i]; break;
      case '--max-tokens':  opts.maxTokens = parseInt(args[++i], 10); break;
    }
  }
  return opts;
}

function log(...args) {
  process.stderr.write('[call-api] ' + args.join(' ') + '\n');
}

async function main() {
  const opts = parseArgs();
  if (!opts.promptFile) {
    log('usage: call-api.js --prompt-file <path> [--model <id>] [--max-tokens <n>]');
    process.exit(1);
  }

  const prompt = fs.readFileSync(opts.promptFile, 'utf8');
  log(`model=${opts.model} max_tokens=${opts.maxTokens} prompt=${Math.round(prompt.length / 1024)}KB gateway=${GATEWAY_URL}`);

  const sessionId = process.env.CC_GNOTHI_SESSION_ID ?? `cc-gnothi-${opts.model}`;
  const client = makeClient({ sessionId });

  try {
    const { text, usage, stopReason } = await callApi(client, opts, prompt);
    const cacheCreate = usage.cache_creation_input_tokens ?? 0;
    const cacheRead = usage.cache_read_input_tokens ?? 0;
    const cacheNote = cacheCreate || cacheRead
      ? ` cache_create=${cacheCreate} cache_read=${cacheRead}`
      : '';
    log(
      `usage: input=${usage.input_tokens ?? '?'} output=${usage.output_tokens ?? '?'}` +
      cacheNote +
      ` stop_reason=${stopReason}`
    );
    process.stdout.write(text);
  } catch (err) {
    if (err.status === 429) {
      log('rate limit exhausted');
      process.exit(2);
    }
    log(`fatal: ${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`[call-api] fatal: ${err.message}\n`);
  process.exit(1);
});
