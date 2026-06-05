---
type: feature-spec
feature: "tui"
cc_version: "2.1.163"
updated: "2026-06-05"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.163 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.163 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.163

---

## Overview

The `/tui` command allows users to switch the terminal UI renderer between `default` and `fullscreen` modes at runtime. It validates the requested mode against the set of valid options, enforces compatibility constraints (background task guards, environment-based automatic disabling), persists the chosen value to settings, and then relaunches the Claude Code process with the new renderer active.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| module_id | `M6K` |
| load_inline | `true` |
| loc_byte | `12384605` |
| loc_byte_end | `12384787` |
| loc_line | `8827` |
| arbor_handler.name | `Eyf` |
| arbor_handler.fqn | `claude-2.1.163::Eyf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.163 bundle.js:+12384605

---

## Input Branching

The handler has more than three distinct branches based on argument value, background-task guard, and automatic-disable conditions; a flowchart is used.

```mermaid
flowchart TD
    A(["/tui [arg]"]) --> B[Trim & normalize argument]
    B --> C{Argument provided?}
    C -- No --> D[Read current tui setting\nfrom settings layer]
    D --> E[Display current value\nand available options]
    C -- Yes --> F{Argument in valid set?\n'default' | 'fullscreen'}
    F -- No --> G[Display error:\nunrecognized value]
    F -- Yes --> H{Background tasks active?\nrunning / pending /\nremote_agent / mcp_task}
    H -- Yes --> I[Emit tengu_tui_refused\nDisplay cannot-switch error message]
    H -- No --> J{Auto-disable check:\ntmux -CC mode detected?}
    J -- Yes --> K[Warn: fullscreen disabled\ntmux-CC iTerm2 integration\nUnless CLAUDE_CODE_NO_FLICKER=1]
    J -- No --> L{Auto-disable check:\nWindows over SSH / ConPTY?}
    L -- Yes --> M[Warn: fullscreen disabled\nWindows SSH ConPTY\nUnless CLAUDE_CODE_NO_FLICKER=1]
    L -- No --> N[Resolve effective fullscreen mode\nvia fullscreen-mode evaluator]
    K --> N
    M --> N
    N --> O[Persist new tui value to settings]
    O --> P[Emit tengu_tui_command]
    P --> Q[Show info: background sessions\nalways use fullscreen renderer]
    Q --> R[Flush analytics / drain queue]
    R --> S[Relaunch process\nvia execve / spawnSync]
```

Analysis basis: CC v2.1.163 bundle.js:+12382503 (handler entry), +12383209 (task-state literals), +12383339 (refused message), +12382779 (valid-values check), +3439952 (tmux-CC warning), +3440138 (Windows SSH warning)

---

## Behavioral Spec

### 1. Argument Parsing

```
async function tuiCommandHandler(context):
    rawArg = context.args
    trimmedArg = rawArg.trim()                    // A.trim at +12382503
    normalized = trimmedArg.toLowerCase()         // f.toLowerCase at +16159989
    validModes = ["default", "fullscreen"]        // literals at +3440312, +3440286
```

Analysis basis: CC v2.1.163 bundle.js:+12382503, +16159989

---

### 2. No-Argument Path (Display Current Setting)

When no argument is supplied the handler reads the persisted `tui` setting through the settings loader (`loadSettingsHandler` — `M1`) and renders the current value together with the list of accepted values.

```
function displayCurrentTuiSetting(settingsLoader):
    settings = settingsLoader.load()              // M1 at +12382528
    currentValue = settings.tui ?? "default"
    print("Current renderer: " + currentValue)
    print("Valid options: default | fullscreen")
```

Analysis basis: CC v2.1.163 bundle.js:+12382528

---

### 3. Validation

```
function validateMode(normalized, validModes):
    joinedList = validModes.join(", ")            // vKA.join at +12382615
    if NOT validModes.includes(normalized):       // vKA.includes at +12382661
        print("Unknown value '" + normalized + "'. Choose: " + joinedList)
        return INVALID
    return VALID
```

Analysis basis: CC v2.1.163 bundle.js:+12382615, +12382661

---

### 4. Background-Task Guard

Before any renderer change is committed, the handler inspects all live sessions obtained from app-state (`appStateReader` — `R_`, `Q$`). If any session has a status of `"running"`, `"pending"`, `"remote_agent"`, or `"mcp_task"`, the switch is refused.

```
function checkNoActiveBackgroundTasks(appState):
    activeTasks = appState.sessions.filter(s =>
        s.status in {"running", "pending", "remote_agent", "mcp_task"})
    // literals at +12383209, +12383231, +12383252, +12383277
    if activeTasks.length > 0:
        emit("tengu_tui_refused")                 // telemetry at +12383298
        print("Cannot switch renderers while background tasks are running "
              "— wait for them to finish (or stop them via /tasks), "
              "then run /tui again.")             // literal at +12383339
        return BLOCKED
    return CLEAR
```

Analysis basis: CC v2.1.163 bundle.js:+12383209, +12383298, +12383339

---

### 5. Auto-Disable Compatibility Check

The fullscreen-mode evaluator (`fullscreenModeEvaluator` — `gDH`) applies the following rules in order. Each rule produces a named reason code that is recorded for diagnostics.

```
function evaluateFullscreenMode(requestedMode, environment):
    // tmux -CC (iTerm2 control-mode) detection
    isTmuxCC = detectTmuxControlMode()            // DNL/YNL at +3439088, +3439200
    // checks TERM_PROGRAM == "iTerm.app" at +3438944
    // and session prefix "screen" or "tmux" at +3439012, +3439037
    // and spawnSync("tmux", ["display-message", "-p", "#{client_control_mode}"]) at +3439222
    if isTmuxCC AND NOT env.CLAUDE_CODE_NO_FLICKER:
        reasonCode = "tmux_cc_auto_off"           // literal at +3440801
        warn("fullscreen disabled: tmux -CC (iTerm2 integration mode) detected "
             "· set CLAUDE_CODE_NO_FLICKER=1 to override")
                                                  // literal at +3439952

    // Windows over SSH detection
    isWindowsSSH = platform == "windows"          // literal at +3439506
                   AND sshDetected()
    if isWindowsSSH AND NOT env.CLAUDE_CODE_NO_FLICKER:
        reasonCode = "win_ssh_auto_off"           // literal at +3440835
        warn("fullscreen disabled: Windows over SSH (ConPTY re-rendering) detected "
             "· set CLAUDE_CODE_NO_FLICKER=1 to override")
                                                  // literal at +3440138

    // Environment overrides
    if env.CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN:  // literal at +12380363
        reasonCode = "env_off"                    // literal at +3440727
    if env.CLAUDE_CODE_NO_FLICKER:
        reasonCode = "env_off"
    if env.CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL:   // literal at +12380402
        reasonCode = "gb_on" / "gb_off"           // literals at +3441066, +3441074

    // Settings layer
    if userSettings.tui == "fullscreen":
        reasonCode = "settings_on"                // literal at +3440894
    if userSettings.tui == "default":
        reasonCode = "settings_off"               // literal at +3440928

    return { effectiveMode, reasonCode }
```

Analysis basis: CC v2.1.163 bundle.js:+3439088, +3439952, +3440138, +3440727, +3440801, +3440835, +12380338, +12380363, +12380402

---

### 6. Persist Setting and Relaunch

After compatibility checks pass, the handler writes the new value through the settings-persistence pipeline (`settingsPersist` — `r_`) and then relaunches the process.

```
async function persistAndRelaunch(newMode, context):
    // Persist to settings
    settingsPersist.write({ tui: newMode })       // r_ at +12383526

    // Emit telemetry with final effective mode
    emit("tengu_tui_command", {                   // telemetry at +12383770
        requested: newMode,
        effective: evaluatedResult.effectiveMode,
        reasonCode: evaluatedResult.reasonCode,
        uptime: Math.round(process.uptime())      // +12383872
    })

    // Background-session informational notice
    print("Background sessions always use the fullscreen renderer "
          "so scrolling and mouse work when attached. "
          "The tui setting applies to sessions started directly with `claude`.")
          // literal at +12382813

    // Analytics drain then relaunch
    await drainAnalyticsQueue()                   // OpH/MXA.drain at +12378403
    relaunchProcess()                             // D0H/execve at +12377788
```

Analysis basis: CC v2.1.163 bundle.js:+12383526, +12383770, +12383872, +12382813, +12378403, +12377788

---

### 7. Relaunch Sequence (`processRelaunchOrchestrator` — `D0H`)

The relaunch orchestrator performs a controlled teardown before exec-replacing the process:

```
async function processRelaunchOrchestrator(context):
    stat current working directory                // A6K.stat at +12378233
    stop any interval timers                      // D06/jS_/clearInterval at +12378307
    unmount ink/TUI components                    // JyH/H.unmount at +12378313
    scroll-summary flush                          // mO8/tengu_scroll_summary at +12378319
    await Promise.all([
        flush pending ops with timeout 30000ms,   // literal at +12378352
        "flush timeout (relaunch)"
    ])                                            // yL/Promise.race at +12378344
    await analyticsFlush(timeout=500ms)           // pO8 at +12378459, literal at +5447344
    removeAllListeners on process signals         // +12378854
    re-register SIGINT / SIGTERM / SIGHUP         // literals at +12378825,+12378834,+12378844
    spawnSync relaunch with "--resume" flag       // _6K.spawnSync at +12378911, "--resume" at +12378285
    writeFileSync crash context if spawn fails    // bJ at +12379133
    process.exit(128 + signal)                   // +12379160, literal 128 at +12379273
```

Analysis basis: CC v2.1.163 bundle.js:+12378233, +12378307, +12378331, +12378352, +12378459, +12378854, +12378911, +12379133, +12379160

---

### 8. Fullscreen Capability Detection (`terminalCapabilityProber` — `NI`)

Before the evaluated mode is applied, the terminal is probed for fullscreen capability:

```
function terminalCapabilityProber(env):
    // IDE terminal detection
    if env.TERM_PROGRAM in ["cursor", "vscode"]:  // literals at +3513386, +3513435
        return LIMITED
    if yvH.isJetBrainsIdeTerminal():              // +3512709
        return LIMITED

    // Platform specifics
    if platform == "darwin":                       // literal at +3512919
        checkMacOSTermSize()
    if platform == "win32":                        // literal at +3512966
        checkWindowsConPTY()

    // Terminal size measurement
    cols = measureTerminalCols()
    cappedCols = Math.min(cols, 20)               // SyL/Math.min at +3513882, literal 20 at +3513893
    return { capable: true, cols: cappedCols }
```

Analysis basis: CC v2.1.163 bundle.js:+3512641, +3512709, +3512781, +3513006, +3513893

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_tui_refused` | Fired when background tasks block the renderer switch (bundle.js:+12383298) |
| Telemetry: `tengu_tui_command` | Fired on every accepted invocation; carries requested mode, effective mode, reason code, and uptime (bundle.js:+12383770) |
| Telemetry: `tengu_scroll_summary` | Fired during the relaunch teardown to flush scroll state (bundle.js:+5447055) |
| Telemetry: `tengu_amber_creek` | Fired within the TUI-mode evaluator pipeline (bundle.js:+3440469) |
| Telemetry: `tengu_pewter_brook` | Fired within the TUI-mode evaluator pipeline (bundle.js:+3440377) |
| Telemetry: `tengu_feature_ok/sad/bad` | Fired by the feature-flag / settings subsystem during load (bundle.js:+1010222, +1010365, +1010284) |
| Settings write | Persists `tui: "default"` or `tui: "fullscreen"` to user/project settings via `r_` (bundle.js:+12383526) |
| Process relaunch | Replaces the current process via `execve` / `spawnSync` with `--resume` flag after analytics drain (bundle.js:+12378911) |
| Analytics drain | Calls `MXA.drain()` before relaunch; hard timeout 500 ms for analytics flush, 30 000 ms for general flush (bundle.js:+12378352, +12378459) |
| Signal handlers | Removes all existing listeners for `SIGINT`, `SIGTERM`, `SIGHUP` and re-registers them before exec-replace (bundle.js:+12378854) |
| Environment variables read | `CLAUDE_CODE_NO_FLICKER`, `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN`, `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL` (bundle.js:+12380338, +12380363, +12380402) |
| Background-task check | Reads session states from `appState` — blocks on `running`, `pending`, `remote_agent`, `mcp_task` (bundle.js:+12383209) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.163 | Initial analysis |

---

## Common Mistakes

1. **Running `/tui` while background tasks are active** — The command will refuse with a clear error message. Use `/tasks` to inspect or stop background sessions first, then retry `/tui`.
2. **Expecting fullscreen to work in tmux -CC (iTerm2 integration) mode** — The runtime auto-detects this configuration and silently downgrades to `default` unless `CLAUDE_CODE_NO_FLICKER=1` is exported.
3. **Expecting fullscreen over Windows SSH / ConPTY** — Same auto-disable applies; set `CLAUDE_CODE_NO_FLICKER=1` to override.
4. **Assuming the change takes effect without a restart** — The `/tui` command always triggers a full process relaunch (exec-replace with `--resume`). Any in-progress interactive operations will be interrupted.
5. **Expecting `/tui` to affect background daemon sessions** — Background sessions unconditionally use the fullscreen renderer regardless of the `tui` setting; the setting only governs sessions started interactively with `claude`.
6. **Omitting the argument** — Without an argument the command displays the current value and does not change anything.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Eyf` | Main handler for `/tui` command (AsyncFunction, arbor_handler) |
| `M1` | Settings loader — loads settings from disk |
| `ZHH` | Settings availability checker (has-check against loaded settings set) |
| `q2_` | Environment variable reader for fullscreen mode env flags |
| `eH` | String coercion / type-check helper |
| `mo` | Fullscreen auto-disable evaluator (tmux-CC / Windows SSH detection entry) |
| `DNL` | tmux control-mode sub-detector |
| `YNL` | Terminal prefix checker (`TERM_PROGRAM` startsWith check) |
| `gDH` | Effective fullscreen mode resolver (aggregates all reason codes) |
| `A2_` | Windows-over-SSH detector |
| `e_` | Settings persistence orchestrator |
| `DU` | Disk-based settings persistence driver |
| `g6_` | Settings load completion handler |
| `Kd` | Settings write dispatcher |
| `wNL` | TUI-mode state transition handler |
| `D6` | App-state update / session-state writer |
| `B98` | Session deduplication tracker |
| `S6` | Session-state commit helper |
| `QR8` | Argument parser / valid-mode option builder |
| `I46` | Option list formatter |
| `R_` | App-state reader for session list |
| `mk8` | Session working-directory extractor |
| `pk8` | Session tool-allow-list extractor |
| `Q$` | App-state reader for current session metadata |
| `Z9` | Daemon/daemon-worker mode detector |
| `GYH` | Process-mode string comparator |
| `r_` | Settings persistence pipeline (main writer) |
| `cO` | Settings path resolver entry |
| `HzH` | Settings file path builder |
| `Xl6` | Absolute path resolver for settings files |
| `FT4` | Settings file existence checker |
| `hx` | `.claude` directory path builder |
| `BT4` | Managed-settings path builder |
| `F6_` | Full settings load + merge pipeline |
| `SmA` | Ordered settings merge helper |
| `hmA` | Per-source settings loader |
| `qd` | Settings cache reader/writer |
| `BJA` | Settings cache getter |
| `FJA` | Settings cache setter |
| `kmA` | Inline SDK settings handler |
| `yx` | Settings source type resolver |
| `rOH` | Settings validation / schema checker |
| `oP` | CWD-relative settings path builder |
| `Zr` | Settings file reader (with BOM handling) |
| `R$` | Real-path resolver (symlink resolution) |
| `xd6` | Settings path normalizer |
| `ud6` | BOM stripper for settings file content |
| `R8` | Async file-read helper |
| `v8` | Async error-ignorant file-stat helper |
| `mH_` | Settings mutation timestamp recorder |
| `rTH` | Settings re-resolve trigger |
| `TM6` | Atomic file writer (temp-file + rename) |
| `sz` | Settings cache invalidator |
| `vc6` | gitignore-aware file write handler |
| `b6` | Async-storage context reader |
| `bd6` | AsyncLocalStorage store accessor |
| `X_` | Process context identifier |
| `WH_` | File-write pre-flight checker |
| `Nc6` | git check-ignore runner |
| `S_` | git subprocess runner |
| `ME4` | Home-directory path expander |
| `XxA` | git ls-files tracker |
| `NI` | Terminal capability prober (fullscreen support) |
| `sj6` | Terminal size reader |
| `FY` | Fallback terminal size provider |
| `t2_` | xterm.js version parser |
| `hyL` | xterm.js version string extractor |
| `Zz` | Terminal ANSI capability tester |
| `SyL` | Terminal column-count measurer |
| `e2_` | Terminal environment string reader |
| `Au` | React/Ink renderer factory |
| `LC` | Ink render mount helper |
| `dGL` | Ink output stream writer |
| `Z7` | Ink component tree builder |
| `H3` | Ink render lifecycle manager |
| `wM6` | Ink error boundary handler |
| `W9` | Telemetry / analytics flush pipeline |
| `lL9` | Analytics event serializer |
| `WIH` | Analytics HTTP sender |
| `EC` | Analytics payload builder |
| `XX6` | Analytics config file reader |
| `q7H` | Analytics endpoint selector |
| `e4H` | Analytics error logger |
| `f6K` | Process relaunch orchestrator entry (wrapper around `D0H`) |
| `D0H` | Core relaunch orchestrator (teardown → exec-replace) |
| `NS` | Claude binary path resolver |
| `PZ8` | Version-directory path builder |
| `H1H` | Local bin path builder |
| `K3` | Path-array flattener |
| `Uk` | CWD guard helper |
| `h6` | Promise-wrapping file-stat helper |
| `uv` | Generic async wrapper |
| `D06` | Interval-timer cancellation helper |
| `jS_` | clearInterval wrapper |
| `JyH` | Ink TUI unmount + cleanup |
| `YC` | Terminal cursor restore helper |
| `U48` | ANSI escape sequence emitter (save/restore cursor) |
| `mO8` | Scroll-state flush (emits `tengu_scroll_summary`) |
| `qE` | Scroll position reader |
| `RZ9` | Scroll buffer serializer |
| `SZ9` | Scroll metrics calculator |
| `yL` | Promise.race timeout helper |
| `ET` | Pending-operation awaiter |
| `d4` | Hook drain helper |
| `OpH` | Analytics queue drain (`MXA.drain`) |
| `pO8` | Final async flush coordinator |
| `l8` | Timeout-with-abort promise helper |
| `VKA` | Relaunch argument builder |
| `K4` | Relaunch env builder |
| `eHK` | execve / FFI exec-replace implementation |
| `w` | Background-session process manager |
| `M` | execve call dispatcher |
| `z` | Daemon stop helper |
| `EH` | String error formatter |
| `bJ` | Crash-context file writer |
| `hH` | stdout write helper |
| `P6` | UI print helper (stdout) |
| `Nu6` | ANSI color formatter |
| `RH` | stderr write helper |
| `kH` | Structured log emitter |
| `HA` | Error type guard |
| `Dq` | Log-level filter |
| `RSA` | Log record formatter |
| `HW4` | Rolling log buffer (shift/push) |
| `c` | Telemetry event batcher |
| `s6` | Telemetry event dispatcher |
| `SH` | JSON.stringify wrapper |
| `J4` | User-agent string builder |
| `g2A` | Platform/version string assembler |
| `ppH` | stdout buffered writer |
| `h2A` | stdout flush helper |
| `icK` | Conversation / transcript logger |
| `$pH` | Buffered transcript writer |
| `d3H` | Transcript file path builder |
| `aL6` | Transcript rotation helper |
| `r2A` | Transcript directory builder |
| `i2A` | Transcript file rotator |
| `ncK` | Transcript append-to-file handler |
| `j9` | Hook registration helper (`MXA.register`) |
| `Pw_` | HTTP header parser |
| `uj` | URL path sanitizer |
| `t1` | Response JSON parser |
| `H` | Bootstrap fetch handler |
| `e$` | Fetch response validator |
| `v` | Bootstrap config applicator |
| `ccK` | API endpoint builder |
| `OXA` | Request header assembler |
| `_` | Misc string / path utility |
| `A` | Argument normalizer (top-level, also used as generic local var) |
| `f` | Stream / file handle (generic local) |
| `q` | Generic queue / array local |
| `L` | Generic set / list local |
| `O` | Generic object local |
| `b8` | Background-session state helper |