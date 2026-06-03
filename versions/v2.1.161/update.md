---
type: feature-spec
feature: "update"
cc_version: "2.1.161"
updated: "2026-06-03"
tags: ["update", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.161 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/update`

> Analysis basis: CC v2.1.161 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.161

---

## Overview

`/update` switches the running Claude Code process to the latest installed version without terminating the current conversation. It validates preconditions (no active background tasks, matching working directory), serialises session state, flushes the output bridge, and then performs a live `execve`-style replacement of the current process with the new binary, passing `--resume` so the conversation continues seamlessly.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `update` |
| description | `Switch to the latest version (conversation continues)` |
| supportsNonInteractive | `false` |
| isHidden | `true` |
| module_id | `g6K` |
| load_inline | `true` |
| loc_byte | `12538408` |
| loc_byte_end | `12538649` |
| loc_line | `8787` |
| arbor_handler.name | `qNf` |
| arbor_handler.fqn | `claude-2.1.161::qNf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.161 bundle.js:+12538408

---

## Input Branching

Five distinct decision points exist in the handler, requiring a Mermaid flowchart.

```mermaid
flowchart TD
    A["/update invoked"] --> B{Background tasks\nrunning or pending?}
    B -- "Yes: 'running' or 'pending' tasks found" --> C["Emit tengu_update_refused\nReturn error message:\n'Cannot /update while background tasks…'"]
    B -- "No active tasks" --> D{Working directory\nmismatch?\n(resumed from different project)}
    D -- "Yes: cwd mismatch" --> E["Return error message:\n'Cannot /update — this session was resumed\nfrom a different project directory…'"]
    D -- "No mismatch / new session" --> F["Resolve 'claude' binary path\nand latest-version install dir\n(~/.local/share/versions/…/bin)"]
    F --> G{Latest binary\npath resolvable?}
    G -- "No binary found" --> H["Return early / no-op"]
    G -- "Binary found" --> I["Write 'Switching to latest Claude Code…\nreconnecting' message to SDK output"]
    I --> J["Set appState: persist session\nfor resume (assistant- prefix IDs,\nstop_sequence, message markers)"]
    J --> K["Flush output bridge\n(timeout: 2000 ms — 'bridge flush')"]
    K --> L["Tear down current I/O bridge"]
    L --> M["Build relaunch argv\n(--resume, --add-dir, --effort,\n--permission-mode, flag_settings, etc.)"]
    M --> N["Spin up replacement process\nvia GWH (execve / spawnSync +\nprocess.removeAllListeners +\nprocess signal rewiring)"]
    N --> O["Current process exits\n(process.exit / process.kill)"]
```

---

## Behavioral Spec

### 1. Precondition — Background Task Guard

The handler calls `checkBackgroundTaskStates` (identifier: `XS8`) to enumerate all current background tasks.

Analysis basis: CC v2.1.161 bundle.js:+12536214

```
function checkBackgroundTaskStates(appState):
    tasks = Object.values(appState.backgroundTasks)
    for each task in tasks:
        if task.status == "running" or task.status == "pending":
            return true   # blocking tasks exist
    return false
```

If blocking tasks are found, the handler records a `tengu_update_refused` event (bundle.js:+12536314) and returns the user-visible string:

> "Cannot /update while background tasks are running — wait for them to finish, then try again."

(bundle.js:+12536678)

### 2. Precondition — Working-Directory Consistency Check

The handler evaluates whether the session was resumed from a project directory that differs from the current working directory. This uses `getWorkingDirectoryState` (identifier: `C_`) together with `getAppState` (bundle.js:+12537166).

Analysis basis: CC v2.1.161 bundle.js:+12537736

```
function checkWorkingDirectory(appState):
    sessionWd  = appState.workingDirectory       # stored at session start
    currentWd  = process.cwd()
    if sessionWd is set and sessionWd != currentWd:
        return "mismatch"
    return "ok"
```

On mismatch the handler returns:

> "Cannot /update — this session was resumed from a different project directory. Restart manually with --resume to continue on the latest version."

(bundle.js:+12536919)

### 3. Version / Binary Path Resolution

`resolveInstallPaths` (identifier: `fS`) builds the path to the latest installed version:

Analysis basis: CC v2.1.161 bundle.js:+12536267

```
function resolveInstallPaths():
    home      = os.homedir()                          # via LX8 → Ct9.homedir
    shareDir  = path.join(home, ".local", "share")   # literals: ".local", "share"
    versionsDir = path.join(shareDir, "versions")     # literal: "versions"
    binDir    = path.join(versionsDir, <latest>, "bin")  # literal: "bin"
    return { versionsDir, binDir }
```

`findBinary` (identifier: `RM`) then calls `Bun.which("claude")` (bundle.js:+1065092) to confirm the executable is reachable. The string literal `"claude"` is found at bundle.js:+12536217.

### 4. Session State Serialisation Before Relaunch

Before replacing the process, `qNf` reads and updates `appState` to mark the session as resumable:

Analysis basis: CC v2.1.161 bundle.js:+12537166–12537320

```
function persistSessionForResume(appState):
    # Collect message IDs that begin with "assistant-" for the resume index
    resumeIds = messages
        .filter(m => m.id.startsWith("assistant-"))
        .map(m => m.id)

    appState = Object.assign(appState, {
        resumeSessionId  : <current session uuid>,
        stopSequenceHint : "stop_sequence",
        messageHint      : "message",
        resumeIds        : resumeIds
    })
    _.setAppState(appState)
```

Literals used: `"assistant-"` (bundle.js:+12537220), `"stop_sequence"` (bundle.js:+12535375), `"message"` (bundle.js:+12535413).

### 5. SDK Output — Relaunch Notification

`O.writeSdkMessages` (bundle.js:+12537406) pushes a single `text`-typed message to the SDK output channel:

> "Switching to latest Claude Code… reconnecting"

(bundle.js:+12537430)

A random UUID for the assistant turn is generated by `generateRelaunchMessageId` (identifier: `B6K`) via `PS8.randomUUID` (bundle.js:+12535287).

### 6. Bridge Flush and Teardown

Analysis basis: CC v2.1.161 bundle.js:+12537497–12537551

```
async function flushAndTeardown(bridge, timeout = 2000):
    # "bridge flush" — wait up to 2000 ms for in-flight writes
    await Promise.race([
        bridge.flush(),
        sleep(timeout)          # u7 → setTimeout / Promise.race / clearTimeout
    ])
    bridge.teardown()
```

Timeout constant: 2000 ms (bundle.js:+12537510). Label `"bridge flush"` (bundle.js:+12537515).

### 7. Relaunch Argument Construction

`buildRelaunchArgs` (identifier: `Uh8`) assembles the argv array for the replacement process:

Analysis basis: CC v2.1.161 bundle.js:+12537732

```
function buildRelaunchArgs(appState, sessionState):
    args = Array.from(process.argv)          # baseline argv
    args.push("--resume")                    # literal bundle.js:+12262479
    if addedDirs:
        for dir in addedDirs:
            args.push("--add-dir", dir)      # literal bundle.js:+12264003
    if effortSetting:
        args.push("--effort", effortSetting) # literal bundle.js:+12264314
    if permissionMode:
        args.push("--permission-mode", permissionMode) # literal bundle.js:+12264331
    if allowDangerouslySkipPermissions:
        args.push("--allow-dangerously-skip-permissions") # literal bundle.js:+12264172
    # flag_settings (bundle.js:+10824164) are propagated as cli args
    return args
```

`TK6` (bundle.js:+12263975) handles flag-setting serialisation; `q.includes` (bundle.js:+12264161) deduplicates flags.

### 8. Process Replacement (execve path via `GWH`)

`performRelaunch` (identifier: `GWH`) orchestrates the actual binary swap:

Analysis basis: CC v2.1.161 bundle.js:+12537673

```
async function performRelaunch(newBinaryPath, args):
    # 1. Verify new binary stat (Xa1.stat — bundle.js:+12262427)
    stat = await fs.stat(newBinaryPath)

    # 2. Stop current UI rendering
    #    stopSpinner (HW6) → clearInterval (mk_)
    #    teardownInk (TkH) → H.unmount, AJH.writeSync, rR, _K8

    # 3. Start scroll-summary / final render pass (r$8 → EE9, qq)

    # 4. Flush analytics (o$8 → Promise.all, n8; timeout 30000 ms "flush timeout (relaunch)")
    await withTimeout(analyticsFlush(), 30000)   # bundle.js:+12262546

    # 5. Change to session working directory (ja1 → process.chdir)
    #    Load native FFI if on macOS (/usr/lib/libSystem.B.dylib)
    #    or Linux (libc.so.6)

    # 6. Re-wire process signals
    process.removeAllListeners()                  # bundle.js:+12263048
    process.on("SIGINT", ...)                     # bundle.js:+12263078
    process.on("SIGHUP", ...)
    process.on("beforeExit", ...)                 # bundle.js:+12263194
    process.on("exit", ...)                       # bundle.js:+12263235

    # 7. Execute replacement binary
    #    Pa1.spawnSync (bundle.js:+12263105) with stdio: "inherit"
    #    On spawn error → log "relaunch_spawn_error", write file via VJ
    #    (lmH.writeFileSync — bundle.js:+191429)
    result = spawnSync(newBinaryPath, args, { stdio: "inherit" })
    if result.error:
        emit "relaunch_spawn_error"              # bundle.js:+12263330

    # 8. Exit current process (bundle.js:+12263354)
    process.exit(result.status ?? 128)           # 128 literal bundle.js:+12263467
```

The cleanup timeout is labeled `"cleanup timeout"` (bundle.js:+12262608); analytics flush timeout is labeled `"analytics flush timeout"` (bundle.js:+12262664) with a 500 ms sub-timeout (bundle.js:+5414858).

### 9. Session Context Propagation (C_ / d$)

`getSessionContextForResume` (identifier: `C_`) scans the message history for the last assistant turn:

Analysis basis: CC v2.1.161 bundle.js:+12537736

```
function getSessionContextForResume(appState):
    messages = appState.messages
    lastAssistant = messages.findLast(m => m.role == "assistant")
    context = {
        workingDirectory  : extract via BN8,   # literal "working_directory" bundle.js:+10823618
        allowedTools      : extract via BN8,   # literal "allowed_tools" bundle.js:+10823673
        disallowedTools   : extract via BN8,   # literal "disallowed_tools" bundle.js:+10823728
        avoidPrompts      : extract via BN8,   # literal "avoid_prompts" bundle.js:+10823789
    }
    return context
```

`getEffortAndModel` (identifier: `d$`) reads `effort`, `model`, and `max_thinking_tokens` fields (bundle.js:+10824113–10824138).

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_update_refused` | Fired when background tasks block the update (bundle.js:+12536314) |
| Telemetry — `tengu_feature_sad` | Fired on feature error path within the output relay (bundle.js:+966732) |
| Telemetry — `tengu_scroll_summary` | Fired during final render / scroll-summary before teardown (bundle.js:+5414569) |
| Telemetry — `tengu_amber_creek` | Fired from rendering subsystem during relaunch UI transition (bundle.js:+3419112) |
| Telemetry — `tengu_pewter_brook` | Fired from rendering subsystem during relaunch UI transition (bundle.js:+3419020) |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Fired if background worker SIGKILL escalation needed during teardown (bundle.js:+15904509) |
| Telemetry — `tengu_daemon_yield` | Fired if daemon yields to foreground service during relaunch (bundle.js:+15923216) |
| Telemetry — `tengu_feature_bad` | Error path in output relay (bundle.js:+966650) |
| Telemetry — `tengu_feature_ok` | Success path in output relay (bundle.js:+966587) |
| Telemetry — `tengu_bg_low_mem_mb` | Low-memory signal during background dispatch (bundle.js:+12883180) |
| Telemetry — `tengu_bg_dispatch_low_mem` | Emitted when worker dispatch is throttled due to low memory (bundle.js:+15905088) |
| Telemetry — `tengu_bg_spare_enable` | Spare worker pool activated (bundle.js:+15905783) |
| Telemetry — `tengu_bg_sendclaim_failed` | Background session claim failure (bundle.js:+15885155) |
| Telemetry — `tengu_bg_spare_claim` | Spare worker claimed (bundle.js:+15905904) |
| Telemetry — `tengu_bg_spare_claim_fail` | Spare worker claim failed (bundle.js:+15906167) |
| Telemetry — `tengu_daemon_control` | Daemon lifecycle control event during process replacement (bundle.js:+15940522) |
| Telemetry — `tengu_config_parse_error` | Config parse failure during session-state reading (bundle.js:+3251872) |
| appState changes | `resumeSessionId`, `stopSequenceHint`, `messageHint`, `resumeIds` written via `_.setAppState` before relaunch (bundle.js:+12537320) |
| SDK messages | `O.writeSdkMessages` emits one `text` message "Switching to latest Claude Code… reconnecting" (bundle.js:+12537406) |
| Bridge flush | `O.flush` called with 2000 ms timeout; `O.teardown` follows (bundle.js:+12537500–12537551) |
| Ink UI teardown | `H.unmount` + `AJH.writeSync` called to clear terminal UI (bundle.js:+5413114–5413036) |
| Signal handlers | All existing process listeners removed and SIGINT/SIGHUP/beforeExit/exit rewired prior to `spawnSync` (bundle.js:+12263048–12263235) |
| Process replacement | `Pa1.spawnSync` with `stdio: "inherit"`; on success current process exits with child's status code (bundle.js:+12263105–12263354) |
| Relaunch error file | On `spawnSync` failure, `VJ` writes an error record via `lmH.writeFileSync` (bundle.js:+191429) |
| Hook registration | `Y9` / `tYA.register` called during session-state persistence (bundle.js:+59405) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.161 | Initial analysis |

---

## Common Mistakes

1. **Running `/update` during active background tasks** — The command will immediately refuse with "Cannot /update while background tasks are running". Wait for all background tasks to reach a terminal state before retrying.

2. **Resumed session in a different directory** — If Claude Code was started with `--resume` but the working directory has since changed (e.g. `cd` to a different project), `/update` will refuse with the directory-mismatch error. Use a fresh `claude --resume` invocation instead.

3. **Expecting the command to be visible in `/help`** — `isHidden: true` means `/update` does not appear in the standard command list. It must be typed explicitly.

4. **Using `/update` in non-interactive mode** — `supportsNonInteractive: false` means the command is not available when Claude Code runs in a scripted/CI pipeline; invoking it there has no effect.

5. **Assuming an immediate binary upgrade** — `/update` switches to the already-installed latest version under `~/.local/share/versions/…/bin`. It does not download a new version; installation must have been completed by other means beforehand.

6. **Interrupting during the 2-second bridge-flush window** — Sending a signal between the flush start and the `spawnSync` call can leave the session in a partially-serialised state. The replacement process will still attempt a resume, but the conversation tail may be truncated.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `qNf` | Main async handler for `/update` (Arbor-resolved entry point) |
| `XS8` | Background-task state checker; delegates to `RM` |
| `RM` | Binary resolver wrapper; calls `Bun.which` via `CSA` |
| `CSA` | Low-level `Bun.which` wrapper |
| `fS` | Install-path resolver; builds `~/.local/share/versions` tree |
| `EG8` | Versions-directory enumerator; uses `_3` and `ZfH` |
| `_3` | Array normalisation utility |
| `ZfH` | Home-directory path builder (`.local/share`) |
| `LX8` | `os.homedir()` wrapper |
| `NAH` | Binary subdirectory path builder (`bin` under version dir) |
| `W9` | Async helper; spawns background operation via `bzH` |
| `bzH` | Background work scheduler (`bg`, `daemon`, `daemon-worker` modes) |
| `d` | Generic async utility / deferred promise |
| `gj` | Basename extractor; calls `w2.basename` + `N6` |
| `N6` | Logger / debug-output utility; calls `XN` |
| `XN` | Low-level log sink |
| `Gk` | App-state accessor helper |
| `ZqA` | Path-relative relaunch helper; calls `Ea1.dirname`, `wO`, `tK` |
| `P_` | Path resolution helper; calls `XN` |
| `tK` | Async path utility; calls `XN` |
| `K9H` | Session-ID generator / lookup |
| `ht` | Hook-type checker; calls `lR8` and `Sbf.has` |
| `lR8` | Hook registry reader |
| `B9A` | Session persistence writer; appends `last-prompt` entry via `_.appendEntry` |
| `a4` | Async entry writer; calls `Y9` |
| `Y9` | Hook registration via `tYA.register` |
| `yH` | Output relay / message forwarder; manages `xUH` push queue |
| `a_` | Error formatter |
| `pH` | String coercion utility |
| `r9` | Output routing helper; calls `qkA` |
| `qkA` | Queue-based output handler; calls `pH` |
| `s44` | Sliding-window buffer; operates `lg6.shift` / `lg6.push` |
| `nG` | Session-context extractor |
| `O` | SDK I/O bridge (writeSdkMessages, flush, teardown); backed by `u8` |
| `u8` | Underlying SDK transport |
| `B6K` | Relaunch-message UUID generator; calls `PS8.randomUUID` |
| `u7` | Timeout-race utility; `setTimeout` / `Promise.race` / `clearTimeout` |
| `oYH` | String serialiser; converts value to `String` |
| `GWH` | Core relaunch orchestrator (stat, teardown UI, analytics flush, execve) |
| `HW6` | Spinner stopper; calls `mk_` → `clearInterval` |
| `mk_` | Interval clearer |
| `TkH` | Ink UI teardown; calls `H.unmount`, `AJH.writeSync`, `rR`, `_K8` |
| `H` | Ink renderer / unmount coordinator |
| `N` | Bootstrap fetcher / HTTP utility |
| `s$` | Renderer state helper |
| `ne` | Render-flag checker; calls `WA4.has` |
| `Ij` | String replacement helper |
| `lq` | Layout calculator; calls `xHH`, `s9`, `xP` |
| `t6` | Render-frame utility; calls `d`, `h1H` |
| `rR` | Terminal write helper |
| `_K8` | Raw terminal output writer; calls `yo.writeSync`, `mvH`, `kvH`, `ZW`, `S$`, `N` |
| `mvH` | Terminal-capability detector; checks Ghostty ≥1.2.0, iTerm ≥3.6.6 |
| `kvH` | Terminal escape helper |
| `ZW` | Tmux/screen escape handler; calls `SJ_`, `H.replaceAll` |
| `S$` | Terminal state helper |
| `r$8` | Scroll-summary renderer; calls `IT`, `GE9`, `d`, `EE9`, `qq` |
| `IT` | Ink render trigger |
| `GE9` | Render-context builder |
| `EE9` | Metrics/timing helper; `Date.now`, `Math.max`, `Math.round`, `Object.assign`, `XE9` |
| `XE9` | Metrics aggregator |
| `qq` | Full-screen layout manager; calls `ne`, `pJ_`, `pH`, `Do`, `N`, `mJ_`, `t_`, `J0L`, `j6` |
| `pJ_` | Panel layout helper; calls `v1`, `pH` |
| `Do` | Dialog renderer; calls `j0L` |
| `mJ_` | Boolean flag resolver; calls `i6` |
| `t_` | Layout constraint resolver; calls `np` |
| `J0L` | Panel container; calls `j6` |
| `j6` | Component renderer; manages `gY6`, `QY6`, `Qx`, `QDH`, `Lq8`, `BY6`, `CU`, `y6` |
| `eG` | Analytics entry writer; calls `a4` |
| `EmH` | Analytics drain; calls `tYA.drain` |
| `o$8` | Analytics flush coordinator; `Promise.all`, `SV`, `Nd`, `H`, `_`, `Promise.race`, `n8` |
| `n8` | Process spawn manager; `K`, `Error`, `q`, `setTimeout`, `O`, `clearTimeout`, `L.unref` |
| `K` | Process output formatter; `L.map`, `f.padEnd` |
| `q` | Temp-file cleanup; `wSK.unlinkSync` |
| `L` | Promise lifecycle tracker; `q.add`, `f.finally`, `q.delete` |
| `ja1` | Working-directory changer + native FFI loader + execve path |
| `f` | Native module handle / FFI object |
| `A` | Module registry map |
| `$` | Session roster; calls `y_K` |
| `y_K` | Roster-entry recorder; `Zr`, `Date.now`, `$1`, `Fh6`, `SH` |
| `w` | Background-worker dispatcher |
| `S` | Background worker state machine; `D.write`, `d` |
| `RH` | Worker ready-state handler; calls `d`, `h1H` |
| `hH` | Worker idle-state handler; calls `d`, `h1H` |
| `ER8` | Low-memory background dispatcher; calls `i6`, `j6` |
| `rj6` | Config-file reader; `Y2.readFile`, `m0_`, `m6`, `Array.isArray`, `_.filter`, `k8`, `WbL` |
| `B` | Task retire helper; `B.retireIfSettled` |
| `DOA` | Background session connection handler; `Mg.claim`, `Mp8.connect`, `f.on/once/write/end` |
| `XOA` | Worker lifecycle manager; handles `done/killed/failed/crashed/blocked/working/active/idle` states |
| `Y` | Forced-shutdown helper; `WJ`, `process.exit`, `z.abort` |
| `v8` | Version/semver utility |
| `C` | Rate-limit event emitter; `_o1`, `y.enqueue`, `fj.randomUUID`, `N6` |
| `M` | Native execve wrapper; calls `nC6`, `f.has`, `w0.rm` |
| `nC6` | Path canonicaliser for execve; validates against `.staging`, `..` |
| `z` | Daemon lifecycle controller; `hH`, `RH`, `ly`, `qp` |
| `ly` | Daemon control event emitter; `gx`, `Ed.push`, `sVH`, `rw_` |
| `qp` | Daemon shutdown sequencer; `Promise.race/all`, `Gd`, `vd`, `n8`, `process.exit` |
| `TH` | String wrapper helper |
| `VJ` | Error-file writer; `lmH.writeFileSync`, `qQ8.join` |
| `Uh8` | Relaunch-argv builder; `Array.from`, `TK6`, `q.push`, `y6`, `q.includes`, `A.flatMap` |
| `TK6` | Flag-setting serialiser for argv |
| `y6` | Version-file watcher; `F6`, `S0`, `Dj_`, `nDH`, `Date.now`, `bXL` |
| `F6` | Version-directory path constant |
| `Dj_` | Directory stat helper |
| `nDH` | Version-file reader/migrator; filesystem operations, `rcq`, `Xj_` |
| `m6` | JSON parser wrapper |
| `Ox` | String prefix/slice utility |
| `rcq` | Backup-directory enumerator; `RY.basename/join/dirname`, `_.readdirStringSync/statSync` |
| `Xj_` | Backup path joiner; `RY.join`, `r8` |
| `bXL` | File watcher; `Pq8.watchFile/unwatchFile`, `F6`, `x9`, `Ox`, `Dj_`, `er`, `Y9` |
| `er` | Watch-event error handler |
| `C_` | Session-context extractor for resume; reads `working_directory`, `allowed_tools`, `disallowed_tools`, `avoid_prompts` via `BN8`/`FN8` |
| `BN8` | Session-context field extractor (allowed/disallowed tools, avoid_prompts); calls `tA` |
| `tA` | Context-field accessor |
| `FN8` | Session-context secondary extractor; calls `tA` |
| `d$` | Effort/model settings reader; reads `effort`, `model`, `max_thinking_tokens` |