---
type: feature-spec
feature: "exit"
cc_version: "2.1.133"
tags: ["exit", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.133 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/exit`

> Analysis basis: CC v2.1.133 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.133

---

## Overview

The `/exit` command (aliased as `/quit`) immediately terminates the Claude Code CLI session. It is a `local-jsx` type command that fires synchronously upon invocation, renders a farewell JSX element, emits a final telemetry event, and then drives a graceful-but-forceful shutdown sequence that flushes pending I/O, kills background daemon processes, and calls `process.exit`.

---

## Registration

| Field | Value |
|---|---|
| `type` | `local-jsx` |
| `name` | `exit` |
| `description` | `null` |
| `aliases` | `["quit"]` |
| `immediate` | `true` |
| `module_id` | `bOq` |
| `load_inline` | `true` |
| `loc_byte` | `11344232` |
| `loc_byte_end` | `11344393` |
| `loc_line` | `7112` |
| `arbor_handler.name` | `vw7` |
| `arbor_handler.fqn` | `claude-2.1.133::vw7` |
| `arbor_handler.kind` | `AsyncFunction` |
| `arbor_handler.resolution_path` | `module_id` |
| `arbor_handler.n_hits` | `1` |

Analysis basis: CC v2.1.133 bundle.js:+11344232

---

## Input Branching

The `/exit` command accepts no meaningful user arguments. Its execution path is essentially linear — the command is marked `immediate: true`, so it does not wait for confirmation or parse input tokens. There is one conditional path determined by the process-mode check (foreground vs. background/daemon), but the user cannot influence this.

```
1. User types /exit (or /quit) — no arguments parsed.
2. immediate flag causes the handler (vw7) to fire without further prompt.
3. Process-mode check:
   a. If running as "bg", "daemon", or "daemon-worker" → invoke daemon-aware
      shutdown path (detach-request protocol via AqH).
   b. Otherwise → proceed with standard interactive shutdown (Q1).
4. Render farewell JSX element via NRA.createElement (Vw7 / yX subcomponent).
5. Emit "prompt_input_exit" telemetry literal.
6. Execute graceful shutdown sequence.
```

Because there are only two branches (daemon vs. interactive), pseudocode is used rather than a Mermaid flowchart.

---

## Behavioral Spec

### 1. Handler Entry — `exitCommandHandler` (`vw7`)

Analysis basis: CC v2.1.133 bundle.js:+11343482

```
async function exitCommandHandler(context):

    # Step 1 — determine process role
    role = processRoleCheck()          # calls E9 → hr
    # role ∈ {"bg", "daemon", "daemon-worker", <interactive>}

    # Step 2 — generate random cosmetic delay token
    delayToken = cosmesticDelayHelper() # calls H → Math.random, setTimeout

    # Step 3 — branch on role
    if role in {"bg", "daemon", "daemon-worker"}:
        daemonAwareShutdown()          # calls AqH
    else:
        # Step 4 — render farewell UI
        farewell = NRA.createElement(farewellComponent, ...)  # Vw7 → yX
        # literal "Goodbye!" rendered at +11343446

        # Step 5 — emit exit telemetry literal
        emit("prompt_input_exit")      # literal at +11343670

        # Step 6 — drive shutdown sequence
        interactiveShutdown()          # calls Q1
```

### 2. Process-Role Probe — `processRoleChecker` (`E9` → `hr`)

Analysis basis: CC v2.1.133 bundle.js:+11343482 (call site), +2126512 (literals)

```
function processRoleChecker():
    role = hr()   # reads internal process-mode state
    # Known role strings (literals found at +2126512, +2126522, +2126536):
    #   "bg", "daemon", "daemon-worker"
    return role
```

### 3. Daemon-Aware Shutdown — `daemonAwareShutdown` (`AqH`)

Analysis basis: CC v2.1.133 bundle.js:+11343498

```
function daemonAwareShutdown():

    # Sub-step A: notify daemon supervisor of detach intent
    xu6()          # internal notification helper

    # Sub-step B: build detach payload
    payload = Da9(VZH, d8)
    # d8 type literal "task" at +9854996
    # numeric flag 0 at +9854952

    # Sub-step C: write detach-request message to IPC channel
    ot(payload)    # → rl.write + SH (JSON.stringify) at +9005968/+9005977
    # literal "detach-request" at +9859945

    # Sub-step D: if tmux is active, detach client
    HqH()          # internal tmux check
    ja9.spawnSync("tmux", ["detach-client"], {stdio:"ignore"})
    # literals "tmux" +9860018, "detach-client" +9860026, "ignore" +9860050
```

### 4. Farewell JSX Component — `farewellComponent` (`Vw7` → `yX`)

Analysis basis: CC v2.1.133 bundle.js:+11343652 (call), +11343437 (yX), +11343446 (literal)

```
function farewellComponent(props):
    # Renders a short goodbye text node.
    # Confirmed string literal: "Goodbye!" at +11343446
    return renderText("Goodbye!")   # yX subcomponent
```

### 5. Interactive Shutdown Sequence — `interactiveShutdownOrchestrator` (`Q1`)

Analysis basis: CC v2.1.133 bundle.js:+11343665 (call site), +5052261 onwards

This is the most complex sub-function. It coordinates multiple concurrent teardown tasks.

```
async function interactiveShutdownOrchestrator():

    # Phase 1 — immediate UI teardown
    await Promise.resolve()             # yield to event loop
    cK()                                # close/drain UI component

    # Phase 2 — set a forced-exit safety timer
    safetyTimer = setTimeout(forceExitFallback, Math.max(5000, 3500))
    # numeric literals 5000 at +5052358, 3500 at +5052365
    U3H.unref(safetyTimer)              # do not keep event-loop alive

    # Phase 3 — flush terminal output
    FUH()
    #   → UUH.writeSync (raw stdout flush)
    #   → H.unmount (unmount Ink/React tree)
    #   → Fk (internal cleanup)
    #   → wl6 (terminal escape sequence flush)
    #     ─ ESC-7 save cursor  (+3529009)
    #     ─ ESC-8 restore cursor (+3529020)
    #     ─ ghostty/iTerm compatibility checks (+3273921, +3273990)

    # Phase 4 — write session summary to stdout
    HfA()
    #   → nT, Sh, v6 (formatting helpers)
    #   → Rf6 (stats file path resolution → statSync)
    #   → y$, RK, y1 (additional summary helpers)
    #   → A.replaceAll (escape backslashes/quotes: "\\\\" +5050843, "\\\"" +5050866)
    #   → Go1 (write summary line)
    #   → UUH.writeSync (flush summary)
    #   → M6.dim (dim styling)

    # Phase 5 — force-exit helper (AfA)
    function forceExitFallback():
        clearTimeout(safetyTimer)
        child = p4.get(...)             # retrieve any child process handle
        process.exit(0)                 # primary exit path  (+5051132)
        # fallback: process.kill(pid)   (+5051157)
        # if neither reachable → throw Error("unreachable") (+5051205)

    # Phase 6 — emit session_end telemetry
    #   literal "session_end" at +5052729
    DaH()

    # Phase 7 — flush cache eviction hint
    #   telemetry event tengu_cache_eviction_hint (+5052694)

    # Phase 8 — await all pending async teardown tasks
    mNH()           # → Promise.all(Array.from(pendingSet))

    # Phase 9 — race: normal completion vs AbortSignal timeout
    await Promise.race([
        Promise.all([Ck(), Io(), $(), O()]),
        AbortSignal.timeout(...)
    ])

    # Phase 10 — final raw write and process termination
    UUH.writeSync(...)                  # last byte to stdout (+5053005)
    r8()                                # shutdown timer / SIGTERM guard
    #   → setTimeout(500) at +2167102 (literal 500 at +5052968)
    #   → clearTimeout on clean exit
    #   → K.unref (prevent event-loop hold)
    CsH()                               # flush startup-perf metrics (+170699)
    #   literal "session_end" at +5052729
    kt6()                               # scroll summary + final logging
    #   → tengu_scroll_summary (+5051913)
    #   → Po1, s_ (session-level metrics + fullscreen cleanup)
    #   → J6 (state manager flush)

    clearTimeout(safetyTimer)
    # process terminates
```

### 6. Scroll-Summary Flush — `scrollSummaryFlusher` (`kt6` → `s_`)

Analysis basis: CC v2.1.133 bundle.js:+5052669

```
function scrollSummaryFlusher():
    nT()            # normalize terminal state
    Wo1()           # write scroll summary header
    d()             # debug flush
    Po1()           # compute session timing metrics
    #   → Date.now, Math.max, Math.round, Object.assign
    s_()            # render fullscreen cleanup
    #   CyH() → JwL.has check
    #   fHA() → Zq, kH formatting
    #   Cd()  → g0K
    #   KL6() → a6, Boolean
    #   mA()  → db
    #   Q0K() → J6 (state flush)
    #   J6()  → Bq6, gq6, Po, b5H.has, _d6, pq6.add, cU.has/get, R6
    #   → emit telemetry tengu_amber_creek (+3195341)
    #   → emit telemetry tengu_pewter_brook (+3195249)
    #   → literal "local-agent" +3194613
    #   → fullscreen mode literals "fullscreen" +3195158, "default" +3195184
```

### 7. Daemon Background-Session Teardown (`w` sub-graph, reached via `f38`)

Analysis basis: CC v2.1.133 bundle.js:+11343529 (f38 call)

```
function scheduledTaskSweeper():   # f38
    # Sweeps any lingering background / scheduled tasks before exit.
    # literal "scheduled task" at +9853915
    mN()            # background session map
    H.push(...)     # accumulate teardown tasks
    R67()           # compute remaining task time
    #   → BZ (trim + parse cron expressions)
    #   → nmH (date/time arithmetic: setSeconds/setMinutes/getHours etc.)
    #   → Math.max, Date.now, xq (floor/round helpers)
    c9()            # truncate display strings
    #   → z8 (Bun.stringWidth), s1, Lz

    # For each active background session:
    #   w() → _.get, d, y.kill("SIGKILL" +14157088)
    #         setTimeout(100) +14157112
    #         uH, hH, hP8.freemem, sFA, Math.round
    #         _.values → x.retireIfSettled
    #         fH, J6, nFA, _.set, tFA, K, Date.now
    #         Y → J6, $.dispose, sFA, hP8.freemem, a6, lFA
    #             Date.now, Y (recursive), d, fH
    #         w8, u.dispose
    #         gm.spawn  (re-spawn spare if configured)
    #   telemetry events:
    #     tengu_bg_dispatch_sigkill_escalate (+14157040)
    #     tengu_bg_dispatch_low_mem (+14157619)
    #     tengu_bg_spare_enable (+14158234)
    #     tengu_bg_spare_claim (+14158355)
    #     tengu_bg_spare_claim_fail (+14158618)
    #     tengu_bg_spare_spawn (+14156817)
```

### 8. Daemon Config Reload Cleanup (`D` sub-graph)

Analysis basis: CC v2.1.133 bundle.js:+5052532

```
function daemonConfigReloadCleanup():   # D
    eDH()           # read config file → Cwq.readFile, lCA, cCA
    q.write(...)    # write final config snapshot
    bwq()           # compact config keys (Object.keys, Math.max, n3)
    f.get(...)      # retrieve current config handle
    E.stop()        # stop heartbeat listener
    f.delete(...)   # remove config entry
    I.stop()        # stop watcher
    I.updateConfig(...)
    I.start()       # restart watcher for any lingering consumers
    Bdq() → Go()    # heartbeat flush ("heartbeat" literal +14169021)
    f.set(...)
    Z.start()       # restart supervisor timer
    d()
    # telemetry: tengu_daemon_config_reload (+14170592)
    # literal "supervisor" +14169799
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| **Telemetry emitted (direct)** | `tengu_scroll_summary` (+5051913), `tengu_cache_eviction_hint` (+5052694), `tengu_amber_creek` (+3195341), `tengu_pewter_brook` (+3195249), `tengu_startup_perf` (+171233) |
| **Telemetry emitted (daemon sub-graph)** | `tengu_bg_dispatch_sigkill_escalate` (+14157040), `tengu_bg_dispatch_low_mem` (+14157619), `tengu_bg_spare_enable` (+14158234), `tengu_bg_spare_claim` (+14158355), `tengu_bg_spare_claim_fail` (+14158618), `tengu_bg_spare_spawn` (+14156817), `tengu_daemon_config_reload` (+14170592) |
| **Literal emitted to stdout** | `"Goodbye!"` (+11343446) |
| **Exit path** | `process.exit(0)` via `AfA` (+5051132); fallback `process.kill` (+5051157) |
| **Safety timer** | `setTimeout` with `Math.max(5000, 3500)` = 5000 ms (+5052358/+5052365); `unref`d so it does not block the event loop |
| **Terminal escape sequences** | ESC-7 (save cursor) and ESC-8 (restore cursor) written by `wl6` (+3529009/+3529020) |
| **Ink/React tree** | Unmounted via `H.unmount` inside `FUH` (+5050532) |
| **Background sessions** | Each active background session receives `SIGKILL` after a 100 ms grace window (+14157088/+14157112); spare slots may be re-spawned via `gm.spawn` |
| **Tmux integration** | If a tmux session is active, `tmux detach-client` is executed synchronously via `ja9.spawnSync` (+9860004); stdio is set to `"ignore"` |
| **Hook registration** | No new hooks registered during exit; existing hooks/watchers (`I`, `Z`, `E`) are stopped before teardown |
| **appState changes** | `_.set` / `_.get` used to update internal state map; `f.delete` removes config handle; `cU`, `b5H`, `pq6` sets mutated during J6 flush |
| **Sound** | None detected within depth-2 traversal |
| **Startup-perf log** | `CsH` → `PiA` writes a startup profiling report if profiling was enabled; `jiA` resolves the `startup-perf` log path (+170899) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.133 | Initial analysis — `local-jsx`, `immediate: true`, alias `quit`, handler `vw7` confirmed via Arbor `module_id` resolution |

---

## Common Mistakes

1. **Expecting `/exit` to wait for confirmation.** The `immediate: true` flag means the command fires the moment it is recognized — there is no "are you sure?" prompt. Any unsaved agent state is discarded immediately.
2. **Using `/exit` inside a daemon/background session expecting a clean interactive shutdown.** When the process role is `"bg"`, `"daemon"`, or `"daemon-worker"`, the command takes the `daemonAwareShutdown` path, which sends an IPC `detach-request` and may invoke `tmux detach-client` rather than terminating the process directly.
3. **Assuming the process exits synchronously.** The handler is an `AsyncFunction` (`vw7`). Although `immediate: true` suppresses the prompt pipeline, the teardown sequence (`Q1`) is asynchronous and races against a 5-second safety timer before forcing `process.exit`.
4. **Relying on `/quit` behaving differently.** `quit` is a pure alias of `exit`; they share the identical handler.
5. **Expecting a non-zero exit code on user-initiated exit.** The confirmed exit call is `process.exit(0)` — normal termination code — regardless of session state.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `vw7` | Main exit command handler (`AsyncFunction`; Arbor-resolved via `module_id` `bOq`) |
| `E9` | Process-role reader (determines `bg` / `daemon` / `daemon-worker`) |
| `hr` | Internal process-mode state accessor |
| `H` | Cosmetic delay / animation helper (uses `Math.random` + `setTimeout`) |
| `AqH` | Daemon-aware shutdown coordinator |
| `xu6` | Daemon supervisor notification helper |
| `Da9` | Detach-payload builder |
| `VZH` | Detach-payload schema/type object |
| `d8` | Task-type constant provider |
| `ot` | IPC channel writer (`rl.write` + JSON serializer) |
| `SH` | JSON serializer wrapper |
| `HqH` | Tmux presence check |
| `vf` | Internal context accessor used in handler |
| `f38` | Scheduled-task / background-session sweeper |
| `mN` | Background session map accessor |
| `R67` | Remaining-task time calculator |
| `UE` | Cron expression evaluator (trim, match, parseInt, date math) |
| `L` | Column formatter (map + padEnd) |
| `w` | Background session process manager (SIGKILL, freemem, spawn) |
| `K` | Async task set manager (add/delete/finally) |
| `J` | Process-kill dispatcher (_.values + v.kill) |
| `Y` | Background session lifecycle manager (dispose, freemem, recurse) |
| `$` | XDq-based state container |
| `X` | UTC date arithmetic helper (getUTCDay, setUTCDate, etc.) |
| `BZ` | Cron string trimmer/parser |
| `UUK` | Cron field parser (split, match, parseInt, Array.from) |
| `_` | Lowercase normalizer / utility array |
| `nmH` | Date/time offset calculator (setSeconds/setMinutes/getHours etc.) |
| `A` | Generic string/array operand (context-dependent) |
| `O` | Date object with background-session state (`d8`) |
| `f` | IPC channel / close manager |
| `q` | Temp-file unlink manager (`Ydq.unlinkSync`) |
| `xq` | Duration formatter (floor + round) |
| `c9` | Display-string truncator (indexOf + substring + stringWidth) |
| `z8` | Grapheme-aware string width measurer (`Bun.stringWidth`) |
| `s1` | String render helper (z8 + Lz) |
| `Lz` | Low-level string layout helper |
| `Vw7` | Farewell JSX component wrapper |
| `Q1` | Interactive shutdown orchestrator (async, multi-phase) |
| `FUH` | Terminal flush + Ink unmount coordinator |
| `Fk` | Internal post-unmount cleanup |
| `wl6` | Terminal escape sequence flusher (cursor save/restore) |
| `Zc6` | Terminal type coercer (ghostty/iTerm detection) |
| `I2H` | Post-escape-sequence write helper |
| `NE` | Escape-sequence string cleaner (`replaceAll` ESC ESC) |
| `kH` | String coercion wrapper |
| `HfA` | Session summary writer (stats path + dim styling) |
| `nT` | Terminal state normalizer |
| `Sh` | Summary header formatter |
| `v6` | File path / version helper |
| `Rf6` | Stats file resolver (statSync) |
| `tg` | Stats path component |
| `LA` | Stats path component |
| `F6` | File-existence checker |
| `y$` | Summary detail formatter |
| `RK` | Summary sub-formatter → `y1` |
| `Go1` | Summary line writer |
| `AfA` | Force-exit fallback (clearTimeout + process.exit/kill) |
| `mNH` | Pending-task drainer (Promise.all + Array.from) |
| `D` | Daemon config-reload cleanup orchestrator |
| `eDH` | Config file reader (Cwq.readFile + lCA/cCA) |
| `w8` | Config parse helper |
| `lCA` | Config loader wrapper → `cCA` |
| `vH` | String coercion for config values |
| `bwq` | Config key compactor (Object.keys + Math.max + n3) |
| `E` | Heartbeat/remote-control event stop handler |
| `u` | Disposable resource handle |
| `QP` | User-settings accessor (`remoteControlAtStartup`) |
| `I` | File watcher (stop/updateConfig/start) |
| `Bdq` | Heartbeat flusher → `Go` |
| `Go` | Heartbeat write helper |
| `Z` | Supervisor timer (start) |
| `d` | Debug/log flush |
| `CsH` | Startup-perf metrics flusher |
| `PiA` | Performance mark collector (perf_hooks, Math.round) |
| `Ib` | `require` wrapper for `perf_hooks` |
| `jiA` | Startup-perf log path builder |
| `_E` | Atomic file writer (openSync/writeFileSync/fsyncSync/closeSync) |
| `DiA` | Startup-perf report formatter |
| `iE6` | Perf entry formatter → `p9`, `fQ` |
| `fQ` | Number formatter (`toFixed`) |
| `k` | Telemetry/analytics dispatcher |
| `Ztq` | Analytics event builder |
| `Uf` | Sensitive-field redactor (`[REDACTED]` +155024) |
| `LkH` | Analytics queue writer → `UnA` |
| `vtq` | Analytics HTTP sender (Buffer.byteLength, gE6.then) |
| `kt6` | Scroll-summary flusher + final logging |
| `Wo1` | Scroll-summary header writer |
| `Po1` | Session timing metrics computer (Date.now, Math.max/round) |
| `Xo1` | Session metrics sub-helper |
| `s_` | Fullscreen + terminal cleanup coordinator |
| `CyH` | JwL set membership check |
| `fHA` | Terminal format writer → Zq, kH |
| `Cd` | Terminal-mode setter → g0K |
| `KL6` | Boolean-flag resolver → a6 |
| `mA` | State-map writer → db |
| `Q0K` | State-flush coordinator → J6 |
| `J6` | Subscription/state manager (Bq6, gq6, Po, b5H, _d6, pq6, cU, R6) |
| `DaH` | Session-end telemetry emitter |
| `r8` | Shutdown SIGTERM guard (setTimeout 500ms, clearTimeout, K.unref) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.