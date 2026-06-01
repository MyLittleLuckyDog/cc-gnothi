---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.149"
updated: "2026-06-01"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.149 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.149 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.149

---

## Overview

The `/sandbox` command configures the sandboxing policy that Claude Code applies when executing shell commands. It supports an `exclude` sub-command that adds glob-style command patterns to the local project settings file (`.claude/settings.local.json`), exempting matching commands from sandbox restrictions. When invoked without arguments it opens the interactive sandbox configuration UI.

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
| module_id | `WB1` |
| load_inline | `true` |
| loc_byte | `12227934` |
| loc_byte_end | `12228583` |
| loc_line | `9985` |
| arbor_handler.name | `P85` |
| arbor_handler.fqn | `claude-2.1.149::P85` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.149 bundle.js:+12227934

---

## Input Branching

The handler contains 4+ distinct branches depending on platform support, WSL version, policy lock status, and whether the `exclude` sub-command is present.

```mermaid
flowchart TD
    A(["/sandbox [args]"]) --> B{Theme check\nbundle.js:+12226565}
    B -->|theme == 'light'| C[Apply light-mode\ncolor adjustments]
    B -->|other| D{Platform supported?\nbundle.js:+12226584}
    C --> D
    D -->|not supported| E{Is WSL?\nbundle.js:+12226620}
    E -->|WSL1 detected| F["Return error:\n'WSL2 required'\nbundle.js:+12226626"]
    E -->|non-WSL| G["Return error:\n'macOS/Linux/WSL2 only'\nbundle.js:+12226684"]
    D -->|supported| H{Check dependencies\nbundle.js:+12226801}
    H -->|deps missing| I[Emit dependency\nerror via hA\nbundle.js:+12226761]
    H -->|deps OK| J{Platform in\nenabled list?\nbundle.js:+12226828}
    J -->|no| K[Show config UI\n(no args path)]
    J -->|yes| L{Settings locked\nby policy?\nbundle.js:+12226990}
    L -->|locked| M["Return error:\n'Settings overridden by policy'\nbundle.js:+12227049"]
    L -->|not locked| N{args.split contains\n'exclude'?\nbundle.js:+12227276}
    N -->|no / empty| O[Open interactive\nconfig UI via wl]
    N -->|yes, but no pattern| P["Return error:\n'Please provide a command\npattern to exclude'\nbundle.js:+12227361"]
    N -->|yes + pattern| Q[Write exclude rule\nto settings.local.json\nbundle.js:+12227567]
    Q --> R[Emit telemetry:\nsandbox_exclude_command\nbundle.js:+4586814]
    R --> S[Return JSX confirmation]
```

---

## Behavioral Spec

### 1. Platform and Environment Validation

The handler (`P85`) begins by retrieving the current color theme and checking whether sandboxing is supported on the running platform.

```
async function sandboxCommandHandler(args, appState):
    theme = getColorTheme()                      // TA — bundle.js:+12226553
    colorAdapter = getColorAdapter(theme)        // a6 — bundle.js:+12226575

    if not platformSupportChecker.isSupportedPlatform():  // $A.isSupportedPlatform — bundle.js:+12226584
        wslVersion = detectWslVersion()          // hA — bundle.js:+12226761
        if wslVersion.startsWith("wsl"):         // H.startsWith — bundle.js:+3721925
            return errorMessage("Error: Sandboxing requires WSL2. WSL1 is not supported.")
            // literal — bundle.js:+12226626
        else:
            return errorMessage("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")
            // literal — bundle.js:+12226684
```

Analysis basis: CC v2.1.149 bundle.js:+12226553

### 2. Dependency and Enablement Check

After platform validation the handler verifies that required system dependencies are present and that the platform appears in the enabled-platforms list.

```
    dependencyResult = platformSupportChecker.checkDependencies()
    // $A.checkDependencies — bundle.js:+12226801

    if dependencyResult.kind == "error":         // literal "error" — bundle.js:+12226764
        emitDependencyError(dependencyResult)    // hA — bundle.js:+12226761
        return

    if not platformSupportChecker.isPlatformInEnabledList():
        // $A.isPlatformInEnabledList — bundle.js:+12226828
        openInteractiveConfigUI(appState)
        return
```

Analysis basis: CC v2.1.149 bundle.js:+12226801

### 3. Policy Lock Guard

Before any mutation the handler checks whether an enterprise/higher-priority configuration has locked sandbox settings.

```
    if platformSupportChecker.areSandboxSettingsLockedByPolicy():
        // $A.areSandboxSettingsLockedByPolicy — bundle.js:+12226990
        return errorMessage(
            "Error: Sandbox settings are overridden by a higher-priority configuration " +
            "and cannot be changed locally."
        )
        // literal — bundle.js:+12227049
```

Analysis basis: CC v2.1.149 bundle.js:+12226990

### 4. Argument Parsing — `exclude` Sub-command

The raw argument string is split and inspected for the `exclude` keyword (byte offset `12227299`). The minimum expected token count after splitting is 8 (offset `12227324`), which corresponds to the sub-command keyword plus a quoted pattern.

```
    tokens = args.split(...)                     // f.split — bundle.js:+12227276
    subCommand = tokens[0]                       // "exclude" literal — bundle.js:+12227299

    if subCommand != "exclude":
        openInteractiveConfigUI(appState)        // wl — bundle.js:+12227559
        return

    patternToken = tokens.slice(...)             // f.slice — bundle.js:+12227316
    if patternToken is empty or missing:
        return errorMessage(
            "Error: Please provide a command pattern to exclude " +
            "(e.g., /sandbox exclude \"npm run test:*\")"
        )
        // literal — bundle.js:+12227361
```

Analysis basis: CC v2.1.149 bundle.js:+12227276

### 5. Rule Writing — Exclude Pattern Persistence

When a valid pattern is provided, the handler resolves it against the local settings layer and persists the `exclude` rule to `.claude/settings.local.json`.

```
    normalizedPattern = args.replace(...)        // z.replace — bundle.js:+12227480
    settingsPath = resolveLocalSettingsPath(cwd) // XB1.relative — bundle.js:+12227546
    // settingsPath == ".claude/settings.local.json" — literal bundle.js:+12227567

    existingRules = loadLocalSettings(settingsPath)
    // uses cj_ (localSettings loader) — bundle.js:+12227509

    updatedRules = mergeExcludeRule(existingRules, normalizedPattern)
    // uses _A (settings writer) — bundle.js:+1221163 and o$ — bundle.js:+12227522
    // addRules key — literal bundle.js:+4586528
    // localSettings key — literal bundle.js:+4586437

    writeSettingsFile(settingsPath, updatedRules)
    // NfH.writeFile — bundle.js:+1073882

    emitTelemetry("sandbox_exclude_command")     // literal bundle.js:+4586814
    return JSX confirmation component
```

Analysis basis: CC v2.1.149 bundle.js:+12227480

### 6. WSL Version Detection Sub-routine (`hA`)

The WSL detection helper inspects environment strings using prefix matching, then delegates to the terminal color formatter (`yOH`) for display.

```
function detectAndFormatWslInfo(envString):
    if envString.startsWith("foreground"):       // literal bundle.js:+3721881
        // handle foreground mode color context
    if envString.startsWith("rgb("):             // literal bundle.js:+3721938
        // parse RGB color
    if envString.startsWith("ansi256("):         // literal bundle.js:+3721979
        // parse ANSI-256 color
    if envString.startsWith("ansi:"):            // literal bundle.js:+3722005
        applyAnsiColorMapping(envString)         // yOH — bundle.js:+3722021
    applyStandardColor(envString)                // sg — bundle.js:+3722045
```

Analysis basis: CC v2.1.149 bundle.js:+3721925

### 7. Local Settings Loader (`cj_`)

The settings loader reads `localSettings` from disk, filters the rules array, and merges patterns.

```
function loadLocalSettings(path):
    raw = configReader.loadSettings("localSettings") // literal bundle.js:+4586437
    p8Ctx = initSettingsContext(path)                // p8 — bundle.js:+4586434
    filtered = raw.filter(...)                       // cj_.filter — bundle.js:+4586505
    matched = filtered.filter(patternMatcher)        // Ej7 — bundle.js:+4586679
    return { addRules: matched, ... }
    // "addRules" literal — bundle.js:+4586528
```

Analysis basis: CC v2.1.149 bundle.js:+4586434

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_ok` (bundle.js:+963421), `tengu_feature_bad` (bundle.js:+963479), `tengu_feature_sad` (bundle.js:+963556), `tengu_daemon_control` (bundle.js:+15296846); `sandbox_exclude_command` string event (bundle.js:+4586814); indirectly via MCP subsystem: `tengu_mcp_oauth_flow_start`, `tengu_mcp_oauth_flow_success`, `tengu_mcp_oauth_flow_error`, `tengu_mcp_reconnect`, `tengu_mcp_reconnect_not_connected`, `tengu_mcp_reconnect_failed`, `tengu_bg_spare_enable`, `tengu_bg_spare_spawn`, `tengu_daemon_config_reload`, `tengu_daemon_yield`, `tengu_config_auth_loss_prevented` |
| Persistent file write | `.claude/settings.local.json` — appends `exclude` rule when `exclude` sub-command succeeds (bundle.js:+12227567) |
| appState changes | Interactive config UI is opened via `wl` when no sub-command is given (bundle.js:+12227559) |
| MCP subsystem interaction | Full MCP server lifecycle (`UyH`, `nv5`, `QDK`) is reachable from the settings-apply path — server reconnect/restart may be triggered on rule change (bundle.js:+14980573) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.149 | Initial analysis |

---

## Common Mistakes

1. **Omitting the pattern argument**: Invoking `/sandbox exclude` with no quoted pattern produces the error `"Error: Please provide a command pattern to exclude (e.g., /sandbox exclude \"npm run test:*\")"` (bundle.js:+12227361). The pattern must follow the `exclude` keyword.
2. **Running on WSL1**: Sandboxing requires WSL2. WSL1 environments receive an explicit rejection (bundle.js:+12226626) with no fallback.
3. **Attempting to override enterprise policy**: When an admin policy locks sandbox settings, any local modification attempt — including `/sandbox exclude` — is rejected with a policy-lock message (bundle.js:+12227049). The setting must be changed at the policy level.
4. **Unsupported platforms**: Only macOS, Linux, and WSL2 are supported. Invoking `/sandbox` on Windows (native) or other platforms returns an unsupported-platform error (bundle.js:+12226684).
5. **Expecting global settings to be modified**: The `exclude` sub-command writes exclusively to `.claude/settings.local.json` (bundle.js:+12227567), not to global or user-level settings. Rules added this way are project-scoped.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `P85` | Main async handler for `/sandbox` command (arbor_handler) |
| `hA` | WSL version detection and terminal color context helper |
| `H` | Runtime environment / platform utility object (also used for random/setTimeout) |
| `yOH` | Terminal color string formatter (ANSI/RGB/hex/ansi256 dispatch) |
| `sg` | Standard/fallback color applicator |
| `f` | MCP server registry / settings store object |
| `UyH` | MCP server connection lifecycle manager |
| `j6H` | MCP configuration aggregator |
| `Rj6` | MCP config sub-processor (enterprise layer) |
| `G4H` | MCP server config builder (multi-scope: enterprise, user, project, local) |
| `w6H` | MCP SDK-type server config collector |
| `Sj6` | MCP SSE/HTTP server config deduplicator |
| `bN` | MCP server entry constructor / normalizer |
| `HO` | MCP server metadata handler |
| `aT_` | MCP server auth-token attachment helper |
| `K` | Async task queue / promise list helper |
| `L` | Async task entry / promise wrapper |
| `M` | Stream/connection handle (close/listen) |
| `t8` | Utility passthrough / identity wrapper |
| `HE6` | MCP server filter predicate |
| `vkL` | MCP needs-auth cache loader |
| `vF_` | MCP cache file path resolver |
| `y78` | MCP server config key extractor |
| `h78` | MCP server identity hasher |
| `JX` | SHA-256 hash utility wrapper |
| `k78` | MCP server key builder |
| `FK` | File-path resolver helper |
| `z8` | MCP debug log emitter |
| `hB_` | MCP OAuth / server connection bootstrap orchestrator |
| `SNL` | MCP OAuth tool registration helper |
| `nF` | Logger / event emitter initializer |
| `f_H` | MCP OAuth flow core handler (local callback server, token exchange) |
| `jtH` | MCP connection cache set/get/delete manager |
| `D` | Background spare process controller |
| `s28` | MCP needs-auth cache writer |
| `Dc` | MCP server reconnection handler |
| `ym` | Event emitter factory |
| `Y` | MCP supervisor/daemon config update dispatcher |
| `CL` | MCP error log emitter |
| `EH` | Error-to-string converter |
| `RNL` | MCP reconnect result handler |
| `hNL` | SSH/remote session detector for OAuth redirect |
| `SB_` | MCP complete-authentication (manual callback URL) handler |
| `wtH` | MCP connection state getter |
| `JtH` | MCP connection cache getter |
| `IY1` | MCP client initializer |
| `A1` | AsyncLocalStorage context getter |
| `EW8` | MCP cache file path joiner |
| `CH` | JSON serializer wrapper |
| `kB_` | MCP server auth-state logger |
| `lT_` | MCP transport type checker |
| `f8` | Global config save helper (with auth-loss guard) |
| `A` | String array / platform list helper |
| `j` | Background worker kill dispatcher |
| `y` | Background worker process handle |
| `ZY1` | Async iterator / concurrency mapper |
| `li` | Generic async mapper / concurrency primitive |
| `_E6` | Integer parser (radix 10) |
| `NF_` | Integer parser (radix 20) |
| `QDK` | MCP update applier / state reconciler |
| `ZW8` | MCP state serializer |
| `OI` | MCP client cleanup coordinator |
| `ytH` | MCP client state formatter |
| `N` | Shell command executor / process spawner |
| `MVK` | Shell command argument builder |
| `T7A` | Shell escape helper |
| `X4` | Shell output path normalizer |
| `s5A` | Shell output mapper |
| `q` | File system unlink / temp-file helper |
| `HbH` | Output stream writer wrapper |
| `B5A` | Raw stream write helper |
| `OVK` | Transcript/log file write orchestrator |
| `ICH` | Buffered output batcher (setTimeout/setImmediate flush) |
| `q9H` | Log file path builder |
| `Q6` | File existence checker |
| `G96` | Log rotation / file-size checker |
| `LMA` | Log directory path builder |
| `KMA` | Log file rotation handler (stat/rename/unlink) |
| `$VK` | Log file append-with-rotation handler |
| `a9` | Process signal / exit handler registrar |
| `$` | Daemon status file reader/writer |
| `_Q1` | Daemon status JSON writer |
| `Pn` | Daemon status path resolver |
| `$v6` | Daemon status file path joiner |
| `nv5` | MCP server retry / full-reconnect orchestrator |
| `R78` | MCP server suppression checker (dedup maps) |
| `r8` | Process spawn wrapper with timeout |
| `O` | Process handle map |
| `z` | Daemon process controller (stop/start/replace) |
| `bH` | Feature-flag "ok" telemetry emitter |
| `c` | Core telemetry event dispatcher |
| `uH` | Feature-flag "bad" telemetry emitter |
| `Rk` | Daemon stop/replace orchestrator |
| `Gb` | Daemon OS-level process terminator |
| `OS` | OS signal sender |
| `aTH` | Daemon process cleanup (waitpid-style) |
| `Wb` | V6 background process reference holder |
| `UM_` | Daemon spawn and emit helper |
| `fe6` | Full daemon startup sequence |
| `$p` | Daemon socket / port allocator |
| `pu` | Daemon graceful-shutdown race handler |
| `cg` | Daemon shutdown initiator |
| `og` | Daemon shutdown timeout/cleanup |
| `jf_` | Datadog telemetry post helper |
| `cj_` | Local settings loader for sandbox exclude rules |
| `p8` | Settings context initializer |
| `gp6` | Settings cache get-or-init helper |
| `n4A` | Settings cache has/get accessor |
| `Pl8` | Policy settings loader |
| `i4A` | Settings cache setter |
| `rF` | Settings file reader (all layers) |
| `j_` | Settings schema validator |
| `jA6` | Enterprise settings reader |
| `sR8` | Flag settings reader |
| `zA6` | User settings reader |
| `J2H` | Project settings reader |
| `JA6` | Local settings reader |
| `BfH` | Settings merge helper |
| `FfH` | Settings conflict resolver |
| `zl8` | Settings layer priority sorter |
| `AZA` | Settings defaults applier |
| `sl` | Settings sanitizer |
| `I46` | Settings event emitter (a6/v46/tX) |
| `Ej7` | Exclude-rule pattern matcher (regex) |
| `_A` | Settings writer (all layers, with gitignore/symlink checks) |
| `o$` | Local settings resolve-and-write entry point |
| `dfH` | Settings file path resolver (user/project layers) |
| `oX` | File read helper with gitignore awareness |
| `il` | File read with size limit (4096 bytes) and replaceAll |
| `j8` | Async file write with error handling |
| `K8` | File write error classifier (ENOENT/EISDIR) |
| `Ec8` | Settings cache timestamp updater |
| `M0H` | Settings resolve-and-merge helper |
| `Fp6` | Settings base-path resolver (bv.resolve/dirname) |
| `UK6` | Atomic file write helper (temp+rename, fchmod, fsync) |
| `CY` | Settings cache clear (dy6/pS8) |
| `im6` | Gitignore/exclude-file rule writer |
| `x6` | Git ignore rule generator |
| `Lc8` | File path formatter for ignore rules |
| `nm6` | Git check-ignore runner |
| `FaK` | Git global excludesfile path resolver |
| `fTA` | Git ls-files tracker checker |
| `$TA` | Ignore rule append helper |
| `BC` | `.claude` directory path builder |
| `_8` | Feature-flag "sad" telemetry emitter |
| `hm` | Settings load orchestrator (disk → merge → emit) |
| `DC` | Settings load trace emitter |
| `Tq` | Memory-usage sampler during settings load |
| `Wl8` | Full settings load-from-disk implementation |
| `cy6` | Settings load completion logger |
| `RH` | Error logger / structured error emitter |
| `c_` | Error constructor wrapper |
| `mH` | String coercion helper |
| `G1` | Error context builder (Z2A) |
| `uiK` | Rotating error log (shift/push) |
| `wl` | Interactive sandbox configuration UI opener |