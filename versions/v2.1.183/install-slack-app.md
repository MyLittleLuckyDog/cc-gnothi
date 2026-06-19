---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.183"
updated: "2026-06-19"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.183 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.183 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.183

---

## Overview

The `/install-slack-app` command opens the Claude Slack app installation page in the user's default browser. It fires a telemetry event immediately upon invocation, then delegates to a URL-opening utility that resolves the appropriate platform-specific open command, returning a short status message to the user.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| loc_byte | `11914759` |
| loc_byte_end | `11914945` |
| loc_line | `7778` |
| supportsNonInteractive | `false` |
| module_id | `Ipl` |
| load_inline | `true` |
| arbor_handler.name | `T7p` |
| arbor_handler.fqn | `claude-2.1.183::T7p` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.183 bundle.js:+11914759

---

## Input Branching

The command accepts no user-supplied arguments and follows a simple linear flow (two outcomes: success or error from the browser-open call). Pseudocode is sufficient.

1. User invokes `/install-slack-app` (no arguments consumed).
2. Handler `mainHandler` fires immediately.
3. Telemetry event `tengu_install_slack_app_clicked` is emitted.
4. `openUrl` is called with the Slack app installation URL.
5. A static status message `"Opening Slack app installation page in browser…"` is returned as a `text` result.

Analysis basis: CC v2.1.183 bundle.js:+11914365, +11914498, +11914511

---

## Behavioral Spec

### Main Handler

```
async function mainHandler(context):
    emit telemetry("tengu_install_slack_app_clicked")   // loc +11914365
    openUrl(SLACK_INSTALL_URL)                          // calls openUrlHelper → Rc
    return { type: "text",                              // loc +11914498
             content: "Opening Slack app installation page in browser…" }
                                                        // loc +11914511
```

Analysis basis: CC v2.1.183 bundle.js:+11914363, +11914403, +11914478

### URL-Open Helper (`openUrlHelper` / `Rc`)

The URL-open helper (resolved via Arbor as `T7p → Rc`) validates the supplied URL scheme and then launches the platform system browser.

```
function openUrlHelper(url):
    if url.protocol not in ["http:", "https:"]:   // loc +3110423, +3110445
        throw Error("invalid protocol")            // loc +3110373
    if platform == "darwin":                       // loc +3111111
        spawn("open", [url])                       // loc +3111130
    else:
        spawn(platform_default_browser_cmd, [url])
```

Analysis basis: CC v2.1.183 bundle.js:+3110981, +3110994, +3111052, +3111111, +3111130

### Config Save with Lock (`saveConfigWithLock` / `pn`)

The handler also calls a config-persistence helper (`pn`) that writes global configuration under a filesystem lock. Key behaviors:

```
async function saveConfigWithLock(configData):
    acquireLock()                              // via lockHelper (W7n)
    if lock acquisition is slow:
        emit telemetry("tengu_config_lock_contention")   // loc +13966745
        warn("Lock acquisition took longer than expected…")  // loc +13966656

    if re-read config is missing auth that cached config has:
        // Safety guard — avoids wiping ~/.claude.json
        // "saveConfigWithLock: re-read config is missing auth…"  loc +13967072
        emit telemetry("tengu_config_auth_loss_prevented")       // loc +13967224
        return  // refuse write

    if fallback write path used:
        emit telemetry("tengu_config_fallback_write")   // loc +13966361

    if stale write detected:
        emit telemetry("tengu_config_stale_write")      // loc +13966881

    writeFileSyncAndFlush(configPath, configData)
    rotateLockFile()

    if parse error on config read:
        emit telemetry("tengu_config_parse_error")      // loc +13969320
```

Key constants surfaced in this path:
- Lock timeout warning threshold: active during slow lock acquisition (bundle.js:+13966656)
- Config read encoding: `"utf-8"` (bundle.js:+13968772)
- Backup directory segment: `"backups"` (bundle.js:+13968257)
- File mode for new config: `384` (octal `0o600`) (bundle.js:+13967957)
- Backup rotation limit: `5` most-recent backups retained (bundle.js:+13967675)
- Stale-write prevention message references GH #3117 (bundle.js:+13967072, +13963525)

Analysis basis: CC v2.1.183 bundle.js:+13963374, +13963393, +13963418, +13963434

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry (primary) | `tengu_install_slack_app_clicked` — fired immediately on invocation (bundle.js:+11914365) |
| Telemetry (config path) | `tengu_config_lock_contention`, `tengu_config_stale_write`, `tengu_config_parse_error`, `tengu_config_auth_loss_prevented`, `tengu_config_fallback_write` |
| Telemetry (background daemon path, depth-2) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop`, `tengu_bg_attach_legacy_autorespawn`, `tengu_bg_attach`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_stall_respawn`, `tengu_bg_attach_kick`, `tengu_daemon_control` |
| Browser side effect | Opens the Slack app installation page in the system default browser via a platform-specific spawn (e.g., `open` on macOS) |
| Filesystem side effect | Config save path (`pn`) may write/rotate `~/.claude.json` under a file lock; creates `backups/` subdirectory if needed |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | None detected |
| Non-interactive support | `false` — command will not run in non-interactive (headless) mode |

---

## Version History

| Version | Change |
|---|---|
| v2.1.183 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `/install-slack-app` sets `supportsNonInteractive: false`. Invoking it from a headless or piped-input session will be rejected before the handler fires.
2. **Expecting a return value from the URL open**: The command returns a static text message immediately; it does not wait for the browser to finish loading or for the user to complete Slack OAuth flow.
3. **Assuming cross-platform uniformity**: The URL-open helper dispatches `open` on macOS and a different system command on Linux/Windows. Environments that lack a registered browser (e.g., minimal server containers) will fail at the spawn step, not at the Claude Code layer.
4. **Passing arguments**: The command ignores all arguments. Any text after `/install-slack-app` is silently discarded.
5. **Confusing the config-lock telemetry with command failure**: `tengu_config_lock_contention` events emitted during this command's lifecycle originate from the config-save helper shared across many commands, not from the Slack install logic itself.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `T7p` | Main async handler for `/install-slack-app` (Arbor-resolved entry point) |
| `j` | Logging / output utility called at handler entry and within config-lock helper |
| `pn` | Config persistence helper (`saveGlobalConfig` with lock) |
| `W7n` | File-lock acquisition and config write helper (`saveConfigWithLock` inner) |
| `t` | Filesystem abstraction (base layer used by lock helper) |
| `jt` | Filesystem existence / stat check utility |
| `s` | Locked-file write set manager (add/finally/delete on active write set) |
| `r` | Filesystem module reference (readFileSync, statSync, mkdirSync, etc.) |
| `i` | Lock-file handle or async write operation (close callbacks) |
| `C3s` | Config object constructor / merger (`Object.assign` wrapper) |
| `_wr` | Inner config initializer called by `C3s` |
| `T` | HTTP/fetch utility used by URL-open and config paths |
| `QHc` | Fetch helper dispatcher |
| `Pe` | JSON serialization helper (`JSON.stringify` wrapper) |
| `Kc` | String sanitization / redaction utility (produces `"[REDACTED]"`) |
| `Hqe` | Secondary string helper |
| `n_c` | File-write orchestrator (byte-length check, atomic write with temp file) |
| `dn` | Error logging / debug emit utility |
| `q_e` | Config file reader with backup rotation logic |
| `Gt` | JSON parse wrapper |
| `V9` | String prefix-strip utility |
| `RFl` | Backup directory scan and rotation helper |
| `Sko` | Path join + stat utility |
| `f` | Background daemon process manager / spawner |
| `AAt` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `n` | String case-normalizer (`toLowerCase`) |
| `I` | Scroll / layout math helper (scroll position calculation) |
| `k` | Terminal supervisor write helper |
| `E` | Bounded index clamp helper (`Math.max`/`Math.min`) |
| `g` | IPC buffer / chunked read helper |
| `h` | Socket timeout helper |
| `m` | Process kill-group manager |
| `Qp` | Stream end helper |
| `T6f` | Background daemon IPC message router (handles ping, attach, dispatch, reply, etc.) |
| `Ee` | String coercion helper (`String(…)`) |
| `MSt` | Atomic file write with fsync and permission preservation (`writeFileSyncAndFlush`) |
| `jp` | Realpath resolution helper |
| `u` | Daemon stop / control helper |
| `Mn` | Error wrapper / normalizer |
| `vKe` | Extended attribute / unsupported-op error handler |
| `LMe` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `_ko` | Object-entries iteration helper |
| `oWt` | Timestamp helper (`Date.now` wrapper) |
| `j7n` | Config file atomic-write orchestrator (uses `MSt`) |
| `Ue` | UI notification / output helper |
| `ogt` | Base output primitive called by `Ue` |
| `Rc` | URL-open helper (validates scheme, spawns system browser) |
| `dVu` | URL validation guard (throws on non-http/https schemes) |
| `Dni` | Platform-specific browser-spawn dispatcher |
| `b_` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `Un` | Daemon connection / socket utility |
| `qr` | Low-level socket request helper |
| `Mt` | Daemon RPC method dispatcher |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.