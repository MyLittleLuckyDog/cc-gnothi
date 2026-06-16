---
type: feature-spec
feature: "btw"
cc_version: "2.1.178"
updated: "2026-06-16"
tags: ["btw", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.178 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/btw`

> Analysis basis: CC v2.1.178 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.178

---

## Overview

`/btw` ("by the way") lets the user pose a quick side question to the model without disrupting the flow of the main conversation. It injects the question as a `system`-role message and dispatches it through the thin-client control-request channel, so the agent receives the aside immediately while the primary task context remains intact.

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
| module_id | `A8K` |
| load_inline | `true` |
| loc_byte | `11321393` |
| loc_byte_end | `11321632` |
| loc_line | `7246` |
| arbor_handler.name | `umL` |
| arbor_handler.fqn | `claude-2.1.178::umL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.178 bundle.js:+11321393

---

## Input Branching

Two distinct paths exist: the user either omits the question argument (usage error) or supplies a non-empty question (normal dispatch). Numbered pseudocode is sufficient.

1. **No argument / empty argument** — handler emits the usage string `"Usage: /btw <your question>"` (bundle.js:+11320986) and returns without calling the model.
2. **Non-empty question supplied** — handler builds a `system`-role message, delegates to the config persistence helper (`W8`), then renders a JSX confirmation element via `Af.createElement` (bundle.js:+11321094) and dispatches the request through the `control-request` thin-client channel.

---

## Behavioral Spec

### Main handler (`umL`)

```
async function btwHandler(args, appContext):

    question = args.trim()

    if question is empty:
        return displayUsage("Usage: /btw <your question>")
        // bundle.js:+11320986

    // Build a system-scoped aside message
    message = {
        role: "system",            // bundle.js:+11321025
        content: question
    }

    // Persist / propagate via the config write pipeline
    await saveConfigWithSideEffect(message, appContext)
    // callGraph: umL -> W8, bundle.js:+11321048

    // Render JSX acknowledgement element
    element = createElement(ConfirmationComponent, { question })
    // callGraph: umL -> Af.createElement, bundle.js:+11321094

    return element
```

### Config write pipeline (`W8` → `wO8`)

```
async function saveConfigWithSideEffect(message, context):

    // Acquire file-system lock (wO8 -> f.mkdirSync + Date.now)
    // bundle.js:+3348639 / +3348684
    lock = acquireConfigLock()

    if lock contention detected:
        emitTelemetry("tengu_config_lock_contention")
        // bundle.js:+3348912
        warn("Lock acquisition took longer than expected…")
        // bundle.js:+3348823

    // Re-read config to check for auth loss before writing
    // bundle.js:+3345800
    freshConfig = readConfig()

    if freshConfig is missing auth that cache holds:
        emitTelemetry("tengu_config_auth_loss_prevented")
        // bundle.js:+3349391
        log("saveGlobalConfig fallback: re-read config is missing auth…")
        // bundle.js:+3345800
        return  // refuse to write

    // Write config with atomic rename pattern (ED6)
    // bundle.js:+3348349
    atomicWriteConfig(freshConfig)

    // Maintain rolling backup set (up to 5 backups)
    // bundle.js:+3349842
    rotateBackups()

    // Emit fallback-write telemetry when stale write detected
    if staleWrite:
        emitTelemetry("tengu_config_stale_write")
        // bundle.js:+3349048
        emitTelemetry("tengu_config_fallback_write")
        // bundle.js:+3348528

    releaseLock()
```

### Atomic file write (`ED6`)

```
function atomicWriteConfig(path, content):

    // Generate random hex suffix for temp file
    // wL_.randomBytes -> hex, bundle.js:+1093841 / +1093869
    tempPath = path + "." + randomHex(8)

    // Write, chmod to match original, fsync, then rename
    // bundle.js:+1094277 / +1094335 / +1094401 / +1094529
    writeFileSync(tempPath, content)
    fchmodSync(tempPath, originalPermissions)
    fsyncSync(tempPath)
    renameSync(tempPath, path)

    // On ELOOP / ENOTDIR follow symlinks
    // bundle.js:+1093498 / +1093511
    if symlinkDetected:
        resolveSymlink(path)
```

### Config parse helper (`_MH`)

```
function readConfigFromDisk(path):

    if configAccessedBeforeAllowed:
        throw Error("Config accessed before allowed.")
        // bundle.js:+3350856

    raw = readFileSync(path, "utf-8")
    // bundle.js:+3350912 / +3350939

    parsed = jsonParse(raw)

    if parseError:
        emitTelemetry("tengu_config_parse_error")
        // bundle.js:+3351487

    // Backup the file before mutation
    // bundle.js:+3351656 / +3351666
    backupDir = join(configDir, "backups")
    mkdirSync(backupDir, { recursive: true })
    copyFileSync(path, join(backupDir, basename + "." + Date.now()))

    return parsed
```

### Jitter helper (`H`)

```
function randomJitter(baseMs):
    // Values: multiplier range [1, 2], bundle.js:+14211632 / +14211648
    factor = Math.random() * (2 - 1) + 1
    return new Promise(resolve => setTimeout(resolve, baseMs * factor))
    // bundle.js:+14211671
```

Analysis basis: CC v2.1.178 bundle.js:+11320984 – +11321094

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_config_lock_contention` | Fired when config lock acquisition stalls (bundle.js:+3348912) |
| Telemetry — `tengu_config_stale_write` | Fired when a stale config write is detected (bundle.js:+3349048) |
| Telemetry — `tengu_config_fallback_write` | Fired on fallback config write path (bundle.js:+3348528) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a write is refused to avoid wiping auth (bundle.js:+3349391) |
| Telemetry — `tengu_config_parse_error` | Fired when config JSON cannot be parsed (bundle.js:+3351487) |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Background session SIGKILL escalation (bundle.js:+17066047) |
| Telemetry — `tengu_bg_dispatch_low_mem` | Low-memory condition in background dispatch (bundle.js:+17066648) |
| Telemetry — `tengu_bg_spare_enable` | Spare background session enabled (bundle.js:+17067352) |
| Telemetry — `tengu_bg_spare_claim` | Spare session successfully claimed (bundle.js:+17067480) |
| Telemetry — `tengu_bg_spare_claim_fail` | Spare session claim failed (bundle.js:+17067746) |
| Telemetry — `tengu_bg_proto_mismatch` | Protocol mismatch between client and daemon (bundle.js:+17051832) |
| Telemetry — `tengu_bg_dispatch_stale_drop` | Stale dispatch dropped (bundle.js:+17053231) |
| Telemetry — `tengu_bg_attach_legacy_autorespawn` | Legacy attach triggered auto-respawn (bundle.js:+17056119) |
| Telemetry — `tengu_bg_attach` | Background attach event (bundle.js:+17057277) |
| Telemetry — `tengu_bg_attach_stall_gave_up` | Attach stall — gave up (bundle.js:+17058200) |
| Telemetry — `tengu_bg_attach_stall_respawn` | Attach stall — triggered respawn (bundle.js:+17058470) |
| Telemetry — `tengu_bg_attach_kick` | Attach kicked existing session (bundle.js:+17059462) |
| thinClientDispatch | `control-request` — routes the question through the control plane, not the primary conversation channel |
| immediate | `true` — command executes without waiting for a pending agent turn to complete |
| Config file | Modified atomically via temp-file + rename (ED6); original permissions preserved via `fchmodSync` |
| Backup rotation | Up to 5 rolling backups written to `<configDir>/backups/` (bundle.js:+3349842) |
| Lock warning threshold | Fires warning and telemetry if lock contention is detected (bundle.js:+3348823) |
| Auth-loss guard | Refuses to write config if re-read copy lacks auth present in cache (bundle.js:+3345800, GH #3117) |
| JSX render | Renders a confirmation/acknowledgement component via `Af.createElement` (bundle.js:+11321094) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.178 | Initial analysis |

---

## Common Mistakes

1. **Omitting the question text** — `/btw` with no argument shows the usage hint (`"Usage: /btw <your question>"`) and does nothing else; always supply a non-empty string after the command.
2. **Expecting a context switch** — `/btw` injects a `system`-role message, not a user turn; it does not pause or restart the ongoing agent task.
3. **Assuming synchronous config writes** — the config pipeline is async with file-system locking. If another Claude instance is running simultaneously, lock contention may delay or skip the write.
4. **Ignoring auth-loss refusals** — if the on-disk config lost authentication credentials, the write is silently refused to protect credentials. Check `tengu_config_auth_loss_prevented` telemetry if config changes appear not to persist.
5. **Misreading `immediate: true`** — this flag means the command is dispatched without queuing behind the current conversation turn, not that the model response is instantaneous.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `umL` | Main handler for `/btw` (AsyncFunction); entry point resolved via module_id `A8K` |
| `H` | Random jitter / delay utility (uses `Math.random` + `setTimeout`) |
| `W8` | Config write orchestrator; called immediately after message construction |
| `wO8` | Low-level config persistence function (lock acquisition, backup rotation, atomic write) |
| `_` | Filesystem abstraction (used for `mkdirSync`, `readdirStringSync`, `statSync`) |
| `n6` | Path normalisation / resolution helper |
| `f` | Filesystem wrapper (queue-tracked file operations; `statSync`, `copyFileSync`, `unlinkSync`, etc.) |
| `q` | Secondary filesystem wrapper (readFileSync, mkdirSync, readdirStringSync, statSync, copyFileSync) |
| `L` | Async resource with `.finally`/`.close` lifecycle (cleanup wrapper) |
| `tR1` | Config object builder (calls `v2_` + `Object.assign`) |
| `v2_` | Base config value constructor (calls `sR1`) |
| `N` | Message formatter / API request builder (toUpperCase, trim, model header assembly) |
| `AM4` | Sub-formatter within `N`; handles model/provider selection |
| `xH` | JSON serialisation helper (wraps `JSON.stringify`) |
| `d4` | Content-part assembler (handles `[REDACTED]` replacement, slice, lastIndexOf) |
| `VdH` | Content wrapper utility (calls `FCA`) |
| `LM4` | HTTP/streaming request dispatcher (Buffer.byteLength, dirname, bind, xi6.then) |
| `d` | Generic deferred/promise utility |
| `Z8` | Error classification / status-code helper |
| `_MH` | Config file reader with parse error handling and backup creation |
| `i6` | JSON parse wrapper |
| `Rm` | String prefix-stripping utility (startsWith + slice) |
| `WL9` | Directory walker for config resolution (readdirStringSync, statSync, join) |
| `zk_` | Backup path builder (join + `M_` suffix helper) |
| `D` | Background session / daemon process manager |
| `JsH` | Config serialisation or journaling helper |
| `A` | Lowercase normalisation / map utility |
| `V` | Scroll/viewport geometry helper (Math.max, Math.floor, preventDefault) |
| `S` | Terminal supervisor writer (x14, RH, Ub5, Y.write) |
| `E` | Viewport clamp helper (Math.max, Math.min, W) |
| `P` | IPC/pipe protocol handler (Buffer.concat, indexOf, setTimeout, subarray) |
| `X` | Socket/connection with timeout (M, q.setTimeout) |
| `j` | Process group kill helper (A.values, S.kill) |
| `lL` | Stream-end helper (H.end + xH) |
| `Gb5` | Background session message-dispatch core (large; handles ping/nudge/yield/lease/attach/resize/snapshot/subscribe) |
| `TH` | String coercion helper |
| `ED6` | Atomic file writer (randomBytes, writeFileSync, fchmodSync, fsyncSync, renameSync) |
| `O` | Symbolic-link / stat result object |
| `x8` | Error wrapper (calls `Z8`) |
| `gXH` | Config context accessor used within `W8` |
| `PL9` | Object.entries iterator helper |
| `CG6` | Timestamp / change-detection helper (Date.now) |
| `YO8` | Config save path resolver (dirname, ED6) |
| `dH` | Logging/debug sink (calls `c36`) |
| `c36` | Low-level log emitter |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.