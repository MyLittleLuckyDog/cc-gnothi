---
type: feature-spec
feature: "daemon"
cc_version: "2.1.143"
updated: "2026-05-18"
tags: ["daemon", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.143 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/daemon`

> Analysis basis: CC v2.1.143 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.143

---

## Overview

The `/daemon` slash command provides a unified management interface for Claude Code's background service layer, covering three distinct subsystems: **assistant daemons**, **scheduled tasks**, and **remote control** sessions. When invoked, the command executes immediately (without requiring user confirmation) and renders a live-updating JSX panel that reflects real-time daemon state. Control operations (start, stop, restart, uninstall) are dispatched through a Unix-socket-based supervisor protocol, while status is polled on a short interval via `setInterval`.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `daemon` |
| description | `Manage background services: assistants, scheduled tasks, and remote control` |
| immediate | `true` |
| module_id | `Kg_` |

Analysis basis: CC v2.1.143 bundle.js:+11919149

---

## Input Branching

The command dispatches on a **view key** derived from the current UI state. Four top-level views are possible; three of them open detail sub-panels.

```mermaid
flowchart TD
    A[/daemon invoked] --> B{current view key}
    B -->|default / root| C[Render daemon overview panel]
    B -->|detail-scheduled| D[Render scheduled task detail]
    B -->|detail-assistant| E[Render assistant detail]
    B -->|detail-remoteControl| F[Render remote-control detail]

    C --> G{sub-tab selected}
    G -->|Scheduled| H[List scheduled tasks via roster]
    G -->|Remote Control| I[List remote-control entries]
    G -->|Assistant / default| J[List assistant daemons]

    J --> K{control action}
    K -->|start| L[Send start to supervisor socket]
    K -->|stop| M[Send stop to supervisor socket]
    K -->|restart| N[Send stop then kickstart]
    K -->|uninstall| O[Run launchctl bootout — macOS only]

    D --> P[Show scheduled task detail + state]
    E --> Q[Show assistant detail + process info]
    F --> R[Show remote-control session info]
```

Analysis basis: CC v2.1.143 bundle.js:+11908563 (view key dispatch), +11909291 (remoteControl tab), +11909660 (Scheduled tab), +11909981 (Remote Control label), +11910266 (Claude Daemon heading)

---

## Behavioral Spec

### 1. Command Entry Point — Top-Level Orchestrator

The top-level render function (`Kb7` in the bundle) is invoked immediately upon `/daemon` being accepted (`immediate: true`).

```
function daemonCommandRenderer(context):
    statusBundle  = await gatherAllDaemonStatus()   // parallel fetch
    uiState       = buildInitialUiState(statusBundle)
    renderResult  = mountJsxPanel(uiState)
    return renderResult
```

The function fans out via `Promise.all` to gather status from every subsystem concurrently before the first render.

Analysis basis: CC v2.1.143 bundle.js:+11918106 (`Promise.all`), +11918119 (`Promise.resolve`), +11918523 (`M.render`)

---

### 2. Status Gathering — `gatherAllDaemonStatus`

Collects state from assistant daemons, scheduled tasks, roster, remote-control, and the launchctl service record in parallel.

```
async function gatherAllDaemonStatus():
    results = await Promise.all([
        readScheduledTasks(),        // reads daemon.scheduled.status.json
        readAssistantDaemonStatus(), // reads daemon.status.json
        readRoster(),                // reads roster.json
        readRemoteControlConfig(),   // reads daemon.json
        queryLaunchctlService()      // launchctl print — macOS only
    ])
    return mergeResults(results)
```

Key file names used:

| File | Purpose |
|---|---|
| `daemon.json` | Remote-control / base configuration |
| `daemon.status.json` | Assistant daemon process status |
| `daemon.scheduled.status.json` | Scheduled task run status |
| `roster.json` | Background-session roster |

Analysis basis: CC v2.1.143 bundle.js:+10554893 (`daemon.json`), +11707334 (`daemon.status.json`), +11796320 (`daemon.scheduled.status.json`), +10560943 (`roster.json`)

---

### 3. Scheduled Task Reader — `readScheduledTasks`

```
async function readScheduledTasks():
    raw = await readFileUtf8(scheduledStatusPath)
    if raw is null or empty:
        return []
    parsed = JSON.parse(raw.trim())
    if not Array.isArray(parsed):
        throw Error("expected array")
    // filter entries whose kind == "scheduled"
    return parsed.filter(entry => entry.kind == "scheduled")
```

File encoding: `"utf8"`.
Entry kind discriminator: `"scheduled"`.

Analysis basis: CC v2.1.143 bundle.js:+11708130 (`utf8`), +11797825 (`scheduled`), +11708313 (`Array.isArray`)

---

### 4. Stale-File Cleanup — `removeStaleStatusFiles`

After reading, entries whose backing PID is no longer alive are cleaned up synchronously via `unlinkSync`.

```
function removeStaleStatusFiles(entries):
    for entry in entries:
        if not processIsAlive(entry.pid):
            fs.unlinkSync(entry.statusFilePath)
```

Analysis basis: CC v2.1.143 bundle.js:+14482768 (`n8K.unlinkSync`)

---

### 5. Roster Parser — `parseRoster`

```
async function parseRoster():
    raw = await readFile(rosterPath)
    parsed = JSON.parse(raw)
    validate(parsed)            // throws on schema mismatch
    timestamp = Date.now()
    return { entries: parsed, readAt: timestamp }
```

On JSON parse failure a `tengu_bg_roster_parse_failed` telemetry event is emitted.

Analysis basis: CC v2.1.143 bundle.js:+10564456 (`tengu_bg_roster_parse_failed`), +10564310 (`Date.now`)

---

### 6. macOS Service Query — `queryLaunchctlService`

Queries the macOS `launchctl` service record for the Claude daemon label. The command invoked is `launchctl print`.

```
async function queryLaunchctlService():
    if platform != "darwin":
        return null
    result = await runCommand("launchctl", ["print", daemonLabel])
    // timeout: 5000 ms
    return parseLaunchctlOutput(result)
```

Timeout: **5 000 ms** (bundle.js:+10558469).
Label constructed from: `"Library"` + `"LaunchAgents"` path components (bundle.js:+10555207, +10555217).
The helper `queryProcessUid` calls `process.getuid()` to verify the running user.

Analysis basis: CC v2.1.143 bundle.js:+10558422 (`launchctl`), +10558435 (`print`), +10558469 (`5000`), +10555276 (`process.getuid`)

---

### 7. Control Actions Dispatcher

The UI panel exposes four control actions that are forwarded to the supervisor over the Unix socket.

```
function dispatchControlAction(action, daemonId):
    match action:
        case "start":
            supervisorSocket.send({ type: "start", id: daemonId })
        case "stop":
            supervisorSocket.send({ type: "stop", id: daemonId })
        case "restart":
            // send stop, then after exit send kickstart
            supervisorSocket.send({ type: "stop", id: daemonId })
            await waitForExit(daemonId, timeoutMs=10000)
            supervisorSocket.send({ type: "kickstart", id: daemonId })
        case "uninstall":
            if platform == "darwin":
                run("launchctl", ["bootout", daemonLabel])
            else:
                return Error("service uninstall not available on darwin")
```

Restart abort condition: if daemon has not exited within **10 s** of `SIGTERM`, restart is aborted before `kickstart`.

Analysis basis: CC v2.1.143 bundle.js:+10557332 (`start`), +10557368 (`stop`), +10557343 (`kickstart`), +10556980 (`bootout`), +10557665 (10 s abort message), +11908544 (`uninstall`)

---

### 8. Live Polling Loop

The JSX component sets up a `setInterval`/`clearInterval` loop that re-fetches daemon status and updates the rendered panel.

```
function useDaemonPolling(intervalMs):
    [status, setStatus] = useState(initialStatus)
    useEffect(() =>
        timerId = setInterval(() =>
            newStatus = await gatherAllDaemonStatus()
            setStatus(newStatus)
        , intervalMs)
        return () => clearInterval(timerId)
    , [])
    return status
```

Analysis basis: CC v2.1.143 bundle.js:+11908374 (`setInterval`), +11908446 (`clearInterval`), +11908321 (`e1.useEffect`), +11908121 (`e1.useState`)

---

### 9. Supervisor Socket Protocol

The daemon supervisor communicates via a Unix domain socket with a length-prefixed binary frame format.

```
function buildFrame(payload):
    body   = JSON.stringify(payload)
    header = Buffer.allocUnsafe(5)   // 4-byte length + 1-byte type
    header.writeUInt32BE(body.length, 0)
    header.writeUInt8(frameType, 4)
    return Buffer.concat([header, Buffer.from(body)])
```

Protocol error codes observed in literals:

| Code | Meaning |
|---|---|
| `ESTARTING` | Supervisor still starting up |
| `EPROTO` | Protocol version mismatch |
| `ESTALE` | Stale dispatch ID |
| `ETIMEOUT` | Operation timed out |
| `ENOJOB` | Job not found |
| `ENOREPLY` | Job not accepting replies |
| `EUNVERIFIED` | Worker identity could not be verified |
| `ERESPAWNING` | Worker is being respawned |
| `ETOOLARGE` | Message exceeds size limit |
| `EUNKNOWN` | Unknown error |

Analysis basis: CC v2.1.143 bundle.js:+10113723 (`writeUInt32BE`), +10113751 (`writeUInt8`), +14492343 (`ESTARTING`), +14492644 (`EPROTO`), +14491154 (`ESTALE`), +14491245 (`ETIMEOUT`), +14493950 (`ENOJOB`), +14494091 (`ENOREPLY`), +14495171 (`EUNVERIFIED`), +14495265 (`ERESPAWNING`), +14489739 (`ETOOLARGE`)

---

### 10. Spare Session Management

The supervisor maintains a pool of pre-warmed "spare" sessions to reduce attach latency.

```
function manageSparePool(config):
    if spareEnabled:
        emit telemetry("tengu_bg_spare_enable")
        if spareNeeded:
            spawn spare session
            emit telemetry("tengu_bg_spare_spawn")
    if claimingSpare:
        emit telemetry("tengu_bg_spare_claim")
        result = attemptClaim(spare)
        if result.failed:
            emit telemetry("tengu_bg_spare_claim_fail")
```

Analysis basis: CC v2.1.143 bundle.js:+14502634 (`tengu_bg_spare_enable`), +14502994 (`tengu_bg_spare_spawn`), +14504532 (`tengu_bg_spare_claim`), +14504795 (`tengu_bg_spare_claim_fail`)

---

### 11. Daemon Yield (Background Hand-off)

When a foreground/service daemon takes over, the background daemon yields control and background workers are marked for re-adoption.

```
function yieldToForeground():
    log("yielding to a foreground/service daemon — bg workers will be re-adopted")
    emit telemetry("tengu_daemon_yield")
    markWorkersForReadoption()
```

Analysis basis: CC v2.1.143 bundle.js:+14521121 (yield message), +14521203 (`tengu_daemon_yield`)

---

### 12. MCP OAuth Flow (triggered from daemon panel)

Remote MCP servers that require authentication surface an OAuth flow reachable via the daemon panel. The flow:

```
function startMcpOAuthFlow(serverConfig):
    emit telemetry("tengu_mcp_oauth_flow_start")
    authUrl = buildAuthorizationUrl(serverConfig)
    // Starts local HTTP server on 127.0.0.1 with /callback
    // Timeout: 300 000 ms (5 minutes)
    server.listen(availablePort)
    result = await Promise.race([
        waitForCallback(server),
        timeout(300000)
    ])
    if result.success:
        emit telemetry("tengu_mcp_oauth_flow_success")
    else:
        emit telemetry("tengu_mcp_oauth_flow_error")
```

OAuth callback server binds to `127.0.0.1`. Authentication timeout: **300 000 ms**.

Analysis basis: CC v2.1.143 bundle.js:+9633968 (`127.0.0.1`), +9634065 (`300000`), +9632809 (`/callback`), +9630015 (`tengu_mcp_oauth_flow_start`), +9634491 (`tengu_mcp_oauth_flow_success`), +9635875 (`tengu_mcp_oauth_flow_error`)

---

### 13. Config Reload

When the daemon detects that its configuration file's mtime has changed, it reloads without restart.

```
function watchConfigFile(path):
    fs.watchFile(path, (curr, prev) =>
        if curr.mtime != prev.mtime:
            log("mtime changed")
            reloadConfig()
            emit telemetry("tengu_daemon_config_reload")
    )
```

Analysis basis: CC v2.1.143 bundle.js:+14517117 (`tengu_daemon_config_reload`), +14521525 (`mtime changed`)

---

### 14. Low-Memory Guard

The daemon supervisor monitors free system memory and will refuse new dispatches under memory pressure.

```
function checkMemoryPressure():
    freeMb = os.freemem() / 1024 / 1024
    if freeMb < threshold:
        emit telemetry("tengu_bg_low_mem_mb", { mb: freeMb })
        emit telemetry("tengu_bg_dispatch_low_mem")
        return REJECT
    return ALLOW
```

macOS memory threshold constant: **1 024** (bundle.js:+11972274).

Analysis basis: CC v2.1.143 bundle.js:+11972252 (`tengu_bg_low_mem_mb`), +14503796 (`tengu_bg_dispatch_low_mem`), +11972274 (`1024`)

---

### 15. Attach Stall Detection and Recovery

When attaching to a background session that stalls at startup, the supervisor applies escalating recovery.

```
function handleAttachStall(session, stallMs):
    emit telemetry("tengu_bg_attach_stall_ms", { ms: stallMs })
    if stallMs > threshold:
        if retryCount < maxRetries:
            emit telemetry("tengu_bg_attach_stall_respawn")
            respawnSession(session)
        else:
            emit telemetry("tengu_bg_attach_stall_gave_up")
            reportError("Session keeps stalling at startup")
```

Analysis basis: CC v2.1.143 bundle.js:+14488388 (`tengu_bg_attach_stall_ms`), +14497122 (`tengu_bg_attach_stall_respawn`), +14496853 (`tengu_bg_attach_stall_gave_up`), +14496898 (stall message)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — daemon lifecycle | `tengu_daemon_config_reload`, `tengu_daemon_yield`, `tengu_daemon_idle_exit`, `tengu_daemon_control` |
| Telemetry — background dispatch | `tengu_bg_roster_parse_failed`, `tengu_bg_spare_enable`, `tengu_bg_spare_spawn`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_low_mem_mb`, `tengu_bg_sendclaim_failed`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop` |
| Telemetry — attach | `tengu_bg_attach`, `tengu_bg_attach_stall_ms`, `tengu_bg_attach_stall_respawn`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_kick`, `tengu_bg_attach_legacy_autorespawn` |
| Telemetry — MCP OAuth | `tengu_mcp_oauth_flow_start`, `tengu_mcp_oauth_flow_success`, `tengu_mcp_oauth_flow_error` |
| Telemetry — config | `tengu_config_auth_loss_prevented`, `tengu_config_parse_error` |
| Telemetry — forked agents | `tengu_forked_agent_default_turns_exceeded`, `tengu_fork_agent_query` |
| Telemetry — feature flags | `tengu_feature_ok`, `tengu_feature_bad` |
| Telemetry — voice | `tengu_voice_circuit_breaker_tripped`, `tengu_voice_recording_started`, `tengu_voice_stream_early_retry` |
| Telemetry — misc | `tengu_amber_anchor`, `tengu_bg_spare_enable` |
| File reads | `daemon.json`, `daemon.status.json`, `daemon.scheduled.status.json`, `roster.json` |
| File writes | Roster entries written atomically via `writeFile` + `rename`; stale status files removed via `unlinkSync` |
| File watching | `fs.watchFile` registered on config file path for mtime-based reload |
| Hook registration | `at_.register` called during log-rotation setup (bundle.js:+56977) |
| Socket | Unix domain socket created and unref'd; HTTP server for OAuth callback bound to `127.0.0.1` |
| appState changes | `H.setAppState` called during background session dispatch (bundle.js:+5426268); `H.getAppState` read at dispatch start |
| Process signals | `SIGTERM` sent first; escalates to `SIGKILL` if no exit within timeout; telemetry `tengu_bg_dispatch_sigkill_escalate` emitted on escalation |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.143 | Initial analysis — full daemon management panel covering assistant, scheduled, and remote-control subsystems; Unix socket supervisor protocol; spare-pool management; macOS launchctl integration |

---

## Common Mistakes

1. **Running `/daemon` on non-macOS expecting `uninstall`** — The `launchctl bootout` path is guarded to `darwin` only; on other platforms the uninstall action returns a "service uninstall not available on darwin" error string. Analysis basis: CC v2.1.143 bundle.js:+10557112
2. **Expecting instant status after a control action** — Status is polled via `setInterval`; there is no push notification from the supervisor back to the panel. A stop action may not be reflected until the next poll tick.
3. **Stale `.status.json` files left from a crashed daemon** — The roster reader attempts `unlinkSync` on entries whose PID is dead, but only during the `/daemon` status fetch cycle. Files are not cleaned up at daemon startup.
4. **OAuth callback URL pasted incorrectly on remote sessions** — On SSH-forwarded sessions the browser cannot reach `127.0.0.1:<port>/callback` and will show a page-load error. The user must copy the full URL from the address bar (including `?code=...&state=...`) and provide it via the `complete_authentication` tool. Analysis basis: CC v2.1.143 bundle.js:+9657339
5. **Restart timing race on slow daemons** — If the daemon does not exit within **10 seconds** of receiving `SIGTERM`, the restart sequence is aborted before `kickstart` is sent. The user must retry the restart manually. Analysis basis: CC v2.1.143 bundle.js:+10557665
6. **Assuming MCP OAuth flow persists across panel close** — The OAuth callback HTTP server is started in-process; if the Claude Code session exits before the flow completes the server is torn down and the token exchange fails.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Kb7` | Top-level daemon command renderer function |
| `Ag_` | Aggregate daemon status gatherer |
| `IwH` | Internal status initializer helper |
| `qvq` | Parallel status fetch coordinator |
| `KsH` | Scheduled-task status reader |
| `$F_` | JSON file reader with UTF-8 decode and parse |
| `xF_` | Array validation helper for status entries |
| `NH` | Log-queue writer / background error logger |
| `v_` | Error constructor wrapper |
| `xH` | String coercion utility |
| `zq` | Essential-traffic queue selector |
| `kNK` | Circular log-queue manager (shift/push) |
| `kW` | Daemon process kill and status reader |
| `LW6` | Daemon PID file reader |
| `Yx_` | Process command-line reader (splits on whitespace) |
| `j0` | Post-kill cleanup dispatcher |
| `oIq` | Assistant daemon status aggregator |
| `XJH` | Assistant daemon info builder (resolves ENOENT) |
| `d1` | Async-local-storage store accessor |
| `L8` | Path join / resolve utility |
| `eF_` | File-type resolver helper |
| `XH` | String coercion utility (secondary) |
| `K` | Formatted status column builder (padEnd) |
| `Wh` | Daemon base-path resolver |
| `PZq` | Assistant daemon stop handler |
| `r06` | `daemon.status.json` path builder |
| `dVq` | Scheduled daemon stop handler |
| `QVq` | `daemon.scheduled.status.json` path builder |
| `Qp` | Roster file reader and validator |
| `R6` | JSON.parse wrapper |
| `DLH` | Roster directory path builder |
| `zNH` | Roster base directory resolver |
| `$8` | Conditional async helper |
| `Zx_` | Roster read-timestamp recorder |
| `d` | General async utility |
| `e7q` | Roster atomic rename writer |
| `Hj7` | Roster schema validator (Array + Object.keys) |
| `tQ` | macOS launchctl service query orchestrator |
| `Y8` | Launchctl output parser |
| `$_` | Log writer with token budget |
| `S6` | Log sink selector |
| `Iw8` | UID-aware path builder |
| `d7q` | `process.getuid()` caller |
| `Hg_` | Assistant daemon directory stat checker |
| `__` | React-ink render wrapper |
| `GV` | Ink primitive renderer |
| `HR6` | Path existence checker |
| `x6` | Sync path utility |
| `v` | MCP server connection driver |
| `G5K` | Feature-flag evaluator |
| `tt_` | Feature-flag gate (TLK/ELK branches) |
| `H` | Random-delay scheduler (Math.random + setTimeout) |
| `hH` | JSON.stringify wrapper |
| `P7` | Log-line redaction helper |
| `h6A` | Log-line field mapper |
| `A` | toLowerCase normalizer |
| `cSH` | Stream write helper |
| `X6A` | Raw stream writer |
| `Z5K` | Rotating log-file writer orchestrator |
| `PSH` | Debounced write flusher (clearTimeout/setTimeout) |
| `i8H` | Log segment path builder |
| `gv8` | Log path resolver |
| `U6A` | Log file path builder |
| `p6A` | Log file rotate-and-unlink helper |
| `E5K` | Log append + rotate + size-check loop |
| `h9` | Cleanup hook registrar (`at_.register`) |
| `M` | MCP server registry / render root |
| `SvH` | MCP server registry updater |
| `KHH` | MCP config merge handler |
| `cqH` | Per-scope MCP config processor |
| `qHH` | SDK-type MCP entry builder |
| `ww6` | SSE/HTTP MCP server session manager |
| `rI` | MCP server route resolver |
| `X$` | MCP route entry builder |
| `RG_` | MCP route registry |
| `H_` | React ref holder |
| `f26` | Filter predicate factory |
| `_57` | Needs-auth cache loader |
| `bh_` | Needs-auth cache path builder |
| `v78` | MCP server hash + key builder |
| `Ei` | Server-id string coercion |
| `kj` | SHA-256 hash builder |
| `I78` | MCP debug info emitter |
| `dK` | MCP server debug payload builder |
| `A8` | MCP debug log pusher |
| `Yh_` | MCP server connection lifecycle manager |
| `w77` | MCP connection pre-flight checker |
| `PB` | OAuth token store accessor |
| `tHH` | MCP server session runner (HTTP server, OAuth, tool dispatch) |
| `mrH` | Inflight-connection tracker |
| `D` | Spare-session enable / dispose loop |
| `BY8` | Needs-auth cache writer |
| `UQ` | MCP reconnect handler |
| `Ku` | OAuth token reader |
| `Y` | Supervisor config update and start/stop router |
| `_7` | MCP error log pusher |
| `J77` | MCP connection result classifier |
| `D77` | SSH-aware URL transport selector |
| `Dh_` | MCP connection state tracker |
| `urH` | In-flight request registry reader |
| `prH` | Inflight-connection cache reader |
| `L` | Promise tracking set (add/finally/delete) |
| `x8q` | Needs-auth state accessor |
| `tY8` | Needs-auth cache file path builder |
| `Oh_` | MCP cleanup handler |
| `NG_` | MCP tool namespace builder |
| `a6` | Tool capability descriptor builder |
| `J` | Background worker kill dispatcher |
| `y` | Background worker write channel |
| `S8q` | Async-iterable mapper |
| `Yn` | Async-iterable core (TypedArray-safe) |
| `M26` | Port number parser (parseInt) |
| `xh_` | Secondary port parser |
| `THK` | MCP update applier |
| `eY8` | MCP server hash serializer |
| `wv` | MCP server cleanup coordinator |
| `drH` | MCP server teardown helper |
| `$` | Supervisor session store |
| `JZq` | Session store entry writer |
| `ha` | Session base-path resolver |
| `B95` | MCP multi-server batch updater |
| `k78` | Duplicate-server guard (mm4/pm4 sets) |
| `r8` | Unix socket retry loop |
| `O` | Socket error type classifier |
| `zvq` | Remote-control configuration loader |
| `PoH` | Remote-control config parser and model resolver |
| `EY7` | Model descriptor registry builder |
| `HA` | Billing plan resolver |
| `gB` | Max-plan descriptor builder |
| `cfH` | Team-plan descriptor builder |
| `hxH` | Enterprise-usage-based descriptor builder |
| `qw8` | Default model descriptor builder |
| `jP` | First-party model descriptor builder |
| `VHH` | Primary wAH-based model descriptor builder |
| `Wb_` | DAH+rV composite descriptor |
| `f` | Connection close pair (A.close + q.close) |
| `GLq` | BM+HA+Tb_ composite descriptor |
| `zKH` | Secondary wAH-based model descriptor |
| `WLq` | BM+HA+SE composite descriptor |
| `vLq` | Full model descriptor (BM+Qc+SE+YAH+zM+Tb_) |
| `ILq` | BM+Tb_+SE model descriptor |
| `BM` | DA-wrapper model descriptor base |
| `JLq` | Gb_+nG two-part descriptor |
| `PLq` | BM+Qc+SE+YAH+zM descriptor |
| `DLq` | Gb_+nG secondary descriptor |
| `wLq` | BM+zM+SE descriptor |
| `jLq` | BM+zM+SE secondary descriptor |
| `XLq` | Gb_ single-part descriptor |
| `VLq` | BM+SE descriptor |
| `jY7` | zM-only descriptor |
| `PY7` | BM+Qc+SE+YAH+zM descriptor (variant) |
| `DAH` | wAH+G1 model name builder |
| `zM` | Model metadata composer (KSH+N7L+pdA+UU6+DA) |
| `ELq` | BM+zM+YAH descriptor |
| `ZLq` | BM+zM+YAH secondary descriptor |
| `WY7` | yxH+zM+VLq+XY7 composite descriptor |
| `N6` | Config backup/restore with file watcher |
| `z9_` | Config directory resolver |
| `H$H` | Global config file reader and parser |
| `nhL` | Config file watcher registrar |
| `zLq` | Gateway model file loader |
| `MLq` | Gateway model list parser |
| `OLq` | Gateway model file path builder |
| `Na` | Custom/remote-control model descriptor builder |
| `TV` | Remote model title builder |
| `h8H` | Model human-readable label builder |
| `BB` | CLAUDE_MODEL env-var parser |
| `DwH` | Environment-model filter and parser |
| `TY7` | opusplan descriptor builder |
| `rV` | BM+zM composite |
| `VY7` | IX+ZY7 model variant selector |
| `IX` | Foundry model descriptor (DA+toLowerCase+G1) |
| `ZY7` | Extended model variant resolver |
| `aC7` | Daemon panel async data loader |
| `qg_` | Daemon panel React component |
| `V` | Polling interval handle |
| `N` | Away-summary generator |
| `KM8` | App state store accessor |
| `Te7` | Away-summary eligibility checker |
| `Ni_` | Rate-limit state reader |
| `jlq` | Draft-input presence checker |
| `W18` | Background turn executor |
| `oEH` | CacheSafeParams reader |
| `XZ` | Main turn dispatch loop |
| `Sw_` | Tool permission context builder |
| `G` | Conversation-state accessor (f26+iT8) |
| `pm` | Random-bytes nonce generator |
| `je` | KL+vvH message formatter |
| `iC` | Sub-agent exit handler |
| `nA8` | Tool-use dedup guard |
| `JzH` | Stream event router |
| `sA8` | Post-turn summary applier |
| `Dz4` | Agent fork query dispatcher |
| `w8` | UUID-tagged turn wrapper |
| `j` | Turn write channel |
| `kY1` | Tool-result flat-mapper |
| `mH` | General `d`-delegate helper |
| `K1q` | UUID generator wrapper |
| `g` | Conversation filter (F + $) |
| `F` | Conversation entry filter (c6.filter + P6.has) |
| `c6` | Key-event handler |
| `P6` | Orphaned-permission set |
| `SH` | `d`-delegate helper (secondary) |
| `w` | Background worker lifecycle manager |
| `C` | Worker process controller |
| `Z_K` | Worker binary realpath resolver |
| `MK5` | Worker spawn metadata builder |
| `p58` | Worker version-path builder |
| `z` | Worker I/O channel |
| `xN` | Worker stdin writer |
| `Ox` | Graceful shutdown orchestrator |
| `IG6` | macOS memory monitor |
| `G6` | Background session dispatcher |
| `m76` | Session job ID builder |
| `p76` | Session config serializer |
| `Ts` | Session I/O transformer |
| `Ci6` | Session dedup guard |
| `x` | Session retire-if-settled checker |
| `h` | Session internal handle |
| `m` | Session keepalive timer |
| `Oo_` | Supervisor claim sender |
| `Gd_` | Supervisor state persister |
| `zW6` | Supervisor state file path builder |
| `Ex_` | Supervisor auth-file path builder |
| `uq5` | Send-claim retry loop |
| `mq5` | Unix socket connect-and-close prober |
| `xq5` | Claim frame builder wrapper |
| `mp` | Binary frame encoder (UInt32BE + UInt8) |
| `jo_` | Background job lifecycle manager |
| `IK` | Job socket path builder |
| `b0` | Job socket base-path builder |
| `s1` | Job state file reader and validator |
| `rw` | Job active-state tracker |
| `lE` | Active-state backing store |
| `Bf` | Job snapshot writer |
| `eO` | Atomic file writer (randomBytes + writeFile + rename) |
| `o2` | Snapshot delete helper |
| `SoH` | Scheduled task dispatch wrapper |
| `_j7` | Scheduled task directory and file writer |
| `wLH` | PTY-PID file path builder |
| `DNH` | PTY-PID base path builder |
| `Bk` | PTY-PID file parser |
| `gp` | PTY socket path builder |
| `Wx_` | PTY socket base resolver |
| `koH` | PTY socket directory builder |
| `voH` | Service uninstall handler (macOS bootout) |
| `jx_` | LaunchAgents directory path builder |
| `OW6` | Service restart handler (stop + kickstart) |
| `Px_` | Restart state machine (SIGTERM + wait + kickstart) |
| `P` | Attacher frame processor |
| `Vf` | Attacher end-of-stream handler |
| `cq5` | Full attach/detach protocol handler |
| `lq5` | Attach lease tracker |
| `Bw` | Background-service label builder |
| `tMH` | G6-based service descriptor |
| `Do_` | Dispatch outcome handler |
| `s8K` | Dispatch timeout and retry loop |
| `C2` | Project socket path builder |
| `hV` | Project socket base-path builder |
| `YO` | Path normalizer (replace + slice + OkK) |
| `d$` | Real-path normalizer |
| `A5H` | History file reader (createInterface + createReadStream) |
| `Qq5` | Attach stall reporter |
| `p` | Write-with-timeout helper |
| `z6H` | Attach snapshot replayer |
| `dq5` | Session resume / phase checker |
| `AH` | Recording state tracker |
| `Q` | LW6+B7q multi-transport reader |
| `r` | w+l composite writer |
| `W` | Skill-set change batcher (clearTimeout/setTimeout) |
| `I3H` | Policy-settings change applier |
| `IBH` | Skill-set "some" checker |
| `LY8` | Skill config re-loader |
| `rHH` | Full skill reload pipeline |
| `JrH` | Voice-state clear helper |
| `l` | Oc_-based write channel |
| `Oc_` | Low-level stream write wrapper |
| `c` | o.filter-based input filter |
| `o` | Voice session orchestrator |
| `HZ6` | Stream destroy-and-write helper |
| `X` | iT8+Rk+vp+Promise.all+aKH+Dn+NH dispatcher |
| `iT8` | Conversation state accessor |