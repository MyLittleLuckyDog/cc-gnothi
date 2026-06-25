---
type: feature-spec
feature: "update"
cc_version: "2.1.191"
updated: "2026-06-25"
tags: ["update", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.191 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/update`

> Analysis basis: CC v2.1.191 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.191

---

## Overview

The `/update` command performs an in-place upgrade of the running Claude Code CLI to the latest available version without ending the current conversation. It locates the installed binary via the user's local share path, flushes all pending I/O and telemetry, serializes the current session state, then uses `execve`/`spawnSync` to replace the current process with the new binary, passing `--resume` so the conversation continues seamlessly.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `update` |
| description | `Switch to the latest version (conversation continues)` |
| loc_byte | `12802381` |
| loc_byte_end | `12802622` |
| loc_line | `8627` |
| supportsNonInteractive | `false` |
| isHidden | `true` |
| module_id | `o5l` |
| load_inline | `true` |
| arbor_handler.name | `rkf` |
| arbor_handler.fqn | `claude-2.1.191::rkf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.191 bundle.js:+12802381

---

## Input Branching

The handler contains 4+ distinct decision paths (background-work guard, directory-mismatch guard, version-path resolution, and the relaunch sequence), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/update invoked"] --> B{Background tasks\nin 'running' or 'pending' state?}
    B -- Yes --> C["Emit tengu_update_refused\nReturn error:\n'Cannot /update while work is running…'"]
    B -- No --> D{Session working directory\nmatches current project directory?}
    D -- No --> E["Return error:\n'Cannot /update — this session was\nresumed from a different project directory…'"]
    D -- Yes --> F[Resolve latest-version binary path\nvia ~/.local/share/…/versions/]
    F --> G{Binary path found\nand stat succeeds?}
    G -- No --> H["Log warning; abort relaunch"]
    G -- Yes --> I[Write SDK messages:\n'Switching to latest Claude Code… reconnecting']
    I --> J[Generate new session UUID\nSerialize app state via t.setAppState]
    J --> K[Flush message bridge\n(timeout: 2000 ms / 'bridge flush')]
    K --> L[Teardown current bridge\nFlush analytics (timeout: 30000 ms)]
    L --> M[Remove SIGINT/SIGHUP listeners\nRegister beforeExit / exit hooks]
    M --> N[spawnSync new binary with\n--resume + forwarded CLI args]
    N --> O{spawnSync success?}
    O -- No --> P["Write 'relaunch_spawn_error' to log\nprocess.exit with code 128"]
    O -- Yes --> Q[process.kill self\nwith signal to hand off control]
```

Analysis basis: CC v2.1.191 bundle.js:+12800263 through +12801699

---

## Behavioral Spec

### Pre-flight Guard: Background Work Check

```
function checkNoBackgroundWork(appState):
    for each task in Object.values(appState):
        if task.status == "running" or task.status == "pending":
            emitTelemetry("tengu_update_refused")
            return Error("Cannot /update while work is running in the background — wait for it to finish, then try again.")
    return OK
```

The exact error string is: `"Cannot /update while work is running in the background — wait for it to finish, then try again."` (bundle.js:+12800641). Statuses checked are the string literals `"running"` (bundle.js:+12800538) and `"pending"` (bundle.js:+12800560).

Analysis basis: CC v2.1.191 bundle.js:+12800500

### Pre-flight Guard: Directory Mismatch Check

```
function checkDirectoryMatch(sessionState, currentCwd):
    lastWorkingDir = sessionState.findLast(entry => entry.type == "working_directory")
    if lastWorkingDir != null and lastWorkingDir != currentCwd:
        return Error("Cannot /update — this session was resumed from a different project directory. Restart manually with --resume to continue on the latest version.")
    return OK
```

The exact error string is: `"Cannot /update — this session was resumed from a different project directory. Restart manually with --resume to continue on the latest version."` (bundle.js:+12800885). The session state is inspected via `e.getAppState` and `n.findLast` using the key `"working_directory"` (bundle.js:+10899808).

Analysis basis: CC v2.1.191 bundle.js:+12801699

### Version Binary Resolution

```
function resolveVersionedBinaryPath():
    homeDir = os.homedir()                     // via Pba.homedir
    versionsRoot = path.join(homeDir, ".local", "share", "versions")
    binaryPath = path.join(versionsRoot, ..., "bin", "claude")
    return binaryPath
```

Path segments used: `".local"` (bundle.js:+7151322), `"share"` (bundle.js:+7151331), `"versions"` (bundle.js:+8643302), `"bin"` (bundle.js:+7151402), `"claude"` (bundle.js:+12800180).

The path is checked with `N$l.stat` before proceeding (bundle.js:+12540599). If the stat fails, the relaunch is aborted.

Analysis basis: CC v2.1.191 bundle.js:+12800230

### Session Serialization and Message Emission

```
function serializeAndNotify(sessionContext, bridge):
    // Append "last-prompt" entry to conversation log
    appendLogEntry(type="last-prompt")

    // Write user-visible status message to SDK message stream
    bridge.writeSdkMessages([{
        role: "assistant",
        type: "text",
        content: "Switching to latest Claude Code… reconnecting"
    }])

    // Generate a fresh session UUID for the resumed process
    newSessionId = crypto.randomUUID()

    // Serialize flags and session settings into app state
    t.setAppState({
        effort, model, max_thinking_tokens,
        flag_settings, permission_mode, ...
    })
```

The user-visible reconnect message is `"Switching to latest Claude Code… reconnecting"` (bundle.js:+12801370). The log entry key is `"last-prompt"` (bundle.js:+13351064). New session UUID is generated via `VKt.randomUUID` (bundle.js:+12799245).

Analysis basis: CC v2.1.191 bundle.js:+12801105 through +12801366

### Bridge Flush and Teardown

```
async function flushAndTeardown(bridge):
    // Wait up to 2000 ms for the message bridge to flush
    await Promise.race([
        bridge.flush(),
        timeout(2000)   // "bridge flush" label
    ])

    // Tear down the bridge transport
    await bridge.teardown()

    // Flush analytics with a 30000 ms guard
    await Promise.race([
        analyticsFlush(),
        timeout(30000)  // "flush timeout (relaunch)" label
    ])
```

Timeout values: bridge flush 2000 ms (bundle.js:+12801450), relaunch flush timeout 30000 ms (bundle.js:+12540718). Label strings `"bridge flush"` (bundle.js:+12801455) and `"flush timeout (relaunch)"` (bundle.js:+12540724) appear in diagnostic output.

Analysis basis: CC v2.1.191 bundle.js:+12801437 through +12801491

### Process Relaunch via spawnSync / execve

```
function relaunchProcess(newBinaryPath, originalArgs, sessionId):
    // Remove inherited signal handlers
    process.removeAllListeners("SIGINT")
    process.removeAllListeners("SIGHUP")

    // Register exit bookkeeping hooks
    process.on("beforeExit", exitHook)
    process.on("exit", exitHook)

    // Build argument vector: forward relevant CLI args + --resume
    relaunchArgs = buildArgVector(originalArgs, sessionId)
    // Includes: --resume, --add-dir, --effort, --permission-mode,
    //           --allow-dangerously-skip-permissions (if set)

    result = child_process.spawnSync(newBinaryPath, relaunchArgs, {
        stdio: "inherit"
    })

    if result indicates error:
        writeErrorLog("relaunch_spawn_error")
        process.exit(128)
    else:
        process.kill(process.pid, signal)
```

Signal constants referenced: `"SIGINT"` (bundle.js:+12541191), `"SIGHUP"` (bundle.js:+12541210), `"SIGTERM"` (bundle.js:+17347059), `"SIGKILL"` (bundle.js:+17370589). stdio mode is `"inherit"` (bundle.js:+12541312). Exit code on spawn failure is `128` (bundle.js:+12541639). CLI arguments reconstructed include `"--resume"` (bundle.js:+12540651), `"--add-dir"` (bundle.js:+12542175), `"--effort"` (bundle.js:+12542432), `"--permission-mode"` (bundle.js:+12542449), `"--allow-dangerously-skip-permissions"` (bundle.js:+12542290).

Analysis basis: CC v2.1.191 bundle.js:+12541220 through +12541639

### Argument Vector Construction

```
function buildArgVector(originalArgs, sessionId):
    result = []

    // Propagate session identifier
    if originalArgs has cliArg["session"]:
        result.push("--session", sessionId)

    // Propagate additional directories
    for dir in originalArgs["--add-dir"]:
        result.push("--add-dir", dir)

    // Propagate permission bypass if active
    if originalArgs["--allow-dangerously-skip-permissions"]:
        result.push("--allow-dangerously-skip-permissions")

    // Propagate effort and permission-mode
    if effort set: result.push("--effort", effortValue)
    if permissionMode set: result.push("--permission-mode", permissionModeValue)

    // Always append --resume
    result.push("--resume")

    return result
```

Argument key strings: `"cliArg"` (bundle.js:+12542075), `"session"` (bundle.js:+12542096).

Analysis basis: CC v2.1.191 bundle.js:+12542000 through +12542449

### Post-Relaunch MCP and Daemon State Reconciliation

After the new process boots with `--resume`, it invokes MCP reconnection logic (via `hGo` → `s5e` → `Gar`) to re-establish all MCP server connections and apply any pending MCP updates. Daemon background sessions (`Fjo`, `Mjo`) are reconciled against the new process identity. The session working-directory and allowed/disallowed tool settings are re-read from app state using keys `"allowed_tools"` (bundle.js:+10899863), `"disallowed_tools"` (bundle.js:+10899918), `"avoid_prompts"` (bundle.js:+10899979), `"bypassPermissions"` (bundle.js:+10900112).

Analysis basis: CC v2.1.191 bundle.js:+12801656 through +12801716

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_update_refused` — fired when background tasks block the update (bundle.js:+12800277) |
| Telemetry | `tengu_lone_surrogate_sanitized` — fired inside API response handling (bundle.js:+8938694) |
| Telemetry | `tengu_api_success` — fired on successful API call during the update flow (bundle.js:+8938998) |
| Telemetry | `tengu_context_tip_classifier_outcome` — fired from context-tip subsystem reached during relaunch (bundle.js:+16672225) |
| Telemetry | `tengu_feature_bad` / `tengu_feature_ok` — feature-flag evaluation events (bundle.js:+1025792, +1025725) |
| Telemetry | `tengu_scroll_summary` — scroll/context summary event (bundle.js:+7344996) |
| Telemetry | `tengu_amber_creek` / `tengu_pewter_brook` — display mode detection events (bundle.js:+3537252, +3537159) |
| Telemetry | `tengu_bg_dispatch_sigkill_escalate` — daemon escalation event (bundle.js:+17370541) |
| Telemetry | `tengu_bg_low_mem_mb` / `tengu_bg_dispatch_low_mem` — memory pressure events (bundle.js:+13163474, +17371142) |
| Telemetry | `tengu_daemon_idle_exit` — daemon idle exit (bundle.js:+17392101) |
| Telemetry | `tengu_bg_spare_enable` / `tengu_bg_spare_claim` / `tengu_bg_spare_claim_fail` — spare session lifecycle (bundle.js:+17371839, +17371967, +17372233) |
| Telemetry | `tengu_bg_sendclaim_failed` — claim send failure (bundle.js:+17346821) |
| Telemetry | `tengu_daemon_control` — daemon control event (bundle.js:+17408260) |
| Telemetry | `tengu_config_parse_error` — config parse error (bundle.js:+13869283) |
| Telemetry | `tengu_disable_bypass_permissions_mode` — bypass-permission mode change (bundle.js:+3399953) |
| appState changes | `t.setAppState` is called to persist `effort`, `model`, `max_thinking_tokens`, `flag_settings`, `permission_mode`, `bypassPermissions` before relaunch (bundle.js:+12801260) |
| appState reads | `t.getAppState` is called to retrieve current state for guard checks and serialization (bundle.js:+12801145) |
| Message stream | `l.writeSdkMessages` emits the reconnect notification `"Switching to latest Claude Code… reconnecting"` to the conversation (bundle.js:+12801346) |
| Log entry | Appends `"last-prompt"` entry via `KKt` → `n.appendEntry` (bundle.js:+13351044) |
| Process signals | Removes all `SIGINT` and `SIGHUP` listeners; re-registers `beforeExit` and `exit` hooks before `spawnSync` (bundle.js:+12541220) |
| Process exit | On spawn failure: `process.exit(128)` (bundle.js:+12541526); on success: `process.kill` (bundle.js:+12541591) |
| Filesystem | Reads stat on versioned binary path before relaunch (bundle.js:+12540599); writes spawn-error log via `fT` → `$oe.writeFileSync` (bundle.js:+200554) |
| Hook registration | `_i` → `xqo.register` registers exit hook (bundle.js:+67562); `Nze` → `xqo.drain` drains hooks post-flush (bundle.js:+67605) |
| Daemon status file | `"daemon.status.json"` is written/read during relaunch coordination (bundle.js:+12894435) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.191 | Initial analysis |

---

## Common Mistakes

1. **Running `/update` during active background tasks** — the command refuses with an explicit error if any task is in `"running"` or `"pending"` state. Wait for background work to complete before invoking `/update`.
2. **Attempting `/update` after `--resume` from a different project directory** — if the session's recorded working directory does not match the current working directory, the command exits with an error advising a manual `--resume` restart. This cannot be overridden via `/update` alone.
3. **Expecting the command to be visible in the slash-command menu** — `/update` is registered with `isHidden: true` and does not appear in autocomplete listings. It must be typed explicitly.
4. **Using `/update` in non-interactive mode** — `supportsNonInteractive: false` means the command is only valid in interactive REPL sessions; scripted or piped invocations are not supported.
5. **Assuming the conversation is lost on update** — the command serializes full session state (effort, model, permission mode, tool settings, conversation history via `--resume`) before exec'ing the new binary; the conversation continues in the new process.
6. **Relaunching without the latest binary installed** — if the versioned binary path under `~/.local/share/.../versions/` does not exist or fails a `stat` check, the relaunch is aborted silently (no new version to switch to).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `rkf` | Main handler (AsyncFunction) for `/update`; resolved via module_id `o5l` |
| `$Zn` | Background-work status checker; calls `Cf` (binary locator) and `m$` (version path builder) |
| `Cf` | Binary presence check; calls `Bns` which calls `Bun.which` |
| `Bns` | Wrapper around `Bun.which` for executable lookup |
| `m$` | Version path builder; delegates to `X4n` and assembles join paths |
| `X4n` | Path segment assembler for versioned binary directory |
| `xm` | Array-check utility (wraps `Array.isArray`) |
| `$te` | Home directory path helper; calls `X1n` (homedir) and `lBt.join` |
| `X1n` | Wrapper around `Pba.homedir` |
| `cce` | Alternate home-directory path helper for bin subpath |
| `Ks` | Update-refused telemetry emitter; calls `HCe` |
| `HCe` | Telemetry dispatch helper |
| `W` | General utility / logging helper |
| `lS` | Binary basename resolver; calls `Ay.basename` and `wt` |
| `wt` | UI / output renderer; calls `ux` |
| `ux` | Low-level output primitive |
| `GR` | App state accessor helper |
| `kPo` | Relaunch orchestrator: dirname resolution, signal handling, `dc` |
| `Hr` | Signal-handling helper; calls `ux` |
| `dc` | Process signal dispatch helper; calls `ux` |
| `tpe` | Timeout/promise race helper |
| `Ure` | Hook-set membership check; uses `ktr` and `OFf.has` |
| `ktr` | Hook type resolver |
| `KKt` | Log-entry appender; calls `Fc`, `n.appendEntry`, `wt` |
| `Fc` | Log entry factory; calls `_i` |
| `_i` | Hook registrar; calls `xqo.register` |
| `Le` | Error logging utility; calls `fo`, `rt`, `Yi`, `Rmu`, `sXe.push`, `GQ.logError` |
| `fo` | Error constructor/stringifier |
| `rt` | String conversion helper |
| `Yi` | Telemetry mode classifier; calls `ncs` |
| `ncs` | Network-mode string resolver; calls `rt` |
| `Rmu` | Rolling error buffer manager; calls `Oin.shift`, `Oin.push` |
| `pf` | AsyncLocalStorage accessor; calls `Lx` |
| `Lx` | Store getter via `KPr.getStore` |
| `vE` | App state value extractor |
| `l` | Bridge/transport object (writeSdkMessages, flush, teardown) |
| `rGl` | SDK message writer; calls `HZ`, `Date.now`, `qs`, `ozt`, `ke` |
| `HZ` | Message formatter; calls `rge` |
| `rge` | Message text normalizer; calls `yse`, `t.trim` |
| `qs` | Store accessor via `EWu.getStore` |
| `ozt` | Daemon status file path builder; calls `nGl.join`, `Zn` |
| `ke` | JSON serializer wrapper; calls `JSON.stringify` |
| `n5l` | Session UUID generator; calls `VKt.randomUUID` |
| `$c` | Promise-race timeout helper; calls `setTimeout`, `Promise.race`, `clearTimeout` |
| `Hve` | Feature-flag check; calls `Smi.isEnabled` |
| `nLe` | String coercion helper for binary name |
| `kPe` | Full relaunch executor: stat check, flush, spawnSync, exit/kill |
| `QBt` | Interval cleaner; calls `Fao` |
| `Fao` | `clearInterval` wrapper |
| `O5e` | Terminal unmount helper; calls `Z_e.writeSync`, `Su.get`, `e.unmount` |
| `e` | Ink/React terminal renderer instance |
| `L6o` | Terminal output layout builder |
| `wN` | API call executor (main agent loop) |
| `S4` | Render state manager; calls `ev`, `PPr` |
| `usm` | UI state machine; calls `csm` |
| `hsm` | History/output assembler; calls `t.push`, `t.join` |
| `M6n` | Message finder; calls `e.find` |
| `T` | Text content formatter |
| `cSt` | Context-tip output renderer; calls `W`, `Pe` |
| `Re` | React/Ink render helper; calls `W`, `Pe` |
| `D6n` | Schema safe-parser; calls `t.safeParse` |
| `we` | Render helper variant; calls `W`, `Pe` |
| `Ae` | String cast helper; calls `String` |
| `IF` | Ink fullscreen toggle |
| `Pvn` | Terminal notification writer; calls `vee.writeSync`, `$Be`, `DBe`, `Jw`, `up`, `T` |
| `$Be` | Terminal capability detector (Ghostty, iTerm2); calls `Yh`, `uMi.coerce`, `fR` |
| `DBe` | Notification display helper |
| `Jw` | tmux/screen escape sequence handler; calls `CGr`, `e.replaceAll` |
| `up` | Generic utility/pipe helper |
| `fUn` | Scroll/context summarizer; calls `Aw`, `KCa`, `W`, `qCa`, `ks` |
| `Aw` | Context window assessment helper |
| `KCa` | Cache key builder for scroll summary |
| `qCa` | Progress calculator for scroll summary |
| `WCa` | Summary data assembler |
| `ks` | Main agent dispatch loop; calls `U2`, `Bk`, `kGr`, `cee`, `T`, `RGr`, `Rr`, `CSd`, `nt` |
| `U2` | Feature-guard checker; calls `Udu.has` |
| `Bk` | Feature-enabled check; calls `Smi.isEnabled` |
| `kGr` | Request builder; calls `rt` |
| `cee` | Idle state detector; calls `ISd` |
| `RGr` | Boolean flag evaluator; calls `Wt`, `Boolean` |
| `Rr` | Response router; calls `vj` |
| `CSd` | Structured output dispatcher; calls `nt` |
| `nt` | Tool-call handler; calls `IDt`, `CDt`, `B4`, `xve.has`, `RTn`, `bDt.add`, `gW.has`, `gW.get`, `kt` |
| `vC` | Session cleanup caller; calls `Fc` |
| `Nze` | Hook-drain caller; calls `xqo.drain` |
| `U5e` | Promise resolver for relaunch sequencing; calls `Promise.resolve`, `cUn`, `e` |
| `cUn` | Relaunch continuation helper |
| `D$l` | Native binary loader (FFI/execve): loads platform lib, calls `a.execve` |
| `f` | Background session worker loop |
| `D` | Background session process object |
| `jn` | Abort-controller / promise race helper |
| `Yer` | Low-memory monitor; calls `Wt`, `nt` |
| `I3e` | Temp file cleaner; calls `wb.lstat`, `wb.rm`, `wb.readFile` |
| `F` | Idle-exit timer manager; calls `d.write`, `W`, `M.unref` |
| `Mjo` | Socket connection manager; calls `eq.claim`, `glr.connect`, `VR` |
| `Fjo` | Background session lifecycle manager; calls `Jm.rm`, `Le`, `Bi`, `bh`, `dn`, `eLe`, `Od`, `bHt`, `PM`, `aqt`, `oSe`, `zR`, `zN` |
| `p` | Forced-shutdown handler; calls `oT`, `process.exit`, `u.abort` |
| `dn` | Directory utilities helper |
| `Pe` | React/Ink createElement wrapper; calls `eze` |
| `U` | Disposable resource container |
| `c` | Background session context object; calls `An` |
| `An` | Session announcement helper |
| `a` | MCP + execve orchestrator; calls `s5e`, `Gar`, `w_a`, `hGo` |
| `s5e` | MCP server connector; manages stdio/sse/http/ws-ide/sse-ide transports |
| `Gar` | MCP connection result applier; calls `e.applyMcpUpdate`, `o5e`, `ln`, `n.cleanup`, `tI`, `hE` |
| `w_a` | MCP retry policy; calls `Fro` |
| `hGo` | MCP client set updater; calls `s5e`, `Gar`, `Object.fromEntries` |
| `u` | Post-exec cleanup handler; calls `we`, `Re`, `pF`, `BG` |
| `pF` | First-party flag setter; calls `$4`, `$z.push`, `eBe`, `v5r` |
| `BG` | Race-all shutdown helper; calls `Promise.race`, `Promise.all`, `ohe`, `fhe`, `jn`, `process.exit` |
| `fT` | Spawn-error log writer; calls `$oe.writeFileSync`, `jfr.join` |
| `aZn` | CLI argument vector builder; calls `Array.from`, `D1e`, `Fve`, `r.includes`, `n.flatMap` |
| `D1e` | Original argv reader |
| `Fve` | Argument inclusion filter; calls `kt`, `Boolean` |
| `kt` | Config file reader/version locator; calls `Gt`, `Tk`, `C2o`, `tEt`, `K9f`, `Date.now` |
| `Gt` | Version tag resolver |
| `C2o` | Config path helper |
| `tEt` | Config file parser and backup manager; calls `r.readFileSync`, `r.mkdirSync`, `r.copyFileSync` |
| `K9f` | File watcher for config changes; calls `Tk`, `$vt`, `Gt`, `Ca`, `_i`, `_Xl.unwatchFile` |
| `Ur` | Session state reader for resumed sessions; calls `e.getAppState`, `n.findLast`, `zKn`, `YKn`, `AB` |
| `zKn` | Working-directory extractor from session state; calls `ns` |
| `ns` | State field accessor |
| `YKn` | Tool-list extractor from session state; calls `ns` |
| `AB` | Permission-mode resolver; calls `nt`, `jo` |
| `Km` | App state key enumerator; calls `e.getAppState` |