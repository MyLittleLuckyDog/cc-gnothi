---
type: feature-spec
feature: "background"
cc_version: "2.1.197"
updated: "2026-07-01"
tags: ["background", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.197 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/background`

> Analysis basis: CC v2.1.197 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.197

---

## Overview

The `/background` command (alias `/bg`) sends the current interactive REPL session to the background daemon and frees the terminal. It forks the ongoing conversation into a background job managed by the Claude Code daemon process, optionally accepts a follow-up prompt to be executed by the backgrounded agent, and returns the terminal to the user immediately once the handoff is acknowledged.

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
| module_id | `ncc` |
| load_inline | `true` |
| loc_byte | `13523370` |
| loc_byte_end | `13523610` |
| loc_line | `9421` |
| arbor_handler.name | `Nom` |
| arbor_handler.fqn | `claude-2.1.197::Nom` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.197 bundle.js:+13523370

---

## Input Branching

The command has more than three distinct outcome paths depending on session state, daemon availability, and argument presence:

```mermaid
flowchart TD
    A(["/background [prompt]"]) --> B{Session persistence enabled?}
    B -- No --> ERR1["Error: Cannot background — session persistence\nis disabled"]
    B -- Yes --> C{Any conversation messages sent?}
    C -- No --> ERR2["Error: Nothing to background yet —\nsend a message first"]
    C -- Yes --> D{Session already backgrounded?}
    D -- Yes --> TELEM1["Emit tengu_background_already_bg\nReturn early"]
    D -- No --> E{Permission mode / bypass flags need gate check?}
    E -- bypassPermissions without interactive acceptance --> ERR3["Error: Run 'claude --dangerously-skip-permissions' once interactively first"]
    E -- auto mode without interactive opt-in --> ERR4["Error: Run 'claude --permission-mode auto' once interactively first"]
    E -- OK --> F[Build background job args:\n--resume, --fork-session, --reply-on-resume,\n--allowed-tools, --disallowed-tools,\n--model, --effort, --permission-mode, --add-dir, etc.]
    F --> G[Flush pending output\n(timeout: 2000 ms)]
    G --> H[Dispatch job to daemon via zWo / bS socket]
    H --> I{Dispatch result}
    I -- "short_alive / stale_short" --> ERR5["Previous session still shutting down — try again"]
    I -- daemon unavailable --> ERR6["Daemon not running / unreachable\n(status variants: not running, timed out, socket missing, etc.)"]
    I -- Success (job queued) --> J[Render JSX backgrounded confirmation\nEmit tengu_background\nExit / free terminal]
    J --> K([Terminal released])
    I -- Spawn failed --> TELEM2["Emit tengu_background_spawn_failed\nShow retry prompt"]
```

Analysis basis: CC v2.1.197 bundle.js:+13522610 – +13523610, +13516638 – +13518700

---

## Behavioral Spec

### 1. Entry Guard — Handler `Nom`

The Arbor-resolved handler `Nom` (AsyncFunction, `claude-2.1.197::Nom`) is the top-level entry point.

```
async function backgroundCommandHandler(context):
    sessionPersistenceEnabled = checkSessionPersistenceFlag(context)
    if not sessionPersistenceEnabled:
        return renderError("Cannot background — session persistence is disabled, "
                           "so the forked job would have nothing to resume.")

    conversationMessages = getConversationMessages(context)
    if conversationMessages is empty:
        return renderError("Nothing to background yet — send a message first.")
```

Analysis basis: CC v2.1.197 bundle.js:+13522658 (guard for persistence), +13522866 (guard for empty conversation)

---

### 2. Already-Backgrounded Guard

```
async function backgroundCommandHandler(context) continued:
    alreadyBg = getSessionBackgroundedFlag(context)
    if alreadyBg:
        emitTelemetry("tengu_background_already_bg")
        return  // silent no-op
```

Analysis basis: CC v2.1.197 bundle.js:+13522622 (`tengu_background_already_bg` at +13522624)

---

### 3. Permission / Gate Checks

Before dispatching, the handler checks two separate safety gates:

```
function checkPermissionGates(context):
    if context.permissionMode == "bypassPermissions":
        if not bypassPermissionsDisclaimerAcceptedInteractively(context):
            raise "--bg with bypassPermissions requires accepting the disclaimer first. "
                  "Run `claude --dangerously-skip-permissions` once interactively."

    if context.permissionMode == "auto":
        if not autoModeOptedInInteractively(context):
            raise "--bg with auto mode requires opting in first. "
                  "Run `claude --permission-mode auto` once interactively."
```

Analysis basis: CC v2.1.197 bundle.js:+13515094 (bypass disclaimer), +13515256 (auto mode opt-in)

Additionally, `--bg` and `--cloud` are mutually exclusive backends and the command emits an error if both are detected:

> "–-bg and --cloud are different backends. Use `claude --cloud '<task>'` directly to start a cloud session."

Analysis basis: CC v2.1.197 bundle.js:+13457193

---

### 4. Argument Assembly for the Background Job

The handler calls function `jcr` (background-job argument builder), which constructs the CLI argument list for the forked background process. Key flags forwarded:

| Flag | Source constant (loc_byte) |
|---|---|
| `--resume` | +13516989 |
| `--fork-session` | +13517002 |
| `--reply-on-resume` | +13517044 |
| `--add-dir` | +13517096 |
| `--allowed-tools` | +13517131 |
| `--disallowed-tools` | +13517172 |
| `--model` | +13517203 |
| `--effort` | +13517232 |
| `--permission-mode` | +13517249 |
| `--` (separator) | +13517277 |

The optional `[prompt]` argument supplied by the user is appended after `--reply-on-resume`.

Analysis basis: CC v2.1.197 bundle.js:+13516638 – +13518087 (function `jcr`)

```
function buildBackgroundJobArgs(context, userPrompt):
    args = []
    args.push("--resume", currentSessionId)
    args.push("--fork-session")
    if userPrompt:
        args.push("--reply-on-resume", userPrompt)
    args.push("--add-dir", ...watchedDirectories)
    args.push("--allowed-tools", ...allowedTools)
    args.push("--disallowed-tools", ...disallowedTools)
    args.push("--model", currentModel)
    args.push("--effort", effortLevel)
    args.push("--permission-mode", permissionMode)
    return args
```

---

### 5. Output Flush (Pre-dispatch)

Before handing off to the daemon the handler races a `Promise` against a 2000 ms timeout to flush any pending output:

```
async function flushWithTimeout():
    result = await Promise.race([
        pendingOutputFlush(),
        timeout(2000, label="flush timeout")
    ])
    return result
```

Timeout constant: 2000 ms (bundle.js:+13516933)
Timeout label: `"flush timeout"` (bundle.js:+13516938)

---

### 6. Daemon Dispatch — `zWo` / `vom`

The job is dispatched to the background daemon via the socket-based dispatch chain (`zWo` → `bS`). The dispatch protocol:

```
async function dispatchBackgroundJob(args, sessionId):
    socketPath = buildSocketPath("cli-bg-dispatch")   // literal: "cli-bg-dispatch" (+13490060)
    randomBytes = generateRandomBytes(3)               // 3 bytes (+13490205)
    ackTimeout = 6000 ms                               // +13490318

    try:
        socket = connectUnixSocket(socketPath)
        writeDispatchFrame(socket, args)
        ackResult = await waitForAck(socket, timeout=ackTimeout)
        return ackResult
    catch ENOCONN:
        return { status: "enoconn" }
    catch ETIMEOUT:
        return { status: "ack-timeout" }
    catch ESTARTING:
        wait(200 ms)                                   // +13491100
        retry()
```

Key status strings returned by dispatch (used for error rendering):

| Status | Meaning | loc_byte |
|---|---|---|
| `"not running"` | Daemon not installed/running | +13502654 |
| `"timed out"` | Dispatch acknowledgement timed out | +13502692 |
| `"couldn't write dispatch file"` | Filesystem error | +13502731 |
| `"socket missing"` | Unix socket absent | +13502782 |
| `"service still starting"` | Daemon in cold-start | +13502821 |
| `"id collision with a prior job"` | UUID collision | +13502870 |
| `"short_alive"` / `"stale_short"` | Prior session still alive | +13499910, +13500050 |

---

### 7. Spare Session Pool (Pre-warming)

The daemon maintains a pool of spare pre-started sessions. When the background command runs, it attempts to claim a spare:

```
function claimSpareSession():
    emitTelemetry("tengu_bg_spare_claim")    // +18038273
    spare = sparePool.claim()
    if spare is null:
        emitTelemetry("tengu_bg_spare_claim_fail")  // +18038539
        return null
    emitTelemetry("tengu_bg_spare_enable")   // +18038145
    return spare
```

Analysis basis: CC v2.1.197 bundle.js:+18038145, +18038273, +18038539

---

### 8. Post-Dispatch Result Handling and Terminal Release

```
async function handleDispatchResult(result, context):
    if result.status in ["short_alive", "stale_short"]:
        renderError("Previous session is still shutting down — try again in a moment")
        return

    if result is dispatchFailure:
        emitTelemetry("tengu_background_spawn_failed")
        renderRetryPrompt("couldn't start in the background — press Enter to retry")
        // label: "repl_background_fork" (+13518286)
        return

    // Success path
    emitTelemetry("tengu_background")     // +13518434
    renderJSX(BackgroundedConfirmation)   // "(backgrounded)" label (+13519169)
    releaseTerminal()                     // process continues as daemon-worker
```

Analysis basis: CC v2.1.197 bundle.js:+13518286 (`repl_background_fork`), +13518360 (`spawn_failed`), +13518434 (`tengu_background`), +13519169

---

### 9. Session Name Rendering (Vcr)

After dispatch the handler calls `Vcr` to compose the display name shown in the terminal and daemon roster. It appends `"(backgrounded)"` suffix and formats the session metadata:

```
function buildBackgroundDisplayName(session):
    name = session.name ?? generateSessionName()
    return name + " (backgrounded)"   // literal: "(backgrounded)" at +13519169
```

The timeout for JSX rendering frame is 120 s (bundle.js:+13518939).

---

### 10. Low-Memory Guard (macOS)

On macOS, before spawning the background worker the daemon checks available free memory:

```
function checkMemoryPressure():
    freeMb = os.freemem() / (1024 * 1024)
    emitTelemetry("tengu_bg_low_mem_mb", { mb: freeMb })    // +13423445
    if freeMb < threshold:
        emitTelemetry("tengu_bg_dispatch_low_mem")           // +18037455
```

Platform constant `"macos"` at +13423537; macOS-specific FFI path `"bun:ffi"` at +13423653.

---

### 11. SIGKILL Escalation for Stale Sessions

When a background session fails to exit gracefully the daemon escalates to `SIGKILL`:

```
function escalateToSigkill(sessionPid):
    sendSignal(sessionPid, "SIGKILL")         // literal "SIGKILL" +18036913
    emitTelemetry("tengu_bg_dispatch_sigkill_escalate")  // +18036865
    // escalation thresholds: 30 s / 15 s (+18036820, +18036831)
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_background` (success path), `tengu_background_already_bg` (no-op guard), `tengu_background_spawn_failed` (dispatch failure), `tengu_bg_dispatch` (general dispatch), `tengu_bg_dispatch_fallback`, `tengu_bg_dispatch_rescued`, `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_low_mem_mb`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_sendclaim_failed`, `tengu_bg_handoff_settle`, `tengu_bg_state_read_transient`, `tengu_bg_roster_parse_failed`, `tengu_bg_daemon_cold_start_ask`, `tengu_bg_daemon_cold_start_ask_answer`, `tengu_bg_daemon_install`, `tengu_bg_daemon_service_stale_exec`, `tengu_bg_daemon_service_poll_fallthrough`, `tengu_bg_daemon_spawn_failed`, `tengu_bg_daemon_service_stale_exec`, `tengu_daemon_control`, `tengu_daemon_config_reload`, `tengu_daemon_idle_exit`, `tengu_amber_anchor` |
| Daemon socket | Connects to Unix socket path derived from `"cli-bg-dispatch"` label; writes a framed dispatch message using binary length-prefixed protocol |
| File system | Writes `state.json` (+18044442) and roster entry under the background session directory; reads/writes `daemon.status.json` (+13167883); creates `tmp` subdirectory (+13495109) |
| Process lifecycle | Calls `process.exit` on the foreground process after successful handoff; the background worker continues as `"daemon-worker"` (+2344177) under the daemon supervisor |
| appState changes | Sets session background flag; updates roster entry via `t.rosterEntry`; updates `state.json` with status `"bg"` (+18044770) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | Registers `yis.register` (+68542) signal handler via `vi` |
| Timer | 5-minute idle cleanup timer for background sessions: 300000 ms (+18046078) |
| Reconnect timeout | Send-claim timeout: 5000 ms (+18030418) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.197 | Initial analysis |

---

## Common Mistakes

1. **Running `/background` before sending any message.** The guard at +13522866 produces `"Nothing to background yet — send a message first."` — the command is a no-op until at least one conversation turn has occurred.
2. **Confusing `/background` with `--cloud`.** The two are incompatible backends. Attempting to background a cloud session produces an explicit error (`"--bg and --cloud are different backends"`).
3. **Using `bypassPermissions` without prior interactive acceptance.** Even if the CLI flag is set, the backgrounded job cannot start without the once-interactive disclaimer run.
4. **Using `auto` permission mode without prior interactive opt-in.** Same gate as `bypassPermissions` — must be done interactively first.
5. **Session persistence disabled.** When session persistence is turned off (e.g., `--no-resume`), `/background` will always fail with the persistence error.
6. **Retrying immediately after a `"short_alive"` result.** The previous session is still winding down; the command instructs the user to wait a moment before retrying.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Nom` | Top-level background command async handler (Arbor-resolved) |
| `jcr` | Background job argument builder; assembles all CLI flags for the forked process |
| `ZZ` | Background job dispatch orchestrator (spawns temp dir, calls `vom`) |
| `vom` | Core background session launch function; calls daemon socket dispatch, builds roster entry |
| `zWo` | Daemon dispatch function; connects to Unix socket, writes framed message, awaits ack |
| `bS` | Unix socket connection and framing helper |
| `Lns` | Background session lifecycle manager (roster, state.json, file cleanup) |
| `Tns` | Spare session claim handler; connects to daemon to claim a pre-warmed slot |
| `Vcr` | Background display-name and confirmation JSX renderer |
| `Hbt` | Session rename / name-generation helper called during fork |
| `vx` | Main agent query runner invoked in the background worker |
| `NYn` | App-state reader/writer for the background worker |
| `h` | Per-session background worker object (supervisor side) |
| `d` | Supervisor write function handling config reload and heartbeat |
| `vs` | Low-level process exit wrapper (calls `process.exit` after emitting `"cli_error"`) |
| `wc` | Flush-with-timeout helper; races pending output against 2000 ms deadline |
| `ojo` | Signal registration wrapper |
| `Kc` | Signal/hook registration core |
| `vi` | `yis.register` wrapper for signal handlers |
| `bv` | Secondary hook registration path |
| `TYe` | File-write helper used for roster and state files |
| `Cic` | Supervisor config computation helper |
| `E` | SDK session stop helper |
| `A` | Authentication / user-info stop helper |
| `eKc` | Heartbeat registrar |
| `I` | Input handler start (keyboard capture) |
| `Y` | MCP retire-if-settled helper |
| `Shr` | MCP connection result applier |
| `Yi` | File-pin state reader/writer |
| `Jd` | File-write atomic helper |
| `RAt` | Roster-file read/parse/write helper |
| `P4` | Individual roster entry read/write |
| `q2f` | Roster entry creator |
| `N6e` | Pin-file cleanup helper |
| `ke` | Telemetry/log emitter |
| `rg` | Atomic file write with random nonce |
| `Ij` | Daemon ensure-running function |
| `Pom` | Background job argument parser/validator |
| `dz` | Argument flag presence checker |
| `BTt` | Argument flag set builder |
| `Bcr` | Flag segment slicer |
| `NUe` | Flag token normalizer |
| `Ylc` | Resume-flag argument handler |
| `Oom` | Continue-flag argument handler |
| `Gcr` | Session-id flag handler |
| `Xlc` | Agent-flag handler |
| `hN` | Settings loader |
| `fn` | Settings merge function |
| `Frm` | macOS free-memory checker via Bun FFI |
| `CYe` | Low-memory dispatch guard |
| `Nrm` | Memory/platform telemetry emitter |
| `Dt` | Config file watcher |
| `lIt` | Config file reader (sync) |
| `Fdm` | File-watch registration |
| `bRt` | File-watcher bootstrap |
| `$F` | Daemon stop telemetry emitter |
| `z7r` | Daemon stop event emitter |
| `Wj` | Graceful shutdown orchestrator |
| `sye` | MCP shutdown helper |
| `mye` | Timeout-clearing shutdown step |
| `On` | Timeout/abort-signal helper |
| `s` | Session map / active-session registry |
| `r` | Active-request set |
| `u` | Process abort/stop controller |
| `xe` | Feature-ok telemetry emitter |
| `Re` | Feature-bad telemetry emitter |
| `wt` | Feature-sad telemetry emitter |
| `Oe` | Telemetry event dispatcher |
| `V` | Core telemetry emit function |
| `Blc` | Dispatch result status classifier |
| `Aor` | Daemon socket lease/connection helper |
| `A7e` | Dispatch socket path builder |
| `_me` | Dispatch file reader |
| `bXt` | Dispatch file path builder |
| `_Te` | PTY-pids path builder |
| `BNe` | PTY base path builder |
| `sM` | PTY late-error logger |
| `f3l` | PTY log path builder |
| `yk` | PTY pid-path builder |
| `kAt` | PTY directory path builder |
| `nP` | PTY late-pid logger |
| `xZ` | PTY error-path builder |
| `mc` | Jobs-directory path builder |
| `CR` | Jobs base-path resolver |
| `zh` | Session status updater |
| `K0` | Status file writer |
| `doc` | Daemon status file reader |
| `ene` | ZHe status emitter |
| `Ks` | Async-storage getter |
| `_Zt` | Daemon status file path builder |
| `Lom` | Dispatch rescued logger |
| `qce` | Amber-anchor telemetry emitter |
| `lye` | Amber-anchor context builder |
| `f0e` | Config watcher bootstrap |
| `rge` | File-watcher re-registration helper |
| `g` | Agent forwarding helper |
| `H` | Background worker kill-all helper |
| `ld` | Logging helper (`rn` wrapper) |
| `rn` | Low-level log emitter |
| `he` | String-to-log helper |
| `Me` | JSON serializer for logging |
| `ct` | String converter |
| `er` | Error serializer |
| `br` | JSX renderer helper |
| `Ig` | `$Xe` renderer variant A |
| `qe` | `$Xe` renderer variant B |
| `Vee` | Path normalizer with `gis`/`TAr` |
| `TAr` | UNC/Windows path prefix normalizer |
| `gis` | Path include-check helper |
| `aI` | Path display formatter |
| `XV` | Tool path argument builder |
| `uct` | Tool permission checker |
| `yOn` | Tool path prefix checker |
| `Oue` | Path cleanup helper |
| `Pc` | Path segment extractor |
| `$lc` | Environment map builder |
| `Com` | Shell command builder for background spawn |
| `cmn` | Git Bash detection helper |
| `Jlc` | Session-id argument builder |
| `Qlc` | Repl-mode argument builder |
| `FM` | Left-arrow key handler (used in retry UI) |
| `PH` | Compact boundary helper |
| `Bnr` | Compact boundary block finder |
| `Pue` | Post-dispatch file cleanup |
| `dE` | Pin-state delete helper |
| `Jf` | File-write permission checker |
| `dr` | Context-store accessor |
| `nmn` | Async-local-store getter |
| `Ot` | Context getter with fallback |
| `Hi` | Daemon-worker boot helper |
| `BLe` | Worker initialization |
| `dTe` | Detach-request emitter |
| `pTn` | Background task type tagger |
| `gBa` | Task/context tagger |
| `S5n` | Context store setter |
| `yn` | Context string builder |
| `YW` | Stream writer for daemon |
| `ime` | Worker environment initializer |
| `v4` | Environment/production flag checker |
| `tuc` | Test-mode detector |
| `y5` | Production-mode detector |
| `z3e` | tmux environment checker |
| `UL` | tmux session variable reader |
| `uf` | Async-local store reader |
| `P0` | Z9r store getter |
| `UHd` | tmux child-session checker |
| `$Hd` | tmux spawnSync helper |