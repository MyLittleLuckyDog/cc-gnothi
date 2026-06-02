---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.152"
updated: "2026-06-01"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.152 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.152 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.152

---

## Overview

The `/install-slack-app` command opens the Claude Slack application installation page in the user's default browser. It is a lightweight, single-purpose local command that fires a telemetry event, emits a status message, and delegates URL-opening to a platform-aware browser launcher — requiring no agent turn and producing no conversational output.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `jy1` |
| load_inline | `true` |
| loc_byte | `11378811` |
| loc_byte_end | `11378997` |
| loc_line | `9531` |
| arbor_handler.name | `zoL` |
| arbor_handler.fqn | `claude-2.1.152::zoL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.152 bundle.js:+11378811

---

## Input Branching

This command has a simple linear flow with no meaningful user-input branching. The only conditional logic is internal to the platform-detection step inside the URL-opener. A numbered pseudocode representation is appropriate.

1. User invokes `/install-slack-app`.
2. Handler `zoL` fires.
3. Telemetry event `tengu_install_slack_app_clicked` is emitted.
4. A status text `"Opening Slack app installation page in browser…"` is returned to the UI.
5. `openUrlInBrowser` (`PK`) is called with the Slack installation URL.
6. Inside `openUrlInBrowser`, platform is checked (`darwin` / `win32` / other) and the appropriate system command is chosen (`open`, `rundll32 url,OpenURL`, or `xdg-open`).
7. Control returns; command completes.

---

## Behavioral Spec

### Handler Entry — `zoL` (AsyncFunction)

```
async function installSlackAppHandler(context):
    emit telemetry("tengu_install_slack_app_clicked")   // bundle.js:+11378417
    loadConfig(context)                                  // via configLoader (c)
    await saveGlobalConfig(context)                     // via globalConfigSaver (M8)
    yield uiMessage(type="text",
                    body="Opening Slack app installation page in browser…")
                                                        // bundle.js:+11378550, +11378563
    await openUrlInBrowser(SLACK_INSTALL_URL)           // via urlOpener (PK), bundle.js:+11378530
```

Analysis basis: CC v2.1.152 bundle.js:+11378415, +11378455, +11378530

---

### URL Opening — `openUrlInBrowser` (`PK`)

```
async function openUrlInBrowser(url):
    validate url scheme is "http:" or "https:"         // bundle.js:+6577695, +6577717
    if validation fails:
        throw error via urlValidationError (uQ7)       // bundle.js:+6577932
    resolve browser context via contextResolver (gJ)   // bundle.js:+6577945
    platform = detectPlatform()                        // bundle.js:+6578004, +6578020
    if platform == "darwin":
        spawn("open", [url])
    else if platform == "win32":
        spawn("rundll32", ["url,OpenURL", url])        // bundle.js:+6578104, +6578116
    else:
        spawn("xdg-open", [url])                       // bundle.js:+6578185
    await spawnResult via spawnRunner (Z8)             // bundle.js:+6578053
```

Analysis basis: CC v2.1.152 bundle.js:+6577932, +6577945, +6578053

---

### Spawn Runner — `Z8` / `T_` / `a0H`

```
async function spawnRunner(command, args):
    build spawn options via spawnOptionsBuilder (a0H)  // bundle.js:+1047863
        // sets cwd, env, stdio, timeout (10 s limit)  // bundle.js:+1047808
        // timeout ceiling: 1,000,000 ms               // bundle.js:+1048330
    launch child process
    on success: resolve with stdout
    on failure: reject via promiseRejecter
    wrap in daemon-aware dispatcher (D)                // bundle.js:+1048506
    emit warnings at log level "warn"                  // bundle.js:+15382131
```

Analysis basis: CC v2.1.152 bundle.js:+1047863, +1048506

---

### Global Config Save — `M8` / `S$_`

The handler calls the global config writer before opening the browser. The writer acquires a filesystem lock before persisting.

```
async function saveGlobalConfig(context):
    resolve config path via pathResolver (BG)
    acquire file lock via fileLockWriter (S$_)         // bundle.js:+3198454
        // warns "Lock acquisition took longer than expected…"
        //   if contention detected                    // bundle.js:+3201364
        // emits tengu_config_lock_contention          // bundle.js:+3201453
    if re-read config is missing auth that cache has:
        // log "saveGlobalConfig fallback: …"          // bundle.js:+3198661
        // emits tengu_config_auth_loss_prevented      // bundle.js:+3201932
        return without writing
    write config atomically via atomicWriter (z76)     // bundle.js:+3202623
        // uses 6-byte hex random temp suffix          // bundle.js:+1010475, +1010491
        // applies original permissions (mode 384 / 0o600) // bundle.js:+384 loc:+3202665
        // renames temp file into place
    emit tengu_config_stale_write if stale             // bundle.js:+3201589
    rotate config backups (keep 5 most recent)         // bundle.js:+3202383, +3202965
```

Analysis basis: CC v2.1.152 bundle.js:+3198454, +3201364, +3201453, +3201780, +3202623

---

### Config File Reader — `zzH`

```
function readConfigFile(path):
    if config accessed before initialization:
        throw Error("Config accessed before allowed.") // bundle.js:+3203397
    read file as utf-8                                 // bundle.js:+3203480
    parse JSON via jsonParser (B6)
    normalize tilde prefixes via tildeNormalizer (Mb)  // bundle.js:+3203503
    scan backup directory via backupScanner (zpq)      // bundle.js:+3203643
    emit tengu_config_parse_error on parse failure     // bundle.js:+3204028
```

Analysis basis: CC v2.1.152 bundle.js:+3203391, +3203480

---

### HTTP Client / Agent Dispatcher — `N` / `DyK`

These are utility functions reached transitively through the config subsystem; they are not directly invoked by the Slack-install flow at the application level but appear in the depth-2 call graph due to shared infrastructure.

```
function httpDispatcher(request):
    normalize method to uppercase                      // bundle.js:+203195
    apply debug log level                              // bundle.js:+203069
    serialize body via jsonStringifier (CH)            // bundle.js:+203151
    compute Buffer.byteLength of body                  // bundle.js:+202789
    attach Content-Length header
    execute request with retry (timeout 1000 ms,
                                max 100 retries)       // bundle.js:+202900, +202919
    bind response handlers                             // bundle.js:+202848
```

Analysis basis: CC v2.1.152 bundle.js:+203093, +202789

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_install_slack_app_clicked` (bundle.js:+11378417) |
| Telemetry — config lock | `tengu_config_lock_contention` (bundle.js:+3201453) |
| Telemetry — stale write | `tengu_config_stale_write` (bundle.js:+3201589) |
| Telemetry — parse error | `tengu_config_parse_error` (bundle.js:+3204028) |
| Telemetry — auth loss | `tengu_config_auth_loss_prevented` (bundle.js:+3201932) |
| Telemetry — bg signals | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_spare_spawn` (background daemon pool; incidental to depth-2 traversal) |
| Browser launch | Spawns `open` (macOS), `rundll32 url,OpenURL` (Windows), or `xdg-open` (Linux) (bundle.js:+6578178, +6578104, +6578185) |
| Config write | Acquires filesystem lock; writes atomically with mode `0o600` (384) to `~/.claude.json`; keeps up to 5 backup copies (bundle.js:+3202383) |
| UI message | Emits a `text`-type message: `"Opening Slack app installation page in browser…"` (bundle.js:+11378563) |
| Non-interactive support | `supportsNonInteractive: false` — command must be run in an interactive session |
| Sound | None detected |
| appState changes | No direct appState mutation observed at depth ≤ 2 |

---

## Version History

| Version | Change |
|---|---|
| v2.1.152 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `supportsNonInteractive` is `false`; invoking `/install-slack-app` in a headless or piped session will be rejected before the handler fires.
2. **No browser installed / `xdg-open` missing on Linux**: The command will fail silently or throw if the platform URL-opener binary is absent; there is no fallback to printing the URL.
3. **Expecting agent output**: This command yields a single status text message and exits — it does not start an agent turn. Do not expect a conversational reply.
4. **URL scheme validation**: Only `http:` and `https:` schemes pass the internal validator; custom or `slack://` deep-link schemes are rejected at the `openUrlInBrowser` layer.
5. **Config lock contention**: If another Claude instance holds the config lock, the command will stall and emit `tengu_config_lock_contention` rather than proceeding immediately.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `zoL` | Main handler — `installSlackAppHandler` (AsyncFunction) |
| `c` | Config accessor / context loader |
| `M8` | Global config saver — `saveGlobalConfig` |
| `S$_` | File-lock-aware config writer — `saveConfigWithLock` |
| `_` | Filesystem abstraction (internal FS wrapper) |
| `Q6` | Path existence / access checker |
| `L` | Atomic file writer / temp-file manager |
| `q` | Low-level filesystem operations object |
| `M` | Stream / handle close coordinator |
| `Efq` | HTTP request builder |
| `Iq_` | HTTP headers normalizer |
| `N` | HTTP dispatcher / fetch wrapper |
| `OyK` | HTTP transport selector |
| `H` | Retry / jitter scheduler |
| `CH` | JSON body serializer |
| `j4` | URL path formatter |
| `VxH` | Response decoder |
| `DyK` | HTTP request executor with chunked encoding |
| `L8` | Logger / structured log emitter |
| `zzH` | Config file reader — `readConfigFile` |
| `B6` | JSON parser wrapper |
| `Mb` | Tilde-prefix normalizer |
| `zpq` | Backup directory scanner |
| `R$_` | Backup path joiner |
| `w` | Background daemon process manager |
| `uO6` | Config cache updater |
| `A` | Platform / environment string resolver |
| `V` | Version string or file entry prefix filter |
| `P` | MCP / SDK transport initializer |
| `IR8` | SDK transport constructor |
| `hH` | MCP server connection handler |
| `n_` | Error type normalizer |
| `Z` | Backup list slice helper |
| `z76` | Atomic file writer — `writeFileAtomic` |
| `O` | Symlink / stat result wrapper |
| `j8` | Error code extractor |
| `bgH` | Config background helper |
| `Opq` | Config entries iterator |
| `xgH` | Config timestamp stamper |
| `h$_` | Config path builder |
| `PK` | URL opener — `openUrlInBrowser` |
| `uQ7` | URL validation error thrower |
| `gJ` | Browser context resolver |
| `Z8` | Spawn result awaiter |
| `T_` | Child process launcher |
| `a0H` | Spawn options builder |
| `D` | Daemon-aware process dispatcher |
| `w64` | Stdout/stderr string coercer |
| `Tz` | Process exit code checker |
| `b6` | Async context / store reader |
| `KU6` | AsyncLocalStorage store accessor |
| `z_` | Promise value unwrapper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.