---
type: feature-spec
feature: "passes"
cc_version: "2.1.167"
updated: "2026-06-11"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.167 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.167 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.167

---

## Overview

`/passes` is a local-jsx slash command that presents a UI for sharing free weeks of Claude Code with friends via "guest passes." When invoked, the command renders a React-based interface (via `ALA.createElement`) that allows the user to view and share guest pass allocations. The command fires a `tengu_guest_passes_visited` telemetry event on execution.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| loc_byte | `12459607` |
| loc_byte_end | `12459929` |
| loc_line | `8843` |
| isHidden | `null` (not hidden) |
| module_id | `g_K` |
| load_inline | `true` |
| arbor_handler.name | `RRf` |
| arbor_handler.fqn | `claude-2.1.167::RRf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.167 bundle.js:+12459607

---

## Input Branching

The handler has two primary branches based on state resolution: (1) acquiring the current passes state via the config/daemon subsystem, and (2) rendering the JSX view. The overall flow is linear with a telemetry side-effect, so numbered pseudocode is used.

```
1. User invokes /passes
2. Handler (RRf) begins execution as an AsyncFunction
3. Emit telemetry event: tengu_guest_passes_visited
4. Call sessionStateLoader (KC8) to load session context
   └─ sessionStateLoader calls configLoader (kL) and sessionContextBuilder (C6)
5. Call passesUiFactory (X8) to build the UI component tree
   ├─ X8 resolves current pass state via configLoader (LwH) and stateMapper (Zo1)
   ├─ X8 calls passFileManager (aP_) for on-disk pass data (reading, writing, backup)
   └─ X8 calls passDirectoryMapper (oP_) for directory-level operations
6. Render JSX element via ALA.createElement with the resolved props
7. Return rendered component to the CLI shell for display
```

Analysis basis: CC v2.1.167 bundle.js:+12459290, +12459324, +12459330, +12459479

---

## Behavioral Spec

### Main Handler — guestPassesHandler (RRf)

```
async function guestPassesHandler(context):
    emit telemetry("tengu_guest_passes_visited")
    sessionState = await loadSessionState(context)       // KC8
    uiComponent = buildPassesUI(sessionState, context)   // X8
    element = createElement(PassesView, uiComponent)     // ALA.createElement
    return element
```

Analysis basis: CC v2.1.167 bundle.js:+12459290, +12459324, +12459330, +12459428, +12459479

---

### Session State Loader — sessionStateLoader (KC8)

```
function loadSessionState(context):
    config = loadConfig(context)        // kL → GY
    session = buildSessionContext()     // C6
    return { config, session }
```

Analysis basis: CC v2.1.167 bundle.js:+12071663, +12071711

---

### Passes UI Factory — passesUIFactory (X8)

```
function buildPassesUI(sessionState, context):
    configState  = loadPassConfigState()        // LwH
    passEntries  = mapPassEntries(configState)  // Zo1 (Object.entries)
    timestamps   = readTimestamps()             // AK8 (Date.now)
    passData     = loadPassFiles(sessionState)  // aP_
    dirData      = mapPassDirectories()         // oP_
    logger       = getLogger()                  // l

    return {
        configState,
        passEntries,
        timestamps,
        passData,
        dirData
    }
```

Analysis basis: CC v2.1.167 bundle.js:+3262290, +3262294, +3262314, +3262346, +3262365, +3262390, +3262406, +3262471, +3262487, +3262623, +3262737

---

### Config State Loader — configStateLoader (LwH)

This function reads and parses the on-disk configuration supporting pass state. It handles several error scenarios:

```
function loadPassConfigState():
    if config not yet accessible:
        throw Error("Config accessed before allowed.")   // loc +3267420

    raw = fs.readFileSync(configPath, "utf-8")           // loc +3267476, +3267503
    parsed = JSON.parse(raw)                             // via U6 → JSON.parse
    status = resolvePassStatus(parsed)                   // Hu
    // status values: "unknown", "local", "migrated", "native",
    //                "installed", "disabled", "enabled",
    //                "no_permissions", "not_configured", "global"
    //                (literals loc +3262914–+3263141)

    if ENOENT error:                                     // loc +3267650
        return default state

    directories = scanPassDirectory()                    // Vo1
    fs.statSync(path)                                    // loc +3268011
    fs.mkdirSync(path)                                   // loc +3268230
    fs.readdirStringSync(path)                           // loc +3268288
    copyPassFiles()                                      // fs.copyFileSync loc +3268559

    emit telemetry("tengu_config_parse_error") on parse failure  // loc +3268051
    return configState
```

Analysis basis: CC v2.1.167 bundle.js:+3267414, +3267420, +3267461, +3267476, +3267503, +3267523, +3267526, +3267543, +3267597, +3267642, +3267650, +3267666, +3268011, +3268049, +3268051, +3268203, +3268220, +3268230, +3268288, +3268323, +3268442, +3268541, +3268559

---

### Pass File Manager — passFileManager (aP_)

Handles reading, writing, rotating, and atomically saving pass data files. Key behaviors:

```
function loadPassFiles(sessionState):
    ensure directory exists via mkdirSync         // L.mkdirSync loc +3265203
    timestamp = Date.now()                        // loc +3265248

    acquire config lock:
        if lock contention:
            emit telemetry("tengu_config_lock_contention")  // loc +3265476
        if stale write detected:
            emit telemetry("tengu_config_stale_write")      // loc +3265612
        if auth loss would occur:
            emit telemetry("tengu_config_auth_loss_prevented")  // loc +3265955
            log warning: "saveConfigWithLock: re-read config is missing auth..."
                         // loc +3265803

    read directory entries via readdirStringSync  // L.readdirStringSync loc +3266165
    filter entries containing ".backup."          // loc +3266273
    keep only the most recent 5 backups           // literal 5, loc +3266406
    remove excess backup files via unlinkSync     // L.unlinkSync loc +3266524
    copy pass file                                // L.copyFileSync loc +3266380
    write atomically via atomicFileWrite ($$6)    // loc +3266646
        uses: randomBytes, openSync, writeFileSync,
              fchmodSync, fsyncSync, renameSync
    apply file mode 384 (octal 0600)              // literal 384, loc +3266688

    if re-read config missing auth:
        log: "saveGlobalConfig fallback: re-read config is missing auth..."
             // loc +3262497
    return fileData
```

Analysis basis: CC v2.1.167 bundle.js:+3265176, +3265198, +3265203, +3265248, +3265261, +3265303, +3265387, +3265474, +3265537, +3265552, +3265612, +3265734, +3265765, +3265787, +3265803, +3265955, +3266003, +3266032, +3266044, +3266072, +3266089, +3266165, +3266200, +3266258, +3266265, +3266273, +3266296, +3266341, +3266380, +3266406, +3266509, +3266524, +3266646, +3266688, +3266726

---

### Pass Directory Scanner — passDirectoryScanner (Vo1)

```
function scanPassDirectory(basePath):
    basename = path.basename(basePath)       // dD.basename loc +3267028
    backupDir = buildBackupPath(basePath)    // sP_ → path.join("backups") loc +3266988
    entries = fs.readdirStringSync(backupDir) // loc +3267061
    filter entries not starting with prefix  // M.startsWith loc +3267096
    resolve full paths via path.join         // dD.join loc +3267152
    get parent via path.dirname              // dD.dirname loc +3267178
    check symlinks via $.startsWith          // loc +3267237
    stat resolved files via _.statSync       // loc +3267337
    return directory listing
```

Analysis basis: CC v2.1.167 bundle.js:+3267021, +3267028, +3267045, +3267061, +3267096, +3267152, +3267178, +3267237, +3267337

---

### Config Loader — configLoader (GY / kL)

```
function loadConfig(context):
    appConfig = loadAppConfig()              // GY → O4, Bj
    authProfile = resolveAuthProfile()       // aL → MA (firstParty)  loc +2101240
    checkProfileImplicit()                   // literal "profile-implicit" loc +3001039
    checkOAuthUser()                         // literal "user_oauth" loc +3001112

    if no API key found:
        throw Error("ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, ...")
                    // loc +3004536

    return config
```

Known environment variables checked: `ANTHROPIC_API_KEY` (loc +3004067), `apiKeyHelper` (loc +3004161).

Analysis basis: CC v2.1.167 bundle.js:+3022852, +3022857, +3002048, +3002146, +3002167, +3002175, +3002200, +3002253, +3002429, +3002445

---

### Session Context Builder — sessionContextBuilder (C6)

```
function buildSessionContext():
    timestamp = Date.now()                   // loc +3264258
    watchFile = setupFileWatcher()           // IVL → HK8.watchFile loc +3263671
    resolveStatus = resolvePassState()       // d6, qZ, lP_, LwH loc +3264168–+3264205
    registerCleanup(j9)                      // VPA.register loc +60369
    return sessionContext
```

Analysis basis: CC v2.1.167 bundle.js:+3264168, +3264182, +3264201, +3264205, +3264258, +3264311

---

### Pass Status Values

The following status string literals are used to represent the state of a guest pass slot (Analysis basis: CC v2.1.167 bundle.js:+3262914–+3263141):

| Status String | Meaning |
|---|---|
| `"unknown"` | Status could not be determined |
| `"local"` | Pass is local only |
| `"migrated"` | Pass has been migrated |
| `"native"` | Native pass type |
| `"installed"` | Pass is installed |
| `"disabled"` | Pass is disabled |
| `"enabled"` | Pass is active/enabled |
| `"no_permissions"` | Insufficient permissions |
| `"not_configured"` | Not yet configured |
| `"global"` | Global-scope pass |

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_guest_passes_visited` (loc +12459430) — fired on every invocation of `/passes` |
| Telemetry | `tengu_config_parse_error` (loc +3268051) — fired if config file cannot be parsed |
| Telemetry | `tengu_config_lock_contention` (loc +3265476) — fired if config lock acquisition is slow |
| Telemetry | `tengu_config_stale_write` (loc +3265612) — fired when a stale write is detected |
| Telemetry | `tengu_config_auth_loss_prevented` (loc +3265955) — fired when a write that would erase auth is blocked |
| File I/O | Reads pass data config file (utf-8, loc +3267476); writes atomically with mode 0600 (loc +3266688) |
| Backup rotation | Keeps at most 5 `.backup.` files in the backup directory; older entries are deleted (loc +3266406, +3266524) |
| Directory creation | Creates pass storage directory if absent via `mkdirSync` (loc +3265203, +3268230) |
| File watcher | Registers a `watchFile` / `unwatchFile` pair during session context setup (loc +3263671, +3264004) |
| Hook registration | Registers a cleanup hook via `VPA.register` (loc +60369) |
| appState changes | Session context is constructed and provided to the JSX view; no global app-state mutation observed at depth ≤ 2 |
| Sound | None observed |
| JSX rendering | Calls `ALA.createElement` to build the passes UI component (loc +12459479) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.167 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/passes` without a valid auth configuration** — The handler calls the config loader early; if no `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, or WIF env vars are present, the command will throw before rendering any UI (loc +3004536).
2. **Assuming the command has no file-system side effects** — `/passes` reads and may write to a config file and a backup directory on every invocation. On first use the directory is created automatically.
3. **Expecting synchronous completion** — The handler is declared as an `AsyncFunction` (arbor_handler.kind); callers must await the result or the JSX element will not be available.
4. **Misinterpreting a `"not_configured"` status as an error** — This is a valid status string (loc +3263122) indicating the pass feature has not been set up, not a fatal failure.
5. **Deleting backup files manually** — The rotation logic keeps the 5 most recent `.backup.` files (loc +3266406). Manually removing files between rotations may confuse the backup-count logic.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `RRf` | Main async handler for `/passes` (guestPassesHandler) |
| `C6` | Session context builder |
| `d6` | Logger / debug utility (used across many call sites) |
| `lP_` | Pass state resolver helper |
| `LwH` | Config state loader (reads/writes pass config file) |
| `U6` | JSON-parse wrapper |
| `Hu` | Status-string extractor (startsWith / slice on status field) |
| `H` | HTTP fetch / bootstrap utility |
| `V8` | Async task / promise utility |
| `Vo1` | Pass directory scanner |
| `sP_` | Backup path builder (path.join + "backups") |
| `M` | MCP / module registry lookup |
| `$` | Symbol / path resolver |
| `v` | Environment / process info builder |
| `onK` | Process-info sub-collector |
| `RH` | JSON.stringify wrapper |
| `G4` | String formatter / path sanitiser |
| `EUH` | Error utility wrapper |
| `enK` | File content encoder (uses Buffer.byteLength) |
| `l` | Logger instance |
| `w` | Daemon worker / subprocess manager |
| `A` | Worker registry map |
| `b` | Subprocess handle |
| `r8` | Subprocess runner (setTimeout / clearTimeout / abort) |
| `CH` | Background session creator (telemetry: daemon_bg_session_create) |
| `SH` | Background session stopper (telemetry: daemon_stop) |
| `cx8` | Memory-check utility (macOS freemem) |
| `tX6` | Config file async reader |
| `hH` | Worker health checker |
| `Q` | Process retire-if-settled handler |
| `D6` | Daemon dispatch / IB registry coordinator |
| `mwA` | Daemon claim + connect (YQ.claim / bF8.connect) |
| `QwA` | Worker lifecycle manager (done/killed/stopped/failed states) |
| `L` | Secondary worker lifecycle alias (shares queue add/delete) |
| `D` | Forced-shutdown handler (process.exit / z.abort) |
| `J6` | ym6 / startup bootstrap caller |
| `IVL` | File-watch session watcher (HK8.watchFile / unwatchFile) |
| `co` | File-watch change callback |
| `j9` | Cleanup hook registrar (VPA.register) |
| `KC8` | Session state loader (calls kL and C6) |
| `kL` | Config+session bootstrap (GY + C6) |
| `GY` | App config loader (O4, Bj, aL, pX, GO, lw6, AlH) |
| `O4` | Config object initialiser (_6) |
| `Bj` | Auth profile builder (tt6, AlH, sU, AN, aU, r1, YC, DVH) |
| `aL` | First-party auth resolver (MA / firstParty) |
| `pX` | Profile selector |
| `GO` | OAuth / API-key gate (checks ANTHROPIC_API_KEY, throws on missing creds) |
| `lw6` | AlH-based config helper |
| `AlH` | Config field accessor (_6 / nOH) |
| `X8` | Passes UI factory (orchestrates LwH, Zo1, AK8, aP_, oP_) |
| `aP_` | Pass file manager (read/write/backup/atomic-write) |
| `S21` | Config object merger (gM_ + Object.assign) |
| `gM_` | Config schema initialiser (h21) |
| `oj6` | Passes overlay / merge helper |
| `V` | Terminal / viewport utility |
| `P` | Terminal input handler (OK.fromText, J, j, H.onChange, z.setOffset, Y, h, w, TOA, C.execute) |
| `J` | Worker-pool accessor (w) |
| `j` | Worker-kill helper (A.values / S.kill) |
| `z` | Scroll-offset controller (SH, CH, xh, sp) |
| `Y` | Terminal output writer (q.write / mfK / E.start/stop) |
| `h` | Session sweep / low-memory respawn coordinator |
| `TOA` | Vim-mode operator registry (Ltf…Jtf) |
| `C` | Task executor (R6K, k.enqueue, Jj.randomUUID, R6) |
| `E` | Terminal renderer (start / stop / updateConfig) |
| `$$6` | Atomic file write (randomBytes, openSync, writeFileSync, fchmodSync, fsyncSync, renameSync) |
| `O` | Symlink stat checker (b8 / isSymbolicLink) |
| `h8` | Hash / checksum utility (V8) |
| `f` | File handle wrapper (A.close / q.close / L) |
| `QlH` | Pass query-list helper |
| `Zo1` | Pass entries mapper (Object.entries) |
| `AK8` | Timestamp snapshot helper (Date.now) |
| `oP_` | Pass directory mapper (AK8, qZ, d6, dD.dirname, xJ, RH, $$6, v) |