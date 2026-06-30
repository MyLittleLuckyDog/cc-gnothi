---
type: feature-spec
feature: "tui"
cc_version: "2.1.196"
updated: "2026-06-30"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.196 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.196 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.196

---

## Overview

The `/tui` command allows users to switch the terminal UI renderer between `default` and `fullscreen` modes during an active Claude Code session. It validates the requested mode against a set of environment constraints (background sessions, screen-reader mode, active background tasks, tmux-CC detection, Windows-over-SSH detection) before writing the setting and optionally relaunching the current process with the new renderer. The command returns a JSX UI component reflecting the new state or an informational refusal message.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| loc_byte | `12818080` |
| loc_byte_end | `12818262` |
| loc_line | `8804` |
| module_id | `$Jl` |
| load_inline | `true` |
| arbor_handler.name | `Izf` |
| arbor_handler.fqn | `claude-2.1.196::Izf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.196 bundle.js:+12818080

---

## Input Branching

The command has 5+ distinct decision branches (no argument vs. known value vs. unknown value, plus refusal paths for background-session lock, screen-reader lock, and active-work lock). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/tui [arg]"] --> B{Argument supplied?}
    B -- No --> C[Display current setting + available modes]
    B -- Yes --> D{Trim & check arg value}
    D -- unknown value --> E[Return error: valid values are 'default' and 'fullscreen']
    D -- 'default' or 'fullscreen' --> F{Background session active?}
    F -- Yes --> G["Refusal: background sessions always use fullscreen renderer\n(tengu_tui_refused)"]
    F -- No --> H{Screen-reader mode enabled?}
    H -- Yes --> I["Refusal: screen-reader mode always uses classic renderer\n(tengu_tui_refused)"]
    H -- No --> J{Active background tasks present?\n(running/pending/remote_agent/mcp_task)}
    J -- Yes --> K["Refusal: cannot switch while work running in background\n(tengu_tui_refused)"]
    J -- No --> L[Resolve effective renderer via getEffectiveRenderer]
    L --> M{Requested == current effective renderer?}
    M -- same_session --> N[Emit tengu_tui_command, return JSX confirming no change needed]
    M -- later_session --> O[Write setting to config store via settingsWriter]
    O --> P[Emit tengu_tui_command, return JSX with confirmation]
```

Analysis basis: CC v2.1.196 bundle.js:+12815698 – +12817719

---

## Behavioral Spec

### 1. Argument Parsing

```
async function tuiCommandHandler(context, rawArg):
    trimmedArg = rawArg.trim()                         // Izf → n.trim, +12815698
    validModes  = ["default", "fullscreen"]            // f5o.join, f5o.includes, +12815810/+12815856

    if trimmedArg is empty:
        return renderCurrentModeSummary(context)        // calls e (JSX renderer), +12815768

    if trimmedArg not in validModes:
        return renderError("valid values: " + validModes.join(", "))

    requestedMode = trimmedArg
    proceed to refusal-gate checks
```

Analysis basis: CC v2.1.196 bundle.js:+12815698

---

### 2. Refusal Gates

Three independent refusal checks occur in sequence before any state change is attempted.

```
function checkRefusalGates(context, requestedMode):

    // Gate 1 – background / daemon session
    sessionKind = getHiContext(context)                 // Hi → BLe, +12815994
    if sessionKind in ["daemon", "daemon-worker"]:
        emitTelemetry("tengu_tui_refused")
        return RefusalMessage(
            "Background sessions always use the fullscreen renderer …"
        )                                               // literal, +12816008

    // Gate 2 – screen-reader mode
    if isScreenReaderEnabled(context):                  // iD → PLi.isEnabled, +12816204
        emitTelemetry("tengu_tui_refused")
        return RefusalMessage(
            "Screen-reader mode always uses the classic renderer …"
        )                                               // literal, +12816218

    // Gate 3 – active background tasks
    activeTasks = Object.values(getTaskMap(context))    // +12816515
    blockedStatuses = ["running", "pending", "remote_agent", "mcp_task"]
                                                        // literals, +12816554/+12816576/+12816597/+12816622
    if any task in activeTasks has status in blockedStatuses:
        emitTelemetry("tengu_tui_refused")
        return RefusalMessage(
            "Cannot switch renderers while work is running in the background …"
        )                                               // literal, +12816684

    return null  // no refusal
```

Analysis basis: CC v2.1.196 bundle.js:+12815978 – +12816684

---

### 3. Effective Renderer Resolution

Before writing anything, the command determines what renderer is actually in use through a multi-layered policy function (the effective-renderer resolver, identifier `$s` / `v0e`).

The resolver applies the following priority cascade (highest to lowest):

| Priority | Condition | Effective renderer | Policy token |
|---|---|---|---|
| 1 | Running as background/daemon | `fullscreen` | `bg_forced_on` |
| 2 | Screen-reader mode active | `default` | `sr_auto_off` |
| 3 | `CLAUDE_CODE_NO_FLICKER=1` env set | `default` | `env_off` |
| 4 | `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` set | `default` | `env_off` |
| 5 | tmux -CC (iTerm2 integration) detected | `default` | `tmux_cc_auto_off` |
| 6 | Windows over SSH (ConPTY) detected | `default` | `win_ssh_auto_off` |
| 7 | User settings set `fullscreen` | `fullscreen` | `settings_on` |
| 8 | User settings set `default` | `default` | `settings_off` |
| 9 | Feature-gate `downsell_on` active | `fullscreen` | `downsell_on` |
| 10 | Gradual-rollout gate on | `fullscreen` | `gb_on` |
| 11 | Gradual-rollout gate off | `default` | `gb_off` |

```
function getEffectiveRenderer(context):
    // Delegates to $s / v0e with policy-cascade logic above
    // Returns {renderer: "default"|"fullscreen", reason: <policy_token>}
```

Analysis basis: CC v2.1.196 bundle.js:+12815723 (+12816856 for `v0e` variant), literals at +3586893 – +3587299

---

### 4. Setting Write and Session Tagging

When no refusal fires and the effective renderer differs from the requested one (or is confirmed the same for informational display):

```
function applyRendererChange(context, requestedMode):
    effective = getEffectiveRenderer(context)

    sessionTag = "same_session"                        // +12817563
    if effective.renderer != requestedMode:
        writeRendererSetting(requestedMode, context)   // kr → settingsWriter, +12816391
        sessionTag = "later_session"                   // +12817578

    emitTelemetry("tengu_tui_command", {
        requested:  requestedMode,
        effective:  effective.renderer,
        reason:     effective.reason,
        sessionTag: sessionTag,
        uptime:     Math.round(process.uptime()),      // +12817208/+12817219
    })

    jsxOutput = buildRendererStatusJSX(context, requestedMode, effective)
                                                       // sz.jsx, +12817500
    return jsxOutput
```

Analysis basis: CC v2.1.196 bundle.js:+12816391, +12817117, +12817458, +12817500

---

### 5. Relaunch Sequence (background path via `HUe`)

When the process must restart to apply the new renderer (the relaunch helper `HUe` is reached from `YQt`):

```
async function relaunchProcess(options):
    // 1. Gather binary path and version directory
    versionDir = resolveVersionDir()                   // K2 → gKn/zde, +12810983

    // 2. Tear down current UI
    stopCurrentRenderer()                              // e8e (unmounts Ink), +12811157
    stopScrollSummaryLoop()                            // s5n → XFa, +12811163
    stopIntervalTimers()                               // JGt → B_o (clearInterval), +12811151

    // 3. Flush telemetry and analytics
    await Promise.race([
        waitForFlush(),
        timeout(30000, "flush timeout (relaunch)")     // +12811196/+12811202
    ])
    await Promise.race([
        waitForAnalyticsDrain(),                       // AQe → fis.drain, +12811247
        timeout(2000, "cleanup timeout")               // +12811253
    ])

    // 4. Load native FFI (execve wrapper)
    loadNativeFFI()                                    // kJl → bun:ffi dlopen, +12810256/+12810233

    // 5. Register exit signal handlers
    process.removeAllListeners("SIGINT","SIGTERM","SIGHUP")  // +12811698
    process.on("beforeExit", …)                        // +12811728/+12811844

    // 6. Spawn child (spawnSync with stdio inherit)
    result = child_process.spawnSync(binary, args, {stdio: "inherit"})
                                                       // DJl.spawnSync, +12811755

    // 7. On error write log and exit
    if spawn_error:
        writeErrorLog("relaunch_spawn_error")          // uI → Mae.writeFileSync, +12811977
    process.exit(result.status ?? 128)                 // +12812004/+12812117
```

Analysis basis: CC v2.1.196 bundle.js:+12810983 – +12812117

---

### 6. Argument Builder (`kar`)

When constructing the child-process argument list for relaunch:

```
function buildRelaunchArgs(currentState):
    args = Array.from(baseArgs)                        // +12812478

    // Propagate --add-dir entries                     // literal, +12812653
    for dir in additionalDirs:
        args.push("--add-dir", dir)

    // Propagate --allow-dangerously-skip-permissions  // +12812768
    if permissionsSkipped:
        args.push("--allow-dangerously-skip-permissions")

    // Propagate --effort                              // +12812910
    if effortOverride:
        args.push("--effort", effortValue)

    // Propagate --permission-mode                     // +12812927
    if permissionMode:
        args.push("--permission-mode", permissionMode)

    // Propagate --resume if session resumable          // +12811129
    if resumeToken:
        args.push("--resume", resumeToken)

    return args
```

Analysis basis: CC v2.1.196 bundle.js:+12812478 – +12812927

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry – `tengu_tui_command` | Fired on every non-refused execution; carries `requested`, `effective`, `reason`, `sessionTag`, `uptime` fields (bundle.js:+12817117) |
| Telemetry – `tengu_tui_refused` | Fired whenever any of the three refusal gates trips (bundle.js:+12816643) |
| Telemetry – `tengu_scroll_summary` | Fired by scroll-summary loop torn down during relaunch (bundle.js:+7434850) |
| Telemetry – `tengu_amber_creek` | Fired during effective-renderer resolution (bundle.js:+3586565) |
| Telemetry – `tengu_pewter_brook` | Fired during effective-renderer resolution (bundle.js:+3586472) |
| Telemetry – `tengu_feature_ok` | Feature-gate success path (bundle.js:+1028610) |
| Telemetry – `tengu_feature_bad` | Feature-gate failure path (bundle.js:+1028677) |
| Telemetry – `tengu_feature_sad` | Feature-gate third branch (bundle.js:+1028758) |
| Telemetry – `tengu_daemon_control` | Emitted during daemon stop sequence reachable from relaunch (bundle.js:+18033163) |
| Telemetry – `tengu_disable_bypass_permissions_mode` | Emitted if bypass-permissions is coerced off during arg rebuild (bundle.js:+3439914) |
| Telemetry – `tengu_config_parse_error` | Emitted if settings file is malformed during reads (bundle.js:+14160796) |
| Settings write | Persists `"fullscreen"` or `"default"` to user settings via the settings writer (`kr`) at bundle.js:+12816391 |
| Environment variables read | `CLAUDE_CODE_NO_FLICKER`, `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN`, `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL` (bundle.js:+12813158/+12813183/+12813222) |
| Process relaunch | Uses `DJl.spawnSync` with `stdio: "inherit"` and then `process.exit` (bundle.js:+12811755/+12812004) |
| Native FFI | Loads `libSystem.B.dylib` (macOS) or `libc.so.6` (Linux) via `bun:ffi` for `execve`; path depends on `process.platform` (bundle.js:+12810269/+12810277/+12810306) |
| Signal handlers | Clears all existing `SIGINT`/`SIGTERM`/`SIGHUP` listeners and re-registers before spawn (bundle.js:+12811698/+12811728) |
| Ink unmount | Current Ink/JSX renderer is unmounted via `e.unmount` before relaunch (bundle.js:+7432406) |
| Terminal escape sequences | `\x1b7` / `\x1b8` (save/restore cursor) emitted during renderer teardown (bundle.js:+3932924/+3932935) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.196 | Initial analysis |

---

## Common Mistakes

1. **Expecting an immediate visual switch in the same terminal session** — the `/tui` command writes the setting and may relaunch the process. If `same_session` is tagged, the change takes effect on the next invocation of `claude`, not instantly.
2. **Running `/tui fullscreen` inside a background/daemon session** — the command will always be refused with an informational message because background sessions are hard-locked to `fullscreen` regardless of user preference.
3. **Running `/tui` while background tasks are active** — tasks with status `running`, `pending`, `remote_agent`, or `mcp_task` block the switch; use `/tasks` to stop them first.
4. **Expecting `/tui fullscreen` to override tmux -CC or Windows-over-SSH environments** — the effective-renderer resolver auto-downgrades to `default` in those environments unless `CLAUDE_CODE_NO_FLICKER=1` is set to force override.
5. **Omitting the argument** — calling `/tui` with no argument displays the current renderer setting and available options; it does not toggle or change anything.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Izf` | Primary handler for `/tui` command (AsyncFunction, Arbor-resolved via module_id) |
| `YQt` | Outer wrapper / entry point that calls the relaunch helper and fullscreen-env check |
| `HUe` | Relaunch orchestrator: tears down UI, flushes telemetry, spawns child via spawnSync |
| `K2` | Version-directory resolver (locates `~/.local/share/claude/versions/bin`) |
| `gKn` | Path segment joiner for versioned binary path |
| `Aoe` | Home-relative path builder (`~/.local/share`) |
| `zde` | Binary path builder using home directory |
| `G9n` | OS home-directory accessor (`os.homedir`) |
| `ng` | Array-normalization utility used in path construction |
| `Jk` | Binary path or resume-token accessor |
| `Rt` | Utility function delegating to `g0` |
| `g0` | Low-level utility (used by multiple helpers) |
| `JGt` | Interval-stop dispatcher (calls `B_o → clearInterval`) |
| `B_o` | clearInterval wrapper for scroll summary loop |
| `e8e` | Ink renderer teardown: writeSync cursor restore, unmount, terminal cleanup |
| `zN` | Post-unmount terminal restoration helper |
| `uDn` | Terminal output writer (uses `are.writeSync`, wraps `J5e`) |
| `J5e` | Terminal-capability detector (Ghostty ≥1.2.0, iTerm ≥3.6.6) |
| `px` | tmux/screen escape-sequence translator |
| `_d` | Low-level dependency of text formatter |
| `T` | Text formatting / logging utility |
| `s5n` | Scroll-summary loop controller (starts/stops via `XFa`) |
| `XFa` | Scroll-summary ticker using `Date.now`, `Math.max`, `Math.round`, `Object.assign` |
| `YFa` | Scroll-summary callback invoked by ticker |
| `$s` | Effective-renderer resolver: applies full policy cascade |
| `v0e` | Variant of effective-renderer resolver used when mode is being set |
| `MP` | Feature-flag presence check (`IPu.has`) |
| `iD` | Screen-reader / accessibility mode check (`PLi.isEnabled`) |
| `tXr` | Returns `ct` (string coercion context) for renderer tokens |
| `Vne` | Delegates to `l4d` inside effective-renderer cascade |
| `eXr` | Boolean-coercion helper inside renderer cascade |
| `kr` | Settings writer (used to persist renderer preference) |
| `c4d` | Settings-write helper delegating to `it` |
| `it` | Core settings-mutation function (checks `wV`, `T$t`, etc.) |
| `wc` | Promise-race timeout helper (setTimeout / clearTimeout) |
| `bv` | JSX renderer initializer (`Kc → vi → fis.register`) |
| `Kc` | Ink renderer factory |
| `vi` | Ink stream register call |
| `AQe` | Analytics drain trigger (`fis.drain`) |
| `n8e` | Promise.resolve wrapper with `t5n` continuation |
| `t5n` | Continuation helper after render promise resolves |
| `d5o` | Directory and path context builder for relaunch |
| `dr` | Path resolution delegating to `g0` |
| `bl` | Secondary path resolution delegating to `g0` |
| `kJl` | Native FFI loader: opens libSystem/libc via `bun:ffi`, builds execve args |
| `kar` | Relaunch argument builder (assembles CLI flags for child process) |
| `wFe` | Flag presence detector used in arg builder |
| `f0e` | Boolean coercion for task/arg filter |
| `Dt` | Config reader entry point |
| `lIt` | Config file loader (readFileSync, mkdirSync, copyFileSync for migrations) |
| `Ldm` | Config loader orchestrator (watches, reads, validates) |
| `Ur` | Session-state reader (`getAppState`, `findLast`, `ptr`, `ftr`, `Sk`) |
| `ptr` | Session pointer resolver delegating to `Fo` |
| `ftr` | Alternate session pointer resolver delegating to `Fo` |
| `Fo` | Fundamental session-state accessor |
| `Sk` | Bypass-permissions check delegating to `FYr` |
| `FYr` | Permission mode validator (`it`, `es`) |
| `yg` | App-state accessor (different read path from `Ur`) |
| `Hi` | Session-kind / daemon check (compares against `"daemon"`, `"daemon-worker"`) |
| `BLe` | Daemon-kind string constant/comparator |
| `no` | Settings-layer loader (policy, flag, user, project, local layers) |
| `Lg` | Settings aggregator (calls `Hwe`, `I3`) |
| `Hwe` | User/project settings file locator |
| `$gn` | Settings path resolver using `mN.resolve` and `mN.dirname` |
| `fBu` | Settings file context builder |
| `X5` | Path joiner for `.claude/settings.json` |
| `dBu` | Managed-settings path builder |
| `I3` | Multi-layer settings merger |
| `CDr` | Config-directory resolver |
| `BLs` | Settings-file batch loader |
| `IDr` | Individual settings-file reader and parser |
| `P8` | Settings read/write pair (`$ss` get, `Fss` set) |
| `$ss` | Cache getter (`Qyr.get`) |
| `CP` | Deep clone via `structuredClone` |
| `ADr` | Settings-object merger and validator |
| `Fss` | Cache setter (`Qyr.set`) |
| `$Ls` | Inline SDK settings merger |
| `uHe` | Settings merge helpers (`iBu`, `lBu`, `uBu`) |
| `$tt` | Settings serializer/formatter |
| `nw` | Workspace root locator (`Ste`) |
| `Ste` | File-reading wrapper with encoding and line-ending normalization |
| `Bd` | Path canonicalizer (`realpathSync`) |
| `_Ts` | File stat validator (directory, regular file, size checks) |
| `nmn` | Max-size guard for file reads |
| `rmn` | Trailing-content slicer |
| `Sn` | Error reporter delegating to `rn` |
| `rn` | Low-level error logger |
| `MMr` | Cache timestamper (`Qmn.set`, `Date.now`) |
| `VBe` | Settings-bundle reconstructor (`$gn`, `I3`) |
| `mkt` | Atomic file writer (lstat, symlink handling, temp rename, fchmod, fsync) |
| `rtt` | Extended-attribute fallback handler (EINVAL/ENOTSUP/EPERM/ENOSYS) |
| `tkr` | Spin-wait helper (`Atomics.wait` via `KNu`) |
| `KNu` | `Atomics.wait` wrapper |
| `JTs` | Property definer on file-write result object |
| `Me` | JSON.stringify wrapper |
| `n_` | Cache clearer (`Hin.clear`, `Qyr.clear`) |
| `Gvs` | Gitignore-aware file writer (mkdir, readFile, appendFile, writeFile) |
| `Ot` | Async-context store accessor (`tmn`) |
| `tmn` | AsyncLocalStorage `getStore` wrapper |
| `gMr` | Git utility wrapper (`wu`) |
| `Kmn` | Git-check-ignore invoker |
| `Gr` | Shell command executor (`execFileNoThrow`) |
| `PFu` | Path expander (handles `~/`, absolute/relative, homedir join) |
| `Fvs` | `git ls-files` invoker |
| `Bvs` | Git-tracking status helper |
| `wt` | Feature-gate check (V + Oe → `tengu_feature_sad`) |
| `Oe` | Feature-gate evaluator (emits `tengu_feature_ok`/`tengu_feature_bad`) |
| `$Xe` | Core feature-flag store |
| `O8` | Settings-load orchestrator (`m0`, `ga`, `vDr`, `I3`) |
| `m0` | Settings-load pre-check |
| `ga` | Performance-mark emitter (`perf_hooks` → `fcs`, `STr`) |
| `I5` | `require` wrapper for `perf_hooks` |
| `vDr` | Full settings-load pipeline (CDr, BLs, Hwe, P8, $Ls) |
| `Ln` | Append-to-log file helper (mkdirSync, appendFileSync) |
| `yin` | Log-level filter |
| `gMt` | Settings-set tracker (`t.add`, `HI.filter`, `t.has`) |
| `_in` | Post-load settings hook |
| `Re` | Error emitter (queues to `zet`, logs via `Ete.logError`) |
| `er` | Error constructor wrapper |
| `ct` | String coercion utility |
| `zi` | Error-to-string converter (`Fbs`) |
| `Fbs` | Error formatting helper |
| `_Nu` | Circular error buffer (`zfn.shift` / `zfn.push`) |
| `YN` | Terminal-size / color-depth detector |
| `NFt` | Color-depth constant |
| `fH` | Terminal-feature helper |
| `XXr` | Terminal color-support detector (`bWd`) |
| `bWd` | ANSI color-support tester |
| `Ay` | Color-level mapper |
| `TWd` | Terminal-column-width measurer (`parseFloat`, `Math.min`) |
| `QXr` | Column-query helper |
| `D6` | JSX element factory (delegates to `q3`) |
| `q3` | React/Ink element builder (`uFd`, `Rm`, `zhe`) |
| `uFd` | Ink element constructor (`ct`, `Lc`) |
| `Lc` | Ink layout context (`Hr`) |
| `Rm` | Ink reconciler entry |
| `zhe` | Ink child reconciler (`Fbs`) |
| `Gs` | Telemetry sender (checks `U2d`, `$2d`, calls `N6`, `zi`, `J_e`) |
| `OFi` | Telemetry transport (`N6`) |
| `N6` | Telemetry event dispatcher (`GF`, `O$t`, `lye`) |
| `GF` | Telemetry gate (`P$t`) |
| `O$t` | Telemetry file writer (`DFi.readFileSync`, `a0e`, `_Rn`) |
| `lye` | Telemetry consent checker (`Aai`, `MFi`, `EV`) |
| `J_e` | Telemetry fallback handler |
| `uI` | Error-log writer (`Mae.writeFileSync`, `qbr.join`) |
| `Gxe` | Fullscreen-env-var check (`CLAUDE_CODE_NO_FLICKER`, `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN`, `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL`); calls `PLi.isEnabled` |
| `eoc` | Telemetry event object constructor (`Zte`, `Date.now`, `Ks`, `HZt`, `Me`) |
| `L8` | Path normalizer (`oN.normalize`, `t.replaceAll`) |
| `yn` | String-normalizer utility |
| `kge` | Response serializer (`JSON.stringify`) |
| `xe` | Feature-gate check variant A (V + Oe) |
| `ke` | Feature-gate check variant B (V + Oe) |
| `$F` | First-party request tagger (`D6`, `ZY.push`, `u5e`, `V7r`) |
| `Wj` | Process-exit orchestrator (race, all, `rye`, `pye`, `On`, `process.exit`) |
| `he` | String coercion wrapper |
| `o` | Padding/map array utility |
| `OL` | Scroll-summary output channel |
| `QFa` | Scroll-summary state accessor |
| `V` | Variant / feature-flag value resolver |