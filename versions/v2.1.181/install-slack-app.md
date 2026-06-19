---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.181"
updated: "2026-06-19"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.181 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.181 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.181

---

## Overview

The `/install-slack-app` command opens the Claude Slack app installation page in the user's default web browser. It emits a telemetry event upon invocation, displays a brief status message, and delegates the browser-open action to an OS-aware URL launcher — requiring no further user interaction within the CLI.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | Install the Claude Slack app |
| loc_byte | 11890973 |
| loc_byte_end | 11891159 |
| loc_line | 7727 |
| supportsNonInteractive | `false` |
| module_id | `rdl` |
| load_inline | `true` |
| arbor_handler.name | `$Vp` |
| arbor_handler.fqn | `claude-2.1.181::$Vp` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | 0 |

Analysis basis: CC v2.1.181 bundle.js:+11890973

---

## Input Branching

The command takes no user-supplied arguments and follows a linear execution path with no conditional branching on input. Numbered pseudocode is used.

1. Command is invoked (no arguments accepted).
2. Emit telemetry event `tengu_install_slack_app_clicked`.
3. Write a `"text"` type message: `"Opening Slack app installation page in browser…"` to the output stream.
4. Invoke the URL-opener utility (`openUrlInBrowser`) which dispatches to the OS-appropriate launcher.
5. Return.

Analysis basis: CC v2.1.181 bundle.js:+11890577, +11890617, +11890692, +11890712, +11890725

---

## Behavioral Spec

### Main Handler — `installSlackAppHandler`

This is an `AsyncFunction` resolved via `module_id` → `rdl`.

```
async function installSlackAppHandler(context):
    # Step 1: Record user intent
    emitTelemetry("tengu_install_slack_app_clicked")

    # Step 2: Display status feedback to user
    yieldOutputMessage(type="text", body="Opening Slack app installation page in browser…")

    # Step 3: Open URL in browser
    openUrlInBrowser(targetUrl)

    return
```

Analysis basis: CC v2.1.181 bundle.js:+11890577, +11890617, +11890692, +11890712, +11890725

---

### URL Opener — `openUrlInBrowser`

Resolved as handler `Dc` (called from `installSlackAppHandler` at +11890692). Internally delegates to `Sti` which performs platform detection.

```
function openUrlInBrowser(url):
    # Validate that url scheme is http: or https:
    if url does not start with "http:" or "https:":
        raise Error (via errorGuard)

    # Platform dispatch
    platformLauncher(url)
```

Analysis basis: CC v2.1.181 bundle.js:+3106763, +3106205, +3106227

---

### Platform Launcher — `platformLauncher`

Resolved as `Sti`, called from `openUrlInBrowser`.

```
function platformLauncher(url):
    if platform == "darwin":
        spawn("open", [url])
    else:
        # Use cross-platform opener utility (via Un/Vr)
        crossPlatformOpen(url)
```

Analysis basis: CC v2.1.181 bundle.js:+3106834, +3106893, +3106912

---

### Cross-Platform URL Open — `crossPlatformOpen`

Resolved as `Un` → `Vr`, handles non-macOS platforms.

```
function crossPlatformOpen(url):
    # Selects system browser command based on OS
    # Falls back through a chain of candidates (via Vr)
    # Executes chosen command with url as argument
    # Logs result; on failure logs error via logUtil
    execute(browserCommand, [url])
```

Analysis basis: CC v2.1.181 bundle.js:+1133478, +1134072, +1134407

---

### Config Lock & Persistence (Supporting Infrastructure)

The call graph reaches config-write utilities (`un` → `n7n`, `w_e`, `lSt`) that implement file-locking, config backup, and atomic write semantics. These are not directly triggered by `/install-slack-app`'s happy path but are part of shared infrastructure reachable within the depth-2 traversal. Key behaviors observed:

- **Lock contention warning**: If config lock acquisition exceeds an expected duration, logs `"Lock acquisition took longer than expected - another Claude instance may be running"` and emits `tengu_config_lock_contention`. (Analysis basis: CC v2.1.181 bundle.js:+13939139, +13939228)
- **Stale-write guard**: Before persisting config, the system checks that a re-read of the config file does not omit auth fields that the in-memory cache holds. If discrepancy is detected, write is refused and `tengu_config_stale_write` is emitted, with a reference to GH issue #3117. (Analysis basis: CC v2.1.181 bundle.js:+13939555, +13939364)
- **Auth-loss prevention**: A dedicated guard emits `tengu_config_auth_loss_prevented` when a write would silently drop authentication credentials. (Analysis basis: CC v2.1.181 bundle.js:+13939707)
- **Config parse error**: Emits `tengu_config_parse_error` when JSON parsing of a config file fails. (Analysis basis: CC v2.1.181 bundle.js:+13941803)
- **Backup rotation**: Config backups are written to a `"backups"` subdirectory. Up to 5 backups are retained; files containing `".backup."` in their name are identified as backup files. (Analysis basis: CC v2.1.181 bundle.js:+13940740, +13940025, +13940158)
- **Atomic write**: Uses random-bytes temp file, `fchmodSync` to preserve permissions, `fsyncSync`, then `renameSync` for crash-safe replacement. (Analysis basis: CC v2.1.181 bundle.js:+1094871, +1095312, +1095374, +1095521, +1095730)
- **Fallback write**: If in-place rename fails, a fallback write path is attempted; on failure, content is preserved at the temp path with error code `"writeFileSyncAndFlush: in-place fallback write failed; content preserved at temp path"`. (Analysis basis: CC v2.1.181 bundle.js:+1096685)

> Note: These behaviors are shared infrastructure utilities co-located in the same bundle region. They are not exclusive to `/install-slack-app`.

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry (primary) | `tengu_install_slack_app_clicked` — fired immediately on handler entry (bundle.js:+11890579) |
| Telemetry (config infra) | `tengu_config_lock_contention`, `tengu_config_stale_write`, `tengu_config_parse_error`, `tengu_config_auth_loss_prevented`, `tengu_config_fallback_write` |
| Telemetry (bg daemon infra) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop`, `tengu_bg_attach_legacy_autorespawn`, `tengu_bg_attach`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_stall_respawn`, `tengu_bg_attach_kick`, `tengu_daemon_control` |
| Output message | Emits one `"text"` type message: `"Opening Slack app installation page in browser…"` (bundle.js:+11890712, +11890725) |
| Browser side effect | Launches default OS browser to the Slack app installation URL via `open` (macOS) or cross-platform equivalent |
| supportsNonInteractive | `false` — command must be run in an interactive session |
| appState changes | None observed in depth-2 traversal |
| Hook registration | None observed |
| Sound | None observed |
| File system | No writes performed by the command itself; config-write utilities are shared infrastructure and not invoked on the happy path |

---

## Version History

| Version | Change |
|---|---|
| v2.1.181 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: Because `supportsNonInteractive` is `false`, invoking `/install-slack-app` in a scripted or `--no-interactive` context will not execute the handler correctly. Use an interactive terminal session.
2. **Expecting CLI output beyond the status message**: The command opens a browser and exits. It does not poll for installation completion or return any confirmation from Slack. The user must complete the installation flow in the browser.
3. **Firewall / sandbox blocking the browser launcher**: On Linux or restricted environments, the cross-platform URL opener (`Un`/`Vr` chain) may silently fail if no browser command is available. Check that `xdg-open` or an equivalent is installed and functional.
4. **Confusing config-lock telemetry with command failure**: If `tengu_config_lock_contention` appears in logs around the same time as running this command, it originates from the shared config infrastructure and does not indicate that the Slack installation URL was not opened.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `$Vp` | Main handler — `installSlackAppHandler` (AsyncFunction, resolved via module_id `rdl`) |
| `j` | Telemetry emit utility |
| `un` | Config save orchestrator (global config write path) |
| `n7n` | Config write with lock — acquires file lock, backs up, writes atomically |
| `t` | Internal utility (fs or path helper, context-dependent) |
| `jt` | Path/file existence check utility |
| `s` | File system module reference (sync ops) |
| `r` | Secondary file system reference (read/write ops) |
| `i` | Stream or lock handle |
| `gBs` | HTTP request builder / options merger |
| `kvr` | HTTP client base utility |
| `I` | HTTP request executor / fetch wrapper |
| `xhc` | HTTP response handler |
| `e` | Generic iteration / event emitter variable |
| `Re` | JSON serializer wrapper |
| `qc` | URL or string manipulation utility |
| `nqe` | Query string builder |
| `Rhc` | HTTP body encoder / request dispatcher |
| `ln` | Logger utility |
| `w_e` | Config file reader — reads, parses, and resolves config from disk |
| `Wt` | JSON parse wrapper |
| `x9` | String prefix-strip utility |
| `uUl` | Directory walker / config file locator |
| `h0o` | Path join helper |
| `f` | Background daemon session manager |
| `qmt` | Config merge / patch utility |
| `n` | String normalizer (toLowerCase etc.) |
| `T` | Terminal / display geometry handler |
| `x` | Input event / keypress handler |
| `E` | Viewport boundary calculator |
| `g` | IPC message framer / buffer splitter |
| `h` | Socket timeout handler |
| `m` | Background session kill manager |
| `sf` | Stream end / flush helper |
| `y9f` | Background daemon protocol message router |
| `Ee` | String coercion utility |
| `lSt` | Atomic file write utility (temp → rename, fchmod, fsync) |
| `Jp` | Symlink resolution / realpath utility |
| `u` | OS / process information provider |
| `Dn` | Error code logger |
| `cKe` | fchmod error classifier |
| `dMe` | Config diff / validation utility |
| `f0o` | Object entries iterator helper |
| `L8t` | Timestamp generator (Date.now wrapper) |
| `t7n` | Config fallback write path handler |
| `$e` | App state / global state accessor |
| `Rht` | Root state initializer |
| `Dc` | URL opener entry point — validates scheme, dispatches to platform launcher |
| `O8u` | URL validation error thrower |
| `Sti` | Platform-aware browser launcher |
| `b_` | Browser command builder |
| `Un` | Cross-platform open dispatcher |
| `Vr` | Browser candidate resolver and executor |
| `Mt` | Child process spawner for browser open |