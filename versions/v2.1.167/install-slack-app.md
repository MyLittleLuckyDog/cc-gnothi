---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.167"
updated: "2026-06-11"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.167 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.167 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.167

---

## Overview

`/install-slack-app` is a local slash command that opens the Claude Slack application installation page in the user's default browser. The command emits a telemetry event, displays a brief status message, and delegates to an OS-aware URL-opener utility to launch the browser. It requires interactive mode and produces no persistent side effects beyond the browser launch.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| loc_byte | `11672675` |
| loc_byte_end | `11672861` |
| loc_line | `8174` |
| supportsNonInteractive | `false` |
| module_id | `ocq` |
| load_inline | `true` |
| arbor_handler.name | `OGf` |
| arbor_handler.fqn | `claude-2.1.167::OGf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.167 bundle.js:+11672675

---

## Input Branching

The command has a simple linear flow with no user-input branching — the command takes no arguments, and execution proceeds deterministically through telemetry → message display → URL open. A numbered pseudocode representation is used.

1. Handler `installSlackAppHandler` is invoked (no arguments consumed).
2. Emit telemetry event `tengu_install_slack_app_clicked`.
3. Print status message "Opening Slack app installation page in browser…" to the UI as a `text`-type output.
4. Call `openUrlInBrowser(url)` — delegates to `urlOpener` (`CK`), which selects a platform-specific mechanism.
5. Return (async resolution).

---

## Behavioral Spec

### Top-level handler

```
async function installSlackAppHandler(context):
    emitTelemetry("tengu_install_slack_app_clicked")          // bundle.js:+11672281
    printToUI({ type: "text",                                  // bundle.js:+11672414
                body: "Opening Slack app installation page in browser…" })
                                                               // bundle.js:+11672427
    await openUrlInBrowser(slackInstallUrl)                   // bundle.js:+11672394
```

Analysis basis: CC v2.1.167 bundle.js:+11672279

---

### URL opener (`urlOpener` — arbor name: `CK`)

The URL opener is an async utility that resolves a platform-appropriate shell command and spawns it. The call graph reveals two depth-1 callees from `CK`: a URL-validation helper (`tw7`) and a platform-detection + open-command dispatcher (`nY`/`R8`).

```
async function openUrlInBrowser(url):
    validateUrl(url)                   // rejects non-http/https schemes
                                       // bundle.js:+6814596 (http: / https: literals)
    platform = detectPlatform()
    if platform == "darwin":           // bundle.js:+6814955
        spawn("open", [url])           // bundle.js:+6815129
    else if platform == "win32":       // bundle.js:+6814971
        spawn("rundll32", ["url,OpenURL", url])
                                       // bundle.js:+6815055, +6815067
    else:
        spawn("xdg-open", [url])       // bundle.js:+6815136
```

Analysis basis: CC v2.1.167 bundle.js:+11672394, +6814883, +6814896, +6815004

---

### Config-lock writer (`configLockWriter` — `aP_`)

`aP_` is reached transitively from `X8` (the config-access helper). It manages filesystem-level locking for `~/.claude.json` writes and is **not** part of the happy path for `/install-slack-app`; it is present in the call graph because `X8` is a shared utility used across multiple commands. Key observed behaviors:

- Acquires a directory-based filesystem lock; logs a warning if lock acquisition exceeds the expected time: `"Lock acquisition took longer than expected - another Claude instance may be running"` (bundle.js:+3265387).
- Guards against auth-loss on re-read: `"saveConfigWithLock: re-read config is missing auth that cache has; refusing to write…"` (bundle.js:+3265803). Fires `tengu_config_auth_loss_prevented` (bundle.js:+3265955).
- On parse errors, fires `tengu_config_parse_error` (bundle.js:+3268051).
- Maximum backup retention: **5 backups** (bundle.js:+3266406); backup filenames contain the substring `.backup.` (bundle.js:+3266273).
- Config write timeout: **60000 ms** (bundle.js:+3266157).

```
function saveConfigWithLock(configPath, updater):
    acquireLock(configPath)
    if lockDelay > expected:
        warn("Lock acquisition took longer than expected…")
        emit("tengu_config_lock_contention")
    reread = readConfigFromDisk(configPath)
    if cacheHasAuth AND reread misses auth:
        emit("tengu_config_auth_loss_prevented")
        releaseLock(); return
    updatedConfig = updater(reread)
    pruneBackups(maxCount=5)
    atomicWriteFile(configPath, updatedConfig, permissions=384 /*0o600*/)
    releaseLock()
```

Analysis basis: CC v2.1.167 bundle.js:+3265176, +3265387, +3265476, +3265537, +3265803, +3265955, +3266157, +3266406, +3266688

---

### Atomic file writer (`atomicFileWriter` — `$$6`)

Used by `aP_` for safe config persistence:

```
function atomicWriteFile(targetPath, content, permissions):
    tmpPath = targetPath + "." + randomBytes(6).toString("hex")  // bundle.js:+1058114, +1058142
    fd = openSync(tmpPath, flags)
    writeFileSync(fd, content)
    fchmodSync(fd, permissions)        // apply permissions to temp file
    fsyncSync(fd)                      // flush to disk
    closeSync(fd)
    renameSync(tmpPath, targetPath)    // atomic replace
    // on failure: unlinkSync(tmpPath)
```

Analysis basis: CC v2.1.167 bundle.js:+1057398, +1058550, +1058608, +1058674, +1058802, +1058959

---

### Background-session dispatcher (transitive; `w` / `bgDispatch`)

The call graph reaches the daemon background-session manager through `X8 → aP_ → v → ... → w`. This is a shared infrastructure component. Observed limits and constants:

- SIGKILL escalation after **30 s** (bundle.js:+16196759), with a **15 s** grace period (bundle.js:+16196770).
- Memory pressure threshold uses a **1024**-unit base (bundle.js:+16197299).
- Spawn retry cap: **3** retries, **12** max worker slots (bundle.js:+16201559, +16201564).
- Prewarm sweep label: `"prewarm"` (bundle.js:+16202134).

These behaviors are **not triggered** by `/install-slack-app` directly.

Analysis basis: CC v2.1.167 bundle.js:+16196759, +16196770, +16197299, +16201559

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry (primary) | `tengu_install_slack_app_clicked` — fired immediately on command invocation (bundle.js:+11672281) |
| Telemetry (transitive — config layer) | `tengu_config_lock_contention`, `tengu_config_stale_write`, `tengu_config_parse_error`, `tengu_config_auth_loss_prevented` |
| Telemetry (transitive — daemon layer) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_retire_pinned_low_mem`, `tengu_bg_prewarm_per_sweep`, `tengu_daemon_control`, `tengu_daemon_config_reload` |
| UI output | Prints `"Opening Slack app installation page in browser…"` as `type: "text"` (bundle.js:+11672414, +11672427) |
| Browser launch | Spawns OS-native URL-open command (platform-conditional: `open` / `rundll32 url,OpenURL` / `xdg-open`) |
| appState changes | None observed in depth-2 traversal |
| Hook registration | None observed in depth-2 traversal |
| Filesystem | None for the command itself; config-lock machinery (`aP_`) is a shared utility and is not written by this command |
| Sound | None observed |
| supportsNonInteractive | `false` — command will not run in non-interactive/headless mode |

---

## Version History

| Version | Change |
|---|---|
| v2.1.167 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `supportsNonInteractive` is `false`; invoking `/install-slack-app` in a headless or pipe context will be rejected before the handler is reached.
2. **No arguments expected**: The command accepts no user-supplied arguments. Providing arguments does not affect behavior — they are silently ignored.
3. **Browser must be available**: The command relies on `open` / `xdg-open` / `rundll32` being available in `PATH` (or the standard system location). In sandboxed or minimal environments these may be absent, causing the spawn to fail with no user-visible error beyond the telemetry event.
4. **Mistaking the URL-open as synchronous**: The handler is `async` and awaits the URL-open call; callers that do not await may observe the browser window opening after the parent call has returned.
5. **Conflating transitive telemetry with command intent**: The many `tengu_bg_*` and `tengu_config_*` events in the telemetry list are from shared utilities traversed by the call graph, not from the command's own logic.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `OGf` | Top-level async handler for `/install-slack-app` (arbor handler, `claude-2.1.167::OGf`) |
| `l` | Logger / console output utility |
| `X8` | Config read/write coordinator (shared utility) |
| `aP_` | Config lock writer — acquires FS lock and performs atomic config save |
| `_` | FS utility (statSync / readdirStringSync wrapper) |
| `d6` | Path resolver / config path helper |
| `L` | FS module wrapper (mkdirSync, statSync, etc.) |
| `q` | Secondary FS module wrapper (readFileSync, statSync, copyFileSync, etc.) |
| `f` | File handle / stream abstraction |
| `S21` | Config object merger / Object.assign wrapper |
| `gM_` | Config default-value populator |
| `v` | HTTP request utility (fetch wrapper with debug logging) |
| `onK` | HTTP header builder |
| `H` | Bootstrap-fetch handler (API bootstrap with 5000 ms timeout) |
| `RH` | JSON serialiser wrapper |
| `G4` | URL path builder / normaliser |
| `EUH` | URL encoding helper |
| `enK` | Streaming HTTP response reader |
| `V8` | Error constructor / error-wrapping utility |
| `LwH` | Config file reader with backup and parse-error handling |
| `U6` | JSON.parse wrapper |
| `Hu` | String prefix-strip helper |
| `Vo1` | Config directory traversal / backup directory scanner |
| `sP_` | Backup path builder (joins `backups/` subdirectory) |
| `w` | Background-session dispatcher / daemon worker pool manager |
| `oj6` | Config schema validator |
| `A` | String lowercasing / normalisation utility (also used as Map) |
| `V` | Worker/session handle |
| `P` | Daemon buffer / pty split-stream processor |
| `J` | Worker spawner wrapper |
| `j` | Worker pool killer helper |
| `z` | Daemon stop controller (abort + offset setter) |
| `Y` | Supervisor write/update controller |
| `h` | Background memory-pressure sweep scheduler |
| `TOA` | Vim-mode operator registry |
| `C` | Rate-limit event enqueuer |
| `E` | Background session lifecycle controller |
| `$$6` | Atomic file writer (randomised temp file + rename) |
| `O` | Stat result / symbolic-link checker |
| `h8` | Error-code inspector |
| `QlH` | Config cache accessor |
| `Zo1` | Config entry enumerator |
| `AK8` | Timestamp helper (Date.now wrapper) |
| `oP_` | Global config write helper (with auth-loss guard) |
| `CK` | URL opener — platform-aware browser launcher |
| `tw7` | URL scheme validator (http/https) |
| `nY` | Platform detection helper |
| `R8` | Process / IPC context accessor |
| `C_` | Session initialiser / context bootstrap |
| `YZH` | IPC channel set-up and event binder |
| `D` | Forced-shutdown handler (process.exit + abort) |
| `FE4` | String coercion wrapper |
| `O$` | Output stream selector |
| `hH` | Error logger / error-push utility |
| `u6` | Async-local-store accessor |
| `mc6` | Store getter (uc6.getStore wrapper) |
| `W_` | Top-level initialisation entry point |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.