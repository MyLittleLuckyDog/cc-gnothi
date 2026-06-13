---
type: feature-spec
feature: "passes"
cc_version: "2.1.176"
updated: "2026-06-13"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.176 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.176 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.176

---

## Overview

The `/passes` command surfaces a UI for sharing a free week of Claude Code with friends (guest passes). When invoked, it fires a single telemetry event recording the visit, then renders a JSX component that presents the guest-pass interface. The handler is an async function (`ZtL`) resolved via the `zwK` module export.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| module_id | `zwK` |
| load_inline | `true` |
| isHidden | `null` (not hidden) |
| loc_byte | `12775904` |
| loc_byte_end | `12776226` |
| arbor_handler.name | `ZtL` |
| arbor_handler.fqn | `claude-2.1.176::ZtL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.176 bundle.js:+12775904

---

## Input Branching

The command has a linear flow with no user-input branching — the handler executes unconditionally on invocation. Numbered pseudocode is appropriate here.

1. Command is invoked → runtime resolves handler `ZtL` from module `zwK` via inline `Promise.resolve({call: ZtL})`.
2. Handler fires telemetry event `tengu_guest_passes_visited`.
3. Handler calls helper `configFileLoader` (`hF8`) to obtain configuration context.
4. Handler calls `sessionStoreLoader` (`P8`) to obtain session/background-session context.
5. Handler creates and returns a JSX element (`ADA.createElement`) that renders the guest-pass sharing UI.

---

## Behavioral Spec

### Main Handler — Guest Passes Entry Point

```
async function guestPassesHandler(context):
    // Fire visit telemetry immediately
    emit("tengu_guest_passes_visited")

    // Load configuration state needed by the UI
    configContext = await loadConfigFile(context)        // hF8 → rf → sw → ...
    sessionContext = await loadSessionStore(context)     // P8 → j38 → ...

    // Obtain any additional context value (d)
    extraContext = resolveExtraContext(context)           // d

    // Build and return the JSX UI element
    return createElement(GuestPassComponent, {
        config: configContext,
        session: sessionContext,
        extra: extraContext
    })
```

Analysis basis: CC v2.1.176 bundle.js:+12775587

### Config File Loader (`hF8`)

```
function loadConfigFile(context):
    // Delegates to the shared config-reading subsystem (rf → sw)
    rawConfig = readConfigViaSwitch(context)   // rf → sw → XL, Fj, nf, ...
    sessionConfig = attachSessionConfig(rawConfig)  // C6
    return sessionConfig
```

Analysis basis: CC v2.1.176 bundle.js:+12775621

### Session Store Loader (`P8`)

```
function loadSessionStore(context):
    // Reads session metadata (timestamps, config lock, background session state)
    configTimestamp = getModifiedTime(context)    // MT
    sessionData = readSessionEntry(context)        // H, zXH, FK9, h06
    backgroundSession = loadBackgroundSession(context)  // G5H
    fallback = loadFallbackConfig(context)          // EaH
    writeConfig = saveConfigWithLock(context)       // d, D38
    return aggregateSessionStore(sessionData, backgroundSession, writeConfig)
```

Analysis basis: CC v2.1.176 bundle.js:+12775627

### Background Session File Operations (`G5H`)

This helper, reached through both `hF8`/`C6` and `P8`, performs low-level file I/O for background session state:

```
function backgroundSessionFileOps(sessionPath):
    if configAccessedBeforeAllowed:
        throw Error("Config accessed before allowed.")   // bundle.js:+3336726

    configRaw = fs.readFileSync(sessionPath, "utf-8")   // bundle.js:+3336782, +3336809
    parsed = jsonSafeParse(configRaw)                    // c6 → JSON.parse

    if parsed.code == "ENOENT":                          // bundle.js:+3336956
        return defaultConfig()

    backupDir = resolveBackupDir(sessionPath)            // gK9 → "backups" literal
    // Enumerate backup files, pick most recent, copy as needed
    backupFiles = fs.readdirStringSync(backupDir)
    for file in backupFiles:
        if file.startsWith(prefix):                      // Jm → H.startsWith
            candidate = path.join(backupDir, file)

    // Write new backup copy using timestamp
    timestamp = Date.now()                               // bundle.js:+3337847
    fs.copyFileSync(source, destination)                 // bundle.js:+3337865

    if error.code == "EEXIST":                           // bundle.js:+3337571
        // Directory already exists — skip mkdir
        pass
    elif error.code == "error":                          // bundle.js:+3337277
        emit("tengu_config_parse_error")                 // bundle.js:+3337357

    return parsedConfig
```

Analysis basis: CC v2.1.176 bundle.js:+3336720

### Config Lock Write (`j38` via `P8`)

```
function saveConfigWithLock(configPath, newData):
    ensureDir(path.dirname(configPath))              // f.mkdirSync, bundle.js:+3334509
    timestamp = Date.now()                           // bundle.js:+3334554
    lockResult = acquireConfigLock(configPath)       // dI1

    if lockContention:
        emit("tengu_config_lock_contention")         // bundle.js:+3334782
        // "Lock acquisition took longer than expected…"  bundle.js:+3334693

    reRead = readConfigFromDisk(configPath)

    if reRead is missing auth that cache has:
        emit("tengu_config_auth_loss_prevented")     // bundle.js:+3335261
        // "saveConfigWithLock: re-read config is missing auth…"  bundle.js:+3335109
        return  // refuse to write

    if staleWrite detected:
        emit("tengu_config_stale_write")             // bundle.js:+3334918

    backupFile = path.join(configDir, ".backup." + timestamp)  // bundle.js:+3335579
    // Keep at most 5 backup files                              // bundle.js:+3335712
    fs.copyFileSync(current, backupFile)
    atomicWrite = atomicFileWrite(configPath, newData)  // EY6

    return success
```

Analysis basis: CC v2.1.176 bundle.js:+3331539

### Atomic File Write (`EY6`)

```
function atomicFileWrite(targetPath, data):
    // Resolve any symlink at target
    if path is symlink:
        realTarget = fs.readlinkSync(targetPath)
        if not path.isAbsolute(realTarget):
            realTarget = path.resolve(path.dirname(targetPath), realTarget)

    if error.code in ["ELOOP", "ENOTDIR"]:          // bundle.js:+1091647, +1091660
        handle symlink loop or non-directory

    // Generate temp file name using random hex bytes
    randomSuffix = crypto.randomBytes(8).toString("hex")  // bundle.js:+1092018, +1092168
    tmpPath = targetPath + "." + randomSuffix

    // Write to temp, apply original permissions, fsync, rename
    fd = fs.openSync(tmpPath, flags)
    fs.writeFileSync(fd, data)
    fs.fchmodSync(fd, originalMode)                 // bundle.js:+1092484, +1092505
    fs.fsyncSync(fd)
    fs.closeSync(fd)
    fs.renameSync(tmpPath, targetPath)
    return success
```

Analysis basis: CC v2.1.176 bundle.js:+1091361

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_guest_passes_visited` (bundle.js:+12775727) — fired on every invocation of `/passes` |
| Telemetry (config subsystem) | `tengu_config_parse_error` (+3337357), `tengu_config_lock_contention` (+3334782), `tengu_config_stale_write` (+3334918), `tengu_config_auth_loss_prevented` (+3335261) |
| Telemetry (background session) | `tengu_bg_dispatch_sigkill_escalate` (+16981999), `tengu_bg_low_mem_mb` (+13372785), `tengu_bg_dispatch_low_mem` (+16982600), `tengu_bg_spare_enable` (+16983304), `tengu_bg_sendclaim_failed` (+16959837), `tengu_bg_spare_claim` (+16983432), `tengu_bg_spare_claim_fail` (+16983698), `tengu_bg_proto_mismatch` (+16967784), `tengu_bg_dispatch_stale_drop` (+16969183), `tengu_bg_attach_legacy_autorespawn` (+16972071), `tengu_bg_attach` (+16973229), `tengu_bg_attach_stall_gave_up` (+16974152), `tengu_bg_attach_stall_respawn` (+16974422), `tengu_bg_attach_kick` (+16975414), `tengu_scheduled_task_missed` (+16467492) |
| Telemetry (feature flags) | `tengu_feature_ok` (+1018758), `tengu_feature_bad` (+1018825) |
| File system | Reads `~/.claude.json` (or equivalent config path); may create backup files in a `backups/` subdirectory; performs atomic rename-based writes to protect config integrity |
| Config lock | Acquires a file-based config lock during write; emits contention telemetry if lock takes longer than expected |
| Auth-loss guard | Refuses to write config if re-read copy is missing auth fields that the in-memory cache holds (GH #3117 protection) |
| JSX rendering | Returns a JSX component (`ADA.createElement`) that the CLI shell renders as the guest-pass sharing UI |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | File-watch hooks registered by `ug4` (via `z38.watchFile` / `z38.unwatchFile`) on the config file path, used by the broader config subsystem reached during handler setup |

---

## Version History

| Version | Change |
|---|---|
| v2.1.176 | Initial analysis |

---

## Common Mistakes

1. **Expecting interactive input**: `/passes` takes no arguments and has no input branching. Passing text after the command name has no documented effect — the handler ignores it and always renders the guest-pass UI.
2. **Assuming instantaneous render**: The handler is `async` and loads both config and session state before returning the JSX element. On first invocation after a cold daemon start, this may take a noticeable moment due to background-session negotiation (`P8` → `G5H` → file I/O).
3. **Confusing with a prompt-type command**: `/passes` is registered as `local-jsx`, meaning it renders a React component directly, not a text response from the model. There is no LLM invocation.
4. **Overlooking the auth-loss guard**: If the on-disk config is re-read and found to be missing auth fields that the in-memory cache holds, the write is silently refused and `tengu_config_auth_loss_prevented` is emitted. This is a safety measure (GH #3117), not a bug.
5. **Misreading the backup count limit**: The config subsystem retains at most 5 backup files (bundle.js:+3335712). Older backups are pruned automatically; do not rely on a longer history.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `ZtL` | Main handler (`guestPassesHandler`) — async entry point for `/passes` |
| `C6` | Config-session attachment helper, called by both `hF8` and `kO` |
| `Q6` | Shared utility (path/error helper) referenced throughout config subsystem |
| `ZN_` | Config subsystem utility, called from `C6` |
| `G5H` | Background session file-operations helper (reads, backs up, writes session config) |
| `q` | Node.js `fs`-wrapper module (synchronous file I/O facade) |
| `u1` | CLI error exit helper (`kBH`, `kX`, `process.exit`) |
| `c6` | JSON safe-parse wrapper (`JSON.parse`) |
| `Jm` | String prefix/slice utility used on config paths |
| `H` | Random/timeout utility module (`Math.random`, `setTimeout`) |
| `_` | Extended `fs`-like utility (`readdirStringSync`, `statSync`) |
| `E8` | Shared constant or small utility referenced in multiple subsystems |
| `gK9` | Backup directory resolver (path join, dirname, readdirStringSync) |
| `vN_` | Path join + `M_` helper (backup path builder) |
| `M` | Session/config Map store (`LbH`, `Ho8`, `f.get/values`) |
| `$` | Config key lookup utility (`kPK`) |
| `N` | Config normalization / key formatting helper |
| `gff` | Config object builder (`Zy`, `BH_`, `JyA`) |
| `CH` | `JSON.stringify` wrapper |
| `bf` | Redaction/replacement helper (`[REDACTED]` literal, `ikA`, `H.replace`) |
| `kQH` | Config key mapping helper (`mkA`) |
| `lff` | File-content loader with byte-length tracking (`Buffer.byteLength`, `dH_`, `lH_`) |
| `d` | Shared low-level utility/context object, used across many callers |
| `D` | Background-session daemon orchestrator (spawn, kill, claim, retire) |
| `A` | String/case utility (`L.toLowerCase`) |
| `b` | Scheduled-task runner (`bRH`, `w`, `yZ9`, `P.has/add`) |
| `n8` | Abort-aware timeout helper (`K`, `setTimeout`, `clearTimeout`, `f.unref`) |
| `bH` | Feature-ok reporter (`d`, `eH`, `tengu_feature_ok`) |
| `IH` | Feature-bad reporter (`d`, `eH`, `tengu_feature_bad`) |
| `Yd8` | macOS memory helper (`a6`, `$6`) |
| `aSH` | Async file cleanup helper (`cJ.lstat/rm/readFile`, `Array.isArray`, `k8`) |
| `kH` | Background-session log error helper (`JA`, `A6`, `Aq`, `Ms.logError`) |
| `Q` | Background PTY socket manager (`l.on/once/destroy/connect`, `process.kill`) |
| `$6` | Spare-session enablement helper (`W06`, `G06`, `em`, `C6`) |
| `WVA` | Daemon claim/spawn helper (`ed.claim`, `K.socketAuth`, `Wo8.connect`) |
| `vVA` | Session lifecycle manager (done/killed/stopped/failed/crashed states) |
| `f` | Alias for `vVA` in certain call sites |
| `Y` | Forced-shutdown helper (`EX`, `process.exit`, `z.abort`) |
| `eH` | Event emitter initializer (`nM6`) |
| `F` | Disposable resource handle |
| `ug4` | Config file-watcher registration (`z38.watchFile/unwatchFile`, `Lq`, `Kg`) |
| `Kg` | Config-watcher callback utility |
| `u9` | Hook registration helper (`DyA.register`) |
| `hF8` | Config file loader — first call from `ZtL` |
| `rf` | Config read dispatch (`sw`, `C6`) |
| `sw` | Config read switch/router (`XL`, `Fj`, `nf`, `rA`, `QP`, `kO`, `L06`, `LaH`) |
| `XL` | Auth-header builder (`A6`, `dc6`, `--bare` flag) |
| `Fj` | Profile-implicit / OAuth config builder (`l18`, `LaH`, `yF`, `cV`, `KK9`) |
| `nf` | First-party auth handler (`o_`) |
| `QP` | Config read path selector |
| `kO` | API-key / auth-token resolver (`ANTHROPIC_API_KEY` literal, `apiKeyHelper`, `C6`) |
| `L06` | Config path → `LaH` delegator |
| `LaH` | Config file path resolver (`A6`, `L_H`) |
| `P8` | Session store loader — second call from `ZtL` |
| `j38` | Config lock-write implementation (mkdir, stat, backup, atomic write) |
| `dI1` | Config lock acquisition helper (`oJ_`, `Object.assign`) |
| `oJ_` | Lock primitive (`QI1`) |
| `EaH` | Fallback config loader |
| `V` | Versioned config entry helper |
| `P` | IPC framing / buffer splitter (`Buffer.concat`, `X.indexOf`, `mL`) |
| `X` | Socket read buffer (`M`, `q.setTimeout`) |
| `j` | Session kill helper (`A.values`, `S.kill`) |
| `mL` | IPC message finalizer (`H.end`, `CH`) |
| `qI5` | Full daemon IPC message dispatcher (ping/nudge/attach/reply/resize/snapshot/subscribe) |
| `TH` | String coercion utility |
| `E` | Slice/clamp utility (`W`, `Math.max`, `Math.min`) |
| `W` | SDK connection manager (`jM6`, `SR`, `Yh`, `Promise.all`, `kH`) |
| `EY6` | Atomic file-write implementation (symlink resolution, temp file, fchmod, fsync, rename) |
| `O` | Background-session label object (`m8`) |
| `k8` | Error-code helper (`E8`) |
| `L` | File-handle closer (`A.close`, `q.close`) |
| `zXH` | Session metadata reader |
| `FK9` | Config entries iterator (`Object.entries`) |
| `h06` | Config timestamp helper (`Date.now`) |
| `D38` | Config directory writer (`h06`, `MT`, `xX`, `CH`, `EY6`, `N`) |