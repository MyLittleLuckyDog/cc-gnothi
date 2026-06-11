---
type: feature-spec
feature: "tui"
cc_version: "2.1.170"
updated: "2026-06-11"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.170 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.170 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.170

---

## Overview

The `/tui` command lets the user switch the terminal UI renderer between `default` and `fullscreen` modes at runtime. It validates the requested mode against the current session state (checking for active background tasks and environment-level constraints) and, when permitted, writes the new setting and relaunches the process with the chosen renderer. If the current environment or active workload blocks the switch, it emits an informational refusal message instead of relaunching.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| module_id | `nKK` |
| load_inline | `true` |
| loc_byte | `12566494` |
| loc_byte_end | `12566676` |
| loc_line | `8891` |
| arbor_handler.name | `eUf` |
| arbor_handler.fqn | `claude-2.1.170::eUf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.170 bundle.js:+12566494

---

## Input Branching

The handler has six or more distinct decision paths (valid modes, background-task guard, environment auto-disable guards, missing argument, unchanged value, and relaunch), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/tui [arg]"]) --> B{Argument provided?}
    B -- No --> C[Show current renderer mode\nand available options]
    B -- Yes --> D{Arg in allowed list?\n'default' | 'fullscreen'}
    D -- No --> E[Return error:\ninvalid mode value]
    D -- Yes --> F{Active background tasks?\nstates: running / pending /\nremote_agent / mcp_task}
    F -- Yes --> G["Emit tengu_tui_refused\nReturn: cannot switch while\nwork is running in background"]
    F -- No --> H{Env/platform\nauto-disable applies?}
    H -- "tmux -CC detected\n(unless CLAUDE_CODE_NO_FLICKER=1)" --> I[Report fullscreen disabled:\ntmux -CC iTerm2 mode]
    H -- "Windows over SSH\n(ConPTY) detected\n(unless CLAUDE_CODE_NO_FLICKER=1)" --> J[Report fullscreen disabled:\nWindows SSH auto-off]
    H -- No constraint --> K{Requested mode ==\ncurrent mode?}
    K -- Same --> L[No-op / inform already set]
    K -- Different --> M[Persist new tui setting\nvia settings writer]
    M --> N["Emit tengu_tui_command\nFlush analytics (2 s timeout)\nTear down current renderer\n(sRH / wM8 unmount sequence)"]
    N --> O[Relaunch process via\ngKK.spawnSync with --resume\nand inherited stdio]
    O --> P([process.exit])
    I --> Q([Return refusal message])
    J --> Q
    G --> Q
    E --> Q
    C --> Q
```

Analysis basis: CC v2.1.170 bundle.js:+12564391 (handler entry `eUf`), +12565186 (`tengu_tui_refused`), +12565659 (`tengu_tui_command`), +12560832 (`gKK.spawnSync` relaunch), +12560206 (`--resume` flag)

---

## Behavioral Spec

### 1. Argument Parsing and Mode Validation

```
async function tuiCommandHandler(args, context):
    rawArg = args.trim()                         // eUf → A.trim @ +12564391

    allowedModes = ["default", "fullscreen"]     // literals @ +12564503/+12564549

    if rawArg is empty:
        display currentMode and allowedModes
        return

    if rawArg not in allowedModes:
        return errorMessage("invalid mode; expected: " + allowedModes.join(", "))
```

Analysis basis: CC v2.1.170 bundle.js:+12564391, +12564503, +12564549

---

### 2. Background-Task Guard

Background sessions always use the fullscreen renderer internally. Switching while background work is live is blocked:

```
function hasActiveBackgroundWork(appState):
    activeStates = ["running", "pending", "remote_agent", "mcp_task"]
    tasks = Object.values(appState.tasks)         // +12565058
    return tasks.some(t => activeStates.includes(t.state))

if hasActiveBackgroundWork(currentAppState):
    emit("tengu_tui_refused")                     // +12565186
    return "Cannot switch renderers while work is running in the background" +
           " — wait for it to finish (or stop it via /tasks), then run /tui again."
                                                  // literal @ +12565227
```

> Note (informational): A companion literal at +12564701 explains why background sessions are unaffected: "Background sessions always use the fullscreen renderer so scrolling and mouse work when attached. The tui setting applies to sessions started directly with `claude`."

Analysis basis: CC v2.1.170 bundle.js:+12565058, +12565097, +12565119, +12565140, +12565165, +12565186, +12565227

---

### 3. Environment / Platform Auto-Disable Checks

The fullscreen renderer is automatically suppressed in two known-problematic environments unless the user explicitly overrides with `CLAUDE_CODE_NO_FLICKER=1`:

```
function resolveEffectiveMode(requestedMode, envContext):
    noFlicker = env.CLAUDE_CODE_NO_FLICKER == "1"    // literal @ +12562226

    if requestedMode == "fullscreen" and not noFlicker:
        if envContext.isTmuxCC:
            return refusal("fullscreen disabled: tmux -CC (iTerm2 integration mode) detected · " +
                           "set CLAUDE_CODE_NO_FLICKER=1 to override")
                           // literal @ +3490145
        if envContext.isWindowsOverSSH:
            return refusal("fullscreen disabled: Windows over SSH (ConPTY re-rendering) detected · " +
                           "set CLAUDE_CODE_NO_FLICKER=1 to override")
                           // literal @ +3490331

    return requestedMode
```

The renderer-capability probe (`Zk` → terminal-environment detector) also checks:
- Whether the terminal is a JetBrains IDE terminal (`B_H.isJetBrainsIdeTerminal`, +3560909)
- Whether the terminal reports as `cursor`, `vscode`, or `xterm.js` embeddings (+3561586, +3561635, +3561755)
- Version thresholds for Ghostty (`1.2.0`, +3558386) and iTerm.app (`3.6.6`, +3558457)
- Alternate-screen suppression via `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` (+12562251)

The gate function (`Z1`) returns a string reason code. Observed reason codes:

| Reason code | Meaning |
|---|---|
| `bg_forced_on` | Background session forced fullscreen on |
| `env_off` | Environment variable disables fullscreen |
| `env_on` | Environment variable forces fullscreen on |
| `tmux_cc_auto_off` | tmux -CC mode detected, auto-disabled |
| `win_ssh_auto_off` | Windows-over-SSH detected, auto-disabled |
| `settings_on` | User settings enable fullscreen |
| `settings_off` | User settings disable fullscreen |
| `downsell_on` | Downgrade upsell path active |
| `gb_on` / `gb_off` | Gradual-rollout gate on/off |

Analysis basis: CC v2.1.170 bundle.js:+3490145, +3490331, +12562226, +12562251, +3490890–+3491267

---

### 4. Setting Persistence

When the mode change is permitted:

```
function persistTuiSetting(newMode, settingsWriter):
    // settingsWriter = e_ (settings write subsystem)
    settingsWriter.write({ tui: newMode })        // e_ @ +12565415
```

The settings subsystem (`e_`) resolves through `I$` → `SYH` which locates:
- User settings: `~/.claude/settings.json` (+1268746)
- Local project settings: `settings.local.json` (+1269120)
- Managed/policy settings: `managed-settings.json` (+1265315)

The `tui` key is written to user settings.

Analysis basis: CC v2.1.170 bundle.js:+12565415, +1268746, +1269120

---

### 5. Telemetry Emission and Renderer Teardown / Relaunch

```
async function applyModeChange(newMode, context):
    emit("tengu_tui_command", {               // +12565659
        mode: newMode,
        uptime: Math.round(process.uptime()), // +12565761
    })

    // Flush analytics before tearing down
    await Promise.race([
        analyticsFlush(),                     // pBH → LTA.drain @ +12560380
        timeout(2000, "analytics flush timeout")  // +12560330
    ])

    // Tear down current renderer
    teardownRenderer()                        // sRH sequence @ +12560234
        // → H.unmount (Ink/JSX unmount) @ +7338504
        // → wM8 (write terminal restore sequences ESC-7/ESC-8) @ +7338586
        // → clears interval via qQ_ / clearInterval @ +7340138

    // Wait for pending render frames
    await Promise.race([
        flushScrollSummary(),                 // j28 → tengu_scroll_summary @ +7340260
        timeout(30000, "flush timeout (relaunch)")  // +12560273
    ])

    // Relaunch process
    process.removeAllListeners(["SIGINT", "SIGHUP"])  // +12560775
    spawnSelf(["--resume", ...existingArgs], { stdio: "inherit" })
                                              // gKK.spawnSync @ +12560832
    process.exit(0)                           // +12561081
```

Analysis basis: CC v2.1.170 bundle.js:+12565659, +12565761, +12560330, +12560380, +12560234, +7338504, +12560273, +12560832, +12561081

---

### 6. Relaunch Argument Reconstruction

When relaunching, the handler reconstructs the CLI arguments to carry forward important flags:

```
function buildRelaunchArgs(sessionState, newMode):
    args = ["--resume"]                              // literal @ +12560206
    args += sessionState.addDirs.map(d => ["--add-dir", d])  // literal @ +12561730
    args += ifSet("--allow-dangerously-skip-permissions")     // literal @ +12561845
    args += ifSet("--effort", sessionState.effort)            // literal @ +12561987
    args += ifSet("--permission-mode", sessionState.permissionMode)  // literal @ +12562004
    return args
```

Analysis basis: CC v2.1.170 bundle.js:+12560206, +12561730, +12561845, +12561987, +12562004

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_tui_command` | Fired on successful mode change; includes uptime (bundle.js:+12565659) |
| Telemetry — `tengu_tui_refused` | Fired when switch is blocked by active background tasks (bundle.js:+12565186) |
| Telemetry — `tengu_scroll_summary` | Fired during renderer teardown flush (bundle.js:+7340260) |
| Telemetry — `tengu_amber_creek` | Fired inside renderer-mode resolver `Z1` / `QbL` path (bundle.js:+3490662) |
| Telemetry — `tengu_pewter_brook` | Fired inside renderer-mode resolver `Z1` / `Y6` path (bundle.js:+3490570) |
| Settings write | `tui` key written to user settings file (`~/.claude/settings.json`) via `e_` subsystem |
| Renderer unmount | Ink/JSX component tree unmounted via `H.unmount`; terminal escape sequences ESC-7/ESC-8 written (bundle.js:+3832152, +3832163) |
| Interval teardown | Active render interval cleared via `clearInterval` (bundle.js:+7340138) |
| Analytics flush | `LTA.drain()` called with 2 000 ms timeout before relaunch (bundle.js:+12560330) |
| Process relaunch | `gKK.spawnSync` with `--resume` flag + inherited stdio (bundle.js:+12560832) |
| Process exit | `process.exit(0)` after spawn (bundle.js:+12561081) |
| Signal handlers | `SIGINT` and `SIGHUP` listeners removed before relaunch (bundle.js:+12560775) |
| Environment variables honored | `CLAUDE_CODE_NO_FLICKER`, `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN`, `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL` |

---

## Version History

| Version | Change |
|---|---|
| v2.1.170 | Initial analysis |

---

## Common Mistakes

1. **Running `/tui fullscreen` while background agents are active** — the command will refuse and emit `tengu_tui_refused`. Use `/tasks` to check or stop background work first.
2. **Expecting fullscreen to work inside tmux -CC (iTerm2 native integration)** — the renderer auto-disables. Set `CLAUDE_CODE_NO_FLICKER=1` only if you understand the visual implications.
3. **Running `/tui fullscreen` over Windows SSH (ConPTY)** — same auto-disable applies. Override with `CLAUDE_CODE_NO_FLICKER=1` if needed.
4. **Assuming `/tui` persists across background sessions** — background sessions always use the fullscreen renderer regardless of this setting; the setting only affects foreground `claude` invocations.
5. **Omitting the argument** — `/tui` with no argument displays the current mode and valid options; it does not default to toggling.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `eUf` | Main `/tui` command handler (AsyncFunction; arbor_handler) |
| `fu6` | Top-level entry wrapper calling `WTH` (relaunch orchestrator) |
| `WTH` | Process relaunch / renderer teardown orchestrator |
| `OR` | Claude installation path resolver |
| `Tk8` | Version-directory path builder |
| `N$` | Array normalization helper |
| `a5H` | Local-share path builder (`.local/share/claude/versions/`) |
| `T1H` | Binary path builder (`bin/`) |
| `WX8` | Home-directory path resolver (calls `mc9.homedir`) |
| `Vy` | Current executable path resolver |
| `v6` | Config path helper |
| `xZ` | Generic path utility |
| `Fv6` | Interval clear wrapper |
| `qQ_` | Internal clearInterval wrapper |
| `sRH` | Renderer teardown routine (unmount + escape sequences) |
| `H` | Ink render instance / JSX root |
| `Kb` | Post-unmount cleanup helper |
| `wM8` | Terminal escape-sequence writer (ESC-7 / ESC-8) |
| `_yH` | Terminal-version comparator (Ghostty / iTerm thresholds) |
| `ikH` | Terminal identifier helper |
| `X0` | tmux/screen escape-sequence translator |
| `j3` | Renderer frame flusher |
| `N` | Log / message emitter |
| `j28` | Scroll-summary flush + `tengu_scroll_summary` emitter |
| `uT` | Scroll buffer collector |
| `ca9` | Scroll state snapshot |
| `d` | Debug/trace logger |
| `da9` | Animation frame scheduler |
| `ga9` | Frame callback dispatcher |
| `Z1` | Renderer-mode resolver (returns reason codes like `fullscreen`, `default`, `tmux_cc_auto_off`, etc.) |
| `B6H` | Platform feature flag checker |
| `LZ_` | Local-agent mode reader |
| `Ms` | Background-mode state reader |
| `KZ_` | Windows-SSH detection check |
| `Q_` | Settings accessor (renderer mode) |
| `QbL` | Amber-creek telemetry path / mode emitter |
| `Y6` | Pewter-brook telemetry path / mode emitter |
| `QL` | Promise timeout race helper |
| `HZ` | Analytics hook registration (`e4` / `N9`) |
| `e4` | Analytics event emitter wrapper |
| `N9` | `LTA.register` caller |
| `pBH` | Analytics drain caller (`LTA.drain`) |
| `eRH` | Async renderer-state wrapper (`w28` / `H`) |
| `w28` | Renderer state promise resolver |
| `XMA` | Binary path / module path builder for relaunch |
| `W_` | Resolve-path utility |
| `P4` | Module path resolver |
| `BKK` | Native FFI / execve relaunch wrapper |
| `f` | Bun FFI module handle |
| `A` | FFI symbol table |
| `q` | Worker/connection set |
| `L` | Worker lifecycle manager |
| `$` | Worker registry array |
| `f$K` | Worker-event recorder |
| `w` | Background session / worker manager |
| `b` | Background task descriptor |
| `o8` | Abort/timeout controller |
| `xH` | Feature-ok probe |
| `SH` | Feature-bad probe |
| `dU8` | Low-memory telemetry emitter |
| `oW6` | Roster-config file reader |
| `hH` | Error logging helper |
| `Q` | Permission-retire-if-settled helper |
| `W2A` | Daemon socket claim + connect |
| `v2A` | Session lifecycle manager (state machine: spawned → working → done/killed/crashed etc.) |
| `D` | Forced-shutdown handler (`process.exit` + `z.abort`) |
| `V8` | Node-version check |
| `K6` | Feature gate checker (`tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad`) |
| `F` | Disposable resource wrapper |
| `O` | Shutdown state object |
| `S8` | Shutdown sentinel |
| `M` | MCP server lifecycle + `execve` orchestrator |
| `aSH` | MCP connection initiator |
| `Ic8` | MCP connection result applier |
| `IPA` | MCP server-pool updater |
| `z` | Daemon stop/restart controller |
| `ih` | First-party hook registrar |
| `ZU` | Graceful-exit race (Promise.race + process.exit) |
| `EH` | String coercion wrapper |
| `aj` | Relaunch-error file writer |
| `fp8` | CLI argument reconstructor for relaunch |
| `YZH` | Session-arg builder |
| `Y98` | Config-flag serializer |
| `h6` | Config file loader with backup |
| `n6` | Filesystem existence check |
| `hT_` | Config file path helper |
| `B7H` | Config file reader/migrator |
| `BSL` | Config file watcher |
| `x_` | App-state working-directory / tool-settings extractor |
| `NR8` | Allowed-tools state reader |
| `$1` | State accessor helper |
| `IR8` | Disallowed-tools state reader |
| `Xb` | Permission-mode / bypass-permissions extractor |
| `z$` | App-state effort / model / flag-settings extractor |
| `X9` | Daemon-worker mode detector |
| `_wH` | Daemon-worker identifier string |
| `CJH` | Renderer-mode compound resolver (aggregates `LZ_`, `Ms`, `KZ_`, `Q_`, `Y6`) |
| `e_` | Settings write pipeline |
| `I$` | Settings loader (disk) |
| `SYH` | Settings file path resolver |
| `So6` | Settings directory resolver |
| `vS4` | Settings path builder helper |
| `Ru` | `.claude` directory path builder |
| `VS4` | Managed-settings path builder |
| `XB` | Settings object merger |
| `sf6` | Policy settings reader |
| `bi8` | Flag settings reader |
| `if6` | User settings reader |
| `wZH` | Project settings reader |
| `JZH` | Local settings reader |
| `ef6` | Cowork settings reader |
| `CYH` | SDK inline settings reader |
| `bYH` | System prompt settings reader |
| `Jq_` | Settings validator |
| `SQA` | Settings schema checker |
| `to` | Settings type coercer |
| `Nz6` | WSL-aware path resolver |
| `Hq_` | Settings load pipeline orchestrator |
| `JQA` | Settings merge + key resolver |
| `wQA` | Per-key settings merger |
| `jB` | Settings cache getter/setter |
| `mGA` | Settings cache `get` (Jn8.get) |
| `fh` | Structured-clone helper |
| `s9_` | Settings field parser |
| `pGA` | Settings cache `set` (Jn8.set) |
| `YQA` | SDK inline settings applier |
| `Q4H` | Settings schema type dispatcher |
| `lQH` | Settings field display formatter |
| `E2` | Settings file read + decode |
| `co` | File reader with encoding detection |
| `r3` | Realpath resolver |
| `ai6` | File read error handler |
| `k8` | Node-version validator |
| `z9_` | Settings access timestamp recorder |
| `wvH` | Settings write helper |
| `xO6` | Atomic file writer (temp + rename) |
| `CH` | JSON serializer |
| `hO` | Settings cache invalidator |
| `Fr6` | File read/write with gitignore awareness |
| `C6` | AsyncLocalStorage context accessor |
| `oi6` | Store getter |
| `n1_` | File list traversal |
| `Br6` | Git-ignore checker entry |
| `p_` | `git check-ignore` spawner |
| `ty4` | gitignore path normalizer |
| `YFA` | `git ls-files` tracker |
| `DFA` | gitignore append helper |
| `s6` | Feature-sad probe |
| `PB` | Settings load entrypoint (with perf marks) |
| `bZ` | Settings perf-mark start |
| `_q` | Memory-usage sampler |
| `$u` | `perf_hooks` require |
| `_q_` | Settings load executor |
| `C8` | Log appender |
| `hF6` | Settings hot-reload trigger |
| `vz6` | Watched-path set manager |
| `K` | Pad-end / column formatter |
| `yF6` | Settings load result finalizer |
| `Zk` | Terminal-capability / renderer-eligibility probe |
| `u26` | Terminal escape-query sender |
| `HD` | Terminal response reader |
| `HV_` | Cursor/VSCode terminal version prober |
| `_UL` | Version string parser |
| `Qz` | Terminal DA1/XTVERSION dispatcher |
| `AUL` | Terminal columns reporter |
| `_V_` | Column count calculator |
| `nu` | JSX render root creator |
| `mC` | Ink render engine entry |
| `JDL` | Ink component initializer |
| `_6` | String coercion / identifier normalizer |
| `sL` | React root binder |
| `E$` | Ink output stream configurator |
| `IO6` | Ink instance accessor |
| `ImA` | Ink render context |
| `u9` | Node-version / terminal compatibility gate |
| `gb1` | Terminal-type detector |
| `FNH` | Feature-detection dispatcher |
| `FC` | Terminal info object builder |
| `DJ6` | Terminal info file reader |
| `nLH` | Terminal allowlist checker |
| `hq` | Ink instance initializer |
| `ULH` | Node identifier string builder |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.