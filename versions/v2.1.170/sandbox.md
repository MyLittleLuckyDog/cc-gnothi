---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.170"
updated: "2026-06-11"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.170 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.170 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.170

---

## Overview

The `/sandbox` command configures the sandboxing behavior that Claude Code uses when executing shell commands. It allows users to toggle sandbox mode on or off, add exclusion patterns for specific commands that should bypass sandboxing, and inspects platform compatibility before applying any changes. Settings are persisted to `.claude/settings.local.json`.

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
| module_id | `Y5K` |
| load_inline | `true` |
| loc_byte | `12793467` |
| loc_byte_end | `12794116` |
| loc_line | `9124` |
| arbor_handler.name | `sgf` |
| arbor_handler.fqn | `claude-2.1.170::sgf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.170 bundle.js:+12793467

---

## Input Branching

The handler has 4+ distinct branches depending on platform support, policy lock state, sub-command keyword, and argument presence, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A([/sandbox invoked]) --> B{Platform supported?\nbA.isSupportedPlatform}
    B -- No --> C{WSL present?\nbA.isPlatformInEnabledList}
    C -- WSL1 detected --> D["Error: Sandboxing requires WSL2.\nWSL1 is not supported."]
    C -- Not macOS/Linux/WSL2 --> E["Error: Sandboxing is currently only\nsupported on macOS, Linux, and WSL2."]
    B -- Yes --> F{Policy lock?\nbA.areSandboxSettingsLockedByPolicy}
    F -- Locked --> G["Error: Sandbox settings are overridden by\na higher-priority configuration and\ncannot be changed locally."]
    F -- Not locked --> H{Check dependencies\nbA.checkDependencies}
    H -- Missing dependencies --> I[Display dependency error via logger]
    H -- OK --> J{Parse argument\nM.split / M.slice}
    J -- No argument / interactive --> K[Open interactive JSX config UI\nvia Nh_ / XB rendering]
    J -- 'exclude' sub-command --> L{Pattern argument present?\nlength > 8}
    L -- No pattern --> M["Error: Please provide a command pattern\nto exclude (e.g., /sandbox exclude \"npm run test:*\")"]
    L -- Pattern present --> N[Append exclude rule via e_\nWrite to .claude/settings.local.json\nEmit sandbox_exclude_command telemetry]
    K --> O([Return JSX component])
    N --> O
    M --> O
    D --> O
    E --> O
    G --> O
    I --> O
```

Analysis basis: CC v2.1.170 bundle.js:+12792086 through +12793092

---

## Behavioral Spec

### 1. Platform and Dependency Gate

```
async function sandboxCommandHandler(args, context):
    colorTheme = resolveColorTheme(args)  // FA @ 12792086

    if not platformModule.isSupportedPlatform():
        wslVariant = platformModule.isPlatformInEnabledList()
        if wslVariant == "wsl":
            return errorMessage("Error: Sandboxing requires WSL2. WSL1 is not supported.")
        else:
            return errorMessage("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")

    logTheme = buildLogTheme(colorTheme)  // yA @ 12792294
    spinner = startSpinner()              // H @ 12792318

    dependencyResult = await platformModule.checkDependencies()
    if dependencyResult.status == "error":
        return renderError(dependencyResult)

    if platformModule.areSandboxSettingsLockedByPolicy():
        return errorMessage("Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally.")
```

Analysis basis: CC v2.1.170 bundle.js:+12792117, +12792153, +12792159, +12792217, +12792334, +12792523

### 2. Argument Parsing — `exclude` Sub-Command

```
function parseAndRouteArgument(rawArg):
    tokens = rawArg.split(" ")          // M.split @ 12792809
    subCommand = tokens[0]
    remainder = rawArg.slice(8)         // M.slice @ 12792849, offset 8

    if subCommand == "exclude":
        pattern = remainder.trim()
        if pattern.length == 0:
            return errorMessage(
                'Error: Please provide a command pattern to exclude ' +
                '(e.g., /sandbox exclude "npm run test:*")'
            )
        return applyExcludeRule(pattern)
    else:
        return openInteractiveUI()
```

Analysis basis: CC v2.1.170 bundle.js:+12792832, +12792857, +12792894

### 3. Exclude Rule Application

```
async function applyExcludeRule(pattern):
    // z.replace @ 12793013: sanitizes the pattern string
    sanitizedPattern = sanitizePattern(pattern)

    // Nh_ @ 12793042: loads local settings, adds the exclude rule
    currentSettings = await loadLocalSettings()
    currentSettings.addRules.push({ exclude: sanitizedPattern })

    // e_ @ 4682533: writes the updated rules back
    await writeSettingsFile(currentSettings, ".claude/settings.local.json")

    // I$ @ 12793055: re-evaluates settings in memory
    reloadSettingsState()

    // O5K.relative @ 12793079: computes relative path for display
    displayPath = path.relative(cwd, ".claude/settings.local.json")

    // Id @ 12793092: renders confirmation JSX component
    return renderConfirmation(displayPath, sanitizedPattern)
```

Analysis basis: CC v2.1.170 bundle.js:+12793013, +12793042, +12793055, +12793079, +12793092, +12793100

### 4. Interactive Configuration UI

When no recognised sub-command is provided, the command renders a JSX component (type `local-jsx`) that allows the user to interactively toggle sandbox mode on or off and review current sandbox rules. This is the default path when `/sandbox` is invoked with no arguments or with `⏎`.

Analysis basis: CC v2.1.170 bundle.js:+12793467 (registration `immediate: true`, `type: "local-jsx"`)

### 5. Settings Persistence Path

The target file for all local sandbox settings mutations is `.claude/settings.local.json` (literal at CC v2.1.170 bundle.js:+12793100). The `addRules` key inside this file accumulates exclude patterns.

### 6. Theme / Color Resolution

`yA` (color-theme resolver) is called early in the handler. It inspects whether the terminal runs in `"light"` mode (literal at +12792098) and selects an appropriate ANSI palette (via `UJH` which dispatches across the full `w6.*` color namespace). This affects diagnostic and spinner output coloring only; it does not change command behavior.

Analysis basis: CC v2.1.170 bundle.js:+12792098, +12792294

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_mcp_oauth_flow_start` | Fired when an MCP OAuth flow begins (within call-graph depth via `$1H`; bundle.js:+6481584) |
| Telemetry — `tengu_mcp_oauth_flow_success` | Fired on successful OAuth token exchange (bundle.js:+6486365) |
| Telemetry — `tengu_mcp_oauth_flow_error` | Fired on OAuth flow failure (bundle.js:+6487750) |
| Telemetry — `tengu_daemon_config_reload` | Fired when daemon config is reloaded after settings change (bundle.js:+16545205) |
| Telemetry — `tengu_mcp_skills` | Fired when MCP tool capabilities are enumerated (bundle.js:+6587132) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a write that would lose auth config is blocked (bundle.js:+3303113) |
| Telemetry — `tengu_feature_ok` | Feature gate pass (bundle.js:+1014205) |
| Telemetry — `tengu_feature_bad` | Feature gate hard-fail (bundle.js:+1014267) |
| Telemetry — `tengu_feature_sad` | Feature gate soft-fail (bundle.js:+1014348) |
| Telemetry — `tengu_daemon_control` | Fired on daemon lifecycle transitions (bundle.js:+16566763) |
| Implicit event — `sandbox_exclude_command` | String literal used as a telemetry/log tag when an exclude rule is written (bundle.js:+4682615) |
| File write | Appends/updates `.claude/settings.local.json` when an exclude rule is applied |
| In-memory settings reload | `I$` re-evaluates the settings store after writing, making the rule immediately effective |
| Hook registration | `N9` (LTA.register) is reached via the settings-load chain; it registers a settings-change listener (bundle.js:+62328) |
| MCP connection management | `aSH` / `bJ8` / `Fn` sub-graph manages MCP server lifecycle as a side effect of settings updates |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.170 | Initial analysis |

---

## Common Mistakes

1. **Omitting the pattern argument with `exclude`**: Running `/sandbox exclude` without a quoted pattern produces the error `Error: Please provide a command pattern to exclude (e.g., /sandbox exclude "npm run test:*")`. Always supply the pattern immediately after `exclude`, wrapped in quotes if it contains spaces or wildcards.

2. **Running on an unsupported platform**: Sandboxing only works on macOS, Linux, and WSL2. Attempting to use `/sandbox` on Windows (native) or WSL1 returns a hard error with no fallback.

3. **Expecting global settings changes**: `/sandbox` writes to `.claude/settings.local.json` — a project-local, gitignored file. Changes do not propagate to `~/.claude/settings.json` or enterprise policy files.

4. **Assuming policy-locked deployments can be changed**: If an enterprise policy has locked sandbox settings, `/sandbox` will report an immutable-settings error regardless of what argument is passed.

5. **Confusing `immediate: true` with instant execution**: The `immediate` flag means the command renders its JSX UI without waiting for an explicit confirmation press, but changes to exclusion rules are still written to disk asynchronously.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `sgf` | Main async handler for the `/sandbox` command (Arbor-resolved entry point) |
| `yA` | Color-theme resolver; selects ANSI palette based on terminal light/dark mode |
| `H` | Spinner / progress indicator utility |
| `UJH` | ANSI color-name-to-escape-code dispatcher (full palette) |
| `vl` | Fallback color renderer |
| `M` | Parsed argument container / MCP manager module |
| `aSH` | MCP server connection orchestrator |
| `pn` | MCP server slot initializer |
| `nE6` | MCP server slot bootstrap helper |
| `kt` | MCP server config loader and dependency resolver |
| `Ag` | SDK-type MCP server aggregator |
| `zJ8` | Connection warning formatter (red/yellow ANSI) |
| `q` | MCP server registry / Set |
| `cE6` | SSE/HTTP MCP connection handler |
| `vV` | MCP capability validator |
| `kY` | MCP tool-list fetcher |
| `Tm_` | MCP capability transformer |
| `K` | MCP server map iterator |
| `L` | MCP transport stream / async queue |
| `f` | MCP transport connection object |
| `F8` | Underscore utility wrapper |
| `BZ6` | MCP server filter predicate |
| `Cg9` | MCP needs-auth cache writer |
| `zU_` | Auth-failure cache path builder |
| `yPH` | MCP tool fingerprint hash builder |
| `aD8` | MCP tool schema digest helper |
| `sD8` | MCP tool schema serializer |
| `QP` | Content hash builder (sha256/hex) |
| `rD8` | Tool schema key extractor |
| `y4` | Settings path resolver |
| `M8` | MCP debug logger |
| `bJ8` | MCP OAuth connection handler |
| `fX7` | OAuth client factory |
| `Dc` | OAuth credential store accessor |
| `sAH` | OAuth token persistence helper |
| `tAH` | OAuth token refresh scheduler |
| `$1H` | Full OAuth flow orchestrator (server, callback, token exchange) |
| `feH` | Pending-connection registry manager |
| `D` | Forced-shutdown / process-exit handler |
| `uJ8` | Auth-failure cache clearer |
| `Fn` | MCP reconnect handler |
| `hu` | Credential key store accessor |
| `Y` | MCP supervisor restart handler |
| `U7` | MCP error logger |
| `EH` | String-coercion error formatter |
| `MX7` | OAuth race-condition resolver |
| `LX7` | SSH-session OAuth redirect handler |
| `xJ8` | MCP tool-call dispatcher |
| `LeH` | Active-connection lookup helper |
| `MeH` | Pending-connection lookup helper |
| `Fg9` | MCP re-connect with cache-check |
| `m9` | AsyncLocalStorage store getter |
| `Rj8` | Needs-auth cache file path builder |
| `CH` | JSON.stringify wrapper |
| `Rm_` | MCP reconnect result renderer |
| `J` | MCP server list / process kill manager |
| `A` | Process name normalizer |
| `S` | Child-process kill helper |
| `VN` | MCP skills telemetry emitter |
| `Y6` | Skill set tracker |
| `Gm_` | Reconnect inclusion-list checker |
| `W8` | Global config save with auth-loss guard |
| `y` | Warning / notification queue |
| `mg9` | Async mapper utility |
| `SF` | Generic async-iterator mapper |
| `CeH` | Port lower-bound parser (parseInt) |
| `Cj8` | Port upper-bound parser (parseInt) |
| `Ic8` | MCP connection result applier |
| `oSH` | MCP tool hash updater |
| `pE` | MCP server cleanup + reconnect dispatcher |
| `SeH` | MCP server slot cleanup helper |
| `N` | Settings-aware shell command executor |
| `PeK` | Platform/CI detection helper |
| `MTA` | CI environment detector |
| `u4` | Argument redactor |
| `FZA` | Argument map formatter |
| `zFH` | Settings write wrapper |
| `yZA` | File write helper |
| `EeK` | Append-log file writer |
| `mBH` | Buffered I/O flush scheduler |
| `L4H` | Log file path builder |
| `n6` | Node fs `existsSync` wrapper |
| `$M6` | Safe file write (EISDIR guard) |
| `cZA` | Atomic file path helper |
| `La8` | File rename-with-backup helper |
| `TeK` | Append-file with mkdir helper |
| `N9` | Settings-change listener registrar |
| `$` | Daemon status file reader |
| `f$K` | Daemon status JSON parser |
| `Xa` | Daemon status file path builder |
| `hu6` | Daemon status path joiner |
| `IPA` | MCP remote-server retry orchestrator |
| `WJ8` | MCP server duplicate/suppression checker |
| `o8` | Timeout-with-abort helper |
| `O` | Abort-signal wrapper |
| `z` | Active-session container / background session manager |
| `SH` | Feature-flag OK renderer |
| `d` | Feature-flag state accessor |
| `K6` | Feature-flag key resolver |
| `ff6` | Feature-flag registry |
| `xH` | Feature-flag bad-state renderer |
| `ih` | Session creation orchestrator |
| `nu` | Session worker spawner |
| `mC` | Worker message dispatcher |
| `UNH` | First-party session initializer |
| `nh` | Session skill emitter |
| `Ww_` | External session factory |
| `_98` | External session runner |
| `uB` | Random token generator |
| `ZU` | Graceful-shutdown race handler |
| `cLH` | Daemon shutdown initiator |
| `lLH` | Shutdown timeout + worker-post helper |
| `UT_` | Worker shutdown poster |
| `Nh_` | Local-settings loader and exclude-rule adder |
| `y8` | Settings file reader |
| `Ro6` | Settings cache getter |
| `CGA` | Settings cache has/get |
| `Hq_` | Settings file parser |
| `bGA` | Settings cache setter |
| `XB` | Settings object builder (all layers) |
| `W_` | Settings xZ transformer |
| `sf6` | Policy settings extractor |
| `bi8` | Flag settings extractor |
| `if6` | Local settings extractor |
| `wZH` | User settings extractor |
| `JZH` | Project settings extractor |
| `ef6` | Enterprise settings extractor |
| `CYH` | Merged settings validator |
| `bYH` | Settings schema validator |
| `Jq_` | Settings conflict resolver |
| `SQA` | Settings sanitizer |
| `to` | Settings type-checker |
| `Nz6` | Settings write dispatcher |
| `K67` | Pattern match helper (H.match) |
| `e_` | Exclude-rule writer; persists to `.claude/settings.local.json` |
| `I$` | In-memory settings reloader after write |
| `SYH` | Settings file path resolver |
| `E2` | File-write coordinator |
| `co` | Config file reader (readFileSync) |
| `k8` | Safe error-file writer |
| `V8` | ENOENT-safe file writer |
| `z9_` | Settings write timestamp recorder |
| `wvH` | Settings path validator |
| `So6` | Settings resolve/dirname helper |
| `xO6` | Atomic symlink-safe file writer |
| `hO` | Settings cache clearer |
| `Fr6` | Gitignore / appendFile log writer |
| `C6` | Gitignore path builder |
| `n1_` | fL log-line formatter |
| `Br6` | Git check-ignore runner |
| `ty4` | Home-dir path expander |
| `YFA` | `ls-files` tracked-file checker |
| `DFA` | Settings append helper |
| `Ru` | `.claude/settings.local.json` path joiner |
| `s6` | Feature-flag sad-state renderer |
| `PB` | Settings-load orchestrator (start/end trace) |
| `bZ` | Settings pre-load check |
| `_q` | Memory-usage snapshot helper |
| `_q_` | Settings load span recorder |
| `yF6` | Post-load settings transformer |
| `hH` | Shell command executor with error handling |
| `jA` | Error string coercer |
| `_6` | String coercion helper |
| `hq` | Essential-traffic guard |
| `lN4` | Command queue shift/push helper |
| `Id` | Confirmation JSX renderer (displayed after exclude rule is applied) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.