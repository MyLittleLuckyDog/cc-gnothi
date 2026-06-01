---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.145"
updated: "2026-06-01"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.145 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.145 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.145

---

## Overview

`/install-slack-app` is a local slash command that opens the Claude Slack app installation page in the user's default browser. When invoked, it fires a telemetry event, displays a status message to the user, and then delegates to the platform-aware URL-opening utility. It takes no user-supplied arguments and does not support non-interactive mode.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `MOq` |
| load_inline | `true` |
| loc_byte | `10768370` |
| loc_byte_end | `10768556` |
| loc_line | `6459` |
| arbor_handler.name | `k07` |
| arbor_handler.fqn | `claude-2.1.145::k07` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.145 bundle.js:+10768370

---

## Input Branching

The command has a simple, nearly linear flow — the only meaningful branch is the platform selection inside the URL-opener utility. A numbered pseudocode representation is sufficient.

1. Command is invoked (no user input required).
2. Telemetry event `tengu_install_slack_app_clicked` is fired.
3. A status text message `"Opening Slack app installation page in browser…"` is emitted to the UI.
4. The platform-aware URL opener (`openUrlInBrowser`) is called.
   - On `win32`: launches `rundll32` with argument `url,OpenURL <target-url>`.
   - On `darwin`: uses the `open` command.
   - On all other platforms (Linux/etc.): uses `xdg-open`.
5. Handler returns; no further side effects.

---

## Behavioral Spec

### Main Handler — `installSlackAppHandler` (`k07`)

Analysis basis: CC v2.1.145 bundle.js:+10767974

```
async function installSlackAppHandler(context):
    # Step 1: Record user intent
    emitTelemetry("tengu_install_slack_app_clicked")

    # Step 2: Notify the user via UI
    emitTextMessage("Opening Slack app installation page in browser…")

    # Step 3: Open the URL in the system browser
    await openUrlInBrowser(SLACK_APP_INSTALL_URL)

    return
```

Analysis basis: CC v2.1.145 bundle.js:+10768089 (call to `openUrlInBrowser`/`nq`), +10768122 (status string literal), +10767976 (telemetry event)

---

### URL-Open Utility — `openUrlInBrowser` (`nq`)

Analysis basis: CC v2.1.145 bundle.js:+10768089

```
async function openUrlInBrowser(url):
    # Validate URL scheme
    if not (url.startsWith("http:") or url.startsWith("https:")):
        raise Error("Invalid URL scheme")   # +6434319, +6434341

    platform = getPlatform()   # resolves to "darwin", "win32", or other

    if platform == "win32":
        spawn("rundll32", ["url,OpenURL", url])   # +6434728, +6434740
    else if platform == "darwin":
        spawn("open", [url])                       # +6434802
    else:
        spawn("xdg-open", [url])                  # +6434809
```

Analysis basis: CC v2.1.145 bundle.js:+6434556 (`q04` error guard), +6434628 (darwin literal), +6434644 (win32 literal)

---

### Config Lock & Persistence Layer — `saveConfigWithLock` (`Aq_`) / `loadAndSaveConfig` (`H8`)

These are general-purpose config utilities reached transitively from `k07` via `H8`. They are not unique to `/install-slack-app` but are exercised as part of any config-touching operation in the same module.

Analysis basis: CC v2.1.145 bundle.js:+3164297 (`H8`→`Aq_`), +3167206 (lock-contention warning string)

```
function saveConfigWithLock(configPath, updateFn):
    acquireFileLock(configPath)

    if lockAcquisitionExceededExpectedTime:
        logError("Lock acquisition took longer than expected"
                 " - another Claude instance may be running")
        emitTelemetry("tengu_config_lock_contention")

    currentConfig = readConfigFromDisk(configPath)   # utf-8, JSON.parse

    if currentConfig is missing auth that inMemoryCache has:
        # Safety guard — refuse to overwrite to avoid wiping credentials
        # Ref: GH #3117
        emitTelemetry("tengu_config_auth_loss_prevented")
        releaseLock()
        return

    newConfig = updateFn(currentConfig)
    writeConfigAtomically(configPath, newConfig)
    releaseLock()
```

Analysis basis: CC v2.1.145 bundle.js:+3167206, +3167295, +3167431, +3167622, +3167774

---

### Atomic Config Write — `atomicWriteFile` (`y96`)

Analysis basis: CC v2.1.145 bundle.js:+3168465

```
function atomicWriteFile(targetPath, data, mode=0o600):
    tempPath = targetPath + "." + randomHex(6) + ".tmp"
    writeFileSync(tempPath, data)
    fchmodSync(tempPath, mode)
    fsyncSync(tempPath)
    renameSync(tempPath, targetPath)   # atomic on POSIX
```

Analysis basis: CC v2.1.145 bundle.js:+1001875 (randomBytes, 6 bytes → hex), +1002311, +1002369, +1002435, +1002563

---

### Config Backup Rotation — `rotateConfigBackups` (`Wv9`)

Analysis basis: CC v2.1.145 bundle.js:+3169485

```
function rotateConfigBackups(configDir):
    backupDir = join(configDir, "backups")   # "backups" literal +3168807
    entries = readdirStringSync(configDir)

    # Collect files matching the ".backup." pattern
    backupFiles = [e for e in entries if e.startsWith(".backup.")]
    backupFiles.sort()

    # Keep only the newest N; delete oldest
    while backupFiles.length > MAX_BACKUPS:
        unlinkSync(join(backupDir, backupFiles.shift()))
```

Analysis basis: CC v2.1.145 bundle.js:+3168092 (".backup." literal), +3168807 ("backups" literal)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_install_slack_app_clicked` (fires unconditionally on invocation, +10767976) |
| Telemetry — config lock | `tengu_config_lock_contention` (+3167295) |
| Telemetry — stale write | `tengu_config_stale_write` (+3167431) |
| Telemetry — auth guard | `tengu_config_auth_loss_prevented` (+3167774) |
| Telemetry — config parse | `tengu_config_parse_error` (+3169876) |
| Telemetry — background session | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_spare_spawn` (transitive via background-session dispatcher; not directly triggered by this command) |
| UI output | Emits a `text`-type message: `"Opening Slack app installation page in browser…"` (+10768109, +10768122) |
| External process | Spawns one of: `rundll32`, `open`, or `xdg-open` to open the Slack install URL in the default browser (+6434728, +6434802, +6434809) |
| Non-interactive support | `false` — command will not execute in non-interactive/headless sessions |
| Config writes | None triggered directly by this command; `H8`/`Aq_` are reached only if surrounding session startup writes config |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.145 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `/install-slack-app` has `supportsNonInteractive: false`. Invoking it in a CI pipeline or headless script will silently fail or error; use an interactive terminal session.
2. **Expecting argument parsing**: The command takes no arguments. Any text supplied after `/install-slack-app` is ignored; the command always opens the same fixed Slack installation URL.
3. **Assuming synchronous execution**: The handler is an `AsyncFunction` (`k07`). Callers within the CLI internals must `await` the result; not doing so may cause the browser-open subprocess to be orphaned.
4. **Confusing config-lock warnings with command failure**: The "Lock acquisition took longer than expected" warning (`+3167206`) is emitted by the shared config layer and does not indicate that the Slack app installation page failed to open.
5. **Platform detection edge cases**: On Linux distributions where `xdg-open` is not installed (some minimal container images), the URL-open step will fail silently. Ensure `xdg-open` is available or run on macOS/Windows.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `k07` | Main command handler (`installSlackAppHandler`); AsyncFunction resolved via module_id `MOq` |
| `d` | Internal logging / debug utility |
| `H8` | Global config load-and-save orchestrator (`loadAndSaveGlobalConfig`) |
| `Aq_` | Config save-with-lock implementation (`saveConfigWithLock`) |
| `_` | Filesystem abstraction (various sync FS operations) |
| `U6` | Config path resolver |
| `L` | File lock manager (tracks open locks, cleanup on `finally`) |
| `q` | Node.js `fs` module binding (primary) |
| `f` | Secondary FS / stream handle used in lock cleanup |
| `B69` | Config object factory / merger |
| `Oa8` | Config schema validator |
| `I` | HTTP request dispatcher (used for API calls within the session) |
| `y$K` | HTTP client initializer |
| `H` | Retry/backoff scheduler (uses `Math.random` + `setTimeout`) |
| `RH` | JSON serializer wrapper |
| `B4` | URL/path string manipulator |
| `RSH` | Request signing helper |
| `R$K` | Streaming response writer |
| `A8` | Logging sink / error reporter |
| `R$H` | Config file reader with backup/rotation logic (`readConfigWithBackup`) |
| `u6` | JSON parse wrapper |
| `hR` | String prefix-strip utility |
| `Wv9` | Config backup rotation (`rotateConfigBackups`) |
| `NH` | Subprocess error logger |
| `qq_` | Backup directory path builder |
| `w` | Background session dispatcher / process manager |
| `n56` | Config schema migration helper |
| `A` | String case normalizer (`toLowerCase`) |
| `Z` | Directory entry filter |
| `X` | MCP connection handler |
| `kZ8` | MCP transport factory |
| `x_` | Error constructor wrapper |
| `V` | File version/slice accumulator |
| `y96` | Atomic file write utility (`atomicWriteFile`) |
| `O` | `fs.Stats` wrapper |
| `O8` | Error code extractor |
| `UpH` | Platform identifier helper |
| `Xv9` | Object-entries iterator utility |
| `BpH` | Timestamp generator |
| `_q_` | Config symlink resolver (`resolveConfigSymlinks`) |
| `nq` | Platform-aware URL opener (`openUrlInBrowser`) |
| `q04` | URL scheme validator |
| `aj` | Child-process spawn wrapper |
| `Y8` | Session initializer |
| `Y_` | Agent loop runner |
| `QXH` | API client constructor |
| `D` | Background session lifecycle manager |
| `YCK` | String coercion utility |
| `_N` | No-op / null guard |
| `b6` | AsyncLocalStorage store accessor |
| `AC6` | Context store reader |
| `q_` | Request-ID generator |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.