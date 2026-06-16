---
type: feature-spec
feature: "tui"
cc_version: "2.1.178"
updated: "2026-06-16"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.178 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.178 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.178

---

## Overview

The `/tui` command switches the terminal UI renderer between `default` and `fullscreen` modes for the current Claude Code session. It validates environmental preconditions (active background tasks, OS/terminal compatibility), optionally relaunches the process with the selected renderer via `execve`, and persists the chosen mode to user settings. Background sessions are always forced into fullscreen mode regardless of this setting.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| module_id | `NjK` |
| load_inline | `true` |
| loc_byte | `12793346` |
| loc_byte_end | `12793528` |
| loc_line | `8782` |
| arbor_handler.name | `s85` |
| arbor_handler.fqn | `claude-2.1.178::s85` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.178 bundle.js:+12793346

---

## Input Branching

The command has 5+ distinct code paths (no argument, `default`, `fullscreen`, background-task guard, and per-environment disable checks), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/tui [arg]"]) --> B{Trim & resolve argument}
    B -->|no argument| C[Query current renderer state\nvia getAppState]
    B -->|'default' or 'fullscreen'| D{Background tasks running?\nrunning / pending / remote_agent / mcp_task}
    C --> D
    D -->|yes| E["Emit error:\nCannot switch renderers while work is running\n→ tengu_tui_refused"]
    D -->|no| F{Validate requested renderer\nagainst allowed list:\n'default' | 'fullscreen'}
    F -->|invalid value| G[Return usage error\nShow valid options joined from allowed list]
    F -->|valid| H{Renderer mode checks\nvia fullscreen-eligibility resolver}
    H -->|tmux -CC detected & no CLAUDE_CODE_NO_FLICKER| I["Disabled: tmux CC auto off\n(fullscreen only)"]
    H -->|Windows over SSH ConPTY & no CLAUDE_CODE_NO_FLICKER| J["Disabled: Windows SSH auto off\n(fullscreen only)"]
    H -->|CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN set| K["env_off: fullscreen blocked by env var"]
    H -->|CLAUDE_CODE_NO_FLICKER or CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL| L["env_on / force-upsell override"]
    H -->|eligible| M[Persist renderer choice\nto user settings via settings writer]
    I --> M
    J --> M
    K --> M
    L --> M
    M --> N[Emit tengu_tui_command telemetry\nwith same_session / later_session tag]
    N --> O{Same session relaunch possible?}
    O -->|yes — execve path available| P[Tear down current TUI\nunmount Ink renderer\nclear interval timers\nflush analytics\nRelaunch via execve / spawnSync]
    O -->|no / daemon-worker context| Q[Inform user:\nBackground sessions always use fullscreen\nChange takes effect on next direct claude launch]
    P --> R([Process replaced])
    Q --> S([Done — setting persisted])
    E --> S
    G --> S
```

---

## Behavioral Spec

### 1. Argument Resolution and Allowed-Value Check

```
async function tuiCommandHandler(inputArg, appContext):
    rawArg = inputArg.trim()                              // bundle.js:+12791109
    allowedValues = ["fullscreen", "default"]             // bundle.js:+12791267
    allowedDisplay = allowedValues.join(", ")

    if rawArg is empty:
        currentMode = getCurrentRendererMode(appContext)  // bundle.js:+12791134
        rawArg = currentMode  // toggle or display current

    if rawArg not in allowedValues:
        return errorResult("Unknown value. Valid options: " + allowedDisplay)
```

Analysis basis: CC v2.1.178 bundle.js:+12791109, +12791221, +12791267

---

### 2. Background-Task Guard

Active sessions of types `running`, `pending`, `remote_agent`, or `mcp_task` block the renderer switch. The guard queries app state for background tasks and fires a refusal telemetry event.

```
function checkBackgroundTaskGuard(appContext):
    blockedStates = ["running", "pending", "remote_agent", "mcp_task"]
    // bundle.js:+12791815, +12791837, +12791858, +12791883

    activeTasks = getBackgroundTasks(appContext)          // via b_ → getAppState
    if any task in activeTasks has status in blockedStates:
        emit("tengu_tui_refused")                         // bundle.js:+12791904
        return BLOCKED with message:
            "Cannot switch renderers while work is running " +
            "in the background — wait for it to finish " +
            "(or stop it via /tasks), then run /tui again."
            // bundle.js:+12791945
    return ALLOWED
```

Analysis basis: CC v2.1.178 bundle.js:+12791815–12791883, +12791904, +12791945

---

### 3. Fullscreen Eligibility Resolution

The eligibility resolver (`C1` / descriptive: `resolveFullscreenEligibility`) evaluates environment variables, terminal type, and OS to compute one of several named reasons. This drives both what is shown to the user and what is persisted.

```
function resolveFullscreenEligibility(env, platform, terminalInfo):

    // Background-session forced-on overrides everything
    if context is "daemon-worker":                        // bundle.js:+2295523
        return { mode: "fullscreen", reason: "bg_forced_on" }  // bundle.js:+3540790

    // Environment variable hard-disable
    if env.CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN is set:
        return { mode: "default", reason: "env_off" }    // bundle.js:+3540820

    // Environment variable hard-enable
    if env.CLAUDE_CODE_NO_FLICKER is set:
        return { mode: "fullscreen", reason: "env_on" }  // bundle.js:+3540870

    // tmux -CC (iTerm2 native integration) auto-disable
    if isTmuxCCMode(terminalInfo):
        emit("tengu_amber_creek")                         // bundle.js:+3540562
        return { mode: "default", reason: "tmux_cc_auto_off",
                 hint: "fullscreen disabled: tmux -CC ... set CLAUDE_CODE_NO_FLICKER=1 to override" }
        // bundle.js:+3540045, +3540894

    // Windows over SSH ConPTY auto-disable
    if platform is "windows" and isSSHSession():
        emit("tengu_pewter_brook")                        // bundle.js:+3540470
        return { mode: "default", reason: "win_ssh_auto_off",
                 hint: "fullscreen disabled: Windows over SSH ... set CLAUDE_CODE_NO_FLICKER=1 to override" }
        // bundle.js:+3540231, +3540928

    // User settings drive remaining cases
    if userSettings.tui is "fullscreen":
        return { mode: "fullscreen", reason: "settings_on" }   // bundle.js:+3540987
    if userSettings.tui is "default":
        return { mode: "default", reason: "settings_off" }     // bundle.js:+3541021

    // Feature-flag / upsell overrides
    if CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL env is set:
        return { mode: "fullscreen", reason: "downsell_on" }   // bundle.js:+3541094

    if featureFlag "gb_on":
        return { mode: "fullscreen", reason: "gb_on" }         // bundle.js:+3541159
    else:
        return { mode: "default", reason: "gb_off" }           // bundle.js:+3541167
```

Analysis basis: CC v2.1.178 bundle.js:+3539842, +3540379, +3540405, +3540790–3541167

---

### 4. Background-Session Note

When the user queries or sets TUI mode in any context, a fixed informational note is surfaced:

> "Background sessions always use the fullscreen renderer so scrolling and mouse work when attached. The tui setting applies to sessions started directly with `claude`."
> (bundle.js:+12791419)

---

### 5. Settings Persistence

On a successful mode selection, the handler writes the chosen renderer to user settings via the settings writer (`YA` / descriptive: `writeUserSettings`). The key written is `"system"` (bundle.js:+12791247) within the settings structure.

```
function persistTuiSetting(mode):
    // mode is "fullscreen" or "default"
    updateUserSettings({ system: { tui: mode } })        // bundle.js:+12791247
    // Internally uses settings writer at bundle.js:+1326570 (dF → kM_ path)
```

Analysis basis: CC v2.1.178 bundle.js:+12791247, +12792117

---

### 6. Telemetry Emission

After the setting is persisted, the command emits a `tengu_tui_command` event tagged with whether the change applies to the current session (`same_session`) or only a future one (`later_session`).

```
function emitTuiTelemetry(mode, appliesNow):
    tag = appliesNow ? "same_session" : "later_session"
    // bundle.js:+12792841, +12792856
    emit("tengu_tui_command", {                          // bundle.js:+12792377
        mode: mode,
        timing: tag,
        uptime: Math.round(process.uptime()),            // bundle.js:+12792468, +12792479
    })
```

Analysis basis: CC v2.1.178 bundle.js:+12792377, +12792416, +12792468, +12792479, +12792718, +12792841, +12792856

---

### 7. Same-Session Relaunch (execve Path)

When the selected mode differs from the active mode and the runtime environment supports it, the handler tears down the current TUI and relaunches the process in-place via `execve` (or falls back to `spawnSync` on platforms without native `execve`).

```
async function relaunchWithNewRenderer(mode, currentArgs):
    // Step 1: Graceful TUI teardown
    clearActiveIntervals()                                // Kk6 → Go_ → clearInterval, bundle.js:+12786464
    unmountInkRenderer()                                  // bxH → H.unmount, bundle.js:+12786470
    flushRendererOutput()                                 // bxH → rY8 → Ee.writeSync, bundle.js:+7175613

    // Step 2: Flush analytics with timeout
    await Promise.race([
        flushAnalytics(),                                 // uxH → bE8, bundle.js:+12786616
        timeout(30000, "analytics flush timeout"),        // bundle.js:+12786509, +12786515
    ])

    // Step 3: Drain event queues
    await drainQueues(timeout=2000)                      // tQH → XSA.drain, bundle.js:+12786560, +12786566

    // Step 4: Register cleanup handlers
    process.removeAllListeners()                          // bundle.js:+12787011
    process.on("SIGINT", ...)                            // bundle.js:+12786982
    process.on("SIGHUP", ...)                            // bundle.js:+12787001
    process.on("beforeExit", ...)                        // bundle.js:+12787157
    process.on("exit", ...)                              // bundle.js:+12787198

    // Step 5: Rebuild argv with --resume and renderer flags
    newArgs = buildRelaunchArgs(currentArgs, mode)        // ad8, bundle.js:+12791385
    // Injects --resume, --add-dir, --effort, --permission-mode flags as needed
    // bundle.js:+12786442, +12787966, +12788081, +12788223, +12788240

    // Step 6: execve (macOS/Linux) or spawnSync fallback (Windows)
    if platform is "macos" or "linux":
        loadNativeLib()                                   // WjK → L.dlopen, bundle.js:+12785569
        // macOS: /usr/lib/libSystem.B.dylib, bundle.js:+12785590
        // Linux: libc.so.6, bundle.js:+12785619
        execve(newArgs)                                   // WjK → M.execve, bundle.js:+12785945
    else:
        spawnSync(process.argv[0], newArgs,              // MVH → TjK.spawnSync, bundle.js:+12787068
                  { stdio: "inherit" })                   // bundle.js:+12787103

    process.exit(exitCode)                               // bundle.js:+12787317
```

Analysis basis: CC v2.1.178 bundle.js:+12786390, +12786442–12787317, +12791385

---

### 8. Terminal Compatibility Checks (mk / terminalCompatibilityCheck)

Before committing to fullscreen, the handler inspects the active terminal emulator:

```
function terminalCompatibilityCheck(terminalEnv):
    // Detect JetBrains IDE terminal
    if Wi.isJetBrainsIdeTerminal():                      // bundle.js:+3610158
        // xterm.js renderer identified; check version compatibility
        version = parseFloat(getXtermVersion())          // bundle.js:+3611285
        versionMin = 1092000                             // bundle.js:+3610959
        versionMax = 1105000                             // bundle.js:+3610970
        if valid and in range:
            return COMPATIBLE

    // Detect cursor / vscode terminals
    if terminalEnv includes "cursor" or "vscode":        // bundle.js:+3610834, +3610883
        return COMPATIBLE_WITH_NOTE

    // Darwin/macOS specific path
    if platform is "darwin":                             // bundle.js:+3610367
        // Check for ghostty >= 1.2.0, iTerm.app >= 3.6.6
        // bundle.js:+3607607, +3607637, +3607676, +3607708
        return checkNativeTerminalVersion(terminalEnv)

    // Windows fallback
    if platform is "win32":                              // bundle.js:+3610414
        return LIMITED

    // Unset TERM_PROGRAM
    if terminalEnv is "unset":                           // bundle.js:+3610537
        return UNKNOWN

    return DEFAULT_ELIGIBLE
```

Analysis basis: CC v2.1.178 bundle.js:+3610090–3611341

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_tui_command` | Fired on every successful `/tui` invocation; tagged `same_session` or `later_session` (bundle.js:+12792377) |
| Telemetry: `tengu_tui_refused` | Fired when background tasks block the renderer switch (bundle.js:+12791904) |
| Telemetry: `tengu_amber_creek` | Fired when tmux -CC auto-disables fullscreen (bundle.js:+3540562) |
| Telemetry: `tengu_pewter_brook` | Fired when Windows-over-SSH auto-disables fullscreen (bundle.js:+3540470) |
| Telemetry: `tengu_scroll_summary` | Fired during TUI teardown scroll-state capture (bundle.js:+7177447) |
| Settings write | `system.tui` key written to user settings JSON (`settings.json`) via async settings writer |
| Process relaunch | `execve` (macOS/Linux) or `spawnSync` (Windows) replaces the process when switching renderer in the same session |
| Ink renderer unmount | `H.unmount` called during teardown (bundle.js:+7175691) |
| Interval timers cleared | All active render intervals cleared via `clearInterval` (bundle.js:+7177325) |
| Analytics flush | Analytics queue drained with 30 000 ms timeout before relaunch (bundle.js:+12786509) |
| Event drain | `XSA.drain` called with 2 000 ms timeout (bundle.js:+12786560, +12786566) |
| Signal handlers | All existing listeners removed and fresh `SIGINT`/`SIGHUP`/`beforeExit`/`exit` handlers registered before execve (bundle.js:+12787011–12787198) |
| Environment variables consulted | `CLAUDE_CODE_NO_FLICKER`, `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN`, `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL` (bundle.js:+12788462, +12788487, +12788526) |
| Background session override | Sessions in `daemon-worker` context (`daemon-worker` literal, bundle.js:+2295523) always run fullscreen; `/tui` setting is silently inapplicable |

---

## Version History

| Version | Change |
|---|---|
| v2.1.178 | Initial analysis |

---

## Common Mistakes

1. **Running `/tui` while background tasks are active.** The command refuses to switch renderers if any task has status `running`, `pending`, `remote_agent`, or `mcp_task`. Use `/tasks` to inspect and stop active work first.
2. **Expecting the setting to affect background sessions.** Background sessions (`daemon-worker`) always force fullscreen. The `/tui` preference only affects sessions launched directly with `claude` from the terminal.
3. **Omitting the argument and expecting a toggle.** Without an argument, the command reports the current mode derived from app state rather than toggling it. Supply `default` or `fullscreen` explicitly to change the renderer.
4. **Overriding with environment variables and then wondering why `/tui` has no effect.** `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` and `CLAUDE_CODE_NO_FLICKER` take precedence over the persisted setting. The command will persist the value but the resolved mode will be overridden at startup.
5. **Assuming `/tui` applies instantly without a relaunch.** On platforms where `execve` succeeds, the current process is replaced immediately. On Windows, a `spawnSync` child is created and the parent exits; there is a brief handoff period during which terminal state may flicker.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `s85` | Main `/tui` command handler (AsyncFunction; arbor_handler) |
| `cB6` | Entry-point wrapper that dispatches to the relaunch orchestrator (`MVH`) |
| `MVH` | Relaunch orchestrator: tears down TUI, flushes queues, execve/spawnSync |
| `vC` | Claude install path resolver |
| `Cx8` | Version-path builder (joins `claude/versions/bin`) |
| `z$H` | Alternate path builder (joins `.local/share`) |
| `CqH` | Home-directory path resolver |
| `JT8` | `os.homedir()` wrapper |
| `eh` | Environment/config accessor used by orchestrator |
| `R6` | Utility function calling `TT` |
| `Kk6` | Interval-clear wrapper (`Go_` → `clearInterval`) |
| `Go_` | Clears a specific render interval |
| `bxH` | TUI teardown: unmounts Ink, writes sync output, calls `rY8` |
| `rY8` | Scroll-state serializer / stdout writer |
| `qRH` | Terminal-capability query (ghostty/iTerm version check) |
| `oSH` | Alternate screen exit escape writer |
| `DG` | tmux/screen double-escape handler |
| `D5` | Utility referenced during teardown |
| `N` | Log/format utility |
| `uE8` | Scroll-summary emitter (`tengu_scroll_summary`) |
| `b1q` | Scroll-metrics calculator (Date.now, Math.max, Math.round, Object.assign) |
| `C1` | Fullscreen eligibility resolver |
| `Ql` | Feature-flag checker (`UB4.has`) |
| `uI_` | Settings reader helper |
| `qe` | App-state accessor wrapping `Dof` |
| `xI_` | Platform/OS detector (windows check, Boolean coerce) |
| `d_` | Settings writer wrapper |
| `jof` | Orchestrates `O6` (render mode write) |
| `O6` | Render-mode state write and event emitter |
| `a4` | Timeout-race utility (setTimeout / Promise.race / clearTimeout) |
| `KV` | Analytics registration caller |
| `Wf` | Analytics module initializer |
| `F9` | `XSA.register` wrapper |
| `tQH` | Analytics drain with timeout |
| `uxH` | Analytics flush with Promise.resolve |
| `bE8` | Analytics flush inner function |
| `UJA` | Post-relaunch config writer |
| `W_` | Config path utility (calls `TT`) |
| `$4` | Config utility (calls `TT`) |
| `WjK` | Native-library loader and execve invoker |
| `L` | Native FFI library handle |
| `A` | Process/connection manager map |
| `q` | Active-connection set |
| `f` | Promise-tracking helper |
| `$` | Event/metric queue |
| `xGK` | Metric timestamper |
| `D` | Daemon/subprocess manager |
| `b` | Background-process supervisor |
| `o8` | Abort-with-timeout utility |
| `bH` | Feature-flag OK reporter |
| `SH` | Feature-flag OK reporter (alternate path) |
| `ul8` | Low-memory event emitter (`tengu_bg_low_mem_mb`) |
| `dRH` | Crash-log cleaner (lstat → rm → readFile) |
| `RH` | Error logger / roster updater |
| `F` | Child-process lifecycle manager |
| `ZhA` | Socket-auth and connection handler |
| `khA` | Session lifecycle manager (spawn/kill/retire) |
| `w` | Forced-shutdown handler (process.exit + abort) |
| `Z8` | Error-type checker |
| `dH` | Config accessor (`c36`) |
| `B` | Disposable resource wrapper |
| `O` | Background-session descriptor (`C8`) |
| `C8` | Session-info struct |
| `M` | MCP connection manager (ebH, hs8, INA) |
| `ebH` | MCP server connector |
| `hs8` | MCP update applier |
| `INA` | MCP client roster updater |
| `z` | Daemon container (SH, bH, AR, aB) |
| `AR` | Daemon control telemetry emitter (`tengu_daemon_control`) |
| `aB` | Graceful shutdown race (Promise.race + process.exit) |
| `TH` | String coercer |
| `cX` | PID-file writer (`E_H.writeFileSync`) |
| `ad8` | Relaunch-argv builder (Array.from, --add-dir injection) |
| `HNH` | CLI-arg mapper |
| `d78` | Boolean-flag coercer |
| `S6` | Settings file reader/watcher |
| `n6` | Path-existence checker |
| `$k_` | Settings-parse helper |
| `_MH` | Settings file parser (readFileSync, statSync, mkdirSync) |
| `wnf` | File-watcher setup/teardown (`$O8.watchFile`) |
| `b_` | App-state extractor (getAppState, findLast) |
| `tp8` | Allowed-tools state reader (`K1`) |
| `ep8` | Disallowed-tools state reader (`K1`) |
| `Nx` | Permission-disable handler (`tengu_disable_bypass_permissions_mode`) |
| `p$` | App-state getter |
| `v9` | Daemon-worker context checker (`zkH`) |
| `zkH` | Daemon context identifier |
| `APH` | Renderer-mode state writer (APH → d_ → O6) |
| `YA` | Settings load-from-disk orchestrator |
| `a3` | Settings merge entry point |
| `aDH` | Settings path resolver (userSettings, projectSettings, localSettings) |
| `A68` | Settings file path builder (Hk.resolve, Hk.dirname) |
| `Di4` | Settings-layer checker (`L6`) |
| `pm` | `.claude` directory path builder |
| `wi4` | Managed-settings path builder (WSL detection) |
| `pb` | Settings aggregator (merges all layers) |
| `m$6` | Policy-settings reader |
| `QH_` | Flag-settings reader |
| `b$6` | User-settings reader |
| `qNH` | Project-settings reader |
| `KNH` | Local-settings reader |
| `U$6` | Cowork-settings reader |
| `MAH` | SDK-inline-settings reader |
| `tDH` | Additional settings reader |
| `Y68` | Settings reader variant |
| `UeA` | Settings reader variant |
| `ls` | Settings list helper |
| `Pj6` | WSL/managed-settings path helper |
| `yM_` | Settings deep-merge and reload |
| `ZeA` | Settings cache invalidator |
| `hM_` | Per-layer settings merger |
| `QF` | Settings snapshot getter/setter |
| `QIA` | Settings store getter (`We8.get`) |
| `PS` | Deep-clone utility (`structuredClone`) |
| `VM_` | Settings validator and parser |
| `dIA` | Settings store setter (`We8.set`) |
| `TeA` | SDK-inline settings applier |
| `KLH` | Settings-key normalizer (Mi4, Oi4, Yi4) |
| `$nH` | Settings validation error formatter |
| `XW` | Settings reload dispatcher |
| `Fs` | File reader with BOM/encoding detection |
| `rL` | Path realpath resolver |
| `We6` | File-existence guard |
| `_` | General utility / string helper |
| `Ge6` | Encoding slicer |
| `x8` | Error type wrapper |
| `m5_` | Settings-load timestamp recorder |
| `YyH` | Settings-reload entry (A68 + pb) |
| `ED6` | Atomic file writer (lstat, rename, fchmod, fsync) |
| `xH` | JSON stringifier wrapper |
| `Oz` | Settings cache clearer (Ul6.clear, We8.clear) |
| `zH8` | gitignore / ignore-file reader |
| `u6` | AsyncLocalStorage store getter |
| `Pe6` | Store accessor (`Xe6.getStore`, `Yl`) |
| `G5_` | Git-related helper (`yf`) |
| `OH8` | ignore-rule evaluator (`Q_`) |
| `Q_` | Git ignore rule parser |
| `Fl4` | Path normalizer for ignore rules |
| `TsA` | ignore test runner |
| `EsA` | gitignore section writer |
| `d6` | Feature-flag "sad" reporter |
| `dF` | Settings load orchestrator (GT, Oq, kM_, pb, Bl6) |
| `GT` | Settings-load start marker |
| `Oq` | Memory-usage sampler (`process.memoryUsage`) |
| `Jm` | `perf_hooks` importer |
| `kM_` | Settings-load inner loop (ZeA, QF, TeA, aDH) |
| `u8` | Log-file appender (appendFileSync, mkdirSync) |
| `Fl6` | Settings-load phase marker |
| `Xj6` | Watched-files set manager |
| `K` | Padding/format helper (`padEnd`) |
| `Bl6` | Post-load finalizer |
| `mk` | Terminal-compatibility checker |
| `kT6` | Terminal-name getter |
| `Iw` | Terminal environment reader |
| `SS_` | VSCode/Cursor version checker |
| `yef` | VSCode version parser |
| `TY` | macOS native terminal checker |
| `kef` | xterm.js version-range validator |
| `RS_` | xterm.js version string reader |
| `qp` | Telemetry event batcher |
| `ib` | Telemetry inner batch handler |
| `INf` | Telemetry logger (`L6`) |
| `L6` | String coercer for telemetry |
| `E4` | Telemetry transport (`S_`) |
| `Fz` | Telemetry formatter |
| `FhH` | Telemetry consent checker (`biA`) |
| `biA` | Consent-level resolver |
| `M9` | Plan/entitlement checker |
| `hc1` | Plan-info reader (`Tt`) |
| `Tt` | Plan resolver (ab, K26, M5H) |
| `ab` | Plan type classifier (S_, Y7, SO, Qj, Y9) |
| `K26` | Plan-file reader (vc1.readFileSync) |
| `M5H` | Plan-inclusion checker |
| `qq` | Consent-level getter (`biA`) |
| `eLH` | Telemetry level resolver (`L6`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.