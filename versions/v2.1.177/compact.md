---
type: feature-spec
feature: "compact"
cc_version: "2.1.177"
updated: "2026-06-13"
tags: ["compact", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.177 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/compact`

> Analysis basis: CC v2.1.177 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.177

---

## Overview

`/compact` summarizes the current conversation to free up context-window space, replacing the full message history with a condensed summary while preserving task continuity. It is the primary mechanism Claude Code uses to manage context limits, and it can be triggered manually by the user (with optional custom summarization instructions) or fired automatically by the runtime when the context nears exhaustion. The command runs the full compaction pipeline: pre-compact hook invocation, API summarization request, state reset, and post-compact hook invocation.

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
| module_id | `HHK` |
| load_inline | `true` |
| loc_byte | `11356204` |
| loc_byte_end | `11356504` |
| loc_line | `7508` |
| arbor_handler.name | `DbL` |
| arbor_handler.fqn | `claude-2.1.177::DbL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.177 bundle.js:+11356204

---

## Input Branching

The handler has more than three distinct control paths (no messages to compact, manual invocation, auto invocation, pre-compact hook blocked, API error, media-size error, prompt-too-long error) so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A([User runs /compact\nor auto-trigger]) --> B{Messages available\nto compact?}
    B -- No --> ERR1["Throw 'No messages to compact'\n(bundle.js:+11355265)"]
    B -- Yes --> C[Trim optional custom instructions\n(bundle.js:+11355297)]
    C --> D[Run PreCompact hook\nvia hook runner]
    D --> E{Hook result?}
    E -- blocked --> ERR2["Abort: 'compaction blocked\nby PreCompact hook'\n(bundle.js:+10765621)"]
    E -- allowed / no hook --> F[Emit compact_progress event\nbuild summarization context\n(bundle.js:+11351179)]
    F --> G[Request summary from API\nhandler: summarization pipeline]
    G --> H{API outcome?}
    H -- prompt_too_long --> I[Log compact_prompt_too_long\n(bundle.js:+10767650)\nretry if budget allows]
    I --> G
    H -- media_too_large --> J[Strip media blocks\nretry stripped request\n(bundle.js:+11352399)]
    J --> G
    H -- API error --> ERR3["Log compact_api_error\n(bundle.js:+10768330)\nSurface error to user"]
    H -- no valid summary --> ERR4["Log compact_no_summary\n(bundle.js:+10768034)\nSurface error to user"]
    H -- success --> K[Apply summary as\nnew conversation state\nboundary_uuid marker\n(bundle.js:+11105680)]
    K --> L[Reset app state\npost-compact cleanup\n(bundle.js:+10598788)]
    L --> M[Run PostCompact hook]
    M --> N[Emit compact_end telemetry\n(bundle.js:+11353152)]
    N --> O[Display 'Compacted N messages'\nto user\n(bundle.js:+11354665)]
    O --> END([Done])
```

---

## Behavioral Spec

### Entry Point — Main Handler (`DbL`)

Analysis basis: CC v2.1.177 bundle.js:+11355234

```
async function compactHandler(commandContext):
    // Validate there is something to compact
    messages = getMessageHistory(commandContext)
    if messages is empty:
        throw Error("No messages to compact")   // bundle.js:+11355265

    // Normalize optional user instructions argument
    customInstructions = commandContext.argument.trim()  // bundle.js:+11355297

    // Trigger PreCompact lifecycle hooks
    hookResult = await runPreCompactHook(commandContext)  // bundle.js:+11355314

    // Launch summarization pipeline
    summaryResult = await summarizationPipeline(
        messages, customInstructions, commandContext)      // bundle.js:+11355332

    // Sync state and run post-compact cleanup
    applyCompactionResult(summaryResult, commandContext)   // bundle.js:+11355369

    // Notify UI
    notifyUI(summaryResult)
    emitTelemetry("tengu_compact", ...)
```

---

### Summarization Pipeline (`jbL`)

Analysis basis: CC v2.1.177 bundle.js:+11351316

```
async function summarizationPipeline(messages, customInstructions, ctx):
    startTime = performance.now()

    // Emit progress signals
    emitProgress("compact_progress")       // bundle.js:+11351179
    emitProgress("hooks_start")            // bundle.js:+11351210
    emitProgress("pre_compact")            // bundle.js:+11351233
    emitProgress("sdk_status", "compacting") // bundle.js:+11295, +11351295

    // Build system-prompt context for the summarization call
    promptContext = buildSummarizationPromptContext(ctx)   // bundle.js:+11351338
    // includes: message history, custom instructions if provided

    // Run hook infrastructure in parallel
    [hookOutcome, priorContext] = await Promise.all([
        runHookInfrastructure(ctx),   // bundle.js:+11351367
        fetchPriorContext(ctx)
    ])

    // Execute the actual API summarization call
    summaryResponse = await executeCompactAPICall(
        promptContext, hookOutcome, ctx)               // bundle.js:+11351770

    // Track telemetry
    emitTelemetry("tengu_compact", {
        type: isManual ? "compact_manual" : "compact_auto",
        ...metrics
    })                                                // bundle.js:+10766389

    return summaryResponse
```

---

### Pre-Compact Hook Runner (`Wo` / hook infrastructure)

Analysis basis: CC v2.1.177 bundle.js:+11355314

```
async function runPreCompactHook(ctx):
    hookEvent = buildHookEvent("PreCompact", ctx)   // literal bundle.js:+13647512
    result = await dispatchHook(hookEvent)
    if result.decision == "block":
        emitTelemetry("compaction-blocked-by-hook")  // bundle.js:+10765587
        raise CompactionBlockedError(
            "compaction blocked by PreCompact hook") // bundle.js:+10765621
    return result
```

---

### API Summarization Call (`JbL`)

Analysis basis: CC v2.1.177 bundle.js:+11353533

```
async function executeCompactAPICall(promptCtx, hookOutcome, ctx):
    startTime = performance.now()

    // Build message array for summarization request
    messages = buildCompactMessages(promptCtx)   // bundle.js:+11353559

    // Attempt the API call with retry logic
    loop:
        try:
            response = await apiQuery(messages, {model, maxTokens})
                                                // bundle.js:+11353614
            if response has no valid text:
                if response is empty:
                    logAndFail("compact_no_summary")  // bundle.js:+10768034
                    break
                // Extract text summary
                summary = extractTextSummary(response)
                break

        catch PromptTooLong:
            if retryBudget > 0:
                emitTelemetry("tengu_compact_ptl_retry") // bundle.js:+10767690
                pruneMessages(messages)
                retryBudget -= 1
                continue
            else:
                logAndFail("compact_prompt_too_long")  // bundle.js:+10767650
                break

        catch MediaTooLarge:
            // Strip media blocks and retry once
            messages = stripMediaBlocks(messages)   // bundle.js:+11352399
            continue

        catch AbortError:
            // User-initiated cancel
            emit("compact_reactive_aborted")  // bundle.js:+10603250
            return null

        catch other:
            logAndFail("compact_api_error")   // bundle.js:+10768330
            break

    // Mark boundary in message stream
    insertCompactBoundaryMarker(summary)  // "compact_boundary" bundle.js:+11105680
    return {summary, metrics: {duration: performance.now() - startTime}}
```

---

### Post-Compact State Reset (`q6H`)

Analysis basis: CC v2.1.177 bundle.js:+10598788

```
function postCompactCleanup(ctx):
    // Restore any in-flight file state snapshots
    restoreFileSnapshots()     // tengu_post_compact_file_restore_success/error

    // Clear caches invalidated by compaction
    clearPrecomputedCache()    // bundle.js:+10577579 (mx8)
    clearQueryCaches()         // bundle.js:+6627684  (Ji9)

    // Reset per-turn tracking state
    resetAutonomousLoopDelivered()    // bundle.js:+10598915

    // Flush state delta collections
    resetStateDeltas()

    // Trigger PostCompact lifecycle hook
    runPostCompactHook(ctx)    // "PostCompact" literal bundle.js:+13681304

    emit("post_compact_cleanup")
```

---

### Compact Boundary Insertion (`Tz` / `Ap8`)

Analysis basis: CC v2.1.177 bundle.js:+11355234 → +11105680

```
function insertCompactBoundaryMarker(summaryText, messages):
    // Slice message history to the compaction point
    // Indices: keep messages[1..end] (bundle.js:+11105734, +11105739)
    trimmedMessages = messages.slice(1)

    // Build a synthetic system-role entry tagged "compact_boundary"
    boundaryEntry = {
        role: "system",            // bundle.js:+11105658
        tag:  "compact_boundary",  // bundle.js:+11105680
        content: summaryText
    }

    // Prepend boundary entry, replacing prior history
    newMessageList = [boundaryEntry, ...trimmedMessages]
    updateConversationState(newMessageList)

    // Success notification visible to user
    notify("Conversation compacted")  // bundle.js:+11105236
```

---

### Reactive Compact (`V4A` — automatic trigger)

Analysis basis: CC v2.1.177 bundle.js:+10602405

When the runtime detects context approaching the limit, it calls the reactive compact path without user action.

```
async function reactiveCompact(ctx):
    emitTelemetry("tengu_reactive_compact_attempt")  // bundle.js:+5145991

    // Require at least 2 conversation groups to proceed
    groups = segmentConversationIntoGroups(ctx)
    if groups.length < 2:
        log("Reactive compact: fewer than 2 groups, nothing to compact")
        emit({reason: "too_few_groups"})       // bundle.js:+5145272
        return

    // Require at least one assistant message in the candidate set
    if not hasAssistantMessage(groups):
        log("Reactive compact: no assistant messages in summarize set, bailing")
        emit({reason: "no_assistant_message"}) // bundle.js:+5145746
        return

    // Attempt summarization (same core pipeline)
    result = await summarizationPipeline(...)

    if result.ok:
        emitTelemetry("tengu_reactive_compact_succeeded")  // bundle.js:+10605218
    else:
        emitTelemetry("tengu_reactive_compact_failed")     // bundle.js:+10602753
        notifyUser({type: "warning",
                    message: "reactive compaction failed"}) // bundle.js:+11352944
```

---

### Summarization System Prompt (Context Builder — `eeq` / `mZ`)

Analysis basis: CC v2.1.177 bundle.js:+11354721 / +11355369

```
async function buildSummarizationContext(ctx):
    appState = ctx.getAppState()

    // Gather full prompt context used during compaction:
    //   - Current conversation messages
    //   - Active system prompt
    //   - Memory / CLAUDE.md content
    //   - Tool permission context
    //   - Environment info flags
    context = await Promise.all([
        fetchSystemPrompt(appState),
        fetchMemoryContent(appState),
        fetchEnvironmentInfo(appState)
    ])

    // The summarization agent is instructed with a fixed preamble:
    //   "You are a helpful AI assistant tasked with summarizing conversations."
    //   (bundle.js:+10779580)
    // Tool use is denied inside the compaction agent:
    //   "Tool use is not allowed during compaction" (bundle.js:+10777210)

    return buildSummarizationRequest(context)
```

---

### UI Notification After Compact (`teq`)

Analysis basis: CC v2.1.177 bundle.js:+11354510

```
function showCompactCompleteNotification(summary, ctx):
    // Register a keyboard shortcut to toggle the transcript
    registerAction("app:toggleTranscript",   // bundle.js:+11354526
                   scope: "Global",
                   key:   "ctrl+o")          // bundle.js:+11354558

    // Show dim status line: "Compacted N messages" (bundle.js:+11354665)
    displayStatusLine(
        dim("Compacted ") + formattedMessageCount + " messages"
    )

    // Emit compact_end metric
    emitTelemetry("compact_end", {duration, ...}) // bundle.js:+11353152
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — compact lifecycle | `tengu_compact` (bundle.js:+10769629), `tengu_compact_failed` (+10780934), `tengu_compact_cache_prefix` (+10767214), `tengu_compact_cache_sharing_success` (+10778087), `tengu_compact_cache_sharing_fallback` (+10778717), `tengu_compact_credits_clamp_rescue` (+5145834), `tengu_compact_ptl_retry` (+10767690) |
| Telemetry — reactive compact | `tengu_reactive_compact_attempt` (+5145991), `tengu_reactive_compact_succeeded` (+10605218), `tengu_reactive_compact_failed` (+10602753), `tengu_reactive_compact_aborted` (+10603250) |
| Telemetry — hooks | `tengu_run_hook` (+13701783), `tengu_hook_plugin_metrics` (+13680078), `tengu_precomputed_compact_consumed` (+10597545), `tengu_precomputed_compact_discarded` (+10598168) |
| Telemetry — file restore | `tengu_post_compact_file_restore_success` (+10781420), `tengu_post_compact_file_restore_error` (+10781462) |
| Telemetry — API layer | `tengu_api_before_normalize` (+13804616), `tengu_api_after_normalize` (+13805604), `tengu_streaming_idle_timeout` (+13816799), `tengu_streaming_error` (+13825859) |
| Hook invocation (PreCompact) | Fires hook event type `"PreCompact"` (bundle.js:+13647512). A `block` decision aborts compaction and surfaces a warning notification. |
| Hook invocation (PostCompact) | Fires hook event type `"PostCompact"` (bundle.js:+13681304) after state has been replaced with the summary. |
| appState changes | Conversation message list is replaced with `[{role:"system", tag:"compact_boundary", content: summary}, ...remainingMessages]`. Per-turn caches cleared. Autonomous-loop counter reset. |
| Pre-computed compact cache | Cleared on post-compact cleanup via `mx8` (bundle.js:+10577579). |
| Query caches | `AN6` and `IQ_` caches cleared (bundle.js:+6627684–6627696). |
| UI keyboard shortcut | `ctrl+o` registered as `app:toggleTranscript` (bundle.js:+11354558) after compaction. |
| Sound | None found in depth-2 traversal. |
| Error messages surfaced to user | `"Compaction failed · conversation could not be reduced below the context limit"` (+11352277); `"Compaction failed · attached media exceeds size limits"` (+11352399); `"Error compacting conversation"` (+10776800); `"Compaction canceled."` (+11355806) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.177 | Initial analysis |

---

## Common Mistakes

1. **Passing instructions as a quoted string unnecessarily.** The argument is trimmed and used verbatim; wrapping it in quotes will include the quotes in the summarization prompt.
2. **Expecting instant context reduction after a hook blocks compaction.** If a `PreCompact` hook returns `block`, compaction silently aborts. Check hook scripts if `/compact` appears to do nothing.
3. **Running `/compact` with no conversation history.** The handler immediately throws `"No messages to compact"` and exits; starting a conversation first is required.
4. **Assuming reactive compaction and manual compaction are identical.** Reactive compact applies additional guards (minimum 2 groups, at least one assistant message in the summarize set) that manual `/compact` does not check.
5. **Expecting tool calls to work inside the summary.** The compaction agent runs with tool use explicitly denied; MCP or other tool results will not be refreshed during the summary generation.
6. **Interpreting `"Compaction canceled."` as an error.** This message (bundle.js:+11355806) is emitted on user-initiated abort (e.g., Ctrl-C during compaction) and represents a clean cancellation, not a failure.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `DbL` | Main compact command handler (AsyncFunction) |
| `Tz` | Compact-boundary insertion utility |
| `Ap8` | Message-slice helper called by boundary inserter |
| `AX` | Low-level array/message utility |
| `jbL` | Summarization pipeline orchestrator |
| `eeq` | Summarization context builder (gathers appState, system prompt, memory) |
| `mZ` | Full system-prompt assembler (environment info, flags, memory) |
| `JbL` | API summarization call executor with retry logic |
| `J4A` | Abort-event wait / race helper for API calls |
| `Qf6` | Compact result applicator (writes summary into state) |
| `P4A` | Boundary-UUID search helper in message list |
| `gx8` | Progress/metric sampler during compaction |
| `lx8` | Reactive-compact main loop (called by `V4A`) |
| `V4A` | Reactive compact entry point (auto-trigger) |
| `q6H` | Post-compact cleanup and cache reset |
| `Qx8` | Subagent-exit / pre-computed cache consumer |
| `mx8` | Pre-computed compact cache invalidator |
| `Ji9` | Query-cache (`AN6`, `IQ_`) invalidator |
| `aRH` | App-state setter (called after compaction) |
| `teq` | Post-compact UI notification / keyboard-shortcut registration |
| `qxH` | Toggle-transcript action dispatcher |
| `unq` | Full conversation-turn runner (hosts reactive-compact path) |
| `mT` | Turn orchestrator (schedules compaction on context pressure) |
| `uC8` | App-state mutation helper |
| `Wo` | Hook dispatch entry point |
| `$6` | MCP/skill hook loader |
| `Go` | Hook context builder |
| `QG` | Individual hook executor |
| `Nc8` | Shell/process hook spawner |
| `sg` | Plugin/session-start hook loader |
| `fG` | Per-turn message normalizer |
| `Hm8` | Message-to-API-format serializer |
| `_yL` | API message array builder |
| `D2H` | Token-count helper |
| `BPH` | OTEL metrics emitter for compaction span |
| `JK6` | Core REPL turn runner (also handles auto-compact) |
| `Cnq` | Context-window token budget calculator |
| `OH6` | Token-overflow detector |
| `oMH` | Media-block stripping helper |
| `unq` | Turn runner that decides when to auto-compact |
| `Kf6` | Tool-permission context builder |
| `qvK` | Main API query function |
| `Du6` | Tool-search mode decision helper |
| `ihL` | Tool-search pipeline |
| `XG8` | Config accessor for REPL turn |
| `_1` | Config file reader |
| `VJ8` | Summary-tag `<summary>` inserter |
| `$H6` | Summary push helper |
| `fP` | Stream-to-text extractor |
| `sg` | Hook session-start runner |
| `m7A` | Post-compact user-facing result formatter |
| `Ca` | Error display helper |
| `tCH` | Status-line setter |
| `GhL` | Blocking-limit display helper |
| `xnq` | Compaction-error UI formatter |