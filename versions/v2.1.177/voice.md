---
type: feature-spec
feature: "voice"
cc_version: "2.1.177"
updated: "2026-06-13"
tags: ["voice", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.177 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/voice`

> Analysis basis: CC v2.1.177 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.177

---

## Overview

The `/voice` command toggles voice mode in Claude Code, cycling through the three available interaction sub-modes: `hold` (push-to-talk), `tap` (tap-to-record), and `off` (disabled). The command validates account eligibility and environment support before persisting the selected mode to user settings, emitting a telemetry event on every successful state change.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `voice` |
| description | `Toggle voice mode` |
| argumentHint | `[hold\|tap\|off]` |
| supportsNonInteractive | `false` |
| isHidden | `null` (not hidden) |
| module_id | `i0K` |
| load_inline | `true` |
| loc_byte | `13327989` |
| loc_byte_end | `13328231` |
| arbor_handler.name | `Kq5` |
| arbor_handler.fqn | `claude-2.1.177::Kq5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.177 bundle.js:+13327989

---

## Input Branching

The handler `Kq5` covers six or more distinct outcome paths (account gate, feature-flag gate, argument parsing, three valid mode values, settings-write failure, and environment check). A flowchart is used.

```mermaid
flowchart TD
    A["/voice [arg]"] --> B{User has Claude.ai account?}
    B -- No --> C["Return error:\n'Voice mode requires a Claude.ai account.\nPlease run /login to sign in.'"]
    B -- Yes --> D{"Feature flag\n'allow_voice_mode' enabled?"}
    D -- No --> E["Return error:\n'Voice mode is not available.'"]
    D -- Yes --> F["Normalize & trim argument string"]
    F --> G{Argument value?}
    G -- '"hold"' --> H[Target mode = hold]
    G -- '"tap"' --> I[Target mode = tap]
    G -- '"off"' --> J[Target mode = off]
    G -- missing/other --> K["Cycle to next mode\n(hold → tap → off → hold)"]
    H & I & J & K --> L["Write voiceMode to user settings\n(settingsWriter)"]
    L -- write fails --> M["Return error:\n'Failed to update settings.\nCheck your settings file for syntax errors.'"]
    L -- write ok --> N{"Environment supports\nmicrophone access?"}
    N -- No --> O["Return info:\n'Voice mode is not available in this environment.'"]
    N -- Yes --> P["Emit tengu_voice_toggled telemetry"]
    P --> Q{Mode is 'off'?}
    Q -- Yes --> R["Return: 'Voice mode disabled.'"]
    Q -- No --> S["Register push-to-talk keybinding\n(voice:pushToTalk → Chat context → Space)"]
    S --> T["Start MCP / audio sub-system via\nMCP manager (yZA / LbH chain)"]
    T --> U["Return success message with\ncurrent mode and mic permission hint\n(macOS: System Settings → Privacy & Security → Microphone)"]
```

Analysis basis: CC v2.1.177 bundle.js:+13325474 (handler entry `Kq5`)

---

## Behavioral Spec

### 1. Account and Feature-Flag Gate

```
async function voiceCommandGate(appState, featureFlags):
    # Check OAuth / Claude.ai account presence
    authInfo = getAuthInfo(appState)         # calls pL6 → Ad8 → $9
    if authInfo.accountType not in {"enterprise", "team", "claude_ai"}:
        return textResult("Voice mode requires a Claude.ai account. "
                          "Please run /login to sign in.")

    # Check feature flag returned from account settings
    if not featureFlags.has("allow_voice_mode"):   # literal at +13314715
        return textResult("Voice mode is not available.")
```

Analysis basis: CC v2.1.177 bundle.js:+13314715 (`allow_voice_mode` flag literal), +13325515 (account error string), +13325614 (feature unavailable string)

### 2. Argument Parsing and Mode Selection

Valid mode strings are the exact literals `"hold"`, `"tap"`, and `"off"` (bundle.js:+13325391, +13325403, +13325414). Any other token (including absent input) results in the cyclical advancement described below.

```
function parseModeArgument(rawArg, currentMode):
    arg = rawArg.trim()           # qq5 helper at +13325344
    if arg in {"hold", "tap", "off"}:
        return arg
    # No explicit argument — cycle: hold → tap → off → hold
    CYCLE = ["hold", "tap", "off"]
    idx   = CYCLE.indexOf(currentMode)
    return CYCLE[(idx + 1) % 3]
```

Analysis basis: CC v2.1.177 bundle.js:+13325391–13325414 (mode literals), +13325344 (`qq5` trim call)

### 3. Settings Persistence

The resolved mode is written to the user-scoped settings store via the settings writer utility (`$A` → `AL_` → `JDH` path). If the atomic write fails, the handler returns an error message without changing any runtime state.

```
async function persistVoiceMode(mode):
    result = await settingsWriter.set("voiceMode", mode)  # $A chain
    if result.kind == "error":
        return textResult("Failed to update settings. "
                          "Check your settings file for syntax errors.")
    return result   # caller continues
```

Analysis basis: CC v2.1.177 bundle.js:+13325804 (`$A` call), +13325902 (settings-write error string)

### 4. Environment Capability Check

After a successful settings write, the handler checks whether the runtime environment can access a microphone. On systems where this is not possible (e.g., headless, SSH-only, or restricted containers), it surfaces a softer informational message instead of an error.

```
function checkEnvironmentCapability(platform):
    if not environmentSupportsMic(platform):    # sw → kO chain
        return textResult("Voice mode is not available in this environment.")
    return null   # proceed
```

Analysis basis: CC v2.1.177 bundle.js:+13326284 (environment unavailability string), +13326791 (macOS microphone permission path string)

### 5. Telemetry Emission and Mode-Off Short-Circuit

```
async function finalizeVoiceToggle(mode, appState):
    emitTelemetry("tengu_voice_toggled", {mode})   # at +13325985

    if mode == "off":
        return textResult("Voice mode disabled.")   # +13326040

    # Register push-to-talk keybinding for non-off modes
    registerKeybinding(
        action  = "voice:pushToTalk",   # +13327253
        context = "Chat",               # +13327272
        key     = "Space"               # +13327279
    )                                   # X2 call at +13327250

    # Start audio / MCP sub-system
    startVoiceSubsystem(appState)       # M / yZA / LbH chain at +13326559

    # Return confirmation with platform-specific mic hint (macOS shown)
    return textResult(buildSuccessMessage(mode))
```

Analysis basis: CC v2.1.177 bundle.js:+13325985 (telemetry), +13326040 (disabled message), +13327250–13327279 (keybinding registration), +13327711 (`P8` call completing startup)

### 6. Settings Load on Entry

Before any gate check the handler loads current settings from disk via the settings-loader chain (`n_` → `GF` → `qL_`). This emits internal perf marks `loadSettingsFromDisk_start` and `loadSettingsFromDisk_end` (bundle.js:+1320332, +1320388) and reads the layered settings stack (`flagSettings`, `policySettings`, `userSettings`, `projectSettings`, `localSettings`).

```
async function loadCurrentSettings():
    mark("loadSettingsFromDisk_start")
    settings = await settingsLoader()    # n_ → GF → qL_ chain
    mark("loadSettingsFromDisk_end")
    return settings
```

Analysis basis: CC v2.1.177 bundle.js:+13325652 (`n_` call), +1320332 (perf mark string)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_voice_toggled` (bundle.js:+13325985) — emitted on every successful settings write regardless of mode; `tengu_feature_ok` (+1018758), `tengu_feature_bad` (+1018825), `tengu_feature_sad` (+1018906) — emitted by the feature-flag evaluation helpers |
| Settings mutation | `voiceMode` key written to user-scoped settings file (`~/.claude/settings.json`) via atomic writer (`$A` / `AL_` / `EY6` chain) |
| Keybinding registration | `voice:pushToTalk` action bound to `Space` in `Chat` context when mode is `hold` or `tap` (bundle.js:+13327253–13327279, `X2` call) |
| MCP / audio sub-system | `startVoiceSubsystem` triggered via `M` → `yZA` → `LbH` chain; this may reconnect MCP servers and apply MCP updates (`_o8`, `wG`, `D86`) |
| appState changes | `voiceMode` field updated in runtime app state after settings persist |
| Sound | Not observed in depth-2 traversal |
| Non-interactive | Not supported (`supportsNonInteractive: false`); command must be run in an interactive terminal session |

---

## Version History

| Version | Change |
|---|---|
| v2.1.177 | Initial analysis |

---

## Common Mistakes

1. **Running `/voice` without a Claude.ai account.** The command requires OAuth login to a Claude.ai account (enterprise, team, or personal). Users on API-key-only setups receive the error *"Voice mode requires a Claude.ai account. Please run /login to sign in."*
2. **Expecting `/voice` to work in non-interactive mode.** `supportsNonInteractive` is `false`; invoking it from scripts or headless pipelines will fail at the CLI dispatch layer before the handler runs.
3. **Passing an unrecognised argument.** Only `hold`, `tap`, and `off` are treated as explicit selections. Any other token causes the mode to cycle rather than set a specific value, which can be surprising.
4. **Assuming voice mode persists across environments.** The environment-capability check runs on every invocation; even if the settings file says `hold`, an incompatible environment produces *"Voice mode is not available in this environment."* without changing the stored value back to `off`.
5. **Ignoring the settings-write error.** If `~/.claude/settings.json` has a syntax error, the persistence step silently fails and the mode is not changed. The error message explicitly recommends checking the file for JSON syntax errors.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Kq5` | Main async handler for `/voice` (arbor_handler, AsyncFunction) |
| `pL6` | Auth/account info resolver — checks Claude.ai account presence |
| `_d8` | Feature-flag fetcher — retrieves `allow_voice_mode` and related flags |
| `sw` | App-state reader / environment context accessor |
| `XL` | Low-level state getter utility |
| `Fj` | Auth-profile builder (constructs profile including `profile-implicit`, `user_oauth`) |
| `rf` | First-party auth token handler |
| `QP` | App-state query helper |
| `kO` | API key / auth validation gate (checks `ANTHROPIC_API_KEY`, `apiKeyHelper`, `none`) |
| `L06` | Settings layer merger |
| `LaH` | Settings accessor (reads individual setting keys) |
| `ZT` | Feature-flag evaluator |
| `OB6` | OAuth token presence checker |
| `Ad8` | Account-type resolver |
| `$9` | Plan/tier checker (enterprise, team flags; `allow_voice_mode`, `allow_product_feedback`) |
| `Eg1` | AJH wrapper — escalates flag check |
| `xb` | Capability probe — checks kO, Fj, H9 |
| `qq` | Essential-traffic flag gate |
| `GLH` | Feature-gate logging helper |
| `AJH` | Account feature aggregator |
| `n_` | Settings-load entry point |
| `GF` | Settings-load orchestrator (emits perf marks, calls qL_, Tb, qc6) |
| `tG` | Perf timer getter |
| `Lq` | Memory-usage sampler (uses OSA set, process.memoryUsage) |
| `eu` | Node `require` wrapper (loads `perf_hooks`) |
| `qL_` | Settings-load core (reads flagSettings, policySettings, userSettings, etc.) |
| `b8` | Log appender (appendFileSync, mkdirSync) |
| `Kc6` | Settings-load cache checker |
| `YD6` | Flag-settings merger |
| `TaA` | Policy-settings loader (Object.keys, Os) |
| `f` | Pending-promise tracker (add/delete/finally) |
| `K` | Column-padding utility (map, padEnd) |
| `JDH` | Path builder for settings files (userSettings, projectSettings, localSettings) |
| `L` | Connection/resource closer (close, finally) |
| `WF` | Watch-file registrar for settings (QhA, _S, t7_, dhA) |
| `WaA` | SDK inline settings injector |
| `Tb` | Full settings-config builder (T_, m36, Jt8, b36, …) |
| `T_` | Config schema validator |
| `DD6` | WSL / platform detection helper |
| `qc6` | Settings-load completion marker |
| `zB6` | Voice mode current-state reader |
| `qq5` | Argument normalizer (`H.trim`) |
| `H` | Random/timer utility (Math.random, setTimeout) |
| `$A` | Settings writer / gitignore updater |
| `n3` | Settings path builder (JDH, Tb) |
| `AL_` | Atomic settings write coordinator (TaA, JDH, WF, WaA, Os) |
| `_W` | Working-directory / real-path resolver |
| `zs` | File-content reader with BOM/encoding detection |
| `UL` | Real-path resolver (d5, PD, H.realpathSync) |
| `N` | Platform/encoding normalizer |
| `xs6` | Settings file path resolver |
| `C8` | JSON schema validator wrapper |
| `Z8` | Error type checker |
| `w7_` | Write-timestamp recorder (Rt6.set, Date.now) |
| `ZhH` | gitignore / settings file path builder |
| `Je6` | Path join/dirname utility |
| `EY6` | Atomic file writer (openSync, writeFileSync, fchmodSync, fsyncSync, renameSync) |
| `O` | Background-session state holder |
| `CH` | JSON serializer (JSON.stringify) |
| `Kz` | Cache clearer (Ac6.clear, oa8.clear) |
| `Nt6` | gitignore rule writer (qDH.mkdir, readFile, appendFile, writeFile) |
| `u6` | Async-local-store accessor |
| `bs6` | Context-store getter (Cs6.getStore) |
| `i4_` | gitignore path builder (y4) |
| `A` | String caser (L.toLowerCase) |
| `vt6` | git check-ignore runner |
| `d_` | Shell command executor (zhH, Y, Kgf, L5, N, Z8, kH) |
| `ugf` | Path normalizer (trim, startsWith, homedir, isAbsolute) |
| `PrA` | gitignore entry parser (d_) |
| `WrA` | gitignore section writer |
| `Tm` | `.claude` directory path builder (gy.join) |
| `IH` | Feature-telemetry emitter (`tengu_feature_ok`) |
| `d` | Base telemetry dispatcher |
| `tH` | Telemetry event sender (nM6) |
| `nM6` | Raw telemetry transport |
| `n6` | Feature-sad telemetry emitter (`tengu_feature_sad`) |
| `bH` | Feature-bad telemetry emitter (`tengu_feature_bad`) |
| `kH` | Log writer (jA, A6, qq, hUf, ycH, $s.logError) |
| `jA` | Error formatter |
| `A6` | String coercion utility |
| `hUf` | Rolling log buffer manager (ys6.shift/push) |
| `M` | MCP manager orchestrator (LbH, _o8, f.get, yZA) |
| `LbH` | MCP connection pool manager (LQ, EZ, eo9, aX8, S28, Or, …) |
| `LQ` | MCP server config loader (p66, fr, IWH, ip, O28, x66, xX) |
| `p66` | MCP server schema parser ($h, y7H) |
| `fr` | MCP auto-discovery runner (Zf, wP, $h, Object.entries, me, uD, aL, HY, …) |
| `ip` | SDK MCP server enumerator |
| `O28` | MCP error reporter (gg_, j6.red, j6.yellow) |
| `x66` | MCP server dedup/registry updater |
| `EZ` | MCP transport factory (Jw, dg_) |
| `Jw` | JSON-RPC wrapper (rAH, R6, Mq) |
| `d8` | MCP diff helper |
| `uN6` | MCP slot updater |
| `eo9` | MCP connection executor (Ud_, SWH, oX8, Date.now) |
| `Ud_` | MCP connection entry creator (n9, kW8, c6) |
| `SWH` | MCP capability hasher (CH, Array.isArray, Object.keys, yl9.createHash) |
| `oX8` | MCP tool/resource mapper (y9H, Object.keys, ZCH) |
| `aX8` | MCP schema processor (oX8, zP) |
| `zP` | MCP schema hasher (CH, HU9.createHash) |
| `iX8` | MCP result packager (pf) |
| `pf` | Packed-result builder (eI1) |
| `z8` | MCP debug logger (ycH.push, $s.logMCPDebug) |
| `S28` | MCP server session manager (ZN7, hl, GN7, N9H, h9H, m9H, d66, Or, Wm, …) |
| `hl` | Health-check poller (Wm, Kf) |
| `N9H` | MCP server health state (Yp9, lW7) |
| `m9H` | MCP OAuth server & token flow handler |
| `d66` | In-flight request tracker (Z28 map) |
| `Y` | Process-exit handler (EX, process.exit, z.abort) |
| `C28` | MCP connection state checker (n9, kW8) |
| `Or` | MCP reconnect orchestrator |
| `Wm` | MCP keepalive pinger (Kf) |
| `w` | MCP supervisor transport writer |
| `q7` | MCP error logger (ycH.push, $s.logMCPError) |
| `TH` | String coercion wrapper |
| `VN7` | MCP version negotiator |
| `EN7` | MCP SSH/environment detector (oH.isSSH, A6, hq) |
| `R28` | MCP OAuth tool registrar (hl, TN7, Q66, c66) |
| `Q66` | In-flight request getter (E28.get) |
| `c66` | Connection cache getter (Z28.get) |
| `$a9` | MCP needs-auth cache updater (NW8, Ud_, n9, kW8, CH) |
| `n9` | AsyncLocalStorage store getter (Ed4.getStore) |
| `kW8` | Cache-file path builder (IW8.join, $_) |
| `KQ_` | MCP auth-token exchanger (zP, pf, z8, TH) |
| `j` | Worker pool map (A.values, S.kill) |
| `S` | Worker process manager (I6f, L5, N, kH, bI5, w.write) |
| `Yh` | MCP skills telemetry reporter ($6, `tengu_mcp_skills`) |
| `$6` | Skill entry builder (W06, G06, em, KXH.has, H38, X06.add, qg) |
| `Qg_` | MCP tool-call router (P8, A.includes) |
| `P8` | MCP tool invocation dispatcher (J38, MT, H, zXH, aK9, h06, N, …) |
| `I` | MCP interceptor chain (ks, A) |
| `ks` | MCP interceptor runner (of) |
| `Ka9` | MCP concurrency guard (bg) |
| `bg` | Promise pool / concurrency limiter |
| `J86` | MCP server index parser (parseInt) |
| `SW8` | MCP slot index parser (parseInt) |
| `_o8` | MCP connection result applier (H.applyMcpUpdate, fbH, z8, wG, rY) |
| `fbH` | MCP connection fingerprint builder (SWH) |
| `wG` | MCP cleanup orchestrator (D86, K.cleanup, Yh) |
| `D86` | MCP server state resetter (SWH) |
| `$` | MCP state accessor (FPK) |
| `FPK` | Daemon-status file writer (bs, Date.now, n9, dU6, CH) |
| `bs` | zlib/logging helper (zLH) |
| `dU6` | Daemon-status path builder (BPK.join, $_) |
| `yZA` | MCP retry/reconnect loop (Object.entries, A.filter, _.getClients, J28, LbH, _o8) |
| `J28` | MCP server allowlist checker (rv7.has, ag_.has) |
| `l8` | Promise timeout wrapper (K, Error, q, setTimeout, clearTimeout) |
| `X2` | Keybinding registrar (Iz8, kz8, NY9, d, tH, K6) |
| `Iz8` | Keybinding config loader (SSH) |
| `SSH` | Settings-file keybinding parser (PS_, Ng, Zf, r5H, JY9.readFileSync, c6, bH, Nz8, …) |
| `PS_` | Default-keybinding schema loader (Zz8) |
| `Ng` | Keybinding action registry ($6) |
| `Zf` | Keybinding context builder (RK, XL) |
| `r5H` | Keybinding file path builder (yz8.join, $_) |
| `c6` | JSON parser (JSON.parse) |
| `Nz8` | Keybinding array validator (Array.isArray, H.every) |
| `Zz8` | Default keybinding expander (Object.entries, _.push, Yp) |
| `XY9` | Keybinding telemetry reporter (d, `tengu_keybinding_customization_release`) |
| `JS_` | Duplicate-key detector in keybinding JSON (A.exec, H.slice, $.exec, O.get/set) |
| `XS_` | Keybinding block validator (A.push, De4, Nz8, je4, Xe4, Je4) |
| `kz8` | Keybinding action resolver (ZS_, $Y9, t6) |
| `ZS_` | Action-string parser (ES_) |
| `ES_` | Action-string tokenizer (asH) |
| `$Y9` | Platform-keybinding selector (H.map, qe4) |
| `qe4` | Keybinding chord assembler (A.push, MY9, A.join) |
| `K6` | Fallback keybinding emitter (nM6, `tengu_keybinding_fallback_used`) |
| `ggH` | Locale/language code checker (H.toLowerCase, rhA.has, _.split) |
| `R6` | Global config reader (Q6, MT, NN_, G5H, Date.now, ng4) |
| `G5H` | Config file loader (Error, Q6, q.readFileSync, c6, Jm, _, Z8, sK9, …) |
| `Jm` | YAML/JSON front-matter stripper (H.startsWith, H.slice) |
| `sK9` | Config directory scanner (Q6, xD.basename, yN_, _.readdirStringSync, …) |
| `yN_` | Config path joiner (xD.join, $_) |
| `ng4` | Config file watcher (MT, w38.watchFile, Q6, Mq, Jm, NN_, Kg, m9) |
| `m9` | File-watch registration (XyA.register) |
| `D` | Background session dispatcher (A.get, d, b.kill, l8, H, bH, IH, …) |
| `b` | Background session worker (bRH, w, N, bs, keH, Date.now, pZ9, …) |
| `Dd8` | Background low-memory reporter (t6, $6, `tengu_bg_low_mem_mb`) |
| `aSH` | Temp-file cleanup helper (cJ.lstat, cT6, H.isFile, cJ.rm, cJ.readFile, …) |
| `Q` | Background PTY connection manager (l.on, Z8, c, l.once, C, process.kill, …) |
| `EVA` | Background session claimer (ed.claim, k2A, fI5, KI5, d, GL, TH, …) |
| `yVA` | Background session lifecycle manager (q.add, L.finally, EO.rm, kH, Oq, …) |
| `B` | Background session metadata holder |
| `ng4` | Config watcher (MT, w38.watchFile, Q6, Mq, Jm, NN_, Kg, m9) |
| `Kg` | Config-change debouncer |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.