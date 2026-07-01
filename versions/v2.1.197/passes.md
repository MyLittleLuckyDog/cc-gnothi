---
type: feature-spec
feature: "passes"
cc_version: "2.1.197"
updated: "2026-07-01"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.197 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.197 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.197

---

## Overview

The `/passes` command allows Claude Code users to share a free week of Claude Code access with friends via "guest passes." When invoked, it renders a JSX-based UI panel showing available passes and triggers a telemetry event (`tengu_guest_passes_visited`) to record that the feature was accessed. The command is of type `local-jsx`, meaning it renders an interactive React/JSX component inline within the CLI rather than sending a prompt to the model.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| loc_byte | `12862927` |
| loc_byte_end | `12863249` |
| loc_line | `8806` |
| isHidden | `null` (not hidden; visible in command palette) |
| module_id | `jXl` |
| load_inline | `true` |
| arbor_handler.name | `S7f` |
| arbor_handler.fqn | `claude-2.1.197::S7f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.197 bundle.js:+12862927

---

## Input Branching

The handler has a single primary entry path (fire telemetry → load config → render JSX component) with branching only in the deep config/file subsystem. The top-level command flow is essentially linear, so numbered pseudocode is used here.

```
1. User types /passes in the CLI.
2. Handler S7f is invoked (async).
3. S7f fires telemetry event: tengu_guest_passes_visited.
4. S7f calls configFileWatcher (Hn) to ensure guest-pass state is
   available from the persisted config layer.
5. S7f calls passesUIFactory (Mir) to obtain the JSX element describing
   the guest-passes panel.
6. S7f renders the resulting JSX element (VXl.jsx call at +12862809)
   into the CLI display surface.
7. Control returns; no model turn is initiated.
```

Analysis basis: CC v2.1.197 bundle.js:+12862620, +12862654, +12862660, +12862758, +12862809

---

## Behavioral Spec

### 1. Top-Level Handler (`S7f`)

```
async function passesCommandHandler(context):
    emit telemetry("tengu_guest_passes_visited")          // +12862760

    configData = await configFileWatcher(context)          // Hn, +12862660
    passesPanel = await passesUIFactory(context)           // Mir, +12862654

    stateRef = getStateRef(context)                        // V,  +12862758
    return renderJSX(VXl, { passesPanel, stateRef })       // +12862809
```

Analysis basis: CC v2.1.197 bundle.js:+12862620

---

### 2. Config File Watcher (`Hn`)

The config watcher sets up the live configuration view needed by the passes UI. It performs the following sequence:

```
function configFileWatcher(context):
    baseDir   = getConfigDir(context)                     // w0,  +14157749
    identity  = resolveIdentity(context)                  // e,   +14157770
    sessionId = buildSessionId(context)                   // zUe, +14157802

    entryMap  = buildEntryMap()                           // pqo, +14157821
    //   pqo enumerates Object.entries(+14159061)

    timestamp = Date.now()                                // ttn, +14157846 / +14159645

    renderTarget = getRenderTarget(context)               // T,   +14157862
    loaderFn     = getLoaderFn(context)                   // etn, +14157927
    //   etn delegates to configLoader (lIt) and baseDir resolver (w0)

    changeTracker = getChangeTracker(context)             // cIt, +14157936
    stateSlot     = getStateSlot(context)                 // V,   +14158072

    // If a file watcher (vdr) is already registered, reuse it.
    // Otherwise create a new watcher that calls syncConfigToDisk on change.
    fileWatcher = resolveOrCreateWatcher(context)         // vdr, +14158186

    return { entryMap, timestamp, loaderFn, fileWatcher, stateSlot }
```

Analysis basis: CC v2.1.197 bundle.js:+14157745

---

### 3. File Watcher / Diff Engine (`vdr`)

```
function resolveOrCreateWatcher(watcherContext):
    timestamp  = getTimestamp()                           // ttn, +14160519
    baseDir    = getBaseDir()                             // w0,  +14160545
    configPath = resolveConfigPath()                      // qt,  +14160550
    dirName    = path.dirname(configPath)                 // ey.dirname, +14160565
    configId   = getConfigId()                            // gI,  +14160586
    metaObj    = buildMeta()                              // Me,  +14160598

    // Perform atomic write of config changes
    atomicWrite(configPath, metaObj)                      // mRt, +14160617

    renderFn   = getRenderFn()                            // T,   +14160695
    stateSlot  = getStateSlot()                           // V,   +14160794

    // Register a platform overlay for change notifications
    overlayHook = registerOverlay()                       // Oe,  +14160834
    return overlayHook
```

Analysis basis: CC v2.1.197 bundle.js:+14160519

---

### 4. Config Loader (`lIt`)

The config loader reads the persisted JSON config file and handles error and migration scenarios:

```
function configLoader(configPath, options):
    if configPath is not yet accessible:
        throw Error("Config accessed before allowed.")    // +14163499

    resolvedPath = resolveConfigPath(configPath)          // qt, +14163540
    rawBytes     = fs.readFileSync(resolvedPath, "utf-8") // +14163555, +14163582

    if rawBytes is empty or read fails with ENOENT:       // +14163765
        return defaultConfig()

    parsed = safeJsonParse(rawBytes)                      // Gt → JSON.parse, +14163602

    normalized = normalizeKeys(parsed)                    // q5 → startsWith/slice, +14163605
    //   q5 strips known prefixes from key names

    // Classify config source:
    //   "unknown"        (+14158423)
    //   "local"          (+14158498)
    //   "migrated"       (+14158485)
    //   "native"         (+14158530)
    //   "installed"      (+14158516)
    //   "disabled"       (+14158549)
    //   "enabled"        (+14158575)
    //   "no_permissions" (+14158589)
    //   "not_configured" (+14158610)
    //   "global"         (+14158629)
    sourceTag = classifyConfigSource(normalized)

    // Scan backup directory for previous snapshots
    backupDir  = resolveBackupDir(configPath)             // "backups", +14163067
    backupList = listBackups(backupDir)                   // mqo, +14163781

    // Build content hash; apply any schema migration
    contentHash = hashContent(rawBytes)                   // T → various, +14164013
    migrated    = applyMigrations(parsed, contentHash)

    // Create per-session backup copy stamped with Date.now()
    backupPath  = buildBackupPath(configPath)             // ey.basename+hqo, +14164175/+14164192
    fs.mkdirSync(backupDir, { recursive: true })          // +14164198
    existingBackups = fs.readdirStringSync(backupDir)     // +14164219

    // Skip files whose names start with the session marker  (+14164254)
    if not alreadyBackedUp(existingBackups):
        destPath = path.join(backupDir, timestamp + ".backup.") // ".backup.", +14162345
        fs.copyFileSync(resolvedPath, destPath)           // +14164496

    // Deduplicate via a Set (uqo)
    if uqo.has(resolvedPath): return cached               // +14164847
    uqo.add(resolvedPath)                                 // +14164859

    // Emit telemetry if parse errors encountered
    if parseError:
        emit telemetry("tengu_config_parse_error")        // +14164913

    return migrated
```

Analysis basis: CC v2.1.197 bundle.js:+14163493

---

### 5. Config Save with Lock (`rtn` — `saveConfigWithLock`)

The save path is exercised whenever the passes UI triggers a state change. It enforces single-writer semantics:

```
async function saveConfigWithLock(configPath, newConfig, cache):
    dirName = path.dirname(configPath)                    // ey.dirname, +14160886
    fs.mkdirSync(dirName, { recursive: true })            // s.mkdirSync, +14160907

    lockAcquired = acquireLock(configPath)                // nci → b4r+tci, +14160965

    if lockAcquireTime > threshold:
        emit telemetry("tengu_config_lock_contention")    // +14161180
        log("Lock acquisition took longer than expected…")// +14161091

    // Re-read config under lock to detect concurrent writes
    reReadConfig = configLoader(configPath)

    if reReadConfig.version < cache.version:
        emit telemetry("tengu_config_stale_write")        // +14161316

    if reReadConfig has JSON parse error:
        emit telemetry("tengu_config_auto_repaired")      // +14161693
        // Auto-repair from cache; log GH #3117 note:
        // "saveConfigWithLock: re-read hit a parse error…" (+14161565)

    if reReadConfig is missing auth fields that cache has:
        emit telemetry("tengu_config_auth_loss_prevented")// +14162023
        // Refuse write; log GH #3117 note:
        // "saveConfigWithLock: re-read config is missing auth…" (+14161871)
        return

    // Keep only last 5 backups                           // 5, +14162484
    pruneBackups(backupDir, keepCount=5)
    // Backup file names contain ".backup."               // +14162345

    // Atomic write via temp file → rename
    atomicWrite(configPath, newConfig)                    // mRt, +14162724
    // File mode: 0o600 (384 decimal)                     // 384, +14162766

    return savedConfig
```

Analysis basis: CC v2.1.197 bundle.js:+14160880

---

### 6. Passes UI Factory (`Mir`)

```
async function passesUIFactory(context):
    // Obtain user account context (Nc → aE)
    accountCtx = resolveAccountContext(context)           // Nc, +12506557
    //   aE branches on auth method:
    //     ANTHROPIC_API_KEY env var      (+3096209)
    //     apiKeyHelper                   (+3096303)
    //     none                           (+3096342)
    //     user_oauth / profile-implicit  (+3091840)
    //     claude-desktop-3p              (+3091371)

    // Load config for the current session
    sessionConfig = loadConfigForSession(configWatcher)   // Dt, +12506605

    return buildPassesJSXElement(accountCtx, sessionConfig)
```

Analysis basis: CC v2.1.197 bundle.js:+12506557, +12862654

---

### 7. Config Synchroniser (`Dt`)

`Dt` is the shared config synchroniser called by both `Mir` and `Hn`. It coordinates file watching with in-memory state:

```
function configSynchroniser(context):
    configPath   = resolveConfigPath()                    // qt,  +14159743
    baseDir      = getBaseDir()                           // w0,  +14159757
    sessionLabel = getSessionLabel()                      // dqo, +14159776
    loaderHandle = configLoader()                         // lIt, +14159780

    startTime    = Date.now()                             // +14159833
    fileState    = initFileWatcher()                      // Fdm, +14159886

    return { configPath, baseDir, loaderHandle, fileState }
```

Analysis basis: CC v2.1.197 bundle.js:+14159743

---

### 8. File State Initialiser (`Fdm`)

```
function initFileWatcher(context):
    baseDir      = getBaseDir()                           // w0,  +14159256
    watchSpec    = buildWatchSpec()                       // bRt, +14159261
    //   bRt normalises identifiers to lowercase (n → i.toLowerCase, +18067314)
    //   and registers file-watch callbacks (ke → Evs.watchFile, +1151130)

    configPath   = resolveConfigPath()                    // qt,  +14159332
    stateHelper  = getStateHelper()                       // $a,  +14159415
    keyNormalizer = normalizeKeys()                       // q5,  +14159418
    sessionLabel  = getSessionLabel()                     // dqo, +14159479
    rangeHelper   = getRangeHelper()                      // rge, +14159487

    // Register lifecycle hook
    lifecycleHook = registerHook()                        // vi → yis.register, +14159569

    // Unwatch previous path on teardown
    teardown = () => vmc.unwatchFile(configPath)          // +14159582

    return { watchSpec, configPath, lifecycleHook, teardown }
```

Analysis basis: CC v2.1.197 bundle.js:+14159256

---

### 9. Global Config Fallback Write (`vdr` sub-path)

When the main save path cannot proceed (e.g., lock not available), a fallback global-config write is attempted:

```
function fallbackGlobalConfigWrite(configPath, data):
    // Only triggers when main path would wipe authenticated config
    // "saveGlobalConfig fallback: re-read config is missing auth…" (+14157946)
    emit telemetry("tengu_config_fallback_write")         // +14160796
    tag = "save_global"                                   // +14158192
    writeGlobalConfig(configPath, data)
```

Analysis basis: CC v2.1.197 bundle.js:+14160796

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_guest_passes_visited` | Fired immediately on command invocation (bundle.js:+12862760) |
| Telemetry: `tengu_config_parse_error` | Fired when the config JSON file cannot be parsed (bundle.js:+14164913) |
| Telemetry: `tengu_config_lock_contention` | Fired when config file lock takes longer than expected (bundle.js:+14161180) |
| Telemetry: `tengu_config_stale_write` | Fired when a re-read reveals a version older than the in-memory cache (bundle.js:+14161316) |
| Telemetry: `tengu_config_auto_repaired` | Fired when a JSON parse error triggers auto-repair from cached config (bundle.js:+14161693) |
| Telemetry: `tengu_config_auth_loss_prevented` | Fired when a write is blocked to prevent loss of auth credentials (bundle.js:+14162023) |
| Telemetry: `tengu_config_fallback_write` | Fired when the global-config fallback write path is used (bundle.js:+14160796) |
| Telemetry: `tengu_daemon_control` | Fired in the daemon lifecycle path reachable through deep config calls (bundle.js:+18076516) |
| Hook registration | `vi` registers a lifecycle hook via `yis.register` (bundle.js:+68542) |
| File watching | `bRt` + `Evs.watchFile` registers a filesystem watch on the config path; `vmc.unwatchFile` tears it down (bundle.js:+1151130, +14159582) |
| Config file writes | Atomic temp-file → rename via `mRt` / `Lf.writeFileSync` + `Lf.fsyncSync` + `r.renameSync` (bundle.js:+1107957, +1108166, +1108512) |
| Backup creation | Up to 5 `.backup.*` snapshots kept in the `backups/` subdirectory of the config dir (bundle.js:+14163067, +14162345, +14162484) |
| File mode | Saved config files are written with mode `0o600` (decimal 384) (bundle.js:+14162766) |
| appState changes | State slot `V` is updated with the loaded guest-pass data (bundle.js:+12862758) |
| JSX render | `VXl.jsx` is called to render the passes panel into the CLI display (bundle.js:+12862809) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.197 | Initial analysis |

---

## Common Mistakes

1. **Expecting a model response**: `/passes` is a `local-jsx` command and does not send any prompt to the Claude model. Invoking it will not start an AI conversation turn.
2. **Assuming it works offline without config**: The command reads the persisted `~/.claude.json` config to resolve account and pass state. If the config file is absent or corrupt, the command will auto-repair from cache, but may show no passes until the file is re-validated.
3. **Confusing `/passes` with subscription management**: The command surfaces free *guest* passes to share with others, not the user's own billing or subscription settings.
4. **Triggering on lock contention**: If another Claude Code instance holds the config lock, the command may log a warning about lock acquisition delay (`tengu_config_lock_contention`). This is not a bug but expected concurrent-access behaviour.
5. **Unexpected backup files**: Every invocation path that touches the config layer may write a new `.backup.<timestamp>` file in the `backups/` directory. Only the 5 most recent backups are retained (bundle.js:+14162484).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `S7f` | Top-level passes command handler (AsyncFunction) |
| `Dt` | Config synchroniser; coordinates file watcher with in-memory state |
| `qt` | Config path resolver utility |
| `dqo` | Session label getter |
| `lIt` | Config loader (reads, parses, backs up config JSON) |
| `vs` | CLI error handler (calls `process.exit`) |
| `Gt` | Safe JSON parse wrapper |
| `q5` | Key normaliser (strips known prefixes via `startsWith`/`slice`) |
| `rn` | Serialisation/write helper |
| `mqo` | Backup directory scanner |
| `hqo` | Backup path builder (uses `path.join` + `Zn`) |
| `T` | Content hasher / schema migrator |
| `deu` | Migration sub-routine |
| `Me` | JSON stringify wrapper |
| `Pc` | Key/header sanitiser (`[REDACTED]` masking, `scs`) |
| `KQe` | Locale-aware formatter (uses `zls`) |
| `geu` | File upload/transfer helper (uses `Buffer.byteLength`, `mln.then`) |
| `m` | Config array filter helper |
| `e_r` | String prefix normaliser (`startsWith`/`slice`/`replace`) |
| `R` | File system watcher with interval polling (`setInterval`/`clearInterval`, `O.watch`) |
| `V` | App state slot accessor |
| `Fdm` | File state initialiser (sets up watch spec, lifecycle hooks) |
| `bRt` | Watch spec builder (normalises identifiers to lowercase, calls `Evs.watchFile`) |
| `n` | Lowercase normaliser (`i.toLowerCase`) |
| `ke` | File-watch callback registration helper |
| `rge` | Range helper utility |
| `vi` | Lifecycle hook registrar (calls `yis.register`) |
| `Mir` | Passes UI factory (resolves account context, builds JSX element) |
| `Nc` | Account context resolver |
| `aE` | Auth method dispatcher (API key / OAuth / helper) |
| `yd` | Auth credential reader |
| `ub` | OAuth profile builder |
| `Lc` | First-party credential loader |
| `lI` | Config field accessor |
| `TH` | Session auth handler (dispatches on `ANTHROPIC_API_KEY`, `apiKeyHelper`, `none`) |
| `AUt` | Auth utility (delegates to `Jst`) |
| `Jst` | JWT/session token helper |
| `Hn` | Config file watcher setup (returns entry map, timestamp, loader, watcher) |
| `rtn` | `saveConfigWithLock` — atomic config save with lock, backup, and safety checks |
| `s` | Async resource tracker (`r.add`, `i.finally`, `r.delete`) |
| `i` | Connection/stream lifecycle manager (`n.close`, `r.close`) |
| `nci` | Lock acquisition wrapper |
| `b4r` | Lock primitive (delegates to `tci`) |
| `cIt` | Change tracker / diff utility |
| `v` | Entry filter (`v.startsWith`) |
| `y` | Message/event queue helper |
| `lqe` | Teammate mailbox manager (`markMessagesAsRead`) |
| `I` | Scroll/position calculator (`Math.max`, `Math.floor`) |
| `M` | HTTP gateway request handler (OAuth, device flow, inference proxy) |
| `A` | Userinfo fetcher |
| `mRt` | Atomic file write utility (temp → rename, `writeFileSync` + `fsyncSync`) |
| `Gd` | Real-path resolver (`e.realpathSync`, `jE`, `YLt`) |
| `u` | Daemon lifecycle controller |
| `Sn` | Serialisation helper (uses `rn`) |
| `rtt` | Error code classifier (`EINVAL`, `ENOTSUP`, `EPERM`, `ENOSYS`) |
| `oRr` | Rename-conflict handler (`ATs`, `oUu`) |
| `nIs` | Property descriptor helper (`Object.defineProperty`) |
| `zUe` | Session ID builder |
| `pqo` | Entry map builder (`Object.entries`) |
| `ttn` | Timestamp utility (`Date.now`) |
| `etn` | Loader function wrapper (delegates to `lIt` and `w0`) |
| `vdr` | File watcher / diff engine; also hosts global-config fallback write |
| `Oe` | Platform overlay hook registrar |
| `$Xe` | Platform overlay implementation |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.