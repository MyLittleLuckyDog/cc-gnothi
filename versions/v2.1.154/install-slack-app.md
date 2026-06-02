---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.154"
updated: "2026-06-02"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.154 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.154 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.154

---

## Overview

`/install-slack-app` is a local slash command that opens the Claude Slack app installation page in the user's default web browser. It fires a telemetry event, emits a status message to the user, and delegates to a platform-aware URL-opener utility — requiring no user input and producing no interactive dialogue.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `sS1` |
| load_inline | `true` |
| loc_byte | `11387178` |
| loc_byte_end | `11387364` |
| loc_line | `8478` |
| arbor_handler.name | `NeL` |
| arbor_handler.fqn | `claude-2.1.154::NeL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.154 bundle.js:+11387178

---

## Input Branching

This command accepts no user arguments and follows a linear execution path with no significant branching based on user input. A numbered pseudocode flow is therefore appropriate.

1. User invokes `/install-slack-app` (no arguments required or consumed).
2. Handler `NeL` fires telemetry event `tengu_install_slack_app_clicked`.
3. Handler calls the config-persistence utility (`O8`) — likely to record a state flag or timestamp associated with the action.
4. Handler calls the URL-opener utility (`wK`) with the Slack app installation URL.
5. Handler emits the status string `"Opening Slack app installation page in browser…"` as a `text`-type message to the CLI output.
6. Execution completes; no further interaction is needed.

---

## Behavioral Spec

### Main Handler (`NeL`)

```
async function installSlackAppHandler(context):
    fireEvent("tengu_install_slack_app_clicked")          # loc_byte 11386784

    persistConfigState(context)                            # calls O8; loc_byte 11386822

    openUrlInBrowser(SLACK_APP_INSTALL_URL)               # calls wK; loc_byte 11386897

    emit({ type: "text",                                   # loc_byte 11386917
           content: "Opening Slack app installation page in browser…" })
                                                           # loc_byte 11386930
    return
```

Analysis basis: CC v2.1.154 bundle.js:+11386782

---

### URL-Opener Utility (`wK`)

The URL-opener (resolved via call-graph entry `wK → Yn7 / xD / V8`) performs platform detection before dispatching the browser-open call.

```
function openUrlInBrowser(url):
    validateUrl(url)                    # Yn7: rejects non-http/https schemes
                                        # literals: "http:" (loc_byte 6590593),
                                        #           "https:" (loc_byte 6590615)

    platform = detectPlatform()         # xD: reads process.platform

    if platform == "darwin":            # loc_byte 6590902
        spawn("open", [url])            # loc_byte 6591076
    elif platform == "win32":           # loc_byte 6590918
        spawn("rundll32",               # loc_byte 6591002
              ["url,OpenURL", url])     # loc_byte 6591014
    else:                               # Linux / other POSIX
        spawn("xdg-open", [url])        # loc_byte 6591083
```

Analysis basis: CC v2.1.154 bundle.js:+6590830

---

### Config-Persistence Utility (`O8`)

`O8` wraps the global config write path (`hz_`) with a file-system lock and several safety guards. This is a shared utility also used by other commands; its behaviour relevant to this command is summarised below.

```
async function persistConfigState(context):
    acquireLock()                       # hz_ → L.mkdirSync; loc_byte 3207941
                                        # On contention: warn + emit
                                        #   "Lock acquisition took longer…"
                                        #   (loc_byte 3208125) and fire
                                        #   tengu_config_lock_contention

    currentConfig = readConfig()        # bzH; reads UTF-8 JSON; loc_byte 3210241

    if currentConfig is missing auth that cache holds:
        log("saveGlobalConfig fallback: re-read config…")   # loc_byte 3205357
        fireEvent("tengu_config_auth_loss_prevented")        # loc_byte 3208693
        abort write                     # safety guard per GH #3117

    writeConfig(mergedData)             # $L6 → atomic write via temp file +
                                        #   fchmodSync + fsyncSync + renameSync
                                        #   loc_byte range 1011812–1012064

    rotateDirtyBackups()                # bzH → q.mkdirSync "backups" dir
                                        # loc_byte 3210968; max 5 backups
                                        # loc_byte 3209144

    releaseLock()                       # L.unlinkSync; loc_byte 3209262
```

Analysis basis: CC v2.1.154 bundle.js:+3205150

---

### Config Read Sub-routine (`bzH`)

```
function readConfigFromDisk(path):
    if not fileExists(path):
        raise "Config accessed before allowed."   # loc_byte 3210158

    rawBytes = fs.readFileSync(path, "utf-8")     # loc_byte 3210214 / 3210241
    parsed   = JSON.parse(rawBytes)               # m6 → JSON.parse; loc_byte 183900

    stripBomIfPresent(parsed)                     # kb: checks startsWith BOM,
                                                  # slices; loc_byte 1094318

    return parsed
```

Analysis basis: CC v2.1.154 bundle.js:+3210152

---

### Atomic File-Write Sub-routine (`$L6`)

```
function atomicWriteFile(targetPath, data, mode):
    tmpPath = targetPath + "." + randomBytes(6).toString("hex")
                                                  # loc_byte 1011376 / 1011404

    fd = fs.openSync(tmpPath, flags)              # loc_byte 1010906
    fs.writeFileSync(fd, data)                    # loc_byte 1011812

    if originalMode exists:
        fs.fchmodSync(fd, originalMode)           # loc_byte 1011870
        log("Applied original permissions…")      # loc_byte 1011891

    fs.fsyncSync(fd)                              # loc_byte 1011936
    fs.closeSync(fd)                              # loc_byte 1010893
    fs.renameSync(tmpPath, targetPath)            # loc_byte 1012064
```

Analysis basis: CC v2.1.154 bundle.js:+1010747

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_install_slack_app_clicked` fired immediately on handler entry (bundle.js:+11386784) |
| Telemetry — config lock | `tengu_config_lock_contention` — emitted if lock acquisition is slow (bundle.js:+3208214) |
| Telemetry — stale write | `tengu_config_stale_write` — emitted if config write detects stale data (bundle.js:+3208350) |
| Telemetry — parse error | `tengu_config_parse_error` — emitted on JSON parse failure of config file (bundle.js:+3210789) |
| Telemetry — auth guard | `tengu_config_auth_loss_prevented` — emitted when write is aborted to prevent auth erasure (bundle.js:+3208693) |
| Telemetry — bg session | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_spare_spawn` — background session-management events reachable via shared dispatcher (`w`) |
| Browser side-effect | Opens the Slack app installation URL in the OS default browser via platform-specific command (`open` / `rundll32 url,OpenURL` / `xdg-open`) |
| Config write | Updates global config file under file-system lock with atomic rename strategy; maintains up to 5 rotating backups in a `backups/` subdirectory (bundle.js:+3209144) |
| CLI output | Emits `{ type: "text", content: "Opening Slack app installation page in browser…" }` (bundle.js:+11386917 / +11386930) |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| supportsNonInteractive | `false` — command must not be invoked in non-interactive / headless mode |

---

## Version History

| Version | Change |
|---|---|
| v2.1.154 | Initial analysis |

---

## Common Mistakes

1. **Invoking in non-interactive mode** — `supportsNonInteractive: false` means automated pipelines (e.g. `--no-interactive` or CI contexts) will reject or silently skip this command.
2. **Expecting a URL in CLI output** — the command does not print the destination URL; it only prints the status string `"Opening Slack app installation page in browser…"` and relies on the OS browser to open the page.
3. **Assuming no file I/O occurs** — the command triggers the global config persistence path (`O8`), which acquires a file lock and may write to disk. Concurrent Claude instances may observe lock-contention warnings.
4. **Ignoring the auth-loss guard** — if the on-disk config is missing authentication fields that are held in memory, the config write is silently aborted (and `tengu_config_auth_loss_prevented` is fired) to protect credentials. This is intentional, not a bug.
5. **Expecting cross-platform parity without `xdg-open`** — on Linux systems where `xdg-open` is not installed, the browser-open step will fail silently or with a spawn error; no fallback exists within this depth-2 traversal.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `NeL` | Main async handler for `/install-slack-app` (arbor_handler) |
| `c` | Logging / console utility (called from `NeL` and other utilities) |
| `O8` | Global config persistence wrapper (save-with-lock coordinator) |
| `hz_` | File-system-locked config write core routine |
| `_` | Low-level filesystem abstraction (readdirStringSync, statSync) |
| `B6` | File existence / access check utility |
| `L` | Filesystem module reference (mkdirSync, statSync, readdirStringSync, copyFileSync, unlinkSync) |
| `q` | Secondary filesystem reference (readFileSync, mkdirSync, copyFileSync, statSync, readdirStringSync, unlinkSync) |
| `f` | Temp-file / stream finaliser (close + cleanup) |
| `o$q` | Config object merge / construction utility |
| `k1_` | Config field resolver sub-routine |
| `N` | HTTP request dispatcher (used during config write and network calls) |
| `URK` | HTTP request builder / executor |
| `H` | Retry / jitter helper (Math.random + setTimeout) |
| `RH` | JSON serialiser wrapper (JSON.stringify) |
| `v4` | URL / path formatter utility |
| `HuH` | Header / metadata builder |
| `gRK` | HTTP response handler / streaming reader |
| `J8` | Error classification / re-throw utility |
| `bzH` | Config read-from-disk sub-routine |
| `m6` | Safe JSON parser wrapper |
| `kb` | BOM-strip / string normaliser for config file content |
| `UBq` | Backup directory scanner and pruner |
| `Sz_` | Backup path constructor |
| `w` | Background-session process manager / dispatcher |
| `uz6` | Config cache accessor |
| `A` | String case-normalisation helper |
| `V` | Versioned path / prefix checker |
| `P` | MCP / SDK connection manager |
| `Vb8` | MCP transport factory |
| `hH` | MCP server connector |
| `F_` | Generic error wrapper / normaliser |
| `E` | Byte-slice / stream reader utility |
| `$L6` | Atomic file-write routine (write → fchmod → fsync → rename) |
| `O` | File-stat / symbolic-link checker |
| `P8` | Errno-code wrapper |
| `jQH` | Spawn environment builder |
| `pBq` | Environment-variable entries mapper (Object.entries) |
| `JQH` | Timestamp recorder for config operations |
| `yz_` | Symlink-aware config path resolver |
| `wK` | Cross-platform URL opener (delegates to `open` / `rundll32` / `xdg-open`) |
| `Yn7` | URL scheme validator (accepts only http/https) |
| `xD` | Platform detector (reads `process.platform`) |
| `V8` | Browser-launch orchestrator |
| `W_` | Child-process spawn wrapper with error handling |
| `ZGH` | Spawn options builder / stdio configurator |
| `D` | Background-session lifecycle manager |
| `gA4` | Spawn argument stringifier |
| `Wz` | Process-exit / signal handler |
| `C6` | Async-local-storage context resolver |
| `YB6` | Store-getter for current async context |
| `$_` | Fallback context provider |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.