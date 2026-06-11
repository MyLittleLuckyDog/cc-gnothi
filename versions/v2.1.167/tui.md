---
type: feature-spec
feature: "tui"
cc_version: "2.1.167"
updated: "2026-06-11"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.167 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.167 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.167

---

## Overview

The `/tui` command switches the terminal UI renderer between `default` and `fullscreen` modes for the current Claude Code session. It validates preconditions (no active background tasks, environment compatibility), persists the chosen renderer to user settings, and performs a live in-process relaunch to apply the new renderer immediately. Background sessions are unaffected because they always use the fullscreen renderer.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| module_id | `a8K` |
| load_inline | `true` |
| loc_byte | `12419256` |
| loc_byte_end | `12419438` |
| loc_line | `8841` |
| arbor_handler.name | `sSf` |
| arbor_handler.fqn | `claude-2.1.167::sSf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.167 bundle.js:+12419256

---

## Input Branching

The handler has five or more distinct control-flow paths depending on the supplied argument, active task state, and environment compatibility. A Mermaid flowchart is used accordingly.

```mermaid
flowchart TD
    A(["/tui [arg]"]) --> B[Trim argument string]
    B --> C{Argument provided?}
    C -- No --> D[Display current renderer mode\n+ fullscreen availability info]
    C -- Yes --> E{Arg in allowed list?\n'default' | 'fullscreen'}
    E -- No --> F[Show usage error:\nvalid values are 'default' or 'fullscreen']
    E -- Yes --> G{Background tasks\nrunning / pending /\nremote_agent / mcp_task?}
    G -- Yes --> H[Emit tengu_tui_refused\nReturn error:\n'Cannot switch renderers while\nbackground tasks are running…']
    G -- No --> I{Is arg 'fullscreen'?}
    I -- Yes --> J[Check fullscreen compatibility\nvia environment inspector]
    J --> K{Compatible?}
    K -- No --> L[Show compatibility warning\ne.g. tmux-CC or Windows SSH detected]
    K -- Yes --> M[Persist renderer choice\nto user settings]
    I -- No / 'default' --> M
    M --> N[Emit tengu_tui_command\nwith mode + uptime]
    N --> O[Perform in-process relaunch\nvia relaunchRenderer]
```

---

## Behavioral Spec

### 1. Argument Parsing and Validation

```
async function handleTuiCommand(args, appState):
    rawArg = args.trim()                          // A.trim @ +12417154
    allowedModes = ["default", "fullscreen"]

    if rawArg is empty:
        displayCurrentRendererStatus(appState)    // H @ +12417224
        return

    if rawArg not in allowedModes:                // n4A.includes @ +12417312
        printUsageError("valid values: " + allowedModes.join(", "))
        return

    mode = rawArg
```

Analysis basis: CC v2.1.167 bundle.js:+12417154, +12417266, +12417312

---

### 2. Background Task Guard

Before switching the renderer, the handler inspects all active agent sessions. Sessions whose status is `running`, `pending`, `remote_agent`, or `mcp_task` cause an early refusal.

```
function checkBackgroundTasksBlocking(appState):
    activeSessions = Object.values(appState.sessions)   // Object.values @ +12417821
    blocked = activeSessions.filter(s =>
        s.status in ["running", "pending",              // literals @ +12417860, +12417882
                     "remote_agent", "mcp_task"])       // literals @ +12417903, +12417928

    if blocked.length > 0:
        emitTelemetry("tengu_tui_refused")              // @ +12417949
        return Error(
            "Cannot switch renderers while background tasks are running " +
            "— wait for them to finish (or stop them via /tasks), " +
            "then run /tui again."                      // literal @ +12417990
        )
    return null
```

Analysis basis: CC v2.1.167 bundle.js:+12417821, +12417860, +12417882, +12417903, +12417928, +12417949, +12417990

---

### 3. Fullscreen Compatibility Check

When the requested mode is `fullscreen`, the environment inspector (`lI` → terminal capability probe) is consulted. Known incompatible environments receive an automatic warning or hard disable.

```
function isFullscreenCompatible():
    // lI @ +12418288 — resolves terminal environment flags
    envFlags = queryTerminalEnvironment()

    if envFlags includes "tmux_cc_auto_off":            // literal @ +3447263
        warn("fullscreen disabled: tmux -CC (iTerm2 integration mode) detected…")
        return false unless CLAUDE_CODE_NO_FLICKER is set

    if envFlags includes "win_ssh_auto_off":            // literal @ +3447297
        warn("fullscreen disabled: Windows over SSH (ConPTY re-rendering) detected…")
        return false unless CLAUDE_CODE_NO_FLICKER is set

    return true
```

Relevant environment variables checked during this phase:
- `CLAUDE_CODE_NO_FLICKER` (override; literal at +12414989)
- `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` (literal at +12415014)
- `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL` (literal at +12415053)

Analysis basis: CC v2.1.167 bundle.js:+12418288, +3447263, +3447297, +12414989

---

### 4. Renderer Mode Decision Logic (`wwH` / renderer-mode evaluator)

The renderer-mode evaluator aggregates multiple signals into a single resolved mode. The signals, in priority order, are:

| Signal key | Description |
|---|---|
| `bg_forced_on` | Background session forces fullscreen on |
| `env_off` / `env_on` | `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` / `CLAUDE_CODE_NO_FLICKER` env vars |
| `tmux_cc_auto_off` | tmux -CC (iTerm2) auto-disable |
| `win_ssh_auto_off` | Windows-over-SSH auto-disable |
| `settings_on` / `settings_off` | Value persisted via `/tui` to user settings |
| `downsell_on` | Internal upsell/downsell flag |
| `gb_on` / `gb_off` | Gradual-rollout gate |

Analysis basis: CC v2.1.167 bundle.js:+3447159, +3447189, +3447239, +3447263, +3447297, +3447356, +3447390, +3447463, +3447528, +3447536

---

### 5. Background-Session Informational Note

The handler unconditionally appends a notice that background sessions always use fullscreen regardless of the `/tui` setting, because scrolling and mouse interaction require it.

> Exact prose (≤30 chars citation): `"Background sessions always use…"` — literal at +12417464.

Analysis basis: CC v2.1.167 bundle.js:+12417464

---

### 6. Settings Persistence and Telemetry

```
function persistAndRelaunch(mode, appState):
    // Persist chosen mode to user settings layer
    saveUserSetting("tui", mode)                        // o_ @ +12418177 → settings writer

    // Emit telemetry before relaunch
    emitTelemetry("tengu_tui_command", {                // @ +12418421
        mode:   mode,
        uptime: Math.round(process.uptime())            // @ +12418512, +12418523
    })

    // Trigger in-process relaunch
    relaunchRenderer(appState)                          // gR6 @ +12418871
```

Analysis basis: CC v2.1.167 bundle.js:+12418177, +12418421, +12418512, +12418523, +12418871

---

### 7. Relaunch Sequence (`d0H` — renderer relaunch orchestrator)

The relaunch sequence is the deepest part of the call graph and performs:

1. **Resolve binary path** — locate the installed Claude Code binary (`nS` → path resolver using `~/.local/share/claude/versions/…/bin`).
2. **Unmount current UI** — stop the active Ink/React render tree (`oyH` → UI teardown), clearing the alternate screen and active render intervals (`HG6` → interval clearance).
3. **Flush analytics** — wait up to 30 000 ms for pending analytics events to drain (`IL` with timeout; literal at +12412982).
4. **Flush scroll summary** — `Bz8` emits `tengu_scroll_summary` (telemetry at +5455866) and waits for any pending scroll state.
5. **Wire signal handlers** — remove existing listeners for `SIGINT`, `SIGHUP`, `beforeExit`, `exit` and re-register clean-up handlers via `process.on`.
6. **Native exec** — load platform FFI (`d8K` via `bun:ffi`; literal at +12412019) for `execve` on macOS (`/usr/lib/libSystem.B.dylib`; literal at +12412063) or Linux (`libc.so.6`; literal at +12412092), then call `M.execve` to replace the process image with the new renderer binary, forwarding `--resume` (literal at +12412915).
7. **Fallback spawn** — if FFI exec is unavailable, `l8K.spawnSync` is used with `inherit` stdio (literal at +12413576).
8. **Exit** — `process.exit` terminates the parent process after the child is spawned.

Analysis basis: CC v2.1.167 bundle.js:+12412769, +12412863, +12412937, +12412949, +12412961, +12412974, +12413033, +12413341, +12413484, +12413541, +12413790

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_tui_refused` | Fired when background tasks block the renderer switch (+12417949) |
| Telemetry — `tengu_tui_command` | Fired on successful mode selection; carries `mode` and rounded uptime (+12418421) |
| Telemetry — `tengu_scroll_summary` | Fired during relaunch as scroll state is flushed (+5455866) |
| Telemetry — `tengu_amber_creek` | Renderer-mode evaluation signal (+3446931) |
| Telemetry — `tengu_pewter_brook` | Renderer-mode evaluation signal (+3446839) |
| User settings write | Chosen mode (`"fullscreen"` or `"default"`) persisted to user settings layer via settings writer |
| Process replacement | On success, the process image is replaced via `execve` (or `spawnSync` fallback); the parent exits |
| Signal handlers | `SIGINT`, `SIGHUP`, `beforeExit`, `exit` listeners are cleared and re-registered before exec |
| Alternate screen | Current Ink render tree is unmounted and alternate screen is released before exec |
| Analytics drain | Up to 30 000 ms flush wait before exec (+12412982) |
| Cleanup timeout | 2 000 ms secondary cleanup timeout (+12413039) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.167 | Initial analysis |

---

## Common Mistakes

1. **Running `/tui` while background tasks are active** — the command refuses with an explicit message. Use `/tasks` to inspect or stop background sessions first, then retry.
2. **Expecting `/tui` to affect background sessions** — background sessions always use the fullscreen renderer regardless of this setting; the command only controls sessions started directly with `claude`.
3. **Setting `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` while requesting `fullscreen`** — the environment override (`env_off`) takes precedence over the `/tui fullscreen` argument.
4. **Using `/tui` inside tmux -CC (iTerm2 integration mode) without `CLAUDE_CODE_NO_FLICKER=1`** — fullscreen is automatically disabled in that environment; set the override variable if you want to force it.
5. **Interpreting the relaunch as a new process** — the relaunch uses `execve` to replace the current process image in-place; the PID changes, but the session state is forwarded via `--resume`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `sSf` | Main handler for `/tui` command (AsyncFunction; arbor_handler) |
| `gR6` | Renderer relaunch entry point (called from `sSf` at +12418871) |
| `d0H` | Renderer relaunch orchestrator (exec/spawn sequence) |
| `nS` | Claude binary path resolver |
| `uV8` | Version directory path builder |
| `X3` | Array normalisation helper |
| `h5H` | Local share path builder |
| `V1H` | Binary path composer |
| `q08` | Home directory resolver |
| `qy` | Configuration accessor |
| `R6` | Process metadata reader |
| `tv` | Version string accessor |
| `HG6` | Interval clearance / render-loop stopper |
| `bR_` | `clearInterval` wrapper |
| `oyH` | Ink/React UI teardown (unmount + alternate screen release) |
| `dL8` | Alternate-screen escape-sequence writer |
| `MIH` | Terminal capability/version checker |
| `QW` | tmux escape-sequence sanitiser |
| `Bz8` | Scroll-summary flush orchestrator |
| `oV9` | Scroll-summary accumulator (uses `Date.now`, `Math.round`) |
| `$1` | Renderer-mode resolver (decides fullscreen vs. default) |
| `VW_` | Environment-flag reader for renderer mode |
| `qa` | Fullscreen policy evaluator |
| `ZW_` | Windows/SSH renderer override checker |
| `l_` | Settings layer accessor |
| `NIL` | Renderer-mode constraint aggregator |
| `D6` | Notification/event dispatcher |
| `IL` | Promise-with-timeout helper |
| `vE` | Analytics flush trigger |
| `r4` | Analytics pipeline handler |
| `j9` | VPA (analytics pipeline) register call |
| `ipH` | VPA drain call |
| `Fz8` | Post-relaunch async cleanup orchestrator |
| `r8` | Subprocess / abort-signal wrapper |
| `K` | Subprocess output formatter |
| `q` | Temp file unlinker |
| `O` | Subprocess error handler |
| `L` | Promise-tracking set manager |
| `c4A` | Relaunch path resolution helper |
| `W_` | Version tag accessor |
| `$4` | Alternative version accessor |
| `d8K` | Native FFI exec loader (bun:ffi, execve) |
| `f` | FFI library handle |
| `A` | Platform string normaliser |
| `$` | Native symbol registry |
| `zLK` | Native call record logger |
| `w` | Background session manager (daemon worker) |
| `CH` | Session error telemetry emitter |
| `SH` | Session success telemetry emitter |
| `cx8` | Memory threshold checker |
| `tX6` | Session config file reader |
| `hH` | Error logger (uses `pr.logError`) |
| `Q` | Process kill / retry-with-backoff helper |
| `mwA` | Background session claim + connect handler |
| `QwA` | Background session lifecycle manager |
| `D` | Forced-shutdown / `process.exit` wrapper |
| `J6` | Async logging / journal emitter |
| `M` | MCP server orchestrator |
| `xbH` | MCP connection builder |
| `XF8` | MCP connection result applier |
| `dDA` | MCP server diff/update handler |
| `z` | Daemon stop handler |
| `xh` | Daemon control event emitter |
| `sp` | Graceful-shutdown race (Promise.race) |
| `GH` | String coercion helper |
| `SJ` | Relaunch-error file writer |
| `Lb8` | CLI argument list builder for relaunch |
| `vTH` | Argument token serialiser |
| `C6` | Config file watcher |
| `d6` | Config file path resolver |
| `lP_` | Config lock helper |
| `LwH` | Config read-and-backup handler |
| `U6` | JSON.parse wrapper |
| `Hu` | BOM/encoding stripper |
| `Vo1` | Backup directory scanner |
| `sP_` | Backup path joiner |
| `IVL` | File-watch registration helper |
| `co` | Config change debouncer |
| `b_` | Session app-state finder (findLast) |
| `sy8` | Session state accessor L1 (working_directory) |
| `L1` | App-state field getter |
| `ty8` | Session state accessor L1 (tool config) |
| `aB` | Permission-mode disabler |
| `t$` | Session effort/model accessor |
| `J9` | Daemon-worker mode checker |
| `dYH` | Daemon-worker identifier constant |
| `wwH` | Renderer-mode full evaluator (aggregates all signals) |
| `o_` | Settings write handler (persists tui key) |
| `eO` | Settings environment loader |
| `NzH` | Settings path resolver |
| `Vn6` | Settings directory resolver |
| `oV4` | Settings path cache key builder |
| `qu` | `.claude` directory path builder |
| `rV4` | Managed-settings path resolver |
| `kd` | Settings layer loader |
| `H__` | Settings merge / inheritance handler |
| `ipA` | Settings namespace accessor |
| `npA` | Settings inheritance walker |
| `Id` | Settings cache getter/setter |
| `_PA` | Settings cache store getter |
| `ZW` | structuredClone wrapper |
| `s8_` | Settings field validator/parser |
| `APA` | Settings cache store setter |
| `cpA` | Settings inline-patch applier |
| `_C` | Settings validation engine |
| `nKH` | Settings schema normaliser |
| `oP` | Project settings reader |
| `Br` | File encoding detector and reader |
| `g$` | Real path resolver (`realpathSync`) |
| `pc6` | Project root candidate evaluator |
| `h8` | `V8` error code wrapper |
| `t6_` | Settings access timestamp recorder |
| `IZH` | Inline-settings bootstrap |
| `$$6` | Atomic file write helper (temp + rename) |
| `RH` | `JSON.stringify` wrapper |
| `LY` | Settings cache invalidator |
| `yl6` | Settings file write orchestrator |
| `u6` | Async-store context reader |
| `mc6` | AsyncLocalStorage getter |
| `x6_` | Directory creation helper |
| `kl6` | Gitignore-check dispatcher |
| `C_` | Gitignore evaluator (git check-ignore) |
| `PZ4` | Gitignore path normaliser |
| `kuA` | Settings write post-processor |
| `yuA` | Settings write confirmation emitter |
| `gU` | Settings load orchestrator |
| `aE` | Perf-mark setter |
| `b9` | Module load tracker |
| `px` | Dynamic `require` wrapper |
| `___` | Full settings-load pipeline |
| `C8` | Settings load log writer |
| `wp6` | Settings load span recorder |
| `e$6` | Settings-load dedup set manager |
| `Dp6` | Settings load completion notifier |
| `lI` | Terminal environment capability inspector |
| `FJ6` | Terminal feature flags parser |
| `nY` | Terminal name resolver |
| `W0_` | Fullscreen support evaluator (Cursor/VSCode) |
| `FSL` | xterm.js version checker |
| `bz` | JetBrains terminal detector |
| `gSL` | Terminal height safety-cap calculator |
| `G0_` | Minimum safe terminal height constant |
| `yu` | React/Ink component renderer initialiser |
| `kC` | Ink render root factory |
| `eEL` | Ink render instance creator |
| `_6` | String coercion / identifier helper |
| `aL` | React rendering bridge |
| `D3` | Ink output stream selector |
| `H$6` | Ink render options builder |
| `QRA` | Ink render options defaults |
| `X9` | Component tree root selector |
| `Yf9` | Session info component builder |
| `sIH` | Session info renderer |
| `cC` | Main app component factory |
| `KP6` | Package version reader |
| `b7H` | Subscription type detector |
| `$q` | Ink render option pass-through |
| `ILH` | Ink render instance cache |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.