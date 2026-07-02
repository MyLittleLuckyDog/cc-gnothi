---
type: feature-spec
feature: "daemon"
cc_version: "2.1.198"
updated: "2026-07-02"
tags: ["daemon", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.198 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/daemon`

> Analysis basis: CC v2.1.198 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.198

---

## Overview

`/daemon` manages Claude Code's background service infrastructure, providing interactive control over the daemon lifecycle (start, stop, restart, uninstall), background worker sessions, scheduled task runners, and remote-control connections. The command renders a JSX UI component that presents live status for each subsystem and accepts sub-commands as its argument. It is a `local-jsx` command, meaning all logic runs in-process without spawning an external agent turn.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `daemon` |
| description | `Manage background services and routines` |
| loc_byte | `13547391` |
| loc_byte_end | `13547559` |
| loc_line | `9217` |
| immediate | `true` |
| module_id | `nqo` |
| load_inline | `true` |
| arbor_handler.name | `qlm` |
| arbor_handler.fqn | `claude-2.1.198::qlm` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.198 bundle.js:+13547391

---

## Input Branching

The command accepts an optional sub-command string from the user. Five distinct named branches are visible in the implementation, plus a default "hub" view, yielding 6+ paths — a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/daemon [subcommand]"] --> B{Parse subcommand argument}

    B -->|"start"| C[Invoke daemonStart\nkickstart via launchctl on macOS\nor direct spawn on other platforms]
    B -->|"stop"| D[Invoke daemonStop\nSIGTERM → wait → SIGKILL escalation]
    B -->|"restart"| E[Invoke daemonRestart\nstop then kickstart;\nfails if daemon does not exit within 10s]
    B -->|"uninstall"| F[Invoke daemonUninstall\nbootout via launchctl;\nnot available on darwin in some configs]
    B -->|"detail-scheduled"| G[Render ScheduledTasksDetail panel]
    B -->|"detail-remoteControl"| H[Render RemoteControlDetail panel]
    B -->|no subcommand / "hub"| I[Render hub overview:\ndaemon status · bg workers · scheduled · remoteControl]

    C --> J[Render JSX result via daemonCommandUI]
    D --> J
    E --> J
    F --> J
    G --> J
    H --> J
    I --> J

    J --> K[Unmount ink instance on completion]
```

Analysis basis: CC v2.1.198 bundle.js:+13537993, +13538133, +13538242, +13537804, +12056115, +12056151, +12056191

---

## Behavioral Spec

### 1. Top-level handler (`qlm`)

The Arbor-resolved handler `qlm` is an `AsyncFunction` reached via `module_id → nqo`. It is the command's entry point.

```
async function daemonCommandHandler(args, appState):
    statusBundle = await gatherAllDaemonStatus()   // eqo
    uiNode = renderDaemonUI(statusBundle, args)    // Zc.jsx + Hdc
    return uiNode
```

Analysis basis: CC v2.1.198 bundle.js:+13537241

---

### 2. Status aggregation (`eqo`)

Collects status from all daemon subsystems in parallel before rendering.

```
async function gatherAllDaemonStatus():
    results = await Promise.all([
        readScheduledTasksStatus(),    // ddc  — reads scheduled-tasks roster
        readDaemonStatusFile(),        // odc  — reads daemon.status.json / daemon.json
        readScheduledDaemonStatus(),   // Blc  — reads daemon.scheduled.status.json
        readForegroundDaemonStatus(),  // Huc  — reads daemon.scheduled.status.json (fg variant)
        readRosterFile(),              // V4   — reads roster.json; parses worker entries
        readLaunchctlInfo(),           // zZ   — runs `launchctl print` (macOS, timeout 5000 ms)
    ])

    keys = Object.keys(results)
    return Promise.resolve(summarise(results))
```

Analysis basis: CC v2.1.198 bundle.js:+13536800, +13536828, +13536847, +13536853, +13536874, +13536896, +13536918, +13536936, +13536941

---

### 3. Daemon status file reader (`odc` / `SXe`)

Reads `daemon.json` (and `daemon.status.json`) from the Claude config directory.

```
async function readDaemonStatusFile(configDir):
    path = join(configDir, "daemon.json")          // literal: "daemon.json" +12053678
    stat = await fs.stat(path)
    if stat error code == "ENOENT":                // literal +13523493
        return Promise.reject(notFoundError)
    if not stat.isFile():
        return Promise.reject(typeError)
    storeContext = getStoreContext()               // Ys → yEd.getStore
    sessionId = generateSessionId()               // JVo → XVo
    content = await fs.readFile(path)
    decoded = decodeUtf8(content)                  // he → String
    parsed = parseJson(decoded)                    // $a
    keys = Object.keys(parsed)
    // column-pad keys for display ("  " separator, pad width from o.padEnd)
    return formattedStatus
```

File name constant: `"daemon.json"` (bundle.js:+12053678)
Padding literal: `"  "` (bundle.js:+18403772)

Analysis basis: CC v2.1.198 bundle.js:+13525255

---

### 4. Scheduled-tasks status reader (`ddc`)

Reads the scheduled-tasks roster and parses it. Uses `"scheduled"` tag (literal `+13443169`) to filter entries. File read limit: 1 048 576 bytes (literal `+13347193`), encoding `"utf8"` (literal `+13347312`).

```
async function readScheduledTasksStatus():
    results = await Promise.all([
        readTasksRoster(),             // jIt — reads tasks roster; applies 1 MiB cap
        resolveErrorReporter(),        // Re  — wraps sr (string-coerce error) + st + qi + jvu
        resolveChecker(),              // ck  — reads PID file, sends process.kill(pid,0) probe
    ])
    return results
```

Analysis basis: CC v2.1.198 bundle.js:+13531627, +13531640, +13531658, +13531669

---

### 5. Roster file reader (`V4`)

Reads `roster.json` from the Claude data directory to enumerate background worker sessions.

```
async function readRosterFile(dataDir):
    path = rosterPath(dataDir)      // fie → pie → join(..., "roster.json")
    stat = await fs.lstat(path)

    if not stat.isFile():
        logWarning("is not a regular file — removing")   // literal +12065026
        if error code in ["E2BIG", "EFTYPE"]:            // literals +12065152, +12065164
            await fs.rm(path)
            raise error with detail
        rename to timestamped backup via qir (Date.now suffix)
        raise error

    raw = await fs.readFile(path)
    text = decodeUtf8(raw)             // mn → en
    merged = mergeWithDefaults(text)   // $o → Object.assign
    logError if needed                 // sr
    validated = validateShape(merged)  // gd → en
    hasKey = AGf.has(key)
    // iterate entries with nGl (Array.isArray / Object.keys checks)
    // apply GZe (gd + B5 + Um → OQe) for each entry
    // apply Do → OQe for registry lookup
    return workerList

// On any parse failure:
// emit telemetry: tengu_bg_roster_parse_failed  (+12065072)
// log: "bg roster.json read/parse failed"       (+12065394)
```

Literal: `"roster.json"` (bundle.js:+12060623)
Literal: `"bg roster.json read/parse failed"` (bundle.js:+12065394)

Analysis basis: CC v2.1.198 bundle.js:+12064879, +12065072, +12065394

---

### 6. PID-file prober / process killer (`ck` / `VZ`)

Used by both `ddc` and `odc` to check whether a daemon process is alive and to optionally kill it.

```
async function probePidFile(pidFilePath):
    stat = await fs.lstat(pidFilePath)
    if not stat.isFile():
        await fs.rm(pidFilePath, { maxRetries: 65536 })   // literal +12052181
        return null
    raw = await fs.readFile(pidFilePath)
    decoded = decodeUtf8(raw)                              // mn
    parsed = parseJson(decoded)                            // $a
    return parsed

function sendSignalZero(pid):
    process.kill(pid, 0)         // probe only — throws if process not found

async function killDaemonProcess(pidFilePath):
    pidData = await readPidFile(pidFilePath)         // M9o
    lines = pidData.split(...)                       // t.split
    slice = lines.slice(...)                         // n.slice
    // literal "claude daemon" found in log lines    (+12053105)
    // literal 4 (column width)                     (+12053132)
    // literal "daemon"                              (+12053144)
    process.kill(pid, signal)
    await waitForExit()                              // wI → zk
```

Analysis basis: CC v2.1.198 bundle.js:+12053186, +12053213, +12053263, +12053296

---

### 7. launchctl probe (`zZ` / `Fir` / `j6l`)

On macOS, retrieves service status by running `launchctl print`. Timeout: 5000 ms (literal `+12057313`).

```
async function queryLaunchctl():
    servicePath = buildServicePath()    // Dn → Wr (execFileNoThrow, 10 concurrent limit +1152784)
    args = ["print", servicePath]       // literal "print" +12057279
    result = await execFileNoThrow("launchctl", args, { timeout: 5000 })
    uid = process.getuid()             // j6l +12054062
    domainTarget = buildDomainTarget(uid)  // Fir → j6l
    return parseResult(result)
```

Literals: `"launchctl"` (+12057266), `"print"` (+12057279), timeout `5000` (+12057313)
macOS library path fragments: `"Library"` (+12053993), `"LaunchAgents"` (+12054003)
Home directory via: `P9o.homedir()` (+12053979)

Analysis basis: CC v2.1.198 bundle.js:+12057263, +12057287

---

### 8. Daemon lifecycle sub-commands

#### Start (`U9o`)

```
async function daemonStart():
    uid = process.getuid()         // Fir → j6l
    target = buildServiceTarget(uid)
    if platform == "darwin":       // literal +12056774
        await execFileNoThrow("launchctl", ["kickstart", target])  // literal "kickstart" +12056126
    else:
        await directSpawn()
```

Literal: `"start"` (+12056115), `"kickstart"` (+12056126)

#### Stop (`U9o` stop branch)

```
async function daemonStop():
    await execFileNoThrow("launchctl", ["stop", target])   // literal "stop" +12056151
    // falls through to process.kill if still alive
```

#### Restart (`U9o` restart branch)

```
async function daemonRestart():
    await daemonStop()
    // wait up to 10 s for SIGTERM compliance
    // if not exited: abort with message
    //   "daemon did not exit within 10s of SIGTERM; restart aborted before kickstart"
    //   literal +12056448; poll interval 50 ms +12056419
    await daemonStart()
```

Literals: `"restart"` (+12056191), `50` poll ms (+12056419), `"daemon did not exit within 10s of SIGTERM; restart aborted before kickstart"` (+12056448)

#### Uninstall (`Gbt`)

```
async function daemonUninstall():
    if not darwin:
        throw "service uninstall not available on darwin"   // literal +12055895
    uid = process.getuid()
    target = buildDomainTarget(uid)
    await execFileNoThrow("launchctl", ["bootout", target]) // literal "bootout" +12055764
    await fs.unlink(plistPath)                              // KZ.unlink
    decoded = decodeUtf8(output)                            // mn
    result = formatResult(decoded)                          // he
```

Literals: `"bootout"` (+12055764), `"uninstall"` (+13537804), `"service uninstall not available on darwin"` (+12055895)

Analysis basis: CC v2.1.198 bundle.js:+12056009, +12055736, +12055804

---

### 9. Background worker supervisor loop (`g` / `gis`)

The supervisor manages background session workers. Key behaviors observed from the call graph:

```
function supervisorTick(state):
    // Memory pressure handling
    freeMem = os.freemem()                    // QJc.freemem
    if freeMem low:
        emit telemetry "tengu_bg_dispatch_low_mem"   (+18375462)
        shedNonPinnedWorkers()
        if still low:
            log "bg: low memory persists after shedding non-pinned — retiring pinned settled workers as a last resort"
            // literal +18379970
            emit "tengu_bg_retire_pinned_low_mem"    (+18380081)

    // Spare-worker pool
    if sparePoolEnabled:
        emit "tengu_bg_spare_enable"   (+18376152)
    if spareClaimSucceeded:
        emit "tengu_bg_spare_claim"    (+18376280)
    else:
        emit "tengu_bg_spare_claim_fail"  (+18376546)

    // Worker lifecycle
    for worker in workers.values():
        worker.retireIfSettled()
        worker.respawnIfIdleStale()

    // SIGKILL escalation
    if killEscalated:
        emit "tengu_bg_dispatch_sigkill_escalate"   (+18374756)
        process.kill(pid, "SIGKILL")               // literal +18374804

    // Spawn new worker
    Dz.spawn(workerConfig)
    emit "tengu_daemon_bg_session_create"   (+18374571)

    // Tombstone / handoff
    if handoffSettled:
        emit "tengu_bg_handoff_settle"   (+18382136)
```

Worker process states (literals observed):
`"stopped"`, `"working"`, `"active"`, `"bg"`, `"crashed"`, `"blocked"`, `"killed"`, `"failed"`, `"done"`, `"resuming"`, `"claimed"`, `"spare"`, `"exec"`, `"spawned"`, `"dropped"`

Worker session state file: `"state.json"` (bundle.js:+18382447)
SIGTERM signal: `"SIGTERM"` (+18376802)
SIGKILL signal: `"SIGKILL"` (+18374804)
Kill grace period: 30 s (+18374711), 15 s (+18374722), 100 ms retry (+18374831)

Analysis basis: CC v2.1.198 bundle.js:+18374562, +18375303, +18376609

---

### 10. Config-reload watcher (`d` / `k`)

A file-watcher interval loop monitors config files and triggers config reloads on `add`, `change`, `unlink` events.

```
function startConfigWatcher(configPath):
    watcher = N.watch(configPath)       // N.watch +17356006
    watcher.on("add",    onFileChange)  // literal +17356199
    watcher.on("change", onFileChange)  // literal +17356226
    watcher.on("unlink", onFileChange)  // literal +17356256

    intervalHandle = setInterval(tick, interval)  // +17355815

    function tick():
        // reads MCP server configs from hSe (M$n.join path)
        // updates running servers: A.stop / A.updateConfig / A.start / I.start
        // emits tengu_daemon_config_reload (+18392244)

    // clearInterval on shutdown
    clearInterval(intervalHandle)          // +17355649
    g.clear()
```

Analysis basis: CC v2.1.198 bundle.js:+17355815, +17356006, +17356118, +18392244

---

### 11. Scheduled tasks runner (`tts` / `k`)

Manages a scheduled-task lock file and heartbeat. Writes and cleans up lock files, appends to log files, and emits status.

```
async function runScheduledTasks(taskList):
    lockAcquired = await acquireLock()     // J3c — checks X3c Set, writes lock file via Bvt
    if not lockAcquired: return

    // Execute each task
    for task in taskList:
        await execTask(task)           // tl / kt
        logEntry = buildLogEntry()     // Ene → C_e
        timestamp = Date.now()         // +17351339
        writeStatus(logEntry)          // Z3c → Jie.writeFile
        appendLog(logEntry)            // Bvt.appendFile

    // Release lock
    await tsn()           // sends signal, deletes lock file, logs "[ScheduledTasks] released scheduler lock"
    Jie.unlink(lockPath)  // literal +17351838

    // Kill stale daemon if needed
    XL → process.kill     // +2355874
```

Literals: `"[ScheduledTasks] released scheduler lock"` (+17352088), `"info"` (+17349881), `"exclude"` (+17349888), `"utf-8"` (+17349934), `"wx"` (exclusive open flag, +17350916), `"EEXIST"` (+17350954)

Status file: `"daemon.scheduled.status.json"` (+13441663)

Analysis basis: CC v2.1.198 bundle.js:+17351240, +17351600, +17352067

---

### 12. Daemon yield behavior (`d` write path)

When the in-process supervisor detects a foreground or service daemon has taken over, it yields:

```
function yieldToDaemon(supervisorState):
    if supervisorState.role == "transient":        // literal +18396890
        log "yielding to a foreground/service daemon — bg workers will be re-adopted"
        // literal +18396943
        emit telemetry "tengu_daemon_yield"        // +18397025
        d.write("supervisor", ...)                 // literal +18391451
```

Analysis basis: CC v2.1.198 bundle.js:+18396890, +18396943, +18397025

---

### 13. UI rendering pipeline (`qlm` → `Hdc` → `tqo`)

```
function renderDaemonUI(statusBundle, args):
    // tqo is the React/Ink component for the daemon panel
    view = determineView(args.subcommand):
        "hub"                → HubView (default)
        "detail-scheduled"   → ScheduledDetailView
        "detail-remoteControl" → RemoteControlDetailView
        "new"                → NewSessionView

    return Zc.jsx(Hdc, {
        status: statusBundle,
        view: view,
        onExit: () => inkInstance.unmount()
    })
```

Literal view names: `"hub"` (+13537500), `"new"` (+13538073), `"detail-scheduled"` (+13537993), `"detail-remoteControl"` (+13538133), `"remoteControl"` (+13538242)
UI section labels: `"Scheduled"` (+13538523), `"Remote Control"` (+13538809), `"Claude daemon"` (+13539083), `"permission"` (+13539171)

Analysis basis: CC v2.1.198 bundle.js:+13537254, +13537293, +13538019

---

### 14. Daemon stop via `Blc` / `Huc`

These functions handle signalling a running daemon by reading the appropriate status JSON, extracting the PID, and issuing `process.kill`.

```
async function stopRunningDaemon(statusFilePath):
    storeCtx = getStoreContext()     // Ys → yEd.getStore
    pidPath = buildPidPath()         // ftn → Ulc.join + er
    pidData = parseJson(await readFile(pidPath))   // $a
    if pidData.pid:
        process.kill(pidData.pid, signal)
        await waitForExit()          // wI
```

File: `"daemon.status.json"` (+13346372) used by `Blc`
File: `"daemon.scheduled.status.json"` (+13441663) used by `Huc`

Analysis basis: CC v2.1.198 bundle.js:+13346659, +13346856, +13346991, +13441871, +13442070, +13442126

---

### 15. Memory-pressure sweep (`N` / `oXe` / `Ssc`)

The sweep runs on a timer and monitors system free memory.

```
function memorySweep(workerMap):
    // Check macOS platform    // literal "macos" +13148779
    freeMem = os.freemem()     // oXe → Esc.freemem +13148794
    if freeMem < threshold:
        emit "tengu_bg_dispatch_low_mem"
        shedWorkers()
    // Grace-clock advance: 480 ms (+13149327), period 60 000 ms (+13149332)
    emit "tengu_bg_retire_grace_bridged_min"   // +13149291
    emit "tengu_bg_attach_upgrade"             // +13149363
    // Prewarm budget per sweep
    emit "tengu_bg_prewarm_per_sweep"          // +18380206
    // Count: min 3 (+18380235), max 12 (+18380241)
```

Analysis basis: CC v2.1.198 bundle.js:+13148794, +13149291, +13149327, +13149332

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_bg_roster_parse_failed` | Fired when `roster.json` cannot be read or parsed (bundle.js:+12065072) |
| Telemetry: `tengu_feature_ok` | Feature-gate success path (bundle.js:+1039573) |
| Telemetry: `tengu_feature_bad` | Feature-gate failure path (bundle.js:+1039640) |
| Telemetry: `tengu_daemon_control` | Fired on daemon lifecycle control actions (bundle.js:+18414881) |
| Telemetry: `tengu_daemon_config_reload` | Fired when config file change triggers server reload (bundle.js:+18392244) |
| Telemetry: `tengu_daemon_yield` | Fired when in-process supervisor yields to a service daemon (bundle.js:+18397025) |
| Telemetry: `tengu_daemon_bg_session_create` | Fired when a new background worker session is spawned (bundle.js:+18374571) |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Fired when SIGTERM was not sufficient and SIGKILL is sent (bundle.js:+18374756) |
| Telemetry: `tengu_bg_dispatch_low_mem` | Fired when free memory is below the threshold (bundle.js:+18375462) |
| Telemetry: `tengu_bg_retire_pinned_low_mem` | Fired when even pinned workers are retired due to memory pressure (bundle.js:+18380081) |
| Telemetry: `tengu_bg_spare_enable` | Fired when the spare-worker pool is enabled (bundle.js:+18376152) |
| Telemetry: `tengu_bg_spare_claim` | Fired on successful spare-worker claim (bundle.js:+18376280) |
| Telemetry: `tengu_bg_spare_claim_fail` | Fired when spare-worker claim fails (bundle.js:+18376546) |
| Telemetry: `tengu_bg_sendclaim_failed` | Fired when a send-claim operation to a worker fails (bundle.js:+18367663) |
| Telemetry: `tengu_bg_handoff_settle` | Fired when a handoff/yield to another worker settles (bundle.js:+18382136) |
| Telemetry: `tengu_bg_retire_grace_bridged_min` | Fired on memory grace-clock advance (bundle.js:+13149291) |
| Telemetry: `tengu_bg_attach_upgrade` | Fired when a background attach is upgraded (bundle.js:+13149363) |
| Telemetry: `tengu_bg_prewarm_per_sweep` | Fired with prewarm budget count each sweep (bundle.js:+18380206) |
| Telemetry: `tengu_voice_circuit_breaker_tripped` | Voice subsystem — circuit breaker activated (bundle.js:+15277499) |
| Telemetry: `tengu_voice_recording_started` | Voice subsystem — recording session started (bundle.js:+15279066) |
| Telemetry: `tengu_voice_stream_early_retry` | Voice subsystem — stream early-retry triggered (bundle.js:+15280620) |
| File writes | `daemon.json`, `daemon.status.json`, `daemon.scheduled.status.json`, `roster.json`, `state.json`; lock files and log append via `Bvt.appendFile` |
| File watches | `N.watch` monitors MCP config files for `add`/`change`/`unlink` events |
| Process signals | `process.kill(pid, 0)` for liveness probe; `SIGTERM` then `SIGKILL` for shutdown |
| launchctl (macOS) | Invoked for `kickstart`, `stop`, `bootout`, `print` sub-commands with 5 000 ms timeout |
| Ink instance | Mounted with `i.render(Zc.jsx(...))` and explicitly unmounted with `i.unmount()` on exit (bundle.js:+13546838, +13546990) |
| appState changes | Supervisor updates worker map entries; `tengu_daemon_config_reload` indicates config state refresh |
| Sound | No audio events observed (voice telemetry is passive monitoring only) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.198 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/daemon uninstall` on a non-macOS platform** — the `bootout` path explicitly guards against non-darwin platforms and will emit `"service uninstall not available on darwin"` as an error message. The message text is counter-intuitive (it says "not available on darwin" but is actually raised on *non*-darwin); read it as "this subcommand relies on the darwin launchctl path."
2. **Expecting `/daemon restart` to be instantaneous** — the restart sequence waits up to 10 seconds for SIGTERM compliance (50 ms polling interval) before giving up; if the daemon process is stuck, the restart is aborted rather than forcing SIGKILL at this stage.
3. **Assuming roster.json is always fresh** — when `V4` detects `roster.json` is not a regular file, it renames it to a timestamped backup and raises an error. The next invocation will see an empty roster until the daemon rewrites it.
4. **Running `/daemon stop` when no PID file exists** — the PID-probe function (`ck` / `VZ`) will attempt `fs.lstat`; an `ENOENT` result causes `fs.rm` to be called on a nonexistent path, which is caught and returns `null` gracefully, but the caller may show a "daemon not running" result.
5. **Confusing the `"transient"` supervisor role** — when the daemon runs transiently (e.g., inside a short-lived foreground session), it yields to any service/foreground daemon that takes over, emitting `tengu_daemon_yield`. This is expected behavior, not an error.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `qlm` | Main daemon command handler (AsyncFunction; Arbor-resolved entry point) |
| `ecm` | Inline command runner / JSX host that mounts and unmounts the Ink instance |
| `eqo` | Parallel daemon status aggregator (calls all sub-readers via Promise.all) |
| `ddc` | Scheduled-tasks status collector |
| `jIt` | Tasks roster reader coordinating `tVo`, `xVo`, `wVo` |
| `tVo` | Individual roster-file line reader (1 MiB cap, JSON.parse) |
| `xVo` | Array shape validator for roster entries |
| `Re` | Error reporter / log-error dispatcher |
| `sr` | String-coerce error helper |
| `st` | String converter utility |
| `qi` | Essential-traffic queue checker (`"essential-traffic"` literal) |
| `jvu` | Queue shift/push helper (`Bmn` queue) |
| `ck` | PID file prober and process-kill dispatcher |
| `VZ` | PID file lstat / read / rm handler |
| `M9o` | PID file line splitter (finds `"claude daemon"` line) |
| `wI` | Wait-for-exit helper (delegates to `zk`) |
| `odc` | Daemon status file reader (calls `SXe`, `Tj`, `ck`) |
| `SXe` | Core status-file stat / read / parse pipeline |
| `Ys` | Store context accessor (`yEd.getStore`) |
| `JVo` | Session ID generator (wraps `XVo`) |
| `he` | UTF-8 to string decoder (`String` wrapper) |
| `Tj` | Path builder for daemon files (`D9o.join`, `er`) |
| `Blc` | Foreground-daemon stop helper (reads `daemon.status.json`, sends kill) |
| `ftn` | Path builder for daemon status files (`Ulc.join`, `er`) |
| `Huc` | Scheduled-daemon stop helper (reads `daemon.scheduled.status.json`, sends kill) |
| `guc` | Path builder for scheduled-daemon status file (`muc.join`, `er`) |
| `V4` | Roster file reader with backup-rename on type mismatch |
| `fie` | Roster path builder (joins `roster.json`) |
| `pie` | Base roster directory path builder |
| `qir` | Roster backup-rename function (uses `Date.now` suffix) |
| `rZt` | Timestamp helper for backup naming |
| `Gt` | JSON.parse wrapper |
| `mn` | UTF-8 decode helper (`mn → en`) |
| `$o` | Object.assign merge helper |
| `gd` | Shape-validation encoder (`gd → en`) |
| `nGl` | Entry shape validator (Array.isArray + Object.keys) |
| `GZe` | Entry transformer (`gd + B5 + Um → OQe`) |
| `Do` | Registry lookup helper (`Do → OQe`) |
| `zZ` | launchctl status reader (macOS) |
| `Dn` | execFileNoThrow dispatcher (10-concurrent limit) |
| `Wr` | Core exec-file-no-throw implementation |
| `Fir` | Domain target builder (uses `process.getuid`) |
| `j6l` | UID-to-domain-target mapper |
| `Hdc` | Top-level daemon UI JSX component |
| `tqo` | React/Ink panel component (useState, useRef, view routing) |
| `Os` | Clock context accessor (`u7i.useContext`) |
| `Yc` | Ref/memo/external-store subscription hook |
| `M$` | Background session emitter (`UJr.emit`, `bX.push`) |
| `UJr` | Session event emitter (randomUUID, `rat`, `z6`) |
| `l8` | Graceful-shutdown orchestrator (`Promise.race`, `process.exit`) |
| `kye` | Shutdown trigger (`xye.shutdown`) |
| `Mn` | Timeout-with-abort helper (`setTimeout`, `clearTimeout`) |
| `Flc` | Daemon activity logger (`Ene`, `Date.now`, `Me`) |
| `Ene` | Log entry formatter (`C_e`) |
| `C_e` | Log line trimmer/sanitiser |
| `H` | Worker-map kill-all helper (`o.values`, `P.kill`) |
| `m` | Worker-list filter / UEr path normaliser |
| `UEr` | Path normaliser (`startsWith`, `slice`, `replace`) |
| `k` | MCP config watcher + interval loop |
| `tts` | Scheduled-task executor (lock, run, log, release) |
| `J3c` | Lock-file acquirer (`X3c` Set, `Bvt.appendFile`) |
| `Z3c` | Status-file writer (`Jie.writeFile`) |
| `e9c` | Status-file reader (`Jie.readFile`, `Zon`) |
| `Zon` | Status-file path builder (`esn.join`, `tl`) |
| `XL` | Stale-daemon killer (`process.kill`) |
| `tsn` | Lock-file release + signal sender |
| `D` | Config-change write handler (dispatches to `d`) |
| `d` | Supervisor state dispatcher (start/stop/updateConfig/set) |
| `hSe` | MCP config path builder (`M$n.join`) |
| `N` | Supervisor sweep timer callback |
| `Z` | Background session/voice lifecycle object |
| `U` | Abort controller helper (`O.abort`, `N.abort`) |
| `oXe` | Free-memory checker (`Esc.freemem`) |
| `Ssc` | Memory-threshold helper (`nt`) |
| `EGe` | Token-file cleanup helper (`_T.lstat`, `_T.rm`, `_T.readFile`) |
| `vur` | Memory-telemetry helper (`nt`) |
| `nt` | Telemetry event dispatcher (`n2t`, `r2t`, `tG`, `BV`) |
| `oe` | Worker lifecycle composite (`Z`, `ne`, `A`, `v`) |
| `g` | Main supervisor function (spawn, kill, memory, spare pool) |
| `dis` | Send-claim / socket handoff helper (`Dz.claim`, `sSr.connect`) |
| `gis` | Worker session lifecycle manager (state transitions, file I/O) |
| `Gbt` | Daemon uninstall helper (`bootout`, `KZ.unlink`) |
| `N9o` | LaunchAgents plist path builder (`XQt.join`, `P9o.homedir`) |
| `QQt` | Daemon start/stop/restart orchestrator |
| `U9o` | Platform-aware lifecycle command dispatcher |
| `E` | MCP remote-control connection handler (`$Je`, `xD`, `kD`) |
| `$Je` | MCP server key enumerator (`AVc`, `Math.min`) |
| `AVc` | Object.keys wrapper for server config |
| `tge` | Spend/billing response helper (`JSON.stringify`) |
| `aI` | Forced-shutdown trigger (literal `"forced shutdown"` +18411203) |
| `p` | Exit-with-abort helper (`process.exit`, `u.abort`) |
| `ar` | Ink render helper (`sw`) |
| `sw` | Low-level Ink stream writer |
| `Ke` | Feature-gate entry (`OQe`) |
| `Pe` | Feature-gate ok branch (`OQe`) |
| `OQe` | Feature registry lookup |
| `Um` | Feature-gate result wrapper (`OQe`) |

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.