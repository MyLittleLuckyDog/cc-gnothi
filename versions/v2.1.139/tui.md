---
type: feature-spec
feature: "tui"
cc_version: "2.1.139"
updated: "2026-05-31"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.139 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.139 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.139

---

## Overview

The `/tui` command switches the terminal UI renderer between `default` and `fullscreen` modes while Claude Code is running. It inspects the current session context, environment variables, and terminal capabilities to determine whether switching is safe, then relaunches the process under the new renderer if allowed. In background or daemon sessions, the command is blocked entirely, directing the user to detach and run it from a foreground session.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| supportsNonInteractive | `false` |
| module_id | `ozq` |
| load_inline | `true` |
| loc_byte | `11202721` |
| loc_byte_end | `11202925` |
| loc_line | `6903` |
| arbor_handler.name | `rX7` |
| arbor_handler.fqn | `claude-2.1.139::rX7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.139 bundle.js:+11202721

---

## Input Branching

The handler contains more than three distinct decision branches (background-session guard, env-override checks, tmux/Windows SSH auto-disable, argument parsing, and renderer transition), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/tui called with arg]) --> B{Session type?}
    B -- "daemon or daemon-worker" --> C["Return error:\nRenderer switching unavailable\nin background session\n(bundle.js:+11201666)"]
    B -- foreground --> D{Arg after trim}
    D -- "empty / no arg" --> E[Show current renderer\nand available modes]
    D -- 'fullscreen' --> F{Environment & terminal checks}
    D -- 'default' --> G[Target = default]
    D -- other --> H[Return usage error]

    F --> I{CLAUDE_CODE_NO_FLICKER set?}
    I -- yes --> J[Bypass auto-disable\nbundle.js:+11202506]
    I -- no --> K{tmux -CC / iTerm2\nintegration detected?}
    K -- yes --> L["Warn: fullscreen disabled\n(tmux-CC)\nbundle.js:+3232399"]
    K -- no --> M{Windows over SSH\nConPTY detected?}
    M -- yes --> N["Warn: fullscreen disabled\n(Windows SSH)\nbundle.js:+3232585"]
    M -- no --> O[Target = fullscreen]

    J --> O
    O --> P[Persist target to settings]
    G --> P
    P --> Q[Emit tengu_tui_command telemetry\nbundle.js:+11202057]
    Q --> R[relaunchHandler / FYH:\nflush UI, spawn new process,\nwait or exit\nbundle.js:+11202431]
    R --> S([Process replaced with\nnew renderer])
```

---

## Behavioral Spec

### 1. Entry point — handler `rX7`

The async handler `rX7` is the top-level function resolved by Arbor via `module_id → ozq`.

```
async function tuiCommandHandler(arg):
    trimmedArg = arg.trim()                         # bundle.js:+11201363

    sessionType = getSessionType()                  # calls m_ → bundle.js:+11201388
    if sessionType is "daemon" or "daemon-worker":  # literals bundle.js:+2148205, +2148219
        return errorMessage(
            "Renderer switching isn't available in a background session" +
            " — press ← to detach and run /tui from a foreground session."
        )                                           # bundle.js:+11201666

    availableModes = ["fullscreen", "default"]      # literals bundle.js:+3232789, +3232815
    if trimmedArg not in availableModes:            # bundle.js:+11201503, +11201525
        if trimmedArg == "":
            return showCurrentRendererStatus()
        return usageError(availableModes)

    targetMode = trimmedArg

    if targetMode == "fullscreen":
        targetMode = resolveFullscreenEligibility(targetMode)
        # resolveFullscreenEligibility may downgrade to "default" with a warning

    persistRendererSetting(targetMode)              # via FA → N → bundle.js:+11201399

    emitTelemetry("tengu_tui_command", {mode: targetMode, ...})  # bundle.js:+11202057

    await relaunchProcess(targetMode)               # FYH bundle.js:+11202431
```

### 2. Fullscreen eligibility check — `resolveFullscreenEligibility` (maps to `wV`)

Determines whether the terminal actually supports fullscreen before committing.

```
function resolveFullscreenEligibility(requestedMode):
    # Check environment variable overrides first
    noFlicker = process.env["CLAUDE_CODE_NO_FLICKER"]    # bundle.js:+11202506
    disableAlt = process.env["CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN"]  # bundle.js:+11202531
    forceUpsell = process.env["CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL"]  # bundle.js:+11202570

    if noFlicker is set:
        return requestedMode    # override skips all checks

    termProgram = detectTerminalProgram()           # calls wV → Ha.includes, b46.isJetBrainsIdeTerminal
                                                    # bundle.js:+3302745, +3302773

    if isTmuxControlMode():                         # tvL → svL → H.startsWith, iT9.spawnSync
        # tmux -CC spawns: ["display-message", "-p", "#{client_control_mode}"]
        # with timeout 2000 ms  bundle.js:+3231709, +3231727, +3231732, +3231783
        emitTelemetry("tengu_pewter_brook", ...)    # bundle.js:+3232880
        warnUser(
            "fullscreen disabled: tmux -CC (iTerm2 integration mode) detected" +
            " · set CLAUDE_CODE_NO_FLICKER=1 to override"
        )                                           # bundle.js:+3232399
        return "default"

    if isWindowsOverSSH():                          # N46 → o6 → "windows" literal bundle.js:+3231993
        emitTelemetry("tengu_pewter_brook", ...)    # bundle.js:+3232880
        warnUser(
            "fullscreen disabled: Windows over SSH (ConPTY re-rendering) detected" +
            " · set CLAUDE_CODE_NO_FLICKER=1 to override"
        )                                           # bundle.js:+3232585
        return "default"

    return requestedMode  # fullscreen approved
```

### 3. tmux control-mode probe — `tvL` / `svL`

```
function isTmuxControlMode():
    term = process.env["TERM"]
    termProgram = process.env["TERM_PROGRAM"]

    if termProgram.startsWith("iTerm.app"):         # bundle.js:+3231431
        if term == "screen" or term == "tmux":      # bundle.js:+3231499, +3231524
            result = spawnSync("tmux", [
                "display-message", "-p",
                "#{client_control_mode}"
            ], {encoding: "utf8", timeout: 2000})   # bundle.js:+3231709–3231783
            return result.stdout indicates CC mode
    return false
```

### 4. Settings persistence — `FA` and helpers

```
function persistRendererSetting(mode):
    currentSettings = loadSettingsFromDisk()        # m_ → Ix → vx8, bundle.js:+11201388
    # Settings layers resolved: userSettings, projectSettings,
    # localSettings, SDK inline settings
    # literals: bundle.js:+1177707, +1177754, +1177776, +1176830

    settingsFilePath = resolveSettingsPath()        # ak → QZ.join, ".claude/settings.json"
                                                    # bundle.js:+1177948, +1177958

    updatedSettings = merge(currentSettings, {theme: {tui: mode}})
    writeSettingsFile(settingsFilePath, updatedSettings)  # N → R9K path
```

### 5. Terminal capability negotiation — `wV` → `ihL`

When fullscreen is attempted, terminal emulator version constraints are checked:

```
function checkTerminalVersionConstraints():
    termProgram = detectTerminalProgram()

    if termProgram == "cursor":                     # bundle.js:+3303442
        version = parseFloat(termVersion)
        if not Number.isNaN(version):
            clamped = Math.min(version, 20)         # bundle.js:+3303949
            # Cursor version range: 1092000 – 1105000  bundle.js:+3303567, +3303578

    if termProgram == "vscode":                     # bundle.js:+3303491
        # xterm.js version check applies          bundle.js:+3303611

    if termProgram includes "ghostty":              # bundle.js:+3300318
        # Minimum ghostty version 1.2.0 enforced  bundle.js:+3300348
        # kitty version 3.6.6 comparison          bundle.js:+3300419

    if termProgram == "unset":                      # bundle.js:+3303146
        # darwin / win32 platform fallback        bundle.js:+3302977, +3303023
```

### 6. Process relaunch — `FYH`

Once the new mode is persisted, the process re-execs itself under the new renderer:

```
async function relaunchProcess(mode):
    # Resolve binary path via Tm → U48 / at
    # ~/.local/share/claude/versions/bin  bundle.js:+7467767, +7467776, +7827922, +7827931, +7467846

    # Stat the target binary                       # nzq.stat bundle.js:+11200082

    clearAnimationInterval()                       # A$6 → jO_ → clearInterval bundle.js:+11200152
    flushCurrentUI()                               # GTH: l$H.writeSync, H.unmount, Ny, Lr6
                                                   # bundle.js:+11200158

    # Wait for pending ops with timeout 30000 ms   # bundle.js:+11200197 ("flush timeout (relaunch)")
    await Promise.all([...]) with race(timeout(30000))  # p5 bundle.js:+11200189

    drainCleanup(timeout="cleanup timeout")        # jyH bundle.js:+11200248

    # Write PID file                               # CP → gyH.writeFileSync bundle.js:+11200834

    # Reset signal handlers
    process.removeAllListeners()                   # bundle.js:+11200551
    process.on("SIGINT", ...)                      # bundle.js:+11200581
    process.on("SIGTERM", ...)
    process.on("SIGHUP", ...)
    process.on("beforeExit", ...)                  # bundle.js:+11200701
    process.on("exit", ...)                        # bundle.js:+11200742

    # Spawn replacement process                    # lzq.spawnSync bundle.js:+11200608
    # with args including "--resume"              # bundle.js:+11200135
    # stdio: "inherit"                            # bundle.js:+11200643

    if spawnError:
        reportError("relaunch_spawn_error")        # bundle.js:+11200837

    process.exit(exitCode)                         # bundle.js:+11200861
    # or process.kill(process.pid, signal)         # bundle.js:+11200926
    # exit code offset: 128 + signal number        # bundle.js:+11200974
```

### 7. Session type guard — `m_` → `Ix`

```
function getSessionType():
    # m_ reads the session context
    # Ix delegates to NS (session-name lookup) and P1 (performance mark)
    # P1 records perf mark "loadSettingsFromDisk_start"   bundle.js:+1185200
    # vx8 emits log event "settings_load_started"         bundle.js:+1182055
    # Returns one of: "daemon", "daemon-worker", foreground string
    # literals: bundle.js:+2148205, +2148219
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_tui_command` | Fired on every valid invocation (bundle.js:+11202057); carries the resolved target mode and session metadata |
| Telemetry: `tengu_pewter_brook` | Fired when fullscreen is auto-disabled due to tmux-CC or Windows-SSH detection (bundle.js:+3232880) |
| Telemetry: `tengu_amber_creek` | Fired inside the renderer-mode classification path `j6 → evL` (bundle.js:+3232972) |
| Telemetry: `tengu_scroll_summary` | Fired during UI flush sequence `y68 → Q` (bundle.js:+5110602) |
| Settings write | Persists the new TUI mode to `~/.claude/settings.json` (or local variant) via the settings layer stack (bundle.js:+1177948) |
| Process replacement | `lzq.spawnSync` re-execs the Claude Code binary with `--resume` and `stdio: "inherit"`; current process calls `process.exit` (bundle.js:+11200608, +11200643, +11200861) |
| Signal handlers | All existing listeners removed via `process.removeAllListeners()`; SIGINT, SIGTERM, SIGHUP, beforeExit, exit re-registered before re-exec (bundle.js:+11200551–11200742) |
| UI teardown | Alternate screen escaped via ANSI sequences `\x1B7` / `\x1B8` (bundle.js:+3567867, +3567878); ink component unmounted (`H.unmount` bundle.js:+5109214) |
| Cache clear | `DD` clears `lE6` and `DT8` caches prior to relaunch (bundle.js:+24901, +24913) |
| Performance marks | `loadSettingsFromDisk_start` / `loadSettingsFromDisk_end` bracketing mark-pair emitted (bundle.js:+1185200, +1185254) |

---

## Environment Variables

| Variable | Effect |
|---|---|
| `CLAUDE_CODE_NO_FLICKER` | When set, bypasses tmux-CC and Windows-SSH auto-disable guards (bundle.js:+11202506) |
| `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` | Disables alternate screen buffer during renderer transition (bundle.js:+11202531) |
| `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL` | Forces the fullscreen upsell prompt regardless of eligibility (bundle.js:+11202570) |

---

## Renderer Mode Decision Values

The literals found in the `tfH` path enumerate the named states that the fullscreen eligibility resolver assigns:

| State literal | Meaning |
|---|---|
| `env_off` | Fullscreen disabled by environment variable (bundle.js:+3233170) |
| `env_on` | Fullscreen enabled by environment variable override (bundle.js:+3233228) |
| `tmux_cc_auto_off` | Auto-disabled: tmux control-mode detected (bundle.js:+3233252) |
| `win_ssh_auto_off` | Auto-disabled: Windows over SSH detected (bundle.js:+3233286) |
| `bg_forced_on` | Fullscreen forced on in background context (bundle.js:+3233358) |
| `settings_on` | Fullscreen enabled via settings (bundle.js:+3233413) |
| `settings_off` | Fullscreen disabled via settings (bundle.js:+3233447) |
| `downsell_on` | Fullscreen downgraded due to capability limits (bundle.js:+3233520) |
| `gb_on` | Gradual-rollout gate open (bundle.js:+3233585) |
| `gb_off` | Gradual-rollout gate closed (bundle.js:+3233593) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.139 | Initial analysis |

---

## Common Mistakes

1. **Running `/tui` inside a background (daemon) session** — the command is entirely blocked. Detach to a foreground session first; the error message explicitly instructs this (bundle.js:+11201666).
2. **Expecting fullscreen in tmux with iTerm2 integration** — `tmux -CC` mode is auto-detected and fullscreen is silently downgraded to `default`. Set `CLAUDE_CODE_NO_FLICKER=1` to override if you accept potential flickering (bundle.js:+3232399).
3. **Expecting fullscreen over Windows SSH (ConPTY)** — same auto-disable applies; same `CLAUDE_CODE_NO_FLICKER=1` escape hatch (bundle.js:+3232585).
4. **Passing an unrecognised argument** — only `fullscreen` and `default` are valid; any other token produces a usage error. Omitting the argument shows current status without switching.
5. **Assuming the command returns to the prompt** — the command triggers a full process re-exec via `lzq.spawnSync` with `--resume`; the current process exits. This is a process replacement, not an in-place hot-swap.
6. **Not accounting for the 30-second flush timeout** — if pending operations do not drain within 30 000 ms, the relaunch proceeds anyway under the "flush timeout (relaunch)" label (bundle.js:+11200197, +11200203).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `rX7` | Top-level `/tui` async command handler (Arbor-resolved, FQN: `claude-2.1.139::rX7`) |
| `m_` | Session-type / settings-context resolver |
| `Ix` | Settings loader coordinator (dispatches to `NS`, `P1`, `vx8`) |
| `NS` | Session name lookup |
| `P1` | Performance-mark recorder (`loadSettingsFromDisk_start`) |
| `Kx` | `perf_hooks` require wrapper |
| `vx8` | Core settings-load executor (emits `settings_load_started`) |
| `G8` | File-append log writer |
| `iE6` | Settings-load intermediate helper |
| `mT` | Flag/policy settings merger |
| `DOA` | Settings object-key enumerator |
| `L` | Async task-set manager (add/delete/finally) |
| `K` | Column formatter / padEnd helper |
| `wf` | Settings file path builder (userSettings, projectSettings, localSettings) |
| `f` | Resource close coordinator (A.close, q.close) |
| `P7H` | Settings persistence writer (`ar_`, `aI`, `Ex8`, `sr_`) |
| `ZS6` | SDK inline settings handler |
| `nE6` | Settings-load completion notifier |
| `FA` | Renderer-mode state manager and settings updater |
| `TSH` | Terminal state-set guard (`T0K.has`) |
| `r__` | Renderer-mode string normaliser |
| `vq` | String coercion utility (truthy normalisation) |
| `SH` | String coercion utility |
| `vc` | Terminal detection dispatcher |
| `tvL` | tmux control-mode detection controller |
| `svL` | iTerm.app / tmux prefix-check function |
| `N` | Settings write coordinator |
| `y9K` | Settings schema validator |
| `Xo_` | Settings value coercer (`h8K`, `S8K`) |
| `yH` | JSON.stringify wrapper for logging |
| `_` | String uppercaser helper |
| `LM` | Log-message formatter with redaction |
| `os_` | Log line builder (`Z9K.map`) |
| `A` | String toLowerCase utility / stat-result holder |
| `QyH` | stdout write wrapper |
| `ms_` | H.write wrapper |
| `R9K` | Disk write orchestrator (mkdir, appendFile, rotate) |
| `JyH` | Debounced batch writer (setTimeout/setImmediate/clearTimeout) |
| `n6H` | Write-path helper (`es_`, `AjH.join`, `i8`, `V6`) |
| `B6` | Error-code utility |
| `IV8` | Write-size helper (`w8`) |
| `qt_` | Settings path constructor |
| `At_` | File rotation handler (stat, rename, unlink) |
| `S9K` | Mkdir + appendFile write worker |
| `C9` | State-set tracker (`$Z8.add/delete`, `Object.assign`) |
| `N46` | OS-platform detection (`o6`, Boolean) |
| `evL` | Renderer-change event emitter |
| `j6` | Renderer-mode change dispatcher (`L46`, `M46`, `Ya`, `Ql6`, `b6`) |
| `L46` | Renderer-change listener registry |
| `M46` | Renderer-change effect runner |
| `Ya` | Renderer-state transition helper |
| `Ql6` | Renderer-mode dedup guard (`T8_.has/add`, `gfH.get`) |
| `b6` | Renderer-mode broadcast (`BW`, `U8_`, `cfH`, `Date.now`, `pVL`) |
| `Z1` | Background-session role lookup |
| `Zo` | Session role constant resolver |
| `tfH` | Fullscreen eligibility decision function (emits named state literals) |
| `k_` | Filesystem-aware settings save function |
| `Ix8` | Sub-save orchestrator (`DOA`, `wf`, `P7H`, `ZS6`, `jd`) |
| `LG` | Settings-directory resolver |
| `ZU` | File reader with BOM/encoding detection |
| `f3` | Filesystem type checker (FIFO, socket, char device, block device) |
| `t86` | Read-buffer size constant holder (4096) |
| `AC8` | BOM stripper |
| `D8` | EISDIR/ENOENT error classifier |
| `w8` | Error-code extractor |
| `Sb8` | Settings cache timestamper (`Bh6.set`, `Date.now`) |
| `Zd` | Config-directory path resolver |
| `A_` | Home-directory utility |
| `Kr` | `.claude` directory name constant |
| `dSH` | Atomic file writer (temp-file + rename, fchmod, fsync) |
| `q` | Low-level fs operations (lstatSync, readlinkSync, statSync, renameSync, unlinkSync) |
| `O` | Symlink-check result holder |
| `x8` | Error-property extractor |
| `DD` | Cache-clear coordinator (`lE6.clear`, `DT8.clear`) |
| `Sh6` | User settings file read/write (mkdir, readFile, appendFile, writeFile) |
| `C6` | Async-local-storage context getter |
| `ry6` | Store accessor (`iy6.getStore`, `UQ`) |
| `jb8` | Settings schema validator (`XL`) |
| `Gb8` | Git-ignore checker (`$_`) |
| `$_` | Git check-ignore executor (`$PH`, `Y`, `_ZK`, `LH`) |
| `kZK` | XDG config-dir builder (`A3A.homedir`, `.config/ignore`) |
| `LH` | Settings merge and persistence coordinator |
| `q_` | Error/String coercion pair |
| `S1` | Network-traffic classifier (`G7A` → `essential-traffic`) |
| `CGK` | LRU-style queue manager (`Qy6.shift/push`) |
| `ak` | `.claude` settings-path joiner |
| `wV` | Terminal fullscreen capability negotiator |
| `c46` | Terminal-program identifier constant |
| `vZ` | Terminal-version string parser |
| `UA_` | Fullscreen OS-level capability tester (`nhL`, `c46`) |
| `nhL` | Terminal-feature probe helper |
| `fMH` | Terminal-mode fast-path checker |
| `ihL` | Version-number comparison helper (`parseFloat`, `Number.isNaN`, `Math.min`) |
| `BA_` | Version-comparison range evaluator |
| `Q` | Telemetry/event emitter reference |
| `FYH` | Process relaunch orchestrator |
| `Tm` | Binary path resolver (version directory lookup) |
| `U48` | Versioned binary locator (`j3`, `kY6.join`, `AzH`) |
| `j3` | Array.isArray utility |
| `AzH` | XDG data-dir path builder (`_L8`, `hD6.join`) |
| `at` | Alternative binary path builder |
| `_L8` | Home-directory base resolver (`q01.homedir`) |
| `nm` | Process name/argv accessor |
| `V6` | Verbose-log helper |
| `A$6` | Animation interval clearer |
| `jO_` | clearInterval wrapper |
| `GTH` | UI flush / ink unmount executor |
| `Ny` | Alternate-screen restore helper |
| `Lr6` | Terminal raw-write / alternate-screen switcher |
| `pWH` | Ghostty/kitty terminal-version gate |
| `xWH` | Terminal-escape sequence writer |
| `sT` | Escape-sequence double-ESC sanitiser |
| `y68` | Scroll summary + UI cleanup coordinator |
| `IZ` | Scroll-region tracker |
| `cH1` | Ink render-context accessor |
| `dH1` | Frame-time accounting helper (`Date.now`, `Math.max`, `Math.round`, `Object.assign`) |
| `gH1` | Frame-flush sub-helper |
| `p5` | Promise.race timeout wrapper |
| `sE` | Pending-operations drain helper |
| `uL` | Cleanup-queue flusher |
| `jyH` | Parallel async-cleanup runner (`Promise.all`, `Array.from`) |
| `ex_` | Child-process spawn argument builder |
| `bK` | Spawn-argument sanitiser |
| `CP` | PID-file writer (`gyH.writeFileSync`, `bV8.join`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.