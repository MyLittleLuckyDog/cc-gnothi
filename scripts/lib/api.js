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

/** Marker drivers can drop into a prompt to mark the cache split. */
const CACHE_BREAKPOINT_MARKER = '<!-- CACHE_BREAKPOINT -->';

/**
 * Split a prompt into a cacheable prefix + a variable tail.
 *
 * Resolution order (first hit wins):
 *
 *   1. Explicit `<!-- CACHE_BREAKPOINT -->` marker the caller
 *      placed in the prompt. Used by analyze-batch.js so the
 *      driver can keep `{COMMAND}`/`{VERSION}` placeholders in
 *      the raw template (cacheable) and append the actual
 *      substitution values *after* the marker (per-call).
 *
 *   2. ` ```json\n` fence — fallback for legacy prompts that
 *      contain a fenced JSON tail. Keeps backward compat with
 *      pre-restructure analyze-all.sh callers.
 *
 *   3. No marker found → send prompt as a plain string (cache
 *      disabled). Returning a string is safe because the SDK
 *      accepts both shapes for `messages[0].content`.
 *
 * The 1024-token minimum-cacheable-block floor still applies;
 * callers are responsible for keeping enough content above the
 * marker.
 */
function buildCachedContent(prompt) {
  let idx = prompt.indexOf(CACHE_BREAKPOINT_MARKER);
  let prefixEnd;
  if (idx >= 0) {
    // Marker is informational; strip it so the model doesn't see
    // an HTML-comment-shaped instruction in the middle of the
    // prompt. Cache key is the prefix up to (not including) the
    // marker.
    prefixEnd = idx;
  } else {
    const fenceIdx = prompt.indexOf('\n```json\n');
    if (fenceIdx < 0) return prompt;
    prefixEnd = fenceIdx;
  }
  const prefix = prompt.slice(0, prefixEnd);
  const tail = idx >= 0
    // Skip the marker line + its trailing newline (if present).
    ? prompt.slice(idx + CACHE_BREAKPOINT_MARKER.length).replace(/^\n/, '')
    : prompt.slice(prefixEnd);
  if (!tail) {
    // Pure prefix, no per-call tail — degenerate but valid.
    return [{ type: 'text', text: prefix, cache_control: { type: 'ephemeral' } }];
  }
  return [
    { type: 'text', text: prefix, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: tail },
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
  CACHE_BREAKPOINT_MARKER,
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
  GATEWAY_URL,
};
