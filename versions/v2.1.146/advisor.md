---
type: feature-spec
feature: "advisor"
cc_version: "2.1.146"
updated: "2026-06-01"
tags: ["advisor", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.146 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/advisor`

> Analysis basis: CC v2.1.146 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.146

---

## Overview

The `/advisor` command configures the **Advisor Tool**, a feature that allows Claude Code to consult a stronger ("advisor") model for guidance at key decision points during a long-running task. When invoked, it renders a JSX configuration panel (type `local-jsx`) and, through its async handler, validates and persists the chosen model, resolving model aliases against a known alias table before applying the new setting.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `advisor` |
| description | Configure the Advisor Tool to consult a stronger model for guidance at key moments during a task |
| loc_byte | `12054491` |
| loc_byte_end | `12054778` |
| loc_line | `9944` |
| argumentHint | `null` |
| isHidden | `null` |
| module_id | `Ly1` |
| load_inline | `true` |
| arbor_handler.name | `QU7` |
| arbor_handler.fqn | `claude-2.1.146::QU7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.146 bundle.js:+12054491

---

## Input Branching

The handler has more than three distinct branching paths: empty/whitespace input, the special tokens `"off"` and `"unset"`, recognized model aliases (`"opusplan"`, `"sonnet"`, `"haiku"`, `"opus"`, `"best"`), a free-form model-name string that must survive validation, and an authentication/network error path during validation. A Mermaid flowchart is therefore used.

```mermaid
flowchart TD
    A(["/advisor called with argument string]) --> B{Trim whitespace}
    B --> C{Argument empty?}
    C -- yes --> D[Render JSX config panel\nshowing current advisor state]
    C -- no --> E{Argument is 'off' or 'unset'?}
    E -- yes --> F[Disable advisor tool\nclear stored model setting]
    E -- no --> G{Normalize to lowercase\ncheck alias table}
    G -- alias matched --> H[Resolve alias to\ncanonical model identifier]
    G -- no alias --> I[Use raw string as\ncandidate model name]
    H --> J[validateAdvisorModel:\nsend lightweight API call]
    I --> J
    J -- validation OK --> K[Persist model to\napp/project config\nshow success UI]
    J -- auth error --> L[Display auth error:\n'Authentication failed…']
    J -- network error --> M[Display network error:\n'Network error…']
    J -- not_found_error type --> N[Display 'model: …'\nnot-found message]
    K --> O([Done])
    F --> O
    D --> O
    L --> O
    M --> O
    N --> O
```

Analysis basis: CC v2.1.146 bundle.js:+12053947, +12054023, +12054034, +12054101, +12054115

---

## Behavioral Spec

### 1. Entry Point — `advisorCommandHandler` (bundle ident: `QU7`)

The Arbor-resolved async handler `QU7` is the true entry point (resolution path: `module_id → Ly1`).

```
async function advisorCommandHandler(context, argument):
    rawInput = argument.trim()                        // +12053947
    if rawInput is empty:
        return renderAdvisorConfigPanel(context)      // +12053983

    normalizedInput = normalizeModelInput(rawInput)   // calls rq / gW8
    result = await validateAndApplyModel(normalizedInput, context)
    return buildResultElement(result)                 // ej.createElement +12053983
```

Analysis basis: CC v2.1.146 bundle.js:+12053947, +12053983

---

### 2. Input Normalization — `normalizeModelInput` (bundle ident: `rq`)

Applies alias expansion, whitespace cleanup, and provider-prefix checks before the model string is used further.

```
function normalizeModelInput(input):
    trimmed  = input.trim()                           // +2164970
    lower    = trimmed.toLowerCase()                  // +2164981

    // Check for disable tokens
    if lower == "off" or lower == "unset":            // +12054023, +12054034
        return { action: "disable" }

    // Resolve short aliases to canonical names         // +2165066–2165236
    alias = lookupAlias(lower)
    // Known aliases (bundle literals):
    //   "opusplan" → internal alias   +2165066
    //   "sonnet"   → sonnet family    +2165107
    //   "haiku"    → haiku family     +2165146
    //   "opus"     → opus family      +2165185
    //   "best"     → best-available   +2165222
    if alias found:
        return { action: "set", model: alias.canonicalId }

    // Apply replacement / prefix rules               // +2165009, +2165045
    cleaned = input.replace(providerPrefixPattern, "")
    if not isValidProviderPrefix(cleaned):            // checkProviderPrefix +2165045
        cleaned = input

    return { action: "set", model: cleaned }
```

Analysis basis: CC v2.1.146 bundle.js:+2164970, +2164981, +2165009, +2165045, +2165066, +2165107, +2165146, +2165185, +2165222

---

### 3. Model Validation — `validateAndApplyAdvisorModel` (bundle ident: `gW8`)

Sends a lightweight "Hi" probe with an ephemeral cache-control block to the candidate model to verify it is accessible before saving the setting.

```
async function validateAndApplyAdvisorModel(normalizedModel, context):
    if normalizedModel.action == "disable":
        clearAdvisorModel(context)
        return { status: "disabled" }

    modelName = normalizedModel.model.trim()           // +12046536
    if modelName is empty:
        throw Error("Model name cannot be empty")      // +12046573

    lowerModel = modelName.toLowerCase()               // +12046696

    // Check against known-bad model set               // +12046715
    if lowerModel in disallowedModelsSet:              // G9H.includes +12046715
        return { status: "error", reason: "disallowed" }

    // Check in-memory cache of previously validated models  // +12046817
    if validationCache.has(lowerModel):               // Hy1.has
        applyModel(lowerModel, context)
        return { status: "ok", model: lowerModel }

    // Send probe API call: message "Hi" with ephemeral cache_control
    // Probe constants: content "Hi" (+12046981), cache_control "ephemeral" (+12047006)
    try:
        probeResult = await probeModelWithHi(lowerModel)  // bb +12046862
        // Telemetry: tengu_api_success (+12847042) on success
    catch AuthError:
        return { status: "error", message: "Authentication failed. Please check your API credentials." }
                                                           // +12047272
    catch NetworkError:
        return { status: "error", message: "Network error. Please check your internet connection." }
                                                           // +12047374
    catch APIError where error.type == "not_found_error":  // +12047493
        return { status: "error", message: "model: " + modelName }  // +12047575

    // Persist validated model
    validationCache.set(lowerModel, true)             // Hy1.set +12047025
    applyAdvisorModelConfig(lowerModel, context)      // SU7/RU7 +12047066
    return { status: "ok", model: lowerModel }
```

Analysis basis: CC v2.1.146 bundle.js:+12046536, +12046573, +12046696, +12046715, +12046817, +12046862, +12046981, +12047006, +12047025, +12047066, +12047272, +12047374, +12047493, +12047575

---

### 4. Model-Alias Resolution — `resolveModelAlias` (bundle ident: `RU7`)

Called from the config-apply path to translate human-readable short names (including versioned dash and underscore forms) into canonical API model IDs.

```
function resolveModelAlias(shortName):
    base = resolveBaseAlias(shortName)                // z3 +12047794
    lower = shortName.toLowerCase()                   // +12047812

    // Versioned opus aliases (dash and underscore forms)
    if lower includes "opus-4-7" or "opus_4_7":      // +12047842, +12047866
        return canonicalOpus47Id
    if lower includes "opus-4-6" or "opus_4_6":      // +12047911, +12047935
        return canonicalOpus46Id
    if lower includes "opus-4-5" or "opus_4_5":      // +12047980, +12048004
        return canonicalOpus45Id
    // Versioned sonnet aliases
    if lower includes "sonnet-4-6" or "sonnet_4_6":  // +12048049, +12048075
        return canonicalSonnet46Id
    if lower includes "sonnet-4-5" or "sonnet_4_5":  // +12048124, +12048150
        return canonicalSonnet45Id

    // Fall through to provider-level alias table     // pM +12047885
    return lookupProviderAlias(lower)
```

Analysis basis: CC v2.1.146 bundle.js:+12047794, +12047812, +12047842, +12047866, +12047885, +12047911, +12047935, +12047980, +12048004, +12048049, +12048075, +12048124, +12048150

---

### 5. Model Validation Telemetry — `recordModelValidationTelemetry` (bundle ident: `SU7`)

After successful alias resolution and validation, the result is recorded and configuration is persisted.

```
function applyAdvisorModelConfig(canonicalModel, context):
    // Record telemetry event "model_validation"       // +12046912
    recordTelemetryEvent("model_validation", { model: canonicalModel })
    // Write to project / global config via pM         // +12047885
    persistAdvisorModelSetting(canonicalModel)
```

Analysis basis: CC v2.1.146 bundle.js:+12046912, +12047885

---

### 6. Side-Query API Probe — `probeModelWithHi` (bundle ident: `bb`)

Runs the lightweight validation call. Uses `side_query` telemetry key and enforces a 1 024-token safety cap on the probe response.

```
async function probeModelWithHi(modelId):
    // Token cap: 1024 (+12845407)
    // x-app header: "side_query" (+12845591)
    // Message content: "Hi" probe (literal +12046981)
    // cache_control: "ephemeral" (+12047006)

    messages = [{ role: "user", content: [{ type: "text", text: "Hi",
                                             cache_control: { type: "ephemeral" } }] }]
    request = buildAPIRequest(modelId, messages, maxTokens=1024)
    addHeader(request, "x-app", "side_query")

    response = await globalThis.fetch(request)         // +12845644
    // Telemetry on success: tengu_api_success          // +12847042
    return parseProbeResponse(response)
```

Analysis basis: CC v2.1.146 bundle.js:+12845407, +12845591, +12845644, +12846981, +12847042

---

### 7. Provider-Level Alias Table — `lookupProviderAlias` (bundle ident: `pM`)

Checks the current provider context and maps generic aliases to provider-specific model IDs.

```
function lookupProviderAlias(alias):
    provider = getProviderFromContext()   // Zg6 / hA
    // Recognized providers (literals found in traversal):
    //   "bedrock"      +2023140
    //   "foundry"      +2023190
    //   "anthropicAws" +2023246
    //   "mantle"       +2023300
    //   "vertex"       +2023348
    //   "firstParty"   +2023357
    //   "gateway"      +2023829

    // Map alias × provider → canonical model id
    entry = modelAliasTable.find(provider, alias)   // Zg6.find +2024336
    if entry:
        return entry.canonicalId
    return alias   // pass-through if unknown
```

Analysis basis: CC v2.1.146 bundle.js:+2023140, +2023190, +2023246, +2023300, +2023348, +2023357, +2023829, +2024336

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_api_success` | Fired when the model probe HTTP call succeeds (bundle.js:+12847042) |
| Telemetry — `tengu_prompt_cache_1h_config` | Fired when a 1-hour prompt-cache configuration is active during the probe (bundle.js:+12806676) |
| Telemetry — `tengu_bg_*` (multiple) | Background-daemon lifecycle events (`dispatch_sigkill_escalate`, `dispatch_low_mem`, `spare_enable`, `spare_claim`, `spare_claim_fail`, `proto_mismatch`, `dispatch_stale_drop`, `attach_legacy_autorespawn`, `attach`, `attach_stall_gave_up`, `attach_stall_respawn`, `attach_kick`) reachable via the daemon transport layer traversed by the probe call |
| Validation cache | In-memory `Map` (`Hy1`) keyed by lowercase model name; avoids repeated probe calls for already-validated models (bundle.js:+12046817, +12047025) |
| Config persistence | Successful validation writes the canonical model ID to the project/global advisor config via `pM` / `RU7` (bundle.js:+12047885) |
| Config cleared | Passing `"off"` or `"unset"` removes the advisor model setting from config (bundle.js:+12054023, +12054034) |
| JSX render | When called with no argument, returns a `local-jsx` component via `ej.createElement` (bundle.js:+12053983) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.146 | Initial analysis |

---

## Common Mistakes

1. **Passing an unsupported model name without checking aliases first.** The handler requires a non-empty string; any whitespace-only argument is treated as "show panel" rather than "set model". Pass the canonical model ID or a recognized alias (`sonnet`, `opus`, `haiku`, `best`, `opusplan`).
2. **Expecting instant config change without network access.** The command always fires a live HTTP probe ("Hi" message) against the target model before saving. In air-gapped or auth-expired environments the probe will fail with an authentication or network error and the config will **not** be updated.
3. **Using `/advisor off` vs `/advisor unset` interchangeably without understanding the distinction.** Both tokens disable the advisor tool, but they are separate literals; ensure the token is passed exactly (case-insensitive after trimming).
4. **Passing a versioned model name with underscores on a platform that expects dashes.** The alias resolver handles both `opus-4-7` and `opus_4_7` forms, but free-form strings that do not match either pattern bypass alias resolution and are sent raw to the API — which may respond with a `not_found_error`.
5. **Assuming no API calls are made for already-configured models.** The in-memory cache (`Hy1`) is session-scoped; a fresh Claude Code session will re-probe even previously accepted model names.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `QU7` | `advisorCommandHandler` — async top-level handler for `/advisor` (Arbor-resolved entry point) |
| `rq` | `normalizeModelInput` — trims, lowercases, and alias-expands the raw argument |
| `gW8` | `validateAndApplyAdvisorModel` — orchestrates the probe call and config persistence |
| `bb` | `probeModelWithHi` — sends the lightweight "Hi" API probe to validate the model |
| `SU7` | `applyAdvisorModelConfig` — records telemetry and writes the validated model to config |
| `RU7` | `resolveModelAlias` — maps versioned short names to canonical model IDs |
| `pM` | `lookupProviderAlias` — provider-aware alias → canonical model ID lookup |
| `Zg6` | `findProviderAliasEntry` — searches the alias table for a provider × alias pair |
| `hA` | `getProviderContext` — retrieves the active provider from application state |
| `Jv` | `buildAliasedModelDescriptor` — constructs the normalized model descriptor object |
| `jv` | `buildFallbackDescriptor` — fallback descriptor builder (shares logic with `Jv`) |
| `v_9` | `wrapDescriptorForProvider` — wraps descriptor with provider metadata |
| `aQ6` | `checkAllowedProviderList` — validates provider inclusion list |
| `zmH` | `encodeModelIdentifier` — low-level string encoding for model IDs |
| `ET` | `resolveExternalProvider` — resolves externally-configured provider settings |
| `V9H` | `expandProviderConfig` — expands provider config object |
| `mH` | `coerceToString` — wraps `String()` cast used throughout |
| `T9H` | `checkProviderPrefix` — checks whether a model string starts with a known provider prefix |
| `IF` | `getMcpModelList` — enumerates available models from MCP servers |
| `M` | `getMcpClientState` — retrieves live MCP client connection state |
| `_kH` | `buildMcpToolSet` — assembles tool descriptors from MCP server capabilities |
| `z4K` | `applyMcpUpdate` — applies an MCP configuration update to client state |
| `N` | `formatModelDisplayName` — formats a model ID for display |
| `$` | `getMcpServerStatus` — retrieves current MCP server status |
| `_O5` | `resolveMcpServerList` — builds the list of configured MCP servers |
| `Vg6` | `getProviderEntries` — returns `Object.entries` of the provider registry |
| `e_` | `iterateProviderRegistry` — iterates over registered providers |
| `$mH` | `checkAllowedModelList` — checks whether a model is in the allowed-model list |
| `V_9` | `findModelIndexInAllowed` — locates a model by index in the allowed list |
| `lJ4` | `resolveModelWithFallback` — resolves model with provider-fallback logic |
| `nJ4` | `resolveModelWithPrefixFallback` — resolves model checking `claude-` prefix |
| `Z_9` | `checkClaudePrefix` — checks whether a string starts with `"claude-"` |
| `Jm` | `anthropicApiRequestDispatch` — central Anthropic SDK HTTP dispatch function |
| `bb` | `probeModelWithHi` — (see above; also serves as the full side-query pipeline) |
| `VD` | `getAsyncLocalStore` — retrieves the current AsyncLocalStorage store |
| `lC4` | `parseContentTypeHeader` — splits and parses the HTTP `content-type` value |
| `Cq` | `getBgRequestContext` — retrieves `"bg"` / `"cli-bg"` app context tag |
| `Kn` | `getSdkUserAgent` — builds the `@anthropic-ai/claude-code` User-Agent string |
| `S6` | `getUvModule` — retrieves the `uv` native binding |
| `Es8` | `encodeUrlParam` — applies `encodeURIComponent` to URL path segments |
| `u3` | `buildLqRequest` — constructs the low-level request structure |
| `S_9` | `coerceToBoolean` — wraps `Boolean()` cast |
| `ID` | `buildApiHeaders` — assembles final HTTP headers including `ANTHROPIC_API_KEY` |
| `dC4` | `applyProxyAuthHeaders` — appends `Proxy-Authorization` helper headers |
| `WU6` | `runProxyAuthHelper` — executes the `proxyAuthHelper` with a 30 000 ms timeout |
| `rC4` | `streamApiResponse` — streams SSE / eventstream response from Anthropic API |
| `Jw` | `buildRequestMetadata` — constructs request-level metadata object |
| `gz` | `handleOAuthToken` — manages OAuth token refresh and `jC` header injection |
| `cC4` | `resolveAuthorizationHeader` — selects OAuth vs API-key authorization value |
| `f3H` | `recordRequestTimestamp` — stamps `Date.now()` on the request for latency tracking |
| `Kk8` | `getRequestStartTime` — returns `Date.now()` at request initiation |
| `d56` | `lowercaseHeaderKeys` — normalises response header keys to lowercase |
| `Lr6` | `buildStreamingPayload` — constructs the streaming request payload |
| `LXH` | `findModelCapabilityEntry` — looks up a model's capability entry in `YzK` |
| `Nv` | `buildModelRequestObject` — assembles the per-model API request body |
| `ZmH` | `resolveModelProvider` — determines the provider string for a given model |
| `Nd6` | `fetchWithWifCredentials` — handles WIF token exchange and credentialled fetch |
| `W` | `getRemoteControlToken` — retrieves `remoteControlAtStartup` token |
| `P` | `mcpTransportReader` — reads and buffers MCP stdio transport frames |
| `J` | `mcpTransportInstance` — the live MCP transport object |
| `w` | `bgDaemonWorkerManager` — manages background daemon worker processes |
| `Lf` | `mcpFrameFlush` — flushes a framed MCP message to the transport |
| `MY5` | `bgDaemonProtocolDispatch` — dispatches protocol messages to/from background daemon |
| `ZH` | `stringCoerce` — calls `String()` for safe coercion in transport layer |
| `fGH` | `checkModelSupportsFeature` — checks whether a model supports a given feature flag |
| `Eq` | `resolveModelFeatureFlags` — resolves feature flags for the active model |
| `Gh` | `getModelCapabilities` — retrieves capability descriptor via `hA` |
| `T` | `getDynamicToolSet` — retrieves the dynamic tool set including `z06` / `Yv8` |
| `Ka7` | `findMessageInHistory` — searches conversation history for a matching message |
| `Hr_` | `computeSha256Hash` — computes SHA-256 hex digest via `sp1.createHash` |
| `eQ6` | `buildConversationContext` — builds the conversation context block for the API |
| `fK` | `coerceStringField` — field-level `String()` coercion |
| `sQ6` | `getRequestStore` — retrieves `h_9` AsyncLocalStorage store |
| `ua6` | `appendSystemContent` — appends system content blocks via `hA` |
| `kVH` | `buildSideQueryRequest` — constructs the full side-query request object for advisor probe |
| `ZA` | `dispatchSideQueryRequest` — dispatches the side-query to the Anthropic API |
| `uk8` | `buildSideQueryHeaders` — builds HTTP headers specific to the side-query path |
| `N6` | `recordSideQueryTelemetry` — records `daemon_bg_session_create` / spare events |
| `mk8` | `validateSideQueryModel` — final model-string validation before side-query dispatch |
| `tE` | `handleSideQueryError` — maps API errors to user-facing messages for the advisor flow |
| `a9_` | `formatSideQueryError` — formats error payload via `hA` |
| `yU1` | `mapSideQueryResponse` — maps the raw API response to an advisor result object |
| `lP` | `sanitizeModelName` — applies regex replacement to sanitise a model name string |
| `Dr6` | `buildAdvisorApiPayload` — constructs the full API payload for the advisor probe |
| `f2` | `mapMessageContent` — maps message content blocks |
| `TOH` | `buildProbeMessage` — constructs the probe message object sent to the advisor model |
| `CH` | `jsonStringifyField` — wraps `JSON.stringify` for field serialization |
| `Gm` | `generateRequestId` — generates a random request ID via `oI9.randomBytes` |
| `y5` | `buildRequestContext` — builds the request context with `ID` and `m6` |
| `z5H` | `buildCacheControlBlock` — constructs the `cache_control` / `"1h"` block |
| `c` | `getActiveSession` — retrieves the currently active session object |
| `jZH` | `emitAdvisorTelemetry` — emits telemetry for the advisor configuration event |
| `n3L` | `checkAgentBuiltinPrefix` — checks for `"agent:builtin:"` prefix in agent IDs |
| `SH` | `recordTelemetryEvent` — core telemetry recording function using `mH` and `X1` |
| `zQ` | `resolveAgentPrefix` — resolves `"agent:custom:"` / `"agent:"` / `"main"` prefix |
| `l3L` | `parseAgentIdentifier` — parses agent identifier strings for prefix routing |
| `i66` | `finalizeAdvisorConfig` — performs final advisor config finalization step |
| `SU7` | `applyAdvisorModelConfig` — persists validated model and records telemetry |
| `RU7` | `resolveModelAlias` — (see above; called from `SU7`) |
| `CY6` | `checkAdvisorModelInclusion` — checks whether the resolved model is in the advisor inclusion list |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.