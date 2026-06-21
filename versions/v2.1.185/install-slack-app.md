---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.185"
updated: "2026-06-21"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.185 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.185 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.185

---

## Overview

`/install-slack-app` is a local slash command that opens the Claude Slack app installation page in the user's default browser. It emits a telemetry event upon invocation, then delegates to the system URL-opener utility, displaying a brief status message to the user. The command is non-interactive and completes synchronously after dispatching the browser-open call.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `Ipl` |
| load_inline | `true` |
| loc_byte | `11914758` |
| loc_byte_end | `11914944` |
| loc_line | `7778` |
| arbor_handler.name | `T7p` |
| arbor_handler.fqn | `claude-2.1.185::T7p` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.185 bundle.js:+11914758

---

## Input Branching

The command has a simple linear flow (no significant branching on user input — the command takes no arguments). A numbered pseudocode representation is used.

1. Command is invoked by the user.
2. Telemetry event `tengu_install_slack_app_clicked` is emitted.
3. The config-persistence layer (`saveGlobalConfig` equivalent, `pn`) is called to persist any pending state.
4. The system URL-opener (`Rc` → `Dni`) is called with the Slack app installation URL.
5. A status message `"Opening Slack app installation page in browser…"` is returned to the UI as a `text`-type response.

---

## Behavioral Spec

### Main Handler (`T7p`)

```
async function installSlackAppHandler(context):
    emit telemetry("tengu_install_slack_app_clicked")        // bundle.js:+11914364
    await saveGlobalConfig(context)                           // bundle.js:+11914402
    await openUrlInBrowser(context)                          // bundle.js:+11914477
    return { type: "text",                                   // bundle.js:+11914497
             content: "Opening Slack app installation page in browser…" }
                                                             // bundle.js:+11914510
```

Analysis basis: CC v2.1.185 bundle.js:+11914362

---

### URL Opening (`openUrlInBrowser` / `Rc` → `Dni`)

The URL-opener validates the target URL scheme before invoking the OS shell command. Only `http:` and `https:` schemes are permitted (bundle.js:+3110416, +3110438). On macOS (`"darwin"`), it uses the `open` shell command (bundle.js:+3111104, +3111123). An `Error` is thrown for disallowed schemes (bundle.js:+3110366).

```
function openUrlInBrowser(url):
    if not url.startsWith("http:") and not url.startsWith("https:"):
        throw Error("Disallowed URL scheme")
    if platform == "darwin":
        spawn("open", [url])
    else:
        spawn(platformDefaultOpener, [url])
```

Analysis basis: CC v2.1.185 bundle.js:+3110974, +3110987

---

### Config Persistence (`saveGlobalConfig` / `pn`)

Before opening the browser, the handler flushes any pending global configuration changes. This involves:

1. Acquiring a file lock on the global config file (`W7n` → lock acquisition).
2. Re-reading the on-disk config and merging with in-memory state.
3. Guarding against auth-loss: if the re-read config is missing authentication data that the in-memory cache holds, the write is refused and a warning is logged (bundle.js:+13963526 — "saveGlobalConfig fallback: re-read config is missing auth…").
4. Writing the merged config atomically via a temp-file-and-rename strategy (`MSt`), which includes `fchmodSync`, `fsyncSync`, and `renameSync` steps.
5. Releasing the file lock.

Lock contention warning string: `"Lock acquisition took longer than expected - another Claude instance may be running"` (bundle.js:+13966657).

```
async function saveGlobalConfig(context):
    lock = acquireFileLock(configPath)                   // W7n
    onDiskConfig = readConfigFromDisk()                  // q_e
    if onDiskConfig is missing auth AND cache has auth:
        log warning("saveGlobalConfig fallback: re-read config is missing auth...")
        emit telemetry("tengu_config_auth_loss_prevented")
        releaseLock(lock)
        return
    merged = merge(onDiskConfig, inMemoryConfig)
    writeAtomically(configPath, merged)                  // MSt
    releaseLock(lock)
```

Analysis basis: CC v2.1.185 bundle.js:+11914402, +13963375, +13963516, +13967073, +13967225

---

### Atomic Config Write (`writeAtomically` / `MSt`)

Writes configuration to a temporary file, sets permissions, syncs to disk, then renames into place. Handles symlinks by resolving the real path before operating. Keeps up to **5** rotating backups (bundle.js:+13967676). Backup filenames contain the substring `".backup."` (bundle.js:+13967543). Temp file permissions are set to octal **600** (`384` decimal, bundle.js:+13967958).

```
function writeAtomically(targetPath, data):
    realPath = resolveSymlink(targetPath)               // MSt → jp
    tempPath = realPath + randomHexSuffix()             // lmr.randomBytes, hex
    writeFileSync(tempPath, data)
    fchmodSync(tempPath, 0o600)
    fsyncSync(tempPath)
    rotateBackups(targetPath, maxBackups=5)
    renameSync(tempPath, realPath)
```

Analysis basis: CC v2.1.185 bundle.js:+13967916, +1096954, +1097395, +1097457, +1097604, +1097813, +13967676

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry (primary) | `tengu_install_slack_app_clicked` — fired immediately on invocation (bundle.js:+11914364) |
| Telemetry (config lock) | `tengu_config_lock_contention` — emitted when lock acquisition is slow (bundle.js:+13966746) |
| Telemetry (stale write) | `tengu_config_stale_write` — emitted when a stale config write is detected (bundle.js:+13966882) |
| Telemetry (parse error) | `tengu_config_parse_error` — emitted on config JSON parse failure (bundle.js:+13969321) |
| Telemetry (auth loss) | `tengu_config_auth_loss_prevented` — emitted when a write is refused to protect auth (bundle.js:+13967225) |
| Telemetry (fallback write) | `tengu_config_fallback_write` — emitted when a fallback write path is used (bundle.js:+13966362) |
| Global config | May flush pending global config changes to `~/.claude.json` before opening browser |
| Config backups | Up to 5 backup copies of the config may be rotated during the write (bundle.js:+13967676) |
| Browser | Opens the Slack app installation URL in the OS default browser via `open` (macOS) or platform equivalent |
| supportsNonInteractive | `false` — command must be run in an interactive session |
| UI output | Returns a `text`-type message: `"Opening Slack app installation page in browser…"` (bundle.js:+11914510) |
| Sound | None detected |
| Hook registration | None detected |
| appState changes | None detected beyond config flush |

---

## Version History

| Version | Change |
|---|---|
| v2.1.185 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `supportsNonInteractive` is `false`; invoking this command via `--print` or piped/headless mode will fail or be rejected.
2. **Expecting immediate installation**: The command only opens the browser to the installation page — it does not perform installation itself and does not wait for completion.
3. **Firewall or scheme restrictions**: The URL opener validates that the target scheme is `http:` or `https:`; any redirect to a non-HTTP scheme will throw an error before the browser opens.
4. **Concurrent Claude instances**: If another Claude Code instance is holding the global config lock, this command may log a contention warning and experience a delay before proceeding.
5. **Auth data loss guard**: If the on-disk config is detected to be missing authentication data that the in-memory cache holds, the config write will be silently refused to protect credentials — this is a safety guard, not a bug.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `T7p` | Main async handler for `/install-slack-app` (arbor_handler) |
| `j` | Telemetry emission helper |
| `pn` | Save global config (top-level orchestrator) |
| `W7n` | Config file lock acquisition and write orchestration |
| `t` | Filesystem abstraction (various sync FS ops) |
| `jt` | Path existence / filesystem check utility |
| `s` | Secondary filesystem/stream abstraction |
| `r` | Tertiary filesystem abstraction |
| `i` | Stream/resource close helper |
| `C3s` | Config object merge/construction helper |
| `_wr` | Internal config writer sub-utility |
| `T` | HTTP request / fetch utility |
| `QHc` | HTTP fetch orchestrator |
| `e` | Generic utility / event emitter context |
| `Pe` | JSON serialisation helper |
| `Kc` | String/path manipulation utility |
| `Hqe` | String sanitisation helper |
| `n_c` | Config file read sub-utility |
| `dn` | Error / diagnostic logger |
| `q_e` | Config read-and-parse orchestrator |
| `Gt` | JSON parse wrapper |
| `V9` | String prefix-strip utility |
| `RFl` | Config backup directory reader |
| `Sko` | Path join + stat utility |
| `f` | Background process / subprocess manager |
| `AAt` | Config auth-guard check |
| `n` | String normalisation (toLowerCase wrapper) |
| `I` | Terminal/UI scroll/layout helper |
| `k` | Terminal supervisor write helper |
| `E` | Terminal bounds clamping utility |
| `g` | IPC buffer/stream splitter |
| `h` | Socket/stream timeout helper |
| `m` | Background session kill helper |
| `Qp` | Stream end/finalise helper |
| `T6f` | Background daemon message dispatcher |
| `Ee` | String coercion utility |
| `MSt` | Atomic file write with backup rotation |
| `jp` | Symlink/realpath resolver |
| `u` | Daemon stop/control helper |
| `Mn` | Error diagnostic wrapper |
| `vKe` | File permission error classifier |
| `LMe` | Config load/initialise helper |
| `_ko` | Config entries iterator |
| `oWt` | Config timestamp tracker |
| `j7n` | Config write fallback path handler |
| `Ue` | UI/output message emitter |
| `ogt` | Output primitive constructor |
| `Rc` | URL-open orchestrator |
| `dVu` | URL scheme validator |
| `Dni` | OS-level URL/browser opener |
| `b_` | Platform detection helper |
| `Un` | Shell spawn wrapper |
| `qr` | Generic child-process spawner |
| `Mt` | Process lifecycle manager |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.