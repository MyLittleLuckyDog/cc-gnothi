---
type: feature-spec
feature: "background"
cc_version: "2.1.139"
updated: "2026-05-31"
tags: ["background", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.139 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/background`

> Analysis basis: CC v2.1.139 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.139

---

## Overview

`/background` (alias `/bg`) detaches the current interactive Claude Code session from the terminal and hands it off to a background daemon process, freeing the shell for other work. The command snapshots the in-flight conversation, dispatches a background job to the daemon (starting one if needed), and exits the foreground REPL while the AI agent continues running autonomously. If session persistence is disabled or no conversation has been started yet, the command fails with a descriptive error rather than silently dropping work.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `background` |
| description | `Continue this session in the background and free the terminal` |
| aliases | `["bg"]` |
| module_id | `lGq` |
| load_inline | `true` |
| loc_byte | `11832153` |
| loc_byte_end | `11832373` |
| loc_line | `7896` |
| immediate | `null` |
| arbor_handler.name | `DN7` |
| arbor_handler.fqn | `claude-2.1.139::DN7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.139 bundle.js:+11832153

---

## Input Branching

The command has 4+ distinct branches (session-persistence disabled, no prior message, already-backgrounded, and the happy-path dispatch flow with its own daemon sub-branches), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/background invoked"]) --> B{Session persistence\nenabled?}
    B -- No --> ERR1["Error: Cannot background —\nsession persistence is disabled\n(bundle.js:+11831600)"]

    B -- Yes --> C{Any messages\nin current session?}
    C -- No --> ERR2["Error: Nothing to background yet —\nsend a message first.\n(bundle.js:+11831776)"]

    C -- Yes --> D{Session already\nrunning in background?}
    D -- Yes --> ALREADY["Emit tengu_background_already_bg\nReturn silently\n(bundle.js:+11831533)"]

    D -- No --> E[Build background-job\nargv snapshot:\n--model, --effort, continue\n(bundle.js:+11828652–11828715)]

    E --> F{Permission mode\nchecks pass?}
    F -- bypassPermissions without\nprior disclaimer --> ERR3["Error: --bg with bypassPermissions\nrequires accepting disclaimer first\n(bundle.js:+11826384)"]
    F -- auto mode without\nprior opt-in --> ERR4["Error: --bg with auto mode\nrequires opting in first\n(bundle.js:+11826546)"]

    F -- Pass --> G[Ensure daemon running\nZp / mW6 subsystem\n(bundle.js:+11777516)]

    G --> H{Daemon status}
    H -- Not running &\nno service --> ASK["Prompt: Install as a service?\n[y/N/never/once]\n(bundle.js:+11781964)"]
    ASK --> INSTALL["Install / spawn transient\ntengu_bg_daemon_install\n(bundle.js:+11778017)"]
    INSTALL --> DISPATCH
    H -- Already up --> DISPATCH

    DISPATCH["Dispatch job via\nUnix-socket control channel\nfU_ / bGq\n(bundle.js:+11806849)"] --> J{Dispatch result}

    J -- "EALIVE / short-alive" --> RETRY["Respawn stale daemon\ntengu_bg_dispatch_rescued\n(bundle.js:+11813785)"]
    RETRY --> DISPATCH2["Re-dispatch\n(bundle.js:+11808552)"]

    J -- Error code --> ERR5["Map error code to human message:\nnot running / timed out /\ncouldn't write / socket missing /\nid collision\n(bundle.js:+11816065–11816234)"]

    J -- Success --> OK["Print '(backgrounded)'\nEmit tengu_background\nExit foreground REPL\n(bundle.js:+11829036, +11829687)"]
    DISPATCH2 --> OK
```

---

## Behavioral Spec

### Pre-flight Validation

```
async function backgroundCommandHandler(appState, args):
    # Guard 1 — session persistence (bundle.js:+11831519)
    if not sessionPersistenceEnabled(appState):
        throw "Cannot background — session persistence is disabled, ..."

    # Guard 2 — conversation has content (bundle.js:+11831776)
    if conversationIsEmpty(appState):
        throw "Nothing to background yet — send a message first."

    # Guard 3 — already detached (bundle.js:+11831533)
    if sessionAlreadyBackgrounded(appState):
        emit telemetry("tengu_background_already_bg")
        return  # no-op
```

Analysis basis: CC v2.1.139 bundle.js:+11831519

---

### Argv Reconstruction (argvSnapshotBuilder / `Bj8`)

The handler reconstructs a CLI argv array that will be used to resume the session inside the daemon worker. It carries:

- `--model` — the model currently in use (bundle.js:+11828652)
- `--effort` — effort level, if set (bundle.js:+11828674)
- `continue` — the resume sub-command, so the daemon picks up the existing conversation (bundle.js:+11828715)
- Session ID and any fork-session flags assembled by the `tv7` subsystem (bundle.js:+11811494)
- Permission-mode flags forwarded verbatim (bundle.js:+11826184)

```
function buildBackgroundArgv(sessionState, permissionMode):
    argv = []

    if permissionMode == "bypassPermissions":
        if not disclaimerAlreadyAccepted():
            throw "--bg with bypassPermissions requires accepting the disclaimer ..."
        argv.push("--dangerously-skip-permissions")  # bundle.js:+11826247

    if permissionMode == "auto":
        if not autoModeOptInRecorded():
            throw "--bg with auto mode requires opting in first ..."  # bundle.js:+11826546
        argv.push("--permission-mode", "auto")

    argv.push("--model", currentModel)
    if effortLevel:
        argv.push("--effort", effortLevel)
    argv.push("continue")

    sessionArgs = assembleSessionArgs(sessionId, forkFlags)
    return argv + sessionArgs
```

Analysis basis: CC v2.1.139 bundle.js:+11828502

---

### Daemon Lifecycle Subsystem (`daemonEnsureRunning` / `Zp`)

Before dispatching, the command ensures a background daemon is reachable:

```
async function daemonEnsureRunning(config):
    status = readDaemonStatus()  # daemon.status.json, bundle.js:+11520008

    if status == "up":
        emit telemetry("tengu_bg_daemon_service_stale_exec")  # if binary path stale
        return socketPath

    platform = detectPlatform()  # "macos" | "linux" | "windows"

    if serviceInstalled():
        result = pollServiceUntilReachable(timeout=10000ms)  # bundle.js:+11779224
        if not result:
            emit telemetry("tengu_bg_daemon_service_poll_fallthrough")
    else:
        answer = promptUser(
            "Install as a service now? [y/N/never, or 'once' just for now] "
        )   # bundle.js:+11781964
        emit telemetry("tengu_bg_daemon_cold_start_ask")

        if answer in ["yes", "y"]:
            installService()
            emit telemetry("tengu_bg_daemon_install")
            waitForDaemonReachable(timeout=5000ms)  # bundle.js:+11782495
            if not reachable:
                warn("service installed but the daemon did not become reachable within 5s ...")
        elif answer == "once":
            spawnTransientDaemon(flags=["run", "--origin", "transient"])
        elif answer in ["never", "no", "n"]:
            fail("No background daemon is running. Run 'claude daemon install' ...")

    return socketPath
```

Analysis basis: CC v2.1.139 bundle.js:+11777516

---

### Job Dispatch Subsystem (`dispatchJob` / `fU_`)

```
async function dispatchJob(argv, sessionDir, socketPath):
    jobId = generateRandomHex(8)  # bundle.js:+11807072
    dispatchFilePath = join(sessionDir, jobId)

    writeDispatchFile(dispatchFilePath, {argv, sessionId, ...})  # bundle.js:+11807692
    # File permissions: 0o600 (384 octal, bundle.js:+11807699)

    socket = connectControlSocket(socketPath)   # v$, bundle.js:+10393097
    socket.setTimeout(6000)                     # bundle.js:+11807217

    writeJsonMessage(socket, {type:"dispatch", jobId, ...})
    ack = await waitForAck(socket)              # bundle.js:+11807872

    if ack == null:
        throw {code: "EALIVE"} or {code: "ESTALE"}  # bundle.js:+11807319, +11807449

    emit telemetry("tengu_bg_dispatch")         # bundle.js:+11808727
    return {success: true, jobId}

    on error:
        if errorCode in ["EALIVE", "short_alive"]:
            # daemon is being replaced — retry after rescue
            respawnDaemon()
            emit telemetry("tengu_bg_dispatch_rescued")  # bundle.js:+11813785
            return dispatchJob(argv, sessionDir, socketPath)  # recursive retry

        mapErrorToMessage(errorCode)  # bundle.js:+11816065
        # "not running" | "timed out" | "couldn't write dispatch file"
        # | "socket missing" | "id collision with a prior job"
        emit telemetry("tengu_bg_dispatch_fallback")
```

Analysis basis: CC v2.1.139 bundle.js:+11806789

---

### Foreground Teardown (`DN7` main handler)

```
async function backgroundHandler(appState, args):
    # ... guards above ...

    argv = buildBackgroundArgv(appState, args)  # Bj8 subsystem

    jobRecord = await initiateBackgroundJob(appState, argv)  # pHH subsystem
    if jobRecord.status == "gate_blocked":      # bundle.js:+11810755
        displayError(jobRecord.reason)
        emit telemetry("tengu_background_spawn_failed")  # bundle.js:+11828967
        return

    emit telemetry("tengu_background")          # bundle.js:+11829036

    dispatchResult = await dispatchJob(...)     # tv7 / fU_ subsystems

    if dispatchResult.error:
        displayDispatchError(dispatchResult)
        return

    # Happy path — announce detachment and exit REPL
    print("(backgrounded)")                     # bundle.js:+11829687
    exitForegroundRepl(appState)                # C9 state update, bundle.js:+11829255
```

Analysis basis: CC v2.1.139 bundle.js:+11831519

---

### Job Record Preparation (`jobRecordPreparer` / `pHH`)

Before dispatching, the system:

1. Generates a UUID for the job (uses `pGq.randomUUID`, bundle.js:+11810780)
2. Writes a `daemon.status.json` file in a `jobs/` subdirectory (bundle.js:+3922313, +11520008)
3. Creates the jobs directory with mode `0o700` (8 bits, bundle.js:+11810812) via `BHH.mkdir`
4. If preparation fails, marks the record as `"spawn_failed"` (bundle.js:+11811102) and returns `"gate_blocked"` (bundle.js:+11810755)
5. Registers a file-watcher (`pVL` / `tl6.watchFile`) on the status file to track daemon acknowledgment (bundle.js:+3131180)

Analysis basis: CC v2.1.139 bundle.js:+11810715

---

### Environment Variable Propagation

The argv builder propagates a fixed allow-list of environment variables into the background job context (bundle.js:+11827133–11827288):

| Variable | Purpose |
|---|---|
| `CLAUDE_CONFIG_DIR` | Config directory override |
| `CLAUDE_INTERNAL_FC_OVERRIDES` | Internal feature flag overrides |
| `AWS_REGION` / `AWS_DEFAULT_REGION` | Bedrock region |
| `AWS_PROFILE` | Bedrock credentials profile |
| `GOOGLE_APPLICATION_CREDENTIALS` | Vertex AI credentials |
| `GOOGLE_CLOUD_PROJECT` / `GCLOUD_PROJECT` | Vertex AI project |

Analysis basis: CC v2.1.139 bundle.js:+11827133

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_background` | Fired on every successful detach attempt (bundle.js:+11829036) |
| Telemetry: `tengu_background_already_bg` | Fired when session is already backgrounded (bundle.js:+11831533) |
| Telemetry: `tengu_background_spawn_failed` | Fired when job-record preparation fails (bundle.js:+11828967) |
| Telemetry: `tengu_bg_dispatch` | Fired on each successful socket dispatch (bundle.js:+11808727) |
| Telemetry: `tengu_bg_dispatch_fallback` | Fired when dispatch falls back to error path (bundle.js:+11809253) |
| Telemetry: `tengu_bg_dispatch_rescued` | Fired when stale daemon is respawned mid-dispatch (bundle.js:+11813785) |
| Telemetry: `tengu_bg_daemon_cold_start_ask` | Fired when user is prompted to install daemon (bundle.js:+11778582) |
| Telemetry: `tengu_bg_daemon_cold_start_ask_answer` | Fired with user's answer to the install prompt (bundle.js:+11782039) |
| Telemetry: `tengu_bg_daemon_install` | Fired when daemon service installation is triggered (bundle.js:+11778017) |
| Telemetry: `tengu_bg_daemon_spawn_failed` | Fired when transient daemon spawn fails (bundle.js:+11779016) |
| Telemetry: `tengu_bg_daemon_service_stale_exec` | Fired when daemon binary path is stale (bundle.js:+11777634) |
| Telemetry: `tengu_bg_daemon_service_poll_fallthrough` | Fired when service poll times out (bundle.js:+11778258) |
| Telemetry: `tengu_config_parse_error` | Fired on config file parse failures during setup (bundle.js:+3135421) |
| Telemetry: `tengu_config_lock_contention` | Fired when config lock is slow (bundle.js:+3132840) |
| Telemetry: `tengu_config_stale_write` | Fired on stale config write detection (bundle.js:+3132976) |
| Telemetry: `tengu_config_auth_loss_prevented` | Fired when auth-loss write is blocked (bundle.js:+3133319) |
| Telemetry: `tengu_amber_anchor` | Fired from background-service status helper (bundle.js:+3126569) |
| Telemetry: `tengu_daemon_config_reload` | Fired when daemon reloads its config (bundle.js:+14324140) |
| File system | Creates `jobs/` subdirectory under session dir; writes dispatch file; writes `daemon.status.json`; sets up file watcher |
| appState changes | `C9` state update exits the foreground REPL loop when dispatch succeeds (bundle.js:+11829255) |
| Control socket | Opens a Unix domain socket to the daemon, writes a JSON dispatch message, awaits acknowledgment, then closes |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.139 | Initial analysis |

---

## Common Mistakes

1. **Running `/background` before sending any message.** The guard at bundle.js:+11831776 rejects immediately with "Nothing to background yet — send a message first." You must have at least one exchange in the conversation.
2. **Using `--dangerously-skip-permissions` without prior interactive consent.** The permission check at bundle.js:+11826384 requires the disclaimer to have been accepted in a previous interactive session before `/background` will honour that mode.
3. **Using auto-mode without prior opt-in.** Similarly, bundle.js:+11826546 requires running `claude --permission-mode auto` interactively at least once before `/bg` can use it.
4. **Daemon not installed and answering "never" at the prompt.** Answering "never" blocks the current invocation and persists the preference; subsequent `/bg` calls will also refuse to start the daemon until the preference is changed.
5. **Session persistence disabled (e.g., `--no-persistence` flag).** The very first guard (bundle.js:+11831600) aborts with an explicit error; enabling persistence in project settings is required.
6. **Expecting the terminal to stay open.** The command's purpose is to *exit* the foreground REPL. Any pending output in the current terminal is lost after "(backgrounded)" is printed.
7. **Confusing `/background` with `/bg` — they are identical.** `bg` is a registered alias (registration.aliases) and behaves exactly the same way.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `DN7` | Main async handler for `/background` (arbor_handler; AsyncFunction) |
| `Bj8` | Argv reconstruction and top-level orchestration for background dispatch |
| `Fj8` | JSX rendering helper for background status output |
| `pHH` | Job-record preparation: UUID generation, jobs-dir creation, file-watcher setup |
| `tv7` | Full background session dispatch pipeline (session args, daemon dispatch, cleanup) |
| `fU_` | Core job dispatch loop: write dispatch file, connect socket, await ack, handle retries |
| `mW6` | Daemon installation prompt flow ("Install as a service now?") |
| `Zp` | Daemon ensure-running subsystem: status check, poll, platform detection |
| `KU_` | Dispatch error code mapper (EALIVE, ESTALE, daemon-unreachable, etc.) |
| `v$` | Unix control-socket connector: connect, timeout, write, read ack |
| `bGq` | Background job acknowledgment tracker and telemetry emitter |
| `$N7` | Permission-mode validation for background (bypassPermissions / auto checks) |
| `UHH` | Permission-mode flag parser (`--permission-mode`, `--dangerously-skip-permissions`) |
| `ON7` | Permission keyword lookup in wU_ allow-set |
| `gGq` | `--resume=` / `-r=` argument parser |
| `fN7` | `--session-id=` argument parser |
| `QGq` | Additional session-id flag parser |
| `MN7` | Argv slice helper |
| `RGq` | Job list formatter (join with ", ") |
| `yU` | Settings-source resolver (userSettings / localSettings / flagSettings / policySettings) |
| `C9` | App-state updater (exits foreground REPL) |
| `jU_` | App-state query (reads current session state) |
| `uL` | State transition helper |
| `sMH` | Jobs-directory config path builder |
| `Q1` | Jobs directory reader / job-record loader |
| `pf` | Job-record file writer |
| `j2` | Job-record cache invalidator |
| `oAH` | Working-directory / active-status helper |
| `b6` | Global config writer with lock |
| `cfH` | Config file reader with backup logic |
| `pVL` | File-watcher setup for daemon.status.json |
| `H8` | Config save-with-lock entry point |
| `c8_` | Atomic config writer (temp file, rename, backup rotation) |
| `dSH` | Atomic file write helper (symlink-safe, fsync, fchmod) |
| `d8_` | Config write helper (dirname mkdir, atomic write) |
| `NXq` | daemon.status.json writer |
| `RD` | Atomic JSON file writer (randomBytes temp name, rename) |
| `fW6` | daemon.status.json path builder |
| `WK` | Jobs directory path builder |
| `rW` | Jobs directory base-path helper |
| `sIH` | Dispatch-file path builder |
| `o8` | Async wait-with-timeout utility |
| `brH` | Background REPL session launcher (forks agent into background REPL) |
| `XY8` | Argv array builder helper |
| `MN` | Background agent runner (spawns agent, wires stdio) |
| `jVq` | Core agent query loop |
| `hvH` | Agent initialisation and conversation hydrator |
| `dN_` | Conversation message loader |
| `cG` | Message normalisation pipeline |
| `o$8` | Message content block processor |
| `q87` | Tool-result block processor |
| `NK` | Message filter for agent context |
| `QW` | Background agent completion handler |
| `mj` | Keyboard/input handler for background agent |
| `kbH` | Input binding helper |
| `AKH` | Detach-request message emitter |
| `A8q` | Task-type message builder |
| `Bn` | Writer that flushes detach-request to daemon worker |
| `OwH` | Environment/mode detector (production vs test) |
| `tTq` | Test-environment detector |
| `kS` | Environment mode selector |
| `Z1` | Daemon-worker entry-point reference |
| `Zo` | Daemon worker main loop |
| `G$` | Compact-boundary marker helper |
| `Tq7` | Compact boundary finder |
| `fP` | Conversation compaction helper |
| `Q$` | State query for backgrounded-flag |
| `Ap` | State setter for backgrounded-flag |
| `LH` | Structured logger (error/warn/info levels) |
| `q_` | Error/string coercion helper |
| `S1` | Log entry formatter |
| `G7A` | Log string serialiser |
| `CGK` | Log queue manager (shift/push ring buffer) |
| `sp` | Background session cleanup helper |
| `PY` | Background-service status renderer |
| `QfH` | Status label builder |
| `ouH` | Status detail renderer |
| `zAH` | Status detail helper |
| `KKH` | Background session state reader |
| `H$6` | Session-ID extractor helper |
| `xFH` | Session-flag extractor helper |
| `IH` | String coercion / integer helper |
| `SH` | String constructor wrapper |
| `yH` | JSON serialiser wrapper |
| `U6` | JSON parser wrapper |
| `D8` | Log/warn wrapper |
| `w8` | Debug logger |
| `N` | Structured log emitter (debug / info / warn levels) |
| `LM` | Path redaction helper ("[REDACTED]") |
| `C6` | AsyncLocalStorage context reader |
| `ry6` | Store getter for async context |
| `A_` | Context value accessor |
| `lI` | Current-session accessor |
| `lf` | Session-flag reader |
| `HN7` | Post-dispatch status display helper |
| `Wh` | Array.isArray guard for message content |
| `O` | Output stream / replace helper |
| `x8` | Output stream reference |
| `cO8` | Content-block "some" predicate |
| `oC` | Content-block category classifier |
| `Sg` | Content-block type resolver |
| `NiH` | Header-prefix checker |
| `zN7` | Spare/fleet mode selector |