---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.145"
updated: "2026-06-01"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: "2.1.143"
analysis_basis: "CC v2.1.143 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.143 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.143

---

## Overview

The `/sandbox` command configures Claude Code's sandboxing subsystem, which controls which shell commands are allowed to run in an isolated execution environment. It supports a sub-command (`exclude`) that adds a command-pattern glob to the local exclusion list in `.claude/settings.local.json`, bypassing sandbox restrictions for matching commands. The command enforces platform compatibility checks and respects enterprise policy locks before writing any configuration changes.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `sandbox` |
| description | `" ...   ...  (⏎ to configure)"` |
| argumentHint | `exclude "command pattern"` |
| immediate | `true` |
| isHidden | `null` (not hidden) |
| module_id | `QGq` |
| load_inline | `true` |
| loc_byte | `11610426` |
| loc_byte_end | `11611075` |
| loc_line | `7208` |
| arbor_handler.name | `dk7` |
| arbor_handler.fqn | `claude-2.1.143::dk7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.143 bundle.js:+11610426

---

## Input Branching

The command has five distinct branches driven by platform checks, policy locks, and the presence/form of the `exclude` sub-command argument.

```mermaid
flowchart TD
    A(["/sandbox [args] invoked"]) --> B{Platform check:\nisSupportedPlatform?}
    B -- "No: WSL1 detected" --> E1["Return error:\n'Sandboxing requires WSL2.\nWSL1 is not supported.'"]
    B -- "No: unsupported OS" --> E2["Return error:\n'Sandboxing is currently only\nsupported on macOS, Linux, and WSL2.'"]
    B -- "Yes" --> C{Check dependencies\n& enabled platform list}
    C -- "Not in enabled list" --> E3["Return error (platform not enabled)"]
    C -- "In enabled list" --> D{areSandboxSettingsLockedByPolicy?}
    D -- "Locked" --> E4["Return error:\n'Sandbox settings are overridden by a\nhigher-priority configuration and\ncannot be changed locally.'"]
    D -- "Not locked" --> F{args parsed:\nsub-command present?}
    F -- "No args / interactive" --> G["Open interactive\nconfiguration UI\n(JSX component)"]
    F -- "'exclude' sub-command\nwith pattern" --> H{Pattern token\npresent after 'exclude'?}
    H -- "No pattern token\n(args length <= 8)" --> E5["Return error:\n'Please provide a command pattern\nto exclude (e.g., /sandbox exclude\n\"npm run test:*\")'"]
    H -- "Pattern token present" --> I["Normalize pattern,\nwrite exclusion rule to\n.claude/settings.local.json\nvia addRules / localSettings"]
    I --> J["Emit sandbox_exclude_command\ntelemetry event\nReturn success"]
```

Analysis basis: CC v2.1.143 bundle.js:+11609045 – +11610051

---

## Behavioral Spec

### 1. Handler Entry Point (`sandboxCommandHandler`)

The async handler `dk7` is the Arbor-resolved entry point for `/sandbox`.

```
async function sandboxCommandHandler(args, context):
    // Step 1 — Check theme/display context
    themeContext = getThemeContext()                       // _A  (+11609045)
    displayMode  = getDisplayMode()                       // d6  (+11609067)

    // Step 2 — Platform compatibility gate
    if not sandboxUtils.isSupportedPlatform():            // c_.isSupportedPlatform (+11609076)
        wslVersion = detectWSL()
        if wslVersion == "wsl" and wslVersion != "wsl2":
            return renderError("Error: Sandboxing requires WSL2. WSL1 is not supported.")
            // literal: (+11609118)
        else:
            return renderError(
                "Error: Sandboxing is currently only supported on macOS, Linux, and WSL2."
            )
            // literal: (+11609176)

    // Step 3 — Dependency and enabled-platform check
    depStatus = await sandboxUtils.checkDependencies()    // c_.checkDependencies (+11609293)
    if not sandboxUtils.isPlatformInEnabledList():        // c_.isPlatformInEnabledList (+11609320)
        return renderError(depStatus.errorMessage)        // type "error" (+11609256)

    // Step 4 — Policy lock check
    if sandboxUtils.areSandboxSettingsLockedByPolicy():   // c_.areSandboxSettingsLockedByPolicy (+11609482)
        return renderError(
            "Error: Sandbox settings are overridden by a higher-priority configuration "
            "and cannot be changed locally."
        )
        // literal: (+11609541)

    // Step 5 — Parse sub-command
    tokens = args.split(...)                              // M.split (+11609768)
    subCommand = tokens[0]

    if subCommand == "exclude":                           // literal "exclude" (+11609791)
        if tokens.length <= 8:                            // numeric limit (+11609816)
            return renderError(
                "Error: Please provide a command pattern to exclude "
                "(e.g., /sandbox exclude \"npm run test:*\")"
            )
            // literal: (+11609853)

        pattern = tokens.slice(8)                         // M.slice (+11609808)
        normalizedPattern = pattern.replace(...)          // z.replace (+11609972)

        // Step 6 — Load current settings and append exclusion rule
        settingsContext = loadSettingsContext()           // jf_ (+11610001)
        currentSettings = getLocalSettings(settingsContext)  // wO (+11610014)

        relativePath = FGq.relative(...)                 // FGq.relative (+11610038)
        writeTarget  = ".claude/settings.local.json"     // literal (+11610059)

        applyExclusionRule(                              // Fd (+11610051)
            pattern = normalizedPattern,
            settingsPath = writeTarget
        )
        emitTelemetry("sandbox_exclude_command")         // literal (+4436189)
        return renderSuccess()

    else:
        // No recognized sub-command: open interactive configuration panel
        return renderInteractiveSandboxUI(context)
```

Analysis basis: CC v2.1.143 bundle.js:+11609045

---

### 2. Platform Support Check (`sandboxUtils.isSupportedPlatform`)

```
function isSupportedPlatform():
    // Returns true if running on macOS, Linux, or WSL2.
    // Returns false for WSL1 (version string "wsl") or unsupported OS.
    // Called from sandboxCommandHandler before any state mutation.
```

Analysis basis: CC v2.1.143 bundle.js:+11609076

---

### 3. Dependency Check (`sandboxUtils.checkDependencies`)

```
async function checkDependencies():
    // Verifies that required sandbox binaries / kernel features are present.
    // Returns a status object; on failure, status.errorMessage is surfaced
    // as a rendered "error" type message to the user.
```

Analysis basis: CC v2.1.143 bundle.js:+11609293

---

### 4. Policy Lock Check (`sandboxUtils.areSandboxSettingsLockedByPolicy`)

```
function areSandboxSettingsLockedByPolicy():
    // Reads enterprise/policy settings layer.
    // If sandbox configuration is governed by a higher-priority policy,
    // returns true and the handler surfaces a hard error preventing
    // any local write.
    // Error literal: "Sandbox settings are overridden by a higher-priority
    //                 configuration and cannot be changed locally."
```

Analysis basis: CC v2.1.143 bundle.js:+11609482

---

### 5. Exclusion-Rule Writer (`applyExclusionRule` / `Fd`)

```
function applyExclusionRule(pattern, settingsPath):
    // Loads localSettings via jf_ / wO call chain.
    // Calls addRules (identifier: "addRules", literal +4435903) to append
    // the normalized glob pattern to the sandbox exclusion list.
    // Writes result back to .claude/settings.local.json (+11610059).
    // On success, emits the "sandbox_exclude_command" telemetry event.
```

Analysis basis: CC v2.1.143 bundle.js:+11610001, +11610051

---

### 6. Color/Formatting Subsystem (`terminalColorMapper`)

The call-graph path `dk7 → OA → w$H` reaches a comprehensive ANSI-color mapping routine used to format sandbox status output. It handles all 16 named colors plus `bright` variants, `hex`, `ansi256`, and `rgb` color modes, and adapts output for `foreground` vs. `background` rendering. This is a display utility; it has no effect on sandbox state.

Analysis basis: CC v2.1.143 bundle.js:+3692245, +3364942

---

### 7. MCP Settings Load Chain (`mcpSettingsLoader` / `SvH`)

The deeper call-graph path `M → SvH → …` is the MCP (Model Context Protocol) server configuration loader. This module is invoked transitively when loading the full settings context for the sandbox command — it ensures MCP server state is consistent before sandbox rules are written. Key behaviors observed in the traversal:

- Iterates over all configured MCP servers (`Object.entries` at +9694646).
- Normalises server transport types: `stdio` (+9694847), `sse` (+7651185), `http` (+7651201), `sse-ide` (+9694946), `ws-ide` (+9694982), `claudeai-proxy` (+9695254).
- Skips servers marked `disabled` (+9694745) or `needs-auth` (+9695452).
- Handles OAuth flow lifecycle events including `mcp_oauth_flow` (+9634600) and `complete_authentication` (+9656030).
- Re-connects via `mcp_reconnect` (+9693614) when a server recovers.

Analysis basis: CC v2.1.143 bundle.js:+9694646

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `sandbox_exclude_command` (emitted when an exclusion rule is successfully written, +4436189) |
| Telemetry (transitive) | `tengu_mcp_oauth_flow_start` (+9630015), `tengu_mcp_oauth_flow_success` (+9634491), `tengu_mcp_oauth_flow_error` (+9635875), `tengu_bg_spare_enable` (+14502634), `tengu_bg_spare_spawn` (+14502994), `tengu_daemon_config_reload` (+14517117), `tengu_config_auth_loss_prevented` (+3159634), `tengu_daemon_yield` (+14521203), `tengu_feature_ok` (+955068), `tengu_feature_bad` (+955126), `tengu_daemon_control` (+14538273) |
| Config write | Appends exclusion glob to `.claude/settings.local.json` (+11610059) when `exclude` sub-command is used |
| Settings layer read | Reads `localSettings` (+4435812), `userSettings` (+1197356), `projectSettings` (+1197407), `policySettings` (+1201347), `flagSettings` (+1201446) |
| Platform guard | Hard-errors on WSL1 or non-Linux/macOS/WSL2 platforms before any I/O |
| Policy guard | Hard-errors if `areSandboxSettingsLockedByPolicy` returns true; no config write occurs |
| MCP state | Transitively triggers MCP server settings reload when loading full settings context |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.143 | Initial analysis |

---

## Common Mistakes

1. **Omitting the pattern argument with `exclude`**: Running `/sandbox exclude` with no following pattern causes a hard error — the handler checks that the token stream is longer than 8 characters/tokens before proceeding. Always supply the glob string, e.g., `/sandbox exclude "npm run test:*"`.

2. **Running on WSL1**: The command explicitly rejects WSL1. Users must upgrade to WSL2 or use Linux/macOS directly; there is no fallback or override for this check.

3. **Expecting local overrides under enterprise policy**: If an administrator has locked sandbox settings via a higher-priority policy layer, the command will refuse to write `.claude/settings.local.json` and display an error. The lock cannot be bypassed from the CLI.

4. **Confusing scope of the exclusion list**: The `exclude` sub-command writes exclusively to `.claude/settings.local.json` (project-local scope). Changes are not propagated to user-level (`settings.json`) or enterprise policy layers.

5. **Expecting immediate interactive UI on first invocation**: The command is registered as `immediate: true`, so the JSX configuration panel opens without requiring a follow-up Enter key — but it only opens when no recognized sub-command is provided. Providing any argument (including an incomplete `exclude`) routes to the argument-processing path instead.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `dk7` | Main async handler for `/sandbox` (Arbor-resolved entry point) |
| `OA` | Terminal color format dispatcher (foreground/background router) |
| `w$H` | ANSI color name-to-escape-sequence mapper |
| `vF` | Color format fallback/utility (called from color dispatcher) |
| `M` | MCP settings split/reload orchestrator |
| `SvH` | MCP server configuration loader (iterates all configured servers) |
| `KHH` | MCP server collection builder |
| `cqH` | Per-server connection handler / initializer |
| `qHH` | SDK-type MCP server enumerator |
| `ww6` | SSE/HTTP MCP server connection tracker |
| `rI` | MCP server record factory |
| `X$` | MCP server connection state constructor |
| `RG_` | MCP server reconnect utility |
| `K` | MCP server map / collection reference |
| `L` | Active-connection tracking set with lifecycle hooks |
| `f` | Transport session object (open/close) |
| `H_` | Internal helper (single-arg wrapper) |
| `f26` | MCP server filter predicate |
| `_57` | MCP status timestamp recorder |
| `bh_` | Status persistence helper (reads d1/tY8) |
| `v78` | MCP tool-hash / version-key generator |
| `Ei` | Tool schema normalizer |
| `kj` | SHA-256 hash utility for tool definitions |
| `I78` | Tool identifier key builder |
| `dK` | Low-level hash primitive |
| `A8` | MCP debug log emitter |
| `Yh_` | MCP OAuth / authentication orchestrator |
| `w77` | OAuth pre-flight check utility |
| `PB` | OAuth credential store accessor |
| `tHH` | MCP OAuth server lifecycle manager (HTTP callback server) |
| `mrH` | OAuth in-progress request cache manager |
| `D` | Background spare-session controller |
| `BY8` | OAuth status persistence writer |
| `UQ` | MCP server reconnection handler |
| `Ku` | Auth credential reader |
| `Y` | MCP supervisor / config-reload listener |
| `_7` | MCP error log emitter |
| `XH` | String coercion utility |
| `J77` | OAuth flow result handler |
| `D77` | SSH-session detection helper |
| `Dh_` | MCP complete-authentication tool registration |
| `urH` | Pending OAuth request lookup |
| `prH` | In-progress OAuth request lookup |
| `x8q` | MCP needs-auth cache read/write |
| `d1` | AsyncLocalStorage store accessor |
| `tY8` | Cache path resolver (joins sY8 + x8) |
| `hH` | JSON.stringify wrapper |
| `Oh_` | MCP tool-hash verification helper |
| `NG_` | Tool name inclusion checker |
| `a6` | Global config save utility |
| `A` | Tool name list (lowercase comparator) |
| `J` | Running-process map (kill on stop) |
| `y` | Background worker process wrapper |
| `S8q` | MCP port integer parser orchestrator |
| `Yn` | Safe async iterator / Promise.race utility |
| `M26` | Port number parser (radix 10, range 10–20) |
| `xh_` | Secondary port number parser |
| `THK` | MCP config apply-update handler |
| `eY8` | MCP config serializer |
| `wv` | MCP server cleanup coordinator |
| `drH` | Individual server cleanup handler |
| `v` | Shell command executor / process spawner |
| `G5K` | Process environment builder |
| `tt_` | Locale/encoding configurator |
| `P7` | Command-line argument sanitizer (redacts sensitive tokens) |
| `h6A` | Argument array flattener |
| `q` | Temporary file unlink helper |
| `cSH` | Stdio write helper |
| `X6A` | Raw stream writer |
| `Z5K` | Transcript / output log manager |
| `PSH` | Buffered output flusher with debounce |
| `i8H` | Log line formatter |
| `x6` | File existence check |
| `gv8` | Log file size limiter |
| `U6A` | Log file path builder |
| `p6A` | Atomic file rename helper |
| `E5K` | Log append-with-rotation handler |
| `h9` | Process exit hook registrar |
| `$` | MCP server instance factory |
| `JZq` | Daemon status file writer |
| `ha` | Daemon log formatter |
| `r06` | Daemon status path builder |
| `B95` | MCP retry / remote server recovery orchestrator |
| `k78` | MCP server health-state checker |
| `r8` | Child process wrapper with timeout |
| `O` | Process stdout collector |
| `z` | Daemon session object (stop/start) |
| `SH` | Session success-state renderer |
| `d` | Telemetry event emitter (feature ok/bad) |
| `mH` | Session failure-state renderer |
| `xN` | MCP server process spawner |
| `jF` | MCP server shutdown initiator |
| `Uu` | MCP transport factory |
| `$0H` | MCP server config parser |
| `sR` | MCP server config validator |
| `cA_` | First-party MCP server bootstrapper |
| `Ni6` | External MCP server bootstrapper |
| `pu` | MCP server auth-token generator |
| `Ox` | Graceful shutdown orchestrator (Promise.race + process.exit) |
| `JF` | MCP server O9H shutdown caller |
| `EF` | Shutdown timeout handler |
| `Z9_` | Post-shutdown cleanup poster |
| `jf_` | Settings loader for sandbox exclusion rules |
| `I8` | Settings file reader |
| `jC6` | Settings cache lookup |
| `It_` | Settings cache hit checker (kV6.has/get) |
| `lm8` | Settings file parser |
| `vt_` | Settings cache writer (kV6.set) |
| `WB` | Settings object builder / merger |
| `__` | Settings validation helper |
| `fH6` | Settings field extractor (field 1) |
| `RV8` | Settings field extractor (field 2) |
| `_H6` | Settings field extractor (field 3) |
| `xjH` | Settings field extractor (field 4) |
| `MH6` | Settings field extractor (field 5) |
| `V5H` | Settings field extractor (field 6) |
| `I5H` | Settings field extractor (field 7) |
| `Um8` | Settings field extractor (field 8) |
| `hDA` | Settings field extractor (field 9) |
| `vc` | Settings field extractor (field 10) |
| `P96` | Settings file locator (d6 / J96 / LP) |
| `ZeL` | Exclusion-rule pattern matcher (H.match) |
| `p_` | Exclusion rule add/write handler (addRules) |
| `wO` | Local settings getter (k5H + WB) |
| `k5H` | Settings path resolver (pV.join + JC6) |
| `AP` | Settings file access helper |
| `Tc` | Settings file reader with slice/replaceAll |
| `$8` | File write utility (uses L8) |
| `L8` | Low-level file I/O primitive |
| `nu8` | Settings write timestamp recorder |
| `XXH` | Settings context builder (JC6 + WB) |
| `JC6` | Config directory path resolver |
| `yA6` | Atomic symlink-safe file writer |
| `hz` | Settings cache clearer (kV6.clear + EZ8.clear) |
| `VR6` | Global config file writer (mkdir + readFile + writeFile) |
| `S6` | Config path selector (Uh6 + __) |
| `Ru8` | Config serializer (mL) |
| `uu8` | Git-ignore checker ($_) |
| `ySK` | Config home-directory path builder |
| `hy` | Project settings path resolver (pV.join) |
| `Lu` | Settings-from-disk loader orchestrator |
| `ah` | Settings load pre-check |
| `P1` | Memory-usage sampler (process.memoryUsage) |
| `nm8` | Full settings load pipeline (date + hash + policy + flag + local) |
| `yV6` | Settings load post-processor |
| `NH` | Error logger (v_ + xH + zq + kNK + xRH + Wc.logError) |
| `v_` | Error type normalizer |
| `xH` | Error-to-string coercer |
| `zq` | Error context formatter |
| `kNK` | Rolling error-log ring-buffer manager |
| `Fd` | Exclusion rule finalizer / settings write dispatcher |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.