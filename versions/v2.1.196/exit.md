---
type: feature-spec
feature: "exit"
cc_version: "2.1.196"
updated: "2026-06-30"
tags: ["exit", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.196 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/exit`

> Analysis basis: CC v2.1.196 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.196

---

## Overview

`/exit` (aliased as `/quit`) terminates the Claude Code CLI session immediately. When invoked, the command renders a farewell JSX component, emits telemetry, and then drives an orderly teardown sequence that flushes I/O, stops background agents, unmounts the terminal UI, and finally calls `process.exit`. The command is typed `local-jsx`, meaning its result is a rendered React/Ink component tree rather than a plain text prompt.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `exit` |
| description | `null` |
| aliases | `["quit"]` |
| immediate | `true` |
| module_id | `qtc` |
| load_inline | `true` |
| loc_byte | `13061300` |
| loc_byte_end | `13061496` |
| loc_line | `9031` |
| arbor_handler.name | `dXf` |
| arbor_handler.fqn | `claude-2.1.196::dXf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.196 bundle.js:+13061300

---

## Input Branching

The command has no user-supplied argument that changes its behaviour: it is `immediate: true` and always follows the same teardown path. A single linear pseudocode representation is therefore appropriate.

```
1. User types /exit (or /quit)
2. Command is resolved as immediate (no confirmation prompt)
3. Handler dXf() is invoked
4. Farewell message "Goodbye!" is displayed via JSX component
5. Telemetry event "session_end" is emitted
6. Orderly shutdown sequence begins (see Behavioral Spec)
7. process.exit() is called
```

---

## Behavioral Spec

### Top-level handler (`dXf`)

The Arbor-resolved handler is the async function `dXf` (FQN `claude-2.1.196::dXf`, reached via `module_id` resolution path).

```
async function exitCommandHandler(context):
    // 1. Render farewell UI
    displayGoodbyeMessage("Goodbye!")          // literal @ bundle.js:+13060523
    renderJSXComponent(ExitComponent)           // Ktc.jsx call @ +13060636

    // 2. Emit session-end telemetry
    emitTelemetry("session_end")               // literal @ bundle.js:+7435854
    emitTelemetry("prompt_input_exit")         // literal @ bundle.js:+13060737

    // 3. Detach any background-mode session
    sendDetachRequest()                         // "detach-request" @ +11565115

    // 4. Flush pending I/O and scheduled tasks
    flushScheduledTasks(context)                // S5n @ +13060606
    flushOutputStream()                         // AQe / fis.drain @ +68585

    // 5. Run shutdown sequence
    shutdownSequence(context)                   // Ri @ +13060732

    // 6. Final stderr write (cursor/state restore)
    writeToStderr(restoreSequence)              // rAe.writeSync @ +7435928
```

Analysis basis: CC v2.1.196 bundle.js:+13060559 – +13060732

---

### Scheduled-task flush (`S5n`)

Before exiting, the handler drains any in-flight scheduled tasks. This involves collecting pending items, padding their display names, and computing next-run times.

```
function flushScheduledTasks(context):
    tasks = collectPendingTasks()              // xC, g0 @ +7469972
    for each task in tasks:
        label = formatLabel(task, "scheduled task")  // literal @ +7470013
        nextRun = computeNextRun(task)        // A$p @ +7470040
        recordTaskCompletion(label, nextRun)
    truncateDisplayIfNeeded()                 // Va @ +7470055
```

Analysis basis: CC v2.1.196 bundle.js:+7469972

---

### Background-session detach (`dTe`)

If a background or daemon session is active, the command issues a detach-request before teardown.

```
function sendDetachRequest(context):
    // Identify session type: "bg", "daemon", or "daemon-worker"
    // literals @ bundle.js:+2343120, +2343130, +2343144
    sessionType = getSessionType()
    if sessionType in ["bg", "daemon", "daemon-worker"]:
        writeDetachMessage("detach-request")  // YW / gZ.write @ +11041911
        serializeState(JSON.stringify)         // Me @ +11041920
        cleanupResources()                    // rme @ +11565191
```

Analysis basis: CC v2.1.196 bundle.js:+11565078 – +11565191

---

### Shutdown sequence (`Ri`)

This is the core async teardown pipeline. It runs multiple sub-steps with timeouts and races.

```
async function shutdownSequence(context):
    // Phase 1: Unmount terminal UI and restore cursor
    unmountInkComponent()                     // e8e / e.unmount @ +7432406
    restoreTerminalState()                    // uDn @ +7432488
    // Terminal escape sequences: ESC-7 (+3932924) and ESC-8 (+3932935)
    // Handles tmux (escape double), ghostty >= 1.2.0, iTerm.app >= 3.6.6
    // literals @ +3654217, +3654247, +3654286, +3654318

    // Phase 2: Print scroll summary / final output
    printScrollSummary()                      // s5n, telemetry "tengu_scroll_summary" @ +7434850
    // emits "tengu_cache_eviction_hint" @ +7435816

    // Phase 3: Race a drain-or-timeout
    timeoutMs = Math.max(5000, 3500)          // literals @ +7435434, +7435441
    await Promise.race([
        drainAllOutputStreams(),              // AQe / fis.drain @ +68585
        timeout(timeoutMs)
    ])

    // Phase 4: Settle all pending promises
    await Promise.allSettled(pendingAgentTasks)   // PFa @ +7419235
    await Promise.allSettled(supervisorTasks)     // u2a @ +13726020

    // Phase 5: Force kill if still alive after 2000 ms grace
    // literal @ +7435619
    forced_shutdown_signal = AbortSignal.timeout(2000)
    forceKillHandler()                        // M_o @ +7432912
    // sends SIGKILL if process does not exit cleanly
    // literal "SIGKILL" @ +7433043
    // literal "forced shutdown" @ +18029485

    // Phase 6: Write performance telemetry
    writePerfReport()                         // ixt / _cs / bcs @ +226740
    // emits "tengu_startup_perf" @ +228426

    // Phase 7: Final process exit
    process.exit(0)                           // M_o / p @ +7432993, +18029504
```

Analysis basis: CC v2.1.196 bundle.js:+7435337 – +7435928

---

### UI unmount and terminal restore (`e8e`, `uDn`)

Handles writing escape sequences to restore the terminal to its pre-Claude-Code state, with special-cased logic for multiplexers and terminal emulators.

```
function unmountAndRestore():
    writeToStdout(rawEscapeSequence)          // rAe.writeSync @ +7432328
    instance = getInkInstance()               // lu.get @ +7432355
    instance.unmount()                        // e.unmount @ +7432406
    clearZoneState()                          // zN @ +7432440
    restoreCursorPosition(uDn)               // uDn @ +7432488
    // Checks terminal: tmux, ghostty, iTerm.app
    // writes ESC-7 / ESC-8 cursor save/restore sequences
    // handles tmux escape prefix "\x1b\x1b" @ +3576965
    // handles screen multiplexer @ +3576992
```

Analysis basis: CC v2.1.196 bundle.js:+7432328 – +7432488

---

### Force-kill path (`M_o`)

If the process does not exit within the grace period, a hard kill is sent.

```
function forceKillHandler():
    clearTimeout(gracePeriodTimer)
    instance = getInkInstance()
    if exitCodeAlreadySet:
        process.exit(exitCode)               // +7432993
    else:
        process.kill(process.pid, "SIGKILL") // +7433018, literal @ +7433043
        throw new Error("unreachable")       // literal @ +7433066
```

Analysis basis: CC v2.1.196 bundle.js:+7432912 – +7433066

---

### Startup performance report on exit (`ixt` / `_cs` / `bcs`)

If startup profiling was enabled, the shutdown path writes a profiling report before the process exits.

```
function maybeWriteStartupPerfReport():
    if not profilingEnabled:
        log("Startup profiling not enabled")    // literal @ +226245
        return
    checkpoints = getCheckpoints()
    if checkpoints is empty:
        log("No profiling checkpoints recorded") // literal @ +226335
        return
    writeReportFile(
        header = "STARTUP PROFILING REPORT",   // literal @ +226410
        encoding = "utf8",                      // literal @ +226895
        width = 80                              // literal @ +226398
    )
    emitTelemetry("tengu_startup_perf")        // @ +228426
```

Analysis basis: CC v2.1.196 bundle.js:+226740 – +226959

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `session_end` | Fired once per `/exit` invocation; literal at bundle.js:+7435854 |
| Telemetry: `prompt_input_exit` | Fired at the prompt layer when the exit command is confirmed; literal at bundle.js:+13060737 |
| Telemetry: `tengu_scroll_summary` | Emitted during scroll/output summary phase at bundle.js:+7434850 |
| Telemetry: `tengu_cache_eviction_hint` | Emitted during scroll summary phase at bundle.js:+7435816 |
| Telemetry: `tengu_startup_perf` | Emitted only when startup profiling was active; at bundle.js:+228426 |
| Telemetry: `tengu_amber_creek` | Emitted from fullscreen/UI setup path reached during shutdown; at bundle.js:+3586565 |
| Telemetry: `tengu_pewter_brook` | Emitted from same UI setup path; at bundle.js:+3586472 |
| Telemetry: `tengu_daemon_config_reload` | Emitted if daemon config is reloaded during teardown; at bundle.js:+18010884 |
| Ink UI | Unmounted via `e.unmount()` before process.exit |
| Terminal cursor | Restored using ESC-7 / ESC-8 ANSI escape sequences |
| Background session | Sent a `"detach-request"` message via IPC before exit |
| Pending promises | Settled via `Promise.allSettled` with timeout races (5000 ms / 3500 ms / 2000 ms) |
| Scheduled tasks | Drained and logged before exit |
| `process.exit` | Called with code `0` under normal conditions; `SIGKILL` sent if grace period expires |
| Sound | None detected in depth-2 traversal |
| appState changes | Supervisor stopped and restarted sequence observed (`E.stop`, `A.stop`, `A.updateConfig`, `A.start`) at bundle.js:+18010359 – +18010506 |

---

## Version History

| Version | Change |
|---|---|
| v2.1.196 | Initial analysis |

---

## Common Mistakes

1. **Using `/exit` inside a piped/non-interactive session** — the command assumes a live Ink terminal. In non-TTY contexts, the unmount step is a no-op but the process still exits, which may abort a pipeline unexpectedly.
2. **Expecting an immediate hard exit** — `/exit` is `immediate: true` at the command-dispatch level, but the teardown is async and may take up to ~5 seconds draining streams before `process.exit` is called. Do not rely on instantaneous termination.
3. **Confusing `/quit` with a separate command** — `/quit` is an alias registered at the same entry; it is functionally identical and shares the same handler (`dXf`).
4. **Assuming no telemetry fires on exit** — multiple `tengu_*` events are emitted during teardown, including `session_end` and `prompt_input_exit`. These fire even in offline or restricted environments where network delivery may fail silently.
5. **Killing the parent process to avoid exit cleanup** — the `M_o` force-kill path escalates to `SIGKILL` if ordinary exit is blocked, so external signals may race with the internal kill logic.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `dXf` | Main exit command handler (AsyncFunction; Arbor FQN `claude-2.1.196::dXf`) |
| `Hi` | Session-type resolver / background session check |
| `BLe` | Background-session helper called by session-type resolver |
| `dTe` | Detach-request sender for background/daemon sessions |
| `dTn` | Sub-helper of detach sender |
| `oBa` | Resource cleanup helper within detach flow |
| `_5n` | Internal utility called by resource cleanup |
| `yn` | Utility (shared; also called from date/time helpers) |
| `YW` | IPC write helper (writes detach message to channel) |
| `Me` | JSON serialization wrapper |
| `rme` | Post-detach cleanup step |
| `$m` | Intermediate utility called directly from exit handler |
| `S5n` | Scheduled-task flush orchestrator |
| `xC` | Task collection utility inside flush |
| `g0` | Low-level utility (shared across many callers) |
| `A$p` | Per-task processing step (computes next-run, labels) |
| `LO` | Cron / schedule expression parser |
| `dU` | Schedule string tokenizer |
| `kcp` | Cron-field range expander |
| `Tut` | Next-occurrence time calculator |
| `Ji` | Duration formatter (floor/round arithmetic) |
| `Va` | Display-width truncator |
| `on` | Grapheme / string-width measurer (wraps `Bun.stringWidth`) |
| `Ms` | Multi-line width helper |
| `qE` | Sub-utility of multi-line width helper |
| `uXf` | JSX exit component factory |
| `Uk` | Inner UI element created by exit component |
| `Ri` | Core async shutdown pipeline |
| `e8e` | Ink unmount + raw-write step |
| `zN` | Zone/state clear after unmount |
| `uDn` | Terminal cursor restore (writes ESC-7 / ESC-8) |
| `J5e` | Terminal emulator version checker (ghostty, iTerm.app) |
| `j5e` | Secondary terminal helper |
| `px` | Multiplexer escape prefix handler (tmux/screen) |
| `_d` | Utility called from terminal restore path |
| `T` | Logging / debug output helper |
| `k_o` | Scroll / output summary writer |
| `OL` | Shared utility (scroll path) |
| `_5` | Shared utility (scroll path) |
| `Rt` | File-system path helper |
| `QGt` | Config/stat file checker |
| `t3` | Sub-helper of config checker |
| `dr` | Sub-helper of config checker |
| `qt` | Path join utility |
| `jg` | Additional file resolver |
| `Kc` | Path-resolution sub-step |
| `hli` | Scroll/output helper |
| `M_o` | Force-kill / SIGKILL escalation handler |
| `AQe` | Stream drain helper (wraps `fis.drain`) |
| `d` | Supervisor control orchestrator |
| `TYe` | File-existence / stat check utility |
| `rn` | Sub-step of file stat check |
| `Ks` | Async store accessor |
| `zGo` | Config key getter |
| `he` | String coercion helper |
| `gic` | Output formatting helper (key-width alignment) |
| `E` | SDK/transport stop controller |
| `$Ct` | Transport sub-controller (HTTP/SSE) |
| `Re` | Error-logging finalization step |
| `er` | Error construction/stringification utility |
| `A` | Agent/supervisor instance |
| `QHr` | Array-type checker inside agent stop |
| `XHr` | String prefix/slice utility (ANSI / path stripping) |
| `H` | Process group / userinfo manager |
| `Wqc` | Heartbeat/watchdog stopper |
| `Wce` | Heartbeat inner helper |
| `I` | Input handler / key-event manager |
| `M` | HTTP gateway / OAuth server handler (large; exits only touches stop path) |
| `V` | Shared value/state cell |
| `PFa` | Promise.allSettled wrapper for agent tasks |
| `u2a` | Promise.allSettled wrapper for supervisor tasks |
| `ixt` | Startup performance report writer |
| `ETr` | Perf-event emitter (fires `tengu_startup_perf`) |
| `bcs` | Checkpoint aggregator and stats calculator |
| `_cs` | Report file writer (UTF-8, 80-col) |
| `Scs` | Report section formatter |
| `nve` | Sync file write helper (open/write/fsync/close) |
| `mcs` | Checkpoint table builder |
| `I5` | `require("perf_hooks")` wrapper |
| `Acs` | Alternate report path formatter |
| `s5n` | Scroll-summary + cache-eviction-hint emitter |
| `QFa` | Scroll-summary sub-helper |
| `XFa` | Timing/metrics aggregator for scroll summary |
| `YFa` | Sub-helper of timing aggregator |
| `$s` | UI/fullscreen session setup (also visited during shutdown) |
| `MP` | Feature-flag checker |
| `iD` | PLi enabled-flag checker |
| `tXr` | Session context accessor |
| `Vne` | Fullscreen/layout helper |
| `eXr` | Boolean flag resolver for fullscreen |
| `kr` | O8 option reader |
| `c4d` | Configuration applier |
| `it` | Render state tracker |
| `fwt` | Post-shutdown finalizer utility |
| `qe` | $Xe event emitter helper |
| `$Xe` | Low-level event-bus primitive |
| `Ar` | Non-conforming session reporter |
| `Ig` | $Xe event-bus accessor |
| `n8e` | Final async cleanup step before process.exit |
| `t5n` | Sub-utility of final cleanup |
| `p` | Forced-exit invoker (calls `process.exit` / `u.abort`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.