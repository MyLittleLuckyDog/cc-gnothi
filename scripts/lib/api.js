/**
 * scripts/lib/api.js — Anthropic API helpers extracted from
 * `scripts/call-api.js` so callers (the cli wrapper, the new
 * `analyze-batch.js` driver, future MCP / sub-agent code) can share
 * one long-lived `Anthropic` client.
 *
 * Why share a client?  The gateway's per-request `inject_metadata()`
 * derives `metadata.user_id` from the session id; with a stable
 * `X-Session-Id` header that mapping is consistent, which is the
 * precondition for Anthropic's prompt cache returning the cached
 * prefix on subsequent calls. Spinning up a fresh node process per
 * command (the old `analyze-all.sh` pattern) fragments connections
 * and breaks the cache key continuity even with the right headers.
 *
 * Exports:
 *   makeClient(opts)       — construct an Anthropic client with
 *                            cache-friendly defaults
 *   buildCachedContent(p)  — split prompt at `## Source Data\n` into
 *                            cacheable prefix + per-call tail
 *   callApi(client, opts, prompt)
 *                          — single API call with rate-limit retry,
 *                            returns { text, usage }
 */

'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const GATEWAY_URL = process.env.CLAUDE_GATEWAY_URL ?? 'http://localhost:8765';
const DEFAULT_API_KEY = process.env.ANTHROPIC_API_KEY ?? 'gateway';
const DEFAULT_MODEL = process.env.CALL_API_MODEL ?? 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 16000;

const MAX_RATE_LIMIT_RETRIES = 8;
const RATE_LIMIT_BUFFER_MS = 5000;
const RATE_LIMIT_FALLBACK_MS = 60000;

function log(...args) {
  process.stderr.write('[api] ' + args.join(' ') + '\n');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resetsAtSleepMs(err) {
  const resetsAt =
    err?.headers?.['anthropic-ratelimit-unified-reset'] ??
    err?.headers?.['anthropic-ratelimit-unified-fivehour-reset'];
  if (!resetsAt) return null;
  const resetMs = parseInt(resetsAt, 10) * 1000;
  const now = Date.now();
  return Math.max(resetMs - now, 0) + RATE_LIMIT_BUFFER_MS;
}

/**
 * Construct an Anthropic client with the X-Session-Id header pinned
 * so the gateway can map the whole batch to the same
 * `metadata.user_id` and Anthropic's prompt cache stays hot.
 *
 * Override `sessionId` when wiring this into a longer-lived driver
 * that wants to scope cache to a particular workload (e.g. one id
 * per nightly run).
 */
function makeClient({
  baseURL = GATEWAY_URL,
  apiKey = DEFAULT_API_KEY,
  sessionId = `cc-gnothi-${DEFAULT_MODEL}`,
  extraHeaders = {},
} = {}) {
  return new Anthropic.default({
    baseURL,
    apiKey,
    defaultHeaders: {
      'x-session-id': sessionId,
      ...extraHeaders,
    },
  });
}

/**
 * Split a prompt into a cacheable prefix + a variable tail at the
 * ` ```json ` fence that opens the per-command JSON payload. The
 * `analyze-command.md` template (the entire instruction body, the
 * Source Data heading, the field-by-field guide) is identical
 * across all commands processed in one batch; only the JSON block
 * that follows changes per call.
 *
 * Splitting earlier (`## Source Data\n`) would leave a prefix of
 * ~100 tokens, below Anthropic's 1024-token minimum-cacheable-block
 * floor — cache_create stays 0 and the optimization is silently a
 * no-op. The fence puts ~12k tokens above the cache_control
 * marker, well over the minimum.
 *
 * Returns either a string (no fence found — send as-is) or a list
 * of content blocks. The SDK accepts both shapes for
 * `messages[0].content`.
 */
function buildCachedContent(prompt) {
  // The JSON block opens with a markdown fenced-code line. The
  // newline keeps us from matching `json` inside the template's
  // prose.
  const MARKER = '\n```json\n';
  const idx = prompt.indexOf(MARKER);
  if (idx < 0) {
    return prompt;
  }
  const prefix = prompt.slice(0, idx);  // template, ends without the fence
  const tail = prompt.slice(idx);        // starts with the fence, then JSON
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

/**
 * Single API call with rate-limit retry. Returns `{ text, usage }`
 * where `usage` is the Anthropic-shaped object with `input_tokens`,
 * `output_tokens`, and (when caching fires) `cache_creation_input_tokens`
 * + `cache_read_input_tokens`.
 *
 * Exits the process on auth (401) or budget-exhaustion (429 after
 * retries) so cli wrappers don't need to plumb error codes
 * themselves; long-lived drivers can wrap calls in try/catch around
 * `process.exit` if they want softer handling.
 */
async function callApi(client, opts, prompt) {
  const {
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
  } = opts ?? {};

  const content = buildCachedContent(prompt);
  let attempt = 0;

  while (attempt <= MAX_RATE_LIMIT_RETRIES) {
    attempt++;
    try {
      const msg = await client.messages.create({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content }],
      });

      const text = msg.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
      return { text, usage: msg.usage ?? {}, stopReason: msg.stop_reason };
    } catch (err) {
      const status = err.status;
      if (status === 429) {
        if (attempt > MAX_RATE_LIMIT_RETRIES) {
          log(`rate limit: max retries (${MAX_RATE_LIMIT_RETRIES}) exceeded`);
          throw err;
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
        throw err;
      }
      if (status === 529) {
        const sleepMs = 30000;
        log(`overloaded (529) attempt ${attempt} — sleeping ${sleepMs / 1000}s`);
        await sleep(sleepMs);
        continue;
      }
      // Unknown status — bubble up.
      throw err;
    }
  }

  throw new Error(`callApi: exhausted ${MAX_RATE_LIMIT_RETRIES} retries`);
}

module.exports = {
  makeClient,
  buildCachedContent,
  callApi,
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
  GATEWAY_URL,
};
