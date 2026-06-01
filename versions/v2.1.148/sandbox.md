---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.148"
updated: "2026-06-01"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: "2.1.147"
analysis_basis: "CC v2.1.147 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.147 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.147

---

## Overview

The `/sandbox` command configures the sandboxing policy for tool execution within Claude Code. It allows users to view the current sandbox configuration, add command-pattern exclusions that bypass the sandbox, and is gated by platform support checks and enterprise policy locks. When invoked without a subcommand it opens an interactive configuration UI; with the `exclude` subcommand it registers a glob-style command pattern that is allowed to run outside the sandbox.

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
| module_id | `ch1` |
| load_inline | `true` |
| loc_byte | `12080772` |
| loc_byte_end | `12081421` |
| arbor_handler.name | `Kg7` |
| arbor_handler.fqn | `claude-2.1.147::Kg7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.147 bundle.js:+12080772

---

## Input Branching

The handler has five or more clearly distinct branches based on platform state, policy lock state, and argument subcommand parsing, so a Mermaid flowchart is required.

```mermaid
flowchart TD
    A(["/sandbox invoked"]) --> B{isSupportedPlatform?}
    B -- No: generic OS --> C["Return error:\n'Sandboxing only supported on\nmacOS, Linux, and WSL2'"]
    B -- No: WSL1 detected --> D["Return error:\n'Sandboxing requires WSL2.\nWSL1 is not supported.'"]
    B -- Yes --> E{checkDependencies}
    E -- Missing deps --> F["Return dependency error via\ntheme-aware renderer (IA)"]
    E -- OK --> G{isPlatformInEnabledList?}
    G -- Not in enabled list --> H["Return platform-not-enabled\nerror/info message"]
    G -- Enabled --> I{areSandboxSettingsLockedByPolicy?}
    I -- Locked --> J["Return error:\n'Sandbox settings overridden by\nhigher-priority configuration'"]
    I -- Not locked --> K{Parse argv[0]}
    K -- no argument --> L["Open interactive JSX\nconfiguration UI (Fc)"]
    K -- 'exclude' --> M{argv[1] provided?}
    M -- Missing pattern --> N["Return error:\n'Please provide a command\npattern to exclude\n(e.g., /sandbox exclude\n\"npm run test:*\")'"]
    M -- Pattern present --> O["Strip leading 8 chars,\napply regex replace (mz_)\nWrite exclusion to\n.claude/settings.local.json\nEmit sandbox_exclude_command\ntelemetry (bH / mH)"]
    O --> P["Return success confirmation"]
```

Analysis basis: CC v2.1.147 bundle.js:+12079391 – +12080420

---

## Behavioral Spec

### Entry-point: Platform and Policy Guard (`Kg7`)

The handler `Kg7` is an `AsyncFunction` that begins with a sequence of guards before any user-visible action occurs.

```
async function sandboxCommandHandler(args, context):
    # Step 1 — Lightweight theme check
    themeMode = getThemeMode()           # XA → "light" or other value
    colorRenderer = getColorOutput()     # o6

    # Step 2 — Platform support check
    if not platformSupport.isSupportedPlatform():
        wslVersion = detectWslVersion()  # $A.isSupportedPlatform internals
        if wslVersion == "wsl" (WSL1):
            return errorMessage("Error: Sandboxing requires WSL2. WSL1 is not supported.")
        else:
            return errorMessage("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")

    # Step 3 — Dependency check
    depResult = platformSupport.checkDependencies()
    if depResult has errors:
        styledError = renderThemedError(depResult, themeMode)   # IA
        return styledError

    # Step 4 — Platform-in-enabled-list check
    if not platformSupport.isPlatformInEnabledList():
        return platformNotEnabledMessage()

    # Step 5 — Policy lock check
    if platformSupport.areSandboxSettingsLockedByPolicy():
        return errorMessage(
            "Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally."
        )

    # Step 6 — Route by subcommand
    subcommand = args.split(" ")[0]     # f.split
    tail       = args.slice(8)          # f.slice (strips "exclude " prefix = 8 chars)

    if subcommand == "exclude":
        return handleExclude(tail, context)
    else:
        return openSandboxConfigUI(context)   # Fc
```

Analysis basis: CC v2.1.147 bundle.js:+12079391

---

### Sub-feature: Exclusion Pattern Registration (`mz_` / `_A`)

When the `exclude` subcommand is selected, the handler processes the pattern argument, validates it, and writes the rule to the local settings file.

```
function handleExclude(patternArg, context):
    # Validate non-empty pattern
    if patternArg is empty or length == 0:
        return errorMessage(
            "Error: Please provide a command pattern to exclude " +
            "(e.g., /sandbox exclude \"npm run test:*\")"
        )

    # Normalise pattern: strip surrounding quotes, apply regex replace
    cleanPattern = patternArg.replace(quoteRegex, "")   # z.replace

    # Load current local sandbox settings
    localSettings = readSandboxConfig(context)           # mz_ → m8 → localSettings key

    # Filter existing rules and append new one
    existingRules = localSettings.addRules.filter(...)   # mz_ → _.filter
    if cleanPattern not in existingRules:
        localSettings.addRules.push(cleanPattern)

    # Match against known patterns for deduplication / glob check
    matchResult = patternMatcher.match(cleanPattern)     # E5L → H.match

    # Persist to .claude/settings.local.json
    writeLocalSettings(".claude/settings.local.json", localSettings)   # fz / _A → Ux6

    # Emit telemetry
    emitFeatureOkEvent("sandbox_exclude_command")        # bH → tengu_feature_ok
    # On failure path:
    # emitFeatureBadEvent("sandbox_exclude_command")     # mH → tengu_feature_bad

    return successMessage(cleanPattern)
```

Analysis basis: CC v2.1.147 bundle.js:+12080114, +12080318, +12080347, +4576875

---

### Sub-feature: Themed Error / Dependency Renderer (`IA`)

The dependency-error renderer produces a styled terminal message using ANSI colour codes. It is called only when the dependency check fails.

```
function renderDependencyError(depResult, themeMode):
    # Check if output context is foreground
    if context.mode != "foreground":
        return plainText(depResult)

    # Detect colour prefix (rgb, ansi256, ansi:, etc.)
    prefix = detectColorPrefix(depResult)

    match prefix:
        case "rgb("    → color = colorLib.rgb(...)
        case "ansi256" → color = colorLib.ansi256(...)
        case "ansi:"   → color = colorLib.fromAnsiCode(...)
        default        → color = colorLib.namedColor(...)   # F$H → P6.*

    # Apply foreground/background styling pair
    styledText = applyColorPair(color, depResult.message)

    # Schedule delayed display (H → Math.random / setTimeout)
    scheduleRender(styledText, randomDelay)

    return styledText
```

Analysis basis: CC v2.1.147 bundle.js:+3713069, +3713113, +3713209

---

### Sub-feature: Interactive Configuration UI (`Fc`)

When no subcommand is provided, the handler delegates to the JSX-based configuration component (`Fc`). The component is rendered inline (type `local-jsx`, `immediate: true`) and allows the user to toggle sandbox settings interactively. The depth-2 call graph does not expose internal component details beyond the entry call.

```
function openSandboxConfigUI(context):
    # Fc is the JSX React component rendered immediately
    # immediate: true means no waiting for agent turn
    return renderJSXComponent(Fc, {
        context: context,
        settingsPath: ".claude/settings.local.json"
    })
```

Analysis basis: CC v2.1.147 bundle.js:+12080397

---

### Sub-feature: Settings Persistence (`_A` → `Ux6` → `kJK`)

Rule persistence follows the standard layered settings pipeline. The `_A` function resolves the correct settings layer, determines the target path (always `.claude/settings.local.json` for `/sandbox`), and delegates atomic writes.

```
function writeSandboxLocalSettings(settingsObject):
    resolvedPath = resolvePath(".claude/settings.local.json")    # _A → jC → Pv.join
    ensureDir(dirname(resolvedPath))                              # Ux6 → UMH.mkdir
    currentContent = readFile(resolvedPath)                       # Ux6 → UMH.readFile
    merged = merge(currentContent, settingsObject)               # Object.assign
    atomicWrite(resolvedPath, merged)                             # Ux6 → UMH.writeFile
    invalidateSettingsCache()                                     # VY → bI6.clear / pI8.clear
```

Analysis basis: CC v2.1.147 bundle.js:+12080405, +1215439, +1070473

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_feature_ok` | Emitted on successful `exclude` pattern write (bundle.js:+960829) |
| Telemetry — `tengu_feature_bad` | Emitted on failed `exclude` attempt (bundle.js:+960887) |
| Telemetry — `tengu_mcp_oauth_flow_start` | Emitted in deep call path via MCP initialisation (bundle.js:+9822022) |
| Telemetry — `tengu_mcp_oauth_flow_success` | Emitted when MCP OAuth completes successfully (bundle.js:+9826799) |
| Telemetry — `tengu_mcp_oauth_flow_error` | Emitted on MCP OAuth failure (bundle.js:+9828183) |
| Telemetry — `tengu_bg_spare_enable` | Background spare session management (bundle.js:+15117130) |
| Telemetry — `tengu_bg_spare_spawn` | Background spare session spawned (bundle.js:+15117490) |
| Telemetry — `tengu_daemon_config_reload` | Daemon reloads config after settings change (bundle.js:+15132565) |
| Telemetry — `tengu_config_auth_loss_prevented` | Auth-loss guard triggered during config save (bundle.js:+3182196) |
| Telemetry — `tengu_daemon_yield` | Daemon yields to foreground/service (bundle.js:+15136736) |
| Telemetry — `tengu_daemon_control` | Daemon control event (bundle.js:+15153889) |
| Settings file written | `.claude/settings.local.json` — `addRules` array updated with new exclusion pattern |
| Settings cache invalidated | In-memory settings caches (`bI6`, `pI8`) cleared after write |
| `immediate: true` | Command renders its JSX result synchronously, without waiting for an agent turn |
| MCP server state (indirect) | Deep call paths through `EkH`, `ux_`, `_D5` may trigger MCP reconnection and server-list refresh as a side effect of settings reload |
| Platform checks | `$A.isSupportedPlatform`, `$A.checkDependencies`, `$A.isPlatformInEnabledList`, `$A.areSandboxSettingsLockedByPolicy` are called on every invocation before any mutation |

---

## Version History

| Version | Change |
|---|---|
| v2.1.147 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/sandbox exclude` without a quoted glob pattern.** The argument hint shows `exclude "command pattern"` — omitting the pattern argument produces the error `"Error: Please provide a command pattern to exclude (e.g., /sandbox exclude \"npm run test:*\")"` (bundle.js:+12080199).
2. **Running on WSL1.** Sandboxing explicitly requires WSL2. WSL1 is detected and rejected with a clear error message (bundle.js:+12079458, +12079464).
3. **Attempting to change sandbox settings when enterprise policy is active.** When `areSandboxSettingsLockedByPolicy()` returns true, all mutations are blocked and an explanatory error is shown (bundle.js:+12079828, +12079887). The setting must be changed at the policy layer, not locally.
4. **Expecting `/sandbox` to work on Windows (native).** Only macOS, Linux, and WSL2 are in the supported-platform list (bundle.js:+12079522).
5. **Assuming the exclusion is project-wide.** The rule is written to `.claude/settings.local.json`, which is the local (gitignored) layer, not `settings.json`. It applies only to the local machine and is not committed to source control.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Kg7` | Main handler (`AsyncFunction`) for `/sandbox` command — entry point |
| `IA` | Themed dependency-error renderer (foreground/ANSI styling) |
| `F$H` | ANSI colour-code mapper (maps named colours and hex/rgb/ansi256 to terminal codes) |
| `Zg` | Downstream renderer helper called from themed error path |
| `f` | Settings or MCP manager object accessed during command execution |
| `EkH` | MCP server initialisation / connection manager |
| `RHH` | MCP configuration builder |
| `CKH` | MCP server config resolver with multi-layer merge |
| `SHH` | SDK-type MCP server entry collector |
| `cD6` | SSE/HTTP MCP transport entry builder |
| `TN` | Settings normaliser / transformer |
| `o$` | Settings object constructor |
| `c2_` | Settings field coercer |
| `K` | Active MCP connection map / list |
| `L` | Lifecycle-tracked async task |
| `M` | MCP server session object |
| `s8` | Identifier resolver helper |
| `F06` | MCP filter predicate |
| `rj7` | MCP needs-auth cache writer |
| `Su_` | Needs-auth cache path builder |
| `WK8` | Tool-key builder for MCP tools |
| `GK8` | MCP server hash/fingerprint generator |
| `MP` | Hash computation helper (SHA-256) |
| `XK8` | MCP server key builder |
| `pK` | Path key helper |
| `z8` | MCP debug logger |
| `ux_` | MCP server connection / reconnection orchestrator |
| `Hw7` | Pre-connection validator |
| `PF` | MCP client factory |
| `P8H` | OAuth-capable MCP connection handler |
| `RaH` | OAuth pending-connection tracker |
| `D` | Background spare session manager |
| `AJ8` | Post-auth MCP reconnect helper |
| `Ud` | Full MCP reconnect flow orchestrator |
| `qm` | MCP client accessor |
| `Y` | MCP supervisor / daemon config-reload handler |
| `k7` | MCP error logger |
| `ZH` | Error-to-string converter |
| `_w7` | MCP connection race-timeout wrapper |
| `eD7` | SSH environment detector for MCP OAuth |
| `mx_` | MCP status aggregator / state inspector |
| `SaH` | Pending-reconnect state reader |
| `CaH` | OAuth pending state reader |
| `wL1` | MCP tool registration / warm-up flow |
| `M1` | Async-local-store getter |
| `IJ8` | Needs-auth cache path joiner |
| `CH` | JSON serialiser helper |
| `bx_` | MCP connection cache reader |
| `B2_` | MCP server platform filter |
| `M8` | Global config loader |
| `A` | String / array accumulator (context-dependent) |
| `j` | Process kill / cleanup list |
| `y` | Child-process wrapper |
| `OL1` | Async iterator / mapper utility |
| `Gi` | Generic async mapper (validates safe-integer concurrency) |
| `g06` | Decimal-base `parseInt` wrapper (radix 10) |
| `Ru_` | Decimal-base `parseInt` wrapper variant (radix 20 context) |
| `k7K` | MCP server update applicator |
| `kJ8` | Config serialiser for MCP update |
| `sN` | MCP server cleanup sequencer |
| `laH` | Cleanup helper invoker |
| `N` | Config write orchestrator |
| `vJK` | Config write executor |
| `j9A` | Config write sub-helper |
| `f4` | Config path formatter (strips sensitive fields → `[REDACTED]`) |
| `l1A` | Path-map formatter |
| `q` | File-system sync ops wrapper (unlinkSync etc.) |
| `lRH` | Config write stream helper |
| `b1A` | Raw file write helper |
| `kJK` | Atomic settings-file writer with rotation |
| `XRH` | Buffered async write scheduler |
| `XAH` | Staged write path builder |
| `F6` | File-existence / stat checker |
| `C_6` | Error-code classifier (EISDIR, ENOENT, etc.) |
| `e1A` | Staged write path joiner |
| `t1A` | File rotation helper (rename / unlink with `.txt` suffix) |
| `IJK` | Append-then-rotate atomic write handler |
| `r9` | Signal / shutdown hook registrar |
| `$` | Daemon session accessor |
| `ZC1` | Daemon status file writer (`daemon.status.json`) |
| `ll` | Daemon status logger |
| `aE6` | Status file path builder |
| `_D5` | MCP remote-server retry / recovery manager |
| `EK8` | MCP server transport capability checker |
| `r8` | Timed retry / backoff helper |
| `O` | Retry state object |
| `z` | Process / daemon manager object |
| `bH` | `tengu_feature_ok` telemetry emitter |
| `c` | Base telemetry event emitter |
| `mH` | `tengu_feature_bad` telemetry emitter |
| `Pk` | Sub-agent / subprocess spawner |
| `rC` | Sub-agent config builder |
| `Qh` | Sub-agent option resolver |
| `ATH` | First-party sub-agent type classifier |
| `iC` | Sub-agent lifecycle manager |
| `R4_` | Sub-agent session initialiser |
| `aa6` | Sub-agent tool-set builder |
| `Um` | Sub-agent secure-token generator |
| `Ou` | Sub-agent shutdown / exit orchestrator |
| `Jg` | Sub-agent graceful shutdown trigger |
| `Tg` | Sub-agent timeout / force-kill handler |
| `fL_` | Sub-agent IPC post helper |
| `mz_` | Sandbox local-settings loader and exclusion-rule applier |
| `m8` | Settings bootstrap (reads `localSettings`) |
| `Cu6` | Feature-flag cache accessor |
| `FAA` | Feature-flag cache reader (`bI6.has/get`) |
| `Pg8` | Policy settings reader |
| `gAA` | Feature-flag cache writer (`bI6.set`) |
| `WF` | Settings layer merger |
| `w_` | Settings watcher / observer |
| `k86` | Settings key extractor |
| `tk8` | Settings transform helper |
| `Z86` | Settings schema validator |
| `TXH` | Settings type coercer |
| `y86` | Settings default applier |
| `tMH` | Settings merge-strategy resolver |
| `eMH` | Settings diff calculator |
| `Og8` | Settings source annotator |
| `o2A` | Settings serialisation helper |
| `Nl` | Settings notification dispatcher |
| `B16` | Settings load bootstrapper |
| `E5L` | Pattern/glob match helper (`H.match`) |
| `_A` | Settings write orchestrator — resolves path, writes, emits `XxH` event |
| `fz` | Settings layer loader (`AfH` + `WF`) |
| `AfH` | User-settings file path resolver |
| `BP` | Settings file existence bootstrapper |
| `El` | Settings file reader (readFileSync + slice + replaceAll) |
| `J8` | Error-code wrapper |
| `q8` | ENOENT / EISDIR guard |
| `TF8` | Settings load timestamp recorder |
| `$WH` | Settings path resolver + merger |
| `Ru6` | Settings path absolute resolver |
| `sq6` | Atomic safe-write helper (fchmod, fsync, rename) |
| `VY` | Settings cache invalidator (`bI6.clear`, `pI8.clear`) |
| `Ux6` | Local-settings file I/O (mkdir, readFile, appendFile, writeFile) |
| `b6` | Settings watcher bootstrapper |
| `KF8` | Watch key builder |
| `OF8` | File watcher instance |
| `lFK` | Watch path resolver (`.config/ignore`) |
| `jC` | `.claude` dir path joiner |
| `Km` | Settings load lifecycle manager (`loadSettingsFromDisk_start/end`) |
| `gR` | Settings load start marker |
| `Wq` | Memory-usage sampler during settings load |
| `Xg8` | Settings load completion recorder (`settings_load_completed`) |
| `xI6` | Settings load end marker |
| `RH` | Error logger with ring-buffer (`bbH`) |
| `n_` | Error normaliser (Error + String) |
| `UH` | String coercer |
| `j1` | Network-error classifier (`essential-traffic`) |
| `FpK` | Error ring-buffer manager (shift/push `lb6`) |
| `Fc` | JSX sandbox configuration UI component (interactive mode) |