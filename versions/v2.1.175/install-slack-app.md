---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.175"
updated: "2026-06-12"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.175 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.175 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.175

---

## Overview

`/install-slack-app` is a local slash command that opens the Claude Slack app installation page in the user's default browser. It fires a telemetry event upon invocation, then delegates to an OS-aware URL-opening utility to launch the installation URL. The command is non-interactive and has no argument processing.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `w_K` |
| load_inline | `true` |
| loc_byte | `11929266` |
| loc_byte_end | `11929452` |
| loc_line | `8230` |
| arbor_handler.name | `Bu7` |
| arbor_handler.fqn | `claude-2.1.175::Bu7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.175 bundle.js:+11929266

---

## Input Branching

The command has a simple linear flow (no user-supplied argument branching); numbered pseudocode is appropriate.

1. Command is invoked → handler `Bu7` is called.
2. Telemetry event `tengu_install_slack_app_clicked` is emitted.
3. A user-facing text message `"Opening Slack app installation page in browser…"` is returned/displayed.
4. The URL-opening utility (`lK`) is called with the Slack installation URL.
5. `lK` validates the URL scheme (`http:` / `https:`) via `urlValidator` (`UXL`).
6. `lK` branches on `process.platform`:
   - `darwin` → invokes `open <url>`
   - `win32` → invokes `rundll32 url,OpenURL <url>`
   - other (Linux/etc.) → invokes `xdg-open <url>`
7. Control returns; no further side effects.

---

## Behavioral Spec

### Top-level handler (`Bu7`)

```
async function installSlackAppHandler(context):
    emit telemetry("tengu_install_slack_app_clicked")   // bundle.js:+11928872
    saveGlobalConfig(context)                            // via configWriter (X8)
    openUrlInBrowser(slackInstallUrl)                    // via urlOpener (lK)
    return { type: "text",
             content: "Opening Slack app installation page in browser…" }
                                                         // bundle.js:+11929005, +11929018
```

Analysis basis: CC v2.1.175 bundle.js:+11928870 – +11929018

---

### URL opener (`lK`)

```
async function openUrlInBrowser(url):
    urlValidator(url)          // raises Error if scheme not http: or https:
    platformBranch = process.platform
    if platformBranch == "darwin":
        spawn("open", [url])
    else if platformBranch == "win32":
        spawn("rundll32", ["url,OpenURL", url])
    else:
        spawn("xdg-open", [url])
```

Analysis basis: CC v2.1.175 bundle.js:+6279314 (`lK`), +6279077 (`"http:"`), +6279099 (`"https:"`), +6279386 (`"darwin"`), +6279402 (`"win32"`), +6279486 (`"rundll32"`), +6279498 (`"url,OpenURL"`), +6279560 (`"open"`), +6279567 (`"xdg-open"`)

---

### URL scheme validator (`UXL`)

```
function urlValidator(url):
    if not (url.startsWith("http:") or url.startsWith("https:")):
        throw new Error(...)
```

Analysis basis: CC v2.1.175 bundle.js:+6279027 (`Error`), +6279077, +6279099

---

### Config writer (`X8`) — called as a side-effect

`X8` is the global-config write path reached by the handler before opening the browser. It acquires a filesystem lock (`t58`), reads and validates the config file, guards against auth-loss (`"saveGlobalConfig fallback: re-read config is missing auth…"`, bundle.js:+3325182), then atomically writes using a temp-file + rename pattern (`Ww6`).

Key constants observed in `t58` / `X8`:

- Lock-contention warning threshold: 60 000 ms (bundle.js:+3328899)
- Lock-contention log level: `"error"` (bundle.js:+3328086)
- Lock-contention message: `"Lock acquisition took longer than expected…"` (bundle.js:+3328129)
- Config encoding: `"utf-8"` (bundle.js:+3330245)
- Backup subdirectory name: `"backups"` (bundle.js:+3329730)
- Backup file filter token: `".backup."` (bundle.js:+3329015)
- Maximum retained backups: `5` (bundle.js:+3329148)
- Temp-file permission bits: `384` (octal `0600`) (bundle.js:+3329430)

Analysis basis: CC v2.1.175 bundle.js:+3324975 (`X8`), +3327918 (`t58`)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_install_slack_app_clicked` (bundle.js:+11928872) — emitted on every invocation |
| Telemetry — config lock | `tengu_config_lock_contention` (bundle.js:+3328218) — emitted when config lock is slow to acquire |
| Telemetry — stale write | `tengu_config_stale_write` (bundle.js:+3328354) — emitted when a stale config write is detected |
| Telemetry — auth loss | `tengu_config_auth_loss_prevented` (bundle.js:+3328697) — emitted when a write is aborted to protect auth |
| Telemetry — parse error | `tengu_config_parse_error` (bundle.js:+3330793) — emitted on config JSON parse failure |
| Telemetry — bg daemon (indirect) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop`, `tengu_bg_attach_legacy_autorespawn`, `tengu_bg_attach`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_stall_respawn`, `tengu_bg_attach_kick` — emitted by shared daemon/socket infrastructure reached transitively; not install-slack-app-specific |
| Filesystem | Config file atomically rewritten via temp file + rename; up to 5 timestamped backups retained in `backups/` subdirectory |
| Browser launch | OS default browser opened via `open` / `rundll32 url,OpenURL` / `xdg-open` |
| appState changes | None specific to this command |
| Sound | None |
| Hook registration | None |
| Non-interactive support | `false` — command must run inside an interactive session |

---

## Version History

| Version | Change |
|---|---|
| v2.1.175 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode** — `supportsNonInteractive: false` means invoking `/install-slack-app` from a `--no-interactive` or piped session will fail or be silently skipped.
2. **Expecting a return value** — the command's sole effect is opening a browser tab; it does not install the app itself or confirm success beyond the "Opening…" status message.
3. **Firewall / sandbox blocking `open`/`xdg-open`** — in locked-down environments the child-process spawn may silently succeed at the OS level but the browser never opens; check system logs rather than Claude Code output.
4. **Assuming config is untouched** — the handler calls the global-config writer as a side effect; on heavily contended systems this may emit a lock-contention telemetry event and slow the response.
5. **Platform detection** — the URL opener checks `process.platform` strings exactly (`"darwin"`, `"win32"`); any other string (e.g., `"linux"`) falls through to `xdg-open`, which must be installed separately on some minimal Linux distributions.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Bu7` | Main async handler for `/install-slack-app` (AsyncFunction, Arbor-resolved) |
| `d` | Telemetry / logging utility (called at handler entry, bundle.js:+11928870) |
| `X8` | Global config writer (save-with-lock orchestrator) |
| `t58` | Config-lock acquisition and file-write core |
| `_` | Filesystem abstraction layer (readdirStringSync, statSync, etc.) |
| `o6` | Path / OS utility helper |
| `f` | File-write task queue wrapper |
| `q` | Queued filesystem operations object |
| `L` | Promise / finalizer chain for config write |
| `Hh1` | Config object merger / validator |
| `Gj_` | Config field extractor |
| `N` | HTTP/API request dispatcher |
| `J9f` | API response handler |
| `H` | Retry / jitter scheduler (uses Math.random + setTimeout) |
| `RH` | JSON serializer wrapper |
| `nf` | String normalisation / redaction utility |
| `mgH` | Log-level / metadata formatter |
| `G9f` | File upload / chunked-write helper |
| `E8` | Error-type classifier |
| `U7H` | Config-read + backup manager |
| `d6` | JSON.parse wrapper |
| `ru` | String prefix stripper |
| `t19` | Config directory reader / backup file enumerator |
| `rV_` | Backup path resolver |
| `D` | Background daemon session manager |
| `NoH` | Config lock object |
| `A` | String or platform utility (toLowerCase) |
| `V` | Version / file-filter string checker |
| `P` | Background socket protocol handler (daemon IPC) |
| `X` | Socket read-stream manager |
| `j` | Worker process killer |
| `b7` | Socket write-end helper |
| `YV5` | Daemon session message dispatcher |
| `TH` | String coercion utility |
| `E` | Slice/range utility (Math.max, Math.min) |
| `W` | SDK connection manager |
| `Ww6` | Atomic file writer (temp + rename + fchmod) |
| `O` | Stream / symbolic-link stat helper |
| `y8` | Error code classifier (errno) |
| `yJH` | Config change event emitter |
| `s19` | Object-entries iterator for config fields |
| `vW6` | Timestamp generator (Date.now wrapper) |
| `s58` | Config write path (secondary/fallback) |
| `lK` | URL opener — OS-platform-aware browser launcher |
| `UXL` | URL scheme validator (enforces http:/https:) |
| `PY` | Child-process spawn helper for browser open |
| `b8` | Credential / session bootstrap entry point |
| `c_` | Authentication initialiser |
| `ENH` | Auth provider factory (rcA, dK_, cK_, nK_, AcA, etc.) |
| `Y` | Process-exit / abort controller |
| `Ypf` | String coercion helper for auth tokens |
| `vM` | Token validation utility |
| `SH` | Structured log emitter (GA, K6, qq) |
| `b6` | Session context accessor |
| `Pa6` | AsyncLocalStorage store reader |
| `W_` | Inter-process signal router |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.