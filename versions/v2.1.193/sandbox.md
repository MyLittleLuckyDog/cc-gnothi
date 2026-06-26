---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.193"
updated: "2026-06-26"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.193 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.193 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.193

---

## Overview

The `/sandbox` command configures the sandboxing environment for shell command execution within Claude Code. When invoked without arguments it opens an interactive configuration UI (rendered as JSX); when invoked with the `exclude` sub-command it appends a shell-pattern exception to the local settings file (`.claude/settings.local.json`), allowing specific command patterns to bypass sandbox restrictions. Platform eligibility is checked at invocation time and policy-locked configurations are rejected before any mutation occurs.

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
| module_id | `wGl` |
| load_inline | `true` |
| loc_byte | `12863298` |
| loc_byte_end | `12863993` |
| loc_line | `8819` |
| arbor_handler.name | `GPf` |
| arbor_handler.fqn | `claude-2.1.193::GPf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.193 bundle.js:+12863298

---

## Input Branching

Five distinct execution paths exist depending on platform support, policy locks, and the presence and content of the argument string.

```mermaid
flowchart TD
    A["/sandbox [args] invoked"] --> B{Platform supported?\nxo.isSupportedPlatform}
    B -- "No: WSL1 detected" --> C["Return error:\n'Sandboxing requires WSL2. WSL1 is not supported.'"]
    B -- "No: unsupported OS" --> D["Return error:\n'Sandboxing is currently only supported on macOS, Linux, and WSL2.'"]
    B -- Yes --> E{Check dependencies\nxo.checkDependencies}
    E -- Missing deps --> F["Return error (theme: 'error')"]
    E -- OK --> G{Platform in enabled list?\nxo.isPlatformInEnabledList}
    G -- No --> H["Return error (not in enabled list)"]
    G -- Yes --> I{Policy lock?\nxo.areSandboxSettingsLockedByPolicy}
    I -- Locked --> J["Return error:\n'Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally.'"]
    I -- Not locked --> K{args provided?}
    K -- "No args" --> L["Render JSX configuration UI\nLGl.jsx(...)"]
    K -- "args present" --> M{First token == 'exclude'?}
    M -- No --> N["Return error:\n'Please provide a command pattern to exclude (e.g., /sandbox exclude \"npm run test:*\")'"]
    M -- Yes --> O{Pattern token present?\nargs.slice(8) non-empty after split}
    O -- No --> N
    O -- Yes --> P["Parse exclude pattern\nWrite rule to .claude/settings.local.json\nEmit telemetry: sandbox_exclude_command"]
```

Analysis basis: CC v2.1.193 bundle.js:+12861935

---

## Behavioral Spec

### Platform and Dependency Gate

```
async function sandboxCommandHandler(args, context):
    # Step 1: Determine theme for error rendering
    theme = getTheme()   # "light" checked at +12861947

    # Step 2: Check WSL variant
    wslVariant = getWslVariant()          # Wt(), +12861957
    platformSupported = checkPlatform()   # xo.isSupportedPlatform, +12861966

    if wslVariant == "wsl" and not isWsl2(wslVariant):
        return renderError("Error: Sandboxing requires WSL2. WSL1 is not supported.")
        # Literal at +12862008

    if not platformSupported:
        return renderError("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")
        # Literal at +12862066

    # Step 3: Verify binary dependencies
    depResult = await checkDependencies()   # xo.checkDependencies, +12862183
    if depResult has errors:
        return renderError(depResult, theme="error")   # "error" literal at +12862146

    # Step 4: Verify platform is in the enabled list
    if not isPlatformInEnabledList():       # xo.isPlatformInEnabledList, +12862210
        return renderError(...)

    # Step 5: Check policy lock
    if areSandboxSettingsLockedByPolicy():  # xo.areSandboxSettingsLockedByPolicy, +12862372
        return renderError(
            "Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally."
            # Literal at +12862431
        )

    # Proceed to argument dispatch
    return dispatchArgs(args, context)
```

Analysis basis: CC v2.1.193 bundle.js:+12861935

---

### No-Argument Path — Interactive Configuration UI

```
function renderConfigurationUI(context):
    # When args is empty/absent, render the JSX sandbox configuration component
    return LGl.jsx(SandboxConfigComponent, context)
    # LGl.jsx call at +12862589
```

The `immediate: true` registration flag means the command fires without waiting for a newline confirmation, and the JSX component is rendered inline in the terminal UI.

Analysis basis: CC v2.1.193 bundle.js:+12862589

---

### `exclude` Sub-Command — Pattern Exclusion

```
function handleExcludeSubcommand(args):
    # Split on whitespace; first token is "exclude" (literal at +12862663)
    tokens = args.split(...)               # a.split at +12862640

    # "exclude" occupies bytes 0–7, so pattern begins at offset 8
    # (numeric literal 8 at +12862688)
    patternToken = args.slice(8)           # a.slice at +12862680

    if patternToken is empty:
        return renderError(
            'Error: Please provide a command pattern to exclude (e.g., /sandbox exclude "npm run test:*")'
            # Literal at +12862725
        )

    # Normalize the pattern (strip surrounding quotes via u.replace, +12862844)
    pattern = patternToken.replace(quoteRegex, "")

    # Resolve local settings path
    localSettingsPath = ".claude/settings.local.json"   # Literal at +12862931

    # Load current local settings (hJr, +12862873)
    localSettings = readLocalSettings(localSettingsPath)
    # Filter existing rules (t.filter at +12885711)
    # Read "localSettings" key (literal at +12885643)
    # Read "addRules" key (literal at +12885734)

    # Check for duplicate pattern inclusion (r.includes at +12885924)
    if not alreadyExcluded(localSettings, pattern):
        appendExcludeRule(localSettings, pattern)
        # Persist via writeSettings (kK at +12862923)
        writeLocalSettings(localSettingsPath, localSettings)

    # Emit telemetry (literal at +4886020)
    emit("sandbox_exclude_command")

    # Compute relative display path (vGl.relative at +12862910)
    displayPath = relative(cwd, localSettingsPath)

    # Spawn a subshell watcher for the modified directory (dg at +12862886)
    spawnDirectoryWatcher(displayPath)

    return renderSuccess(pattern, displayPath)
```

Analysis basis: CC v2.1.193 bundle.js:+12862640, +12862663, +12862688, +12862725, +12862873, +12862923, +12862931

---

### Settings Layer Resolution (`hJr` — local settings reader)

```
function readLocalSettings(path):
    # Reads "localSettings" layer (literal at +4885643)
    # Calls the settings loader (_n at +4885640)
    # which delegates through sun → Szo → yB → JLt chain
    # JLt reads policySettings (+1328635), flagSettings (+1328714),
    #   userSettings (+1323973), projectSettings (+1324024)
    raw = loadSettingsFromDisk(path)

    # Filter rules to "addRules" section only (t.filter at +4885711)
    rules = raw["addRules"] ?? []

    # Match exclude patterns (I6d → e.match at +4873129)
    excludeRules = rules.filter(r => r matches excludePattern)

    return { rules, excludeRules }
```

Analysis basis: CC v2.1.193 bundle.js:+4885640, +4885643, +4885711, +4885734, +4885885

---

### Color / Theme Rendering (`Lo` / `oLe`)

The error and status messages are rendered using a terminal color pipeline. The `Lo` function (call at +12862143) dispatches to `oLe` (call at +3925788), which maps named color tokens (e.g., `"black"`, `"red"`, `"green"`, …, `"whiteBright"`) and special forms (`"ansi256("`, `"rgb("`, `"ansi:"`) through the `St` chalk-style styling API. The `"foreground"` mode literal (`+3925648`) selects foreground coloring; background variants (`St.bg*`) are also available.

Analysis basis: CC v2.1.193 bundle.js:+12862143, +3925648, +3925692, +3925788

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_daemon_config_reload` (+17498707), `tengu_daemon_yield` (+17503119), `tengu_mcp_skills` (+6781017), `tengu_config_auth_loss_prevented` (+13970545), `tengu_bg_retire_pinned_low_mem` (+17487013), `tengu_bg_prewarm_per_sweep` (+17487134), `tengu_feature_ok` (+1026754), `tengu_feature_bad` (+1026821), `tengu_daemon_control` (+17520352), `tengu_feature_sad` (+1026902); command-specific: `sandbox_exclude_command` (literal at +4886020) |
| File mutation | Appends an exclude rule to `.claude/settings.local.json` (literal at +12862931) when the `exclude` sub-command succeeds |
| Settings layers read | `policySettings`, `flagSettings`, `userSettings`, `projectSettings`, `localSettings` via the full settings loader chain |
| Directory watcher | `dg` (spawnDirectoryWatcher) is called after writing the exclude rule (+12862886) to observe subsequent changes to the settings directory |
| Hook registration | `Ei → a7o.register` (+68040) — registers a signal/hook; scope is bundle-wide, not exclusive to this command |
| JSX render | `LGl.jsx` renders the interactive configuration component when no arguments are supplied (+12862589) |
| appState changes | None observed directly within depth-2 traversal of `GPf` |
| Sound | None observed |

---

## Version History

| Version | Change |
|---|---|
| v2.1.193 | Initial analysis |

---

## Common Mistakes

1. **Using the command on WSL1**: `/sandbox` explicitly rejects WSL1 with a clear error message. Upgrade to WSL2 before attempting to use sandbox configuration.
2. **Omitting the pattern argument after `exclude`**: Running `/sandbox exclude` with no following pattern triggers an error. Always supply a quoted glob, e.g., `/sandbox exclude "npm run test:*"`.
3. **Expecting policy-locked settings to be changeable**: If an enterprise or higher-priority configuration has locked sandbox settings, `/sandbox` will refuse all mutations and display the policy-override error. The lock can only be lifted at the policy level.
4. **Running on an unsupported platform**: Sandbox features are currently restricted to macOS, Linux, and WSL2. Attempting use on Windows (native) or other OSes will be rejected before any configuration is read.
5. **Forgetting that `immediate: true` fires on keypress**: Because the command is registered with `immediate: true`, pressing Enter after `/sandbox` (with no arguments) immediately opens the interactive UI rather than waiting for a secondary confirmation step.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `GPf` | Main async handler for `/sandbox` (arbor_handler; AsyncFunction in module `wGl`) |
| `Lo` | Terminal color/theme dispatch function called for error rendering |
| `oLe` | Low-level color token-to-chalk mapper (resolves named colors, ansi256, rgb, hex) |
| `F7` | Color fallback helper called from `Lo` |
| `e` (top-level, +12862167) | Random/timer utility (Math.random + setTimeout) used within handler |
| `a` | MCP server state manager / apply-update orchestrator |
| `l6e` | MCP connection lifecycle manager (connect, disconnect, retry loop) |
| `V3` | MCP server registry / tool-list aggregator |
| `rct` | MCP tool-name resolver |
| `aX` | MCP server connection executor |
| `H6` | MCP server error collector |
| `m1n` | MCP warning/error color formatter |
| `ect` | MCP SSE/HTTP transport connection handler |
| `yF` | Object prototype creator for MCP state |
| `d` | Daemon supervisor update dispatcher |
| `BL` | MCP client state snapshot builder |
| `mg` | Config persistence helper |
| `eso` | MCP endpoint serializer |
| `Nn` | Notification/log push helper |
| `QBt` | MCP connection filter predicate |
| `fba` | MCP connection bootstrap function |
| `mao` | Auth-cache read helper |
| `hRe` | MCP server config hasher (sha256) |
| `iTn` | MCP tool schema normalizer |
| `aTn` | MCP tool schema augmenter |
| `tI` | Tool schema hash builder |
| `sTn` | Tool schema stringifier |
| `Zl` | Schema serialization utility |
| `sn` | MCP debug log emitter |
| `P1n` | MCP OAuth authentication flow initiator |
| `Tr` | OAuth transport resolver |
| `Hlp` | OAuth start-flow handler |
| `_lp` | OAuth callback-exchange handler |
| `e3t` | MCP reconnection scheduler |
| `qs` | AsyncLocalStorage store accessor |
| `GNn` | Auth-cache file path builder |
| `ke` | JSON stringify wrapper |
| `hso` | MCP connection health status writer |
| `be` | String coercion wrapper |
| `m` | MCP process kill orchestrator |
| `n` | Process name normalizer (toLowerCase) |
| `R` | Process write/signal dispatcher |
| `jL` | MCP skill registration dispatcher |
| `it` | Tool registration function |
| `Zoo` | MCP server list inclusion checker |
| `mn` | Global config save function |
| `w` | Background worker scheduler |
| `B7` | Worker blur/focus state tracker |
| `L` | Background worker sweep/lifecycle manager |
| `v` | Worker state machine |
| `KAc` | Worker queue tail accessor |
| `zAc` | Worker queue head accessor |
| `iu` | MCP error log emitter |
| `_ba` | Async iteration abort helper |
| `I8` | Async mapper/iterator with abort support |
| `Uct` | Numeric config parser (radix 10, +6994081) |
| `jNn` | Numeric config parser variant (radix 10, +6994179) |
| `Bcr` | MCP update applier / orphan disposer |
| `a6e` | MCP server config identity comparator |
| `oT` | MCP server cleanup coordinator |
| `s6e` | MCP server slot config comparator |
| `mSa` | MCP server IO bridge |
| `sio` | MCP server IO transport |
| `s` | Subscription set manager (add/delete/finally) |
| `i` | MCP connection close handler |
| `T` | Feature-flag evaluator |
| `qFc` | Feature-flag lookup function |
| `c7o` | Feature-flag config key resolver |
| `Lc` | REDACTED-path sanitizer for logging |
| `KXo` | Path map builder for redaction |
| `iYe` | Terminal output writer |
| `OXo` | Raw terminal write wrapper |
| `XFc` | Transcript/log file writer |
| `P7e` | Debounced log flush scheduler |
| `Ame` | Log line assembler |
| `jt` | Path join/resolve utility |
| `Cse` | File error handler (EISDIR/ENOENT) |
| `XXo` | Log file path builder |
| `nhr` | Atomic file rename helper |
| `YFc` | Append-file log writer |
| `Ei` | Signal/hook registration entry point |
| `l` | MCP worker adopter |
| `C8l` | Daemon status JSON writer |
| `iee` | Daemon directory resolver |
| `v7t` | Daemon status file path builder |
| `VWo` | MCP server remote-retry coordinator |
| `E1n` | MCP tool namespace collision detector |
| `Un` | Timeout-with-abort utility |
| `c` | Background session label factory |
| `u` | Daemon control dispatcher (stop/restart) |
| `we` | Daemon stop sender |
| `V` | IPC message sender |
| `Oe` | IPC channel selector |
| `Zze` | IPC channel name constant holder |
| `Re` | Daemon stop-failed sender |
| `R$` | Daemon restart handler |
| `h5` | Daemon restart executor |
| `GB` | Worker process spawner |
| `ZBe` | Existing-worker terminator |
| `EL` | Worker tool deregistration helper |
| `xGr` | Worker process creator (randomUUID) |
| `nCn` | Worker configuration builder |
| `u5` | Worker IPC key generator (randomBytes) |
| `Hj` | Graceful shutdown orchestrator |
| `Yhe` | Worker shutdown issuer |
| `oHe` | Shutdown timer clearer |
| `H9o` | Datadog metrics poster |
| `hJr` | Local settings reader for `/sandbox exclude` |
| `_n` | Settings loader entry point |
| `sun` | Settings cache lookup |
| `Szo` | Settings cache map accessor (Den.has/get) |
| `Svr` | Settings file reader (policySettings/flagSettings) |
| `Azo` | Settings cache writer (Den.set) |
| `yB` | Full settings object assembler |
| `mr` | Settings source resolver |
| `_Tt` | Settings merge helper |
| `Sfr` | Settings schema validator |
| `gTt` | Settings default injector |
| `MNe` | Settings normalizer |
| `DNe` | Settings deep-merge helper |
| `ETt` | Settings post-processor |
| `gie` | Settings migration helper |
| `VIe` | Settings version checker |
| `pun` | Settings encryption helper |
| `jHs` | Settings write-lock checker |
| `FZ` | Settings audit logger |
| `JLt` | Project/user settings loader |
| `I6d` | Exclude-rule pattern matcher (e.match) |
| `co` | Shell command watcher / process spawner |
| `dg` | Directory change watcher |
| `GIe` | Git process runner |
| `hv` | Gitignore file reader |
| `MZ` | File content reader with encoding |
| `In` | Error wrapper with code |
| `an` | File error code extractor |
| `wCr` | Timing tracker (gcn.set + Date.now) |
| `B$e` | Shell command spawner using settings |
| `run` | Shell command path resolver |
| `Qwt` | Atomic file write (writeFileSyncAndFlush) |
| `Md` | Real-path resolver |
| `mJe` | fsync error suppressor |
| `Ops` | File property definer |
| `PH` | Settings cache clearer (Den.clear / Xdr.clear) |
| `wgs` | Gitignore rule writer |
| `Pt` | Gitignore path builder |
| `uCr` | Gitignore section formatter |
| `ucn` | Gitignore check-ignore runner |
| `fSu` | Gitignore global excludes resolver |
| `Cgs` | Gitignore status reporter |
| `vgs` | Gitignore write helper |
| `U4` | `.claude` directory path builder |
| `vt` | IPC alternative sender |
| `dW` | Settings disk loader orchestrator |
| `xx` | Settings disk loader entry |
| `ia` | Memory usage sampler |
| `Avr` | Settings watcher / reload trigger |
| `Pen` | Settings reload debouncer |
| `xe` | Error log writer |
| `eo` | Error string formatter |
| `at` | String coercion for error codes |
| `Bi` | Error ring-buffer writer |
| `e_u` | Error ring-buffer shift/push manager |
| `kK` | Local settings JSON writer (final persist step for exclude rule) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.