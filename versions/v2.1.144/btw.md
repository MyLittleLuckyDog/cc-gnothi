---
type: feature-spec
feature: "btw"
cc_version: "2.1.144"
updated: "2026-06-01"
tags: ["btw", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.144 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/btw`

> Analysis basis: CC v2.1.144 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.144

---

## Overview

`/btw` ("by the way") allows users to ask a quick side question without interrupting or derailing the main conversation thread. The command dispatches a `control-request` to the thin client, injecting a system-role message into the active session so that the agent addresses the side question inline without losing conversational context. It is implemented as an `AsyncFunction` (`cz7`) that immediately renders a JSX response component.

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
| module_id | `PKq` |
| load_inline | `true` |
| loc_byte | `10084233` |
| loc_byte_end | `10084472` |
| loc_line | `5591` |
| arbor_handler.name | `cz7` |
| arbor_handler.fqn | `claude-2.1.144::cz7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.144 bundle.js:+10084233

---

## Input Branching

The command has two distinct input branches: the user either provides a question argument or omits it entirely. A simple numbered pseudocode representation is sufficient.

1. **No argument supplied** — the handler detects an empty or missing argument and returns a usage hint: `"Usage: /btw <your question>"` (Analysis basis: CC v2.1.144 bundle.js:+10083831).
2. **Argument supplied** — the handler proceeds to construct a `system`-role message wrapping the question and dispatches it as a `control-request` through the thin client layer, then renders a JSX confirmation element via `createElement`.

---

## Behavioral Spec

### Top-level handler (`cz7`)

```
async function btwCommandHandler(context, userArgument):

    // Branch 1: guard against missing input
    if userArgument is empty or whitespace:
        display usageHint("Usage: /btw <your question>")
        return

    // Branch 2: build and dispatch the side-question request
    systemMessage = buildSystemMessage(userArgument)   // role: "system"
    dispatchControlRequest(systemMessage)              // via thinClientDispatch

    // Render inline JSX feedback element
    return createElement(InlineResponseComponent, { message: systemMessage })
```

Analysis basis: CC v2.1.144 bundle.js:+10083829 – +10083939

---

### Usage-hint guard (`H`)

Called immediately from `cz7` when the argument is absent.

```
function emitUsageHint(context):
    // Generates a random display delay between 1 and 2 units
    delay = Math.random() * (2 - 1) + 1
    setTimeout(() => display("Usage: /btw <your question>"), delay)
```

Analysis basis: CC v2.1.144 bundle.js:+10083829 (call edge `cz7→H`), +12668349 (numeric literals 2, 1), +12668388 (`setTimeout`)

---

### Session / config write path (`t6`, `K9_`)

`cz7` calls the session-persistence helper (`t6`) which in turn invokes the config-lock-write routine (`K9_`). This path ensures that any state changes induced by the side question (e.g., updated conversation metadata) are durably saved.

```
async function persistSessionState(sessionData):
    acquireConfigLock()                    // K9_ → L.mkdirSync lock dir
    currentConfig = readCurrentConfig()    // V$H → q.readFileSync (utf-8)
    mergedConfig  = mergeWithCache(currentConfig)

    if mergedConfig is missing auth that cache holds:
        emitTelemetry("tengu_config_auth_loss_prevented")
        abort write  // safety guard — see GH #3117

    writeConfigAtomically(mergedConfig)    // temp file → rename
    releaseConfigLock()
```

Analysis basis: CC v2.1.144 bundle.js:+10083893 (call edge `cz7→t6`), +3161889 (call edge `t6→K9_`), +3164587–+3164963 (lock/read/stat calls inside `K9_`), +3165214 (GH #3117 guard literal)

---

### Config file write safety (`V$H`)

```
function writeConfigWithBackup(configPath, data):
    if not configAccessAllowed():
        throw Error("Config accessed before allowed.")

    backupDir = join(configPath, "backups")
    existingBackups = readdirStringSync(backupDir)

    // Keep at most 5 rolling backups
    if existingBackups.length >= 5:
        oldest = selectOldest(existingBackups)
        unlinkSync(oldest)

    backupName = basename(configPath) + ".backup." + Date.now()
    copyFileSync(configPath, join(backupDir, backupName))

    tempPath  = join(dirname(configPath), randomHex() + ".tmp")
    writeFileSync(tempPath, JSON.stringify(data), "utf-8")
    renameSync(tempPath, configPath)
```

Analysis basis: CC v2.1.144 bundle.js:+3166831 ("Config accessed before allowed."), +3166887 (`q.readFileSync`), +3166914 ("utf-8"), +3167958 (`Date.now`), +3167976 (`q.copyFileSync`), +3165684 (".backup." literal), +3165817 (limit: 5 backups)

---

### Symlink-safe atomic write (`aA6`)

Used internally by the config-write path to resolve and honour symlinks before writing.

```
function atomicWriteFollowingSymlinks(targetPath, content, mode):
    resolvedPath = resolveSymlinks(targetPath)     // readlinkSync + resolve
    tempPath     = join(dirname(resolvedPath),
                        randomBytes(6).toString("hex") + ".tmp")

    fd = openSync(tempPath, flags)
    writeFileSync(fd, content)
    fchmodSync(fd, mode)                           // preserve original permissions
    fsyncSync(fd)
    closeSync(fd)

    renameSync(tempPath, resolvedPath)
    // On error: unlinkSync(tempPath)
```

Analysis basis: CC v2.1.144 bundle.js:+1000840 (`readlinkSync`), +1001465 (`randomBytes`), +1001481 (length: 6 bytes), +1001493 ("hex"), +1001901 (`writeFileSync`), +1001959 (`fchmodSync`), +1001980 ("Applied original permissions to temp file"), +1002025 (`fsyncSync`), +1002153 (`renameSync`)

---

### Background daemon interaction (`w`)

The `thinClientDispatch: "control-request"` path reaches the background session manager, which handles memory pressure and process lifecycle.

```
function backgroundSessionDispatch(request):
    if freeMemory() < threshold:
        emitTelemetry("tengu_bg_dispatch_low_mem")
        considerRetiring idleSessions

    session = acquireSpareOrCreate(request)
    // SIGKILL escalation if session does not terminate in 30 s (warn at 15 s)
    scheduleKillEscalation(session, warnAfterMs=15000, killAfterMs=30000)
```

Analysis basis: CC v2.1.144 bundle.js:+14542089 (30 s literal), +14542100 (15 s literal), +14542182 ("SIGKILL"), +14542543 (`nE8.freemem`), +14542444 ("daemon_bg_session_create"), +14542713 (`tengu_bg_dispatch_low_mem`)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_config_lock_contention` | Emitted when the config lock takes longer than expected (another Claude instance may be running). Analysis basis: CC v2.1.144 bundle.js:+3164887 |
| Telemetry — `tengu_config_stale_write` | Emitted on a detected stale write condition. Analysis basis: CC v2.1.144 bundle.js:+3165023 |
| Telemetry — `tengu_config_parse_error` | Emitted when config JSON fails to parse. Analysis basis: CC v2.1.144 bundle.js:+3167468 |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Emitted when a background session requires SIGKILL escalation. Analysis basis: CC v2.1.144 bundle.js:+14542134 |
| Telemetry — `tengu_bg_dispatch_low_mem` | Emitted when free memory falls below threshold during dispatch. Analysis basis: CC v2.1.144 bundle.js:+14542713 |
| Telemetry — `tengu_bg_spare_enable` | Emitted when a spare background session slot is enabled. Analysis basis: CC v2.1.144 bundle.js:+14543352 |
| Telemetry — `tengu_bg_spare_claim` | Emitted when a spare session is successfully claimed. Analysis basis: CC v2.1.144 bundle.js:+14543473 |
| Telemetry — `tengu_bg_spare_claim_fail` | Emitted when claiming a spare session fails. Analysis basis: CC v2.1.144 bundle.js:+14543736 |
| Telemetry — `tengu_config_auth_loss_prevented` | Emitted when a write is aborted to prevent erasing auth credentials. Analysis basis: CC v2.1.144 bundle.js:+3165366 |
| thinClientDispatch | Sends a `control-request` to the thin client layer to inject a system message into the active conversation. |
| Config file | May trigger a config read-modify-write cycle with file locking and rolling backup (max 5 backups). |
| appState changes | Session metadata may be updated; conversation context is preserved — side question does not reset the main thread. |
| JSX render | Returns a `createElement`-based inline element confirming the side question was dispatched. Analysis basis: CC v2.1.144 bundle.js:+10083939 |
| Sound | None observed in depth-2 traversal. |
| `immediate: true` | The command fires without waiting for the user to submit a separate confirmation step. |

---

## Version History

| Version | Change |
|---|---|
| v2.1.144 | Initial analysis |

---

## Common Mistakes

1. **Omitting the question argument** — `/btw` with no text returns only the usage hint (`Usage: /btw <your question>`) and does nothing else. Always supply the question inline, e.g. `/btw what does this function return?`.
2. **Expecting a new conversation thread** — `/btw` injects the question into the *current* session as a system-role message. It does not start a new conversation or fork the context.
3. **Conflating `/btw` with a user-turn question** — because the message role is `"system"`, the agent treats it with higher priority than a regular user utterance, which may produce a different response style than typing the question directly.
4. **Using `/btw` for long multi-part queries** — the command is designed for *quick* side questions. Complex queries that need their own context are better served by starting a fresh session.
5. **Assuming the command is synchronous** — `cz7` is an `AsyncFunction`; the control-request dispatch and any config writes happen asynchronously. Rapid successive `/btw` calls may encounter config-lock contention (`tengu_config_lock_contention`).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `cz7` | Main `/btw` command handler (`AsyncFunction`; Arbor-resolved entry point) |
| `H` | Usage-hint emitter; also used as a generic utility with `Math.random` / `setTimeout` |
| `t6` | Session-state persistence coordinator (calls config-lock write path) |
| `K9_` | Config lock acquisition and atomic config write orchestrator |
| `_` | Filesystem utility (various sync calls: `statSync`, `readdirStringSync`) |
| `m6` | Path/module resolution helper |
| `L` | Locking file-system layer (mkdirSync, statSync, copyFileSync, unlinkSync, readdirStringSync) |
| `q` | Secondary filesystem interface (readFileSync, statSync, mkdirSync, readdirStringSync, copyFileSync, renameSync, unlinkSync, etc.) |
| `f` | Promise/stream finaliser (close, finally chain) |
| `UH1` | Config object merge helper (calls `Object.assign`) |
| `Yo8` | Config pre-merge transformer |
| `v` | HTTP/request construction utility (builds request objects with headers, body) |
| `vfK` | Request body formatter (calls `IV`, `IfK`, `YHA`) |
| `CH` | JSON serialisation wrapper (`JSON.stringify`) |
| `x4` | String/path manipulation helper (replace, slice, lastIndexOf) |
| `YhH` | Auxiliary string transformer |
| `yfK` | File-content streaming helper (Buffer.byteLength, KN6.then, kfK.bind) |
| `d` | Generic data/state accessor |
| `A8` | Error or assertion utility |
| `V$H` | Config file read-backup-write routine |
| `b6` | JSON parse wrapper |
| `TR` | String prefix stripper (startsWith + slice) |
| `GV1` | Directory listing and backup selection helper |
| `kH` | Error logging and push helper (Sc.logError, HCH.push) |
| `L9_` | Backup path join helper |
| `w` | Background session / daemon process manager |
| `w56` | Auxiliary write or signal helper |
| `A` | Lowercase conversion / session map accessor |
| `V` | String prefix checker in config context |
| `P` | MCP / SDK connection manager (Promise.all, spawn) |
| `bE8` | Connection attempt helper |
| `b_` | Error constructor wrapper |
| `Z` | Array/slice utility for backup rotation |
| `aA6` | Symlink-safe atomic file write routine |
| `O` | File stat / symbolic-link checker |
| `O8` | Error-code checker |
| `PpH` | Session parameter builder |
| `WV1` | Object entries iterator for session data |
| `WpH` | Timestamp recorder (`Date.now`) |
| `q9_` | Config directory path resolver (dirname, join, aA6) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.