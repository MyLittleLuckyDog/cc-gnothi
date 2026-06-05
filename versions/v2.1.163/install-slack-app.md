---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.163"
updated: "2026-06-05"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.163 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.163 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.163

---

## Overview

The `/install-slack-app` command opens the Claude Slack app installation page in the user's default browser. It is a lightweight, non-interactive local command that fires a telemetry event, calls a URL-opener utility, and then displays a short status message confirming that the browser was launched.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| loc_byte | `11641791` |
| loc_byte_end | `11641977` |
| loc_line | `8161` |
| supportsNonInteractive | `false` |
| module_id | `Mdq` |
| load_inline | `true` |
| arbor_handler.name | `b2f` |
| arbor_handler.fqn | `claude-2.1.163::b2f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.163 bundle.js:+11641791

---

## Input Branching

The command takes no user-supplied arguments and has a linear flow (no conditional branching on input). A numbered pseudocode representation is sufficient.

1. Command is invoked.
2. Telemetry event `tengu_install_slack_app_clicked` is emitted.
3. The URL-opener utility (`openURL`) is called to open the Slack app installation URL in the default browser.
4. A text response object `{ type: "text", value: "Opening Slack app installation page in browser…" }` is returned to the UI.

---

## Behavioral Spec

### Main Handler — `installSlackAppHandler`

The handler is resolved as `b2f` (AsyncFunction) via `module_id → Mdq` resolution path.

Analysis basis: CC v2.1.163 bundle.js:+11641395

```
async function installSlackAppHandler(context):
    // Step 1: Emit telemetry
    emitTelemetry("tengu_install_slack_app_clicked")         // +11641397

    // Step 2: Open the Slack app installation page
    openURL(slackInstallUrl)                                  // +11641435

    // Step 3: Return confirmation message to the user
    return {
        type: "text",                                         // +11641530
        value: "Opening Slack app installation page in browser…"  // +11641543
    }
```

Analysis basis: CC v2.1.163 bundle.js:+11641395 – +11641543

---

### Sub-feature: URL Opener (`openURL` / `X8`)

The `openURL` utility (identifier `X8`) is called from the handler and dispatches a platform-specific command to open a URL in the default browser.

Analysis basis: CC v2.1.163 bundle.js:+11641435

```
function openURL(url):
    // Validate URL scheme (http: or https: only)           // +6803777, +6803799
    if scheme not in ["http:", "https:"]:
        throw Error

    platform = detectPlatform()                             // +6804086, +6804102

    if platform == "darwin":
        spawn("open", [url])                                // +6804260

    else if platform == "win32":
        spawn("rundll32", ["url,OpenURL", url])             // +6804186, +6804198

    else:  // Linux / other
        spawn("xdg-open", [url])                            // +6804267
```

Analysis basis: CC v2.1.163 bundle.js:+6803727 – +6804267

---

### Sub-feature: Config Lock / Save Pathway (`saveConfigWithLock` / `SX_`)

`openURL` internally touches the config system through a shared utility chain (`X8` → `SX_`). This sub-feature manages file-system config writes with locking to prevent concurrent corruption.

Analysis basis: CC v2.1.163 bundle.js:+3256721

```
function saveConfigWithLock(configPath, updateFn):
    acquire filesystem lock for configPath                  // +3259607
    ensure parent directory exists via mkdirSync            // +3259634

    timeout = Date.now() + lockTimeoutMs                    // +3259679
    if lock contention detected:
        emit "tengu_config_lock_contention"                 // +3259907
        log warning: "Lock acquisition took longer than
                      expected - another Claude instance
                      may be running"                       // +3259818

    currentConfig = readConfigFile(configPath)              // +3261907

    if re-read config is missing auth that cache has:
        emit "tengu_config_stale_write"                     // +3260043 / +3260386
        log: "saveConfigWithLock: re-read config is
              missing auth…refusing to write…GH #3117"     // +3260234
        return  // abort write to prevent auth loss

    newConfig = updateFn(currentConfig)
    writeConfigAtomically(configPath, newConfig)            // via TM6 atomic-write
    releaseLock()
```

Maximum directory-scan backup count: 5 (bundle.js:+3260837)
Config file mode bits applied on write: `0o600` / decimal 384 (bundle.js:+3261119)
Config read timeout guard: 60 000 ms (bundle.js:+3260588)

Analysis basis: CC v2.1.163 bundle.js:+3256721

---

### Sub-feature: Atomic File Writer (`atomicWriteFile` / `TM6`)

Writes config or other files atomically using a temporary file + rename pattern to prevent partial writes.

Analysis basis: CC v2.1.163 bundle.js:+1056664

```
function atomicWriteFile(targetPath, data):
    // Generate a random temp file name
    randomSuffix = randomBytes(6).toString("hex")           // +1057380, +1057408
    tempPath = join(dirname(targetPath), "." + randomSuffix)

    fd = fs.openSync(tempPath, flags)                       // +1056910
    fs.writeFileSync(fd, data)                              // +1057816

    // Preserve original permissions if target exists
    try:
        stat = fs.lstatSync(targetPath)                     // +1057148
        if stat.isSymbolicLink():
            resolvedPath = resolveSymlink(targetPath)       // +1056790
        fs.fchmodSync(fd, originalMode)                     // +1057874
        log "Applied original permissions to temp file"     // +1057895
    except [ELOOP, ENOTDIR, ENOENT]:                        // +1057037, +1057050
        pass  // no existing file; use default permissions

    fs.fsyncSync(fd)                                        // +1057940
    fs.closeSync(fd)                                        // +1056897
    fs.renameSync(tempPath, targetPath)                     // +1058068
```

Analysis basis: CC v2.1.163 bundle.js:+1056664 – +1058225

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_install_slack_app_clicked` (bundle.js:+11641397) — emitted on every invocation |
| Telemetry — config lock | `tengu_config_lock_contention` (bundle.js:+3259907) — emitted if another Claude instance holds the config lock |
| Telemetry — stale write | `tengu_config_stale_write` (bundle.js:+3260043) — emitted when auth-loss guard fires |
| Telemetry — auth loss prevented | `tengu_config_auth_loss_prevented` (bundle.js:+3260386) — emitted on GH-3117 guard trip |
| Telemetry — config parse error | `tengu_config_parse_error` (bundle.js:+3262482) — emitted if config JSON is malformed |
| Telemetry — daemon/bg (indirect) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_retire_pinned_low_mem`, `tengu_bg_prewarm_per_sweep`, `tengu_daemon_control`, `tengu_daemon_config_reload` — all reachable through shared daemon/background infrastructure traversed by the depth-2 call graph; not specific to this command |
| Browser side effect | Launches the default OS browser to the Slack app installation URL |
| Non-interactive support | `supportsNonInteractive: false` — command must not be used in headless/pipe mode |
| Config writes | None triggered directly; config utilities are traversed but the handler itself only reads config context if needed |
| Return value | `{ type: "text", value: "Opening Slack app installation page in browser…" }` |

---

## Version History

| Version | Change |
|---|---|
| v2.1.163 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode** — `supportsNonInteractive` is `false`. Invoking `/install-slack-app` in a piped or headless session will be rejected or silently skipped.
2. **Expecting a return value beyond the status message** — The command opens the browser and returns a single confirmation string. It does not wait for the Slack OAuth flow to complete or return any installation token.
3. **Assuming cross-platform browser behavior is uniform** — The URL opener dispatches `open` on macOS, `rundll32 url,OpenURL` on Windows, and `xdg-open` on Linux. If `xdg-open` is absent on a minimal Linux environment, the command will silently fail to open the browser.
4. **Misreading the deep call graph as command logic** — The depth-2 traversal surfaces many daemon/background-session identifiers (`tengu_bg_*`, `tengu_daemon_*`). These originate from shared infrastructure utilities, not from logic specific to `/install-slack-app`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `b2f` | Main async handler for `/install-slack-app` (`installSlackAppHandler`) |
| `c` | Shared logging / console utility |
| `X8` | URL opener — dispatches platform-specific browser-open command |
| `SX_` | Config save-with-lock orchestrator |
| `_` | Filesystem abstraction layer (low-level fs ops) |
| `Q6` | Path existence / access checker |
| `L` | Temp-file / lock file manager |
| `q` | Filesystem I/O module (readFileSync, statSync, etc.) |
| `f` | File descriptor or stream handle (context-dependent) |
| `wP1` | Config object merge / assign helper |
| `v5_` | Config schema validator / normalizer |
| `v` | HTTP request builder / fetch wrapper |
| `ccK` | HTTP response handler |
| `H` | Bootstrap fetch utility (API config fetcher) |
| `SH` | JSON serializer wrapper |
| `J4` | String header formatter |
| `ppH` | Header value builder |
| `icK` | Multipart / body encoder |
| `v8` | Error classifier / code extractor |
| `bDH` | Config file reader with backup/rotation logic |
| `B6` | JSON parse wrapper |
| `vx` | String prefix stripper |
| `fr1` | Config backup directory scanner |
| `RX_` | Backup path resolver |
| `w` | Background session / worker process manager |
| `fj6` | Auth presence checker |
| `A` | Locale / case normalizer |
| `V` | Scroll / viewport component |
| `P` | Text editor / input buffer component |
| `J` | Worker factory |
| `j` | Worker pool kill helper |
| `z` | Daemon stop controller |
| `Y` | Supervisor / daemon session runner |
| `h` | Background sweep / health-check scheduler |
| `A3A` | Vim-mode action map builder |
| `C` | Rate-limit event queue executor |
| `T` | Rate-limit timer component |
| `TM6` | Atomic file writer |
| `O` | Filesystem stat wrapper (symbolic link checker) |
| `R8` | Error code extractor |
| `_lH` | Config path resolver |
| `Lr1` | Config entries iterator |
| `t98` | Timestamp / lock-age calculator |
| `hX_` | Config symlink-safe writer |
| `hK` | App / URL open dispatcher (wraps `X8`) |
| `pY7` | URL scheme validator |
| `FY` | Platform detector |
| `C8` | Process runner / CLI bootstrap |
| `S_` | Main CLI entry orchestrator |
| `bTH` | CLI argument parser / initializer |
| `D` | Forced-shutdown / process-exit handler |
| `SG4` | Exit code stringifier |
| `K$` | Signal handler installer |
| `kH` | Error reporter / logger |
| `b6` | AsyncLocalStorage context reader |
| `bd6` | Store accessor |
| `X_` | Dependency injector / service locator |