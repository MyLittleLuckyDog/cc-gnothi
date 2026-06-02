---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.160"
updated: "2026-06-02"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.160 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.160 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.160

---

## Overview

`/install-slack-app` is a local slash command that opens the Claude Slack app installation page in the user's default browser. It fires a telemetry event, opens the URL via a platform-aware browser-launch utility, and then emits a short confirmation text message back to the UI. The command takes no arguments and does not support non-interactive mode.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `iu1` |
| load_inline | `true` |
| loc_byte | `11511304` |
| loc_byte_end | `11511490` |
| loc_line | `8011` |
| arbor_handler.name | `N3f` |
| arbor_handler.fqn | `claude-2.1.160::N3f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.160 bundle.js:+11511304

---

## Input Branching

The command has a simple linear flow (no user-input branching — no arguments are parsed). A numbered pseudocode list is used.

1. Command is invoked → handler `browserLaunchAndNotify` (bundle: `N3f`) is called.
2. Fire telemetry event `tengu_install_slack_app_clicked`.
3. Call `openConfigWithLock` (bundle: `W8`) to read/persist any necessary state.
4. Call `openUrlInBrowser` (bundle: `kK`) with the Slack app installation URL.
   - `kK` internally validates the URL scheme (`http:` / `https:`).
   - Platform dispatch:
     - `darwin` → `open <url>`
     - `win32` → `rundll32 url,OpenURL <url>`
     - other → `xdg-open <url>`
5. Return a `text` message: `"Opening Slack app installation page in browser…"` to the caller.

Analysis basis: CC v2.1.160 bundle.js:+11510908, +11510948, +11511023, +11511043, +11511056

---

## Behavioral Spec

### Top-level handler — `browserLaunchAndNotify`

```
async function browserLaunchAndNotify(context):
    fireEvent("tengu_install_slack_app_clicked")          // +11510910

    openConfigWithLock(context)                            // +11510948

    openUrlInBrowser(SLACK_INSTALL_URL)                    // +11511023

    return { type: "text",                                 // +11511043
             content: "Opening Slack app installation page in browser…" }
                                                           // +11511056
```

Analysis basis: CC v2.1.160 bundle.js:+11510908

---

### URL validation and browser dispatch — `openUrlInBrowser`

```
function openUrlInBrowser(url):
    if url.scheme not in ("http:", "https:"):
        throw Error("Invalid URL scheme")                  // +6749865

    platform = process.platform

    if platform == "darwin":                               // +6750224
        spawn("open", [url])
    else if platform == "win32":                           // +6750240
        spawn("rundll32", ["url,OpenURL", url])            // +6750324, +6750336
    else:
        spawn("xdg-open", [url])                           // +6750405
```

Analysis basis: CC v2.1.160 bundle.js:+6749915, +6749937, +6750152, +6750165, +6750224, +6750240

---

### Config lock acquisition — `openConfigWithLock`

```
async function openConfigWithLock(context):
    acquire file lock via lockfileHelper                   // +11510948

    if lock acquisition takes longer than expected:
        log warning "Lock acquisition took longer than expected..."
                                                           // +3245682
        emit "tengu_config_lock_contention"                // +3245771

    read config file (utf-8)                               // +3247798
    parse JSON                                             // via jsonParser

    if re-read config is missing auth present in cache:
        log "saveConfigWithLock: re-read config is missing auth..."
                                                           // +3246098
        emit "tengu_config_auth_loss_prevented"            // +3246250
        abort write to avoid overwriting ~/.claude.json

    perform any needed backup rotation:
        keep at most 5 backups                             // +3246701
        backup files identified by ".backup." infix        // +3246568

    write new config atomically:
        write to temp file
        apply original file permissions                    // +1013295
        fsync and rename into place

    release lock
```

Analysis basis: CC v2.1.160 bundle.js:+3242704, +3242760, +3245471, +3245498, +3246452

---

### Atomic file write — `atomicWriteFile`

```
function atomicWriteFile(targetPath, data):
    randomSuffix = randomBytes(6).toString("hex")          // +1012780, +1012808
    tempPath = targetPath + "." + randomSuffix

    fd = openSync(tempPath, flags)                         // +1012310
    writeFileSync(tempPath, data)                          // +1013216

    originalStat = statSync(targetPath)                    // +1012845
    fchmodSync(fd, originalStat.mode)                      // +1013274
    log "Applied original permissions to temp file"        // +1013295

    fsyncSync(fd)                                          // +1013340
    closeSync(fd)                                          // +1012297
    renameSync(tempPath, targetPath)                       // +1013468

    on error ELOOP or ENOTDIR:                             // +1012437, +1012450
        cleanupTempFile()
        throw
```

Analysis basis: CC v2.1.160 bundle.js:+1012064, +1012151, +1012171

---

### Config backup rotation — `rotateBackups`

```
function rotateBackups(configDir, configBasename):
    backupDir = join(configDir, "backups")                 // +3247283, +3247323

    entries = readdirStringSync(backupDir)
    relevantEntries = entries.filter(e => e.startsWith(configBasename))

    if relevantEntries.length > 0:
        sort by timestamp (Date.now embedded in filename)
        while relevantEntries.length > 5:                  // +3246701
            unlink oldest entry

    copyFileSync(configPath, newBackupPath)                // +3248854
```

Analysis basis: CC v2.1.160 bundle.js:+3247316, +3247356, +3247447, +3248583

---

### Bootstrap HTTP fetch — `bootstrapFetch`

```
async function bootstrapFetch(url, options):
    log "[Bootstrap] Fetching"                             // +15451800
    headers = {
        "Content-Type": "application/json",                // +15451885, +15451900
        "User-Agent": <userAgent>                          // +15451919
    }
    timeout = 5000 ms                                      // +15451991

    response = await fetch(url, { headers, timeout })

    if parse fails:
        emit "api_bootstrap_fetch" with status "parse_failed"
                                                           // +15452112, +15452134
        throw

    log "[Bootstrap] Fetch ok"                             // +15452164
    emit "api_bootstrap_fetch"
    return parsedBody
```

Analysis basis: CC v2.1.160 bundle.js:+15451798, +15451836

> This function is reached transitively through the config/network utility chain; it is not directly on the `/install-slack-app` critical path for a purely local installation URL open, but is reachable within depth-2 of the handler graph.

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_install_slack_app_clicked` fired immediately on command invocation (bundle.js:+11510910) |
| Telemetry — config lock | `tengu_config_lock_contention` if lock is slow to acquire (bundle.js:+3245771) |
| Telemetry — stale write | `tengu_config_stale_write` if config write is detected as stale (bundle.js:+3245907) |
| Telemetry — parse error | `tengu_config_parse_error` on JSON parse failure of config (bundle.js:+3248346) |
| Telemetry — auth loss | `tengu_config_auth_loss_prevented` if write would erase cached auth (bundle.js:+3246250) |
| Telemetry — bg daemon | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail` (reachable via daemon session utilities in call graph; not on direct path) |
| Browser side effect | Opens the Slack app installation URL in the OS default browser via `open` / `rundll32` / `xdg-open` |
| Config file | May read and rewrite `~/.claude.json` under a file lock; backs up to `~/.claude/backups/` keeping ≤5 backups |
| Output message | Returns a `text`-type message: `"Opening Slack app installation page in browser…"` (bundle.js:+11511056) |
| supportsNonInteractive | `false` — command must not be invoked in non-interactive pipelines |
| Sound | None detected |
| Hook registration | None detected |

---

## Version History

| Version | Change |
|---|---|
| v2.1.160 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `supportsNonInteractive` is `false`. Attempting to invoke `/install-slack-app` in a headless or piped context will fail or be rejected.
2. **Expecting a browser to open in remote/SSH environments**: The command calls `open` / `xdg-open` / `rundll32` on the machine where Claude Code is running. In remote SSH sessions without display forwarding or a browser, the command will silently fail to open a browser while still returning the text message.
3. **Passing arguments**: The command takes no arguments. Any text after `/install-slack-app` is not consumed by argument parsing.
4. **Assuming the config is unchanged**: The handler acquires a config lock and may rewrite `~/.claude.json` as a side effect. Concurrent Claude Code processes should respect the lock to avoid corruption.
5. **Assuming instant browser launch**: URL validation (`http:`/`https:` scheme check) happens before the system call; an environment misconfiguration that causes the scheme check to fail will throw an error rather than opening the browser.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `N3f` | Top-level async command handler (`browserLaunchAndNotify`) — Arbor-resolved entry point |
| `d` | Telemetry event emitter / logging utility |
| `W8` | Config read-with-lock orchestrator (`openConfigWithLock`) |
| `xY_` | Config save-with-lock worker (`saveConfigWithLock`) |
| `_` | Filesystem abstraction (lstat / readdir variants) |
| `d6` | Path existence / access check helper |
| `L` | Secondary filesystem wrapper (mkdirSync, statSync, etc.) |
| `q` | Primary filesystem wrapper (readFileSync, copyFileSync, etc.) |
| `f` | Async file handle / stream with close lifecycle |
| `qYq` | HTTP request builder / dispatcher |
| `R4_` | HTTP response handler |
| `N` | HTTP fetch wrapper (bootstrap fetch) |
| `lmK` | HTTP response body parser |
| `H` | Bootstrap fetch function with User-Agent and timeout |
| `SH` | JSON serializer wrapper |
| `x4` | Request header builder |
| `PmH` | URL construction helper |
| `rmK` | Atomic file write orchestrator |
| `G8` | Generic error constructor / wrapper |
| `ZDH` | Config file reader with backup logic |
| `m6` | JSON parser wrapper |
| `Ax` | String prefix stripper |
| `nQq` | Backup directory listing and rotation helper |
| `uY_` | Path join helper for backup filenames |
| `w` | Background daemon session manager |
| `fY6` | Config cache accessor |
| `A` | String case normalizer |
| `V` | File path filter (startsWith check) |
| `X` | MCP / SDK connection manager |
| `Yu8` | SDK transport factory |
| `yH` | MCP server connection handler |
| `d_` | Error string formatter |
| `Z` | Backup list slicer |
| `If6` | Atomic write-to-temp-then-rename implementation |
| `O` | File stat wrapper (symbolic link detection) |
| `V8` | Error code inspector |
| `SdH` | Config merge / diff helper |
| `lQq` | Object entries iterator for config fields |
| `RdH` | Timestamp-based staleness checker |
| `bY_` | Global config save fallback path |
| `kK` | Platform-aware URL browser opener (`openUrlInBrowser`) |
| `vL7` | URL scheme validator |
| `MY` | Platform detection utility |
| `h8` | CLI argument / context resolver |
| `v_` | Main CLI entry orchestrator |
| `jEH` | Argument parser (CLI flags) |
| `Y` | Process exit / abort controller |
| `o44` | String coercion utility |
| `SO` | Session / context initializer |
| `S6` | Async-local-storage context reader |
| `sF6` | Store accessor for current async context |
| `Y_` | Locale / i18n resolver |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.