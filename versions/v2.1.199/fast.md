---
type: feature-spec
feature: "fast"
cc_version: "2.1.199"
updated: "2026-07-03"
tags: ["fast", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.199 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/fast`

> Analysis basis: CC v2.1.199 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.199

---

## Overview

The `/fast` command toggles "Fast mode" (a research-preview feature) on or off for the current session. When invoked without an argument, it opens an interactive picker UI allowing the user to choose the desired state; when called with `on` or `off` it applies the change directly. Before applying any toggle, the handler performs a prefetch of the user's fast-mode eligibility (API availability, subscription tier, org policy, and network status) and enforces multiple gate conditions that may block the toggle.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `fast` |
| description | `Toggle fast mode ( ... )` |
| argumentHint | `[on\|off]` |
| thinClientDispatch | `control-request` |
| immediate | `null` |
| isHidden | `null` |
| module_id | `vac` |
| load_inline | `true` |
| loc_byte | `13149794` |
| loc_byte_end | `13150066` |
| loc_line | `9741` |
| arbor_handler.name | `nlm` |
| arbor_handler.fqn | `claude-2.1.199::nlm` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `3` |

Analysis basis: CC v2.1.199 bundle.js:+13149794

---

## Input Branching

The command has five or more distinct execution paths depending on the argument value, current eligibility state, and several gate conditions. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/fast called"]) --> B{Argument supplied?}
    B -- "no argument" --> C[Open interactive picker UI\ntengu_fast_mode_picker_shown]
    B -- "'on' / 'yes' / '1'" --> D[Resolve intent = ENABLE]
    B -- "'off'" --> E[Resolve intent = DISABLE]
    D & E --> F[prefetchFastMode\nnlm → hc / rit]

    F --> G{Auth available?}
    G -- "no auth" --> H[Return error:\n'No auth available']
    G -- "yes" --> I{API provider check}

    I -- "bedrock / foundry /\nanthropicAws / mantle /\nvertex / firstParty" --> J[Return error:\n'Fast mode is only available\nwhen using the Anthropic API directly']
    I -- "Anthropic direct API" --> K{Agent SDK context?}

    K -- "yes" --> L[Return error:\n'Fast mode is not available\nin the Agent SDK']
    K -- "no" --> M{Org status check}

    M -- "pending" --> N[Return info:\n'Checking fast mode availability\n(org status pending)']
    M -- "network_error" --> O[Return error:\n'Fast mode unavailable due to\nnetwork connectivity issues']
    M -- "free tier" --> P[Return error:\n'Fast mode requires a\npaid subscription']
    M -- "evaluation / credits" --> Q[Return error:\n'Fast mode unavailable\nduring evaluation']
    M -- "extra_usage_disabled" --> R[Return error:\n'Fast mode requires usage\ncredits · /usage-credits']
    M -- "preference disabled\nby org" --> S[Return error:\n'Fast mode has been\ndisabled by your organization']
    M -- "currently unavailable" --> T[Return error:\n'Fast mode is currently unavailable']
    M -- "eligible" --> U{Intent?}

    U -- "DISABLE" --> V[Set fastMode=false\nPersist to config\ntengu_penguins_off]
    U -- "ENABLE" --> W[Set fastMode=true\nPersist to config]
    V & W --> X[Emit tengu_fast_mode_toggled\nReturn confirmation UI]

    C --> Y{User action in picker}
    Y -- "escape / cancel" --> Z[Dismiss: 'Kept Fast mode OFF']
    Y -- "tab → toggle" --> AA[Toggle state interactively]
    Y -- "enter → confirm" --> AB[Apply chosen state → same gate logic as D/E]
```

Analysis basis: CC v2.1.199 bundle.js:+13148799 (handler entry `nlm`), +2311399, +2311467, +2311814, +2311884, +2310892, +2310918, +2311050, +2311134, +2311231, +2311310

---

## Behavioral Spec

### 1. Handler Entry Point (`nlm` — AsyncFunction)

```
async function fastCommandHandler(context):
    prefetchResult = await prefetchFastModeAvailability(context)
    uiComponent   = buildFastModeComponent(prefetchResult, context)
    return JSX(uiComponent)
```

The Arbor-resolved handler is `nlm` (FQN: `claude-2.1.199::nlm`, reached via `module_id` → `vac`).
Analysis basis: CC v2.1.199 bundle.js:+13148799

---

### 2. Argument Normalisation

```
function normaliseArgument(rawArg):
    trimmed = rawArg.trim().toLowerCase()
    if trimmed in ["on", "yes", "1"]:
        return ENABLE
    if trimmed == "off":
        return DISABLE
    return PICKER          // no argument → open interactive UI
```

The string constants `"yes"`, `"on"`, and `"off"` appear as literals.
Analysis basis: CC v2.1.199 bundle.js:+29887, +29893, +13148914

---

### 3. Fast Mode Prefetch (`rit`)

```
async function prefetchFastMode(context):
    if recentlyFetched():
        log("Skipping fast mode prefetch, fetched recently")
        return cachedResult

    if inFlightPromise exists:
        log("Fast mode prefetch in progress, returning in-flight promise")
        return inFlightPromise

    authToken = resolveAuth(context)
    if not authToken:
        return { error: "No auth available" }

    apiProvider = resolveProvider(context)   // checks gateway / bedrock / vertex etc.
    if apiProvider != "anthropic-direct":
        return { error: "Fast mode is only available when using the Anthropic API directly" }

    response = await httpGetFastModeEligibility(authToken)

    switch response.status:
        case 401: handle OAuth recovery (disk / rotation / keychain / zombie-exit)
        case 403: return { error: subscription-gate message }
        case network_error: return { error: "Fast mode unavailable due to network connectivity issues" }

    return parsedEligibility
```

Analysis basis: CC v2.1.199 bundle.js:+13148861 (`rit`), +2315988 (skip-recent log), +2315740 (in-flight log), +2316164 (no-auth), +2311399 (provider gate), +2311467 (unavailable fallback)

---

### 4. Eligibility Gate Evaluation (`Mce`)

```
function evaluateGates(eligibility, orgSettings, flagSettings):
    // Agent SDK gate
    if runningInAgentSdk():
        return BLOCKED("Fast mode is not available in the Agent SDK")

    // Provider gate (re-enforced)
    if provider in [bedrock, foundry, anthropicAws, mantle, vertex, firstParty]:
        return BLOCKED("Fast mode is only available when using the Anthropic API directly")

    // Org status gates (ordered by priority)
    if orgStatus == "pending":
        return PENDING("Checking fast mode availability (org status pending)")

    if orgStatus == "free":
        return BLOCKED("Fast mode requires a paid subscription")

    if orgStatus == "evaluation":
        return BLOCKED("Fast mode unavailable during evaluation. Please purchase credits.")

    if orgStatus == "extra_usage_disabled":
        return BLOCKED("Fast mode requires usage credits · /usage-credits to turn them on")

    if orgSetting == "preference" and orgDisabled:
        return BLOCKED("Fast mode has been disabled by your organization")

    if orgStatus == "network_error":
        return BLOCKED("Fast mode unavailable due to network connectivity issues")

    if eligibility == null or unavailable:
        return BLOCKED("Fast mode is currently unavailable")

    return ELIGIBLE
```

Analysis basis: CC v2.1.199 bundle.js:+2311367 (`Mce`), +2311399, +2311467, +2311814, +2310892, +2310918, +2310959, +2311050, +2311105, +2311134, +2311231, +2311310

---

### 5. Model Check for Opus 4.7 Deprecation (`ngi` / `pqo`)

```
function checkOpusDeprecation(currentModel, eligibility):
    // Sunset notice for opus-4-7 fast mode
    if currentModel includes "opus-4-7":
        emit telemetry("tengu_sunset_penguin_opus47")
        // Fast mode is not available on opus-4-7 after 2026-07-25
        // Suggest claude-opus-4-8 as replacement
    return adjustedModel
```

Relevant literals: `"opus-4-7"` (bundle.js:+2312844), `"opus-4-8"` / `"claude-opus-4-8"` (bundle.js:+2312868, +13145302), `"2026-07-25"` (bundle.js:+2312978), flag `"opus47-fast-mode-deprecation"` (bundle.js:+13144540).
Analysis basis: CC v2.1.199 bundle.js:+2312948 (`tengu_sunset_penguin_opus47`), +2311607

---

### 6. Cooldown Re-enable Logic (`EWr`)

```
function cooldownMonitor(state):
    if state == "cooldown" and cooldownExpired():
        log("Fast mode cooldown expired, re-enabling fast mode")
        setFastMode(true)
        emit telemetry via ogi
```

Analysis basis: CC v2.1.199 bundle.js:+2313177 (`"cooldown"`), +2313230 (log string), +2313189 (`EWr` → `Date.now`)

---

### 7. Interactive Picker Component (`ppr` / `dpr`)

```
function FastModePickerComponent(eligibility, currentState):
    // Renders " Fast mode (research preview)" header
    // Shows ON / OFF toggle (literals: "ON ", "OFF")
    // Keyboard bindings:
    //   Tab        → toggle
    //   Enter      → confirm
    //   Escape     → cancel → "Kept Fast mode OFF"
    // When overloaded:
    //   Show "Fast mode overloaded and is temporarily unavailable"
    // When fast limit hit:
    //   Show "You've hit your fast limit · resets in <countdown>"
    // Link rendered: https://code.claude.com/docs/en/fast-mode
    // After confirm: emit tengu_fast_mode_toggled
```

Relevant literals: `" Fast mode (research preview)"` (bundle.js:+13147120), `"Fast mode"` (bundle.js:+13147770), `"ON "` (bundle.js:+13147838), `"OFF"` (bundle.js:+13147844), `"Kept Fast mode OFF"` (bundle.js:+13146527), `"Fast mode OFF"` (bundle.js:+13145442), `"overloaded"` (bundle.js:+13147998), fast-limit message (bundle.js:+13148065), docs URL (bundle.js:+13148280).
Analysis basis: CC v2.1.199 bundle.js:+13149098 (`aw.jsx`), +13147095, +13149039 (`tengu_fast_mode_picker_shown`)

---

### 8. Config Persistence (`Hf` / `fKu` / `don`)

```
async function saveSettings(key, value):
    // key: "fastMode" in flagSettings / userSettings
    acquireLockWithTimeout()
    reReadConfig()            // guard against stale write (GH #3117)
    validateAuthPresence()    // refuse write if auth would be wiped
    appendBackup()
    writeAtomic()
    releaseLock()
```

Config key written: `"fastMode"` (bundle.js:+13144222) inside `"flagSettings"` (bundle.js:+2311752).
Analysis basis: CC v2.1.199 bundle.js:+13148861 → +1370523, +14384758 (lock warning), +14385902 (auth-loss guard)

---

### 9. OAuth 401 Recovery Path (reached via `rit` → `O$` → `m5d`)

```
async function handleOAuth401():
    attempt recovery in order:
        1. SDK callback refresh     → tengu_oauth_401_sdk_callback_refreshed
        2. Disk token read          → tengu_oauth_401_recovered_from_disk
        3. Token rotation           → tengu_oauth_401_recovered_from_rotation
        4. Keychain lookup          → tengu_oauth_401_recovered_from_keychain
        5. No refresh available     → tengu_oauth_401_zombie_exit → process.exit
```

Analysis basis: CC v2.1.199 bundle.js:+3134116, +3134844, +3135283, +3135782, +3135520

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_fast_mode_picker_shown` | Fired when the interactive picker is opened (no-argument invocation). bundle.js:+13149039 |
| Telemetry: `tengu_fast_mode_toggled` | Fired after a successful toggle (on or off). bundle.js:+13145159 |
| Telemetry: `tengu_penguins_off` | Fired specifically when fast mode is disabled. bundle.js:+2311505 |
| Telemetry: `tengu_sunset_penguin_opus47` | Fired when the current model is `claude-opus-4-7` (deprecation notice). bundle.js:+2312948 |
| Telemetry: `tengu_org_penguin_mode_fetch_failed` | Fired when the org eligibility fetch fails. bundle.js:+2317172 |
| Telemetry: `tengu_oauth_401_sdk_callback_refreshed` | OAuth recovery path. bundle.js:+3134116 |
| Telemetry: `tengu_oauth_401_recovered_from_disk` | OAuth recovery path. bundle.js:+3134844 |
| Telemetry: `tengu_oauth_401_recovered_from_rotation` | OAuth recovery path. bundle.js:+3135283 |
| Telemetry: `tengu_oauth_401_recovered_from_keychain` | OAuth recovery path. bundle.js:+3135782 |
| Telemetry: `tengu_oauth_401_zombie_exit` | OAuth unrecoverable; triggers `process.exit`. bundle.js:+3135520 |
| Telemetry: `tengu_config_lock_contention` | Emitted when config lock acquisition is slow. bundle.js:+14384847 |
| Telemetry: `tengu_config_stale_write` | Emitted when a stale config write is detected. bundle.js:+14384985 |
| Telemetry: `tengu_config_auto_repaired` | Emitted on parse-error auto-repair. bundle.js:+14385384 |
| Telemetry: `tengu_config_auth_loss_prevented` | Emitted when a write that would wipe auth is blocked. bundle.js:+14386054 |
| Telemetry: `tengu_config_fallback_write` | Emitted on fallback config write. bundle.js:+14384448 |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` | Feature-flag gate pass/fail. bundle.js:+1039941, +1040008 |
| appState changes | `flagSettings.fastMode` (boolean) persisted to user settings; `apply_flag_settings` event emitted. bundle.js:+13144222, +13144743 |
| Hook registration | `thinClientDispatch: "control-request"` — command is dispatched as a control request to the thin client. bundle.js:+13149794 |
| Cooldown re-enable | A background monitor re-enables fast mode when a cooldown period expires; logs "Fast mode cooldown expired, re-enabling fast mode". bundle.js:+2313230 |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.199 | Initial analysis. Interactive picker added; Opus 4.7 deprecation sunset (`2026-07-25`) introduced; `claude-opus-4-8` listed as replacement model. |

---

## Common Mistakes

1. **Using `/fast` with a third-party API provider (Bedrock, Vertex, etc.)** — Fast mode is restricted to Anthropic's direct API. The command will return "Fast mode is only available when using the Anthropic API directly" (bundle.js:+2311399) and make no change.
2. **Expecting `/fast on` to work on a free-tier account** — The eligibility check enforces a paid-subscription requirement; free accounts receive "Fast mode requires a paid subscription" (bundle.js:+2310918).
3. **Running `/fast` inside an Agent SDK session** — The Agent SDK context gate blocks the command unconditionally with "Fast mode is not available in the Agent SDK" (bundle.js:+2311884).
4. **Toggling while `extra_usage_disabled`** — If usage credits are disabled, the command prompts the user to run `/usage-credits` instead of toggling (bundle.js:+2311134).
5. **Relying on `claude-opus-4-7` with fast mode** — As of the `opus47-fast-mode-deprecation` flag, Opus 4.7 fast mode is being sunset on 2026-07-25; Claude Code will emit a deprecation notice and suggest `claude-opus-4-8` (bundle.js:+13144540, +2312978).
6. **Omitting the argument and expecting an immediate toggle** — Without `on`/`off`, the command opens the interactive picker; a confirmation step (Enter key) is required before the state changes (bundle.js:+13147427).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `nlm` | Main async handler for `/fast` (Arbor-resolved entry point) |
| `hc` | Auth / header-construction helper |
| `gr` | Provider/gateway resolver |
| `Vm` | Gateway provider constant helper |
| `at` | String coercion / normalisation utility |
| `Mce` | Fast-mode eligibility gate evaluator (multi-condition gating function) |
| `ot` | Subscription / org-status state reader |
| `hBt` | Org-status helper A |
| `HBt` | Org-status helper B |
| `HG` | Eligibility store accessor |
| `hG` | Inner store read helper |
| `wDn` | Feature-flag / eligibility cache deduplicator |
| `KZr` | Eligibility fetch executor (emits GrowthBook experiment event) |
| `eeo` | Eligibility response parser |
| `Mt` | Config accessor (throws on pre-init access) |
| `BJo` | Config initialisation guard |
| `GJo` | Config get-value helper |
| `hae` | Config key validator |
| `T` | Transcript / logging helper |
| `gdu` | Debug log formatter |
| `vfs` | Log stream writer (Slu / Alu) |
| `xe` | JSON serialiser wrapper |
| `Nc` | Log-path sanitiser (redacts sensitive tokens) |
| `phs` | Path-map helper |
| `ntt` | Log-file write initiator |
| `ths` | Raw stream write helper |
| `Sdu` | Buffered log writer with file rotation |
| `Let` | Debounced flush scheduler (clearTimeout / setTimeout / setImmediate) |
| `Ile` | Log-line assembler |
| `ydu` | Async append-file writer (mkdir + appendFile) |
| `Ai` | Signal / hook registrar (bfs.register) |
| `zt` | Config-file path resolver |
| `yle` | EISDIR-aware file-write helper |
| `hhs` | Path-join + file-key helper |
| `za` | Prompt / message context builder (large, multi-branch) |
| `mOt` | Tool-list builder |
| `OOs` | Tool filter |
| `POs` | Tool-entry constructor |
| `gOt` | Tool-map builder |
| `OLe` | Remote-managed settings accessor |
| `t9` | Tool definition schema builder |
| `pce` | Tool parameter encoder |
| `dOt` | Tool definition delegator |
| `qne` | Normalised-text parser for prompt context |
| `Zi` | Whitespace / special-char normaliser |
| `Uw` | Model-name validator (eye.includes list) |
| `Bo` | Model-name resolver (alias → canonical) |
| `io` | Application-inference-profile checker |
| `VV` | Context-window / token-limit builder |
| `Bwd` | Token-set accumulator |
| `UNt` | Array-type config reader |
| `Wfc` | Message-history formatter |
| `VN` | SDK/ID-list inclusion checker |
| `uvn` | Unified content normaliser |
| `NNt` | Model-family prefix classifier |
| `wgi` | Object-entries content walker |
| `kn` | Policy-settings reader |
| `iyn` | Policy-key resolver |
| `Rst` | Remote settings object-entries walker |
| `Lr` | Settings inheritance resolver |
| `vgi` | VN + indexOf content search helper |
| `Gwd` | Guard: model + content-type gate |
| `kWr` | indexOf-based content searcher |
| `Wwd` | Additional guard (startsWith checks) |
| `Cgi` | Prefix-start checker |
| `g4e` | JSX rendering helper for fast-mode status UI |
| `yb` | Status-chip component builder |
| `uye` | Status string converter |
| `pye` | Pro-tier indicator helper |
| `So` | Chip container layout component |
| `Oi` | Pro-badge renderer |
| `ks` | Model-picker state manager |
| `W6` | Model-list builder for picker |
| `u_` | Model-list sorter |
| `x3` | Model-entry formatter |
| `MH` | Model-row click handler |
| `fv` | Full model-detail resolver |
| `f_` | Flag-settings accessor wrapper |
| `Vl` | Flag key constant provider |
| `jte` | Individual flag-key definitions |
| `Sg` | Fast-mode status string builder (`fast_mode` field) |
| `x$` | Context-derived display-name resolver |
| `hx` | Display-name inner helper |
| `B6` | Beta-feature flag checker |
| `Hr` | VS Code host detector (`claude-vscode`) |
| `Aet` | Host-type resolver |
| `ovn` | Auth-type extractor (oauth / api-key) |
| `Rwd` | Rendering wrapper |
| `rit` | Fast-mode prefetch function (network + cache) |
| `AWr` | Pre-fetch header builder |
| `Pi` | KTs-based traffic-policy enforcer |
| `KTs` | Traffic-category matcher (essential-traffic, no-telemetry, default) |
| `jne` | Auth-flow orchestrator |
| `F6` | Auth-flow entry |
| `Jw` | Token-resolution core (API key / OAuth / WIF) |
| `Gw` | Auth-type gate (Array.isArray check) |
| `Dwd` | Cached-auth reader |
| `Fs` | Auth endpoint builder |
| `OTs` | Endpoint config resolver |
| `Oku` | URL formatter |
| `O$` | OAuth-401 recovery dispatcher |
| `m5d` | OAuth-401 multi-strategy recovery loop |
| `z$` | Token-storage abstraction |
| `l0t` | Token expiry calculator |
| `V` | Config value reader |
| `Le` | Config key reader (variant A) |
| `nlt` | Token liveness checker (Date.now + Boolean) |
| `we` | Config key reader (variant B) |
| `UV` | OAuth file-descriptor token reader |
| `Cl` | Mhi-based credential helper |
| `Bte` | Token response validator |
| `A0t` | Auth assignment helper |
| `ke` | Token-error logger (fne.logError + knt.push) |
| `f5d` | Refresh backoff calculator |
| `JPi` | Exponential-backoff + jitter helper (Math.min / Math.max) |
| `qg` | Post-refresh state emitter |
| `Qo` | Settings-load orchestrator |
| `Hf` | Config-file read-with-cache helper |
| `Qh` | Settings type dispatcher |
| `fKu` | Full settings loader (mkdir, readFile, parse, merge) |
| `Hn` | Session-init / config-bootstrap function |
| `Hbc` | Session-start timestamp recorder |
| `oon` | Object-entries settings merger |
| `Wgr` | Nested object-entries walker |
| `Ygr` | Concurrent settings-load deduplicator (qgr Map) |
| `WJo` | Settings-save atomic helper |
| `YTm` | Settings-save orchestrator |
| `don` | Atomic config file writer with backup rotation |
| `con` | Config-write pre-validation helper |
| `lon` | Config-path resolver (Zgr) |
| `che` | Config-contents comparator |
| `Jgr` | Lock-protected config writer |
| `dpr` | Fast-mode UI rendering root (JSX tree builder) |
| `upr` | Sub-component prop assembler |
| `r0e` | Rendering context getter |
| `JFe` | Prop type coercion (String / Number / Boolean) |
| `Pe` | GZe-based React element factory |
| `GZe` | React element primitive |
| `XFe` | Theme-aware text renderer |
| `f2` | Theme resolver (HGe + $Pn + SG + g8i) |
| `HGe` | Theme-entry builder |
| `$Pn` | Theme-inclusion checker |
| `SG` | Theme-prefix stripper |
| `g8i` | Theme palette provider |
| `yc` | Config-load gating wrapper (legacyGlobalConfig) |
| `HT` | Permission-set manager (OI.filter) |
| `GLe` | tX.resolve-based settings path builder |
| `Lo` | Foreground colour resolver (rgb / ansi256 / ansi) |
| `tRe` | Chalk/St colour tag parser |
| `_J` | ANSI colour fallback |
| `eU` | Number formatter (integer / fixed) |
| `mgi` | Number.isInteger + toFixed formatter |
| `oit` | hc-based short-circuit output helper |
| `pqo` | Date-parse / org-cooldown check |
| `ngi` | Date + numeric validation helper |
| `ppr` | Main React component for fast-mode picker UI |
| `yt` | App-state hook (useSyncExternalStore) |
| `pso` | App-state context reader |
| `Fi` | Control-flow handler (keyboard events + confirmation logic) |
| `Ic` | Derived state selector A |
| `No` | Derived state selector B |
| `$s` | Clock context consumer |
| `rrp` | Reducer / accumulator for confirmation state |
| `a` | Spend-limit / billing-check helper |
| `Whe` | JSON.stringify-based spend-event builder |
| `fQi` | Additional UI fold helper |
| `u` | Daemon fold / shutdown orchestrator |
| `n2` | New conversation / session emitter |
| `B6e` | bx-based session object builder |
| `qZr` | Session UUID emitter (jZr.randomUUID) |
| `w8` | Promise.race / Promise.all shutdown racer |
| `yEe` | _Ee.shutdown invoker |
| `wEe` | clearTimeout + XJo cleanup |
| `On` | Timed abort-with-unref helper |
| `H9t` | UI teardown helper |
| `EWr` | Cooldown-expiry monitor (Date.now + ogi.emit) |
| `qe` | GZe element builder variant |
| `c` | ln-based rendering context |
| `ln` | Low-level rendering primitive |
| `jo` | Global keyboard handler registrar (registerHandler) |
| `dA` | ddt.useContext-based dispatch accessor |
| `ha` | Time-remaining formatter (Math.floor / Math.round) |