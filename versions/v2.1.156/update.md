---
type: feature-spec
feature: "update"
cc_version: "2.1.156"
updated: "2026-06-02"
tags: ["update", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.156 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/update`

> Analysis basis: CC v2.1.156 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.156

---

## Overview

`/update` performs an in-process upgrade of Claude Code to the latest available version while the current conversation session remains live. It resolves the installation path, validates that the session is in an upgradeable state, tears down the current runtime bridge, and relaunches the process via `execve` so that the new binary takes over without losing conversation context.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `update` |
| description | `Switch to the latest version (conversation continues)` |
| supportsNonInteractive | `false` |
| isHidden | `true` |
| module_id | `ri1` |
| load_inline | `true` |
| loc_byte | `12371654` |
| loc_byte_end | `12371895` |
| loc_line | `9243` |
| arbor_handler.name | `OM5` |
| arbor_handler.fqn | `claude-2.1.156::OM5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.156 bundle.js:+12371654

---

## Input Branching

The handler contains 5+ distinct state-check branches before the relaunch path executes. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/update invoked"]) --> B[Resolve process type via processTypeChecker]
    B --> C{Process type check}
    C -- "bg / daemon / daemon-worker" --> D[Emit tengu_update_refused\nReturn early — non-interactive process]
    C -- "interactive fg" --> E[Enumerate background tasks\nvia taskStateEnumerator]
    E --> F{Any task in 'running'\nor 'pending' state?}
    F -- "Yes" --> G["Return error:\n'Cannot /update while background\ntasks are running…'\n(bundle.js:+12369924)"]
    F -- "No" --> H{Session resumed from\ndifferent project directory?}
    H -- "Yes" --> I["Return error:\n'Cannot /update — this session was\nresumed from a different project\ndirectory…'\n(bundle.js:+12370165)"]
    H -- "No" --> J[Build relaunch argv\nvia argvBuilder]
    J --> K[Write SDK bridge message:\n'Switching to latest Claude Code…\nreconnecting'\n(bundle.js:+12370676)]
    K --> L[Wait for bridge flush\n(timeout: 2000 ms, bundle.js:+12370756)]
    L --> M[Tear down bridge:\nO.flush → O.teardown]
    M --> N[Resolve installation path\nvia installPathResolver]
    N --> O2[Spawn relaunch via execveWrapper\nwith --resume flag]
    O2 --> P([New process takes over])
```

Analysis basis: CC v2.1.156 bundle.js:+12369546 – +12370988

---

## Behavioral Spec

### 1. Process-Type Guard

```
async function updateCommandHandler(context):
    processType = getProcessType()          // resolves "bg", "daemon", "daemon-worker", or fg
    if processType in ["bg", "daemon", "daemon-worker"]:
        emit telemetry("tengu_update_refused")
        return                              // silently abort in non-interactive contexts
```

Analysis basis: CC v2.1.156 bundle.js:+12369546, +12369558

### 2. Background-Task Fence

```
    taskStates = enumerateTaskStates()      // iterates Object.values of running task map
    for each task in taskStates:
        if task.state in ["running", "pending"]:
            return errorMessage(
                "Cannot /update while background tasks are running — wait for them to finish, then try again."
            )
```

Task state literals `"running"` and `"pending"` confirmed at bundle.js:+12369821 and +12369843.
Error message literal confirmed at bundle.js:+12369924.

### 3. Project-Directory Drift Check

```
    currentDir  = process.cwd()
    sessionDir  = getSessionOriginalDirectory()
    if currentDir != sessionDir:
        return errorMessage(
            "Cannot /update — this session was resumed from a different project directory. "
            "Restart manually with --resume to continue on the latest version."
        )
```

Error message literal confirmed at bundle.js:+12370165.

### 4. Argument Vector Construction

```
    argv = buildRelanchArgv(originalArgv)
    // argvBuilder (Kj) calls path.basename on argv[0],
    // then reconstructs the argument list.
    // --resume is always appended (bundle.js:+12093807).
    // Additional flags forwarded: --add-dir, --allow-dangerously-skip-permissions,
    //                             --effort, --permission-mode (bundle.js:+12095331–+12095659).
    // Session state flags forwarded: --add-dir entries, cliArg/session values.
```

Analysis basis: CC v2.1.156 bundle.js:+12369708, +12370978

### 5. Allowed-Tools / Session-Config Propagation

```
    // Z_ reads appState fields: allowed_tools, disallowed_tools, avoid_prompts
    // v3 reads: effort, model
    // These are serialised into the relaunch argv so the new process
    // inherits the same tool permissions and model selection.
    sessionConfig = collectSessionFlags(appState)
```

Analysis basis: CC v2.1.156 bundle.js:+12370982, +12370988

### 6. Bridge Reconnection Message & Flush

```
    writeSdkBridgeMessage("Switching to latest Claude Code… reconnecting")
    // message type: "text" content block (bundle.js:+12369606)
    generateReconnectUUID = randomUUID()   // ni1 → crypto.randomUUID (bundle.js:+12370672)
    await flushWithTimeout(
        timeout = 2000,                    // ms (bundle.js:+12370756)
        label   = "bridge flush"           // (bundle.js:+12370761)
    )
    bridge.flush()
    bridge.teardown()
```

Analysis basis: CC v2.1.156 bundle.js:+12370652 – +12370797

### 7. Installation-Path Resolution

```
function resolveInstallationPath():
    // installPathResolver (A2H) logic:
    // 1. Calls claudeExecutableFinder (bh) which:
    //    a. Calls pathJoinHelper (AW8) to build:
    //       $HOME/.local/share/claude/versions/<version>/claude
    //       (literals: ".local" +7756573, "share" +7756582, "versions" +9059505)
    //    b. Calls binPathHelper (W_H) to build:
    //       $HOME/.local/share/claude/bin/claude
    //       (literal: "bin" +7756653)
    //    c. Checks Array.isArray result; picks first valid path
    // 2. Falls back to Bun.which("claude") (bundle.js:+1061699)
    // 3. Checks file existence via WQ1.stat (bundle.js:+12093755)
    return resolvedPath
```

Analysis basis: CC v2.1.156 bundle.js:+12370919, +12369460, +12369513

### 8. Relaunch via execve

```
function execveRelaunch(resolvedBinaryPath, argv, env):
    // JQ1 (execveWrapper):
    // 1. Resolves absolute path (jQ1.isAbsolute, process.cwd, process.chdir)
    // 2. Loads bun:ffi (bundle.js:+12092911)
    // 3. On macOS: opens /usr/lib/libSystem.B.dylib (bundle.js:+12092955)
    //    On Linux:  opens libc.so.6 (bundle.js:+12092984)
    // 4. Calls M.execve syscall, replacing the current process image
    // 5. On execve failure: writes error file via ij (txH.writeFileSync)
    //                       emits "relaunch_spawn_error" (bundle.js:+12094658)
    //                       falls back to PQ1.spawnSync with "inherit" stdio
    //                       then process.exit(128) (bundle.js:+12094795)

    removeAllProcessListeners()            // process.removeAllListeners (bundle.js:+12094376)
    setupSignalForwarding(["SIGINT","SIGHUP","beforeExit","exit"])
    execve(resolvedBinaryPath, argv, currentEnv)
```

Analysis basis: CC v2.1.156 bundle.js:+12094235 – +12094747

### 9. Pre-Relaunch Analytics Drain

```
    // Before execve, several async drains run in parallel (A2H):
    await Promise.all([
        analyticsFlush(timeout=30000, label="analytics flush timeout"),  // +12093992
        flushWithTimeout(timeout=30000, label="flush timeout (relaunch)"),// +12093874
        cleanupTimeout(label="cleanup timeout"),                          // +12093936
    ])
    drainIxH()   // f$A.drain — drains pending hook registrations (bundle.js:+58493)
```

Analysis basis: CC v2.1.156 bundle.js:+12093853 – +12093981

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — update refused | `tengu_update_refused` emitted when process type is bg/daemon/daemon-worker (bundle.js:+12369560) |
| Telemetry — scroll summary | `tengu_scroll_summary` emitted during session teardown path (bundle.js:+5329057) |
| Telemetry — fullscreen modes | `tengu_amber_creek`, `tengu_pewter_brook` emitted during terminal mode resolution (bundle.js:+3378328, +3378236) |
| Telemetry — background dispatch | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem` (bundle.js:+15478865, +15479444) |
| Telemetry — spare pool | `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_spawn`, `tengu_bg_spare_claim_fail` (bundle.js:+15480139, +15480260, +15478558, +15480523) |
| Telemetry — daemon control | `tengu_daemon_control` (bundle.js:+15514702) |
| Telemetry — config parse error | `tengu_config_parse_error` (bundle.js:+3210789) |
| Telemetry — feature flags | `tengu_feature_ok`, `tengu_feature_bad` (bundle.js:+965176, +965234) |
| Telemetry — memory | `tengu_bg_low_mem_mb` (bundle.js:+12714592) |
| Telemetry — sendclaim | `tengu_bg_sendclaim_failed` (bundle.js:+15459587) |
| SDK bridge message | Writes `"Switching to latest Claude Code… reconnecting"` (type `"text"`) before teardown |
| appState read | Reads `allowed_tools`, `disallowed_tools`, `avoid_prompts`, `effort`, `model` to forward to new process |
| appState write | `_.setAppState` called (bundle.js:+12370566); `Object.assign` merges state (bundle.js:+12370887) |
| Hook registration | `f$A.register` called via `_9` / `U4` during entry append; `f$A.drain` called before exec |
| Conversation log entry | `_.appendEntry` called (bundle.js:+12878631) with `"last-prompt"` key (bundle.js:+12878651) |
| File system | Reads version dirs under `$HOME/.local/share/claude/versions/`; may copy files via `bzH` config backup logic |
| Process replacement | `execve` replaces current process; no return on success |
| Error fallback | On execve failure: writes error file, calls `PQ1.spawnSync`, then `process.exit(128)` |
| isHidden | `true` — command is not shown in the help menu |

---

## Version History

| Version | Change |
|---|---|
| v2.1.156 | Initial analysis |

---

## Common Mistakes

1. **Running `/update` while background tasks are active.** The command refuses with an explicit error message if any task is in `"running"` or `"pending"` state. Wait for all background tasks to complete first.
2. **Running `/update` in a resumed session whose working directory has drifted.** If the session was started in directory A and then resumed in directory B, the command refuses. Use `--resume` explicitly after a manual restart.
3. **Expecting the command to appear in help output.** `isHidden: true` means `/update` is deliberately unlisted; it must be typed directly.
4. **Expecting it to work in daemon or background worker processes.** The process-type guard immediately aborts in `"bg"`, `"daemon"`, and `"daemon-worker"` contexts.
5. **Assuming the conversation is lost.** The `--resume` flag and session-config forwarding (allowed tools, model, effort) are intentionally propagated so the new process can restore context.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `OM5` | Main async handler for `/update` (arbor_handler) |
| `HI8` | Install-path entry point / top-level update orchestrator |
| `M$` | Binary locator — wraps `Bun.which("claude")` fallback |
| `BNA` | `Bun.which` call wrapper |
| `bh` | Claude executable finder (checks versioned and bin paths) |
| `AW8` | Path builder: `$HOME/.local/share/claude/versions/<v>/claude` |
| `g3` | Array-type checker (wraps `Array.isArray`) |
| `ELH` | Home-directory resolver (calls `Nl9.homedir`) |
| `dw8` | `os.homedir()` wrapper |
| `W_H` | Bin-path builder: `$HOME/.local/share/claude/bin/claude` |
| `V9` | Process-type checker (returns `"bg"`, `"daemon"`, etc.) |
| `VOH` | Process-type string constants provider |
| `d` | General utility / logging helper |
| `Kj` | Argv builder for relaunch (calls `path.basename`) |
| `k6` | Logging / output emitter |
| `ov` | Output writer primitive |
| `ak` | App-state accessor |
| `gHA` | Session directory resolver (uses `path.dirname`) |
| `$_` | Output writer variant |
| `cK` | Output writer variant 2 |
| `eAH` | Pre-relaunch state snapshot helper |
| `bs` | Background-task state checker (checks `Bj5` set) |
| `vy8` | Task state map accessor |
| `$8A` | Conversation log entry appender (appends `"last-prompt"`) |
| `U4` | Hook registration helper |
| `_9` | `f$A.register` wrapper |
| `_` | Global app-state store |
| `hH` | Error formatter / log-error helper |
| `F_` | Error constructor wrapper |
| `xH` | String conversion utility |
| `q1` | Error log queue flusher |
| `zEA` | Error string normaliser |
| `D84` | Log buffer shift/push manager |
| `IT` | Session-ID or message-ID generator helper |
| `O` | SDK bridge object (writeSdkMessages, flush, teardown) |
| `k8` | Bridge implementation |
| `ni1` | UUID generator (wraps `crypto.randomUUID`) |
| `nL` | Promise-race timeout utility |
| `bYH` | String coercion helper for argv |
| `A2H` | Full relaunch sequence executor (stat, drain, execve, exit) |
| `UX6` | Interval-clear helper |
| `hV_` | `clearInterval` wrapper |
| `rNH` | Terminal unmount / tty-write helper |
| `H` | Ink/renderer instance |
| `GR` | Terminal state reset helper |
| `Yq8` | Terminal output writer (ANSI sequences) |
| `DVH` | Terminal version/type detector |
| `MVH` | Terminal multiplex helper |
| `V0` | tmux/screen escape sequence wrapper |
| `u58` | Scroll-summary emitter |
| `fZ` | Scroll summary formatter |
| `TJ9` | Scroll summary config reader |
| `GJ9` | Timing/metrics helper (Date.now, Math.max, Math.round) |
| `PJ9` | Progress callback handler |
| `fq` | Fullscreen / terminal-mode resolver |
| `Z3H` | Terminal capability set checker |
| `oY_` | Terminal escape sequence writer |
| `Tr` | ANSI code builder |
| `N` | Terminal output normaliser (trim, toUpperCase, etc.) |
| `rY_` | Platform/OS detector (windows branch) |
| `i_` | Viewport / size helper |
| `o47` | Fullscreen mode setter |
| `E6` | Render/display state manager |
| `RT` | Retry/reconnect helper (calls `U4`) |
| `IxH` | `f$A.drain` wrapper |
| `m58` | Async cleanup orchestrator (Promise.all / Promise.race) |
| `Q8` | Process-abort helper (setTimeout, clearTimeout) |
| `K` | Worker/process list formatter (padEnd) |
| `q` | Unlink / cleanup file helper |
| `L` | Pending-task tracker (add/delete/finally) |
| `JQ1` | `execve` wrapper (FFI: libSystem/libc, `process.chdir`, `require`, `dlopen`) |
| `f` | Native library handle (dlopen result) |
| `A` | Process/worker registry map |
| `$` | Telemetry/session batch queue |
| `bo1` | Session event recorder |
| `w` | Background worker / process supervisor |
| `R` | Process-kill wrapper |
| `uH` | Process-stop handler |
| `yH` | Process-start handler |
| `eI8` | Memory-pressure checker |
| `FD6` | Config file reader (JSON parse + filter) |
| `B` | Settled-process reaper |
| `W5A` | Background spare-pool claimer (Unix socket connect) |
| `N5A` | Worker lifecycle manager (spawn/kill/roster) |
| `D` | Worker health monitor (freemem, Date.now, SIGKILL) |
| `J8` | Worker-state enum helper |
| `S` | Worker disposable wrapper |
| `M` | MCP manager (execve + client lifecycle) |
| `vSH` | MCP server connector (multi-transport: stdio/sse/http/ws-ide) |
| `JGK` | MCP connection result applier |
| `Gm5` | MCP retry orchestrator |
| `z` | Daemon stop coordinator (yH, uH, vy, km) |
| `vy` | Daemon output stream writer |
| `km` | Daemon shutdown sequencer (Promise.race, process.exit) |
| `ZH` | String-coerce wrapper (String()) |
| `ij` | Error-file writer (txH.writeFileSync) |
| `Gk8` | Relaunch argv assembler (Array.from, flag injection) |
| `T96` | Session-ID / arg-token helper |
| `b6` | Local update installer (file copy, watchFile) |
| `B6` | Installation base-path resolver |
| `vz_` | Version string comparator |
| `bzH` | Config backup + binary copy executor |
| `m6` | JSON.parse wrapper |
| `kb` | Path prefix stripper |
| `UBq` | Directory scanner (readdirStringSync, statSync) |
| `Sz_` | Backup sub-directory builder |
| `Y17` | File-watcher helper (fs.watchFile / unwatchFile) |
| `Mr` | File-watch callback handler |
| `Z_` | Session tool-permissions reader (allowed_tools, disallowed_tools, avoid_prompts) |
| `jE8` | Allowed-tools serialiser |
| `aA` | Tool-list formatter |
| `JE8` | Disallowed-tools serialiser |
| `v3` | Session model/effort reader (effort, model fields) |