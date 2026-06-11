---
type: feature-spec
feature: "update"
cc_version: "2.1.168"
updated: "2026-06-11"
tags: ["update", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.168 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/update`

> Analysis basis: CC v2.1.168 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.168

---

## Overview

`/update` performs an in-process hot-swap to the latest installed version of Claude Code while keeping the current conversation alive. It resolves the new binary path, validates that preconditions are met (no background tasks running, no cross-directory session resume), tears down the current runtime, and relaunches via `execve` so the new version inherits the same terminal session and conversation state.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `update` |
| description | `Switch to the latest version (conversation continues)` |
| supportsNonInteractive | `false` |
| isHidden | `true` |
| module_id | `WKK` |
| load_inline | `true` |
| loc_byte | `12690247` |
| loc_byte_end | `12690488` |
| loc_line | `9083` |
| arbor_handler.name | `exf` |
| arbor_handler.fqn | `claude-2.1.168::exf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.168 bundle.js:+12690247

---

## Input Branching

The handler (`exf`) has five distinct guard branches before the actual relaunch executes.

```mermaid
flowchart TD
    A["/update invoked"] --> B{Locate 'claude' binary\nvia packageManager resolver}
    B -->|binary not found| C[Emit tengu_update_refused\nReturn early with error]
    B -->|binary found| D{Background tasks\nin 'running' or 'pending' state?}
    D -->|yes| E["Error: Cannot /update while\nbackground tasks are running —\nwait for them to finish, then try again.\n(bundle.js:+12688517)"]
    D -->|no| F{Session resumed from\na different project directory?}
    F -->|yes| G["Error: Cannot /update — this session\nwas resumed from a different project\ndirectory. Restart manually with\n--resume to continue on the latest version.\n(bundle.js:+12688758)"]
    F -->|no| H[Snapshot conversation state\nand app state]
    H --> I[Display status message:\n'Switching to latest Claude Code… reconnecting'\n(bundle.js:+12689269)]
    I --> J[Flush bridge with 2000 ms timeout\n(bundle.js:+12689349)]
    J --> K[Tear down output stream,\nunmount UI, flush analytics]
    K --> L[Build relaunch argv\nwith --resume and session flags]
    L --> M[spawnSync new process\nthen execve to replace current process]
    M --> N[New version inherits terminal\nand conversation continues]
```

---

## Behavioral Spec

### 1. Binary Resolution

The handler begins by calling the package-manager resolver (`Bb8`) to locate the `claude` binary. Internally this delegates to `binaryLocator` (`BM`) which calls `Bun.which` to find the executable on `PATH`.

```
function resolveBinary():
    candidate = packageManagerResolver("claude")   # calls Bun.which internally
    if candidate is null or empty:
        emit telemetry("tengu_update_refused")
        return ABORT
    return candidate
```

Analysis basis: CC v2.1.168 bundle.js:+12688053, +12688056

### 2. Version-Path Construction

`versionPathBuilder` (`iS`) computes the path to the versioned binary using `homedir` and a `~/.local/share/versions/…/bin` layout.

```
function versionPathBuilder(packageArgs):
    baseDir = homeDirectory()               # p_q.homedir()
    versionsDir = path.join(baseDir, ".local", "share", "versions")
    # joins with package-specific sub-path and "bin"
    return path.join(versionsDir, …, "bin")
```

Analysis basis: CC v2.1.168 bundle.js:+12688106, +7990527, +7990536, +7990607

### 3. Precondition Guards

```
function checkPreconditions(appState, argv):
    # Guard 1 — background tasks
    taskStates = Object.values(appState.tasks)
    if any task.state in ["running", "pending"]:
        return ERROR("Cannot /update while background tasks are running — wait for them to finish, then try again.")

    # Guard 2 — cross-directory resume
    if sessionWasResumedFromDifferentDirectory(argv):
        return ERROR("Cannot /update — this session was resumed from a different project directory. Restart manually with --resume to continue on the latest version.")

    return OK
```

Analysis basis: CC v2.1.168 bundle.js:+12688376, +12688414, +12688436, +12688517, +12688758

### 4. State Snapshot and Status Notification

Before teardown the handler reads the current app state (`_.getAppState`), records the last assistant-turn message prefix (`"assistant-"` marker), and sets a transitional app state (`_.setAppState`) that surfaces the reconnecting message to the UI.

```
function snapshotAndNotify(outputBridge):
    state = getAppState()
    outputBridge.writeSdkMessages([{
        type: "text",
        content: "Switching to latest Claude Code… reconnecting"
    }])
    newUUID = generateRandomUUID()          # Ub8.randomUUID()
    setAppState({ …state, reconnecting: true, uuid: newUUID })
```

Analysis basis: CC v2.1.168 bundle.js:+12689005, +12689084, +12689159, +12689245, +12689265, +12689269

### 5. Bridge Flush with Timeout

`timedFlush` (`IL`) races the bridge flush against a 2000 ms deadline before proceeding to teardown. This prevents the update from hanging indefinitely if the output bridge is stuck.

```
async function timedFlush(bridge, label):
    timer = setTimeout(resolve, 2000)       # 2000 ms (bundle.js:+12689349)
    await Promise.race([
        bridge.flush(),
        timerPromise
    ])
    clearTimeout(timer)
    # label = "bridge flush" (bundle.js:+12689354)
```

Analysis basis: CC v2.1.168 bundle.js:+12689336, +12689339, +12689349, +12689354

### 6. Runtime Teardown

`runtimeTeardown` (`d0H`) is the central shutdown orchestrator. It:

1. Unmounts the UI renderer (`oyH` → `H.unmount`).
2. Stops the spinner/progress display (`_G6` → `xR_` → `clearInterval`).
3. Writes final output to stdout (`cL8` → `Ea.writeSync`).
4. Races parallel cleanup tasks against a 30 000 ms flush timeout and a separate analytics flush timeout.
5. Drains the NPA event pipeline (`ipH` → `NPA.drain`).
6. Removes all existing signal handlers (`process.removeAllListeners`) and re-registers minimal handlers for `SIGINT` and `SIGHUP` with `"inherit"` stdio, then `beforeExit` / `exit`.

Flush timeout: 30 000 ms (bundle.js:+12413167), label `"flush timeout (relaunch)"`.
Analytics flush timeout label: `"analytics flush timeout"` (bundle.js:+12413285).
Cleanup timeout label: `"cleanup timeout"` (bundle.js:+12413229).

```
async function runtimeTeardown(context):
    stopSpinner()
    unmountUI()
    writeRemainingOutput()
    await Promise.race([
        Promise.all([flushAllSystems(), drainAnalytics()]),
        timeout(30000, "flush timeout (relaunch)")
    ])
    drainNPA()
    process.removeAllListeners()
    process.on("SIGINT",  inheritHandler)
    process.on("SIGHUP",  inheritHandler)
    process.on("beforeExit", exitHandler)
    process.on("exit",    exitHandler)
```

Analysis basis: CC v2.1.168 bundle.js:+12413048, +12413100, +12413146, +12413159, +12413167, +12413218, +12413229, +12413285, +12413669, +12413699

### 7. Argv Construction for Relaunch

`buildRelaunchArgv` (`fb8`) assembles the argument list for the new process. It starts from `Array.from` of the current process argv, appends `--resume` with the current session ID, forwards any `--add-dir` arguments from the original invocation, and conditionally adds `--allow-dangerously-skip-permissions`, `--effort`, and `--permission-mode` flags based on active settings.

```
function buildRelaunchArgv(currentArgv, sessionState, settings):
    args = Array.from(currentArgv)
    args.push("--resume", sessionState.id)      # "session" type (bundle.js:+12414545)
    for dir in sessionState.addedDirs:
        args.push("--add-dir", dir)             # bundle.js:+12414624
    if settings.allowDangerouslySkipPermissions:
        args.push("--allow-dangerously-skip-permissions")
    if settings.effort:
        args.push("--effort", settings.effort)
    if settings.permissionMode:
        args.push("--permission-mode", settings.permissionMode)
    return args
```

Analysis basis: CC v2.1.168 bundle.js:+12689571, +12414449, +12414524, +12414545, +12414624, +12414793, +12414935, +12414952

### 8. Conversation State Forwarding

`conversationForwarder` (`b_`) reads the current app state, finds the last assistant message (`A.findLast`), and extracts `working_directory`, `allowed_tools`, `disallowed_tools`, `avoid_prompts`, `permission_mode`, and `bypassPermissions` fields to carry forward into the relaunched session.

`sessionFlagsReader` (`t$`) similarly reads the current app state for `effort`, `model`, `max_thinking_tokens`, and `flag_settings` to forward as argv.

Analysis basis: CC v2.1.168 bundle.js:+12689575, +12689581, +10944550, +10944630, +10944655, +10944710, +10944765, +10944826, +10944928, +10944959, +10945283, +10945296, +10945308, +10945334

### 9. Execve Relaunch

After `spawnSync` verifies the binary is executable, `nativeExecve` (`l8K`) performs the actual process replacement:

1. Resolves the absolute path (falling back to `process.cwd()` if relative).
2. Optionally opens the native FFI library (`bun:ffi`) — `libSystem.B.dylib` on macOS, `libc.so.6` on Linux — to access the `execve` syscall directly via `f.dlopen` / `f.ptr`.
3. Copies environment entries via `Object.entries`.
4. Calls `M.execve` to replace the current process image.

On error, writes a `"relaunch_spawn_error"` marker via `SJ` (`GUH.writeFileSync`) and exits with code `128`.

```
function nativeExecve(binaryPath, argv, env):
    absPath = isAbsolute(binaryPath) ? binaryPath : path.join(cwd(), binaryPath)
    lib = dlopen("bun:ffi", platform == "macos"
                    ? "/usr/lib/libSystem.B.dylib"
                    : "libc.so.6")
    envPairs = Object.entries(env).map(formatEnvEntry)
    result = lib.execve(absPath, argv, envPairs)
    if result != 0:
        writeErrorFile("relaunch_spawn_error")
        process.exit(128)
```

Analysis basis: CC v2.1.168 bundle.js:+12413528, +12413596, +12413602, +12413726, +12413948, +12413975, +12414040, +12412117, +12412159, +12412173, +12412196, +12412204, +12412227, +12412240, +12412248, +12412277, +12412359, +12412603

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_update_refused` | Fired when binary resolution fails or a precondition guard rejects the update (bundle.js:+12688153) |
| Telemetry — `tengu_feature_sad` | Fired by the output-bridge error path during teardown (bundle.js:+1011093) |
| Telemetry — `tengu_feature_bad` / `tengu_feature_ok` | Fired by background-task state tracking helpers (bundle.js:+1011012, +1010950) |
| Telemetry — `tengu_scroll_summary` | Fired by the scroll/animation teardown path (bundle.js:+5455982) |
| Telemetry — `tengu_amber_creek` / `tengu_pewter_brook` | Fired by display-mode detection during teardown (bundle.js:+3447047, +3446955) |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Fired by background-session signal escalation during teardown (bundle.js:+16197002) |
| Telemetry — `tengu_bg_low_mem_mb` / `tengu_bg_dispatch_low_mem` | Memory monitoring events in background-session teardown (bundle.js:+13052200, +16197603) |
| Telemetry — `tengu_bg_adopt_sock_unlinked` | Socket cleanup during daemon teardown (bundle.js:+13527482) |
| Telemetry — `tengu_bg_spare_enable` / `tengu_bg_spare_claim` / `tengu_bg_spare_claim_fail` | Spare-session lifecycle events (bundle.js:+16198307, +16198435, +16198701) |
| Telemetry — `tengu_bg_sendclaim_failed` | Background claim failure during teardown (bundle.js:+16176740) |
| Telemetry — `tengu_daemon_control` | Daemon stop/stop-failed events (bundle.js:+16233972) |
| Telemetry — `tengu_config_parse_error` | Config backup/migration error during new-version startup (bundle.js:+3268167) |
| Telemetry — `tengu_disable_bypass_permissions_mode` | Emitted when bypass-permissions mode is carried forward but then disabled (bundle.js:+4204612) |
| appState changes | `_.setAppState` marks the session as reconnecting; `_.getAppState` snapshot is taken before teardown |
| Output bridge | `O.writeSdkMessages` writes the reconnecting notice; `O.flush` (2 000 ms timeout) drains pending messages; `O.teardown` finalises the bridge |
| Signal handlers | All existing handlers removed via `process.removeAllListeners`; minimal `SIGINT`/`SIGHUP` handlers re-registered with `"inherit"` stdio |
| File system | On relaunch error: `GUH.writeFileSync` writes an error marker file; config backups written to a `backups/` subdirectory by the config-migration path |
| Process replacement | `M.execve` (native FFI) replaces the current process; the new process receives `--resume <sessionId>` plus forwarded flags |
| Hook registration | `NPA.register` / `NPA.drain` manage event-pipeline hooks during teardown; `_K8.watchFile` / `_K8.unwatchFile` manage config file watchers |
| Sound | None detected |

---

## Version History

| Version | Change |
|---|---|
| v2.1.168 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/update` with active background tasks.** The command hard-blocks with the message `"Cannot /update while background tasks are running — wait for them to finish, then try again."` Users should wait for all pending/running tasks to complete before issuing `/update`.

2. **Invoking `/update` after `--resume` across a different project directory.** If the current session was resumed from a directory that differs from the original, the command aborts with a message instructing the user to restart manually with `--resume`. There is no in-session workaround.

3. **Expecting the command to be visible in the help menu.** The registration sets `isHidden: true`, so `/update` does not appear in the autocomplete or slash-command list. It must be typed explicitly.

4. **Assuming `/update` works in non-interactive mode.** `supportsNonInteractive: false` means the command is only valid in an interactive terminal session.

5. **Confusing the 2 000 ms bridge-flush timeout with a hang.** The brief pause after entering `/update` before the terminal switches over is intentional — the bridge is draining buffered messages before the process is replaced.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `exf` | Main async handler for `/update` (Arbor-resolved entry point) |
| `Bb8` | Package-manager binary resolver (outer wrapper) |
| `BM` | Binary locator (calls `Bun.which`) |
| `PIA` | Path resolver helper used by binary locator |
| `iS` | Version-path builder (constructs `~/.local/share/versions/…/bin`) |
| `mV8` | Sub-path join utility for version directories |
| `X3` | Array normalization helper |
| `h5H` | Home-directory path helper (`.local/share`) |
| `K08` | Home-directory resolver (wraps `p_q.homedir`) |
| `V1H` | Bin-directory path helper |
| `J9` | Logger / telemetry emitter (calls `dYH`) |
| `dYH` | Underlying log sink |
| `l` | General logger utility |
| `aj` | Basename extractor / arg parser |
| `R6` | React/UI renderer helper |
| `tv` | Terminal/UI primitive |
| `Ky` | File-system stat utility |
| `l4A` | Directory-of-binary resolver |
| `W_` | Path resolution helper used by `l4A` |
| `$4` | Secondary path helper used by `l4A` |
| `_qH` | Session-resume directory checker |
| `ke` | Hook/attachment filter |
| `Eu8` | Hook entry-set accessor |
| `O7A` | Last-prompt recorder |
| `r4` | Conversation history accessor |
| `j9` | NPA event registrar |
| `_` | App-state / conversation store |
| `hH` | Output bridge / stream manager |
| `AA` | Error formatter |
| `_6` | String coercion utility |
| `$q` | Telemetry / traffic classifier |
| `dRA` | Traffic-mode helper |
| `DG4` | Ring-buffer manager (shift/push) |
| `TE` | Transitional-state setter |
| `O` | SDK output bridge object |
| `b8` | Bridge backing store |
| `XKK` | UUID generator (wraps `Ub8.randomUUID`) |
| `IL` | Promise-race timeout utility |
| `zjH` | String coercion wrapper |
| `d0H` | Runtime teardown orchestrator |
| `_G6` | Spinner/interval stopper |
| `xR_` | `clearInterval` wrapper |
| `oyH` | UI unmount + stdout flush helper |
| `H` | UI renderer / bootstrap fetcher (context-dependent) |
| `v` | Debug/log formatter |
| `Y3` | Response parser helper |
| `mj_` | Header/content-type parser |
| `lHH` | Display-mode set checker |
| `uj` | String replacement helper |
| `H9` | Message formatter |
| `o6` | Output-bridge line writer |
| `xC` | Cursor/terminal control helper |
| `cL8` | Stdout write + terminal-escape helper |
| `MIH` | Terminal capability detector (Ghostty, iTerm2) |
| `evH` | Escape-sequence emitter |
| `QW` | tmux/screen escape handler |
| `O$` | Output finalizer |
| `Fz8` | Scroll/animation teardown helper |
| `wT` | Animation frame helper |
| `sV9` | Scroll-state accessor |
| `aV9` | Frame-timing calculator |
| `rV9` | Frame-render helper |
| `$1` | Display-mode / fullscreen manager |
| `NW_` | String coercion helper used by fullscreen logic |
| `qa` | IIL-based state helper |
| `VW_` | Platform (Windows) detection helper |
| `l_` | Fullscreen-enable helper |
| `kIL` | Fullscreen-disable helper |
| `D6` | Render-frame dispatcher |
| `vE` | Conversation-state validator |
| `ipH` | NPA drain helper |
| `gz8` | Analytics / parallel-flush orchestrator |
| `r8` | Subprocess / child-process wrapper |
| `K` | Process-list formatter |
| `q` | File-unlink / cleanup helper |
| `L` | Active-task tracker |
| `l8K` | Native `execve` relaunch executor |
| `f` | FFI library handle |
| `A` | Process/connection map |
| `$` | Push-based registry |
| `DLK` | Registry-entry creator |
| `w` | Background-session worker |
| `b` | Child-process reference |
| `CH` | Background-session create event emitter |
| `SH` | Background-session ok event emitter |
| `lx8` | Low-memory checker |
| `eX6` | Config file reader |
| `Q` | Process retirement / kill helper |
| `pwA` | Spare-session claimer |
| `dwA` | Session lifecycle manager |
| `D` | Forced-shutdown handler |
| `V8` | Version string holder |
| `J6` | Log-message helper |
| `B` | Disposable resource wrapper |
| `M` | MCP / daemon manager |
| `xbH` | MCP connection initiator |
| `PF8` | MCP connection result applier |
| `cDA` | MCP client refresh orchestrator |
| `z` | Daemon stop controller |
| `uh` | Daemon-control event emitter |
| `sp` | Daemon shutdown sequence runner |
| `GH` | String-cast helper |
| `SJ` | Error-marker file writer |
| `fb8` | Relaunch argv builder |
| `vTH` | Session-type classifier |
| `C6` | Config loader / watcher |
| `d6` | Config path resolver |
| `nP_` | Config normalizer |
| `LwH` | Config file reader and backup copier |
| `U6` | JSON parse wrapper |
| `Hu` | Home-directory prefix stripper |
| `No1` | Config backup directory scanner |
| `tP_` | Config backup path builder |
| `hVL` | Config file watcher setup |
| `co` | Config change callback handler |
| `b_` | Conversation state forwarder |
| `ty8` | Working-directory extractor |
| `L1` | App-state field accessor |
| `ey8` | Tool-list extractor |
| `aB` | Bypass-permissions mode handler |
| `t$` | Session flags reader |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.