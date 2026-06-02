---
type: feature-spec
feature: "passes"
cc_version: "2.1.158"
updated: "2026-06-02"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.158 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.158 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.158

---

## Overview

The `/passes` command opens a UI panel that allows the current Claude Code user to share a free week of Claude Code with friends (a "guest pass" feature). It is implemented as a local JSX command, rendering a React element via `d6A.createElement`, and fires a `tengu_guest_passes_visited` telemetry event when invoked. The handler is an async function that resolves the display component and records the visit.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | Share a free week of Claude Code with friends |
| loc_byte | `12152493` |
| loc_byte_end | `12152815` |
| loc_line | `8016` |
| isHidden | `null` (not hidden) |
| module_id | `Qc1` |
| load_inline | `true` |
| arbor_handler.name | `oL5` |
| arbor_handler.fqn | `claude-2.1.158::oL5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.158 bundle.js:+12152493

---

## Input Branching

The `/passes` command has a simple, nearly linear invocation flow with only two meaningful branches (telemetry emission + JSX rendering). Pseudocode is sufficient.

1. User invokes `/passes` in the CLI.
2. Handler `passesCommandHandler` (bundle: `oL5`) is called asynchronously.
3. Handler fires telemetry event `tengu_guest_passes_visited`.
4. Handler calls `configFileWatcher` (bundle: `S6`) — sets up or references the config file watch context.
5. Handler calls `guestPassesUIComponent` (bundle: `zI8`) — resolves the JSX component for the passes UI.
6. Handler calls `configBackupOrMigrate` (bundle: `z8`) — loads/validates config state used by the UI.
7. Handler calls `getStateValue` (bundle: `d`) to retrieve any needed app state.
8. Handler calls `d6A.createElement(...)` to construct and return the JSX element for the passes panel.
9. The JSX panel is rendered in the terminal UI.

Analysis basis: CC v2.1.158 bundle.js:+12152176, +12152210, +12152216, +12152314, +12152365

---

## Behavioral Spec

### Main Handler — `passesCommandHandler` (bundle: `oL5`)

```
async function passesCommandHandler(context):
    // Fire visit telemetry immediately
    emit("tengu_guest_passes_visited")

    // Establish config watcher context (shared infrastructure)
    configCtx = await configFileWatcher(context)

    // Resolve the guest passes JSX UI component
    uiComponent = await guestPassesUIComponent(configCtx)

    // Load and validate config/backup state
    configState = await configBackupOrMigrate(context)

    // Retrieve current app state slice
    appStateSlice = getStateValue()

    // Build and return the JSX element for the passes panel
    return createElement(GuestPassesPanel, {
        configCtx,
        uiComponent,
        configState,
        appStateSlice
    })
```

Analysis basis: CC v2.1.158 bundle.js:+12152176, +12152210, +12152216, +12152314, +12152365

---

### Config File Watcher — `configFileWatcher` (bundle: `S6`)

This function is shared infrastructure used across several commands. It:
- Reads the global config file using `g6` (config path resolver).
- Establishes a file watch via `HY_` and `szH` for detecting config changes.
- Computes timestamps with `Date.now`.
- Calls `m17` (file watch setup helper) to register the watcher.

```
function configFileWatcher(options):
    configPath = resolveConfigPath()         // g6
    watchToken = setupFileWatch(configPath)  // HY_, m17
    configData = readAndParseConfig(configPath)  // szH
    timestamp = Date.now()
    return { configPath, watchToken, configData, timestamp }
```

Analysis basis: CC v2.1.158 bundle.js:+3207139, +3207153, +3207172, +3207176, +3207229, +3207282

---

### Guest Passes UI Component Resolver — `guestPassesUIComponent` (bundle: `zI8`)

Resolves the UI component tree. It calls:
- `agentRuntime` (bundle: `_7`), which initializes `agentExecutionContext` (bundle: `EY`) — the full agent/session bootstrap.
- `configFileWatcher` (bundle: `S6`) again for session-level config context.

```
async function guestPassesUIComponent(configCtx):
    agentCtx = agentRuntime(configCtx)    // _7 → EY
    sessionCtx = configFileWatcher(agentCtx)  // S6
    return buildUIComponent(agentCtx, sessionCtx)
```

Analysis basis: CC v2.1.158 bundle.js:+11786518, +11786566, +2961604, +2961609

---

### Config Backup / Migration — `configBackupOrMigrate` (bundle: `z8`)

Handles loading the config file, migrating legacy formats, and maintaining backups. It:
- Calls `configDirectoryLoader` (bundle: `LY_`) to read and enumerate config entries.
- Calls `configFileWatcher` (bundle: `szH`) to validate the parsed config.
- Uses `configStateClassifier` (bundle: `KY_`) to classify config state.
- Recognizes install states: `"unknown"`, `"local"`, `"migrated"`, `"native"`, `"installed"`, `"disabled"`, `"enabled"`, `"no_permissions"`, `"global"`, `"not_configured"` (Analysis basis: CC v2.1.158 bundle.js:+3205885–3206112).
- Maintains backup files tagged with `".backup."` (Analysis basis: CC v2.1.158 bundle.js:+3209110), retaining up to **5** backups (Analysis basis: CC v2.1.158 bundle.js:+3209243).
- Uses permissions mode **384** (octal `0600`) for written config files (Analysis basis: CC v2.1.158 bundle.js:+3209525).
- Emits `tengu_config_parse_error` on parse failure (Analysis basis: CC v2.1.158 bundle.js:+3210888).
- Guards against auth-loss on stale writes: logs `tengu_config_stale_write` and `tengu_config_auth_loss_prevented` (Analysis basis: CC v2.1.158 bundle.js:+3208449, +3208792).
- Detects lock contention and emits `tengu_config_lock_contention` (Analysis basis: CC v2.1.158 bundle.js:+3208313).
- Error literal: `"Config accessed before allowed."` (Analysis basis: CC v2.1.158 bundle.js:+3210257).
- Reads files as `"utf-8"` (Analysis basis: CC v2.1.158 bundle.js:+3210340).

```
async function configBackupOrMigrate(context):
    configDir = loadConfigDirectory()    // LY_
    validated = validateConfig(configDir)  // szH
    state = classifyConfigState(validated)  // KY_
    // state ∈ { "unknown", "local", "migrated", "native",
    //           "installed", "disabled", "enabled",
    //           "no_permissions", "global", "not_configured" }

    if parse error:
        emit("tengu_config_parse_error")
        return fallback config

    if stale write detected:
        emit("tengu_config_stale_write")
        if auth would be lost:
            emit("tengu_config_auth_loss_prevented")
            abort write

    if lock contention detected:
        emit("tengu_config_lock_contention")

    maintainBackups(maxCount=5, mode=0o600)
    return state
```

Analysis basis: CC v2.1.158 bundle.js:+3205246, +3205427, +3205693

---

### Config Directory Loader — `configDirectoryLoader` (bundle: `LY_`)

Enumerates config directory contents, handles symlinks via `symlinkSafeWrite` (bundle: `hL6`), and copies or removes files as needed.

```
function configDirectoryLoader(dirPath):
    ensureDir(dirPath)           // L.mkdirSync
    entries = readdir(dirPath)   // L.readdirStringSync
    timestamp = Date.now()
    result = []
    for entry in entries:
        if entry.startsWith(".backup."):
            // skip or manage backup entries
            continue
        filePath = join(dirPath, entry)
        stat = statSync(filePath)
        if isSymlink(stat):
            resolved = symlinkSafeWrite(filePath)  // hL6
        else:
            copy or process file
        result.append(processed entry)
    return result
```

Analysis basis: CC v2.1.158 bundle.js:+3208013, +3208019, +3208035, +3208040, +3208085, +3209002, +3209037, +3209110

---

### Agent Runtime Initialization — `agentRuntime` (bundle: `_7`) and `agentExecutionContext` (bundle: `EY`)

Called from `zI8` to construct the agent session context used by the passes UI.

- `agentRuntime` (`_7`) calls `agentExecutionContext` (`EY`) and `configFileWatcher` (`S6`).
- `agentExecutionContext` (`EY`) bootstraps: auth profile (`BK`, `pP`), OAuth handler (`NO`), agent loop (`XA`, `qX`), and session frame (`F3`).
- Auth error literal: `"ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, CLAUDE_CODE_OAUTH_TOKEN, or WIF env vars (ANTHROPIC_FEDERATION_RULE_ID + ANTHROPIC_ORGANIZATION_ID) required"` (Analysis basis: CC v2.1.158 bundle.js:+2945164).

```
function agentRuntime(configCtx):
    execCtx = agentExecutionContext(configCtx)   // EY
    sessionCtx = configFileWatcher(execCtx)      // S6
    return { execCtx, sessionCtx }
```

Analysis basis: CC v2.1.158 bundle.js:+2961604, +2961609

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_guest_passes_visited` — fired on every invocation of `/passes` (Analysis basis: CC v2.1.158 bundle.js:+12152316) |
| Telemetry | `tengu_config_parse_error` — fired when config JSON cannot be parsed (Analysis basis: CC v2.1.158 bundle.js:+3210888) |
| Telemetry | `tengu_config_lock_contention` — fired when config lock wait exceeds threshold (Analysis basis: CC v2.1.158 bundle.js:+3208313) |
| Telemetry | `tengu_config_stale_write` — fired on detected stale config write (Analysis basis: CC v2.1.158 bundle.js:+3208449) |
| Telemetry | `tengu_config_auth_loss_prevented` — fired when a write is aborted to prevent auth loss (Analysis basis: CC v2.1.158 bundle.js:+3208792) |
| Telemetry | `tengu_feature_ok` / `tengu_feature_bad` — fired by feature flag evaluation helpers `hH`/`bH` (Analysis basis: CC v2.1.158 bundle.js:+966033, +966091) |
| Telemetry | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_low_mem_mb`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_spawn`, `tengu_bg_spare_claim_fail`, `tengu_bg_sendclaim_failed` — background session/daemon telemetry emitted by shared infrastructure (`w`, `D`, `By8`, `jfA`, `ZfA`) traversed in the call graph |
| JSX rendering | `d6A.createElement(...)` is called to produce a React element for the terminal UI (Analysis basis: CC v2.1.158 bundle.js:+12152365) |
| Config file access | Config is read and possibly backed up/migrated during invocation (up to 5 backups, mode `0o600`) |
| Config file watch | `configFileWatcher` (`S6`) / `m17` registers a file watch on the config path via `j_8.watchFile` (Analysis basis: CC v2.1.158 bundle.js:+3206642) |
| appState changes | `getStateValue` (`d`) is read; no explicit write-back to app state identified in depth-2 traversal |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.158 | Initial analysis |

---

## Common Mistakes

1. **Confusing `/passes` with a billing command**: `/passes` is specifically for gifting a free week to friends, not for managing your own subscription or billing. It renders a UI panel; it does not make API calls to a billing endpoint directly.
2. **Expecting output in non-interactive mode**: Because this is a `local-jsx` command, it renders a React/Ink component. Running Claude Code in a non-TTY or `--print` mode may result in no visible output or an error.
3. **Assuming the command modifies config directly**: The config access during `/passes` is primarily read-only setup for the UI context. Config backup/migration is a side effect of shared infrastructure, not a deliberate action of the command itself.
4. **Overlooking the telemetry event**: Every invocation fires `tengu_guest_passes_visited` unconditionally, which is used for product analytics. This cannot be suppressed by user settings.
5. **Expecting the command to be listed in help**: `isHidden` is `null` (treated as non-hidden by default), so the command should appear in `/help`, but behavior may vary depending on entitlement or auth state.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `oL5` | Main handler for `/passes` command (`AsyncFunction`; Arbor-resolved via `module_id`) |
| `S6` | Config file watcher / config context setup |
| `g6` | Config path resolver |
| `HY_` | File watch token / watch registration helper |
| `szH` | Config read-and-parse (validates config file, handles ENOENT/EEXIST) |
| `q` | Filesystem operations namespace (readFileSync, statSync, copyFileSync, mkdirSync, etc.) |
| `p6` | JSON parse wrapper |
| `Qb` | String prefix/slice helper for config keys |
| `H` | Random/timing utility (Math.random, setTimeout) |
| `_` | Filesystem utility namespace (readdirStringSync, statSync, toUpperCase, filter) |
| `J8` | Logger / diagnostic utility |
| `RFq` | Config directory enumerator (reads and filters directory entries) |
| `fY_` | Path join helper for config/backup directories |
| `M` | Session/roster management helper (nS6, f.has, q0.rm) |
| `$` | Startup/disposer helper (`$s1`, `$.dispose`, `$.startsWith`) |
| `N` | API request builder / HTTP call helper |
| `lCK` | Config lock acquire/release helper |
| `RH` | JSON.stringify wrapper |
| `v4` | URL/path manipulation helper (replace, lastIndexOf, slice) |
| `EuH` | Auth environment variable resolver (`NYA`) |
| `rCK` | HTTP request sender (Buffer.byteLength, iYA, q9) |
| `d` | App state accessor (getStateValue) |
| `w` | Background session dispatcher (process manager) |
| `A` | Process/session map (get, set, values, toLowerCase) |
| `S` | Background process controller (kill, nVK, Iz, SH) |
| `bH` | Feature-flag "bad" reporter → `tengu_feature_bad` |
| `hH` | Feature-flag "ok" reporter → `tengu_feature_ok` |
| `By8` | Memory check helper (i6, G6) → `tengu_bg_low_mem_mb` |
| `fw6` | Config file reader for sessions (oP.readFile, p6, Array.isArray) |
| `SH` | Session health / error logging (F_, CH, L1, G_4, Vi.logError) |
| `B` | Settled-session reaper (VH.filter, dH.has) |
| `G6` | Background session pool manager (sz6, tz6, izH, PU) |
| `jfA` | Background session IPC connector (cF.claim, Gx8.connect, f.write) |
| `ZfA` | Session lifecycle manager (done/killed/stopped/failed/crashed/blocked states) |
| `L` | Session promise tracker (q.add, f.finally, q.delete) |
| `D` | Background session retry/restart loop (G6, By8, wfA, Date.now) |
| `R` | Disposable resource handle (R.dispose) |
| `m17` | File watch setup helper (j_8.watchFile, j_8.unwatchFile) |
| `Vr` | Watch callback handler |
| `q9` | Registration helper (qOA.register) |
| `zI8` | Guest passes UI component resolver |
| `_7` | Agent runtime initializer (_7 → EY → S6) |
| `EY` | Agent execution context bootstrap |
| `BK` | Auth bootstrap helper (CH) |
| `pP` | Auth profile constructor ($r6, BK, ogH, di, nN, CH) |
| `NO` | OAuth handler (WA, firstParty) |
| `qX` | Agent loop utility |
| `F3` | Session frame / main agent loop (BK, nN, sO6, pP, S6) |
| `eO6` | Agent context sub-builder (ogH) |
| `ogH` | Agent context finisher (CH, F$H) |
| `z8` | Config backup / migration orchestrator |
| `LY_` | Config directory loader and file copier |
| `nOq` | Config entry constructor (fK_, Object.assign) |
| `fK_` | Config entry field builder (lOq) |
| `qY6` | Config state serializer/deserializer |
| `V` | Config entry string filter (V.startsWith) |
| `P` | MCP/SDK connection manager (Ox8, ih, $m, Promise.all, SH, F_) |
| `Ox8` | MCP transport initializer |
| `F_` | Error/string utility (Error, String) |
| `E` | Config entry array (E.slice) |
| `hL6` | Symlink-safe atomic file write helper |
| `O` | Symlink/stat checker (O.isSymbolicLink, I8) |
| `P8` | Path/file utility (J8) |
| `f` | File descriptor / socket abstraction (A.close, q.close, L) |
| `UQH` | Config migration utility |
| `SFq` | Config entry Object.entries iterator |
| `BQH` | Config timestamp helper (Date.now) |
| `KY_` | Config state classifier (MD.dirname, g6, w0, RH, hL6) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.