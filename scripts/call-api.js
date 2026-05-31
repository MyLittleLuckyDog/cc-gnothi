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

/**
 * Split a single prompt string into a cacheable prefix and a variable
 * tail at a marker line.
 *
 * The analyze-command.md template puts the per-command JSON after the
 * "## Source Data" heading; everything above that line is identical
 * across all commands processed in a batch. Sending the prefix as a
 * cache_control-marked block lets Anthropic's 5-minute prompt cache
 * return it at ~10% input cost on subsequent calls (any other
 * analyze-all.sh invocation within the same window hits the cache for
 * the prefix and only pays full price for the per-command JSON tail).
 *
 * Returns either a string (no marker found, send as-is) or a list of
 * content blocks. The SDK accepts both shapes for `messages[0].content`.
 */
function buildCachedContent(prompt) {
  const MARKER = '\n## Source Data\n';
  const idx = prompt.indexOf(MARKER);
  if (idx < 0) {
    // Marker missing — older template, prompt isn't shaped for
    // prefix-caching. Fall back to a single content block.
    return prompt;
  }
  const prefix = prompt.slice(0, idx + MARKER.length);
  const tail = prompt.slice(idx + MARKER.length);
  return [
    {
      type: 'text',
      text: prefix,
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: tail,
    },
  ];
}

async function callWithRetry(client, opts, prompt) {
  let attempt = 0;
  const content = buildCachedContent(prompt);

  while (attempt <= MAX_RATE_LIMIT_RETRIES) {
    attempt++;
    try {
      const msg = await client.messages.create({
        model: opts.model,
        max_tokens: opts.maxTokens,
        messages: [{ role: 'user', content }],
      });

      const usage = msg.usage ?? {};
      const cacheCreate = usage.cache_creation_input_tokens ?? 0;
      const cacheRead = usage.cache_read_input_tokens ?? 0;
      const cacheNote = cacheCreate || cacheRead
        ? ` cache_create=${cacheCreate} cache_read=${cacheRead}`
        : '';
      log(
        `usage: input=${usage.input_tokens ?? '?'} output=${usage.output_tokens ?? '?'}` +
        cacheNote +
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

  // Stable session id keeps the gateway's `inject_metadata` from
  // producing a fresh `metadata.user_id` per request, which lets
  // Anthropic's prompt cache return the cached prefix on subsequent
  // calls across process boundaries (analyze-all.sh launches a fresh
  // node process per command). Honor an env override so callers can
  // pin a single session across a batch when wired into a longer-lived
  // driver script.
  const sessionId = process.env.CC_GNOTHI_SESSION_ID ?? `cc-gnothi-${opts.model}`;
  const client = new Anthropic.default({
    baseURL: GATEWAY_URL,
    apiKey: API_KEY,
    defaultHeaders: { 'x-session-id': sessionId },
  });

  const text = await callWithRetry(client, opts, prompt);
  process.stdout.write(text);
}

main().catch((err) => {
  process.stderr.write(`[call-api] fatal: ${err.message}\n`);
  process.exit(1);
});
