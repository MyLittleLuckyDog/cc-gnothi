---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.196"
updated: "2026-06-30"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.196 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.196 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.196

---

## Overview

The `/install-slack-app` command is a local, non-interactive slash command that opens the Claude Slack app installation page directly in the user's system browser. It fires a telemetry event upon invocation, emits a status message, and then delegates to a platform-aware browser-opener utility to launch the installation URL. No arguments are accepted or required.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `i5l` |
| load_inline | `true` |
| loc_byte | `12058150` |
| loc_byte_end | `12058336` |
| loc_line | `8271` |
| arbor_handler.name | `M3f` |
| arbor_handler.fqn | `claude-2.1.196::M3f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.196 bundle.js:+12058150

---

## Input Branching

This command follows a linear flow with no branching on user input (no arguments are consumed). The only conditional logic lives inside subordinate utilities (browser opener and config persistence) — not in the top-level handler.

1. Command is invoked by the user (no arguments parsed).
2. Telemetry event `tengu_install_slack_app_clicked` is emitted.
3. A status text message `"Opening Slack app installation page in browser…"` is yielded to the UI.
4. The browser-opener utility (`openUrl`) is called with the Slack app installation URL.
5. The browser-opener resolves or rejects; any error propagates to the caller.

---

## Behavioral Spec

### Top-Level Handler (`installSlackAppHandler`)

Analysis basis: CC v2.1.196 bundle.js:+12057754

```
async function installSlackAppHandler(context):
    emit telemetry("tengu_install_slack_app_clicked")          // +12057756
    yield { type: "text",                                      // +12057889
            content: "Opening Slack app installation page in browser…" }  // +12057902
    await openUrl(slackAppInstallationUrl)                     // +12057869
    return
```

### Browser URL Opener (`openUrl`)

Analysis basis: CC v2.1.196 bundle.js:+3155774

The browser opener (`openUrl`, resolved as `xc` → `LKr` → `ZLi`) performs platform detection and spawns the appropriate system command to open the provided URL.

```
async function openUrl(url):
    validate url scheme is "http:" or "https:"               // +3154473, +3154495
    if scheme invalid:
        raise error with code "invalid_url"                  // +3155665

    detect platform:
        if platform == "linux":                              // +3155561
            check for DISPLAY environment variable
            if DISPLAY missing:
                raise error with code "no_display"          // +3155918
            spawn "open" or equivalent                      // +3155955
        elif platform == "darwin":                          // +3155876
            spawn "open" command
        else:
            spawn platform default opener

    on spawn error:
        if exit code == 127:                                // +3156161
            raise error with code "opener_missing"          // +3156207
        elif error includes "ETIMEDOUT" or "timed out":    // +3156248, +3156273
            raise error with code "timeout"                 // +3156306
        elif nonzero exit:
            raise error with code "nonzero_exit"            // +3156447
        else:
            raise error with code "spawn_error"             // +3156391
```

### Config Persistence Subsystem (`saveConfigWithLock`)

Analysis basis: CC v2.1.196 bundle.js:+14153628

This subsystem is reached transitively through the global config helper (`Hn`) invoked by the handler. It is not directly related to the Slack URL opening but is part of the shared infrastructure exercised on each command dispatch.

```
async function saveConfigWithLock(configData):
    acquire filesystem lock on config file
    if lock acquisition takes longer than expected:
        emit telemetry("tengu_config_lock_contention")      // +14157063
        log warning: "Lock acquisition took longer than expected…"  // +14156974

    re-read config from disk
    if re-read results in parse error:
        emit telemetry("tengu_config_parse_error")          // +14160796
        emit telemetry("tengu_config_auto_repaired")        // +14157576
        log "saveConfigWithLock: re-read hit a parse error; auto-repairing…"  // +14157448
        proceed with cached config

    if re-read config is missing auth present in cache:
        emit telemetry("tengu_config_auth_loss_prevented")  // +14157906
        log "saveConfigWithLock: re-read config is missing auth…"   // +14157754
        abort write to protect ~/.claude.json

    if stale write detected:
        emit telemetry("tengu_config_stale_write")          // +14157199

    write config atomically using writeFileSyncAndFlush
    release lock
```

### Atomic File Write Utility (`writeFileSyncAndFlush`)

Analysis basis: CC v2.1.196 bundle.js:+1106605

```
function writeFileSyncAndFlush(targetPath, content, options):
    resolve real path, following symlinks
    generate temporary file path using random bytes (6 bytes → +1107340)
    open temp file descriptor
    write content to temp file
    apply original file permissions to temp file           // "Applied original permissions to temp file" +1107871
    fsync temp file descriptor
    close temp file descriptor
    rename temp file to target path atomically
    if rename fails due to EACCES:                         // +1108517
        log fallback warning                               // +1109299
        write in-place as fallback
    on error codes EINVAL, ENOTSUP, EPERM, ENOSYS:        // +1103621..+1103663
        handle gracefully (recorded in rtt)
    emit Object.defineProperty metadata via JTs            // +1106460
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — install | `tengu_install_slack_app_clicked` emitted immediately on invocation (bundle.js:+12057756) |
| Telemetry — config lock | `tengu_config_lock_contention` emitted when lock wait exceeds threshold (bundle.js:+14157063) |
| Telemetry — stale write | `tengu_config_stale_write` emitted when a stale config write is detected (bundle.js:+14157199) |
| Telemetry — parse error | `tengu_config_parse_error` emitted when config re-read fails to parse (bundle.js:+14160796) |
| Telemetry — auto repair | `tengu_config_auto_repaired` emitted after auto-repair from cached config (bundle.js:+14157576) |
| Telemetry — auth loss | `tengu_config_auth_loss_prevented` emitted when write is aborted to avoid wiping auth (bundle.js:+14157906) |
| Telemetry — daemon | `tengu_daemon_control` emitted by daemon stop helper (bundle.js:+18033163) |
| Telemetry — fallback write | `tengu_config_fallback_write` emitted on global config fallback path (bundle.js:+14156679) |
| UI output | Yields one `text`-typed message: `"Opening Slack app installation page in browser…"` (bundle.js:+12057902) |
| Browser launch | Spawns system browser via platform opener; side-effect is OS-level process creation |
| Config file | No config mutation is performed by this command directly; config subsystem is shared infrastructure |
| supportsNonInteractive | `false` — command must be run in an interactive session |
| Sound | None observed in traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.196 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `supportsNonInteractive` is `false`; invoking `/install-slack-app` from a scripted or piped non-interactive session will be rejected or produce no output.
2. **Missing display server on Linux**: If the `DISPLAY` environment variable is not set (headless server), the browser opener will fail with `no_display`. Use a desktop session or configure a remote browser forwarding mechanism.
3. **Missing system opener on Linux**: If no `open`-compatible utility (e.g. `xdg-open`) is installed, the opener exits with code 127 (`opener_missing`). Install `xdg-utils` or equivalent.
4. **Expecting config changes**: This command only opens a browser URL. It does not modify any local configuration, write credentials, or alter Claude Code settings automatically.
5. **Passing arguments**: The command accepts no arguments. Any text after `/install-slack-app` is ignored or may cause unexpected behavior depending on the CLI's argument parser.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `M3f` | Top-level async handler for `/install-slack-app` (arbor_handler) |
| `V` | Telemetry event emitter utility |
| `Hn` | Global config accessor / saver orchestrator |
| `ntn` | Config-with-lock save implementation (saveConfigWithLock) |
| `t` | Filesystem abstraction (sync operations) |
| `qt` | Path resolution / normalization helper |
| `s` | Secondary filesystem / stream abstraction |
| `r` | Tertiary filesystem abstraction (readFileSync, mkdirSync, etc.) |
| `i` | Stream / resource close coordinator |
| `Yli` | Config object merge / assign helper |
| `E4r` | Config schema validator |
| `T` | Log / output formatting utility |
| `eeu` | Log message builder sub-helper |
| `e` | String utility (replace, toLowerCase, etc.) |
| `Me` | JSON serialization wrapper |
| `Pc` | Stack/path formatting helper |
| `KQe` | Config key lookup helper |
| `oeu` | File upload / byte-length helper |
| `rn` | Error construction / wrapping utility |
| `lIt` | Config file read-and-parse implementation |
| `Gt` | JSON parse wrapper |
| `V5` | String prefix stripper |
| `lqo` | Config backup directory scanner |
| `uqo` | Path join + normalize helper |
| `m` | Array/filter utility |
| `cIt` | Config integrity checker |
| `n` | String lowercasing wrapper |
| `v` | Version string utility |
| `y` | Split/parse utility |
| `lqe` | TeammateMailbox markMessagesAsRead implementation |
| `I` | Scroll / math utility (Math.max, Math.floor) |
| `M` | HTTP server / OAuth route handler |
| `A` | OAuth userinfo fetcher |
| `mkt` | Atomic file write (writeFileSyncAndFlush) |
| `Bd` | Real-path resolver |
| `u` | Daemon stop signal helper |
| `Sn` | Error guard / wrapper |
| `rtt` | Unsupported chmod error handler |
| `tkr` | File write finalize helper |
| `JTs` | Object.defineProperty metadata setter |
| `zUe` | Config cache accessor |
| `iqo` | Object entries iterator helper |
| `etn` | Timestamp / date utility |
| `Zen` | Config read-or-create helper |
| `Tdr` | Global config fallback write path |
| `Oe` | Output emitter wrapper |
| `$Xe` | Base output/stream primitive |
| `xc` | URL open orchestrator (openUrl entry point) |
| `LKr` | URL validation + platform dispatch (openUrl implementation) |
| `SOd` | URL scheme validator |
| `ZLi` | Platform-specific browser spawn handler |
| `fH` | Child process spawn utility |
| `QLi` | Linux platform opener selector |
| `bOd` | Exit-code / error-string classifier for opener errors |
| `Pn` | Process spawn wrapper (Gr + Ot) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.