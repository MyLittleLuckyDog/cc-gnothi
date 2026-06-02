---
type: feature-spec
feature: "passes"
cc_version: "2.1.152"
updated: "2026-06-01"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.152 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.152 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.152

---

## Overview

`/passes` is a local-JSX slash command that allows users to share a free week of Claude Code with friends via guest passes. When invoked, the handler (async function `j95`) navigates the user to a guest-pass sharing UI rendered as a JSX component, firing a telemetry event (`tengu_guest_passes_visited`) on entry. The command relies on the background session and config subsystems to surface pass availability.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| loc_byte | `12120995` |
| loc_byte_end | `12121317` |
| loc_line | `10050` |
| isHidden | `null` (not hidden) |
| module_id | `XF1` |
| load_inline | `true` |
| arbor_handler.name | `j95` |
| arbor_handler.fqn | `claude-2.1.152::j95` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.152 bundle.js:+12120995

---

## Input Branching

The command has a linear invocation flow with no user-supplied arguments. The handler fires unconditionally on invocation and delegates all rendering to the JSX layer. A simple numbered pseudocode representation is sufficient.

1. Command is invoked → handler `j95` is called.
2. Telemetry event `tengu_guest_passes_visited` is fired.
3. Background-session and config systems are accessed (via `backgroundSessionManager` and `configManager`) to determine pass state and availability.
4. A JSX element (via `createElement`) is constructed and returned, rendering the guest-pass sharing UI.

---

## Behavioral Spec

### Entry Point — `j95` (Main Handler)

Analysis basis: CC v2.1.152 bundle.js:+12120678

```
async function passesCommandHandler():
    emit telemetry("tengu_guest_passes_visited")       // bundle.js:+12120818

    sessionContext  = await getBackgroundSession()     // via backgroundSessionResolver (RV8) → bundle.js:+12120712
    configSnapshot  = await getConfigManager()         // via configManager (M8)            → bundle.js:+12120718
    appContext       = getAppContext()                  // via appContext accessor (c)         → bundle.js:+12120816

    return createElement(GuestPassesComponent, {       // bundle.js:+12120867
        sessionContext,
        configSnapshot,
        appContext
    })
```

### Background Session Resolution — `backgroundSessionResolver` (`RV8`)

Analysis basis: CC v2.1.152 bundle.js:+11756025

```
async function backgroundSessionResolver():
    sessionData = await sessionFactory()               // sessionFactory (B5)
    if sessionData is unavailable:
        return null
    rawConnection = await connectionFactory()          // connectionFactory (x6)
    return { sessionData, rawConnection }
```

`sessionFactory` (`B5`) internally calls the daemon launcher (`sD`) and raw connection builder (`x6`).
Analysis basis: CC v2.1.152 bundle.js:+2957668

### Config Manager Access — `configManager` (`M8`)

Analysis basis: CC v2.1.152 bundle.js:+3198454

```
async function configManager():
    baseConfig     = getBaseConfig()                   // baseConfig (BG)    → bundle.js:+3198458
    configEnvelope = await configLoader()              // configLoader (S$_) → bundle.js:+3198635

    if configEnvelope has stale auth:
        // Guard: refuse write to avoid auth loss (GH #3117)
        emit telemetry("tengu_config_auth_loss_prevented")   // bundle.js:+3201932
        return cachedConfig

    applyBackupRotation(configEnvelope)               // backup rotation (zzH) → bundle.js:+3198635
    return configEnvelope
```

### Config Loader — `configLoader` (`S$_`)

Analysis basis: CC v2.1.152 bundle.js:+3198454

```
async function configLoader():
    configDir = path.dirname(configPath)               // eY.dirname → bundle.js:+3201159
    ensureDir(configDir)                               // L.mkdirSync → bundle.js:+3201180
    timestamp = Date.now()                             // bundle.js:+3201225

    raw = readConfigFile()                             // via fileReader (Efq) → bundle.js:+3201238

    if lock contention detected:
        emit telemetry("tengu_config_lock_contention") // bundle.js:+3201453

    statResult = L.statSync(configPath)               // bundle.js:+3201529

    backupFiles = L.readdirStringSync(backupDir)       // bundle.js:+3202142
    // Filter backup files starting with ".backup." prefix → bundle.js:+3202177, literal ".backup." at bundle.js:+3202250

    // Keep at most 5 backup files                    // numeric literal 5 at bundle.js:+3202383
    while backupFiles.length > 5:
        L.unlinkSync(oldest backup)                   // bundle.js:+3202501

    L.copyFileSync(configPath, newBackupPath)          // bundle.js:+3202357
    applySymlinkResolution(configPath)                 // symlinkResolver (z76) → bundle.js:+3202623

    if stale write detected:
        emit telemetry("tengu_config_stale_write")     // bundle.js:+3201589

    return parsedConfig
```

Maximum backup copies retained: **5** (bundle.js:+3202383)

### Backup Rotation Logic — `backupRotator` (`zzH`)

Analysis basis: CC v2.1.152 bundle.js:+3203391

```
function backupRotator(configPath):
    if config not yet accessible:
        throw Error("Config accessed before allowed.")   // literal at bundle.js:+3203397

    rawBytes = fs.readFileSync(configPath, "utf-8")      // encoding literal "utf-8" at bundle.js:+3203480
    parsed   = jsonParse(rawBytes)                       // jsonParser (B6) → JSON.parse → bundle.js:+183827

    authToken = extractToken(parsed)                     // tokenExtractor (Mb) → bundle.js:+3203503
    // tokenExtractor checks startsWith and slices        → bundle.js:+1093421, 1093444

    backupDir  = resolveBackupDir(configPath)            // backupDirResolver (R$_) → bundle.js:+3204197
    // Backup directory name: "backups"                  // literal at bundle.js:+3202965

    if stat fails with "ENOENT":
        // No existing backup; proceed                   // literal "ENOENT" at bundle.js:+3203627
        emit telemetry("tengu_config_parse_error")       // bundle.js:+3204028 (on parse failure)

    fs.mkdirSync(backupDir, { recursive: true })         // bundle.js:+3204207
    existingBackups = fs.readdirStringSync(backupDir)    // bundle.js:+3204265

    timestamp    = Date.now()                            // bundle.js:+3204518
    fs.copyFileSync(configPath, backupPath(timestamp))   // bundle.js:+3204536
```

Error string constant: `"Config accessed before allowed."` (bundle.js:+3203397)
Encoding constant: `"utf-8"` (bundle.js:+3203480)

### Connection Builder — `connectionBuilder` (`x6`)

Analysis basis: CC v2.1.152 bundle.js:+3200280

```
function connectionBuilder(options):
    baseConfig  = getBaseConfig()             // Q6  → bundle.js:+3200280
    background  = getBackgroundManager()      // BG  → bundle.js:+3200294
    envSettings = getEnvSettings()            // N$_ → bundle.js:+3200313
    sessionWatcher = getSessionWatcher()      // zzH → bundle.js:+3200317
    timestamp   = Date.now()                  //      bundle.js:+3200369
    fileWatcher = startFileWatcher()          // C_7 → bundle.js:+3200422
    return { baseConfig, background, envSettings, sessionWatcher, fileWatcher }
```

### File Watcher — `fileWatcher` (`C_7`)

Analysis basis: CC v2.1.152 bundle.js:+3199787

```
function fileWatcher(path, options):
    background   = getBackgroundManager()    // BG  → bundle.js:+3199787
    fs.watchFile(path, callback)             // y68.watchFile → bundle.js:+3199792
    baseConfig   = getBaseConfig()           // Q6  → bundle.js:+3199873
    version      = getVersion()              // V9  → bundle.js:+3199956
    tokenSlicer  = getTokenSlicer()          // Mb  → bundle.js:+3199959
    envSettings  = getEnvSettings()          // N$_ → bundle.js:+3200017
    extraInfo    = getExtraInfo()            // xi  → bundle.js:+3200025
    register     = registerWatcher()         // tq → CMA.register → bundle.js:+3200106, 58661
    on dispose:
        fs.unwatchFile(path)                 // y68.unwatchFile → bundle.js:+3200119
```

### Background Session Subsystem — `backgroundDispatcher` (`w`)

Analysis basis: CC v2.1.152 bundle.js:+15382213

The background dispatcher (`w`) is a shared subsystem reached transitively from the `/passes` handler via `backgroundSessionResolver`. It manages memory-constrained background session lifecycle:

```
function backgroundDispatcher(sessionRequest):
    session = sessionCache.get(sessionRequest)         // A.get → bundle.js:+15382213

    if memoryLow:
        emit telemetry("tengu_bg_dispatch_low_mem")    // bundle.js:+15382910
        escalate = true

    if escalate and SIGKILL needed:
        process.kill(pid, "SIGKILL")                   // literal "SIGKILL" → bundle.js:+15382379
        emit telemetry("tengu_bg_dispatch_sigkill_escalate")  // bundle.js:+15382331

    freeMem = os.freemem()                             // s4A.freemem → bundle.js:+15382740
    memMB   = Math.round(freeMem / 1024 / 1024)        // Math.round → bundle.js:+15382791

    spareSession = claimSpare()                        // spareSessionClaimer (d4A) → bundle.js:+15383659

    if spare claimed:
        emit telemetry("tengu_bg_spare_claim")         // bundle.js:+15383726
    else:
        emit telemetry("tengu_bg_spare_claim_fail")    // bundle.js:+15383989

    if spare enabled:
        emit telemetry("tengu_bg_spare_enable")        // bundle.js:+15383605

    if spare needs spawn:
        emit telemetry("tengu_bg_spare_spawn")         // bundle.js:+15382024

    activeSession = sessionRunner(sessionRequest)      // sessionRunner (a4A) → bundle.js:+15383705
    sessionCache.set(sessionRequest, activeSession)    // A.set → bundle.js:+15383688
    return activeSession
```

Memory-check constants:
- Maximum background session process count before kill escalation: **30** (bundle.js:+15382286)
- Kill escalation timeout threshold: **15** (seconds) (bundle.js:+15382297)
- Idle session retirement timeout: **300000 ms** (5 min) (bundle.js:+15389095)
- Dispatcher loop interval: **2000 ms** (bundle.js:+15381957)

Session state values observed in literals (bundle.js:+15387528–+15387899):
`"done"`, `"killed"`, `"stopped"`, `"failed"`, `"crashed"`, `"blocked"`, `"working"`, `"active"`, `"idle"`, `"resuming"`, `"bg"`, `"daemon"`

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_guest_passes_visited` (bundle.js:+12120818) — fired on every invocation of `/passes` |
| Telemetry | `tengu_config_parse_error` (bundle.js:+3204028) — fired if config JSON fails to parse during backup |
| Telemetry | `tengu_config_lock_contention` (bundle.js:+3201453) — fired when config file lock takes longer than expected |
| Telemetry | `tengu_config_stale_write` (bundle.js:+3201589) — fired when a stale config write is detected |
| Telemetry | `tengu_config_auth_loss_prevented` (bundle.js:+3201932) — fired when a write is blocked to protect auth |
| Telemetry | `tengu_bg_dispatch_low_mem` (bundle.js:+15382910) — background low-memory condition |
| Telemetry | `tengu_bg_dispatch_sigkill_escalate` (bundle.js:+15382331) — background SIGKILL escalation |
| Telemetry | `tengu_bg_spare_enable` (bundle.js:+15383605) — spare session enabled |
| Telemetry | `tengu_bg_spare_claim` (bundle.js:+15383726) — spare session successfully claimed |
| Telemetry | `tengu_bg_spare_claim_fail` (bundle.js:+15383989) — spare session claim failed |
| Telemetry | `tengu_bg_spare_spawn` (bundle.js:+15382024) — spare session spawned |
| Telemetry | `tengu_bg_low_mem_mb` (bundle.js:+12685538) — low memory in MB reported (macOS-specific; literal `"macos"` at bundle.js:+12685511, threshold `1024` MB at bundle.js:+12685560) |
| Telemetry | `tengu_feature_ok` (bundle.js:+964519) — feature flag check passed |
| Telemetry | `tengu_feature_bad` (bundle.js:+964577) — feature flag check failed |
| File system (config) | Up to **5** backup copies of `~/.claude.json` are retained in the `backups/` subdirectory; older copies are pruned on each config write (bundle.js:+3202383, +3202965) |
| File system (config) | Config is copied atomically via `copyFileSync` with timestamp-stamped backup filename (bundle.js:+3204536) |
| Auth guard | If a re-read config is missing auth that the cache holds, the write is refused to prevent wiping auth credentials — see GH #3117 (literal at bundle.js:+3201780) |
| Hook registration | `CMA.register` called by file watcher (`tq`) — bundle.js:+58661 |
| Background session | Spare session pool is managed; SIGKILL may be sent to stale processes (bundle.js:+15382379) |
| JSX render | Returns a `createElement`-produced component tree for the guest-pass UI (bundle.js:+12120867) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.152 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/passes` without active authentication** — The config subsystem refuses writes if it detects an auth token in cache that is absent in the re-read config (GH #3117 guard). Ensure `~/.claude.json` is consistent before invoking.
2. **Expecting instant UI if the background session is low on memory** — The background dispatcher will attempt SIGKILL escalation on stale processes before returning a session, which may introduce perceptible latency.
3. **Assuming unlimited config backups** — Only the **5** most recent backup files are kept in the `backups/` directory; older ones are silently deleted on each invocation that triggers a config write.
4. **Treating `/passes` as a prompt command** — This command is typed `local-jsx`; it renders a UI component, not a text prompt. It does not send any instruction text to the AI model.
5. **Running on Windows without daemon support** — The literal `"windows"` at bundle.js:+15388669 suggests platform-specific handling in the session runner; some background session states may not be reachable on Windows.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `j95` | Main handler for `/passes` command (AsyncFunction; arbor_handler) |
| `x6` | Connection builder — constructs background connection context |
| `Q6` | Base config accessor |
| `N$_` | Environment settings accessor |
| `zzH` | Backup rotator — reads, parses, and copies config file into backups dir |
| `B6` | JSON parser wrapper (calls `JSON.parse`) |
| `Mb` | Token extractor — checks `startsWith` and `slice` on auth token |
| `H` | Random/timer utility (calls `Math.random`, `setTimeout`) |
| `_` | Filesystem utility (readdirStringSync, statSync, toUpperCase) |
| `L8` | Logging utility |
| `zpq` | Directory scanner — reads directory and filters entries |
| `R$_` | Backup directory path resolver (calls `path.join`, `l8`) |
| `f` | MCP session filter / registry accessor |
| `$` | Path/registry utility (startsWith, Sn1) |
| `N` | HTTP/network request builder |
| `OyK` | Network option constructor (calls `dv`, `$yK`, `xMA`) |
| `CH` | JSON stringifier wrapper |
| `j4` | String/path formatter (replace, at, lastIndexOf, slice) |
| `VxH` | Environment variable extractor (`e3A`) |
| `DyK` | Config write coordinator (buffer, lock, bind) |
| `c` | App context accessor |
| `w` | Background session dispatcher |
| `A` | Session cache map |
| `R` | Process killer (sends signals to background processes) |
| `mH` | Background session error handler (calls `c`) |
| `SH` | Background session success handler (calls `c`) |
| `jI8` | Memory check utility (calls `a6`, `E6`; macOS-specific) |
| `mY6` | Background file reader (reads and parses JSON files) |
| `hH` | Session health checker (calls `n_`, `uH`, `V1`, `UtK`) |
| `B` | Session retirement utility (filters settled sessions) |
| `E6` | Spare session enabler / background mode toggler |
| `d4A` | Spare session claimer (calls `_F.claim`, connects socket) |
| `a4A` | Active session runner (manages lifecycle, cleanup, timeout) |
| `L` | Session queue / pending-set manager |
| `D` | Dispatcher loop (periodic check: memory, spare, session state) |
| `S` | Disposable resource handle |
| `C_7` | File watcher — wraps `fs.watchFile` / `fs.unwatchFile` |
| `xi` | Extra session metadata accessor |
| `tq` | Watcher registration (calls `CMA.register`) |
| `RV8` | Background session resolver (called from `j95`) |
| `B5` | Session factory (calls `sD`, `x6`) |
| `sD` | Daemon launcher / session initializer |
| `A4` | Auth token validator (calls `uH`) |
| `VN` | Session negotiator (calls `Xn6`, `A4`, `Hi`, `vN`, `uH`) |
| `gO` | First-party provider getter (calls `yA`) |
| `QJ` | Session options builder |
| `JO` | Session orchestrator (full auth + connection flow) |
| `o1H` | Session opener (calls `uH`, `H3H`) |
| `M8` | Config manager — top-level config access/write coordinator |
| `S$_` | Config file loader (mkdir, read, backup rotation, stat) |
| `Efq` | File reader factory (calls `Iq_`, `Object.assign`) |
| `Iq_` | Inner file reader (calls `Zfq`) |
| `uO6` | Config update notifier |
| `V` | Config version checker (startsWith) |
| `P` | MCP connection handler (Promise.all, hH, n_) |
| `IR8` | MCP transport initializer |
| `n_` | Error normalizer (calls `Error`, `String`) |
| `Z` | Config entry slicer |
| `z76` | Symlink resolver / atomic file writer (readlink, rename, writeFileSync, fchmod) |
| `O` | File stat descriptor (isSymbolicLink, calls `k8`) |
| `j8` | Logging helper (calls `L8`) |
| `M` | Socket/stream handle (write, on, once, end, close) |
| `bgH` | Background config flag accessor |
| `Opq` | Config entries iterator (`Object.entries`) |
| `xgH` | Config timestamp tracker (`Date.now`) |
| `h$_` | Config path handler (dirname, join, CH, z76) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.