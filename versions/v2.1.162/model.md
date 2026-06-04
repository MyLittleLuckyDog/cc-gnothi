---
type: feature-spec
feature: "model"
cc_version: "2.1.162"
updated: "2026-06-04"
tags: ["model", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.162 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/model`

> Analysis basis: CC v2.1.162 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.162

---

## Overview

The `/model` command allows users to switch the AI model used by Claude Code for the current session or persistently as a new default. When invoked with a model name argument, it validates the model identifier (optionally performing a live API probe), resolves shorthand aliases, applies provider-specific constraints, and updates the application's model state. When invoked without an argument or with an interactive terminal, it may display current model information and available options.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `model` |
| description | `Set the AI model for Claude Code` |
| argumentHint | `<model>` |
| supportsNonInteractive | `true` |
| module_id | `HAK` |
| load_inline | `true` |
| loc_byte | `12631240` |
| loc_byte_end | `12631414` |
| loc_line | `8938` |
| arbor_handler.name | `Eyf` |
| arbor_handler.fqn | `claude-2.1.162::Eyf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.162 bundle.js:+12631240

---

## Input Branching

The command exhibits 5+ distinct execution paths depending on argument presence, model alias resolution, provider type, and 1M-context availability. A Mermaid flowchart is used below.

```mermaid
flowchart TD
    A(["/model invoked"]) --> B{Argument provided?}
    B -- No --> C[Show current model info\nor interactive picker]
    B -- Yes --> D["Trim whitespace from input\n(Eyf → H.trim)"]
    D --> E{Input empty after trim?}
    E -- Yes --> F["Error: 'Model name cannot be empty'"]
    E -- No --> G{Input in non-interactive\nforbidden list?\n(WQ6.includes check)}
    G -- Blocked --> H["Return early / error\n(inline model command)"]
    G -- Allowed --> I["Resolve model alias\n(AR8 → mS → a36/qq)"]
    I --> J{Alias maps to\nknown shorthand?}
    J -- "opusplan / best" --> K["Resolve to Opus-in-plan-mode\nor best available"]
    J -- "sonnet / [1m] variants" --> L["Resolve Sonnet variant\ncheck 1M availability"]
    J -- "haiku" --> M["Resolve Haiku variant"]
    J -- "opus" --> N["Resolve Opus variant\ncheck 1M availability"]
    J -- Literal model ID --> O["Use as-is, lowercase normalise"]
    L --> P{1M context\navailable for account?}
    P -- No --> Q["Error: 'Sonnet 4.6 with 1M context\nis not available for your account'"]
    P -- Yes --> R
    N --> S{1M context\navailable for account?}
    S -- No --> T["Error: 'Opus with 1M context\nis not available for your account'"]
    S -- Yes --> R
    K --> R
    M --> R
    O --> R
    R["Validate model via API probe\n(eS8 → au: side_query)"]
    R --> U{API probe result}
    U -- "Auth failure" --> V["Error: 'Authentication failed.\nPlease check your API credentials.'"]
    U -- "Network error" --> W["Error: 'Network error.\nPlease check your internet connection.'"]
    U -- "not_found_error" --> X["Error: invalid_model\ninclude 'model:' hint"]
    U -- "validate_exception" --> Y["Error: validation exception"]
    U -- Success --> Z["Persist or session-scope\nthe new model (FqA)"]
    Z --> AA{Save as default?}
    AA -- Yes --> AB["Write to settings\n(r_ / EgK)\nconfirm '…saved as your default'\ntelemetry: model_set_default"]
    AA -- "Session only" --> AC["Update appState only\nconfirm '…for this session only'"]
    AB --> AD([Done])
    AC --> AD
    F --> AD
    H --> AD
    Q --> AD
    T --> AD
    V --> AD
    W --> AD
    X --> AD
    Y --> AD
    C --> AD
```

---

## Behavioral Spec

### Entry Point — Main Handler

The Arbor-resolved handler is `Eyf` (AsyncFunction, `claude-2.1.162::Eyf`, resolved via `module_id`).

```
async function handleModelCommand(args, appContext):
    rawInput = args.trim()                          // Eyf → H.trim @+12599117

    if rawInput is in non-interactive blocked list:  // Eyf → WQ6.includes @+12599133
        emitTelemetry("tengu_model_command_inline")  // @+12599275
        return earlyResult(args, appContext)

    currentAppState = appContext.getAppState()       // Eyf → _.getAppState @+12599156

    resolvedModel = resolveModelAlias(rawInput,      // Eyf → AR8 @+12599200
                        currentAppState)

    if fohList.includes(resolvedModel):              // Eyf → fOH.includes @+12599220
        // provider-specific guard (e.g. Bedrock/Vertex restrictions)
        handleProviderRestriction(resolvedModel)
        return

    sessionHash = computeHash(resolvedModel)         // Eyf → dV @+12599315

    validatedModel = validateAndSwitch(              // Eyf → z_K @+12599370
                        resolvedModel,
                        currentAppState,
                        sessionHash)
    return validatedModel
```

Analysis basis: CC v2.1.162 bundle.js:+12599117

---

### Sub-feature: Model Alias Resolution

`AR8` (resolveModelAlias) delegates to `mS` which in turn uses `a36` (alias table lookup) and `qq` (model-string normaliser).

```
function resolveModelAlias(inputStr, appState):
    aliasEntry = lookupAliasTable(inputStr)          // AR8 → mS → a36 @+12564052

    if aliasEntry found:
        return aliasEntry.resolvedId                 // e.g. "opusplan" → Opus Plan

    normalised = normaliseModelString(inputStr)      // mS → g0 @+12564059
    return normalised
```

Known alias mappings (from literals):

| Input alias | Resolved meaning |
|---|---|
| `opusplan` | Opus in plan mode (also described as "best") — `"Opus in plan mode, else Sonnet"` @+2239000 |
| `best` | Same as `opusplan` |
| `opus` | Opus variant (with optional `[1m]` suffix) |
| `sonnet` | Sonnet variant (with optional `[1m]` suffix) |
| `haiku` | Haiku variant |
| `sonnet[1m]` / `sonnet-4-6[1m]` | Sonnet 4.6 with 1M context window |
| `opus-4-6` / `opus-4-7` / `opus-4-8` | Specific Opus generations |

Analysis basis: CC v2.1.162 bundle.js:+12564052, +2239000, +12563986, +12564012

---

### Sub-feature: Model String Normalisation (`qq`)

```
function normaliseModelString(raw):
    s = raw.trim().toLowerCase()                     // qq → H.trim @+2240374

    if s matches "[1m]" suffix pattern:              // qq → Xt6 @+2240664
        // z8L inclusion check @+2240912
        handle 1M-context variant

    s = applyKnownSubstitutions(s)                   // qq → A.replace @+2240413

    if s contains "opusplan":                        // @+2240470
        return resolveOpusPlan(s)
    if s contains "[1m]":                            // @+2240496
        return resolve1MVariant(s)
    if s contains "sonnet":                          // @+2240511
        return resolveSonnet(s)
    if s contains "haiku":                           // @+2240550
        return resolveHaiku(s)
    if s contains "opus":                            // @+2240589
        return resolveOpus(s)
    if s == "best":                                  // @+2240626
        return resolveBest()

    return s
```

Analysis basis: CC v2.1.162 bundle.js:+2240374

---

### Sub-feature: 1M Context Availability Check (`Skf`, `Rkf`)

Two parallel validators exist — one for Opus 1M (`Skf`) and one for Sonnet 1M (`Rkf`).

```
function checkOpus1MAvailability(modelId, accountFlags):
    lowered = modelId.toLowerCase()                  // Skf → H.toLowerCase @+12563847
    if not accountFlags.includes(opus1MFlag):        // Skf → _.includes @+12563883
        emitError("opus_1m_unavailable",             // @+12562114
            "Opus with 1M context is not available for your account. " +
            "Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m")
        return false
    return true

function checkSonnet1MAvailability(modelId, accountFlags):
    lowered = modelId.toLowerCase()                  // Rkf → H.toLowerCase @+12563944
    if not accountFlags.includes(sonnet1MFlag):      // Rkf → _.includes @+12563975
        emitError("sonnet_1m_unavailable",           // @+12562331
            "Sonnet 4.6 with 1M context is not available for your account. " +
            "Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m")
        return false
    return true
```

Analysis basis: CC v2.1.162 bundle.js:+12563847, +12562114, +12562331

---

### Sub-feature: Model Validation via API Probe (`eS8`)

Before accepting a model change, the command sends a minimal side-query to the API to confirm the model is reachable.

```
async function validateModelViaApiProbe(modelId, appState):
    if modelId.trim() == "":                         // eS8 → H.trim @+12560084
        throw Error("Model name cannot be empty")    // @+12560121

    normalised = parseModelIdentifier(modelId)       // eS8 → Dd @+12560155

    loweredId = normalised.toLowerCase()             // eS8 → _.toLowerCase @+12560244

    if loweredId in knownProviderExclusions:         // eS8 → mKH.includes @+12560263
        // skip probe for certain provider-managed models
        return {valid: true, skipProbe: true}

    if probeCache.has(loweredId):                    // eS8 → O_K.has @+12560365
        return probeCache.get(loweredId)

    // Emit telemetry for probe initiation
    emitTelemetry("model_validation",                // @+12560460
        {role: "user", content: "Hi",                // @+12560495, @+12560529
         cacheControl: "ephemeral"})                 // @+12560554

    probeResult = await sendSideQuery(               // eS8 → au @+12560410
                    modelId, "side_query")

    if probeResult.isAuthFailure:
        throw Error("Authentication failed. Please check your API credentials.")  // @+12560820

    if probeResult.isNetworkError:
        throw Error("Network error. Please check your internet connection.")      // @+12560922

    if probeResult.errorType == "not_found_error":   // @+12561041
        // Extract hint from message field          // @+12561060
        hint = "model: " + modelId                  // @+12561123
        throw Error("invalid_model: " + hint)        // @+12562614

    probeCache.set(loweredId, probeResult)           // eS8 → O_K.set @+12560573

    return processProbeResult(probeResult)           // eS8 → kkf @+12560614
```

Analysis basis: CC v2.1.162 bundle.js:+12560084, +12560460, +12560820

---

### Sub-feature: Apply Model Switch and Persist (`FqA`, `r_`)

```
async function applyAndPersistModel(resolvedModelId, saveAsDefault, appState):
    // Display bold model name in confirmation
    displayLine(bold(resolvedModelId))               // FqA → J6.bold @+12563072

    buildModelDisplay(resolvedModelId, appState)     // FqA → mS @+12563080
    renderModelCard(resolvedModelId)                 // FqA → H4 @+12563176
    showFastModeIndicator(resolvedModelId)           // FqA → nzH @+12563185

    // Provider-specific display (bedrock/vertex/foundry)
    handleProviderDisplay(resolvedModelId)           // FqA → MO @+12563192

    // Check usage credits indicator
    if requiresUsageCredits(resolvedModelId):
        appendNote(" · Draws from usage credits")   // @+12563306

    if isManagedSettings():                          // FqA → OWH @+12563284
        displayNote("Managed settings")              // @+12563658

    if saveAsDefault:
        writeSettings(resolvedModelId,               // FqA → gqA → hTH → m8 @+12563492
            settingsPath)
        emitTelemetry("model_set_default")           // @+12563449
        confirmMessage = resolvedModelId +
            " and saved as your default for new sessions"  // @+12563091
    else:
        confirmMessage = resolvedModelId +
            " for this session only"                 // @+12563137

    updateAppState("model", resolvedModelId)         // @+12563496
    displayConfirmation(confirmMessage)
```

Analysis basis: CC v2.1.162 bundle.js:+12563072, +12563449, +12563091, +12563137

---

### Sub-feature: Settings Persistence (`r_` / `EgK`)

The settings writer `r_` handles multiple settings tiers and performs atomic file operations.

```
async function writeSettingsFile(key, value, tier):
    // tier: "userSettings" | "projectSettings" | "localSettings"
    settingsDir = resolveSettingsDir(tier)           // r_ → gO @+1275445
    settingsFile = path.join(settingsDir,
        ".claude", "settings.json")                  // @+1266529, @+1266539
    // localSettings uses settings.local.json        // @+1266601

    currentContent = readSettingsFile(settingsFile)  // r_ → v @+1275633

    // Check for gitignore/policy guards
    checkGitignoreRule(settingsFile)                 // r_ → "gitignore_global_rule" @+1276295
    checkAlreadyTracked(settingsFile)                // r_ → "already_tracked" @+1276339

    updatedContent = mergeSettings(currentContent,
                        {[key]: value})

    await atomicWrite(settingsFile, updatedContent,  // r_ → EgK @+1275633
        encoding: "utf-8")                           // @+1276081

    emitEvent("oBH.emit")                            // r_ @+1276601
```

Analysis basis: CC v2.1.162 bundle.js:+1275445, +1266529, +1276295

---

### Sub-feature: Fast Mode Display Indicator

```
function getFastModeIndicator(modelId, appState):
    isFastOn = appState.fastModeEnabled
    if isFastOn:
        return " · Fast mode ON"                    // @+12563255
    else:
        return " · Fast mode OFF"                   // @+12563352
```

Analysis basis: CC v2.1.162 bundle.js:+12563255, +12563352

---

### Sub-feature: Provider Routing (`wA` / `UM`)

The model resolution pipeline includes a provider-type check that routes among several backend providers.

```
function determineProvider(modelId, appState):
    if appState.usesAnthropicAws:
        return "anthropicAws"                        // @+2094587
    if appState.usesGateway:
        return "gateway"                             // @+2094607
    if appState.usesBedrock:
        return "bedrock"                             // @+2093914
    if appState.usesFoundry:
        return "foundry"                             // @+2093964
    if appState.usesVertex:
        return "vertex"                              // @+2094122
    if appState.usesMantle:
        return "mantle"                              // @+2237319
    return "firstParty"                              // @+2236678
```

Analysis basis: CC v2.1.162 bundle.js:+2094587, +2093914, +2236678

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_model_command_inline` | Fired when `/model` is invoked in a non-interactive / inline context (bundle.js:+12599275) |
| Telemetry: `tengu_api_success` | Fired on successful API side-query probe (bundle.js:+13394192) |
| Telemetry: `tengu_lone_surrogate_sanitized` | Fired if lone Unicode surrogates are found in API response (bundle.js:+13393941) |
| Telemetry: `tengu_feature_ok` | Generic feature-success event, fired at successful command completion (bundle.js:+1008233) |
| Telemetry: `tengu_feature_bad` | Generic feature-failure event, fired on command error (bundle.js:+1008295) |
| Telemetry: `tengu_feature_sad` | Generic feature-degraded event (bundle.js:+1008376) |
| Telemetry: `model_set_default` | Internal marker emitted when a model is saved as the new user default (bundle.js:+12563449) |
| Telemetry: `model_switch` | Marks a model switch event (bundle.js:+12561952) |
| Telemetry: `model_validation` | Marks the API probe validation request (bundle.js:+12560460) |
| Telemetry: `invalid_model` | Emitted when the API returns a not-found error for the supplied model (bundle.js:+12562614) |
| Telemetry: `validate_exception` | Emitted when the validation probe throws an unexpected exception (bundle.js:+12562711) |
| Telemetry: `not_allowed` | Emitted when a model switch is policy-blocked (bundle.js:+12561967) |
| Telemetry: `opus_1m_unavailable` | Emitted when Opus 1M is requested but not available for the account (bundle.js:+12562114) |
| Telemetry: `sonnet_1m_unavailable` | Emitted when Sonnet 1M is requested but not available (bundle.js:+12562331) |
| Probe cache (`O_K`) | `Map` used to cache API probe results keyed by lowercased model ID; avoids repeated probes within a session (bundle.js:+12560365, +12560573) |
| Settings write | When saving as default, writes to `.claude/settings.json` (user tier) or `settings.local.json` (local tier) via atomic file operations (bundle.js:+1266529, +1266539, +1266601) |
| `appState` changes | Updates the `model` key in the application state to the newly resolved model identifier (bundle.js:+12563496) |
| Hook registration | `jJA.register` called via `J9` — registers a hook related to model changes (bundle.js:+60123) |
| Sound | No sound events detected in depth-2 traversal |
| API side-query | Sends a minimal `{"role":"user","content":"Hi"}` message with `"ephemeral"` cache control to confirm model availability (bundle.js:+12560529, +12560554) |
| Timeout constant (bootstrap) | 5000 ms timeout on bootstrap fetch (bundle.js:+15591194) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.162 | Initial analysis |

---

## Common Mistakes

1. **Passing an empty string** — `/model ` (with only whitespace) triggers the `"Model name cannot be empty"` error immediately; always supply a non-empty model identifier.
2. **Using 1M-context variants without entitlement** — aliases such as `sonnet[1m]` or `opus[1m]` will fail with an account-specific unavailability error unless the account has the extended-context feature enabled; see `https://code.claude.com/docs/en/model-config#extended-context-with-1m`.
3. **Assuming session-only changes persist** — if `/model` is used without the save-as-default path, the change applies only to the current session. Restart Claude Code and the model reverts to the saved default.
4. **Provider-locked environments** — in Bedrock, Vertex, Foundry, or Gateway deployments, certain model IDs are gated by the provider's own model list; the `not_allowed` telemetry event is emitted when a policy-blocked model is requested.
5. **Confusing alias casing** — model aliases (`sonnet`, `haiku`, `opus`, `best`) are normalised to lowercase before resolution; however, literal Anthropic API model IDs (e.g. `claude-sonnet-4-5`) must match the API's expected format exactly, otherwise the probe will return `not_found_error`.
6. **Expecting instant feedback without network** — `/model` triggers a live API probe for unknown model IDs; in air-gapped or restricted-network environments this probe may time out or emit a network error.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Eyf` | Main async handler for `/model` command (Arbor-resolved entry point) |
| `H` | Bootstrap fetch / HTTP helper (used for fetching model lists and headers) |
| `v` | Settings file writer / atomic write orchestrator |
| `PgK` | File-write pipeline coordinator |
| `PJA` | Write-step executor (calls `GUK`, `EUK`) |
| `SH` | JSON serialiser helper (calls `JSON.stringify`) |
| `V4` | Path / string manipulation utility (replace, slice, lastIndexOf) |
| `rXA` | Model-list mapper (calls `YgK.map`) |
| `q` | File unlink / cleanup helper |
| `A` | Lowercase-normalisation helper for file paths |
| `WpH` | Write-persistence wrapper |
| `pXA` | Raw stream writer (calls `H.write`) |
| `EgK` | Atomic settings-write orchestrator (mkdir, appendFile, rename, unlink) |
| `dmH` | Debounce / async queue manager (setTimeout, clearTimeout, setImmediate) |
| `E3H` | Settings flush / join helper |
| `i6` | Settings path resolver helper |
| `zL6` | Directory validator (calls `V8`) |
| `_PA` | Settings path builder (path.join + `S6`) |
| `HPA` | Atomic rename helper (stat, endsWith `.txt`, rename, unlink) |
| `GgK` | Append-and-rotate file writer (mkdir, appendFile, zL6, HPA) |
| `J9` | Hook registrar (calls `jJA.register`) |
| `_3` | App-state accessor helper |
| `AY_` | Model-string splitter / trimmer (split, trim, indexOf, slice) |
| `LHH` | Set-membership check helper (`Y94.has`) |
| `bJ` | String replacement utility |
| `a1` | Model-resolution entry point (calls `oHH`, `qq`, `rX`) |
| `oHH` | Model-object builder (calls `k0`, `OqH`, `yA`, `Dd`) |
| `k0` | Model-metadata factory |
| `OqH` | Model option query helper |
| `Dd` | Model-string parser / struct builder |
| `qq` | Model string normaliser / alias resolver |
| `Q0` | Model capability flag lookup (calls `BKH`) |
| `pKH` | Provider exclusion membership check (`mKH.includes`) |
| `qI` | Model render helper (calls `UM`, `G5`) |
| `LQH` | Model label renderer (calls `G5`) |
| `PE` | First-party model descriptor builder (calls `UM`, `G5`, `wA`) |
| `RJ1` | Model entry wrapper (calls `PE`) |
| `UM` | Provider context resolver (calls `wA`) |
| `Xt6` | 1M-context inclusion checker (`z8L.includes`) |
| `fQH` | Feature-flag helper (calls `tH`) |
| `rX` | Model-list builder (calls `qq`, `g0`) |
| `g0` | Model-variant composer (calls `WA`, `PE`, `UM`, `wA`, `G5`, `qI`) |
| `t6` | Telemetry event emitter (calls `c`, `Z6`) |
| `c` | Core telemetry recorder |
| `Z6` | Telemetry serialiser / dispatcher (calls `Zx6`) |
| `Zx6` | Low-level telemetry sink |
| `AR8` | Model-alias resolution coordinator (calls `mS`, `_`) |
| `mS` | Alias table + normalisation combiner (calls `a36`, `g0`) |
| `a36` | Alias table lookup (calls `lO`, `qq`) |
| `lO` | Alias list iterator (calls `rzH`) |
| `dV` | Session hash computer (calls `ob`, `Ia1.createHash`) |
| `ob` | Hash helper (calls `Zx6`) |
| `z_K` | Validate-and-switch orchestrator (calls `_R8`, `FqA`) |
| `_R8` | Model validation router (calls `Dd`, `RH`, `Skf`, `Rkf`, `hkf`, `eS8`, `TH`) |
| `RH` | Render helper for validation results (calls `c`, `Z6`) |
| `Skf` | Opus 1M availability checker |
| `$s` | Display helper (calls `BKH`, `WA`, `Zm9`) |
| `A2` | Model-row renderer (calls `BKH`, `FKH`, `wA`, `WA`, `Aq`) |
| `Rkf` | Sonnet 1M availability checker |
| `OfH` | Display helper for Sonnet variants (calls `BKH`, `WA`, `Zm9`) |
| `hkf` | Provider-exclusion model checker (calls `mKH.includes`, `H.toLowerCase`) |
| `eS8` | API probe validator (calls `au`, `kkf`, cache ops) |
| `au` | Side-query API caller (fetch, `globalThis.fetch`, response handling) |
| `kkf` | Probe-result processor (calls `ykf`, `String`) |
| `TH` | String coercion helper (calls `String`) |
| `FqA` | Post-validation model-apply and confirm renderer |
| `MS6` | Settings-write coordinator (calls `r_`, `hH`) |
| `r_` | Settings file writer (multi-tier: user/project/local) |
| `hH` | Confirmation message renderer (calls `c`, `Z6`) |
| `H4` | Model-card display helper (calls `wA`, `tH`) |
| `wA` | Provider-type resolver / display (calls `tH`) |
| `tH` | String coercion / display primitive (calls `String`) |
| `nzH` | Fast-mode indicator display helper |
| `MO` | Model display row builder (calls `H4`, `g0`, `qq`, `q.includes`) |
| `OWH` | Managed-settings guard / display (calls `WA`, `qq`, `rX`, `MO`, `Q0`) |
| `WA` | Provider-type display string builder (calls `AD`, `gR`, `Q1`) |
| `gqA` | Confirmation and persistence writer (calls `hTH`, `m8`, `Ix`, `J6.dim`, `J6.bold`, `mr`) |
| `hTH` | Settings-path resolver for confirmation (calls `EV`, `m8`) |
| `m8` | Settings directory builder (calls `Xc6`, `gQ`) |
| `Ix` | Path joiner (calls `lv.join`) |
| `mr` | Model-row renderer for confirmation (calls `pKH`, `lO`, `qq`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.