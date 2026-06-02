---
type: feature-spec
feature: "model"
cc_version: "2.1.158"
updated: "2026-06-02"
tags: ["model", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.158 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/model`

> Analysis basis: CC v2.1.158 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.158

---

## Overview

The `/model` command allows users to switch the active AI model used by Claude Code, either for the current session only or as a persistent default for future sessions. It accepts a model name or alias as its argument, validates the model against available options for the user's account tier, performs a lightweight API probe to confirm access, then updates application state and writes the selection to user settings if appropriate.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `model` |
| description | Set the AI model for Claude Code |
| argumentHint | `<model>` |
| supportsNonInteractive | `true` |
| module_id | `xo1` |
| load_inline | `true` |
| loc_byte | `12399783` |
| loc_byte_end | `12399957` |
| arbor_handler.name | `k$5` |
| arbor_handler.fqn | `claude-2.1.158::k$5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.158 bundle.js:+12399783

---

## Input Branching

There are more than three distinct paths through the handler depending on the argument supplied, the user's account tier, and whether the model passes API validation. A Mermaid flowchart is used below.

```mermaid
flowchart TD
    A(["/model &lt;arg&gt; invoked"]) --> B{Argument present\nand non-empty?}
    B -- No --> C[Print current model\nand available model list,\nthen return]
    B -- Yes --> D[Trim whitespace from argument]
    D --> E{Argument in\nallowed-model list\nxB6?}
    E -- No --> F[Read appState for\ncurrent model info]
    F --> G{Argument in\nrestricted list\nr$H?}
    G -- Yes --> H[Emit tengu_model_command_inline\ntelemetry, set model\nin session only]
    G -- No --> I[Call validateAndSetModel\n(Fr1 / modelSwitchHandler)]
    E -- Yes --> I
    I --> J[resolveModelAlias:\nexpand alias → canonical name]
    J --> K{Alias resolved to\n1M-context variant?}
    K -- Yes, Opus+1M --> L{Account supports\nOpus 1M?}
    L -- No --> M[Error: opus_1m_unavailable\nwith docs link]
    L -- Yes --> N[Continue]
    K -- Yes, Sonnet+1M --> O{Account supports\nSonnet 1M?}
    O -- No --> P[Error: sonnet_1m_unavailable\nwith docs link]
    O -- Yes --> N
    K -- No 1M --> N
    N --> Q[probeModelAccess:\nsend ephemeral 'Hi' message\nvia API]
    Q --> R{API result?}
    R -- Auth failure --> S[Error: check API credentials]
    R -- Network error --> T[Error: check internet connection]
    R -- not_found_error --> U[Error: invalid_model]
    R -- validate_exception --> V[Error: validate_exception]
    R -- Success --> W{saveAsDefault\nflag set?}
    W -- Yes --> X[Write model to userSettings\nor projectSettings via\nconfigWriter, emit model_set_default\ntelemetry, display '…saved as default']
    W -- No --> Y[Session-only update,\ndisplay '…for this session only']
    X --> Z[Update appState model,\nprint confirmation with\nfast-mode and billing annotations]
    Y --> Z
    Z --> AA([Done])
    M --> AA
    P --> AA
    S --> AA
    T --> AA
    U --> AA
    V --> AA
    H --> AA
    C --> AA
```

---

## Behavioral Spec

### 1. Entry Point — `commandHandler` (arbor: `k$5`)

The async handler `k$5` is the resolved entry point for `/model`.

```
async function commandHandler(args, context):
    rawArg = args.trim()                          // +12391390

    if rawArg is in allowedModelList(xB6):        // +12391406
        currentModel = context.getAppState().model // +12391429
        return listAvailableModels(currentModel)   // bk8, +12391473

    if rawArg is in restrictedInlineList(r$H):    // +12391493
        emit("tengu_model_command_inline")         // +12391548
        applyModelInlineSession(rawArg)
        return response(type="text")              // +12391457

    return validateAndSetModel(rawArg, context)   // Fr1, +12391613
```

Analysis basis: CC v2.1.158 bundle.js:+12391390

---

### 2. List Available Models — `listAvailableModels` (`bk8`)

When no argument is given or the argument matches the empty/list trigger, the handler calls `bk8`, which delegates to `MS` to build a display of available model names for the user's current account tier.

```
function listAvailableModels(currentModel):
    modelTable = buildModelTable(MS)     // +12357012
    return formatted text output         // +12357143
```

The table-building routine (`MS`) calls:
- `BM6` — resolves the model alias/display list, including the `opusplan` alias ("Opus in plan mode, else Sonnet") at `+2191305/+2191322`
- `E0` — resolves account-tier display labels (`max`, `team`, `default_claude_max_5x`, `enterprise`, `enterprise_usage_based`) at `+2962079/+2962150/+2962165/+2962260/+2962282`

Analysis basis: CC v2.1.158 bundle.js:+12357012

---

### 3. Alias Resolution — `resolveModelAlias` (`_1` / internal of `BM6`)

Named aliases are expanded to canonical model strings. Known aliases found in literals:

| Alias | Expansion / Meaning |
|---|---|
| `sonnet` | Canonical Sonnet model string |
| `haiku` | Canonical Haiku model string |
| `opus` | Canonical Opus model string |
| `best` | Best available model for account tier |
| `opusplan` | Opus in plan mode, else Sonnet |
| `[1m]` suffix | Extended 1M-context variant |

Resolution applies `trim()`, `toLowerCase()`, prefix/suffix normalization, and `replace()` to normalize user input before lookup.

```
function resolveModelAlias(input):
    normalized = input.trim().toLowerCase()       // +2192696, +2192707
    apply V0 prefix normalization                 // +2192725
    apply A.replace substitution                  // +2192735
    check i1H alias table                         // +2192771
    check UN fallback                             // +2192810
    check LFH, cG, AOq, iM, xo6, fFH tables      // +2192887..+2192994
    apply _.replace for final cleanup             // +2193038
    return canonicalModelString
```

Analysis basis: CC v2.1.158 bundle.js:+2192696

---

### 4. Model Validation and Setting — `validateAndSetModel` (`Fr1`)

This is the primary validation pathway invoked for all non-inline, non-list arguments.

```
async function validateAndSetModel(modelArg, context):
    // Step 1: build model candidates list
    candidateList = buildModelCandidates(U8A, modelArg)  // +12355589

    // Step 2: check 1M-context availability
    if modelArg resolves to Opus+1M variant:             // FM5 +12354844
        if not accountSupports1MOpus():
            return error("opus_1m_unavailable",
                "Opus with 1M context is not available…")  // +12354876/+12354914

    if modelArg resolves to Sonnet+1M variant:           // gM5 +12355061
        if not accountSupports1MSonnet():
            return error("sonnet_1m_unavailable",
                "Sonnet 4.6 with 1M context…")             // +12355093/+12355133

    // Step 3: check policy restrictions
    if modelSwitchNotAllowed(BM5):                       // +12355287
        return error("model_switch", "not_allowed")       // +12354714/+12354729

    // Step 4: resolve and validate model name
    canonicalName = resolveModelId(Rk8, modelArg)        // +12355332
    if canonicalName is empty:
        return error("Model name cannot be empty")        // +12352884

    // Step 5: API probe
    probeResult = probeModelAccess(Vu, canonicalName)    // +12353173
    handle probeResult (see §5)

    // Step 6: apply result
    applyModelSelection(B8A, canonicalName, saveDefault) // +12355658
```

Analysis basis: CC v2.1.158 bundle.js:+12355589

---

### 5. API Probe — `probeModelAccess` (`Vu`)

A lightweight "side query" is sent to the API with an ephemeral single-message payload (`"Hi"`) to verify that the model is accessible under the user's credentials.

```
async function probeModelAccess(canonicalModel):
    payload = {
        role: "user",
        content: "Hi",                     // +12353292
        cache_control: "ephemeral"         // +12353317
    }
    queryType = "side_query"               // +13164773
    maxTokens = 1024                       // +13164589

    response = await globalThis.fetch(apiEndpoint, payload)  // +13164826

    if authError:
        return "Authentication failed. Please check your API credentials."  // +12353583
    if networkError:
        return "Network error. Please check your internet connection."       // +12353685
    if response.type == "not_found_error" and "model:" in message:
        emit("model_validation" telemetry, reason="invalid_model")          // +12353223/+12355376
        return invalid_model error
    if validateException:
        emit("validate_exception" telemetry)                                 // +12355473
        return validation error
    if success:
        emit("tengu_api_success")                                            // +13166224
        return success
```

Analysis basis: CC v2.1.158 bundle.js:+13164826

---

### 6. Apply Model Selection — `applyModelSelection` (`B8A`)

After a successful probe, `B8A` writes the result to application state and settings, then composes the user-facing confirmation message.

```
function applyModelSelection(canonicalModel, saveAsDefault):
    updateAppState(model = canonicalModel)

    if saveAsDefault:
        writeToSettings(configWriter / U_, key="model", value=canonicalModel)
        // settings written to .claude/settings.json or settings.local.json
        emit("model_set_default" telemetry)           // +12356211
        suffix = " and saved as your default for new sessions"  // +12355853
    else:
        suffix = " for this session only"             // +12355899

    // Compose display annotations
    annotations = []
    if fastModeOn:
        annotations.append(" · Fast mode ON")         // +12356017
    if drawsFromCredits:
        annotations.append(" · Draws from usage credits")  // +12356068
    if fastModeOff:
        annotations.append(" · Fast mode OFF")        // +12356114

    if managedSettings:
        display("Managed settings")                   // +12356420

    display(bold(canonicalModel) + annotations + suffix)
```

Managed-settings detection reads from `policySettings` and `flagSettings` keys in the config layer (`U_`) at `+1228177/+1228199`.

Settings layers in priority order (from `U_` at `+1228239`):
1. `policySettings`
2. `flagSettings`
3. `projectSettings` (`.claude/settings.json`)
4. `localSettings` (`settings.local.json`)
5. `userSettings`

Analysis basis: CC v2.1.158 bundle.js:+12355658

---

### 7. Model Name Resolution Detail — `resolveModelId` (`Rk8`)

`Rk8` normalizes the raw user input through a candidate-list lookup using `bQ`:

```
function resolveModelId(rawInput):
    trimmed = rawInput.trim()                  // +12352847
    if trimmed is empty:
        return error("Model name cannot be empty")

    candidateIds = buildCandidates(bQ, trimmed)  // +12352918
    normalized = trimmed.toLowerCase()           // +12353007

    if normalized in knownPrefixList(n1H):       // +12353026
        // prefix match found
    if alreadyResolved(Br1.has):                 // +12353128
        return cached result (Br1.set)           // +12353336

    return validatedModelId
```

The candidate-building function `bQ` applies:
- `startsWith("anthropic.")` check (`+2186748/+2186761`)
- `startsWith("claude-")` check (`+2186382`)
- Provider-specific normalization for `bedrock`, `vertex`, `foundry`, `mantle` (`+2046248/+2046298/+2046408/+2046456`)
- Padding to 40-character width for display (`+15493384`)

Analysis basis: CC v2.1.158 bundle.js:+12352847

---

### 8. Account-Tier Display — `buildTierLabels` (`E0`)

`E0` maps internal account tier strings to display labels and determines which models are available per tier:

| Tier string | Display |
|---|---|
| `max` | Max plan |
| `team` | Team plan |
| `default_claude_max_5x` | Max (5×) plan |
| `enterprise` | Enterprise plan |
| `enterprise_usage_based` | Enterprise usage-based plan |

Provider affinity checked:
- `firstParty` (`+2189002`)
- `anthropicAws` (`+2046917`)
- `gateway` (`+2046937`)
- `bedrock` (`+2046248`)
- `vertex` (`+2046456`)

Analysis basis: CC v2.1.158 bundle.js:+12356821

---

### 9. Opus Plan Mode — special alias `opusplan`

The alias `opusplan` (literal at `+2191305`) maps to the display label "Opus in plan mode, else Sonnet" (`+2191322`). When active, the model selection logic routes plan-mode requests to Opus and all other requests to Sonnet. This is resolved inside `_1` / `li` using the `ZY` and `i1H` helpers.

Analysis basis: CC v2.1.158 bundle.js:+2191305

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_model_command_inline` | Fired when model is set via the inline/restricted path (`+12391548`) |
| Telemetry: `tengu_api_success` | Fired after a successful API probe response (`+13166224`) |
| Telemetry: `tengu_feature_ok` | Fired on successful handler completion (via `hH`, `+966033`) |
| Telemetry: `tengu_feature_bad` | Fired on handler error/exception (via `bH`, `+966091`) |
| appState changes | `model` field updated to canonical model name after successful validation |
| Settings write | When saving as default: writes `model` key to `.claude/settings.json` or `settings.local.json` via config-writer (`U_`) at `+1228239` |
| API side effect | Ephemeral single-turn "Hi" probe sent to the API for model validation (`+13164826`) |
| Cache | Resolved model IDs cached in `Br1` (Map, `has`/`set` at `+12353128/+12353336`) |
| Timing | `Math.random` + `setTimeout` jitter applied in retry/delay path of API caller (`H`, `+13423761/+13423798`) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.158 | Initial analysis |

---

## Common Mistakes

1. **Passing a model name that includes a provider prefix incorrectly**: The resolver normalizes `anthropic.` and `claude-` prefixes, but passing something like `anthropicaws/claude-opus` without the correct format may not match any candidate.
2. **Expecting 1M-context variants to work on all account tiers**: The `[1m]` suffix variants (`sonnet[1m]`, `sonnet-4-6[1m]`, Opus 1M) are gated by account capabilities; they will fail with a specific error and docs link if unavailable.
3. **Forgetting that session-only vs. default-save depends on a flag**: Without explicitly requesting a default save, the model switch applies only to the current session and is lost on restart.
4. **Assuming the command is synchronous**: The handler is an `AsyncFunction` (confirmed by `arbor_handler.kind`). In non-interactive mode (`supportsNonInteractive: true`), the caller must await the result.
5. **Using the `opusplan` alias expecting a single fixed model**: `opusplan` is dynamic — it routes to Opus during plan-mode tasks and falls back to Sonnet otherwise.
6. **Typos in model names**: An unrecognized model name will trigger an API probe that returns `not_found_error`; the error message includes the `"model:"` substring to identify it as a model-not-found error rather than a generic API failure.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `k$5` | Main command handler (`commandHandler`), async entry point for `/model` |
| `H` | Utility / string helper; also retry-with-jitter caller (calls `Math.random`, `setTimeout`) |
| `_` | General utility / app-state accessor |
| `bk8` | List-available-models display builder |
| `MS` | Model table builder; delegates to `BM6` and `E0` |
| `BM6` | Model alias list resolver; calls `ZY` and `_1` |
| `ZY` | Inner alias resolution helper |
| `_1` | Alias normalization and canonical-name mapper |
| `E0` | Account-tier label and model availability resolver |
| `GA` | Model group/category helper |
| `AHH` | Tier-specific model filter (calls `f1`) |
| `FOH` | Tier-specific model filter for `team` / `default_claude_max_5x` |
| `MFH` | Tier-specific model filter for `enterprise` / `enterprise_usage_based` |
| `cG` | Provider-type classifier (`firstParty`, `anthropicAws`, `gateway`) |
| `yP` | Model availability checker per account |
| `iM` | Provider-type sub-classifier |
| `WA` | Provider-type resolver (calls `CH`) |
| `w5` | Provider-type resolver for AWS/gateway variants |
| `UN` | Unified provider-type resolver (calls `iM`, `w5`) |
| `d` | Low-level error/diagnostic emitter |
| `Fr1` | `validateAndSetModel` — orchestrates validation and setting |
| `U8A` | Model-candidate builder and multi-step validation dispatcher |
| `bQ` | Model-string candidate list builder and normalizer |
| `A` | Candidate map helper (lowercase transform, 40-char padding) |
| `M` | Candidate cache entry helper |
| `K` | Display padding / column formatter |
| `q` | Candidate list helper / file-unlock utility |
| `Hr6` | Provider-entry enumerator |
| `KFH` | Inclusion-list checker (`Km4.includes`) |
| `_Oq` | Model index-of lookup helper |
| `Lm4` | Model inclusion/alias sub-resolver |
| `i1H` | Alias table lookup (`n1H.includes`) |
| `fm4` | Alias normalization with prefix check (`claude-` startsWith) |
| `bH` | Error path wrapper (emits `tengu_feature_bad`) |
| `FM5` | 1M Opus availability checker |
| `Da` | Account-capability sub-checker |
| `gM5` | 1M Sonnet availability checker |
| `XLH` | Account-capability sub-checker for Sonnet 1M |
| `BM5` | Policy restriction / model-switch-allowed checker |
| `Rk8` | Model name resolver and cache handler |
| `Vu` | API probe executor (ephemeral side query) |
| `pM5` | Post-probe result processor |
| `EH` | String coercion helper |
| `B8A` | Apply-model-selection: writes settings, updates state, formats output |
| `Vk6` | Settings writer dispatcher |
| `U_` | Config layer reader/writer (policySettings, userSettings, projectSettings, etc.) |
| `hH` | Success path wrapper (emits `tengu_feature_ok`) |
| `uK` | Display formatter helper |
| `CH` | String coercion/display helper |
| `pOH` | Annotation composer helper |
| `TY` | Model display-string builder (fast mode, credits annotations) |
| `ci` | Conditional display sub-formatter |
| `CPH` | Sonnet-specific display handler |
| `PX` | Model-display sub-formatter |
| `V0` | Prefix normalizer |
| `F8A` | Managed-settings display and settings-path reporter |
| `rGH` | Settings-path resolver |
| `y8` | Settings file path builder |
| `lb` | Path joiner (`.claude/settings.json`) |
| `li` | Alias-to-display-label mapper (Opus Plan) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.