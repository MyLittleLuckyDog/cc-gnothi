---
type: feature-spec
feature: "fork"
cc_version: "2.1.132"
updated: "2026-05-18"
tags: ["fork", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.132 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/fork`

> Analysis basis: CC v2.1.132 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.132

---

## Overview

The `/fork` command spawns a background (subagent) instance of Claude Code that inherits the full current conversation history. The caller supplies a directive string that guides the forked agent's independent task; without it the command prints a usage error. The parent session continues normally while the forked agent runs asynchronously in a separate repl context.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `fork` |
| description | Spawn a background agent that inherits the full conversation |
| argumentHint | `<directive>` |
| module\_id | `_jq` |

Analysis basis: CC v2.1.132 bundle.js:+11696757

---

## Input Branching

```mermaid
flowchart TD
    A([User types /fork]) --> B{Directive argument present\nafter _.trim?}
    B -- "empty / whitespace-only" --> C[Emit usage message\n'Usage: /fork <directive>'\n+ return early]
    B -- "non-empty string" --> D{At least one prior\nconversation turn exists?}
    D -- "no turns yet" --> E[Emit error:\n'Cannot fork before the\nfirst conversation turn'\n+ return early]
    D -- "turns exist" --> F[Slice conversation history\n up to last 50 turns\n keeping last 49]
    F --> G[Generate random session ID\nvia randomBytes(8).toString('hex')]
    G --> H[Snapshot app state\nvia getAppState]
    H --> I[Resolve repl contexts\nvia getReplContexts]
    I --> J[Build agent config:\ntype=local_agent, kind=fork,\nmode=subagent, action=spawn]
    J --> K[Run agent-launch pipeline\nvia agentRunnerFactory]
    K --> L[Register subagent lifecycle\nwith agent registry]
    L --> M[Forked agent running\nin background repl context]
```

Analysis basis: CC v2.1.132 bundle.js:+11696361, +11696385, +11696494, +11694333, +11694343

---

## Behavioral Spec

### 1. Argument Validation

```
function validateForkInput(rawInput):
    trimmed = rawInput.trim()                    // _.trim call
    if trimmed == "":
        display("Usage: /fork <directive>")
        return ABORT
    return trimmed
```

Analysis basis: CC v2.1.132 bundle.js:+11696361, +11696385

---

### 2. Pre-condition Check — Conversation History

```
function assertConversationExists(messages):
    if messages is empty or no prior turn:
        display("Cannot fork before the first conversation turn")
        emit telemetry: tengu_feature_bad
        return ABORT
    return OK
```

Analysis basis: CC v2.1.132 bundle.js:+11696494, +906517

---

### 3. History Slicing for Forked Context

```
function buildForkHistory(allMessages):
    // Limit to a window of the most recent turns
    // Window floor: index = max(0, length - 50)
    // Window keeps at most 49 messages from that floor
    windowStart = max(0, allMessages.length - 50)
    slice = allMessages.slice(windowStart, windowStart + 49)
    return slice
```

The slice constants 50 and 49 bound the conversation snapshot transmitted to the forked agent.

Analysis basis: CC v2.1.132 bundle.js:+11694330, +11694343

---

### 4. Session Identity Generation

```
function generateForkSessionId():
    rawBytes  = crypto.randomBytes(8)            // ju -> xs1.randomBytes, length=8
    hexString = rawBytes.toString("hex")         // produces 16-char hex token
    timestamp = Date.now()
    sessionId = hexString + "-" + timestamp
    return sessionId
```

Random byte length: 8 bytes → 16 hex characters.
Analysis basis: CC v2.1.132 bundle.js:+5252064, +5252080, +5252092, +11694387

---

### 5. App-State Snapshot

```
function snapshotParentState(appStateAccessor):
    snapshot = appStateAccessor.getAppState()
    replContexts = appStateAccessor.getReplContexts()
    toolPermCtx  = appStateAccessor.getToolPermissionContext()
    return { snapshot, replContexts, toolPermCtx }
```

The snapshot captures live session data (read-file state, repl hydration, todos, MCP monitors, shell tasks, live messages, initial messages, prompt-cache tracking, session hooks, and the repl context) before the fork branches off.

Analysis basis: CC v2.1.132 bundle.js:+11695627, +11694185, +11694632, +9051098–9051607

---

### 6. Agent Configuration Assembly

```
function buildAgentConfig(directive, sessionId, parentSnapshot):
    config = {
        type:         "local_agent",
        status:       "running",
        agentKind:    "fork",
        mode:         "subagent",
        launchAction: "spawn",
        agentCategory: "general-purpose",
        sessionId:    sessionId,
        directive:    directive,
        conversationSlice: buildForkHistory(parentSnapshot.messages),
        toolPermissionContext: parentSnapshot.toolPermCtx,
        replContexts: parentSnapshot.replContexts,
        // Hook events expected during lifecycle:
        //   SubagentStart, SubagentStop
        hooks: { hookEvent: ["SubagentStart", "SubagentStop"] }
    }
    return config
```

Analysis basis: CC v2.1.132 bundle.js:+9534121, +9534166, +9534240, +11694145, +11694264, +11694812, +11694877, +9046333, +9049641

---

### 7. Process-Isolation Context Setup

```
function setupIsolatedReplContext(agentConfig, asyncStoreFactory):
    // Each forked agent gets its own async-local storage context
    store = asyncStoreFactory.getStore()
    isolatedContext = asyncStoreFactory.run(store, agentConfig)
    return isolatedContext
```

Analysis basis: CC v2.1.132 bundle.js:+3059286, +3059325

---

### 8. Agent Lifecycle — Runner Pipeline

```
function runForkedAgent(agentConfig, agentRegistry):
    // Register agent so the parent can track it
    agentRegistry.register(agentConfig)

    // Launch async loop
    agentLoop = agentRunnerFactory(agentConfig)   // PQH

    // Watchdog: stall timeout = 600 000 ms (10 minutes)
    watchdogId = setTimeout(onStallTimeout, 600_000)

    loop:
        event = await agentLoop.next()
        clearTimeout(watchdogId)
        watchdogId = setTimeout(onStallTimeout, 600_000)

        match event.type:
            "query_progress"   -> relayProgressToParent(event)
            "stream_event"     -> handleStreamEvent(event)
            "message_start"    -> markTurnStart(event)
            "message_delta"    -> appendDelta(event)
            "end"              -> finalizeMessage(event)
            "tool_use"         -> dispatchTool(event)
            "tool_result"      -> recordToolResult(event)
            "api_error"        -> handleApiError(event)
            "max_turns_reached"-> terminateWithReason("max_turns_reached")
            "completed"        -> terminateWithReason("completed")
            "cancelled"        -> terminateWithReason("cancelled")
            "killed"           -> terminateWithReason("killed")
            "failed"           -> terminateWithReason("failed")

    emit telemetry: tengu_feature_ok
    return

    onStallTimeout():
        emit telemetry: tengu_async_agent_stall_timeout
        agentLoop.abort()
        terminateWithReason("watchdog_stall")
```

Stall timeout: 600 000 ms (10 minutes).
Analysis basis: CC v2.1.132 bundle.js:+7953958, +7954434, +7954700, +7955235, +9049798, +9049969, +9050061, +9050258, +7956108, +7956709, +7956983, +7955029, +906461

---

### 9. Agent Title Display Truncation

```
function formatAgentTitle(directive):
    // Truncate directive for UI display to 40 characters
    if directive.toLowerCase().length > 40:
        return directive.toLowerCase().slice(0, 40) + "…"
    return directive.toLowerCase()
```

Maximum display length: 40 characters.
Analysis basis: CC v2.1.132 bundle.js:+14153948, +14154022

---

### 10. Session Close / Cleanup

```
function closeForkedAgent(agentHandle):
    agentHandle.close()                 // f.close  (primary close path)
    agentHandle.queryClose()            // q.close  (query-layer teardown)
    agentHandle.clearAllTimers()        // J6.clearAllTimers
    agentHandle.setReplContext(null)    // _.setReplContext — release repl slot
```

Analysis basis: CC v2.1.132 bundle.js:+14139791, +14139801, +9051502, +9051522

---

### 11. Hook Context — SubagentStart

```
function emitSubagentStartHook(agentConfig):
    hookPayload = {
        hookEvent:  "SubagentStart",
        session:    agentConfig.sessionId,
        hooks:      agentConfig.hooks,
        // Additional context injected via hook_additional_context
    }
    hookRunner.emit("SubagentStart", hookPayload)
```

Analysis basis: CC v2.1.132 bundle.js:+9046333, +9046287, +9046426

---

### 12. Stall-Timeout Telemetry and Tool Termination

```
function onAgentStallTimeout(agentHandle):
    emit telemetry: tengu_async_agent_stall_timeout
    agentHandle.abort()
    // Any running tool is force-terminated
    emit telemetry: tengu_agent_tool_terminated  // if tool was active
    terminateWithReason("watchdog_stall")
```

Analysis basis: CC v2.1.132 bundle.js:+7954700, +7954434, +7956733

---

### 13. Random ID for Sub-messages

```
function generateSubMessageId():
    // Used for individual messages within the fork session
    return crypto.randomUUID()           // HEA.randomUUID / SG.randomUUID
```

Analysis basis: CC v2.1.132 bundle.js:+9046359, +9683349

---

### 14. Prompt-Cache and CLAUDE.md Telemetry

```
function trackSlimClaudeMd(agentConfig):
    // Reports whether the forked agent received a slim vs full CLAUDE.md context
    emit telemetry: tengu_slim_subagent_claudemd
```

Analysis basis: CC v2.1.132 bundle.js:+9044661

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — success | `tengu_feature_ok` (bundle.js:+906461) |
| Telemetry — bad input | `tengu_feature_bad` (bundle.js:+906517) |
| Telemetry — stall timeout | `tengu_async_agent_stall_timeout` (bundle.js:+7954700) |
| Telemetry — tool force-killed | `tengu_agent_tool_terminated` (bundle.js:+7956733) |
| Telemetry — CLAUDE.md size | `tengu_slim_subagent_claudemd` (bundle.js:+9044661) |
| Hook registration | `SubagentStart` hook fired on launch; `SubagentStop` hook fired on any termination path (bundle.js:+9046333, +9049641) |
| Agent registry | New entry registered via `L.register` with `type=local_agent`, `status=running` (bundle.js:+9534432, +9534166) |
| appState changes | Forked agent's repl context added to parent's `getReplContexts` list; cleared on close via `_.setReplContext(null)` (bundle.js:+9051473, +9051522) |
| Async-local storage | Isolated store created per forked agent via `ew1.run` / `ew1.getStore` (bundle.js:+3059325, +3059286) |
| Watchdog timer | `setTimeout` set to 600 000 ms; reset on each agent event; cleared by `clearTimeout` on normal completion (bundle.js:+7953958, +7954500) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Conversation snapshot | Sliced copy of parent messages (up to 49 items from a 50-turn window) embedded in forked agent's initial context; original parent history is not mutated (bundle.js:+11694330, +11694343) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.132 | Initial analysis — `/fork` command identified; full call-graph, literals, and telemetry documented |

---

## Common Mistakes

1. **Omitting the directive.** Running `/fork` with no argument (or only whitespace) causes an immediate usage error: `Usage: /fork <directive>`. The directive is mandatory.

2. **Forking at the very start of a session.** If no conversation turn has taken place yet, the command aborts with "Cannot fork before the first conversation turn". At least one exchange must have occurred.

3. **Expecting synchronous results.** The forked agent runs entirely in the background. The parent REPL is not blocked and the fork's output does not appear inline in the parent conversation.

4. **Assuming full history is forwarded.** The fork only inherits a window of at most 49 messages from the last 50-turn slice of the parent conversation. Very long conversations are truncated at the oldest end.

5. **Long directives displayed truncated.** Directive text is lowercased and truncated to 40 characters for UI title display. The full directive is still sent to the agent, but the visual label in the session list will be cut off beyond 40 characters.

6. **Assuming the forked agent runs forever.** A watchdog timer fires after 600 000 ms (10 minutes) of inactivity (no agent events). At that point the agent is forcibly aborted and `tengu_async_agent_stall_timeout` is emitted.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `S27` | Top-level `/fork` command handler function |
| `Hjq` | Fork orchestrator — builds agent config and launches the forked agent |
| `y27` | App-state snapshot collector (reads `getAppState`, converts messages via `Array.from`) |
| `mH` | Feature telemetry emitter (wraps `tengu_feature_ok` / `tengu_feature_bad`) |
| `X78` | Conversation message builder for the forked context (pushes assistant/user entries) |
| `h27` | Directive trimming helper (calls `H.trim` to normalise the directive string) |
| `ju` | Session-ID byte generator (wraps `xs1.randomBytes`) |
| `FQH` | Agent registry entry constructor (sets `type=local_agent`, `status=running`, calls `L.register`) |
| `DOH` | Agent process-config builder (sets `default`/`inherit`/`bedrock` fields) |
| `CU` | Async-local-storage runner (wraps `ew1.run`) |
| `SP` | Async-local-storage store accessor (wraps `ew1.getStore`) |
| `DU` | Notification/pipe dispatcher (wraps `NP`) |
| `PQH` | Async agent-runner loop (handles all agent lifecycle events, watchdog, telemetry) |
| `qC` | Full subagent launch pipeline (resolves contexts, builds prompt, fires hooks, runs agent) |
| `$8` | Sub-message UUID generator (wraps `SG.randomUUID`) |
| `r46` | Repl-context registration helper |
| `VBH` | Progress relay — forwards forked agent progress events to the parent session |
| `SH` | State-update dispatcher (wraps `d` for appState mutations) |
| `H` | Stall-detection helper (uses `Math.random` and `setTimeout` for jitter) |
| `_` | Lowercase-normaliser utility called on directive before display truncation |
| `f` | Agent handle — provides `close()` for primary agent teardown |
| `A` | Parent app-state accessor object (provides `getReplContexts`, `getToolPermissionContext`) |