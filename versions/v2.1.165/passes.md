---
type: feature-spec
feature: "passes"
cc_version: "2.1.165"
updated: "2026-06-05"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.165 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.165 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.165

---

## Overview

The `/passes` command presents users with a UI panel for sharing a free week of Claude Code with friends ("guest passes"). When invoked, it renders a JSX component via `pKA.createElement` and emits a `tengu_guest_passes_visited` telemetry event. The command is a local-jsx type registered under module `A8K` and resolved through the Arbor symbol graph to the async handler `Ahf`.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | Share a free week of Claude Code with friends |
| loc_byte | `12425626` |
| loc_byte_end | `12425948` |
| loc_line | `8829` |
| isHidden | `null` (not hidden) |
| module_id | `A8K` |
| load_inline | `true` |
| arbor_handler.name | `Ahf` |
| arbor_handler.fqn | `claude-2.1.165::Ahf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.165 bundle.js:+12425626

The registration block spans bytes `(12425626, 12425948)`. Arbor resolved the handler via `module_id → A8K → moduleExports → Ahf`. The `load_inline: true` field indicates the handler was bundled inline (no separate dynamic import).

---

## Input Branching

The command handler `Ahf` exhibits a relatively linear flow — it collects configuration state, fires telemetry, and renders a JSX view — with two notable branches: one for session/configuration availability and one for the JSX render path. A numbered pseudocode representation is therefore appropriate.

1. Command is invoked by the user typing `/passes`.
2. Handler `Ahf` is entered (async).
3. `configReader` (`y6`) is called to obtain current configuration state.
   - Analysis basis: CC v2.1.165 bundle.js:+12425309
4. `guestPassesScreenBuilder` (`gS8`) is invoked, which internally calls `hL` (session loader) and `y6` (config reader) again.
   - Analysis basis: CC v2.1.165 bundle.js:+12425343
5. `configSaveWithLock` (`X8`) is called if any state mutations are required.
   - Analysis basis: CC v2.1.165 bundle.js:+12425349
6. Application state `c` is read/updated.
   - Analysis basis: CC v2.1.165 bundle.js:+12425447
7. Telemetry event `tengu_guest_passes_visited` is emitted.
   - Analysis basis: CC v2.1.165 bundle.js:+12425449
8. `pKA.createElement` renders the JSX guest-passes panel to the terminal UI.
   - Analysis basis: CC v2.1.165 bundle.js:+12425498

---

## Behavioral Spec

### Main Handler — `Ahf` (guestPassesCommandHandler)

```
async function guestPassesCommandHandler(context):
    // Step 1: Read current configuration
    config = configReader(context)

    // Step 2: Build the guest-passes screen data
    screenData = guestPassesScreenBuilder(config, context)
    //   internally calls: sessionLoader, configReader

    // Step 3: Persist any config mutations under a file lock
    configSaveWithLock(config, screenData)

    // Step 4: Read/update application state
    appState = applicationState()

    // Step 5: Emit telemetry — command was visited
    emitTelemetry("tengu_guest_passes_visited")

    // Step 6: Render JSX panel into the terminal UI
    return reactCreateElement(GuestPassesPanel, { screenData, appState })
```

Analysis basis: CC v2.1.165 bundle.js:+12425309–12425498

---

### Configuration Reader — `y6` (configReader)

```
function configReader(context):
    // Obtain the current config object (Q6)
    raw = getConfigObject()

    // Parse using fileReader (eT) and configParser (bDH)
    parsed = configParser(raw)

    // Returns config, observing file-watch via WTL
    return parsed
```

Analysis basis: CC v2.1.165 bundle.js:+3258669–3258812

The configReader calls `Q6` (config accessor), `eT` (file reader), `kX_` (config key extractor), and `bDH` (config parser). It also registers a file-watch callback via `WTL` (`configFileWatcher`) and timestamps access with `Date.now`. Analysis basis: CC v2.1.165 bundle.js:+3258759

---

### Config Parser — `bDH` (configParser)

```
function configParser(rawPath):
    // Guard: config must be accessible
    if not accessAllowed:
        throw Error("Config accessed before allowed.")
        // Analysis basis: CC v2.1.165 bundle.js:+3261921

    // Read file as UTF-8
    content = fs.readFileSync(path, "utf-8")
    // Analysis basis: CC v2.1.165 bundle.js:+3262004

    // Parse JSON
    parsed = jsonParse(content)   // via B6 → JSON.parse

    // Validate prefix via Ix (configPrefixValidator)
    if configPrefixValidator(parsed):
        data = parsed.slice(...)

    // Walk entries, classifying each as one of:
    //   "unknown" | "local" | "migrated" | "native" |
    //   "installed" | "disabled" | "enabled" |
    //   "no_permissions" | "global" | "not_configured"
    // Analysis basis: CC v2.1.165 bundle.js:+3257436–3257642

    // On ENOENT: treat as empty config (not an error)
    // Analysis basis: CC v2.1.165 bundle.js:+3262151

    // On other errors: emit tengu_config_parse_error telemetry
    // Analysis basis: CC v2.1.165 bundle.js:+3262552

    // Build backup directory path via backupPathBuilder (Or1)
    backupDir = backupPathBuilder(parsed)

    return { data, backupDir }
```

Key constants surfaced in the parser:
- Status strings: `"unknown"`, `"local"`, `"migrated"`, `"native"`, `"installed"`, `"disabled"`, `"enabled"`, `"no_permissions"`, `"global"`, `"not_configured"` (bundle.js:+3257415–3257642)
- Error guard message: `"Config accessed before allowed."` (bundle.js:+3261921)
- File encoding: `"utf-8"` (bundle.js:+3262004)
- ENOENT is handled gracefully (bundle.js:+3262151)
- EEXIST is handled during directory creation (bundle.js:+3262766)

---

### Config Save With Lock — `X8` (configSaveWithLock)

```
async function configSaveWithLock(config, mutations):
    // Resolve the file's parent directory
    dir = path.dirname(configFilePath)

    // Create directory if absent (mkdirSync)
    fs.mkdirSync(dir, { recursive: true })

    // Acquire advisory lock; warn if contention detected
    // Emits: tengu_config_lock_contention
    // Warning: "Lock acquisition took longer than expected ..."
    // Analysis basis: CC v2.1.165 bundle.js:+3259888

    // Re-read current config to detect concurrent writes
    reread = configReader()

    // Safety guard: refuse to overwrite if auth fields disappeared
    // Emits: tengu_config_auth_loss_prevented
    // Log: "saveConfigWithLock: re-read config is missing auth ..."
    // Analysis basis: CC v2.1.165 bundle.js:+3260304

    // Atomically write via atomicFileWriter (TM6):
    //   - write to temp file
    //   - fchmod to preserve original permissions (384 = 0o600)
    //     Analysis basis: CC v2.1.165 bundle.js:+3261189
    //   - fsync + rename into place
    //   - unlink temp on failure

    // Rotate backups: keep at most 5 backup files
    // Files named with ".backup." infix
    // Analysis basis: CC v2.1.165 bundle.js:+3260774, +3260907

    // Emit: tengu_config_stale_write on stale-write detection
    // Analysis basis: CC v2.1.165 bundle.js:+3260113
```

File permissions constant: `384` (octal `0o600`, owner read/write only). Analysis basis: CC v2.1.165 bundle.js:+3261189

Backup rotation keeps at most **5** backup copies. Analysis basis: CC v2.1.165 bundle.js:+3260907

---

### Guest Passes Screen Builder — `gS8` (guestPassesScreenBuilder)

```
function guestPassesScreenBuilder(config, context):
    // Load session information via sessionLoader (hL)
    session = sessionLoader(config)
    //   hL calls zY (authSessionResolver) → L4 (profileLoader),
    //   Bj (profileBuilder), Z7 (authTypeClassifier),
    //   DO (oauthSessionFetcher)

    // Re-read config for screen state
    currentConfig = configReader()

    // Return structured screen data (JSX props)
    return buildScreenProps(session, currentConfig)
```

Analysis basis: CC v2.1.165 bundle.js:+12036200–12036248

The session loader (`hL`) ultimately resolves OAuth and API-key auth paths via `DO` (`oauthSessionFetcher`), which checks for `ANTHROPIC_API_KEY`, `apiKeyHelper`, and various OAuth token environment variables. Analysis basis: CC v2.1.165 bundle.js:+2999134–2999603

---

### Atomic File Writer — `TM6` (atomicFileWriter)

```
function atomicFileWriter(targetPath, content):
    // Resolve symlinks in the target path
    resolved = resolveSymlink(targetPath)

    // Stat the original to capture permissions
    stat = fs.statSync(resolved)

    // Write to a temp file (random 6-byte hex suffix)
    // Analysis basis: CC v2.1.165 bundle.js:+3261189 (6 random bytes → hex)
    tmpPath = targetPath + "." + randomBytes(6).toString("hex")
    fd = fs.openSync(tmpPath, ...)
    fs.writeFileSync(fd, content)

    // Apply original permissions to temp file
    fs.fchmodSync(fd, stat.mode)   // log: "Applied original permissions..."
    // Analysis basis: CC v2.1.165 bundle.js:+1057895

    fs.fsyncSync(fd)
    fs.closeSync(fd)

    // Atomic rename
    fs.renameSync(tmpPath, resolved)

    // On ELOOP / ENOTDIR: propagate error
    // Analysis basis: CC v2.1.165 bundle.js:+1057037, +1057050
```

Random suffix length: **6 bytes** → 12 hex characters. Analysis basis: CC v2.1.165 bundle.js:+1057396

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_guest_passes_visited` | Fired unconditionally when `/passes` is invoked (bundle.js:+12425449) |
| Telemetry — `tengu_config_parse_error` | Fired if the config JSON cannot be parsed (bundle.js:+3262552) |
| Telemetry — `tengu_config_lock_contention` | Fired if config file lock takes unexpectedly long (bundle.js:+3259977) |
| Telemetry — `tengu_config_stale_write` | Fired if a stale-write condition is detected during save (bundle.js:+3260113) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a write is blocked to prevent auth-data loss (bundle.js:+3260456) |
| Telemetry — `tengu_feature_ok` / `tengu_feature_bad` | Fired by the feature-flag checker on success/failure (bundle.js:+1010222, +1010284) |
| File writes | Config persisted atomically via temp-file + rename; backup rotation keeps ≤ 5 `.backup.` files |
| File permissions | Written with mode `0o600` (owner read/write only) |
| JSX render | Mounts a `GuestPassesPanel` component into the terminal UI via `pKA.createElement` |
| appState changes | Application state object `c` is read and potentially updated during handler execution |
| File watch | `configFileWatcher` (`WTL`) registers a `watchFile` / `unwatchFile` pair on the config path (bundle.js:+3258172, +3258505) |
| Hook registration | `j9` calls `zXA.register` — registers a cleanup/teardown hook (bundle.js:+60323) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.165 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/passes` before authentication is complete** — the config parser guard (`"Config accessed before allowed."`) will throw, and the command will fail silently or display an error. Ensure the CLI is fully initialized before running `/passes`.

2. **Concurrent Claude Code instances modifying config** — the lock-contention telemetry (`tengu_config_lock_contention`) signals this. Running two Claude Code sessions simultaneously against the same config file can cause one to block or log a stale-write warning. Use a single session at a time.

3. **Expecting `/passes` to immediately transfer or create a pass** — the command renders an informational/interactive UI panel; the actual pass-sharing action is completed through the rendered panel's controls, not by invoking the command itself.

4. **Confusion with hidden commands** — `isHidden` is `null` (not `true`), so `/passes` appears in the command list and autocomplete. It is not a secret or developer-only command.

5. **Misinterpreting config status strings** — the parser classifies config entries into ten distinct status strings (`"unknown"`, `"local"`, `"migrated"`, `"native"`, `"installed"`, `"disabled"`, `"enabled"`, `"no_permissions"`, `"global"`, `"not_configured"`). A value of `"no_permissions"` does not mean the pass feature is unavailable — it refers to a specific permission-configuration state of an individual setting.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Ahf` | Main async handler for `/passes` (guestPassesCommandHandler) |
| `y6` | Configuration reader (configReader) |
| `Q6` | Raw config object accessor |
| `kX_` | Config key extractor |
| `bDH` | Config file parser (configParser) |
| `B6` | JSON parse wrapper |
| `Ix` | Config prefix validator |
| `Or1` | Backup path builder |
| `bX_` | Backup directory path joiner |
| `v8` | Version/metadata helper |
| `v` | Environment/context value resolver |
| `icK` | Context initialization helper |
| `SH` | JSON stringify wrapper |
| `J4` | String formatting/path helper |
| `ppH` | Prompt/path helper (C2A wrapper) |
| `acK` | File content accumulator / byte-length tracker |
| `c` | Application state object |
| `w` | Background worker / daemon process manager |
| `A` | Process map / worker registry |
| `l8` | Async abort/timeout helper |
| `RH` | Worker ready-signal handler |
| `hH` | Worker heartbeat handler |
| `vb8` | macOS memory reporter |
| `zX6` | Async config file reader |
| `kH` | Feature-flag checker |
| `g` | Worker process lifecycle manager (retireIfSettled etc.) |
| `D6` | Background session dispatcher |
| `VDA` | Daemon socket claim/connect handler |
| `hDA` | Background session state manager |
| `L` | Session lifecycle tracker (mirrors `hDA`) |
| `D` | Forced-shutdown / process-exit handler |
| `P6` | Process spawn result handler |
| `WTL` | Config file watcher (watchFile / unwatchFile) |
| `No` | File-watch notification handler |
| `j9` | Cleanup hook registrar (calls `zXA.register`) |
| `gS8` | Guest passes screen builder |
| `hL` | Session loader |
| `zY` | Auth session resolver |
| `L4` | Profile loader |
| `Bj` | Profile builder |
| `Z7` | Auth type classifier |
| `pX` | OAuth token provider |
| `DO` | OAuth session fetcher |
| `Aw6` | Auth profile helper |
| `JcH` | Auth environment helper |
| `X8` | Config save with lock (configSaveWithLock) |
| `CX_` | Global config save with lock (saveGlobalConfig path) |
| `XP1` | Lock acquisition helper |
| `k5_` | Advisory lock primitive |
| `fj6` | Config staleness checker |
| `V` | Terminal/UI scroll component |
| `P` | Terminal application root |
| `J` | Worker pool reference |
| `j` | Worker kill helper |
| `z` | Scroll/offset controller |
| `Y` | Supervisor config reloader |
| `h` | Background sweep / memory pressure handler |
| `L3A` | Vim-mode key binding registry |
| `C` | Rate-limit event queue |
| `T` | Terminal renderer |
| `TM6` | Atomic file writer (temp-file + rename) |
| `O` | Symlink stat helper |
| `R8` | File read error wrapper |
| `f` | File descriptor lifecycle manager |
| `_lH` | Internal lock helper |
| `$r1` | Object entries iterator helper |
| `t98` | Timestamp helper (Date.now wrapper) |
| `RX_` | Config read-and-write merge helper |
| `M` | Model/config map accessor |
| `$` | NKK-based config namespace helper |
| `_` | Filesystem abstraction layer |
| `H` | HTTP bootstrap fetch helper |
| `SDA` | OS free-memory accessor (`os.freemem`) |
| `UD` | Path utilities (dirname, basename, join) |
| `eT` | File read helper |
| `eH` | Environment helper |
| `EOH` | Auth environment object helper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.