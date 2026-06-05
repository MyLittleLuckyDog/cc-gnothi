---
type: feature-spec
feature: "update"
cc_version: "2.1.165"
updated: "2026-06-05"
tags: ["update", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.165 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/update`

> Analysis basis: CC v2.1.165 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.165

---

## Overview

The `/update` command upgrades the running Claude Code CLI process to the latest installed version without terminating the current conversation. It performs a series of pre-flight checks, flushes all in-flight I/O and analytics, then performs an in-process `execve`-style relaunch (replacing the current process image) while forwarding all original CLI arguments plus a `--resume` flag so the conversation continues seamlessly.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `update` |
| description | `Switch to the latest version (conversation continues)` |
| supportsNonInteractive | `false` |
| isHidden | `true` |
| module_id | `R9K` |
| load_inline | `true` |
| loc_byte | `12656068` |
| loc_byte_end | `12656309` |
| loc_line | `9069` |
| arbor_handler.name | `ZCf` |
| arbor_handler.fqn | `claude-2.1.165::ZCf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.165 bundle.js:+12656068

---

## Input Branching

The handler has 4+ distinct branches (background-task guard, wrong-directory guard, session argument reconstruction, and the relaunch execution path), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/update invoked"]) --> B{Is the CLI<br/>running non-interactively?}
    B -- yes --> C[Emit tengu_update_refused telemetry\nReturn early with refusal message]
    B -- no --> D{Background tasks<br/>in 'running' or 'pending' state?}
    D -- yes --> E[Return error:\n'Cannot /update while background\ntasks are running…']
    D -- no --> F{Session resumed from<br/>a different project directory?}
    F -- yes --> G[Return error:\n'Cannot /update — this session\nwas resumed from a different\nproject directory…']
    F -- no --> H[Display status message:\n'Switching to latest Claude Code…\nreconnecting']
    H --> I[Flush SDK message bridge\n(2000 ms timeout — bridge flush)]
    I --> J[Tear down SDK bridge]
    J --> K[Reconstruct CLI argument list\nwith --resume and session flags]
    K --> L[Resolve latest binary path\nvia installDir / versions / bin]
    L --> M[Flush analytics\n(30 000 ms timeout)]
    M --> N[Remove all process signal listeners\nRegister SIGINT / SIGHUP pass-throughs]
    N --> O[spawnSync new process\nwith inherited stdio]
    O --> P{spawnSync succeeded?}
    P -- error --> Q[Write relaunch_spawn_error\nto disk; exit 1]
    P -- ok --> R[process.exit with child\nexit code or 128+signal]
```

---

## Behavioral Spec

### Pre-flight: non-interactive guard

```
function checkNonInteractive(context):
    if context.nonInteractive:
        emit telemetry("tengu_update_refused")
        return refusal          # early return
```

Analysis basis: CC v2.1.165 bundle.js:+12653972 (telemetry at +12653974)

---

### Pre-flight: background-task guard

```
function checkBackgroundTasks(appState):
    tasks = Object.values(appState.tasks)
    for task in tasks:
        if task.status in ["running", "pending"]:
            return Error(
                "Cannot /update while background tasks are running " +
                "— wait for them to finish, then try again."
            )
```

Status strings `"running"` and `"pending"` are literal constants.
Analysis basis: CC v2.1.165 bundle.js:+12654197 (task enumeration), +12654235 / +12654257 (status literals), +12654338 (error message literal)

---

### Pre-flight: project-directory guard

```
function checkProjectDirectory(appState):
    if sessionWasResumedFromDifferentDirectory(appState):
        return Error(
            "Cannot /update — this session was resumed from a different " +
            "project directory. Restart manually with --resume to continue " +
            "on the latest version."
        )
```

Analysis basis: CC v2.1.165 bundle.js:+12654445 (directory check call), +12654579 (error message literal)

---

### Status notification and SDK bridge flush

```
async function notifyAndFlushBridge(sdkBridge):
    display("Switching to latest Claude Code… reconnecting")  # literal at +12655090
    uuid = generateRandomUUID()                               # via h9K / TC8.randomUUID
    await sdkBridge.writeSdkMessages(...)
    await race(
        sdkBridge.flush(),
        timeout(2000)                                         # literal at +12655170
    )  # timeout label: "bridge flush"                        # literal at +12655175
    await sdkBridge.teardown()
```

Analysis basis: CC v2.1.165 bundle.js:+12655066 (writeSdkMessages), +12655086 (UUID gen), +12655157 (timeout race), +12655160 (flush), +12655211 (teardown)

---

### CLI argument reconstruction

```
function buildRelaunchArgs(originalArgs, sessionState, appState):
    args = Array.from(originalArgs)

    # Inject --resume if not already present
    if "--resume" not in args:
        args.push("--resume")

    # Forward session-scoped flags:
    #   --add-dir, --allow-dangerously-skip-permissions,
    #   --effort, --permission-mode
    for flag in sessionFlags:
        if flag was set in original invocation:
            args.push(flag, value)

    # Restore app-state fields:
    #   working_directory, allowed_tools, disallowed_tools,
    #   avoid_prompts, effort, model, max_thinking_tokens,
    #   flag_settings
    restoreAppStateArgs(args, appState)

    return args
```

Analysis basis: CC v2.1.165 bundle.js:+12655353 (ZCf→ZC8 call), +12655392 (ZCf→dR8 call), +12378650 (`"--resume"` literal), +12380174 (`"--add-dir"` literal), +12380343 (`"--allow-dangerously-skip-permissions"` literal), +12380485 (`"--effort"` literal), +12380502 (`"--permission-mode"` literal)

---

### Binary path resolution

```
function resolveLatestBinary():
    # Locate the "claude" executable on PATH
    claudeBin = Bun.which("claude")           # literal "claude" at +12653877

    # Determine install prefix via XDG-style path:
    #   ~/.local/share/versions/<version>/bin
    installDir = path.join(
        homedir(),                            # O8q.homedir
        ".local", "share"                    # literals at +7976078, +7976087
    )
    versionedBin = path.join(
        installDir,
        "versions",                           # literal at +9299581
        currentVersion,
        "bin"                                 # literal at +7976158
    )
    return versionedBin or claudeBin
```

Analysis basis: CC v2.1.165 bundle.js:+12653874 (Bun.which call), +12655333 (D0H / relaunch orchestrator)

---

### Relaunch orchestration (D0H — relaunch runner)

```
async function relaunchRunner(binaryPath, args, appState):
    # 1. Stat the resolved binary to confirm it exists
    stat = await fs.stat(binaryPath)          # L6K.stat at +12378598

    # 2. Flush analytics with a 30 000 ms timeout
    await race(
        flushAnalytics(),
        timeout(30000)                        # literal at +12378717
    )  # timeout label: "flush timeout (relaunch)"  # literal at +12378723

    # 3. Wait for cleanup hooks (label: "cleanup timeout")
    #                                         # literal at +12378779
    await race(
        runCleanupHooks(),
        timeout(...)
    )

    # 4. Drain zXA event queue
    await drainEventQueue()                   # OpH→zXA.drain at +12379219.. 

    # 5. Flush remaining analytics (500 ms window)
    await race(
        flushRemainingAnalytics(),
        timeout(500)                          # literal at +5447414
    )  # label: "analytics flush timeout"     # literal at +12378835

    # 6. Remove all signal listeners; install pass-throughs
    process.removeAllListeners()              # +12379219
    process.on("SIGINT",  passThrough)        # literals at +12379190, +12379249
    process.on("SIGHUP",  passThrough)        # literal at +12379209

    # 7. spawnSync the new binary with inherited stdio
    result = childProcess.spawnSync(
        binaryPath,
        args,
        { stdio: "inherit" }                  # literal at +12379311
    )

    # 8. Handle spawn error
    if result.error:
        writeErrorFile("relaunch_spawn_error") # literal at +12379501
        process.exit(1)

    # 9. Exit with child's code (or 128+signal)
    exitCode = result.status ?? (128 + result.signal)  # 128 literal at +12379638
    process.exit(exitCode)                    # +12379525
```

Analysis basis: CC v2.1.165 bundle.js:+12655333 (entry into D0H), +12378504–+12379638 (full D0H body range)

---

### Session-state snapshot (R_ and Q$)

Before rebuilding args, the handler reads the current session state to recover fields that must survive the relaunch:

```
function captureSessionSnapshot(appState):
    lastMsg = appState.messages.findLast(...)    # A.findLast at +10916365
    workingDir   = lastMsg.working_directory     # literal at +10916390
    allowedTools = lastMsg.allowed_tools         # literal at +10916445
    disallowedTools = lastMsg.disallowed_tools   # literal at +10916500
    avoidPrompts = lastMsg.avoid_prompts         # literal at +10916561
    effort       = lastMsg.effort                # literal at +10916885
    model        = lastMsg.model                 # literal at +10916898
    maxThinkingTokens = lastMsg.max_thinking_tokens  # literal at +10916910
    flagSettings = lastMsg.flag_settings         # literal at +10916936
    return snapshot
```

Analysis basis: CC v2.1.165 bundle.js:+12655396 (R_ call), +12655402 (Q$ call)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_update_refused` (emitted when update is blocked by non-interactive mode, +12653974) |
| appState reads | Reads background-task list (`Object.values`, +12654197); reads session working directory; reads flag settings via `_.getAppState` (+12654826) |
| appState writes | Writes updated state via `_.setAppState` (+12654980) before relaunch |
| SDK bridge | `O.writeSdkMessages` → `O.flush` (2 000 ms) → `O.teardown` — bridge is fully shut down before exec |
| Signal handlers | All existing process listeners removed (`process.removeAllListeners`, +12379219); SIGINT/SIGHUP pass-throughs registered (+12379249) |
| File system | On spawn error: error record written to disk via `upH.writeFileSync` / `Gc8.join` (+12379501); `--resume` flag written via `bJ` |
| Process image | Replaced via `K6K.spawnSync` with `stdio: "inherit"` — current PID does **not** survive |
| Analytics drain | Up to 30 000 ms wait for analytics flush, then a secondary 500 ms window |
| Sound | None detected in depth-2 traversal |
| Hook registration | `d4A` appends a "last-prompt" entry (`_.appendEntry`, +13182593); `j9` registers via `zXA.register` (+60323) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.165 | Initial analysis |

---

## Common Mistakes

1. **Running `/update` during active background tasks** — The command will refuse with the literal message "Cannot /update while background tasks are running — wait for them to finish, then try again." Wait for all background tasks to reach a terminal state before invoking `/update`.

2. **Running `/update` in a resumed cross-directory session** — If the session was resumed from a project directory different from the one that originally started it, `/update` is blocked. The user must restart manually with `--resume` from the correct directory.

3. **Expecting the command to be visible in the slash-command menu** — `isHidden: true` means `/update` does not appear in autocomplete or help listings; it must be typed explicitly.

4. **Running `/update` in non-interactive (scripted/SDK) mode** — `supportsNonInteractive: false` combined with the non-interactive guard causes an immediate refusal and `tengu_update_refused` telemetry emission; the update is silently skipped.

5. **Assuming the current process survives the update** — The relaunch replaces the process image via `spawnSync` + `process.exit`; any in-memory state not persisted before the exec is lost. The conversation is preserved only because the session is written to disk and `--resume` is injected into the new invocation.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `ZCf` | Main async handler for `/update` (Arbor-resolved entry point) |
| `ZC8` | Binary / install-path resolver (calls `Bun.which("claude")`) |
| `uM` | PATH lookup helper (wraps `Bun.which`) |
| `MvA` | Which-command wrapper (invokes `Bun.which`) |
| `NS` | Versioned install-directory path builder |
| `WZ8` | Versions sub-directory path assembler |
| `K3` | Array normalisation helper (uses `Array.isArray`) |
| `H5H` | XDG `.local/share` path joiner |
| `i28` | Home-directory resolver (wraps `O8q.homedir`) |
| `H1H` | Binary (`bin/`) sub-path joiner |
| `Z9` | Background-style detector (checks `"bg"`, `"daemon"`, `"daemon-worker"`) |
| `GYH` | Background-mode classification helper |
| `c` | General utility / context accessor |
| `aj` | Executable basename resolver (uses `k2.basename`) |
| `S6` | Generic async spawner / runner |
| `uv` | Low-level process runner primitive |
| `Uk` | App-state accessor helper |
| `IKA` | Install-directory resolver (uses `M6K.dirname`) |
| `X_` | Path utility wrapper |
| `K4` | Secondary path utility wrapper |
| `b9H` | Pre-relaunch state serialiser |
| `Le` | Hook/attachment filter (checks `dFf.has`) |
| `_x8` | Hook type checker |
| `d4A` | Last-prompt entry appender (uses `_.appendEntry`) |
| `d4` | Hook registration dispatcher |
| `j9` | Event-queue registration (wraps `zXA.register`) |
| `_` | App-state store (provides `getAppState` / `setAppState` / `appendEntry`) |
| `kH` | Error-logging / error-queue manager |
| `HA` | Error constructor helper |
| `eH` | String coercion utility |
| `Dq` | Network-traffic-mode selector |
| `xSA` | Traffic-mode resolver |
| `qW4` | Error-queue ring-buffer manager (shift/push) |
| `wT` | Pre-relaunch app-state writer |
| `O` | SDK bridge object (`writeSdkMessages`, `flush`, `teardown`) |
| `b8` | SDK bridge backing store |
| `h9K` | UUID generator (wraps `TC8.randomUUID`) |
| `yL` | Generic timeout-race helper (uses `Promise.race`, `setTimeout`, `clearTimeout`) |
| `UwH` | Argument string coercer |
| `D0H` | Relaunch orchestrator (stat → flush → spawnSync → exit) |
| `D06` | Interval-clearing helper (wraps `clearInterval`) |
| `XS_` | Interval stop utility |
| `JyH` | Terminal unmount / UI teardown helper |
| `H` | UI renderer / unmount coordinator |
| `v` | Terminal capability / colour-mode detector |
| `e$` | Render state helper |
| `Gw_` | String-splitting / trimming helper |
| `ZHH` | Character-set membership checker |
| `uj` | String replacement helper |
| `e1` | Render-sequence helper |
| `s6` | Context-aware renderer |
| `DC` | Post-unmount cleanup step |
| `U48` | Terminal raw-write helper (uses `Aa.writeSync`) |
| `SvH` | Terminal version checker (Ghostty / iTerm) |
| `TvH` | Terminal feature probe |
| `bW` | tmux / screen escape-sequence handler |
| `K$` | Terminal state snapshot helper |
| `mO8` | Scroll-summary renderer |
| `qE` | Scroll metrics helper |
| `xZ9` | Scroll position calculator |
| `bZ9` | Scroll timing calculator (uses `Date.now`, `Math.max`, `Math.round`) |
| `RZ9` | Scroll rendering helper |
| `M1` | Fullscreen / local-agent display manager |
| `L2_` | String coercion layer for display |
| `mo` | Display-mode sub-handler |
| `K2_` | Platform (Windows) detection helper |
| `e_` | Display utility |
| `JNL` | Amber-creek display path |
| `D6` | Pewter-brook / render dispatcher |
| `ET` | Hook-drain helper (calls `d4`) |
| `OpH` | Event-queue drainer (wraps `zXA.drain`) |
| `pO8` | Analytics-flush orchestrator |
| `l8` | Async-timeout / abort helper |
| `K` | Process-list padding helper |
| `q` | File-unlink / cleanup helper |
| `L` | Promise-tracking set manager |
| `A6K` | Native-library loader and `execve` dispatcher |
| `f` | Native module / FFI handle |
| `A` | Process registry map |
| `$` | Pending-process set |
| `NKK` | Process-roster entry builder |
| `w` | Worker / background-session manager |
| `b` | Background-session subprocess handle |
| `RH` | Resource-usage reporter (ok path) |
| `hH` | Resource-usage reporter (bad path) |
| `vb8` | Low-memory event emitter |
| `zX6` | Package-JSON reader for background processes |
| `g` | Process-lifecycle manager (kill / retire) |
| `VDA` | Daemon socket connector |
| `hDA` | Background-session lifecycle manager |
| `D` | Forced-shutdown handler (calls `process.exit`) |
| `v8` | Version string accessor |
| `P6` | Progress renderer |
| `F` | Disposable resource wrapper |
| `M` | MCP connection manager (`execve` entry; dispatches `AbH` and `eU8`) |
| `AbH` | MCP client connection builder |
| `eU8` | MCP update applier |
| `IYA` | MCP remote-server retry manager |
| `z` | Daemon stop coordinator |
| `Yh` | Daemon control-event emitter |
| `Tp` | Daemon shutdown race helper |
| `EH` | Error-string formatter |
| `bJ` | Relaunch-error file writer |
| `dR8` | Full CLI argument reconstructor |
| `I46` | Argument-flag inspector |
| `y6` | Config file watcher |
| `Q6` | Config path resolver |
| `kX_` | Config key normaliser |
| `bDH` | Config file reader / backup manager |
| `B6` | JSON parser wrapper |
| `Ix` | Version-string prefix stripper |
| `Or1` | Config directory scanner |
| `bX_` | Backup-path joiner |
| `WTL` | File-watch registration helper |
| `No` | Watch-event dispatcher |
| `R_` | Session-state snapshot extractor (reads `working_directory`, `allowed_tools`, etc.) |
| `pk8` | `allowed_tools` / `disallowed_tools` snapshot builder |
| `L1` | Tool-list normaliser |
| `Uk8` | `avoid_prompts` snapshot builder |
| `Q$` | Flag-settings snapshot extractor |