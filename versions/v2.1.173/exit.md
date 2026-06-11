---
type: feature-spec
feature: "exit"
cc_version: "2.1.173"
updated: "2026-06-11"
tags: ["exit", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.173 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/exit`

> Analysis basis: CC v2.1.173 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.173

---

## Overview

`/exit` (aliased as `/quit`) terminates the Claude Code CLI session. When invoked, it renders a brief farewell JSX element, fires a `prompt_input_exit` telemetry event, and then orchestrates a multi-phase shutdown sequence that flushes output streams, retires background daemon workers, disposes MCP connections, drains I/O, and finally calls `process.exit`.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `exit` |
| aliases | `["quit"]` |
| description | `null` |
| immediate | `true` |
| module_id | `jOK` |
| load_inline | `true` |
| loc_byte | `12895217` |
| loc_byte_end | `12895413` |
| arbor_handler.name | `Mi7` |
| arbor_handler.fqn | `claude-2.1.173::Mi7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.173 bundle.js:+12895217

---

## Input Branching

The command is `immediate: true` with no user-supplied argument processing — invocation always proceeds to the single shutdown path. There are no conditional branches on user input; branching occurs only inside the shutdown sub-routines (daemon state, terminal type, background tasks). A simple linear pseudocode is therefore appropriate here.

```
1. User types /exit  (or /quit)
2. Handler (exitCommandHandler) is called immediately — no argument parsing
3. Render farewell JSX element ("Goodbye!" string literal)
4. Emit telemetry event: prompt_input_exit
5. Call shutdownSequence()
6. Return resolved promise (no further REPL processing)
```

---

## Behavioral Spec

### Top-Level Handler — `exitCommandHandler` (`Mi7`)

Analysis basis: CC v2.1.173 bundle.js:+12894466

```
async function exitCommandHandler(context):
    // 1. Notify background/daemon layer of impending exit
    checkAndNotifyDaemonLayer()          // calls processStateChecker (O9 → CDH)

    // 2. Play exit animation / sound effect with random delay
    playExitEffect()                     // calls exitEffectPlayer (H → Math.random, setTimeout)
                                         // random seed range: [0, 2), delay variant: 1 unit
                                         // Analysis basis: bundle.js:+14012780

    // 3. Signal any running background sessions to detach
    requestBackgroundDetach()            // calls backgroundDetachCoordinator (R$H)
                                         // emits detach-request message via IPC writer (Wr → jHH.write)
                                         // serialises payload with JSON.stringify (CH)
                                         // Analysis basis: bundle.js:+11246223

    // 4. Flush pending scheduled-task state
    flushScheduledTaskState()            // calls scheduledTaskManager (iM)
                                         // Analysis basis: bundle.js:+12894499

    // 5. Render summary of background task activity
    renderTaskSummary()                  // calls backgroundTaskRenderer (tx8)
                                         // internally uses durationFormatter (Vv7 → hN, Ok, BsH, R9)
                                         // and textTruncator (pq → f8 → Bun.stringWidth)
                                         // label constant: "scheduled task" (bundle.js:+11239436)
                                         // Analysis basis: bundle.js:+12894513

    // 6. Render JSX farewell element
    render dOA.createElement(...)        // "Goodbye!" string (bundle.js:+12894430)
    emit telemetry("prompt_input_exit")  // bundle.js:+12894654

    // 7. Delegate to the main shutdown orchestrator
    await shutdownOrchestrator()         // calls Z9
```

### Daemon / Background Session Notification — `processStateChecker` (`O9`)

Analysis basis: CC v2.1.173 bundle.js:+2269219

```
function processStateChecker():
    // Checks process role ("bg", "daemon", "daemon-worker")
    // String constants at bundle.js:+2269142, +2269152, +2269166
    // Routes shutdown signal to the appropriate sub-layer (CDH)
```

### Background Detach Coordinator — `backgroundDetachCoordinator` (`R$H`)

Analysis basis: CC v2.1.173 bundle.js:+11246189

```
function backgroundDetachCoordinator():
    verifyBackgroundTaskQueue()          // q18 — checks task count
    buildDetachPayload()                 // Oiq → BC8, m8
                                         // task type constant: "task" (bundle.js:+11240567)
                                         // queue offset: 0 (bundle.js:+11240523)
    writeDetachRequest()                 // Wr → jHH.write
                                         // message type: "detach-request" (bundle.js:+11246223)
    serialisePayload()                   // CH → JSON.stringify (bundle.js:+188969)
    finaliseDetach()                     // LKH — cleanup
```

### Shutdown Orchestrator — `shutdownOrchestrator` (`Z9`)

Analysis basis: CC v2.1.173 bundle.js:+7372764

This is the most complex sub-routine; it coordinates all teardown phases under a race/timeout pattern.

```
async function shutdownOrchestrator():
    // Phase 1 — unmount terminal UI
    unmountTerminalUI()                  // uCH → nMH.writeSync, H.unmount, Db, V38
                                         // V38 saves/restores cursor (\x1b7 / \x1b8, bundle.js:+3843923)
                                         // terminal detection: ghostty ≥1.2.0, iTerm.app ≥3.6.6
                                         //   (bundle.js:+3571523, +3571592)
                                         // tmux / screen escape handling (b0, bundle.js:+3493361)

    // Phase 2 — write final output lines (startup-perf report if profiling enabled)
    writeSessionEndOutput()              // ed_ → Y0, Ou, y6, FN6, X$, xe9, nMH.writeSync
                                         // profiling report triggered by "startup-perf" marker
                                         //   (bundle.js:+220317)
                                         // replaceAll escapes: "\\\\" and "\\\"" (bundle.js:+7370819)
                                         // dim styling via W6.dim

    // Phase 3 — hard-exit helper (timeout-guarded)
    prepareHardExit()                    // Hc_ → clearTimeout, v4.get, process.exit, process.kill
                                         // error sentinel: "unreachable" (bundle.js:+7371181)

    // Phase 4 — drain I/O streams
    drainOutputStreams()                  // ZFH → yZA.drain (bundle.js:+63794)

    // Phase 5 — resolve session-end timing
    //   race between:
    //     a) supervisor shutdown (w → vEH, q.write, T.stop, E.stop, E.updateConfig, E.start)
    //     b) absolute timeout: Math.max(5000, 3500) ms (bundle.js:+7372861, +7372868)
    //     c) AbortSignal.timeout (bundle.js:+7373146)
    await Promise.race([
        supervisorShutdown(),            // w: stops/restarts supervisor, manages MCP connections
        timeoutFallback(maxWait)
    ])

    // Phase 6 — settle background async tasks
    await settleBackgroundTasks()        // le9 → Promise.allSettled, Array.from
                                         // Analysis basis: bundle.js:+7373106

    // Phase 7 — flush telemetry / perf data
    await flushTelemetry()               // E36 → as8 → CNA, c
                                         // startup perf event: tengu_startup_perf (bundle.js:+221519)
                                         // writes perf data (INA → _wH → UfH.openSync/writeFileSync/fsyncSync/closeSync)
                                         // max buffer: 1 048 576 bytes (bundle.js:+220998)
                                         // Analysis basis: bundle.js:+7373182

    // Phase 8 — emit session_end telemetry + cache eviction hint
    recordSessionEnd()                   // dW8 → Ce9 (timestamps via Date.now, Math.max, Math.round)
                                         // telemetry: session_end literal (bundle.js:+7373258)
    emitCacheEvictionHint()              // $6 → q56 (bundle.js:+3779)
    //   tengu_cache_eviction_hint (bundle.js:+7373220)

    // Phase 9 — final write + optional post-close handler
    await finalWrite()                   // pCH → Promise.resolve, gW8, H
                                         // writeSync to nMH (bundle.js:+7373328)
    clearTimeout(exitTimer)
```

### Supervisor Shutdown — `supervisorManager` (`w`)

Analysis basis: CC v2.1.173 bundle.js:+16775270

```
function supervisorShutdown():
    reportSupervisorMetrics()            // vEH → d9 (AsyncLocalStorage.getStore), N8, VwA, EH, Lq, ZwA
                                         // Object.keys iteration (bundle.js:+13180704)
    writeShutdownNotice()                // q.write (bundle.js:+16775287)
                                         // role label: "supervisor" (bundle.js:+16775295)
    stopOldConfigInstance()              // T.stop → pV6, N76
    deleteConfigEntry()                  // L.delete
    stopMCPConnections()                 // E.stop → W → N76, aS, UN, Promise.all
                                         // connection states: "connected", "failed" (bundle.js:+16603960)
                                         // "Connection failed" message (bundle.js:+16604166)
    updateDaemonConfig()                 // E.updateConfig
    restartSupervisor()                  // E.start
    emitHeartbeatCleanup()               // JrK → s_H (heartbeat constant, bundle.js:+16774516)
    storeNewEntry()                      // L.set
    startNewSessionTimer()               // V.start
    tengu_daemon_config_reload emitted   // bundle.js:+16776088
```

### Background Daemon Spare-Pool Management — `daemonSparePool` (`D`)

Analysis basis: CC v2.1.173 bundle.js:+16760466

Called transitively during background-session teardown on exit.

```
function daemonSparePool():
    // Lifecycle states: "closed", "claimed", "spawned", "spare", "exec"
    //   (bundle.js:+16760446, +16762155, +16762523, +16761376, +16761499)
    checkPoolMap()                       // A.get
    retireSettledSessions()              // Q.retireIfSettled, A.values
    handleLowMemory()                    // o0A.freemem, kF8, Math.round
                                         // threshold: 1024 MB (bundle.js:+16761079)
                                         // tengu_bg_dispatch_low_mem (bundle.js:+16761185)
    escalateSIGKILL()                    // b.kill("SIGKILL") (bundle.js:+16760632)
                                         // tengu_bg_dispatch_sigkill_escalate (bundle.js:+16760584)
                                         // retry cap: 100 (bundle.js:+16760659)
    manageDuplicateSessions()            // "dup-live" (bundle.js:+16760998)
                                         // "dup_retry_exhausted" (bundle.js:+16760927)
                                         // "dropped" (bundle.js:+16760950)
    enableSpare()                        // tengu_bg_spare_enable (bundle.js:+16761889)
    claimSpare()                         // tengu_bg_spare_claim (bundle.js:+16762017)
    handleClaimFail()                    // tengu_bg_spare_claim_fail (bundle.js:+16762283)
    spawnNewSession()                    // Hd.spawn, B.dispose
    sendDetachRequest()                  // "detach-request" IPC (see backgroundDetachCoordinator)
    handleErrors()                       // ENOENT, enoent, ECONNREFUSED, econnrefused
                                         //   (bundle.js:+16762192 … +16762229)
```

### Forced-Shutdown Guard — `forcedShutdownHelper` (`Y`)

Analysis basis: CC v2.1.173 bundle.js:+16793965

```
function forcedShutdownHelper():
    writeForced()                        // HX — writes "forced shutdown" label (bundle.js:+16793968)
    process.exit()                       // bundle.js:+16793987
    abortPendingSignals()               // z.abort (bundle.js:+16794008)
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Emitted when a background session requires SIGKILL escalation during shutdown (bundle.js:+16760584) |
| Telemetry: `tengu_bg_dispatch_low_mem` | Emitted when free memory falls below threshold (1024 MB) during spare-pool teardown (bundle.js:+16761185) |
| Telemetry: `tengu_bg_spare_enable` | Emitted when a spare background session slot is enabled (bundle.js:+16761889) |
| Telemetry: `tengu_bg_spare_claim` | Emitted on successful spare session claim (bundle.js:+16762017) |
| Telemetry: `tengu_bg_spare_claim_fail` | Emitted on spare claim failure (bundle.js:+16762283) |
| Telemetry: `tengu_daemon_config_reload` | Emitted when daemon configuration is reloaded during supervisor restart (bundle.js:+16776088) |
| Telemetry: `tengu_startup_perf` | Emitted in flush phase if startup profiling was enabled (bundle.js:+221519) |
| Telemetry: `tengu_scroll_summary` | Emitted during shutdown output phase (bundle.js:+7372277) |
| Telemetry: `tengu_amber_creek` | Emitted inside fullscreen/render mode detection (bundle.js:+3504471) |
| Telemetry: `tengu_pewter_brook` | Emitted inside fullscreen/render mode detection (bundle.js:+3504379) |
| Telemetry: `tengu_cache_eviction_hint` | Emitted at Phase 8 of shutdown to hint cache layer (bundle.js:+7373220) |
| Telemetry: `prompt_input_exit` | Emitted immediately after rendering the farewell element (bundle.js:+12894654) |
| Telemetry: `session_end` | Emitted at Phase 8 via `dW8`/`Ce9` with session timing data (bundle.js:+7373258) |
| Terminal UI | Unmounts Ink/JSX render tree; saves and restores terminal cursor via ANSI escape sequences `\x1b7` / `\x1b8` (bundle.js:+3843923) |
| IPC write | Sends `"detach-request"` message over daemon IPC socket before shutdown (bundle.js:+11246223) |
| Background sessions | Iterates all background sessions; retires settled ones; SIGTERM/SIGKILL escalation path available (bundle.js:+16762539) |
| MCP connections | Stopped via supervisor manager; connection state transitions: `connected → failed → disposed` (bundle.js:+16603960) |
| Process exit | `process.exit()` called inside `forcedShutdownHelper` (Hc_) after all phases complete (bundle.js:+7371108) |
| Startup perf report | Written to disk via sync file I/O (openSync/writeFileSync/fsyncSync/closeSync) if profiling enabled (bundle.js:+189514) |
| Timeout | Shutdown races against `Math.max(5000, 3500)` ms ≈ 5 000 ms maximum wait (bundle.js:+7372861) |
| AbortSignal timeout | `AbortSignal.timeout` used as race participant (bundle.js:+7373146) |
| Deferred timer | `setTimeout`-based unref timer (PWH.unref) set to 2 000 ms (bundle.js:+7373046) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.173 | Initial analysis |

---

## Common Mistakes

1. **Typing `/quit` expecting different behavior** — `/quit` is a registered alias for `/exit` and executes the identical handler; there is no behavioral difference.
2. **Assuming instant termination** — the command is `immediate: true` (no argument prompt), but the shutdown sequence itself is async with up to a 5 000 ms wait for background sessions and MCP connections to settle before `process.exit` is called.
3. **Expecting background sessions to be killed immediately** — the detach-request is sent over IPC first; SIGKILL escalation only happens if sessions do not respond within the grace window.
4. **Overlooking tmux/screen escape injection** — in tmux or GNU screen sessions, terminal-restore escape sequences are modified to avoid double-escape artifacts (bundle.js:+3493361); custom terminal wrappers may see unexpected output during exit.
5. **Startup profiling data loss** — if a crash or `SIGKILL` interrupts Claude Code before `/exit` completes its flush phase, the startup-profiling report is never written to disk because the write happens in Phase 7 of the shutdown orchestrator.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Mi7` | Top-level exit command handler (AsyncFunction, arbor_handler) |
| `O9` | Process-state checker / daemon-layer notifier |
| `CDH` | Daemon sub-layer dispatch target |
| `H` | Exit effect player (Math.random + setTimeout) |
| `R$H` | Background detach coordinator |
| `q18` | Background task queue verifier |
| `Oiq` | Detach payload builder |
| `BC8` | Detach payload helper A |
| `m8` | Detach payload helper B |
| `Wr` | IPC writer (detach-request) |
| `CH` | JSON serialiser wrapper |
| `LKH` | Detach finaliser / cleanup |
| `iM` | Scheduled-task state flusher |
| `tx8` | Background task summary renderer |
| `OE` | Render helper (BG consumer) |
| `BG` | Base graphics / output primitive |
| `Vv7` | Duration-formatter dispatcher |
| `hN` | Human-readable duration formatter |
| `K` | Cron-label padder (f.map + L.padEnd) |
| `D` | Daemon spare-pool manager |
| `f` | Async task tracker (q.add/delete/finally) |
| `j` | Session kill iterator (A.values + S.kill) |
| `Y` | Forced-shutdown helper (process.exit + z.abort) |
| `$` | Match dispatcher (ZwK consumer) |
| `J` | UTC date calculator |
| `Ok` | Duration line parser |
| `S9L` | Cron-expression parser |
| `A` | Lowercase label builder |
| `BsH` | Time-offset calculator |
| `_` | Generic string/date utility (toUpperCase, getTime, replaceAll) |
| `O` | Time-slot object (setSeconds/setMinutes etc.) |
| `L` | Connection/handle closer (A.close, q.close) |
| `q` | Data-event emitter ($1 consumer) |
| `R9` | Integer rounding helper (Math.floor + Math.round) |
| `pq` | Text truncator (indexOf + substring) |
| `f8` | String-width measurer (Bun.stringWidth) |
| `m1` | Multi-segment width calculator |
| `XY` | Width segment helper |
| `Li7` | Farewell JSX sub-element builder (pW consumer) |
| `Z9` | Shutdown orchestrator (main async teardown) |
| `uCH` | Terminal UI unmounter (nMH.writeSync + H.unmount) |
| `Db` | Post-unmount cleanup helper |
| `V38` | Terminal cursor save/restore + screen writer |
| `UkH` | Terminal-type detector (ghostty, iTerm.app) |
| `ykH` | Terminal write helper B |
| `b0` | tmux/screen escape adjuster |
| `v3` | Screen-write variant |
| `N` | Debug-log formatter (hVH, d8f, CH, lf, eh, oFH, i8f) |
| `ed_` | Session-end output writer |
| `Y0` | Output stream selector |
| `Ou` | Output helper A |
| `y6` | BG-primitive consumer |
| `FN6` | File-stat / path output helper |
| `YC` | BG wrapper A |
| `P_` | BG wrapper B |
| `o6` | Path joiner helper |
| `X$` | Alternate output path ($4 consumer) |
| `$4` | Secondary output sub-handler (y9 consumer) |
| `xe9` | Extra output escape helper |
| `Hc_` | Hard-exit guard (clearTimeout + process.exit + process.kill) |
| `ZFH` | I/O drain helper (yZA.drain) |
| `w` | Supervisor/MCP shutdown manager |
| `vEH` | Session metrics reporter |
| `d9` | AsyncLocalStorage store reader |
| `N8` | Metrics accumulator |
| `VwA` | Metrics aggregator (ZwA consumer) |
| `EH` | String coercion helper |
| `oDK` | Config diff reporter (Object.keys + Math.max + fD) |
| `T` | Config instance controller (pV6, N76) |
| `pV6` | Config stop sub-routine A |
| `N76` | Config stop sub-routine B |
| `E` | MCP connection manager (stop/updateConfig/start) |
| `W` | MCP connection lifecycle (N76, aS, UN, Promise.all) |
| `JrK` | Heartbeat cleanup dispatcher (s_H) |
| `s_H` | Heartbeat cleanup executor |
| `V` | Session timer controller |
| `c` | Generic close/cleanup primitive |
| `le9` | Background-task settler (Promise.allSettled + Array.from) |
| `E36` | Telemetry flush orchestrator |
| `as8` | Telemetry batch writer (CNA consumer) |
| `CNA` | Telemetry payload builder (Ju, q.set/get, Object.entries) |
| `INA` | Perf report writer (disk I/O via _wH) |
| `SNA` | Perf report path builder A |
| `_wH` | Sync file writer (openSync/writeFileSync/fsyncSync/closeSync) |
| `VNA` | Perf report serialiser (Ju, A.push, _.entries, go) |
| `Ju` | perf_hooks require wrapper |
| `RNA` | Perf report path builder B |
| `dW8` | Session-end event recorder (Ce9 consumer) |
| `be9` | Session-end helper B |
| `Ce9` | Session timing calculator (Date.now, Math.max, Math.round, Object.assign) |
| `Se9` | Session timing sub-helper |
| `v1` | Fullscreen/render mode selector |
| `J8H` | Fullscreen capability checker |
| `cV_` | Fullscreen path A (f6 consumer) |
| `ks` | Fullscreen path B (vp4 consumer) |
| `dV_` | Fullscreen path C (s6, Boolean) |
| `B_` | Fullscreen path D (vB consumer) |
| `Np4` | Y6 wrapper for fullscreen enable |
| `Y6` | Display mode activator (I26, k26, Ym, ajH, I78, N26, zF, b6) |
| `y56` | Post-session cleanup helper |
| `$6` | Cache eviction hint dispatcher (q56) |
| `q56` | Cache eviction hint emitter |
| `pCH` | Final write coordinator (Promise.resolve + gW8) |
| `gW8` | Final write sub-handler |