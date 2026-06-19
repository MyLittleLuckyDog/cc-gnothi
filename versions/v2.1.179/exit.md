---
type: feature-spec
feature: "exit"
cc_version: "2.1.179"
updated: "2026-06-19"
tags: ["exit", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.179 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/exit`

> Analysis basis: CC v2.1.179 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.179

---

## Overview

The `/exit` command (aliased as `/quit`) terminates the Claude Code CLI session. It triggers a graceful shutdown sequence that drains pending I/O, tears down background workers and MCP connections, flushes telemetry, and finally calls `process.exit`. A "Goodbye!" message is displayed to the user before the process terminates.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `exit` |
| description | `null` |
| aliases | `["quit"]` |
| immediate | `true` |
| module_id | `G0K` |
| load_inline | `true` |
| loc_byte | `13073291` |
| loc_byte_end | `13073487` |
| loc_line | `9033` |
| arbor_handler.name | `OK5` |
| arbor_handler.fqn | `claude-2.1.179::OK5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.179 bundle.js:+13073291

---

## Input Branching

The exit flow has more than three distinct phases (pre-exit display, background-session teardown, terminal restoration, graceful drain with timeout, forced kill fallback). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/exit or /quit invoked"]) --> B[Display 'Goodbye!' message\n+ render farewell JSX component]
    B --> C[Emit prompt_input_exit telemetry\n+ emit session_end event]
    C --> D{Background / daemon\nsessions active?}
    D -- Yes --> E[Send detach-request to each\nbackground session via IPC write]
    D -- No --> F
    E --> F[Unmount Ink UI / restore terminal\nstate via escape sequences]
    F --> G[Drain stdout / stderr\nvia qdH drain helper]
    G --> H[Race: graceful shutdown vs.\nMath.max(5000, 3500) ms timeout]
    H -- Graceful completes --> I[Flush startup-perf / telemetry\nvia Yz6 → rbA → BYH]
    H -- Timeout fires --> J[clearTimeout, force-kill\nstraggler processes\nSIGTERM → SIGKILL escalation]
    I --> K[allSettled on pending\nasync tasks via a9q]
    J --> K
    K --> L[AbortSignal.timeout fence\n+ nonconforming session cleanup]
    L --> M[process.exit called via So_\nor Y → forced shutdown path]
    M --> N([Process terminated])
```

---

## Behavioral Spec

### 1. Handler Entry — `exitCommandHandler` (`OK5`)

The Arbor-resolved handler `OK5` is an `AsyncFunction` reached via `module_id` → `G0K`.

```
async function exitCommandHandler(context):
    # Step 1 — Acknowledge the user
    display literal "Goodbye!" string to terminal
    render farewell JSX element via yPA.createElement
    
    # Step 2 — Telemetry & session bookkeeping
    emit telemetry event "prompt_input_exit"      # loc_byte 13072728
    emit session_end marker                        # loc_byte 7195895
    call sessionEndHelper(context)                 # q3, loc_byte 13072573

    # Step 3 — Background / daemon session teardown
    call backgroundSessionTeardown(context)        # jzH, loc_byte 13072556

    # Step 4 — Terminal restoration
    call terminalRestoreAndUnmount(context)        # $K5 → xE, loc_byte 13072710

    # Step 5 — Graceful shutdown sequence
    await gracefulShutdown(context)                # S9, loc_byte 13072723

    # Step 6 — Scheduled-task / LF8 path
    call scheduledTaskFlush(context)               # LF8, loc_byte 13072587
```

Analysis basis: CC v2.1.179 bundle.js:+13072540

---

### 2. Background Session Teardown — `backgroundSessionTeardown` (`jzH`)

```
function backgroundSessionTeardown(context):
    sessions = getActiveSessions()           # h48, loc_byte 11398805
    for each session in sessions:
        config = resolveSessionConfig(session)   # DAK → Qp8, loc_byte 11392926
        write IPC message "detach-request"       # DB → x6H.write, loc_byte 10710446
                                                 # literal "detach-request", loc_byte 11398842
        serialize payload via JSON.stringify     # bH, loc_byte 190917
    notifyV4HCleanup()                           # V4H, loc_byte 11398918
```

Analysis basis: CC v2.1.179 bundle.js:+11398805

---

### 3. Scheduled-Task Flush — `scheduledTaskFlush` (`LF8`)

```
function scheduledTaskFlush(context):
    drain = getActiveDrainQueue()            # uZ → OT, loc_byte 11391829
    push current task to queue               # H.push, loc_byte 11391834
    
    # Compute next scheduled-task window
    scheduleInfo = computeScheduleWindow()   # ABL, loc_byte 11391875
        # ABL sub-steps:
        #   parse cron-like expression       (Hh, loc_byte 4949157)
        #     - "Every minute" label         (literal, loc_byte 4949277)
        #     - "Every hour" label           (literal, loc_byte 4949494)
        #     - field count limit: 5         (literal, loc_byte 4949193)
        #     - field parse limit: 10        (literal, loc_byte 4949347)
        #   parse day-of-week tokens         (dy → AD7, loc_byte 4948072)
        #   compute next fire time           (FH6, loc_byte 11391994)
        #     - uses Date arithmetic on month/day/hour/minute
        #   compute human-readable delay     (i9 → Math.floor/round, loc_byte 217607)
    truncate output line                     # cq → substring/indexOf, loc_byte 216460
```

Analysis basis: CC v2.1.179 bundle.js:+11391829

---

### 4. Terminal Restoration — `terminalRestoreAndUnmount` (`$K5` → `xE`)

```
function terminalRestoreAndUnmount(context):
    call xE()                                # loc_byte 13072495
    # xE performs:
    #   write ANSI save-cursor escape \x1b7  (literal, loc_byte 3930024)
    #   write ANSI restore-cursor \x1b8      (literal, loc_byte 3930035)
    #   detect terminal type:
    #     - "ghostty" >= "1.2.0"             (literals, loc_byte 3655446/3655476)
    #     - "iTerm.app" >= "3.6.6"           (literals, loc_byte 3655515/3655547)
    #   handle tmux multiplexer:
    #     - detect "tmux" in env             (literal, loc_byte 3578356)
    #     - replace \x1b\x1b sequences       (literal, loc_byte 3578402)
    #     - detect "screen" multiplexer      (literal, loc_byte 3578429)
    #   unmount Ink UI instance              (FxH → H.unmount, loc_byte 7193158)
    #   write terminal cleanup via we.writeSync (xY8, loc_byte 3929870)
    #   write startup-perf path info         (Io_, loc_byte 7193399)
    #       dim styling via J6.dim           (loc_byte 7193553)
```

Analysis basis: CC v2.1.179 bundle.js:+13072495

---

### 5. Graceful Shutdown Sequence — `gracefulShutdown` (`S9`)

```
async function gracefulShutdown(context):
    # Phase A: pre-exit I/O flush
    await drainOutputBuffers()               # qdH → oSA.drain, loc_byte 66420

    # Phase B: race graceful vs. timeout
    timeout_ms = Math.max(5000, 3500)        # literals loc_byte 7195498/7195505
    result = await Promise.race([
        performGracefulExit(),               # FxH path
        sleep(timeout_ms)
    ])
    timerRef.unref()                         # MGH.unref, loc_byte 7195514

    # Phase C: MCP server teardown
    mcpConnections = getMCPSessions()        # w path
    for each conn in mcpConnections:
        conn.stop()                          # T.stop, loc_byte 17082676
        conn.updateConfig / conn.start       # for reconnectable sessions
    supervisorTag = "supervisor"             # literal, loc_byte 17082408

    # Phase D: allSettled pending tasks
    await allSettled(pendingTasks)           # a9q → Promise.allSettled, loc_byte 13710648

    # Phase E: AbortSignal fence
    signal = AbortSignal.timeout(2000)       # literal 2000, loc_byte 7195683
                                             # loc_byte 7195783
    await drainWithAbort(signal)             # Yz6 path → startup perf flush

    # Phase F: cache eviction hint
    emit telemetry "tengu_cache_eviction_hint"  # loc_byte 7195857

    # Phase G: session_end marker + nonconforming cleanup
    finalizeNonconformingSessions()          # a_ → Xj + "nonconforming" literal
                                             # loc_byte 2290279

    # Phase H: write final byte to stdout
    J$H.writeSync(...)                       # loc_byte 7195969
```

Analysis basis: CC v2.1.179 bundle.js:+7195401

---

### 6. Forced-Kill Fallback — `forceKillFallback` (`So_`)

```
function forceKillFallback(timerRef):
    clearTimeout(timerRef)                   # loc_byte 7193664
    childProcs = getChildProcessMap()        # Uf.get, loc_byte 7193697
    for each child in childProcs:
        try:
            process.kill(child.pid, SIGTERM) # loc_byte 7193770
        catch err:
            throw Error("unreachable")       # literal "unreachable", loc_byte 7193818
    process.exit()                           # loc_byte 7193745
```

Analysis basis: CC v2.1.179 bundle.js:+7193664

---

### 7. Process-Level Exit — `processExit` (`Y`)

```
function processExit(reason):
    emitAbort()                              # z.abort, loc_byte 17101738
    sendNXSignal()                           # NX, loc_byte 17101695
    log literal "forced shutdown"            # loc_byte 17101698
    process.exit()                           # loc_byte 17101717
```

Analysis basis: CC v2.1.179 bundle.js:+17101695

---

### 8. Startup Perf Flush (on exit) — `startupPerfFlush` (`Yz6` → `rbA`)

```
function startupPerfFlush():
    require("perf_hooks")                    # Lm → require, loc_byte 220886
                                             # literal "perf_hooks", loc_byte 220894
    if not profilingEnabled:
        log "Startup profiling not enabled"  # literal, loc_byte 221606
        return
    checkpoints = getCheckpoints()           # cbA, loc_byte 222239
    if checkpoints.empty:
        log "No profiling checkpoints recorded"  # literal, loc_byte 221696
        return
    report = buildPerfReport()               # width 80, loc_byte 221759
                                             # header "STARTUP PROFILING REPORT", loc_byte 221771
    writePerfFile(path, report, "utf8")      # BYH → L7H.openSync/writeFileSync/fsyncSync/closeSync
                                             # loc_byte 191462
    flush telemetry event "tengu_startup_perf"  # loc_byte 223786
    mark "main_after_run"                    # literal, loc_byte 222835
```

Analysis basis: CC v2.1.179 bundle.js:+222100

---

### 9. Random Farewell Delay — `randomFarewellDelay` (`H`)

```
function randomFarewellDelay():
    r = Math.random() * 2 + 1               # literals 2 (loc_byte 14230695), 1 (loc_byte 14230711)
    setTimeout(callback, r)                  # loc_byte 14230734
```

Analysis basis: CC v2.1.179 bundle.js:+14230697

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_cache_eviction_hint` | Emitted during graceful shutdown fence (bundle.js:+7195857) |
| Telemetry — `tengu_startup_perf` | Emitted when startup profiling was active, on flush at exit (bundle.js:+223786) |
| Telemetry — `tengu_scroll_summary` | Emitted from `aZ8` scroll-summary path during shutdown (bundle.js:+7194914) |
| Telemetry — `tengu_amber_creek` | Emitted from fullscreen/render path `m1` (bundle.js:+3587656) |
| Telemetry — `tengu_pewter_brook` | Emitted from fullscreen/render path `m1` (bundle.js:+3587564) |
| Telemetry — `tengu_daemon_config_reload` | Emitted from daemon supervisor path `w` (bundle.js:+17083201) |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Emitted if background process requires SIGKILL escalation (bundle.js:+17067302) |
| Telemetry — `tengu_bg_dispatch_low_mem` | Emitted if low-memory condition detected in background dispatch (bundle.js:+17067903) |
| Telemetry — `tengu_bg_spare_enable` | Emitted when spare background session pool is enabled (bundle.js:+17068607) |
| Telemetry — `tengu_bg_spare_claim` | Emitted when a spare session is successfully claimed (bundle.js:+17068735) |
| Telemetry — `tengu_bg_spare_claim_fail` | Emitted when spare session claim fails (bundle.js:+17069001) |
| Literal event `prompt_input_exit` | Recorded at exit-command invocation (bundle.js:+13072728) |
| Literal event `session_end` | Recorded as final session marker (bundle.js:+7195895) |
| IPC write `detach-request` | Written to each active background/daemon session socket (bundle.js:+11398842) |
| Terminal state | ANSI save/restore cursor sequences emitted; Ink UI unmounted (bundle.js:+3930024/3930035) |
| Child process signals | SIGTERM issued to child processes; SIGKILL escalation if needed (bundle.js:+17069257/17067350) |
| Startup perf file | If profiling active, written synchronously via `fsyncSync` before exit (bundle.js:+191528) |
| `process.exit` | Called unconditionally at the end of `So_` or `Y` path (bundle.js:+7193745/17101717) |
| Timeout constants | Graceful shutdown window: `Math.max(5000, 3500)` ms (bundle.js:+7195498/7195505); AbortSignal fence: 2000 ms (bundle.js:+7195683) |
| Fullscreen disabled warnings | Logged for `tmux -CC` (iTerm2 integration) and Windows/SSH (ConPTY) environments (bundle.js:+3587139/3587325) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.179 | Initial analysis |

---

## Common Mistakes

1. **Assuming `/exit` is synchronous.** The handler is an `AsyncFunction` (`OK5`). It performs async I/O drain and `Promise.race` before calling `process.exit`, so any code scheduled immediately after the command dispatch may not run.
2. **Ignoring the `/quit` alias.** The registration lists `aliases: ["quit"]`; both names trigger the same handler. Do not special-case one without the other.
3. **Expecting `description` to appear in the slash-command picker.** The `description` field is `null` — the command has no help text in the picker UI (bundle.js:+13073291).
4. **Assuming background sessions are killed immediately.** The teardown sends a `"detach-request"` IPC message and waits; it does not send SIGKILL directly unless the graceful timeout (`Math.max(5000, 3500)` ms) expires.
5. **Overlooking the startup-perf file write on exit.** If startup profiling was enabled, a synchronous `fsyncSync` call is made during the exit path, which can add latency before the process terminates (bundle.js:+191528).
6. **Expecting telemetry to be sent after `process.exit`.** All telemetry events (`tengu_cache_eviction_hint`, `tengu_startup_perf`, etc.) must complete within the graceful-shutdown race window, or they are dropped.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `OK5` | Main exit command handler (`AsyncFunction`; Arbor FQN `claude-2.1.179::OK5`) |
| `V9` | Session / process context resolver called at handler entry |
| `XyH` | Sub-helper reached from context resolver |
| `H` | Random farewell delay utility (uses `Math.random` + `setTimeout`) |
| `jzH` | Background session teardown orchestrator |
| `h48` | Active background session enumeration helper |
| `DAK` | Background session config resolver |
| `Qp8` | Config accessor sub-helper within `DAK` |
| `y8` | Session state helper used in config resolution |
| `DB` | IPC write wrapper for background session messages |
| `bH` | JSON serialization helper (delegates to `JSON.stringify`) |
| `V4H` | Post-detach cleanup notifier |
| `q3` | Session-end bookkeeping helper |
| `LF8` | Scheduled-task drain and flush helper |
| `uZ` | Active drain-queue accessor |
| `OT` | Low-level queue/async primitive |
| `ABL` | Schedule-window computation orchestrator |
| `Hh` | Cron-expression parser (parses fields, "Every minute"/"Every hour" labels) |
| `K` | Cron field padding/mapping helper |
| `D` | Background process lifecycle manager (spawn, kill, retire) |
| `f` | Pending-task tracking set (add/delete/finally) |
| `j` | Child process kill helper (iterates values, sends SIGTERM) |
| `Y` | Forced `process.exit` wrapper with abort + NX signal |
| `$` | Cron match helper (`yTK` sub-call) |
| `J` | Date arithmetic helper (UTC day/date/hour manipulation) |
| `dy` | Day-of-week token parser |
| `AD7` | Cron field tokenizer (split, match, parseInt, Set.add) |
| `A` | Lowercase string normalizer / push accumulator |
| `FH6` | Next-fire-time date calculator (month/day/hour/minute arithmetic) |
| `O` | Scheduled-task date object wrapper |
| `L` | Connection/session handle (close, finally, has) |
| `q` | Data-channel / IPC primitive |
| `i9` | Human-readable duration formatter (Math.floor + Math.round) |
| `cq` | Terminal line truncation helper (indexOf + substring) |
| `f8` | String width measurer (delegates to `Bun.stringWidth`) |
| `D9` | Display width helper (uses `f8` and `hY`) |
| `hY` | Grapheme/display sub-helper |
| `$K5` | Terminal restore + Ink unmount coordinator |
| `S9` | Graceful shutdown sequence (main async body) |
| `FxH` | Ink unmount and terminal write helper |
| `qR` | Post-unmount cleanup callback |
| `xY8` | Terminal ANSI escape writer (save/restore cursor) |
| `zRH` | Terminal type detector (ghostty, iTerm.app version checks) |
| `qRH` | Terminal reset sub-helper |
| `_G` | tmux/screen escape-sequence adapter |
| `mL` | Miscellaneous terminal mode utility |
| `N` | Log / debug output formatter |
| `Io_` | Startup-perf path info printer (writes dim text) |
| `b0` | Async context or store accessor |
| `Hm` | Helper within startup-perf printer |
| `I6` | Async store / context helper |
| `zy6` | Working-directory stat helper (statSync) |
| `sC` | Async primitive (uses `OT`) |
| `G_` | Async primitive variant |
| `c6` | File-system utility sub-helper |
| `q$` | Startup-perf path resolver |
| `Pf` | Path normalization helper (`U9`) |
| `B9q` | String escape helper (`\\`, `\"` literals) |
| `So_` | Forced-kill fallback (clearTimeout, Uf.get, process.exit, process.kill, Error) |
| `qdH` | Output-drain helper (delegates to `oSA.drain`) |
| `w` | MCP/supervisor session manager (stop, updateConfig, start, delete) |
| `bVH` | File-stat and session validation helper (stat, isFile, 1 MB size limit) |
| `G8` | General-purpose async helper |
| `H9` | Async store accessor (`YWf.getStore`) |
| `OWA` | Session ownership validator (`$WA`) |
| `GH` | String coercion helper |
| `AVK` | MCP key/width layout formatter (Object.keys, Math.max) |
| `T` | MCP transport stop controller (`ih6`, `J36`) |
| `ih6` | Transport sub-helper |
| `J36` | Transport event adapter (`eA4`) |
| `Z` | MCP connection manager (stop, start, updateConfig, Math.max/min) |
| `W` | MCP session lifecycle (connected, failed, Promise.all) |
| `Z94` | Supervisor heartbeat helper (`T1H`) |
| `T1H` | Heartbeat timer helper |
| `v` | Input/viewport scroll handler (Math.max/floor, preventDefault) |
| `S` | Render/output stream manager (mtime-changed detection, write) |
| `d` | General disposable/cleanup helper |
| `a9q` | Async allSettled wrapper (Promise.allSettled + Array.from) |
| `Yz6` | Startup-perf telemetry flush entry point |
| `g__` | Startup-perf telemetry emitter (`ebA` + `d`) |
| `ebA` | Telemetry batch assembler (Math.round, Object.entries, ibA set, A34 set) |
| `rbA` | Startup-perf file write orchestrator |
| `sbA` | Perf report path helper (Oz6.join) |
| `BYH` | Synchronous file writer (openSync, writeFileSync, fsyncSync, closeSync) |
| `cbA` | Profiling checkpoint collector (entries, ni6, qs, join) |
| `Lm` | `require("perf_hooks")` wrapper |
| `tbA` | Alternative perf report path helper |
| `aZ8` | Scroll-summary telemetry emitter |
| `U9q` | Scroll-summary context accessor |
| `p9q` | Scroll-summary metric builder (Date.now, Math.max, Math.round, Object.assign) |
| `u9q` | Scroll-summary sub-metric helper |
| `m1` | Fullscreen/render mode initializer (local-agent, fullscreen config) |
| `xl` | CF4 feature-flag check |
| `GS_` | Render sub-mode helper (`f6`) |
| `it` | Render init helper (`xsf`) |
| `WS_` | Windows/SSH fullscreen-disable detector (`r6`, Boolean) |
| `t_` | Fullscreen config accessor (`bF`) |
| `usf` | Fullscreen usage tracker (`Y6` + amber-creek telemetry) |
| `Y6` | Telemetry / feature-event emitter (IG6, SG6, fp, QXH, mO8, kG6, hg) |
| `W$6` | Cache-eviction hint emitter |
| `q6` | Async queue primitive (`n36`) |
| `n36` | Low-level async signal primitive |
| `a_` | Nonconforming session cleanup helper (`Xj`, `q6`) |
| `Xj` | Nonconforming session enumerator (`n36`) |
| `QxH` | Final write / resolve helper before `process.exit` |
| `rZ8` | Post-exit resolution sub-helper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.