---
type: feature-spec
feature: "advisor"
cc_version: "2.1.181"
updated: "2026-06-19"
tags: ["advisor", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.181 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/advisor`

> Analysis basis: CC v2.1.181 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.181

---

## Overview

The `/advisor` command allows Claude Code to consult a stronger or alternative model at key decision moments during a session. It accepts a model name (or alias) as an argument, validates and resolves it against a known set of Claude model identifiers, and then dispatches a side-query to the selected advisor model — returning its response as supplementary guidance within the current conversation. The command is rendered as a local JSX component and is backed by an async handler that wraps the full Anthropic SDK request pipeline.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `advisor` |
| description | `Let Claude consult a stronger model at key moments` |
| argumentHint | `[ ... ]` |
| isHidden | `null` (not hidden) |
| module_id | `Uvl` |
| load_inline | `true` |
| loc_byte | `12879937` |
| loc_byte_end | `12880193` |
| loc_line | `8493` |
| arbor_handler.name | `Nif` |
| arbor_handler.fqn | `claude-2.1.181::Nif` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.181 bundle.js:+12879937

---

## Input Branching

The command's input processing involves more than three distinct paths based on argument content, model alias resolution, and advisor state transitions. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/advisor [argument]"] --> B{Argument present?}
    B -- No --> C[Render JSX component with current advisor state]
    B -- Yes --> D["Trim whitespace from argument (n.trim)"]
    D --> E{Argument is 'off' or 'unset'?}
    E -- Yes --> F[Disable advisor / clear advisor model setting]
    E -- No --> G["Normalize to lowercase (i.toLowerCase)"]
    G --> H{Matches known alias?}
    H -- "fable / fable-5 / fable_5" --> I["Resolve → claude-fable-5 / claude-mythos-5"]
    H -- "opus / opusplan / opus-4-* / opus_4_*" --> J["Resolve → appropriate claude-opus-4-x model"]
    H -- "sonnet / sonnet-4-* / sonnet_4_*" --> K["Resolve → appropriate claude-sonnet-4-x model"]
    H -- "haiku" --> L["Resolve → claude-haiku-4-5"]
    H -- "best" --> M["Resolve → highest-ranked available model"]
    H -- Direct model string prefix 'claude-'" --> N["Validate model string via model validator (R5t)"]
    H -- Unknown alias --> O["Reject: display error message"]
    I & J & K & L & M & N --> P{Model validation passes?}
    P -- No --> Q["Emit error: 'Model name cannot be empty' or auth/network error"]
    P -- Yes --> R{Model already in Uol cache?}
    R -- Yes --> S["Return cached resolution"]
    R -- No --> T["Run model validation query (m6 / side_query)"]
    T --> U{API response ok?}
    U -- "not_found_error" --> V["Emit 'model:' prefixed error"]
    U -- "Auth failure" --> W["Emit authentication error"]
    U -- "Network error" --> X["Emit network error"]
    U -- Success --> Y["Store result in Uol cache (Uol.set)"]
    Y --> Z["Update advisor model in app state; re-render JSX"]
    Z --> AA["Dispatch side_query to advisor model via Rj pipeline"]
    AA --> AB["Stream response; surface to UI"]
```

Analysis basis: CC v2.1.181 bundle.js:+12879937, +12879385, +12879461, +12879472, +11286644, +8775285

---

## Behavioral Spec

### Top-Level Handler — `advisorCommandHandler` (bundle: `Nif`)

The main handler is an `AsyncFunction` resolved via `module_id` path from module `Uvl`.

```
async function advisorCommandHandler(argumentString, appContext):
    rawArg = trim(argumentString)            // n.trim @ +12879385

    if rawArg == "off" or rawArg == "unset": // literals @ +12879461, +12879472
        disableAdvisor(appContext)
        return renderAdvisorJSX(appContext)  // XI.createElement @ +12879421

    normalizedArg = rawArg.toLowerCase()

    resolvedModelId = resolveModelAlias(normalizedArg)  // gs @ +12879539

    if resolvedModelId is null:
        return renderError("Unknown model alias or invalid model name")

    validatedModel = validateAndCacheModel(resolvedModelId, appContext)  // R5t @ +12879553

    if validatedModel is error:
        return renderError(validatedModel.message)

    appContext.advisorModel = validatedModel

    renderAdvisorJSX(appContext)             // e @ +12879579, Bxe @ +12879627
    scheduleAdvisorSideQuery(appContext)     // Rlt @ +12879700
```

Analysis basis: CC v2.1.181 bundle.js:+12879385, +12879421, +12879539, +12879553, +12879579, +12879627, +12879700

---

### Model Alias Resolution — `resolveModelAlias` (bundle: `gs`)

This function accepts a normalized (lowercased, trimmed) string and maps it to a canonical model identifier. It checks a set of known short names and aliases before falling back to a raw model string check.

```
function resolveModelAlias(normalizedInput):
    // Provider prefix stripping (nc @ +2288632)
    strippedInput = stripProviderPrefix(normalizedInput)

    // Alias table lookups
    if strippedInput in ["fable", "fable-5", "fable_5"]:
        return "claude-fable-5"              // literal @ +2288670, +11287962

    if strippedInput in ["opusplan", "[1m]"]:
        return resolveOpusPlanModel()        // literal @ +2288732, +2288717

    if strippedInput == "sonnet":
        return resolveLatestSonnet()         // literal @ +2288773

    if strippedInput == "haiku":
        return resolveLatestHaiku()          // literal @ +2288812

    if strippedInput == "opus":
        return resolveLatestOpus()           // literal @ +2288851

    if strippedInput == "best":
        return resolveBestAvailableModel()   // literal @ +2288885

    // Provider-specific routing (RU @ +2288980)
    if providerContext in ["anthropicAws", "gateway", "firstParty",
                           "bedrock", "foundry", "mantle", "vertex"]:
        return routeToProviderModel(strippedInput)

    // Fall through: pass raw input onward
    return strippedInput
```

The function also normalises provider-tagged model strings (e.g. `anthropic.` prefixes) via `Wwu` (starts-with check at +2123756) and resolves AWS Bedrock application inference profiles via the `"application-inference-profile"` string (+2286342).

Analysis basis: CC v2.1.181 bundle.js:+2288593, +2288622, +2288670, +2288732, +2288773, +2288812, +2288851, +2288885, +2288980

---

### Model Validator and Cache — `validateAndCacheModel` (bundle: `R5t`)

Validates a resolved model identifier string, with caching to avoid redundant round-trips.

```
async function validateAndCacheModel(modelId, appContext):
    trimmedId = trim(modelId)               // e.trim @ +11286607

    if trimmedId is empty:
        throw Error("Model name cannot be empty")  // literal @ +11286644

    normalizedId = trimmedId.toLowerCase()  // n.toLowerCase @ +11286792

    if normalizedId in P1e (unsupported model list):  // P1e.includes @ +11286811
        throw Error("Model not supported")

    if Uol.has(normalizedId):               // Uol.has @ +11286913
        return Uol.get(normalizedId)        // cache hit

    // Run validation side-query
    validationPayload = buildValidationPayload(normalizedId, appContext)  // m6 @ +11286958

    try:
        result = await dispatchSideQuery(validationPayload)
        Uol.set(normalizedId, result)       // Uol.set @ +11287121
        return result
    catch authError:
        throw Error("Authentication failed. Please check your API credentials.")
                                            // literal @ +11287380
    catch networkError:
        throw Error("Network error. Please check your internet connection.")
                                            // literal @ +11287482
    catch apiError where apiError.type == "not_found_error":
                                            // literal @ +11287601
        throw Error("model:" + normalizedId + " not found")
                                            // literal @ +11287683
```

Model validation uses a lightweight `"model_validation"` query type (literal +11287008) with a minimal `"Hi"` prompt (literal +11287077) and `"ephemeral"` cache control (literal +11287102).

Analysis basis: CC v2.1.181 bundle.js:+11286607, +11286644, +11286792, +11286811, +11286913, +11286958, +11287121, +11287380, +11287482, +11287601, +11287683

---

### Side-Query Dispatch Pipeline — `dispatchSideQuery` (bundle: `m6` → `Rj`)

The core API call chain that sends the advisor query to the selected model.

```
async function dispatchSideQuery(payload):
    // Tag the query type
    payload.queryType = "side_query"        // literal @ +8775285

    // Resolve model and provider config
    providerConfig = resolveProviderConfig(payload.modelId)  // _Ue @ +8775399

    // Build request headers
    headers = buildHeaders(payload, providerConfig)  // Rj @ +8775253 (via _m @ +8775240)

    // Structured outputs check
    if supportsStructuredOutputs(providerConfig):  // literal @ +8775413
        payload.structured_outputs = true

    // Attach cache control hint ("1h")
    payload.cacheControl = "1h"             // literal @ +8776174

    // Execute request via Anthropic SDK request runner (Rj)
    response = await apiRequestRunner(headers, payload)

    // On lone-surrogate characters in response, sanitize them
    // [telemetry: tengu_lone_surrogate_sanitized @ +8776652]

    // Record success
    // [telemetry: tengu_api_success @ +8776956]

    return response
```

The `apiRequestRunner` (bundle: `Rj`) at +8775253 orchestrates:
- OAuth token refresh check (literal `"[API:auth] OAuth token check starting"` +3013139)
- Header assembly including `User-Agent`, `X-Claude-Code-Session-Id`, `x-app`, `x-client-app`, `x-claude-code-agent-id` (+3012584, +3012602, +3012556, +3012726, +3012760)
- SSE stream parsing (literal `"text/event-stream"` +3021748)
- Timeout at 600,000 ms (10 minutes) (+3013511) with retry limit 10 (+3013519)
- Cloud gateway session expiry detection (literal `"Cloud gateway session expired — run /login to reconnect."` +3013720)

Analysis basis: CC v2.1.181 bundle.js:+8775285, +8775399, +8775413, +8776174, +8776652, +8776956, +8775253, +3013511, +3013519, +3013720

---

### JSX Rendering and Advisor UI — `renderAdvisorComponent` (bundle: `Bxe`)

After state update, the command renders a JSX component that displays the current advisor model status and streams the advisor's response.

```
function renderAdvisorComponent(appContext):
    // Parse token context for conversation window
    tokenContext = buildConversationContext(appContext)  // Tl @ +8904932

    // Format model display string
    displayModel = formatModelName(appContext.advisorModel)  // Go @ +8905013

    // Build message context for side query
    messageContext = buildMessageContext(tokenContext, displayModel)  // wso @ +8905021

    return JSXElement(
        type: "advisor-panel",
        props: {
            advisorModel: displayModel,
            conversationContext: tokenContext,
            streamingResponse: messageContext.stream
        }
    )
```

Analysis basis: CC v2.1.181 bundle.js:+8904932, +8905013, +8905021, +12879421, +12879627

---

### Advisor Query Scheduler — `scheduleAdvisorQuery` (bundle: `Rlt`)

Determines when and which advisor invocations to run, filtering the registered advisor pool.

```
function scheduleAdvisorQuery(appContext):
    // Filter active advisors
    activeAdvisors = a_p.filter(isActive)   // a_p.filter @ +8904888

    for each advisor in activeAdvisors:
        advisorFn = buildAdvisorFn(advisor)  // kFn @ +8904904
        result = advisorFn(appContext)        // Bxe @ +8904851, Tf @ +8904855, gs @ +8904858
        emit(result)
```

Analysis basis: CC v2.1.181 bundle.js:+8904888, +8904904, +8904851, +8904855, +8904858

---

### Known Model Roster

The following canonical model identifiers are recognized and referenced in the alias resolution and provider-routing logic (literals extracted from bundle):

| Alias / Short Name | Resolved Canonical Model |
|---|---|
| `fable`, `fable-5`, `fable_5` | `claude-fable-5` (+2288670) |
| `best` | `claude-mythos-5` or highest ranked (+2288885) |
| `opusplan`, `[1m]` | `claude-opus-4-8` (+2285317) range |
| `opus-4-8`, `opus_4_8` | `claude-opus-4-8` (+2285317) |
| `opus-4-7`, `opus_4_7` | `claude-opus-4-7` (+2285374) |
| `opus-4-6`, `opus_4_6` | `claude-opus-4-6` (+2285431) |
| `opus-4-5`, `opus_4_5` | `claude-opus-4-5` (+2285488) |
| `opus-4-1` | `claude-opus-4-1` (+2285545) |
| `opus-4-0` | `claude-opus-4-0` (+2285634) |
| `sonnet-4-6`, `sonnet_4_6` | `claude-sonnet-4-6` (+2285666) |
| `sonnet-4-5`, `sonnet_4_5` | `claude-sonnet-4-5` (+2285727) |
| `sonnet-4-0` | `claude-sonnet-4-0` (+2285822) |
| `haiku` | `claude-haiku-4-5` (+2285856) |
| `claude-3-7-sonnet` | `claude-3-7-sonnet` (+2285915) |
| `claude-3-5-sonnet` | `claude-3-5-sonnet` (+2285976) |
| `claude-3-5-haiku` | `claude-3-5-haiku` (+2286037) |
| `claude-3-opus` | `claude-3-opus` (+2286096) |
| `claude-3-sonnet` | `claude-3-sonnet` (+2286149) |
| `claude-3-haiku` | `claude-3-haiku` (+2286206) |
| `claude-mythos-preview` | `claude-mythos-preview` (+3024779) |
| `claude-fable-5` | `claude-fable-5` (+2273402) |

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_api_success` (+8776956) — fired on successful advisor API response |
| Telemetry | `tengu_lone_surrogate_sanitized` (+8776652) — fired when response contains lone Unicode surrogates that are sanitized |
| Telemetry | `tengu_prompt_cache_1h_config` (+13696975) — fired when 1-hour cache control is applied to the advisor request |
| Telemetry | `tengu_scheduled_task_fire` (+16571560) — background scheduler fires |
| Telemetry | `tengu_scheduled_task_missed` (+16570809) — scheduled task missed its window |
| Telemetry | `tengu_scheduled_task_expired` (+16571903) — scheduled task expired |
| Telemetry | `tengu_daemon_yield` (+17121597) — supervisor/daemon yields control |
| Telemetry | `tengu_bg_retire_grace_bridged_min` (+13267762) — background worker grace retirement |
| Telemetry | `tengu_bg_retire_pinned_low_mem` (+17106011) — pinned worker retired under low memory |
| Telemetry | `tengu_bg_attach_upgrade` (+13267834) — background worker upgraded on attach |
| Telemetry | `tengu_bg_prewarm_per_sweep` (+17106132) — background prewarm event per sweep cycle |
| Model cache | Validated model identifiers cached in `Uol` (Map); `Uol.has` / `Uol.set` at +11286913, +11287121 |
| appState changes | `advisorModel` field updated in application state after successful validation |
| API headers set | `User-Agent`, `X-Claude-Code-Session-Id`, `x-app`, `x-client-app`, `x-claude-code-agent-id`, `x-claude-code-parent-agent-id`, `X-Amzn-Bedrock-Service-Tier` |
| Request timeout | 600,000 ms (10 minutes) (+3013511) |
| Retry limit | 10 retries (+3013519) |
| Auth helper timeout | 30,000 ms (+1854828) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.181 | Initial analysis |

---

## Common Mistakes

1. **Passing an empty string as the model argument** — the validator rejects empty or whitespace-only input with "Model name cannot be empty" (+11286644). Always provide a non-empty alias or model ID.
2. **Using an unsupported or legacy model ID** — models in the `P1e` deny-list (checked at +11286811) are rejected silently. Use the known alias table above to select a supported model.
3. **Confusing `off` with `unset`** — both string literals (+12879461, +12879472) disable the advisor; neither is a model name. Passing them as an alias search will not match the alias table.
4. **Expecting synchronous model switching** — the command dispatches an async side-query; the advisor model is not available in the response of the current turn, only in subsequent turns after the state update completes.
5. **Using provider-prefixed model names on the wrong provider** — e.g., passing a Bedrock ARN form on a direct Anthropic API key setup. The `_Ue` / `Go` provider routing (+8775399, +3033959) must match the active provider or the request will fail.
6. **Expecting the command to be visible in `/help`** — `isHidden` is `null` in this version, which may render it unlisted depending on the help filter logic; use `/advisor` directly rather than discovering it via the command list.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Nif` | Top-level async handler for `/advisor` command (arbor_handler) |
| `gs` | Model alias resolution function |
| `R5t` | Model validator and cache lookup |
| `m6` | Side-query payload builder and API dispatch entry |
| `Rj` | Anthropic SDK API request runner (full HTTP pipeline) |
| `Bxe` | JSX advisor component renderer |
| `wso` | Message context builder for advisor stream |
| `Rlt` | Advisor query scheduler / pool filter |
| `kFn` | Per-advisor invocation builder (called by scheduler) |
| `Ps` | Process exit handler (CLI error path) |
| `eje` | CLI error emitter (called by Ps) |
| `JT` | CLI error formatter |
| `Tl` | Conversation/token context builder |
| `Go` | Model display name formatter / provider router |
| `RU` | Provider-aware model string resolver |
| `HH` | Model string normalization (prefix/provider stripping) |
| `b1e` | Object.values model enumeration helper |
| `Wwu` | String starts-with checker for provider prefixes |
| `XTt` | Runtime model resolution helper |
| `Nf` | Model metadata lookup |
| `Td` | Model type discriminator |
| `xr` | Runtime utility / assertion helper |
| `rt` | String coercion utility |
| `nc` | String normalization / replacement helper |
| `CR` | Provider inclusion checker |
| `mQ` | Model query builder |
| `XCr` | Extended model query resolver |
| `$It` | Model name replace/transform utility |
| `cL` | Cached lookup wrapper |
| `zcn` | Zone/context lookup helper |
| `sfe` | Secondary model resolution helper |
| `JCr` | Join/resolve model context |
| `hj` | Header join utility |
| `NE` | Model enumeration helper |
| `Pbe` | Provider-based model builder |
| `w2s` | Worker-to-model mapping resolver |
| `joe` | Job/request object builder |
| `qu` | Queue/context accessor |
| `ofe` | Output format evaluator |
| `Noe` | String includes checker (model list) |
| `e_` | Model string normalizer (lower+includes+replace) |
| `Ugt` | Model upgrade decision helper |
| `Tf` | Text replace/format utility |
| `wku` | Lowercase model key resolver |
| `DIt` | Deep model type inspector |
| `Cku` | Context key updater |
| `Iku` | Inline key updater |
| `rfe` | Result filter evaluator |
| `sYe` | String yield evaluator |
| `I2s` | Index-to-string mapper |
| `C2s` | Context-to-string mapper |
| `Tn` | Token normalizer |
| `w7e` | Worker/entry builder (Object.entries) |
| `Vcn` | Version/context normalizer |
| `O1e` | Ordered list evaluator |
| `_m` | Internal module loader |
| `Lt` | Lifecycle/load tracker |
| `DK` | Debug key accessor |
| `vRr` | Value range resolver (split/trim/slice) |
| `Ci` | Context initializer |
| `JK` | Join key builder |
| `rvr` | URL encode/replace helper |
| `I` | Identity/info builder (multi-purpose helper) |
| `Ch` | Auth check helper |
| `P2s` | Boolean predicate mapper |
| `uy` | User/auth context builder |
| `VH` | Version header accessor |
| `XGu` | Extended gateway URL builder |
| `Lr` | Logger/reporter |
| `csn` | Client session negotiator (trust+auth) |
| `rju` | Request job unit (SSE stream handler) |
| `b2` | Backend selector |
| `sy` | Session/auth handler |
| `nju` | Next job unit builder |
| `JGu` | Job gateway URL resolver |
| `Gbe` | Graceful backend evaluator |
| `Qtr` | Query timer (Date.now tracker) |
| `Bwt` | Backend worker transformer |
| `DTe` | Debug/trace error emitter |
| `oAn` | Output annotation builder |
| `M` | Main message dispatch loop |
| `k` | Write/output kernel |
| `w` | Window/focus state tracker |
| `v` | Value/result carrier |
| `Sre` | Source resolver (startsWith) |
| `Dv` | Background worker driver |
| `ob` | Output buffer handler |
| `jbe` | Job backend evaluator |
| `hYe` | HTTP yield evaluator (fetch pipeline) |
| `T` | Token/tick manager |
| `h` | Handle/session accessor |
| `a` | App state accessor |
| `_Ue` | Provider configuration resolver |
| `e1` | Extended runtime helper |
| `Voe` | Value object evaluator |
| `ggt` | Global get target |
| `Gvr` | Gateway value resolver |
| `_` | Global MCP/tool runner |
| `oht` | Object handler type |
| `ke` | Key evaluator / tool runner |
| `Ho` | Error/string handler |
| `Mgp` | Message/group processor |
| `Joo` | Job output object (SHA hash builder) |
| `oun` | Output unit normalizer |
| `hl` | Handle/label string helper |
| `nun` | Null/unit normalizer |
| `tvr` | Token version resolver |
| `IHn` | Internal handle normalizer |
| `d4e` | Depth-4 entry (cache/prompt handler) |
| `To` | Token/output container |
| `knr` | Key/node resolver |
| `ut` | Utility/task runner |
| `Dnr` | Debug/node resolver |
| `wR` | Worker runner |
| `BRr` | Backend resource resolver |
| `HUe` | Handle/unit evaluator |
| `L` | Loop/lifecycle manager (sweep scheduler) |
| `W` | Worker/clock manager |
| `Ujt` | Utility job tracker |
| `ZDl` | Zone/deadline limiter |
| `H$e` | Handle/file evaluator |
| `$` | Global set tracker |
| `qn` | Queue normalizer |
| `j` | Job/task identifier |
| `q` | Queue accessor |
| `lKn` | Loop key normalizer |
| `K` | Key/event handler |
| `gMa` | Global map accessor |
| `AAn` | Aggregate annotation builder |
| `Nv` | Node value mapper |
| `Rve` | Result value evaluator |
| `$j` | Random-bytes job builder |
| `kc` | Key context accessor |
| `Re` | Result emitter (JSON.stringify) |
| `t3o` | Token 3-object parser |
| `_7t` | Internal 7-token handler |
| `eU` | Entity updater (structuredClone) |
| `S7t` | String 7-token serializer |
| `y7t` | YAML 7-token transformer |
| `Qe` | Query evaluator |
| `Rht` | Root handle/runtime |
| `Wvr` | Worker version resolver |
| `KBs` | Key/block scanner |
| `jvr` | Job version resolver |
| `Uye` | User yield evaluator |
| `Ur` | User/runtime accessor |
| `X_` | Extended underscore helper |
| `us` | User/session helper |
| `Wkt` | Worker kit initializer |
| `k0i` | Key-zero initializer |
| `het` | Handle/entity tracker |
| `jkt` | Job kit tracker |
| `_F` | Internal function router (agent: prefix) |
| `Nfd` | Node/function descriptor |
| `Z2` | Zone-2 context (repl_main_thread) |
| `lgt` | Log/get tracker |
| `g6p` | Group-6 processor (model alias map) |
| `H6p` | Handle-6 processor (model validation helper) |
| `rYe` | Result yield evaluator |
| `Ycn` | Yield context normalizer |
| `pbt` | Payload builder type |
| `fbt` | Full builder type |
| `Tn` | Token normalizer |