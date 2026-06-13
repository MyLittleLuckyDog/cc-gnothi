---
type: feature-spec
feature: "btw"
cc_version: "2.1.176"
updated: "2026-06-13"
tags: ["btw", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.176 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/btw`

> Analysis basis: CC v2.1.176 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.176

---

## Overview

`/btw` ("by the way") allows the user to ask a quick side question without disrupting the flow of the main conversation. It dispatches a lightweight, immediate control request to the agent using a dedicated system-role message, so the aside is handled inline rather than as a new top-level turn. The command is rendered as a local JSX component and is resolved through the module identified as `_tq`.

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
| module_id | `_tq` |
| load_inline | `true` |
| loc_byte | `11271340` |
| loc_byte_end | `11271579` |
| loc_line | `7356` |
| **arbor_handler.name** | `xRL` |
| **arbor_handler.fqn** | `claude-2.1.176::xRL` |
| **arbor_handler.kind** | `AsyncFunction` |
| **arbor_handler.resolution_path** | `module_id` |
| **arbor_handler.n_hits** | `0` |
| `arbor_handler.name` | `xRL` |
| `arbor_handler.kind` | `AsyncFunction` |
| `arbor_handler.resolution_path` | `module_id` |
| `arbor_handler.fqn` | `claude-2.1.176::xRL` |
| `arbor_handler.n_hits` | `0` |

Analysis basis: CC v2.1.176 bundle.js:+11271340

---

## Input Branching

The command has two meaningful entry paths: the user either provides a question argument or does not. When a question is present the handler proceeds through message construction and dispatch; when absent it displays a usage hint. This linear two-branch flow is represented as numbered pseudocode below.

1. User invokes `/btw <question>`.
2. If `<question>` is empty or absent → display usage hint: `"Usage: /btw <your question>"` and return early.
3. If `<question>` is present → proceed to handler `xRL` (AsyncFunction).

Analysis basis: CC v2.1.176 bundle.js:+11270933

---

## Behavioral Spec

### Main Handler — `btw` Async Execution

```
async function btwCommandHandler(question, context):

    // Guard: require a non-empty argument
    if question is empty or missing:
        display "Usage: /btw <your question>"
        return

    // Build a system-role aside message
    asideMessage = buildSystemMessage(question)
    // role is "system" (bundle.js:+11270972)

    // Dispatch via thinClientDispatch="control-request"
    // immediate=true means no queuing; fires synchronously into the
    // control channel rather than waiting for the main conversation turn
    result = await dispatchControlRequest(asideMessage, context)

    // Render response as JSX element via H4.createElement
    return renderJSX(result)
```

Analysis basis: CC v2.1.176 bundle.js:+11271041

### Message Role Assignment

The question is wrapped in a `"system"`-role message before being sent. This distinguishes the aside from normal `"user"`-role conversation turns, preserving the main thread's continuity.

Analysis basis: CC v2.1.176 bundle.js:+11270972

### Config Persistence Path (via `P8` → `j38`)

The handler calls into a config-save subsystem (`saveConfigWithLock`) during execution. That subsystem:

```
function saveConfigWithLock(configData):
    acquireFileLock(configDir)         // creates lock dir via mkdirSync
    if lockAcquisitionTookTooLong:
        emit telemetry("tengu_config_lock_contention")
        log warning "Lock acquisition took longer than expected..."

    currentConfig = readConfigFromDisk()
    if currentConfig is missing auth fields that cache holds:
        emit telemetry("tengu_config_auth_loss_prevented")
        log warning "saveConfigWithLock: re-read config is missing auth..."
        // Refuses write to avoid wiping ~/.claude.json (GH #3117)
        return

    writeConfigAtomically(configData)
    releaseLock()
```

Analysis basis: CC v2.1.176 bundle.js:+3331539, +3334693, +3335109

### Jitter Delay Utility (via `H`)

A small utility introduces a randomised delay before certain internal retries:

```
function jitterDelay(baseMs):
    factor = Math.random() * 2    // range [0, 2)  (bundle.js:+14138789)
    offset = factor * 1           // multiplied by 1  (bundle.js:+14138805)
    await setTimeout(baseMs + offset)
```

Analysis basis: CC v2.1.176 bundle.js:+14138791, +14138828

### Atomic Config File Write (via `EY6`)

When config must be persisted to disk, the atomic write helper:

```
function atomicWriteConfig(targetPath, data):
    tempPath = targetPath + "." + randomBytes(8).toString("hex")
    writeFileSync(tempPath, data, "utf-8")
    applyOriginalPermissions(tempPath)   // fchmodSync
    fsyncSync(tempPath)                  // durability flush
    renameSync(tempPath, targetPath)     // atomic swap
    if oldSymlink exists: unlinkSync(oldSymlink)
```

Analysis basis: CC v2.1.176 bundle.js:+1091990, +1092018, +1092484, +1092550, +1092678

### Background Session Dispatch (via `P8` → `D`)

The control-request dispatch path reaches the background session manager, which:

```
function backgroundSessionDispatch(request):
    if session state is "closed":
        if idleSeconds > 30: send SIGKILL (escalate from SIGTERM)
        emit telemetry("tengu_bg_dispatch_sigkill_escalate")

    if freemem is low:
        emit telemetry("tengu_bg_dispatch_low_mem")

    if spareSessionAvailable:
        emit telemetry("tengu_bg_spare_claim")
        claimSpare()
    else:
        emit telemetry("tengu_bg_spare_enable")
        spawnNewSession()

    routeRequestToSession(request)
```

Analysis basis: CC v2.1.176 bundle.js:+16981999, +16982600, +16983304, +16983432

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_config_lock_contention` | Fired when config file lock takes unexpectedly long (bundle.js:+3334782) |
| Telemetry — `tengu_config_stale_write` | Fired when a stale config write is detected (bundle.js:+3334918) |
| Telemetry — `tengu_config_parse_error` | Fired when config JSON cannot be parsed (bundle.js:+3337357) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a write that would erase auth credentials is blocked (bundle.js:+3335261) |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Fired when a background session receives SIGKILL escalation (bundle.js:+16981999) |
| Telemetry — `tengu_bg_dispatch_low_mem` | Fired when dispatch is attempted under low-memory conditions (bundle.js:+16982600) |
| Telemetry — `tengu_bg_spare_enable` | Fired when a spare background session slot is enabled (bundle.js:+16983304) |
| Telemetry — `tengu_bg_spare_claim` | Fired when a spare session is successfully claimed (bundle.js:+16983432) |
| Telemetry — `tengu_bg_spare_claim_fail` | Fired when spare session claim fails (bundle.js:+16983698) |
| Telemetry — `tengu_bg_proto_mismatch` | Fired on background protocol version mismatch (bundle.js:+16967784) |
| Telemetry — `tengu_bg_dispatch_stale_drop` | Fired when a stale dispatch is dropped (bundle.js:+16969183) |
| Telemetry — `tengu_bg_attach_legacy_autorespawn` | Fired on legacy-client auto-respawn during attach (bundle.js:+16972071) |
| Telemetry — `tengu_bg_attach` | Fired on background session attach (bundle.js:+16973229) |
| Telemetry — `tengu_bg_attach_stall_gave_up` | Fired when attach stall causes the client to give up (bundle.js:+16974152) |
| Telemetry — `tengu_bg_attach_stall_respawn` | Fired when attach stall triggers a respawn (bundle.js:+16974422) |
| Telemetry — `tengu_bg_attach_kick` | Fired when an attach is kicked by another window (bundle.js:+16975414) |
| thinClientDispatch | `control-request` — routed through the background session IPC channel, bypassing the normal conversation queue |
| immediate | `true` — the command fires without waiting for an ongoing agent turn to complete |
| Config side effects | May atomically rewrite `~/.claude.json`; protected against auth-loss (GH #3117) |
| JSX rendering | Response rendered via `H4.createElement` (bundle.js:+11271041) |
| Jitter delay | Applied internally before retries; range is `[0, 2)` ms offset on base delay |

---

## Version History

| Version | Change |
|---|---|
| v2.1.176 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/btw` with no argument** — the handler will not forward anything to the agent; it instead surfaces the usage hint `"Usage: /btw <your question>"` and exits silently.
2. **Expecting a new conversation turn** — `/btw` uses `thinClientDispatch: "control-request"` and `immediate: true`, so it does not start a new turn. The aside is injected as a `"system"`-role message alongside the current context.
3. **Assuming synchronous config writes are safe to interrupt** — the config path employs a file lock and atomic rename; interrupting the process mid-write can leave a temporary file (hex-suffixed) in the config directory.
4. **Conflating `/btw` with `/ask` or similar** — this command is specifically designed for lightweight side questions; it is not a general-purpose query command and does not reset or fork the conversation.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `xRL` | Main async handler for `/btw` command (Arbor-resolved entry point) |
| `H` | Jitter delay utility (uses `Math.random` + `setTimeout`) |
| `P8` | Config save orchestrator (calls `saveConfigWithLock` pipeline) |
| `j38` | Inner config-write worker (file lock, atomic write, backup management) |
| `_` | Filesystem abstraction (mkdirSync, statSync, etc.) |
| `Q6` | Path resolver / config directory helper |
| `f` | IPC queue or file-operation set manager |
| `q` | Secondary filesystem abstraction |
| `L` | Connection / stream manager with `close` lifecycle |
| `dI1` | Config data merge utility (uses `Object.assign`) |
| `oJ_` | Config record constructor |
| `N` | Message builder / system-message formatter |
| `gff` | Sub-formatter invoked by message builder |
| `CH` | JSON serialiser wrapper (`JSON.stringify`) |
| `bf` | Content redaction utility (replaces sensitive data with `[REDACTED]`) |
| `kQH` | Additional message-key helper |
| `lff` | File-content loader with byte-length gating and async chaining |
| `d` | Generic async deferred / promise helper |
| `E8` | Error constructor / error-code emitter |
| `G5H` | Config reader with backup/rotation logic |
| `c6` | JSON parse wrapper |
| `Jm` | String prefix-strip utility |
| `gK9` | Backup directory scanner (readdir + path join) |
| `vN_` | Path join + module-resolution helper |
| `D` | Background session supervisor / daemon manager |
| `EaH` | Additional config-environment helper |
| `A` | Lowercase normaliser / string utility |
| `V` | Versioned file-entry filter |
| `P` | IPC pipe reader / buffer accumulator |
| `X` | Socket or stream with timeout management |
| `j` | Session kill / values iterator |
| `mL` | Stream end/flush helper |
| `qI5` | Background IPC protocol handler (full daemon message dispatch) |
| `TH` | String coercion utility |
| `E` | Slice + Math.max/min bounded list helper |
| `W` | SDK connection manager (Promise.all orchestrator) |
| `EY6` | Atomic file write helper (temp → rename pattern) |
| `O` | Symbolic-link stat / stream event emitter |
| `k8` | Error-code classifier |
| `zXH` | Config pre-validation step |
| `FK9` | Object.entries iterator helper |
| `h06` | Timestamp helper (`Date.now`) |
| `D38` | Config diff/merge writer with EY6 delegation |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.