---
type: feature-spec
feature: "background"
cc_version: "2.1.149"
updated: "2026-06-01"
tags: ["background", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.149 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/background`

> Analysis basis: CC v2.1.149 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.149

---

## Overview

The `/background` command (alias `/bg`) sends the current interactive Claude Code session to a background daemon worker, freeing the terminal for other use. It serializes the current conversation state, dispatches it to the background daemon via a Unix socket protocol, and returns a job identifier the user can later resume. The command enforces a set of prerequisite gates (session persistence, daemon availability, permission-mode consent) before performing the handoff.

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
| module_id | `gn1` |
| load_inline | `true` |
| loc_byte | `12662165` |
| loc_byte_end | `12662405` |
| loc_line | `10756` |
| arbor_handler.name | `O75` |
| arbor_handler.fqn | `claude-2.1.149::O75` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.149 bundle.js:+12662165

---

## Input Branching

The command has more than three distinct decision paths before it reaches daemon dispatch, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    START(["/background [prompt] invoked"])
    CHECK_PERSIST{Session persistence\nenabled?}
    ERR_NO_PERSIST["Error: Cannot background —\nsession persistence disabled"]
    CHECK_MSG{At least one\nmessage in session?}
    ERR_NO_MSG["Error: Nothing to background\nyet — send a message first"]
    CHECK_ALREADY_BG{Session already\nin background?}
    EMIT_ALREADY["Emit tengu_background_already_bg\n(no-op return)"]
    CHECK_BYPASS{bypassPermissions\nmode active?}
    CHECK_BYPASS_DISCLAIMER{Disclaimer\naccepted?}
    ERR_BYPASS_DISCLAIMER["Error: --bg with bypassPermissions\nrequires disclaimer. Run\n`claude --dangerously-skip-permissions`\nonce interactively."]
    CHECK_AUTO{permission-mode\n== 'auto'?}
    CHECK_AUTO_OPTIN{Auto-mode\nopt-in present?}
    ERR_AUTO_OPTIN["Error: --bg with auto mode\nrequires opting in first. Run\n`claude --permission-mode auto`\nonce interactively."]
    ENSURE_DAEMON[Ensure daemon is running\n(install / spawn / connect)]
    BUILD_ARGS[Build CLI argv for\nbackground worker process]
    DISPATCH[Dispatch job via\ncli-bg-dispatch socket protocol]
    RESULT{Dispatch\nresult}
    SUCCESS["Print job ID / status;\nfree terminal"]
    ERR_DISPATCH["Map error code to\nhuman-readable message\n(not running / timed out /\ncouldn't write / socket missing /\nservice still starting /\nid collision)"]

    START --> CHECK_PERSIST
    CHECK_PERSIST -- No --> ERR_NO_PERSIST
    CHECK_PERSIST -- Yes --> CHECK_MSG
    CHECK_MSG -- No --> ERR_NO_MSG
    CHECK_MSG -- Yes --> CHECK_ALREADY_BG
    CHECK_ALREADY_BG -- Yes --> EMIT_ALREADY
    CHECK_ALREADY_BG -- No --> CHECK_BYPASS
    CHECK_BYPASS -- Yes --> CHECK_BYPASS_DISCLAIMER
    CHECK_BYPASS_DISCLAIMER -- No --> ERR_BYPASS_DISCLAIMER
    CHECK_BYPASS_DISCLAIMER -- Yes --> ENSURE_DAEMON
    CHECK_BYPASS -- No --> CHECK_AUTO
    CHECK_AUTO -- Yes --> CHECK_AUTO_OPTIN
    CHECK_AUTO_OPTIN -- No --> ERR_AUTO_OPTIN
    CHECK_AUTO_OPTIN -- Yes --> ENSURE_DAEMON
    CHECK_AUTO -- No --> ENSURE_DAEMON
    ENSURE_DAEMON --> BUILD_ARGS
    BUILD_ARGS --> DISPATCH
    DISPATCH --> RESULT
    RESULT -- ok --> SUCCESS
    RESULT -- error --> ERR_DISPATCH
```

Analysis basis: CC v2.1.149 bundle.js:+12661526, +12661578, +12655247, +12655409, +12661607, +12661783

---

## Behavioral Spec

### 1. Entry-point guard checks (`O75`)

The main handler (Arbor name `O75`) is an `AsyncFunction` resolved via `module_id → gn1`.

```
async function handleBackgroundCommand(context, userPrompt):
    if not sessionPersistenceEnabled(context):
        return errorMessage(
            "Cannot background — session persistence is disabled, " +
            "so the forked job would have nothing to resume."
        )

    if conversationMessages(context).length == 0:
        return errorMessage(
            "Nothing to background yet — send a message first."
        )

    if sessionIsAlreadyInBackground(context):
        emit telemetry "tengu_background_already_bg"
        return  // silent no-op

    permResult = checkPermissionGates(context)
    if permResult.blocked:
        return errorMessage(permResult.reason)
```

Analysis basis: CC v2.1.149 bundle.js:+12661607, +12661783, +12661538, +12661540

---

### 2. Permission-mode gate (`permissionGateCheck`, bundle name `M75`)

```
function permissionGateCheck(cliArgs, appState):
    // Detect --permission-mode bypassPermissions path
    if args contains "--dangerously-skip-permissions"
       or args contains "--allow-dangerously-skip-permissions"
       or permissionMode == "bypassPermissions":
        if not disclaimerAccepted(appState):
            return blocked(
                "--bg with bypassPermissions requires accepting the disclaimer first. " +
                "Run `claude --dangerously-skip-permissions` once interactively."
            )

    // Detect auto-mode path
    if permissionMode == "auto":
        if not hasAutoModeOptIn(appState):
            return blocked(
                "--bg with auto mode requires opting in first. " +
                "Run `claude --permission-mode auto` once interactively."
            )

    return allowed
```

Analysis basis: CC v2.1.149 bundle.js:+12655247, +12655409, +12655047, +12655078, +12655110, +12655156

---

### 3. Daemon lifecycle management (`ensureDaemonRunning`, bundle name `SB`)

```
async function ensureDaemonRunning(options):
    status = getDaemonStatus()

    if status == "up":
        // Already running; check binary freshness
        if daemonExecPathIsStale():
            emit telemetry "tengu_bg_daemon_service_stale_exec"
            // Fall back to transient spawn

    elif options.daemonMode == "ask":
        prompt = "Install as a service now? [y/N/never, or 'once' just for now] "
        answer = await interactivePrompt(prompt)
        emit telemetry "tengu_bg_daemon_cold_start_ask"
        if answer in ["yes", "y"]:
            installService()
            emit telemetry "tengu_bg_daemon_install"
            waitForReachable(timeout=5000ms)
            if not reachable:
                warn("service installed but the daemon did not become reachable within 5s")
        elif answer == "once":
            spawnTransient()
        elif answer == "never":
            persistNeverChoice()

    elif options.daemonMode == "no":
        // No daemon at all
        return errorMessage(
            "No background daemon is running. " +
            "Run 'claude daemon install' to set it up as a persistent service."
        )

    // Transient spawn path
    if needsTransientSpawn:
        spawnArgs = ["run", "--origin", "transient", "--spawned-by", ...]
        result = spawnDaemon(spawnArgs)
        if result.error == "EACCES":
            emit telemetry "tengu_bg_daemon_spawn_failed"
        waitPoll(30000ms, 60000ms)
        if not reachable:
            emit telemetry "tengu_bg_daemon_service_poll_fallthrough"
```

Analysis basis: CC v2.1.149 bundle.js:+12601297, +12601415, +12601661, +12601755, +12602262, +12602385, +12602692, +12602875

---

### 4. CLI argument construction (`buildBackgroundArgs`, bundle name `a45`)

The handler assembles a full argv array for the background worker process:

```
function buildBackgroundArgs(context, userPrompt):
    args = ["--agent"]

    // Session name
    if context.sessionName:
        args += ["--name", context.sessionName]
        // also accepts -n shortform

    // Resume / fork session reference
    resumeId = extractResumeId(context)
    if resumeId:
        args += ["--resume=" + resumeId]
        // parses --resume=<id>, -r=<id>, --resume <id>, -r <id>

    // Session ID (fork)
    if context.sessionId:
        args += ["--session-id=" + context.sessionId]

    // Continue flag
    if context.continueMode:
        args += ["-c"]   // or --continue

    // Fork-session flag
    if context.forkSession:
        args += ["--fork-session"]

    // Tool allow/disallow lists
    if context.allowedTools:
        args += ["--allowed-tools", join(context.allowedTools)]
    if context.disallowedTools:
        args += ["--disallowed-tools", join(context.disallowedTools)]

    // Model and effort
    if context.model:
        args += ["--model", context.model]
    if context.effort:
        args += ["--effort", context.effort]

    // Additional directories
    for dir in context.addDirs:
        args += ["--add-dir", dir]

    // Propagate key environment variables
    envVars = [
        "CLAUDE_CONFIG_DIR", "CLAUDE_INTERNAL_FC_OVERRIDES",
        "AWS_REGION", "AWS_DEFAULT_REGION", "AWS_PROFILE",
        "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"
    ]
    for v in envVars:
        if process.env[v]:
            args += ["--env", v + "=" + process.env[v]]

    // Append user prompt if provided
    if userPrompt:
        args += [userPrompt]

    return args
```

Analysis basis: CC v2.1.149 bundle.js:+12638485, +12638512, +12638528, +12654231, +12654326, +12654342, +12654585, +12654644, +12638615, +12638625, +12638726, +12658083, +12658124, +12658155, +12658177, +12658048, +12656025

---

### 5. Dispatch protocol (`dispatchToBackground`, bundle name `Bt_`)

```
async function dispatchToBackground(jobArgs, sessionState):
    jobId = generateJobId()     // random bytes → hex, 8 chars
    dispatchDir = joinPath(jobsDir, jobId)
    await fs.mkdir(dispatchDir, mode=0o600)  // 384 decimal

    // Serialize session snapshot to dispatch file
    snapshotPath = joinPath(dispatchDir, "daemon.status.json")
    writeAtomicJson(snapshotPath, {
        args: jobArgs,
        sessionId: sessionState.id,
        timestamp: Date.now()
    })

    // Connect to daemon control socket
    socket = connectControlSocket(daemonSocketPath)

    try:
        // Write dispatch envelope tagged "cli-bg-dispatch"
        socket.write(buildEnvelope("cli-bg-dispatch", { jobId, dispatchDir }))

        // Wait for ACK with timeout 6000ms
        ack = await waitForAck(socket, timeout=6000ms)

        if not ack:
            emit telemetry "tengu_bg_dispatch_fallback"
            // Attempt fallback path
            fallbackResult = await fallbackDispatch(jobArgs)
            if fallbackResult.ok:
                emit telemetry "tengu_bg_dispatch_rescued"
                return fallbackResult
            throw new Error("no ack")

        emit telemetry "tengu_bg_dispatch"
        return { jobId, status: "dispatched" }

    catch error:
        if error.code == "EALIVE":
            // Another session occupying the slot
            return errorResult("id collision with a prior job")
        elif error.code == "ESTALE" or status == "stale_short":
            return errorResult("Previous session is still shutting down — try again in a moment")
        elif error.code == "ESTARTING":
            return errorResult("service still starting")
        elif error.code == "ENOCONN" or status == "daemon-unreachable":
            return errorResult("socket missing")
        elif status == "ack-timeout":
            return errorResult("timed out")
        elif status == "dispatch-write":
            return errorResult("couldn't write dispatch file")
        else:
            return errorResult("not running")

    finally:
        if dispatchFailed:
            fs.unlink(dispatchDir)
```

Analysis basis: CC v2.1.149 bundle.js:+12633741, +12633826, +12633982, +12634063, +12634084, +12634214, +12634637, +12634733, +12634464, +12634510, +12634939, +12635595, +12636121, +12641415, +12644834, +12644872, +12644911, +12644962, +12645001, +12645050

---

### 6. Daemon worker process management (`daemonWorkerManager`, bundle name `w`)

When the daemon spawns a new background worker it:

```
function spawnBackgroundWorker(jobArgs):
    // Check free memory before spawning
    freeMem = os.freemem()
    if freeMem < LOW_MEM_THRESHOLD:
        emit telemetry "tengu_bg_dispatch_low_mem"

    // Attempt to claim a spare worker slot
    claimed = tryClaimSpareWorker()
    if claimed:
        emit telemetry "tengu_bg_spare_claim"
    else:
        emit telemetry "tengu_bg_spare_claim_fail"
        // Spawn fresh process
        proc = child_process.spawn(execPath, jobArgs, { detached: true })
        emit telemetry "tengu_bg_spare_spawn"

    // Track in worker registry
    workerRegistry.set(jobId, { proc, startTime: Date.now() })

    // SIGKILL escalation timeout: 30s soft → 15s hard
    setTimeout(() => proc.kill("SIGKILL"), 30000 + 15000)
    emit telemetry "tengu_bg_dispatch_sigkill_escalate"

    proc.on("exit", () => {
        workerRegistry.delete(jobId)
        proc.dispose()
    })
```

Analysis basis: CC v2.1.149 bundle.js:+15260618, +15260736, +15260784, +15260695, +15260702, +15261315, +15262010, +15262131, +15262394, +15260429

---

### 7. Session-fork and rename (`sessionForkAndRename`, bundle name `$H6`)

When backgrounding, the active session is forked:

```
async function forkSessionForBackground(session):
    emit telemetry "tengu_rename_full_session_fork"

    // Generate or confirm session name via model call
    // (tool use is DENIED during name generation — "Session name generation cannot use tools")
    nameResult = await generateSessionName(session, toolPolicy="deny")

    // Build fork envelope and register with daemon
    forkEnvelope = {
        type: "detach-request",
        sessionId: session.id,
        name: nameResult.name
    }
    sendToSocket(forkEnvelope)
    emit telemetry "tengu_background"
```

Analysis basis: CC v2.1.149 bundle.js:+11647788, +11647245, +12658619, +10683161

---

### 8. JSX render component (`backgroundCommandRenderer`, bundle name `Pv8`)

After successful dispatch, a JSX component renders the result. Key display states:

```
function renderBackgroundResult(props):
    // Timeout fallback after 120s
    if props.elapsed > 120:
        return renderTimedOut()

    if props.status == "stopped":
        return <text>"background session"</text>

    if props.status == "(backgrounded)":
        return renderBackgroundedBadge()

    // Show progress spinner while daemon acknowledges
    return renderPendingSpinner()
```

Analysis basis: CC v2.1.149 bundle.js:+12659027, +12659077, +12659307, +15296680, +15296723

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: tengu_background | Emitted on successful background dispatch (bundle.js:+12658619) |
| Telemetry: tengu_background_already_bg | Emitted when command is run on a session that is already backgrounded (bundle.js:+12661540) |
| Telemetry: tengu_background_spawn_failed | Emitted when the background worker process fails to spawn (bundle.js:+12658550) |
| Telemetry: tengu_bg_dispatch | Emitted on acknowledged dispatch (bundle.js:+12635595) |
| Telemetry: tengu_bg_dispatch_fallback | Emitted when primary dispatch fails and fallback path is attempted (bundle.js:+12636121) |
| Telemetry: tengu_bg_dispatch_rescued | Emitted when fallback path succeeds (bundle.js:+12641415) |
| Telemetry: tengu_bg_dispatch_sigkill_escalate | Emitted when daemon escalates to SIGKILL for a stuck worker (bundle.js:+15260736) |
| Telemetry: tengu_bg_dispatch_low_mem | Emitted when system free memory is below threshold before spawn (bundle.js:+15261315) |
| Telemetry: tengu_bg_spare_enable | Emitted when spare worker slot pool is activated (bundle.js:+15262010) |
| Telemetry: tengu_bg_spare_claim | Emitted when a spare worker slot is successfully claimed (bundle.js:+15262131) |
| Telemetry: tengu_bg_spare_claim_fail | Emitted when no spare slot is available (bundle.js:+15262394) |
| Telemetry: tengu_bg_spare_spawn | Emitted when a new spare worker is spawned (bundle.js:+15260429) |
| Telemetry: tengu_bg_daemon_cold_start_ask | Emitted when the user is asked whether to install the daemon (bundle.js:+12602320) |
| Telemetry: tengu_bg_daemon_cold_start_ask_answer | Emitted after the user answers the install prompt (bundle.js:+12605856) |
| Telemetry: tengu_bg_daemon_install | Emitted when service installation proceeds (bundle.js:+12601755) |
| Telemetry: tengu_bg_daemon_service_stale_exec | Emitted when daemon binary path is stale/deleted (bundle.js:+12601372) |
| Telemetry: tengu_bg_daemon_service_poll_fallthrough | Emitted when transient daemon fails to become reachable within poll window (bundle.js:+12601996) |
| Telemetry: tengu_bg_daemon_spawn_failed | Emitted when transient daemon spawn fails (EACCES or other) (bundle.js:+12602754) |
| Telemetry: tengu_rename_full_session_fork | Emitted when session fork/rename is triggered during backgrounding (bundle.js:+11647788) |
| Telemetry: tengu_daemon_config_reload | Emitted on daemon config reload (bundle.js:+15275522) |
| Telemetry: tengu_amber_anchor | Emitted by background-service V6/DOH subsystem (bundle.js:+3187318) |
| Filesystem: dispatch directory | Created under `<configDir>/jobs/<jobId>/` with mode 0o600 (bundle.js:+12634464, +12634510) |
| Filesystem: daemon.status.json | Written atomically inside the dispatch directory (bundle.js:+12331232) |
| Filesystem: cleanup on failure | Dispatch directory unlinked if daemon ACK is not received (bundle.js:+12634939) |
| appState changes | Session state transitions to backgrounded; terminal is released |
| Socket | Connects to daemon control socket; writes `cli-bg-dispatch` envelope; listens for `lease` / `data` / `close` events |
| Hook registration | `a9` (W7A.register) is called during `rt_`/`h4` chain, registering background lifecycle hooks |
| Sound | None identified in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.149 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/bg` before sending any message.** The command explicitly rejects sessions with an empty conversation — send at least one message first (bundle.js:+12661783).
2. **Using `bypassPermissions` / `--dangerously-skip-permissions` without the interactive disclaimer.** The gate check requires that the flag has been accepted in an interactive session first; running it directly from `/bg` will be blocked (bundle.js:+12655247).
3. **Using `auto` permission mode without opting in.** Similarly, `--permission-mode auto` must be exercised at least once interactively before `/bg` will accept it (bundle.js:+12655409).
4. **Expecting instant terminal release when the daemon is not installed.** If no daemon is running and the install mode is `ask`, the command prompts interactively. If mode is `no`, it returns an error rather than backgrounding (bundle.js:+12602385).
5. **Retrying immediately after a `stale_short` / `ESTALE` error.** The previous session worker is still shutting down; a brief wait is required before the slot is free (bundle.js:+12642338).
6. **Ignoring the `id collision with a prior job` error (`EALIVE`).** Two `/bg` invocations from the same session within the same millisecond will collide on the job ID (bundle.js:+12645050).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `O75` | Main handler for `/background` command (AsyncFunction, Arbor-resolved) |
| `Xv8` | Background command JSX renderer / top-level render function |
| `Pv8` | JSX result renderer component (120s timeout, status display) |
| `a45` | CLI argument builder for background worker process |
| `Bt_` | Background dispatch orchestrator (socket protocol, retries) |
| `SB` | Daemon lifecycle manager (ensure-running, install, spawn) |
| `cc` | Session fork / job ID creation helper |
| `M75` | Permission gate check (bypassPermissions / auto-mode guards) |
| `uv6` | Daemon install interaction (ask/yes/once/never prompt) |
| `pt_` | Dispatch error mapping (error code → human message) |
| `QG8` | Daemon control socket lease handler |
| `PO` | Control socket connect/write/read utility |
| `hhH` | Dispatch file path builder |
| `kn1` | Dispatch retry / backoff logic |
| `r8` | Atomic file write with abort/timeout |
| `w` | Daemon worker process manager (spawn, SIGKILL escalation, memory check) |
| `$H6` | Session fork and rename orchestrator |
| `HrL` | Session name generation sub-flow (tool-denied model call) |
| `tW` | Background agent turn runner |
| `iJ8` | App state getter/setter during background handoff |
| `nk` | Background task runner / multi-step executor |
| `wa1` | Core agent query loop (main API call path) |
| `ZLH` | Detach-request sender (sends `detach-request` envelope to daemon) |
| `WW1` | Task envelope builder for daemon worker |
| `no` | Socket write helper (lo.write wrapper) |
| `_PH` | Environment/context string formatter |
| `Xv8` | Session list / status collector |
| `wv` | Session iteration utility |
| `K` | Session map / registry |
| `L` | Worker process record |
| `q` | File system / process namespace (context-dependent) |
| `M` | Worker map or connection map (context-dependent) |
| `A` | String / array / process (context-dependent) |
| `yf` | Session filter / boolean predicate |
| `rt_` | Hook registration chain entry |
| `h4` | Hook registry helper |
| `a9` | Hook register call (W7A.register) |
| `lc` | Argument slice / flag-set membership check |
| `Sm` | Settings reader (userSettings / localSettings merge) |
| `p8` | Settings layer accessor |
| `m6` | Config file writer with backup |
| `Q6` | Config directory resolver |
| `JOH` | Config file read with migration |
| `Et4` | Config file watcher |
| `FC` | Settings validator / normalizer |
| `N` | Log / output helper |
| `$` | Session registry (Map operations) |
| `_Q1` | Daemon status file reader |
| `Pn` | Status JSON parser |
| `A1` | Async local storage getter |
| `$v6` | Status file path builder |
| `CH` | JSON serializer wrapper |
| `bK` | Jobs directory path resolver |
| `kG` | Config subdirectory path builder |
| `mn1` | `--resume` / `-r` argument parser |
| `$75` | MCP prefix / allow-list membership check |
| `Y` | Supervisor process record / worker map |
| `tXH` | Worker state machine step |
| `kc1` | Worker status formatter |
| `G` | Remote-control stop handler |
| `Z` | Worker lifecycle controller (stop/start/updateConfig) |
| `AXK` | Heartbeat sender |
| `r` | Worker allow/deny decision |
| `d` | Daemon path resolver |
| `K75` | `--session-id` argument parser |
| `Un1` | Fleet-mode argument injector |
| `pn1` | `--fork-session` / `-c` / `--continue` argument parser |
| `x6` | Async-local-storage context accessor |
| `Mm6` | Store getter wrapper |
| `j_` | Logger / debug printer |
| `cq` | Job state file reader (order / stateOrder) |
| `j8` | Logger with level |
| `g6` | JSON.parse wrapper |
| `x5` | Atomic JSON writer |
| `SO` | Atomic file write (random temp name, rename) |
| `Uw` | Cache invalidator (XzH.delete) |
| `_HH` | Job state categorizer (working/active/daemon) |
| `X4` | Path redactor / truncation helper |
| `Nn1` | Session name list formatter |
| `EH` | String coercion helper |
| `o45` | Platform shell resolver (cmd.exe / /bin/sh) |
| `Dm6` | Windows Git Bash detection |
| `L75` | Prompt-type argument injector |
| `uv6` | Daemon install interactive flow |
| `YY` | Background service status helper |
| `DOH` | V6 service accessor |
| `t45` | Status display helper |
| `Xe` | V1H service accessor |
| `V1H` | Yp service accessor |
| `K8` | Logger (structured) |
| `ER8` | Extra args passthrough |
| `P` | MCP server connector |
| `wh8` | MCP transport factory |
| `RH` | Error normalizer / log-error |
| `c_` | Error string formatter |
| `mH` | String coercion (primitive) |
| `G1` | Z2A formatter |
| `Z2A` | mH wrapper |
| `uiK` | Rolling-log shift/push |
| `T` | MCP tool-list fetcher |
| `HE6` | Tool schema builder |
| `Gh` | Background signal emitter |
| `V_H` | Session context accessor |
| `f8` | Global config read+write |
| `$f_` | Config write with lock and backup |
| `_L9` | Write-stream factory |
| `f$6` | Config diff helper |
| `Of_` | Backup directory path builder |
| `UK6` | Atomic file write (fchmod+fsync) |
| `OFH` | Config merge helper |
| `ub9` | Object entries iterator |
| `zFH` | Config write timestamp tracker |
| `ff_` | Config write fallback path |
| `ew6` | Extra environment injector |
| `PvH` | Permission-mode flag passthrough |
| `V6` | Background-service / amber-anchor emitter |
| `_$6` | Service state accessor |
| `A$6` | Service type resolver |
| `we` | Growthbook event emitter |
| `Gb` | OS platform string |
| `we6` | Experiment registration |
| `BM_` | Experiment run / emit |
| `cM_` | Experiment variant resolver |
| `sQ_` | Backoff timer |
| `e_6` | Retry delay calculator |
| `$6H` | AbortController for session name |
| `iJ8` | App state read/write during handoff |
| `My` | Random bytes generator |
| `l8H` | Hook lifecycle helper |
| `fu` | Subagent exit handler |
| `jE6` | sSL tombstone-set membership check |
| `UJH` | Turn counter / limit check |
| `N08` | Max-turns guard |
| `Rj1` | Tombstone checker |
| `D` | Worker dispatch record |
| `XxL` | Context hint SSE handler |
| `T8` | Session message framer |
| `X` | Socket line reader (Buffer.concat + indexOf) |
| `J` | Socket-to-worker bridge |
| `Ah1` | Nq + Bh message filter |
| `Bh` | Message trim helper |
| `fE8` | Message array flattener |
| `vK` | Tool schema validator |
| `u28` | Context serializer (hash, write, image strip) |
| `x28` | Context version tag |
| `_T` | Message normalizer (full pipeline) |
| `BvL` | Content-block mapper |
| `AO1` | Image-to-text converter |
| `ASH` | Agent session handler |
| `jB_` | Sub-context builder |
| `wa1` | Core API query loop |
| `zP` | Auth provider resolver |
| `RA` | mH-based string formatter |
| `w5` | Foundry/mantle/vertex provider |
| `I8_` | Managed-key / sk-ant- credential parser |
| `Fq` | Provider chain (Wt + nq + QJ) |
| `UpH` | cf credential wrapper |
| `EG` | Error guard / final catch |
| `$K` | Tool filter (H.filter) |
| `XO` | Compact-boundary slicer |
| `aW8` | iP compact helper |
| `iP` | Compact boundary finder |
| `WzH` | Worktree / built-in context builder |
| `S6` | Dv path resolver |
| `Dv` | Absolute path resolver |
| `yG` | Basename + S6 helper |
| `tU` | Array.isArray tool-list checker |
| `O` | k8 output formatter |
| `k8` | Output token stream |
| `nW8` | Tool-name wildcard matcher |
| `$y` | Lc content-block handler |
| `Lc` | Array.isArray + $K filter |
| `dtH` | H.startsWith tool-name prefix check |
| `gO` | S6 + h4 helper |
| `fB` | S6 + h4 helper (variant) |
| `bq` | f$H daemon-worker label |
| `f$H` | Daemon-worker string constant ("daemon-worker") |
| `ZLH` | Detach-request protocol handler |
| `al6` | Session-level abort signal |
| `WW1` | Task envelope builder (bJH + k8) |
| `bJH` | Task type constant ("task") |
| `no` | lo.write + CH socket write |
| `E_H` | Detach envelope finalizer |
| `_PH` | Context environment formatter (production/test) |
| `ni1` | Node environment string |
| `jC` | Context key extractor |