---
type: feature-spec
feature: "callback"
cc_version: "2.1.191"
updated: "2026-06-25"
tags: ["callback", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.191 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/callback`

> Analysis basis: CC v2.1.191 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.191

---

## Overview

The `/callback` command is an internal slash command of type `"callback"` that serves as a programmatic re-entry point for the Claude Code CLI. Rather than presenting a user-facing prompt, it executes a pre-registered handler function (`B$f`) that processes an array of pending callback entries, applies message-sequence normalization, and then drives the API request pipeline (including auth, token management, and telemetry) to completion. It is used by the runtime to resume or finalize asynchronous operations initiated elsewhere in the agent loop.

---

## Registration

| Field | Value |
|---|---|
| type | `callback` |
| name | `callback` |
| description | `null` |
| loc_byte | `13530924` |
| loc_byte_end | `13530957` |
| loc_line | `10025` |
| arbor_handler.name | `B$f` |
| arbor_handler.fqn | `claude-2.1.191::B$f` |
| arbor_handler.kind | `Function` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.191 bundle.js:+13530924

---

## Input Branching

The handler involves more than three distinct execution paths based on message-role classification, content-type dispatch, tool-use handling, and API pipeline branching. A flowchart is used below.

```mermaid
flowchart TD
    A["/callback invoked\nhandler B$f receives callback entries array"] --> B[Map over callback entries\nbundle.js:+13530537]
    B --> C[Pass entries to message-sequence normalizer\nbundle.js:+16670698]
    C --> D{For each entry:\ncheck content type}
    D -->|type == 'text'\nbundle.js:+16669206| E[Accumulate text content\nup to 300-char threshold\nbundle.js:+16669651]
    D -->|type == 'tool_use'\nbundle.js:+16669676| F[Serialize tool invocation\nwith classifier input\nbundle.js:+16669749]
    D -->|type == 'tool_result'\nbundle.js:+16669266| G[Annotate result;\nappend ' (error)' suffix\nif error flag set\nbundle.js:+16669486]
    E --> H[Join normalized message fragments\nbundle.js:+16669769]
    F --> H
    G --> H
    H --> I[Build conversation turn sequence\nrole: 'user' or 'assistant'\nbundle.js:+16668982 / +16668999]
    I --> J[Slice to last 30 turns\nbundle.js:+16668949]
    J --> K[Push assembled turn into result array\nbundle.js:+16669122]
    K --> L[Enter API pipeline via wN\nbundle.js:+16670796]
    L --> M{Auth path check}
    M -->|OAuth token present| N[OAuth token check & refresh\nbundle.js:+3026414 / +3026468]
    M -->|API key present\n'ANTHROPIC_API_KEY'| O[API key auth path\nbundle.js:+3058346]
    M -->|proxyAuthHelper configured| P{Workspace trust accepted?}
    P -->|No| Q[Skip proxy helper\nbundle.js:+1865645]
    P -->|Yes| R[Execute proxy helper\ntimeout: 30 000 ms\nbundle.js:+1865944]
    N --> S[Build HTTP request headers\ne.g. User-Agent, X-Claude-Code-Session-Id\nbundle.js:+3025859 / +3025877]
    O --> S
    R --> S
    Q --> S
    S --> T[Dispatch fetch\nbundle.js:+8937388]
    T --> U{Response stream type}
    U -->|text/event-stream\nbundle.js:+3035064| V[SSE streaming decode]
    U -->|vnd.amazon.eventstream\nbundle.js:+3035114| W[Bedrock binary stream decode]
    V --> X[Emit tengu_api_success\nbundle.js:+8938998]
    W --> X
    X --> Y[Deliver results; update appState]
    T --> Z{Error condition}
    Z -->|CLI error| AA[Log 'cli_error', exit code 1\nbundle.js:+13196572 / +13196598]
    Z -->|Cloud gateway session expired| AB["Display: 'Cloud gateway session expired — run /login'\nbundle.js:+3026995"]
```

---

## Behavioral Spec

### 1. Handler Entry and Callback Array Mapping

```
function callbackCommandHandler(callbackEntries):
    // B$f — handler resolved via Arbor direct path
    // Analysis basis: CC v2.1.191 bundle.js:+13530537
    mappedItems = callbackEntries.map(entry => processEntry(entry))
    normalizedSequence = buildNormalizedMessageSequence(mappedItems)
    return driveApiPipeline(normalizedSequence)
```

Analysis basis: CC v2.1.191 bundle.js:+13530537, +13530608

---

### 2. Message Sequence Normalization (`L6o`)

The normalizer (`L6o`) accepts the mapped entries and produces a conversation turn array suitable for the API.

```
function buildNormalizedMessageSequence(entries):
    // Analysis basis: CC v2.1.191 bundle.js:+16670698
    turnBuffer = []
    for each entry in entries:
        role = entry.role   // "user" | "assistant"
        contentBlocks = []

        for each block in entry.content:
            if block.type == "text":
                contentBlocks.append(normalizeText(block))

            else if block.type == "tool_use":
                serialized = serializeToolUse(block)   // calls msm
                contentBlocks.append(serialized)

            else if block.type == "tool_result":
                annotated = annotateToolResult(block)
                contentBlocks.append(annotated)

        turn = { role: role, content: contentBlocks }
        turnBuffer.push(turn)

    // Retain only the most recent 30 turns
    // Analysis basis: CC v2.1.191 bundle.js:+16668949
    turnBuffer = turnBuffer.slice(-30)
    return turnBuffer
```

Analysis basis: CC v2.1.191 bundle.js:+16668940, +16668982, +16668999, +16669122, +16669161

---

### 3. Content-Type Sub-handlers

#### 3a. Text normalization (`gsm`)

```
function normalizeText(textBlock):
    // Analysis basis: CC v2.1.191 bundle.js:+16668916
    // Applies character-level sanitization including
    // lone-surrogate detection (charCode range 55296–56319)
    // Analysis basis: CC v2.1.191 bundle.js:+202749 / +202777 / +202787
    sanitized = sanitizeUnicode(textBlock.text)
    store in shared map via t.set
    return sanitized
```

Analysis basis: CC v2.1.191 bundle.js:+16670056, +202734

#### 3b. Tool-use serialization (`msm`)

```
function serializeToolUse(block):
    // Analysis basis: CC v2.1.191 bundle.js:+16669749
    classifier_input = block.toAutoClassifierInput()
    // Truncate label to 300 chars
    // Analysis basis: CC v2.1.191 bundle.js:+16669651
    label = classifier_input.slice(0, 300)
    serialized = jsonSerialize({ type: "tool_use", label: label })
    return serialized
```

Analysis basis: CC v2.1.191 bundle.js:+16669905, +16669959

#### 3c. Tool-result annotation

```
function annotateToolResult(block):
    // Analysis basis: CC v2.1.191 bundle.js:+16669266
    suffix = block.isError ? " (error)" : ""
    // Analysis basis: CC v2.1.191 bundle.js:+16669486
    padded = block.content.padEnd(width, "  ")
    return { type: "tool_result", text: padded + suffix }
```

Analysis basis: CC v2.1.191 bundle.js:+16669486, +17397141, +17397162

---

### 4. API Pipeline (`wN`)

```
function driveApiPipeline(normalizedSequence):
    // Analysis basis: CC v2.1.191 bundle.js:+16670796
    metadata = {
        timestamp: Date.now(),
        model: resolveModel(),
        queryType: "side_query"   // literal: bundle.js:+8937327
    }

    authToken = resolveAuth()
    headers = buildRequestHeaders(authToken)

    // Dispatch
    response = globalThis.fetch(endpoint, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ messages: normalizedSequence, ...metadata }),
        signal: AbortSignal.timeout(10000)  // bundle.js:+2350705
    })

    streamType = response.headers["content-type"]
    if streamType contains "text/event-stream":   // bundle.js:+3035064
        return decodeSSEStream(response)
    else if streamType contains "vnd.amazon.eventstream":  // bundle.js:+3035114
        return decodeBedrockStream(response)
```

Analysis basis: CC v2.1.191 bundle.js:+8937388, +8938970

---

### 5. Authentication Resolution (`oW` / `Kdn` / `_y`)

```
function resolveAuth():
    // OAuth path — Analysis basis: CC v2.1.191 bundle.js:+3026414
    log("[API:auth] OAuth token check starting")
    token = getOAuthToken()
    if token needs refresh:
        token = refreshOAuthToken()   // calls Ng/rAn — bundle.js:+3026461
        log("refreshed")             // bundle.js:+3076964
    log("[API:auth] OAuth token check complete")  // bundle.js:+3026468

    if no OAuth token:
        // API key fallback — bundle.js:+3058346
        apiKey = env["ANTHROPIC_API_KEY"]
        if apiKey:
            return buildApiKeyAuth(apiKey)
        // proxyAuthHelper path — bundle.js:+1865645
        if proxyAuthHelperConfigured and not workspaceTrustAccepted:
            warn("proxyAuthHelper configured … skipping")
            return null
        if proxyAuthHelperConfigured and workspaceTrustAccepted:
            result = runProxyAuthHelper(timeout=30000)  // bundle.js:+1865944
            if timed out:                               // bundle.js:+1866138
                error("timed out")
            return result
    return token
```

Analysis basis: CC v2.1.191 bundle.js:+3025804, +1865574, +3058066

---

### 6. Request Header Construction (`oW`)

```
function buildRequestHeaders(authToken):
    // Analysis basis: CC v2.1.191 bundle.js:+3025859
    headers = {
        "User-Agent":                  buildUserAgent(),     // "x-app" / version
        "X-Claude-Code-Session-Id":    sessionId,           // bundle.js:+3025877
        "x-claude-remote-container-id": containerId,        // bundle.js:+3025921
        "x-claude-remote-session-id":   remoteSessionId,   // bundle.js:+3025962
        "x-client-app":                clientApp,           // bundle.js:+3026001
        "x-claude-code-agent-id":      agentId,             // bundle.js:+3026035
        "x-anthropic-additional-protection": protectionValue, // bundle.js:+3026368
    }
    if authToken:
        headers["authorization"] = formatAuth(authToken)
    return headers
```

Analysis basis: CC v2.1.191 bundle.js:+3025804 – +3026368

---

### 7. Error and Exit Handling (`Cs`)

```
function handleCriticalError(err):
    // Analysis basis: CC v2.1.191 bundle.js:+17267633
    if err.type == "data":   // bundle.js:+17267623
        emitTelemetry("cli_error")   // bundle.js:+13196572
        logError(err)                // calls nqe + fT
        process.exit(1)              // bundle.js:+13196585 / +13196598
```

Analysis basis: CC v2.1.191 bundle.js:+13196562, +13196585

---

### 8. Context-Tip Classifier Side-Path (`e` / `cSt` / `M6n`)

During processing the handler may execute an ephemeral side-query (`"ephemeral"` literal: bundle.js:+16670866) to classify context and decide whether to surface a usage tip.

```
function maybeClassifyContextTip(messages):
    // Analysis basis: CC v2.1.191 bundle.js:+16671138
    // Max tokens for classifier: 512 — bundle.js:+16671099
    if no tool_use block found in response:
        log("[context-tips] no tool_use block in response")  // bundle.js:+16671216
        emitTelemetry("tengu_context_tip_classifier_outcome",
                       { outcome: "tips_context_classify_no_tool_use" })
        return

    result = runClassifier(messages, maxTokens=512)
    if schema parse fails:
        log("[context-tips] response failed schema parse") // bundle.js:+16671438
        emitTelemetry("tengu_context_tip_classifier_outcome",
                       { outcome: "tips_context_classify_parse_failed" })
        return

    outcome = result.outcome  // "tip" | "tip_ineligible" | "no_tip" | "none"
    emitTelemetry("tengu_context_tip_classifier_outcome", { outcome: outcome })
```

Analysis basis: CC v2.1.191 bundle.js:+16671138, +16671782, +16671788, +16671805, +16671838

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_api_success` | Fired on successful API response completion (bundle.js:+8938998) |
| Telemetry: `tengu_context_tip_classifier_outcome` | Fired after context-tip classifier runs; carries outcome field (bundle.js:+16672225) |
| Telemetry: `tengu_feature_ok` | Fired when a feature check passes (bundle.js:+1025725) |
| Telemetry: `tengu_feature_bad` | Fired when a feature check fails (bundle.js:+1025792) |
| Telemetry: `tengu_lone_surrogate_sanitized` | Fired when lone Unicode surrogates are found and sanitized in message content (bundle.js:+8938694) |
| Telemetry: `tengu_prompt_cache_1h_config` | Fired to record 1-hour prompt-cache configuration (bundle.js:+13616098) |
| Telemetry: `tengu_bg_retire_grace_bridged_min` | Fired during background-worker grace retirement (bundle.js:+13163592) |
| Telemetry: `tengu_bg_retire_pinned_low_mem` | Fired when pinned workers are retired due to low memory (bundle.js:+17375231) |
| Telemetry: `tengu_bg_attach_upgrade` | Fired when a background worker is upgraded/re-attached (bundle.js:+13163664) |
| Telemetry: `tengu_bg_prewarm_per_sweep` | Fired per background pre-warm sweep (bundle.js:+17375352) |
| Hook registration | Background worker lifecycle hooks (`respawnIfIdleStale`, `retireIfSettled`, `shiftGraceClocksForward`) registered during pipeline setup (bundle.js:+17374676, +17374847, +17374938) |
| appState changes | Session ID map updated via `t.set` / `o.set`; UUID generated via `yfi.randomUUID` for new sessions (bundle.js:+16670056, +16669687, +3034687) |
| OAuth token cache | Token map updated; `refreshed` state written on token renewal (bundle.js:+3076964) |
| Process exit | `process.exit(1)` called on `cli_error` condition (bundle.js:+13196585) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| HTTP headers written | Session, agent, container, and protection headers sent with every request (bundle.js:+3025859–+3026368) |
| Memory management | Low-memory detection via `X8l.freemem`; non-pinned workers shed, then pinned workers retired as last resort (bundle.js:+13163551, +17375120) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.191 | Initial analysis |

---

## Common Mistakes

1. **Treating `/callback` as a user-invocable prompt command.** Its `description` is `null` and it carries no prompt body. It is an internal runtime re-entry hook; invoking it manually will produce no interactive output.
2. **Assuming no auth is required.** The handler always runs the full auth-resolution chain (OAuth → API key → proxy helper). Misconfigured credentials will cause the callback to fail silently or time out at the 30 000 ms proxy-helper deadline (bundle.js:+1865944).
3. **Ignoring the 30-turn history cap.** The normalizer silently truncates the conversation history to the most recent 30 turns (bundle.js:+16668949). Callers passing very long histories should expect earlier context to be dropped without warning.
4. **Not accounting for lone-surrogate sanitization.** Any message content containing Unicode code points in the range 55296–56319 (lone surrogates) will be sanitized and the `tengu_lone_surrogate_sanitized` telemetry event emitted (bundle.js:+202777, +202787, +8938694). Downstream consumers should not rely on the original byte sequence being preserved.
5. **Misinterpreting the `"side_query"` API path.** The pipeline labels this call `"side_query"` (bundle.js:+8937327); it does not appear in the main conversation turn list visible to the user.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `B$f` | Main callback command handler (Arbor-resolved, direct) |
| `L6o` | Message-sequence normalizer |
| `gsm` | Text-block normalizer / shared-state setter |
| `hx` | Unicode lone-surrogate sanitizer |
| `msm` | Tool-use block serializer / classifier-input builder |
| `ke` | JSON serializer utility |
| `har` | Tokenization / character encoding helper |
| `Cs` | Critical-error handler (emits `cli_error`, calls `process.exit`) |
| `wN` | API pipeline driver (main fetch dispatcher) |
| `oW` | HTTP client / request builder (auth, headers, stream) |
| `mz` | App-type resolver (`"main"` / `"subagent"`) |
| `p3r` | URL / header string parser |
| `Ks` | Background-type resolver (`"bg"` / `"cli-bg"` / `"cli"`) |
| `Mz` | Version/package metadata resolver |
| `GPr` | URL-encoding helper (`encodeURIComponent` wrapper) |
| `T` | Request-builder utility (debug/verbose header logic) |
| `rt` | String coercion utility |
| `Ng` | OAuth token refresh orchestrator |
| `XKs` | Boolean coercion helper |
| `_y` | Auth-source resolver (API key / OAuth / helper) |
| `_ud` | Auth-helper timeout wrapper |
| `Kdn` | Proxy-auth-helper executor |
| `Iud` | Session-UUID manager |
| `PH` | Mantle (bedrock) request adapter |
| `G2` | Provider/model registry lookup |
| `fy` | Proxy-authorization header builder |
| `Tud` | Request-finalizer / stream opener |
| `yud` | Provider-flavor router (`anthropicAws`, `vertex`, `foundry`, `gateway`, `firstParty`) |
| `SCe` | Streaming response handler |
| `Rdr` | Request-duration recorder |
| `pMt` | HTTP header normalizer (lowercase) |
| `dve` | SDK error logger |
| `BSn` | Non-streaming response decoder |
| `D` | Output writer / supervisor message emitter |
| `x` | Request-deduplication / expiry cache (60 000 ms TTL) |
| `v` | Window-focus / blur state tracker (3 600 000 ms horizon) |
| `Ooe` | Agent-type prefix detector |
| `nv` | Node-type classifier |
| `yA` | OAuth session / profile manager |
| `ACe` | WIF token-exchange handler |
| `TZe` | WIF credentials resolver (fetches `https://api.anthropic.com`) |
| `I` | Token/rate-limit counter |
| `h` | Promise-settlement tracker |
| `b2e` | Model compatibility checker |
| `ao` | Application-inference-profile resolver |
| `o1` | Request-options builder |
| `lie` | Response-header extractor |
| `vOr` | Foundry resource-name normalizer |
| `_` | MCP-tool include-list checker |
| `a` | MCP server registry accessor |
| `CBp` | Tool-definition finder |
| `SHo` | SHA-256 request hasher |
| `Ghn` | User-agent / session-header builder |
| `ol` | String formatting utility |
| `_r` | Request-options record builder |
| `uu` | Header-map builder |
| `$hn` | AsyncLocalStorage store accessor |
| `hCe` | Cache-control header helper |
| `aIn` | Request-interceptor runner |
| `aje` | Conversation-turn assembler |
| `To` | Turn-role resolver |
| `dpr` | Default-parameter injector |
| `nt` | Worker-node scheduler |
| `ppr` | Parameter pre-processor |
| `wD` | HIPAA / compliance mode checker |
| `C3r` | Compliance-option record builder |
| `A2e` | Request-metadata annotator |
| `L` | Background-worker sweep manager |
| `V` | Worker-pool controller |
| `Nzt` | Memory-pressure detector |
| `J8l` | Worker retirement grace-clock manager |
| `I3e` | Checkpoint file reader/writer |
| `Le` | Worker-lifecycle logger |
| `Gn` | Timer/scheduler root |
| `W` | React/Ink render root |
| `j` | Backspace/input event handler |
| `Xer` | Worker-attach upgrader |
| `q` | Keyboard-event dispatcher |
| `ZVa` | Structured-output validator |
| `sp` | String sanitizer (replace utility) |
| `XSn` | Temperature / sampling-param injector |
| `av` | Content-block array mapper |
| `Txe` | Tool-list builder |
| `P4` | Tool random-bytes ID generator |
| `Sc` | Tool-schema compiler |
| `etn` | Cache-control token injector |
| `Qen` | Cache-eligibility checker |
| `iD` | Deep-clone (structuredClone) wrapper |
| `u7e` | Cache-entry updater |
| `Zen` | Cache-text replacer |
| `Ve` | React component renderer |
| `eze` | Ink/React render primitive |
| `LOr` | Response-header parser |
| `l7s` | Header-value tokenizer |
| `wOr` | Allowed-tool set manager |
| `mbe` | Model-behavior-flag extractor |
| `Tr` | Non-conforming response logger |
| `lh` | Ink render helper |
| `Oo` | Output formatter |
| `H1t` | Streaming chunk timer |
| `v3i` | Chunk-time recorder |
| `Rot` | Render-output tracker |
| `h1t` | Grace-period chunk handler |
| `NF` | Named-function / agent-type resolver |
| `nOd` | Agent-prefix parser (`agent:builtin:`, `agent:custom:`, `agent:`) |
| `xD` | Thread-name validator (`repl_main_thread`) |
| `kAt` | Cache-control appender |
| `S4` | Ephemeral side-query dispatcher |
| `ev` | Side-query result extractor |
| `PPr` | Side-query request builder |
| `zp` | Side-query auth composer |
| `usm` | Context-tip classifier orchestrator |
| `csm` | Classifier message builder |
| `hsm` | Classifier response joiner |
| `M6n` | Tool-use-block finder in response |
| `cSt` | Context-tip state updater |
| `Pe` | Ink/React tip renderer |
| `Re` | Tips-context-classify telemetry emitter |
| `D6n` | Classifier schema validator (`safeParse`) |
| `we` | Tip-display renderer |
| `Ae` | String-coercion output helper |
| `xSe` | Callback registry / entry-store accessor |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.