---
type: feature-spec
feature: "update"
cc_version: "2.1.154"
updated: "2026-06-02"
tags: ["update", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.154 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/update`

> Analysis basis: CC v2.1.154 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.154

---

## Overview

The `/update` command performs an in-place version upgrade of Claude Code while preserving the active conversation. When invoked, it resolves the latest installed binary, validates that the current session is in a state safe for hot-swap, flushes all pending I/O, tears down the active process environment, and relaunches via `execve` so the new binary inherits the conversation context through a `--resume` flag.

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
| loc_byte | `12371393` |
| loc_byte_end | `12371634` |
| loc_line | `9243` |
| arbor_handler.name | `OM5` |
| arbor_handler.fqn | `claude-2.1.154::OM5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.154 bundle.js:+12371393

---

## Input Branching

The handler contains four or more distinct decision branches (background-tasks check, project-directory mismatch check, new-binary availability, and the final relaunch sequence), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/update invoked"]) --> B[Resolve install-type & binary path\nvia packageManager + homedir lookup]
    B --> C{Background tasks\nrunning or pending?}
    C -- Yes --> D["Emit tengu_update_refused\nReturn error:\n'Cannot /update while background tasks…'"]
    C -- No --> E{Session resumed from\ndifferent project directory?}
    E -- Yes --> F["Return error:\n'Cannot /update — this session was\nresumed from a different project…'"]
    E -- No --> G[Locate latest binary version\nin versions/ directory]
    G --> H{Newer binary\nfound?}
    H -- No --> I["No-op / inform user\nalready on latest"]
    H -- Yes --> J["Synthesize assistant message:\n'Switching to latest Claude Code…\nreconnecting'"]
    J --> K[Write SDK messages & flush output bridge\n(timeout: 2000 ms, label: 'bridge flush')]
    K --> L[Teardown active SDK session\nand MCP connections]
    L --> M[Flush analytics\n(timeout: 30000 ms, label: 'flush timeout (relaunch)')\nand cleanup\n(timeout: label: 'cleanup timeout')]
    M --> N[Build relaunch argv:\ncurrent args + --resume\n+ session path flags]
    N --> O[Strip/replace SIGINT & SIGHUP handlers\nspawnSync environment prep]
    O --> P["execve into new binary\n(macos: libSystem.B.dylib / linux: libc.so.6)"]
    P --> Q([New binary resumes conversation])
```

---

## Behavioral Spec

### 1. Entry Point — Handler Dispatch

The async handler (`OM5`, resolved via `module_id` → `ri1`) is the sole entry point for `/update`. It receives the current app-state context and conversation messages.

Analysis basis: CC v2.1.154 bundle.js:+12369285

### 2. Package-Manager and Install-Path Resolution

```
function resolveInstallPath():
    executableName = "claude"                       // literal at +12369202
    installType = detectInstallType(executableName) // calls packageManagerCheck (M$)
    if installType needs Bun:
        bunPath = Bun.which(executableName)         // +12369199 via M$→BNA→Bun.which
    versionsDir = path.join(
        homedir(),                                  // dw8 → Nl9.homedir +7756240
        ".local", "share", "versions"              // literals +7756513, +7756522, +9059445
    )
    binDir = path.join(homedir(), ".local", "share", "bin") // literal +7756593
    return { versionsDir, binDir, installType }
```

Analysis basis: CC v2.1.154 bundle.js:+12369199, +12369252

### 3. Pre-flight Safety Checks

```
function preflightChecks(appState, messages):
    // Check 1: background tasks
    backgroundStatuses = collectTaskStatuses()   // Object.values at +12369522
    if any task has status "running" or "pending":  // literals +12369560, +12369582
        emit telemetry("tengu_update_refused")      // +12369299
        return Error(
            "Cannot /update while background tasks are running — wait for them to finish, then try again."
            // literal +12369663
        )

    // Check 2: project directory mismatch
    if sessionResumedFromDifferentProjectDir(appState):
        return Error(
            "Cannot /update — this session was resumed from a different project directory. Restart manually with --resume to continue on the latest version."
            // literal +12369904
        )

    return OK
```

Analysis basis: CC v2.1.154 bundle.js:+12369522, +12369560, +12369663, +12369904

### 4. Binary Version Selection

```
function selectLatestBinary(versionsDir):
    entries = Array.from(readDir(versionsDir))     // Gk8 → Array.from +12094895
    // Filter and sort version directories (T96 comparator)
    candidates = entries
        .filter(isValidVersionDir)
        .flatMap(expandBinPaths)                   // A.flatMap +12095343
    // Exclude --allow-dangerously-skip-permissions if not in current argv
    // literal "--allow-dangerously-skip-permissions" at +12095239
    return highestVersion(candidates)
```

Analysis basis: CC v2.1.154 bundle.js:+12370717, +12094895

### 5. Assistant Reconnection Message Synthesis

```
function synthesizeReconnectMessage():
    uuid = randomUUID()                            // ni1 → ek8.randomUUID +12368272
    return {
        role: "assistant",                         // literal +12368248
        content: [{
            type: "text",                          // literal +12369345
            text: "Switching to latest Claude Code… reconnecting"  // literal +12370415
        }],
        stop_reason: "stop_sequence",              // literal +12368360
        messageType: "message"                     // literal +12368398
    }
```

Analysis basis: CC v2.1.154 bundle.js:+12370411, +12370415

### 6. Session State Snapshot and App-State Update

```
function snapshotAndUpdateState(appState):
    // Capture assistant-prefixed message IDs for resume
    // prefix "assistant-" at literal +12370205
    currentState = _.getAppState()                 // +12370151
    updatedState = IT(currentState, updatePayload) // +12370230
    _.setAppState(updatedState)                    // +12370305
```

Analysis basis: CC v2.1.154 bundle.js:+12370151, +12370230, +12370305

### 7. I/O Flush and SDK Teardown

```
async function flushAndTeardown(sdkBridge):
    // Write the reconnect message to the SDK output stream
    sdkBridge.writeSdkMessages(reconnectMessage)   // O.writeSdkMessages +12370391

    // Flush bridge with 2000 ms timeout
    await withTimeout(
        sdkBridge.flush(),                         // O.flush +12370485
        timeoutMs = 2000,                          // literal +12370495
        label    = "bridge flush"                  // literal +12370500
    )

    // Tear down the SDK session
    await sdkBridge.teardown()                     // O.teardown +12370536
```

Analysis basis: CC v2.1.154 bundle.js:+12370391, +12370485, +12370495, +12370536

### 8. Analytics Flush and Process Cleanup

```
async function flushAnalyticsAndCleanup():
    await withTimeout(
        analyticsFlush(),                          // A2H path +12093720
        timeoutMs = 30000,                         // literal +12093613
        label    = "flush timeout (relaunch)"      // literal +12093619
    )
    await withTimeout(
        cleanup(),
        label = "cleanup timeout"                  // literal +12093675
    )
    // Analytics sub-flush has its own 500 ms guard (literal +5329286)
    // and an outer "analytics flush timeout" label (literal +12093731)
```

Analysis basis: CC v2.1.154 bundle.js:+12093613, +12093619, +12093675, +12093720

### 9. Relaunch via execve

```
function buildRelaunchArgv(originalArgv, sessionPath, additionalDirs):
    argv = [...originalArgv]
    argv.push("--resume", sessionPath)             // "--resume" literal +12093546
    for dir of additionalDirs:
        argv.push("--add-dir", dir)                // "--add-dir" literal +12095070
    // Propagate --effort and --permission-mode if originally present
    // literals +12095381, +12095398
    // Strip --allow-dangerously-skip-permissions unless originally set
    return argv

function relauncher(newBinaryPath, argv, env):
    // Remove SIGINT / SIGHUP handlers   literals +12094086, +12094105
    process.removeAllListeners()                   // +12094115
    process.on("beforeExit", ...)                  // literals +12094261, +12094302
    // Spawn sync prep then execve
    PQ1.spawnSync(...)                             // +12094172
    // Use FFI execve:
    if platform == "macos":                        // literal +12092686
        lib = "/usr/lib/libSystem.B.dylib"         // literal +12092694
    else:
        lib = "libc.so.6"                          // literal +12092723
    loadFFI("bun:ffi", lib)                        // literal +12092650
    M.execve(newBinaryPath, argv, env)             // +12093049
    // On spawn error: write "relaunch_spawn_error" telemetry log
    // literal +12094397; exit code 128 at +12094534
```

Analysis basis: CC v2.1.154 bundle.js:+12093049, +12093546, +12094086, +12094172, +12094394

### 10. Session Flags Forwarded to New Binary

The following CLI flags are inspected and conditionally forwarded to the new binary invocation:

| Flag | Literal location |
|---|---|
| `--resume` | +12093546 |
| `--add-dir` | +12095070 |
| `--allow-dangerously-skip-permissions` | +12095239 |
| `--effort` | +12095381 |
| `--permission-mode` | +12095398 |

Analysis basis: CC v2.1.154 bundle.js:+12095070, +12095239, +12095381, +12095398

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_update_refused` | Fired when pre-flight rejects the update due to running/pending background tasks (bundle.js:+12369299) |
| Telemetry — `tengu_scroll_summary` | Fired inside the scroll/render path invoked during output flushing (bundle.js:+5328997) |
| Telemetry — `tengu_amber_creek` | Fired in the terminal-capability detection sub-path reached during UI teardown (bundle.js:+3378328) |
| Telemetry — `tengu_pewter_brook` | Companion terminal-capability event (bundle.js:+3378236) |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Fired if a background worker requires SIGKILL escalation during teardown (bundle.js:+15478604) |
| Telemetry — `tengu_feature_bad` / `tengu_feature_ok` | Feature-flag validation events surfaced during cleanup (bundle.js:+965234, +965176) |
| Telemetry — `tengu_bg_low_mem_mb` / `tengu_bg_dispatch_low_mem` | Low-memory guard events that may fire during background-session drain (bundle.js:+12714331, +15479183) |
| Telemetry — `tengu_bg_spare_*` | Spare-slot lifecycle events during background session management (bundle.js:+15479878, +15459326, +15479999, +15478297, +15480262) |
| Telemetry — `tengu_daemon_control` | Fired when the daemon is stopped/failed during teardown (bundle.js:+15514441) |
| Telemetry — `tengu_config_parse_error` | May fire if config backup/read encounters a parse error during the binary-selection scan (bundle.js:+3210789) |
| appState changes | `_.getAppState()` is read, merged with update payload via `IT`, and written back via `_.setAppState()` before the relaunch |
| SDK bridge | `O.writeSdkMessages`, `O.flush` (2 000 ms timeout), and `O.teardown` are called in sequence |
| Process signal handlers | All existing `SIGINT` and `SIGHUP` handlers are removed via `process.removeAllListeners()` before `execve` |
| File-system side effects | Config backups directory (`backups/`) may be read during version scanning; `ij` helper writes a file via `txH.writeFileSync` on spawn error |
| Hook registration | `f$A.register` is called during the cleanup chain (`_9`); `f$A.drain` is called via `IxH` before relaunch |
| Sound | None detected in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.154 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/update` with active background tasks** — The command is hard-blocked when any task reports status `"running"` or `"pending"`. Wait for all background tasks to complete before retrying.

2. **Invoking `/update` in a session resumed from a different project directory** — The execve relaunch requires a consistent working directory. If the session was moved, the command will refuse and instruct you to restart manually with `--resume`.

3. **Expecting interactive mode** — `supportsNonInteractive: false` and `isHidden: true` mean `/update` is an internal command intended only for interactive sessions. Calling it from scripts or non-interactive pipes is unsupported.

4. **Assuming the binary is always found via PATH** — Version resolution walks `~/.local/share/versions/` to find a newer binary, not `$PATH`. If the installation layout differs (e.g., custom `XDG_DATA_HOME`), the command may silently determine no newer binary is available.

5. **Interrupting the flush window** — There is a hard 2 000 ms timeout on the bridge flush and a 30 000 ms timeout on the analytics flush. Sending SIGINT during this window may leave the session in a partially-torn-down state because signal handlers are removed just before `execve`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `OM5` | Main `/update` async handler (Arbor-resolved via module_id `ri1`) |
| `HI8` | Install-type resolution entry; calls binary-path lookup and package-manager check |
| `M$` | Package-manager checker; delegates to `BNA` → `Bun.which` |
| `BNA` | Bun binary locator; calls `Bun.which` |
| `bh` | Version-directory path builder; assembles `versions/` path under `~/.local/share` |
| `AW8` | Directory listing / array helper used during version-path construction |
| `g3` | Array normalisation helper (calls `Array.isArray`) |
| `ELH` | Home-directory segment resolver; calls `dw8` → `Nl9.homedir` |
| `dw8` | OS homedir wrapper (`Nl9.homedir`) |
| `W_H` | Binary (`bin/`) sub-path assembler under home |
| `V9` | App-role classifier (bg / daemon / daemon-worker guard) |
| `VOH` | Role constants provider |
| `c` | Generic context/config accessor used throughout |
| `Kj` | Basename + process-name resolver called during binary identification |
| `k6` | Logging / error-reporting utility |
| `ov` | Core logger sink |
| `ak` | App-state accessor helper |
| `gHA` | Executable-directory resolver; uses `TQ1.dirname` and `vO` |
| `$_` | Path component utility (calls `ov`) |
| `cK` | Secondary path utility (calls `ov`) |
| `eAH` | Task-status enumerator for background-task pre-flight |
| `bs` | Background-task status checker; tests against `Bj5` set |
| `vy8` | Background-task status set provider |
| `$8A` | Conversation-entry appender; calls `U4` and `_.appendEntry` |
| `U4` | Entry factory; calls `_9` → `f$A.register` |
| `_9` | Hook registration shim (`f$A.register`) |
| `hH` | Output/log line writer; calls `F_`, `xH`, `q1`, `D84`, `QmH.push`, `Li.logError` |
| `F_` | Error formatter (wraps `Error` and `String`) |
| `xH` | String coercion utility |
| `q1` | Log-entry serialiser; calls `zEA` |
| `zEA` | Inner serialiser; calls `xH` |
| `D84` | Circular log-buffer manager (`LB6.shift` / `LB6.push`) |
| `IT` | App-state merge/update function |
| `O` | SDK bridge object (`writeSdkMessages`, `flush`, `teardown`) |
| `k8` | SDK bridge factory/initialiser |
| `ni1` | UUID generator for synthesised assistant messages (`ek8.randomUUID`) |
| `nL` | Timeout-race utility (`setTimeout`, `Promise.race`, `clearTimeout`) |
| `bYH` | String coercion wrapper used in argv construction |
| `A2H` | Core relaunch orchestrator: stat check, teardown, execve |
| `UX6` | Interval-clear helper (`hV_` → `clearInterval`) |
| `hV_` | Interval canceller |
| `rNH` | Terminal render unmount helper; calls `H.unmount`, `Yq8`, `xH` |
| `H` | Ink/React render instance |
| `GR` | Post-unmount cleanup routine |
| `Yq8` | Terminal restore helper; emits escape sequences and calls `DVH`, `MVH`, `V0` |
| `DVH` | Terminal-emulator detection (Ghostty ≥ 1.2.0, iTerm.app ≥ 3.6.6) |
| `MVH` | Terminal post-restore routine |
| `V0` | tmux / screen escape-sequence writer |
| `u58` | Scroll-summary flush coordinator; calls `fZ`, `TJ9`, `GJ9`, `fq` |
| `fZ` | Pre-flush helper |
| `TJ9` | Flush stage helper |
| `GJ9` | Scroll-metrics calculator (`Date.now`, `Math.max`, `Math.round`) |
| `PJ9` | Scroll-metrics finaliser |
| `fq` | Full-screen/terminal-mode teardown; calls `Z3H`, `oY_`, `Tr`, `N`, `rY_`, `i_`, `o47`, `E6` |
| `Z3H` | Terminal-capability registry check (`baK.has`) |
| `oY_` | Terminal-option resolver |
| `Tr` | Terminal restore sequence writer (`r47`) |
| `N` | Platform/environment classifier (debug, fullscreen, windows, etc.) |
| `rY_` | Boolean-option resolver |
| `i_` | Viewport helper (`vp`) |
| `o47` | Alternate-screen disabler |
| `E6` | React/Ink component renderer |
| `RT` | Pending-entry flusher; calls `U4` |
| `IxH` | Hook drain caller (`f$A.drain`) |
| `m58` | Analytics flush coordinator (`Promise.all`, `Promise.race`, `Q8`) |
| `Q8` | Process-exit sequence with abort signal and cleanup (`q.unlinkSync`, `setTimeout`) |
| `K` | Padding/display utility (`L.map`, `f.padEnd`) |
| `q` | Lock-file cleanup helper (`PEK.unlinkSync`) |
| `L` | Promise-tracking set (`q.add`, `f.finally`, `q.delete`) |
| `JQ1` | execve relaunch function; constructs argv, loads FFI, calls `M.execve` |
| `f` | FFI library handle (`A.close`, `q.close`) |
| `A` | FFI symbol accessor |
| `$` | Process roster / active-session tracker |
| `bo1` | Session roster entry creator |
| `w` | Background-session manager (SIGKILL escalation, spare-slot logic, daemon dispatch) |
| `R` | Supervisor process handler |
| `uH` | `daemon_bg_session_create` telemetry helper |
| `yH` | `dup_retry_exhausted` telemetry helper |
| `eI8` | Low-memory detector (`tengu_bg_low_mem_mb`) |
| `FD6` | Config-file reader (`QP.readFile`, JSON parse) |
| `B` | MCP client filter (`pH.filter`, `cH.has`) |
| `W5A` | Background-session claim/connect handler (`CF.claim`, `bb8.connect`) |
| `N5A` | Background-session lifecycle manager (done/killed/failed/crashed/blocked/working/active states) |
| `D` | Daemon-slot allocator/disposer |
| `J8` | Daemon-slot state object |
| `S` | Spare-slot disposable |
| `M` | MCP manager (`vSH`, `JGK`, `Gm5`) |
| `vSH` | MCP server connection driver (stdio/sse/http/sse-ide/ws-ide) |
| `JGK` | MCP connection-result applier (`H.applyMcpUpdate`) |
| `Gm5` | MCP retry / global-client coordinator |
| `z` | SDK output writer (`yH`, `uH`, `vy`, `km`) |
| `vy` | Output-stream writer (`fx`, `lQ.push`, `yEH`, `Mz_`) |
| `km` | Daemon-stop sequencer (`Promise.race`, `process.exit`) |
| `ZH` | String coercion wrapper |
| `ij` | Error-state file writer (`txH.writeFileSync`) |
| `Gk8` | Version-directory scanner and argv builder (`Array.from`, `T96`, `A.flatMap`) |
| `T96` | Version comparator/sorter |
| `b6` | Bundle/config reader orchestrator (`bzH`, `Y17`) |
| `B6` | Bundle base-path resolver |
| `vz_` | Version-string extractor |
| `bzH` | Config-file parser with backup logic (`q.readFileSync`, `q.mkdirSync`, `q.copyFileSync`) |
| `m6` | JSON parse wrapper |
| `kb` | String prefix/slice utility |
| `UBq` | Config-directory scanner (`_.readdirStringSync`, `fD.join`) |
| `Sz_` | Backup-path builder (`fD.join`, `l8`) |
| `Y17` | File-watcher setup (`B88.watchFile`, `B88.unwatchFile`) |
| `Mr` | Watch-event handler |
| `Z_` | Session allowed/disallowed tools resolver (`jE8`, `JE8`) |
| `jE8` | Allowed-tools state reader (`aA`) |
| `aA` | Tool-list accessor |
| `JE8` | Disallowed-tools state reader (`aA`) |
| `v3` | Session effort/model resolver (`H.getAppState`) |

---

*Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.*