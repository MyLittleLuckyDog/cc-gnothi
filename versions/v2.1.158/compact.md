---
type: feature-spec
feature: "compact"
cc_version: "2.1.158"
updated: "2026-06-02"
tags: ["compact", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.158 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/compact`

> Analysis basis: CC v2.1.158 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.158

---

## Overview

`/compact` frees up context window space by summarizing the current conversation history into a condensed form, replacing the full message history with a compact summary. It optionally accepts custom summarization instructions as an argument, and supports both manual (user-triggered) and automatic (reactive/threshold-triggered) compaction paths. The command is also available in non-interactive (SDK/CI) mode via `thinClientDispatch: "post-text"`.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `compact` |
| description | `Free up context by summarizing the conversation so far` |
| argumentHint | `<optional custom summarization instructions>` |
| supportsNonInteractive | `true` |
| thinClientDispatch | `post-text` |
| module_id | `QN1` |
| load_inline | `true` |
| loc_byte | `10789648` |
| loc_byte_end | `10789961` |
| arbor_handler.name | `GiL` |
| arbor_handler.fqn | `claude-2.1.158::GiL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.158 bundle.js:+10789648

---

## Input Branching

The `/compact` command has more than three distinct execution branches, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/compact [optional instructions] invoked"] --> B{Message history empty?}
    B -- "Yes (literal: 'No messages to compact')" --> ERR1[Return error to user]
    B -- No --> C{PreCompact hook registered?}
    C -- Yes --> D[Run PreCompact hook via hookRunner]
    D --> E{Hook result: block?}
    E -- Yes --> BLOCKED["Emit 'compaction-blocked-by-hook' notification\n(bundle.js:+9948147)"]
    E -- No --> F[Proceed with compaction]
    C -- No --> F
    F --> G[Trim and validate optional custom instructions]
    G --> H[Build summarization context via contextBuilder]
    H --> I{Context too long for model?}
    I -- Yes --> PTLERR["Emit compact_prompt_too_long\n(bundle.js:+9950206)\nRetry with stripped media"]
    I -- No --> J[Invoke summarization API call\n(compaction agent — text-only, no tools)]
    J --> K{API response OK?}
    K -- "No (API error)" --> APIERR["Emit compact_api_error\n(bundle.js:+9950878)"]
    K -- "No (empty/no text)" --> NOSUMM["Emit compact_no_summary\n(bundle.js:+9950586)"]
    K -- Yes --> L[Extract summary text]
    L --> M[Insert compact_boundary marker in message history\n(literal: 'compact_boundary', bundle.js:+10494110)]
    M --> N[Replace pre-boundary messages with summary]
    N --> O[Emit 'Conversation compacted' notification\n(bundle.js:+10493666)]
    O --> P[Run PostCompact hook if registered]
    P --> Q[Update appState / emit telemetry]
    Q --> DONE[Return success — context freed]

    PTLERR --> RETRY{Media strippable?}
    RETRY -- Yes --> J
    RETRY -- No --> FAIL["Emit compaction failed\n(bundle.js:+10785723)"]
    APIERR --> FAIL
    NOSUMM --> FAIL
```

---

## Behavioral Spec

### 1. Entry Point — Handler `GiL` (main compact handler)

Analysis basis: CC v2.1.158 bundle.js:+10788679

```
async function compactCommandHandler(context, args):
    // args is the optional custom summarization instructions string
    rawInstructions = args ?? ""

    messages = getConversationMessages(context)
    if messages is empty:
        raise Error("No messages to compact")   // bundle.js:+10788710

    customInstructions = rawInstructions.trim()  // bundle.js:+10788742

    // Run pre-compact logic (hooks, state setup)
    await runPreCompactPhase(context, customInstructions)   // calls TiL, bundle.js:+10788777

    // Notify SDK clients that compaction is complete (post-text dispatch)
    updateSDKStatus(context)    // calls SIH, bundle.js:+10788944

    // Reset autonomous loop delivery counter
    resetAfterCompact(context)  // calls Ka, bundle.js:+10788969

    // Finalize and notify user
    await emitCompactFinishNotification(context)  // calls FN1, bundle.js:+10789041

    return buildCompactResult(context)
```

---

### 2. Pre-Compact Phase — `TiL`

Analysis basis: CC v2.1.158 bundle.js:+10784762

```
async function preCompactPhase(context, customInstructions):
    startTime = performance.now()

    // Stage 1: build summarization context (messages, system prompt, memory, tools)
    summarizationContext = await buildSummarizationContext(context)  // calls fE → uuL → Dl_, bundle.js:+10784784

    // Stage 2: fire PreCompact hooks (parallel with context build if configured)
    hookResults = await Promise.all([
        runPreCompactHooks(context),                   // calls Uc, bundle.js:+10784826
        buildAgentContext(context),                    // calls gN1, bundle.js:+10784901
    ])

    // Stage 3: notify progress state
    emitProgress("compact_progress", context)          // literal bundle.js:+10784625
    emitProgress("hooks_start", context)               // literal bundle.js:+10784656
    emitProgress("pre_compact", context)               // literal bundle.js:+10784679

    // Stage 4: check if PreCompact hook blocked compaction
    if hookResults indicate block:
        emitNotification("compaction-blocked-by-hook", severity="warning")  // bundle.js:+9948147
        return BLOCKED

    // Stage 5: emit sdk_status = "compacting"
    emitSDKStatus("compacting", context)               // literal bundle.js:+10784741

    // Stage 6: invoke the actual compaction loop
    compactResult = await runCompactionLoop(
        context,
        summarizationContext,
        customInstructions,
        trigger="manual"                               // literal bundle.js:+10784838
    )                                                  // calls ZiL, bundle.js:+10785216

    // Stage 7: handle failure cases with user-visible errors
    if compactResult.error == "prompt_too_long":
        showError("Compaction failed · conversation could not be reduced below the context limit")
        // bundle.js:+10785723
    else if compactResult.error == "media_too_large":
        showError("Compaction failed · attached media exceeds size limits")
        // bundle.js:+10785845
    else if compactResult.error:
        showError("unknown error")                     // bundle.js:+10785969

    // Stage 8: record compact metadata in appState
    setAppState("compactMetadata", compactResult.metadata)  // bundle.js:+10786053

    // Stage 9: emit compact_end telemetry
    emitTelemetry("compact_end", {
        success: compactResult.success,
        duration: performance.now() - startTime,
    })                                                 // literal bundle.js:+10786597

    return compactResult
```

---

### 3. Summarization Context Builder — `Dl_`

Analysis basis: CC v2.1.158 bundle.js:+10477945

Responsible for serializing the full conversation history into a format suitable for the summarization API call. Key behaviors:

- Collects messages by role: `"assistant"`, `"user"`, `"api_system"` (bundle.js:+9999222, +9999244, +9999261).
- Handles attachment types: `"image"`, `"text"`, `"file"`, `"notebook"`, `"pdf"` (bundle.js:+10479119 ff.).
- Handles context-efficiency metadata block types: `"context_efficiency"`, `"deferred_tools_delta"`, `"agent_listing_delta"`, `"mcp_instructions_delta"`, etc. (bundle.js:+10486666 ff.).
- Handles special message types used for compact-related bookkeeping: `"compaction"`, `"compact_boundary"` (bundle.js:+6619474, +10494110).
- For MCP resources already fetched, injects the literal: `"Full contents of resource:"` / `"Do NOT read this resource again unless you think it may have changed…"` (bundle.js:+10484434, +10484508).
- Raises a typed error `"normalizeAttachmentForAPI"` for unknown attachment shapes (bundle.js:+10490292).

---

### 4. Compaction Loop — `ZiL`

Analysis basis: CC v2.1.158 bundle.js:+10786978

```
async function compactionLoop(context, summarizationContext, customInstructions, trigger):
    startTime = performance.now()

    // Determine which precomputed compact to use, if any
    precomputed = tryConsumePrecomputedCompact(context)   // calls CI_, krH
    if precomputed:
        emitTelemetry("tengu_precomputed_compact_consumed")  // bundle.js:+6663383
        // Apply precomputed summary directly — skip API call
        return applyCompactResult(precomputed, context)

    // Find compact_boundary in message list
    boundaryIndex = findCompactBoundary(messages)         // calls bI_, bundle.js:+10787341
    if boundaryIndex == -1:
        emitTelemetry("boundary_uuid_missing")            // literal bundle.js:+10787421
        // Fall through: compact everything

    // Slice messages to summarize (those before boundary)
    messagesToSummarize = messages.slice(0, boundaryIndex)

    // Attempt summarization with retry on media error
    result = await callSummarizationAPI(
        messagesToSummarize,
        customInstructions,
        context
    )                                                     // calls fE (API query engine)

    if result.error == "media_too_large":
        // Retry with media stripped
        stripped = stripMediaFromMessages(messagesToSummarize)
        result = await callSummarizationAPI(stripped, customInstructions, context)

    recordCompactMetrics(result, startTime)               // calls sM8, bundle.js:+10787409

    return result
```

---

### 5. Summarization API Call — `keH` (core compact executor)

Analysis basis: CC v2.1.158 bundle.js:+9948974

This function implements the full summarization request lifecycle:

```
async function coreCompactExecutor(context, messages, customInstructions, options):
    trigger = options.trigger   // "manual" | "compact_auto" | "compact_manual"
    // literals bundle.js:+9948934, +9948949

    emitOtelSpan("claude_code.compaction", trigger)   // bundle.js:+9948998

    // Verify there are messages to compact
    if messages.length == 0:
        emitTelemetry("tengu_compact", {result: "compact_not_enough_messages"})
        // bundle.js:+9949136
        return {error: "no_messages"}

    // Build system prompt for summarization agent
    // System: "You are a helpful AI assistant tasked with summarizing conversations."
    // bundle.js:+9962047
    systemPrompt = buildSummarizationSystemPrompt(customInstructions)

    // Serialize messages for summarization
    serializedMessages = serializeMessagesForCompact(messages)   // calls yX1, bundle.js:+9950056

    // Check if serialized prompt is too long
    if tokenCount(serializedMessages) > modelContextLimit:
        emitTelemetry("tengu_compact_ptl_retry")   // bundle.js:+9950246
        emitResult("compact_prompt_too_long")      // bundle.js:+9950206
        return {error: "prompt_too_long"}

    // Run API query (compaction agent — tools are DENIED during compaction)
    // literal: "Tool use is not allowed during compaction" bundle.js:+9959728
    // literal: "compaction agent should only produce text summary" bundle.js:+9959808
    apiResult = await runCompactionAPIQuery(
        systemPrompt,
        serializedMessages,
        toolPolicy="deny"
    )

    // Validate response
    if apiResult has no text content:
        emitResult("compact_no_summary")           // bundle.js:+9950586
        emitTelemetry("tengu_compact_failed")
        return {error: "no_summary",
                message: "Failed to generate conversation summary - response did not contain valid text content"}
        // bundle.js:+9950615

    if apiResult is API error:
        emitResult("compact_api_error")            // bundle.js:+9950878
        emitTelemetry("tengu_compact_failed")
        return {error: "api_error"}

    summaryText = apiResult.text

    // Store compact cache prefix for cache-sharing optimization
    emitTelemetry("tengu_compact_cache_prefix")    // bundle.js:+9949774

    // Apply result to conversation state
    applyCompactResult(summaryText, messages, context)

    emitTelemetry("tengu_compact", {
        result: "compact_full",                    // bundle.js:+9951337
        trigger: trigger,
        token_savings: ...,
    })

    return {success: true, summary: summaryText}
```

---

### 6. PreCompact Hook Runner — `Uc`

Analysis basis: CC v2.1.158 bundle.js:+12987255

```
async function preCompactHookRunner(context):
    // Collect all registered PreCompact hooks
    // literal "PreCompact" bundle.js:+12987282
    hooks = collectHooks("PreCompact", context)

    if hooks is empty:
        return {blocked: false}

    results = await runHookBatch(hooks, context)   // calls j7, H0

    for each result in results:
        if result.decision == "block":
            return {
                blocked: true,
                reason: "compaction blocked by PreCompact hook",  // bundle.js:+9948181
            }

    return {blocked: false, additionalContext: aggregateContextFromHooks(results)}
```

---

### 7. PostCompact Cleanup — `Ka`

Analysis basis: CC v2.1.158 bundle.js:+6664567

```
function postCompactCleanup(context):
    // Reset precomputed compact state if consumed
    consumeCompactState(context)            // calls tM8, KNH
    // Clear caches that are invalidated by compaction
    clearCompactionCaches(context)          // calls GJ6, Q8H, H$8, CI9
    // Flush cached items
    flushPostCompactItems(context)          // calls yI9, vjH
    // Reset autonomous loop delivery counter
    resetAutonomousLoopDelivered(context)   // calls Dr7.resetAutonomousLoopDelivered, bundle.js:+6664689
    // Emit post_compact_cleanup telemetry
    emitLabel("post_compact_cleanup")       // literal bundle.js:+6664583
```

---

### 8. Reactive Compaction — `nM8` / `pI_`

Analysis basis: CC v2.1.158 bundle.js:+6649317

This is the automatic background compaction path (distinct from manual `/compact`):

```
async function reactiveCompact(context):
    emitLabel("compact_reactive")          // bundle.js:+6670684

    groups = groupMessagesForCompaction(context)   // calls HO, bundle.js:+6649317

    if groups.length < 2:
        log("Reactive compact: fewer than 2 groups, nothing to compact")
        // bundle.js:+6649392
        emitResult("too_few_groups")       // bundle.js:+6649482
        return

    assistantMessages = filterAssistantMessages(groups)

    if assistantMessages is empty:
        log("Reactive compact: no assistant messages in summarize set, bailing")
        // bundle.js:+6649954
        emitResult("exhausted")            // bundle.js:+6650056
        return

    emitTelemetry("tengu_reactive_compact_attempt")    // bundle.js:+6650115

    result = await coreCompactExecutor(context, assistantMessages, "", {trigger: "compact_auto"})

    if result.success:
        emitTelemetry("tengu_reactive_compact_succeeded")  // bundle.js:+6670706
    else:
        emitTelemetry("tengu_reactive_compact_failed")     // bundle.js:+6668325
        log("reactive compaction failed")                  // bundle.js:+10786389
```

---

### 9. `compact_boundary` Marker

Analysis basis: CC v2.1.158 bundle.js:+10494110

The string `"compact_boundary"` is a special system-role message type injected into the message array to mark the split point between summarized history and live context:

```
function insertCompactBoundary(messages, summaryText):
    boundaryMessage = {
        role: "system",            // literal bundle.js:+10494088
        type: "compact_boundary",  // literal bundle.js:+10494110
        content: summaryText,
        index: messages.length,    // values 1/0 used for boundary detection, bundle.js:+10494164/+10494169
    }
    return [boundaryMessage, ...messagesAfterBoundary]
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_compact` (bundle.js:+9952179), `tengu_compact_failed` (bundle.js:+9963326) |
| Telemetry — reactive | `tengu_reactive_compact_attempt`, `tengu_reactive_compact_succeeded`, `tengu_reactive_compact_failed` |
| Telemetry — cache | `tengu_compact_cache_prefix`, `tengu_compact_cache_sharing_success`, `tengu_compact_cache_sharing_fallback` |
| Telemetry — precomputed | `tengu_precomputed_compact_consumed`, `tengu_precomputed_compact_discarded` |
| Telemetry — post-compact | `tengu_post_compact_file_restore_success`, `tengu_post_compact_file_restore_error` |
| Telemetry — errors | `tengu_compact_ptl_retry`, `tengu_compact_cache_prefix`, `tengu_compact_full` |
| Hook events fired | `PreCompact` hook before compaction; `PostCompact` hook after successful compaction |
| appState changes | `compactMetadata` written (bundle.js:+10786053); `compact_boundary` inserted into message history |
| SDK status | `"compacting"` emitted via `thinClientDispatch: "post-text"` (bundle.js:+10784741) |
| Progress notifications | `compact_progress`, `hooks_start`, `pre_compact`, `compact_start`, `compact_end` (bundle.js:+10784625–10786597) |
| Notification to user | `"Conversation compacted"` (bundle.js:+10493666); `"Compacted <N> messages"` (bundle.js:+10788110) |
| Autonomous loop reset | `Dr7.resetAutonomousLoopDelivered` called on each compact (bundle.js:+6664689) |
| Caches cleared | Precomputed compact state, agent context caches, post-compact file references |
| Tool use during compact | Explicitly denied: `"Tool use is not allowed during compaction"` (bundle.js:+9959728) |
| Sound | None observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.158 | Initial analysis |

---

## Common Mistakes

1. **Running `/compact` on an empty conversation**: The handler immediately returns an error — `"No messages to compact"` (bundle.js:+10788710). Ensure at least one exchange has occurred before invoking.
2. **Expecting tool calls to work during compaction**: The summarization agent explicitly runs in a no-tools mode; any tool invocation is denied with `"Tool use is not allowed during compaction"` (bundle.js:+9959728).
3. **Assuming `/compact` always uses the current model**: The summarization sub-agent may use a different model determined by the compaction context builder, not necessarily the model active in the main session.
4. **Canceling mid-compact**: The handler emits `"Compaction canceled."` (bundle.js:+10789250) if aborted; the conversation history may be in a partial state — a `compact_boundary` marker may or may not have been inserted.
5. **Expecting PreCompact hooks to always allow compaction**: A `PreCompact` hook returning `block` will prevent compaction entirely and emit a `"compaction-blocked-by-hook"` warning notification (bundle.js:+9948147).
6. **Using `/compact` in non-interactive pipelines without checking `supportsNonInteractive`**: This command supports non-interactive mode (`supportsNonInteractive: true`, `thinClientDispatch: "post-text"`), but the caller must handle the `post-text` dispatch response format.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `GiL` | Main compact command async handler (Arbor-resolved) |
| `TiL` | Pre-compact phase orchestrator |
| `ZiL` | Compaction loop (finds boundary, calls summarization API) |
| `keH` | Core compact executor (builds prompt, calls API, validates response) |
| `Uc` | PreCompact hook runner |
| `gN1` | Agent context builder (system prompt, memory, tool context) |
| `xT` | System prompt / context assembly coordinator |
| `Dl_` | Summarization context serializer (message normalizer for API) |
| `uuL` | Summarization message formatter |
| `fE` | API query engine (used by compaction agent) |
| `nM8` | Reactive compact main logic |
| `pI_` | Reactive compact outer wrapper |
| `qr7` | Reactive compact API sub-loop |
| `Kr7` | Reactive compact token-count helper |
| `Ka` | Post-compact cleanup handler |
| `SIH` | SDK status emitter (sets "compacting") |
| `FN1` | Compact finish notification emitter |
| `CI_` | Precomputed compact consumer |
| `krH` | Precomputed compact applicator |
| `bI_` | compact_boundary finder in message list |
| `sM8` | Compact metrics recorder |
| `HO` | Message group builder (used by reactive compact) |
| `RE8` | Message slicer helper |
| `Vj` | Message boundary utility |
| `pc` | Context/state access wrapper |
| `R_` | App state reader |
| `G6` | Feature flag / experiment evaluator |
| `S6` | Settings file manager |
| `szH` | Config file reader/writer |
| `m17` | File watcher for config |
| `D4` | OTEL metrics emitter |
| `GNH` | OTEL attribute builder |
| `DwH` | OTEL metric record wrapper |
| `j7` | Hook execution dispatcher |
| `H0` | Individual hook runner |
| `dh8` | Shell/process hook executor |
| `P9A` | HTTP hook executor |
| `W9A` | MCP tool hook executor |
| `Qh8` | Hook output JSON parser |
| `NAK` | Hook output text parser |
| `V9A` | Hook type dispatcher |
| `E9A` | Third-party hook filter |
| `SAH` | Hook plugin metrics collector |
| `RX1` | Summarization API request loop |
| `VqK` | Main API query handler (stream + non-stream) |
| `EH6` | API query entry wrapper |
| `mV6` | Tool-search mode decision logic |
| `bM8` | Message token counter |
| `xM8` | Token rounding utility |
| `ii7` | Per-message token cache |
| `A$8` | Full compaction turn runner |
| `hjH` | Compaction turn result assembler |
| `UI_` | Message role filter |
| `RSH` | Anthropic-origin message filter |
| `ET` | Message-to-API-block converter |
| `Rf` | Token count rounding helper |
| `yX1` | Message serializer for compact prompt |
| `qlH` | Token overflow checker |
| `o4H` | Array-based token overflow checker |
| `_2_` | Token count parser |
| `qI` | Special prefix checker |
| `Wu` | Path/PII scrubber for log output |
| `VrH` | Message push helper |
| `TI9` | Token window calculator |
| `xT` | Full system prompt assembler |
| `WY6` | Memory / CLAUDE.md loader |
| `jP5` | Schedule/routine injector |
| `F9A` | Context management mode selector |
| `LP5` | System prompt trimmer |
| `PP5` | System prompt combiner |
| `TP5` | Environment info block builder |
| `ZP5` | Simple environment string builder |
| `VP5` | Worktree/bg-session path injector |
| `vP5` | Additional working directory injector |
| `IP5` | Brief mode checker |
| `hP5` | Focus block builder |
| `DP5` | Scratchpad block builder |
| `OP5` | Context management reminder builder |
| `zP5` | Verified-vs-assumed environment block |
| `YP5` | Output style injector |
| `JP5` | Tone/style block builder |
| `SP5` | Output style wrapper |
| `EI9` | Tool result context injector |
| `zm` | System prompt final assembler |
| `KC` | System prompt string builder |
| `Z_` | Module loader helper |
| `V_` | Last-message finder (for compact state) |
| `LV8` | Compact message formatter |
| `fV8` | Compact message extractor |
| `d0` | Main agent turn runner |
| `s08` | Agent state updater |
| `Om` | Turn lifecycle manager |
| `e7H` | Tool-call filter for compact messages |
| `Jr7` | Tool-result builder |
| `bv6` | Tombstone/OQL checker |
| `CT1` | Tombstone injector |
| `hlL` | Forked-agent result merger |
| `VAH` | Compact message renderer |
| `Jh` | Random bytes generator |
| `wZ1` | Random UUID wrapper |
| `cP6` | Compact UUID generator |
| `d8H` | Message state updater |
| `IuL` | Tool-result array checker |
| `NuL` | Tool-result normalizer |
| `K$8` | Tool permission fetcher |
| `$$8` | Local agent state reader |
| `L$8` | Plan file reference resolver |
| `M$8` | Plan message state reader |
| `f$8` | Full-context message builder |
| `s7H` | Session-start hook trigger |
| `bIH` | Message sort/dedup helper |
| `xIH` | Session message push |
| `JB` | Plugin hook session loader |
| `jr7` | Full message processing pipeline |
| `ta7` | Model selector (opus/sonnet) |
| `LoH` | Model tier loader |
| `IX` | Keybinding action dispatcher |
| `j98` | Keybinding action runner |
| `J98` | Keybinding action registry |
| `SX1` | REPL loop manager |
| `wI` | Input queue processor |
| `JV7` | Input cache manager |
| `FIH` | Status line updater |
| `tc_` | Compact result notification builder |
| `dw` | Output token counter resetter |
| `uI_` | Post-compact state finalizer |
| `GJ6` | Cache-layer invalidator |
| `tM8` | Precomputed compact state consumer |
| `Q8H` | Compact cache state flusher |
| `H$8` | oG1 cache clearer |
| `CI9` | dP6/kI_ cache clearer |
| `yI9` | Compact history clearer |
| `vjH` | Compact state resetter |
| `f26` | OTEL compaction span builder |
| `MLH` | OTEL tracer reference |
| `Lv` | OTEL span helper |
| `jh` | OTEL active span checker |
| `axL` | Compaction retry classifier |
| `on` | Event emitter |
| `EK` | Experiment key lookup |
| `RH` | JSON serializer wrapper |
| `EH` | String error formatter |
| `SH` | Log/error emitter |
| `hH` | Debug logger |
| `bH` | Warning logger |
| `N` | Message normalizer |
| `d` | Storage/persistence helper |
| `kY` | Performance timing helper |
| `AM` | Agent mode resolver |
| `CS` | React component (status bar) |
| `O_` | React component (output) |
| `So` | Tool allowlist checker |
| `X8H` | Tool cache lookup |
| `ho` | Tool result formatter |
| `gP6` | Summary text extractor |
| `Ar7` | Summary text cleaner |
| `lM8` | Summary text trimmer |
| `qN` | React renderer |
| `I6` | React element builder |
| `mS` | React text element |
| `CH` | String coercion helper |
| `Zx` | Settings store reader |
| `NR` | Settings schema validator |