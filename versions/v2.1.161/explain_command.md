---
type: feature-spec
feature: "explain_command"
cc_version: "2.1.161"
updated: "2026-06-03"
tags: ["explain_command", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.161 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/explain_command`

> Analysis basis: CC v2.1.161 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.161

---

## Overview

`/explain_command` is an internal tool-type command that invokes a dedicated **permission explainer** agent to produce a human-readable explanation of why a particular tool use (typically an MCP or built-in tool call) requires the permissions it does. It works by constructing a focused side-query to the API, parsing a structured response, and returning annotated explanation text back to the caller. It is not intended to be surfaced as a conversational slash command; it is wired as a `tool` registration used programmatically by the permission-decision subsystem.

---

## Registration

| Field | Value |
|---|---|
| type | `tool` |
| name | `explain_command` |
| description | `null` |
| loc_byte | `14083047` |
| loc_byte_end | `14083083` |
| loc_line | `11127` |
| arbor_handler.name | `jJK` |
| arbor_handler.fqn | `claude-2.1.161::jJK` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.161 bundle.js:+14083047

---

## Input Branching

The handler `jJK` exhibits four clearly separable execution paths based on API response shape and error type, making a Mermaid flowchart the appropriate representation.

```mermaid
flowchart TD
    A(["/explain_command invoked\njJK entry]) --> B[Build conversation history\nwif: filter assistant msgs,\nreverse, slice, prepend ellipsis]
    B --> C[Normalise tool-use context\nYif: stringify + coerce to string]
    C --> D[Resolve conversation context\nlq: model-name normalisation]
    D --> E[Dispatch side-query API call\ngu → vU: full API pipeline]
    E --> F{Response received?}
    F -- No parsed output --> G[Log warning\n'Permission explainer: no parsed output in response'\nEmit tengu_permission_explainer_error]
    F -- tool_use block found --> H[Extract explanation from\ntool_use block\nDif parser]
    H --> I{Parse succeeded?}
    I -- Yes --> J[Emit tengu_permission_explainer_generated\nRecord timestamp via Date.now\nReturn explanation]
    I -- AbortError --> K[Swallow abort silently\nReturn null]
    I -- api_error / other --> L[Emit tengu_permission_explainer_error\nLog via d / hH\nReturn null or rethrow]
    G --> M([End])
    J --> M
    K --> M
    L --> M
```

Analysis basis: CC v2.1.161 bundle.js:+14082742 (jJK→HMA), +14082787 (jJK→Yif), +14082805 (jJK→wif), +14082952 (jJK→lq), +14082965 (jJK→gu), +14083145 (jJK→N), +14083338 (jJK→SH), +14083372 (jJK→Dif), +14083528 (jJK→d), +14083580 (jJK→t9), +14083629 (jJK→hH), +14083824 (jJK→t6), +14084081 (jJK→TH), +14084236 (jJK→RH)

---

## Behavioral Spec

### 1. Entry — Main Handler (`jJK`)

```
async function permissionExplainerHandler(toolUseContext, conversationState):
    startTime = Date.now()                          // +14082766

    # Step 1: Stringify the tool-use context
    toolUseString = stringifyToolUse(toolUseContext)    // Yif: +14082787
    # uses JSON.stringify internally (SH→JSON.stringify +184155),
    # then String() coercion (+14082278)

    # Step 2: Build a trimmed history window
    history = buildHistoryWindow(conversationState)     // wif: +14082805
    # filters assistant-role messages, reverses, slices to last N,
    # prepends "..." sentinel (+14082542), joins

    # Step 3: Normalise model identifier
    normalisedModel = normaliseModelName(currentModel) // lq: +14082952
    # applies model-alias table (opusplan, sonnet, haiku, opus, best)

    # Step 4: Issue a focused side-query
    response = await issueSideQuery(                    // gu: +14082965
        systemPrompt  = PERMISSION_EXPLAINER_SYSTEM,
        toolUseString = toolUseString,
        history       = history,
        model         = normalisedModel
    )

    # Step 5: Locate tool_use block in response
    toolUseBlock = findToolUseBlock(response)           // N, SH: +14083145, +14083338
    if toolUseBlock is null:
        logWarning("Permission explainer: no parsed output in response")  // +14083877
        emitTelemetry("tengu_permission_explainer_error")                 // +14083742
        return null

    # Step 6: Parse explanation from block
    explanation = parseExplanation(toolUseBlock)        // Dif: +14083372

    # Step 7: Validate tool-name prefix (mcp__ check)
    isMcpTool = checkMcpPrefix(toolUseContext)          // t9: +14083580
    # Object.hasOwn (+3200789) + H.startsWith("mcp__", +3200841)

    # Step 8: Emit success telemetry and return
    emitTelemetry("tengu_permission_explainer_generated",  // +14083530
        { elapsed: Date.now() - startTime })
    return explanation
```

Analysis basis: CC v2.1.161 bundle.js:+14082742 – +14084236

---

### 2. History Window Builder (`wif`)

```
function buildHistoryWindow(messages):
    assistantMessages = messages.filter(                // +14082318
        m => m.role === "assistant"                     // literal "assistant": +14082341
    )
    reversed = assistantMessages.reverse()              // +14082386
    window   = reversed.slice(0, MAX_HISTORY)          // MAX_HISTORY=3 (+14082361); slice: +14082529
    window.unshift("...")                               // sentinel "+14082542"; unshift: +14082550
    return window.join(SEPARATOR)                       // join: +14082583
```

Constants:
- Assistant-role filter literal: `"assistant"` (bundle.js:+14082341)
- Maximum history messages included: **3** (bundle.js:+14082361)
- History ellipsis sentinel: `"..."` (bundle.js:+14082542)

Analysis basis: CC v2.1.161 bundle.js:+14082318

---

### 3. Tool-Use Stringifier (`Yif`)

```
function stringifyToolUse(toolUseContext):
    jsonString = JSON.stringify(toolUseContext)   // SH→JSON.stringify: +184155
    return String(jsonString)                     // +14082278
```

Analysis basis: CC v2.1.161 bundle.js:+14082252

---

### 4. Side-Query Dispatcher (`gu`)

The side-query dispatcher assembles a complete API request payload as a `"side_query"` call (literal: +13322059) and routes it through the full API pipeline (`vU`). Key behaviours observed in the call graph:

```
async function issueSideQuery(systemPrompt, toolUseString, history, model):
    # Resolve auth (vU → KD → e3 → Sj OAuth path)
    authHeaders = resolveAuth()                    // KD: +2961728

    # Construct request headers (session ID, agent ID, app identifier)
    headers = buildHeaders({
        "x-app":                    detectAppContext(),    // +2961011
        "X-Claude-Code-Session-Id": sessionId,            // +2961057
        "x-claude-code-agent-id":   agentId,              // +2961215
    })

    # Build message list
    messages = [
        { role: "user", content: toolUseString },
        ...history
    ]

    # Stream and collect response
    stream = await openStream(messages, headers)   // CzL → SzL: +2969921
    chunks = await collectChunks(stream)           // SzL watchdog: +2967855

    # Hash for cache dedup (SLA → O7K.createHash sha256)
    cacheKey = sha256(systemPrompt + toolUseString) // SLA: +13322222

    return parseStreamedResponse(chunks)
```

Timeout constants visible in the call graph:
- Stream byte-watchdog idle timeout: **15 000 ms** (bundle.js:+2967646)
- Stream byte-watchdog hard cap: **120 000 ms** (bundle.js:+2967664)
- Token-refresh lock retry limit: **5** attempts (bundle.js:+3006535)

Analysis basis: CC v2.1.161 bundle.js:+13322027 (gu→vU)

---

### 5. MCP Tool Prefix Check (`t9`)

```
function isMcpTool(toolUseContext):
    if Object.hasOwn(toolUseContext, "name"):       // +3200789
        return toolUseContext.name.startsWith("mcp__")  // +3200841
    return false
```

Literal prefix: `"mcp__"` (bundle.js:+3200854)
MCP tool type label: `"mcp_tool"` (bundle.js:+3200869)

Analysis basis: CC v2.1.161 bundle.js:+14083580 (jJK→t9)

---

### 6. Config Access Guard (`nDH`)

The config subsystem called during handler setup enforces an access guard:

```
function readConfig(path):
    if not configAccessAllowed():
        throw new Error("Config accessed before allowed.")   // +3251241
    content = fs.readFileSync(path, "utf-8")                // +3251297, encoding: +3251324
    parsed  = JSON.parse(content)                           // m6→JSON.parse: +184932
    if parsed is ENOENT:                                    // +3251471
        return defaultConfig()
    return parsed
```

Analysis basis: CC v2.1.161 bundle.js:+3251235

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — success | `tengu_permission_explainer_generated` (bundle.js:+14083530) |
| Telemetry — error | `tengu_permission_explainer_error` (bundle.js:+14083742) |
| Telemetry — API success | `tengu_api_success` (bundle.js:+13323512) — emitted by side-query dispatcher |
| Telemetry — stream watchdog | `tengu_byte_watchdog_fired_late` (bundle.js:+2968646), `tengu_byte_stream_idle_timeout_ms` (bundle.js:+2967435) |
| Telemetry — OAuth | `tengu_oauth_token_refresh_starting`, `tengu_oauth_token_refresh_lock_*` family (bundle.js:+3007149 et al.) |
| Telemetry — config | `tengu_config_parse_error` (bundle.js:+3251872) |
| appState changes | None directly; timestamp recorded internally via `Date.now()` (bundle.js:+14082766) |
| Hook registration | File-watch registered via `bXL → Pq8.watchFile` (bundle.js:+3247626) for config reload; unregistered via `Pq8.unwatchFile` (bundle.js:+3247959) |
| Sound | None observed in depth-2 traversal |
| Error label — abort | `"AbortError"` swallowed silently (bundle.js:+14084200) |
| Error label — API | `"api_error"` triggers `tengu_permission_explainer_error` (bundle.js:+14084271) |
| Named tool role | `"permission_explainer"` (bundle.js:+14083105) — used as the internal agent role label |
| Response block type | `"tool_use"` (bundle.js:+14083260) — the handler searches the streamed response for a block with this type |

---

## Version History

| Version | Change |
|---|---|
| v2.1.161 | Initial analysis |

---

## Common Mistakes

1. **Treating this as an interactive slash command.** The registration `type` is `"tool"`, not `"prompt"` or `"action"`. It is dispatched programmatically by the permission-decision subsystem; typing `/explain_command` in the REPL is not its intended invocation path.
2. **Expecting a description string.** The `description` field is `null` (bundle.js:+14083047). Do not rely on it for UI display.
3. **Assuming all tool names are processed equally.** The handler specifically branches on the `"mcp__"` prefix (bundle.js:+3200841) to distinguish MCP tools from built-in tools; callers must pass a correctly formed `toolUse` object with a `name` property.
4. **Ignoring the history window cap.** Only the last **3** assistant messages are included in the explainer context window (bundle.js:+14082361). Passing a long conversation does not increase explainer accuracy; the window is hard-capped before the API call.
5. **Not handling `null` returns.** The handler returns `null` on `AbortError` and on missing parsed output. Callers must check for `null` before rendering the explanation.
6. **Confusing `"permission_explainer"` with a user-visible tool name.** The string `"permission_explainer"` (bundle.js:+14083105) is an internal agent-role label used in telemetry and routing, not a user-facing command name.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `jJK` | Main async handler for `explain_command` (arbor_handler, direct resolution) |
| `HMA` | Pre-handler setup / config initialisation called from `jJK` |
| `y6` | Config reader core (reads, parses, caches config file) |
| `nDH` | Low-level config file I/O with access guard and backup logic |
| `Dj_` | Config schema default applicator |
| `rcq` | Config backup directory resolver |
| `Xj_` | Backup path constructor (join + relative path helper) |
| `bXL` | Config file watcher registration/unregistration |
| `er` | Config change event emitter |
| `Y9` | Hook registration dispatcher (tYA.register) |
| `Yif` | Tool-use context stringifier (JSON.stringify + String coercion) |
| `SH` | JSON serialisation utility (JSON.stringify wrapper) |
| `wif` | Conversation history window builder (filter, reverse, slice, join) |
| `lq` | Model-name normaliser (alias table lookup) |
| `xHH` | Model alias resolver core |
| `s9` | Model string canonicaliser (trim, lowercase, alias map) |
| `xP` | Model string pre-processor |
| `gu` | Side-query dispatcher (assembles and fires the permission-explainer API request) |
| `vU` | Full API request pipeline (auth, headers, streaming, parsing) |
| `Nw` | Async-store context accessor |
| `IzL` | Session-ID parser (split, trim, indexOf, slice) |
| `W9` | App-context detector (bg/daemon/cli-bg/cli) |
| `bzH` | WIF credential exchange handler |
| `lr` | Gateway JWT store accessor |
| `Bs6` | Gateway token store reader |
| `N6` | Numeric ID resolver |
| `XN` | ID padding/formatting helper |
| `BL_` | URL encoder for auth header (replace + encodeURIComponent) |
| `pH` | String coercion primitive |
| `T3` | OAuth token manager orchestrator |
| `ND_` | OAuth token refresh with lock/retry logic |
| `Vwq` | Boolean coercion helper |
| `KD` | Auth-provider selector (API key / OAuth / Bedrock / Vertex etc.) |
| `eK` | Auth provider base helper |
| `Sj` | OAuth profile resolver (profile-implicit, user_oauth) |
| `pM` | Provider-type mapper |
| `jj` | Provider config accessor |
| `e3` | API-key / helper auth resolver |
| `dD6` | Token descriptor builder |
| `TdH` | Token data holder constructor |
| `n3` | No-op / null placeholder |
| `vzL` | API call batch helper |
| `PdH` | Pending-request descriptor |
| `B_` | Boolean state flag |
| `Hi6` | Proxy-auth helper invoker |
| `yTH` | Proxy-auth token holder |
| `mtA` | Proxy-auth token constructor |
| `wv4` | Integer parser with NaN guard |
| `Ny` | Nullable value guard |
| `BX` | Header validation helper |
| `CzL` | HTTP request builder and streamer |
| `PA` | Provider-type assertion helper |
| `l7` | Request lifecycle tracker |
| `M` | Active-request registry (Map) |
| `LmH` | Request metadata logger |
| `pjq` | Config accessor from within request context |
| `fD_` | Config loader for request |
| `bzL` | Authorization header scrubber (masks `<opaque>`) |
| `RzL` | Response ID extractor (cf-ray / x-amzn-requestid) |
| `hzL` | Timeout calculator (min/max/isFinite) |
| `SzL` | Stream watchdog and chunk reader |
| `IY` | Model-string provider-prefix detector |
| `d$6` | Provider-prefix detection helper |
| `KB4` | Header prefix checker (startsWith) |
| `Ha6` | Case-insensitive header comparison helper |
| `HD` | Proxy configuration resolver |
| `pQ` | URL scheme / port / host parser |
| `VBH` | Tunnel agent selector |
| `ptA` | Proxy tunnel agent constructor |
| `hA_` | Proxy bypass checker (isIP, split, includes) |
| `CA_` | Proxy URL parser |
| `NzL` | Gateway/environment endpoint resolver |
| `B88` | Endpoint URL builder |
| `EN` | Environment variable reader |
| `TmH` | Model-tier detector |
| `GEH` | Endpoint-list searcher (kmK.find + startsWith) |
| `Rq` | Custom OAuth URL validator |
| `pzH` | Gateway JWT refresh dispatcher |
| `nB8` | JWT refresh pre-check |
| `$6L` | Gateway token POST handler |
| `qu6` | Gateway refresh scheduler |
| `lB8` | Timestamp recorder |
| `CD6` | Response header normaliser (toLowerCase) |
| `yDH` | SDK error/warn logger (console.error) |
| `SVH` | Request header assembler (_9 + IY + Iy) |
| `_9` | Header-set builder (Aa6 + bP + kF8) |
| `Aa6` | Extra-header injector (Object.entries) |
| `bP` | Content-type header cleaner |
| `kF8` | Feature-flag header injector |
| `Iy` | Provider-specific header appender |
| `euf` | User-message finder (find by role) |
| `SLA` | Request cache-key hasher (sha256 hex) |
| `gs6` | Prompt-cache control header builder |
| `v1` | String ID builder |
| `Zq8` | Provider assertion for Bedrock/Vertex |
| `HyH` | Main API request assembler (model + messages + cache_control) |
| `wA` | Session dispatch helper |
| `SR` | Array/string inclusion validator |
| `VF8` | Cache-control block builder |
| `j6` | Config-backed session writer |
| `gY6` | Session write helper A |
| `QY6` | Session write helper B |
| `Qx` | Session write core |
| `Lq8` | Session dedup tracker |
| `vF8` | Cache-control variant builder |
| `kV` | HIPAA / compliance mode checker |
| `PD_` | Compliance mode loader |
| `hVH` | Compliance header injector |
| `kL_` | Blocked-capability list checker |
| `U7K` | Usage-metric accumulator |
| `a88` | Request temperature/sampling patcher |
| `oX` | Message content mapper |
| `KwH` | Tool-input formatter (zL + hU) |
| `hU` | Tool sandbox executor |
| `W8` | Tool execution environment builder |
| `zL` | Tool input schema validator |
| `u$H` | Unknown-field stripper |
| `NX6` | Nested-agent router |
| `qD9` | Agent-type dispatcher |
| `elL` | Agent capability gate |
| `yH` | Error logger with telemetry |
| `YrH` | Agent ID resolver |
| `vX6` | Agent hash builder |
| `m58` | Content hash creator (createHash) |
| `vc` | Agent-context normaliser |
| `tlL` | Agent-string prefix stripper |
| `p58` | Agent-ID prefix handler |
| `oZ_` | String index/slice utility |
| `d8H` | Thread-type prefix checker |
| `EK6` | API response post-processor |
| `t9` | MCP-tool prefix checker (Object.hasOwn + startsWith "mcp__") |
| `Dif` | Explanation block parser (extracts structured output from tool_use block) |
| `F6` | Logger / debug output helper |
| `Ox` | String prefix stripper (startsWith + slice) |
| `v8` | Error code classifier |
| `m6` | Safe JSON parser |
| `d` | Low-level logger |
| `h` | Focus/activity tracker |
| `hH` | Feature-flag success logger |
| `RH` | Feature-flag failure logger |
| `S` | PTY/daemon write stream |
| `D` | Daemon supervisor state machine |
| `G` | Remote-control event handler |
| `P` | IPC socket framer |
| `J` | IPC socket reference |
| `Y95` | Daemon session manager (full lifecycle) |
| `D95` | Session cleanup and respawn orchestrator |
| `q1` | File-state cache manager |
| `aK` | File-tree walker |
| `se` | Symlink scanner |
| `z95` | Scroll-position updater |
| `l` | Loop scheduler |
| `i` | MCP update applier |
| `c` | PTY output post-processor |
| `W` | MCP connection manager |
| `E` | MCP event queue |
| `o` | MCP lifecycle orchestrator |
| `B` | Abort-signal registry |
| `g` | Output flush timer |
| `TH` | String coercion wrapper |
| `I` | Away-summary generator |
| `V` | Rate-limit / token-budget checker |
| `N` | Log-level classifier (debug/error/warn) |
| `H` | Bootstrap fetcher |
| `A` | Sorted-list utility |
| `f` | File handle abstraction |
| `L` | Promise-tracking set |
| `w` | Background-process manager |
| `X` | Terminal repaint controller |
| `Z` | Stream controller helper |
| `Nw` | AsyncLocalStorage getStore accessor |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.