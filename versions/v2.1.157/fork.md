---
type: feature-spec
feature: "fork"
cc_version: "2.1.157"
updated: "2026-06-02"
tags: ["fork", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.157 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/fork`

> Analysis basis: CC v2.1.157 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.157

---

## Overview

`/fork` spawns a new background sub-agent that inherits the full current conversation context. The user provides a directive string that governs the forked agent's task; the parent session continues independently while the child agent runs asynchronously in the background.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `fork` |
| description | `Spawn a background agent that inherits the full conversation` |
| argumentHint | `<directive>` |
| module_id | `_8K` |
| load_inline | `true` |
| loc_byte | `12786651` |
| loc_byte_end | `12786847` |
| loc_line | `9020` |
| arbor_handler.name | `Ej5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.fqn | `claude-2.1.157::Ej5` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.157 bundle.js:+12786651

---

## Input Branching

The command has three distinct paths depending on whether the conversation is mature enough to fork, whether the directive argument is provided, and what the current session state is.

```mermaid
flowchart TD
    A["/fork <directive> invoked"] --> B{First conversation turn?}
    B -->|Yes — no assistant messages| C["Reject: 'Cannot fork before the first conversation turn'\n(bundle.js:+12786388)"]
    B -->|No — conversation exists| D{directive argument present\nafter trim?}
    D -->|Empty / missing| E["Emit usage error:\n'Usage: /fork <directive>'\n(bundle.js:+12786279)"]
    E --> F[Emit telemetry: subagent_fork_prompt_missing\n(bundle.js:+10702656)]
    D -->|Non-empty directive| G[Collect conversation snapshot\nvia conversationSnapshotCollector]
    G --> H[Trim message history to last 50 turns\n(literal 50 at bundle.js:+10702890)]
    H --> I[Slice up to 49 messages\n(literal 49 at bundle.js:+10702903)]
    I --> J[Generate random hex session ID\n(8 bytes, hex encoding at bundle.js:+6752041)]
    J --> K[Timestamp fork via Date.now\n(bundle.js:+10702947)]
    K --> L[Build sub-agent context package\nvia contextBuilder]
    L --> M[Launch background agent worker\nvia backgroundAgentLauncher]
    M --> N[Register worker in local agent registry\n(type: 'local_agent', status: 'running'\n bundle.js:+10250116)]
    N --> O[Emit telemetry: subagent_launch\n(bundle.js:+10702638)]
    O --> P[Return to parent session;\nforked agent runs independently]
```

---

## Behavioral Spec

### Handler Entry Point (`Ej5`)

The main handler is the async function `Ej5`, resolved via module `_8K` through Arbor's `module_id` path.

```
async function forkCommandHandler(input, sessionContext):
    directive = input.trim()                         // A.trim, bundle.js:+12786255

    if no assistant messages exist in conversation:
        emit error "Cannot fork before the first conversation turn"
        return                                       // literal at bundle.js:+12786388

    if directive is empty:
        emit "Usage: /fork <directive>"              // literal at bundle.js:+12786279
        emitTelemetry("subagent_fork_prompt_missing")// bundle.js:+10702656
        return

    conversationSnapshot = collectConversationSnapshot(sessionContext)
    forkPackage = buildForkPackage(directive, conversationSnapshot)
    backgroundAgentLauncher(forkPackage, sessionContext)
    emitTelemetry("subagent_launch")                 // bundle.js:+10702638
```

Analysis basis: CC v2.1.157 bundle.js:+12786255

---

### Conversation Snapshot Collector (`qo_`)

Gathers the full current conversation state and trims it to a manageable window before handing off to the sub-agent.

```
function collectConversationSnapshot(sessionContext):
    appState     = getAppState()                     // nlL → H.getAppState, bundle.js:+10704189
    messages     = Array.from(appState.messages)     // bundle.js:+10704289

    // Trim history to last 50 assistant+user turns
    trimmed = messages.slice(-50)                    // literal 50 at bundle.js:+10702890
    sliced  = trimmed.slice(0, 49)                   // literal 49 at bundle.js:+10702903

    // Resolve last known conversation state via stateResolver
    lastState = resolveLastConversationState(messages) // V_, bundle.js:+10703191

    // Collect REPL contexts
    replContexts = getReplContexts()                 // bundle.js:+10702745

    // Build context message list (role normalisation: assistant / user)
    contextMessages = buildContextMessages(replContexts, sliced)
                                                     // NG8, bundle.js:+10702840

    // Generate random hex fork ID (8 bytes)
    forkId = crypto.randomBytes(8).toString("hex")  // jh, bundle.js:+6752025; literal 8 at bundle.js:+6752041

    timestamp = Date.now()                           // bundle.js:+10702947

    return { forkId, timestamp, messages: contextMessages, lastState }
```

Analysis basis: CC v2.1.157 bundle.js:+10702638

---

### System Prompt Builder (`bT`)

Assembles the full system prompt handed to the forked agent; heavily parameterised by feature flags and session configuration. Calls a large set of sub-builders including:

- **code style prompt** (`tX5`) — injects "Write code that reads like the surrounding code…" (literal at bundle.js:+13077857)
- **task continuity prompt** (`Oa6`) — key `"task_continuity"` (bundle.js:+13098377)
- **environment info block** (`WP5`, `PP5`) — injects git-worktree notice (literal at bundle.js:+13100432), additional working-directory list, and a "You have been invoked in the following environment" header (bundle.js:+13101357)
- **language setting** (`KP5`) — key `"language"` (bundle.js:+13098684)
- **output-style selector** (`TP5`, `ZP5`) — keys `"output_style"` / `"bg-session"` / `"scratchpad"` (bundle.js:+13098719–13098776)
- **context management** (`VP5`) — controlled by `sX5.isBriefEnabled` (bundle.js:+13107214); key `"brief"` (bundle.js:+13098842)
- **background agent absolute-path reminder** — literal `"- Agent threads always have their cwd reset between bash calls…"` (bundle.js:+13104047)
- **memory / CLAUDE.md prompt** (`PY6`) — calls `BK7.buildCombinedMemoryPrompt` (bundle.js:+3298215)

```
function buildSystemPrompt(sessionConfig, featureFlags):
    parts = []
    parts.push(baseAgentIdentity(sessionConfig))     // jP5, bundle.js:+13098928
    parts.push(codeStyleGuidance())                  // tX5, bundle.js:+13098319
    if featureFlags["task_continuity"]:
        parts.push(taskContinuityBlock())            // Oa6, bundle.js:+13098366
    parts.push(environmentInfoBlock(sessionConfig))  // WP5/PP5, bundle.js:+13098631
    parts.push(memoryPrompt(sessionConfig))          // PY6, bundle.js:+13098567
    if isBriefEnabled():
        parts.push(briefContextBlock())              // VP5, bundle.js:+13098854
    parts.push(focusBlock())                         // kP5, bundle.js:+13098885
    parts.push(scratchpadBlock())                    // ZP5, bundle.js:+13098793
    return parts.join("\n\n")
```

Analysis basis: CC v2.1.157 bundle.js:+13098074

---

### Background Agent Launcher (`wH6`)

Creates the isolated background worker session and registers it with the supervisor.

```
async function backgroundAgentLauncher(forkPackage, sessionContext):
    worktreePath = resolveWorktreePath()             // YSH → z9A → At.mkdir, bundle.js:+12963057
    worktreeSymlink = createWorktreeSymlink()        // YSH → At.symlink, bundle.js:+12963085

    // Create AbortController and wire abort signal
    abortController = new AbortController()          // _h → x1, bundle.js:+10250094
    on("abort") → abortController.abort()            // bundle.js:+4711035

    agentRecord = {
        type:   "local_agent",                       // literal at bundle.js:+10250116
        status: "running",                           // literal at bundle.js:+10250161
        role:   "general-purpose"                    // literal at bundle.js:+10250235
    }

    register(agentRecord)                            // K.register, bundle.js:+10250427

    // Launch the REPL worker loop (erH)
    runSubagentLoop(forkPackage, agentRecord, abortController)

    // On completion, update status and emit subagent_complete telemetry
    //   (literal at bundle.js:+6842875)
```

Analysis basis: CC v2.1.157 bundle.js:+10250069

---

### Sub-agent Worker Loop (`erH`)

The core async loop that drives the forked agent. It reads queued messages, calls the model, handles tool dispatch, and signals completion.

```
async function subagentWorkerLoop(forkPackage, agentRecord, abortController):
    initialize message queue and file handles

    loop:
        messages = drainQueue()                      // Q.push, bundle.js:+6842143

        if abortController.signal.aborted:
            emitTelemetry("tengu_async_agent_stall_timeout")
            break

        response = callModel(messages, systemPrompt)

        if stall detected (watchdog timeout):
            emitTelemetry("tengu_async_agent_stall_timeout") // bundle.js:+6842638
            // literal "watchdog_stall" at bundle.js:+6842233

        dispatchTools(response.toolCalls)            // H38, bundle.js:+6844019

        if response.stopReason == "end_turn":
            break

    status = determineExitStatus(response)
    // statuses: "subagent_complete" | "subagent_stall_timeout" | "user_kill_async"
    //   literals at bundle.js:+6842875, +6842895, +6844736

    notifyParent(agentRecord, status)                // D26, bundle.js:+6842921
    cleanup()                                        // CP6, bundle.js:+6845195
```

Key timing constants:
- Worker polling base interval: 10 ms (literal at bundle.js:+6841742)
- Maximum poll wait: 600 000 ms (literal at bundle.js:+6841747)
- Stall timeout: 1 000 ms tick (literal at bundle.js:+6842830)

Analysis basis: CC v2.1.157 bundle.js:+6841681

---

### Conversation State Resolver (`V_`)

Extracts session configuration embedded in the most recent assistant message, used to seed the forked agent's initial state.

```
function resolveLastConversationState(messages):
    appState = getAppState()                         // H.getAppState, bundle.js:+10679373
    lastMsg  = messages.findLast(isAssistantMsg)     // A.findLast, bundle.js:+10679453

    if lastMsg has working_directory:                // literal at bundle.js:+10679478
        state.workingDirectory = lastMsg.working_directory

    if lastMsg has allowed_tools:                    // literal at bundle.js:+10679533
        state.allowedTools = lastMsg.allowed_tools

    if lastMsg has disallowed_tools:                 // literal at bundle.js:+10679588
        state.disallowedTools = lastMsg.disallowed_tools

    if lastMsg has avoid_prompts:                    // literal at bundle.js:+10679649
        state.avoidPrompts = lastMsg.avoid_prompts

    // Additional keys: session, effort, model, flag_settings
    //   literals at bundle.js:+10679948, +10679973, +10679986, +10679998

    return state
```

Analysis basis: CC v2.1.157 bundle.js:+10679373

---

### Fork Context Reference Storage (`lg_` / `VAH`)

After the worker is launched, a stable reference to the fork's context is stored under the key `"fork-context-ref"` (literal at bundle.js:+12893551) so the parent session can later retrieve the child's result.

```
function storeForkContextRef(forkId, agentRecord):
    contextRef = buildContextRef(forkId, agentRecord) // U4, bundle.js:+12893528
    registry.set("fork-context-ref", contextRef)      // bundle.js:+12893551
```

Analysis basis: CC v2.1.157 bundle.js:+12893528

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: subagent_launch | Fired on every successful fork invocation (bundle.js:+10702638) |
| Telemetry: subagent_fork_prompt_missing | Fired when directive argument is empty (bundle.js:+10702656) |
| Telemetry: tengu_async_agent_stall_timeout | Fired if background agent stalls beyond watchdog limit (bundle.js:+6842638) |
| Telemetry: tengu_forked_agent_default_turns_exceeded | Fired when fork exceeds default turn budget (bundle.js:+10678251) |
| Telemetry: subagent_complete | Fired when worker exits cleanly (bundle.js:+6842875) |
| Telemetry: subagent_stall_timeout | Fired on watchdog-triggered termination (bundle.js:+6842895) |
| Telemetry: tengu_agent_tool_completed | Fired per completed tool call inside the fork (bundle.js:+6838737) |
| Telemetry: tengu_agent_tool_terminated | Fired if a tool is forcibly terminated (bundle.js:+6844566) |
| Telemetry: tengu_slim_subagent_claudemd | Fired during sub-agent CLAUDE.md loading (bundle.js:+9341909) |
| appState changes | A new `local_agent` entry is added to the agent registry with status `"running"` (bundle.js:+10250161); status transitions to `"completed"` or error state on exit |
| Worktree filesystem side effects | May create a worktree directory and symlink under a temporary path (bundle.js:+12963057, +12963085); errors `EEXIST`, `ENOSPC`, `EDQUOT` are handled (bundle.js:+12963121, +12963216, +12963230) |
| AbortController registration | An abort signal is registered for the worker; the parent can send `"abort"` to kill the fork (bundle.js:+4711035) |
| Fork context reference | Stored in registry under `"fork-context-ref"` (bundle.js:+12893551) |
| Sound | None observed in depth-2 traversal |
| Hook registration | The forked agent runs its own hook lifecycle (`erH` calls hook execution, bundle.js:+6844019); parent session hooks are not re-run |

---

## Version History

| Version | Change |
|---|---|
| v2.1.157 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/fork` at session start** — The command explicitly rejects invocations before the first assistant message. Establish at least one exchange before forking (literal guard at bundle.js:+12786388).
2. **Omitting the directive argument** — A bare `/fork` with no text emits the usage string and does nothing. The directive is mandatory and must be non-empty after whitespace trimming (bundle.js:+12786279).
3. **Expecting synchronous output** — The forked agent runs in the background; the parent terminal returns immediately. Results surface via the task/agent notification system, not inline.
4. **Using relative paths in fork directives** — Background agents have their working directory reset between bash calls (literal warning at bundle.js:+13104047); always supply absolute paths in directives or rely on the inherited working directory recorded in the fork snapshot.
5. **Forking inside a forked agent without a turn** — The same guard applies recursively; a sub-agent that tries to fork before producing an assistant turn will be rejected.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Ej5` | Main fork command handler (AsyncFunction, entry point) |
| `qo_` | Conversation snapshot collector / fork package builder |
| `nlL` | App-state conversation message assembler |
| `V_` | Last-conversation-state resolver (working dir, tools, model, etc.) |
| `_V8` | Sub-resolver: extracts allowed-tools from last assistant message |
| `AV8` | Sub-resolver: extracts disallowed-tools from last assistant message |
| `bT` | System prompt builder (orchestrates all sub-prompt sections) |
| `x9A` | Base agent identity prompt builder |
| `tX5` | Code-style guidance prompt builder |
| `eX5` | Additional style sub-prompt builder |
| `Oa6` | Task-continuity prompt builder |
| `HP5` | Feature-flag-gated system prompt section |
| `U9A` | Model-specific prompt section builder (`claude-opus-4-7` handling) |
| `IP5` | Wrapper calling `U9A` for inline model prompt |
| `YP5` | SDK / schedule / routines prompt section builder |
| `PY6` | Memory (CLAUDE.md + team memory) prompt builder |
| `WP5` | Static environment info prompt builder |
| `PP5` | Simple environment info prompt builder (worktree, additional dirs) |
| `KP5` | Language-setting prompt section builder |
| `TP5` | Output-style prompt section builder (`bg-session`, `worktree`, `tmp`) |
| `ZP5` | Scratchpad / context-management prompt section builder |
| `VP5` | Brief/context-management prompt section builder (`sX5.isBriefEnabled`) |
| `kP5` | Focus-mode prompt section builder |
| `jP5` | Tone-and-style prompt section builder |
| `AP5` | Additional system context builder |
| `Gk9` | MCP/plugin tool context builder |
| `fP5` | System-block finaliser (`_P5`) |
| `MP5` | Doing-tasks prompt section |
| `$P5` | Wrapper re-using `U9A` for doing-tasks |
| `OP5` | Tool-usage guidance section builder |
| `DP5` | Prompt-injection warning section builder |
| `ygq` | Memory-load sub-builder (calls `CY_`) |
| `UzH` | Auth-type prompt section builder (`firstParty`, `anthropicAws`) |
| `wH6` | Background agent launcher / worker session factory |
| `YSH` | Worktree filesystem setup (mkdir, symlink, unlink) |
| `Vh8` | Active-worker set manager (add/delete on finally) |
| `z9A` | Worktree directory creator (`At.mkdir`) |
| `h$` | Worktree path joiner (`$9A.join`) |
| `Z2` | Worker timestamp/path tracker |
| `_h` | AbortController factory for worker |
| `x1` | AbortController signal `setMaxListeners` wrapper |
| `ZV7` | WeakRef deref helper (abort handler binding) |
| `EV7` | WeakRef deref helper (abort handler binding, secondary) |
| `erH` | Sub-agent worker event loop (core async driver) |
| `zm` | Agent memory loader (system prompt memory injection) |
| `qC` | Conversation context collector |
| `Z_` | Module registry bootstrapper |
| `M` | File-handle cleanup helper (`A0.rm`) |
| `NG8` | Context-message list builder (push/filter by role) |
| `iIL` | Context message filter: assistant role |
| `rIL` | Context message filter: user role |
| `nIL` | Context message filter: tool_use / code blocks |
| `oIL` | Context message filter: tool_result blocks |
| `rV1` | Message trimmer (H.trim) |
| `jh` | Random hex ID generator (`Sy9.randomBytes`) |
| `K` | Worker registration map / column formatter |
| `Ma` | Model name resolver |
| `SZ` | Model config structure builder |
| `se` | Model config sub-builder (qN, JA) |
| `_1` | Model alias normaliser (lowercase, replace) |
| `E0` | Model alias lookup |
| `ci6` | ARN / Bedrock model prefix parser |
| `Lw` | Provider-type detector (bedrock, vertex, gateway, etc.) |
| `bBH` | Full model identifier normaliser |
| `sI9` | Model string includes-check helper |
| `aI9` | Model-tier resolver |
| `ap` | Model family resolver (claude-3, claude-opus-4-x, etc.) |
| `IP` | Model capabilities resolver |
| `xQ` | AsyncLocalStorage context runner |
| `Mw` | AsyncLocalStorage store getter |
| `uQ` | Secondary store getter (`v0`) |
| `D26` | Sub-agent state updater on completion |
| `Cn_` | Sub-agent state completion notifier |
| `xO` | Worker flush helper (Zh8.get/delete) |
| `DLH` | Sub-agent task notification handler (abort-speculation, etc.) |
| `YL` | HTML entity unescaper (replaceAll) |
| `trH` | Message filter for tool results |
| `jK` | Message filter by text content |
| `ikH` | Token-budget tracker (`ZK`) |
| `ZK` | Token-cache lookup (dFq, cFq maps) |
| `w26` | Sub-agent streaming response processor |
| `Qg_` | Deduplication set manager for messages |
| `d0` | Individual turn processor (timestamps, tool dispatch) |
| `E8` | UUID generator wrapper (`Nv.randomUUID`) |
| `R$1` | App-state turn updater |
| `X` | IPC buffer reader (Buffer.concat, indexOf) |
| `Y` | Output writer / spinner manager |
| `u2H` | Message serialiser for subagent output |
| `Re1` | Max-width message formatter |
| `G` | Remote-control event handler |
| `FVK` | Heartbeat handler |
| `L38` | Message boundary finder (findLastIndex, filter) |
| `ljH` | Tool-use classifier entry |
| `gSH` | Tool safety classifier (`ZK`, `AE.includes`) |
| `J26` | App-state update on turn start |
| `wLH` | In-progress task state writer |
| `j26` | Task progress recorder |
| `A38` | Task-state combiner (wLH + nrH) |
| `nrH` | Task-progress detail writer |
| `H38` | Sub-agent completion handler (spans, cache hints) |
| `DE` | Last-assistant-message finder |
| `D4` | Span attribute emitter |
| `E7H` | Span event emitter (lowercase) |
| `Ea7` | Cache eviction hint handler |
| `K38` | Sub-agent final state writer |
| `hH` | Logging helper (wraps `d`) |
| `q38` | Auto-mode classifier dispatcher |
| `Ah9` | Auto-mode precheck (ey9, ty9, _h9) |
| `$26` | Full auto-mode classifier (tool-use decision logic) |
| `njH` | Intermediate state writer |
| `EH` | String coercer |
| `CP6` | Sub-agent cleanup (NM8.delete) |
| `Ch` | Full sub-agent REPL session runner |
| `m7H` | Notification emitter for sub-agent |
| `G6` | App-state event broadcaster |
| `Dk9` | Sub-agent process-map setter |
| `p$8` | OTel tracing context setter |
| `_y9` | Trace span store getter/setter |
| `Hy9` | Trace duration calculator |
| `bo7` | Span ID push helper |
| `P7H` | REPL plugin loader |
| `fH` | Interactive REPL session UI component |
| `WE6` | Sub-agent start event emitter |
| `j7` | Sub-agent channel connector |
| `cX` | Full agent query executor (core LLM loop) |
| `Vq` | UUID generator (Nw1.randomUUID) |
| `Aj` | Permission flag checker |
| `I8` | Permission scope checker |
| `eKH` | TK7 (tool-key map) checker |
| `rI9` | Tool name registry builder |
| `UK` | Process-map ANonymiser |
| `mkL` | Tool name lookup helper |
| `fH6` | Tool context loader |
| `nq` | Argument slicer |
| `_SH` | Available tools sorter |
| `uj` | Tool finder |
| `B6` | Batch task writer |
| `tH` | Plugin sync timer |
| `F6` | Main REPL run loop (recursively calls itself) |
| `I6` | Output batch flusher |
| `N2` | Performance mark recorder |
| `oT` | Math.round wrapper |
| `or1` | Time-to-first-message calculator |
| `_ZK` | parseInt wrapper |
| `g8` | Timeout promise factory |
| `p5A` | Event emitter (ISH, uc.emit) |
| `TZK` | Secondary parseInt wrapper |
| `Qc` | Config-state merger |
| `C6` | Flag-settings resolver (cwd, DH.filter) |
| `Ax8` | String sanitiser (`CH`) |
| `gH` | Plugin list getter |
| `EU5` | Keep-alive enqueueer |
| `xH` | Error message extractor |
| `TEK` | ZU5 telemetry wrapper |
| `L6` | Message output pipe |
| `GEK` | Message batch validator (every/join/flatMap) |
| `e5A` | Remote-baku session runner |
| `HfA` | Tool list flattener |
| `LH` | MCP elicitation handler |
| `s5A` | Channel notification re-registrar |
| `NH` | Tool deduplication / session tool filter |
| `L8` | Printable-character classifier |
| `l9` | Continuation check |
| `Q8` | Model-config finder |
| `$P9` | Token-usage rate-limit checker |
| `lv6` | Query user-input receiver (wr_.clear) |
| `xo6` | AsyncLocalStorage context runner (KOq) |
| `B$8` | Agent context-store setter (fLH) |
| `kG` | Unknown helper reached in run-loop |
| `lZK` | SDK-message submitter (MH.submitMessage) |
| `_b6` | Session attachment helper |
| `TnH` | Tool-state cache getter/setter |
| `WH` | App-state broadcast wrapper |
| `GU5` | Elicitation UI handler |
| `uH` | Message batch writer (kH.writeMessages) |
| `SU5` | Unknown run-loop helper |
| `B` | VH filter (mcp__ prefix check) |
| `fx8` | Metadata-change notifier |
| `uDH` | Message splice helper (F49.randomUUID) |
| `BT` | U4 context wrapper |
| `eG8` | Object.values helper |
| `Cj` | Unknown run-loop helper |
| `a8H` | Interaction duration reporter |
| `n5A` | LU5 store getter |
| `i5A` | Output-path joiner (EA6) |
| `y1` | String coercer |
| `p8H` | Unknown run-loop helper |
| `eV` | mf8 / `d` wrapper |
| `Sv_` | Early-conversation / last-response-error handler |
| `F_` | Error string builder |
| `Yr_` | Turn-mark recorder (q.set/get) |
| `CE8` | ydL telemetry wrapper |
| `zr_` | NdL / Nb turn marker |
| `A6` | Alternate REPL run loop (mirrors F6) |
| `VH` | Plugin/marketplace file reader |
| `hU5` | LK8 / oG8 helper |
| `EGH` | Unknown flush helper |
| `bK` | _9 / zkH / Mv_ / $v_ session state flusher |
| `Gu` | Unknown flush helper |
| `Py` | RZ post-run wrapper |
| `Bo6` | Object.values context cleaner |
| `kyH` | oLH / A.filter turn-end helper |
| `UG6` | TeammateMailbox message marker |
| `kC` | Lt9 / p6 context cleaner |
| `ChH` | TeammateTool file cleaner |
| `ewH` | Vk / F7H teammate termination notifier |
| `m1_` | Object.values teammate cleaner |
| `p1_` | Object.entries promise resolver |
| `Zd_` | Pending-agent flush (yAH.values/clear) |
| `Vn_` | Cleanup map (_.cleanup) |
| `bkL` | MCP/plugin config loader |
| `BK` | `--bare` flag checker |
| `PB` | Enterprise/project/local MCP tier resolver |
| `jL8` | T8H / cHH tool loader |
| `gc` | MCP entry builder (Object.entries, ujH) |
| `s7H` | Tool-search / deferred-tools builder |
| `Ik` | Standard tool-set builder |
| `i7H` | Tool-name lowercase checker (TuL) |
| `jSH` | Tool-list some-checker |
| `pd_` | Deferred-tool-pool updater |
| `i08` | REPL session initialiser (setAppState, jh, EV1.randomUUID) |
| `_DH` | REPL session reset helper |
| `mf9` | Session flags normaliser |
| `WE8` | Initial session flags builder |
| `l08` | Sub-agent tool list builder |
| `Tb` | Bundled tool instance factory |
| `OV6` | Bundled tool builder |
| `Zl` | MCP tool filter (RqA, _.add, H.filter) |
| `b8H` | Tool presence checker (p8K) |
| `Ng` | Tool-name set builder |
| `gw1` | YT8 (tool timestamp map) getter/setter |
| `XV` | Max-tokens / context-window calculator |
| `IV_` | Tool-permission set builder |
| `jkH` | Exponential backoff calculator |
| `cG` | Tool context guard (_1, f9, Km4) |
| `J` | Process map (w) getter |
| `lg_` | Fork context-ref storage (U4) |
| `VAH` | Fork context-ref builder (U4, RSH) |
| `RSH` | Fork context-ref filter (Lh8, Xh8, cJ5) |
| `OH6` | Agent metadata writer (.meta.json / .jsonl) |
| `o8K` | Agent output path resolver |
| `RH` | JSON.stringify wrapper |
| `sH` | Sub-agent session handle (start/close/connect) |
| `r1A` | Remote bridge session (setOnEvent, writeEvent, etc.) |
| `iI6` | Session ID sanitiser (H.replace) |
| `nH` | Session connection handler (setOnData, setOnClose) |
| `Y6` | Session expiry scheduler (M6.abort) |
| `O6` | Session end-of-batch writer |
| `Ny9` | OTel span entry point (MLH, gkH, Kv) |
| `MLH` | OTel span context setter |
| `wh` | OTel fLH.active getter |
| `gkH` | OTel GNH span name builder |
| `Kv` | OTel span attribute accessor |
| `BjH` | OTel context enter-with helper |
| `Om` | Sub-agent orchestrator (JlL + rM8) |
| `JlL` | Main agent LLM query loop |
| `rM8` | Sub-agent exit/cleanup (Tu map, kk_ map) |
| `e7H` | Tool-event list builder |
| `Ej` | Tool-event type extractor |
| `Dr7` | Tool-event finder |
| `UW` | Task update dispatcher (YQL, DQL) |
| `YQL` | Task update pv6 helper |
| `DQL` | Task update with xv6/E8 |
| `n08` | Task queue initialiser (K, q) |
| `MH6` | Sub-agent progress event handler |
| `sE6` | Task description trimmer |
| `h$1` | QSH / lX state getter |
| `h5H` | Sub-agent session launcher (j7, cX) |
| `Gv` | Session context builder (TU, $D, Mp, Eb) |
| `fAK` | Tool-list builder for sub-agent (Object.values, v0H) |
| `MAK` | Tool-map builder (yG, H.map, v0H) |
| `BH` | bU_ builder |
| `bU_` | RH JSON wrapper |
| `xc` | Session config builder (lN9) |
| `eN9` | jB map cleanup (IkH) |
| `IkH` | Session file writer (IM8.mkdir, IM8.writeFile) |
| `dg_` | YT8.delete cleanup |
| `UkH` | u$8 / zI_ map cleanup |
| `ky9` | OTel span attribute setter and ender |
| `FkH` | OTel span status setter |
| `FjH` | OTel context re-enter helper |
| `wk9` | Process-map Wk_.delete cleanup |
| `iI9` | Parallel MCP tool context launcher |
| `pkH` | MCP tool context updater (_.update, xO) |
| `qJ6` | Unknown post-fork helper |
| `jjH` | Unknown post-fork helper |