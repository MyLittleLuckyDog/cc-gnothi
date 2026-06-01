---
type: feature-spec
feature: "btw"
cc_version: "2.1.147"
updated: "2026-06-01"
tags: ["btw", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.147 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/btw`

> Analysis basis: CC v2.1.147 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.147

---

## Overview

`/btw` ("by the way") allows the user to pose a quick side question to the agent without disrupting the flow of the main conversation. It is a `local-jsx` command that dispatches a `control-request` immediately, injecting the question as a system-scoped message so the agent can address the aside and resume its primary task. Because the `immediate` flag is set, no input confirmation step is required before the request is sent.

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
| module_id | `c$1` |
| load_inline | `true` |
| loc_byte | `10493078` |
| loc_byte_end | `10493317` |
| loc_line | `8320` |
| arbor_handler.name | `PT7` |
| arbor_handler.fqn | `claude-2.1.147::PT7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.147 bundle.js:+10493078

---

## Input Branching

Two distinct branches exist: the user provides no argument (empty input) versus the user provides a non-empty question string. This is a simple 2-branch flow; numbered pseudocode is used.

1. User invokes `/btw` with no argument.
   - The handler detects an empty or absent `<question>` token.
   - Returns the usage hint string `"Usage: /btw <your question>"` to the UI without dispatching a request.
   - No agent turn is initiated.

2. User invokes `/btw <question>` with a non-empty argument.
   - The handler validates the argument is non-empty.
   - Constructs a `system`-role message containing the question text.
   - Dispatches a `control-request` via the `thinClientDispatch` mechanism immediately (`immediate: true`), bypassing any confirmation prompt.
   - The agent receives the aside and responds without resetting the main conversation context.
   - A JSX element is returned (via `createElement`) to render the result inline.

Analysis basis: CC v2.1.147 bundle.js:+10492675 (usage string), +10492714 (system role literal), +10492783 (createElement call)

---

## Behavioral Spec

### Handler Entry — `btwCommandHandler` (bundle: `PT7`)

```
async function btwCommandHandler(commandInput):
    question = commandInput.args.trim()

    if question is empty:
        return usageMessage("Usage: /btw <your question>")

    message = buildSystemMessage(question)         // role: "system"
    dispatchControlRequest(message)                // thinClientDispatch = "control-request"

    element = createElement(renderBtwResponse, message)
    return element
```

Analysis basis: CC v2.1.147 bundle.js:+10492673 (call to `H`), +10492737 (call to `M8`), +10492783 (`createElement`)

---

### Usage Guard — `usageGuard` (bundle: `H`)

The function `H` is invoked first within `btwCommandHandler`. Based on the usage-string literal and the call graph, this function is responsible for checking whether the argument is present and returning the usage hint when it is absent.

```
function usageGuard(args, usageString):
    // Uses Math.random and setTimeout internally — likely for
    // minor UI timing or jitter on the hint display
    if args is empty or null:
        scheduleDisplay(usageString, jitter=randomDelay(1, 2))
        return USAGE_HINT
    return null   // proceed to main logic
```

Analysis basis: CC v2.1.147 bundle.js:+10492673, +13143499 (`Math.random` with literal `2`), +13143513 (literal `1`), +13143536 (`setTimeout`)

---

### Config-Backed Context Loading — `configContextLoader` (bundle: `M8`)

`M8` is called immediately after the usage guard passes. Based on its callee graph, this function loads the persistent configuration context required to form the control request. It coordinates several sub-systems:

```
function configContextLoader(sessionState):
    globalConfig   = loadGlobalConfig()           // via k$H
    workspaceMap   = buildWorkspaceMap()           // via yy9 (Object.entries)
    timestamp      = captureTimestamp()            // via tUH (Date.now)
    normalizedPath = normalizePath(sessionState)   // via N
    backupIndex    = resolveBackupPaths()          // via HL_

    if globalConfig is missing or stale:
        logWarning("saveGlobalConfig fallback …")  // literal at +3182068
        return fallbackConfig

    return mergedConfig(globalConfig, workspaceMap, timestamp)
```

Analysis basis: CC v2.1.147 bundle.js:+10492737, +3181861 (`_L_`), +3181885 (`H`), +3181917 (`sUH`), +3181936 (`yy9`), +3181961 (`tUH`), +3181977 (`N`), +3182042 (`k$H`), +3182308 (`HL_`)

---

### Config File I/O — `configFileReader` (bundle: `k$H`)

This function handles low-level config file access, including lock contention, backup management, and parse error recovery.

```
function configFileReader(configPath):
    if configPath is not yet accessible:
        throw Error("Config accessed before allowed.")   // literal at +3186803

    rawBytes = readFileSync(configPath, encoding="utf-8")   // +3186886
    parsed   = parseJSON(rawBytes)                           // via B6 -> JSON.parse
    content  = stripBOM(parsed)                              // via OC

    if parseError:
        emitTelemetry("tengu_config_parse_error")           // +3187440
        return defaultConfig

    if backupNeeded:
        backupDir = resolveBackupDir()                      // via hy9, AL_
        ensureDir(backupDir)                                // mkdirSync, +3187619
        copyToBackup(configPath, backupDir, Date.now())     // +3187930, +3187948

    return parsed
```

Analysis basis: CC v2.1.147 bundle.js:+3186797 (`Error`), +3186803 (literal), +3186859 (`readFileSync`), +3186906 (`B6`), +3186909 (`OC`), +3187440 (telemetry)

---

### Config Lock Management — `configLockManager` (bundle: `_L_`)

Manages file-system locking around config writes to prevent races between concurrent Claude instances.

```
function configLockManager(configDir, operation):
    lockPath = join(dirname(configDir), lockFileName)   // UY.dirname + UY.join
    ensureParentDir(lockPath)                            // L.mkdirSync
    startTime = Date.now()

    acquired = attemptLockAcquire(lockPath)

    if not acquired within timeout:
        emitTelemetry("tengu_config_lock_contention")   // +3184859
        logError("Lock acquisition took longer than expected …")  // literal +3184770

    result = operation()

    if staleWriteDetected:
        emitTelemetry("tengu_config_stale_write")        // +3184995

    if authLossPrevented:
        emitTelemetry("tengu_config_auth_loss_prevented") // +3185338
        logWarning("saveConfigWithLock: re-read config is missing auth …")  // +3185186

    releaseLock(lockPath)
    return result
```

Analysis basis: CC v2.1.147 bundle.js:+3181861, +3184559, +3184565, +3184586, +3184631, +3184770, +3184859, +3184995, +3185338

---

### Message Dispatch — `controlRequestDispatcher` (bundle: `N`)

After configuration is resolved, `N` constructs and dispatches the actual `control-request` message to the agent.

```
function controlRequestDispatcher(question, config):
    role    = "system"                    // literal +10492714
    content = normalizeContent(question)  // _.toUpperCase, H.trim, H.includes

    if content contains sensitive token:
        content = "[REDACTED]"            // literal +194001, via f4

    envelope = buildEnvelope(role, content, config)   // via CH -> JSON.stringify
    logAtLevel("debug", envelope)                      // literal +201876

    // File context attachment (optional, depth-limited)
    if fileAttachmentNeeded:
        fileData = readContextFile(config)   // via kJK -> Buffer.byteLength +201596
        // max file read chunk: 1000 units (+201707), rate-limit: 100 (+201726)
        envelope.attach(fileData)

    dispatch(envelope)   // via vJK -> Av, VJK, j9A
    return envelope
```

Analysis basis: CC v2.1.147 bundle.js:+201900 (`Q_6`), +201918 (`vJK`), +201940 (`H.includes`), +201958 (`CH`), +202002 (`_.toUpperCase`), +202022 (`f4`), +202025 (`H.trim`), +202041 (`hI`), +202047 (`lRH`), +202061 (`kJK`)

---

### Backup Path Resolution — `backupPathResolver` (bundle: `hy9`)

A helper called during config backup operations to enumerate and sort existing backup files.

```
function backupPathResolver(configPath):
    base    = basename(configPath)           // UY.basename
    backupDir = join(dirname(configPath), "backups")  // "backups" literal +3186371
    entries = readdirStringSync(backupDir)   // _.readdirStringSync

    filtered = entries
        .filter(e => e.startsWith(base))    // f.startsWith
        .map(e => join(backupDir, e))        // UY.join
        .filter(e => not e.startsWith("."))  // $.startsWith

    stats = filtered.map(p => statSync(p))  // _.statSync
    return sorted(filtered, by=mtime)
```

Analysis basis: CC v2.1.147 bundle.js:+3186404, +3186411, +3186428, +3186444, +3186371 (`"backups"`)

---

### Atomic File Write — `atomicFileWriter` (bundle: `sq6`)

Used when persisting config changes triggered by the `/btw` handler's side effects. Performs a write-to-temp then rename pattern.

```
function atomicFileWriter(targetPath, data):
    if lstatSync(targetPath).isSymbolicLink():
        resolvedTarget = resolveSymlink(targetPath)   // readlinkSync, isAbsolute, resolve

    randomSuffix = randomBytes(6).toString("hex")    // 6 bytes, "hex" encoding
    tempPath     = buildTempPath(targetPath, randomSuffix)

    fd = openSync(tempPath, flags)
    writeFileSync(fd, data)                          // Of.writeFileSync
    fchmodSync(fd, originalMode)                     // Of.fchmodSync; logs "Applied original permissions …"
    fsyncSync(fd)                                    // Of.fsyncSync
    closeSync(fd)                                    // Of.closeSync

    renameSync(tempPath, targetPath)                 // atomic rename

    on error (ELOOP | ENOTDIR):
        unlinkSync(tempPath)                         // cleanup on failure
        throw
```

Analysis basis: CC v2.1.147 bundle.js:+1006069, +1006156, +1006176, +1006785, +1006801 (literal `6`), +1006813 (`"hex"`), +1007221, +1007279, +1007300, +1007345, +1007473, +1007630

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_config_lock_contention` | Emitted when the config file lock cannot be acquired promptly, indicating a possible concurrent Claude instance (bundle.js:+3184859) |
| Telemetry: `tengu_config_stale_write` | Emitted when a stale/outdated config write is detected and suppressed (bundle.js:+3184995) |
| Telemetry: `tengu_config_parse_error` | Emitted when the config JSON cannot be parsed; falls back to defaults (bundle.js:+3187440) |
| Telemetry: `tengu_config_auth_loss_prevented` | Emitted when a re-read config is missing auth data and the write is refused to avoid wiping credentials (bundle.js:+3185338) |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Emitted in background daemon context when SIGKILL escalation occurs (bundle.js:+15117797) |
| Telemetry: `tengu_bg_dispatch_low_mem` | Emitted when low-memory conditions are detected in background session management (bundle.js:+15118376) |
| Telemetry: `tengu_bg_spare_enable` | Emitted when a spare background session slot is enabled (bundle.js:+15119071) |
| Telemetry: `tengu_bg_spare_claim` | Emitted when a spare background session is successfully claimed (bundle.js:+15119192) |
| Telemetry: `tengu_bg_spare_claim_fail` | Emitted when claiming a spare background session fails (bundle.js:+15119455) |
| thinClientDispatch | Sends a `control-request` over the thin-client channel; does not open a new agent turn |
| Config file side effects | May read, lock, back up, and atomically write `~/.claude.json`; auth-loss guard prevents accidental credential wipe |
| Backup files | Stored under a `backups/` subdirectory relative to the config file; up to 5 backups retained (literal `5` at +3185789) |
| JSX render | A React element is constructed via `z4.createElement` and returned for inline display in the CLI UI (bundle.js:+10492783) |
| immediate flag | `true` — no confirmation dialog is shown; the request fires on Enter |

---

## Version History

| Version | Change |
|---|---|
| v2.1.147 | Initial analysis |

---

## Common Mistakes

1. **Omitting the argument**: Invoking `/btw` with no text returns only the usage hint `"Usage: /btw <your question>"` and sends nothing to the agent. Always provide a question after the command.
2. **Expecting a new conversation turn**: `/btw` uses `thinClientDispatch: "control-request"`, which injects a system-scoped aside rather than starting a fresh user turn. The agent will address the question in the context of whatever it was doing, not as a top-level exchange.
3. **Assuming `/btw` is interactive**: The `immediate: true` flag means the command fires without any confirmation prompt. There is no opportunity to review or cancel once Enter is pressed.
4. **Confusing it with `/ask` or direct messages**: `/btw` is specifically designed for low-priority interruptions; the system-role framing signals to the model that this is an aside, not a primary directive.
5. **Config lock conflicts**: If another Claude instance is writing config simultaneously, a lock-contention telemetry event may fire and the config read may be delayed. This is expected behavior and does not indicate a bug in `/btw` itself.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `PT7` | Main `/btw` command handler (`btwCommandHandler`); AsyncFunction resolved via module_id `c$1` |
| `H` | Usage guard / argument presence checker; uses `Math.random` + `setTimeout` for display timing |
| `M8` | Config context loader; orchestrates config read, workspace map, timestamp, and backup index |
| `_L_` | Config lock manager; handles file-system locking, stale-write detection, and auth-loss prevention |
| `_` | Filesystem abstraction (readdirStringSync, statSync) |
| `F6` | Path existence / filesystem check helper |
| `L` | File operation queue manager; coordinates add/delete/finally/statSync operations |
| `q` | Low-level filesystem I/O module (unlinkSync, readFileSync, statSync, mkdirSync, readdirStringSync, copyFileSync) |
| `M` | Promise/session lifecycle manager (close, finally) |
| `n99` | Message envelope builder; uses `et8` and `Object.assign` |
| `et8` | Inner envelope construction helper; calls `l99` |
| `N` | Control-request dispatcher; builds and sends the system-role message |
| `vJK` | Message dispatch executor; calls `Av`, `VJK`, `j9A` |
| `CH` | JSON serialization helper (`JSON.stringify`) |
| `f4` | Content sanitizer / redactor; handles `[REDACTED]` substitution and slice/replace operations |
| `lRH` | Content post-processor; calls `b1A` |
| `kJK` | File context attachment handler; reads file data with byte-length accounting |
| `c` | Session/context state accessor |
| `q8` | Error code classifier / guard |
| `k$H` | Config file reader; enforces access guard, parses JSON, manages backups |
| `B6` | JSON parse wrapper (`JSON.parse`) |
| `OC` | BOM / prefix stripper (`startsWith`, `slice`) |
| `hy9` | Backup path resolver; enumerates and filters backup files |
| `RH` | Error reporter / log dispatcher; calls `n_`, `UH`, `j1`, `FpK`, `Gl.logError` |
| `AL_` | Backup directory path builder (`UY.join`, `o8`) |
| `w` | Background session / daemon process manager; handles spawn, SIGKILL, memory checks |
| `Wf6` | Workspace configuration helper |
| `A` | String normalization utility (`M.toLowerCase`) |
| `Z` | Path/string prefix checker (`Z.startsWith`) |
| `X` | SDK/transport connection manager; handles `Promise.all`, connection states |
| `YN8` | Transport initialization helper |
| `n_` | Error construction utility (`Error`, `String`) |
| `V` | Result array / slice accumulator |
| `sq6` | Atomic file writer; uses temp file + rename pattern with fchmod/fsync |
| `O` | File stat / symlink checker (`isSymbolicLink`, `v8`) |
| `J8` | Error code lookup / guard (`q8`) |
| `sUH` | Session metadata initializer |
| `yy9` | Workspace map builder (`Object.entries`) |
| `tUH` | Timestamp capture helper (`Date.now`) |
| `HL_` | Backup index builder; resolves dirname, calls `lE`, `CH`, `sq6` |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.