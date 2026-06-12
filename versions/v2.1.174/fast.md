---
type: feature-spec
feature: "fast"
cc_version: "2.1.174"
updated: "2026-06-12"
tags: ["fast", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.174 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/fast`

> Analysis basis: CC v2.1.174 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.174

---

## Overview

The `/fast` command toggles "Fast mode" — a research-preview execution mode that uses a higher-performance model path when the user's Anthropic account and organizational settings allow it. Invoked with an optional `on` or `off` argument, it checks availability against the current API provider, subscription tier, organizational policy, and network state before applying or presenting an interactive picker UI. When Fast mode cannot be enabled, a descriptive reason message is displayed rather than silently failing.

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
| module_id | `q3K` |
| load_inline | `true` |
| loc_byte | `12704898` |
| loc_byte_end | `12705170` |
| loc_line | `8906` |
| arbor_handler.name | `Ai7` |
| arbor_handler.fqn | `claude-2.1.174::Ai7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `3` |

Analysis basis: CC v2.1.174 bundle.js:+12704898

---

## Input Branching

The command has more than three distinct branches depending on provider type, subscription status, network state, and explicit `on`/`off` argument.

```mermaid
flowchart TD
    A(["/fast [arg]"]) --> B{API provider\nis Anthropic direct?}
    B -- No --> C["Error: Fast mode only available\nwith Anthropic API directly\n(bundle.js:+2242294)"]
    B -- Yes --> D{Running in\nAgent SDK?}
    D -- Yes --> E["Error: Fast mode not available\nin the Agent SDK\n(bundle.js:+2242559)"]
    D -- No --> F{Org status\nchecked?}
    F -- pending --> G["Warning: Checking fast mode\navailability (org status pending)\n(bundle.js:+2242721)"]
    F -- network_error --> H["Error: Fast mode unavailable due\nto network connectivity issues\n(bundle.js:+2242126)"]
    F -- resolved --> I{Subscription\ntier?}
    I -- free --> J["Error: Fast mode requires\na paid subscription\n(bundle.js:+2241813)"]
    I -- evaluation --> K["Error: Fast mode unavailable\nduring evaluation. Please purchase credits.\n(bundle.js:+2241854)"]
    I -- extra_usage_disabled --> L["Error: Fast mode requires\nusage credits · /usage-credits\n(bundle.js:+2242029)"]
    I -- org disabled\n(preference) --> M["Error: Fast mode has been disabled\nby your organization\n(bundle.js:+2241945)"]
    I -- eligible --> N{Explicit arg\nprovided?}
    N -- "on" / "yes" --> O[Enable Fast mode]
    N -- "off" --> P[Disable Fast mode\n'Fast mode OFF' notification\n(bundle.js:+12700484)]
    N -- none --> Q[Show interactive\nFast mode picker UI\n(bundle.js:+12704138)]
    O --> R{Current state\nalready active?}
    R -- overloaded --> S["Fast mode overloaded\nand temporarily unavailable\n(bundle.js:+12703107)"]
    R -- rate-limited --> T["You've hit your fast limit\n· resets in ...\n(bundle.js:+12703161)"]
    R -- ok --> U[Activate Fast mode\nEmit tengu_fast_mode_toggled]
    Q --> V{User confirms\nor cancels?}
    V -- confirm --> U
    V -- escape/cancel --> W[Keep current state\n'Kept Fast mode OFF'\n(bundle.js:+12701553)]
```

---

## Behavioral Spec

### Main Handler — `fastModeCommandHandler` (Ai7)

Analysis basis: CC v2.1.174 bundle.js:+12703898

```
async function fastModeCommandHandler(cmdArgs, appState):
    // 1. Check API provider eligibility
    providerKind = getProviderKind()   // inspects bedrock/foundry/anthropicAws/mantle/vertex/firstParty
    if providerKind is not "firstParty":
        return errorMessage("Fast mode is only available when using the Anthropic API directly")
        // bundle.js:+2242294

    // 2. Check Agent SDK restriction
    if runningInAgentSDK():
        return errorMessage("Fast mode is not available in the Agent SDK")
        // bundle.js:+2242559

    // 3. Fetch / consult cached org fast-mode availability
    availability = await getOrFetchFastModeAvailability()
    // calls prefetchFastModeStatus (PnH) which may short-circuit
    // "Fast mode prefetch in progress, returning in-flight promise" (bundle.js:+2246335)
    // "Skipping fast mode prefetch, fetched recently" (bundle.js:+2246582)

    // 4. Evaluate availability result
    match availability.status:
        "pending"       → warn("Checking fast mode availability (org status pending)")
                          // bundle.js:+2242721
        "network_error" → error("Fast mode unavailable due to network connectivity issues")
                          // bundle.js:+2242126
        "free"          → error("Fast mode requires a paid subscription")
                          // bundle.js:+2241813
        "evaluation"    → error("Fast mode unavailable during evaluation. Please purchase credits.")
                          // bundle.js:+2241854
        "extra_usage_disabled"
                        → error("Fast mode requires usage credits · /usage-credits to turn them on")
                          // bundle.js:+2242029
        "preference"    → error("Fast mode has been disabled by your organization")
                          // bundle.js:+2241945
        unavailable (other)
                        → error("Fast mode is currently unavailable")
                          // bundle.js:+2242205

    // 5. Parse explicit argument
    arg = normalizeArg(cmdArgs)    // trim + toLowerCase
    if arg in ["on", "yes"]:
        return applyFastModeState(enabled=true)
    if arg == "off":
        return applyFastModeState(enabled=false)

    // 6. No argument — show interactive picker
    emit telemetry("tengu_fast_mode_picker_shown")   // bundle.js:+12704138
    showFastModePicker(appState)
```

### Availability Prefetch — `prefetchFastModeStatus` (PnH)

Analysis basis: CC v2.1.174 bundle.js:+12703960

```
async function prefetchFastModeStatus():
    if inFlightPromise exists:
        log("Fast mode prefetch in progress, returning in-flight promise")
        return inFlightPromise
    if fetchedRecently():
        log("Skipping fast mode prefetch, fetched recently")
        return cachedResult

    inFlightPromise = (async ():
        authToken = await resolveAuthToken()     // QY4 → C1
        if authToken is null:
            throw Error("No auth available")     // bundle.js:+2246758

        try:
            response = await callOrgStatusEndpoint(authToken)  // sC
            result = parseOrgFastModeResponse(response)        // Km4
            cacheResult(result)
            return result
        catch AxiosError(401 | 403):
            // OAuth recovery path via Km4/kH/CH
            handleOAuthFailure()
        catch networkError:
            return { status: "network_error" }   // bundle.js:+2242884
    )()
    return inFlightPromise
```

### Fast Mode State Application — `applyFastModeState` (w_H)

Analysis basis: CC v2.1.174 bundle.js:+12703912

```
function applyFastModeState(enabled: boolean):
    currentState = readAppState("fastMode")

    if not enabled:
        setAppState({ fastMode: false })
        showNotification("Fast mode OFF")        // bundle.js:+12700484
        emit telemetry("tengu_fast_mode_toggled")
        return

    // Check live throttle state
    throttleInfo = getThrottleStatus()           // w6 / X58
    if throttleInfo.overloaded:
        showStatus("Fast mode overloaded and is temporarily unavailable")
        // bundle.js:+12703107
        return
    if throttleInfo.rateLimited:
        resetTime = formatCountdown(throttleInfo.resetAt)   // C9
        showStatus("You've hit your fast limit · resets in " + resetTime)
        // bundle.js:+12703161
        return

    setAppState({ fastMode: true })
    emit telemetry("tengu_fast_mode_toggled")    // bundle.js:+12700217
    // Trigger GrowthBook experiment event if applicable
    // bundle.js:+2508425 ("growthbook_experiment")
```

### Interactive Fast Mode Picker UI (lB8 / cB8)

Analysis basis: CC v2.1.174 bundle.js:+12700637

```
function renderFastModePicker(appState):
    // Renders JSX component via z5.createElement (bundle.js:+12704197)
    // Title: " Fast mode (research preview)" (bundle.js:+12702159)
    // Displays current state as "ON " or "OFF" labels (bundle.js:+12702935/12702941)
    // Keyboard bindings:
    //   tab        → toggle selection         (bundle.js:+12702431/12702444)
    //   enter      → confirm selection        (bundle.js:+12702482/12702497)
    //   escape     → cancel, keep current     (bundle.js:+12702352/12702368)
    //   confirm:*  → internal state signals   (bundle.js:+12701773..12701871)
    // If user cancels: showMessage("Kept Fast mode OFF") (bundle.js:+12701553)
    // Link to docs: https://code.claude.com/docs/en/fast-mode (bundle.js:+12703381)

    // Opus 4.6 deprecation banner (opus46-fast-mode-deprecation flag)
    if featureFlag("opus46-fast-mode-deprecation") active:
        show deprecation warning/notification   // bundle.js:+12699603, +12699729

    // apply_flag_settings integration
    applyFlagSettings()    // bundle.js:+12699848
```

### Provider Kind Detection — `getProviderKind` (n_)

Analysis basis: CC v2.1.174 bundle.js:+2110106

```
function getProviderKind():
    // Returns one of:
    //   "bedrock"       (bundle.js:+2110146)
    //   "foundry"       (bundle.js:+2110196)
    //   "anthropicAws"  (bundle.js:+2110252)
    //   "mantle"        (bundle.js:+2110306)
    //   "vertex"        (bundle.js:+2110354)
    //   "firstParty"    (bundle.js:+2110363)
    // Only "firstParty" permits Fast mode.
    return determineProviderFromConfig()
```

### Cooldown Re-enable Logic (fD_)

Analysis basis: CC v2.1.174 bundle.js:+2243784

```
function checkCooldownReEnable():
    // Watches for "cooldown" state (bundle.js:+2243772)
    // When cooldown expires:
    //   log("Fast mode cooldown expired, re-enabling fast mode")  // bundle.js:+2243825
    //   emit tengu_sunset_penguin_opus46 if applicable            // bundle.js:+2243543
    //   re-set fastMode: true in appState
```

### Telemetry: Fast Mode Fetch Failure (tengu_org_penguin_mode_fetch_failed)

Analysis basis: CC v2.1.174 bundle.js:+2247754

```
// Emitted when the org status endpoint returns an unexpected error
// and the local availability cache cannot be satisfied.
// Status displayed: "disabled (network_error)" (bundle.js:+2247700)
// or "enabled (cached)" when served from cache  (bundle.js:+2247681)
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_fast_mode_toggled` | Fired on every successful Fast mode enable or disable (bundle.js:+12700217) |
| Telemetry: `tengu_fast_mode_picker_shown` | Fired when the interactive picker UI is displayed (bundle.js:+12704138) |
| Telemetry: `tengu_penguins_off` | Fired when the Fast mode availability check returns a disabled result (bundle.js:+2242400) |
| Telemetry: `tengu_org_penguin_mode_fetch_failed` | Fired when the org status fetch fails with a network error (bundle.js:+2247754) |
| Telemetry: `tengu_sunset_penguin_opus46` | Fired during cooldown re-enable for the Opus 4.6 deprecation path (bundle.js:+2243543) |
| Telemetry: `tengu_config_parse_error` | Fired when local config JSON cannot be parsed (bundle.js:+3317492) |
| Telemetry: `tengu_config_lock_contention` | Fired when config write lock is contended (bundle.js:+3314917) |
| Telemetry: `tengu_config_stale_write` | Fired when a stale config write is detected (bundle.js:+3315053) |
| Telemetry: `tengu_config_auth_loss_prevented` | Fired when a write that would erase auth is blocked (bundle.js:+3315396) |
| Telemetry: `tengu_oauth_401_*` | OAuth recovery events fired from the availability fetch path (bundle.js:+3265098, +3265825, +3266263, +3266500, +3266762) |
| Telemetry: `tengu_feature_ok / bad / sad` | Feature-flag evaluation outcomes (bundle.js:+1016891, +1016958, +1017039) |
| appState changes | `fastMode` boolean key written via `setAppState` |
| Config writes | `saveConfigWithLock` (C6/R58) persists updated `fastMode` flag to `~/.claude/settings.json` or equivalent |
| Notification | "Fast mode OFF" system notification shown on disable (bundle.js:+12700484) |
| Notification | "Kept Fast mode OFF" message shown on picker cancel (bundle.js:+12701553) |
| In-flight promise cache | Prefetch result cached; repeat calls return same promise to avoid duplicate network requests |
| GrowthBook event | `growthbook_experiment` experiment event emitted via `Os.emit` when org experiment applies (bundle.js:+2508425) |
| Hook registration | `CA` registers a handler via `K.registerHandler` for keyboard events within the picker UI (bundle.js:+4156782) |
| Sound | None detected in depth-2 traversal |
| thinClientDispatch | `control-request` — in thin-client mode this command is dispatched as a control request rather than handled locally |

---

## Version History

| Version | Change |
|---|---|
| v2.1.174 | Initial analysis. Fast mode toggle with interactive picker, provider guard, subscription-tier checks, Opus 4.6 deprecation banner, cooldown re-enable logic, Agent SDK restriction. |

---

## Common Mistakes

1. **Using `/fast` on a non-Anthropic API provider** (Bedrock, Vertex, Foundry, etc.) will always fail with "Fast mode is only available when using the Anthropic API directly" — there is no workaround at the command level.
2. **Omitting the argument** when scripting will cause the interactive picker UI to be shown instead of applying the desired state; always pass `on` or `off` explicitly in automation contexts.
3. **Expecting immediate availability** after a subscription change — the availability status is cached and the prefetch may return a stale result; the "Checking fast mode availability (org status pending)" message indicates the cache has not yet resolved.
4. **Calling `/fast on` while the org has disabled Fast mode via policy** ("preference") will be silently blocked; this is an organizational setting and cannot be overridden by the user.
5. **Misreading the rate-limit message** — "You've hit your fast limit" is a per-period quota, not a permanent disablement; the reset time shown is computed from the server-returned reset timestamp via the countdown formatter.
6. **Agent SDK users** cannot use Fast mode at all; the restriction is enforced at the command handler entry point regardless of any other conditions.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Ai7` | Main async handler for `/fast` command (`fastModeCommandHandler`) |
| `$f` | Config/state reader utility |
| `n_` | Provider kind detector (returns bedrock/foundry/firstParty/etc.) |
| `L6` | App state getter/setter primitive |
| `H` | Generic utility / notification helper (also `Math.random` wrapper context) |
| `w_H` | Fast mode state application function |
| `w6` | Throttle/availability state resolver |
| `t26` | Throttle state sub-helper |
| `e26` | Throttle state sub-helper |
| `Vm` | Fast mode availability map lookup |
| `zm` | Availability cache read |
| `X58` | In-flight promise cache manager |
| `KX_` | GrowthBook experiment event emitter |
| `OV_` | Org availability result parser |
| `C6` | Config write-with-lock dispatcher |
| `r6` | Config file path resolver |
| `TV_` | Config write helper |
| `C7H` | Config file read/write with backup rotation |
| `em4` | File watch registration for config |
| `N` | Notification / log message emitter |
| `Z1f` | Log formatting helper |
| `fvA` | Log transport selector |
| `RH` | JSON serializer wrapper |
| `df` | Message formatter / redactor |
| `UhA` | Redaction map builder |
| `VgH` | Terminal write helper |
| `hhA` | Raw terminal write |
| `h1f` | Append-write file logger |
| `oFH` | Debounced flush scheduler |
| `sfH` | Sync flush helper |
| `C36` | File permission helper |
| `ghA` | Log file path builder |
| `Qt8` | Log file rotation helper |
| `N1f` | Buffered log append |
| `R9` | Signal handler registration (qvA.register) |
| `C8` | Settings loader |
| `ms6` | Settings cache accessor |
| `IVA` | Settings map get/has |
| `ef_` | Settings layer merger (policySettings / flagSettings) |
| `yVA` | Settings cache writer (NQ6.set) |
| `xB` | Full settings initializer |
| `j_` | Platform detector (rG) |
| `TM6` | Settings field: TM6 |
| `Da8` | Settings field: Da8 |
| `PM6` | Settings field: PM6 |
| `TVH` | Settings field: TVH |
| `EVH` | Settings field: EVH |
| `ZM6` | Settings field: ZM6 |
| `kYH` | Settings field: kYH |
| `SYH` | Settings field: SYH |
| `D4_` | Settings field: D4_ |
| `wiA` | Settings field: wiA |
| `Ba` | Settings field: Ba |
| `sw6` | Platform branch selector (wsl / ow6 / i2) |
| `R_` | Runtime environment tag |
| `QFH` | VSCode (`claude-vscode`) environment check |
| `Xu` | Session context accessor |
| `S18` | State snapshot helper |
| `BY4` | State broadcast helper |
| `PnH` | Fast mode availability prefetch function |
| `MD_` | Prefetch short-circuit (recent check guard) |
| `_q` | Traffic policy accessor (`essential-traffic` / `no-telemetry`) |
| `$gA` | Traffic policy state reader |
| `HW` | Auth token resolver dispatcher |
| `DO` | Low-level auth resolution (API key / OAuth) |
| `w7` | Bare-mode git helper |
| `MN` | Auth header builder |
| `p26` | API key env var reader (`ANTHROPIC_API_KEY`) |
| `IP` | API key helper reader (`apiKeyHelper`) |
| `nD6` | File-descriptor token reader |
| `Vj` | OAuth token assembler |
| `G4` | Auth provider variant selector |
| `aC` | Token slicer (20-char excerpt for logging; bundle.js:+2134462) |
| `MT` | Auth type classifier |
| `QY4` | Access token extractor |
| `C1` | OAuth endpoint URL builder |
| `lxA` | lxA |
| `V2f` | V2f |
| `sC` | Org status endpoint caller |
| `Km4` | Org status response handler / OAuth 401 recovery orchestrator |
| `bs` | LS wrapper |
| `MM6` | MM6 |
| `kH` | Feature flag evaluator (ok path) |
| `orH` | OAuth token expiry checker |
| `CH` | Feature flag evaluator (bad path) |
| `lB` | Lightweight promise wrapper (SO4/uP1) |
| `If` | GN1 event emitter |
| `oo` | oo |
| `GM6` | GM6 |
| `SH` | Log error emitter (`Sa.logError`) |
| `qm4` | qm4 |
| `CA9` | Retry delay calculator (Math.min / Math.max) |
| `wO` | Refresh token writer (w58) |
| `fA` | Full session/conversation runner |
| `u3` | Session initializer (IYH + xB) |
| `IYH` | Settings path resolver (EI.join / us6 / ZUf / nu) |
| `Q2` | Config file reader (Ca) |
| `Ca` | Raw config JSON reader + slicer |
| `k8` | Error code classifier (V8) |
| `V8` | V8 error code mapper |
| `Of_` | Session timestamp setter (sa6.set) |
| `vNH` | Path-based settings accessor |
| `us6` | Settings file path resolver |
| `fw6` | Atomic file write (temp + rename + fchmod) |
| `O` | Symbolic link resolver |
| `L` | File handle wrapper |
| `lO` | Cache clear (NQ6.clear / ir8.clear) |
| `la6` | gitignore / .claude append-file logger |
| `b6` | Git executable finder |
| `lK_` | W4 git helper |
| `ca6` | git check-ignore runner |
| `amf` | Global gitconfig excludesfile resolver |
| `icA` | icA |
| `rcA` | rcA |
| `nu` | .claude settings dir path builder |
| `t6` | Feature state writer (c + A6) |
| `A6` | S56 state store accessor |
| `uB` | Settings load orchestrator |
| `nG` | nG |
| `Kq` | Memory usage sampler (process.memoryUsage) |
| `H4_` | Settings load telemetry emitter |
| `hQ6` | hQ6 |
| `G8` | Global config save (with auth-loss guard) |
| `R58` | Config save with lock and backup rotation |
| `f` | Promise lifecycle tracker |
| `YN1` | Object assign merger |
| `YoH` | YoH |
| `ZV_` | Backup directory path builder |
| `V` | V |
| `P` | P |
| `E` | E |
| `GJH` | GJH |
| `L19` | Object.entries iterator |
| `LW6` | Timestamp-based staleness checker |
| `S58` | Config save helper |
| `K` | K |
| `cB8` | Fast mode UI component (JSX) |
| `dB8` | Fast mode flag settings applier |
| `cDH` | cDH |
| `JX` | JX |
| `_L` | yVH wrapper |
| `XnH` | ZX dispatcher |
| `ZX` | UI state container |
| `CEH` | Command config schema parser (String/Number/Boolean coercions) |
| `P3` | Command argument parser |
| `S0` | S0 UI state node |
| `T9` | Model name normalizer / selector |
| `REH` | Fast mode availability renderer (vm + nf + IA) |
| `vm` | Theme selector |
| `mW6` | UB4 color helper |
| `NM8` | Theme inclusion check |
| `kF` | Color prefix parser |
| `Bq9` | Bq9 |
| `nf` | Legacy global config compatibility reader |
| `rv` | TM6 set diff filter |
| `J4_` | Settings path resolver (u3 + i8H.resolve) |
| `IA` | ANSI/color status line renderer |
| `gJH` | Chalk color name dispatcher |
| `el` | el |
| `oB` | oB |
| `_9` | Argument tokenizer |
| `wl` | Argument parser (OY / fB / dA / yz) |
| `OY` | OY |
| `fB` | fB |
| `yz` | Argument value normalizer |
| `hY` | hY |
| `zS` | Number/integer formatter |
| `Zv1` | toFixed formatter |
| `YhH` | UI label builder |
| `A1` | Model alias resolver |
| `llH` | llH |
| `jJ` | Model name substring matcher |
| `bM6` | bM6 |
| `q5` | String replacement utility |
| `$zA` | $zA |
| `zv1` | Date/model version parser |
| `lB8` | Fast mode root UI component (JSX wrapper) |
| `j6` | App state hook (useSyncExternalStore) |
| `qy_` | App state context hook |
| `n9` | MCP server state hook |
| `of` | of |
| `XA` | XA |
| `y1` | Clock context hook |
| `Lr4` | Reducer helper |
| `M` | MCP connection manager |
| `HCH` | MCP client initializer |
| `Wi` | MCP slot connector |
| `tV` | tV |
| `c8` | c8 |
| `wv6` | wv6 |
| `zn9` | MCP connection attempt scheduler |
| `zJ8` | MCP error state handler |
| `MJ8` | MCP If-event emitter |
| `Y8` | MCP debug logger (Sa.logMCPDebug) |
| `nX8` | MCP OAuth tool injector |
| `iX8` | MCP OAuth callback handler |
| `Wn9` | MCP post-connection hook |
| `uB_` | MCP connection state updater |
| `j` | Active process map |
| `lN` | MCP skills telemetry emitter |
| `ZB_` | MCP server filter |
| `y` | y |
| `zL` | MCP error logger (Sa.logMCPError) |
| `TH` | String coercion helper |
| `jn9` | jn9 |
| `f66` | parseInt port parser |
| `nP8` | parseInt retry parser |
| `Mi8` | MCP connection result applier |
| `eRH` | m2H MCP state diff |
| `_G` | MCP cleanup runner |
| `$` | $ |
| `mDK` | mDK timestamp event |
| `NGA` | MCP server list updater |
| `RX8` | MCP capability checker (ATL / IB_) |
| `l8` | Timeout-with-abort helper |
| `q66` | m2H state accessor |
| `Y$9` | Y$9 |
| `z` | Session fold/stop helper |
| `WS` | Conversation session starter |
| `chH` | PS channel helper |
| `qX_` | UUID-based request dispatcher |
| `dU` | Session shutdown helper (Promise.race) |
| `ULH` | pLH.shutdown caller |
| `BLH` | clearTimeout + yV_ cleanup |
| `fD_` | Cooldown expiry / re-enable emitter |
| `$6` | S56 state writer |
| `S56` | Root Zustand store |
| `CA` | Keyboard handler registration component |
| `vD` | IXH context accessor |
| `C9` | Countdown formatter (floor/round for days/hours/minutes/seconds) |