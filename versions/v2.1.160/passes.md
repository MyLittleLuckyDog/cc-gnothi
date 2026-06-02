---
type: feature-spec
feature: "passes"
cc_version: "2.1.160"
updated: "2026-06-02"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.160 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.160 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.160

---

## Overview

The `/passes` command opens the guest-pass sharing interface, which allows the current user to share a free week of Claude Code access with friends. It renders a JSX component via `U_A.createElement` and fires a `tengu_guest_passes_visited` telemetry event when the UI is displayed. The command is implemented as an async function (`f0f`) that coordinates configuration loading and background-session infrastructure before presenting the UI.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | Share a free week of Claude Code with friends |
| loc_byte | `12267983` |
| loc_byte_end | `12268305` |
| loc_line | `8528` |
| isHidden | `null` (not hidden) |
| module_id | `Rr1` |
| load_inline | `true` |
| arbor_handler.name | `f0f` |
| arbor_handler.fqn | `claude-2.1.160::f0f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.160 bundle.js:+12267983

---

## Input Branching

The command handler has a small number of distinct execution paths (initialization success vs. failure vs. JSX render), so numbered pseudocode is used here.

```
1. User invokes /passes
2. Handler (f0f) begins async execution
3. Invoke configLoader (Dk8) to load global/local configuration
   a. configLoader calls sessionFileHelper (fL) → configReadWrite (R6)
   b. configReadWrite calls configParseHelper (ZDH):
      - Reads config file via fs.readFileSync (utf-8)
      - On ENOENT: returns default/empty config
      - On parse error: fires tengu_config_parse_error telemetry, uses fallback
      - Validates auth fields; on loss prevented: fires tengu_config_auth_loss_prevented
4. Invoke backgroundSessionManager (W8) to set up background session state
   a. W8 calls configReadWrite (ZDH, N) to read and normalize settings
   b. W8 calls sessionWatcher (xY_):
      - Creates lock directory via fs.mkdirSync
      - Reads session directory, filters by ".backup." filename prefix
      - Copies/unlinks backup files (max 5 backups retained)
      - On lock contention: fires tengu_config_lock_contention telemetry
      - On stale write: fires tengu_config_stale_write telemetry
   c. W8 calls configDiffHelper (ZDH) and statusBuilder (fY6)
5. Invoke appStateInit (d) to obtain/update application state
6. Fire tengu_guest_passes_visited telemetry event
7. Call U_A.createElement to construct and return the JSX component
   (renders the guest-pass sharing UI)
```

Analysis basis: CC v2.1.160 bundle.js:+12267666 (f0f→R6), +12267700 (f0f→Dk8), +12267706 (f0f→W8), +12267804 (f0f→d), +12267855 (f0f→U_A.createElement), +12267806 (telemetry)

---

## Behavioral Spec

### Handler Entry — `guestPassesHandler` (`f0f`)

```
async function guestPassesHandler(context):
    config      = await configLoader(context)          // Dk8
    bgSession   = await bgSessionManager(context)      // W8
    appState    = await appStateInit(context)          // d
    emitTelemetry("tengu_guest_passes_visited")        // +12267806
    return createElement(GuestPassesUI, {              // U_A.createElement
        config,
        bgSession,
        appState
    })
```

Analysis basis: CC v2.1.160 bundle.js:+12267666–12267855

---

### Configuration Loading — `configLoader` (`Dk8`)

```
function configLoader(context):
    sessionData = sessionFileHelper(context)    // fL → R6
    config      = configReadWrite(sessionData)  // R6
    return config
```

Analysis basis: CC v2.1.160 bundle.js:+11898884 (Dk8→fL), +11898932 (Dk8→R6)

---

### Config Read/Write — `configReadWrite` (`R6`)

```
function configReadWrite(params):
    ts    = Date.now()                          // +3244687
    watch = fileWatcher(params)                 // ojL
    diff  = configDiffHelper(params)            // ZDH
    hY_helper(params)                           // hY_
    return { watch, diff, ts }
```

Analysis basis: CC v2.1.160 bundle.js:+3244597, +3244611, +3244630, +3244634, +3244687

---

### Config Parse Helper — `configParseHelper` (`ZDH`)

The config parse helper reads the on-disk configuration file, handles missing-file and parse errors, validates auth integrity, and copies files to backup storage.

```
function configParseHelper(configPath):
    if configPath not yet initialized:
        throw Error("Config accessed before allowed.")   // +3247715

    rawText = fs.readFileSync(configPath, "utf-8")       // +3247771, +3247798

    try:
        data = JSON.parse(rawText)                       // via m6
    catch:
        if error.code == "ENOENT":                       // +3247945
            data = {}
        else:
            emitTelemetry("tengu_config_parse_error")   // +3248346
            data = {}

    // Validate status fields present in data
    // Status values classified as: "unknown", "local", "migrated", "native",
    // "installed", "disabled", "enabled", "no_permissions",
    // "global", "not_configured"                        // +3243343–3243570

    if data has error field:                             // +3248266
        // log and continue

    stat = fs.statSync(configPath)                       // +3248306
    if stat directory:
        destDir  = path.basename(configPath)             // +3248498
        destPath = buildDestPath(destDir)                // uY_
        fs.mkdirSync(destPath, { flag: "EEXIST" })       // +3248525, +3248560
        entries  = fs.readdirStringSync(destPath)        // +3248583

    backupDir = buildBackupPath(configPath)              // nQq / uY_
    backupName = buildBackupName(configPath)             // +3247283 ("backups")
    ts = Date.now()
    fs.copyFileSync(configPath, backupTarget)            // +3248854

    return data
```

Analysis basis: CC v2.1.160 bundle.js:+3247709, +3247715, +3247756, +3247771, +3247798, +3247818, +3247821, +3247838, +3247892, +3247937, +3247945, +3247961, +3248196, +3248266, +3248306, +3248344, +3248498, +3248515, +3248525, +3248583, +3248736, +3248836, +3248854

---

### Background Session Manager — `bgSessionManager` (`W8`)

```
async function bgSessionManager(context):
    y0State = initStateHelper(context)                  // y0  (+3242708)
    hState  = fetchHelper(context)                      // H   (+3242728)
    sdh     = sdHelper(context)                         // SdH (+3242760)
    entries = configEntryHelper(context)                // lQq (+3242779), uses Object.entries
    rdh     = timestampHelper(context)                  // RdH (+3242804), uses Date.now
    norm    = normalizeConfig(context)                  // N   (+3242820)
    diff    = configDiffHelper(context)                 // ZDH (+3242885)
    fy6     = statusFlagHelper(context)                 // fY6 (+3242901)
    d       = appState(context)                         // d   (+3243037)
    bY_     = backupPathHelper(context)                 // bY_ (+3243151)

    // Session watcher orchestration (xY_) runs inside W8 via bY_
    // Backup rotation: max 5 backups (+3246701), file mode 384 (+3246983)
    // Backup filenames contain ".backup." substring (+3246568)

    return sessionHandle
```

Analysis basis: CC v2.1.160 bundle.js:+3242704, +3242708, +3242728, +3242760, +3242779, +3242804, +3242820, +3242885, +3242901, +3243037, +3243151

---

### Session File Watcher — `sessionFileWatcher` (`xY_`)

```
function sessionFileWatcher(sessionDir):
    dir = path.dirname(sessionDir)                      // VY.dirname +3245477
    fs.mkdirSync(dir, recursive)                        // L.mkdirSync +3245498
    ts  = Date.now()                                    // +3245543
    cfg = buildSessionConfig()                          // qYq +3245556

    // Config lock safety
    if lockContentionDetected():
        // warn: "Lock acquisition took longer than expected..."  // +3245682
        emitTelemetry("tengu_config_lock_contention")  // +3245771

    // Auth-loss prevention
    if reReadConfigMissingAuth():
        // warn: "saveConfigWithLock: re-read config is missing auth..." // +3246098
        emitTelemetry("tengu_config_auth_loss_prevented") // (via xY_→N path)

    if staleWriteDetected():
        emitTelemetry("tengu_config_stale_write")       // +3245907

    // Backup rotation
    entries = fs.readdirStringSync(sessionDir)          // L.readdirStringSync +3246460
    for each entry starting with prefix:                // V.startsWith +3246495
        parts = entry.split(".")                        // X.split +3246560
        num   = Number(parts[n])
        if Number.isNaN(num): continue                  // +3246591
        dest  = path.join(sessionDir, ...)              // VY.join +3246636
        fs.copyFileSync(src, dest)                      // L.copyFileSync +3246675

    // Trim to last 5 backups
    excess = backupList.slice(0, backupList.length - 5) // Z.slice +3246804
    for each excess:
        fs.unlinkSync(excess)                           // L.unlinkSync +3246819

    // Atomic write helper (If6): uses random temp filename,
    // fchmodSync to preserve permissions (mode 384 = 0o600),
    // fsyncSync, then renameSync
    atomicWrite(targetPath, data, mode=384)             // If6 +3246941

    // File status checks
    stat = fs.statSync(sessionDir)                      // L.statSync +3245847
    return sessionState
```

Backup file count limit: **5** (bundle.js:+3246701)
Default file permission mode: **384** (0o600) (bundle.js:+3246983)

Analysis basis: CC v2.1.160 bundle.js:+3245471–3247021

---

### Background Dispatch Subsystem (called transitively via `W8`)

The background-worker system is reached transitively. Relevant behaviors observable via call graph:

- **Low-memory guard**: checks `os.freemem()` against a threshold; fires `tengu_bg_dispatch_low_mem` on low memory (bundle.js:+15848113). macOS-specific low-memory threshold logged via `tengu_bg_low_mem_mb` (bundle.js:+12846064); constant `1024` (bundle.js:+12846086).
- **SIGKILL escalation**: fires `tengu_bg_dispatch_sigkill_escalate` if graceful kill times out; uses `"SIGKILL"` literal (bundle.js:+15847582). Timeout constants: `30` and `15` (bundle.js:+15847489, +15847500).
- **Spare worker**: fires `tengu_bg_spare_enable` (bundle.js:+15848808), `tengu_bg_spare_claim` (bundle.js:+15848929), `tengu_bg_spare_claim_fail` (bundle.js:+15849192) for worker lifecycle.
- **Daemon yield**: fires `tengu_daemon_yield` when yielding to a foreground/service daemon (bundle.js:+15866241); literal: `"yielding to a foreground/service daemon — bg workers will be re-adopted"` (bundle.js:+15866159).
- **Session states observed**: `"done"`, `"killed"`, `"stopped"`, `"failed"`, `"crashed"`, `"blocked"`, `"working"`, `"active"`, `"bg"`, `"daemon"`, `"idle"`, `"resuming"` (bundle.js:+15852731–15854512).
- **Connection error handling**: `"ECONNREFUSED"` / `"econnrefused"` / `"enoent"` (bundle.js:+15849110–15849138).
- **Idle timeout**: `300000` ms (5 minutes) before cleanup (bundle.js:+15854298).
- **Bootstrap fetch timeout**: `5000` ms (bundle.js:+15451991); event `"api_bootstrap_fetch"` / `"parse_failed"` (bundle.js:+15452112, +15452134).

Analysis basis: CC v2.1.160 bundle.js:+15847489–15854512

---

### Atomic Config Write — `atomicWriteHelper` (`If6`)

```
function atomicWriteHelper(targetPath, data):
    // Resolve symlinks safely; errors ELOOP / ENOTDIR handled explicitly
    resolved = resolveSymlinks(targetPath)             // q.readlinkSync +1012151
    if not path.isAbsolute(resolved):
        resolved = path.resolve(path.dirname(targetPath), resolved)

    // Create temp file with random name (6 random bytes → hex = 12 chars)
    randomSuffix = crypto.randomBytes(6).toString("hex") // +1012780, +1012796, +1012808
    tmpPath = path.join(path.dirname(resolved), randomSuffix)

    // Write, preserve permissions (mode 384 = 0o600), sync, rename
    fd = fs.openSync(tmpPath, ...)                     // +1012310
    fs.writeFileSync(tmpPath, data)                    // +1013216
    originalMode = fs.statSync(targetPath).mode & 0o777
    fs.fchmodSync(fd, originalMode ?? 384)             // +1013274
    // "Applied original permissions to temp file"     // +1013295
    fs.fsyncSync(fd)                                   // +1013340
    fs.closeSync(fd)                                   // q$.closeSync +1012297
    fs.renameSync(tmpPath, resolved)                   // +1013468
    // On failure: fs.unlinkSync(tmpPath)              // +1013625
```

Analysis basis: CC v2.1.160 bundle.js:+1012064–1013625

---

### OAuth / Auth Setup — `authSetup` (`bD` / `e3` / `hJ`)

```
function authSetup(context):
    // Auth source resolution (hJ):
    //   profile type "profile-implicit"               // +2985341
    //   or "user_oauth"                               // +2985414
    //   or first-party flow "firstParty"              // +2048145 (via bM)

    // Required env vars check (e3):
    //   ANTHROPIC_API_KEY                             // +2988369
    //   apiKeyHelper                                  // +2988463
    //   if none → throw: "ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN,
    //     CLAUDE_CODE_OAUTH_TOKEN, or WIF env vars ... required"  // +2988832

    // OAuth profile "claude-desktop-3p"              // +2984872 (hJ)
    // Auth flag none = "none"                         // +2988502

    return authResult
```

Analysis basis: CC v2.1.160 bundle.js:+2984965–2989354

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_guest_passes_visited` | Fired immediately when `/passes` UI is rendered (bundle.js:+12267806) |
| Telemetry — `tengu_config_parse_error` | Fired when config JSON cannot be parsed (bundle.js:+3248346) |
| Telemetry — `tengu_config_lock_contention` | Fired when config file lock acquisition is slow (bundle.js:+3245771) |
| Telemetry — `tengu_config_stale_write` | Fired when a stale write is detected during config save (bundle.js:+3245907) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a write that would wipe auth is suppressed (bundle.js:+3246250) |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Fired when a background worker requires SIGKILL escalation (bundle.js:+15847534) |
| Telemetry — `tengu_daemon_yield` | Fired when yielding to a foreground/service daemon (bundle.js:+15866241) |
| Telemetry — `tengu_feature_bad` / `tengu_feature_ok` | Feature flag check result (bundle.js:+966181, +966123) |
| Telemetry — `tengu_bg_low_mem_mb` | macOS low-memory measurement event (bundle.js:+12846064) |
| Telemetry — `tengu_bg_dispatch_low_mem` | Low-memory dispatch guard (bundle.js:+15848113) |
| Telemetry — `tengu_bg_spare_enable` | Spare worker enabled (bundle.js:+15848808) |
| Telemetry — `tengu_bg_sendclaim_failed` | Spare worker claim send failed (bundle.js:+15828180) |
| Telemetry — `tengu_bg_spare_claim` | Spare worker successfully claimed (bundle.js:+15848929) |
| Telemetry — `tengu_bg_spare_claim_fail` | Spare worker claim failed (bundle.js:+15849192) |
| Telemetry — `api_bootstrap_fetch` / `parse_failed` | Bootstrap API fetch result (bundle.js:+15452112, +15452134) |
| Telemetry — `rate_limit_event` | Rate-limit event emitted by background rate-limit tracker (bundle.js:+15635700) |
| Telemetry — `tengu_bg_session_create` | Background session creation (bundle.js:+15847844) |
| Telemetry — `dup_retry_exhausted` | Duplicate retry limit reached (bundle.js:+15847871) |
| appState changes | Reads and potentially updates global app state via `d` helper (bundle.js:+12267804) |
| Config file writes | Atomic writes via `If6` (temp file → fchmod → fsync → rename); backup rotation (max 5) in session directory |
| Hook registration | `O9` calls `HDA.register` for file-watch hooks (bundle.js:+59048); `ojL` registers/unregisters via `DA8.watchFile` / `DA8.unwatchFile` |
| Background workers | `W8` / `w` spawn and manage background session workers via `Hg.spawn` (bundle.js:+15849251) |
| JSX render | `U_A.createElement` produces the guest-pass UI component (bundle.js:+12267855) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.160 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/passes` without authentication**: The command runs auth-setup logic transitively via `bD`/`e3`. If none of `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, or WIF environment variables are set, the handler will throw before the UI renders (bundle.js:+2988832).
2. **Expecting an interactive prompt**: `/passes` is a `local-jsx` command — it renders a React/JSX component directly, not a text prompt response. It does not invoke the AI model.
3. **Ignoring config lock warnings**: The lock-contention warning ("Lock acquisition took longer than expected — another Claude instance may be running") at bundle.js:+3245682 indicates a real concurrency risk. Running multiple Claude Code instances simultaneously can cause this.
4. **Assuming no side effects**: The command touches background-session infrastructure and configuration state on startup, not just the passes UI. This means transient config writes and telemetry events fire even for a simple UI display.
5. **Misidentifying the handler**: The Arbor-resolved handler name is `f0f` (module `Rr1`), not the synthetic BFS entry. Any bundle-level debugging should reference `f0f` at byte offset `12267666`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `f0f` | Main async handler for `/passes` (`guestPassesHandler`) |
| `R6` | Config read/write coordinator (`configReadWrite`) |
| `d6` | Logging/debug utility |
| `hY_` | Config helper sub-routine |
| `ZDH` | Config parse helper, backup copy logic (`configParseHelper`) |
| `q` | Node `fs` sync bindings (readFileSync, statSync, copyFileSync, etc.) |
| `m6` | JSON parse wrapper |
| `Ax` | HTTP header / URL prefix helper |
| `H` | HTTP fetch / bootstrap fetch utility |
| `_` | Filesystem utility (readdirStringSync, statSync, toUpperCase) |
| `G8` | General utility / error boundary helper |
| `nQq` | Backup directory resolver (`backupDirResolver`) |
| `uY_` | Backup destination path builder |
| `M` | Cache/map manager with `rm` and `has` operations |
| `$` | Prefix/path helper |
| `N` | Config normalizer / HTTP request builder |
| `lmK` | Config sub-normalizer |
| `SH` | JSON stringify wrapper |
| `x4` | String redaction / sanitization helper |
| `PmH` | Path/string manipulation helper |
| `rmK` | File-based message builder (uses `Buffer.byteLength`) |
| `d` | App state accessor/initializer |
| `w` | Background worker / daemon manager |
| `A` | Map/collection with `get`, `set`, `values`, `toLowerCase` |
| `S` | Writer / output stream helper |
| `RH` | Feature-ok handler (calls `d`) |
| `hH` | Feature-bad handler (calls `d`) |
| `gh8` | macOS memory check helper |
| `fj6` | Session file reader (reads JSON array, filters, validates) |
| `yH` | Session error/log collector |
| `F` | Promise/task with `retireIfSettled` |
| `W6` | Session dispatch router (`sessionDispatchRouter`) |
| `w$A` | Background send-claim helper |
| `T$A` | Background session lifecycle manager |
| `L` | Async filesystem promise wrapper; also used as task tracker |
| `Y` | Forced-shutdown helper (calls `process.exit`) |
| `R` | Rate-limit event enqueuer |
| `ojL` | File watcher setup/teardown (`fileWatcherManager`) |
| `Br` | Watcher callback helper |
| `O9` | Hook registration helper (calls `HDA.register`) |
| `Dk8` | Config loader entry point |
| `fL` | Session file helper |
| `bD` | Auth coordinator |
| `eK` | Auth token fetcher |
| `hJ` | OAuth profile selector |
| `bM` | First-party auth handler |
| `jP` | Auth parameter builder |
| `e3` | Auth validation and env-var checker |
| `AD6` | Auth disposition helper |
| `cQH` | Auth cache/state helper |
| `W8` | Background session manager (`bgSessionManager`) |
| `xY_` | Session file watcher / backup rotator (`sessionFileWatcher`) |
| `qYq` | Session config builder |
| `R4_` | Session config sub-builder |
| `fY6` | Status flag helper |
| `V` | Filename prefix checker |
| `X` | MCP/SDK session runner |
| `Yu8` | Session transport initializer |
| `d_` | Error/string coercion helper |
| `Z` | Backup list slice target |
| `If6` | Atomic file write helper (`atomicWriteHelper`) |
| `O` | Stat result / symlink checker |
| `V8` | General guard/validator |
| `f` | Socket / stream object |
| `SdH` | Session data helper |
| `lQq` | Config entry iterator (uses `Object.entries`) |
| `RdH` | Timestamp helper (uses `Date.now`) |
| `bY_` | Backup path helper |