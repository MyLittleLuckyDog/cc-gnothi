---
type: feature-spec
feature: "fast"
cc_version: "2.1.163"
updated: "2026-06-05"
tags: ["fast", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.163 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/fast`

> Analysis basis: CC v2.1.163 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.163

---

## Overview

`/fast` toggles "Fast mode" (a research preview feature) on or off for the current Claude Code session. When invoked without arguments it opens an interactive picker UI; when given `on` or `off` as an argument it sets the state directly. Fast mode is gated behind authentication context, subscription tier, organizational policy, and API availability checks — all evaluated at toggle time.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `fast` |
| description | `Toggle fast mode ( ... )` |
| argumentHint | `[on\|off]` |
| loc_byte | 12420230 |
| loc_byte_end | 12420502 |
| loc_line | 8829 |
| thinClientDispatch | `control-request` |
| module_id | `l6K` |
| load_inline | `true` |
| immediate | `null` |
| isHidden | `null` |
| arbor_handler.name | `ayf` |
| arbor_handler.fqn | `claude-2.1.163::ayf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | 3 |

Analysis basis: CC v2.1.163 bundle.js:+12420230

---

## Input Branching

The command has 5+ distinct paths that branch on argument value, authentication state, API tier, organizational policy, and network availability. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/fast [arg]"] --> B{arg present?}

    B -- "no arg" --> C[Show interactive picker UI\ntengu_fast_mode_picker_shown]
    C --> D{User action in picker}
    D -- "toggle / confirm" --> E[Apply toggle choice]
    D -- "escape / cancel" --> Z[No-op, dismiss]

    B -- "arg = 'on' or 'off'" --> F{API provider check}

    F -- "not Anthropic API directly\n(bedrock / foundry / vertex / etc.)" --> G[Return error:\n'Fast mode is only available when\nusing the Anthropic API directly']

    F -- "Anthropic API direct" --> H{Agent SDK context?}
    H -- "yes (SDK)" --> I[Return error:\n'Fast mode is not available\nin the Agent SDK']
    H -- "no" --> J{Org status check}

    J -- "org status = pending" --> K[Return warning:\n'Checking fast mode availability\n(org status pending)']

    J -- "org status fetched" --> L{Subscription tier?}
    L -- "free" --> M[Return error:\n'Fast mode requires a paid subscription']
    L -- "evaluation" --> N[Return error:\n'Fast mode unavailable during evaluation.\nPlease purchase credits.']
    L -- "extra_usage_disabled" --> O[Return error:\n'Fast mode requires usage credits\n· /usage-credits to turn them on']
    L -- "preference disabled by org" --> P[Return error:\n'Fast mode has been disabled\nby your organization']
    L -- "network_error" --> Q[Return warning:\n'Fast mode unavailable due to\nnetwork connectivity issues']
    L -- "currently unavailable" --> R[Return warning:\n'Fast mode is currently unavailable']

    L -- "eligible" --> S{Requested state vs current state}
    S -- "turn off" --> T[Set fastMode = false\nEmit tengu_fast_mode_toggled\nDisplay 'Fast mode OFF']
    S -- "turn on, not overloaded" --> U[Set fastMode = true\nEmit tengu_fast_mode_toggled]
    S -- "overloaded" --> V[Display warning:\n'Fast mode overloaded and is\ntemporarily unavailable']
    S -- "fast limit hit" --> W[Display:\n'You've hit your fast limit\n· resets in <countdown>']

    E --> F
```

Analysis basis: CC v2.1.163 bundle.js:+12419264, +2228475, +2228543, +2228740, +2228902, +2227994, +2228035, +2228210, +2228126, +2228307, +2228386

---

## Behavioral Spec

### 1. Top-level Handler (`fastCommandHandler`)

The async handler `ayf` is the entry point resolved via `module_id` → `l6K`.

```
async function fastCommandHandler(args, context):
    argument = parseArgument(args)   // sK call at +12419264

    if argument == "off":
        return renderFastModeOffResult()  // literal "off" at +12419379

    availabilityResult = checkFastModeAvailability(context)  // $6H at +12419278

    prefetchFastModeStatus(context)  // ZQH at +12419326

    uiState = buildFastModeUIState(availabilityResult)  // iR8 at +12419398

    emit telemetry("tengu_fast_mode_picker_shown")  // +12419489

    return renderJSXComponent(uiState)  // Nf.createElement at +12419548
```

Analysis basis: CC v2.1.163 bundle.js:+12419264

---

### 2. Argument Parsing (`parseArgument`)

```
function parseArgument(rawArgs):
    normalized = rawArgs.trim().toLowerCase()
    if normalized in ["yes", "on"]:   // literals at +27104, +27110
        return "on"
    if normalized == "off":           // literal at +12419379
        return "off"
    return null   // triggers interactive picker
```

Analysis basis: CC v2.1.163 bundle.js:+27104, +27110, +12419379

---

### 3. Availability Check (`checkFastModeAvailability`)

This sub-routine (`$6H`) inspects the current auth context and organizational state, returning a structured status object with one of several named states.

```
function checkFastModeAvailability(context):
    provider = getModelProvider(context)   // sK + XA at +2228443, +2228455

    if provider != "firstParty" (i.e. is bedrock/foundry/vertex/anthropicAws/mantle/gateway):
        // literals at +2096693, +2096743, +2096799, +2096853, +2096901, +2096910
        emit telemetry("tengu_penguins_off")  // +2228581
        return { status: "unavailable",
                 message: "Fast mode is only available when using the Anthropic API directly" }
                 // literal at +2228475

    if context.isAgentSDK:
        return { status: "unavailable",
                 message: "Fast mode is not available in the Agent SDK" }
                 // literal at +2228810
        // debug message: "Fast mode unavailable: ..." at +2228740

    orgStatus = fetchOrganizationFastModeStatus(context)   // v at +2228627

    switch orgStatus:
        case "pending":             // literal at +2228871
            return { status: "pending",
                     message: "Checking fast mode availability" }  // +2228981

        case "free":                // literal at +2227968
            return { status: "unavailable",
                     message: "Fast mode requires a paid subscription" }  // +2227994

        case "evaluation":
            return { status: "unavailable",
                     message: "Fast mode unavailable during evaluation. Please purchase credits." }  // +2228035

        case "preference":          // literal at +2228107
            return { status: "disabled_by_org",
                     message: "Fast mode has been disabled by your organization" }  // +2228126

        case "extra_usage_disabled":  // literal at +2228181
            return { status: "unavailable",
                     message: "Fast mode requires usage credits · /usage-credits to turn them on" }  // +2228210

        case "network_error":       // literal at +2229065
            return { status: "network_error",
                     message: "Fast mode unavailable due to network connectivity issues" }  // +2228307

        default:
            return { status: "unavailable",
                     message: "Fast mode is currently unavailable" }  // +2228386
```

Analysis basis: CC v2.1.163 bundle.js:+2228443, +2228475, +2228543, +2228740, +2228810, +2228871, +2228902, +2228981, +2227968, +2227994, +2228035, +2228107, +2228126, +2228181, +2228210, +2229065, +2228307, +2228386

---

### 4. Fast Mode Prefetch (`prefetchFastModeStatus`)

`ZQH` is the async prefetch routine that proactively fetches org-level fast mode eligibility from the Anthropic API, caching the result.

```
async function prefetchFastModeStatus(context):
    if inflight promise already exists:
        log "Fast mode prefetch in progress, returning in-flight promise"  // +2232250
        return existingPromise

    timeSinceLastFetch = Date.now() - lastFetchTimestamp
    if timeSinceLastFetch < threshold:
        log "Skipping fast mode prefetch, fetched recently"  // +2232497
        return cachedResult

    authToken = getAuthToken(context)   // b1L at +2232701
    if not authToken:
        log "No auth available"  // +2232673
        return null

    try:
        response = makeAPIRequest(authToken)  // SU at +2232969
        cacheResult(response)
        emit event via cf_.emit  // +2233300
        return response

    catch error:
        if error.status == 401 or 403:  // literals at +2232808, +2232834
            handleOAuthError(error)
        if isAxiosError(error):
            emit telemetry("tengu_org_penguin_mode_fetch_failed")  // +2233669
        storeErrorResult("network_error")
        return null
```

Analysis basis: CC v2.1.163 bundle.js:+2232161, +2232250, +2232323, +2232497, +2232667, +2232673, +2232701, +2232808, +2232834, +2233300, +2233669

---

### 5. UI State Builder (`buildFastModeUIState`)

`iR8` assembles the interactive React component state used both for the no-argument picker and for the confirmation result display. It integrates flag settings, theme, and current fast-mode state.

```
function buildFastModeUIState(availabilityResult):
    flagSettings = applyFlagSettings(context)   // nR8 → "apply_flag_settings" at +12415298
    currentFastMode = flagSettings.fastMode     // literal "fastMode" at +12414928
    currentModel = flagSettings.model           // literal "model" at +12415011

    if availabilityResult.status == "unavailable":
        return buildDisabledView(availabilityResult.message)

    if currentFastMode == false and requestedState != "on":
        label = "Fast mode OFF"   // literal at +12415894
        displayMode = "off"

    uiComponents = buildPickerComponents({
        title: " Fast mode (research preview)",   // literal at +12417525
        fastModeState: currentFastMode ? "ON " : "OFF",  // literals at +12418301, +12418307
        overloadedState: checkOverload(),
        docUrl: "https://code.claude.com/docs/en/fast-mode",  // literal at +12418747
        keyBindings: {
            escape: "cancel",   // literals at +12417718, +12417734
            tab: "toggle",      // literals at +12417797, +12417810
            enter: "confirm"    // literals at +12417848, +12417863
        }
    })

    if overloaded:
        appendWarning("Fast mode overloaded and is temporarily unavailable")  // +12418473
        // status marker "overloaded" at +12418460

    if fastLimitHit:
        appendWarning("You've hit your fast limit · resets in " + countdown)  // +12418527, +12418556

    return uiComponents
```

Analysis basis: CC v2.1.163 bundle.js:+12415298, +12414928, +12415011, +12415894, +12417525, +12418232, +12418301, +12418307, +12418460, +12418473, +12418527, +12418556, +12418747

---

### 6. Toggle Application (`applyFastModeToggle`)

When the user confirms a toggle in the picker or passes an explicit `on`/`off` argument:

```
function applyFastModeToggle(newState, context):
    if newState == false:
        setAppState({ fastMode: false })
        emit telemetry("tengu_fast_mode_toggled")  // +12415665
        display "Fast mode OFF"   // literal at +12415894
        return

    if newState == true:
        setAppState({ fastMode: true })
        emit telemetry("tengu_fast_mode_toggled")  // +12415665
        return

    // "Kept Fast mode OFF" path when user cancels from OFF state
    // literal at +12416920
    return noOp
```

Analysis basis: CC v2.1.163 bundle.js:+12415665, +12415894, +12416920

---

### 7. Fast Mode Cooldown / Re-enable (`fastModeCooldownHandler`)

A background watcher (`df_`) monitors a cooldown flag. When the cooldown expires it automatically re-enables fast mode and notifies the session.

```
function fastModeCooldownHandler():
    state = readCooldownState()    // "cooldown" literal at +2229687
    if state == "active":          // literal at +2230149
        return  // still in cooldown

    if cooldownExpired():
        log "Fast mode cooldown expired, re-enabling fast mode"  // +2229740
        setAppState({ fastMode: true })
        emit via jX1.emit  // +2229800
```

Analysis basis: CC v2.1.163 bundle.js:+2229687, +2229740, +2229800, +2230149

---

### 8. Display Status Summary

The status bar/footer display (seen in the UI output of `ZQH`) shows one of two cached status strings:

- `"enabled (cached)"` — literal at +2233596
- `"disabled (network_error)"` — literal at +2233615

These reflect the most recently prefetched state, not a live query.

Analysis basis: CC v2.1.163 bundle.js:+2233596, +2233615

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_fast_mode_toggled` | Fired on every confirmed toggle (on→off or off→on); loc +12415665 |
| Telemetry: `tengu_fast_mode_picker_shown` | Fired when the interactive picker UI is rendered; loc +12419489 |
| Telemetry: `tengu_penguins_off` | Fired when fast mode is unavailable because the provider is not the direct Anthropic API; loc +2228581 |
| Telemetry: `tengu_org_penguin_mode_fetch_failed` | Fired when the prefetch API call fails (Axios error path); loc +2233669 |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` | General feature-health events in call-graph utility functions; loc +1010222, +1010284, +1010365 |
| appState changes | `fastMode` boolean written via `setAppState` |
| Prefetch cache | Result of org-status API call cached in module-level state; skips refetch if recently fetched |
| Cooldown watcher | `df_` (`fastModeCooldownHandler`) monitors and auto-re-enables fast mode after cooldown |
| Event emission | `cf_.emit` used after successful prefetch; `jX1.emit` used on cooldown expiry |
| Hook registration | `j9` → `MXA.register` in the logging subsystem; indirect via `icK` |
| Sound | None detected in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.163 | Initial analysis |

---

## Common Mistakes

1. **Passing `on` while on a non-Anthropic provider** — Fast mode is exclusively available when using the direct Anthropic API. Running it with Bedrock, Vertex, Foundry, Mantle, or any gateway provider always returns "Fast mode is only available when using the Anthropic API directly" and does not modify state.
2. **Expecting instant availability after subscribing** — The org status check is network-fetched and cached. If the prefetch returns `"pending"` the command shows a checking message rather than enabling the mode. Retrying after a short wait resolves this.
3. **Using `/fast on` inside Agent SDK integrations** — The SDK context is detected and blocks fast mode unconditionally with its own error message.
4. **Ignoring the `[on|off]` argument hint** — Without an explicit argument the command opens an interactive picker. In non-interactive/piped sessions this can stall the CLI. Pass `on` or `off` explicitly for scripted use.
5. **Confusion between "overloaded" and "unavailable"** — "Overloaded" is a temporary capacity state displayed in the picker UI; the setting is not turned off, fast mode is just degraded. "Unavailable" states (free tier, org policy, etc.) require account/org changes to resolve.
6. **Fast limit countdown display** — When a fast limit is hit, the display shows a reset countdown (`"You've hit your fast limit · resets in <time>"`). This is informational; the mode will re-enable automatically when the cooldown expires (handled by the background cooldown watcher).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `ayf` | Main handler — `fastCommandHandler` async entry point |
| `sK` | Argument normalization / string parsing utility |
| `XA` | Provider/model string classifier |
| `eH` | String output helper |
| `$6H` | Fast mode availability checker — evaluates provider, SDK context, org status |
| `ZQH` | Async fast mode prefetch and cache manager |
| `iR8` | UI state builder — assembles picker component state |
| `nR8` | Flag settings applicator (`apply_flag_settings`) |
| `rR8` | Interactive picker React component renderer |
| `df_` | Cooldown watcher — auto-re-enables fast mode on expiry |
| `lf_` | Prefetch helper sub-routine |
| `b1L` | Auth token retrieval for prefetch |
| `U1` | OAuth base URL / auth endpoint resolver |
| `SU` | Prefetch API call executor with cache map management |
| `cXL` | OAuth 401 recovery / token refresh orchestrator |
| `D6` | Session/config bootstrapper |
| `B98` | Session deduplication helper |
| `OX_` | Session initialization and event emitter |
| `jX_` | Session state tracker |
| `S6` | Config file reader with backup |
| `bDH` | Low-level config file read/write with directory management |
| `X8` | Config save orchestrator with lock |
| `SX_` | Config write-with-lock implementation |
| `TM6` | Atomic file writer (temp → rename) |
| `v` | Model/provider environment resolver |
| `ccK` | Provider classification helper |
| `OXA` | Numeric provider-type mapper |
| `H` | Bootstrap fetch / config initializer |
| `Pw_` | Auth header key parser |
| `ZHH` | Trusted-host set checker |
| `uj` | URL replacement helper |
| `t1` | Model alias resolver |
| `D6H` | Model alias table |
| `yd` | Model string normalizer |
| `Aq` | Model name canonicalizer |
| `gM` | Model validation helper |
| `NE` | Model string formatter |
| `wI` | Model prefix handler |
| `NQH` | Model prefix normalizer |
| `kX1` | Model full-name builder |
| `eX` | Extended model alias resolver |
| `r0` | Model routing/fallback resolver |
| `z2` | Model context builder |
| `TQH` | Model selection helper |
| `zO` | Model compatibility checker |
| `H9` | Model name transformer |
| `tX` | Model identifier normalizer |
| `FZH` | Fast mode + model combiner |
| `icK` | Logging / transcript writer |
| `$pH` | Throttled write scheduler |
| `d3H` | Transcript chunk formatter |
| `r2A` | Transcript path builder |
| `i2A` | Transcript file rotator |
| `ncK` | Transcript append writer |
| `aL6` | Transcript directory helper |
| `j9` | Hook/listener registrar |
| `r_` | Settings loader from disk |
| `cO` | Settings constructor |
| `HzH` | Settings file path resolver |
| `Xl6` | Settings file locator |
| `rTH` | Settings file watcher |
| `hx` | Settings `.claude` directory path builder |
| `DU` | Settings load dispatcher |
| `g6_` | Settings cache populator |
| `vc6` | Config file writer |
| `WH_` | Config write helper |
| `Nc6` | Git-ignore checker |
| `ME4` | Global excludes-file resolver |
| `XxA` | Git ls-files checker |
| `sz` | Settings cache clearer |
| `mH_` | Settings timestamp recorder |
| `TM6` | Atomic file writer |
| `DO` | API key / auth provider resolver |
| `Bj` | Auth profile builder |
| `lV` | Per-profile auth loader |
| `L4` | Auth token formatter |
| `BV` | Array-include checker for auth types |
| `NW` | Auth dispatch wrapper |
| `iR` | Auth token slicer |
| `zO6` | File descriptor token reader |
| `vU` | Token type wrapper |
| `M4` | Token validation helper |
| `kH` | Retry/error logging wrapper |
| `nu1` | Retry back-off calculator |
| `DcH` | Token expiry checker |
| `hH` | Token render helper |
| `RH` | Token display helper |
| `Xo` | OAuth refresh initiator |
| `SU` | Prefetch map manager |
| `cXL` | OAuth 401 recovery controller |
| `S3` | Daemon status reporter |
| `Dq` | Error message formatter |
| `RSA` | Error string helper |
| `X0H` | Flag/option schema validator |
| `J0H` | Picker item factory |
| `Lu` | Picker label renderer |
| `g4` | Picker state manager |
| `hV` | Picker filter helper |
| `VA` | Picker theme applier |
| `nDH` | ANSI color code renderer |
| `rR` | Number formatter (toFixed) |
| `NX1` | Integer display formatter |
| `W6` | React component wrapper |
| `M6` | App-state context hook |
| `jG_` | App-state context provider validator |
| `qA` | App-state setter hook |
| `GA` | Global key handler registrar |
| `nj` | Key-handler context reader |
| `M` | MCP manager component |
| `AbH` | MCP connection manager |
| `bl` | MCP client constructor |
| `fk` | MCP connection factory |
| `VYA` | MCP server list reconciler |
| `tU8` | MCP connection result applier |
| `mk` | MCP cleanup helper |
| `$A6` | MCP state validator |
| `_bH` | MCP update validator |
| `rkq` | MCP connection attempt handler |
| `os_` | MCP OAuth flow initiator |
| `as_` | MCP OAuth callback handler |
| `Kyq` | MCP post-connect task runner |
| `rs_` | MCP reconnect scheduler |
| `Ab_` | MCP config include-checker |
| `O8` | MCP debug logger |
| `T7` | MCP error logger |
| `EH` | Error string coercer |
| `TKK` | Daemon status file reader |
| `nr` | Status line trimmer |
| `L4H` | Status line parser |
| `N9` | Async-local-storage store getter |
| `JR6` | Daemon status file path builder |
| `f9` | Duration countdown formatter |
| `$` | Outer React fragment / component combiner |