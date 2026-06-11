---
type: feature-spec
feature: "update"
cc_version: "2.1.172"
updated: "2026-06-11"
tags: ["update", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.172 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/update`

> Analysis basis: CC v2.1.172 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.172

---

## Overview

`/update` performs an in-place hot-swap of the running Claude Code binary to the latest installed version while preserving the active conversation. It tears down the current session's I/O bridge, spawns the new binary via `execve`, and hands off the session using `--resume`, so the conversation context continues without interruption.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `update` |
| description | `Switch to the latest version (conversation continues)` |
| supportsNonInteractive | `false` |
| isHidden | `true` |
| module_id | `VOK` |
| load_inline | `true` |
| loc_byte | `12905523` |
| loc_byte_end | `12905764` |
| loc_line | `9141` |
| arbor_handler.name | `zi7` |
| arbor_handler.fqn | `claude-2.1.172::zi7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.172 bundle.js:+12905523

---

## Input Branching

The handler (resolved as `zi7` via Arbor `module_id` path) evaluates several guard conditions before committing to the hot-swap. There are more than three distinct branches, so a flowchart is used.

```mermaid
flowchart TD
    A(["/update invoked"]) --> B{Locate 'claude' binary\nvia packageManagerResolver}
    B -- "not found" --> C[Emit tengu_update_refused\nReturn early with error]
    B -- "found" --> D{Any background task\nin 'running' or 'pending' state?}
    D -- "yes" --> E["Error: Cannot /update while work\nis running in the background…"\nReturn early]
    D -- "no" --> F{Session resumed from\na different project directory?}
    F -- "yes" --> G["Error: Cannot /update — this session\nwas resumed from a different project\ndirectory. Restart manually…"\nReturn early]
    F -- "no" --> H[Collect session args:\n--resume, --add-dir, --effort,\n--permission-mode, etc.]
    H --> I[Write 'Switching to latest\nClaude Code… reconnecting'\nstatus message to SDK output]
    I --> J[Generate new session UUID via EOK]
    J --> K[Wait for I/O bridge flush\n(timeout: 2000 ms)]
    K --> L[Flush analytics / teardown bridge\n(timeout: 30000 ms each)]
    L --> M[Unmount terminal UI\nand stop spinner]
    M --> N[Remove process signal listeners\nRe-register SIGINT/SIGHUP]
    N --> O[spawnSync new binary via\nH7K.spawnSync with 'inherit' stdio]
    O -- "spawn error" --> P[Write relaunch_spawn_error\nexit code 128]
    O -- "success" --> Q[execve: replace process image\nwith new binary + args]
    Q --> R([New binary takes over\nconversation continues])
```

Analysis basis: CC v2.1.172 bundle.js:+12903411, +12903686, +12903789, +12904033, +12904545, +12904625, +12625866, +12625780

---

## Behavioral Spec

### 1. Binary Location

The handler calls the package-manager resolver (`resolvePackageManagerPath`, reached via `EB8` → `L3` → `PbA`) which invokes `Bun.which("claude")` to locate the executable. An index value of `0` is used when selecting the resolved entry. If nothing is found the command emits `tengu_update_refused` and returns without further action.

```
function resolveClaudeBinaryPath():
    candidates = packageManagerVersionPaths()  # uses ~/.local/share/versions layout
    result = Bun.which("claude")
    if result is null:
        emit telemetry("tengu_update_refused")
        return NOT_FOUND
    return result
```

Analysis basis: CC v2.1.172 bundle.js:+12903325, +12903328, +858882, +858925, +12903425

### 2. Background-Work Guard

The handler reads `Object.values(appState)` and checks for any entry whose state is `"running"` or `"pending"` (the two literal values found at `+12903686` and `+12903708`). If any such entry exists the command surfaces the user-facing message:

> "Cannot /update while work is running in the background — wait for it to finish, then try again."

and returns, emitting `tengu_update_refused`.

```
function checkNoActiveBackgroundWork(appState):
    tasks = Object.values(appState)
    for task in tasks:
        if task.status in {"running", "pending"}:
            return BLOCKED
    return OK
```

Analysis basis: CC v2.1.172 bundle.js:+12903648, +12903686, +12903708, +12903789

### 3. Project-Directory Consistency Check

The handler retrieves the basename of the current working directory (via `getBasename`, `hJ` → `vJ.basename`) and compares it against the project directory recorded in the session. Messages whose role starts with `"assistant-"` are inspected. If the session was resumed and the directories differ, the command surfaces:

> "Cannot /update — this session was resumed from a different project directory. Restart manually with --resume to continue on the latest version."

```
function checkProjectDirectoryMatch(messages, cwd):
    sessionDir = getStoredProjectDir(messages)  # scans assistant-* prefixed entries
    if sessionDir is not null and sessionDir != basename(cwd):
        return MISMATCH
    return OK
```

Analysis basis: CC v2.1.172 bundle.js:+12904033, +12904335, +4225242

### 4. Session Argument Collection

The handler builds the argument list for the replacement process by reading current CLI flags and session metadata. Arguments propagated include `--resume`, `--add-dir`, `--allow-dangerously-skip-permissions`, `--effort`, and `--permission-mode`. The function `buildSessionArgs` (`dU8`) calls `Array.from`, filters with `q.includes`, and uses `A.flatMap` to assemble the final array.

```
function buildSessionArgs(sessionId, currentArgs):
    args = ["--resume", sessionId]
    if currentArgs.has("--add-dir"):
        args += ["--add-dir", currentArgs["--add-dir"]]
    optionalPassthrough = ["--allow-dangerously-skip-permissions",
                           "--effort", "--permission-mode"]
    for flag in optionalPassthrough:
        if currentArgs.has(flag):
            args += [flag, currentArgs[flag]]
    return args
```

Analysis basis: CC v2.1.172 bundle.js:+12904847, +12625240, +12626764, +12626879, +12627021, +12627038

### 5. I/O Bridge Flush and Teardown

Before replacing the process image, the handler:
1. Writes the status string `"Switching to latest Claude Code… reconnecting"` to the SDK output channel (`O.writeSdkMessages`).
2. Calls `HL` (a promise-race helper with `setTimeout` at 2000 ms) to wait for the bridge flush labeled `"bridge flush"`.
3. Calls `O.flush` and then `O.teardown`.
4. Waits for analytics drain via `EFH` (timeout label `"analytics flush timeout"`).
5. Calls the terminal-UI unmount routine `xCH` (which calls `H.unmount`) and stops any active spinner via `pN6`.

Flush timeout: 30000 ms (bundle.js:+12625307).
Bridge flush timeout: 2000 ms (bundle.js:+12904625).

```
async function flushAndTeardown(bridge):
    bridge.writeSdkMessages(statusMessage)
    await Promise.race([bridge.flush(), timeout(2000)])   # "bridge flush"
    await bridge.teardown()
    await Promise.race([analyticsFlush(), timeout(30000)]) # "analytics flush timeout"
    stopSpinner()
    unmountTerminalUI()
```

Analysis basis: CC v2.1.172 bundle.js:+12904521, +12904541, +12904545, +12904612, +12904615, +12904666, +12625299, +12625307, +12625369, +12625414

### 6. Signal Handler Re-registration and Process Replacement

The handler removes all existing process listeners (`process.removeAllListeners`), registers minimal handlers for `SIGINT` and `SIGHUP`, then invokes `H7K.spawnSync` with `stdio: "inherit"`. On failure it writes a `relaunch_spawn_error` marker and exits with code 128. On success it calls `M.execve` (libc `execve` via FFI — loading `/usr/lib/libSystem.B.dylib` on macOS or `libc.so.6` on Linux) to replace the process image atomically.

```
function relaunchProcess(binary, args, env):
    process.removeAllListeners()
    process.on("SIGINT", noop)
    process.on("SIGHUP", noop)

    result = spawnSync(binary, args, {stdio: "inherit"})
    if result.error:
        writeError("relaunch_spawn_error")
        process.exit(128)

    # Replace process image — does not return on success
    execve(binary, args, buildEnv(env))
```

Analysis basis: CC v2.1.172 bundle.js:+12625780, +12625799, +12625809, +12625839, +12625866, +12625901, +12626088, +12626091, +12626115, +12626228, +12624336, +12624380, +12624388, +12624417, +12624743

### 7. Post-Relaunch: New Process Startup

After `execve`, the replacement binary inherits the session and calls `buildNewSessionState` (`dU8`/`k_`/`P$`) to reconstruct app state. It reads the `--resume` flag, locates the last assistant message in the conversation history, and restores settings such as `working_directory`, `allowed_tools`, `disallowed_tools`, `avoid_prompts`, `permission_mode`, `effort`, `model`, `max_thinking_tokens`, and `flag_settings`.

```
function reconstructSessionState(resumeId, messageHistory):
    lastAssistantMsg = messageHistory.findLast(m => m.role == "assistant")
    state = extractSettingsFromMessage(lastAssistantMsg)
    # restores: working_directory, allowed_tools, disallowed_tools,
    #           avoid_prompts, permission_mode, bypassPermissions,
    #           effort, model, max_thinking_tokens, flag_settings
    applyState(state)
```

Analysis basis: CC v2.1.172 bundle.js:+12904851, +12904857, +10672069, +10672149, +10672174, +10672229, +10672284, +10672345, +10672447, +10672478, +10672802, +10672815, +10672827, +10672853

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_update_refused` (binary not found or blocked by background work); `tengu_scroll_summary` (UI scroll state); `tengu_amber_creek`, `tengu_pewter_brook` (fullscreen/flicker detection); `tengu_bg_dispatch_sigkill_escalate`, `tengu_scheduled_task_missed`, `tengu_feature_bad`, `tengu_feature_ok`, `tengu_bg_low_mem_mb`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_sendclaim_failed`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_daemon_control`, `tengu_config_parse_error`, `tengu_disable_bypass_permissions_mode` (reached transitively through daemon/session helpers) |
| Hook registration | `hZA.register` (reached via `nOA` → `$4` → `y9`); `hZA.drain` (reached via `EFH`) |
| appState changes | `_.getAppState` read before relaunch; `_.setAppState` written before teardown (bundle.js:+12904281, +12904435) |
| SDK output | Status message `"Switching to latest Claude Code… reconnecting"` written via `O.writeSdkMessages` (bundle.js:+12904521) |
| I/O bridge | `O.flush` + `O.teardown` called before `execve` |
| Terminal UI | `H.unmount` called; spinner stopped via interval-clear (`fc_` → `clearInterval`) |
| Process signals | `process.removeAllListeners()` then re-register `SIGINT`/`SIGHUP` before exec |
| Filesystem | New session UUID written to disk by `$X` → `nFH.writeFileSync` (bundle.js:+12626088) |
| Sound | None detected in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.172 | Initial analysis |

---

## Common Mistakes

1. **Running `/update` during active background work** — the command is blocked when any background task is in `"running"` or `"pending"` state. Wait for all background tasks to complete before invoking `/update`.
2. **Using `/update` after `--resume` from a different directory** — if the session was resumed with a working directory that does not match the original project directory, `/update` will refuse. Restart manually with `--resume` instead.
3. **Expecting the command to be visible in the command palette** — `isHidden: true` means `/update` does not appear in autocomplete listings. It must be typed explicitly.
4. **Assuming non-interactive use is supported** — `supportsNonInteractive: false` means the command is only valid in interactive terminal sessions.
5. **Interrupting the flush window** — sending SIGINT during the 2000 ms bridge-flush window can leave the session in an inconsistent state; the handler intentionally re-registers signal handlers before the `execve` call to prevent this.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `zi7` | Main handler (AsyncFunction) for `/update`; Arbor-resolved entry point |
| `EB8` | Package-manager path resolver dispatcher |
| `L3` | Binary lookup helper (calls `Bun.which`) |
| `PbA` | Low-level `Bun.which` wrapper |
| `IR` | Version-directory path builder |
| `ok8` | Versions subdirectory path assembler |
| `u$` | Array normalisation utility |
| `NMH` | `~/.local/share` path resolver |
| `pP8` | Home-directory resolver (calls `Gi9.homedir`) |
| `_9H` | `bin` subdirectory path builder |
| `O9` | Process-role classifier (`bg`, `daemon`, `daemon-worker`) |
| `RDH` | Role constants object |
| `c` | General utility / context helper |
| `hJ` | Current-directory basename extractor |
| `y6` | Async yield / micro-task helper |
| `BG` | Base async generator scheduler |
| `rk` | File-stat / path existence checker |
| `k$A` | Executable path resolver with dirname fallback |
| `P_` | Path existence predicate |
| `vf` | Secondary path existence predicate |
| `RKH` | Session-resumption flag checker |
| `rHH` | Background-task state inspector |
| `Kg8` | Task-state map accessor |
| `nOA` | Hook-registration and message-append helper |
| `$4` | Hook event dispatcher |
| `y9` | `hZA.register` wrapper |
| `_` | App-state / message-store accessor |
| `SH` | Log-error / error-formatting helper |
| `JA` | Error constructor wrapper |
| `f6` | String coercion utility |
| `Rq` | Telemetry routing helper |
| `yBA` | Traffic-category classifier (`essential-traffic`, `no-telemetry`, `default`) |
| `fRf` | Rolling-log buffer manager (shift/push) |
| `DG` | App-state mutation helper (pre-relaunch) |
| `O` | SDK output / bridge object |
| `m8` | Underlying SDK message writer |
| `EOK` | New session UUID generator (calls `TB8.randomUUID`) |
| `HL` | Promise-race timeout helper (used for bridge-flush 2000 ms wait) |
| `DXH` | String coercion for exec arguments |
| `qEH` | Full relaunch orchestrator (teardown → spawnSync → execve) |
| `pN6` | Spinner stop helper (calls `fc_` → `clearInterval`) |
| `fc_` | Interval-clear wrapper |
| `xCH` | Terminal-UI unmount orchestrator |
| `H` | Ink/terminal render instance |
| `Db` | Terminal state cleanup helper |
| `E38` | Terminal output writer (ANSI sequences) |
| `pkH` | Terminal-emulator version checker (Ghostty, iTerm) |
| `kkH` | Alternate terminal cleanup helper |
| `b0` | tmux/screen escape-sequence adjuster |
| `v3` | Terminal geometry helper |
| `N` | ANSI colour/format string builder |
| `gW8` | Scroll-summary renderer |
| `Y0` | Scroll-position reader |
| `Re9` | Scroll-line formatter |
| `Se9` | Scroll-timing calculator |
| `ke9` | Scroll-state constants |
| `v1` | Fullscreen / alternate-screen manager |
| `j8H` | Local-agent feature-flag checker |
| `gV_` | String formatter for feature flags |
| `Is` | Ink render helper |
| `FV_` | Platform (windows) detection for fullscreen disabling |
| `B_` | View-buffer helper |
| `Zp4` | Fullscreen entry helper |
| `Y6` | React/Ink render scheduler |
| `vZ` | Session-close hook dispatcher |
| `EFH` | Analytics drain (calls `hZA.drain`) |
| `mCH` | Promise-resolve wrapper for UI frame |
| `BW8` | Frame completion signal |
| `tLK` | Process-replacement core (chdir, require, FFI dlopen, execve) |
| `L` | FFI library handle |
| `A` | FFI symbol/function map |
| `q` | Open-handle set |
| `f` | Handle lifecycle manager |
| `$` | Pre-exec cleanup queue |
| `TwK` | Cleanup-queue task runner |
| `D` | Daemon session manager / child-process supervisor |
| `b` | Background subprocess wrapper |
| `d8` | Timeout / abort-signal helper |
| `bH` | Daemon IPC feature-ok reporter |
| `kH` | Daemon IPC feature-bad reporter |
| `hF8` | Low-memory threshold checker |
| `l06` | Config file reader (JSONC parser) |
| `Q` | Background PTY session object |
| `B0A` | Spare-session claim handler |
| `l0A` | Daemon session lifecycle manager (spawn, retire, roster) |
| `Y` | Forced-shutdown / process.exit helper |
| `N8` | Notification helper |
| `A6` | Async step sequencer |
| `B` | Disposable resource helper |
| `M` | MCP server manager (execve path, server lifecycle) |
| `yRH` | MCP connection builder (stdio/sse/http/ws transports) |
| `Ln8` | MCP connection result applier |
| `nWA` | MCP retry / reconnect orchestrator |
| `z` | Daemon stop coordinator |
| `wS` | Daemon stop signal sender |
| `CU` | Graceful-exit race (Promise.race → process.exit) |
| `EH` | String error formatter |
| `$X` | Session-ID file writer (`nFH.writeFileSync`) |
| `dU8` | Session-argument assembler for relaunch |
| `lZH` | CLI-argument filter helper |
| `Vq8` | Config-file watcher (calls `b6` → file-watch helpers) |
| `b6` | Config file loader and watcher bootstrap |
| `o6` | Config path resolver |
| `jZ_` | JSON parse helper |
| `W7H` | Config directory reader / backup copier |
| `Gx4` | File-watch subscription manager |
| `k_` | Session-state reconstructor from message history |
| `_b8` | Allowed-tools state extractor |
| `M1` | Tool-state parser |
| `Ab8` | Disallowed-tools state extractor |
| `Nb` | Permission-mode state restorer |
| `P$` | Effort/model/thinking-token state restorer |