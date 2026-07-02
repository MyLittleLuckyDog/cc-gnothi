---
type: feature-spec
feature: "update"
cc_version: "2.1.198"
updated: "2026-07-02"
tags: ["update", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.198 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/update`

> Analysis basis: CC v2.1.198 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.198

---

## Overview

The `/update` command performs an in-place upgrade of the Claude Code CLI to the latest available version without ending the current conversation. It tears down the active session's I/O bridge, relaunches the binary via `execve` with `--resume`, and hands off the conversation state so that the dialogue continues seamlessly in the new version.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `update` |
| description | `Switch to the latest version (conversation continues)` |
| supportsNonInteractive | `false` |
| isHidden | `true` |
| module_id | `zic` |
| load_inline | `true` |
| loc_byte | `13276012` |
| loc_byte_end | `13276253` |
| loc_line | `9086` |
| arbor_handler.name | `Fom` |
| arbor_handler.fqn | `claude-2.1.198::Fom` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.198 bundle.js:+13276012

---

## Input Branching

The handler (`Fom`) evaluates four or more distinct conditions before committing to the relaunch. A Mermaid flowchart is used because there are more than three distinct decision branches.

```mermaid
flowchart TD
    A(["/update invoked"]) --> B{Background work\nrunning or pending?}
    B -- Yes --> C["Emit tengu_update_refused\nReturn error:\n'Cannot /update while work is running…'"]
    B -- No --> D{Session resumed\nfrom different\nproject directory?}
    D -- Yes --> E["Return error:\n'Cannot /update — this session was resumed\nfrom a different project directory…'"]
    D -- No --> F{Is binary locatable\nvia Bun.which('claude')?}
    F -- No --> G["Log warning / abort relaunch path"]
    F -- Yes --> H["Resolve install path\n(~/.local/share/versions/…)"]
    H --> I["Flush SDK messages\n(writeSdkMessages)"]
    I --> J["Display: 'Switching to latest Claude Code… reconnecting'"]
    J --> K["Wait up to 2000ms for bridge flush\n(timeout label: 'bridge flush')"]
    K --> L["Teardown l.flush / l.teardown"]
    L --> M["Check feature flags\n(_0e / VRi.isEnabled)"]
    M --> N["Prepare relaunch argv\n(rur: build --resume + original flags)"]
    N --> O["Execute ehe:\nclear listeners, spawnSync/execve\nwith --resume"]
    O --> P{execve succeeded?}
    P -- No --> Q["Write relaunch_spawn_error,\nprocess.exit with code 128+signal"]
    P -- Yes --> R(["New binary takes over;\nconversation continues"])
```

Analysis basis: CC v2.1.198 bundle.js:+13273808, +13274056, +13274272, +13274516, +13275001, +13275081, +13275068, +13275122

---

## Behavioral Spec

### 1. Pre-flight: Binary Discovery

```
function locateBinary():
    path = Bun.which("claude")          // PSs via Zf
    if path is null:
        return NOT_FOUND
    return path
```

Analysis basis: CC v2.1.198 bundle.js:+13273808, +877723

The literal string `"claude"` is the binary name searched by `Bun.which`. Analysis basis: CC v2.1.198 bundle.js:+13273811

### 2. Pre-flight: Install Path Resolution

```
function resolveInstallPath():
    home = os.homedir()                 // c0a.homedir via h9n
    versionsDir = path.join(home, ".local", "share", "versions")  // JXn + boe/Yde
    binDir = path.join(home, ".local", "share", "bin")
    return { versionsDir, binDir }
```

Relevant path fragments: `".local"` (bundle.js:+6817967), `"share"` (bundle.js:+6817976), `"versions"` (bundle.js:+9408758), `"bin"` (bundle.js:+6818047).

Analysis basis: CC v2.1.198 bundle.js:+9408714, +6817694, +6817956

### 3. Guard: Background Work Check

```
function checkBackgroundWork(appState):
    tasks = Object.values(appState.tasks)    // Fom → Object.values
    for task in tasks:
        if task.status == "running" or task.status == "pending":
            emit telemetry("tengu_update_refused")
            return Error("Cannot /update while work is running in the background — wait for it to finish, then try again.")
    return OK
```

Status strings `"running"` (bundle.js:+13274169) and `"pending"` (bundle.js:+13274191). Error message verbatim-cited fragment: `"Cannot /update while work is running…"` (bundle.js:+13274272).

Analysis basis: CC v2.1.198 bundle.js:+13274131, +13273908

### 4. Guard: Resumed-Session Directory Check

```
function checkResumedSessionDir(context):
    if sessionOriginDir != currentProjectDir:
        return Error("Cannot /update — this session was resumed from a different project directory. Restart manually with --resume to continue on the latest version.")
    return OK
```

Error message fragment: `"Cannot /update — this session was resumed…"` (bundle.js:+13274516). The `--resume` flag literal: bundle.js:+12979815.

Analysis basis: CC v2.1.198 bundle.js:+13274382, +13274398

### 5. Session State Snapshot

```
function snapshotSessionState(context):
    currentState = context.getAppState()       // t.getAppState
    mergedState = Object.assign({}, currentState, newFields)  // Fom → Object.assign
    context.setAppState(mergedState)           // t.setAppState
    uuid = generateUUID()                      // qic → rtn.randomUUID
    return { uuid, mergedState }
```

A fresh UUID is generated per relaunch attempt. Analysis basis: CC v2.1.198 bundle.js:+13274776, +13274891, +13274997

### 6. SDK Message Flush and User Notification

```
async function flushAndNotify(bridge):
    bridge.writeSdkMessages([{
        type: "text",
        content: "Switching to latest Claude Code… reconnecting"
    }])
    // Display message; literal at bundle.js:+13275001
    await timeout(bridge.flush(), 2000, "bridge flush")
    // 2000ms limit: bundle.js:+13275081; label "bridge flush": bundle.js:+13275086
    bridge.teardown()
```

Analysis basis: CC v2.1.198 bundle.js:+13274977, +13275071, +13275122

### 7. Relaunch Argument Construction

```
function buildRelaunchArgv(originalArgv, sessionContext):
    args = Array.from(originalArgv)            // rur → Array.from
    args.push("--resume")                      // literal: bundle.js:+12979815
    // Forward selected CLI flags:
    //   --add-dir (bundle.js:+12981603)
    //   --allow-dangerously-skip-permissions (bundle.js:+12981718)
    //   --effort (bundle.js:+12981860)
    //   --permission-mode (bundle.js:+12981877)
    // Include session working_directory, allowed_tools, disallowed_tools,
    // permission_mode, effort, model, max_thinking_tokens, flag_settings
    // from context (literals: bundle.js:+11313975 … +11314654)
    return args
```

Analysis basis: CC v2.1.198 bundle.js:+13275287, +13275326, +12981428

### 8. Relaunch Execution (ehe)

```
async function performRelaunch(binaryPath, argv, env):
    // 1. Drain telemetry, analytics, debug flush — all with 30000ms timeout
    //    (bundle.js:+12979882) label "flush timeout (relaunch)"
    await Promise.all([
        timeout(analyticsFlush(), 30000, "flush timeout (relaunch)"),
        timeout(cleanup(),        30000, "cleanup timeout"),
        timeout(analyticsDrain(), 30000, "analytics flush timeout"),
    ])

    // 2. Strip signal handlers
    process.removeAllListeners("SIGINT")    // bundle.js:+12980367
    process.removeAllListeners("SIGTERM")   // bundle.js:+12980376
    process.removeAllListeners("SIGHUP")    // bundle.js:+12980386

    // 3. Re-register a minimal beforeExit handler (bundle.js:+12980554)

    // 4. Tear down terminal UI (Fje: unmount, writeSync, etc.)

    // 5. Exec new binary — stdio: "inherit" (bundle.js:+12980500)
    result = xtc.spawnSync(binaryPath, argv, { stdio: "inherit", env })

    // 6. On exec failure:
    if result.error:
        writeFileSync(errorLogPath, "relaunch_spawn_error")  // bundle.js:+12980690
        process.exit(128 + signal)                           // bundle.js:+12980827

    // 7. On clean exec, the OS replaces the process; no return.
    process.kill(process.pid, signal)   // bundle.js:+12980779
```

Timeout constants: `30000` ms (bundle.js:+12979882), `2000` ms (bundle.js:+13275081).

On macOS, FFI-loads `/usr/lib/libSystem.B.dylib`; on Linux, `libc.so.6` (bundle.js:+12978963, +12978992) to call `execve` directly (bundle.js:+12979318).

Analysis basis: CC v2.1.198 bundle.js:+12979861, +12980396, +12980465, +12980714, +12980779

### 9. Post-Relaunch: Conversation Resumption Envelope

```
function buildResumeContext(previousState):
    // Ur: read working_directory, allowed_tools, disallowed_tools,
    //     avoid_prompts, bypassPermissions, permission_mode, effort,
    //     model, max_thinking_tokens, flag_settings from previous appState
    // Qm: read additional flags
    // dR/kQr: validate bypassPermissions policy (org policy check)
    //   may emit: "Bypass permissions mode was disabled by your organization policy"
    //             (bundle.js:+3461925)
    return resumeEnvelope
```

Analysis basis: CC v2.1.198 bundle.js:+13275330, +13275336, +11313870

### 10. Daemon Status Sync (stn)

The handler appends a `"last-prompt"` entry (literal: bundle.js:+13718568) to session history and calls the session daemon's `appendEntry` method before the relaunch. A progress-type message (literal `"progress"`: bundle.js:+13699247) may be written.

Analysis basis: CC v2.1.198 bundle.js:+13274736, +13718454, +13718548

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: tengu_update_refused | Fired when background tasks are `running` or `pending` (bundle.js:+13273908) |
| Telemetry: tengu_scroll_summary | Fired during terminal-UI scroll state capture in `t4n` (bundle.js:+6895258) |
| Telemetry: tengu_amber_creek | Fired inside fullscreen/terminal-mode helper `Ws`/`Z8d` (bundle.js:+3610207) |
| Telemetry: tengu_pewter_brook | Fired inside fullscreen/terminal-mode helper `Ws`/`nt` (bundle.js:+3610114) |
| Telemetry: tengu_feature_ok | Fired in feature-flag check path `xe`/`V` (bundle.js:+1039573) |
| Telemetry: tengu_feature_bad | Fired in feature-flag check path `Le`/`V` (bundle.js:+1039640) |
| Telemetry: tengu_daemon_control | Fired in daemon stop/start control path `u`/`M$` (bundle.js:+18414881) |
| Telemetry: tengu_config_parse_error | Fired when auto-update config cannot be parsed in `SCt` (bundle.js:+14259169) |
| Telemetry: tengu_disable_bypass_permissions_mode | Fired when bypass-permissions is revoked by policy/settings in `kQr` (bundle.js:+3461875) |
| appState changes | `getAppState` read, then `setAppState` called with merged update fields including resume UUID (bundle.js:+13274776, +13274891) |
| SDK message written | `writeSdkMessages` emits `"Switching to latest Claude Code… reconnecting"` before teardown (bundle.js:+13274977, +13275001) |
| Bridge flush | `l.flush()` called with 2000 ms timeout; `l.teardown()` follows (bundle.js:+13275071, +13275122) |
| Session history | `stn` / `n.appendEntry` writes `"last-prompt"` entry to session log (bundle.js:+13718548, +13718568) |
| Signal handlers | All SIGINT, SIGTERM, SIGHUP listeners removed; new minimal beforeExit listener installed (bundle.js:+12980367, +12980386, +12980426, +12980554) |
| Terminal UI teardown | Ink component unmounted (`e.unmount`), raw terminal writes performed via `nAe.writeSync` / `vre.writeSync` (bundle.js:+6892736, +3957866) |
| Error log file | On spawn failure: `Bae.writeFileSync` writes `"relaunch_spawn_error"` to a path under `kCr.join(…)` (bundle.js:+12980690, +203266) |
| Process exit | On failure: `process.exit(128 + signal)` (bundle.js:+12980827); on kill: `process.kill(pid, signal)` (bundle.js:+12980779) |
| FFI dlopen | `libc` loaded via `i.dlopen` for direct `execve` syscall on macOS and Linux (bundle.js:+12978942) |
| Feature flags | `_0e` / `VRi.isEnabled` queried before relaunch to adjust behaviour (bundle.js:+13275228, +3155258) |
| Daemon status file | `ftn` writes `"daemon.status.json"` (bundle.js:+13346372) to track session state across the exec boundary |

---

## Version History

| Version | Change |
|---|---|
| v2.1.198 | Initial analysis — `/update` registered as hidden local command; handler `Fom` performs guarded in-place exec-based relaunch with `--resume` |

---

## Common Mistakes

1. **Invoking `/update` while background tasks are active.** The command explicitly refuses if any task has status `"running"` or `"pending"`. Wait for all background work to complete before running `/update`.

2. **Invoking `/update` in a `--resume` session that originated from a different project directory.** The session-directory guard will block the relaunch and instruct you to restart manually with `--resume`.

3. **Expecting the command to work non-interactively.** `supportsNonInteractive: false` means `/update` is explicitly not supported in piped or headless invocations.

4. **Assuming the command is visible in help output.** `isHidden: true` means it will not appear in the slash-command list; it must be typed explicitly.

5. **Interrupting the 2-second bridge-flush window.** The command performs a timed flush (`2000 ms`, label `"bridge flush"`) before teardown. Killing the process in this window may leave the session in an inconsistent state.

6. **Expecting the command to work if `claude` is not on PATH.** The `Bun.which("claude")` probe must succeed; if the binary is not discoverable under that name, the relaunch will abort.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Fom` | Main async handler for `/update` (arbor_handler; AsyncFunction at module `zic`) |
| `ndr` | Binary discovery entry — resolves `claude` binary via `Bun.which` |
| `Zf` | `Bun.which` wrapper — checks if binary name exists on PATH |
| `PSs` | Internal caller that invokes `Bun.which` |
| `rB` | Install-path resolver — builds versioned install directories |
| `JXn` | Path-join helper for versioned install directory (uses `hKe.join`) |
| `Nf` | Path normalisation utility used by install-path resolver |
| `boe` | Home-directory sub-path builder (`.local/share/…`) |
| `h9n` | Home-directory accessor (`c0a.homedir`) |
| `Yde` | Bin-directory sub-path builder (`.local/share/bin`) |
| `li` | Process-role classifier (checks `"bg"`, `"daemon"`, `"daemon-worker"`) |
| `gxe` | Role-string lookup utility used by process classifier |
| `V` | General-purpose value/variant helper (used in multiple sub-paths) |
| `mS` | Binary basename utility (`wy.basename`); determines numeric chunk size `8` |
| `zY` | Utility called inside binary-naming helper |
| `kt` | Core formatting/string conversion utility (calls `sw`) |
| `sw` | Low-level string or buffer primitive |
| `HL` | Path or string helper referenced during relaunch setup |
| `UWo` | Pre-exec cleanup helper (`HL`, `ar`, `Mtc.dirname`, `tH`, `tl`) |
| `ar` | Sub-utility called by `UWo` (calls `sw`) |
| `tl` | Sub-utility called by `UWo` (calls `sw`) |
| `lhe` | Helper called just before `Rie` check |
| `Rie` | Hook / attachment filter — checks `ypr` and `Apm.has` |
| `ypr` | Hook predicate utility used by attachment filter |
| `stn` | Session-log appender — writes `"last-prompt"` via `n.appendEntry`; calls `eu` |
| `eu` | Daemon process-event registrar (`Si`, `process.on`, exit handler) |
| `Si` | Signal-handler registration (`sus.register`) |
| `n` | Session log object (`i.toLowerCase`, entry management) |
| `i` | Session stream object (`n.close`, `r.close`, `s`) |
| `r` | Underlying resource/stream (`As`, `r.add`, `r.delete`) |
| `s` | Async cleanup wrapper (`r.add`, `i.finally`, `r.delete`) |
| `Re` | Telemetry/analytics flush coordinator (`sr`, `st`, `qi`, `jvu`, `Itt`, `Dte`) |
| `sr` | Error normaliser (`Error`, `String`) |
| `st` | String coercion helper (`String`) |
| `qi` | Telemetry queue processor (`wSs`) |
| `wSs` | Telemetry serialiser (calls `st`) |
| `jvu` | Telemetry ring-buffer rotator (`Bmn.shift`, `Bmn.push`) |
| `_f` | Context/store accessor (`C0`) |
| `C0` | Async-local-storage store reader (`$6r.getStore`) |
| `bE` | App-state field merger helper |
| `l` | Bridge/I/O object: `writeSdkMessages`, `flush`, `teardown` |
| `Flc` | SDK message writer core (`Ene`, `Date.now`, `Ys`, `ftn`, `Me`) |
| `Ene` | Message envelope builder (`C_e`) |
| `C_e` | Content normaliser (`_le`, `t.trim`) |
| `Ys` | Session store accessor (`yEd.getStore`) |
| `ftn` | Daemon status file writer (`Ulc.join`, `er`, `"daemon.status.json"`) |
| `Me` | JSON serialiser (`JSON.stringify`) |
| `qic` | UUID generator (`rtn.randomUUID`) |
| `ul` | Timed promise helper (`setTimeout`, `Promise.race`, `clearTimeout`) |
| `_0e` | Feature-flag reader (`VRi.isEnabled`) |
| `iRe` | String coercion helper for feature path (`String`) |
| `ehe` | Main relaunch execution block: teardown, spawnSync/execve, signal handling, process.exit |
| `MGt` | Interval cleaner (`Lgo`) |
| `Lgo` | `clearInterval` wrapper |
| `Fje` | Terminal UI unmount helper (`nAe.writeSync`, `mu.get`, `e.unmount`, `YN`, `cOn`) |
| `YN` | Post-unmount utility |
| `cOn` | Raw terminal write helper (`vre.writeSync`, `M6e`, `v6e`, `ax`, `Zd`, `T`) |
| `M6e` | Terminal-capability handler (`HH`, `q8i.coerce`, `lR`; Ghostty ≥1.2.0, iTerm ≥3.6.6) |
| `v6e` | Terminal write variant utility |
| `ax` | tmux/screen escape handler (`GZr`, `e.replaceAll`; `"\x1b\x1b"`) |
| `Zd` | Additional terminal state helper |
| `T` | Terminal output formatter (`U2e`, `Hiu`, `Oc`, `X1`, `YZe`, `biu`, `o.write`, `o.flush`) |
| `t4n` | Scroll-summary utility (`OL`, `HRa`, `V`, `gRa`, `Ws`; telemetry `tengu_scroll_summary`) |
| `OL` | Scroll-state reader |
| `HRa` | Scroll-state helper |
| `gRa` | Scroll measurement (`Date.now`, `Math.max`, `Math.round`, `Object.assign`, `mRa`) |
| `mRa` | Scroll animation helper |
| `Ws` | Fullscreen/terminal-mode manager (`NP`, `rD`, `zZr`, `dre`, `KZr`, `Lr`, `Z8d`, `nt`) |
| `NP` | Local-agent feature check (`u2u.has`) |
| `rD` | Feature-flag reader (`VRi.isEnabled`) |
| `zZr` | String formatter helper (`st`) |
| `dre` | Terminal-detection helper (`Q8d`) |
| `KZr` | Platform / SSH-mode checker (`jt`, `Boolean`; `"windows"`) |
| `Lr` | Fullscreen state reader (`X8`) |
| `Z8d` | Fullscreen-state setter (`nt`) |
| `nt` | React/Ink render-tree node (`n2t`, `r2t`, `tG`, `k0e`, `aMn`, `e2t`, `BV`, `Dt`) |
| `FT` | Pre-exit flush trigger (`eu`) |
| `TZe` | Telemetry drain (`sus.drain`) |
| `Bje` | Deferred-exit helper (`Promise.resolve`, `J9n`, `e`) |
| `J9n` | Exit-path utility |
| `Ltc` | Debug/diag flush bundle (`Promise.all`, `ul`, `Xge`, `XMt`, `Xln`) |
| `Xge` | Debug-log flush utility |
| `XMt` | Diagnostic flush utility |
| `Xln` | Pre-exit drain (`ius.drain`) |
| `vtc` | Native-exec wrapper: `dlopen` → `execve` via Bun FFI; handles macOS `/usr/lib/libSystem.B.dylib` and Linux `libc.so.6` |
| `f` | Module-path normaliser (`j8`) |
| `j8` | Path normalise + replaceAll helper (`iN.normalize`, `jt`) |
| `c` | Env-map builder (`un`) |
| `un` | Environment variable constructor |
| `a` | HTTP/response utility (`tge`, `Response.json`) |
| `tge` | JSON-response builder (`JSON.stringify`) |
| `u` | Daemon lifecycle controller (`xe`, `Le`, `M$`, `l8`; telemetry `tengu_daemon_control`) |
| `xe` | Daemon-feature OK path (`V`, `Pe`; telemetry `tengu_feature_ok`) |
| `Le` | Daemon-feature bad path (`V`, `Pe`; telemetry `tengu_feature_bad`) |
| `M$` | Daemon stop handler (`eG`, `bX.push`, `V5e`, `UJr`; `"firstParty"`, `"daemon_stop"`) |
| `l8` | Daemon stop-wait loop (`Promise.race`, `Promise.all`, `kye`, `$ye`, `Mn`, `process.exit`) |
| `he` | String coercion helper (`String`) for exec path |
| `fI` | Spawn-error logger (`Bae.writeFileSync`, `kCr.join`; `"relaunch_spawn_error"`) |
| `rur` | Relaunch argv builder (`Array.from`, `a2e`, `r.push`, `W0e`; flags `--resume`, `--add-dir`, etc.) |
| `a2e` | Argv-source mapper |
| `W0e` | Argv-entry validator (`Dt`, `Boolean`) |
| `Dt` | Update-manifest reader (`zt`, `H0`, `A7o`, `SCt`, `qHm`, `Date.now`) |
| `zt` | Manifest path helper |
| `A7o` | Manifest field accessor |
| `SCt` | Config/manifest file reader (`r.readFileSync`, `r.mkdirSync`, `r.copyFileSync`; `"utf-8"`, `"ENOENT"`) |
| `qHm` | Update-watcher teardown (`H0`, `QMt`, `zt`, `$a`, `c6`, `A7o`, `yhe`, `Si`, `i_c.unwatchFile`) |
| `Ur` | Resume-context builder — extracts `working_directory`, `allowed_tools`, `disallowed_tools`, `avoid_prompts`, `bypassPermissions`, `permission_mode` from appState |
| `Mrr` | allowed_tools context helper (`Co`) |
| `Co` | Tool-list normaliser |
| `Drr` | disallowed_tools context helper (`Co`) |
| `dR` | bypassPermissions policy validator (`kQr`) |
| `kQr` | Permission-mode enforcer (`nt`, `Qo`; telemetry `tengu_disable_bypass_permissions_mode`) |
| `Qm` | Additional flag-settings extractor (`e.getAppState`) |