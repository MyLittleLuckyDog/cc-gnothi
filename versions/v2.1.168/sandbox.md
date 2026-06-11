---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.168"
updated: "2026-06-11"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.168 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.168 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.168

---

## Overview

The `/sandbox` command configures the sandbox execution environment for Claude Code, allowing users to control which shell commands are allowed to run without isolation and to add exclusion patterns for specific command globs. It performs platform compatibility checks before applying any changes and persists configuration to the project-local settings file (`.claude/settings.local.json`). Invoked immediately on slash-command entry (no confirmation step), it opens a configuration UI or applies an exclusion rule depending on the arguments provided.

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
| module_id | `TqK` |
| load_inline | `true` |
| loc_byte | `12645203` |
| loc_byte_end | `12645852` |
| loc_line | `9074` |
| arbor_handler.name | `sbf` |
| arbor_handler.fqn | `claude-2.1.168::sbf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.168 bundle.js:+12645203

---

## Input Branching

The handler has 5+ distinct decision paths based on platform support, policy locks, argument presence/format, and WSL version — a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/sandbox invoked"] --> B{Platform supported?\nNA.isSupportedPlatform}
    B -- "No: WSL1 detected" --> C["Error: Sandboxing requires WSL2.\nWSL1 is not supported."]
    B -- "No: unsupported OS" --> D["Error: Sandboxing is currently only\nsupported on macOS, Linux, and WSL2."]
    B -- "Yes" --> E{checkDependencies\nNA.checkDependencies}
    E -- "dependency missing" --> F["Return error message to user"]
    E -- "OK" --> G{isPlatformInEnabledList\nNA.isPlatformInEnabledList}
    G -- "No" --> H["Render JSX configuration UI\n(⏎ to configure)"]
    G -- "Yes" --> I{areSandboxSettingsLockedByPolicy\nNA.areSandboxSettingsLockedByPolicy}
    I -- "Locked" --> J["Error: Sandbox settings are overridden\nby a higher-priority configuration\nand cannot be changed locally."]
    I -- "Not locked" --> K{Arguments present?\nM.split / M.slice}
    K -- "No args" --> H
    K -- "args present" --> L{First token == 'exclude'?}
    L -- "No" --> M["Error: Please provide a command pattern\nto exclude (e.g., /sandbox exclude\n\"npm run test:*\")"]
    L -- "Yes" --> N{Pattern string provided\n(length > 8)?}
    N -- "No pattern" --> M
    N -- "Pattern present" --> O["Parse pattern, call eO to\nread/update settings"]
    O --> P["Write exclusion rule to\n.claude/settings.local.json via BQ"]
    P --> Q["Emit telemetry: sandbox_exclude_command"]
    Q --> R["Return success JSX to user"]
```

---

## Behavioral Spec

### Platform and Dependency Validation

```
async function sandboxCommandHandler(args, appState):
    theme = getTheme()          // yA — light/dark theme resolution
    renderer = getRenderer()    // r6 — JSX renderer

    if not platformModule.isSupportedPlatform():
        wslVersion = detectWSLVersion()
        if wslVersion == "wsl" and wslVersion != "wsl2":
            return errorMessage("Error: Sandboxing requires WSL2. WSL1 is not supported.")
        else:
            return errorMessage("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")

    depCheck = await platformModule.checkDependencies()
    if depCheck fails:
        return errorMessage(depCheck.reason)
```

Analysis basis: CC v2.1.168 bundle.js:+12643822, +12643844, +12643853, +12643889, +12643895, +12643953

---

### Policy Lock Check

```
    if platformModule.areSandboxSettingsLockedByPolicy():
        return errorMessage(
            "Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally."
        )
```

Analysis basis: CC v2.1.168 bundle.js:+12644259, +12644318

---

### Argument Parsing and Subcommand Dispatch

The raw argument string is split and sliced to extract the subcommand token and optional pattern argument.

```
    tokens = args.split(" ")           // M.split at +12644545
    subcommand = tokens[0]             // slice at +12644585

    if subcommand == "exclude":
        patternArg = tokens.slice(1).join(" ").trim()
        if patternArg.length <= 8:     // literal 8 at +12644593
            return errorMessage(
                "Error: Please provide a command pattern to exclude " +
                "(e.g., /sandbox exclude \"npm run test:*\")"
            )
        // Strip surrounding quotes if present
        cleanPattern = patternArg.replace(quoteRegex, "")  // z.replace at +12644749
        applyExclusionRule(cleanPattern, appState)
    else if subcommand == undefined or subcommand == "":
        renderConfigurationUI(appState, theme, renderer)
    else:
        renderConfigurationUI(appState, theme, renderer)
```

Analysis basis: CC v2.1.168 bundle.js:+12644545, +12644568, +12644585, +12644593, +12644630, +12644749

---

### Exclusion Rule Application

When a valid pattern is supplied after `exclude`, the handler reads and writes local project settings.

```
function applyExclusionRule(pattern, appState):
    // eO: read current settings object from disk at +12644791
    currentSettings = readSettingsObject()

    // WqK.relative: compute path relative to project root at +12644815
    relPath = path.relative(projectRoot, settingsPath)

    // BQ: persist updated settings back to .claude/settings.local.json at +12644828
    newSettings = mergeExclusionPattern(currentSettings, pattern)
    writeSettingsFile(".claude/settings.local.json", newSettings)

    emitTelemetry("sandbox_exclude_command")   // literal at +12644990 (via Ov_ at +12644778)
```

Analysis basis: CC v2.1.168 bundle.js:+12644778, +12644791, +12644815, +12644828, +12644836, +12644990

---

### Settings Layer Traversal (`Ov_` — Local Settings Manager)

The settings helper `Ov_` loads the `localSettings` layer, filters applicable rules through `mrL` (regex match), and uses `addRules` to accumulate exclusion entries. It interacts with the settings cache managed by `x8`/`vn6`/`kd`.

```
function localSettingsManager(context):
    settings = loadSettingsLayer("localSettings")   // x8 + vn6 at +4704610
    filtered = settings.filter(isNotExcluded)       // Ov_.filter at +4704681
    matching = filtered.filter(mrL)                 // mrL.match at +4704855 / +4695595
    if pattern in existing rules:                   // q.includes at +4704894
        return existing
    addRules(filtered, "addRules")                  // literal at +4704704
    emitTelemetry("sandbox_exclude_command")        // literal at +4704990
    displaySuccess(SH)                              // SH at +4704987
```

Analysis basis: CC v2.1.168 bundle.js:+4704610, +4704681, +4704855, +4704894, +4704908, +4704987, +4704990

---

### Color/ANSI Rendering Utility (`ZA` / `WwH`)

The command uses a shared color-rendering utility for terminal output. It parses color prefixes (`rgb(`, `ansi256(`, `ansi:`, named colors) and applies the appropriate chalk/`j6` method. This is called when formatting error or status messages in the terminal.

```
function applyColorTag(colorSpec, text):
    if colorSpec.startsWith("rgb("):   // literal at +3819619
        [r, g, b] = parseRgbComponents(colorSpec)
        return chalk.rgb(r, g, b)(text)
    elif colorSpec.startsWith("ansi256("):   // literal at +3819660
        index = parseAnsi256Index(colorSpec)
        return chalk.ansi256(index)(text)
    elif colorSpec.startsWith("ansi:"):   // literal at +3819686
        name = colorSpec.substring(5)
        return chalk[name](text)           // named color dispatch
    else:
        return chalk[colorSpec](text)      // fallback named color
```

Analysis basis: CC v2.1.168 bundle.js:+3819562, +3819606, +3819619, +3819660, +3819686, +3819702, +3819726

---

### MCP Integration During Sandbox Configuration UI

When the configuration UI is rendered, the handler re-evaluates the current MCP server state via `M` / `xbH` (the MCP supervisor/connection manager). This includes resolving connected servers, their tool lists, and trust states (`approved`, `pending`). This is a read-only side effect — the sandbox command does not modify MCP state.

Analysis basis: CC v2.1.168 bundle.js:+12644030, +12644054, +12644070, +12644097, +15879305, +15879315

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_ok` (bundle.js:+1010950), `tengu_feature_bad` (bundle.js:+1011012), `tengu_feature_sad` (bundle.js:+1011093), `tengu_mcp_oauth_flow_start` (+10291163), `tengu_mcp_oauth_flow_success` (+10295951), `tengu_mcp_oauth_flow_error` (+10297336), `tengu_daemon_config_reload` (+16212414), `tengu_mcp_skills` (+6966851), `tengu_config_auth_loss_prevented` (+3262741), `tengu_skill_file_changed` (+14200517), `tengu_daemon_yield` (+16216637), `tengu_daemon_control` (+16233972) |
| Settings write | Exclusion patterns written to `.claude/settings.local.json` (literal at bundle.js:+12644836) |
| Platform gate | `NA.isSupportedPlatform`, `NA.isPlatformInEnabledList`, `NA.checkDependencies` called on every invocation (bundle.js:+12643853, +12644070, +12644097) |
| Policy lock check | `NA.areSandboxSettingsLockedByPolicy` — blocks writes when enterprise policy is active (bundle.js:+12644259) |
| MCP state read | MCP connection/supervisor state is read (not written) when rendering the config UI (bundle.js:+12644054) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | Sandbox exclusion rules are merged into the local settings layer; no other appState mutation observed at depth ≤ 2 |

---

## Version History

| Version | Change |
|---|---|
| v2.1.168 | Initial analysis |

---

## Common Mistakes

1. **Omitting quotes around glob patterns**: The argument hint shows `exclude "command pattern"` — the pattern string should be quoted when it contains spaces or shell metacharacters (e.g., `*`). Without quotes the argument parser may misinterpret multi-word patterns.
2. **Running on WSL1**: The command explicitly checks for WSL version and rejects WSL1. Users on Windows must upgrade to WSL2 before sandbox configuration is available (bundle.js:+12643889).
3. **Attempting local overrides under enterprise policy**: When `areSandboxSettingsLockedByPolicy` returns true, all local writes are blocked with a descriptive error. Users should contact their administrator rather than attempting workarounds via direct file edits (bundle.js:+12644259).
4. **Expecting `/sandbox exclude` without a pattern to clear rules**: Providing the `exclude` subcommand without a quoted pattern argument triggers an error prompt rather than a clear/reset action — the command requires an explicit glob string of length greater than 8 characters (bundle.js:+12644593).
5. **Assuming the command modifies MCP settings**: `/sandbox` reads MCP state for UI rendering but does not write to MCP configuration; use `/mcp` for MCP-specific changes.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `sbf` | Main async handler for `/sandbox` command |
| `ZA` | Color/ANSI tag formatter (routes to `WwH`) |
| `WwH` | Terminal color dispatch (chalk wrapper, named + rgb + ansi256) |
| `H` | Bootstrap/fetch utility (fetches remote config; also used as generic call target) |
| `v` | Log/debug utility (calls `snK`, `RH`, `G4`, `iy`, `EUH`, `_iK`) |
| `snK` | Log sink (writes to internal log queue) |
| `RH` | JSON serializer helper |
| `G4` | Argument/path extraction helper |
| `EUH` | Log format helper (calls `nWA`) |
| `_iK` | File write/buffer utility (handles async file I/O with `Buffer.byteLength`) |
| `mj_` | String splitter/trimmer for argument parsing |
| `lHH` | Set membership check helper |
| `uj` | String replacement helper |
| `H9` | Command-string normalization (calls `m6H`, `s9`, `FJ`) |
| `m6H` | Model alias resolver |
| `s9` | Model/alias normalizer (lower-cases, trims, maps aliases) |
| `FJ` | Format/join utility |
| `o6` | Output renderer (calls `l`, `J6`) |
| `J6` | JSX/ink render helper (calls `hm6`) |
| `hc` | Color theme helper |
| `M` | MCP supervisor / connection state manager |
| `xbH` | MCP connection orchestrator |
| `sl` | MCP server list builder |
| `qT6` | MCP server slot validator |
| `bs` | MCP server bootstrap/connect handler |
| `al` | MCP server entry accumulator |
| `cD8` | MCP config error color-renderer (red/yellow) |
| `AT6` | MCP tool registry updater |
| `kk` | MCP tool hash/fingerprint builder |
| `qz` | Config hash utility |
| `xx_` | Config hash secondary utility |
| `K` | MCP transport/client collection |
| `L` | MCP async task set |
| `f` | MCP connection/channel object |
| `a8` | Utility wrapper |
| `ly6` | MCP server filter helper |
| `hhq` | MCP server connection health checker |
| `NHA` | MCP needs-auth cache reader |
| `tXH` | MCP tool hash generator (SHA-256 via `Pp9.createHash`) |
| `UD8` | MCP tool update dispatcher |
| `BD8` | MCP tool batch dispatcher |
| `EP` | MCP tool entry hasher |
| `mD8` | MCP tool deduplication helper |
| `z4` | Config serializer |
| `M8` | MCP debug log pusher |
| `wk8` | MCP server connection runner (main connect loop) |
| `Y7f` | MCP server config resolver |
| `vd` | MCP auth state reader |
| `X9H` | MCP OAuth connector |
| `P9H` | MCP protocol version handler |
| `W9H` | MCP OAuth flow manager (server, redirect, token exchange) |
| `dA6` | MCP connection deduplication map manager |
| `D` | Process/abort controller |
| `Jk8` | MCP needs-auth cache writer |
| `an` | MCP reconnect handler |
| `Au` | App state reader |
| `Y` | MCP supervisor config updater |
| `v7` | MCP error log pusher |
| `GH` | String coercion helper |
| `D7f` | MCP disconnect handler |
| `z7f` | MCP SSH/URL transport selector |
| `jk8` | MCP tool result processor |
| `QA6` | MCP pending-auth cache getter |
| `cA6` | MCP failure-cache getter |
| `phq` | MCP needs-auth cache orchestrator |
| `V9` | Async store getter (async local storage) |
| `ck8` | MCP cache path builder |
| `Ze_` | MCP error serializer |
| `j` | MCP process/stream registry |
| `A` | MCP process name normalizer |
| `S` | MCP process kill/write handler |
| `tN` | MCP skills/tool notification emitter |
| `D6` | MCP skills event dispatcher |
| `hx_` | MCP tool schema validator |
| `X8` | Settings file writer (global config, auth-loss guard) |
| `k` | File watcher entry |
| `P6` | Ink/JSX render helper |
| `R` | Stream write helper |
| `bhq` | Async iterator/mapper wrapper |
| `AF` | Async iterator implementation |
| `L16` | Port parser (parseInt base 10) |
| `lk8` | Port parser variant (parseInt base 10) |
| `PF8` | MCP apply-connection-result handler |
| `bbH` | MCP tool fingerprint updater |
| `Ay` | MCP server cleanup orchestrator |
| `q16` | MCP tool snapshot helper |
| `$` | Daemon status writer |
| `DLK` | Daemon status file builder |
| `Yo` | Daemon status formatter |
| `YC6` | Daemon status path builder |
| `cDA` | MCP full reconnect/refresh loop |
| `nD8` | MCP server suppression checker |
| `r8` | Async timeout/abort utility |
| `O` | Background session descriptor |
| `z` | Daemon/session stop controller |
| `SH` | Success output renderer |
| `CH` | Error output renderer |
| `uh` | REPL/session initializer |
| `yu` | Session config builder |
| `kC` | Settings merge utility |
| `EvH` | REPL event handler |
| `xh` | REPL skills dispatcher |
| `yP_` | Session bootstrap (MCP, UUID, emit) |
| `pq8` | Full session runner |
| `ZB` | Session token generator |
| `sp` | Graceful shutdown orchestrator |
| `RLH` | Shutdown signal relay |
| `pLH` | Shutdown timeout/post handler |
| `q2_` | Shutdown post helper |
| `Ov_` | Local settings manager / exclusion rule applier |
| `x8` | Settings cache loader |
| `vn6` | Settings cache fetch helper |
| `tXA` | Settings cache get helper |
| `___` | Settings layer assembler |
| `eXA` | Settings cache set helper |
| `kd` | Settings full loader (all layers) |
| `W_` | Settings default builder |
| `RL6` | Settings layer reader (role-level) |
| `Xd8` | Settings schema validator |
| `kL6` | Settings key lister |
| `kTH` | Settings key transformer |
| `yTH` | Settings value transformer |
| `bL6` | Settings boolean coercer |
| `TzH` | Settings path normalizer |
| `EzH` | Settings env-override applier |
| `i8_` | Settings inline override applier |
| `kpA` | Settings policy applier |
| `ir` | Settings flag applier |
| `_36` | Settings final resolver |
| `mrL` | Exclusion pattern matcher (regex) |
| `o_` | Settings write handler (update + file write) |
| `eO` | Settings read handler |
| `NzH` | User settings path resolver |
| `d6` | fs stat/exists utility |
| `oP` | Settings file atomic writer |
| `Br` | Settings file reader/parser |
| `h8` | Error code classifier |
| `V8` | ENOENT/ELOOP/ENOTDIR handler |
| `e6_` | Settings cache invalidator |
| `IZH` | Settings path/context resolver |
| `Nn6` | Settings path builder (`.claude`) |
| `O$6` | Atomic file write utility (temp + rename) |
| `LY` | Settings cache clear utility |
| `hl6` | Gitignore/excludes file manager |
| `u6` | Git check-ignore runner |
| `u6_` | Git config reader |
| `yl6` | Git check-ignore parser |
| `GZ4` | Path home-tilde expander |
| `yuA` | Gitignore rule parser |
| `huA` | Gitignore write helper |
| `qu` | Settings path joiner |
| `gU` | Settings load orchestrator (start + end telemetry) |
| `aE` | Settings load pre-check |
| `b9` | Memory/telemetry probe |
| `A__` | Settings load async runner |
| `wp6` | Settings post-load validator |
| `hH` | Error logger / stderr emitter |
| `AA` | Error string coercer |
| `_6` | String coercion utility |
| `$q` | Log drain reader |
| `DG4` | Log ring-buffer manager |
| `BQ` | Settings persistence writer (final write to disk) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.