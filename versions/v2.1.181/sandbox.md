---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.181"
updated: "2026-06-19"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.181 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.181 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.181

---

## Overview

The `/sandbox` command configures the execution sandbox environment for Claude Code, controlling which shell commands are permitted or excluded from sandboxed execution. It validates platform compatibility (macOS, Linux, WSL2 only), checks for policy-level locks that may prevent local changes, and writes updated exclusion rules to `.claude/settings.local.json`. The command accepts an optional `exclude "command pattern"` subcommand to add exclusion rules for specific command patterns.

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
| module_id | `gvl` |
| load_inline | `true` |
| loc_byte | `12864121` |
| loc_byte_end | `12864770` |
| loc_line | `8491` |
| arbor_handler.name | `dif` |
| arbor_handler.fqn | `claude-2.1.181::dif` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.181 bundle.js:+12864121

---

## Input Branching

The handler `dif` has 5+ distinct paths depending on platform support, policy lock status, and the presence of the `exclude` subcommand argument. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/sandbox invoked"] --> B{Platform supported?\nzo.isSupportedPlatform}
    B -- "platform = 'light'" --> C{WSL variant?}
    C -- "wsl1" --> ERR1["Error: Sandboxing requires WSL2.\nWSL1 is not supported."]
    C -- "other unsupported" --> ERR2["Error: Sandboxing is currently only\nsupported on macOS, Linux, and WSL2."]
    B -- "not in enabled list\nzo.isPlatformInEnabledList = false" --> ERR2
    B -- "supported" --> D{Dependencies OK?\nzo.checkDependencies}
    D -- "missing deps" --> ERR3["Return error result\n(dependency check failed)"]
    D -- "deps OK" --> E{Sandbox settings locked\nby policy?\nzo.areSandboxSettingsLockedByPolicy}
    E -- "locked" --> ERR4["Error: Sandbox settings are overridden\nby a higher-priority configuration\nand cannot be changed locally."]
    E -- "not locked" --> F{Argument provided?}
    F -- "no argument" --> G["Open interactive\nconfiguration UI\n(JSX component rendered)"]
    F -- "arg starts with 'exclude'" --> H{Pattern argument present?}
    H -- "no pattern\n(arg length <= 8)" --> ERR5["Error: Please provide a command\npattern to exclude (e.g.,\n/sandbox exclude \"npm run test:*\")"]
    H -- "pattern present" --> I["Parse pattern string\n(strip 'exclude ' prefix via a.slice)"]
    I --> J["Apply path normalization\n(Avl.relative, mV)"]
    J --> K["Write exclude rule to\n.claude/settings.local.json\n(via ZA / settings persistence layer)"]
    K --> L["Emit telemetry:\nsandbox_exclude_command"]
    L --> M["Return success result"]
```

Analysis basis: CC v2.1.181 bundle.js:+12862740 – +12863754

---

## Behavioral Spec

### 1. Platform and Dependency Gating

```
async function sandboxCommandHandler(args, context):
    colorMode = getColorMode()          // es() — detects 'light' vs other
    terminal  = getTerminalInfo()       // Yt()

    if not platformSupportChecker.isSupportedPlatform():
        wslVariant = detectWSLVariant()
        if wslVariant == "wsl":
            return errorResult("Error: Sandboxing requires WSL2. WSL1 is not supported.")
        else:
            return errorResult("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")

    if not platformSupportChecker.isPlatformInEnabledList():
        return errorResult("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")

    depResult = await platformSupportChecker.checkDependencies()
    if depResult.kind == "error":
        return depResult

    if platformSupportChecker.areSandboxSettingsLockedByPolicy():
        return errorResult("Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally.")
    
    // proceed to argument parsing
```

Analysis basis: CC v2.1.181 bundle.js:+12862740, +12862762, +12862771, +12862807, +12862813, +12862871, +12862948, +12862988, +12863015, +12863177

### 2. Argument Parsing — Exclude Subcommand

```
function parseExcludeArgument(rawArgs):
    // rawArgs is the user-provided string after "/sandbox"
    argString = rawArgs.split(...)[...].join(...)   // normalize whitespace

    if argString starts with "exclude":
        pattern = argString.slice(8)    // drop "exclude " prefix (length = 8)
        pattern = pattern.trimQuotes()  // strip surrounding quotes if present

        if pattern.length == 0:
            return errorResult(
                "Error: Please provide a command pattern to exclude " +
                "(e.g., /sandbox exclude \"npm run test:*\")"
            )
        return { kind: "exclude", pattern: pattern }
    else:
        return { kind: "interactive" }
```

Analysis basis: CC v2.1.181 bundle.js:+12863463, +12863486, +12863503, +12863511, +12863548

### 3. Exclude Rule Persistence

When a valid `exclude` pattern is parsed, the handler:

1. Computes the path relative to the project root using a path utility (`Avl.relative`).
2. Calls the settings persistence function (`ZA`) to load existing local settings from `.claude/settings.local.json`.
3. Appends the new exclude rule to the `addRules` list within `localSettings`.
4. Writes the updated settings back to `.claude/settings.local.json`.
5. Emits the `sandbox_exclude_command` telemetry event.

```
async function applyExcludeRule(pattern, projectRoot):
    relativePath = pathUtils.relative(projectRoot, pattern)
    normalizedPattern = applyPatternNormalization(relativePath)   // mV()

    settings = await loadLocalSettings()    // ZA() reads .claude/settings.local.json
    settings.localSettings.addRules.push(normalizedPattern)

    await writeLocalSettings(settings)      // persists to .claude/settings.local.json

    emitTelemetry("sandbox_exclude_command")
    return successResult()
```

Analysis basis: CC v2.1.181 bundle.js:+12863696, +12863709, +12863733, +12863746, +12863754, +4743486

### 4. Interactive Configuration Mode

When invoked without arguments (or with unrecognized arguments), the handler renders a JSX configuration component (type `local-jsx`) that presents the sandbox settings UI inline in the terminal. The `immediate: true` registration flag means this render is triggered without requiring the user to press Enter a second time.

Analysis basis: CC v2.1.181 bundle.js:+12864121 (registration block)

### 5. Settings Layer Interaction

The handler reads and writes through a multi-layer settings system (`s5r` / `Tn` call chain), respecting the following priority order (highest to lowest):

- `policySettings` — read-only; enforced by `areSandboxSettingsLockedByPolicy`
- `flagSettings` — managed by feature flags
- `userSettings` — user-global config
- `projectSettings` — project-level `.claude/settings.json`
- `localSettings` — local override `.claude/settings.local.json` (written by this command)

Analysis basis: CC v2.1.181 bundle.js:+4743106, +4743109, +1314092, +1314171, +1309804, +1309855

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_ok` (bundle.js:+1019804), `tengu_feature_bad` (bundle.js:+1019871), `tengu_feature_sad` (bundle.js:+1019952); `sandbox_exclude_command` string event (bundle.js:+4743486) |
| Settings write | Appends exclusion rules to `.claude/settings.local.json` when `exclude` subcommand is used (bundle.js:+12863754) |
| Platform check | Reads WSL variant and platform support lists via `zo.*` methods; no persistent side effect |
| Policy lock check | Read-only check against higher-priority policy configuration; no write |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | None observed in traversal |

---

## Error Messages

| Condition | Message |
|---|---|
| WSL1 detected | `"Error: Sandboxing requires WSL2. WSL1 is not supported."` (bundle.js:+12862813) |
| Unsupported platform | `"Error: Sandboxing is currently only supported on macOS, Linux, and WSL2."` (bundle.js:+12862871) |
| Policy lock active | `"Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally."` (bundle.js:+12863236) |
| Missing exclude pattern | `"Error: Please provide a command pattern to exclude (e.g., /sandbox exclude \"npm run test:*\")"` (bundle.js:+12863548) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.181 | Initial analysis |

---

## Common Mistakes

1. **Running on Windows (non-WSL)**: The command will return a platform error immediately. Sandboxing requires macOS, Linux, or WSL2 — native Windows is not supported.
2. **Omitting the pattern after `exclude`**: Writing `/sandbox exclude` with no pattern argument triggers a usage-hint error. The pattern must be a non-empty quoted string, e.g. `/sandbox exclude "npm run test:*"`.
3. **Expecting local changes when policy is locked**: If an enterprise or project-level policy has locked sandbox settings (`areSandboxSettingsLockedByPolicy` returns true), no local override can be written. The command will exit with an error regardless of arguments.
4. **Editing `.claude/settings.local.json` directly while unaware of layer priority**: Manual edits at the local layer are overridden silently by higher-priority policy or user settings; use `/sandbox` to confirm effective settings.
5. **Assuming immediate rendering without pressing Enter**: The `immediate: true` flag means the interactive configuration UI is displayed as soon as `/sandbox` is typed — no additional confirmation keystroke is needed.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `dif` | Main handler for `/sandbox` command (AsyncFunction) |
| `$o` | Terminal color/style renderer (foreground/background color dispatch) |
| `IIe` | ANSI color string builder (maps color names to chalk-style calls) |
| `fz` | Fallback/default color renderer |
| `DBe` | MCP server connection orchestrator |
| `z8` | MCP server slot configuration processor |
| `Hrt` | MCP server capability initializer |
| `x7` | MCP server plugin/module loader |
| `h5` | MCP SDK server entry collector |
| `Zwn` | Warning/error color formatter for MCP status |
| `Art` | MCP server authorization state manager |
| `Pk` | Settings schema validator/resolver |
| `M_` | Settings field accessor |
| `LVr` | Settings layer resolver (lower-priority) |
| `qn` | Terminal output helper |
| `UOt` | MCP connection filter utility |
| `Jta` | MCP connection state snapshot builder |
| `Mzr` | MCP state reader |
| `wwe` | MCP config hash/fingerprint calculator |
| `KAn` | Token/config key encoder |
| `zAn` | Token/config value encoder |
| `AI` | Hash utility (SHA-based) |
| `qAn` | Auth query helper |
| `uc` | Auth credential store reader |
| `sn` | MCP debug logger |
| `yLn` | MCP server lifecycle manager (connect/reconnect) |
| `t$d` | MCP transport factory |
| `R9` | Logger/reporter for MCP session |
| `Aae` | Claude.ai connector link message builder |
| `hae` | MCP connection heartbeat handler |
| `Iae` | MCP OAuth flow executor (HTTP callback server) |
| `Trt` | Pending-connection tracker |
| `SLn` | MCP state broadcaster |
| `R7` | MCP reconnect orchestrator |
| `M9` | Settings path resolver |
| `d` | MCP supervisor process manager |
| `Du` | MCP error logger |
| `Ee` | String coercer utility |
| `n$d` | MCP null/no-op result builder |
| `e$d` | SSH/remote session detector for MCP OAuth |
| `ELn` | MCP authentication completion handler |
| `brt` | Active connection port reader |
| `Irt` | Pending connection state reader |
| `ana` | MCP connection attempt runner |
| `oi` | Async local store reader |
| `wxn` | MCP needs-auth cache path builder |
| `Re` | JSON serializer wrapper |
| `WVr` | MCP connection result writer |
| `gP` | MCP skills/tools telemetry emitter |
| `ut` | Tool capability registrar |
| `wVr` | MCP error/warning renderer |
| `un` | Global config writer (with auth-loss guard) |
| `w` | Background session blur/focus state manager |
| `Az` | Background session state reader |
| `L` | Background worker sweep/lifecycle manager |
| `v` | Background session active state |
| `uQl` | Background session queue reader |
| `nna` | Integer validation utility |
| `y8` | Async iterator / race utility |
| `Qrt` | MCP port parser (parseInt-based, base 10) |
| `Lxn` | MCP secondary port parser (parseInt-based, base 20) |
| `bQn` | MCP connection result applier |
| `kBe` | MCP config change detector |
| `kL` | MCP connection cleanup runner |
| `Xrt` | MCP server config fingerprinter |
| `I` | Command/tool output formatter |
| `xhc` | Tool output renderer |
| `L$o` | Markdown/ANSI output selector |
| `qc` | Path redaction utility |
| `c3o` | Sensitive path pattern list builder |
| `nqe` | Terminal write helper |
| `QBo` | Raw terminal writer |
| `Rhc` | Conversation transcript writer |
| `kWe` | Batched write flusher (with timeout) |
| `Fde` | Transcript file path builder |
| `jt` | File existence checker |
| `bre` | Safe directory creator |
| `f3o` | Transcript directory path builder |
| `Sor` | Atomic file rename helper |
| `Mhc` | Transcript append-and-rotate writer |
| `Gi` | Exit-hook registrar |
| `l` | MCP daemon lifecycle coordinator |
| `cxl` | Daemon status file writer |
| `hQ` | Config directory path resolver |
| `sjt` | Daemon status file path builder |
| `kOo` | MCP server collection refresh orchestrator |
| `sLn` | MCP server suppression/filter checker |
| `Fn` | Timed async operation wrapper |
| `c` | Background task cleanup helper |
| `u` | Background session controller |
| `xe` | Feature flag checker (feature_ok path) |
| `j` | Feature flag emitter (ok) |
| `$e` | Feature flag emitter (bad) |
| `Rht` | Feature flag event base |
| `Me` | Feature flag checker (feature_bad path) |
| `zU` | Subagent/subprocess launcher |
| `d4` | Subprocess configuration builder |
| `Q2` | Subprocess environment resolver |
| `zUe` | Subprocess module loader |
| `xR` | Subprocess tool capability binder |
| `q1r` | Subagent session initializer |
| `Ggn` | Subagent prompt assembler |
| `$j` | Subagent credential injector |
| `cG` | Graceful shutdown coordinator |
| `dme` | SDK shutdown caller |
| `_me` | Shutdown timeout handler |
| `y0o` | Datadog telemetry poster |
| `s5r` | Settings rule filter and applier for sandbox |
| `Tn` | Settings loader (top-level) |
| `qtn` | Settings cache reader |
| `BFo` | Settings cache has/get |
| `OAr` | Settings object merger |
| `GFo` | Settings cache setter |
| `x2` | Settings schema field registry |
| `gr` | Settings field getter |
| `Igt` | Settings field type: integer |
| `qtr` | Settings field type: string |
| `Sgt` | Settings field type: boolean |
| `PRe` | Settings field default resolver |
| `ORe` | Settings field validator |
| `vgt` | Settings field enum checker |
| `moe` | Settings field array handler |
| `ASe` | Settings field merge strategy |
| `Qtn` | Settings field serializer |
| `Zts` | Settings field deserializer |
| `JJ` | Settings field metadata |
| `sbt` | Settings field registration helper |
| `L_d` | Pattern matcher for sandbox rules |
| `ao` | Settings write orchestrator (local settings) |
| `ZA` | Settings loader for `localSettings` layer |
| `fSe` | Settings file path builder |
| `Sv` | Settings file reader |
| `qJ` | Settings file parser |
| `Dn` | Directory creation helper |
| `ln` | Sync file writer |
| `qmr` | Settings write timestamp recorder |
| `jOe` | Project settings path resolver |
| `jtn` | Settings path resolver (project-scoped) |
| `lSt` | Atomic file write with permission preservation |
| `Jp` | Real path resolver |
| `cKe` | chmod error suppressor |
| `fH` | Settings cache invalidator |
| `NZo` | Gitignore-aware file writer |
| `Mt` | Gitignore config reader |
| `vmr` | Gitignore rule parser |
| `Qen` | Git check-ignore runner |
| `T7c` | Git global excludesfile resolver |
| `PZo` | Git ls-files tracker |
| `OZo` | Gitignore append helper |
| `O9` | `.claude` directory path builder |
| `Ut` | Feature flag checker (feature_sad path) |
| `tj` | Settings load orchestrator (full stack) |
| `px` | Settings telemetry emitter (start) |
| `ha` | Memory usage sampler during settings load |
| `NAr` | Settings load telemetry recorder |
| `DKt` | Settings load telemetry finalizer |
| `ke` | Error logger for settings operations |
| `Ho` | Error string formatter |
| `rt` | String coercer for errors |
| `ta` | Essential-traffic guard |
| `fVc` | Error log ring-buffer manager |
| `mV` | Sandbox pattern normalizer |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.