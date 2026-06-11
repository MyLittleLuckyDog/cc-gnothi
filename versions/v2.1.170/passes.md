---
type: feature-spec
feature: "passes"
cc_version: "2.1.170"
updated: "2026-06-11"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.170 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.170 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.170

---

## Overview

`/passes` opens an interactive UI surface that allows the current Claude Code user to view and share guest passes — free trial weeks of Claude Code that can be gifted to friends. The command is implemented as a local JSX component rendered inline within the CLI. On invocation, the handler records a telemetry visit event and renders the passes management view.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| loc_byte | `12606831` |
| loc_byte_end | `12607153` |
| loc_line | `8893` |
| isHidden | `null` (not hidden; visible in command list) |
| module_id | `p4K` |
| load_inline | `true` |
| arbor_handler.name | `bBf` |
| arbor_handler.fqn | `claude-2.1.170::bBf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.170 bundle.js:+12606831

---

## Input Branching

The command has a predominantly linear flow (invocation → telemetry → render), with internal branches inside the config-read and file-management helpers. The top-level handler itself is two-path (success / early return), so numbered pseudocode is used here; deeper branching is expanded in the Behavioral Spec sections below.

1. User types `/passes` in the CLI.
2. Handler `guestPassesHandler` (`bBf`) is called as an `AsyncFunction`.
3. `guestPassesHandler` fires telemetry event `tengu_guest_passes_visited`.
4. `guestPassesHandler` calls `configLoader` (`Km8`) to obtain the current user configuration, which in turn calls `configWatcher` (`gL`) and `fileWatchCoordinator` (`h6`).
5. `guestPassesHandler` calls `sessionStoreInitializer` (`W8`) to prepare the underlying session/config store (reads, locks, backs up, and repairs config files as needed).
6. `guestPassesHandler` calls the React createElement factory (`yMA.createElement`) to render the passes JSX component, passing configuration data and a state-update callback (`d`).
7. The rendered JSX component is returned to the CLI framework for display.

---

## Behavioral Spec

### Top-Level Handler — `guestPassesHandler`

```
async function guestPassesHandler(context):
    emit_telemetry("tengu_guest_passes_visited")          # loc +12606654
    config = await configLoader(context)                  # Km8, loc +12606548
    store  = await sessionStoreInitializer(context)       # W8,  loc +12606554
    stateCallback = buildStateCallback()                  # d,   loc +12606652
    ui = createElement(PassesComponent, {                 # yMA.createElement, loc +12606703
        config: config,
        store:  store,
        onStateChange: stateCallback
    })
    return ui
```

Analysis basis: CC v2.1.170 bundle.js:+12606514

---

### Config Loading — `configLoader` / `configWatcher`

`configLoader` (`Km8`) delegates to `configWatcher` (`gL`), which coordinates `fileWatchCoordinator` (`h6`) and an `authSessionResolver` (`IY`). The watcher sets up filesystem watch listeners via `fileWatchSetup` (`BSL`) that monitor the config file for changes and call `fileChangeCallback` (`qF`) on mutation. On first load it also calls `authProfileInitializer` (`qO`) to resolve authentication (OAuth token, API key, or WIF env vars).

```
function configLoader(context):
    watcher = configWatcher(context)          # gL, loc +12217147
    fileCoord = fileWatchCoordinator()        # h6, loc +12217195
    return { watcher, fileCoord }

function configWatcher(context):
    session = authSessionResolver(context)    # IY, loc +3262391
    coord   = fileWatchCoordinator()          # h6, loc +3262396
    return { session, coord }

function authSessionResolver(context):
    profile = authProfileInitializer()        # Aj, loc +3241448
    watch   = fileWatchSetup()                # sL, loc +3241469
    ...
    return resolvedSession
```

Analysis basis: CC v2.1.170 bundle.js:+12217147, +3262391, +3241350

---

### Session Store Initialization — `sessionStoreInitializer`

`sessionStoreInitializer` (`W8`) reads the config JSON file (`utf-8`, loc +3308049), locks it to prevent concurrent writes, creates backups, manages directory structure, and returns a structured store object. It calls `configFileManager` (`k78`) for low-level file operations and `configReadWriter` (`B7H`) for config-level read/write with locking.

```
function sessionStoreInitializer(context):
    coord     = fileWatchCoordinator()        # ZG, loc +3302782
    randState = buildRandomState()            # H,  loc +3302802
    envState  = readEnvFlags()                # ZJH, loc +3302834
    mcpConfig = readMcpConfig()               # K69, loc +3302853 — iterates Object.entries
    timestamp = readTimestamp()               # QP6, loc +3302878 — Date.now based
    apiConfig = resolveApiConfig()            # N,  loc +3302894
    fileStore = configFileManager(context)    # B7H, loc +3302959
    logHandle = openLogHandle()               # liH, loc +3302975
    stateObj  = buildStateObject()            # d,  loc +3303111
    installRec = readInstallRecord()          # I78, loc +3303225
    return {
        coord, randState, envState, mcpConfig,
        timestamp, apiConfig, fileStore,
        logHandle, stateObj, installRec
    }
```

Key literals used inside `sessionStoreInitializer` and its callees:

| Literal | Meaning | loc_byte |
|---|---|---|
| `"unknown"` | Default install-state value | +3303423 |
| `"local"` | Install source: local | +3303498 |
| `"migrated"` | Install source: migrated | +3303485 |
| `"native"` | Install source: native | +3303530 |
| `"installed"` | Install source: installed | +3303516 |
| `"disabled"` / `"enabled"` | Feature flag states | +3303549 / +3303575 |
| `"no_permissions"` | Permission state | +3303589 |
| `"not_configured"` / `"global"` | Config state | +3303610 / +3303629 |
| `"backups"` | Backup subdirectory name | +3307534 |
| `".backup."` | Backup filename infix | +3306819 |
| Max backup files: `5` | Rotation limit | +3306952 |
| `"Config accessed before allowed."` | Guard error message | +3307966 |

Analysis basis: CC v2.1.170 bundle.js:+3302778, +3303402

---

### Config File Manager — `configFileManager`

`configFileManager` (`B7H`) is the lower-level config I/O helper. It reads config JSON with `readFileSync` (encoding `"utf-8"`), parses it via `jsonParser` (`Q6` → `JSON.parse`), strips any ID prefix via `idPrefixStripper` (`ku`), and then resolves file paths, manages backup rotation, and copies files atomically.

```
function configFileManager(context):
    try:
        raw  = fs.readFileSync(configPath, "utf-8")   # loc +3308022
        data = JSON.parse(raw)                         # Q6, loc +3308069
        id   = stripIdPrefix(data)                     # ku, loc +3308072
    catch err:
        if err.code == "ENOENT":                       # loc +3308196
            return defaultConfig()
        emit_telemetry("tengu_config_parse_error")     # loc +3308597
        log("error", err)                              # loc +3308517
        return defaultConfig()

    backupDir = resolveBackupDir(context)              # L69, loc +3308212
    stat      = fs.statSync(configPath)                # loc +3308557
    state     = buildConfigState()                     # d,   loc +3308595
    destBase  = path.basename(configPath)              # loc +3308749
    destDir   = resolveDestDir()                       # CT_, loc +3308766
    fs.mkdirSync(destDir, { recursive: true })         # loc +3308776
    entries   = fs.readdirStringSync(destDir)          # loc +3308834
    # filter entries not starting with expected prefix  loc +3308869
    joinedDest = path.join(destDir, destBase)          # loc +3308988
    ts        = Date.now()                             # loc +3309087
    fs.copyFileSync(configPath, joinedDest + ts)       # loc +3309105
    return state
```

Analysis basis: CC v2.1.170 bundle.js:+3308022, +3308069, +3308196, +3308597

---

### Config Read/Write with Lock — `configReadWriter`

`configReadWriter` (`k78`), called from `sessionStoreInitializer`, handles the full read-modify-write cycle under a file lock. It calls `lockAcquirer` (`JE1`) and raises a warning if lock contention exceeds a threshold (literal: `"Lock acquisition took longer than expected..."`, loc +3305933). It guards against auth loss (literal: `"saveConfigWithLock: re-read config is missing auth..."`, loc +3306349) and emits telemetry events for contention and stale writes.

```
function configReadWriter(path, mutatorFn):
    fs.mkdirSync(dirname(path), { recursive: true })    # loc +3305749
    ts   = Date.now()                                    # loc +3305794
    lock = acquireLock(path)                             # JE1, loc +3305807
    if lock.waitMs > threshold:
        emit_telemetry("tengu_config_lock_contention")   # loc +3306022
        warn("Lock acquisition took longer than expected...")
    current = readConfig(path)                           # N, loc +3305849
    updated = mutatorFn(current)
    if staleWrite(current, updated):
        emit_telemetry("tengu_config_stale_write")       # loc +3306158
    if authLossPrevented(current, updated):
        emit_telemetry("tengu_config_auth_loss_prevented") # loc +3306501
        warn("saveConfigWithLock: re-read config is missing auth...")
        return                                           # refuse write
    atomicWrite(path, updated)                           # xO6, loc +3307192
    stat(path)                                           # loc +3306098
```

Analysis basis: CC v2.1.170 bundle.js:+3305807, +3306022, +3306158, +3306501

---

### File Watch Coordinator — `fileWatchCoordinator`

`fileWatchCoordinator` (`h6`) manages filesystem watchers for config files. It invokes `configReadWriter` (`B7H`), `fileWatchSetup` (`BSL`), and a timestamp tracker (`Date.now`, loc +3304804). The watcher calls `configStringifier` (`n6`), `randomIdGen` (`ZG`), `hashTracker` (`hT_`), and `configState` (`B7H`) to maintain an up-to-date in-memory view of config state and notify subscribers when the file changes on disk.

```
function fileWatchCoordinator():
    id        = randomIdGen()               # ZG, loc +3304728
    hash      = hashTracker()               # hT_, loc +3304747
    fileState = configFileManager()         # B7H, loc +3304751
    ts        = Date.now()                  # loc +3304804
    watchHandle = fileWatchSetup({          # BSL, loc +3304857
        onChange: (event) =>
            newHash = computeHash(event)    # ku, inside BSL
            if newHash != hash:
                reload()
                notify()
    })
    return { id, hash, fileState, ts, watchHandle }
```

Analysis basis: CC v2.1.170 bundle.js:+3304714, +3304804, +3304857

---

### Atomic Config Write — `atomicConfigWriter`

`atomicConfigWriter` (`xO6`) writes config files safely using a temp-file-then-rename pattern. It reads the symlink target if the config path is a symlink, resolves absolute paths, generates a random hex suffix for the temp file, writes the new content, applies original file permissions via `fchmodSync`, calls `fsyncSync` to flush, and then renames the temp file over the original.

```
function atomicConfigWriter(targetPath, content):
    linkTarget = fs.readlinkSync(targetPath)          # loc +1060770
    if not path.isAbsolute(linkTarget):
        linkTarget = path.resolve(dirname, linkTarget) # loc +1060809
    lstat = fs.lstatSync(targetPath)                   # loc +1061167
    if lstat.isSymbolicLink():
        resolvedPath = linkTarget
    else:
        resolvedPath = targetPath
    suffix  = crypto.randomBytes(N).toString("hex")    # loc +1061399/1061427
    tmpPath = resolvedPath + "." + suffix
    fd = fs.openSync(tmpPath, flags)                   # loc +1060929
    try:
        fs.writeFileSync(fd, content)                  # loc +1061835
        fs.fchmodSync(fd, originalMode)                # loc +1061893; "Applied original permissions to temp file" +1061914
        fs.fsyncSync(fd)                               # loc +1061959
    finally:
        fs.closeSync(fd)                               # loc +1060916
    fs.renameSync(tmpPath, resolvedPath)               # loc +1062087
```

Analysis basis: CC v2.1.170 bundle.js:+1060770, +1061399, +1061835, +1061959, +1062087

---

### Auth Resolution — `authProfileInitializer`

`authProfileInitializer` (`Aj`) selects the authentication profile. It checks for a `"claude-desktop-3p"` profile tag (loc +3239872), applies `"profile-implicit"` labeling (loc +3240341), resolves `"user_oauth"` credentials (loc +3240414), and delegates to `authStrategyBuilder` (`qO`) which checks for `ANTHROPIC_API_KEY` (loc +3243600), `apiKeyHelper` (loc +3243694), `"none"` sentinel (loc +3243733), or WIF env vars. If no auth is found, it throws with the message: `"ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, CLAUDE_CODE_OAUTH_TOKEN, or WIF env vars ... required"` (loc +3244069).

Analysis basis: CC v2.1.170 bundle.js:+3239965, +3243513, +3244063, +3244069

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — visit | `tengu_guest_passes_visited` fired immediately on handler entry (loc +12606654) |
| Telemetry — config parse error | `tengu_config_parse_error` when config JSON is malformed (loc +3308597) |
| Telemetry — lock contention | `tengu_config_lock_contention` if lock wait exceeds threshold (loc +3306022) |
| Telemetry — stale write | `tengu_config_stale_write` on detected stale write attempt (loc +3306158) |
| Telemetry — auth loss prevented | `tengu_config_auth_loss_prevented` when write would erase auth (loc +3306501) |
| Telemetry — background (indirect) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_low_mem_mb`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_sendclaim_failed`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop`, `tengu_bg_attach_legacy_autorespawn`, `tengu_bg_attach`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_stall_respawn`, `tengu_bg_attach_kick` — emitted by background session infrastructure reachable via depth-2 call graph |
| Telemetry — feature flags | `tengu_feature_ok`, `tengu_feature_bad` — emitted during feature-flag validation (loc +1014205, +1014267) |
| Telemetry — scheduled tasks | `tengu_scheduled_task_missed` — emitted by background session scheduler (loc +16034551) |
| File I/O | Config file read (`readFileSync`, encoding `utf-8`); backup copies created under `"backups"` subdirectory; atomic rename-based write |
| File watch | `fs.watchFile` registered via `fileWatchSetup` (`BSL`); `fs.unwatchFile` called on cleanup (loc +3304217, +3304550) |
| Hook registration | `LTA.register` called inside `notificationRegistrar` (`N9`, loc +62328) for lifecycle hooks |
| appState changes | State callback `d` passed to JSX component; component may call it to update displayed pass list |
| Background daemon | Session store initialization can spawn or connect to a background daemon process via `nQ.spawn` / `dc8.connect` (loc +16531463, +16508888) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Config backup rotation | Up to 5 backup files retained (literal `5`, loc +3306952); older ones pruned |
| Auth guard | Write refused and `tengu_config_auth_loss_prevented` emitted if re-read config is missing auth that the cache holds (prevents erasing `~/.claude.json` credentials; see GH #3117) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.170 | Initial analysis |

---

## Common Mistakes

1. **Running `/passes` without valid authentication** — The command loads config through `authProfileInitializer`, which requires at least one of `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, or WIF env vars. Missing credentials cause an error before the passes UI is shown.
2. **Concurrent Claude Code instances writing config** — The config write path uses a file lock. Running two instances simultaneously may trigger `tengu_config_lock_contention` and the warning `"Lock acquisition took longer than expected — another Claude instance may be running"`. Close other instances before managing passes.
3. **Manually editing `~/.claude.json` while `/passes` is open** — The file watcher (`BSL`) detects changes and reloads. External edits during an open passes session may cause the UI to reset unexpectedly.
4. **Assuming passes are transferable via CLI arguments** — `/passes` takes no sub-arguments; it is a UI-only surface. Sharing is performed through the rendered component, not via command-line flags.
5. **Ignoring auth-loss prevention messages** — If the CLI prints a warning about refusing to write config to avoid wiping credentials (GH #3117), do not force-write `~/.claude.json` manually; instead investigate why the re-read config is missing auth before retrying.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `bBf` | Top-level async handler for `/passes` (`guestPassesHandler`) |
| `h6` | File watch coordinator for config files (`fileWatchCoordinator`) |
| `n6` | Config stringifier / serializer |
| `hT_` | Config hash tracker |
| `B7H` | Config file manager — read/parse/backup (`configFileManager`) |
| `q` | Node.js `fs` module reference |
| `Y1` | CLI bootstrap / process-exit helper |
| `Q6` | JSON parser wrapper |
| `ku` | ID prefix stripper / string slicer |
| `H` | Random-state / jitter generator |
| `_` | General filesystem utility (readdirStringSync, statSync, etc.) |
| `V8` | Error code classifier |
| `L69` | Backup directory resolver |
| `CT_` | Destination directory path builder |
| `M` | MCP/global state map accessor |
| `$` | Module/state accessor helper |
| `N` | API config resolver / HTTP header builder |
| `PeK` | HTTP config builder helper |
| `CH` | JSON stringifier wrapper |
| `u4` | String/path manipulation utility |
| `zFH` | Config validation helper |
| `EeK` | File upload / buffer helper |
| `d` | State-update callback / state object builder |
| `w` | Background session manager |
| `A` | Session map / lowercase helper |
| `b` | Background job scheduler |
| `o8` | Async socket/timer helper |
| `xH` | Feature-flag ok reporter |
| `SH` | Feature-flag bad reporter |
| `dU8` | macOS memory check helper |
| `oW6` | Config file reader (async, JSON array) |
| `hH` | Hook notification helper |
| `Q` | Settle/retire session helper |
| `Y6` | Session roster / dispatch helper |
| `W2A` | Daemon socket claim/connect helper |
| `v2A` | Session lifecycle manager (done/killed/crashed/idle states) |
| `L` | Session task queue manager |
| `D` | Forced shutdown / process.exit coordinator |
| `K6` | Feature-flag registry initializer |
| `F` | Disposable resource handle |
| `BSL` | File watch setup and teardown (`fileWatchSetup`) |
| `qF` | File change callback |
| `N9` | Lifecycle hook registrar (calls `LTA.register`) |
| `Km8` | Config loader coordinator (`configLoader`) |
| `gL` | Config watcher factory (`configWatcher`) |
| `IY` | Auth session resolver (`authSessionResolver`) |
| `a7` | CLI argument parser (handles `--bare`) |
| `Aj` | Auth profile initializer (`authProfileInitializer`) |
| `sL` | First-party auth watcher |
| `$P` | Auth token provider |
| `qO` | Auth strategy builder (API key / OAuth / WIF) |
| `TP6` | Auth profile type tagger |
| `biH` | Auth mode builder |
| `W8` | Session store initializer (`sessionStoreInitializer`) |
| `k78` | Config read/write with lock (`configReadWriter`) |
| `JE1` | Lock acquirer |
| `fY_` | Lock file writer |
| `liH` | Log handle opener |
| `V` | Version-string prefix checker |
| `P` | IPC/socket protocol handler |
| `X` | Socket message buffer |
| `J` | Session kill coordinator |
| `jf` | Socket end/close helper |
| `tj5` | Daemon protocol message dispatcher |
| `EH` | Error-string coercer |
| `E` | Sorted-slice helper |
| `G` | SDK connection manager |
| `xO6` | Atomic config file writer (`atomicConfigWriter`) |
| `O` | Background session object |
| `k8` | Error code normalizer |
| `f` | File descriptor wrapper |
| `ZJH` | Environment flag reader |
| `K69` | MCP config entry iterator (uses `Object.entries`) |
| `QP6` | Timestamp snapshot builder (uses `Date.now`) |
| `I78` | Install record reader |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.