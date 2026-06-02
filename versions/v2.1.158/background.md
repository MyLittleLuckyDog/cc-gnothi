---
type: feature-spec
feature: "background"
cc_version: "2.1.158"
updated: "2026-06-02"
tags: ["background", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.158 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/background`

> Analysis basis: CC v2.1.158 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.158

---

## Overview

`/background` (alias: `/bg`) forks the current interactive Claude session into a background daemon job, freeing the terminal. The command validates daemon availability and permission-mode prerequisites, dispatches a new background session via the daemon's inter-process control socket, and attaches a JSX status view so the user can monitor the detached job from the now-free terminal.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `background` |
| description | `Send this session to the background and free the terminal` |
| aliases | `["bg"]` |
| argumentHint | `[prompt]` |
| immediate | `null` |
| module_id | `o6K` |
| load_inline | `true` |
| loc_byte | `12785088` |
| loc_byte_end | `12785328` |
| loc_line | `9020` |
| arbor_handler.name | `$j5` |
| arbor_handler.fqn | `claude-2.1.158::$j5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.158 bundle.js:+12785088

---

## Input Branching

The command has 5+ distinct decision paths, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/background [prompt] invoked"] --> B{Session persistence enabled?}
    B -- No --> ERR1["Error: Cannot background — session persistence is disabled"]
    B -- Yes --> C{Current messages empty?}
    C -- Yes --> ERR2["Error: Nothing to background yet — send a message first"]
    C -- No --> D{bypassPermissions active AND disclaimer not accepted?}
    D -- Yes --> ERR3["Error: --bg with bypassPermissions requires accepting disclaimer first\nRun claude --dangerously-skip-permissions once interactively"]
    D -- No --> E{permission-mode == 'auto' AND auto not opted-in?}
    E -- Yes --> ERR4["Error: --bg with auto mode requires opting in first\nRun claude --permission-mode auto once interactively"]
    E -- No --> F[Build background CLI argv: session-id, flags, env vars, prompt...]
    F --> G[ensureDaemonRunning]
    G --> H{Daemon reachable?}
    H -- No --> ERR5["daemon_unavailable — display error status string"]
    H -- Yes --> I[dispatchBackgroundJob]
    I --> J{Dispatch result code}
    J -- gate_blocked --> ERR6["gate_blocked error"]
    J -- short_alive --> ERR7["Previous session still shutting down — try again"]
    J -- stale_short --> ERR8["stale_short error"]
    J -- other error --> ERR9["Map error code to user-facing string"]
    J -- Success --> K[Emit tengu_background telemetry]
    K --> L[Render JSX backgrounded status view\n'(backgrounded)']
    L --> M[Return JSX element to CLI renderer]
```

Analysis basis: CC v2.1.158 bundle.js:+12784429 (handler `$j5`), +12784510, +12784686, +12777924, +12778086, +12780700, +12780712, +12781399, +12781464, +12781506

---

## Behavioral Spec

### 1. Entry Point — Handler (`$j5`)

The Arbor-resolved handler is the async function `$j5` (`claude-2.1.158::$j5`, resolution path: `module_id` → `o6K`).

```
async function backgroundCommandHandler(args, appContext):
    sessionState = getSessionState(appContext)

    // Guard 1: session persistence
    if not sessionState.persistenceEnabled:
        return errorElement("Cannot background — session persistence is disabled, ...")

    // Guard 2: no conversation yet
    if conversationMessages.length == 0:
        return errorElement("Nothing to background yet — send a message first.")

    // Guard 3: bypassPermissions + disclaimer gate
    if isPermissionModeBypassActive(appContext) and not disclaimerAccepted(appContext):
        return errorElement("--bg with bypassPermissions requires accepting the disclaimer first. ...")

    // Guard 4: auto permission-mode gate
    if permissionMode(appContext) == "auto" and not autoModeOptedIn(appContext):
        return errorElement("--bg with auto mode requires opting in first. ...")

    // Build the argv for the detached worker
    argv = buildBackgroundArgv(args, appContext)

    // Ensure daemon is running (may spawn transient daemon)
    daemonHandle = await ensureDaemonRunning(appContext)
    if daemonHandle fails:
        emit telemetry "tengu_background_spawn_failed"
        return errorStatusElement(daemonHandle.error)

    // Dispatch job to daemon
    result = await dispatchJob(daemonHandle, argv)
    if result.error:
        return mapDispatchErrorToElement(result.errorCode)

    // Success path
    emit telemetry "tengu_background" { command: "background" }
    return <BackgroundedStatusJSX label="(backgrounded)" />
```

Analysis basis: CC v2.1.158 bundle.js:+12784429, +12784441, +12784477, +12784495, +12784510, +12784647, +12784686, +12784756

---

### 2. Pre-flight Permission Checks (`Lj5`)

Before building the argv, two guards are checked in sequence:

```
function checkPermissionGates(appContext):
    // Check bypassPermissions
    args = getCliArgs(appContext)
    hasBypassFlag = args.includes("--dangerously-skip-permissions")
                 or args.includes("--allow-dangerously-skip-permissions")
                 or permissionMode == "bypassPermissions"
    if hasBypassFlag and not disclaimerAccepted:
        return error("--bg with bypassPermissions requires accepting the disclaimer first. ...")

    // Check auto mode
    if permissionMode == "auto":
        return error("--bg with auto mode requires opting in first. ...")

    return ok
```

Literals observed: `"--permission-mode"` (+12777724), `"bypassPermissions"` (+12777755), `"--dangerously-skip-permissions"` (+12777787), `"--allow-dangerously-skip-permissions"` (+12777833), `"auto"` (+12778066).

Analysis basis: CC v2.1.158 bundle.js:+12777681 – +12778086

---

### 3. Background Argv Builder (`ow5`)

`ow5` assembles the full argument list passed to the daemon worker:

```
function buildBackgroundArgv(userPrompt, appContext):
    argv = []

    // Session identification
    sessionId = currentSession.id
    argv.push("--session-id=" + sessionId)         // or "--session-id", sessionId

    // Resume / fork flags
    if resumeFlag:
        argv.push("--resume=<id>")                 // or "-r=<id>"

    if forkSession:
        argv.push("--fork-session")

    // Continue flag
    if continueMode:
        argv.push("-c")  // or "--continue"

    // Agent / name
    if agentFlag:
        argv.push("--agent", agentName)
    if nameFlag:
        argv.push("--name", sessionName)
        // or "-n"

    // Permission passthrough
    if permissionFlag set:
        argv.push("--permission-mode", value)

    // Tool allow/disallow lists, model, effort
    for tool in allowedTools:
        argv.push("--allowed-tools", tool)
    for tool in disallowedTools:
        argv.push("--disallowed-tools", tool)
    if model:
        argv.push("--model", model)
    if effort:
        argv.push("--effort", effort)

    // Extra directories
    for dir in addDirs:
        argv.push("--add-dir", dir)

    // Environment variable passthrough (subset)
    envKeys = ["CLAUDE_CONFIG_DIR", "CLAUDE_INTERNAL_FC_OVERRIDES",
               "AWS_REGION", "AWS_DEFAULT_REGION", "AWS_PROFILE",
               "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT",
               "GCLOUD_PROJECT"]
    for key in envKeys:
        if process.env[key] exists: argv.push(env entry)

    // Reply-on-resume flag
    argv.push("--reply-on-resume")

    // Prompt (if provided)
    if userPrompt:
        argv.push(userPrompt)

    return argv
```

Key literals: `"--session-id="` (+12777262), `"--fork-session"` (+12761545), `"-c"` (+12761434), `"--continue"` (+12761444), `"--agent"` (+12761304), `"--name"` (+12761331), `"--allowed-tools"` (+12780927), `"--disallowed-tools"` (+12780968), `"--model"` (+12780999), `"--effort"` (+12781021), `"--add-dir"` (+12780892), `"--reply-on-resume"` (+12780840).

Analysis basis: CC v2.1.158 bundle.js:+12760915 – +12763504

---

### 4. Ensure Daemon Running (`gF` / `Dy6`)

```
async function ensureDaemonRunning(appContext):
    status = getDaemonStatus()

    if status == "up":
        emit telemetry "tengu_bg_daemon_ensure_running" (detail: status)
        return daemonHandle

    // Stale exec detection
    if serviceExecIsStale():
        emit telemetry "tengu_bg_daemon_service_stale_exec"
        // Fall back to transient spawn

    // Platform branch (macos / linux)
    platform = os.platform()
    if installMode == "ask":
        // Prompt: "Install as a service now? [y/N/never, or 'once' just for now]"
        answer = await promptUser(...)
        emit telemetry "tengu_bg_daemon_cold_start_ask_answer" { answer }
        if answer in ["yes", "once"]:
            install = true
        elif answer == "never":
            persistNeverInstall()

    if not install and no daemon:
        emit telemetry "tengu_bg_daemon_cold_start_ask"
        spawn transient daemon with args:
            ["run", "--origin", "transient", "--spawned-by", callerPid]
        wait up to 30000 ms for ready, then 60000 ms total

    if daemon not reachable after spawn:
        emit telemetry "tengu_bg_daemon_spawn_failed"
        return error

    return daemonHandle
```

Key literals: `"up"` (+12720598), `"ask"` (+12721578), `"Install as a service now? [y/N/never, or 'once' just for now] "` (+12728157), `"transient"` (+12722044), `30000` (+12722386), `60000` (+12722408).

Analysis basis: CC v2.1.158 bundle.js:+12720550 – +12723091

---

### 5. Dispatch to Daemon (`JqA` / `u6K`)

```
async function dispatchBackgroundJob(daemonHandle, argv):
    // Write dispatch file to jobs directory
    jobId = randomBytes(8).toString("hex")    // 8 bytes → 16-char hex (+12760837)
    jobDir = path.join(jobsDir, jobId)
    await fs.mkdir(jobDir, ...)
    dispatchFile = path.join(tmpDir, ...)
    writeDispatchFile(dispatchFile, { argv, sessionId, ... })

    // Connect to daemon control socket
    socket = await connectControlSocket(daemonHandle.socketPath)
    // Protocol: "cli-bg-dispatch" (+12756509)
    sendMessage(socket, { type: "cli-bg-dispatch", jobId, ... })

    // Wait for acknowledgement (6000 ms timeout)
    ack = await race(socketAck, timeout(6000))     // 6000 ms (+12756750)
    if no ack:
        // "no ack" fallback (+12756594)
        emit telemetry "tengu_bg_dispatch_fallback"

    // Interpret result code
    switch ack.code:
        case "EALIVE":   return { ok: true, jobId }
        case "ESTALE":   return { error: "stale_short" }
        case "ESTARTING": return { error: "service still starting" }
        case "gate_blocked": return { error: "gate_blocked" }
        default:         return { error: mapCodeToString(ack.code) }
```

Key literals: `"cli-bg-dispatch"` (+12756509), `6000` (+12756750), `"EALIVE"` (+12756852), `"ESTALE"` (+12756982), `"ESTARTING"` (+12757501), `"gate_blocked"` (+12760780), `"no ack"` (+12756594).

Analysis basis: CC v2.1.158 bundle.js:+12756259 – +12758318

---

### 6. Dispatch Error Mapping (`ow5` result handling)

```
function mapDispatchErrorToString(code):
    switch code:
        "daemon-unreachable"  → "not running"
        "ack-timeout"         → "timed out"
        "dispatch-write"      → "couldn't write dispatch file"
        "enoconn"             → "socket missing"
        "estarting"           → "service still starting"
        "short_alive"         → "Previous session is still shutting down — try again in a moment"
        "stale_short"         → (stale-short error)
        default               → "id collision with a prior job" (if applicable)
```

Key literals: `"not running"` (+12767508), `"timed out"` (+12767546), `"couldn't write dispatch file"` (+12767585), `"socket missing"` (+12767636), `"service still starting"` (+12767675), `"id collision with a prior job"` (+12767724), `"Previous session is still shutting down — try again in a moment"` (+12765157).

Analysis basis: CC v2.1.158 bundle.js:+12764037 – +12765372

---

### 7. Detach-Wait / Flush Timeout (`ay8` calling `tL`)

Before forking, the command flushes any in-progress output with a 2000 ms deadline:

```
async function flushAndDetach(sessionHandle):
    result = await Promise.race([
        flushOutputBuffers(sessionHandle),
        timeout(2000)       // "flush timeout" (+12780725)
    ])
    clearTimeout(...)
    return result
```

Literal: `2000` (+12780720), `"flush timeout"` (+12780725).

Analysis basis: CC v2.1.158 bundle.js:+12780712 – +12780725

---

### 8. Session Rendering After Background (`sy8` / JSX output)

Once dispatched successfully, a JSX element is rendered in the now-free terminal showing the backgrounded state. The label `"(backgrounded)"` (+12782148) is displayed. The background session type is classified internally as `"background session"` (+15503363).

The 120-second value (+12781918) appears as an interval or maximum wait constant associated with the attach/status polling loop.

Analysis basis: CC v2.1.158 bundle.js:+12781868 – +12782148

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_background` (success path, +12781464); `tengu_background_spawn_failed` (daemon spawn failure, +12781401); `tengu_background_already_bg` (already backgrounded, +12784443) |
| Telemetry — daemon lifecycle | `tengu_bg_daemon_cold_start_ask` (+12721636), `tengu_bg_daemon_cold_start_ask_answer` (+12728232), `tengu_bg_daemon_install` (+12721071), `tengu_bg_daemon_service_stale_exec` (+12720688), `tengu_bg_daemon_spawn_failed` (+12722155), `tengu_bg_daemon_service_poll_fallthrough` (+12721312) |
| Telemetry — dispatch | `tengu_bg_dispatch` (+12758363), `tengu_bg_dispatch_fallback` (+12758889), `tengu_bg_dispatch_rescued` (+12764234), `tengu_bg_dispatch_sigkill_escalate` (+15467649), `tengu_bg_dispatch_low_mem` (+15468228), `tengu_bg_dispatch_stale_drop` (+15457228) |
| Telemetry — attach/spare | `tengu_bg_attach` (+15459715), `tengu_bg_attach_kick` (+15461813), `tengu_bg_attach_stall_ms` (+15451568), `tengu_bg_attach_stall_gave_up` (+15460627), `tengu_bg_attach_stall_respawn` (+15460896), `tengu_bg_attach_legacy_autorespawn` (+15459304), `tengu_bg_spare_enable` (+15468923), `tengu_bg_spare_claim` (+15469044), `tengu_bg_spare_claim_fail` (+15469307), `tengu_bg_spare_spawn` (+15467342) |
| Telemetry — daemon control | `tengu_daemon_control` (+15503486), `tengu_daemon_config_reload` (+15482137), `tengu_daemon_idle_exit` (+15487324) |
| Telemetry — low memory | `tengu_bg_low_mem_mb` (+12729562) |
| Filesystem side effects | Creates job directory under `jobs/` config path (+4088917); writes dispatch file to `tmp/` subdirectory (+12760886); cleanup via `kqH.rm` on failure (+12761024, +12764901) |
| IPC / socket | Opens Unix domain socket to daemon; protocol message type `"cli-bg-dispatch"` (+12756509); uses `"dispatch"` subcommand (+11235244) |
| appState changes | Session is moved to `"background session"` state; foreground terminal detaches; session label updated to `"(backgrounded)"` |
| Daemon spawn (transient) | If no daemon is present and user agrees, spawns `claude run --origin transient --spawned-by <pid>` with a 30 s / 60 s readiness window |
| Spare worker pre-warm | On successful dispatch, the daemon may refill its spare-worker pool (`daemon_bg_spare_refill` literal, +15446579; `--bg-spare` flag, +15446926; `--bg-pty-host` flag, +15446885) |
| Sound | Not found in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.158 | Initial analysis |

---

## Common Mistakes

1. **Running `/background` before sending any message** — The command will reject with "Nothing to background yet — send a message first." At least one user message must exist in the conversation.
2. **Using `/background` with `--dangerously-skip-permissions` without prior interactive acceptance** — The disclaimer must be accepted in an interactive session (`claude --dangerously-skip-permissions`) before the background flag can be combined with bypass-permissions mode.
3. **Using `/background` with `--permission-mode auto` without prior opt-in** — Similarly, auto mode must be activated once in a live interactive session before backgrounding is allowed.
4. **No background daemon and running in a non-interactive environment** — If the daemon is not running and the process cannot interactively prompt for installation consent, the dispatch will fail with "not running".
5. **Retrying immediately after a short-alive error** — The error "Previous session is still shutting down — try again in a moment" means the prior session's cleanup is still in progress; a short wait is required.
6. **Expecting `/background` to work when session persistence is disabled** — If session persistence has been disabled (e.g., via certain API/CI configurations), the command will always fail with the persistence-disabled error.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `$j5` | Main handler for `/background` command (AsyncFunction, Arbor-resolved) |
| `ay8` | Background command UI / argument preparation layer |
| `sy8` | JSX render function for backgrounded status element |
| `Dn` | Background job initialization / job-directory setup |
| `ow5` | Full background dispatch orchestrator (builds argv, calls daemon, maps errors) |
| `Lj5` | Permission gate checker (bypassPermissions / auto mode) |
| `JqA` | Daemon dispatch protocol implementation |
| `gF` | Ensure-daemon-running logic (service install, transient spawn) |
| `Dy6` | Daemon cold-start / service installation prompt flow |
| `wqA` | Dispatch message serializer / path-bearing argument truncator |
| `Vv8` | Daemon socket lease handler |
| `gO` | Control socket connect / write / framing |
| `CRH` | Dispatch file writer helper |
| `u6K` | Dispatch result / error interpreter |
| `tL` | Flush-and-race helper (2000 ms flush timeout) |
| `vqA` | Session signal / event registration helper |
| `U4` | Daemon state query helper |
| `q9` | Signal/hook registration |
| `FT` | Further daemon-state helper |
| `HM` | Background session boolean filter |
| `KN` | Session value iterator helper |
| `wfA` | Daemon spare-worker spawn / PTY management |
| `FB5` | Daemon supervisor attach / IPC message router |
| `D` | Daemon background session manager |
| `w` | Background job process lifecycle controller |
| `Y` | Supervisor config reload handler |
| `G` | Remote-control-at-startup event handler |
| `X` | IPC framing / buffer parser |
| `By8` | Low-memory metric reporter |
| `SH` | Error-log queue flusher |
| `G6` | Renderer / repaint scheduler |
| `HfH` | Detach-request / task-type dispatcher |
| `U2H` | Environment classifier (production / test) |
| `Eb` | Environment sub-classifier |
| `H_K` | Environment string constant |
| `ZN1` | Task-type constant mapper |
| `ks` | Write-to-stdout helper |
| `lo6` | Detach-request constant |
| `tAH` | Telemetry attachment helper |
| `v9` | Daemon-worker mode checker |
| `QOH` | Daemon-worker identifier constant |
| `Ig` | Rescue-dispatch helper |
| `sw5` | Daemon status helper |
| `aHH` | Background-service label helper |
| `iKH` | Background-service label constant |
| `rzH` | Amber anchor telemetry helper |
| `tO` | Background service type resolver |
| `sz6` | Renderer sub-helper A |
| `tz6` | Renderer sub-helper B |
| `Ex` | Render node constructor |
| `CH` | String coercion utility |
| `Zx` | Render diffing utility |
| `Uz_` | Render node emitter |
| `dz_` | Render subtree patcher |
| `q_8` | Render cache check/add |
| `Fm` | Daemon shutdown race helper |
| `Sy` | Daemon stop event emitter |
| `z` | Daemon stop / stop-failed helper |
| `Iz` | Disposition classifier |
| `wfA` | Spare PTY spawner (Bun.spawn wrapper) |
| `bB5` | Array-shape validator |
| `l$` | Array.isArray wrapper |
| `dT` | PTY-pid file writer |
| `bRH` | PTY-pid path constructor |
| `hB5` | Process-options merger |
| `nS6` | Plugin-path resolver |
| `M` | Plugin cleanup helper |
| `Vh1` | PTY socket path builder (variant A) |
| `vh1` | PTY socket path builder (variant B) |
| `tl` | PTY socket path core |
| `X1` | Feature-flag OK reporter |
| `hH` | Feature-flag OK constant |
| `bH` | Feature-flag bad constant |
| `SuL` | Message-block summary mapper |
| `iX1` | Cache-file handler |
| `JZ8` | Conversation-state snapshot manager |
| `jCH` | Agent-query batch handler |
| `VqK` | Full agent query executor |
| `ET` | Message normalizer |
| `Hh` | High-level agent invocation wrapper |
| `hP` | Auth / login helper |
| `WA` | Provider string mapper |
| `R1_` | Login key classifier |
| `J9` | Login session builder |
| `LFH` | Login flow helper |
| `MT` | Model-tier selector |
| `HO` | Compact-boundary marker |
| `RE8` | Compact-boundary constant |
| `Vj` | Message UUID helper |
| `eYH` | Project-file context loader |
| `Oj` | Project-file cache invalidator |
| `ff` | Project-file writer |
| `B3` | Atomic file-write helper |
| `b6H` | Working-directory resolver |
| `v4` | Path sanitizer |
| `b6K` | Session list formatter |
| `rw5` | Shell-type resolver |
| `eB6` | Windows shell bootstrap |
| `Kj5` | Argument accumulator helper |
| `Mj5` | Permission-set membership checker |
| `c6K` | Resume-flag argument parser |
| `qj5` | Continue / fork-session flag parser |
| `l6K` | Session-id / fleet flag parser |
| `n6K` | Extra-dir passthrough helper |
| `h6` | Logger / telemetry context getter |
| `iB6` | AsyncLocalStorage store reader |
| `O_` | Log-output helper |
| `t9` | Project-file reader / cache |
| `P8` | JSON-error formatter |
| `N` | Normaliser / locale helper |
| `p6` | JSON.parse wrapper |
| `S6` | Config snapshot writer |
| `szH` | Config file reader |
| `m17` | Config file watcher |
| `gK` | Jobs-directory path builder |
| `DT` | Jobs-directory core path |
| `pk6` | Daemon status-file path builder |
| `$s1` | Daemon status-file writer |
| `ii` | Status-file format helper |
| `s9` | AsyncLocalStorage getter |
| `RH` | JSON.stringify wrapper |
| `QM` | Error message formatter |
| `J8` | Error code extractor |
| `U96` | Allowed-tools list builder |
| `fP6` | Feature-flag passthrough |
| `MIH` | Model-id passthrough |
| `bS` | Session-branch helper |
| `EH` | String coercion (alt) |
| `d` | Generic disposable / resource |
| `kE8` | Array-some wrapper |
| `Wh` | Argument-list filter |
| `Rl` | Argument-list classifier |
| `nAH` | Argument starts-with helper |
| `k$` | State-query dispatch |
| `I6` | State-query core |
| `qN` | Low-level RPC call |
| `wF` | State-update dispatch |
| `XB` | Array-isArray argument guard |
| `O` | Output-stream wrapper |
| `I8` | Output-stream class |