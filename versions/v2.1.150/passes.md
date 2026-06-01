---
type: feature-spec
feature: "passes"
cc_version: "2.1.150"
updated: "2026-06-01"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.150 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.150 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.150

---

## Overview

The `/passes` command surfaces a UI screen that allows the current user to share a free week of Claude Code with friends ("guest passes"). When invoked, the async handler (`MH5`) accesses the configuration layer, constructs a JSX element via `Co_.createElement`, and emits a `tengu_guest_passes_visited` telemetry event to record that the passes screen was opened.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| loc_byte | `12048570` |
| loc_byte_end | `12048892` |
| loc_line | `9758` |
| isHidden | `null` (not hidden) |
| module_id | `Hm1` |
| load_inline | `true` |
| arbor_handler.name | `MH5` |
| arbor_handler.fqn | `claude-2.1.150::MH5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.150 bundle.js:+12048570

---

## Input Branching

The command's top-level flow has two main branches: whether the config/auth state is available and valid, and whether the JSX render succeeds. Because there are effectively two distinct conditional paths at the handler level (plus the telemetry side-effect path), pseudocode is sufficient.

```
1. User invokes /passes
2. Handler MH5 is called (AsyncFunction, resolved via module_id → Hm1)
3. Emit telemetry: tengu_guest_passes_visited
4. Acquire configuration via configReader (m6 → JOH path):
   a. If config access is attempted before it is allowed:
      → throw Error("Config accessed before allowed.")  [bundle.js:+3195654]
   b. Read config file with readFileSync (utf-8 encoding)  [bundle.js:+3195737]
   c. If file read fails with ENOENT:
      → return empty/default config state            [bundle.js:+3195884]
   d. Parse JSON content (g6 → JSON.parse)           [bundle.js:+183438]
   e. Strip any leading prefix from version string (xC → H.startsWith / H.slice)
5. Acquire write lock via saveConfigWithLock (f8 / $f_):
   a. If lock contention exceeds threshold:
      → emit tengu_config_lock_contention            [bundle.js:+3193710]
      → warn: "Lock acquisition took longer than expected…" [bundle.js:+3193621]
   b. Re-read config; if re-read is missing auth that cache has:
      → emit tengu_config_auth_loss_prevented        [bundle.js:+3194189]
      → refuse write (guard GH #3117)               [bundle.js:+3194037]
   c. Otherwise commit the updated config atomically (UK6 handles
      temp-file write → fchmod → fsync → rename)
6. Render JSX passes screen via Co_.createElement               [bundle.js:+12048442]
7. Return rendered element to the CLI shell for display
```

---

## Behavioral Spec

### Handler Entry (passesCommandHandler)

```
async function passesCommandHandler(args):
    emit("tengu_guest_passes_visited")           // always on open
    config = await readCurrentConfig()
    element = renderPassesScreen(config)
    return element
```

Analysis basis: CC v2.1.150 bundle.js:+12048253 (MH5 → m6), +12048287 (MH5 → EE8), +12048391 (MH5 → c), +12048442 (MH5 → Co_.createElement)

---

### Configuration Reader (configReader)

```
function configReader(allowAccessFlag):
    if not allowAccessFlag:
        throw Error("Config accessed before allowed.")
    raw = fs.readFileSync(configPath, "utf-8")
    parsed = JSON.parse(raw)
    version = stripPrefix(parsed.version)   // xC: startsWith + slice
    return parsed
```

Analysis basis: CC v2.1.150 bundle.js:+3195648 (Error), +3195710 (readFileSync), +3195737 ("utf-8"), +3195757 (g6/JSON.parse), +3195760 (xC/stripPrefix)

---

### Config Lock & Safe Write (saveConfigWithLock / globalConfigSaver)

```
async function saveConfigWithLock(updater):
    acquire lock (Date.now polling)
    if lock_wait > threshold:
        emit("tengu_config_lock_contention")
        log_warn("Lock acquisition took longer than expected…")
    
    reread = readCurrentConfig()
    cached = getConfigCache()

    if cached has auth AND reread is missing auth:
        emit("tengu_config_stale_write")
        emit("tengu_config_auth_loss_prevented")
        log_warn("saveConfigWithLock: re-read config is missing auth…")
        release lock
        return   // refuse write
    
    merged = updater(reread)
    atomicWrite(configPath, merged)   // UK6: temp → fchmod → fsync → rename
    release lock
```

Analysis basis: CC v2.1.150 bundle.js:+3193710 (tengu_config_lock_contention), +3193621 (lock warning literal), +3193846 (tengu_config_stale_write), +3194189 (tengu_config_auth_loss_prevented), +3194037 (auth-loss warning literal)

---

### Atomic Config Write (atomicConfigWriter)

```
function atomicConfigWriter(path, data):
    tmpPath = path + ".backup." + randomHex(6)  // sQ8.randomBytes(6).toString("hex")
    fd = Df.openSync(tmpPath, flags)
    Df.writeFileSync(tmpPath, data)
    Df.fchmodSync(fd, 0o600)                    // permissions: 384 decimal
    Df.fsyncSync(fd)
    Df.closeSync(fd)
    fs.renameSync(tmpPath, path)
    // on ELOOP / ENOTDIR errors: throw with code field
```

Analysis basis: CC v2.1.150 bundle.js:+1009377 (randomBytes), +1009405 ("hex"), +1009813 (writeFileSync), +1009871 (fchmodSync), +1009937 (fsyncSync), +3194922 (384 / 0o600)

---

### Backup Rotation (configBackupPruner)

```
function configBackupPruner(configDir):
    files = fs.readdirStringSync(configDir)
    backupFiles = files.filter(f => f.includes(".backup."))
    backupFiles.sort()
    while backupFiles.length > 5:                  // max 5 backups [+3194640]
        oldest = backupFiles.shift()
        fs.unlinkSync(join(configDir, oldest))
```

Analysis basis: CC v2.1.150 bundle.js:+3194507 (".backup." literal), +3194640 (5 max backups)

---

### JSX Passes Screen Renderer (passesScreenRenderer)

```
function passesScreenRenderer(config):
    // Renders the "Share a free week" UI using Co_.createElement
    // Receives config (auth state, user info) from configReader
    // Returns a React/JSX element tree for the CLI terminal renderer
    return Co_.createElement(PassesScreenComponent, { config })
```

Analysis basis: CC v2.1.150 bundle.js:+12048442

---

### Feature Flag Check (featureFlagChecker)

```
function featureFlagChecker(featureKey):
    if feature is valid/enabled:
        emit("tengu_feature_ok")
        return true
    else:
        emit("tengu_feature_bad")
        return false
```

Analysis basis: CC v2.1.150 bundle.js:+963421 (tengu_feature_ok), +963479 (tengu_feature_bad)

---

### Config Status Classification (configStatusClassifier)

The literals found in the implementation describe an enumerated status type used to classify the user's config state:

| Status Value | Meaning |
|---|---|
| `"unknown"` | Status not yet determined |
| `"local"` | Config is local only |
| `"migrated"` | Config was migrated from an older format |
| `"native"` | Native auth method in use |
| `"installed"` | Package is installed |
| `"disabled"` | Feature is disabled |
| `"enabled"` | Feature is enabled |
| `"no_permissions"` | Insufficient permissions |
| `"not_configured"` | Auth/config not yet set up |
| `"global"` | Global config in use |

Analysis basis: CC v2.1.150 bundle.js:+3191372–+3191578

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_guest_passes_visited` (on every open, +12048393); `tengu_config_lock_contention` (+3193710); `tengu_config_stale_write` (+3193846); `tengu_config_auth_loss_prevented` (+3194189); `tengu_config_parse_error` (+3196285); `tengu_feature_ok` (+963421); `tengu_feature_bad` (+963479) |
| Config read | Reads `~/.claude.json` (or equivalent) synchronously via `readFileSync` with `utf-8` encoding |
| Config write guard | Refuses to overwrite config if re-read is missing auth that the in-memory cache holds (GH #3117 protection) |
| Config backup | Writes `.backup.<hex6>` temp files; maximum 5 backups retained; older ones are pruned |
| File permissions | Backup/temp files written with mode `0o600` (decimal 384) |
| JSX render | Returns a `Co_.createElement` element; no DOM — rendered by the CLI terminal layer |
| appState changes | No direct appState mutation observed in depth-2 traversal |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | `a9 → W7A.register` observed in `Tt4` sub-path (file-watch hook); scope is config watcher, not passes-specific |

---

## Version History

| Version | Change |
|---|---|
| v2.1.150 | Initial analysis |

---

## Common Mistakes

1. **Expecting a prompt-driven flow**: `/passes` is type `local-jsx`, not `prompt`. It renders a JSX screen directly — it does not send a message to the AI agent.
2. **Assuming the command is always visible**: `isHidden` is `null` in this version, meaning visibility may be controlled by a feature flag or auth state check at runtime rather than a static hidden flag.
3. **Ignoring auth-loss guard**: Any tooling that modifies `~/.claude.json` while Claude Code is running risks triggering the stale-write protection; the write will be silently refused if in-memory auth is absent from the re-read file.
4. **Expecting synchronous completion**: The handler `MH5` is an `AsyncFunction`; callers must `await` it or handle the returned Promise.
5. **Overlooking backup accumulation**: The system retains up to 5 `.backup.*` files per config rotation cycle; environments with rapid config churn should monitor disk usage.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `MH5` | Main async handler for `/passes` command (passesCommandHandler) |
| `m6` | Config reader / config accessor |
| `Q6` | Config path resolver |
| `Af_` | Config initialization helper |
| `JOH` | Low-level config file reader (reads file, parses JSON, handles ENOENT) |
| `q` | Node `fs` module binding (readFileSync, statSync, etc.) |
| `g6` | JSON parser wrapper |
| `xC` | Version-string prefix stripper (startsWith + slice) |
| `H` | Random/timer utility (Math.random, setTimeout) |
| `_` | Filesystem utility (readdirStringSync, statSync, toUpperCase) |
| `K8` | UI notification / render helper |
| `mb9` | Config backup directory scanner |
| `Of_` | Config directory path builder (iY.join + i8) |
| `f` | MCP server registry / feature map |
| `$` | HQ1-backed utility / startsWith checker |
| `N` | Config serializer / writer (debug, includes, trim, cI, HbH, $VK) |
| `LVK` | Config normalization helper (Gv, KVK, T7A) |
| `CH` | JSON.stringify wrapper |
| `X4` | Content redaction / path formatter (s5A, replace, at, lastIndexOf, slice) |
| `HbH` | B5A-backed formatter |
| `$VK` | Config write dispatcher (ICH, q9H, U2H.dirname, Buffer.byteLength, etc.) |
| `c` | General-purpose callback / continuation |
| `w` | Background session manager (spawn, kill, memory check, etc.) |
| `A` | Session/process map (get, set, values, toLowerCase) |
| `C` | Child process controller (KXK, Dz, N, RH, kk5, z.write) |
| `uH` | Background session helper (c-bound) |
| `bH` | Background session helper (c-bound) |
| `Kv8` | Memory threshold checker (a6, V6) |
| `Oz6` | Background session config reader (vP.readFile, wD_, g6, filter) |
| `RH` | Error logger / feature reporter (c_, mH, G1, xiK, ll.logError) |
| `g` | Session retirement checker (v6.filter, VH.has) |
| `V6` | Config watcher / cache invalidator (_$6, A$6, we, YOH, we6, e36, lg) |
| `yqA` | Background session spawner (bB.claim, Vh8.connect, M.on/once/write/end) |
| `uqA` | Background session lifecycle manager (q.add/delete, yY.rm/unlink, roster, etc.) |
| `L` | Session promise tracker (q.add, M.finally, q.delete) |
| `D` | Background session dispatcher (V6, Kv8, a6, kqA, Dz, K8, RH) |
| `S` | Disposable resource wrapper (S.dispose) |
| `Tt4` | Config file watcher (GG, ve6.watchFile/unwatchFile, Q6, Nq, xC, Af_, rn, a9) |
| `rn` | Config reload notifier |
| `a9` | Hook registration helper (W7A.register) |
| `EE8` | Auth/session bootstrap (R5, m6) |
| `R5` | Auth resolver (dD, m6) |
| `dD` | Auth credential builder (K4, ev, yO, TA, hJ, e$, O1H) |
| `K4` | mH-backed key helper |
| `ev` | OAuth/API key flow handler (Wc6, K4, O1H, wn, HN, mH) |
| `yO` | First-party auth checker (RA) |
| `hJ` | Auth config field accessor |
| `e$` | Auth validation and session setup (K4, HN, M36, hJ, GCH, mH, TL6, m6, th, vBH) |
| `O1H` | Auth error handler (mH, MfH) |
| `f8` | Global config saver (saveGlobalConfig) |
| `$f_` | Config save-with-lock implementation (saveConfigWithLock) |
| `_L9` | Config object builder (A__, Object.assign) |
| `A__` | HL9-backed config schema constructor |
| `f$6` | Config field setter helper |
| `V` | Config path / version string (startsWith check) |
| `P` | MCP connection pool manager (wh8, uy, QU, Promise.all, zLH, ni, RH, c_) |
| `wh8` | MCP transport factory |
| `c_` | Error/string conversion utility |
| `Z` | Backup file list (slice for pruning) |
| `UK6` | Atomic file writer (readlink, isAbsolute, resolve, dirname, openSync, writeFileSync, fchmodSync, fsyncSync, renameSync, unlinkSync) |
| `O` | Symbolic-link stat checker (k8) |
| `j8` | K8-backed UI helper |
| `M` | Socket / connection handle (A.close, q.close, L) |
| `OFH` | Config object field extractor |
| `ub9` | Config entry enumerator (Object.entries) |
| `zFH` | Timestamp recorder (Date.now) |
| `ff_` | Config save fallback writer (iY.dirname, Q6, qZ, CH, UK6) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.