---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.162"
updated: "2026-06-04"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.162 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.162 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.162

---

## Overview

`/install-slack-app` is a local slash command that opens the Claude Slack app installation page in the user's default browser. It emits a telemetry event to record user intent, then delegates to a platform-aware URL-opener utility that selects the appropriate system command (`open`, `xdg-open`, `rundll32`, etc.) based on the detected operating system.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| loc_byte | `11583339` |
| loc_byte_end | `11583525` |
| loc_line | `8020` |
| supportsNonInteractive | `false` |
| module_id | `WFq` |
| load_inline | `true` |
| arbor_handler.name | `SJf` |
| arbor_handler.fqn | `claude-2.1.162::SJf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.162 bundle.js:+11583339

---

## Input Branching

This command accepts no structured user input and follows a nearly linear flow. The only branching occurs inside the platform-aware URL opener (`bK` → `C8`) and the OS-detection step. Two distinct OS branches exist (`darwin`/`win32` vs. Linux/other), so pseudocode is sufficient.

```
1. User invokes /install-slack-app
2. Handler (SJf) runs:
   a. Emit telemetry: tengu_install_slack_app_clicked
   b. Print status text: "Opening Slack app installation page in browser…"
   c. Call URL-opener with the installation URL
      i.  Detect current OS platform
      ii. If macOS  → spawn `open <url>`
          If Windows → spawn `rundll32 url,OpenURL <url>`
          Otherwise  → spawn `xdg-open <url>`
   d. Return; command completes
```

Analysis basis: CC v2.1.162 bundle.js:+11582943, +11582983, +11583058, +11583078, +11583091

---

## Behavioral Spec

### Handler Entry Point — `installSlackAppHandler` (`SJf`)

The Arbor symbol graph resolved this handler via `module_id` → `WFq`.

```
async function installSlackAppHandler(context):
    emitTelemetry("tengu_install_slack_app_clicked")   // +11582945
    printToTerminal({
        type: "text",                                   // +11583078
        text: "Opening Slack app installation page in browser…"  // +11583091
    })
    await openUrlInBrowser(installationUrl)             // +11583058
    return
```

Analysis basis: CC v2.1.162 bundle.js:+11582943

---

### Config-Locking Sub-System — `configWriteWithLock` (`G8` → `jj_`)

`installSlackAppHandler` calls `configAccessor` (`c`) and `configWriter` (`G8`) as infrastructure helpers. The config writer applies a file-system lock before persisting any state changes. Although this command does not explicitly modify user config, the shared config subsystem is initialised on every command invocation.

```
async function configWriteWithLock(configPath, updaterFn):
    acquireLock(configPath)                         // jj_ → L.mkdirSync, Date.now
    if lock took too long:
        emitTelemetry("tengu_config_lock_contention")  // +3254559
        log("error", "Lock acquisition took longer than expected…")
    try:
        currentConfig = readConfigFromDisk(configPath) // DYH → q.readFileSync
        if staleWriteDetected(currentConfig):
            emitTelemetry("tengu_config_stale_write")  // +3254695
        if authLossPrevented(currentConfig):
            emitTelemetry("tengu_config_auth_loss_prevented")  // +3255038
            log("saveConfigWithLock: re-read config is missing auth…")
            return
        updatedConfig = updaterFn(currentConfig)
        writeConfigToDisk(configPath, updatedConfig)
    finally:
        releaseLock(configPath)
```

Analysis basis: CC v2.1.162 bundle.js:+3251373, +3254470, +3254559, +3254695, +3255038

Lock-related literals observed:
- Warning message: `"Lock acquisition took longer than expected - another Claude instance may be running"` (bundle.js:+3254470)
- Auth-loss guard message: `"saveConfigWithLock: re-read config is missing auth that cache has; refusing to write to avoid wiping ~/.claude.json. See GH #3117."` (bundle.js:+3254886)
- Config-parse guard: `"Config accessed before allowed."` (bundle.js:+3256503)
- Backup rotation keeps up to **5** backup files (bundle.js:+3255489)
- Backup directory name: `"backups"` (bundle.js:+3256071)
- Backup file marker: `".backup."` (bundle.js:+3255356)
- Lock-write timeout: **60 000 ms** (bundle.js:+3255240)
- File permission octal **384** (0o600) applied to new config files (bundle.js:+3255771)

---

### Platform-Aware URL Opener — `openUrlInBrowser` (`bK` → `C8`)

```
async function openUrlInBrowser(url):
    validateUrlScheme(url)           // p$7: rejects non-http/https urls
    // Permitted schemes: "http:" or "https:"  (+6778258, +6778280)

    platform = detectOS()
    if platform == "darwin":         // +6778567
        spawn("open", [url])
    else if platform == "win32":     // +6778583
        spawn("rundll32", ["url,OpenURL", url])   // +6778667, +6778679
    else:
        spawn("xdg-open", [url])     // +6778748

    await spawnCompletion()
```

Analysis basis: CC v2.1.162 bundle.js:+6778495, +6778508, +6778616

---

### HTTP Bootstrap Fetch — `bootstrapFetch` (`H`, called from `v`)

Used internally by the config subsystem's HTTP layer. Not directly surfaced to the user.

```
async function bootstrapFetch(endpoint, options):
    log("[Bootstrap] Fetching", endpoint)           // +15590993
    response = await fetch(endpoint, {
        headers: {
            "Content-Type": "application/json",     // +15591078, +15591093
            "User-Agent": <agent-string>            // +15591112
        },
        timeout: 5000                               // +15591194
    })
    emitTelemetry("api_bootstrap_fetch")            // +15591315
    if parseFailed:
        emitTelemetry("api_bootstrap_fetch", { result: "parse_failed" })  // +15591337
    else:
        log("[Bootstrap] Fetch ok")                 // +15591367
    return response
```

Analysis basis: CC v2.1.162 bundle.js:+15590991

---

### Atomic Config File Writer — `atomicFileWrite` (`u56`)

Provides atomic write semantics via a temp file + `fsync` + `rename` pattern.

```
function atomicFileWrite(targetPath, content):
    tempPath = targetPath + "." + randomBytes(6).toString("hex")  // +1055389, +1055417
    fd = fs.openSync(tempPath, flags)
    fs.writeFileSync(fd, content)                  // +1055825
    fs.fchmodSync(fd, originalPermissions)         // +1055883; log "Applied original permissions to temp file"
    fs.fsyncSync(fd)                               // +1055949
    fs.closeSync(fd)
    if isSymbolicLink(targetPath):
        resolvedTarget = resolveSymlink(targetPath)
    fs.renameSync(tempPath, resolvedTarget)         // +1056077
    // On ELOOP/ENOTDIR errors: abort and unlink temp  (+1055046, +1055059)
```

Analysis basis: CC v2.1.162 bundle.js:+1054673, +1055825, +1055949, +1056077

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_install_slack_app_clicked` (bundle.js:+11582945) — fired immediately on invocation |
| Telemetry — config lock | `tengu_config_lock_contention` (+3254559), `tengu_config_stale_write` (+3254695), `tengu_config_auth_loss_prevented` (+3255038), `tengu_config_parse_error` (+3257134) |
| Telemetry — background daemon | `tengu_bg_dispatch_sigkill_escalate` (+15996373), `tengu_bg_dispatch_low_mem` (+15996974), `tengu_bg_spare_enable` (+15997678), `tengu_bg_spare_claim` (+15997806), `tengu_bg_spare_claim_fail` (+15998072) |
| Telemetry — daemon control | `tengu_daemon_control` (+16032559), `tengu_daemon_config_reload` (+16011003) |
| Terminal output | Prints `"Opening Slack app installation page in browser…"` (type `"text"`) before spawning the browser process (bundle.js:+11583091) |
| Browser side-effect | Spawns OS-native URL handler (`open` / `rundll32` / `xdg-open`) pointing to the Slack app installation page |
| Config file writes | Potentially none for this command specifically; the config lock subsystem is initialised but only writes if an updater function mutates state |
| supportsNonInteractive | `false` — command must not be invoked in non-interactive (pipe/CI) mode |
| Hook registration | None observed in depth-2 traversal |
| Sound | None observed in depth-2 traversal |
| appState changes | None observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.162 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `supportsNonInteractive` is `false`. Invoking this command in a CI pipeline or non-TTY context will fail or produce undefined behaviour.
2. **No browser installed on headless Linux**: The command unconditionally calls `xdg-open` on non-macOS/non-Windows platforms. Headless servers without a desktop environment will produce a spawn error.
3. **Non-http(s) URL assumption**: The URL validator (`p$7`) strictly checks for `http:` or `https:` scheme. Any future internal URL configuration that omits the scheme will cause an immediate error before the browser is opened.
4. **Expecting config to be written**: This command does not modify user configuration. Do not expect `~/.claude.json` to change after running it.
5. **Lock timeout misread**: The 60 000 ms lock timeout (bundle.js:+3255240) belongs to the shared config subsystem, not to this command's browser-open operation. A slow lock does not mean the browser open is hanging.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `SJf` | Main handler for `/install-slack-app` (AsyncFunction, resolved via module_id `WFq`) |
| `c` | Config accessor / reader utility |
| `G8` | Config writer with file-system lock |
| `jj_` | Lock acquisition and config-file rotation logic |
| `_` | File-system abstraction (lstat, readdirStringSync, etc.) |
| `i6` | Path existence / stat check helper |
| `L` | FS wrapper managing temp-file lifecycle (mkdirSync, statSync, copyFileSync, unlinkSync, readdirStringSync) |
| `q` | Secondary FS wrapper (readFileSync, statSync, mkdirSync, readdirStringSync, copyFileSync, unlinkSync, renameSync) |
| `f` | File-handle / stream finaliser (close, finally-block cleanup) |
| `Pj1` | Config object merger / Object.assign wrapper |
| `zf_` | Sub-config initialiser called by merger |
| `v` | HTTP request builder / fetch wrapper |
| `PgK` | HTTP response parser |
| `H` | Bootstrap fetch handler (logs `[Bootstrap] Fetching`) |
| `SH` | JSON serialiser wrapper (JSON.stringify) |
| `V4` | URL/header redaction utility (replaces sensitive values with `[REDACTED]`) |
| `WpH` | Request payload formatter |
| `EgK` | Chunked upload / streaming write handler |
| `V8` | Generic error constructor / error-type checker |
| `DYH` | Config file reader with parse-error guard |
| `p6` | JSON parse wrapper |
| `Zx` | String prefix stripper (startsWith + slice) |
| `$n1` | Config backup directory scanner |
| `Xj_` | Path join helper (bY.join + s8) |
| `w` | Background daemon session manager |
| `Xw6` | Auth-loss detection helper used by config writer |
| `A` | Lowercase normaliser / Map-backed store |
| `V` | Directory entry filter (startsWith check) |
| `P` | Terminal / editor pager (NFC normalise, slice, execute) |
| `j` | Daemon process wrapper |
| `J` | Process kill helper (A.values + k.kill) |
| `z` | Daemon stop controller (hH, RH, Kh, jp) |
| `D` | Supervisor write/config-reload handler |
| `h` | Focus/blur idle timer (blurred, focused, 3 600 000 ms timeout) |
| `YMA` | Vim-mode state-machine dispatcher |
| `C` | Rate-limit event enqueuer (randomUUID, enqueue) |
| `Z` | Daemon lifecycle controller (stop, updateConfig, start) |
| `u56` | Atomic file writer (temp + fsync + rename) |
| `O` | Symbolic-link stat checker |
| `R8` | Error-type assertion helper |
| `bcH` | Config header / metadata builder |
| `Mn1` | Object.entries iterator for config map |
| `s18` | Timestamp recorder (Date.now) |
| `Jj_` | Config symlink-aware write path |
| `bK` | URL-opener dispatcher (platform detection → spawn) |
| `p$7` | URL scheme validator (rejects non-http/https) |
| `bD` | Spawn options builder for URL opener |
| `C8` | OS-specific browser-open command selector |
| `C_` | Top-level CLI runner / process lifecycle manager |
| `wTH` | CLI argument parser and sub-command router |
| `Y` | Forced-shutdown handler (process.exit + z.abort) |
| `oP4` | String coercion helper |
| `q$` | Config path resolver |
| `kH` | Error logger (Dr.logError + zBH.push) |
| `x6` | Async-local-store context reader |
| `RQ6` | Store getter (SQ6.getStore) |
| `X_` | Module namespace resolver (Nv) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.