---
type: feature-spec
feature: "advisor"
cc_version: "2.1.163"
updated: "2026-06-05"
tags: ["advisor", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.163 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/advisor`

> Analysis basis: CC v2.1.163 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.163

---

## Overview

The `/advisor` command allows Claude Code to consult a stronger or more capable model at key decision points during a session. When invoked, it validates and resolves a target model name, constructs a side-query to that model, renders the response as a JSX component inline in the conversation, and exposes the result to the current agent context. This enables a lightweight advisor pattern where the primary agent can delegate complex sub-questions to a higher-capability model without interrupting the main conversation thread.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `advisor` |
| description | `Let Claude consult a stronger model at key moments` |
| module_id | `e1K` |
| load_inline | `true` |
| loc_byte | `12630723` |
| loc_byte_end | `12630964` |
| loc_line | `9063` |
| argumentHint | `null` |
| isHidden | `null` |
| arbor_handler.name | `oRf` |
| arbor_handler.fqn | `claude-2.1.163::oRf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.163 bundle.js:+12630723

---

## Input Branching

The command exhibits more than three distinct branches: it processes the user-supplied model name token, checks whether it is `"off"` or `"unset"`, validates it against a known model set, executes a model-validation probe if necessary, then dispatches the side-query or disables the advisor. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/advisor invoked"]) --> B["Trim input argument\n(oRf → A.trim)\nbundle.js:+12630179"]
    B --> C{Argument value?}
    C -- "\"off\" or \"unset\"\nbundle.js:+12630255,+12630266" --> D["Disable advisor\n(set state to off/unset)"]
    C -- "Non-empty model name" --> E["Lowercase + include-check\n(DC8 → H4H.includes)\nbundle.js:+12622579"]
    C -- "Empty after trim" --> F["Emit error:\n'Model name cannot be empty'\nbundle.js:+12622437"]
    E --> G{Known model alias?}
    G -- "Alias matched\n(opusplan/sonnet/haiku/opus/best)\nbundle.js:+2243249–2243405" --> H["Resolve canonical model ID\nvia model-alias resolver (Aq)\nbundle.js:+12630333"]
    G -- "Unknown / literal model ID" --> I["Run model-validation probe\n(DC8 → _m → validation subgraph)\nbundle.js:+12622726"]
    I --> J{Probe result?}
    J -- "Auth failure\nbundle.js:+12623136" --> K["Emit auth error to user"]
    J -- "Network error\nbundle.js:+12623238" --> L["Emit network error to user"]
    J -- "not_found_error\nbundle.js:+12623357" --> M["Emit model-not-found error\n'model:' prefix\nbundle.js:+12623439"]
    J -- "Success" --> N["Store validated model in r1K\nbundle.js:+12622889"]
    H --> N
    N --> O["Construct side-query\n(type='side_query')\nbundle.js:+13461248"]
    O --> P["Dispatch via cU (async API call)\nbundle.js:+12622726"]
    P --> Q["Render JSX response\n(NX.createElement)\nbundle.js:+12630215"]
    Q --> R["Join rendered lines\n(YaH.join)\nbundle.js:+12630490"]
    R --> S(["Return JSX component to UI"])
    D --> T(["Advisor disabled — no side-query"])
    F --> U(["Command exits with error"])
    K --> U
    L --> U
    M --> U
```

---

## Behavioral Spec

### Top-Level Handler: advisorCommandHandler (`oRf`)

Analysis basis: CC v2.1.163 bundle.js:+12630179

```
async function advisorCommandHandler(input, context):
    rawArg = input.trim()                          // oRf → A.trim @ +12630179

    if rawArg == "off" or rawArg == "unset":       // literals @ +12630255, +12630266
        disableAdvisor(context)
        return renderJSX("Advisor disabled")

    if rawArg == "":
        throw Error("Model name cannot be empty")  // literal @ +12622437

    modelToken = resolveModelAlias(rawArg)         // oRf → Aq @ +12630333
    validatedModel = validateModel(modelToken, context)  // oRf → DC8 @ +12630347

    responseLines = dispatchSideQuery(            // oRf → H @ +12630373
        model = validatedModel,
        context = context
    )

    rendered = NX.createElement(advisorResponseComponent, {
        lines: responseLines                       // oRf → NX.createElement @ +12630215
    })

    return rendered.join(YaH)                      // oRf → YaH.join @ +12630490
```

---

### Sub-feature: Model Alias Resolution (`Aq`)

Analysis basis: CC v2.1.163 bundle.js:+2243153

The alias resolver normalises the raw model token into a canonical API model identifier. It trims and lowercases the input, checks against a fixed set of short alias strings, then maps each alias to a full model name. Known aliases and their approximate canonical targets (from literals in the resolver region):

| Alias | Notes |
|---|---|
| `opusplan` | Resolves to an Opus-class planning model (bundle.js:+2243249) |
| `sonnet` | Resolves to current Sonnet model (bundle.js:+2243290) |
| `haiku` | Resolves to current Haiku model (bundle.js:+2243329) |
| `opus` | Resolves to current Opus model (bundle.js:+2243368) |
| `best` | Resolves to the strongest available model (bundle.js:+2243405) |
| `[1m]` | Internal marker used in resolver logic (bundle.js:+2243275) |

```
function resolveModelAlias(rawToken):
    token = rawToken.trim().toLowerCase()         // Aq → H.trim @ +2243153, Aq → _.toLowerCase @ +2243164
    if token matches known alias list:            // Aq → _4H @ +2243228
        return canonicalModelIdForAlias(token)    // Aq → wI, NE, kX1, NQH subtree
    token = applyReplacementRules(token)          // Aq → A.replace @ +2243192
    token = applyProviderPrefix(token)            // Aq → _.replace @ +2243495
    return token
```

Analysis basis: CC v2.1.163 bundle.js:+2243153

---

### Sub-feature: Model Validation Probe (`DC8`)

Analysis basis: CC v2.1.163 bundle.js:+12622400

When the model name is not a known alias, the handler runs a live probe to verify the model is accessible before committing. The probe:

1. Trims the candidate model name (DC8 → H.trim @ +12622400).
2. Lowercases and checks it against the internal model allow-list (`H4H.includes` @ +12622579).
3. Checks the already-validated model cache (`r1K.has` @ +12622681). If present, skips the probe.
4. Sends a minimal ephemeral validation request — a single short `"Hi"` message with `ephemeral` cache-control (literals @ +12622845, +12622870) — to the target model via the side-query API path (`_m`).
5. On success, stores the model in the validated cache (`r1K.set` @ +12622889).
6. Maps API error types (`not_found_error`, auth failures, network errors) to user-facing messages (literals @ +12623136, +12623238, +12623357).

```
async function validateModel(modelToken, context):
    modelToken = modelToken.trim()
    if isKnownModel(modelToken):                  // H4H.includes @ +12622579
        return modelToken
    if validatedModelCache.has(modelToken):       // r1K.has @ +12622681
        return modelToken

    probeResult = await runSideQuery(             // _m @ +12622726
        model = modelToken,
        messages = [{ role:"user", content:"Hi" }],   // literal @ +12622845
        cacheControl = "ephemeral",               // literal @ +12622870
        type = "model_validation"                 // literal @ +12622776
    )

    if probeResult.error:
        errorType = probeResult.error.type
        if errorType == "not_found_error":        // literal @ +12623357
            throw Error("model: " + modelToken)  // literal @ +12623439
        if isAuthError(probeResult):
            throw Error("Authentication failed. Please check your API credentials.")  // literal @ +12623136
        if isNetworkError(probeResult):
            throw Error("Network error. Please check your internet connection.")     // literal @ +12623238

    validatedModelCache.set(modelToken, true)     // r1K.set @ +12622889
    return modelToken
```

Analysis basis: CC v2.1.163 bundle.js:+12622400

---

### Sub-feature: Side-Query Dispatch (`_m` / `cU`)

Analysis basis: CC v2.1.163 bundle.js:+13461248

The side-query subsystem is the core execution path that actually sends the advisor request to the chosen model. Key behaviours:

- The query is labelled with type `"side_query"` (literal @ +13461248), distinguishing it from the main agent's conversation stream.
- It sets request headers including `X-Claude-Code-Session-Id`, `x-client-app`, and `x-claude-code-agent-id` (literals @ +2968484, +2968608, +2968642) to tag the request in API telemetry.
- Authentication follows the standard OAuth / API-key path (`cU → pr6 → JgH.trustAccepted` @ +1828478), including a proxy-auth helper check (literal @ +1828507).
- The token cache uses a 1-hour prompt-cache config (`tengu_prompt_cache_1h_config` event @ +13421426).
- The call enforces a maximum byte budget; `Buffer.byteLength` is used during context assembly (icK → Buffer.byteLength @ +205771), with limits of 1000 items and 100 per batch (literals @ +205882, +205901).
- Lone surrogates in returned content are sanitised before delivery (`tengu_lone_surrogate_sanitized` @ +13462578).
- On completion, a `tengu_api_success` event is fired (@ +13462829).

```
async function dispatchSideQuery(model, context):
    requestHeaders = buildRequestHeaders(context) // cU → tf_, xw, Z9 subtree
    authToken = await resolveAuth(context)        // cU → pr6, E.getToken

    payload = buildPayload(                       // nyH, iwH, b2A subtree
        model = model,
        messages = context.conversationMessages,
        type = "side_query",
        cachePolicy = "1h"
    )

    sanitizedPayload = sanitizeLoneSurrogates(payload)  // cV @ +13462125

    response = await callAPI(
        payload = sanitizedPayload,
        headers = requestHeaders,
        auth = authToken
    )

    emit("tengu_api_success")                     // @ +13462829
    return processResponse(response)              // nyH, D6, FQ8 subtree
```

Analysis basis: CC v2.1.163 bundle.js:+13461248

---

### Sub-feature: Model Name Normalisation Helpers

Analysis basis: CC v2.1.163 bundle.js:+2237197

Several helpers tidy the model name before and during routing:

- `startsWith("anthropic.")` check routes Anthropic-prefixed model names through a special normalisation branch (literal @ +2237210).
- `startsWith("claude-")` check identifies Anthropic Claude models (literal @ +2236831).
- Models matching the `application-inference-profile` prefix (literal @ +2241240) are handled by the profile resolution branch (`H9 → dQ8` @ +2241280).
- The versioned model list used for exact-match validation includes entries such as `"claude-opus-4-0"`, `"claude-sonnet-4-0"`, `"claude-opus-4-1"`, and newer variants through `"claude-sonnet-4-6"` and `"claude-haiku-4-5"` (literals @ +2986878 – +2987215).

```
function normaliseModelName(raw):
    if raw.startsWith("anthropic."):             // literal @ +2237210
        return handleAnthropicPrefixedModel(raw)
    if raw.startsWith("claude-"):                // literal @ +2236831
        return handleClaudeModel(raw)
    if raw.includes("application-inference-profile"):  // literal @ +2241240
        return resolveInferenceProfile(raw)
    return raw
```

Analysis basis: CC v2.1.163 bundle.js:+2237197

---

### Sub-feature: JSX Response Rendering

Analysis basis: CC v2.1.163 bundle.js:+12630215

The command is registered as `local-jsx`, so the final output is a React element tree rather than plain text. The handler calls `NX.createElement` (@ +12630215) to construct the component, passes the advisor's response lines as props, and then calls `YaH.join` (@ +12630490) on the rendered output to assemble the final displayable string. The `L06` helper performs a final lowercase / include-check on the joined output before it is returned to the shell (L06 → H.toLowerCase @ +5437660, L06 → _.includes @ +5437683).

```
function renderAdvisorResponse(responseData):
    element = NX.createElement(                  // @ +12630215
        AdvisorResponseComponent,
        { content: responseData }
    )
    joined = YaH.join(element)                   // @ +12630490
    return L06(joined)                           // final normalisation @ +12630421
```

Analysis basis: CC v2.1.163 bundle.js:+12630215

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_api_success` | Fired on successful side-query API completion (bundle.js:+13462829) |
| Telemetry — `tengu_lone_surrogate_sanitized` | Fired when lone Unicode surrogates are stripped from API response content (bundle.js:+13462578) |
| Telemetry — `tengu_prompt_cache_1h_config` | Fired when the 1-hour prompt-cache policy is applied to the side-query (bundle.js:+13421426) |
| Telemetry — `tengu_feature_sad` | Fired on certain feature-level failure paths within the call graph (bundle.js:+1010365) |
| Validated model cache (`r1K`) | Models that pass the validation probe are stored in a persistent in-process cache to avoid re-probing on subsequent `/advisor` calls (bundle.js:+12622681, +12622889) |
| Side-query API headers | Sets `X-Claude-Code-Session-Id`, `x-client-app`, `x-claude-code-agent-id`, `x-claude-code-parent-agent-id`, and related tracing headers on each advisor request (bundle.js:+2968484 – +2968705) |
| appState changes | Advisor on/off state is toggled when `"off"` or `"unset"` is passed as the argument (bundle.js:+12630255, +12630266) |
| Sound | None detected in depth-2 traversal |
| Hook registration | None detected in depth-2 traversal |
| Proxy-auth helper | If a `proxyAuthHelper` is configured in project/local settings but workspace trust has not been accepted, the helper is skipped with a warning (bundle.js:+1828507) |
| OAuth token check | Emits log lines `"[API:auth] OAuth token check starting"` and `"[API:auth] OAuth token check complete"` around each auth resolution (bundle.js:+2969021, +2969075) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.163 | Initial analysis |

---

## Common Mistakes

1. **Passing a model name that requires validation on a restricted network.** The validation probe sends a live `"Hi"` message to the target model. If the network cannot reach the Anthropic API, the command will fail with a network error rather than simply setting the advisor model. Ensure API connectivity before invoking `/advisor` with an unknown model name.

2. **Using `/advisor off` expecting immediate effect mid-turn.** The advisor state change takes effect for subsequent agent turns. If a side-query is already in flight, it will complete regardless.

3. **Expecting the advisor to replace the main model.** The command sets up a *consultation* path — the advisor model answers side-queries dispatched by the primary agent, not the main conversation messages. The primary model remains unchanged.

4. **Supplying an alias that looks like a version number.** Strings such as `"opus-4-8"` or `"sonnet-4-5"` are resolved through the alias-normalisation path (literals @ +12623706, +12624057), not directly as API model IDs. If the desired model is a precise API identifier, pass it in full (e.g., `"claude-opus-4-8"`) so it routes through the model-validation probe instead.

5. **Forgetting that the validated model cache persists for the session.** Once a model has been validated, subsequent `/advisor` calls with the same model name skip the probe. This means a model that becomes unavailable mid-session (e.g., due to quota expiry) will not be re-checked until the session is restarted.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `oRf` | Top-level async handler for `/advisor` command |
| `Aq` | Model alias resolver — maps short names to canonical model IDs |
| `DC8` | Model validation coordinator — trims, checks cache, runs probe |
| `_m` | Side-query dispatcher — assembles and sends the advisor API call |
| `cU` | Core async API client — handles auth, headers, HTTP transport |
| `L06` | Final output normaliser — lowercase/include-check on joined JSX output |
| `URf` | Model probe executor — wraps the validation sub-call |
| `BRf` | Model probe response mapper — maps probe result to validated model |
| `H` | Context/state accessor used throughout handler |
| `v` | Configuration reader — reads provider and model settings |
| `ccK` | Provider detection helper — identifies bedrock/vertex/etc. |
| `icK` | Context assembler — builds token-bounded message context |
| `yd` | Message formatter — maps conversation messages to API format |
| `M` | MCP server manager — accessed during context assembly |
| `AbH` | MCP connection enumerator — lists active MCP tool connections |
| `tU8` | MCP update applicator — applies connection result to app state |
| `VYA` | MCP retry coordinator — manages remote server recovery |
| `Bs6` | Structured object serialiser used in message assembly |
| `e_` | Entry serialiser helper |
| `VQH` | Model family membership checker |
| `IX1` | Model index lookup helper |
| `Q1L` | Model string inclusion checker |
| `d1L` | Model prefix dispatcher |
| `vX1` | Model startsWith helper |
| `wI` | Alias-to-model resolver for Opus/Sonnet family |
| `gM` | Provider-aware model resolver |
| `XA` | Model ID constructor |
| `Z5` | Model variant resolver |
| `O8L` | Model object builder |
| `T$1` | Model capability enumerator |
| `Us6` | Model selector using provider find |
| `NQH` | Model variant lookup for NQ family |
| `NE` | Model lookup combining provider and variant |
| `kX1` | Alias entry-point for NE resolution |
| `Pe6` | Provider list inclusion check |
| `vQH` | Model string value helper |
| `SH` | JSON serialiser utility |
| `J4` | Message trimming and slicing helper |
| `ppH` | Hash/encode helper |
| `Pw_` | Token splitter / trim-and-index helper |
| `ZHH` | Feature-flag set membership checker |
| `uj` | String replacement utility |
| `t1` | Message transformation pipeline |
| `D6H` | Message content builder |
| `eX` | Extended message formatter |
| `s6` | Telemetry feature reporter |
| `P6` | Feature logging helper |
| `o0` | Text normaliser |
| `q4H` | Character conversion helper |
| `eH` | String conversion wrapper |
| `_4H` | Model-list includes checker |
| `e$` | State extractor |
| `xw` | AsyncLocalStorage store reader |
| `Z9` | Background-mode flag resolver |
| `jo` | Context store getter |
| `h6` | UV/event-loop utility |
| `tf_` | URL encoder for API path |
| `S3` | Proxy password helper |
| `bX1` | Boolean coercion helper |
| `zY` | OAuth credential assembler |
| `KXL` | Proxy config resolver |
| `pr6` | Proxy-auth helper executor |
| `YXL` | Request ID / session tracker |
| `RD` | Provider gateway router |
| `LY` | OAuth token lifecycle manager |
| `LXL` | Request payload builder |
| `VYH` | Timing / promise resolver |
| `fQ8` | Timestamp helper |
| `lD6` | Header case-folder |
| `jDH` | SDK error logger |
| `PA8` | Response parser |
| `h` | Background worker health sweep |
| `y` | Away-summary generator |
| `OEH` | Model provider prefix finder |
| `NW` | Network override helper |
| `Bj` | OAuth token store |
| `vYH` | WIF token exchange helper |
| `BQH` | WIF credentials resolver |
| `E` | Remote-control event handler |
| `X` | Daemon IPC frame parser |
| `J` | Daemon IPC message classifier |
| `w` | Background worker manager |
| `J5` | IPC stream writer |
| `G55` | Daemon protocol message dispatcher |
| `EH` | Error string formatter |
| `TNH` | Model-family feature flag resolver |
| `H9` | Model inference-profile resolver |
| `ny` | Gateway model builder |
| `W` | Tool-list fetcher |
| `kH` | Tool error handler |
| `HA` | Error/string wrapper |
| `Ydf` | Message finder / user-text extractor |
| `Q5A` | SHA-256 hash computer |
| `Ee6` | Cache-control header builder |
| `JK` | String ID encoder |
| `We6` | Context store getter (alternate) |
| `qq8` | Model ID constructor (alternate) |
| `nyH` | Main request body assembler |
| `ZA` | Request stream builder |
| `BQ8` | Request metadata annotator |
| `D6` | Telemetry dispatch helper |
| `FQ8` | Response finaliser |
| `cV` | Lone-surrogate sanitiser |
| `hw_` | Model ID sanitiser |
| `ENH` | HIPAA content filter |
| `S3K` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `hA8` | Temperature / sampling param builder |
| `$2` | Message map helper |
| `iwH` | Tool-call result serialiser |
| `oU` | Random-bytes session ID generator |
| `hL` | Stream state builder |
| `b2A` | Cache-checkpoint injector |
| `ap6` | Content-block tester |
| `jW` | Deep-clone utility (structuredClone wrapper) |
| `tp6` | Cache-checkpoint extractor |
| `C2A` | Content replacement helper |
| `N3H` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `h1` | Feature usage counter |
| `Nu6` | Feature counter implementation |
| `p26` | Agent-type dispatcher |
| `Xj9` | Built-in agent loader |
| `OoH` | Custom agent loader |
| `m26` | Agent variant selector |
| `Kl` | Agent prefix classifier |
| `rsL` | Agent-prefix string parser |
| `E_H` | Agent thread-type checker |
| `N46` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |