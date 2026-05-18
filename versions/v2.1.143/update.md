---
type: feature-spec
feature: "update"
cc_version: "2.1.143"
updated: "2026-05-18"
tags: ["update", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.143 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/update`

> Analysis basis: CC v2.1.143 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.143

---

## Overview

The `/update` command performs an in-process hot-swap to the latest installed version of Claude Code, preserving the current conversation context. It resolves the new binary path via `npm`/`bun`, tears down the running session (flushing analytics and the message bridge), then re-executes the process with `--resume` so the conversation continues without interruption.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `update` |
| description | `Switch to the latest version (conversation continues)` |
| supportsNonInteractive | `false` |
| isHidden | `true` |
| module_id | `cTq` |

Analysis basis: CC v2.1.143 bundle.js:+11654476

---

## Input Branching

The command handler (`ry7`) runs a multi-stage guard sequence before attempting the relaunch. Three classes of error abort the update, and each one emits the `tengu_update_refused` telemetry event.

```mermaid
flowchart TD
    A(["/update invoked"]) --> B{Resolve binary path\nvia which('claude')}
    B -- not found --> Z1["Error: binary not found\ntengu_update_refused"]
    B -- found --> C{Background tasks\nin 'running' or 'pending' state?}
    C -- yes --> Z2["Error: background tasks active\ntengu_update_refused\nMessage: 'Cannot /update while background tasks are running…'"]
    C -- no --> D{Session resumed from\na different project directory?}
    D -- yes --> Z3["Error: cross-directory resume\ntengu_update_refused\nMessage: 'Cannot /update — this session was resumed from a different project directory…'"]
    D -- no --> E[Append 'Switching to latest Claude Code… reconnecting'\nmessage to conversation]
    E --> F[Write SDK messages / set app state]
    F --> G[Flush message bridge\n(timeout: 2000 ms)]
    G --> H[Run relaunch sequence:\nteardown → flush analytics → execve with --resume]
    H --> I([New process inherits conversation])
```

Analysis basis: CC v2.1.143 bundle.js:+11652271 (binary resolution), +11652632 (running/pending guard), +11652735 (background-task error string), +11652976 (cross-directory error string), +11653469 (user-facing status message), +11653549 (2000 ms flush timeout)

---

## Behavioral Spec

### 1. Binary Resolution

```
function resolveBinaryPath():
    path = which("claude")          // delegates to Bun.which
    if path is null or empty:
        emit tengu_update_refused
        return Err("binary not found")
    return Ok(path)
```

Analysis basis: CC v2.1.143 bundle.js:+11652271, +11652274, +1050255, +1050212

---

### 2. Pre-flight Guards

```
function checkUpdatePreconditions(appState, sessionMeta):

    // Guard 1 — background task state
    taskStates = Object.values(appState.tasks)
    blocked = taskStates.filter(s => s == "running" or s == "pending")
    if blocked.length > 0:
        emit tengu_update_refused
        return Err("Cannot /update while background tasks are running — wait for them to finish, then try again.")

    // Guard 2 — cross-directory resume
    currentDir   = SP.basename(process.cwd())
    sessionDir   = SP.basename(sessionMeta.projectDir)
    if currentDir != sessionDir:
        emit tengu_update_refused
        return Err("Cannot /update — this session was resumed from a different project directory. Restart manually with --resume to continue on the latest version.")

    return Ok()
```

Analysis basis: CC v2.1.143 bundle.js:+11652594 (Object.values call), +11652632 ("running" literal), +11652654 ("pending" literal), +11652735 (background-task error), +11652519 (basename call), +11652976 (cross-directory error)

---

### 3. Status Message Injection

```
function injectStatusMessage(conversationStore):
    entry = {
        type: "text",
        role: "assistant",
        content: "Switching to latest Claude Code… reconnecting"
    }
    conversationStore.appendEntry(entry, key: "last-prompt")
    sdkWriter.writeSdkMessages(conversationStore)
    appState = _.getAppState()
    appState.updateStatus = "progress"
    _.setAppState(appState)
```

Analysis basis: CC v2.1.143 bundle.js:+11653469 (status string), +11653445 (writeSdkMessages), +11653223 (getAppState), +11653359 (setAppState), +12128287 (appendEntry), +12128307 ("last-prompt" key), +12112250 ("progress" literal)

---

### 4. Bridge Flush

```
function flushBridge(bridge):
    // Race: flush completes OR 2000 ms timeout fires
    result = await Promise.race([
        bridge.flush(),
        timeout(2000, label: "bridge flush")
    ])
    bridge.teardown()
```

Flush timeout: **2000 milliseconds**
Analysis basis: CC v2.1.143 bundle.js:+11653536 (jf / timed-promise call), +11653549 (2000 ms literal), +11653554 ("bridge flush" label), +11653539 (flush call), +11653590 (teardown call)

---

### 5. Relaunch Sequence (`twH`)

The relaunch function performs a full process replacement; it does not return.

```
function relaunchProcess(binaryPath, sessionId):

    // (a) Stat binary to confirm it exists on-disk
    stat = yXq.stat(binaryPath)
    if stat fails:
        writeError("relaunch_spawn_error")
        return

    // (b) Drain pending UI output (XSH)
    drainUiQueue()

    // (c) Flush analytics
    //     Race: analytics flush OR 1000 ms timeout
    await Promise.race([
        analyticsFlush(),
        timeout(1000, label: "analytics flush timeout")
    ])

    // (d) Clean up signal handlers
    process.removeAllListeners("SIGINT")
    process.removeAllListeners("SIGTERM")
    process.removeAllListeners("SIGHUP")

    // (e) Register exit-safety hook
    process.on("beforeExit", safetyHandler)
    process.on("exit",       safetyHandler)

    // (f) Load platform execve shim
    //     Platform branch:
    //       "windows" — not supported (warn)
    //       "macos"   — dlopen /usr/lib/libSystem.B.dylib
    //       linux     — dlopen libc.so.6
    execveShim = loadExecveShim(platform)

    // (g) Assemble argv: [binaryPath, "--resume", sessionId, ...inheritedArgs]
    argv = buildArgv(binaryPath, "--resume", sessionId)

    // (h) Replace current process image (no return)
    execveShim(binaryPath, argv, inheritedEnv)

    // Fallback: if execve unavailable, use spawnSync with stdio:"inherit"
    // then exit(128) on error
```

Flush timeout for analytics: **1000 milliseconds**
Analysis basis: CC v2.1.143 bundle.js:+11385749 (stat call), +11385843 (Promise.all), +11385856 (jf timed flush), +11385864 (30000 ms outer timeout), +11385971 (k_8 analytics flush), +11385977 (1000 ms literal), +11385982 ("analytics flush timeout"), +11386320 (removeAllListeners), +11386350 (process.on), +11386377 (spawnSync fallback), +11386412 ("inherit" stdio), +11386466 ("beforeExit"), +11386507 ("exit"), +11384824 ("windows"), +11384959 ("macos"), +11384967 (/usr/lib/libSystem.B.dylib), +11384996 (libc.so.6), +11385322 (execve call), +11385802 ("--resume" flag), +11386626 (process.exit), +11386739 (exit code 128), +11386602 ("relaunch_spawn_error")

---

### 6. UUID Generation for Session Continuation

```
function buildResumeSessionId():
    return crypto.randomUUID()   // UP8.randomUUID
```

Analysis basis: CC v2.1.143 bundle.js:+11651344 (randomUUID call), +11653465 (QTq invocation)

---

### 7. Error Rendering (non-update-refusal errors)

```
function renderUpdateError(err):
    message = String(err)
    dim = M6.dim(message)
    print dim
    print "report the issue at https://github.com/anthropics/claude-code/issues"
```

Analysis basis: CC v2.1.143 bundle.js:+11653762 (String coercion), +11653899 (M6.dim), +11653943 (issue URL), +11654026 (package name), +11654065 (docs URL)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_update_refused` — fired on each of the three pre-flight guard failures (binary not found, background tasks active, cross-directory resume) (bundle.js:+11652371) |
| Telemetry | `tengu_scroll_summary` — fired during the UI teardown / cleanup phase inside the relaunch sequence (bundle.js:+5228657) |
| appState changes | `updateStatus` set to `"progress"` before bridge flush (bundle.js:+11653302 `uZ`, +11653359 `setAppState`) |
| Hook registration | `process.on("beforeExit")` and `process.on("exit")` registered just before `execve` to handle unexpected exits (bundle.js:+11386466, +11386507) |
| Signal handlers | `SIGINT`, `SIGTERM`, `SIGHUP` listeners removed prior to relaunch (bundle.js:+11386291, +11386300, +11386310) |
| Bridge flush | `O.flush()` called with 2000 ms race-timeout; `O.teardown()` called unconditionally after (bundle.js:+11653539, +11653590) |
| SDK messages | `O.writeSdkMessages` called to persist the status message before flush (bundle.js:+11653445) |
| Analytics flush | Drained with 1000 ms timeout during relaunch (bundle.js:+11385977) |
| Conversation entry | `"Switching to latest Claude Code… reconnecting"` appended as an `assistant` role `text` entry (bundle.js:+11653469) |
| File write | `wX` writes a file via `dSH.writeFileSync` during relaunch (path joined via `av8.join`); purpose is state persistence across exec (bundle.js:+188710) |
| Process replacement | `M.execve` (via platform FFI shim) replaces the process image; fallback is `kXq.spawnSync` + `process.exit(128)` (bundle.js:+11385322, +11386377, +11386739) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.143 | Initial analysis. Build timestamp: `2026-05-15T17:39:39Z`, commit `cfb8132e4c3551e2773f41a1900efd1cc93637db` (bundle.js:+11654205, +11654236) |

---

## Common Mistakes

1. **Running `/update` while an agent or background task is active.** The command will refuse with "Cannot /update while background tasks are running" and emit `tengu_update_refused`. Wait until all tasks reach a terminal state.

2. **Using `/update` inside a `--resume` session that was started from a different working directory.** The cross-directory guard will fire. You must restart manually with `--resume` from the correct directory.

3. **Expecting `/update` to work in non-interactive (headless/pipe) mode.** `supportsNonInteractive` is `false`; the command is only available in interactive terminal sessions.

4. **Assuming the command is listed in `/help`.** `isHidden` is `true`; the command is intentionally invisible in the command palette and help output.

5. **Interrupting the process during the 2000 ms bridge-flush window.** Signal handlers are removed just before `execve`, but killing the process during the flush phase (before handler removal) may leave the session state inconsistent.

6. **Expecting `/update` to work on Windows.** The `execve` shim explicitly branches on `"windows"` and logs a warning instead of proceeding with a native process replacement (bundle.js:+11384824).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `FP8` | Binary-path resolution entry point (calls `w$` and `Xb`) |
| `w$` | `which`-lookup wrapper; delegates to `NzA` → `Bun.which` |
| `NzA` | Bun.which adapter |
| `Xb` | npm/package version-path builder (uses `p58`, `se`, `JM`) |
| `p58` | Package version directory resolver (joins `versions` path component) |
| `se` | Local-bin path builder (appends `.local/bin`) |
| `JM` | Array normalisation helper (uses `Array.isArray`) |
| `ry7` | Main `/update` command handler |
| `T1` | Process-mode classifier (detects `bg`, `daemon`, `daemon-worker`) |
| `cB` | Process-mode constant map |
| `d` | Shared logger / output helper |
| `x0` | Current-directory basename extractor |
| `V6` | Text / UI rendering utility |
| `Ip` | Path utility helper |
| `yU_` | Session-directory resolver (uses `hXq.dirname`) |
| `__` | Inner path-join helper |
| `FK` | Path-resolve helper |
| `C6H` | Conversation state accessor |
| `yr` | Hook/attachment filter (checks `nm7.has`) |
| `j28` | Attachment-type classifier |
| `FB_` | Conversation entry appender (calls `_.appendEntry`) |
| `KL` | Progress/status renderer |
| `NH` | Network / essential-traffic manager |
| `v_` | Error-wrapping utility |
| `xH` | String-coercion helper |
| `zq` | Essential-traffic queue processor |
| `kNK` | Circular-buffer manager (shift/push on `Ch6`) |
| `uZ` | App-state update helper (sets `updateStatus`) |
| `O` | Message bridge (flush / teardown / writeSdkMessages) |
| `N8` | Background-session writer |
| `QTq` | Resume session-ID generator (calls `UP8.randomUUID`) |
| `jf` | Timed-promise / timeout-race helper |
| `twH` | Full relaunch / process-replacement orchestrator |
| `SO6` | UI cleanup helper |
| `CEH` | Terminal unmount / write helper |
| `N_8` | Scroll-summary renderer |
| `dZ` | Deferred-progress renderer |
| `XSH` | UI output drain (calls `at_.drain`) |
| `k_8` | Analytics flush with timeout |
| `vXq` | Platform `execve` shim loader (FFI, dlopen, chdir) |
| `wX` | State-persistence file writer (writeFileSync) |