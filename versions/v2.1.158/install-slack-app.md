---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.158"
updated: "2026-06-02"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.158 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.158 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.158

---

## Overview

The `/install-slack-app` command opens the Claude Slack application installation page in the user's default web browser. It is a local, non-interactive command that fires a telemetry event, optionally persists configuration state, and then delegates to a platform-aware URL opener to launch the browser. No agent turn or prompt is sent to the model.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `XC1` |
| load_inline | `true` |
| loc_byte | `11398758` |
| loc_byte_end | `11398944` |
| loc_line | `7499` |
| arbor_handler.name | `TH5` |
| arbor_handler.fqn | `claude-2.1.158::TH5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.158 bundle.js:+11398758

---

## Input Branching

The command has a simple linear flow with one minor platform branch inside the URL-opener helper. Numbered pseudocode is appropriate.

1. User invokes `/install-slack-app`.
2. Handler `TH5` fires immediately (no argument parsing required).
3. Telemetry event `tengu_install_slack_app_clicked` is emitted.
4. A text notification `"Opening Slack app installation page in browser…"` is printed/yielded to the UI.
5. Configuration save helper (`z8`) is called to persist any pending state changes under a file lock.
6. The URL opener (`JK`) is invoked with the Slack installation URL.
7. Inside the URL opener, the platform is inspected:
   - **macOS** (`darwin`) — `open` command is used.
   - **Windows** (`win32`) — `rundll32 url,OpenURL` is used.
   - **Other / Linux** — `xdg-open` is used.
8. Control returns; command completes.

---

## Behavioral Spec

### Top-level handler (`TH5`)

```
async function installSlackAppHandler(context):
    emit telemetry("tengu_install_slack_app_clicked")          // bundle.js:+11398364
    yield uiMessage(kind="text",
                    body="Opening Slack app installation page in browser…")
                                                                // bundle.js:+11398510
    await saveConfigWithLock(context)                          // bundle.js:+11398402
    await openUrlInBrowser(context)                            // bundle.js:+11398477
```

Analysis basis: CC v2.1.158 bundle.js:+11398362

---

### Configuration persistence helper (`z8` → `saveConfigWithLock`)

```
async function saveConfigWithLock(context):
    acquire filesystem lock via lockFileHelper()               // bundle.js:+3205246
    if lock acquisition took longer than expected:
        emit telemetry("tengu_config_lock_contention")         // bundle.js:+3208313
        log warning("Lock acquisition took longer than expected
                     - another Claude instance may be running") // bundle.js:+3208224
    re-read config from disk (utf-8)                           // bundle.js:+3210340
    if re-read config is missing auth that cached copy has:
        emit telemetry("tengu_config_auth_loss_prevented")     // bundle.js:+3208792
        log error("saveConfigWithLock: re-read config is missing
                   auth that cache has; refusing to write …")  // bundle.js:+3208640
        release lock
        return
    if stale-write condition detected:
        emit telemetry("tengu_config_stale_write")             // bundle.js:+3208449
    write merged config to temp file (mode 0o600 / 384 decimal) // bundle.js:+3209525
    atomically rename temp file to final config path
    release lock
    maintain up to 5 rotating backups in "backups/" sub-dir    // bundle.js:+3209243 / +3209825
```

Analysis basis: CC v2.1.158 bundle.js:+11398402

---

### Lock-file helper (`LY_` → `acquireFileLock`)

```
async function acquireFileLock(lockPath):
    ensure parent directory exists (mkdirSync recursive)       // bundle.js:+3208040
    stamp lock file with Date.now()                            // bundle.js:+3208085
    poll up to 60 000 ms for exclusive access                  // bundle.js:+3208994
    if ENOENT on stat:
        treat as lock released                                 // bundle.js:+3208579
    if lock held too long:
        emit "error" level log with warning string             // bundle.js:+3208181
    return lock handle
```

Analysis basis: CC v2.1.158 bundle.js:+3205246

---

### URL-opener (`JK` → `openUrlInBrowser`)

```
async function openUrlInBrowser(url):
    validate url scheme is "http:" or "https:"                 // bundle.js:+6699046 / +6699068
    if scheme invalid:
        throw Error (via errorGuard helper)                    // bundle.js:+6698996

    platform = process.platform
    if platform == "darwin":
        spawn("open", [url])                                   // bundle.js:+6699529
    else if platform == "win32":
        spawn("rundll32", ["url,OpenURL", url])                // bundle.js:+6699455 / +6699467
    else:
        spawn("xdg-open", [url])                               // bundle.js:+6699536

    await process exit
```

Analysis basis: CC v2.1.158 bundle.js:+6699283

---

### Atomic file writer (`hL6` → `atomicWriteFile`)

```
function atomicWriteFile(targetPath, content, desiredMode):
    resolve symlinks to find real target                       // bundle.js:+1011644
    generate temp path using 6 random bytes encoded as hex     // bundle.js:+1012273 / +1012301
    write content to temp path
    apply desiredMode via fchmodSync                           // bundle.js:+1012767
    log debug("Applied original permissions to temp file")     // bundle.js:+1012788
    fsyncSync temp file descriptor                             // bundle.js:+1012833
    renameSync(temp, target)                                   // bundle.js:+1012961
    on error (ELOOP / ENOTDIR): unlink temp, rethrow           // bundle.js:+1011930 / +1011943
```

Analysis basis: CC v2.1.158 bundle.js:+1011557

---

### Config file parser (`szH` → `readConfigFile`)

```
function readConfigFile(configPath):
    if file missing (ENOENT):
        return default config                                  // bundle.js:+3208579
    if "Config accessed before allowed":
        throw Error                                            // bundle.js:+3210257
    read file as utf-8 string                                  // bundle.js:+3210340
    parse JSON                                                 // bundle.js:+184345 (via p6)
    scan backup directory for files starting with ".backup."   // bundle.js:+3209110
    return parsed config object
```

Analysis basis: CC v2.1.158 bundle.js:+3205427

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry (primary) | `tengu_install_slack_app_clicked` — emitted on every invocation (bundle.js:+11398364) |
| Telemetry (config lock) | `tengu_config_lock_contention` — emitted when lock acquisition is slow (bundle.js:+3208313) |
| Telemetry (config write) | `tengu_config_stale_write` — emitted on stale-write guard trigger (bundle.js:+3208449) |
| Telemetry (auth guard) | `tengu_config_auth_loss_prevented` — emitted when auth-loss guard fires (bundle.js:+3208792) |
| Telemetry (config error) | `tengu_config_parse_error` — emitted on JSON parse failure (bundle.js:+3210888) |
| Telemetry (background) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_spare_spawn` — emitted by background-session infrastructure reachable via the process-spawner call chain |
| Config file write | Persists merged config (e.g., `~/.claude.json`) with atomic rename + up to 5 rotated backups |
| Browser launch | Spawns a detached OS process (`open` / `rundll32 url,OpenURL` / `xdg-open`) |
| UI output | Yields one `text`-type message: `"Opening Slack app installation page in browser…"` (bundle.js:+11398497 / +11398510) |
| Non-interactive | `supportsNonInteractive: false` — command must not be used in headless/pipe mode |
| Hook registration | None detected in depth-2 traversal |
| appState changes | None detected in depth-2 traversal |
| Sound | None detected in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.158 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode** — `supportsNonInteractive` is `false`. Invoking `/install-slack-app` inside a script or pipe (`--print` / `--output-format json`) will be rejected or behave unexpectedly.
2. **No browser installed / headless server** — The command unconditionally tries to open a URL in the system browser. On a headless Linux server without `xdg-open` or a display server, the spawned process will fail silently or throw an ENOENT.
3. **Lock contention from parallel Claude instances** — If another Claude Code instance is writing config simultaneously, the command may log a lock-contention warning and delay. This is expected but can confuse users who see the warning before the browser opens.
4. **Expecting a model response** — This is a `local` command: no agent turn is initiated and the model is never called. Users expecting a conversational reply will not receive one.
5. **Auth-loss guard blocks config write** — In rare cases where the in-memory auth token is not reflected in the on-disk config (e.g., after a partial write by another process), the guard will refuse to persist state. The browser still opens, but config changes may not be saved.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `TH5` | Top-level async handler for `/install-slack-app` (arbor_handler) |
| `d` | Debug/trace logger utility |
| `z8` | Save-config-with-lock coordinator |
| `LY_` | File-lock acquisition helper |
| `_` | Filesystem abstraction layer (internal) |
| `g6` | Path resolution / normalization utility |
| `L` | Primary filesystem module reference |
| `q` | Secondary filesystem module reference |
| `f` | File handle / stream reference |
| `nOq` | Config object merge/construct helper |
| `fK_` | Config field extractor |
| `N` | HTTP request builder / API caller |
| `lCK` | Request header builder |
| `H` | Randomness / retry utility |
| `RH` | JSON serializer wrapper |
| `v4` | URL/path component parser |
| `EuH` | Error normalizer |
| `rCK` | HTTP response handler |
| `J8` | Structured logger / event emitter |
| `szH` | Config file reader/parser |
| `p6` | JSON parse wrapper |
| `Qb` | String prefix stripper |
| `RFq` | Backup directory scanner |
| `fY_` | Backup path builder |
| `w` | Background-session process manager |
| `qY6` | Config schema validator |
| `A` | String case normalizer |
| `V` | Version string comparator |
| `P` | MCP / transport connection manager |
| `Ox8` | Transport factory |
| `SH` | MCP connection state handler |
| `F_` | Error wrapper / typed error factory |
| `E` | Backup list slice helper |
| `hL6` | Atomic file writer |
| `O` | Symbolic-link stat wrapper |
| `P8` | Promise-based error thrower |
| `UQH` | Config cache accessor |
| `SFq` | Object-entries iterator helper |
| `BQH` | Timestamp recorder |
| `KY_` | Global-config save fallback |
| `JK` | Platform-aware URL opener |
| `$o7` | URL scheme validator / error guard |
| `FD` | Process spawner for browser open |
| `v8` | Browser-open orchestrator |
| `G_` | Subprocess runner with timeout |
| `RGH` | Low-level spawn wrapper |
| `D` | Background-session dispatcher |
| `rq4` | Exit-code stringifier |
| `Iz` | Process output accumulator |
| `h6` | Async-local-storage context accessor |
| `iB6` | Store getter for ALS context |
| `O_` | Request-context resolver |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.