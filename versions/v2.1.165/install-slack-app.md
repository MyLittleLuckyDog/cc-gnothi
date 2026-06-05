---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.165"
updated: "2026-06-05"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.165 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.165 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.165

---

## Overview

`/install-slack-app` is a local slash command that opens the Claude Slack app installation page in the user's default web browser. It emits a telemetry event, displays a brief status message to the user, and delegates the actual URL-open operation to a platform-aware browser-launch utility. The command performs no interactive input and does not modify any session state.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | Install the Claude Slack app |
| loc_byte | `11642156` |
| loc_byte_end | `11642342` |
| loc_line | `8161` |
| supportsNonInteractive | `false` |
| module_id | `zdq` |
| load_inline | `true` |
| arbor_handler.name | `u2f` |
| arbor_handler.fqn | `claude-2.1.165::u2f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.165 bundle.js:+11642156

---

## Input Branching

The command has a simple linear execution flow with no user-input branching. Numbered pseudocode is used.

1. Command is invoked (no arguments consumed).
2. Emit telemetry event `tengu_install_slack_app_clicked`.
3. Display the status message `"Opening Slack app installation page in browser…"` as a `text`-type output.
4. Call the platform-aware URL-open helper (`openUrlHelper`) to launch the Slack app installation URL in the default browser.
5. Return (command completes synchronously from the CLI's perspective; the browser launch may be asynchronous).

Analysis basis: CC v2.1.165 bundle.js:+11641760, +11641800, +11641875, +11641895, +11641908

---

## Behavioral Spec

### Handler — installSlackAppHandler (`u2f`)

```
async function installSlackAppHandler(context):
    emitTelemetry("tengu_install_slack_app_clicked")   // loc +11641762
    output({ type: "text",                              // loc +11641895
             content: "Opening Slack app installation page in browser…" })
                                                       // loc +11641908
    await openUrlHelper()                              // loc +11641800
    return
```

Analysis basis: CC v2.1.165 bundle.js:+11641760

---

### Sub-feature: Platform-Aware URL Open (`openUrlHelper` / `X8`)

The URL-open helper resolves the correct system command based on the current platform and spawns it as a child process.

```
function openUrlHelper(url):
    platform = process.platform

    if platform == "darwin":
        command = "open"
    else if platform == "win32":
        command = "rundll32"
        args    = ["url,OpenURL", url]   // loc +6804456, +6804468
    else:                                // Linux / other
        command = "xdg-open"             // loc +6804537

    // Validate URL scheme before launching
    if NOT (url.startsWith("http:") OR url.startsWith("https:")):
        throw Error("invalid URL scheme")  // loc +6803997, +6804047, +6804069

    spawnProcess(command, args)
    return
```

Key literals observed:
- `"darwin"` — macOS branch (bundle.js:+6804356)
- `"win32"` — Windows branch (bundle.js:+6804372)
- `"open"` — macOS open command (bundle.js:+6804530)
- `"rundll32"` / `"url,OpenURL"` — Windows open commands (bundle.js:+6804456, +6804468)
- `"xdg-open"` — Linux/other open command (bundle.js:+6804537)
- `"http:"` / `"https:"` — scheme validation (bundle.js:+6804047, +6804069)

Analysis basis: CC v2.1.165 bundle.js:+11641800, +3256791, +6804284

---

### Sub-feature: Config Save With Lock (`saveConfigWithLock` / `CX_`)

Called transitively from the URL-open path (via the global-config write utility). Acquires a filesystem lock before writing; guards against auth data loss.

```
async function saveConfigWithLock(configPath, updateFn):
    lockDir = path.dirname(configPath)
    fs.mkdirSync(lockDir, { recursive: true })         // loc +3259704

    lockToken = acquireLock()                          // loc +3259762
    if lockAcquisitionTookTooLong:
        logWarning("Lock acquisition took longer than expected …")
                                                       // loc +3259888
        emitTelemetry("tengu_config_lock_contention")  // loc +3259977

    existingStat = fs.statSync(configPath)             // loc +3260053

    reRead = readConfigFromDisk(configPath)            // calls bDH

    // Auth-loss guard — refuse to overwrite if re-read is missing auth
    if cache.hasAuth AND NOT reRead.hasAuth:
        emitTelemetry("tengu_config_auth_loss_prevented")  // loc +3260456
        log("saveConfigWithLock: re-read config is missing auth …")
                                                           // loc +3260304
        return

    newConfig = updateFn(reRead)
    atomicWriteConfig(configPath, newConfig)           // calls TM6

    if staleWriteDetected:
        emitTelemetry("tengu_config_stale_write")      // loc +3260113
```

Note: The 60 000 ms constant at bundle.js:+3260658 is the lock-wait timeout. Maximum backup rotation count: 5 (bundle.js:+3260907). File permission mode for new config: octal 600 / decimal 384 (bundle.js:+3261189).

Analysis basis: CC v2.1.165 bundle.js:+3259677, +3259699, +3260235

---

### Sub-feature: Atomic Config Write (`atomicWrite` / `TM6`)

```
function atomicWrite(targetPath, content):
    if fs.lstatSync(targetPath).isSymbolicLink():     // loc +1057148
        resolvedTarget = path.resolve(
            path.dirname(targetPath),
            fs.readlinkSync(targetPath))               // loc +1056751

    tmpPath = targetPath + "." + randomBytes(6).toString("hex")
                                                       // loc +1057380, +1057408
    fd = fs.openSync(tmpPath, flags)                   // loc +1056910
    try:
        fs.writeFileSync(fd, content)                  // loc +1057816
        fs.fchmodSync(fd, originalMode)                // loc +1057874
        log("Applied original permissions to temp file") // loc +1057895
        fs.fsyncSync(fd)                               // loc +1057940
    finally:
        fs.closeSync(fd)                               // loc +1056897

    fs.renameSync(tmpPath, targetPath)                 // loc +1058068
    // On error, unlink tmpPath                        // loc +1058225
```

Analysis basis: CC v2.1.165 bundle.js:+1056664, +1057024

---

### Sub-feature: Bootstrap Fetch Helper (`bootstrapFetch` / `H`)

Reachable transitively; fetches remote configuration on startup with a 5 000 ms timeout.

```
async function bootstrapFetch(url, options):
    log("[Bootstrap] Fetching", url)                   // loc +15724583
    headers = {
        "Content-Type": "application/json",            // loc +15724668, +15724683
        "User-Agent": userAgentString                  // loc +15724702
    }
    timeout = 5000                                     // loc +15724784

    response = await fetch(url, { headers, timeout })

    if NOT response.ok:
        emitTelemetry("api_bootstrap_fetch",           // loc +15724905
                      { result: "parse_failed" })      // loc +15724927
        return null

    log("[Bootstrap] Fetch ok")                        // loc +15724957
    emitTelemetry("api_bootstrap_fetch", { result: "ok" })
    return response.json()
```

Analysis basis: CC v2.1.165 bundle.js:+15724619

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_install_slack_app_clicked` (bundle.js:+11641762) — fired unconditionally on command invocation |
| Telemetry — config lock | `tengu_config_lock_contention` (bundle.js:+3259977) — fired when lock acquisition exceeds expected duration |
| Telemetry — config stale write | `tengu_config_stale_write` (bundle.js:+3260113) — fired when an outdated config write is detected |
| Telemetry — config parse error | `tengu_config_parse_error` (bundle.js:+3262552) — fired on JSON parse failure of config file |
| Telemetry — auth loss guard | `tengu_config_auth_loss_prevented` (bundle.js:+3260456) — fired when re-read config is missing auth present in cache |
| Telemetry — bootstrap fetch | `api_bootstrap_fetch` with `parse_failed` or `ok` (bundle.js:+15724905) |
| Telemetry — bg dispatch SIGKILL | `tengu_bg_dispatch_sigkill_escalate` (bundle.js:+16133657) |
| Telemetry — bg low memory | `tengu_bg_dispatch_low_mem` (bundle.js:+16134258) |
| Telemetry — bg spare enable | `tengu_bg_spare_enable` (bundle.js:+16134962) |
| Telemetry — bg spare claim | `tengu_bg_spare_claim` (bundle.js:+16135090) |
| Telemetry — bg spare claim fail | `tengu_bg_spare_claim_fail` (bundle.js:+16135356) |
| Telemetry — bg retire pinned | `tengu_bg_retire_pinned_low_mem` (bundle.js:+16138262) |
| Telemetry — bg prewarm | `tengu_bg_prewarm_per_sweep` (bundle.js:+16138383) |
| Telemetry — daemon control | `tengu_daemon_control` (bundle.js:+16170625) |
| Telemetry — daemon config reload | `tengu_daemon_config_reload` (bundle.js:+16149069) |
| Browser launch | Spawns platform OS command (`open` / `rundll32` / `xdg-open`) pointing at the Slack app installation URL |
| appState changes | None observed within depth-2 traversal |
| Hook registration | None observed within depth-2 traversal |
| Sound | None |
| supportsNonInteractive | `false` — command must not be invoked in non-interactive/headless mode |
| Config side effects | Config lock acquired and released as part of transitively called config-save path; atomic write with temp file + rename pattern |

---

## Version History

| Version | Change |
|---|---|
| v2.1.165 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `supportsNonInteractive` is `false`. Attempting to invoke `/install-slack-app` in a headless pipeline or CI environment will fail or be silently skipped.
2. **Expecting CLI output beyond the status line**: The command emits a single text message (`"Opening Slack app installation page in browser…"`) and then exits. It does not wait for the browser to close or confirm that installation succeeded.
3. **Assuming the URL is configurable**: The Slack app installation URL is hardcoded in the handler. There is no argument or flag to override it.
4. **Firewall / sandbox environments**: The URL-open command is executed via a spawned child process; sandboxed environments (e.g., Docker containers without a display server) will not be able to open a browser, causing a silent failure in the child process rather than a visible error.
5. **Platform detection nuance on Windows**: The Windows branch uses `rundll32 url,OpenURL <url>`. Environments where `rundll32` is restricted by group policy will silently fail without a meaningful error surfaced back to the CLI.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `u2f` | Main command handler (`installSlackAppHandler`) — AsyncFunction resolved via module_id `zdq` |
| `c` | Telemetry emit utility |
| `X8` | Platform-aware URL-open helper |
| `CX_` | Config save-with-lock implementation |
| `_` | Filesystem abstraction (readdirStringSync, statSync, etc.) |
| `Q6` | Config file path resolver |
| `L` | Primary filesystem module (mkdirSync, statSync, copyFileSync, etc.) |
| `q` | Secondary filesystem module (readFileSync, mkdirSync, statSync, etc.) |
| `f` | File descriptor / stream handle |
| `XP1` | Config object merge / update helper |
| `k5_` | Config field accessor / validator |
| `v` | HTTP request / fetch utility |
| `icK` | HTTP request internals (response parsing) |
| `H` | Bootstrap fetch / remote config loader |
| `SH` | JSON serialization helper |
| `J4` | String / path normalization utility |
| `ppH` | Config write helper |
| `acK` | Low-level config write (byte-length aware) |
| `v8` | Error construction / wrapping utility |
| `bDH` | Config file read and parse implementation |
| `B6` | JSON parse wrapper |
| `Ix` | String prefix-strip helper |
| `Or1` | Directory traversal / backup listing helper |
| `bX_` | Backup path builder |
| `w` | Background daemon worker / process manager |
| `fj6` | Config auth-loss detection helper |
| `A` | String case normalization (toLowerCase) |
| `V` | Versioned config entry |
| `P` | Terminal / viewport renderer |
| `J` | Worker manager wrapper |
| `j` | Worker kill helper |
| `z` | Daemon stop controller |
| `Y` | Supervisor / config reload handler |
| `h` | Background sweep / health-check scheduler |
| `L3A` | Vim-mode operator registry builder |
| `C` | Rate-limit event enqueue handler |
| `T` | Daemon lifecycle controller (start/stop/updateConfig) |
| `TM6` | Atomic file write (temp + rename) implementation |
| `O` | Filesystem stat result object (isSymbolicLink) |
| `R8` | Error code inspector |
| `_lH` | Config load-inline helper |
| `$r1` | Object entries iterator helper |
| `t98` | Timestamp / date utility |
| `RX_` | Global config save fallback implementation |
| `hK` | URL validation and open dispatcher |
| `BY7` | URL scheme validator (throws on non-http/https) |
| `FY` | OS-level open command selector |
| `C8` | CLI startup / session bootstrap |
| `S_` | Main CLI run loop |
| `bTH` | Core agent initialization |
| `D` | Forced shutdown handler (process.exit + abort) |
| `bG4` | String coercion utility |
| `K$` | Session key manager |
| `kH` | Error logger / reporter |
| `b6` | Async store context accessor |
| `bd6` | AsyncLocalStorage getStore wrapper |
| `X_` | UV (libuv) handle reference |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.