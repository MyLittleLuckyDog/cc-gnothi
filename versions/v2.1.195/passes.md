---
type: feature-spec
feature: "passes"
cc_version: "2.1.195"
updated: "2026-06-27"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.195 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.195 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.195

---

## Overview

`/passes` opens the Guest Passes UI, which allows a Claude Code user to share a free week of Claude Code access with friends. The command renders a JSX component inline and fires a telemetry event (`tengu_guest_passes_visited`) to record that the screen was opened. Its implementation is an async handler (`cjf`) resolved from module `azl` via the `module_id` resolution path, and the rendered component is produced via `lzl.jsx`.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| loc_byte | `12764288` |
| loc_byte_end | `12764610` |
| loc_line | `8699` |
| isHidden | `null` (not hidden) |
| module_id | `azl` |
| load_inline | `true` |
| arbor_handler.name | `cjf` |
| arbor_handler.fqn | `claude-2.1.195::cjf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.195 bundle.js:+12764288

---

## Input Branching

The command has a simple linear flow with no user-supplied arguments — it renders a fixed JSX view regardless of context. A single pre-render side-effect (config/pass-state loading) feeds the component. Two or fewer meaningful branches are present, so numbered pseudocode is used.

1. `/passes` is entered by the user.
2. The CLI resolves the `azl` module and calls the async handler `cjf`.
3. `cjf` calls the config-loading helper (`xor` → `kc` → `Mt`) to retrieve the current pass state from the global config store.
4. `cjf` calls the pass-list helper (`gn`) to enumerate existing guest pass records from disk.
5. `cjf` fires the `tengu_guest_passes_visited` telemetry event.
6. `cjf` calls `lzl.jsx` to produce the rendered JSX component tree and returns it to the CLI framework for display.

---

## Behavioral Spec

### Handler Entry Point (`cjf`)

```
async function passesCommandHandler(context):
    configData   = loadPassConfig(context)          // via xor → kc → Mt
    passList     = loadPassList(context)             // via gn
    fireEvent("tengu_guest_passes_visited")          // telemetry side-effect
    component    = buildJsxView(configData, passList) // via lzl.jsx
    return component
```

Analysis basis: CC v2.1.195 bundle.js:+12763981 (cjf→Mt), +12764015 (cjf→xor), +12764021 (cjf→gn), +12764119 (cjf→W), +12764121 (tengu_guest_passes_visited), +12764170 (cjf→lzl.jsx)

---

### Config Loading (`xor` → `kc` → `Mt`)

The `xor` function acts as a thin adapter that calls into `kc`, which in turn dispatches to the shared config-access layer `Mt`. The config layer performs the following steps:

```
function loadPassConfig(context):
    rawConfig = acquireConfigLock()          // Mt → S0 (lock acquisition)
    if lockContentionDetected:
        emitTelemetry("tengu_config_lock_contention")
    parsedConfig = parseConfig(rawConfig)    // Mt → v5 (version/prefix parsing)
    return parsedConfig
```

Analysis basis: CC v2.1.195 bundle.js:+12408761 (xor→kc), +3099582 (kc→Mt), +14067834 (Mt→qt), +14067848 (Mt→S0), +14069271 (tengu_config_lock_contention)

---

### Pass List Loading (`gn`)

`gn` enumerates guest-pass records stored on disk. It delegates to `xZt` for directory traversal and to `Mcr` for individual record reads and atomic writes.

```
function loadPassList(context):
    baseDir   = resolvePassDirectory()        // gn → S0, gn → e
    snapshot  = snapshotDiskState(baseDir)    // gn → xZt
    records   = []
    for each entry in snapshot:
        record = readPassRecord(entry)        // Mcr → aRt (atomic file read)
        records.append(record)
    onChange  = buildChangeWatcher(baseDir)   // gn → wZt → Date.now
    return { records, onChange }
```

Analysis basis: CC v2.1.195 bundle.js:+14065836 (gn→xZt), +14065840 (gn→S0), +14065861 (gn→e), +14065893 (gn→sUe), +14065937 (gn→wZt), +14066018 (gn→vZt), +14066277 (gn→Mcr)

---

### Disk State Snapshot (`xZt`)

`xZt` provides config-aware directory snapshotting with lock protection and backup management. Key behaviors observed in the call graph:

```
function snapshotDiskState(dir):
    mkdirIfMissing(dir)                  // xZt → s.mkdirSync
    acquireLock()                        // xZt → qt
    if lockTookTooLong:
        log("Lock acquisition took longer than expected...")
        emitTelemetry("tengu_config_lock_contention")
    existingData = statSync(dir)         // xZt → s.statSync
    entries = readdirStringSync(dir)     // xZt → s.readdirStringSync
    filtered = entries.filter(name => not name.startsWith(".backup."))
    // keep only most recent N=5 backups
    sorted  = sortByTimestamp(filtered)  // xZt → Number, y.split, Number.isNaN
    if len(sorted) > 5:
        pruneOldestBackups(sorted)       // xZt → s.unlinkSync
    // copy current state as timestamped backup
    backupPath = join(dir, ".backup." + Date.now())
    copyFileSync(currentPath, backupPath)  // xZt → s.copyFileSync
    return parseEntries(entries)           // xZt → Osi → I3r
```

Backup filename sentinel: `".backup."` (bundle.js:+14070436).
Backup retention limit: `5` most recent copies (bundle.js:+14070575).
File mode for saved config: `384` (octal `0o600`, owner read/write only) (bundle.js:+14070857).

Analysis basis: CC v2.1.195 bundle.js:+14068971 (xZt→t), +14068977 (xZt→bE.dirname), +14068998 (xZt→s.mkdirSync), +14069043 (xZt→Date.now), +14069056 (xZt→Osi), +14069347 (xZt→s.statSync), +14070328 (xZt→s.readdirStringSync), +14070436 (".backup."), +14070510 (xZt→bE.join), +14070549 (xZt→s.copyFileSync), +14070575 (5 backups), +14070693 (xZt→s.unlinkSync), +14070857 (mode 384)

---

### Record Read / Atomic Write (`Mcr` + `aRt`)

Individual pass record files are read through `Mcr`, which resolves symlinks and then delegates final writes to the atomic-write helper `aRt`. `aRt` follows a write-to-temp-then-rename pattern with fsync:

```
function readPassRecord(entry):
    resolved = resolveSymlink(entry)          // aRt → r.readlinkSync, jf.isAbsolute, jf.resolve
    data     = readFileSync(resolved, "utf-8") // oTt → r.readFileSync  (encoding: "utf-8")
    parsed   = safeJsonParse(data)             // Bt → JSON.parse
    return parsed

function writePassRecordAtomic(path, content):
    tmpPath  = path + "." + randomBytes(6).toString("hex")  // aRt → o0r.randomBytes, i.toString (radix 8)
    writeFileSync(tmpPath, content)            // aRt → Tf.writeFileSync
    fchmodSync(tmpPath, originalMode)          // aRt → Tf.fchmodSync (mode preserved from original)
    fsyncSync(fd)                              // aRt → Tf.fsyncSync
    renameSync(tmpPath, path)                  // aRt → r.renameSync
    if EACCES error on rename:
        fallback to in-place write
        log("writeFileSyncAndFlush: in-place fallback write failed...")
```

Encoding used when reading pass files: `"utf-8"` (bundle.js:+14071673).
Error code checked after ENOENT: `"ENOENT"` (bundle.js:+14071856).
Random-byte length for temp suffix: `6` (bundle.js:+1103807).
Radix for temp-suffix toString: `8` (bundle.js:+1103974).

Analysis basis: CC v2.1.195 bundle.js:+14071646 (oTt→r.readFileSync), +14071693 (oTt→Bt), +193860 (Bt→JSON.parse), +1103143 (aRt→r.readlinkSync), +1103791 (aRt→o0r.randomBytes), +1104239 (aRt→Tf.writeFileSync), +1104301 (aRt→Tf.fchmodSync), +1104448 (aRt→Tf.fsyncSync), +1104779 (aRt→r.renameSync)

---

### Config Persistence Safety Guards

Several guard conditions are checked before any write. These are shared with the global config subsystem but are reached during pass-state saves:

| Guard | Trigger condition | Telemetry emitted |
|---|---|---|
| Stale-write detection | Config on disk changed since last read | `tengu_config_stale_write` |
| Auto-repair from cache | Re-read hit a parse error | `tengu_config_auto_repaired` |
| Auth-loss prevention | Re-read config is missing auth that cache has | `tengu_config_auth_loss_prevented` |
| Parse error | Top-level parse failure | `tengu_config_parse_error` |
| Fallback write | Global-config fallback path taken | `tengu_config_fallback_write` |

Warning message emitted on lock contention: `"Lock acquisition took longer than expected - another Claude instance may be running"` (bundle.js:+14069182).
Fallback write guard message references GH #3117 (bundle.js:+14069962, +14069656).

Analysis basis: CC v2.1.195 bundle.js:+14069271 (lock_contention), +14069407 (stale_write), +14069784 (auto_repaired), +14070114 (auth_loss_prevented), +14073004 (parse_error), +14068887 (fallback_write)

---

### Pass Status Classification

The `gn` layer (and `vZt` sub-function) classifies each pass record into one of several status strings found in the literals:

| Status string | Meaning |
|---|---|
| `"unknown"` | Status could not be determined |
| `"local"` | Pass exists only locally |
| `"migrated"` | Pass was migrated from a previous format |
| `"installed"` | Pass has been installed/activated |
| `"native"` | Pass is a native (non-migrated) pass |
| `"disabled"` | Pass is disabled |
| `"enabled"` | Pass is active |
| `"no_permissions"` | Pass exists but lacks required permissions |
| `"not_configured"` | Pass record present but configuration absent |
| `"global"` | Pass has global scope |

Analysis basis: CC v2.1.195 bundle.js:+14066493 (0), +14066514 ("unknown"), +14066576 ("migrated"), +14066589 ("local"), +14066607 ("installed"), +14066621 ("native"), +14066640 ("disabled"), +14066654 (1), +14066666 ("enabled"), +14066680 ("no_permissions"), +14066701 ("not_configured"), +14066720 ("global")

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_guest_passes_visited` | Fired once per `/passes` invocation (bundle.js:+12764121) |
| Telemetry — `tengu_config_lock_contention` | Fired when config lock takes longer than expected (bundle.js:+14069271) |
| Telemetry — `tengu_config_stale_write` | Fired when on-disk config changed since last read (bundle.js:+14069407) |
| Telemetry — `tengu_config_auto_repaired` | Fired when parse error triggers cache-based repair (bundle.js:+14069784) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a write is blocked to avoid wiping auth credentials (bundle.js:+14070114) |
| Telemetry — `tengu_config_parse_error` | Fired on top-level config parse failure (bundle.js:+14073004) |
| Telemetry — `tengu_config_fallback_write` | Fired when global-config fallback write path is taken (bundle.js:+14068887) |
| Telemetry — `tengu_daemon_control` | Fired by daemon-control paths reachable transitively (bundle.js:+17924594) |
| Config reads | Reads from global config (`~/.claude.json`) via `Mt` → `S0` lock |
| Config writes | Atomic write-rename via `aRt`; preserves original file mode; fsync before rename |
| Backup files | Creates timestamped `.backup.<timestamp>` copies; retains at most 5 |
| File mode | `384` (octal `0o600`) applied to saved pass-record files |
| Hook registration | `vi` → `krs.register` is reachable (bundle.js:+68053); used to register file-watch hooks |
| File watching | `hRt` → `CTs.watchFile` and `Jcc.unwatchFile` used for config hot-reload (bundle.js:+1147333, +14067673) |
| appState changes | Pass records and status loaded into component props; no persistent in-memory app-state mutation identified beyond config |
| Sound | None identified in depth-2 traversal |
| JSX render | Returns a `lzl.jsx`-produced component tree to the CLI display layer (bundle.js:+12764170) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.195 | Initial analysis |

---

## Common Mistakes

1. **Expecting arguments**: `/passes` accepts no user arguments. Any text typed after the command name is ignored by the handler.
2. **Confusing `/passes` with a network call**: The command renders a local UI component. The actual pass-redemption network flow is handled separately; `/passes` itself only reads local config and disk state.
3. **Assuming instant display**: The handler is `async` and reads from the filesystem (with lock acquisition) before rendering. On systems under heavy I/O load or with another Claude instance running, a brief delay is possible, and a lock-contention warning may appear.
4. **Editing pass files manually**: Pass records are written atomically with mode `0o600` and protected by the auth-loss guard. Manual edits that corrupt the JSON will trigger `tengu_config_auto_repaired` and may be silently overwritten from cache.
5. **Backup accumulation**: Only 5 backup files are retained. Running `/passes` very frequently in rapid succession is harmless but will rotate older backups out.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `cjf` | Main async handler for `/passes` command (Arbor-resolved, FQN: `claude-2.1.195::cjf`) |
| `Mt` | Shared config-access / lock-acquire layer |
| `qt` | Lock acquisition utility |
| `Mjo` | Config merge / object utility |
| `oTt` | File-read sub-routine for pass records (reads raw file, parses JSON) |
| `Cs` | CLI error / process-exit handler |
| `Bt` | Safe JSON parser (`JSON.parse` wrapper) |
| `v5` | String prefix/slice utility (version string parsing) |
| `on` | Notification / event-emission helper |
| `Ojo` | Directory scanner for backup entries |
| `Ujo` | Path-join helper for backup directory construction |
| `T` | HTTP-request / API-call builder utility |
| `RYc` | Request construction sub-helper |
| `Me` | JSON serialiser (`JSON.stringify` wrapper) |
| `Lc` | Header / field redaction and sanitisation helper |
| `jXe` | Auth-info accessor helper |
| `PYc` | Streaming upload helper (Buffer.byteLength, chunked send) |
| `m` | File-watcher filter utility |
| `thr` | Path normalisation / prefix-strip helper |
| `k` | File-system watcher (setInterval + P.watch + event emission) |
| `W` | UI state / display helper reachable from handler |
| `Csm` | Config-subscription / file-watch registration manager |
| `hRt` | Config hot-reload watcher (`CTs.watchFile`) |
| `n` | Locale / lowercase normaliser |
| `xe` | Config-read with error push and logging |
| `xme` | Config extension / merge helper |
| `vi` | Hook registration dispatcher (`krs.register`) |
| `xor` | Thin adapter routing to config loader `kc` |
| `kc` | Config loader entry point (calls `eE` and `Mt`) |
| `eE` | Full config-initialisation orchestrator |
| `md` | Auth / credential accessor |
| `ab` | Profile / session builder |
| `Ql` | First-party token accessor |
| `oI` | OAuth integration entry point |
| `TH` | Auth-token resolution and validation |
| `lNt` | Auth fallback / legacy-token helper |
| `jot` | Credential object constructor |
| `gn` | Pass-list loader and change-watcher factory |
| `xZt` | Directory-snapshot and backup-management helper |
| `s` | Filesystem facade (mkdirSync, statSync, readdirStringSync, copyFileSync, unlinkSync) |
| `i` | Stream / resource-lifecycle manager (close, finally) |
| `Osi` | Config object initialiser (`I3r` + `Object.assign`) |
| `I3r` | Config schema instantiator |
| `sTt` | Pass-status serialiser / string formatter |
| `v` | Pass-version-string prefix tester |
| `y` | Config-value splitter (split + parse) |
| `dVe` | Teammate-mailbox message reader / mark-as-read coordinator |
| `I` | List-scroll / slice utility (Math.max, Math.floor, preventDefault) |
| `M` | Full HTTP server route handler (OAuth, device auth, inference proxy) |
| `A` | Userinfo fetch and sub-claim validator |
| `aRt` | Atomic file write helper (temp-rename-fsync pattern) |
| `Gd` | Real-path resolver (realpathSync wrapper) |
| `u` | Daemon-lifecycle manager (Le, ke, SF, yj) |
| `Cn` | Signal / event routing helper |
| `ZZe` | File-sync error classifier (EINVAL, ENOTSUP, EPERM, ENOSYS) |
| `lAs` | Object.defineProperty–based property descriptor helper |
| `sUe` | Pass-source / environment classifier |
| `Djo` | Object.entries iteration helper for pass records |
| `wZt` | Change-watcher timestamp tracker (`Date.now`) |
| `vZt` | Pass-status transition helper (calls `oTt` and `S0`) |
| `Mcr` | Individual pass-record reader/writer (delegates to `aRt`) |
| `Oe` | Output / render dispatcher |
| `OJe` | JSX output renderer root |