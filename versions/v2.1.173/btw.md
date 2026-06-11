---
type: feature-spec
feature: "btw"
cc_version: "2.1.173"
updated: "2026-06-11"
tags: ["btw", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.173 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/btw`

> Analysis basis: CC v2.1.173 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.173

---

## Overview

`/btw` ("by the way") allows the user to ask a quick side question without interrupting or derailing the main ongoing conversation. It is a `local-jsx` command that dispatches as a `control-request` via the thin-client path, invoking the async handler `DV7` immediately upon submission. The question is injected as a system-role message into the conversation context rather than as a user turn.

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
| module_id | `Qlq` |
| load_inline | `true` |
| loc_byte | `11177894` |
| loc_byte_end | `11178133` |
| loc_line | `7329` |
| arbor_handler.name | `DV7` |
| arbor_handler.fqn | `claude-2.1.173::DV7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.173 bundle.js:+11177894

---

## Input Branching

The command has two distinct top-level branches based on whether a question argument is provided, making numbered pseudocode the appropriate representation.

1. **No argument supplied** — the handler (resolved via `module_id` → `Qlq` → `DV7`) detects an empty or missing argument and returns the usage hint string `"Usage: /btw <your question>"` (bundle.js:+11177487).
2. **Question argument supplied** — the handler proceeds to inject the question as a `system`-role message (bundle.js:+11177526) and dispatches it via the `control-request` thin-client path (registration field `thinClientDispatch`).

---

## Behavioral Spec

### Handler Entry (`DV7`) — Async Question Dispatcher

Analysis basis: CC v2.1.173 bundle.js:+11177485

```
async function dispatchSideQuestion(commandInput):
    question = commandInput.args.trim()

    if question is empty:
        return usageMessage("Usage: /btw <your question>")
        // literal at bundle.js:+11177487

    // Construct a system-role injection
    message = buildSystemMessage(question)
        // role = "system"  (literal at bundle.js:+11177526)

    // Render a JSX response element via Bf.createElement
    // (call edge DV7 → Bf.createElement at bundle.js:+11177595)
    uiElement = createElement(responseComponent, message)

    // Dispatch as control-request (thinClientDispatch field)
    dispatchControlRequest(message)

    // Optionally introduce a randomised delay before resolving
    // (call edges DV7 → H → Math.random at bundle.js:+14012782
    //              H → setTimeout      at bundle.js:+14012819)
    await randomisedDelay(Math.random() * 2 + 1)
        // numeric literals: 2 (bundle.js:+14012780), 1 (bundle.js:+14012796)

    return uiElement
```

### Config Persistence Subsystem (`E8` / `Q78` / `G7H`)

The handler calls the config-persistence layer (`E8` at bundle.js:+11177549) to persist any side-effect state. This chain reaches the file-based config writer (`Q78`) and, transitively, the backup-safe atomic writer (`G7H`).

Analysis basis: CC v2.1.173 bundle.js:+11177549

```
function persistConfig(configState):
    acquireLock(configLockFile)
        // On contention: emits telemetry tengu_config_lock_contention
        // Warning string: "Lock acquisition took longer than expected…"
        //   (bundle.js:+3312410)

    existingConfig = readConfigFromDisk()

    if existingConfig.auth is present AND cachedConfig.auth is missing:
        // Safety guard: refuse to overwrite auth — see GH #3117
        // (bundle.js:+3312826)
        emitTelemetry("tengu_config_stale_write")
        emitTelemetry("tengu_config_auth_loss_prevented")
        releaseLock()
        return error

    atomicWrite(configState)
        // Uses backup rotation under "backups/" subdirectory
        // (literal at bundle.js:+3314011)
        // Backup file-mode: 384 (0o600) (bundle.js:+3313711)
        // Stale backup window: 60000 ms (bundle.js:+3313180)
        // Maximum backup count retained: 5 (bundle.js:+3313429)

    releaseLock()
```

### Randomised Delay Helper (`H`)

Analysis basis: CC v2.1.173 bundle.js:+14012782

```
async function randomisedDelay(baseMultiplier):
    // Avoids thundering-herd patterns when multiple side questions
    // are dispatched in rapid succession.
    delay = Math.random() * baseMultiplier + 1
        // baseMultiplier literal: 2 (bundle.js:+14012780)
        // addend literal:         1 (bundle.js:+14012796)
    await setTimeout(delay)
```

### Message Builder (`N`) — System-Role Message Construction

Analysis basis: CC v2.1.173 bundle.js:+210504

```
function buildSystemMessage(questionText):
    // Normalisation pipeline:
    normalized = questionText.trim()
        // bundle.js:+210629
    normalized = normalized.toUpperCase() if needed
        // bundle.js:+210606
    normalized = redactSensitiveSegments(normalized)
        // "[REDACTED]" placeholder literal at bundle.js:+201957

    // Serialize to JSON for transport
    payload = JSON.stringify({ role: "system", content: normalized })
        // bundle.js:+188969

    // Size guard: 1000-character and 100-character thresholds
    // (literals at bundle.js:+210311 and bundle.js:+210330)

    return payload
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_config_lock_contention` | Fired when the config file lock takes longer than expected (bundle.js:+3312499) |
| Telemetry — `tengu_config_stale_write` | Fired when a write is attempted but the on-disk config is stale (bundle.js:+3312635) |
| Telemetry — `tengu_config_parse_error` | Fired when the config file cannot be parsed (bundle.js:+3315074) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a write is blocked to protect existing auth credentials (bundle.js:+3312978) |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Background-session escalation to SIGKILL (bundle.js:+16760584) |
| Telemetry — `tengu_bg_dispatch_low_mem` | Background dispatch blocked due to low memory (bundle.js:+16761185) |
| Telemetry — `tengu_bg_spare_enable` | Spare background session enabled (bundle.js:+16761889) |
| Telemetry — `tengu_bg_spare_claim` | Spare background session claimed (bundle.js:+16762017) |
| Telemetry — `tengu_bg_spare_claim_fail` | Spare background session claim failed (bundle.js:+16762283) |
| Telemetry — `tengu_bg_proto_mismatch` | Background protocol version mismatch (bundle.js:+16747275) |
| Telemetry — `tengu_bg_dispatch_stale_drop` | Stale dispatch message dropped in background (bundle.js:+16748643) |
| Telemetry — `tengu_bg_attach_legacy_autorespawn` | Legacy client triggered auto-respawn on attach (bundle.js:+16751297) |
| Telemetry — `tengu_bg_attach` | Background session attach event (bundle.js:+16752455) |
| Telemetry — `tengu_bg_attach_stall_gave_up` | Background attach stalled and gave up (bundle.js:+16753378) |
| Telemetry — `tengu_bg_attach_stall_respawn` | Background attach stalled and triggered respawn (bundle.js:+16753648) |
| Telemetry — `tengu_bg_attach_kick` | Background session kicked (bundle.js:+16754598) |
| Hook registration | Dispatched as `control-request` via thin-client path (registration field) |
| appState changes | Injects a `system`-role message into the conversation context without creating a user turn (bundle.js:+11177526) |
| File I/O | Config atomic write with lock, backup rotation (up to 5 backups), file-mode 0o600 (bundle.js:+3313429, +3313711) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.173 | Initial analysis |

---

## Common Mistakes

1. **Omitting the argument** — running `/btw` with no text returns the usage hint `"Usage: /btw <your question>"` and does nothing further. Always supply a question as the argument.
2. **Expecting a user-turn message** — `/btw` injects a `system`-role message, not a user-role turn. Downstream tools or conversation exports that filter by role may not see the side question in the user message list.
3. **Assuming synchronous execution** — the handler is an `AsyncFunction` (`DV7`) and introduces a randomised delay before resolving; callers should not assume the response is immediate even though `immediate: true` controls when the command is _triggered_.
4. **Confusing thin-client dispatch with a full agent invocation** — the `thinClientDispatch: "control-request"` setting means this command bypasses the normal agent pipeline; it cannot be used to trigger tool calls or file edits as a side question.
5. **Triggering during a config write lock** — if another Claude Code instance is running concurrently and holds the config lock, the command's config persistence step may be delayed, which can manifest as unexpected latency.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `DV7` | Main async handler for `/btw` command (entry point resolved via `module_id` → `Qlq`) |
| `H` | Randomised delay helper; calls `Math.random` and `setTimeout` |
| `E8` | Config persistence orchestrator; calls `Q78` and related helpers |
| `Q78` | File-based config writer; handles lock acquisition, backup rotation, atomic write |
| `_` | Filesystem utility (readdirStringSync, statSync, etc.) |
| `o6` | Path resolution / existence check helper |
| `f` | File I/O wrapper (statSync, mkdirSync, copyFileSync, unlinkSync, etc.) |
| `q` | Secondary file I/O wrapper (readFileSync, mkdirSync, readdirStringSync, etc.) |
| `L` | Stream/connection lifecycle manager (close, finally) |
| `UV1` | Config object constructor; uses `Object.assign` and `lY_` |
| `lY_` | Config field initialiser; calls `pV1` |
| `N` | System-message builder; normalises, redacts, and JSON-serialises the question |
| `d8f` | Message-construction sub-helper; calls `th`, `xs8`, `RZA` |
| `CH` | JSON serialiser wrapper (`JSON.stringify`) |
| `lf` | Text-segment processor; handles replace, slice, lastIndexOf operations |
| `oFH` | Formatting helper; calls `tvA` |
| `i8f` | File write helper; handles mkdirSync, Buffer.byteLength, async write pipeline |
| `c` | General utility / conditional helper |
| `N8` | Error/status code helper |
| `G7H` | Backup-safe atomic config writer; manages backup rotation and copy |
| `n6` | JSON parser wrapper (`JSON.parse`) |
| `bu` | String prefix stripper (`startsWith` / `slice`) |
| `C_9` | Backup directory scanner; uses readdirStringSync and path joins |
| `GZ_` | Backup path builder; joins path and calls `A_` |
| `D` | Background daemon session manager (spawn, kill, SIGKILL, spare sessions) |
| `urH` | Auth-loss guard; checks re-read config for auth field |
| `A` | Locale/case normaliser (`toLowerCase`) |
| `V` | Backup filename prefix checker (`startsWith`) |
| `P` | IPC/socket message framer (Buffer.concat, indexOf, subarray) |
| `X` | Socket timeout manager; calls `M` and `q.setTimeout` |
| `j` | Process group kill helper (`A.values`, `S.kill`) |
| `I7` | Stream end/flush helper; calls `H.end` and `CH` |
| `p05` | Background session protocol handler (attach, resize, respawn, dispatch, etc.) |
| `EH` | String coercion wrapper (`String`) |
| `E` | Slice/range utility with `Math.max` / `Math.min` guards |
| `W` | SDK connection manager (connect, reconnect, Promise.all) |
| `Cz6` | Atomic file write with temp-rename; uses randomBytes, fchmodSync, fsyncSync |
| `O` | Stream event emitter wrapper (on, once, removeAllListeners, destroy) |
| `R8` | Error normaliser; calls `N8` |
| `AJH` | Argument/hint parser helper |
| `R_9` | Object entries iterator helper |
| `u26` | Timestamp utility (`Date.now`) |
| `g78` | Global config save fallback; logs auth-loss warning and calls `Cz6` |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.