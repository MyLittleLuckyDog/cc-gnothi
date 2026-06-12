---
type: feature-spec
feature: "fast"
cc_version: "2.1.175"
updated: "2026-06-12"
tags: ["fast", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.175 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/fast`

> Analysis basis: CC v2.1.175 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.175

---

## Overview

The `/fast` command toggles "Fast mode" (a research-preview feature that uses a higher-throughput inference path) on or off for the current Claude Code session. It accepts an optional `on` or `off` argument; when no argument is supplied the command opens an interactive picker UI. Before applying the toggle the command validates that Fast mode is available for the current API provider, subscription tier, and organization policy.

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
| module_id | `i3K` |
| load_inline | `true` |
| loc_byte | `12720930` |
| loc_byte_end | `12721202` |
| loc_line | `8906` |
| arbor_handler.name | `Ar7` |
| arbor_handler.fqn | `claude-2.1.175::Ar7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `3` |

Analysis basis: CC v2.1.175 bundle.js:+12720930

---

## Input Branching

Six or more distinct availability states drive the command's early-exit logic, plus a separate branch for the interactive picker vs. explicit `on`/`off` argument, so a flowchart is required.

```mermaid
flowchart TD
    A(["/fast [on|off]"]) --> B{Provider check}
    B -- "bedrock / foundry / anthropicAws / mantle / vertex / firstParty ≠ direct Anthropic API" --> C["Error: Fast mode is only available when using the Anthropic API directly\n(bundle.js:+2244822)"]
    B -- "Agent SDK context" --> D["Error: Fast mode is not available in the Agent SDK\n(bundle.js:+2245087)"]
    B -- "Direct Anthropic API" --> E{Org status}

    E -- "pending" --> F["Warning: Checking fast mode availability (org status pending)\n(bundle.js:+2245249)"]
    E -- "network_error" --> G["Error: Fast mode unavailable due to network connectivity issues\n(bundle.js:+2244654)"]
    E -- "resolved" --> H{Subscription / policy gate}

    H -- "free tier" --> I["Error: Fast mode requires a paid subscription\n(bundle.js:+2244341)"]
    H -- "evaluation credits" --> J["Error: Fast mode unavailable during evaluation. Please purchase credits.\n(bundle.js:+2244382)"]
    H -- "org disabled by preference" --> K["Error: Fast mode has been disabled by your organization\n(bundle.js:+2244473)"]
    H -- "extra_usage_disabled" --> L["Error: Fast mode requires usage credits · /usage-credits to turn them on\n(bundle.js:+2244557)"]
    H -- "generic unavailable" --> M["Error: Fast mode is currently unavailable\n(bundle.js:+2244733)"]
    H -- "available" --> N{Argument supplied?}

    N -- "\"off\" argument" --> O["Disable Fast mode, persist setting\n(bundle.js:+12720045)"]
    N -- "\"on\" / \"yes\" / truthy argument" --> P["Enable Fast mode, persist setting\n(bundle.js:+28042, +28048)"]
    N -- "no argument" --> Q["Open interactive Fast mode picker UI\n(bundle.js:+12720170)"]

    O --> R["Emit tengu_fast_mode_toggled\n(bundle.js:+12716249)"]
    P --> R
    Q --> S{User interaction}
    S -- "confirm / enter" --> P
    S -- "escape / cancel" --> T["Kept Fast mode OFF\n(bundle.js:+12717585)"]
    S -- "tab / toggle" --> U["Cycle picker selection"]
    U --> S
```

---

## Behavioral Spec

### 1. Handler Entry — `fastModeCommandHandler` (`Ar7`)

```
async function fastModeCommandHandler(args, context):
    providerKind = getProviderKind()          // resolves bedrock, foundry, etc.
    if providerKind not in DIRECT_API_PROVIDERS:
        return errorMessage("Fast mode is only available when using the Anthropic API directly")

    if context.isAgentSdk:
        return errorMessage("Fast mode is not available in the Agent SDK")

    orgStatus = await fetchFastModeAvailability()   // knH / prefetchFastMode
    result = resolveFastModeGate(orgStatus)          // W_H / gateResolver

    if result.blocked:
        return errorMessage(result.reason)

    argument = args.trim().toLowerCase()
    if argument == "off":
        applyFastMode(enabled=false)
        emitTelemetry("tengu_fast_mode_toggled", {value: false})
        return notification("Fast mode OFF")

    if argument in ("on", "yes", "1"):
        applyFastMode(enabled=true)
        emitTelemetry("tengu_fast_mode_toggled", {value: true})
        return notification("Fast mode ON")

    // No argument → open picker
    emitTelemetry("tengu_fast_mode_picker_shown")
    return renderFastModePicker(orgStatus)
```

Analysis basis: CC v2.1.175 bundle.js:+12719930

---

### 2. Availability Prefetch — `prefetchFastModeStatus` (`knH`)

```
async function prefetchFastModeStatus():
    if inFlightPromise exists:
        log("Fast mode prefetch in progress, returning in-flight promise")
        return inFlightPromise

    if lastFetchedRecently():
        log("Skipping fast mode prefetch, fetched recently")
        return cachedResult

    auth = await getAuthTokenOrApiKey()       // bD4 / authResolver
    if auth is null:
        return {status: "error", reason: "No auth available"}

    response = await callFastModeStatusEndpoint(auth)   // AW / apiCaller

    if response.status == 401:
        triggerOAuthRecoveryFlow()
    else if response.status == 403:
        return {status: "blocked", reason: "oauth_revoked"}

    store result in cache with Date.now() timestamp
    emitTelemetry("tengu_org_penguin_mode_fetch_failed") on network error
    return parsed result
```

Analysis basis: CC v2.1.175 bundle.js:+12719992

---

### 3. Gate Resolution — `resolveFastModeGate` (`W_H`)

Examines the fetched org/subscription status object and maps it to user-facing reason strings.

```
function resolveFastModeGate(status):
    if status == "pending":
        return {blocked: true, reason: "Checking fast mode availability (org status pending)"}

    if status == "network_error":
        return {blocked: true, reason: "Fast mode unavailable due to network connectivity issues"}

    if status.subscriptionTier == "free":
        return {blocked: true, reason: "Fast mode requires a paid subscription"}

    if status.subscriptionTier == "evaluation":
        return {blocked: true, reason: "Fast mode unavailable during evaluation. Please purchase credits."}

    if status.orgPolicy == "preference" and orgDisabledFastMode:
        return {blocked: true, reason: "Fast mode has been disabled by your organization"}

    if status.usagePolicy == "extra_usage_disabled":
        return {blocked: true, reason: "Fast mode requires usage credits · /usage-credits to turn them on"}

    if status.generallyUnavailable:
        return {blocked: true, reason: "Fast mode is currently unavailable"}

    return {blocked: false}
```

Analysis basis: CC v2.1.175 bundle.js:+2244074, +2244822, +2244890

---

### 4. Interactive Picker UI — `FastModePickerComponent` (`DF8` / `YF8`)

Rendered as a JSX component when no explicit argument is provided.

```
function renderFastModePicker(orgStatus):
    initialState = getCurrentFastModeState()   // "ON" or "OFF"
    render <FastModePicker
        title    = "Fast mode (research preview)"
        state    = initialState
        onConfirm  = key("enter")  → applyFastMode, emit tengu_fast_mode_toggled
        onCancel   = key("escape") → return "Kept Fast mode OFF"
        onToggle   = key("tab")    → cycle selection
        showStatus = true
    />

    // Status sub-messages displayed in picker:
    if orgStatus == "overloaded":
        display "Fast mode overloaded and is temporarily unavailable"
    if fastLimitHit:
        display "You've hit your fast limit · resets in <countdown>"
    if orgStatus == "enabled (cached)":
        display cached indicator
    if orgStatus == "disabled (network_error)":
        display network error indicator

    // Opus 4.6 deprecation notice (experiment: opus46-fast-mode-deprecation)
    if modelIsOpus46:
        display deprecation warning banner (type: "warning")
```

Analysis basis: CC v2.1.175 bundle.js:+12716310, +12716516, +12717585, +12718191, +12719139, +12719193

---

### 5. Provider Validation — `getProviderKind` (`n_` → `K6`)

Checks whether the configured provider is the direct Anthropic API. Known non-qualifying provider strings observed in the bundle:

- `"bedrock"` (bundle.js:+2112603)
- `"foundry"` (bundle.js:+2112653)
- `"anthropicAws"` (bundle.js:+2112709)
- `"mantle"` (bundle.js:+2112763)
- `"vertex"` (bundle.js:+2112811)
- `"firstParty"` (bundle.js:+2112820)

When the active provider matches any of the above, the command returns the "only available when using the Anthropic API directly" error immediately.

Analysis basis: CC v2.1.175 bundle.js:+2244074, +2244110

---

### 6. Fast Mode Cooldown Reset — `cooldownWatcher` (`kD_`)

A background timer watches for a cooldown state. When the cooldown expires it automatically re-enables Fast mode and emits `tengu_sunset_penguin_opus46` if the sunset experiment flag is active.

```
function cooldownWatcher():
    if currentState == "cooldown":
        waitForExpiry()
        log("Fast mode cooldown expired, re-enabling fast mode")
        setFastModeState("active")
        emit rv1 event
```

Analysis basis: CC v2.1.175 bundle.js:+2246300, +2246353

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_fast_mode_toggled` | Fired on every confirmed toggle (on or off); carries the new boolean state. bundle.js:+12716249 |
| Telemetry: `tengu_fast_mode_picker_shown` | Fired when the interactive picker is rendered (no argument path). bundle.js:+12720170 |
| Telemetry: `tengu_org_penguin_mode_fetch_failed` | Fired when the org-status network request fails. bundle.js:+2250282 |
| Telemetry: `tengu_penguins_off` | Fired when Fast mode is confirmed disabled via gate resolution. bundle.js:+2244928 |
| Telemetry: `tengu_sunset_penguin_opus46` | Fired when the Opus 4.6 fast-mode sunset experiment triggers. bundle.js:+2246071 |
| Telemetry: `tengu_config_parse_error` | Fired on config file parse failure during settings persistence. bundle.js:+3330793 |
| Telemetry: `tengu_config_lock_contention` | Fired when config-file lock takes unexpectedly long. bundle.js:+3328218 |
| Telemetry: `tengu_config_stale_write` | Fired when a stale config write is detected. bundle.js:+3328354 |
| Telemetry: `tengu_config_auth_loss_prevented` | Fired when a write that would erase auth is blocked. bundle.js:+3328697 |
| Telemetry: `tengu_oauth_401_*` family | OAuth 401 recovery telemetry emitted if the prefetch call returns 401. See OAuth recovery functions `Ap4`, `V19`. |
| App state mutation | `fastMode` boolean in app state store (key `"fastMode"`, bundle.js:+12715317) is updated synchronously after confirmation. |
| Experiment flag | `"opus46-fast-mode-deprecation"` GrowthBook experiment flag gates the deprecation warning banner for Opus 4.6 users (bundle.js:+12715635). |
| Picker JSX render | Interactive UI component `DF8` / `YF8` is mounted only on the no-argument path; `thinClientDispatch: "control-request"` means the command is forwarded to the controlling process in thin-client mode. |
| Docs URL | `https://code.claude.com/docs/en/fast-mode` is surfaced inside the picker UI (bundle.js:+12719413). |
| Sound | Not observed in depth-2 traversal. |

---

## Version History

| Version | Change |
|---|---|
| v2.1.175 | Initial analysis |

---

## Common Mistakes

1. **Using `/fast on` on a non-Anthropic-API provider** — Fast mode is gated exclusively to the direct Anthropic API; invoking it while using Bedrock, Vertex, Foundry, or other providers results in an immediate error with no toggle attempted.
2. **Expecting `/fast` to work on a free-tier account** — The command will display "Fast mode requires a paid subscription" and exit without opening the picker.
3. **Providing an unrecognised argument** — Only `on`, `yes`, `1` (truthy), and `off` are handled; any other string falls through to the interactive picker rather than being treated as an error.
4. **Running in Agent SDK context** — Fast mode is explicitly blocked in the Agent SDK ("Fast mode is not available in the Agent SDK"); this cannot be overridden by arguments.
5. **Confusion between "network_error" state and a general command failure** — When the org-status endpoint is unreachable the command still exits cleanly with an informational message, not a hard CLI error.
6. **Ignoring the cooldown state** — If Fast mode entered a cooldown period, attempting to manually re-enable it before the cooldown expires is silently suppressed; the cooldown watcher restores it automatically.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Ar7` | Main `/fast` command handler (`fastModeCommandHandler`); entry point resolved by Arbor via `module_id` |
| `W_H` | Fast-mode gate resolver; maps org/subscription status to user-facing blocked messages |
| `knH` | Fast-mode availability prefetch function; manages in-flight dedupe and caching |
| `zf` | Config/settings state getter used in gate resolution |
| `n_` | Provider-kind lookup utility |
| `K6` | String-to-provider-enum mapper |
| `H` | Random delay / jitter helper (used in prefetch retry) |
| `z6` | Org-status feature-flag fetcher |
| `p58` | Feature-flag cache check and store |
| `SX_` | GrowthBook experiment event dispatcher |
| `uV_` | Feature-flag unavailability tracker |
| `C6` | Config file reader/watcher coordinator |
| `U7H` | Config file read-and-parse with backup logic |
| `sp4` | Config file watcher (watchFile / unwatchFile lifecycle) |
| `N` | General output/notification writer |
| `RD_` | Auth + config pre-warm before API call |
| `qq` | Query-string / URL parameter builder |
| `QgA` | URL parameter string formatter |
| `AW` | Anthropic API HTTP caller for fast-mode endpoint |
| `XO` | HTTP request builder and auth header injector |
| `D7` | HTTP client instance factory |
| `Ij` | Auth-type selector (oauth vs api-key) |
| `$N` | API-key credential resolver |
| `bD4` | Auth token or API key retriever with caching |
| `m1` | OAuth base-URL resolver |
| `Ab` | In-flight request map manager (deduplication) |
| `Ap4` | OAuth 401 recovery orchestrator |
| `V19` | OAuth token refresh scheduler with exponential backoff |
| `SH` | Streaming HTTP response handler |
| `DO` | OAuth refresh-token finaliser |
| `wA` | Settings-load-from-disk orchestrator |
| `p3` | Settings environment initialiser |
| `uYH` | Settings path resolver (user / project / local) |
| `nC` | Settings schema constructor |
| `gB` | Settings load telemetry + watcher bootstrap |
| `I4_` | Settings load completion logger |
| `Os6` | Global config file read/write helper |
| `Ww6` | Atomic file write helper (temp-rename pattern) |
| `rO` | Config cache clear on reload |
| `eu` | Settings file path builder (`.claude/settings.json`) |
| `es6` | Settings file path resolver using `vI` (path module) |
| `X8` | Global config save with locking |
| `t58` | Config file save with backup rotation |
| `s58` | Config file snapshot writer |
| `kD_` | Fast-mode cooldown state watcher |
| `nv1` | Fast-mode sunset date evaluator (checks `2026-06-29`) |
| `YF8` | Fast-mode picker JSX component (full UI) |
| `DF8` | Fast-mode picker outer wrapper / app-state connector |
| `wF8` | Picker sub-component: settings application |
| `FEH` | Flag-settings type coercer (String / Number / Boolean) |
| `W3` | Model-string includes checker for picker |
| `J1` | Model alias / shorthand resolver |
| `BEH` | Picker theme / display configuration builder |
| `Cm` | Theme selector (dark / light / auto) |
| `af` | Legacy global config migration helper |
| `bA` | ANSI foreground-colour resolver for picker |
| `aJH` | ANSI / hex / RGB colour mapper to chalk methods |
| `U1` | Picker keyboard input handler |
| `Xl` | Key-binding dispatcher |
| `oK` | Slash-command argument parser (generic) |
| `jO` | Picker confirm/cancel key router |
| `jS` | Token-count formatter for picker UI |
| `ZhH` | Fast-mode current-state display renderer |
| `q1` | Model display-string builder |
| `Sz` | Model name canonicaliser |
| `xzA` | Sunset date display formatter |
| `KN1` | Number formatter (integer / toFixed) |
| `m9` | Time-duration countdown formatter (`0s`, `Xm`, `Xh`, `Xd`) |
| `M` | MCP server state manager (used indirectly via app-state hook) |
| `DCH` | MCP connection lifecycle manager |
| `r9` | App-state React hook (useSyncExternalStore wrapper) |
| `D6` | App-state store accessor |
| `ky_` | App-state context validator |
| `pA` | Keyboard handler registration hook (useEffect) |
| `ID` | mXH context accessor |
| `sGA` | MCP server reconnection retry coordinator |
| `ki8` | MCP connection result applicator |
| `AG` | MCP server cleanup coordinator |
| `hjK` | App-state persistence helper |
| `I8` | Settings schema instance builder |
| `_t6` | Settings schema cache (dQ6 map) |
| `h4_` | Policy + flag settings merger |
| `HvA` | Settings schema cache setter |
| `LT` | Array-includes availability checker |
| `D9` | JSX element factory helper |
| `SD4` | Notification display dispatcher |
| `d` | React/JSX namespace reference |
| `A6` | d56 accessor |
| `d56` | JSX element-type symbol |
| `M6` | d56 accessor (secondary reference) |
| `Lq` | Memory-usage telemetry emitter |
| `cQ6` | Settings load completion hook |