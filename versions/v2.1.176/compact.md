---
type: feature-spec
feature: "compact"
cc_version: "2.1.176"
updated: "2026-06-13"
tags: ["compact", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.176 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/compact`

> Analysis basis: CC v2.1.176 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.176

---

## Overview

`/compact` frees up context window space by summarizing the current conversation into a compact representation, then replacing the message history with that summary. It supports an optional custom summarization instruction argument and can be triggered both manually by the user and automatically by the runtime when context limits are approached. The command runs through a multi-phase pipeline: hook invocation, summary generation via the API, and post-compaction session restoration.

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
| module_id | `deq` |
| load_inline | `true` |
| loc_byte | `11355281` |
| loc_byte_end | `11355581` |
| loc_line | `7508` |
| arbor_handler.name | `AbL` |
| arbor_handler.fqn | `claude-2.1.176::AbL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.176 bundle.js:+11355281

---

## Input Branching

The command has four or more distinct execution paths depending on message availability, hook outcomes, API results, and error conditions, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A[User invokes /compact\noptional custom instructions] --> B{Messages exist?}
    B -- No --> ERR_NONE["Throw: 'No messages to compact'\n(bundle.js:+11354342)"]
    B -- Yes --> C[Trim custom instructions argument\n(bundle.js:+11354374)]
    C --> D[Run PreCompact hook via hookRunner\n(bundle.js:+11354391)]
    D --> E{Hook result}
    E -- Blocked --> ERR_HOOK["Emit 'compaction-blocked-by-hook'\nNotify user, abort\n(bundle.js:+10764663)"]
    E -- Allowed --> F[Build system prompt context\nvia systemPromptBuilder\n(bundle.js:+11354409)]
    F --> G[Request summary from API\nvia compactionCore / summaryRequest\n(bundle.js:+11354432)]
    G --> H{API outcome}
    H -- prompt_too_long --> ERR_PTL["Emit tengu_compact_ptl_retry\nSurface 'Compaction failed · context limit'\n(bundle.js:+10766766)"]
    H -- media_too_large --> ERR_MEDIA["Surface 'Compaction failed · media size'\n(bundle.js:+11351476)"]
    H -- no_summary / empty --> ERR_NOSUMM["Emit tengu_compact_no_summary\nSurface failure\n(bundle.js:+10767110)"]
    H -- API error --> ERR_API["Emit tengu_compact_api_error\n(bundle.js:+10767406)"]
    H -- Success --> I[Replace conversation with summary\nset compact boundary marker 'compact_boundary'\n(bundle.js:+11104756)]
    I --> J[Restore post-compact state:\nrun PostCompact hook, reload file contexts,\nreset app state\n(bundle.js:+11354576)]
    J --> K[Emit tengu_compact\nDisplay 'Compacted …' message\n(bundle.js:+10768705)]
    K --> DONE[Session continues with\ncompacted context]
```

---

## Behavioral Spec

### Top-level handler (`AbL`)

```
async function handleCompactCommand(args, context):
    instructions = args.trim()          // bundle.js:+11354374
    if conversationMessages is empty:
        throw Error("No messages to compact")  // bundle.js:+11354342

    // Phase 1: pre-compact hook
    hookResult = await runPreCompactHook(context)  // bundle.js:+11354391
    if hookResult.blocked:
        emitWarning("compaction-blocked-by-hook")  // bundle.js:+10764663
        return

    // Phase 2: build context & request summary
    systemContext = await buildSystemPromptContext(context)  // bundle.js:+11354409
    summary = await requestCompactionSummary(systemContext, instructions)  // bundle.js:+11354432

    // Phase 3: apply compaction
    replaceHistoryWithSummary(summary)   // inserts compact_boundary marker
    await runPostCompactHook(context)    // bundle.js:+11354576
    cleanupPostCompact()                 // bundle.js:+11354601

    // Phase 4: display result
    showCompactedNotification()          // bundle.js:+11354674
    emit("tengu_compact")               // bundle.js:+10768705
```

Analysis basis: CC v2.1.176 bundle.js:+11354311

---

### Conversation boundary insertion (`Tz` / `_p8`)

```
function insertCompactBoundary(messages):
    // Finds or inserts the boundary marker message
    boundary = findBoundaryInMessages(messages, "compact_boundary")  // bundle.js:+11104756
    // Returns slice index: 1-based from boundary, 0 if absent
    // literals: value 1 at +11104810, value 0 at +11104815
    sliceIndex = boundary ? boundaryPosition + 1 : 0
    return messages.slice(sliceIndex)
```

Analysis basis: CC v2.1.176 bundle.js:+11354311, +11104886

---

### System prompt context builder (`Qeq` / `mZ`)

```
async function buildSystemPromptContext(context):
    appState = getAppState()
    // Assembles: agent identity, tool list, memory, env info, flags,
    // MCP plugin list, and feature flags from appState
    // Calls many sub-builders: J75, X75, P75, R75, i06, g75, F75, etc.
    contextParts = await Promise.all([
        buildTaskContinuity(appState),      // J75 — bundle.js:+13764732
        buildFableIdentity(appState),       // P75 — bundle.js:+13764801
        buildEnvironmentInfo(appState),     // g75 — bundle.js:+13765165
        buildMemoryPrompt(appState),        // i06 — bundle.js:+13765101
        buildMCPContext(appState),          // F75 — bundle.js:+13765202
        buildOutputStyle(appState),         // E75 — bundle.js:+13765542
        ...moreBuilders
    ])
    return mergeContextParts(contextParts)
```

Analysis basis: CC v2.1.176 bundle.js:+11354446, +11353798

---

### Compaction core request (`qbL`)

```
async function compactionCore(systemContext, customInstructions):
    t0 = performance.now()              // bundle.js:+11350393
    
    // Collect current conversation turns
    messages = gatherMessages()         // via fP — bundle.js:+11350415
    tools    = await gatherTools()      // via Wo — bundle.js:+11350457
    state    = await buildState()       // via Qeq — bundle.js:+11350532
    
    progressUpdate("compact_progress")  // bundle.js:+11350256 (literal)
    progressUpdate("pre_compact")       // bundle.js:+11350310 (literal)
    
    // Notify SDK / hooks
    await notifyHookStart()             // via Fu8 — bundle.js:+11350543
    
    // Select model and call API
    progressUpdate("compacting")        // bundle.js:+11350372 (literal)
    result = await runCompactionRequest(
        messages, tools, systemContext, customInstructions
    )                                   // via KbL — bundle.js:+11350847

    if result.outcome == "miss_not_ready":
        emit("compact_start")           // bundle.js:+11350816
        // wait for agent ready

    handleCompactionResult(result)      // via A6H, aRH, geq
    return result
```

Analysis basis: CC v2.1.176 bundle.js:+11350393

---

### Compaction API call (`KbL`)

```
async function runCompactionRequest(messages, tools, systemCtx, customInstructions):
    t0 = performance.now()

    // Check boundary UUID present
    boundaryCheck = validateBoundaryUUID(messages)  // bundle.js:+11353053
    if !boundaryCheck:
        record("boundary_uuid_missing")             // bundle.js:+11353053

    // Issue API call for summary
    apiResult = await issueCompactionApiCall(...)   // via Qf6 — bundle.js:+11352691
    
    if apiResult.status == "aborted":
        record("aborted")                           // bundle.js:+11352799
        return

    elapsed = Math.round(performance.now() - t0)
    
    // Validate summary output
    if !apiResult.hasSummaryText:
        record("no_summary")                        // bundle.js:+10767038
        return failure

    summary = apiResult.summaryText
    applyCompactBoundary(messages, summary)         // via Fx8 — bundle.js:+11353041
    record("hit")                                   // bundle.js:+11353180
    return success
```

Analysis basis: CC v2.1.176 bundle.js:+11352610

---

### Post-compact cleanup (`A6H`)

```
function postCompactCleanup(context):
    // Clears subagent exit marker
    clearSubagentExit()             // via gx8 — bundle.js:+10597858
    // Clears synthesis/cache references
    clearSynthesisCache()           // via ux8, fi9 — bundle.js:+10597953
    // Resets autonomous loop state
    resetAutonomousLoopDelivered()  // bundle.js:+10597991
    // Resets display / feature state
    resetOutputTokenCounter()       // via DD — bundle.js:+10598041
    // Record telemetry
    record("post_compact_cleanup")  // bundle.js:+10597864
```

Analysis basis: CC v2.1.176 bundle.js:+10597848

---

### Reactive (automatic) compaction (`T4A` / `cx8`)

```
async function reactiveCompact(context):
    // Triggered automatically when context window approaches limit
    record("compact_reactive")          // bundle.js:+10604272
    
    messages = collectMessages()
    groups   = splitIntoGroups(messages)
    
    if groups.length < 2:
        record("too_few_groups")        // bundle.js:+5144410
        return { outcome: "skip" }
    
    summarizeSet = selectSummarizeSet(groups)   // keeps last group
    
    if !summarizeSet.hasAssistantMessage:
        record("no_assistant_message")
        return { outcome: "skip" }
    
    // Attempt summary; retry if media_too_large
    result = await attemptReactiveSummary(summarizeSet)   // via gz7
    
    if result.outcome == "media_too_large":
        strippedSet = stripMedia(summarizeSet)
        if strippedSet.isEmpty:
            record("media_unstrippable")      // bundle.js:+5146126
            return failure
        result = await attemptReactiveSummary(strippedSet)
    
    if result.outcome == "ok":
        emit("tengu_reactive_compact_succeeded")   // bundle.js:+10604294
        applyReactiveCompactBoundary(result.summary)
    else:
        emit("tengu_reactive_compact_failed")      // bundle.js:+10601829
    
    return result
```

Analysis basis: CC v2.1.176 bundle.js:+10601481, +10603015

---

### Summary display (`geq`)

```
function displayCompactionResult(summary, context):
    // Register keyboard shortcut app:toggleTranscript → ctrl+o
    registerKeybinding("app:toggleTranscript", "ctrl+o")   // bundle.js:+11353603
    
    // Render dimmed "Compacted N tokens…" line
    outputDimmed("Compacted " + tokenCountDescription)      // bundle.js:+11353742
    
    // Update transcript viewer via X2
    updateTranscriptView(summary)    // bundle.js:+11353600
```

Analysis basis: CC v2.1.176 bundle.js:+11353587

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_compact` (main success, +10768705); `tengu_compact_ptl_retry` (+10766766); `tengu_compact_no_summary` (+10767110); `tengu_compact_api_error` (+10767406); `tengu_compact_full` (+10767865); `tengu_compact_cache_prefix` (+10766290); `tengu_compact_cache_sharing_success` (+10777163); `tengu_compact_cache_sharing_fallback` (+10777793); `tengu_compact_failed` (+10780010); `tengu_compact_credits_clamp_rescue` (+5144972); `tengu_reactive_compact_attempt` (+5145129); `tengu_reactive_compact_succeeded` (+10604294); `tengu_reactive_compact_failed` (+10601829); `tengu_precomputed_compact_consumed` (+10596621); `tengu_precomputed_compact_discarded` (+10597244); `tengu_compact_not_enough_messages` (+10765652); `tengu_post_compact_file_restore_success` (+10780496); `tengu_post_compact_file_restore_error` (+10780538); `tengu_compact_manual` (+10765465); `tengu_compact_auto` (+10765450) |
| Hook registration | Runs `PreCompact` hook before compaction begins (+13680381 literal); runs `PostCompact` hook after completion (+13680381 / +11354576). Both are dispatched through the general hook runner (`QG`). |
| appState changes | Conversation message list is replaced with compacted summary; a `compact_boundary` marker message is inserted (+11104756); `compactMetadata` field is written (+11351684). Subagent exit state, synthesis cache, and autonomous-loop delivered flag are all reset. |
| Span / tracing | Opens an OTEL span named `claude_code.compaction` (+10765514) via span type `compact`. |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Progress events | Emits string literals `compact_progress`, `pre_compact`, `sdk_status`, `compacting`, `compact_start`, `hooks_start`, `stream_mode`, `compact_end` as progress state transitions during execution. |
| Keyboard shortcut side-effect | Registers `app:toggleTranscript` → `ctrl+o` (`Global` scope) as part of the post-compaction display step (+11353603). |

---

## Version History

| Version | Change |
|---|---|
| v2.1.176 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/compact` on an empty conversation** — the handler immediately throws `"No messages to compact"` (+11354342). The command requires at least one message turn to be present.
2. **Expecting tool use during compaction** — the compaction agent is specifically restricted to producing only a text summary; any tool-use attempt results in a `deny` with message `"Tool use is not allowed during compaction"` (+10776286).
3. **Assuming reactive and manual compaction are identical** — reactive compaction (`T4A`/`cx8`) uses a different entry point, groups messages, and has media-stripping retry logic (`gz7`/`Qz7`) absent from the manual path.
4. **Providing custom instructions that include whitespace padding** — the handler trims the argument before use (+11354374); leading/trailing whitespace is silently removed.
5. **Expecting compaction to proceed when a PreCompact hook blocks it** — if any registered PreCompact hook returns a block decision, the command is cancelled and emits `"compaction-blocked-by-hook"` (+10764663) without ever calling the API.
6. **Assuming /compact is always manual** — the same underlying compaction pipeline is also triggered automatically by the context management system (`compact_reactive` at +10604272) as the context window fills; users should expect that a `compact_boundary` may already exist when they invoke the command manually.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `AbL` | Top-level `/compact` command handler (AsyncFunction) |
| `Tz` | Compact boundary locator / message slicer |
| `_p8` | Boundary index helper called by `Tz` |
| `AX` | Utility called by `_p8` |
| `Po` | Pre-compaction hook runner entry |
| `p_` | Hook dispatch helper |
| `$6` | Core hook execution engine |
| `W06` | Hook sub-helper (dispatch leg 1) |
| `G06` | Hook sub-helper (dispatch leg 2) |
| `em` | Hook helper |
| `Fm` | Hook dependency |
| `eM8` | Hook key lookup / registration |
| `L2_` | Hook event emitter / UUID generator |
| `wN_` | Hook result writer |
| `qbL` | Compaction core orchestrator |
| `fP` | Message gatherer for compaction |
| `chL` | System-message normaliser |
| `D2H` | Message block formatter |
| `eu8` | Full conversation normaliser / attachment handler |
| `Wo` | Tool list collector for compaction context |
| `v7` | Tool schema builder |
| `S6` | Tool entry schema helper |
| `Ty` | Tool type guard helper |
| `L2` | API model capability checker |
| `VN` | Effort / thinking level resolver |
| `lh` | Tool listing helper |
| `x6` | Tool name sanitiser |
| `QG` | Hook runner (runs all hook types: PreCompact, PostCompact, etc.) |
| `ib` | Policy settings reader |
| `N` | Message formatter / role mapper |
| `hzH` | LXH context linker |
| `lPA` | Hook filter and loader for plugins |
| `cPA` | Hook filter by type |
| `lZK` | Hook filter helper |
| `rZK` | Hook result reducer |
| `d` | Logging / debug helper |
| `CH` | JSON serialiser wrapper |
| `kH` | Hook executor with error logging |
| `bH` | Hook error reporter |
| `QNH` | Hook notification dispatcher |
| `Ph` | Timeout / abort controller for hooks |
| `J` | Daemon/process manager reference |
| `AqH` | Hook output validator |
| `Xh` | Hook output schema validator |
| `Tc8` | Hook output parser (JSON/plain text) |
| `FPA` | MCP hook tool executor |
| `Vc8` | Hook JSON output parser |
| `lKH` | Hook plugin metrics recorder |
| `BPA` | HTTP hook executor |
| `cZK` | HTTP hook output parser |
| `LzH` | Hook log helper |
| `vc8` | Shell command hook executor |
| `DbH` | Hook async poller |
| `IH` | Hook result success recorder |
| `xg` | Telemetry emitter wrapper |
| `K` | MCP server list processor |
| `f` | Async task tracker |
| `L` | MCP connection wrapper |
| `M` | MCP server manager / connector map |
| `LbH` | MCP server connector |
| `Ho8` | MCP update applier |
| `$` | MCP client reference |
| `vZA` | MCP connection state reconciler |
| `Qeq` | System prompt context assembler |
| `mZ` | Sub-builder orchestrator for system prompt sections |
| `M2A` | Initial message context builder |
| `Tm8` | Tool availability context builder |
| `r_` | Runtime flag reader |
| `_aH` | Pewter-owl feature flag probe |
| `SG` | Session-guid context builder |
| `J75` | Task continuity prompt builder |
| `X75` | Confirmation-behaviour prompt builder |
| `P75` | Confirmation-behaviour extended builder |
| `cjH` | Fable identity check |
| `Ss` | Key-format helper |
| `bs` | Fable model detector |
| `w2A` | System prompt mode selector (off/additive/compact) |
| `a75` | System prompt wrapper |
| `nQ` | Runtime flag reader (alias) |
| `R75` | Task-doing / tool-use prompt builder |
| `i06` | Memory prompt loader |
| `g75` | Environment info (static) builder |
| `F75` | MCP instructions prompt builder |
| `V75` | Language prompt builder |
| `v75` | Output style prompt builder |
| `d75` | Background session prompt builder |
| `c75` | Scratchpad prompt builder |
| `n75` | Brief mode prompt builder |
| `o75` | Flag settings prompt builder |
| `x75` | Growthbook experiment injector |
| `E75` | Context management (compact) prompt builder |
| `Z75` | Compact mode system prompt writer |
| `_mq` | UltraMemory context builder |
| `b75` | Base identity prompt builder |
| `N75` | Heron-brook prompt builder |
| `h75` | Autonomy append prompt builder |
| `y75` | Verified-vs-assumed prompt builder |
| `I75` | System prompt assembler wrapper |
| `k75` | Session guidance prompt builder |
| `C75` | Act-dont-rederive prompt builder |
| `sf9` | Memory-store prompt combiner |
| `HXH` | Anthropic-AWS context injector |
| `U75` | Session prompt finaliser |
| `u_` | Agent state / working-directory extractor |
| `A` | App state value accessor |
| `mu8` | Allowed-tools extractor |
| `pu8` | Disallowed-tools extractor |
| `Mx` | Permission-mode resolver |
| `cU` | Full system prompt assembler |
| `gf` | System prompt string builder |
| `UW` | Model capability helper |
| `x_` | Module initialiser helper |
| `tO` | System prompt type selector |
| `eH` | Success recorder |
| `K6` | nM6-linked helper |
| `Fu8` | Notification dispatcher for compaction |
| `N7A` | State-notification broadcaster |
| `KbL` | Compaction API call runner |
| `Y4A` | Abort / cancel watcher |
| `px8` | Pending-request tracker |
| `_` | Generic utility / string helper |
| `Qf6` | Compaction API response parser |
| `Ux8` | Compaction API request builder |
| `Z$` | Token counter helper |
| `z1` | nM6 logging helper |
| `j4A` | Conversation slice selector (finds compact boundary index) |
| `Fx8` | Compaction result recorder / performance timer |
| `cx8` | Reactive compact full pipeline |
| `cyH` | Agent-type start-with checker |
| `Cb` | Agent-type start-with checker (variant) |
| `LP` | Conversation loader / message fetcher |
| `mv9` | Message pagination helper |
| `Pe` | Message permission filter |
| `UZ6` | Header entry converter |
| `nRH` | Non-reactive hook filter |
| `Qi` | gN9-linked tool query helper |
| `fV6` | File-save tool executor |
| `wJ8` | File-save name validator |
| `HCH` | File-write executor |
| `QgH` | Queue gate helper |
| `cf6` | Config file watcher |
| `P4` | Config watcher helper |
| `px6` | UUID generator for compaction turn |
| `uKH` | Compaction message attachment builder |
| `uhL` | Attachment type checker |
| `xhL` | M6H attachment formatter |
| `sVL` | Compaction pipeline sub-orchestrator |
| `nx8` | Tool-file restore handler (post-compact) |
| `ax8` | App-state restore handler (post-compact) |
| `ix8` | Image-file restore handler (post-compact) |
| `ox8` | Message-file restore handler (post-compact) |
| `rx8` | Resource-file restore handler (post-compact) |
| `$OH` | Compaction hook extras builder |
| `lpH` | Tool-listing prompt builder |
| `npH` | Tool-listing notification builder |
| `z9` | Message UUID factory |
| `sg` | Plugin/hook session-start loader |
| `MEH` | Context-window diagnostic builder |
| `E4A` | Attachment mapper for compaction |
| `fUH` | Tool-use attachment filter |
| `i$H` | In-progress flag setter |
| `AJ8` | Token rounding helper |
| `_J8` | Message-rendering pipeline |
| `fG` | Full conversation rendering engine |
| `gM` | Token size approximator |
| `LO7` | Message render cache manager |
| `oE` | Context reader (L2/VN) |
| `u$` | App-state reader |
| `T4A` | Reactive compact entry point |
| `NJ8` | Reactive compact group analyser |
| `DV6` | Reactive compact turn builder |
| `q` | u1-linked message store |
| `Xh9` | Gap size calculator (floor/max) |
| `D` | Background session / process manager |
| `gz7` | Reactive compact API caller |
| `j` | Background process killer |
| `Qz7` | Reactive compact retry wrapper |
| `rZ6` | iZ6-linked cancellation helper |
| `iZ6` | Cancellation token factory |
| `bp` | Path / string sanitiser for telemetry |
| `vO7` | URL sanitiser |
| `PO7` | Phone sanitiser |
| `GO7` | Path replace helper |
| `DO7` | IP sanitiser |
| `OO7` | Email sanitiser |
| `MO7` | Home-dir sanitiser |
| `EO7` | Path tilde helper |
| `TO7` | Path sanitiser variant |
| `VO7` | API-error sanitiser |
| `bv9` | Reactive compact abort recorder |
| `n6` | Result recorder (d/eH pair) |
| `TH` | String coercer |
| `A6H` | Post-compact state reset orchestrator |
| `gx8` | Subagent-exit clearer / pending deleter |
| `FZ6` | uT-linked cleanup helper |
| `uT` | Cleanup utility |
| `i36` | Inner reset helper |
| `a36` | eG/N8H notification helper |
| `eG` | Event emitter |
| `N8H` | Reset notification helper |
| `ux8` | sdq-cache clearer |
| `fi9` | AN6/NQ_ cache clearers |
| `IWq` | H-linked state watcher |
| `CGH` | H/_-linked reset helper |
| `DD` | Output-token counter reset |
| `P4A` | Post-compact residual cleanup |
| `aRH` | App-state setter (via qV6.setState) |
| `geq` | Compaction result display controller |
| `qxH` | kU7-linked display helper |
| `kU7` | Model-selector display helper |
| `X2` | Transcript viewer updater |
| `yz8` | SSH-linked view helper |
| `Iz8` | GS_/tw9 view state helper |
| `BPH` | OTEL metrics reporter for compaction |
| `sf` | OTEL span/event writer |
| `KRH` | OTEL resource-attributes builder |
| `s36` | Span helper |
| `cs8` | Metric emitter |
| `ls8` | Log emitter |
| `JK6` | Full compaction pipeline (manual, auto) |
| `$N6` | Tracing span opener for compaction |
| `g9H` | Tracing helper |
| `zh` | Span attribute setter |
| `IR` | G3H.active tracing guard |
| `MH6` | Model override helper |
| `vJ8` | Summary text trimmer |
| `U8` | Streaming response collector |
| `P` | Buffer / stream reader |
| `X` | Stream multiplexer |
| `mL` | Stream end writer |
| `qI5` | Full daemon PTY/stream protocol handler |
| `vnq` | Compaction streaming event loop |
| `dBq` | Context-budget reader |
| `Mx6` | TKA-linked budget reader |
| `QBq` | Budget query helper |
| `A6` | String coercer (String wrapper) |
| `mT` | Compaction turn manager / streaming loop |
| `xC8` | App-state mutation during streaming |
| `uC8` | Post-stream state updater |
| `XR` | Request-ID generator |
| `RKH` | Tool filter for compaction |
| `dU` | Post-compaction bH/IH state recorder |
| `hE` | Streaming heartbeat helper |
| `zu6` | eNL tombstone guard |
| `L6H` | Stream log helper |
| `Uu8` | Stream metrics updater |
| `fnq` | zu6-linked tombstone clearer |
| `Y` | Process-exit / abort helper |
| `p3H` | AX/dm7-linked tool filter |
| `HhL` | Stream completion recorder |
| `Fp_` | Stream chunk processor |
| `aMH` | Max-output-tokens resolver |
| `eJH` | Token limit lookup table |
| `X9H` | CLAUDE_CODE_MAX_OUTPUT_TOKENS parser |
| `fv` | Last-message finder |
| `VJ8` | Summary tag wrapper (inserts `<summary>` tags) |
| `ZJ8` | Summary tag finder (findLast `<summary>`) |
| `d8` | `_`-linked utility |
| `$hL` | K6/eH error path helper |
| `Ra` | Error display helper |
| `Du6` | Tool-search mode decision engine |
| `pwH` | Tool-search permission checker |
| `Ye` | Model name lower-case checker |
| `hpH` | H.some/of tool helper |
| `pu_` | ZkH/mu_/hM7 tool-search setup |
| `mhL` | Tool-search sub-mode selector |
| `Bp_` | Attachment flattener for compaction messages |
| `fhL` | Attachment type check (isArray) |
| `LhL` | Attachment filter |
| `MhL` | Attachment mapper |
| `Yu6` | Attachment unicode helper |
| `v7A` | Recursive attachment mapper |
| `Gnq` | Surrogate-pair splitter |
| `Kf6` | d7A/nVK-linked tool call orchestrator |
| `d7A` | Tool call entry formatter |
| `nVK` | Full agent execution loop |
| `JG8` | C6/L1-linked config file watcher |
| `L1` | Config file reader |
| `HT` | eG event emitter |
| `G` | Keyboard input handler (vim-mode REPL) |
| `T` | uN6/jM6 key-event helper |
| `z` | IH/bH/gS/hB keydown handler |
| `tc` | kY key helper |
| `lRK` | AY5/qY5 vim find helpers |
| `hRK` | zn8/On8 vim operator helpers |
| `SRK` | zn8/On8 vim replace helpers |
| `bRK` | zn8/On8 vim case helpers |
| `b` | Register / clipboard store |
| `uRK` | _.getRegister paste helper |
| `ZRK` | Math.min/max line-slice vim helper |
| `VRK` | Math.min/max line-slice vim helper (variant) |
| `l0A` | Vim motion operator map |
| `S` | CLI supervisor write helper |
| `w` | File-watcher manager |
| `nZH` | A0K.stat file-read helper |
| `q0K` | Object.keys file diff helper |
| `E` | W/Math clamp helper |
| `j6f` | cAH heartbeat helper |
| `V` | File-watcher start helper |
| `tg` | Array.isArray tag checker |
| `Enq` | Message slice and budget calculator |
| `$H6` | _.push/A.push boundary marker inserter |
| `OH6` | oMH/$y6 context-overflow checker |
| `oMH` | Array.isArray overflow helper |
| `$y6` | H.match token count extractor |
| `BI` | H.startsWith agent-type guard |
| `x` | clearTimeout / O.end stream closer |
| `C` | clearTimeout / O.write stream writer |
| `dM` | iC/OO/T_/S6 display-mode builder |
| `iC` | eG display helper |
| `T_` | eG T_ helper |
| `bT` | zl/PK/A6/$6 token-budget formatter |
| `zl` | Token budget helper |
| `PK` | String formatter |
| `EZ6` | REPL context getter |
| `jV6` | Fz7-linked message text sanitiser |
| `Fz7` | _.replace/_.match/q.trim sanitiser |
| `Fi` | P9H/Pe permission-check helper |
| `P9H` | oeH.has permission set checker |
| `Vnq` | Ra/TH/$P compaction error display |
| `$P` | p_/SE/Kw7 user-message queue |
| `SE` | Message queue drain helper |
| `Kw7` | th9/HU_ history-limit manager |
| `LN6` | Session notifications helper |
| `tCH` | H.setStatus status-bar updater |
| `b7A` | A6-linked notification helper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.