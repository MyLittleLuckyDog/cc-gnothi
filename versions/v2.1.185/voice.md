---
type: feature-spec
feature: "voice"
cc_version: "2.1.185"
updated: "2026-06-21"
tags: ["voice", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.185 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/voice`

> Analysis basis: CC v2.1.185 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.185

---

## Overview

The `/voice` command toggles voice input mode for Claude Code, allowing users to switch between `hold`, `tap`, and `off` sub-modes for microphone-based interaction. It performs a multi-stage gate: first verifying the user holds a Claude.ai account, then checking the `allow_voice_mode` policy flag, and finally reading or writing the voice mode setting in persistent configuration. A push-to-talk keybinding (`Space` in the `Chat` context, action `voice:pushToTalk`) is registered when the feature is activated.

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
| module_id | `yMl` |
| load_inline | `true` |
| loc_byte | `13234013` |
| loc_byte_end | `13234255` |
| loc_line | `8702` |
| arbor_handler.name | `Mmf` |
| arbor_handler.fqn | `claude-2.1.185::Mmf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.185 bundle.js:+13234013

---

## Input Branching

The handler has more than three distinct branches derived from argument parsing, policy checks, and mode transitions.

```mermaid
flowchart TD
    A["/voice [arg]"] --> B{User has Claude.ai account?}
    B -- No --> C["Return error text:\n'Voice mode requires a Claude.ai account.\nPlease run /login to sign in.'"]
    B -- Yes --> D{allow_voice_mode policy flag set?}
    D -- No --> E["Return error text:\n'Voice mode is not available.'"]
    D -- Yes --> F{Arg provided?}
    F -- No --> G["Read current voiceMode from settings\n(toggle / display current state)"]
    F -- Yes --> H{arg.trim() value}
    H -- 'hold' --> I["Set voiceMode = 'hold' in settings"]
    H -- 'tap' --> J["Set voiceMode = 'tap' in settings"]
    H -- 'off' --> K["Set voiceMode = 'off' in settings\nDisable voice mode"]
    H -- other --> L["Return 'invalid' branch\n(unrecognised argument)"]
    I --> M{Settings write succeeded?}
    J --> M
    K --> N["Display: 'Voice mode disabled.'"]
    M -- No --> O["Display: 'Failed to update settings.\nCheck your settings file for syntax errors.'"]
    M -- Yes --> P{Platform supports voice?}
    P -- No --> Q["Display: 'Voice mode is not available in this environment.'"]
    P -- Yes --> R["Register keybinding voice:pushToTalk\n(Chat context / Space key)\nEmit tengu_voice_toggled\nReturn success"]
    G --> R
```

Analysis basis: CC v2.1.185 bundle.js:+13231498, +13231509, +13231526, +13231539, +13231638, +13231759

---

## Behavioral Spec

### Entry-point — `voiceCommandHandler` (Mmf)

The handler is an `AsyncFunction` resolved via the `module_id` path (`yMl`). It is the sole entry point for `/voice`.

```
async function voiceCommandHandler(args, context):
    rawArg = args.trim()                          // +13231759

    // Gate 1 — authentication
    authState = getAuthState(context)             // calls Nmt → RKn → hy
    if not authState.hasClaudeAiAccount:
        return textResult(
            "Voice mode requires a Claude.ai account. Please run /login to sign in."
        )                                         // +13231539

    // Gate 2 — policy
    if not policyPermits("allow_voice_mode"):     // +13220739
        return textResult("Voice mode is not available.")  // +13231638

    // Argument normalisation (calls Dmf)
    mode = normaliseVoiceArg(rawArg)              // +13231692
    // mode ∈ {"hold", "tap", "off", "invalid", ""}

    if mode == "off":
        writeVoiceSetting("off", context)
        return textResult("Voice mode disabled.")  // +13232064

    if mode == "invalid":
        // unrecognised argument — fallthrough / error path

    // Settings write
    ok = writeVoiceSetting(mode, context)        // calls co → settings subsystem
    if not ok:
        return textResult(
            "Failed to update settings. Check your settings file for syntax errors."
        )                                         // +13231926

    // Platform check
    if not platformSupportsVoice():
        return textResult(
            "Voice mode is not available in this environment."
        )                                         // +13232308

    // Keybinding registration (calls GC)
    registerKeybinding(
        action  = "voice:pushToTalk",             // +13233277
        context = "Chat",                         // +13233296
        key     = "Space"                         // +13233303
    )

    emit("tengu_voice_toggled", {mode})           // +13232009

    return Promise.resolve(result)                // +13232124
```

Analysis basis: CC v2.1.185 bundle.js:+13231498

---

### Argument normalisation — `normaliseVoiceArg` (Dmf)

```
function normaliseVoiceArg(raw):
    trimmed = raw.trim()                          // +13231368
    if trimmed == "hold":   return "hold"         // +13231415
    if trimmed == "tap":    return "tap"          // +13231427
    if trimmed == "off":    return "off"          // +13231438
    if trimmed == "":       return ""             // no-arg / toggle
    return "invalid"                              // +13231459
```

Analysis basis: CC v2.1.185 bundle.js:+13231368

---

### Policy check — `checkVoiceModePolicy` (PKn → di)

```
function checkVoiceModePolicy(context):
    featureFlag = lookupFlag("allow_voice_mode")  // +13220739
    // di checks yJu / EJu capability sets
    // ra performs essential-traffic routing
    return featureFlag.isEnabled
```

Analysis basis: CC v2.1.185 bundle.js:+13220736, +13220781, +13220795

---

### Authentication gate — `getAuthState` (Nmt → RKn → hy)

```
function getAuthState(context):
    // hy aggregates auth state via:
    //   dp  — reads base credential store       (+3048743)
    //   ib  — resolves profile type             (+3048841)
    //         profile-implicit: +3047694
    //         user_oauth:       +3047767
    //   Ac  — firstParty flag                   (+3048862)
    //   Ug  — validates ANTHROPIC_API_KEY / apiKeyHelper / none (+3050993, +3051087, +3051126)
    //         error literal when missing:       (+3051462)
    //   vLt, AJe — supplementary checks
    return {hasClaudeAiAccount: bool, ...}
```

Analysis basis: CC v2.1.185 bundle.js:+13231498, +13220781

---

### Settings persistence — `saveVoiceSetting` (co)

`co` is the settings-write subsystem invoked after a valid mode is confirmed.

```
function saveVoiceSetting(mode, context):
    // co calls, in order:
    //   QA  → LSe / B2  — resolves settings file paths     (+1332446)
    //   jt              — path utilities
    //   Thr             — telemetry / log flush
    //   bv  → eQ        — file read (current settings)     (+1332554)
    //   Mn              — merge helper                     (+1332573)
    //   RAr             — timestamp recorder               (+1332996)
    //   MSt             — atomic write (rename)            (+1333049)
    //   Pe              — JSON serialiser                  (+1333055)
    //   Ves             — git-ignore / .claude path checks (+1333216)
    //   J9  → o1.join   — .claude/settings.json path      (+1333220)
    //   pze.emit        — internal event bus               (+1333602)

    // Relevant path constants:
    //   ".claude"             (+1313104)
    //   "settings.json"       (+1313114)
    //   "settings.local.json" (+1313176)

    return writeSucceeded: bool
```

Analysis basis: CC v2.1.185 bundle.js:+1332446

---

### Keybinding registration — `registerVoiceKeybinding` (GC → uSn → _kt)

```
function registerVoiceKeybinding():
    // GC checks zCi set for duplicate registration (+3983040)
    // uSn → _kt loads keybindings.json from .claude/keybindings.json (+3974060)
    // _kt validates JSON structure:
    //   must contain "bindings" array (+3976309)
    //   each block needs "context" (string) and "bindings" (object) (+3976638)
    // Registers:
    //   action  = "voice:pushToTalk"
    //   context = "Chat"
    //   key     = "Space"
    // Platform key format varies: macos uses "cmd"/"opt", linux uses "ctrl" (+3962519, +3962675)
    // Emits tengu_keybinding_customization_release on success (+3973546)
    // Emits tengu_custom_keybindings_loaded          (+3973966)
```

Analysis basis: CC v2.1.185 bundle.js:+13233274, +13233277, +13233296, +13233303

---

### Platform availability check — `platformSupportsVoice` (pWe)

```
function platformSupportsVoice():
    // pWe checks:
    //   e.toLowerCase()         — normalise platform string (+5208)
    //   EUo.has(platformStr)    — allowlist lookup          (+5258)
    //   t.split(...)            — version string parsing    (+5323)
    // Returns false on unsupported platforms
    // macOS microphone permission path surfaced in error messages:
    //   "System Settings → Privacy & Security → Microphone" (+13232815)
```

Analysis basis: CC v2.1.185 bundle.js:+13233408

---

### Settings load sub-system — `loadSettingsFromDisk` (_j)

Called transitively by multiple gates to read merged settings.

```
function loadSettingsFromDisk():
    // Performance mark: "loadSettingsFromDisk_start"  (+1329958)
    // Reads and merges layers in priority order:
    //   flagSettings    (+1309271)
    //   policySettings  (+1309293)
    //   userSettings    (+1312850)
    //   projectSettings (+1312901)
    //   localSettings   (+1312923)
    //   SDK inline settings (+1311499)
    // Performance mark: "loadSettingsFromDisk_end"    (+1330014)
    // Telemetry: settings_load_started / settings_load_completed (+1317663, +1318567)
```

Analysis basis: CC v2.1.185 bundle.js:+1329994

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_voice_toggled` | Fired on every successful mode change; carries the new mode value. `loc_byte:+13232009` |
| Telemetry — `tengu_feature_ok` | Fired by the feature-flag subsystem on successful capability check. `loc_byte:+1021887` |
| Telemetry — `tengu_feature_bad` | Fired when a feature-flag check fails. `loc_byte:+1021954` |
| Telemetry — `tengu_feature_sad` | Fired on unexpected feature-flag state. `loc_byte:+1022035` |
| Telemetry — `tengu_keybinding_customization_release` | Fired when keybinding config is loaded. `loc_byte:+3973546` |
| Telemetry — `tengu_custom_keybindings_loaded` | Fired when custom keybindings are applied. `loc_byte:+3973966` |
| Telemetry — `tengu_keybinding_fallback_used` | Fired when the default keybinding is used as fallback. `loc_byte:+3983064` |
| Telemetry — `tengu_config_parse_error` | Fired when settings JSON is malformed. `loc_byte:+13969321` |
| Keybinding registration | `voice:pushToTalk` → `Space` key in `Chat` context written to `.claude/keybindings.json` |
| Settings write | `voiceMode` field persisted to `.claude/settings.json` or `.claude/settings.local.json` via atomic rename |
| Auth state read | Reads credential store (dp/ib) to assert Claude.ai account presence |
| Policy check | Reads `allow_voice_mode` flag from merged policy/flag settings layers |
| Event bus | `pze.emit` fires an internal event after settings save (`loc_byte:+1333602`) |
| Sound | Not observed in depth-2 traversal |
| `supportsNonInteractive` | `false` — command cannot be used in non-interactive / pipe mode |

---

## Version History

| Version | Change |
|---|---|
| v2.1.185 | Initial analysis |

---

## Common Mistakes

1. **Running `/voice` without a Claude.ai account** — The command hard-gates on account presence before checking any other condition. Running it with only an API key (without OAuth / `CLAUDE_CODE_OAUTH_TOKEN`) produces the login prompt, not a mode change.
2. **Providing an unrecognised argument** — Only `hold`, `tap`, and `off` are valid. Any other string (e.g., `/voice on`, `/voice enable`) falls into the `invalid` branch and will not change settings.
3. **Expecting voice on unsupported platforms** — Even if authentication and policy gates pass, voice mode requires the host platform to appear in the internal platform allowlist checked by `platformSupportsVoice`. On unsupported environments the command returns "Voice mode is not available in this environment." without writing any setting.
4. **Corrupt settings file** — A JSON syntax error in `.claude/settings.json` will cause the settings write to fail and surface the "Failed to update settings. Check your settings file for syntax errors." message. The voice mode will not be changed.
5. **Assuming the keybinding is always registered** — The `Space`/`voice:pushToTalk` keybinding in the `Chat` context is registered only after a successful mode activation (not on `off` or error paths).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Mmf` | Main handler for `/voice` (`voiceCommandHandler`) — AsyncFunction entry point |
| `Nmt` | Auth-state orchestrator; calls RKn and PKn |
| `RKn` | Auth resolution inner function; calls hy and ab |
| `hy` | Core auth aggregator; fans out to dp, ib, Ac, Ug, vLt, AJe, YT |
| `dp` | Base credential store reader |
| `ib` | Profile type resolver (`profile-implicit`, `user_oauth`, `claude-desktop-3p`) |
| `Ac` | First-party flag checker |
| `Ug` | API-key / auth-token / OAuth-token validator |
| `vLt` | Supplementary auth checker delegating to AJe |
| `AJe` | Auth element resolver |
| `ab` | Auxiliary auth helper (calls mi) |
| `Zjt` | Sibling function called by Nmt (context unclear at depth 2) |
| `PKn` | Policy-gate router; calls di |
| `di` | Feature-flag evaluator for `allow_voice_mode` |
| `oAi` | Capability set lookup (calls Cz) |
| `pB` | Credential package builder |
| `ra` | Essential-traffic / routing helper |
| `Eme` | Settings accessor within policy path |
| `Cz` | Capability-check orchestrator |
| `Gr` | Telemetry dispatch helper (calls _j) |
| `_j` | `loadSettingsFromDisk` orchestrator |
| `hx` | Settings load sub-helper |
| `ha` | Memory-usage / perf-mark helper |
| `v9` | `require('perf_hooks')` loader |
| `Ihr` | Settings layers merger |
| `Ln` | Log-file appender |
| `Tzt` | Timestamp formatter |
| `xbt` | Flag-settings set builder |
| `Vns` | Policy-settings loader |
| `LSe` | Settings path resolver (`userSettings`, etc.) |
| `Hj` | Settings-load telemetry emitter |
| `Wns` | SDK inline settings handler |
| `B2` | Settings merge and write coordinator |
| `Ar` | Low-level config accessor |
| `kbt` | WSL / platform detection helper |
| `Dmf` | Argument normaliser (`normaliseVoiceArg`) |
| `co` | Settings write subsystem |
| `QA` | Path resolution entry (LSe + B2) |
| `Thr` | Telemetry/log flush called before write |
| `bv` | Settings file reader (calls eQ) |
| `eQ` | File content loader with encoding detection |
| `jp` | Path resolution utility |
| `T` | Generic string / path helper |
| `Zen` | Read-with-header helper |
| `Mn` | Object merge helper |
| `RAr` | Timestamp recorder (Vtn.set + Date.now) |
| `c1e` | Settings path constructor (knn + B2) |
| `knn` | `.claude` directory path builder |
| `MSt` | Atomic file write helper (rename-based) |
| `u` | Daemon-control utility group (ke, Re, rF, SG) |
| `ke` | Daemon stop handler (`tengu_feature_ok`) |
| `Re` | Daemon stop-failed handler (`tengu_feature_bad`) |
| `rF` | Daemon control sub-dispatcher |
| `SG` | Background session shutdown with `Promise.race` |
| `vKe` | File chmod/permission helper |
| `Pe` | JSON serialiser wrapper |
| `mH` | Cache-clear helper (Szt, ctr) |
| `Ves` | Git-ignore / .claude path checker + file I/O |
| `Mt` | Config context accessor |
| `Qen` | AsyncLocalStorage store getter |
| `hAr` | Home-directory path helper |
| `Btn` | Git check-ignore runner |
| `qr` | Git command executor |
| `QXc` | Global-excludes file resolver |
| `Wes` | Git ls-files tracker |
| `J9` | `.claude` settings path joiner |
| `Pt` | Feature-flag sad-path handler |
| `j` | Low-level config read primitive |
| `Ue` | Config event emitter (`ogt`) |
| `De` | Error logging dispatcher |
| `Ho` | Error wrapper |
| `st` | String coercion / display helper |
| `Bzc` | Circular-buffer log (Ven.shift / Ven.push) |
| `a` | MCP server orchestration context |
| `n3e` | MCP server list processor |
| `dW` | MCP server slot updater |
| `Ort` | MCP server object builder |
| `W7` | MCP server connector |
| `k5` | SDK-source MCP enumerator |
| `NLn` | MCP server error colourer |
| `Mrt` | MCP server map updater |
| `Nk` | MCP server state normaliser |
| `P_` | MCP state check (Ct / Fa) |
| `Wn` | General async waiter |
| `pra` | MCP pre-flight runner |
| `w7r` | MCP needs-auth cache reader |
| `Vwe` | Object hash helper (sha256) |
| `Phn` | MCP schema validator |
| `Ohn` | MCP tool schema hasher |
| `EI` | Hash helper (Pe + Gni.createHash) |
| `Mhn` | Tool descriptor builder (dc) |
| `on` | MCP debug logger (QJ.logMCPDebug) |
| `oxn` | MCP OAuth tool injector (Lr, CBd, vBd) |
| `CBd` | OAuth authenticate-tool handler |
| `vBd` | OAuth complete-authentication-tool handler |
| `Sra` | MCP auth cache writer |
| `ci` | AsyncLocalStorage store getter (L0u) |
| `d0n` | MCP cache path builder |
| `OKr` | MCP connection error handler |
| `Ee` | Error string coercer |
| `m` | Worker kill helper |
| `k` | Background worker supervisor |
| `Uk` | MCP skill emitter (`tengu_mcp_skills`) |
| `ct` | MCP tool-count tracker |
| `yKr` | MCP capability inclusion checker |
| `pn` | Global config writer |
| `w` | Background worker blurred/focused scheduler |
| `kz` | Background worker clock helper |
| `L` | Background worker sweep loop |
| `Dec` | Worker state accessor |
| `Cu` | MCP error logger (QJ.logMCPError) |
| `gra` | Zod-style schema validator entry (U8) |
| `U8` | Schema validation core (TypeError, AggregateError) |
| `Hot` | Integer parser for MCP port/timeout |
| `p0n` | Integer parser variant |
| `uZn` | MCP connection result applier |
| `t3e` | MCP tool-state snapshot builder |
| `fw` | MCP cleanup + reconnect dispatcher |
| `hot` | MCP tool-hash snapshot |
| `mta` | MCP server type router (Szr) |
| `l` | Worker lifecycle manager (k0l) |
| `k0l` | Daemon status reader/writer |
| `CQ` | Daemon config accessor |
| `Mjt` | Daemon status file path builder |
| `B1o` | MCP server reconciler |
| `jLn` | MCP tool allow-list checker |
| `Bn` | Retry-with-timeout helper |
| `c` | Worker connection state tracker (Tn) |
| `GC` | Keybinding registration orchestrator |
| `uSn` | Keybinding loader (calls _kt) |
| `_kt` | Keybinding JSON parser and validator |
| `XBr` | Keybinding entry renderer (oSn) |
| `D8` | Keybinding context dispatcher (ct) |
| `hc` | Platform-keybinding resolver (Ul, dp) |
| `aAe` | Keybinding file path builder |
| `Gt` | JSON.parse wrapper |
| `aSn` | Array-shape validator |
| `oSn` | Keybinding entry enumerator |
| `FCi` | Keybinding fallback handler |
| `zBr` | Duplicate-key detector in JSON keybinding |
| `YBr` | Keybinding block validator |
| `dSn` | Keybinding render helper (t3r, kCi) |
| `t3r` | Keybinding text formatter (e3r) |
| `e3r` | Keybinding line builder |
| `kCi` | Keybinding map converter |
| `Uld` | Keybinding display-string builder |
| `Qe` | Config event helper (ogt) |
| `pWe` | Platform allowlist checker (`platformSupportsVoice`) |
| `Ct` | Config read-with-watch entry |
| `Hko` | Config watch state tracker |
| `q_e` | Config file reader with backup/migration |
| `V9` | Version string prefix stripper |
| `RFl` | Config directory scanner |
| `Sko` | Config backup path builder |
| `f` | Daemon worker request dispatcher |
| `M` | Background task scheduler |
| `YKn` | Low-memory threshold checker (zt, ct) |
| `B$e` | Stale temp-file cleaner |
| `$` | Worker retire/classify helper |
| `NNo` | Worker socket connector |
| `jNo` | Worker lifecycle state machine |
| `p` | Forced-shutdown helper |
| `Ebf` | File-watcher registration helper |
| `Kq` | Watch-state cache |
| `qi` | Signal handler registration (B2o.register) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.