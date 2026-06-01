---
type: feature-spec
feature: "background"
cc_version: "2.1.146"
updated: "2026-06-01"
tags: ["background", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.146 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/background`

> Analysis basis: CC v2.1.146 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.146

---

## Overview

`/background` (alias: `/bg`) detaches the current interactive Claude Code session from the terminal and hands it off to the background daemon, freeing the terminal for other use. The command validates pre-conditions (session persistence enabled, at least one exchange in the conversation, permission-mode and auto-mode consent gates), then dispatches the session to the daemon process and renders a "(backgrounded)" status indicator in the UI.

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
| module_id | `ex1` |
| load_inline | `true` |
| loc_byte | `12468887` |
| loc_byte_end | `12469127` |
| loc_line | `10704` |
| arbor_handler.name | `ll7` |
| arbor_handler.fqn | `claude-2.1.146::ll7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.146 bundle.js:+12468887

---

## Input Branching

Five distinct pre-condition gates are checked before the dispatch path executes, making a Mermaid flowchart the appropriate representation.

```mermaid
flowchart TD
    A(["/background invoked"]) --> B{Session persistence\nenabled?}
    B -- No --> ERR1["Error: Cannot background —\nsession persistence is disabled,\nso the forked job would have\nnothing to resume."]
    B -- Yes --> C{At least one message\nin conversation?}
    C -- No --> ERR2["Error: Nothing to background yet —\nsend a message first."]
    C -- Yes --> D{bypassPermissions mode\nrequested via --bg?}
    D -- Yes, disclaimer\nnot accepted --> ERR3["Error: --bg with bypassPermissions\nrequires accepting the disclaimer\nfirst. Run 'claude\n--dangerously-skip-permissions'\nonce interactively."]
    D -- No / accepted --> E{auto mode\nrequested via --bg?}
    E -- Yes, opt-in\nmissing --> ERR4["Error: --bg with auto mode\nrequires opting in first. Run\n'claude --permission-mode auto'\nonce interactively."]
    E -- No / opted in --> F[Ensure daemon is running\nor spawn transient daemon]
    F --> G[Build dispatch arguments\n(agent, name, resume, session-id,\nallowed-tools, model, effort, …)]
    G --> H[Write dispatch file\nand send CLI-bg-dispatch\nto daemon socket]
    H --> I{Dispatch acknowledged?}
    I -- No ack\nor timeout --> ERR5["Dispatch error\n(daemon-unreachable /\nack-timeout / stale / etc.)"]
    I -- ACK received --> J["Render '(backgrounded)'\nstatus in UI"]
    J --> K([Terminal freed])
```

Analysis basis: CC v2.1.146 bundle.js:+12468329 (persistence gate), +12468505 (empty-session gate), +12461999 (bypassPermissions gate), +12462161 (auto-mode gate), +12440613 (dispatch path)

---

## Behavioral Spec

### Handler Entry Point (`ll7`)

The Arbor-resolved handler is `ll7` (AsyncFunction, resolved via `module_id`). It is the true entry point; the call-graph also lists `OG8` as the main orchestrator called immediately from `ll7`.

```
async function backgroundCommandHandler(appState, options):
    // Gate 1 — session persistence
    if sessionPersistenceDisabled(appState):
        return errorResult(
            "Cannot background — session persistence is disabled, " +
            "so the forked job would have nothing to resume."
        )

    // Gate 2 — non-empty session
    if conversationIsEmpty(appState):
        return errorResult("Nothing to background yet — send a message first.")

    // Delegate to dispatch orchestrator
    return await dispatchOrchestrator(appState, options)
```

Analysis basis: CC v2.1.146 bundle.js:+12468248 (`ll7` → `Cq`), +12468260, +12468300, +12468314, +12468466

---

### Dispatch Orchestrator (`OG8`)

`OG8` is the primary orchestration function called by `ll7`. It collects active sessions, validates permission gates, ensures the daemon is reachable, assembles CLI arguments, and fires the dispatch.

```
async function dispatchOrchestrator(appState, options):
    // Collect active session identifiers
    activeSessions = Array.from(sessionMap.values())   // K.values → Array.from

    // Permission-mode gates (bypassPermissions + auto)
    checkBypassPermissionsConsent(options)   // Ql7 → qc + Sl7.has
    checkAutoModeConsent(options)            // $C

    // Ensure daemon is running (install / transient spawn)
    await ensureDaemonRunning(options)       // Ac → Ql7 ... FU chain

    // Build the argument vector for the background job
    argVector = buildArgVector(appState, options)
        // includes: --agent, --name/-n, --resume/-r/--resume=,
        //           --session-id, --continue/-c, --fork-session,
        //           --allowed-tools, --disallowed-tools, --model,
        //           --effort, --add-dir, --permission-mode, etc.

    // Dispatch
    dispatchResult = await sendCliBackgroundDispatch(argVector)  // Zn_

    // Emit telemetry
    emit("tengu_background", { ... })

    // Render backgrounded status
    return renderBackgroundedUI("(backgrounded)")  // zG8 → TU / ZO
```

Analysis basis: CC v2.1.146 bundle.js:+12464432 (session enumeration), +12464667 (VM), +12464707 (permission check), +12464721 (daemon ensure), +12465333 (telemetry emit), +12465341 (`tengu_background`), +12466029 (`"(backgrounded)"`)

---

### Permission Pre-flight (`Ql7`)

Called for the `--bg` + `bypassPermissions` combination and for auto-mode consent.

```
function checkPermissionsGate(args, settings):
    // Strip "--" end-of-options marker if present
    normalizedArgs = args.slice(args.indexOf("--") + 1)   // H.indexOf + H.slice

    // Check --permission-mode bypassPermissions
    if argsInclude("--permission-mode") and value == "bypassPermissions":
        if not disclaimerAccepted(settings):   // Sl7.has
            throw "--bg with bypassPermissions requires accepting the disclaimer first. " +
                  "Run `claude --dangerously-skip-permissions` once interactively."

    // Check auto mode
    if permissionMode == "auto" and not autoModeOptIn(settings):
        throw "--bg with auto mode requires opting in first. " +
              "Run `claude --permission-mode auto` once interactively."
```

Analysis basis: CC v2.1.146 bundle.js:+12461756, +12461799, +12461830, +12461862, +12461999, +12462141, +12462161

---

### Daemon Ensure Running (`Ac` → `FU`)

`Ac` is the gate that guarantees a usable daemon before dispatch. It delegates to the full daemon-ensure function (`FU`).

```
async function ensureDaemonRunning(options):
    // Generate a gate-blocked UUID for dedup
    gateId = crypto.randomUUID().slice(0, 8)   // cx1.randomUUID + $.slice

    // Verify daemon status file (daemon.status.json via SK / AG)
    statusPath = joinPaths(configDir, "jobs", "daemon.status.json")

    // Create jobs directory if absent
    await fs.mkdir(statusPath.parent, { recursive: true })

    // Delegate to full daemon ensure logic (FU)
    await fullDaemonEnsure(options)
        // FU checks:
        //   - status == "up" → proceed
        //   - stale exec path → warn + transient fallback
        //   - platform: macos / linux
        //   - mode: ask | run | no
        //   - prompts "Install as a service now? [y/N/never, or 'once' just for now]"
        //   - falls back to transient spawn via Bun.spawn (via _HA)
        //   - timeouts: 30000 ms (initial), 60000 ms (extended), 5000 ms (service poll)
```

Analysis basis: CC v2.1.146 bundle.js:+12444772 (`Ac` → `Ql7`), +12444837 (randomUUID), +12444874 (SK), +12444897 (mkdir), +12444931 (`Cl7` / `FU`), +12408287 (`FU` entry), +12408315 (`"up"`), +12408330 (`"daemon_ensure_running"` telemetry key), +12413345 (5000 ms poll timeout), +12409995 (30000 ms), +12410017 (60000 ms)

---

### CLI Background Dispatch (`Zn_`)

`Zn_` performs the actual dispatch: it writes a dispatch file, opens a Unix domain socket connection to the daemon, sends the `cli-bg-dispatch` frame, and awaits acknowledgement.

```
async function cliBackgroundDispatch(argVector, options):
    // Timestamp start
    startTime = Date.now()

    // Attempt connection to daemon control socket (mP8 / AO)
    socket = await connectToDaemonSocket(socketPath)
        // Protocol: "connect" → "lease" → "data" → "close" events
        // Error codes: ENOCONN, ETIMEOUT, "control socket timeout"
        // On mid-request drop: "connection dropped mid-request — retry"

    // Write dispatch frame with channel "cli-bg-dispatch"
    frame = buildDispatchFrame(argVector)   // ikH / GU (Buffer protocol)
    await socket.write(frame)

    // Await ACK within timeout
    ackResult = await awaitAck(socket, timeoutMs: 6000)   // r8 / clearTimeout
    if not ackResult:
        emit("tengu_bg_dispatch_fallback", { reason: "no ack" })
        // Retry or raise dispatch error

    // Write dispatch file to filesystem (Qz → atomic rename)
    dispatchFilePath = joinPaths(configDir, randomBytes(4).toString("hex"))
    await atomicWriteFile(dispatchFilePath, JSON.stringify(frame))

    // Classify result
    match ackResult.code:
        "EALIVE"    → success
        "ESTALE"    → stale session (prior job still shutting down → short_alive error)
        "ESTARTING" → service still starting error
        default     → dispatch-error mapping:
            "daemon-unreachable" | "ack-timeout" | "dispatch-write" |
            "enoconn" | "estarting" | "stale-short" | "short-alive" | "respawn"

    emit("tengu_bg_dispatch", { ... })
    if rescued: emit("tengu_bg_dispatch_rescued", { ... })
```

Analysis basis: CC v2.1.146 bundle.js:+12440363 (`Zn_` entry), +12440613 (`"cli-bg-dispatch"`), +12440698 (`"no ack"`), +12440854 (6000 ms ACK timeout), +12440956 (`"EALIVE"`), +12441086 (`"ESTALE"`), +12441605 (`"ESTARTING"`), +12442467 (`tengu_bg_dispatch`), +12442993 (`tengu_bg_dispatch_fallback`), +12448167 (`tengu_bg_dispatch_rescued`), +12449090 (`"Previous session is still shutting down"`), +12451586–+12451802 (error label strings)

---

### Dispatch Argument Builder (`Cl7`)

`Cl7` constructs the full argument vector passed to the background job. It inspects current session state, applies passthrough flags, and normalises option names.

```
function buildArgVector(appState, options):
    args = []

    // Resume / session continuity
    if options.resume:          args += ["--resume=<id>" or "--resume", id]
    if options.sessionId:       args += ["--session-id=<id>" or "--session-id", id]
    if options.continue:        args += ["-c" | "--continue"]
    if options.forkSession:     args += ["--fork-session"]

    // Agent / naming
    if options.agent:           args += ["--agent", agentName]
    if options.name:            args += ["--name" | "-n", name]

    // Tool allowlists
    if options.allowedTools:    args += ["--allowed-tools", ...]
    if options.disallowedTools: args += ["--disallowed-tools", ...]

    // Model / effort
    if options.model:           args += ["--model", model]
    if options.effort:          args += ["--effort", effort]

    // Additional directories
    if options.addDir:          args += ["--add-dir", ...]

    // Permission / mode flags
    // (--permission-mode, forwarded env: CLAUDE_CONFIG_DIR,
    //  CLAUDE_INTERNAL_FC_OVERRIDES, AWS_*, GOOGLE_* vars)

    // Invocation type tag: "exec" | "bg" | "slash"
    args += [invocationType]

    // Classify job as "fleet" or "spare"
    jobClass = options.isSpare ? "spare" : "fleet"

    return args
```

Analysis basis: CC v2.1.146 bundle.js:+12445277 (indexOf `"--"`), +12445320 (`"--agent"`), +12445347 (`"--name"`), +12445450 (`"-c"`), +12445460 (`"--continue"`), +12445561 (`"--fork-session"`), +12445641 (ax1 block), +12446217 (`"fleet"`), +12446230 (`"spare"`), +12446310 (`"exec"`), +12446328 (`"bg"`), +12447172 (`"slash"`), +12462777–+12462932 (env var forwarding), +12464800 (`"--add-dir"`), +12464835 (`"--allowed-tools"`), +12464876 (`"--disallowed-tools"`), +12464907 (`"--model"`), +12464929 (`"--effort"`)

---

### Already-Backgrounded Guard

If the session is already running as a background worker, `/background` is a no-op with a dedicated telemetry event.

```
function alreadyBackgroundedGuard(appState):
    if appState.isBackgroundWorker:
        emit("tengu_background_already_bg")
        return noOp()
```

Analysis basis: CC v2.1.146 bundle.js:+12468260 (`c` flag check), +12468262 (`tengu_background_already_bg`)

---

### Spawn-Failure Fallback

When daemon dispatch fails after all retries, `tengu_background_spawn_failed` is emitted and an error message is shown.

```
function handleSpawnFailure(error, context):
    emit("tengu_background_spawn_failed", { error, context })
    // UI shows human-readable dispatch-error label
    // (e.g. "not running", "timed out", "socket missing", etc.)
```

Analysis basis: CC v2.1.146 bundle.js:+12465272 (`tengu_background_spawn_failed`), +12465333 (`tengu_background`)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_background` (bundle.js:+12465341) |
| Telemetry — already bg | `tengu_background_already_bg` (bundle.js:+12468262) |
| Telemetry — spawn failed | `tengu_background_spawn_failed` (bundle.js:+12465272) |
| Telemetry — dispatch | `tengu_bg_dispatch` (+12442467), `tengu_bg_dispatch_fallback` (+12442993), `tengu_bg_dispatch_rescued` (+12448167) |
| Telemetry — SIGKILL escalate | `tengu_bg_dispatch_sigkill_escalate` (+15060413) |
| Telemetry — daemon lifecycle | `tengu_bg_daemon_cold_start_ask` (+12409353), `tengu_bg_daemon_cold_start_ask_answer` (+12412889), `tengu_bg_daemon_install` (+12408788), `tengu_bg_daemon_service_stale_exec` (+12408405), `tengu_bg_daemon_service_poll_fallthrough` (+12409029), `tengu_bg_daemon_spawn_failed` (+12409787) |
| Telemetry — spare pool | `tengu_bg_spare_enable` (+15061631), `tengu_bg_spare_spawn` (+15060190), `tengu_bg_spare_claim` (+15061752), `tengu_bg_spare_claim_fail` (+15062015), `tengu_bg_spare_refill` (+15040064 literal key) |
| Telemetry — low memory | `tengu_bg_low_mem_mb` (+12414219), `tengu_bg_dispatch_low_mem` (+15060992) |
| Telemetry — config | `tengu_config_parse_error` (+3171293), `tengu_config_lock_contention` (+3168712), `tengu_config_stale_write` (+3168848), `tengu_config_auth_loss_prevented` (+3169191) |
| Telemetry — daemon control | `tengu_daemon_control` (+15095752), `tengu_daemon_config_reload` (+15074596), `tengu_daemon_idle_exit` (+15079597), `tengu_amber_anchor` (+3162320) |
| Filesystem side effects | Dispatch file written atomically under `$CLAUDE_CONFIG_DIR/jobs/` (random hex filename); `daemon.status.json` read; jobs directory created if absent |
| Unix socket | Connection opened to daemon control socket; `cli-bg-dispatch` frame sent; ACK awaited within 6000 ms |
| UI change | `"(backgrounded)"` label rendered in terminal; terminal released to shell |
| Process / spawn | If no running daemon: `Bun.spawn` used to launch transient daemon (`--bg-pty-host`, `--origin transient`, `--spawned-by <pid>`); spare PTY pool refilled asynchronously |
| Environment forwarding | `CLAUDE_CONFIG_DIR`, `CLAUDE_INTERNAL_FC_OVERRIDES`, `AWS_REGION`, `AWS_DEFAULT_REGION`, `AWS_PROFILE`, `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_PROJECT`, `GCLOUD_PROJECT` propagated to background job |
| Session state | `appState.isBackgroundWorker` inspected; if already true, command is a no-op |
| Permission flags forwarded | `--permission-mode`, `--dangerously-skip-permissions`, `--allow-dangerously-skip-permissions` conditionally forwarded |

---

## Version History

| Version | Change |
|---|---|
| v2.1.146 | Initial analysis |

---

## Common Mistakes

1. **Running `/background` before sending any message.** The command guards `conversationIsEmpty` and returns `"Nothing to background yet — send a message first."` — the terminal is not freed. (bundle.js:+12468505)
2. **Using `--permission-mode bypassPermissions` without the interactive disclaimer.** The daemon will refuse the dispatch. The fix is to run `claude --dangerously-skip-permissions` once interactively first. (bundle.js:+12461999)
3. **Using `auto` permission mode without prior opt-in.** Same pattern — run `claude --permission-mode auto` interactively once to set the consent flag. (bundle.js:+12462161)
4. **No background daemon running and non-interactive environment.** If there is no running daemon and the process cannot prompt for installation (`ask` mode), dispatch falls back to transient spawn; if that also fails, the error is `"No background daemon is running. Run 'claude daemon install'…"`. (bundle.js:+12409418)
5. **Calling `/background` in a session that already is a background worker.** The command silently no-ops (`tengu_background_already_bg`). (bundle.js:+12468262)
6. **Session persistence disabled globally.** If the project or user configuration has disabled session persistence, `/background` errors immediately because there is no persisted state to resume. (bundle.js:+12468329)

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `ll7` | Arbor-resolved handler — `/background` command AsyncFunction entry point |
| `OG8` | Dispatch orchestrator — main async function called by `ll7` |
| `Ac` | Daemon-ensure gate function (generates gate-blocked UUID, checks status, delegates to `FU`) |
| `Ql7` | Permission pre-flight check (bypassPermissions + auto-mode gates) |
| `qc` | Argument normaliser / `--permission-mode` value extractor |
| `Cl7` | Dispatch argument vector builder |
| `Zn_` | CLI background dispatch function (socket write + ACK await) |
| `FU` | Full daemon-ensure function (up / stale / ask / transient-spawn logic) |
| `mP8` | Daemon socket connect helper (connect → lease → data → close protocol) |
| `AO` | Low-level control-socket writer (ENOCONN / ETIMEOUT handling) |
| `ikH` | Dispatch file path helper |
| `Bx1` | Dispatch retry / stale-detection logic |
| `Tn_` | Dispatch acknowledgement parser (matchAll on raw bytes) |
| `iE6` | Daemon install orchestrator (service install + poll loop) |
| `_HA` | Transient daemon spawn (Bun.spawn, PTY host, spare pool seed) |
| `az5` | Spare-process argument assembler (Object.assign, env build) |
| `w` | Background job lifecycle manager (SIGKILL, memory checks, roster) |
| `$HA` | Background session spawn/claim helper |
| `AHA` | Spare-pool claim + PTY-host handshake |
| `tz5` | Send-claim with timeout (6 s, ECONNREFUSED handling) |
| `sz5` | Build-claim-frame helper |
| `VsH` | Roster file read/write helper |
| `Dr_` | Roster directory + writeFile helper |
| `D` | Daemon poll / dispose function (recursive, 2000 ms interval) |
| `_J8` | Tool-call type check (`some` predicate) |
| `zG8` | UI render function for backgrounded state (produces `"(backgrounded)"` label) |
| `TU` | Background status renderer variant (delegates to `y4`) |
| `ZO` | Alternative background status renderer (delegates to `y4`) |
| `Rn_` | Auto-mode policy resolver |
| `$C` | Auto-mode opt-in checker |
| `x8` | Settings layer reader (userSettings / localSettings / flagSettings / policySettings) |
| `mV` | Session-map accessor |
| `K8` | Global config save function |
| `dK_` | Config file write with lock and backup rotation |
| `Y$H` | Config file read helper |
| `cB4` | Config file-watch / reload helper |
| `Qz` | Atomic file write (randomBytes temp + rename) |
| `r8` | Timeout-with-abort helper |
| `N6` | Terminal output / render helper |
| `SH` | Shell detection and command construction |
| `vb6` | Windows/Git-Bash shell resolver |
| `EyH` | Agent query runner (full API call loop) |
| `kU1` | Core streaming query loop |
| `LtH` | Message serialiser for background handoff |
| `vk` | Conversation context packager |
| `iw8` | Attachment / image file serialiser |
| `kG` | Tool-schema builder |
| `nP` | Auth provider resolver |
| `hA` | API base-URL builder |
| `Gs8` | Managed-key / sk-ant prefix detector |
| `BJH` | Production/test environment tagger |
| `ELH` | Worker detach-request sender |
| `Ko` | Control-socket write helper (qo.write + CH) |
| `Cq` | Daemon-worker context accessor |
| `mR` | Session mode tag (`"production"` / `"test"`) |
| `Am1` | Session metadata builder |
| `jOH` | Jobs-directory snapshot helper |
| `HO` | Compact-boundary message builder |
| `ul` | Async-local-storage session-ID getter |
| `M1` | Async-store accessor (f6L.getStore) |
| `GE6` | Daemon status-file path builder |
| `CH` | JSON stringify wrapper |
| `ZH` | String coercion helper |
| `L8` | Error logger |
| `J8` | Logger / span helper |
| `g6` | JSON parse wrapper |
| `O4` | Path redaction helper (`[REDACTED]`) |
| `N` | Structured log emitter |
| `c9` | Hook registrar (c_A.register) |
| `VM` | Possibly a version/mode constant accessor |
| `TI8` | Additional-dirs flag accumulator |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.