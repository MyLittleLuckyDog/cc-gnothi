---
type: feature-spec
feature: "tui"
cc_version: "2.1.158"
updated: "2026-06-02"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.158 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.158 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.158

---

## Overview

The `/tui` command switches the terminal UI renderer between `default` and `fullscreen` modes at runtime. It validates the current session context and environment before performing the switch, blocking the change when background tasks are active or the session is a background/daemon session. After validation, it tears down the current renderer, relaunches the process with updated renderer flags, and emits a telemetry event recording the outcome.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| module_id | `ad1` |
| load_inline | `true` |
| loc_byte | `12111926` |
| loc_byte_end | `12112108` |
| loc_line | `8014` |
| arbor_handler.name | `jL5` |
| arbor_handler.fqn | `claude-2.1.158::jL5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.158 bundle.js:+12111926

---

## Input Branching

The command has more than three distinct decision branches (background-session guard, busy-task guard, unknown argument, environment auto-disable, and renderer apply), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/tui [arg]"]) --> B[Trim & normalise argument]
    B --> C{Is current session\na background/daemon session?}
    C -- Yes --> D["Return error:\n'Renderer switching isn't available\nin a background session…'"]
    C -- No --> E{Are background tasks\nrunning or pending?\nremote_agent / mcp_task / running / pending}
    E -- Yes --> F["Return error:\n'Cannot switch renderers while\nbackground tasks are running…'\nEmit tengu_tui_refused"]
    E -- No --> G{Argument value?}
    G -- '"fullscreen"' --> H[Resolve target = fullscreen]
    G -- '"default"' --> I[Resolve target = default]
    G -- empty/omitted --> J[Toggle: read current renderer,\nflip to the other value]
    G -- other string --> K["Return error:\nunrecognised value"]
    H & I & J --> L[Compute effective fullscreen state\nvia fullscreen-eligibility resolver]
    L --> M{Environment/settings\nauto-disable fullscreen?}
    M -- "tmux -CC detected &\nCLAUDE_CODE_NO_FLICKER not set" --> N["Warn: fullscreen disabled\n(tmux -CC iTerm2 integration mode detected)"]
    M -- "Windows-over-SSH detected &\nCLAUDE_CODE_NO_FLICKER not set" --> O["Warn: fullscreen disabled\n(Windows over SSH ConPTY re-rendering detected)"]
    M -- No auto-disable --> P[Proceed with target renderer]
    N & O & P --> Q[Persist renderer preference\nvia settings write path]
    Q --> R[Emit tengu_tui_command telemetry\nwith resolved renderer + reason code]
    R --> S[Initiate process relaunch\nvia relaunch handler od1/J2H]
    S --> T([Done — process restarts with new renderer])
```

Analysis basis: CC v2.1.158 bundle.js:+12109856, +12110026, +12110178, +12110542, +12110631, +12111103

---

## Behavioral Spec

### 1. Handler Entry — `tuiCommandHandler` (`jL5`)

```
async function tuiCommandHandler(context):
    rawArg = context.args.trim()                    // +12109856
    settingsBundle = loadSettingsBundle()           // calls settingsLoader +12109881
    appStateSnapshot = readAppState()               // calls appStateReader +12109892

    if isBackgroundOrDaemonSession(appStateSnapshot):
        // "daemon" / "daemon-worker" mode detected
        return errorMessage(
            "Renderer switching isn't available in a background session " +
            "— press ← to detach and run /tui from a foreground session."
        )                                           // +12110178

    activeTasks = collectActiveTasks(appStateSnapshot)
    // examines tasks with status in {"running","pending","remote_agent","mcp_task"}
    if activeTasks.length > 0:                     // +12110542..12110610
        emit("tengu_tui_refused")                  // +12110631
        return errorMessage(
            "Cannot switch renderers while background tasks are running " +
            "— wait for them to finish (or stop them via /tasks), then run /tui again."
        )                                           // +12110672

    currentRenderer = getCurrentRendererFromSettings(settingsBundle)
    targetRenderer  = resolveTargetRenderer(rawArg, currentRenderer)
    // +12110503 (Object.values over renderer options)

    effectiveRenderer = applyFullscreenEligibility(targetRenderer, environment)
    // +12110843 (calls fullscreenEligibilityResolver LYH)

    persistRendererPreference(effectiveRenderer, settingsBundle)
    // writes updated value through settings write path U_

    uptime = Math.round(process.uptime())          // +12111182, +12111193
    emit("tengu_tui_command", {
        renderer: effectiveRenderer,
        reason:   resolvedReasonCode,
        uptime:   uptime
    })                                             // +12111103

    relaunchProcess(context)                       // calls relaunchOrchestrator +12111541
```

Analysis basis: CC v2.1.158 bundle.js:+12109856

---

### 2. Target Renderer Resolution — `resolveTargetRenderer`

```
function resolveTargetRenderer(rawArg, currentRenderer):
    if rawArg == "fullscreen":
        return "fullscreen"                        // +3377623
    if rawArg == "default":
        return "default"                           // +3377649
    if rawArg == "":
        // toggle behaviour
        return (currentRenderer == "fullscreen") ? "default" : "fullscreen"
    throw new Error("unrecognised renderer value: " + rawArg)
```

Analysis basis: CC v2.1.158 bundle.js:+3377623, +3377649

---

### 3. Fullscreen Eligibility Resolver — `fullscreenEligibilityResolver` (`LYH`)

```
function fullscreenEligibilityResolver(targetRenderer, env):
    // Checks environment variable overrides and terminal-detection heuristics
    // Reason codes reported in telemetry: bg_forced_on, env_off, env_on,
    //   tmux_cc_auto_off, win_ssh_auto_off, settings_on, settings_off,
    //   downsell_on, gb_on, gb_off                    // +3378042..3378427

    if env.CLAUDE_CODE_NO_FLICKER is set:
        // override: honour explicitly requested renderer regardless of terminal
        return {renderer: targetRenderer, reason: "env_on" or "env_off"}

    if tmuxCCModeDetected():                          // P77 checks $TERM_PROGRAM, screen/tmux
        return {renderer: "default", reason: "tmux_cc_auto_off",
                warning: "fullscreen disabled: tmux -CC (iTerm2 integration mode) detected…"}
        // +3377289

    if windowsOverSSHDetected():                      // vD_ checks platform == "windows"
        return {renderer: "default", reason: "win_ssh_auto_off",
                warning: "fullscreen disabled: Windows over SSH (ConPTY re-rendering) detected…"}
        // +3377475

    // settings-based and gradual-rollout checks follow
    return {renderer: targetRenderer, reason: derivedReasonCode}
```

Analysis basis: CC v2.1.158 bundle.js:+12110843, +3378042, +3377289, +3377475

---

### 4. Background/Daemon Session Guard — `isDaemonSession`

```
function isDaemonSession(appState):
    sessionKind = appState.sessionKind   // reads v9 → QOH +12110164, +2201989
    return sessionKind == "daemon" or sessionKind == "daemon-worker"
                                         // +2201989, +2202003
```

Analysis basis: CC v2.1.158 bundle.js:+12110164, +2201989

---

### 5. Active Task Collector — `collectActiveTasks`

```
function collectActiveTasks(appState):
    // Iterates Object.values(appState.tasks) (+12110503)
    // Retains tasks whose status is one of:
    //   "running", "pending", "remote_agent", "mcp_task"
    //   +12110542, +12110564, +12110585, +12110610
    return tasks.filter(t =>
        ["running","pending","remote_agent","mcp_task"].includes(t.status)
    )
```

Analysis basis: CC v2.1.158 bundle.js:+12110503

---

### 6. Settings Write Path — `settingsWriter` (`U_`)

The settings writer is invoked to persist the new renderer preference. It handles:

- Loading existing settings from disk via the settings bundle loader (`Cp` / `va8`) (Analysis basis: CC v2.1.158 bundle.js:+1229371)
- Resolving the settings file path (`~/.claude/settings.json` or `settings.local.json`) (Analysis basis: CC v2.1.158 bundle.js:+1219331, +1219341)
- Atomic file write using a temporary file with permission preservation, random-byte temp suffix, and `renameSync` (Analysis basis: CC v2.1.158 bundle.js:+1012961)
- Emitting an error-level event on write failure (Analysis basis: CC v2.1.158 bundle.js:+1228501)
- Clearing relevant caches after write (`vz` clears `yC6` and `uu8`) (Analysis basis: CC v2.1.158 bundle.js:+1228984)

---

### 7. Process Relaunch Orchestrator — `relaunchOrchestrator` (`od1` → `J2H`)

```
async function relaunchOrchestrator(context):
    // 1. Collect CLI args carried forward: Lk8 reconstructs arg list
    //    including --add-dir, --allow-dangerously-skip-permissions,
    //    --effort, --permission-mode (+12107116..12107444)
    //    and the system/cliArg/session arg sources (+12107016, +12107037)
    argList = rebuildArgList(context)

    // 2. Flush pending analytics with 30 000 ms timeout (+12105659)
    await flushAnalytics(timeout=30000)

    // 3. Unmount current Ink/JSX renderer (zIH) (+12105620)
    unmountCurrentRenderer()

    // 4. Drain output queue (oxH → qOA.drain) (+12105710)
    await drainOutputQueue()

    // 5. Await analytics flush with 500 ms race (bf8) (+12105766, +12105777)
    await Promise.race([analyticsFlush, timeout(500)])

    // 6. Re-exec process via execve (Qd1 → M.execve) on Unix,
    //    or spawnSync (cd1.spawnSync) on Windows (+12106218)
    //    Signals SIGINT/SIGTERM/SIGHUP are removed before re-exec (+12106132..12106161)
    //    process.on("beforeExit","exit") listeners are reset (+12106191)
    execveOrSpawn(argList)

    // 7. On spawn error: write error file (HJ → TuH.writeFileSync) (+12106440)
    //    and exit with code 128 (+12106580) or process.kill (+12106532)
```

Analysis basis: CC v2.1.158 bundle.js:+12111541, +12105638, +12105659, +12106218

---

### 8. Terminal Compatibility Detector — `terminalCompatibilityCheck` (`aN`)

```
function terminalCompatibilityCheck():
    // Checks CHH (terminal program env vars) .includes(...) (+3449296)
    // Checks pY6.isJetBrainsIdeTerminal() (+3449325)
    // Platform checks: darwin (+3449535), win32 (+3449582)
    // IDE terminal checks: cursor (+3450002), vscode (+3450051)
    // xterm.js version range: 1092000..1105000 (+3450127, +3450138) → labelled "xterm.js" (+3450171)
    // Terminal width via WM7: parseFloat, Number.isNaN, Math.min(value, 20) (+3450453..3450509)
    // Returns compatibility descriptor used by eligibility resolver
    //
    // iTerm.app string (+3376265) is checked in P77 for tmux -CC detection
    // tmux display-message -p #{client_control_mode} spawnSync (+3376543..3376617)
    //   with 2000 ms timeout (+3376617) and utf8 encoding (+3376602)
```

Analysis basis: CC v2.1.158 bundle.js:+3449256, +3376265, +3376543

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_tui_command` | Fired on every successful renderer switch, carries resolved renderer and reason code (bundle.js:+12111103) |
| Telemetry: `tengu_tui_refused` | Fired when the switch is blocked because background tasks are active (bundle.js:+12110631) |
| Telemetry: `tengu_amber_creek` | Fired inside the fullscreen-eligibility resolver path (bundle.js:+3377806) |
| Telemetry: `tengu_pewter_brook` | Fired inside the fullscreen-eligibility resolver path (bundle.js:+3377714) |
| Telemetry: `tengu_feature_ok` | Generic feature success event emitted from settings-write success path (bundle.js:+966033) |
| Telemetry: `tengu_feature_bad` | Generic feature failure event from settings-write error path (bundle.js:+966091) |
| Telemetry: `tengu_feature_sad` | Generic feature sad-path event (bundle.js:+966168) |
| Telemetry: `tengu_scroll_summary` | Emitted during renderer teardown (scroll/unmount summary) (bundle.js:+5357253) |
| Settings write | Persists updated `terminalRenderer` (or equivalent) key to `~/.claude/settings.json` or `settings.local.json` via atomic rename (bundle.js:+1219341, +1219403) |
| Cache invalidation | `yC6` and `uu8` caches cleared after settings write (bundle.js:+26612, +26624) |
| Process re-exec | Handler relaunches the entire Claude Code process via `execve` (Unix) or `spawnSync` (Windows) with reconstructed arg list (bundle.js:+12106218) |
| Renderer teardown | Ink/JSX component unmounted, ANSI cursor-save/restore sequences emitted (`ESC 7` / `ESC 8`) before exit (bundle.js:+3716519, +3716530) |
| Signal listeners | `SIGINT`, `SIGTERM`, `SIGHUP` listeners removed from process before re-exec (bundle.js:+12106132) |
| Environment variables checked | `CLAUDE_CODE_NO_FLICKER`, `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN`, `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL` (bundle.js:+12107645, +12107670, +12107709) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.158 | Initial analysis |

---

## Common Mistakes

1. **Running `/tui` inside a background or daemon session** — the command will immediately reject with a message directing the user to detach first and run the command from a foreground session (bundle.js:+12110178).
2. **Running `/tui` while background tasks are active** — tasks with status `running`, `pending`, `remote_agent`, or `mcp_task` block the renderer switch; use `/tasks` to stop them first (bundle.js:+12110672).
3. **Expecting fullscreen to work under tmux with iTerm2 integration (`tmux -CC`)** — the runtime auto-detects this configuration and silently downgrades to `default`. Set `CLAUDE_CODE_NO_FLICKER=1` to override the guard (bundle.js:+3377289).
4. **Expecting fullscreen to work over Windows SSH (ConPTY)** — similarly auto-disabled; `CLAUDE_CODE_NO_FLICKER=1` overrides it (bundle.js:+3377475).
5. **Passing an unrecognised argument string** — only `default`, `fullscreen`, and the empty string (toggle) are valid; any other value results in an error.
6. **Assuming the renderer changes in-place** — the switch is implemented as a full process re-exec; any unsaved transient state is lost. Ensure work is committed before switching renderers.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `jL5` | Main async handler for `/tui` command (`tuiCommandHandler`) |
| `B_` | Settings bundle initialiser / loader bootstrap |
| `Cp` | Settings-from-disk loader (calls `loadSettingsFromDisk_start` / `_end` markers) |
| `DZ` | Settings disk loader sub-step A |
| `Z9` | Settings disk loader sub-step B (perf_hooks, memory usage) |
| `Ib` | Dynamic `require` inside settings loader |
| `va8` | Settings aggregator (merges flag/policy/user/project/local layers) |
| `w8` | Log/append-file utility used by settings loader |
| `SC6` | Settings layer combiner helper |
| `X56` | Flag-settings applicator (flagSettings / policySettings) |
| `fhA` | Settings object merger (Object.keys iteration) |
| `K` | Column-pad helper (padEnd 40) |
| `E3H` | Settings file path resolver (userSettings / projectSettings / localSettings) |
| `MQ` | Settings merge/write helper |
| `qhA` | SDK inline-settings handler |
| `$Q` | Settings object constructor (assembles final settings bundle) |
| `O_` | Settings primitive reader |
| `t96` | Settings field accessor A |
| `im8` | Settings field accessor B |
| `r96` | Settings field accessor C |
| `tWH` | Settings field accessor D |
| `eWH` | Settings field accessor E |
| `H16` | Settings field accessor F |
| `W3H` | Settings field accessor G |
| `G3H` | Settings field accessor H |
| `Xa8` | Settings field accessor I |
| `gyA` | Settings field accessor J |
| `Si` | Settings field accessor K |
| `P56` | WSL/platform detection helper |
| `hC6` | Settings post-process finaliser |
| `Aq` | App-state reader and environment probe orchestrator |
| `B$H` | Feature-flag cache checker |
| `ND_` | Colour/display string formatter A |
| `y1` | String coercer A |
| `CH` | String coercer B (used widely for string normalisation) |
| `mr` | Terminal colour/renderer resolver |
| `W77` | tmux control-mode detector (runs `tmux display-message`) |
| `P77` | iTerm.app / screen / tmux `$TERM_PROGRAM` prefix checker |
| `N` | Logging/telemetry emit utility |
| `lCK` | Log channel builder |
| `LOA` | Log sink router |
| `H` | Miscellaneous runtime helper (Math.random, setTimeout) |
| `RH` | JSON.stringify wrapper for logging |
| `v4` | Path/string utility (lastIndexOf, slice, replace) |
| `pYA` | BCK map iterator utility |
| `EuH` | Output write helper |
| `NYA` | Raw terminal write helper |
| `rCK` | Structured log writer (file-based) |
| `rxH` | Output batching / debounce writer |
| `M$H` | Log file path builder |
| `g6` | Generic logger utility |
| `KK6` | Log rotation helper |
| `lYA` | Log file path joiner |
| `cYA` | Log file rotation (stat/rename/unlink) |
| `iCK` | Log file append worker |
| `q9` | Output queue register |
| `vD_` | Windows platform detector |
| `G77` | Fullscreen eligibility orchestrator |
| `G6` | Renderer state machine / fullscreen gate |
| `sz6` | Renderer state field A |
| `tz6` | Renderer state field B |
| `Ex` | Renderer option encoder |
| `q_8` | Renderer deduplication / seen-set manager |
| `S6` | Renderer apply / commit function |
| `Lk8` | CLI arg list reconstructor for re-exec |
| `U96` | Arg reconstruction helper |
| `V_` | App-state field reader (working_directory, allowed_tools, disallowed_tools) |
| `LV8` | App-state sub-field reader A |
| `aA` | App-state base accessor |
| `fV8` | App-state sub-field reader B |
| `y$` | App-state effort/model/flag_settings reader |
| `v9` | Session-kind reader (daemon / daemon-worker check) |
| `QOH` | Session kind resolver |
| `d` | Generic telemetry feature event emitter (ok/bad/sad) |
| `LYH` | Fullscreen-eligibility resolver (reason-code producer) |
| `U_` | Settings write path / atomic settings writer |
| `ZO` | Settings write bootstrap |
| `Va8` | Settings re-aggregator used by writer |
| `jP` | File-system helper for settings write |
| `Ni` | File reader utility (BOM detection, CRLF/LF, readFileSync) |
| `F$` | File stat / lstat / realpath utility |
| `rB6` | File read sub-helper |
| `oB6` | File content post-processor |
| `P8` | Error code classifier (ENOENT / EISDIR) |
| `J8` | Error code string extractor |
| `Go8` | Settings timestamp updater (`gF6.set`, `Date.now`) |
| `iGH` | Settings invalidation helper |
| `Ig6` | Settings path resolver (NN.resolve / dirname) |
| `hL6` | Atomic file writer (openSync, writeFileSync, fchmodSync, fsyncSync, renameSync, unlinkSync) |
| `O` | Symbolic-link checker |
| `I8` | Link-check utility |
| `vz` | Cache clear utility (clears `yC6` and `uu8`) |
| `uF6` | gitignore / file-tracking utility |
| `h6` | Async-local-storage context reader |
| `iB6` | Store getter (`nB6.getStore`) |
| `Ao8` | k4 initialiser utility |
| `xF6` | git check-ignore runner |
| `G_` | Git subprocess runner |
| `v94` | Path expander (tilde, absolute, homedir) |
| `iIA` | git ls-files tracker |
| `rIA` | gitignore append helper |
| `lb` | `.claude` directory path builder |
| `hH` | Feature telemetry ok emitter wrapper |
| `t6` | Feature telemetry sad emitter wrapper |
| `bH` | Feature telemetry bad emitter wrapper |
| `SH` | Structured error logger (Vi.logError, YpH.push) |
| `F_` | Error string formatter |
| `L1` | Error display renderer |
| `$VA` | Error message string builder |
| `G_4` | Error history queue manager (gB6 shift/push) |
| `aN` | Terminal compatibility / IDE detection orchestrator |
| `rY6` | Terminal detection sub-helper A |
| `FD` | Terminal detection sub-helper B |
| `Gw_` | xterm.js version-range checker |
| `PM7` | xterm.js version resolver |
| `VY` | JetBrains terminal detector |
| `WM7` | Terminal width safety capper (Math.min value 20) |
| `Tw_` | Terminal width raw reader |
| `Zx` | React/Ink renderer root |
| `NR` | Ink render orchestrator |
| `D97` | Ink component builder |
| `NO` | Ink WA integrator |
| `u3` | Ink sub-renderer A |
| `ZL6` | Ink sub-renderer B |
| `N9` | Telemetry consent / feedback eligibility checker |
| `o89` | Telemetry pipeline entry |
| `ww6` | Telemetry batch sender |
| `QR` | Telemetry HTTP client |
| `Dw6` | Telemetry file reader |
| `c4H` | Telemetry filter (enterprise/team check) |
| `gKH` | Telemetry CH-string normaliser |
| `od1` | Relaunch orchestrator entry point |
| `J2H` | Process relaunch implementation (exec/spawn, signal handling, flush) |
| `ch` | Claude version path resolver |
| `aW8` | Claude binary path helper |
| `Q_H` | Local bin path helper |
| `l$` | Array.isArray utility |
| `$k` | Relaunch arg carrier |
| `I6` | qN path joiner |
| `qN` | Path join primitive |
| `$P6` | clearInterval wrapper |
| `Xv_` | Interval clear helper |
| `zIH` | Ink renderer unmount handler |
| `SR` | Renderer shutdown sequence helper |
| `Fq8` | ANSI escape sequence emitter (ESC 7 / ESC 8 cursor save/restore) |
| `Cf8` | Scroll summary and Aq orchestrator |
| `JZ` | Scroll sub-helper A |
| `uX9` | Scroll sub-helper B |
| `xX9` | Frame timing calculator (Date.now, Math.max, Math.round, Object.assign) |
| `tL` | Promise.race timeout utility |
| `FT` | Pre-exit flush trigger |
| `U4` | Exit flush queue runner |
| `oxH` | Output queue drain (qOA.drain) |
| `bf8` | Analytics flush with race timeout (500 ms) |
| `g8` | Timeout-with-abort promise utility |
| `C6A` | Relaunch context builder (O_, id1.dirname, CO, UK) |
| `UK` | qN path utility wrapper |
| `Qd1` | execve / re-exec implementation (bun:ffi, libc execve, Buffer, BigInt) |
| `$` | $s1 push carrier |
| `w` | Background session / worker process manager |
| `M` | Temp-dir cleanup manager (nS6, q0.rm) |
| `z` | Daemon stop handler (hH, bH, Sy, Fm) |
| `EH` | String error formatter |
| `HJ` | Relaunch error file writer (TuH.writeFileSync) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.