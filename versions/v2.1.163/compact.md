---
type: feature-spec
feature: "compact"
cc_version: "2.1.163"
updated: "2026-06-05"
tags: ["compact", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.163 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/compact`

> Analysis basis: CC v2.1.163 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.163

---

## Overview

`/compact` frees up context window space by summarizing the current conversation into a compact form, replacing the message history with a structured summary. It supports optional custom summarization instructions passed as an argument and can run in both interactive (REPL) and non-interactive modes. The command triggers a full pipeline: PreCompact hook execution, an API-based summarization call, state reset, and a PostCompact hook.

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
| module_id | `Jmq` |
| load_inline | `true` |
| loc_byte | `11025373` |
| loc_byte_end | `11025673` |
| loc_line | `7420` |
| arbor_handler.name | `kYf` |
| arbor_handler.fqn | `claude-2.1.163::kYf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.163 bundle.js:+11025373

---

## Input Branching

The handler has more than 3 distinct execution branches, differentiated by message presence, hook outcomes, API response state, and error type. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/compact invoked"] --> B{Any messages\nin conversation?}
    B -- No --> C[Return error:\n'No messages to compact']
    B -- Yes --> D[Trim optional\ncustom instructions arg]
    D --> E[Run PreCompact hooks\nvia hook pipeline]
    E --> F{Hook outcome?}
    F -- blocked --> G[Emit 'compaction-blocked-by-hook'\nwarning notification; abort]
    F -- allowed --> H[Build summarization prompt\nfrom conversation messages]
    H --> I[Call summarization API\n(compaction agent sub-call)]
    I --> J{API response?}
    J -- prompt_too_long --> K[Emit compact_prompt_too_long\ntelemetry; report failure]
    J -- no valid summary text --> L[Emit compact_no_summary\ntelemetry; report failure]
    J -- api_error --> M[Emit compact_api_error\ntelemetry; report failure]
    J -- media_too_large --> N[Report media size error\nto user]
    J -- success --> O[Extract summary text]
    O --> P[Reset conversation state\nto compacted form]
    P --> Q[Update appState with\ncompact metadata]
    Q --> R[Run PostCompact hooks\nand cleanup]
    R --> S[Emit 'Compacted N messages'\nnotification to user]
    S --> T[Register Ctrl+O keybinding\nfor transcript toggle]
    T --> U[Done]
    K --> V[Show failure message]
    L --> V
    M --> V
    N --> V
    G --> V
```

---

## Behavioral Spec

### Top-Level Handler (compactCommandHandler)

The Arbor-resolved handler is `kYf` (AsyncFunction, resolved via module_id `Jmq`).

```
async function compactCommandHandler(commandInput, context):
    // Guard: require at least one message
    if conversationMessages is empty:
        throw Error("No messages to compact")

    // Trim and capture optional custom summarization instructions
    customInstructions = commandInput.trim()

    // Phase 1: Call the hook orchestrator (pre-compact lifecycle)
    hookResult = await runPreCompactHooks(context)
    if hookResult.blocked:
        emitNotification("compaction-blocked-by-hook", severity="warning")
        return  // abort without compacting

    // Phase 2: Build summarization payload and call API
    summaryResult = await runSummarizationPipeline(
        messages=currentConversation,
        customInstructions=customInstructions,
        context=context
    )

    // Phase 3: Handle API outcome
    match summaryResult.status:
        case "prompt_too_long":
            emitTelemetry("tengu_compact_ptl_retry")
            reportFailure("Compaction failed · conversation could not be reduced below the context limit")
            return
        case "no_summary":
            emitTelemetry("tengu_compact_failed")
            reportFailure("Failed to generate conversation summary - response did not contain valid text content")
            return
        case "api_error":
            reportFailure("Compaction failed · ...")
            return
        case "media_too_large":
            reportFailure("Compaction failed · attached media exceeds size limits")
            return

    // Phase 4: Apply compact result to app state
    applyCompactedState(summaryResult.summaryText, context)
    updateAppStateWithCompactMetadata(summaryResult)

    // Phase 5: Post-compact cleanup
    runPostCompactHooks(context)
    resetAutonomousLoopDelivered()
    clearCompactCaches()

    // Phase 6: Notify user
    emitNotification("Compacted N messages", type="notification")
    registerKeybinding("ctrl+o", action="app:toggleTranscript", scope="Global")
```

Analysis basis: CC v2.1.163 bundle.js:+11024404

---

### Pre-Compact Hook Pipeline (runPreCompactHooks)

```
async function runPreCompactHooks(context):
    // Calls hook orchestrator; dispatches "PreCompact" hook event to registered hooks
    // Returns object with { blocked: bool, reason?: string }
    hookResult = await hookOrchestrator.run("PreCompact", {
        messages: currentMessages,
        customInstructions: customInstructions
    })
    return hookResult
```

Analysis basis: CC v2.1.163 bundle.js:+13278901 (literal `"PreCompact"`)

---

### Summarization Pipeline (runSummarizationPipeline)

```
async function runSummarizationPipeline(messages, customInstructions, context):
    // Build message array for compaction agent
    // Inserts a synthetic "compact_boundary" system message at computed positions
    // compact_boundary literal: "compact_boundary" at +10753725
    summarizationMessages = buildCompactionMessageSet(messages)

    // Makes an API sub-call using a dedicated compaction agent
    // The compaction agent is instructed: tool use is denied
    // ("Tool use is not allowed during compaction")
    // System prompt includes: "You are a helpful AI assistant tasked with summarizing conversations."
    response = await callCompactionAgentAPI(
        messages=summarizationMessages,
        systemPrompt=COMPACTION_SYSTEM_PROMPT,
        customInstructions=customInstructions
    )

    // Validate response
    if response.hasNoAssistantMessage:
        return { status: "no_summary" }
    if response.summaryText is empty:
        return { status: "no_summary" }
    if response.error == "prompt_too_long":
        return { status: "prompt_too_long" }
    if response.error == "media_too_large":
        return { status: "media_too_large" }

    return { status: "success", summaryText: response.summaryText }
```

Analysis basis: CC v2.1.163 bundle.js:+10207230 (`"You are a helpful AI assistant tasked with summarizing conversations."`)

---

### Message Normalization for Compaction (buildCompactionMessageSet)

```
function buildCompactionMessageSet(messages):
    // Uses vO → Mk8 → fJ call chain to normalize and slice messages
    // Inserts system-role "compact_boundary" marker
    // Literal positions:
    //   "system" role: +10753703
    //   "compact_boundary" type: +10753725
    //   index values 1 and 0: +10753779, +10753784

    normalizedMessages = normalizeMessagesForAPI(messages)
    boundaryIndex = computeBoundaryIndex(normalizedMessages)

    // Insert a compact_boundary sentinel at computed position
    boundaryMessage = { role: "system", type: "compact_boundary" }
    insertAt(normalizedMessages, boundaryIndex, boundaryMessage)

    return normalizedMessages.slice(boundaryIndex)
```

Analysis basis: CC v2.1.163 bundle.js:+10753703

---

### Compaction State Application (applyCompactedState)

```
function applyCompactedState(summaryText, context):
    // Wraps summary in <summary>...</summary> markers
    // Literal "<summary>" at +6736193

    wrappedSummary = "<summary>" + summaryText + "</summary>"

    // Replaces active message list with a new single compaction message
    // appState is updated via H.setAppState (seen at +10911573)
    // compactMetadata is stored keyed by "compactMetadata" (+11021778)
    newMessages = [buildCompactionMessage(wrappedSummary)]
    context.setAppState({ messages: newMessages, compactMetadata: { ... } })

    // Literal "Conversation compacted" at +10753281 used as message label
```

Analysis basis: CC v2.1.163 bundle.js:+6736193

---

### Post-Compact Cleanup (postCompactCleanup)

```
function postCompactCleanup(context):
    // Labeled "post_compact_cleanup" in telemetry (+6768920)
    // Clears several internal caches and state maps:
    //   - s06.clear, kC_.clear  (via Bx9 at +6756812, +6756824)
    //   - vSq.clear             (via fY8 at +10632770)
    //   - gz7.resetAutonomousLoopDelivered (+6769026)
    //   - Resets KY8/tu maps   (tu.delete at +6768694)
    //   - Clears hC_ and t06   (at +6768727, +6768741)
    //   - Runs PostCompact hook (literal "PostCompact" at +13312582)

    clearCacheA()
    clearCacheB()
    clearPrecomputedCompactCache()
    resetAutonomousLoopDelivered()
    runPostCompactHooks(context)
```

Analysis basis: CC v2.1.163 bundle.js:+6768920

---

### Non-Interactive Mode Behavior

When `supportsNonInteractive = true`, `/compact` can be triggered without a REPL present (e.g., SDK or CLI pipe mode). In this path:

- The `thinClientDispatch: "post-text"` field indicates that in thin-client contexts the result is dispatched as a post-text event.
- The `manual` trigger literal at +11020563 distinguishes a user-invoked compact from an automatically-triggered reactive compact.
- The compact trigger type is tracked: `compact_manual` (+10194035) vs `compact_auto` (+10194020).

Analysis basis: CC v2.1.163 bundle.js:+11020563

---

### Error and Failure Paths

| Error Condition | Literal / Telemetry | User-facing message |
|---|---|---|
| No messages | `"No messages to compact"` (+11024435) | Thrown as Error |
| Hook blocked | `"compaction-blocked-by-hook"` (+10193233) | Warning notification |
| Prompt too long | `tengu_compact_ptl_retry` (+10195336) | "Compaction failed · conversation could not be reduced…" (+11021448) |
| No summary text | `tengu_compact_failed` (+10208509) | "Failed to generate conversation summary…" (+10195709) |
| Media too large | — | "Compaction failed · attached media exceeds size limits" (+11021570) |
| API error | `tengu_compact` (+10197277), `compact_api_error` (+10195976) | Unknown error path (+11021694) |
| User cancel | `"Compaction canceled."` (+11024975) | Shown inline |

Analysis basis: CC v2.1.163 bundle.js:+11021448

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_compact` (+10197277), `tengu_compact_failed` (+10208509), `tengu_compact_ptl_retry` (+10195336), `tengu_compact_cache_prefix` (+10194860), `tengu_compact_cache_sharing_success` (+10205737), `tengu_compact_cache_sharing_fallback` (+10206367), `tengu_precomputed_compact_consumed` (+6767680), `tengu_precomputed_compact_discarded` (+6768303), `tengu_reactive_compact_succeeded` (+6775315), `tengu_reactive_compact_failed` (+6772854), `tengu_reactive_compact_attempt` (+6753991), `tengu_sepia_moth` (+6761301), `tengu_post_compact_file_restore_success` (+10208995), `tengu_post_compact_file_restore_error` (+10209037), `tengu_amber_redwood3` (+10212933) |
| Hook registration | Fires `PreCompact` hook before summarization; fires `PostCompact` hook after state reset |
| appState changes | Replaces full message list with compacted summary; writes `compactMetadata` key; calls `H.setAppState` |
| Cache resets | Clears `s06`, `kC_`, `vSq`; calls `resetAutonomousLoopDelivered`; deletes `tu`, `hC_`, `t06` map entries |
| Keybinding | Registers `ctrl+o` → `app:toggleTranscript` (scope: Global) after successful compact |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Compact trigger type | Records `compact_manual` or `compact_auto` distinguishing user-invoked from automatic reactive compact |
| Compaction agent tools | Tool use is blocked during compaction agent call (`"Tool use is not allowed during compaction"` at +10204860) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.163 | Initial analysis |

---

## Common Mistakes

1. **Passing too much context before compacting**: If the conversation is already beyond the model's context limit when `/compact` is invoked, the summarization sub-call itself may fail with `prompt_too_long`; consider clearing large attachments first.
2. **Expecting tool results to survive compaction**: The compaction agent produces only a text summary; all tool-use history and intermediate results are collapsed and will not be individually accessible after compaction.
3. **Assuming hooks are always run**: In non-interactive (SDK/pipe) mode, some hook types (e.g., Stop hooks) are explicitly not supported outside the REPL; the `PreCompact` hook is fired, but if no hooks are registered the pipeline proceeds immediately.
4. **Using `/compact` with `--no-interactive` to recover from context overflow**: If media attachments are too large (`media_too_large`), compaction will fail regardless; the only recovery is removing large media from context.
5. **Expecting the transcript to be preserved after compact**: The conversation is replaced by the summary. The previous transcript can be viewed with `ctrl+o` (toggleTranscript) after a successful compact, but the messages are no longer live in the context.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `kYf` | Top-level `/compact` command handler (AsyncFunction) |
| `vO` | Message normalization / compaction message builder |
| `Mk8` | Inner normalization helper called from vO |
| `fJ` | Low-level message field formatter |
| `yYf` | Summarization pipeline orchestrator |
| `jmq` | Context/appState builder for compaction call |
| `hYf` | Summarization sub-call executor (calls API, handles response) |
| `UC_` | Reactive compact orchestrator |
| `Hvq` | Compaction agent query runner (sends API call, loops over response) |
| `Y86` | Compact full-run function (auto/manual dispatch) |
| `zs` | Post-compact state cleanup function |
| `xyH` | Sets conversation state (calls `a06.setState`) |
| `wmq` | Emits compacted notification message and registers keybinding |
| `bC_` | Boundary index finder (locates compact boundary in message list) |
| `Cz7` | Reactive compact summarization sub-routine |
| `tz8` | Reactive compact message slicing / grouping logic |
| `$Y8` | Agent-loop-level compact integration point |
| `Bs_` | Message attachment normalizer for compaction API payload |
| `Il` | Hook pipeline runner (PreCompact / PostCompact) |
| `V0` | Hook execution engine (dispatches hooks, handles responses) |
| `Z5A` | Hook type/event classifier |
| `DT` | System prompt builder for compaction context |
| `Vj6` | Memory/instructions loader for compaction prompt |
| `GG6` | Tracing span initializer for compaction |
| `saH` | Precomputed compact consumer (checks if pre-built summary available) |
| `qY8` | Precomputed compact discard / miss recorder |
| `KY8` | Post-compact sub-agent exit cleanup |
| `fY8` | Clears `vSq` cache on post-compact |
| `Bx9` | Clears `s06` and `kC_` caches on post-compact |
| `ux9` | Resets `H` state map on post-compact |
| `wXH` | Resets `H` / `_` state on post-compact |
| `e_H` | Post-compact notification sender |
| `ED` | Output token counter utility |
| `iCH` | Hook output classifier |
| `bx8` | Hook plain-text output parser |
| `y$K` | Hook slash-command prefix parser |
| `XX8` | Hook executor (spawns subprocess) |
| `NC_` | Normalizes compaction API content blocks |
| `Mqf` | Filters compaction message list |
| `$qf` | Maps and validates compaction message content |
| `oNq` | Unicode surrogate-pair aware message char inspector |
| `Js_` | Recursive compaction content normalizer |
| `L_6` | Tool-search / compaction context loader |
| `h3K` | Main agent query loop (handles streaming, tool use, retries) |
| `sNq` | Message slice size estimator for reactive compact |
| `ZiH` | Token-count / model-context-window utility |
| `M7H` | Array structure checker (tool result blocks) |
| `SX6` | Context window numeric parser |
| `us_` | Token budget accumulator |
| `oz8` | Finds last `<summary>` tag boundary in message list |
| `az8` | Summary boundary locator wrapper |
| `BZ` | Finds last assistant message in conversation |
| `Xk6` | Tool-search mode decision utility |
| `Bqf` | Tool-search candidates builder |
| `kR_` | Tool-search filter (tst/tst-auto) |
| `Ls` | Language/model string normalizer |
| `hCH` | Tool-use-in-progress detector |
| `ci` | Internal compact result renderer |
| `Is_` | Compact result error handler |
| `tjH` | OTEL metrics emitter for compaction span |
| `N4` | OTEL span event recorder |
| `vkH` | OTEL resource attribute builder |
| `EH` | Generic string coercion utility |
| `HA` | Error string builder |
| `__` | Identity / passthrough wrapper |
| `SH` | JSON.stringify wrapper |
| `su` | Sensitive-data redaction pipeline |
| `eNq` | Compact error categorizer and reporter |
| `PN` | Prompt length / token budget enforcer |
| `viL` | LRU cache for prompt-length computations |
| `QyH` | Sets UI status bar text |
| `WG6` | Compact session end notifier |

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.