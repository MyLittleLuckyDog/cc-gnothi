---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.142"
updated: "2026-06-01"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.142 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.142 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.142

---

## Overview

`/sandbox` configures the sandboxing behavior for Claude Code's tool execution environment. It allows users to view the current sandbox mode, toggle sandboxing on or off, and manage exclusion rules that exempt specific command patterns from sandboxing constraints. The command checks platform support, policy locks, and dependency availability before applying any changes, writing results to `.claude/settings.local.json`.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `sandbox` |
| description | ` ...   ...  (⏎ to configure)` |
| argumentHint | `exclude "command pattern"` |
| immediate | `true` |
| isHidden | `null` |
| module_id | `U0q` |
| load_inline | `true` |
| loc_byte | `11573627` |
| loc_byte_end | `11574276` |
| loc_line | `7204` |
| arbor_handler.name | `ev7` |
| arbor_handler.fqn | `claude-2.1.142::ev7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.142 bundle.js:+11573627

---

## Input Branching

The command has 4+ distinct branches depending on platform support, policy locks, dependency checks, and whether the `exclude` subcommand is present. A flowchart is required.

```mermaid
flowchart TD
    A["/sandbox [args]"] --> B{Platform supported?\nn_.isSupportedPlatform}
    B -- "No: is WSL1" --> C["Error: Sandboxing requires WSL2.\nWSL1 is not supported."]
    B -- "No: other platform" --> D["Error: Sandboxing is currently only\nsupported on macOS, Linux, and WSL2."]
    B -- "Yes" --> E{Dependencies\navailable?\nn_.checkDependencies}
    E -- "Missing deps" --> F["Render error via colorRenderer\n(wA / q$H)"]
    E -- "OK" --> G{Platform in\nenabled list?\nn_.isPlatformInEnabledList}
    G -- "No" --> H["Display 'not available\non this platform' UI"]
    G -- "Yes" --> I{Policy locked?\nn_.areSandboxSettingsLockedByPolicy}
    I -- "Yes" --> J["Error: Sandbox settings are overridden\nby a higher-priority configuration\nand cannot be changed locally."]
    I -- "No" --> K{args present?}
    K -- "No args" --> L["Render interactive\nconfiguration UI (JSX)"]
    K -- "'exclude' subcommand" --> M{Pattern argument\npresent?\nargs.split, args.slice}
    M -- "No pattern" --> N["Error: Please provide a command\npattern to exclude\n(e.g., /sandbox exclude \"npm run test:*\")"]
    M -- "Pattern provided" --> O["Parse exclude pattern\nCall sandboxExcludeSettings (n5_)\nWrite to .claude/settings.local.json\nEmit sandbox_exclude_command telemetry"]
    L --> P["Return JSX component\nvia JO / OB renderers"]
    O --> Q["Write updated settings\nvia settingsWriter (p_)\nReturn confirmation"]
```

Analysis basis: CC v2.1.142 bundle.js:+11572246 through +11573260

---

## Behavioral Spec

### 1. Handler Entry Point (`ev7`)

The main handler is the `AsyncFunction` `ev7`, resolved via `module_id` path from module `U0q`.

```
async function sandboxCommandHandler(args, context):
    # Step 1: Platform detection
    theme = getTheme()  # OA — "light" vs other
    colorRenderer = buildColorRenderer(context)  # wA / q$H

    if not platformSupport.isSupportedPlatform():  # n_.isSupportedPlatform
        if platform == "wsl" and wslVersion < 2:
            return error("Error: Sandboxing requires WSL2. WSL1 is not supported.")
        else:
            return error("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")

    # Step 2: Dependency check
    depResult = platformSupport.checkDependencies()  # n_.checkDependencies
    if depResult.missing:
        return renderDependencyError(depResult, colorRenderer)

    # Step 3: Platform enablement check
    if not platformSupport.isPlatformInEnabledList():  # n_.isPlatformInEnabledList
        return renderUnavailableUI()

    # Step 4: Policy lock check
    if platformSupport.areSandboxSettingsLockedByPolicy():  # n_.areSandboxSettingsLockedByPolicy
        return error("Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally.")

    # Step 5: Argument routing
    if args is empty:
        return renderInteractiveConfigUI(context)  # via JO / OB

    subcommand, rest = args.split(first token)  # M.split

    if subcommand == "exclude":
        if rest.length < 8:  # literal: 8
            return error('Error: Please provide a command pattern to exclude (e.g., /sandbox exclude "npm run test:*")')
        pattern = rest.slice(...)  # M.slice
        pattern = pattern.replace(...)  # z.replace — strips surrounding quotes
        applyExcludeRule(pattern, context)  # n5_ / p_
    else:
        return renderInteractiveConfigUI(context)
```

Analysis basis: CC v2.1.142 bundle.js:+11572246, +11572277, +11572494, +11572521, +11572683, +11572969, +11573009, +11573054

---

### 2. Platform Support Checks (`n_.isSupportedPlatform`, `n_.isPlatformInEnabledList`, `n_.areSandboxSettingsLockedByPolicy`, `n_.checkDependencies`)

These four checks are performed sequentially on the `n_` platform-support module before any configuration change is allowed.

```
function isSupportedPlatform():
    # Returns false for WSL1 (string "wsl" + version test)
    # Returns false for Windows native, unsupported OS variants
    # Returns true for macOS, Linux, WSL2

function checkDependencies():
    # Verifies required sandbox binaries are present
    # Returns { ok: bool, missing: string[] }

function isPlatformInEnabledList():
    # Consults a static allowlist of supported platform identifiers

function areSandboxSettingsLockedByPolicy():
    # Reads policy-layer settings (policySettings)
    # Returns true if sandbox config is immutable at enterprise or admin level
```

Analysis basis: CC v2.1.142 bundle.js:+11572277, +11572494, +11572521, +11572683

---

### 3. Color / Theme Rendering (`wA`, `q$H`)

The command uses a terminal color-rendering pipeline before emitting any error text. The renderer receives the current theme token (string `"light"` at +11572258) and dispatches to the full ANSI/RGB/ansi256 color table in `q$H`. Foreground (`"foreground"`) is the default render mode.

```
function buildColorRenderer(theme):
    mode = "foreground"
    if theme == "light":
        palette = lightPalette
    else:
        palette = darkPalette
    return renderer that maps color names → ANSI escape sequences
    # Supported: black, red, green, yellow, blue, magenta, cyan, white,
    #            *Bright variants, hex(), rgb(), ansi256()
```

Analysis basis: CC v2.1.142 bundle.js:+11572258, +3681524, +3681568, +3681581, +3681622, +3681648

---

### 4. `exclude` Subcommand — Rule Addition (`n5_`, `p_`)

When the `exclude` subcommand is used with a valid pattern string, the handler:

1. Splits the raw argument string and extracts the pattern (offset ≥ 8 characters after subcommand keyword).
2. Strips surrounding quote characters via `z.replace`.
3. Calls the sandbox-exclude settings writer (`n5_`) which computes the current settings state via `localSettings` / `addRules` semantics.
4. Writes the updated rule set to `.claude/settings.local.json` (literal at +11573260) via the settings persistence layer (`p_`).
5. Emits the telemetry event `sandbox_exclude_command` (string literal at +4423969).

```
function applyExcludeRule(rawPattern, context):
    pattern = rawPattern.replace(quoteRegex, "")
    currentSettings = loadLocalSettings()   # p_ / settingsLoader
    newRules = currentSettings.addRules([{ type: "exclude", pattern }])
    settingsWriter.write(".claude/settings.local.json", newRules)   # p_
    emit("sandbox_exclude_command")
    return successConfirmation()
```

Analysis basis: CC v2.1.142 bundle.js:+11572969, +11573009, +11573173, +11573202, +11573260, +4423969

---

### 5. Interactive Configuration UI (`JO`, `OB`)

When invoked with no arguments (or an unrecognized argument), the command renders a JSX-based interactive configuration panel via the `JO` → `OB` render tree. The panel surfaces the current sandbox mode and allows toggling. This component uses the full settings stack (`W5H` user settings, `p_` local settings writer, `kz` cache-clear, `ax` settings loader).

```
function renderInteractiveConfigUI(context):
    currentMode = readSandboxModeFromSettings()  # ax / km8
    return JSXComponent(
        currentMode,
        onToggle = (newMode) => {
            writeSandboxMode(newMode)   # p_
            clearSettingsCache()        # kz
        },
        onExcludeAdd = (pattern) => applyExcludeRule(pattern, context),
        colorRenderer = buildColorRenderer(context.theme)
    )
```

Analysis basis: CC v2.1.142 bundle.js:+11573215, +11573239, +11573252

---

### 6. Settings Persistence Layer (`p_`)

The settings writer (`p_`) handles all reads and writes to the local settings file.

```
function settingsWriter(filePath, data):
    ensureDirectoryExists(dirname(filePath))   # _5H.mkdir
    existing = readFile(filePath)              # _5H.readFile
    merged = merge(existing, data)
    atomicWrite(filePath, merged)              # _5H.writeFile via temp + rename
    clearCaches()                              # kz: DV6.clear, LZ8.clear
    emit("DCH")                               # DCH.emit — settings-changed event
```

Analysis basis: CC v2.1.142 bundle.js:+1203957, +1062757, +1062799, +1062860, +1062922, +1203981, +1204129

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_ok` (bundle.js:+954550); `sandbox_exclude_command` emitted as a feature-ok signal (bundle.js:+4423969); plus transitive: `tengu_mcp_oauth_flow_start`, `tengu_mcp_oauth_flow_success`, `tengu_mcp_oauth_flow_error`, `tengu_bg_spare_enable`, `tengu_bg_spare_spawn`, `tengu_daemon_config_reload`, `tengu_config_auth_loss_prevented`, `tengu_daemon_control`, `tengu_daemon_yield` (reachable via MCP/daemon sub-graph) |
| File writes | `.claude/settings.local.json` (bundle.js:+11573260) — written on any settings change |
| Cache invalidation | `DV6.clear` + `LZ8.clear` called after every settings write (bundle.js:+26086, +26098) |
| Event emission | `DCH.emit` fires a settings-changed notification after write (bundle.js:+1204129) |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | Sandbox mode reflected in app state via the interactive JSX component's toggle handler |
| Sound | None detected |

---

## Version History

| Version | Change |
|---|---|
| v2.1.142 | Initial analysis |

---

## Common Mistakes

1. **Running on WSL1**: The command explicitly rejects WSL1 with the error "Sandboxing requires WSL2. WSL1 is not supported." Upgrade to WSL2 before using `/sandbox`.
2. **Omitting the pattern with `exclude`**: Running `/sandbox exclude` without a quoted pattern string triggers the error asking for a pattern (e.g., `/sandbox exclude "npm run test:*"`). The minimum argument length check requires at least 8 characters after the subcommand keyword (bundle.js:+11573017).
3. **Policy-locked environments**: In enterprise deployments where sandbox settings are controlled by a higher-priority configuration, the command will refuse all changes and display the policy-lock error. The setting must be changed at the enterprise/policy level, not locally.
4. **Expecting cross-platform support**: `/sandbox` is only available on macOS, Linux, and WSL2. Running on native Windows will produce an unsupported-platform error.
5. **Forgetting quotes around patterns with wildcards**: The `exclude` subcommand strips surrounding quotes from the pattern. Shell glob patterns (e.g., `npm run test:*`) must be passed in quotes to prevent shell expansion.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `ev7` | Main sandbox command async handler (Arbor-resolved, module `U0q`) |
| `wA` | Terminal color renderer builder |
| `q$H` | ANSI/RGB/ansi256 color dispatch table |
| `PF` | Color renderer finalization helper |
| `IvH` | MCP server initialization / connection orchestrator |
| `AHH` | MCP server config aggregator |
| `FqH` | MCP per-server startup sequencer |
| `_HH` | MCP SDK server type handler |
| `Hw6` | MCP SSE/HTTP server type handler |
| `dI` | MCP server descriptor builder |
| `j$` | MCP descriptor field formatter |
| `zG_` | MCP descriptor secondary formatter |
| `lX6` | MCP connection filter helper |
| `D47` | MCP connection state timestamp recorder |
| `wS_` | MCP connection status resolver |
| `O78` | MCP server identity/hash builder |
| `Di` | MCP server base initializer |
| `Wj` | MCP server hash generator (SHA-256) |
| `$78` | MCP server cache-key builder |
| `oK` | MCP cache entry accessor |
| `H8` | MCP debug log emitter |
| `lh_` | MCP client connection lifecycle manager |
| `IL7` | MCP client pre-connect setup |
| `MB` | MCP client auth token handler |
| `aHH` | MCP OAuth flow executor |
| `CrH` | MCP pending-connection tracker |
| `D` | Background spare session manager |
| `PY8` | MCP connection status updater |
| `RQ` | MCP reconnect orchestrator |
| `ox` | Settings read helper |
| `Y` | Daemon config-reload handler |
| `_7` | MCP error logger |
| `GH` | String coercion / general error formatter |
| `vL7` | MCP client pre-connect validator |
| `VL7` | SSH/remote session detector for MCP |
| `nh_` | MCP notification handler |
| `RrH` | MCP pending-auth state reader |
| `brH` | MCP pending-connection state reader |
| `o6q` | MCP connection result dispatcher |
| `u7` | Async-local-storage store reader |
| `hY8` | MCP needs-auth cache file accessor |
| `RH` | JSON serializer wrapper |
| `dh_` | MCP tool-call dispatcher |
| `LG_` | Settings load-from-disk orchestrator |
| `t6` | Core settings file reader |
| `K` | MCP server map (Map operations) |
| `L` | MCP active-connection set |
| `f` | Daemon/connection lifecycle handle |
| `H_` | General async utility |
| `lh_` | MCP lifecycle controller (see above) |
| `n5_` | Sandbox exclude-rule settings writer |
| `V8` | Settings load entrypoint |
| `HC6` | Settings cache accessor |
| `as_` | Settings cache hit checker |
| `Nm8` | Settings merger (policy + flag + user + project + local) |
| `ss_` | Settings cache setter |
| `OB` | Interactive UI JSX renderer (sandbox config panel) |
| `__` | JSX base component helper |
| `eeH` | JSX checkbox/toggle element |
| `wV8` | JSX text input element |
| `oeH` | JSX list element |
| `hjH` | JSX section divider element |
| `_H6` | JSX label element |
| `J5H` | JSX button element |
| `j5H` | JSX confirm-dialog element |
| `Gm8` | JSX scroll container element |
| `HDA` | JSX header element |
| `Gc` | JSX column-layout element |
| `M96` | JSX theme-aware wrapper |
| `csL` | Argument pattern matcher |
| `p_` | Settings persistence writer (.claude/settings.local.json) |
| `JO` | Interactive configuration UI launcher |
| `W5H` | User settings file path resolver |
| `sj` | Settings file content reader wrapper |
| `wc` | Raw settings file reader |
| `$8` | Atomic file write helper |
| `O8` | File system error handler |
| `hu8` | Settings write timestamp recorder |
| `jXH` | Settings file path resolver (local) |
| `eR6` | Settings file path resolver (project) |
| `TA6` | Atomic file writer with permissions |
| `kz` | Settings cache clearer (DV6 + LZ8) |
| `$R6` | Settings append/write orchestrator |
| `h6` | Git check-ignore runner |
| `Ju8` | Settings schema loader |
| `Wu8` | Settings write validator |
| `JyK` | Home directory config path resolver |
| `Iy` | `.claude` directory path builder |
| `ax` | Settings loader entrypoint |
| `iS` | Settings load pre-check |
| `j1` | Memory usage tracker for settings load |
| `km8` | Settings load implementation with telemetry |
| `wV6` | Settings load post-processor |
| `NH` | Settings error reporter |
| `k_` | Error string formatter |
| `bH` | Boolean-string normalizer ("yes"/"on") |
| `$q` | Network policy checker ("essential-traffic") |
| `JvK` | Settings error queue manager |
| `SH` | `tengu_feature_ok` telemetry emitter |
| `bd` | Relative path calculator (m0q.relative wrapper) |
| `H` | General-purpose async delay / random utility |
| `M` | MCP server registry (top-level Map) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.