---
type: feature-spec
feature: "tui"
cc_version: "2.1.165"
updated: "2026-06-05"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.165 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.165 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.165

---

## Overview

The `/tui` command lets the user switch the terminal UI renderer between `default` and `fullscreen` modes at runtime. It validates preconditions (no running background tasks, no environment-level overrides), applies the new renderer setting persistently, and then relaunches the Claude Code process under the selected renderer. Background sessions always use the fullscreen renderer regardless of this setting; the `/tui` preference only affects sessions started directly with `claude`.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| module_id | `z6K` |
| load_inline | `true` |
| loc_byte | `12384970` |
| loc_byte_end | `12385152` |
| loc_line | `8827` |
| arbor_handler.name | `Zyf` |
| arbor_handler.fqn | `claude-2.1.165::Zyf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.165 bundle.js:+12384970

---

## Input Branching

Six or more distinct decision paths exist in the handler, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/tui [arg]"]) --> B[Trim & normalise argument]
    B --> C{Running in daemon\nor daemon-worker mode?}
    C -- Yes --> D[Show background-session notice:\nfullscreen is always used in bg]
    C -- No --> E{Background tasks\nin 'running' / 'pending' /\n'remote_agent' / 'mcp_task' state?}
    E -- Yes --> F[Emit tengu_tui_refused\nReturn error:\nCannot switch renderers while\nbackground tasks are running]
    E -- No --> G{Argument supplied?}
    G -- No / empty --> H[Show current renderer status\nwith fullscreen-eligibility info]
    G -- Yes --> I{Argument is\n'default' or 'fullscreen'?}
    I -- Neither --> J[Show usage error:\nvalid values are 'default' or 'fullscreen']
    I -- Valid --> K{Fullscreen requested\nbut auto-disabled?\n(tmux-CC or Windows-SSH detected)}
    K -- Blocked --> L[Show override hint:\nset CLAUDE_CODE_NO_FLICKER=1\nto force fullscreen]
    K -- Allowed --> M[Persist new renderer choice\nto user settings via settings writer]
    M --> N[Emit tengu_tui_command]
    N --> O[Flush analytics & cleanup]
    O --> P[Relaunch process under\nnew renderer via spawnSync / execve]
```

Analysis basis: CC v2.1.165 bundle.js:+12382868 – +12384686

---

## Behavioral Spec

### 1. Entry point and argument normalisation

The async handler `Zyf` (resolved via `module_id` → `z6K`) is invoked when the user types `/tui [arg]`.

```
async function handleTuiCommand(rawArg):
    arg = rawArg.trim()                     // A.trim  (+12382868)
    normalised = arg.toLowerCase()          // A.toLowerCase (+16160354)

    if processIsInDaemonOrDaemonWorkerMode():
        displayNotice(BG_SESSION_RENDERER_NOTICE)
        return

    checkBackgroundTasksAndMaybeRefuse(normalised)
```

Analysis basis: CC v2.1.165 bundle.js:+12382868

---

### 2. Background-session guard

When the process mode is `daemon` or `daemon-worker` (literals at +2252517 / +2252531), the handler surfaces an informational message and exits early. The notice text explains that background sessions always use the fullscreen renderer and that the `/tui` setting applies only to direct `claude` invocations.

Analysis basis: CC v2.1.165 bundle.js:+12383178 (notice literal), +2252517, +2252531

---

### 3. Background-task block

Before any renderer switch, `Zyf` inspects the active task list obtained via `appState` (via `R_` → `H.getAppState`, +10916285). If any task is in state `running`, `pending`, `remote_agent`, or `mcp_task` (literals at +12383574 – +12383642), the command:

1. Fires the `tengu_tui_refused` telemetry event (+12383663).
2. Returns a user-facing error message directing the user to wait or use `/tasks`.

```
function assertNoActiveTasks(appState):
    activeTasks = appState.tasks.filter(t =>
        t.status in {"running","pending","remote_agent","mcp_task"})
    if activeTasks.length > 0:
        emit("tengu_tui_refused")
        return Error(CANNOT_SWITCH_RENDERER_MSG)   // literal +12383704
```

Analysis basis: CC v2.1.165 bundle.js:+12383574 – +12383704

---

### 4. No-argument path — status display

When `arg` is empty, the handler calls the current-renderer resolver (`Q$` → `H.getAppState`, +10916988) and the fullscreen-eligibility inspector (`NI`, +12384002). It then renders a status panel showing:

- The currently active renderer.
- Whether fullscreen is eligible in this terminal environment (IDE detection, tmux-CC mode, Windows-SSH, terminal dimensions via `CyL`).
- The applicable override environment variables (`CLAUDE_CODE_NO_FLICKER` at +12380703, `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` at +12380728, `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL` at +12380767).

Analysis basis: CC v2.1.165 bundle.js:+12383148 – +12383164

---

### 5. Fullscreen-eligibility check (`NI`)

The eligibility inspector detects several terminal environments before permitting the fullscreen renderer:

```
function computeFullscreenEligibility():
    // JetBrains IDE terminal → yvH.isJetBrainsIdeTerminal (+3512779)
    // "cursor" / "vscode" IDE terminals (+3513456, +3513505)
    // xterm.js-based terminals (+3513625)
    // tmux-CC mode (TERM_PROGRAM includes "screen"/"tmux" AND tmux
    //   display-message -p #{client_control_mode} returns non-empty)
    //   → auto-off reason "tmux_cc_auto_off" (+3440871)
    // Windows over SSH (platform "windows" or "win32", +3439576)
    //   → auto-off reason "win_ssh_auto_off" (+3440905)
    // Returns: { eligible: bool, reason: string, terminalColumns: number }
    //   (terminal columns capped at 20 via Math.min, +3513952)
```

When auto-disabled due to tmux-CC, the literal message includes a hint to set `CLAUDE_CODE_NO_FLICKER=1` (+3440022). Equivalent message for Windows-SSH at +3440208.

Analysis basis: CC v2.1.165 bundle.js:+3512711 – +3513963

---

### 6. Settings persistence

After validation passes, `Zyf` persists the chosen renderer via the settings writer chain (`r_` → `vc6` → file operations, +1278994). The write touches the user-level settings layer (`userSettings`, +1268670); project and local settings layers are also consulted but the write targets the user layer. The writer (`vc6`) handles:

- Atomic rename-on-write using a temporary file with `Zy.rename` / `R8` / `v8`.
- `.txt` extension guard (+205021).
- Directory creation with `FOH.mkdir` (+1124980).
- `gitignore` global-rule check and `write_ineffective` warning (+1279215).

The valid values that may be persisted are the string literals `"fullscreen"` (+3440356) and `"default"` (+3440382).

Analysis basis: CC v2.1.165 bundle.js:+12383891, +1278994, +3440356, +3440382

---

### 7. Telemetry and relaunch

After a successful write:

```
function applyAndRelaunch(newRenderer):
    emit("tengu_tui_command")               // +12384135
    recordUptime(Math.round(process.uptime())) // +12384237
    flushAnalytics(timeout=30000)           // "flush timeout (relaunch)" +12378723
    cleanupInkRenderer(timeout=30000)       // "cleanup timeout" +12378779
    drainWriteQueue()                       // OpH → zXA.drain (+60366)
    writeGitignoreIfNeeded()                // bJ +12379498
    relaunchViaExecve(renderer=newRenderer) // A6K → M.execve (+12378153)
        // sets stdio inherit (+12379311)
        // removes SIGINT/SIGTERM/SIGHUP listeners before exec
```

The relaunch path (`D0H`, +12378504) uses `process.removeAllListeners` (+12379219), re-registers minimal exit handlers, then calls `spawnSync` / `execve` to replace the current process image. On error it writes a `relaunch_spawn_error` record (+12379501) and calls `process.exit`.

Analysis basis: CC v2.1.165 bundle.js:+12384135, +12384237, +12378504 – +12379638

---

### 8. Renderer-mode decision matrix (`gDH`)

The function `gDH` (+12383875) consolidates all signal sources to determine the *effective* fullscreen state before and after the user's change. Reasons it tracks:

| Reason literal | Meaning |
|---|---|
| `bg_forced_on` (+3440767) | Background session forces fullscreen |
| `env_off` (+3440797) | `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` set |
| `env_on` (+3440847) | `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL` set |
| `tmux_cc_auto_off` (+3440871) | tmux control-mode detected |
| `win_ssh_auto_off` (+3440905) | Windows over SSH detected |
| `settings_on` (+3440964) | User settings say fullscreen |
| `settings_off` (+3440998) | User settings say default |
| `downsell_on` (+3441071) | Internal downsell feature flag active |
| `gb_on` (+3441136) | Growth-book flag enables fullscreen |
| `gb_off` (+3441144) | Growth-book flag disables fullscreen |

Analysis basis: CC v2.1.165 bundle.js:+12383875 – +3441144

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_tui_refused` | Fired when background tasks block the renderer switch (+12383663) |
| Telemetry — `tengu_tui_command` | Fired on every successful renderer change (+12384135) |
| Telemetry — `tengu_amber_creek` | Fired inside renderer-decision helper `D6` (+3440539) |
| Telemetry — `tengu_pewter_brook` | Fired inside renderer-decision helper `D6` (+3440447) |
| Telemetry — `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` | Feature-gate result events, fired via `hH` / `RH` / `s6` (+1010222, +1010284, +1010365) |
| Telemetry — `tengu_scroll_summary` | Fired on Ink renderer cleanup (`mO8`, +5447125) |
| Telemetry — `tengu_bg_dispatch_*` / `tengu_daemon_*` / `tengu_bg_spare_*` | Daemon/background-session lifecycle events, indirectly reachable via relaunch path |
| Settings write | Persists `"fullscreen"` or `"default"` to user-level `settings.json` |
| Process replacement | `execve` / `spawnSync` replaces current process with new renderer on success |
| Analytics flush | 30 000 ms hard timeout before relaunch (+12378717) |
| Signal handlers | `SIGINT`, `SIGTERM`, `SIGHUP` listeners removed before `execve` (+12379190 – +12379209) |
| Ink renderer unmount | `H.unmount` called on existing UI before relaunch (+5445369) |
| gitignore check | Global gitignore rule evaluated; warns if settings file would be ignored (+1279074) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.165 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/tui` while a background task is active** — The command will refuse with an explicit error. Stop or wait for all background tasks first (`/tasks` can list them).
2. **Expecting `/tui` to affect background sessions** — Background sessions always use the fullscreen renderer. The `/tui` preference only governs sessions launched directly with `claude`.
3. **Providing an argument other than `default` or `fullscreen`** — Any other value results in a usage error. The argument is case-insensitive (normalised via `toLowerCase`), so `Default` and `FULLSCREEN` are accepted.
4. **Expecting instant effect without restart** — The command always relaunches the process via `execve`. Any unsaved conversation state in the current UI session may be affected; in-progress work should be completed first.
5. **Setting `fullscreen` in tmux iTerm2 integration mode** — The renderer will be auto-disabled at startup with a notice; override requires setting the environment variable `CLAUDE_CODE_NO_FLICKER=1`.
6. **Setting `fullscreen` over a Windows SSH (ConPTY) connection** — Same auto-disable behaviour applies; the same `CLAUDE_CODE_NO_FLICKER=1` override applies.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Zyf` | Main `/tui` command handler (AsyncFunction) |
| `A` | Argument string (trimmed input) / various local aliases |
| `f` | Stream / file handle in background-session close helper |
| `q` | Secondary stream / path / task-list variable |
| `L` | Write-queue tracker / set helper |
| `M1` | Renderer-mode decision orchestrator |
| `ZHH` | Supported-feature gate checker |
| `L2_` | Environment-variable settings reader |
| `eH` | String-to-setting coercion helper |
| `mo` | iTerm2 / tmux detection helper |
| `jNL` | tmux control-mode detector |
| `wNL` | TERM_PROGRAM prefix checker ("screen"/"tmux") |
| `v` | Configuration / version-info resolver |
| `icK` | Build-info accessor |
| `DXA` | Platform-specific constants provider |
| `H` | App-state / HTTP fetch / misc context object |
| `e$` | HTTP response parser |
| `Gw_` | Header field parser |
| `uj` | String replacer utility |
| `e1` | Settings-layer merger |
| `s6` | Feature-bad telemetry emitter |
| `SH` | JSON serialiser wrapper |
| `J4` | Path formatter |
| `c2A` | Path-segment mapper |
| `ppH` | Output writer |
| `C2A` | Raw stream writer |
| `acK` | Append-log file writer |
| `$pH` | Throttled flush scheduler |
| `d3H` | Log-file roller |
| `Q6` | Path join utility |
| `aL6` | Log-header formatter |
| `s2A` | Log-file path builder |
| `a2A` | Log-file rotation helper |
| `ocK` | Append-and-rotate writer |
| `j9` | Write-queue registration helper |
| `K2_` | Windows / platform flag resolver |
| `e_` | Settings-load-from-disk orchestrator |
| `DU` | Settings disk loader |
| `nT` | Settings schema validator |
| `u9` | Memory-usage snapshot helper |
| `Q6_` | Settings loader with telemetry |
| `Kd` | Multi-layer settings merger |
| `$m6` | Post-load settings fixup |
| `JNL` | Renderer effective-state calculator (calls `D6`) |
| `D6` | Core fullscreen enable/disable logic with telemetry |
| `Hj6` | Fullscreen feature-flag reader |
| `_j6` | Fallback renderer reader |
| `qu` | Renderer state union helper |
| `B98` | De-duplicate telemetry tracker |
| `y6` | Renderer-state subscriber / notifier |
| `dR8` | CLI-arg parser for tui-related flags |
| `I46` | Argument token splitter |
| `R_` | Working-directory / allowed-tools appState reader |
| `pk8` | Working-directory extractor |
| `L1` | AppState field accessor |
| `Uk8` | Allowed / disallowed tools extractor |
| `Q$` | Current renderer appState reader |
| `Z9` | Daemon/daemon-worker mode detector |
| `GYH` | Process-mode string classifier |
| `c` | Generic React/Ink component / context value |
| `gDH` | Effective-renderer reason aggregator |
| `r_` | Settings-write orchestrator (gitignore, atomic write) |
| `cO` | Config-path resolver |
| `HzH` | Settings-file path builder |
| `Xl6` | Absolute path resolver for settings |
| `dT4` | Settings directory path helper |
| `Sx` | `.claude` dir path joiner |
| `QT4` | Managed-settings path builder |
| `g6_` | Settings-save entry point |
| `bmA` | Settings deep-merge helper |
| `CmA` | Individual setting applicator |
| `qd` | Settings cache read/write |
| `QJA` | Settings cache getter |
| `jW` | Deep clone (structuredClone wrapper) |
| `U6_` | Setting value normaliser |
| `dJA` | Settings cache setter |
| `SmA` | Settings schema applier |
| `hx` | Setting type coercer |
| `rOH` | Setting validation and formatting |
| `oP` | Project-root locator |
| `Zr` | Config-file reader |
| `R$` | Real-path resolver |
| `xd6` | Byte-order-mark stripper path helper |
| `ud6` | BOM stripper |
| `R8` | Safe-write helper (uses `v8`) |
| `v8` | Atomic file-write implementation |
| `pH_` | Write-timestamp recorder |
| `rTH` | Settings-path-aware write helper |
| `TM6` | Atomic rename-write implementation |
| `O` | lstat / symbolic-link check result |
| `b8` | Error-code extractor |
| `sz` | Settings-cache clearer |
| `vc6` | File-level settings writer |
| `b6` | AsyncLocalStorage context reader |
| `bd6` | Store getter |
| `X_` | Context value extractor |
| `GH_` | File-format formatter |
| `Nc6` | gitignore-check orchestrator |
| `S_` | git check-ignore runner |
| `zE4` | Home-dir tilde expander for excludesfile |
| `GxA` | git ls-files tracker checker |
| `ExA` | gitignore append helper |
| `hH` | Feature-ok telemetry emitter |
| `P6` | Ink render / React render helper |
| `Nu6` | Ink output stream resolver |
| `RH` | Feature-bad telemetry emitter |
| `kH` | Error logger |
| `HA` | Error message formatter |
| `Dq` | Network-layer logger |
| `xSA` | Log-entry formatter |
| `qW4` | Rolling error-buffer manager |
| `NI` | Fullscreen-eligibility inspector |
| `sj6` | Terminal-size reader |
| `FY` | Terminal-type detector |
| `HW_` | IDE-terminal version parser |
| `RyL` | IDE terminal version range checker |
| `Zz` | Non-IDE terminal capability tester |
| `CyL` | Terminal-column calculator (capped at 20) |
| `_W_` | TERM_PROGRAM environment reader |
| `Au` | React rendering entry point |
| `fC` | Ink render bootstrapper |
| `lGL` | Ink instance creator |
| `Z7` | Ink output stream selector |
| `H3` | Ink render options builder |
| `wM6` | Log-to-Ink bridge |
| `W9` | Permissions / policy loader |
| `rL9` | Policy file reader |
| `WIH` | Policy merge helper |
| `TC` | Policy object constructor |
| `XX6` | Policy file parser |
| `q7H` | Policy applicability checker |
| `e4H` | Policy logger |
| `O6K` | Relaunch orchestrator (calls `D0H`) |
| `D0H` | Full relaunch sequence (flush → exec) |
| `NS` | Claude binary path resolver |
| `WZ8` | Version-dir path builder |
| `H1H` | `~/.local/bin` path builder |
| `K3` | Array-check utility |
| `Uk` | Resume-flag injector |
| `S6` | `uv` environment helper |
| `uv` | Process-environment accessor |
| `D06` | Interval clearer |
| `XS_` | clearInterval wrapper |
| `JyH` | Ink unmount and flush helper |
| `DC` | Ink stdout drain |
| `U48` | ANSI cursor-save/restore writer |
| `mO8` | Scroll-summary telemetry emitter |
| `qE` | Scroll count reader |
| `xZ9` | Scroll-limit checker |
| `bZ9` | Scroll-timing calculator |
| `yL` | Promise-race timeout helper |
| `ET` | Analytics flush trigger |
| `d4` | Analytics flush implementation |
| `OpH` | Write-queue drain helper |
| `pO8` | Parallel cleanup runner |
| `l8` | Timeout-with-abort helper |
| `IKA` | Relaunch argument builder |
| `K4` | `uv` path resolver |
| `A6K` | `execve` / native-lib loader |
| `$` | Background-session map / push helper |
| `w` | Background-session dispatcher |
| `M` | `execve` wrapper (bun:ffi) |
| `z` | Process-stop orchestrator |
| `EH` | String error formatter |
| `bJ` | gitignore pre-write helper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.