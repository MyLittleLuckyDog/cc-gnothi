---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.132"
updated: "2026-05-31"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.132 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.132 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.132

---

## Overview

The `/sandbox` command configures the sandboxing subsystem for Claude Code. It supports adding command-pattern exclusions from sandboxing, enforces platform compatibility checks, and respects enterprise policy locks that can prevent local configuration changes. The command writes exclusion rules to the local settings file (`.claude/settings.local.json`) when the user specifies patterns to exempt.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `sandbox` |
| description | `" ...   ...  (⏎ to configure)"` |
| argumentHint | `exclude "command pattern"` |
| immediate | `true` |
| isHidden | `null` |
| module_id | `z$q` |
| load_inline | `true` |
| handler | `HD7` (resolved via `module_id` path) |
| `loc_byte_end` | `11294858` |
| `arbor_handler.name` | `HD7` |
| `arbor_handler.kind` | `AsyncFunction` |
| `arbor_handler.resolution_path` | `module_id` |
| `arbor_handler.fqn` | `claude-2.1.132::HD7` |
| `arbor_handler.n_hits` | `2` |

Analysis basis: CC v2.1.132 bundle.js:+11294209 – +11294858

---

## Input Branching

The handler (`HD7`) processes arguments and gates execution on several sequential checks before writing configuration.

```mermaid
flowchart TD
    A["/sandbox invoked"] --> B[Check theme context\nbundle.js:+11292828]
    B --> C[Check platform support\nUA.isSupportedPlatform\nbundle.js:+11292859]
    C --> D{Platform supported?}
    D -- "WSL1 detected" --> E["Error: Sandboxing requires WSL2.\nWSL1 is not supported.\nbundle.js:+11292901"]
    D -- "Unsupported OS" --> F["Error: Sandboxing is currently only\nsupported on macOS, Linux, and WSL2.\nbundle.js:+11292959"]
    D -- Supported --> G[Check dependencies\nUA.checkDependencies\nbundle.js:+11293076]
    G --> H[Check if platform is\nin enabled list\nUA.isPlatformInEnabledList\nbundle.js:+11293103]
    H --> I{Policy lock check\nUA.areSandboxSettingsLockedByPolicy\nbundle.js:+11293265}
    I -- "Locked by policy" --> J["Error: Sandbox settings are overridden\nby a higher-priority configuration\nand cannot be changed locally.\nbundle.js:+11293324"]
    I -- "Not locked" --> K{Parse argument\nbundle.js:+11293551}
    K -- "subcommand == 'exclude'" --> L{Pattern argument\npresent?}
    L -- "No pattern" --> M["Error: Please provide a command pattern\nto exclude (e.g., /sandbox exclude\n\"npm run test:*\")\nbundle.js:+11293636"]
    L -- "Pattern provided" --> N[Resolve exclusion rule\nand call addRules\nbundle.js:+3983357]
    N --> O[Emit sandbox_exclude_command\ntelemetry event\nbundle.js:+3983643]
    O --> P[Write to .claude/settings.local.json\nbundle.js:+11293842]
    K -- "No subcommand" --> Q[Open interactive\nconfiguration UI\nbundle.js:+11293784]
```

---

## Behavioral Spec

### Platform Validation

The handler begins by checking the runtime theme/color context, then delegates platform gating to the `UA` platform-utilities module.

```
async function sandboxHandler(args, context):
    themeContext = getThemeContext()          // K_ — bundle.js:+11292828
    colorSupport = getColorSupport()          // s6 — bundle.js:+11292850

    if not platformUtils.isSupportedPlatform():
        wslVersion = detectWSLVersion()       // q_ — bundle.js:+11293036
        if wslVersion.startsWith("wsl") and wslVersion == "wsl1":
            return error("Error: Sandboxing requires WSL2. WSL1 is not supported.")
            // bundle.js:+11292901
        else:
            return error("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")
            // bundle.js:+11292959

    checkDependencies()                       // UA.checkDependencies — bundle.js:+11293076
    isPlatformEnabled = platformUtils.isPlatformInEnabledList()
    // bundle.js:+11293103
```

Analysis basis: CC v2.1.132 bundle.js:+11292859

---

### Policy Lock Guard

After platform checks pass, the handler consults the policy layer to determine whether local sandbox configuration is permitted.

```
    if platformUtils.areSandboxSettingsLockedByPolicy():
        // bundle.js:+11293265
        return error(
            "Error: Sandbox settings are overridden by a higher-priority " +
            "configuration and cannot be changed locally."
        )
        // bundle.js:+11293324
```

This check occurs before any argument parsing, meaning enterprise-locked deployments cannot use any subcommand of `/sandbox`.

Analysis basis: CC v2.1.132 bundle.js:+11293265

---

### Argument Parsing and Subcommand Dispatch

The raw argument string is split to extract the subcommand token.

```
    parts = args.split(...)                   // M.split — bundle.js:+11293551
    subcommand = parts[0]                     // first token after /sandbox
    rest = parts.slice(1)                     // M.slice — bundle.js:+11293591

    if subcommand == "exclude":               // literal "exclude" — bundle.js:+11293574
        patternRaw = rest.join(" ").replace(...)
        // z.replace — bundle.js:+11293755
        if patternRaw is empty:
            return error(
                "Error: Please provide a command pattern to exclude " +
                "(e.g., /sandbox exclude \"npm run test:*\")"
            )
            // bundle.js:+11293636
        addExclusionRule(patternRaw)          // t_A — bundle.js:+11293784
    else:
        openInteractiveConfig()               // t_A used with no-arg path — bundle.js:+11293784
```

The minimum argument length check uses the constant `8` (length of `"exclude "` prefix):
Analysis basis: CC v2.1.132 bundle.js:+11293599

---

### Exclusion Rule Application

When a valid exclusion pattern is provided, the handler calls the rule-addition subsystem which filters and records the pattern, then resolves the relative path context for the local settings file.

```
function addExclusionRule(pattern):
    // t_A — bundle.js:+11293784
    filteredRules = filterInputRules(pattern)
    // A.filter — bundle.js:+3983334

    matchResult = matchPattern(pattern)
    // EbK using H.match — bundle.js:+3983508

    if pattern already included:
        // q.includes — bundle.js:+3983547
        return (no-op, rule already present)

    applyRules(filteredRules)
    // CA — bundle.js:+3983561

    emitTelemetry("sandbox_exclude_command")
    // SH — bundle.js:+3983640, literal bundle.js:+3983643

    resolveRelativePath()
    // $$q.relative — bundle.js:+11293821

    writeToLocalSettings(".claude/settings.local.json")
    // literal bundle.js:+11293842
```

Analysis basis: CC v2.1.132 bundle.js:+11293784

---

### Rule Writing to Local Settings

The exclusion is persisted to `.claude/settings.local.json` (not the project-level `settings.json`). The write path traverses the configuration layer at the `localSettings` tier.

```
function writeLocalSandboxConfig(rule, relativePath):
    // CA chain — bundle.js:+3983561
    settingsPath = resolve(".claude/settings.local.json")
    // literal bundle.js:+11293842

    existingConfig = readLocalSettings(settingsPath)

    updatedConfig = mergeRule(existingConfig, rule)
    writeAtomically(settingsPath, updatedConfig)
    // QyH atomic write path — bundle.js:+952233
```

The `addRules` literal (`bundle.js:+3983357`) confirms the operation name used in the settings merge.

Analysis basis: CC v2.1.132 bundle.js:+11293842

---

### WSL Version Detection

The WSL version check relies on a prefix-based string comparison against a platform identifier.

```
function detectWSLVersion(platformId):
    // q_ — bundle.js:+11293036
    if platformId.startsWith("wsl"):        // H.startsWith — bundle.js:+3547041
        applyColorMapping(platformId)       // g5H — bundle.js:+3547137
        // (color context resolution for terminal output)
        return platformId                   // Up — bundle.js:+3547161
```

The `"wsl"` prefix literal is at `bundle.js:+11292895`. The specific error for WSL1 (non-WSL2) uses the literal at `bundle.js:+11292901`.

Analysis basis: CC v2.1.132 bundle.js:+11293036

---

### Interactive Configuration Mode

When `/sandbox` is invoked with no arguments (or with arguments that do not match `"exclude"`), the handler opens an interactive configuration UI via a JSX rendering path. This is consistent with the `local-jsx` command type and the `immediate: true` flag (meaning the command renders inline without requiring Enter confirmation).

```
function openInteractiveSandboxConfig():
    // t_A / ng — bundle.js:+11293834
    renderJSXConfigPanel()
    // (no further depth-2 call data for this path)
```

<!-- TODO: not found in depth-2 traversal; needs --depth 4 -->

Analysis basis: CC v2.1.132 bundle.js:+11293834

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_ok` (bundle.js:+906461) — fired on successful rule write via `SH`; `tengu_config_parse_error` (bundle.js:+3107927) — fired on config parse failure in the settings layer; `tengu_config_auth_loss_prevented` (bundle.js:+3102735) — fired if a config write would erase stored auth tokens |
| Direct telemetry event | Literal `"sandbox_exclude_command"` (bundle.js:+3983643) — fired after a successful exclusion rule is applied |
| Config file written | `.claude/settings.local.json` — sandbox exclusion rules are stored at the `localSettings` config tier |
| Policy enforcement | `UA.areSandboxSettingsLockedByPolicy` blocks all writes when enterprise policy overrides are active (bundle.js:+11293265) |
| Color/theme context | `K_` (theme context) and `s6` (color support) are resolved at handler entry (bundle.js:+11292828, +11292850) |
| Error display | Error strings are rendered using the `"error"` display literal (bundle.js:+11293039) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.132 | Initial analysis |

---

## Common Mistakes

1. **Running `/sandbox exclude` without a quoted pattern** — The command requires a pattern argument after `exclude`. Omitting it produces the error referencing the expected usage format (bundle.js:+11293636). Use quotes for patterns containing spaces or wildcards, e.g. `/sandbox exclude "npm run test:*"`.

2. **Attempting to use `/sandbox` in an enterprise-locked environment** — When `UA.areSandboxSettingsLockedByPolicy()` returns true, the command exits with a policy error before any argument is parsed (bundle.js:+11293265). No subcommand, including `exclude`, will function.

3. **Running on WSL1** — The command explicitly detects WSL1 (via the `"wsl"` prefix check) and rejects it with a distinct error from the general unsupported-platform message (bundle.js:+11292901 vs. +11292959). Upgrading to WSL2 is required.

4. **Expecting exclusions to be written to `settings.json`** — Exclusion rules go to `.claude/settings.local.json` (the `localSettings` tier), not the shared project `settings.json`. This means they are local-only and not committed with the project.

5. **Assuming `/sandbox` without arguments opens a configuration dialog immediately** — The `immediate: true` flag means the interactive panel renders inline, but the command must receive focus input; it is not a fire-and-forget toggle.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `HD7` | Main async handler for `/sandbox` command (AsyncFunction, resolved via `module_id` path from module `z$q`) |
| `q_` | WSL version detection utility; uses `H.startsWith` to test platform ID prefix |
| `H` | Platform/environment context object; also used for random-delay utility (Math.random + setTimeout) |
| `g5H` | Color/terminal style mapping function; maps platform string prefixes to chalk-style color methods |
| `Up` | Terminal color context resolver called after WSL prefix detection |
| `M` | Argument string object on which `.split` and `.slice` are called for subcommand parsing |
| `UZH` | MCP server configuration loader (Object.entries, Promise.all orchestration) |
| `qt` | MCP config merge/resolution function |
| `VEH` | Enterprise-tier MCP settings loader |
| `_t` | SDK-tier MCP settings loader |
| `LO6` | SSE/HTTP MCP connection entry builder |
| `wI` | MCP transport wrapper initializer |
| `oM` | Low-level MCP transport object constructor |
| `nwA` | MCP transport helper |
| `L` | Output buffer / list accumulator (context-dependent) |
| `K` | Process/client registry map (context-dependent) |
| `f` | File/stream handle (context-dependent) |
| `qA` | Utility function `A` wrapper |
| `Qw6` | MCP server filter utility |
| `Nr4` | MCP needs-auth cache reader (reads `mcp-needs-auth-cache.json`) |
| `XZA` | File read utility for auth cache (`p9H.readFile`) |
| `a18` | MCP server hash/identity builder (SHA-256 via `oJ9.createHash`) |
| `jl` | MCP server descriptor builder |
| `o18` | MCP server identity key extractor |
| `WJ` | Config hash computation utility (`oJ9.createHash` SHA-256) |
| `K8` | MCP debug log emitter (`EQ.logMCPDebug`) |
| `tTA` | MCP server connection lifecycle manager (connect/OAuth/reconnect) |
| `Ci4` | MCP connection initializer |
| `Bp` | Auth token/credential bundle accessor (`Rb` + `FK`) |
| `ot` | MCP OAuth flow handler (creates HTTP callback server, manages token exchange) |
| `pcH` | In-flight auth request tracker (`Vf8` Map) |
| `Y` | Background spare session manager (spawns/disposes spare agents) |
| `hf8` | Auth cache file deleter (`p9H.unlink`) |
| `QF` | MCP reconnect orchestrator |
| `Rb` | Auth credential reader (`FK`) |
| `D` | MCP daemon config reload handler (`tengu_daemon_config_reload`) |
| `Z7` | MCP error log emitter (`EQ.logMCPError`) |
| `vH` | Value-to-string coercion utility (`String(...)`) |
| `bi4` | Pre-connection auth state checker |
| `Ri4` | SSH remote session detector (`$A.isSSH`) |
| `eTA` | MCP tool-result/complete-authentication handler |
| `mcH` | In-flight request map reader (`If8.get`) |
| `UcH` | Pending auth request map reader (`Vf8.get`) |
| `mc9` | Auth cache file writer (`p9H.writeFile`) |
| `Qf8` | Auth cache file path builder (`gf8.join` + `l8`) |
| `RH` | JSON serializer (`JSON.stringify`) |
| `aTA` | Token/credential storage writer (`WJ` + `EK` + `Nw6`) |
| `EK` | Config entry encoder (`f41`) |
| `Nw6` | Stored credential updater (reads/writes via `_.read` / `_.update`) |
| `gwA` | Subprocess/tool availability checker (`A8` + `_.includes`) |
| `A8` | Process spawner/executor |
| `_` | Generic array/string value (context-dependent) |
| `J` | Process registry values iterator; sends SIGTERM |
| `v` | Background worker/process handle with blur/focus/timeout lifecycle |
| `S` | Output stream pusher (`z.write`) |
| `z` | Terminal write stream with daemon control events |
| `d` | Deferred/promise resolver (context-dependent) |
| `Cc9` | Async iterator/channel utility (`zMH`) |
| `zMH` | Generic async iterable/channel implementation |
| `dw6` | Integer parser for MCP port (radix 10) |
| `PZA` | Integer parser for MCP port (radix 20) |
| `ZBq` | MCP update applier (`H.applyMcpUpdate`) |
| `df8` | MCP update serializer (`RH`) |
| `bI` | MCP client cleanup coordinator (`dcH` + `L.cleanup`) |
| `dcH` | MCP client disconnector (`RH`) |
| `k` | Settings key formatter (uppercases, trims, resolves path) |
| `Lsq` | Settings loader orchestrator (`_Z` + `qsq` + `rdA`) |
| `rdA` | Remote managed settings fetcher (`Nrq` + `krq`) |
| `mf` | Settings value redactor (`[REDACTED]` literal, `H.replace`) |
| `MnA` | Settings key mapper (`taq.map`) |
| `gNH` | Settings write utility (`slA`) |
| `slA` | Atomic settings file writer (`H.write`) |
| `Msq` | Full settings persistence manager (mkdir, appendFile, rotate, atomic write) |
| `GNH` | Debounced output batcher (clearTimeout/setTimeout/setImmediate) |
| `pHH` | Settings path builder (`DnA` + `cwH.join` + `l8`) |
| `F6` | File existence/stat check utility |
| `JG8` | File read helper (`j8`) |
| `jnA` | Config directory path builder (`cwH.join` + `v6`) |
| `JnA` | Atomic file rename helper (`YV.stat` / `YV.rename` / `YV.unlink`) |
| `fsq` | Settings file write pipeline (mkdir + appendFile + rotate + atomic rename) |
| `N1` | Write-lock manager (`J08.add` / `J08.delete` + `Object.assign`) |
| `$` | MCP session/daemon runner (`mzq`) |
| `mzq` | Daemon status file writer (`daemon.status.json` via `PX6`) |
| `Er` | Error formatter (`G7H`) |
| `lY` | Atomic file write utility (randomBytes temp name, writeFile, rename, copyFile, unlink) |
| `PX6` | Daemon status file path builder (`uzq.join` + `l8`) |
| `j6` | Tool/permission registry (checks `V5H`, `Kt8`, `kq6`, `mU` maps) |
| `hq6` | Permission registry initializer |
| `Rq6` | Permission event emitter |
| `Oo` | Tool descriptor builder (`yH` + `Mo`) |
| `yH` | String conversion utility (`String(...)`) |
| `Mo` | Tool metadata resolver (`Yx`) |
| `uQ6` | Tool registration deduplication (`Kt8.add`, `Lt8`) |
| `Lt8` | Tool registration handler (randomUUID, `RH`, `BXK`, `fo.emit`) |
| `Dt8` | Tool call dispatcher (`U41` + `uA` + `EJ1` + `jyH`) |
| `R6` | Config watcher (file watch via `DPK`) |
| `Et8` | Config value extractor |
| `k5H` | Config file reader (readFileSync, statSync, mkdirSync, readdirStringSync, copyFileSync) |
| `DPK` | File watcher registration (`lQ6.watchFile` / `lQ6.unwatchFile`) |
| `$F7` | MCP server restart/retry orchestrator (calls `UZH`, `ZBq`, `dcH`) |
| `t18` | MCP server capability checker (`KE4.has` + `fE4.has`) |
| `q` | Socket/file cleanup utility (`tgq.unlinkSync`) |
| `o8` | Timer/retry manager (setTimeout + clearTimeout + `K.unref`) |
| `O` | Output queue object (`Q8`) |
| `t_A` | Sandbox exclusion rule addition entry point (filters, matches, applies, writes) |
| `R8` | Settings cache accessor (`IdA` + `G7_` + `VdA`) |
| `IdA` | Settings cache read (`s06.has` + `s06.get`) |
| `G7_` | Settings object builder (`MjH` + `D66` + `EO` + `ni` + `W7_`) |
| `MjH` | Policy settings object factory |
| `D66` | Settings tier diff/merge (`vdA` + `H2L` + `NdA`) |
| `EO` | Project-level settings file locator (`MX.join` + `E6H` + `ePL` + `xb` + `sPL` + `ULH`) |
| `ni` | User settings loader (`kdA` + `BN` + `tPL` + `ydA`) |
| `W7_` | SDK inline settings loader (`KaH` + `BN` + `bb` + `g2` + `tKH`) |
| `VdA` | Settings cache write (`s06.set`) |
| `EbK` | Exclusion pattern matcher (`H.match`) |
| `CA` | Settings write orchestrator (resolves path, writes atomically, clears caches, emits event) |
| `wE` | Settings file reader for project config (`bp`) |
| `bp` | Raw settings file reader (readFileSync + slice + replaceAll, limit 4096 bytes) |
| `D8` | Directory creation utility (`j8`) |
| `j8` | Low-level mkdir utility |
| `Wh8` | Settings write timestamp recorder (`xN6.set` + `Date.now`) |
| `E6H` | Settings path resolver (`MX.resolve` + `l8` + `_A` + `ULH` + `MX.dirname`) |
| `_A` | Home-directory-relative path resolver |
| `ULH` | Symlink-safe path resolver |
| `QyH` | Atomic file writer with permissions preservation (lstatSync, openSync, writeFileSync, fchmodSync, fsyncSync, renameSync, unlinkSync) |
| `C2` | Settings cache clearer (`s06.clear` + `j28.clear`) |
| `NN6` | Config file append/write manager (mkdir, readFile, appendFile, writeFile; handles `.config/ignore`) |
| `N6` | Settings directory resolver (`Qv6` + `_A`) |
| `_h8` | Settings key mapper (`MK`) |
| `fh8` | Settings section accessor (`PA`) |
| `fXL` | User config path builder (`vN6.join` + `PK_.homedir` + `.config` literal) |
| `fH` | Error logger (`HA` + `yH` + `kq` + `$wL` + `kyH.push` + `EQ.logError`) |
| `xb` | `.claude` settings path builder (`MX.join`) |
| `ub` | Settings load-and-cache entry point (`Kp` + `_2L` + `$q` + `ZdA`) |
| `Kp` | Settings load precondition checker |
| `_2L` | Full settings load pipeline (reads all tiers: enterprise, user, project, local, flag, SDK inline) |
| `$q` | Memory usage sampler (`process.memoryUsage` + `ynA.push` + `Jb`) |
| `ZdA` | Post-load settings cache finalizer |
| `SH` | Telemetry event emitter for feature/exclude events (`tengu_feature_ok`, `sandbox_exclude_command`) |
| `ng` | Interactive sandbox configuration UI renderer (JSX, invoked when no subcommand is given) |