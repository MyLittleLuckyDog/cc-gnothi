---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.187"
updated: "2026-06-24"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.187 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.187 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.187

---

## Overview

The `/sandbox` command configures the Claude Code sandboxing subsystem for the current project. It validates platform support, checks for policy locks, and either presents a configuration UI or processes an `exclude` sub-command to add a command pattern to the sandbox exclusion list stored in `.claude/settings.local.json`. The command surfaces clear error messages when the platform is unsupported, when WSL1 is detected instead of WSL2, or when sandbox settings are locked by a higher-priority enterprise policy.

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
| module_id | `QPl` |
| load_inline | `true` |
| loc_byte | `12650673` |
| loc_byte_end | `12651368` |
| loc_line | `8670` |
| arbor_handler.name | `KHf` |
| arbor_handler.fqn | `claude-2.1.187::KHf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.187 bundle.js:+12650673

---

## Input Branching

The handler has five distinct branches depending on platform state and sub-command input. A Mermaid flowchart is required.

```mermaid
flowchart TD
    A["/sandbox invoked"] --> B{isSupportedPlatform?}
    B -- "No — Linux/macOS/WSL2 not detected" --> C{"WSL detected?"}
    C -- "Yes, but WSL1" --> D["Return error:\nWSL2 required;\nWSL1 not supported\nbundle.js:+12649383"]
    C -- "No WSL at all" --> E["Return error:\nOnly macOS, Linux,\nWSL2 supported\nbundle.js:+12649441"]
    B -- "Yes" --> F{checkDependencies}
    F -- "dependency error" --> G["Return error state\nbundle.js:+12649542"]
    F -- "OK" --> H{isPlatformInEnabledList?}
    H -- "No" --> I["Render config UI via JSX\nbundle.js:+12649964"]
    H -- "Yes" --> J{areSandboxSettingsLockedByPolicy?}
    J -- "Yes" --> K["Return error:\nSettings overridden by\nhigher-priority policy\nbundle.js:+12649806"]
    J -- "No" --> L{"Input starts with 'exclude'?\nbundle.js:+12650038"}
    L -- "No argument / no 'exclude'" --> M["Render config UI via JSX\nbundle.js:+12649964"]
    L -- "Yes: 'exclude \"pattern\"'" --> N{"Pattern argument present?\nbundle.js:+12650063"}
    N -- "No pattern after 'exclude'" --> O["Return error:\nPlease provide a command pattern\nbundle.js:+12650100"]
    N -- "Yes" --> P["Split, strip leading 8 chars,\nresolve pattern,\ncall sandbox exclude rule writer\nbundle.js:+12650055"]
    P --> Q["Write rule to\n.claude/settings.local.json\nbundle.js:+12650306"]
    Q --> R["Emit telemetry:\nsandbox_exclude_command\nbundle.js:+4766435"]
    R --> S["Return completion\nvia JSX render"]
```

---

## Behavioral Spec

### 1. Handler Entry — Platform Guard

The main async handler (`KHf`) begins with two sequential platform checks before any user-visible action is taken.

```
async function sandboxCommandHandler(input, context):
    theme = getColorTheme(context)          // Bo — bundle.js:+12649310
    colorRenderer = getColorRenderer(theme) // jt — bundle.js:+12649332

    if NOT sandboxPlatform.isSupportedPlatform():   // Ro.isSupportedPlatform — bundle.js:+12649341
        platformLabel = detectPlatformLabel()        // vo — bundle.js:+12649518
        if platformLabel.startsWith("wsl"):          // literal "wsl" — bundle.js:+12649377
            return errorResult(
                "Error: Sandboxing requires WSL2. WSL1 is not supported."
            )                                        // bundle.js:+12649383
        else:
            return errorResult(
                "Error: Sandboxing is currently only supported on macOS, Linux, and WSL2."
            )                                        // bundle.js:+12649441

    dependencyError = await sandboxPlatform.checkDependencies()  // Ro.checkDependencies — bundle.js:+12649558
    if dependencyError.type == "error":              // literal "error" — bundle.js:+12649521
        return errorState(dependencyError)           // e — bundle.js:+12649542
```

Analysis basis: CC v2.1.187 bundle.js:+12649310

### 2. Platform Enabled and Policy Lock Checks

After platform and dependency validation, the handler checks whether the current platform appears in the user-enabled list, then whether policy prevents local overrides.

```
    if NOT sandboxPlatform.isPlatformInEnabledList():  // Ro.isPlatformInEnabledList — bundle.js:+12649585
        return renderConfigUI(context)                  // ZPl.jsx — bundle.js:+12649964

    if sandboxPlatform.areSandboxSettingsLockedByPolicy(): // Ro.areSandboxSettingsLockedByPolicy — bundle.js:+12649747
        return errorResult(
            "Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally."
        )                                               // bundle.js:+12649806
```

Analysis basis: CC v2.1.187 bundle.js:+12649585

### 3. Sub-command Dispatch — `exclude` vs. Config UI

Once the platform is verified and unlocked, the handler inspects the raw input argument to detect the `exclude` sub-command.

```
    rawArg = input.split(" ")[0]                     // a.split — bundle.js:+12650015

    if rawArg != "exclude":                          // literal "exclude" — bundle.js:+12650038
        return renderConfigUI(context)               // ZPl.jsx — bundle.js:+12649964

    // Strip the leading 8 characters ("exclude ") from the full argument string
    patternArg = input.slice(8)                      // a.slice, literal 8 — bundle.js:+12650055, bundle.js:+12650063

    if patternArg is empty or blank:
        return errorResult(
            "Error: Please provide a command pattern to exclude (e.g., /sandbox exclude \"npm run test:*\")"
        )                                            // bundle.js:+12650100
```

Analysis basis: CC v2.1.187 bundle.js:+12650038

### 4. Exclude Rule Writing

When a non-empty pattern is provided, the handler resolves the pattern string, normalises it through a regex replace, delegates rule persistence to the settings layer, and records the action in the settings file at `.claude/settings.local.json`.

```
    normalisedPattern = patternArg.replace(...)      // u.replace — bundle.js:+12650219
    relativePath = path.relative(...)                // JPl.relative — bundle.js:+12650285
    ruleSet = loadLocalSettings()                    // Jm — bundle.js:+12650261
    writeExcludeRule(ruleSet, normalisedPattern)     // Rqr, sub-call to settings writer
    persistToFile(".claude/settings.local.json",     // literal — bundle.js:+12650306
                  ruleSet)
    emitTelemetry("sandbox_exclude_command")         // QV — bundle.js:+12650298 / literal — bundle.js:+4766435
    return renderConfigUI(context)
```

Analysis basis: CC v2.1.187 bundle.js:+12650219

### 5. Exclude Rule Persistence Sub-routine (`Rqr`)

The rule-writing helper validates the pattern, merges it into the existing `addRules` array within local settings, and handles the settings file lifecycle.

```
function writeExcludeRuleToSettings(settingsObject, pattern):
    existingRules = settingsObject.localSettings         // literal "localSettings" — bundle.js:+4766058
        .filter(r => r.type == "addRules")               // literal "addRules" — bundle.js:+4766149
    patternMatches = matchExistingPattern(pattern)       // ERd — bundle.js:+4766300
    if pattern already included in rules:                // r.includes — bundle.js:+4766339
        return (no-op)
    buildRuleEntry(settingsObject)                       // ao — bundle.js:+4766353
    writeSettingsLayer("localSettings", ruleEntry)       // Tn/l2 settings stack
    emitTelemetry("sandbox_exclude_command")             // literal — bundle.js:+4766435
    persistViaLeLayer(settingsObject)                    // Le — bundle.js:+4766432
```

Analysis basis: CC v2.1.187 bundle.js:+4766055

### 6. Platform Detection Helper (`vo` / `ICe`)

The platform-detection helper checks the raw platform label string and also resolves ANSI terminal colour support for rendering error output.

```
function detectPlatformLabel():
    raw = getPlatformString()
    if raw.startsWith("foreground"):    // literal "foreground" — bundle.js:+3930817
        return colouriseLabel(raw)      // ICe — bundle.js:+3930957
    if raw.startsWith("rgb("):          // literal — bundle.js:+3930874
        ...
    if raw.startsWith("ansi256("):      // literal — bundle.js:+3930915
        ...
    if raw.startsWith("ansi:"):         // literal — bundle.js:+3930941
        ...
    // ICe maps colour names to chalk-style methods:
    // "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
    // and bright/bg variants, plus hex, ansi256, rgb — bundle.js:+3591051–3592505
    return colourHandler(raw)
```

Analysis basis: CC v2.1.187 bundle.js:+12649518

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_ok` (bundle.js:+1025122); `tengu_feature_bad` (bundle.js:+1025189); `tengu_feature_sad` (bundle.js:+1025270); `tengu_daemon_control` (bundle.js:+17233792); `tengu_mcp_skills` (bundle.js:+6652661); `tengu_config_auth_loss_prevented` (bundle.js:+13747209); `tengu_daemon_config_reload` (bundle.js:+17212183); `tengu_daemon_yield` (bundle.js:+17216595); `tengu_bg_retire_pinned_low_mem` (bundle.js:+17200753); `tengu_bg_prewarm_per_sweep` (bundle.js:+17200874). The command-specific action emits the literal `sandbox_exclude_command` event (bundle.js:+4766435). |
| File write | On successful `exclude` sub-command: writes/updates `.claude/settings.local.json` (bundle.js:+12650306). |
| Settings layers read | Reads `localSettings`, `userSettings`, `projectSettings`, and `policySettings` layers via the settings stack (`Tn`/`l2`). |
| Config UI render | Renders a JSX component (`ZPl.jsx`) for interactive configuration when no `exclude` argument is supplied or when the platform is not yet in the enabled list (bundle.js:+12649964). |
| appState changes | No direct `appState` mutation found at depth ≤ 2; changes flow through the settings-persistence layer. |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.187 | Initial analysis |

---

## Common Mistakes

1. **Running `/sandbox` on an unsupported platform**: The command will immediately return an error on Windows (non-WSL), WSL1, or other non-POSIX environments. Only macOS, Linux, and WSL2 are supported (bundle.js:+12649383, bundle.js:+12649441).
2. **Omitting the pattern after `exclude`**: `/sandbox exclude` with no following quoted pattern produces an explicit error asking for a pattern like `"npm run test:*"` (bundle.js:+12650100). The argument parser strips the first 8 characters (`exclude `) and checks the remainder is non-empty (bundle.js:+12650063).
3. **Expecting local configuration to persist when policy locks are active**: If an enterprise policy applies `areSandboxSettingsLockedByPolicy`, the command will return an error and refuse to write to `.claude/settings.local.json` (bundle.js:+12649806).
4. **Providing a duplicate exclude pattern**: The rule writer checks whether the pattern is already present and silently no-ops if so (bundle.js:+4766339).
5. **Confusing the settings file location**: Exclude rules are written to `.claude/settings.local.json` (project-local), not to global user settings (bundle.js:+12650306).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `KHf` | Main async handler for `/sandbox` (arbor_handler; AsyncFunction) |
| `vo` | Platform label detection / colour-prefix resolver |
| `ICe` | ANSI colour name → chalk-style method mapper |
| `ij` | Auxiliary helper called from platform detector |
| `a` | MCP/settings manager composite object (holds `a9e`, `brr`, `hla`, etc.) |
| `a9e` | MCP server connection manager (enumerates/starts/stops MCP servers) |
| `RB` | MCP registry builder / server slot resolver |
| `Pst` | MCP slot persistence helper |
| `y7` | MCP server state resolver (approval, pending, rejected states) |
| `K4` | MCP dependency/SDK kind classifier |
| `CRn` | MCP configuration error renderer (red/yellow colour output) |
| `xst` | MCP server-slot SSE/HTTP transport configurator |
| `iF` | Object prototype factory used in MCP slot creation |
| `Qw` | MCP capabilities / feature-flag gate |
| `eh` | Event emitter helper (tde/Dt/Sa) |
| `eJr` | Secondary MCP event relay |
| `zn` | Generic translator/normaliser called from MCP manager |
| `FUt` | MCP server filter predicate |
| `mua` | MCP server connection lifecycle manager |
| `cZr` | Auth-cache path resolver (`mcp-needs-auth-cache.json`) |
| `RLe` | Settings hash/digest builder (sha256 of config) |
| `fyn` | Settings key serialiser |
| `myn` | Settings key hasher |
| `vT` | Settings value serialiser (JSON + hash) |
| `pyn` | Settings path resolver |
| `Gl` | Generic path join wrapper |
| `ln` | MCP debug log emitter |
| `zRn` | MCP OAuth connection coordinator |
| `wr` | OAuth worker spawner |
| `JVd` | OAuth flow driver (authenticate tool, auth_url, complete_authentication) |
| `QVd` | OAuth callback URL handler (callback_url, code extraction) |
| `BUt` | MCP connection initiator |
| `Xs` | Async-local-storage store getter |
| `tMn` | Auth-needs cache path builder |
| `Me` | JSON.stringify wrapper |
| `mJr` | MCP reconnect/retry helper |
| `be` | String coercion utility |
| `eL` | Tool event dispatcher |
| `it` | Tool registration / deduplication tracker |
| `ZXr` | Tool capability inclusion checker |
| `hn` | Global config save (with auth-loss guard) |
| `w` | Background worker pool push helper |
| `aj` | Worker pool entry constructor |
| `L` | Background worker sweep / lifecycle manager |
| `fcc` | Worker pool `at`-index accessor |
| `mcc` | Worker pool index resolver |
| `Vc` | MCP error logger |
| `yua` | Async iterator / event-stream helper (ZW) |
| `ZW` | Core async-iterator implementation |
| `git` | radix-10 integer parser (parseInt base 10) |
| `nMn` | radix-20 integer parser (parseInt base 20) |
| `brr` | MCP update applier / orphan disposer |
| `i9e` | MCP connection result validator |
| `KT` | MCP slot cleanup coordinator |
| `mit` | Individual MCP slot terminator |
| `hla` | MCP server heartbeat/tQr scheduler |
| `tQr` | Heartbeat timer implementation |
| `s` | Connection-slot active-set manager |
| `i` | Connection close/cleanup pair |
| `T` | Terminal/TTY configuration builder |
| `Xwc` | Terminal column/row detector |
| `I6o` | Terminal capability probers (tCc/nCc) |
| `wc` | Terminal path normaliser / redaction helper |
| `c8o` | Terminal map builder |
| `dze` | Terminal write flusher (JWo) |
| `JWo` | Raw terminal write wrapper |
| `eLc` | Log file writer / rotation manager |
| `FKe` | Batched log flush implementation |
| `dpe` | Log directory/path builder |
| `Mre` | Log directory creator |
| `p8o` | Log file path builder |
| `Ocr` | Log file rotation (rename/unlink) |
| `Zwc` | Log append-and-rotate worker |
| `Ei` | Signal/exit hook registrar |
| `l` | Daemon status file accessor |
| `JNl` | Daemon status JSON writer (daemon.status.json) |
| `SQ` | Daemon state serialiser |
| `tVt` | Daemon status path builder |
| `uBo` | MCP remote-server retry / re-adoption manager |
| `xRn` | MCP EVd/aJr server-set membership checker |
| `Kn` | Timeout-with-abort helper |
| `u` | Daemon session manager (Le/Re/CU/X6) |
| `Le` | Daemon start wrapper |
| `W` | Low-level IPC/socket send |
| `Pe` | Daemon process spawner |
| `rKe` | Process spawn options builder |
| `Re` | Daemon restart wrapper |
| `CU` | Daemon config updater |
| `q9` | Config diff calculator |
| `M2` | Config field merger |
| `u$e` | Config change applicator |
| `xw` | Tool-set delta applier |
| `aBr` | Daemon instance launcher |
| `lSn` | Full daemon bootstrap sequence |
| `yW` | Daemon random-token generator |
| `X6` | Daemon shutdown sequence (Promise.race + process.exit) |
| `Ome` | Graceful shutdown trigger |
| `Vme` | Timed shutdown fallback |
| `GOo` | Datadog metric poster |
| `Rqr` | Sandbox exclude-rule writer (settings layer) |
| `Tn` | Settings stack loader |
| `hsn` | Settings cache (YYt) accessor |
| `U5o` | Settings cache get/has |
| `QEr` | Settings parser (policySettings/flagSettings) |
| `F5o` | Settings cache set |
| `l2` | Settings layer aggregator |
| `gr` | Settings file reader (VL) |
| `IEt` | Settings field validator |
| `rar` | Settings merge helper |
| `AEt` | Settings array merger |
| `VPe` | Settings value coercer |
| `KPe` | Settings key normaliser |
| `vEt` | Settings field filter |
| `Toe` | Settings override resolver |
| `ube` | Settings fallback handler |
| `Asn` | Settings sanitiser |
| `Zls` | Settings list expander |
| `nQ` | Settings namespace extractor |
| `rCt` | Settings writer (jt/tCt/UC) |
| `ERd` | Exclude-pattern regex matcher |
| `ao` | Local-settings rule builder and file writer |
| `Jm` | Local settings loader |
| `lbe` | User settings path resolver |
| `DC` | Project settings file reader (XJ) |
| `XJ` | Synchronous settings file reader |
| `kn` | Error-safe file operation wrapper |
| `cn` | File-system error classifier |
| `lEr` | Settings mutation timestamp tracker |
| `Q1e` | Settings path + layer pair builder |
| `fsn` | Settings file-path resolver |
| `oIt` | Atomic file write (temp + rename) |
| `Nd` | Real-path resolver |
| `E7e` | Extended attribute / chmod error handler |
| `bH` | Settings cache invalidator (YYt.clear / xsr.clear) |
| `Fis` | Gitignore / excludes-file manager |
| `Pt` | Gitignore path builder |
| `qyr` | Gitignore pattern runner |
| `Eon` | Gitignore writer |
| `lau` | Gitignore path expander (homedir, isAbsolute) |
| `Nis` | Gitignore line formatter |
| `Uis` | Gitignore append helper |
| `g9` | `.claude` directory path builder |
| `Mt` | Generic settings persist wrapper |
| `PG` | Settings load-from-disk orchestrator (qL/ta/ZEr/l2/XYt) |
| `qL` | Settings pre-load hook |
| `ta` | Memory-usage sampler during settings load |
| `ZEr` | Settings disk-load implementation |
| `XYt` | Post-load settings validator |
| `ke` | Tool permission / essential-traffic checker |
| `fo` | Error coercion to string |
| `nt` | String-to-boolean normaliser ("yes"/"on") |
| `Vi` | Permission group resolver (jns) |
| `Qru` | Permission history ring-buffer |
| `QV` | Telemetry emitter for sandbox_exclude_command |