---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.187"
updated: "2026-06-24"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.187 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.187 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.187

---

## Overview

`/install-slack-app` is a local CLI command that opens the Claude Slack app installation page in the user's default browser. When invoked, it fires a telemetry event, displays a brief status message, and delegates to the platform URL-opener utility. It does not accept arguments and is not available in non-interactive mode.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `lEl` |
| load_inline | `true` |
| loc_byte | `11683949` |
| loc_byte_end | `11684135` |
| loc_line | `7915` |
| arbor_handler.name | `grf` |
| arbor_handler.fqn | `claude-2.1.187::grf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.187 bundle.js:+11683949

---

## Input Branching

This command follows a simple linear flow with no conditional input branching. Numbered pseudocode is used.

1. User invokes `/install-slack-app` from the interactive CLI.
2. Handler `grf` is called (resolved via `module_id` → `lEl`).
3. Telemetry event `tengu_install_slack_app_clicked` is emitted.
4. A text message `"Opening Slack app installation page in browser…"` is returned to the UI.
5. The URL-opener utility (`Zl`) is called with the Slack app installation URL.
6. `Zl` validates the URL scheme (accepts `http:` and `https:`) then invokes the platform browser-open helper (`Tli`).
7. On macOS, `Tli` uses the `open` command; other platforms use their respective launcher.
8. The async handler resolves; control returns to the shell.

Analysis basis: CC v2.1.187 bundle.js:+11683553 – +11683701

---

## Behavioral Spec

### Main Handler — `grf`

```
async function installSlackAppHandler(context):
    emitTelemetry("tengu_install_slack_app_clicked")         // +11683555
    openUrl(SLACK_APP_INSTALL_URL)                           // +11683668
    return { type: "text",                                   // +11683688
             content: "Opening Slack app installation page in browser…" }
                                                             // +11683701
```

Analysis basis: CC v2.1.187 bundle.js:+11683553

---

### URL Validation and Browser Launch — `openUrl` (bundle: `Zl`)

```
function openUrl(url):
    if url does not start with "http:" or "https:":          // +3116144, +3116166
        raise Error("invalid URL scheme")                    // +3116094
    launchInBrowser(url)                                     // +3116715
```

Analysis basis: CC v2.1.187 bundle.js:+3116702

---

### Platform Browser Launcher — `launchInBrowser` (bundle: `Tli`)

```
function launchInBrowser(url):
    platformLauncher = resolveLauncher()                     // +3116773
    if platform == "darwin":                                 // +3116832
        spawn("open", [url])                                 // +3116851
    else:
        spawn(platformLauncher, [url])
    await completion via Un/Wr/Pt helpers                    // +3116873
```

Analysis basis: CC v2.1.187 bundle.js:+3116715

---

### Config Save with Lock — `saveConfigWithLock` (bundle: `GQn`)

> This utility is invoked transitively via the telemetry emission path (`hn` → `GQn`). It is not specific to `/install-slack-app` but is reached within the depth-2 call graph.

```
function saveConfigWithLock(configPath, updater):
    acquire filesystem lock (mkdirSync-based)                // +13750018
    if lock takes too long:
        log warning "Lock acquisition took longer than expected…"  // +13750202
        emit telemetry "tengu_config_lock_contention"        // +13750291

    existingConfig = readCurrentConfig(configPath)           // UTF-8, +13752318
    newConfig = updater(existingConfig)

    if new config is missing auth that cache has:
        emit telemetry "tengu_config_auth_loss_prevented"    // +13750770
        log warning "saveConfigWithLock: re-read config is missing auth…"
                                                             // +13750618
        return without writing

    atomicWriteFile(configPath, newConfig)                   // via oIt, +13751461
    release lock
```

Analysis basis: CC v2.1.187 bundle.js:+13749991

---

### Atomic File Write — `atomicWriteFile` (bundle: `oIt`)

```
function atomicWriteFile(targetPath, content):
    tempPath = targetPath + "." + randomHex(8) + ".tmp"     // +1100233, "hex" +1100261
    if targetPath exists:
        originalPermissions = statSync(targetPath).mode     // +1100303
    writeFileSync(tempPath, content)                        // +1100674
    fchmodSync(tempPath, originalPermissions)               // +1100736
    fsyncSync(tempPath)                                     // +1100883
    renameSync(tempPath, targetPath)                        // +1101092 (atomic swap)
    if EACCES on rename:
        fallback in-place write                             // +1101265
```

Analysis basis: CC v2.1.187 bundle.js:+1099498

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry (primary) | `tengu_install_slack_app_clicked` — fired immediately on invocation (bundle.js:+11683555) |
| Telemetry (config subsystem) | `tengu_config_lock_contention`, `tengu_config_stale_write`, `tengu_config_parse_error`, `tengu_config_auth_loss_prevented`, `tengu_config_fallback_write` — emitted by the config-save path reached transitively |
| Telemetry (background daemon) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop`, `tengu_bg_attach_legacy_autorespawn`, `tengu_bg_attach`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_stall_respawn`, `tengu_bg_attach_kick`, `tengu_daemon_yield`, `tengu_daemon_control` — emitted by background daemon subsystem reached via depth-2 traversal |
| Hook registration | None specific to this command |
| appState changes | None directly; config may be updated via the `hn` save-global-config path |
| Browser side effect | Opens default browser to the Slack app installation URL (external) |
| Filesystem side effect | Config file may be written atomically using rename-swap under `~/.claude.json` or equivalent; backup copies written to `backups/` subdirectory (bundle.js:+13751803) |
| Non-interactive support | `false` — command is unavailable in non-interactive / headless mode |
| Sound | None detected |

---

## Version History

| Version | Change |
|---|---|
| v2.1.187 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `/install-slack-app` sets `supportsNonInteractive: false`. Invoking it in a headless pipeline or CI environment will fail or be silently unavailable.
2. **Expecting a return value**: The command's only output is the status message `"Opening Slack app installation page in browser…"`. It does not return an installation token or confirmation — the actual installation happens in the browser.
3. **Firewall / sandboxed environments**: The command spawns an OS-level browser-open process (`open` on macOS, equivalent on Linux/Windows). If the subprocess is blocked, no error surfacing occurs back to the CLI — the telemetry event will still fire.
4. **Confusing this with an API or MCP tool**: `/install-slack-app` is a `local` command registered directly in the CLI; it is not an MCP tool and does not communicate with any Claude API endpoint.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `grf` | Main async handler for `/install-slack-app` (Arbor-resolved entry point) |
| `W` | Logging / warning utility called at telemetry emission site |
| `hn` | Save-global-config orchestrator (calls `GQn`) |
| `GQn` | Save-config-with-lock implementation |
| `Wt` | Path / config utility helper |
| `_Ws` | Object-assign-based config merge helper |
| `jRr` | Sub-helper called by `_Ws` |
| `T` | HTTP/fetch request dispatcher |
| `Xwc` | Request builder / formatter |
| `Me` | JSON serializer wrapper |
| `wc` | String/path manipulation utility |
| `dze` | Secondary string utility |
| `eLc` | File upload / multipart helper |
| `cn` | Error classification / normalization helper |
| `_Ee` | Config file reader with backup support |
| `Gt` | JSON.parse wrapper |
| `u9` | String prefix-strip utility |
| `HGl` | Backup directory scanner |
| `NOo` | Path-join helper for backup paths |
| `MHt` | Config metadata accessor |
| `n` | String lowercase utility (locale-aware) |
| `I` | Scroll/viewport position calculator |
| `x` | Daemon write/stream helper |
| `A` | Bounded numeric clamp helper |
| `H` | IPC message framing / protocol handler |
| `g` | Async timer / retry helper |
| `m` | Background session kill manager |
| `mp` | Stream end / flush helper |
| `bJf` | Background daemon message dispatcher (large) |
| `be` | String coercion utility |
| `oIt` | Atomic file write implementation |
| `Nd` | Realpath / symlink resolution helper |
| `u` | Daemon lifecycle manager (stop/start) |
| `kn` | Error code classifier |
| `E7e` | Extended error code handler |
| `ADe` | Config access guard |
| `DOo` | Object.entries-based config iterator |
| `MKt` | Timestamp helper (Date.now wrapper) |
| `BQn` | Config fallback write path |
| `Pe` | Promise/async utility |
| `rKe` | Low-level async primitive |
| `Zl` | URL validation and browser-open dispatcher |
| `btd` | URL scheme validator (raises Error on non-http/https) |
| `Tli` | Platform browser launcher |
| `A_` | Platform detection helper |
| `Un` | Process spawn coordinator |
| `Wr` | Child process wrapper with timeout/retry |
| `Pt` | Low-level spawn primitive |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.