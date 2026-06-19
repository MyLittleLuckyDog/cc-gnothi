---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.179"
updated: "2026-06-19"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.179 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.179 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.179

---

## Overview

The `/install-slack-app` command opens the Claude Slack app installation page in the user's default browser. It is a local, non-interactive utility command that fires a telemetry event, writes a status message to the terminal, and delegates to the platform URL-opener — making no changes to Claude Code's own configuration or project state.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `T7K` |
| load_inline | `true` |
| loc_byte | `12049473` |
| loc_byte_end | `12049659` |
| loc_line | `8111` |
| arbor_handler.name | `TnL` |
| arbor_handler.fqn | `claude-2.1.179::TnL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.179 bundle.js:+12049473

---

## Input Branching

The command has a simple linear flow (no user-supplied arguments are evaluated; no runtime branching exists beyond what the OS URL-opener internally performs). Numbered pseudocode is used.

1. Command is invoked by the user (no arguments consumed).
2. Emit telemetry event `tengu_install_slack_app_clicked`.
3. Output the status string `"Opening Slack app installation page in browser…"` as a `text`-type response to the terminal.
4. Call the platform URL-opener (`openUrl`) with the Slack app installation URL.
5. Return; command completes.

---

## Behavioral Spec

### Main Handler — `installSlackAppHandler` (`TnL`)

Analysis basis: CC v2.1.179 bundle.js:+12049077 – +12049192

```
async function installSlackAppHandler(context):

    // Step 1 — record intent
    emitTelemetry("tengu_install_slack_app_clicked")        // loc +12049079

    // Step 2 — inform the user
    yield { type: "text",                                    // loc +12049212
            content: "Opening Slack app installation page in browser…" }
                                                            // loc +12049225

    // Step 3 — open the URL in the system browser
    openUrlInBrowser(SLACK_APP_INSTALL_URL)                 // loc +12049192
    // openUrlInBrowser delegates to platformUrlOpener (v4 → Gl1 → g8)

    return
```

### URL-Opener sub-call — `platformUrlOpener` (`v4` → `Gl1` → `g8`)

Analysis basis: CC v2.1.179 bundle.js:+12049192, +2549646, +2549659

```
function openUrlInBrowser(url):

    // Validate URL scheme — only http: or https: are accepted
    if not url.startsWith("http:") and not url.startsWith("https:"):
        throw Error("invalid URL scheme")                   // loc +2549038/+2549088/+2549110

    // Platform dispatch
    if platform == "darwin":
        spawn("open", [url])                                // loc +2549776/+2549795
    else:
        // Linux/Windows fallback via xdg-open or start
        spawnPlatformDefaultOpener(url)

    // On success the OS takes over; no return value is consumed by the caller
```

### Config-write infrastructure (transitive, not directly invoked by handler)

The call graph reaches several config-persistence helpers (`J8`, `eO8`, `r5H`, `tO8`) that are part of the shared config-save subsystem. These are **not** called directly by the `install-slack-app` handler; they appear in the graph because `TnL` calls the telemetry helper `d` (Analysis basis: CC v2.1.179 bundle.js:+12049077), which shares module-level infrastructure with those helpers. No configuration file is read or written during a normal `/install-slack-app` invocation.

Key infrastructure literals observed in the traversal (cited for completeness):

- Lock-contention warning: `"Lock acquisition took longer than expected - another Claude instance may be running"` (bundle.js:+3397729)
- Auth-loss guard log: `"saveConfigWithLock: re-read config is missing auth that cache has…"` (bundle.js:+3398145)
- Config backup directory name: `"backups"` (bundle.js:+3399330)
- Backup filename sentinel: `".backup."` (bundle.js:+3398615)
- Maximum backup count: `5` (bundle.js:+3398748)
- Config file encoding: `"utf-8"` (bundle.js:+3399845)

These constants belong to the config subsystem and are **not** exercised by `/install-slack-app` itself.

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_install_slack_app_clicked` (loc +12049079) — fired once on invocation |
| Telemetry (transitive infra) | `tengu_config_lock_contention`, `tengu_config_stale_write`, `tengu_config_parse_error`, `tengu_config_auth_loss_prevented`, `tengu_config_fallback_write`, `tengu_bg_*` (reachable via shared subsystem modules; not fired by this command's happy path) |
| Browser launch | Opens the Slack app installation URL via the OS default browser |
| Terminal output | Prints `"Opening Slack app installation page in browser…"` as a `text`-type message |
| appState changes | None — command does not mutate Claude Code application state |
| File system | None — no reads or writes performed by this command |
| Hook registration | None observed in depth-2 traversal |
| Sound | None observed |
| supportsNonInteractive | `false` — must be run in an interactive session |

---

## Version History

| Version | Change |
|---|---|
| v2.1.179 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `/install-slack-app` has `supportsNonInteractive: false`. Invoking it from a headless or piped session (e.g., `claude --no-interactive`) will not produce the expected browser launch.
2. **Expecting CLI output beyond the status line**: The command emits exactly one `text` response (`"Opening Slack app installation page in browser…"`) and then returns. No confirmation of successful browser launch is printed.
3. **No arguments accepted**: The command takes no arguments. Any text supplied after the command name is ignored.
4. **macOS-only `open` binary**: On Darwin the handler spawns `open`; on other platforms a different system command is used. If the OS default browser is not configured, the URL may fail to open silently.
5. **Confusing transitive telemetry events**: The depth-2 call graph surfaces many `tengu_config_*` and `tengu_bg_*` events. These belong to shared infrastructure modules, not to this command. Only `tengu_install_slack_app_clicked` is emitted directly by `/install-slack-app`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `TnL` | Main async handler for `/install-slack-app` (`installSlackAppHandler`) |
| `d` | Telemetry emitter helper |
| `J8` | Global config save orchestrator |
| `eO8` | Config file write-with-lock implementation |
| `_` | File-system utility (stat / readdir wrapper) |
| `c6` | Config file path resolver |
| `f` | Secondary file-system module (mkdirSync, statSync, etc.) |
| `q` | Primary file-system module (readFileSync, writeFileSync, etc.) |
| `L` | Lock/stream lifecycle manager |
| `RC1` | Config object merge helper |
| `x2_` | Config schema validator |
| `N` | HTTP/network request helper (also used for config save path) |
| `nM4` | Auth token normaliser |
| `H` | Jitter/retry timer utility |
| `bH` | JSON serialiser wrapper |
| `g4` | HTTP response body extractor |
| `ydH` | Error formatter for HTTP responses |
| `aM4` | HTTP request sender |
| `G8` | Generic error-code classifier |
| `r5H` | Config file reader with backup support |
| `l6` | JSON parse wrapper |
| `Vm` | String prefix stripper |
| `fM9` | Config directory scanner / backup enumerator |
| `ay_` | Backup path builder |
| `D` | Background daemon session manager |
| `RsH` | Auth-loss guard for config writes |
| `A` | Platform string normaliser |
| `v` | Terminal scroll/viewport math helper |
| `S` | Terminal supervisor writer |
| `Z` | Viewport clamping utility |
| `P` | IPC message-framing / stream reader |
| `X` | IPC timeout manager |
| `j` | Background session kill dispatcher |
| `cL` | IPC connection closer |
| `qx5` | Daemon protocol message dispatcher |
| `GH` | String coercion helper |
| `ED6` | Atomic file write helper (temp-file + rename) |
| `O` | Stream / symbolic-link stat helper |
| `x8` | Error code extractor |
| `rXH` | Config save lock initialiser |
| `KM9` | Config entry enumerator |
| `pG6` | Timestamp recorder for config saves |
| `tO8` | Config file atomic write (with fallback) |
| `QH` | Async operation scheduler / queuer |
| `n36` | Queue node constructor |
| `v4` | URL-open dispatcher (validates scheme, selects platform command) |
| `zyf` | URL scheme validator |
| `Gl1` | Platform-specific browser-open command builder |
| `Mw` | Child-process spawn wrapper |
| `g8` | Browser-open entry point (delegates to `o_` and `x6`) |
| `o_` | Process spawn executor with stdio routing |
| `x6` | Post-spawn result handler |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.