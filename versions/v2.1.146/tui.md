---
type: feature-spec
feature: "tui"
cc_version: "2.1.146"
updated: "2026-06-01"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.146 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.146 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.146

---

## Overview

The `/tui` command lets the user switch the terminal UI renderer between `default` and `fullscreen` modes at runtime. It validates the environment for compatibility blockers (background session, active background tasks, flickering-prone terminals), updates the stored renderer setting, and relaunches the CLI process under the new renderer when a change is confirmed.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| module_id | `ZV1` |
| load_inline | `true` |
| loc_byte | `11814354` |
| loc_byte_end | `11814536` |
| loc_line | `9704` |
| arbor_handler.name | `Pu7` |
| arbor_handler.fqn | `claude-2.1.146::Pu7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.146 bundle.js:+11814354

---

## Input Branching

The command has six or more distinct decision branches (background-session guard, active-task guard, two flicker-detection guards, argument validation, no-op same-value guard, and the actual switch/relaunch path), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/tui [arg]"]) --> B{Running in\nbackground session?}
    B -- yes --> ERR1["Error: renderer switching unavailable\nin background sessions\n(bundle.js:+11812632)"]
    B -- no --> C{Active background tasks?\n(running / pending / remote_agent / mcp_task)}
    C -- yes --> ERR2["Error: cannot switch while\nbackground tasks are active\n(bundle.js:+11813126)"]
    C -- no --> D{Argument supplied?}
    D -- no --> SHOW["Display current renderer mode\nand available options"]
    D -- yes --> E["Normalize: arg.trim().toLowerCase()"]
    E --> F{Valid value?\n'default' or 'fullscreen'}
    F -- no --> ERR3["Error: invalid argument\n(bundle.js:+11812329)"]
    F -- yes --> G{Requesting 'fullscreen'?}
    G -- yes --> H{tmux -CC (iTerm2\ncontrol mode) detected?}
    H -- yes --> WARN1["Warn: fullscreen disabled\n(tmux_cc_auto_off)\n(bundle.js:+11813297)"]
    H -- no --> I{Windows-over-SSH /\nConPTY detected?}
    I -- yes --> WARN2["Warn: fullscreen disabled\n(win_ssh_auto_off)\n(bundle.js:+11813297)"]
    I -- no --> J{CLAUDE_CODE_NO_FLICKER set?}
    J -- yes --> PROCEED
    J -- no --> PROCEED
    G -- no --> PROCEED
    WARN1 --> END([Return warning message])
    WARN2 --> END
    PROCEED --> K{New value == current stored value?}
    K -- same --> NOOP["Display 'already set' message"]
    NOOP --> END
    K -- different --> L["Persist new renderer value\nvia settings write (Lx6)"]
    L --> M["Emit 'tengu_tui_command' telemetry\n(bundle.js:+11813557)"]
    M --> N["Relaunch process via XJH\n(exec / spawnSync path)"]
    N --> END
```

---

## Behavioral Spec

### Handler Entry — `tuiCommandHandler` (`Pu7`)

The async handler is the Arbor-resolved function `Pu7` within module `ZV1`.

Analysis basis: CC v2.1.146 bundle.js:+11812329

```
async function tuiCommandHandler(args, context):
    rawArg = args.trim()                                     // +11812329

    // --- Gate 1: background-session guard ---
    sessionKind = getSessionKind(context)                    // Cq → _3H
    if sessionKind in ("daemon", "daemon-worker"):           // +11812618, literals +2174194/+2174208
        emit telemetry "tengu_tui_refused"                   // +11813085
        return error("Renderer switching isn't available in a background session …")
                                                             // literal +11812632

    // --- Gate 2: active-task guard ---
    activeTasks = Object.values(taskRegistry)               // +11812957
    for task in activeTasks:
        if task.state in ("running","pending","remote_agent","mcp_task"):
                                                             // literals +11812996/+11813018/+11813039/+11813064
            emit telemetry "tengu_tui_refused"               // +11813085
            return error("Cannot switch renderers while background tasks are running …")
                                                             // literal +11813126

    // --- Argument normalisation ---
    if rawArg == "":
        return displayCurrentRendererMode()                  // show current + options

    normalised = rawArg.toLowerCase()                        // A → f.toLowerCase, +11812329

    validValues = ["default", "fullscreen"]                  // literals +3339783/+3339757
    if normalised not in validValues:
        return error("Invalid argument …")

    // --- Flicker guards (fullscreen only) ---
    if normalised == "fullscreen":
        flickerInfo = detectFlickerEnvironment()             // G$H, +11813297
        // flickerInfo carries one of:
        //   "tmux_cc_auto_off"  → tmux -CC / iTerm2 control mode  (+3340288)
        //   "win_ssh_auto_off"  → Windows over SSH / ConPTY        (+3340322)
        // Override allowed if env CLAUDE_CODE_NO_FLICKER=1          (+11810639)
        if flickerInfo.reason == "tmux_cc_auto_off" and not noFlickerOverride:
            return warning("fullscreen disabled: tmux -CC … · set CLAUDE_CODE_NO_FLICKER=1 …")
                                                             // literal +3339423
        if flickerInfo.reason == "win_ssh_auto_off" and not noFlickerOverride:
            return warning("fullscreen disabled: Windows over SSH … · set CLAUDE_CODE_NO_FLICKER=1 …")
                                                             // literal +3339609

    // --- No-op guard ---
    current = readCurrentRendererSetting()                   // via settings layer (pfH / MC)
    if normalised == current:
        return displayAlreadySetMessage(normalised)

    // --- Persist & relaunch ---
    persistRendererSetting(normalised)                       // Lx6, file-system write
    recordUptime(Math.round(process.uptime()))               // +11813636/+11813647
    emit telemetry "tengu_tui_command" with {
        new_value: normalised,
        uptime: …
    }                                                        // +11813557
    relaunchProcess()                                        // HA → XJH, exec / spawnSync
```

### Flicker Environment Detection — `detectFlickerEnvironment` (`G$H`)

Analysis basis: CC v2.1.146 bundle.js:+11813297

```
function detectFlickerEnvironment():
    // Resolve current fullscreen state via zL_ / mH / Vn / OL_ / e_ / N6
    // Checks in order:
    //   1. bg_forced_on    (+3340176)  — background forced-on flag
    //   2. env_off / env_on (+3340206/+3340264) — CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN env
    //   3. tmux_cc_auto_off (+3340288) — tmux -CC mode (iTerm2 integration) detected via
    //                                    IQ4 → NQ4 (H.startsWith "iTerm.app", +3338399)
    //                                    and tmux display-message -p #{client_control_mode}
    //                                    spawnSync with 2 000 ms timeout (+3338751)
    //   4. win_ssh_auto_off (+3340322) — Windows platform ("windows", +3338961) over SSH
    //   5. settings_on / settings_off (+3340381/+3340415)
    //   6. downsell_on     (+3340488)
    //   7. gb_on / gb_off  (+3340553/+3340561)
    return { reason, effectiveMode }
```

### Terminal-Width Calculation — `terminalWidthHelper` (`En4`)

Analysis basis: CC v2.1.146 bundle.js:+11813424 (via `uv`)

```
function terminalWidthHelper():
    raw = H7_()                        // read raw terminal column value
    parsed = parseFloat(raw)           // +3411027
    if Number.isNaN(parsed): return 20 // floor default (+3411083)
    return Math.min(parsed, 20)        // cap at 20 (+3411072/+3411083)
```

### Settings Load — `loadSettings` (`gu` → `jF8`)

Analysis basis: CC v2.1.146 bundle.js:+1206594

```
function loadSettings():
    // Performance mark: "loadSettingsFromDisk_start"  (+1206927)
    startTime = Date.now()                              // jF8 +1203635
    log("info", "settings_load_started")               // literals +1203649/+1203656

    layers = [
        loadFlagSettings(),       // J16, "flagSettings"   (+1196119)
        loadPolicySettings(),     // J16, "policySettings" (+1196141)
        loadUserSettings(),       // pfH, "userSettings"   (+1199292)
        loadProjectSettings(),    // pfH, "projectSettings"(+1199343)
        loadLocalSettings(),      // pfH, "localSettings"  (+1199365)
        loadSDKInlineSettings(),  // bXA, "SDK inline settings" (+1198395)
    ]
    merged = mergeSettingLayers(layers)

    log("info", "settings_load_completed")             // +1204333
    // Performance mark: "loadSettingsFromDisk_end"    (+1206983)
    return merged
```

### Process Relaunch — `relaunchProcess` (`HA` → `XJH`)

Analysis basis: CC v2.1.146 bundle.js:+11813313

```
async function relaunchProcess():
    // 1. Flush analytics with race against 30 000 ms timeout (+11809295)
    //    timeout label "flush timeout (relaunch)"             (+11809301)
    // 2. Drain internal queue via tSH                         (+11809346)
    //    timeout label "cleanup timeout"                      (+11809357)
    // 3. Flush analytics second pass; timeout 500 ms         (+5271179)
    //    label "analytics flush timeout"                      (+11809413)
    // 4. Remove all process signal listeners                  (+11809751)
    // 5. Re-register SIGINT / SIGTERM / SIGHUP handlers       (+11809722/+11809731/+11809741)
    // 6. Resolve binary path via jx / Xz8 (claude versions   (+8771382/+8771391))
    // 7. PV1.spawnSync with stdio "inherit"                   (+11809808/+11809843)
    //    flags: --resume                                      (+11809233)
    // 8. Write relaunch metadata via sX                       (+11810030)
    //    on error emit "relaunch_spawn_error"                 (+11810033)
    // 9. process.exit() (or process.kill SIGKILL escalation)  (+11810057/+11810122)
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_tui_refused` | Fired when the command is rejected due to background session or active tasks (bundle.js:+11813085) |
| Telemetry — `tengu_tui_command` | Fired on a successful renderer change, carrying the new value and process uptime (bundle.js:+11813557) |
| Telemetry — `tengu_amber_creek` | Fired inside fullscreen-mode resolution path (bundle.js:+3339940) |
| Telemetry — `tengu_pewter_brook` | Fired inside fullscreen-mode resolution path (bundle.js:+3339848) |
| Telemetry — `tengu_slate_kestrel` | Fired during account/org tier check within relaunch path (bundle.js:+4655910) |
| Telemetry — `tengu_scroll_summary` | Fired by the scroll-state helper during relaunch (bundle.js:+5270890) |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Background-worker SIGKILL escalation during shutdown (bundle.js:+15060413) |
| Telemetry — `tengu_bg_dispatch_low_mem` | Low-memory eviction of background workers during shutdown (bundle.js:+15060992) |
| Telemetry — `tengu_bg_spare_enable` | Spare background worker enabled (bundle.js:+15061631) |
| Telemetry — `tengu_bg_spare_claim` | Spare worker claimed successfully (bundle.js:+15061752) |
| Telemetry — `tengu_bg_spare_claim_fail` | Spare worker claim failed (bundle.js:+15062015) |
| Telemetry — `tengu_daemon_control` | Daemon lifecycle event during relaunch (bundle.js:+15095752) |
| Settings write | New renderer value persisted to disk via `Lx6` (async file I/O through `TfH.appendFile` / `TfH.writeFile`) |
| Process exec / relaunch | `PV1.spawnSync` with `--resume` flag; process replaces itself (bundle.js:+11809808) |
| Environment variable read | `CLAUDE_CODE_NO_FLICKER` (+11810639), `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` (+11810664), `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL` (+11810703) |
| Signal handler reset | All listeners removed and SIGINT/SIGTERM/SIGHUP re-registered before exec (bundle.js:+11809751/+11809781) |
| Cache clear | `jY` clears two internal caches (`KI6`, `pN8`) before relaunch (bundle.js:+1208953) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.146 | Initial analysis |

---

## Common Mistakes

1. **Running `/tui` inside a background or daemon session** — the command unconditionally rejects the switch with a clear message directing the user to detach first. There is no override flag for this gate.
2. **Running `/tui` while background tasks are active** — tasks in `running`, `pending`, `remote_agent`, or `mcp_task` states block the switch. Use `/tasks` to inspect or stop them first.
3. **Expecting `/tui fullscreen` to work inside tmux with iTerm2 control mode** — the command detects `tmux -CC` automatically and downgrades to `default`. Set `CLAUDE_CODE_NO_FLICKER=1` in the environment to override this safeguard.
4. **Expecting `/tui fullscreen` to work over Windows SSH (ConPTY)** — same automatic downgrade applies; same `CLAUDE_CODE_NO_FLICKER=1` override.
5. **Omitting the argument** — without `default` or `fullscreen`, the command displays the current setting rather than changing it. This is by design but can surprise users who expect an interactive prompt.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Pu7` | Main handler — `tuiCommandHandler` (AsyncFunction, module ZV1) |
| `A` | Argument string (trimmed input) / context variable (multi-use) |
| `f` | Normalized argument / file/stream handle (context-dependent) |
| `q` | File-close helper / fs queue (context-dependent) |
| `L` | Promise/task set manager |
| `e_` | Settings initializer called at startup |
| `gu` | Outer settings load orchestrator |
| `xR` | Settings load sub-helper |
| `Wq` | Performance/memory sampling helper |
| `Wu` | `require` wrapper inside performance sampler |
| `jF8` | Core settings load function (times, logs, merges layers) |
| `h8` | Log-to-file helper |
| `fI6` | Flag settings reader |
| `J16` | Flag/policy settings set manager |
| `mXA` | User settings reader |
| `K` | Table-row formatter (pad columns) |
| `pfH` | Multi-layer settings file locator/reader |
| `qF` | Settings merge helper |
| `bXA` | SDK inline settings reader |
| `KF` | Settings registry builder |
| `D_` | Global state accessor |
| `f86` | Settings field: unknown sub-key 1 |
| `tI8` | Settings field: unknown sub-key 2 |
| `_86` | Settings field: unknown sub-key 3 |
| `ePH` | Settings field: unknown sub-key 4 |
| `M86` | Settings field: unknown sub-key 5 |
| `bfH` | Settings field: unknown sub-key 6 |
| `xfH` | Settings field: unknown sub-key 7 |
| `fF8` | Settings field: unknown sub-key 8 |
| `XXA` | Settings field: unknown sub-key 9 |
| `jl` | Settings field: unknown sub-key 10 |
| `P16` | WSL/platform settings helper |
| `LI6` | Settings load completion hook |
| `O9` | Fullscreen-mode resolution entry |
| `KbH` | Fullscreen capability cache checker |
| `zL_` | Boolean-string to boolean converter (yes/on/no/off) |
| `fK` | "yes"/"on" string normaliser |
| `mH` | Generic string coercion |
| `Vn` | iTerm2 / tmux-CC detection orchestrator |
| `IQ4` | tmux control-mode probe |
| `NQ4` | Terminal name prefix checker (startsWith "iTerm.app") |
| `N` | Logging utility |
| `$wK` | Structured log formatter |
| `n_A` | Log output dispatcher |
| `H` | Raw terminal / process utility (multi-use) |
| `CH` | JSON.stringify wrapper |
| `_` | Generic collection variable |
| `O4` | Log redaction helper |
| `VqA` | Redaction map builder |
| `NRH` | Stream write helper |
| `YqA` | Buffered write helper |
| `YwK` | Append-log writer |
| `sSH` | Buffered batch log flusher |
| `KAH` | Log rotation helper |
| `Q6` | Path utilities accessor |
| `z_6` | Log file path resolver |
| `RqA` | Log file path builder |
| `SqA` | Log file rotation handler |
| `zwK` | Log file write + rotate orchestrator |
| `c9` | Crash reporter register |
| `OL_` | Windows platform detector |
| `kQ4` | Fullscreen state evaluator |
| `N6` | React/Ink UI render host |
| `gf6` | UI render sub-helper 1 |
| `Qf6` | UI render sub-helper 2 |
| `Tt` | UI text component |
| `Ga6` | UI rendering dedup guard |
| `m6` | UI state machine driver |
| `Cq` | Session-kind reader |
| `_3H` | Session context accessor |
| `c` | Generic constant / component variable |
| `G$H` | Fullscreen environment resolver (flicker-reason mapper) |
| `HA` | Relaunch orchestrator (outer) |
| `oO` | Settings + KF composite initializer |
| `wF8` | Settings warm-up helper |
| `RP` | File-read helper (project context) |
| `zl` | File content reader (encoding detection) |
| `f3` | File type checker (FIFO/socket/device) |
| `Gb6` | File read error logger |
| `Tb6` | BOM stripper |
| `J8` | L8 wrapper / path helper |
| `L8` | Low-level error code classifier |
| `XB8` | Timestamp recorder (Dx6 map) |
| `U2H` | Settings + KF context builder |
| `tx6` | Config file path resolver |
| `hq6` | Atomic file write helper (temp + rename) |
| `O` | Symbolic-link checker / background-session state |
| `v8` | Background-session stop helper |
| `jY` | Dual-cache clear (KI6 + pN8) |
| `Lx6` | Renderer settings persist + git-ignore aware writer |
| `x6` | AsyncLocalStorage context getter |
| `Wb6` | Store-accessor wrapper |
| `_B8` | Config Q4 reader |
| `fB8` | Git-check-ignore runner |
| `V_` | Git subprocess runner |
| `XUK` | Home-dir config path builder |
| `MC` | `.claude` settings path builder |
| `SH` | Error normaliser / structured error builder |
| `n_` | Error message extractor |
| `X1` | Stack-trace formatter |
| `lYA` | Stack-line parser |
| `PuK` | Error history ring-buffer |
| `uv` | Terminal-width / IDE-terminal detector |
| `uM6` | Terminal environment reader |
| `DJ` | Terminal name resolver |
| `eL_` | IDE terminal width provider |
| `Tn4` | xterm.js width reader |
| `k$H` | JetBrains terminal width reader |
| `En4` | Terminal-width calculator (parseFloat + Math.min cap) |
| `H7_` | Raw terminal column reader |
| `qg` | React/Ink render entry |
| `Tm` | Ink render orchestrator |
| `kU4` | Ink component factory |
| `wO` | First-party render helper |
| `dO` | Ink render mode selector |
| `Zq6` | Stack formatter for Ink |
| `AK` | Account/feedback eligibility checker |
| `to9` | Feedback config loader |
| `Wz_` | Feedback config parser |
| `om` | Org/account tier resolver |
| `ao9` | Feedback JSON file reader |
| `kGH` | Account fallback string resolver |
| `EV1` | Full relaunch entry point |
| `XJH` | Core exec-relaunch implementation |
| `jx` | Binary path resolver |
| `Xz8` | Version-directory path builder |
| `L6H` | Local bin path builder |
| `FM` | Array.isArray-based value normaliser |
| `HR` | Signal/exit helper reference |
| `S6` | `uV` wrapper (state setter) |
| `uV` | Global app state updater |
| `FY6` | Interval clear helper |
| `lJ_` | clearInterval wrapper |
| `AVH` | Ink unmount + write cleanup |
| `xh` | Ink post-unmount flush |
| `tt6` | ANSI cursor-save/restore writer |
| `Vq8` | Scroll summary + relaunch pre-flight |
| `pV` | Scroll position reader |
| `hLq` | Scroll state serialiser |
| `yLq` | Scroll animation frame driver |
| `OM` | Promise.race timeout utility |
| `MV` | Main session driver |
| `y4` | Session lifecycle manager |
| `tSH` | Queue drain helper (`c_A.drain`) |
| `vq8` | Analytics flush with timeout |
| `r8` | Abort-signal aware timeout |
| `Md_` | Relaunch metadata writer helper |
| `$4` | `uV` alias (secondary state updater) |
| `jV1` | Native `execve` via bun:ffi / dlopen |
| `$` | zS1 wrapper / push queue |
| `w` | Background worker pool manager |
| `M` | Worker exec dispatcher |
| `z` | Worker stop/cleanup helper |
| `ZH` | String coercion wrapper |
| `sX` | Relaunch error metadata file writer |