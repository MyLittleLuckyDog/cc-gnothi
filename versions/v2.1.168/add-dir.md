---
type: feature-spec
feature: "add-dir"
cc_version: "2.1.168"
updated: "2026-06-11"
tags: ["add-dir", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.168 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/add-dir`

> Analysis basis: CC v2.1.168 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.168

---

## Overview

`/add-dir` registers an additional working directory with the running Claude Code session. It validates the supplied path (resolving `~`-prefixes, checking existence, confirming it is a directory, and verifying it has not already been added), then updates the session's working-directory list, reloads per-directory configuration, refreshes the tool-permission context, and returns a JSX confirmation panel to the UI.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `add-dir` |
| description | Add a new working directory |
| argumentHint | `<path>` |
| module_id | `Quq` |
| load_inline | `true` |
| loc_byte | `10948145` |
| loc_byte_end | `10948293` |
| loc_line | `7244` |
| arbor_handler.name | `PDf` |
| arbor_handler.fqn | `claude-2.1.168::PDf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.168 bundle.js:+10948145

---

## Input Branching

Seven distinct outcomes are possible depending on path validation results, making a flowchart the appropriate representation.

```mermaid
flowchart TD
    A(["/add-dir <path> invoked"]) --> B{Path argument\npresent?}
    B -- No --> ERR1["Return error:\n'Please provide a directory path.'"]
    B -- Yes --> C[Resolve & normalise path\n(expand ~, normalise separators,\nresolve to absolute)]
    C --> D{Path contains\nnull bytes?}
    D -- Yes --> ERR2["Throw TypeError:\n'Path contains null bytes'"]
    D -- No --> E[fs.stat the path]
    E --> F{stat result?}
    F -- "ENOENT / path not found" --> ERR3["Return result: 'pathNotFound'"]
    F -- "EACCES / EPERM" --> ERR4["Return result: 'notADirectory'\n(permission denied)"]
    F -- "Not a directory" --> ERR5["Return result: 'notADirectory'"]
    F -- "Directory OK" --> G{Already in\nworking directory list?}
    G -- Yes --> ERR6["Return result:\n'alreadyInWorkingDirectory'"]
    G -- No --> H[Add directory to session state\nvia addDirectories update]
    H --> I[Reload per-dir config\n(__A: readFile → mkdir → appendFile)]
    I --> J[Refresh tool-permission context\n(setToolPermissionContext)]
    J --> K[Apply local/user/policy settings\n(oM: addRules / replaceRules / removeRules)]
    K --> L[Emit JSX success panel\nwith bold directory name + permissions hint]
    L --> DONE(["Return result: 'success'"])
```

---

## Behavioral Spec

### Top-level handler (addDir)

Analysis basis: CC v2.1.168 bundle.js:+10946926

```
async function addDir(commandInput, appState):

    # 1. Retrieve current session context
    sessionContext = getAppState(appState)          # b_ → H.getAppState
    lastConversation = sessionContext.findLast(...)  # b_ → A.findLast

    # 2. Extract & validate the path argument
    rawPath = commandInput.trim()
    if rawPath is empty:
        return renderErrorPanel("Please provide a directory path.")

    # 3. Resolve the path to an absolute, normalised form
    resolvedPath = resolvePath(rawPath)             # WiH → T1

    # 4. Stat the resolved path (async)
    statResult = await fs.stat(resolvedPath)        # WiH → V99.stat
    if statResult indicates error:
        errorKind = mapStatErrorToKind(statResult)
        # errorKind ∈ {"emptyPath","notADirectory","pathNotFound",
        #               "alreadyInWorkingDirectory"}
        return renderErrorPanel(errorKind)

    # 5. Guard: already tracked?
    if resolvedPath already in sessionContext.workingDirectories:
        return renderErrorPanel("alreadyInWorkingDirectory")

    # 6. Commit the new directory
    updateAppState(appState, {addDirectories: [resolvedPath]})   # literal: "addDirectories" +10946962

    # 7. Load & merge per-directory settings
    reloadDirectoryConfig(resolvedPath)              # __A
    refreshConfig(NA)                                # NA.refreshConfig  +10947120

    # 8. Update tool-permission context
    setToolPermissionContext(_, localSettings)        # +10947036 / "localSettings" +10947009

    # 9. Apply MCP / permission rules from merged settings
    applyPermissionSettings(oM, resolvedPath)        # oM +10947068

    # 10. Render result JSX
    return renderSuccessPanel(resolvedPath)
```

---

### Path resolution (resolvePath)

Analysis basis: CC v2.1.168 bundle.js:+3851463 (handler `T1`)

```
function resolvePath(rawPath):
    path = rawPath.trim()
    if path contains null bytes:
        throw TypeError("Path contains null bytes")
    if path starts with "~/" :
        homeDir = os.homedir()               # sc6.homedir
        path = join(homeDir, path.slice(2))
    path = path_normalize(path)              # DI.normalize / jO (NFC normalisation)
    if not path_isAbsolute(path):
        path = path_resolve(path)            # DI.resolve
    return path
```

---

### Directory-config reload (__A / configLoader)

Analysis basis: CC v2.1.168 bundle.js:+13205677

```
async function reloadDirectoryConfig(dirPath):
    env = determineEnv()                     # DGH → _6 ("production" / "test")
    configPath = path_join(dirPath, ".claude", "settings.json")  # ND.join
    realPath   = await fs.realpath(dirPath)  # wL.realpath
    try:
        raw = await fs.readFile(configPath, "utf8")   # wL.readFile +13205900
        parsed = parseConfig(raw)            # hH → $q → dRA
    except ENOENT:
        # directory has no local .claude/settings.json — skip silently
        pass
    await fs.mkdir(path_dirname(configPath), {recursive: true})  # wL.mkdir +13205996
    await fs.appendFile(logPath, entry)      # wL.appendFile +13206077
```

---

### Permission-context update (applyPermissionSettings)

Analysis basis: CC v2.1.168 bundle.js:+4760459 (handler `oM`)

```
function applyPermissionSettings(state, newDirPath):
    # Guard: bypassPermissions mode restricted
    if setMode == "bypassPermissions" and mode not available:
        log("Ignoring permission update: setMode 'bypassPermissions' rejected …")
        # literal: "Ignoring permission update…" +4760461
        return

    # Merge rule sets from userSettings / projectSettings / policySettings
    for ruleClass in ["allow", "deny"]:
        mergeRules(state, ruleClass)         # "alwaysAllowRules" / "alwaysDenyRules" +4760930/+4760969

    # Apply addRules / replaceRules / removeRules / removeDirectories
    applyRuleDiff(state,
        addRules      = newRules,            # "addRules" +4760737
        replaceRules  = replacedRules,       # "replaceRules" +4761085
        removeRules   = removedRules,        # "removeRules" +4761742
        removeDirectories = [],              # "removeDirectories" +4762126
    )
```

---

### Working-directory state update (getAppState helper)

Analysis basis: CC v2.1.168 bundle.js:+10944550 (handler `b_`)

```
function getWorkingDirContext(appState):
    ctx = H.getAppState(appState)

    # Examine the last conversation entry for relevant fields:
    # "working_directory"  +10944655
    # "allowed_tools"      +10944710
    # "disallowed_tools"   +10944765
    # "avoid_prompts"      +10944826
    # "permission_mode"    +10944928
    # "bypassPermissions"  +10944959
    # "session"            +10945258
    # "effort"             +10945283
    # "model"              +10945296
    # "max_thinking_tokens"+10945308
    # "flag_settings"      +10945334

    last = ctx.findLast(item => item.working_directory)   # A.findLast +10944630
    return last
```

---

### Success / error UI rendering

Analysis basis: CC v2.1.168 bundle.js:+10947198 (`PDf → j6.bold`), +10947484 (`j6.dim`)

```
function renderSuccessPanel(resolvedPath):
    boldPath = j6.bold(resolvedPath)
    hint     = j6.dim("· /permissions to manage")   # literal +10947491
    return JSX(boldPath, hint)

function renderErrorPanel(errorKind):
    messageMap = {
        "emptyPath":               "Please provide a directory path.",   # +3851961
        "notADirectory":           <derived from stat error>,
        "pathNotFound":            <derived from ENOENT>,
        "alreadyInWorkingDirectory": <derived from duplicate check>,
        default:                   "Did not add a working directory.",   # +10947627
                                   # on unexpected error: "Unknown error" +10947383
    }
    return JSX(messageMap[errorKind])
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_ok` (+1010950), `tengu_feature_bad` (+1011012), `tengu_feature_sad` (+1011093), `tengu_disable_bypass_permissions_mode` (+4204612), `tengu_daemon_config_reload` (+16212414), `tengu_bg_state_read_transient` (+4167839) |
| appState changes | `addDirectories` key is used to push the new directory into the session working-directory list (+10946962); `localSettings` is written back after merge (+10947009) |
| Config I/O | Reads `.claude/settings.json` and `.claude/settings.local.json` under the new directory; creates parent directories if absent; appends to a log file |
| Tool-permission context | `setToolPermissionContext` is called after the directory is added (+10947036); permission rules (`alwaysAllowRules`, `alwaysDenyRules`, `alwaysDenyRules`) are merged from user / project / policy settings layers |
| Config refresh | `NA.refreshConfig()` is called (+10947120) to propagate the new directory to all consumers |
| Hook registration | No dedicated hook registration observed at depth ≤ 2 |
| Sound | None observed |
| Bypass-permissions guard | If `bypassPermissions` mode is unavailable, the permission-mode update is silently skipped with a log message (+4760461, +4204612) |
| CLI flag equivalent | `--add-dir` flag literal found at +10947150; the slash command shares the same underlying handler |

---

## Version History

| Version | Change |
|---|---|
| v2.1.168 | Initial analysis |

---

## Common Mistakes

1. **Omitting the path argument** — `/add-dir` with no argument returns "Please provide a directory path." immediately; the argument is mandatory.
2. **Supplying a file path instead of a directory** — The handler performs `fs.stat` and checks `isDirectory()`; a regular file results in the `notADirectory` error panel.
3. **Supplying a path that is already tracked** — The handler checks the current working-directory list and returns `alreadyInWorkingDirectory` without mutating state, so duplicate invocations are safe but silent no-ops.
4. **Using a path with null bytes** — The path resolver throws a `TypeError` synchronously for paths containing null bytes; this is a hard validation error.
5. **Expecting instant tool-permission changes when `bypassPermissions` mode is locked** — If the session was not launched in bypass mode (or `disableBypassPermissionsMode` is set), the permission-context update is silently suppressed (+4760461).
6. **Confusing `/add-dir` with the `--add-dir` CLI flag** — Both ultimately reach handler `PDf`, but the CLI flag is processed at startup before the interactive session begins.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `PDf` | Main async handler for `/add-dir` (arbor-resolved entry point) |
| `b_` | Working-directory context reader (getAppState wrapper) |
| `H` | App-state / bootstrap fetch utility (contextual) |
| `v` | General-purpose path/string utility (context-dependent) |
| `snK` | String normalisation helper |
| `RH` | JSON.stringify wrapper |
| `G4` | Path component extractor (lastIndexOf / slice) |
| `EUH` | Path/string utility (calls `nWA`) |
| `_iK` | File byte-length / buffer helper |
| `mj_` | String split/trim/indexOf/slice utility |
| `lHH` | Set membership checker (`o74.has`) |
| `uj` | String replace helper |
| `H9` | High-level string processing dispatcher |
| `m6H` | Sub-string processor (calls `Q0`, `aqH`, `yA`, `qB`) |
| `s9` | Token normalisation / model-name resolver |
| `FJ` | String formatting combinator |
| `o6` | UI component renderer (calls `l`, `J6`) |
| `l` | Low-level UI primitive |
| `J6` | UI layout helper (calls `hm6`) |
| `A` | Generic array/string operand (context-dependent) |
| `f` | File handle / stream operand |
| `L` | Promise/set lifecycle manager |
| `ty8` | Allowed-tools state reader (calls `L1`) |
| `ey8` | Disallowed-tools state reader (calls `L1`) |
| `L1` | Settings list accessor |
| `aB` | Bypass-permissions mode disabler (fires `tengu_disable_bypass_permissions_mode`) |
| `D6` | Permission-state manager (HwH / IB maps) |
| `cj6` | Permission entry constructor |
| `lj6` | Permission list mutator |
| `hu` | Permission helper (calls `yu`) |
| `cq8` | Cached-permission accessor (RP_ set, HwH map) |
| `C6` | Permission cache writer (Date.now timestamp) |
| `oM` | Permission-context applicator (addRules / replaceRules / removeRules) |
| `jM` | Rule-string formatter (calls `WV4`) |
| `WV4` | Backslash-escape replacer (`H.replaceAll`) |
| `K` | Rule / filter collection operand |
| `yV` | Settings value extractor |
| `Y` | Daemon / supervisor config manager |
| `$GH` | MCP store accessor (V9 / V8 / pfA) |
| `V9` | AsyncLocalStorage store reader (`eNL.getStore`) |
| `V8` | Error code checker |
| `pfA` | MCP profile accessor (calls `mfA`) |
| `GH` | String coercion wrapper |
| `UfK` | Column-width calculator (`Math.max`, `bD`) |
| `T` | Spinner / progress indicator (`.stop`) |
| `ly6` | Spinner lifecycle helper |
| `Y46` | Spinner lifecycle helper |
| `E` | Config-update emitter (`.stop`, `.updateConfig`, `.start`) |
| `TUK` | Heartbeat/supervisor helper (calls `S8H`) |
| `S8H` | Supervisor state helper |
| `V` | Renderer / view starter (`.start`) |
| `pTH` | Settings persistence helper |
| `__A` | Directory-config loader (readFile → mkdir → appendFile) |
| `DGH` | Environment discriminator (`_6`, `r$K`, `Cx`) |
| `_6` | String-to-env-key converter |
| `r$K` | Environment constant lookup |
| `Cx` | Environment validator |
| `jO` | Path NFC normaliser (`H.normalize`) |
| `h8` | Error-kind tester |
| `uR` | Truthy-value helper (calls `tv`) |
| `tv` | Boolean coercion primitive |
| `W_` | Boolean/truthy guard |
| `hH` | Config-file parser and error logger |
| `AA` | Error message formatter |
| `$q` | Config object extractor (calls `dRA`) |
| `dRA` | Config key resolver (calls `_6`) |
| `DG4` | Config history manager (shift/push on `Rc6`) |
| `Af9` | Background-task / file-state manager |
| `oj` | Stale-entry remover (`R7H.delete`) |
| `e9` | File-state reader/writer (stat, readFile, R7H map) |
| `Tf` | File-state error handler |
| `U6` | JSON.parse wrapper |
| `zf` | Atomic file writer (calls `XY`) |
| `XY` | Atomic rename writer (randomBytes → writeFile → rename) |
| `fz` | File-change detector (eTH set) |
| `g_H` | Tool-list / context builder (calls `pz9`, `o_`) |
| `xv_` | Context initialiser |
| `pz9` | Tool-context assembler (maps over tool list) |
| `O26` | Policy-settings resolver (calls `x8`) |
| `x8` | Settings-layer picker (`vn6`, `kd`) |
| `WoL` | Tool-entry builder (`eO`, `g$`, `d6`, `oP`) |
| `eO` | Tool-name normaliser (`NzH`, `kd`) |
| `g$` | Real-path resolver (`H.realpathSync`) |
| `d6` | Directory existence checker |
| `oP` | Path boundary checker (calls `Br`) |
| `EoL` | Tool-entry enricher |
| `w$` | Rule-string builder (`TV4`, `IT`, `EV4`, `GV4`) |
| `TV4` | Rule-token extractor |
| `IT` | `Object.hasOwn` guard |
| `EV4` | Rule-string segment builder |
| `GV4` | Glob-escape helper (`H.replaceAll`) |
| `M` | MCP client manager (calls `xbH`, `PF8`, `cDA`) |
| `xbH` | MCP connection initialiser |
| `PF8` | MCP connection result applier |
| `$` | DLK helper |
| `cDA` | MCP config diff applier |
| `o_` | Tool-permission context writer (main tool loader) |
| `___` | Rule-source resolver (`rpA`, `NzH`, `Id`, `lpA`, `Ur`) |
| `kd` | Per-tool permission builder (many rule-type helpers) |
| `e6_` | Timestamp recorder (`ul6.set`, `Date.now`) |
| `IZH` | Permission-list initialiser (`Nn6`, `kd`) |
| `O$6` | Atomic file write with permissions (lstat / rename / fchmod) |
| `LY` | Cache clearer (`Dp6.clear`, `_Q8.clear`) |
| `hl6` | Gitignore / exclude-file tracker |
| `qu` | Settings-path builder (`.claude/settings.json`) |
| `SH` | "Feature ok" reporter (fires `tengu_feature_ok`) |
| `CH` | "Feature bad" reporter (fires `tengu_feature_bad`) |
| `gU` | Settings loader from disk (fires `loadSettingsFromDisk_start/end`) |
| `WiH` | Path-validation orchestrator (stat → error-kind mapping) |
| `T1` | Path resolver / expander (homedir, normalize, isAbsolute) |
| `u6` | AsyncLocalStorage context getter (calls `pc6`) |
| `pc6` | Store reader (`mc6.getStore`, `BQ`) |
| `ka` | Validation guard (`W_`) |
| `kZ` | macOS `/var/` → `/tmp` path rewriter |
| `IMA` | macOS path alias resolver (`r6`, `UV`) |
| `uz` | Case-normaliser (`H.toLowerCase`) |
| `eHH` | Path post-processor |
| `GiH` | Error-panel renderer (bold path + dirname) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.