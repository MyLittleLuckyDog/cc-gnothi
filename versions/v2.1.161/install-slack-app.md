---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.161"
updated: "2026-06-03"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.161 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.161 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.161

---

## Overview

`/install-slack-app` is a local slash command that triggers the installation flow for the Claude Slack app. When invoked, it fires a telemetry event, displays an informational message to the user, and opens the Slack app installation page in the system's default web browser.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| loc_byte | `11543130` |
| loc_byte_end | `11543316` |
| loc_line | `8022` |
| supportsNonInteractive | `false` |
| module_id | `TU1` |
| load_inline | `true` |
| arbor_handler.name | `oDf` |
| arbor_handler.fqn | `claude-2.1.161::oDf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.161 bundle.js:+11543130

---

## Input Branching

The command's top-level handler has a simple linear flow (no meaningful user input is required — the command takes no arguments). A numbered pseudocode representation is appropriate.

1. Handler (`oDf`) is invoked.
2. Fire telemetry event `tengu_install_slack_app_clicked`.
3. Call config/state accessor (`d`) to record or read invocation context.
4. Call the browser-open utility (`W8`) to open the Slack app installation URL.
5. Output the status message `"Opening Slack app installation page in browser…"` as a `text`-type response to the user.
6. Return.

Analysis basis: CC v2.1.161 bundle.js:+11542734, +11542774, +11542849, +11542869, +11542882

---

## Behavioral Spec

### Main Handler — `slackAppInstallHandler` (`oDf`)

```
async function slackAppInstallHandler(context):
    emitTelemetry("tengu_install_slack_app_clicked")   // +11542736
    recordInvocationContext(context)                    // call to `d`, +11542734
    openUrlInBrowser(context)                           // call to `W8`, +11542774
    displayMessage({ type: "text",                      // +11542869
                     body: "Opening Slack app installation page in browser…" })
    return
```

Analysis basis: CC v2.1.161 bundle.js:+11542734

---

### Browser URL Opener — `openUrlInBrowser` (`W8`)

The browser-open utility resolves the appropriate OS command for launching a URL and shells out to it.

```
function openUrlInBrowser(url):
    validate that url starts with "http:" or "https:"   // +6763739, +6763761
    if urlSchemeInvalid:
        raise Error via errorFactory()                  // `k57`, +6763976

    platform = process.platform
    if platform == "darwin":                            // +6764048
        exec("open", [url])                             // +6764222
    elif platform == "win32":                           // +6764064
        exec("rundll32", ["url,OpenURL", url])          // +6764148, +6764160
    else:                                               // Linux / other
        exec("xdg-open", [url])                         // +6764229

    return resolvedProcess                              // `RD`, +6763989
```

Analysis basis: CC v2.1.161 bundle.js:+6763976, +6764048, +6764064

---

### Config Access & Lock Guard — `configAccessWithLock` (`Pj_`)

Called transitively to persist any state changes around command invocation. Key behaviors observed:

```
function configAccessWithLock(operation):
    acquireLock(lockFile)                    // `_`, `RY.dirname`, `F6`, `L.mkdirSync`
    if lockContention detected:
        emitTelemetry("tengu_config_lock_contention")  // +3249297
        log("error",
            "Lock acquisition took longer than expected…") // +3249208

    if fileNotFound (ENOENT):               // +3249563
        handle gracefully

    readConfig()                            // `nDH`
    if authLossWouldOccur:
        emitTelemetry("tengu_config_stale_write")       // +3249433
        emitTelemetry("tengu_config_auth_loss_prevented") // +3249776
        // refuse write, log GH-3117 warning           // +3249624

    applyOperation(operation)
    writeConfigWithAtomicRename()           // `Y56`: rename, fsync, fchmod
    releaseLock()

    return result
```

Analysis basis: CC v2.1.161 bundle.js:+3249165, +3249208, +3249295

---

### Config Reader — `readConfigFromDisk` (`nDH`)

```
function readConfigFromDisk(path):
    if configAccessedBeforeAllowed:
        throw Error("Config accessed before allowed.")  // +3251241

    raw = fs.readFileSync(path, "utf-8")               // +3251297, +3251324
    parsed = JSON.parse(raw)                           // via `m6`, +184932

    // resolve relative paths via `Ox` (startsWith/slice)
    // scan backup directory (`rcq`) for rotated copies
    //   backup dir named "backups"                    // +3250809
    //   copies prefixed with ".backup."               // +3250094
    //   keep at most 5 backups                        // +3250227

    if parseError:
        emitTelemetry("tengu_config_parse_error")      // +3251872

    return parsed
```

Analysis basis: CC v2.1.161 bundle.js:+3251241, +3251297, +3251344

---

### Atomic Config Writer — `atomicFileWrite` (`Y56`)

```
function atomicFileWrite(targetPath, content):
    // generate random hex suffix (6 bytes → 12 hex chars) // +1013744, +1013760, +1013772
    tmpPath = targetPath + "." + randomHex()

    fd = fs.openSync(tmpPath, flags)
    fs.writeFileSync(fd, content)
    fs.fchmodSync(fd, originalPermissions)             // +1014238
    log("Applied original permissions to temp file")   // +1014259
    fs.fsyncSync(fd)                                   // +1014304
    fs.closeSync(fd)

    fs.renameSync(tmpPath, targetPath)                 // +1014432

    // cleanup on failure:
    //   fs.unlinkSync(tmpPath)                        // +1014589
```

Analysis basis: CC v2.1.161 bundle.js:+1013744, +1014180, +1014432

---

### Bootstrap HTTP Fetch — `bootstrapFetch` (`H` / `VBK`)

Triggered during startup/context initialisation; not directly initiated by this command but reachable via `N` in the call graph.

```
async function bootstrapFetch(url):
    log("[Bootstrap] Fetching", url)                   // +15504122
    response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",        // +15504207, +15504222
            "User-Agent": userAgentString              // +15504241
        },
        timeout: 5000                                  // +15504313
    })
    emitTelemetry("api_bootstrap_fetch",               // +15504434
                  { result: "parse_failed" | "ok" })   // +15504456, +15504486
    log("[Bootstrap] Fetch ok")
    return parsed
```

Analysis basis: CC v2.1.161 bundle.js:+15504122, +15504313, +15504434

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_install_slack_app_clicked` (bundle.js:+11542736) — fired immediately on command invocation |
| Telemetry — config lock | `tengu_config_lock_contention` (+3249297), `tengu_config_stale_write` (+3249433), `tengu_config_auth_loss_prevented` (+3249776) |
| Telemetry — config parse | `tengu_config_parse_error` (+3251872) |
| Telemetry — daemon | `tengu_daemon_control` (+15940522), `tengu_daemon_config_reload` (+15918997) |
| Telemetry — background dispatch | `tengu_bg_dispatch_sigkill_escalate` (+15904509), `tengu_bg_dispatch_low_mem` (+15905088), `tengu_bg_spare_enable` (+15905783), `tengu_bg_spare_claim` (+15905904), `tengu_bg_spare_claim_fail` (+15906167) |
| Browser side-effect | Opens Slack app installation URL in the OS default browser (`open` / `rundll32 url,OpenURL` / `xdg-open` depending on platform) |
| User-facing output | Displays `"Opening Slack app installation page in browser…"` as a `text`-type message (+11542882) |
| Config file I/O | Reads and may write `~/.claude.json` via atomic rename; acquires file lock; maintains up to 5 rotating backups in a `backups/` subdirectory (+3250809, +3250094, +3250227) |
| `supportsNonInteractive` | `false` — command must not be invoked in non-interactive (headless) mode |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.161 | Initial analysis |

---

## Common Mistakes

1. **Invoking in non-interactive mode**: `supportsNonInteractive` is `false`. Calling `/install-slack-app` from a script or pipe will fail or produce no useful output — the command requires an interactive terminal session.
2. **Expecting a return value**: The command's sole purpose is to open a browser tab. It does not return an OAuth token, a confirmation payload, or any machine-readable output. Downstream logic must not depend on command output.
3. **Firewall / sandbox blocking `xdg-open` on Linux**: On Linux systems where `xdg-open` is absent or blocked, the browser will silently fail to open. Users should be advised to manually visit the URL if no browser appears.
4. **Confusing installation with authentication**: Running `/install-slack-app` initiates the Slack OAuth app-installation flow in a browser; it does not directly configure credentials inside Claude Code. The interactive OAuth redirect must be completed in the browser.
5. **Running on a headless server**: Because the command shells out to a platform browser opener (`open`, `rundll32`, `xdg-open`), execution on a headless CI/CD server or SSH session without a display will produce an error or no visible effect.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `oDf` | Main async handler for `/install-slack-app` (arbor_handler) |
| `d` | Invocation context recorder / config state accessor |
| `W8` | Cross-platform browser URL opener |
| `Pj_` | Config access with file-lock guard |
| `_` | File-system primitive (lock file ops, readdirStringSync) |
| `F6` | Path / file existence check utility |
| `L` | File-system wrapper (mkdirSync, statSync, copyFileSync, unlinkSync, readdirStringSync) |
| `q` | Secondary file-system wrapper (readFileSync, statSync, mkdirSync, readdirStringSync, copyFileSync, unlinkSync) |
| `f` | Stream / file handle with close/finally lifecycle |
| `qjq` | Object merge / assignment utility |
| `Y7_` | Sub-utility called from object merge |
| `N` | HTTP request builder / config fetch orchestrator |
| `VBK` | Bootstrap fetch implementation |
| `H` | HTTP fetch wrapper (includes bootstrap fetch) |
| `SH` | JSON serialisation helper (JSON.stringify wrapper) |
| `Z4` | URL or string path formatter |
| `imH` | String transformation helper |
| `IBK` | Config write orchestrator (byte-length, chunked write) |
| `v8` | Logging / debug output utility |
| `nDH` | Config reader from disk |
| `m6` | JSON parse wrapper |
| `Ox` | String prefix stripper (startsWith / slice) |
| `rcq` | Backup directory scanner |
| `Xj_` | Path join helper |
| `w` | Background session / daemon process manager |
| `iY6` | Auth-loss guard utility |
| `A` | String normalisation (toLowerCase) / process map |
| `V` | Named entity (start method) — possibly a timer or watcher |
| `X` | Editor / input buffer manager |
| `J` | Background session spawner |
| `j` | Process kill utility |
| `z` | Daemon stop controller |
| `D` | Supervisor / daemon config reload manager |
| `h` | Scroll / viewport slice manager |
| `lfA` | Vim-mode operator dispatcher |
| `C` | Task execution queue |
| `Z` | Daemon lifecycle controller (stop/start/updateConfig) |
| `Y56` | Atomic file writer (temp → rename) |
| `O` | File stat wrapper (isSymbolicLink) |
| `k8` | Error code helper |
| `McH` | Config helper (called from browser-open utility) |
| `icq` | Object.entries iterator helper |
| `$cH` | Timestamp utility (Date.now wrapper) |
| `Jj_` | Config write helper (dirname, v0, SH, Y56) |
| `SK` | URL validator and platform browser launcher |
| `k57` | Error factory (invalid URL) |
| `RD` | Resolved child process reference |
| `b8` | Session initialiser / store accessor |
| `h_` | Main session bootstrap orchestrator |
| `QGH` | OAuth / connection handler |
| `Y` | Forced-shutdown / process exit manager |
| `kf4` | String coercion helper |
| `S$` | State snapshot utility |
| `yH` | Error logger / push utility |
| `h6` | Async store accessor |
| `sg6` | AsyncLocalStorage getStore wrapper |
| `P_` | Context lookup utility |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.