---
type: feature-spec
feature: "tui"
cc_version: "2.1.193"
updated: "2026-06-26"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.193 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.193 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.193

---

## Overview

`/tui` sets the terminal UI renderer for Claude Code sessions, toggling between `default` (classic inline renderer) and `fullscreen` (alternate-screen renderer). When invoked with a valid mode argument the command validates environmental constraints, checks for running background work, and—if all preconditions pass—persists the new setting and relaunches the UI. The command is a `local-jsx` command, meaning it renders feedback inline via a JSX component rather than printing plain text.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| module_id | `c9l` |
| load_inline | `true` |
| loc_byte | `12650004` |
| loc_byte_end | `12650186` |
| loc_line | `8597` |
| arbor_handler.name | `Kkf` |
| arbor_handler.fqn | `claude-2.1.193::Kkf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.193 bundle.js:+12650004

---

## Input Branching

The handler has more than three distinct decision paths (no argument, invalid argument, screen-reader active, background work running, same-mode, and successful switch), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/tui [arg]"]) --> B{Argument present?}
    B -- No --> C[Show current mode + help text\nvia JSX component]
    B -- Yes --> D{Trim & validate arg\nagainst allowed list}
    D -- Invalid value --> E[Render error: invalid argument]
    D -- Valid: 'default' or 'fullscreen' --> F{Screen-reader mode active?\ncM check}
    F -- Yes --> G[Render notice:\nscreen-reader forces classic renderer\nno setting change]
    F -- No --> H{Background work running?\nCheck active tasks:\n'running' | 'pending' |\n'remote_agent' | 'mcp_task'}
    H -- Work in progress --> I[Emit tengu_tui_refused\nRender error: cannot switch while\nwork is running]
    H -- Idle --> J{Requested mode same as current?}
    J -- Same mode --> K[Render: already set, no-op]
    J -- Different mode --> L{Fullscreen requested?}
    L -- Yes --> M{Env constraints allow fullscreen?\nDs / Jwe evaluation}
    M -- Blocked: tmux -CC detected --> N[Render: fullscreen disabled\ntmux-CC / iTerm2 warning]
    M -- Blocked: Windows-over-SSH detected --> O[Render: fullscreen disabled\nConPTY warning]
    M -- Allowed --> P[Persist new tui setting\nEmit tengu_tui_command\nRelaunch renderer via o7t/POe]
    L -- No: 'default' --> P
```

Analysis basis: CC v2.1.193 bundle.js:+12647622

---

## Behavioral Spec

### 1. Argument Parsing and Validation

```
async function tuiCommandHandler(context, rawArg):
    arg = rawArg.trim()                          // Kkf → n.trim  (+12647622)

    allowedModes = ["default", "fullscreen"]     // dNo literal values (+12647734)

    if arg is empty:
        displayCurrentModeHelp(context)
        return

    normalizedArg = arg joined/normalized via dNo.join  // (+12647734)

    if NOT dNo.includes(normalizedArg):          // (+12647780)
        renderError("invalid argument")
        return

    proceed to constraint checks
```

Analysis basis: CC v2.1.193 bundle.js:+12647622, +12647734, +12647780

---

### 2. Screen-Reader Guard

```
function checkScreenReaderMode():
    // cM wraps tHi.isEnabled (+3104647)
    return isScreenReaderEnabled()               // cM call at +12648128

if checkScreenReaderMode():
    renderNotice(
        "Screen-reader mode always uses the classic renderer, " +
        "so the tui setting has no effect while it is active."
    )
    // literal at +12648142
    return
```

Analysis basis: CC v2.1.193 bundle.js:+12648128, +12648142

---

### 3. Background-Work Guard

```
function hasActiveBackgroundWork(appState):
    // Object.values over tasks (+12648439)
    // statuses checked: "running", "pending", "remote_agent", "mcp_task"
    // literals at +12648478, +12648500, +12648521, +12648546
    for task in Object.values(appState.tasks):
        if task.status in {"running", "pending", "remote_agent", "mcp_task"}:
            return true
    return false

if hasActiveBackgroundWork(currentAppState):
    emitTelemetry("tengu_tui_refused")           // +12648567
    renderError(
        "Cannot switch renderers while work is running in the background " +
        "— wait for it to finish (or stop it via /tasks), then run /tui again."
    )
    // literal at +12648608
    return
```

Analysis basis: CC v2.1.193 bundle.js:+12648439, +12648567, +12648608

---

### 4. Fullscreen Compatibility Evaluation (Ds / Jwe)

When the target mode is `fullscreen`, the runtime evaluates a chain of environment conditions. The logic is implemented in the `tuiModeEvaluator` function (bundle identifier `Ds`, with the inline-command variant `Jwe`).

```
function evaluateFullscreenEligibility(env):
    // Decision factors, in priority order:

    // 1. Background session: always force fullscreen regardless of setting
    if env.isBackgroundSession:                  // "bg_forced_on" at +3549631
        return { mode: "fullscreen", reason: "bg_forced_on" }

    // 2. Screen-reader: auto-disable fullscreen
    if env.screenReaderActive:                   // "sr_auto_off" at +3549660
        return { mode: "default", reason: "sr_auto_off" }

    // 3. Environment variable CLAUDE_CODE_NO_FLICKER=1 → disable
    if env.CLAUDE_CODE_NO_FLICKER:               // "env_off" at +3549689
        return { mode: "default", reason: "env_off" }

    // 4. Environment variable CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL → enable
    if env.CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL:  // "env_on" at +3549739
        return { mode: "fullscreen", reason: "env_on" }

    // 5. tmux -CC (iTerm2 integration) detected → auto-disable
    if env.tmuxCCDetected:                       // "tmux_cc_auto_off" at +3549764
        renderWarning(
            "fullscreen disabled: tmux -CC (iTerm2 integration mode) detected " +
            "· set CLAUDE_CODE_NO_FLICKER=1 to override"
            // literal at +3548785
        )
        return { mode: "default", reason: "tmux_cc_auto_off" }

    // 6. Windows over SSH (ConPTY) detected → auto-disable
    if env.windowsOverSSH:                       // "win_ssh_auto_off" at +3549798
        renderWarning(
            "fullscreen disabled: Windows over SSH (ConPTY re-rendering) detected " +
            "· set CLAUDE_CODE_NO_FLICKER=1 to override"
            // literal at +3548971
        )
        return { mode: "default", reason: "win_ssh_auto_off" }

    // 7. Explicit user settings
    if settings.tui == "fullscreen":             // "settings_on" at +3549857
        return { mode: "fullscreen", reason: "settings_on" }
    if settings.tui == "default":               // "settings_off" at +3549891
        return { mode: "default", reason: "settings_off" }

    // 8. Gradual-rollout / feature-flag override
    if featureFlag.fullscreen:                   // "gb_on" / "gb_off" at +3550029, +3550037
        return { mode: "fullscreen", reason: "gb_on" }

    return { mode: "default", reason: "gb_off" }
```

Analysis basis: CC v2.1.193 bundle.js:+3549631, +3549660, +3549689, +3549739, +3549764, +3549798, +3549857, +3549891, +3550029, +3550037

---

### 5. Terminal Capability Detection (z1)

Before applying fullscreen the runtime probes terminal capabilities via the `terminalCapabilityDetector` function (`z1`).

```
function detectTerminalCapabilities():
    // JetBrains IDE terminal check at +3619485
    if q1.isJetBrainsIdeTerminal():
        return capability with limited alternate-screen

    // Embedded terminal detection (Cursor, VS Code)  literals: "cursor" +3620161, "vscode" +3620210
    if termEnvMatchesCursorOrVSCode():
        return embedded_terminal capability

    // xterm.js version range check
    //   lower: 1092000 (+3620286), upper: 1105000 (+3620297)
    //   "xterm.js" literal at +3620330
    if isXtermJsInRange(1092000, 1105000):
        return limited_capability

    // Platform checks: darwin +3619694, win32 +3619741
    platform = detectPlatform()

    // Parse terminal version via SLd (parseFloat, Math.min at +3620612, +3620657)
    version = parseTerminalVersion()

    return buildCapabilityResult(platform, version)
```

Analysis basis: CC v2.1.193 bundle.js:+3619485, +3620161, +3620210, +3620286, +3620297, +3619694, +3619741

---

### 6. Relaunch Sequence (POe / o7t)

When all guards pass and the mode actually changes, the command persists the setting and relaunches the session.

```
async function relaunchWithNewRenderer(context, newMode):
    // Persist tui setting to config (co → wgs → vIe.writeFile path)

    // 1. Flush interval timers: m9t / uuo → clearInterval (+7374230)
    stopIntervalTimers()

    // 2. Unmount current Ink JSX renderer: F6e → e.unmount (+7371917)
    unmountCurrentRenderer()

    // 3. Flush analytics: G6e / O7e → a7o.drain (+68083)
    await flushAnalytics("analytics flush timeout", timeoutMs=30000)  // literal +12643238, +12643120

    // 4. Register signal handlers then spawn replacement process:
    //    process.removeAllListeners (+12643622)
    //    process.on SIGINT, SIGHUP  (literals +12643593, +12643612)
    //    o9l.spawnSync with stdio "inherit" (+12643714)
    //    args include --resume flag   (+12643053)

    // 5. Exit current process or hand off via execve (n9l → a.execve +12642556)
    replaceCurrentProcess(args=[...originalArgs, "--resume"], env=mergedEnv)
```

Analysis basis: CC v2.1.193 bundle.js:+12643001, +12643099, +12643120, +12643238, +12643622, +12643679

---

### 7. JSX Result Rendering

The command is type `local-jsx`, so all user-visible output is rendered through `vq.jsx` (+12649424). The rendered panel includes:

- **Current mode** (retrieved via `Zm → e.getAppState` at +10995248)
- **Telemetry label** for the outcome (same-session vs. later-session, literals `"same_session"` at +12649487 and `"later_session"` at +12649502)
- **Background-session notice**: "Background sessions always use the fullscreen renderer so scrolling and mouse work when attached. The tui setting applies to sessions started directly with `claude`." (literal at +12647932)

Analysis basis: CC v2.1.193 bundle.js:+12649424, +12649487, +12649502, +12647932

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_tui_refused` | Fired when background work blocks a renderer switch (bundle.js:+12648567) |
| Telemetry: `tengu_tui_command` | Fired on a successful or acknowledged renderer change (bundle.js:+12649041) |
| Telemetry: `tengu_amber_creek` | Fired during fullscreen eligibility resolution, tracks environment decision path (bundle.js:+3549303) |
| Telemetry: `tengu_pewter_brook` | Fired during fullscreen eligibility resolution, secondary path metric (bundle.js:+3549210) |
| Settings persistence | New `tui` value written to user/project settings via `wgs → vIe.writeFile` (bundle.js:+1173848) |
| Renderer unmount | Current Ink renderer torn down via `F6e → e.unmount` before relaunch (bundle.js:+7371917) |
| Interval cleanup | All running interval timers cleared via `m9t → uuo → clearInterval` (bundle.js:+7374230) |
| Analytics flush | Pending events drained via `O7e → a7o.drain` with a 30 000 ms timeout (bundle.js:+12643120) |
| Process replacement | On confirmed mode switch the process is replaced via `spawnSync` / `execve` with `--resume` flag (bundle.js:+12643679, +12643053) |
| Signal handler reset | `process.removeAllListeners()` called before re-registering SIGINT and SIGHUP on relaunch (bundle.js:+12643622) |
| `CLAUDE_CODE_NO_FLICKER` env | When set, suppresses automatic fullscreen and overrides tmux/Windows detection (literal at bundle.js:+12645082) |
| `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` env | Additional alternate-screen suppression flag consulted during evaluation (literal at bundle.js:+12645107) |
| `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL` env | Forces fullscreen eligibility for testing/upsell flows (literal at bundle.js:+12645146) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.193 | Initial analysis |

---

## Common Mistakes

1. **Running `/tui` while background tasks are active** — the command will refuse with a clear error message and emit `tengu_tui_refused`. Use `/tasks` to inspect and stop active work first.
2. **Expecting fullscreen in tmux -CC (iTerm2 native integration) without overriding** — tmux `-CC` mode causes automatic downgrade to the default renderer. Set `CLAUDE_CODE_NO_FLICKER=1` to force fullscreen if you accept the trade-off.
3. **Expecting the setting to affect background (daemon) sessions** — background sessions always run the fullscreen renderer regardless of the `/tui` setting; only foreground sessions started with `claude` honour it.
4. **Omitting the argument** — `/tui` with no argument displays the current mode and help text but makes no change; always pass `default` or `fullscreen` explicitly.
5. **Assuming an immediate visual change** — the renderer switch requires a full process relaunch (`spawnSync` + `--resume`). The current session is torn down and a new one is started; any transient UI state is not preserved.
6. **Using `/tui` while screen-reader mode is active** — the command will display a notice and exit without writing any setting, because screen-reader mode always forces the classic renderer.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Kkf` | Main `/tui` command handler (AsyncFunction resolved via Arbor, module_id path) |
| `o7t` | Top-level relaunch orchestrator; calls `POe` and `mwe` |
| `POe` | Session relaunch implementation: flush, unmount, signal-setup, spawnSync |
| `mwe` | Environment variable reader for `CLAUDE_CODE_*` flags |
| `UF` | Version path resolver (locates `versions/bin` under `~/.local/share/claude`) |
| `B6n` | Path builder for versioned binary locations |
| `xne` | Path join helper variant (`.local/share`) |
| `Xce` | Alternative path join helper (`bin`) |
| `xUn` | Home-directory base path resolver (`ECa.homedir`) |
| `sk` | Settings/config accessor used during relaunch |
| `Lt` | Config reader utility (`Rx`) |
| `m9t` | Interval timer manager; calls `uuo` / `clearInterval` |
| `F6e` | Ink renderer teardown: `writeSync`, `wu.get`, `e.unmount`, `q$`, `pLn` |
| `pLn` | Terminal escape sequence emitter (`\x1b7`/`\x1b8`, write sync) |
| `$3e` | Terminal capability/version coercer (`zPi.coerce`, ghostty/iTerm2 checks) |
| `IL` | tmux / screen escape-sequence filter (`e.replaceAll`) |
| `K$n` | Scroll-summary flush (`Yw`, `MLa`, `kLa`) |
| `kLa` | Scroll metrics calculator (`Date.now`, `Math.max`, `Math.round`) |
| `Ds` | Fullscreen eligibility evaluator (main decision chain) |
| `Jwe` | Fullscreen eligibility evaluator (inline `/tui` command variant, mirrors `Ds`) |
| `cB` | Local-agent detection helper |
| `cM` | Screen-reader detection wrapper (`tHi.isEnabled`) |
| `NWr` | Nested fullscreen sub-check (`at`) |
| `Zee` | Additional eligibility sub-check (`iId`) |
| `OWr` | Windows-over-SSH ConPTY detection (`Wt`, `Boolean`) |
| `kr` | Telemetry event emitter for eligibility reasons |
| `aId` | Eligibility result builder |
| `it` | Telemetry dispatcher / state-set helper |
| `Yc` | Promise race with timeout (flush timeout helper) |
| `JC` | Hook/lifecycle registration caller |
| `Kc` | Hook chain invoker (`Ei`) |
| `O7e` | Analytics drain caller (`a7o.drain`) |
| `G6e` | Analytics flush wrapper with timeout label |
| `cNo` | Config directory resolver (`a9l.dirname`, `Dh`, `Sc`) |
| `n9l` | Process-replacement via `execve` / `dlopen` (Bun FFI path) |
| `OT` | Error state file writer (`Lse.writeFileSync`, `jgr.join`) |
| `rtr` | Argument list builder for relaunch (assembles CLI flags) |
| `xNe` | Argument array element builder |
| `Owe` | Boolean-coercing argument filter |
| `kt` | Config loader with migration support |
| `bSt` | Config file reader with backup/copy logic |
| `xjf` | Config watcher / file-change monitor |
| `Ur` | App-state reader for session parameters (working directory, tools, etc.) |
| `F7n` | Allowed-tools extractor from app state |
| `B7n` | Disallowed-tools extractor from app state |
| `F$` | Permission-bypass flag reader |
| `Zm` | Current tui-mode reader from app state |
| `Ks` | Daemon-worker mode checker (`mve`) |
| `co` | Settings load/save orchestrator (reads all settings layers) |
| `dg` | Settings layer aggregator (`GIe`, `yB`) |
| `GIe` | Settings file locator (join paths, `run`, `BAu`, `U4`, `FAu`) |
| `run` | Settings path resolver (`g1.resolve`, `nr`, `g1.dirname`) |
| `yB` | Settings struct builder (all settings fields) |
| `JLt` | WSL / platform settings helper |
| `Svr` | Full settings load pipeline (`vHs`, `GIe`, `uW`, `IHs`, `nW`) |
| `vHs` | Settings layer merger / validator |
| `Evr` | Per-layer settings reader |
| `uW` | Settings cache get/set (`Mzo`, `LD`, `Hvr`, `Dzo`) |
| `Mzo` | Settings cache getter (`Xdr.get`) |
| `Dzo` | Settings cache setter (`Xdr.set`) |
| `Hvr` | Settings parser / normaliser |
| `IHs` | SDK inline settings reader |
| `XJe` | Settings merge/validation helper (JSON parse, field validation) |
| `hv` | File path helper / real-path resolver |
| `MZ` | File reader with encoding detection (BOM, CRLF, utf16le) |
| `Md` | Real-path normaliser (`e.realpathSync`) |
| `wgs` | Settings write path (gitignore, mkdir, writeFile) |
| `ucn` | Git-ignore integration helper (`Vr`) |
| `Vr` | Git subprocess runner (`git check-ignore`, `git ls-files`) |
| `fSu` | Path normaliser with home-dir expansion |
| `dW` | Settings disk I/O dispatcher (`xx`, `ia`, `Avr`) |
| `Avr` | Settings load-from-disk implementation |
| `vn` | Log-to-file helper (`s.appendFileSync`, `s.mkdirSync`) |
| `z1` | Terminal capability detector (JetBrains, Cursor, VS Code, xterm.js, platform) |
| `x8r` | Terminal emulator identifier helper (`ELd`, `t1t`) |
| `SLd` | Terminal version parser (`parseFloat`, `Math.min`, `Number.isNaN`) |
| `Q_` | Terminal query helper (`Xh`) |
| `h5` | Feature-gate / gradual-rollout evaluator |
| `GB` | Feature-gate resolver (`EEd`, `d_`, `Kme`) |
| `EEd` | Feature-gate core evaluator (`at`, `Ql`) |
| `Fs` | Feedback/telemetry consent checker (`XLi`, `y5`, `D$`, `Bi`, `Whe`) |
| `XLi` | Consent resolution helper |
| `y5` | Consent file reader (`D$`, `rOt`, `eHe`) |
| `D$` | Consent cache key builder |
| `rOt` | Consent file reader from disk |
| `eHe` | Consent value parser |
| `Bi` | Consent fallback resolver |
| `Whe` | Consent default provider |
| `co` | Settings orchestrator (also aliased as config loader in call graph) |
| `l6e` | MCP server connection builder |
| `Bcr` | MCP connection result applier |
| `mSa` | MCP session initialiser |
| `VWo` | MCP connection map updater |
| `cVo` | Background session socket connector |
| `gVo` | Background session lifecycle manager |
| `f` | Background session dispatch loop |
| `D` | Worker/supervisor IPC write handler |
| `O` | Idle-timeout / retire-if-settled handler |
| `p` | Forced-shutdown handler (`process.exit`, `u.abort`) |
| `Hj` | Daemon shutdown race (`Promise.race`, `process.exit`) |
| `R$` | First-party telemetry event emitter |
| `an` | Error formatter / errno decoder |
| `Oe` | Small utility wrapper (`Zze`) |
| `be` | String coercion utility |
| `ke` | JSON serialiser (`JSON.stringify`) |
| `at` | String coercion for telemetry fields (`String`) |
| `In` | Error `errno` extractor |
| `xe` | Telemetry event sender (`eo`, `at`, `Bi`, `e_u`, `kZ.logError`) |
| `T` | Log-level / message formatter |
| `V` | Shared constant / configuration value |
| `Kd` | Structured log writer |
| `PH` | Cache clear helper (`Den.clear`, `Xdr.clear`) |
| `mr` | Config-path utility (`Rx`) |
| `Sc` | Secondary config-path utility (`Rx`) |
| `wCr` | Cache timestamp writer (`gcn.set`, `Date.now`) |
| `B$e` | Settings reload trigger (`run`, `yB`) |
| `Qwt` | Atomic file writer (temp-file + rename, `writeFileSync`, `fchmodSync`) |
| `mJe` | Fsync error handler |
| `Ops` | `Object.defineProperty` wrapper for write metadata |
| `Pt` | Async local store getter (`Eln`, `mr`) |
| `Eln` | Async context store accessor (`yln.getStore`, `kK`) |
| `uCr` | Structured log formatter (`Iu`) |
| `ia` | Performance-mark helper (`aJo.has/add`, `process.memoryUsage`) |
| `u4` | `perf_hooks` dynamic `require` helper |
| `Avr` | Settings load pipeline (also listed above under settings) |
| `Pen` | Post-load settings finaliser |
| `vt` | Feature-capability query helper |
| `Re` | Feature-ok telemetry emitter (`tengu_feature_ok`) |
| `we` | Feature-sad telemetry emitter (`tengu_feature_sad`) |
| `Knr` | Background-session low-memory checker (`tengu_bg_low_mem_mb`) |
| `I9e` | Conversation cache file pruner (`Xb.lstat`, `Xb.rm`, `Xb.readFile`) |