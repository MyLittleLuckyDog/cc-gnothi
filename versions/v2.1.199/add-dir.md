---
type: feature-spec
feature: "add-dir"
cc_version: "2.1.199"
updated: "2026-07-03"
tags: ["add-dir", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.199 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/add-dir`

> Analysis basis: CC v2.1.199 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.199

---

## Overview

`/add-dir` registers an additional working directory with the current Claude Code session, expanding the file-system scope available to the agent. It validates the supplied path (resolving symlinks, checking it is a real directory, and confirming it is not already tracked), then persists the new entry to local settings, refreshes the session configuration, and renders a JSX confirmation UI with a permission management hint.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `add-dir` |
| description | `Add a new working directory` |
| argumentHint | `<path>` |
| module_id | `l5l` |
| load_inline | `true` |
| loc_byte | `11761158` |
| loc_byte_end | `11761306` |
| loc_line | `8477` |
| arbor_handler.name | `M6f` |
| arbor_handler.fqn | `claude-2.1.199::M6f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.199 bundle.js:+11761158

---

## Input Branching

Five or more distinct outcome paths exist, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/add-dir <path> invoked"]) --> B{Path argument present?}
    B -- No / empty --> C["Render error: 'Please provide a directory path.' (emptyPath)"]
    B -- Yes --> D["Resolve & normalize path\n(tilde expansion, symlink realpath)"]
    D --> E{stat() the path}
    E -- ENOENT --> F["Render error: pathNotFound"]
    E -- stat error other --> G["Render error: unexpected stat errno"]
    E -- Success --> H{Is it a directory?}
    H -- No (isFile=true) --> I["Render error: notADirectory"]
    H -- Yes --> J{Already in working directories?}
    J -- Yes --> K["Render error: alreadyInWorkingDirectory"]
    J -- No --> L["Call addDirectories via handler M6f"]
    L --> M["setToolPermissionContext with localSettings"]
    M --> N["Update permission rules via qH"]
    N --> O["Clear session caches via sW"]
    O --> P["Emit V2 event, refresh config via To.refreshConfig"]
    P --> Q["Write CLAUDE.md context file via p4o"]
    Q --> R["Reload tool definitions via doa"]
    R --> S["Render success JSX with bold path\n+ '· /permissions to manage' hint"]
    C --> Z([End])
    F --> Z
    G --> Z
    I --> Z
    K --> Z
    S --> Z
```

Analysis basis: CC v2.1.199 bundle.js:+11759941, +11760083, +11760150, +11760160, +4028086, +4028210, +4028423

---

## Behavioral Spec

### 1. Entry Point and Argument Extraction

The async handler `M6f` (resolved via `module_id → l5l`) receives the command argument string representing the user-supplied path.

```
async function addDirHandler(commandContext):
    rawPath = commandContext.args  // may be empty or undefined
    appState = getAppState(commandContext)
    permissionContext = appState.findLast(
        entry => entry.type == "working_directory"
    )
    ...
```

Analysis basis: CC v2.1.199 bundle.js:+11759941, +11434561, +11434641

### 2. Path Normalization

The raw path string is passed through `fs` (path resolution utility) which handles:
- Tilde (`~/`) expansion to the user home directory via `vHn.homedir`
- Unicode NFC normalization via `IN.normalize`
- Absolute path resolution via `IN.resolve` when the input is relative
- Null-byte rejection with the error message `"Path contains null bytes"`

```
function resolvePath(rawPath):
    if rawPath contains null byte:
        throw Error("Path contains null bytes")
    trimmed = rawPath.trim()
    if trimmed.startsWith("~/"):
        trimmed = homedir() + trimmed.slice(2)
    normalized = path.normalize(trimmed)
    if not path.isAbsolute(normalized):
        normalized = path.resolve(normalized)
    return normalized
```

Analysis basis: CC v2.1.199 bundle.js:+1105204, +1105255, +1105352, +1105383, +1105512, +1105566

### 3. Directory Validation (`Mut` / `validateDirectoryForWorkspace`)

`Mut` performs filesystem validation and returns a typed result object:

```
async function validateDirectoryForWorkspace(resolvedPath):
    if resolvedPath is empty:
        return { kind: "emptyPath" }
    try:
        stats = await cQi.stat(resolvedPath)
    catch err:
        if err.code == "ENOENT":
            return { kind: "pathNotFound" }
        logError(err)
        return { kind: "unexpectedStatError", message: err.message }
    if not stats.isDirectory():
        return { kind: "notADirectory" }
    realPath = await Ol.realpath(resolvedPath)
    // Compare against already-tracked working directories
    if realPath is already tracked:
        return { kind: "alreadyInWorkingDirectory" }
    return { kind: "ok", realPath: realPath }
```

Error string constants observed:
- `"emptyPath"` — bundle.js:+4027809
- `"notADirectory"` — bundle.js:+4027907
- `"pathNotFound"` — bundle.js:+4028086
- `"alreadyInWorkingDirectory"` — bundle.js:+4028210
- `"validateDirectoryForWorkspace: unexpected stat errno"` — bundle.js:+4027997

Analysis basis: CC v2.1.199 bundle.js:+4027828, +4027862, +4027907, +4028086, +4028210

### 4. Permission Context Update (`qH`)

After validation succeeds, the handler calls `qH` to update the in-session tool permission context. `qH` processes rules under the keys `"addRules"`, `"replaceRules"`, and `"removeRules"` (with sub-categories `"alwaysAllowRules"`, `"alwaysDenyRules"`, `"alwaysAskRules"`). It also handles `"addDirectories"` and `"removeDirectories"` directives. The `"setMode"` directive (for `"bypassPermissions"`) is explicitly guarded: if the session was not launched in bypass mode or if `disableBypassPermissionsMode` is set, the update is silently skipped with an internal log message beginning `"Ignoring permission update: setMode 'bypassPermissions' rejected"`.

```
function updatePermissionContext(context, update):
    if update.type == "setMode" and mode == "bypassPermissions":
        if not bypassPermissionsAvailable(context):
            log("Ignoring permission update: setMode 'bypassPermissions' rejected ...")
            return context  // no-op
    if update.type == "addDirectories":
        newDirs = update.directories
        context.workingDirectories = merge(context.workingDirectories, newDirs)
    // handle addRules / replaceRules / removeRules similarly
    return updatedContext
```

Analysis basis: CC v2.1.199 bundle.js:+11760083, +6939404, +6939492, +6939768, +6940116, +6940773, +6941157

### 5. Session State Refresh

After the permission context is persisted to `localSettings`, the handler performs a sequence of side-effect operations:

```
function refreshSessionAfterAddDir(session, newPath):
    session.setToolPermissionContext(updatedContext)  // +11760051
    clearSkillIndexCache(session)                      // via KW +13810733
    clearContextCache(sW)                              // QQt.clear +11560023
    V2.emit(changeEvent)                               // +11760150
    To.refreshConfig()                                 // +11760160
    writeContextFile(session, newPath, p4o)            // +11760179
    reloadToolDefinitions(doa)                         // +11760186
```

`p4o` (context file writer) performs the following sub-steps for each added directory:
- `Ol.realpath` to canonicalize the path
- `Ol.readFile` to check for an existing `CLAUDE.md`
- `Ol.mkdir` (recursive, mode `448` = octal `0700`) to create `.claude/` if absent — bundle.js:+13826875, +13826917
- `Ol.appendFile` (mode `384` = octal `0600`) to write the context block — bundle.js:+13827026, +13827054
- Constructs path entries with `jh.join` and `jh.dirname`

Analysis basis: CC v2.1.199 bundle.js:+11760051, +11760083, +11760145, +11760150, +11760160, +11760179, +11760186, +13826523, +13826875, +13827026

### 6. Tool Definition Reload (`doa`)

`doa` coordinates a two-phase tool reload:
- `ty` clears the existing tool cache (`_oe.delete`)
- `Yi` rescans all registered working directories, re-evaluating each directory's file listing and updating the background state. During this scan it uses `IE.lstat`, `IE.readFile`, and `_oe.set`/`_oe.get` for caching. The telemetry event `tengu_bg_state_read_transient` is emitted when a transient background state read occurs.
- `op` regenerates session metadata including cron scheduling (`"session_cron"` key)
- `Ff` finalises the reload, logging any errors through `ke`/`sr`

Analysis basis: CC v2.1.199 bundle.js:+11760186, +4366897, +4366915, +4367080, +4367185, +4361720

### 7. Rendered Output

The JSX component (type `local-jsx`) renders one of two states:

**Success path:**
```
Bold(resolvedPath)
" was added as " + label + "."
Dim("· /permissions to manage")
```

Where `label` is either `"the current working directory"` (bundle.js:+4028923) or `"the additional working directory"` (bundle.js:+4028955) depending on whether this is the first or a subsequent directory.

**Failure path:**
```
"Did not add a working directory."  // bundle.js:+11760655
ErrorDetail(validationResult)
"Unknown error"                     // fallback, bundle.js:+11760429
```

Analysis basis: CC v2.1.199 bundle.js:+11760244, +11760530, +11760537, +11760589, +11760655, +11760706, +4028923, +4028955

### 8. Bypass Permissions Guard (`wR` / `Feo`)

Before the main add-directory logic executes, `wR` calls `Feo` which checks whether `bypassPermissions` mode is active and permitted:
- If organizational policy prohibits it: logs `"Bypass permissions mode was disabled by your organization policy"` — bundle.js:+3466597
- If local settings disable it: logs `"Bypass permissions mode was disabled by settings"` — bundle.js:+3466738
- Emits `tengu_disable_bypass_permissions_mode` telemetry on either rejection.

Analysis basis: CC v2.1.199 bundle.js:+11434992, +3466597, +3466738, +3466547

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_disable_bypass_permissions_mode` (bundle.js:+3466547) — emitted when bypass permissions is rejected during the permission-context update; `tengu_bg_state_read_transient` (bundle.js:+4362670) — emitted during background tool-definition reload in `Yi` |
| `localSettings` mutation | New directory appended under `"addDirectories"` key (bundle.js:+11759977, +11760024) |
| Permission context | `setToolPermissionContext` called with updated `working_directory`, `allowed_tools`, `disallowed_tools`, `avoid_prompts`, `permission_mode`, `bypassPermissions` fields (bundle.js:+11434666–+11434970) |
| Cache invalidation | `QQt.clear()` via `sW` clears the session context cache (bundle.js:+11560023); `e.clearSkillIndexCache()` via `KW` clears the skill index (bundle.js:+13810733) |
| Config event | `V2.emit(...)` signals downstream subscribers of a working-directory change (bundle.js:+11760150) |
| Config refresh | `To.refreshConfig()` forces a full config re-read (bundle.js:+11760160) |
| CLAUDE.md / context file | `p4o` may create `.claude/` directory (mode `0700`) and append to `CLAUDE.md` (mode `0600`) in the new working directory (bundle.js:+13826875, +13827026) |
| Tool definitions | Full tool definition reload via `doa` → `ty` + `Yi` + `op` + `Ff` (bundle.js:+11760186) |
| CLI flag | The string `"--add-dir"` is emitted as the programmatic CLI equivalent (bundle.js:+11760190) |
| Sound | None observed |

---

## Version History

| Version | Change |
|---|---|
| v2.1.199 | Initial analysis |

---

## Common Mistakes

1. **Supplying a file path instead of a directory path** — the handler calls `stat()` and checks `isDirectory()`; passing a regular file path yields the `notADirectory` error and renders `"Did not add a working directory."`.
2. **Supplying a path already in the session's working directories** — after `realpath` resolution the handler compares against all currently tracked directories. An exact match (including after symlink resolution) produces `alreadyInWorkingDirectory`.
3. **Omitting the path argument entirely** — invoking `/add-dir` with no argument triggers the `emptyPath` branch and renders `"Please provide a directory path."` with no directory registered.
4. **Supplying a relative path without understanding resolution** — relative paths are resolved against `process.cwd()` at the time of invocation, not against any of the existing working directories. Use an absolute path to avoid ambiguity.
5. **Expecting instant tool visibility** — after a successful add, `doa` triggers an asynchronous tool-definition reload. There may be a brief window before newly accessible files appear in agent context.
6. **Assuming bypass-permissions mode carries over automatically** — if the session was not launched with `bypassPermissions`, any permission-rule updates referencing that mode will be silently dropped.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `M6f` | Primary async handler for `/add-dir` (arbor_handler) |
| `Or` | App-state accessor; reads permission context fields |
| `Msr` | Reads `allowed_tools` field from permission context |
| `Dsr` | Reads `disallowed_tools` field from permission context |
| `wR` | Bypass-permissions mode guard wrapper |
| `Feo` | Inner bypass-permissions check; emits telemetry on rejection |
| `ot` | Core permission-mode evaluation helper |
| `qH` | Permission-context update dispatcher (addRules / replaceRules / removeRules / addDirectories) |
| `kqu` | Rule-string escape/normalizer (replaceAll) |
| `qp` | Rule serializer used by permission context |
| `xe` | JSON serialization utility |
| `w0` | Working-directory list accessor |
| `vJe` | Directory stat and validation helper |
| `Qs` | Async-local store accessor |
| `m7o` | File-metadata helper |
| `ge` | String coercion utility |
| `ihc` | Permission-entry key mapper |
| `E` | Supervisor/daemon process manager |
| `VQe` | Supervisor state evaluator |
| `yYc` | Supervisor key enumerator |
| `ke` | Error classifier and logger |
| `sr` | Error stringifier |
| `at` | String coercion wrapper |
| `Pi` | Traffic-priority classifier (`essential-traffic`) |
| `Gku` | Request-queue manager (shift/push) |
| `b` | MCP server lifecycle manager (start/stop/updateConfig) |
| `KAr` | MCP server array checker |
| `qAr` | MCP server name normalizer |
| `H` | MCP server process handle |
| `iru` | MCP heartbeat scheduler |
| `Mue` | Heartbeat interval constant |
| `I` | Input event handler / key reader |
| `R` | HTTP request router (large; covers OAuth, MCP, inference routes) |
| `SHe` | Session-context accessor |
| `ak` | Skill-index refresh coordinator |
| `KW` | Skill-index cache invalidator |
| `Eir` | Additional skill-index helper |
| `y9l` | Skill-index helper |
| `cqe` | Skill-query executor |
| `$Vt` | Skill-store getter |
| `Oj` | Tool-registration orchestrator |
| `Iir` | Tool-registration inner helper |
| `sW` | Session context-cache clearer (`QQt.clear`) |
| `p4o` | CLAUDE.md / context-file writer for new working directory |
| `K2` | Environment/mode detector (production/test) |
| `I4e` | Internal config-path resolver |
| `Ef` | Config writer |
| `fLd` | Config serializer |
| `vH` | Path NFC normalizer |
| `pn` | Error message formatter |
| `L3` | Async utility (`Aw`) |
| `ar` | Async utility (`Aw`) — concurrent helper |
| `Mo` | EACCES/EPERM/ENOTDIR/ELOOP error handler |
| `doa` | Full tool-definition reload coordinator |
| `ty` | Tool cache invalidator (`_oe.delete`) |
| `Yi` | Directory scanner and background-state rebuilder |
| `Wfc` | File-change watcher callback |
| `yV` | Path normalizer (Windows/POSIX) |
| `_d` | Error string builder |
| `Wt` | JSON.parse wrapper |
| `Zio` | Directory-entry filter |
| `Qio` | Sort/order helper for directory entries |
| `UUn` | Case-insensitive directory-entry matcher |
| `op` | Session-cron metadata generator |
| `Qg` | Cron-tick handler |
| `tk` | Cron-state activator |
| `Uf` | Atomic file writer (randomBytes + writeFile + copyFile + chmod + unlink) |
| `d_e` | File-write sub-helper |
| `Ff` | Final reload step; error-log wrapper |
| `$pe` | MCP tool-description builder |
| `yyo` | MCP tool-name formatter |
| `QOa` | MCP tool-list aggregator |
| `B8e` | Policy-settings accessor |
| `kn` | Policy-settings inner accessor |
| `Hf` | MCP tool-definition loader |
| `Qh` | MCP tool-definition inner resolver |
| `fKu` | MCP tool-definition full loader (handles gitignore, flags) |
| `Wg` | MCP tool-description escape helper |
| `Mqu` | MCP description normalizer |
| `rD` | Object.hasOwn guard |
| `Dqu` | MCP description substring extractor |
| `Rqu` | MCP description replaceAll sanitizer |
| `Qo` | MCP tool-definition cache entry |
| `Mut` | `validateDirectoryForWorkspace` — stat + isDirectory + realpath + duplicate check |
| `fs` | Path resolution and validation utility (tilde, null-byte, absolute) |
| `Dt` | Async-local store reader for path context |
| `pHn` | Store-context getter |
| `O9` | Path-join helper |
| `kR` | Path sanitizer (/var/ → /tmp replacement) |
| `YYe` | Platform path normalizer |
| `$f` | Case-fold helper for path comparison |
| `Qle` | Remaining path-validation helper |
| `Dut` | Success JSX renderer (bold path + dim hint) |