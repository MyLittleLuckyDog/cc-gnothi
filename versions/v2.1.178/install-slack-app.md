---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.178"
updated: "2026-06-16"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.178 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.178 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.178

---

## Overview

`/install-slack-app` is a local slash command that opens the Claude Slack app installation page in the user's default browser. When invoked, it fires a telemetry event, displays a brief status message to the user, and delegates to a URL-opening utility that handles platform-specific browser launch. The command is non-interactive and produces no agent turn.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `NfK` |
| load_inline | `true` |
| loc_byte | `12032379` |
| loc_byte_end | `12032565` |
| loc_line | `8098` |
| arbor_handler.name | `flL` |
| arbor_handler.fqn | `claude-2.1.178::flL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.178 bundle.js:+12032379

---

## Input Branching

The command has a simple linear flow with no significant branching on user input. A numbered pseudocode representation is appropriate.

1. Command is invoked (no arguments consumed).
2. Emit telemetry event `tengu_install_slack_app_clicked`.
3. Record the interaction via the config-write utility (with lock).
4. Output the status string `"Opening Slack app installation page in browser…"` as a `text` message to the terminal.
5. Call the URL-opening helper (`h4`) with the Slack app installation URL.
6. URL-opening helper validates the URL scheme (`http:` or `https:`), then dispatches `open` on macOS (`darwin`) or the platform equivalent.
7. Return; no agent conversation turn is created.

---

## Behavioral Spec

### Handler Entry Point (`flL`)

```
async function installSlackAppHandler(context):
    emit telemetry("tengu_install_slack_app_clicked")          // +12031985
    saveConfigWithLock(context)                                 // call to configWriter (W8)
    printToTerminal(kind="text",
        message="Opening Slack app installation page in browser…")  // +12032131
    openUrl(slackAppInstallUrl)                                 // call to urlOpener (h4) +12032098
    return
```

Analysis basis: CC v2.1.178 bundle.js:+12031983–12032098

---

### Config Save with Lock (`W8` → `wO8`)

When the command fires, it writes interaction metadata to the global config under a filesystem lock. The locking mechanism:

```
function saveConfigWithLock(context):
    acquireFileLock(lockPath)
    if lockAcquisitionTookTooLong:
        log("error", "Lock acquisition took longer than expected…")  // +12032379 area, literal +3348823
        emit telemetry("tengu_config_lock_contention")               // +3348912
    reReadConfigFromDisk()
    if reReadConfigMissingAuthThatCacheHas:
        emit telemetry("tengu_config_auth_loss_prevented")           // +3349391
        log warning and abort write                                   // literal +3349239
    writeConfigAtomically(newData)
    releaseLock()
```

- Lock warning literal: `"Lock acquisition took longer than expected - another Claude instance may be running"` (bundle.js:+3348823)
- Auth-loss guard literal: `"saveConfigWithLock: re-read config is missing auth that cache has; refusing to write to avoid wiping ~/.claude.json. See GH #3117."` (bundle.js:+3349239)
- Config backup directory: `"backups"` (bundle.js:+3350424)
- Backup file rotation: keeps the 5 most recent backups (bundle.js:+3349842)
- Backup timestamp format uses `Date.now()` (bundle.js:+3348684)
- Config file read encoding: `"utf-8"` (bundle.js:+3350939)
- File permission mode for new config: `384` (octal `0o600`) (bundle.js:+3350124)

Analysis basis: CC v2.1.178 bundle.js:+3345593, +3348612, +3348910

---

### URL Opening (`h4` → `Dg9` / `g8`)

```
function openUrl(url):
    if not url.startsWith("http:") and not url.startsWith("https:"):
        throw Error("Invalid URL scheme")       // literal +6311178, +6311200; error +6311128

    if platform == "darwin":                    // literal +6311866
        spawnProcess("open", [url])             // literal +6311885
    else:
        useAlternativeLauncher(url)             // Dg9 / Iw branch

    waitForChildProcess()                       // via g8 → Q_ → u6
```

Analysis basis: CC v2.1.178 bundle.js:+12032098, +6311736, +6311749, +6311866

---

### Atomic Config Write Utility (`wO8` — file-system layer)

```
function atomicConfigWrite(filePath, data):
    ensureDirectoryExists(path.dirname(filePath))   // mkdirSync +3348639
    acquireLock(filePath)
    tempPath = filePath + ".backup." + Date.now()   // literal ".backup." +3349709
    copyCurrentToTemp(filePath, tempPath)            // copyFileSync +3349816
    writeNewContent(filePath, data, mode=0o600)
    pruneOldBackups(keepCount=5)                    // +3349842
    releaseLock()
```

Analysis basis: CC v2.1.178 bundle.js:+3348612, +3349816, +3349960

---

### Stale-Write Guard (`W8` / `wO8`)

If the re-read config on disk diverges from the in-memory cache (auth fields differ), the write is aborted and a fallback path is taken:

```
function fallbackWriteGuard(cachedConfig, diskConfig):
    if diskConfig.auth missing AND cachedConfig.auth present:
        emit telemetry("tengu_config_stale_write")     // +3349048
        emit telemetry("tengu_config_fallback_write")  // +3348528
        log("saveGlobalConfig fallback: …")            // literal +3345800
        return WITHOUT writing
```

Analysis basis: CC v2.1.178 bundle.js:+3345800, +3349048, +3349391

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry (primary) | `tengu_install_slack_app_clicked` (bundle.js:+12031985) — fired immediately on invocation |
| Telemetry (config lock) | `tengu_config_lock_contention` (+3348912), `tengu_config_stale_write` (+3349049), `tengu_config_auth_loss_prevented` (+3349391), `tengu_config_fallback_write` (+3348528), `tengu_config_parse_error` (+3351487) |
| Telemetry (background daemon) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop`, `tengu_bg_attach_legacy_autorespawn`, `tengu_bg_attach`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_stall_respawn`, `tengu_bg_attach_kick` (reachable via daemon dispatch layer in depth-2 traversal) |
| Terminal output | Prints `"Opening Slack app installation page in browser…"` as a `text`-type message (bundle.js:+12032131) |
| Browser launch | Spawns OS-level `open` command (macOS) or platform equivalent to open the Slack app installation URL |
| Config side effect | Updates global config with lock (interaction metadata); creates timestamped backup in `backups/` subdirectory |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | None observed in traversal |
| Non-interactive support | `false` — command must not be used in non-interactive (headless) mode |

---

## Version History

| Version | Change |
|---|---|
| v2.1.178 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `supportsNonInteractive` is `false` (bundle.js:+12032379). Invoking `/install-slack-app` in a headless or scripted pipeline will fail or produce no effect.
2. **Expecting output beyond the status message**: The command does not start an agent conversation turn. It only opens a browser URL. No Claude response is generated.
3. **Assuming cross-platform browser launch works identically**: The URL opener checks `process.platform === "darwin"` and uses `open` on macOS (bundle.js:+6311866). On other platforms, the alternative launcher path (`Dg9`/`Iw`) is taken; behaviour may differ.
4. **Ignoring lock contention warnings**: If another Claude Code instance is running and holds the config lock, the command logs a warning about lock acquisition delay (bundle.js:+3348823) rather than failing hard. The Slack page may still open, but config write may be delayed or skipped.
5. **Expecting the URL scheme validation to pass for non-HTTP URLs**: The URL opener rejects any URL that does not begin with `http:` or `https:` (bundle.js:+6311178, +6311200).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `flL` | Main async handler for `/install-slack-app` (arbor_handler, AsyncFunction) |
| `d` | General-purpose logging / debug utility (called from handler and config layer) |
| `W8` | Global config save-with-lock orchestrator |
| `wO8` | Atomic file-write / backup utility (filesystem layer) |
| `_` | Low-level filesystem abstraction (readdirStringSync, statSync, etc.) |
| `n6` | Path normalization / resolution helper |
| `f` | Filesystem module wrapper (statSync, copyFileSync, unlinkSync, etc.) |
| `q` | Secondary filesystem / IPC module (readFileSync, mkdirSync, readdirStringSync, etc.) |
| `L` | Promise / stream lifecycle manager (finally/close handling) |
| `tR1` | Config object merge / construction helper |
| `v2_` | Config schema validator or transformer |
| `N` | HTTP request / API call utility |
| `AM4` | HTTP connection builder (uses `my`, `D__`, `WSA`) |
| `H` | Retry/backoff scheduler (uses `Math.random`, `setTimeout`) |
| `xH` | JSON serialization wrapper (`JSON.stringify`) |
| `d4` | Header or string-field sanitizer (redaction, replacement) |
| `VdH` | Field validation helper (calls `FCA`) |
| `LM4` | HTTP response / streaming body reader |
| `Z8` | Error categorizer or error-code mapper |
| `_MH` | Config file reader with parse and backup logic |
| `i6` | JSON parse wrapper |
| `Rm` | String prefix stripper (startsWith / slice pattern) |
| `WL9` | Directory walker / config file locator |
| `zk_` | Path join + module resolution helper |
| `D` | Background daemon session manager |
| `JsH` | Config integrity checker or journal helper |
| `A` | String case utility or process map (toLowerCase used) |
| `V` | Scroll / layout math utility (Math.max, Math.floor) |
| `S` | Terminal supervisor writer (Y.write, RH) |
| `E` | Bounded-range math helper (Math.max, Math.min) |
| `P` | IPC / pipe framing layer (Buffer.concat, indexOf, off, setTimeout) |
| `X` | Socket/stream timeout manager (setTimeout) |
| `j` | Process kill manager (A.values, S.kill) |
| `lL` | Stream-end / response-flush helper |
| `Gb5` | Background daemon protocol dispatcher (large multiplexed handler) |
| `TH` | String coercion wrapper |
| `ED6` | Atomic symlink-safe file writer (randomBytes, fchmodSync, fsyncSync, renameSync) |
| `O` | Background session descriptor (isSymbolicLink, C8) |
| `x8` | Error code normalizer |
| `gXH` | Config load helper or glob matcher |
| `PL9` | Object.entries iterator utility |
| `CG6` | Timestamp / cache-expiry checker (Date.now) |
| `YO8` | Per-session config writer / symlink updater |
| `dH` | Debug trace emitter (calls `c36`) |
| `c36` | Low-level trace sink |
| `h4` | URL opener / browser launcher |
| `KV7` | URL scheme validator (throws Error on bad scheme) |
| `Dg9` | Platform-specific process spawner for URL opening |
| `Iw` | Non-macOS URL-open fallback |
| `g8` | Child-process wait / output-collect utility |
| `Q_` | Process output stream handler (shH, w, Ol4, D5) |
| `u6` | Process execution wrapper (Pe6, W_) |