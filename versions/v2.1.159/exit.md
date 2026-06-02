---
type: feature-spec
feature: "exit"
cc_version: "2.1.159"
updated: "2026-06-02"
tags: ["exit", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.159 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/exit`

> Analysis basis: CC v2.1.159 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.159

---

## Overview

`/exit` (also aliased as `/quit`) terminates the Claude Code CLI session. When invoked, the command renders a brief farewell message ("Goodbye!"), flushes pending I/O, tears down the active UI, writes session-end telemetry, and calls `process.exit` to terminate the process — with an optional `process.kill` escalation path if clean shutdown stalls.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `exit` |
| description | `null` |
| aliases | `["quit"]` |
| immediate | `true` |
| module_id | `To1` |
| load_inline | `true` |
| loc_byte | `12376477` |
| loc_byte_end | `12376673` |
| loc_line | `8261` |
| arbor_handler.name | `G$5` |
| arbor_handler.fqn | `claude-2.1.159::G$5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.159 bundle.js:+12376477

---

## Input Branching

The exit flow has more than three distinct runtime branches (background-session detach, UI teardown, foreground clean exit, and force-kill escalation), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/exit or /quit invoked"] --> B{Immediate flag set?}
    B -->|yes| C[Render 'Goodbye!' JSX message\nbundle.js:+12375690]
    C --> D[Call shutdownHandler\n(G$5 / _9 chain)]
    D --> E{Active background session?}
    E -->|yes| F[Send detach-request to daemon\nbundle.js:+10775857]
    F --> G[Write session state via Rs / Ss.write\nbundle.js:+10604010]
    E -->|no| H[Proceed to UI teardown]
    G --> H
    H --> I[Unmount terminal UI\n(wIH → H.unmount)\nbundle.js:+5357049]
    I --> J[Flush stdout / write final bytes\n(qjH.writeSync)\nbundle.js:+5359654]
    J --> K[Drain output buffers\n(sxH → zOA.drain)\nbundle.js:+58901]
    K --> L[Emit 'prompt_input_exit' literal\nbundle.js:+12375914]
    L --> M[Emit session_end telemetry\nbundle.js:+5359585]
    M --> N[Race: clean exit vs AbortSignal.timeout\nbundle.js:+5359476]
    N --> O{Clean exit within timeout?}
    O -->|yes| P[process.exit\nbundle.js:+5357649]
    O -->|no| Q[process.kill escalation\nbundle.js:+5357674]
    Q --> R[Throw 'unreachable' Error\nbundle.js:+5357722]
```

---

## Behavioral Spec

### 1. Handler Entry — `exitCommandHandler` (G$5)

`exitCommandHandler` is an `AsyncFunction` resolved via `module_id → To1`. It is the sole registered handler for both `/exit` and `/quit`.

```
async function exitCommandHandler(context):
    // Render farewell UI element
    renderFarewellMessage()                   // __A.createElement, W$5→J2
                                              // literal "Goodbye!" at bundle.js:+12375690

    // Trigger background-session detach if applicable
    detachBackgroundSessionIfPresent()        // a5H call at bundle.js:+12375742

    // Update app state to reflect exit intent
    updateExitState(context)                  // sf call at bundle.js:+12375759

    // Initiate scheduled-task cleanup
    cleanupScheduledTasks()                   // IV8 call at bundle.js:+12375773

    // Perform full UI + process shutdown
    await performShutdown()                   // _9 call at bundle.js:+12375909

    // Emit prompt_input_exit signal
    signalPromptExit()                        // literal "prompt_input_exit" bundle.js:+12375914
```

Analysis basis: CC v2.1.159 bundle.js:+12375726

---

### 2. Background-Session Detach — `detachBackgroundSession` (a5H)

When a background session is active, the handler sends a `"detach-request"` message to the daemon worker before tearing down the UI.

```
function detachBackgroundSession(sessionState):
    if sessionState.mode in ["bg", "daemon", "daemon-worker"]:  // bundle.js:+2202033
        writeDetachRequest(sessionState)      // Rs → Ss.write at bundle.js:+10604010
        // message type: "detach-request"     // literal bundle.js:+10775857
        serializePayload()                    // RH → JSON.stringify at bundle.js:183568
        scheduleDetachAck()                   // rAH at bundle.js:+10775903
```

Analysis basis: CC v2.1.159 bundle.js:+10775823

---

### 3. Scheduled-Task Teardown — `cleanupScheduledTasks` (IV8)

All registered scheduled tasks (identified by the literal `"scheduled task"` at bundle.js:+10769319) are cancelled before shutdown proceeds.

```
function cleanupScheduledTasks():
    logCleanup()                              // IG → _N at bundle.js:+51376
    for each task in activeTasks:             // H.push bookkeeping bundle.js:+10769305
        cancelTask(task)                      // PiL call at bundle.js:+10769346
        truncateTaskOutput(task)              // R9 call at bundle.js:+10769361
```

Analysis basis: CC v2.1.159 bundle.js:+10769300

---

### 4. Shutdown Sequence — `performShutdown` (_9)

This is the core async shutdown routine. It sequences UI unmount, buffer flush, telemetry emission, and process termination.

```
async function performShutdown():
    // Step 1: Unmount terminal UI
    unmountTerminalUI()                       // wIH → H.unmount at bundle.js:+5357049

    // Step 2: Write startup-perf / final output bytes to stdout
    flushFinalOutput()                        // Pv_ call at bundle.js:+5359191
                                              // qjH.writeSync at bundle.js:+5357441

    // Step 3: Write session summary stats
    writeSessionSummary()                     // bf8 → gX9 at bundle.js:+5359525

    // Step 4: Stop supervisor and daemon config
    stopSupervisorAndDaemon()                 // Y call at bundle.js:+5359388
                                              // literal "supervisor" bundle.js:+15483188

    // Step 5: Drain output buffers
    await drainOutputBuffers()                // sxH → zOA.drain at bundle.js:+58901

    // Step 6: Race clean exit against a hard timeout
    gracefulTimeout_ms = max(5000, 3500)      // literals bundle.js:+5359214, +5359221
    result = await Promise.race([
        cleanExit(),                          // Wv_ at bundle.js:+5359197
        AbortSignal.timeout(gracefulTimeout_ms) // bundle.js:+5359476
    ])

    // Step 7: If race resolved cleanly
    clearTimeout(pendingTimer)                // bundle.js:+5359411
    process.exit(0)                           // Wv_ → process.exit bundle.js:+5357649
```

Analysis basis: CC v2.1.159 bundle.js:+5359117

---

### 5. Force-Kill Escalation — `forceKillEscalation` (Wv_)

If the clean exit path does not complete within the timeout window, the handler escalates to `process.kill`.

```
async function forceKillEscalation():
    clearTimeout(pendingShutdownTimer)        // bundle.js:+5357568
    session = getActiveSession()              // t4.get at bundle.js:+5357601

    if session exists:
        process.exit(0)                       // bundle.js:+5357649
    else:
        process.kill(process.pid, signal)     // bundle.js:+5357674

    // Should never reach here
    throw new Error("unreachable")            // literal bundle.js:+5357722
```

Analysis basis: CC v2.1.159 bundle.js:+5357568

---

### 6. Terminal UI Teardown — `teardownTerminalUI` (wIH)

Handles terminal-specific cleanup including cursor restoration and multiplexer escape sequences.

```
function teardownTerminalUI():
    qjH.writeSync(stdout, finalBytes)         // bundle.js:+5356971
    session = t4.get(sessionKey)              // bundle.js:+5356998
    H.unmount(uiRoot)                         // bundle.js:+5357049
    mR(session)                               // post-unmount hook bundle.js:+5357083

    // Emit terminal restore sequences
    gq8(terminalState)                        // bundle.js:+5357131
    // Sequences include ESC-7 / ESC-8 save/restore   bundle.js:+3717278, +3717289
    // Handle tmux / iTerm2 / Ghostty multiplexers     bundle.js:+3370149, +3447613
```

Analysis basis: CC v2.1.159 bundle.js:+5356971

---

### 7. Farewell Display — `renderGoodbyeMessage` (W$5 → J2)

```
function renderGoodbyeMessage():
    return createElement(GoodbyeComponent, {
        message: "Goodbye!"    // literal bundle.js:+12375690
    })
```

Analysis basis: CC v2.1.159 bundle.js:+12375681

---

### 8. Randomised Exit Effect — `randomExitDelay` (H)

A small stochastic delay is introduced in the shutdown path using `Math.random` and `setTimeout`.

```
function randomExitDelay():
    delay = Math.floor(Math.random() * 2) + 1   // literals 2, 1 at bundle.js:+13425514, +13425530
    setTimeout(continueShutdown, delay)
```

Analysis basis: CC v2.1.159 bundle.js:+13425516

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `session_end` | Fired at bundle.js:+5359585 during `performShutdown` |
| Telemetry — `tengu_scroll_summary` | Fired at bundle.js:+5358517 (session summary stats via `gX9`) |
| Telemetry — `tengu_cache_eviction_hint` | Fired at bundle.js:+5359550 during cache cleanup |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Fired at bundle.js:+15469493 if background worker requires SIGKILL |
| Telemetry — `tengu_bg_dispatch_low_mem` | Fired at bundle.js:+15470072 during daemon resource checks |
| Telemetry — `tengu_bg_spare_enable` | Fired at bundle.js:+15470767 |
| Telemetry — `tengu_bg_spare_claim` | Fired at bundle.js:+15470888 |
| Telemetry — `tengu_bg_spare_claim_fail` | Fired at bundle.js:+15471151 |
| Telemetry — `tengu_bg_spare_spawn` | Fired at bundle.js:+15469186 |
| Telemetry — `tengu_daemon_config_reload` | Fired at bundle.js:+15483981 during supervisor stop |
| Telemetry — `tengu_startup_perf` | Fired at bundle.js:+215155 (startup perf report flushed on exit) |
| Telemetry — `tengu_amber_creek` | Fired at bundle.js:+3378550 (fullscreen/flicker detection path) |
| Telemetry — `tengu_pewter_brook` | Fired at bundle.js:+3378458 (fullscreen/flicker detection path) |
| Signal `prompt_input_exit` | Literal emitted at bundle.js:+12375914 to mark interactive exit entry |
| Background-session detach | `"detach-request"` message written via `Ss.write` when session mode is `"bg"`, `"daemon"`, or `"daemon-worker"` (bundle.js:+2202033) |
| Terminal escape sequences | ESC-7 / ESC-8 cursor save/restore sequences written on exit (bundle.js:+3717278, +3717289); tmux, iTerm2, and Ghostty multiplexer handling active |
| `process.exit` | Called via `Wv_` at bundle.js:+5357649 |
| `process.kill` escalation | Called at bundle.js:+5357674 if `process.exit` path not taken within timeout |
| Scheduled-task cancellation | All tasks tagged `"scheduled task"` (bundle.js:+10769319) are cancelled via `IV8` |
| Output buffer drain | `zOA.drain` called via `sxH` at bundle.js:+58901 |
| Graceful shutdown timeout | `max(5000, 3500)` ms = 5000 ms (bundle.js:+5359214, +5359221) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.159 | Initial analysis |

---

## Common Mistakes

1. **Using `/exit` while an agent turn is in progress** — because `immediate: true` is set, the command fires immediately without waiting for an in-flight response to complete. Any partial model output may be discarded.
2. **Expecting synchronous termination** — the shutdown is async and races against a 5 000 ms timeout; in rare cases (hung I/O) the process may take up to that window before `process.kill` fires.
3. **Confusing `/exit` with Ctrl-C** — Ctrl-C sends SIGINT and follows a different abort path; `/exit` and `/quit` follow the orderly `performShutdown` sequence described here.
4. **Not recognising `/quit` as an alias** — `/quit` is registered identically and produces exactly the same behaviour (bundle.js:+12376477).
5. **Assuming background sessions are killed immediately** — a `"detach-request"` is sent first; the daemon worker may remain running briefly until it acknowledges the detach.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `G$5` | Main exit command handler (`AsyncFunction`; arbor_handler, resolved via `module_id → To1`) |
| `N9` | Background session mode checker (reads mode flags `"bg"`, `"daemon"`, `"daemon-worker"`) |
| `QOH` | Mode-string comparison helper called from `N9` |
| `H` | Random exit-delay helper (uses `Math.random` + `setTimeout`) |
| `a5H` | Background-session detach dispatcher |
| `no6` | Helper called at start of detach sequence |
| `yN1` | Session state reader within detach path |
| `VPH` | Sub-helper of `yN1` |
| `k8` | Sub-helper of `yN1` |
| `Rs` | Detach-request writer (calls `Ss.write`) |
| `RH` | JSON serialisation wrapper (`JSON.stringify`) |
| `rAH` | Detach-acknowledgement scheduler |
| `sf` | Exit-state updater (app-state mutation) |
| `IV8` | Scheduled-task teardown coordinator |
| `IG` | Cleanup logger inside task teardown |
| `_N` | Low-level logging primitive |
| `PiL` | Individual scheduled-task canceller |
| `FV` | Task-output truncation / formatting utility |
| `K` | Cron-expression formatter (uses `L.map`, `f.padEnd`) |
| `w` | Background worker / process manager |
| `L` | Pending-task set manager (`q.add`, `q.delete`) |
| `j` | Process-kill helper for background workers |
| `D` | Daemon resource / state disposal helper |
| `$` | Session-object helper (calls `Xs1`) |
| `J` | Date/time calculation helper (UTC methods) |
| `jI` | Task-string parser |
| `Fv7` | Cron-field token parser |
| `A` | Token accumulator / locale-lower helper |
| `YnH` | Next-run-time calculator |
| `_` | Generic accumulator / string helper |
| `O` | Date-object mutator in time calculations |
| `f` | File/connection close manager |
| `q` | File-unlink / cleanup queue |
| `aq` | Duration formatter (`Math.floor`, `Math.round`) |
| `R9` | Text truncation helper (uses `H.indexOf`, `H.substring`) |
| `H8` | String-width measurer (`Bun.stringWidth`) |
| `Yq` | Wide-character / grapheme splitter |
| `JY` | Sub-helper of `Yq` |
| `W$5` | Goodbye-message JSX component renderer |
| `_9` | Core async shutdown sequence |
| `wIH` | Terminal UI teardown (unmounts UI, writes final bytes) |
| `mR` | Post-unmount hook |
| `gq8` | Terminal escape sequence emitter (save/restore, multiplexer handling) |
| `yVH` | Terminal-type detector (Ghostty, iTerm2, etc.) |
| `EVH` | Additional terminal escape handler |
| `KW` | Multiplexer escape rewriter (tmux `\e\e` replacement) |
| `CH` | String coercion wrapper |
| `Pv_` | Final stdout line writer (startup-perf path) |
| `JZ` | Output stream reference |
| `Ib` | Output helper called in final write path |
| `I6` | Low-level write utility |
| `jP6` | Startup-perf file path builder |
| `US` | Platform path helper |
| `O_` | Platform path helper (variant) |
| `g6` | Directory existence checker |
| `y$` | Startup-perf data reader |
| `m4` | Perf-data deserialiser |
| `dX9` | Perf-summary formatter |
| `Wv_` | Force-kill escalation handler (`process.exit` / `process.kill`) |
| `sxH` | Output-buffer drain wrapper (`zOA.drain`) |
| `Y` | Supervisor stop / daemon config updater |
| `m2H` | Session-summary stats aggregator |
| `e9` | Async-storage store reader |
| `w8` | State accessor helper |
| `hAA` | Stats sub-aggregator |
| `EH` | String coercion in stats path |
| `Qe1` | Stats formatter / column-width calculator |
| `G` | Input event stop-propagation handler |
| `b` | Event object (has `preventDefault`) |
| `I0` | User-settings reader |
| `E` | Telemetry / metrics emitter (stop/updateConfig/start) |
| `sVK` | Heartbeat scheduler |
| `lHH` | Heartbeat implementation |
| `V` | Secondary metrics emitter |
| `d` | Generic disposable / finaliser |
| `NK6` | Telemetry flush coordinator |
| `xB8` | Telemetry batch sender |
| `WDA` | Telemetry payload builder |
| `wDA` | Telemetry file writer orchestrator |
| `XDA` | Telemetry file path resolver (startup-perf variant) |
| `K$H` | Atomic file writer (`openSync` / `writeFileSync` / `fsyncSync` / `closeSync`) |
| `ODA` | Telemetry record serialiser |
| `Sb` | `perf_hooks` module loader |
| `PDA` | Alternate telemetry file path resolver |
| `N` | Telemetry event record builder |
| `bf8` | Session-summary / scroll-summary emitter |
| `QX9` | Scroll-summary data collector |
| `gX9` | Session metrics snapshot builder |
| `BX9` | Sub-helper of `gX9` |
| `qq` | Session-end event composer |
| `B$H` | isK membership checker |
| `RD_` | Session-end record builder |
| `Fr` | Sub-helper of session-end record path |
| `SD_` | Boolean coercion helper in session-end path |
| `B_` | Metrics reporter (`Cp`) |
| `y77` | `G6` caller in session-end path |
| `G6` | Telemetry dispatch entry point |
| `p96` | Cache-eviction hint emitter |
| `xf8` | Async multi-promise teardown helper |
| `g8` | Timeout-with-abort helper (uses `setTimeout`, `clearTimeout`, `AbortSignal`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.