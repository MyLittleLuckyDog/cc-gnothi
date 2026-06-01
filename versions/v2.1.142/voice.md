---
type: feature-spec
feature: "voice"
cc_version: "2.1.142"
updated: "2026-06-01"
tags: ["voice", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.142 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/voice`

> Analysis basis: CC v2.1.142 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.142

---

## Overview

The `/voice` command toggles voice input mode in Claude Code, cycling through three sub-modes — `hold`, `tap`, and `off`. It requires an authenticated Claude.ai account and verifies that the runtime environment supports voice features before making any changes to the voice-mode settings. When conditions are met, it persists the new mode to user settings and optionally registers a push-to-talk keybinding.

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
| module_id | `TIq` |
| load_inline | `true` |
| loc_byte | `11894771` |
| loc_byte_end | `11895013` |
| arbor_handler.name | `dR7` |
| arbor_handler.fqn | `claude-2.1.142::dR7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.142 bundle.js:+11894771

---

## Input Branching

The command has more than three distinct branches determined by authentication state, environment availability, and the explicit mode argument (`hold`, `tap`, `off`). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/voice [arg]"]) --> B{Logged in to\nClaude.ai?}
    B -- No --> C["Return error:\n'Voice mode requires a Claude.ai account.\nPlease run /login to sign in.'"]
    B -- Yes --> D{Voice\navailable?}
    D -- No --> E{Environment\nsupports voice?}
    E -- No --> F["Return error:\n'Voice mode is not available in\nthis environment.'"]
    E -- Yes --> G["Return info:\n'Voice mode is not available.'"]
    D -- Yes --> H{Parse argument}
    H -- "hold" --> I[Set mode = hold]
    H -- "tap" --> J[Set mode = tap]
    H -- "off" --> K[Set mode = off]
    H -- "(none / toggle)" --> L[Cycle current → next mode]
    H -- "invalid" --> M["Return error: invalid mode"]
    I & J & K & L --> N[Write mode to user settings]
    N --> O{Write\nsucceeded?}
    O -- No --> P["Return error:\n'Failed to update settings.\nCheck your settings file for\nsyntax errors.'"]
    O -- Yes --> Q{mode == off?}
    Q -- Yes --> R["Return info:\n'Voice mode disabled.'"]
    Q -- No --> S[Register push-to-talk keybinding\n(voice:pushToTalk / Chat / Space)]
    S --> T[Emit tengu_voice_toggled telemetry]
    T --> U([Return success / active mode message])
    R --> T
```

Analysis basis: CC v2.1.142 bundle.js:+11892225 – +11894493

---

## Behavioral Spec

### 1. Authentication Gate

Before any mode logic runs, the handler calls the session-check helper (identifier: `$sH` → `RF_`) to confirm the user holds a valid Claude.ai session. The check reads the current authentication state and casts it to a boolean.

```
function checkClaudeAiSession(appState):
    authRecord = getAuthState(appState)          // RF_ → bw
    isLoggedIn = Boolean(authRecord)             // RF_ → Boolean
    return isLoggedIn
```

If `isLoggedIn` is `false`, the handler immediately returns a `text`-type result containing the literal message "Voice mode requires a Claude.ai account. Please run /login to sign in." (Analysis basis: CC v2.1.142 bundle.js:+11892266)

### 2. Voice Availability Check

After authentication, the handler (via `dR7 → bw`) verifies that the current runtime environment exposes a voice-capable interface. Two distinct negative paths exist:

| Condition | Message returned |
|---|---|
| Feature flag / capability absent | `"Voice mode is not available."` (bundle.js:+11892365) |
| Environment structurally incompatible | `"Voice mode is not available in this environment."` (bundle.js:+11893066) |

The macOS microphone permission path surfaces the literal hint `"System Settings → Privacy & Security → Microphone"` (bundle.js:+11893573) when the system indicates microphone access is denied.

```
function checkVoiceAvailability(appState, env):
    if not voiceCapabilityFlag(appState):
        if environmentSupportsVoice(env):
            return { available: false, reason: "not_available" }
        else:
            return { available: false, reason: "env_incompatible" }
    return { available: true }
```

Analysis basis: CC v2.1.142 bundle.js:+11892236 – +11892403

### 3. Argument Parsing and Mode Resolution

The handler trims the raw argument string (call to `QR7 → H.trim`, also `dR7 → H.trim`), then matches against the three known mode literals.

```
function parseVoiceMode(rawArg, currentMode):
    arg = rawArg.trim()
    if arg == "hold":   return "hold"       // bundle.js:+11892142
    if arg == "tap":    return "tap"        // bundle.js:+11892154
    if arg == "off":    return "off"        // bundle.js:+11892165
    if arg == "":
        return cycleMode(currentMode)       // no-arg toggle
    return "invalid"                        // bundle.js:+11892186

function cycleMode(current):
    sequence = ["hold", "tap", "off"]
    idx = sequence.indexOf(current)
    return sequence[(idx + 1) % sequence.length]
```

Analysis basis: CC v2.1.142 bundle.js:+11892095 – +11892165

### 4. Settings Persistence

On a valid resolved mode, the handler invokes the settings-writer pipeline (`dR7 → p_`), which:

1. Loads the current settings from disk via the settings loader (`p_ → Nm8 → W5H`).
2. Writes the new `voiceMode` value back via the atomic file writer (`p_ → TA6`), which uses `randomBytes`, a temp file, `fchmodSync`, `fsyncSync`, and an atomic rename.
3. Clears relevant caches (`p_ → kz → DV6.clear`, `LZ8.clear`).

```
async function persistVoiceMode(newMode):
    settings = await loadSettingsFromDisk()
    settings.voiceMode = newMode
    await atomicWriteSettings(settings)
    clearSettingsCache()
```

If the write throws, the handler catches the error and returns the literal `"Failed to update settings. Check your settings file for syntax errors."` (bundle.js:+11892684).

Analysis basis: CC v2.1.142 bundle.js:+11892586 – +11892684

### 5. Keybinding Registration

When the resolved mode is not `"off"`, the handler invokes `dR7 → eJ`, which loads the keybinding configuration and registers the push-to-talk action:

- Action name: `"voice:pushToTalk"` (bundle.js:+11894035)
- Context: `"Chat"` (bundle.js:+11894054)
- Default key: `"Space"` (bundle.js:+11894061)

```
function registerPushToTalkBinding(keybindingLoader):
    config = keybindingLoader.load()            // eJ → Ga6 → Hf6
    config.register({
        action: "voice:pushToTalk",
        context: "Chat",
        key: "Space"
    })
    // Falls back gracefully if action not found
    // telemetry: tengu_keybinding_fallback_used
```

Analysis basis: CC v2.1.142 bundle.js:+11894032 – +11894166

### 6. Locale / Language Normalisation

The handler calls `ayH` (locale normaliser) which lowercases the locale string, checks membership in a known-locales set (`ft_.has`), and splits on delimiter if needed. The default locale is `"en"` (bundle.js:+27065). This gates any locale-sensitive voice-prompt behaviour.

```
function normaliseLocale(rawLocale):
    lower = rawLocale.toLowerCase()
    if knownLocalesSet.has(lower):
        return lower
    parts = lower.split(delimiter)
    return parts[0]                // fall back to language subtag
```

Analysis basis: CC v2.1.142 bundle.js:+11894166

### 7. Telemetry Emission

After a successful mode change (persist + optional keybinding), the handler emits the `tengu_voice_toggled` event (bundle.js:+11892767) via the `d` telemetry sink that is called directly from `dR7`.

```
function emitVoiceToggle(previousMode, newMode):
    telemetry.emit("tengu_voice_toggled", {
        previous: previousMode,
        current:  newMode
    })
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_voice_toggled` (bundle.js:+11892767) — emitted on every successful mode change |
| Telemetry (indirect) | `tengu_keybinding_fallback_used` (bundle.js:+3743404) — emitted when `voice:pushToTalk` action is not found |
| Telemetry (indirect) | `tengu_custom_keybindings_loaded` (bundle.js:+3735463) — emitted on keybinding config load |
| Telemetry (indirect) | `tengu_feature_ok` / `tengu_feature_bad` (bundle.js:+954550, +954608) — feature-flag accounting |
| Settings write | Atomic write to user `settings.json` under `.claude/` directory; temp file + rename pattern |
| Cache clear | `DV6.clear()` and `LZ8.clear()` on every successful write (bundle.js:+26086, +26098) |
| Keybinding registration | Registers `voice:pushToTalk` → `Space` in `Chat` context when mode ≠ `off` |
| appState changes | `voiceMode` field updated to `"hold"`, `"tap"`, or `"off"` |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.142 | Initial analysis |

---

## Common Mistakes

1. **Running `/voice` without signing in** — The command silently exits with an error message instead of prompting for login. Use `/login` first, then retry.
2. **Using `/voice` in a non-interactive or headless environment** — `supportsNonInteractive` is `false`; the command will not run in pipes or scripts. Environment-incompatibility errors are returned rather than a fallback mode.
3. **Providing an unrecognised argument** — Only `hold`, `tap`, and `off` are valid; any other string is classified as `"invalid"` (bundle.js:+11892186) and the command exits without changing state.
4. **Expecting a toggle with no argument when already in `off` mode** — The cycle wraps: `off → hold → tap → off`. Users who want an explicit state should supply the argument directly.
5. **Editing `settings.json` manually while `/voice` is running** — The atomic write reads, modifies, and replaces the file; concurrent manual edits may be silently overwritten.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `dR7` | Main async handler for `/voice` (arbor_handler) |
| `$sH` | Authentication state check orchestrator |
| `RF_` | Auth record reader + boolean cast |
| `bw` | Voice availability / environment capability checker |
| `OL` | Low-level auth state accessor |
| `QR` | Auth-state branching utility |
| `MP` | First-party auth path helper |
| `z3` | API-key / OAuth env resolver |
| `C46` | Auth error formatter |
| `a06` | Auth post-check action dispatcher |
| `m_` | Settings load initiator |
| `ax` | Settings-from-disk full loader |
| `iS` | Settings pre-load guard |
| `j1` | Performance measurement start |
| `hx` | `perf_hooks` require wrapper |
| `km8` | Core settings load orchestrator |
| `G8` | Settings file append / mkdir logger |
| `JV6` | Settings load event emitter |
| `f96` | Flag-settings collector |
| `GDA` | Settings key aggregator |
| `W5H` | Settings file path resolver (`.claude/settings.json`) |
| `$B` | User settings parser |
| `PDA` | SDK inline settings parser |
| `OB` | Settings object builder / merger |
| `__` | Internal event-bus or logger util |
| `eeH` | Settings field: enterprise |
| `wV8` | Settings field accessor |
| `oeH` | Settings field accessor |
| `hjH` | Settings field accessor |
| `_H6` | Settings field accessor |
| `J5H` | Settings field accessor |
| `j5H` | Settings field accessor |
| `Gm8` | Settings field accessor |
| `HDA` | Settings field accessor |
| `Gc` | Settings field accessor |
| `M96` | WSL environment detector |
| `wV6` | Settings schema version helper |
| `QR7` | Argument trimmer / mode validator |
| `H` | General-purpose utility (random, setTimeout) |
| `p_` | Settings persistence pipeline |
| `JO` | Settings path + builder accessor |
| `x6` | Path existence / resolution helper |
| `Nm8` | Settings multi-source loader |
| `sj` | File read orchestrator |
| `wc` | File content reader with encoding detection |
| `bM` | Filesystem stat + realpath resolver |
| `v` | File-type / permissions inspector |
| `IS6` | File open helper |
| `vS6` | File content normaliser |
| `$8` | Error code checker |
| `O8` | ENOENT / filesystem error classifier |
| `hu8` | Timestamp recorder |
| `jXH` | Settings path + builder bundler |
| `eR6` | Settings file path builder |
| `TA6` | Atomic file writer (temp + rename) |
| `q` | Filesystem module alias |
| `O` | Filesystem stat result object |
| `S8` | Symbolic-link resolver |
| `RH` | JSON serialiser |
| `kz` | Settings cache invalidator |
| `$R6` | Git-ignore / config path checker |
| `h6` | Async-storage context getter |
| `VS6` | Store context reader |
| `Ju8` | Config-path selector |
| `Wu8` | Git check-ignore runner |
| `O_` | Git subprocess executor |
| `JyK` | XDG config path builder |
| `Iy` | `.claude` directory path builder |
| `NH` | Structured error logger |
| `k_` | Error type classifier |
| `bH` | String coercer / display formatter |
| `$q` | NMA wrapper |
| `NMA` | Error display builder |
| `JvK` | Log ring-buffer manager |
| `d` | Telemetry / event emitter sink |
| `M` | MCP server state manager |
| `IvH` | MCP server initialiser |
| `AHH` | MCP config aggregator |
| `FqH` | MCP server-config loader per scope |
| `_HH` | SDK MCP config loader |
| `Hw6` | SSE/HTTP MCP server map builder |
| `dI` | MCP server descriptor builder |
| `j$` | MCP tool-definition assembler |
| `zG_` | MCP tool schema validator |
| `H_` | MCP tool list helper |
| `lX6` | MCP tool filter |
| `D47` | MCP connection timer |
| `wS_` | MCP transport state reader |
| `O78` | MCP server hash builder |
| `Di` | MCP display-name formatter |
| `Wj` | MCP server fingerprint (SHA-256) |
| `$78` | MCP server key builder |
| `oK` | MCP server unique-ID generator |
| `H8` | MCP debug logger |
| `lh_` | MCP connection lifecycle manager |
| `IL7` | MCP transport factory |
| `MB` | MCP client creator |
| `aHH` | MCP OAuth + HTTP server handler |
| `CrH` | MCP pending-connection registry |
| `D` | Background session / daemon manager |
| `PY8` | MCP transport status poller |
| `RQ` | MCP reconnect orchestrator |
| `ox` | MCP client options builder |
| `Y` | MCP supervisor writer |
| `_7` | MCP error logger |
| `GH` | String coercer (display) |
| `vL7` | MCP connection validator |
| `VL7` | SSH environment MCP checker |
| `nh_` | MCP server list builder |
| `RrH` | MCP pending-auth state reader |
| `brH` | MCP active-connection reader |
| `o6q` | MCP transport selector |
| `u7` | Async-storage context reader |
| `hY8` | MCP needs-auth cache path builder |
| `dh_` | MCP debug info logger |
| `LG_` | MCP server-type includes checker |
| `t6` | Global config save orchestrator |
| `A` | Lowercase utility / process manager |
| `J` | Process kill dispatcher |
| `h` | Background process handler |
| `y` | Transient output writer |
| `z` | Daemon session writer |
| `c6q` | MCP JSON-RPC message formatter |
| `qn` | JSON-RPC protocol handler |
| `nX6` | MCP port parser (parseInt) |
| `JS_` | MCP port fallback parser |
| `Peq` | MCP update applier |
| `SY8` | MCP state serialiser |
| `Ov` | MCP cleanup runner |
| `BrH` | MCP cleanup serialiser |
| `$` | Daemon dispose helper |
| `zEq` | Daemon status writer |
| `Va` | Daemon status formatter |
| `h06` | Daemon status file path builder |
| `n_5` | MCP remote server retry manager |
| `Y78` | MCP server type-set checker |
| `a8` | Abort/timeout wrapper |
| `eJ` | Keybinding config loader + registrar |
| `Ga6` | Keybinding file reader |
| `Hf6` | Keybinding config parser / validator |
| `EL_` | Keybinding entry factory |
| `nu` | Keybinding global config loader |
| `Q9H` | Keybinding file path builder |
| `b6` | JSON.parse wrapper |
| `uH` | Telemetry event builder |
| `Pa6` | Keybinding block validator |
| `Ja6` | Keybinding entry expander |
| `$C9` | Keybinding telemetry emitter |
| `GL_` | Keybinding duplicate detector |
| `TL_` | Keybinding filter / dedup pipeline |
| `SH` | Telemetry sink (feature flags) |
| `Ta6` | Keybinding action resolver |
| `vL_` | Keybinding action lookup |
| `iBL` | Keybinding action validator |
| `OGH` | Keybinding display map builder |
| `ayH` | Locale normaliser |
| `y6` | File watcher / CLAUDE.md loader |
| `dA_` | CLAUDE.md path builder |
| `cMH` | Config file reader with backup |
| `DR` | Config prefix stripper |
| `bE9` | Config directory walker |
| `aA_` | Config backup path builder |
| `w` | Background session lifecycle manager |
| `LG6` | Memory threshold helper |
| `S` | Session retire-if-settled helper |
| `G6` | Global state broadcaster |
| `xr_` | Unix socket connect helper |
| `Fr_` | Background session roster manager |
| `u` | Background session cleanup |
| `XhL` | File watcher registration |
| `wl` | Watch event debouncer |
| `C9` | Watch-set manager |
| `fKK` | Watch undefined guard |