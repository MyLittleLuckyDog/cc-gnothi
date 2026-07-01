---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.197"
updated: "2026-07-01"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.197 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.197 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.197

---

## Overview

`/install-slack-app` is a local slash command that opens the Claude Slack app installation page in the user's default browser. It fires a telemetry event on invocation, then delegates to the platform URL-opener subsystem to launch a browser, displaying a brief status message to the user while doing so.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `H5l` |
| load_inline | `true` |
| loc_byte | `12062256` |
| loc_byte_end | `12062442` |
| loc_line | `8271` |
| arbor_handler.name | `j3f` |
| arbor_handler.fqn | `claude-2.1.197::j3f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.197 bundle.js:+12062256

---

## Input Branching

This command's primary path is linear (no user-supplied arguments affect branching). The branching complexity lives entirely inside the URL-opener subsystem (`xc` → `RKr` → `axi`) and the config-lock layer (`Hn` → `rtn`), not in the top-level command decision. Two branches exist at the top level: browser open succeeds or fails. Pseudocode is therefore sufficient.

1. **Command invoked** — handler `j3f` begins.
2. Emit telemetry event `tengu_install_slack_app_clicked` (Analysis basis: CC v2.1.197 bundle.js:+12061862).
3. Call config-persistence helper (writeGlobalConfig) to record the interaction.
4. Emit user-visible text message `"Opening Slack app installation page in browser…"` (Analysis basis: CC v2.1.197 bundle.js:+12062008).
5. Invoke URL-opener (`xc`) with the Slack installation URL.
6. **Branch A — open succeeds**: command returns normally.
7. **Branch B — open fails**: URL-opener throws a categorised error (see Behavioral Spec §URL Opener).

---

## Behavioral Spec

### Top-Level Handler (`j3f`)

```
async function installSlackAppHandler(context):
    emit_telemetry("tengu_install_slack_app_clicked")
    writeGlobalConfig(context)           // Hn — may acquire file lock
    yield_message({ type: "text",
                    text: "Opening Slack app installation page in browser…" })
    openUrl(slackInstallUrl)             // xc → RKr → axi
```

Analysis basis: CC v2.1.197 bundle.js:+12061860–12061975

---

### Config Persistence (`Hn` / `rtn`)

The `writeGlobalConfig` pathway acquires a file-system lock before writing `~/.claude.json`. Key guard-rails observed in the traversal:

```
async function writeGlobalConfig(options):
    acquireLock(configPath)
    // lock contention warning threshold is enforced; emits
    // tengu_config_lock_contention if acquisition is slow
    reRead = readFileSync(configPath, "utf-8")
    parsed = JSON.parse(reRead)

    if parseError(reRead):
        emit_telemetry("tengu_config_parse_error")
        log("saveConfigWithLock: re-read hit a parse error; auto-repairing …")
        emit_telemetry("tengu_config_auto_repaired")
        repairFromCache()

    if cachedAuthIsMissing(parsed):
        emit_telemetry("tengu_config_auth_loss_prevented")
        log("saveConfigWithLock: re-read config is missing auth …")
        abort()   // refuses to write to prevent auth wipe

    backupCount = 5    // maximum backup copies retained
    writeWithAtomicRename()
    releaseLock()
```

- Lock acquisition warning string: `"Lock acquisition took longer than expected - another Claude instance may be running"` (Analysis basis: CC v2.1.197 bundle.js:+14161091)
- Auth-loss guard string: `"saveConfigWithLock: re-read config is missing auth that cache has; refusing to write to avoid wiping ~/.claude.json. See GH #3117."` (Analysis basis: CC v2.1.197 bundle.js:+14161871)
- Parse-error auto-repair string: `"saveConfigWithLock: re-read hit a parse error; auto-repairing from cached config under lock. See GH #3117."` (Analysis basis: CC v2.1.197 bundle.js:+14161565)
- Backup directory name: `"backups"` (Analysis basis: CC v2.1.197 bundle.js:+14163067)
- Maximum backup files kept: `5` (Analysis basis: CC v2.1.197 bundle.js:+14162484)
- Lock file permissions octal: `384` (= `0o600`) (Analysis basis: CC v2.1.197 bundle.js:+14162766)
- Lock timeout: `60000` ms (Analysis basis: CC v2.1.197 bundle.js:+14162229)
- `EEXIST` is treated as "lock already held by another process" (Analysis basis: CC v2.1.197 bundle.js:+14162206)
- `ENOENT` on config read is handled gracefully (Analysis basis: CC v2.1.197 bundle.js:+14161446)

Atomic write uses `mRt` (writeFileSyncAndFlush): writes to a temporary path, `fchmod`s it to the original permissions, `fsync`s, then `renameSync`s into place. A fallback in-place write is attempted if rename fails with `EACCES` (Analysis basis: CC v2.1.197 bundle.js:+1108686).

---

### URL Opener (`xc` → `RKr` → `axi`)

```
async function openUrl(url):
    validate url scheme is "http:" or "https:"
    if invalid:
        throw categorisedError("invalid_url")

    platform = detectPlatform()   // "darwin" | "linux" | other

    if platform == "darwin":
        spawn("open", url)
    elif platform == "linux":
        check DISPLAY env variable present
        if missing:
            throw categorisedError("no_display")
        spawn("xdg-open", url)
    else:
        spawn(platformOpener, url)

    if spawn exit code == 127:
        throw categorisedError("opener_missing")
    if error.code == "ETIMEDOUT" or message includes "timed out":
        throw categorisedError("timeout")
    if spawn failed:
        throw categorisedError("spawn_error")
    if non-zero exit:
        throw categorisedError("nonzero_exit")
```

Error category strings observed in literals:
- `"invalid_url"` (Analysis basis: CC v2.1.197 bundle.js:+3157088)
- `"darwin"` / `"linux"` (Analysis basis: CC v2.1.197 bundle.js:+3157299, +3156984)
- `"no_display"` (Analysis basis: CC v2.1.197 bundle.js:+3157341)
- `"opener_missing"` (Analysis basis: CC v2.1.197 bundle.js:+3157630)
- `"ETIMEDOUT"` / `"timed out"` / `"timeout"` (Analysis basis: CC v2.1.197 bundle.js:+3157671, +3157696, +3157729)
- `"spawn_error"` (Analysis basis: CC v2.1.197 bundle.js:+3157814)
- `"nonzero_exit"` (Analysis basis: CC v2.1.197 bundle.js:+3157870)
- Exit code `127` signals missing opener binary (Analysis basis: CC v2.1.197 bundle.js:+3157584)

---

### Non-Interactive Guard

`supportsNonInteractive: false` means the command is unconditionally rejected when the CLI is invoked in non-interactive / headless mode. No special handling in `j3f` itself is needed; the CLI framework refuses dispatch before the handler is called.

Analysis basis: CC v2.1.197 bundle.js:+12062256

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_install_slack_app_clicked` (emitted at handler entry, bundle.js:+12061862) |
| Telemetry — config lock | `tengu_config_lock_contention` (emitted when lock acquisition is slow, bundle.js:+14161180) |
| Telemetry — stale write | `tengu_config_stale_write` (emitted on stale config write attempt, bundle.js:+14161316) |
| Telemetry — parse error | `tengu_config_parse_error` (emitted when config JSON fails to parse, bundle.js:+14164913) |
| Telemetry — auto repair | `tengu_config_auto_repaired` (emitted after successful cache-based repair, bundle.js:+14161693) |
| Telemetry — auth guard | `tengu_config_auth_loss_prevented` (emitted when write is aborted to protect auth, bundle.js:+14162023) |
| Telemetry — fallback write | `tengu_config_fallback_write` (emitted when atomic rename falls back to in-place write, bundle.js:+14160796) |
| Telemetry — daemon control | `tengu_daemon_control` (emitted by daemon helper reachable via config path, bundle.js:+18076516) |
| File system | Acquires/releases `~/.claude.json` lock file; writes up to 5 rotating backups in `backups/` subdirectory |
| Browser | Spawns platform default browser or `open`/`xdg-open` pointing at Slack installation URL |
| User message | Prints `"Opening Slack app installation page in browser…"` (type: `"text"`) to the terminal |
| appState changes | None observed at depth-2 traversal |
| Sound | None observed |
| Hook registration | None observed |

---

## Version History

| Version | Change |
|---|---|
| v2.1.197 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: Because `supportsNonInteractive` is `false`, invoking `/install-slack-app` from a script or pipe will be rejected before the handler runs. Use an interactive terminal session.
2. **Headless Linux environment**: On Linux without a `DISPLAY` variable set, the URL opener will fail with `no_display` before any browser is launched. Ensure a graphical session is available or set `DISPLAY` appropriately.
3. **Missing browser opener**: If neither `open` (macOS) nor `xdg-open` (Linux) is present, the command fails with `opener_missing` (exit code 127). Install `xdg-utils` on Linux distributions where it is absent.
4. **Stale config file**: If another Claude instance is holding the config lock for longer than 60 000 ms, the command will log a contention warning. Do not run multiple Claude Code instances simultaneously against the same config file.
5. **Corrupted `~/.claude.json`**: If the config JSON is invalid on disk, the command will attempt auto-repair from an in-memory cache. If the cache is also unavailable, the write will be aborted to prevent data loss.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `j3f` | Top-level async handler for `/install-slack-app` (Arbor-resolved entry point) |
| `V` | Telemetry emit helper |
| `Hn` | writeGlobalConfig — outer config persistence coordinator |
| `rtn` | saveConfigWithLock — file-locked config write implementation |
| `qt` | Config file path resolver |
| `nci` | Config object merge/construct helper |
| `b4r` | Config schema builder called by `nci` |
| `tci` | Inner config type constructor called by `b4r` |
| `T` | Log/output formatting utility (accepts log level "debug", "error", etc.) |
| `deu` | Log-level routing helper called by `T` |
| `Me` | JSON serialiser wrapper |
| `Pc` | Path/string sanitiser (replaces `[REDACTED]`) |
| `KQe` | Path normalisation helper |
| `geu` | File write core (computes byte length, handles HTTP-style chunked output) |
| `rn` | Error constructor / re-throw helper |
| `lIt` | Config file reader with backup/copy logic |
| `Gt` | JSON parse wrapper |
| `q5` | String prefix stripper (startsWith + slice) |
| `mqo` | Directory traversal helper for config backups |
| `hqo` | Path join + normalisation helper |
| `m` | Array/collection utility (filter, isArray) |
| `cIt` | Config integrity checker |
| `n` | String lowercase normaliser |
| `y` | Split/parse utility |
| `lqe` | TeammateMailbox message-read lock manager |
| `I` | Slice/pagination helper (Math.max, Math.floor) |
| `M` | OAuth/HTTP server handler (routes: /healthz, /readyz, /oauth/…) |
| `A` | Auth userinfo fetcher |
| `mRt` | writeFileSyncAndFlush — atomic rename-based file writer |
| `Gd` | Real-path resolver with symlink handling |
| `u` | Daemon control helper (daemon_stop, daemon_stop_failed) |
| `Sn` | Error wrapper/annotator |
| `rtt` | Permission/chmod error categoriser (EINVAL, ENOTSUP, EPERM, ENOSYS) |
| `oRr` | Platform detection + open-url spawn helper |
| `nIs` | Object.defineProperty-based property descriptor helper |
| `zUe` | Global config fallback path helper |
| `pqo` | Config entry iterator (Object.entries) |
| `ttn` | Timestamp helper (Date.now) |
| `etn` | Config read+write coordinator calling `lIt` |
| `vdr` | save_global variant config writer (emits `tengu_config_fallback_write`) |
| `Oe` | Startup/init hook caller |
| `$Xe` | Root init function called by `Oe` |
| `xc` | openUrl — top-level URL open dispatcher |
| `RKr` | URL validation and platform-open orchestrator |
| `MOd` | URL scheme validator (http/https check) |
| `axi` | Platform-specific spawn executor (open / xdg-open) |
| `mH` | macOS `open` command spawner |
| `ixi` | Linux `xdg-open` spawner |
| `POd` | Exit-code error classifier (127 → opener_missing) |
| `Pn` | Spawn wrapper with timeout handling |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.