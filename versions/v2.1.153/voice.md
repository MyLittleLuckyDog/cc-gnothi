---
type: feature-spec
feature: "voice"
cc_version: "2.1.153"
updated: "2026-06-02"
tags: ["voice", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.153 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/voice`

> Analysis basis: CC v2.1.153 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.153

---

## Overview

The `/voice` command toggles the voice interaction mode for Claude Code, allowing users to switch between hold-to-talk, tap-to-talk, and disabled (off) sub-modes. It validates account eligibility and feature availability before applying the requested mode, persisting the setting to user configuration on disk.

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
| module_id | `Ms1` |
| load_inline | `true` |
| loc_byte | `12614332` |
| loc_byte_end | `12614574` |
| loc_line | `9767` |
| arbor_handler.name | `m$5` |
| arbor_handler.fqn | `claude-2.1.153::m$5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.153 bundle.js:+12614332

---

## Input Branching

The command has 5+ distinct branches depending on account state, feature flags, argument value, and environment capability. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/voice [arg]"] --> B{Parse argument\nvia argumentParser}
    B --> C{Argument is\n'hold', 'tap', 'off',\nor empty?}
    C -- invalid string --> D["Return error: 'invalid' mode\n(bundle.js:+12611747)"]
    C -- valid or empty --> E{Check login:\nvoice requires\nClaude.ai account}
    E -- not logged in --> F["Return text:\n'Voice mode requires a Claude.ai account.\nPlease run /login to sign in.'\n(bundle.js:+12611827)"]
    E -- logged in --> G{Check feature flag:\nallow_voice_mode\n(bundle.js:+12602269)}
    G -- flag disabled globally --> H["Return text:\n'Voice mode is not available.'\n(bundle.js:+12611926)"]
    G -- flag enabled --> I{Argument is 'off'\nor toggling off?}
    I -- off --> J["Persist voiceMode=off\nto settings on disk"]
    J --> K["Return text:\n'Voice mode disabled.'\n(bundle.js:+12612383)"]
    I -- hold or tap --> L{Check environment\nsupports voice}
    L -- environment unsupported --> M["Return text:\n'Voice mode is not available\nin this environment.'\n(bundle.js:+12612627)"]
    L -- supported --> N["Persist voiceMode setting\nvia settingsWriter (g_)"]
    N --> O{Settings write\nsucceeded?}
    O -- failure --> P["Return text:\n'Failed to update settings.\nCheck your settings file for\nsyntax errors.'\n(bundle.js:+12612245)"]
    O -- success --> Q["Emit tengu_voice_toggled\ntelemetry event\n(bundle.js:+12612328)"]
    Q --> R{Keybinding\nregistration for\nvoice:pushToTalk?}
    R -- keybinding found --> S["Register/update push-to-talk\nkeybinding: Space in Chat context\n(bundle.js:+12613596, +12613622)"]
    R -- none --> T["Return confirmation\nwith active mode"]
    S --> T
```

Analysis basis: CC v2.1.153 bundle.js:+12611703, +12611715, +12611726, +12611747, +12611786, +12611797, +12611827, +12611926, +12612011, +12612078, +12612147, +12612245, +12612326, +12612383, +12612473, +12612552, +12612627, +12613593

---

## Behavioral Spec

### Top-level Handler (`m$5`)

The main async handler, resolved by Arbor via `module_id` path, orchestrates all sub-operations.

```
async function voiceCommandHandler(args, context):
    // 1. Parse and validate sub-mode argument
    rawArg = args.trim()                          // bundle.js:+12612078
    mode = parseVoiceMode(rawArg)                 // bundle.js:+12612011

    if mode == "invalid":
        return textResult("invalid mode message")

    // 2. Verify account login status
    loginState = getAppState()                    // bundle.js:+12611797
    if not loginState.isLoggedIn:
        return textResult("Voice mode requires a Claude.ai account…")
                                                  // bundle.js:+12611827

    // 3. Check feature flag allow_voice_mode
    settings = loadSettings()                     // bundle.js:+12602269
    if not settings.allow_voice_mode:
        return textResult("Voice mode is not available.")
                                                  // bundle.js:+12611926

    // 4. Handle explicit 'off'
    if mode == "off":
        ok = writeVoiceSetting("off")             // bundle.js:+12612383
        if not ok:
            return textResult("Failed to update settings…")
        return textResult("Voice mode disabled.")

    // 5. Check environment capability
    envSupported = checkVoiceEnvironment()        // bundle.js:+12612552, +12612572
    if not envSupported:
        return textResult("Voice mode is not available in this environment.")
                                                  // bundle.js:+12612627

    // 6. Persist setting
    ok = writeVoiceSetting(mode)                  // bundle.js:+12612147
    if not ok:
        return textResult("Failed to update settings…") // bundle.js:+12612245

    // 7. Emit telemetry
    emit("tengu_voice_toggled", { mode })         // bundle.js:+12612328

    // 8. Register push-to-talk keybinding if applicable
    if mode in ["hold", "tap"]:
        registerKeybinding(
            action = "voice:pushToTalk",          // bundle.js:+12613596
            context = "Chat",                     // bundle.js:+12613615
            key = "Space"                         // bundle.js:+12613622
        )

    // 9. Resolve MCP state (f / Qb5) for context refresh
    await refreshMcpContext()                     // bundle.js:+12612902, +12613114

    return confirmationResult(mode)
```

Analysis basis: CC v2.1.153 bundle.js:+12611786, +12611797, +12611964, +12612011, +12612078, +12612147, +12612326, +12612443, +12612473, +12612552, +12612683, +12612902, +12613114

---

### Argument Parsing (`u$5`)

```
function parseVoiceMode(rawArg):
    trimmed = rawArg.trim()                   // bundle.js:+12611656
    if trimmed == "hold":  return "hold"      // bundle.js:+12611703
    if trimmed == "tap":   return "tap"       // bundle.js:+12611715
    if trimmed == "off":   return "off"       // bundle.js:+12611726
    if trimmed == "":      return null        // default toggle
    return "invalid"                          // bundle.js:+12611747
```

Analysis basis: CC v2.1.153 bundle.js:+12611656, +12611703, +12611715, +12611726, +12611747

---

### Feature Flag Check (`N8A` / `X9`)

```
function checkAllowVoiceMode(settings):
    flagValue = settings.get("allow_voice_mode") // bundle.js:+12602269
    return flagValue == true
```

The flag `allow_voice_mode` is read from the policy/settings layer via `X9` (settingsAccessor) using `allow_product_feedback` adjacency.
`allow_voice_mode` at bundle.js:+12602269; `allow_product_feedback` at bundle.js:+4096201.

Analysis basis: CC v2.1.153 bundle.js:+12602266, +12602269, +12602311, +12602318, +12602325

---

### Login State Check (`Hw` / `RP`)

The login check calls the app-state reader (`Hw`) which delegates to `RP` for credential validation. It checks for:
- `ANTHROPIC_API_KEY` environment variable (bundle.js:+2942830)
- OAuth token (`CLAUDE_CODE_OAUTH_TOKEN`)
- WIF environment variables (`ANTHROPIC_FEDERATION_RULE_ID` + `ANTHROPIC_ORGANIZATION_ID`)

If none are present, the error "ANTHROPIC_API_KEY, CLAUDE_CODE_OAUTH_TOKEN, or WIF env vars … required" is raised internally (bundle.js:+2943258), but the `/voice` handler surfaces the friendlier login prompt.

```
function checkLoginRequired(appState):
    credentials = appState.getCredentials()    // bundle.js:+2940811, +2940909
    if credentials == null or credentials.type == "none":
        return false
    return true
```

Analysis basis: CC v2.1.153 bundle.js:+12611797, +2940811, +2940909, +2942830, +2942963, +2943258

---

### Settings Writer (`g_`)

The settings writer persists the new voice mode to disk. It:
1. Resolves the user settings path (`~/.claude/settings.json`) (bundle.js:+1216444, +1216454)
2. Reads existing settings from disk (bundle.js:+1075240)
3. Merges `voiceMode` key
4. Checks gitignore rules before write (bundle.js:+1226202)
5. Atomically writes via rename (bundle.js:+1011768)
6. On parse/write error, returns failure so the handler can surface "Failed to update settings." (bundle.js:+12612245)

```
async function writeVoiceSetting(mode):
    settingsPath = resolveSettingsPath()        // ~/.claude/settings.json
    existing = readSettingsFromDisk(settingsPath)
    if existing == parse_error:
        return false
    merged = { ...existing, voiceMode: mode }
    ok = atomicWrite(settingsPath, merged)
    return ok
```

Analysis basis: CC v2.1.153 bundle.js:+12612147, +1216444, +1216454, +1075240, +1075585, +1011768, +12612245

---

### Push-to-Talk Keybinding Registration (`JX` / `Wq8` / `nY6`)

When voice mode is set to `hold` or `tap`, the handler registers (or re-registers) the push-to-talk keybinding:

```
function registerPushToTalkKeybinding():
    action  = "voice:pushToTalk"     // bundle.js:+12613596
    context = "Chat"                 // bundle.js:+12613615
    key     = "Space"                // bundle.js:+12613622

    keybindingConfig = loadKeybindingConfig()   // bundle.js:+3793039
    if keybindingConfig has action:
        return existing binding
    else:
        register({ context, key, action })
        emit("tengu_keybinding_fallback_used")  // if default used
```

The keybinding configuration is read from `keybindings.json` (bundle.js:+3791292). Invalid formats emit `tengu_keybinding_fallback_used` (bundle.js:+3800231).

Analysis basis: CC v2.1.153 bundle.js:+12613593, +12613596, +12613615, +12613622, +3791292, +3800231

---

### Microphone Permission Hint

When environment capability fails, the error message references macOS system settings:
`"System Settings → Privacy & Security → Microphone"` (bundle.js:+12613134)

This string is surfaced in the "not available in this environment" path for macOS users.

Analysis basis: CC v2.1.153 bundle.js:+12613134

---

### MCP Context Refresh (`f` / `Qb5`)

After a successful voice mode change, the handler invokes a general MCP context refresh cycle (bundle.js:+12612902, +12613114). This re-evaluates connected MCP server states but does not block the voice mode confirmation response.

Analysis basis: CC v2.1.153 bundle.js:+12612902, +12613114

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_voice_toggled` | Emitted on every successful voice mode change (bundle.js:+12612328) |
| Telemetry: `tengu_feature_ok` | Emitted on successful feature gate pass (bundle.js:+965124) |
| Telemetry: `tengu_feature_sad` | Emitted on feature gate soft failure (bundle.js:+965259) |
| Telemetry: `tengu_feature_bad` | Emitted on feature gate hard failure (bundle.js:+965182) |
| Telemetry: `tengu_keybinding_fallback_used` | Emitted when default push-to-talk keybinding is used (bundle.js:+3800231) |
| Telemetry: `tengu_custom_keybindings_loaded` | Emitted when user keybindings.json is loaded (bundle.js:+3791198) |
| Telemetry: `tengu_config_parse_error` | Emitted if settings file has syntax errors (bundle.js:+3206730) |
| Settings write | `~/.claude/settings.json` updated with `voiceMode` key on success |
| Keybinding registration | `voice:pushToTalk` → Space key in Chat context, registered when mode is `hold` or `tap` |
| appState changes | Voice mode state updated in memory after successful disk write |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.153 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/voice` without a Claude.ai login**: The command explicitly requires a logged-in Claude.ai account (`CLAUDE_CODE_OAUTH_TOKEN` or equivalent). API-key-only authentication will not pass the login check, and the user will see the "Please run /login" message.
2. **Expecting `/voice` to work in all environments**: The `allow_voice_mode` feature flag must be enabled server-side. In environments where Anthropic has not enabled this flag, the command always returns "Voice mode is not available." regardless of argument.
3. **Passing an unrecognised sub-mode**: Only `hold`, `tap`, and `off` are valid argument values. Any other string is classified as `"invalid"` and the command will not apply any change.
4. **Corrupted `settings.json`**: If the settings file has JSON syntax errors, the write will fail and the user sees "Failed to update settings. Check your settings file for syntax errors." The voice mode will not be changed.
5. **Expecting microphone access without OS permission**: On macOS, if the microphone permission is not granted, voice mode activation fails with a pointer to `System Settings → Privacy & Security → Microphone`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `m$5` | Main async voice command handler (Arbor-resolved entry point) |
| `Z_6` | Feature-gate and settings check dispatcher |
| `v8A` | Voice availability pre-check (login + flag) |
| `Hw` | App state reader / credential loader |
| `UK` | Credential/token getter |
| `RP` | Auth validation and credential resolution |
| `FO` | First-party auth type checker |
| `cJ` | Config context accessor |
| `m$` | Auth requirement enforcer (throws on missing credentials) |
| `JO6` | Grouped state helper |
| `GgH` | State field getter |
| `yZ` | Essential-traffic flag checker |
| `Ok6` | Feature flag reader (allow_voice_mode adjacent) |
| `N8A` | Settings feature-flag accessor |
| `X9` | Settings key lookup |
| `bH9` | Settings cache accessor |
| `TR` | Settings tier resolver (enterprise/team) |
| `_1` | Allow-product-feedback gate |
| `JKH` | String conversion helper for settings |
| `kD6` | Settings read-through with tier logic |
| `u$5` | Argument parser for voice sub-mode |
| `H` | Miscellaneous utility (random, setTimeout, lstat) |
| `g_` | Settings writer (persists voiceMode to disk) |
| `YO` | Settings path + telemetry bundler |
| `B6` | Base config path resolver |
| `lr8` | Settings load orchestrator |
| `$P` | Gitignore-aware path filter |
| `tn` | File reader with encoding detection |
| `R3` | Real-path resolver (FIFO/socket check) |
| `N` | Path normaliser / environment resolver |
| `sU6` | File read helper |
| `tU6` | BOM/encoding slicer |
| `X8` | Error-code classifier |
| `J8` | ENOENT guard |
| `li8` | Cache timestamp setter |
| `hGH` | Settings-file path + load trigger |
| `SF6` | Settings file resolver |
| `c76` | Atomic file writer (rename-based) |
| `O` | Symbolic-link checker |
| `N8` | Stopped-state marker |
| `RH` | JSON serialiser |
| `Xz` | Cache clear on settings reload |
| `pB6` | Git-ignore integration for settings |
| `S6` | Async context store reader |
| `aU6` | Context store getter |
| `hi8` | Path helper P4 |
| `A` | String lowercase helper |
| `mB6` | Git check-ignore runner |
| `G_` | Git command executor |
| `v_4` | Home-dir path expander |
| `nvA` | Git already-tracked checker |
| `ivA` | Write-ineffective marker |
| `Tb` | Settings path joiner (.claude dir) |
| `SH` | Feature telemetry ok emitter |
| `c` | Core telemetry dispatcher |
| `e6` | Feature telemetry sad emitter |
| `uH` | Feature telemetry bad emitter |
| `yH` | Message queue pusher |
| `l_` | Error string extractor |
| `xH` | String coercer |
| `GH4` | Message queue rotator |
| `f` | MCP context state accessor |
| `YSH` | MCP server orchestrator |
| `O8H` | MCP server config builder |
| `zP6` | MCP connection config |
| `h7H` | MCP server connector |
| `Oc` | SDK MCP entry builder |
| `Kf8` | MCP error formatter |
| `OP6` | SSE/HTTP MCP connection handler |
| `nV` | MCP transport wrapper |
| `XO` | MCP transport dispatcher |
| `YN_` | MCP transport type mapper |
| `e8` | MCP underscore helper |
| `yV6` | MCP version checker |
| `RuL` | MCP connection initialiser |
| `uc_` | MCP client factory |
| `_f8` | MCP object-key inspector |
| `Af8` | MCP tool hash generator |
| `kX` | SHA-256 hasher |
| `Hf8` | MCP connection quality checker |
| `QK` | MCP quality-key builder |
| `f8` | MCP debug logger |
| `ud_` | MCP server connection manager |
| `TbL` | MCP server table |
| `Vg` | MCP process context |
| `HAH` | MCP OAuth server handler |
| `VH6` | MCP pending-request map |
| `D` | Daemon spare-worker dispatcher |
| `zT8` | MCP client-state checker |
| `VB` | MCP reconnect orchestrator |
| `_p` | CK process context accessor |
| `Y` | Supervisor config updater |
| `PL` | MCP error logger |
| `EH` | Error string coercer |
| `ZbL` | MCP timeout factory |
| `GbL` | SSH environment checker |
| `md_` | MCP server disconnector |
| `EH6` | AT8 connection-state getter |
| `vH6` | qT8 pending-request getter |
| `aX1` | MCP connection awaiter |
| `r9` | Request context store getter |
| `uT8` | MCP needs-auth cache path builder |
| `bd_` | MCP auth-cache writer |
| `MN_` | MCP server name resolver |
| `K8` | Global config accessor |
| `j` | Background worker set |
| `y` | Background worker process |
| `nX1` | Concurrent mapper |
| `ar` | Async iterator / event listener |
| `hV6` | MCP port parser (parseInt) |
| `mc_` | MCP port parser variant |
| `EWK` | MCP update applier |
| `mT8` | MCP tool serialiser |
| `BI` | MCP cleanup orchestrator |
| `pH6` | MCP log serialiser |
| `$` | Daemon background context manager |
| `Ar1` | Daemon status writer |
| `Zi` | Daemon status v1 formatter |
| `dI6` | Daemon status path builder |
| `Qb5` | MCP full refresh driver |
| `Lf8` | MCP filtered-set checker |
| `r8` | Socket connection helper |
| `JX` | Keybinding loader and registrar |
| `Wq8` | Keybinding config wrapper |
| `nY6` | Keybinding config file parser |
| `Oj_` | Keybinding schema validator |
| `_U` | Keybinding default registry |
| `L4H` | Keybinding file path builder |
| `U6` | JSON parse wrapper |
| `Jq8` | Keybinding array validator |
| `Dq8` | Keybinding object-entries flattener |
| `Ooq` | Keybinding telemetry emitter (custom loaded) |
| `fj_` | Duplicate keybinding detector |
| `$j_` | Keybinding block builder |
| `Gq8` | Keybinding fallback registrar |
| `jj_` | Keybinding fallback builder |
| `wj_` | Keybinding gdH formatter |
| `UHH` | Keybinding map helper |
| `qxH` | Language/locale normaliser |
| `b6` | Config file watcher |
| `CO_` | Config path constant |
| `EzH` | Config reader (readFileSync + parse) |
| `Pb` | Path prefix stripper |
| `UUq` | Config backup directory scanner |
| `UO_` | Config backup path builder |
| `w` | Daemon background session manager |
| `R` | Background worker killer |
| `wk8` | Memory threshold checker (macOS) |
| `TD6` | Config update reader |
| `B` | Background session reaper |
| `T6` | Config change broadcaster |
| `jLA` | Daemon socket connector |
| `ZLA` | Daemon session lifecycle manager |
| `S` | Daemon dispose helper |
| `jq7` | File-watcher registrar |
| `si` | Config watch callback |
| `H9` | Process registration helper |