---
type: feature-spec
feature: "voice"
cc_version: "2.1.133"
updated: "2026-05-31"
tags: ["voice", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.133 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/voice`

> Analysis basis: CC v2.1.133 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.133

---

## Overview

The `/voice` command toggles voice interaction mode in Claude Code, allowing users to select between three activation strategies: `hold` (push-to-talk), `tap` (toggle-on/toggle-off), or `off` (disable voice entirely). The command validates account eligibility and environment capability before persisting the chosen mode to settings, and registers a keybinding (`Space` in the `Chat` context) for the `voice:pushToTalk` action when applicable.

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `voice` |
| description | `Toggle voice mode` |
| argumentHint | `[hold\|tap\|off]` |
| supportsNonInteractive | `false` |
| isHidden | `null` |
| module_id | `DJq` |
| load_inline | `true` |
| loc_byte | `11629305` |
| loc_byte_end | `11629547` |
| loc_line | `7643` |
| arbor_handler.name | `X27` |
| arbor_handler.fqn | `claude-2.1.133::X27` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.133 bundle.js:+11629305

## Input Branching

The command has five or more distinct outcome paths depending on authentication state, environment capability, argument value, and settings persistence result; a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/voice [arg]"] --> B{OAuth / Claude.ai\naccount present?}
    B -- No --> C["Return error text:\n'Voice mode requires a Claude.ai account.\nPlease run /login to sign in.'"]
    B -- Yes --> D{Voice capability\navailable in\nthis environment?}
    D -- No --> E["Return error text:\n'Voice mode is not available.'"]
    D -- Yes --> F["Parse argument\nvia argumentParser\n(J27)"]
    F --> G{Argument value?}
    G -- 'hold' --> H[Mode = hold]
    G -- 'tap' --> I[Mode = tap]
    G -- 'off' --> J[Mode = off / disable]
    G -- absent or other --> K[Toggle current mode\nor apply default]
    H & I & J & K --> L{Settings write\nsucceeds?\n(xA / settingsWriter)}
    L -- Failure --> M["Return error text:\n'Failed to update settings.\nCheck your settings file for syntax errors.'"]
    L -- Success, mode = off --> N["Return confirmation:\n'Voice mode disabled.'"]
    L -- Success, mode = hold/tap --> O{Environment\nsupports mic\naccess?}
    O -- No --> P["Return error text:\n'Voice mode is not available\nin this environment.'"]
    O -- Yes --> Q["Register keybinding\nvoice:pushToTalk → Space / Chat context\n(jX / keybindingRegistrar)"]
    Q --> R["Emit telemetry:\ntengu_voice_toggled\n(d handler)"]
    R --> S["Return success\nmessage to user"]
    N --> R
```

Analysis basis: CC v2.1.133 bundle.js:+11626759, +11626770, +11626800, +11626899, +11627051, +11627218, +11627356, +11627600, +11628566, +11628569, +11628588, +11628595, +11627299

## Behavioral Spec

### Top-level handler (X27 — voiceCommandHandler)

The main entry point is the async function `voiceCommandHandler` (bundle identifier `X27`), resolved via `module_id` → `DJq` by the Arbor symbol graph.

```
async function voiceCommandHandler(commandInput, appContext):
    // 1. Authentication gate
    authStatus = checkAuthState(appContext)            // piH / tCA / rY
    if not authStatus.hasClaudeAiAccount:
        return textResult(
            "Voice mode requires a Claude.ai account. Please run /login to sign in."
        )                                              // loc_byte 11626800

    // 2. Feature availability gate
    if not voiceFeatureAvailable(appContext):          // rY
        return textResult("Voice mode is not available.")
        //                                             // loc_byte 11626899

    // 3. Argument parsing
    rawArg  = commandInput.trim()                      // loc_byte 11627051
    parsedMode = parseVoiceArgument(rawArg)            // J27 / loc_byte 11626984
    // parsedMode ∈ { "hold", "tap", "off", <toggle> }

    // 4. Apply mode to settings
    writeResult = await writeVoiceModeSetting(         // xA / settingsWriter
                      parsedMode, appContext)           // loc_byte 11627120

    if writeResult.failed:
        return textResult(
            "Failed to update settings. Check your settings file for syntax errors."
        )                                              // loc_byte 11627218

    // 5. Disable path
    if parsedMode == "off":
        emitTelemetry("tengu_voice_toggled", {...})    // d  / loc_byte 11627299
        return textResult("Voice mode disabled.")      // loc_byte 11627356

    // 6. Environment microphone check
    micAvailable = checkMicrophoneEnvironment(         // $ / appContext
                       appContext)                     // loc_byte 11628087
    if not micAvailable:
        // Guidance string references OS path:
        // "System Settings → Privacy & Security → Microphone"
        //                                             // loc_byte 11628107
        return textResult(
            "Voice mode is not available in this environment."
        )                                              // loc_byte 11627600

    // 7. Keybinding registration
    registerKeybinding(                                // jX / keybindingRegistrar
        action  = "voice:pushToTalk",                  // loc_byte 11628569
        context = "Chat",                              // loc_byte 11628588
        key     = "Space"                              // loc_byte 11628595
    )                                                  // loc_byte 11628566

    // 8. Telemetry emission
    emitTelemetry("tengu_voice_toggled", {             // loc_byte 11627299
        mode: parsedMode,
        ...
    })

    // 9. MCP update propagation (M / mcpStateUpdater)
    await propagateMcpUpdate(appContext)               // loc_byte 11627875

    return successResult(...)
```

Analysis basis: CC v2.1.133 bundle.js:+11626759

---

### Authentication check (piH / tCA — authStateChecker)

```
function authStateChecker(appContext):
    sessionInfo = resolveSessionContext(appContext)    // tCA / loc_byte 11617745
    hasAccount  = Boolean(sessionInfo.claudeAiToken)  // loc_byte 11617683
    return { hasClaudeAiAccount: hasAccount }
```

Analysis basis: CC v2.1.133 bundle.js:+11617745, +11617683

---

### Feature availability check (rY — voiceAvailabilityChecker)

The availability checker (identifier `rY`) inspects runtime flags and the current connection type. It calls into `NS` (environmentProber) and `_O` (credentialVerifier), which checks for `ANTHROPIC_API_KEY` and `apiKeyHelper` fields. If the authentication mode is `"none"`, voice is unavailable.

```
function voiceAvailabilityChecker(appContext):
    envInfo = probeEnvironment(appContext)             // NS / loc_byte 2872187
    credOk  = verifyCredentials(appContext)            // _O / loc_byte 2872539
    // _O checks ANTHROPIC_API_KEY (loc_byte 2874043),
    //          apiKeyHelper       (loc_byte 2874137),
    //          "none" auth mode   (loc_byte 2874176)
    if envInfo.clientType == "claude-desktop":        // loc_byte 2871662
        return false
    return credOk
```

Analysis basis: CC v2.1.133 bundle.js:+2872089, +2872187, +2872539, +2874043, +2874043, +2874176

---

### Argument parser (J27 — voiceArgumentParser)

```
function voiceArgumentParser(rawArg):
    trimmed = rawArg.trim()                           // loc_byte 11626629
    // Valid modes defined as literals:
    //   "hold"    loc_byte 11626676
    //   "tap"     loc_byte 11626688
    //   "off"     loc_byte 11626699
    // Sentinel for unrecognised input:
    //   "invalid" loc_byte 11626720
    if trimmed in ["hold", "tap", "off"]:
        return trimmed
    if trimmed == "":
        return <toggleCurrentMode>
    return "invalid"
```

Analysis basis: CC v2.1.133 bundle.js:+11626629, +11626676, +11626688, +11626699, +11626720

---

### Settings writer (xA — voiceSettingsWriter)

`voiceSettingsWriter` (identifier `xA`) loads current settings from disk via `settingsLoader` (`ZO` / `j5_`), merges the voice mode value, then atomically writes back using `atomicFileWriter` (`KhH`). On any parse or write error it returns a failure indicator. Internal calls reach `iN6` (configFileManager) for the config directory path (joining `~/.config` and `"ignore"` sub-paths), `SH` (jsonSerializer), and `fH` (logAppender).

```
async function voiceSettingsWriter(mode, appContext):
    settings = await loadSettingsFromDisk()           // ZO, j5_ / loc_byte 1165231
    settings.voiceMode = mode
    try:
        await atomicFileWrite(                        // KhH / loc_byte 1165739
            path    = resolveSettingsPath(),          // C6H / loc_byte 1165716
            content = jsonSerialize(settings)         // SH  / loc_byte 1165745
        )
        invalidateCaches()                            // l2  / loc_byte 1165881
        emitSettingsEvent(appContext)                 // uk6.emit / loc_byte 1166055
        return { failed: false }
    catch error:
        logError(error)                               // fH  / loc_byte 1166011
        return { failed: true }
```

Analysis basis: CC v2.1.133 bundle.js:+1165231, +1165739, +1165716, +1165745, +1165881, +1166055

---

### Keybinding registration (jX — keybindingRegistrar)

```
function keybindingRegistrar(action, context, key):
    existing = resolveKeybindingConfig()              // VI1 / zK6 / loc_byte 3616306
    if keybindingAlreadySeen(action, existing):       // hI1.has / loc_byte 3616364
        return                                        // deduplicate
    hI1.add(action)                                   // loc_byte 3616375
    bindingBlock = buildBindingBlock(                 // ul6 / loc_byte 3616316
        context = context,
        key     = key,
        action  = action
    )
    applyBinding(bindingBlock)                        // d  / loc_byte 3616386
    emitTelemetry("tengu_keybinding_fallback_used")   // loc_byte 3616388
```

Analysis basis: CC v2.1.133 bundle.js:+11628566, +3616306, +3616364, +3616375, +3616386, +3616388

---

### MCP state propagation (M / Og7 — mcpStateUpdater)

After a successful voice mode change the handler invokes `mcpStateUpdater` (identifier `M`) to synchronise MCP server state. This calls `iZH` (mcpServerSynchroniser) and `mFq` (mcpConfigReloader) which applies any pending MCP configuration deltas and triggers `jD` (daemonRestart) if needed.

```
async function mcpStateUpdater(appContext):
    clients = synchroniseMcpServers(appContext)       // iZH / loc_byte 13870586
    await reloadMcpConfig(clients)                    // mFq / loc_byte 13870596
    updateMcpClientIndex(appContext)                  // Og7 / loc_byte 13870765
```

Analysis basis: CC v2.1.133 bundle.js:+11627875, +13870586, +13870596, +13870765

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_voice_toggled` (loc_byte 11627301) — fired on every successful mode change including disable |
| Telemetry (indirect) | `tengu_keybinding_fallback_used` (loc_byte 3616388) — fired when a keybinding is registered via fallback path |
| Telemetry (indirect) | `tengu_custom_keybindings_loaded` (loc_byte 3608971) — fired by keybinding config loader |
| Telemetry (indirect) | `tengu_feature_ok` / `tengu_feature_bad` (loc_byte 907381 / 907437) — feature flag evaluation events |
| Settings file written | `~/.claude/settings.json` (loc_byte 1161364, 1161374) updated with `voiceMode` key via atomic write |
| Settings cache invalidated | `l2` clears `JG6` and `Q28` caches (loc_byte 24901, 24913) after write |
| Keybinding registered | `voice:pushToTalk` → `Space` in `Chat` context (loc_byte 11628569, 11628588, 11628595) when mode is `hold` or `tap` and microphone is accessible |
| appState changes | Voice mode field updated; MCP client index refreshed via `Og7` |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| OS microphone guidance | References `"System Settings → Privacy & Security → Microphone"` (loc_byte 11628107) in the environment-unavailable error path |

## Version History

| Version | Change |
|---|---|
| v2.1.133 | Initial analysis |

## Common Mistakes

1. **Omitting the argument entirely and expecting a menu**: `/voice` with no argument toggles the current state rather than presenting a selection UI. Explicitly pass `hold`, `tap`, or `off`.
2. **Using `/voice` without a Claude.ai account**: The command gates on OAuth login; running it with only an API key (`ANTHROPIC_API_KEY`) without a Claude.ai session returns the login-required error. Use `/login` first.
3. **Expecting voice on non-interactive or API-key-only sessions**: `supportsNonInteractive` is `false`; the command is a no-op in non-interactive mode and will return the availability error when invoked programmatically.
4. **Editing `settings.json` manually while `/voice` is running**: The atomic write in `voiceSettingsWriter` reads then overwrites the file; concurrent edits may be silently discarded.
5. **Assuming voice works in SSH / remote environments without microphone access**: The microphone availability check (`$`) inspects the environment and returns `"Voice mode is not available in this environment."` (loc_byte 11627600) when the OS-level device is absent.

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `X27` | Top-level voice command handler (AsyncFunction, main entry) |
| `piH` | Authentication state dispatcher (calls tCA) |
| `tCA` | Session token resolver; returns Boolean via `Boolean()` call |
| `rY` | Voice feature availability checker (dispatches NS, _O, kH) |
| `HK` | Runtime flag reader helper |
| `NS` | Environment prober (checks claude-desktop, connection type) |
| `kH` | Primitive string/number coercion utility |
| `_O` | Credential verifier (checks ANTHROPIC_API_KEY, apiKeyHelper, "none" mode) |
| `o96` | Auth mode classifier helper |
| `ej6` | Boolean auth result wrapper |
| `mA` | Telemetry batch dispatcher |
| `db` | Telemetry event recorder (calls vWL, Oq) |
| `vWL` | Settings load-from-disk orchestrator |
| `Oq` | Telemetry queue pusher (uses process.memoryUsage) |
| `E8` | File append logger |
| `Lk` | Settings flag/policy merger |
| `X5_` | Settings object key enumerator |
| `ZO` | Settings path resolver (userSettings, projectSettings, localSettings) |
| `Hr` | Settings merge helper (wcA, Ch) |
| `Y5_` | SDK inline settings injector |
| `J27` | Voice argument parser ("hold" / "tap" / "off" / "invalid") |
| `xA` | Voice settings writer (atomic file write path) |
| `j5_` | Settings file pipeline orchestrator |
| `OE` | File encoding detector dispatcher |
| `Fp` | File reader with encoding detection |
| `Z3` | Filesystem stat + realpath helper |
| `k` | OS/platform classifier |
| `hH6` | File read helper |
| `D8` | Error code classifier |
| `w8` | Generic error wrapper |
| `rh8` | Timestamp cache setter |
| `C6H` | Config path resolver (wj.resolve, oLH) |
| `LA` | Config directory path accessor |
| `oLH` | Config subdirectory joiner |
| `KhH` | Atomic file writer (randomBytes temp, rename, fchmod, fsync) |
| `SH` | JSON serialiser (JSON.stringify wrapper) |
| `l2` | Settings in-memory cache invalidator (clears JG6, Q28) |
| `iN6` | Config file manager (mkdir, readFile, writeFile, appendFile) |
| `N6` | AsyncLocalStorage-backed context accessor |
| `zN6` | Context store getter (ON6.getStore) |
| `Ch8` | Config section reader |
| `mh8` | Git-ignore check dispatcher |
| `GA` | Git subprocess runner |
| `yPL` | Config home path builder (~/.config) |
| `fH` | Structured log appender (cyH.push, yQ.logError) |
| `HA` | Error string normaliser |
| `yq` | Log queue writer |
| `NJL` | Rolling log buffer manager (shift/push) |
| `Qb` | Settings file path joiner (.claude/settings.json) |
| `M` | MCP state updater (calls iZH, mFq, Og7) |
| `iZH` | MCP server synchroniser (Object.entries over server map) |
| `zt` | MCP server diff applier |
| `SEH` | MCP server entry reconciler |
| `Ot` | MCP server list builder |
| `XO6` | MCP transport-type router (sse, http, stdio) |
| `$I` | MCP server config validator |
| `dM` | MCP server option merger |
| `AA` | MCP server array builder |
| `so4` | MCP needs-auth cache loader |
| `KIA` | MCP auth cache file reader |
| `G98` | MCP server hash/key generator |
| `Vl` | MCP server name formatter |
| `W98` | MCP server key builder |
| `GJ` | MCP config hash utility (BX9.createHash sha256) |
| `K8` | MCP debug log emitter |
| `gZA` | MCP connection manager (connects, retries, OAuth) |
| `_e` | MCP OAuth flow handler (HTTP callback server) |
| `KlH` | MCP pending-auth tracker (of8 map) |
| `Y` | Background session lifecycle manager |
| `AM8` | MCP auth cache file unlinker |
| `eF` | MCP reconnect orchestrator |
| `Fb` | MCP transport factory |
| `D` | Daemon supervisor writer |
| `T7` | MCP error log emitter |
| `vH` | String-coerce-to-string utility |
| `Lo4` | MCP connection timeout racer |
| `_o4` | SSH environment detector |
| `QZA` | MCP complete-authentication tool handler |
| `LlH` | MCP pending-request getter |
| `flH` | MCP auth pending-state getter |
| `Yl9` | MCP needs-auth cache writer |
| `JM8` | MCP cache file path builder |
| `BZA` | MCP token store (GJ hash key, Bw6 read) |
| `dK` | MCP token store key builder (l41) |
| `Bw6` | MCP stored-token reader/updater |
| `kJA` | MCP tool schema builder |
| `e6` | Tool definition factory (fe8, fxH, jX1, MxH) |
| `J` | Process-kill dispatcher (SIGTERM) |
| `v` | Background worker lifecycle (blurred/focused, 3600000 ms TTL) |
| `S` | Transient stream writer |
| `z` | Daemon stream (hH, uH, bS, cC) |
| `$l9` | Iterator/async mapper utility (GMH) |
| `GMH` | Generic async mapper (Number.isSafeInteger, AggregateError) |
| `_J6` | Integer parser (parseInt wrapper) |
| `fIA` | Integer parser variant (parseInt wrapper) |
| `mFq` | MCP config reloader (applyMcpUpdate, cleanup, jD) |
| `XM8` | MCP config serialiser |
| `hI` | MCP cleanup dispatcher (DlH, L.cleanup) |
| `DlH` | MCP server cleanup helper |
| `$` | Daemon config writer/dispatcher (XDq) |
| `XDq` | Daemon status file writer (iY, Sj6, SH) |
| `yr` | File write utility (y7H) |
| `iY` | Atomic file writer via rename (Xa8.randomBytes) |
| `Sj6` | Daemon status path builder |
| `J6` | Conversation session manager (Bq6, gq6, Po, _d6) |
| `Po` | Session context builder |
| `jo` | Session executor (Ex) |
| `_d6` | Session deduplication tracker (Ut8, b5H) |
| `pt8` | Session event emitter (Xo.emit, O2K) |
| `ct8` | Session init helper (mA, LX1, CyH) |
| `R6` | Config read/watch orchestrator |
| `m5H` | Config file reader with backup/copy logic |
| `u2K` | Config file watcher (Yd6.watchFile/unwatchFile) |
| `Og7` | MCP client index updater (getClients, T98, iZH, mFq) |
| `T98` | MCP capability tester (RT4, CT4) |
| `r8` | Retry-with-timeout helper |
| `jX` | Keybinding registrar (voice:pushToTalk, Space, Chat) |
| `VI1` | Keybinding config loader (zK6) |
| `zK6` | Keybinding config parser/validator |
| `jAA` | Keybinding block parser |
| `mx` | Keybinding session context accessor |
| `gAH` | Keybinding config path builder |
| `p6` | JSON.parse wrapper |
| `uH` | Keybinding feature-availability guard |
| `Cl6` | Array-of-strings validator |
| `Sl6` | Keybinding entry flattener (Object.entries) |
| `II1` | Keybinding resolve helper |
| `JAA` | Keybinding duplicate-key detector (regex exec, O.get/set) |
| `XAA` | Keybinding structural validator (dNK, cNK, nNK, lNK) |
| `hH` | Feature-check short-circuit helper |
| `ul6` | Keybinding last-active finder (_.findLast, F2H) |
| `F2H` | Keybinding display-name mapper |
| `ENH` | Locale/language normaliser (toLowerCase, GcA.has, split) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.