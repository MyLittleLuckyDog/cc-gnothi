---
type: feature-spec
feature: "btw"
cc_version: "2.1.163"
updated: "2026-06-05"
tags: ["btw", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.163 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/btw`

> Analysis basis: CC v2.1.163 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.163

---

## Overview

`/btw` ("by the way") is a lightweight side-question mechanism that lets the user inject a quick, out-of-band query into Claude Code without disrupting the primary task context. It dispatches immediately as a `control-request` to the thin-client layer, runs through the standard API bootstrap path, and renders its response as a local JSX component — keeping the main conversation thread intact.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `btw` |
| description | `Ask a quick side question without interrupting the main conversation` |
| argumentHint | `<question>` |
| immediate | `true` |
| thinClientDispatch | `control-request` |
| module_id | `uxq` |
| load_inline | `true` |
| loc_byte | `10950349` |
| loc_byte_end | `10950588` |
| loc_line | `7270` |
| arbor_handler.name | `jzf` |
| arbor_handler.fqn | `claude-2.1.163::jzf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.163 bundle.js:+10950349

---

## Input Branching

The handler has 3+ distinct branches (argument validation guard, API bootstrap dispatch, and JSX rendering path), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A([User types /btw <question>]) --> B{Argument present?}
    B -- No / empty --> C[Emit usage error\n'Usage: /btw <your question>'\nbundle.js:+10949942]
    B -- Yes --> D[Invoke API bootstrap handler\nbundle.js:+10950004]
    D --> E[Build control-request payload\nattach 'system' role context\nbundle.js:+10949981]
    E --> F[Dispatch via thinClientDispatch\n= 'control-request']
    F --> G{Bootstrap fetch result}
    G -- Fetch OK --> H[Log '[Bootstrap] Fetch ok'\nbundle.js:+15724592]
    H --> I[Render JSX response component\nbundle.js:+10950050]
    G -- Parse failure --> J[Emit 'parse_failed' event\nbundle.js:+15724562]
    J --> K[Render error state JSX]
    G -- Network / timeout --> L[Retry / surface error\ntimeout threshold: 5000 ms\nbundle.js:+15724419]
    L --> K
```

---

## Behavioral Spec

### 1. Argument Validation

When the user invokes `/btw` without a trailing question, the handler short-circuits immediately and displays a usage hint.

```
function handleBtw(rawInput):
    trimmedInput = rawInput.trim()
    if trimmedInput is empty:
        return renderUsageError("Usage: /btw <your question>")
    proceed to bootstrapAndDispatch(trimmedInput)
```

Analysis basis: CC v2.1.163 bundle.js:+10949942

---

### 2. API Bootstrap Fetch

The handler calls the bootstrap fetcher (`jzf` → `H`) to obtain the API endpoint details before dispatching the side question.

```
async function bootstrapFetcher(context):
    log("[Bootstrap] Fetching")                      // bundle.js:+15724218
    response = await fetch(endpoint, {
        headers: {
            "Content-Type": "application/json",      // bundle.js:+15724303 / +15724318
            "User-Agent":   <agentString>            // bundle.js:+15724337
        },
        timeout: 5000                                // bundle.js:+15724419
    })
    if parse error:
        emit telemetry("api_bootstrap_fetch", "parse_failed")  // bundle.js:+15724540 / +15724562
        return errorState
    log("[Bootstrap] Fetch ok")                      // bundle.js:+15724592
    return parsedPayload
```

Analysis basis: CC v2.1.163 bundle.js:+15724216

---

### 3. Message Construction and Dispatch

After bootstrap succeeds, the handler builds a control-request payload, wrapping the user's question with a `"system"` role marker.

```
function buildControlRequest(question):
    payload = {
        role: "system",                              // bundle.js:+10949981
        content: question,
        requestType: "control-request"               // registration: thinClientDispatch
    }
    return payload
```

The `immediate: true` flag in the registration means this payload bypasses any queued conversation turns and is routed directly to the thin-client control path.

Analysis basis: CC v2.1.163 bundle.js:+10950349

---

### 4. Context and Tool-Call Processing

The dispatch path invokes several downstream utilities (reachable via `H` → `v`) for:

- **Context sanitization**: sensitive fields replaced with `"[REDACTED]"` (bundle.js:+198141), limited to 2 items (bundle.js:+198170).
- **Model routing**: resolves model aliases such as `"opusplan"`, `"sonnet"`, `"haiku"`, `"opus"`, `"best"` to canonical identifiers (bundle.js:+2243249–2243405).
- **Provider classification**: distinguishes `"firstParty"`, `"anthropicAws"`, `"gateway"`, `"mantle"` provider types (bundle.js:+2239457, +2097366, +2097386, +2240098).
- **Conversation-thread building**: the utility `t1`/`messageBuilder` trims whitespace, normalises Unicode (NFC, bundle.js:+13958248), and computes insertion positions using `"INSERT"` markers (bundle.js:+13958528).

```
function buildMessageThread(rawMessages):
    for each message in rawMessages:
        message.content = normalizeUnicode(message.content, "NFC")
        message.content = sanitizeRedacted(message.content)
    return thread
```

Analysis basis: CC v2.1.163 bundle.js:+206051, +206093

---

### 5. Transcript / Log Persistence

During dispatch, the logging subsystem (`icK` → file-append path) performs:

1. Resolve transcript directory via `path.dirname` (bundle.js:+205596).
2. Ensure the directory exists via `mkdir` (bundle.js:+205317).
3. Append the new entry with `appendFile` (bundle.js:+205376).
4. If the file ends with `".txt"` (bundle.js:+205021), rotate: rename existing file, unlink the old path (bundle.js:+205073, +205113).
5. Check `Buffer.byteLength` against an internal threshold (bundle.js:+205771) before writing to avoid oversized entries.
6. On successful write, invoke the hook-registration utility `j9` → `MXA.register` (bundle.js:+60323).

```
async function persistTranscriptEntry(entry, transcriptDir):
    dir = path.dirname(transcriptDir)
    await fs.mkdir(dir, { recursive: true })
    if currentFile.endsWith(".txt"):
        await rotateFile(currentFile)
    if Buffer.byteLength(entry) <= limit:
        await fs.appendFile(transcriptPath, entry)
        registerHook()
```

Analysis basis: CC v2.1.163 bundle.js:+205563, +205588

---

### 6. Config Lock Management

The save-config path (`SX_`, reached via `X8`) uses a file-lock protocol to guard `~/.claude.json` from concurrent writes:

- Lock acquisition timeout: **60 000 ms** (bundle.js:+3260588).
- If lock contention is detected, emits `tengu_config_lock_contention` and logs a warning (bundle.js:+3259818).
- Refuses to overwrite if the re-read config is missing auth that the cache holds, logging a `saveConfigWithLock` guard message (bundle.js:+3260234) and emitting `tengu_config_auth_loss_prevented`.
- On parse error during re-read, emits `tengu_config_parse_error` (bundle.js:+3262482).
- Backup files use the `".backup."` infix pattern (bundle.js:+3260704), retaining up to **5** backups (bundle.js:+3260837) with permissions mode `0o600` (decimal 384, bundle.js:+3261119).

Analysis basis: CC v2.1.163 bundle.js:+3259775, +3260043

---

### 7. JSX Response Rendering

On a successful response, the handler calls `z4.createElement` (bundle.js:+10950050) to render the side-question answer inline in the Claude Code UI without injecting a new conversation turn.

```
function renderBtwResponse(responseText):
    return createElement(BtwResponseComponent, {
        content: responseText,
        inline: true
    })
```

Analysis basis: CC v2.1.163 bundle.js:+10950050

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_sad` (bundle.js:+1010365); `tengu_config_lock_contention` (+3259907); `tengu_config_stale_write` (+3260043); `tengu_config_parse_error` (+3262482); `tengu_bg_dispatch_sigkill_escalate` (+16133292); `tengu_bg_dispatch_low_mem` (+16133893); `tengu_bg_spare_enable` (+16134597); `tengu_bg_spare_claim` (+16134725); `tengu_bg_spare_claim_fail` (+16134991); `tengu_config_auth_loss_prevented` (+3260386); `tengu_daemon_control` (+16170260); `tengu_daemon_config_reload` (+16148704); `tengu_bg_retire_pinned_low_mem` (+16137897); `tengu_bg_prewarm_per_sweep` (+16138018) |
| Hook registration | `MXA.register` called after successful transcript write (bundle.js:+60323) |
| appState changes | None directly; the `control-request` dispatch path may update background session state via the daemon supervisor |
| Config writes | May write to `~/.claude.json` via the lock-protected `saveConfigWithLock` path; guarded against auth-loss overwrites |
| Transcript / log file | Appends to the active transcript file; rotates `.txt` files when size threshold exceeded |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Background worker effects | Daemon-side: `tengu_bg_spare_claim`, SIGKILL escalation, low-memory retirement of pinned workers (all indirect — via the thin-client dispatch infrastructure, not specific to `/btw`) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.163 | Initial analysis |

---

## Common Mistakes

1. **Omitting the question argument** — `/btw` without any text produces only the usage hint `"Usage: /btw <your question>"` and does not dispatch any request. Always supply a non-empty question.
2. **Expecting a conversation turn** — Because `immediate: true` and `thinClientDispatch: "control-request"` are set, the answer is rendered as an out-of-band JSX component, not as a message in the main conversation history. Do not rely on `/btw` responses appearing in exported transcripts.
3. **Concurrent Claude instances** — The config-lock path will emit a warning and may delay the command if another Claude Code instance holds `~/.claude.json`'s lock. The timeout is 60 000 ms; after that, the lock is considered stale.
4. **Model-alias confusion** — The model-routing layer resolves short aliases (`"best"`, `"haiku"`, `"sonnet"`, `"opus"`, `"opusplan"`) to canonical IDs at dispatch time. Passing a raw model string in a downstream integration may be re-mapped unexpectedly.
5. **Confusing `/btw` with `/ask`** — `/btw` is intentionally ephemeral and non-interrupting. It is not a substitute for a full in-context question; for questions that require reading conversation history, use a different command.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `jzf` | Main `/btw` handler (AsyncFunction); Arbor-resolved entry point |
| `H` | API bootstrap fetcher; dispatches the control-request to the thin-client layer |
| `v` | Message/context processing utility; sanitizes content, routes to model |
| `ccK` | Context-building helper called from the message processor |
| `OXA` | Sub-helper invoked by context builder |
| `SH` | JSON serializer wrapper (`JSON.stringify`) |
| `J4` | Path/content formatter; trims, replaces, and slices message content |
| `g2A` | Maps over the `BcK` array (likely message list) |
| `q` | File-system utility (unlinkSync etc.); also appears as conversation queue |
| `A` | Lower-case normalizer / file-path utility |
| `ppH` | Writer helper; calls `H.write` |
| `h2A` | Low-level write wrapper |
| `icK` | Transcript/log persistence coordinator |
| `$pH` | Timer-based batching helper (uses `setTimeout`/`setImmediate`/`clearTimeout`) |
| `d3H` | Path-join + hook helper inside transcript subsystem |
| `Q6` | Directory/path existence checker |
| `aL6` | Async utility called during file append path |
| `r2A` | Path-join helper for transcript files |
| `i2A` | File rotation helper (stat → rename → unlink) |
| `ncK` | Mkdir + appendFile + rotation orchestrator (bound via `.bind`) |
| `j9` | Hook-registration dispatcher; calls `MXA.register` |
| `e$` | Utility called early in bootstrap fetch |
| `Pw_` | Input parser: splits, trims, finds index, slices raw input string |
| `ZHH` | Guard checking a Set (`g44.has`) — likely dedup or feature-flag check |
| `uj` | String replacer (wraps `H.replace`) |
| `t1` | Message-thread builder; calls `D6H`, `Aq`, `eX` |
| `D6H` | Sub-builder for message objects |
| `x0` | Helper called during message construction |
| `IqH` | Helper called during message construction |
| `yd` | Message normalizer: trims, maps, checks prefixes (`"anthropic."`) |
| `Aq` | Model-alias resolver; handles `"opusplan"`, `"sonnet"`, `"haiku"`, `"opus"`, `"best"` |
| `o0` | Sub-helper called by model resolver |
| `_4H` | Checks `H4H.includes` — likely model-family membership test |
| `wI` | Wraps `gM`+`Z5` — provider-detection pair |
| `NQH` | Wraps `Z5` — provider-detection helper |
| `NE` | Provider classifier: `gM`, `Z5`, `XA` — distinguishes first-party vs. others |
| `kX1` | Calls `NE` — model-type classifier |
| `gM` | Provider-type helper (returns `"anthropicAws"`, `"gateway"`, etc.) |
| `Pe6` | Checks `l1L.includes` — list membership guard |
| `vQH` | Wraps `eH` — another classification helper |
| `eX` | Calls `Aq` and `r0` — extended message builder |
| `r0` | Full provider/model resolution: `ZA`, `P6H`, `PYH`, `IQH`, `NE`, `z2`, `gM`, `XA`, `Z5`, `wI` |
| `s6` | Feature SAD telemetry emitter (`tengu_feature_sad`) |
| `c` | Shared utility (logger / error formatter) used broadly |
| `P6` | Calls `Nu6` — low-level utility |
| `Nu6` | Base utility called by `P6` |
| `X8` | Config-save orchestrator; calls `SX_`, `eT`, `bDH`, `hX_` |
| `SX_` | `saveConfigWithLock` implementation; manages lock lifecycle |
| `L` | File-system module handle (statSync, mkdirSync, copyFileSync, etc.) |
| `f` | Connection/handle with `close`/`finally` lifecycle |
| `wP1` | Config-object factory; calls `v5_`, `Object.assign` |
| `v5_` | Calls `DP1` — config initializer |
| `v8` | Error classifier / EISDIR guard |
| `bDH` | Config file reader; handles parse errors, backup creation |
| `B6` | JSON.parse wrapper |
| `vx` | String prefix stripper (`startsWith` + `slice`) |
| `fr1` | Directory reader for config backup scanning |
| `RX_` | Path-join + extension helper for backup files |
| `w` | Background worker/daemon manager (spawn, kill, memory checks) |
| `fj6` | Helper used in both `X8` and `SX_` paths |
| `V` | Scrollable/viewport component or file-system variant |
| `P` | Terminal UI / editor component (NFC normalisation, INSERT mode) |
| `J` | Worker-wrapper calling `w` |
| `j` | Worker kill utility (values + kill) |
| `z` | Daemon stop handler (`hH`, `RH`, `Yh`, `Tp`) |
| `Y` | Supervisor config-reload handler; emits `tengu_daemon_config_reload` |
| `h` | Background-session sweep: memory check, prewarm, retire |
| `A3A` | VI/editor mode dispatcher (operator, find, replace, indent …) |
| `C` | Request executor; enqueues via `I.enqueue`, uses `Pj.randomUUID` |
| `T` | Worker lifecycle object (stop/updateConfig/start) |
| `TM6` | Atomic file-write helper (temp file + fsync + rename) |
| `O` | Symlink/stat checker (`isSymbolicLink`) |
| `R8` | Error-code classifier wrapping `v8` |
| `_lH` | Utility called during config-save setup |
| `Lr1` | Iterates `Object.entries` — config key enumerator |
| `t98` | Timestamps via `Date.now` |
| `hX_` | Config helper: dirname, UJ, SH, TM6 — alternate write path |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.