---
type: feature-spec
feature: "exit"
cc_version: "2.1.183"
updated: "2026-06-19"
tags: ["exit", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.183 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/exit`

> Analysis basis: CC v2.1.183 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.183

---

## Overview

The `/exit` command (aliased as `/quit`) initiates an orderly shutdown of the Claude Code CLI session. When invoked, it displays a farewell message, fires a `prompt_input_exit` telemetry event, tears down the active UI rendering layer, drains pending I/O, terminates any background/daemon processes, and finally calls `process.exit` to terminate the Node.js process.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `exit` |
| description | `null` |
| aliases | `["quit"]` |
| immediate | `true` |
| module_id | `bLl` |
| load_inline | `true` |
| loc_byte | `12917946` |
| loc_byte_end | `12918142` |
| loc_line | `8547` |
| arbor_handler.name | `Mcf` |
| arbor_handler.fqn | `claude-2.1.183::Mcf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.183 bundle.js:+12917946

---

## Input Branching

The `/exit` command has no user-supplied arguments; execution follows a fixed linear sequence with two notable internal branch points (background-session detach path vs. direct teardown, and a timed drain vs. forced kill). Three or more distinct paths exist inside the shutdown orchestration function (`Oi`), so a flowchart is used.

```mermaid
flowchart TD
    A(["/exit or /quit invoked"]) --> B[Display 'Goodbye!' message\nbundle.js:+12917159]
    B --> C[Emit prompt_input_exit telemetry\nbundle.js:+12917383]
    C --> D{Background / daemon\nsession active?}
    D -- Yes --> E[Send detach-request via IPC\nbundle.js:+11259680]
    E --> F[Wait for daemon ACK\nor timeout]
    F --> G[Proceed to UI teardown]
    D -- No --> G
    G --> H[Unmount Ink/JSX render tree\nbundle.js:+7193741]
    H --> I[Write terminal escape sequences\nbundle.js:+3886257]
    I --> J[Drain stdout buffer\nbundle.js:+69581]
    J --> K{Drain completes\nwithin timeout?\n5000 ms / 3500 ms\nbundle.js:+7196081]
    K -- Yes --> L[Flush session-end event\nbundle.js:+7196478]
    K -- No (timeout) --> M[Force abort AbortSignal\nbundle.js:+7196366]
    M --> L
    L --> N[Await Promise.allSettled on\npending cleanup tasks\nbundle.js:+13551802]
    N --> O[call process.exit\nbundle.js:+17308205]
    O --> Z([Process terminated])
```

---

## Behavioral Spec

### 1. Handler Entry Point (`Mcf`)

The Arbor-resolved handler is `Mcf` (an `AsyncFunction`), reached via `module_id` resolution from module `bLl`.

```
async function exitCommandHandler(context):
    // 1. Render farewell text "Goodbye!" to the active output stream
    displayFarewellMessage("Goodbye!")                  // bundle.js:+12917159

    // 2. Emit exit telemetry
    emitTelemetry("prompt_input_exit")                  // bundle.js:+12917383

    // 3. Check for active background/daemon session
    if hasDaemonSession():
        sendIpcMessage("detach-request")                // bundle.js:+11259680
        await waitForDaemonAck()

    // 4. Render a JSX element (final UI frame) via createElement
    renderFinalFrame()                                  // bundle.js:+12917272

    // 5. Delegate full shutdown to orchestrator
    await shutdownOrchestrator()                        // Oi, bundle.js:+12917378
```

Analysis basis: CC v2.1.183 bundle.js:+12917195–12917378

---

### 2. Farewell Message Display (`Hi` → `uNe`)

```
function displayFarewellMessage(text):
    // Writes the literal string "Goodbye!" to the terminal output
    writeToOutput(text)                                 // bundle.js:+12917195
    flushOutput()                                       // bundle.js:+2303034
```

The string constant `"Goodbye!"` is embedded at bundle.js:+12917159.

Analysis basis: CC v2.1.183 bundle.js:+12917195

---

### 3. Randomised Pre-Exit Delay (`e`)

```
function randomisedDelay():
    // Introduces a small stochastic delay before teardown begins.
    // Uses Math.random() scaled by constants 2 and 1
    // then schedules via setTimeout
    delay = Math.floor(Math.random() * 2) + 1           // bundle.js:+14290349
    setTimeout(proceedWithShutdown, delay)              // bundle.js:+14290388
```

Analysis basis: CC v2.1.183 bundle.js:+14290349

---

### 4. Daemon / Background Session Detach (`KHe`)

```
function sendDetachRequest(sessionHandle):
    // Looks up the daemon node descriptor
    daemonNode = lookupDaemonNode()                     // ndn, bundle.js:+11259643
    // Serialises and writes the IPC shutdown frame
    ipcFrame = serialiseFrame("detach-request")         // bundle.js:+11259680
    writeIpcStream(ipcFrame)                            // G6 → sne.write, bundle.js:+10754897
    // Awaits the acknowledgement or times out
    awaitAck()                                          // aue, bundle.js:+11259756
```

The string constant `"detach-request"` is embedded at bundle.js:+11259680.

Analysis basis: CC v2.1.183 bundle.js:+11259643

---

### 5. Shutdown Orchestrator (`Oi`)

This is the central async shutdown pipeline. It coordinates UI teardown, I/O draining, task cleanup, and final process termination.

```
async function shutdownOrchestrator():
    // Step A: Unmount the Ink/JSX rendering layer
    inkInstance = getInkInstance()                      // Gu.get, bundle.js:+7193690
    inkInstance.unmount()                               // bundle.js:+7193741

    // Step B: Write terminal save/restore escape sequences
    //         ESC-7 (save cursor) and ESC-8 (restore cursor)
    writeTerminalEscape("\x1b7")                        // bundle.js:+3886257
    writeTerminalEscape("\x1b8")                        // bundle.js:+3886268

    // Step C: Print the session summary/scroll report
    printSessionSummary()                               // aJr, bundle.js:+7196058

    // Step D: Drain the stdout buffer with a race against timeout
    drainTimeout = Math.max(5000, 3500)                 // bundle.js:+7196081
    result = await Promise.race([
        drainStdout(),                                  // XWe → B2o.drain, bundle.js:+69581
        timedAbort(drainTimeout)
    ])

    // Step E: Wait up to 2000 ms for any remaining cleanup
    await setTimeout(2000)                              // bundle.js:+7196266

    // Step F: Cancel any pending AbortSignal
    abortController.abort()                             // bundle.js:+7196366 (AbortSignal.timeout)

    // Step G: Flush the cache-eviction hint (telemetry)
    emitTelemetry("tengu_cache_eviction_hint")          // bundle.js:+7196440

    // Step H: Flush session_end event
    emitTelemetry("session_end")                        // bundle.js:+7196478

    // Step I: Await Promise.allSettled on remaining tasks
    await Promise.allSettled(pendingTasks)              // kca, bundle.js:+13551802

    // Step J: Remove unref'd timer
    clearTimeout(drainTimer)                            // bundle.js:+7196278

    // Step K: Write final sync byte to output
    nge.writeSync(finalByte)                            // bundle.js:+7196552

    // Step L: Terminate process
    process.exit(0)                                     // bundle.js:+17308205
```

Timeouts in use:
- Drain race timeout: `Math.max(5000, 3500)` ms → **5000 ms** (bundle.js:+7196081)
- Post-drain grace period: **2000 ms** (bundle.js:+7196266)

Analysis basis: CC v2.1.183 bundle.js:+7195984

---

### 6. Session Summary Printer (`aJr`)

```
function printSessionSummary(context):
    // Resolves the working directory path
    cwd = resolveCwd()                                  // yNt → r.statSync, bundle.js:+13451700

    // Produces a formatted summary line, escaping backslashes and quotes
    summary = formatSummaryLine(context)                // bundle.js:+7194021 (t.replaceAll)

    // Writes summary in dim style to the output stream
    nge.writeSync(summary)                              // bundle.js:+7194120
    writeStyledOutput(summary, style="dim")             // Ht.dim, bundle.js:+7194136

    // Emits scroll-summary telemetry
    emitTelemetry("tengu_scroll_summary")               // bundle.js:+7195497
```

String escape constants: `"\\\\"` at bundle.js:+7194039, `"\\\""` at bundle.js:+7194062.

Analysis basis: CC v2.1.183 bundle.js:+7193951

---

### 7. Forced Kill Escalation (`lJr`)

If the graceful drain race does not resolve in time, this path executes:

```
function forcedKillHandler():
    clearTimeout(drainTimer)                            // bundle.js:+7194247
    pid = getActivePid()                                // Gu.get, bundle.js:+7194280
    try:
        process.kill(pid, "SIGTERM")                    // bundle.js:+7194353
    catch error:
        // Throw an Error("unreachable") if the kill fails unexpectedly
        throw new Error("unreachable")                  // bundle.js:+7194395
    process.exit()                                      // bundle.js:+7194328
```

The string `"forced shutdown"` appears as the label for this path (bundle.js:+17308186). The process also calls `u.abort()` to cancel any pending AbortController (bundle.js:+17308226).

Analysis basis: CC v2.1.183 bundle.js:+7194247

---

### 8. Background-Task / Scheduled-Task Cleanup (`sjn`, `XGp`)

Before process exit, any active scheduled tasks are gracefully wound down:

```
function cleanupScheduledTasks(tasks):
    for task in tasks:
        // Compute remaining delay using Math.max and Date.now
        remaining = Math.max(0, task.nextRun - Date.now())  // bundle.js:+11252891
        if remaining == 0:
            // Task is overdue; retire immediately
            task.retireIfSettled()
        else:
            // Push to pending queue for Promise.allSettled
            pendingQueue.push(task)                          // bundle.js:+11252672
    // Format human-readable countdown (e.g., "Every minute", "Every hour")
    formatCountdown(remaining)                               // AP, bundle.js:+11252799
```

String constants for display: `"Every minute"` (bundle.js:+4903417), `"Every hour"` (bundle.js:+4903634), `"scheduled task"` (bundle.js:+11252686).

Analysis basis: CC v2.1.183 bundle.js:+11252667

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `prompt_input_exit` | Fired immediately when `/exit` is invoked (bundle.js:+12917383) |
| Telemetry: `tengu_scroll_summary` | Fired during session summary printing in `aJr` (bundle.js:+7195497) |
| Telemetry: `tengu_cache_eviction_hint` | Fired during shutdown orchestration (bundle.js:+7196440) |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Fired if daemon background dispatch escalates to SIGKILL (bundle.js:+17275023) |
| Telemetry: `tengu_bg_dispatch_low_mem` | Fired when background session detects low memory (bundle.js:+17275624) |
| Telemetry: `tengu_bg_spare_enable` | Fired when a spare background session slot is enabled (bundle.js:+17276321) |
| Telemetry: `tengu_bg_spare_claim` | Fired when a spare slot is successfully claimed (bundle.js:+17276449) |
| Telemetry: `tengu_bg_spare_claim_fail` | Fired when claiming a spare slot fails (bundle.js:+17276715) |
| Telemetry: `tengu_daemon_config_reload` | Fired on daemon config reload during shutdown (bundle.js:+17290894) |
| Telemetry: `tengu_startup_perf` | Fired as part of startup profiling flush on exit (bundle.js:+225615) |
| Telemetry: `tengu_amber_creek` | Fired by the display/fullscreen subsystem on shutdown (bundle.js:+3545528) |
| Telemetry: `tengu_pewter_brook` | Fired by the display/fullscreen subsystem on shutdown (bundle.js:+3545436) |
| Telemetry: `session_end` | Flushed as a final event before `process.exit` (bundle.js:+7196478) |
| IPC message | `"detach-request"` sent over the daemon IPC stream when a background session is active (bundle.js:+11259680) |
| Terminal escape sequences | ANSI save-cursor `\x1b7` and restore-cursor `\x1b8` written to stdout (bundle.js:+3886257, +3886268) |
| Ink UI unmount | `inkInstance.unmount()` called to teardown the JSX render tree (bundle.js:+7193741) |
| stdout drain | `B2o.drain()` called; race against 5000 ms timeout (bundle.js:+69581, +7196081) |
| `process.exit` | Called unconditionally at the end of the shutdown orchestrator (bundle.js:+17308205) |
| `process.kill` | Called with SIGTERM as a fallback in the forced-kill path (bundle.js:+7194353) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | Session state is cleared; active tasks are retired via `retireIfSettled()` (bundle.js:+17275749) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.183 | Initial analysis |

---

## Common Mistakes

1. **Typing `/exit` during an active agent turn** — because `immediate: true` is set, the command fires without waiting for the agent to finish. Any in-flight API call will be aborted via the AbortController path (bundle.js:+17308226).
2. **Assuming instant termination** — the orchestrator waits up to **5000 ms** for stdout to drain and an additional **2000 ms** grace period before calling `process.exit`. Scripts that watch for prompt return may time out prematurely.
3. **Not distinguishing `/exit` from a SIGINT** — `/exit` goes through the full graceful shutdown path including telemetry flushing and background-session detach; a raw Ctrl-C does not necessarily follow the same code path.
4. **Expecting `/quit` to behave differently** — `quit` is registered as a pure alias; it is identical to `exit` in every respect (bundle.js:+12917946).
5. **Relying on the farewell message appearing in CI/non-TTY output** — the `"Goodbye!"` string is written through the terminal output layer (`nge.writeSync`), which may be suppressed in non-interactive environments.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Mcf` | Exit command handler (AsyncFunction); main entry point resolved via module_id `bLl` |
| `Hi` | Farewell message writer; outputs "Goodbye!" to terminal |
| `uNe` | Low-level output flush helper called by farewell writer |
| `e` | Randomised pre-exit delay generator (Math.random + setTimeout) |
| `KHe` | Daemon/background-session detach coordinator |
| `ndn` | Daemon node descriptor lookup |
| `bsl` | IPC frame builder for detach-request |
| `r6n` | IPC stream write helper (depth-1 call from bsl) |
| `Tn` | Task/session state object (used in multiple shutdown paths) |
| `G6` | IPC stream write dispatcher (calls sne.write) |
| `Pe` | JSON serialiser wrapper (calls JSON.stringify) |
| `aue` | Daemon acknowledgement awaiter |
| `iA` | Intermediate state transition helper in handler |
| `sjn` | Scheduled-task cleanup coordinator |
| `j0` | Task queue accessor (calls gx) |
| `gx` | Global application state / store accessor |
| `XGp` | Scheduled-task delay calculator (Math.max, Date.now) |
| `AP` | Task countdown formatter ("Every minute", "Every hour", cron parsing) |
| `o` | Column padding helper for task display (s.map, i.padEnd) |
| `f` | Background session process manager (M.kill, zq.spawn, WNo.freemem, etc.) |
| `s` | Async-task tracking set (r.add, i.finally, r.delete) |
| `m` | Background session kill helper (n.values, k.kill) |
| `p` | Forced shutdown initiator (process.exit, u.abort, WT) |
| `l` | Locale/schedule string matcher (k0l) |
| `A` | UTC date arithmetic helper (getUTCDay, setUTCDate, etc.) |
| `J1` | Cron expression parser (e.trim, Bbd) |
| `Bbd` | Cron field tokeniser (e.split, s.match, parseInt, o.add, Array.from) |
| `n` | String normaliser (i.toLowerCase) |
| `Ltt` | Time-of-day / day-of-week schedule resolver (c.setSeconds, c.setMinutes, etc.) |
| `t` | Date object used in schedule resolution |
| `c` | Mutable Date copy used in schedule resolution |
| `i` | I/O stream close helper (n.close, r.close) |
| `r` | Data-event emitter wrapper (Fs) |
| `ea` | Duration formatter (Math.floor, Math.round) |
| `Va` | String width–aware substring helper (e.indexOf, e.substring, tn, Qs) |
| `tn` | Unicode grapheme width measurer (Bun.stringWidth) |
| `Qs` | Visual string truncator (tn, Ky) |
| `Ky` | Fallback string length helper |
| `Dcf` | Final-frame JSX component builder (calls Gk) |
| `Oi` | Shutdown orchestrator (main async pipeline: unmount, drain, exit) |
| `k3e` | Ink instance teardown helper (nge.writeSync, Gu.get, e.unmount, fF, MEn) |
| `fF` | Post-unmount flush helper |
| `MEn` | Terminal escape sequence emitter (OZ.writeSync, o$e, JFe, EL, Gp, T) |
| `o$e` | Terminal capability detector (b_, YEi.coerce, Sk; detects ghostty, iTerm.app) |
| `JFe` | Terminal state restore helper |
| `EL` | Multiplexer escape sequence builder (tmux/screen escape replacement) |
| `Gp` | Terminal write helper |
| `T` | Styled text formatter (vPe, QHc, Pe, Kc, $O, Hqe, n_c) |
| `aJr` | Session summary printer (zw, E9, Lt, yNt, mh, nge.writeSync, Ht.dim) |
| `zw` | Session state accessor |
| `E9` | Session metadata extractor |
| `Lt` | Path/file resolver helper (gx) |
| `yNt` | Working directory resolver (p2, Hg, Ar, zh.join, jt, r.statSync) |
| `p2` | Primary path resolver (gx) |
| `Ar` | Alternate path resolver (gx) |
| `jt` | File existence check helper |
| `mh` | Session mount-point resolver (Lt, Au) |
| `Au` | Auth/config path resolver (qi) |
| `yca` | Summary line formatter |
| `lJr` | Forced-kill handler (clearTimeout, Gu.get, process.exit, process.kill, Error) |
| `XWe` | stdout drain wrapper (B2o.drain) |
| `d` | Supervisor / daemon-config manager (Aje, r.write, qDl, i.get, y.stop, i.delete, E.stop, etc.) |
| `Aje` | File stat checker for daemon socket (WDl.stat, dn, ci, Swo, Ee, Fa, Ewo) |
| `dn` | Logger/debug helper |
| `ci` | AsyncLocalStorage context reader (L0u.getStore) |
| `Swo` | Daemon socket path resolver (Ewo) |
| `Ee` | String coercion helper (String) |
| `qDl` | Config diff/summary builder (Object.keys, Math.max, ay) |
| `y` | MCP server instance (l1t, xht) |
| `l1t` | MCP transport layer reference |
| `xht` | MCP connection state machine (pcc) |
| `E` | MCP server stop/start controller (_, Math.max, Math.min) |
| `_` | MCP server lifecycle manager (xht, GF, vP, Promise.all, eY, ZB, De, Ho) |
| `Puc` | Daemon heartbeat scheduler (zse) |
| `zse` | Heartbeat tick helper |
| `I` | Input handler / cursor manager (Math.max, Math.floor, k.preventDefault, E) |
| `k` | Keyboard event dispatcher (Uuc, Gp, T, De, j6f, d.write) |
| `j` | Generic promise/deferred helper |
| `kca` | Pending-task collector for Promise.allSettled (Array.from) |
| `C_t` | Startup performance reporter (bsr, O9o) |
| `bsr` | Performance mark recorder (B9o, j) |
| `B9o` | Performance metrics aggregator (v9, r.set/get, Object.entries, Math.round, etc.) |
| `O9o` | Startup profiling report writer (F9o, b_t.dirname, jt, _Ee, D9o, v9, $9o, JSON.stringify, B9o) |
| `F9o` | Profiling report file path builder (b_t.join, tr, Lt) |
| `_Ee` | Atomic file writer (Qde.openSync, writeFileSync, fsyncSync, closeSync) |
| `D9o` | Profiling checkpoint serialiser (v9, n.push, t.entries, SYt, t.at, wJ, n.join) |
| `v9` | Node.js `perf_hooks` module loader (require) |
| `$9o` | Secondary profiling output path builder (b_t.join, tr, Lt) |
| `dDn` | Post-exit cleanup dispatcher (zw, _ca, j, Hca, Os) |
| `_ca` | Cleanup state flag accessor |
| `Hca` | Session duration calculator (Date.now, Math.max, Math.round, Object.assign, hca) |
| `hca` | Duration sub-calculator |
| `Os` | Display/fullscreen mode manager (L2, tM, PFr, _Z, T, RFr, Gr, ved, ct) |
| `L2` | Terminal capability flag checker (zqc.has) |
| `tM` | Animation enabled checker (Ani.isEnabled) |
| `PFr` | Fullscreen mode enabler (st) |
| `_Z` | Fullscreen mode disabler (Ced) |
| `RFr` | Fullscreen mode flag checker (zt, Boolean) |
| `Gr` | Render mode resolver (_j) |
| `ved` | Display event emitter (ct) |
| `ct` | Core display/render context (wxt, Lxt, I4, pIe.has, OHn, Cxt.add, u8.has/get, Ct) |
| `Dgt` | Post-shutdown diagnostic helper |
| `Qe` | Event emitter wrapper (ogt) |
| `ogt` | Raw event bus |
| `Ur` | Non-conforming terminal handler (ey, Qe) |
| `ey` | Non-conforming event emitter (ogt) |
| `M3e` | Final async resolver (Promise.resolve, cDn, e) |
| `cDn` | Cleanup continuation helper |