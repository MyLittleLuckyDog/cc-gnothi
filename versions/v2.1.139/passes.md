---
type: feature-spec
feature: "passes"
cc_version: "2.1.139"
updated: "2026-05-31"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.139 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.139 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.139

---

## Overview

The `/passes` command allows users to share a free week of Claude Code with friends by displaying and managing "guest pass" tokens. When invoked, it triggers a JSX-rendered UI component that presents the pass-sharing interface, and fires a telemetry event recording that the guest passes screen was visited.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| loc_byte | `11243023` |
| loc_byte_end | `11243343` |
| loc_line | `6905` |
| isHidden | `null` (not hidden; visible in command palette) |
| module_id | `gDq` |
| load_inline | `true` |
| arbor_handler.name | `k27` |
| arbor_handler.fqn | `claude-2.1.139::k27` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.139 bundle.js:+11243023

---

## Input Branching

The command handler (`k27`) has a relatively linear flow — it resolves config/session context, fires a telemetry event, and renders a JSX element. There are a small number of internal branches (session availability, config read paths), but the top-level command path is essentially linear.

Numbered pseudocode is used here per the 1–2 branch rule.

1. The command is invoked (`k27` async handler is called).
2. Session/config context is resolved by calling the session-initialisation helper (`RY8`), which internally calls the conversation-context builder (`a7`) and the config-read function (`b6`).
3. The conversation-state and history utilities (`H8`) are initialised, which involve reading the on-disk conversation store (`c8_`) and performing config-state setup (`cfH`).
4. A React/JSX element is created via `Ou_.createElement` to mount the passes UI.
5. The telemetry event `tengu_guest_passes_visited` is emitted.
6. The command returns the rendered JSX element to the shell for display.

Analysis basis: CC v2.1.139 bundle.js:+11242706 (handler entry), +11242740 (`RY8` call), +11242746 (`H8` call), +11242844 (`Q` call), +11242895 (`Ou_.createElement` call), +11242846 (`tengu_guest_passes_visited`)

---

## Behavioral Spec

### Top-Level Handler

```
async function passesCommandHandler(commandContext):
    # Step 1: Initialise session and config
    sessionInfo  = await initSessionAndConfig(commandContext)   # RY8
    historyState = await initHistoryAndConversationStore()      # H8

    # Step 2: Resolve config state
    configData = readConfigWithLock()                           # b6 → cfH

    # Step 3: Emit telemetry
    emitTelemetry("tengu_guest_passes_visited")

    # Step 4: Render the guest-passes JSX UI
    element = createElement(GuestPassesComponent, {
        session: sessionInfo,
        config:  configData,
    })

    return element
```

Analysis basis: CC v2.1.139 bundle.js:+11242706

---

### Session and Config Initialisation (`RY8`)

```
async function initSessionAndConfig(ctx):
    # Calls conversation-context builder (a7)
    convContext = buildConversationContext(ctx)    # a7 → Pw

    # Calls config-read helper (b6)
    cfg = readConfig()                            # b6

    return { convContext, cfg }
```

Analysis basis: CC v2.1.139 bundle.js:+10904309 (`a7`), +10904357 (`b6`)

---

### Config Read with Locking (`b6`)

```
function readConfig():
    # Acquires config lock
    lockHandle = acquireLock()                     # B6
    watcher    = setupFileWatcher()                # BW
    memCache   = getMemoryCachedConfig()           # U8_

    # Delegates to config-file reader
    rawConfig = readConfigFile()                   # cfH
    timestamp = Date.now()

    # Sets up file-watch polling
    poller = startConfigPolling()                  # pVL

    return { rawConfig, timestamp }
```

Analysis basis: CC v2.1.139 bundle.js:+3131668 (`B6`), +3131682 (`BW`), +3131701 (`U8_`), +3131705 (`cfH`), +3131757 (`Date.now`), +3131810 (`pVL`)

---

### Config File Reader (`cfH`)

```
function readConfigFile():
    # Guard: config must not be accessed too early
    if accessedBeforeAllowed:
        throw new Error("Config accessed before allowed.")   # literal at +3134784

    # Read raw file bytes synchronously
    rawBytes = fs.readFileSync(configPath, "utf-8")          # +3134840, encoding "utf-8" at +3134867

    # Parse JSON
    parsed = parseJSON(rawBytes)                             # U6 → JSON.parse

    # Normalise key prefix
    normalised = stripKeyPrefix(parsed)                      # cS → H.startsWith / H.slice

    # Locate backup directory
    backupDir = resolveBackupDirectory()                     # Z09, uses literal "backups" at +3134352

    # Resolve network config
    netCfg = resolveNetworkConfig()                          # N

    # Set up log output
    logHandler = buildLogHandler()                           # LH

    # Stat the config file for metadata
    fileStat = fs.statSync(configPath)                       # +3135381

    # Validate parse result; emit error telemetry on failure
    on parse error:
        emitTelemetry("tengu_config_parse_error")            # +3135421

    # Construct directory structure for config
    baseName  = path.basename(configPath)                    # +3135573
    configDir = buildConfigDir(baseName)                     # l8_
    fs.mkdirSync(configDir, { recursive: true })             # +3135600

    # Read directory entries, filtering by prefix
    entries = fs.readdirStringSync(configDir)                # +3135658
    # Filter entries that start with expected prefix         # +3135693

    # Copy file with timestamp
    destPath  = path.join(configDir, baseName)               # +3135812
    timestamp = Date.now()                                   # +3135911
    fs.copyFileSync(configPath, destPath)                    # +3135929

    return normalised
```

Analysis basis: CC v2.1.139 bundle.js:+3134778 (guard error), +3134825 (`B6`), +3134840 (`readFileSync`), +3134887 (`U6`), +3134890 (`cS`), +3135006 (`w8`), +3135030 (`Z09`), +3135265 (`N`), +3135362 (`LH`), +3135381 (`statSync`), +3135419 (`Q`), +3135421 (telemetry)

---

### History and Conversation Store Initialisation (`H8`)

```
async function initHistoryAndConversationStore():
    fileWatcher  = getFileWatcher()               # BW
    randomSource = getRandomSource()              # H
    statusInfo   = getStatusInfo()                # suH
    entryBuilder = buildEntryObject()             # E09 → Object.entries

    # Read config state
    configState  = readConfig()                   # cfH (re-entrant read)

    # Initialise disk-based conversation store
    storeState   = initConversationStoreOnDisk()  # c8_
    stateVariant = determineStateVariant()        # w46

    # Build and return combined state object
    return buildStateResult(storeState, stateVariant)   # Q, d8_
```

Status-variant literals observed at depth ≤ 2 (all from `+3130481` vicinity):

| Value | Meaning |
|---|---|
| `0` | Initial / zero count |
| `"unknown"` | State cannot be determined |
| `"local"` | Local-only installation |
| `"migrated"` | Previously migrated from another install |
| `"native"` | Native (OS-level) install |
| `"installed"` | Standard installed state |
| `"disabled"` | Feature disabled |
| `"enabled"` | Feature enabled |
| `"no_permissions"` | Insufficient permissions |
| `"not_configured"` | Configuration absent |
| `"global"` | Global scope |

Analysis basis: CC v2.1.139 bundle.js:+3129842 (`c8_`), +3129846 (`BW`), +3129866 (`H`), +3129917 (`E09`), +3130023 (`cfH`), +3130039 (`w46`), +3130481–+3130708 (status literals)

---

### Conversation Store On-Disk Operations (`c8_`)

```
function initConversationStoreOnDisk():
    # Resolve config directory using path utilities
    configDir = path.dirname(configPath)          # Rz.dirname (+3132546)
    lockRef   = acquireLock()                     # B6 (+3132562)
    fs.mkdirSync(configDir, { recursive: true })  # L.mkdirSync (+3132567)
    timestamp = Date.now()                        # +3132612

    # Build initial store metadata
    metadata = buildMetadata()                    # ioA → tl8, Object.assign

    # Resolve network config
    netCfg = resolveNetworkConfig()               # N (+3132667)

    # Read current state
    currentState = getCurrentState()              # Q (+3132838)

    # Check for lock contention
    if lockWait > threshold:
        emitTelemetry("tengu_config_lock_contention")

    fileWatcher = attachFileWatcher()             # BW (+3132901)
    fileStat    = fs.statSync(storePath)          # L.statSync (+3132916)

    # Safeguard: refuse write if auth would be lost
    if reReadMissingAuth:
        log("saveConfigWithLock: re-read config is missing auth…")  # literal at +3133167
        emitTelemetry("tengu_config_stale_write")                   # +3132976
        emitTelemetry("tengu_config_auth_loss_prevented")           # +3133319

    # Enumerate backup files
    baseName  = path.basename(storePath)          # Rz.basename (+3133436)
    backupDir = buildBackupDir(baseName)          # l8_ (+3133453)
    entries   = fs.readdirStringSync(backupDir)   # L.readdirStringSync (+3133529)

    # Filter entries by ".backup." infix                             # literal at +3133637
    # Keep at most 5 backups                                         # number literal 5 at +3133770
    oldest = entries.slice(...)                   # V.slice (+3133873)
    fs.unlinkSync(oldest)                         # L.unlinkSync (+3133888)

    # Atomic write via symlink helper
    atomicWrite(storePath, data)                  # dSH (+3134010)
    # File mode: 0o600 (384 decimal)                                 # literal 384 at +3134052

    return updatedStore
```

Analysis basis: CC v2.1.139 bundle.js:+3132382 – +3134090

---

### Atomic Config Write Helper (`dSH`)

```
function atomicWrite(targetPath, content):
    # Resolve symlinks to find real target
    resolvedPath = fs.readlinkSync(targetPath)       # +987753
    if not path.isAbsolute(resolvedPath):
        resolvedPath = path.resolve(path.dirname(targetPath), resolvedPath)

    # Detect error conditions
    on ELOOP or ENOTDIR:                             # literals at +988039, +988052
        throw new Error(...)

    # Generate a random hex temp filename (6 random bytes → 12 hex chars)
    randomBytes = crypto.randomBytes(6)              # X5A.randomBytes (+988378), literal 6 at +988394
    tempName    = randomBytes.toString("hex")        # literal "hex" at +988406

    # Write to temp file, flush, apply permissions
    fd = fs.openSync(tempPath, flags)                # jD.openSync (+987912)
    fs.writeFileSync(tempPath, content)              # jD.writeFileSync (+988814)
    fs.fchmodSync(fd, originalMode)                  # jD.fchmodSync (+988872)
    fs.fsyncSync(fd)                                 # jD.fsyncSync (+988938)
    fs.closeSync(fd)                                 # jD.closeSync (+987899)

    # Atomically replace target
    fs.renameSync(tempPath, targetPath)              # q.renameSync (+989066)

    # Clean up on failure
    on error:
        fs.unlinkSync(tempPath)                      # q.unlinkSync (+989223)
```

Analysis basis: CC v2.1.139 bundle.js:+987666 – +989223

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_guest_passes_visited` | Fired once each time `/passes` is invoked (bundle.js:+11242846) |
| Telemetry — `tengu_config_parse_error` | Fired when the on-disk config JSON cannot be parsed (bundle.js:+3135421) |
| Telemetry — `tengu_config_lock_contention` | Fired when config lock acquisition is slow (bundle.js:+3132840) |
| Telemetry — `tengu_config_stale_write` | Fired when a stale write to config is detected (bundle.js:+3132976) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a write that would erase auth credentials is blocked (bundle.js:+3133319) |
| Telemetry — `tengu_feature_ok` / `tengu_feature_bad` | Feature-flag check outcome events fired during config initialisation (bundle.js:+943635, +943693) |
| Telemetry — `tengu_bg_*` family | Background-session management events (spawn, claim, low-memory, SIGKILL escalation) triggered transitively through the process-manager helpers (`w`, `ml_`, `Sl_`) reached during handler setup |
| File system | `~/.claude.json` (or equivalent config path) may be read; backup copies are written to the `backups/` subdirectory; at most 5 backups are retained |
| File system — atomic write | Temp file with random hex name is created, synced, then renamed over the target; permissions set to `0o600` (384) |
| Config lock | A file lock is acquired during config read/write; contention is logged and telemetered |
| Auth-loss guard | Writes that would silently remove authentication credentials are blocked (references GH #3117) |
| JSX render | A guest-passes React component is instantiated and returned for display in the terminal UI (`Ou_.createElement` at bundle.js:+11242895) |
| appState changes | Config cache is updated in memory after a successful read/write cycle via `Object.assign` within `ioA` |
| Sound | None observed |

---

## Version History

| Version | Change |
|---|---|
| v2.1.139 | Initial analysis |

---

## Common Mistakes

1. **Expecting plain text output** — `/passes` is a `local-jsx` command; it renders a JSX component, not a markdown string. Integrations that capture command output as plain text will not receive the rendered UI.
2. **Invoking in a context without config access** — The handler reads the on-disk config file synchronously early in its execution. If the config file is missing or malformed, a `tengu_config_parse_error` event fires and the command may fail to display the passes UI.
3. **Assuming no file I/O** — The command triggers config-read helpers that write backup copies of `~/.claude.json`. On heavily-loaded systems the lock-contention telemetry (`tengu_config_lock_contention`) may surface if another Claude Code instance holds the config lock.
4. **Misreading the auth-loss guard as a bug** — If the re-read config is missing auth credentials that the in-memory cache holds, the write is intentionally blocked (see GH #3117). This is a safety feature, not an error.
5. **Confusing `/passes` with an API endpoint** — The command operates entirely client-side; it renders a local UI for generating/sharing pass tokens. No direct HTTP call to the passes API is visible at depth ≤ 2 in the call graph.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `k27` | Top-level async handler for the `/passes` command (arbor_handler) |
| `b6` | Config read with lock — orchestrates file watch, cache, and delegates to `cfH` |
| `B6` | Lock-acquisition utility |
| `U8_` | In-memory config cache accessor |
| `cfH` | Config-file reader (reads, parses, backs up `~/.claude.json`) |
| `q` | File-system operations namespace (sync read/write/stat/copy/unlink) |
| `U6` | JSON parse wrapper |
| `cS` | Key-prefix normaliser (uses `startsWith` / `slice`) |
| `H` | Random/timing utility (Math.random, setTimeout) |
| `_` | File-system utility namespace (readdirStringSync, statSync) |
| `w8` | Error-code helper |
| `Z09` | Backup-directory resolver (uses `path.basename`, `readdirStringSync`) |
| `l8_` | Config/backup directory path builder (uses `path.join`) |
| `M` | Module/feature registry accessor |
| `$` | Miscellaneous utility / NXq helper |
| `N` | Network-config resolver |
| `y9K` | Network sub-config builder |
| `yH` | JSON stringify wrapper |
| `LM` | Log-message formatter |
| `QyH` | Millisecond-format helper |
| `R9K` | HTTP/buffer send helper (Buffer.byteLength, chunked write) |
| `LH` | Log-handler builder (uses `q_`, `SH`, `S1`, `CGK`) |
| `q_` | Error-to-string converter |
| `SH` | String coercion utility |
| `S1` | Log-sink initialiser (G7A) |
| `CGK` | Log-queue shift/push manager |
| `Q` | Current-state accessor |
| `w` | Process/daemon manager (spawns, kills, monitors background sessions) |
| `A` | Process registry map |
| `S` | Background-session lifecycle object (Date.now, Math.min, state machine) |
| `xH` | Feature-flag "bad" reporter |
| `kH` | Feature-flag "ok" reporter |
| `ul_` | Memory-stats helper (macOS freemem) |
| `b` | Background-session write/timeout handler |
| `j6` | Session-lookup utility (ZB map get/has) |
| `Sl_` | Socket-connection helper (claim, connect, write, end) |
| `ml_` | Background-task lifecycle manager (add, delete, finalise, unlink) |
| `L` | Task-set with add/delete/finally |
| `Y` | Spare-session recycler (dispose, freemem, Date.now loop) |
| `u` | Disposable resource handle |
| `pVL` | Config file-watch poller (watchFile/unwatchFile) |
| `Xc` | Watch-change callback |
| `C9` | Subscription/observer registration helper |
| `y8K` | Undefined-guard helper |
| `RY8` | Session-and-config initialiser (calls `a7` and `b6`) |
| `a7` | Conversation-context builder (calls `Pw`) |
| `Pw` | Auth and API-key resolution orchestrator |
| `fL` | String formatter / SH-delegating helper |
| `WR` | Auth-config assembler (`_p6`, `JL6`, `Do`, `sx`, `SH`) |
| `dO` | First-party auth-type resolver |
| `w$` | API-key / OAuth token resolver (env var `ANTHROPIC_API_KEY`) |
| `JL6` | Auth-config structure builder |
| `H8` | History and conversation-store initialiser |
| `c8_` | On-disk conversation-store read/write/backup manager |
| `ioA` | Metadata builder (tl8, Object.assign) |
| `tl8` | Inner metadata constructor |
| `w46` | State-variant discriminator |
| `Z` | Signal/event emitter |
| `X` | MCP connection manager (Promise.all, SDK/HTTP/SSE modes) |
| `U08` | MCP transport type resolver |
| `V` | Array slice target (backup list) |
| `dSH` | Atomic file-write helper (symlink resolution, temp file, rename) |
| `O` | lstat result / symbolic-link checker |
| `D8` | Secondary error-code helper |
| `f` | File-descriptor wrapper (close, write, toString) |
| `suH` | Status-info builder |
| `E09` | Entry-object builder (Object.entries) |
| `tuH` | Timestamp builder (Date.now) |
| `d8_` | Backup-store auxiliary (dirname, B6, fv, yH, dSH) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.