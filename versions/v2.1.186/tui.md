---
type: feature-spec
feature: "tui"
cc_version: "2.1.186"
updated: "2026-06-23"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.186 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.186 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.186

---

## Overview

The `/tui` command switches Claude Code's terminal UI renderer at runtime between two modes: `default` (classic inline renderer) and `fullscreen` (alternate-screen renderer). The command inspects the current environment, checks for compatibility blockers, validates that no background work is in flight, persists the chosen renderer setting, and then restarts the rendering subsystem so the change takes effect in the current session.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| module_id | `DRl` |
| load_inline | `true` |
| loc_byte | `12546839` |
| loc_byte_end | `12547021` |
| loc_line | `8458` |
| arbor_handler.name | `Jhf` |
| arbor_handler.fqn | `claude-2.1.186::Jhf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.186 bundle.js:+12546839

---

## Input Branching

The command has more than three distinct branches (argument value, screen-reader active, background-work-in-flight, environment compatibility, renderer-capability check, same-vs-later-session application), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/tui [arg]"]) --> B{Trim argument}
    B --> C{arg valid?\n'default' | 'fullscreen'\nor empty}
    C -- invalid --> ERR1["Show valid-values error\n(list via validModesJoin)"]
    C -- valid / empty --> D{Screen-reader mode active?\ndx / screenReaderCheck}
    D -- yes --> INFO1["Show info:\nscreen-reader always uses\nclassic renderer;\ntui setting has no effect"]
    D -- no --> E{Background tasks running?\nrunning | pending |\nremote_agent | mcp_task}
    E -- yes --> ERR2["Emit tengu_tui_refused\nShow error:\n'Cannot switch renderers\nwhile work is running…'"]
    E -- no --> F{arg empty?}
    F -- empty --> G["Read current setting\nvia getAppState / $h\nDisplayRendererInfo panel"]
    F -- has value --> H{Compute effective renderer\nvia fullscreenEligibility (zO)}
    H --> I{Terminal eligible for\nfullscreen?}
    I -- not eligible --> J["Show compatibility warning\n(tmux -CC, Win/SSH, etc.)"]
    I -- eligible --> K{Requested mode == current\neffective mode?}
    K -- same_session --> L["Show 'already active'\nfeedback; emit\ntengu_tui_command\nsame_session"]
    K -- later_session --> M["Persist setting via\nro (settings writer)\nEmit tengu_tui_command\nlater_session\nTrigger renderer restart\nvia relaunchHelper (DMe)"]
    M --> N["Render JSX confirmation\nvia Jq.jsx / Pe"]
```

Analysis basis: CC v2.1.186 bundle.js:+12544458 – +12546478

---

## Behavioral Spec

### 1. Argument Parsing and Validation

```
async function tuiCommandHandler(input, appContext):
    arg = input.trim()                          // Jhf → n.trim :+12544458

    validModes = ["default", "fullscreen"]      // literals :+3551099, :+3551073
    validModesJoin = validModes.join(", ")      // k0o.join :+12544570

    if arg != "" and arg not in validModes:
        return renderError("Unknown mode. Valid values: " + validModesJoin)
```

Analysis basis: CC v2.1.186 bundle.js:+12544570, +12544616

### 2. Screen-Reader Guard

```
    srActive = screenReaderCheck(appContext)    // dx :+12544964

    if srActive:
        showInfo(
            // literal fragment: "Screen-reader mode always uses the classic renderer…"
            // :+12544978
        )
        return
```

When screen-reader mode (`CLAUDE_CODE_NO_FLICKER` / accessibility env) is active, the user is informed that the setting has no effect and the function returns early without persisting anything.

Analysis basis: CC v2.1.186 bundle.js:+12544964, +12544978

### 3. Background-Work Safety Check

```
    activeTasks = getActiveTasks(appContext)    // Object.values :+12545275, Nr :+12545151
    blockedStates = ["running", "pending",      // literals :+12545314–:+12545382
                     "remote_agent", "mcp_task"]

    if any task in activeTasks has state in blockedStates:
        telemetry.emit("tengu_tui_refused")     // :+12545403
        return renderError(
            // literal fragment: "Cannot switch renderers while work is running…"
            // :+12545444
        )
```

Analysis basis: CC v2.1.186 bundle.js:+12545275, +12545403, +12545444

### 4. No-Argument Display Path

```
    if arg == "":
        currentSetting = getAppState(appContext)   // $h → e.getAppState :+12544744
        effectiveMode  = computeEffectiveMode(currentSetting, env)   // iCe :+12545616
        renderDisplayPanel(currentSetting, effectiveMode, compatibilityWarnings)
        return
```

The display panel shows the persisted setting, the effective runtime mode (which may differ from the setting due to environment overrides), and any active override reasons (see §6).

Analysis basis: CC v2.1.186 bundle.js:+12544744, +12545616

### 5. Fullscreen Eligibility Check

```
function computeFullscreenEligibility(env):          // zO :+12545743
    // Check terminal application family
    if env is JetBrains IDE terminal:                // D2.isJetBrainsIdeTerminal :+3621219
        eligible = false; reason = "ide"
    if env.TERM_PROGRAM in ["cursor", "vscode"]:     // AG.includes :+3621191
        eligible = false; reason = "ide"
    // Check xterm.js version range (Cursor/VS Code xterm)
    // versions 1092000..1105000 excluded          // literals :+3622020, :+3622031
    // Check darwin / win32 platform handling       // literals :+3621428, :+3621475
    // Check multiplexer escape sequences
    if tmux -CC (iTerm2 native mode) detected:
        // literal fragment: "fullscreen disabled: tmux -CC…"  :+3550739
        eligible = false; reason = "tmux_cc_auto_off"
    if Windows-over-SSH ConPTY detected:
        // literal fragment: "fullscreen disabled: Windows over SSH…" :+3550925
        eligible = false; reason = "win_ssh_auto_off"
    // Parse terminal pixel geometry (Gfd)          // parseFloat, Math.min :+3622346, :+3622391
    return { eligible, reason }
```

Analysis basis: CC v2.1.186 bundle.js:+12545743, +3621151, +3621191, +3621219, +3550739, +3550925

### 6. Effective Mode Resolution (iCe / Es override chain)

```
function computeEffectiveMode(settingValue, env):    // iCe :+12545616, Es :+12544483
    // Override priority (highest → lowest):
    // 1. bg_forced_on  — background session: fullscreen always forced  :+3551501
    // 2. sr_auto_off   — screen-reader active: forced to default       :+3551530
    // 3. env_off       — CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1        :+3551559
    // 4. env_on        — CLAUDE_CODE_NO_FLICKER=1                      :+3551609
    // 5. tmux_cc_auto_off — tmux -CC detected                          :+3551633
    // 6. win_ssh_auto_off — Windows/SSH ConPTY detected                :+3551667
    // 7. settings_on / settings_off — persisted user setting           :+3551726, :+3551760
    // 8. downsell_on   — upsell/downsell gate active                   :+3551833
    // 9. gb_on / gb_off — feature-flag (gradual rollout)               :+3551898, :+3551906
    // Final fallback: "default"                                         :+3551099
    return { mode, overrideReason }
```

Note: Background sessions always use fullscreen regardless of this setting, which is communicated to the user via an informational message (literal fragment: "Background sessions always use the fullscreen renderer…" Analysis basis: CC v2.1.186 bundle.js:+12544768).

Analysis basis: CC v2.1.186 bundle.js:+12545616, +3551501–+3551906

### 7. Persist and Restart

```
    newMode = arg    // "default" or "fullscreen"

    sameSession = (newMode == currentEffectiveMode)

    if sameSession:
        telemetry.emit("tengu_tui_command", { timing: "same_session" })   // :+12546322
        renderAlreadyActiveMessage()
        return

    // Persist setting via settings writer
    persistSetting(appContext, "tui", newMode)   // ro :+12545632

    telemetry.emit("tengu_tui_command", { timing: "later_session" })      // :+12546337

    // Collect session-resume args
    resumeArgs = buildResumeArgs(appContext)     // U7n :+12544734
        // Includes --resume                     // literal :+12539890
        // Includes --add-dir                    // literal :+12541414
        // Includes --allow-dangerously-skip-permissions if active  // :+12541529
        // Includes --effort                     // :+12541671
        // Includes --permission-mode            // :+12541688

    // Render JSX success panel
    renderConfirmation(newMode, resumeArgs)      // Jq.jsx :+12546259, Pe :+12545915

    // Record process uptime for telemetry
    uptime = Math.round(process.uptime())        // :+12545967, :+12545978

    // Trigger renderer restart
    relaunchHelper(appContext, resumeArgs)       // bqt :+12546384, DMe :+12546384
```

Analysis basis: CC v2.1.186 bundle.js:+12545632, +12546259, +12546322, +12546337, +12546384

### 8. Relaunch Helper (DMe — Renderer Restart)

```
function relaunchHelper(appContext, resumeArgs):     // DMe :+12541823
    // 1. Find versioned binary path               // hF, A2n :+12541823
    //    Looks under ~/.local/share/claude/versions/bin   // literals :+7033308, :+7033317, :+8514865, :+8514874
    // 2. Stat the binary to confirm it exists     // kRl.stat :+12539838
    // 3. Stop current renderer / interval timers  // wFt, Hto, clearInterval :+12539912
    // 4. Unmount Ink/JSX tree                     // k9e, e.unmount :+12539918
    // 5. Restore terminal (write escape sequences)// Zbn, LZ.writeSync :+3891970
    //    ESC-7 / ESC-8 save/restore cursor        // literals :+3892124, :+3892135
    // 6. Re-init renderer state                   // UDn :+12539924
    // 7. Flush analytics (timeout 2000 ms)        // LKe, O5o.drain :+12540008
    //    "cleanup timeout" 2000 ms                // literal :+12540014, :+12540019
    //    "analytics flush timeout"                // literal :+12540075
    // 8. Remove process signal listeners          // process.removeAllListeners :+12540459
    // 9. Re-attach SIGINT / SIGHUP handlers       // process.on :+12540489
    //    literals: "SIGINT", "SIGHUP"             // :+12540430, :+12540449
    // 10. spawnSync new process with resumeArgs   // LRl.spawnSync :+12540516
    //     stdio: "inherit"                        // literal :+12540551
    //     Listens for beforeExit / exit events    // literals :+12540605, :+12540646
    // 11. On error: write relaunch_spawn_error    // sT :+12540738, literal :+12540741
    // 12. Exit current process / send kill signal // process.exit :+12540765, process.kill :+12540830
    //     Exit code floor: 128                    // literal :+12540878
```

Timeouts observed in the relaunch sequence:
- Flush timeout (relaunch): 30 000 ms (Analysis basis: CC v2.1.186 bundle.js:+12539957)
- Cleanup timeout: 2 000 ms (Analysis basis: CC v2.1.186 bundle.js:+12540014)

Analysis basis: CC v2.1.186 bundle.js:+12539744–+12540830

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_tui_command` | Fired on every successful mode set; carries `timing` = `same_session` \| `later_session`. Analysis basis: +12545876, +12546322, +12546337 |
| Telemetry — `tengu_tui_refused` | Fired when a switch is blocked because background tasks are active. Analysis basis: +12545403 |
| Telemetry — `tengu_amber_creek` | Fired from effective-mode resolver (iCe override chain). Analysis basis: +3551256 |
| Telemetry — `tengu_pewter_brook` | Fired from effective-mode resolver (iCe override chain). Analysis basis: +3551164 |
| Telemetry — `tengu_scroll_summary` | Fired during relaunch / renderer-state re-init (UDn). Analysis basis: +7218373 |
| Telemetry — `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` | Terminal-feature probe results used in eligibility check. Analysis basis: +1024705, +1024772, +1024853 |
| Settings persistence | Writes to user settings (`settings.json` under `~/.claude/`) via the settings writer (ro). Analysis basis: +12545632 |
| Process restart | Calls `spawnSync` with `--resume` and current session flags; exits current process. Analysis basis: +12540516, +12540765 |
| Renderer teardown | Unmounts Ink/JSX tree, clears timers, writes terminal escape sequences to restore cursor state. Analysis basis: +12539918, +3892124, +3892135 |
| Analytics drain | Waits up to 2 000 ms for analytics queue to drain before restart. Analysis basis: +12540008 |
| Environment variables read | `CLAUDE_CODE_NO_FLICKER`, `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN`, `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL`. Analysis basis: +12541919, +12541944, +12541983 |
| appState changes | Current renderer mode read via `getAppState` (`$h`); updated mode propagated after restart. Analysis basis: +12544744 |
| Sound | None observed in depth-2 traversal. |

---

## Version History

| Version | Change |
|---|---|
| v2.1.186 | Initial analysis |

---

## Common Mistakes

1. **Running `/tui fullscreen` while background tasks are active.** The command refuses the switch and emits `tengu_tui_refused`. Wait for all running/pending tasks (`/tasks`) to complete before switching.
2. **Expecting the change to take effect without a process restart.** The command always restarts the Claude Code process to apply the new renderer. Any unsaved in-memory state from the current session may be lost; the `--resume` flag is passed automatically to reload session context.
3. **Setting `fullscreen` in an unsupported environment (tmux -CC, Windows-over-SSH, IDE embedded terminals).** The eligibility check in `zO` will downgrade the effective mode to `default` at runtime even if the setting is persisted. Set `CLAUDE_CODE_NO_FLICKER=1` to override the tmux-CC and Windows-SSH guards explicitly.
4. **Calling `/tui` with screen-reader mode active (`CLAUDE_CODE_NO_FLICKER=1` or system accessibility flags).** The screen-reader guard short-circuits the command; the setting is never written. Disable screen-reader mode first if a permanent change is intended.
5. **Passing any value other than `default` or `fullscreen`.** The argument is validated against the exact literal list; any other string (including `on`, `off`, `1`, `0`) produces an error.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Jhf` | Main async handler for `/tui` (arbor_handler) |
| `bqt` | Top-level command entry point / relaunch orchestrator caller |
| `DMe` | Relaunch helper — tears down renderer and spawns new process |
| `hF` | Versioned binary path resolver |
| `A2n` | Binary path builder (XDG share dir locator) |
| `bm` | Array-check utility used in path building |
| `Dee` | XDG data-path join helper |
| `jae` | Bin-path join helper |
| `TMn` | Home-directory resolver (`os.homedir`) |
| `gP` | Application context accessor |
| `Rt` | Renderer state getter (wraps `GL`) |
| `GL` | Global app-state store |
| `wFt` | Renderer interval/timer stopper |
| `Hto` | Clears render interval (`clearInterval`) |
| `k9e` | Ink/JSX tree unmount routine |
| `CU` | Post-unmount cleanup helper |
| `Zbn` | Terminal restore sequence writer |
| `Y$e` | Terminal escape/capability handler (ghostty, iTerm detection) |
| `B$e` | Terminal escape writer (secondary) |
| `Nw` | tmux / screen escape sequence normaliser |
| `UDn` | Renderer state re-initialiser |
| `Aha` | Frame timing / animation coordinator |
| `Eha` | Render frame callback |
| `Es` | Effective-mode resolver (full override chain) |
| `G$` | Local-agent type check |
| `dx` | Screen-reader / accessibility mode check |
| `O3r` | Override-reason accumulator |
| `dZ` | Environment-variable override reader |
| `P3r` | Windows-SSH override checker |
| `Nr` | Active-task lister |
| `vcd` | Renderer mode persistence helper |
| `it` | Settings writer / state updater |
| `Mc` | Promise race with timeout utility |
| `hC` | Hook registration coordinator |
| `Oc` | Hook registry accessor |
| `Ai` | Hook register call |
| `LKe` | Analytics drain (O5o.drain wrapper) |
| `x9e` | Async sequence coordinator in relaunch |
| `DDn` | Deferred promise helper |
| `w0o` | Binary path presence checker |
| `gr` | App-state getter (variant) |
| `jl` | Alternate app-state getter |
| `vRl` | Native library loader (bun:ffi / dlopen) |
| `U7n` | Resume-argument builder |
| `DPe` | CLI argument source classifier (`cliArg`, `session`) |
| `KIe` | Argument filter / deduplicator |
| `wt` | Settings cache / file watcher |
| `Gt` | Path existence / stat helper |
| `mOo` | Settings file migration helper |
| `cEe` | Settings file reader and backup manager |
| `Lxf` | Settings file watcher setup |
| `Pr` | App-state sub-field extractor (working_directory, allowed_tools, etc.) |
| `w8n` | Working-directory state accessor |
| `Xo` | Generic state field accessor |
| `L8n` | Tool-list state accessor |
| `L2` | Permission-mode state accessor |
| `$h` | Current renderer setting reader (`getAppState`) |
| `Ws` | Daemon-worker check |
| `XNe` | Worker type constant |
| `iCe` | Effective renderer mode calculator (override chain) |
| `ro` | Settings writer (persists user preferences to disk) |
| `jm` | Settings layer composer |
| `QAe` | Project settings path builder |
| `Xon` | Settings path resolver |
| `_au` | Settings read helper |
| `p9` | Local settings path builder |
| `Hau` | Managed-settings path builder |
| `Z$` | Settings layer aggregator |
| `UIt` | Settings validation / WSL handler |
| `CEr` | Configuration loader (all layers) |
| `Xas` | Settings merger |
| `IEr` | Individual settings layer reader |
| `MG` | Settings get/set coordinator |
| `c5o` | Settings cache getter |
| `EN` | Structured clone helper |
| `AEr` | Settings field writer |
| `u5o` | Settings cache setter |
| `jas` | SDK inline settings parser |
| `Fpe` | Settings format parser |
| `q7e` | Settings serialiser / deserialiser |
| `MC` | CLAUDE.md / config-file loader |
| `zJ` | Config-file path resolver |
| `Fd` | Real-path resolver (fs.realpathSync) |
| `grn` | Config path existence checker |
| `kn` | Error logger / reporter |
| `Nyr` | Settings-load timestamp recorder |
| `z1e` | Settings reload trigger |
| `BTt` | Atomic file write helper (temp-rename-flush) |
| `l7e` | File chmod error classifier |
| `De` | JSON stringifier |
| `EH` | Settings cache invalidator |
| `Xss` | File-write coordinator (mkdir + write + gitignore) |
| `Ot` | Async-local-store accessor |
| `hrn` | Async-store reader |
| `yyr` | File write path helper |
| `ron` | Gitignore-rule checker |
| `$r` | Gitignore entry reader |
| `Vsu` | Path normaliser (tilde expansion, absolute check) |
| `jss` | Gitignore-update writer |
| `Yss` | Gitignore helper |
| `Mt` | Feature flag `tengu_feature_sad` emitter |
| `DG` | Settings-load-from-disk orchestrator |
| `BL` | Settings-load performance marker start |
| `na` | Performance measurement helper |
| `G3` | `perf_hooks` require wrapper |
| `vEr` | Settings-load main function |
| `Rn` | Debug log writer |
| `DYt` | Settings-load performance marker end |
| `NIt` | Tracked-paths set updater |
| `MYt` | Settings-load performance marker finaliser |
| `zO` | Fullscreen eligibility / terminal capability checker |
| `Fxt` | Terminal probe sender |
| `g_` | Terminal environment variable reader |
| `k9r` | Cursor/VS Code terminal capability prober |
| `Bfd` | Terminal probe response parser |
| `v_` | Generic terminal env reader |
| `Gfd` | Terminal geometry / version parser |
| `R9r` | Terminal version string extractor |
| `F9` | JSX renderer entry point |
| `T2` | Ink render bootstrap |
| `Vod` | Ink render options builder |
| `ot` | String coercion utility |
| `Nl` | React/Ink component base |
| `GH` | Ink render instance holder |
| `y1e` | Ink instance wrapper |
| `ins` | Ink instance factory |
| `Js` | Telemetry / feature-flag gate |
| `cEi` | Feature-flag evaluator |
| `Xz` | Gradual-rollout flag reader |
| `C2` | React component renderer |
| `qRt` | Feature-flag config file reader |
| `Mme` | Feature-flag membership checker |
| `Ki` | Feature-flag instance accessor |
| `Sme` | Feature-flag string coercer |
| `T` | Logging / output utility (multi-purpose) |
| `W` | Warning emitter |
| `Ae` | String converter |
| `sT` | Error file writer (relaunch_spawn_error) |
| `TIe` | Environment-flag reader (`CLAUDE_CODE_NO_FLICKER`, etc.) |
| `mn` | Error constructor / wrapper |
| `Pe` | JSX component renderer |
| `ip` | Terminal output stream |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.