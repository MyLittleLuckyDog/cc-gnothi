---
type: feature-spec
feature: "update"
cc_version: "2.1.185"
updated: "2026-06-21"
tags: ["update", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.185 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/update`

> Analysis basis: CC v2.1.185 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.185

---

## Overview

The `/update` command upgrades Claude Code in-place to the latest installed version without terminating the current conversation. It performs a live hot-swap: the current process flushes pending work, tears down active I/O bridges, then performs an `execve`-style replacement of the running process with the newer binary, re-passing the original CLI arguments augmented with `--resume` so the session resumes immediately on the new version.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `update` |
| description | `Switch to the latest version (conversation continues)` |
| loc_byte | `12929955` |
| loc_byte_end | `12930196` |
| loc_line | `8550` |
| supportsNonInteractive | `false` |
| isHidden | `true` |
| module_id | `PLl` |
| load_inline | `true` |
| arbor_handler.name | `Fcf` |
| arbor_handler.fqn | `claude-2.1.185::Fcf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.185 bundle.js:+12929955

---

## Input Branching

The handler contains 4+ distinct branches (background-work guard, directory-mismatch guard, preflight checks, and the relaunch path), so a flowchart is used.

```mermaid
flowchart TD
    A(["/update invoked"]) --> B{Background work\nrunning or pending?}
    B -->|Yes| C[Emit tengu_update_refused\nReturn error message:\n'Cannot /update while work is running…']
    B -->|No| D{Session resumed from\na different project directory?}
    D -->|Yes| E[Return error message:\n'Cannot /update — this session was resumed…']
    D -->|No| F[Resolve current binary path\nvia executablePath helper]
    F --> G[Stat the binary to confirm\nit exists on disk]
    G -->|Stat fails| H[Return error / abort]
    G -->|OK| I[Collect original CLI args\nAppend --resume + session flags]
    I --> J[Append --add-dir entries\nfor any extra watched directories]
    J --> K[Append forwarded flags:\n--allow-dangerously-skip-permissions\n--effort  --permission-mode]
    K --> L[Emit 'Switching to latest Claude Code… reconnecting'\nto conversation UI]
    L --> M[Write SDK messages / flush bridge\nwith 2000 ms timeout]
    M --> N[Generate new session UUID\nvia randomUUID]
    N --> O[Flush analytics with 30 000 ms timeout\nlabeled 'flush timeout (relaunch)']
    O --> P[Tear down UI renderer\nand clear terminal intervals]
    P --> Q[Drain event bus\nwith 30 000 ms 'cleanup timeout']
    Q --> R[Flush analytics again\nwith 'analytics flush timeout']
    R --> S[Remove all process signal listeners\nRe-register SIGINT / SIGHUP pass-throughs]
    S --> T[Invoke STl: prepare execve environment\nLoad libc via bun:ffi\nPass env vars + new argv]
    T --> U[Call a.execve — replace process image\nwith latest Claude Code binary]
    U --> V([New process starts with --resume;\nconversation continues])
```

---

## Behavioral Spec

### 1. Guard — Background Work Check

The handler's first action is to inspect all active background task states. It iterates `Object.values` over the background-task registry and checks whether any task is in the `"running"` or `"pending"` state.

```
function checkBackgroundWork(taskRegistry):
    states = Object.values(taskRegistry)
    for state in states:
        if state == "running" or state == "pending":
            emit telemetry("tengu_update_refused")
            return ErrorMessage(
                "Cannot /update while work is running in the background — " +
                "wait for it to finish, then try again."
            )
    return OK
```

Analysis basis: CC v2.1.185 bundle.js:+12927851 (telemetry), +12928112, +12928134 (literals), +12928215 (error string)

---

### 2. Guard — Directory Mismatch Check

If the session was previously resumed via `--resume` but the working directory recorded at session start no longer matches the current process working directory, the update is blocked.

```
function checkDirectoryMismatch(appState, currentCwd):
    resumedDir = appState.working_directory
    if resumedDir is set and resumedDir != currentCwd:
        return ErrorMessage(
            "Cannot /update — this session was resumed from a different " +
            "project directory. Restart manually with --resume to continue " +
            "on the latest version."
        )
    return OK
```

Analysis basis: CC v2.1.185 bundle.js:+12928459 (literal error string), +10852992 (`working_directory` key)

---

### 3. Binary Resolution

The handler resolves the path to the currently running `claude` executable, using an `executablePath` helper (`AT`) which calls `fb.basename` and walks up the filesystem. The path through `~/.local/share/versions/` and a `bin` subdirectory confirms this is the locally installed version layout.

```
function resolveBinaryPath():
    exePath = getExecutablePath()          // uses fb.basename + path traversal
    return exePath
```

Analysis basis: CC v2.1.185 bundle.js:+12927999 (`AT` call), +4284937 (`fb.basename`), +7011870 (`.local`), +7011879 (`share`), +8493185 (`versions`), +7011950 (`bin`)

---

### 4. Argument Vector Construction

The new argument vector is assembled from the current process's original CLI invocation, then augmented.

```
function buildNewArgv(originalArgs, sessionId, appState):
    argv = Array.from(originalArgs)

    // Always append --resume
    argv.push("--resume", sessionId)

    // Forward --add-dir entries for every extra watched directory
    for dir in extraDirectories:
        argv.push("--add-dir", dir)

    // Forward optional flags if they were present in the original invocation
    if originalArgs.includes("--allow-dangerously-skip-permissions"):
        argv.push("--allow-dangerously-skip-permissions")
    if effortFlag is set:
        argv.push("--effort", effortValue)
    if permissionModeFlag is set:
        argv.push("--permission-mode", permissionModeValue)

    return argv
```

Analysis basis: CC v2.1.185 bundle.js:+12663363 (`--resume`), +12664887 (`--add-dir`), +12665002 (`--allow-dangerously-skip-permissions`), +12665144 (`--effort`), +12665161 (`--permission-mode`), +12664712 (`Array.from`)

---

### 5. Session State Snapshot

Before relaunch, the handler reads `appState` for session-level settings that must survive the process boundary: `allowed_tools`, `disallowed_tools`, `avoid_prompts`, `permission_mode`, `bypassPermissions`, `effort`, `model`, `max_thinking_tokens`, `flag_settings`.

```
function snapshotSessionState(appState):
    snapshot = {
        allowed_tools:      appState.allowed_tools,
        disallowed_tools:   appState.disallowed_tools,
        avoid_prompts:      appState.avoid_prompts,
        permission_mode:    appState.permission_mode,
        bypassPermissions:  appState.bypassPermissions,
        effort:             appState.effort,
        model:              appState.model,
        max_thinking_tokens: appState.max_thinking_tokens,
        flag_settings:      appState.flag_settings,
    }
    return snapshot
```

Analysis basis: CC v2.1.185 bundle.js:+10853047, +10853102, +10853163, +10853265, +10853296, +10853620, +10853633, +10853645, +10853671

---

### 6. UI Notification and Bridge Flush

The command emits a user-visible notification message — `"Switching to latest Claude Code… reconnecting"` — appended to the conversation as a `text`-type content block. It then flushes the SDK bridge with a 2000 ms deadline.

```
function notifyAndFlush(conversationBridge):
    appendMessage(role="assistant", content=[
        { type: "text", text: "Switching to latest Claude Code… reconnecting" }
    ])
    await flushWithTimeout(conversationBridge, timeoutMs=2000, label="bridge flush")
```

Analysis basis: CC v2.1.185 bundle.js:+12928944 (literal), +12929024 (2000 ms), +12929029 (`bridge flush`)

---

### 7. Teardown Sequence

```
function teardown(bridge, uiRenderer, eventBus):
    // 1. Flush bridge (done above)
    await bridge.flush()

    // 2. Tear down bridge
    await bridge.teardown()

    // 3. Clear UI renderer intervals and unmount terminal output
    stopIntervals(uiRenderer)          // clearInterval via HNt/hJr
    unmountTerminal(uiRenderer)        // e.unmount via k3e

    // 4. Drain event bus with timeout
    await withTimeout(eventBus.drain(), 30000, "cleanup timeout")

    // 5. Final analytics flush
    await withTimeout(analyticsFlush(), 30000, "analytics flush timeout")
```

Analysis basis: CC v2.1.185 bundle.js:+12929065 (`teardown`), +12929014 (`flush`), +12663430 (30 000 ms), +12663436 (`flush timeout (relaunch)`), +12663492 (`cleanup timeout`), +12663548 (`analytics flush timeout`)

---

### 8. Signal Re-registration

Before calling `execve`, the process removes all existing signal listeners and re-registers minimal pass-through handlers for `SIGINT` and `SIGHUP` to avoid stale handlers interfering with the new image.

```
function resetSignalHandlers():
    process.removeAllListeners()
    process.on("SIGINT",  () => {})
    process.on("SIGHUP",  () => {})
```

Analysis basis: CC v2.1.185 bundle.js:+12663932 (`SIGINT`), +12663922 (`SIGHUP`), +12663932, +12663962 (`process.on`)

---

### 9. Execve Replacement (relaunchWithExecve)

The core relaunch mechanism (`STl`) uses Bun's FFI (`bun:ffi`) to load the platform C library and call `execve` directly, replacing the current process image with the new binary while preserving the environment. On macOS it loads `/usr/lib/libSystem.B.dylib`; on Linux it loads `libc.so.6`.

```
function relaunchWithExecve(binaryPath, argv, env):
    lib = loadFFI("bun:ffi", platform == "macos"
                   ? "/usr/lib/libSystem.B.dylib"
                   : "libc.so.6",
                  symbols={ execve: { args: ["ptr","ptr","ptr"], returns: "int" } })

    pathBuf  = Buffer.from(binaryPath + "\0", "utf8")
    argvBufs = argv.map(a => Buffer.from(a + "\0", "utf8"))
    envBufs  = Object.entries(env).map(([k,v]) => Buffer.from(k+"="+v+"\0","utf8"))

    lib.execve(pathBuf.ptr, ptrArray(argvBufs), ptrArray(envBufs))
    // If execve returns, something went wrong; write error state and exit
    writeErrorFile("relaunch_spawn_error")
    process.exit(128)
```

Analysis basis: CC v2.1.185 bundle.js:+12662467 (`bun:ffi`), +12662503 (`macos`), +12662511 (`/usr/lib/libSystem.B.dylib`), +12662540 (`libc.so.6`), +12662594 (`int`), +12662622 (`Buffer.from`), +12662643 (`utf8`), +12662866 (`a.execve`), +12664214 (`relaunch_spawn_error`), +12664351 (exit code 128)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_update_refused` | Fired when background work is running or pending, blocking the update (bundle.js:+12927851) |
| Telemetry — `tengu_scroll_summary` | Fired during UI teardown scroll-summary phase (bundle.js:+7195490) |
| Telemetry — `tengu_amber_creek` | Fired in terminal fullscreen state handler (bundle.js:+3545521) |
| Telemetry — `tengu_pewter_brook` | Fired in terminal fullscreen state handler (bundle.js:+3545429) |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Fired if background session required SIGKILL during teardown (bundle.js:+17275024) |
| Telemetry — `tengu_scheduled_task_missed` | Fired if a scheduled task was missed during teardown (bundle.js:+16742322) |
| Telemetry — `tengu_feature_bad` / `tengu_feature_ok` | Feature-flag validation events (bundle.js:+1021954, +1021887) |
| Telemetry — `tengu_bg_low_mem_mb` / `tengu_bg_dispatch_low_mem` | Low-memory signals during daemon interaction (bundle.js:+13292201, +17275625) |
| Telemetry — `tengu_bg_spare_enable` / `tengu_bg_spare_claim` / `tengu_bg_spare_claim_fail` | Background spare-session pool events (bundle.js:+17276322, +17276450, +17276716) |
| Telemetry — `tengu_bg_sendclaim_failed` | Background claim send failure (bundle.js:+17251556) |
| Telemetry — `tengu_daemon_control` | Daemon start/stop lifecycle event (bundle.js:+17311865) |
| Telemetry — `tengu_config_parse_error` | Configuration parse error during arg reconstruction (bundle.js:+13969321) |
| Telemetry — `tengu_disable_bypass_permissions_mode` | Bypass-permissions mode disabled warning (bundle.js:+3386129) |
| appState changes | `getAppState` called to read session config; `setAppState` called to record the pending relaunch state before teardown (bundle.js:+12928719, +12928834) |
| SDK message flush | `l.writeSdkMessages` is called to commit in-flight messages before teardown (bundle.js:+12928920) |
| Bridge teardown | `l.flush` then `l.teardown` are called in sequence (bundle.js:+12929014, +12929065) |
| UUID generation | A fresh session UUID is generated via `crypto.randomUUID` (`MLl`/`Sjt.randomUUID`) to tag the resumed session (bundle.js:+12928940, +12926819) |
| Signal handlers | All listeners removed; SIGINT + SIGHUP re-registered (bundle.js:+12663932, +12663962) |
| Process replacement | `execve` syscall replaces process image; exit code 128 written on failure (bundle.js:+12662866, +12664351) |
| Hook system | `qi` / `B2o.register` and `GCo` / `t.appendEntry` are invoked to record the `"last-prompt"` entry in hook history before relaunch (bundle.js:+12928679, +13467325) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.185 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/update` while background tasks are active.** The command immediately refuses with an explicit error if any background task is in the `"running"` or `"pending"` state. Wait for all background work to complete first.

2. **Expecting `/update` to work after `--resume` from a different directory.** If the session was resumed and the working directory changed, the command blocks and instructs the user to restart manually with `--resume`. This is by design to avoid a directory-context mismatch in the relaunched process.

3. **Treating `/update` as interactive.** The `supportsNonInteractive: false` registration flag means the command is not intended for use in non-interactive (pipe/script) mode. It requires a live terminal context for the teardown and execve sequence.

4. **Assuming `/update` is publicly listed.** The `isHidden: true` flag means `/update` does not appear in help output or command autocompletion menus; it must be typed explicitly.

5. **Expecting an immediate restart.** The teardown sequence involves up to two 30 000 ms timeout windows (flush and cleanup) plus a 2000 ms bridge flush, so the process may take several seconds before exec-replacing itself.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Fcf` | Main async handler for `/update` (arbor_handler; resolved via module_id `PLl`) |
| `$Vn` | Background-work state checker (checks `running`/`pending` states) |
| `_A` | Binary executable path resolver (calls `Fqo` / `Bun.which`) |
| `Fqo` | `Bun.which` wrapper for locating `claude` binary |
| `s$` | Version directory path builder (resolves `~/.local/share/versions/`) |
| `BUn` | Versions directory path constructor |
| `HA` | Array.isArray helper used in path construction |
| `Whe` | Home-directory path segment builder (calls `ekn` / `Hia.homedir`) |
| `ekn` | Home directory reader via `os.homedir` |
| `Jae` | Bin-directory path segment builder |
| `Hi` | Process role/context checker (validates not running as `bg`/`daemon`/`daemon-worker`) |
| `uNe` | Underlying process-role lookup used by `Hi` |
| `j` | Logging/output helper (used throughout) |
| `AT` | Executable basename path resolver (`fb.basename` + depth 8) |
| `Lt` | Terminal text rendering helper (`gx`) |
| `gx` | Core terminal output primitive |
| `eO` | File-stat / path existence check utility |
| `xIo` | Path-manipulation helper used in relaunch preparation (`vTl.dirname`) |
| `Ar` | Inner path helper used by `xIo` |
| `Ec` | Secondary path helper used by `xIo` |
| `Rue` | Session resumption flag reader |
| `Nne` | Hook/attachment type checker (`Czn`, `dHf.has`) |
| `Czn` | Attachment type enum/set |
| `GCo` | Hook history recorder (appends `last-prompt` entry, calls `t.appendEntry`) |
| `Au` | Hook registration helper (calls `qi`) |
| `qi` | Event-bus / hook register (`B2o.register`) |
| `De` | Log-error / telemetry dispatcher (`Ho`, `st`, `ra`, `Bzc`, `QJ.logError`) |
| `Ho` | Error object factory |
| `st` | String coercion utility |
| `ra` | Telemetry routing helper |
| `eJo` | Inner telemetry string formatter |
| `Bzc` | Ring-buffer log management (shift/push on `Ven`) |
| `em` | AsyncLocalStorage context reader (`Rx`) |
| `Rx` | Store getter (`Xvr.getStore`) |
| `bE` | Session directory / project config accessor |
| `l` | SDK message-bus object (provides `writeSdkMessages`, `flush`, `teardown`) |
| `k0l` | SDK message writer implementation |
| `CQ` | Message content formatter |
| `vfe` | Message text trimmer (`t.trim`, 1000 ms threshold) |
| `ci` | AsyncLocalStorage session-store getter (`L0u.getStore`) |
| `Mjt` | Daemon status file path builder (`daemon.status.json`) |
| `Pe` | `JSON.stringify` wrapper |
| `MLl` | Session UUID generator (`Sjt.randomUUID`) |
| `uu` | Timeout-race utility (`Promise.race`, `setTimeout`, `clearTimeout`) |
| `eIe` | Animation/feature-flag check (`Ani.isEnabled`) |
| `UCe` | String coercion helper used in arg building |
| `zDe` | Full relaunch orchestrator (stat binary → teardown → execve) |
| `HNt` | Interval-clear helper for UI renderer (`hJr` / `clearInterval`) |
| `hJr` | `clearInterval` wrapper |
| `k3e` | Terminal UI unmount helper (`nge.writeSync`, `e.unmount`) |
| `fF` | Terminal cleanup utility |
| `MEn` | Terminal output writer (`OZ.writeSync`, escape sequences `\x1b7`/`\x1b8`) |
| `o$e` | Terminal emulator version checker (Ghostty 1.2.0 / iTerm 3.6.6) |
| `JFe` | Terminal write helper |
| `EL` | tmux/screen escape sequence handler (`e.replaceAll`) |
| `Gp` | Terminal state helper |
| `T` | Terminal log / debug formatter (checks `debug`, `toUpperCase`, trim) |
| `dDn` | Scroll-summary dispatcher (`Hca`, `Os`) |
| `zw` | Scroll position tracker |
| `_ca` | Scroll summary state |
| `Hca` | Frame timing calculator (`Date.now`, `Math.max`, `Math.round`, `Object.assign`) |
| `hca` | Frame update helper |
| `Os` | Terminal rendering orchestrator (`L2`, `tM`, `_Z`, `RFr`, `Gr`, `ved`, `ct`) |
| `L2` | Feature-flag gate (`zqc.has`) |
| `tM` | Animation-enabled check (`Ani.isEnabled`) |
| `PFr` | String primitive formatter |
| `_Z` | Terminal cell renderer (`Ced`) |
| `RFr` | Boolean/zt renderer |
| `Gr` | Render-group helper (`_j`) |
| `ved` | Variant renderer |
| `ct` | Core terminal render cell (`wxt`, `Lxt`, `I4`, `pIe.has`, `OHn`, `Cxt.add`) |
| `nD` | Analytics/hook flush helper (calls `Au`) |
| `XWe` | Event-bus drain (`B2o.drain`) |
| `M3e` | Post-teardown cleanup (`Promise.resolve`, `cDn`) |
| `cDn` | Cleanup continuation |
| `STl` | Execve environment builder (loads bun:ffi, calls `a.execve`) |
| `i` | FFI library handle |
| `n` | FFI name normalizer (`i.toLowerCase`) |
| `r` | FFI resource handle |
| `s` | FFI operation tracking set (`r.add`, `r.delete`) |
| `f` | Background session supervisor loop |
| `M` | Background session task runner (`Dtt`, `CQ`, `CMt`, `Date.now`) |
| `Bn` | Promise timeout race helper |
| `Re` | Session creation telemetry emitter (`tengu_feature_ok`) |
| `ke` | Session failure telemetry emitter (`tengu_feature_bad`) |
| `YKn` | Low-memory threshold checker (`zt`, `ct`) |
| `B$e` | Temporary file cleaner (`fT.lstat`, `fT.rm`, `fT.readFile`) |
| `$` | Permission-policy classifier (`zlt`, `R6`) |
| `NNo` | Background socket connector (`zq.claim`, `xZn.connect`, `i.on`, `i.once`, `i.write`) |
| `jNo` | Background session lifecycle manager (handles done/killed/stopped/failed/crashed/blocked/working states) |
| `p` | Forced shutdown handler (`process.exit`, `u.abort`) |
| `dn` | Debounce/delay utility |
| `Ue` | Process-exit wrapper (`ogt`) |
| `R` | Disposable resource handle |
| `c` | Connection container (`Tn`) |
| `Tn` | Background session name constant (`background session`) |
| `a` | Execve caller (wraps `n3e`, `uZn`, `mta`, `B1o`) |
| `n3e` | MCP server connection initializer (stdio/sse/http/sse-ide/ws-ide) |
| `uZn` | MCP connection result applier (`e.applyMcpUpdate`) |
| `mta` | MCP state serializer (`Szr`) |
| `B1o` | MCP client orchestrator (`t.getClients`, `jLn`, `n3e`, `uZn`) |
| `u` | Daemon stop orchestrator (`ke`, `Re`, `rF`, `SG`) |
| `rF` | Daemon stop event recorder (`T4`, `yz.push`, `gFe`, `MNr`) |
| `SG` | Daemon stop race (`Promise.race`, `Promise.all`, `process.exit`) |
| `Ee` | String coercion wrapper |
| `eI` | Error-state file writer (`Nre.writeFileSync`, path join) |
| `pVn` | Argv reconstruction helper (`Array.from`, `XRe`, `r_n`, `r.includes`, `n.flatMap`) |
| `XRe` | Arg-filter predicate |
| `r_n` | Arg-transform helper (`Ct`, `Boolean`) |
| `Ct` | Config backup/snapshot utility (`jt`, `vx`, `Hko`, `q_e`, `Ebf`) |
| `jt` | Config path resolver |
| `Hko` | Config key set |
| `q_e` | Config file reader/copier (`r.readFileSync`, `r.statSync`, `r.copyFileSync`) |
| `Ebf` | Config file watcher (`B7n.watchFile`, `B7n.unwatchFile`) |
| `Fr` | Session context reconstructor (`e.getAppState`, `n.findLast`, `b6n`, `T6n`, `mB`) |
| `b6n` | Allowed-tools session field reader |
| `ms` | Message-store accessor |
| `T6n` | Disallowed-tools session field reader |
| `mB` | Session render helper (`ct`, `ts`) |
| `Fh` | App-state accessor for session resumption check |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.