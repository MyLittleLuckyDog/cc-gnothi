---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.159"
updated: "2026-06-02"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: "2.1.157"
analysis_basis: "CC v2.1.157 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.157 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.157

---

## Overview

The `/sandbox` command configures Claude Code's sandboxing feature, which restricts the execution environment for tool calls. It supports an `exclude` sub-command that allows users to add command patterns to a local exclusion list, exempting specific commands from sandbox restrictions. The command performs platform compatibility checks, policy-lock checks, and persists exclusion rules to `.claude/settings.local.json`.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `sandbox` |
| description | ` ...   ...  (⏎ to configure)` |
| argumentHint | `exclude "command pattern"` |
| immediate | `true` |
| isHidden | `null` (not hidden) |
| module_id | `zr1` |
| load_inline | `true` |
| loc_byte | `12335211` |
| loc_byte_end | `12335860` |
| arbor_handler.name | `MM5` |
| arbor_handler.fqn | `claude-2.1.157::MM5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.157 bundle.js:+12335211

---

## Input Branching

The handler has 5+ distinct branches depending on platform, policy lock state, subcommand keyword, and argument presence.

```mermaid
flowchart TD
    A["/sandbox called"] --> B{Platform check\nisSupportedPlatform}
    B -- "Not supported (not macOS/Linux/WSL2)" --> C{Is WSL?}
    C -- "Yes, but WSL1" --> D["Error: Sandboxing requires WSL2.\nWSL1 is not supported."]
    C -- "No" --> E["Error: Sandboxing is currently\nonly supported on macOS, Linux,\nand WSL2."]
    B -- "Supported" --> F{Dependency check\ncheckDependencies}
    F -- "Missing deps" --> G["Render error UI\n(type: error)"]
    F -- "OK" --> H{isPlatformInEnabledList}
    H -- "Not in enabled list" --> I["Render configuration UI\n(interactive setup)"]
    H -- "In enabled list" --> J{areSandboxSettingsLockedByPolicy}
    J -- "Locked by policy" --> K["Error: Sandbox settings are\noverridden by a higher-priority\nconfiguration and cannot be\nchanged locally."]
    J -- "Not locked" --> L{args.split → subcommand?}
    L -- "subcommand == 'exclude'" --> M{Pattern argument present?\narg length > 8}
    M -- "No argument" --> N["Error: Please provide a command\npattern to exclude\n(e.g., /sandbox exclude \"npm run test:*\")"]
    M -- "Yes" --> O["Add rule to localSettings\nWrite to .claude/settings.local.json\nEmit sandbox_exclude_command telemetry\nReturn success"]
    L -- "No subcommand / other" --> P["Render interactive\nconfiguration UI"]
```

---

## Behavioral Spec

### Main Handler — `sandboxCommandHandler` (bundle name: `MM5`)

Analysis basis: CC v2.1.157 bundle.js:+12333830

```
async function sandboxCommandHandler(args, context):

    # Step 1: Determine theme/color mode
    colorMode = getColorMode()           # JA call — detects "light" or dark
    colorize = applyColor(colorMode)     # i6 call — color utility

    # Step 2: Platform support check
    if not platformSupport.isSupportedPlatform():
        if platformSupport.isWSL():       # wsl check at +12333897
            return renderError("Error: Sandboxing requires WSL2. WSL1 is not supported.")
        else:
            return renderError("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")

    # Step 3: Dependency check
    depResult = await platformSupport.checkDependencies()
    if depResult.hasErrors:
        return renderJSX({ type: "error", content: depResult.errors })

    # Step 4: Platform enabled-list check
    if not platformSupport.isPlatformInEnabledList():
        return renderConfigurationUI(context)

    # Step 5: Policy lock check
    if platformSupport.areSandboxSettingsLockedByPolicy():
        return renderError(
            "Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally."
        )

    # Step 6: Subcommand dispatch
    parts = args.split(...)
    subcommand = parts[0]
    remainder  = parts.slice(1)

    if subcommand == "exclude":           # literal at +12334576
        patternArg = remainder.join(" ")
        if patternArg.length <= 8:        # numeric guard at +12334601
            return renderError(
                "Error: Please provide a command pattern to exclude (e.g., /sandbox exclude \"npm run test:*\")"
            )
        # Persist exclusion rule to local settings
        await writeLocalSettings(patternArg)   # q0_ call at +12334786
        emitTelemetry("sandbox_exclude_command") # literal at +4619364
        reportRelativePath(".claude/settings.local.json")  # $r1.relative at +12334823
        return renderSuccess("success")         # literal at +12334879
    else:
        return renderConfigurationUI(context)   # dn call at +12334836
```

### Sub-command: Exclusion Rule Persistence — `writeLocalSettings` (bundle name: `q0_`)

Analysis basis: CC v2.1.157 bundle.js:+4618984

```
async function writeLocalSettings(patternArg):
    # Load current local settings from disk
    settings = await loadSettings("localSettings")   # I8 call, literal at +4618987

    # Filter and validate existing rules
    existingRules = settings.filter(...)              # _.filter at +4619055

    # Match pattern argument against known format
    matchResult = patternMatcher(patternArg)          # HE7 call using H.match at +4619268

    # Check if rule already in list
    if ruleList.includes(matchResult):
        # Rule already present — no duplicate written
        return

    # Emit sandbox_exclude_command telemetry
    emitEvent("sandbox_exclude_command")             # hH call at +4619361

    # Persist updated settings
    await settingsWriter.persist(settings)           # U_ call at +4619282
```

### Platform Checks — `platformSupport` (bundle name: `DA`)

Analysis basis: CC v2.1.157 bundle.js:+12333861

The `DA` namespace provides four checked methods called from the main handler:

```
function isSupportedPlatform() -> bool:
    # Returns true only for macOS, Linux, and WSL2
    # Returns false for Windows native, WSL1, other platforms

function checkDependencies() -> { hasErrors: bool, errors: [] }:
    # Verifies required system binaries / kernel features are available

function isPlatformInEnabledList() -> bool:
    # Checks whether the current platform is in the user-configured
    # sandbox-enabled platforms list

function areSandboxSettingsLockedByPolicy() -> bool:
    # Returns true if a higher-priority config (policy/flag settings)
    # has locked sandbox configuration, preventing local overrides
```

### Color Mode Dispatch — `applyColorToOutput` (bundle name: `$A`)

Analysis basis: CC v2.1.157 bundle.js:+12334038

```
function applyColorToOutput(colorMode, text):
    if colorMode.startsWith("rgb("):      # literal at +3744451
        return colorizeRgb(text)
    elif colorMode.startsWith("ansi256("): # literal at +3744492
        return colorizeAnsi256(text)
    elif colorMode.startsWith("ansi:"):   # literal at +3744518
        return colorizeAnsi(text)
    elif colorMode == "foreground":       # literal at +3744394
        return colorizeNamedColor(text)   # OYH dispatch
    else:
        return text
```

The `OYH` sub-function resolves named color strings (`"black"`, `"red"`, `"green"`, `"yellow"`, `"blue"`, `"magenta"`, `"cyan"`, `"white"`, bright variants, hex, ansi256, rgb) to terminal escape sequences via the `j6` color library.

### Settings Load and Write — `settingsIO` (bundle name: `U_`)

Analysis basis: CC v2.1.157 bundle.js:+1228239

```
async function settingsIO(operation, data):
    # Determine settings path
    settingsDir   = path.join(projectRoot, ".claude")     # cb call at +1229013
    localFile     = path.join(settingsDir, "settings.local.json")

    # Load existing settings layers
    userSettings    = readLayer("userSettings")    # literal at +1219077
    projectSettings = readLayer("projectSettings") # literal at +1219128
    localSettings   = readLayer("localSettings")   # literal at +4618987
    policySettings  = readLayer("policySettings")  # literal at +1223068
    flagSettings    = readLayer("flagSettings")     # literal at +1223147

    if operation == "addRules":            # literal at +4619078
        # Merge new rule into localSettings layer only
        mergeRule(localSettings, data)
        # Atomic write via temp file + rename
        atomicWrite(localFile, localSettings)  # yL6 handles atomic write
        # Clear settings cache
        clearCache()                           # vz call at +1229009
    
    # Emit opH event for settings change notification
    emitChangeEvent()                          # opH.emit at +1229395
```

The atomic write path (`yL6`) uses `randomBytes` for temp filename generation, applies original file permissions via `fchmodSync`, `fsyncSync`, and then `renameSync`.
Analysis basis: CC v2.1.157 bundle.js:+1012273

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_ok` (bundle.js:+966033), `tengu_feature_bad` (bundle.js:+966091), `tengu_feature_sad` (bundle.js:+966168), `tengu_daemon_control` (bundle.js:+15502788) |
| `sandbox_exclude_command` event | Emitted via `hH` at +4619361 when an exclude rule is successfully recorded |
| Writes to disk | `.claude/settings.local.json` — updated atomically when `exclude` subcommand succeeds (literal at +12334844) |
| Settings cache | Cleared via `vz` (calls `kC6.clear` + `Ru8.clear`) after write (bundle.js:+1229009) |
| Change notification | `opH.emit` fired after settings update (bundle.js:+1229395) |
| Daemon control | `z` / `Fm` path can call `process.exit` and `cKH.shutdown` — reached only if background session management is triggered (bundle.js:+15497965) |
| Color output | Terminal color applied to all rendered output via `$A` → `OYH` → `j6` library |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.157 | Initial analysis |

---

## Common Mistakes

1. **Running `/sandbox` on an unsupported platform** — The command will immediately return an error on Windows native environments or WSL1. Only macOS, Linux, and WSL2 are supported (bundle.js:+12333903, +12333961).

2. **Omitting the pattern argument with `exclude`** — Running `/sandbox exclude` without a quoted pattern string will fail with an instructional error message. The pattern must be non-empty after the keyword (length guard at bundle.js:+12334601).

3. **Attempting to change settings when policy-locked** — If an organization policy or flag-settings layer has locked sandbox configuration, `/sandbox` will refuse to write any local changes and display a policy-override error (bundle.js:+12334326).

4. **Expecting changes to take effect without cache invalidation** — The command clears the internal settings cache (`kC6` and `Ru8`) after writing. External processes that hold a cached settings reference may not see the update immediately.

5. **Using the wrong settings file** — Exclusion rules are written exclusively to `.claude/settings.local.json`, not to the shared `.claude/settings.json`. Changes are local to the current project checkout.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `MM5` | Main async handler for `/sandbox` command (arbor_handler) |
| `$A` | Color mode dispatch / output colorization selector |
| `OYH` | Named-color-to-ANSI-escape resolver (uses `j6` library) |
| `JA` | Color mode detector (returns `"light"` or dark mode value) |
| `i6` | Color utility initializer |
| `DA` | Platform support namespace (`isSupportedPlatform`, `checkDependencies`, `isPlatformInEnabledList`, `areSandboxSettingsLockedByPolicy`) |
| `q0_` | Local settings exclusion rule writer / `addRules` handler |
| `I8` | Settings loader entry point |
| `Ng6` | Settings cache lookup helper |
| `h3A` | Cache read (has/get on `kC6`) |
| `Ga8` | Settings layer assembler |
| `S3A` | Cache write (`kC6.set`) |
| `$Q` | Settings object builder / layer merger |
| `O_` | Settings normalizer sub-helper |
| `U_` | Settings persistence and file I/O coordinator |
| `ZO` | Settings resolver combining `E3H` and `$Q` |
| `E3H` | Settings path resolver |
| `HE7` | Pattern argument matcher (regex via `H.match`) |
| `Cp` | Settings load-from-disk orchestrator |
| `Ta8` | Settings load with logging (`settings_load_started` / `settings_load_completed`) |
| `vg6` | Settings file path builder |
| `iGH` | Inline settings getter combining `vg6` + `$Q` |
| `wP` | Settings writer coordinator |
| `Ni` | File reader with size limit (4096 bytes at +976944) |
| `bF6` | Git-aware settings file writer |
| `h6` | Git-ignore check helper |
| `CF6` | `git check-ignore` runner |
| `Z94` | Global gitignore path resolver |
| `lkA` | `git ls-files` already-tracked checker |
| `nkA` | Gitignore append helper |
| `yL6` | Atomic file write (temp + fchmod + fsync + rename) |
| `vz` | Settings cache clear (`kC6.clear` + `Ru8.clear`) |
| `cb` | `.claude` directory path joiner |
| `hH` | Telemetry emitter for `tengu_feature_ok` / feature success |
| `bH` | Telemetry emitter for `tengu_feature_bad` / feature failure |
| `t6` | Telemetry emitter for `tengu_feature_sad` / feature warning |
| `z` | Daemon stop / background session termination coordinator |
| `Fm` | Daemon shutdown with race/all promises and `process.exit` |
| `Md` | Daemon shutdown signal sender (`cKH.shutdown`) |
| `hy` | MCP server / subprocess launcher |
| `xz_` | MCP session initializer (randomUUID, `H.emit`) |
| `n88` | MCP protocol handler |
| `wU` | Secure random token generator (32 bytes hex) |
| `g8` | Process timeout / abort manager |
| `SH` | Shell execution wrapper |
| `F_` | Error string formatter |
| `CH` | String coercion helper |
| `L1` | Essential-traffic filter checker |
| `X_4` | Circular buffer manager (`BB6.shift` / `BB6.push`) |
| `P8` | ENOENT error handler |
| `j8` | Error code checker (code `"ENOENT"`) |
| `N` | HTTP/API request sender |
| `QCK` | API request builder |
| `RH` | JSON stringify wrapper |
| `v4` | Path/header manipulation helper |
| `EuH` | Response validator |
| `lCK` | Chunked request sender with retry (limits: 1000ms, 100 items at +203982/+204001) |
| `dn` | Interactive sandbox configuration UI renderer |
| `Jd` | UI component helper |
| `IC6` | Settings change event emitter |
| `Jo8` | Timestamp recorder (`BF6.set` + `Date.now`) |
| `cS6` | Plugin path resolver |
| `lS6` | Plugin directory path builder |
| `g6` | Project root resolver |

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.