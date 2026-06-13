---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.177"
updated: "2026-06-13"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.177 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.177 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.177

---

## Overview

`/install-slack-app` is a local slash command that triggers the installation flow for the Claude Slack app. When invoked, it fires a telemetry event, displays a status message to the user, and opens the Slack app installation page in the system's default web browser. The command is non-interactive and requires no arguments.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `u9K` |
| load_inline | `true` |
| loc_byte | `11979107` |
| loc_byte_end | `11979293` |
| loc_line | `8252` |
| arbor_handler.name | `OFL` |
| arbor_handler.fqn | `claude-2.1.177::OFL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.177 bundle.js:+11979107

---

## Input Branching

This command follows a simple linear flow (no argument-based branching). A numbered pseudocode representation is used.

1. User invokes `/install-slack-app`.
2. Handler `OFL` is called (async).
3. Telemetry event `tengu_install_slack_app_clicked` is emitted.
4. A text notification `"Opening Slack app installation page in browser…"` is returned/displayed.
5. The URL-open utility (`oK`) is called to launch the Slack app installation URL.
6. Command completes.

---

## Behavioral Spec

### Main Handler — `OFL` (install-slack-app entry point)

This is the primary `AsyncFunction` handler resolved by Arbor via the `module_id` path (`u9K` → `OFL`).

```
async function handleInstallSlackApp(context):
    // Step 1: emit click telemetry
    emitTelemetry("tengu_install_slack_app_clicked")
    // Analysis basis: CC v2.1.177 bundle.js:+11978713

    // Step 2: persist/read config via saveConfig helper
    saveConfig(context)
    // Analysis basis: CC v2.1.177 bundle.js:+11978751

    // Step 3: return user-facing status message
    return {
        type: "text",
        content: "Opening Slack app installation page in browser…"
    }
    // Analysis basis: CC v2.1.177 bundle.js:+11978846, +11978859

    // Step 4: open URL in system browser
    openURLInBrowser(slackAppInstallURL)
    // Analysis basis: CC v2.1.177 bundle.js:+11978826
```

### URL-Open Helper — `oK` (cross-platform browser launcher)

The `oK` function dispatches URL-open calls based on the detected operating system platform.

```
async function openURLInBrowser(url):
    // Validate URL scheme
    if url does not start with "http:" or "https:":
        throw Error("Invalid URL scheme")
    // Analysis basis: CC v2.1.177 bundle.js:+6294964, +6294986, +6294914

    platform = detectPlatform()  // calls NY helper

    if platform == "darwin":
        spawn("open", [url])
        // Analysis basis: CC v2.1.177 bundle.js:+6295273, +6295447

    else if platform == "win32":
        spawn("rundll32", ["url,OpenURL", url])
        // Analysis basis: CC v2.1.177 bundle.js:+6295289, +6295373, +6295385

    else:  // Linux / other
        spawn("xdg-open", [url])
        // Analysis basis: CC v2.1.177 bundle.js:+6295454
```

### Config Save Path — `P8` (global config writer with lock)

`OFL` calls the config-write helper `P8` as a side effect. This utility acquires a file-system lock before writing global configuration, guards against auth data loss, and falls back gracefully on errors.

```
async function saveGlobalConfig(configData):
    acquireLock()               // via lockHelper (J38)
    if lock acquisition slow:
        log("error", "Lock acquisition took longer than expected - another Claude instance may be running")
        // Analysis basis: CC v2.1.177 bundle.js:+3335555

    currentConfig = readConfigFile()  // via G5H

    // Auth-loss guard (GH #3117)
    if cachedConfig has auth AND re-read config is missing auth:
        emitTelemetry("tengu_config_auth_loss_prevented")
        log("saveGlobalConfig fallback: re-read config is missing auth …")
        // Analysis basis: CC v2.1.177 bundle.js:+3332608, +3336123
        return  // refuse to write

    writeConfigFile(mergedConfig)
    releaseLock()
```

Lock acquisition itself (via `J38`) manages:
- Directory creation via `mkdirSync` (Analysis basis: CC v2.1.177 bundle.js:+3335371)
- Timeout of **60 000 ms** before the "lock contention" warning fires (Analysis basis: CC v2.1.177 bundle.js:+3336325)
- Backup file rotation with the suffix `".backup."` — keeping up to **5** backups (Analysis basis: CC v2.1.177 bundle.js:+3336441, +3336574)
- Config file permissions set to octal **600** (`384` decimal) (Analysis basis: CC v2.1.177 bundle.js:+3336856)

### Config Reader — `G5H` (file reader with backup fallback)

```
function readConfigFile(path):
    if path is not accessible:
        raise Error("Config accessed before allowed.")
        // Analysis basis: CC v2.1.177 bundle.js:+3337588

    raw = readFileSync(path, "utf-8")
    // Analysis basis: CC v2.1.177 bundle.js:+3337671

    parsed = JSON.parse(raw)   // via c6

    if parse fails:
        emitTelemetry("tengu_config_parse_error")
        // Analysis basis: CC v2.1.177 bundle.js:+3338219
        attemptRestoreFromBackup()  // via sK9

    return parsed
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry (primary) | `tengu_install_slack_app_clicked` — emitted immediately on invocation (bundle.js:+11978713) |
| Telemetry (config path) | `tengu_config_lock_contention` — lock wait exceeded (bundle.js:+3335644) |
| Telemetry (config path) | `tengu_config_stale_write` — stale write detected (bundle.js:+3335780) |
| Telemetry (config path) | `tengu_config_parse_error` — config JSON parse failure (bundle.js:+3338219) |
| Telemetry (config path) | `tengu_config_auth_loss_prevented` — auth data loss guard triggered (bundle.js:+3336123) |
| Telemetry (bg daemon, indirect) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop`, `tengu_bg_attach_legacy_autorespawn`, `tengu_bg_attach`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_stall_respawn`, `tengu_bg_attach_kick` — background session infrastructure events reachable from the daemon layer traversed during callGraph depth-2 expansion; not directly triggered by this command |
| Browser launch | Opens Slack app installation URL via platform-appropriate launcher (`open` / `rundll32` / `xdg-open`) |
| Config side effect | Reads and may rewrite global config (`~/.claude.json`) with file lock; guards against auth loss (GH #3117) |
| User-facing output | Returns `{ type: "text", content: "Opening Slack app installation page in browser…" }` (bundle.js:+11978846) |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| supportsNonInteractive | `false` — must be run in an interactive session |

---

## Version History

| Version | Change |
|---|---|
| v2.1.177 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `supportsNonInteractive` is `false`. Attempting to use this command in a headless/scripted pipeline will fail or be silently ignored.
2. **No browser configured**: On Linux, the command relies on `xdg-open`. If no default browser is set in the desktop environment, the URL will not open and no error will be shown in the Claude Code terminal.
3. **Expecting a return value**: The command's purpose is the side-effect of opening a browser page, not producing structured output. Do not chain this command expecting a URL or token to be returned.
4. **Firewall / proxy environments**: The browser open call will succeed from Claude Code's perspective even if the browser cannot reach the Slack installation endpoint. Network errors are handled by the browser, not by CC.
5. **Confusing with MCP/OAuth flows**: This command does not itself perform OAuth or token exchange. It only opens the installation page; the user must complete the flow in the browser.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `OFL` | Main async handler for `/install-slack-app` (Arbor-resolved entry point) |
| `d` | Telemetry event emitter (called at bundle.js:+11978711) |
| `P8` | Global config save function (with lock) |
| `J38` | File-lock acquisition and config write orchestrator |
| `_` | Filesystem abstraction / util (used in lock/stat paths) |
| `Q6` | Path resolution helper |
| `f` | Filesystem module wrapper (mkdirSync, statSync, copyFileSync, etc.) |
| `q` | Secondary filesystem wrapper (readFileSync, mkdirSync, readdirStringSync, etc.) |
| `L` | Stream / connection lifecycle object |
| `nI1` | Config object merge/normalisation helper |
| `aJ_` | Config field initialiser |
| `N` | HTTP/API request dispatcher |
| `tff` | Request formatter / header builder |
| `H` | Randomised retry/backoff scheduler |
| `CH` | JSON serialisation helper |
| `xf` | URL / header manipulation utility |
| `kQH` | Request signing or auth-header helper |
| `A4f` | HTTP send / response handler |
| `Z8` | Generic error wrapper / thrower |
| `G5H` | Config file reader with backup fallback |
| `c6` | JSON parse wrapper |
| `Jm` | String prefix/slice normalisation helper |
| `sK9` | Config backup directory scanner and restore helper |
| `yN_` | Path join utility for backup subdirectory |
| `D` | Background daemon session manager |
| `EaH` | Config entry validation helper |
| `A` | Locale / case-conversion utility |
| `V` | File-entry filter (startsWith check in directory listings) |
| `P` | IPC/pipe buffer and protocol framing layer |
| `X` | Socket/stream with timeout wrapper |
| `j` | Background worker process registry |
| `mL` | Stream end/flush helper |
| `jI5` | Background daemon message dispatch handler |
| `TH` | String coercion / type-check helper |
| `E` | Slice/clamp utility for arrays or buffers |
| `W` | SDK connection manager |
| `EY6` | Atomic file writer (temp + rename with fsync) |
| `O` | Symbolic-link / stat resolver |
| `C8` | Error code classifier |
| `zXH` | Config schema validator or transformer |
| `aK9` | Config entries iterator |
| `h06` | Timestamp recorder (Date.now wrapper) |
| `j38` | Config write sub-path (lock + atomic write) |
| `oK` | Cross-platform URL-open launcher |
| `x07` | URL scheme validator |
| `NY` | Platform/OS detector |
| `U8` | Auth token / session context loader |
| `d_` | Session initialisation and daemon bootstrap |
| `zhH` | Daemon connection handshake handler |
| `Y` | Forced-shutdown / process exit controller |
| `Kgf` | String coercion helper for error messages |
| `L5` | Session state accessor |
| `kH` | Error logger with structured fields |
| `u6` | Async-local-storage context accessor |
| `bs6` | Context store getter (getStore wrapper) |
| `T_` | Event-emitter or lifecycle hook registrar |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.