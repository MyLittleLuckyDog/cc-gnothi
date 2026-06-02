---
type: feature-spec
feature: "exit"
cc_version: "2.1.153"
updated: "2026-06-02"
tags: ["exit", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.153 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/exit`

> Analysis basis: CC v2.1.153 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.153

---

## Overview

The `/exit` command (also aliased as `/quit`) terminates the Claude Code CLI session. When invoked, it triggers an immediate, orderly shutdown sequence: the UI is unmounted, background daemon processes and subprocesses are signaled to stop, session-end telemetry is flushed, and `process.exit` is called. The command is classified as `local-jsx` and resolves to an async handler (`bL5`) via module reference `$n1`.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `exit` |
| description | `null` |
| aliases | `["quit"]` |
| immediate | `true` |
| module_id | `$n1` |
| load_inline | `true` |
| loc_byte | `12318595` |
| loc_byte_end | `12318756` |
| loc_line | `9231` |
| arbor_handler.name | `bL5` |
| arbor_handler.fqn | `claude-2.1.153::bL5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.153 bundle.js:+12318595

---

## Input Branching

The `/exit` command has multiple distinct branches: an immediate `"Goodbye!"` display, optional background-daemon teardown (with SIGTERM/SIGKILL escalation), UI unmount, scroll/terminal restoration, optional startup-profiling flush, and the final `process.exit` call. A flowchart best captures this branching shape.

```mermaid
flowchart TD
    A([User invokes /exit or /quit]) --> B[Display 'Goodbye!' message\nbundle.js:+12317808]
    B --> C[Trigger random farewell animation\nbundle.js:+13359476]
    C --> D[Dispatch detach-request to\nbackground daemon via IPC\nbundle.js:+10732563]
    D --> E{Background daemon\nrunning?}
    E -- Yes --> F[Send SIGTERM to\nchild processes\nbundle.js:+15388093]
    F --> G{Process exits\nwithin timeout?}
    G -- No --> H[Escalate to SIGKILL\nbundle.js:+15386248\ntelemetry: tengu_bg_dispatch_sigkill_escalate]
    G -- Yes --> I[Retire settled\nsubprocesses]
    H --> I
    E -- No --> I
    I --> J[Unmount Ink/React UI\nbundle.js:+5316513]
    J --> K[Restore terminal state\n(tmux/iTerm2/screen escapes)\nbundle.js:+3363147]
    K --> L[Flush startup\nprofiling report?\nbundle.js:+213216]
    L -- Enabled --> M[Write profiling data\nto disk via fsync\nbundle.js:+183616]
    M --> N[Emit session_end\ntelemetry\nbundle.js:+5319049]
    L -- Disabled --> N
    N --> O[Drain stdout/stderr\nbundle.js:+58493]
    O --> P[Emit tengu_cache_eviction_hint\nbundle.js:+5319014]
    P --> Q[Call process.exit\nbundle.js:+5317113]
    Q --> R([Process terminated])
```

---

## Behavioral Spec

### 1. Handler Entry — `bL5` (exitCommandHandler)

Analysis basis: CC v2.1.153 bundle.js:+12317844

The Arbor-resolved handler `bL5` is an `AsyncFunction` reached via `module_id` resolution of `$n1`. It is the primary entry point for the `/exit` command.

```
async function exitCommandHandler(context):
    displayGoodbyeMessage()                    # literal "Goodbye!" at +12317808
    triggerFarewellAnimation()                 # calls randomAnimationHelper (H) at +12317856
    dispatchDetachRequest()                    # calls daemonDetachHelper (k5H) at +12317860
    scheduleShutdownSequence()                 # calls shutdownOrchestrator (K9) at +12318027
    renderExitJSX()                            # calls nHA.createElement at +12317921
    emitPromptInputExitEvent()                 # literal "prompt_input_exit" at +12318032
    return exitResult
```

### 2. Farewell Animation — `H` (randomAnimationHelper)

Analysis basis: CC v2.1.153 bundle.js:+13359476

```
function randomAnimationHelper():
    value = Math.random() * 2          # upper bound 2, at +13359474
    delay = value * 1                  # factor 1, at +13359490
    setTimeout(animationCallback, delay)
```

The animation is a lightweight visual effect introduced by a small randomized delay before the shutdown proceeds.

### 3. Daemon Detach — `k5H` (daemonDetachHelper)

Analysis basis: CC v2.1.153 bundle.js:+10732529

```
function daemonDetachHelper():
    sessionRef = getDaemonSessionRef()        # calls dr6 at +10732529
    taskStatus = getTaskStatus()              # calls FE1 at +10732548
        # FE1 checks task queue length (constant 0 at +10727112)
        # and task type literal "task" at +10727156
    writeDetachRequest()                      # calls ta at +10732554
        # ta writes "detach-request" string literal at +10732563
        # via sa.write and IPC serializer RH (JSON.stringify at +183108)
    waitForAcknowledgement()                  # calls wAH at +10732609
```

### 4. Background Process Teardown — `w` (processKillHelper) and `j` (childKillHelper)

Analysis basis: CC v2.1.153 bundle.js:+15386241 and +15388159

```
function processKillHelper(processMap):
    for each process in processMap.values():
        if lowMemory(ELA.freemem(), threshold=1024):
            emitTelemetry("tengu_bg_dispatch_low_mem")    # +15386779
        send SIGTERM to process                            # literal "SIGTERM" at +15388093
        wait up to 2000ms                                 # constant 2000 at +15385826
        if process still alive:
            send SIGKILL                                  # literal "SIGKILL" at +15386248
            emitTelemetry("tengu_bg_dispatch_sigkill_escalate")  # +15386200
        process.retireIfSettled()

function childKillHelper(childMap):
    for each child in childMap.values():
        send SIGTERM / SIGKILL as needed
        # "SIGTERM" at +15388093, "SIGKILL" at +15386248
```

Timeout constants:
- SIGTERM grace period: **2000 ms** (bundle.js:+15385826)
- Kill escalation delay: **100 ms** (bundle.js:+15386272)
- Spare worker thresholds: **30** and **15** (bundle.js:+15386155, +15386166)

### 5. Scheduled-Task Queue Reporting — `qE8` (scheduledTaskFormatter)

Analysis basis: CC v2.1.153 bundle.js:+10726056

```
function scheduledTaskFormatter(tasks):
    label = getFormattedLabel()          # calls wG (labelGetter, +10726056)
                                         # literal "scheduled task" at +10726075
    taskList = []
    for each task:
        taskList.push(formatTask(task))  # calls KcL (taskFormatter) at +10726102
        # KcL calls:
        #   RV  — cron-expression parser  (+10726188)
        #   eN  — schedule-entry parser   (+10726205)
        #   xlH — time-slot adjuster      (+10726221)
        #   nq  — duration formatter      (+10726337)
        #   Math.max, Date.now, A.getTime (+10726280, +10726303, +10726291)
    truncated = truncateToWidth(taskList) # calls C9 (widthTrimmer) at +10726117
    return truncated
```

Cron-related string constants encountered: `"Every minute"` (+4772182), `"Every hour"` (+4772399), base-10 parsing with `parseInt` (+4772238), day-of-week offset `7` (+4772909), weekend range `"1-5"` (+4773106).

### 6. Shutdown Orchestrator — `K9` (shutdownOrchestrator)

Analysis basis: CC v2.1.153 bundle.js:+5318581

This is the core async sequence that performs ordered teardown.

```
async function shutdownOrchestrator():
    await Promise.resolve()
    launchKillTimeout(l7)                      # +5318611
    timeoutHandle = setTimeout(forceExit, Math.max(5000, 3500))
                                               # constants at +5318678, +5318685
    IwH.unref(timeoutHandle)                   # prevent timer from blocking exit +5318694

    # Step 1: Write terminal goodbye output
    writeGoodbyeToStdout(pNH)                  # +5318649
        # unmounts Ink UI (H.unmount at +5316513)
        # saves/restores terminal cursor (ESC-7 / ESC-8 escapes at +3708565, +3708576)
        # handles tmux/iTerm2/screen terminal multiplexers (+3363147, +3439753, +3439822)

    # Step 2: Write exit summary (scroll summary)
    writeExitSummary(IE_)                      # +5318655
        # emits tengu_scroll_summary telemetry at +5317981
        # writes dim-styled footer via j6.dim (+5316921)
        # replaces path separators (Windows "\\\\" at +5316824, quote "\\"" at +5316847)

    # Step 3: Force-exit function registered
    forceExitFn = kE_                          # +5318661
        # clears timeout
        # calls process.exit (+5317113)
        # or process.kill  (+5317138)
        # Error("unreachable") fallback at +5317186

    # Step 4: Session-end analytics
    sessionEndBatch = D58                      # +5318989
        # emits tengu_scroll_summary (+5317981)
        # runs cache-eviction helper $q (+5318025)
        #   which uses tengu_pewter_brook (+3371435) and tengu_amber_creek (+3371527)
        # measures "session_end" event timing via qj9 (+5318008)
        #   using Date.now, Math.max, Math.round, Object.assign

    # Step 5: Startup profiling flush (conditional)
    profilingResult = B16                      # +5318976
        # if profiling enabled: writes report via f0H (fsync path at +183616)
        # if disabled: logs "Startup profiling not enabled" (+212447)
        # emits tengu_startup_perf (+214224)

    # Step 6: Drain I/O
    drainIO = TxH                              # +5318774
        # calls q3A.drain() at +58493

    # Step 7: Race with AbortSignal timeout
    result = await Promise.race([
        supervisorShutdown(Y),                 # +5318852 — stops supervisors, config
        AbortSignal.timeout(timeoutMs),        # +5318940
        w58(parallelShutdowns)                 # +5319092 — parallel Promise.all
    ])

    # Step 8: Final write + cache hint
    NwH.writeSync(finalOutput)                 # +5319118
    emitTelemetry("tengu_cache_eviction_hint") # +5319014
    emitTelemetry("session_end")               # literal at +5319049

    clearTimeout(timeoutHandle)                # +5318875
    process.exit(0)                            # via kE_
```

### 7. Supervisor Shutdown — `Y` (supervisorShutdown)

Analysis basis: CC v2.1.153 bundle.js:+15400169

```
function supervisorShutdown():
    writeSessionSummary(z2H)              # writes session stats at +15400169
    q.write(summaryText)                  # +15400186 — literal "supervisor" at +15400194
    writeMetricsTable(ya1)               # +15400388
    stopGlobalMonitor(G)                 # +15400462 — calls G.stop
    deleteMonitorEntry(M.delete)         # +15400471
    stopEventLoop(E.stop)               # +15400582
    updateDaemonConfig(E.updateConfig)  # +15400591
    restartEventLoop(E.start)           # +15400609
    emitTelemetry("tengu_daemon_config_reload")  # +15400987
    startHeartbeat(oTK)                 # +15400711 — literal "heartbeat" at +15399415
    setMonitorEntry(M.set)              # +15400756
    startVitalsMonitor(V.start)         # +15400767
```

### 8. Terminal Restoration — `lA8` (terminalRestoreHelper)

Analysis basis: CC v2.1.153 bundle.js:+3708411

```
function terminalRestoreHelper():
    Sr.writeSync(ESC_SAVE_CURSOR)       # ESC-7 literal at +3708565
    applyTerminalQuirks(qVH)            # +3708585
        # detects ghostty >= 1.2.0     (+3439753, +3439783)
        # detects iTerm.app >= 3.6.6   (+3439822, +3439854)
        # coerces version via vcq.coerce
    fixMultiplexerEscapes(eEH)          # +3708614
    restoreCursorPosition(X0)           # +3708635
        # handles tmux literal "tmux"  (+3363147)
        # replaces "\x1b\x1b" sequences (+3363193)
        # handles "screen" multiplexer (+3363220)
    Sr.writeSync(ESC_RESTORE_CURSOR)    # ESC-8 literal at +3708576
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: tengu_bg_dispatch_sigkill_escalate | Fired when a background process survives SIGTERM and requires SIGKILL (bundle.js:+15386200) |
| Telemetry: tengu_bg_dispatch_low_mem | Fired when free memory is below threshold during teardown (bundle.js:+15386779) |
| Telemetry: tengu_bg_spare_enable | Fired when spare worker slot is activated (bundle.js:+15387474) |
| Telemetry: tengu_bg_spare_claim | Fired when a spare worker is successfully claimed (bundle.js:+15387595) |
| Telemetry: tengu_bg_spare_claim_fail | Fired when spare worker claim fails (bundle.js:+15387858) |
| Telemetry: tengu_bg_spare_spawn | Fired when a new spare worker is spawned (bundle.js:+15385893) |
| Telemetry: tengu_daemon_config_reload | Fired during supervisor config update at session end (bundle.js:+15400987) |
| Telemetry: tengu_startup_perf | Fired during startup profiling flush (bundle.js:+214224) |
| Telemetry: tengu_scroll_summary | Fired during exit summary rendering (bundle.js:+5317981) |
| Telemetry: tengu_amber_creek | Fired during cache-eviction routing (bundle.js:+3371527) |
| Telemetry: tengu_pewter_brook | Fired during cache-eviction routing (bundle.js:+3371435) |
| Telemetry: tengu_cache_eviction_hint | Fired just before final process.exit (bundle.js:+5319014) |
| UI unmount | Ink/React component tree is unmounted via `H.unmount` (bundle.js:+5316513) |
| Terminal state | Cursor save/restore (ESC-7/ESC-8), multiplexer escape sequence cleanup for tmux, screen, iTerm2, ghostty (bundle.js:+3708565, +3363147) |
| IPC / Daemon | Sends `"detach-request"` message over IPC channel before teardown (bundle.js:+10732563) |
| Process signals | Sends SIGTERM then SIGKILL (with 2000 ms grace, 100 ms escalation delay) to child/daemon processes (bundle.js:+15388093, +15386248) |
| Stdout drain | Calls `q3A.drain()` to flush pending writes before exit (bundle.js:+58493) |
| Startup profiling | Conditionally writes profiling report to disk with fsync (bundle.js:+183616) |
| appState changes | Supervisor monitor entries deleted and restarted; daemon config reloaded |
| Session-end event | Emits `"session_end"` string event (bundle.js:+5319049) |
| Exit event literal | Emits `"prompt_input_exit"` event (bundle.js:+12318032) |
| process.exit | Called via `kE_` (forceExitFn), also has `process.kill` fallback (bundle.js:+5317113, +5317138) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.153 | Initial analysis |

---

## Common Mistakes

1. **Using `/exit` during an active task**: Because `immediate: true` is set, the command fires without waiting for confirmation. Any running agent task will be abandoned without a graceful save. Use `/quit` (alias) interchangeably — both resolve to the same handler.
2. **Expecting instant termination in low-memory environments**: The shutdown sequence sends SIGTERM to background workers and waits up to **2000 ms** before escalating to SIGKILL. In low-memory situations, the `tengu_bg_dispatch_low_mem` telemetry event is emitted and teardown may take the full grace period.
3. **Conflating `/exit` with Ctrl-C**: The slash command performs an orderly drain (`q3A.drain()`), flushes telemetry, and restores terminal state. A hard interrupt (`SIGINT`) bypasses these steps.
4. **Expecting a description in the command palette**: The `description` field is `null` — `/exit` appears without a help string in the command picker UI.
5. **Terminal corruption after abrupt kill**: If `process.kill` is used as the fallback (reached only via the `"unreachable"` error path at bundle.js:+5317186), terminal multiplexer escapes may not be fully cleaned up. Restart the terminal emulator if rendering appears broken.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `bL5` | exitCommandHandler — top-level async handler for `/exit`; Arbor-resolved entry point |
| `N9` | processTypeChecker — checks process role ("bg", "daemon", "daemon-worker") |
| `DOH` | processRoleDispatcher — downstream from processTypeChecker |
| `H` | randomAnimationHelper — uses Math.random + setTimeout for farewell animation |
| `k5H` | daemonDetachHelper — sends detach-request over IPC and waits for ack |
| `dr6` | daemonSessionRefGetter — retrieves current daemon session reference |
| `FE1` | taskQueueStatusChecker — evaluates pending task queue state |
| `nXH` | taskQueueLengthReader — reads queue length (constant 0 check) |
| `N8` | taskTypeResolver — resolves task type literal "task" |
| `ta` | ipcWriteHelper — writes detach-request message via IPC |
| `RH` | jsonSerializerHelper — wraps JSON.stringify for IPC payloads |
| `wAH` | detachAcknowledgementWaiter — awaits daemon ack after detach request |
| `Ff` | exitFlagSetter — sets internal exit flag in app state |
| `qE8` | scheduledTaskFormatter — formats scheduled-task queue for exit display |
| `wG` | labelGetter — retrieves "scheduled task" label string |
| `Fv` | flagValueReader — reads boolean/config flag values |
| `KcL` | taskEntryFormatter — formats individual scheduled-task entries |
| `RV` | cronExpressionParser — parses cron strings ("Every minute", "Every hour") |
| `K` | columnPadder — pads output columns (uses L.map, M.padEnd) |
| `w` | processKillHelper — manages SIGTERM/SIGKILL escalation for background processes |
| `L` | pendingPromiseTracker — tracks pending async operations (q.add/delete/finally) |
| `j` | childKillHelper — iterates child process map and sends kill signals |
| `D` | daemonShutdownHelper — orchestrates full daemon teardown sequence |
| `$` | resourceDisposer — calls Ar1 for resource cleanup |
| `J` | weekdayCalculator — uses getUTCDay/setUTCDate/getUTCDate/setUTCHours/getDay |
| `eN` | scheduleEntryParser — parses schedule entry strings via H.trim |
| `qE7` | cronFieldParser — splits/matches/parses individual cron fields |
| `A` | lowerCaseMapper — maps strings to lowercase |
| `xlH` | timeSlotAdjuster — adjusts time slots with setSeconds/setMinutes/getHours etc. |
| `_` | dateBaseRef — base Date object used for time calculations |
| `O` | scheduleDateObject — mutable Date used by xlH for time adjustment |
| `M` | connectionCloseManager — closes connections (A.close, q.close) |
| `q` | tempFileRemover — calls VTK.unlinkSync for temp file cleanup |
| `nq` | durationFormatter — formats durations using Math.floor and Math.round |
| `C9` | widthTrimmer — trims output strings to terminal width using indexOf/substring |
| `a6` | stringWidthMeasurer — wraps Bun.stringWidth |
| `Pq` | stringWidthWrapper — calls a6 and DY for width calculation |
| `DY` | displayWidthFallback — fallback display-width calculator |
| `CL5` | exitJSXComponentBuilder — builds the JSX element for exit UI via L2 |
| `K9` | shutdownOrchestrator — core async function managing full ordered teardown |
| `pNH` | uiUnmountWriter — unmounts Ink UI and writes goodbye to stdout |
| `$R` | inkRootUnmounter — handles Ink root unmount logic |
| `lA8` | terminalRestoreHelper — saves/restores terminal cursor with ESC-7/ESC-8 |
| `qVH` | terminalQuirkHandler — detects ghostty/iTerm2 versions and applies fixes |
| `eEH` | multiplexerEscapeFixer — fixes escape sequences for terminal multiplexers |
| `X0` | tmuxEscapeRestorer — replaces tmux/screen escape sequences |
| `xH` | stringCoercer — wraps String() constructor |
| `IE_` | exitSummaryWriter — writes scroll/exit summary with dim styling |
| `KZ` | exitStateReader — reads current exit state |
| `sC` | sessionContextReader — reads active session context |
| `y6` | configFlagReader — reads configuration flag values |
| `ZX6` | workingDirResolver — resolves working directory via statSync |
| `OS` | osTypeChecker — checks operating system type flag |
| `O_` | pathStyleChecker — checks path style (Windows vs POSIX) |
| `B6` | existsChecker — checks whether a path or resource exists |
| `G3` | terminalTypeResolver — combines y6 and h4 to resolve terminal type |
| `h4` | terminalDetailResolver — resolves H9 terminal detail |
| `Lj9` | summaryLineFormatter — formats individual summary lines |
| `kE_` | forceExitFn — clears timeout then calls process.exit or process.kill |
| `TxH` | ioDrainHelper — calls q3A.drain() to flush pending I/O |
| `Y` | supervisorShutdown — stops supervisors, updates config, emits daemon reload telemetry |
| `z2H` | sessionSummaryWriter — writes session statistics summary |
| `r9` | asyncStoreReader — reads from pD7 async local storage |
| `J8` | sessionIdReader — retrieves current session identifier |
| `X8A` | sessionMetricsCollector — calls J8A for metrics |
| `EH` | errorMessageFormatter — wraps String() for error messages |
| `ya1` | metricsTableWriter — writes formatted metrics table (Object.keys, Math.max) |
| `G` | globalMonitorStopper — calls b.preventDefault, j0, Y, H to stop monitor |
| `b` | monitorEventRef — event object passed to global monitor stopper |
| `j0` | userSettingsWriter — writes "userSettings" / "remoteControlAtStartup" config |
| `E` | eventLoopController — provides stop/updateConfig/start methods |
| `oTK` | heartbeatStarter — starts heartbeat via JHH |
| `JHH` | heartbeatImpl — implements heartbeat loop literal "heartbeat" |
| `V` | vitalsMonitor — provides V.start for vitals monitoring |
| `c` | configAccessor — general config getter/setter used throughout teardown |
| `B16` | startupProfilingFlusher — writes startup profiling report to disk or skips |
| `qU8` | perfMarkProcessor — processes perf_hooks marks into profiling report |
| `mm` | requireLoader — wraps require() for dynamic module loading |
| `fzA` | profilingReportWriter — orchestrates profiling data collection and file write |
| `zzA` | profilingDataFormatter — formats profiling data with Rb6.join |
| `f0H` | syncFileWriter — writes file with openSync/writeFileSync/fsyncSync/closeSync |
| `qzA` | profilingEntryCollector — collects profiling entries via mm and _.entries |
| `N` | logEmitter — emits log entries with level "debug"; handles RH/GS/ixH |
| `D58` | sessionEndAnalytics — measures session_end event timing and emits telemetry |
| `Kj9` | sessionEndContextBuilder — builds context object for session end |
| `qj9` | sessionEndTimingMeasurer — uses Date.now/Math.max/Math.round/Object.assign |
| `_j9` | sessionEndFinalizer — final step in session-end analytics |
| `$q` | cacheEvictionRouter — routes cache eviction hints; fires tengu_pewter_brook / tengu_amber_creek |
| `Y3H` | cacheKeyChecker — checks FrK set for known cache keys |
| `qY_` | cacheEvictionWriter — writes eviction record using c1 and xH |
| `Yr` | evictionTimestampRecorder — records eviction timestamp via a17 |
| `AY_` | booleanFlagEvaluator — evaluates n6 with Boolean() coercion |
| `o_` | cacheApWriter — calls Ap for cache write-through |
| `s17` | cacheEvictionFinalizer — calls T6 to finalize eviction |
| `T6` | kvStoreWriter — writes to key-value store (Dz6/wz6/wHH/WzH/O88/zz6/vQ/b6) |
| `eq6` | exitCodeResolver — resolves numeric exit code |
| `w58` | parallelShutdownRunner — runs parallel shutdown tasks via Promise.all and Promise.race |
| `r8` | timeoutRacer — implements timeout-with-abort using setTimeout/clearTimeout/Error |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.