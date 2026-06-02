---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.157"
updated: "2026-06-02"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.157 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.157 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.157

---

## Overview

`/install-slack-app` is a local slash command that opens the Claude Slack app installation page in the user's default browser. It fires a telemetry event immediately upon invocation, then delegates to the platform-aware URL-opening subsystem to launch the browser, providing a one-step path from the CLI to the Slack integration onboarding flow.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `wC1` |
| load_inline | `true` |
| loc_byte | `11398283` |
| loc_byte_end | `11398469` |
| loc_line | `7499` |
| arbor_handler.name | `PH5` |
| arbor_handler.fqn | `claude-2.1.157::PH5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.157 bundle.js:+11398283

---

## Input Branching

The command takes no user-supplied arguments and has only two meaningful execution paths (happy path and URL-open failure). A simple numbered flow is used.

1. User invokes `/install-slack-app`.
2. Handler `PH5` fires telemetry event `tengu_install_slack_app_clicked`.
3. Handler emits a status message: `"Opening Slack app installation page in browser…"` (bundle.js:+11398035).
4. Handler calls the URL-opener helper (`JK`) with a well-known installation URL.
   - `JK` validates that the URL scheme is `http:` or `https:` (bundle.js:+6698711 / +6698733). If neither matches, an error is thrown via the error-guard helper (`Lo7`).
   - On **macOS** (`darwin`): the `open` command is spawned (bundle.js:+6699020, +6699194).
   - On **Windows** (`win32`): `rundll32 url,OpenURL` is invoked (bundle.js:+6699036, +6699120, +6699132).
   - On all other platforms (Linux/etc.): `xdg-open` is used (bundle.js:+6699201).
5. Handler returns a `text`-typed result (bundle.js:+11398022).

---

## Behavioral Spec

### Top-level handler (`PH5`)

```
async function installSlackAppHandler(context):
    emit telemetry("tengu_install_slack_app_clicked")
    // Analysis basis: CC v2.1.157 bundle.js:+11397889

    configPersistenceSubsystem = initConfigWithLock()
    // Analysis basis: CC v2.1.157 bundle.js:+11397927

    statusText = "Opening Slack app installation page in browser…"
    openUrl(SLACK_INSTALL_URL)
    // Analysis basis: CC v2.1.157 bundle.js:+11398035

    return { type: "text", content: statusText }
    // Analysis basis: CC v2.1.157 bundle.js:+11398022
```

### URL opener (`JK`)

```
function openUrlInBrowser(url):
    if url.protocol not in ["http:", "https:"]:
        throw errorGuard("invalid protocol")
        // Analysis basis: CC v2.1.157 bundle.js:+6698711, +6698733, +6698661

    platform = detectPlatform()
    // Analysis basis: CC v2.1.157 bundle.js:+6698961

    if platform == "darwin":
        spawn("open", [url])
        // Analysis basis: CC v2.1.157 bundle.js:+6699020, +6699194
    else if platform == "win32":
        spawn("rundll32", ["url,OpenURL", url])
        // Analysis basis: CC v2.1.157 bundle.js:+6699036, +6699120, +6699132
    else:
        spawn("xdg-open", [url])
        // Analysis basis: CC v2.1.157 bundle.js:+6699201
```

### Config lock subsystem (`z8` / `AY_`)

The handler touches the config persistence subsystem (via helper `z8`) early in its lifecycle. This subsystem manages file-based locking for `~/.claude.json` writes and backs up the config file before mutation.

```
function saveConfigWithLock(newConfig):
    acquireFileLock()
    // If lock contention detected: emit tengu_config_lock_contention
    // Warning emitted: "Lock acquisition took longer than expected…"
    // Analysis basis: CC v2.1.157 bundle.js:+3207889, +3207978

    reRead = readConfigFromDisk()
    if reRead is missing auth that in-memory cache has:
        emit tengu_config_stale_write
        // Refuse to write to prevent wiping auth
        // Analysis basis: CC v2.1.157 bundle.js:+3208305, +3208457
        return

    rotateDailyBackup(configPath)
    // Keeps up to 5 rolling backups (bundle.js:+3208908)
    // Backup files identified by ".backup." prefix (bundle.js:+3208775)
    // Timeout for lock: 60000 ms (bundle.js:+3208659)

    writeConfigAtomically(newConfig, permissions=384)
    // 384 = 0o600 (owner read/write only)
    // Analysis basis: CC v2.1.157 bundle.js:+3209190
```

### Atomic file writer (`yL6`)

```
function atomicWriteFile(targetPath, data):
    tempPath = targetPath + "." + randomBytes(6).toString("hex")
    // Analysis basis: CC v2.1.157 bundle.js:+1012273, +1012301

    fd = openSync(tempPath)
    writeFileSync(fd, data)
    fchmodSync(fd, originalPermissions)
    // Log: "Applied original permissions to temp file"
    // Analysis basis: CC v2.1.157 bundle.js:+1012788

    fsyncSync(fd)
    closeSync(fd)
    renameSync(tempPath, targetPath)
    // Analysis basis: CC v2.1.157 bundle.js:+1012961

    on error (ELOOP, ENOTDIR):
        unlinkSync(tempPath)
        // Analysis basis: CC v2.1.157 bundle.js:+1011930, +1011943, +1013118
```

### Background session dispatcher (`D` / `w`)

The call graph reaches the background session dispatcher at depth 2 (via `v8` → `G_`). This subsystem manages spare background Claude processes:

- SIGKILL escalation after 30 s / 15 s grace period (bundle.js:+15466906, +15466917, +15466999)
- Low-memory detection via `os.freemem()` (bundle.js:+15467360)
- Spare session pool management (bundle.js:+15467721)
- Version metadata constants embedded: `"2.1.157"`, build timestamp `"2026-05-29T16:21:19Z"`, commit `"11776d26..."` (bundle.js:+15468049, +15468138, +15468169)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry (primary) | `tengu_install_slack_app_clicked` (bundle.js:+11397889) — fired immediately on invocation |
| Telemetry (config subsystem) | `tengu_config_lock_contention` (+3207978), `tengu_config_stale_write` (+3208114), `tengu_config_parse_error` (+3210553), `tengu_config_auth_loss_prevented` (+3208457) |
| Telemetry (background session) | `tengu_bg_dispatch_sigkill_escalate` (+15466951), `tengu_bg_dispatch_low_mem` (+15467530), `tengu_bg_spare_enable` (+15468225), `tengu_bg_spare_claim` (+15468346), `tengu_bg_spare_claim_fail` (+15468609), `tengu_bg_spare_spawn` (+15466644), `tengu_bg_spare_enable` (+15468225) |
| Browser side effect | Launches system browser with Slack app installation URL |
| Config side effect | May acquire file lock on `~/.claude.json`; creates timestamped backup in `backups/` subdirectory (bundle.js:+3209490) |
| Atomic temp files | Writes temp file with `.backup.` or hex-suffixed name; cleans up on success or ELOOP/ENOTDIR error |
| supportsNonInteractive | `false` — requires an interactive terminal session |
| Return value | `{ type: "text" }` message to the REPL (bundle.js:+11398022) |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.157 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `supportsNonInteractive` is `false`; invoking `/install-slack-app` in a scripted or piped session will fail or produce no output.
2. **Expecting a return URL or token**: The command only opens a browser page — it does not authenticate, capture OAuth callbacks, or modify Claude's configuration with Slack credentials. Completing installation requires action inside the browser.
3. **Firewall / sandboxed environments**: The command depends on `open` (macOS), `rundll32` (Windows), or `xdg-open` (Linux) being available in `PATH`. In containerised or headless environments with no display server, the browser launch will fail.
4. **Confusing config-lock warnings with command failure**: The `"Lock acquisition took longer than expected"` warning (bundle.js:+3207889) originates in the config subsystem touched on startup, not in the Slack URL-opening step itself. The command may still succeed even if this warning appears.
5. **Assuming the URL is editable**: The Slack installation URL is hard-coded in the bundle; there is no configuration key to redirect it to a custom Slack or enterprise endpoint.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `PH5` | Top-level async command handler for `/install-slack-app` |
| `d` | Logger / debug output helper |
| `z8` | Config-with-lock save orchestrator (entry point) |
| `AY_` | Config file persistence core (backup, atomic write, lock loop) |
| `_` | Filesystem abstraction / VFS layer |
| `g6` | Path existence / guard helper |
| `L` | Primary `fs` module binding |
| `q` | Secondary `fs` module binding (used for read/copy/unlink) |
| `f` | File handle / stream closer |
| `dOq` | Config serialisation / merge helper |
| `qK_` | Config schema validator |
| `N` | HTTP request / network helper |
| `QCK` | HTTP client core |
| `H` | Retry / jitter scheduler |
| `RH` | JSON stringifier wrapper |
| `v4` | URL parser / normaliser |
| `EuH` | Header builder helper |
| `lCK` | HTTP response body reader |
| `j8` | Error logging helper |
| `szH` | Config file reader with parse-error handling |
| `p6` | JSON safe-parser |
| `gb` | String prefix stripper |
| `yFq` | Config directory scanner (backup enumeration) |
| `qY_` | Backup path builder |
| `w` | Background process / daemon manager |
| `AY6` | Config cache accessor |
| `A` | Map-based process registry |
| `V` | Directory entry filter |
| `P` | MCP / SDK connection manager |
| `Lx8` | SDK transport factory |
| `SH` | MCP server connector |
| `F_` | Error constructor wrapper |
| `E` | Backup entry array |
| `yL6` | Atomic file writer |
| `O` | File stat / symlink inspector |
| `P8` | Error code checker |
| `pQH` | Timestamp formatter |
| `IFq` | Object entries iterator helper |
| `UQH` | Date-based lock-file nonce generator |
| `_Y_` | Symlink-aware config path resolver |
| `JK` | Cross-platform URL opener |
| `Lo7` | Protocol validation / error guard |
| `FD` | Platform detector |
| `v8` | Browser-launch orchestrator |
| `G_` | Child-process spawner with timeout |
| `RGH` | Spawn option builder |
| `D` | Background session lifecycle manager |
| `lq4` | String coercion / command builder |
| `kz` | Process exit-code inspector |
| `h6` | Async-local-storage context reader |
| `lB6` | Context store getter |
| `O_` | Ambient-context provider |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.