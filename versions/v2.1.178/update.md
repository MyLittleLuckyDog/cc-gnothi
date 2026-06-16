---
type: feature-spec
feature: "update"
cc_version: "2.1.178"
updated: "2026-06-16"
tags: ["update", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.178 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/update`

> Analysis basis: CC v2.1.178 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.178

---

## Overview

The `/update` command performs an in-process upgrade of Claude Code to the latest available version without terminating the ongoing conversation. It validates preconditions (no background work running, no cross-directory resume), flushes the current session state to disk, re-executes the process via `execve`, and hands control to the new binary — all while preserving the conversation context through a `--resume` flag.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `update` |
| description | `Switch to the latest version (conversation continues)` |
| supportsNonInteractive | `false` |
| isHidden | `true` |
| module_id | `UWK` |
| load_inline | `true` |
| loc_byte | `13068263` |
| loc_byte_end | `13068504` |
| loc_line | `9025` |
| arbor_handler.name | `a95` |
| arbor_handler.fqn | `claude-2.1.178::a95` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.178 bundle.js:+13068263

---

## Input Branching

The handler contains 4+ distinct branches across precondition checks and update paths. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/update invoked"]) --> B{Background tasks\nrunning or pending?}
    B -- Yes --> C[Emit tengu_update_refused\nReturn error message:\n'Cannot /update while work\nis running in the background…']
    B -- No --> D{Session resumed from\na different project directory?}
    D -- Yes --> E[Return error message:\n'Cannot /update — this session\nwas resumed from a different\nproject directory…']
    D -- No --> F[Resolve executable path\nvia Bun.which('claude')]
    F --> G{Executable\nresolved?}
    G -- No --> H[Return fallback / abort]
    G -- Yes --> I[Display status message:\n'Switching to latest Claude Code…\nreconnecting']
    I --> J[Write SDK messages to disk\nvia writeSdkMessages]
    J --> K[Generate reconnect UUID\nvia randomUUID]
    K --> L[Flush bridge with\n2000 ms timeout]
    L --> M[Tear down current\nsession state]
    M --> N[Set appState for\nresume handoff]
    N --> O[Build CLI args list:\n--resume + session flags\n+ --add-dir entries]
    O --> P[Execute relaunch:\nspawnSync then execve\nwith inherited stdio]
    P --> Q[In-place process\nreplacement — new version\ntakes over terminal]
```

Analysis basis: CC v2.1.178 bundle.js:+13066087 – +13067582

---

## Behavioral Spec

### 1. Precondition — Background Task Guard

Before any update action, the handler inspects the current set of tracked tasks (internal task-state map). If any task is in `"running"` or `"pending"` state, the command is aborted immediately and the telemetry event `tengu_update_refused` is fired.

```
function checkBackgroundTasksPrecondition(taskStateMap):
    for each task in Object.values(taskStateMap):
        if task.status == "running" or task.status == "pending":
            emit telemetry("tengu_update_refused")
            return Error(
                "Cannot /update while work is running in the background"
                + " — wait for it to finish, then try again."
            )
    return OK
```

Analysis basis: CC v2.1.178 bundle.js:+13066187, +13066448, +13066470, +13066551

### 2. Precondition — Project-Directory Resume Guard

The handler compares the current working directory against the original project directory stored in the session's appState. If the session was resumed from a different directory, it refuses to update because the re-exec would launch in the wrong context.

```
function checkResumedDirectoryPrecondition(appState, currentCwd):
    originalDir = appState.working_directory
    if originalDir != null and originalDir != currentCwd:
        return Error(
            "Cannot /update — this session was resumed from a different"
            + " project directory. Restart manually with --resume to"
            + " continue on the latest version."
        )
    return OK
```

Analysis basis: CC v2.1.178 bundle.js:+13066795

### 3. Executable Resolution

The handler locates the `claude` binary on `PATH` using `Bun.which("claude")`. It also resolves the versioned install root by walking the XDG-style path (`~/.local/share/versions/…/bin`) to find the target executable. `path.basename` with a depth of 8 segments is used to derive the install name.

```
function resolveClaudeExecutable():
    systemPath = Bun.which("claude")
    xdgVersionsDir = joinPath(homedir(), ".local", "share", "versions")
    installBinDir  = joinPath(xdgVersionsDir, <version>, "bin")
    return { systemPath, installBinDir }
```

Analysis basis: CC v2.1.178 bundle.js:+13066087, +862156, +862113, +6970610, +6970619, +6970690

### 4. Status Notification

Before tearing down the session, a `text`-typed assistant message reading `"Switching to latest Claude Code… reconnecting"` is injected into the conversation stream, giving the user visible feedback.

```
function displayUpdateNotification(conversationStream):
    conversationStream.append({
        role:    "assistant",
        type:    "text",
        content: "Switching to latest Claude Code… reconnecting"
    })
```

Analysis basis: CC v2.1.178 bundle.js:+13067280, +13066233

### 5. Session State Serialisation

The handler serialises in-flight SDK messages via `$.writeSdkMessages`, then writes a `daemon.status.json` file with `Date.now()` timestamp (space indent: 2) to the session directory. A fresh UUID is generated (via `crypto.randomUUID`) to identify the resume token.

```
async function serialiseSession(sessionIO, resumeId):
    await sessionIO.writeSdkMessages(currentMessages)
    statusPayload = buildDaemonStatus(Date.now(), resumeId)
    await writeFile(sessionDir / "daemon.status.json",
                    JSON.stringify(statusPayload, null, 2))
```

Analysis basis: CC v2.1.178 bundle.js:+13067256, +13065136, +13159612, +13159724, +13159789, +13067276

### 6. Bridge Flush and Session Teardown

A `Promise.race` with a hard 2000 ms timeout (`"bridge flush"`) is used to flush the bridge. After the flush, `$.teardown()` is called. The UI is unmounted (`H.unmount`), any active intervals are cleared, and terminal state is restored (ANSI save/restore cursor sequences `\x1b7` / `\x1b8` are emitted for supported terminals — Ghostty ≥ 1.2.0 and iTerm.app ≥ 3.6.6). A secondary 30 000 ms flush-timeout (`"flush timeout (relaunch)"`) guards the entire relaunch window.

```
async function flushAndTeardown(bridge, sessionIO):
    await withTimeout(bridge.flush(), 2000, "bridge flush")
    await sessionIO.teardown()
    ui.unmount()
    clearAllIntervals()
    restoreTerminalCursor()          // writes \x1b8 to stdout
```

Analysis basis: CC v2.1.178 bundle.js:+13067350, +13067360, +13067365, +13067401, +2000, +30000, +12786509, +12786515, +3881413, +3881424

### 7. CLI Argument Assembly

The handler calls `ad8` to assemble the argument vector for the new process. It starts from `Array.from` of the current `process.argv`, injects `--resume <uuid>`, propagates `--add-dir` entries for additional directories, and conditionally appends:
- `--allow-dangerously-skip-permissions` (when bypass-permissions mode was active)
- `--effort <level>`
- `--permission-mode <mode>`

```
function buildRelunchArgv(currentArgv, resumeId, sessionFlags):
    args = Array.from(currentArgv)
    args.push("--resume", resumeId)
    for dir in sessionFlags.addDirs:
        args.push("--add-dir", dir)
    if sessionFlags.bypassPermissions:
        args.push("--allow-dangerously-skip-permissions")
    if sessionFlags.effort:
        args.push("--effort", sessionFlags.effort)
    if sessionFlags.permissionMode:
        args.push("--permission-mode", sessionFlags.permissionMode)
    return args
```

Analysis basis: CC v2.1.178 bundle.js:+12787966, +12788081, +12788223, +12788240, +13067582, +12787791

### 8. Process Re-execution (execve)

The actual binary replacement happens in two steps. First `TjK.spawnSync` is attempted with `"inherit"` stdio. If that fails a `"relaunch_spawn_error"` is recorded. Then `M.execve` performs an in-place `execve(2)` syscall (via `bun:ffi` against `libSystem.B.dylib` on macOS or `libc.so.6` on Linux), fully replacing the current process image. Signal handlers are reset (`process.removeAllListeners`) and `SIGINT` / `SIGHUP` listeners are re-registered before the call. On failure the process exits with code `128`.

```
async function relunchProcess(executablePath, argv, env):
    process.removeAllListeners("SIGINT")
    process.removeAllListeners("SIGHUP")
    process.on("beforeExit", noopHandler)
    process.on("exit",       noopHandler)

    spawnResult = TjK.spawnSync(executablePath, argv, { stdio: "inherit" })
    if spawnResult.error:
        recordError("relaunch_spawn_error", spawnResult.error)

    // FFI execve — replaces process image in-place
    libcHandle = dlopen(platformLibC, { execve: { args: [...], returns: "int" } })
    envpBuffer = buildEnvpBuffer(env)
    libcHandle.symbols.execve(executablePath, argv, envpBuffer)

    // Should never reach here
    process.exit(128)
```

Analysis basis: CC v2.1.178 bundle.js:+12787068, +12787293, +12785538, +12785546, +12785569, +12785582, +12785590, +12785619, +12785945, +12786982, +12787001, +12787317, +12787430

### 9. Post-Relaunch: Resume State Reconstruction

On the receiving side of the resume, `b_` reads `appState` and locates the last conversation turn via `A.findLast`. It then reconstructs session-initial parameters (`working_directory`, `allowed_tools`, `disallowed_tools`, `avoid_prompts`, `permission_mode`, `bypassPermissions`, `effort`, `model`, `max_thinking_tokens`, `flag_settings`) from the serialised state, including `disable` handling for the permission-bypass guard.

```
function reconstructSessionFromResume(appState):
    lastTurn = appState.messages.findLast(m => m.role == "assistant")
    params = {
        workingDirectory:  appState.working_directory,
        allowedTools:      appState.allowed_tools,
        disallowedTools:   appState.disallowed_tools,
        avoidPrompts:      appState.avoid_prompts,
        permissionMode:    appState.permission_mode,
        bypassPermissions: appState.bypassPermissions,
        effort:            appState.effort,
        model:             appState.model,
        maxThinkingTokens: appState.max_thinking_tokens,
        flagSettings:      appState.flag_settings,
    }
    return { lastTurn, params }
```

Analysis basis: CC v2.1.178 bundle.js:+13067586, +10800596, +10800676, +10800701, +10800756, +10800811, +10800872, +10800974, +10801005, +10801329, +10801342, +10801354, +10801380

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_update_refused` | Fired when background tasks block the update (bundle.js:+13066187) |
| Telemetry: `tengu_scroll_summary` | Fired during UI teardown / scroll-state save (bundle.js:+7177447) |
| Telemetry: `tengu_amber_creek` | Fired during fullscreen/UI-mode detection (bundle.js:+3540562) |
| Telemetry: `tengu_pewter_brook` | Fired during fullscreen/UI-mode detection (bundle.js:+3540470) |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Fired if background process needs SIGKILL during teardown (bundle.js:+17066047) |
| Telemetry: `tengu_config_parse_error` | Fired if config file is unreadable during arg assembly (bundle.js:+3351487) |
| Telemetry: `tengu_disable_bypass_permissions_mode` | Fired when bypass-permissions flag is carried into the relaunch (bundle.js:+4309015) |
| appState changes | `_.setAppState` is called to embed the resume UUID and serialised session fields before exec (bundle.js:+13067170) |
| SDK message flush | `$.writeSdkMessages` persists in-flight messages; `$.flush` drains the write queue; `$.teardown` closes the channel (bundle.js:+13067256, +13067350, +13067401) |
| File write | `daemon.status.json` written to session directory with timestamp and resume token (bundle.js:+13159612) |
| Signal handling | All existing listeners removed; SIGINT/SIGHUP re-registered before `execve` (bundle.js:+12786982, +12787001, +12787011) |
| UI unmount | `H.unmount` called; terminal cursor state restored (ANSI escape sequences) (bundle.js:+7175691, +3881413, +3881424) |
| Process replacement | `execve(2)` via `bun:ffi`; on failure `process.exit(128)` (bundle.js:+12785945, +12787317, +12787430) |
| Hook registration | `XSA.register` / `XSA.drain` invoked during task-queue flush (bundle.js:+66308, +66351) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.178 | Initial analysis |

---

## Common Mistakes

1. **Running `/update` while background tasks are active.** The command refuses with a clear error; wait for all `running`/`pending` tasks to complete before retrying.
2. **Using `/update` in a session resumed from a different project directory.** The guard at bundle.js:+13066795 detects the directory mismatch and requires a manual `claude --resume` restart instead.
3. **Expecting `/update` to appear in the command palette.** The registration sets `isHidden: true`, so the command does not surface in autocomplete or help listings; it must be typed explicitly.
4. **Assuming the process restarts cleanly in all terminals.** The `execve` path depends on `bun:ffi` and platform libc; if the binary cannot be located via `Bun.which("claude")`, the update silently aborts without a new process being spawned.
5. **Interrupting during the 2-second bridge-flush window.** Sending SIGINT after `/update` is initiated but before `execve` completes can leave a partially-written `daemon.status.json`; the resumed session may fail to reconstruct conversation state.
6. **Not propagating custom `--add-dir` or `--permission-mode` flags.** These are re-injected automatically from the serialised `appState`; manually passing them again on resume causes duplicates.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `a95` | Main async handler for `/update` (Arbor-resolved, module_id path) |
| `yc8` | Executable-path resolver entry point (calls `N3` / `vC`) |
| `N3` | `Bun.which("claude")` wrapper |
| `WgA` | Underlying `Bun.which` caller |
| `vC` | XDG versioned-install path builder |
| `Cx8` | `versions` directory path constructor |
| `Z$` | `Array.isArray` guard utility |
| `z$H` | Home-directory path joiner (uses `N8q.homedir`) |
| `JT8` | `os.homedir()` wrapper |
| `CqH` | `bin` sub-path joiner |
| `v9` | Background-task type/mode checker (filters `bg`, `daemon`, `daemon-worker`) |
| `zkH` | Task-state store accessor |
| `HX` | Install-name extractor (`path.basename`, depth 8) |
| `R6` | UI text renderer |
| `TT` | Terminal string formatter |
| `eh` | Current working directory getter |
| `UJA` | Cross-directory resume guard |
| `W_` | CWD comparison utility |
| `$4` | Resume-mismatch error builder |
| `ffH` | Task-state map accessor |
| `v8H` | Attachment / hook-success filter |
| `Dn8` | Hook-type constant set |
| `qPA` | Last-prompt entry appender |
| `Wf` | Progress-event emitter |
| `F9` | Hook registrar (`XSA.register`) |
| `RH` | Logger / error recorder |
| `jA` | Error constructor wrapper |
| `L6` | String coercion utility |
| `qq` | Telemetry batching writer |
| `biA` | Telemetry queue entry builder |
| `RQ4` | Rolling log-buffer manager (shift/push) |
| `k5` | AsyncLocalStorage session store accessor |
| `J2` | Store `.getStore()` wrapper |
| `DJ` | appState delta builder |
| `mWK` | `crypto.randomUUID()` wrapper |
| `a4` | Promise-with-timeout utility (setTimeout / Promise.race / clearTimeout) |
| `M2H` | String-coercion helper for process metadata |
| `MVH` | Core relaunch orchestrator (flush → teardown → exec) |
| `Kk6` | Interval-clear coordinator |
| `Go_` | `clearInterval` wrapper |
| `bxH` | UI unmount + terminal-restore handler |
| `H` | Ink/React terminal renderer instance |
| `PR` | Post-unmount cleanup step |
| `rY8` | Terminal output writer (stdout.writeSync + cursor control) |
| `qRH` | Terminal-capability detector (Ghostty, iTerm2 version checks) |
| `oSH` | Supplemental output step |
| `DG` | tmux/screen escape-sequence adapter |
| `D5` | Additional output stage |
| `N` | Structured log / debug writer |
| `uE8` | Scroll-state saver |
| `l0` | Scroll position reader |
| `x1q` | Scroll-state serialiser |
| `b1q` | Timing/metrics calculator (Date.now, Math.max, Math.round) |
| `R1q` | Scroll-state record builder |
| `C1` | Full-screen mode manager |
| `Ql` | Feature-flag presence checker (`UB4.has`) |
| `uI_` | Feature-flag string coercer |
| `qe` | Full-screen disable reason builder |
| `xI_` | Platform/OS detector (windows, SSH, ConPTY) |
| `d_` | Full-screen state writer |
| `jof` | Full-screen event emitter (`tengu_amber_creek`) |
| `O6` | UI render-cycle coordinator |
| `KV` | Wf-based event-queue flusher |
| `tQH` | `XSA.drain` caller |
| `uxH` | Promise.resolve / unmount step |
| `bE8` | Post-unmount resolve handler |
| `WjK` | execve invocation and FFI setup |
| `L` | FFI library handle |
| `A` | Active-connection map |
| `q` | Connection/listener set |
| `f` | Connection promise tracker |
| `D` | Background-session dispatcher |
| `b` | Background-task runner |
| `o8` | Abort-with-timeout utility |
| `bH` | `daemon_bg_session_create` telemetry writer (bad-path variant) |
| `SH` | `daemon_bg_session_create` telemetry writer (ok-path variant) |
| `ul8` | Low-memory guard (`tengu_bg_low_mem_mb`) |
| `dRH` | Temp-file cleanup (lstat → rm → readFile) |
| `F` | Child-process lifecycle manager |
| `ZhA` | Daemon socket claim handler |
| `khA` | Daemon worker lifecycle controller |
| `w` | Forced-shutdown handler (process.exit) |
| `Z8` | Session-state serialiser step |
| `dH` | Daemon log writer (`c36`) |
| `B` | Disposable resource holder |
| `O` | Background-session option builder |
| `C8` | Option validator |
| `M` | MCP server update coordinator |
| `ebH` | MCP connection builder |
| `hs8` | MCP update applier (`H.applyMcpUpdate`) |
| `INA` | MCP client filter and reconnect orchestrator |
| `z` | Daemon stop handler (`daemon_stop`, `daemon_stop_failed`) |
| `AR` | Telemetry first-party tagger |
| `aB` | Graceful-exit race (Promise.race + process.exit) |
| `TH` | String-cast terminal helper |
| `cX` | Relaunch-error file writer (`E_H.writeFileSync`) |
| `ad8` | CLI argument vector assembler |
| `HNH` | Argument-list deduplicator |
| `d78` | Custom-config loader (calls `S6`) |
| `S6` | Config file reader with watcher |
| `n6` | Config path resolver |
| `$k_` | Config schema validator |
| `_MH` | Config file parser (readFileSync + statSync + mkdirSync) |
| `wnf` | Config file watcher (`$O8.watchFile` / `$O8.unwatchFile`) |
| `b_` | Resume-state extractor from appState |
| `tp8` | Allowed-tools extractor (`K1`) |
| `ep8` | Disallowed-tools extractor (`K1`) |
| `Nx` | Permission-bypass disable guard (`tengu_disable_bypass_permissions_mode`) |
| `p$` | Post-resume appState reader |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.