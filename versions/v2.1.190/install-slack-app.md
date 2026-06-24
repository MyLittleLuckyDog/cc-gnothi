---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.190"
updated: "2026-06-24"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.190 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.190 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.190

---

## Overview

`/install-slack-app` is a local slash command that opens the Claude Slack app installation page in the user's default browser. It fires a single telemetry event, displays a status message, and delegates URL-opening to a platform-aware browser launcher. The command has no interactive sub-flow and does not accept user arguments.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `pEl` |
| load_inline | `true` |
| loc_byte | `11685214` |
| loc_byte_end | `11685400` |
| loc_line | `7915` |
| arbor_handler.name | `Crf` |
| arbor_handler.fqn | `claude-2.1.190::Crf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.190 bundle.js:+11685214

---

## Input Branching

The handler follows a simple linear flow (no user-controlled branching). Numbered pseudocode is used.

1. Command is invoked — no argument parsing required.
2. Emit telemetry event `tengu_install_slack_app_clicked`.
3. Save the global configuration (with lock) via the config-persistence pipeline.
4. Display the status message `"Opening Slack app installation page in browser…"` as a `text`-typed output.
5. Invoke the browser-open utility (`openUrlInBrowser`) passing the Slack app installation URL.
6. Return control to the CLI shell.

---

## Behavioral Spec

### Main Handler — `installSlackAppHandler` (`Crf`)

```
async function installSlackAppHandler(context):
    // Step 1 — telemetry
    emitTelemetry("tengu_install_slack_app_clicked")
    // Analysis basis: CC v2.1.190 bundle.js:+11684820

    // Step 2 — persist config (acquires file lock)
    await saveGlobalConfigWithLock(context)
    // Analysis basis: CC v2.1.190 bundle.js:+11684858

    // Step 3 — user-facing status message
    yield { type: "text", content: "Opening Slack app installation page in browser…" }
    // Analysis basis: CC v2.1.190 bundle.js:+11684953, +11684966

    // Step 4 — open browser
    await openUrlInBrowser(SLACK_APP_INSTALL_URL)
    // Analysis basis: CC v2.1.190 bundle.js:+11684933
```

### Config Persistence Sub-pipeline — `saveGlobalConfigWithLock` (`hn`)

The handler delegates global config persistence to a locking helper. Key behaviors observed in the call graph:

```
async function saveGlobalConfigWithLock(context):
    acquireFileLock()                    // GQn — file-lock acquisition
    // Emits tengu_config_lock_contention if contention detected
    // Warning threshold: "Lock acquisition took longer than expected…"
    // Analysis basis: CC v2.1.190 bundle.js:+13751922, +13752011

    reReadConfigFromDisk()               // SEe — re-read before write
    // If re-read config is missing auth that in-memory cache has:
    //   log warning and abort write to avoid wiping ~/.claude.json
    //   Emits tengu_config_auth_loss_prevented
    //   Analysis basis: CC v2.1.190 bundle.js:+13752338, +13752490

    if staleWriteDetected:
        emitTelemetry("tengu_config_stale_write")
        // Analysis basis: CC v2.1.190 bundle.js:+13752147

    writeConfigAtomic()                  // sIt — atomic write with temp file
    // Creates temp file, writes, fsyncs, renames into place
    // Falls back to in-place write on permission errors (EACCES, EPERM, etc.)
    // Applies original file permissions to temp file
    // Analysis basis: CC v2.1.190 bundle.js:+1100757

    if fallbackWriteUsed:
        emitTelemetry("tengu_config_fallback_write")
        // Analysis basis: CC v2.1.190 bundle.js:+13751627

    releaseFileLock()

    // Backup management (bGl / SEe sub-path)
    // Maintains a "backups" sub-directory
    // Keeps at most 5 backup copies (rotating oldest)
    // Analysis basis: CC v2.1.190 bundle.js:+13753523, +13752941
    // Config read uses utf-8 encoding
    // Analysis basis: CC v2.1.190 bundle.js:+13754038
    // Config parse errors emit tengu_config_parse_error
    // Analysis basis: CC v2.1.190 bundle.js:+13754586
```

### Browser-Open Utility — `openUrlInBrowser` (`Zl`)

```
async function openUrlInBrowser(url):
    validateUrl(url)              // ktd — rejects non-http(s) URLs
    // Accepted schemes: "http:" and "https:"
    // Analysis basis: CC v2.1.190 bundle.js:+3116144, +3116166
    // Throws Error on invalid scheme
    // Analysis basis: CC v2.1.190 bundle.js:+3116094

    if platform == "darwin":
        spawnProcess("open", [url])   // vli path
        // Analysis basis: CC v2.1.190 bundle.js:+3116832, +3116851
    else:
        spawnCrossplatformOpener(url) // Un/Wr path
        // Analysis basis: CC v2.1.190 bundle.js:+3116715
```

### Config Lock Acquisition — `acquireFileLock` (`GQn`)

```
function acquireFileLock(configPath):
    targetDir = path.dirname(configPath)
    fs.mkdirSync(targetDir, { recursive: true })
    // Analysis basis: CC v2.1.190 bundle.js:+13751738

    startTime = Date.now()
    // Analysis basis: CC v2.1.190 bundle.js:+13751783

    loop until lock acquired or timeout:
        attempt atomic lock directory creation
        if ENOENT:
            // Analysis basis: CC v2.1.190 bundle.js:+13752277
            recreate parent directory and retry
        if lockHeldTooLong:
            emitTelemetry("tengu_config_lock_contention")
            log("error", "Lock acquisition took longer than expected…")
            // Analysis basis: CC v2.1.190 bundle.js:+13751879, +13751922

    // Stale-write guard: re-read after lock
    freshConfig = reReadConfigFromDisk()
    if freshConfig.auth missing AND cachedConfig.auth present:
        log("saveGlobalConfig fallback: re-read config is missing auth…")
        // Analysis basis: CC v2.1.190 bundle.js:+13748801
        emitTelemetry("tengu_config_auth_loss_prevented")
        return WITHOUT writing

    timeout value for directory reads: 60000 ms
    // Analysis basis: CC v2.1.190 bundle.js:+13752692
```

### Atomic Config Write — `writeFileSyncAndFlush` (`sIt`)

```
function writeFileSyncAndFlush(filePath, content, mode):
    // Resolve symlinks before writing
    if isSymlink(filePath):
        target = readlinkSync(filePath)
        filePath = resolve(target)
    // Analysis basis: CC v2.1.190 bundle.js:+1099585

    tempPath = generateTempPath(filePath)
    // Uses crypto.randomBytes for temp filename uniqueness
    // Analysis basis: CC v2.1.190 bundle.js:+1100233

    try:
        stat original to capture permissions
        writeFileSync(tempPath, content)
        fchmodSync(tempPath, originalMode)   // mode 0o600 default = 384 decimal
        // Analysis basis: CC v2.1.190 bundle.js:+13753223
        log("Applied original permissions to temp file")
        // Analysis basis: CC v2.1.190 bundle.js:+1100757
        fsyncSync(tempPath)
        renameSync(tempPath, filePath)
    catch EACCES | EPERM | EINVAL | ENOTSUP | ENOSYS:
        // Fall back to in-place write
        // Analysis basis: CC v2.1.190 bundle.js:+1096757, +1096771, +1096786, +1096799
        writeFileSync(filePath, content)
        if fallback also fails:
            log warning "writeFileSyncAndFlush: in-place fallback write failed; content preserved at temp path"
            // Analysis basis: CC v2.1.190 bundle.js:+1102047
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry (primary) | `tengu_install_slack_app_clicked` (bundle.js:+11684820) |
| Telemetry (config lock) | `tengu_config_lock_contention` (bundle.js:+13752011) |
| Telemetry (config write) | `tengu_config_stale_write` (bundle.js:+13752147), `tengu_config_fallback_write` (bundle.js:+13751627) |
| Telemetry (config auth) | `tengu_config_auth_loss_prevented` (bundle.js:+13752490) |
| Telemetry (config parse) | `tengu_config_parse_error` (bundle.js:+13754586) |
| Telemetry (bg/daemon) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_daemon_yield`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop`, `tengu_bg_attach_legacy_autorespawn`, `tengu_bg_attach`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_stall_respawn`, `tengu_bg_attach_kick`, `tengu_daemon_control` (reachable via deep call graph, not directly triggered by this command) |
| Filesystem side effect | Reads, writes, and backs up `~/.claude.json` via locked atomic write |
| Backup directory | `~/.claude.json`-adjacent `backups/` subdirectory; retains up to 5 copies (bundle.js:+13752941) |
| Lock mechanism | Creates a lock directory; emits contention telemetry on delay |
| Auth-loss guard | Refuses to write config if re-read loses auth fields vs. in-memory cache (GH #3117) |
| Browser effect | Spawns OS browser opener; on macOS uses `open`; cross-platform path via `Un`/`Wr` |
| stdout / UI output | One `text`-typed message: `"Opening Slack app installation page in browser…"` (bundle.js:+11684966) |
| supportsNonInteractive | `false` — command must not be invoked headlessly |
| Sound | None observed |
| appState changes | None observed beyond global config persistence |

---

## Version History

| Version | Change |
|---|---|
| v2.1.190 | Initial analysis |

---

## Common Mistakes

1. **Invoking in non-interactive mode** — `supportsNonInteractive: false` means this command will be rejected or behave unexpectedly in headless/scripted contexts such as `--print` mode.
2. **Expecting browser to open automatically in SSH/remote sessions** — The browser-open utility invokes the local OS opener; in remote/containerized environments no browser window will appear and the command may silently succeed from the CLI's perspective.
3. **Interpreting the config-write steps as the main purpose** — The config persistence pipeline (lock, re-read, atomic write) is incidental infrastructure shared across many commands. The user-facing purpose is solely to open the Slack app installation URL.
4. **Running when `~/.claude.json` is locked by another Claude instance** — A concurrent Claude process holding the config lock will cause contention (`tengu_config_lock_contention`), delaying the command. The lock-contention warning ("another Claude instance may be running") appears at log level `error` (bundle.js:+13751879).
5. **Assuming any arguments are accepted** — The registration carries no `args` or `userFacingArgs` field; passing arguments has no defined effect.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Crf` | Main handler for `/install-slack-app` (`installSlackAppHandler`, AsyncFunction) |
| `W` | Telemetry emit helper |
| `hn` | Save-global-config-with-lock orchestrator |
| `GQn` | Config file-lock acquisition and release |
| `Wt` | Config/data path resolver |
| `SWs` | Config serialization helper |
| `YRr` | Config serialization sub-helper |
| `T` | HTTP/fetch utility (used in config and network paths) |
| `nLc` | Network request builder sub-component |
| `Me` | JSON stringify wrapper |
| `wc` | String/path manipulation utility |
| `hze` | Encoding/escaping helper |
| `iLc` | HTTP request send/receive handler |
| `cn` | Logging utility |
| `SEe` | Config re-read and backup manager |
| `Gt` | JSON parse wrapper |
| `u9` | String prefix/slice utility |
| `bGl` | Backup directory manager |
| `$Oo` | Path join utility for backup entries |
| `f` | Background daemon session/process manager |
| `PHt` | Config path resolver |
| `n` | String normalization helper (toLower etc.) |
| `I` | Scroll/layout calculation helper |
| `x` | Terminal write dispatcher |
| `A` | Viewport bounds calculator |
| `H` | IPC/socket framing layer |
| `g` | Socket timeout helper |
| `m` | Process kill manager |
| `mp` | IPC message finisher |
| `RJf` | Daemon IPC message router |
| `be` | String coercion utility |
| `sIt` | Atomic file write with flush (`writeFileSyncAndFlush`) |
| `Nd` | Realpath resolver |
| `u` | Daemon stop/control helper |
| `kn` | Logging guard/filter |
| `T7e` | Chmod error classifier |
| `CDe` | Config diff/merge helper |
| `NOo` | Config entries iterator |
| `DKt` | Config timestamp tracker |
| `BQn` | Config write orchestrator sub-path |
| `Pe` | Promise/async error handler |
| `aKe` | Async error wrapper |
| `Zl` | `openUrlInBrowser` — platform-aware browser launcher |
| `ktd` | URL scheme validator (rejects non-http/https) |
| `vli` | macOS `open`-command spawner |
| `A_` | Process spawn argument builder |
| `Un` | Cross-platform browser open entry point |
| `Wr` | Cross-platform browser open implementation |
| `Pt` | Process spawn wrapper |