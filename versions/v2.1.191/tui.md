---
type: feature-spec
feature: "tui"
cc_version: "2.1.191"
updated: "2026-06-25"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.191 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.191 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.191

---

## Overview

The `/tui` command lets the user switch the terminal UI renderer between `default` (classic inline) and `fullscreen` (alternate-screen) modes during a live Claude Code session. It validates preconditions—screen-reader state, active background work, and environment compatibility—before persisting the new renderer preference and triggering a session re-launch via `execve`. The effective renderer is determined by a multi-factor policy chain that can override the user's choice.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| module_id | `B$l` |
| load_inline | `true` |
| loc_byte | `12547602` |
| loc_byte_end | `12547784` |
| loc_line | `8397` |
| arbor_handler.name | `pLf` |
| arbor_handler.fqn | `claude-2.1.191::pLf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.191 bundle.js:+12547602

---

## Input Branching

The handler (resolved as `pLf` via Arbor module_id path) contains more than three distinct decision branches; a Mermaid flowchart is used below.

```mermaid
flowchart TD
    A["/tui [argument]"] --> B{Argument provided?}
    B -- No --> C[Show current renderer status\nand available options]
    B -- Yes --> D{Argument valid?\n'default' or 'fullscreen'}
    D -- No --> E[Return error:\ninvalid argument]
    D -- Yes --> F{Screen-reader mode active?}
    F -- Yes --> G[Emit info message:\ntui setting has no effect\nwhile screen-reader is active\nbundle.js:+12545740]
    F -- No --> H{Background work running?\nstate: 'running' | 'pending'\n'remote_agent' | 'mcp_task'\nbundle.js:+12546076..12546144}
    H -- Yes --> I[Emit error + fire tengu_tui_refused\nCannot switch renderers while\nwork is running bundle.js:+12546206]
    H -- No --> J{Effective renderer policy\ncheck via resolveRendererMode\nbundle.js:+12546378}
    J --> K{Policy overrides\nrequested value?}
    K -- Yes / constrained --> L[Explain constraint\ne.g. tmux -CC detected,\nWindows SSH detected, etc.]
    K -- No --> M[Persist new renderer setting\nvia writeSettings bundle.js:+12546394]
    M --> N[Fire tengu_tui_command\nbundle.js:+12546639]
    N --> O[Compute session context\nsame_session / later_session\nbundle.js:+12547085]
    O --> P{Session context}
    P -- same_session --> Q[Trigger relaunch via\nspawnSync + execve\nbundle.js:+12541277]
    P -- later_session --> R[Confirm setting saved;\ntakes effect next session]
```

---

## Behavioral Spec

### 1. Argument Parsing

```
function parseTuiArgument(rawInput):
    trimmed = rawInput.trim()                         // pLf → n.trim, loc +12545220
    if trimmed is empty:
        return SHOW_STATUS
    normalized = trimmed.toLowerCase()
    validModes = resolveValidModes()                   // DPo.join / DPo.includes, loc +12545332/+12545378
    if normalized not in validModes:
        return INVALID_ARGUMENT_ERROR
    return normalized                                  // 'default' | 'fullscreen'
```

Analysis basis: CC v2.1.191 bundle.js:+12545220

---

### 2. Precondition Checks

#### 2a. Screen-reader guard

```
function checkScreenReaderMode(appState):
    srActive = queryScreenReaderEnabled()              // Bk → Smi.isEnabled, loc +12545726
    if srActive:
        emit INFO "Screen-reader mode always uses the classic renderer,
                   so the tui setting has no effect while it is active."
                                                       // literal loc +12545740
        return BLOCKED
    return PASS
```

Analysis basis: CC v2.1.191 bundle.js:+12545726

#### 2b. Background-work guard

```
function checkNoBackgroundWork(appState):
    activeStates = ['running', 'pending', 'remote_agent', 'mcp_task']
                                                       // literals loc +12546076..+12546144
    anyActive = appState.tasks.some(t => activeStates.includes(t.state))
                                                       // e → o.some, loc +12546037
    if anyActive:
        emit ERROR "Cannot switch renderers while work is running in
                    the background — wait for it to finish (or stop it
                    via /tasks), then run /tui again."
                                                       // literal loc +12546206
        fire telemetry tengu_tui_refused               // loc +12546165
        return BLOCKED
    return PASS
```

Analysis basis: CC v2.1.191 bundle.js:+12546076

---

### 3. Renderer Policy Resolution (`resolveRendererMode` / `Zve`)

The effective renderer is computed by a policy chain with multiple override reasons. Each reason may force or suppress fullscreen regardless of the user's stored preference.

```
function resolveRendererMode(requestedMode, environment):
    // Policy priority order (highest to lowest):
    // 1. bg_forced_on  — background session always forces fullscreen
    //                    literal loc +3537580
    if isBackgroundSession(environment):
        return { effective: 'fullscreen', reason: 'bg_forced_on' }

    // 2. sr_auto_off   — screen-reader disables fullscreen
    //                    literal loc +3537609
    if screenReaderEnabled():
        return { effective: 'default', reason: 'sr_auto_off' }

    // 3. env_off / env_on — CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN or
    //                       CLAUDE_CODE_NO_FLICKER env vars
    //                       literals loc +12542705 / +12542680
    if env.CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN:
        return { effective: 'default', reason: 'env_off' }

    // 4. tmux_cc_auto_off — tmux -CC (iTerm2 integration) detected
    //                       literal loc +3537713; message loc +3536734
    if tmuxCCModeDetected():
        return { effective: 'default', reason: 'tmux_cc_auto_off' }

    // 5. win_ssh_auto_off — Windows over SSH (ConPTY) detected
    //                       literal loc +3537747; message loc +3536920
    if windowsOverSSH():
        return { effective: 'default', reason: 'win_ssh_auto_off' }

    // 6. settings_on / settings_off — user persisted preference
    //                       literals loc +3537806 / +3537840
    if userSettingExists():
        return { effective: userSetting, reason: userSetting == 'fullscreen'
                                                 ? 'settings_on' : 'settings_off' }

    // 7. gb_on / gb_off — gradual rollout gate
    //                       literals loc +3537978 / +3537986
    return { effective: gradualRolloutDecision(), reason: 'gb_on' | 'gb_off' }
```

Telemetry events `tengu_amber_creek` (loc +3537252) and `tengu_pewter_brook` (loc +3537159) are fired inside this policy resolver.

Analysis basis: CC v2.1.191 bundle.js:+12546378

---

### 4. Persist and Apply

```
async function persistAndApply(mode, sessionContext):
    writeRendererSetting(mode)                        // uo → settings write chain, loc +12546394
    fire telemetry tengu_tui_command                  // loc +12546639

    context = determineSessionContext()               // 'same_session' | 'later_session'
                                                      // literals loc +12547085 / +12547100
    if context == 'same_session':
        // Flush pending I/O, then execve-relaunch with --resume flag
        // --resume literal loc +12540651
        // flush timeout: 30 000 ms literal loc +12540718
        // cleanup timeout: 2 000 ms literal loc +12540775
        await flushAndDrain(timeout=30000)
        unmountCurrentUI()                            // O5e → e.unmount, loc +12540679
        relaunchViaSyncSpawn(args=['--resume'])       // O$l.spawnSync, loc +12541277
    else:
        displayConfirmation("Setting saved; takes effect next session.")
```

Analysis basis: CC v2.1.191 bundle.js:+12546394, +12541277

---

### 5. Relaunch Sequence Detail

When a same-session switch is requested, the following teardown/relaunch sequence runs (all under handler `kPe`):

```
function relaunchSession():
    // 1. Pause scroll summarizer
    pauseScrollSummarizer()                           // QBt → Fao → clearInterval, loc +12540673

    // 2. Unmount Ink/JSX UI layer
    unmountUI()                                       // O5e, loc +12540679

    // 3. Start new renderer render context
    startNewRenderer()                                // fUn, loc +12540685

    // 4. Register async cleanup hooks
    registerCleanupHooks()                            // vC → Fc → _i, loc +12540713

    // 5. Drain analytics queue with timeout
    drainAnalytics(timeout=2000)                      // Nze → xqo.drain, loc +12540769

    // 6. Await analytics flush promise with timeout=30000
    awaitAnalyticsFlush(timeout=30000)                // U5e, loc +12540825
                                                      // label "analytics flush timeout", loc +12540836

    // 7. Handle process signals (SIGINT, SIGHUP)
    process.removeAllListeners()                      // loc +12541220
    process.on('SIGINT', ...)                         // loc +12541250
    process.on('SIGHUP', ...)                         // loc +12541210

    // 8. execve-relaunch
    spawnSync(process.execPath, ['--resume', ...args],
              { stdio: 'inherit' })                   // O$l.spawnSync, loc +12541277

    // 9. On spawn error, write error file and exit
    if spawnError:
        writeErrorFile()                              // fT → $oe.writeFileSync, loc +12541499
        fire 'relaunch_spawn_error'                   // literal loc +12541502
        process.exit(128)                             // literal loc +12541639

    // 10. Kill parent if still alive
    process.kill(process.pid, 'SIGTERM')              // loc +12541591
```

Analysis basis: CC v2.1.191 bundle.js:+12540673

---

### 6. Terminal Compatibility Detection (`x1` / fullscreen capability check)

Before offering or applying fullscreen mode, the handler calls a terminal capability detector:

```
function detectFullscreenCapability(env):
    // Check IDE terminals that cannot support alternate screen
    if isVSCodeTerminal() or isCursorTerminal():      // literals loc +3608110 / +3608159
        return UNSUPPORTED
    if isJetBrainsIdeTerminal():                      // x1 → w1.isJetBrainsIdeTerminal, loc +3607434
        return UNSUPPORTED
    if isXtermJsTerminal():                           // literal loc +3608279
        checkVersionRange(1092000, 1105000)           // literals loc +3608235 / +3608246
    // Check platform
    if platform == 'darwin':                          // literal loc +3607643
        // Check ghostty >= 1.2.0, iTerm.app >= 3.6.6
        if termProgram == 'ghostty':                  // literal loc +3604138
            requireVersion('1.2.0')                   // literal loc +3604168
        if termProgram == 'iTerm.app':                // literal loc +3604207
            requireVersion('3.6.6')                   // literal loc +3604239
    if platform == 'win32':                           // literal loc +3607690
        return UNSUPPORTED
    // Query terminal via escape sequence
    sendEscapeQuery()                                 // $_ → Yh, escape save/restore loc +3882264/+3882275
    response = awaitReply(timeout, fallback='(no reply)')
                                                      // literal loc +3607538
    return assessResponse(response)
```

Analysis basis: CC v2.1.191 bundle.js:+3607366

---

### 7. Status Display (no argument)

```
function showTuiStatus(appState):
    effectiveMode = resolveRendererMode(storedSetting, env)
    storedSetting = readRendererSetting()
    // Reads app state via Ur / Km
    appStateMode = getAppState()                      // Ur → e.getAppState, loc +12545500
                                                      // Km → e.getAppState, loc +12546394 (read path)
    bgSessionNote = "Background sessions always use the fullscreen renderer..."
                                                      // literal loc +12545530
    displayTable(effectiveMode, storedSetting, bgSessionNote)
```

Analysis basis: CC v2.1.191 bundle.js:+12545500

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_tui_refused` | Fired when background work blocks a renderer switch (bundle.js:+12546165) |
| Telemetry: `tengu_tui_command` | Fired on every successful renderer preference write (bundle.js:+12546639) |
| Telemetry: `tengu_amber_creek` | Fired inside renderer policy resolver — fullscreen path (bundle.js:+3537252) |
| Telemetry: `tengu_pewter_brook` | Fired inside renderer policy resolver — default/restricted path (bundle.js:+3537159) |
| Telemetry: `tengu_scroll_summary` | Fired by scroll summarizer teardown during relaunch (bundle.js:+7344996) |
| Telemetry: `tengu_api_success` | Fired by API layer exercised during session flush (bundle.js:+8938998) |
| Settings persistence | New renderer mode written to user settings via `uo` / settings write chain (bundle.js:+12546394) |
| Process relaunch | On same-session switch: `process.removeAllListeners`, `spawnSync` with `--resume`, `process.kill` (bundle.js:+12541220–+12541591) |
| UI unmount | Ink/JSX render tree unmounted via `e.unmount` before relaunch (bundle.js:+12540679) |
| Scroll summarizer | Interval cleared via `clearInterval` before relaunch (bundle.js:+12540673) |
| Analytics drain | `xqo.drain` called with 2 000 ms timeout; analytics flush awaited with 30 000 ms timeout (bundle.js:+12540769, +12540718) |
| Error file | On spawn failure, error written via `$oe.writeFileSync` and exit code 128 returned (bundle.js:+12541499, +12541639) |
| Environment variables consulted | `CLAUDE_CODE_NO_FLICKER`, `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN`, `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL` (bundle.js:+12542680, +12542705, +12542744) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.191 | Initial analysis |

---

## Common Mistakes

1. **Running `/tui fullscreen` while a background task is active** — The command will be refused with the message "Cannot switch renderers while work is running in the background" and fire `tengu_tui_refused`. Use `/tasks` to stop background work first.
2. **Expecting `/tui` to affect background (daemon) sessions** — Background sessions always use the fullscreen renderer regardless of this setting (`bg_forced_on` policy). The setting only applies to sessions started directly with `claude`.
3. **Running in a terminal that auto-suppresses fullscreen** — Environments such as tmux `-CC` (iTerm2 integration mode) or Windows over SSH will silently downgrade the renderer to `default` (`tmux_cc_auto_off` / `win_ssh_auto_off`). Set `CLAUDE_CODE_NO_FLICKER=1` to override the tmux -CC detection.
4. **Running `/tui` while screen-reader mode is active** — The command completes without error but has no effect; the screen-reader mode always forces the classic renderer.
5. **Expecting an instant switch without a session restart** — For same-session changes, the entire Claude Code process restarts via `spawnSync` + `execve`. Any unsaved context that was not yet persisted may be affected.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `pLf` | Main async handler for `/tui` command (Arbor-resolved, `AsyncFunction`) |
| `PKt` | Top-level `/tui` command registration + dispatch wrapper |
| `kPe` | Session relaunch orchestrator (teardown → execve) |
| `m$` | Config / versions path resolver |
| `X4n` | Version directory path builder |
| `xm` | Array check utility (used in path assembly) |
| `$te` | Local share path resolver (`~/.local/share/claude/…`) |
| `cce` | Claude bin path resolver |
| `X1n` | Home directory path helper |
| `GR` | Session guard / state reader |
| `wt` | Logger / warning emitter |
| `ux` | Core logger sink |
| `QBt` | Scroll summarizer lifecycle controller |
| `Fao` | Scroll summarizer interval clearer |
| `O5e` | UI unmount + terminal reset handler |
| `Pvn` | Terminal alternate-screen escape writer |
| `$Be` | Terminal version comparator (ghostty / iTerm.app) |
| `Jw` | tmux / screen escape prefix normalizer |
| `fUn` | New renderer startup / frame initiator |
| `qCa` | Render frame timer / rate controller |
| `WCa` | Frame scheduling helper |
| `ks` | Renderer mode determination (fullscreen eligibility) |
| `U2` | Local-agent detection helper |
| `Bk` | Screen-reader detection (`Smi.isEnabled` wrapper) |
| `kGr` | Runtime environment classifier |
| `cee` | Environment context assembler |
| `RGr` | Windows platform guard |
| `Rr` | Log recorder / event logger |
| `CSd` | Default-mode fallback selector |
| `nt` | Settings reader / config accessor |
| `$c` | Promise timeout race helper |
| `vC` | Async cleanup hook registrar |
| `Fc` | Cleanup hook chain executor |
| `_i` | Hook registry entry registrar (`xqo.register`) |
| `Nze` | Analytics queue drainer (`xqo.drain`) |
| `U5e` | Analytics flush awaiter with timeout |
| `cUn` | Analytics flush completion callback |
| `kPo` | Post-relaunch path resolution helper |
| `Hr` | Logger context builder |
| `dc` | Directory context logger |
| `D$l` | execve / FFI relaunch executor |
| `rGl` | FFI call recorder |
| `Yer` | Background process memory-low handler |
| `I3e` | Crash dump / state file cleaner |
| `Le` | Error logger with stack |
| `Mjo` | Background session socket connector |
| `Fjo` | Background session lifecycle manager (spawn/retire) |
| `p` | Forced shutdown handler (`process.exit`) |
| `Pe` | Promise/error wrapper |
| `a` | MCP + environment initialization orchestrator |
| `s5e` | MCP server connection initializer |
| `Gar` | MCP update applier |
| `w_a` | MCP reconnect scheduler |
| `hGo` | MCP client slot manager |
| `u` | Background session stop handler |
| `pF` | First-party flag evaluator |
| `BG` | Background session race/exit coordinator |
| `fT` | Relaunch error file writer |
| `Hve` | Screen-reader state checker (outer guard) |
| `aZn` | CLI argument assembler for relaunch |
| `D1e` | CLI flag collector |
| `Fve` | Settings flag reader (Boolean coercion) |
| `kt` | Native binary loader / Bun FFI manager |
| `tEt` | Native binary installer / version migrator |
| `K9f` | Native binary watcher / hot-reload |
| `Ur` | App-state reader (working_directory, allowed_tools, etc.) |
| `zKn` | Working-directory state extractor |
| `YKn` | Tool-allow/deny-list state extractor |
| `AB` | Permission-mode / bypass-permissions state reader |
| `Km` | Effort/model/thinking-tokens state reader |
| `Ks` | Daemon-worker context checker |
| `HCe` | Daemon worker mode flag |
| `Zve` | Renderer mode policy resolver (multi-factor chain) |
| `uo` | Settings write + gitignore integration handler |
| `sg` | Settings file path router |
| `VTe` | Settings file path builder (project / user / local) |
| `Iln` | Settings path resolver (resolve + dirname) |
| `gyu` | Runtime settings path getter |
| `c4` | `.claude/settings.json` path builder |
| `myu` | Managed-settings path builder |
| `z2` | Settings layer aggregator (all layers) |
| `Lwt` | WSL-aware settings path resolver |
| `EIr` | Settings loader from disk |
| `Yms` | Settings file parser + merger |
| `yIr` | Settings JSON reader |
| `Cj` | Settings cache get/set |
| `rqo` | Settings cache reader (`Zcr.get`) |
| `oqo` | Settings cache writer (`Zcr.set`) |
| `iD` | Deep clone helper (`structuredClone`) |
| `hIr` | Settings object transformer / normalizer |
| `Kms` | Inline SDK settings parser |
| `gme` | Settings format validator |
| `QXe` | Settings schema builder / field describer |
| `VC` | Settings context assembler |
| `WQ` | Settings file reader (readFileSync) |
| `jd` | File real-path resolver |
| `jin` | Path existence checker |
| `vn` | Error normalizer (`dn` wrapper) |
| `wTr` | Cache timestamp recorder |
| `GUe` | Settings path + layer combiner |
| `Rvt` | Atomic file writer (temp + rename + fsync) |
| `hXe` | fchmod error classifier (EINVAL / EPERM etc.) |
| `ius` | File-write property definer |
| `ke` | JSON serializer (`JSON.stringify`) |
| `kH` | Settings cache invalidator (`sZt.clear` / `Zcr.clear`) |
| `Yps` | Settings file write orchestrator |
| `Dt` | Async store / context getter |
| `Gin` | Async local storage getter (`Bin.getStore`) |
| `uTr` | Settings write helper (`_u`) |
| `Ran` | Gitignore check runner |
| `Kr` | Git command executor |
| `BHu` | Home-relative path normalizer |
| `Kps` | Gitignore already-tracked checker |
| `zps` | Gitignore append helper |
| `Lt` | Feature flag: settings-write outcome logger |
| `vj` | Settings load performance tracer |
| `cx` | Performance trace start |
| `ia` | Memory-usage sampler |
| `O9` | `perf_hooks` require wrapper |
| `SIr` | Settings load timing recorder |
| `Ln` | Log file appender |
| `aZt` | Load-timing accumulator |
| `wwt` | Load-tracking Set manager |
| `iZt` | Load timing finalizer |
| `x1` | Terminal fullscreen capability detector |
| `DPt` | Terminal environment variable reader |
| `Yh` | Terminal escape sequence sender |
| `Ijr` | Terminal response parser |
| `FId` | Terminal response classifier |
| `$_` | Terminal query with escape-save/restore |
| `$Id` | xterm.js version extractor |
| `Cjr` | xterm.js version string parser |
| `$4` | JSX render context builder |
| `yB` | React/Ink root provider |
| `Khd` | Ink render bootstrapper |
| `rt` | String coercion utility |
| `jl` | React renderer (`_r` binding) |
| `e_` | Ink exit handler |
| `nme` | Ink render helper |
| `ncs` | Ink render core |
| `vs` | Telemetry consent / product-feedback checker |
| `Hvi` | Analytics enabled-state resolver |
| `G4` | Analytics gate combiner |
| `gF` | Analytics disable-flag checker |
| `PDt` | Analytics config file reader |
| `che` | Analytics hostname/platform filter |
| `Yi` | Analytics essential-traffic gate |
| `Qge` | Analytics settings reader |
| `W` | Logger warn emitter |
| `T` | Logger / i18n text helper |
| `Ae` | String coercion wrapper |
| `Re` | Feature-ok telemetry emitter |
| `we` | Feature-ok telemetry emitter (alternate) |
| `wN` | API request executor (fetch-based) |
| `L6o` | Conversation history formatter |
| `S4` | Async feature flag evaluator |
| `usm` | Context summarizer |
| `hsm` | History-to-text serializer |
| `M6n` | Tool-use block finder |
| `cSt` | Feature-sad telemetry emitter |
| `D6n` | Schema safe-parse wrapper |
| `dsm` | Context tip dispatch helper |
| `e` | Ink render instance / session manager |
| `o` | Column formatter / map helper |
| `n` | Generic node / process handle |
| `r` | Generic resource / stream handle |
| `s` | Generic set / stream |
| `l` | Generic list / loader |
| `f` | Background worker dispatch function |
| `D` | Daemon worker process handle |
| `F` | Daemon worker retire/settle handler |
| `i` | FFI / socket instance |
| `c` | Background session constructor |
| `a` | (also) Session initialization context |
| `u` | (also) Session stop context |
| `p` | (also) Exit / abort context |
| `t` | Generic token / text node |
| `An` | Background session factory |
| `dn` | Error descriptor builder |
| `U` | Disposable resource handle |
| `up` | Structured logger |
| `JQ` | JSON schema helper |
| `JAt` | Settings JSON access helper |
| `Tdr` | Settings tier descriptor |
| `zAt` | Settings merge utility |
| `N1e` | Namespace resolver |
| `U1e` | User-level settings accessor |
| `ZAt` | Zone/scope accessor |
| `xse` | Cross-scope settings entry |
| `KTe` | Key transform helper |
| `Dln` | Settings delta logger |
| `dgs` | Diagnostics gatherer |
| `Win` | BOM / encoding stripper |
| `wTr` | (also) Write-cache timestamp setter |
| `GUe` | (also) Settings path combiner |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.