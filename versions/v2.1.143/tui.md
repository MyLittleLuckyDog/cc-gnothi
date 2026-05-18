---
type: feature-spec
feature: "tui"
cc_version: "2.1.143"
updated: "2026-05-18"
tags: ["tui", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.143 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/tui`

> Analysis basis: CC v2.1.143 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.143

---

## Overview

The `/tui` command switches the terminal UI renderer between `default` and `fullscreen` modes at runtime. It validates the current session context and environment before applying the change, persisting the chosen mode to user settings and relaunching the process with the new renderer active. If preconditions are not met (background session, active background tasks, or environment-level overrides), the command refuses the switch and reports a descriptive error to the user.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `tui` |
| description | `Set the terminal UI renderer (default \| fullscreen)` |
| argumentHint | `[default\|fullscreen]` |
| module_id | `bXq` |

Analysis basis: CC v2.1.143 bundle.js:+11390923

---

## Input Branching

The command handler (`Hv7`) evaluates several sequential gate conditions before executing a renderer switch. The flowchart below summarises all documented branches.

```mermaid
flowchart TD
    A(["/tui invoked"]) --> B[Trim argument string]
    B --> C{Session type?}
    C -->|daemon / daemon-worker| D["Error: renderer switching unavailable in background session\n(bundle.js:+11389201)"]
    C -->|foreground / system| E{Background tasks running?\nstate = running | pending\ntype = remote_agent | mcp_task}
    E -->|Yes| F["Error: cannot switch while background tasks are active\n(bundle.js:+11389695)\nEmit: tengu_tui_refused"]
    E -->|No| G[Resolve fullscreen eligibility via environment check]
    G --> H{Argument supplied?}
    H -->|No argument| I[Display current mode + eligibility status to user]
    H -->|'fullscreen'| J{Fullscreen eligible?}
    H -->|'default'| K[Set renderer = default]
    J -->|Eligible| L[Set renderer = fullscreen]
    J -->|Not eligible| M["Display eligibility reason\n(downsell / env_off / tmux_cc_auto_off / win_ssh_auto_off)"]
    K --> N[Persist to userSettings via settings writer]
    L --> N
    N --> O[Emit tengu_tui_command with uptime + chosen mode]
    O --> P[Relaunch process via relaunchHandler]
    P --> Q([Process exits and respawns with new renderer])
    D --> Z([Return error JSX to user])
    F --> Z
    M --> Z
    I --> Z
```

Analysis basis: CC v2.1.143 bundle.js:+11388898, +11389187, +11389526, +11389654, +11390126, +11390436

---

## Behavioral Spec

### Argument Normalisation

```
function normaliseArgument(rawInput):
    trimmed = rawInput.trim()           // bundle.js:+11388898
    lower   = trimmed.toLowerCase()     // bundle.js:+14528099
    return lower
```

The argument is trimmed then lower-cased before any comparison is made. Accepted values after normalisation are `"fullscreen"` and `"default"`. Any other value, including an empty string, triggers display-only (status) mode.

Analysis basis: CC v2.1.143 bundle.js:+11388898, +14528099

---

### Session-Type Guard

```
function sessionTypeGuard(sessionType):
    blockedTypes = ["daemon", "daemon-worker"]   // bundle.js:+2169293, +2169307
    if sessionType in blockedTypes:
        return Error(
            "Renderer switching isn't available in a background session" +
            " — press ← to detach and run /tui from a foreground session."
        )                                         // bundle.js:+11389201
    return OK
```

If the current session context identifies as `daemon` or `daemon-worker`, the command immediately returns an error JSX node and performs no further processing.

Analysis basis: CC v2.1.143 bundle.js:+11389187, +2169293, +2169307, +11389201

---

### Background-Task Guard

```
function backgroundTaskGuard(taskList):
    blockedStates = ["running", "pending"]        // bundle.js:+11389565, +11389587
    blockedTypes  = ["remote_agent", "mcp_task"]  // bundle.js:+11389608, +11389633

    for each task in Object.values(taskList):     // bundle.js:+11389526
        if task.state in blockedStates AND task.type in blockedTypes:
            emit("tengu_tui_refused")             // bundle.js:+11389654
            return Error(
                "Cannot switch renderers while background tasks are running" +
                " — wait for them to finish (or stop them via /tasks)," +
                " then run /tui again."
            )                                     // bundle.js:+11389695
    return OK
```

All entries in the current task map are inspected. A single qualifying entry causes the command to emit a telemetry event and return an error.

Analysis basis: CC v2.1.143 bundle.js:+11389526, +11389565, +11389587, +11389608, +11389633, +11389654, +11389695

---

### Fullscreen Eligibility Resolution

The eligibility resolver (`$$H`) computes a labelled reason code that explains why fullscreen is or is not available. It reads environment variables, terminal-type checks, and persisted settings.

```
function resolveFullscreenEligibility(env, terminalInfo, settings):

    // Environment variable hard-disable
    if env["CLAUDE_CODE_NO_FLICKER"] is set:      // bundle.js:+11387208
        return { eligible: false, reason: "env_off" }   // bundle.js:+3332770

    // Environment variable hard-enable override
    if env["CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN"] is set:  // bundle.js:+11387233
        return { eligible: true,  reason: "env_on" }        // bundle.js:+3332828

    // Automatic disable: tmux -CC (iTerm2 integration)
    if terminalInfo indicates tmux-CC mode:
        return { eligible: false, reason: "tmux_cc_auto_off" }  // bundle.js:+3332852

    // Automatic disable: Windows over SSH (ConPTY)
    if platform is "windows" AND session is SSH:
        return { eligible: false, reason: "win_ssh_auto_off" }  // bundle.js:+3332886

    // Background / flag forced-on path
    if backgroundFlagActive:
        return { eligible: true,  reason: "bg_forced_on" }  // bundle.js:+3332958

    // Persisted settings checks
    if settings.fullscreen == "on":
        return { eligible: true,  reason: "settings_on" }   // bundle.js:+3333013
    if settings.fullscreen == "off":
        return { eligible: false, reason: "settings_off" }  // bundle.js:+3333047

    // Downsell upsell path (CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL)
    if env["CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL"] is set:   // bundle.js:+11387272
        return { eligible: false, reason: "downsell_on" }   // bundle.js:+3333120

    // Gradual-rollout gates
    if gradualRolloutBucket in enabledSet:
        return { eligible: true,  reason: "gb_on" }    // bundle.js:+3333185
    else:
        return { eligible: false, reason: "gb_off" }   // bundle.js:+3333193
```

Reason codes are string constants embedded in the bundle. They are used both for telemetry attribution and for selecting the appropriate UI message shown to the user.

Analysis basis: CC v2.1.143 bundle.js:+3332770, +3332828, +3332852, +3332886, +3332958, +3333013, +3333047, +3333120, +3333185, +3333193, +11387208, +11387233, +11387272

---

### Settings Persistence

```
function persistRendererSetting(chosenMode):
    // chosenMode is "fullscreen" (bundle.js:+3332389) or "default" (bundle.js:+3332415)
    load current userSettings from disk        // bundle.js:+1206856
    userSettings.preferredRenderer = chosenMode
    write userSettings atomically to
        path.join(configDir, ".claude", "settings.json")   // bundle.js:+1197610, +1197620
    invalidate in-memory settings caches       // bundle.js:+26086, +26098
```

The writer uses an atomic rename pattern (write to temp file, apply original permissions, then rename) to avoid partial writes.

Analysis basis: CC v2.1.143 bundle.js:+1206856, +1197610, +1197620, +26086, +26098, +1001434, +1001628

---

### Telemetry Payload Construction

```
function buildTuiCommandEvent(chosenMode, eligibility):
    uptimeSeconds = Math.round(process.uptime() * 1000) / 1000
    // process.uptime() bundle.js:+11390216; Math.round bundle.js:+11390205
    // 1000 ms divisor bundle.js:+11390233

    payload = {
        mode:             chosenMode,
        eligibility:      eligibility.reason,
        uptimeMs:         uptimeSeconds
    }
    emit("tengu_tui_command", payload)   // bundle.js:+11390126
```

Analysis basis: CC v2.1.143 bundle.js:+11390126, +11390205, +11390216, +11390233

---

### Process Relaunch

After settings are persisted and telemetry is emitted, the command triggers a full process relaunch so the new renderer is activated cleanly.

```
function relaunchWithNewRenderer():
    flush analytics with timeout 30000 ms    // bundle.js:+30000, "flush timeout (relaunch)" +11385870
    wait for cleanup timeout 2000 ms         // bundle.js:+2000, "cleanup timeout" +11385926
    clear signal handlers (SIGINT, SIGTERM, SIGHUP)   // bundle.js:+11386291, +11386300, +11386310
    register beforeExit / exit handlers      // bundle.js:+11386466, +11386507
    spawn new process with "--resume" flag   // bundle.js:+11385802
        stdio: "inherit"                     // bundle.js:+11386412
    on spawn error:
        emit("relaunch_spawn_error")         // bundle.js:+11386602
        process.exit(128 + signal)           // bundle.js:+11386739
    send SIGTERM to old process              // bundle.js:+11386691
```

Analysis basis: CC v2.1.143 bundle.js:+11385802, +11385870, +11385921, +11385926, +11386291, +11386300, +11386310, +11386412, +11386466, +11386507, +11386602, +11386626, +11386691, +11386739

---

### Terminal Compatibility Check

Before rendering the fullscreen UI the terminal detector (`DI`) inspects the host environment.

```
function detectTerminalCompatibility(env, platform):
    // Check for Cursor IDE terminal
    if terminalProgram includes "cursor":        // bundle.js:+3403135
        record compatibility note

    // Check for VS Code terminal
    if terminalProgram includes "vscode":        // bundle.js:+3403184
        record compatibility note

    // Check for JetBrains IDE terminal
    if G56.isJetBrainsIdeTerminal():             // bundle.js:+3402466
        record compatibility note

    // Check for xterm.js-based terminal
    if terminalProgram includes "xterm.js":      // bundle.js:+3403304
        record compatibility note

    // Determine safe scroll region height
    rawHeight    = parseFloat(terminalRows)      // bundle.js:+3403586
    clampedHeight = Math.min(rawHeight, 20)      // bundle.js:+3403642 (max 20 lines)
    if Number.isNaN(clampedHeight):              // bundle.js:+3403607
        fallback to default height

    // Platform-specific paths
    if platform == "darwin": ...                 // bundle.js:+3402670
    if platform == "win32":  ...                 // bundle.js:+3402716
```

Analysis basis: CC v2.1.143 bundle.js:+3402438, +3402466, +3402670, +3402716, +3403135, +3403184, +3403304, +3403586, +3403607, +3403631, +3403642

---

### Fullscreen Disqualification Messages

Two static disqualification strings are embedded in the bundle:

- **tmux -CC (iTerm2 integration) detected:**
  `"fullscreen disabled: tmux -CC (iTerm2 integration mode) detected · set CLAUDE_CODE_NO_FLICKER=1 to override"`
  Analysis basis: CC v2.1.143 bundle.js:+3331999

- **Windows over SSH (ConPTY) detected:**
  `"fullscreen disabled: Windows over SSH (ConPTY re-rendering) detected · set CLAUDE_CODE_NO_FLICKER=1 to override"`
  Analysis basis: CC v2.1.143 bundle.js:+3332185

Both messages instruct the user to set `CLAUDE_CODE_NO_FLICKER=1` to override the automatic disable.

---

### Gradual-Rollout Gate

```
function gradualRolloutCheck(sessionId):
    // Uses a deterministic bucket derived from sessionId
    // Telemetry events recorded via tengu_amber_creek / tengu_pewter_brook
    bucket = computeBucket(sessionId)            // bundle.js:+3332572, +3332480
    if bucket in enabledBucketSet:
        return true   // "gb_on"
    else:
        return false  // "gb_off"
```

Analysis basis: CC v2.1.143 bundle.js:+3332480, +3332572, +3333185, +3333193

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_tui_refused` | Emitted when a background task blocks the switch (bundle.js:+11389654) |
| Telemetry — `tengu_tui_command` | Emitted on every successful renderer selection, carries mode + uptime (bundle.js:+11390126) |
| Telemetry — `tengu_amber_creek` | Emitted inside the gradual-rollout eligibility check (bundle.js:+3332572) |
| Telemetry — `tengu_pewter_brook` | Emitted inside the gradual-rollout eligibility check (bundle.js:+3332480) |
| Telemetry — `tengu_slate_kestrel` | Emitted during the analytics/account-tier check called during relaunch (bundle.js:+10022817) |
| Settings write | `userSettings` section of `.claude/settings.json` updated with new renderer preference (bundle.js:+1206856, +1197620) |
| Cache invalidation | In-memory settings caches (`kV6`, `EZ8`) cleared after write (bundle.js:+26086, +26098) |
| Signal handlers | `SIGINT`, `SIGTERM`, `SIGHUP` handlers replaced during relaunch (bundle.js:+11386291–11386310) |
| Process relaunch | `kXq.spawnSync` used to spawn replacement process with `--resume` flag (bundle.js:+11385802, +11386377) |
| Event emission | `WCH.emit` called after settings persist (bundle.js:+1207214) |
| Timestamp tracking | `RR6.set(Date.now())` records the moment of the settings write (bundle.js:+1086635, +1086645) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.143 | Initial analysis |

---

## Common Mistakes

1. **Running `/tui` inside a background (daemon) session.** The command detects `daemon` and `daemon-worker` session types and refuses immediately. Detach to a foreground session first (press `←`), then invoke `/tui`. (bundle.js:+11389201)

2. **Running `/tui` while MCP tasks or remote-agent tasks are active.** Any task with state `running` or `pending` and type `remote_agent` or `mcp_task` will block the switch. Use `/tasks` to stop them first. (bundle.js:+11389695)

3. **Expecting `/tui fullscreen` to work in tmux -CC mode without an override.** The iTerm2 tmux-CC integration is automatically detected and fullscreen is disabled. Set `CLAUDE_CODE_NO_FLICKER=1` to override. (bundle.js:+3331999)

4. **Expecting `/tui fullscreen` to work on Windows over SSH.** ConPTY re-rendering is detected and fullscreen is auto-disabled. Set `CLAUDE_CODE_NO_FLICKER=1` to override. (bundle.js:+3332185)

5. **Not accounting for the gradual rollout.** Even on a compatible terminal, fullscreen may be gated to a subset of sessions via the gradual-rollout bucket mechanism. The `gb_off` reason code indicates the session is outside the enabled set.

6. **Assuming the switch is instantaneous.** The command persists settings and then relaunches the entire process. A 30-second analytics flush timeout and a 2-second cleanup timeout are observed before the new process spawns. (bundle.js:+11385870, +11385926)

7. **Passing an unrecognised argument (e.g., `/tui on`).** The argument is normalised to lowercase and compared against `"fullscreen"` and `"default"` only. Any other value puts the command into status-display mode rather than triggering a mode change.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Hv7` | Main `/tui` command handler (JSX component) |
| `A` | Argument normalisation helper (trim → toLowerCase) |
| `f` | Stream/terminal close helper called during relaunch teardown |
| `R_` | Settings load-from-disk orchestrator |
| `Lu` | Settings-from-disk loader (emits loadSettingsFromDisk_start / _end) |
| `rA` | Fullscreen eligibility resolver (reads env, terminal state, settings) |
| `VRH` | JetBrains-IDE terminal detector |
| `u1_` | Windows-platform detection helper |
| `xH` | String coercion utility |
| `hl` | tmux-CC mode detection helper |
| `v` | Debug / log level helper |
| `x1_` | Boolean coercion / flag reader |
| `ybL` | Gradual-rollout sub-resolver |
| `G6` | Gradual-rollout gate (checks bucket sets, emits tengu_amber_creek / tengu_pewter_brook) |
| `H` | Random number / setTimeout utility (used in relaunch timing) |
| `T1` | Session-type classifier (daemon / daemon-worker / system) |
| `cB` | Session-type constant store |
| `d` | Task-map accessor |
| `$$H` | Fullscreen eligibility reason-code builder (returns env_off / env_on / gb_on / etc.) |
| `p_` | Settings persistence and relaunch orchestrator |
| `wO` | Settings-write helper (reads k5H / WB) |
| `x6` | Config directory resolver |
| `lm8` | Atomic file-write helper |
| `WB` | Full settings writer (handles policySettings, flagSettings, userSettings, etc.) |
| `AP` | Post-write event emitter |
| `$8` | ENOENT-safe file reader |
| `nu8` | Write-timestamp recorder (RR6.set / Date.now) |
| `XXH` | Settings-write cache coordinator |
| `yA6` | Atomic rename writer (temp file, fchmod, fsync, rename, unlink) |
| `hH` | JSON serialiser helper |
| `hz` | In-memory settings cache invalidator (kV6.clear / EZ8.clear) |
| `VR6` | Async settings file writer (mkdir, readFile, appendFile, writeFile) |
| `hy` | Settings path builder (.claude/settings.json) |
| `__` | Global-state accessor |
| `NH` | Event hook registrar (WCH.emit wrapper) |
| `DI` | Terminal compatibility checker (Cursor, VS Code, JetBrains, xterm.js) |
| `h56` | Terminal program name accessor |
| `hJ` | Terminal environment variable reader |
| `vq_` | EpL-based terminal-version parser |
| `P$H` | IDE-terminal flag setter |
| `ZpL` | Terminal row-height clamper (parseFloat / Math.min / Number.isNaN) |
| `jF` | Analytics flush initiator (Uu / RSL / OO / TA6) |
| `Uu` | Analytics flush coordinator |
| `uq` | Analytics/account-tier gate (emits tengu_slate_kestrel) |
| `N1q` | wC_ network-request wrapper |
| `bp` | Account-tier resolver (firstParty / enterprise / team) |
| `zq` | Essential-traffic network classifier |
| `K0H` | xH-based analytics key formatter |
| `CXq` | Relaunch entry point (delegates to twH) |
| `twH` | Full process-relaunch implementation (flush, spawn, signal, exit) |