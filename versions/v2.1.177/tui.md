---
type: feature-spec
feature: "tui"
cc_version: "2.1.177"
updated: "2026-06-13"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.177 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.177 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.177

---

## Overview

The `/tui` command lets users switch the terminal UI renderer between `default` and `fullscreen` modes for sessions started directly with `claude`. It validates the requested mode against the current session state (including running background work), applies the new renderer setting, and performs a full process relaunch so the new mode takes effect. Background sessions always use the fullscreen renderer unconditionally and are unaffected by this setting.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| module_id | `SzK` |
| load_inline | `true` |
| loc_byte | `12736143` |
| loc_byte_end | `12736325` |
| loc_line | `8930` |
| arbor_handler.name | `asL` |
| arbor_handler.fqn | `claude-2.1.177::asL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.177 bundle.js:+12736143

---

## Input Branching

The handler has 4+ distinct branches: no argument (query/display current state), explicit `default`, explicit `fullscreen`, and an invalid argument path. Additionally, a guard branch fires when background work is active. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/tui [arg]"] --> B{Background work\nrunning?\n running / pending /\n remote_agent / mcp_task}
    B -- Yes --> BLOCK["Emit tengu_tui_refused\nReturn error:\n'Cannot switch renderers\nwhile work is running…'"]
    B -- No --> C{arg supplied?}
    C -- No --> DISPLAY["Compute & display\ncurrent TUI mode\n(via getFullscreenDecision)\nShow informational note\nabout bg sessions"]
    C -- Yes --> D{arg.trim()}
    D -- "'fullscreen'" --> VALIDATE_FS["Validate fullscreen\neligibility\n(getFullscreenDecision)"]
    D -- "'default'" --> SET_DEFAULT["Write tuiMode='default'\nto user settings"]
    D -- other --> ERR["Return error:\nUnknown mode — show\nvalid options list"]
    VALIDATE_FS --> E{Fullscreen\nallowed?}
    E -- No --> WARN["Show disable reason\n(e.g. tmux -CC, Windows\nSSH, env flag)"]
    E -- Yes --> SET_FS["Write tuiMode='fullscreen'\nto user settings"]
    SET_DEFAULT --> RELAUNCH
    SET_FS --> RELAUNCH["Emit tengu_tui_command\nFlush analytics\nTrigger relaunch via\nrelaunchProcess(--resume)"]
    WARN --> RELAUNCH
    RELAUNCH --> EXIT["Process exits;\nnew process starts\nwith updated renderer"]
```

---

## Behavioral Spec

### Main Handler — `handlerAsL`

```
async function handlerAsL(args, context):
    trimmedArg = args.trim()
    currentSettings = loadSettings()           // via I1 → settings subsystem
    fullscreenDecision = getFullscreenDecision()  // via hXH

    // Guard: refuse if background work is in progress
    activeWork = getActiveBackgroundWork(context)   // via b_, u$
    // activeWork checks states: "running", "pending", "remote_agent", "mcp_task"
    if activeWork is non-empty:
        emit telemetry("tengu_tui_refused")
        return errorMessage(
            "Cannot switch renderers while work is running in the background " +
            "— wait for it to finish (or stop it via /tasks), then run /tui again."
        )

    if trimmedArg == "":
        // Display-only: show current mode and note about bg sessions
        note = "Background sessions always use the fullscreen renderer …"
        return renderCurrentTuiState(fullscreenDecision, note)

    validModes = ["default", "fullscreen"]   // via rYA.includes check
    if trimmedArg not in validModes:
        return errorMessage("Unknown mode. Valid values: " + validModes.join(", "))

    if trimmedArg == "fullscreen":
        reason = fullscreenDecision.disableReason
        if reason is set:
            // show informational warning; still proceeds to relaunch
            showWarning(reason)

    // Write new mode to persistent settings
    writeSettingValue("tuiMode", trimmedArg)   // via $A → settings writer

    // Emit telemetry before relaunch
    emit telemetry("tengu_tui_command", {
        mode: trimmedArg,
        session: "same_session" | "later_session"   // derived from context
    })

    // Flush analytics with timeout, then relaunch
    await flushAnalytics(timeout=30000)   // via QZ / P4 / m9
    relaunchProcess(args=["--resume", ...inheritedArgs])  // via TU6 → yZH
```

Analysis basis: CC v2.1.177 bundle.js:+12733906

---

### Fullscreen Decision Engine — `getFullscreenDecision`

```
function getFullscreenDecision():
    // Checks are evaluated in priority order; first match wins

    // 1. Background-forced-on override
    if backgroundSessionForcedOn():
        return { mode: "fullscreen", tag: "bg_forced_on" }

    // 2. Environment variable: CLAUDE_CODE_NO_FLICKER or
    //    CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN → disable
    if envDisablesFullscreen():
        return { mode: "default", tag: "env_off" }

    // 3. Environment variable explicitly forces on
    if envForcesFullscreen():
        return { mode: "fullscreen", tag: "env_on" }

    // 4. tmux -CC (iTerm2 control-mode) detected → auto-disable
    if detectTmuxCCMode():
        return {
            mode: "default",
            tag: "tmux_cc_auto_off",
            disableReason: "fullscreen disabled: tmux -CC (iTerm2 integration mode) detected · set CLAUDE_CODE_NO_FLICKER=1 to override"
        }

    // 5. Windows over SSH (ConPTY) detected → auto-disable
    if detectWindowsSSH():
        return {
            mode: "default",
            tag: "win_ssh_auto_off",
            disableReason: "fullscreen disabled: Windows over SSH (ConPTY re-rendering) detected · set CLAUDE_CODE_NO_FLICKER=1 to override"
        }

    // 6. Explicit settings value
    settingValue = readSetting("tuiMode")
    if settingValue == "fullscreen":
        return { mode: "fullscreen", tag: "settings_on" }
    if settingValue == "default":
        return { mode: "default", tag: "settings_off" }

    // 7. Feature-flag / gradual-rollout check
    if featureFlagOn("fullscreen_downsell"):
        return { mode: "fullscreen", tag: "downsell_on" }
    gbResult = gradualRollout("fullscreen")
    return { mode: gbResult ? "fullscreen" : "default", tag: gbResult ? "gb_on" : "gb_off" }
```

Analysis basis: CC v2.1.177 bundle.js:+3528315 (literals: `"fullscreen"`, `"default"`), +3528726–+3529103 (tags), +3527981 (tmux-CC message), +3528167 (Windows SSH message)

---

### Relaunch Sequence — `relaunchProcess`

```
async function relaunchProcess(extraArgs):
    // 1. Resolve canonical binary path
    binaryPath = resolveVersionedBinaryPath()   // via LC → SR8 / s9H
    // Looks in ~/.local/share/claude/versions/bin

    // 2. Teardown current UI
    stopIntervalTimers()          // via By6 → si_ → clearInterval
    unmountInkRenderer()          // via XxH → H.unmount
    restoreTerminalCursor()       // via XxH → a3H.writeSync (ESC-8 restore)
    writeScrollSummaryEvent()     // emits tengu_scroll_summary (ZT8)

    // 3. Flush pending I/O with timeout
    await Promise.race([
        flushAllStreams(),         // via qQH → XyA.drain
        timeout(2000, "cleanup timeout")
    ])
    await Promise.race([
        flushAnalytics(),         // via QZ / P4
        timeout(30000, "flush timeout (relaunch)")
    ])

    // 4. Remove current process signal handlers, install passthrough
    process.removeAllListeners()
    process.on("SIGINT", passthrough)
    process.on("SIGHUP", passthrough)

    // 5. Build argv for new process
    // Inherits cliArg and session flags; appends --resume
    // Reconstructs --add-dir, --allow-dangerously-skip-permissions,
    // --effort, --permission-mode from current state (via kg8)
    newArgv = buildRelaunchArgv(extraArgs)   // via kg8

    // 6. execve — replaces process image (no fork)
    execve(binaryPath, newArgv, env=inherited)   // via VzK → M.execve
    // If execve fails, writes error file (kX) and exits non-zero
```

Analysis basis: CC v2.1.177 bundle.js:+12729093 (`yZH`), +12729239 (`--resume` literal), +12729285 (`Promise.all`), +12729865 (`NzK.spawnSync`), +12729808 (`removeAllListeners`)

---

### Active Background Work Guard — `getActiveBackgroundWork`

```
function getActiveBackgroundWork(context):
    // Retrieves app state and searches conversation history
    appState = getAppState()      // via b_ → H.getAppState, u$ → H.getAppState
    lastEntry = appState.messages.findLast(isWorkEntry)

    // Checks entry status against the set:
    //   { "running", "pending", "remote_agent", "mcp_task" }
    if lastEntry and lastEntry.status in ACTIVE_STATES:
        return lastEntry
    return null
```

Analysis basis: CC v2.1.177 bundle.js:+12734612 (`"running"`), +12734634 (`"pending"`), +12734655 (`"remote_agent"`), +12734680 (`"mcp_task"`), +12734742 (error message literal)

---

### Settings Persistence — `writeSettingValue`

Delegates to the unified settings writer `$A`, which:

1. Loads the current user settings layer (`userSettings` → `settings.json`, `settings.local.json`, `.claude/`)
2. Merges the new `tuiMode` key
3. Writes back atomically via `EY6` (temp-file + fsync + rename pattern)
4. Clears the in-memory settings cache (`Kz` → `oa8.clear`, `Ac6.clear`)
5. Emits the settings-change event on `XlH`

Analysis basis: CC v2.1.177 bundle.js:+12734930 (`$A`), +1303045 (`"userSettings"`), +1303381 (`"settings.json"`)

---

### Terminal Capability Detection — `getTerminalInfo`

```
function getTerminalInfo():
    // Used by getFullscreenDecision to detect problematic environments
    termProgram  = env.TERM_PROGRAM            // "cursor", "vscode", "ghostty", etc.
    isJetBrains  = ln.isJetBrainsIdeTerminal()
    tmuxEnv      = env.TMUX
    tmuxCC       = detectTmuxCC()              // checks for tmux -CC pattern via i0
    // tmux multiplexer: checks env for "tmux" and replaces ESC-ESC sequences
    screenEnv    = env.TERM contains "screen"
    isWindows    = process.platform == "win32"
    isSSH        = env.SSH_CLIENT or env.SSH_TTY

    // Version checks for known-good terminal versions
    // ghostty >= 1.2.0, iTerm.app >= 3.6.6
    // xterm.js: versions 1092000–1105000 (cursor/vscode range)
    return { termProgram, isJetBrains, tmuxCC, screenEnv, isWindows, isSSH, ... }
```

Analysis basis: CC v2.1.177 bundle.js:+3595249 (`NY`), +3595543 (`"ghostty"`), +3595573 (`"1.2.0"`), +3595612 (`"iTerm.app"`), +3598819 (`"vscode"`), +3598770 (`"cursor"`), +3598939 (`"xterm.js"`)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_tui_refused` | Fired when the command is blocked because background work is active (bundle.js:+12734701) |
| Telemetry: `tengu_tui_command` | Fired on every successful mode switch, includes mode value and session context (`same_session` / `later_session`) (bundle.js:+12735174) |
| Telemetry: `tengu_scroll_summary` | Fired during relaunch teardown before process replacement (bundle.js:+7432100) |
| Telemetry: `tengu_amber_creek` | Fired inside fullscreen-decision logic for feature-flag/gradual-rollout path (bundle.js:+3528498) |
| Telemetry: `tengu_pewter_brook` | Fired on an alternate fullscreen-decision branch (bundle.js:+3528406) |
| Settings write | `tuiMode` key written to user-layer `settings.json` (or `settings.local.json`) under `.claude/` |
| Settings cache clear | In-memory settings caches (`oa8`, `Ac6`) are invalidated after write |
| Ink renderer unmount | `H.unmount()` called; terminal alternate-screen restored via ESC-8 sequence |
| Interval timers | All active interval timers cleared via `clearInterval` before relaunch |
| Process replacement | `execve` replaces the current process image with `--resume` flag; no fork |
| Analytics flush | Up to 30 000 ms flush window before exec; analytics drain up to 2 000 ms |
| Signal handlers | All existing process listeners removed; `SIGINT`/`SIGHUP` reinstalled as passthrough before exec |
| `process.exit` | Fallback path if `execve` fails (exit code ≥ 128) after writing error file |

---

## Version History

| Version | Change |
|---|---|
| v2.1.177 | Initial analysis |

---

## Common Mistakes

1. **Running `/tui` during active background work** — the command is hard-blocked if any task with status `running`, `pending`, `remote_agent`, or `mcp_task` exists; you must wait or use `/tasks` to stop it first.
2. **Expecting `/tui fullscreen` to affect background sessions** — background (`--bg`) sessions always use the fullscreen renderer regardless of the `tuiMode` setting. The command only controls sessions started directly with `claude`.
3. **Setting `tuiMode=fullscreen` on unsupported terminals** — the command will proceed and relaunch, but a warning is shown. Environments automatically downgraded to `default` include tmux in iTerm2 control mode (`-CC`) and Windows over SSH (ConPTY). Set `CLAUDE_CODE_NO_FLICKER=1` to override the auto-disable.
4. **Typos in the mode argument** — only `default` and `fullscreen` are accepted (exact, case-sensitive match after `.trim()`); any other string returns an error without relaunching.
5. **Expecting an immediate in-process effect** — changing the mode always triggers a full `execve` relaunch. The terminal will briefly reset as the process replaces itself.
6. **Relying on environment variable overrides being sticky** — `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` and `CLAUDE_CODE_NO_FLICKER` take priority over the persisted `tuiMode` setting, so a setting written by `/tui` may appear to have no effect if those env vars remain set.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `asL` | Main handler for `/tui` (AsyncFunction, module `SzK`) |
| `TU6` | Entry-point wrapper that invokes the relaunch sequence (`yZH`) |
| `yZH` | Core relaunch orchestrator — teardown, flush, exec |
| `LC` | Binary path resolver — finds versioned claude binary |
| `SR8` | Path builder for versioned install directory |
| `k3H` | Path segment builder using `~/.local/share` |
| `s9H` | Alternative path segment builder (bin directory) |
| `X08` | Home directory resolver (`os.homedir`) |
| `By6` | Interval-timer stop helper |
| `si_` | `clearInterval` wrapper |
| `XxH` | UI teardown helper — unmounts Ink renderer, restores terminal |
| `sO8` | Terminal restore helper — writes ESC-7/ESC-8 sequences |
| `OSH` | Terminal version-detection helper (ghostty, iTerm.app) |
| `i0` | tmux/screen escape-sequence rewriter |
| `ZT8` | Scroll summary event emitter (fires `tengu_scroll_summary`) |
| `b1q` | Scroll metrics calculator (Date.now, Math.max, Math.round) |
| `I1` | Settings reader — loads full merged settings object |
| `L_H` | Buffer/cache presence check for settings |
| `eh_` | Settings helper (part of read path) |
| `Zt` | Settings reader sub-helper |
| `th_` | Platform/Boolean guard in settings reader |
| `n_` | Notification/event helper |
| `oc4` | Settings post-processing helper |
| `$6` | Merged-settings accessor |
| `E4` | Generic timeout-race utility |
| `QZ` | Analytics flush initiator |
| `P4` | Analytics flush coordinator |
| `m9` | Analytics event registration (`XyA.register`) |
| `qQH` | Stream drain helper (`XyA.drain`) |
| `WxH` | Ink renderer mount helper |
| `nYA` | Post-relaunch path normalizer |
| `VzK` | Native `execve` wrapper (loads libSystem/libc via FFI) |
| `L` | FFI library handle (dlopen result) |
| `D` | Daemon/background-session manager |
| `b` | Background session worker/process tracker |
| `l8` | Generic async timeout/abort utility |
| `bH` | Low-level async helper (d + tH) |
| `IH` | Low-level async helper variant |
| `Dd8` | Low-memory event emitter (`tengu_bg_low_mem_mb`) |
| `aSH` | Session file cleanup helper |
| `kH` | File/log error reporter |
| `Q` | Background session socket/IPC manager |
| `EVA` | Socket connection handler (claim + auth) |
| `yVA` | Background session lifecycle manager |
| `Y` | Forced shutdown helper (`process.exit`, `z.abort`) |
| `Z8` | Debug/trace logger |
| `tH` | Low-level logger utility |
| `O` | Background-session meta object |
| `M` | MCP server connection manager |
| `LbH` | MCP server connection builder |
| `_o8` | MCP update applicator |
| `yZA` | MCP connection refresh coordinator |
| `z` | Daemon stop/cleanup orchestrator |
| `gS` | Daemon control reporter (fires `tengu_daemon_control`) |
| `hB` | Daemon shutdown sequence with `process.exit` |
| `TH` | String coercion utility |
| `kX` | Error file writer (on relaunch failure) |
| `kg8` | Relaunch argument rebuilder |
| `jvH` | Argument source classifier (`cliArg`, `session`) |
| `tf8` | Config-file watcher / `R6` wrapper |
| `R6` | Settings file loader |
| `Q6` | File existence / stat helper |
| `G5H` | Config directory initializer and file copier |
| `ng4` | File watcher with debounce (`w38.watchFile`) |
| `b_` | App-state background-work finder (`A.findLast`) |
| `pu8` | App-state helper (`f1`) |
| `Uu8` | App-state helper variant (`f1`) |
| `Mx` | Permission-mode disabler (`tengu_disable_bypass_permissions_mode`) |
| `u$` | App-state accessor (`H.getAppState`) |
| `E9` | Daemon-worker check (`BjH`, `"daemon-worker"`) |
| `hXH` | Fullscreen-decision calculator (evaluates all disable/enable conditions) |
| `$A` | Settings writer — persists user settings to disk |
| `n3` | Settings loader top-level (JDH + Tb) |
| `JDH` | Settings file locator (project/user layers) |
| `Je6` | Settings path resolver |
| `$df` | Settings file existence checker |
| `Tm` | Settings path joiner |
| `Mdf` | Managed-settings path builder |
| `Tb` | Settings layer aggregator |
| `DD6` | WSL settings path builder |
| `AL_` | Settings loader orchestrator |
| `TaA` | Settings merger / key collector |
| `_L_` | Settings layer walker |
| `WF` | Settings cache read/write coordinator |
| `QhA` | Settings cache getter (`oa8.get`) |
| `_S` | `structuredClone` wrapper |
| `t7_` | Settings validation and normalization |
| `dhA` | Settings cache setter (`oa8.set`) |
| `WaA` | Settings inline-SDK handler |
| `N7H` | Settings field normalizer (Adf/Kdf/Ldf) |
| `DlH` | Settings display formatter |
| `_W` | Settings file reader with encoding detection |
| `zs` | Settings file parser |
| `UL` | Real-path resolver (`H.realpathSync`) |
| `xs6` | Settings existence pre-check |
| `C8` | Generic error handler / `Z8` wrapper |
| `w7_` | Settings write timestamp tracker |
| `ZhH` | Settings reload helper |
| `EY6` | Atomic file writer (temp + fsync + rename) |
| `CH` | `JSON.stringify` wrapper |
| `Kz` | Settings cache invalidator (`oa8.clear`, `Ac6.clear`) |
| `Nt6` | Settings append/write with gitignore awareness |
| `u6` | Async-local-storage settings store accessor |
| `bs6` | ALS store getter (`Cs6.getStore`) |
| `i4_` | Settings value normalizer |
| `vt6` | Settings write sub-helper |
| `d_` | Git check-ignore runner |
| `ugf` | Path expansion helper (homedir, absolute) |
| `PrA` | Settings post-write verifier |
| `WrA` | Settings write retry helper |
| `n6` | Low-level async helper (d + tH) |
| `GF` | Settings load orchestrator with perf tracing |
| `tG` | Perf mark helper (`loadSettingsFromDisk_start`) |
| `Lq` | Memory usage sampler (`process.memoryUsage`) |
| `eu` | `perf_hooks` require wrapper |
| `qL_` | Settings load executor with caching |
| `b8` | Settings log appender (`f.appendFileSync`) |
| `Kc6` | Settings load lock/mutex |
| `YD6` | Settings watch-set manager |
| `K` | Column formatter (`L.padEnd`) |
| `qc6` | Settings completion notifier |
| `TI` | Terminal info / fullscreen eligibility reporter |
| `ZG6` | Terminal info struct builder |
| `NY` | Terminal version comparator |
| `ry_` | IDE terminal probe (cursor/vscode xterm.js version) |
| `$o4` | xterm.js version string extractor |
| `Ww` | macOS/darwin terminal fallback probe |
| `Oo4` | Terminal line-height calculator |
| `oy_` | Terminal row-count estimator |
| `Fm` | Ink renderer factory / render helper |
| `Rb` | Ink render entry point |
| `EE4` | Ink component builder (`A6`) |
| `A6` | String coercion / display-string builder |
| `rf` | Ink render sub-helper (`l_`) |
| `Lz` | Ink output writer |
| `eNH` | Ink container helper (`ScA`) |
| `ScA` | Ink scalar component builder |
| `$9` | Ink renderer selector / feature-flag gate |
| `Eg1` | Ink render pipeline orchestrator |
| `AJH` | Ink render dispatcher |
| `xb` | Ink component registry |
| `HP6` | Ink component file reader |
| `yLH` | Ink component version checker |
| `qq` | Ink component fallback |
| `GLH` | Ink alternate component builder (`A6`) |