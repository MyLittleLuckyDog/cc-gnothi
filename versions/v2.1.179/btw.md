---
type: feature-spec
feature: "btw"
cc_version: "2.1.179"
updated: "2026-06-19"
tags: ["btw", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.179 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/btw`

> Analysis basis: CC v2.1.179 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.179

---

## Overview

`/btw` ("by the way") lets the user pose a quick side question to the agent without disrupting the main conversation thread. It is a `local-jsx` command that fires immediately (`immediate: true`) and routes through the daemon's `control-request` dispatch channel, injecting a `system`-role framing message before the user's question text.

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
| module_id | `a8K` |
| load_inline | `true` |
| loc_byte | `11332434` |
| loc_byte_end | `11332673` |
| loc_line | `7257` |
| arbor_handler.name | `npL` |
| arbor_handler.fqn | `claude-2.1.179::npL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.179 bundle.js:+11332434

---

## Input Branching

Two primary branches exist: the user provides no argument (missing `<question>`), or the user provides a question. Because there are only 2 distinct paths, numbered pseudocode is used.

1. **No argument supplied** — the handler detects an empty or absent argument and returns an error/usage string: `"Usage: /btw <your question>"` (bundle.js:+11332027).
2. **Question argument present** — the handler constructs a system-framed message containing the question text and dispatches it as a `control-request` to the agent without interrupting the active conversation flow.

---

## Behavioral Spec

### Handler Entry Point (`npL`)

The Arbor-resolved handler is the async function `npL` (bundle.js:+11332025, resolution via `module_id → a8K`).

```
async function handleBtw(userInput):
    if userInput is empty or null:
        return usageError("Usage: /btw <your question>")

    // Build a system-role injection message
    systemMessage = buildSystemMessage(role="system", content=userInput)
    // (bundle.js:+11332066 — "system" role string)

    // Dispatch the message to the running agent via the control-request channel
    // without clearing or replacing the existing conversation context
    dispatchControlRequest(systemMessage)

    // Render JSX feedback element to the UI
    return renderFeedbackElement(Hf.createElement, systemMessage)
    // (bundle.js:+11332135)
```

Analysis basis: CC v2.1.179 bundle.js:+11332025

### Usage Validation (`H` — usage guard)

```
function validateUsage(input):
    // Uses a random-jitter delay for retry scheduling if needed
    jitterBase = 2        // bundle.js:+14230695
    jitterUnit = 1        // bundle.js:+14230711
    delay = Math.random() * jitterBase + jitterUnit
    // (bundle.js:+14230697, +14230734)

    if input is missing:
        emit("Usage: /btw <your question>")  // bundle.js:+11332027
        return INVALID
    return VALID
```

Analysis basis: CC v2.1.179 bundle.js:+14230697

### Configuration Access and Persistence (`J8` → `eO8`)

When the command triggers a side-channel message that requires persisting state (e.g., appending the injected question to conversation config or session metadata), the call chain `J8 → eO8` handles config read/write with file-locking:

```
function configuredDispatch(payload):
    acquire file lock (eO8)
    if lock took too long:
        log error "Lock acquisition took longer than expected..."
        // bundle.js:+3397729
        emit telemetry: tengu_config_lock_contention  // bundle.js:+3397818

    timestamp = Date.now()              // bundle.js:+3397590
    writeConfigEntry(payload, timestamp)

    if stale write detected:
        emit telemetry: tengu_config_stale_write  // bundle.js:+3397954

    release lock
```

Analysis basis: CC v2.1.179 bundle.js:+3394474

### Global Config Save Guard (`J8` → `RsH`)

Before persisting, the implementation checks whether a re-read of the global config would lose authentication data that the in-memory cache holds. If so, it refuses the write:

```
function saveGlobalConfigWithGuard(cachedConfig, freshConfig):
    if freshConfig is missing auth fields that cachedConfig has:
        log warning: "saveGlobalConfig fallback: re-read config is missing auth..."
        // bundle.js:+3394681
        return WITHOUT_WRITE
    proceed with atomic write via tempFile + rename
```

Analysis basis: CC v2.1.179 bundle.js:+3394671

### Message Construction (`N` — system message builder)

```
function buildSystemMessage(role, content):
    // role is always "system" for /btw  (bundle.js:+11332066)
    upperRole = role.toUpperCase()          // bundle.js:+212884
    trimmedContent = content.trim()         // bundle.js:+212907
    if role in acceptedRoles:               // bundle.js:+212822
        return { role: upperRole, content: trimmedContent }
    else:
        serialize as JSON (bH)              // bundle.js:+190917
        return fallback representation
```

Analysis basis: CC v2.1.179 bundle.js:+212782

### Config File I/O (`r5H` — config reader)

```
function readConfigFile(path):
    if config accessed before init gate:
        throw Error("Config accessed before allowed.")  // bundle.js:+3399762

    raw = fs.readFileSync(path, "utf-8")    // bundle.js:+3399818, +3399845
    parsed = JSON.parse(raw)                // bundle.js:+191694

    // Handle path prefix stripping (Vm)
    if parsed.path starts with known prefix:
        parsed.path = parsed.path.slice(prefixLength)  // bundle.js:+1181417

    // Backup rotation: keeps up to 5 backups (bundle.js:+3398748)
    rotateBackups(path, maxBackups=5)       // directory "backups" (bundle.js:+3399330)
    return parsed
```

Analysis basis: CC v2.1.179 bundle.js:+3399756

### Background Daemon Dispatch (`D` — bg session manager)

The `control-request` channel routes through the background session daemon. Key behaviors observed in the call graph:

```
function dispatchControlRequest(message):
    session = sessionMap.get(jobId)
    if session is "closed":            // bundle.js:+17067164
        return SESSION_CLOSED

    if lowMemory detected:
        emit telemetry: tengu_bg_dispatch_low_mem   // bundle.js:+17067903
        if freeMem < threshold:
            escalate SIGKILL            // bundle.js:+17067350
            emit telemetry: tengu_bg_dispatch_sigkill_escalate  // bundle.js:+17067302

    if spareSession available:
        claimSpare()
        emit telemetry: tengu_bg_spare_claim        // bundle.js:+17068735
    else:
        emit telemetry: tengu_bg_spare_claim_fail   // bundle.js:+17069001

    sendMessage(message)
    recordTimestamp(Date.now())         // bundle.js:+17068766
```

Analysis basis: CC v2.1.179 bundle.js:+17067184

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_config_lock_contention` | Emitted when config file lock acquisition stalls (bundle.js:+3397818) |
| Telemetry: `tengu_config_stale_write` | Emitted when a stale-config overwrite is detected (bundle.js:+3397954) |
| Telemetry: `tengu_config_parse_error` | Emitted when config JSON fails to parse (bundle.js:+3400393) |
| Telemetry: `tengu_config_auth_loss_prevented` | Emitted when a write is blocked to avoid erasing cached auth (bundle.js:+3398297) |
| Telemetry: `tengu_config_fallback_write` | Emitted on fallback config write path (bundle.js:+3397434) |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Emitted when SIGKILL is sent to a bg session due to low memory (bundle.js:+17067302) |
| Telemetry: `tengu_bg_dispatch_low_mem` | Emitted when dispatch detects low free memory (bundle.js:+17067903) |
| Telemetry: `tengu_bg_spare_enable` | Emitted when a spare background session is enabled (bundle.js:+17068607) |
| Telemetry: `tengu_bg_spare_claim` | Emitted when a spare session is successfully claimed (bundle.js:+17068735) |
| Telemetry: `tengu_bg_spare_claim_fail` | Emitted when spare session claim fails (bundle.js:+17069001) |
| Telemetry: `tengu_bg_proto_mismatch` | Emitted on daemon protocol version mismatch (bundle.js:+17053087) |
| Telemetry: `tengu_bg_dispatch_stale_drop` | Emitted when a stale dispatch message is dropped (bundle.js:+17054486) |
| Telemetry: `tengu_bg_attach_legacy_autorespawn` | Emitted on legacy-client auto-respawn during attach (bundle.js:+17057374) |
| Telemetry: `tengu_bg_attach` | Emitted at bg session attach (bundle.js:+17058532) |
| Telemetry: `tengu_bg_attach_stall_gave_up` | Emitted when attach stall retry is exhausted (bundle.js:+17059455) |
| Telemetry: `tengu_bg_attach_stall_respawn` | Emitted when attach stall triggers respawn (bundle.js:+17059725) |
| Telemetry: `tengu_bg_attach_kick` | Emitted when an attach kicks an existing session (bundle.js:+17060717) |
| Config file I/O | Reads/writes `~/.claude.json` with file-locking and backup rotation (max 5 backups) |
| Backup directory | `backups/` subdirectory under config dir (bundle.js:+3399330) |
| Background session | Message routed via `control-request` to daemon; may spawn/claim spare session |
| JSX render | Returns a React element via `Hf.createElement` for in-UI feedback (bundle.js:+11332135) |
| Conversation continuity | Injects as `system`-role message; does not clear conversation context |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.179 | Initial analysis |

---

## Common Mistakes

1. **Omitting the argument**: Running `/btw` with no text returns a usage error (`"Usage: /btw <your question>"`) rather than sending anything to the agent. Always supply a question string.
2. **Expecting context replacement**: `/btw` injects via a `system`-role side channel; it does not reset or replace the active conversation. Users expecting the main thread to pivot topic should use a different mechanism.
3. **Assuming synchronous config writes**: Config persistence goes through a file-lock and retry path; concurrent Claude Code instances may trigger `tengu_config_lock_contention` events and brief delays.
4. **Confusing `immediate: true` with real-time streaming**: The `immediate` flag means the command dispatches without requiring a user confirmation step, not that the agent's response arrives instantaneously.
5. **Misreading `thinClientDispatch: "control-request"`**: This routes the payload through the daemon's control plane, not the normal conversational message bus; tooling that monitors only the chat stream will not see `/btw` injections.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `npL` | Main `/btw` command handler (AsyncFunction, Arbor-resolved via module_id `a8K`) |
| `H` | Usage validator / jitter-delay scheduler |
| `J8` | Config dispatch coordinator (calls `eO8`, `r5H`, `RsH`) |
| `eO8` | Config file write helper with file-locking and backup rotation |
| `_` | Internal filesystem utility (used for path ops in config layer) |
| `c6` | Path normalization / resolution helper |
| `f` | Filesystem abstraction (mkdirSync, copyFileSync, statSync, etc.) |
| `q` | Secondary filesystem abstraction (readFileSync, mkdirSync, readdirStringSync) |
| `L` | Async operation / connection lifecycle manager |
| `RC1` | Config record constructor (calls `x2_`, `Object.assign`) |
| `x2_` | Config schema initializer (calls `SC1`) |
| `N` | System message builder (handles role, trim, JSON serialization) |
| `nM4` | Message normalization helper |
| `bH` | JSON serializer wrapper |
| `g4` | String/path manipulation utility |
| `ydH` | Calls `GbA`; purpose unclear at depth 2 |
| `aM4` | File content packager (Buffer.byteLength, async write pipeline) |
| `d` | General-purpose dispatch / event emitter |
| `G8` | Error code classifier / guard |
| `r5H` | Config file reader with backup and parse logic |
| `l6` | JSON parse wrapper |
| `Vm` | Path-prefix stripper (startsWith / slice) |
| `fM9` | Directory reader / config file locator |
| `ay_` | Backup path joiner (ID.join + `z_`) |
| `D` | Background session manager / daemon dispatcher |
| `RsH` | Global config save guard (auth-loss prevention) |
| `A` | Lowercase normalizer / module export map |
| `v` | Scroll/viewport math utility (Math.max, Math.floor, preventDefault) |
| `S` | Terminal supervisor writer (v94, mL, SH, w.write) |
| `Z` | Bounded-range calculator (Math.max, Math.min) |
| `P` | IPC pipe reader / buffer processor |
| `X` | IPC stream with timeout (M, q.setTimeout) |
| `j` | Process kill manager (A.values, S.kill) |
| `cL` | Connection end handler (H.end, bH) |
| `qx5` | Daemon protocol message router (large fan-out handler) |
| `GH` | String coercion helper |
| `ED6` | Atomic file write helper (symlink-safe, temp+rename, fchmod) |
| `O` | Symbolic-link / stream entity |
| `x8` | Error guard wrapping `G8` |
| `rXH` | Registration context helper in config flow |
| `KM9` | Object.entries iterator for config map |
| `pG6` | Timestamp / date helper (Date.now) |
| `tO8` | Config save orchestrator (calls `pG6`, `ED6`, `QH`) |
| `QH` | Notification/queue helper (calls `n36`) |
| `n36` | Low-level notification primitive |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.