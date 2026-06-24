---
type: feature-spec
feature: "stop"
cc_version: 2.1.190
updated: "2026-06-19"
tags: ["stop", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.179
analysis_basis: "CC v2.1.179 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/stop`

> Analysis basis: CC v2.1.179 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.179

---

## Overview

`/stop` terminates the currently running background session, transitioning it to an idle/stopped state while deliberately preserving both the session transcript and any associated worktree on disk. It is a `local-jsx` command that executes immediately (no user confirmation step), delegating its core work to an async handler that writes a stop-reason marker, emits telemetry, and then performs an orderly teardown of the session's process infrastructure.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `stop` |
| description | Stop this background session; transcript and worktree are kept |
| loc_byte | `13517089` |
| loc_byte_end | `13517273` |
| loc_line | `9665` |
| immediate | `true` |
| module_id | `GNK` |
| load_inline | `true` |
| arbor_handler.name | `f35` |
| arbor_handler.fqn | `claude-2.1.179::f35` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.179 bundle.js:+13517089

---

## Input Branching

The command has more than three distinct behavioral branches (jitter delay selection, stop-reason path, session-state transitions, daemon-stop success/failure, MCP retry-stop, file-lstat checks). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/stop invoked"] --> B["handler: stopCommandHandler (f35)"]
    B --> C["jitterDelay (H)\nMath.random × [1,2] ms\nthen setTimeout"]
    C --> D["sessionTeardown (wn8)"]

    D --> D1["read session state (d, q6, QH)"]
    D1 --> D2{"session type check (a_)\nliteral: 'nonconforming'?"}
    D2 -- nonconforming --> D3["flag/skip teardown branch"]
    D2 -- conforming --> D4["sessionTypeFilter (V9)\nliterals: 'bg','daemon','daemon-worker'"]

    D4 --> E["bgFileStateRead (zq)\npath.join + Promise.all\nfs.lstat on each entry\norder / stateOrder sort keys"]
    E --> E1{"file is regular? (M.isFile)"}
    E1 -- no --> E2["log warn: 'not a regular file'"]
    E1 -- yes --> E3["read state cache (Ee.get / Ee.set)"]

    E3 --> F["writeStopMarker (yL)\npath.join, bH(JSON.stringify)\nvO: randomBytes(4,'hex') + writeFile + rename + chmod\nfile mode 384 (0o600)"]
    F --> G["completionStateTracker (i$)\npT→Y9H\nstates: 'done','success','failure','stopped','active'"]

    G --> H1["setSessionState → 'stopped from session'\n→ idle transition\nliteral: 'idle'"]
    H1 --> H2["emit telemetry: tengu_bg_agent_action\nloc_byte: 13516215"]
    H2 --> H3["display 'Session stopped.'\nloc_byte: 13516590"]

    H3 --> I["sessionShutdown (S9)"]
    I --> I1["unmountUI (FxH)\nJ\$H.writeSync, H.unmount, qR, xY8"]
    I --> I2["outputFinalSummary (Io_)\nreplaceAll '\\\\' and '\\\"'\nJ\$H.writeSync, J6.dim"]
    I --> I3["waitDrain (qdH)\noSA.drain"]
    I --> I4["AbortSignal.timeout\nPromise.race timeout: 5000 ms\nfallback timeout: 3500 ms\nloc_byte: 7195498,7195505"]
    I4 --> I5["process teardown (w)\nsupervisor stop → T.stop\nheartbeat stop → Z.stop\nZ.updateConfig, Z.start\nL.close (A.close + q.close)\nL.delete, L.set"]
    I5 --> I6["flushAndExit (a9q)\nPromise.allSettled + Array.from"]

    I --> J["daemonControl (z)"]
    J --> J1["daemonStop (IH)\ntengu_feature_ok\nliteral: 'daemon_stop'\nloc_byte: 17105301"]
    J --> J2{"daemon stop result"}
    J2 -- failed --> J3["daemonStopFailed (CH)\ntengu_feature_bad\nliteral: 'daemon_stop_failed'\nloc_byte: 17105338"]
    J2 -- success --> J4["daemonRetryStop (QS)\nfirstParty marker, XG_ handler\nloc_byte: 2579266"]
    J --> J5["queuedShutdown (QB)\nPromise.race + Promise.all\ntLH, eLH, n8\nprocess.exit after 500 ms\nloc_byte: 17100419"]

    I --> K["sessionEndTelemetry (a_→q6)\nliteral: 'session_end'\nloc_byte: 7195895"]
    K --> L["emitJobStopSelf\nliteral: 'job_stop_self'\nloc_byte: 13516621"]
    L --> M["emitPromptInputExit\nliteral: 'prompt_input_exit'\nloc_byte: 13516643"]
    M --> N["emitStopCommand\nliteral: 'stop_command'\nloc_byte: 13516822"]
```

---

## Behavioral Spec

### 1. Entry Point — `stopCommandHandler` (`f35`)

```
async function stopCommandHandler(commandContext):
    await jitterDelay()          // small random pause before teardown
    await sessionTeardown()      // main stop sequence
```

Analysis basis: CC v2.1.179 bundle.js:+13516808 (call to `H`), +13516818 (call to `wn8`)

---

### 2. Jitter Delay — `jitterDelay` (`H`)

The handler inserts a small randomised pause before doing any work. This prevents thundering-herd effects when multiple background sessions receive a stop signal simultaneously.

```
function jitterDelay():
    delayMs = Math.random() * (2 - 1) + 1   // uniform in [1, 2) ms
    return new Promise(resolve => setTimeout(resolve, delayMs))
```

Analysis basis: CC v2.1.179 bundle.js:+14230697 (`Math.random`), +14230711 (literal `1`), +14230695 (literal `2`), +14230734 (`setTimeout`)

---

### 3. Session Teardown Orchestrator — `sessionTeardown` (`wn8`)

```
async function sessionTeardown():
    sessionState  = readCurrentState(d, q6, QH)
    sessionType   = classifySession(a_)          // checks "nonconforming"

    if sessionType is "nonconforming":
        return early                             // no-op for unrecognised session shapes

    filteredType  = filterBgTypes(V9)            // accepts "bg", "daemon", "daemon-worker"

    stateEntries  = await readBgFileState(zq)    // lstat each state file; sort by "order"/"stateOrder"
    writeStopMarker(yL)                          // atomic write of stop-reason JSON
    trackCompletion(i$)                          // consult done/success/failure/stopped/active states

    setSessionState("stopped from session")      // literal at +13516417
    transitionToIdle("idle")                     // literal at +13516446
    emit telemetry: tengu_bg_agent_action        // +13516215
    display "Session stopped."                   // literal at +13516590

    emit "job_stop_self"                         // +13516621
    emit "prompt_input_exit"                     // +13516643

    await sessionShutdown(S9)
    emit "stop_command"                          // +13516822
```

Analysis basis: CC v2.1.179 bundle.js:+13516213 through +13516822

---

### 4. Background State File Reader — `bgFileStateReader` (`zq`)

Reads all state files belonging to the background session. Files are located via `path.join`, their existence is verified with `fs.lstat`, and only regular files (`M.isFile`) are processed. Results are sorted using the `"order"` and `"stateOrder"` string keys. A cache (`Ee`) avoids redundant disk reads within a single invocation; entries are evicted after 1 000 ms (literal at +4324191). File content is decoded as UTF-8 (`"utf-8"` at +4323664) then parsed with `JSON.parse`.

```
async function bgFileStateReader(sessionDir):
    paths = path.join(sessionDir, ...)
    stats = await Promise.all(paths.map(p => fs.lstat(p)))

    results = []
    for each (path, stat) in zip(paths, stats):
        if not stat.isFile():
            log.warn("not a regular file")      // +4323010
            continue
        cached = stateCache.get(path)
        if cached is missing or stale:
            raw  = await fs.readFile(path, "utf-8")
            data = JSON.parse(raw)              // via l6
            stateCache.set(path, data)
        results.push(data)

    results.sort(by "order" then "stateOrder")
    return results
```

Analysis basis: CC v2.1.179 bundle.js:+4322631 (`path.join`), +4322718 (`Promise.all`), +4322731 (`fs.lstat`), +4322805 (`isFile`), +4323010 (`"not a regular file"`), +4323664 (`"utf-8"`), +4324191 (`1000` ms eviction)

---

### 5. Atomic Stop-Marker Writer — `atomicStopMarkerWriter` (`yL`)

Writes a JSON stop-reason document atomically using a write-then-rename pattern, protecting against partial writes. The file is created with mode `0o600` (octal 384, literal at +4322234).

```
async function atomicStopMarkerWriter(sessionDir, reason):
    targetPath = path.join(sessionDir, ...)
    payload    = JSON.stringify({ reason, ... })    // via bH
    tmpSuffix  = crypto.randomBytes(4).toString("hex")   // 4 bytes → 8 hex chars
    tmpPath    = targetPath + "." + tmpSuffix

    await fs.writeFile(tmpPath, payload, "utf8")
    await fs.rename(tmpPath, targetPath)
    await fs.chmod(targetPath, 384)                 // 0o600
```

Analysis basis: CC v2.1.179 bundle.js:+2142270 (`randomBytes`), +2142286 (literal `4`), +2142298 (`"hex"`), +2142317 (`writeFile`), +2142344 (`"utf8"`), +2142370 (`rename`), +2142480 (`chmod`), +4322234 (literal `384`)

---

### 6. Session Shutdown Sequencer — `sessionShutdownSequencer` (`S9`)

Orchestrates the full process-level teardown after the session state has been marked stopped.

```
async function sessionShutdownSequencer():
    unmountUI(FxH)                    // write final bytes, unmount Ink/React tree
    outputFinalSummary(Io_)           // write dim-styled summary to stdout
                                      //   escapes: "\\\\" → "\", "\\\"" → "\""
    await drainOutputQueue(qdH)       // oSA.drain — flush buffered output

    timeoutSignal = AbortSignal.timeout(5000)   // hard outer limit  +7195498
    fallbackMs    = 3500                         // inner deadline     +7195505

    await Promise.race([
        processTeardown(w),           // supervisor.stop, heartbeat.stop,
                                      //   heartbeat.updateConfig, heartbeat.start (restart w/o session)
                                      //   connection.close, connection.delete
        timeout(fallbackMs)
    ])

    await flushAndExit(a9q)           // Promise.allSettled over remaining tasks
                                      //   then process exit

    emit "session_end" telemetry (via a_, q6)    // +7195895
    clearTimeout(...)                  // +7195695
    write final bytes: J$H.writeSync   // +7195969

    await scrollSummaryTelemetry(aZ8) // tengu_scroll_summary  +7194914
    await startupPerfTelemetry(Yz6)   // tengu_startup_perf    +223786
    await sessionRenderFinalise(m1)   // local-agent render, fullscreen teardown
```

Analysis basis: CC v2.1.179 bundle.js:+7195401 through +7195969, +7195498 (5 000 ms), +7195505 (3 500 ms), +7195683 (2 000 ms secondary timeout), +7195895 (`"session_end"`)

---

### 7. Daemon Control — `daemonControlSequence` (`z`)

Runs in parallel with the UI teardown, targeting any daemon or daemon-worker process associated with the session.

```
async function daemonControlSequence():
    try:
        result = await daemonStop(IH)        // sends "daemon_stop" signal
        emit tengu_feature_ok                // +1020479 (success path)
    catch err:
        emit tengu_feature_bad               // +1020546 (failure path)
        log "daemon_stop_failed"             // literal +17105338

    if allRemoteServersRecovered:
        daemonRetryStop(QS)                  // firstParty marker, then XG_ handler
                                             // literal "firstParty" +2579238

    await queuedShutdown(QB)                 // Promise.race + Promise.all
                                             // tLH, eLH, n8 waiters
                                             // process.exit after 500 ms  +17100419
```

Telemetry `tengu_daemon_control` is emitted at +17105376.

Analysis basis: CC v2.1.179 bundle.js:+17105298 (`IH`), +17105321 (`CH`), +17105338 (`"daemon_stop_failed"`), +17105373 (`QS`), +17105376 (`tengu_daemon_control`), +17105427 (`QB`), +17100419 (500 ms)

---

### 8. MCP Connection Refresh — `mcpConnectionManager` (`fhA` / `KxH` / `Us8`)

Called indirectly during teardown to flush MCP state. It iterates `Object.entries` over the active MCP slot map, applies connection results via `H.applyMcpUpdate`, cleans up orphaned connections (log messages at +16716974 and +16717059), and rebuilds the tool list via `KxH`. Transport types handled: `"stdio"`, `"sse"`, `"http"`, `"sse-ide"`, `"ws-ide"` (literals at +6805298 through +6805433).

Analysis basis: CC v2.1.179 bundle.js:+16716689 (`fhA`), +16716552 (`KxH`), +16716562 (`Us8`), +16716840 (`applyMcpUpdate`), +16716974 and +16717059 (orphan log strings)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_bg_agent_action` | Fired when session state is transitioned to stopped; loc_byte +13516215 |
| Telemetry: `tengu_daemon_control` | Fired during daemon-stop sequence; loc_byte +17105376 |
| Telemetry: `tengu_feature_ok` | Daemon stop succeeded; loc_byte +1020479 |
| Telemetry: `tengu_feature_bad` | Daemon stop failed; loc_byte +1020546 |
| Telemetry: `tengu_daemon_config_reload` | MCP/daemon config reloaded during teardown; loc_byte +17083201 |
| Telemetry: `tengu_bg_state_read_transient` | Transient state read from background state files; loc_byte +4323451 |
| Telemetry: `tengu_scroll_summary` | Scroll/summary stats captured at session end; loc_byte +7194914 |
| Telemetry: `tengu_startup_perf` | Startup profiling report emitted at exit; loc_byte +223786 |
| Telemetry: `tengu_pewter_brook` | Render/fullscreen session metric; loc_byte +3587564 |
| Telemetry: `tengu_cache_eviction_hint` | Cache eviction hint sent near session close; loc_byte +7195857 |
| Session state write | Stop-reason JSON written atomically (write + rename + chmod 0o600) to session state directory |
| Session state transition | `"stopped from session"` → `"idle"` (literals at +13516417, +13516446) |
| Transcript | Preserved on disk (no deletion) |
| Worktree | Preserved on disk (no deletion) |
| UI / terminal | Ink/React tree unmounted; final bytes flushed to stdout via `J$H.writeSync`; ANSI cursor save/restore (`\x1b7` / `\x1b8`) used during output |
| MCP connections | Orphaned connections cleaned up; tool list rebuilt |
| Supervisor process | `T.stop()` called; supervisor tracking entry removed |
| Heartbeat process | `Z.stop()` → `Z.updateConfig()` → `Z.start()` (restarted without the stopped session) |
| Connection registry | `L.close()`, `L.delete()`, `L.set()` to update connection map |
| Process exit | `process.exit` called via `QB` / `So_` after 500 ms deadline (+17100419) or SIGKILL if needed (+7193795) |
| Output buffer | `oSA.drain` awaited before exit to prevent truncation |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.179 | Initial analysis |

---

## Common Mistakes

1. **Expecting immediate process exit** — `/stop` inserts a jitter delay and then performs an orderly multi-step teardown (drain, unmount, flush). The process does not exit synchronously; allow up to ~5 000 ms for full shutdown.
2. **Assuming the worktree is deleted** — the command description is explicit: "transcript and worktree are kept." Running `/stop` does not clean up disk artefacts; use a separate cleanup command or manual deletion if needed.
3. **Invoking `/stop` on a non-background session** — if the session type resolves to `"nonconforming"` (i.e., not `"bg"`, `"daemon"`, or `"daemon-worker"`), the teardown path short-circuits with no visible effect and no error.
4. **Re-using the session after `/stop`** — once the state file is written with reason `"stopped from session"` and the state transitions to `"idle"`, the session infrastructure (supervisor, heartbeat, connections) is torn down. Attempting to resume work in the same session object will fail.
5. **Relying on MCP tools being available during teardown** — MCP connections are cleaned up and rebuilt as part of the stop sequence; any in-flight MCP tool call may be orphaned and silently dropped.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `f35` | `stopCommandHandler` — async entry point for `/stop`; resolved via `module_id` by Arbor |
| `H` | `jitterDelay` — inserts a random 1–2 ms pause before teardown |
| `wn8` | `sessionTeardown` — main orchestrator: reads state, writes marker, emits telemetry, calls shutdown |
| `d` | `readSessionStateRaw` — low-level session state reader |
| `q6` | `sessionStateAccessor` — session state getter/accessor |
| `n36` | `stateNodeHelper` — shared state node utility |
| `QH` | `sessionStateQuery` — queries current session state value |
| `a_` | `sessionTypeClassifier` — classifies session type; recognises `"nonconforming"` |
| `Xj` | `nonconformingTypeCheck` — sub-check used inside `a_` |
| `I6` | `featureFlagReader` — reads feature flag values |
| `OT` | `featureFlagStore` — backing store for feature flags |
| `K35` | `sessionMetadataAccessor` — reads session metadata fields |
| `V9` | `bgSessionTypeFilter` — filters to `"bg"`, `"daemon"`, `"daemon-worker"` |
| `XyH` | `bgTypeConstants` — holds the bg/daemon/daemon-worker string constants |
| `zq` | `bgFileStateReader` — lstat-based background state file reader |
| `M` | `fileStatHelper` — wraps `isFile()` checks |
| `KxH` | `mcpToolListBuilder` — rebuilds MCP tool list after connection changes |
| `Us8` | `mcpConnectionResultApplier` — applies `applyMcpUpdate` and cleans orphaned slots |
| `f` | `pendingPromiseTracker` — tracks in-flight promises with `add`/`delete` |
| `N` | `logFormatter` — formats log messages with level prefixes |
| `$` | `yTKWrapper` — thin wrapper calling `yTK` |
| `fhA` | `mcpConnectionManager` — iterates MCP config entries, drives `KxH` and `Us8` |
| `w` | `processTeardown` — stops supervisor/heartbeat, closes connections, sets new config |
| `bVH` | `fileStatWithCache` — cached `fs.stat` with ENOENT handling and size limit (1 048 576 bytes) |
| `q` | `dataWriteQueue` — buffered write queue with 1 024-byte chunks |
| `AVK` | `writeOffsetCalculator` — computes write offsets using `Math.max` |
| `L` | `connectionRegistry` — map of active connections; supports `close`, `delete`, `set`, `get` |
| `T` | `supervisorController` — manages the supervisor child process; exposes `stop` |
| `Z` | `heartbeatController` — manages the heartbeat; exposes `stop`, `updateConfig`, `start` |
| `Z94` | `heartbeatConfigBuilder` — builds heartbeat config object via `T1H` |
| `v` | `inputEventHandler` — handles keyboard input events; calls `Z` on certain keys |
| `z` | `daemonControlSequence` — sends daemon-stop signal and handles success/failure |
| `IH` | `daemonStopSuccess` — success branch of daemon stop; emits `tengu_feature_ok` |
| `CH` | `daemonStopFailure` — failure branch; emits `tengu_feature_bad` |
| `QS` | `daemonRetryStop` — retry-stop with `firstParty` marker via `XG_` |
| `QB` | `queuedShutdown` — `Promise.race`/`Promise.all` wrapper; calls `process.exit` after 500 ms |
| `x8` | `errorCodeExtractor` — extracts `.code` field from errors via `G8` |
| `G8` | `safePropertyGetter` — safe property access helper |
| `VL` | `codePropertyReader` — reads `"code"` property safely |
| `l6` | `jsonParseWrapper` — wraps `JSON.parse` |
| `i$` | `completionStateTracker` — tracks done/success/failure/stopped/active states via `pT` |
| `pT` | `stateTransitionEngine` — drives state machine transitions |
| `Y9H` | `stateDefinitions` — defines the allowed state values |
| `yL` | `atomicStopMarkerWriter` — atomic JSON write via randomBytes + writeFile + rename + chmod |
| `vO` | `atomicFileWriter` — low-level atomic write primitive (randomBytes, writeFile, rename, chmod) |
| `bH` | `jsonStringifyWrapper` — wraps `JSON.stringify` |
| `lJ` | `stateCacheEvictor` — deletes entries from the state cache (`Ee`) |
| `h48` | `stopReasonRecorder` — records the stop reason in session metadata |
| `V4H` | `sessionDisplayUpdater` — updates the session display after state change |
| `S9` | `sessionShutdownSequencer` — full shutdown sequence: unmount, drain, race-timeout, exit |
| `K` | `columnFormatter` — formats columnar output with `padEnd` |
| `FxH` | `uiUnmounter` — writes final terminal bytes and unmounts the Ink/React UI tree |
| `qR` | `terminalRestorer` — restores terminal state after UI unmount |
| `xY8` | `rawTerminalWriter` — writes raw bytes including ANSI cursor-save (`\x1b7`) / cursor-restore (`\x1b8`) sequences |
| `Io_` | `finalSummaryWriter` — renders and writes the dim-styled final session summary |
| `b0` | `summaryLineBuilder` — builds individual summary lines |
| `Hm` | `summaryHeaderBuilder` — builds the summary header |
| `zy6` | `workdirResolver` — resolves the working directory via `q.statSync` |
| `q$` | `pidFileLocator` — locates the session PID file |
| `B9q` | `escapeSequenceNormaliser` — normalises `\\` and `\"` escape sequences |
| `So_` | `forcedExitHandler` — clears timeout, optionally sends `SIGKILL`, then calls `process.exit` |
| `qdH` | `outputDrainer` — awaits `oSA.drain` to flush buffered output |
| `a9q` | `settledExitFlusher` — `Promise.allSettled` over remaining tasks before final exit |
| `Yz6` | `startupPerfReporter` — emits `tengu_startup_perf` with startup profiling report |
| `g__` | `perfEventEmitter` — emits individual perf events via `ebA` |
| `rbA` | `perfReportSerializer` — serialises perf report to JSON and writes via `ebA` |
| `aZ8` | `scrollSummaryEmitter` — emits `tengu_scroll_summary` telemetry |
| `U9q` | `scrollMetricsCollector` — collects scroll position metrics |
| `p9q` | `scrollStatsCalculator` — calculates scroll statistics using `Date.now`, `Math.max`, `Math.round` |
| `m1` | `sessionRenderFinaliser` — finalises render mode (`local-agent`); handles fullscreen teardown |
| `W$6` | `renderModeStore` — stores current render mode value |
| `QxH` | `renderPromiseResolver` — resolves the render-complete promise via `rZ8` |
| `rZ8` | `renderCompletionSignal` — signal/resolve handle for render completion |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.