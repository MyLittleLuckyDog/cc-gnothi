---
type: feature-spec
feature: "passes"
cc_version: "2.1.187"
updated: "2026-06-24"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.187 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.187 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.187

---

## Overview

The `/passes` command presents a UI for users to share a free week of Claude Code with friends (a "guest pass" feature). When invoked, it fires a telemetry event (`tengu_guest_passes_visited`) and renders a JSX component (`wxl.jsx`) that surfaces the pass-sharing interface. The handler is an async function that wires up configuration reading, global config state, and background daemon hooks before mounting the interactive panel.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| loc_byte | `12478081` |
| loc_byte_end | `12478403` |
| loc_line | `8450` |
| isHidden | `null` (not hidden) |
| module_id | `vxl` |
| load_inline | `true` |
| arbor_handler.name | `Ohf` |
| arbor_handler.fqn | `claude-2.1.187::Ohf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.187 bundle.js:+12478081

---

## Input Branching

The command has a relatively linear activation flow (no user-supplied argument branching), but the handler transitions through several initialization stages before rendering the JSX panel. Two internal branches are noteworthy: (1) the global-config load path (which may encounter auth loss or lock contention) and (2) the background daemon claim path (spare session claim success vs. failure). Because these represent exactly two substantive branching paths, numbered pseudocode is appropriate.

1. Handler (`Ohf`) is invoked by the CLI dispatcher (no user arguments accepted).
2. Telemetry event `tengu_guest_passes_visited` is emitted immediately.
3. Config subsystem (`hn`) is initialized: reads global config (`n0`), resolves per-environment state, and checks the config lock.
   - If lock contention is detected → logs `tengu_config_lock_contention`, continues with a warning.
   - If auth data would be lost on write → logs `tengu_config_auth_loss_prevented`, aborts the write.
4. Background session state is probed via `Dt` (config read + file-system state resolver `_Ee`).
5. JSX panel (`wxl.jsx`) is rendered and returned to the CLI shell via `W`.

---

## Behavioral Spec

### Top-level handler — `guestPassesHandler` (`Ohf`)

```
async function guestPassesHandler(context):
    emit_telemetry("tengu_guest_passes_visited")          // bundle.js:+12477914
    configState  = await initConfigSubsystem(context)     // hn @ +12477814
    sessionState = await readSessionConfig(context)       // n7n @ +12477808
    jsxElement   = buildPassesPanel(configState,          // wxl.jsx @ +12477963
                                    sessionState)
    return renderJSX(jsxElement)                          // W @ +12477912
```

Analysis basis: CC v2.1.187 bundle.js:+12477774

---

### Config subsystem initializer — `configSubsystemInit` (`hn`)

```
function configSubsystemInit(context):
    globalConfig = readGlobalConfig(context)              // n0 @ +13746878
    envState     = resolveEnvironmentState(context)       // ADe @ +13746930
    perEnvMap    = buildPerEnvMap(context)                // DOo @ +13746949
    timestamp    = getModTimestamp(context)               // MKt @ +13746974

    if authWouldBeLost(globalConfig):
        log("saveGlobalConfig fallback: re-read config…") // +13747081
        emit_telemetry("tengu_config_auth_loss_prevented")

    fileState = readAndMergeFileState(context)            // _Ee @ +13747055
    lockState = acquireConfigLock(context)                // MHt @ +13747071

    if lockContention(lockState):
        emit_telemetry("tengu_config_lock_contention")   // +13750291
        warn("Lock acquisition took longer than expected…") // +13750202

    return buildConfigSave(context, fileState)            // BQn @ +13747321
```

Analysis basis: CC v2.1.187 bundle.js:+13746874

---

### Session config reader — `sessionConfigReader` (`n7n`)

```
async function sessionConfigReader(context):
    sessionData = await loadSessionData(context)          // hc @ +12125585
    configData  = await readConfigForSession(context)     // Dt @ +12125633
    return merge(sessionData, configData)
```

Analysis basis: CC v2.1.187 bundle.js:+12477808

---

### Config file state resolver — `configFileStateResolver` (`_Ee`)

```
function configFileStateResolver(paths, opts):
    if not configAccessAllowed():
        throw Error("Config accessed before allowed.")    // +13752235

    raw = fs.readFileSync(configPath, "utf-8")            // +13752291 / +13752318

    parsed = safeJsonParse(raw)                           // Gt @ +13752338

    if parsed.code === "ENOENT":                          // +13752465
        return defaultConfig()

    prefixStripped = stripPrefix(parsed)                  // u9 @ +13752341
    normalized     = normalizeFields(prefixStripped)      // T @ +13752716
    backupDir      = resolveBackupDir(paths)              // HGl @ +13752481

    try:
        stat = fs.statSync(configPath)                    // +13752826
    except err:
        if err.code === "error":                          // +13752786
            emit_telemetry("tengu_config_parse_error")    // +13752866

    return { normalized, backupDir }
```

Analysis basis: CC v2.1.187 bundle.js:+13747055

---

### Config save with lock — `configSaveWithLock` (`BQn`)

```
async function configSaveWithLock(ctx):
    timestamp = getModTimestamp()                         // MKt @ +13749630
    globalCfg = readGlobalConfig()                        // n0 @ +13749656
    configDir = path.dirname(configPath)                  // IS.dirname @ +13749676

    atomicWritten = atomicWrite(configDir, configData)    // oIt @ +13749728

    if fallbackNeeded(atomicWritten):
        emit_telemetry("tengu_config_fallback_write")     // +13749907

    if writeMissingAuth(configData):
        emit_telemetry("tengu_config_stale_write")        // +13750427
        warn("saveConfigWithLock: re-read config …")      // +13750618

    return configData
```

Analysis basis: CC v2.1.187 bundle.js:+13747321

---

### Global config reader — `globalConfigReader` (`Dt`)

```
function globalConfigReader(opts):
    raw       = readRawConfig(opts)                       // Wt @ +13748883
    parsed    = parseConfigRaw(raw)                       // n0 @ +13748897
    validated = validateConfig(parsed)                    // MOo @ +13748916
    fileState = resolveFileState(validated)               // _Ee @ +13748920
    timestamp = Date.now()                                // +13748973
    watcher   = installFileWatcher(opts)                  // MRf @ +13749026
    return { validated, fileState, watcher }
```

Analysis basis: CC v2.1.187 bundle.js:+13748883

---

### Backup-directory resolver — `backupDirResolver` (`HGl`)

```
function backupDirResolver(configPath, opts):
    base    = path.basename(configPath)                   // IS.basename @ +13751843
    backups = path.join(configDir, "backups")             // NOo @ +13751860 / "backups" @ +13751803
    entries = fs.readdirStringSync(backups)               // +13751876

    for entry in entries:
        if entry.startsWith(".backup."):                  // +13751088 / +13751911
            fullPath = path.join(backups, entry)          // IS.join @ +13751967
            parent   = path.dirname(fullPath)             // IS.dirname @ +13751993
            stat     = fs.statSync(fullPath)              // +13752152
            if stat.isSymbolicLink():
                continue
            collect(entry)

    keep = entries.slice(-5)                              // numeric limit 5 @ +13751221
    return keep
```

Analysis basis: CC v2.1.187 bundle.js:+13752481

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_guest_passes_visited` | Fired immediately on command invocation (bundle.js:+12477914) |
| Telemetry — `tengu_config_parse_error` | Fired when config JSON parse fails (bundle.js:+13752866) |
| Telemetry — `tengu_config_lock_contention` | Fired when config lock acquisition is slow (bundle.js:+13750291) |
| Telemetry — `tengu_config_stale_write` | Fired when a stale config write is detected (bundle.js:+13750427) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a write that would erase auth is suppressed (bundle.js:+13750770) |
| Telemetry — `tengu_config_fallback_write` | Fired when atomic write falls back (bundle.js:+13749907) |
| Telemetry — `tengu_bg_spare_enable` | Fired by background-session subsystem if a spare session is enabled (bundle.js:+17197361) |
| Telemetry — `tengu_bg_spare_claim` | Fired when a spare background session is successfully claimed (bundle.js:+17197489) |
| Telemetry — `tengu_bg_spare_claim_fail` | Fired when spare claim fails (bundle.js:+17197755) |
| Config file read | `fs.readFileSync` on the global config path with `"utf-8"` encoding (bundle.js:+13752291) |
| Config file write (atomic) | Atomic rename-based write via `oIt`; falls back to in-place on failure (bundle.js:+13749728) |
| Backup directory | Up to 5 backup entries are retained under a `backups/` subdirectory; entries prefixed `.backup.` (bundle.js:+13751803, +13751221) |
| Config file watcher | `mis.watchFile` installed via `MRf`/`fIt`; unwatched via `_Gl.unwatchFile` (bundle.js:+13748719) |
| JSX render | `wxl.jsx` component mounted and returned as the command's output (bundle.js:+12477963) |
| appState changes | Global config cache updated; auth-loss guard prevents overwriting cached auth (bundle.js:+13750770) |
| Sound | None observed in traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.187 | Initial analysis |

---

## Common Mistakes

1. **Expecting argument parsing** — `/passes` accepts no user-supplied arguments. Any text typed after the command name is ignored; the command renders the JSX panel unconditionally.
2. **Assuming instant config availability** — the handler initializes config asynchronously and guards against pre-allowed access (error string: `"Config accessed before allowed."` at bundle.js:+13752235). Invoking the underlying config API before the guard clears will throw.
3. **Confusing the backup limit** — only the 5 most-recent `.backup.*` entries are kept (bundle.js:+13751221). Older backups are pruned automatically; do not rely on older snapshots persisting.
4. **Ignoring auth-loss prevention** — if a re-read of the config file is missing auth data that the in-memory cache holds, the write is silently suppressed (telemetry: `tengu_config_auth_loss_prevented`). A tool writing config externally in parallel with `/passes` may see its write dropped to protect credentials.
5. **Expecting synchronous config saves** — config writes go through a lock and an atomic-rename sequence (`oIt`); under contention, the fallback write path is taken, which fires `tengu_config_fallback_write`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Ohf` | Top-level async handler for `/passes` (guestPassesHandler) |
| `Dt` | Global config reader |
| `Wt` | Raw config reader / path resolver utility |
| `MOo` | Config validator |
| `_Ee` | Config file state resolver |
| `r` | Node `fs`-compatible sync filesystem module |
| `Is` | Process-exit / CLI error wrapper |
| `Gt` | Safe JSON parser |
| `u9` | String prefix stripper |
| `e` | Timer / random utility (Math.random + setTimeout) |
| `t` | General context/option object |
| `cn` | Common notification / channel utility |
| `HGl` | Backup-directory resolver |
| `NOo` | Path join helper (wraps `IS.join`) |
| `a` | Session map / registry accessor |
| `l` | Symlink / path entry checker |
| `T` | Field normalizer / type coercer |
| `Xwc` | Sub-field extractor for normalized config |
| `Me` | JSON stringifier wrapper |
| `wc` | String replacer / redactor (produces `[REDACTED]`) |
| `dze` | Debug-log formatter |
| `eLc` | File content loader with byte-length check |
| `W` | JSX render / output emitter |
| `f` | Background-session dispatcher / worker manager |
| `n` | Worker name map / lowercase normalizer |
| `D` | Background worker process supervisor |
| `Kn` | Async timeout/abort utility |
| `Re` | Feature telemetry OK reporter (`tengu_feature_ok`) |
| `Le` | Feature telemetry bad reporter (`tengu_feature_bad`) |
| `GXn` | macOS low-memory checker |
| `N2e` | Async file lstat / rm / read helper |
| `ke` | Session keep-alive / watchdog |
| `U` | Daemon idle-exit / retire-if-settled manager |
| `it` | File-type / extension classifier |
| `C3o` | Daemon socket claim / connect handler |
| `x3o` | Background job lifecycle manager (state.json, roster) |
| `s` | Shared add/delete set (mirrors `x3o`) |
| `p` | Forced shutdown / process.exit wrapper |
| `Pe` | Promise / async resolver |
| `F` | Interval disposer (clearInterval) |
| `MRf` | Config file watcher installer |
| `fIt` | `watchFile` wrapper |
| `uV` | Config value unboxer |
| `Ei` | Event registrar (`b6o.register`) |
| `n7n` | Session config reader (loads session + config data) |
| `hc` | Session data loader |
| `ay` | Auth profile loader |
| `Ad` | Node/GXT init helper (`--bare` flag) |
| `cA` | OAuth / API-key profile resolver |
| `Nl` | First-party auth resolver |
| `tT` | Terminal type resolver |
| `Yg` | Auth gate / credential check |
| `Zkt` | uZe bootstrap helper |
| `uZe` | Node init / xK accessor |
| `hn` | Config subsystem initializer |
| `GQn` | Config-with-lock writer / atomic rename orchestrator |
| `_Ws` | Config object assign wrapper |
| `jRr` | HWs-based config builder |
| `MHt` | Config lock state holder |
| `I` | Input event / scroll position handler |
| `x` | Terminal write / W wrapper |
| `A` | Viewport bounds calculator |
| `H` | IPC socket / buffer stream handler |
| `g` | Socket timeout / subarray reader |
| `m` | Worker kill map |
| `mp` | Socket end / Me writer |
| `bJf` | Daemon IPC protocol dispatcher (ping, nudge, attach, reply, etc.) |
| `be` | String coercion wrapper |
| `oIt` | Atomic file write with temp-file rename |
| `Nd` | Realpath / lstat resolver |
| `u` | Daemon stop / CU / X6 lifecycle controller |
| `kn` | Notification channel (`cn`) wrapper |
| `i` | Socket close / stream state manager |
| `E7e` | fsync error-code filter (EINVAL, ENOTSUP, EPERM, ENOSYS) |
| `ADe` | Environment state resolver |
| `DOo` | Per-env config map builder (Object.entries) |
| `MKt` | Modification timestamp reader (Date.now) |
| `BQn` | Config-save-with-lock orchestrator |