---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.186"
updated: "2026-06-23"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.186 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.186 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.186

---

## Overview

The `/install-slack-app` command opens the Claude Slack app installation page in the user's default browser. It emits a telemetry event on activation, displays a brief status message, and then delegates to the platform-aware URL-opener and global config persistence subsystems to complete the flow.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| loc_byte | `11794347` |
| loc_byte_end | `11794533` |
| loc_line | `7925` |
| supportsNonInteractive | `false` |
| module_id | `dEl` |
| load_inline | `true` |
| arbor_handler.name | `Tof` |
| arbor_handler.fqn | `claude-2.1.186::Tof` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.186 bundle.js:+11794347

---

## Input Branching

The command accepts no user-supplied arguments and follows a largely linear flow with two minor conditional branches (platform detection for the browser-opener and lock-contention handling during config write). Pseudocode is sufficient.

1. User invokes `/install-slack-app`.
2. Handler `Tof` fires immediately — no argument parsing.
3. Emit telemetry event `tengu_install_slack_app_clicked`.
4. Call global-config save helper (`_n`) to persist any pending state.
5. Return a `text` result containing the user-facing status string `"Opening Slack app installation page in browser…"`.
6. Call URL-opener (`Jl` / `Nai` / `On`) to launch the installation URL in the default browser.
   - On macOS (`darwin`): use `open` shell command.
   - On other platforms: use the appropriate cross-platform launcher.

---

## Behavioral Spec

### Main Handler — `installSlackAppHandler` (`Tof`)

```
async function installSlackAppHandler(context):
    emit_telemetry("tengu_install_slack_app_clicked")   // +11793953

    saveGlobalConfig(context)                           // calls _n (+11793991)

    openUrl(SLACK_INSTALL_URL)                          // calls Jl (+11794066)

    return { type: "text",                              // +11794086
             content: "Opening Slack app installation page in browser…" }
                                                        // +11794099
```

Analysis basis: CC v2.1.186 bundle.js:+11793951

---

### Global Config Save — `saveGlobalConfig` (`_n`)

```
async function saveGlobalConfig(options):
    acquire filesystem lock (IQn)                       // +13847130
    if lock contention detected:
        emit_telemetry("tengu_config_lock_contention")  // +13850557
        log warning: "Lock acquisition took longer than expected…"
                                                        // +13850468

    read current config from disk (cEe)                 // +13847311
    if re-read config is missing auth that cache has:
        log warning: "saveGlobalConfig fallback: re-read config is missing auth…"
                                                        // +13847337
        emit_telemetry("tengu_config_auth_loss_prevented") // +13851036
        abort write to protect auth data

    if stale write detected:
        emit_telemetry("tengu_config_stale_write")      // +13850693

    write config atomically via safe-write helper (BTt) // +13849994
    emit_telemetry("tengu_config_fallback_write")       // if fallback path taken
    release lock
```

Analysis basis: CC v2.1.186 bundle.js:+13847130

---

### Lock Acquisition — `acquireConfigLock` (`IQn`)

```
function acquireConfigLock(lockPath):
    ensure parent directory exists (mkdirSync)          // +13850284
    record start = Date.now()                           // +13850329
    loop:
        attempt to create lock file exclusively
        if success: return lock handle
        elapsed = Date.now() - start
        if elapsed > 60000ms:                           // +13851238
            emit_telemetry("tengu_config_lock_contention")
            log("Lock acquisition took longer…")        // +13850468
        wait and retry
    on ENOENT:                                          // +13850823
        recreate missing directory and retry
```

Analysis basis: CC v2.1.186 bundle.js:+13850257

---

### Config Backup Management — `readConfigWithBackup` (`cEe`)

```
function readConfigWithBackup(configPath):
    if not initialised:
        throw Error("Config accessed before allowed.")  // +13852501
    try:
        raw = fs.readFileSync(configPath, "utf-8")      // +13852584
        parsed = JSON.parse(raw)                        // via Bt
    catch parse error:
        emit_telemetry("tengu_config_parse_error")      // +13853132
        locate backup directory ("backups" subdir)      // +13852069
        list backup files; sort by mtime
        keep newest 5                                   // +13851487
        restore from latest backup
    manage backups directory (HGl / _Oo):
        skip entries starting with ".backup."          // +13851354
        on EEXIST during mkdir:                        // +13853346
            continue silently
    copy current config to dated backup (copyFileSync)  // +13853640
    return parsed config
```

Analysis basis: CC v2.1.186 bundle.js:+13852495

---

### Atomic Config Write — `writeFileAtomicWithSymlink` (`BTt`)

```
function writeFileAtomicWithSymlink(filePath, data):
    resolve any existing symlink (readlinkSync)         // +1099131
    generate temp path using randomBytes (hex)          // +1099779 / +1099807
    write data to temp path (writeFileSync)             // +1100220
    apply original file permissions (fchmodSync)        // +1100282
    log: "Applied original permissions to temp file"    // +1100303
    fsync to flush (fsyncSync)                          // +1100429
    rename temp → final path (renameSync)               // +1100638
    if EACCES and b1e.has(path):                        // +1100811
        attempt in-place fallback write
        if failure:
            log: "writeFileSyncAndFlush: in-place fallback write failed…" // +1101593
    on ELOOP / ENOTDIR:                                 // +1099436 / +1099449
        surface error to caller
```

Analysis basis: CC v2.1.186 bundle.js:+1099044

---

### URL Opener — `openUrlInBrowser` (`Jl` → `Nai` → `On`)

```
function openUrlInBrowser(url):
    validate url scheme:                                // oed +3112934
        must start with "http:" or "https:"            // +3112376 / +3112398
        else: throw Error

    if platform == "darwin":                            // +3113064
        spawn: open <url>                              // +3113083
    else:
        use cross-platform open helper (On / $r)       // +3113105
```

Analysis basis: CC v2.1.186 bundle.js:+3112934

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_install_slack_app_clicked` (+11793953) — fired on every invocation |
| Telemetry — config lock | `tengu_config_lock_contention` (+13850557) — fired when lock wait exceeds threshold |
| Telemetry — stale write | `tengu_config_stale_write` (+13850693) — fired when config on disk diverged from cache |
| Telemetry — parse error | `tengu_config_parse_error` (+13853132) — fired when config JSON is malformed |
| Telemetry — auth guard | `tengu_config_auth_loss_prevented` (+13851036) — fired when write is aborted to protect auth tokens |
| Telemetry — fallback write | `tengu_config_fallback_write` (+13850173) — fired when the fallback config write path is used |
| Telemetry — bg/daemon (indirect) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop`, `tengu_bg_attach_legacy_autorespawn`, `tengu_bg_attach`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_stall_respawn`, `tengu_bg_attach_kick`, `tengu_daemon_control` — these are in shared subsystems reachable from the call graph but not directly in the command handler |
| Filesystem | Global config file is read and (potentially) re-written under an exclusive lock; backup copies are maintained in a `backups/` subdirectory |
| Browser | Opens a URL in the system default browser; no in-CLI UI is rendered beyond the status text message |
| supportsNonInteractive | `false` — the command must be run in an interactive session |
| appState changes | None observed at depth-2 traversal |
| Sound | None observed at depth-2 traversal |
| Hook registration | None observed at depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.186 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode** — `supportsNonInteractive: false` means invoking `/install-slack-app` from a script or CI pipeline will fail or be silently ignored.
2. **Expecting a returned URL** — The command does not print or return the installation URL; it opens the browser directly and only outputs the status string `"Opening Slack app installation page in browser…"`.
3. **Concurrent Claude instances holding the config lock** — If another Claude Code process is writing the global config simultaneously, this command may log a lock-contention warning and delay briefly. This is expected behaviour and does not indicate an error in the command itself.
4. **Misinterpreting the auth-loss prevention log** — The warning `"saveGlobalConfig fallback: re-read config is missing auth…"` is a safety guard (GH #3117), not a bug in `/install-slack-app`; it means the write was intentionally skipped to avoid wiping credentials.
5. **Assuming macOS-only** — The URL opener detects `darwin` for the `open` shell command but falls back to a cross-platform launcher on Linux and Windows; the command is not macOS-exclusive.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Tof` | Main async handler for `/install-slack-app` (arbor: `claude-2.1.186::Tof`) |
| `W` | General utility / logger helper called from handler |
| `_n` | `saveGlobalConfig` — persists global config with lock |
| `IQn` | `acquireConfigLock` — exclusive filesystem lock loop |
| `Gt` | Filesystem path resolver / stat helper |
| `RGs` | Config serialiser / merge helper |
| `ERr` | Config error constructor |
| `T` | HTTP / network request helper (used by config and telemetry) |
| `Pvc` | HTTP request builder |
| `De` | JSON serialiser wrapper |
| `Lc` | URL / path string sanitiser |
| `eze` | Config schema validator |
| `Fvc` | HTTP socket / connection manager |
| `mn` | Logger / debug emitter |
| `cEe` | `readConfigWithBackup` — reads config, manages backup copies |
| `Bt` | Safe JSON parser wrapper |
| `i9` | String prefix-strip utility |
| `HGl` | Backup directory walker |
| `_Oo` | Path join + sort helper for backup entries |
| `f` | Daemon/background session manager |
| `EHt` | Config environment helper |
| `n` | String normaliser (toLowerCase) |
| `I` | Scroll / input event handler (UI layer) |
| `x` | Terminal supervisor write handler |
| `A` | Bounded integer clamp utility |
| `H` | IPC / socket read buffer handler |
| `g` | Socket timeout scheduler |
| `m` | Session kill helper |
| `fp` | Socket end-and-flush helper |
| `bYf` | Background session message dispatcher |
| `Ae` | String coercion helper |
| `BTt` | `writeFileAtomicWithSymlink` — safe atomic config writer |
| `Fd` | Real-path resolver |
| `u` | Daemon state machine |
| `kn` | Error code logger |
| `l7e` | Extended error code handler (EINVAL / ENOTSUP / EPERM / ENOSYS) |
| `fDe` | Config directory initialiser |
| `hOo` | Object-entries config iterator |
| `TKt` | Timestamp utility (`Date.now` wrapper) |
| `TQn` | Config fallback write path |
| `Pe` | Promise-based retry helper |
| `KVe` | Retry back-off scheduler |
| `Jl` | `openUrlInBrowser` — top-level URL open dispatcher |
| `oed` | URL scheme validator (http/https guard) |
| `Nai` | Platform-aware URL-open selector |
| `g_` | Platform detection utility |
| `On` | Cross-platform open-URL executor |
| `$r` | Shell-spawn wrapper for `open` / `xdg-open` |
| `Ot` | Process spawn abstraction |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.