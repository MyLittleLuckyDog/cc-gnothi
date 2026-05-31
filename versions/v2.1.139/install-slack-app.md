---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.139"
updated: "2026-05-31"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.139 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.139 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.139

---

## Overview

The `/install-slack-app` command opens the Claude Slack app installation page in the user's default browser. It is a thin, non-interactive local command: it fires a telemetry event, emits a status message to the terminal, and delegates to the platform-specific URL-open subsystem. No agent round-trip is involved.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `PKq` |
| load_inline | `true` |
| loc_byte | `10550885` |
| loc_byte_end | `10551071` |
| loc_line | `6414` |
| arbor_handler.name | `e37` |
| arbor_handler.fqn | `claude-2.1.139::e37` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.139 bundle.js:+10550885

---

## Input Branching

The command has a simple linear flow with no user-input-driven branching. The only platform-dependent fork (Windows / macOS / Linux URL opener) happens inside the URL-open helper (`iq` → `Tk4`/`O8`). Two distinct paths exist in the URL-open layer, so a numbered list is sufficient.

1. Handler (`e37`) is invoked — no arguments are consumed from the CLI input.
2. Telemetry event `tengu_install_slack_app_clicked` is emitted immediately.
3. The URL-open helper is called with the Slack app installation URL.
4. A text response `"Opening Slack app installation page in browser…"` is returned to the terminal.

---

## Behavioral Spec

### Main Handler

```
async function installSlackAppHandler(context):
    emit_telemetry("tengu_install_slack_app_clicked")   // bundle.js:+10550491
    recordEvent(context)                                 // calls Q  (+10550489)
    saveConfigWithLock(context)                          // calls H8 (+10550529)
    openUrl(SLACK_INSTALL_URL)                           // calls iq (+10550604)
    return { type: "text",                               // +10550624
             content: "Opening Slack app installation page in browser…" }  // +10550637
```

Analysis basis: CC v2.1.139 bundle.js:+10550489–10550637

### URL-Open Subsystem (`iq`)

```
function openUrl(url):
    if url.startsWith("http:") or url.startsWith("https:"):  // Tk4 guard +7432639/+7432661
        pass  // safe to proceed
    else:
        throw Error("invalid URL scheme")           // Tk4 +7432589

    platform = process.platform
    if platform == "darwin":                        // +7432911
        spawn("open", [url])                        // +7433085
    elif platform == "win32":                       // +7432927
        spawn("rundll32", ["url,OpenURL", url])     // +7433011/+7433023
    else:  // Linux / other
        spawn("xdg-open", [url])                    // +7433092
```

Analysis basis: CC v2.1.139 bundle.js:+7432876, +7432960

### Config-Lock Writer (`H8` → `c8_`)

The config-persistence layer is invoked as a side effect. Key behaviors observed in the call graph:

```
async function saveConfigWithLock(context):
    acquireLock()                      // c8_ +3129842
    if lockWaitedTooLong:
        emit_telemetry("tengu_config_lock_contention")   // +3132840
        log("error", "Lock acquisition took longer than expected"
                     " - another Claude instance may be running")  // +3132751

    reReadConfig = readConfigFromDisk()            // cfH +3130023
    if reReadConfig missing auth that inMemoryCache has:
        emit_telemetry("tengu_config_auth_loss_prevented")  // +3133319
        log("saveGlobalConfig fallback: re-read config is missing auth …")
        return  // refuse write, see GH #3117      // +3130049

    if saveConfigWithLock re-read also missing auth:
        emit_telemetry("tengu_config_stale_write") // +3132976
        log("saveConfigWithLock: re-read config is missing auth …")  // +3133167

    writeConfigSafely(newConfig)    // dSH atomic write path +3134010
    releaseLock()
```

Analysis basis: CC v2.1.139 bundle.js:+3129842, +3132540, +3132840, +3133167

### Atomic File Writer (`dSH`)

```
function atomicWriteFile(path, data):
    lstat(path) to detect symbolic links      // +988148
    if symlink:
        resolve real target path              // readlinkSync +987753, resolve +987792
    randomBytes(6).toString("hex") → suffix   // +988378, +988406
    tempPath = path + "." + suffix
    fd = openSync(tempPath, flags)            // +987912
    writeFileSync(fd, data)                   // +988814
    fchmodSync(fd, originalMode)              // +988872  (preserves permissions)
    log("Applied original permissions to temp file")  // +988893
    fsyncSync(fd)                             // +988938
    closeSync(fd)                             // +987899
    renameSync(tempPath, path)                // +989066  (atomic replace)
    if error ELOOP or ENOTDIR:               // +988039/+988052
        handle symlink loop / type mismatch
    unlinkSync(tempPath) on failure           // +989223
```

Analysis basis: CC v2.1.139 bundle.js:+987753–989223

### Config Backup Management (`cfH` → `Z09`)

When writing configuration, older backups are rotated:

```
function rotateConfigBackups(configDir):
    backupDir = join(configDir, "backups")     // +3134352
    entries = readdirStringSync(backupDir)
    entries filtered to those starting with basename  // +3134460
    sorted by name / timestamp
    keep only most recent 5 backups            // literal 5 at +3133770
    for each excess entry:
        unlinkSync(entry)
    copyFileSync(currentConfig, newBackupPath
                 using Date.now() timestamp)   // +3135911, +3135929
```

Analysis basis: CC v2.1.139 bundle.js:+3134385, +3134825, +3135600

### Background Session Helper Context (`Y`, `w`)

The call graph reaches background-session management utilities at depth 2. These are shared infrastructure, not install-slack-app–specific logic, but notable constants observed:

- SIGKILL escalation delay: 30 s / 15 s windows (literals +14310542 / +14310553)
- Low-memory threshold: 1024 (units: MB, literal +14311060)
- Spare session lifecycle events emitted: `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_spare_spawn`

These are side-effect infrastructure triggered by the shared config/session layer, not by the install-slack-app command itself.

Analysis basis: CC v2.1.139 bundle.js:+14310364–14312224

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry (command-specific) | `tengu_install_slack_app_clicked` (bundle.js:+10550491) |
| Telemetry (config layer) | `tengu_config_lock_contention` (+3132840), `tengu_config_stale_write` (+3132976), `tengu_config_parse_error` (+3135421), `tengu_config_auth_loss_prevented` (+3133319) |
| Telemetry (bg session infra) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_spare_spawn` |
| Browser side effect | Opens Slack app installation URL in default OS browser via platform-specific command (`open` / `rundll32` / `xdg-open`) |
| Config file write | Persists updated config to disk via atomic rename; rotates backups in `backups/` subdirectory |
| Config backup limit | Maximum 5 backup files retained (bundle.js:+3133770) |
| Output to terminal | Single text message: `"Opening Slack app installation page in browser…"` (+10550637) |
| supportsNonInteractive | `false` — must be run in an interactive session |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.139 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `supportsNonInteractive` is `false`; invoking `/install-slack-app` from a script or headless pipeline will fail or be silently skipped.
2. **Expecting a browser to open on a remote SSH session**: The URL-open helpers (`open`, `rundll32`, `xdg-open`) target the local display environment. On a headless remote machine the spawn will fail silently or produce an error.
3. **Passing arguments**: The command takes no arguments. Any trailing text on the command line is ignored — the handler does not consume CLI input.
4. **Interpreting the terminal message as confirmation**: The message `"Opening Slack app installation page in browser…"` is emitted before the browser process exits. A browser failure (e.g., no default browser configured) will not surface an error in the Claude Code terminal.
5. **Confusing config-write errors with command failure**: The config-lock layer (called as a side effect) can log warnings about stale writes or auth-loss prevention (GH #3117). These are infrastructure warnings unrelated to Slack app installation success.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `e37` | Main async handler for `/install-slack-app` (arbor_handler) |
| `Q` | Event/telemetry recorder called at command entry |
| `H8` | Config-save-with-lock top-level function |
| `c8_` | Inner config lock acquisition and write logic |
| `_` | Filesystem primitive (used for readdirStringSync, statSync) |
| `B6` | Path/config utilities shared across config layer |
| `L` | Filesystem module reference (mkdirSync, statSync, readdirStringSync, etc.) |
| `q` | Secondary filesystem module (readFileSync, statSync, mkdirSync, etc.) |
| `f` | Async handle / finalizer used in lock cleanup |
| `ioA` | Config object initializer / merger |
| `tl8` | Config default-value populator |
| `N` | HTTP request dispatcher (used for config/API calls) |
| `y9K` | HTTP response parser |
| `H` | Retry/jitter helper (uses Math.random + setTimeout) |
| `yH` | JSON serializer wrapper |
| `LM` | URL/header builder for HTTP requests |
| `QyH` | String sanitizer used in HTTP layer |
| `R9K` | HTTP send / write implementation |
| `w8` | Logging / debug emit utility |
| `cfH` | Config file reader and backup rotator |
| `U6` | JSON parse wrapper |
| `cS` | String prefix-strip utility |
| `Z09` | Backup directory scanner and pruner |
| `LH` | Structured logger (logError, push to log ring) |
| `l8_` | Backup file path builder |
| `w` | Background session manager / dispatcher |
| `w46` | Config cache accessor |
| `A` | Map-based process/session registry |
| `Z` | Iterable with startsWith check (config key filter) |
| `X` | MCP/SDK connection manager |
| `U08` | MCP transport initializer |
| `q_` | Error factory with code field |
| `V` | Array slice helper (backup trimming) |
| `dSH` | Atomic file write implementation (temp + rename) |
| `O` | fs.Stats wrapper (isSymbolicLink check) |
| `D8` | Debug log wrapper |
| `suH` | Config schema validator |
| `E09` | Object.entries iteration helper |
| `tuH` | Timestamp helper (Date.now based) |
| `d8_` | Single-file config writer (non-lock path) |
| `iq` | URL-open orchestrator (platform dispatch) |
| `Tk4` | URL scheme validator (http/https guard) |
| `O8` | Browser/process spawn wrapper |
| `$_` | Agent/session runner |
| `$PH` | Agent API client builder |
| `Y` | Background session pool manager |
| `_ZK` | String conversion helper |
| `C6` | Async-local-storage context reader |
| `ry6` | Store getter for request context |
| `A_` | Context finalizer / cleanup |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.