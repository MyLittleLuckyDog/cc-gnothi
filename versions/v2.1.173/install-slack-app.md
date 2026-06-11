---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.173"
updated: "2026-06-11"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.173 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.173 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.173

---

## Overview

`/install-slack-app` is a local slash command that opens the Claude Slack app installation page in the user's default browser. It fires a single telemetry event, emits a text notification to the terminal, and delegates URL-opening to a platform-aware browser launcher — the entire flow completes synchronously from the user's perspective with no interactive prompts.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `$HK` |
| load_inline | `true` |
| loc_byte | `11877413` |
| loc_byte_end | `11877599` |
| loc_line | `8225` |
| arbor_handler.name | `IR7` |
| arbor_handler.fqn | `claude-2.1.173::IR7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.173 bundle.js:+11877413

---

## Input Branching

The command has a simple linear flow with one internal branch (platform selection for the browser-open call). Two distinct paths exist for the URL opener, so pseudocode is sufficient.

```
1. User invokes /install-slack-app
2. Handler IR7 fires telemetry event: tengu_install_slack_app_clicked
3. Emit text notification: "Opening Slack app installation page in browser…"
4. Call platform-aware URL opener (FK) with installation URL:
     if platform == "win32":
         spawn rundll32 with "url,OpenURL" argument
     elif platform == "darwin":
         spawn "open"
     else (Linux / other):
         spawn "xdg-open"
5. Return (no further output)
```

Analysis basis: CC v2.1.173 bundle.js:+11877017, +11877019, +11877132, +11877152, +11877165

---

## Behavioral Spec

### Handler Entry Point (`IR7`)

The async handler `IR7` is the resolved entry point for this command (Arbor resolution path: `module_id`).

```
async function installSlackAppHandler(context):
    # Step 1 — telemetry
    recordTelemetry("tengu_install_slack_app_clicked")       # +11877019

    # Step 2 — config persistence side-effect (via configSaveHelper E8)
    await configSaveHelper(context)                          # +11877057

    # Step 3 — user-visible feedback
    emit({ type: "text",
           content: "Opening Slack app installation page in browser…" })
                                                             # +11877152, +11877165

    # Step 4 — open URL in browser
    await openUrlInBrowser(installationUrl)                  # +11877132
```

Analysis basis: CC v2.1.173 bundle.js:+11877017

---

### Config Persistence Helper (`E8` → `Q78`)

Called once before the browser is opened. Acquires a file-system lock on the config file, reads the current config, validates that existing auth tokens are not lost, then writes back any pending changes.

```
async function configSaveHelper(context):
    lock = acquireConfigLock()                  # Q78 / file lock path
    if lock contention detected:
        recordTelemetry("tengu_config_lock_contention")
        log("error", "Lock acquisition took longer than expected…") # +3312410

    onDisk = readConfigFile(utf8)               # G7H / readFileSync
    parsed = jsonParse(onDisk)                  # n6

    if parsed is missing auth that in-memory cache has:
        recordTelemetry("tengu_config_auth_loss_prevented")
        log warning and abort write              # +3312826

    writeConfigAtomic(parsed)                   # Cz6 — temp file + rename
    releaseLock()
```

Key safety guard: if the on-disk re-read is missing authentication data that the in-memory cache holds, the write is aborted to prevent wiping `~/.claude.json` (see GH #3117, literal at bundle.js:+3312826).

Analysis basis: CC v2.1.173 bundle.js:+3309256, +3309312, +3312410, +3312826

---

### Platform-Aware URL Opener (`FK`)

Selects the correct system command to open a URL based on `process.platform`.

```
function openUrlInBrowser(url):
    validateUrlScheme(url)          # aYL: rejects non-http/https URLs → Error
                                    # literals: "http:" +6249704, "https:" +6249726

    platform = process.platform

    if platform == "win32":         # +6250029
        spawn("rundll32", ["url,OpenURL", url])  # +6250113, +6250125
    elif platform == "darwin":      # +6250013
        spawn("open", [url])        # +6250187
    else:
        spawn("xdg-open", [url])    # +6250194

    # wY handles the actual child-process spawn; p8 provides platform context
```

Analysis basis: CC v2.1.173 bundle.js:+6249941, +6249954, +6250013, +6250029, +6250062, +6250113, +6250187, +6250194

---

### Atomic Config Write (`Cz6`)

Used by the config-save path. Writes config changes safely using a temp-file-then-rename strategy.

```
function atomicWriteConfig(path, data):
    lstat(path)
    if path is symbolic link:
        resolve real target path       # readlinkSync + path resolution
    randomSuffix = crypto.randomBytes(…).toString("hex")   # +1088729, +1088757
    tmpPath = path + "." + randomSuffix
    fd = openSync(tmpPath, writeFlags)
    writeFileSync(fd, data, encoding)
    fchmodSync(fd, originalPermissions)     # +1089223 preserve permissions
    fsyncSync(fd)                           # +1089289 flush to disk
    renameSync(tmpPath, path)               # atomic replace
    if old temp files exist: unlinkSync     # cleanup
```

Analysis basis: CC v2.1.173 bundle.js:+1088100, +1088729, +1089165, +1089223, +1089289, +1089417

---

### Config Backup Rotation (`C_9` / `G7H`)

On each config write, the system maintains a rolling set of backup files under a `backups/` sub-directory.

```
function rotateConfigBackups(configDir):
    backupDir = join(configDir, "backups")   # literal "backups" +3314011
    mkdirSync(backupDir, {recursive: true})
    entries = readdirStringSync(backupDir)
    sorted = entries.filter(startsWithPrefix).sort()
    if sorted.length >= MAX_BACKUPS:         # keep at most N backups
        oldest = sorted[0]
        unlinkSync(join(backupDir, oldest))
    timestamp = Date.now()
    copyFileSync(configPath, join(backupDir, basename + "." + timestamp))
```

Maximum backup count: 5 (literal `5` at bundle.js:+3313429).

Analysis basis: CC v2.1.173 bundle.js:+3314011, +3313429, +3315253, +3315311, +3315564, +3315582

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_install_slack_app_clicked` (bundle.js:+11877019) — fired on every invocation |
| Telemetry — config lock | `tengu_config_lock_contention` (+3312499) — fired when lock wait exceeds threshold |
| Telemetry — stale write | `tengu_config_stale_write` (+3312635) — fired on a stale config write attempt |
| Telemetry — parse error | `tengu_config_parse_error` (+3315074) — fired when config JSON cannot be parsed |
| Telemetry — auth guard | `tengu_config_auth_loss_prevented` (+3312978) — fired when a write is aborted to preserve auth |
| Terminal output | Emits one `text`-type message: `"Opening Slack app installation page in browser…"` (+11877165) |
| Browser side effect | Spawns a platform-specific child process (`rundll32` / `open` / `xdg-open`) to open the installation URL |
| File system | May write/backup `~/.claude.json` via atomic rename; creates `backups/` sub-directory if absent |
| Hook registration | None observed in depth-2 traversal |
| appState changes | None observed in depth-2 traversal |
| Sound | None observed in depth-2 traversal |
| Non-interactive support | `supportsNonInteractive: false` — command must run in an interactive terminal session |

---

## Version History

| Version | Change |
|---|---|
| v2.1.173 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `supportsNonInteractive` is `false`; invoking `/install-slack-app` from a script or CI pipeline will fail or be silently skipped.
2. **Expecting a browser on headless servers**: The command unconditionally tries to open a URL in the default browser. On servers without a display environment (and without `xdg-open` configured), the child process will fail silently or error.
3. **Assuming no file I/O**: Even though the command's visible effect is just opening a URL, it triggers a config-save path (`E8`) that writes to `~/.claude.json`. Running it concurrently with another Claude instance may cause the lock-contention warning.
4. **Mistaking the URL scheme guard for a configurable option**: The URL validator (`aYL`) rejects any scheme other than `http:` or `https:`. The installation URL is hard-coded in the bundle and cannot be overridden via flags.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `IR7` | Main async handler for `/install-slack-app` (Arbor-resolved entry point) |
| `c` | General utility / logger called at handler entry and within config paths |
| `E8` | Config save orchestrator — coordinates lock, read, validate, write |
| `Q78` | Config file lock-and-write core (file lock, backup, atomic write) |
| `_` | Filesystem abstraction (statSync, readdirStringSync, etc.) |
| `o6` | Path resolution / normalization helper |
| `f` | Secondary filesystem module (mkdirSync, statSync, copyFileSync, etc.) |
| `q` | Tertiary filesystem / stream module (readFileSync, mkdirSync, etc.) |
| `L` | Promise / stream finalization helper (finally / close chain) |
| `UV1` | Config object merger (Object.assign wrapper) |
| `lY_` | Config prototype initializer |
| `N` | HTTP/API request builder and dispatcher |
| `d8f` | Request encoding/signing helper |
| `H` | Random-delay / jitter utility (Math.random + setTimeout) |
| `CH` | JSON serializer wrapper (JSON.stringify) |
| `lf` | Response body parser / text extractor |
| `oFH` | Timeout/retry policy helper |
| `i8f` | Streaming response handler (Buffer.byteLength, chunked read) |
| `N8` | Error classification / normalization utility |
| `G7H` | Config file reader and backup rotation orchestrator |
| `n6` | JSON.parse wrapper |
| `bu` | String prefix-strip utility (startsWith + slice) |
| `C_9` | Backup directory scanner and entry sorter |
| `GZ_` | Backup path builder (join + suffix helper) |
| `D` | Background daemon session manager (spawn, kill, memory check) |
| `urH` | Config write guard — checks for auth-token loss before writing |
| `A` | String case-normalization or map-based lookup helper |
| `V` | Versioned filename matcher (startsWith check on backup filenames) |
| `P` | IPC protocol framer (Buffer.concat, chunk splitting) |
| `X` | Socket read-loop with timeout (q.setTimeout) |
| `j` | Session kill dispatcher (A.values + S.kill) |
| `I7` | IPC write flusher (H.end + CH) |
| `p05` | Background session protocol message handler (large dispatcher) |
| `EH` | String coercion wrapper (String()) |
| `E` | Viewport / terminal size clamp (Math.max + Math.min) |
| `W` | SDK connection manager (Promise.all, connected/failed states) |
| `Cz6` | Atomic file write implementation (temp + fchmod + fsync + rename) |
| `O` | Stream/socket event emitter wrapper |
| `R8` | Error code mapper |
| `AJH` | Config write audit logger |
| `R_9` | Config entry iterator (Object.entries) |
| `u26` | Timestamp recorder (Date.now) |
| `g78` | Alternate config write path (fallback save via Cz6) |
| `FK` | Platform-aware URL opener (darwin / win32 / linux branch) |
| `aYL` | URL scheme validator (http/https guard, throws Error on mismatch) |
| `wY` | Child-process spawn wrapper used by FK |
| `p8` | Platform context provider feeding FK |
| `u_` | OAuth / credential flow orchestrator (gvH, pbf, SH chain) |
| `gvH` | OAuth provider dispatcher (multiple provider init functions) |
| `Y` | Process exit coordinator (HX, z.abort, process.exit) |
| `pbf` | String conversion helper for credential values |
| `v3` | Token validation helper |
| `SH` | Persistent state write helper (JA, Rq, MRf) |
| `p6` | Context store accessor (Yo6 + P_) |
| `Yo6` | AsyncLocalStorage store reader (wo6.getStore) |
| `P_` | App-state accessor (BG) |

---

*Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.*