---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.143"
updated: "2026-06-01"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.143 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.143 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.143

---

## Overview

`/install-slack-app` is a local slash command that opens the Slack app installation page in the user's default browser. It fires a telemetry event, emits a status message, and then delegates to the platform-aware URL-open helper to launch the installation flow. No agent conversation is required; the command completes after dispatching the browser open.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | Install the Claude Slack app |
| supportsNonInteractive | `false` |
| module_id | `uMq` |
| load_inline | `true` |
| loc_byte | `10722310` |
| loc_byte_end | `10722496` |
| loc_line | `6465` |
| arbor_handler.name | `lP7` |
| arbor_handler.fqn | `claude-2.1.143::lP7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.143 bundle.js:+10722310

---

## Input Branching

The command has a simple linear flow (no user argument branching), so numbered pseudocode is used below. The only conditional is internal to the URL-open helper (`openUrl`), which selects a platform-specific launcher.

```
1. User invokes /install-slack-app
2. Fire telemetry: tengu_install_slack_app_clicked
3. Emit text message: "Opening Slack app installation page in browser…"
4. Call openUrl(installationUrl)
   4a. If darwin  → spawn "open <url>"
   4b. If win32   → spawn "rundll32 url,OpenURL <url>"
   4c. Otherwise  → spawn "xdg-open <url>"
5. Return (command complete)
```

---

## Behavioral Spec

### Top-level handler (`lP7`)

Analysis basis: CC v2.1.143 bundle.js:+10721914

```
async function installSlackAppHandler(context):
    // Step 1 — telemetry
    recordEvent("tengu_install_slack_app_clicked")         // +10721916

    // Step 2 — status message to the user
    emitTextMessage("Opening Slack app installation page in browser…")
                                                           // +10722062

    // Step 3 — save / persist config if needed (via saveGlobalConfig)
    await saveGlobalConfig(context)                        // +10721954

    // Step 4 — open URL in browser
    await openUrlInBrowser(installationUrl)                // +10722029
```

### Global config persistence (`a6` → `saveGlobalConfig`)

Analysis basis: CC v2.1.143 bundle.js:+3159299

The handler calls `saveGlobalConfig` before opening the browser. This function:

```
async function saveGlobalConfig(context):
    acquireConfigLock()                  // may emit tengu_config_lock_contention
    previousConfig = readConfig()
    if previousConfig is missing auth that cache has:
        log("saveGlobalConfig fallback: re-read config is missing auth …")
                                         // +3159506, tengu_config_auth_loss_prevented
        return  // refuse to overwrite to avoid wiping ~/.claude.json (GH #3117)
    mergeAndWriteConfig()
    releaseConfigLock()
```

Key guard: if the on-disk re-read is missing auth credentials that the in-memory cache holds, the write is aborted with `tengu_config_auth_loss_prevented` to prevent data loss (GH #3117).
Analysis basis: CC v2.1.143 bundle.js:+3162624

### Config file read / write with lock (`P9_` → `configReadWriteLock`)

Analysis basis: CC v2.1.143 bundle.js:+3161997

```
function configReadWriteLock(path, writeFn):
    ensureParentDirExists(dirname(path))         // L.mkdirSync
    startTime = Date.now()
    while not lockAcquired:
        if elapsed > timeout:
            emitError("Lock acquisition took longer than expected …")
                                                 // +3162208
            fire tengu_config_lock_contention    // +3162297
            break
        sleep()
    result = writeFn()
    if staleWriteDetected:
        fire tengu_config_stale_write            // +3162433
    releaseLock()
    return result
```

Lock-wait timeout message literal: `"Lock acquisition took longer than expected - another Claude instance may be running"` (bundle.js:+3162208).

### Platform URL opener (`qK` → `openUrlInBrowser`)

Analysis basis: CC v2.1.143 bundle.js:+7543303

```
function openUrlInBrowser(url):
    if not url.startsWith("http:") and not url.startsWith("https:"):
        throw Error("Invalid URL protocol")     // +7543016, +7543066, +7543088

    platform = process.platform
    if platform == "darwin":                    // +7543375
        spawn("open", [url])                    // +7543549
    else if platform == "win32":               // +7543391
        spawn("rundll32", ["url,OpenURL", url]) // +7543475, +7543487
    else:
        spawn("xdg-open", [url])               // +7543556
```

Only `http:` and `https:` scheme URLs are accepted; any other scheme causes an error.
Analysis basis: CC v2.1.143 bundle.js:+7543066

### Config backup and rotation (`H$H` → `readConfigWithBackup`)

Analysis basis: CC v2.1.143 bundle.js:+3164235

When reading the configuration file the system uses a guarded reader that:

```
function readConfigWithBackup(configPath):
    if accessNotYetAllowed:
        throw Error("Config accessed before allowed.")   // +3164241
    raw = fs.readFileSync(configPath, "utf-8")           // +3164297, +3164324
    parsed = JSON.parse(raw)                             // via R6
    if parseError:
        fire tengu_config_parse_error                    // +3164878
        restoreLatestBackup(configPath)                  // via zZ9
    return parsed
```

Backup files are stored under a `"backups"` subdirectory (bundle.js:+3163809). Backup filenames contain a `".backup."` infix (bundle.js:+3163094). The system retains up to **5** backup copies (bundle.js:+3163227).

### Background session management (`Y8` / `$_` / `KXH` — `backgroundSessionManager`)

Analysis basis: CC v2.1.143 bundle.js:+1038227

The command execution path passes through the background session layer even for simple local commands. Relevant constants observed in traversal:

- Background session creation event: `"daemon_bg_session_create"` (bundle.js:+14503527)
- Spare session pool label: `"spare"` (bundle.js:+14503931)
- Memory limit for background dispatch: **1 024** units (bundle.js:+14503690)
- Process retirement poll: **30** s / **15** s intervals (bundle.js:+14503172, +14503183)
- SIGKILL escalation event: `tengu_bg_dispatch_sigkill_escalate` (bundle.js:+14503217)
- Low-memory event: `tengu_bg_dispatch_low_mem` (bundle.js:+14503796)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_install_slack_app_clicked` (bundle.js:+10721916) |
| Telemetry — config lock | `tengu_config_lock_contention` (bundle.js:+3162297) |
| Telemetry — stale write | `tengu_config_stale_write` (bundle.js:+3162433) |
| Telemetry — parse error | `tengu_config_parse_error` (bundle.js:+3164878) |
| Telemetry — auth loss | `tengu_config_auth_loss_prevented` (bundle.js:+3162776) |
| Telemetry — bg session | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_spare_spawn`, `tengu_bg_dispatch_sigkill_escalate` |
| Config file write | May update `~/.claude.json`; protected by file lock; auth-loss guard prevents stale overwrites |
| Config backup | Up to 5 rotating backups created in `backups/` subdirectory before any write |
| Browser launch | Spawns `open` / `rundll32 url,OpenURL` / `xdg-open` depending on platform |
| stdout message | `"Opening Slack app installation page in browser…"` emitted as `text` type message (bundle.js:+10722049, +10722062) |
| supportsNonInteractive | `false` — command must be run in an interactive session |
| Sound | None observed in traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.143 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `supportsNonInteractive` is `false`. Invoking `/install-slack-app` from a script or CI pipeline will be rejected or silently skipped.
2. **No browser available**: On headless Linux servers `xdg-open` may fail silently if no display server is present. The command does not verify that the browser successfully opened.
3. **Protocol assumption**: The URL opener only accepts `http:` and `https:` schemes. Any deep-link or custom scheme would throw an error at the validation step.
4. **Concurrent Claude instances and config lock**: If another Claude process holds the config lock when this command runs, the write may time out and emit a warning. The underlying installation URL opening still proceeds, but config changes may not be persisted.
5. **Auth-loss guard**: In rare cases (e.g., race between two instances) the auth-loss guard (`GH #3117`) may prevent the config write altogether. This is intentional and safe, but users may see a log warning.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `lP7` | Main async handler for `/install-slack-app` (arbor_handler) |
| `d` | Telemetry / event recorder helper |
| `a6` | `saveGlobalConfig` — persists global config with auth-loss guard |
| `P9_` | `configReadWriteLock` — file-lock wrapper for config read/write |
| `_` | Low-level filesystem utility (used in lock and dir helpers) |
| `x6` | Path existence / stat check utility |
| `L` | Primary filesystem module reference (Node `fs` wrapper) |
| `q` | Secondary filesystem module reference |
| `f` | File handle / stream finalization helper |
| `heA` | Config object merge / transform helper |
| `Tr8` | Config schema initializer |
| `v` | HTTP request / fetch utility |
| `G5K` | HTTP response handler |
| `H` | Random retry / jitter helper (uses `Math.random`, `setTimeout`) |
| `hH` | JSON serialization helper |
| `P7` | HTTP header builder |
| `cSH` | HTTP error classifier |
| `Z5K` | File-upload / multipart helper |
| `L8` | Async error boundary / promise guard |
| `H$H` | `readConfigWithBackup` — guarded config file reader with backup/restore |
| `R6` | JSON parse wrapper |
| `jR` | String prefix stripper |
| `zZ9` | Backup file locator / restore helper |
| `NH` | Error logger (`Wc.logError` caller) |
| `X9_` | Path join helper (`lz.join` + platform normalization) |
| `w` | Background process / daemon manager |
| `d76` | Config diff / delta helper |
| `A` | Process / platform info module |
| `V` | Config field validator |
| `X` | MCP / SDK connection manager |
| `iT8` | MCP transport initializer |
| `v_` | Error wrapper (`Error` + `String`) |
| `Z` | Config array / slice helper |
| `yA6` | Atomic file writer (temp-file + rename pattern) |
| `O` | `lstat` / symlink classifier |
| `$8` | Promise guard helper |
| `emH` | Config environment merger |
| `OZ9` | Object entries iterator helper |
| `HpH` | Timestamp / config age helper |
| `j9_` | Project-level config writer |
| `qK` | `openUrlInBrowser` — platform-aware URL launcher |
| `ex4` | URL validation / protocol check |
| `hJ` | Shell spawn helper |
| `Y8` | Background session entry point |
| `$_` | Session execution wrapper |
| `KXH` | Session lifecycle controller |
| `D` | Background daemon scheduler |
| `_SK` | Session ID formatter |
| `S6` | Async-local-storage / context retriever |
| `Uh6` | Context store accessor |
| `__` | Global state accessor |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.