---
type: feature-spec
feature: "update"
cc_version: "2.1.177"
updated: "2026-06-13"
tags: ["update", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.177 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/update`

> Analysis basis: CC v2.1.177 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.177

---

## Overview

`/update` is a hidden local slash command that upgrades the running Claude Code process to the latest installed version while preserving the current conversation context. It performs a series of safety checks (background work, project-directory alignment, session state), then tears down the current process bridges and relaunches the binary via `execve`, passing `--resume` so the conversation continues uninterrupted.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `update` |
| description | `Switch to the latest version (conversation continues)` |
| isHidden | `true` |
| supportsNonInteractive | `false` |
| module_id | `dJK` |
| load_inline | `true` |
| loc_byte | `13010473` |
| loc_byte_end | `13010714` |
| loc_line | `9173` |
| arbor_handler.name | `o65` |
| arbor_handler.fqn | `claude-2.1.177::o65` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.177 bundle.js:+13010473

---

## Input Branching

Six distinct decision points exist between command invocation and relaunch; a flowchart is mandatory.

```mermaid
flowchart TD
    A(["/update invoked"]) --> B{Background work\nrunning or pending?}
    B -- yes --> C["Emit tengu_update_refused\nReturn error message:\n'Cannot /update while work is running…'"]
    B -- no --> D{Resolve binary path\nvia Bun.which('claude')}
    D -- not found --> E["Return error / no-op"]
    D -- found --> F{Detect package manager\npath via versions dir\n~/.local/share/versions}
    F --> G{Session resumed from\ndifferent project directory?}
    G -- yes --> H["Return error message:\n'Cannot /update — this session was\nresumed from a different project…'"]
    G -- no --> I["Build relaunch argv\n(--resume, cliArgs, --add-dir,\n--effort, --permission-mode, …)"]
    I --> J["Write last-prompt entry\nto conversation log"]
    J --> K["Read current appState\n(getAppState)"]
    K --> L["Patch appState:\nset 'assistant-' prefix fields,\nwrite SDK messages"]
    L --> M["Display status message:\n'Switching to latest Claude Code…\nreconnecting'"]
    M --> N["Flush bridge (timeout 2000 ms)\nlabelled 'bridge flush'"]
    N --> O["Teardown bridge (O.teardown)"]
    O --> P["Cleanup / drain analytics\n(timeouts: 30000 ms flush,\ncleanup, analytics)"]
    P --> Q["Rewrite signal handlers\n(remove SIGINT/SIGHUP,\nregister beforeExit/exit)"]
    Q --> R["Spawn new process via\nNzK.spawnSync / VzK execve\nwith --resume + rebuilt argv"]
    R --> S["process.exit / process.kill\nto terminate current process"]
    S --> T([Session continues in new binary])
```

---

## Behavioral Spec

### 1. Safety Guard — Background Work Check

```
async function guardBackgroundWork(appState):
    statuses = Object.values(appState.backgroundTasks)
    if any status is "running" or "pending":
        emit telemetry("tengu_update_refused")
        return error("Cannot /update while work is running in the background — " +
                     "wait for it to finish, then try again.")
    return OK
```

Analysis basis: CC v2.1.177 bundle.js:+13008375 (telemetry), +13008636 ("running"), +13008658 ("pending"), +13008739 (error string)

---

### 2. Binary & Version Path Resolution

```
function resolveBinaryPath():
    claudePath = Bun.which("claude")          // E3 → JUA
    if not claudePath:
        return null
    return claudePath

function resolveVersionsDir():
    home = os.homedir()                        // X08 → Ke9.homedir
    versionsDir = path.join(home, ".local", "share", "versions")  // k3H, s9H
    binDir = path.join(home, ".local", "share", "bin")
    return { versionsDir, binDir }
```

Analysis basis: CC v2.1.177 bundle.js:+13008275 (LQ8→E3), +860759 (Bun.which), +6953295 (homedir), +6953568 (".local"), +6953577 ("share"), +9621096 ("versions"), +6953648 ("bin")

---

### 3. Project-Directory Alignment Check

```
function checkProjectDirectoryAlignment(appState, currentWorkingDir):
    resumedFrom = appState.working_directory   // literal "working_directory"
    if resumedFrom is set AND resumedFrom != currentWorkingDir:
        return error("Cannot /update — this session was resumed from a different " +
                     "project directory. Restart manually with --resume to continue " +
                     "on the latest version.")
    return OK
```

Analysis basis: CC v2.1.177 bundle.js:+13008983 (error string), +10760712 ("working_directory")

---

### 4. Relaunch Argument Assembly

```
function buildRelaunchArgv(currentArgv, appState):
    args = Array.from(currentArgv)             // kg8 → Array.from

    // Propagate session ID
    sessionArg = extract session from appState // literal "session"
    args.push(sessionArg)

    // Append --add-dir entries from current allowed dirs
    addDirArgs = currentAllowedDirs.flatMap(d => ["--add-dir", d])
    args.push(...addDirArgs)                   // literal "--add-dir"

    // Forward effort flag if present
    if appState.effort:
        args.push("--effort", appState.effort) // literal "--effort"

    // Forward permission-mode if present
    if appState.permission_mode:
        args.push("--permission-mode", appState.permission_mode)
        // literal "--permission-mode"

    // Strip --allow-dangerously-skip-permissions when bypassing is disabled
    // literal "--allow-dangerously-skip-permissions"

    // Always append --resume
    args.push("--resume")                      // literal "--resume"

    return args
```

Analysis basis: CC v2.1.177 bundle.js:+12730588 (Array.from), +12730763 ("--add-dir"), +12731020 ("--effort"), +12731037 ("--permission-mode"), +12730878 ("--allow-dangerously-skip-permissions"), +12729239 ("--resume"), +12730684 ("session")

---

### 5. Session State Snapshot (appState patch)

```
function snapshotSessionState(appState, conversationMessages):
    // Locate the last assistant-prefixed message
    lastAssistantMsg = conversationMessages.findLast(
        m => m.role.startsWith("assistant-")  // literal "assistant-"
    )

    // Persist tool settings into relaunch context
    snapshot = {
        allowed_tools:      appState.allowed_tools,
        disallowed_tools:   appState.disallowed_tools,
        avoid_prompts:      appState.avoid_prompts,
        bypassPermissions:  appState.bypassPermissions,
        permission_mode:    appState.permission_mode,
        effort:             appState.effort,
        model:              appState.model,
        max_thinking_tokens: appState.max_thinking_tokens,
        flag_settings:      appState.flag_settings,
    }

    _.setAppState(snapshot)
    O.writeSdkMessages(conversationMessages)   // O → p8

    return snapshot
```

Analysis basis: CC v2.1.177 bundle.js:+13009285 ("assistant-"), +13009231 (getAppState), +13009385 (setAppState), +13009471 (writeSdkMessages), +10760767 ("allowed_tools"), +10760822 ("disallowed_tools"), +10760883 ("avoid_prompts"), +10761016 ("bypassPermissions"), +10760985 ("permission_mode"), +10761340 ("effort"), +10761353 ("model"), +10761365 ("max_thinking_tokens"), +10761391 ("flag_settings")

---

### 6. Bridge Flush and Teardown

```
async function flushAndTeardown(bridge, outputStream):
    // Display user-facing status
    displayStatusMessage("Switching to latest Claude Code… reconnecting")
    // literal at +13009495

    // Generate a fresh UUID for the relaunch session
    newSessionId = gJK()   // fQ8.randomUUID internally

    // Flush with 2000 ms timeout
    await withTimeout(bridge.flush(), 2000, "bridge flush")
    // number literal 2000 at +13009575, string literal at +13009580

    bridge.teardown()
```

Analysis basis: CC v2.1.177 bundle.js:+13009491 (gJK), +13009495 ("Switching…"), +13009562 (E4/timeout), +13009565 (flush), +13009616 (teardown)

---

### 7. Cleanup and Relaunch Sequence

```
async function cleanupAndRelaunch(newBinary, argv):
    // Run parallel cleanup with timeouts
    await Promise.all([
        withTimeout(flushOutputQueue(),   30000, "flush timeout (relaunch)"),
        withTimeout(cleanupResources(),   30000, "cleanup timeout"),
        withTimeout(drainAnalytics(),     30000, "analytics flush timeout"),
    ])
    // number 30000 at +12729306; strings at +12729312, +12729368, +12729424

    // Replace signal handlers
    process.removeAllListeners()
    process.on("SIGINT",  noopHandler)
    process.on("SIGHUP",  noopHandler)
    process.on("beforeExit", relaunchCallback)
    process.on("exit",       relaunchCallback)

    // Attempt execve-style replacement (macOS: libSystem.B.dylib, Linux: libc.so.6)
    NzK.spawnSync(newBinary, argv, { stdio: "inherit" })
    // OR VzK → M.execve for in-process replacement

    // If execve failed, write error marker, then:
    process.exit(128)  // number literal 128 at +12730227
    // OR process.kill(process.pid, "SIGTERM")
```

Analysis basis: CC v2.1.177 bundle.js:+12729285 (Promise.all), +12729808 (removeAllListeners), +12729838 (process.on), +12729865 (spawnSync), +12729900 ("inherit"), +12729954 ("beforeExit"), +12729995 ("exit"), +12728742 (M.execve), +12730114 (process.exit), +12730179 (process.kill), +12730090 ("relaunch_spawn_error"), +12728387 ("/usr/lib/libSystem.B.dylib"), +12728416 ("libc.so.6")

---

### 8. Hook / Attachment Guard

```
function checkAttachmentAndHookState(appState):
    hasAttachments = g6H(appState)      // checks Y45.has for "ant" tagged items
    // literal "attachment" at +13585495
    // literal "hook_success" at +13585529
    // literal "ant" at +13585670

    if wjA is active (pending hooks):
        // Store last-prompt entry via _.appendEntry("last-prompt")
        // literal "last-prompt" at +13545296
        pass
```

Analysis basis: CC v2.1.177 bundle.js:+13009174 (g6H), +13585662 (ld8), +13585677 (Y45.has), +13009203 (wjA), +13545276 (_.appendEntry)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_update_refused` | Fired when background tasks are `running` or `pending` (bundle.js:+13008375) |
| Telemetry: `tengu_scroll_summary` | Fired during relaunch scroll/terminal state capture (bundle.js:+7432100) |
| Telemetry: `tengu_amber_creek` | Fired on fullscreen detection path (bundle.js:+3528498) |
| Telemetry: `tengu_pewter_brook` | Fired on alternate fullscreen detection path (bundle.js:+3528406) |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Fired if background daemon requires SIGKILL escalation (bundle.js:+16983179) |
| Telemetry: `tengu_scheduled_task_missed` | Fired for missed scheduled background tasks (bundle.js:+16468672) |
| Telemetry: `tengu_feature_bad` / `tengu_feature_ok` | Feature-flag check results (bundle.js:+1018825 / +1018758) |
| Telemetry: `tengu_bg_low_mem_mb` | Low-memory condition in background session (bundle.js:+13373708) |
| Telemetry: `tengu_bg_dispatch_low_mem` | Low-memory dispatch in background (bundle.js:+16983780) |
| Telemetry: `tengu_bg_spare_enable` | Spare background session enabled (bundle.js:+16984484) |
| Telemetry: `tengu_bg_sendclaim_failed` | Background session claim failed (bundle.js:+16961017) |
| Telemetry: `tengu_bg_spare_claim` | Spare session successfully claimed (bundle.js:+16984612) |
| Telemetry: `tengu_bg_spare_claim_fail` | Spare session claim failure (bundle.js:+16984878) |
| Telemetry: `tengu_daemon_control` | Daemon lifecycle control event (bundle.js:+17020740) |
| Telemetry: `tengu_config_parse_error` | Config file parse error during relaunch prep (bundle.js:+3338219) |
| Telemetry: `tengu_disable_bypass_permissions_mode` | Bypass permissions mode disabled during argv strip (bundle.js:+4296005) |
| `appState` changes | `setAppState` called with tool settings snapshot before relaunch; `writeSdkMessages` persists conversation (bundle.js:+13009385, +13009471) |
| `last-prompt` log entry | `_.appendEntry("last-prompt")` written via `wjA` before relaunch (bundle.js:+13545276) |
| Signal handler replacement | `process.removeAllListeners()` then re-registers SIGINT/SIGHUP/beforeExit/exit (bundle.js:+12729808) |
| Bridge flush | `O.flush()` called with 2000 ms timeout; `O.teardown()` follows (bundle.js:+13009565, +13009616) |
| Analytics drain | `qQH` → `XyA.drain` with 30 000 ms timeout (bundle.js:+12729357, +65246) |
| Process replacement | `NzK.spawnSync` / `VzK` → `M.execve` replaces the process image; falls back to `process.exit(128)` on failure (bundle.js:+12729865, +12728742, +12730114) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.177 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/update` while background tasks are active** — The command will refuse with the "Cannot /update while work is running…" error. Wait for all background tasks to reach a terminal state before retrying.
2. **Using `/update` in a session resumed from a different project directory** — The directory-mismatch guard will block execution. The user must restart manually with `--resume` pointing to the correct directory.
3. **Expecting `/update` to be visible in the slash-command menu** — The command is registered with `isHidden: true` and will not appear in autocomplete or help listings.
4. **Expecting interactive prompts** — `supportsNonInteractive: false` means the command relies on live terminal state; running it from a non-interactive pipeline is unsupported.
5. **Assuming the process stays alive during the update** — The relaunch uses `execve`-style process replacement. Any state not serialised into `appState` / `writeSdkMessages` before the teardown is lost.
6. **Interrupting during the 2 000 ms bridge-flush window** — Killing the process during flush can corrupt the SDK message log, preventing the resumed session from loading conversation history.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `o65` | Main async handler for `/update` (arbor_handler; AsyncFunction) |
| `LQ8` | Binary/path resolution helper (calls E3 and LC) |
| `E3` | `Bun.which("claude")` wrapper |
| `JUA` | Inner Bun.which invocation |
| `LC` | Versions-directory path builder |
| `SR8` | Versions path sub-helper (joins home + "versions") |
| `G$` | `Array.isArray` guard utility |
| `k3H` | Home-relative `.local/share` path resolver |
| `X08` | `os.homedir()` wrapper |
| `s9H` | `bin` sub-directory path resolver |
| `E9` | Background process type checker (`bg`/`daemon`/`daemon-worker`) |
| `BjH` | Background role constants holder |
| `d` | Generic logging / debug utility |
| `nJ` | Path-basename + feature-flag lookup helper |
| `I6` | Feature-flag evaluator |
| `eG` | Core feature-flag registry |
| `Qh` | String/path utility (used in relaunch path building) |
| `nYA` | Relaunch path construction helper (dirname + join) |
| `T_` | String normalisation utility |
| `bf` | Supplementary string utility |
| `IfH` | Session-context inspector |
| `g6H` | Attachment / hook-state checker (checks `Y45.has`) |
| `ld8` | Attachment-state reader |
| `wjA` | Last-prompt log writer (appends `"last-prompt"` entry) |
| `P4` | Log-entry constructor |
| `m9` | Hook registration via `XyA.register` |
| `_` | App-state / conversation store accessor |
| `kH` | Error-log / telemetry flush helper |
| `jA` | Error wrapper utility |
| `A6` | String coercion helper |
| `qq` | Telemetry queue flusher |
| `ScA` | Telemetry string formatter |
| `hUf` | Circular-buffer shift/push for event queue |
| `$J` | AppState assistant-message patcher |
| `O` | SDK bridge object (`flush`, `teardown`, `writeSdkMessages`) |
| `p8` | SDK message serialiser |
| `gJK` | UUID generator (`fQ8.randomUUID`) |
| `E4` | Promise-race timeout utility |
| `IPH` | String conversion helper used in Object.assign patch |
| `yZH` | Full relaunch orchestrator (cleanup, signal reset, execve) |
| `By6` | Interval-clearing helper (`si_` → `clearInterval`) |
| `si_` | Interval cancel wrapper |
| `XxH` | Terminal teardown helper (unmount, writeSync, `_R`) |
| `H` | Ink/render instance (unmount method) |
| `_R` | Render cleanup sub-utility |
| `sO8` | Terminal output flush helper |
| `OSH` | Terminal version / emulator detection (Ghostty, iTerm2) |
| `_SH` | Terminal secondary cleanup |
| `i0` | tmux escape-sequence handler |
| `L5` | Terminal line-state helper |
| `N` | ANSI / string formatting utility |
| `ZT8` | Scroll-summary capture helper |
| `N0` | Scroll-state reader |
| `x1q` | Scroll dimension calculator |
| `b1q` | Scroll metrics (Date.now, Math.max, Math.round, Object.assign) |
| `R1q` | Scroll result writer |
| `I1` | Full-screen / rendering mode resolver |
| `L_H` | Buffer-existence check (`buf.has`) |
| `eh_` | String/encoding helper for rendering |
| `Zt` | Rendering condition evaluator |
| `th_` | Platform (windows) detection for rendering |
| `n_` | GPU / rendering flag reader |
| `oc4` | Rendering option combiner |
| `$6` | Message-queue dispatcher (W06, G06, em, KXH, X06, qg, R6) |
| `QZ` | Log-entry queue flusher |
| `qQH` | Analytics drain caller (`XyA.drain`) |
| `WxH` | Ink re-render helper (TT8, H) |
| `TT8` | Ink render invocation |
| `VzK` | execve / process-replacement helper (dlopen, Buffer.from, BigInt) |
| `L` | Native FFI library handle (dlopen result) |
| `A` | FFI symbol handle |
| `q` | FFI / socket connection set |
| `f` | FFI connection lifecycle helper |
| `$` | FFI module loader (FPK) |
| `FPK` | FFI call wrapper (Date.now, n9, dU6, CH) |
| `D` | Background-daemon supervisor loop |
| `b` | Background session object (kill, map, roster) |
| `l8` | Async with-timeout utility (setTimeout, clearTimeout) |
| `bH` | Background session event handler (tH) |
| `IH` | Background session init handler (tH) |
| `Dd8` | Low-memory telemetry emitter |
| `aSH` | Artifact / file cleanup helper (lstat, rm, readFile) |
| `Q` | Unix-socket IPC client (connect, drain, destroy) |
| `EVA` | Background session claim handler (socketAuth, dlopen) |
| `yVA` | Background session lifecycle FSM (done/killed/failed/crashed/blocked/working/active/idle) |
| `Y` | Forced-shutdown handler (process.exit, z.abort) |
| `Z8` | Event-emitter helper |
| `tH` | Low-level timer/nM6 utility |
| `B` | Disposable resource handle |
| `M` | MCP update handler (LbH, _o8, yZA) |
| `LbH` | MCP connection builder (stdio/sse/http/sse-ide/ws-ide) |
| `_o8` | MCP connection result applier (applyMcpUpdate) |
| `yZA` | MCP retry / reconnect manager |
| `z` | Daemon stop helper (IH, bH, gS, hB) |
| `gS` | Daemon stop signal sender (Fm, iyH, L2_) |
| `hB` | Daemon stop wait loop (Promise.race/all, process.exit) |
| `TH` | String coercion thin wrapper |
| `kX` | Relaunch error marker writer (writeFileSync, CH_.join) |
| `kg8` | Relaunch argv assembler (Array.from, jvH, tf8, flatMap) |
| `jvH` | Argv element filter helper |
| `tf8` | Argv boolean filter (R6, Boolean) |
| `R6` | Config-file watcher / reader (G5H, ng4) |
| `Q6` | Config path resolver |
| `NN_` | Config normaliser |
| `G5H` | Config file reader (readFileSync, statSync, mkdirSync, copyFileSync) |
| `ng4` | Config file watcher (watchFile, unwatchFile) |
| `b_` | Session-settings reader (getAppState, findLast, pu8, Uu8, Mx) |
| `pu8` | Allowed-tools reader (f1) |
| `f1` | Tool-list deserialiser |
| `Uu8` | Disallowed-tools reader (f1) |
| `Mx` | Bypass-permissions mode handler ($6, nA) |
| `u$` | Session effort/model/flag reader (getAppState) |