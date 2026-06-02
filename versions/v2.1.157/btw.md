---
type: feature-spec
feature: "btw"
cc_version: "2.1.157"
updated: "2026-06-02"
tags: ["btw", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.157 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/btw`

> Analysis basis: CC v2.1.157 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.157

---

## Overview

`/btw` ("by the way") lets the user inject a quick side question or remark into the session without disrupting the primary conversation flow. It is a `local-jsx` command that dispatches a `control-request` through the thin-client path and resolves immediately (`immediate: true`), so the user sees a response promptly even while a longer task is in progress.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `btw` |
| description | Ask a quick side question without interrupting the main conversation |
| argumentHint | `<question>` |
| immediate | `true` |
| thinClientDispatch | `control-request` |
| module_id | `Kv1` |
| load_inline | `true` |
| loc_byte | `10714283` |
| loc_byte_end | `10714522` |
| arbor_handler.name | `qnL` |
| arbor_handler.fqn | `claude-2.1.157::qnL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.157 bundle.js:+10714283

---

## Input Branching

The command has two primary branches: the user provides no argument (usage error path) versus the user provides a non-empty question (dispatch path). Two branches → numbered pseudocode is appropriate.

1. **No argument supplied** — handler detects an empty input and returns an inline usage message.
2. **Argument supplied** — handler constructs a `system`-role message envelope and dispatches the side-question via the `control-request` channel, then renders a JSX response element.

```
function handleBtw(userInput):
    if userInput is empty or missing:
        return usageError("Usage: /btw <your question>")   // +10713880

    envelope = buildSystemMessage(                          // +10713919
        role  = "system",
        body  = userInput
    )

    dispatchControlRequest(envelope)                        // thin-client path

    return renderJSX(responseElement)                       // +10713988
```

---

## Behavioral Spec

### Handler — `qnL` (async side-question dispatcher)

The Arbor-resolved handler `qnL` is an `AsyncFunction` loaded inline via module `Kv1`.

Analysis basis: CC v2.1.157 bundle.js:+10713878

```
async function sideQuestionDispatcher(args, appContext):

    // 1. Guard: require a non-empty question argument
    if args.question is blank:
        emit inlineText("Usage: /btw <your question>")     // +10713880
        return

    // 2. Build the system-role message envelope
    messageEnvelope = {
        role: "system",                                     // +10713919
        content: args.question
    }

    // 3. Resolve global config (with file lock, backup, and parse
    //    validation — see Config Access sub-feature below)
    config = await loadConfig()                             // → z8 → AY_ path

    // 4. Dispatch the side question as a control-request
    //    (thinClientDispatch = "control-request")
    await sendControlRequest(messageEnvelope, config)

    // 5. Return a JSX element to display the agent reply inline
    return G4.createElement(responseWidget, { message: args.question })
                                                            // +10713988
```

### Sub-feature — Jitter helper (`H`)

Called by `qnL` at the start of dispatch. Adds a small random delay before sending, likely to avoid thundering-herd when multiple `/btw` calls arrive simultaneously.

Analysis basis: CC v2.1.157 bundle.js:+10713878

```
function jitterDelay():
    // range: Math.random() * 2 + 1  (approximately 1–3 units)
    delay = Math.random() * 2 + 1                          // +13423029, +13423045
    await setTimeout(delay)
```

### Sub-feature — Config access (`z8` → `AY_`)

`qnL` calls the config-retrieval subsystem before dispatching, ensuring the current session credentials and settings are fresh. This path involves file-system locking, backup rotation, and stale-write detection.

Analysis basis: CC v2.1.157 bundle.js:+10713942

```
async function getConfig(context):
    sessionData = await readSessionToken(context)           // → qT
    rawConfig   = await loadAndLockConfig()                 // → AY_

    return mergedConfig(sessionData, rawConfig)

async function loadAndLockConfig():
    // Acquire file lock; warn if contention is detected
    acquireLock()
    if lockTookTooLong:
        logError("Lock acquisition took longer than expected …")
                                                            // +3207889
        emit telemetry("tengu_config_lock_contention")      // +3207978

    configData = readConfigFile("utf-8")                    // +3210005

    try:
        parsed = JSON.parse(configData)                     // via p6 → JSON.parse
    catch parseError:
        emit telemetry("tengu_config_parse_error")          // +3210553
        raise

    // Stale-write guard: refuse to overwrite if auth was lost
    if cachedAuthPresent and re-readAuthMissing:
        emit telemetry("tengu_config_auth_loss_prevented")  // +3208457
        logWarning("saveConfigWithLock: re-read config is missing auth …")
                                                            // +3208305
        return cachedConfig

    // Rotate backups (keep up to 5)                        // +3208908
    rotateBackups(maxCount = 5)

    releaseLock()
    return parsed
```

### Sub-feature — Message formatter (`N`)

Constructs the wire-format representation of the side-question before it is handed to the transport layer.

Analysis basis: CC v2.1.157 bundle.js:+3205027

```
function formatMessage(role, content, sessionMeta):
    // Normalise role to uppercase for protocol header
    header = role.toUpperCase()                             // +204277

    // Generate a unique message ID
    msgId  = generateUUID()                                 // → v4

    // Attach session metadata and trim whitespace
    body   = content.trim()                                 // +204300

    // Log at debug level before dispatch
    log("debug", { id: msgId, role: header, body })        // +204151

    return { id: msgId, role: header, body, meta: sessionMeta }
```

### Sub-feature — File writer (`lCK`)

Used within the config-save path to persist updated configuration atomically.

Analysis basis: CC v2.1.157 bundle.js:+204336

```
async function atomicConfigWrite(filePath, data):
    dir      = path.dirname(filePath)                       // +203696
    tempPath = joinPath(dir, tmpName())                     // → g6
    byteLen  = Buffer.byteLength(data)                      // +203871

    // Write to temp file, then rename into place
    writeFileWithRetry(tempPath, data,
        retryIntervalMs = 1000,                             // +203982
        maxRetries      = 100)                              // +204001

    await rename(tempPath, filePath)                        // → Gx6.then

    // Bind close handler
    registerCloseHandler(cleanup.bind(context))             // +203930
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_config_lock_contention` | Fired when config file lock takes longer than expected (bundle.js:+3207978) |
| Telemetry — `tengu_config_stale_write` | Fired when a stale config write is detected (bundle.js:+3208114) |
| Telemetry — `tengu_config_parse_error` | Fired when the config JSON fails to parse (bundle.js:+3210553) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a write would have silently dropped auth credentials (bundle.js:+3208457) |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Fired by the background-session manager during SIGKILL escalation (bundle.js:+15466951) |
| Telemetry — `tengu_bg_dispatch_low_mem` | Fired when available free memory falls below threshold (bundle.js:+15467530) |
| Telemetry — `tengu_bg_spare_enable` | Fired when a spare background session slot is enabled (bundle.js:+15468225) |
| Telemetry — `tengu_bg_spare_claim` | Fired when a spare session is successfully claimed (bundle.js:+15468346) |
| Telemetry — `tengu_bg_spare_claim_fail` | Fired when spare-session claim fails (bundle.js:+15468609) |
| thinClientDispatch | Sends the side-question envelope via the `control-request` channel, bypassing the normal conversation turn queue |
| immediate | Set to `true`; the command response is rendered without waiting for any running tool to complete |
| Config file lock | Acquired and released during config read; contention is logged and telemetry-reported |
| Config backup rotation | Up to 5 `.backup.*` files retained alongside the main config (bundle.js:+3208908, +3208775) |
| JSX render | A response widget element is created via `G4.createElement` and returned to the UI layer (bundle.js:+10713988) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.157 | Initial analysis |

---

## Common Mistakes

1. **Omitting the question argument.** Running `/btw` with no text returns a usage hint (`"Usage: /btw <your question>"`) and sends nothing to the model.
2. **Expecting it to pause an active tool.** Because `immediate: true` and `thinClientDispatch: "control-request"` are set, the side-question is injected through a separate control channel — it does not pause or cancel a running tool invocation.
3. **Confusing `/btw` with a normal turn.** The command wraps the question in a `system`-role envelope before dispatch, so the model may perceive it differently from a standard `user`-role message.
4. **Assuming instant config freshness.** The handler reads and locks the config file on every invocation; in environments where another Claude instance is concurrently writing, brief lock-contention delays are possible and are surfaced as `tengu_config_lock_contention` telemetry events.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `qnL` | Main handler — async side-question dispatcher (`/btw` entry point) |
| `H` | Jitter delay helper (uses `Math.random` + `setTimeout`) |
| `z8` | Config retrieval orchestrator (calls `qT`, `AY_`, session helpers) |
| `AY_` | Config load-and-lock implementation (file lock, backup rotation, stale-write guard) |
| `_` | Filesystem abstraction (primary FS layer used inside config path) |
| `g6` | Temporary filename generator / path helper |
| `L` | Secondary filesystem/lock layer (statSync, copyFileSync, unlinkSync, etc.) |
| `q` | Tertiary filesystem layer (unlinkSync, readFileSync, mkdirSync, readdirStringSync) |
| `f` | File-handle finaliser (close handlers, `finally` chain) |
| `dOq` | Config object merger (`Object.assign` wrapper) |
| `qK_` | Config sub-key resolver (calls `QOq`) |
| `N` | Message formatter (role normalisation, UUID generation, debug logging) |
| `QCK` | Protocol header builder (calls `QI`, `gCK`, `qOA`) |
| `RH` | JSON serialiser wrapper (`JSON.stringify`) |
| `v4` | UUID / message-ID generator |
| `EuH` | Encoding utility (calls `VYA`) |
| `lCK` | Atomic config file writer (temp-file + rename pattern) |
| `d` | General-purpose data container / intermediate state holder |
| `j8` | Error classifier / branch dispatcher |
| `szH` | Config file reader and backup manager (readFileSync, mkdirSync, copyFileSync) |
| `p6` | JSON parse wrapper (`JSON.parse`) |
| `gb` | String prefix stripper (startsWith + slice) |
| `yFq` | Directory scanner / backup file enumerator |
| `qY_` | Backup path joiner (`MD.join` + `F8`) |
| `w` | Background-session process manager (spawn, kill, SIGKILL escalation) |
| `AY6` | Config cache accessor |
| `A` | Lowercase normaliser / map of active processes |
| `V` | Versioned path or config-version string checker |
| `P` | MCP/SDK connection manager (Promise.all, SH, F_) |
| `Lx8` | SDK transport initialiser |
| `SH` | MCP server session handler (logError, push) |
| `F_` | Error factory (wraps native `Error` + `String`) |
| `E` | Slice buffer / intermediate byte array |
| `yL6` | Atomic symlink-safe file writer (randomBytes temp name, fchmod, fsync, rename) |
| `O` | Stat result wrapper (isSymbolicLink) |
| `P8` | Error re-throw helper (calls `j8`) |
| `pQH` | Pre-dispatch validation / pre-flight check |
| `IFq` | Entry iterator (`Object.entries` wrapper) |
| `UQH` | Timestamp recorder (`Date.now` wrapper) |
| `_Y_` | Symlink-aware path resolver (dirname + `yL6`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.