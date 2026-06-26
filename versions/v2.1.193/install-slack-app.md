---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.193"
updated: "2026-06-26"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.193 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.193 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.193

---

## Overview

`/install-slack-app` is a local slash command that opens the Claude Slack app installation page in the user's default browser. It fires a single telemetry event, displays a brief status message, and delegates to the platform-aware URL-opener utility. The command is non-interactive and requires no arguments.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `Pkl` |
| load_inline | `true` |
| loc_byte | `11893242` |
| loc_byte_end | `11893428` |
| loc_line | `8064` |
| arbor_handler.name | `rAf` |
| arbor_handler.fqn | `claude-2.1.193::rAf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.193 bundle.js:+11893242

---

## Input Branching

The command's top-level logic is a simple linear flow (no user input is branched on). A numbered pseudocode listing is therefore used here.

1. Command is invoked (no arguments consumed).
2. Fire telemetry event `tengu_install_slack_app_clicked`.
3. Call config-persistence layer (`saveGlobalConfig` / `mn`) to persist any pending state.
4. Call URL-opener utility (`gc` → `_Hi`) to launch the installation page.
5. Return a text response: `"Opening Slack app installation page in browser…"`.

---

## Behavioral Spec

### Main Handler — `rAf` (installSlackAppHandler)

```
async function installSlackAppHandler(context):
    # Step 1 — Telemetry
    emitTelemetry("tengu_install_slack_app_clicked")
    # Analysis basis: CC v2.1.193 bundle.js:+11892848

    # Step 2 — Persist global config (saveGlobalConfig)
    await saveGlobalConfig(context)
    # Analysis basis: CC v2.1.193 bundle.js:+11892886

    # Step 3 — Open URL in browser
    openUrl(installationPageUrl, context)
    # Analysis basis: CC v2.1.193 bundle.js:+11892961

    # Step 4 — Return status text to the user
    return { type: "text", content: "Opening Slack app installation page in browser…" }
    # Analysis basis: CC v2.1.193 bundle.js:+11892981, +11892994
```

---

### URL Validation and Platform-Aware Open — `gc` → `_Hi` (openUrlInBrowser)

```
function openUrlInBrowser(url):
    # Validate scheme: only "http:" or "https:" are allowed
    if not (url.startsWith("http:") or url.startsWith("https:")):
        raise Error("invalid URL scheme")
    # Analysis basis: CC v2.1.193 bundle.js:+3125333, +3125355

    # Detect platform
    if platform == "darwin":
        spawnProcess("open", [url])
        # Analysis basis: CC v2.1.193 bundle.js:+3126587, +3126606
    else:
        # Platform-specific fallback handled by _Hi / Xh
        dispatchPlatformOpen(url)

    # _Hi delegates to Xh for the actual spawn
    # Pn handles process lifecycle (retry/backoff up to 10 attempts,
    # 1 000 000 µs max wait)
    # Analysis basis: CC v2.1.193 bundle.js:+3126528, +1141985, +1142595
```

---

### Config Persistence — `mn` (saveGlobalConfig)

The `mn` function is the global-config save routine. It is called by the handler before opening the browser so that any in-memory state is flushed to disk first.

```
async function saveGlobalConfig(context):
    acquireFileLock()                        # dXt / cXt — file-lock with Date.now() stamping
    # Analysis basis: CC v2.1.193 bundle.js:+13970317, +13972116

    reRead = readConfigFromDisk()            # bSt — reads config file under lock
    # Analysis basis: CC v2.1.193 bundle.js:+13970398

    if reRead has parse error:
        emitTelemetry("tengu_config_parse_error")
        autoRepairFromCache()
        emitTelemetry("tengu_config_auto_repaired")
        # Analysis basis: CC v2.1.193 bundle.js:+13977384, +13974164
        # Log message fragment: "saveConfigWithLock: re-read hit a parse error…"
        # Analysis basis: CC v2.1.193 bundle.js:+13974036

    if reRead is missing auth that cache has:
        emitTelemetry("tengu_config_auth_loss_prevented")
        abort()   # refuse to write — guards against GH #3117
        # Analysis basis: CC v2.1.193 bundle.js:+13974494
        # Log message fragment: "saveConfigWithLock: re-read config is missing auth…"
        # Analysis basis: CC v2.1.193 bundle.js:+13974342

    writeConfigWithLock(mergedConfig)        # Qwt — atomic write via temp + rename
    emitTelemetry("tengu_config_fallback_write")  # on fallback path
    # Analysis basis: CC v2.1.193 bundle.js:+13973267

    releaseLock()
```

Key constants observed in the config-persistence subsystem:

- Lock contention warning threshold: `60000` ms (bundle.js:+13974700)
- Lock acquisition log literal: `"Lock acquisition took longer than expected…"` (bundle.js:+13973562)
- Backup directory name: `"backups"` (bundle.js:+13975538)
- Backup filename marker: `".backup."` (bundle.js:+13974816)
- Maximum backup files retained: `5` (bundle.js:+13974955)
- Config file permissions (octal): `0o600` (`384` decimal) (bundle.js:+13975237)
- Config re-read timeout: `60000` ms (bundle.js:+13974700)
- EEXIST guard on lock directory creation (bundle.js:+13974677)

---

### Atomic File Write — `Qwt` (writeFileSyncAndFlush)

```
function writeFileSyncAndFlush(targetPath, content):
    randomSuffix = crypto.randomBytes(6).toString("hex")
    # Analysis basis: CC v2.1.193 bundle.js:+1103160, +1103176, +1103188

    tempPath = targetPath + "." + randomSuffix

    if targetPath exists:
        originalMode = stat(targetPath).mode
    else:
        originalMode = DEFAULT_MODE  # 0o600 / 384

    writeFileSync(tempPath, content, encoding="utf-8")
    fchmodSync(fd, originalMode)
    # Analysis basis: CC v2.1.193 bundle.js:+1103670
    # Log fragment: "Applied original permissions to temp file"
    # Analysis basis: CC v2.1.193 bundle.js:+1103691

    fsyncSync(fd)
    # Analysis basis: CC v2.1.193 bundle.js:+1103817

    try:
        renameSync(tempPath, targetPath)   # atomic replace
        # Analysis basis: CC v2.1.193 bundle.js:+1104148
    except EACCES:
        # in-place fallback
        # Log fragment: "writeFileSyncAndFlush: in-place fallback write failed…"
        # Analysis basis: CC v2.1.193 bundle.js:+1105102
        raise

    if targetPath in y$e (write-guard set):
        skip post-write validation
        # Analysis basis: CC v2.1.193 bundle.js:+1104298
```

Symlink handling: if target is a symbolic link, `Qwt` resolves it via `readlinkSync` and, when the link target is relative, makes it absolute via `path.resolve`. ELOOP and ENOTDIR are treated as non-fatal (bundle.js:+1102819, +1102832).

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_install_slack_app_clicked` | Fired immediately upon command invocation (bundle.js:+11892848) |
| Telemetry — `tengu_config_lock_contention` | Fired when file-lock acquisition is slow (bundle.js:+13973651) |
| Telemetry — `tengu_config_stale_write` | Fired when a stale/conflicting config write is detected (bundle.js:+13973787) |
| Telemetry — `tengu_config_parse_error` | Fired when the re-read config cannot be parsed (bundle.js:+13977384) |
| Telemetry — `tengu_config_auto_repaired` | Fired after successful auto-repair from cache (bundle.js:+13974164) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a write is aborted to protect auth fields (bundle.js:+13974494) |
| Telemetry — `tengu_config_fallback_write` | Fired on the config fallback-write path (bundle.js:+13973267) |
| Telemetry — `tengu_daemon_yield` | Fired when the background daemon yields to a foreground process (bundle.js:+17503119) |
| Telemetry — `tengu_daemon_control` | Fired on daemon start/stop control events (bundle.js:+17520352) |
| Browser launch | Opens URL via platform command (`open` on macOS; platform-specific otherwise) (bundle.js:+3126587, +3126606) |
| Global config write | `saveGlobalConfig` (`mn`) flushes in-memory config to `~/.claude.json` under a file lock before the browser is opened (bundle.js:+11892886) |
| Config backup | Up to 5 rolling backups are kept in the `backups/` subdirectory (bundle.js:+13974955, +13975538) |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | None observed |

---

## Version History

| Version | Change |
|---|---|
| v2.1.193 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode** — `supportsNonInteractive` is `false`; invoking `/install-slack-app` from a script or piped stdin session will be rejected before the handler is reached.
2. **Expecting a return value beyond the status message** — the command returns only the literal text `"Opening Slack app installation page in browser…"` and performs no further agent interaction.
3. **Assuming the browser opens instantly** — `saveGlobalConfig` runs first and may block briefly if another Claude instance holds the config file lock (up to 60 000 ms before the contention telemetry fires).
4. **Running in an environment without a graphical browser** — on non-macOS platforms the URL-opener falls back to a platform dispatch helper; in headless CI environments this may silently fail because no browser is available.
5. **Conflating this with an API or programmatic integration** — the command only opens a web page; it does not perform OAuth, credential storage, or any Slack API calls itself.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `rAf` | Main command handler — `installSlackAppHandler` (AsyncFunction) |
| `V` | Telemetry emit helper |
| `mn` | Global config save — `saveGlobalConfig` |
| `dXt` | Config save-with-lock core — `saveConfigWithLock` |
| `t` | Filesystem abstraction (read/stat) |
| `jt` | Path join/resolution utility |
| `s` | Secondary filesystem abstraction (write/mkdir/copy) |
| `r` | Tertiary filesystem abstraction (read/delete) |
| `i` | Stream/handle lifecycle manager |
| `uXs` | Config object merge helper |
| `yNr` | Config schema validator |
| `T` | HTTP request dispatcher |
| `qFc` | HTTP response handler |
| `e` | Generic utility / random + timeout |
| `ke` | JSON serialise helper |
| `Lc` | String sanitiser / redactor |
| `iYe` | Output formatter |
| `XFc` | HTTP chunk writer |
| `an` | Logger / warn emitter |
| `bSt` | Config file reader with backup logic — `readConfigWithBackup` |
| `Bt` | JSON parse wrapper |
| `R4` | String prefix stripper |
| `u9o` | Backup directory scanner |
| `p9o` | Backup path builder |
| `m` | Process map / kill helper |
| `TSt` | Config type validator |
| `n` | Lowercase normaliser |
| `v` | Directory-entry filter |
| `y` | Teammate mailbox helper |
| `Bje` | Mark-messages-as-read routine |
| `I` | Scroll/slice position calculator |
| `R` | Write-stream wrapper |
| `A` | UI state accessor |
| `Qwt` | Atomic file write — `writeFileSyncAndFlush` |
| `Md` | Realpath resolver |
| `u` | Daemon stop controller |
| `In` | Warn-once helper |
| `mJe` | fsync error classifier |
| `Ops` | Write-guard set manager |
| `m1e` | Config equality checker |
| `l9o` | Config diff enumerator |
| `cXt` | Lock timestamp recorder |
| `lXt` | Config lock-read wrapper |
| `Qor` | Config write-under-lock orchestrator |
| `Oe` | Shell escape helper |
| `Zze` | Shell argument escaper |
| `gc` | URL open dispatcher — `openUrlInBrowser` |
| `kgd` | URL scheme validator |
| `_Hi` | Platform-aware URL opener |
| `Xh` | Child-process spawner |
| `Pn` | Process lifecycle manager |
| `Vr` | Process retry/backoff handler |
| `Pt` | Process output collector |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.