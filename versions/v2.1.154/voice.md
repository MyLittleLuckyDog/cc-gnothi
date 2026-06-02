---
type: feature-spec
feature: "voice"
cc_version: "2.1.154"
updated: "2026-06-02"
tags: ["voice", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.154 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/voice`

> Analysis basis: CC v2.1.154 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.154

---

## Overview

The `/voice` command toggles voice input mode in Claude Code, allowing users to switch between `hold`, `tap`, and `off` interaction styles. It validates account eligibility and environment support before updating the voice-mode setting, and registers a push-to-talk keybinding (`Space` key in the `Chat` context) when enabled. The command is an async handler (`MY5`) resolved via module `pt1`.

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
| module_id | `pt1` |
| load_inline | `true` |
| loc_byte | `12660191` |
| loc_byte_end | `12660433` |
| loc_line | `9777` |
| arbor_handler.name | `MY5` |
| arbor_handler.fqn | `claude-2.1.154::MY5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.154 bundle.js:+12660191

---

## Input Branching

The command has more than 3 distinct branches based on argument value, account state, environment capability, and settings write outcome.

```mermaid
flowchart TD
    A(["/voice [arg]"]) --> B{Parse argument}
    B -->|"hold" / "tap" / "off"| C{Validate mode token}
    B -->|unrecognized or empty| D[Normalize: trim whitespace\nMap to hold/tap/off/invalid]
    D --> C
    C -->|"invalid"| ERR1[Return error: invalid mode]

    C -->|valid mode| E{Check account type}
    E -->|No Claude.ai account / not logged in| ERR2["Return text: 'Voice mode requires a Claude.ai account.\nPlease run /login to sign in.'"]
    E -->|allow_voice_mode flag absent or false| ERR3["Return text: 'Voice mode is not available.'"]

    E -->|allow_voice_mode = true| F{Mode = "off"?}
    F -->|yes| G[Write voiceMode = off to settings]
    G -->|write succeeds| H["Return text: 'Voice mode disabled.'"]
    G -->|write fails| ERR4["Return: 'Failed to update settings.\nCheck your settings file for syntax errors.'"]

    F -->|no: hold or tap| I{Environment supports voice?}
    I -->|no: SSH, unsupported OS, etc.| ERR5["Return text: 'Voice mode is not available in this environment.'"]
    I -->|yes| J[Write voiceMode = hold/tap to settings]
    J -->|write fails| ERR4
    J -->|write succeeds| K[Register keybinding: voice:pushToTalk\nContext=Chat, Key=Space]
    K --> L[Emit tengu_voice_toggled telemetry]
    L --> M{Microphone permission?}
    M -->|denied / unavailable| N["Append note: 'System Settings → Privacy & Security → Microphone'"]
    M -->|granted| O[Return confirmation to user]
    N --> O
```

Analysis basis: CC v2.1.154 bundle.js:+12657645, +12657656, +12657673, +12657686, +12657785, +12658006, +12658104, +12658242, +12658486, +12658993

---

## Behavioral Spec

### 1. Argument Parsing and Mode Validation

The handler `MY5` first trims the raw argument string and normalizes it against the accepted token set.

```
function parseVoiceMode(rawArg):
    trimmed = rawArg.trim()
    if trimmed in ["hold", "tap", "off"]:
        return trimmed
    else:
        return "invalid"
```

Accepted literal tokens: `"hold"` (bundle.js:+12657562), `"tap"` (bundle.js:+12657574), `"off"` (bundle.js:+12657585). An unrecognized token maps to `"invalid"` (bundle.js:+12657606).

Analysis basis: CC v2.1.154 bundle.js:+12657515 (trim call on `fY5`), +12657937 (trim call on `MY5`)

---

### 2. Account and Feature-Flag Eligibility Check

After argument validation, the handler calls `voiceModeEligibilityCheck` (identifier `V_6`) which internally invokes `checkVoiceAllowed` (identifier `B_A`) to consult the `allow_voice_mode` capability flag.

```
async function checkVoiceAllowed(appState):
    featureFlags = loadFeatureFlags(appState)      // v9 path
    if not hasVoiceAccount(appState):
        return { ok: false, reason: "no_account" }
    if not featureFlags.allow_voice_mode:
        return { ok: false, reason: "flag_absent" }
    return { ok: true }
```

- Flag key: `"allow_voice_mode"` (bundle.js:+12648128)
- No-account error message: `"Voice mode requires a Claude.ai account. Please run /login to sign in."` (bundle.js:+12657686)
- Flag-absent error message: `"Voice mode is not available."` (bundle.js:+12657785)
- The account check consults an internal profile resolver (`TY`) that distinguishes `"firstParty"` (bundle.js:+2044627) and OAuth/API-key profiles via `"user_oauth"` (bundle.js:+2942772) and `"ANTHROPIC_API_KEY"` (bundle.js:+2945727).

Analysis basis: CC v2.1.154 bundle.js:+12657645, +12648128, +12648170

---

### 3. Environment Support Check

When the mode is `"hold"` or `"tap"`, the handler calls `checkVoiceEnvironment` (identifier `IuL`), which inspects the runtime environment for SSH sessions and platform compatibility.

```
function checkVoiceEnvironment():
    if isSSHSession():           // l_.isSSH check
        return { supported: false }
    if not nativePlatformSupported():
        return { supported: false }
    return { supported: true }
```

- Unsupported environment message: `"Voice mode is not available in this environment."` (bundle.js:+12658486)
- SSH detection uses `l_.isSSH` (bundle.js:+10036806).

Analysis basis: CC v2.1.154 bundle.js:+12658411, +12658431, +12658486

---

### 4. Settings Write

The handler calls `writeVoiceSetting` (identifier `U_`) to persist the new voice mode value. This function reads and writes the user settings file (`settings.json` in the `.claude` directory), using an atomic write pattern (open → write → fsync → rename).

```
async function writeVoiceSetting(mode):
    try:
        currentSettings = readSettingsFromDisk()     // tB6 path
        currentSettings.voiceMode = mode
        atomicWriteSettings(currentSettings)          // $L6 path
        return { success: true }
    catch error:
        return { success: false, message: "Failed to update settings. Check your settings file for syntax errors." }
```

- Failure message: `"Failed to update settings. Check your settings file for syntax errors."` (bundle.js:+12658104)
- Settings path uses `.claude/settings.json` (bundle.js:+1218079, +1218089).
- Write ineffective code `"write_ineffective"` is logged when settings cannot be applied (bundle.js:+1227978).
- Global gitignore rule interaction is noted (`"gitignore_global_rule"`, bundle.js:+1227837).

Analysis basis: CC v2.1.154 bundle.js:+12658006, +12658104

---

### 5. Keybinding Registration

When voice mode is enabled (`hold` or `tap`), the handler calls `registerVoiceKeybinding` (identifier `ZX`) which ensures the push-to-talk action is bound.

```
function registerVoiceKeybinding():
    action = "voice:pushToTalk"
    context = "Chat"
    defaultKey = "Space"
    registerBinding(action, context, defaultKey)    // Uq8 / DD6 path
    // Falls back to default if custom keybindings file lacks this action
    // Emits tengu_keybinding_fallback_used if fallback is used
```

- Action literal: `"voice:pushToTalk"` (bundle.js:+12659455)
- Context literal: `"Chat"` (bundle.js:+12659474)
- Default key literal: `"Space"` (bundle.js:+12659481)
- Fallback telemetry: `tengu_keybinding_fallback_used` (bundle.js:+3809062)
- Custom keybindings file: `keybindings.json` (bundle.js:+3800123)

Analysis basis: CC v2.1.154 bundle.js:+12659452, +12659455, +12659481, +12659586

---

### 6. Off-Mode Disablement

When the argument is `"off"`, the handler skips environment checks and keybinding registration, writes `voiceMode = "off"` to settings, and returns the disabled confirmation.

```
async function handleVoiceOff():
    result = writeVoiceSetting("off")
    if not result.success:
        return errorMessage("Failed to update settings...")
    return textMessage("Voice mode disabled.")
```

- Disabled message: `"Voice mode disabled."` (bundle.js:+12658242)

Analysis basis: CC v2.1.154 bundle.js:+12658185, +12658242

---

### 7. Microphone Permission Advisory

After a successful enable, the handler calls `checkMicPermission` (identifier `O8`) and, if permission is absent or unknown, appends a platform-specific guidance string.

```
function appendMicPermissionNote(platform):
    if platform == "macos" and permissionDenied:
        appendNote("System Settings → Privacy & Security → Microphone")
```

- Advisory string: `"System Settings → Privacy & Security → Microphone"` (bundle.js:+12658993)

Analysis basis: CC v2.1.154 bundle.js:+12659913

---

### 8. Telemetry Emission

Upon any successful or failed voice mode toggle, the handler emits `tengu_voice_toggled`.

```
function emitVoiceToggleTelemetry(newMode, success):
    emit("tengu_voice_toggled", { mode: newMode, success: success })
```

Analysis basis: CC v2.1.154 bundle.js:+12658187

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_voice_toggled` (bundle.js:+12658187) — emitted on every toggle attempt; `tengu_keybinding_fallback_used` (bundle.js:+3809062) — emitted when push-to-talk falls back to default key; `tengu_custom_keybindings_loaded` (bundle.js:+3800029); `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` (bundle.js:+965176, +965234, +965311) — generic feature tracking |
| Settings write | Persists `voiceMode` field to `~/.claude/settings.json` via atomic rename; failure is surfaced as a user-visible error |
| Keybinding registration | Registers `voice:pushToTalk` → `Space` in the `Chat` context when enabling voice; no unregistration occurs automatically on disable |
| appState changes | Voice mode flag read from `allow_voice_mode` feature-flag store; mode value written back through settings loader (`U_` / `tB6`) |
| Sound | None detected in depth-2 traversal |
| microphone permission note | macOS-specific advisory appended to output when microphone access is not confirmed |

---

## Version History

| Version | Change |
|---|---|
| v2.1.154 | Initial analysis |

---

## Common Mistakes

1. **Running `/voice hold` without a Claude.ai account**: The command fails with a login prompt rather than toggling any setting. Sign in first with `/login`.
2. **Running `/voice hold` over SSH**: The environment check rejects voice activation in SSH sessions. Voice mode requires a local interactive terminal.
3. **Passing an unrecognized argument** (e.g., `/voice on` or `/voice enable`): Only the literal tokens `hold`, `tap`, and `off` are accepted; anything else is treated as `"invalid"`.
4. **Expecting instant microphone access on macOS**: Even after `/voice hold` succeeds, if the OS microphone permission has not been granted, CC will print an advisory pointing to System Settings. The setting is saved, but audio capture will fail until permission is granted.
5. **Expecting settings to persist across syntax errors**: If `settings.json` contains a pre-existing syntax error, the write will fail with a settings-file error message. Inspect and repair the file manually before toggling voice.
6. **Assuming `/voice off` also unregisters the keybinding**: Disabling voice mode writes the `off` value to settings but does not explicitly remove the `voice:pushToTalk` keybinding registered during a prior enable.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `MY5` | Main async handler for `/voice` command (arbor-resolved entry point) |
| `V_6` | Voice mode eligibility check orchestrator |
| `U_A` | Inner eligibility check (calls profile resolver and feature-flag checker) |
| `TY` | Authentication / profile resolver (distinguishes firstParty, OAuth, API-key) |
| `lK` | Profile type helper |
| `bP` | Auth state builder / credential assembler |
| `PO` | First-party profile resolver |
| `oJ` | OAuth token accessor |
| `u$` | API-key / credential validation function |
| `CO6` | Credential context helper |
| `kgH` | Config/context accessor |
| `RZ` | Feature-flag lookup helper |
| `II6` | Settings accessor called from eligibility check |
| `B_A` | `allow_voice_mode` flag checker |
| `v9` | Feature-flag reader (reads `allow_voice_mode`, `allow_product_feedback`, etc.) |
| `H89` | Feature-flag cache populator |
| `CR` | Plan/tier check (enterprise, team) |
| `q1` | Essential-traffic flag reader |
| `VKH` | Platform/context value accessor |
| `iD6` | Feature-flag item resolver |
| `i_` | Settings-load entry point (calls `vp`) |
| `vp` | Load-settings-from-disk orchestrator |
| `gE` | Settings pre-load guard |
| `T9` | Performance mark: `loadSettingsFromDisk_start` |
| `Kp` | `perf_hooks` require wrapper |
| `Bo8` | Core settings loader (reads flagSettings, policySettings, userSettings, etc.) |
| `I8` | Settings log writer (appends to log file) |
| `iR6` | Settings file reader helper |
| `oL6` | Settings layer merger (flagSettings / policySettings) |
| `zyA` | Settings key aggregator |
| `K$H` | Settings path builder (userSettings, projectSettings, localSettings) |
| `ng` | Settings watcher setup |
| `MyA` | SDK inline settings injector |
| `ig` | Settings object builder |
| `$_` | Config store accessor |
| `aL6` | WSL / platform config handler |
| `nR6` | Post-load settings normalizer |
| `fY5` | Argument token parser (trims and classifies hold/tap/off/invalid) |
| `H` | Random/timeout utility (used in retry logic) |
| `U_` | Settings write function (atomic write, gitignore rule check) |
| `wO` | Settings path + instance accessor |
| `Uo8` | Settings write coordinator |
| `zP` | File write safety wrapper |
| `Mi` | File reader with encoding detection (utf8 / utf16le BOM check) |
| `m3` | File stat / real-path resolver |
| `N` | Platform-aware text normalizer |
| `DB6` | Fallback file reader |
| `wB6` | Content slicer |
| `P8` | ENOENT error handler |
| `J8` | Error code classifier |
| `mr8` | Settings timestamp recorder (`LF6.set`) |
| `mGH` | Settings module path resolver |
| `nF6` | Settings directory path builder (`PN.resolve`) |
| `$L6` | Atomic file writer (open → write → fsync → rename, randomBytes for temp name) |
| `O` | Symbolic-link stat helper |
| `RH` | JSON serializer (`JSON.stringify`) |
| `Xz` | Settings cache clearer (`lR6.clear`, `Hu8.clear`) |
| `tB6` | Settings read-write driver (mkdir, readFile, writeFile, appendFile) |
| `C6` | Async store accessor (`zB6.getStore`) |
| `YB6` | Store/context resolver |
| `Tr8` | Settings integrity checker |
| `A` | String utility (toLowerCase, endsWith) |
| `sB6` | Git-ignore check helper (`W_`) |
| `W_` | Git check-ignore runner |
| `Pq4` | Global gitignore path resolver (handles `~/` prefix) |
| `oNA` | Git ls-files tracker check |
| `aNA` | Git-ignore append helper |
| `hb` | `.claude` directory path builder |
| `yH` | Feature telemetry: `tengu_feature_ok` |
| `c` | Core telemetry dispatcher |
| `t6` | Feature telemetry: `tengu_feature_sad` |
| `uH` | Feature telemetry: `tengu_feature_bad` |
| `hH` | Message queue / output emitter |
| `F_` | Error formatter |
| `xH` | String coercer |
| `D84` | Output buffer manager (LB6 shift/push) |
| `M` | MCP server manager / applier |
| `vSH` | MCP connection orchestrator |
| `v8H` | MCP server config processor |
| `hP6` | MCP server entry handler |
| `U7H` | MCP server connector (stdio, sse, http, plugin, dynamic) |
| `vc` | SDK MCP server builder |
| `hM8` | MCP server error formatter (red/yellow coloring) |
| `yP6` | SSE/HTTP MCP client connector |
| `Pk` | MCP permission checker |
| `GO` | MCP gate/approval handler |
| `Mk_` | MCP capability matcher |
| `H_` | MCP server name normalizer |
| `nV6` | MCP server list filter |
| `BpL` | MCP needs-auth cache loader |
| `pl_` | MCP cache path builder |
| `kM8` | MCP cache key hasher |
| `IM8` | MCP cache record builder |
| `CX` | SHA-256 hash helper |
| `NM8` | MCP tool name extractor |
| `oK` | AOq tool wrapper |
| `L8` | MCP debug logger |
| `pc_` | MCP OAuth flow handler |
| `yuL` | OAuth URL builder |
| `lg` | OAuth transport logger |
| `jAH` | MCP OAuth server / callback handler |
| `hH6` | MCP pending-auth map manager (`bT8`) |
| `D` | Agent loop / background session driver |
| `gT8` | MCP cache path builder variant |
| `Tl` | MCP reconnect orchestrator |
| `Vp` | OAuth transport accessor |
| `Y` | Supervisor output writer / spinner controller |
| `dL` | MCP error logger |
| `ZH` | String error formatter |
| `huL` | OAuth race-condition resolver |
| `IuL` | Voice/SSH environment check (uses `l_.isSSH`) |
| `Uc_` | MCP complete-authentication handler |
| `yH6` | MCP connection state getter (`CT8.get`) |
| `SH6` | MCP pending-auth state getter (`bT8.get`) |
| `j21` | MCP cache writer |
| `o9` | AsyncLocalStorage store accessor (`Fj7.getStore`) |
| `DZ8` | MCP cache file path builder |
| `mc_` | MCP tool call executor |
| `Ak_` | MCP tool capability applier |
| `O8` | Global config reader / microphone permission checker |
| `j` | Worker process killer |
| `y` | Worker process writer |
| `O21` | MCP protocol handler |
| `zo` | Stream/event multiplexer |
| `iV6` | Integer parser (tool timeout) |
| `Ul_` | Integer parser (connection count) |
| `JGK` | MCP connection result applier |
| `wZ8` | MCP update applier |
| `OrH` | MCP config hash builder |
| `ok` | MCP connection cleanup orchestrator |
| `dH6` | MCP connection hasher |
| `$` | Background session dispatcher |
| `bo1` | Daemon status file writer |
| `Si` | Daemon state tracker |
| `MI6` | Daemon status file path builder |
| `Gm5` | MCP server map rebuilder |
| `SM8` | MCP permission set checker |
| `Q8` | MCP retry timer |
| `ZX` | Keybinding registration entry point for voice |
| `Uq8` | Keybinding loader |
| `DD6` | Keybinding file parser and validator |
| `MJ_` | Keybinding config serializer |
| `kU` | Keybinding event emitter |
| `w4H` | Keybinding file path builder |
| `m6` | JSON parser wrapper |
| `uq8` | Keybinding structure validator (Array.isArray + every) |
| `Cq8` | Keybinding entry builder |
| `Saq` | Keybinding telemetry emitter (`tengu_custom_keybindings_loaded`) |
| `LJ_` | Keybinding duplicate detector |
| `fJ_` | Keybinding action filter and set builder |
| `Bq8` | Default keybinding fallback builder |
| `DJ_` | Default keybinding set constructor |
| `YJ_` | Default keybinding entry resolver |
| `tHH` | Keybinding map transformer |
| `YxH` | Locale/language normalizer (used for keybinding locale `"en"`) |
| `b6` | Global config state accessor |
| `vz_` | Config version checker |
| `bzH` | Config file reader/writer with backup logic |
| `kb` | Config key prefix stripper |
| `UBq` | Config backup directory manager |
| `Sz_` | Config backup path builder |
| `w` | Background session worker manager |
| `R` | Worker kill/write handler |
| `eI8` | macOS memory / n6 notifier |
| `FD6` | Background task file reader |
| `B` | Background session pool manager |
| `E6` | Auth state event emitter |
| `W5A` | Daemon claim / spawn handler |
| `N5A` | Background session lifecycle manager |
| `S` | Session disposal tracker |
| `Y17` | File watcher setup for config changes |
| `Mr` | Config migration helper |
| `_9` | Process exit handler registrar (`f$A.register`) |