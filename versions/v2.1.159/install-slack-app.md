---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.159"
updated: "2026-06-02"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.159 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.159 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.159

---

## Overview

`/install-slack-app` is a local slash command that, when invoked, opens the Claude Slack app installation page in the user's default browser. It emits a telemetry event upon activation and displays a brief status message to the user while launching the browser. The command is non-interactive and terminates immediately after initiating the URL open.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `VC1` |
| load_inline | `true` |
| loc_byte | `11400241` |
| loc_byte_end | `11400427` |
| loc_line | `7499` |
| arbor_handler.name | `hH5` |
| arbor_handler.fqn | `claude-2.1.159::hH5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.159 bundle.js:+11400241

---

## Input Branching

This command has a simple linear flow with no user-input branching. The handler immediately emits telemetry, outputs a status message, and opens a URL. Numbered pseudocode is used.

1. Handler `installSlackAppHandler` is invoked (corresponds to `hH5`).
2. Telemetry event `tengu_install_slack_app_clicked` is emitted via the analytics dispatch function (`d`).
3. The string `"Opening Slack app installation page in browser…"` is returned as a `text`-type message to the CLI renderer.
4. The URL-open utility (`openUrlInBrowser`, corresponds to `JK`) is called to launch the browser.

Analysis basis: CC v2.1.159 bundle.js:+11399845 – +11399993

---

## Behavioral Spec

### Main Handler — `installSlackAppHandler`

```
async function installSlackAppHandler(context):
    // 1. Record user action
    emitTelemetry("tengu_install_slack_app_clicked")   // bundle.js:+11399847

    // 2. Display immediate feedback to user
    yield { type: "text",                              // bundle.js:+11399980
             content: "Opening Slack app installation page in browser…" }
                                                       // bundle.js:+11399993

    // 3. Open the browser
    openUrlInBrowser(SLACK_APP_INSTALL_URL)            // bundle.js:+11399960
```

Analysis basis: CC v2.1.159 bundle.js:+11399845

---

### URL-Open Utility — `openUrlInBrowser`

The handler delegates to `openUrlInBrowser` (`JK`), which performs platform detection before invoking the appropriate OS command.

```
function openUrlInBrowser(url):
    // Guard: only http: or https: URLs are accepted  // bundle.js:+6700310, +6700332
    if url.protocol not in {"http:", "https:"}:
        throw Error("Invalid URL protocol")           // bundle.js:+6700260

    platform = detectPlatform()                       // bundle.js:+6700619

    if platform == "darwin":
        spawn("open", [url])                          // bundle.js:+6700793
    else if platform == "win32":
        spawn("rundll32", ["url,OpenURL", url])       // bundle.js:+6700719, +6700731
    else:
        // Assume Linux / other POSIX
        spawn("xdg-open", [url])                      // bundle.js:+6700800
```

Analysis basis: CC v2.1.159 bundle.js:+6700547

---

### Config-Lock Path — `saveConfigWithLock`

The call graph shows `hH5` reaches the config-write subsystem (`z8` → `YY_`). This path is for persisting any state changes (e.g., recording that the Slack install flow was initiated). It includes lock-contention and stale-write guards.

```
async function saveConfigWithLock(configUpdater):
    acquire filesystem lock via lockfileHelper           // bundle.js:+3205990

    if lock acquisition takes longer than expected:
        // warn but do not abort
        emitTelemetry("tengu_config_lock_contention")   // bundle.js:+3209057
        log({ level: "error",
              message: "Lock acquisition took longer than expected…" })
                                                         // bundle.js:+3208968

    currentConfig = readAndParseConfig()                // bundle.js:+3206171

    if currentConfig is missing auth fields
    AND cached config contains those auth fields:
        // Safety guard — see GH #3117
        emitTelemetry("tengu_config_auth_loss_prevented") // bundle.js:+3209536
        log("saveGlobalConfig fallback: re-read config is missing auth…")
                                                          // bundle.js:+3206197
        return  // abort write

    updatedConfig = configUpdater(currentConfig)
    writeConfig(updatedConfig)                           // bundle.js:+3209961

    release lock
```

Analysis basis: CC v2.1.159 bundle.js:+3205990

---

### Config Parse / Read — `readAndParseConfig`

```
function readAndParseConfig(configPath):
    if not exists(configPath):
        throw Error("Config accessed before allowed.")  // bundle.js:+3211001

    raw = fs.readFileSync(configPath, "utf-8")          // bundle.js:+3211057, +3211084
    parsed = JSON.parse(raw)                            // (via jsonSafeParse)
    return parsed
```

On parse error, `tengu_config_parse_error` is emitted.
Analysis basis: CC v2.1.159 bundle.js:+3211124

---

### Atomic File Write — `atomicFileWrite`

Used internally when persisting config updates:

```
function atomicFileWrite(targetPath, content, permissions):
    tmpPath = targetPath + "." + randomBytes(6).toString("hex") + ".tmp"
                                                        // bundle.js:+1012273, +1012301
    fd = fs.openSync(tmpPath, ...)                      // bundle.js:+1011803
    fs.writeFileSync(fd, content)                       // bundle.js:+1012709
    fs.fchmodSync(fd, permissions)                      // bundle.js:+1012767
    fs.fsyncSync(fd)                                    // bundle.js:+1012833
    fs.renameSync(tmpPath, targetPath)                  // bundle.js:+1012961
    // On failure: unlink tmp                           // bundle.js:+1013118
```

Analysis basis: CC v2.1.159 bundle.js:+1011557

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_install_slack_app_clicked` (emitted immediately on invocation, bundle.js:+11399847) |
| Telemetry — config lock | `tengu_config_lock_contention` (bundle.js:+3209057) |
| Telemetry — stale write | `tengu_config_stale_write` (bundle.js:+3209193) |
| Telemetry — parse error | `tengu_config_parse_error` (bundle.js:+3211632) |
| Telemetry — auth loss | `tengu_config_auth_loss_prevented` (bundle.js:+3209536) |
| Telemetry — bg session | `tengu_bg_dispatch_sigkill_escalate` (bundle.js:+15469493) |
| Telemetry — low memory | `tengu_bg_dispatch_low_mem` (bundle.js:+15470072) |
| Telemetry — spare sessions | `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_spare_spawn` (bundle.js:+15470767, +15470888, +15471151, +15469186) |
| Browser launch | Spawns platform OS command (`open` / `rundll32 url,OpenURL` / `xdg-open`) to open the Slack install URL (bundle.js:+6700793, +6700719, +6700800) |
| Config write | May persist config changes via locked atomic write; guards against auth-data loss (GH #3117) |
| stdout message | Yields `{ type: "text", content: "Opening Slack app installation page in browser…" }` (bundle.js:+11399993) |
| supportsNonInteractive | `false` — command must not be invoked in headless/pipe mode |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.159 | Initial analysis |

---

## Common Mistakes

1. **Invoking in non-interactive mode**: `supportsNonInteractive` is `false` (bundle.js:+11400241). Running this command in a script or pipe context will fail or be silently ignored.
2. **Expecting a return value**: The command yields a status string and then opens the browser — it does not return a URL or confirmation of successful installation. The browser open is fire-and-forget.
3. **Assuming cross-platform parity**: The URL-open mechanism differs by OS (`open`, `rundll32`, `xdg-open`). On unusual Linux setups without `xdg-open`, the browser may not launch.
4. **Conflating the command with auth flow**: `/install-slack-app` only opens the installation page. It does not perform OAuth, store tokens, or validate Slack workspace membership.
5. **Re-running after success**: Since the command only opens a browser tab, running it multiple times simply opens multiple tabs — there is no idempotency guard.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `hH5` | Main handler for `/install-slack-app` (AsyncFunction, arbor_handler) |
| `d` | Analytics/telemetry dispatch function |
| `z8` | Global config save entry-point (calls `YY_`) |
| `YY_` | Config-save-with-lock implementation |
| `_` | Filesystem abstraction (readdirStringSync, statSync) |
| `g6` | Logging utility |
| `L` | Secondary filesystem module (mkdirSync, statSync, copyFileSync, etc.) |
| `q` | Tertiary filesystem module (readFileSync, statSync, mkdirSync, etc.) |
| `f` | File-handle / stream object (close, toLowerCase) |
| `tOq` | Config object builder / merger |
| `$K_` | Config sub-initializer |
| `N` | HTTP request helper (includes retry logic) |
| `tCK` | HTTP response handler |
| `H` | Retry/jitter helper (uses Math.random, setTimeout) |
| `RH` | JSON serialization wrapper |
| `E4` | Request body formatter |
| `vuH` | Config value normalizer |
| `_bK` | HTTP send/write implementation |
| `w8` | Warning/error logger |
| `tzH` | Config file reader and parser |
| `U6` | JSON safe-parse wrapper |
| `nb` | String prefix stripper |
| `UFq` | Directory traversal / backup file enumerator |
| `DY_` | Path join + backup naming helper |
| `w` | Background session / daemon process manager |
| `$Y6` | Config field extractor |
| `A` | Platform/string normalization helper |
| `V` | Versioned path helper (startsWith check) |
| `P` | MCP/SDK connection manager |
| `zx8` | SDK transport initializer |
| `SH` | MCP server connection handler |
| `F_` | Error factory / re-throw helper |
| `E` | Config backup list (slice for rotation) |
| `CL6` | Atomic file write implementation |
| `O` | File stat object (isSymbolicLink, etc.) |
| `P8` | Error code classifier |
| `BQH` | Config change detector |
| `pFq` | Config entry iterator |
| `FQH` | Timestamp recorder for config writes |
| `zY_` | Config symlink resolver |
| `JK` | URL-open-in-browser utility |
| `Po7` | URL protocol validator |
| `FD` | Browser-open fallback handler |
| `v8` | Process spawn wrapper |
| `T_` | Child process launch and monitor |
| `xGH` | Process I/O stream setup |
| `D` | Background daemon session launcher |
| `_94` | Process exit code stringifier |
| `Iz` | Process stdio logger |
| `R6` | Async store / context retriever |
| `rB6` | AsyncLocalStorage getStore wrapper |
| `O_` | Context null-check / default resolver |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.