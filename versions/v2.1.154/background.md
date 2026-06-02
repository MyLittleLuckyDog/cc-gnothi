---
type: feature-spec
feature: "background"
cc_version: "2.1.154"
updated: "2026-06-02"
tags: ["background", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.154 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/background`

> Analysis basis: CC v2.1.154 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.154

---

## Overview

`/background` (alias `/bg`) detaches the current interactive Claude Code session from the terminal and hands it off to the background daemon, allowing the AI agent to continue working autonomously while the terminal is freed. The command forks the current session state, dispatches a new daemon-managed background job, optionally attaches a follow-up prompt, and returns control to the shell. On completion the daemon sends a desktop notification so the user can resume the session later.

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
| module_id | `GHK` |
| load_inline | `true` |
| loc_byte | `12769699` |
| loc_byte_end | `12769939` |
| loc_line | `9998` |
| arbor_handler.name | `_w5` |
| arbor_handler.fqn | `claude-2.1.154::_w5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.154 bundle.js:+12769699

---

## Input Branching

Four distinct decision paths exist before dispatching the background job: session-persistence guard, already-backgrounded guard, permission/mode prerequisite checks, and the dispatch-plus-attach flow. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/background or /bg invoked"]) --> B{Session persistence enabled?}
    B -- No --> ERR1["Error: 'Cannot background — session persistence\nis disabled, so the forked job\nwould have nothing to resume.'"]
    B -- Yes --> C{Session already backgrounded?}
    C -- Yes --> SKIP["Emit tengu_background_already_bg\nNo-op / return"]
    C -- No --> D{Conversation non-empty?\n(messages sent?)}
    D -- No --> ERR2["Error: 'Nothing to background yet —\nsend a message first.'"]
    D -- Yes --> E{bypassPermissions mode requested?}
    E -- Yes --> F{Disclaimer accepted interactively?}
    F -- No --> ERR3["Error: '--bg with bypassPermissions requires\naccepting the disclaimer first.\nRun claude --dangerously-skip-permissions\nonce interactively.'"]
    F -- Yes --> G{auto permission-mode?}
    E -- No --> G
    G -- Yes --> I{Auto mode opted-in interactively?}
    I -- No --> ERR4["Error: '--bg with auto mode requires\nopting in first.\nRun claude --permission-mode auto\nonce interactively.'"]
    I -- Yes --> H
    G -- No --> H[Ensure daemon is running\nhF / daemon-ensure flow]
    H --> J[Fork session & build CLI argv\ntl / QD5]
    J --> K[Dispatch job to daemon\nTAA / bO / XRH]
    K --> L{Dispatch result}
    L -- Error --> ERR5["Display human-readable error\n(not running / timed out /\nsocket missing / etc.)"]
    L -- Success --> M[Show JSX '(backgrounded)' confirmation\nDy8 render]
    M --> N["Emit tengu_background\nFree terminal"]
```

Analysis basis: CC v2.1.154 bundle.js:+12769040 (`_w5` entry), +12769121 (persistence guard), +12769297 (empty-session guard), +12762535 (bypassPermissions gate), +12762697 (auto-mode gate)

---

## Behavioral Spec

### 1. Handler Entry — `_w5` (AsyncFunction)

The Arbor-resolved handler `_w5` is the top-level async function for this command.

```
async function backgroundCommandHandler(options, appContext):
    sessionState  = appContext.getSessionState()          // V9 / VOH
    currentConfig = appContext.getCurrentConfig()         // c

    // Guard 1 — persistence
    if not sessionState.persistenceEnabled:
        return renderError(
            "Cannot background — session persistence is disabled…")

    // Guard 2 — already backgrounded
    if sessionState.isAlreadyBackgrounded:
        emit("tengu_background_already_bg")              // +12769054
        return

    // Guard 3 — empty conversation
    if conversationIsEmpty(appContext):                  // H check
        return renderError("Nothing to background yet — send a message first.")

    // Render loading / in-progress state via JSX (kfH.createElement)
    renderInProgress()

    // Permission prerequisite checks (tD5 / rg path inside QD5)
    validatePermissionGates(options, currentConfig)     // may throw error strings

    // Ensure daemon is running (hF — full daemon-ensure flow)
    daemonHandle = await ensureDaemonRunning(appContext)

    // Fork current session into a background job (tl / QD5)
    jobArgs = buildBackgroundArgv(options, appContext)

    // Dispatch to daemon (TAA / bO / XRH)
    result = await dispatchToDaemon(daemonHandle, jobArgs)

    if result.error:
        return renderDispatchError(result)

    emit("tengu_background")                            // +12766075
    renderConfirmation("(backgrounded)")                // +12766759
```

Analysis basis: CC v2.1.154 bundle.js:+12769040, +12769052, +12769088, +12769258, +12769367

---

### 2. Permission Gate Validation — `tD5` / `rg`

Before forking, the handler inspects permission mode flags carried by the parent process argv.

```
function validatePermissionGates(argv, config):
    // Detect --permission-mode bypassPermissions
    if argv.includes("--permission-mode") and
       argv[indexOf("--permission-mode")+1] == "bypassPermissions"
       OR argv.includes("--dangerously-skip-permissions")
       OR argv.includes("--allow-dangerously-skip-permissions"):

        if not config.disclaimerAcceptedInteractively:
            throw "--bg with bypassPermissions requires accepting the disclaimer first. " +
                  "Run `claude --dangerously-skip-permissions` once interactively."
                                                         // +12762535

    // Detect auto permission mode
    if permissionMode == "auto":                         // +12762677
        if not config.autoModeOptedInInteractively:
            throw "--bg with auto mode requires opting in first. " +
                  "Run `claude --permission-mode auto` once interactively."
                                                         // +12762697
```

Analysis basis: CC v2.1.154 bundle.js:+12762292, +12762335, +12762366, +12762398, +12762535, +12762677, +12762697

---

### 3. Daemon-Ensure Flow — `hF`

`hF` is the daemon health/startup resolver. It is a complex async function that covers multiple OS paths.

```
async function ensureDaemonRunning(appContext):
    status = readDaemonStatus()                         // "up" / other

    emit("daemon_ensure_running")                       // +12705837

    if daemon is "up":
        return existingHandle

    platform = detectPlatform()                         // "macos" / "linux"

    if serviceExecPathIsStale():
        emit("tengu_bg_daemon_service_stale_exec")      // +12705912
        // fall through to transient spawn

    if daemonIsZombie():
        emit("tengu_bg_daemon_install")                 // +12706295
        if killFailed:
            emit("tengu_bg_daemon_service_poll_fallthrough")

    installMode = config.daemonInstall               // "ask" / "yes" / "once" / "never" / "no"
    if installMode == "ask":
        emit("tengu_bg_daemon_cold_start_ask")          // +12706860
        answer = promptUser(
            "Install as a service now? [y/N/never, or 'once' just for now] ")
        emit("tengu_bg_daemon_cold_start_ask_answer")   // +12713001
        // handle yes / once / never / no

    if no persistent daemon available and not "never":
        // Transient spawn
        spawnArgs = ["run", "--origin", "transient", "--spawned-by", ...]
        pid = spawnProcess(spawnArgs)
        if spawnFailed:
            emit("tengu_bg_daemon_spawn_failed")        // +12707294

        // Poll for reachability with 30 000 ms / 60 000 ms timeouts
        waitForDaemon(timeoutMs=30000)                  // +12707525
        if notReachable:
            emit("tengu_bg_daemon_ensure_transient_unreachable")
            throw error

    return daemonHandle
```

Timeout constants:
- Transient spawn poll: 30 000 ms (bundle.js:+12707525)
- Extended poll: 60 000 ms (bundle.js:+12707547)
- Service-install reachability wait: 5 000 ms (bundle.js:+12713457)

Analysis basis: CC v2.1.154 bundle.js:+12705774, +12705822, +12705837

---

### 4. Session Fork & Argv Builder — `tl` / `QD5`

`tl` constructs the full CLI argument vector that the daemon will use to spawn the background job.

```
function buildBackgroundArgv(options, appContext):
    // Generate a unique job ID (8 hex chars from randomUUID slice)
    jobId = randomUUID().slice(0, 8)                    // +12745416, +12745448

    // Base shell / agent args
    argv = ["--agent"]                                  // +12745915

    // Session naming
    if options.name or options.n:
        argv += ["--name", nameValue]                   // +12745942, +12745958

    // Resume / fork flags
    if options["--resume"] or options["-r"]:            // +12761519, +12761614
        argv += ["--resume=", sessionId]

    // Fork from current session
    argv += ["--fork-session"]                          // +12746156
    argv += ["--session-id=", currentSessionId]         // +12761873

    // Continuation mode flags (-c / --continue)
    if continueMode:
        argv += ["-c"]                                  // +12746045

    // Allowed / disallowed tools forwarded
    argv += ["--allowed-tools", ...]                    // +12765538
    argv += ["--disallowed-tools", ...]                 // +12765579

    // Model and effort
    argv += ["--model", modelName]                      // +12765610
    argv += ["--effort", effortValue]                   // +12765632

    // Add directories
    argv += ["--add-dir", ...]                          // +12765503

    // Reply-on-resume for prompt
    if options.prompt:
        argv += ["--reply-on-resume", options.prompt]   // +12765451

    // Extra environment variables propagated
    // CLAUDE_CONFIG_DIR, AWS_REGION, AWS_DEFAULT_REGION, AWS_PROFILE,
    // GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_CLOUD_PROJECT, GCLOUD_PROJECT
    //                                                    // +12763313–12763468

    // Temporary dispatch directory under jobs/tmp
    tmpDir = join(jobsDir, "tmp")                       // +12745497
    mkdir(tmpDir)

    return { jobId, argv, tmpDir }
```

Analysis basis: CC v2.1.154 bundle.js:+12745351, +12745416, +12745476, +12745526

---

### 5. Daemon Dispatch — `TAA` / `bO` / `XRH`

`TAA` is the core dispatch loop that sends the job to the daemon via a Unix domain socket and awaits an acknowledgement.

```
async function dispatchToDaemon(daemonHandle, jobSpec):
    // Write dispatch file atomically (gO — atomic write via randomBytes temp name)
    dispatchFile = join(jobsDir, jobSpec.jobId)
    atomicWriteJSON(dispatchFile, jobSpec)              // +12741836

    // Connect to daemon control socket (bO / CV8)
    socket = connectToSocket(daemonHandle.socketPath)   // bO: +12741290

    // Send "cli-bg-dispatch" message                   // +12741120
    socket.write(encodeMessage("cli-bg-dispatch", jobSpec))

    // Await acknowledgement with 6 000 ms timeout      // +12741361
    result = await Promise.race([
        waitForAck(socket),
        timeout(6000, "no ack")                         // +12741205
    ])

    emit("tengu_bg_dispatch")                           // +12742974

    // Handle error codes
    switch result.code:
        case "EALIVE":   // +12741463 — stale/collision
            emit("tengu_bg_dispatch_fallback")
            ...
        case "ESTALE":   // +12741593
            ...
        case "ESTARTING": // +12742112
            displayError("service still starting")      // +12752286
        case "ENOJOB":
            displayError("job not found — it may have already exited")
        default:
            emit("tengu_bg_dispatch_rescued")           // +12748845

    // Clean up tmp dispatch file
    unlink(dispatchFile)                                // TAA: +12742318

    return result
```

Timeout: acknowledgement window is 6 000 ms (bundle.js:+12741361).
Dispatch file mode bits: `0o600` (decimal 384, bundle.js:+12741843).

Analysis basis: CC v2.1.154 bundle.js:+12740870, +12741116, +12741149, +12741157, +12741290

---

### 6. Dispatch Error Rendering — `Dy8`

`Dy8` maps internal error codes to human-readable strings for display in the terminal.

```
function renderDispatchError(result):
    errorMap = {
        "daemon-unreachable" : "not running",           // +12752119
        "ack-timeout"        : "timed out",             // +12752157
        "dispatch-write"     : "couldn't write dispatch file", // +12752196
        "enoconn"            : "socket missing",        // +12752247
        "estarting"          : "service still starting", // +12752286
        "short-alive"        : "id collision with a prior job", // +12752335
        "stale-short"        : "Previous session is still shutting down — try again in a moment"
                                                        // +12749768
    }
    message = errorMap[result.code] ?? result.message
    renderJSX(<ErrorBox>{message}</ErrorBox>)
```

Analysis basis: CC v2.1.154 bundle.js:+12766479, +12766492, +12766566, +12766580, +12766600, +12766611

---

### 7. Spare Worker Pre-Warming — `P5A`

The daemon maintains a pool of pre-warmed spare workers (`--bg-spare` flag) to reduce cold-start latency when `/background` is invoked.

```
async function refillSpareWorker(daemonConfig):
    emit("tengu_bg_spare_spawn")                        // +15478297

    // Check free memory before spawning
    freeMem = os.freemem()                              // k5A.freemem
    freeMB  = Math.round(freeMem / 1024)               // +15479077
    if freeMB < LOW_MEM_THRESHOLD:
        emit("tengu_bg_dispatch_low_mem")               // +15479183
        return

    // Generate socket paths
    socketPath = join(sockDir, randomBytes(16).toString("hex"))

    // Spawn spare via Bun.spawn with PTY host args
    // --bg-pty-host 200 50 --bg-spare                  // +15458049, +15458090
    proc = Bun.spawn([execPath, "--bg-pty-host", "200", "50", "--bg-spare"])
    proc.unref()

    // Record spare in registry
    spareRegistry.add(socketPath)
    emit("tengu_bg_spare_enable")                       // +15479878

    // On dispatch, claim spare
    emit("tengu_bg_spare_claim")                        // +15479999
    // If claim fails (e.g. spare died):
    emit("tengu_bg_spare_claim_fail")                   // +15480262
```

PTY dimensions: columns = 200, rows = 50 (bundle.js:+15458067, +15458073).
SIGKILL escalation after spare fails to exit: `emit("tengu_bg_dispatch_sigkill_escalate")` (bundle.js:+15478604).

Analysis basis: CC v2.1.154 bundle.js:+15457753, +15457833, +15458031, +15458120, +15458190

---

### 8. Attach / Detach Loop — `lU5`

After the background job starts, the current terminal runs a brief attach loop that displays session phase messages before handing off. Ctrl+Z sends a detach signal.

```
function runAttachLoop(jobHandle, supervisorSocket):
    phase = jobHandle.getPhase()

    switch phase:
        case "starting":
            print("Session is starting — it will appear once ready. Ctrl+Z to detach")
                                                        // +15471206
        case "resuming":
            print("Waiting for session to redraw… Ctrl+Z to detach") // +15471279
        case "adopted":
            // session successfully adopted
        case "crashed":
            // trigger respawn flow

    // Stall detection: if phase does not advance within threshold
    // emit tengu_bg_attach_stall_ms                    // +15462516
    // after N stalls:
    if stallCount > STALL_LIMIT:
        emit("tengu_bg_attach_stall_gave_up")           // +15471580
        // OR attempt respawn:
        emit("tengu_bg_attach_stall_respawn")           // +15471849

    // On successful attach:
    emit("tengu_bg_attach")                             // +15470663

    // Kicked (session opened in another window):
    // "EKICKED: Session opened in another window"      // +15472906
```

Stall retry interval: 500 ms (bundle.js:+15470856). Maximum stall phases before giving up: 6 (bundle.js:+15470778).

Analysis basis: CC v2.1.154 bundle.js:+15470816, +15471083, +15471342, +15471948

---

### 9. Flush Timeout Guard — `nL`

Before detaching, the handler waits for any pending I/O to flush.

```
async function waitForFlush(sessionRef):
    return Promise.race([
        sessionRef.flush(),
        timeout(2000, "flush timeout")                  // +12765331, +12765336
    ])
```

Flush timeout: 2 000 ms (bundle.js:+12765331).

Analysis basis: CC v2.1.154 bundle.js:+12765323, +12765331

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_background` (+12766075), `tengu_background_already_bg` (+12769054), `tengu_background_spawn_failed` (+12766012) |
| Telemetry — dispatch | `tengu_bg_dispatch` (+12742974), `tengu_bg_dispatch_fallback` (+12743500), `tengu_bg_dispatch_rescued` (+12748845), `tengu_bg_dispatch_sigkill_escalate` (+15478604), `tengu_bg_dispatch_stale_drop` (+15468176), `tengu_bg_dispatch_low_mem` (+15479183) |
| Telemetry — daemon | `tengu_bg_daemon_cold_start_ask` (+12706860), `tengu_bg_daemon_cold_start_ask_answer` (+12713001), `tengu_bg_daemon_install` (+12706295), `tengu_bg_daemon_service_stale_exec` (+12705912), `tengu_bg_daemon_service_poll_fallthrough` (+12706536), `tengu_bg_daemon_spawn_failed` (+12707294) |
| Telemetry — spare | `tengu_bg_spare_spawn` (+15478297), `tengu_bg_spare_enable` (+15479878), `tengu_bg_spare_claim` (+15479999), `tengu_bg_spare_claim_fail` (+15480262) |
| Telemetry — attach | `tengu_bg_attach` (+15470663), `tengu_bg_attach_stall_ms` (+15462516), `tengu_bg_attach_stall_gave_up` (+15471580), `tengu_bg_attach_stall_respawn` (+15471849), `tengu_bg_attach_legacy_autorespawn` (+15470252), `tengu_bg_attach_kick` (+15472766) |
| Telemetry — daemon control | `tengu_daemon_config_reload` (+15493092), `tengu_daemon_control` (+15514441), `tengu_daemon_idle_exit` (+15498279) |
| Filesystem side effects | Writes atomic dispatch file under `jobs/tmp/` (mode 0o600); removes it after ack; creates socket files for PTY host; writes `daemon.status.json` |
| Unix socket | Opens connection to daemon control socket; unref'd to not block event loop |
| Process spawn | May spawn a transient daemon process (`run --origin transient`) or pre-warm spare workers via `Bun.spawn` with `--bg-pty-host 200 50 --bg-spare` |
| appState changes | Session is marked backgrounded; the terminal's stdin/stdout listeners are removed; PTY resize events stop |
| Terminal output | Renders JSX component `(backgrounded)` string and, on error, a human-readable error box |
| Environment propagation | Forwards `CLAUDE_CONFIG_DIR`, `AWS_REGION`, `AWS_DEFAULT_REGION`, `AWS_PROFILE`, `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_PROJECT`, `GCLOUD_PROJECT` to the forked job |

---

## Version History

| Version | Change |
|---|---|
| v2.1.154 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/background` before sending any message.** The command guards against an empty conversation and returns `"Nothing to background yet — send a message first."` — at least one user turn must exist.

2. **Using `bypassPermissions` without prior interactive acceptance.** Running `/background` (or `/bg`) with `--dangerously-skip-permissions` in a non-interactive context fails immediately unless the disclaimer was already accepted in a prior interactive session. Run `claude --dangerously-skip-permissions` interactively first.

3. **Using `auto` permission mode without prior opt-in.** Same pattern as above — `claude --permission-mode auto` must be run interactively at least once before `/bg` can use it in headless mode.

4. **Expecting instant re-attach.** The daemon attach loop may display a "Session is starting" banner for several seconds. Stall detection fires after repeated 500 ms intervals; the session is not immediately available for `claude --resume`.

5. **Running `/background` when session persistence is disabled** (e.g. a non-persistent, stateless session). The command returns a hard error and does not dispatch any job.

6. **Conflating `/background` with `/stop`.** `/background` forks and continues the agent headlessly; `/stop` terminates the current turn. After `/background` the job is still live and consuming API credits.

7. **Forgetting the daemon may not be installed.** When no system daemon service exists, the command falls back to a transient spawn. If that spawn also fails (`tengu_bg_daemon_spawn_failed`), `/background` errors out. Run `claude daemon install` to set up a persistent service.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `_w5` | Main async handler for `/background` command (Arbor-resolved) |
| `Yy8` | Background command registration object / wrapper function |
| `Dy8` | Dispatch-error renderer / JSX output builder |
| `tl` | Session-fork and CLI-argv builder |
| `QD5` | Background job argument assembly and dispatch orchestrator |
| `tD5` | Permission-gate validator (bypassPermissions / auto-mode checks) |
| `hF` | Daemon-ensure-running function (health check + spawn path) |
| `mI6` | Interactive daemon install prompt handler |
| `TAA` | Core daemon dispatch loop (writes dispatch file, sends socket message, awaits ack) |
| `bO` | Daemon control socket client (connect / send / receive) |
| `XRH` | Dispatch message encoder / framer |
| `CV8` | Alternative socket connector (connection retry path) |
| `LHK` | Dispatch acknowledgement waiter |
| `P5A` | Spare worker spawner and pool manager |
| `xU5` | Spare worker environment builder |
| `lU5` | Supervisor attach/detach loop (PTY bridge) |
| `cU5` | Attach-loop inner state machine |
| `dU5` | Attach stall detector |
| `EEK` | Attach timeout/retry scheduler |
| `nL` | Flush-timeout race wrapper (2 000 ms) |
| `sM` | Session-list accessor (for active session map) |
| `hAA` | Signal / hook registration helper |
| `RT` | Signal handler registration (daemon signal forwarding) |
| `bo1` | Daemon status file writer (`daemon.status.json`) |
| `MI6` | Status file path resolver |
| `QD5` | (see above — also contains `--fork-session` / `--session-id` logic) |
| `jHK` | `--resume` / `-r` flag parser |
| `aD5` | `--session-id` flag parser |
| `JHK` | Environment variable propagation filter |
| `Hw5` | `--continue` / `-c` flag checker |
| `qHK` | Argv formatter (joins with `, ` separator) |
| `gD5` | Platform-specific shell path resolver (`cmd.exe` / `/bin/sh`) |
| `WAA` | Dispatch file path sanitiser / redactor |
| `TAA` | (see above) |
| `Q8` | Abort-signal / timeout primitive |
| `gO` | Atomic file-write utility (randomBytes temp name, then rename) |
| `Af` | Job-file writer (calls `gO`) |
| `a9` | Job-record reader / cache manager |
| `D6H` | Job state resolver (`working` / `active` / `daemon`) |
| `v4` | Working-directory path normaliser |
| `ZH` | String coercer utility |
| `N` | Log/error formatter |
| `RH` | JSON serialiser wrapper |
| `m6` | JSON parser wrapper |
| `E6` | Background service health emitter |
| `SzH` | Background service status helper |
| `SHH` | Service state-key mapper |
| `SKH` | Service state resolver |
| `D` | Supervisor process manager (spawn / kill / freemem checks) |
| `w` | Worker process lifecycle manager |
| `r` | Allow-list filter for worker kill |
| `eI8` | Low-memory event emitter |
| `P` | PTY repaint scheduler |
| `X` | PTY client (write / resize / snapshot / tail) |
| `lU5` | (see attach loop above) |
| `vS6` | PTY write-through helper |
| `xf` | PTY end / flush helper |
| `M` | MCP connection manager (used during daemon lifecycle) |
| `vSH` | MCP server connector |
| `JGK` | MCP connection-result applier |
| `Gm5` | MCP client enumerator |
| `k` | Away-summary scheduler |
| `VW8` | App-state getter for away-summary |
| `Q58` | Away-summary API call wrapper |
| `oG1` | UUID generator for away-summary turn |
| `Z86` | Session-rename / fork-on-background flow |
| `ZA5` | Session-name generation dispatcher |
| `u0` | Main agent query executor |
| `K08` | App-state mutation handler |
| `au` | Subagent exit / command lifecycle handler |
| `dy` | Full agent query pipeline (n_K orchestrator) |
| `n_K` | Core query-to-API pipeline |
| `aRH` | No-assistant-message error handler |
| `Vc_` | Conversation message normaliser |
| `vT8` | Tool-schema builder |
| `jT` | Tool-call dispatcher |
| `kP` | API client factory |
| `hH` | Error formatter / ring-buffer logger |
| `Wz` | Structured error wrapper |
| `yH` | Terminal colour writer |
| `uH` | Terminal plain writer |
| `V9` | Daemon-worker check helper |
| `VOH` | Daemon-worker identity verifier |
| `m5H` | Detach-request sender (`detach-request` message) |
| `Av1` | PTY task-mode helper |
| `Ds` | PTY write dispatcher |
| `v2H` | Environment / version check (`production` / `test`) |
| `v6K` | Version string accessor |
| `Mb` | Build metadata accessor |
| `Wj` | Compact-boundary marker helper |
| `FZ8` | Compact-boundary detector |
| `i$` | Compact-boundary slice helper |
| `xYH` | Worktree / built-in job handler |
| `LB` | Array-check utility |
| `O` | Terminal output stream wrapper |
| `k8` | Terminal stream kind discriminator |
| `mZ8` | Tool-some checker |
| `Mh` | Tool-list flattener |
| `jl` | Tool-list DK filter |
| `VAH` | Argv starts-with checker |
| `V3` | Config-value reader (k6 / U4) |
| `k6` | Config store accessor |
| `ov` | Config primitive reader |
| `qF` | Config-value writer |
| `U4` | Config-write dispatcher |
| `_9` | Feature-flag registrar |
| `hAH` | Heartbeat sender |
| `QEK` | Heartbeat scheduler |