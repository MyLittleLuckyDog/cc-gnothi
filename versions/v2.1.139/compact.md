---
type: feature-spec
feature: "compact"
cc_version: "2.1.139"
updated: "2026-05-31"
tags: ["compact", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.139 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/compact`

> Analysis basis: CC v2.1.139 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.139

---

## Overview

`/compact` frees up context window space by summarizing the current conversation into a compact transcript, replacing verbose history with a structured summary. It supports an optional argument that provides custom summarization instructions to guide how the summary is generated. The command can also be triggered automatically by the runtime when context usage approaches capacity (`autoCompactEnabled`).

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
| module_id | `Z8q` |
| load_inline | `true` |
| loc_byte | `9969520` |
| loc_byte_end | `9969833` |
| arbor_handler.name | `UL7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.fqn | `claude-2.1.139::UL7` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.139 bundle.js:+9969520

---

## Input Branching

The command has 4+ distinct branches depending on whether messages exist, whether the custom instructions argument is provided, whether a `PreCompact` hook blocks execution, and the outcome of the summarization API call.

```mermaid
flowchart TD
    A[/compact invoked] --> B{Messages available?}
    B -- No --> ERR1["Error: 'No messages to compact'\n(bundle.js:+9968671)"]
    B -- Yes --> C[Trim optional custom instructions arg]
    C --> D[Run pre-compact state read\n+ appState snapshot via E8q]
    D --> E[Run PreCompact hooks via rF/uX]
    E --> F{Hook blocks compaction?}
    F -- blocked --> ERR2["Emit 'compaction-blocked-by-hook' warning\n(bundle.js:+9423465)"]
    F -- allowed --> G[Set appState → 'compacting'\nEmit compact_start telemetry]
    G --> H[Build summarization prompt\nvia context assembly BL7/SnH]
    H --> I[Call summarization agent\n Jo1 with special compaction persona]
    I --> J{Summarization result?}
    J -- "prompt_too_long" --> K["Retry with stripped media\n(tengu_compact_ptl_retry)"]
    K --> L{Retry result?}
    L -- still fails --> ERR3["'Compaction failed · conversation\n could not be reduced'\n(bundle.js:+9966882)"]
    L -- success --> M
    J -- "media_too_large" --> ERR4["'Compaction failed · attached media\n exceeds size limits'\n(bundle.js:+9967005)"]
    J -- "no_summary / empty" --> ERR5["Failed to generate summary\n(bundle.js:+9425463)"]
    J -- success --> M[Replace conversation history\nwith summary via dl cleanup]
    M --> N[Run PostCompact hooks\nvia T8q/MGH]
    N --> O[Emit compact_end telemetry\nDisplay 'Compacted N messages'\n(bundle.js:+9968053)]
    O --> END([Done])
```

---

## Behavioral Spec

### 1. Entry — Handler Dispatch (`UL7`)

The top-level async handler `UL7` is invoked when the user types `/compact [instructions]`.

```
async function compactCommandHandler(context, args):
    rawInstructions = args
    if not context.messages or context.messages.length == 0:
        throw Error("No messages to compact")   # bundle.js:+9968671

    customInstructions = rawInstructions.trim()  # bundle.js:+9968703

    result = await runCompactionPipeline(context, customInstructions)

    if result.cancelled:
        display("Compaction canceled.")          # bundle.js:+9969138
        return

    display("Compacted " + result.count + " messages")  # bundle.js:+9968053
```

Analysis basis: CC v2.1.139 bundle.js:+9968640

---

### 2. Auto-Compact Configuration Check (`W_8` / `CN_`)

Before the full pipeline, the runtime checks the `autoCompactEnabled` setting for automatic triggering paths.

```
function readAutoCompactSetting(appState):
    raw = appState["autoCompactEnabled"]         # bundle.js:+9442373
    if raw == "auto":                            # bundle.js:+9440576
        return resolveAutoThreshold()
    # Parses numeric percentage thresholds:
    # - values ending with "%" → parseFloat → divide by 100
    # - plain integers → divide by 1000 for decimal form
    # - valid range enforced via Number.isFinite
    # - Math.round used for normalization
    return parsedThreshold                       # bundle.js:+9440743
```

Analysis basis: CC v2.1.139 bundle.js:+9440546

---

### 3. Context Assembly and System Prompt Build (`BL7` → `E8q` → `Z0`)

`BL7` orchestrates parallel assembly of conversation context and the system prompt.

```
async function buildCompactionContext(context):
    startTime = performance.now()                # bundle.js:+9966399

    [contextSnapshot, systemPromptParts] = await Promise.all([
        assembleConversationState(context),      # E8q → bundle.js:+9966536
        buildSystemPrompt(context)               # Z0  → bundle.js:+9966547
    ])

    # Assemble message groups with compact_boundary markers
    # Marks group boundaries as role="system", type="compact_boundary"
    # bundle.js:+9845382

    return { contextSnapshot, systemPromptParts, startTime }
```

Analysis basis: CC v2.1.139 bundle.js:+9966399

The system prompt assembly (`Z0`) reads many sub-sections in parallel including:
- Memory/CLAUDE.md files (`f06`), session guidance (`Jh7`), environment info (`Eh7`, `Th7`), output style (`Ih7`/`Sh7`), and brief mode status (`kh7`).

---

### 4. PreCompact Hook Execution (`rF` → `uX`)

Before summarization begins, `PreCompact` hooks are dispatched.

```
async function runPreCompactHooks(context, messages):
    hookType = "PreCompact"                      # bundle.js:+12041401
    hookResults = await runHookDispatcher(context, hookType, {
        messages: messages
    })
    # uX dispatches to registered hook handlers
    # Checks for "block" directive in hook output
    # If blocked → emits warning "compaction-blocked-by-hook"
    #              bundle.js:+9423465
    if hookResults.decision == "block":
        return { blocked: true, reason: "compaction blocked by PreCompact hook" }
    return { blocked: false }
```

Analysis basis: CC v2.1.139 bundle.js:+9966461

---

### 5. Summarization Agent (`Jo1` / `jVq`)

The summarization agent runs with a special persona and strict tool restrictions.

```
async function runSummarizationAgent(context, customInstructions, messageGroups):
    # System prompt override for compaction agent
    agentSystemPrompt = "You are a helpful AI assistant tasked with summarizing conversations."
    # bundle.js:+9435419

    # Tool use is blocked during compaction
    # Any tool_use attempt → decision "deny" with reason:
    # "Tool use is not allowed during compaction"  # bundle.js:+9433465
    # "compaction agent should only produce text summary"  # bundle.js:+9433545

    # Context window budget for compaction:
    # Interval polling at 30000ms intervals             # bundle.js:+9433832

    # Runs with effort="high" (effort value) by default
    # bundle.js:+4048403

    response = await agentQueryLoop(agentSystemPrompt, messageGroups, {
        maxTurns: computedLimit,
        customInstructions: customInstructions,
        denyAllTools: true
    })

    if response.stopReason == "no_text_response":       # bundle.js:+9434858
        return { error: "no_summary" }

    if response.summaryText.trim() == "":
        return { error: "empty_summary" }

    return { summary: response.summaryText }
```

Analysis basis: CC v2.1.139 bundle.js:+9433745

---

### 6. Cache-Sharing Logic for Compact (`SnH` → `zo1`)

After a successful compact, the implementation attempts to share the prompt cache prefix with the new summarized context.

```
function computeCompactCachePrefix(messages, existingCache):
    # Takes a slice of messages proportional to context usage
    # Math.max / Math.floor / Math.min used for boundary calculations
    # bundle.js:+9423112–9423154
    # Emits tengu_compact_cache_sharing_success or _fallback

    slicedPrefix = messages.slice(startIndex, endIndex)
    if cacheCompatible(slicedPrefix, existingCache):
        emit("tengu_compact_cache_sharing_success")     # bundle.js:+9434226
        return slicedPrefix
    else:
        emit("tengu_compact_cache_sharing_fallback")    # bundle.js:+9434811
        return computeFallbackPrefix(messages)
```

Analysis basis: CC v2.1.139 bundle.js:+9422973

---

### 7. Conversation Replacement and Cleanup (`dl`)

After the summary is obtained, the old conversation is torn down and replaced.

```
function replaceConversationWithSummary(context, summaryText, metadata):
    # Identifies whether running in "repl_main_thread" or "sdk" mode
    # bundle.js:+5370136

    clearInternalCaches()       # D_8: ct1.clear   bundle.js:+9729623
    clearAuxCaches()            # I_1: l$6.clear, Uz_.clear  bundle.js:+5297831
    resetAutonomousLoop()       # M74.resetAutonomousLoopDelivered  bundle.js:+5370283
    resetOutputTokenStats()     # Gj  bundle.js:+5370333

    newHistory = [
        { role: "user",      content: buildSummaryUserMessage(summaryText) },
        { role: "assistant", content: "Conversation compacted." }  # bundle.js:+9844892
    ]

    # Persist compactMetadata to appState    # bundle.js:+9967214
    appState.compactMetadata = {
        originalMessageCount: ...,
        summaryTimestamp: ...,
        ...metadata
    }

    context.replaceMessages(newHistory)

    # Post-compact cleanup pass: restore any file references
    # tengu_post_compact_file_restore_success / _error  bundle.js:+9437067/9437109
```

Analysis basis: CC v2.1.139 bundle.js:+5370123

---

### 8. PostCompact Hook + UI Update (`T8q` → `MGH`)

```
async function runPostCompactFlow(context, summary, elapsed):
    # Update appState display via MGH → bf6.setState  bundle.js:+4351586
    updateAppStateDisplay(context)

    # Run PostCompact hooks
    hookType = "PostCompact"              # bundle.js:+12071678
    await runHookDispatcher(context, "PostCompact", { summary })

    # Register transcript toggle keybinding
    # action: "app:toggleTranscript"      # bundle.js:+9967914
    # key:    "ctrl+o"                    # bundle.js:+9967946
    # scope:  "Global"                    # bundle.js:+9967937
    registerKeybinding("ctrl+o", "app:toggleTranscript", "Global")

    # Display dim-formatted message: "Compacted N messages"
    # f6.dim used for styling             bundle.js:+9968046
```

Analysis basis: CC v2.1.139 bundle.js:+9967292

---

### 9. Reactive (Auto) Compact Path (`q_8` / `Q44`)

The reactive compact path is triggered automatically by the runtime (not by user invocation) when context utilization exceeds the configured threshold.

```
async function reactiveCompactAttempt(context, triggerReason):
    emit("tengu_reactive_compact_attempt")        # bundle.js:+5347343

    groups = groupMessagesByBoundary(context.messages)

    if groups.length < 2:
        log("Reactive compact: fewer than 2 groups, nothing to compact")
        # bundle.js:+5346799
        return { status: "too_few_groups" }       # bundle.js:+5346889

    assistantCount = countAssistantMessages(groups)
    if assistantCount == 0:
        log("Reactive compact: no assistant messages in summarize set, bailing")
        # bundle.js:+5347182
        return { status: "exhausted" }

    result = await runSummarizationAgent(context, "", groups)

    if result.error == "media_too_large":
        # Retry with media stripped
        log("Reactive compact: summarize hit media-size error, retrying stripped")
        # bundle.js:+5347974
        result = await runSummarizationAgent(context, "", stripMedia(groups))
        if result.error:
            emit("tengu_reactive_compact_failed")  # bundle.js:+5373119
            return { status: "media_unstrippable" }

    if result.error:
        emit("tengu_reactive_compact_failed")
        return { status: result.error }

    emit("tengu_reactive_compact_succeeded")       # bundle.js:+5374945
    return { status: "success", summary: result.summary }
```

Analysis basis: CC v2.1.139 bundle.js:+5346724

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_compact` (bundle.js:+9426843), `tengu_compact_failed` (+9436585), `tengu_reactive_compact_attempt` (+5347343), `tengu_reactive_compact_failed` (+5373119), `tengu_reactive_compact_succeeded` (+5374945), `tengu_compact_cache_sharing_success` (+9434226), `tengu_compact_cache_sharing_fallback` (+9434811), `tengu_compact_ptl_retry` (+9425099), `tengu_compact_no_summary` (+9425435), `tengu_compact_api_error` (+9425701), `tengu_compact_cache_prefix` (+9424648), `tengu_precomputed_compact_discarded` (+5353761), `tengu_post_compact_file_restore_success` (+9437067), `tengu_post_compact_file_restore_error` (+9437109), `tengu_run_hook` (+12090694), `tengu_cobalt_raccoon` (+5370580), `tengu_amber_redwood2` (+9440962), `tengu_slate_harrier` (+12154142) |
| Hook registration | `PreCompact` hook fires before summarization; `PostCompact` hook fires after replacement (bundle.js:+12041401, +12071678) |
| appState changes | `compacting` state set during operation; `compactMetadata` written on completion (bundle.js:+9966379, +9967214) |
| Cache side-effects | Prompt cache prefix shared / recomputed post-compact; `ct1.clear`, `l$6.clear`, `Uz_.clear` called (bundle.js:+9729623, +5297831, +5297843) |
| Internal resets | `M74.resetAutonomousLoopDelivered` called (bundle.js:+5370283); output token counters reset via `Gj` (+5370333) |
| Keybinding | `ctrl+o` → `app:toggleTranscript` registered post-compact (bundle.js:+9967946) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Tool use during compaction | All tool use denied; compaction agent restricted to text-only output (bundle.js:+9433465) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.139 | Initial analysis |

---

## Common Mistakes

1. **Running `/compact` with no conversation history** — the handler immediately throws `"No messages to compact"` and exits without any summarization attempt (bundle.js:+9968671). Ensure at least one message exchange exists before invoking.
2. **Expecting tool results to survive compaction** — tool call/result pairs are summarized into prose; any structured tool data in the old history is replaced by the text summary and will not be available for further tool-chaining.
3. **Assuming custom instructions are required** — the argument hint `<optional custom summarization instructions>` is fully optional; omitting it causes the agent to use default summarization behavior.
4. **Expecting compaction to complete instantly with a PreCompact hook installed** — a hook returning a `block` directive silently prevents compaction and emits a warning; check hook configuration if `/compact` appears to do nothing.
5. **Confusing manual `/compact` with auto-compact** — auto-compact uses a reactive path (`q_8`/`Q44`) that applies grouping logic with a minimum of 2 message groups; manual `/compact` bypasses that grouping minimum and uses a different entry flow.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `UL7` | Main async handler for `/compact` command |
| `G$` | Message group boundary utility |
| `Tq7` | Message boundary tagging helper |
| `fP` | Boundary record factory |
| `$OH` | Context reader / conversation state loader |
| `e$6` | Conversation state extractor |
| `j6` | Conversation message store accessor |
| `L46` | Message list left boundary helper |
| `M46` | Message list right boundary helper |
| `Ya` | Conversation group splitter |
| `Ql6` | Group deduplication / cache helper |
| `b6` | Message group builder |
| `iP` | API model token budget reader |
| `SH` | String conversion utility |
| `WG` | Model context window size resolver |
| `Y_H` | Model name normalizer |
| `gd` | Extended model context window lookup |
| `R1` | Model capability checker |
| `My` | API provider type resolver |
| `$w` | Provider config builder |
| `D_H` | Model token budget for specific provider |
| `Sd6` | Token budget with provider fallback |
| `W_8` | Auto-compact settings reader |
| `D0` | AutoCompact configuration parser |
| `q7` | Legacy global config reader |
| `CN_` | Threshold string parser (auto/percent/numeric) |
| `BL7` | Compaction pipeline orchestrator |
| `hV` | Message normalization for summarization input |
| `$87` | Message type classifier for compaction |
| `QUH` | Token counter utility |
| `iN_` | Conversation message normalizer |
| `rF` | PreCompact hook runner |
| `q4` | Hook client builder |
| `V6` | Hook result validator |
| `yk` | Hook effort resolver |
| `ij` | Hook model selector |
| `TV` | Hook effort-to-model mapper |
| `A` | Effort value getter |
| `tN` | Hook API context builder |
| `C6` | Tool context builder |
| `uX` | Hook executor / dispatcher |
| `eu` | Policy settings loader |
| `N` | Log level / debug emitter |
| `oKH` | Hook output formatter |
| `wB_` | Hook type router |
| `O` | Background session marker |
| `IZq` | Hook input stringifier |
| `YB_` | Hook result filter |
| `vZq` | Hook async result resolver |
| `Q` | Async queue manager |
| `yH` | JSON serializer utility |
| `LH` | Logger with error reporting |
| `xH` | Queue state reader |
| `rjH` | Queue item factory |
| `BE` | Abort controller / timeout manager |
| `j` | Process callback registry |
| `cHH` | Hook cancellation handler |
| `Gb` | Hook result gatherer |
| `DB_` | MCP tool hook dispatcher |
| `vP8` | Hook output plain-text parser |
| `zB_` | HTTP hook executor |
| `VZq` | HTTP hook response normalizer |
| `CKH` | Hook context builder |
| `NP8` | Shell/spawn hook executor |
| `kH` | Queue consumer |
| `K` | Output formatter / padder |
| `L` | Task runner with cleanup |
| `f` | Stream pair manager |
| `M` | MCP server manager |
| `WIH` | MCP connection initializer |
| `Niq` | MCP update applier |
| `$` | MCP client pool |
| `Wa7` | MCP server reconnect orchestrator |
| `E8q` | Conversation state snapshot builder |
| `Z0` | System prompt assembler |
| `vB_` | System prompt section builder |
| `H$8` | Memory file content loader |
| `m_` | Plugin hook loader |
| `lG` | Language setting reader |
| `Hh7` | Code style instruction section |
| `_h7` | Model override section |
| `hB_` | Context management mode reader |
| `Rh7` | Context management instruction builder |
| `j$6` | Memory message injector |
| `Ah7` | Memory section builder |
| `Jh7` | Session guidance builder |
| `f06` | CLAUDE.md memory loader |
| `Kh7` | Ant model override section |
| `Eh7` | Static environment info section |
| `Th7` | Simple environment info section |
| `Lh7` | Language instruction section |
| `fh7` | Output style section |
| `Vh7` | Background session section |
| `Ih7` | Scratchpad section |
| `vh7` | FRC section |
| `kh7` | Brief mode checker |
| `Sh7` | Context mode instruction section |
| `Xh7` | Environment variable section |
| `_A1` | Computed context section builder |
| `Ph7` | Plan mode section |
| `Mh7` | Memory update section |
| `$h7` | Reproduce/verify workflow section |
| `Oh7` | Task progress section |
| `zh7` | Background task status section |
| `Dh7` | Todo section builder |
| `jh7` | Companion intro section |
| `jEq` | Session start reminder |
| `hfH` | Memory loader for user/project |
| `dC` | Agent memory / system prompt reader |
| `cq` | Conversation system prompt loader |
| `Rw` | Memory content deduplicator |
| `U$8` | Compact system prompt helper |
| `yN_` | Non-interactive compact flag reader |
| `jD_` | Reactive compact entry point |
| `lJ` | Message history slicer |
| `n3H` | Migration marker checker |
| `Fg9` | Group metadata builder |
| `HM6` | History migration helper |
| `q_8` | Reactive compact core logic |
| `PgH` | Message group pusher |
| `w` | Background session process manager |
| `Q44` | Summarization API caller (reactive path) |
| `J` | Background job registry |
| `c44` | Gap computation helper |
| `Y8` | Async queue reader |
| `IA1` | Manual compact orchestrator |
| `rf6` | Message entry converter |
| `JGH` | Compact job ID generator |
| `JF` | Compact API client factory |
| `Cf6` | API config resolver |
| `skH` | API skip header builder |
| `NgH` | Extended output token resolver |
| `HO6` | UUID generator for compact job |
| `jt` | Telemetry event emitter |
| `z74` | Tool schema builder for compact agent |
| `zOH` | Compact API request dispatcher |
| `PD_` | Message boundary pointer |
| `_1H` | Message state cleanup |
| `C88` | Token usage counter |
| `R88` | Compact output formatter |
| `dl` | Post-compact cleanup orchestrator |
| `Cu` | Context type detector (repl vs sdk) |
| `M_8` | Pre-compact state snapshotting |
| `f_8` | Cache key builder |
| `DA1` | Compact queue manager |
| `af6` | Background job scheduler |
| `BG` | Background compact runner |
| `Jt` | External event emitter for compact |
| `oE8` | Compact event type |
| `KZ8` | Compact write-through helper |
| `MA1` | Conversation replacement handler |
| `gl` | Conversation reset helper |
| `D_8` | Cache store clearer (ct1) |
| `I_1` | Aux cache clearer (l$6, Uz_) |
| `Gj` | Output token stat resetter |
| `wD_` | Post-cleanup state update |
| `MGH` | App state display updater (bf6.setState) |
| `T8q` | PostCompact hook + keybinding registrar |
| `QcH` | Model selector for PostCompact |
| `Fu4` | Model variant resolver |
| `uJ` | Keybinding registrar |
| `by9` | Keybinding config reader |
| `Rr6` | Action ID resolver |
| `e3H` | OTEL/metrics event emitter |
| `HL` | OTEL span builder |
| `AE8` | OTEL metric attribute builder |
| `wBH` | OTEL metric recorder |
| `ctH` | OTEL context helper |
| `vs` | App state writer after compact |
| `uF9` | State update emitter |
| `SnH` | Full manual compact pipeline |
| `wgH` | Compact warning emitter |
| `__8` | Whitespace-trim helper |
| `$8` | Message ID + UUID generator |
| `Jo1` | Summarization agent loop |
| `yc1` | Agent turn counter |
| `kc1` | Agent interval runner |
| `NE` | Agent turn executor |
| `sz_` | Tool permission context reader |
| `G` | Context pool accessor |
| `qm` | Random bytes generator |
| `wt` | Extended output token limit fetcher |
| `WC` | Subagent exit handler |
| `o88` | Tool use gate checker |
| `MOH` | Max turns enforcer |
| `H_8` | Turn limit helper |
| `Y` | Background session entry |
| `B44` | Agent loop completion handler |
| `_D_` | Tool use denial helper |
| `t9H` | Max output token resolver |
| `yfH` | Per-model token cap lookup |
| `hs` | Token count validator |
| `y2` | Last assistant message finder |
| `Wh` | Content array checker |
| `V` | Streaming response handler |
| `d6H` | Display message writer |
| `KP6` | Tool schema pipeline |
| `M_` | Tool list flattener |
| `ZJH` | Tool search mode evaluator |
| `lTH` | Tool name lowercaser |
| `dVH` | Tool filter checker |
| `FN_` | Tool search eligibility filter |
| `H87` | Tool search mode dispatcher |
| `HD_` | Message content flattener |
| `A_8` | Content block normalizer |
| `v67` | Tool result filter |
| `N67` | Tool reference normalizer |
| `qP6` | Tool reference presence checker |
| `kN_` | Recursive tool reference stripper |
| `$o1` | Unicode surrogate pair detector |
| `DnH` | Tool permission context builder |
| `dN_` | Tool permission entry builder |
| `jVq` | Main agent query loop |
| `cG` | Conversation context builder |
| `c17` | Message content builder |
| `o17` | Content block type mapper |
| `Sy_` | Streaming message accumulator |
| `a17` | Attachment presence checker |
| `S` | Rate limit tracker |
| `cO8` | Content type validator |
| `Lq7` | Random UUID for message |
| `r2` | Response message builder |
| `fT_` | Final text content extractor |
| `lO8` | Content block stop handler |
| `Qm` | Tool filter for compaction |
| `xy_` | Extended content normalizer |
| `l17` | Attachment content normalizer |
| `v` | Away-summary generator |
| `T` | Remote control input handler |
| `n17` | Attachment block presence checker |
| `ML` | Message list utility |
| `wHq` | Context window usage calculator |
| `t17` | Tool result accumulator |
| `D` | Supervisor / daemon config updater |
| `ae1` | Message pair pusher |
| `fq7` | Final text join helper |
| `W` | Skill event emitter |
| `s17` | Streaming content stop handler |
| `FY6` | Orphaned thinking filter |
| `Zq7` | Trailing thinking block filter |
| `BY6` | Whitespace-only assistant filter |
| `Vq7` | Empty assistant content fixer |
| `e17` | Session start message builder |
| `oe1` | System reminder injector |
| `se1` | Content block appender |
| `r17` | File reference attachment checker |
| `q` | Daemon file unlinker |
| `X` | MCP server connection manager |
| `U08` | MCP server status reader |
| `q_` | Error/string utility |
| `zo1` | Cache prefix slice calculator |
| `ca6` | Context token counter |
| `R0H` | Content type checker (array) |
| `oL_` | Token count parser from headers |
| `ec` | Message prefix checker |
| `w_8` | File reference restoration helper |
| `k67` | File path normalizer for restoration |
| `wn6` | Path prefix checker |
| `oA` | File path validator and resolver |
| `h67` | Multi-file restore handler |
| `gG` | Git context reader |
| `jWH` | CLAUDE.md file resolver |
| `Ev_` | At-mention file content loader |
| `mnH` | MCP resource reader |
| `$h6` | MCP content type helper |
| `MmH` | Header field normalizer |
| `B6` | Boolean config reader |
| `Mt4` | PDF/large file reference handler |
| `SV` | OTEL at-mention event emitter |
| `MPH` | Byte-to-token estimator |
| `t4` | String index finder |
| `M9` | UUID generator (Qn1.randomUUID) |
| `W5` | Token round utility |
| `X_8` | Local agent state loader |
| `y3` | Task list path builder |
| `FlH` | Task file path formatter |
| `J_8` | Plan file reference builder |
| `O0` | Working directory context builder |
| `D8` | w8 byte helper |
| `P_8` | Background agent state builder |
| `j_8` | MCP server snapshot builder |
| `cE8` | Cache set helper |
| `y67` | Token slice adjuster |
| `OOH` | MCP tool pool initializer |
| `Vv_` | Deferred tool pool manager |
| `z` | Worker thread manager |
| `P` | Buffer concat / HTTP reader |
| `J9` | Deferred tool entry |
| `$E` | Tool pool change emitter |
| `IgH` | Tool permission resolver |
| `yO_` | Tool permission list builder |
| `vq` | String utility |
| `l9H` | Permission context key builder |
| `Fw6` | Permission filter |
| `iDH` | Tool flatMap permission helper |
| `B36` | Built-in tool filter |
| `K68` | Tool name case normalizer |
| `o1` | Permission policy builder |
| `fFA` | Permission flag A |
| `LFA` | Permission flag B |
| `Pw` | API key and provider config |
| `hO_` | Permission list display builder |
| `vgH` | MCP instructions pool manager |
| `G61` | MCP instruction entry tracker |
| `_m` | Plugin hook pipeline loader |
| `fL` | Git bare-repo checker |
| `xw` | Policy settings reader |
| `v8` | VS6 model config reader |
| `PBH` | Plugin include-list checker |
| `oSH` | Append-file logger |
| `G8` | File-based logger |
| `Q$6` | Streaming query dispatcher |
| `IX` | Full streaming agent runner |
| `Tf` | Token formatter |
| `pQ` | Token prefix |
| `A_` | Token suffix |
| `Qj` | Context mode string builder |
| `TR` | Context mode type |
| `G46` | REPL context reader |
| `o$6` | Custom instructions cleaner |
| `g44` | Whitespace/trim normalizer |
| `fl` | History migration flag checker |
| `wo1` | Compaction error display handler |
| `IH` | String converter |
| `ON` | Output queue manager |
| `xN_` | Non-interactive system prompt helper |