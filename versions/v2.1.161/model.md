---
type: feature-spec
feature: "model"
cc_version: "2.1.161"
updated: "2026-06-03"
tags: ["model", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.161 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/model`

> Analysis basis: CC v2.1.161 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.161

---

## Overview

The `/model` command sets or displays the active AI model used by Claude Code for the current session or persistently as a default. When invoked with a model name argument, it validates the requested model against available options, optionally calls the API to confirm availability, then updates session state and/or persists the choice to project/user settings. When invoked with no argument it displays the currently active model.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `model` |
| description | Set the AI model for Claude Code |
| argumentHint | `<model>` |
| supportsNonInteractive | `true` |
| module_id | `t6K` |
| load_inline | `true` |
| loc_byte | `12552583` |
| loc_byte_end | `12552757` |
| loc_line | `8788` |
| arbor_handler.name | `jNf` |
| arbor_handler.fqn | `claude-2.1.161::jNf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.161 bundle.js:+12552583

---

## Input Branching

There are 5+ distinct execution branches (empty input, shorthand alias resolution, 1M-context variant checks, API validation, persistence vs. session-only), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/model [arg]"]) --> B{Argument provided?}
    B -- No --> C[Display current model name and exit]
    B -- Yes --> D[Trim whitespace from argument]
    D --> E{Argument is empty after trim?}
    E -- Yes --> F[Error: 'Model name cannot be empty']
    E -- No --> G[Resolve shorthand alias\ne.g. sonnet → full model ID\nopus, haiku, best, opusplan, etc.]
    G --> H{Is a 1M-context variant?\ne.g. sonnet[1m] / opus[1m]}
    H -- Yes --> I{Account has 1M access?}
    I -- No, Opus 1M --> J[Error: opus_1m_unavailable\nwith docs link]
    I -- No, Sonnet 1M --> K[Error: sonnet_1m_unavailable\nwith docs link]
    I -- Yes --> L[Use 1M model ID]
    H -- No --> L
    L --> M{Model in known-invalid cache\nM6K?}
    M -- Yes --> N[Error: invalid_model — skip API call]
    M -- No --> O[Send lightweight validation request\nto API via gu: single 'Hi' user\nmessage with ephemeral cache]
    O --> P{API response?}
    P -- Auth failure --> Q[Error: Authentication failed.\nCheck API credentials.]
    P -- Network error --> R[Error: Network error.\nCheck internet connection.]
    P -- not_found_error / model: in message --> S[Error: invalid_model\nAdd to invalid-model cache M6K]
    P -- validate_exception --> T[Error: validate_exception]
    P -- Success --> U[Emit telemetry: tengu_model_command_inline]
    U --> V{Default flag set?\ni.e. save to settings}
    V -- Yes --> W[Persist model to settings file\nvia settings writer\nEmit: model_set_default\nMessage: saved as your default for new sessions]
    V -- No --> X[Session-only update via appState\nMessage: for this session only]
    W --> Y[Update appState model]
    X --> Y
    Y --> Z[Display confirmation with fast-mode\nand usage-credits annotations]
```

Analysis basis: CC v2.1.161 bundle.js:+12544126, +12544142, +12544165, +12544209, +12544229, +12544282, +12544349

---

## Behavioral Spec

### 1. Handler Entry Point (`jNf`)

The Arbor-resolved handler `jNf` is an `AsyncFunction` reached via `module_id → t6K`.

```
async function modelCommandHandler(input, context):
    rawArg = input.trim()                          // bundle.js:+12544126

    if rawArg is empty:
        // No argument: display mode
        currentModel = context.getAppState().model // bundle.js:+12544165
        render current model name as "text"        // bundle.js:+12544193
        return

    // Check whether arg appears in a known-available-models list
    if not knownModels.includes(rawArg):           // bundle.js:+12544142
        // Still proceed; validation will catch truly invalid names

    resolvedModel = resolveModelAlias(rawArg)      // calls $6K sub-flow
    if resolvedModel is error:
        return renderError(resolvedModel.message)

    emit telemetry("tengu_model_command_inline")   // bundle.js:+12544284

    confirmResult = await validateAndConfirm(resolvedModel, context)
    if confirmResult is error:
        return renderError(confirmResult.message)

    applyModelToState(resolvedModel, context)      // calls N9A / DS8 sub-flow
```

Analysis basis: CC v2.1.161 bundle.js:+12544126

---

### 2. Alias Resolution (`$6K` → `zS8`)

`$6K` orchestrates shorthand-to-full-model-ID resolution. String constants found in this path confirm the supported alias vocabulary.

```
function resolveModelAlias(arg):
    lower = arg.toLowerCase()

    // Shorthand table (bundle.js:+2236154, +2236180, +2236195, +2236234, +2236273, +2236310)
    switch lower:
        case "opusplan":  return OPUS_PLAN_MODEL_ID   // "Opus in plan mode, else Sonnet"
        case "opus":      return OPUS_MODEL_ID
        case "sonnet":    return SONNET_MODEL_ID
        case "haiku":     return HAIKU_MODEL_ID
        case "best":      return BEST_MODEL_ID

    // 1M-context suffix check (bundle.js:+12509003, +12509029)
    if lower == "sonnet[1m]" or lower == "sonnet-4-6[1m]":
        return resolve1MVariant("sonnet")
    if lower ends with "[1m]":
        return resolve1MVariant("opus")

    // Pass-through: treat arg as a literal model ID
    return arg
```

#### 1M-Context Availability Guards (`vvf`, `Nvf`, `Vvf`)

```
function resolve1MVariant(family):
    if family == "opus":
        if not account.has1MAccess:
            // bundle.js:+12507131
            return error("opus_1m_unavailable",
                "Opus with 1M context is not available for your account. " +
                "Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m")
    if family == "sonnet":
        if not account.has1MAccess:
            // bundle.js:+12507348
            return error("sonnet_1m_unavailable",
                "Sonnet 4.6 with 1M context is not available for your account. " +
                "Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m")
    return fullModelId
```

Analysis basis: CC v2.1.161 bundle.js:+12507099, +12507316, +12507542

---

### 3. API Validation (`$S8` → `gu`)

Before accepting a model string, the handler performs a lightweight live-API probe using a minimal synthetic message.

```
async function validateModelViaApi(modelId, context):
    if invalidModelCache.has(modelId):             // bundle.js:+12505383
        return error("invalid_model")

    if modelId is empty after trim:                // bundle.js:+12505102
        return error("Model name cannot be empty") // bundle.js:+12505139

    normalizedId = modelId.toLowerCase()           // bundle.js:+12505262

    // Check against known-invalid prefix list (vKH)
    if knownInvalidPrefixes.includes(normalizedId): // bundle.js:+12505281
        return error("invalid_model")

    // Emit telemetry key for validation attempt
    // event label: "model_validation"             // bundle.js:+12505478

    // Build minimal probe request
    probeMessages = [{ role: "user", content: "Hi" }]  // bundle.js:+12505547
    cacheControl = "ephemeral"                         // bundle.js:+12505572

    response = await apiCall(modelId, probeMessages)   // gu, bundle.js:+12505428

    if response is auth error:
        return error("Authentication failed. Please check your API credentials.")
                                                       // bundle.js:+12505838
    if response is network error:
        return error("Network error. Please check your internet connection.")
                                                       // bundle.js:+12505940
    if response.type == "not_found_error"
       or response.message contains "model:":          // bundle.js:+12506059, +12506141
        invalidModelCache.set(modelId, true)           // bundle.js:+12505591
        return error("invalid_model")
    if exception during validation:
        return error("validate_exception")             // bundle.js:+12507728

    return success
```

Analysis basis: CC v2.1.161 bundle.js:+12505102, +12505428, +12505838

---

### 4. Model Switch Routing (`zS8` → `RH`, `TH`)

After validation, `zS8` routes to the appropriate model-switch handler based on the result outcome.

```
function routeModelSwitch(resolvedModel, validationResult):
    // Default route label: "default"             // bundle.js:+12506929
    // Switch event label: "model_switch"         // bundle.js:+12506969

    if validationResult == "not_allowed":         // bundle.js:+12506984
        renderPermissionError()
        return

    if validationResult == "invalid_model":       // bundle.js:+12507631
        renderInvalidModelError()
        return

    if validationResult == "validate_exception":  // bundle.js:+12507728
        renderValidationExceptionError()
        return

    // Proceed to apply
    applyModelSwitch(resolvedModel)
```

Analysis basis: CC v2.1.161 bundle.js:+12506953, +12507794

---

### 5. State Application & Persistence (`N9A`)

`N9A` applies the validated model to both session state and, optionally, the persistent settings file.

```
function applyModelAndPersist(modelId, shouldPersist, context):
    // Build display confirmation text
    confirmText = bold(modelId)

    // Annotate fast-mode status
    if fastModeEnabled:
        confirmText += " · Fast mode ON"           // bundle.js:+12508272
    else:
        confirmText += " · Fast mode OFF"          // bundle.js:+12508369

    // Annotate billing source
    if modelDrawsFromUsageCredits:
        confirmText += " · Draws from usage credits"  // bundle.js:+12508323

    if shouldPersist:
        writeModelToSettings(modelId)              // via settings writer l_
        // Telemetry: model_set_default            // bundle.js:+12508466
        confirmText += " and saved as your default for new sessions"
                                                   // bundle.js:+12508108
    else:
        confirmText += " for this session only"    // bundle.js:+12508154

    context.appState.model = modelId

    // Display managed-settings note if policy-locked
    if managedSettings:                            // bundle.js:+12508675
        renderManagedSettingsNotice()

    renderConfirmation(confirmText)
```

Analysis basis: CC v2.1.161 bundle.js:+12508041, +12508089, +12508097

---

### 6. Settings Writer (`l_`)

When persistence is requested, `l_` writes the model key to the appropriate settings layer.

```
function writeSettingsFile(layer, key, value):
    // Supported layers (bundle.js:+1231405, +1231427, +1232051, +1232166, +1232189)
    // "policySettings", "flagSettings", "userSettings",
    // "projectSettings", "localSettings"

    settingsPath = path.join(homeDir, ".claude", "settings.json")
                                                   // bundle.js:+1222551, +1222561
    // Local variant: "settings.local.json"        // bundle.js:+1222623

    existingData = readJSON(settingsPath)
    existingData[key] = value                      // key = "model" // bundle.js:+12508513
    writeJSON(settingsPath, existingData, "utf-8") // bundle.js:+1232103

    emitEvent(WBH, "write_ineffective" | "already_tracked" | "gitignore_global_rule")
                                                   // bundle.js:+1232458, +1232361, +1232317
```

Analysis basis: CC v2.1.161 bundle.js:+1231467, +1232051

---

### 7. API Probe Execution (`gu`)

`gu` is the internal async API-call function used for the validation probe (and regular inference). Relevant behavior for the `/model` validation use-case:

```
async function executeApiCall(modelId, messages, options):
    // Timing: performance.now() at start          // bundle.js:+13323104
    // Side-query label: "side_query"              // bundle.js:+13322059
    // Cache-buster window: 1h                     // bundle.js:+13322911
    // Max context: Math.min(..., 1024)             // bundle.js:+13321875

    response = await globalThis.fetch(endpoint, {
        headers: { ... },
        body: JSON.stringify(payload)
    })                                             // bundle.js:+13322112

    if success:
        emit telemetry("tengu_api_success")        // bundle.js:+13323512
        // Date.now() delta used for latency       // bundle.js:+13323484

    return parsedResponse
```

Analysis basis: CC v2.1.161 bundle.js:+13322027, +13322112

---

### 8. Model Provider Routing (`PA`, `UM`, `rK`, `sX`)

Several helper functions determine which backend provider to route the model through.

```
function resolveProvider(modelId):
    // Provider strings (bundle.js:+2049937, +2049987, +2050145, +2050606, +2050626)
    // "bedrock", "foundry", "vertex", "anthropicAws", "gateway"
    // "firstParty", "mantle"                      // bundle.js:+2232362, +2233003

    if modelId includes "bedrock" marker:
        return "bedrock"
    if modelId includes "vertex" marker:
        return "vertex"
    if modelId includes "foundry" marker:
        return "foundry"
    // Falls through to "firstParty" / Anthropic direct
    return "firstParty"
```

Specific Opus 4.x model IDs confirmed in literals: `opus-4-6`, `opus-4-7`, `opus-4-8` (bundle.js:+2222506, +2222530, +2222554), `sonnet-4-6` (bundle.js:+10989313).

Analysis basis: CC v2.1.161 bundle.js:+2049897, +2050571

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_model_command_inline` | Fired when `/model <arg>` is executed (bundle.js:+12544284) |
| Telemetry: `tengu_api_success` | Fired on successful API validation probe (bundle.js:+13323512) |
| Telemetry: `tengu_feature_ok` | Fired on successful feature path (bundle.js:+966587) |
| Telemetry: `tengu_feature_bad` | Fired on a bad/error feature path (bundle.js:+966650) |
| Telemetry: `tengu_feature_sad` | Fired on a degraded/sad feature path (bundle.js:+966732) |
| Literal event key: `model_set_default` | Emitted internally when model is persisted to settings (bundle.js:+12508466) |
| Literal event key: `model_validation` | Emitted during API validation probe (bundle.js:+12505478) |
| Literal event key: `model_switch` | Emitted during routing decision (bundle.js:+12506969) |
| `appState.model` | Updated to the validated model ID after successful execution |
| Settings file write | `~/.claude/settings.json` or `settings.local.json` when persisting (bundle.js:+1222551, +1222561, +1222623) |
| Invalid-model cache (`M6K`) | Populated on `not_found_error` responses; consulted to skip repeat API probes (bundle.js:+12505383, +12505591) |
| `WBH` event emission | Settings-layer events (`write_ineffective`, `already_tracked`, `gitignore_global_rule`) emitted after writes (bundle.js:+1232623) |
| Hook registration (`tYA.register`) | Called via `Y9` during setup (bundle.js:+59405) |
| Sound | None observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.161 | Initial analysis |

---

## Common Mistakes

1. **Using an alias without understanding its scope**: Aliases like `best`, `opus`, `sonnet`, and `haiku` resolve to specific full model IDs at runtime. If your account lacks access to the resolved model, the command will fail with `invalid_model` even though the alias appears valid.

2. **Expecting `[1m]` variants to work without extended-context entitlement**: Invoking `/model sonnet[1m]` or `/model opus[1m]` when your account does not have the 1M-context feature enabled will produce a hard error with a documentation link, not a graceful fallback to the standard model.

3. **Assuming the command is synchronous**: The handler is an `AsyncFunction` (`jNf`). In non-interactive scripting (`supportsNonInteractive: true`), callers must await its resolution before reading the updated model from state.

4. **Conflating session-only and persistent changes**: Without the default-persistence flag, the model change applies only to the current session. Restarting Claude Code will revert to the prior default. Use the appropriate flag or check `settings.json` to confirm persistence.

5. **Providing an already-cached invalid model**: The invalid-model cache (`M6K`) persists within the process lifetime. If a model ID was rejected once, subsequent `/model` calls with the same ID skip the API probe and return `invalid_model` immediately without re-querying the API.

6. **Expecting managed-settings overrides to persist**: When a policy lock (`Managed settings`) is active, the settings write may be silently ineffective. The `write_ineffective` event is emitted in this case.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `jNf` | Main async handler for `/model` command (Arbor-resolved entry point) |
| `H` | Bootstrap/model-fetch utility (also reused as generic parameter name in several scopes) |
| `N` | Config/settings read-write orchestrator |
| `VBK` | Settings value accessor/getter |
| `HwA` | Settings initializer helper |
| `SH` | JSON serialization helper |
| `Z4` | Path/string normalization utility |
| `CJA` | Model-list mapper |
| `q` | File-system unlink / path utility |
| `A` | String lowercasing / path utility |
| `imH` | Output writer (renders result to UI) |
| `GJA` | Stream/handle write helper |
| `IBK` | Transcript/log persistence orchestrator |
| `WmH` | Batched-write / debounce scheduler |
| `_3H` | Log-file path builder |
| `F6` | File path resolver |
| `d46` | File-write error classifier (EISDIR guard) |
| `BJA` | Settings file path builder |
| `UJA` | Atomic file rename/unlink helper |
| `NBK` | Append-file writer with mkdir |
| `Y9` | Hook registration entry point |
| `s$` | State-getter utility |
| `ne` | Feature-flag set membership checker |
| `Ij` | String replacement helper |
| `lq` | Model-ID parsing / provider resolution dispatcher |
| `xHH` | Model string parser (top-level) |
| `NT` | Parsed model token type |
| `o9H` | Model parse sub-routine |
| `nQ` | Model name normalizer (anthropic. prefix, alias expansion) |
| `s9` | Full model-ID resolver |
| `x0` | Model-ID lookup in registry |
| `NKH` | Known-invalid model prefix checker |
| `aN` | Provider selector (firstParty path) |
| `CgH` | Provider selector (alternate path) |
| `KG` | Provider resolver (firstParty / Vf) |
| `Xwq` | Provider resolver wrapper |
| `UM` | Provider type finalizer |
| `Us6` | Provider include-list checker |
| `bgH` | pH wrapper/renderer |
| `xP` | Model resolution with fast-mode annotation |
| `b0` | Full model metadata assembler |
| `t6` | Bootstrap fetch orchestrator |
| `d` | Core telemetry emitter |
| `h1H` | Telemetry event dispatcher |
| `Xa8` | Telemetry payload builder |
| `DS8` | Model display / current-model renderer |
| `VS` | Model state reader |
| `k36` | Model-from-state extractor |
| `dO` | State object accessor |
| `$6K` | Alias-resolution and 1M-variant router |
| `zS8` | Model-switch outcome router |
| `RH` | Model-switch renderer (success path) |
| `vvf` | Opus 1M availability checker |
| `da` | kKH/wA/$u9 provider chain (Bedrock/Vertex path) |
| `sX` | Provider/model-ID linker |
| `Nvf` | Sonnet 1M availability checker |
| `s7H` | Sonnet provider chain helper |
| `Vvf` | Generic 1M prefix checker (vKH list) |
| `$S8` | API validation probe orchestrator |
| `gu` | Core async API-call executor |
| `Tvf` | Validation response parser / error extractor |
| `TH` | String coercion wrapper |
| `N9A` | Model application + confirmation renderer |
| `yh6` | Settings persistence coordinator |
| `l_` | Settings file reader/writer |
| `hH` | Feature-ok/bad/sad telemetry emitter |
| `rK` | PA/pH provider renderer |
| `PA` | Provider-to-display-string mapper |
| `pH` | String cast utility (wraps `String()`) |
| `yzH` | Fast-mode annotation helper |
| `a3` | Model metadata builder (rK + b0 + s9) |
| `p2H` | Model resolution with usage-credit annotation |
| `wA` | Provider kind classifier (KD/SR/Bq) |
| `I9A` | Confirmation UI renderer |
| `KTH` | JV/m8 model-display formatter |
| `m8` | xd6/TQ model-token formatter |
| `wx` | Path joiner (.claude dir) |
| `Gr` | NKH/dO/s9 provider display resolver |