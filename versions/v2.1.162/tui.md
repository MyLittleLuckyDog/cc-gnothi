---
type: feature-spec
feature: "tui"
cc_version: "2.1.162"
updated: "2026-06-04"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.162 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.162 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.162

---

## Overview

The `/tui` command switches the terminal UI renderer between `default` and `fullscreen` modes for the current Claude Code session. It validates the requested mode against environment and platform constraints (e.g., tmux control-mode, Windows-over-SSH), checks for active background tasks that would block a renderer switch, and then performs a live process relaunch using `execve`-style replacement to activate the selected renderer.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| module_id | `Ntq` |
| load_inline | `true` |
| loc_byte | `12323760` |
| loc_byte_end | `12323942` |
| loc_line | `8685` |
| arbor_handler.name | `DNf` |
| arbor_handler.fqn | `claude-2.1.162::DNf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.162 bundle.js:+12323760

---

## Input Branching

The command has more than 3 distinct execution branches (no argument, `default`, `fullscreen`, background-task guard, constraint overrides, and relaunch path), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/tui [arg]"]) --> B[Trim argument, normalize to lower-case]
    B --> C{Valid mode?\n'default' | 'fullscreen'\nor empty}
    C -- "invalid string" --> D[Return error: valid values are 'default' and 'fullscreen']
    C -- "empty / no arg" --> E[Show current renderer setting + background-session note]
    C -- "'default' or 'fullscreen'" --> F[Check fullscreen constraints via constraintCheck]
    F --> G{Constraint result}
    G -- "bg_forced_on" --> H[Force fullscreen because background mode is active]
    G -- "env_off\n(CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN set)" --> I[Fullscreen disabled by env var]
    G -- "env_on\n(CLAUDE_CODE_NO_FLICKER=1)" --> J[Override: allow fullscreen despite flicker guard]
    G -- "tmux_cc_auto_off\n(tmux -CC detected)" --> K["Block fullscreen: tmux -CC (iTerm2) detected\n· set CLAUDE_CODE_NO_FLICKER=1 to override"]
    G -- "win_ssh_auto_off\n(Windows/ConPTY over SSH)" --> L["Block fullscreen: Windows over SSH detected\n· set CLAUDE_CODE_NO_FLICKER=1 to override"]
    G -- "settings_on / settings_off" --> M[Respect user/project settings value]
    G -- "gb_on / gb_off" --> N[Respect gradual-rollout gate value]
    G -- "no constraint / allowed" --> O[Proceed to background-task guard]
    K --> O2[Return warning message to user]
    L --> O2
    H --> O
    I --> O2
    J --> O
    M --> O
    N --> O
    O --> P{Any background tasks\nin 'running' | 'pending'\nstates of type\n'remote_agent' | 'mcp_task'?}
    P -- "yes" --> Q["Emit tengu_tui_refused\nReturn: cannot switch while tasks are running\n— wait or /tasks to stop"]
    P -- "no" --> R[Persist new renderer setting via settings writer]
    R --> S[Emit tengu_tui_command with selected mode]
    S --> T[Render background-session informational note\nif applicable]
    T --> U[Execute process relaunch via execve replacement\n(Xtq → M.execve)]
```

Analysis basis: CC v2.1.162 bundle.js:+12321658 (handler entry), +12321816 (mode validation), +12322325 (background-task scan), +12322494 (refused message), +12322925 (telemetry emit), +12323375 (relaunch path)

---

## Behavioral Spec

### 1. Argument Parsing and Mode Normalization

```
async function tuiCommandHandler(context):
    rawArg = context.args.trim()                      // +12321658
    mode   = rawArg.toLowerCase()                     // +16022288

    validModes = ["default", "fullscreen"]            // +3425219, +3425245

    if mode != "" and mode not in validModes:
        return errorMessage("valid values: default | fullscreen")
```

Analysis basis: CC v2.1.162 bundle.js:+12321658, +12321816

---

### 2. Query / No-Argument Path

```
    if mode == "":
        currentSetting = readCurrentRendererSetting()
        displayNote(BACKGROUND_SESSION_NOTE)          // +12321968
        return displayCurrentSetting(currentSetting)
```

The background-session informational note (bundle.js:+12321968) explains that background sessions always use the fullscreen renderer regardless of this setting, and that `/tui` only affects sessions launched directly with `claude`.

Analysis basis: CC v2.1.162 bundle.js:+12321968

---

### 3. Fullscreen Constraint Resolution

The constraint resolver (mapped from `GYH`, called at +12322665) evaluates a priority-ordered set of signals and returns a named reason code:

```
function resolveFullscreenConstraint(env, platform, settings):
    if backgroundModeActive():
        return "bg_forced_on"                         // +3425630

    if env.CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN set:
        return "env_off"                              // +3425660

    if env.CLAUDE_CODE_NO_FLICKER == "1":
        return "env_on"                               // +3425710

    if isTmuxControlMode():                           // tmux -CC via spawnSync +3424155
        return "tmux_cc_auto_off"                     // +3425734

    if isWindowsOverSSH():                            // platform=="windows" +3424439
        return "win_ssh_auto_off"                     // +3425768

    if settings.fullscreen == true:
        return "settings_on"                          // +3425827

    if settings.fullscreen == false:
        return "settings_off"                         // +3425861

    if gradualRolloutGate():
        return "gb_on"                                // +3425999
    else:
        return "gb_off"                               // +3426007
```

**tmux control-mode detection** (mapped from `jEL` / `JEL`): checks whether the terminal prefix starts with `"iTerm.app"` (+3423877) or session type contains `"screen"` / `"tmux"` (+3423945, +3423970), then runs `tmux display-message -p #{client_control_mode}` (+3424155) with a 2000 ms timeout (+3424229). If the result equals `"yes"` (+27104) or `"on"` (+27110), control mode is confirmed.

**Windows-over-SSH detection**: checks `platform == "windows"` (+3424439).

**Warning messages** returned to the user:
- tmux-CC: `"fullscreen disabled: tmux -CC (iTerm2 integration mode) detected · set CLAUDE_CODE_NO_FLICKER=1 to override"` (+3424885)
- Windows/SSH: `"fullscreen disabled: Windows over SSH (ConPTY re-rendering) detected · set CLAUDE_CODE_NO_FLICKER=1 to override"` (+3425071)

Analysis basis: CC v2.1.162 bundle.js:+3425630, +3425734, +3425768, +3424885, +3425071

---

### 4. Background-Task Guard

```
function checkBackgroundTaskGuard(appState):
    blockedStatuses = ["running", "pending"]          // +12322364, +12322386
    blockedTypes    = ["remote_agent", "mcp_task"]    // +12322407, +12322432

    activeTasks = Object.values(appState.tasks)       // +12322325
        .filter(task => task.status in blockedStatuses
                     and task.type in blockedTypes)

    if activeTasks.length > 0:
        emit("tengu_tui_refused")                     // +12322453
        return REFUSED_MESSAGE                        // +12322494

    return null   // proceed
```

Refused message literal: `"Cannot switch renderers while background tasks are running — wait for them to finish (or stop them via /tasks), then run /tui again."` (+12322494)

Analysis basis: CC v2.1.162 bundle.js:+12322325, +12322453, +12322494

---

### 5. Settings Persistence

When no guard blocks the switch, the handler calls the settings writer (mapped from `r_`, entry +12322681) to persist the chosen renderer mode. The write path passes through:

- Settings-file resolver (`gP` / `wr`) which reads and merges `settings.json`, `settings.local.json`, and managed-settings files (+1266227, +1266601, +1263165).
- Atomic write helper (`u56`) using `openSync` / `writeFileSync` / `fsyncSync` / `renameSync` (+1055825–+1056077) to prevent partial writes.
- Cache invalidation (`cz`) that clears in-memory maps (`Lu6.clear`, `VB8.clear`) after the write (+26768, +26780).

Analysis basis: CC v2.1.162 bundle.js:+12322681, +1275517, +1055825

---

### 6. Telemetry Emission

```
function emitTuiCommandTelemetry(selectedMode, constraintReason):
    emit("tengu_tui_command", {          // +12322925
        mode:   selectedMode,
        reason: constraintReason
    })
    emit("tengu_amber_creek", ...)       // +3425402  (fullscreen constraint audit)
    emit("tengu_pewter_brook", ...)      // +3425310  (renderer decision audit)
```

Analysis basis: CC v2.1.162 bundle.js:+12322925, +3425402, +3425310

---

### 7. Process Relaunch (execve replacement)

After persisting the setting, the handler triggers a full process replacement so the new renderer takes effect immediately. The relaunch flow (mapped from `iWH` / `Vtq`, called at +12323375) proceeds as:

```
async function processRelaunch(context):
    // 1. Flush pending analytics (drain queue)
    await drainAnalyticsQueue()                       // cmH / jJA.drain +60166
        with timeout 30000 ms                         // +12317507
        label "flush timeout (relaunch)"

    // 2. Flush pending scroll/render state
    await flushScrollSummary()                        // S38 / tengu_scroll_summary +5425682
        with timeout 500 ms                           // +5425971
        label "cleanup timeout"                       // +12317569

    // 3. Unmount active Ink components
    unmountActiveComponents()                         // ckH / H.unmount +5423946

    // 4. Remove all process signal listeners
    process.removeAllListeners()                      // +12318009

    // 5. Re-register minimal signal handlers (SIGINT, SIGTERM, SIGHUP)
    process.on("SIGINT", ...)                         // +12317980
    process.on("SIGTERM", ...)                        // +12317989
    process.on("SIGHUP", ...)                         // +12317999

    // 6. Write relaunch state file via mj (XpH.writeFileSync +192252)

    // 7. Spawn replacement process (spawnSync) via Wtq.spawnSync +12318066
    //    with stdio: "inherit"                        // +12318101
    //    Passing --resume flag                        // +12317440

    // 8. If spawn fails, emit "relaunch_spawn_error"  // +12318291

    // 9. Exit current process (exit code from child)
    process.exit(exitCode)                            // +12318315
```

The native-library loading path (`Xtq`) used on macOS loads `/usr/lib/libSystem.B.dylib` (+12316588) or `libc.so.6` (+12316617) via `bun:ffi` (+12316544) to call `execve` directly (+12316943).

Timeouts observed:
- Analytics flush timeout: 30 000 ms (`"flush timeout (relaunch)"` +12317513)
- Cleanup / render flush timeout: 500 ms (+5425971)

Analysis basis: CC v2.1.162 bundle.js:+12323375, +12317507, +12318066, +12318315, +12316943

---

### 8. Settings Load on Startup (background reference path)

The handler also calls the settings loader (`i_` / `_U`, +12322201 and +12321683) on startup to determine the current effective renderer. Key signals within the loader:

- Telemetry: `"loadSettingsFromDisk_start"` (+1274076), `"loadSettingsFromDisk_end"` (+1274132)
- Sub-events: `"settings_load_started"` (+1270690), `"settings_load_completed"` (+1271419)
- Sources layered: `policySettings` (+1270819), `flagSettings` (+1271084), `userSettings`, `projectSettings`, `localSettings` (+1265891, +1265955, +1265977)

Analysis basis: CC v2.1.162 bundle.js:+1274076, +1274132

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_tui_command` | Fired after a valid mode is accepted and persisted (bundle.js:+12322925) |
| Telemetry — `tengu_tui_refused` | Fired when background tasks block the switch (bundle.js:+12322453) |
| Telemetry — `tengu_amber_creek` | Fullscreen-constraint audit event (bundle.js:+3425402) |
| Telemetry — `tengu_pewter_brook` | Renderer-decision audit event (bundle.js:+3425310) |
| Telemetry — `tengu_scroll_summary` | Emitted during relaunch flush phase (bundle.js:+5425682) |
| Telemetry — `tengu_feature_ok` / `tengu_feature_sad` / `tengu_feature_bad` | General feature outcome hooks reached via settings write path (bundle.js:+1008233, +1008376, +1008295) |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Background process dispatch (bundle.js:+15996373) |
| Telemetry — `tengu_bg_dispatch_low_mem` | Low-memory background dispatch (bundle.js:+15996974) |
| Telemetry — `tengu_bg_spare_enable` / `tengu_bg_spare_claim` / `tengu_bg_spare_claim_fail` | Background spare-slot management (bundle.js:+15997678, +15997806, +15998072) |
| Telemetry — `tengu_daemon_control` | Daemon lifecycle event (bundle.js:+16032559) |
| Settings write | Writes the chosen renderer value (`"fullscreen"` or `"default"`) to the applicable settings JSON file atomically |
| In-memory cache | `Lu6` and `VB8` maps cleared after write (bundle.js:+26768, +26780) |
| Process replacement | `process.removeAllListeners()` + `spawnSync` + `process.exit()` — the current process is replaced (bundle.js:+12318009, +12318066, +12318315) |
| Signal handlers | SIGINT, SIGTERM, SIGHUP listeners removed and re-registered during relaunch (bundle.js:+12317980–+12318039) |
| Ink components | All active Ink UI components unmounted before relaunch (bundle.js:+5423946) |
| Environment variables read | `CLAUDE_CODE_NO_FLICKER` (+12319493), `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` (+12319518), `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL` (+12319557) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.162 | Initial analysis |

---

## Common Mistakes

1. **Running `/tui fullscreen` while background tasks are active** — the command will refuse with an explicit error message and emit `tengu_tui_refused`. Use `/tasks` to stop or wait for completion first.
2. **Expecting the change to apply without a restart** — the command performs a full `execve`-style process replacement; the terminal session will briefly reset.
3. **Setting `fullscreen` in a tmux `-CC` (iTerm2 integration) session** — the constraint resolver will automatically downgrade to `default` with a warning unless `CLAUDE_CODE_NO_FLICKER=1` is set in the environment.
4. **Expecting `/tui` to affect background (`daemon`) sessions** — background sessions always use the fullscreen renderer regardless of this setting; the command only controls sessions started directly with `claude`.
5. **Passing an unrecognized mode string** (e.g., `/tui auto`) — the handler will return an error; only `default` and `fullscreen` are accepted.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `DNf` | Main async handler for `/tui` command (arbor_handler) |
| `A` | Argument string variable / generic local accumulator |
| `f` | Generic stream/file handle variable |
| `q` | Generic queue / secondary local variable |
| `L` | Generic set / list variable |
| `M1` | Fullscreen-availability check orchestrator |
| `LHH` | Feature-flag lookup helper |
| `pX_` | Environment variable reader for fullscreen off/on |
| `tH` | String conversion utility |
| `ko` | Fullscreen constraint evaluator (wraps `jEL`) |
| `jEL` | tmux control-mode detection launcher |
| `JEL` | Terminal prefix / iTerm check helper |
| `v` | Generic value / settings-merge helper |
| `PgK` | User-agent / HTTP helper |
| `PJA` | HTTP header builder |
| `H` | Generic context / HTTP fetch helper (multi-role) |
| `_3` | HTTP response body reader |
| `AY_` | Header-field parser |
| `bJ` | String replacement helper |
| `a1` | JSON parse / validation helper |
| `t6` | Feature-event emitter helper |
| `SH` | JSON serializer wrapper |
| `V4` | Path/version string parser |
| `rXA` | Platform map iterator |
| `WpH` | Output write wrapper |
| `pXA` | Low-level stdout write helper |
| `EgK` | Log/output file writer |
| `dmH` | Buffered output/timer manager |
| `E3H` | Log-entry formatter |
| `i6` | File-existence / stat check helper |
| `zL6` | Versioned-path resolver |
| `_PA` | Settings path joiner |
| `HPA` | Settings file rotate/rename helper |
| `GgK` | Settings file appender/writer |
| `J9` | Hook registrar (`jJA.register`) |
| `mX_` | Windows-SSH fullscreen block checker |
| `i_` | Settings loader entry point |
| `_U` | Settings load orchestrator |
| `pT` | Settings cache pre-check |
| `C9` | Memory-usage sampler during settings load |
| `IH_` | Core settings-load executor |
| `gQ` | Settings layer merger |
| `fu6` | Post-load settings finalizer |
| `XEL` | Session-type / renderer startup resolver |
| `j6` | Renderer-session state manager |
| `zw6` | Renderer mode constant (default) |
| `Dw6` | Renderer mode constant (fullscreen) |
| `Hu` | Session-store initializer |
| `U18` | Active-session tracker |
| `C6` | Conversation state updater |
| `hS8` | CLI argument parser for relaunch args |
| `gK6` | Argument-flag enumerator |
| `b_` | App-state reader for working directory / tools |
| `VI8` | Allowed-tools extractor |
| `K1` | Tool-list normalizer |
| `NI8` | Disallowed-tools extractor |
| `Q$` | App-state reader for effort/model/thinking |
| `T9` | Daemon-mode type checker |
| `szH` | Daemon/daemon-worker string matcher |
| `c` | Feature-event OK emitter |
| `GYH` | Fullscreen constraint reason resolver (priority chain) |
| `r_` | Settings writer / persistence orchestrator |
| `gO` | Settings path builder |
| `COH` | Settings file-path resolver (all layers) |
| `jc6` | Per-layer settings path resolver |
| `L04` | Managed-settings path helper |
| `Ix` | `.claude` directory path helper |
| `K04` | Managed-settings file locator |
| `vH_` | Settings-write pre-processor |
| `xxA` | Settings object key enumerator / merger |
| `bxA` | Settings validation / schema checker |
| `FQ` | In-memory settings cache reader/writer |
| `iwA` | Settings cache getter (`VB8.get`) |
| `uj` | Deep-clone helper (`structuredClone`) |
| `ZH_` | Settings diff / patch applier |
| `rwA` | Settings cache setter (`VB8.set`) |
| `RxA` | Settings merge finalizer |
| `vx` | Settings schema validator |
| `IOH` | Settings field-level validator / error reporter |
| `gP` | Settings file reader (raw) |
| `wr` | File reader with BOM/encoding detection |
| `R$` | Real-path resolver (`realpathSync`) |
| `CQ6` | File-read helper |
| `bQ6` | File content slicer |
| `R8` | Error-wrapping helper |
| `V8` | ENOENT / filesystem error handler |
| `Te8` | Timestamp recorder (`yd6.set`) |
| `yTH` | Settings path + merge helper |
| `u56` | Atomic file writer (open/write/fsync/rename) |
| `O` | Generic object / symlink helper |
| `x8` | Generic exit/status helper |
| `cz` | Settings in-memory cache clear |
| `Zd6` | gitignore / settings file writer with gitignore guard |
| `x6` | Async-local-storage context getter |
| `RQ6` | Store getter helper |
| `X_` | Notification / event emitter helper |
| `Ke8` | n4 settings node accessor |
| `Td6` | git check-ignore runner |
| `C_` | git command executor |
| `I24` | Path normalizer (tilde expansion, absolute check) |
| `ZCA` | git ls-files tracker check |
| `VCA` | gitignore rule appender |
| `hH` | Feature-bad event emitter helper |
| `Z6` | Feature-event dispatcher |
| `Zx6` | Base feature-event emitter |
| `RH` | Feature-error/bad event helper |
| `kH` | Log-buffer manager / error logger |
| `t_` | Error string formatter |
| `wq` | Log-queue writer |
| `UyA` | Log-entry tH formatter |
| `Gj4` | Log-queue shift/push manager |
| `JI` | Terminal-size / columns detector |
| `fJ6` | Column-count fallback |
| `bD` | Terminal-size reader |
| `CP_` | IDE terminal width resolver (cursor/vscode) |
| `CNL` | IDE-specific column resolver |
| `Tz` | OS/platform-specific column fallback |
| `bNL` | Column sanitizer (parseFloat, Math.min, max=20) |
| `bP_` | xterm.js column resolver |
| `ex` | Ink render initializer |
| `HC` | Ink renderer factory |
| `f2L` | Ink render-instance creator |
| `W5` | First-party analytics marker |
| `qO` | Ink render mount helper |
| `k56` | Ink log-output helper |
| `W9` | Theme / color-scheme loader |
| `FK9` | Theme file resolver |
| `rvH` | Theme loader orchestrator |
| `JC` | Default theme object builder |
| `vj6` | Theme file reader |
| `ULH` | Theme inclusion checker |
| `u4H` | tH theme-name formatter |
| `Vtq` | Relaunch orchestrator (top-level) |
| `iWH` | Full process-replacement executor |
| `GS` | Claude binary path resolver |
| `KT8` | Version-directory walker |
| `mAH` | Local-bin path builder |
| `L3` | Array normalizer |
| `Rk` | Relaunch argument builder |
| `S6` | Nv-based notification helper |
| `Nv` | Generic notification/event emitter |
| `VW6` | Interval-clear helper (`Fy_`) |
| `Fy_` | clearInterval wrapper |
| `ckH` | Ink component unmounter |
| `LC` | Active-component registry helper |
| `uK8` | Terminal escape-sequence writer (save/restore cursor) |
| `S38` | Scroll-summary flusher (emits `tengu_scroll_summary`) |
| `rG` | Scroll renderer helper |
| `vE9` | Scroll-state reader |
| `NE9` | Scroll-metrics calculator |
| `gL` | Promise.race timeout helper |
| `YT` | Hook-run coordinator |
| `U4` | Pre-exit hook runner |
| `cmH` | Analytics queue drainer (`jJA.drain`) |
| `R38` | Shutdown sequence orchestrator |
| `n8` | Abort-signal / timeout helper |
| `p9A` | Relaunch argument assembler |
| `M4` | Nv path helper |
| `Xtq` | execve / process-replacement caller (native FFI) |
| `$` | Generic map / process pool |
| `w` | Background-session process manager |
| `M` | execve call site / module loader |
| `z` | Generic cleanup / signal manager |
| `TH` | String converter helper |
| `mj` | Relaunch state file writer (`XpH.writeFileSync`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.