---
type: feature-spec
feature: "passes"
cc_version: "2.1.179"
updated: "2026-06-19"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.179 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.179 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.179

---

## Overview

The `/passes` command presents a UI screen that allows users to share a free week of Claude Code with friends (guest passes). It renders a JSX component and fires a telemetry event (`tengu_guest_passes_visited`) when the screen is opened. The command is implemented as a `local-jsx` type, meaning its output is a React/JSX element rather than a text prompt.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| loc_byte | `12856348` |
| loc_byte_end | `12856670` |
| loc_line | `8797` |
| isHidden | `null` (not hidden) |
| module_id | `YXK` |
| load_inline | `true` |
| arbor_handler.name | `q15` |
| arbor_handler.fqn | `claude-2.1.179::q15` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.179 bundle.js:+12856348

---

## Input Branching

The command has a simple linear flow — it fires telemetry, reads state, and returns a JSX element. No multi-branch input dispatch is required; numbered pseudocode suffices.

1. User invokes `/passes` in the Claude Code CLI.
2. The async handler (`q15`) is called.
3. The handler calls the config/state reader (`h6`) to obtain the current application state and session context.
4. The handler calls the background-session state helper (`Od8`) to retrieve any relevant background or daemon session data.
5. The handler reads the current UI state reference (`d`).
6. Telemetry event `tengu_guest_passes_visited` is emitted (Analysis basis: CC v2.1.179 bundle.js:+12856171).
7. The handler calls `CXA.createElement` to construct and return the JSX UI component for the guest passes screen (Analysis basis: CC v2.1.179 bundle.js:+12856220).
8. The rendered component is displayed to the user.

---

## Behavioral Spec

### Main Handler — Guest Passes Screen Renderer

```
async function guestPassesHandler(commandContext):
    # Step 1: Load application config and session state
    appState = readConfigAndState(commandContext)        # h6

    # Step 2: Load background/daemon session state
    bgSessionData = loadBackgroundSessionState(appState) # Od8 → E4, h6

    # Step 3: Obtain current UI state reference
    uiStateRef = getCurrentUIState()                     # d

    # Step 4: Emit telemetry for screen visit
    emit("tengu_guest_passes_visited")

    # Step 5: Build and return JSX component
    element = createElement(GuestPassesComponent, {
        appState: appState,
        bgSessionData: bgSessionData,
        uiState: uiStateRef
    })
    return element
```

Analysis basis: CC v2.1.179 bundle.js:+12856031 (q15→h6), +12856065 (q15→Od8), +12856169 (q15→d), +12856171 (telemetry), +12856220 (createElement)

---

### Config / State Reader (`h6`)

```
function readConfigAndState(context):
    # Reads project config (c6), platform info (iy_),
    # and invokes the config-file loader (r5H)
    configData  = readProjectConfig()                   # c6
    platformCtx = getPlatformContext()                  # iy_
    fileConfig  = loadConfigFromFile(configData)        # r5H
    timestamp   = Date.now()
    watchHandle = watchConfigFile(fileConfig)           # brf
    return { configData, platformCtx, fileConfig, timestamp, watchHandle }
```

Analysis basis: CC v2.1.179 bundle.js:+3396449 (h6→c6), +3396463 (h6→PT), +3396482 (h6→iy_), +3396486 (h6→r5H), +3396539 (h6→Date.now), +3396592 (h6→brf)

---

### Config File Loader (`r5H`)

```
function loadConfigFromFile(configData):
    # Guards against premature config access
    if configAccessedBeforeAllowed:
        throw new Error("Config accessed before allowed.")  # loc: +3399762

    raw = fs.readFileSync(configPath, "utf-8")              # loc: +3399818, +3399845
    parsed = parseJSON(raw)                                 # l6 → JSON.parse, loc: +3399865
    prefixStripped = stripVersionPrefix(parsed)             # Vm, loc: +3399868

    # Enumerate backup files (fM9)
    backupFiles = listBackupFiles(configData)               # loc: +3400008

    # Build normalized config object (N)
    normalizedConfig = normalizeConfig(parsed, backupFiles) # loc: +3400243

    # Validate filesystem state
    stat = fs.statSync(configPath)                          # loc: +3400353
    # Create backup directory if absent
    backupDir = path.basename(configPath)                   # loc: +3400545
    fs.mkdirSync(backupDir, { recursive: true })            # loc: +3400572

    # Copy config to timestamped backup
    timestamp = Date.now()                                  # loc: +3400883
    backupPath = path.join(backupDir, String(timestamp))
    fs.copyFileSync(configPath, backupPath)                 # loc: +3400901

    return normalizedConfig

# Error codes encountered in this path:
#   "ENOENT"  → config file not found (loc: +3399992)
#   "EEXIST"  → backup dir already exists (loc: +3400607)
#   "error"   → generic config error level (loc: +3400313)
```

Analysis basis: CC v2.1.179 bundle.js:+3399756 (Error), +3399803 (c6), +3399818 (readFileSync), +3399845 ("utf-8"), +3399865 (l6/JSON.parse), +3399868 (Vm), +3400008 (fM9), +3400243 (N), +3400353 (statSync), +3400572 (mkdirSync), +3400901 (copyFileSync)

---

### Background Session State Loader (`Od8`)

```
async function loadBackgroundSessionState(appState):
    # Delegates to the background session initializer (E4)
    # which sets up the session watcher (aw → kO → Uj → ...)
    # and the config lock/state helper (h6)
    bgInit   = await initBackgroundSession(appState)   # E4 → aw
    stateRef = readConfigAndState(appState)            # h6
    return { bgInit, stateRef }
```

Analysis basis: CC v2.1.179 bundle.js:+12484205 (Od8→E4), +12484253 (Od8→h6), +3350074 (E4→aw), +3350079 (E4→h6)

---

### Config File Watcher (`brf`)

```
function watchConfigFile(configPath, context):
    platform = getPlatformContext()                 # PT
    fs.watchFile(configPath, callback)              # oO8.watchFile, loc: +3395952
    # On change: re-check version prefix (Vm), update context (iy_)
    # Schedule callback (kg), register cleanup (U9 → oSA.register)
    # On stop: fs.unwatchFile(configPath)           # loc: +3396285
    return watchHandle
```

Analysis basis: CC v2.1.179 bundle.js:+3395947 (brf→PT), +3395952 (watchFile), +3396121 (Vm), +3396183 (iy_), +3396191 (kg), +3396272 (U9), +3396285 (unwatchFile)

---

### Config Normalization (`N`)

```
function normalizeConfig(raw, backupFiles):
    # Detect debug mode
    if raw includes "debug": setDebugLevel("debug")         # loc: +212758, +212822

    # Serialize sensitive fields
    serialized = serializeSensitive(raw)                    # bH → JSON.stringify

    # Upper-case certain identifiers
    upper = raw.toUpperCase()                               # loc: +212884

    # Apply field-level transformations (g4: redact, replace, slice)
    transformed = transformFields(upper)                    # g4, loc: +212904
    # "[REDACTED]" substitution applied to sensitive values  # loc: +204111

    # Validate and normalize sub-fields (ydH, aM4, kk)
    validated = validateSubfields(transformed)

    # Buffer byte-length check
    byteLen = Buffer.byteLength(validated)                  # loc: +212478

    return validated
```

Analysis basis: CC v2.1.179 bundle.js:+212782 (N→cNH), +212800 (N→nM4), +212822 (H.includes), +212840 (N→bH), +212884 (toUpperCase), +212904 (g4), +212923 (kk), +212929 (ydH), +212943 (aM4)

---

### Save Config with Lock (`eO8` / `tO8`)

Called transitively when config needs to be persisted from the background session path.

```
async function saveConfigWithLock(config, context):
    dir = path.dirname(configPath)                       # loc: +3397524
    fs.mkdirSync(dir, { recursive: true })               # loc: +3397545
    lockTimestamp = Date.now()                           # loc: +3397590

    # Acquire config lock (RC1)
    lock = await acquireConfigLock()                     # RC1, loc: +3397603
    # If contention, emit telgu_config_lock_contention  # loc: +3397818
    # (message: "Lock acquisition took longer than expected…" loc: +3397729)

    # Re-read config to detect stale write
    reRead = readConfigFromDisk()                        # N, loc: +3397645
    if reRead missing auth that cache has:
        # Refuse write to protect auth; emit tengu_config_auth_loss_prevented
        # (message: "saveConfigWithLock: re-read config is missing auth…" loc: +3398145)
        return

    # Atomic copy+replace cycle
    backup = makeBackup(configPath)                      # r5H, loc: +3398107
    path.copyFileSync(src, tmpPath)                      # loc: +3398722
    # Keep at most 5 backups                             # loc: +3398748
    removeOldBackups()                                   # Z.slice + f.unlinkSync

    # Write via atomic rename helper (ED6)
    atomicWrite(config, configPath)                      # ED6, loc: +3398988

    return

# Key safety guard:
# "saveConfigWithLock: re-read config is missing auth that cache has;
#  refusing to write to avoid wiping ~/.claude.json. See GH #3117."  (loc: +3398145)
# "saveGlobalConfig fallback: re-read config is missing auth that cache
#  has; refusing to write. See GH #3117."                            (loc: +3394681)
```

Analysis basis: CC v2.1.179 bundle.js:+3397524, +3397545, +3397590, +3397603, +3397645, +3397729, +3397818, +3398107, +3398145, +3398297, +3398722, +3398748, +3398866, +3398988

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_guest_passes_visited` (loc:+12856171) — fired on every invocation of `/passes` |
| Telemetry (transitive — config path) | `tengu_config_parse_error` (loc:+3400393), `tengu_config_lock_contention` (loc:+3397818), `tengu_config_stale_write` (loc:+3397954), `tengu_config_auth_loss_prevented` (loc:+3398297), `tengu_config_fallback_write` (loc:+3397434) |
| Telemetry (transitive — bg daemon path) | `tengu_bg_spare_enable` (loc:+17068607), `tengu_bg_spare_claim` (loc:+17068735), `tengu_bg_spare_claim_fail` (loc:+17069001), `tengu_bg_dispatch_sigkill_escalate` (loc:+17067302), `tengu_bg_dispatch_low_mem` (loc:+17067903), `tengu_bg_sendclaim_failed` (loc:+17043852), `tengu_bg_low_mem_mb` (loc:+13454570), `tengu_bg_attach` (loc:+17058532), `tengu_bg_proto_mismatch` (loc:+17053087), `tengu_feature_ok` (loc:+1020479), `tengu_feature_bad` (loc:+1020546), `tengu_scheduled_task_missed` (loc:+16544540), `tengu_bg_dispatch_stale_drop` (loc:+17054486), `tengu_bg_attach_legacy_autorespawn` (loc:+17057374), `tengu_bg_attach_stall_gave_up` (loc:+17059455), `tengu_bg_attach_stall_respawn` (loc:+17059725), `tengu_bg_attach_kick` (loc:+17060717) |
| Hook registration | Config file watcher registered via `oSA.register` (cleanup hook, loc:+66377); `fs.watchFile` / `fs.unwatchFile` on the config path (loc:+3395952, +3396285) |
| appState changes | Reads and potentially refreshes the global config cache; may write a timestamped backup of `~/.claude.json` (loc:+3400901); may update session roster entry (`_.rosterEntry`, loc:+17074935) |
| Output type | Returns a JSX element (`CXA.createElement`, loc:+12856220) — rendered in the CLI's React-based UI |
| Sound | None detected in depth-2 traversal |
| Config backup limit | Maximum 5 backup files retained (literal `5`, loc:+3398748) |
| Config access guard | Throws `"Config accessed before allowed."` if accessed prematurely (loc:+3399762) |
| Auth-loss guard | Refuses to write config if re-read is missing auth fields present in cache (loc:+3398145, GH #3117) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.179 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/passes` before authentication is complete** — the config reader (`r5H`) throws `"Config accessed before allowed."` if called too early in the startup sequence. Ensure the CLI has fully initialized before issuing this command.
2. **Expecting text output** — `/passes` is type `local-jsx`, so it renders a UI component rather than printing text. Piping or scripting the output will not yield usable data.
3. **Assuming no side effects** — even a read-only invocation of `/passes` triggers config file reading, a backup copy, and a file watcher registration, in addition to the `tengu_guest_passes_visited` telemetry event.
4. **Confusing backup behavior** — the command's config path creates timestamped backups in the backup directory but retains only the 5 most recent (literal `5`, loc:+3398748). Older backups are silently removed.
5. **Expecting the command to work in non-interactive / `--bare` mode** — the JSX renderer requires the full TUI context; the `--bare` flag (loc:+68521) may suppress or break rendering.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `q15` | Main async handler for `/passes` (guest passes screen renderer) |
| `h6` | Config and session state reader |
| `c6` | Project config accessor |
| `iy_` | Platform/context descriptor |
| `r5H` | Config file loader (reads, parses, backs up config) |
| `q` | Node.js `fs`-like module (readFileSync, statSync, mkdirSync, etc.) |
| `p1` | Process exit / CLI error handler |
| `l6` | JSON parse wrapper |
| `Vm` | Version prefix strip/check utility |
| `H` | Random/timer utility (Math.random, setTimeout); also string-method target in various contexts |
| `_` | Filesystem utility (readdirStringSync, statSync, toUpperCase) |
| `G8` | General utility / helper (called from r5H and eO8) |
| `fM9` | Backup file lister |
| `ay_` | Backup directory path builder |
| `M` | Model/feature-flag registry |
| `$` | Path/config helper with startsWith checks |
| `N` | Config normalizer |
| `nM4` | Config sub-normalizer (calls hk, N__, sSA) |
| `bH` | JSON serializer (JSON.stringify wrapper) |
| `g4` | Field transformer / redactor |
| `ydH` | Sub-field validator (calls GbA) |
| `aM4` | Auth field normalizer (Buffer.byteLength, path.dirname, etc.) |
| `d` | UI state reference / generic state object |
| `D` | Background session / daemon dispatcher |
| `A` | Session/process map (toLowerCase, get, set, values) |
| `b` | Scheduled task runner |
| `n8` | Timeout/abort utility |
| `CH` | Feature flag "bad" reporter |
| `IH` | Feature flag "ok" reporter |
| `il8` | Low-memory detector (macOS) |
| `oRH` | Daemon job file cleanup helper |
| `SH` | Daemon session cleanup / log-error utility |
| `g` | Session retire-if-settled utility |
| `Y6` | Background session state getter |
| `_kA` | Daemon socket claim/connect handler |
| `MkA` | Daemon job lifecycle manager |
| `f` | Promise-tracked job set manager |
| `Y` | Forced shutdown / process.exit handler |
| `QH` | Cleanup/dispose helper (calls n36) |
| `B` | Disposable resource handle |
| `brf` | Config file watcher registrar |
| `kg` | Watch callback scheduler |
| `U9` | Cleanup hook registrar (oSA.register) |
| `Od8` | Background session state loader (delegates to E4 and h6) |
| `E4` | Background session initializer |
| `aw` | Session watcher setup (ZL, Uj, $4, tA, lP, kO, PG6, JsH) |
| `ZL` | Session watcher factory (f6, bn6) |
| `Uj` | Session watcher instance (Uq8, ZL, JsH, dF, nV, f6, gF, etc.) |
| `$4` | OAuth/firstParty auth helper |
| `lP` | Login profile helper |
| `kO` | Session lifecycle orchestrator |
| `PG6` | Profile watcher creator |
| `JsH` | Watcher file helper (f6, x_H) |
| `J8` | Config save/lock entry point |
| `eO8` | Save-config-with-lock implementation |
| `RC1` | Config lock acquirer (x2_ → SC1, Object.assign) |
| `x2_` | Lock state initializer (SC1) |
| `RsH` | Auth-loss guard checker |
| `v` | Scroll/viewport math utility |
| `S` | Terminal input handler |
| `Z` | Viewport size calculator |
| `P` | IPC/socket buffer handler |
| `X` | Socket connection manager |
| `j` | Session kill dispatcher |
| `cL` | IPC channel cleanup handler |
| `qx5` | Daemon protocol message dispatcher |
| `GH` | String coercion helper |
| `ED6` | Atomic file write helper (symlink-safe rename) |
| `O` | Background session descriptor |
| `x8` | General error code helper |
| `L` | Socket/stream connection object |
| `rXH` | Config read helper |
| `KM9` | Config entries enumerator (Object.entries) |
| `pG6` | Config timestamp tracker (Date.now) |
| `tO8` | Global config save fallback handler |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.