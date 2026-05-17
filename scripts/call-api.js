#!/usr/bin/env node
/**
 * call-api.js — send a prompt to the claude-gateway (or direct Anthropic API)
 *               and write the response text to stdout.
 *
 * Usage:
 *   node scripts/call-api.js --prompt-file <path> [--model <id>] [--max-tokens <n>]
 *
 * Environment:
 *   CLAUDE_GATEWAY_URL   Base URL for gateway   (default: http://localhost:8765)
 *   ANTHROPIC_API_KEY    API key if hitting API directly (default: "gateway")
 *   CALL_API_MODEL       Model override
 *
 * Stdout:  response text only
 * Stderr:  progress / usage / error logs
 *
 * Exit codes:
 *   0  success
 *   1  fatal error (auth, parse failure, etc.)
 *   2  rate limited and max retries exceeded
 */

'use strict';

const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

// ── Config ────────────────────────────────────────────────────────────────────

const GATEWAY_URL = process.env.CLAUDE_GATEWAY_URL ?? 'http://localhost:8765';
const API_KEY = process.env.ANTHROPIC_API_KEY ?? 'gateway';
const DEFAULT_MODEL = process.env.CALL_API_MODEL ?? 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 16000;

// Rate limit: max times we retry a 429 before giving up
const MAX_RATE_LIMIT_RETRIES = 8;
// Extra buffer added to resets_at sleep (ms)
const RATE_LIMIT_BUFFER_MS = 5000;
// Fallback sleep when resets_at is missing (ms)
const RATE_LIMIT_FALLBACK_MS = 60000;

// ── Args ──────────────────────────────────────────────────────────────────────

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

// ── Logging ───────────────────────────────────────────────────────────────────

function log(...args) {
  process.stderr.write('[call-api] ' + args.join(' ') + '\n');
}

// ── Sleep ─────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── API call with rate-limit retry ───────────────────────────────────────────

async function callWithRetry(client, opts, prompt) {
  let attempt = 0;

  while (attempt <= MAX_RATE_LIMIT_RETRIES) {
    attempt++;
    try {
      const msg = await client.messages.create({
        model: opts.model,
        max_tokens: opts.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });

      const usage = msg.usage ?? {};
      log(
        `usage: input=${usage.input_tokens ?? '?'} output=${usage.output_tokens ?? '?'}` +
        ` stop_reason=${msg.stop_reason}`
      );

      const text = msg.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
      return text;

    } catch (err) {
      const status = err.status;

      if (status === 429) {
        if (attempt > MAX_RATE_LIMIT_RETRIES) {
          log(`rate limit: max retries (${MAX_RATE_LIMIT_RETRIES}) exceeded`);
          process.exit(2);
        }

        const sleepMs = resetsAtSleepMs(err) ?? RATE_LIMIT_FALLBACK_MS;
        log(
          `rate limit (429) attempt ${attempt}/${MAX_RATE_LIMIT_RETRIES}` +
          ` — sleeping ${Math.round(sleepMs / 1000)}s`
        );
        await sleep(sleepMs);
        continue;
      }

      if (status === 401) {
        log(`auth error (401): check gateway OAuth / API key`);
        process.exit(1);
      }

      // 529 overloaded — gateway retries internally, but surface if it bubbles up
      if (status === 529) {
        const sleepMs = 30000;
        log(`overloaded (529) attempt ${attempt} — sleeping ${sleepMs / 1000}s`);
        await sleep(sleepMs);
        continue;
      }

      // Unknown error
      log(`unexpected error status=${status ?? 'none'}: ${err.message}`);
      process.exit(1);
    }
  }
}

// Extract sleep duration from a 429 error response.
// Gateway returns RateLimitStatus with resets_at (unix seconds).
function resetsAtSleepMs(err) {
  try {
    const body = err.error ?? err.body ?? {};
    // Try Anthropic native headers first
    const retryAfter = err.headers?.['retry-after'];
    if (retryAfter) {
      const secs = parseFloat(retryAfter);
      if (!isNaN(secs)) return Math.ceil(secs * 1000) + RATE_LIMIT_BUFFER_MS;
    }
    // Try gateway RateLimitStatus body
    const resetsAt = body?.rate_limit?.resets_at ?? body?.resets_at;
    if (resetsAt) {
      const nowMs = Date.now();
      const resetMs = resetsAt * 1000;
      const diff = resetMs - nowMs;
      if (diff > 0) return diff + RATE_LIMIT_BUFFER_MS;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  if (!opts.promptFile) {
    process.stderr.write('Usage: call-api.js --prompt-file <path>\n');
    process.exit(1);
  }

  if (!fs.existsSync(opts.promptFile)) {
    log(`prompt file not found: ${opts.promptFile}`);
    process.exit(1);
  }

  const prompt = fs.readFileSync(opts.promptFile, 'utf8');
  log(`model=${opts.model} max_tokens=${opts.maxTokens} prompt=${Math.round(prompt.length / 1024)}KB gateway=${GATEWAY_URL}`);

  const client = new Anthropic.default({
    baseURL: GATEWAY_URL,
    apiKey: API_KEY,
  });

  const text = await callWithRetry(client, opts, prompt);
  process.stdout.write(text);
}

main().catch((err) => {
  process.stderr.write(`[call-api] fatal: ${err.message}\n`);
  process.exit(1);
});
