---
type: feature-spec
feature: "tui"
cc_version: "2.1.149"
updated: "2026-06-01"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.149 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.149 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.149

---

## Overview

The `/tui` command allows the user to switch the terminal UI renderer between `default` and `fullscreen` modes at runtime. It validates the current session context and environment compatibility before performing a live renderer switch, relaunching the process with the new renderer setting when all conditions are satisfied.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| module_id | `Ou1` |
| load_inline | `true` |
| loc_byte | `12008145` |
| loc_byte_end | `12008327` |
| loc_line | `9756` |
| arbor_handler.name | `keL` |
| arbor_handler.fqn | `claude-2.1.149::keL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.149 bundle.js:+12008145

---

## Input Branching

The handler has more than three distinct branches based on session type, environment compatibility, background-task state, and the value of the argument supplied. A flowchart best captures the logic.

```mermaid
flowchart TD
    A(["/tui [default|fullscreen]"]) --> B[Trim argument string]
    B --> C{Session type?}
    C -- "daemon / daemon-worker\n(background session)" --> D[Return error:\nRenderer switching unavailable\nin background session]
    C -- foreground / system --> E{Active background tasks?\nrunning / pending /\nremote_agent / mcp_task}
    E -- yes --> F[Return error:\nCannot switch while\nbackground tasks are running]
    E -- no --> G[Detect renderer mode\nvia renderModeDetect]
    G --> H{Argument value?}
    H -- '"fullscreen"' --> I{fullscreen compatible?\nNo tmux-CC, no Windows-SSH}
    H -- '"default"' --> J[Target = default]
    H -- empty / unrecognised --> K[Show current mode\nand available options]
    I -- compatible --> L[Target = fullscreen]
    I -- tmux-CC detected --> M[Warn: fullscreen disabled –\ntmux -CC detected\nSet CLAUDE_CODE_NO_FLICKER=1\nto override]
    I -- Windows SSH detected --> N[Warn: fullscreen disabled –\nWindows over SSH detected\nSet CLAUDE_CODE_NO_FLICKER=1\nto override]
    L --> O[Emit tengu_tui_command\nWrite new renderer setting]
    J --> O
    O --> P[Flush analytics / drain\nwrite queue]
    P --> Q[relaunch: spawnSync\nnew process, inherit stdio\npass --resume flag]
    Q --> R[process.exit]
    D --> S([Return message to user])
    F --> S
    M --> S
    N --> S
    K --> S
```

Analysis basis: CC v2.1.149 bundle.js:+12006120–12007872

---

## Behavioral Spec

### 1. Argument Normalisation

```
async function tuiCommandHandler(rawArg):
    trimmedArg = rawArg.trim()                    // keL → A.trim  (+12006120)
    lowercasedArg = trimmedArg.toLowerCase()       // A → M.toLowerCase (+15286672)
```

Analysis basis: CC v2.1.149 bundle.js:+12006120

---

### 2. Session-Type Guard

The handler reads the current session context (obtained via the settings/daemon subsystem at `+12006202`) and compares it against two forbidden session kinds.

```
function sessionTypeGuard(sessionType):
    if sessionType in ["daemon", "daemon-worker"]:        // literals +2189591, +2189605
        return ErrorMessage(
            "Renderer switching isn't available in a background session" +
            " — press ← to detach and run /tui from a foreground session."
        )                                                  // literal +12006423
    return OK
```

Analysis basis: CC v2.1.149 bundle.js:+12006409

---

### 3. Background-Task Guard

```
function backgroundTaskGuard(taskList):
    activeStatuses = ["running", "pending", "remote_agent", "mcp_task"]
    // literals +12006787, +12006809, +12006830, +12006855
    busyTasks = taskList
        .values()
        .filter(t => activeStatuses.includes(t.status))
    if busyTasks.length > 0:
        emit("tengu_tui_refused")                          // telemetry +12006876
        return ErrorMessage(
            "Cannot switch renderers while background tasks are running" +
            " — wait for them to finish (or stop them via /tasks)," +
            " then run /tui again."
        )                                                  // literal +12006917
    return OK
```

Analysis basis: CC v2.1.149 bundle.js:+12006748

---

### 4. Renderer-Mode Detection (`renderModeDetect`)

Called at `+12006156` (via `HA`). Inspects environment variables and terminal identity to decide which renderer modes are viable.

```
function detectRenderMode():
    envVarNoFlicker = env["CLAUDE_CODE_NO_FLICKER"]       // literal +12004430
    envVarAltScreen = env["CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN"] // +12004455
    envVarForceUpsell = env["CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL"] // +12004494

    // tmux control-mode detection
    if termProgram.startsWith("screen") or termProgram.startsWith("tmux"):
        // literal values "screen" +3359118, "tmux" +3359143
        result = spawnSync("tmux", ["display-message", "-p",
                           "#{client_control_mode}"],      // literal +3359351
                           {encoding:"utf8", timeout:2000}) // +3359387, +3359402
        if result indicates control mode active:
            if not envVarNoFlicker:
                return {mode:"auto_off", reason:"tmux_cc_auto_off"} // +3360939

    // Windows-over-SSH detection
    if platform == "windows":                              // literal +3359612
        if not envVarNoFlicker:
            return {mode:"auto_off", reason:"win_ssh_auto_off"}    // +3360973

    // Environment-variable overrides
    if envVarOff set:
        return {mode:"off", reason:"env_off"}              // +3360857
    if envVarOn set:
        return {mode:"on", reason:"env_on"}                // +3360915

    // Settings-layer overrides checked next ("settings_on"/"settings_off")
    // Feature-flag / gradual-rollout check ("gb_on"/"gb_off")
    return currentDetectedMode
```

Signals emitted during detection:
- `tengu_amber_creek` at `+3360591`
- `tengu_pewter_brook` at `+3360499`

Analysis basis: CC v2.1.149 bundle.js:+12006145, +3360591, +3360499

---

### 5. Argument Routing

```
function routeArgument(lowercasedArg, detectedMode):
    if lowercasedArg == "fullscreen":                      // literal +3360408
        if detectedMode.reason == "tmux_cc_auto_off":
            return Warning("fullscreen disabled: tmux -CC (iTerm2 integration" +
                           " mode) detected · set CLAUDE_CODE_NO_FLICKER=1" +
                           " to override")                 // literal +3360074
        if detectedMode.reason == "win_ssh_auto_off":
            return Warning("fullscreen disabled: Windows over SSH" +
                           " (ConPTY re-rendering) detected · set" +
                           " CLAUDE_CODE_NO_FLICKER=1 to override") // +3360260
        targetMode = "fullscreen"
    else if lowercasedArg == "default":                    // literal +3360434
        targetMode = "default"
    else:
        // No argument or unrecognised — display current status + usage
        return ShowCurrentModeAndOptions(detectedMode)
    return targetMode
```

Analysis basis: CC v2.1.149 bundle.js:+12007088 (`VOH`), +3360408, +3360434

---

### 6. Settings Persistence and Relaunch (`relaunchWithRenderer`)

```
async function relaunchWithRenderer(targetMode):
    // Persist selection to settings layer
    writeSettingToFile("preferredRenderer", targetMode)    // via _A +12007104

    // Emit final telemetry
    emit("tengu_tui_command", {mode: targetMode,
         uptimeRoundedMs: Math.round(process.uptime())})   // +12007438, +12007427

    // Flush analytics pipeline with timeout
    await Promise.all([
        flushAnalytics(timeout: 30000),                    // literal +12003040
        drainWriteQueue()                                  // kCH → W7A.drain +58315
    ])

    // Teardown current renderer
    unmountCurrentRenderer()                               // TvH → H.unmount +5283795
    clearRenderInterval()                                  // _j6 → clearInterval +5285141

    // Signal cleanup
    process.removeAllListeners()                           // +12003542
    process.on("SIGINT",  noOp)                            // +12003572
    process.on("SIGTERM", noOp)
    process.on("SIGHUP",  noOp)

    // Spawn replacement process
    spawnSync(currentBinary, [...originalArgs, "--resume"],// literal +12002978
              {stdio: "inherit"})                          // literal +12003634

    process.exit()                                         // +12003848
```

Analysis basis: CC v2.1.149 bundle.js:+12007215, +12003542, +12003599, +12003848

---

### 7. Fullscreen Upsell / Downsell Display

When the detected mode includes gradual-rollout flags (`gb_on`, `gb_off`, `downsell_on`), the handler renders an upsell or downsell React component (`Gb` at `+12007658`, `k1` at `+12007664`) before presenting mode options. The terminal-width helper (`MN` at `+12007215`) queries the column count and clamps it:

```
function terminalWidth():
    rawWidth = getColumnsFromTerminal()
    if Number.isNaN(parseFloat(rawWidth)):
        return Math.min(rawWidth, 20)                      // literal +3431732
    return clampedWidth
```

Analysis basis: CC v2.1.149 bundle.js:+12007658, +12007664, +3431732

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_tui_command` | Fired on every successful renderer switch; includes chosen mode and rounded uptime. `+12007348` |
| Telemetry: `tengu_tui_refused` | Fired when background tasks block the switch. `+12006876` |
| Telemetry: `tengu_amber_creek` | Fired during renderer-mode detection. `+3360591` |
| Telemetry: `tengu_pewter_brook` | Fired during renderer-mode detection. `+3360499` |
| Telemetry: `tengu_feature_ok` | General feature-flag success path. `+963421` |
| Telemetry: `tengu_feature_sad` | General feature-flag sad path. `+963556` |
| Telemetry: `tengu_feature_bad` | General feature-flag error path. `+963479` |
| Telemetry: `tengu_scroll_summary` | Emitted at renderer teardown. `+5285263` |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Background dispatch escalation. `+15260736` |
| Telemetry: `tengu_bg_dispatch_low_mem` | Low-memory event in background dispatcher. `+15261315` |
| Telemetry: `tengu_bg_spare_enable` | Spare-session enabled. `+15262010` |
| Telemetry: `tengu_bg_spare_claim` | Spare-session claimed. `+15262131` |
| Telemetry: `tengu_bg_spare_claim_fail` | Spare-session claim failure. `+15262394` |
| Telemetry: `tengu_daemon_control` | Daemon control event. `+15296846` |
| Settings write | `preferredRenderer` key updated in `.claude/settings.json` or `settings.local.json` via `_A`. |
| Process relaunch | `qu1.spawnSync` spawns a new Claude Code process with `--resume` and `stdio:"inherit"`. `+12003599` |
| Process exit | `process.exit()` called after spawn. `+12003848` |
| Signal handlers | All existing listeners removed; SIGINT/SIGTERM/SIGHUP suppressed during relaunch window. `+12003542` |
| Analytics drain | `W7A.drain` called with a `30 000 ms` flush timeout before relaunch. `+12003040` |
| Environment variable check | `CLAUDE_CODE_NO_FLICKER`, `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN`, `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL` consulted. `+12004430`, `+12004455`, `+12004494` |
| Cache clear | `dy6.clear` and `pS8.clear` called during settings refresh. `+26612`, `+26624` |

---

## Version History

| Version | Change |
|---|---|
| v2.1.149 | Initial analysis |

---

## Common Mistakes

1. **Running `/tui` in a daemon or background session**: The command explicitly rejects invocation from `daemon` or `daemon-worker` session types. Detach to a foreground session first (`←` key) before switching the renderer.
2. **Trying to switch while background tasks are running**: Tasks with status `running`, `pending`, `remote_agent`, or `mcp_task` block the renderer switch. Wait for them to complete or cancel them via `/tasks`.
3. **Expecting fullscreen under tmux control mode (iTerm2)**: tmux `-CC` (iTerm2 integration mode) forces `fullscreen` off automatically. Set the environment variable `CLAUDE_CODE_NO_FLICKER=1` in the shell before launching Claude Code to override this.
4. **Expecting fullscreen over Windows SSH**: Windows-over-SSH (ConPTY) sessions also disable fullscreen by default. The same `CLAUDE_CODE_NO_FLICKER=1` override applies.
5. **Not providing an argument**: Invoking `/tui` with no argument displays the current mode and available options rather than switching anything.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `keL` | Main async handler for `/tui` (Arbor-resolved entry point) |
| `A` | Trimmed argument string / various loop variables |
| `M` | Lowercased argument / miscellaneous string operand |
| `q` | Temp-file / socket cleanup helper; also misc collection |
| `L` | Settings file set / write-set tracker |
| `HA` | Renderer-mode detection orchestrator |
| `hm` | Settings-load coordinator (`loadSettingsFromDisk`) |
| `DC` | Settings-load sub-step A |
| `Tq` | Performance mark emitter during settings load |
| `$m` | `perf_hooks` require wrapper |
| `Wl8` | Core settings loader (reads flag/policy/user/project layers) |
| `V8` | File-based log writer |
| `ly6` | Log-level filter |
| `N46` | Flag-settings accumulator |
| `EZA` | Settings key enumerator |
| `K` | Column-pad helper / display row builder |
| `dfH` | Settings-file path resolver |
| `iF` | Inline SDK-settings injector |
| `WZA` | SDK inline settings parser |
| `rF` | Settings-layer merger / reader registry |
| `j_` | Core settings primitive accessor |
| `jA6` | Settings reader: flag layer |
| `sR8` | Settings reader: policy layer |
| `zA6` | Settings reader: user layer |
| `J2H` | Settings reader: project layer |
| `JA6` | Settings reader: local layer |
| `BfH` | Settings reader: env-var layer |
| `FfH` | Settings reader: SDK layer |
| `zl8` | Settings reader: default layer |
| `AZA` | Settings aggregator |
| `sl` | Settings serialiser |
| `I46` | WSL-environment detector |
| `cy6` | Settings load finaliser |
| `Y9` | Foreground-session / render-context builder |
| `WxH` | Session-ID existence check |
| `I3_` | Local-agent mode detector |
| `t1` | Boolean-env-var parser (no/off values) |
| `mH` | Boolean-env-var parser (yes/on values) |
| `fi` | iTerm.app detector |
| `A67` | Terminal emulator probe |
| `_67` | Terminal `$TERM_PROGRAM` prefix checker |
| `N` | Debug/log emitter |
| `MVK` | Debug-mode resolver |
| `T7A` | Telemetry category router |
| `H` | Generic buffer / stream / random helper |
| `CH` | JSON-stringify wrapper |
| `_` | Misc collection / utility |
| `X4` | Log-line formatter |
| `s5A` | Header map builder |
| `HbH` | stdout write helper |
| `B5A` | Raw stream write |
| `OVK` | Persistent log-file writer |
| `ICH` | Batched write scheduler |
| `q9H` | Log-record serialiser |
| `Q6` | Error-code classifier |
| `G96` | File-error handler |
| `LMA` | Log-file path resolver |
| `KMA` | Log-file rotation handler |
| `$VK` | Async log-file append helper |
| `a9` | Process signal/drain registrar |
| `N3_` | Windows-SSH detection helper |
| `q67` | Fullscreen-mode decision function |
| `V6` | Renderer-mode resolver / feature-flag evaluator |
| `_$6` | Renderer-mode off-path handler |
| `A$6` | Renderer-mode on-path handler |
| `we` | Gradual-rollout / feature-flag lookup |
| `we6` | Feature-flag cache manager |
| `m6` | Feature-flag fetch and store |
| `bq` | Daemon/background session-type checker |
| `f$H` | Session-type reader |
| `c` | React component renderer / UI primitive |
| `VOH` | Mode-state display component (shows current renderer + reason codes) |
| `_A` | Settings-write and process-relaunch orchestrator |
| `o$` | Config-path provider |
| `Pl8` | Full settings reader (all layers) |
| `oX` | stdin / file read helper |
| `il` | File encoding detector |
| `W3` | File-stat / type probe |
| `fm6` | File-read sub-helper |
| `$m6` | File-content slicer |
| `j8` | EISDIR / ENOENT guard |
| `K8` | Error-code string checker |
| `Ec8` | Timestamp cache setter |
| `M0H` | Settings-path + merger helper |
| `Fp6` | Path resolve helper for settings files |
| `UK6` | Atomic file-write helper (temp + rename) |
| `O` | Process-state / symbolic-link checker |
| `k8` | Process stopped-state flag |
| `CY` | Cache-clear helper (clears `dy6` and `pS8`) |
| `im6` | gitignore-rule writer |
| `x6` | AsyncLocalStorage context reader |
| `Mm6` | Store-get wrapper |
| `Lc8` | File-system primitive collector |
| `nm6` | gitignore checker (`git check-ignore`) |
| `G_` | `git` command runner |
| `FaK` | Global gitignore path resolver |
| `fTA` | `git ls-files` runner |
| `$TA` | gitignore rule-string builder |
| `BC` | `.claude` directory path builder |
| `bH` | `gitignore_global_rule` setting reader |
| `_8` | `write_ineffective` setting reader |
| `uH` | Generic setting reader (single key) |
| `RH` | Error renderer / error-log writer |
| `c_` | Error message extractor |
| `G1` | Error display formatter |
| `Z2A` | Stack-trace formatter |
| `uiK` | Recent-error ring-buffer manager |
| `MN` | Terminal-width helper / column clamper |
| `t$6` | Terminal-width raw reader |
| `yJ` | Column-count fallback |
| `j$_` | JetBrains IDE terminal version parser |
| `aA7` | IDE terminal version string builder |
| `ROH` | Terminal-width no-reply handler |
| `sA7` | xterm.js column-count clamper |
| `J$_` | Cursor/VSCode width-query builder |
| `Gb` | Fullscreen upsell/downsell component renderer |
| `OS` | Upsell React component |
| `Hs4` | Upsell heading builder |
| `yO` | Auth-tier resolver |
| `G$` | Upsell body builder |
| `RK6` | Upsell footer builder |
| `k1` | Fullscreen feature-gate checker / display |
| `p8q` | Feature-gate loader |
| `_q8` | Feature-gate cache reader |
| `cb` | Auth/account tier reader |
| `bJ_` | Feature-gate file reader |
| `X1H` | Feature-gate display component |
| `$u1` | Relaunch orchestrator entry point |
| `RXH` | Full relaunch implementation |
| `Ku` | Binary-path resolver for relaunch |
| `ej8` | Claude binary locator |
| `$8H` | `~/.local/bin` path builder |
| `rf` | Array-check utility |
| `YI` | Session resumption-flag builder |
| `S6` | `Dv` promise wrapper |
| `Dv` | Core deferred/promise primitive |
| `_j6` | Render-interval clear helper |
| `_G_` | `clearInterval` wrapper |
| `TvH` | Renderer teardown (unmount + write sync) |
| `wS` | Alternate-screen restore helper |
| `l68` | ANSI cursor-save/restore emitter |
| `X48` | Scroll-summary emitter |
| `jv` | Scroll-position reader |
| `t$q` | Scroll-summary data collector |
| `s$q` | Scroll metric calculator |
| `t5` | Timed promise-race helper |
| `FV` | Analytics flush trigger |
| `h4` | Analytics queue reference |
| `kCH` | Write-queue drain caller (`W7A.drain`) |
| `P48` | Analytics pipeline awaiter |
| `r8` | Abort-controller / timeout-race utility |
| `Zo_` | Post-relaunch environment builder |
| `rK` | Deferred wrapper for relaunch |
| `_u1` | Native-addon / `execve` loader |
| `$` | Subprocess registry / spawn tracker |
| `w` | Background-session worker / process manager |
| `f` | `execve` foreign-function wrapper |
| `z` | Daemon stop/cleanup helper |
| `EH` | Error-to-string coercer |
| `nX` | Relaunch-spawn-error file writer |