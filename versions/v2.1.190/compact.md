---
type: feature-spec
feature: "compact"
cc_version: "2.1.190"
updated: "2026-06-24"
tags: ["compact", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.190 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/compact`

> Analysis basis: CC v2.1.190 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.190

---

## Overview

`/compact` frees up model context window space by summarizing the current conversation into a condensed representation. It dispatches a summarization agent with an optional custom instruction string, replaces the conversation history with the resulting summary, and emits a `compact_boundary` sentinel message. The command supports both manual invocation and background (reactive) triggering.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `compact` |
| description | Free up context by summarizing the conversation so far |
| argumentHint | `<optional custom summarization instructions>` |
| supportsNonInteractive | `true` |
| thinClientDispatch | `post-text` |
| module_id | `xpl` |
| load_inline | `true` |
| loc_byte | `11212093` |
| loc_byte_end | `11212393` |
| loc_line | `7094` |
| arbor_handler.name | `WYp` |
| arbor_handler.fqn | `claude-2.1.190::WYp` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.190 bundle.js:+11212093

---

## Input Branching

The handler has more than 3 distinct branches depending on the current conversation state, availability of messages, hook results, and error conditions.

```mermaid
flowchart TD
    A([/compact invoked]) --> B{Messages exist?}
    B -- No --> ERR1["Throw: 'No messages to compact'\n(bundle.js:+11211125)"]
    B -- Yes --> C{Optional user argument}
    C -- Provided --> D[Trim and use as custom instructions\n(bundle.js:+11211157)]
    C -- Not provided --> E[Use default summarization prompt]
    D --> F[Run PreCompact hook\n(bundle.js:+11207100)]
    E --> F
    F --> G{Hook result}
    G -- Blocked by hook --> WARN["Emit compaction-blocked-by-hook warning\n(bundle.js:+10793880)"]
    G -- Allowed --> H[Build summarization request\n(bundle.js:+11207192)]
    H --> I[Invoke summarization agent\nhandler: qYp → WT → yKp → sqn]
    I --> J{Summary response}
    J -- No text content --> ERR2["compact_no_summary error\n(bundle.js:+10796327)"]
    J -- prompt_too_long --> ERR3["compact_prompt_too_long\n(bundle.js:+10795943)"]
    J -- API error --> ERR4["compact_api_error\n(bundle.js:+10796623)"]
    J -- Valid text --> K[Replace conversation with summary\n+ compact_boundary sentinel\n(bundle.js:+13693819)]
    K --> L[Run PostCompact hooks\n(bundle.js:+10623650)]
    L --> M[Emit compact_end telemetry\n(bundle.js:+11209012)]
    M --> N([Done])
    WARN --> N
```

---

## Behavioral Spec

### Main Handler: `WYp` (compactCommandHandler)

```
async function compactCommandHandler(context, userArgument):
    messages = getConversationMessages(context)

    if messages is empty:
        throw Error("No messages to compact")   // bundle.js:+11211125

    customInstructions = userArgument?.trim() ?? null  // bundle.js:+11211157

    // Run PreCompact hook pipeline
    hookResult = runPreCompactHook(context)             // bundle.js:+11207100
    if hookResult.blocked:
        emitWarning("compaction-blocked-by-hook")       // bundle.js:+10793880
        return

    // Initiate compaction flow
    result = await runCompactionFlow(context, customInstructions)  // qYp

    if result.error == "prompt_too_long":
        reportError("compact_prompt_too_long")          // bundle.js:+10795943
        return
    if result.error == "no_summary":
        reportError("compact_no_summary")               // bundle.js:+10796327
    if result.error == "api_error":
        reportError("compact_api_error")                // bundle.js:+10796623
        return

    // Replace conversation history
    applyCompactBoundary(context, result.summary)       // bundle.js:+13693819
    runPostCompactHooks(context)                        // bundle.js:+10623650
    emitTelemetry("tengu_compact")                      // bundle.js:+10797922
```

Analysis basis: CC v2.1.190 bundle.js:+11211094

---

### Compaction Flow: `qYp` (runCompactionFlow)

```
async function runCompactionFlow(context, customInstructions):
    startTime = performance.now()                      // bundle.js:+11207183

    // Gather system context (hooks, model, state)
    [systemPrompt, appState] = await Promise.all([
        buildSystemPrompt(context),                    // Rpl
        buildToolContext(context)                      // qY
    ])

    emitProgress("compact_start", "requesting")        // bundle.js:+11207606
    
    // Build summarization message body
    summaryRequest = buildSummaryRequest(
        messages       = getConversationSlice(context),
        instructions   = customInstructions,
        mode           = "manual"                      // bundle.js:+11207259
    )

    // Call the model stream
    response = await streamSummarizationAgent(summaryRequest)   // WT → yKp → sqn

    if response.aborted:
        return { status: "aborted" }                   // bundle.js:+11209582

    summaryText = extractText(response)
    if not summaryText:
        return { error: "no_summary" }

    return { status: "success", summary: summaryText }
```

Analysis basis: CC v2.1.190 bundle.js:+11207183

---

### Compact Boundary Application: sentinel insertion

```
function applyCompactBoundary(context, summaryText):
    // Inserts a synthetic message of role "system" with tag "compact_boundary"
    // so the model recognizes where prior history ends
    boundaryMessage = {
        role:    "system",                              // bundle.js:+13693797
        tag:     "compact_boundary",                   // bundle.js:+13693819
        content: summaryText
    }
    replaceConversationHistory(context, [boundaryMessage])

    // The value 1 / 0 literal pair indicates index and offset of the sentinel
    // in the rebuilt messages array
    // Analysis basis: CC v2.1.190 bundle.js:+13693873
```

Analysis basis: CC v2.1.190 bundle.js:+13693797

---

### System Prompt Assembly: `Rpl` (buildCompactionSystemPrompt)

```
async function buildCompactionSystemPrompt(context):
    appState = context.getAppState()                  // bundle.js:+11210581
    rawMessages = Array.from(...)                     // bundle.js:+11210648
    
    // Locate last assistant message for context recovery
    lastAssistant = findLastAssistantMessage(rawMessages)   // Or → bundle.js:+10788783

    // Assemble system prompt sections
    sections = await Promise.all([
        buildMainPrompt(appState),                    // U5
        buildMemoryBlocks(appState),                  // M_
        buildContextHints(appState)                   // TA
    ])

    return sections.join("\n\n")
```

Analysis basis: CC v2.1.190 bundle.js:+11210581

---

### Reactive Compact: `sUd` / `y0n` (reactiveCompactHandler)

Reactive compaction runs automatically (without user invocation) when the context window nears its limit.

```
function reactiveCompact(context, messageGroups):
    if messageGroups.length < 2:
        log("Reactive compact: fewer than 2 groups, nothing to compact")  // bundle.js:+5263469
        return { status: "too_few_groups" }                               // bundle.js:+5263559

    candidateSet = selectSummarizationSlice(messageGroups)

    hasAssistant = candidateSet.some(isAssistantMessage)
    if not hasAssistant:
        log("Reactive compact: no assistant messages in summarize set")   // bundle.js:+5264033
        return { status: "exhausted" }

    result = await runSummarizationAgent(candidateSet)   // sUd
    
    if result.error == "media_too_large":
        // Strip media and retry once
        log("Reactive compact: summarize hit media-size error, retrying stripped")  // bundle.js:+5265160
        strippedSet = stripMedia(candidateSet)
        if strippedSet is unstrippable:
            return { status: "media_unstrippable" }                      // bundle.js:+5265275
        result = await runSummarizationAgent(strippedSet)

    if result.summaryText is empty:
        log("Reactive compact: empty summary text in summarization response")  // bundle.js:+5262670
        return { status: "summarization produced empty response" }

    return { status: "ok", summary: result.summaryText }                // bundle.js:+5264591
```

Analysis basis: CC v2.1.190 bundle.js:+5263469

---

### Post-Compact Cleanup: `jte` (postCompactCleanup)

```
function postCompactCleanup(context):
    // Clear stale in-flight caches and reset tracking structures
    clearStreamingCache()                    // qWn → bundle.js:+10595619
    clearHookCaches()                        // gaa → bundle.js:+6705723
    resetAutonomousLoopDelivered()           // bundle.js:+10617870
    runStateResets()                         // Y_ → bundle.js:+10617920
    broadcastPostCompactEvent()              // REo → bundle.js:+10618026
```

Analysis basis: CC v2.1.190 bundle.js:+10617743

---

### Error Display: `kpl` (displayCompactionResult)

```
function displayCompactionResult(context, result):
    if result.error == "prompt_too_long":
        displayMessage("Compaction failed · conversation could not be reduced below the context limit")
        // bundle.js:+11208137
    else if result.error == "media_too_large":
        displayMessage("Compaction failed · attached media exceeds size limits")
        // bundle.js:+11208259
    else if result.canceled:
        displayMessage("Compaction canceled.")                              // bundle.js:+11211666
    else:
        // Register keybinding to show transcript
        registerAction("app:toggleTranscript", "ctrl+o")                   // bundle.js:+11210386 / +11210418
        displayMessage("Compacted " + tokenCountSummary)                   // bundle.js:+11210525
```

Analysis basis: CC v2.1.190 bundle.js:+11208748

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_compact` | Emitted on successful manual compaction (bundle.js:+10797922) |
| Telemetry: `tengu_reactive_compact_succeeded` | Emitted when background compaction succeeds (bundle.js:+10624246) |
| Telemetry: `tengu_reactive_compact_attempt` | Emitted at the start of each reactive attempt (bundle.js:+5264278) |
| Telemetry: `tengu_reactive_compact_failed` | Emitted when reactive compaction fails (bundle.js:+10621777) |
| Telemetry: `tengu_compact_failed` | Emitted on any terminal failure (bundle.js:+10809827) |
| Telemetry: `tengu_compact_cache_prefix` | Emitted relating to cache prefix sharing during compaction (bundle.js:+10795507) |
| Telemetry: `tengu_compact_cache_sharing_success` | Emitted when cache sharing succeeds (bundle.js:+10806552) |
| Telemetry: `tengu_compact_cache_sharing_fallback` | Emitted when cache sharing falls back (bundle.js:+10807182) |
| Telemetry: `tengu_compact_credits_clamp_rescue` | Emitted when credit clamping rescues a compaction (bundle.js:+5264121) |
| Telemetry: `tengu_precomputed_compact_consumed` | Emitted when a precomputed compact result is used (bundle.js:+10616341) |
| Telemetry: `tengu_precomputed_compact_discarded` | Emitted when a precomputed compact is discarded (bundle.js:+10616980) |
| Telemetry: `tengu_compact_ptl_retry` | Emitted on prompt-too-long retry (bundle.js:+10795983) |
| Telemetry: `tengu_post_compact_file_restore_success` | Emitted when file state is restored after compact (bundle.js:+10811080) |
| Telemetry: `tengu_post_compact_file_restore_error` | Emitted on file restore failure (bundle.js:+10811122) |
| Telemetry: `tengu_model_fallback_triggered` | Emitted when a model fallback is needed during compaction (bundle.js:+10810167) |
| Conversation history | Replaced in-place with a single `system`-role `compact_boundary` message containing the summary |
| Hook invocations | `PreCompact` hook runs before compaction; `PostCompact` hook runs after (bundle.js:+11207100, +10623650) |
| appState changes | `setAppState` called by downstream handlers to record compaction metadata (bundle.js:+10783895) |
| Streaming caches | Cleared by `postCompactCleanup` (bundle.js:+10595619) |
| Error literal: "No messages to compact" | Thrown immediately when conversation is empty (bundle.js:+11211125) |
| Error literal: "Compaction failed · conversation could not be reduced…" | Displayed on `prompt_too_long` terminal error (bundle.js:+11208137) |
| Error literal: "Compaction canceled." | Displayed when user cancels (bundle.js:+11211666) |
| Keybinding registered | `ctrl+o` → `app:toggleTranscript` after successful compact (bundle.js:+11210418) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.190 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/compact` with no conversation history** — The command immediately throws `"No messages to compact"` (bundle.js:+11211125). Ensure at least one exchange has occurred before running it.
2. **Expecting custom instructions to override the summarization model** — The optional argument is passed as *additional guidance* to the summarization agent, not as a model selector. Model selection follows the normal policy path.
3. **Attaching large media files and then compacting** — If the combined token count of attached media causes a `media_too_large` error, the reactive path retries once with media stripped. If that also fails (`media_unstrippable`), compaction aborts. Remove oversized attachments before compacting.
4. **Assuming `/compact` immediately frees tokens visible in the UI** — The history replacement occurs server-side and is reflected only after the `compact_boundary` sentinel is acknowledged. The displayed token count updates asynchronously.
5. **Cancelling mid-compaction** — An in-progress compaction that is aborted leaves the conversation in its pre-compact state; no partial summary is applied. The `"Compaction canceled."` message confirms a clean rollback (bundle.js:+11211666).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `WYp` | Main compact command handler (AsyncFunction) |
| `qYp` | Core compaction flow orchestrator |
| `WT` | Model streaming wrapper |
| `yKp` | Summarization agent entry point |
| `sqn` | Message normalization and system prompt builder |
| `Rpl` | Compaction system prompt assembler |
| `uR` | System prompt section collector |
| `qY` | Tool context and hook builder |
| `od` | Hook pipeline executor |
| `xL` | Hook runner and result dispatcher |
| `jpt` | Main REPL turn handler (reused during compaction) |
| `ual` | Agent loop coordinator |
| `k5l` | Streaming agent core |
| `sUd` | Reactive compact summarization runner |
| `y0n` | Reactive compact message group selector |
| `jte` | Post-compact cleanup coordinator |
| `kpl` | Compaction result display handler |
| `DEo` | Reactive compact result handler |
| `QWn` | Turn execution coordinator |
| `C0` | Conversation state manager |
| `f4n` | App state updater |
| `MH` | Message history accessor |
| `pVn` | Message slice helper |
| `x4` | Message formatter |
| `it` | Message iterator/processor |
| `gSn` | Message deduplication handler |
| `lBr` | Conversation log writer |
| `mBr` | Conversation state broadcaster |
| `Dt` | Config file accessor |
| `SEe` | Config file reader/writer with filesystem ops |
| `BRf` | Config file watcher cleanup |
| `G8n` | Working-directory context resolver |
| `W8n` | Allowed-tools context resolver |
| `N2` | App-state message builder |
| `Or` | App-state last-message finder |
| `U5` | Main system prompt builder |
| `_v` | System-prompt segment formatter |
| `oo` | Module loader bootstrap |
| `VYp` | Precomputed compact result applicator |
| `vEo` | Streaming abort/race coordinator |
| `Vft` | Compact result token counter |
| `LEo` | Compact summary boundary finder |
| `jWn` | Token metric reporter |
| `bb` | Session type discriminator |
| `u5i` | Session abort-token helper |
| `MOt` | Object entry remapper |
| `i7` | Settings identifier resolver |
| `u1t` | Settings file writer |
| `QBe` | Settings persistence handler |
| `zft` | Config file reload trigger |
| `Rc` | Telemetry emitter wrapper |
| `W6t` | UUID generator for boundary messages |
| `GY` | Tool result aggregator |
| `uKp` | Tool result type checker |
| `cKp` | Tool result formatter |
| `k8p` | Multi-stage compaction pipeline |
| `e8n` | File-state snapshot restorer |
| `o8n` | App-state snapshot reader |
| `t8n` | Plan-mode snapshot handler |
| `r8n` | Conversation snapshot reconstructor |
| `n8n` | Memory snapshot handler |
| `x_e` | Snapshot diff calculator |
| `Sxe` | Snapshot applicator |
| `uWe` | Snapshot merge helper |
| `ti` | Message UUID stamper |
| `g8` | Hook plugin loader |
| `Axe` | PreCompact hook runner |
| `PEo` | PostCompact hook runner |
| `AWe` | Hook event filter |
| `ZLn` | Token counter (round) |
| `QLn` | Token usage tracker |
| `Kw` | System-prompt token accounting |
| `ff` | Token rounding helper |
| `rNd` | Token accumulator |
| `Bk` | Hook type dispatcher |
| `Kh` | App-state snapshot reader for hooks |
| `y0n` | Reactive compact message-group selector |
| `_1t` | Reactive compact history builder |
| `hWi` | Reactive compact window calculator |
| `sUd` | Reactive compact summarization runner |
| `iUd` | Reactive compact window re-selector |
| `P4` | Transcript redactor |
| `eUd` | URL redactor |
| `zNd` | IP/phone redactor |
| `YNd` | Path normalizer |
| `WNd` | IP address redactor |
| `FNd` | Email redactor |
| `NNd` | Home-directory path normalizer |
| `JNd` | File path redactor |
| `XNd` | Phone number redactor |
| `ZNd` | API-error-body redactor |
| `Mt` | Warning message display helper |
| `jte` | Post-compact state cleanup |
| `YWn` | Stream state deleter |
| `POt` | Abort token resolver |
| `qWn` | Streaming cache clearer |
| `gaa` | Hook output cache clearer |
| `E6a` | Singleton state clearer |
| `SRe` | Session state resetter |
| `Y_` | Output token counter resetter |
| `jBe` | UI state broadcaster |
| `kpl` | Compaction result display |
| `w6e` | Model roster loader |
| `Lkp` | Model display-name resolver |
| `KI` | Keybinding registrar |
| `JTn` | Action registry lookup |
| `QTn` | Action registration handler |
| `kve` | Token usage formatter |
| `Su` | OTEL metrics emitter |
| `K2e` | OTEL resource attribute builder |
| `BEt` | OTEL event builder |
| `Mir` | Metrics flush trigger |
| `Dir` | Metrics dimension collector |
| `jpt` | REPL main turn handler |
| `uUt` | Tracing span initializer |
| `Bae` | Span context propagator |
| `qD` | Span attribute setter |
| `uF` | Active-span accessor |
| `_0n` | Whitespace trimmer for user input |
| `On` | Agent subshell launcher |
| `_` | Background task dispatcher |
| `nyt` | Background task type classifier |
| `fo` | Error string formatter |
| `y` | Teammate mailbox handler |
| `G5e` | Teammate message reader |
| `ual` | Agent loop runner |
| `tel` | Telemetry event flusher |
| `s6t` | Telemetry queue accessor |
| `eel` | Telemetry batch emitter |
| `nt` | String coercion helper |
| `C0` | Conversation state manager |
| `f4n` | App state updater |
| `m4n` | Conversation compaction index updater |
| `DM` | Session ID generator |
| `Ace` | Message history archiver |
| `j5` | Turn result handler |
| `lk` | Compaction lock controller |
| `f6e` | Tombstone checker |
| `Qte` | Turn quota enforcer |
| `q8n` | Background quota checker |
| `TBa` | Tombstone applicator |
| `cce` | Context-carry message filter |
| `xVp` | Context window progress reporter |
| `Tjr` | Tool permission context builder |
| `E0n` | Tool result validator |
| `PTe` | Tool type validator |
| `pge` | Output-token cap calculator |
| `xIe` | Per-model output cap resolver |
| `Hae` | Token cap parser |
| `Rx` | Last-error finder |
| `H0n` | Message tail locator |
| `g0n` | Last-message finder |
| `bGt` | Tool search mode decision |
| `xSe` | Tool search candidate scorer |
| `Wj` | Model name normalizer |
| `tse` | Tool search cache reader |
| `uxe` | Tool search availability checker |
| `dOt` | Tool search disabled reporter |
| `dKp` | Tool search parameters builder |
| `bjr` | Message content flattener |
| `NVp` | Content block array checker |
| `UVp` | Content block filter |
| `FVp` | Message content mapper |
| `AGt` | Message content aggregator |
| `DSo` | Nested content traverser |
| `sal` | Surrogate-pair character counter |
| `Hot` | Model error overlay handler |
| `sA` | Model permission checker |
| `_5i` | Model error text extractor |
| `zOt` | Model error display formatter |
| `iGi` | Model error action buttons |
| `xfe` | Model display info resolver |
| `Kg` | Model gateway router |
| `n_` | Model display formatter |
| `XC` | Model capability flag resolver |
| `Zoe` | Model rate-limit resolver |
| `dU` | Model context-window resolver |
| `Da` | Model metadata loader |
| `H` | MCP stdio transport handler |
| `g` | Async retry scheduler |
| `mp` | MCP stream message writer |
| `RJf` | MCP daemon session handler |
| `sft` | Session state finalizer |
| `jSo` | Fallback request router |
| `k5l` | Streaming API session core |
| `H3n` | Hook context builder |
| `p0` | Config file lock handler |
| `zL` | Version compatibility checker |
| `L` | Background worker lifecycle manager |
| `w` | Background session scheduler |
| `V` | Background session slot manager |
| `k` | Background session clock advancer |
| `PVt` | Free-memory reporter |
| `J2l` | Background session upgrade handler |
| `B2e` | Conversation file garbage collector |
| `F` | Background interval clearer |
| `q` | Background session quota tracker |
| `WXn` | Background session upgrade telemetry |
| `z` | Keyboard shortcut handler |
| `Zm` | Non-conforming content wrapper |
| `Ng` | Content block constructor |
| `Rr` | Non-conforming block constructor |
| `yp` | Model display name resolver |
| `Mp` | Model name sanitizer |
| `UNe` | Model name case-normalizer |
| `hfn` | Terminal color theme resolver |
| `Rfe` | Model permission flag reader |
| `gz` | Model context-size suffix detector |
| `H8` | Tool result array validator |
| `aal` | Compaction slice calculator |
| `wot` | Message categorizer |
| `pot` | Summary prefix stripper |
| `_ge` | Tool-result type detector |
| `n1t` | Token count parser from match |
| `H1` | Summary prefix detector |
| `Uf` | Model name display formatter |
| `M$` | Model name VL lookup |
| `gr` | Model shortname VL lookup |
| `gv` | Remote-mode flag accessor |
| `r9` | Remote flag string resolver |
| `Za` | String conversion helper |
| `mOt` | REPL context accessor |
| `y1t` | Summary text normalizer |
| `oUd` | Summary tag stripper |
| `Zj` | Session abort-token getter |
| `_ae` | Abort-token set lookup |
| `cal` | Compaction error display handler |
| `VT` | Compaction queue manager |
| `jL` | Compaction queue resolver |
| `AUd` | Compaction queue persistent store |
| `lUt` | Compaction lock releaser |
| `Z3e` | Agent status setter |
| `USo` | Non-interactive compaction status notifier |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.