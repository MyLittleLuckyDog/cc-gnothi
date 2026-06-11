---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.167"
updated: "2026-06-11"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.167 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.167 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.167

---

## Overview

The `/sandbox` command configures the sandboxing environment for Claude Code by managing which shell commands are allowed to run outside the sandbox. Its primary use case is to add exclusion patterns (via the `exclude` subcommand) for command patterns that should bypass the sandbox, and to interactively configure sandbox settings when invoked without arguments. The command enforces platform compatibility checks before any configuration changes are made, and respects policy locks that prevent local overrides.

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
| module_id | `WqK` |
| load_inline | `true` |
| loc_byte | `12645018` |
| loc_byte_end | `12645667` |
| loc_line | `9074` |
| arbor_handler.name | `obf` |
| arbor_handler.fqn | `claude-2.1.167::obf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.167 bundle.js:+12645018

---

## Input Branching

The command has 4+ distinct branches depending on platform state, policy lock status, and the argument provided. A Mermaid flowchart is used below.

```mermaid
flowchart TD
    A["/sandbox invoked"] --> B{Check theme: 'light' mode?}
    B -->|yes| C[Apply light theme rendering path]
    B -->|no| D{Check platform via NA.isSupportedPlatform}
    D -->|WSL1 detected| E["Return error:\n'Sandboxing requires WSL2. WSL1 is not supported.'"]
    D -->|Not macOS/Linux/WSL2| F["Return error:\n'Sandboxing is currently only supported on\nmacOS, Linux, and WSL2.'"]
    D -->|supported platform| G{Call NA.checkDependencies}
    G -->|missing deps| H[Return dependency error]
    G -->|deps OK| I{Call NA.isPlatformInEnabledList}
    I -->|platform not in enabled list| J[Return platform unsupported message]
    I -->|enabled| K{Call NA.areSandboxSettingsLockedByPolicy}
    K -->|locked by policy| L["Return error:\n'Sandbox settings are overridden by a\nhigher-priority configuration and cannot\nbe changed locally.'"]
    K -->|not locked| M{Parse argument}
    M -->|argument starts with 'exclude'| N{Extract pattern from argument}
    N -->|pattern missing or arg length < 8| O["Return error:\n'Please provide a command pattern to exclude\n(e.g., /sandbox exclude \"npm run test:*\")'"]
    N -->|pattern present| P[Call addRules / o_ to add exclusion rule\nWrite to .claude/settings.local.json\nFire sandbox_exclude_command telemetry]
    M -->|no argument / empty| Q[Launch interactive JSX configuration UI\nvia ZA render path]
    P --> R[Return success confirmation]
    Q --> S[User configures sandbox settings interactively]
```

---

## Behavioral Spec

### Main Handler — `sandboxCommandHandler` (`obf`)

The handler is an `AsyncFunction` resolved via `module_id` → `WqK`.

Analysis basis: CC v2.1.167 bundle.js:+12643637

```
async function sandboxCommandHandler(args, context):
    theme = getTheme()                          // yA call @ +12643637
    colorRenderer = getColorRenderer()          // r6 call @ +12643659

    // Platform compatibility gate
    if not NA.isSupportedPlatform():            // @ +12643668
        wslVersion = detectWSLVersion()
        if wslVersion == "wsl":
            return renderError("Error: Sandboxing requires WSL2. WSL1 is not supported.")
                                                // literal @ +12643710
        else:
            return renderError("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")
                                                // literal @ +12643768

    // Dependency check
    depResult = await NA.checkDependencies()    // @ +12643885
    if depResult has errors:
        return renderError(depResult.message)

    // Platform enablement check
    if not NA.isPlatformInEnabledList():        // @ +12643912
        return renderError("error")             // literal @ +12643848

    // Policy lock check
    if NA.areSandboxSettingsLockedByPolicy():   // @ +12644074
        return renderError(
            "Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally."
        )                                       // literal @ +12644133

    // Parse argument
    rawArg = args.trim()
    parts = rawArg.split(" ")                   // M.split @ +12644360
    subcommand = parts[0]

    if subcommand == "exclude":                 // literal @ +12644383
        // Argument byte offset check: require length > 8
        if rawArg.length <= 8:                  // literal 8 @ +12644408
            return renderError(
                "Error: Please provide a command pattern to exclude (e.g., /sandbox exclude \"npm run test:*\")"
            )                                   // literal @ +12644445

        pattern = parts.slice(1).join(" ")
        pattern = pattern.replace(outerQuotesRegex, "")  // z.replace @ +12644564

        // Load local settings
        localSettings = loadLocalSettings()     // $v_ / x8 @ +12644593
        localSettings = addExclusionRule(localSettings, pattern)
                                                // o_ / addRules path @ +12644606

        // Compute relative path for settings file
        relPath = XqK.relative(cwd, settingsPath)  // @ +12644630

        // Persist to .claude/settings.local.json
        writeSettings(localSettings)            // BQ @ +12644643
                                                // path literal @ +12644651

        return renderSuccess(relPath, pattern)

    else:
        // No recognized subcommand: open interactive configuration UI
        return renderInteractiveConfig(context) // ZA @ +12643845
```

Analysis basis: CC v2.1.167 bundle.js:+12643637 – +12644667

---

### Interactive Configuration Renderer — `renderInteractiveConfig` (`ZA`)

```
function renderInteractiveConfig(context):
    // Determine foreground rendering context
    // literal "foreground" @ +3819446
    if context.mode.startsWith("foreground"):  // H.startsWith @ +3819490
        // Render colored ANSI output using colorMapper (WwH)
        // Supports full chalk color palette:
        //   black, red, green, yellow, blue, magenta, cyan, white,
        //   and Bright variants, plus ansi256, rgb, hex color modes
        output = buildColoredInteractiveUI(context)
                                               // WwH @ +3819586
    else:
        output = buildPlainInteractiveUI(context)

    return renderJSX(output)                   // hc @ +3819610
```

Analysis basis: CC v2.1.167 bundle.js:+3819446

---

### Bootstrap / Settings Fetch — `bootstrapFetch` (`H`)

When settings must be fetched remotely (e.g., to compare policy state):

```
function bootstrapFetch(url, options):
    log("[Bootstrap] Fetching", url)            // literal @ +15797460
    headers = {
        "Content-Type": "application/json",    // @ +15797545
        "User-Agent": <userAgent>              // @ +15797579
    }
    response = await fetch(url, { headers, timeout: 5000 })
                                               // literal 5000 @ +15797661

    if not response.ok:
        telemetry("api_bootstrap_fetch",       // @ +15797782
                  { result: "parse_failed" })  // @ +15797804
        throw error

    log("[Bootstrap] Fetch ok")                // @ +15797834
    telemetry("api_bootstrap_fetch", { result: "ok" })
    return response.json()
```

Analysis basis: CC v2.1.167 bundle.js:+15797458

---

### Exclusion Rule Writer — `addExclusionRule` (`o_`)

```
function addExclusionRule(localSettings, pattern):
    // Resolve canonical path context
    projectRoot = resolveProjectRoot()         // NzH / Vn6 @ +1282460
    configDir = vZH.dirname(configPath)        // @ +1282510
    settingsData = loadSettingsFromDisk()      // H__ / kd @ +1282532

    // Validate pattern is not already present
    existingRules = settingsData.addRules ?? []
    if pattern already in existingRules:
        return settingsData                    // no-op

    // Append new rule
    settingsData.addRules = [...existingRules, pattern]

    // Validate with schema
    validated = validateSettings(settingsData) // x9 @ +1282620

    // Atomic write via temp-file rename
    atomicWriteFile(settingsPath, validated)   // $$6 @ +1283063

    // Update in-memory cache
    updateSettingsCache(settingsData)          // LY @ +1283205

    // Emit telemetry
    emit("sandbox_exclude_command")            // literal @ +4704874

    // Notify listeners
    AgH.emit("settingsChanged", settingsData)  // @ +1283616

    return settingsData
```

Analysis basis: CC v2.1.167 bundle.js:+1282460

---

### Settings Load from Disk — `loadSettingsFromDisk` (`gU` / `___`)

```
async function loadSettingsFromDisk():
    telemetry("loadSettingsFromDisk_start")    // @ +1280588

    // Ordered config layer resolution:
    // 1. policySettings  (highest priority)   // literal @ +1276699
    // 2. flagSettings                          // @ +1276778
    // 3. localSettings                         // @ +4704497
    // 4. userSettings                          // @ +1272707
    // 5. projectSettings                       // @ +1272758

    for each layer in [policy, flag, local, user, project]:
        data = readAndParseLayer(layer)
        mergeIntoSettings(data)

    telemetry("settings_load_completed")       // @ +1277886
    telemetry("loadSettingsFromDisk_end")      // @ +1280644

    return mergedSettings
```

Analysis basis: CC v2.1.167 bundle.js:+1277136

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `sandbox_exclude_command` | Fired after successfully writing an `exclude` rule (bundle.js:+4704874) |
| Telemetry — `tengu_feature_ok` | Fired on feature-check success path (bundle.js:+1010950) |
| Telemetry — `tengu_feature_bad` | Fired on feature-check failure path (bundle.js:+1011012) |
| Telemetry — `tengu_feature_sad` | Fired on feature-check error/exception path (bundle.js:+1011093) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a settings write would have dropped auth credentials (bundle.js:+3262625) |
| Telemetry — `settings_load_started` / `settings_load_completed` | Bracket every settings disk read (bundle.js:+1277157, +1277886) |
| Telemetry — `tengu_mcp_*` | MCP OAuth and reconnect events reachable through the call graph but not directly triggered by `/sandbox` |
| File write | Persists exclusion rules to `.claude/settings.local.json` (literal @ bundle.js:+12644651) |
| In-memory cache invalidation | `LY` clears the settings cache (`Yp6.clear`, `HQ8.clear`) after each write (bundle.js:+26801) |
| appState changes | Emits a `settingsChanged` event via `AgH.emit` (bundle.js:+1283616); interactive config path calls `hc` JSX renderer |
| Sound | None detected |
| Policy guard | `NA.areSandboxSettingsLockedByPolicy()` prevents writes when enterprise policy overrides are active (bundle.js:+12644074) |
| Atomic write safety | Uses temp-file + rename pattern (`D$.openSync`, `D$.writeFileSync`, `D$.fsyncSync`, `q.renameSync`) to prevent partial writes (bundle.js:+1057644) |
| Auth-loss guard | Refuses to write settings if re-read config is missing auth present in cache (bundle.js:+3262497, telemetry @ +3262625) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.167 | Initial analysis |

---

## Common Mistakes

1. **Providing a pattern without quotes when it contains spaces or wildcards.** The argument hint `exclude "command pattern"` indicates the pattern should be quoted. Without quotes, only the first token after `exclude` is captured.
2. **Running `/sandbox exclude` with no pattern.** The handler checks that the argument length exceeds 8 characters (the length of `"exclude "`); an empty or short argument returns an error with the example form.
3. **Using `/sandbox` on WSL1.** The WSL version is checked explicitly. WSL1 is rejected; WSL2 is required.
4. **Expecting `/sandbox` to work on Windows (non-WSL).** The platform guard only allows macOS, Linux, and WSL2. Native Windows is rejected.
5. **Expecting local exclusion rules to override enterprise policy.** When `NA.areSandboxSettingsLockedByPolicy()` returns true, no local changes can be persisted and the command returns an error.
6. **Assuming the exclusion is applied globally.** Rules are written to `.claude/settings.local.json` in the project directory, not to the user-level or global settings file.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `obf` | Main sandbox command handler (AsyncFunction, resolved via module_id `WqK`) |
| `ZA` | Interactive configuration renderer; dispatches to color-aware or plain UI |
| `H` | Bootstrap fetch / settings HTTP helper |
| `v` | Debug-level logging helper (`"debug"` literal nearby) |
| `onK` | Log entry constructor (takes level, message, metadata) |
| `RH` | JSON stringify utility |
| `G4` | Argument/token redactor (replaces sensitive values with `"[REDACTED]"`) |
| `EUH` | Async utility wrapper (`lWA`) |
| `enK` | Byte-length-aware async buffer/stream helper |
| `Y3` | User-agent string builder |
| `uj_` | Argument string splitter / trim helper |
| `q` | File unlink / cleanup helper |
| `lHH` | Cache membership checker (`i74.has`) |
| `uj` | String replace utility |
| `H9` | Model name / alias resolver |
| `m6H` | Model qualifier builder |
| `s9` | Model alias normalizer (trim, lowercase, map aliases like `"sonnet"`, `"haiku"`, `"opus"`) |
| `FJ` | Model alias dispatch table |
| `o6` | JSX component mount helper |
| `l` | Logger / low-level output writer |
| `J6` | React/JSX element factory (`ym6`) |
| `WwH` | ANSI/chalk color mapper (maps color name strings to chalk calls) |
| `hc` | JSX render finalizer for interactive config output |
| `M` | MCP server connection manager |
| `xbH` | MCP connection executor (orchestrates server connect/reconnect lifecycle) |
| `sl` | MCP server slot resolver |
| `AT6` | MCP connection slot helper |
| `bs` | MCP bulk-server connection processor |
| `al` | MCP server entry lister |
| `dD8` | MCP error/warning color formatter |
| `_T6` | MCP SSE/HTTP transport type router |
| `Ik` | MCP capability intersection checker |
| `qz` | MCP capability query executor |
| `bx_` | MCP capability fallback handler |
| `K` | Padded label map/render helper |
| `L` | Async task add/delete/finally tracker |
| `f` | Stream close/open handle |
| `a8` | Identity / pass-through wrapper |
| `cy6` | MCP connection filter (filters disabled entries) |
| `yhq` | MCP server hash / fingerprint builder |
| `VHA` | MCP tool version/descriptor helper |
| `tXH` | MCP config hash computer (SHA-256 via `Xp9.createHash`) |
| `pD8` | MCP server validation helper |
| `UD8` | MCP update-descriptor builder |
| `EP` | SHA-256 hash helper (`fp9.createHash`) |
| `uD8` | MCP state normalizer |
| `z4` | Settings persistence primitive |
| `M8` | MCP debug log pusher (`pr.logMCPDebug`) |
| `Dk8` | MCP OAuth + connection full lifecycle driver |
| `$7f` | OAuth pre-flight helper |
| `vd` | OAuth token store accessor |
| `X9H` | OAuth JWK/BLF helper |
| `P9H` | OAuth PKCE helper |
| `W9H` | MCP OAuth local callback server manager (starts HTTP server on `127.0.0.1`) |
| `QA6` | OAuth in-flight request map manager |
| `D` | Forced-shutdown / process exit handler |
| `jk8` | MCP descriptor version helper |
| `an` | MCP reconnect orchestrator |
| `Au` | OAuth token/credential accessor |
| `Y` | Supervisor/daemon config updater |
| `v7` | MCP error log pusher (`pr.logMCPError`) |
| `GH` | Generic string coercer (`String(...)`) |
| `O7f` | OAuth race-condition guard |
| `M7f` | SSH-session MCP URL resolver |
| `wk8` | MCP tool-call dispatcher |
| `gA6` | In-flight MCP request getter |
| `dA6` | Cached MCP auth getter |
| `mhq` | MCP server metadata / needs-auth cache reader |
| `V9` | AsyncLocalStorage store getter |
| `dk8` | MCP needs-auth cache path builder (`mcp-needs-auth-cache.json`) |
| `Ee_` | MCP early-exit / error escalator |
| `j` | Process/subprocess value iterator |
| `A` | Filename lowercaser |
| `S` | Child process / subprocess manager |
| `tN` | MCP skills telemetry emitter (`tengu_mcp_skills`) |
| `D6` | MCP skills event dispatcher |
| `yx_` | MCP tool-permission gate |
| `X8` | Global config save helper (with auth-loss guard) |
| `k` | File watcher registration helper (chokidar) |
| `P6` | React element builder (`ym6`) |
| `R` | Transient background-worker yield handler |
| `Chq` | Async iterator / abort-signal mapper (`AF`) |
| `AF` | Abort-signal-aware async iterable mapper |
| `K16` | Port base parser (`parseInt`, base 10) |
| `ck8` | Port offset parser (`parseInt`, base 20) |
| `XF8` | MCP connection result applier |
| `bbH` | MCP connection hash checker |
| `_y` | MCP slot cleanup + skills-notify helper |
| `A16` | MCP tool descriptor hash verifier |
| `$` | Daemon status writer (`zLK`) |
| `zLK` | Daemon status JSON emitter (`daemon.status.json`) |
| `Yo` | Daemon status timestamp helper |
| `zC6` | Daemon status file path builder |
| `dDA` | MCP remote-server retry / recovery controller |
| `lD8` | MCP server suppression checker |
| `r8` | Timeout-with-cleanup helper |
| `O` | Background-session object (`b8`) |
| `z` | Daemon stop / foreground-session lifecycle manager |
| `SH` | "Feature ok" telemetry JSX renderer |
| `CH` | "Feature bad" telemetry JSX renderer |
| `xh` | Plugin/MCP server loader |
| `yu` | Plugin config parser |
| `kC` | Plugin config validator |
| `EvH` | First-party plugin handler |
| `bh` | Plugin skills emitter |
| `kP_` | External plugin launcher |
| `mq8` | External plugin process runner |
| `ZB` | Plugin auth token generator |
| `sp` | Daemon graceful-shutdown sequencer |
| `RLH` | MCP SDK shutdown caller |
| `pLH` | Pending-request drainer with timeout |
| `A2_` | Post-shutdown cleanup poster |
| `$v_` | Local settings loader + rule filter |
| `x8` | Settings registry loader |
| `Nn6` | Settings cache hit/miss resolver |
| `sXA` | Settings cache getter (`Yp6.get`) |
| `H__` | Settings file reader (policy + flag layers) |
| `tXA` | Settings cache setter (`Yp6.set`) |
| `kd` | Settings layer constructor / merger |
| `W_` | Settings layer base class / prototype (`tv`) |
| `SL6` | Settings schema validator (layer: project) |
| `Jd8` | Settings schema validator (layer: user) |
| `IL6` | Settings schema validator (layer: flag) |
| `kTH` | Settings schema validator (layer: policy) |
| `yTH` | Settings schema validator (layer: local) |
| `CL6` | Settings merged-view builder |
| `TzH` | Settings write-guard (auth-loss prevention) |
| `EzH` | Settings diff/merge helper |
| `n8_` | Settings file existence checker |
| `IpA` | Settings policy-lock evaluator |
| `ir` | Settings `isSandboxEnabled` accessor |
| `H36` | Settings bootstrap loader |
| `brL` | Argument quoted-string extractor (regex match) |
| `o_` | Exclusion rule writer (core settings mutation path) |
| `eO` | Settings path resolver |
| `NzH` | Project root / `.claude` directory resolver |
| `d6` | File-system stat helper |
| `oP` | Settings file reader with 4096-byte buffer |
| `Br` | Config file reader (readFileSync with slice/replaceAll) |
| `h8` | `ENOENT`-tolerant file reader |
| `V8` | `ENOENT` error classifier |
| `t6_` | Timestamp cache setter (`xl6.set`) |
| `IZH` | Settings path + kd loader |
| `Vn6` | `.claude` directory path resolver (TI.resolve/dirname) |
| `$$6` | Atomic file writer (open/write/fsync/rename/unlink) |
| `LY` | Settings in-memory cache invalidator (`Yp6.clear`, `HQ8.clear`) |
| `yl6` | Settings file writer with gitignore awareness |
| `u6` | Git check-ignore runner |
| `x6_` | Git repo root detector |
| `kl6` | Global gitignore path resolver |
| `PZ4` | Home-dir-aware path normalizer |
| `kuA` | Gitignore rule appender |
| `yuA` | Settings write-warning emitter |
| `qu` | `.claude/settings.json` canonical path builder |
| `gU` | Settings load orchestrator (calls `___` and `kd`) |
| `aE` | Settings telemetry start emitter |
| `b9` | Memory-usage telemetry emitter |
| `___` | Settings full-load worker (all layers, dedup, telemetry) |
| `Dp6` | Settings load error reporter |
| `hH` | Error log pusher to rolling buffer + `pr.logError` |
| `AA` | Error message formatter |
| `_6` | String coercion helper (`String(...)`) |
| `$q` | Error queue reader (`QRA`) |
| `zG4` | Rolling error buffer manager (shift/push on `Sc6`) |
| `BQ` | Settings persistence finalizer (writes `.claude/settings.local.json`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.