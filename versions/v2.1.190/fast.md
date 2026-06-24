---
type: feature-spec
feature: "fast"
cc_version: 2.1.190
updated: "2026-06-24"
tags: ["fast", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.187
analysis_basis: "CC v2.1.187 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/fast`

> Analysis basis: CC v2.1.187 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.187

---

## Overview

`/fast` toggles **Fast mode** (labelled "research preview" in the UI), a feature that switches the active session to a lower-latency inference path available exclusively through the Anthropic API. When invoked it reads an optional `on` / `off` argument, validates whether Fast mode is currently accessible for the user's account and organisation, then updates session state and renders an interactive picker panel that shows current availability status, quota countdown, and the documentation link.

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
| module_id | `yxl` |
| load_inline | `true` |
| loc_byte | `12473149` |
| loc_byte_end | `12473421` |
| loc_line | `8450` |
| arbor_handler.name | `xhf` |
| arbor_handler.fqn | `claude-2.1.187::xhf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `3` |

Analysis basis: CC v2.1.187 bundle.js:+12473149

---

## Input Branching

Six or more distinct input and state-transition paths exist, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/fast [arg]"]) --> B{Argument present?}

    B -- "on / yes" --> C{Fast mode available?}
    B -- "off" --> OFF[Disable fast mode\nwrite 'off' to session state]
    B -- "no arg" --> D[Show interactive picker panel]

    C -- "Non-Anthropic API\n(bedrock/vertex/foundry\n/anthropicAws/mantle)" --> E[Error: 'Fast mode is only available\nwhen using the Anthropic API directly']
    C -- "Agent SDK context" --> F[Error: 'Fast mode is not available\nin the Agent SDK']
    C -- "org status = pending" --> G[Warning: 'Checking fast mode\navailability (org status pending)']
    C -- "penguins_off flag set" --> H[Error: 'Fast mode is not available']
    C -- "subscription = free" --> I[Error: 'Fast mode requires\na paid subscription']
    C -- "subscription = evaluation" --> J[Error: 'Fast mode unavailable during\nevaluation. Please purchase credits.']
    C -- "org disabled by preference" --> K[Error: 'Fast mode has been disabled\nby your organization']
    C -- "extra_usage_disabled" --> L[Error: 'Fast mode requires usage credits\n· /usage-credits to turn them on']
    C -- "network_error cached" --> M[Warning: 'Fast mode unavailable due\nto network connectivity issues']
    C -- "overloaded" --> N[Warning: 'Fast mode overloaded and is\ntemporarily unavailable']
    C -- "quota exhausted" --> O[Info: 'You\'ve hit your fast limit\n· resets in <countdown>']
    C -- "Available" --> P[Enable fast mode\nwrite 'active' to session state\nemit tengu_fast_mode_toggled]

    OFF --> Q[Emit tengu_fast_mode_toggled\nShow 'Fast mode OFF' notification]
    P --> R[Show 'Fast mode ON' notification]
    D --> S{Picker rendered\n– user interacts}
    S -- "tab / toggle key" --> T[Toggle fast mode state]
    S -- "enter / confirm" --> U[Commit selection]
    S -- "escape / cancel" --> V[Dismiss without change\nLog 'Kept Fast mode OFF' if applicable]

    P --> W[Prefetch: check if in-flight promise\nalready active for this session]
    W -- "prefetch in progress" --> X[Return existing promise\nLog 'Fast mode prefetch in progress']
    W -- "fetched recently" --> Y[Skip: Log 'Skipping fast mode prefetch,\nfetched recently']
    W -- "stale / first call" --> Z[Call availability API\nCache result]
```

Analysis basis: CC v2.1.187 bundle.js:+12472159 (handler `xhf`), +2265041 (API-only error), +2265109 (penguins_off error), +2265456 (Agent SDK error), +2265618 (pending org), +2264534 (free tier), +2264601 (evaluation), +2264692 (org disabled), +2264776 (extra_usage_disabled), +2264873 (network error), +2265781 (network_error literal)

---

## Behavioral Spec

### 1. Main Handler (`xhf`)

```
async function fastCommandHandler(context):
    // Resolve the availability state object (Voe)
    availabilityState = computeFastModeAvailability(context)

    // Render the React-JSX UI component
    reactElement = renderFastModePanel(availabilityState, context)

    // If argument is "off" (literal "off" at +12472274)
    if context.args == "off":
        disableFastMode(context)
        showNotification("Fast mode OFF")   // literal at +12468814
        emit("tengu_fast_mode_toggled")
        return

    // Otherwise show the interactive picker
    emit("tengu_fast_mode_picker_shown")    // +12472399
    return reactElement
```

Analysis basis: CC v2.1.187 bundle.js:+12472159

---

### 2. Fast Mode Availability Checker (`Voe`)

This function is the central gatekeeper. It evaluates the current provider context, organisation flags, subscription tier, and network state to determine whether Fast mode may be turned on.

```
function computeFastModeAvailability(context):
    provider = getCurrentProvider()   // reads Ir, Bl helpers

    // Provider guard
    if provider in ["bedrock", "foundry", "anthropicAws", "mantle", "vertex"]:
        return { available: false,
                 reason: "Fast mode is only available when using the Anthropic API directly" }

    // SDK guard
    if runningInsideAgentSDK(context):
        return { available: false,
                 reason: "Fast mode is not available in the Agent SDK" }

    // Organisation status
    orgStatus = fetchOrgStatus()    // calls ys, qNe, Ba subsystem
    if orgStatus == "pending":
        return { available: false,
                 reason: "Checking fast mode availability (org status pending)" }

    // Flag settings (flagSettings literal +2265394)
    if flagSettings.penguins_off:
        emit("tengu_penguins_off")
        return { available: false, reason: "Fast mode is not available" }

    // Subscription checks
    if subscription == "free":
        return { available: false,
                 reason: "Fast mode requires a paid subscription" }

    if subscription == "evaluation":
        return { available: false,
                 reason: "Fast mode unavailable during evaluation. Please purchase credits." }

    // Organisation preference
    if orgFlags.preference == "disabled":
        return { available: false,
                 reason: "Fast mode has been disabled by your organization" }

    // Extra usage credits
    if orgFlags.extra_usage_disabled:
        return { available: false,
                 reason: "Fast mode requires usage credits · /usage-credits to turn them on" }

    // Network state
    if cachedNetworkStatus == "network_error":
        return { available: false,
                 reason: "Fast mode unavailable due to network connectivity issues" }

    // Overloaded
    if fastModeStatus == "overloaded":
        return { available: false,
                 reason: "Fast mode overloaded and is temporarily unavailable" }

    // All checks passed
    return { available: true, status: "active" }
```

Analysis basis: CC v2.1.187 bundle.js:+2265041, +2265109, +2265456, +2265526, +2265618, +2264534, +2264601, +2264692, +2264747, +2264873, +2264952

---

### 3. Availability Prefetch Manager (`uJe`)

The prefetch system prevents redundant API calls by deduplicating in-flight requests and suppressing recently-completed checks.

```
async function prefetchFastModeAvailability(context):
    // Deduplication guard
    if activePrefetchPromise != null:
        log("Fast mode prefetch in progress, returning in-flight promise")
        return activePrefetchPromise

    // Staleness guard
    if lastFetchTimestamp != null and (Date.now() - lastFetchTimestamp) < THRESHOLD:
        log("Skipping fast mode prefetch, fetched recently")
        return cachedResult

    // Start real fetch
    activePrefetchPromise = fetchAvailabilityFromAPI(context)

    try:
        result = await activePrefetchPromise
        lastFetchTimestamp = Date.now()
        cachedResult = result
        emit("oRr.emit", result)
        return result
    catch AuthError (401 / 403):
        handleOAuthError(error)   // delegates to wed / cU subsystem
        return { available: false, reason: "No auth available" }
    catch NetworkError:
        emit("tengu_org_penguin_mode_fetch_failed")
        return { available: false, status: "network_error" }
    finally:
        activePrefetchPromise = null
```

Analysis basis: CC v2.1.187 bundle.js:+2269143 (sRr), +2269232 (prefetch in progress literal), +2269479 (skip literal), +2269649 (no auth), +2270282 (oRr.emit), +2270651 (tengu_org_penguin_mode_fetch_failed)

---

### 4. Interactive Picker UI Component (`iYn`)

The picker is a JSX-rendered terminal UI panel presented when no explicit `on`/`off` argument is supplied, or when further confirmation is needed.

```
function FastModePickerComponent(props):
    [localState, setLocalState] = useState(initialFastModeState)
    clockContext = useClock()
    appState = useAppState()

    // Key bindings (registered via Do / registerHandler)
    onKey("tab")    => dispatch("confirm:cycleMode")
    onKey("enter")  => dispatch("confirm:yes")
    onKey("escape") => dispatch("cancel")
    onKey("toggle") => dispatch("confirm:toggle")

    // Status display logic
    if fastModeState == "overloaded":
        display("Fast mode overloaded and is temporarily unavailable")
    else if quotaExhausted:
        display("You've hit your fast limit · resets in " + formatCountdown(resetTime))
    else if fastModeState == "active":
        display("Fast mode", "ON")   // literals +12471198
    else:
        display("Fast mode", "OFF")  // literal +12471204

    // Documentation link rendered always
    renderLink("https://code.claude.com/docs/en/fast-mode")   // +12471640

    // Title
    renderTitle(" Fast mode (research preview)")   // literal +12470480

    return layout(column, row, statusRow, controlRow)
```

Analysis basis: CC v2.1.187 bundle.js:+12469068, +12469276, +12469441, +12470434, +12471130, +12471358, +12471425, +12471454, +12471640, +12470480

---

### 5. Opus 4.6 Deprecation Notice Handler (`oGs` / `eko`)

A secondary check fires specifically for the `claude-opus-4-6` model (literal at +2266401) after a sunset date (`2026-06-29` at +2266470).

```
function checkOpus46FastModeDeprecation(context):
    model = context.currentModel
    if model == "claude-opus-4-6":
        sunsetDate = Date.parse("2026-06-29")
        if Date.now() >= sunsetDate:
            emit("tengu_sunset_penguin_opus46")   // +2266440
            // Downgrade to claude-opus-4-8 or show deprecation warning
            showNotification("Opus 4.8")   // literal +2266026
```

Analysis basis: CC v2.1.187 bundle.js:+2266390, +2266401, +2266440, +2266470, +12467929 (`opus46-fast-mode-deprecation` literal)

---

### 6. Fast Mode Cooldown Timer (`rRr`)

When Fast mode is disabled after being overloaded or rate-limited, a cooldown timer tracks re-enablement.

```
function handleFastModeCooldown():
    if currentState == "cooldown":
        log("Fast mode cooldown expired, re-enabling fast mode")   // +2266722
        enableFastMode()
        emit("iGs.emit", { state: "active" })
```

Analysis basis: CC v2.1.187 bundle.js:+2266669 (`cooldown` literal), +2266709, +2266722

---

### 7. Auth Error Recovery (`wed` / `cU`)

When the availability API returns HTTP 401 or 403 the handler invokes the OAuth recovery pipeline before surfacing an error to the user.

```
async function handleAuthError(error, context):
    if error.status == 401:
        strategy = selectRecoveryStrategy(context)
        // Attempt disk-token recovery
        if diskTokenAvailable():
            emit("tengu_oauth_401_recovered_from_disk")
            return refreshedToken
        // Attempt keychain recovery
        if keychainAvailable():
            emit("tengu_oauth_401_recovered_from_keychain")
            return refreshedToken
        // SDK callback
        newToken = await sdkGetOAuthToken()
        if newToken == null:
            log("SDK getOAuthToken callback returned null (no token available)")
        else if newToken == expiredToken:
            log("SDK getOAuthToken callback returned the same expired token")
            emit("tengu_oauth_401_sdk_callback_failed")
        else:
            emit("tengu_oauth_401_sdk_callback_refreshed")
            return newToken
        // Zombie exit guard (after CLAUDE_CODE_AUTH_FAIL_EXIT_MS)
        if timeSinceFirstFailure > AUTH_FAIL_EXIT_MS:
            emit("tengu_oauth_401_zombie_exit")
            setTimeout(process.exit, ...)
```

Analysis basis: CC v2.1.187 bundle.js:+3069021 (cU), +3070082, +3070809, +3071247, +3071484, +3071746

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_fast_mode_toggled` | Emitted on every on/off toggle (bundle.js:+12468543) |
| Telemetry — `tengu_fast_mode_picker_shown` | Emitted when the interactive picker panel is displayed (bundle.js:+12472399) |
| Telemetry — `tengu_penguins_off` | Emitted when the org-level `penguins_off` flag blocks Fast mode (bundle.js:+2265147) |
| Telemetry — `tengu_org_penguin_mode_fetch_failed` | Emitted on network failure during availability prefetch (bundle.js:+2270651) |
| Telemetry — `tengu_sunset_penguin_opus46` | Emitted when `claude-opus-4-6` is in use after its sunset date (bundle.js:+2266440) |
| Telemetry — `tengu_oauth_401_*` | Multiple OAuth recovery events emitted during auth-error handling (bundle.js:+3070082–+3071746) |
| Telemetry — `tengu_config_*` | Config read/write events emitted when persisting the fast-mode flag (bundle.js:+13750291–+13750770) |
| Telemetry — `tengu_feature_ok / bad / sad` | Feature-flag check events from the flag system called by the availability checker |
| appState changes | `fastMode` key in app state is set to `"active"`, `"off"`, `"cooldown"`, or `"overloaded"` (literals at +12467611, +2267131, +2266669) |
| Session flag written | `flagSettings.fastMode` (literal `fastMode` at +12467611) persisted to settings layer via `Dt` / config subsystem |
| Notification | Short toast notification displayed: `"Fast mode OFF"` (literal at +12468814) or `"ON"` on enable |
| Prefetch cache | In-memory timestamp gate and promise deduplicator prevent repeated availability API calls (bundle.js:+2269232, +2269479) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | Key handlers registered globally for the picker panel via `Do.registerHandler` (bundle.js:+4211193) |
| thinClientDispatch | Registration declares `"control-request"` — availability check may be forwarded to a control plane in thin-client mode |

---

## Version History

| Version | Change |
|---|---|
| v2.1.187 | Initial analysis |

---

## Common Mistakes

1. **Using `/fast` on a non-Anthropic API provider** — Fast mode is hard-gated to the Anthropic direct API. Bedrock, Vertex, Foundry, Mantle, and AnthropicAws integrations all produce an immediate error message ("Fast mode is only available when using the Anthropic API directly") with no fallback. Analysis basis: CC v2.1.187 bundle.js:+2265041.

2. **Expecting `/fast on` to work during evaluation or on a free subscription** — The command inspects the subscription tier before enabling. Free and evaluation accounts receive distinct error messages and cannot override this gate. Analysis basis: CC v2.1.187 bundle.js:+2264534, +2264601.

3. **Invoking `/fast` inside the Agent SDK** — When Claude Code is run via the Agent SDK the Fast mode path is explicitly blocked with the message "Fast mode is not available in the Agent SDK". Analysis basis: CC v2.1.187 bundle.js:+2265456, +2265526.

4. **Misreading the overloaded state as permanent** — When Fast mode is `"overloaded"` the quota or server load clears automatically. The cooldown mechanism re-enables it without another `/fast` invocation. Analysis basis: CC v2.1.187 bundle.js:+12471358, +2266669.

5. **Passing any string other than `on`, `yes`, or `off`** — The argument parser only recognises the literals `"on"`, `"yes"` (at +29726/+29732), and `"off"` (at +12472274). Any other value falls through to displaying the interactive picker rather than setting a specific state.

6. **Assuming the command is unavailable when org status is `"pending"`** — The pending state is transient; the UI shows a "Checking fast mode availability" message and will re-resolve without user action once the org verification completes. Analysis basis: CC v2.1.187 bundle.js:+2265587, +2265618.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `xhf` | Main async handler for `/fast` command (arbor_handler) |
| `Voe` | Fast mode availability state calculator / gate function |
| `uJe` | Availability prefetch manager with deduplication and cache |
| `sYn` | Session initialisation helper called from main handler |
| `oYn` | Inner session setup; applies flag settings and resolves model |
| `iYn` | Interactive Fast mode picker JSX component |
| `oGs` | Opus 4.6 deprecation detection and sunset check |
| `eko` | Wraps `oGs`; invoked from session init path |
| `rRr` | Cooldown timer / re-enable emitter |
| `jMe` | Flag-settings value coercion (String / Number / Boolean) |
| `zMe` | Theme and prompt-border config reader |
| `lc` | Settings layer lookup helper |
| `Bl` | Provider resolver / base config accessor |
| `Ir` | Provider type classifier (returns bedrock, vertex, etc.) |
| `nt` | String coercion / normalisation utility |
| `Dt` | Settings persistence / config write helper |
| `_Ee` | Low-level config file read with backup management |
| `MRf` | Config file watcher / reload helper |
| `T` | Logging / debug output utility |
| `Ba` | Full settings builder; merges user, project, local layers |
| `Qo` | Model alias resolver (sonnet, haiku, opus, best, fable) |
| `uCt` | User-settings read helper |
| `dCt` | Policy/flag settings merger |
| `l2` | Settings layer composition |
| `Tn` | Settings hierarchy navigator |
| `hsn` | Remote settings fetch helper |
| `$Xe` | Policy entries iterator |
| `zNe` | Model string normaliser with gateway detection |
| `ix` | Checks if provider is first-party Anthropic |
| `Eo` | Application-inference-profile detector |
| `Lfe` | Feature-flag enabled/disabled resolver |
| `uRr` | Feature-flag array/object check |
| `qNe` | Agent context / auth-type resolver |
| `ab` | Auth object builder |
| `xfe` | Auth token string normaliser |
| `Mfe` | Subscription plan reader (`pro` etc.) |
| `Ao` | OAuth state accessor |
| `xi` | Auth credentials composer |
| `ys` | Model availability and user-state read |
| `v9` | Session state read (Bo, Ba, lG) |
| `Kg` | Model variant selector |
| `vw` | Model filtering / recommendation logic |
| `$S` | Notification / toast dispatcher |
| `Nu` | Toast queue manager |
| `Lm` | Opus 4 model list filter (`opus-4-6/7/8` variants) |
| `C9` | Fast mode status reader from session state |
| `dfn` | Fast mode flag formatter |
| `QBu` | Session state setter for fast mode |
| `sRr` | Prefetch state init helper |
| `Vi` | Traffic class reader (`essential-traffic`, `no-telemetry`) |
| `jns` | Traffic-class normaliser |
| `qC` | API client builder |
| `Yg` | HTTP request executor for fast-mode API check |
| `Ad` | API arguments assembler |
| `fx` | Request retry wrapper |
| `cA` | Auth credential injector into request |
| `Nl` | Request normaliser |
| `sU` | Slice / truncate helper for API responses |
| `VC` | Response type checker |
| `e3u` | Error wrapper for availability API failures |
| `Ls` | OAuth URL resolver |
| `cU` | In-flight request map manager |
| `wed` | Core HTTP request handler with auth-error recovery |
| `SU` | Request stream initialiser |
| `aZe` | Token expiry checker |
| `WG` | Response stream batcher |
| `Gl` | Stream transform / chunk handler |
| `ke` | Streaming response consumer |
| `zai` | OAuth back-off / retry timer |
| `Rh` | Post-auth-recovery request replayer |
| `ao` | Full settings load from disk |
| `Jm` | Settings path resolver |
| `lbe` | Settings file loader |
| `QEr` | Settings file existence and merge orchestrator |
| `Nls` | Settings file iterator |
| `DG` | Directory-based settings scanner |
| `Pls` | Per-file settings parser |
| `DC` | Settings document reader |
| `XJ` | Raw file reader with BOM/encoding handling |
| `kn` | Canonical error code normaliser |
| `cn` | Error class check (EISDIR etc.) |
| `lEr` | Settings cache invalidator |
| `Q1e` | Settings path calculator |
| `fsn` | Project root path resolver |
| `oIt` | Atomic file write with temp-file + rename |
| `Nd` | Filesystem realpath resolver |
| `E7e` | Extended attribute / chmod error classifier |
| `bH` | Cache clear on session reset |
| `Fis` | Gitignore-aware file write helper |
| `Pt` | Git executable locator |
| `qyr` | Git command runner |
| `Eon` | Git check-ignore runner |
| `lau` | Git global excludes-file path resolver |
| `Nis` | Git ls-files tracker |
| `Uis` | File write with gitignore tracking |
| `g9` | `.claude` config directory path builder |
| `gr` | Global config root resolver |
| `VL` | Home directory accessor |
| `Mt` | Feature-flag evaluator (ok/bad/sad) |
| `Pe` | Flag rules evaluator |
| `PG` | Settings load-from-disk entry point |
| `qL` | Settings load start/end marker |
| `ta` | Memory-usage sample collector |
| `ZEr` | Full settings reload orchestrator |
| `XYt` | Settings load completion marker |
| `hn` | Global config save with lock |
| `GQn` | Config file write with backup rotation |
| `_Ws` | Config object merger |
| `MHt` | Config change notifier |
| `NOo` | Backup directory path builder |
| `ADe` | Config auth-loss prevention check |
| `DOo` | Config entry iterator |
| `MKt` | Config timestamp recorder |
| `BQn` | Config fallback write handler |
| `uU` | Number formatter for countdown display |
| `gGs` | Integer/decimal display formatter |
| `dJe` | Fast mode disabled state helper |
| `iYn` | Fast mode picker React component (see above) |
| `Ht` | App state hook accessor |
| `y6r` | App state context reader |
| `bi` | Key-input handler component |
| `gc` | Global config state selector |
| `So` | Session state selector |
| `Ts` | Clock context reader |
| `J_d` | Key event reducer |
| `a` | MCP server connection manager |
| `a9e` | MCP session lifecycle orchestrator |
| `RB` | MCP tool registry builder |
| `Qw` | MCP event emitter wrapper |
| `zn` | MCP response normaliser |
| `mua` | MCP connection attempt handler |
| `myn` | MCP transport factory |
| `pyn` | MCP stream pipe helper |
| `ln` | MCP debug logger |
| `zRn` | MCP reconnect scheduler |
| `BUt` | MCP post-connect setup |
| `mJr` | MCP message dispatcher |
| `eL` | MCP skills tool lister |
| `ZXr` | MCP server filter |
| `Vc` | MCP error logger |
| `be` | String coercion utility |
| `yua` | MCP session cleanup |
| `git` | MCP port parser |
| `nMn` | MCP timeout parser |
| `brr` | MCP connection result applicator |
| `i9e` | MCP reconnect eligibility checker |
| `KT` | MCP slot cleanup |
| `hla` | MCP server config hash |
| `uBo` | MCP server map reconciler |
| `xRn` | MCP capability filter |
| `Kn` | Retry / abort controller |
| `mit` | MCP initialise handshake |
| `qRi` | Key-input fold accumulator |
| `VMt` | Input state machine |
| `rRr` | Fast mode cooldown re-enable emitter |
| `Ve` | React key reference helper |
| `rKe` | React hook initialiser |
| `c` | Terminal encoder |
| `En` | ANSI escape builder |
| `Do` | Key-handler registration hook |
| `QE` | Global key-handler context |
| `Ui` | Duration countdown formatter |
| `ICe` | ANSI colour code applicator |
| `vo` | Colour-prefix detector |
| `ij` | Colour object identity mapper |
| `Xwc` | Model name formatter |
| `I6o` | Terminal colour-capability probe |
| `wc` | API key tail-redactor |
| `c8o` | API key format mapper |
| `dze` | Output write helper |
| `JWo` | Stream write adapter |
| `FKe` | Debounced log flusher |
| `dpe` | Log path builder |
| `Mre` | Log directory creator |
| `p8o` | Log file path resolver |
| `Ocr` | Log file rotation handler |
| `Zwc` | Log append-with-rotation helper |
| `Ucr` | Log byte-length guard |
| `Ei` | Process signal registration |
| `Asn` | Settings merge resolver |
| `Ioe` | Settings key iterator |
| `abe` | Remote managed settings injector |
| `Toe` | Default settings provider |
| `aCt` | Settings context builder |
| `V5o` | Policy enforcement helper |
| `nl` | Model string strip/normalise |
| `Qo` | Model alias resolver (see above) |
| `d3u` | Feature-set accumulator |
| `u3u` | Feature-set union helper |
| `gfn` | Model-to-feature-set mapper |
| `kwt` | Model starts-with classifier |
| `wGs` | Settings export mapper |
| `vGs` | Settings value index finder |
| `p3u` | Model feature resolver with index |
| `IGs` | Model index-of helper |
| `f3u` | Model startsWith feature resolver |
| `CGs` | Prefix-match helper |
| `W` | Promise / async utilities |
| `Le` | Feature-ok handler |
| `Re` | Feature-bad handler |
| `WG` | Response batch streamer |
| `Gl` | Stream transformer |
| `gJ` | Response accumulator |
| `TEt` | Response type enforcer |
| `ved` | Response validator |
| `Rh` | Auth-recovery request replayer |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.