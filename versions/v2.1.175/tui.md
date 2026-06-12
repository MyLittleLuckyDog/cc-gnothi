---
type: feature-spec
feature: "tui"
cc_version: "2.1.175"
updated: "2026-06-12"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.175 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.175 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.175

---

## Overview

The `/tui` command switches the terminal UI renderer between `default` and `fullscreen` modes for sessions started directly with `claude`. It validates whether a renderer switch is currently possible, applies environment-variable and platform-based eligibility checks, persists the new setting, and emits telemetry about the outcome. Background sessions are unaffected — they always use the fullscreen renderer regardless of this setting.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| module_id | `z3K` |
| load_inline | `true` |
| loc_byte | `12685271` |
| loc_byte_end | `12685453` |
| loc_line | `8904` |
| arbor_handler.name | `Vi7` |
| arbor_handler.fqn | `claude-2.1.175::Vi7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.175 bundle.js:+12685271

---

## Input Branching

The handler contains six or more distinct decision paths (argument parsing, background-session guard, platform/environment eligibility, renderer value validation, no-change short-circuit, and persistence), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/tui [arg]"]) --> B[Trim argument string]
    B --> C{Argument provided?}
    C -- No --> D[Read current renderer setting\nfrom app state]
    C -- Yes --> E{Arg in allowed list?\n'default' | 'fullscreen'}
    E -- No --> F[Return error:\ninvalid argument]
    E -- Yes --> G[targetRenderer = arg]
    D --> G

    G --> H{Any background tasks active?\nrunning / pending / remote_agent / mcp_task}
    H -- Yes --> I[Emit tengu_tui_refused\nReturn error message:\ncannot switch while work running]
    H -- No --> J[Determine fullscreen eligibility\nvia eligibilityCheck]

    J --> K{Eligibility result}
    K -- fullscreen disabled: tmux -CC detected --> L[Log override hint\nCLAUDE_CODE_NO_FLICKER]
    K -- fullscreen disabled: Windows SSH detected --> M[Log override hint\nCLAUDE_CODE_NO_FLICKER]
    K -- eligible --> N[Continue]
    L --> N
    M --> N

    N --> O{targetRenderer == currentRenderer?}
    O -- Yes --> P[Return no-op / already set message]
    O -- No --> Q[Persist renderer setting\nvia settings writer]

    Q --> R[Emit tengu_tui_command\nwith same_session / later_session label]
    R --> S{Requires process relaunch?}
    S -- Yes --> T[Trigger relaunch sequence\nvia relaunchHandler]
    S -- No --> U[Return confirmation JSX]
    T --> V([Process re-exec])
    P --> U
```

Analysis basis: CC v2.1.175 bundle.js:+12683034 (handler entry `Vi7`)

---

## Behavioral Spec

### 1. Argument Parsing

```
async function tuiCommandHandler(rawArg, appContext):
    arg = rawArg.trim()                          // Vi7 → A.trim  (+12683034)
    allowed = ["default", "fullscreen"]          // literals +3520744, +3520770
    if arg == "":
        target = currentRendererFromSettings()
    elif arg not in allowed:
        return errorResult("invalid argument")
    else:
        target = arg
```

The allowed values are the string literals `"default"` and `"fullscreen"`.

Analysis basis: CC v2.1.175 bundle.js:+12683192 (`IzA.includes`)

---

### 2. Background-Session Note

```
function noteBackgroundSessions():
    // Inline message injected into the response regardless of chosen mode:
    // "Background sessions always use the fullscreen renderer …
    //  The tui setting applies to sessions started directly with `claude`."
    // (literal at +12683344)
    return informationalBanner
```

This banner is always rendered as part of the command response — it is not a guard condition.

Analysis basis: CC v2.1.175 bundle.js:+12683344

---

### 3. Active-Work Guard

```
function checkActiveWork(appState):
    activeStatuses = ["running", "pending", "remote_agent", "mcp_task"]
    // literals: +12683740, +12683762, +12683783, +12683808
    tasks = getAppState(appState).findLast(...)  // b_ → H.getAppState +10722804
    if any task.status in activeStatuses:
        emitTelemetry("tengu_tui_refused")       // +12683829
        return errorMessage(
            "Cannot switch renderers while work is running in the background"
            // literal +12683870
        )
    return null  // no block
```

Analysis basis: CC v2.1.175 bundle.js:+12683740–12683870

---

### 4. Fullscreen Eligibility Check

```
function determineEligibility(env, platform):
    // Delegated to eligibilityChecker (cJH / k1)

    // Case A: CLAUDE_CODE_NO_FLICKER env var set (+12680387)
    //         → override all auto-off rules

    // Case B: tmux -CC (iTerm2 integration) detected (+3520410)
    //         → reason = "tmux_cc_auto_off" (+3521259)
    //         → return "fullscreen disabled: tmux -CC … detected"

    // Case C: Windows over SSH (ConPTY) detected (+3520596)
    //         → reason = "win_ssh_auto_off" (+3521293)
    //         → return "fullscreen disabled: Windows over SSH … detected"

    // Case D: platform == "windows" (+3519964)
    //         eligible with caveats

    // Case E: bg_forced_on override active (+3521155)
    //         → fullscreen forced regardless

    // Returns eligibility object: { mode, reason }
    // Possible reason codes: bg_forced_on, env_off, env_on,
    //   tmux_cc_auto_off, win_ssh_auto_off, settings_on, settings_off,
    //   downsell_on, gb_on, gb_off
    // (literals +3521155 – +3521532)
```

Analysis basis: CC v2.1.175 bundle.js:+12684042 (`cJH` call), +3520410, +3520596

---

### 5. Setting Persistence and Relaunch

```
async function applyRendererChange(target, currentRenderer, context):
    if target == currentRenderer:
        return noOpMessage()               // already set

    settingsWriter(target)                 // wA path, Os6 sub-calls
    label = determineTelemetryLabel()      // "same_session" (+12684766)
                                           // or "later_session" (+12684781)
    emitTelemetry("tengu_tui_command",     // +12684302
        { renderer: target, label })

    if requiresRelaunch(target):
        await relaunchSequence()           // $p6 → mEH path
    else:
        return confirmationJSX()
```

The relaunch sequence (`mEH`) tears down the current process, flushes analytics (timeout 2000 ms, literal +12678491), waits up to 30 000 ms for the flush (literal +12678434), removes all signal listeners, re-registers `SIGINT`/`SIGHUP` handlers (literals +12678907, +12678926), and calls `spawnSync` with `inherit` stdio (literal +12679028) before calling `process.exit`.

Analysis basis: CC v2.1.175 bundle.js:+12684302, +12684766, +12678434, +12678491

---

### 6. Terminal-Capability Detection (used by eligibility check)

```
function detectTerminalCapabilities():
    // fy function (+12684169)
    // Checks terminal identifiers against known values:
    //   "ghostty" (version ≥ 1.2.0)  (+3587979, +3588009)
    //   "iTerm.app" (version ≥ 3.6.6) (+3588048, +3588080)
    //   "cursor"                       (+3591206)
    //   "vscode"                       (+3591255)
    //   xterm.js build range           (+3591331: 1092000, +3591342: 1105000)
    // Platform guards:
    //   "darwin" (+3590739), "win32" (+3590786)
    // Checks Mn.isJetBrainsIdeTerminal (+3590530)
    // Returns capability flags used by eligibility resolver
```

Analysis basis: CC v2.1.175 bundle.js:+12684169

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_tui_refused` | Fired when a renderer switch is blocked because background work is active (+12683829) |
| Telemetry: `tengu_tui_command` | Fired on every successful renderer change; carries `renderer` value and `same_session` / `later_session` label (+12684302) |
| Telemetry: `tengu_amber_creek` | Fired inside eligibility sub-path (+3520927) |
| Telemetry: `tengu_pewter_brook` | Fired inside eligibility sub-path (+3520835) |
| Telemetry: `tengu_scroll_summary` | Fired during relaunch scroll/resize handling (+7407087) |
| Settings write | Renderer preference persisted to user settings via `Os6` / `VYH.writeFile` path |
| Environment variables observed | `CLAUDE_CODE_NO_FLICKER` (+12680387), `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` (+12680412), `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL` (+12680451) |
| Process relaunch | When a relaunch is required: `process.removeAllListeners`, re-register `SIGINT`/`SIGHUP`, `spawnSync` with `inherit`, `process.exit` (+12678936–12679242) |
| Relaunch file write | Error path writes relaunch-spawn-error marker via `YX` → `xgH.writeFileSync` (+196667) |
| `--resume` flag | Passed to the relaunched process (+12678367) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.175 | Initial analysis |

---

## Common Mistakes

1. **Running `/tui` while background tasks are active** — the command will refuse with "Cannot switch renderers while work is running in the background". Wait for all `running`/`pending`/`remote_agent`/`mcp_task` work to finish (or cancel it via `/tasks`) before switching.
2. **Expecting `/tui` to affect background sessions** — background (`claude` daemon) sessions always use the fullscreen renderer regardless of this setting; the command only affects directly-launched `claude` sessions.
3. **Passing an unsupported value** — only `default` and `fullscreen` are accepted. Any other string is rejected immediately.
4. **Assuming the change takes effect in the current session without a relaunch** — depending on the current renderer state, a process relaunch may be triggered automatically. The telemetry label `same_session` vs `later_session` indicates whether the new renderer is active immediately or only after the next start.
5. **Ignoring platform auto-disable messages** — on tmux `-CC` (iTerm2 integration) or Windows-over-SSH environments, fullscreen is auto-disabled. Set `CLAUDE_CODE_NO_FLICKER=1` in the environment to override the auto-disable if desired.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Vi7` | Main `/tui` command handler (AsyncFunction, Arbor-resolved) |
| `$p6` | Relaunch entry-point (calls `mEH`) |
| `mEH` | Core relaunch sequence: tear-down, flush, spawn, exit |
| `pR` | Claude binary path resolver |
| `jS8` | Version-directory path builder |
| `rMH` | Path join helper (share dir) |
| `v9H` | Path join helper (bin dir) |
| `e28` | Home-directory path helper |
| `Mk` | App-state accessor |
| `h6` | Internal utility (calls `iG`) |
| `iG` | Low-level internal helper |
| `Ch6` | Interval-clear helper (`Hn_`) |
| `Hn_` | Calls `clearInterval` |
| `TbH` | TUI unmount / screen-restore helper |
| `H` | Ink render instance (also used as `H.unmount`) |
| `vb` | Post-unmount cleanup step |
| `b$8` | Alternate-screen escape writer |
| `ZkH` | Terminal capability version checker |
| `DkH` | Additional screen teardown step |
| `F0` | tmux/screen escape rewriter |
| `vM` | Utility called during screen teardown |
| `N` | Log / notify helper |
| `LG8` | Scroll-summary telemetry emitter |
| `v8q` | Scroll metrics calculator (uses `Date.now`, `Math.max`, `Math.round`) |
| `k1` | Fullscreen eligibility resolver |
| `b8H` | Feature-flag lookup helper |
| `TN_` | OS-type resolver sub-helper |
| `os` | Platform detection helper |
| `GN_` | SSH-on-Windows detector |
| `a_` | Settings reader (used across multiple call sites) |
| `Hg4` | Eligibility sub-check (`z6` caller) |
| `z6` | Per-session feature-gate evaluator |
| `C4` | Timed-race / flush timeout utility |
| `bZ` | Analytics register helper |
| `z4` | Analytics sub-helper |
| `u9` | `pvA.register` caller |
| `OgH` | Analytics drain caller (`pvA.drain`) |
| `ZbH` | New TUI mount helper |
| `KG8` | Ink render factory |
| `NzA` | Binary self-path resolver |
| `W_` | File existence / stat helper |
| `yf` | Path resolution helper (calls `iG`) |
| `q3K` | Process exec-replace / FFI loader |
| `L` | Native library handle (dlopen) |
| `A` | Native symbol map |
| `q` | Connection / socket set |
| `f` | Promise-chain helper |
| `$` | Process / worker set |
| `hjK` | Worker spawn helper |
| `D` | Background-session manager |
| `b` | Background-task record |
| `i8` | Timeout/abort helper |
| `CH` | Feature-ok telemetry emitter |
| `kH` | Feature-sad telemetry emitter |
| `ng8` | Low-memory check helper |
| `UG6` | Config-file reader |
| `SH` | Error logging helper |
| `Q` | IPC socket connection manager |
| `dTA` | Daemon-claim / socket-auth helper |
| `oTA` | Background-session lifecycle manager |
| `Y` | Forced-shutdown handler (`process.exit`) |
| `E8` | Error-code helper |
| `A6` | Feature telemetry dispatcher |
| `B` | Disposable resource handle |
| `O` | Background-session state reporter |
| `C8` | State-string formatter |
| `M` | MCP / daemon process orchestrator |
| `DCH` | MCP connection builder |
| `ki8` | MCP update applicator |
| `sGA` | MCP server sync helper |
| `z` | Daemon stop controller |
| `ZS` | Daemon stop sequence |
| `aU` | Graceful exit race helper |
| `TH` | String coercion utility |
| `YX` | Relaunch-error file writer |
| `MF8` | CLI-argument builder for relaunch |
| `hVH` | CLI-arg sub-builder |
| `mK8` | Config availability checker |
| `C6` | Config watcher / loader |
| `o6` | Config path resolver |
| `nV_` | Config parse helper |
| `U7H` | Config file reader (sync) |
| `sp4` | Config file watcher (watchFile) |
| `b_` | App-state last-session extractor |
| `Ex8` | Session-state field extractor (allowed_tools) |
| `j1` | Session-state field accessor |
| `Zx8` | Session-state field extractor (disallowed_tools) |
| `mb` | Permission-mode helper |
| `v$` | App-state current-settings reader |
| `P9` | Daemon-worker type checker |
| `fjH` | Worker-type string constant |
| `cJH` | Fullscreen eligibility final resolver |
| `wA` | Settings-from-disk loader |
| `p3` | Settings hierarchy builder |
| `uYH` | Settings path resolver (join) |
| `es6` | Settings path resolver (resolve/dirname) |
| `JBf` | K6 string helper |
| `eu` | Path join helper (`.claude` dir) |
| `jBf` | Managed-settings path builder |
| `nC` | Settings layer collector |
| `bM6` | Policy settings layer |
| `Ba8` | Flag settings layer |
| `SM6` | User settings layer |
| `kVH` | Project settings layer |
| `SVH` | Local settings layer |
| `uM6` | SDK inline settings layer |
| `t8H` | cowork settings layer |
| `pYH` | Fallback settings layer |
| `$t6` | Additional settings layer |
| `ciA` | Additional settings layer |
| `ca` | Additional settings layer |
| `zY6` | WSL / managed-settings path helper |
| `h4_` | Settings merge driver |
| `yiA` | Settings key enumerator |
| `N4_` | Settings key merger |
| `FB` | Settings cache get/set |
| `wvA` | Settings cache getter (`Go8.get`) |
| `pk` | Deep-clone helper (`structuredClone`) |
| `Z4_` | Settings object builder |
| `YvA` | Settings cache setter (`Go8.set`) |
| `hiA` | SDK inline settings parser |
| `c4H` | Settings validation helper |
| `GcH` | Settings schema validator |
| `c2` | Settings file reader |
| `pa` | File reader with BOM/encoding detection |
| `M$` | Real-path resolver |
| `Wa6` | Path normaliser |
| `_` | (multi-role) array / string helper |
| `Ga6` | Settings slice helper |
| `y8` | Error-code matcher |
| `uf_` | Settings-write timestamp recorder |
| `bNH` | Settings-reload trigger |
| `Ww6` | Atomic file writer (rename + fsync) |
| `RH` | JSON.stringify wrapper |
| `rO` | Settings cache invalidator (clear) |
| `Os6` | Settings writer (mkdir + appendFile / writeFile) |
| `b6` | AsyncLocalStorage settings accessor |
| `Pa6` | Store-context getter |
| `Pf_` | Settings migration helper |
| `$s6` | Git-ignore check dispatcher |
| `c_` | Git-ignore checker |
| `dpf` | Git-ignore path normaliser |
| `IlA` | Git ls-files tracker |
| `ylA` | Gitignore rule appender |
| `t6` | Feature telemetry (sad path) |
| `gB` | Full settings-load orchestrator |
| `nG` | Performance mark: loadSettingsFromDisk_start |
| `Lq` | Memory usage recorder |
| `Su` | `require("perf_hooks")` caller |
| `I4_` | Settings-load core loop |
| `R8` | Settings-load log writer |
| `lQ6` | Settings-load sub-helper |
| `OY6` | Seen-path deduplication set helper |
| `K` | Pad/map helper |
| `cQ6` | Settings-load completion marker |
| `fy` | Terminal-capability detector |
| `T06` | Terminal-ID reader |
| `PY` | Terminal-version parser |
| `Jh_` | JetBrains terminal sub-checker |
| `Dl4` | JetBrains version helper |
| `$w` | Terminal-version fallback helper |
| `jl4` | Font-scale / min-rows calculator |
| `Xh_` | xterm.js build-ID reader |
| `Wm` | Ink render mount helper |
| `Kb` | Ink renderer factory wrapper |
| `yW4` | Ink element builder |
| `K6` | String coercion helper |
| `V4` | Internal node helper |
| `aO` | Ink option merger |
| `zNH` | Ink render sub-helper |
| `QgA` | K6 string builder |
| `h9` | Ink render with feature-gate check |
| `kU1` | Ink render inner |
| `fIH` | Ink render setup |
| `Lb` | Ink render instance builder |
| `aJ6` | Bundle-version file reader |
| `nLH` | Telemetry-consent checker |
| `qq` | Telemetry consent sub-check |
| `ULH` | K6 string sub-helper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.