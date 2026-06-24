---
type: feature-spec
feature: "tui"
cc_version: "2.1.187"
updated: "2026-06-24"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.187 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.187 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.187

---

## Overview

The `/tui` command allows the user to switch the terminal UI renderer between `default` and `fullscreen` modes at runtime. It validates that the switch is currently permissible (checking active background work, screen-reader mode, and environment overrides), persists the chosen renderer to settings, and — when switching into fullscreen — re-launches the current Claude Code process via `execve` to bring the new renderer into effect immediately.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| module_id | `MRl` |
| load_inline | `true` |
| loc_byte | `12437869` |
| loc_byte_end | `12438051` |
| loc_line | `8448` |
| arbor_handler.name | `Zmf` |
| arbor_handler.fqn | `claude-2.1.187::Zmf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.187 bundle.js:+12437869

---

## Input Branching

The command has more than three distinct decision branches (no argument vs. `default` vs. `fullscreen`; background-work guard; screen-reader guard; environment-override guard; and the fullscreen upsell/renderer-decision path). A Mermaid flowchart is therefore used.

```mermaid
flowchart TD
    A(["/tui [arg]"]) --> B{arg provided?}
    B -- "no" --> C[Show current renderer status\nand available options]
    B -- "yes" --> D{arg in allowed list?\n'default' | 'fullscreen'}
    D -- "no" --> E[Return error:\nInvalid renderer value]
    D -- "yes" --> F{Background work running?\nrunning | pending |\nremote_agent | mcp_task}
    F -- "yes" --> G[Emit tengu_tui_refused\nReturn error: cannot switch\nwhile work is in background]
    F -- "no" --> H{Screen-reader mode active?}
    H -- "yes" --> I[Display notice:\nscreen-reader forces classic renderer;\ntui setting has no effect]
    H -- "no" --> J{Resolve effective renderer\nvia fullscreen-decision logic}
    J --> K{Environment / policy\noverride active?\nCLAUDE_CODE_NO_FLICKER,\nCLAUDE_CODE_DISABLE_ALTERNATE_SCREEN,\nor force-fullscreen env}
    K -- "env override" --> L[Display effective renderer\nwith override reason]
    K -- "no override" --> M{Requested mode == 'fullscreen'?}
    M -- "no (default)" --> N[Persist 'default' to settings\nDisplay confirmation]
    M -- "yes" --> O{Fullscreen supported?\nCheck terminal compat:\ntmux -CC, Windows/SSH,\nJetBrains, cursor/vscode xterm.js}
    O -- "not supported" --> P[Display downsell warning\nwith reason string]
    O -- "supported" --> Q[Persist 'fullscreen' to settings\nEmit tengu_tui_command\nRelaunch process via execve]
```

Analysis basis: CC v2.1.187 bundle.js:+12435488 – +12437508

---

## Behavioral Spec

### 1. Argument Parsing and Allowed-Value Validation

```
async function tuiCommandHandler(rawArg, appContext):
    trimmedArg = rawArg.trim()                        // bundle.js:+12435488

    allowedValues = ["default", "fullscreen"]         // bundle.js:+12435600, +12435646

    if trimmedArg is empty:
        return renderCurrentStatusView(appContext)

    if trimmedArg not in allowedValues:
        return renderErrorView("Unknown renderer: " + trimmedArg)

    proceed to background-work guard
```

Analysis basis: CC v2.1.187 bundle.js:+12435488

---

### 2. Background-Work Guard

Before allowing a renderer switch, the handler inspects all active tasks. If any task is in one of the live states, the switch is refused with a telemetry event.

```
function backgroundWorkGuard(appContext):
    activeStates = ["running", "pending", "remote_agent", "mcp_task"]
    // bundle.js:+12436344, +12436366, +12436387, +12436412

    if any session in appContext.sessions has state in activeStates:
        emit telemetry "tengu_tui_refused"            // bundle.js:+12436433
        return Error(
            "Cannot switch renderers while work is running in the background"
            + " — wait for it to finish (or stop it via /tasks),"
            + " then run /tui again."
        )                                             // bundle.js:+12436474
    return OK
```

Analysis basis: CC v2.1.187 bundle.js:+12436344

---

### 3. Screen-Reader Mode Check

```
function screenReaderCheck(appContext):
    if screenReaderModeIsActive(appContext):          // bundle.js:+12435994
        displayNotice(
            "Screen-reader mode always uses the classic renderer,"
            + " so the tui setting has no effect while it is active."
        )                                             // bundle.js:+12436008
        // does NOT persist anything; returns early
        return EARLY_EXIT
    return CONTINUE
```

Analysis basis: CC v2.1.187 bundle.js:+12435994

---

### 4. Background-Session Notice

If the session context reveals the current session is a background session, a separate informational notice is displayed before proceeding.

```
function backgroundSessionNotice():
    displayInfo(
        "Background sessions always use the fullscreen renderer so"
        + " scrolling and mouse work when attached."
        + " The tui setting applies to sessions started directly with `claude`."
    )                                                 // bundle.js:+12435798
```

Analysis basis: CC v2.1.187 bundle.js:+12435798

---

### 5. Fullscreen-Decision / Effective-Renderer Resolution

This is handled by the fullscreen-decision function (mapped to `resolveEffectiveRenderer` below), which walks through a priority-ordered list of override signals and returns both a renderer string and a reason code.

```
function resolveEffectiveRenderer(requestedMode, environmentContext):
    // Priority order (first match wins):

    // 1. Background session forces fullscreen
    if isBackgroundSession():
        return {renderer: "fullscreen", reason: "bg_forced_on"}  // +3556788

    // 2. Screen-reader auto-disables fullscreen
    if screenReaderActive():
        return {renderer: "default", reason: "sr_auto_off"}      // +3556817

    // 3. CLAUDE_CODE_NO_FLICKER or CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN env off
    if envVarDisablesFullscreen():
        return {renderer: "default", reason: "env_off"}          // +3556846

    // 4. Force-fullscreen env variable
    if envVarForcesFullscreen():
        return {renderer: "fullscreen", reason: "env_on"}        // +3556896

    // 5. tmux -CC (iTerm2 integration mode) auto-disables
    if tmuxCCModeDetected():
        return {renderer: "default", reason: "tmux_cc_auto_off"} // +3556920
        // message: "fullscreen disabled: tmux -CC (iTerm2 integration mode)
        //           detected · set CLAUDE_CODE_NO_FLICKER=1 to override"
        //           bundle.js:+3555946

    // 6. Windows over SSH (ConPTY) auto-disables
    if windowsOverSSHDetected():
        return {renderer: "default", reason: "win_ssh_auto_off"} // +3556954
        // message: "fullscreen disabled: Windows over SSH (ConPTY re-rendering)
        //           detected · set CLAUDE_CODE_NO_FLICKER=1 to override"
        //           bundle.js:+3556132

    // 7. User settings explicit value
    if userSettings.tui == "fullscreen":
        return {renderer: "fullscreen", reason: "settings_on"}   // +3557013
    if userSettings.tui == "default":
        return {renderer: "default", reason: "settings_off"}     // +3557047

    // 8. Upsell / gate-based override
    if downsellApplies():
        return {renderer: "fullscreen", reason: "downsell_on"}   // +3557120

    // 9. Growth-book / feature-flag
    if featureFlagOn():
        return {renderer: "fullscreen", reason: "gb_on"}         // +3557185
    else:
        return {renderer: "default", reason: "gb_off"}           // +3557193
```

Analysis basis: CC v2.1.187 bundle.js:+3556788

---

### 6. Terminal Compatibility Check (Fullscreen Path)

When the requested mode is `fullscreen`, the handler probes the running terminal environment before committing.

```
function checkFullscreenCompatibility(terminalContext):
    // JetBrains IDE terminal detection
    if isJetBrainsIdeTerminal():                      // bundle.js:+3626506
        return INCOMPATIBLE

    // cursor / vscode via xterm.js version range
    termProgram = detectTerminalProgram()             // bundle.js:+3626438
    // programs checked: "ghostty">=1.2.0, "iTerm.app">=3.6.6,
    //                   "cursor", "vscode" via xterm.js version
    //                   in range [1092000, 1105000]  // bundle.js:+3627307,+3627318
    if termProgram in supportedSet:
        return COMPATIBLE
    else:
        return INCOMPATIBLE
```

Analysis basis: CC v2.1.187 bundle.js:+3626438

---

### 7. Settings Persistence

```
function persistRendererChoice(mode):
    // mode is "fullscreen" or "default"
    writeToUserSettings({tui: mode})                  // via ao / settings pipeline
    // Settings pipeline resolves through:
    // userSettings (settings.json)   bundle.js:+1316718
    // projectSettings                bundle.js:+1316782
    // localSettings (settings.local.json) bundle.js:+1316804
```

Analysis basis: CC v2.1.187 bundle.js:+12435784 (settings write path `Ws`)

---

### 8. Process Relaunch (Fullscreen Switch)

When switching to fullscreen and compatibility is confirmed, Claude Code re-executes itself via `execve` so the new renderer is in effect from process startup.

```
async function relaunchProcess(currentArgv, environment):
    // 1. Tear down current Ink/JSX render tree
    unmountCurrentRenderer()                          // bundle.js:+7228741

    // 2. Flush analytics
    await drainAnalytics(timeout=2000ms)              // bundle.js:+12431044
    // "cleanup timeout"                              // bundle.js:+12431049

    // 3. Remove all signal listeners; re-register SIGINT/SIGHUP for relaunch
    process.removeAllListeners()                      // bundle.js:+12431489
    process.on("SIGINT", ...)                         // bundle.js:+12431519
    process.on("SIGHUP", ...)

    // 4. Spawn successor via spawnSync with "inherit" stdio
    result = spawnSync(execPath, args, {stdio: "inherit"})  // bundle.js:+12431546,+12431581

    // 5. Exit current process with successor's exit code
    //    Exit code base: 128                         // bundle.js:+12431908
    process.exit(successorExitCode)                   // bundle.js:+12431795

    // On relaunch failure: emit "relaunch_spawn_error" // bundle.js:+12431771
    //                       write error to disk via oT  // bundle.js:+12431768
```

Analysis basis: CC v2.1.187 bundle.js:+12431489

---

### 9. Telemetry Emission on Success

```
function emitTuiCommandTelemetry(details):
    emit "tengu_tui_command" with {             // bundle.js:+12436906
        uptime: Math.round(process.uptime()),  // bundle.js:+12437008, +12436997
        session_timing: "same_session"         // bundle.js:+12437352
                    or  "later_session"        // bundle.js:+12437367
    }
```

Analysis basis: CC v2.1.187 bundle.js:+12436906

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_tui_refused` | Fired when a renderer switch is blocked because background work is active (bundle.js:+12436433) |
| Telemetry: `tengu_tui_command` | Fired on a successful renderer change, carrying uptime and session-timing metadata (bundle.js:+12436906) |
| Telemetry: `tengu_amber_creek` | Fired during the renderer-decision / settings-read path (bundle.js:+3556463) |
| Telemetry: `tengu_pewter_brook` | Fired during the renderer-decision / settings-read path (bundle.js:+3556371) |
| Telemetry: `tengu_scroll_summary` | Fired during the scrollback teardown phase before relaunch (bundle.js:+7231176) |
| Settings write | Persists `tui: "fullscreen"` or `tui: "default"` to user settings file (`settings.json` or `settings.local.json`) |
| Process relaunch | When switching to fullscreen, the current process is replaced via `spawnSync` + `process.exit`; stdio is set to `"inherit"` (bundle.js:+12431581) |
| Ink/JSX unmount | Current renderer is torn down (unmounted) before relaunch (bundle.js:+7228741) |
| Analytics drain | 2 000 ms timeout drain ("cleanup timeout") before relaunch (bundle.js:+12431044) |
| Signal listeners | All listeners removed; SIGINT and SIGHUP are re-registered for the relaunch sequence (bundle.js:+12431489, +12431519) |
| Environment variables consulted | `CLAUDE_CODE_NO_FLICKER`, `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN`, `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL` (bundle.js:+12432949, +12432974, +12433013) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | Active renderer mode reflected in app state; polled by background-work guard via `Object.values` on session map (bundle.js:+12436305) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.187 | Initial analysis |

---

## Common Mistakes

1. **Running `/tui fullscreen` while a background task is active.** The command refuses the switch and emits `tengu_tui_refused`. Stop or wait for all background tasks (`/tasks`) before changing the renderer.
2. **Expecting an instant in-session switch.** Switching to `fullscreen` triggers a full process relaunch via `spawnSync`. Any unsaved in-memory conversation state that was not already persisted will be resumed via the `--resume` flag (bundle.js:+12430920); plan accordingly.
3. **Setting `/tui fullscreen` in a screen-reader session.** The screen-reader mode unconditionally forces the classic renderer. The setting is silently overridden and a notice is displayed (bundle.js:+12436008).
4. **Overlooking environment-variable overrides.** `CLAUDE_CODE_NO_FLICKER=1` or `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1` suppress fullscreen regardless of the `/tui` setting. The effective renderer may differ from what the setting says.
5. **Using `/tui` in a background session.** Background sessions always use the fullscreen renderer irrespective of the `/tui` setting (reason code `bg_forced_on`, bundle.js:+3556788).
6. **Providing a value other than `default` or `fullscreen`.** Only those two string literals are accepted; any other value (e.g. `/tui on`, `/tui 1`) is rejected.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Zmf` | Main handler for `/tui` command (AsyncFunction resolved via module_id `MRl`) |
| `Rqt` | Top-level JSX command wrapper / renderer entry point |
| `qMe` | Core relaunch orchestrator: tears down renderer, flushes, re-executes process |
| `TF` | Claude version-directory path resolver |
| `B2n` | Local version-path builder (joins `.local/share/claude/versions`) |
| `Im` | Array normalisation helper used in version-path resolution |
| `Nee` | Alternative path builder (joins `.local` segment) |
| `Xae` | Home-directory-relative path builder |
| `qMn` | OS home-directory accessor |
| `pR` | Process argument vector accessor |
| `kt` | Process metadata / VL wrapper |
| `VL` | Process environment/version value helper |
| `jFt` | Interval-clear helper (stops the heartbeat timer) |
| `Xto` | Inner `clearInterval` wrapper |
| `U9e` | Renderer unmount orchestrator (writes to fd, drains map, unmounts Ink) |
| `OU` | Post-unmount cleanup helper |
| `yTn` | Terminal restore / alternate-screen exit writer |
| `Q$e` | Terminal capability probe (ghostty, iTerm version check) |
| `V$e` | Alternate-screen restore escape sequence emitter (`\x1b7` / `\x1b8`) |
| `Nw` | tmux/screen escape-sequence normaliser (`\x1b\x1b` replacement) |
| `sp` | Low-level stderr/stdout sync-write helper |
| `T` | Logging / debug-output formatter |
| `oPn` | Scrollback summary flush initiator |
| `Iga` | Scroll-summary timing calculator (`Date.now`, `Math.max`, `Math.round`) |
| `bs` | Fullscreen-decision evaluator (returns effective renderer + reason code) |
| `J$` | Feature-flag set membership check |
| `mx` | Feature-flag `isEnabled` gate |
| `p9r` | Platform-type resolver (returns "windows", etc.) |
| `fZ` | Kud-based feature-flag wrapper |
| `d9r` | Boolean coercion helper for feature flags |
| `Ur` | Upsell / downsell renderer gate |
| `zud` | Inner upsell decision logic |
| `it` | Telemetry event emitter (`tengu_*`) |
| `Dc` | Timeout-wrapped Promise race (used for flush/drain timeouts) |
| `HC` | Analytics handler-chain init |
| `Rc` | Analytics pipeline resolver |
| `Ei` | Analytics event registrar (`b6o.register`) |
| `$Ke` | Analytics drain caller (`b6o.drain`) |
| `$9e` | Promise-resolve-based async continuation helper |
| `ePn` | Async step helper for relaunch sequence |
| `q0o` | Path-resolution helper for binary re-exec (dirname lookup) |
| `gr` | VL-based process path getter |
| `ic` | VL-based install path helper |
| `CRl` | `execve` / native re-exec launcher (dlopen, Buffer.from, BigInt, ptr) |
| `i` | Native FFI handle (dlopen result) |
| `n` | Platform string normaliser (toLowerCase) |
| `r` | Active-connection set tracker |
| `s` | Promise-chain add/finally/delete helper |
| `l` | Log-push / JNl wrapper |
| `JNl` | Journal/log entry constructor |
| `f` | Daemon session manager / worker-pool loop |
| `D` | Supervisor process descriptor |
| `Kn` | Timeout-promise race helper ("aborted" / "abort") |
| `Re` | Feature-flag OK path (`tengu_feature_ok`) |
| `Le` | Feature-flag OK path (alternate branch) |
| `GXn` | Low-memory telemetry helper (`tengu_bg_low_mem_mb`) |
| `N2e` | Session state-file lstat/rm/readFile helper |
| `ke` | Render / Ink component mount helper |
| `U` | Daemon idle-exit timer (`tengu_daemon_idle_exit`) |
| `C3o` | Socket-claim / daemon-connect helper |
| `x3o` | Session lifecycle manager (spawn, roster, claim, cleanup) |
| `p` | Forced-shutdown helper (`process.exit`) |
| `cn` | Error-code string normaliser |
| `Pe` | `rKe` error-boundary wrapper |
| `F` | Interval dispose helper (`clearInterval`) |
| `c` | Background-session label constant ("background session") / En wrapper |
| `En` | App-name / label constant provider |
| `a` | MCP / agent integration entry point (execve, brr, hla) |
| `a9e` | MCP server connection builder |
| `brr` | MCP update applicator (`applyMcpUpdate`) |
| `hla` | MCP quick-connection resolver (`tQr`) |
| `uBo` | MCP client roster / retry manager |
| `u` | Daemon background-session controller (Le, Re, CU, X6) |
| `CU` | Analytics queue push helper |
| `X6` | Multi-daemon race/all controller (`process.exit` on timeout) |
| `be` | String coercion wrapper |
| `oT` | Error file writer (`Ore.writeFileSync`) |
| `PIe` | Feature-flag check at registration site (`ali.isEnabled`) |
| `eYn` | CLI argument array builder (cliArg/session/--add-dir flags) |
| `GPe` | Argument element formatter |
| `nCe` | Dt-based telemetry helper with Boolean coerce |
| `Dt` | Settings-disk access guard / watcher |
| `Wt` | Config-path resolver |
| `MOo` | Config object merge helper |
| `_Ee` | Config file reader with backup/migration logic |
| `MRf` | Config watcher / file-watch setup |
| `Or` | App-state working-directory / allowed-tools extractor |
| `G8n` | `working_directory` field reader from app state |
| `os` | App-state field accessor |
| `W8n` | `avoid_prompts` / `disallowed_tools` field reader |
| `N2` | Permission-mode / bypass-permissions helper |
| `Vh` | App-state effort/model/max-thinking extractor |
| `Ws` | Settings-write / nUe persistence helper |
| `nUe` | Underlying settings serialiser |
| `_Ce` | Fullscreen-decision helper (reason-code emitter, calls `bs` sub-functions) |
| `ao` | Settings-load orchestrator (reads all layers: policy, flag, user, project, local) |
| `Jm` | Settings file set builder (lbe, l2) |
| `lbe` | Per-layer settings file path builder |
| `fsn` | Settings file path resolver (resolve/dirname) |
| `Plu` | Settings path normaliser |
| `g9` | `.claude` directory path builder |
| `Dlu` | Managed-settings path builder |
| `l2` | Settings-layer descriptor builder |
| `rCt` | WSL-aware config-path normaliser |
| `QEr` | Settings merge / conflict resolver |
| `Nls` | Settings key merging helper |
| `JEr` | Settings entry conflict resolver |
| `DG` | Cache get/set wrapper (`xsr`) |
| `X5o` | Cache get (`xsr.get`) |
| `kN` | `structuredClone` wrapper |
| `jEr` | Settings entry parser / validator |
| `J5o` | Cache set (`xsr.set`) |
| `Pls` | SDK inline settings parser |
| `jpe` | Settings layer enum helper (Llu/Rlu/Mlu) |
| `rYe` | Settings validation-error formatter |
| `DC` | Settings-file read helper (XJ) |
| `XJ` | File reader with encoding detection (UTF-16/BOM/CRLF) |
| `Nd` | Real-path resolver (`realpathSync`) |
| `Mrn` | File-size guard (`4096` byte limit) |
| `Drn` | Slice helper for file read |
| `kn` | `cn`-based error-string helper |
| `lEr` | Ion-set timestamp writer |
| `Q1e` | Settings quick-load (fsn + l2) |
| `oIt` | Atomic file write helper (temp + rename + fsync) |
| `E7e` | xattr/extended-attribute error handler |
| `Me` | `JSON.stringify` wrapper |
| `bH` | Cache clear helper (`YYt.clear`, `xsr.clear`) |
| `Fis` | Gitignore / git-check-ignore integration |
| `Pt` | Async-local-storage store getter |
| `xrn` | Store accessor (`Rrn.getStore`) |
| `qyr` | `cu`-based context resolver |
| `Eon` | Gitignore check runner |
| `Wr` | `git check-ignore` executor |
| `lau` | Path absolutiser for gitignore check |
| `Nis` | Gitignore negative-match handler |
| `Uis` | Gitignore result accumulator |
| `Mt` | Feature-flag "sad" path (`tengu_feature_sad`) |
| `PG` | Settings-load performance tracer (`loadSettingsFromDisk_start/end`) |
| `qL` | Settings-load inner step |
| `ta` | `perf_hooks` / `require`-based performance-entry writer |
| `K3` | `require("perf_hooks")` wrapper |
| `ZEr` | Settings-load event logger (`settings_load_started/completed`) |
| `vn` | Append-file log writer (`s.appendFileSync`) |
| `JYt` | Settings-load timing accumulator |
| `nCt` | Settings-change-set tracker (`t.add`, `pT.filter`, `t.has`) |
| `o` | Column-padding map helper (`i.padEnd`) |
| `XYt` | Settings-load result finaliser |
| `JO` | Terminal-program / fullscreen-support detector |
| `oMt` | Terminal-program name reader |
| `A_` | Terminal-env variable reader |
| `i4r` | Terminal-version string parser / comparator |
| `ahd` | Version-range check helper |
| `R_` | Terminal-env fallback reader |
| `lhd` | Column-count / terminal-width measurer (`parseFloat`, `Math.min`) |
| `a4r` | Raw terminal-width accessor |
| `q9` | React-state / M2 state accessor |
| `M2` | App-state store (uid, zH, I1e) |
| `uid` | Session UID generator |
| `nt` | String-conversion utility |
| `Nl` | Notification / Ir event emitter |
| `zH` | App-state field holder |
| `I1e` | Inner state initialiser (jns) |
| `jns` | State-node string converter |
| `Js` | Telemetry consent / feature-flag resolver |
| `nSi` | Consent resolver entry (Qz wrapper) |
| `Qz` | Consent decision tree (K9, cxt, Bme) |
| `K9` | Consent level selector |
| `cxt` | Consent file reader (`eSi.readFileSync`) |
| `Bme` | Consent string matcher (`n.some`, `t.includes`, `qQ`) |
| `Vi` | Consent-level validator (`jns`) |
| `Lme` | Consent-level string-to-enum converter |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.