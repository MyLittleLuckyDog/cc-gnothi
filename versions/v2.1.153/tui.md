---
type: feature-spec
feature: "tui"
cc_version: "2.1.153"
updated: "2026-06-02"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.153 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.153 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.153

---

## Overview

The `/tui` command switches the terminal UI renderer between `default` and `fullscreen` modes at runtime. It validates the current session context, inspects environment variables and settings to determine renderer eligibility, and then performs a live relaunch of the UI process into the requested rendering mode. When switching is not permitted (background session, active background tasks, or automatic disqualification conditions), it returns an explanatory error message instead.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| module_id | `oF1` |
| load_inline | `true` |
| loc_byte | `12062543` |
| loc_byte_end | `12062725` |
| loc_line | `8984` |
| arbor_handler.name | `F15` |
| arbor_handler.fqn | `claude-2.1.153::F15` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.153 bundle.js:+12062543

---

## Input Branching

More than 3 distinct branches exist: background-session guard, active-task guard, argument normalization, mode selection (`fullscreen` vs `default`), and automatic disqualification sub-branches (tmux-CC detection, Windows-SSH detection). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/tui [arg]"]) --> B[Trim & normalize argument]
    B --> C{Session type check}
    C -- "daemon or daemon-worker" --> D["Error: renderer switching unavailable\nin background session\n(bundle.js:+12060795)"]
    C -- foreground --> E{Background tasks running?\nrunning / pending / remote_agent / mcp_task}
    E -- yes --> F["Error: cannot switch while tasks running\n(bundle.js:+12061289)"]
    F --> G["Emit tengu_tui_refused\n(bundle.js:+12061248)"]
    E -- no --> H[Compute fullscreen eligibility\nvia resolveFullscreenMode]
    H --> I{Arg provided?}
    I -- "fullscreen" --> J[Request fullscreen mode]
    I -- "default" --> K[Request default mode]
    I -- none / other --> L[Use system-determined mode]
    J --> M{Eligibility checks}
    K --> M
    L --> M
    M -- "tmux -CC / iTerm2 detected\nAND env override absent" --> N["Auto-disabled: tmux_cc_auto_off\n(bundle.js:+3371010)"]
    M -- "Windows over SSH\nAND env override absent" --> O["Auto-disabled: win_ssh_auto_off\n(bundle.js:+3371196)"]
    M -- eligible --> P[Relaunch renderer\ncPH / rF1\n(bundle.js:+12062158)]
    P --> Q["Emit tengu_tui_command\n(bundle.js:+12061720)"]
    N --> R[Return warning text to user]
    O --> R
    D --> S([Done])
    G --> S
    R --> S
    Q --> S
```

---

## Behavioral Spec

### Handler Entry — `mainTuiHandler` (F15)

The Arbor-resolved handler is the async function `F15`. It is loaded via the `module_id` resolution path (`oF1`).

```
async function mainTuiHandler(context, rawArg):
    arg = rawArg.trim()                          // bundle.js:+12060473
    loadSettings = loadSettingsFromDisk()        // bundle.js:+12060498
    appConfig  = getSystemConfig()               // bundle.js:+12060509
    sessionKind = getSessionKind()               // bundle.js:+12060555

    // Background-session guard
    if sessionKind in ["daemon", "daemon-worker"]:  // bundle.js:+12060795
        return errorMessage(
            "Renderer switching isn't available in a background session " +
            "— press ← to detach and run /tui from a foreground session."
        )

    // Inspect allowed modes from app state
    allowedModes = getAppState("allowed_tools", ...)  // bundle.js:+12060765
    systemMode   = "system"                           // bundle.js:+12060623

    // Collect running background tasks
    tasks = buildTaskList(...)                        // bundle.js:+12060761
    activeTasks = tasks.filter(status in
        ["running","pending","remote_agent","mcp_task"])  // bundle.js:+12061120–12061227

    if activeTasks.length > 0:
        emitTelemetry("tengu_tui_refused")            // bundle.js:+12061248
        return errorMessage(
            "Cannot switch renderers while background tasks are running " +
            "— wait for them to finish (or stop them via /tasks), then run /tui again."
        )                                             // bundle.js:+12061289

    // Resolve target mode
    targetMode = resolveFullscreenMode(arg, settings) // bundle.js:+12061460
    // targetMode one of: "fullscreen","default","bg_forced_on","env_off","env_on",
    //   "tmux_cc_auto_off","win_ssh_auto_off","settings_on","settings_off",
    //   "downsell_on","gb_on","gb_off"               // bundle.js:+3371763–3372148

    // Perform relaunch
    result = performRendererRelaunch(targetMode, context)  // bundle.js:+12062158
    emitTelemetry("tengu_tui_command",
        { uptime: Math.round(process.uptime()), ... })     // bundle.js:+12061720, +12061799

    return result
```

Analysis basis: CC v2.1.153 bundle.js:+12060473 – +12062259

---

### Fullscreen Mode Resolution — `resolveFullscreenMode` (SzH)

This sub-function encapsulates all eligibility logic and maps the user argument plus environment state onto a symbolic mode tag.

```
function resolveFullscreenMode(argString, settings):
    normalized = argString.toLowerCase()   // bundle.js:+15412160

    // Environment variable overrides (checked first)
    if env["CLAUDE_CODE_NO_FLICKER"] is set:          // bundle.js:+12058749
        return "env_off"                              // bundle.js:+3371793
    if env["CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN"]:   // bundle.js:+12058774
        return "env_off"
    if env["CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL"]:    // bundle.js:+12058813
        return "env_on"                               // bundle.js:+3371851

    // tmux -CC / iTerm2 integration mode detection
    if isTmuxControlMode():                           // bundle.js:+3370041–3370338
        // spawnSync("tmux", ["display-message","-p","#{client_control_mode}"])
        // timeout 2000 ms                           // bundle.js:+3370338
        return "tmux_cc_auto_off"                    // bundle.js:+3371875

    // Windows over SSH detection
    if isWindowsSshSession():                        // bundle.js:+3370541–3370574
        return "win_ssh_auto_off"                   // bundle.js:+3371909

    // Settings-based override
    if settings.fullscreen == true:
        return "settings_on"                        // bundle.js:+3371968
    if settings.fullscreen == false:
        return "settings_off"                       // bundle.js:+3372002

    // Explicit user argument
    if normalized == "fullscreen":                  // bundle.js:+3371344
        return "fullscreen"
    if normalized == "default":                     // bundle.js:+3371370
        return "default"

    // Gradual-rollout / downsell flags
    if gradualRolloutEnabled():
        return "gb_on"   // bundle.js:+3372140
    else:
        return "gb_off"  // bundle.js:+3372148
```

Analysis basis: CC v2.1.153 bundle.js:+12061460 (SzH entry), +3371763–3372148 (mode literals)

---

### tmux Control-Mode Detection — `tmuxControlModeDetector` (a17 / o17)

```
function tmuxControlModeDetector():
    // Detect if running inside iTerm.app           // bundle.js:+3369986
    if terminal.startsWith("iTerm.app"):            // bundle.js:+3370041
        // spawnSync "tmux display-message -p #{client_control_mode}"
        result = spawnSync("tmux",
            ["display-message", "-p", "#{client_control_mode}"],
            { encoding: "utf8", timeout: 2000 })    // bundle.js:+3370264–3370338
        return result indicates control mode active
    // Also checks for "screen" and "tmux" env prefixes  // bundle.js:+3370054,3370079
    return false
```

Analysis basis: CC v2.1.153 bundle.js:+3370041–3370338

---

### Windows-SSH Auto-Disable — `windowsSshDetector` (AY_)

```
function windowsSshDetector():
    if platform == "windows":                      // bundle.js:+3370548
        // Checks for SSH session indicators (ConPTY rendering context)
        return true
    return false
```

Disablement message: `"fullscreen disabled: Windows over SSH (ConPTY re-rendering) detected · set CLAUDE_CODE_NO_FLICKER=1 to override"`
Analysis basis: CC v2.1.153 bundle.js:+3371196, +3370541

---

### Renderer Relaunch — `performRendererRelaunch` (rF1 → cPH)

```
async function performRendererRelaunch(targetMode, context):
    // Flush pending writes / analytics
    flushBeforeExit(timeout=30000)                // bundle.js:+12056794 ("flush timeout (relaunch)")
    analyticsFlushTimeout = 500                   // bundle.js:+5318270
    await Promise.all([analyticsFlush, cleanupTimeout])  // bundle.js:+12056773

    // Unmount current Ink/JSX renderer
    unmountCurrentRenderer()                      // bundle.js:+5316513

    // Clear interval-based refresh timers
    clearAllIntervals()                           // bundle.js:+5317859

    // Remove existing process signal handlers
    process.removeAllListeners("SIGINT","SIGTERM","SIGHUP")  // bundle.js:+12057296

    // Write resume-session marker file           // bundle.js:+12056727 ("--resume")
    writeResumeMarker(sessionId)

    // spawnSync the new renderer process
    spawnSync(executablePath,
        buildArgList(targetMode),                 // bundle.js:+12057353
        { stdio: "inherit" })                     // bundle.js:+12057388

    // On return (child exited), write relaunch error marker if non-zero
    // bundle.js:+12057578 ("relaunch_spawn_error")
    // Exit current process
    process.exit(exitCode)                        // bundle.js:+12057602
```

Timeouts observed:
- Flush timeout: 30 000 ms (bundle.js:+12056794)
- Cleanup label timeout: `"cleanup timeout"` (bundle.js:+12056856)
- Analytics flush timeout: 500 ms (bundle.js:+5318270)

Analysis basis: CC v2.1.153 bundle.js:+12056581–12057715

---

### Task-List Builder — `buildTaskList` (bN8)

```
function buildTaskList(appState):
    tasks = Array.from(taskRegistry)               // bundle.js:+12058076
    // Include CLI-arg-sourced tasks (cliArg)      // bundle.js:+12058151
    // Include session-scoped tasks                // bundle.js:+12058172
    // Filter for: --add-dir, --allow-dangerously-skip-permissions,
    //             --effort, --permission-mode     // bundle.js:+12058251–12058548
    // Deduplicate via q.includes check            // bundle.js:+12058378
    return tasks.flatMap(normalize)                // bundle.js:+12058493
```

Analysis basis: CC v2.1.153 bundle.js:+12058076–12058493

---

### Settings Load — `loadSettingsFromDisk` (o_ → Ap)

Settings are loaded from multiple layered sources and merged:

| Source key | Path hint |
|---|---|
| `flagSettings` | Internal feature flags (bundle.js:+1212982) |
| `policySettings` | Policy overrides (bundle.js:+1213004) |
| `userSettings` | `~/.claude/settings.json` (bundle.js:+1216190, +1216444) |
| `projectSettings` | Project-level settings (bundle.js:+1216241) |
| `localSettings` | `settings.local.json` (bundle.js:+1216263, +1216516) |
| `SDK inline settings` | Inline SDK config (bundle.js:+1215262) |

Telemetry markers: `"loadSettingsFromDisk_start"` / `"loadSettingsFromDisk_end"` / `"settings_load_started"` / `"settings_load_completed"`
Analysis basis: CC v2.1.153 bundle.js:+1223983, +1224039, +1220602, +1221327

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_tui_command` | Fired on every successful renderer switch attempt; includes `Math.round(process.uptime())` (bundle.js:+12061720, +12061810) |
| Telemetry: `tengu_tui_refused` | Fired when background tasks block the switch (bundle.js:+12061248) |
| Telemetry: `tengu_amber_creek` | Fired from fullscreen-mode resolver (bundle.js:+3371527) |
| Telemetry: `tengu_pewter_brook` | Fired from fullscreen-mode resolver (bundle.js:+3371435) |
| Telemetry: `tengu_feature_ok` | Fired on successful sub-feature path (bundle.js:+965124) |
| Telemetry: `tengu_feature_sad` | Fired on sad sub-feature path (bundle.js:+965259) |
| Telemetry: `tengu_feature_bad` | Fired on error sub-feature path (bundle.js:+965182) |
| Telemetry: `tengu_scroll_summary` | Fired from Ink renderer cleanup (bundle.js:+5317981) |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Background dispatcher signal escalation (bundle.js:+15386200) |
| Telemetry: `tengu_bg_dispatch_low_mem` | Background dispatcher low-memory event (bundle.js:+15386779) |
| Telemetry: `tengu_bg_spare_enable` | Spare session enabled (bundle.js:+15387474) |
| Telemetry: `tengu_bg_spare_claim` | Spare session claimed (bundle.js:+15387595) |
| Telemetry: `tengu_bg_spare_claim_fail` | Spare session claim failed (bundle.js:+15387858) |
| Telemetry: `tengu_daemon_control` | Daemon control-path event (bundle.js:+15422336) |
| Process signal handlers | `removeAllListeners` for SIGINT, SIGTERM, SIGHUP before relaunch (bundle.js:+12057296) |
| Process exit | `process.exit()` called after the relaunch child exits (bundle.js:+12057602) |
| File I/O | Resume-marker file written before `spawnSync` (bundle.js:+12056727); relaunch-error marker on failure (bundle.js:+12057578) |
| Renderer unmount | Ink/JSX renderer unmounted before relaunch (bundle.js:+5316513) |
| Interval clearance | All refresh intervals cleared before relaunch (bundle.js:+5317859) |
| appState reads | `allowed_tools`, `disallowed_tools`, `avoid_prompts`, `effort`, `model` read from app state (bundle.js:+10638573–10638804) |
| Settings cache | `settings_load_completed` telemetry emitted on each disk load (bundle.js:+1221327) |

---

## Environment Variables

| Variable | Effect |
|---|---|
| `CLAUDE_CODE_NO_FLICKER` | Disables fullscreen mode (`env_off`), overrides auto-enable (bundle.js:+12058749) |
| `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` | Also disables fullscreen mode (`env_off`) (bundle.js:+12058774) |
| `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL` | Forces fullscreen upsell regardless of other conditions (bundle.js:+12058813) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.153 | Initial analysis |

---

## Common Mistakes

1. **Running `/tui` inside a daemon/background session**: The command detects `daemon` and `daemon-worker` session kinds and immediately returns an error instructing the user to detach first (bundle.js:+12060795). Use the detach key (←) before attempting the switch.
2. **Running `/tui` while background tasks are active**: Any task with status `running`, `pending`, `remote_agent`, or `mcp_task` blocks the renderer switch (bundle.js:+12061181–12061227). Use `/tasks` to inspect and stop tasks first.
3. **Expecting fullscreen in tmux -CC (iTerm2 integration) mode**: The command auto-disables fullscreen and returns an explanatory message. Set `CLAUDE_CODE_NO_FLICKER=1` to override (bundle.js:+3371010).
4. **Expecting fullscreen over Windows SSH (ConPTY)**: Same auto-disable applies. Set `CLAUDE_CODE_NO_FLICKER=1` to override (bundle.js:+3371196).
5. **Passing an unrecognized argument**: Only `fullscreen` and `default` are recognized mode tokens. Any other string falls through to the system-determined mode rather than returning an error.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `F15` | Main async handler for `/tui` command (arbor_handler) |
| `A` | Generic iteration / string variable (multiple use-sites) |
| `M` | Secondary string / module reference variable |
| `q` | Tertiary collection / file-system reference variable |
| `L` | Task/set collection variable |
| `o_` | Settings loader entry point |
| `Ap` | Settings orchestrator (loadSettingsFromDisk core) |
| `uE` | Settings sub-loader utility |
| `E9` | Performance mark recorder (perf_hooks) |
| `mm` | Dynamic require wrapper |
| `nr8` | Settings load sequencer / telemetry marker emitter |
| `I8` | Log-file appender utility |
| `bR6` | Settings merge helper |
| `CL6` | Flag-settings applicator |
| `$kA` | Object-key settings merger |
| `K` | Column formatter (padEnd 40) |
| `i3H` | User-settings file locator |
| `vg` | Project-settings file locator |
| `LkA` | SDK inline settings loader |
| `Ng` | Settings composition orchestrator |
| `O_` | Config-path resolver |
| `P96` | Policy-settings loader |
| `Zu8` | Settings validator |
| `w96` | Settings schema checker |
| `uWH` | Settings merge reducer |
| `mWH` | Settings fallback handler |
| `W96` | Settings normalizer |
| `d3H` | Settings diagnostics emitter |
| `c3H` | Settings error reporter |
| `Ur8` | Settings telemetry aggregator |
| `dIA` | Settings completion notifier |
| `qi` | Settings watcher registration |
| `bL6` | WSL-aware settings path resolver |
| `CR6` | Settings cache clearer |
| `$q` | System config / environment inspector |
| `Y3H` | Feature-flag registry checker |
| `qY_` | Color capability detector ("no"/"off" parser) |
| `c1` | Boolean string normalizer ("no","off") |
| `xH` | Boolean string normalizer ("yes","on") |
| `Yr` | Terminal application detector (iTerm.app) |
| `a17` | tmux control-mode probe (spawnSync wrapper) |
| `o17` | Terminal name prefix checker |
| `N` | Logger / structured output emitter |
| `chK` | Debug-level log sink |
| `L3A` | Log transport layer |
| `H` | Random/timer utility (Math.random + setTimeout) |
| `RH` | JSON serializer for log entries |
| `_` | String case converter (toUpperCase) |
| `j4` | Log entry formatter / REDACTED replacer |
| `pOA` | Sensitive-key map builder |
| `ixH` | File-backed log writer |
| `NOA` | Raw write wrapper |
| `ihK` | Rotating log file manager |
| `GxH` | Write-coalescing buffer (setTimeout/setImmediate) |
| `xfH` | Log file path builder |
| `B6` | Error code classifier |
| `E16` | EISDIR error handler |
| `lOA` | Log file path joiner |
| `cOA` | Log file rotation (rename/unlink) |
| `nhK` | Log file append worker |
| `H9` | Signal/hook registry |
| `AY_` | Windows-SSH session detector |
| `s17` | Renderer mode dispatcher |
| `T6` | React/Ink render scheduler |
| `Dz6` | Ink render queue initializer |
| `wz6` | Ink render flush |
| `wHH` | Ink component re-renderer |
| `O88` | Render update coalescer |
| `b6` | Render frame timer |
| `bN8` | Background task list builder |
| `q96` | Task registry iterator |
| `T_` | App-state allowed-tools reader |
| `pZ8` | Allowed-tools list extractor |
| `sA` | App-state field accessor |
| `UZ8` | Disallowed-tools list extractor |
| `P$` | App-state general reader |
| `N9` | Session kind detector (daemon/daemon-worker) |
| `DOH` | Session kind string mapper |
| `c` | Telemetry event emitter base |
| `SzH` | Fullscreen mode resolver (resolveFullscreenMode) |
| `g_` | Settings persistence writer |
| `YO` | Settings file combo locator |
| `lr8` | Local-settings loader |
| `$P` | File content reader with encoding detection |
| `tn` | BOM/encoding-aware file reader |
| `R3` | File type classifier (FIFO/socket/char-dev) |
| `sU6` | File size guard |
| `tU6` | CRLF normalizer |
| `X8` | ENOENT error classifier |
| `J8` | EISDIR / file-error classifier |
| `li8` | Settings write-timestamp recorder |
| `hGH` | Settings directory + file path builder |
| `SF6` | .claude/settings.json path resolver |
| `c76` | Atomic file writer (randomBytes temp + rename) |
| `O` | Symbolic-link checker |
| `N8` | Node type classifier |
| `Xz` | Module registry cache clearer |
| `pB6` | gitignore-aware settings writer |
| `S6` | Async-context store reader |
| `aU6` | AsyncLocalStorage getter |
| `hi8` | Indent formatter |
| `mB6` | git check-ignore runner |
| `G_` | git subprocess wrapper |
| `v_4` | Path tilde-expander + absolutizer |
| `nvA` | git ls-files tracker |
| `ivA` | Write-ineffective warning emitter |
| `Tb` | .claude directory path builder |
| `SH` | gitignore_global_rule telemetry emitter |
| `e6` | write_ineffective telemetry emitter |
| `uH` | Settings write component |
| `yH` | Structured error logger |
| `l_` | Error-to-string converter |
| `_1` | Log entry formatter |
| `fZA` | xH alias (yes/on boolean parser) |
| `GH4` | Log ring-buffer manager |
| `RN` | Fullscreen-compatibility environment prober |
| `$Y6` | Terminal environment variable reader |
| `hD` | Terminal ID resolver |
| `nY_` | xterm.js version range checker |
| `nL7` | xterm.js version extractor |
| `pzH` | JetBrains / Cursor / VSCode terminal detector |
| `iL7` | Terminal version number parser (parseFloat + Math.min 20) |
| `iY_` | Terminal version string locator |
| `tb` | React/Ink application renderer wrapper |
| `qR` | Ink render bootstrap |
| `n_7` | Ink root element creator |
| `FO` | First-party auth checker |
| `C$` | Ink render options builder |
| `p76` | Ink stdin configurator |
| `X9` | Scrollback/alternate-screen renderer |
| `bH9` | Alternate-screen setup |
| `kD6` | Native addon loader (Bun FFI / dlopen) |
| `TR` | Terminal raw-mode enabler |
| `ID6` | Native addon file reader |
| `T4H` | Native feature support checker |
| `JKH` | Ink element key generator |
| `rF1` | Renderer relaunch orchestrator |
| `cPH` | Full relaunch implementation (flush → unmount → spawnSync → exit) |
| `Wh` | Claude binary path locator |
| `h28` | Claude versions-dir path builder |
| `L_H` | ~/.local/bin/claude path builder |
| `yf` | Array/value normalizer |
| `FI` | File existence checker |
| `y6` | Fv-based async delay |
| `Fv` | Promise/setTimeout micro-util |
| `TX6` | Interval-clear wrapper |
| `CE_` | clearInterval facade |
| `pNH` | Ink renderer unmount + write-sync |
| `$R` | Terminal restore-cursor writer |
| `lA8` | ESC-7/ESC-8 cursor save/restore writer |
| `D58` | Scroll-summary + Ink dismount orchestrator |
| `KZ` | Scroll position calculator |
| `Kj9` | Scroll summary renderer |
| `qj9` | Frame-rate limiter (Date.now + Math.max + Math.round) |
| `gL` | Promise.race timeout utility |
| `kT` | Hook registration wrapper |
| `h4` | H9 hook invoker |
| `TxH` | Write-queue drain awaiter |
| `w58` | Analytics flush with timeout race |
| `r8` | Abortable timeout promise |
| `xe_` | Post-relaunch path rebuilder |
| `aK` | Fv-based file-write async |
| `gF1` | Bun FFI / execve relaunch via native syscall |
| `$` | Ar1 module registry |
| `w` | Background-worker process manager |
| `f` | execve wrapper (YSH/EWK subprocess table) |
| `z` | Process environment merger |
| `EH` | Error string coercer |
| `LP` | Relaunch-error marker file writer |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.