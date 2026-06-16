---
type: feature-spec
feature: "model"
cc_version: "2.1.178"
updated: "2026-06-16"
tags: ["model", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.178 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/model`

> Analysis basis: CC v2.1.178 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.178

---

## Overview

The `/model` command allows users to view or change the AI model Claude Code uses for the current session and optionally as a persistent default. When invoked with a model name argument, it validates the requested model against available models, checks organizational policy, optionally probes the API for availability, and then applies the change — either for the session only or saved permanently to user settings.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `model` |
| description | `Set the AI model for Claude Code` |
| argumentHint | `<model>` |
| supportsNonInteractive | `true` |
| module_id | `oWK` |
| load_inline | `true` |
| loc_byte | `13109705` |
| loc_byte_end | `13109879` |
| loc_line | `9032` |
| arbor_handler.name | `Mq5` |
| arbor_handler.fqn | `claude-2.1.178::Mq5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.178 bundle.js:+13109705 (registration block `13109705`–`13109879`)

---

## Input Branching

The command has 5+ distinct branches based on the argument value and system state. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/model called with argument H"] --> B{Trim argument.\nIs it empty?}
    B -- Yes --> C[Error: 'Model name cannot be empty'\nAbort]
    B -- No --> D{Is argument in\nknown alias list XlH?}
    D -- Yes --> E[Resolve alias to\ncanonical model string]
    D -- No --> F[Use argument as-is]
    E --> G
    F --> G{Check org policy:\nmodel_switch allowed?}
    G -- not_allowed --> H[Error: model switching\ndisabled by policy. Abort]
    G -- allowed --> I{Is model in\nknown model set n_H?}
    I -- No / unknown --> J[Run API validation probe\nvia modelValidation handler eU]
    I -- Yes --> K{Check 1M context\nfeature flags}
    J --> J1{Probe result?}
    J1 -- auth error 401/403 --> L[Error: Authentication failed]
    J1 -- network error --> M[Error: Network error]
    J1 -- not_found_error --> N[Error: invalid_model]
    J1 -- exception --> O[Error: validate_exception]
    J1 -- success --> K
    K --> K1{opus[1m] requested\nbut unavailable?}
    K1 -- Yes --> P[Error: opus_1m_unavailable\nwith docs link]
    K1 -- No --> K2{sonnet[1m] / sonnet-4-6[1m]\nrequested but unavailable?}
    K2 -- Yes --> Q[Error: sonnet_1m_unavailable\nwith docs link]
    K2 -- No --> K3{Is fable model\nrequested?}
    K3 -- fable_unavailable --> R[Error: fable_unavailable]
    K3 -- fable_probe_failed --> S[Error: fable_probe_failed]
    K3 -- OK or not fable --> T{Is model disabled\nby org? disabled_by_org?}
    T -- Yes --> U[Error: 'That model' disabled]
    T -- No --> V{Save as default?\nCheck session-vs-persistent flag}
    V -- Persistent default --> W[Write model to userSettings\nvia configWriter YA\nEmit model_set_default telemetry]
    V -- Session only --> X[Apply model to appState\nfor this session only]
    W --> Z[Display confirmation:\nmodel name + bold + 'and saved as your default for new sessions']
    X --> Z2[Display confirmation:\nmodel name + 'for this session only']
    Z --> AA[Emit tengu_model_command_inline telemetry]
    Z2 --> AA
```

Analysis basis: CC v2.1.178 bundle.js:+13073992, +13074008, +13074031, +13074075, +13074095, +13074148, +13074190, +13074245, +13032771, +13034753, +13034768, +13034915, +13035132, +13035651, +13035946

---

## Behavioral Spec

### 1. Handler Entry Point (`Mq5`)

The async handler is `Mq5`, resolved via `module_id` → `oWK`.

```
async function modelCommandHandler(argument, context):
    trimmedArg = argument.trim()                          // +13073992

    if trimmedArg is empty:
        return error("Model name cannot be empty")        // +13032771

    if trimmedArg is in knownAliasList:                   // +13074008
        resolvedModel = resolveAlias(trimmedArg)
    else:
        resolvedModel = trimmedArg

    appState = context.getAppState()                      // +13074031

    // Check organizational policy
    policyResult = checkModelSwitchPolicy(appState)       // +13074075
    if policyResult == "not_allowed":                     // +13034768
        return error("model_switch not allowed by policy") // +13034753

    if resolvedModel not in knownModelSet:                // +13074095
        validationResult = runApiValidationProbe(resolvedModel, context)
        if validationResult has error:
            return handleValidationError(validationResult)

    // Check feature-flag-gated 1M context models
    check1MContextAvailability(resolvedModel, appState)  // +13034915, +13035132

    // Inline-mode shortcut
    emit telemetry("tengu_model_command_inline")         // +13074150

    // Persist or session-scope
    applyModelChange(resolvedModel, appState, context)   // +13074245
```

Analysis basis: CC v2.1.178 bundle.js:+13073992

---

### 2. Alias Resolution (`modelAliasResolver` → `Y1`)

A set of short human-friendly aliases are mapped to canonical model identifiers. Known aliases extracted from literals:

| Alias | Canonical / Description |
|---|---|
| `opusplan` | Opus in plan mode, else Sonnet (bundle.js:+2283227) |
| `fable` | Fable model family (bundle.js:+2284770) |
| `sonnet` | Sonnet family (bundle.js:+2284873) |
| `haiku` | Haiku family (bundle.js:+2284912) |
| `opus` | Opus family (bundle.js:+2284951) |
| `best` | Best available model (bundle.js:+2284985) |

```
function resolveModelAlias(alias):
    alias = alias.trim().toLowerCase()                  // +2284693, +2284704
    switch alias:
        case "opusplan":  return opusPlanConfig         // +2283227
        case "fable":     return fableModelId           // +2284770
        case "sonnet":    return sonnetModelId          // +2284873
        case "haiku":     return haikuModelId           // +2284912
        case "opus":      return opusModelId            // +2284951
        case "best":      return bestModelId            // +2284985
        default:          return alias  // pass-through to raw model name
```

Analysis basis: CC v2.1.178 bundle.js:+2284693

---

### 3. Model Name Normalization (`modelNormalizer` → `f48`)

The model normalizer is a comprehensive lookup function that maps incoming model identifiers (which may be short-form or versioned aliases) to their canonical full API names.

Known canonical model identifiers found in literals:

| Short / Alias | Canonical Model ID |
|---|---|
| `fable` | `claude-fable-5` (+2281446) |
| `mythos` | `claude-mythos-5` (+2281501) |
| `opus-4-8` | `claude-opus-4-8` (+2281558) |
| `opus-4-7` | `claude-opus-4-7` (+2281615) |
| `opus-4-6` | `claude-opus-4-6` (+2281672) |
| `opus-4-5` | `claude-opus-4-5` (+2281729) |
| `opus-4-1` | `claude-opus-4-1` (+2281786) |
| (Opus 4) | `claude-opus-4-0` (+2281875) |
| (Sonnet 4.6) | `claude-sonnet-4-6` (+2281907) |
| (Sonnet 4.5) | `claude-sonnet-4-5` (+2281968) |
| (Sonnet 4) | `claude-sonnet-4-0` (+2282063) |
| (Haiku 4.5) | `claude-haiku-4-5` (+2282097) |
| (Sonnet 3.7) | `claude-3-7-sonnet` (+2282156) |
| (Sonnet 3.5) | `claude-3-5-sonnet` (+2282217) |
| (Haiku 3.5) | `claude-3-5-haiku` (+2282278) |
| (Opus 3) | `claude-3-opus` (+2282337) |
| (Sonnet 3) | `claude-3-sonnet` (+2282390) |
| (Haiku 3) | `claude-3-haiku` (+2282447) |

```
function normalizeModelId(rawInput):
    trimmed = rawInput.trim()
    lower   = trimmed.toLowerCase()

    // Fast-path: starts with "claude-" → treat as explicit full model id
    if trimmed.startsWith("claude-"):                        // +2274590
        return trimmed

    // Lookup in alias table (case-insensitive)
    entry = modelAliasTable.find(e => e.short == lower)
    if entry:
        return entry.canonical
    else:
        // Unknown model: pass-through; validation probe will check it
        return trimmed
```

Analysis basis: CC v2.1.178 bundle.js:+2274590

---

### 4. Policy Check (`policyChecker` → `Ec8`)

```
function checkModelSwitchPolicy(appState):
    policySettings = appState.policySettings              // +2266278
    switchRule = policySettings["model_switch"]           // +13034753

    if switchRule == "not_allowed":                       // +13034768
        return NOT_ALLOWED
    return ALLOWED
```

Analysis basis: CC v2.1.178 bundle.js:+13034753

---

### 5. Availability Validation for Known Models (`availabilityChecker` → `Tc8`)

For models already known to the client, specific feature-flag checks are applied before the API probe:

```
function checkKnownModelAvailability(resolvedModel, appState):

    // 1M context Opus check
    if modelRequires1MOpus(resolvedModel):               // +13034883
        if not accountSupports1MOpus(appState):
            return error("opus_1m_unavailable",           // +13034915
                "Opus with 1M context is not available for your account. " +
                "Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m")
                                                          // +13034953

    // 1M context Sonnet check  (sonnet[1m] / sonnet-4-6[1m])
    if modelRequires1MSonnet(resolvedModel):             // +13035100
        if not accountSupports1MSonnet(appState):
            return error("sonnet_1m_unavailable",         // +13035132
                "Sonnet 4.6 with 1M context is not available for your account. " +
                "Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m")
                                                          // +13035172

    // Org-disabled model check
    if isModelDisabledByOrg(resolvedModel, appState):   // +13035400
        return error("disabled_by_org",                   // +13035400
            "That model is disabled for your organization") // +2271155

    // Fable model availability check
    if isFableModel(resolvedModel):                     // +13035561
        probeResult = probeFableAvailability(resolvedModel)
        if probeResult == UNAVAILABLE:
            return error("fable_unavailable")             // +13035651
        if probeResult == PROBE_FAILED:
            return error("fable_probe_failed")            // +13035671

    return OK
```

Special string literals for 1M context variants:
- `"sonnet[1m]"` (bundle.js:+13037314)
- `"sonnet-4-6[1m]"` (bundle.js:+13037340)

Analysis basis: CC v2.1.178 bundle.js:+13034883, +13035100, +13035331, +13035561

---

### 6. API Validation Probe (`apiModelProbe` → `_F6`)

When a model is not in the locally known model set, the handler performs a lightweight API call to verify the model exists and is accessible.

```
async function apiModelProbe(modelId, context):
    if modelId is empty:                                  // +13032734
        return error("Model name cannot be empty")

    if modelId.toLowerCase() in localKnownModels:        // +13032919, +13032938
        return KNOWN_OK  // skip network probe

    if probeCache.has(modelId):                          // +13033040
        return probeCache.get(modelId)

    // Send a minimal API call with a dummy "Hi" message
    // using type "model_validation", role "user", cache "ephemeral"
    // to verify model validity                          // +13033135, +13033170, +13033204, +13033229
    try:
        result = await apiCall(modelId, validationPayload)
        probeCache.set(modelId, result)                  // +13033248

        if result.error.type == "not_found_error":       // +13033728
            return error("invalid_model")                // +13035946
        return OK

    catch authError (401 / 403):                        // +13033507
        return error("Authentication failed. Please check your API credentials.")

    catch networkError:                                  // +13033609
        return error("Network error. Please check your internet connection.")

    catch exception:
        return error("validate_exception")               // +13036043
```

Analysis basis: CC v2.1.178 bundle.js:+13032805, +13033085, +13033135

---

### 7. Model Application and Persistence (`applyModelChange` → `dXA`)

```
async function applyModelChange(resolvedModel, saveDefault, appState, context):
    // Determine display name for confirmation message
    displayName = getDisplayName(resolvedModel)           // +13036276

    if saveDefault:
        // Write model to userSettings via config writer
        writeUserSetting("model", resolvedModel)         // +13036834
        emit telemetry("model_set_default")              // +13036787
        confirmMsg = displayName + " and saved as your default for new sessions"
                                                          // +13036429
    else:
        // Apply to in-memory appState only
        appState.model = resolvedModel
        confirmMsg = displayName + " for this session only"  // +13036475

    // Annotate message with fast-mode and usage-credit info if applicable
    if fastModeOn:
        confirmMsg += " · Fast mode ON"                  // +13036593
    if drawsFromUsageCredits:
        confirmMsg += " · Draws from usage credits"      // +13036644
    if fastModeOff:
        confirmMsg += " · Fast mode OFF"                 // +13036690

    displayConfirmation(J6.bold(displayName), confirmMsg)

    // Show managed-settings notice if org policy applies
    if orgHasManagedSettings:
        displayInfo("Managed settings")                  // +13036996
```

Analysis basis: CC v2.1.178 bundle.js:+13036228, +13036429, +13036475

---

### 8. Model Display Name Mapping (`modelDisplayNames` → `cXA`)

A lookup table maps canonical model IDs to human-readable display names. Known mappings from literals:

| Canonical Model ID | Display Name |
|---|---|
| `claude-fable-5` | `Fable 5` (+2283928) |
| `claude-mythos-5` | `Mythos 5` (+2283966) |
| `claude-opus-4-8` | `Opus 4.8` (+2284005) |
| `claude-opus-4-7` | `Opus 4.7` (+2284046) |
| `claude-opus-4-6` | `Opus 4.6` (+2284087) |
| `claude-opus-4-5` | `Opus 4.5` (+2284128) |
| `claude-opus-4-1` | `Opus 4.1` (+2284169) |
| `claude-opus-4-0` | `Opus 4` (+2284210) |
| `claude-sonnet-4-6` | `Sonnet 4.6` (+2284251) |
| `claude-sonnet-4-5` | `Sonnet 4.5` (+2284296) |
| `claude-sonnet-4-0` | `Sonnet 4` (+2284341) |
| `claude-3-7-sonnet` | `Sonnet 3.7` (+2284384) |
| `claude-3-5-sonnet` | `Sonnet 3.5` (+2284427) |
| `claude-haiku-4-5` | `Haiku 4.5` (+2284469) |
| `claude-3-5-haiku` | `Haiku 3.5` (+2284512) |
| (opusplan) | `Opus Plan` (+2283539) |

The suffix `" (1M context)"` is appended to the display name when a 1M context variant is requested (bundle.js:+2283868).

Analysis basis: CC v2.1.178 bundle.js:+13036830

---

### 9. Bootstrap Model Discovery (`bootstrapModelFetcher` → `Z9L`)

During startup (not directly on `/model` invocation), the CLI may attempt to fetch available models from the API's `/v1/models` gateway endpoint, subject to several preconditions:

```
function bootstrapModelDiscovery(context):
    if not env.CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY:
        log("[Bootstrap] Skipped gateway /v1/models ...")  // +8116835
        return

    if nonEssentialTrafficDisabled:                        // +8116990
        log("[Bootstrap] Skipped: Nonessential traffic disabled")
        return

    if is3rdPartyProvider:                                 // +8117081
        log("[Bootstrap] Skipped: 3P provider")
        return

    // Fetch with 5000ms timeout                           // +8117343
    response = await fetch(gatewayUrl, {
        headers: {
            "Content-Type": "application/json",            // +8117228
            "User-Agent": ...,                             // +8117262
            "anthropic-beta": ...,                         // +8117758
        },
        timeout: 5000
    })

    if fetch succeeded:
        updateBootstrapCache(response)                     // +8117516
    else:
        emit telemetry("api_bootstrap_fetch", "request_failed") // +8118462
```

Analysis basis: CC v2.1.178 bundle.js:+8116758, +8117343

---

### 10. Model Set Composition (`modelSetBuilder` → `QP_`)

The full model availability set is computed from multiple sources:

```
function buildAvailableModelSet(context):
    models = []
    models += getFirstPartyModels()        // "firstParty"  +2283439
    models += getMantleModels()            // "mantle"       +2273710

    // Add bedrock / vertex / anthropicAws if applicable
    if provider == "bedrock" or "anthropicAws":           // +2120745, +2120851
        models += getBedrockModels()
    if provider == "vertex":                               // +2120953
        models += getVertexModels()

    // Filter by account status
    models = models.filter(m => m.status != "refused"     // +2273948
                             and m.status != "inactive")  // +2273986
    // active is the passing state                         // +2274028

    // Apply application-inference-profile filtering if applicable
    // "application-inference-profile" +2282583

    return deduplicatedModelSet(models)
```

Analysis basis: CC v2.1.178 bundle.js:+2273509

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_model_command_inline` | Emitted after successful model selection (bundle.js:+13074150) |
| Telemetry: `tengu_feature_ok` | Emitted on successful feature flag check (bundle.js:+1020153) |
| Telemetry: `tengu_feature_bad` | Emitted on failed feature flag check (bundle.js:+1020220) |
| Telemetry: `tengu_api_success` | Emitted after a successful API probe (bundle.js:+13919498) |
| Telemetry: `tengu_lone_surrogate_sanitized` | Emitted if lone surrogates are sanitized in response text (bundle.js:+13919194) |
| Telemetry: `tengu_config_auth_loss_prevented` | Emitted if a config write is blocked to prevent auth loss (bundle.js:+3345928) |
| `appState.model` | Updated in-memory to the new model string when session-only |
| `userSettings` (`~/.claude/settings.json`) | Written with `"model"` key when saving as default (bundle.js:+13036834, +1326022) |
| `projectSettings` | Read during model policy resolution (bundle.js:+1326137) |
| `policySettings` | Read to enforce `model_switch` org policy (bundle.js:+2266278) |
| Probe cache `qWK` | `has()`/`set()` used to avoid redundant API validation probes (bundle.js:+13033040, +13033248) |
| Bootstrap cache | Written to disk when model list changes (bundle.js:+8118884) |
| Config auth guard | Refuses config write if re-read config is missing auth (bundle.js:+3345800, GH #3117) |
| Display | Bold model name + scope annotation + optional fast-mode / usage-credits suffixes shown to user |

---

## Version History

| Version | Change |
|---|---|
| v2.1.178 | Initial analysis — full alias table, 1M context checks, fable probe, org policy enforcement, API validation probe with cache |

---

## Common Mistakes

1. **Passing a short alias without knowing it is recognized**: Only the aliases `opusplan`, `fable`, `sonnet`, `haiku`, `opus`, and `best` are resolved client-side. Other short names are passed through to the API validation probe, which may return `invalid_model`.

2. **Expecting an immediate persistent change without the save flag**: Without the persist flag being set, the model change applies to the current session only and is not written to `~/.claude/settings.json`. A new session will revert to the previously saved default.

3. **Using `claude-` prefix models on restricted accounts**: Models requiring 1M context (`sonnet[1m]`, `sonnet-4-6[1m]`, opus 1M variants) will be rejected with a specific error and documentation link if the account does not have access, regardless of whether the model ID is otherwise valid.

4. **Assuming all models are available on all providers**: The available model set differs between `bedrock`, `anthropicAws`, `vertex`, and first-party providers. A model valid on one provider may return `invalid_model` on another.

5. **Org policy silently blocking switches**: If `model_switch: not_allowed` is set in policy settings, the command will fail immediately after argument validation without reaching any network calls. Users on managed accounts should consult their administrator.

6. **Triggering the bootstrap fetch by environment variable**: Gateway model discovery via `/v1/models` is skipped by default; it requires `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY` to be set, or the list will remain static.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Mq5` | Main async handler for `/model` command (arbor_handler) |
| `H` | Argument string variable / misc string ref; also random-delay helper |
| `_` | App state / utility accessor |
| `Ec8` | Policy check dispatcher |
| `av` | Model availability resolver (calls `tX6` and `RW`) |
| `tX6` | Model alias resolution table builder |
| `JM` | Model alias entry constructor |
| `Y1` | Full model alias resolver / display-name mapper |
| `RW` | Available model set builder entry point |
| `QP_` | Model set composition (first-party + mantle + provider models) |
| `f48` | Low-level model normalizer and deduplication logic |
| `d` | Generic logger / debug emitter |
| `WM` | SHA-256 hash utility (12-char prefix, used for probe cache keys) |
| `Ej` | Hash helper dependency |
| `c36` | Low-level hash primitive |
| `fWK` | Model change application orchestrator |
| `Tc8` | Known-model availability checker (1M, fable, org-disabled) |
| `JK` | Model list fetcher / model record builder |
| `vj6` | Model record field getter pair |
| `Nj6` | Model metadata normalizer |
| `q` | Data record / stream reference |
| `q4` | Model ID string sanitizer (removes formatting) |
| `$` | Stream / config accessor |
| `K` | Column padded list formatter |
| `KkH` | Model capability flag checker |
| `uN` | Provider-type checker (bedrock / vertex / etc.) |
| `_48` | Recursive model alias lookup |
| `LR1` | Policy-settings key extractor |
| `b8` | Settings path resolver |
| `iiH` | Settings entry iterator |
| `L` | Terminal / readline interface reference |
| `fR1` | Model capability index lookup |
| `FGf` | Model flag-gated feature resolver |
| `iX6` | Model identifier normalizer (lowercase + strip) |
| `gGf` | Model prefix-based group resolver |
| `bH` | Feature-flag check helper (emits `tengu_feature_ok` / `tengu_feature_bad`) |
| `dH` | Feature-flag inner implementation |
| `P95` | Opus 1M context availability checker |
| `Vt` | Model tier checker |
| `gJ` | Model tier entry builder |
| `W95` | Sonnet 1M context availability checker |
| `z5H` | Sonnet tier checker |
| `XJH` | Org-disabled model checker |
| `S_` | React/UI component renderer |
| `Y7` | UI text node builder |
| `nz` | Model ID substring normalizer / replacer |
| `PJH` | Array shape checker |
| `f1` | Model display name suffix builder |
| `mAH` | "That model" disabled message builder |
| `RAH` | 1M context display name suffix appender |
| `K48` | Model status badge builder |
| `WrH` | Display name component wrapper |
| `_F6` | API model validation probe (network call + cache) |
| `A` | String / lowercasing utility |
| `eU` | Side-query API caller (validation / structured outputs) |
| `J95` | Probe result parser and error classifier |
| `KWK` | Model ID lowercase normalizer for known-model check |
| `O96` | Bootstrap model discovery orchestrator |
| `Z9L` | Gateway `/v1/models` fetch implementation |
| `SH` | Config writer (userSettings / projectSettings) |
| `S6` | Global config saver (with auth-loss guard) |
| `Zjq` | Bootstrap cache comparer |
| `N` | Log message formatter (debug prefix) |
| `W8` | Config read-back / merge helper |
| `gz` | Bootstrap data processor |
| `RH` | Error logger (`Us.logError`) |
| `TH` | String coercion utility |
| `dXA` | Model change application and confirmation display |
| `A7H` | App state model field accessor |
| `AF6` | User settings model writer |
| `YA` | Settings file writer (flagSettings / userSettings / projectSettings) |
| `V4` | Styled output component |
| `L6` | String conversion / styled text utility |
| `DJH` | Display annotation helper |
| `L3` | Model display with provider annotation |
| `GZH` | Display name + fast-mode / credits annotation builder |
| `ZA` | Styled text wrapper |
| `kO` | Display-name + model-tier combiner |
| `Lg` | Model tier sanitizer |
| `vk` | Usage-credits annotation builder |
| `Gg` | Fast-mode OFF annotation builder |
| `jY` | Styled label renderer |
| `cXA` | Model confirmation display renderer (full output) |
| `MLH` | Managed-settings notice renderer |
| `pm` | Path joiner (`.claude/settings.json`, `.claude/settings.local.json`) |
| `Sn` | Alias group display helper |