---
type: feature-spec
feature: "update"
cc_version: "2.1.157"
updated: "2026-06-02"
tags: ["update", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.157 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/update`

> Analysis basis: CC v2.1.157 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.157

---

## Overview

The `/update` command performs an in-place upgrade of Claude Code to the latest installed version while keeping the current conversation alive. It resolves the new binary, tears down the current process, flushes all pending I/O and analytics, and then re-execs itself (via `spawnSync` + `process.exit`) with a `--resume` flag so the session continues seamlessly on the new version.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `update` |
| description | `Switch to the latest version (conversation continues)` |
| loc_byte | `12385197` |
| loc_byte_end | `12385438` |
| loc_line | `8264` |
| supportsNonInteractive | `false` |
| isHidden | `true` |
| module_id | `To1` |
| load_inline | `true` |
| arbor_handler.name | `w$5` |
| arbor_handler.fqn | `claude-2.1.157::w$5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.157 bundle.js:+12385197

The registration block spans bytes `(12385197, 12385438)`. The handler is resolved via `module_id` → `To1` → export lookup → `w$5` (an `AsyncFunction`). Because `load_inline: true` is set, the module is loaded as an inline `Promise.resolve({call: w$5})` shape; there is no separate `module_id` file reference at runtime.

---

## Input Branching

The command has **5+ distinct decision branches** before it commits to the re-exec path. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/update invoked"]) --> B{Resolve new binary\nvia which('claude')}
    B -- not found --> C[Emit tengu_update_refused\nReturn error message]
    B -- found --> D{Check running/pending\nbackground tasks}
    D -- tasks active --> E["Return error:\n'Cannot /update while background tasks are running…'"]
    D -- no active tasks --> F{Session resumed\nfrom different project dir?}
    F -- yes --> G["Return error:\n'Cannot /update — this session was resumed…'"]
    F -- no --> H[Display 'Switching to latest Claude Code… reconnecting']
    H --> I[Write SDK messages\nGenerate new session UUID]
    I --> J[Flush bridge\n(2000 ms timeout)]
    J --> K[Tear down current session:\nunmount UI, drain analytics,\nflush telemetry (500 ms timeout)]
    K --> L[Build relaunch argv\n(preserve --resume, --add-dir,\n--allow-dangerously-skip-permissions,\n--effort, --permission-mode)]
    L --> M[Remove SIGINT/SIGHUP listeners\nRegister beforeExit / exit handlers]
    M --> N[spawnSync new binary\nwith inherited stdio]
    N --> O[process.exit with child's\nexit code or 128+signal]
```

Analysis basis: CC v2.1.157 bundle.js:+12383089 (handler entry `w$5`), +12383251 (binary resolution), +12383326 (task check), +12383467 (background-task error literal), +12383708 (different-directory error literal)

---

## Behavioral Spec

### 1. Binary Resolution

```
function resolveBinary():
    path = which("claude")          # uses Bun.which internally
    if path is null:
        emit telemetry("tengu_update_refused")
        return Err("no claude binary found")
    return Ok(path)
```

Analysis basis: CC v2.1.157 bundle.js:+12383003 (`uI8` → `O3` → `xkA` → `Bun.which`), +12383103 (`tengu_update_refused`)

### 2. Pre-flight Guards

```
function checkPreflightConditions(appState, argv):
    tasks = Object.values(appState.backgroundTasks)
    activeTasks = tasks.filter(t => t.status == "running" or t.status == "pending")
    if activeTasks.length > 0:
        return Err("Cannot /update while background tasks are running — wait for them to finish, then try again.")

    resumedDir = getResumedProjectDirectory(appState)   # inspects argv / app state
    currentDir  = getInstallationPath()
    if resumedDir exists and resumedDir != currentDir:
        return Err("Cannot /update — this session was resumed from a different project directory. Restart manually with --resume to continue on the latest version.")

    return Ok()
```

Literal strings are cited verbatim because they are user-facing error messages (≤30-char fragments used in prose only):

- Background-task guard: `"Cannot /update while background…"` (bundle.js:+12383467)
- Different-directory guard: `"Cannot /update — this session was…"` (bundle.js:+12383708)

Analysis basis: CC v2.1.157 bundle.js:+12383326 (task status filter), +12383364 (`"running"`), +12383386 (`"pending"`), +12383574 (path helpers `MI`, `Go1.join`), +12383590 (`CO` — directory comparison)

### 3. Progress Notification

```
function notifyUser(outputStream):
    outputStream.writeText("Switching to latest Claude Code… reconnecting")
    generateNewSessionUUID()    # used for the resumed session
```

Analysis basis: CC v2.1.157 bundle.js:+12384219 (literal `"Switching to latest Claude Code… reconnecting"`), +12384215 (`Wo1` — UUID generation via `crypto.randomUUID`)

### 4. Bridge Flush

```
async function flushBridge(bridge, timeout=2000):
    await Promise.race([
        bridge.flush(),
        sleep(timeout)          # "bridge flush" label
    ])
```

Timeout constant: **2000 ms** (bundle.js:+12384299)

Analysis basis: CC v2.1.157 bundle.js:+12384289 (`O.flush`), +12384286 (`sL` — race/sleep helper), +12384304 (literal `"bridge flush"`)

### 5. Session Teardown

```
async function teardownSession(session):
    unmountUI()                       # detaches Ink/terminal renderer
    stopSpinner()                     # clears any active progress spinner
    writeToStdout(escRestoreCursor)   # restores terminal cursor position

    await Promise.race([
        drainAnalytics(),             # _OA.drain
        sleep(30000)                  # "flush timeout (relaunch)"
    ])

    await Promise.race([
        flushAllAnalytics(),          # hf8 — Promise.all over analytics flusher set
        sleep(500)                    # "analytics flush timeout"
    ])
    session.teardown()
```

Constants:
- Relaunch flush timeout: **30 000 ms** (bundle.js:+12105184)
- Cleanup timeout: <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->
- Analytics flush timeout: **500 ms** (bundle.js:+12105302, +5357207)

Analysis basis: CC v2.1.157 bundle.js:+12384340 (`O.teardown`), +12105145 (`zkH` — terminal unmount), +12105163 (`Promise.all`), +12105176 (`sL`), +12105235 (`oxH` → `_OA.drain`), +12105291 (`hf8`)

### 6. Argv Construction for Relaunch

```
function buildRelunchArgv(originalArgv, sessionId, addedDirs, flags):
    argv = [newBinaryPath]
    argv.append("--resume", sessionId)

    for dir in addedDirs:
        argv.append("--add-dir", dir)

    if flags.allowDangerouslySkipPermissions:
        argv.append("--allow-dangerously-skip-permissions")

    if flags.effort is not null:
        argv.append("--effort", flags.effort)

    if flags.permissionMode is not null:
        argv.append("--permission-mode", flags.permissionMode)

    return argv
```

Analysis basis: CC v2.1.157 bundle.js:+12105117 (`"--resume"`), +12106641 (`"--add-dir"`), +12106810 (`"--allow-dangerously-skip-permissions"`), +12106952 (`"--effort"`), +12106969 (`"--permission-mode"`), +12106613 (`p96` — argv builder), +12106663 (`q.push`)

The session state transferred to the relaunch includes `working_directory`, `allowed_tools`, `disallowed_tools`, `avoid_prompts`, `effort`, `model`, and `flag_settings` (bundle.js:+10679478, +10679533, +10679588, +10679649, +10679973, +10679986, +10679998).

### 7. Re-exec

```
function reexec(argv):
    process.removeAllListeners("SIGINT")
    process.removeAllListeners("SIGHUP")

    process.on("beforeExit", writeRelaunchSpawnError)
    process.on("exit", writeRelaunchSpawnError)

    result = spawnSync(argv[0], argv[1:], { stdio: "inherit" })

    if result.signal is not null:
        process.exit(128 + signalNumber(result.signal))
    else:
        process.exit(result.exitCode ?? 0)
```

Exit-code formula: `128 + signal number` (bundle.js:+12106105)

Analysis basis: CC v2.1.157 bundle.js:+12105686 (`process.removeAllListeners`), +12105716 (`process.on`), +12105743 (`gd1.spawnSync`), +12105778 (`"inherit"` stdio), +12105832 (`"beforeExit"`), +12105873 (`"exit"`), +12105965 (`ej` — spawn-error writer), +12105992 (`process.exit`)

### 8. State Snapshot Helpers (supporting functions)

```
function getLastPromptState(appState):
    # Scans message history for last assistant-turn entry
    # tagged "assistant-" prefix; reads working_directory,
    # allowed_tools, disallowed_tools from that turn.
    entry = appState.messages.findLast(m => m.role.startsWith("assistant-"))
    return extractSessionConfig(entry)

function getInstallationPath():
    # Resolves ~/.local/share/versions/bin layout
    home = os.homedir()
    return path.join(home, ".local", "share", "versions")
```

Path constants: `".local"` (bundle.js:+7866454), `"share"` (bundle.js:+7866463), `"versions"` (bundle.js:+9114299), `"bin"` (bundle.js:+7866534)

Analysis basis: CC v2.1.157 bundle.js:+12383056 (`dh` → `nW8` → path assembly), +12384525 (`V_` — last-prompt state reader), +10679453 (`A.findLast`)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_update_refused` | Fired when no `claude` binary is found via `which` (bundle.js:+12383103) |
| Telemetry — `tengu_scroll_summary` | Fired during session scroll/summary capture before teardown (bundle.js:+5356918) |
| Telemetry — `tengu_amber_creek` | Fired during fullscreen/terminal-mode detection path (bundle.js:+3377471) |
| Telemetry — `tengu_pewter_brook` | Fired during fullscreen/terminal-mode detection path (bundle.js:+3377379) |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | May fire if a background task requires SIGKILL escalation during teardown (bundle.js:+15466951) |
| Telemetry — `tengu_feature_bad` / `tengu_feature_ok` | Feature-flag health probes executed during relaunch path (bundle.js:+966091, +966033) |
| Telemetry — `tengu_bg_low_mem_mb` / `tengu_bg_dispatch_low_mem` | Low-memory checks during background-session teardown (bundle.js:+12729087, +15467530) |
| Telemetry — `tengu_bg_spare_*` | Spare-worker pool lifecycle events (enable/claim/spawn/claim_fail) during relaunch (bundle.js:+15468225, +15468346, +15466644, +15468609) |
| Telemetry — `tengu_bg_sendclaim_failed` | Fired if a background session claim fails during teardown (bundle.js:+15447680) |
| Telemetry — `tengu_daemon_control` | Fired on daemon stop/stop-failed events during teardown (bundle.js:+15502788) |
| Telemetry — `tengu_config_parse_error` | Fired if config cannot be parsed while building relaunch state (bundle.js:+3210553) |
| appState changes | `_.setAppState` is called to persist the outgoing session snapshot before re-exec (bundle.js:+12384109) |
| SDK message write | `O.writeSdkMessages` is called with the transition notification (bundle.js:+12384195) |
| Hook registration | `_OA.register` / `_OA.drain` are invoked as part of the analytics pipeline during teardown (bundle.js:+58858, +58901) |
| Terminal UI | Ink renderer is unmounted (`H.unmount`); cursor position is restored via ANSI escape sequences `ESC 7` / `ESC 8` (bundle.js:+5355450, +3716184, +3716195) |
| Process signals | `SIGINT` and `SIGHUP` listeners are stripped before `spawnSync`; `beforeExit`/`exit` handlers are registered (bundle.js:+12105686, +12105716) |
| File system | Relaunch-error marker may be written via `TuH.writeFileSync` if `spawnSync` fails (bundle.js:+190998) |
| Sound | No sound events found in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.157 | Initial analysis |

---

## Common Mistakes

1. **Running `/update` with active background tasks.** The command will refuse with a clear error message (`"Cannot /update while background tasks are running…"`). Wait for all background tasks to complete or cancel them before retrying.
2. **Running `/update` in a session resumed from a different project directory.** The command detects a project-directory mismatch and refuses. The user must restart manually with `--resume` from the correct directory.
3. **Expecting `/update` to work in non-interactive mode.** `supportsNonInteractive: false` means the command is disabled in piped / headless invocations; it will not be available in CI/scripted contexts.
4. **Assuming the command is visible in the slash-command menu.** `isHidden: true` means `/update` does not appear in autocomplete listings; it must be typed explicitly.
5. **Interrupting the process during teardown.** The bridge flush (2 000 ms) and analytics drain (30 000 ms / 500 ms) run asynchronously. Sending SIGKILL before these complete may leave analytics events unflushed or the session in an inconsistent state.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `w$5` | Main async handler for `/update` (arbor_handler; AsyncFunction resolved via module_id `To1`) |
| `uI8` | Binary-resolution helper (calls `which("claude")`) |
| `O3` | Intermediate which-wrapper called by `uI8` |
| `xkA` | `Bun.which` caller |
| `dh` | Version-path resolver (assembles `~/.local/share/versions/…` paths) |
| `nW8` | Path-join helper for versioned binary directories |
| `l$` | Array-normalisation helper (uses `Array.isArray`) |
| `gLH` | Home-directory path builder (via `os.homedir`) |
| `pj8` | `os.homedir()` wrapper |
| `Q_H` | Binary sub-path resolver (`…/bin/…`) |
| `v9` | Process-role checker (distinguishes `bg`/`daemon`/`daemon-worker` modes) |
| `QOH` | Process-mode constant resolver |
| `d` | Generic logger / debug utility |
| `Oj` | Executable-basename resolver (`path.basename` + version-number extraction) |
| `k6` | Logging / diagnostic emitter |
| `AN` | Low-level log sink |
| `MI` | Path utility module reference |
| `S6A` | Installation-directory resolver (`path.dirname`-based) |
| `O_` | Sub-path helper used by `S6A` |
| `UK` | Secondary sub-path helper used by `S6A` |
| `EqH` | Pre-relaunch state serialiser |
| `as` | Hook/attachment state checker (uses `dJ5.has`) |
| `Lh8` | Hook attachment lookup helper |
| `t8A` | Last-prompt appender (writes `"last-prompt"` entry to session log) |
| `U4` | Session-log entry registrar |
| `K9` | `_OA.register` wrapper |
| `_` | App-state / session accessor namespace |
| `SH` | Structured error formatter / error-event pipeline |
| `F_` | Error stringification helper |
| `CH` | String-coercion utility |
| `L1` | Error-message constructor |
| `fVA` | Sub-message formatter used by `L1` |
| `X_4` | Circular-buffer shift/push helper for error logs |
| `xT` | App-state transformer called between flush and teardown |
| `O` | Bridge/output-stream object (has `writeSdkMessages`, `flush`, `teardown`) |
| `k8` | Bridge transport backend |
| `Wo1` | New-session UUID generator (`crypto.randomUUID`) |
| `sL` | Async sleep / `Promise.race` timeout helper |
| `tYH` | Argument-value stringifier (`String()` coercion) |
| `J2H` | Full relaunch orchestrator (teardown → spawnSync → process.exit) |
| `MP6` | Spinner / progress-indicator stopper |
| `wv_` | `clearInterval` wrapper for spinner |
| `zkH` | Terminal-teardown helper (unmounts Ink, restores cursor, drains stdout) |
| `H` | Ink/renderer instance (has `unmount`; also used as generic map in other contexts) |
| `hR` | Post-unmount stdout flush helper |
| `mq8` | ANSI escape / terminal-output emitter |
| `NVH` | Terminal-capability detector (Ghostty / iTerm version checks) |
| `GVH` | Alternate terminal-output path |
| `zW` | tmux / screen escape-sequence translator |
| `yf8` | Scroll-summary capture and telemetry emitter |
| `jZ` | Scroll state reader |
| `CX9` | Content extractor for scroll summary |
| `RX9` | Timing calculator for scroll summary (`Date.now`, `Math.max`, `Math.round`) |
| `hX9` | Summary data assembler |
| `Aq` | Fullscreen / terminal-rendering mode manager |
| `B$H` | Fullscreen-support predicate (uses `psK.has`) |
| `ED_` | Fullscreen enable helper |
| `mr` | Fullscreen render scheduler |
| `N` | Terminal-mode negotiator (colour / capability detection) |
| `ZD_` | Platform/OS gate (Windows detection) |
| `B_` | Fullscreen compositor |
| `X77` | Alternate fullscreen path |
| `G6` | Rendering / component update dispatcher |
| `BT` | Secondary analytics-drain trigger (calls `U4`) |
| `oxH` | Analytics-drain caller (`_OA.drain`) |
| `hf8` | Analytics-flush orchestrator (`Promise.all` + `Promise.race`) |
| `g8` | Subprocess / child-process manager |
| `K` | Process-list map helper |
| `q` | File-cleanup utility (`unlinkSync`) |
| `L` | Promise-lifecycle tracker (add/delete/finally) |
| `Bd1` | Native-library / FFI loader and execve caller |
| `f` | FFI/native module handle |
| `A` | Process/connection registry map |
| `$` | Push-buffer / disposal tracker |
| `Ls1` | Telemetry-log entry factory |
| `w` | Background-session supervisor / worker manager |
| `S` | Background-session subprocess wrapper |
| `bH` | Session "bad feature" telemetry helper |
| `hH` | Session "ok feature" telemetry helper |
| `uy8` | Low-memory checker for background sessions |
| `Lw6` | Config-file reader (reads JSON, filters, validates) |
| `B` | MCP tool-use filter (has `retireIfSettled`) |
| `DfA` | Background-session claim/connect/write handler |
| `GfA` | Worker lifecycle manager (done/killed/failed/crashed/idle states) |
| `D` | Background-session dispatcher / spare-pool controller |
| `j8` | Generic deferred/promise utility |
| `R` | Disposable resource wrapper |
| `M` | execve wrapper with path validation |
| `cS6` | Path-safety validator for execve (prevents `.staging` and `..` escapes) |
| `z` | Daemon stop/teardown controller |
| `hy` | Daemon IPC pipe setup |
| `Fm` | Daemon-process race/await orchestrator |
| `EH` | Error-code stringifier |
| `ej` | Relaunch-spawn-error file writer (`writeFileSync`) |
| `_I8` | Relaunch argv builder (assembles flag list from session state) |
| `p96` | CLI-arg serialiser used by `_I8` |
| `S6` | Config-file watcher / snapshot manager |
| `g6` | Config-path resolver |
| `sz_` | Config change-detection helper |
| `szH` | Config snapshot reader and backup manager |
| `p6` | JSON parser wrapper |
| `gb` | String prefix/slice utility |
| `yFq` | Config backup directory scanner |
| `qY_` | Backup path joiner |
| `b17` | File-watcher setup (`z_8.watchFile` / `unwatchFile`) |
| `Vr` | Watcher callback dispatcher |
| `V_` | Last-prompt / session-config state reader |
| `_V8` | Session working-directory extractor |
| `aA` | Session config field accessor |
| `AV8` | Session tool-list extractor |
| `y$` | App-state snapshot reader (used after relaunch to restore state) |