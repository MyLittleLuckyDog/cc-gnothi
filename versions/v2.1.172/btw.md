---
type: feature-spec
feature: "btw"
cc_version: "2.1.172"
updated: "2026-06-11"
tags: ["btw", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.172 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/btw`

> Analysis basis: CC v2.1.172 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.172

---

## Overview

`/btw` ("by the way") allows the user to pose a quick side question to the agent without disrupting the flow of the main conversation. The command is typed immediately — it dispatches via the `control-request` thin-client pathway — and injects the question as a system-role message rather than a user-turn message, keeping the primary dialogue context intact.

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
| module_id | `Flq` |
| load_inline | `true` |
| loc_byte | 11177315 |
| loc_byte_end | 11177554 |
| loc_line | 7329 |
| **arbor_handler.name** | `zV7` |
| **arbor_handler.fqn** | `claude-2.1.172::zV7` |
| **arbor_handler.kind** | `AsyncFunction` |
| **arbor_handler.resolution_path** | `module_id` |
| **arbor_handler.n_hits** | 0 |
| `arbor_handler.name` | `zV7` |
| `arbor_handler.kind` | `AsyncFunction` |
| `arbor_handler.resolution_path` | `module_id` |
| `arbor_handler.fqn` | `claude-2.1.172::zV7` |
| `arbor_handler.n_hits` | `0` |

Analysis basis: CC v2.1.172 bundle.js:+11177315

---

## Input Branching

The command has two distinct top-level branches (argument present vs. absent), so numbered pseudocode is used.

1. **No argument supplied** — the handler detects an empty or missing `<question>` argument and returns the usage hint string `"Usage: /btw <your question>"` (bundle.js:+11176908) to the user without contacting the model.
2. **Argument supplied** — the handler proceeds through the full dispatch path: it builds a system-role message, resolves the configuration/session context via the config-read sub-system, and forwards the question through the `control-request` channel.

```
async function handleBtw(userInput):
    if userInput is empty or missing:
        display "Usage: /btw <your question>"
        return

    questionText = userInput.trim()

    // Build a synthetic system-scoped side-question message
    message = buildMessage(role="system", content=questionText)
    // bundle.js:+11176947

    // Ensure configuration is available (may acquire file lock)
    config = await readConfig()          // resolves via configReadSubsystem (E8)

    // Dispatch to the agent through the control-request channel
    // (immediate: true — no queuing delay)
    response = await dispatchControlRequest(message, config)

    // Render the response as a JSX element in the CLI pane
    return Bf.createElement(responseView, response)
    // bundle.js:+11177016
```

Analysis basis: CC v2.1.172 bundle.js:+11176906, +11176947, +11176970, +11177016

---

## Behavioral Spec

### Handler Entry Point (`zV7`)

The Arbor-resolved handler `zV7` is an `AsyncFunction` reached via the `module_id` resolution path through module `Flq`.

```
async function btwHandler(context, args):
    // Step 1 — guard: require a non-empty argument
    if args.question is absent:
        return usageMessage("Usage: /btw <your question>")
        // bundle.js:+11176908

    // Step 2 — inject question as a "system" role message
    //          (not as a user turn, preserving conversation continuity)
    sideMessage = { role: "system", content: args.question }
    // bundle.js:+11176947

    // Step 3 — read current configuration (may block on file lock)
    config = await configReadPipeline(context)
    // bundle.js:+11176970

    // Step 4 — render result via React JSX element
    return createElement(sideQuestionResponseView, { message: sideMessage, config })
    // bundle.js:+11177016
```

### Config-Read Pipeline (`E8` / `configReadPipeline`)

Called from the handler at bundle.js:+11176970. This sub-system coordinates config file access including lock acquisition, backup management, and parse error recovery.

```
async function configReadPipeline(context):
    acquire file lock (configFileLock)
    // contention logged as telemetry: tengu_config_lock_contention

    try:
        raw = fs.readFileSync(configPath, encoding="utf-8")
        parsed = jsonSafeParse(raw)       // via jsonSafeParse helper
        if parsed is invalid:
            emit telemetry: tengu_config_parse_error
            fall back to cached config
        return parsed
    finally:
        release file lock
```

Analysis basis: CC v2.1.172 bundle.js:+3308889, +3308945, +3308964

### Config-Write / Save-With-Lock (`F78` / `saveConfigWithLock`)

Reached transitively from `configReadPipeline` when a configuration write is required (e.g., session state update). Key safety guard: if the re-read config is missing authentication data that the in-memory cache holds, the write is aborted to prevent wiping credentials (see literal at bundle.js:+3312459, referenced in GH #3117).

```
function saveConfigWithLock(newConfig, cachedConfig):
    // Safety: never overwrite if auth would be lost
    if cachedConfig.hasAuth AND NOT newConfig.hasAuth:
        emit telemetry: tengu_config_auth_loss_prevented
        log warning: "saveConfigWithLock: re-read config is missing auth..."
        return WITHOUT writing

    // Acquire lock with timeout
    lockAcquired = acquireLock(configLockPath)
    if NOT lockAcquired within timeout:
        emit telemetry: tengu_config_lock_contention
        log error: "Lock acquisition took longer than expected..."
        // bundle.js:+3312043

    // Backup rotation (keep up to 5 backups)
    rotateBackups(configDir, maxBackups=5)
    // bundle.js:+3313062

    // Atomic write via temp file + rename
    tmpPath = configPath + ".tmp." + Date.now()
    fs.writeFileSync(tmpPath, JSON.stringify(newConfig))
    fs.renameSync(tmpPath, configPath)

    release lock
```

Analysis basis: CC v2.1.172 bundle.js:+3311832, +3312043, +3312130, +3312193, +3312459

### Jitter Helper (`H` / `jitterDelay`)

Called from `zV7` at bundle.js:+11176906. Introduces a small randomised delay (using `Math.random` with a multiplier of 2 and an additive base of 1) before certain operations, likely to avoid thundering-herd contention on config files when multiple Claude instances start simultaneously.

```
async function jitterDelay():
    delayMs = Math.floor(Math.random() * 2 + 1)   // range [1, 2]
    // bundle.js:+14012201, +14012217
    await setTimeout(delayMs)
```

Analysis basis: CC v2.1.172 bundle.js:+11176906, +14012201, +14012217, +14012240

### Message Construction (`N` / `buildSystemMessage`)

Constructs the envelope sent through the control-request channel. The role is fixed to `"system"` (bundle.js:+11176947). Content is trimmed (bundle.js:+210629) and, in debug mode (literal `"debug"` at bundle.js:+210480), certain fields are redacted (literal `"[REDACTED]"` at bundle.js:+201957).

```
function buildSystemMessage(text, options):
    trimmed = text.trim()
    role = "system"
    if options.debug:
        trimmed = "[REDACTED]"    // sanitise for debug logs

    return { role, content: trimmed }
```

Analysis basis: CC v2.1.172 bundle.js:+210504, +210544, +210606, +210629

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — config lock contention | `tengu_config_lock_contention` (bundle.js:+3312132) — emitted when file lock acquisition exceeds expected time |
| Telemetry — stale write prevented | `tengu_config_stale_write` (bundle.js:+3312268) |
| Telemetry — auth loss prevented | `tengu_config_auth_loss_prevented` (bundle.js:+3312611) — safety guard per GH #3117 |
| Telemetry — config parse error | `tengu_config_parse_error` (bundle.js:+3314707) |
| Telemetry — bg dispatch SIGKILL escalation | `tengu_bg_dispatch_sigkill_escalate` (bundle.js:+16759925) — background session management |
| Telemetry — bg dispatch low memory | `tengu_bg_dispatch_low_mem` (bundle.js:+16760526) |
| Telemetry — bg spare session enable | `tengu_bg_spare_enable` (bundle.js:+16761230) |
| Telemetry — bg spare session claim | `tengu_bg_spare_claim` (bundle.js:+16761358) |
| Telemetry — bg spare session claim failure | `tengu_bg_spare_claim_fail` (bundle.js:+16761624) |
| Telemetry — bg protocol mismatch | `tengu_bg_proto_mismatch` (bundle.js:+16746616) |
| Telemetry — bg dispatch stale drop | `tengu_bg_dispatch_stale_drop` (bundle.js:+16747984) |
| Telemetry — bg attach legacy auto-respawn | `tengu_bg_attach_legacy_autorespawn` (bundle.js:+16750638) |
| Telemetry — bg attach | `tengu_bg_attach` (bundle.js:+16751796) |
| Telemetry — bg attach stall gave up | `tengu_bg_attach_stall_gave_up` (bundle.js:+16752719) |
| Telemetry — bg attach stall respawn | `tengu_bg_attach_stall_respawn` (bundle.js:+16752989) |
| Telemetry — bg attach kick | `tengu_bg_attach_kick` (bundle.js:+16753939) |
| Dispatch channel | `control-request` (thin-client path; `thinClientDispatch` field) |
| Message role | Injected as `"system"` role, not as a user turn (bundle.js:+11176947) |
| Config file I/O | May acquire file lock on `~/.claude.json`; performs backup rotation (up to 5 backups) |
| Config backup directory | `backups/` subdirectory adjacent to config file (bundle.js:+3313644) |
| JSX rendering | Calls `Bf.createElement` to render the response pane (bundle.js:+11177016) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.172 | Initial analysis |

---

## Common Mistakes

1. **Forgetting the argument**: `/btw` with no text returns only the usage hint (`"Usage: /btw <your question>"`); the model is never contacted.
2. **Expecting a user-turn response**: Because the question is injected with `role: "system"`, it does not appear as a normal conversational exchange — downstream tooling that filters on `role: "user"` will not see it.
3. **Conflating `/btw` with a regular prompt**: `/btw` is `immediate: true` and routes through `control-request`, bypassing the normal input queue; firing it during a long-running agent task may interleave with in-flight operations.
4. **Assuming config writes are always safe**: If the in-memory auth cache disagrees with the on-disk config, the write is silently aborted (GH #3117 guard). Users who observe lost settings should check for concurrent Claude instances holding the config lock.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `zV7` | Main handler (`AsyncFunction`) for `/btw` — Arbor-resolved entry point |
| `H` | Jitter delay helper (uses `Math.random` + `setTimeout`) |
| `E8` | Config-read pipeline coordinator |
| `F78` | Save-config-with-lock function (atomic write + backup rotation) |
| `_` | Filesystem abstraction / virtual-fs wrapper |
| `o6` | Path normalisation / resolution utility |
| `f` | Primary filesystem module reference |
| `q` | Secondary filesystem / queue module reference |
| `L` | Session / connection lifecycle manager |
| `mV1` | Message envelope builder (calls `dY_`, `Object.assign`) |
| `dY_` | Message field initialiser |
| `N` | System-message constructor (role, trim, redact) |
| `g8f` | Message formatting helper |
| `CH` | JSON stringify wrapper |
| `lf` | Content truncation / last-index utility |
| `rFH` | Overflow/redaction helper (calls `ovA`) |
| `l8f` | Buffer-size / byte-length checker |
| `c` | Configuration cache accessor |
| `N8` | Error code / status normaliser |
| `W7H` | Config file reader with backup and directory management |
| `n6` | JSON safe-parse wrapper |
| `bu` | Prefix-strip utility (`startsWith` + `slice`) |
| `S_9` | Config directory scanner / backup lister |
| `XZ_` | Backup path joiner |
| `D` | Background-session / daemon process manager |
| `brH` | Auth-loss guard helper |
| `A` | Lowercase normalisation / general string helper |
| `V` | Filename / entry filter (uses `startsWith`) |
| `P` | IPC / socket transport layer |
| `X` | Socket read / timeout manager |
| `j` | Process kill / session teardown helper |
| `I7` | Stream end / flush helper |
| `x05` | Daemon message-dispatch router (handles all daemon message types) |
| `EH` | String coercion helper |
| `E` | Scroll / slice range calculator (`Math.max`, `Math.min`) |
| `W` | SDK connection manager |
| `Sz6` | Atomic file-write utility (temp file + rename, symlink-safe) |
| `O` | Symbolic-link / stat checker |
| `R8` | Error normaliser (wraps `N8`) |
| `HJH` | Session state initialiser |
| `y_9` | Object-entries iterator helper |
| `b26` | Timestamp/duration tracker (`Date.now`) |
| `B78` | Global-config fallback save helper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.