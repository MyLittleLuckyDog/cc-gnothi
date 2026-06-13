---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.176"
updated: "2026-06-13"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.176 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.176 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.176

---

## Overview

`/install-slack-app` is a local slash command that opens the Claude Slack app installation page in the user's default browser. The command fires a telemetry event, prints a status message to the terminal, and then delegates to the platform URL-opener utility to launch the browser. It performs no interactive prompting and explicitly does not support non-interactive mode.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | Install the Claude Slack app |
| loc_byte | `11978184` |
| loc_byte_end | `11978370` |
| loc_line | `8252` |
| supportsNonInteractive | `false` |
| module_id | `v9K` |
| load_inline | `true` |
| arbor_handler.name | `tBL` |
| arbor_handler.fqn | `claude-2.1.176::tBL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.176 bundle.js:+11978184

---

## Input Branching

This command has a simple, nearly linear flow with a single platform-detection branch inside the URL-opener utility. Numbered pseudocode is used.

1. User invokes `/install-slack-app` (no arguments expected or processed).
2. Handler `tBL` fires telemetry event `tengu_install_slack_app_clicked`.
3. Handler emits the status text `"Opening Slack app installation page in browser…"` as a `text`-type output.
4. Handler calls the configuration persistence helper (saveConfig path via `P8`) to persist any pending state changes before leaving the CLI context.
5. Handler calls the URL-opener utility (`rK`) with the Slack app installation URL.
6. Inside the URL-opener (`rK`):
   - Validates that the URL scheme is `http:` or `https:`.
   - Detects the current platform (`process.platform`):
     - `darwin` → invokes `open <url>`
     - `win32` → invokes `rundll32 url,OpenURL <url>`
     - other (Linux/etc.) → invokes `xdg-open <url>`
7. The browser opens the installation page; the command returns.

Analysis basis: CC v2.1.176 bundle.js:+11977788 – +11977936

---

## Behavioral Spec

### Main Handler (tBL)

```
async function installSlackAppHandler(context):
    emit telemetry("tengu_install_slack_app_clicked")
    // Analysis basis: CC v2.1.176 bundle.js:+11977790

    print output({ type: "text",
                   text: "Opening Slack app installation page in browser…" })
    // Analysis basis: CC v2.1.176 bundle.js:+11977923, +11977936

    await saveConfigWithLock(context)          // saveConfig path
    // Analysis basis: CC v2.1.176 bundle.js:+11977828

    await openUrlInBrowser(SLACK_APP_INSTALL_URL)
    // Analysis basis: CC v2.1.176 bundle.js:+11977903
```

### Config Persistence (P8 / saveConfigWithLock)

Before handing off to the browser opener, the handler invokes the config save path. That path:

1. Acquires a filesystem lock (via `j38` / lock-acquisition helper).
2. If lock acquisition takes longer than expected, emits `tengu_config_lock_contention` and logs `"Lock acquisition took longer than expected - another Claude instance may be running"`.
   Analysis basis: CC v2.1.176 bundle.js:+3334693, +3334782
3. Re-reads the on-disk config (via `G5H` / config-reader helper).
4. Guards against auth-loss: if the re-read config is missing auth that the in-memory cache has, it refuses to write and logs a warning referencing GH #3117; emits `tengu_config_stale_write`.
   Analysis basis: CC v2.1.176 bundle.js:+3335109, +3334918
5. Writes updated config atomically using a temp-file + rename strategy (via `EY6` / atomic-write helper).
6. Releases the lock.

```
async function saveConfigWithLock(context):
    lock = await acquireLock()
    if lock_contention_detected:
        emit telemetry("tengu_config_lock_contention")
        log_error("Lock acquisition took longer than expected…")

    diskConfig = readConfigFromDisk()

    if diskConfig.auth is missing AND cache.auth is present:
        emit telemetry("tengu_config_stale_write")
        log_warning("re-read config is missing auth … refusing to write")
        releaseLock(lock)
        return

    atomicWriteConfig(mergedConfig)
    releaseLock(lock)
```

Analysis basis: CC v2.1.176 bundle.js:+3331539 (P8 entry), +3334782, +3335109

### URL Opener (rK)

```
async function openUrlInBrowser(url):
    if not url.startsWith("http:") and not url.startsWith("https:"):
        throw Error("invalid URL scheme")
    // Analysis basis: CC v2.1.176 bundle.js:+6294102, +6294124

    platform = process.platform
    // Analysis basis: CC v2.1.176 bundle.js:+6294411

    if platform == "darwin":
        spawn("open", [url])
    else if platform == "win32":
        spawn("rundll32", ["url,OpenURL", url])
        // Analysis basis: CC v2.1.176 bundle.js:+6294511, +6294523
    else:
        spawn("xdg-open", [url])
        // Analysis basis: CC v2.1.176 bundle.js:+6294592
```

Analysis basis: CC v2.1.176 bundle.js:+6294339 (rK entry), +6294460 (NY), +6294585 (open literal)

### Atomic Config Write (EY6)

The atomic-write helper used by `saveConfigWithLock`:

1. Resolves the target path; if it is a symlink, follows it.
   Analysis basis: CC v2.1.176 bundle.js:+1091361, +1091776
2. Generates a random hex temp filename.
   Analysis basis: CC v2.1.176 bundle.js:+1091990, +1092018
3. Writes content to the temp file using `writeFileSync`.
4. Applies original file permissions via `fchmodSync`.
   Analysis basis: CC v2.1.176 bundle.js:+1092484
5. Calls `fsyncSync` to flush to disk.
   Analysis basis: CC v2.1.176 bundle.js:+1092550
6. Renames temp file over the target atomically.
   Analysis basis: CC v2.1.176 bundle.js:+1092678
7. On any failure, unlinks the temp file.
   Analysis basis: CC v2.1.176 bundle.js:+1092835

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry (primary) | `tengu_install_slack_app_clicked` — fired immediately on invocation (bundle.js:+11977790) |
| Telemetry (config) | `tengu_config_lock_contention` — fired if the config lock is slow to acquire (bundle.js:+3334782) |
| Telemetry (config) | `tengu_config_stale_write` — fired if the safe-write guard detects auth loss (bundle.js:+3334918) |
| Telemetry (config) | `tengu_config_parse_error` — fired if config JSON cannot be parsed (bundle.js:+3337357) |
| Terminal output | Prints `"Opening Slack app installation page in browser…"` as a `text`-type message before browser launch (bundle.js:+11977936) |
| Browser side-effect | Spawns the platform URL-opener (`open` / `rundll32` / `xdg-open`) pointing at the Slack app installation URL |
| Config file | May rewrite `~/.claude.json` atomically if pending config changes exist; will NOT write if doing so would wipe cached auth credentials |
| appState changes | None observed in depth-2 traversal |
| Sound | None observed in depth-2 traversal |
| Hook registration | None observed in depth-2 traversal |
| supportsNonInteractive | `false` — command must be run in an interactive session |

---

## Version History

| Version | Change |
|---|---|
| v2.1.176 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: The registration explicitly sets `supportsNonInteractive: false`. Attempting to invoke `/install-slack-app` from a non-interactive pipeline or headless script will fail or be silently skipped.
2. **Expecting the command to complete Slack configuration**: The command only opens the installation page in a browser. Completing the OAuth flow and linking the workspace to Claude requires interaction in the browser and Slack itself — the CLI does nothing after launching the browser.
3. **Confusing the browser launch with a successful install**: If the platform URL-opener binary (`open`, `rundll32`, or `xdg-open`) is not available or the URL scheme validation fails, the command will throw an error before any browser window opens. The status text `"Opening Slack app installation page in browser…"` is printed *before* the spawn call, so seeing that message does not guarantee the browser actually launched.
4. **Concurrent Claude instances causing lock warnings**: If another Claude Code instance is running and holds the config lock, this command may log a lock-contention warning. This is non-fatal but indicates the config save was delayed or skipped.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `tBL` | Main async handler for `/install-slack-app` (AsyncFunction, module `v9K`) |
| `d` | Telemetry event emitter / logging utility |
| `P8` | Config save-with-lock orchestrator |
| `j38` | Config lock-acquisition and file-sync helper |
| `_` | Filesystem abstraction (sync FS ops wrapper) |
| `Q6` | Path resolution / config path helper |
| `f` | File-writing subsystem (used in atomic write pipeline) |
| `q` | Secondary filesystem module (readFileSync, mkdirSync, etc.) |
| `L` | Finalizer / cleanup chain (close + queue flush) |
| `dI1` | Config object merge / normalisation helper |
| `oJ_` | Config default-value applier |
| `N` | HTTP/network request helper (used in config sync path) |
| `gff` | Fetch wrapper with retry logic |
| `H` | Random-backoff / jitter timer |
| `CH` | JSON serialiser (wraps `JSON.stringify`) |
| `bf` | Request header builder |
| `kQH` | Credential/token formatter |
| `lff` | HTTP response body streamer |
| `E8` | Error normaliser / structured error constructor |
| `G5H` | On-disk config reader (handles backup/rotation) |
| `c6` | JSON deserialiser (wraps `JSON.parse`) |
| `Jm` | String prefix-strip utility |
| `gK9` | Config backup directory scanner |
| `vN_` | Path join + mkdir helper |
| `D` | Background daemon session manager |
| `EaH` | Config merge validator |
| `A` | Lowercase string normaliser |
| `V` | Filename filter predicate |
| `P` | IPC/pipe framing reader |
| `X` | Stream timeout wrapper |
| `j` | Process group manager (kill all workers) |
| `mL` | Stream end / flush utility |
| `qI5` | Background session IPC message dispatcher |
| `TH` | String coercion utility |
| `E` | Array slice/clamp utility |
| `W` | SDK connection orchestrator |
| `EY6` | Atomic file write helper (temp + rename) |
| `O` | Symbolic-link stat helper / stream event emitter |
| `k8` | Error code extractor |
| `zXH` | Config path builder (global config location) |
| `FK9` | Config entry iterator (Object.entries wrapper) |
| `h06` | Timestamp logger (Date.now wrapper) |
| `D38` | Partial config writer (atomic, no lock) |
| `rK` | Cross-platform URL browser-opener |
| `V07` | URL scheme validator |
| `NY` | Platform detection helper |
| `p8` | CLI bootstrap / process initialiser |
| `n_` | Main CLI entry runner |
| `zhH` | Process signal and lifecycle handler |
| `Y` | Forced shutdown helper (process.exit path) |
| `iFf` | Error message stringifier |
| `L5` | Session lifecycle state machine |
| `kH` | Tool-call error logger |
| `x6` | AsyncLocalStorage context accessor |
| `bs6` | Context store getter |
| `T_` | UI render / event-gate initialiser |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.