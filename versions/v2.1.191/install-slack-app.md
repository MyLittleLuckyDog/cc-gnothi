---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.191"
updated: "2026-06-25"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.191 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.191 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.191

---

## Overview

`/install-slack-app` is a local slash command that opens the Claude Slack app installation page in the user's default browser. It fires a single telemetry event on invocation, emits a status message to the terminal, and then delegates to the system URL-opener to launch the browser — performing no network requests itself and requiring no arguments.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `dxl` |
| load_inline | `true` |
| loc_byte | `11792134` |
| loc_byte_end | `11792320` |
| loc_line | `7864` |
| arbor_handler.name | `IHf` |
| arbor_handler.fqn | `claude-2.1.191::IHf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.191 bundle.js:+11792134

---

## Input Branching

This command has a simple linear flow (no user-provided arguments, no conditional branching on input). A numbered pseudocode sequence is appropriate.

1. Command is invoked with no arguments.
2. Fire telemetry event `tengu_install_slack_app_clicked`.
3. Call the logging/output helper (`W`) to print the status string `"Opening Slack app installation page in browser…"`.
4. Call the URL-open helper (`gn`) with the Slack app installation URL.
5. Return (command completes immediately).

---

## Behavioral Spec

### Main Handler — `installSlackAppHandler` (bundle: `IHf`)

```
async function installSlackAppHandler(context):
    # Step 1: emit click telemetry
    fireEvent("tengu_install_slack_app_clicked")
    # Analysis basis: CC v2.1.191 bundle.js:+11791740

    # Step 2: print status line to terminal
    printOutput("Opening Slack app installation page in browser…")
    # Analysis basis: CC v2.1.191 bundle.js:+11791886

    # Step 3: open URL in system browser
    openUrlInBrowser(SLACK_APP_INSTALL_URL)
    # Analysis basis: CC v2.1.191 bundle.js:+11791778

    return
```

Analysis basis: CC v2.1.191 bundle.js:+11791738

---

### URL-Open Sub-routine — `openUrl` (bundle: `gn`)

```
function openUrl(url):
    # Validate URL scheme (only "http:" and "https:" are accepted)
    # Analysis basis: CC v2.1.191 bundle.js:+3120050, +3120072
    if NOT url.startsWith("http:") AND NOT url.startsWith("https:"):
        throw Error("Invalid URL scheme")

    # Platform detection for open command
    if platform == "darwin":
        # Analysis basis: CC v2.1.191 bundle.js:+3121304
        command = "open"
        # Analysis basis: CC v2.1.191 bundle.js:+3121323
    else:
        command = platformDefaultOpenCommand()

    # Delegate to system URL-opener helper
    invokeUrlOpener(url, command)
    # Analysis basis: CC v2.1.191 bundle.js:+3121174, +3121187
```

Analysis basis: CC v2.1.191 bundle.js:+13862115

---

### Config-Lock Write Sub-routine — `saveConfigWithLock` (bundle: `U7t`)

Although not directly user-visible, this routine is reachable from `gn` and guards any config-file mutations that may occur as a side effect of the command lifecycle (e.g., recording that the app was opened).

```
async function saveConfigWithLock(configPath, updater):
    # Acquire filesystem lock; warn if contention detected
    acquire lock at configPath
    if lock acquisition took longer than expected:
        emit warning: "Lock acquisition took longer than expected - another Claude instance may be running"
        fire event "tengu_config_lock_contention"
        # Analysis basis: CC v2.1.191 bundle.js:+13865461, +13865550

    # Re-read config from disk under lock
    try:
        diskConfig = readConfigFile(configPath, encoding="utf-8")
    except ParseError:
        # Auto-repair from in-memory cache (GH #3117)
        log "saveConfigWithLock: re-read hit a parse error; auto-repairing from cached config under lock."
        fire event "tengu_config_auto_repaired"
        # Analysis basis: CC v2.1.191 bundle.js:+13865935, +13866063
        diskConfig = cachedConfig

    # Guard: refuse to write if re-read config is missing auth that cache has
    if cachedConfig.hasAuth AND NOT diskConfig.hasAuth:
        log "saveConfigWithLock: re-read config is missing auth that cache has; refusing to write."
        fire event "tengu_config_auth_loss_prevented"
        # Analysis basis: CC v2.1.191 bundle.js:+13866241, +13866393
        release lock
        return

    # Apply updater and write atomically
    newConfig = updater(diskConfig)
    writeFileSyncAndFlush(configPath, newConfig)
    # Analysis basis: CC v2.1.191 bundle.js:+13865277

    release lock
```

Analysis basis: CC v2.1.191 bundle.js:+13865250

---

### Atomic File-Write Sub-routine — `writeFileSyncAndFlush` (bundle: `Rvt`)

```
function writeFileSyncAndFlush(targetPath, content):
    # Resolve symlinks for safety
    resolvedPath = resolveSymlinks(targetPath)
    # Analysis basis: CC v2.1.191 bundle.js:+1100692

    # Generate a random temp path
    randomSuffix = randomBytes(6).toString("hex")
    # Analysis basis: CC v2.1.191 bundle.js:+1101340, +1101368

    tempPath = targetPath + "." + randomSuffix

    # Write to temp file then fsync
    writeFileSync(tempPath, content, mode=0o600)
    # Analysis basis: CC v2.1.191 bundle.js:+1101788
    applyOriginalPermissions(tempPath)
    # Analysis basis: CC v2.1.191 bundle.js:+1101850, +1101871
    fsyncSync(tempPath)
    # Analysis basis: CC v2.1.191 bundle.js:+1101997

    # Atomic rename
    renameSync(tempPath, resolvedPath)
    # Analysis basis: CC v2.1.191 bundle.js:+1102328

    # Cleanup on failure paths
    if error in [EACCES, ELOOP, ENOTDIR, EINVAL, ENOTSUP, EPERM, ENOSYS]:
        log "writeFileSyncAndFlush: in-place fallback write failed; content preserved at temp path"
        # Analysis basis: CC v2.1.191 bundle.js:+1103283
```

Analysis basis: CC v2.1.191 bundle.js:+1100605

---

### Config Backup Sub-routine — `backupAndReadConfig` (bundle: `tEt`)

```
function backupAndReadConfig(configPath):
    # Guard: config must not be accessed before initialization
    if NOT configAccessAllowed:
        throw Error("Config accessed before allowed.")
        # Analysis basis: CC v2.1.191 bundle.js:+13867869

    raw = readFileSync(configPath, encoding="utf-8")
    # Analysis basis: CC v2.1.191 bundle.js:+13867952

    parsed = JSON.parse(raw)
    # Analysis basis: CC v2.1.191 bundle.js:+13867972

    # Maintain rolling backups directory
    backupDir = join(configDir, "backups")
    # Analysis basis: CC v2.1.191 bundle.js:+13867437
    mkdirSync(backupDir, recursive=true)

    # Copy current config to timestamped backup
    timestamp = Date.now()
    backupPath = join(backupDir, basename(configPath) + "." + timestamp)
    copyFileSync(configPath, backupPath)
    # Analysis basis: CC v2.1.191 bundle.js:+13868866

    # Prune old backups; keep at most 5
    entries = readdirStringSync(backupDir)
    backupEntries = entries.filter(e => e.startsWith(".backup."))
    if len(backupEntries) > 5:
        remove oldest entries
        # Analysis basis: CC v2.1.191 bundle.js:+13866854

    # Permissions: new config file created with mode 0o600
    # Analysis basis: CC v2.1.191 bundle.js:+13867136 (value: 384 decimal = 0o600)

    return parsed
```

Analysis basis: CC v2.1.191 bundle.js:+13867863

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_install_slack_app_clicked` | Fired immediately on handler entry (bundle.js:+11791740) |
| Telemetry — `tengu_config_lock_contention` | Fired when config-lock acquisition is delayed (bundle.js:+13865550) |
| Telemetry — `tengu_config_stale_write` | Fired if a stale write is detected during config save (bundle.js:+13865686) |
| Telemetry — `tengu_config_parse_error` | Fired when config JSON cannot be parsed from disk (bundle.js:+13869283) |
| Telemetry — `tengu_config_auto_repaired` | Fired when config is auto-repaired from cache under lock (bundle.js:+13866063) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a write is refused to prevent auth data loss (bundle.js:+13866393) |
| Telemetry — `tengu_config_fallback_write` | Fired when fallback write path is used (bundle.js:+13865166) |
| Telemetry — `tengu_daemon_yield` | Fired if a background daemon yields to foreground (bundle.js:+17391071) |
| Telemetry — `tengu_daemon_control` | Fired on daemon start/stop control events (bundle.js:+17408260) |
| Terminal output | Prints `"Opening Slack app installation page in browser…"` to stdout (bundle.js:+11791886) |
| Browser launch | Calls the system URL-opener (`open` on macOS) to navigate to the Slack app install page (bundle.js:+3121323) |
| Config file | Config may be read and written (with backup) as part of the command lifecycle; atomic write with fsync is used (bundle.js:+1101997) |
| Config backups | Rolling backup directory (`backups/`) is maintained; at most 5 backups are retained (bundle.js:+13867437, +13866854) |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | None observed in traversal |
| `supportsNonInteractive` | `false` — command must be run in an interactive session |

---

## Version History

| Version | Change |
|---|---|
| v2.1.191 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `supportsNonInteractive` is `false` (bundle.js:+11792134). Attempting to invoke `/install-slack-app` in a non-interactive pipeline or script will fail or be silently skipped.
2. **Expecting a return value**: The command is fire-and-forget. It opens the browser and returns immediately; there is no confirmation that the browser actually loaded the page or that installation succeeded.
3. **Concurrent Claude instances**: If another Claude instance holds the config file lock, the command will log a contention warning and the `tengu_config_lock_contention` event will be emitted. This is not a fatal error but may cause a brief delay.
4. **Auth loss guard**: If the on-disk config is missing authentication data that the in-memory cache holds, the config write is refused and `tengu_config_auth_loss_prevented` is emitted. This is a safety guard (GH #3117) and does not block the Slack URL from opening.
5. **macOS vs. other platforms**: The URL-opener uses `open` on `darwin` (bundle.js:+3121304). On other operating systems a different platform default is used; if the platform is unrecognised the command may fail to open the browser.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `IHf` | Main handler — `installSlackAppHandler` (AsyncFunction) |
| `W` | Terminal output / logging helper |
| `gn` | URL-open orchestrator (opens Slack install URL in browser) |
| `U7t` | Config-save-with-lock routine |
| `t` | Filesystem abstraction / `fs` wrapper (read/stat operations) |
| `Gt` | Path resolution / normalisation helper |
| `s` | Secondary filesystem / stream helper |
| `r` | Tertiary filesystem / file-operation helper |
| `i` | Stream or handle finaliser (close operations) |
| `kzs` | Config merge / object-assign helper |
| `hOr` | Config initialiser sub-helper |
| `T` | HTTP request / API call dispatcher |
| `wNc` | HTTP response handler |
| `e` | Context-tips classifier / message processor |
| `ke` | JSON serialiser wrapper |
| `Dc` | String redaction / sanitisation helper |
| `a7e` | Supplementary string helper |
| `kNc` | HTTP transport layer |
| `dn` | Debug/warning logger |
| `tEt` | Config backup-and-read routine |
| `$t` | JSON parse wrapper |
| `n4` | String prefix-strip helper |
| `L2o` | Directory listing and backup path builder |
| `R2o` | Backup sub-path join helper |
| `m` | Process/worker manager (signal dispatch) |
| `nEt` | Config auth-loss guard helper |
| `n` | Case-normalisation helper (toLowerCase) |
| `w` | Directory entry filter predicate |
| `y` | Filesystem / path computation helper |
| `PGe` | Teammate mailbox — `markMessagesAsRead` |
| `I` | Scroll / viewport index calculation helper |
| `k` | Daemon write / process I/O handler |
| `A` | Async task coordinator |
| `Rvt` | Atomic file write with fsync (`writeFileSyncAndFlush`) |
| `jd` | Symlink real-path resolver |
| `u` | Daemon-stop sequence handler |
| `vn` | Error construction helper |
| `hXe` | fsync error-suppression helper (EINVAL/ENOTSUP/EPERM/ENOSYS) |
| `ius` | Module-export property definer |
| `dOe` | Config entry deserialiser |
| `v2o` | Config entries iterator (`Object.entries` wrapper) |
| `O7t` | Config timestamp recorder |
| `P7t` | Config pre-save validator |
| `Xnr` | Global config symlink-write handler |
| `Pe` | Post-write finaliser |
| `eze` | Write-complete callback |
| `sc` | URL validation and system-open dispatcher |
| `spd` | URL scheme validator (rejects non-http/https) |
| `Umi` | Platform-specific open-command selector |
| `Yh` | Open-command argument builder |
| `Nn` | Child-process spawner for URL opener |
| `Kr` | Process execution / spawn wrapper |
| `Dt` | Process lifecycle manager |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.