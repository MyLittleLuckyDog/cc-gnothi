---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.141"
updated: "2026-05-31"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.141 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.141 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.141

---

## Overview

The `/install-slack-app` command is a local slash command that opens the Slack app installation page for Claude Code in the user's default browser. It fires a single telemetry event, displays a brief status message, and delegates the platform-specific URL-opening logic to a shared browser-launch utility. The command accepts no arguments and always executes non-interactively as a fire-and-forget action.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `F5q` |
| load_inline | `true` |
| loc_byte | `10596933` |
| loc_byte_end | `10597119` |
| loc_line | `6436` |
| arbor_handler.name | `WJ7` |
| arbor_handler.fqn | `claude-2.1.141::WJ7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.141 bundle.js:+10596933

---

## Input Branching

The command follows a simple linear flow with no user-input branching — it takes no arguments and always performs the same sequence of actions. A numbered pseudocode representation is therefore appropriate.

1. Emit telemetry event `tengu_install_slack_app_clicked`.
2. Save the current global configuration (via the config-lock subsystem).
3. Display the status message `"Opening Slack app installation page in browser…"` as a `text`-type output.
4. Call the browser-open utility (`eq`) with the Slack app installation URL.
5. Return.

---

## Behavioral Spec

### Handler Entry — `installSlackAppHandler` (`WJ7`)

The Arbor-resolved handler `WJ7` is an `AsyncFunction`. Its resolution path is `module_id` (module `F5q`).

```
async function installSlackAppHandler(context):
    emit telemetry("tengu_install_slack_app_clicked")   // bundle.js:+10596539

    saveGlobalConfig(context)                            // calls saveConfig (e6)

    yield output(type="text",
                 body="Opening Slack app installation page in browser…")
                                                         // bundle.js:+10596685

    openInBrowser(slackAppInstallUrl)                    // calls browserOpen (eq)
                                                         // bundle.js:+10596652
    return
```

Analysis basis: CC v2.1.141 bundle.js:+10596537

---

### Sub-feature: Global Config Save — `saveGlobalConfig` (`e6`)

Before opening the browser, the handler persists the current configuration. The save path calls through the config-lock subsystem (`M9_`) and includes a guard that prevents an auth-loss regression (GH #3117).

```
async function saveGlobalConfig(context):
    acquireConfigLock()                     // M9_ via e6, bundle.js:+3137670
    currentConfig = readAndParseConfig()    // cMH, bundle.js:+3137851

    if currentConfig missing auth AND cachedConfig has auth:
        emit telemetry("tengu_config_stale_write")
        log warning "saveGlobalConfig fallback: re-read config is missing auth …"
        abort write                         // bundle.js:+3137877

    writeConfigWithLock(currentConfig)
    releaseConfigLock()
```

Key guard message fragment: `"…re-read config is missing auth…"` (bundle.js:+3137877).

Analysis basis: CC v2.1.141 bundle.js:+3137670

---

### Sub-feature: Config Lock Acquisition — `configLockManager` (`M9_`)

The config-lock manager uses file-system primitives (`mkdirSync`, `statSync`, `copyFileSync`, `unlinkSync`) to implement advisory locking. It emits a warning when lock contention is detected and backs up config files before overwriting.

```
function acquireConfigLock(configPath):
    lockDir = path.dirname(configPath)
    ensureDir(lockDir)                          // L.mkdirSync, bundle.js:+3140395

    startTime = Date.now()                      // bundle.js:+3140440

    loop:
        try mkdirSync(lockPath)                 // lock acquired
        catch EEXIST:
            elapsed = Date.now() - startTime
            if elapsed > LOCK_TIMEOUT:
                emit telemetry("tengu_config_lock_contention")
                                                // bundle.js:+3140668
                log error "Lock acquisition took longer than expected …"
                                                // bundle.js:+3140579
                break
            sleep and retry

    try:
        backup = createBackup(configPath)       // cMH backup logic
        writeNewConfig()
    finally:
        rmdirSync(lockPath)                     // release lock
```

Backup directory name literal: `"backups"` (bundle.js:+3142180).
Config access guard message: `"Config accessed before allowed."` (bundle.js:+3142612).
Auth-loss guard message fragment: `"saveConfigWithLock: re-read config is missing auth…"` (bundle.js:+3140995).

Analysis basis: CC v2.1.141 bundle.js:+3140368

---

### Sub-feature: Config Parse and Read — `configReader` (`cMH`)

Reads the config file as UTF-8 JSON, applies path-prefix normalisation, enumerates backup files, and optionally resolves symlinks before returning a parsed config object.

```
function readConfigFromDisk(configPath):
    if not fileExists(configPath):              // ENOENT check, bundle.js:+3140934
        throw Error("Config accessed before allowed.")
                                                // bundle.js:+3142606

    raw = fs.readFileSync(configPath, "utf-8") // bundle.js:+3142668
    parsed = JSON.parse(raw)                   // b6, bundle.js:+179723

    // Strip leading path prefix if present     // DR, bundle.js:+3142718
    normalised = stripPathPrefix(parsed)

    backups = listBackups(configPath)          // rE9, bundle.js:+3142858
    return { config: normalised, backups }
```

Encoding constant: `"utf-8"` (bundle.js:+3142695).

Analysis basis: CC v2.1.141 bundle.js:+3140957

---

### Sub-feature: Browser Open — `browserOpen` (`eq`)

Platform-aware URL opener. Validates the URL scheme then dispatches to the appropriate system command.

```
async function browserOpen(url):
    parsed = parseUrl(url)                          // jb4, bundle.js:+7462475
    if parsed.protocol not in ["http:", "https:"]:  // bundle.js:+7462238, +7462260
        throw Error("Invalid URL scheme")

    platform = process.platform
    if platform == "darwin":                        // bundle.js:+7462510
        exec("open", url)                           // bundle.js:+7462684
    else if platform == "win32":                    // bundle.js:+7462526
        exec("rundll32", "url,OpenURL", url)        // bundle.js:+7462610
    else:
        exec("xdg-open", url)                       // bundle.js:+7462691
```

Analysis basis: CC v2.1.141 bundle.js:+10596652

---

### Sub-feature: Atomic Symlink-Safe File Write — `atomicFileWrite` (`$CH`)

Used internally by the config subsystem to safely replace config files. Writes to a temporary file with random suffix, sets permissions, fsyncs, then renames atomically.

```
function atomicWriteFile(targetPath, content, options):
    lstat = fs.lstatSync(targetPath)                // bundle.js:+990567
    isSymlink = lstat.isSymbolicLink()

    if isSymlink:
        realTarget = resolveSymlink(targetPath)     // readlinkSync, bundle.js:+990172

    randomSuffix = crypto.randomBytes(6).toString("hex")
                                                    // bundle.js:+990797, literal "hex" +990825
    tempPath = targetPath + "." + randomSuffix

    fd = fs.openSync(tempPath, ...)                 // bundle.js:+990331
    fs.writeFileSync(fd, content)                   // bundle.js:+991233

    originalMode = stat(targetPath).mode
    fs.fchmodSync(fd, originalMode)                 // bundle.js:+991291
    log "Applied original permissions to temp file" // bundle.js:+991312
    fs.fsyncSync(fd)                                // bundle.js:+991357
    fs.closeSync(fd)

    fs.renameSync(tempPath, finalTarget)            // bundle.js:+991485
    // on failure: unlinkSync(tempPath)             // bundle.js:+991642
```

Random suffix byte count: `6` (bundle.js:+990813).

Analysis basis: CC v2.1.141 bundle.js:+990085

---

### Sub-feature: HTTP Client / URL Open Wrapper — `urlValidator` (`jb4`)

Validates the URL scheme before passing to the OS launcher. Throws on non-HTTP(S) schemes.

```
function validateUrl(rawUrl):
    u = new URL(rawUrl)
    if u.protocol == "http:" or u.protocol == "https:":
        return u
    throw Error("unsupported protocol: " + u.protocol)
                                                // bundle.js:+7462188
```

Analysis basis: CC v2.1.141 bundle.js:+7462475

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_install_slack_app_clicked` fired at handler entry (bundle.js:+10596539) |
| Telemetry — config lock | `tengu_config_lock_contention` when lock wait exceeds threshold (bundle.js:+3140668) |
| Telemetry — stale write | `tengu_config_stale_write` when re-read config loses auth (bundle.js:+3140804) |
| Telemetry — parse error | `tengu_config_parse_error` on JSON parse failure (bundle.js:+3143249) |
| Telemetry — bg dispatch | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem` (background session subsystem, reached transitively) |
| Telemetry — bg spare | `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_spare_spawn` (background session subsystem, transitive) |
| Config write | Global config (`~/.claude.json`) is saved with advisory file lock before browser opens |
| Config backup | Up to 5 timestamped backups kept in a `backups/` subdirectory (literal `5`, bundle.js:+3141598; literal `"backups"`, bundle.js:+3142180) |
| Auth-loss guard | Write is aborted if re-read config is missing auth that the cache holds (GH #3117, bundle.js:+3140995) |
| Browser side effect | Opens the Slack app installation URL in the default OS browser (platform-specific command) |
| Terminal output | Emits one `text`-type line: `"Opening Slack app installation page in browser…"` (bundle.js:+10596685) |
| Hook registration | None detected in depth-2 traversal |
| Sound | None detected in depth-2 traversal |
| supportsNonInteractive | `false` — command must run in an interactive terminal session |

---

## Version History

| Version | Change |
|---|---|
| v2.1.141 | Initial analysis — command registered at bundle.js:+10596933; build timestamp `2026-05-13T21:26:59Z` (bundle.js:+14466210); git SHA `4f4623ddd339e1c1b87d659b7c9eb3b66397e7a3` (bundle.js:+14466241) |

---

## Common Mistakes

1. **Running in non-interactive mode**: `supportsNonInteractive` is `false`. Invoking `/install-slack-app` from a script or CI pipeline will be rejected or behave unexpectedly.
2. **Expecting arguments**: The command takes no arguments. Any text after `/install-slack-app` is ignored; the handler does not parse user input.
3. **Assuming instant browser open**: The handler first saves the global config (with lock acquisition). On a heavily loaded machine with lock contention the browser may open after a perceptible delay, and the telemetry event `tengu_config_lock_contention` will be emitted.
4. **Misidentifying the telemetry event name**: The primary event is `tengu_install_slack_app_clicked` (not `tengu_install_slack_app` or `tengu_slack_install`).
5. **Expecting a return value or confirmation**: The command is fire-and-forget. It yields one status text line and then exits; there is no success/failure confirmation from the Slack side.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `WJ7` | Main async handler for `/install-slack-app` (Arbor-resolved, `claude-2.1.141::WJ7`) |
| `Q` | Shared utility (called from handler and config lock manager) |
| `e6` | `saveGlobalConfig` — persists global config before browser open |
| `M9_` | `configLockManager` — advisory file-lock acquire/release and backup logic |
| `_` | Low-level filesystem helper (used inside lock manager) |
| `x6` | Path/file existence check helper |
| `L` | Filesystem module reference (mkdirSync, statSync, copyFileSync, unlinkSync, etc.) |
| `q` | Secondary filesystem module reference (readFileSync, mkdirSync, statSync, etc.) |
| `f` | File descriptor / resource handle with `finally` cleanup |
| `XeA` | Config object merge/assign helper |
| `Dr8` | Path-prefix normalisation helper |
| `v` | HTTP request builder / send helper |
| `J7K` | HTTP transport layer |
| `H` | Retry/backoff helper with `Math.random` and `setTimeout` |
| `SH` | JSON serialisation helper (`JSON.stringify`) |
| `t7` | URL/path manipulation utility (replace, slice, lastIndexOf) |
| `MSH` | Message formatting helper |
| `X7K` | HTTP write/upload helper (Buffer.byteLength, chunked send) |
| `M8` | Error handling / reporting helper |
| `cMH` | `configReader` — reads, parses, and normalises config from disk |
| `b6` | JSON parse wrapper |
| `DR` | Path-prefix strip helper (startsWith + slice) |
| `rE9` | Backup file enumerator (readdirStringSync, join, dirname) |
| `kH` | Error logging helper (`Oc.logError`) |
| `$9_` | Backup path builder (join + `"backups"` literal) |
| `w` | Background session / process manager (SIGKILL, freemem, spawn) |
| `F76` | Config field accessor/transformer |
| `A` | String lowercase helper / map accessor |
| `Z` | String startsWith check target |
| `X` | SDK/MCP connection manager (Promise.all, spawn, connect) |
| `gT8` | SDK transport factory |
| `k_` | Error constructor wrapper |
| `V` | Array/slice target in config manager |
| `$CH` | `atomicFileWrite` — symlink-safe atomic config file writer |
| `O` | `lstat` result object (isSymbolicLink) |
| `$8` | Error normaliser |
| `XpH` | Config change listener / hook |
| `iE9` | Object.entries iterator for config fields |
| `WpH` | Config write timestamper (Date.now) |
| `f9_` | Config path/file installer helper |
| `eq` | `browserOpen` — platform-aware URL launcher |
| `jb4` | `urlValidator` — URL scheme validation before OS launch |
| `O8` | Subprocess launcher wrapper |
| `M_` | Process execution manager (spawn with timeout) |
| `jXH` | Low-level subprocess spawn configurator |
| `D` | Daemon/background process orchestrator |
| `lkK` | String coercion helper |
| `N6` | Async context store accessor |
| `bS6` | AsyncLocalStorage `.getStore()` wrapper |
| `e8` | Context resolution helper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.