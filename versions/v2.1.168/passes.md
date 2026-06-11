---
type: feature-spec
feature: "passes"
cc_version: "2.1.168"
updated: "2026-06-11"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.168 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.168 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.168

---

## Overview

`/passes` is a UI command that presents the user with a guest-pass sharing interface, allowing them to give friends a free week of Claude Code access. The command is implemented as an async function (`bRf`) that resolves via module `d_K`, renders a JSX component, and fires a single telemetry event to record that the page was visited. It has no sub-commands or arguments.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| module_id | `d_K` |
| load_inline | `true` |
| isHidden | `null` (not hidden) |
| loc_byte | `12459792` |
| loc_byte_end | `12460114` |
| loc_line | `8843` |
| arbor_handler.name | `bRf` |
| arbor_handler.fqn | `claude-2.1.168::bRf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.168 bundle.js:+12459792

---

## Input Branching

The command flow is essentially linear — no user-supplied arguments are parsed, and the branching is limited to internal state setup (logger initialization and JSX rendering). A numbered pseudocode description is therefore appropriate.

1. User invokes `/passes`.
2. The CLI resolves module `d_K` and calls the async handler `bRf`.
3. `bRf` initialises a logger reference (`l`) and calls the configuration loader (`LC8`), which internally coordinates with the config-read subsystem (`kL → GY`) and the session writer (`C6`).
4. `bRf` calls the session/context initialiser (`X8`), which sets up config-state watchers and prepares the working directory for the session.
5. `bRf` fires the telemetry event `tengu_guest_passes_visited`.
6. `bRf` calls `qLA.createElement` to render the JSX component that forms the command's visual output (the guest-pass sharing UI).
7. The rendered element is returned to the CLI shell for display.

---

## Behavioral Spec

### Handler entry point — `guestPassesHandler` (`bRf`)

```
async function guestPassesHandler(context):
    logger = initLogger()                          // identifier: l
    configBundle = await loadConfig(context)       // LC8 → kL → GY, C6
    sessionContext = await initSession(context)    // X8 → sP_, LwH, aP_
    emitTelemetry("tengu_guest_passes_visited")
    uiElement = createElement(GuestPassesView, sessionContext)
    return uiElement
```

Analysis basis: CC v2.1.168 bundle.js:+12459475 (callGraph edge `bRf → C6`), +12459509 (`bRf → LC8`), +12459515 (`bRf → X8`), +12459613 (`bRf → l`), +12459615 (telemetry), +12459664 (`bRf → qLA.createElement`)

---

### Configuration loading — `configLoader` (`LC8`)

```
async function configLoader(context):
    profileBundle = await resolveProfile(context)  // kL → GY
    sessionState  = await writeSession(context)    // C6
    return { profileBundle, sessionState }
```

Internally, `resolveProfile` (`kL`) delegates to the authentication/profile subsystem (`GY`), which handles OAuth profiles (`Bj`), API-key authentication (`GO`), and profile listing (`qlH`).

Analysis basis: CC v2.1.168 bundle.js:+12071848 (`LC8 → kL`), +12071896 (`LC8 → C6`), +3022968 (`kL → GY`)

---

### Session initialiser — `sessionInit` (`X8`)

```
async function sessionInit(context):
    validate(context.qZ)                           // qZ: config-schema validator
    workDir   = resolveWorkDir(context.H)          // H: current-directory state
    dlH       = prepareDirectoryLayout(workDir)    // dlH: dir-layout helper
    entryList = buildEntryList()                   // Vo1 → Object.entries
    timestamp = Date.now()                         // qK8
    fsState   = await loadFileSystemState()        // LwH: fs-state loader
    extraData = resolveExtras(context)             // aj6
    logger    = getLogger()                        // l

    if fsState is stale:
        syncConfig()                               // sP_ → LwH, V8, RH
    
    alternateConfig = resolveAlternate(context)    // aP_ → O$6, RH, xJ
    return sessionBundle
```

The `sP_` sub-function performs config file locking (emitting `tengu_config_lock_contention` on contention), backup rotation (keeping the last 5 backups — literal `5` at bundle.js:+3266522), and atomic writes (via `O$6`, which uses `randomBytes` + rename).

Analysis basis: CC v2.1.168 bundle.js:+3262406 (`X8 → sP_`), +3262462 (`X8 → dlH`), +3262481 (`X8 → Vo1`), +3262506 (`X8 → qK8`), +3262587 (`X8 → LwH`), +3266522 (backup count literal `5`)

---

### Filesystem state loader — `fsStateLoader` (`LwH`)

```
function fsStateLoader(path, options):
    if configAccessedBeforeAllowed:
        throw Error("Config accessed before allowed.")   // literal at +3267536

    rawBytes = fs.readFileSync(path, "utf-8")            // encoding literal at +3267619
    parsed   = jsonParse(rawBytes)                       // U6 → JSON.parse
    prefix   = extractPrefix(parsed)                     // Hu → H.startsWith / H.slice

    backupList = listBackups(path)                       // No1 → _.readdirStringSync
    for entry in backupList:
        if entry.startsWith(prefix):
            handle(entry)

    httpState = fetchHttpState()                         // v → NUH, snK
    merged    = mergeState(parsed, httpState)

    try:
        fs.statSync(dest)
    except ENOENT:                                       // literal at +3267766
        fs.mkdirSync(dest)                               // if directory missing

    fs.copyFileSync(src, dest)                           // atomic backup copy
    return merged
```

Analysis basis: CC v2.1.168 bundle.js:+3267530 (Error guard), +3267536 (error text literal), +3267592 (`LwH → q.readFileSync`), +3267639 (`LwH → U6`), +3267766 (ENOENT literal), +3268346 (`LwH → q.mkdirSync`), +3268675 (`LwH → q.copyFileSync`)

---

### Backup directory listing — `listBackups` (`No1`)

```
function listBackups(configPath):
    baseDir  = path.dirname(configPath)            // dD.dirname
    baseName = path.basename(configPath)           // dD.basename
    backupDir = buildBackupPath(baseDir, "backups")// tP_ → path.join; literal "backups" at +3267104
    entries  = fs.readdirStringSync(backupDir)     // _.readdirStringSync
    relevant = entries.filter(e => e.startsWith(baseName))
    return relevant
```

Analysis basis: CC v2.1.168 bundle.js:+3267137 (`No1 → d6`), +3267144 (`No1 → dD.basename`), +3267177 (`No1 → _.readdirStringSync`), +3267104 (literal `"backups"`)

---

### Atomic config write — `atomicConfigWrite` (`O$6`)

```
function atomicConfigWrite(destPath, content, mode):
    if isSymlink(destPath):
        target = fs.readlinkSync(destPath)
        destPath = resolveAbsolute(target, path.dirname(destPath))

    randomSuffix = crypto.randomBytes(6).toString("hex")   // literals 6 at +3267104, "hex" at +1058142
    tempPath     = destPath + "." + randomSuffix
    fd           = fs.openSync(tempPath, flags)
    fs.writeFileSync(fd, content)
    fs.fchmodSync(fd, mode)                                // preserve permissions
    fs.fsyncSync(fd)
    fs.closeSync(fd)
    fs.renameSync(tempPath, destPath)                      // atomic replace
```

Backup file count is capped at **5** (bundle.js:+3266522). Mode `384` (`0o600`) is used as the fallback permission mask (bundle.js:+3266804).

Analysis basis: CC v2.1.168 bundle.js:+1057485 (`O$6 → q.readlinkSync`), +1058114 (`O$6 → yH_.randomBytes`), +1058550 (`O$6 → D$.writeFileSync`), +1058608 (`O$6 → D$.fchmodSync`), +1058802 (`O$6 → q.renameSync`), +3266804 (mode literal `384`)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_guest_passes_visited` (bundle.js:+12459615) — fired once on every invocation of `/passes` |
| Telemetry (infra, not command-specific) | `tengu_config_parse_error` (+3268167), `tengu_config_lock_contention` (+3265592), `tengu_config_stale_write` (+3265728), `tengu_config_auth_loss_prevented` (+3266071) — emitted by shared config subsystem touched during session init |
| Telemetry (daemon infra) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_low_mem_mb`, `tengu_bg_dispatch_low_mem`, `tengu_bg_adopt_sock_unlinked`, `tengu_bg_spare_enable`, `tengu_bg_sendclaim_failed`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_retire_pinned_low_mem`, `tengu_bg_prewarm_per_sweep`, `tengu_daemon_control`, `tengu_daemon_config_reload` — emitted by background daemon subsystem loaded transitively |
| Telemetry (feature flags) | `tengu_feature_ok` (+1010950), `tengu_feature_bad` (+1011012) — feature-flag evaluation during session bootstrap |
| File system | Config directory may have a `backups/` subdirectory created; up to 5 backup copies of the config file are maintained; temp files are written and atomically renamed |
| Hook registration | `j9 → NPA.register` at bundle.js:+60369 — registers an abort/cleanup hook during session bootstrap |
| File watch | `hVL → _K8.watchFile` (+3263787) / `_K8.unwatchFile` (+3264120) — config file is watched during session lifetime |
| appState changes | Session context (`X8`) updates working directory, config state, and session registry |
| Sound | None identified |
| Auth guard | If no valid auth credential is present (no `ANTHROPIC_API_KEY`, OAuth token, WIF vars, or API key helper), the config subsystem raises an error (literal at bundle.js:+3004652) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.168 | Initial analysis |

---

## Common Mistakes

1. **Expecting argument parsing**: `/passes` takes no arguments. Any text typed after `/passes` is silently ignored by the handler; the command always opens the guest-pass sharing UI.
2. **Invoking without authentication**: The session initialiser (`X8 → LC8 → GO`) enforces that a valid credential is configured before the UI is rendered. Running `/passes` in an unauthenticated environment will fail during config bootstrap, not in the passes UI itself.
3. **Assuming synchronous execution**: The handler (`bRf`) is an `AsyncFunction`. Callers in scripting contexts must `await` it or handle the returned Promise, otherwise the JSX element may be returned before the config subsystem finishes loading.
4. **Misinterpreting the telemetry scope**: Only `tengu_guest_passes_visited` is specific to this command. The many `tengu_bg_*` and `tengu_config_*` events are emitted by shared infrastructure loaded during every session and are not unique to `/passes`.
5. **Manual backup directory cleanup**: The config backup rotation is automatic (capped at 5 files). Manually deleting or modifying files in the `backups/` directory can cause `ENOENT` errors during the next config write.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `bRf` | Main handler for `/passes` (AsyncFunction; Arbor-resolved from module `d_K`) |
| `C6` | Session state writer / config commit helper |
| `d6` | Logger / debug emitter |
| `nP_` | Session context normaliser |
| `LwH` | Filesystem state loader (reads + backs up config file) |
| `q` | Node `fs` module wrapper (sync I/O ops) |
| `U6` | JSON parse wrapper |
| `Hu` | Config prefix extractor (uses `startsWith` / `slice`) |
| `H` | HTTP fetch / bootstrap state fetcher |
| `_` | Filesystem utility (readdirStringSync, statSync, toUpperCase shim) |
| `V8` | Config validation / schema check helper |
| `No1` | Backup directory listing function |
| `tP_` | Backup path builder (path.join wrapper) |
| `M` | MCP server registry / server-map accessor |
| `$` | DLK-backed string utility |
| `v` | HTTP state fetch orchestrator |
| `snK` | HTTP request state sub-helper |
| `RH` | JSON serialiser (JSON.stringify wrapper) |
| `G4` | String sanitiser / redactor |
| `EUH` | Error formatter helper |
| `_iK` | File read + byte-length calculator |
| `l` | Logger initialiser / logger ref |
| `w` | Background daemon worker manager |
| `A` | Worker/session map (Map-like) |
| `b` | Spawned subprocess handle |
| `r8` | Subprocess timeout/abort helper |
| `CH` | Background session error reporter |
| `SH` | Background session success reporter |
| `lx8` | macOS memory reporter |
| `eX6` | Async file reader with JSON parse |
| `hH` | Feature-flag evaluator |
| `Q` | Worker retire/settle coordinator |
| `D6` | Daemon dispatch / worker lookup |
| `pwA` | Worker spawn / claim helper |
| `dwA` | Worker cleanup / lifecycle finisher |
| `L` | Secondary lifecycle helper (mirrors dwA subset) |
| `D` | Forced shutdown / process.exit handler |
| `J6` | UI framework render helper (hm6) |
| `B` | Resource disposable handle |
| `hVL` | Config file watcher |
| `co` | Watch-event callback |
| `j9` | Hook/abort registration (NPA.register) |
| `LC8` | Config loader orchestrator |
| `kL` | Profile resolver (delegates to GY) |
| `GY` | Authentication/profile subsystem orchestrator |
| `O4` | React-like createElement primitive (_6) |
| `Bj` | OAuth profile handler |
| `aL` | First-party auth checker |
| `pX` | Profile picker / switcher |
| `GO` | API-key authentication handler |
| `nw6` | qlH-delegating profile list shim |
| `qlH` | Profile list renderer |
| `X8` | Session context initialiser |
| `sP_` | Config-file save with locking and backup rotation |
| `R21` | Lock acquisition helper |
| `QM_` | Lock implementation (S21-backed) |
| `aj6` | Extra/override config resolver |
| `V` | Terminal scroll viewport |
| `P` | Terminal / PTY manager |
| `J` | Worker reference resolver |
| `j` | Worker kill helper |
| `z` | Terminal offset/scroll controller |
| `Y` | Supervisor / daemon session manager |
| `h` | Background sweep / memory manager |
| `EOA` | Vim-mode operator registry |
| `C` | Rate-limit queue executor |
| `E` | Terminal emulator instance |
| `O$6` | Atomic file write (temp + rename) |
| `O` | Symlink/stat result object |
| `h8` | V8-backed hash helper |
| `f` | File descriptor / stream handle |
| `dlH` | Directory layout helper |
| `Vo1` | Object.entries wrapper for entry building |
| `qK8` | Timestamp recorder (Date.now wrapper) |
| `aP_` | Alternate-config resolver (uses O$6, RH, xJ) |

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.