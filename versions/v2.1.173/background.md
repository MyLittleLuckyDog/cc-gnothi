---
type: feature-spec
feature: "background"
cc_version: "2.1.173"
updated: "2026-06-11"
tags: ["background", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.173 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/background`

> Analysis basis: CC v2.1.173 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.173

---

## Overview

The `/background` command (alias `/bg`) sends the current interactive Claude Code session into a background daemon process, freeing the terminal for other use. It validates preconditions (session persistence enabled, at least one message exchanged), forks the session via the background daemon dispatch infrastructure, and either confirms successful detachment or reports an actionable error.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `background` |
| description | `Send this session to the background and free the terminal` |
| aliases | `["bg"]` |
| argumentHint | `[prompt]` |
| immediate | `null` |
| module_id | `MXK` |
| load_inline | `true` |
| loc_byte | `13324783` |
| loc_byte_end | `13325023` |
| loc_line | `9767` |
| arbor_handler.name | `Qe7` |
| arbor_handler.fqn | `claude-2.1.173::Qe7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.173 bundle.js:+13324783

---

## Input Branching

The command has 4+ distinct branches based on precondition checks, daemon availability, and dispatch outcome.

```mermaid
flowchart TD
    A(["/background invoked"]) --> B{Session persistence\nenabled?}
    B -- No --> ERR1["Error: Cannot background —\nsession persistence disabled\n(bundle.js:+13324137)"]
    B -- Yes --> C{At least one message\nsent in session?}
    C -- No --> ERR2["Error: Nothing to background yet\n— send a message first\n(bundle.js:+13324313)"]
    C -- Yes --> D{Already running\nas background session?}
    D -- Yes --> SKIP["Emit tengu_background_already_bg\nno-op / return early\n(bundle.js:+13324070)"]
    D -- No --> E[Resolve daemon &\nbuild dispatch args\n(bundle.js:+13319229)]
    E --> F{Incompatible flag combos?\n--bg + --pool / --cloud}
    F -- Conflict --> ERR3["Error: incompatible backend\n(bundle.js:+13266472 / +13266597)"]
    F -- No conflict --> G{bypassPermissions active\nwithout prior acceptance?}
    G -- Blocked --> ERR4["Error: must run --dangerously-skip-permissions\ninteractively first\n(bundle.js:+13317722)"]
    G -- OK --> H{Auto permission-mode\nnot yet opted-in?}
    H -- Blocked --> ERR5["Error: must run --permission-mode auto\ninteractively first\n(bundle.js:+13317884)"]
    H -- OK --> I[Flush output & wait\nup to 2000 ms\n(bundle.js:+13319524)]
    I --> J[Dispatch to daemon via\nbg-dispatch pipeline\n(bundle.js:+13297346)]
    J --> K{Dispatch outcome}
    K -- Success --> OK["Emit tengu_background\nSet terminal title to '(backgrounded)'\nExit / free terminal\n(bundle.js:+13321032 / +13321767)"]
    K -- Spawn failed --> FAIL["Emit tengu_background_spawn_failed\nDisplay error & retry prompt\n(bundle.js:+13320224 / +13320587)"]
    K -- Daemon unavailable --> ERR6["Report daemon-unavailable reason\n(bundle.js:+13304905)"]
```

---

## Behavioral Spec

### Handler Entry Point — `backgroundCommandHandler` (`Qe7`)

Analysis basis: CC v2.1.173 bundle.js:+13324056

```
async function backgroundCommandHandler(context):
    # Precondition: session persistence
    if not sessionPersistenceEnabled(context):
        return errorResult("Cannot background — session persistence is disabled, "
                           "so the forked job would have nothing to resume.")

    # Precondition: at least one message
    if sessionIsEmpty(context):
        return errorResult("Nothing to background yet — send a message first.")

    # Already running in background?
    if currentSessionIsBackground(context):
        emitTelemetry("tengu_background_already_bg")
        return  # no-op

    # Delegate to REPL background fork orchestrator
    return replBackgroundForkOrchestrator(context)
```

Analysis basis: CC v2.1.173 bundle.js:+13324068, +13324104, +13324122, +13324274

---

### Session-Type & Render Setup — `sessionTypeRenderer` (`ZOH`)

Analysis basis: CC v2.1.173 bundle.js:+13324122

```
function sessionTypeRenderer(context):
    # Selects production vs. test rendering path
    # Checks environment tag (bundle.js:+13420083 / +13420180)
    if env == "production":
        return productionRenderPath(context)
    else:
        return testRenderPath(context)
```

---

### REPL Background Fork Orchestrator — `replBackgroundFork` (`lF8`)

Analysis basis: CC v2.1.173 bundle.js:+13319229

This is the core orchestrator. It:
1. Collects all active session objects via `Array.from(sessionMap.values())`.
2. Filters and maps sessions for the daemon dispatch.
3. Validates flag compatibility (backend conflicts, permission mode).
4. Flushes I/O with a 2000 ms timeout (literal "flush timeout", bundle.js:+13319524/+13319529).
5. Builds the CLI argument array including `--resume`, `--fork-session`, `--reply-on-resume`, `--add-dir`, `--allowed-tools`, `--disallowed-tools`, `--model`, `--effort`, `--permission-mode`, and `--` separator (literals at bundle.js:+13319580, +13319593, +13319635, +13319687, +13319722, +13319763, +13319794, +13319823, +13319840, +13319868).
6. Calls daemon ensure-running subsystem (`daemonEnsureRunning`).
7. Calls background dispatch (`bgDispatch`).
8. On success: sets terminal title to `"(backgrounded)"` and triggers `process.exit(0)`.
9. On failure: displays a retry prompt (`"couldn't start in the background — press Enter to retry"`, bundle.js:+13320587) and emits `tengu_background_spawn_failed`.

```
async function replBackgroundForkOrchestrator(context):
    sessions = Array.from(sessionMap.values())

    # Flag conflict guards
    if args includes "--pool" or "--pool=":
        error("--bg and --pool are different backends. Use `claude -p '<task>' --pool <pool_id>` directly...")
    if args includes "--cloud" or "--cloud=":
        error("--bg and --cloud are different backends. Use `claude --cloud '<task>'` directly...")

    # Permission guards
    if bypassPermissions and not disclaimerAccepted:
        error("--bg with bypassPermissions requires accepting the disclaimer first...")
    if permissionMode == "auto" and not autoModeOptedIn:
        error("--bg with auto mode requires opting in first...")

    # I/O flush with 2000 ms timeout
    await Promise.race([flushOutput(), timeout(2000, "flush timeout")])

    # Build arg list
    args = buildArgList(sessions, flagSettings)
    # args includes --resume, --fork-session, --reply-on-resume, --add-dir,
    # --allowed-tools, --disallowed-tools, --model, --effort, --permission-mode, --

    # Ensure daemon
    daemon = await daemonEnsureRunning(context)
    if not daemon.ok:
        emitTelemetry("tengu_background_spawn_failed")
        showRetryPrompt("couldn't start in the background — press Enter to retry")
        return

    # Dispatch
    result = await bgDispatch(daemon, args)
    if result.ok:
        emitTelemetry("tengu_background")
        setTerminalTitle("(backgrounded)")
        triggerReplBackgroundForkTelemetry("repl_background_fork")
        process.exit(0)
    else:
        emitTelemetry("tengu_background_spawn_failed")
        showRetryPrompt("couldn't start in the background — press Enter to retry")
```

Analysis basis: CC v2.1.173 bundle.js:+13319229 through +13321298

---

### Daemon Ensure-Running — `daemonEnsureRunning` (`aQ`)

Analysis basis: CC v2.1.173 bundle.js:+13256329

```
async function daemonEnsureRunning(context):
    emitTelemetry("tengu_bg_daemon_cold_start_ask") # if cold start
    # Platform-specific paths: macos / linux (bundle.js:+13256970 / +13257000)
    # Checks for stale exec path (bundle.js:+13256510)
    if daemonExecPathStale:
        emitTelemetry("tengu_bg_daemon_service_stale_exec")
        # Falls back to transient spawn
    if noBackgroundDaemon and installPolicy == "ask":
        prompt = "Install as a service now? [y/N/never, or 'once' just for now] "
        answer = await promptUser(prompt)
        emitTelemetry("tengu_bg_daemon_cold_start_ask_answer")
        handle(answer) # "yes" | "once" | "no" | "never"
    result = await spawnOrConnectDaemon()
    if spawnFailed:
        emitTelemetry("tengu_bg_daemon_spawn_failed")
    return result
```

Analysis basis: CC v2.1.173 bundle.js:+13256392, +13256437, +13256850, +13257415

---

### Background Dispatch — `bgDispatch` (`jYA`)

Analysis basis: CC v2.1.173 bundle.js:+13295225

```
async function bgDispatch(daemon, args):
    emitTelemetry("tengu_bg_dispatch")
    sessionId = generateRandomBytes(8, "hex")  # bundle.js:+13295571

    # Try connecting to control socket
    socketPath = buildSocketPath(sessionId)  # bundle.js:+13295512
    connection = await connectToControlSocket(socketPath)

    if connectionFailed:
        emitTelemetry("tengu_bg_dispatch_fallback")
        # Write dispatch file as fallback (bundle.js:+13296261)

    # Write dispatch with 6000 ms timeout (bundle.js:+13295733)
    await writeDispatchWithTimeout(connection, args, 6000)

    if dispatchSucceeded:
        emitTelemetry("tengu_bg_dispatch")
        return { ok: true }
    else:
        return classifyError(result)  # maps to daemon-unavailable reason codes
```

Analysis basis: CC v2.1.173 bundle.js:+13297346, +13297876, +13295504, +13295645

---

### Daemon Socket Client — `daemonSocketClient` (`dY`)

Analysis basis: CC v2.1.173 bundle.js:+11711309

```
async function daemonSocketClient(socketPath, payload):
    socket = await net.connect(socketPath)
    socket.setTimeout(controlSocketTimeout)
    socket.on("error", ...) # ENOCONN, timeout → throw
    socket.write(JSON.stringify(payload))
    response = await readResponse(socket)
    if responseIsIncomplete:
        throw new Error("connection dropped mid-request — it may have restarted; retry")
    return parseResponse(response)
```

---

### Error Classification — `dispatchErrorClassifier` (`nJK`)

Analysis basis: CC v2.1.173 bundle.js:+13297344

Maps internal error codes to human-readable reason strings:

| Error code | User-facing reason |
|---|---|
| `daemon-unreachable` | daemon not reachable |
| `ack-timeout` | timed out |
| `dispatch-write` | couldn't write dispatch file |
| `enoconn` | socket missing |
| `estarting` | service still starting |
| `stale-short` | id collision with a prior job |
| `short-alive` | Previous session is still shutting down — try again |
| `daemon_unavailable` | general unavailability |

Analysis basis: CC v2.1.173 bundle.js:+13297945 through +13298159, +13304854, +13304905

---

### JSX Render Layer — `backgroundJsxRenderer` (`nF8`)

Analysis basis: CC v2.1.173 bundle.js:+13321487

The command renders a JSX component (`EOH.createElement` at bundle.js:+13324383). The renderer:
- Checks `O.startsWith(...)` to detect special prompt prefixes (bundle.js:+13321619).
- Applies inline content substitution via `O.replace(...)` (bundle.js:+13321500).
- Constructs the UI via `y6` / `X$` / `IQ` helper components (bundle.js:+13321729, +13321732, +13321740).
- Accepts an optional `[prompt]` argument (per `argumentHint`) that is forwarded as the initial task for the forked background session.

---

### Argument Builder — `backgroundArgBuilder` (`Re7`)

Analysis basis: CC v2.1.173 bundle.js:+13300772

```
function buildArgList(sessionState, flags):
    args = []
    # Always include session resumption
    args.push("--resume", sessionId)
    args.push("--fork-session")
    if replyOnResume:
        args.push("--reply-on-resume")
    if addDir:
        args.push("--add-dir", dirPath)
    if allowedTools:
        args.push("--allowed-tools", ...tools)
    if disallowedTools:
        args.push("--disallowed-tools", ...tools)
    if model:
        args.push("--model", model)
    if effort:
        args.push("--effort", effortLevel)
    if permissionMode:
        args.push("--permission-mode", mode)
    args.push("--")
    if promptArg:
        args.push(promptArg)
    return args
```

Analysis basis: CC v2.1.173 bundle.js:+13319580, +13319593, +13319635, +13319687, +13319722, +13319763, +13319794, +13319823, +13319840, +13319868

---

### Daemon Stop / Shutdown — `daemonStop` (`wS`) and `daemonShutdown` (`CU`)

Called when the foreground session fully detaches.

```
async function daemonStop(reason):
    emitTelemetry("tengu_daemon_control") # event: "daemon_stop" / "daemon_stop_failed"
    await broadcastShutdown(reason)  # "forced shutdown" (bundle.js:+16793968)

async function daemonShutdown():
    await Promise.race([
        Promise.all([shutdownAllWorkers(), cleanupLeases()]),
        timeout(500)  # bundle.js:+16792689
    ])
    process.exit(0)
```

Analysis basis: CC v2.1.173 bundle.js:+16797643, +16797571, +16797608, +16792645, +16792689

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_background` (success, bundle.js:+13321032); `tengu_background_already_bg` (already bg, bundle.js:+13324070); `tengu_background_spawn_failed` (failure, bundle.js:+13320224); `tengu_bg_dispatch` (dispatch sent, bundle.js:+13297346); `tengu_bg_dispatch_fallback` (file-based fallback, bundle.js:+13297876); `tengu_bg_dispatch_rescued` (rescued after failure, bundle.js:+13303750); `tengu_bg_daemon_cold_start_ask` (install prompt, bundle.js:+13257415); `tengu_bg_daemon_cold_start_ask_answer` (user answered, bundle.js:+13264063); `tengu_bg_daemon_spawn_failed` (spawn failed, bundle.js:+13257934); `tengu_bg_daemon_service_stale_exec` (stale binary, bundle.js:+13256467); `tengu_daemon_control` (stop events, bundle.js:+16797646) |
| Terminal title | Set to `"(backgrounded)"` on success (bundle.js:+13321767) |
| process.exit | `process.exit(1)` on CLI error; `process.exit(0)` on successful detach (bundle.js:+13298584, +13298597) |
| I/O flush | Output flushed with 2000 ms deadline before dispatch (bundle.js:+13319524) |
| Daemon socket | Connects to Unix control socket; falls back to dispatch-file write on socket miss |
| Session fork | Creates a new background job via `--fork-session` flag; original session terminates |
| appState changes | App state updated via `H.getAppState` / `H.setAppState` inside main agent loop (bundle.js:+10666872, +10668036) |
| Sound | None observed in depth-2 traversal |
| Hook registration | `yZA.register` called during daemon boot sequence (bundle.js:+63751) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.173 | Initial analysis |

---

## Common Mistakes

1. **Running `/background` before sending any message** — the command guards on session non-emptiness and returns `"Nothing to background yet — send a message first."` The terminal will not be freed.
2. **Combining `/background` with `--pool` or `--cloud` flags** — these are incompatible backends. Use `claude -p '<task>' --pool <pool_id>` or `claude --cloud '<task>'` directly instead.
3. **Using `bypassPermissions` (`--dangerously-skip-permissions`) without prior interactive acceptance** — the command will block with an error. Run the flag interactively once first to accept the disclaimer.
4. **Using `auto` permission mode without opting in interactively** — same guard as above; run `claude --permission-mode auto` once interactively before using `/background`.
5. **Expecting instant detachment when the daemon is not installed** — if no background daemon is running and the install policy is `ask`, the command will prompt the user before proceeding, adding latency.
6. **Assuming the terminal is freed immediately on error** — on dispatch failure the command displays a retry prompt (`"couldn't start in the background — press Enter to retry"`) rather than exiting.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Qe7` | Main handler for `/background` (AsyncFunction, arbor-resolved) |
| `lF8` | REPL background fork orchestrator |
| `nF8` | JSX render layer for background command UI |
| `ZOH` | Session type / environment renderer |
| `O9` | Daemon worker type check helper |
| `R$H` | Detach-request builder |
| `Oiq` | Background session task state accessor |
| `Wr` | Control-socket write helper |
| `LKH` | Lease-key handler |
| `rNH` | Session-context store resolver |
| `_M` | Async-local-storage context wrapper |
| `HT` | Context store getter |
| `aQ` | Daemon ensure-running orchestrator |
| `jYA` | Background dispatch (bg-dispatch) core |
| `nJK` | Dispatch error classifier / reason mapper |
| `dY` | Daemon control-socket client |
| `ou8` | Alternative socket connection handler |
| `_pH` | Socket path builder |
| `jKH` | Dispatch file reader |
| `Re7` | Argument list builder for forked session |
| `Fe7` | Flag parser / pre-validation (pool/cloud conflict) |
| `nr` | Session pre-check and temp dir setup |
| `Nq8` | Boolean filter for session objects |
| `b6` | Config state watcher / file-watcher helper |
| `G7H` | Config file reader with backup logic |
| `C_9` | Config directory scanner |
| `GZ_` | Config path resolver |
| `Zx4` | Config file watcher setup |
| `lF8` | (see orchestrator above) |
| `OY` | Session map accessor |
| `iM` | Session filter predicate |
| `VYA` | Daemon registration helper |
| `$4` | Daemon registration target |
| `y9` | Service registration call |
| `HL` | Flush-with-timeout utility |
| `vZ` | Secondary daemon registration |
| `iZH` | Session collection helper |
| `Y` | Forced-shutdown session iterator |
| `HX` | Session abort handler |
| `z` | Session abort controller |
| `kH` | Feature OK telemetry emitter |
| `A6` | Feature result type |
| `bH` | Feature bad telemetry emitter |
| `wS` | Daemon stop broadcaster |
| `eu` | Stop notification sender |
| `ThH` | Stop event dispatcher |
| `AJ_` | Shutdown event emitter |
| `CU` | Daemon shutdown orchestrator |
| `NLH` | Worker shutdown caller |
| `hLH` | Timeout clear helper |
| `d8` | Abort state machine |
| `X` | MCP session collection |
| `M` | MCP server manager |
| `SRH` | MCP server connection handler |
| `oWA` | MCP client refresh orchestrator |
| `$n8` | MCP connection result applier |
| `p05` | PTY daemon server (main loop) |
| `G` | PTY key event handler / vim-mode dispatcher |
| `D` | Background job lifecycle manager |
| `y` | Background daemon sweep ticker |
| `l` | Grace-clock / scheduled-task manager |
| `n` | Foreground worker (voice/recording) handler |
| `s` | Voice recording state machine |
| `Q` | Background PTY socket connection manager |
| `Qf6` | Main agent query orchestrator |
| `xm7` | Agent task dispatcher |
| `GT` | Agent query execution core |
| `AS8` | App-state mutation handler |
| `GR` | Agent response renderer |
| `xWK` | Full agent turn handler |
| `bpH` | Agent response post-processor |
| `eE` | Message normalizer |
| `CH` | JSON stringify wrapper |
| `EH` | String coercion helper |
| `SH` | MCP logging dispatcher |
| `N8` | Error wrapper |
| `Y6` | Telemetry event emitter (amber anchor) |
| `f6` | String coercion utility |
| `S56` | Token counter |
| `kqA` | Token usage tracker |
| `p6` | Context store accessor |
| `Yo6` | Async-local-storage store getter |
| `P_` | BG auth/key resolver |
| `BG` | Base config accessor |
| `DC` | Left-arrow UI component |
| `H86` | UI status indicator |
| `XWH` | UI spinner/progress component |
| `t6` | Feature telemetry (sad path) |
| `Az` | Compact boundary marker |
| `Tx8` | Compact boundary type |
| `mJ` | Message type discriminator |
| `XXH` | Config file watcher (XXH) |
| `yz` | Config validity checker |
| `qg` | Array shape validator |
| `Jx8` | Tool-use predicate |
| `iN` | Tool result mapper |
| `zr` | Tool type resolver |
| `oqH` | Tool name prefix checker |
| `X$` | UI renderer variant A |
| `y6` | UI base component |
| `IQ` | UI renderer variant B |
| `CDH` | Daemon worker context |
| `q18` | Task type resolver |
| `BC8` | Background session marker |
| `KPK` | Session persistence flag |
| `Ou` | Session state getter |
| `YYA` | Dispatch message formatter |
| `$p6` | Daemon cold-start query |
| `swA` | Cloud flag detector |
| `awA` | Pool flag detector |
| `cl` | Flag token slicer |
| `pC` | Settings source selector |
| `x8` | Settings layer resolver |
| `bu` | String prefix/slice helper |
| `AXK` | Resume flag parser |
| `ge7` | Agent flag checker |
| `QF8` | Session-id flag parser |
| `KXK` | Unknown flag passthrough |
| `DXH` | Tool allow/deny list parser |
| `Zt4` | Tool override merger |
| `qXK` | Pool/cloud flag parser |
| `MO` | Atomic file writer |
| `NJ` | Stale dispatch file cleaner |
| `gAH` | Config working-path resolver |
| `cJK` | Command-line argument mapper |
| `Se7` | Shell detection helper |
| `Go6` | Git Bash / shell resolver |
| `Be7` | Argument prefix filter |
| `ah` | Dispatch rescue handler |
| `be7` | Short-alive error handler |
| `t_H` | P7H invocation wrapper |
| `P7H` | Amber-anchor telemetry submitter |
| `c6H` | Connection cleanup helper |
| `Op6` | Memory pressure checker |
| `TJK` | Grace-bridge telemetry helper |
| `i06` | JSONC config file reader |
| `Tq` | Conversation state file manager |
| `Hf` | Jobs-dir path resolver |
| `iE` | Jobs path builder |
| `T8H` | Claude link scanner |
| `Rw` | Realpath resolver |
| `Su` | Stat / type checker |
| `E0` | Directory reader helper |
| `cRf` | File line reader |
| `yF8` | Telemetry upgrade helper |
| `u05` | Stall row calculator |
| `m05` | Worker respawn helper |
| `KF6` | Socket write/destroy helper |
| `W` | Connection-failed UI component |
| `N76` | Error display primitive |
| `JA` | Error string builder |
| `R` | Transient daemon write helper |