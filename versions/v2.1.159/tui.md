---
type: feature-spec
feature: "tui"
cc_version: "2.1.159"
updated: "2026-06-02"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.159 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.159 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.159

---

## Overview

The `/tui` command lets the user switch the terminal UI renderer between `default` and `fullscreen` modes during an active session. It validates the requested mode against a set of environment and session pre-conditions, emits telemetry describing the outcome, and — when switching is permitted — tears down the current renderer, relaunches the process under the new renderer, and restores session state.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| module_id | `Kc1` |
| load_inline | `true` |
| loc_byte | `12113613` |
| loc_byte_end | `12113795` |
| loc_line | `8014` |
| arbor_handler.name | `VL5` |
| arbor_handler.fqn | `claude-2.1.159::VL5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.159 bundle.js:+12113613

---

## Input Branching

The command has more than three distinct paths depending on (a) session type, (b) active background tasks, (c) environment detection, and (d) the mode argument value. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/tui [arg]"]) --> B[Trim & normalize argument]
    B --> C{Session type?}

    C -->|daemon or daemon-worker| D["Reject: renderer switching\nunavailable in background session\n(bundle.js:+12111865)"]
    D --> Z([emit tengu_tui_refused\nreturn error message])

    C -->|foreground session| E[Collect active tasks via Object.values]
    E --> F{Any task in running/pending/\nremote_agent/mcp_task state?}

    F -->|Yes| G["Reject: cannot switch while\nbackground tasks are running\n(bundle.js:+12112359)"]
    G --> Z

    F -->|No| H[Resolve effective fullscreen mode\nvia fYH / fullscreen-decision logic]

    H --> I{Argument supplied?}

    I -->|"fullscreen"| J[Desired mode = fullscreen]
    I -->|"default"| K[Desired mode = default]
    I -->|empty / omitted| L[Desired mode = toggle current mode]

    J & K & L --> M{Validate environment\nvia rN / terminal detection}

    M -->|tmux -CC detected\nand NO_FLICKER not set| N["Warn: fullscreen disabled\n(tmux -CC / iTerm2)\n(bundle.js:+3378033)"]
    M -->|Windows-over-SSH detected\nand NO_FLICKER not set| O["Warn: fullscreen disabled\n(Windows SSH / ConPTY)\n(bundle.js:+3378219)"]
    M -->|Environment clear| P[Proceed with mode switch]

    N & O --> P2([emit tengu_tui_command\nreturn warning to user])

    P --> Q[emit tengu_tui_command\n(bundle.js:+12112790)]
    Q --> R[Flush analytics via xf8\nwith 500 ms timeout\n(bundle.js:+5358806)]
    R --> S[Tear down current renderer\nvia X2H / qc1 pipeline]
    S --> T[Relaunch process under\nnew renderer via ad1 / execve]
    T --> U([New process inherits\nsession state])
```

Analysis basis: CC v2.1.159 bundle.js:+12111543 through +12113329

---

## Behavioral Spec

### 1. Handler Entry and Argument Parsing

The async handler `VL5` is the primary entry point (Arbor resolution path: `module_id → Kc1 → VL5`).

```
async function tuiHandler(context):
    rawArg = context.args
    trimmedArg = rawArg.trim()                  // bundle.js:+12111543
    normalizedArg = trimmedArg.toLowerCase()    // bundle.js:+15495154

    loadSettings()                              // via settingsInitializer (B_/Cp)
    initTelemetryPipeline()                     // via telemetryInit (qq)
```

Analysis basis: CC v2.1.159 bundle.js:+12111543

---

### 2. Background-Session Guard

```
function checkSessionType(appState):
    sessionKind = appState.getSessionKind()
    if sessionKind == "daemon" or sessionKind == "daemon-worker":
        // bundle.js:+12111865
        return Error(
            "Renderer switching isn't available in a background " +
            "session — press ← to detach and run /tui from a " +
            "foreground session."
        )
    return OK
```

Analysis basis: CC v2.1.159 bundle.js:+12111865

---

### 3. Active-Task Guard

```
function checkNoActiveTasks(taskMap):
    blockedStates = ["running", "pending", "remote_agent", "mcp_task"]
    // bundle.js:+12112229 through +12112297

    for each task in Object.values(taskMap):       // bundle.js:+12112190
        if task.status in blockedStates:
            emit("tengu_tui_refused")              // bundle.js:+12112318
            return Error(
                "Cannot switch renderers while background tasks are " +
                "running — wait for them to finish (or stop them via " +
                "/tasks), then run /tui again."    // bundle.js:+12112359
            )
    return OK
```

Analysis basis: CC v2.1.159 bundle.js:+12112190

---

### 4. Fullscreen-Mode Decision (`fYH`)

The function `fYH` (fullscreen mode resolver) evaluates a priority-ordered chain of signals to determine the effective fullscreen setting. Each signal corresponds to a named source string found in the literals:

```
function resolveFullscreenMode(rawArg, envVars, settings, featureFlags):
    // Priority order (highest → lowest):

    if envVar("CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN") is set:
        return { mode: "default", reason: "env_off" }      // bundle.js:+3378816

    if envVar("CLAUDE_CODE_NO_FLICKER") forces on:
        return { mode: "fullscreen", reason: "bg_forced_on" } // bundle.js:+3378786

    if envVar sets fullscreen explicitly on:
        return { mode: "fullscreen", reason: "env_on" }    // bundle.js:+3378874

    if tmuxControlModeDetected():                           // via k77/I77
        return { mode: "default", reason: "tmux_cc_auto_off" } // bundle.js:+3378898

    if windowsOverSSHDetected():                           // via SD_
        return { mode: "default", reason: "win_ssh_auto_off" } // bundle.js:+3378932

    if settings.fullscreen == true:
        return { mode: "fullscreen", reason: "settings_on" } // bundle.js:+3378991

    if settings.fullscreen == false:
        return { mode: "default", reason: "settings_off" } // bundle.js:+3379025

    if featureFlag("downsell") active:
        return { mode: "default", reason: "downsell_on" }  // bundle.js:+3379098

    if gradualRollout.enabled:
        return { mode: "fullscreen", reason: "gb_on" }     // bundle.js:+3379163
    else:
        return { mode: "default", reason: "gb_off" }       // bundle.js:+3379171
```

Analysis basis: CC v2.1.159 bundle.js:+3378786 through +3379171

---

### 5. Terminal Environment Detection (`rN`)

```
function detectTerminalEnvironment():
    // JetBrains terminal check
    if QY6.isJetBrainsIdeTerminal():                  // bundle.js:+3450069
        // IDE-embedded terminal path

    // Embedded IDE check (Cursor / VSCode)
    envTermProgram = process.env.TERM_PROGRAM
    if envTermProgram in ["cursor", "vscode"]:         // bundle.js:+3450746,+3450795
        // Embedded terminal path via Nw_/IM7

    // OS detection
    platform = process.platform
    if platform == "darwin":                           // bundle.js:+3450279
        // macOS-specific path via kY
    if platform == "win32":                            // bundle.js:+3450326
        // Windows path

    // tmux control mode detection via k77
    if terminalProgram.startsWith("screen") or
       terminalProgram.startsWith("tmux"):             // bundle.js:+3377077,+3377102
        result = spawnSync("tmux", ["display-message", "-p",
                                    "#{client_control_mode}"],
                           { timeout: 2000, encoding: "utf8" }) // bundle.js:+3377361
        if result indicates control mode:
            return { isTmuxCC: true }

    // Windows SSH detection via SD_
    if platform == "windows":                          // bundle.js:+3377571
        return { isWindowsSSH: true }

    return { isTmuxCC: false, isWindowsSSH: false }
```

Analysis basis: CC v2.1.159 bundle.js:+3450040

---

### 6. Effective Mode Resolution from CLI Argument

```
function resolveRequestedMode(normalizedArg, currentMode):
    validModes = ["fullscreen", "default"]      // bundle.js:+3378367,+3378393

    if normalizedArg == "fullscreen":
        return "fullscreen"
    if normalizedArg == "default":
        return "default"
    if normalizedArg is empty:
        return toggle(currentMode)              // flip current renderer

    // unknown argument → show usage / error
    validList = validModes.join(", ")           // bundle.js:+12111667
    if normalizedArg not in validModes:         // bundle.js:+12111713
        return UsageError(validList)
```

Analysis basis: CC v2.1.159 bundle.js:+12111667

---

### 7. Settings Initialization (`B_` / `Cp` pipeline)

```
function loadSettings():
    // Performance mark: "loadSettingsFromDisk_start"  bundle.js:+1226870
    loadFlagSettings()           // "flagSettings"     bundle.js:+1215869
    loadPolicySettings()         // "policySettings"   bundle.js:+1215891
    loadUserSettings()           // "userSettings"     bundle.js:+1219077
    loadProjectSettings()        // "projectSettings"  bundle.js:+1219128
    loadLocalSettings()          // "localSettings"    bundle.js:+1219150
    loadSDKInlineSettings()      // "SDK inline settings" bundle.js:+1218149
    // Performance mark: "loadSettingsFromDisk_end"    bundle.js:+1226926
    // Telemetry: "settings_load_completed"            bundle.js:+1224214
```

Analysis basis: CC v2.1.159 bundle.js:+1226537

---

### 8. Renderer Relaunch Sequence (`qc1` / `X2H` pipeline)

```
async function switchRenderer(newMode, sessionState):
    // 1. Stat current session file                    bundle.js:+12107227
    // 2. Tear down active background-session tracking
    //    via wIH (unmount Ink tree, clear write buffers)
    //    bundle.js:+5357049

    // 3. Flush scroll summary telemetry
    //    emit("tengu_scroll_summary")                 bundle.js:+5358517

    // 4. Start analytics drain with timeout
    //    await Promise.race([analyticsFlush(), timeout(30000)])
    //    label: "flush timeout (relaunch)"            bundle.js:+12107352

    // 5. Drain I/O queue
    //    await drain()  label: "cleanup timeout"      bundle.js:+12107408

    // 6. Flush analytics with 500 ms guard
    //    await Promise.race([analyticsFlush(), timeout(500)]) bundle.js:+5358806

    // 7. Remove all process signal listeners
    //    process.removeAllListeners(...)               bundle.js:+12107848
    //    Re-register: SIGINT, SIGTERM, SIGHUP          bundle.js:+12107819

    // 8. Resolve new binary path and build argv
    //    including --resume flag                       bundle.js:+12107279
    //    mode-specific environment variables

    // 9. Write relaunch-error sentinel file via tj     bundle.js:+12108127
    //    on failure emit: "relaunch_spawn_error"       bundle.js:+12108130

    // 10. execve into new process via ad1 / M.execve
    //     stdio: "inherit"                             bundle.js:+12107940
    //     process.exit fallback                        bundle.js:+12108154
```

Analysis basis: CC v2.1.159 bundle.js:+12107133

---

### 9. Telemetry Emission for `/tui` Command

```
function emitTuiCommandTelemetry(resolvedMode, decisionReason,
                                  sessionUptime):
    emit("tengu_tui_command", {               // bundle.js:+12112790
        mode:    resolvedMode,
        reason:  decisionReason,
        uptime:  Math.round(process.uptime()) // bundle.js:+12112880
    })
```

For refused invocations:

```
function emitTuiRefused(reason):
    emit("tengu_tui_refused", { reason })     // bundle.js:+12112318
```

Analysis basis: CC v2.1.159 bundle.js:+12112790

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — tui command | `tengu_tui_command` (bundle.js:+12112790) — emitted on every permitted invocation with resolved mode and uptime |
| Telemetry — tui refused | `tengu_tui_refused` (bundle.js:+12112318) — emitted when the command is blocked (background session or active tasks) |
| Telemetry — fullscreen mode A/B | `tengu_amber_creek` (bundle.js:+3378550), `tengu_pewter_brook` (bundle.js:+3378458) — gradual-rollout arm tracking for fullscreen feature |
| Telemetry — feature outcome | `tengu_feature_ok` (bundle.js:+966033), `tengu_feature_sad` (bundle.js:+966168), `tengu_feature_bad` (bundle.js:+966091) — generic feature health signals |
| Telemetry — scroll summary | `tengu_scroll_summary` (bundle.js:+5358517) — fired during renderer teardown |
| Telemetry — background dispatch | `tengu_bg_dispatch_sigkill_escalate` (bundle.js:+15469493), `tengu_bg_dispatch_low_mem` (bundle.js:+15470072) |
| Telemetry — spare session | `tengu_bg_spare_enable` (bundle.js:+15470767), `tengu_bg_spare_claim` (bundle.js:+15470888), `tengu_bg_spare_claim_fail` (bundle.js:+15471151) |
| Telemetry — daemon control | `tengu_daemon_control` (bundle.js:+15505330) |
| Settings load | Reads `flagSettings`, `policySettings`, `userSettings`, `projectSettings`, `localSettings`, `SDK inline settings` from disk on every invocation (bundle.js:+1226537) |
| appState changes | Reads session kind and task map; does not mutate app state directly — triggers renderer change via process re-exec |
| Process re-exec | Calls `M.execve` (or `process.exit` fallback) replacing the running process when renderer switch proceeds (bundle.js:+12106782) |
| Signal handler reset | `process.removeAllListeners()` followed by re-registration of SIGINT/SIGTERM/SIGHUP before execve (bundle.js:+12107848) |
| Relaunch sentinel file | Written by `tj` (bundle.js:+12108127) — used to detect failed relaunch on next startup |
| Analytics flush | Two-stage flush: 30 s guard before teardown (bundle.js:+12107346), then 500 ms guard just before execve (bundle.js:+5358806) |
| Environment variables checked | `CLAUDE_CODE_NO_FLICKER`, `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN`, `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL` (bundle.js:+12109332–+12109396) |
| Sound | None observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.159 | Initial analysis |

---

## Common Mistakes

1. **Running `/tui` inside a background/daemon session** — The command immediately rejects with an explanatory message (`bundle.js:+12111865`). Detach to a foreground session first.
2. **Running `/tui` while background tasks are active** — Any task in `running`, `pending`, `remote_agent`, or `mcp_task` state blocks the switch (`bundle.js:+12112359`). Use `/tasks` to stop them.
3. **Expecting fullscreen to work in tmux `-CC` mode without `CLAUDE_CODE_NO_FLICKER=1`** — The runtime auto-detects tmux control mode via `spawnSync` with a 2 000 ms timeout (`bundle.js:+3377361`) and downgrades to `default` automatically.
4. **Expecting fullscreen to work over Windows SSH (ConPTY)** — Same auto-downgrade applies (`bundle.js:+3378219`). Set `CLAUDE_CODE_NO_FLICKER=1` to override.
5. **Passing an unrecognized mode string** — Only `default` and `fullscreen` are valid (`bundle.js:+12111713`). Any other value triggers a usage error listing valid options.
6. **Assuming `/tui` is instant** — The command performs a full process re-exec including a 30 s analytics flush (`bundle.js:+12107346`). Do not interrupt the terminal during this window.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `VL5` | Main `/tui` async handler (Arbor FQN: `claude-2.1.159::VL5`) |
| `A` | Argument string (trim target) |
| `f` | Stream / file handle (close target in teardown) |
| `q` | Secondary stream / set used in teardown and task checks |
| `L` | Async task tracker (add/delete/finally) |
| `B_` | Settings bootstrap initiator |
| `Cp` | Settings loader orchestrator |
| `DZ` | Settings sub-loader A |
| `E9` | Performance-mark / memory snapshot helper |
| `Sb` | Module loader (`require` wrapper) |
| `ka8` | Settings load coordinator |
| `Y8` | File-append logger |
| `RC6` | Settings reload trigger |
| `G56` | Flag-settings loader |
| `whA` | Policy-settings loader |
| `K` | Column formatter (padEnd) |
| `E3H` | User-settings file path resolver |
| `fQ` | Project-settings loader |
| `zhA` | SDK-inline settings loader |
| `MQ` | Composite settings assembler |
| `O_` | Base settings object factory |
| `_16` | Settings field: unknown sub-loader |
| `am8` | Settings field: unknown sub-loader |
| `s96` | Settings field: unknown sub-loader |
| `_0H` | Settings field: unknown sub-loader |
| `A0H` | Settings field: unknown sub-loader |
| `q16` | Settings field: unknown sub-loader |
| `W3H` | Settings field: unknown sub-loader |
| `G3H` | Settings field: unknown sub-loader |
| `Ga8` | Settings field: unknown sub-loader |
| `ryA` | Settings field: unknown sub-loader |
| `xi` | Settings field: unknown sub-loader |
| `T56` | WSL-platform settings adjuster |
| `SC6` | Settings post-processor |
| `qq` | Telemetry pipeline initializer |
| `B$H` | Telemetry dedup filter |
| `RD_` | Telemetry event formatter P1 |
| `P1` | String coercer for telemetry |
| `CH` | Core string coercer |
| `Fr` | Terminal-type reporter |
| `k77` | tmux control-mode probe |
| `I77` | iTerm.app / screen prefix checker |
| `N` | Log writer (debug / info levels) |
| `tCK` | Log transport |
| `DOA` | Log level dispatcher |
| `H` | Random / timer utility (also used as stream handle in various contexts) |
| `RH` | JSON serializer |
| `_` | Generic utility (toUpperCase / readFileSync context) |
| `E4` | Log-line formatter |
| `cYA` | ANSI color map |
| `vuH` | stdout write helper |
| `CYA` | Raw write wrapper |
| `_bK` | File-based log sink |
| `axH` | Buffered-write scheduler |
| `M$H` | Log-file path builder |
| `g6` | Logger instance |
| `MK6` | Error-code classifier |
| `tYA` | Log directory path resolver |
| `sYA` | Log file rotation helper |
| `HbK` | Async log flush/append |
| `K9` | I/O drain registrar |
| `SD_` | Windows-platform renderer guard |
| `y77` | Fullscreen feature orchestrator |
| `G6` | Fullscreen mode evaluator (reads feature flags + gradual rollout) |
| `AY6` | Feature-flag fetcher A |
| `qY6` | Feature-flag fetcher B |
| `Ix` | Feature-flag value resolver |
| `K_8` | Gradual-rollout membership checker |
| `h6` | Gradual-rollout evaluator |
| `fk8` | CLI-argument normalizer for session options |
| `g96` | CLI-arg sub-parser |
| `E_` | App-state working-directory extractor |
| `fV8` | App-state allowed-tools reader |
| `aA` | App-state accessor base |
| `MV8` | App-state disallowed-tools reader |
| `h$` | App-state secondary reader |
| `N9` | Daemon-mode checker |
| `QOH` | Session-kind resolver |
| `d` | Generic app-state value reader |
| `fYH` | Fullscreen mode decision function (returns mode + reason string) |
| `U_` | Settings persistence writer |
| `VO` | Settings path resolver for write |
| `Ia8` | Settings write orchestrator |
| `jP` | File read+parse helper |
| `hi` | File encoding detector and reader |
| `Q$` | Path canonicalizer (lstat + realpath) |
| `oB6` | File-read sub-helper |
| `aB6` | File-content post-processor |
| `P8` | Error wrapper |
| `w8` | ENOENT/EISDIR error classifier |
| `Eo8` | Settings write-time stamper |
| `aGH` | Settings atomic-write coordinator |
| `kg6` | Settings file path builder |
| `CL6` | Atomic file writer (temp + rename) |
| `O` | Symbolic-link stat checker |
| `k8` | Stat result type helper |
| `vz` | Cache invalidator |
| `mF6` | Gitignore-awareness file writer |
| `R6` | Context-store reader |
| `rB6` | AsyncLocalStorage getter |
| `Lo8` | Gitignore check helper |
| `uF6` | Git ignore-check runner |
| `T_` | Git command executor |
| `R94` | Path normalizer (home-dir tilde expansion) |
| `HkA` | Git ls-files tracker check |
| `_kA` | Gitignore write-guard helper |
| `ob` | `.claude` directory path builder |
| `hH` | App-state getter (feature-ok path) |
| `t6` | App-state getter (feature-sad path) |
| `bH` | App-state getter (feature-bad path) |
| `SH` | Structured error handler / reporter |
| `F_` | Error string coercer |
| `L1` | Error renderer |
| `JVA` | Error message formatter |
| `I_4` | Error queue (shift/push) |
| `rN` | Terminal environment detector |
| `eY6` | Terminal capability probe |
| `FD` | Terminal feature descriptor |
| `Nw_` | Embedded-IDE terminal handler (Cursor/VSCode) |
| `IM7` | xterm.js version range checker |
| `kY` | macOS-specific terminal handler |
| `kM7` | Terminal version parser (parseFloat + Math.min) |
| `Iw_` | IDE terminal version extractor |
| `Nx` | React/Ink renderer wrapper |
| `RR` | Ink render entry |
| `Z97` | Ink component factory |
| `kO` | Ink subscription handler |
| `u3` | Ink render context |
| `vL6` | Ink error boundary |
| `I9` | Product-feedback gate |
| `A_9` | Feedback config loader |
| `Ww6` | Feedback display orchestrator |
| `rR` | Feedback component renderer |
| `Pw6` | Feedback file reader |
| `F4H` | Feedback eligibility checker |
| `pKH` | Feedback string formatter |
| `qc1` | Renderer switch entry point |
| `X2H` | Full renderer teardown + relaunch orchestrator |
| `rh` | Binary path resolver |
| `sW8` | Claude binary path locator |
| `U_H` | Local-bin path builder |
| `i$` | Array-type guard |
| `fk` | File existence checker |
| `I6` | Node `_N` wrapper |
| `_N` | Internal node helper |
| `wP6` | Interval cleaner (clearInterval wrapper) |
| `Vv_` | Render-loop stopper |
| `wIH` | Ink tree unmounter + buffer flusher |
| `mR` | Ink mount tracker |
| `gq8` | Alternate-screen switcher (ESC-7 / ESC-8 sequences) |
| `bf8` | Scroll-summary telemetry emitter |
| `JZ` | Scroll position snapshot |
| `QX9` | Scroll metrics collector |
| `gX9` | Scroll stats calculator |
| `sL` | Timed promise helper (setTimeout + Promise.race) |
| `UT` | Drain-queue initiator |
| `m4` | Drain orchestrator |
| `sxH` | I/O queue drain caller |
| `xf8` | Analytics flush with timeout |
| `g8` | Generic timed abort helper |
| `B6A` | Native-addon loader path resolver |
| `pK` | Native-addon path helper |
| `ad1` | Process execve re-launcher |
| `$` | Xs1 wrapper (addon set) |
| `w` | Background-session manager |
| `M` | File-cleanup + execve dispatcher |
| `z` | Daemon stop controller |
| `EH` | Exit-code string coercer |
| `tj` | Relaunch-error sentinel file writer |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.