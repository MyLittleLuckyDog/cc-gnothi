---
type: feature-spec
feature: "background"
cc_version: "2.1.150"
updated: "2026-06-01"
tags: ["background", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.150 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/background`

> Analysis basis: CC v2.1.150 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.150

---

## Overview

`/background` (alias `/bg`) detaches the current interactive Claude Code session from the terminal, hands it off to the background daemon, and frees the controlling TTY. The command serialises session state, performs a series of pre-flight safety checks, dispatches the job to the daemon process over a Unix socket, and returns a status message to the user. If the daemon is not yet running the command may offer to install or transiently spawn it first.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `background` |
| description | `Send this session to the background and free the terminal` |
| argumentHint | `[prompt]` |
| aliases | `["bg"]` |
| immediate | `null` |
| module_id | `Fn1` |
| load_inline | `true` |
| loc_byte | `12662141` |
| loc_byte_end | `12662381` |
| loc_line | `10756` |
| arbor_handler.name | `$75` |
| arbor_handler.fqn | `claude-2.1.150::$75` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.150 bundle.js:+12662141

---

## Input Branching

The handler contains more than three distinct decision paths (persistence check, already-backgrounded guard, no-message guard, permission gates, daemon availability, dispatch outcome codes), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/background invoked"]) --> B{Session persistence\nenabled?}
    B -- No --> ERR1["Error: Cannot background —\nsession persistence is disabled"]
    B -- Yes --> C{Any messages\nin session?}
    C -- No --> ERR2["Error: Nothing to background yet —\nsend a message first."]
    C -- Yes --> D{Session already\nrunning in background?}
    D -- Yes --> SKIP["No-op / already bg\n(tengu_background_already_bg)"]
    D -- No --> E{Permission mode\nchecks}
    E -- bypassPermissions &\nno disclaimer accepted --> ERR3["Error: --bg with bypassPermissions\nrequires disclaimer (interactive run first)"]
    E -- auto mode &\nno opt-in --> ERR4["Error: --bg with auto mode\nrequires opt-in (interactive run first)"]
    E -- Passes --> F[Ensure daemon is running\n(ensureDaemonRunning)]
    F -- Daemon unavailable --> G{Daemon install\nstrategy}
    G -- ask / install --> INST[Install or transiently\nspawn daemon]
    G -- No daemon &\nno fallback --> ERR5["Error: No background daemon running"]
    INST --> H
    F -- Daemon up --> H[Build dispatch payload:\nCLI args + env vars +\nsession ID + prompt]
    H --> I[Connect to daemon\nUnix socket & dispatch\n(cli-bg-dispatch)]
    I --> J{Dispatch result\ncode}
    J -- gate_blocked --> ERR6["Blocked by gate"]
    J -- short_alive --> ERR7["Previous session still\nshutting down — retry"]
    J -- stale_short --> ERR8["Stale-short condition"]
    J -- daemon_unavailable --> ERR9["Daemon unavailable\n(not running / timed out / etc.)"]
    J -- Success --> K["Session detached\nTerminal freed\n(tengu_background event)"]
    K --> L["Render JSX status\n'(backgrounded)'"]
```

---

## Behavioral Spec

### Top-level handler (`$75`)

The Arbor-resolved handler for `/background` is the async function `$75` (FQN `claude-2.1.150::$75`), reached via `module_id` resolution from `Fn1`.

```
async function backgroundCommandHandler(cmdArgs, appContext):

    # Guard 1 — session persistence
    if NOT sessionPersistenceEnabled(appContext):
        return errorResult(
            "Cannot background — session persistence is disabled, " +
            "so the forked job would have nothing to resume."
        )

    # Guard 2 — at least one message exists
    sessionMessages = getSessionMessages(appContext)
    if sessionMessages.length == 0:
        return errorResult("Nothing to background yet — send a message first.")

    # Guard 3 — already backgrounded?
    if isAlreadyBackgrounded(appContext):
        emitTelemetry("tengu_background_already_bg")
        return  # silent no-op

    # Render immediate JSX placeholder (local-jsx type)
    renderDetachingUI(appContext)

    # Gate: bypassPermissions mode
    permissionMode = resolvePermissionMode(appContext)
    if permissionMode == "bypassPermissions":
        if NOT disclaimerAccepted(appContext):
            return errorResult(
                "--bg with bypassPermissions requires accepting the disclaimer first. " +
                "Run `claude --dangerously-skip-permissions` once interactively."
            )

    # Gate: auto mode
    if permissionMode == "auto":
        if NOT autoModeOptIn(appContext):
            return errorResult(
                "--bg with auto mode requires opting in first. " +
                "Run `claude --permission-mode auto` once interactively."
            )

    # Ensure daemon is running (may prompt user to install)
    daemonStatus = await ensureDaemonRunning(appContext)
    if daemonStatus == UNAVAILABLE:
        emitTelemetry("tengu_background_spawn_failed")
        return errorResult(mapDaemonStatusToMessage(daemonStatus))

    # Build subprocess argument vector for the background job
    bgArgs = buildBackgroundArgs(cmdArgs, appContext)
    # bgArgs includes flags such as --agent, --name / -n, --resume / -r,
    # --session-id, --fork-session, -c / --continue, --model, --effort,
    # --allowed-tools, --disallowed-tools, --add-dir, --permission-mode,
    # --dangerously-skip-permissions, and forwarded environment variables

    # Write dispatch file & connect to daemon socket
    dispatchResult = await dispatchToDaemon(bgArgs, appContext)

    emitTelemetry("tengu_background")

    # Interpret dispatch result
    match dispatchResult.code:
        "gate_blocked"       -> return errorResult("gate_blocked")
        "short_alive"        -> return errorResult(
                                   "Previous session is still shutting down — try again in a moment")
        "stale_short"        -> return errorResult("stale_short condition")
        "daemon_unavailable" -> return errorResult(
                                   mapUnavailableReason(dispatchResult.reason))
        SUCCESS              -> return renderBackgroundedUI("(backgrounded)")
```

Analysis basis: CC v2.1.150 bundle.js:+12661502 (handler `$75` entry)

---

### Daemon ensure-running sub-routine (`ensureDaemonRunning` / `SB`)

```
async function ensureDaemonRunning(appContext):
    emitTelemetry("tengu_daemon_ensure_running")

    status = readDaemonStatusFile()     # daemon.status.json
    if status == "up":
        return UP

    # Check if installed service binary is stale (deleted)
    if serviceExecStale():
        emitTelemetry("tengu_bg_daemon_service_stale_exec")
        # fall through to transient spawn

    platform = getPlatform()   # "macos" | "linux"

    installMode = resolveInstallMode(appContext)
    if installMode == "ask":
        emitTelemetry("tengu_bg_daemon_cold_start_ask")
        answer = promptUser(
            "Install as a service now? [y/N/never, or 'once' just for now] ")
        emitTelemetry("tengu_bg_daemon_cold_start_ask_answer")
        match answer:
            "yes" | "y" -> installAndWait(5000ms timeout)
                           if NOT reachableWithin(5000):
                               warn("service installed but daemon not reachable within 5s")
            "once"       -> transientSpawn()
            "never"      -> persistNeverChoice(); return UNAVAILABLE
            "no" | else  -> return UNAVAILABLE

    if installMode == "run" (transient):
        spawnTransient(["run", "--origin", "transient", "--spawned-by", ...])
        waitForReachable(timeout: 30000ms..60000ms)
        if unreachable:
            emitTelemetry("tengu_bg_daemon_transient_unreachable")
            return UNAVAILABLE

    if installMode == "none":
        return UNAVAILABLE

    return UP
```

Analysis basis: CC v2.1.150 bundle.js:+12601230

---

### Dispatch sub-routine (`dispatchToDaemon` / `Bt_`)

```
async function dispatchToDaemon(bgArgs, appContext):
    emitTelemetry("tengu_bg_dispatch")

    # Generate a random job socket path
    socketPath = buildSocketPath(randomBytes)

    # Write a dispatch file so the daemon can pick up the job
    writeDispatchFile(dispatchDir, jobId, bgArgs)

    # Connect to daemon control socket
    connection = await connectToDaemonSocket(socketPath, timeout: 6000ms)
    if connection fails:
        emitTelemetry("tengu_bg_dispatch_fallback")
        return { code: "daemon-unreachable" }

    # Send the dispatch message (cli-bg-dispatch)
    sendMessage(connection, { type: "cli-bg-dispatch", payload: bgArgs })

    # Await acknowledgement
    ack = await waitForAck(connection, phase: "await-ack")
    if NO ack:
        return { code: "ack-timeout" }

    match ack.code:
        "EALIVE"    -> return { code: "short_alive" }
        "ESTALE"    -> return { code: "stale_short" }
        "ESTARTING" -> return { code: "service still starting" }
        SUCCESS     -> emitTelemetry("tengu_bg_dispatch_rescued" if rescued)
                       return { code: SUCCESS }
```

Analysis basis: CC v2.1.150 bundle.js:+12633467

---

### Argument-vector builder (`buildBackgroundArgs` / `o45`)

```
function buildBackgroundArgs(cmdArgs, appContext):
    args = []

    # Resolve shell type for the worker process
    shell = resolveShell()   # "shell" literal, platform-specific path

    # Session identity
    if hasResumeFlag(cmdArgs):
        args.push("--resume=<sessionId>")   # or "-r=..." / "--resume" / "-r"
    if hasSessionIdFlag(cmdArgs):
        args.push("--session-id=<id>")      # or "--session-id <id>"

    # Naming
    if hasNameFlag(cmdArgs):
        args.push("--name", name)   # or "-n"

    # Continuation / forking
    if hasContinueFlag(cmdArgs):
        args.push("-c")             # or "--continue"
    if hasForkSessionFlag(cmdArgs):
        args.push("--fork-session")

    # Permission mode
    if permissionMode == "bypassPermissions":
        args.push("--dangerously-skip-permissions")
        # or "--allow-dangerously-skip-permissions"
    elif permissionMode set:
        args.push("--permission-mode", permissionMode)

    # Model / effort
    if model set:    args.push("--model", model)
    if effort set:   args.push("--effort", effort)

    # Tool allow/deny lists
    for tool in allowedTools:    args.push("--allowed-tools", tool)
    for tool in disallowedTools: args.push("--disallowed-tools", tool)

    # Additional directories
    for dir in addDirs: args.push("--add-dir", dir)

    # Forwarded environment variables (subset)
    forwardedEnvVars = [
        "CLAUDE_CONFIG_DIR", "CLAUDE_INTERNAL_FC_OVERRIDES",
        "AWS_REGION", "AWS_DEFAULT_REGION", "AWS_PROFILE",
        "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT",
        "GCLOUD_PROJECT"
    ]

    # Prompt (optional argument to /background)
    if cmdArgs.prompt:
        args.push(prompt)

    return args
```

Analysis basis: CC v2.1.150 bundle.js:+12638418

---

### Daemon unavailability message mapper

```
function mapDaemonStatusToMessage(reason):
    match reason:
        "not running"              -> "No background daemon is running. Run 'claude daemon install'…"
        "timed out"                -> dispatch timeout message
        "couldn't write dispatch"  -> dispatch-write error
        "socket missing"           -> socket missing message
        "service still starting"   -> "service still starting"
        "id collision"             -> "id collision with a prior job"
        default                    -> generic unavailable message
```

Analysis basis: CC v2.1.150 bundle.js:+12644810

---

### Daemon process lifecycle (spare-pool management, within daemon — `w`)

The daemon maintains a spare-process pool to reduce cold-start latency:

```
function manageSpareProcPool(daemonContext):
    emitTelemetry("tengu_bg_spare_enable")

    if lowMemory(os.freemem(), threshold: 1024 MB):
        emitTelemetry("tengu_bg_dispatch_low_mem")
        # do not pre-spawn

    if claimSpare() succeeds:
        emitTelemetry("tengu_bg_spare_claim")
    else:
        emitTelemetry("tengu_bg_spare_claim_fail")
        # fall back to on-demand spawn

    # On-demand spawn
    proc = bB.spawn(workerBinary, args)
    emitTelemetry("tengu_bg_spare_spawn")

    if SIGKILL escalation needed:
        emitTelemetry("tengu_bg_dispatch_sigkill_escalate")
```

Analysis basis: CC v2.1.150 bundle.js:+15261296

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_background` (bundle.js:+12658595) |
| Telemetry — already bg | `tengu_background_already_bg` (bundle.js:+12661516) |
| Telemetry — spawn failed | `tengu_background_spawn_failed` (bundle.js:+12658526) |
| Telemetry — dispatch | `tengu_bg_dispatch` (bundle.js:+12635571) |
| Telemetry — dispatch fallback | `tengu_bg_dispatch_fallback` (bundle.js:+12636097) |
| Telemetry — dispatch rescued | `tengu_bg_dispatch_rescued` (bundle.js:+12641391) |
| Telemetry — daemon cold start ask | `tengu_bg_daemon_cold_start_ask` (bundle.js:+12602296) |
| Telemetry — daemon cold start answer | `tengu_bg_daemon_cold_start_ask_answer` (bundle.js:+12605832) |
| Telemetry — daemon stale exec | `tengu_bg_daemon_service_stale_exec` (bundle.js:+12601348) |
| Telemetry — daemon install | `tengu_bg_daemon_install` (bundle.js:+12601731) |
| Telemetry — daemon poll fallthrough | `tengu_bg_daemon_service_poll_fallthrough` (bundle.js:+12601972) |
| Telemetry — daemon spawn failed | `tengu_bg_daemon_spawn_failed` (bundle.js:+12602730) |
| Telemetry — spare enable | `tengu_bg_spare_enable` (bundle.js:+15262145) |
| Telemetry — spare claim | `tengu_bg_spare_claim` (bundle.js:+15262266) |
| Telemetry — spare claim fail | `tengu_bg_spare_claim_fail` (bundle.js:+15262529) |
| Telemetry — spare spawn | `tengu_bg_spare_spawn` (bundle.js:+15260564) |
| Telemetry — low mem | `tengu_bg_dispatch_low_mem` (bundle.js:+15261450) |
| Telemetry — SIGKILL escalate | `tengu_bg_dispatch_sigkill_escalate` (bundle.js:+15260871) |
| Telemetry — config | `tengu_config_parse_error`, `tengu_config_lock_contention`, `tengu_config_stale_write`, `tengu_config_auth_loss_prevented` |
| Telemetry — daemon config reload | `tengu_daemon_config_reload` (bundle.js:+15275657) |
| Telemetry — rename fork | `tengu_rename_full_session_fork` (bundle.js:+11647764) |
| Dispatch file | Written to jobs directory (path: `jobs/` under config dir) before socket connect; cleaned up on success or failure via `t_H.rm` |
| Daemon status file | Read from `daemon.status.json` in config dir to determine daemon liveness |
| appState changes | Session is marked as backgrounded; TTY is released; the foreground REPL loop exits |
| Socket | Unix domain socket created under a temp path; `unref()`-ed to avoid keeping the event loop alive |
| Sound | None observed in traversal |
| Environment variables forwarded | `CLAUDE_CONFIG_DIR`, `CLAUDE_INTERNAL_FC_OVERRIDES`, `AWS_REGION`, `AWS_DEFAULT_REGION`, `AWS_PROFILE`, `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_PROJECT`, `GCLOUD_PROJECT` |
| Abort signal timeout | `AbortSignal.timeout` used; timeout value 120 s observed (bundle.js:+12659053) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.150 | Initial analysis |

---

## Common Mistakes

1. **Running `/background` before sending any message.** The command hard-guards on at least one message being present and returns "Nothing to background yet — send a message first." without contacting the daemon.
2. **Using `--dangerously-skip-permissions` (`bypassPermissions`) without prior interactive consent.** The disclaimer must be acknowledged by running `claude --dangerously-skip-permissions` once in an interactive session before `/background` will accept it.
3. **Using auto-permission-mode without opt-in.** Similarly, `--permission-mode auto` must be accepted interactively once before `/bg` will dispatch in auto mode.
4. **No daemon installed and answering "never" to the install prompt.** The "never" answer persists to config and silently blocks all future `/background` invocations until the preference is cleared.
5. **Calling `/background` in a session where persistence is disabled** (e.g., a worktree with no config). The command cannot fork a resumable job without persistence and will error immediately.
6. **Retrying too quickly after a previous background session exits.** The daemon issues `EALIVE` / `short_alive` if the prior worker has not fully shut down; the correct action is to wait a moment and retry.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `$75` | Main async handler for `/background` command (Arbor-resolved) |
| `Xv8` | Background argument-vector assembly and spawn coordinator |
| `o45` | Build background CLI argument vector from session state |
| `cc` | Gate-check and dispatch orchestrator (pre-daemon) |
| `L75` | Permission / flag resolution for background mode |
| `SB` | Ensure-daemon-running logic (install / transient spawn) |
| `uv6` | Daemon cold-start install prompt handler |
| `Bt_` | Background dispatch routine (writes dispatch file, connects socket) |
| `QG8` | Daemon control socket connection helper |
| `PO` | Low-level Unix socket connect-and-write helper |
| `In1` | Dispatch acknowledgement await helper |
| `pt_` | Dispatch file path builder / error categoriser |
| `hhH` | Dispatch file write helper |
| `w` | Daemon worker process manager (spare pool, SIGKILL escalation) |
| `r` | Worker allow/deny routing shim |
| `d` | Worker process wrapper |
| `Y` | Supervisor session map manager (start/stop/update config) |
| `tXH` | Session serialisation for supervisor handoff |
| `Ic1` | Session state formatter |
| `G` | Remote-control-at-startup stop handler |
| `_XK` | Heartbeat helper |
| `Pv8` | JSX renderer for backgrounded-session UI |
| `$H6` | Full-session fork coordinator (rename + fork) |
| `eiL` | Session fork executor |
| `tW` | Forked agent turn runner |
| `iJ8` | App-state mutator for forked session |
| `nk` | Forked session query dispatch |
| `Da1` | Core API query engine |
| `ASH` | Message normalisation for API requests |
| `u28` | Conversation message builder |
| `_T` | Tool schema builder |
| `ZLH` | Detach-request renderer |
| `PW1` | Task-type message formatter |
| `no` | Output write helper |
| `_PH` | Environment discriminator (production / test) |
| `Sm` | Settings source resolver |
| `p8` | Settings layer loader |
| `m6` | Config file read/watch orchestrator |
| `JOH` | Config file reader (with backup logic) |
| `Tt4` | Config file watcher |
| `f8` | Global config save orchestrator |
| `$f_` | Config save with lock |
| `UK6` | Atomic file write helper |
| `ff_` | Config save fallback path |
| `SO` | Atomic write utility |
| `Uw` | Cache invalidation helper |
| `cq` | Job-list reader (daemon jobs directory) |
| `x5` | Job-entry writer |
| `bK` | Jobs directory path resolver |
| `kG` | Config directory path resolver |
| `lc` | CLI argument parser (slice / has) |
| `un1` | Resume-flag parser |
| `q75` | Session-ID flag parser |
| `mn1` | Continue / fork-session flag parser |
| `f75` | Fleet-mode flag checker |
| `K75` | Prompt accumulator |
| `vn1` | Display name formatter |
| `FC` | Settings merge helper |
| `N` | Logger / error formatter |
| `EH` | String coercion helper |
| `CH` | JSON serialiser wrapper |
| `K8` | Error classification helper |
| `j8` | Error type helper |
| `g6` | JSON parse wrapper |
| `V6` | Telemetry event emitter |
| `RH` | Request retry/error handler |
| `c_` | Error message extractor |
| `mH` | String coercion (primitive) |
| `x6` | Async-local-storage context accessor |
| `Mm6` | Store getter |
| `j_` | Logger dispatch |
| `Dv` | Log sink |
| `r45` | Shell resolver |
| `Dm6` | Platform-specific shell path builder |
| `H` | Math.random / setTimeout holder (misc utilities) |
| `A` | Generic string/object helpers |
| `K` | Session map / value iterator |
| `L` | Promise finaliser / array helpers |
| `M` | Socket / connection object |
| `q` | File-system operations namespace |
| `Gh` | UI component helper |
| `V_H` | Config + file-write coordinator |
| `_HH` | Working-directory resolver |
| `X4` | Path redaction helper |
| `DOH` | Background-service telemetry anchor |
| `YY` | Telemetry event wrapper |
| `Xe` | Amber-anchor event emitter |
| `V1H` | Yp-based event helper |
| `ER8` | Add-directory flag consumer |
| `P` | MCP/SDK server connector |
| `T` | HE6/wh8 tool list builder |
| `XO` | Compact-boundary message slicer |
| `aW8` | iP context helper |
| `WzH` | Job config assembler |
| `S6` | Dv-based logging helper |
| `yG` | Basename + S6 path helper |
| `rt_` | h4/a9 registration helper |
| `h4` | Command registration executor |
| `a9` | W7A.register caller |
| `HQ1` | Daemon status file builder |
| `Pn` | vqH async helper |
| `A1` | Async-local-storage store accessor |
| `$v6` | Status-file path joiner |
| `bq` | Daemon-worker type resolver |
| `f$H` | Daemon-worker string constant |
| `ZLH` | Detach-request message renderer |
| `al6` | Detach sub-type constant resolver |
| `E_H` | Detach-request UI helper |
| `li1` | Environment label (test/production) |
| `jC` | Context helper |
| `sQ_` | Date.now / e_6 telemetry timer |
| `fE8` | Message array builder (isMeta / origin / human) |
| `_h1` | Nq/Bh text-trim helper |
| `Bh` | H.trim wrapper |
| `vK` | Tool-list constant |
| `zP` | API provider resolver |
| `RA` | mH string helper |
| `w5` | Provider constant |
| `I8_` | Auth-key prefix slicer |
| `Fq` | Auth flow orchestrator |
| `UpH` | cf credential helper |
| `EG` | Extra-graph helper |
| `nW8` | _.some tool-list checker |
| `$y` | Lc array-filter helper |
| `Lc` | Array.isArray / $K filter |
| `$K` | H.filter wrapper |
| `dtH` | H.startsWith prefix checker |
| `gO` | S6/h4 UI helper |
| `fB` | S6/h4 secondary UI helper |
| `tU` | Array.isArray type-guard |
| `O` | k8 output stream |
| `k8` | Output sink |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.