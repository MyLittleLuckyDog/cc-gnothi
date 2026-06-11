---
type: feature-spec
feature: "fast"
cc_version: "2.1.170"
updated: "2026-06-11"
tags: ["fast", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.170 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/fast`

> Analysis basis: CC v2.1.170 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.170

---

## Overview

The `/fast` command toggles "Fast mode" (a research preview feature that uses a higher-capability model tier, currently backed by Claude Opus 4.8) on or off for the current session. It accepts an optional `[on|off]` argument for direct state setting; without an argument it opens an interactive picker UI. Availability is gated by subscription tier, organizational policy, API provider compatibility, and a real-time org-status check.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `fast` |
| description | `Toggle fast mode ( ... )` |
| argumentHint | `[on\|off]` |
| immediate | `null` |
| thinClientDispatch | `control-request` |
| isHidden | `null` |
| module_id | `h4K` |
| load_inline | `true` |
| loc_byte | `12601800` |
| loc_byte_end | `12602072` |
| loc_line | `8893` |
| arbor_handler.name | `hBf` |
| arbor_handler.fqn | `claude-2.1.170::hBf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `3` |

Analysis basis: CC v2.1.170 bundle.js:+12601800

---

## Input Branching

The command has more than 3 distinct paths depending on argument value, Fast mode availability state, and UI interaction outcome.

```mermaid
flowchart TD
    A["/fast [arg]"] --> B{Argument provided?}
    B -- "arg = 'on'" --> C[Force Fast mode ON]
    B -- "arg = 'off'" --> D[Force Fast mode OFF]
    B -- "no arg" --> E[Open interactive picker UI]

    C --> F{Availability check}
    D --> G[Write fastMode=false to settings\nEmit tengu_fast_mode_toggled]
    E --> H{User interaction}

    F --> F1{API provider compatible?}
    F1 -- "Not Anthropic direct API\n(bedrock, foundry, vertex, etc.)" --> F2[Show error:\n'Fast mode is only available\nwhen using the Anthropic API directly']
    F1 -- "Agent SDK context" --> F3[Show error:\n'Fast mode is not available in the Agent SDK']
    F1 -- "Anthropic API" --> F4{Org status check}

    F4 -- "pending" --> F5[Show:\n'Checking fast mode availability\n(org status pending)']
    F4 -- "network_error" --> F6[Show:\n'Fast mode unavailable due to\nnetwork connectivity issues']
    F4 -- "free tier" --> F7[Show:\n'Fast mode requires a paid subscription']
    F4 -- "evaluation tier" --> F8[Show:\n'Fast mode unavailable during evaluation.\nPlease purchase credits.']
    F4 -- "org policy disabled" --> F9[Show:\n'Fast mode has been disabled\nby your organization']
    F4 -- "extra_usage_disabled" --> F10[Show:\n'Fast mode requires usage credits\n· /usage-credits to turn them on']
    F4 -- "overloaded" --> F11[Show:\n'Fast mode overloaded and is\ntemporarily unavailable']
    F4 -- "rate limited" --> F12[Show:\n"You've hit your fast limit · resets in <time>"]
    F4 -- "available" --> F13[Write fastMode=true to settings\nEmit tengu_fast_mode_toggled]

    H -- "escape / cancel" --> H1[Dismiss, no change]
    H -- "toggle selection" --> H2[Toggle highlighted option]
    H -- "enter / confirm" --> H3{Selected option}
    H3 -- "ON" --> F
    H3 -- "OFF" --> G
    H3 -- "Kept OFF" --> H1

    F2 --> Z[Return message to user]
    F3 --> Z
    F5 --> Z
    F6 --> Z
    F7 --> Z
    F8 --> Z
    F9 --> Z
    F10 --> Z
    F11 --> Z
    F12 --> Z
    F13 --> Z
    G --> Z
    H1 --> Z
```

Analysis basis: CC v2.1.170 bundle.js:+12600835, +2238026, +2238094, +2238291, +2238453, +2237519, +2237586, +2237677, +2237761, +2237858, +12600044, +12600098

---

## Behavioral Spec

### Handler Entry Point (`hBf`)

The primary handler is the async function `hBf` resolved via `module_id` → `h4K`.

```
async function handleFastCommand(args, appState):
    arg = args[0]?.trim().toLowerCase()  // "on", "off", or undefined

    // Prefetch org availability in background
    prefetchFastModeAvailability()       // calls orgStatusChecker (v8H → Y6 → ...)

    if arg == "off":
        setFastMode(false, appState)
        emitTelemetry("tengu_fast_mode_toggled", { value: false })
        return renderStatusMessage("Fast mode OFF")

    if arg == "on" or arg == "yes":
        result = await checkFastModeAvailability(appState)
        if result.available:
            setFastMode(true, appState)
            emitTelemetry("tengu_fast_mode_toggled", { value: true })
            return renderStatusMessage("Fast mode ON")
        else:
            return renderUnavailableMessage(result.reason)

    // No argument: open picker UI
    emitTelemetry("tengu_fast_mode_picker_shown")
    return renderPickerComponent(appState)
```

Analysis basis: CC v2.1.170 bundle.js:+12600835, +12600847, +12600849, +12600897, +12600969, +12601058, +12601060, +12601119

---

### Availability Gating (`availabilityChecker` — maps to `v8H`)

```
function checkFastModeAvailability(appState):
    provider = getApiProvider(appState)   // q4 → r_ → _6

    // Provider compatibility
    if provider in ["bedrock", "foundry", "anthropicAws", "mantle", "vertex"]:
        return { available: false, reason: "api_only" }
        // message: "Fast mode is only available when using the Anthropic API directly"

    if isAgentSdkContext(appState):       // Au
        return { available: false, reason: "sdk" }
        // message: "Fast mode is not available in the Agent SDK"

    authType = getAuthType(appState)      // "oauth" or "api-key"
    orgStatus = fetchOrgStatus(appState)  // Y6 → uP6/mP6/Lm/D78/WT_

    switch orgStatus:
        case "pending":
            return { available: false, reason: "pending" }
        case "network_error":
            return { available: false, reason: "network_error" }
        case "free":
            return { available: false, reason: "free" }
        case "evaluation":
            return { available: false, reason: "evaluation" }
        case "preference" (org disabled):
            return { available: false, reason: "org_disabled" }
        case "extra_usage_disabled":
            return { available: false, reason: "usage_credits" }
        default:
            return { available: true }
```

Analysis basis: CC v2.1.170 bundle.js:+2238006, +2238026, +2238094, +2238129, +2238178, +2238219, +2238256, +2238270, +2106005, +2106055, +2106111, +2106165, +2106213

---

### Org Status Prefetch (`orgStatusPrefetcher` — maps to `qlH`)

The handler proactively fetches org status before user interaction to minimize latency. A de-duplication guard prevents redundant in-flight requests.

```
async function prefetchOrgStatus(appState):
    if inFlightPromise exists:
        log("Fast mode prefetch in progress, returning in-flight promise")
        return inFlightPromise

    lastFetchTime = getLastFetchTimestamp()
    now = Date.now()
    if (now - lastFetchTime) < RECENT_THRESHOLD:
        log("Skipping fast mode prefetch, fetched recently")
        return cachedResult

    // Resolve auth
    auth = await resolveAuth(appState)       // NML → o1 → sSA/TD4
    if not auth:
        log("No auth available")
        return null

    // Perform HTTP request
    response = await fetchOrgStatus(auth)    // RB → dhL → ...

    // Handle 401/403
    if response.status == 401:
        handleOAuthRecovery(appState)
    if response.status == 403:
        return { status: "forbidden" }

    storeResult(response)
    return response
```

Telemetry emitted on failure: `tengu_org_penguin_mode_fetch_failed` (bundle.js:+2243220)

Analysis basis: CC v2.1.170 bundle.js:+12600897, +2241712, +2241718, +2241734, +2241801, +2242021, +2242048, +2242224, +2242317, +2242359, +2242385, +2242520, +2242764, +2242801, +2242851

---

### Interactive Picker UI (`fastModePickerComponent` — maps to `Yp8` / `Dp8`)

When `/fast` is invoked without arguments, a JSX picker component is rendered.

```
function renderFastModePicker(appState):
    currentFastModeState = appState.fastMode   // reads "fastMode" key
    modelLabel = "Opus 4.8"                    // literal at +2238861

    options = [
        { label: "Fast mode ON",  value: true  },
        { label: "Fast mode OFF", value: false },
        { label: "Kept Fast mode OFF", value: null }
    ]

    // Key bindings registered
    bind("escape" / "cancel")  → dismiss picker, no change
    bind("tab")                → toggle selection between options
    bind("enter" / "confirm")  → apply selected option

    // Status overlays shown inside picker
    if fastModeState == "overloaded":
        showOverlay("Fast mode overloaded and is temporarily unavailable")
    if rateLimited:
        showOverlay("You've hit your fast limit · resets in <duration>")

    // Documentation link shown
    docsUrl = "https://code.claude.com/docs/en/fast-mode"

    title = " Fast mode (research preview)"

    onConfirm(selected):
        if selected == true:
            result = await checkFastModeAvailability(appState)
            if result.available:
                setFastMode(true, appState)
                emitTelemetry("tengu_fast_mode_toggled", { value: true })
            else:
                showError(result.message)
        elif selected == false:
            setFastMode(false, appState)
            emitTelemetry("tengu_fast_mode_toggled", { value: false })
        dismiss()
```

Analysis basis: CC v2.1.170 bundle.js:+12597185, +12597253, +12597332, +12597383, +12597418, +12597421, +12597483, +12597636, +12597701, +12597712, +12597786, +12597913, +12598071, +12598129, +12598491, +12598933, +12599096, +12599289, +12599381, +12599434, +12599803, +12599872, +12600044, +12600098, +12600318

---

### Fast Mode State Persistence (`fastModeStateSetter`)

```
function setFastMode(enabled: boolean, appState):
    // Writes "fastMode" key to settings layer
    updateAppState({ fastMode: enabled })
    // Triggers config save with lock (k78 / W8 path)
    saveConfigWithLock(settings)
```

The `fastMode` key name is confirmed at bundle.js:+12596534. The cooldown mechanism resets fast mode after a cooldown period expires:

```
function handleCooldownExpiry():
    log("Fast mode cooldown expired, re-enabling fast mode")
    setFastMode(true, appState)
```

Analysis basis: CC v2.1.170 bundle.js:+12596534, +2239238, +2239250, +2239278, +2239291

---

### Random Jitter on Background Operations (`jitterDelay` — maps to `H`)

A utility used within background fetch paths applies random jitter to avoid thundering-herd effects:

```
function withJitter(baseMs):
    jitter = Math.random() * 2   // literal: 2 at +13939350
    setTimeout(callback, baseMs + jitter)
```

Analysis basis: CC v2.1.170 bundle.js:+13939352, +13939389

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_fast_mode_toggled` | Fired on every successful toggle (on or off); bundle.js:+12597271 |
| Telemetry: `tengu_fast_mode_picker_shown` | Fired when the interactive picker UI is opened (no-argument invocation); bundle.js:+12601060 |
| Telemetry: `tengu_penguins_off` | Fired when the org status check determines fast mode is unavailable; bundle.js:+2238132 |
| Telemetry: `tengu_org_penguin_mode_fetch_failed` | Fired when the org-status HTTP fetch fails; bundle.js:+2243220 |
| Telemetry: `tengu_config_lock_contention` | Fired if config save lock takes longer than expected; bundle.js:+3306022 |
| Telemetry: `tengu_config_stale_write` | Fired if a stale config write is detected; bundle.js:+3306158 |
| Telemetry: `tengu_config_auth_loss_prevented` | Fired if a write would have clobbered auth credentials; bundle.js:+3306501 |
| Telemetry: `tengu_config_parse_error` | Fired on config file parse failure; bundle.js:+3308597 |
| Telemetry: `tengu_oauth_401_*` | OAuth 401 recovery events fired by auth sub-system during org-status fetch; bundle.js:+3256655, +3257382, +3257820, +3258057, +3258319 |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` | Feature flag evaluation events; bundle.js:+1014205, +1014267, +1014348 |
| appState changes | `fastMode` boolean key updated; reads/writes persist via locked config save |
| Hook registration | `N9` → `LTA.register` registers a cleanup/signal handler; bundle.js:+62328 |
| File I/O | Config saved to disk with lock (backup rotation, up to 5 backups; `backups` key literal at +3307534) |
| Model used when ON | `claude-opus-4-8` (literal at +12597398); displayed label "Opus 4.8" |
| Docs URL | `https://code.claude.com/docs/en/fast-mode` shown in picker UI |
| thinClientDispatch | `control-request` — command is dispatched as a control request in thin-client mode |

---

## Version History

| Version | Change |
|---|---|
| v2.1.170 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/fast on` on a non-Anthropic API provider** — The command will immediately return an error ("Fast mode is only available when using the Anthropic API directly") when the active provider is Bedrock, Vertex, Foundry, Mantle, or similar. Switch to the direct Anthropic API before enabling Fast mode.

2. **Expecting `/fast on` to work on free or evaluation accounts** — Fast mode requires a paid subscription with usage credits. Users on the free tier receive a clear error message; evaluation-tier users are directed to purchase credits.

3. **Invoking `/fast on` in an Agent SDK context** — Fast mode is explicitly unavailable when Claude Code is running inside the Agent SDK; a distinct error message is shown ("Fast mode is not available in the Agent SDK").

4. **Ignoring the `[on|off]` argument hint** — Passing any value other than `on`, `off`, `yes` (for on), or no argument at all will fall through to the picker UI, which may surprise automation scripts expecting a direct toggle.

5. **Assuming Fast mode persists across sessions without verification** — The org-status check is re-run at startup and can flip Fast mode off (e.g., if org policy changes or the account's subscription lapses). The `tengu_penguins_off` telemetry event signals this condition.

6. **Not accounting for the "overloaded" transient state** — Even with a valid subscription, Fast mode may report as temporarily overloaded. The picker UI shows this status and the command should be retried later.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `hBf` | Primary async handler for `/fast` command (arbor_handler) |
| `q4` | API provider type resolver |
| `r_` | Provider string normalizer |
| `_6` | String coercion utility |
| `H` | Jitter/random delay utility (also used as generic accumulator in some contexts) |
| `v8H` | Fast mode availability gate / org-status check orchestrator |
| `Y6` | Org status fetch dispatcher |
| `uP6` | Org status sub-handler (branch A) |
| `mP6` | Org status sub-handler (branch B) |
| `Lm` | Org status sub-handler (branch C) |
| `nu` | Config accessor utility |
| `D78` | Org status cache/experiment tracker |
| `Gw_` | GrowthBook experiment event emitter |
| `WT_` | Org status write-back handler |
| `h6` | File-system context resolver |
| `n6` | Path/node resolution utility |
| `hT_` | File watcher helper |
| `B7H` | Config file reader/writer with backup |
| `BSL` | File watch lifecycle manager |
| `N` | Message/notification dispatcher |
| `PeK` | Debug-mode logger |
| `MTA` | Log level handler |
| `CH` | JSON serializer wrapper |
| `u4` | API key redaction helper |
| `FZA` | Key map formatter |
| `q` | Axios/HTTP client (also generic) |
| `A` | String utility (toLowerCase etc.) |
| `zFH` | Terminal write helper |
| `yZA` | Raw write wrapper |
| `EeK` | Config file writer (append/create) |
| `mBH` | Debounced flush utility |
| `L4H` | Config path builder |
| `$M6` | File validation helper |
| `cZA` | Config path joiner |
| `La8` | File rename/atomic-write helper |
| `TeK` | Config append/write executor |
| `N9` | Cleanup hook registrar |
| `y8` | Settings loader |
| `Ro6` | Settings cache reader |
| `CGA` | Settings cache lookup (has/get) |
| `Hq_` | Settings merger |
| `bGA` | Settings cache writer (set) |
| `XB` | Settings object builder |
| `W_` | WSL environment detector |
| `sf6` | Settings field extractor |
| `bi8` | Settings boolean field reader |
| `if6` | Settings integer field reader |
| `wZH` | Settings string field reader |
| `JZH` | Settings array field reader |
| `ef6` | Settings object field reader |
| `CYH` | Settings enum field reader |
| `bYH` | Settings optional field reader |
| `Jq_` | Settings default applier |
| `SQA` | Settings schema validator |
| `to` | Settings override handler |
| `Nz6` | Platform/environment info builder |
| `F_` | VS Code extension environment detector |
| `hBH` | "claude-vscode" client check |
| `Au` | Agent SDK context detector |
| `y_8` | Settings key accessor |
| `ZML` | Zustand-like state selector |
| `qlH` | Org-status prefetch orchestrator |
| `Tz_` | Prefetch inner flow coordinator |
| `hq` | Network traffic policy checker |
| `ImA` | Traffic policy string reader |
| `O0` | Auth resolver top-level |
| `qO` | Auth resolution strategy selector |
| `a7` | Git bare-repo detector |
| `mv` | Auth method combiner |
| `WP6` | API key helper validator |
| `$P` | Auth "none" handler |
| `ND6` | File-descriptor key reader |
| `Aj` | OAuth profile builder |
| `sL` | Auth strategy lister |
| `bC` | Response body slicer (20-byte preview) |
| `HE` | Array/string inclusion checker |
| `NML` | Auth token accessor |
| `o1` | OAuth endpoint resolver |
| `sSA` | Environment/endpoint detector |
| `TD4` | Staging/prod URL selector |
| `RB` | Org-status HTTP fetcher with retry map |
| `dhL` | Org-status HTTP response processor |
| `oa` | HTTP request builder |
| `pf6` | Response field extractor |
| `d` | Logging utility (generic) |
| `SH` | Feature flag "ok" reporter |
| `SiH` | OAuth token expiry checker |
| `xH` | Feature flag "bad" reporter |
| `IB` | File-descriptor OAuth token reader |
| `y4` | Axios error handler |
| `fo` | Org-status result formatter |
| `of6` | Org-status field mapper |
| `hH` | Streaming response handler |
| `QhL` | Org-status response validator |
| `SH9` | Retry-after / backoff calculator |
| `_O` | Org-status cache clean-up |
| `e_` | Settings load-from-disk executor |
| `I$` | Settings initial loader |
| `SYH` | Settings file path resolver |
| `E2` | Settings file reader pipeline |
| `co` | Raw settings file reader |
| `k8` | File read-error classifier |
| `V8` | Generic error constructor |
| `z9_` | Settings load timestamp recorder |
| `wvH` | Settings resolved-path emitter |
| `So6` | Settings base-path resolver |
| `xO6` | Atomic file write utility |
| `O` | Process/stream utility |
| `f` | File handle wrapper |
| `hO` | Settings cache invalidator |
| `Fr6` | Gitignore rule writer |
| `C6` | Git context detector |
| `n1_` | Gitignore file opener |
| `Br6` | Git check-ignore runner |
| `ty4` | Git global excludesfile resolver |
| `YFA` | Gitignore entry appender |
| `DFA` | Gitignore write-result labeller |
| `Ru` | Settings file path joiner (.claude) |
| `s6` | Feature flag "sad" reporter |
| `K6` | Feature flag event builder |
| `PB` | Settings save-to-disk executor |
| `bZ` | Settings pre-write validator |
| `_q` | Memory usage sampler |
| `_q_` | Settings save pipeline |
| `yF6` | Settings post-write notifier |
| `W8` | Global config file saver |
| `k78` | Global config file writer with backup rotation |
| `L` | Async operation tracker |
| `JE1` | Config diff/merge helper |
| `liH` | Config lock acquisition helper |
| `CT_` | Config backup path builder |
| `V` | Config backup version string |
| `P` | Streaming buffer processor |
| `E` | Numeric range utility |
| `ZJH` | Config stale-write detector |
| `K69` | Config entries iterator |
| `QP6` | Config save timestamp recorder |
| `I78` | Config fallback writer |
| `K` | Column formatter (padEnd) |
| `Yp8` | Fast mode picker JSX component |
| `zp8` | Picker option list builder |
| `oDH` | Picker option disabled-state resolver |
| `_X` | Picker option label formatter |
| `BL` | ANSI escape string builder |
| `AlH` | Picker model name formatter |
| `m2` | Picker model label resolver |
| `ZTH` | Flag/setting schema descriptor (String/Number/Boolean wrappers) |
| `eM` | Picker current-state reader |
| `yG` | Model name canonical resolver |
| `B9` | Model alias normalizer |
| `ETH` | Theme/color picker renderer |
| `Mm` | Theme option list builder |
| `X26` | Color scheme light/dark/auto selector |
| `Ef8` | Theme name validator |
| `$F` | Theme prefix stripper |
| `x_9` | Theme miscellaneous helper |
| `r4` | Legacy global config migration helper |
| `Ev` | Deprecated config field tracker |
| `yA` | Terminal foreground color renderer |
| `UJH` | ANSI/RGB/hex color code emitter |
| `vl` | Color name-to-code mapper |
| `SB` | Status badge renderer |
| `z9` | Picker model selector component |
| `Bc` | Model list builder |
| `tY` | Model tier labeller |
| `QU` | Model capability descriptor |
| `Uh` | Model display-name formatter |
| `JD` | Model alias/display handler |
| `ph` | Token/cost formatter |
| `vT1` | Number fixed-point formatter |
| `LNH` | Picker reset-limit helper |
| `W1` | Model context-window descriptor |
| `_88` | Settings entry iterator |
| `eJ` | Header name normalizer |
| `Er8` | Model tier enum |
| `E3` | Model description text formatter |
| `Dp8` | Fast mode picker top-level JSX component (outer shell) |
| `J6` | App state store accessor (useSyncExternalStore) |
| `wN_` | App state context reader |
| `XA` | App state snapshot accessor |
| `Wz_` | Fast mode cooldown/re-enable timer |
| `f6` | Feature flag value accessor |
| `ff6` | Feature flag store |
| `$` | Daemon status file reader |
| `f$K` | Daemon status JSON parser |
| `Xa` | Formatted status line builder |
| `hLH` | Status line trimmer |
| `m9` | Async-local-storage store getter |
| `hu6` | Daemon status file path builder |
| `SA` | MCP server connection manager |
| `ww` | MCP context reader |
| `M` | MCP server state manager |
| `aSH` | MCP server slot orchestrator |
| `pn` | MCP server config normalizer |
| `vV` | MCP server type validator |
| `F8` | MCP server name extractor |
| `BZ6` | MCP server filter |
| `Cg9` | MCP server connect initiator |
| `sD8` | MCP server disconnect handler |
| `rD8` | MCP server reconnect handler |
| `M8` | MCP debug logger |
| `bJ8` | MCP OAuth tool injector |
| `xJ8` | MCP OAuth callback handler |
| `Fg9` | MCP post-connect handler |
| `Rm_` | MCP retry scheduler |
| `J` | Process group kill set |
| `VN` | MCP server list refresher |
| `Gm_` | MCP server list diff applier |
| `y` | Warning message list |
| `U7` | MCP error logger |
| `EH` | Error string coercer |
| `mg9` | MCP server type classifier |
| `CeH` | MCP port parser (parseInt) |
| `Cj8` | MCP port fallback parser |
| `Ic8` | MCP apply-connection-result handler |
| `oSH` | MCP server state updater |
| `pE` | MCP cleanup runner |
| `IPA` | MCP remote-server retry coordinator |
| `WJ8` | MCP server capability checker |
| `o8` | Timeout/abort helper |
| `SeH` | MCP server health state reader |
| `k9` | Time duration formatter (floor/round) |