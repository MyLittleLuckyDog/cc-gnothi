---
type: feature-spec
feature: "passes"
cc_version: "2.1.174"
updated: "2026-06-12"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.174 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.174 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.174

---

## Overview

`/passes` is a local-jsx slash command that surfaces the **Guest Passes** feature, allowing users to share a free week of Claude Code with friends. When invoked, it renders a JSX-based UI component (via `YzA.createElement`) and fires a dedicated telemetry event to record that the guest-passes screen was visited.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| loc_byte | `12709929` |
| loc_byte_end | `12710251` |
| isHidden | `null` (not hidden) |
| module_id | `w3K` |
| load_inline | `true` |
| arbor_handler.name | `Li7` |
| arbor_handler.fqn | `claude-2.1.174::Li7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.174 bundle.js:+12709929

---

## Input Branching

The command flow is essentially linear: no sub-commands or argument branches are present in the registration or call graph. The handler (`Li7`) resolves and renders the JSX component unconditionally, with the only meaningful branching occurring inside nested infrastructure helpers (config read, background-daemon state). A numbered pseudocode representation is appropriate here.

1. User types `/passes` in the CLI.
2. The CLI dispatcher resolves the command name `"passes"` to module `w3K`, which exposes handler `Li7` via the inline load shape.
3. `Li7` is invoked as an `AsyncFunction`.
4. `Li7` calls `configReader` (`C6`) to obtain current application configuration.
5. `Li7` calls `backgroundSessionManager` (`mU8`) to obtain background-session context.
6. `Li7` calls `configSaveWithLock` (`G8`) to persist any necessary state prior to rendering.
7. `Li7` constructs the JSX render tree via `YzA.createElement(…)`.
8. The telemetry event `tengu_guest_passes_visited` is emitted.
9. The rendered JSX element is returned to the CLI shell for display.

---

## Behavioral Spec

### Main Handler — Guest Passes Entry Point

```
async function guestPassesHandler(context):
    config = await readConfig(context)                // C6
    bgSession = await resolveBackgroundSession(context) // mU8
    await saveConfigWithLock(context)                 // G8

    emitTelemetry("tengu_guest_passes_visited")       // bundle.js:+12709752

    element = createElement(GuestPassesComponent, {
        config: config,
        bgSession: bgSession
    })
    return element
```

Analysis basis: CC v2.1.174 bundle.js:+12709612 (Li7→C6), +12709646 (Li7→mU8), +12709652 (Li7→G8), +12709801 (Li7→YzA.createElement)

---

### Config Reader

```
function readConfig(context):
    // Reads configuration from disk using a shared filesystem helper.
    // Guards against pre-initialization access with a sentinel error:
    //   "Config accessed before allowed." (bundle.js:+3316861)
    // On success, parses JSON (via jsonParser) and returns config object.
    // On ENOENT, returns a default/empty config.
    // Tracks state strings:
    //   "unknown" | "local" | "migrated" | "native" | "installed"
    //   "disabled" | "enabled" | "no_permissions"
    //   "not_configured" | "global"
    raw = fs.readFileSync(configPath, "utf-8")        // bundle.js:+3316944
    if error.code == "ENOENT":                        // bundle.js:+3317091
        return defaultConfig()
    if error.code == "error":                         // bundle.js:+3317412
        emitTelemetry("tengu_config_parse_error")     // bundle.js:+3317492
        return defaultConfig()
    return jsonParser(raw)                            // l6 → JSON.parse
```

Analysis basis: CC v2.1.174 bundle.js:+3313610 (C6→r6), +3316855 (C7H→Error), +3316917 (C7H→q.readFileSync)

---

### Config Save with Lock

```
async function saveConfigWithLock(context):
    // Acquires a file lock before writing config to disk.
    // If lock contention exceeds threshold, emits:
    //   tengu_config_lock_contention (bundle.js:+3314917)
    // If re-read config is missing auth that cache has, refuses write:
    //   logs "saveConfigWithLock: re-read config is missing auth..." (bundle.js:+3315244)
    //   emits tengu_config_auth_loss_prevented (bundle.js:+3315396)
    // On stale-write detection, emits:
    //   tengu_config_stale_write (bundle.js:+3315053)
    // Maintains up to 5 backup copies (bundle.js:+3315847)
    // Backup files are identified by the ".backup." infix (bundle.js:+3315714)
    acquireLock()
    reRead = fs.readFileSync(configPath)
    if reRead is missing auth AND cache has auth:
        emitTelemetry("tengu_config_auth_loss_prevented")
        releaseLock()
        return
    atomicWrite(configPath, serializedConfig)        // fw6 path
    maintainBackupRotation(maxBackups=5)
    releaseLock()
```

Analysis basis: CC v2.1.174 bundle.js:+3311674 (G8→R58), +3314702 (R58→YN1), +3315821 (R58→f.copyFileSync)

---

### Background Session Manager

```
async function resolveBackgroundSession(context):
    // Initialises or attaches to the background daemon session context.
    // Delegates to the session-lifecycle orchestrator (Uw/DO chain).
    // May spawn a new background daemon via Dd.spawn (bundle.js:+16859948).
    // Spare-session pre-warming is gated and emits:
    //   tengu_bg_spare_enable (bundle.js:+16859491)
    //   tengu_bg_spare_claim  (bundle.js:+16859619)
    //   tengu_bg_spare_claim_fail (bundle.js:+16859885)
    // Auth is validated before any network socket connection (PTA path).
    session = getOrCreateSession(context)            // d4 → Uw → DO
    if session.state == "claimed":
        return session
    if spareAvailable():
        emitTelemetry("tengu_bg_spare_claim")
        return claimSpare()
    return spawnNew()                                // Dd.spawn
```

Analysis basis: CC v2.1.174 bundle.js:+12709646 (Li7→mU8), +12319265 (mU8→d4), +3271169 (d4→Uw)

---

### JSX Component Render

```
function renderGuestPassesUI(config, bgSession):
    // Produces a React/JSX element tree representing the Guest Passes UI.
    // Uses YzA.createElement — the bundled JSX runtime.
    // No argument processing: the command takes no user-supplied arguments.
    // The rendered element is returned directly to the CLI shell renderer.
    return YzA.createElement(GuestPassesComponent, {
        config,
        bgSession
    })
```

Analysis basis: CC v2.1.174 bundle.js:+12709801 (Li7→YzA.createElement), +12709750 (Li7→c)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_guest_passes_visited` (bundle.js:+12709752) — fired every time `/passes` is invoked |
| Telemetry (config) | `tengu_config_parse_error`, `tengu_config_lock_contention`, `tengu_config_stale_write`, `tengu_config_auth_loss_prevented` — fired from config subsystem if relevant errors occur |
| Telemetry (bg daemon) | `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_sendclaim_failed`, `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_low_mem_mb`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop`, `tengu_bg_attach`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_stall_respawn`, `tengu_bg_attach_kick`, `tengu_bg_attach_legacy_autorespawn`, `tengu_scheduled_task_missed` — fired from background daemon infrastructure |
| Telemetry (feature flags) | `tengu_feature_ok`, `tengu_feature_bad` — fired from feature-flag checker (CH/kH) |
| Hook registration | File-watch hook registered via `I58.watchFile` / `I58.unwatchFile` inside `em4` (config watch loop); unregistered on cleanup. Analysis basis: bundle.js:+3313113, +3313446 |
| appState changes | Config may be written to disk (via `saveConfigWithLock`/`R58`) if a stale state is detected on load |
| Filesystem side effects | Config JSON read from `~/.claude.json`; up to 5 backup copies maintained in the `backups/` subdirectory (bundle.js:+3316429, +3315847); atomic write via temp-file rename (fw6 path) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Background daemon | May spawn or reuse a background daemon process (`Dd.spawn`, bundle.js:+16859948); spare-session slot may be claimed or created |

---

## Version History

| Version | Change |
|---|---|
| v2.1.174 | Initial analysis |

---

## Common Mistakes

1. **Expecting argument support**: `/passes` takes no arguments. Passing any text after the command name has no effect — the handler renders the component unconditionally.
2. **Confusing `/passes` with an account-management API call**: The command renders a local JSX UI; it does not directly invoke any remote API endpoint. Network access occurs only through the background daemon infrastructure if already active.
3. **Assuming the command is hidden**: `isHidden` is `null` (not `true`), so `/passes` appears in the normal slash-command autocomplete list.
4. **Ignoring config-lock warnings**: If another Claude Code instance is writing config concurrently, a `tengu_config_lock_contention` event is emitted and a warning is logged ("Lock acquisition took longer than expected…", bundle.js:+3314828). This does not abort the command but may delay rendering.
5. **Misreading the telemetry scope**: Only `tengu_guest_passes_visited` is directly tied to this command. The many `tengu_bg_*` events come from shared daemon infrastructure traversed during handler setup and are not exclusive to `/passes`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Li7` | Main handler (`AsyncFunction`) for `/passes`; entry point resolved via module_id `w3K` |
| `C6` | Config reader — reads and parses the application config file |
| `r6` | Filesystem path resolver utility |
| `TV_` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `C7H` | Core config file loader — handles read, JSON parse, ENOENT, error branches |
| `q` | Node `fs` module wrapper (synchronous FS operations) |
| `R1` | CLI error reporter / process.exit handler |
| `l6` | JSON parser wrapper (delegates to `JSON.parse`) |
| `gu` | String prefix/slice utility (used in config path processing) |
| `H` | Random/timer utility (Math.random, setTimeout) |
| `_` | File system read utility (`readdirStringSync`, `statSync`) |
| `V8` | General-purpose value validator/sentinel |
| `M19` | Directory listing and backup path resolver |
| `ZV_` | Path join helper for backup directory construction |
| `M` | MCP/feature-map registry (get, values, has, set) |
| `$` | Feature-flag or plugin resolver |
| `N` | Log/notification dispatcher |
| `Z1f` | Log entry formatter |
| `RH` | JSON serialiser wrapper (`JSON.stringify`) |
| `df` | String redaction/sanitisation utility |
| `VgH` | Log header formatter |
| `h1f` | File content writer (byte-length aware, async) |
| `c` | Context/state container |
| `D` | Background daemon session supervisor |
| `A` | Process/worker registry map |
| `b` | Background task scheduler |
| `l8` | Timeout/abort wrapper |
| `CH` | Feature-flag "ok" checker |
| `kH` | Feature-flag "bad" checker |
| `vg8` | System memory reporter (macOS freemem) |
| `TG6` | Session roster file reader |
| `SH` | Error logger with push-to-list |
| `Q` | Background PTY process lifecycle manager (retireIfSettled) |
| `w6` | Background session dispatch/claim coordinator |
| `PTA` | Daemon socket authentication and connection handler |
| `VTA` | Background session state machine and lifecycle orchestrator |
| `f` | Promise-set tracker (add/finally/delete) |
| `Y` | Forced-shutdown / abort-controller handler |
| `A6` | App-level initialiser (delegates to S56) |
| `B` | Disposable resource handle |
| `em4` | Config file watcher (watchFile/unwatchFile loop) |
| `ZF` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `R9` | Hook/register helper (`qvA.register`) |
| `mU8` | Background session manager entry (delegates to d4) |
| `d4` | Session bootstrap — chains Uw then C6 |
| `Uw` | Session orchestrator — coordinates Vj, DO, G4, dA, IP, B26, trH |
| `w7` | CLI argument/profile loader (L6, zd6) |
| `Vj` | OAuth/profile session constructor |
| `G4` | First-party session factory |
| `IP` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `DO` | Session dispatch — resolves auth env vars, chains to C6 and Vj |
| `B26` | Transport retry builder |
| `trH` | Transport header builder (L6, k8H) |
| `G8` | Config-save-with-lock orchestrator |
| `R58` | Atomic config writer (lock, backup rotation, copy, write) |
| `YN1` | Config object merger (`iD_` + `Object.assign`) |
| `iD_` | Config default injector (`wN1`) |
| `YoH` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `V` | Config version/prefix string handle |
| `P` | IPC buffer/frame protocol handler |
| `X` | Socket timeout wrapper |
| `j` | Worker-map kill helper |
| `R7` | IPC frame encoder (end + RH) |
| `YZ5` | Full daemon protocol message handler (ping, nudge, attach, dispatch, reply, …) |
| `TH` | String coercion helper |
| `E` | Ring-buffer / bounded-history utility |
| `W` | SDK connection manager (AR, nN, Promise.all, SH, DA) |
| `fw6` | Atomic file write utility (lstat, temp rename, fchmod, fsync) |
| `O` | Background-session object (isSymbolicLink, x8) |
| `k8` | Value sentinel (delegates to V8) |
| `L` | Socket/stream wrapper (close, write, f) |
| `GJH` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `L19` | Config entry iterator (`Object.entries`) |
| `LW6` | Timestamp generator (`Date.now`) |
| `S58` | Config directory writer (LW6, AT, r6, GD.dirname, jX, RH, fw6, N) |