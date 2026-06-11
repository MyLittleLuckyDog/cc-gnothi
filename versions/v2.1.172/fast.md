---
type: feature-spec
feature: "fast"
cc_version: "2.1.172"
updated: "2026-06-11"
tags: ["fast", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.172 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/fast`

> Analysis basis: CC v2.1.172 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.172

---

## Overview

The `/fast` command toggles **Fast mode** (a research-preview capability that uses a higher-capacity model tier) on or off for the current Claude Code session. When invoked, it either applies the requested state immediately (if an explicit `on` or `off` argument is supplied), or presents an interactive picker UI that lets the user choose. Before acting, the handler checks multiple availability gates — API provider, subscription tier, organization policy, network reachability, and usage-credit status — and displays a context-sensitive error message when Fast mode cannot be enabled.

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
| module_id | `Q7K` |
| load_inline | `true` |
| loc_byte | `12667456` |
| loc_byte_end | `12667728` |
| loc_line | `8901` |
| arbor_handler.name | `gd7` |
| arbor_handler.fqn | `claude-2.1.172::gd7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `3` |

Analysis basis: CC v2.1.172 bundle.js:+12667456

---

## Input Branching

The handler contains more than three distinct decision paths: argument parsing (`on`/`off`/absent), availability gating (provider check, tier check, org policy, network, credit status), and UI dispatch (picker vs. immediate toggle). A flowchart is used.

```mermaid
flowchart TD
    A(["/fast [on|off]"]) --> B{Parse argument}
    B -- "on" or "off" explicit --> C{Availability gates}
    B -- no argument --> PICKER[Show interactive Fast mode picker UI\ntengu_fast_mode_picker_shown]

    C --> G1{API provider\nis Anthropic direct?}
    G1 -- No --> ERR1["Fast mode is only available when\nusing the Anthropic API directly"]
    G1 -- Yes --> G2{Subscription tier}

    G2 -- free --> ERR2["Fast mode requires a paid subscription"]
    G2 -- evaluation --> ERR3["Fast mode unavailable during evaluation.\nPlease purchase credits."]
    G2 -- preference disabled --> ERR4["Fast mode has been disabled by\nyour organization"]
    G2 -- extra_usage_disabled --> ERR5["Fast mode requires usage credits\n· /usage-credits to turn them on"]
    G2 -- pending org status --> ERR6["Fast mode unavailable: Checking fast\nmode availability (org status pending)"]
    G2 -- network_error --> ERR7["Fast mode unavailable due to\nnetwork connectivity issues"]
    G2 -- Agent SDK context --> ERR8["Fast mode unavailable: Fast mode is\nnot available in the Agent SDK"]
    G2 -- overloaded --> ERR9["Fast mode overloaded and is\ntemporarily unavailable"]
    G2 -- unavailable generic --> ERR10["Fast mode is currently unavailable"]
    G2 -- available --> TOGGLE

    TOGGLE{Requested state} -- "on" --> ENABLE[Enable Fast mode\nWrite fastMode=true to app state\ntengu_fast_mode_toggled]
    TOGGLE -- "off" --> DISABLE[Disable Fast mode\nWrite fastMode=false to app state\ntengu_fast_mode_toggled]

    PICKER --> PICKERUI[Render JSX picker\nDisplay ON/OFF rows + usage reset timer\nLink to docs URL]
    PICKERUI --> CONFIRM{User confirms}
    CONFIRM -- "escape / cancel" --> CANCEL[Dismiss, no change\n'Kept Fast mode OFF']
    CONFIRM -- toggle/enter --> C
```

Analysis basis: CC v2.1.172 bundle.js:+12666491 (handler entry `gd7`), +2241426 (provider gate), +2241691 (Agent SDK gate), +2241822 (pending state), +2240919 (tier checks), +12666716 (`tengu_fast_mode_picker_shown`)

---

## Behavioral Spec

### 1. Main Handler — `fastCommandHandler` (`gd7`)

```
async function fastCommandHandler(context):
    argument = parseArgument(context.input)   // "on", "off", or null

    if argument is null:
        emit telemetry("tengu_fast_mode_picker_shown")
        return renderPickerComponent(context)

    availabilityResult = await checkFastModeAvailability(context)

    if availabilityResult.blocked:
        return displayErrorMessage(availabilityResult.reason)

    applyFastModeState(argument == "on")
    emit telemetry("tengu_fast_mode_toggled", {enabled: argument == "on"})
    return displayConfirmation(argument)
```

Analysis basis: CC v2.1.172 bundle.js:+12666491

---

### 2. Availability Gate — `fastModeAvailabilityCheck` (`s8H`)

The availability check is the critical gate before any state mutation.

```
async function fastModeAvailabilityCheck(context):

    // Gate 1: provider must be Anthropic direct API
    provider = getCurrentProvider()   // c_()
    if provider in ["bedrock", "foundry", "anthropicAws", "mantle", "vertex", "firstParty"]:
        // non-direct provider
        emit telemetry("tengu_penguins_off")
        return blocked("Fast mode is only available when using the Anthropic API directly")

    // Gate 2: Agent SDK context
    if runningInAgentSDK():
        return blocked(
            "Fast mode unavailable: Fast mode is not available in the Agent SDK",
            detail="Fast mode is not available in the Agent SDK"
        )

    // Gate 3: fetch org/subscription status (with in-flight dedup)
    orgStatus = await fetchOrgFastModeStatus(context)   // Y6() / N78()

    match orgStatus:
        "free":
            return blocked("Fast mode requires a paid subscription")
        "evaluation":
            return blocked("Fast mode unavailable during evaluation. Please purchase credits.")
        "preference" (org-disabled):
            return blocked("Fast mode has been disabled by your organization")
        "extra_usage_disabled":
            return blocked("Fast mode requires usage credits · /usage-credits to turn them on")
        "pending":
            return blocked(
                "Fast mode unavailable: Checking fast mode availability (org status pending)",
                detail="Checking fast mode availability"
            )
        "network_error":
            return blocked("Fast mode unavailable due to network connectivity issues")
        "unavailable" (generic):
            return blocked("Fast mode is currently unavailable")
        "overloaded":
            return blocked("Fast mode overloaded and is temporarily unavailable")
        available:
            return allowed()
```

Analysis basis: CC v2.1.172 bundle.js:+2241394 (`s8H`), +2241426 (provider message), +2241494, +2241691, +2241761, +2241822, +2241853, +2242016, +2240919, +2240945, +2240986, +2241077, +2241161, +2241258, +2241337

---

### 3. Org Status Fetch with In-Flight Deduplication — `fetchOrgFastModeStatus` (`QlH`)

```
async function fetchOrgFastModeStatus(context):
    // Dedup: if a prefetch is already in-flight, return that promise
    if inFlightPromise exists:
        log("Fast mode prefetch in progress, returning in-flight promise")
        return inFlightPromise

    // Skip if fetched recently (cooldown guard)
    if fetchedRecently():
        log("Skipping fast mode prefetch, fetched recently")
        return cachedResult

    // Auth check
    authToken = await resolveAuth(context)   // Kz4()
    if not authToken:
        throw Error("No auth available")

    // Build and fire HTTP request with anthropic-beta / x-api-key headers
    response = await httpRequest(authEndpoint, authToken)   // a2() -> $O()

    if response.status == 401 or 403:
        handleOAuthRefresh()   // pB()

    // Persist result
    saveOrgStatusToAppState(response.body)   // AA()
    saveConfigWithLock(updatedConfig)        // E8()

    emit event("_Y_.emit", result)
    return result
```

Analysis basis: CC v2.1.172 bundle.js:+2245112 (`QlH`), +2245201 (in-flight log), +2245448 (skip-recent log), +2245624 (no-auth error), +2244684 (`Kz4`), +2245274 (`a2`), +2245920 (`pB`), +2246164 (`AA`), +2246201 (`E8`), +2246251 (`_Y_.emit`), +2244735 (`accessToken` header key), +2244794 (`anthropic-beta` header), +2244816 (`x-api-key` header), +2245759 (401), +2245785 (403)

---

### 4. Interactive Picker UI — `fastModePickerComponent` (`oU8` / `rU8`)

```
function renderFastModePickerComponent(context):
    // Reads current fastMode state from app state
    currentFastMode = appState.fastMode   // "fastMode" key at +12662190

    rows = [
        { label: "Fast mode", value: "ON " or "OFF", toggle via keyboard }
    ]

    // Display usage limit info if hit
    if usageLimitHit:
        display("You've hit your fast limit · resets in <countdown>")
        // countdown uses ms buckets: 86400000 (days), 3600000 (hours), 60 (minutes)

    if overloaded:
        display("Fast mode overloaded and is temporarily unavailable")

    // Key bindings rendered in picker
    bindKey("escape" / "cancel" → dismiss, log "Kept Fast mode OFF")
    bindKey("tab" → toggle)
    bindKey("enter" → confirm)

    // Doc link displayed
    displayLink("https://code.claude.com/docs/en/fast-mode")

    // Title rendered as
    title = " Fast mode (research preview)"

    onConfirm(selection):
        fastModeAvailabilityCheck(context)
        if allowed:
            applyFastModeState(selection)
            emit telemetry("tengu_fast_mode_toggled")
        else:
            displayAvailabilityError()
```

Analysis basis: CC v2.1.172 bundle.js:+12663139 ("Fast mode OFF"), +12664752 (" Fast mode (research preview)"), +12665459 ("Fast mode"), +12665528 ("ON "), +12665534 ("OFF"), +12665687 ("overloaded"), +12665700 (overloaded message), +12665754 (limit hit message), +12665783 (" · resets in "), +12665974 (docs URL), +12664945 ("cancel"), +12665024 ("tab"), +12665037 ("toggle"), +12665090 ("confirm"), +12664147 ("Kept Fast mode OFF"), +12666606 ("off" literal), +215392 (86400000 ms), +215426 (3600000 ms), +215499 (60 s)

---

### 5. Random Jitter Delay — `jitterDelay` (`H` called from `gd7`)

```
function jitterDelay():
    // Introduces a random delay before certain network calls
    // Uses Math.random() scaled by factor 2
    delay = Math.random() * 2   // literal 2 at +14012201
    setTimeout(callback, delay)
```

Analysis basis: CC v2.1.172 bundle.js:+14012203 (`Math.random`), +14012240 (`setTimeout`), +14012201 (factor `2`)

---

### 6. Cooldown Auto-Re-Enable — `fastModeCooldownWatcher` (`HY_`)

```
function fastModeCooldownWatcher():
    // Triggered when the cooldown timer expires
    // Records current timestamp
    now = Date.now()

    // If cooldown has expired, re-enable fast mode automatically
    if cooldownExpired(now):
        log("Fast mode cooldown expired, re-enabling fast mode")
        setFastModeActive(true)      // Mf()
        notifyStateChange(N())
        emit event("uZ1.emit", {state: "active"})
```

Analysis basis: CC v2.1.172 bundle.js:+2242638 ("cooldown"), +2242650 (`Date.now`), +2242678 (`Mf`), +2242689 (`N`), +2242691 (log message), +2242751 (`uZ1.emit`), +2243100 ("active")

---

### 7. Flag-Settings Application — `applyFlagSettings` (`iU8`)

When the handler initialises, it applies any flag-settings from the loaded config (key `"apply_flag_settings"` at +12662560). These can inject values for `fastMode`, `model`, `cacheBreakerPhrase`, `autoCompactWindow`, `briefTranscript`, and `isBriefOnly` directly into the session.

```
function applyFlagSettings(flagSettings):
    for key in ["cacheBreakerPhrase", "autoCompactWindow", "briefTranscript",
                "isBriefOnly", "fastMode", "model"]:
        if key in flagSettings:
            applyToAppState(key, coerce(flagSettings[key]))
            // coerce: String, Number, or Boolean depending on key
```

Analysis basis: CC v2.1.172 bundle.js:+12662560 ("apply_flag_settings"), +12661706 ("cacheBreakerPhrase"), +12661847 ("autoCompactWindow"), +12661984 ("briefTranscript"), +12662095 ("isBriefOnly"), +12662190 ("fastMode"), +12662273 ("model"), +12661776 (`String`), +12661915 (`Number`), +12662013 (`Boolean`)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_fast_mode_toggled` | Fired on every successful toggle (on or off). Analysis basis: CC v2.1.172 bundle.js:+12662927 |
| Telemetry: `tengu_fast_mode_picker_shown` | Fired when no argument is supplied and the interactive picker is displayed. Analysis basis: CC v2.1.172 bundle.js:+12666716 |
| Telemetry: `tengu_penguins_off` | Fired when the provider gate blocks Fast mode. Analysis basis: CC v2.1.172 bundle.js:+2241532 |
| Telemetry: `tengu_org_penguin_mode_fetch_failed` | Fired when the org-status HTTP fetch fails. Analysis basis: CC v2.1.172 bundle.js:+2246620 |
| Telemetry: `tengu_config_parse_error` | Fired if config read fails during the lock-guarded save. Analysis basis: CC v2.1.172 bundle.js:+3314707 |
| Telemetry: `tengu_config_lock_contention` | Fired if config write lock is slow. Analysis basis: CC v2.1.172 bundle.js:+3312132 |
| Telemetry: `tengu_config_stale_write` | Fired when a stale write is detected. Analysis basis: CC v2.1.172 bundle.js:+3312268 |
| Telemetry: `tengu_config_auth_loss_prevented` | Fired when a write that would erase auth is suppressed (GH #3117 guard). Analysis basis: CC v2.1.172 bundle.js:+3312611 |
| Telemetry: `tengu_oauth_401_*` | OAuth 401 recovery events fired during auth token refresh inside `pB`. Analysis basis: CC v2.1.172 bundle.js:+3262311, +3263038, +3263476, +3263713, +3263975 |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` | Feature-flag probe events from `kH` / `bH` / `s6`. Analysis basis: CC v2.1.172 bundle.js:+1016269, +1016336, +1016417 |
| appState changes | `fastMode` boolean toggled in app state. Key `"fastMode"` at +12662190. |
| Config persistence | Org-status fetch result and fastMode preference written via lock-guarded `saveConfigWithLock` (`E8` → `F78`). Backup rotation maintained under `backups/` subdirectory. Analysis basis: CC v2.1.172 bundle.js:+2246201, +3313644 |
| Event bus | `_Y_.emit` fired with org-status payload after fetch. `uZ1.emit` fired on cooldown expiry. Analysis basis: CC v2.1.172 bundle.js:+2246251, +2242751 |
| In-flight dedup | A single Promise is cached to prevent parallel org-status requests (logged as "Fast mode prefetch in progress, returning in-flight promise"). Analysis basis: CC v2.1.172 bundle.js:+2245201 |
| Auth refresh | On 401/403 from the org-status endpoint, the OAuth rotation pipeline (`pB` → `Vb4`) is invoked, with a 600 000 ms (10 min) outer timeout and process exit if unrecovered. Analysis basis: CC v2.1.172 bundle.js:+2245759, +3262009, +3263749 |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | `y9` → `hZA.register` called during log-file setup; not directly a fast-mode hook. Analysis basis: CC v2.1.172 bundle.js:+63751 |

---

## Version History

| Version | Change |
|---|---|
| v2.1.172 | Initial analysis |

---

## Common Mistakes

1. **Supplying `on` when not on the Anthropic direct API.** Using `/fast on` while `ANTHROPIC_API_KEY` is routed through Bedrock, Vertex, or another proxy will immediately return the provider-gate error; the argument is silently ignored after the gate fires.

2. **Expecting `/fast` to work inside the Agent SDK.** The Agent SDK context is detected early and blocks Fast mode entirely with a distinct message. There is no workaround via the command.

3. **Assuming the toggle is instant on first run.** The first invocation (with no cached org status) fires an HTTP request to check subscription/org eligibility before any state change. Subsequent invocations within the cooldown window reuse the cached result.

4. **Providing any value other than `on` or `off`.** Only the exact strings `"on"`, `"yes"` (literal at +27782), and `"off"` (literal at +12666606) are recognised. Any other value causes the picker UI to open instead of applying a state directly. Analysis basis: CC v2.1.172 bundle.js:+27782, +27788 ("on"), +12666606 ("off").

5. **Not recognising the "overloaded" state.** Fast mode can be blocked even when the subscription is valid because Anthropic's infrastructure is overloaded (`"overloaded"` at +12665687). This is a transient server-side state and cannot be resolved locally.

6. **Treating the docs URL as stable.** The URL `https://code.claude.com/docs/en/fast-mode` (literal at +12665974) is hardcoded in the bundle and may become stale across versions.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `gd7` | Main `/fast` command handler (AsyncFunction, Arbor-resolved) |
| `Mf` | Read/write current fast-mode state from app state |
| `c_` | Resolve current API provider identifier |
| `f6` | Generic app-state field getter/setter |
| `H` | Jitter delay helper (Math.random + setTimeout) |
| `s8H` | Availability gate pipeline (provider, SDK, org status) |
| `Y6` | Org-status subscriber / watcher setup |
| `N26` | Org-status field reader A |
| `h26` | Org-status field reader B |
| `Ym` | Org-status normaliser helper |
| `eu` | Notification/event emit helper |
| `N78` | Org-status cache lookup and update |
| `_J_` | Experiment / GrowthBook event emitter |
| `qZ_` | Org-status persistence writer |
| `b6` | Config file read-write with backup rotation |
| `o6` | Logger / console helper |
| `jZ_` | Path join helper |
| `W7H` | Low-level config file I/O (readFileSync, statSync, mkdirSync, copyFileSync) |
| `Gx4` | File watcher (watchFile / unwatchFile) |
| `N` | High-level log-message formatter |
| `g8f` | Log sink dispatcher |
| `kZA` | Log level encoder |
| `CH` | JSON.stringify wrapper |
| `lf` | Sensitive-data redactor for log lines |
| `MNA` | Pattern-map builder for redaction |
| `rFH` | Terminal write helper |
| `ovA` | Raw stdout/stderr write |
| `l8f` | Rotating log-file writer |
| `TFH` | Log batch / debounce flusher |
| `BfH` | Log file path builder |
| `A36` | Filesystem error classifier |
| `zNA` | Log directory resolver |
| `ms8` | Log file rotator (rename / unlink) |
| `c8f` | Log file appender with mkdir |
| `y9` | Hook registrar (`hZA.register`) |
| `x8` | Settings loader entry |
| `ia6` | Settings cache lookup helper |
| `aEA` | Module-cache has/get |
| `rK_` | Policy settings reader |
| `sEA` | Module-cache setter |
| `VB` | Full settings object builder |
| `P_` | Platform environment reader |
| `l56` | User settings field extractor |
| `$o8` | Project settings field extractor |
| `Q56` | Local settings field extractor |
| `iZH` | Policy override checker |
| `rZH` | Flag settings merger |
| `i56` | Settings defaults applicator |
| `wYH` | Settings validation helper |
| `YYH` | Settings schema validator |
| `$f_` | Settings migration helper |
| `blA` | Legacy config converter |
| `Ea` | Env-var override applier |
| `Ew6` | WSL environment detector |
| `b_` | VS Code extension environment flag |
| `DFH` | Client-type detector (claude-vscode check) |
| `$u` | Agent SDK context detector |
| `FA8` | Fast-mode status string builder |
| `_z4` | Auth-type classifier (oauth / api-key) |
| `QlH` | Org-status HTTP fetch with in-flight dedup |
| `AY_` | Fast-mode status cache reader |
| `Rq` | Traffic-category classifier |
| `yBA` | Traffic-category string normaliser |
| `a2` | API request builder for org-status endpoint |
| `$O` | Core HTTP request executor with auth injection |
| `O7` | Git-bare-repo detector (`--bare` flag) |
| `tv` | Auth token resolver (API key + OAuth) |
| `O26` | API key environment variable reader |
| `NP` | API key source classifier |
| `PD6` | File-descriptor token reader |
| `vj` | OAuth token resolver |
| `B4` | API provider from config |
| `lC` | Token string slicer (first 20 chars for logging) |
| `hE` | Response type validator |
| `Kz4` | Auth header builder (accessToken, anthropic-beta, x-api-key) |
| `S1` | OAuth base-URL resolver (prod/staging/local) |
| `jbA` | OAuth env-var presence checker |
| `QJf` | OAuth URL validator |
| `pB` | OAuth 401 recovery pipeline |
| `Vb4` | OAuth token refresh orchestrator |
| `Js` | Token type classifier |
| `C56` | Keychain token reader |
| `c` | Generic config accessor |
| `kH` | Feature-flag "ok" probe |
| `WrH` | OAuth token expiry checker |
| `bH` | Feature-flag "bad" probe |
| `CB` | Serialisation helper (nM4 + fX1) |
| `hf` | Token decode helper |
| `So` | Refresh-token exchange helper |
| `c56` | Token storage writer |
| `SH` | HTTP retry helper |
| `Zb4` | Refresh-queue dedup helper |
| `__9` | Retry back-off calculator (Math.min/max) |
| `Nz` | OAuth rotation finaliser |
| `AA` | Settings persistence writer (save to disk with lock) |
| `y3` | Settings object constructor |
| `OYH` | Settings file path builder |
| `U2` | Config file read helper |
| `ja` | Config JSON parser |
| `R8` | Filesystem error handler |
| `N8` | EISDIR / ENOENT code checker |
| `qK_` | Settings timestamp recorder |
| `tvH` | Settings change notifier |
| `na6` | Settings directory resolver |
| `Sz6` | Atomic file writer (temp + rename with fchmod/fsync) |
| `O` | Symbolic-link stat helper |
| `L` | File-handle wrapper |
| `FO` | Module-cache clearer (mg6.clear, Qi8.clear) |
| `Aa6` | Gitignore-aware config file writer |
| `p6` | Git working-tree checker |
| `Bq_` | Gitignore rule lookup |
| `_a6` | Git check-ignore runner |
| `Yxf` | Gitignore excludesfile path resolver |
| `jdA` | Git ls-files runner |
| `JdA` | Gitignore append helper |
| `Uu` | Settings path joiner (`.claude/settings.json`) |
| `s6` | Feature-flag "sad" probe |
| `A6` | Feature-flag state store |
| `vB` | MCP-aware settings reload orchestrator |
| `pG` | Settings change debouncer |
| `fq` | Memory-usage sampler |
| `oK_` | Settings-load telemetry emitter |
| `pg6` | Post-load hook invoker |
| `E8` | Lock-guarded global config saver |
| `F78` | Locked config file writer with backup management |
| `f` | Promise-tracked async wrapper |
| `mV1` | Config object merger |
| `brH` | Auth-loss prevention checker (GH #3117) |
| `XZ_` | Backup directory path builder |
| `V` | Backup filename prefix checker |
| `P` | TCP/stream connection wrapper |
| `E` | Buffer slice helper |
| `HJH` | Config lock-contention logger |
| `y_9` | Config field entry iterator |
| `b26` | Timestamp helper for config ops |
| `B78` | Fallback global config saver |
| `K` | Column-padding formatter |
| `rU8` | Fast-mode picker UI root component |
| `iU8` | Flag-settings applicator |
| `NDH` | App-state reader for picker |
| `DX` | App-state setter dispatcher |
| `t4` | App-state internal update primitive |
| `glH` | Fast-mode picker layout builder |
| `FP` | Picker row renderer |
| `MEH` | Flag-settings type coercer (String/Number/Boolean) |
| `w3` | Picker model selector sub-component |
| `eG` | Model row renderer |
| `Q9` | Model alias resolver (fable, opusplan, sonnet, haiku, best, etc.) |
| `LEH` | Picker theme/colour resolver |
| `Dm` | Theme name normaliser |
| `OW6` | Colour-mode selector (auto/dark) |
| `x58` | Theme inclusion checker |
| `WF` | Colour string prefix stripper |
| `M99` | Theme palette builder |
| `K4` | Picker legacy-config migrator |
| `Bv` | Disabled-model-set builder |
| `zf_` | Model availability checker |
| `IA` | ANSI foreground-colour interpreter |
| `TJH` | ANSI colour-name-to-chalk mapper |
| `Fl` | Colour fallback helper |
| `mB` | Keyboard shortcut label renderer |
| `J9` | Picker key-binding dispatcher |
| `Hl` | Key-event router |
| `OY` | Up/down navigation handler |
| `rU` | Left/right navigation handler |
| `rO` | Confirm-action dispatcher |
| `hY` | Picker sub-command renderer |
| `AS` | Countdown timer formatter (days/hours/minutes/seconds) |
| `lZ1` | Number-to-fixed formatter |
| `QNH` | Fast-mode status display string builder |
| `j1` | Model display-name builder |
| `D_8` | Object-entries iterator helper |
| `DJ` | Model-string normaliser (toLowerCase, replace) |
| `so8` | Model suffix stripper |
| `R3` | Model name regex replacer |
| `oU8` | Fast-mode picker outer shell / JSX component |
| `X6` | App-state context reader (useSyncExternalStore) |
| `ah_` | AppStateProvider context hook |
| `DA` | App-state setter context hook |
| `HY_` | Fast-mode cooldown watcher / auto-re-enable |
| `$6` | Internal state-slot allocator |
| `_56` | React internal sentinel |
| `$` | Daemon-status reader |
| `TwK` | Daemon status JSON loader |
| `pa` | Daemon status parser |
| `OLH` | Daemon status field trimmer |
| `d9` | AsyncLocalStorage store getter |
| `km6` | Daemon status file path builder |
| `RA` | MCP global state effect hook (useEffect) |
| `VD` | MCP context reader (fXH.useContext) |
| `M` | MCP connection manager (useRef + applyMcpUpdate) |
| `yRH` | MCP server connection orchestrator |
| `qi` | MCP tool-call dispatcher |
| `QV` | MCP tool schema validator |
| `g8` | MCP error formatter |
| `uV6` | MCP tool result normaliser |
| `Jc9` | MCP connection attempt handler |
| `Jj8` | MCP tool-call executor |
| `Yj8` | MCP token decoder |
| `j8` | MCP debug logger |
| `sJ8` | MCP OAuth flow initiator |
| `tJ8` | MCP OAuth callback handler |
| `Vc9` | MCP connection context builder |
| `XU_` | MCP tool-call result handler |
| `j` | Background process manager |
| `pN` | MCP skill-set fetcher |
| `qU_` | MCP capability filter |
| `k` | Warning message accumulator |
| `OL` | MCP error logger |
| `EH` | Error-to-string converter |
| `Gc9` | MCP feature-flag checker |
| `ZH6` | MCP timeout parser |
| `sX8` | MCP retry-delay parser |
| `Ln8` | MCP connection result applier |
| `kRH` | MCP server status updater |
| `r0` | MCP server cleanup runner |
| `nWA` | MCP full reconnect orchestrator |
| `mJ8` | MCP server allow-list checker |
| `d8` | TCP connection retry helper |
| `TH6` | MCP server-slot state reader |
| `R9` | Time-remaining formatter (Math.floor / Math.round) |