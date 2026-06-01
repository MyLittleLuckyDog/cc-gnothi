---
type: feature-spec
feature: "update"
cc_version: "2.1.146"
updated: "2026-06-01"
tags: ["update", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.146 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/update`

> Analysis basis: CC v2.1.146 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.146

---

## Overview

`/update` performs an in-place hot-swap of the running Claude Code binary to the latest published version, **without ending the current conversation**. It locates the installed binary, validates that the environment is safe to restart, tears down the current process bridge, and re-executes the new binary with the `--resume` flag so the session continues seamlessly.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `update` |
| description | `Switch to the latest version (conversation continues)` |
| loc_byte | `12078992` |
| loc_byte_end | `12079194` |
| loc_line | `9950` |
| supportsNonInteractive | `false` |
| isHidden | `true` |
| module_id | `py1` |
| load_inline | `true` |
| arbor_handler.name | `YB7` |
| arbor_handler.fqn | `claude-2.1.146::YB7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.146 bundle.js:+12078992

---

## Input Branching

The command has 4+ distinct branches (background-tasks check, project-directory mismatch check, flush/teardown path, exec path), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/update invoked"]) --> B{Locate 'claude' binary\nvia PATH resolution}
    B -- Not found --> ERR1([Return error: binary not located])
    B -- Found --> C{Background tasks\nin 'running' or 'pending' state?}
    C -- Yes --> ERR2(["Refuse: 'Cannot /update while background\ntasks are running — wait for them to\nfinish, then try again.'\n(tengu_update_refused telemetry)"])
    C -- No --> D{Session was resumed\nfrom a different project\ndirectory?}
    D -- Yes --> ERR3(["Refuse: 'Cannot /update — this session\nwas resumed from a different project\ndirectory. Restart manually with\n--resume to continue on the latest version.'"])
    D -- No --> E[Resolve versioned binary path\n under ~/.local/share/versions/…/bin/claude]
    E --> F[Emit 'Switching to latest Claude Code…\nreconnecting' status message]
    F --> G[Write SDK messages / flush output bridge\nwith 2000 ms timeout]
    G --> H[Flush analytics with 500 ms timeout\n'bridge flush']
    H --> I[Teardown current bridge / output layer]
    I --> J[Clear signal handlers\n(SIGINT, SIGHUP, beforeExit, exit)]
    J --> K[spawnSync new binary with\n--resume and inherited stdio]
    K -- spawn error --> ERR4([Log 'relaunch_spawn_error'; exit 128])
    K -- success --> L[process.exit / process.kill\nto hand off to new process]
```

Analysis basis: CC v2.1.146 bundle.js:+12076787 … +12078315

---

## Behavioral Spec

### 1 — Binary Location

```
async function locateBinary():
    result = which("claude")          // Bun.which  (+12076787 / +1051257)
    if result is null:
        return error("binary not found")
    return result
```

Analysis basis: CC v2.1.146 bundle.js:+12076787, +1051257

---

### 2 — Versioned Install Path Resolution

```
function resolveVersionedPath(binaryPath):
    homeDir   = os.homedir()          // mkq.homedir  (+7494022)
    sharePath = path.join(homeDir, ".local", "share", "versions")
    // (+7494295, +7494304)
    binPath   = path.join(sharePath, …, "bin")   // (+7494375)
    return binPath
```

The path components `".local"`, `"share"`, `"versions"`, and `"bin"` are assembled through two helper functions (path-join helpers `IDH` and `L6H`) that both call the home-directory resolver and join sub-paths.

Analysis basis: CC v2.1.146 bundle.js:+8771367, +8771391, +7494253, +7494284, +7494341, +7494355

---

### 3 — Pre-flight Checks

```
async function preflightChecks(appState):
    // Background-task gate
    tasks = Object.values(appState.backgroundTasks)   // (+12077110)
    hasActive = tasks.some(t => t.status == "running"
                             or t.status == "pending") // (+12077148, +12077170)
    if hasActive:
        emit telemetry("tengu_update_refused")         // (+12076887)
        return Err("Cannot /update while background tasks are running"
                   " — wait for them to finish, then try again.")
                                                       // (+12077251)

    // Project-directory mismatch gate
    currentDir = process.cwd()
    sessionDir = appState.projectDirectory
    if currentDir != sessionDir:
        return Err("Cannot /update — this session was resumed from a"
                   " different project directory. Restart manually with"
                   " --resume to continue on the latest version.")
                                                       // (+12077492)

    return Ok
```

Analysis basis: CC v2.1.146 bundle.js:+12077035, +12077110, +12077148, +12077170, +12077251, +12077358, +12077492

---

### 4 — Status Message & App-State Update

```
function emitStatusMessage(api):
    // Produce a synthetic assistant text message into the conversation
    msgId = generateUUID()           // aW8.randomUUID  (+12075860)
    msg = {
        role: "assistant",           // (+12075836)
        content: [{ type: "text",    // (+12076933)
                    text: "Switching to latest Claude Code… reconnecting" }]
                                     // (+12077985)
    }
    api.writeSdkMessages([msg])      // O.writeSdkMessages  (+12077961)

    // Update app state to reflect relaunch in progress
    state = _.getAppState()          // (+12077739)
    // filter out any messages whose id starts with "assistant-"
    updatedMessages = state.messages.filter(...)   // (+12077793)
    _.setAppState({ ...state,
                    messages: updatedMessages })    // (+12077875)
```

Analysis basis: CC v2.1.146 bundle.js:+12075836, +12075860, +12076933, +12077739, +12077793, +12077875, +12077961, +12077985

---

### 5 — Bridge Flush & Teardown

```
async function flushAndTeardown(api):
    // Wait up to 2000 ms for bridge to drain
    await raceWithTimeout(api.flush(), 2000, label="bridge flush")
                                      // (+12078052, +12078065, +12078070)
    // OM = raceWithTimeout helper using Promise.race + setTimeout + clearTimeout
    //   (+2210492, +2210555, +2210602)

    api.teardown()                    // O.teardown  (+12078106)
```

Analysis basis: CC v2.1.146 bundle.js:+12078052, +12078055, +12078065, +12078070, +12078106

---

### 6 — Re-exec Sequence (`relaunchHandler` / `XJH`)

```
async function relaunchHandler(newBinaryPath, resumeFlag):
    // Stat the new binary to confirm it exists
    stat = await fs.stat(newBinaryPath)      // XV1.stat  (+11809180)

    // Stop UI / terminal rendering layers
    stopSpinner()                            // FY6 → lJ_ → clearInterval  (+11809250)
    unmountTerminalUI()                      // AVH → H.unmount  (+5269422)

    // Flush scroll summary
    scrollSummary = buildScrollSummary()     // Vq8 + yLq  (+11809262)

    // Run analytics drain with timeout
    await drainAnalytics()                   // vq8 + 500 ms race  (+11809402)
    // label: "analytics flush timeout"  (+11809413)

    // Apply pending MCP updates if any
    await applyMcpUpdates()                  // jV1 → M.execve path  (+11809684)

    // Re-assign process object
    Object.assign(process, ...)              // (+11809610)

    // Clear all inherited signal listeners
    process.removeAllListeners("SIGINT")     // (+11809751)
    process.removeAllListeners("SIGHUP")
    process.on("beforeExit", ...)            // (+11809781)

    // Spawn the new binary synchronously, inheriting stdio
    result = PV1.spawnSync(                  // (+11809808)
        newBinaryPath,
        ["--resume", ...args],               // (+11809233)
        { stdio: "inherit" }                 // (+11809843)
    )

    if result indicates spawn error:
        writeErrorFile()                     // sX → vRH.writeFileSync  (+11810030, +189011)
        emit("relaunch_spawn_error")         // (+11810033)
        process.exit(128)                    // (+11809808, +11810057, +11810170)

    // Signal self to hand off
    process.kill(process.pid, ...)          // (+11810122)
```

Analysis basis: CC v2.1.146 bundle.js:+11809104, +11809180, +11809233, +11809250, +11809256, +11809262, +11809274, +11809287, +11809295, +11809346, +11809402, +11809413, +11809610, +11809684, +11809751, +11809781, +11809808, +11809843, +11810030, +11810033, +11810057, +11810122, +11810170

Flush timeout: 30000 ms (`"flush timeout (relaunch)"`) Analysis basis: CC v2.1.146 bundle.js:+11809295, +11809301

Cleanup timeout label: `"cleanup timeout"` Analysis basis: CC v2.1.146 bundle.js:+11809357

---

### 7 — Hook / Conversation-Log Append

```
function appendLastPromptEntry(conversationLog):
    conversationLog.appendEntry({
        role: "last-prompt",        // (+12576403)
        ...
    })                              // Gc_ → _.appendEntry  (+12576383)
```

Analysis basis: CC v2.1.146 bundle.js:+12077711, +12576297, +12576383, +12576403, +12576521

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_update_refused` | Fired when the update is blocked due to running/pending background tasks (bundle.js:+12076887) |
| Telemetry — `tengu_scroll_summary` | Fired during terminal re-render cleanup in the relaunch path (bundle.js:+5270890) |
| Telemetry — `tengu_amber_creek` | Fired from fullscreen/rendering subsystem reached during teardown (bundle.js:+3339940) |
| Telemetry — `tengu_pewter_brook` | Fired from fullscreen/rendering subsystem reached during teardown (bundle.js:+3339848) |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Fired if a background worker requires SIGKILL escalation during shutdown (bundle.js:+15060413) |
| Telemetry — `tengu_feature_bad` / `tengu_feature_ok` | Terminal feature detection probes during teardown (bundle.js:+955996, +955938) |
| Telemetry — `tengu_daemon_control` | Daemon stop/teardown event (bundle.js:+15095752) |
| appState changes | `_.setAppState` called to strip in-flight assistant messages before re-exec (bundle.js:+12077875) |
| SDK message injection | A synthetic `"assistant"` role text message `"Switching to latest Claude Code… reconnecting"` is written via `O.writeSdkMessages` (bundle.js:+12077961, +12077985) |
| Conversation log | `_.appendEntry` writes a `"last-prompt"` record so the resumed session can replay context (bundle.js:+12576383) |
| Bridge flush | `O.flush()` with 2 000 ms timeout; `O.teardown()` called after (bundle.js:+12078052, +12078106) |
| Analytics flush | 500 ms race timeout inside `vq8`; label `"analytics flush timeout"` (bundle.js:+11809402, +11809413) |
| Signal handlers | All `SIGINT` / `SIGHUP` listeners removed; `beforeExit` / `exit` handlers re-registered for handoff (bundle.js:+11809751, +11809781) |
| Spawn | `PV1.spawnSync` with `stdio: "inherit"` and `--resume` flag; exits 128 on spawn failure (bundle.js:+11809808, +11810057, +11810170) |
| Terminal UI | Spinner cleared (`clearInterval`), Ink component tree unmounted, terminal cursor positions saved/restored via ANSI escapes (bundle.js:+11809250, +5269422) |
| UUID generation | `aW8.randomUUID()` used to mint the injected assistant message ID (bundle.js:+12075860) |
| Hook registration | `c_A.register` called during daemon interaction (`y4` / `c9` path); `c_A.drain` called during cleanup (bundle.js:+57267, +57310) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.146 | Initial analysis |

---

## Common Mistakes

1. **Running `/update` during active background tasks** — The command hard-blocks if any background task is in `"running"` or `"pending"` state. Wait for all background tasks to complete before invoking `/update`.
2. **Session resumed from a mismatched project directory** — If the shell's working directory differs from the directory the session was originally started in, `/update` refuses with an explicit message asking for a manual `--resume`. Change directory back or start a fresh session.
3. **Expecting the command to appear in `/help`** — `isHidden: true` means `/update` is not listed in the command palette or help output; it must be typed explicitly.
4. **Assuming the command works in non-interactive mode** — `supportsNonInteractive: false` means it is unavailable in `--print` / pipe mode.
5. **Interrupting the flush window** — The bridge has a 2 000 ms flush timeout and the relaunch sequence has a 30 000 ms outer timeout. Sending SIGINT immediately after `/update` may corrupt the conversation state written for `--resume`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `YB7` | Main async handler for `/update` (Arbor-resolved, `AsyncFunction`) |
| `tW8` | Pre-flight / binary-location entry point called by `YB7` |
| `C3` | `which`-wrapper: resolves the `claude` executable on PATH |
| `jJA` | Inner `Bun.which` caller within `C3` |
| `jx` | Versioned install-path builder (top level) |
| `Xz8` | Path-segment assembler for the `versions/` directory subtree |
| `FM` | Array normalisation helper (uses `Array.isArray`) |
| `IDH` | Home-dir + `".local/share/…"` path join helper |
| `ff8` | `os.homedir()` wrapper |
| `L6H` | `bin/` sub-path join helper (sibling to `IDH`) |
| `Cq` | Background / daemon context accessor used in early checks |
| `_3H` | Daemon mode classifier (`"bg"`, `"daemon"`, `"daemon-worker"`) |
| `c` | General-purpose async utility / continuation helper |
| `qG` | Basename-and-truncate helper (uses `$X.basename`, truncates to 8 chars) |
| `S6` | Promise-based delay / sleep utility |
| `uV` | Core async scheduler / micro-task runner |
| `HR` | Session / project-root path accessor |
| `Md_` | Session directory consistency checker (uses `GV1.dirname`, `p3`, `$4`) |
| `D_` | Path comparison helper within `Md_` |
| `$4` | Path normalisation helper within `Md_` |
| `d8H` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `Io` | Background-task status inspector (checks `hi7.has`) |
| `VG8` | Background-task state store accessor |
| `Gc_` | Conversation-log append controller (calls `_.appendEntry`) |
| `y4` | Hook registration orchestrator |
| `c9` | Low-level hook register caller (`c_A.register`) |
| `SH` | Subprocess / child-process spawn wrapper with error logging |
| `n_` | Error-to-string converter |
| `mH` | String coercion / formatting utility |
| `X1` | Output-queue manager |
| `lYA` | Output-line formatter |
| `PuK` | Ring-buffer queue manager (`Db6.shift` / `Db6.push`) |
| `NG` | Conversation-message filter (strips `"assistant-"` prefixed IDs) |
| `O` | Output bridge object (`writeSdkMessages`, `flush`, `teardown`) |
| `v8` | Bridge factory / initialiser |
| `uy1` | Synthetic assistant-message builder (uses `aW8.randomUUID`) |
| `OM` | Promise race with timeout helper (`setTimeout` + `clearTimeout`) |
| `XJH` | Full re-exec / relaunch sequence handler |
| `FY6` | Spinner/interval clear helper |
| `lJ_` | `clearInterval` wrapper |
| `AVH` | Terminal UI unmount orchestrator |
| `H` | Ink render root / terminal renderer |
| `xh` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `tt6` | Terminal output writer (ANSI save/restore + raw write) |
| `PTH` | Terminal-type detector (Ghostty, iTerm, tmux-CC) |
| `DTH` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `e0` | tmux/screen escape sequence rewriter |
| `Vq8` | Scroll-summary builder |
| `pV` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `hLq` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `yLq` | Scroll-metric calculator (`Date.now`, `Math.max`, `Math.round`) |
| `ILq` | Scroll-metric sub-calculator |
| `O9` | Full-screen / rendering context manager |
| `KbH` | Full-screen capability cache checker |
| `zL_` | Full-screen string formatter |
| `Vn` | Full-screen mode activator |
| `N` | ANSI colour / style string builder |
| `OL_` | Platform (Windows) detection helper |
| `e_` | Full-screen guard / env-var checker |
| `kQ4` | Full-screen disable-reason builder |
| `N6` | Terminal render dispatcher |
| `MV` | Hook-registration bridge helper (calls `y4`) |
| `tSH` | Analytics drain wrapper (`c_A.drain`) |
| `vq8` | Analytics flush with race timeout |
| `r8` | Process-abort / timeout-abort helper |
| `K` | Active-request tracker (padEnd formatter) |
| `q` | Temp-file cleanup helper (`p7K.unlinkSync`) |
| `L` | Request lifecycle wrapper (`q.add`, `f.finally`, `q.delete`) |
| `jV1` | Native-library loader + MCP exec handler (uses FFI, `process.chdir`, `M.execve`) |
| `f` | Native FFI handle object |
| `A` | Process/connection registry map |
| `$` | Worker/session registry |
| `zS1` | Worker lifecycle tracker (`Date.now`, `M1`, `GE6`) |
| `w` | Background worker pool manager |
| `C` | Worker supervisor object |
| `uH` | Worker "ok" / healthy state handler |
| `bH` | Worker "bad" / error state handler |
| `rE6` | Worker memory reporter |
| `x` | Worker idle-timeout manager |
| `AHA` | Background-session claim + connect handler |
| `$HA` | Worker full lifecycle manager (spawn → done/killed/crashed/idle states) |
| `D` | Worker garbage-collection / dispose cycle |
| `L8` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `S` | Worker state machine object |
| `M` | MCP update applicator (delegates to `_kH`, `z4K`) |
| `_kH` | MCP server connector / reconnector |
| `z4K` | MCP update applier (`H.applyMcpUpdate`) |
| `_O5` | MCP client-set updater (filters, reconnects, maps) |
| `z` | Daemon stop/teardown controller |
| `Mk` | First-party provider registry updater |
| `ix` | Daemon shutdown sequencer (`process.exit`) |
| `ZH` | String coercion wrapper |
| `sX` | Error-file writer (`vRH.writeFileSync`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.