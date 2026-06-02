---
type: feature-spec
feature: "advisor"
cc_version: "2.1.156"
updated: "2026-06-02"
tags: ["advisor", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.156 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/advisor`

> Analysis basis: CC v2.1.156 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.156

---

## Overview

The `/advisor` command opens a configuration interface for the **Advisor Tool**, which routes selected queries to a stronger (typically higher-capability) model at key decision points during a task. Users invoke it to choose which advisory model to use, or to disable the feature entirely. The command renders a JSX component that validates the chosen model and persists the selection to application state.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `advisor` |
| description | Configure the Advisor Tool to consult a stronger model for guidance at key moments during a task |
| loc_byte | `12346820` |
| loc_byte_end | `12347107` |
| loc_line | `9237` |
| argumentHint | `null` |
| isHidden | `null` |
| module_id | `Ji1` |
| load_inline | `true` |
| arbor_handler.name | `gf5` |
| arbor_handler.fqn | `claude-2.1.156::gf5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.156 bundle.js:+12346820

---

## Input Branching

The handler processes the user-supplied model string through multiple validation and normalization stages, each with at least two outcomes, for a total of five or more distinct branches. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/advisor invoked with input string]) --> B[Trim whitespace from input]
    B --> C{Input empty?}
    C -- Yes --> D[Show current advisor config / picker UI]
    C -- No --> E[Normalize: toLowerCase]
    E --> F{Alias match?}
    F -- "opusplan / sonnet / haiku / opus / best" --> G[Resolve canonical alias to model ID]
    F -- No alias --> H[Raw model string]
    G --> I[Validate model via API call]
    H --> I
    I --> J{Validation result}
    J -- "off / unset" --> K[Disable Advisor Tool — clear config]
    J -- Auth error --> L[Display: Authentication failed message]
    J -- Network error --> M[Display: Network error message]
    J -- not_found_error --> N[Display: model not found message]
    J -- Valid model --> O[Persist model selection to state via ziSet]
    O --> P[Re-render JSX component confirming selection]
    K --> P
```

Analysis basis: CC v2.1.156 bundle.js:+12346276, +12346352, +12346363, +12338535, +2189884, +2189925, +2189964, +2190003, +2190040, +12339234, +12339336, +12339455

---

## Behavioral Spec

### Top-level Handler (advisorCommandHandler)

The Arbor-resolved handler is `gf5` (AsyncFunction), entered via the `module_id` resolution path through module `Ji1`.

```
async function advisorCommandHandler(inputString, context):
    trimmedInput = inputString.trim()                        // +12346276

    jsxElement = createElement(AdvisorConfigComponent, {    // +12346312
        input: trimmedInput,
        context: context
    })

    modelResult = await resolveModelAlias(trimmedInput)     // +12346430

    if modelResult is valid:
        await validateAndPersistModel(modelResult)          // +12346444

    joinedResult = advisorModelList.join(separator)         // +12346587

    return jsxElement
```

Analysis basis: CC v2.1.156 bundle.js:+12346276, +12346312, +12346430, +12346444, +12346587

---

### Model Alias Resolution (resolveModelAlias)

This function normalizes human-friendly shorthand names to canonical model identifiers.

```
function resolveModelAlias(rawInput):
    normalized = rawInput.trim()                            // +2189788
    lowered = normalized.toLowerCase()                      // +2189799

    aliasMap = {
        "opusplan": <opus-plan model id>,                   // +2189884
        "sonnet":   <sonnet model id>,                      // +2189925
        "haiku":    <haiku model id>,                       // +2189964
        "opus":     <opus model id>,                        // +2190003
        "best":     <best available model id>               // +2190040
    }

    if lowered in aliasMap:
        return aliasMap[lowered]

    // Check provider-specific prefixes
    checkProviderModel(lowered)                             // +2190072

    // Apply any string replacements for model-name normalization
    result = normalized.replace(normalizationPattern, "")  // +2189827, +2190130

    return result
```

Analysis basis: CC v2.1.156 bundle.js:+2189788, +2189799, +2189863, +2189884, +2189925, +2189964, +2190003, +2190040, +2190086

---

### Model Validation and Persistence (validateAndPersistModel)

```
async function validateAndPersistModel(modelString, context):
    if modelString.trim() == "":
        throw Error("Model name cannot be empty")           // +12338535

    lowered = modelString.toLowerCase()                     // +12338658
    isKnownModel = knownModelList.includes(lowered)         // +12338677

    if modelString == "off" OR modelString == "unset":      // +12346352, +12346363
        clearAdvisorConfig(state)
        return

    if advisorModelSet.has(modelString):                    // +12338779
        // Already configured — skip re-validation
        advisorModelSet.set(modelString, cachedResult)      // +12338987
        return

    validationResult = await runModelValidation(modelString)  // +12338824
    // runModelValidation sends a lightweight side_query     // +13150309
    // to the API and checks the response

    switch validationResult.type:
        case "not_found_error":                             // +12339455
            display("model: " + modelString + " not found") // +12339537
            return
        case "auth_error":
            display("Authentication failed. Please check your API credentials.")  // +12339234
            return
        case "network_error":
            display("Network error. Please check your internet connection.")       // +12339336
            return
        default:
            // Valid — persist
            advisorModelSet.set(modelString, validationResult)  // +12338987
            persistModelValidation(modelString, "model_validation", "ephemeral")
            // "ephemeral" cache type used                  // +12338968
```

Analysis basis: CC v2.1.156 bundle.js:+12338535, +12338658, +12338677, +12338779, +12338824, +12338987, +12339028, +12339234, +12339336, +12339455, +12339537

---

### Model Validation Side Query (runModelValidation)

The validation delegates to the background query subsystem (`zu` / `backgroundQueryDispatcher`), which issues a `side_query` API call.

```
async function runModelValidation(modelString):
    // Fetch from background query dispatcher                // +13150277
    hashKey = computeHash(modelString, "sha256", "hex")     // +13105075, +13105090, +13105117
    
    if cachedResult exists for hashKey:
        return cachedResult
    
    response = await dispatchSideQuery({                    // +13150309
        model: modelString,
        type: "side_query",
        cacheTTL: "1h"                                      // +13151159
    })
    
    if response indicates success:
        emit telemetry("tengu_api_success")                 // +13151760
        return response
    
    return error response
```

Analysis basis: CC v2.1.156 bundle.js:+13150277, +13105075, +13151159, +13151760

---

### Model Name Normalization Helpers

Several alias helpers are active during resolution:

```
function checkProviderBelonging(modelId):
    // Checks provider strings:
    // "bedrock", "foundry", "anthropicAws", "mantle", "vertex", "firstParty"
    // +2044343, +2044393, +2044449, +2044503, +2044551, +2044560
    return providerTag

function checkAnthropicPrefix(modelId):
    // Returns true if modelId starts with "anthropic."   // +2183859
    // or starts with "claude-"                           // +2183480
    pass

function buildModelDisplayList(modelList):
    // Maps model entries, pads each entry to width 40    // +15504600
    // joins with ", "                                    // +12346587, +15182597
    // and "  " separator for display                     // +15502629
    return formattedString
```

Analysis basis: CC v2.1.156 bundle.js:+2044343, +2183859, +2183480, +15504600

---

### JSX Component Rendering (AdvisorConfigComponent)

The command renders a `local-jsx` component. The component:

1. Displays the current advisor model setting (or "off"/"unset" if disabled).
2. Shows a list of recognized alias shortcuts (`opusplan`, `sonnet`, `haiku`, `opus`, `best`).
3. Confirms the newly persisted model when a valid selection is made.
4. Shows inline error messages for auth, network, and not-found failures.

Analysis basis: CC v2.1.156 bundle.js:+12346312, +12346518, +12346470

---

### Provider and Model Family Filtering (SX6 / providerModelFilter)

```
function providerModelFilter(modelId, providerList):
    lowered = modelId.toLowerCase()                         // +5320936
    return providerList.includes(lowered)                   // +5320959
```

Recognized model family prefixes include:

- `"claude-3-"` (bundle.js:+2934110)
- `"claude-opus-4-0"` (bundle.js:+2934128)
- `"claude-sonnet-4-0"` (bundle.js:+2934151)
- `"claude-opus-4-1"` through `"claude-opus-4-6"` (bundle.js:+2934321–+2934367)
- `"claude-sonnet-4-5"`, `"claude-sonnet-4-6"` (bundle.js:+2934415, +2934440)
- `"claude-haiku-4-5"` (bundle.js:+2934465)

Shorthand alias tokens resolved by `Rf5` / modelAliasResolver:

- `"opus-4-8"` / `"opus_4_8"` (bundle.js:+12339804, +12339828)
- `"opus-4-7"` / `"opus_4_7"` (bundle.js:+12339873, +12339897)
- `"opus-4-6"` / `"opus_4_6"` (bundle.js:+12339942, +12339966)
- `"opus-4-5"` / `"opus_4_5"` (bundle.js:+12340011, +12340035)
- `"sonnet-4-6"` / `"sonnet_4_6"` (bundle.js:+12340080, +12340106)
- `"sonnet-4-5"` / `"sonnet_4_5"` (bundle.js:+12340155, +12340181)

Analysis basis: CC v2.1.156 bundle.js:+5320936, +12339804, +12340181

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_api_success` (+13151760); `tengu_prompt_cache_1h_config` (+13111463); `tengu_bg_dispatch_sigkill_escalate` (+15478865); `tengu_bg_dispatch_low_mem` (+15479444); `tengu_bg_spare_enable` (+15480139); `tengu_bg_spare_claim` (+15480260); `tengu_bg_spare_claim_fail` (+15480523); `tengu_bg_proto_mismatch` (+15467198); `tengu_bg_dispatch_stale_drop` (+15468437); `tengu_bg_attach_legacy_autorespawn` (+15470513); `tengu_bg_attach` (+15470924); `tengu_bg_attach_stall_gave_up` (+15471841); `tengu_bg_attach_stall_respawn` (+15472110); `tengu_bg_attach_kick` (+15473027) |
| Model persistence | On successful validation, the advisor model is written to the advisor model set (Map) keyed by model string, and persisted with `"ephemeral"` cache policy (+12338968, +12338987) |
| Advisor disabled | When input is `"off"` or `"unset"`, the advisor model config is cleared from state (+12346352, +12346363) |
| Side query API call | A `"side_query"`-typed background API call is dispatched to validate the model (+13150309); uses a 1-hour prompt-cache TTL (`"1h"`) (+13151159) |
| Hash cache | SHA-256 hex hash of the model string used as cache key for validation results (+13105075, +13105090) |
| appState changes | Advisor model selection persisted to shared app state via the advisor model Map |
| Sound | None detected |
| MCP state | MCP connection plumbing (vSH / JGK) is reachable from the call graph but is not a direct side effect of `/advisor`; it is part of the shared model-resolution infrastructure |

---

## Version History

| Version | Change |
|---|---|
| v2.1.156 | Initial analysis |

---

## Common Mistakes

1. **Using `"off"` and `"unset"` as model names**: These are reserved keywords that disable the Advisor Tool rather than selecting a model. Do not use them as literal model identifiers.
2. **Passing an empty string**: The validator explicitly rejects empty input with the message `"Model name cannot be empty"` (bundle.js:+12338535). Always supply a non-empty model name or alias.
3. **Expecting immediate cross-session persistence**: The validation result is stored with an `"ephemeral"` cache policy; it may not survive process restarts in all configurations.
4. **Using full Bedrock/Vertex ARNs directly**: These undergo prefix normalization (`"anthropic."`, `"claude-"` checks). Non-standard provider prefixes may be rejected or mapped unexpectedly.
5. **Confusing alias shortcuts with model IDs**: Aliases such as `"best"`, `"opus"`, `"sonnet"`, and `"haiku"` are resolved at runtime to canonical model IDs; the displayed name after confirmation will be the canonical ID, not the alias.
6. **Re-running `/advisor` to check status while validation is in flight**: The command dispatches an async side query; invoking it again before the first completes may produce race conditions in the model-set cache.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `gf5` | Top-level advisor command handler (AsyncFunction; Arbor-resolved entry point) |
| `e9` | Model alias resolution function |
| `lk8` | Model validation and persistence orchestrator |
| `WQ` | Model list builder / display formatter |
| `vSH` | MCP server connection manager |
| `JGK` | MCP connection result applicator |
| `Gm5` | MCP slot/client enumerator |
| `zu` | Background side-query dispatcher (main API call pathway) |
| `HU` | Core API request builder and sender |
| `SX6` | Provider model filter (toLowerCase + includes check) |
| `Rf5` | Model alias shorthand resolver (opus-4-x, sonnet-4-x mappings) |
| `Sf5` | Alias resolution wrapper calling Rf5 |
| `Hw` | Provider-type tagger (bedrock/vertex/firstParty etc.) |
| `GA` | Provider-tag normalizer |
| `M5` | Model metadata resolver |
| `GR4` | Model-metadata sub-resolver (delegates to GA, v96, Gi6, _1q) |
| `Gi6` | Model entry finder (searches known model list) |
| `hN` | Model info fetcher (calls Bf and M5) |
| `Bf` | Provider-label extractor |
| `y1H` | Allowlist inclusion checker |
| `ar6` | Provider inclusion guard |
| `UBH` | Model name sanitizer / string builder |
| `EZ` | Composed model-info aggregator (Bf + M5 + GA) |
| `L$q` | Model-info wrapper (calls EZ) |
| `pBH` | Alternative model-metadata path (calls M5) |
| `Ti6` | Object entries iterator helper |
| `mBH` | Model prefix inclusion checker |
| `K$q` | Model index lookup (mBH + indexOf) |
| `sx4` | Model-string switcher (routes to e9) |
| `tx4` | Model-string prefix handler (claude- prefix path) |
| `q$q` | Prefix start-check helper |
| `A` | Generic input / trimmed string variable (context-dependent) |
| `f` | Stream/file handle (context-dependent, also close operations) |
| `q` | Secondary handle / queue (context-dependent) |
| `L` | Set/Map tracker for active operations |
| `H` | Primary parameter variable (context-dependent) |
| `_` | Secondary parameter variable (context-dependent) |
| `j0` | String-to-ID converter |
| `S1H` | ID normalizer (delegates to xH) |
| `xH` | Low-level string coercion utility |
| `N` | Log-level / message formatter |
| `M` | MCP server map / slot manager |
| `$` | Cleanup / disposal helper |
| `K` | Padded-entry builder for display lists |
| `i_` | Object-property iterator base |
| `wc6` | Proxy auth helper runner |
| `AH7` | API response metadata extractor (cf-ray, content-type, etc.) |
| `TY` | Auth credential builder |
| `bP` | OAuth/API-key credential selector |
| `sBH` | WIF token exchange handler |
| `ho6` | WIF credentials resolver (fetch-based) |
| `te4` | Response stream handler |
| `IOH` | Timing / cache-control recorder |
| `Wm8` | Timestamp utility (Date.now wrapper) |
| `VO6` | Header normalizer (toLowerCase on keys) |
| `XzH` | SDK error logger |
| `OH8` | Response status checker |
| `vz` | Proxy-Authorization header injector |
| `se4` | Session/OAuth state emitter |
| `R` | Supervisor write stream |
| `h` | Away-summary focus tracker |
| `k` | Away-summary generator |
| `E` | Generic async task runner |
| `tWH` | Agent-thread identifier resolver |
| `a2` | Credential cache accessor |
| `T` | Remote-control token handler |
| `X` | Background daemon socket reader |
| `J` | Daemon socket / pipe handle |
| `w` | Background daemon process manager |
| `xf` | Socket framing finisher |
| `lU5` | Daemon protocol message dispatcher |
| `ZH` | String coercion utility (String wrapper) |
| `MEH` | Model eligibility filter (claude-3-, opus-4, sonnet-4 checks) |
| `O9` | Application-inference-profile checker |
| `eS` | Gateway provider resolver |
| `G` | Known-model registry / list |
| `LP5` | Side-query model finder |
| `oqA` | SHA-256 hash computer |
| `er6` | API call header assembler |
| `v1` | String ID builder |
| `sr6` | Async-local-storage context getter |
| `l88` | Prompt-cache entry builder |
| `ykH` | Prompt-cache 1h configuration applicator |
| `EA` | Cache-capable request builder |
| `am8` | Cache metadata tracker |
| `E6` | Cache deduplication checker |
| `sm8` | Cache-hit recorder |
| `SZ` | HIPAA-mode compliance filter |
| `I3_` | HIPAA-safe model checker |
| `fEH` | HIPAA policy enforcer |
| `NP` | Model-name replacer (applies normalization regex) |
| `GH8` | Temperature + model validation checker |
| `EP` | Message mapper |
| `gYH` | Request payload assembler |
| `RH` | JSON stringifier wrapper |
| `KU` | Random-bytes request ID generator |
| `b7` | Request metadata tagger |
| `kMH` | Rate-limit tracker |
| `d` | Generic timer/delay handle |
| `$J6` | Cache-control block builder |
| `Kf9` | Cache-block finalizer |
| `MJ6` | Cache-block metadata setter |
| `Hc` | Agent-type resolver (builtin/custom/main) |
| `ok7` | Agent-prefix parser |
| `F6H` | Agent-thread-type classifier |
| `hH` | Error logger with stack trace |
| `W96` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `Vb8` | Known-model list variant (secondary registry) |
| `nV6` | Model-list filter utility |
| `i_K` | Object-key iterator (alternate path) |
| `GJq` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `Avq` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `Jvq` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `KEH` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `MH8` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `$H8` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `DQ` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `lM6` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |