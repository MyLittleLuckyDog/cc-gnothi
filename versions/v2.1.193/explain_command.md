---
type: feature-spec
feature: "explain_command"
cc_version: "2.1.193"
updated: "2026-06-26"
tags: ["explain_command", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.193 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/explain_command`

> Analysis basis: CC v2.1.193 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.193

---

## Overview

`/explain_command` is an internal `tool`-type slash command that generates a human-readable explanation for why a given tool invocation requires specific permissions. It works by issuing a focused side-query to the model, parsing the structured response, and surfacing the result as a permission explainer payload. The command is designed for use within the permission-review flow rather than as a general interactive command.

---

## Registration

| Field | Value |
|---|---|
| type | `tool` |
| name | `explain_command` |
| description | `null` |
| loc_byte | `14825362` |
| loc_byte_end | `14825398` |
| loc_line | `11326` |
| arbor_handler.name | `qpc` |
| arbor_handler.fqn | `claude-2.1.193::qpc` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.193 bundle.js:+14825362

---

## Input Branching

The handler has 4+ meaningful branches (conversation history filtering, model side-query dispatch, structured output parsing, and error classification), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/explain_command invoked]) --> B[formatToolDescription\n build tool context string]
    B --> C[collectTimestamp\n record Date.now start]
    C --> D[filterConversationHistory\n keep last N assistant turns\n within 1000-message window]
    D --> E[truncateHistory\n prepend ellipsis prefix\n if truncated]
    E --> F[resolveModelConfig\n via modelConfigResolver]
    F --> G[dispatchSideQuery\n type=side_query\n to API layer FN]
    G --> H{Response received?}
    H -- success --> I[emitTelemetry\n tengu_permission_explainer_generated]
    I --> J{Contains tool_use block?}
    J -- yes --> K[extractStructuredOutput\n parse permission_explainer block]
    K --> L[buildResultPayload\n return explainer content]
    J -- no --> M[logWarning\n Permission explainer: no parsed output\n emit tengu_permission_explainer_error]
    M --> N[return null/empty result]
    H -- AbortError --> O[swallow / rethrow abort]
    H -- api_error --> P[emitTelemetry\n tengu_permission_explainer_error\n classify as api_error]
    P --> Q[return error result]
    L --> Z([Done])
    N --> Z
    O --> Z
    Q --> Z
```

Analysis basis: CC v2.1.193 bundle.js:+14825057, +14825081, +14825102, +14825120, +14825267, +14825460, +14825653, +14825687, +14825843, +14825895, +14825944, +14826139, +14826396, +14826515, +14826551, +14826586

---

## Behavioral Spec

### Main Handler (`qpc`)

```
async function explainCommandHandler(toolInput, context):
    # Step 1 — Build a string representation of the tool being explained
    toolDescription = formatToolDescription(toolInput)   # calls Hem

    # Step 2 — Capture wall-clock start time for telemetry
    startTime = Date.now()                               # bundle.js:+14825081

    # Step 3 — Filter and truncate conversation history
    recentHistory = filterAssistantHistory(             # calls _em
        conversationHistory,
        maxMessages = 1000,                              # bundle.js:+14824626
        roleFilter  = "assistant"                        # bundle.js:+14824661
    )
    # Keep up to 3 turns                                 # bundle.js:+14824681
    recentHistory = recentHistory.reverse().slice(0, 3).reverse()
    if recentHistory was truncated:
        prepend("...", recentHistory)                    # bundle.js:+14824857

    # Step 4 — Resolve model config for the side-query
    modelConfig = resolveModelConfig(context)            # calls As → Y4 → wa

    # Step 5 — Dispatch side-query to API
    response = await dispatchSideQuery(                  # calls FN (API layer)
        type          = "side_query",                    # bundle.js:+8618552
        toolContext   = toolDescription,
        history       = recentHistory,
        modelConfig   = modelConfig,
        structured    = true,                            # structured_outputs bundle.js:+8618680
        sideQueryFlag = "sideQuery"                      # bundle.js:+8619965
    )

    # Step 6 — Parse response
    outputBlock = extractToolUseBlock(                   # tool_use bundle.js:+14825575
        response,
        blockName = "permission_explainer"               # bundle.js:+14825420
    )

    if outputBlock is null:
        log("Permission explainer: no parsed output in response")  # bundle.js:+14826192
        emitTelemetry("tengu_permission_explainer_error")          # bundle.js:+14826057
        return emptyResult()

    emitTelemetry("tengu_permission_explainer_generated")          # bundle.js:+14825845
    return buildResult(outputBlock)                      # calls Ui, ke
```

Analysis basis: CC v2.1.193 bundle.js:+14825057

---

### Tool Description Formatter (`Hem`)

```
function formatToolDescription(toolInput):
    # Converts tool input to a display string for the model prompt
    jsonString = JSON.stringify(toolInput)               # via ke bundle.js:+14824572
    return String(jsonString)                            # bundle.js:+14824598
```

Analysis basis: CC v2.1.193 bundle.js:+14824572

---

### Conversation History Filter (`_em`)

```
function filterAssistantHistory(history, maxMessages, roleFilter):
    # 1. Filter to "assistant" role messages only
    assistantMessages = history.filter(msg => msg.role == roleFilter)
    # bundle.js:+14824638

    # 2. Reverse, take up to 3, re-reverse to restore chronological order
    recent = assistantMessages.reverse()                 # bundle.js:+14824706
    recent = recent.slice(0, 3)                          # literal 3 bundle.js:+14824681
    recent = recent.reverse()

    # 3. Truncate each message text via surrogate-safe truncation (tL)
    recent = recent.map(msg => truncateSurrogateSafe(msg.text))

    # 4. Prepend ellipsis marker if any truncation occurred
    if truncated:
        recent.unshift("...")                            # bundle.js:+14824857 / +14824865

    return recent.join(separator)                        # bundle.js:+14824898
```

Analysis basis: CC v2.1.193 bundle.js:+14824638

---

### Surrogate-Safe Truncation (`tL`)

```
function surrogateSafeTruncate(text, maxLen):
    # Uses charCodeAt to detect surrogate pairs
    # Surrogate range: 0xD800 (55296) – 0xDBFF (56319)
    # bundle.js:+203490, +203500
    for i in range(maxLen):
        code = text.charCodeAt(i)
        if code >= 55296 and code <= 56319:
            # High surrogate — do not split pair; cut before it
            return text.slice(0, i)
    return text.slice(0, maxLen)
```

Analysis basis: CC v2.1.193 bundle.js:+203447

---

### Model Config Resolution (`As` → `Y4` → `wa`)

```
function resolveModelConfig(context):
    # Resolves which model to use for the side-query.
    # Walks through tier mappings (fable, opusplan, sonnet, haiku, opus, best)
    # applying policy settings and user steering detection.
    # bundle.js:+2290111, +2290147, +2290160
    config = buildModelTierConfig(context)  # Y4 → wa
    return config
```

Key tier aliases recognized (bundle.js:+2306383–+2306618):
- `"fable"` → maps to fable-tier model
- `"opusplan"` → maps to opus-plan model
- `"sonnet"` → maps to sonnet-tier model
- `"haiku"` → maps to haiku-tier model
- `"opus"` → maps to opus-tier model
- `"best"` → selects best available

Analysis basis: CC v2.1.193 bundle.js:+2290111

---

### Side-Query API Dispatch (`FN`)

```
async function dispatchSideQuery(params):
    # Sets up request headers including:
    #   x-app, User-Agent, X-Claude-Code-Session-Id,
    #   x-claude-remote-container-id, x-claude-remote-session-id,
    #   x-client-app, x-claude-code-agent-id
    # bundle.js:+3030839, +3030867, +3030885, +3030929, +3030970, +3031009, +3031043

    # Applies OAuth token check
    # "[API:auth] OAuth token check starting" bundle.js:+3031422
    # "[API:auth] OAuth token check complete" bundle.js:+3031476

    # Sends request via jW (main API client)
    # Uses structured_outputs mode bundle.js:+8618680
    # type label "side_query" bundle.js:+8618552

    # Session timeout: 600000 ms (10 minutes) bundle.js:+3031794
    # Byte watchdog initial: 15000 ms       bundle.js:+3037470
    # Byte watchdog extended: 120000 ms     bundle.js:+3037488

    response = await apiClient.send(params)

    # Lone surrogate sanitization applied to response text
    # emits tengu_lone_surrogate_sanitized if needed bundle.js:+8619921

    # On success emits tengu_api_success bundle.js:+8620225
    return response
```

Analysis basis: CC v2.1.193 bundle.js:+8618507

---

### Result Extraction and Classification (`Ui`)

```
function extractAndClassifyResult(response):
    # Checks if response block name starts with "mcp__"
    # → classified as mcp_tool bundle.js:+3313034, +3313053
    # Otherwise treated as first-party tool

    if Object.hasOwn(response, blockName):
        if blockName.startsWith("mcp__"):
            kind = "mcp_tool"
        else:
            kind = "permission_explainer"    # bundle.js:+14825420
        return buildPayload(response, kind)  # via ph, Ve
    return null
```

Analysis basis: CC v2.1.193 bundle.js:+3312965

---

### Error Handling in Handler (`qpc` tail)

```
function handleError(err):
    if err.name == "AbortError":             # bundle.js:+14826515
        # Abort is expected (user cancelled); re-throw or swallow
        throw err
    else:
        emitTelemetry("tengu_permission_explainer_error")  # bundle.js:+14826057
        classify = "api_error"               # bundle.js:+14826586
        return errorResult(err, classify)
```

Analysis basis: CC v2.1.193 bundle.js:+14826515

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_permission_explainer_generated` | Emitted on successful structured output extraction (bundle.js:+14825845) |
| Telemetry — `tengu_permission_explainer_error` | Emitted when response lacks a parseable `permission_explainer` block, or on API error (bundle.js:+14826057) |
| Telemetry — `tengu_api_success` | Emitted by the API dispatch layer on any successful API response (bundle.js:+8620225) |
| Telemetry — `tengu_lone_surrogate_sanitized` | Emitted when lone UTF-16 surrogates are found and sanitized in API response text (bundle.js:+8619921) |
| Telemetry — `tengu_config_parse_error` | Emitted by config loader if config JSON cannot be parsed (bundle.js:+13977384) |
| Telemetry — `tengu_stream_watchdog_default_on` | Emitted by byte-stream watchdog initialization (bundle.js:+3039229) |
| Telemetry — `tengu_byte_stream_idle_timeout_ms` | Emitted with the configured watchdog idle timeout (bundle.js:+3037259) |
| Telemetry — `tengu_byte_watchdog_fired_late` | Emitted if the byte watchdog fires after stream completion (bundle.js:+3038521) |
| Telemetry — `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` | Feature flag evaluation outcomes (bundle.js:+1026754, +1026821, +1026902) |
| Side-query dispatch | Sends a model request of type `"side_query"` with `structured_outputs` enabled; does **not** add to the main conversation history |
| Config file access | Reads local/global config via `bSt`; guards against pre-init access with error `"Config accessed before allowed."` (bundle.js:+13975970) |
| Config backup | Creates a timestamped backup copy (`Date.now`-named) of config on write (bundle.js:+13976953) |
| appState changes | No direct `appState` mutations identified within depth-2 traversal |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | `Ei` registers a hook via `a7o.register` (bundle.js:+68040); file watch via `aLt` → `egs.watchFile` (bundle.js:+1146692) |
| File system | Config read with `r.readFileSync` (UTF-8, bundle.js:+13976053); backup dir created with `r.mkdirSync`; file copied with `r.copyFileSync` |
| Byte watchdog timers | Initial timeout: 15 000 ms; extended timeout: 120 000 ms (bundle.js:+3037470, +3037488) |
| Request session timeout | 600 000 ms (10 minutes) (bundle.js:+3031794) |
| Proxy auth helper timeout | 30 000 ms (bundle.js:+1870089) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.193 | Initial analysis |

---

## Common Mistakes

1. **Expecting interactive output** — `/explain_command` is a `tool`-type command used programmatically within the permission-review flow. It does not produce a user-visible slash-command response in the normal REPL sense.
2. **Assuming full conversation history is sent** — The handler intentionally limits history to the 3 most recent `"assistant"` role turns. Older context is not included in the side-query.
3. **Treating AbortError as a real error** — The handler specifically detects `AbortError` and handles it separately from API errors; callers should not rely on the `tengu_permission_explainer_error` event being emitted on abort.
4. **Misidentifying the model used** — The side-query uses the tier resolved by `resolveModelConfig`, which applies policy mappings and user-steering detection. It is not guaranteed to be the same model as the main conversation.
5. **Ignoring the `null` return case** — When the response contains no `permission_explainer` `tool_use` block, the command returns an empty/null result and logs a warning. Callers must handle this gracefully.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `qpc` | Main async handler for `/explain_command` (arbor_handler) |
| `EGo` | Internal entry-point wrapper called by `qpc` |
| `kt` | Config loader / config-access coordinator |
| `jt` | Logger / debug trace utility |
| `a9o` | App-state accessor |
| `bSt` | Config file read/write/backup manager |
| `Bt` | JSON parse wrapper |
| `R4` | String prefix/slice helper |
| `an` | Error code normalizer |
| `u9o` | Directory listing helper for config backup paths |
| `T` | Log-level formatter / output colorizer |
| `p9o` | Backup directory path builder |
| `m` | Process map / SIGTERM manager |
| `V` | Telemetry event emitter |
| `xjf` | File-watcher setup for config hot-reload |
| `aLt` | `watchFile` wrapper |
| `ife` | Feature-flag evaluator |
| `Ei` | Hook registrar (calls `a7o.register`) |
| `Hem` | Tool description formatter (JSON.stringify → String) |
| `ke` | JSON stringify helper |
| `_em` | Conversation history filter and truncator |
| `tL` | Surrogate-safe string truncator |
| `As` | Model config resolver (top-level) |
| `Y4` | Model tier builder |
| `OH` | Model tier option helper |
| `K2` | Model config option builder |
| `wa` | Model alias/tier resolution logic |
| `oxt` | Policy settings fetcher |
| `sxt` | Model tier settings expander |
| `PFe` | First-party provider checker |
| `Gge` | Gateway provider checker |
| `Fa` | String replacement utility |
| `Bge` | Model name inclusion checker |
| `nM` | Model name canonicalizer |
| `a_n` | Recursive model alias resolver |
| `EYs` | Object entries model config mapper |
| `_n` | Policy setting lookup |
| `PZe` | Policy map builder |
| `yYs` | Model name index finder |
| `EYu` | Tier-to-model resolution helper |
| `qo` | Model identifier parser / alias expander |
| `IRt` | Model string normalizer |
| `SYu` | Model steering validator |
| `oH` | Model config output builder |
| `lC` | Composite model config constructor |
| `$1r` | Tool use block builder |
| `p_n` | Full model config resolution pipeline |
| `d_n` | Delta/diff model config applicator |
| `FN` | API side-query dispatch layer |
| `ef` | API client factory |
| `Lt` | API base client wrapper |
| `Rx` | HTTP response reader |
| `jW` | Main API request executor |
| `e7` | API environment builder |
| `g4r` | HTTP header parser |
| `Ks` | App-context string builder |
| `mve` | App-context value formatter |
| `y7` | Session-store accessor |
| `H_n` | AsyncLocalStorage store getter |
| `V1r` | URL encoder for OAuth parameters |
| `at` | Block/message constructor |
| `Wg` | OAuth token refresher (coordinator) |
| `Dbn` | OAuth token refresh executor |
| `wYs` | Boolean coercion helper |
| `Dy` | Auth provider dispatcher |
| `cd` | Git-bare repo detector |
| `UA` | Anthropic API auth handler |
| `Ql` | Auth result builder |
| `MT` | Model/token pair builder |
| `aH` | Full API request handler with auth + retry |
| `KDt` | Pre-request auth resolver |
| `ant` | Auth token extractor |
| `d_` | Request context builder |
| `qfd` | Request metadata assembler |
| `Qtt` | Request timing recorder |
| `Tr` | Request trace logger |
| `Ifn` | Proxy auth helper executor |
| `cFe` | Block content builder |
| `GPs` | Proxy credential helper |
| `WUu` | Timeout integer parser |
| `i$` | Promise timeout wrapper |
| `_v` | Error categorizer |
| `Zfd` | Streaming response handler / watchdog |
| `_r` | Message block assembler |
| `ehi` | Stream event dispatcher |
| `y4r` | Stream reader coordinator |
| `emd` | Header redaction logger |
| `thi` | Stream message builder |
| `Zgi` | Stream chunk processor |
| `H4r` | Byte watchdog timer manager |
| `Jfd` | Byte stream idle watchdog |
| `BH` | Provider type classifier |
| `G0t` | Bedrock/Vertex/Anthropic discriminator |
| `Dqu` | Provider prefix checker (`anthropic.`) |
| `TFe` | Provider name normalizer |
| `fB` | Proxy configuration loader |
| `l$e` | Proxy URL parser |
| `Ly` | HTTP proxy handler |
| `ul` | String buffer builder |
| `Bz` | Proxy URL parser and validator |
| `iQe` | Proxy auth type resolver |
| `jPs` | Proxy CONNECT tunnel builder |
| `DRr` | Proxy destination validator |
| `NRr` | Proxy hostname/IP validator |
| `Qfd` | Stream state initializer |
| `Xgi` | Stream event type router |
| `Kfd` | Model API endpoint builder |
| `_bn` | Endpoint path builder |
| `U7e` | API version string |
| `Ise` | Environment endpoint selector |
| `LNr` | Base URL normalizer |
| `Rs` | OAuth endpoint validator |
| `_ve` | Gateway JWT refresh handler |
| `Rfr` | Refresh token loader |
| `wXu` | Gateway token exchange executor |
| `rtn` | Token expiry calculator |
| `wfr` | Timestamp recorder |
| `DDt` | HTTP header key lowercaser |
| `lwe` | SDK warning/error logger |
| `D` | Output writer / process output manager |
| `NMc` | File real-path resolver |
| `Kd` | Output stream selector |
| `xe` | Output write coordinator |
| `RHm` | Buffer writer |
| `d` | Terminal output driver |
| `x` | Process kill / cleanup handler |
| `hR` | `process.kill` wrapper |
| `w` | Window-focus/blur state tracker |
| `Yge` | Window focus event handler |
| `wv` | API retry wrapper |
| `yve` | WIF (Workload Identity Federation) credential handler |
| `Iet` | WIF token exchange executor |
| `we` | Feature-flag OK reporter |
| `Re` | Feature-flag bad reporter |
| `DXu` | WIF error classifier |
| `I` | Token/auth state manager |
| `R` | Output controller |
| `A` | Agent lifecycle controller |
| `h` | Agent session store |
| `ABe` | Model capability checker |
| `to` | Prompt/context normalizer |
| `__` | String lowercaser / includes checker |
| `RTt` | Text transformer |
| `up` | String replacer |
| `A1` | Block type classifier |
| `zie` | Foundry resource resolver |
| `aTt` | Foundry URL builder |
| `xNr` | Foundry resource name extractor |
| `_` | Tool list manager |
| `ZFp` | Tool finder |
| `dHo` | Request hash builder (SHA-256) |
| `y_n` | User-agent string builder |
| `_u` | Cache-control header builder |
| `vhn` | Cache hint builder |
| `fve` | Agent ID appender |
| `UCn` | Custom header builder |
| `gje` | Main conversation executor (repl main thread) |
| `So` | Conversation session builder |
| `wB` | Message role validator |
| `lmr` | Memory dir relevance scorer |
| `it` | Prompt cache / conversation-turn manager |
| `KPt` | Cache slot initializer |
| `zPt` | Cache slot updater |
| `H5` | Cache checkpoint builder |
| `lCn` | Cache slot allocator |
| `cmr` | Context memory resolver |
| `YD` | HIPAA mode checker |
| `L4r` | HIPAA block builder |
| `SBe` | HIPAA notice block builder |
| `TW` | HIPAA-excluded feature list checker |
| `L` | Background worker sweep manager |
| `iYt` | Low-memory detection handler |
| `Knr` | Memory threshold evaluator |
| `Ezl` | Memory attach upgrade handler |
| `I9e` | Pins file reader/cleaner |
| `RNt` | Pins file path builder |
| `In` | POSIX error normalizer |
| `vUd` | Recursive directory scanner for pinned workers |
| `B` | Worker registry |
| `Nn` | Worker count logger |
| `j` | Worker lifecycle pair |
| `O` | Worker idle-exit timer |
| `znr` | Background attach-upgrade telemetry |
| `K` | Worker keyboard input handler |
| `q` | Terminal writer pair |
| `Aja` | Structured output schema validator |
| `vbn` | Temperature/model param injector |
| `Mv` | Message mapper |
| `S0e` | Subagent conversation dispatcher |
| `u5` | Subagent session creator |
| `mn` | Subagent lifecycle manager |
| `Rc` | Subagent result collector |
| `Lnn` | Message list normalizer |
| `vnn` | Content block validator |
| `LD` | Deep-clone utility (`structuredClone`) |
| `lYe` | Trailing-block normalizer |
| `wnn` | Block text replacer |
| `Ve` | Text block constructor |
| `Zze` | Base text block factory |
| `kNr` | Response content parser |
| `FXs` | Structured output field extractor |
| `RNr` | Response header cache updater |
| `uTe` | Token usage recorder |
| `br` | Usage block builder |
| `ph` | Usage payload constructor |
| `No` | No-op / empty block builder |
| `FNt` | Agent builtin registry lookup |
| `c5i` | Builtin agent descriptor |
| `$Ud` | Builtin agent capability checker |
| `kst` | Builtin agent hash generator |
| `$Nt` | Builtin agent fingerprinter |
| `UNt` | SHA-based fingerprint creator |
| `sF` | Custom agent resolver |
| `UUd` | Custom agent path parser |
| `v0n` | Custom agent config loader |
| `sGr` | Path segment extractor |
| `JD` | Thread-type prefix checker (`repl_main_thread`) |
| `Zbt` | Cache-control block injector |
| `Ui` | Result block classifier (MCP vs first-party) |
| `vt` | Feature-flag sad reporter |
| `Oe` | Feature-flag outcome builder |
| `be` | String coercion helper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.