---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.150"
updated: "2026-06-01"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.150 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.150 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.150

---

## Overview

`/install-slack-app` is a local slash command that opens the Claude Slack app installation page in the user's default browser. It emits a telemetry event on invocation, displays a short status message to the user, and delegates URL-opening to a platform-aware browser launcher. The command has no interactive sub-flow and produces no persistent state changes beyond the browser action.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `Av1` |
| load_inline | `true` |
| loc_byte | `11302603` |
| loc_byte_end | `11302789` |
| loc_line | `9239` |
| arbor_handler.name | `qdL` |
| arbor_handler.fqn | `claude-2.1.150::qdL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.150 bundle.js:+11302603

---

## Input Branching

The command has a simple linear flow with no user-supplied arguments and only minor platform branching inside the URL-opener. Numbered pseudocode is used accordingly.

1. User invokes `/install-slack-app` (no arguments accepted).
2. Handler `qdL` is resolved via `module_id → Av1`.
3. Telemetry event `tengu_install_slack_app_clicked` is fired immediately.
4. A text message `"Opening Slack app installation page in browser…"` is emitted to the UI.
5. `openUrlInBrowser` (`OK`) is called with the Slack-app installation URL.
6. Inside `openUrlInBrowser`, the platform is examined (`darwin` / `win32` / other) and the appropriate OS command is selected (`open` / `rundll32 url,OpenURL` / `xdg-open`).
7. The URL is validated to confirm it begins with `http:` or `https:` before the shell call is made.
8. Control returns; the command exits with no further output.

---

## Behavioral Spec

### Top-level Handler — `qdL`

```
async function installSlackAppHandler(context):
    emit telemetry("tengu_install_slack_app_clicked")          // +11302209
    saveConfigWithLock(context)                                  // configWriter (+11302247)
    displayMessage("text", "Opening Slack app installation page in browser…")  // +11302355
    openUrlInBrowser(SLACK_APP_INSTALL_URL)                     // +11302322
    return
```

Analysis basis: CC v2.1.150 bundle.js:+11302207

---

### Config Writer — `configWriter` (`f8`)

The handler calls the config-write utility (`f8`) before launching the browser. This ensures any pending configuration state is flushed under a file lock before the process yields control.

```
function configWriter(configState):
    acquire filesystem lock via lockFileHelper ($f_)
    if lock contention detected:
        emit telemetry("tengu_config_lock_contention")          // +3193710
        log warning("Lock acquisition took longer than expected …")  // +3193621
    read current config from disk (JOH)
    if cached auth is present but re-read config is missing it:
        emit telemetry("tengu_config_auth_loss_prevented")      // +3194189
        log error("saveGlobalConfig fallback: re-read config …") // +3190919
        abort write to protect credentials
    merge changes, write atomically via atomicFileWrite (UK6)
    release lock
```

Analysis basis: CC v2.1.150 bundle.js:+3190712

---

### Lock-File Helper — `lockFileHelper` (`$f_`)

```
function lockFileHelper(targetPath):
    resolve directory via pathDirname
    create directory if absent (mkdirSync)
    record timestamp via Date.now()                              // +3193482
    attempt lock with retry loop
    on "error" severity lock event:
        emit telemetry("tengu_config_lock_contention")
    if stale lock detected:
        emit telemetry("tengu_config_stale_write")              // +3193846
    copy or unlink backup files (max 5 backups)                 // +3194640
    apply file mode 0o600 (384 decimal) on new config           // +3194922
    return acquired lock handle
```

Analysis basis: CC v2.1.150 bundle.js:+3190712

---

### Config Reader — `configReader` (`JOH`)

```
function configReader(configPath):
    if configPath not accessible:
        throw Error("Config accessed before allowed.")           // +3195654
    read file as "utf-8"                                         // +3195737
    parse JSON via jsonParse (g6)
    strip leading BOM if present via bomStripper (xC)
    walk backup directory (mb9) if main file absent
    stat result file to confirm it is a regular file
    return parsed config object
```

Analysis basis: CC v2.1.150 bundle.js:+3195648

---

### Atomic File Writer — `atomicFileWrite` (`UK6`)

```
function atomicFileWrite(filePath, content):
    resolve symlinks; if relative, resolve against dirname
    generate random hex temp filename (6 bytes → 12 hex chars)  // +1009393, +1009405
    open temp file (openSync), write content, fchmod, fsync
    log debug("Applied original permissions to temp file")       // +1009892
    rename temp → target (atomic on POSIX)
    on ELOOP / ENOTDIR error: surface to caller                  // +1009034, +1009047
    clean up temp file on failure (unlinkSync)
```

Analysis basis: CC v2.1.150 bundle.js:+1008661

---

### Browser URL Opener — `openUrlInBrowser` (`OK`)

```
function openUrlInBrowser(url):
    validate url.protocol is "http:" or "https:"                // +6473853, +6473875
    if validation fails: throw via urlValidationError (Vm7)     // +6473803
    detect platform:
        "darwin"  → spawn ["open", url]                         // +6474162, +6474336
        "win32"   → spawn ["rundll32", "url,OpenURL", url]      // +6474178, +6474262, +6474274
        otherwise → spawn ["xdg-open", url]                     // +6474343
    invoke spawnProcess (E8) with chosen command array
    return result of spawnProcess
```

Analysis basis: CC v2.1.150 bundle.js:+6474090

---

### Process Spawner — `spawnProcess` (`E8`)

```
async function spawnProcess(commandArray):
    resolve agent/context store via contextStore (x6 → Mm6)
    obtain session descriptor via sessionResolver (j_)
    spawn child process via processSpawnHelper (G_)
    on spawn: record in active-process map (D)
    on completion: retire settled sessions                       // g.retireIfSettled
    return exit code / stdout
```

Analysis basis: CC v2.1.150 bundle.js:+1046765

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_install_slack_app_clicked` (bundle.js:+11302209) |
| Telemetry — config lock | `tengu_config_lock_contention` (+3193710), `tengu_config_stale_write` (+3193846) |
| Telemetry — auth guard | `tengu_config_auth_loss_prevented` (+3194189) |
| Telemetry — config error | `tengu_config_parse_error` (+3196285) |
| Telemetry — background session | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_spare_spawn` (inherited from process-spawn path) |
| UI output | Single `text` message: `"Opening Slack app installation page in browser…"` (+11302355) |
| Browser side effect | Opens Slack app installation URL in OS default browser |
| File system | Config file may be re-written atomically under lock (mode 0o600 / 384) if pending state exists; up to 5 backup files retained (+3194922, +3194640) |
| Auth protection | Write is aborted and telemetry fired if re-read config is missing auth present in cache (GH #3117 guard) |
| appState changes | None documented at depth-2 traversal |
| Sound | None |
| supportsNonInteractive | `false` — command must run in an interactive session |

---

## Version History

| Version | Change |
|---|---|
| v2.1.150 | Initial analysis |

---

## Common Mistakes

1. **Invoking in non-interactive mode**: `supportsNonInteractive` is `false`; running `/install-slack-app` from a scripted or headless pipeline will be rejected or produce no output.
2. **Expecting a return value**: The command's only observable effect is the browser window opening. There is no structured output to capture or pipe.
3. **Firewall / sandbox restrictions**: On Linux, the command falls back to `xdg-open`. If `xdg-open` is absent or the display server is unavailable (e.g., in SSH sessions without X forwarding), the browser will not open and no explicit error is surfaced to the user.
4. **Assuming instant availability**: The command calls the config writer before opening the browser. On systems with slow filesystems or lock contention from another Claude instance, the `"Opening …"` message may appear with a short delay.
5. **Re-running to fix auth issues**: If the auth-loss guard (`tengu_config_auth_loss_prevented`) fires, the config write is intentionally aborted. Re-running the command will not resolve the underlying auth state mismatch; manual inspection of `~/.claude.json` is required.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `qdL` | Main async handler for `/install-slack-app` (`arbor_handler`) |
| `c` | Generic utility / logger helper called from handler |
| `f8` | Config writer — flushes config state under lock |
| `$f_` | Lock-file helper — acquires/releases filesystem lock for config |
| `_` | Low-level filesystem abstraction (readdirStringSync, statSync, etc.) |
| `Q6` | Path existence / access checker |
| `L` | Filesystem module wrapper (mkdirSync, statSync, copyFileSync, etc.) |
| `q` | Secondary filesystem wrapper (unlinkSync, readFileSync, etc.) |
| `M` | Async resource with `.finally` / close semantics |
| `_L9` | Object-assign / config merge helper |
| `A__` | Inner merge helper called by `_L9` |
| `N` | HTTP/network request helper (includes retry logic) |
| `LVK` | Network sub-helper (calls `Gv`, `KVK`, `T7A`) |
| `H` | Randomised retry delay helper (Math.random + setTimeout) |
| `CH` | JSON serialiser wrapper (JSON.stringify) |
| `X4` | URL/string manipulation helper |
| `HbH` | Additional string-processing helper |
| `$VK` | File-write sub-routine (Buffer.byteLength, fVK.bind, etc.) |
| `K8` | Error classification / code extractor |
| `JOH` | Config reader — reads and parses config from disk |
| `g6` | JSON parse wrapper |
| `xC` | BOM / prefix stripper (startsWith + slice) |
| `mb9` | Backup directory walker |
| `Of_` | Path join helper (iY.join + i8) |
| `w` | Background session / process monitor |
| `f$6` | Config field accessor |
| `A` | Lowercase normaliser / platform string helper |
| `V` | Intermediate string with `.startsWith` check |
| `P` | MCP/transport session manager (Promise.all, RH, etc.) |
| `wh8` | Transport initialiser |
| `RH` | Session result handler (logError, dxH.push) |
| `c_` | Error constructor wrapper |
| `Z` | Array/slice buffer accumulator |
| `UK6` | Atomic file writer |
| `O` | lstat result wrapper (isSymbolicLink) |
| `j8` | Error-code helper (uses K8) |
| `OFH` | Config initialisation helper |
| `ub9` | Object.entries iterator helper |
| `zFH` | Timestamp recorder (Date.now) |
| `ff_` | Symlink-safe path resolver (dirname, UK6) |
| `OK` | Browser URL opener — platform-aware spawn |
| `Vm7` | URL validation error thrower |
| `yJ` | URL parser / protocol extractor |
| `E8` | Process spawner — spawns OS command |
| `G_` | Process spawn core — manages child lifecycle |
| `lWH` | Spawn options builder (SGA, FK6, DGA, etc.) |
| `D` | Active-process registry / dispatcher |
| `OaK` | String coercion helper |
| `Dz` | Diagnostic / debug logger |
| `x6` | AsyncLocalStorage context resolver |
| `Mm6` | Store getter (Lm6.getStore + wl) |
| `j_` | Session descriptor resolver (Dv) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.