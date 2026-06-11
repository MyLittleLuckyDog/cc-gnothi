---
type: feature-spec
feature: "voice"
cc_version: "2.1.167"
updated: "2026-06-11"
tags: ["voice", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.167 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/voice`

> Analysis basis: CC v2.1.167 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.167

---

## Overview

`/voice` toggles voice mode in Claude Code, cycling through three activation sub-modes (`hold`, `tap`, `off`). The command enforces authentication and feature-flag gates before mutating the persisted settings, and emits a keybinding registration for push-to-talk when voice is enabled. Voice mode is gated behind a Claude.ai account requirement and an `allow_voice_mode` permission flag.

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
| module_id | `J5K` |
| load_inline | `true` |
| loc_byte | `13008143` |
| loc_byte_end | `13008385` |
| loc_line | `9627` |
| arbor_handler.name | `OFf` |
| arbor_handler.fqn | `claude-2.1.167::OFf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.167 bundle.js:+13008143

---

## Input Branching

The handler processes 4+ distinct paths (authentication fail, feature-flag fail, explicit sub-mode argument, implicit toggle, environment unavailability), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/voice [arg]"] --> B{User has Claude.ai account?}
    B -- No --> C[Return error:\n'Voice mode requires a Claude.ai account.\nPlease run /login to sign in.']
    B -- Yes --> D{allow_voice_mode\npermission flag set?}
    D -- No --> E[Return error:\n'Voice mode is not available.']
    D -- Yes --> F[Parse argument via argParser]
    F --> G{Argument value?}
    G -- 'hold' --> H[Set voice mode = hold]
    G -- 'tap' --> I[Set voice mode = tap]
    G -- 'off' --> J[Disable voice mode]
    G -- empty/absent --> K{Current mode is off?}
    K -- Yes --> L[Set voice mode = hold\n(default enable)]
    K -- No --> J
    G -- unrecognized --> M[Return error: 'invalid']
    H --> N{Environment supports\nvoice?}
    I --> N
    L --> N
    N -- No --> O[Return error:\n'Voice mode is not available\nin this environment.']
    N -- Yes --> P[Persist setting via\nsettingsWriter]
    J --> Q[Persist: voice mode off]
    P --> R{Settings write\nsucceeded?}
    R -- No --> S[Return error:\n'Failed to update settings.\nCheck your settings file for\nsyntax errors.']
    R -- Yes --> T[Emit tengu_voice_toggled\ntelemetry]
    Q --> R
    T --> U{Mode is off?}
    U -- Yes --> V[Return message:\n'Voice mode disabled.']
    U -- No --> W[Register push-to-talk\nkeybinding: voice:pushToTalk\n→ Chat context, Space key]
    W --> X[Return success message\nwith microphone permission hint]
```

Analysis basis: CC v2.1.167 bundle.js:+13005545, +13005628, +13005639, +13005768, +13006194

---

## Behavioral Spec

### 1. Entry Point — Main Handler (`OFf`)

The main async handler is `OFf` (resolved via `module_id` → `J5K` by Arbor).

```
async function voiceCommandHandler(args, appState):
    // Step 1: Authentication gate
    authContext = getAuthContext(appState)           // calls xq6 → ux8 → GY
    if authContext.accountType is not Claude.ai:
        return textResult(
            "Voice mode requires a Claude.ai account. Please run /login to sign in."
        )

    // Step 2: Feature-flag gate
    if not checkPermission(appState, "allow_voice_mode"):  // literal at +12995805
        return textResult("Voice mode is not available.")

    // Step 3: Argument normalization
    rawArg = normalizeArg(args)                     // calls $Ff → H.trim at +13005889
    subMode = parseSubMode(rawArg)                  // valid values: "hold", "tap", "off"

    if subMode == "invalid":
        return textResult("invalid")

    // Step 4: Implicit toggle logic
    if subMode is absent:
        currentMode = readCurrentVoiceMode(appState)
        subMode = (currentMode == "off") ? "hold" : "off"

    // Step 5: Environment check
    if subMode != "off" and not environmentSupportsVoice():
        return textResult("Voice mode is not available in this environment.")

    // Step 6: Persist setting
    writeResult = await persistVoiceSetting(subMode)   // calls o_
    if writeResult.error:
        return textResult(
            "Failed to update settings. Check your settings file for syntax errors."
        )

    // Step 7: Telemetry
    emit("tengu_voice_toggled", { mode: subMode })      // +13006139

    // Step 8: Post-action
    if subMode == "off":
        return textResult("Voice mode disabled.")

    registerPushToTalkKeybinding()     // calls OP → voice:pushToTalk, Chat, Space
    return textResult(buildSuccessMessage(subMode))
```

Analysis basis: CC v2.1.167 bundle.js:+13005628, +13005806, +13005813, +13005822, +13005889, +13005958, +13006137, +13006284, +13007404

---

### 2. Authentication Context Fetch (`xq6` / `ux8` / `GY`)

```
function fetchAuthAndFeatureContext(appState):
    sessionInfo = getSessionInfo(appState)    // ux8 → GY
    featureFlags = loadFeatureFlags(appState) // VZ
    return { sessionInfo, featureFlags }
```

The call chain `xq6 → ux8 → GY` and `xq6 → SC6 → mx8 → X9` is responsible for loading the current auth state and evaluating the `allow_voice_mode` feature-flag check.

Analysis basis: CC v2.1.167 bundle.js:+13005628, +12995847, +12995854, +12995802

---

### 3. Sub-mode Argument Parser (`$Ff`)

```
function parseVoiceSubMode(rawInput):
    trimmed = rawInput.trim()     // H.trim at +13005498
    match trimmed:
        case "hold"    → return "hold"     // literal at +13005545
        case "tap"     → return "tap"      // literal at +13005557
        case "off"     → return "off"      // literal at +13005568
        case ""        → return null       // implicit toggle
        default        → return "invalid"  // literal at +13005589
```

Analysis basis: CC v2.1.167 bundle.js:+13005498, +13005545, +13005557, +13005568, +13005589

---

### 4. Settings Persistence (`o_`)

The settings writer (`o_`) handles atomic file writes for the user-settings layer:

```
async function persistVoiceSetting(subMode):
    settingsPath = resolveSettingsPath()     // o_ → d6, vZH.dirname
    currentSettings = loadSettingsFromDisk() // o_ → gU → ___ (loadSettingsFromDisk_start/end marks)
    updatedSettings = mergeVoiceSetting(currentSettings, subMode)

    try:
        atomicWrite(settingsPath, updatedSettings)   // o_ → $$6
        invalidateCaches()                           // o_ → LY (clears Yp6, HQ8)
        return { success: true }
    catch error:
        log("error", error)
        return { success: false, error: error }
```

The settings layer keys involved include `userSettings`, `localSettings`, and `projectSettings`.

Analysis basis: CC v2.1.167 bundle.js:+13005958, +1282460, +1282495, +1283205, +1277886

---

### 5. Keybinding Registration (`OP`)

When voice mode is enabled (not `off`), the handler registers a push-to-talk keybinding:

```
function registerPushToTalkKeybinding():
    keybindingAction = "voice:pushToTalk"   // literal at +13007407
    context = "Chat"                         // literal at +13007426
    key = "Space"                            // literal at +13007433

    registerKeybinding({
        action: keybindingAction,
        context: context,
        key: key,
    })
    // calls OP → W78 → hIH (keybinding loader) and G78 (formatter)
```

Analysis basis: CC v2.1.167 bundle.js:+13007404, +13007407, +13007426, +13007433

---

### 6. MCP State Refresh (`M` / `dDA` / `xbH`)

After settings are persisted, the handler triggers an MCP server state refresh:

```
function refreshMcpState(appState):
    mcpConfigs = getMcpConfigs(appState)   // M → L.get, L.values
    for each config in mcpConfigs:
        applyConnectionResult(config)       // xbH → XF8
    updateDaemonStatus()                   // $ → zLK
```

Analysis basis: CC v2.1.167 bundle.js:+13006713, +15879107, +15879117

---

### 7. Microphone Permission Hint (`OP`)

On macOS, the success message includes a hint about microphone permissions:

```
function buildSuccessMessage(subMode):
    hint = "System Settings → Privacy & Security → Microphone"  // literal at +13006945
    return formatMessage(subMode, hint)
```

Analysis basis: CC v2.1.167 bundle.js:+13006925, +13006945

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_voice_toggled` (loc +13006139); `tengu_feature_ok` (loc +1010950); `tengu_feature_bad` (loc +1011012); `tengu_feature_sad` (loc +1011093) |
| Settings mutation | Writes updated voice mode sub-mode (`hold`/`tap`/`off`) to user settings layer (settings.json at `~/.claude/settings.json`) |
| Cache invalidation | Clears two internal caches (`Yp6`, `HQ8`) via `LY` after write (loc +1283205) |
| Keybinding registration | Registers `voice:pushToTalk` action bound to `Space` in `Chat` context when enabling voice (loc +13007407) |
| MCP state | Triggers MCP connection state refresh via `dDA` → `xbH` after settings change |
| Telemetry (keybinding path) | `tengu_custom_keybindings_loaded` (loc +3875718); `tengu_keybinding_fallback_used` (loc +3884756) |
| Error output type | All user-facing errors and success messages are returned as `text` type results (literal `"text"` at +13005656) |
| appState changes | Voice mode field updated in persisted settings; in-memory state updated upon next settings load cycle |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.167 | Initial analysis |

---

## Common Mistakes

1. **Running without a Claude.ai account**: The command will return `"Voice mode requires a Claude.ai account. Please run /login to sign in."` (loc +13005669). You must authenticate with a Claude.ai account (not just an API key) before voice mode is available.

2. **Passing an unrecognized argument**: Only `hold`, `tap`, and `off` are valid sub-modes. Any other value results in an `"invalid"` error. The argument hint `[hold|tap|off]` is authoritative.

3. **Assuming `/voice` always enables voice**: Without an argument, the command toggles — if voice is currently active, it will disable it. Supply an explicit sub-mode to set a deterministic state.

4. **Ignoring the environment check**: Even with valid auth and permissions, voice mode may be unavailable in certain execution environments (e.g., non-interactive, SSH-only sessions). The command returns `"Voice mode is not available in this environment."` (loc +13006438) in that case.

5. **Not granting microphone permission on macOS**: The success message includes a hint directing users to `System Settings → Privacy & Security → Microphone` (loc +13006945); failing to grant this permission will result in voice capture not working even after the command succeeds.

6. **Settings file syntax errors**: If `~/.claude/settings.json` or related files contain JSON syntax errors, the write step will fail with `"Failed to update settings. Check your settings file for syntax errors."` (loc +13006056).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `OFf` | Main async handler for `/voice` command (entry point) |
| `xq6` | Auth-and-feature-flag context loader (called first by `OFf`) |
| `ux8` | Session info fetcher, called by `xq6` |
| `GY` | Auth context builder; constructs account-type object |
| `O4` | Auth type helper (depth 1 from `GY`) |
| `Bj` | Auth profile constructor; handles `profile-implicit`, `user_oauth` |
| `aL` | First-party auth checker |
| `pX` | Auth parameter accessor |
| `GO` | Auth resolver; handles `ANTHROPIC_API_KEY`, `apiKeyHelper`, `none` |
| `lw6` | Auth helper, calls `AlH` |
| `AlH` | Auth value formatter |
| `VZ` | Feature-flag loader; reads flag set from app state |
| `SC6` | Permission set accessor |
| `mx8` | `allow_voice_mode` feature-flag evaluator |
| `X9` | Permission resolution core; checks `pgL`, `UgL` maps |
| `Yf9` | Permission sub-flag handler |
| `cC` | Permission context builder |
| `$q` | Essential-traffic permission checker |
| `ILH` | Permission error reporter |
| `sIH` | Permission state resolver |
| `l_` | Settings load initiator (wraps `gU`) |
| `gU` | Settings loader — loads all layers and records perf marks |
| `aE` | Settings cache checker |
| `b9` | Memory usage tracker during settings load |
| `px` | `perf_hooks` module loader |
| `___` | Core settings assembly function; emits `settings_load_started` / `settings_load_completed` |
| `C8` | Settings file logger (appends to log file) |
| `wp6` | Settings warning accumulator |
| `e$6` | Flag-settings merger |
| `ipA` | Policy-settings loader |
| `NzH` | Settings path builder for `userSettings`, `projectSettings`, `localSettings` |
| `f` | Active-session set tracker |
| `Id` | User-settings file reader |
| `cpA` | SDK-inline-settings resolver |
| `kd` | Derived/computed settings builder; calls many sub-loaders |
| `W_` | WSL environment detector |
| `H36` | Computed settings helper |
| `Dp6` | Settings post-processor |
| `RC6` | Auth state accessor from app state |
| `$Ff` | Sub-mode argument parser (trims input, maps to `hold`/`tap`/`off`/`invalid`) |
| `H` | Config fetch/bootstrap utility |
| `v` | Config/settings value normalizer |
| `onK` | Config key normalizer |
| `RH` | JSON serializer helper |
| `G4` | Config value redaction helper |
| `EUH` | Config value encoder |
| `enK` | Config file write helper (handles Buffer encoding, file ops) |
| `Y3` | Bootstrap data parser |
| `uj_` | String splitter/trimmer for config values |
| `lHH` | Config cache lookup |
| `uj` | Config key replacer |
| `H9` | Settings model builder |
| `m6H` | Settings model tier selector (`opusplan`, `sonnet`, `haiku`, `opus`, `best`) |
| `s9` | Settings model name normalizer |
| `FJ` | Settings model resolver |
| `o6` | Telemetry feature emitter (emits `tengu_feature_ok/bad/sad`) |
| `l` | Telemetry logger base |
| `J6` | Telemetry event dispatcher |
| `o_` | Settings writer (atomic write, cache invalidation, git-ignore check) |
| `eO` | Settings context resolver for write |
| `d6` | Debug logger |
| `H__` | Settings write orchestrator |
| `oP` | File-path resolver for settings write |
| `Br` | File reader with encoding detection (UTF-8/UTF-16) |
| `g$` | Real-path resolver |
| `pc6` | Path canonicalizer |
| `Uc6` | BOM stripper |
| `h8` | ENOENT handler |
| `V8` | Error code extractor |
| `t6_` | Settings write timestamp recorder |
| `IZH` | Settings write path validator |
| `Vn6` | Settings path resolver (`.claude` directory) |
| `$$6` | Atomic file-write implementation |
| `O` | Symbolic-link status checker |
| `LY` | Cache invalidator (clears `Yp6` and `HQ8`) |
| `yl6` | Git-ignore / settings write guard |
| `u6` | Async-context store accessor |
| `mc6` | Context store helper |
| `x6_` | Git-status checker |
| `kl6` | Git-ignore checker |
| `C_` | Git command runner |
| `PZ4` | Path expander (handles `~/` and absolute paths) |
| `kuA` | Custom gitignore reader |
| `yuA` | Git-ignore write helper |
| `qu` | Settings path joiner (`.claude/settings.json`) |
| `SH` | Success message renderer |
| `CH` | Error message renderer |
| `hH` | Queue-based async operation dispatcher |
| `AA` | Error normalizer |
| `_6` | String converter |
| `zG4` | Queue manager (shift/push on `Sc6`) |
| `M` | MCP state manager (top-level) |
| `xbH` | MCP connection orchestrator |
| `sl` | MCP server list builder |
| `AT6` | MCP server entry formatter |
| `bs` | MCP server batch connector |
| `al` | MCP server entry collector |
| `dD8` | MCP error formatter (red/yellow coloring) |
| `_T6` | MCP transport-type router (`sse`, `http`, `stdio`) |
| `Ik` | MCP capability checker |
| `qz` | MCP client validator |
| `bx_` | MCP client binding |
| `a8` | MCP server identifier |
| `cy6` | MCP connection filter |
| `yhq` | MCP health-check runner |
| `VHA` | MCP server version checker |
| `tXH` | MCP config hasher (SHA-256) |
| `pD8` | MCP tool-list hasher |
| `UD8` | MCP update detector |
| `EP` | MCP entry-point hasher |
| `uD8` | MCP diff calculator |
| `z4` | MCP primitive helper |
| `M8` | MCP debug logger |
| `Dk8` | MCP single-server connector |
| `$7f` | MCP server config extractor |
| `vd` | MCP auth token holder |
| `X9H` | MCP claudeai-proxy connector |
| `P9H` | MCP connection parameter builder |
| `W9H` | MCP OAuth flow runner |
| `QA6` | MCP pending-connection tracker |
| `jk8` | MCP cache key builder |
| `an` | MCP reconnect handler |
| `Au` | MCP auth-token accessor |
| `Y` | MCP supervisor state updater |
| `v7` | MCP error logger |
| `GH` | String coercer |
| `O7f` | MCP connection timeout racer |
| `M7f` | MCP SSH/URL type checker |
| `wk8` | MCP tool-list fetcher |
| `gA6` | MCP queued-request getter |
| `dA6` | MCP pending-request getter |
| `mhq` | MCP needs-auth cache reader |
| `V9` | Async-local-storage context getter |
| `dk8` | MCP cache file path builder (`mcp-needs-auth-cache.json`) |
| `Ee_` | MCP error state recorder |
| `j` | Process kill helper |
| `S` | Background worker manager |
| `tN` | MCP skills telemetry emitter (`tengu_mcp_skills`) |
| `D6` | MCP skills data builder |
| `yx_` | MCP tool change detector |
| `X8` | Global config saver |
| `k` | File watcher spawner (chokidar) |
| `P6` | Process launcher |
| `R` | Output writer |
| `Chq` | MCP port parser |
| `AF` | Async iterable mapper |
| `K16` | MCP port parser (parseInt wrapper) |
| `ck8` | MCP retry-count parser (parseInt wrapper) |
| `XF8` | MCP connection result applier |
| `bbH` | MCP config-change detector |
| `_y` | MCP cleanup runner |
| `A16` | MCP config hash updater |
| `$` | Daemon status updater |
| `zLK` | Daemon status writer |
| `Yo` | Daemon status serializer |
| `zC6` | Daemon status file path builder (`daemon.status.json`) |
| `dDA` | MCP remote-server retry manager |
| `lD8` | MCP server suppression checker |
| `r8` | Timeout utility with abort |
| `OP` | Keybinding registration caller (registers `voice:pushToTalk`) |
| `W78` | Keybinding loader (reads `keybindings.json`) |
| `hIH` | Keybinding config parser |
| `BT_` | Keybinding block validator |
| `cB` | Keybinding context resolver |
| `X7H` | Keybinding file path builder |
| `U6` | JSON parse wrapper |
| `J78` | Keybinding binding-array validator |
| `D78` | Keybinding entry flattener |
| `U99` | Keybinding default-action table |
| `pT_` | Keybinding duplicate detector |
| `UT_` | Keybinding action-list builder |
| `G78` | Keybinding formatter |
| `cT_` | Keybinding context formatter |
| `dT_` | Keybinding display builder |
| `S99` | Keybinding display formatter |
| `pxL` | Keybinding modifier-key formatter |
| `SpH` | Language/locale checker (checks `en` locale and `MPA` set) |
| `C6` | Config file watcher setup |
| `lP_` | Config watcher path resolver |
| `LwH` | Config file reader with backup/copy logic |
| `Hu` | Config path prefix stripper |
| `Vo1` | Config directory scanner |
| `sP_` | Config backup path builder |
| `IVL` | Config file watch registrar (uses `HK8.watchFile`) |
| `co` | Config change debouncer |
| `j9` | VPA hook registrar |
| `w` | Background worker session manager |
| `cx8` | Background worker low-memory checker |
| `tX6` | Background task-queue reader |
| `Q` | Background worker process manager |
| `mwA` | Background spare-worker claimer |
| `QwA` | Background worker lifecycle manager |
| `B` | Background worker shutdown handler |