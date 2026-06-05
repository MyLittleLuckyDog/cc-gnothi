---
type: feature-spec
feature: "add-dir"
cc_version: "2.1.163"
updated: "2026-06-05"
tags: ["add-dir", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.163 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/add-dir`

> Analysis basis: CC v2.1.163 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.163

---

## Overview

The `/add-dir` command expands the current Claude Code session's scope by registering one or more additional working directories beyond the initial launch directory. After validating that the supplied path exists and is a directory the process can access, the handler resolves the real path, updates tool-permission context, persists the change to local settings, and re-renders the active context display.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `add-dir` |
| description | Add a new working directory |
| argumentHint | `<path>` |
| module_id | `Kxq` |
| load_inline | `true` |
| loc_byte | `10919376` |
| loc_byte_end | `10919524` |
| loc_line | `7234` |
| arbor_handler.name | `gOf` |
| arbor_handler.fqn | `claude-2.1.163::gOf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.163 bundle.js:+10919376

---

## Input Branching

Six distinct outcomes are possible depending on path content and filesystem state, so a flowchart is used.

```mermaid
flowchart TD
    A([User invokes /add-dir path]) --> B{Path argument supplied?}
    B -- No / empty --> C[Return error:\n'Please provide a directory path.']
    B -- Yes --> D[Resolve and normalize path\nexpand tilde, handle Windows,\nabsolute vs. relative]
    D --> E{Filesystem stat}
    E -- stat error: ENOTDIR\nor path is a file --> F[Return error: notADirectory]
    E -- stat error: EACCES / EPERM --> G[Return error: notADirectory\n(permission denied variant)]
    E -- stat error: path not found --> H[Return error: pathNotFound]
    E -- stat OK, is directory --> I{Already in\nworking directories?}
    I -- Yes --> J[Return error: alreadyInWorkingDirectory]
    I -- No --> K[Resolve realpath\nUpdate addDirectories in localSettings\nSet tool-permission context\nRefresh config & UI]
    K --> L[Return success result\nwith bold directory name\nand permissions hint]
```

Analysis basis: CC v2.1.163 bundle.js:+3844409 (emptyPath), +3844507 (notADirectory), +3844652 (pathNotFound), +3844777 (alreadyInWorkingDirectory), +3844853 (success), +3844938 (prompt text)

---

## Behavioral Spec

### Top-level handler (`gOf`)

The Arbor-resolved handler is `gOf` (AsyncFunction, resolved via `module_id` → `Kxq`).

```
async function addDirHandler(commandArgs, appState):

    // 1. Retrieve current app state
    sessionState = getAppState(appState)           // via resolveAppState

    // 2. Resolve and validate the supplied path
    result = validateAndResolvePath(commandArgs.path)
    // result carries one of: emptyPath | notADirectory | pathNotFound |
    //                        alreadyInWorkingDirectory | success

    if result.kind == "emptyPath":
        return renderError("Please provide a directory path.")

    if result.kind == "notADirectory":
        return renderError(result.message)

    if result.kind == "pathNotFound":
        return renderError(result.message)

    if result.kind == "alreadyInWorkingDirectory":
        return renderError(result.message)

    // 3. Persist the new directory
    resolvedPath = result.resolvedPath
    updateLocalSettings("addDirectories", resolvedPath)    // appends to list

    // 4. Update tool-permission context for the new directory scope
    setToolPermissionContext(resolvedPath)

    // 5. Rebuild the permission rule display (J$ logic)
    refreshPermissionRules(sessionState)

    // 6. Refresh config so downstream tools pick up the new root
    refreshConfig()                               // kA.refreshConfig

    // 7. Persist config entry (b6A: realpath, readFile, mkdir, appendFile)
    persistConfigEntry(resolvedPath)

    // 8. Rebuild file-index / background state for the new directory (uL9)
    reindexDirectory(resolvedPath)

    // 9. Render success banner
    dirLabel = bold(resolvedPath)
    hint     = dim("· /permissions to manage")
    return renderSuccessBanner(dirLabel, hint)
```

Analysis basis: CC v2.1.163 bundle.js:+10918157 (`R_` call), +10918267 (setToolPermissionContext), +10918299 (`J$`), +10918351 (refreshConfig), +10918370 (`b6A`), +10918377 (`uL9`), +10918429 (bold), +10918715 (dim), +10918722 ("· /permissions to manage"), +10918858 ("Did not add a working directory.")

---

### Path validation (`validateAndResolvePath` — maps to `hnH` → `Z1`)

```
function validateAndResolvePath(rawInput):

    if rawInput is null or empty after trim:
        return { kind: "emptyPath" }

    // Expand tilde prefix
    if rawInput.startsWith("~/"):
        rawInput = homedir() + rawInput.slice(2)

    // Handle Windows-style separators and UNC paths
    // Normalize via path.normalize (NFC Unicode form)
    normalized = normalize(rawInput)

    // Resolve to absolute if relative
    if not path.isAbsolute(normalized):
        normalized = path.resolve(cwd(), normalized)

    // Validate no null bytes
    if normalized includes null byte:
        throw Error("Path contains null bytes")

    // Stat the resolved path
    try:
        statResult = fs.stat(normalized)      // A19.stat
    catch err:
        if err.code == "ENOTDIR":
            return { kind: "notADirectory" }
        if err.code in ["EACCES", "EPERM"]:
            return { kind: "notADirectory" }   // permission denied maps here
        return { kind: "pathNotFound" }

    if not statResult.isDirectory():
        return { kind: "notADirectory" }

    // Check for duplicate
    existingDirs = currentWorkingDirectories()
    realP = fs.realpathSync(normalized)
    if existingDirs includes realP:
        return { kind: "alreadyInWorkingDirectory" }

    // macOS /var → /private/var remapping
    realP = realP.replace("/var/", ...).replace(/tmp pattern/, "/tmp$1")

    return { kind: "success", resolvedPath: realP }
```

Analysis basis: CC v2.1.163 bundle.js:+3844428 (`hnH` entry), +3844462 (stat call), +3844570 (v8 / error check), +3844713 (`$a`), +3844737 (`yI`), +1052740 (`Z1`), +1052993 ("Path contains null bytes"), +1053090 (homedir), +1053108 ("~/"), +1053250 (isAbsolute), +1053304 (resolve), +13238332 ("/var/"), +13238373 ("/tmp$1")

---

### App-state retrieval (`resolveAppState` — maps to `R_`)

```
function resolveAppState(appState):

    // Pull the most recent session entry from the app state list
    latest = appState.findLast(entry => entry.type == "working_directory")

    // Extract allowed_tools, disallowed_tools, avoid_prompts, session,
    // effort, model, max_thinking_tokens, flag_settings fields
    return buildContextObject(latest)
```

Analysis basis: CC v2.1.163 bundle.js:+10915920 (getAppState call), +10916000 (findLast), +10916025 ("working_directory"), +10916080 ("allowed_tools"), +10916135 ("disallowed_tools"), +10916196 ("avoid_prompts"), +10916495 ("session"), +10916520 ("effort"), +10916533 ("model"), +10916545 ("max_thinking_tokens"), +10916571 ("flag_settings")

---

### Config persistence (`persistConfigEntry` — maps to `b6A`)

```
async function persistConfigEntry(resolvedPath):

    // Determine environment (production vs. test)
    env = getEnvironment()           // "production" | "test"

    // Normalize the path (NFC)
    normalized = path.normalize(resolvedPath)   // MO

    // Read existing config via realpath + readFile (utf8, 448 / 384 byte limits)
    existing = await fs.realpath(configPath)
    raw      = await fs.readFile(existing, "utf8")

    // Log errors via kH (error-logging utility)
    // Ensure parent directory exists
    await fs.mkdir(path.dirname(configPath), { recursive: true })

    // Append the new directory entry
    await fs.appendFile(configPath, entry)
```

Analysis basis: CC v2.1.163 bundle.js:+13168274 (`b6A` entry), +13168310 (realpath), +13168497 (readFile), +13168593 (mkdir), +13168602 (dirname), +13168674 (appendFile), +13168635 (448 limit), +13168702 (384 limit), +13167973 ("production"), +13168070 ("test"), +177636 ("NFC")

---

### Directory reindexing (`reindexDirectory` — maps to `uL9`)

```
async function reindexDirectory(resolvedPath):

    // Clear stale background cache entries (oj → _7H.delete)
    clearStaleEntries()

    // Stat all files under the new directory tree (e9 → I2.stat via Promise.all)
    stats = await Promise.all(files.map(f => fs.stat(path.join(resolvedPath, f))))

    // For each file: read content, parse JSON where applicable (B6 → JSON.parse)
    // Track state order ("order", "stateOrder") and warn on unknown states
    // Write updated index (ff → MY: randomBytes, writeFile, rename, copyFile)
    // Log telemetry: tengu_bg_state_read_transient on transient state reads

    updateFileIndex(resolvedPath)
```

Analysis basis: CC v2.1.163 bundle.js:+4163385 (oj clear), +4163403 (e9 stat), +4159995 (Promise.all), +4160008 (I2.stat), +4160358 (tengu_bg_state_read_transient), +4163568 (ff write), +4159607 (MY), +2283564 (randomBytes)

---

### Permission-rule refresh (`refreshPermissionRules` — maps to `J$`)

```
function refreshPermissionRules(sessionState):

    // Rebuild allow / alwaysAllowRules and deny / alwaysDenyRules / alwaysAskRules
    // from the current session permission context (J$ → v path-pattern helper)
    // Escape special chars: "\\", "\(", "\)"
    // Process addRules, replaceRules, removeRules, removeDirectories operations
    // Update internal rule map (A.set, A.delete, K.filter, L.has)

    return updatedRuleSet
```

Analysis basis: CC v2.1.163 bundle.js:+4751769 (`J$` → `v`), +4752047 ("addRules"), +4752232 ("allow"), +4752240 ("alwaysAllowRules"), +4752272 ("deny"), +4752279 ("alwaysDenyRules"), +4752297 ("alwaysAskRules"), +4752395 ("replaceRules"), +4753052 ("removeRules"), +4753436 ("removeDirectories"), +1208653 ("\\\\"), +1208676 ("\\("), +1208698 ("\\)")

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_bg_state_read_transient` (bundle.js:+4160358) — fired when transient background state is read during reindexing; `tengu_feature_sad` (bundle.js:+1010365) — fired on feature-error path; `tengu_daemon_config_reload` (bundle.js:+16148704) — fired when daemon config is reloaded after the directory is added |
| localSettings mutation | `addDirectories` list is appended with the resolved real path (bundle.js:+10918193, +10918240) |
| Tool-permission context | `setToolPermissionContext` is called with the new path to extend sandbox scope (bundle.js:+10918267) |
| Config file on disk | `b6A` appends an entry via `fs.appendFile`; creates parent directories as needed with `fs.mkdir` (bundle.js:+13168593, +13168674) |
| File index / background cache | `uL9` clears stale cache, stats the new tree, and writes an updated index via atomic rename (bundle.js:+4163385, +4163568) |
| Config refresh | `kA.refreshConfig` is called after persistence (bundle.js:+10918351) |
| CLI equivalent | The string `--add-dir` appears in literals (bundle.js:+10918381), indicating the same operation is available as a CLI flag |
| Bypass-permissions guard | If `bypassPermissions` mode is not available, the permission-context update is silently skipped with a logged warning (bundle.js:+4751771) |
| Sound | None detected in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.163 | Initial analysis |

---

## Common Mistakes

1. **Providing a file path instead of a directory path** — The handler calls `fs.stat` and checks `isDirectory()`; a plain file path returns a `notADirectory` error and no directory is added.
2. **Supplying a path already covered by an existing working directory** — The handler compares resolved real paths and returns `alreadyInWorkingDirectory` without re-registering the duplicate.
3. **Using a relative path in a context where the CWD is unexpected** — The handler resolves relative paths against the process CWD at invocation time; if the shell CWD differs from the project root the resolved path may not be what the user intended.
4. **Omitting the path argument entirely** — With no argument the handler immediately returns "Please provide a directory path." without touching any state (bundle.js:+3844938).
5. **Paths requiring elevated permissions** — `EACCES` and `EPERM` errors are both mapped to the `notADirectory` result code rather than a distinct permissions error, so the user sees a misleading message; the actual cause is a permission denial.
6. **Expecting immediate tool availability** — The reindexing step (`uL9`) is asynchronous; tools that enumerate files in the new directory may not reflect the full index until the background stat pass completes.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `gOf` | Top-level async handler for `/add-dir` (Arbor-resolved entry point) |
| `R_` | App-state resolver; extracts working-directory context fields |
| `v` | Path-pattern helper / permission-rule builder utility |
| `ccK` | Internal utility called by path-pattern helper (depth-1 from `v`) |
| `SH` | JSON serialisation helper (wraps `JSON.stringify`) |
| `J4` | Path segment extractor (uses `lastIndexOf`, `slice`, `at`) |
| `ppH` | Secondary path helper (calls `h2A`) |
| `icK` | Directory content scanner (stat, Buffer.byteLength, AU6 promise chain) |
| `e$` | App-state accessor |
| `Pw_` | String split/trim/indexOf/slice utility |
| `ZHH` | Set membership checker (`g44.has`) |
| `uj` | String replace utility |
| `t1` | Composed path normaliser (calls `D6H`, `Aq`, `eX`) |
| `D6H` | Core normalisation step within `t1` |
| `Aq` | Token classifier / model-name parser (`opusplan`, `sonnet`, `haiku`, `opus`, `best`) |
| `eX` | Wrapper around `Aq` with additional processing |
| `s6` | UI component helper (calls `c`, `P6`) |
| `P6` | Nested UI helper (calls `Nu6`) |
| `mk8` | Permission-context builder variant A (calls `L1`) |
| `pk8` | Permission-context builder variant B (calls `L1`) |
| `L1` | Shared permission-context construction core |
| `J$` | Permission-rule refresh orchestrator |
| `pM` | Rule-text processor (calls `MT4`) |
| `MT4` | String `replaceAll` wrapper for rule escaping |
| `Gy` | Unknown utility called early in `gOf` (depth-2 not traversed) |
| `Y` | Supervisor / display-update manager (stop/start/updateConfig cycle) |
| `C0H` | Error-code inspector (checks `ENOENT`, `Object.keys`) |
| `N9` | Async-local-storage store getter (`FZL.getStore`) |
| `v8` | Error classification helper |
| `w7A` | Error metadata builder (calls `D7A`) |
| `EH` | String coercion wrapper |
| `iLK` | Column-width calculator (`Math.max`, `Object.keys`) |
| `E` | Keyboard-event handler (`preventDefault`, delegates to `Y`, `H`) |
| `t0` | Config-write dispatcher (calls `r_`) |
| `r_` | Config-write core (reads/writes `userSettings`, `projectSettings`, etc.) |
| `T` | Spinner / progress indicator (stop/updateConfig/start) |
| `LmK` | Display-update helper (calls `L8H`) |
| `L8H` | Heartbeat manager |
| `V` | Secondary spinner (start) |
| `t46` | Unknown utility invoked after permission-context update |
| `b6A` | Config-persistence handler (realpath, readFile, mkdir, appendFile) |
| `m0H` | Environment detector (`production` / `test`) |
| `eH` | String coercion utility (used in logging) |
| `AMK` | Config-path resolver |
| `Kx` | Config-format helper |
| `MO` | Path normaliser (NFC, `H.normalize`) |
| `R8` | Error handler / re-thrower |
| `JR` | Utility calling `uv` |
| `X_` | Secondary utility calling `uv` |
| `kH` | Error-logging utility (calls `HA`, `Dq`, `HW4`, `Er.logError`) |
| `HA` | Error-message formatter |
| `Dq` | Error-detail extractor (calls `RSA`) |
| `RSA` | Low-level error-string builder |
| `HW4` | Sliding-window log buffer (`kd6.shift` / `kd6.push`) |
| `uL9` | Directory reindexing orchestrator (calls `oj`, `e9`, `ff`, `kH`) |
| `oj` | Cache-clear helper (`_7H.delete`) |
| `e9` | File-stat and index-update core |
| `tf` | Transient-state classifier (calls `v8`) |
| `B6` | JSON-parse wrapper |
| `ff` | Atomic index writer (calls `MY`, path join, `SH`) |
| `MY` | Atomic file-write implementation (randomBytes, writeFile, rename, copyFile, unlink) |
| `P_H` | Permission-display renderer (calls `jN_`, `XO9`, `x8`, `r_`) |
| `jN_` | Permission-display sub-component |
| `XO9` | Rule-list renderer (calls `TP6`, `AiL`, `LiL`, `r_`) |
| `TP6` | Rule-item renderer (calls `x8`) |
| `x8` | Low-level render primitive (calls `Pl6`, `Kd`) |
| `AiL` | Rule-entry formatter (calls `cO`, `R$`, `Q6`, `oP`) |
| `cO` | Path-display helper (calls `HzH`, `Kd`) |
| `R$` | Realpath resolver (`realpathSync`, `S$`, `Nj`) |
| `Q6` | Shared utility (used across multiple callers) |
| `oP` | Path-output formatter (calls `Zr`) |
| `LiL` | Rule-list secondary renderer |
| `y3` | Tool-name formatter (`OT4`, `PE`, `zT4`, `$T4`, substring) |
| `OT4` | Tool-name prefix handler |
| `PE` | `Object.hasOwn` wrapper |
| `zT4` | Tool-name transformation step |
| `$T4` | `replaceAll` wrapper for tool names |
| `M` | MCP-server manager (calls `AbH`, `tU8`, `VYA`) |
| `AbH` | MCP connection builder (handles stdio/sse/http/sse-ide/ws-ide types) |
| `tU8` | MCP connection-result applier (`applyMcpUpdate`, cleanup, `mk`, `dD`) |
| `VYA` | MCP server-list reconciler (`getClients`, `AbH`, `tU8`) |
| `hnH` | Path-validation orchestrator (calls `Z1`, `A19.stat`, `yI`) |
| `Z1` | Canonical path resolver (tilde, Windows, null-byte check, isAbsolute) |
| `b6` | Config-store accessor (calls `bd6`, `X_`) |
| `bd6` | Async-local-storage config reader (`Cd6.getStore`) |
| `$a` | Secondary state accessor (calls `X_`) |
| `yI` | macOS `/var`→`/private/var` and `/tmp` path remapper |
| `L5A` | Path helper within `yI` (calls `a6`, `IV`) |
| `Nz` | Case-insensitive comparator (`H.toLowerCase`) |
| `yHH` | Post-remap path finaliser |
| `SnH` | Success-banner renderer (bold directory name, dirname hint) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.