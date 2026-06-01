---
type: feature-spec
feature: "fast"
cc_version: "2.1.144"
updated: "2026-06-01"
tags: ["fast", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.144 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/fast`

> Analysis basis: CC v2.1.144 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.144

---

## Overview

The `/fast` command toggles **Fast mode** (a research-preview capability) on or off for the current Claude Code session. When invoked without an argument it opens an interactive picker UI; when invoked with `on` or `off` it applies the change directly. The handler validates eligibility (subscription tier, API surface, SDK context, network state) before persisting the preference and emitting telemetry.

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
| module_id | `yWq` |
| load_inline | `true` |
| loc_byte | `11448740` |
| loc_byte_end | `11449012` |
| loc_line | `6995` |
| arbor_handler.name | `tN7` |
| arbor_handler.fqn | `claude-2.1.144::tN7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `3` |

Analysis basis: CC v2.1.144 bundle.js:+11448740

---

## Input Branching

Six or more distinct eligibility branches exist, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/fast [arg]"]) --> B{Parse argument}
    B -->|"on / yes / 1"| C[Request enable]
    B -->|"off"| D[Request disable]
    B -->|no argument| E[Open interactive picker UI]

    C --> F{Eligibility check}
    D --> F
    E --> F

    F -->|Not Anthropic API direct| G["Error: Fast mode is only available\nwhen using the Anthropic API directly"]
    F -->|Fast mode not available| H["Error: Fast mode is not available"]
    F -->|Agent SDK context| I["Error: Fast mode is not available\nin the Agent SDK"]
    F -->|Free-tier account| J["Error: Fast mode requires\na paid subscription"]
    F -->|Evaluation credits| K["Error: Fast mode unavailable\nduring evaluation.\nPlease purchase credits."]
    F -->|Org disabled| L["Error: Fast mode has been\ndisabled by your organization"]
    F -->|Extra usage disabled| M["Error: Fast mode requires\nusage credits · /usage-credits\nto turn them on"]
    F -->|Network connectivity issue| N["Error: Fast mode unavailable\ndue to network connectivity issues"]
    F -->|Currently unavailable| O["Error: Fast mode is currently\nunavailable"]
    F -->|Eligible| P{Resolve current mode}

    P -->|Already in desired state| Q["Log: Kept Fast mode OFF"]
    P -->|Toggle permitted| R[Persist fastMode preference\nto settings]

    R --> S[Emit tengu_fast_mode_toggled]
    S --> T{Interactive picker?}
    T -->|Yes| U[Render picker JSX\nEmit tengu_fast_mode_picker_shown]
    T -->|No| V[Return status string\n"enabled (cached)" or\n"disabled (network_error)"]
```

Analysis basis: CC v2.1.144 bundle.js:+11447783, +2149510, +2149578, +2149762, +2149030, +2149071, +2149162, +2149246, +2149343, +2149422

---

## Behavioral Spec

### 1. Main Handler — `fastModeCommandHandler` (`tN7`)

The top-level async handler is the Arbor-resolved symbol `tN7`.

```
async function fastModeCommandHandler(context):
    // Step 1: Read argument
    rawArg = context.args.trim()

    // Step 2: Pre-flight checks (ua)
    eligibility = await checkFastModeEligibility(context)
    if eligibility.blocked:
        return renderErrorMessage(eligibility.reason)

    // Step 3: Determine desired state
    if rawArg in ["on", "yes", "1"]:
        desiredState = ENABLED
    else if rawArg == "off":
        desiredState = DISABLED
    else:
        desiredState = TOGGLE_PICKER   // open interactive UI

    // Step 4: Prefetch fast-mode status (ixH) if needed
    if not recentlyFetched():
        await prefetchFastModeStatus(context)
    else:
        log("Skipping fast mode prefetch, fetched recently")

    // Step 5: Apply or open picker
    if desiredState == TOGGLE_PICKER:
        emit("tengu_fast_mode_picker_shown")
        return renderFastModePicker(context)
    else:
        return applyFastModeState(desiredState, context)
```

Analysis basis: CC v2.1.144 bundle.js:+11447783, +11447844, +11447916, +11448004, +11448065

---

### 2. Eligibility Check — `checkFastModeEligibility` (`ua`)

```
async function checkFastModeEligibility(context):
    apiSurface = resolveApiSurface(context)   // DK / xH

    // API surface gate
    if apiSurface not in ["anthropic-direct"]:
        if apiSurface == "agent-sdk":
            return blocked("Fast mode unavailable: Fast mode is not available in the Agent SDK")
        return blocked("Fast mode is only available when using the Anthropic API directly")

    // Fetch availability status (P6)
    status = await fetchFastModeAvailability(context)

    if status.reason == "free":
        return blocked("Fast mode requires a paid subscription")
    if status.reason == "evaluation":
        return blocked("Fast mode unavailable during evaluation. Please purchase credits.")
    if status.reason == "preference":
        return blocked("Fast mode has been disabled by your organization")
    if status.reason == "extra_usage_disabled":
        return blocked("Fast mode requires usage credits · /usage-credits to turn them on")
    if status.reason == "network_error":
        return blocked("Fast mode unavailable due to network connectivity issues")
    if not status.available:
        return blocked("Fast mode is currently unavailable")

    emit("tengu_penguins_off")   // availability confirmed
    return eligible()
```

Analysis basis: CC v2.1.144 bundle.js:+11447797, +2149478, +2149510, +2149578, +2149616, +2149700, +2149762, +2149832, +2149906

---

### 3. Fast-Mode Status Prefetch — `prefetchFastModeStatus` (`ixH`)

```
async function prefetchFastModeStatus(context):
    // De-duplicate in-flight requests
    if inFlightPromise exists:
        log("Fast mode prefetch in progress, returning in-flight promise")
        return inFlightPromise

    // Auth resolution (Aq / D3A)
    authToken = resolveAuthToken(context)
    if not authToken:
        log("No auth available")
        emit("tengu_org_penguin_mode_fetch_failed")
        return

    // Record fetch timestamp (Date.now)
    lastFetchTime = Date.now()

    // HTTP request with headers (H3L / f1)
    headers = buildRequestHeaders(authToken)   // sets "anthropic-beta", "x-api-key"
    response = await httpGet(fastModeStatusEndpoint, headers)

    // Error handling
    if response.status == 401 or response.status == 403:
        handleOAuthError(response)              // yu / mvL path
        return

    // Persist status to cache (g_ / t6)
    persistFastModeStatusToConfig(response.data)

    // Emit event
    emit("ur8.emit", fastModeUpdateEvent)
```

Analysis basis: CC v2.1.144 bundle.js:+11447844, +2153091, +2153107, +2153122, +2153174, +2153394, +2153421, +2153591, +2153625, +2153690, +2153893, +2154137, +2154174, +2154224

---

### 4. Apply Toggle — `applyFastModeState` (`dX8`)

```
function applyFastModeState(desiredState, context):
    // Read current setting (QX8 / yJH)
    currentFlags = readFlagSettings()       // "fastMode" key
    currentState = currentFlags["fastMode"]

    if currentState == desiredState:
        log("Kept Fast mode OFF")           // no-op branch
        return buildStatusDisplay(currentState)

    // Write new value via settings persistence (kJH / w7)
    newFlags = { ...currentFlags, fastMode: desiredState }
    persistFlagSettings(newFlags)

    // Telemetry
    emit("tengu_fast_mode_toggled", { state: desiredState })

    return buildStatusDisplay(desiredState)
```

Analysis basis: CC v2.1.144 bundle.js:+11444288, +11444295, +11444295, +11444304, +11444363, +11444374, +11444306

---

### 5. Interactive Picker — `renderFastModePicker` (`cX8`)

The picker is a JSX component rendered in the terminal using Ink.

```
function renderFastModePicker(context):
    // State
    [fastModeStatus, setFastModeStatus] = useState(...)
    syncWithExternalStore(appState)

    // Labels / display strings
    titleLabel  = " Fast mode (research preview)"
    onLabel     = "ON "
    offLabel    = "OFF"

    // Key bindings (registered via a_)
    bind("escape")  -> action: "cancel"
    bind("tab")     -> action: "toggle"
    bind("enter")   -> action: "confirm"

    // Overloaded / rate-limit branch
    if status == "overloaded":
        displayWarning("Fast mode overloaded and is temporarily unavailable")
    if status == "limit_hit":
        displayWarning("You've hit your fast limit · resets in <countdown>")

    // Cooldown branch (xr8)
    if cooldownActive:
        log("Fast mode cooldown expired, re-enabling fast mode")

    // Render columns: label + ON/OFF indicator + status badge
    return jsx(
        FastModePickerComponent,
        { title: titleLabel, onLabel, offLabel,
          docsUrl: "https://code.claude.com/docs/en/fast-mode",
          onConfirm: applyFastModeState,
          onCancel: closePicker }
    )
```

Analysis basis: CC v2.1.144 bundle.js:+11444695, +11444706, +11444749, +11444780, +11445078, +11445439, +11445658, +11445734, +11445756, +11445881, +11445918, +11445985, +11446044, +11446237, +11446316, +11446367, +11446459, +11446751, +11446820, +11446826, +11446957, +11446979, +11446992, +11447046, +11447075, +11447163, +11447266, +11447344, +11447586, +11447957

---

### 6. Availability Fetch — `fetchFastModeAvailability` (`P6`)

```
async function fetchFastModeAvailability(context):
    // Growthbook / feature flag gate (Cs / IF / Vr6)
    gbFlags = getGrowthbookFlags()
    if not gbFlags.fastModeEnabled:
        emit("tengu_penguins_off")
        return { available: false, reason: "feature_flag" }

    // Check set membership cache (T$H / m1_ / K56 / vF)
    if cachedStatus exists:
        return cachedStatus

    // Fetch from network (y6 / fCL)
    rawStatus = await networkFetch(fastModeEndpoint)

    // Persist and return (u1_ / F1_)
    persistStatus(rawStatus)
    emitGrowthbookExperimentEvent("GrowthbookExperimentEvent", "growthbook_experiment")
    return rawStatus
```

Analysis basis: CC v2.1.144 bundle.js:+2149478, +2149490, +2149613, +3144509, +3144546, +3144581, +3144598, +3144609, +3144621, +3144635, +3144652, +3144672, +3138152, +3138579

---

### 7. Settings Persistence — `persistFlagSettings` (`kJH` / `w7`)

```
function persistFlagSettings(newFlags):
    // Resolve settings layer (Qs / w7 / V8)
    layer = resolveSettingsLayer(context)   // userSettings / projectSettings / localSettings

    // Theme / display settings also resolved at this point
    currentSettings = loadSettingsFromDisk()

    // Write flag key "fastMode" value
    updatedSettings = merge(currentSettings, { flagSettings: newFlags })
    saveSettings(updatedSettings)
```

Analysis basis: CC v2.1.144 bundle.js:+11442856, +11442859, +3324176, +3324225, +1202240, +1198150, +1198201, +1198223

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_fast_mode_toggled` | Fired on every successful state change (bundle.js:+11444306) |
| Telemetry: `tengu_fast_mode_picker_shown` | Fired when the interactive picker is opened (bundle.js:+11448006) |
| Telemetry: `tengu_penguins_off` | Fired when Fast mode availability is confirmed (bundle.js:+2149616) |
| Telemetry: `tengu_org_penguin_mode_fetch_failed` | Fired when prefetch fails (bundle.js:+2154593) |
| Telemetry: `tengu_oauth_401_sdk_callback_refreshed` | Fired on OAuth 401 recovery via SDK callback (bundle.js:+2926130) |
| Telemetry: `tengu_oauth_401_recovered_from_disk` | Fired on OAuth 401 recovery from disk token (bundle.js:+2926838) |
| Telemetry: `tengu_oauth_401_recovered_from_keychain` | Fired on OAuth 401 recovery from keychain (bundle.js:+2927191) |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` | Fired by feature-flag resolution path (bundle.js:+955520, +955578) |
| Telemetry: `tengu_config_parse_error` | Fired on config file parse failure (bundle.js:+3167468) |
| Telemetry: `tengu_config_lock_contention` | Fired when config lock acquisition is slow (bundle.js:+3164887) |
| Telemetry: `tengu_config_stale_write` | Fired on stale write detection (bundle.js:+3165023) |
| Telemetry: `tengu_config_auth_loss_prevented` | Fired when auth-loss-safe write guard triggers (bundle.js:+3165366) |
| Telemetry: `tengu_daemon_yield` | Fired when daemon yields to foreground (bundle.js:+14560403) |
| appState changes | `fastMode` field in `flagSettings` is written to disk settings (userSettings / projectSettings / localSettings) |
| Hook registration | Key bindings (`escape`, `tab`, `enter`) registered via `OHA.register` (bundle.js:+57049) while picker is active |
| MCP side effects | None directly; MCP update path (`vq5` / `dvH`) reachable via settings reload after toggle |
| Sound | None detected in depth-2 traversal |
| Cooldown | A cooldown timer (`xr8`) re-enables Fast mode automatically after expiry; logs "Fast mode cooldown expired, re-enabling fast mode" (bundle.js:+2150680, +2150733) |
| Docs URL | `https://code.claude.com/docs/en/fast-mode` surfaced in picker UI (bundle.js:+11447266) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.144 | Initial analysis |

---

## Common Mistakes

1. **Using `/fast` on a non-direct Anthropic API surface** — e.g., running inside an Agent SDK context produces "Fast mode is not available in the Agent SDK" and exits immediately; the toggle is silently ignored.
2. **Expecting immediate effect on a free account** — the eligibility check catches `"free"` tier and returns "Fast mode requires a paid subscription" before any state is written.
3. **Passing an unrecognised argument** — any argument other than `on`, `off`, `yes`, or `1` causes the picker to open instead of setting a specific state.
4. **Assuming `/fast off` is always honoured** — if the organisation policy has disabled Fast mode, the eligibility check blocks the command regardless of the argument.
5. **Rapid successive invocations** — a cooldown guard (`xr8`) exists; if the cooldown is active, the internal timer re-enables the mode autonomously, potentially overriding an explicit `off` issued soon after an `on`.
6. **Interpreting "enabled (cached)" as a live status** — the response string "enabled (cached)" indicates the last known network state; actual availability is re-verified at prefetch time, not at command invocation time.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `tN7` | Main `/fast` command handler (AsyncFunction, Arbor-resolved) |
| `ua` | Eligibility-check orchestrator |
| `P6` | Fast-mode availability fetch and cache coordinator |
| `Cs` | Growthbook flag resolver (calls `xH` / `IF`) |
| `IF` | Internal feature-flag accessor |
| `Vr6` | Availability cache lookup / population |
| `u1_` | Availability persistence + UUID generation + event emission |
| `F1_` | Availability write-back sub-helper |
| `y6` | Network fetch for availability endpoint |
| `fCL` | File-watch + incremental fetch helper |
| `ixH` | Fast-mode status prefetch orchestrator |
| `Aq` | Auth token resolver |
| `D3A` | Auth context helper (calls `xH`) |
| `H3L` | Request-header builder (`accessToken`, `anthropic-beta`, `x-api-key`) |
| `f1` | Header assembly helper (validates / replaces values) |
| `yu` | OAuth-401 recovery coordinator |
| `mvL` | OAuth token refresh sub-handler |
| `z$H` | OAuth error classifier |
| `g_` | Fast-mode status persistence to config (file I/O) |
| `t6` | Config read / write with lock |
| `K9_` | Config save-with-lock core |
| `q9_` | Config atomic write helper |
| `dX8` | State application and display assembly |
| `QX8` | Flag-settings reader / resolver |
| `yJH` | Flag-value coercion (String / Number / Boolean) |
| `AD` | Settings application helper |
| `zq` | Model / mode string normaliser |
| `kJH` | Settings persistence entry point for `/fast` |
| `w7` | Settings layer resolver |
| `Qs` | Settings loader (theme, flags, etc.) |
| `cX8` | Interactive picker JSX component |
| `xr8` | Fast-mode cooldown timer manager |
| `O6` | App-state store accessor (`useSyncExternalStore`) |
| `V4_` | App-state context hook |
| `HA` | App-state shortcut hook |
| `a_` | Key-binding registration hook (registers escape/tab/enter) |
| `Q9` | Countdown / time formatter (floor / round) |
| `NE` | Number formatting helper (`toFixed`, `isInteger`) |
| `deA` | Decimal display formatter |
| `y2H` | Display string builder (calls `DK`) |
| `DA` | Foreground colour resolver |
| `p$H` | ANSI/hex colour applicator |
| `DK` | String display helper |
| `JA` | API-surface resolver (bedrock / foundry / vertex / firstParty …) |
| `xH` | Core string utility |
| `v` | Debug logger (level: "debug") |
| `vfK` | Logger implementation |
| `YHA` | Log-level gate |
| `CH` | JSON serialiser wrapper |
| `Cr8` | Connection-state helper |
| `s$L` | Secondary state helper |
| `V8` | Settings-load entry point |
| `Lb6` | Settings cache accessor |
| `pe_` | Settings cache map (`jI6.has` / `.get`) |
| `Ue_` | Settings cache writer (`jI6.set`) |
| `up8` | Settings loader (policy + flag settings) |
| `kB` | Full settings loader (all layers) |
| `p16` | Platform detection (wsl) |
| `XO` | Config initialiser |
| `o5H` | Path resolver for settings files |
| `Kb6` | Settings path helper (`pV.resolve`, `pV.dirname`) |
| `vR` | `.claude` directory path helper |
| `wC6` | Git-ignore-aware config file writer |
| `C6` | Git check-ignore runner |
| `Em8` | Async shell executor |
| `vm8` | Shell result classifier |
| `uhK` | Config directory path builder |
| `Du` | Settings-load telemetry wrapper |
| `mp8` | Settings load timing / telemetry emitter |
| `lz` | Cache clear helper (`jI6.clear`, `LV8.clear`) |
| `aA6` | Atomic file write helper (temp + rename) |
| `mm8` | Timestamp recorder (`EC6.set`, `Date.now`) |
| `UPH` | Settings path + loader combo |
| `h1` | Undo/redo handler registration (`OHA.register`) |
| `SSH` | VSCode shell-integration detection (`Z_`) |
| `lv` | Unknown state helper (shallow) |
| `M` | MCP server manager (push/update/cleanup) |
| `dvH` | MCP server instance manager |
| `vq5` | MCP client sync orchestrator |
| `k6K` | MCP apply-update helper |
| `Ah_` | MCP connection handler (stdio/sse/http) |
| `qh_` | MCP OAuth completion handler |
| `H8q` | MCP status poller |
| `Hh_` | MCP capability checker |
| `a6q` | MCP connection cleanup |
| `W26` | MCP port parser |
| `th_` | MCP port parser (alternate) |
| `n$` | Auth environment resolver (API key / OAuth) |
| `SK` | Auth string helper |
| `OI` | OAuth initialiser |
| `Rq6` | API key file descriptor reader |
| `sy` | API key trimmer (20-char slice) |
| `IE` | Auth method classifier (oauth / api-key) |
| `OMH` | Unknown orchestration helper (called from QX8) |
| `eN` | CCR flag helper |
| `P$` | Feature-flag helper |
| `nxH` | Model picker entry (claude-opus-4-6 / opus) |
| `ec` | Model string normaliser |
| `EX` | Model expansion helper |
| `BP` | Model/mode builder |
| `xF` | Colour theme fallback |
| `ku` | Model context helper |
| `n9` | Async-local-storage store accessor |
| `NVq` | Daemon status file reader (`daemon.status.json`) |
| `Qa` | Transcript trimmer |
| `wMH` | Transcript line trimmer |
| `SG6` | Daemon status path builder |
| `OW` | Theme context accessor |
| `H_` | Unknown string helper |
| `P26` | MCP tool-list helper |
| `S77` | MCP session timestamp recorder |
| `h18` | MCP capability mapper |
| `S18` | MCP server state helper |
| `H8` | MCP debug logger |
| `$7` | MCP error logger |
| `GH` | String coercion wrapper |
| `Pv` | MCP cleanup helper |
| `trH` | MCP transport helper |
| `YD8` | MCP status serialiser |
| `C18` | MCP permission checker |
| `r8` | Timeout/retry wrapper |
| `xJ_` | MCP tool inclusion checker |
| `J` | Process kill iterator |
| `y` | Subprocess write helper |
| `D76` | Auth provider discriminator |
| `cJ` | OAuth config builder |
| `kH` | HTTP error handler (pushes to `HCH`, calls `Sc.logError`) |
| `JM` | Token-refresh sub-dispatcher |
| `hK` | Conversation history accessor |
| `No` | Unknown response helper |
| `VH6` | Unknown response classifier |
| `tc` | Tool-call helper |
| `RH` | Response detail helper |
| `bH` | Response body helper |
| `XH6` | Unknown response field extractor |
| `z$H` | OAuth error type resolver |
| `AR` | Settings load timer start |
| `j9` | Memory-usage recorder |
| `XI6` | Settings load timer end |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.