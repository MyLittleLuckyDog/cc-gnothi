---
type: feature-spec
feature: "passes"
cc_version: "2.1.175"
updated: "2026-06-12"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.175 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.175 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.175

---

## Overview

The `/passes` command surfaces a guest-pass sharing interface that allows users to gift a free week of Claude Code access to friends. It is implemented as a `local-jsx` command, meaning the handler renders a JSX component directly rather than dispatching a text prompt to the agent. Upon invocation the handler fires a telemetry event, reads configuration state, and renders a React element presenting the pass-sharing UI.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| loc_byte | `12725961` |
| loc_byte_end | `12726283` |
| loc_line | `8906` |
| isHidden | `null` (not hidden) |
| module_id | `_$K` |
| load_inline | `true` |
| arbor_handler.name | `Lr7` |
| arbor_handler.fqn | `claude-2.1.175::Lr7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.175 bundle.js:+12725961

---

## Input Branching

The handler's top-level control flow has two primary paths: telemetry emission and JSX rendering succeed (normal path), or an error/abort is encountered (error path). The internal config-read and backup logic inside the called utilities branch further, but from the command's perspective the flow is linear with a single error branch.

```
1. Command invoked → handler (Lr7) entered
2. Emit telemetry event `tengu_guest_passes_visited`
3. Call config-read helper (KB8 / configReader) to load current configuration
4. Call session-context initializer (X8 / sessionContextInit) to prepare
   the background-session and filesystem state needed by the UI
5. Call createElement (UzA.createElement) to construct the JSX component
6. Return the rendered component to the CLI shell for display
   └─ On any unrecoverable error → propagate exception upward; no
      special error UI is rendered by this handler itself
```

Because there are only two outcome paths (success render / propagated error), pseudocode is used rather than a flowchart.

---

## Behavioral Spec

### Handler Entry — `passesHandler` (`Lr7`)

```
async function passesHandler(context):
    emit telemetry("tengu_guest_passes_visited")   // bundle.js:+12725784
    configData  = await configReader(context)      // KB8, bundle.js:+12725678
    sessionCtx  = await sessionContextInit(context)// X8,  bundle.js:+12725684
    element     = createElement(PassesComponent, {
                      config:     configData,
                      session:    sessionCtx,
                      ...context
                  })                               // UzA.createElement, bundle.js:+12725833
    return element
```

Analysis basis: CC v2.1.175 bundle.js:+12725644

---

### Config Reader — `configReader` (`KB8`)

```
function configReader(context):
    profile = loadProfile(context)        // n4, bundle.js:+12334707
    session = createSession(profile)      // C6, bundle.js:+12334755
    return { profile, session }
```

`loadProfile` (`n4`) calls the workspace initializer (`cw`) which itself
orchestrates profile resolution (`Ij`), auth-type detection (`XO`), and
session construction (`C6`).

Analysis basis: CC v2.1.175 bundle.js:+12725678

---

### Session Context Initializer — `sessionContextInit` (`X8`)

```
function sessionContextInit(context):
    configPath  = resolveConfigPath(_T)          // bundle.js:+3324979
    snapshots   = readSnapshots(H)               // bundle.js:+3324999
    metaInfo    = loadMetaInfo(yJH)              // bundle.js:+3325031
    statusMap   = buildStatusMap(s19)            // bundle.js:+3325050
    versionInfo = readVersionInfo(vW6)           // bundle.js:+3325075
    headers     = buildHeaders(N)                // bundle.js:+3325091

    // Filesystem backup pass:
    backupResult = runBackup(U7H)                // bundle.js:+3325156
    notifyUI     = prepareNotification(NoH)      // bundle.js:+3325172

    // Resolve final display data:
    displayData  = resolveDisplayData(d)         // bundle.js:+3325308
    summaryBlock = buildSummaryBlock(s58)        // bundle.js:+3325422

    return { configPath, snapshots, statusMap, versionInfo,
             headers, backupResult, displayData, summaryBlock }
```

Analysis basis: CC v2.1.175 bundle.js:+3324975

---

### Config Backup Utility — `configBackup` (`U7H`)

This utility is shared across several subsystems and is invoked during
session context initialization to ensure a config backup exists before
rendering the passes UI.

```
function configBackup(configPath, opts):
    if config not yet accessible:
        throw Error("Config accessed before allowed.")   // bundle.js:+3330162

    rawText  = fs.readFileSync(configPath, "utf-8")     // bundle.js:+3330218, +3330245
    parsed   = JSON.parse(rawText)                      // d6, bundle.js:+190130

    prefix   = resolvePrefix(ru)                        // bundle.js:+3330268
    // ru strips a leading prefix via startsWith / slice

    if parsed.code === "ENOENT":                        // bundle.js:+3330392
        log("error", ...)                               // bundle.js:+3330713
        return

    backupDir = path.join(baseDir, "backups")           // rV_, bundle.js:+3329730
    fs.mkdirSync(backupDir, { recursive: true })        // bundle.js:+3330972
    // Ignore EEXIST                                    // bundle.js:+3331007

    entries   = fs.readdirStringSync(backupDir)
    // Filter entries not starting with expected prefix // bundle.js:+3331065

    // Keep only the most recent N=5 backups            // bundle.js:+3329148
    // Copy current config to timestamped backup file   // bundle.js:+3331301
    destPath  = path.join(backupDir, basename + String(Date.now()))
    fs.copyFileSync(configPath, destPath)               // bundle.js:+3331301

    return destPath
```

Analysis basis: CC v2.1.175 bundle.js:+3330156

---

### Status Map Builder — `buildStatusMap` (`s19`)

```
function buildStatusMap(entries):
    result = {}
    for [key, value] of Object.entries(entries):   // bundle.js:+3326258
        result[key] = classifyStatus(value)
    return result

// Status classification literals observed:
// "unknown", "local", "migrated", "native", "installed",
// "disabled", "enabled", "no_permissions",
// "not_configured", "global"
// (bundle.js:+3325599 – +3325826)
```

Analysis basis: CC v2.1.175 bundle.js:+3325050

---

### Version / Timestamp Info — `readVersionInfo` (`vW6`)

```
function readVersionInfo():
    return {
        timestamp: Date.now(),        // bundle.js:+3326811
        // Internal metadata populated from build constants:
        // version   "2.1.175"        (bundle.js:+16878495)
        // buildDate "2026-06-12T01:26:01Z" (bundle.js:+16878584)
        // commitSHA "0b9163019454…"  (bundle.js:+16878615)
    }
```

Analysis basis: CC v2.1.175 bundle.js:+3325075

---

### File-Watch Helper — `fileWatcher` (`sp4`)

Called transitively from the session-context path; sets up a file watcher
on the config path and tears it down after the initial read completes.

```
function fileWatcher(configPath, callback):
    token = _T.watch(configPath)           // bundle.js:+3326409
    r58.watchFile(configPath, handler)     // bundle.js:+3326414
    // On change: invoke callback via Mq / ru
    // On completion:
    r58.unwatchFile(configPath)            // bundle.js:+3326747
    pvA.register(token)                   // u9, bundle.js:+64135
```

Analysis basis: CC v2.1.175 bundle.js:+3326409

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry emitted | `tengu_guest_passes_visited` (bundle.js:+12725784) |
| Telemetry (config subsystem) | `tengu_config_parse_error` (+3330793), `tengu_config_lock_contention` (+3328218), `tengu_config_stale_write` (+3328354), `tengu_config_auth_loss_prevented` (+3328697) |
| Telemetry (background daemon) | `tengu_bg_dispatch_sigkill_escalate` (+16877366), `tengu_bg_low_mem_mb` (+13321809), `tengu_bg_dispatch_low_mem` (+16877967), `tengu_bg_spare_enable` (+16878671), `tengu_bg_sendclaim_failed` (+16856159), `tengu_bg_spare_claim` (+16878799), `tengu_bg_spare_claim_fail` (+16879065), `tengu_bg_proto_mismatch` (+16864057), `tengu_bg_dispatch_stale_drop` (+16865425), `tengu_bg_attach_legacy_autorespawn` (+16868079), `tengu_bg_attach` (+16869237), `tengu_bg_attach_stall_gave_up` (+16870160), `tengu_bg_attach_stall_respawn` (+16870430), `tengu_bg_attach_kick` (+16871380) |
| Telemetry (feature flags) | `tengu_feature_ok` (+1017151), `tengu_feature_bad` (+1017218) |
| Telemetry (scheduled tasks) | `tengu_scheduled_task_missed` (+16371033) |
| Filesystem side effects | Creates a config backup file under `<configDir>/backups/` (timestamped). Keeps at most 5 backup files. |
| Config lock | May acquire a file lock during config read/write; contention is telemetered as `tengu_config_lock_contention`. |
| File watcher | Registers and then immediately unregisters a `watchFile` listener on the config path as part of the session-context snapshot read. |
| appState changes | No direct appState mutation observed at depth ≤ 2 from `Lr7`. |
| Sound | None observed. |
| JSX render | Returns a React element (`UzA.createElement`) for display; the CLI shell is responsible for rendering it to the terminal. |

---

## Version History

| Version | Change |
|---|---|
| v2.1.175 | Initial analysis |

---

## Common Mistakes

1. **Expecting text output**: `/passes` is a `local-jsx` command. It renders a UI component, not a plain text response. Tools or scripts that parse command output as text will not receive structured data.
2. **Assuming no filesystem activity**: The command silently writes or updates a config backup file on every invocation. If the backup directory does not exist it is created automatically; `EEXIST` errors are suppressed.
3. **Triggering in non-interactive shells**: Because the command renders JSX, invoking it via a non-interactive pipe or script will produce no meaningful output and may throw a render error.
4. **Misreading the description as a network call**: The command's description says "share a free week", but the handler itself only renders a local UI component. Any actual pass-redemption flow is handled by the rendered component, not by this command's handler.
5. **Overlooking config lock contention**: If another Claude Code instance holds the config lock when `/passes` is invoked, the session-context initializer will log a warning and emit `tengu_config_lock_contention` before proceeding. The UI may reflect stale config data in that case.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Lr7` | Main handler (passesHandler) — AsyncFunction; entry point for `/passes` |
| `C6` | Session factory / workspace session constructor |
| `o6` | Config path resolver |
| `nV_` | Notification helper (UI notification emitter) |
| `U7H` | Config backup utility |
| `q` | Node `fs` module proxy / custom FS wrapper |
| `u1` | CLI process exit / error reporter |
| `d6` | Safe JSON parser (wraps `JSON.parse`) |
| `ru` | String prefix stripper (startsWith + slice) |
| `H` | Random / timer utility (Math.random + setTimeout) |
| `_` | Extended filesystem helper (readdirStringSync, statSync) |
| `E8` | Error classification / error-code helper |
| `t19` | Backup directory enumerator |
| `rV_` | Path joiner for backup directory (path.join + homedir) |
| `M` | Settings / feature-map store accessor |
| `$` | Auth / credential store accessor |
| `N` | Config header / HTTP header builder |
| `J9f` | Config serializer |
| `RH` | JSON stringifier wrapper |
| `nf` | String redaction helper (replaces secrets with `[REDACTED]`) |
| `mgH` | Log-level adapter (LIA) |
| `G9f` | Config file writer with byte-length check |
| `d` | Display / UI data resolver |
| `D` | Background daemon process manager |
| `A` | Lowercase normalizer / process argument mapper |
| `b` | Background session worker scheduler |
| `i8` | Child-process spawn wrapper with timeout |
| `CH` | Feature-flag checker (ok path) |
| `kH` | Feature-flag checker (bad path) |
| `ng8` | macOS memory reporter |
| `UG6` | Background session roster file reader |
| `SH` | Session-state broadcaster |
| `Q` | Background PTY connection manager (retireIfSettled) |
| `z6` | Session-context dispatcher |
| `dTA` | Daemon claim / socket authenticator |
| `oTA` | Session lifecycle manager (spawn, retire, cleanup) |
| `f` | Session lifecycle manager alias (same shape as oTA) |
| `Y` | Forced-shutdown handler (process.exit + z.abort) |
| `A6` | Disposable registration helper |
| `B` | Disposable container |
| `sp4` | File-watcher helper (watchFile / unwatchFile) |
| `yF` | UI update notifier triggered by file-watch events |
| `u9` | Cleanup-token registrar (pvA.register) |
| `KB8` | Config reader / profile loader |
| `n4` | Profile resolver (calls workspace init cw) |
| `cw` | Workspace initializer (orchestrates profile + auth + session) |
| `D7` | Bare-mode flag checker |
| `Ij` | Profile-type resolver (user_oauth, profile-implicit, etc.) |
| `V4` | First-party auth type classifier |
| `IP` | Auth environment variable inspector |
| `XO` | Auth-type selector (ANTHROPIC_API_KEY, apiKeyHelper, none, etc.) |
| `qW6` | Workspace options builder |
| `woH` | Workspace config key builder |
| `X8` | Session context initializer |
| `t58` | Config snapshot writer / backup orchestrator |
| `Hh1` | Object-assign merger for config snapshots |
| `Gj_` | Snapshot diff producer |
| `NoH` | UI notification preparer |
| `V` | Backup entry filename filter (startsWith ".backup.") |
| `P` | Background PTY protocol framer / IPC buffer handler |
| `X` | IPC receive buffer |
| `j` | Worker kill dispatcher |
| `b7` | Protocol frame finalizer |
| `YV5` | Background PTY message dispatcher (full protocol handler) |
| `TH` | String coercion helper |
| `E` | Slice / range helper (Math.max + Math.min) |
| `W` | SDK connection manager (connected, Connection failed states) |
| `Ww6` | Atomic file writer (randomBytes temp file + fsync + rename) |
| `O` | Symbolic-link / stat resolver |
| `y8` | Error-code classifier wrapper |
| `L` | Socket / stream lifecycle manager |
| `yJH` | Meta-info loader |
| `s19` | Status-map builder (Object.entries iterator) |
| `vW6` | Version / timestamp info reader |
| `s58` | Summary block builder (config snapshot diff writer) |