---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.198"
updated: "2026-07-02"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.198 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.198 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.198

---

## Overview

`/install-slack-app` is a local slash command that initiates the installation flow for the Claude Slack app. When invoked, it fires a telemetry event, displays a brief status message in the terminal, and opens the Slack app installation page in the system's default browser. The command is non-interactive and completes synchronously after launching the browser.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `o8l` |
| load_inline | `true` |
| loc_byte | `12224839` |
| loc_byte_end | `12225025` |
| arbor_handler.name | `Tjf` |
| arbor_handler.fqn | `claude-2.1.198::Tjf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.198 bundle.js:+12224839

---

## Input Branching

The command follows a simple linear flow with no conditional branching on user input (no arguments are expected or inspected). A single numbered list is appropriate here.

1. Command is invoked by the user.
2. Telemetry event `tengu_install_slack_app_clicked` is fired.
3. A status text message (`"Opening Slack app installation page in browser…"`) is written to the terminal output.
4. The URL-opener utility (`Lc` / `openUrlInBrowser`) is called to launch the installation page.
5. Control returns; the command exits.

---

## Behavioral Spec

### Main Handler (`Tjf` — async command entry point)

The handler is an `AsyncFunction` resolved via `module_id → o8l` by Arbor.

```
async function installSlackAppHandler(context):
    fireEvent("tengu_install_slack_app_clicked")         // telemetry
    writeToTerminal({type: "text",
        content: "Opening Slack app installation page in browser…"})
    await openUrlInBrowser(SLACK_APP_INSTALL_URL)
    return
```

Analysis basis: CC v2.1.198 bundle.js:+12224443 (telemetry call), +12224558 (browser-open call), +12224591 (status string literal)

---

### Browser URL Opener (`Lc` / `openUrlInBrowser`)

Called directly from `Tjf`. Internally delegates to `TYr` (platform URL launcher) which:

1. Validates that the URL scheme is either `http:` or `https:` — rejects others with `invalid_url`.
2. Detects the host platform (`darwin`, `linux`, etc.).
3. On **macOS (`darwin`)**: spawns the platform `open` command.
4. On **Linux**: checks for a `DISPLAY` environment variable; if absent, records `no_display`; otherwise invokes the system opener binary.
5. Handles subprocess error cases:
   - Exit code `127` → `opener_missing`
   - `ETIMEDOUT` / `timed out` → `timeout`
   - Non-zero exit → `nonzero_exit`
   - Spawn failure → `spawn_error`

```
function openUrlInBrowser(url):
    if not (url.startsWith("http:") or url.startsWith("https:")):
        throw Error("invalid_url")

    platform = detectPlatform()    // "darwin" | "linux" | other

    if platform == "darwin":
        spawnOpener(["open", url])
    elif platform == "linux":
        if not hasDisplay():
            recordOutcome("no_display")
            return
        spawnOpener([systemOpenerBinary(), url])
    else:
        spawnOpener([fallbackOpener(), url])

    on subprocess result:
        if exitCode == 127:  recordOutcome("opener_missing")
        elif timedOut:       recordOutcome("timeout")
        elif exitCode != 0:  recordOutcome("nonzero_exit")
        // spawn failure path → recordOutcome("spawn_error")
```

Analysis basis: CC v2.1.198 bundle.js:+3175910 (`http:`), +3175932 (`https:`), +3177102 (`invalid_url`), +3177313 (`darwin`), +3176998 (`linux`), +3177355 (`no_display`), +3177598 (exit code `127`), +3177644 (`opener_missing`), +3177685 (`ETIMEDOUT`), +3177743 (`timeout`), +3177828 (`spawn_error`), +3177884 (`nonzero_exit`)

---

### Config Lock & Persistence Layer (called transitively via `_n` → `Onn`)

The `_n` / `saveConfig` path and its subsidiary `Onn` / `saveConfigWithLock` are reachable from the handler's call graph, indicating that some configuration state may be persisted as a side-effect of command execution (e.g., recording that the command was used). Key behaviors observed in this layer:

- Acquires a filesystem lock before writing; contention is reported via `tengu_config_lock_contention`.
- Lock wait timeout: **60 000 ms** (bundle.js:+14256485).
- Warns if lock acquisition takes longer than expected: `"Lock acquisition took longer than expected - another Claude instance may be running"` (bundle.js:+14255347).
- Re-reads config under lock before writing to avoid stale writes (`tengu_config_stale_write`).
- If the re-read config is missing auth credentials that the in-memory cache holds, the write is **refused** to prevent wiping `~/.claude.json` (`tengu_config_auth_loss_prevented`) — references GH #3117.
- On parse error after re-read, auto-repairs from cache (`tengu_config_auto_repaired`, `tengu_config_parse_error`).
- Keeps up to **5** rolling backup files in a `backups/` subdirectory, named with a `.backup.` infix and a `Date.now()` timestamp (bundle.js:+14256740, +14256601, +14257323).
- Files are written with mode `384` (octal `0o600`, owner read/write only) (bundle.js:+14257022).
- A config fallback write is tracked via `tengu_config_fallback_write`.

```
function saveConfigWithLock(newConfig):
    acquireFileLock(timeout=60000)  // warn if contention detected
    storedConfig = readConfigFromDisk()

    if storedConfig has parse error:
        logEvent("tengu_config_parse_error")
        autoRepairFromCache()
        logEvent("tengu_config_auto_repaired")
        return

    if cachedConfig.hasAuth and not storedConfig.hasAuth:
        logEvent("tengu_config_auth_loss_prevented")
        return   // refuse write — GH #3117

    writeConfigAtomically(newConfig, mode=0o600)
    pruneBackupsKeepLatest(n=5)
    releaseLock()
```

Analysis basis: CC v2.1.198 bundle.js:+14251949 (`_n`), +14255136 (`Onn`), +14255436, +14255572, +14255821, +14256127, +14255949, +14256279, +14255052, +14256485, +14257022, +14256740

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_install_slack_app_clicked` | Fired immediately upon command invocation (bundle.js:+12224445) |
| Telemetry: `tengu_config_lock_contention` | Fired if the config file lock is contested during any config save (bundle.js:+14255436) |
| Telemetry: `tengu_config_stale_write` | Fired if a stale-write guard is triggered (bundle.js:+14255572) |
| Telemetry: `tengu_config_parse_error` | Fired if config JSON cannot be parsed on re-read (bundle.js:+14259169) |
| Telemetry: `tengu_config_auto_repaired` | Fired when config is auto-repaired from in-memory cache (bundle.js:+14255949) |
| Telemetry: `tengu_config_auth_loss_prevented` | Fired when a write is refused to prevent auth data loss (bundle.js:+14256279) |
| Telemetry: `tengu_config_fallback_write` | Fired when a fallback write path is used (bundle.js:+14255052) |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Background daemon escalation (transitive, not directly triggered by this command) |
| Telemetry: `tengu_bg_dispatch_low_mem` | Background daemon low-memory event (transitive) |
| Telemetry: `tengu_bg_spare_enable` / `_claim` / `_claim_fail` | Background spare-session lifecycle (transitive) |
| Telemetry: `tengu_daemon_config_reload` | Fired when the daemon reloads config (transitive) |
| Terminal output | Writes `"Opening Slack app installation page in browser…"` (type: `text`) to stdout (bundle.js:+12224591) |
| Browser side effect | Spawns the system browser/opener process targeting the Slack app installation URL |
| Config file | May write to `~/.claude.json` with mode `0o600`; maintains up to 5 timestamped backups |
| appState changes | No direct appState mutation observed in depth-2 traversal |
| Sound | None observed |
| Hook registration | None observed |

---

## Version History

| Version | Change |
|---|---|
| v2.1.198 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive contexts**: `supportsNonInteractive` is `false`. Invoking `/install-slack-app` in a CI pipeline or headless session will not open a browser and may produce no useful output.
2. **Missing display on Linux**: On Linux hosts without a `DISPLAY` environment variable, the browser will not open and the opener will silently record a `no_display` outcome. Ensure a graphical environment is available before running this command.
3. **Firewall / scheme restrictions**: The URL opener validates that the scheme is `http:` or `https:`. Custom proxy URLs using other schemes will cause an `invalid_url` error.
4. **Concurrent Claude instances and config locks**: If another Claude process holds the config file lock, this command may log a contention warning and experience up to a 60-second wait before proceeding.
5. **Assuming command output confirms installation**: The command only opens the browser page; it does not poll for or confirm that the Slack app was successfully authorized or installed.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Tjf` | Main async handler for `/install-slack-app` (arbor_handler) |
| `V` | Telemetry / event-fire utility |
| `_n` | Save-config entry point (calls `Onn`) |
| `Onn` | `saveConfigWithLock` — config persistence with file locking |
| `zt` | Path / filesystem helper |
| `sfi` | Config serialization helper |
| `uGr` | Inner serialization helper (called by `sfi`) |
| `T` | Terminal / output writer |
| `Hiu` | Output formatter sub-routine |
| `Me` | JSON stringify wrapper |
| `Oc` | String sanitization / redaction utility |
| `YZe` | Output options builder |
| `biu` | Subprocess / child-process runner |
| `en` | Error normalizer |
| `SCt` | Config read / backup manager |
| `Gt` | JSON parse wrapper |
| `c6` | String prefix-strip utility |
| `I7o` | Directory reader with prefix filtering |
| `v7o` | Path join helper |
| `ACt` | Config access guard |
| `n` | String lowercase helper |
| `_` | Message-list builder |
| `g` | Background daemon session manager |
| `h` | Push-to-list helper |
| `vgm` | UUID generator for system messages |
| `xn` | Session-ID factory |
| `HC` | Session header constructor |
| `I` | Scroll / cursor position utility |
| `R` | OAuth / HTTP request router |
| `A` | User-info fetcher |
| `BMt` | Atomic file write utility (with locking, fsync, temp-file rename) |
| `Wd` | Real-path resolver |
| `d` | MCP supervisor / server lifecycle manager |
| `mn` | Error annotation helper |
| `zws` | Lock-file writer |
| `$Mt` | File open/stat/close helper |
| `ant` | Extended-attribute / permission error handler |
| `$Dr` | Platform write-helper dispatcher |
| `eLs` | Property-definition utility |
| `TFe` | Config type/version checker |
| `b7o` | Object-entries iterator for config migration |
| `Dnn` | Timestamp recorder |
| `Mnn` | Config merge helper |
| `Kfr` | Global config save with fallback |
| `Pe` | Promise/queue entry |
| `OQe` | Queue base |
| `Lc` | Browser URL opener (calls `TYr`) |
| `TYr` | Platform URL-launch dispatcher |
| `aBd` | URL scheme validator |
| `cMi` | Platform-specific opener spawner |
| `HH` | macOS opener constant (`"open"`) |
| `lMi` | Linux opener resolver |
| `cBd` | Opener exit-code classifier |
| `Dn` | Subprocess spawn wrapper |