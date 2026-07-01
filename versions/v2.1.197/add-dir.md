---
type: feature-spec
feature: "add-dir"
cc_version: "2.1.197"
updated: "2026-07-01"
tags: ["add-dir", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.197 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/add-dir`

> Analysis basis: CC v2.1.197 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.197

---

## Overview

The `/add-dir` command adds a new working directory to the current Claude Code session. It accepts a filesystem path argument, validates the path (resolving `~` expansion, checking existence, and confirming the target is a directory rather than a file), then registers the path into the active session's multi-directory workspace. Upon success it refreshes the tool-permission context, reloads configuration, and re-renders the directory list in the UI.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `add-dir` |
| description | Add a new working directory |
| argumentHint | `<path>` |
| module_id | `b1l` |
| load_inline | `true` |
| loc_byte | `11472906` |
| loc_byte_end | `11473054` |
| loc_line | `7301` |
| arbor_handler.name | `dPf` |
| arbor_handler.fqn | `claude-2.1.197::dPf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.197 bundle.js:+11472906

---

## Input Branching

The command has more than three distinct outcome branches depending on the supplied path argument, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A[User runs /add-dir <path>] --> B{Path argument provided?}
    B -- No / empty --> C[Error: 'Please provide a directory path.'\nReturn 'Did not add a working directory.']
    B -- Yes --> D[Resolve & normalize path\nExpand ~/ → home dir\nHandle Windows separators]
    D --> E{Path contains null bytes?}
    E -- Yes --> F[Error: 'Path contains null bytes'\nAbort]
    E -- No --> G[stat() the resolved path]
    G --> H{stat() succeeds?}
    H -- No / ENOENT --> I[Error type: pathNotFound\nReturn 'Did not add a working directory.']
    H -- Yes --> J{Is it a directory?}
    J -- No (isFile = true) --> K[Error type: notADirectory\nReturn 'Did not add a working directory.']
    J -- Yes --> L{Path already in working directories?}
    L -- Yes --> M[Error type: alreadyInWorkingDirectory\nReturn 'Did not add a working directory.']
    L -- No --> N[Validate via path-safety checker\ne.g. /var/ → /tmp remapping]
    N --> O{Permission / policy check passes?}
    O -- Bypass-permissions blocked by org policy --> P[Log: 'Bypass permissions mode was disabled\nby your organization policy'\nEmit tengu_disable_bypass_permissions_mode]
    O -- Bypass-permissions blocked by settings --> Q[Log: 'Bypass permissions mode was disabled\nby settings']
    O -- Allowed --> R[Call addDirectories with resolved path\nusing localSettings scope]
    R --> S[setToolPermissionContext\nRefresh permission rules]
    S --> T[clearSkillIndexCache\nReload config via Oo.refreshConfig\nEmit config-change event via A2.emit]
    T --> U[Re-index working dirs\nRe-render directory list JSX\nShow bold path + dim hint text]
    U --> V[Success: display updated directory list]
```

Analysis basis: CC v2.1.197 bundle.js:+11471695 (handler entry `dPf`), +11471852 (`_0` path check), +3998837 (`emptyPath`), +3998935 (`notADirectory`), +3999080 (`pathNotFound`), +3999212 (`alreadyInWorkingDirectory`)

---

## Behavioral Spec

### 1. Handler Entry — `addDirHandler` (`dPf`)

The top-level handler is an `AsyncFunction` resolved via `module_id → b1l`.

```
async function addDirHandler(commandContext):
    rawPath = commandContext.argument   // e.g. "~/projects/foo"

    // 1. Retrieve current app state and existing working directories
    appState        = getAppState()
    workingDirs     = appState.findLast(entry => entry.type == "working_directory")
    allowedTools    = appState.findLast(entry => entry.type == "allowed_tools")
    disallowedTools = appState.findLast(entry => entry.type == "disallowed_tools")
    avoidPrompts    = appState.findLast(entry => entry.type == "avoid_prompts")
    permissionMode  = appState.findLast(entry => entry.type == "permission_mode")

    // 2. Validate and resolve the path (see validateAndResolvePath below)
    result = await validateAndResolvePath(rawPath, workingDirs)
    if result.error:
        return renderErrorJSX(result.error)   // shows "Did not add a working directory."

    resolvedPath = result.path

    // 3. Update tool permission context with the new directory
    commandContext.setToolPermissionContext(resolvedPath)

    // 4. Apply permission-rule set (addDirectories, localSettings scope)
    updatePermissionRules({
        action:    "addDirectories",
        scope:     "localSettings",
        path:      resolvedPath
    })

    // 5. Post-add housekeeping
    clearSkillIndexCache()
    reloadMCPDirectories()        // Z0 → eW, tnr, PPl, dze
    clearToolCache()              // EG → QYt.clear
    emitConfigChange()            // A2.emit
    refreshConfig()               // Oo.refreshConfig
    appendSessionLog(resolvedPath) // RUo → Ll.appendFile

    // 6. Re-render UI
    return renderDirectoryListJSX(appState, resolvedPath)
```

Analysis basis: CC v2.1.197 bundle.js:+11471695 (`dPf`→`Ur`), +11471731 (`addDirectories` literal), +11471778 (`localSettings` literal), +11471805 (`setToolPermissionContext`), +11471875 (`dhe`), +11471889 (`Z0`), +11471899 (`EG`), +11471904 (`A2.emit`), +11471914 (`Oo.refreshConfig`), +11471933 (`RUo`)

---

### 2. Path Resolution & Validation — `validateAndResolvePath` (`Tlt` + `ps`)

```
async function validateAndResolvePath(rawInput, existingWorkingDirs):
    // Guard: empty or whitespace-only path
    if rawInput is empty or blank:
        return { error: "emptyPath",
                 message: "Please provide a directory path." }

    // Normalize: tilde expansion, null-byte check, Windows separator fixup
    trimmed = rawInput.trim()
    if trimmed contains null bytes:
        return { error: "nullBytes",
                 message: "Path contains null bytes" }
    if trimmed starts with "~/":
        trimmed = os.homedir() + trimmed.slice(1)
    if platform == "windows":
        trimmed = trimmed.replace(windowsSeparators)
    normalized = path.normalize(trimmed)
    if not path.isAbsolute(normalized):
        normalized = path.resolve(normalized)

    // /var/ → /tmp remapping (macOS symlink flattening)
    normalized = normalized.replace(/\/var\//, "/tmp$1")  // IR function

    // Filesystem check
    try:
        stat = await fs.stat(normalized)
    catch err:
        if err.code == "ENOENT":
            return { error: "pathNotFound",
                     message: "Did not add a working directory." }
        throw err

    if not stat.isDirectory():
        return { error: "notADirectory",
                 message: "Did not add a working directory." }

    // Duplicate check
    for each dir in existingWorkingDirs:
        if dir.path == normalized:
            return { error: "alreadyInWorkingDirectory",
                     message: "Did not add a working directory." }

    return { path: normalized }
```

Analysis basis: CC v2.1.197 bundle.js:+3998837 (`emptyPath`), +3998890 (`DVi.stat`), +3998935 (`notADirectory`), +3999080 (`pathNotFound`), +3999141 (`i9`), +3999172 (`IR`), +3999212 (`alreadyInWorkingDirectory`), +3999425 (`"Please provide a directory path."`), +1101308 (`"Path contains null bytes"`), +1101405 (`_mn.homedir`), +1101565 (`sN.isAbsolute`), +13709434–+13709475 (`/var/` → `/tmp$1`)

---

### 3. App-State Config Reader — `readAppStateFields` (`Ur`)

```
function readAppStateFields(appState):
    // Extracts the last-set value for each recognised config key
    workingDir   = appState.findLast(e => e.type == "working_directory")
    allowedTools = appState.findLast(e => e.type == "allowed_tools")
    disallowed   = appState.findLast(e => e.type == "disallowed_tools")
    avoidPrompts = appState.findLast(e => e.type == "avoid_prompts")
    permMode     = appState.findLast(e => e.type == "permission_mode")
    bypassPerms  = appState.findLast(e => e.type == "bypassPermissions")
    // Additional fields: session, effort, model, max_thinking_tokens, flag_settings
    return { workingDir, allowedTools, disallowed, avoidPrompts,
             permMode, bypassPerms, ... }
```

Analysis basis: CC v2.1.197 bundle.js:+11149507 (`e.getAppState`), +11149587 (`n.findLast`), +11149612 (`"working_directory"`), +11149667 (`"allowed_tools"`), +11149722 (`"disallowed_tools"`), +11149783 (`"avoid_prompts"`), +11149885 (`"permission_mode"`), +11149916 (`"bypassPermissions"`)

---

### 4. Permission Rule Update — `updatePermissionContext` (`OH`)

```
function updatePermissionContext(action, payload, permissionSet):
    if action == "setMode" and mode == "bypassPermissions":
        if orgPolicyDisablesMode:
            log("Bypass permissions mode was disabled by your organization policy")
            emit(tengu_disable_bypass_permissions_mode)
            return
        if settingsDisableMode:
            log("Bypass permissions mode was disabled by settings")
            return

    if action == "addRules":
        mergeRules(permissionSet, payload, {
            allow: "alwaysAllowRules",
            deny:  "alwaysDenyRules",
            ask:   "alwaysAskRules"
        })
    elif action == "replaceRules":
        replaceRules(permissionSet, payload)
    elif action == "removeRules":
        deleteRules(permissionSet, payload)
    elif action == "addDirectories":
        permissionSet.set(payload.path)
    elif action == "removeDirectories":
        permissionSet.delete(payload.path)
```

Analysis basis: CC v2.1.197 bundle.js:+5450870 (`OH`→`T`), +5450784 (`"setMode"`), +5450872 (bypass-permissions warning text), +5451148 (`"addRules"`), +5451333 (`"allow"`), +5451373 (`"deny"`), +5451496 (`"replaceRules"`), +5452153 (`"removeRules"`), +5452463 (`o.filter`), +5452537 (`"removeDirectories"`)

---

### 5. Session Log Append — `appendSessionLog` (`RUo`)

```
async function appendSessionLog(newDirPath):
    logDir  = path.join(sessionLogBase, ...)
    logFile = path.join(logDir, sessionId + ".log")
    await fs.mkdir(logDir, { recursive: true })
    entry   = formatLogEntry({ type: "add_dir", path: newDirPath })
    await fs.appendFile(logFile, entry)
```

Analysis basis: CC v2.1.197 bundle.js:+13622460 (`v4`), +13622495 (`Ll.realpath`), +13622847 (`Ll.mkdir`), +13622998 (`Ll.appendFile`)

---

### 6. UI Rendering — `renderAddDirResult` (`dPf` JSX section)

```
function renderAddDirResult(error, updatedDirs, addedPath):
    if error:
        lines = [
            bold("Unknown error" or specific error message),
            dim("· /permissions to manage"),
            text("Did not add a working directory.")
        ]
        return jsx(ErrorBox, { lines })

    // Success path: render updated directory list
    primaryLabel   = "the current working directory"   // first entry
    additionalLabel = "the additional working directory" // subsequent entries
    items = updatedDirs.map((dir, idx) =>
        jsx(DirRow, {
            label: idx == 0 ? primaryLabel : additionalLabel,
            path:  dir.path
        })
    )
    return jsx(DirectoryList, { items })
```

Analysis basis: CC v2.1.197 bundle.js:+11471992 (`It.bold`), +11472278 (`It.dim`), +11472285 (`"· /permissions to manage"`), +11472337 (`cTe.jsx`), +11472403 (`"Did not add a working directory."`), +11472177 (`"Unknown error"`), +3999925 (`"the current working directory"`), +3999957 (`"the additional working directory"`)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_disable_bypass_permissions_mode` | Fired when `setMode bypassPermissions` is rejected due to org policy or settings (bundle.js:+3441348) |
| Telemetry — `tengu_daemon_config_reload` | Fired inside the daemon's config-reload path, reachable after directory addition (bundle.js:+18054237) |
| Telemetry — `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` | Feature-flag check results within the path-validation call chain (bundle.js:+1028779, +1028846, +1028927) |
| Telemetry — `tengu_bg_state_read_transient` | Emitted during background state read for the working-dir index (bundle.js:+4337098) |
| appState changes | Appends a `working_directory` entry to the in-memory app state map |
| Tool permission context | `setToolPermissionContext` is called with the new directory path (bundle.js:+11471805) |
| Settings write | Directory is appended to `localSettings` (`.claude/settings.local.json`) via `addDirectories` (bundle.js:+11471731, +11471778) |
| Skill-index cache | Cleared via `e.clearSkillIndexCache` after the directory is registered (bundle.js:+13606911) |
| MCP directory index | Refreshed via `Z0` → `eW` / `tnr` / `PPl` / `dze` (bundle.js:+11471889) |
| Tool cache | Cleared via `EG` → `QYt.clear` (bundle.js:+11273840) |
| Config reload event | `A2.emit` fires a config-change event; `Oo.refreshConfig` reloads from disk (bundle.js:+11471904, +11471914) |
| Session log | New directory path appended to the session `.log` file via `Ll.appendFile` (bundle.js:+13622998) |
| Sound | None observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.197 | Initial analysis |

---

## Common Mistakes

1. **Omitting the path argument** — Running `/add-dir` with no argument triggers the `emptyPath` branch and returns "Please provide a directory path." The command requires exactly one `<path>` argument (bundle.js:+3999425).
2. **Passing a file path instead of a directory** — If the resolved path points to a regular file, the `notADirectory` error fires and the directory is not added. Use the parent directory path instead (bundle.js:+3998935).
3. **Specifying a path that does not exist** — The command calls `fs.stat()` synchronously; a missing path yields `pathNotFound` / "Did not add a working directory." Create the directory first (bundle.js:+3999080).
4. **Re-adding an already-registered directory** — The command checks the existing working-directory list and rejects duplicates with `alreadyInWorkingDirectory` (bundle.js:+3999212).
5. **Expecting `/var/...` paths to persist as-is on macOS** — The handler remaps `/var/` to `/tmp` before storing, so the canonical path displayed may differ from the argument supplied (bundle.js:+13709434).
6. **Assuming the change is project-scoped** — The directory is written to `localSettings` (`.claude/settings.local.json`), not `projectSettings` (`settings.json`); it is therefore machine-local and not committed to source control (bundle.js:+11471778).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `dPf` | Main async handler for `/add-dir` command (`addDirHandler`) |
| `Ur` | App-state field extractor (`readAppStateFields`) |
| `gtr` | Allowed-tools resolver helper |
| `htr` | Disallowed-tools resolver helper |
| `AR` | Permission-mode applicator |
| `WYr` | Bypass-permissions mode setter |
| `it` | Bypass-permissions policy enforcer |
| `OH` | Tool-permission context updater |
| `T` | Logger / debug output helper |
| `deu` | Debug transport initialiser |
| `Sis` | Log-sink multiplexer |
| `Me` | JSON serialiser helper |
| `Pc` | Path redaction / sanitiser |
| `scs` | Sensitive-value map builder |
| `KQe` | Log writer coordinator |
| `zls` | Raw stream writer |
| `geu` | Log-file rotation manager |
| `SQe` | Batched-write scheduler |
| `Che` | Log-header formatter |
| `Rae` | Log-directory resolver |
| `lcs` | Log-path joiner |
| `lTr` | Log-file rename / rotation helper |
| `meu` | Log-file append worker |
| `vi` | Atexit / teardown hook registrar |
| `Up` | Path escaper for display |
| `oBu` | Backslash / paren escaper |
| `_0` | Null-byte / empty-path guard |
| `TYe` | Filesystem stat + file-type checker |
| `Ks` | Async-local-storage store accessor |
| `eWo` | Git-ignore rule helper (inner) |
| `he` | Error-code string coercer |
| `Cic` | Directory-entry width calculator |
| `E` | SDK/MCP client session manager |
| `$Ct` | MCP transport key extractor |
| `g5c` | MCP transport object enumerator |
| `ke` | Error logger / rethrower |
| `er` | Error constructor wrapper |
| `ct` | String coercer |
| `zi` | Essential-traffic queue handler |
| `LNu` | Traffic-log ring-buffer manager |
| `A` | Background daemon process controller |
| `t_r` | Daemon args array normaliser |
| `e_r` | Daemon arg string processor |
| `H` | Process / connection manager |
| `eKc` | Heartbeat sender |
| `Vce` | Heartbeat payload builder |
| `I` | Ink / terminal renderer |
| `M` | OAuth / HTTP request router |
| `Pge` | JSON-stringify with size guard |
| `Gts` | JWT sign/verify helper |
| `j8c` | OAuth token-exchange handler |
| `ens` | Bearer-token prefix checker |
| `wts` | JWT utility loader |
| `AVc` | Device-authorisation flow initiator |
| `YHr` | Rate-limit back-off handler |
| `zie` | HTTP 400 JSON responder |
| `w8c` | Random float generator |
| `v8c` | Crypto random-bytes generator |
| `Pts` | SHA-256 hash builder |
| `Mts` | Device-grant token store writer |
| `zHr` | Token-store cleanup helper |
| `xon` | OAuth callback URL builder |
| `N` | HTTP request handler (inner) |
| `A8c` | OAuth-state cookie serialiser |
| `iXe` | OAuth redirect builder |
| `b8c` | OAuth vts token writer |
| `x` | Cookie parser |
| `Dts` | OAuth vts reader |
| `oe` | JWT claims verifier |
| `g` | Request-context getter |
| `ye` | Token-store set+delete helper |
| `hu` | j2m token formatter |
| `X` | Voice-stream recorder |
| `ne` | ID-token claims parser |
| `q` | JWT decoder |
| `s_r` | Header entry-filter helper |
| `DVc` | Metering / rate-limit timer |
| `NVc` | Concurrent-request circuit breaker |
| `pVc` | Model-list response builder |
| `aVc` | Allowed-beta-feature checker |
| `a` | Spend-check precheck handler |
| `cVc` | Request body parser / validator |
| `iVc` | Upstream API fetch with auth |
| `V` | Feature-flag evaluator |
| `dhe` | Post-add skill-index cache invalidator |
| `Z0` | MCP / tool-index refresher |
| `eW` | Skill-index cache clearer (async) |
| `tnr` | Tool-index refresh step 1 |
| `PPl` | Tool-index refresh step 2 |
| `dze` | Tool-index refresh step 3 |
| `X7t` | RZn map getter for tool index |
| `Y7t` | Tool-index inner updater |
| `QW` | Post-add hook dispatcher |
| `inr` | Hook invocation helper |
| `EG` | Tool-cache clearer |
| `RUo` | Session-log appender |
| `v4` | Session-log environment selector |
| `tuc` | Session-log path builder |
| `y5` | Session-log formatter |
| `z3e` | UL/uf storage helper |
| `UL` | Log-store upper layer |
| `uf` | Log-store lower layer (P0) |
| `UHd` | $Hd log-store wrapper |
| `o_` | Path NFC normaliser |
| `Sn` | rn-based error re-thrower |
| `t3` | H0 terminal-size helper |
| `dr` | H0 secondary terminal helper |
| `zo` | rn-based EACCES handler |
| `UJi` | dE + Yi + Jd + Jf orchestrator (settings write) |
| `dE` | Sre cache deleter |
| `Yi` | Settings file reader/writer |
| `u` | xe/Re/$F/Wj composite UI renderer |
| `xe` | V/Oe UI component A |
| `Re` | V/Oe UI component B |
| `$F` | D6/eJ/u5e/z7r UI component C |
| `Wj` | Promise.race exit-handler |
| `ld` | rn-based settings error logger |
| `Gt` | JSON.parse wrapper |
| `Jd` | rg-based settings backup writer |
| `rg` | Atomic file writer (randomBytes + copyFile + chmod) |
| `EBe` | n/ATs/On write-callback helper |
| `Jf` | rn/kae settings lock-file checker |
| `Cde` | nuo/Wfa/no settings-context builder |
| `nuo` | Settings source loader |
| `Wfa` | Settings merge helper |
| `mWe` | fn/I3 policy-settings loader |
| `fn` | Ggn/I3 flag-settings helper |
| `Pgp` | Lg/Gd/qt/nw/$a path-scope resolver |
| `Lg` | Hwe/I3 settings-scope loader |
| `Gd` | Dc/bp/jE/YLt/realpathSync path canonicaliser |
| `nw` | Ste settings-watcher helper |
| `Ugp` | User-settings scope provider |
| `wg` | iBu/zM/aBu/sBu glob-pattern formatter |
| `iBu` | Glob pattern prefix builder |
| `zM` | Object.hasOwn-based property checker |
| `aBu` | Glob pattern suffix builder |
| `sBu` | Glob replaceAll helper |
| `no` | LDr/I3/OMr/VBe/mRt/n_/zvs/Q5 settings-file writer orchestrator |
| `LDr` | KLs/Hwe/P8/VLs/v8 settings-directory resolver |
| `I3` | Full settings-schema loader (dr/NFe/vSr/kwt/RFe/MFe/Pwt/Ale/Ewe/Ygn/cxs/wte/hMt) |
| `OMr` | Zmn.set timestamp recorder |
| `VBe` | Fgn/I3 settings-validator |
| `mRt` | Atomic write-file-sync with rename |
| `n_` | _in/tEr cache clearer |
| `zvs` | nwe.mkdir/readFile/writeFile/appendFile settings-store manager |
| `Q5` | gN.join `.claude` path builder |
| `wt` | V/Oe UI render helper C |
| `O8` | h0/ga/xDr/I3/yin settings-overlay applier |
| `Tlt` | Path validator + stat checker (main validate function) |
| `ps` | Core path-resolution util (homedir, isAbsolute, resolve, null-byte guard) |
| `Ot` | nmn/dr async-local-storage context getter |
| `nmn` | tmn.getStore/l7 store accessor |
| `i9` | dr inner path helper |
| `IR` | ps/r.replace/o.replace/Xze/Hm/ule path normaliser with /var/→/tmp remap |
| `Xze` | jt/VM path-component validator |
| `Hm` | e.toLowerCase case normaliser |
| `ule` | Path trailing-slash normaliser |
| `Ilt` | It.bold / b2t.dirname result-card renderer |