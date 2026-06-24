---
type: feature-spec
feature: "add-dir"
cc_version: 2.1.190
updated: "2026-06-24"
tags: ["add-dir", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.187
analysis_basis: "CC v2.1.187 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/add-dir`

> Analysis basis: CC v2.1.187 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.187

---

## Overview

`/add-dir` registers an additional filesystem directory as a working directory for the current Claude Code session. It validates the supplied path (resolving home-directory tildes, symlinks, and platform quirks), checks the directory is accessible and not already tracked, then integrates the new path into the session's tool-permission context, configuration state, file-watcher infrastructure, and permission-rule engine before reporting success or a user-facing error.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `add-dir` |
| description | `Add a new working directory` |
| argumentHint | `<path>` |
| module_id | `lul` |
| load_inline | `true` |
| loc_byte | `11099856` |
| loc_byte_end | `11100004` |
| loc_line | `6951` |
| arbor_handler.name | `Gjp` |
| arbor_handler.fqn | `claude-2.1.187::Gjp` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.187 bundle.js:+11099856

---

## Input Branching

The handler produces at least six distinct outcomes depending on path validation and state checks, so a flowchart is used.

```mermaid
flowchart TD
    A(["/add-dir &lt;path&gt;"]) --> B{Path argument supplied?}
    B -- No --> C["Error: 'Please provide a directory path.'"]
    B -- Yes --> D[Resolve & normalise path\n• tilde expansion\n• null-byte check\n• platform normalisation\n• symlink resolution]
    D --> E{stat() succeeds?}
    E -- No --> F["Error outcome: pathNotFound"]
    E -- Yes --> G{Entry is a directory?}
    G -- No --> H["Error outcome: notADirectory"]
    G -- Yes --> I{Already in working\ndirectory list?}
    I -- Yes --> J["Error outcome: alreadyInWorkingDirectory"]
    I -- No --> K[Add to session:\n• setToolPermissionContext\n• update localSettings / addDirectories\n• reset caches / skill index\n• refresh config\n• append to log\n• restart file watchers]
    K --> L["Success: display bold directory name\n+ dim hint '· /permissions to manage'"]
    F --> M([Return JSX result to shell])
    H --> M
    J --> M
    C --> M
    L --> M
```

Analysis basis: CC v2.1.187 bundle.js:+11098644 … +11099448

---

## Behavioral Spec

### 1. Entry Point — `handleAddDir` (bundle: `Gjp`)

`handleAddDir` is an `AsyncFunction` resolved by Arbor via `module_id → lul`.

```
async function handleAddDir(toolContext, userInput):
    rawPath = userInput.trim()
    if rawPath is empty:
        return renderError("Please provide a directory path.")

    resolvedPath = resolvePath(rawPath)          // see §2
    validationResult = validateDirectory(resolvedPath)  // see §3

    if validationResult.kind != "success":
        return renderError(validationResult)

    await applyDirectoryAddition(toolContext, resolvedPath)  // see §4
    return renderSuccess(resolvedPath)           // see §5
```

Analysis basis: CC v2.1.187 bundle.js:+11098644

---

### 2. Path Resolution — `resolvePath` (bundle: `hs`, called via `Btt`)

Handles tilde expansion, null-byte rejection, platform normalisation, and absolute-path resolution.

```
function resolvePath(raw):
    if raw contains null bytes:
        throw TypeError("Path contains null bytes")

    normalised = path.normalize(raw)             // NFC normalisation applied
    if normalised starts with "~/":
        normalised = os.homedir() + normalised.slice(2)

    if platform == "windows":
        normalised = applyWindowsPathRules(normalised)

    if not path.isAbsolute(normalised):
        normalised = path.resolve(process.cwd(), normalised)

    return normalised
```

Analysis basis: CC v2.1.187 bundle.js:+1094821, +1095171, +1095202, +66175

---

### 3. Directory Validation — `validateDirectory` (bundle: `Btt`)

Performs filesystem checks and cross-references the existing working-directory list.

```
async function validateDirectory(absPath):
    if absPath is empty string:
        return { kind: "emptyPath" }

    try:
        stats = await fs.stat(absPath)
    catch err:
        return { kind: "pathNotFound" }

    if not stats.isDirectory():
        return { kind: "notADirectory" }

    currentDirs = getAppState().workingDirectories
    if currentDirs.includes(absPath):
        return { kind: "alreadyInWorkingDirectory" }

    return { kind: "success" }
```

Key outcome literals observed in bundle:
- `"emptyPath"` — no path supplied (bundle.js:+3963147)
- `"notADirectory"` — `stat` reports a non-directory entry (bundle.js:+3963245)
- `"pathNotFound"` — `stat` throws (bundle.js:+3963390)
- `"alreadyInWorkingDirectory"` — directory already registered (bundle.js:+3963515)
- `"success"` — all checks passed (bundle.js:+3963591)

Analysis basis: CC v2.1.187 bundle.js:+3963166

---

### 4. Directory Addition — `applyDirectoryAddition` (bundle: `Or`, plus a chain of helpers)

Integrates the validated path into every relevant subsystem.

```
async function applyDirectoryAddition(ctx, absPath):
    // 4a. Read app state and locate current permission context
    appState = getAppState()
    lastPermCtx = appState.sessions.findLast(
        s => s.type == "working_directory"
    )

    // 4b. Build updated permission context fields
    newCtx = {
        working_directory:  absPath,
        allowed_tools:      lastPermCtx.allowed_tools,
        disallowed_tools:   lastPermCtx.disallowed_tools,
        avoid_prompts:      lastPermCtx.avoid_prompts,
        permission_mode:    lastPermCtx.permission_mode,   // never "bypassPermissions" if mode disabled
        bypassPermissions:  false,
        session:            lastPermCtx.session,
        effort:             lastPermCtx.effort,
        model:              lastPermCtx.model,
        max_thinking_tokens: lastPermCtx.max_thinking_tokens,
        flag_settings:      lastPermCtx.flag_settings
    }
    ctx.setToolPermissionContext(newCtx)

    // 4c. Persist to localSettings under "addDirectories"
    await updateLocalSettings("addDirectories", absPath)  // bundle literal "addDirectories" @ +11098680

    // 4d. Reset caches
    clearSkillIndexCache()          // via d5 / Lx
    clearRGtCache()                 // via D4 / RGt.clear
    invalidatePermissionRuleCache() // via iH / Tae rule-engine flush

    // 4e. Refresh running config (Ro.refreshConfig)
    await Ro.refreshConfig()

    // 4f. Append directory to session log / settings file
    await appendDirectoryEntry(absPath)   // via sbo — uses gl.realpath, gl.mkdir, gl.appendFile

    // 4g. Invalidate background file-watcher state
    await resetFileWatcherState()  // via q1i / Di: stops existing watcher, clears qZ cache, re-registers

    // 4h. Emit change event
    rF.emit("addDir", absPath)

    // 4i. Reload permission rules for new directory tree
    await reloadPermissionRules(ctx, absPath)  // via Tae / SWi / ao / l2
```

Analysis basis: CC v2.1.187 bundle.js:+10787750, +10787830, +10787855, +10787910, +10787928, +10787965, +10788026, +10788128, +10788159, +11098680, +11098727, +11098754, +11098801, +11098824, +11098838, +11098843, +11098849, +11098854, +11098864, +11098883, +11098890, +11098924

---

### 4a. Permission-Rule Reload — `reloadPermissionRules` (bundle: `Tae`, `SWi`, `ao`)

After the new directory is added the rule engine re-reads configuration layers.

```
function reloadPermissionRules(ctx, newDir):
    // Gather rules from all settings layers:
    //   policySettings, userSettings, projectSettings, flagSettings
    combined = mergeSettingsLayers([
        loadPolicySettings(),
        loadUserSettings(),
        loadProjectSettings(),
        loadFlagSettings()
    ])

    // For each rule operation in combined:
    //   "addRules"     → append allow/deny/ask entries
    //   "replaceRules" → overwrite allow/deny/ask entries
    //   "removeRules"  → delete matching entries
    //   "removeDirectories" → untrack directories

    applyRuleOperations(ctx, combined)

    // setMode guard: if mode == "bypassPermissions" but
    // disableBypassPermissionsMode is set, log and skip silently.
    // Literal: "Ignoring permission update: setMode 'bypassPermissions' rejected…"
```

Analysis basis: CC v2.1.187 bundle.js:+5267797, +5267885, +5268161, +5268346, +5268354, +5268386, +5268393, +5268411, +5268509, +5269166, +5269550, +5270017

---

### 5. Result Rendering — `renderSuccess` / `renderError` (bundle: `Gjp` JSX output)

```
function renderSuccess(absPath):
    return JSX:
        <Box>
          <Text bold>{absPath}</Text>
          <Text dim>"· /permissions to manage"</Text>
        </Box>

function renderError(validationKind):
    message = lookupErrorMessage(validationKind)
    // Fallback: "Unknown error" (bundle.js:+11099127)
    // Cancellation path: "Did not add a working directory." (bundle.js:+11099353)
    return JSX:
        <Box>
          <Text color="red">{message}</Text>
        </Box>
```

Analysis basis: CC v2.1.187 bundle.js:+11098942, +11099127, +11099228, +11099235, +11099268, +11099287, +11099353, +11099404, +11099448

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_disable_bypass_permissions_mode` | Fired when a `setMode:"bypassPermissions"` attempt is blocked (bundle.js:+3395452) |
| Telemetry — `tengu_daemon_yield` | Fired when a background daemon yields to a foreground process during restart (bundle.js:+17216595) |
| Telemetry — `tengu_daemon_config_reload` | Fired after `Ro.refreshConfig()` triggers a daemon config reload (bundle.js:+17212183) |
| Telemetry — `tengu_feature_ok` | Fired on successful feature-flag evaluation (bundle.js:+1025122) |
| Telemetry — `tengu_feature_bad` | Fired on failed feature-flag evaluation (bundle.js:+1025189) |
| Telemetry — `tengu_feature_sad` | Fired on degraded feature-flag evaluation (bundle.js:+1025270) |
| Telemetry — `tengu_daemon_control` | Fired on daemon start/stop during watcher restart (bundle.js:+17233792) |
| Telemetry — `tengu_bg_state_read_transient` | Fired when background state is read transiently (bundle.js:+4300026) |
| appState changes | `workingDirectories` list extended; `sessions` list gets a new `working_directory` permission-context entry |
| localSettings persistence | Key `"addDirectories"` appended under `localSettings` (bundle.js:+11098680, +11098727) |
| Config file I/O | `gl.realpath`, `gl.mkdir` (mode `448` = `0o700`), `gl.appendFile` (mode `384` = `0o600`) used to write the session settings file (bundle.js:+13224783, +13224825, +13224962) |
| Skill-index cache | Cleared via `clearSkillIndexCache` (`d5`) so the new directory is indexed on next use (bundle.js:+11098838) |
| Permission-rule cache | `RGt` cleared via `D4` (bundle.js:+11098849, +10915358) |
| File-watcher | Background watcher stopped (`qZ` cache cleared), then restarted to include new directory (bundle.js:+11098890) |
| Event emission | `rF.emit` broadcasts the directory addition to any registered listeners (bundle.js:+11098854) |
| Hook registration | `Ei` registers a hook via `b6o.register` as part of the file-write infrastructure used during config persistence (bundle.js:+67325) |
| Sound | None observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.187 | Initial analysis |

---

## Common Mistakes

1. **Supplying a file path instead of a directory** — `/add-dir path/to/file.txt` will return a `notADirectory` error. Always supply the containing directory.
2. **Omitting the path argument entirely** — `/add-dir` with no argument returns "Please provide a directory path." Pass at least one non-whitespace character.
3. **Supplying a path already registered** — If the directory (after symlink resolution) is already in the working-directory list, the command returns `alreadyInWorkingDirectory` silently. Check `/permissions` to inspect current directories before adding.
4. **Relative paths in non-interactive scripts** — The resolver calls `path.resolve(cwd, …)`, so the result depends on the process working directory at the time. Use absolute paths for reproducibility.
5. **Tilde paths on Windows** — The `~/` expansion branch relies on `os.homedir()`; Windows UNC or drive-letter paths need to be fully specified, as the tilde shorthand may behave differently.
6. **Expecting immediate file-watcher coverage** — The watcher is stopped and restarted asynchronously. There is a brief window after the command returns where the new directory is registered but not yet watched.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Gjp` | Main handler (`handleAddDir`) — AsyncFunction entry point for `/add-dir` |
| `Or` | Build-and-apply permission-context helper (reads appState, constructs new context) |
| `G8n` | Helper that extracts `allowed_tools` / `disallowed_tools` from permission context |
| `W8n` | Helper that extracts `avoid_prompts` / `permission_mode` from permission context |
| `N2` | Feature-disable check helper (checks `"disable"` literal, fires `tengu_disable_bypass_permissions_mode`) |
| `it` | Inner feature-flag evaluation routine |
| `V9` | Feature-flag sub-evaluator |
| `hSn` | Feature-flag cache lookup/store routine |
| `Dt` | Feature-flag record constructor (timestamps via `Date.now`) |
| `iH` | Permission-rule application helper (addRules / replaceRules / removeRules dispatch) |
| `T` | Settings-write helper (writes to disk, handles `"debug"` mode, redacts secrets) |
| `Xwc` | Settings serialisation helper |
| `I6o` | Low-level config commit helper |
| `Me` | JSON serialisation wrapper (`JSON.stringify`) |
| `wc` | Path-manipulation utility used during settings file location |
| `c8o` | Path-segment mapper |
| `dze` | Async write-stream helper |
| `JWo` | Stream `.write` wrapper |
| `eLc` | Atomic file-write orchestrator (mkdir, appendFile, rename, checksum) |
| `FKe` | Buffered/batched write scheduler (uses `setTimeout`, `setImmediate`) |
| `dpe` | File-write path builder |
| `Mre` | Directory-creation helper |
| `p8o` | Path-join utility for config files |
| `Ocr` | File rename/unlink helper (handles `.txt` suffix, `fs.rename`, `fs.unlink`) |
| `Zwc` | Atomic append-file writer (mkdir + appendFile + rename cycle) |
| `Ei` | Hook registration helper (`b6o.register`) |
| `qp` | String escape/sanitise helper for rule patterns |
| `glu` | `replaceAll` wrapper for rule-string normalisation |
| `KL` | Utility: checks whether a value is included in a list |
| `d` | Interactive-input / UI state component (supervisor mode render loop) |
| `Z8e` | Directory stat + error-classification helper (ENOENT, file-vs-dir, size check) |
| `Xs` | Async-local-store accessor (`$Fu.getStore`) |
| `vxo` | Directory metadata builder |
| `be` | Error-code string extractor |
| `f$l` | Directory listing formatter (Object.keys, Math.max columns) |
| `E` | Foreground process stop/restart controller |
| `FUt` | Process-stop utility |
| `eyt` | Process-exit helper |
| `fyc` | Key-enumeration helper for process state |
| `A` | Background worker controller (stop / updateConfig / start, Math.max / Math.min bounds) |
| `_` | Worker-pool teardown helper (Promise.all, status flags) |
| `ke` | Worker-lifecycle callback (error logging via `jJ.logError`) |
| `fo` | Error/String coercion utility |
| `OEc` | Heartbeat configuration helper |
| `Xse` | Heartbeat state accessor |
| `I` | Input-event handler / layout controller (Math.max, Math.floor, preventDefault) |
| `x` | Transient-mode render helper |
| `W` | Generic render/update callback |
| `Yde` | Utility invoked post-permission-context set (exact role: <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->) |
| `Lx` | Skill-index refresh orchestrator (clearSkillIndexCache, Rqn, Rll, XGe) |
| `d5` | Skill-index cache invalidator (`e.clearSkillIndexCache`, `Promise.resolve`) |
| `Rqn` | Skill-index sub-refresh helper |
| `Rll` | Skill-index sub-refresh helper |
| `XGe` | Skill-index map accessor (`mWn.get`) |
| `T6t` | Skill-map entry fetcher |
| `A6t` | Skill-map entry constructor |
| `iye` | Post-addition hook dispatcher |
| `Oqn` | Hook target called by `iye` |
| `D4` | Permission-rule cache clearer (`RGt.clear`) |
| `sbo` | Settings log-append helper (realpath, mkdir, appendFile, UTF-8 encoding) |
| `s3` | Environment-detection helper (`"production"`, `"test"`) |
| `nt` | String coercion utility |
| `$3l` | Settings path resolver |
| `B3` | Settings path builder |
| `eUe` | Settings file writer (cw, df, R3u) |
| `cw` | Config write helper |
| `df` | Config data formatter |
| `R3u` | Config record builder |
| `TH` | Path-normalisation wrapper (NFC) |
| `kn` | Error-wrapper / re-throw helper |
| `M$` | Feature-gate lookup (VL) |
| `gr` | Feature-gate evaluator (VL) |
| `Xo` | Error-access helper |
| `q1i` | File-watcher restart orchestrator (stop → clear → restart) |
| `fy` | Watcher cache entry deleter (`qZ.delete`) |
| `Di` | File-watcher core (lstat, readFile, qZ cache management, daemon start/stop) |
| `a` | MCP/tool-connection state manager (a9e, brr, hla, uBo) |
| `a9e` | MCP server connection builder (stdio/sdk/sse-ide/ws-ide/claudeai-proxy) |
| `brr` | MCP connection result applicator (`applyMcpUpdate`) |
| `hla` | MCP helper — tool-request queue accessor |
| `uBo` | MCP multi-server connection manager |
| `u` | Daemon control dispatcher (Le, Re, CU, X6) |
| `Le` | Daemon feature-ok reporter |
| `Re` | Daemon feature-bad reporter |
| `CU` | Daemon first-party feature evaluator |
| `X6` | Daemon graceful-exit handler (`Promise.race`, `process.exit`) |
| `Jd` | Error-logging helper |
| `Gt` | JSON-parse wrapper |
| `kd` | Watcher config writer (Cm, path join, JSON serialise) |
| `Cm` | Atomic config-file writer (randomBytes temp name, writeFile, rename, copyFile, chmod) |
| `Df` | Watcher error handler (ipe.has check, T, be, ke) |
| `Tae` | Permission-rule loader/applier for new directory (Tjr, SWi, Tn, ao) |
| `Tjr` | Rule-merge pre-processor |
| `SWi` | Settings-layer combiner and rule dispatcher |
| `QBe` | Policy-settings loader |
| `Tn` | Policy-settings parser (hsn, l2) |
| `ZNd` | Project-settings loader (Jm, Nd, DC, Sa) |
| `Jm` | Project-settings parser |
| `Nd` | Realpath resolver with EISDIR/symlink handling |
| `DC` | Settings-cache lookup helper |
| `nUd` | Rule normalisation helper |
| `Xm` | Rule-pattern escape/compile helper (_lu, Ek, ylu, Hlu) |
| `_lu` | Pattern prefix stripper |
| `Ek` | Pattern ownership checker (`Object.hasOwn`) |
| `ylu` | Pattern suffix handler |
| `Hlu` | Pattern `replaceAll` normaliser |
| `ao` | Settings-file read/write core (Jm, Wt, QEr, l2, DC, oIt, Me, Fis, g9, PG) |
| `QEr` | Settings-parse dispatcher (Nls, lbe, DG, Pls, YJ) |
| `l2` | Settings-schema validator (gr, IEt, rar, AEt, VPe, KPe, vEt, Toe, ube, Asn, Zls, nQ, rCt) |
| `lEr` | Timestamp recorder (`Ion.set`, `Date.now`) |
| `Q1e` | Settings-record factory (fsn, l2) |
| `oIt` | Atomic sync file writer (lstatSync, readlinkSync, writeFileSync, fchmodSync, fsyncSync, renameSync, unlinkSync) |
| `bH` | Cache-invalidation helper (`YYt.clear`, `xsr.clear`) |
| `Fis` | gitignore/exclude-file tracker (mkdir, readFile, appendFile, writeFile) |
| `g9` | `.claude/settings.json` / `settings.local.json` path builder |
| `Mt` | Feature-sad reporter |
| `PG` | Settings load-cycle manager (loadSettingsFromDisk_start/end telemetry literals) |
| `Btt` | Path-validation entry point (hs for resolution, stat check, outcome classification) |
| `hs` | Path resolver (tilde, null-byte, platform, absolute resolution) |
| `Pt` | Async-local-store logger |
| `xrn` | Store-get helper (`Rrn.getStore`, `QV`) |
| `V2` | Path display formatter |
| `qk` | Path sanitiser (/var/ → /tmp substitution, wWe, Pm, doe) |
| `wWe` | Path-transform helper (jt, QR) |
| `Pm` | Case-fold helper (`toLowerCase`) |
| `doe` | Path-output finaliser |
| `Gtt` | Success-result JSX renderer (bold path + dirname hint) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.