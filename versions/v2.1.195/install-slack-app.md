---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.195"
updated: "2026-06-27"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.195 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.195 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.195

---

## Overview

`/install-slack-app` is a local slash command that, when invoked, fires a telemetry event and opens the Claude Slack app installation page in the system's default browser. It is a lightweight, non-interactive action command: no user input is required and no conversation turn is produced — the command simply launches a URL and prints a status message to the terminal.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| loc_byte | `11965753` |
| loc_byte_end | `11965939` |
| loc_line | `8164` |
| supportsNonInteractive | `false` |
| module_id | `U2l` |
| load_inline | `true` |
| arbor_handler.name | `DNf` |
| arbor_handler.fqn | `claude-2.1.195::DNf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.195 bundle.js:+11965753

The registration block spans bytes `(11965753, 11965939)`. The handler was resolved by Arbor via the `module_id` path: module `U2l` → moduleExports → `DNf`. The handler is an `AsyncFunction`, consistent with the async browser-open and config-lock operations described below.

---

## Input Branching

The command has a simple, nearly-linear flow (two meaningful branches: successful browser open vs. error) with a status message always emitted. Numbered pseudocode is used.

```
1. User invokes /install-slack-app
2. Handler (slackAppInstaller) fires telemetry event: tengu_install_slack_app_clicked
3. Call openUrl(url) to open the Slack app installation URL in the system browser
4. Call saveGlobalConfig(options) to persist any required config state
   4a. Acquire config file lock (with contention detection)
   4b. If lock contention exceeds threshold → log warning:
       "Lock acquisition took longer than expected - another Claude instance may be running"
       emit telemetry: tengu_config_lock_contention
   4c. Re-read config from disk under lock
       - On parse error → emit tengu_config_parse_error; auto-repair from cache
         emit telemetry: tengu_config_auto_repaired
       - If auth data would be lost → refuse write, emit tengu_config_auth_loss_prevented
   4d. If stale write detected → emit tengu_config_stale_write
   4e. Write config atomically (temp file → fsync → rename), fallback write on EACCES
       emit telemetry: tengu_config_fallback_write (fallback path only)
   4f. Release lock
5. Print status text: "Opening Slack app installation page in browser…"
6. Return result with type "text" containing the status message
```

Analysis basis: CC v2.1.195 bundle.js:+11965357 (openUrl call), +11965397 (saveGlobalConfig call), +11965505 (status string literal)

---

## Behavioral Spec

### Top-level Handler — `slackAppInstaller` (`DNf`)

```
async function slackAppInstaller(context):
    emit telemetry("tengu_install_slack_app_clicked")      // +11965359
    await openUrl(slackAppInstallUrl)                       // +11965357
    await saveGlobalConfigWithLock(configOptions)           // +11965397
    await outputResult(context, {
        type: "text",                                       // +11965492
        content: "Opening Slack app installation page in browser…"  // +11965505
    })
    await processOutput(outputResult)                       // +11965472
```

Analysis basis: CC v2.1.195 bundle.js:+11965357

The handler calls two primary functions before returning output: the URL opener (`openUrl`, identifier `W`) and the global config save routine (`saveGlobalConfig`, identifier `gn`).

---

### Sub-feature: URL Opening — `openUrl` (`W`)

```
function openUrl(url):
    validate url scheme is "http:" or "https:"             // +3139467, +3139489
    if error → throw Error                                  // +3139417
    if platform is "darwin":                               // +3140721
        spawn("open", [url])                               // +3140740
    else:
        use platform-appropriate open command
    return
```

Analysis basis: CC v2.1.195 bundle.js:+3140591

The URL opener (`vRd`) validates the URL protocol before delegating to the OS shell command. On macOS, the `open` command is used (literal `"open"` at +3140740). The URL itself is not present in the depth-2 traversal literals but is passed as a constant from the registration context.

---

### Sub-feature: Platform Browser Launch — `platformOpen` (`$Ci`)

```
function platformOpen(url, options):
    resolve handler for current OS                          // +3140604
    call filePathResolver(url)                             // +3140662
    call configManager(options)                            // +3140762
    spawn OS-level open subprocess
```

Analysis basis: CC v2.1.195 bundle.js:+3140604

---

### Sub-feature: Global Config Save with Lock — `saveGlobalConfig` (`gn`)

```
async function saveGlobalConfig(options):
    acquire config lock via lockFile()                     // via xZt, +14065836
    build config directory path                            // +14068656
    call atomicConfigWrite()                               // +14068708
    emit log entry for save operation                      // +14066283 ("save_global")
    if re-read auth is missing from cache:
        log warning: "saveGlobalConfig fallback: re-read config is missing auth..." // +14066037
        emit tengu_config_auth_loss_prevented
        return without writing
    call writeConfigLocked()                               // +14065953
    handle stale write detection                           // +14066018
    release lock
```

Analysis basis: CC v2.1.195 bundle.js:+14065840

---

### Sub-feature: Config Lock Acquisition — `acquireConfigLock` (`xZt`)

```
async function acquireConfigLock(configPath):
    resolve directory via path.dirname()                    // +14068977
    call mkdirSync() to ensure lock dir exists             // +14068998
    record start timestamp: Date.now()                     // +14069043
    attempt to create lock file (exclusive)                // via Osi
    if lock held by another process:
        check elapsed time against timeout (60000 ms)      // +14070320
        if elapsed > threshold:
            emit log "error": "Lock acquisition took longer..."  // +14069182
            emit tengu_config_lock_contention              // +14069271
    poll until lock acquired or timeout
    on ENOENT during poll → retry                          // +14069537
    call statSync() to verify lock                         // +14069347
    call configFileReader() on locked path                 // via on, +14069529
```

Analysis basis: CC v2.1.195 bundle.js:+14068971

Lock contention warning string: `"Lock acquisition took longer than expected - another Claude instance may be running"` (+14069182). Lock timeout: 60 000 ms (+14070320).

---

### Sub-feature: Config File Read and Repair — `readConfigLocked` (`oTt`)

```
function readConfigLocked(configPath):
    if configPath missing → throw Error("Config accessed before allowed.")  // +14071590
    read file with encoding "utf-8"                         // +14071673
    parse JSON via jsonParse()                             // +14071693
    if parse fails:
        emit tengu_config_parse_error                      // +14073004
        emit tengu_config_auto_repaired                    // (repair path)
        restore from backup directory                      // "backups" +14071158
    scan directory for backup files                        // via Ojo
    copy latest valid backup to restore                    // Date.now() +14072573
    emit tengu_config_parse_error on persistent failure    // +14073004
    return parsed config object
```

Analysis basis: CC v2.1.195 bundle.js:+14071584

The parse error message `"Config accessed before allowed."` (+14071590) indicates a guard against premature config access before initialization completes.

---

### Sub-feature: Atomic Config Write — `atomicConfigWrite` (`aRt`)

```
function atomicConfigWrite(configPath, data):
    resolve symlinks via readlinkSync + path.resolve       // +1103143, +1103182
    handle ELOOP / ENOTDIR errors gracefully               // +1103448, +1103461
    generate random temp file path via randomBytes         // +1103791
    open temp file for writing (O_WRONLY | O_CREAT)        // mode 384 (0o600) +14070857
    write data to temp file                                // +1104239
    apply original file permissions to temp file           // "Applied original permissions..." +1104322
    if platform supports fchmod: fchmodSync(fd, mode)      // +1104301
    fsyncSync(fd) to flush to disk                         // +1104448
    renameSync(tempPath, configPath)                       // +1104779
    on EACCES → in-place fallback write                    // +1104952
        emit warning: "writeFileSyncAndFlush: in-place fallback write failed..." +1105734
    if backup tracking set has entry: skip re-backup       // +1104929
    unlinkSync old backups beyond limit (keep 5)           // +14070575
```

Analysis basis: CC v2.1.195 bundle.js:+1103056

File mode `384` decimal = octal `0o600` (owner read/write only) is applied to the temp file (+14070857). Up to 5 backup copies are retained (+14070575). Backup filenames use the `.backup.` infix (+14070436).

---

### Sub-feature: Output Rendering — `renderOutput` (`ac`)

```
async function renderOutput(context, result):
    call outputValidator(result)                           // vRd, +3140591
    call outputRenderer(result, context)                  // $Ci, +3140604
    return rendered text to CLI
```

Analysis basis: CC v2.1.195 bundle.js:+11965472

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_install_slack_app_clicked` | Fired immediately when command is invoked (+11965359) |
| Telemetry: `tengu_config_lock_contention` | Fired when another Claude process is holding the config lock too long (+14069271) |
| Telemetry: `tengu_config_stale_write` | Fired when a stale-write condition is detected during config save (+14069407) |
| Telemetry: `tengu_config_parse_error` | Fired when the config JSON fails to parse (+14073004) |
| Telemetry: `tengu_config_auto_repaired` | Fired when config is automatically restored from a backup (+14069784) |
| Telemetry: `tengu_config_auth_loss_prevented` | Fired when a write is refused to protect existing auth data (+14070114) |
| Telemetry: `tengu_config_fallback_write` | Fired when atomic rename fails and in-place fallback write is used (+14068887) |
| Telemetry: `tengu_daemon_control` | Fired by daemon-lifecycle utility reached in call graph (+17924594) |
| Browser launch | Opens Slack app installation URL in OS default browser; uses `open` on macOS (+3140740) |
| Config file write | Atomic write to global config (`~/.claude.json`) with fsync and rename; temp file at mode `0o600` (+14070857) |
| Config backups | Backup files created in `backups/` subdirectory with `.backup.` infix; maximum 5 retained (+14070575) |
| appState changes | No direct appState mutation observed in depth-2 traversal |
| Hook registration | None observed |
| Sound | None observed |
| Non-interactive support | `supportsNonInteractive: false` — command must be run in an interactive session |

---

## Version History

| Version | Change |
|---|---|
| v2.1.195 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `supportsNonInteractive` is `false`. Attempting to invoke `/install-slack-app` from a script or CI pipeline (e.g., via `--print` mode) will not work as expected.
2. **Expecting a conversation response**: This command does not submit a prompt to Claude. It simply opens a browser URL and prints a one-line status. No AI turn is generated.
3. **Concurrent Claude instances blocking the command**: The config save step acquires a file lock. If another Claude process is running and holding that lock for more than 60 000 ms, the command will log a contention warning and may be delayed. Close other Claude sessions before invoking if you observe hangs.
4. **Assuming the Slack URL is configurable**: The installation URL is a compile-time constant embedded in the handler. It cannot be overridden via flags or environment variables.
5. **Mistaking the terminal message for completion**: The string `"Opening Slack app installation page in browser…"` is printed immediately upon invocation, before the browser window fully loads. The actual installation must be completed in the browser.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `DNf` | Top-level handler for `/install-slack-app` (`slackAppInstaller`); AsyncFunction resolved via Arbor `module_id` path |
| `W` | URL opener utility (`openUrl`) |
| `gn` | Global config save orchestrator (`saveGlobalConfig`) |
| `xZt` | Config lock acquisition and release (`acquireConfigLock`) |
| `Osi` | Lock file creation helper |
| `I3r` | Lock file inner utility (called by `Osi`) |
| `oTt` | Config file reader with parse-error repair (`readConfigLocked`) |
| `Ojo` | Directory scanner for backup files |
| `Ujo` | Backup path resolver |
| `aRt` | Atomic config file writer (`atomicConfigWrite`) |
| `Gd` | Symlink resolution helper |
| `Cn` | Error-wrapper utility used in lock path |
| `ZZe` | fsync error classifier (filters EINVAL, ENOTSUP, EPERM, ENOSYS) |
| `lAs` | File property definer utility |
| `vZt` | Config read-and-lock combinator |
| `wZt` | Timestamp utility (`Date.now` wrapper) used during config save |
| `Djo` | Config entries enumerator (`Object.entries` wrapper) |
| `Mcr` | Config write helper with fallback logic (`writeConfigLocked`) |
| `sUe` | Config state helper called during global save |
| `sTt` | Stale-write detection helper |
| `ac` | Output rendering dispatcher |
| `vRd` | Output/URL validator |
| `$Ci` | Platform-specific browser/output launcher |
| `fH` | Platform resolver sub-utility |
| `Mn` | Config manager accessed during output |
| `Wr` | Config writer inner layer |
| `Ot` | Config persistence sub-utility |
| `T` | HTTP request or logging utility (shared across call graph) |
| `RYc` | HTTP header builder |
| `Me` | JSON serializer wrapper |
| `Lc` | Path/string sanitizer (redacts sensitive fields) |
| `jXe` | Argument sanitizer sub-utility |
| `PYc` | HTTP send / response handler |
| `on` | Error normalizer / logger |
| `Bt` | JSON parse wrapper |
| `v5` | String prefix stripper |
| `m` | Array filter utility |
| `n` | String lowercaser utility |
| `dVe` | TeammateMailbox message-read helper |
| `I` | Slice/pagination utility |
| `M` | OAuth / gateway HTTP router |
| `A` | OAuth userinfo fetcher |
| `u` | Daemon lifecycle sub-utility |
| `Oe` | React/UI component wrapper |
| `OJe` | UI primitive |