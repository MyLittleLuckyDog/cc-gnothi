---
type: feature-spec
feature: "voice"
cc_version: "2.1.165"
updated: "2026-06-05"
tags: ["voice", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.165 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/voice`

> Analysis basis: CC v2.1.165 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.165

---

## Overview

The `/voice` command toggles voice mode in Claude Code, allowing users to switch between interaction sub-modes (`hold`, `tap`, or `off`). It validates account eligibility and feature availability before persisting the chosen mode to settings, emitting a telemetry event on each successful toggle.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `voice` |
| description | `Toggle voice mode` |
| argumentHint | `[hold\|tap\|off]` |
| supportsNonInteractive | `false` |
| isHidden | `null` |
| module_id | `h7K` |
| load_inline | `true` |
| loc_byte | `12971789` |
| loc_byte_end | `12972031` |
| loc_line | `9613` |
| arbor_handler.name | `upf` |
| arbor_handler.fqn | `claude-2.1.165::upf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.165 bundle.js:+12971789

---

## Input Branching

The command has 5+ distinct outcome paths based on account state, feature flag, argument value, and settings-write success. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A([/voice called]) --> B{Check login state\nvia voiceModeCheckLogin}
    B -- Not logged in --> C[Return error text:\n'Voice mode requires a Claude.ai\naccount. Please run /login to sign in.']
    B -- Logged in --> D{Check 'allow_voice_mode'\nfeature flag via featureFlagCheck}
    D -- Flag absent / false --> E[Return error text:\n'Voice mode is not available.']
    D -- Flag present --> F{Parse argument:\nhold | tap | off | empty}
    F -- Invalid token --> G[Return error text:\n'invalid']
    F -- 'off' or toggle-off --> H[Write voiceMode=off to settings]
    F -- 'hold' or 'tap' --> I{Check environment\nsupports voice}
    I -- Unsupported env --> J[Return error text:\n'Voice mode is not available\nin this environment.']
    I -- Supported --> K[Write voiceMode=hold/tap to settings]
    H --> L{Settings write\nsucceeded?}
    K --> L
    L -- Write failed --> M[Return error:\n'Failed to update settings.\nCheck your settings file for\nsyntax errors.']
    L -- Write succeeded --> N[Emit tengu_voice_toggled\ntelemetry event]
    N --> O{New mode = 'off'?}
    O -- Yes --> P[Return 'Voice mode disabled.']
    O -- No hold/tap --> Q{Microphone permission\ncheck / keybinding register}
    Q --> R[Return confirmation with\nkeybinding hint and mode name]
```

Analysis basis: CC v2.1.165 bundle.js:+12969243

---

## Behavioral Spec

### 1. Entry Point — `voiceCommandHandler` (`upf`)

The handler is an `AsyncFunction` resolved by Arbor via `module_id` path (`h7K`).

```
async function voiceCommandHandler(args, context):
    loginState  = getLoginState(context)            // calls zY
    featureFlags = loadFeatureFlags(context)         // calls e_

    if loginState is not authenticated:
        return textResult("Voice mode requires a Claude.ai account. Please run /login to sign in.")

    if not featureFlags.allow_voice_mode:
        return textResult("Voice mode is not available.")

    rawArg = parseArgument(args).trim()             // calls xpf, H.trim
    mode   = resolveVoiceMode(rawArg)               // "hold" | "tap" | "off" | "invalid"

    if mode == "invalid":
        return textResult("invalid")

    if mode == "off":
        writeResult = writeVoiceSetting(context, "off")   // calls r_
        if writeResult.error:
            return textResult("Failed to update settings. Check your settings file for syntax errors.")
        emit("tengu_voice_toggled", {mode: "off"})         // loc_byte 12969785
        return textResult("Voice mode disabled.")

    envSupported = checkVoiceEnvironmentSupport(context)   // calls BR6 / L
    if not envSupported:
        return textResult("Voice mode is not available in this environment.")

    writeResult = writeVoiceSetting(context, mode)
    if writeResult.error:
        return textResult("Failed to update settings. Check your settings file for syntax errors.")

    registerPushToTalkKeybinding(context)           // calls $P → voice:pushToTalk action
    emit("tengu_voice_toggled", {mode: mode})
    return textResult(buildConfirmationMessage(mode, micPermissionHint))
```

Analysis basis: CC v2.1.165 bundle.js:+12969243

---

### 2. Argument Parsing — `parseArgument` (`xpf`)

```
function parseArgument(rawInput):
    trimmed = rawInput.trim()
    VALID_MODES = {"hold", "tap", "off"}      // literals at +12969160, +12969172, +12969183
    if trimmed in VALID_MODES:
        return trimmed
    if trimmed == "":
        return currentVoiceModeSetting()      // toggle: read existing mode, flip
    return "invalid"                          // literal at +12969204
```

Analysis basis: CC v2.1.165 bundle.js:+12969113

---

### 3. Feature Flag Check — `featureFlagLoader` (`e_` → `DU`)

```
async function featureFlagLoader(context):
    startMark("loadSettingsFromDisk_start")     // literal at +1276855
    settings = loadSettingsFromDisk()           // calls Q6_, Kd
    endMark("loadSettingsFromDisk_end")         // literal at +1276911
    return settings.featureFlags               // includes "allow_voice_mode" key
```

The flag key `"allow_voice_mode"` is a string literal at bundle.js:+12959421.

Analysis basis: CC v2.1.165 bundle.js:+12969421

---

### 4. Settings Write — `settingsWriter` (`r_`)

```
async function settingsWriter(context, key, value):
    configPath  = resolveConfigPath(context)        // calls cO → HzH
    currentData = readFileAtomic(configPath)        // calls oP → Zr
    if currentData.parse_error:
        logTelemetry("tengu_config_parse_error")
        return {error: true}
    newData = merge(currentData, {[key]: value})
    atomicWrite(configPath, newData)               // calls TM6 (safe write w/ rename)
    invalidateCaches()                              // calls sz → clears Mm6, FF8
    reloadSettings(context)                         // calls DU
    emit("jFH")                                     // settings-changed event
    return {error: false}
```

The atomic write utility (`TM6`) uses `randomBytes` for a temp-file suffix, `fchmodSync` to preserve permissions, `fsyncSync` for durability, then `renameSync` as a final atomic swap.

Analysis basis: CC v2.1.165 bundle.js:+12969604

---

### 5. Keybinding Registration — `pushToTalkKeybinder` (`$P`)

```
function pushToTalkKeybinder(context):
    ACTION  = "voice:pushToTalk"          // literal at +12971053
    CONTEXT = "Chat"                      // literal at +12971072
    KEY     = "Space"                     // literal at +12971079

    if ACTION already in registeredActions:
        return                            // deduplication via S19.has / S19.add
    loadKeybindingConfig(context)         // calls DL8 → svH (reads keybindings.json)
    binding = resolveBinding(ACTION, CONTEXT, KEY)
    registerKeybinding(binding)           // calls wL8, w19, kCL
    emit("tengu_custom_keybindings_loaded")
```

Analysis basis: CC v2.1.165 bundle.js:+12971050

---

### 6. Environment / Microphone Hint

When voice mode is enabled (mode ≠ `"off"`), a platform-specific hint is appended to the confirmation message:

- On macOS: `"System Settings → Privacy & Security → Microphone"` (literal at +12970591)

This hint is displayed to guide the user to grant microphone permissions if not yet granted.

Analysis basis: CC v2.1.165 bundle.js:+12970571

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_voice_toggled` (emitted on every successful mode change; loc_byte +12969785) |
| Telemetry — feature gate OK | `tengu_feature_ok` (+1010222) — emitted by the feature-flag loader on success |
| Telemetry — feature gate bad | `tengu_feature_bad` (+1010284) — emitted on hard feature-check failure |
| Telemetry — feature gate sad | `tengu_feature_sad` (+1010365) — emitted on non-fatal feature anomaly |
| Telemetry — config parse error | `tengu_config_parse_error` (+3262552) — if settings JSON is malformed |
| Telemetry — keybinding loaded | `tengu_custom_keybindings_loaded` (+3868881) |
| Telemetry — keybinding fallback | `tengu_keybinding_fallback_used` (+3877919) |
| Settings file write | Persists `voiceMode` key to the user settings JSON (`settings.json` at `~/.claude/settings.json`) via atomic rename pattern |
| Cache invalidation | Clears in-memory settings caches (`Mm6`, `FF8`) via `sz` after each write |
| Event emission | Fires a `jFH` settings-changed event after successful write |
| Keybinding registration | Registers `voice:pushToTalk` action bound to `Space` in the `Chat` context when voice is enabled |
| supportsNonInteractive | `false` — command cannot run in non-interactive (piped/batch) sessions |

---

## Version History

| Version | Change |
|---|---|
| v2.1.165 | Initial analysis |

---

## Common Mistakes

1. **Omitting the argument** when intending a specific mode — without an argument, `/voice` toggles the current mode rather than setting a named mode explicitly. Pass `hold`, `tap`, or `off` to be explicit.
2. **Running without login** — voice mode requires a Claude.ai account. The command will fail before checking the argument if the user is not authenticated. Run `/login` first.
3. **Expecting non-interactive use** — `supportsNonInteractive: false` means `/voice` cannot be used in piped or scripted sessions; it silently rejects such invocations.
4. **Corrupt settings file** — if `settings.json` has syntax errors, the write will fail with a clear message, but the mode will not be changed. Fix the JSON before retrying.
5. **Assuming voice is universally available** — the `allow_voice_mode` feature flag must be present in the account's feature set; the command surfaces a distinct error when it is absent.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `upf` | Main voice command handler (AsyncFunction; Arbor primary entry) |
| `F96` | Voice capability resolution orchestrator |
| `N7A` | Login / account state checker |
| `zY` | Auth/login state resolver |
| `L4` | Auth helper (step-up / bare login) |
| `Bj` | OAuth token / profile resolver |
| `Z7` | First-party auth type resolver |
| `DO` | API key / auth environment validator |
| `Aw6` | Auth token composer |
| `JcH` | Auth error handler |
| `WZ` | Login state emitter |
| `uR6` | Feature availability check entry |
| `v7A` | Feature flag fetch dispatcher |
| `W9` | Feature flag lookup and cache coordinator |
| `rL9` | Remote feature flag fetcher |
| `TC` | Feature flag result parser |
| `Dq` | Essential traffic classifier |
| `e4H` | Feature flag error handler |
| `WIH` | Feature flag cache writer |
| `e_` | Feature-flag loader entry point |
| `DU` | Settings-from-disk loader (calls Q6_, Kd) |
| `nT` | Settings load start marker |
| `u9` | Memory usage sampler |
| `Ox` | `perf_hooks` module loader |
| `Q6_` | Full settings resolution pipeline |
| `j8` | Settings append-to-log helper |
| `D$6` | Flag-settings layer resolver |
| `bmA` | Policy settings loader |
| `HzH` | Settings path resolver |
| `qd` | User settings layer loader |
| `SmA` | SDK inline settings loader |
| `Kd` | Settings layer merger |
| `X_` | Config store accessor |
| `w$6` | WSL platform settings handler |
| `xpf` | Argument parser (trims and validates hold/tap/off) |
| `H` | Bootstrap fetch / raw config reader |
| `v` | Config key normalizer |
| `icK` | Config value parser |
| `SH` | JSON serializer helper |
| `J4` | Config key formatter |
| `ppH` | Config comment stripper |
| `acK` | Config file reader with byte-length check |
| `Gw_` | Command-line argument splitter |
| `ZHH` | Shell meta-character detector |
| `uj` | Shell escaper |
| `e1` | Argument expansion and alias resolver |
| `D6H` | Argument type discriminator |
| `Aq` | Model-alias resolver (opusplan/sonnet/haiku/opus/best) |
| `eX` | Expanded argument evaluator |
| `s6` | Settings read helper (sync) |
| `c` | Low-level config read |
| `P6` | Config path resolver |
| `r_` | Settings writer (atomic) |
| `cO` | Config path composer |
| `Q6` | Config file path helper |
| `g6_` | Full settings flush pipeline |
| `oP` | Safe file opener |
| `Zr` | Atomic file reader |
| `R$` | Real-path resolver |
| `xd6` | File path normalizer for config |
| `ud6` | BOM stripper |
| `R8` | ENOENT-aware error handler |
| `v8` | Generic error code checker |
| `pH_` | Settings timestamp recorder |
| `rTH` | Config reload trigger |
| `Xl6` | Settings directory resolver |
| `TM6` | Atomic file writer (randomBytes temp + rename) |
| `O` | Symlink/stat helper |
| `b8` | Background session sentinel |
| `sz` | In-memory settings cache invalidator |
| `vc6` | Git-ignore aware file writer |
| `b6` | Config store context getter |
| `bd6` | AsyncLocalStorage-based store reader |
| `GH_` | Global home-config path resolver |
| `A` | Lowercase path helper |
| `Nc6` | Git-check-ignore runner |
| `S_` | Git subprocess spawner |
| `zE4` | Path absolutizer (handles `~/` expansion) |
| `GxA` | Gitignore rule parser |
| `ExA` | Ignore-pattern evaluator |
| `Sx` | Settings directory path joiner |
| `hH` | Settings read (async, returns default on missing) |
| `RH` | Settings read (async, error on missing) |
| `kH` | Low-level error logger with rolling buffer |
| `HA` | Error string formatter |
| `eH` | String coercer |
| `qW4` | Rolling error-log ring buffer |
| `M` | MCP server manager entry |
| `AbH` | MCP connection orchestrator |
| `bl` | MCP server config loader |
| `wG6` | MCP server watcher |
| `ws` | MCP server connector |
| `Cl` | MCP SDK server lister |
| `uY8` | MCP server error formatter |
| `DG6` | MCP server deduplicator |
| `fk` | MCP tool registry |
| `oO` | Tool invocation dispatcher |
| `zb_` | Tool result serializer |
| `__` | Tool schema validator |
| `sk6` | MCP tool filter |
| `skq` | MCP tool hash/cache keyer |
| `Ae_` | MCP tool deduplication key builder |
| `VXH` | MCP tool object hasher (sha256) |
| `bY8` | MCP tool schema hasher |
| `xY8` | MCP server tool fetcher |
| `GP` | MCP tool list hasher |
| `RY8` | MCP result type mapper |
| `M4` | MCP result value extractor |
| `O8` | MCP debug logger |
| `ts_` | MCP transport session manager |
| `BKf` | MCP connection state machine |
| `Ad` | MCP auth result handler |
| `i1H` | MCP connection initializer |
| `r1H` | MCP connection retry scheduler |
| `o1H` | MCP OAuth server spin-up / token exchange |
| `r_6` | MCP in-flight request tracker |
| `D` | Process exit / abort controller |
| `_I8` | MCP needs-auth cache reader |
| `Sn` | MCP server reconnector |
| `yx` | MCP auth result classifier |
| `Y` | Supervisor config applier |
| `T7` | MCP error logger |
| `EH` | String error extractor |
| `FKf` | MCP connection finalizer |
| `UKf` | SSH environment detector for MCP |
| `es_` | MCP complete-authentication tool handler |
| `i_6` | In-flight nv8 request getter |
| `o_6` | In-flight iv8 request getter |
| `Myq` | MCP needs-auth cache poller |
| `N9` | AsyncLocalStorage store getter |
| `SI8` | MCP needs-auth cache path builder |
| `ss_` | MCP tool stream dispatcher |
| `Lb_` | MCP tool result builder |
| `X8` | Auth config safe-write guard |
| `j` | Background session killer |
| `R` | Background session lifecycle manager |
| `FN` | Tool execution dispatcher |
| `D6` | Tool skill tracker |
| `I` | Chokidar file watcher wrapper |
| `W6` | Nu6 config path helper |
| `S` | Background session write relay |
| `_yq` | MCP concurrency guard |
| `hB` | Promise/async utility (iterator, aggregate error) |
| `zA6` | MCP server count parser |
| `RI8` | MCP retry count parser |
| `eU8` | MCP connection result applier |
| `_bH` | MCP orphaned-connection disposer |
| `mk` | MCP server cleanup coordinator |
| `$A6` | MCP tool hash clearer |
| `$` | NKK → daemon status writer |
| `NKK` | Daemon status JSON writer |
| `nr` | Daemon log line builder |
| `JR6` | Daemon status file path builder |
| `IYA` | MCP remote-server retry monitor |
| `pY8` | MCP auth-cache membership checker |
| `l8` | Promise-with-abort-signal wrapper |
| `$P` | Push-to-talk keybinding registrar |
| `DL8` | Keybinding config loader entry |
| `svH` | Keybinding file parser and validator |
| `NG_` | Keybinding entry normalizer |
| `WB` | Keybinding tool skill emitter |
| `gLH` | Keybinding file path resolver |
| `B6` | JSON parser wrapper |
| `OL8` | Keybinding block structure validator |
| `fL8` | Keybinding entry expander |
| `T19` | Keybinding context builder |
| `ZG_` | Duplicate-key detector in keybinding JSON |
| `VG_` | Keybinding deduplication filter |
| `wL8` | Platform keybinding resolver |
| `hG_` | Platform key mapper |
| `yG_` | Key combination normalizer |
| `w19` | Keybinding display-label builder |
| `kCL` | Modifier-key label formatter |
| `lmH` | Language/locale detector |
| `y6` | File content watcher |
| `kX_` | File watch debouncer |
| `bDH` | Config file read/write with backup |
| `Ix` | BOM-prefix stripper |
| `Or1` | Config backup directory scanner |
| `bX_` | Backup path builder |
| `w` | Background subprocess manager |
| `vb8` | Background session memory sampler |
| `zX6` | Background session task file reader |
| `g` | Background process reaper |
| `VDA` | Background session IPC connector |
| `hDA` | Background session roster entry manager |
| `WTL` | File-watch lifecycle manager |
| `No` | File-watch change classifier |
| `j9` | zXA hook registrar |