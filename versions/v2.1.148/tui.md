---
type: feature-spec
feature: "tui"
cc_version: "2.1.148"
updated: "2026-06-01"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.148 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.148 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.148

---

## Overview

The `/tui` command switches the terminal UI renderer between `default` and `fullscreen` modes at runtime. It validates the runtime environment before applying any change — blocking the switch in background sessions or while background tasks are active — then tears down the current UI process and relaunches it in the requested mode.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| module_id | `uN1` |
| load_inline | `true` |
| loc_byte | `11860776` |
| loc_byte_end | `11860958` |
| loc_line | `9721` |
| arbor_handler.name | `jU7` |
| arbor_handler.fqn | `claude-2.1.148::jU7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.148 bundle.js:+11860776

---

## Input Branching

The command has five or more distinct guard branches before the renderer switch is executed, making a flowchart the appropriate representation.

```mermaid
flowchart TD
    A(["/tui [arg]"]) --> B[Trim & lowercase argument]
    B --> C{Session type?}
    C -->|daemon or daemon-worker| D["❌ Error: renderer switching unavailable\nin background session\n(bundle.js:+11859054)"]
    C -->|system / foreground| E{Background tasks running?\nstate = running / pending /\nremote_agent / mcp_task}
    E -->|Yes| F["❌ Error: cannot switch while\nbackground tasks are active\n(bundle.js:+11859548)"]
    E -->|No| G{Argument supplied?}
    G -->|No argument| H[Derive effective fullscreen mode\nfrom current environment heuristics]
    G -->|'fullscreen'| I[Target mode = fullscreen]
    G -->|'default'| J[Target mode = default]
    H --> K{Fullscreen feasible?\nCheck env vars, tmux-CC,\nWindows-SSH, settings, feature flag}
    K -->|tmux -CC detected| L["⚠️ fullscreen disabled:\ntmux -CC / iTerm2 integration mode\n(bundle.js:+11851228)"]
    K -->|Windows over SSH detected| M["⚠️ fullscreen disabled:\nWindows SSH / ConPTY\n(bundle.js:+11851414)"]
    K -->|All clear| N[Resolve final target mode]
    I --> N
    J --> N
    L --> N
    M --> N
    N --> O[Emit tengu_tui_command telemetry]
    O --> P[Record process.uptime + Math.round\nfor timing metadata\n(bundle.js:+11860058–11860069)]
    P --> Q[Flush pending analytics\nwith timeout 30 000 ms\n(bundle.js:+11855671)]
    Q --> R[Tear down current UI:\nunmount Ink tree, drain write buffer,\nstop interval timers\n(bundle.js:+11855632–11855638)]
    R --> S[spawnSync / execve relaunch\nin new renderer mode\n(bundle.js:+11856230, +11855129)]
    S --> T([Process replaced])
```

---

## Behavioral Spec

### 1. Argument Normalization

```
function normalizeArgument(rawArg):
    trimmed = rawArg.trim()          // callGraph: jU7 → A.trim @ +11858751
    lower   = trimmed.toLowerCase()  // callGraph: A   → M.toLowerCase @ +15143503
    return lower
```

Analysis basis: CC v2.1.148 bundle.js:+11858751

---

### 2. Session-Type Guard

```
function assertForegroundSession(sessionContext):
    if sessionContext.type in ["daemon", "daemon-worker"]:
        // literal @ +11859054
        raise UserError(
            "Renderer switching isn't available in a background session" +
            " — press ← to detach and run /tui from a foreground session."
        )
```

The session type is resolved via `isBackgroundSession` (identifier `Rq → T3H`, bundle.js:+11859040 and +2181227). The literals `"daemon"` (+2181160) and `"daemon-worker"` (+2181174) are the exact string values checked.

Analysis basis: CC v2.1.148 bundle.js:+11859040

---

### 3. Background-Task Guard

```
function assertNoActiveTasks(taskRegistry):
    BLOCKING_STATES = ["running", "pending", "remote_agent", "mcp_task"]
    // literals @ +11859418, +11859440, +11859461, +11859486
    active = taskRegistry.filter(t => BLOCKING_STATES.includes(t.state))
    if active.length > 0:
        raise UserError(
            "Cannot switch renderers while background tasks are running" +
            " — wait for them to finish (or stop them via /tasks), then run /tui again."
        )
        // telemetry emitted: tengu_tui_refused @ +11859507
```

Analysis basis: CC v2.1.148 bundle.js:+11859418–11859507

---

### 4. Fullscreen Feasibility Detection

This sub-feature (identifier `nv`) runs when no explicit argument is given, or to validate `fullscreen` was chosen wisely. It gates the mode on several environmental signals:

```
function detectFullscreenFeasibility(env):
    // Terminal IDE checks (Cursor, VS Code) @ +3422381, +3422430
    if isJetBrainsIdeTerminal():
        return SUPPRESS_FULLSCREEN

    // tmux control-mode detection (_l4 → H.startsWith) @ +3350259
    // checks TERM_PROGRAM for "screen" or "tmux" @ +3350272, +3350297
    // then runs: tmux display-message -p #{client_control_mode} @ +3350482–+3350505
    // with utf8 encoding and 2000 ms timeout @ +3350541, +3350556
    if tmuxControlModeActive():
        warn("fullscreen disabled: tmux -CC (iTerm2 integration mode) detected" +
             " · set CLAUDE_CODE_NO_FLICKER=1 to override")
        // literal @ +3351228
        return SUPPRESS_FULLSCREEN

    // Windows-over-SSH check (W7_ → Boolean) @ +3351354
    if platform == "windows" and overSSH:
        // literal "windows" @ +3350766
        warn("fullscreen disabled: Windows over SSH (ConPTY re-rendering) detected" +
             " · set CLAUDE_CODE_NO_FLICKER=1 to override")
        // literal @ +3351414
        return SUPPRESS_FULLSCREEN

    // Environment variable overrides
    if env.CLAUDE_CODE_NO_FLICKER set:          // @ +11857061
        return DEFAULT_MODE
    if env.CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN: // @ +11857086
        return DEFAULT_MODE
    if env.CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL: // @ +11857125
        return FULLSCREEN_UPSELL_MODE

    return FULLSCREEN_ALLOWED
```

The result is tagged with one of several reason codes for telemetry: `"bg_forced_on"`, `"env_off"`, `"env_on"`, `"tmux_cc_auto_off"`, `"win_ssh_auto_off"`, `"settings_on"`, `"settings_off"`, `"downsell_on"`, `"gb_on"`, `"gb_off"` (literals +3351981 through +3352366).

Analysis basis: CC v2.1.148 bundle.js:+3350259, +3351228, +3351414, +11857061

---

### 5. Settings Load

Before applying the renderer change, the handler loads user/project/policy settings via `settingsLoader` (identifier `_A → Km`, +1215587). Layers resolved:

| Layer | Key | Path |
|---|---|---|
| flagSettings | `"flagSettings"` (+1202492) | internal flags |
| policySettings | `"policySettings"` (+1202514) | enterprise policy |
| userSettings | `"userSettings"` (+1205665) | `~/.claude/settings.json` (+1205919, +1205929) |
| projectSettings | `"projectSettings"` (+1205716) | project `.claude/settings.json` |
| localSettings | `"localSettings"` (+1205738) | `.claude/settings.local.json` (+1205991) |
| SDK inline | `"SDK inline settings"` (+1204768) | programmatic SDK overrides |

Telemetry markers `"loadSettingsFromDisk_start"` (+1213300) and `"loadSettingsFromDisk_end"` (+1213356) bracket the disk read. Events `"settings_load_started"` (+1210029) and `"settings_load_completed"` (+1210706) are also emitted at `"info"` level (+1210022).

Analysis basis: CC v2.1.148 bundle.js:+1213300, +1213356

---

### 6. Renderer Switch Execution (Relaunch)

```
async function executeRendererSwitch(targetMode, currentProcessContext):
    // 1. Determine argument list
    args = buildRelaunchArgs(targetMode)   // includes --resume flag @ +11855609
    
    // 2. Flush analytics with race-timeout
    await Promise.race([
        flushAnalytics(),          // identifier f18, @ +11855778
        timeout(30_000)            // literal "flush timeout (relaunch)" @ +11855671, +11855677
    ])

    // 3. Flush write buffers, drain output queue
    await drainWriteQueue()        // WRH → D9A.drain @ +57511

    // 4. Tear down UI
    stopIntervalTimers()           // JD6 → oP_ → clearInterval @ +5274239
    unmountInkTree()               // VVH → H.unmount @ +5272893
    writeTerminalRestoreSequences()// ue6 → ESC-7, ESC-8 @ +3686190, +3686201

    // 5. Wait for cleanup with race-timeout
    await Promise.race([
        cleanup(),
        timeout(???)               // "cleanup timeout" @ +11855733
    ])

    // 6. Replace process image via execve / spawnSync
    // On platforms supporting execve (macOS/Linux), use FFI execve
    //   kN1 → f.execve @ +11855129
    //   loads libSystem.B.dylib (macOS) @ +11854774 or libc.so.6 (Linux) @ +11854803
    // Fallback: hN1.spawnSync @ +11856230
    replaceProcess(args)

    // 7. If relaunch fails, record error
    // telemetry "relaunch_spawn_error" @ +11856455
    // exit with code 128 @ +11856592
```

The process registers signal handlers for SIGINT, SIGTERM, SIGHUP (+11856144–+11856163) before the relaunch so any signal received during the transition window is relayed to the new process.

Analysis basis: CC v2.1.148 bundle.js:+11855650, +11855671, +11856230, +11855129

---

### 7. Telemetry Payload (`tengu_tui_command`)

```
function buildTuiCommandTelemetryPayload(targetMode, feasibilityReason, context):
    return {
        mode:           targetMode,          // "fullscreen" or "default"
        reason:         feasibilityReason,   // e.g. "tmux_cc_auto_off"
        uptime_rounded: Math.round(process.uptime()),  // @ +11860058, +11860069
        // Object.values enumeration of active task states @ +11859379
    }
// event: tengu_tui_command @ +11859979
```

Analysis basis: CC v2.1.148 bundle.js:+11859979

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_tui_refused` (+11859507) — emitted when blocked by active tasks; `tengu_tui_command` (+11859979) — emitted on every successful invocation with mode/reason/uptime payload; `tengu_amber_creek` (+3351745) — fullscreen-feasibility sub-path; `tengu_pewter_brook` (+3351653) — fullscreen-feasibility sub-path; `tengu_slate_kestrel` (+4671398) — analytics/account type; `tengu_scroll_summary` (+5274361) — scroll/session summary on teardown; `tengu_bg_dispatch_sigkill_escalate` (+15117585), `tengu_bg_dispatch_low_mem` (+15118164), `tengu_bg_spare_enable` (+15118859), `tengu_bg_spare_claim` (+15118980), `tengu_bg_spare_claim_fail` (+15119243), `tengu_daemon_control` (+15153677) — background daemon side-effects during teardown |
| Process replacement | The current process image is replaced via `execve` (FFI, macOS/Linux) or `spawnSync` fallback; there is no return from a successful switch |
| Signal handlers | SIGINT, SIGTERM, SIGHUP listeners are removed and re-registered around the relaunch boundary (+11856173, +11856203) |
| Ink / TUI teardown | Ink component tree is unmounted; interval timers cleared; terminal alternate-screen restore sequences (ESC-7/ESC-8) are written |
| Settings side-effect | Full settings stack is loaded from disk before the switch; caches `bI6` and `pI8` are cleared (`VY` path, +26086, +26098) |
| appState changes | Task registry read (not mutated) to gate the guard; session-type field read from context |
| File I/O | Settings files read; analytics/log files appended (`IJK → yI.appendFile`); relaunch error state optionally written via `A2 → cRH.writeFileSync` (+189287) |
| Sound | None observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.148 | Initial analysis |

---

## Common Mistakes

1. **Running `/tui` inside a background (daemon) session** — the command will refuse with an explicit message directing the user to detach first (`←` key) and run `/tui` from a foreground session.
2. **Running `/tui` while background tasks are active** — tasks in `running`, `pending`, `remote_agent`, or `mcp_task` state block the renderer switch. Use `/tasks` to monitor or cancel them first.
3. **Expecting `/tui fullscreen` to work under tmux -CC (iTerm2 integration mode)** — the command auto-detects this configuration and downgrades to `default`; override with `CLAUDE_CODE_NO_FLICKER=1`.
4. **Expecting `/tui fullscreen` to work over Windows SSH** — ConPTY re-rendering causes flicker artifacts; the command auto-disables fullscreen. Override with `CLAUDE_CODE_NO_FLICKER=1`.
5. **Omitting the argument and expecting a toggle** — without an argument the command derives the target mode from environment heuristics rather than toggling the current setting.
6. **Interrupting the switch mid-flight** — the relaunch uses `execve` to replace the process image; sending SIGKILL during the teardown window may leave the terminal in an inconsistent state (alternate-screen not restored).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `jU7` | Main handler — async function implementing `/tui` (arbor_handler) |
| `A` | Argument string variable (post-trim); also reused in other contexts |
| `M` | Lowercase-normalized argument string; stream/file handle in teardown paths |
| `q` | Temp-file / socket close helper; array accessor in other contexts |
| `L` | Active-task set / file append helper / collection map utility |
| `HA` | Settings loader entry point |
| `Km` | Core settings load orchestrator (wraps `gR`, `Wq`, `Xg8`, `WF`, `xI6`) |
| `gR` | Settings load sub-step (role unclear at depth-2) |
| `Wq` | Performance-hooks / memory-usage recorder during settings load |
| `pu` | `require` wrapper for `perf_hooks` |
| `Xg8` | Settings telemetry and layer merger |
| `C8` | Log file appender (mkdirSync + appendFileSync) |
| `uI6` | Settings utility (role unclear at depth-2) |
| `U16` | Flag-settings layer accumulator |
| `jWA` | Settings key enumerator (Object.keys) |
| `K` | Column padder (padEnd 40) for settings display |
| `AfH` | User-settings file resolver (`~/.claude/settings.json`) |
| `XF` | Project-settings file resolver |
| `YWA` | SDK inline settings merger |
| `WF` | Settings field aggregator (many sub-fields) |
| `w_` | Utility: get current app context/store |
| `k86` | Settings field handler (role unclear at depth-2) |
| `tk8` | Settings field handler (role unclear at depth-2) |
| `Z86` | Settings field handler (role unclear at depth-2) |
| `TXH` | Settings field handler (role unclear at depth-2) |
| `y86` | Settings field handler (role unclear at depth-2) |
| `tMH` | Settings field handler (role unclear at depth-2) |
| `eMH` | Settings field handler (role unclear at depth-2) |
| `Og8` | Settings field handler (role unclear at depth-2) |
| `o2A` | Settings field handler (role unclear at depth-2) |
| `Nl` | Settings field handler (role unclear at depth-2) |
| `B16` | WSL / platform-specific settings layer |
| `xI6` | Post-load settings finalizer |
| `z9` | Full renderer-context builder (session type, task state, feasibility) |
| `VbH` | Session-type lookup helper |
| `G7_` | "yes"/"on" boolean-string parser |
| `r1` | String coercion for truthy env-var values (`"yes"`, `"on"`) |
| `UH` | String coercion utility (general) |
| `bn` | iTerm / terminal detection helper |
| `Al4` | tmux control-mode detector (spawnSync wrapper) |
| `_l4` | TERM_PROGRAM prefix checker (`startsWith`) |
| `N` | Telemetry event builder / logger dispatcher |
| `vJK` | Log-line formatter |
| `j9A` | Log level classifier |
| `H` | Random-delay / setTimeout wrapper; also reused as string var |
| `CH` | JSON.stringify utility |
| `_` | Filter/set utility |
| `f4` | Redaction helper (`[REDACTED]` substitution) |
| `l1A` | Log field mapper |
| `lRH` | Write-to-stdout helper |
| `b1A` | Raw `H.write` wrapper |
| `kJK` | Structured log file writer (mkdir + appendFile) |
| `XRH` | Output batching / setTimeout flush |
| `XAH` | Log directory joiner |
| `F6` | Filesystem error classifier |
| `C_6` | EISDIR error guard |
| `e1A` | Log path joiner |
| `t1A` | Log file rotator (stat + rename + unlink) |
| `IJK` | Async log append with rotation |
| `r9` | Exit-handler / drain registrar |
| `W7_` | Windows-over-SSH detector |
| `ql4` | Fullscreen feasibility resolver (wraps `V6`) |
| `V6` | Core feasibility state machine |
| `Df6` | Feasibility state reader |
| `wf6` | Feasibility state writer |
| `Ct` | Feasibility context string coercer |
| `As6` | Feature-flag / feasibility cache accessor |
| `x6` | Feasibility metric recorder (Date.now) |
| `Rq` | Daemon/background-session type checker |
| `T3H` | Session-type enum resolver |
| `c` | JSX render helper / UI component factory |
| `u$H` | Feasibility-result composer for relaunch context |
| `_A` | Full settings + context assembler pre-relaunch |
| `fz` | Settings path pair (AfH + WF) |
| `Pg8` | Settings aggregator (jWA + AfH + XF + YWA + Tl) |
| `BP` | File-content reader (wraps El) |
| `El` | File reader with encoding detection and BOM stripping |
| `j3` | File-type validator (FIFO/socket/char-device guard) |
| `tb6` | File size limit enforcer (4096/255/254) |
| `eb6` | Encoding snicer |
| `J8` | Error-code normalizer (`q8`) |
| `q8` | ENOENT / EISDIR / ELOOP / ENOTDIR classifier |
| `TF8` | Timestamp setter (lx6.set + Date.now) |
| `$WH` | Path resolver pair (Ru6 + WF) |
| `Ru6` | Canonical path resolver (Pv.resolve + Pv.dirname) |
| `sq6` | Atomic file writer (randomBytes temp + rename + fchmod + fsync) |
| `O` | Symbolic-link follower; also timeout/race helper |
| `v8` | State value accessor |
| `VY` | Cache clearer (bI6 + pI8) |
| `Ux6` | Git-ignore checker + config file I/O |
| `b6` | App store accessor |
| `sb6` | AsyncLocalStorage store reader |
| `KF8` | Git metadata accessor |
| `OF8` | File-path git-ignore evaluator |
| `T_` | Git check-ignore subprocess runner |
| `lFK` | `~/.config/claude/ignore` path builder |
| `jC` | `.claude/settings.json` path joiner |
| `RH` | Error logger with queue (bbH.push + Gl.logError) |
| `n_` | Error/String coercion pair |
| `j1` | Log entry constructor (XwA) |
| `XwA` | Log record builder |
| `FpK` | Log ring-buffer manager (shift + push) |
| `nv` | Terminal capability / IDE environment detector |
| `$36` | Environment variable reader |
| `WJ` | Process env accessor |
| `f5_` | xterm.js version range checker |
| `ar4` | xterm.js version parser |
| `c$H` | Fallback env accessor |
| `sr4` | Terminal column-count resolver (parseFloat + Math.min 20) |
| `$5_` | Column-count env reader |
| `rC` | Auth / account-type resolver |
| `Qh` | Account context builder |
| `Hg4` | Auth token loader |
| `EO` | First-party auth classifier |
| `Hz` | Account tier resolver |
| `cq6` | Log entry for auth context |
| `Q1` | Feature-flag / analytics consent checker |
| `hs9` | Feature-flag evaluator |
| `l_8` | Feature-flag loader |
| `ES` | Feature-flag session builder |
| `IY_` | Feature-flag file reader |
| `hqH` | UH-based string wrapper for flag result |
| `xN1` | Relaunch orchestrator (wraps FJH) |
| `FJH` | Full process-replacement implementation |
| `hx` | Claude binary path resolver |
| `LY8` | Versioned binary path builder |
| `P6H` | `~/.local/bin` path builder |
| `cf` | Array/path utility |
| `zR` | Context/state snapshot before relaunch |
| `h6` | Process event emitter (oV) |
| `oV` | EventEmitter base |
| `JD6` | Interval-timer stopper (clearInterval) |
| `oP_` | clearInterval wrapper |
| `VVH` | Ink UI unmount + terminal cleanup |
| `nh` | Terminal cursor restore helper |
| `ue6` | Alternate-screen restore (ESC-7 / ESC-8 sequences) |
| `M18` | Scroll-summary emitter before teardown |
| `sV` | Scroll summary state reader |
| `B7q` | Scroll summary formatter |
| `U7q` | Frame-timing calculator (Date.now + Math.max + Math.round) |
| `dM` | Promise.race timeout helper (30 000 ms flush) |
| `PV` | Pending-write drainer |
| `v4` | Write queue processor |
| `WRH` | D9A drain caller |
| `f18` | Analytics flush with 500 ms race-timeout |
| `r8` | Abortable timeout promise |
| `Vc_` | Pre-relaunch context serializer |
| `M4` | oV-based event helper |
| `kN1` | execve / FFI-based process replacement |
| `$` | Push-array helper; also ZC1 accessor |
| `w` | Background worker / subprocess manager |
| `f` | FFI execve binding holder |
| `z` | Process state holder (bH / mH / Pk / Ou) |
| `ZH` | String coercion wrapper |
| `A2` | Relaunch-error state file writer |