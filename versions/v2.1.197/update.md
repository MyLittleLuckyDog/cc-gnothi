---
type: feature-spec
feature: "update"
cc_version: "2.1.197"
updated: "2026-07-01"
tags: ["update", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.197 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/update`

> Analysis basis: CC v2.1.197 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.197

---

## Overview

The `/update` command performs an in-place hot-update of Claude Code to the latest installed version without terminating the current conversation. It serializes the live session state, flushes all pending I/O and analytics, then re-executes the Claude Code binary via `execve`-style process replacement, restoring the conversation through `--resume`. The command is hidden from the standard help menu and is not available in non-interactive mode.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `update` |
| description | `Switch to the latest version (conversation continues)` |
| supportsNonInteractive | `false` |
| isHidden | `true` |
| module_id | `hnc` |
| load_inline | `true` |
| loc_byte | `13077744` |
| loc_byte_end | `13077985` |
| loc_line | `9034` |
| arbor_handler.name | `wXf` |
| arbor_handler.fqn | `claude-2.1.197::wXf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.197 bundle.js:+13077744

---

## Input Branching

The handler (`wXf`) has five distinct decision branches before it commits to executing the update. A Mermaid flowchart is used below.

```mermaid
flowchart TD
    A["/update invoked"] --> B{Resolve binary path\nvia which('claude')}
    B -- "not found" --> C[Emit tengu_update_refused\nReturn error message]
    B -- "found" --> D{Check background\nwork queue state}
    D -- "running or pending\nwork exists" --> E["Return: 'Cannot /update while work\nis running in the background…'"]
    D -- "queue idle" --> F{Check project directory\nmatches current session?}
    F -- "mismatch\n(resumed from different dir)" --> G["Return: 'Cannot /update — this session\nwas resumed from a different project…'"]
    F -- "match" --> H[Flush SDK messages\nWrite 'Switching to latest…' notice]
    H --> I[Serialize session state\nWrite daemon.status.json]
    I --> J[Flush I/O bridge\n(2000 ms timeout)]
    J --> K[Teardown current session\nDrain analytics]
    K --> L[Build relaunch argv\n(--resume + carried flags)]
    L --> M[Remove signal handlers\nspawnSync / execve replacement]
    M --> N[process.exit or kill\nif execve unavailable]
```

Analysis basis: CC v2.1.197 bundle.js:+13075540 through +13077068

---

## Behavioral Spec

### 1. Binary Resolution

```
function resolveBinary():
    path = which("claude")          // calls Wf → xHs → Bun.which
    if path is null or empty:
        emit telemetry("tengu_update_refused")
        return error("binary not found")
    return path
```

Analysis basis: CC v2.1.197 bundle.js:+13075540 (call to `Wf`), +13075640 (`tengu_update_refused`)

### 2. Version Install-Path Construction

```
function buildVersionsDir():
    home = os.homedir()                  // KNa.homedir via V9n
    base = join(home, ".local", "share") // literals: ".local", "share"
    versionsDir = join(base, "versions") // literal: "versions"
    binPath = join(versionsDir, "bin")   // literal: "bin"
    return { versionsDir, binPath }
```

Analysis basis: CC v2.1.197 bundle.js:+8819773, +7242148, +7242157, +8819817, +7242228

### 3. Background Work Guard

```
function checkBackgroundWork(appState):
    tasks = Object.values(appState.tasks)
    for each task in tasks:
        if task.status == "running" or task.status == "pending":
            return ErrorResult(
                "Cannot /update while work is running in the background" +
                " — wait for it to finish, then try again."
            )
    return OK
```

Literal error message confirmed at: CC v2.1.197 bundle.js:+13076004
Status literals `"running"` / `"pending"` at: +13075901 / +13075923

### 4. Project Directory Guard

```
function checkProjectDirectory(session, currentCwd):
    if session.workingDirectory != currentCwd:
        return ErrorResult(
            "Cannot /update — this session was resumed from a different" +
            " project directory. Restart manually with --resume to continue" +
            " on the latest version."
        )
    return OK
```

Literal error message confirmed at: CC v2.1.197 bundle.js:+13076248

### 5. Session Serialization and Status Write

```
async function serializeAndWriteStatus(session, outputDir):
    uuid = crypto.randomUUID()            // mnc → iZt.randomUUID
    statusPayload = {
        role:        "assistant",
        stop_reason: "stop_sequence",
        type:        "message",
        timestamp:   Date.now(),
        ...session
    }
    statusJson = JSON.stringify(statusPayload)
    statusPath = join(outputDir, "daemon.status.json")
    fs.writeFileSync(statusPath)
    writeSdkMessages(session)             // l.writeSdkMessages
    appendEntry("last-prompt", ...)       // lZt → n.appendEntry
```

Literals: `"assistant"` (+13074584), `"stop_sequence"` (+13074696), `"message"` (+13074734), `"daemon.status.json"` (+13167883), `"last-prompt"` (+13638809)
Analysis basis: CC v2.1.197 bundle.js:+13076709, +13076729, +13076468

### 6. Bridge Flush with Timeout

```
async function flushWithTimeout():
    notice = "Switching to latest Claude Code… reconnecting"
    displayNotice(notice)
    await Promise.race([
        flushBridge(),                    // l.flush
        timeout(2000, "bridge flush")     // wc: setTimeout + Promise.race
    ])
```

Notice literal at: CC v2.1.197 bundle.js:+13076733
Timeout value 2000 ms at: +13076813, label `"bridge flush"` at +13076818

### 7. Relaunch Argument Construction

```
function buildRelaunchArgv(session, originalArgv):
    args = Array.from(originalArgv)      // Par → Array.from
    args.push("--resume", session.id)    // literal "--resume" at +12815235
    if session.addedDirs:
        for dir in session.addedDirs:
            args.push("--add-dir", dir)  // literal "--add-dir" at +12816759
    if flags.effort:
        args.push("--effort", flags.effort)
    if flags.permissionMode:
        args.push("--permission-mode", flags.permissionMode)
    if flags.allowDangerouslySkipPermissions:
        args.push("--allow-dangerously-skip-permissions")
    return args
```

Literals: `"--add-dir"` (+12816759), `"--effort"` (+12817016), `"--permission-mode"` (+12817033), `"--allow-dangerously-skip-permissions"` (+12816874)
Analysis basis: CC v2.1.197 bundle.js:+13077058

### 8. Process Replacement (execve / spawnSync)

```
async function replaceProcess(binaryPath, argv):
    // Clear all signal listeners first
    process.removeAllListeners("SIGINT")
    process.removeAllListeners("SIGTERM")
    process.removeAllListeners("SIGHUP")

    // Drain analytics (30 000 ms timeout)
    await Promise.all([
        analyticsFlush(),                    // AQe → yis.drain
        timeout(30000, "flush timeout (relaunch)")
    ])

    // Unmount terminal UI
    unmountInk()                             // e8e → e.unmount
    clearProgressInterval()                  // XGt → K_o → clearInterval

    // Load bun:ffi for execve on macOS or Linux
    if platform == "macos":
        lib = dlopen("/usr/lib/libSystem.B.dylib", { execve: ... })
    else:
        lib = dlopen("libc.so.6", { execve: ... })

    env = buildEnvBlock(process.env)         // WJl → Object.entries

    // Attempt execve (replaces process image)
    result = lib.execve(binaryPath, argv, env)

    // Fallback: spawnSync if execve not available
    if result < 0:
        child = VJl.spawnSync(binaryPath, argv, { stdio: "inherit" })
        writeRelaunchErrorIfNeeded(child)    // dI → Pae.writeFileSync
        process.exit(child.status ?? 128)

    // Should not be reached; kill self just in case
    process.kill(process.pid, "SIGTERM")
```

Literals: `"SIGINT"` (+12815775), `"SIGTERM"` (+12815784), `"SIGHUP"` (+12815794), `"inherit"` (+12815896), `30000` (+12815302), `"bun:ffi"` (+12814339), `"macos"` (+12814375), `"/usr/lib/libSystem.B.dylib"` (+12814383), `"libc.so.6"` (+12814412), `128` (+12816223), `"relaunch_spawn_error"` (+12816086)
Analysis basis: CC v2.1.197 bundle.js:+12815804, +12815861, +12816110, +12816175

### 9. Session Flag Carry-Over

The handler reads `getAppState` (`t.getAppState` at +13076508) to extract the following flags for carry-over into the relaunch argv:

- `working_directory` (+11149612)
- `allowed_tools` (+11149667)
- `disallowed_tools` (+11149722)
- `avoid_prompts` (+11149783)
- `permission_mode` (+11149885)
- `bypassPermissions` (+11149916)
- `effort` (+11150240)
- `model` (+11150253)
- `max_thinking_tokens` (+11150265)
- `flag_settings` (+11150291)

Analysis basis: CC v2.1.197 bundle.js:+13077062 (`Ur`), +13077068 (`yg`)

### 10. Feature-Flag / Fullscreen Check

```
function checkFullscreenCapability():
    if WLi.isEnabled("local-agent"):
        disableFullscreen(reason: "fullscreen disabled: ...")
    if detectTmuxCCMode():               // Gxe
        disableFullscreen("fullscreen disabled: tmux -CC …")
    if detectWindowsConPTY():
        disableFullscreen("fullscreen disabled: Windows over SSH …")
    return fullscreenMode
```

Literals: `"local-agent"` (+3587260), fullscreen-disabled messages (+3587481, +3587667), `"fullscreen"` (+3587815)
Analysis basis: CC v2.1.197 bundle.js:+13076960, +13076983

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_update_refused` (+13075640) — emitted when binary cannot be located; `tengu_scroll_summary` (+7438318) — emitted during terminal scroll/render teardown; `tengu_amber_creek` (+3587999) — fullscreen feature gate check; `tengu_pewter_brook` (+3587906) — alternate fullscreen/rendering path; `tengu_feature_ok` (+1028779) / `tengu_feature_bad` (+1028846) — feature-flag evaluation outcomes; `tengu_daemon_control` (+18076516) — daemon stop/start events; `tengu_config_parse_error` (+14164913) — config read error during relaunch setup; `tengu_disable_bypass_permissions_mode` (+3441348) — bypass-permissions policy enforcement |
| appState reads | `t.getAppState()` at +13076508 (task queue, flags); `e.getAppState()` at +11149507 and +11150343 (session metadata, effort, model) |
| appState writes | `t.setAppState()` at +13076623 — updates state to reflect update in progress |
| SDK message write | `l.writeSdkMessages()` at +13076709 — persists conversation messages before teardown |
| Session log | `lZt` appends `"last-prompt"` entry to conversation log at +13638809 |
| Daemon status file | `daemon.status.json` written via `Pae.writeFileSync` containing serialized session payload |
| I/O flush | `l.flush()` at +13076803 with 2000 ms race timeout (`wc`); bridge flush label `"bridge flush"` |
| Session teardown | `l.teardown()` at +13076854 — closes SDK session; `yis.drain()` via `AQe` for analytics; `e.unmount()` for Ink UI |
| Signal handlers | All `SIGINT`, `SIGTERM`, `SIGHUP`, `beforeExit`, `exit` listeners removed before `execve` |
| Hook registration | `vi` → `yis.register` at +68542 registers session hooks during relaunch setup |
| Process replacement | `VJl.spawnSync` or `bun:ffi` `execve` — replaces current process image with new Claude Code binary |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.197 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/update` while background tasks are active** — The command will refuse with a clear message if any task is in `"running"` or `"pending"` state. Wait for all background work to complete before running `/update`.
2. **Using `/update` in a session resumed from a different project directory** — The directory-guard check (`Ur`) will block the update and instruct the user to restart manually with `--resume`. This prevents broken working-directory state after process replacement.
3. **Expecting `/update` to appear in `/help` output** — The command is registered with `isHidden: true` and will not surface in the standard help listing.
4. **Using `/update` in non-interactive mode** — `supportsNonInteractive: false` means the command is silently unavailable in scripted or piped sessions.
5. **Assuming an immediate reconnect** — The relaunch sequence involves flushing the I/O bridge (up to 2000 ms), draining analytics (up to 30 000 ms), unmounting the terminal UI, and performing an `execve`. Brief terminal disruption is expected.
6. **Missing `claude` binary on `$PATH`** — If `Bun.which("claude")` returns nothing (e.g., installed via a path not in `$PATH`), the update is refused immediately and `tengu_update_refused` is emitted; no state change occurs.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `wXf` | Main async handler for `/update` (arbor_handler, AsyncFunction) |
| `glr` | Binary-path resolution entry point (calls `Wf` and `K2`) |
| `Wf` | `which`-lookup wrapper (delegates to `xHs`) |
| `xHs` | Low-level `Bun.which` invocation |
| `K2` | Version install-path builder (calls `_Kn`, `Xde`, `ng`) |
| `_Kn` | Constructs versioned directory path (joins home, `.local/share/versions`) |
| `ng` | Array check utility (wraps `Array.isArray`) |
| `Toe` | Home-relative path helper (uses `V9n` + `uGt.join`) |
| `V9n` | Home-directory resolver (`KNa.homedir`) |
| `Xde` | Bin-path segment builder (`uGt.join`) |
| `Hi` | Background mode check (`BLe`; checks `"bg"`, `"daemon"`, `"daemon-worker"`) |
| `BLe` | Background role classifier |
| `V` | Shared value / config accessor |
| `cS` | Executable basename normalizer (`Iy.basename`, `t_e`, `Rt`) |
| `t_e` | Basename processing helper |
| `Rt` | Low-level render/output helper (`H0`) |
| `H0` | Terminal output primitive |
| `XR` | Path existence / stat utility |
| `H5o` | Terminal UI manager for update display (`XR`, `dr`, `zJl.dirname`, `Zh`, `bl`) |
| `dr` | Display render helper (`H0`) |
| `bl` | Secondary display helper (`H0`) |
| `Gme` | Update guard / gating check |
| `bie` | Hook attachment checker (`iur`, `Iim.has`; checks `"ant"` type) |
| `iur` | Hook type inspector |
| `lZt` | Conversation log appender (`Kc`, `n.appendEntry`, `Rt`; key: `"last-prompt"`) |
| `Kc` | Log entry factory (`vi`) |
| `vi` | Hook/event registrar (`yis.register`) |
| `ke` | Error-logging / ring-buffer utility (`er`, `ct`, `zi`, `LNu`, `Ete.logError`) |
| `er` | Error message formatter (`Error`, `String`) |
| `ct` | String coercion helper |
| `zi` | Error classification wrapper (`qbs`) |
| `qbs` | Error category lookup (`ct`) |
| `LNu` | Ring-buffer manager for error history (`Yfn.shift`, `Yfn.push`) |
| `uf` | Context/store accessor (`P0`) |
| `P0` | AsyncLocalStorage store reader (`Z9r.getStore`) |
| `vE` | App state mutation helper |
| `doc` | SDK message serializer (`ene`, `Date.now`, `Ks`, `_Zt`, `Me`) |
| `ene` | Message envelope builder (`ZHe`) |
| `ZHe` | Message trim/normalize helper (`dle`, `t.trim`) |
| `Ks` | Session store reader (`jfd.getStore`) |
| `_Zt` | Status-file path builder (`uoc.join`, `Zn`) |
| `Me` | JSON serializer wrapper (`JSON.stringify`) |
| `mnc` | UUID generator (`iZt.randomUUID`) |
| `wc` | Timed-race utility (`setTimeout`, `Promise.race`, `clearTimeout`) |
| `Gxe` | Feature-flag / fullscreen enablement checker (`WLi.isEnabled`) |
| `xke` | String coercion for flag values (`String`) |
| `HUe` | Full relaunch orchestrator (stat, unmount, flush, spawnSync/execve, exit) |
| `XGt` | Progress-interval stopper (`K_o`) |
| `K_o` | `clearInterval` wrapper |
| `e8e` | Ink UI unmounter (`rAe.writeSync`, `lu.get`, `e.unmount`, `JN`, `dDn`) |
| `JN` | Terminal state restorer |
| `dDn` | Terminal write/reset helper (`lre.writeSync`, `J5e`, `j5e`, `mx`, `Ed`, `T`) |
| `J5e` | Terminal capability detector (`mH`, `W6i.coerce`, `ER`; checks Ghostty ≥1.2.0, iTerm2 ≥3.6.6) |
| `j5e` | Supplementary terminal reset step |
| `mx` | tmux escape-sequence handler (`QJr`, `e.replaceAll`) |
| `Ed` | Terminal editor reset |
| `T` | Styled-text / chalk-like formatter (`a2e`, `deu`, `Me`, `Pc`, `z1`, `KQe`, `geu`) |
| `l5n` | Scroll-summary / terminal-render finalizer (`UL`, `c2a`, `V`, `l2a`, `$s`) |
| `UL` | Utility: terminal lines counter |
| `c2a` | Utility: cursor position helper |
| `l2a` | Scroll animation step (`Date.now`, `Math.max`, `Math.round`, `Object.assign`, `i2a`) |
| `i2a` | Scroll animation frame helper |
| `$s` | Full terminal render/output pipeline (`DP`, `aD`, `oXr`, `qne`, `T`, `rXr`, `Rr`, `S4d`, `it`) |
| `DP` | Output deduplication check (`OPu.has`) |
| `aD` | Feature-flag gate for local-agent mode (`WLi.isEnabled`) |
| `oXr` | Output string coercion (`ct`) |
| `qne` | Output queue entry builder (`E4d`) |
| `rXr` | Platform/OS detector (`jt`, `Boolean`; checks `"windows"`) |
| `Rr` | Output channel selector (`O8`) |
| `S4d` | Supplementary output handler (`it`) |
| `it` | Terminal render commit (`C$t`, `v$t`, `P6`, `t0e.has`, `akn`, `T$t.add`, `wV.has`, `wV.get`, `Dt`) |
| `bv` | Secondary log/buffer finalizer (`Kc`) |
| `AQe` | Analytics drain (`yis.drain`) |
| `n8e` | Cleanup-timeout promise (`Promise.resolve`, `o5n`) |
| `o5n` | Timeout resolve helper |
| `WJl` | Process-replacement executor (`jt`, `GJl.isAbsolute`, `process.cwd`, `process.chdir`, `require`, `i.dlopen`, `Buffer.from`, `BigInt`, `a.execve`, `T`, `he`) |
| `f` | Path-normalization iterator (`L8`) |
| `L8` | Path normalizer (`sN.normalize`, `jt`, `t.replaceAll`) |
| `c` | Environment-block assembler (`yn`) |
| `yn` | Environment string builder |
| `a` | Native execve FFI binding (`Pge`, `Response.json`) |
| `Pge` | FFI result serializer (`JSON.stringify`) |
| `u` | Background-session / daemon-stop orchestrator (`xe`, `Re`, `$F`, `Wj`) |
| `xe` | Daemon-stop request path A (`V`, `Oe`) |
| `Re` | Daemon-stop request path B (`V`, `Oe`) |
| `$F` | Daemon stop dispatcher (`D6`, `eJ.push`, `u5e`, `z7r`) |
| `Wj` | Daemon stop awaiter (`Promise.race`, `Promise.all`, `sye`, `mye`, `On`, `process.exit`) |
| `he` | Warning string formatter (`String`) |
| `dI` | Relaunch-error file writer (`Pae.writeFileSync`, `Ybr.join`) |
| `Par` | Relaunch argv builder (`Array.from`, `wFe`, `r.push`, `f0e`, `r.includes`, `n.flatMap`) |
| `wFe` | Argv source extractor |
| `f0e` | Argv entry validator (`Dt`, `Boolean`) |
| `Dt` | File-based config loader (`qt`, `w0`, `dqo`, `lIt`, `Date.now`, `Fdm`) |
| `qt` | Config path resolver |
| `dqo` | Config merge helper |
| `lIt` | Config file reader (`Error`, `qt`, `r.readFileSync`, `Gt`, `q5`, `String`, `rn`, `mqo`, `T`, `ey.basename`, `hqo`, `r.mkdirSync`, `r.readdirStringSync`, `r.copyFileSync`, `Date.now`) |
| `Fdm` | Config watcher/updater (`w0`, `bRt`, `qt`, `$a`, `q5`, `dqo`, `rge`, `vi`, `vmc.unwatchFile`) |
| `Ur` | Session-flag extractor for relaunch (`e.getAppState`, `n.findLast`, `gtr`, `htr`, `AR`) |
| `gtr` | Working-directory flag reader (`Bo`) |
| `htr` | Tool-allow/disallow flag reader (`Bo`) |
| `AR` | Bypass-permissions policy enforcer (`WYr`) |
| `WYr` | Bypass-permissions settings checker (`it`, `es`) |
| `yg` | Effort/model/flag extractor (`e.getAppState`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.