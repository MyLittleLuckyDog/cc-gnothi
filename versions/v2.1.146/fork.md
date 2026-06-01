---
type: feature-spec
feature: "fork"
cc_version: "2.1.146"
updated: "2026-06-01"
tags: ["fork", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.146 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/fork`

> Analysis basis: CC v2.1.146 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.146

---

## Overview

`/fork` spawns a background agent that inherits the full current conversation history, system prompt, and configuration, then executes a caller-supplied directive in that new agent context. The parent session continues normally while the child agent runs autonomously in the background. The command requires that at least one conversation turn has already occurred before it can be invoked.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `fork` |
| description | Spawn a background agent that inherits the full conversation |
| argumentHint | `<directive>` |
| module_id | `$u1` |
| load_inline | `true` |
| loc_byte | `12470924` |
| loc_byte_end | `12471120` |
| loc_line | `10704` |
| arbor_handler.name | `$n7` |
| arbor_handler.fqn | `claude-2.1.146::$n7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.146 bundle.js:+12470924

---

## Input Branching

The handler exhibits three distinct top-level paths based on directive presence and conversation state, warranting a flowchart.

```mermaid
flowchart TD
    A(["/fork <directive> invoked"]) --> B{Directive present after trim?}
    B -- No / empty --> C[Emit usage error:\n'Usage: /fork <directive>'\nbundle.js:+12470553]
    B -- Yes --> D{At least one conversation\nturn exists?}
    D -- No --> E[Emit error:\n'Cannot fork before the first\nconversation turn'\nbundle.js:+12470662]
    D -- Yes --> F[Build fork context:\ncopy conversation history,\nsystem prompt, config\nbundle.js:+12470621]
    F --> G[Generate random session ID\nvia randomBytes(8).hex\nbundle.js:+6488101]
    G --> H[Record Date.now as fork timestamp\nbundle.js:+10438606]
    H --> I[Slice conversation to last 50/49\nmessages as seed\nbundle.js:+10438549/10438562]
    I --> J[Assemble subagent launch params:\ntype='fork', mode='resume'\nbundle.js:+10438364/10438483]
    J --> K[Register background agent via\nagent-registry\nbundle.js:+10012837]
    K --> L[Spawn background session\n'local_agent','running'\nbundle.js:+10012842/10012887]
    L --> M[Return immediately to\nparent session]
    C --> Z([End])
    E --> Z
    M --> Z
```

---

## Behavioral Spec

### Directive Validation

```
function validateForkDirective(rawInput):
    trimmed = rawInput.trim()          // bundle.js:+12470529
    if trimmed is empty:
        emit "Usage: /fork <directive>"  // bundle.js:+12470553
        return ERROR
    return trimmed
```

Analysis basis: CC v2.1.146 bundle.js:+12470529, +12470553

### Pre-condition Check (Conversation Must Exist)

```
function assertConversationStarted(conversationHistory):
    if conversationHistory has no prior turns:
        emit "Cannot fork before the first conversation turn"  // bundle.js:+12470662
        return ERROR
    return OK
```

Analysis basis: CC v2.1.146 bundle.js:+12470662

### Context Inheritance

```
function buildForkContext(conversationHistory, config):
    // Retrieve current app state including allowed_tools, avoid_prompts,
    // effort, model fields  (bundle.js:+10415487, +10415542, +10415644, +10415657)
    appState = getAppState()

    // Copy last N messages as seed context
    // Maximum seed window: 50 messages total, trimmed to 49 active
    seedMessages = conversationHistory.slice(-50, -49 boundary)  // bundle.js:+10438549/+10438562

    // Normalise message roles; strips 'system' role messages from fork seed
    // (child receives a fresh system message via assembleSystemPrompt)
    filteredMessages = filterMessageRoles(seedMessages)  // bundle.js:+12470593

    // Retrieve REPL contexts for the fork  (bundle.js:+10438404)
    replContexts = getReplContexts()

    return { appState, filteredMessages, replContexts }
```

Analysis basis: CC v2.1.146 bundle.js:+10438404, +10438549, +10438552, +10438579

### Session ID Generation

```
function generateForkSessionId():
    // 8 random bytes encoded as hex = 16-character ID
    rawBytes = randomBytes(8)           // bundle.js:+6488101
    return rawBytes.toString("hex")     // bundle.js:+6488129
```

Analysis basis: CC v2.1.146 bundle.js:+6488101, +6488129

### Subagent Launch

```
async function launchForkAgent(directive, forkContext, sessionId):
    timestamp = Date.now()              // bundle.js:+10438606

    params = {
        type:      "fork",             // bundle.js:+10438364
        mode:      "resume",           // bundle.js:+10438483
        sessionId: sessionId,
        directive: directive,
        context:   forkContext,
        timestamp: timestamp,
    }

    // Emit telemetry: subagent_launch  (bundle.js:+10438297)
    // Emit telemetry: subagent_fork_prompt_missing if directive absent
    //                                 (bundle.js:+10438315)

    agentRecord = registerAgent({
        kind:   "local_agent",         // bundle.js:+10012842
        status: "running",             // bundle.js:+10012887
        role:   "general-purpose",     // bundle.js:+10012961
    })

    // Start async background session (non-blocking)
    backgroundSession = spawnBackgroundSession(params)
    trackActiveAgent(agentRecord, backgroundSession)

    // Parent returns immediately; background agent runs autonomously
    return { agentId: agentRecord.id }
```

Analysis basis: CC v2.1.146 bundle.js:+10438297, +10438315, +10438364, +10438483, +10438606, +10012837, +10012842

### Background Session Lifecycle

```
function manageBackgroundSession(session):
    // File-system artefacts created for the forked session
    makeDirectory(subagentsDir)         // bundle.js:+12642182
    createSymlink(sessionPath)          // bundle.js:+12644500
    openSessionFile()                   // bundle.js:+12644325

    // Track active session in in-memory set
    activeSessionSet.add(session)       // bundle.js:+12642288
    session.finally(() => activeSessionSet.delete(session))  // bundle.js:+12642313

    // On clean completion
    //   emit telemetry: task_local_agent  (bundle.js:+10012627)
    // On failure
    //   emit telemetry: task_local_agent_failed  (bundle.js:+10012646)

    // Watchdog: stall timeout fires if session produces no output
    // Timeout constant: 600,000 ms (10 minutes)  (bundle.js:+6570337)
    //   emit telemetry: tengu_async_agent_stall_timeout on expiry
```

Analysis basis: CC v2.1.146 bundle.js:+12642182, +12642288, +12644325, +12644500, +6570337

### Safety Classifier Handoff

When the background agent completes, a safety classifier reviews its output before results surface to the parent:

```
function safetyClassifierHandoff(agentOutput):
    classifierResult = runHandoffClassifier(agentOutput)
    if classifierResult == UNAVAILABLE:
        // Warn user; do not block  (bundle.js:+6569403)
        emitWarning(
          "Note: The safety classifier was unavailable when reviewing " +
          "this sub-agent's work..."
        )
    else if classifierResult == BLOCKED:
        suppressOutput()                // bundle.js:+6568945
    else:
        surfaceOutput()
```

Analysis basis: CC v2.1.146 bundle.js:+6569403, +6569492, +6568945

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: subagent_launch | Fired when fork handler is entered with a valid directive (bundle.js:+10438297) |
| Telemetry: subagent_fork_prompt_missing | Fired when directive is absent (bundle.js:+10438315) |
| Telemetry: task_local_agent | Fired on successful background-agent completion (bundle.js:+10012627) |
| Telemetry: task_local_agent_failed | Fired on background-agent error (bundle.js:+10012646) |
| Telemetry: tengu_async_agent_stall_timeout | Fired when stall watchdog fires (bundle.js:+6571228) |
| Telemetry: tengu_forked_agent_default_turns_exceeded | Fired when fork exceeds default turn budget (bundle.js:+10414277) |
| Telemetry: tengu_slim_subagent_claudemd | Fired during subagent CLAUDE.md load (bundle.js:+8981358) |
| Telemetry: tengu_auto_mode_decision | Fired by auto-mode classifier on agent handoff (bundle.js:+6568970) |
| Telemetry: tengu_agent_tool_completed | Fired when an agent tool call completes (bundle.js:+6567327) |
| Telemetry: tengu_agent_tool_terminated | Fired when a running agent tool is terminated (bundle.js:+6573156) |
| File-system | Creates directory and symlink under `subagents/` path; opens session JSONL file (bundle.js:+12642182, +12642244, +12644325) |
| appState changes | Registers new entry in active-agent registry with `kind=local_agent`, `status=running` (bundle.js:+10012842, +10012887) |
| activeSessionSet | Agent added on start, removed in `finally` handler (bundle.js:+12642288, +12642313) |
| AbortController | New AbortController is created for the forked session; abort listener bound (bundle.js:+4652239) |
| Stall watchdog | `setTimeout` with 600,000 ms (10 min) to detect non-responsive agents (bundle.js:+6570337) |
| Sound | Not observed in depth-2 traversal |
| Hook registration | `K.register` called during agent session startup (bundle.js:+10013153) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.146 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/fork` before the first turn** — the command emits `"Cannot fork before the first conversation turn"` and exits immediately. Always send at least one message first (bundle.js:+12470662).
2. **Omitting the directive** — calling `/fork` with no argument (or only whitespace) emits the usage hint `"Usage: /fork <directive>"` and does nothing further (bundle.js:+12470553).
3. **Expecting synchronous output** — the fork returns immediately to the parent session; agent results appear asynchronously. Do not treat the absence of immediate output as a failure.
4. **Assuming the full history is always forwarded** — only the most recent ≈50 messages are seeded into the fork context (bundle.js:+10438549); very old conversation turns are not available to the child agent.
5. **Ignoring safety-classifier warnings** — when the classifier is unavailable the child's output is still surfaced, but with a prominent warning. Users should manually verify agent actions in that case (bundle.js:+6569492).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `$n7` | Main async handler for `/fork` (arbor_handler) |
| `lm_` | Fork context assembler — builds seed messages, session ID, launch params |
| `$W7` | App-state retrieval and config snapshot for the fork |
| `b_` | Allowed-tools / config field extractor |
| `Bm_` | Config field normaliser (`W9`) |
| `vG` | System-prompt assembly orchestrator for forked agent |
| `YoH` | Background agent spawner / session lifecycle manager |
| `yIH` | Subagent file-system setup (mkdir, symlink, open) |
| `BG8` | Active-session Set tracker (add / finally-delete) |
| `Vi_` | Subagent directory creator |
| `aM` | Subagent session file path joiner |
| `$rH` | Subagent session file opener |
| `IX` | Subagent session timestamp recorder |
| `kcH` | Background-agent run loop / watchdog |
| `lk` | Agent session main entry point (run loop dispatch) |
| `D6` | Headless query / agent execution engine |
| `VH` | Agent execution engine variant (mirrors `D6`) |
| `gi` | System-prompt composer (model, tools, context sections) |
| `h27` | Core query function (API streaming loop) |
| `Xx` | Session-level query wrapper |
| `Z26` | Forked-session subagent start helper |
| `g2` | Agent tool execution and hook dispatcher |
| `OM6` | Memory prompt builder (CLAUDE.md / team memory) |
| `qo7` | Session-guidance / schedule-section builder |
| `zo7` | Environment-info (env_info_simple) builder |
| `Oo7` | Git-worktree environment-info builder |
| `Do7` | Output-style (`bg-session`) section builder |
| `wo7` | Scratchpad section builder |
| `fo7` | Agent-role / base-persona section builder |
| `Ttq` | Context-management section builder |
| `bk` | Random-bytes generator (hex session ID) |
| `hM1` | Trim helper for conversation seed messages |
| `UY8` | Message-role filter / normaliser |
| `z47` | Assistant-message filter |
| `Y47` | User-message filter |
| `O47` | Tool-result message filter |
| `D47` | Error-message filter |
| `SH` | Error logger / process push helper |
| `N6` | Render / notification helper |
| `m6` | State-update notifier with timestamp |
| `ZD6` | Background-session state update (Date.now path) |
| `kKH` | Agent state update / abort-speculation handler |
| `hKH` | Agent completion state update |
| `DK8` | Agent error state update |
| `ND6` | Agent progress state update |
| `yKH` | Agent context-delta state update |
| `zK8` | Agent state transition dispatcher |
| `TcH` | Task-progress event emitter |
| `$K8` | Subagent completion / handoff classifier entry point |
| `YK8` | Handoff classifier orchestrator |
| `WD6` | Handoff auto-mode classifier |
| `Rjq` | Classifier sub-routine dispatcher |
| `VD6` | Agent-summary / tool-result builder |
| `CZ` | Agent-summary context builder |
| `T8` | UUID generator for messages |
| `boq` | Agent-output state batcher |
| `ci` | Subagent REPL-context loader |
| `K2_` | REPL-context filter |
| `eP` | REPL-context render helper |
| `qH` | MCP elicitation handler |
| `AH` | MCP elicitation active-set tracker |
| `lW6` | MCP elicitation request handler |
| `nW6` | MCP elicitation response handler |
| `_d` | Notification / IL dispatch helper |
| `IL` | In-process notification / channel helper |
| `MY8` | MCP tool-set refresh during agent run |
| `v6H` | MCP tool-filter helper |
| `zHH` | MCP tool-presence checker |
| `DJ_` | Deferred-tools pool manager |
| `fVH` | Retry back-off calculator |
| `oE` | Tool-name validator |
| `yh_` | App-state setter for forked session |
| `O26` | Fork-context reference file writer (`.jsonl` / `.meta.json`) |
| `Hm1` | Fork context path resolver |
| `c6H` | Fork-context reference loader |
| `hh_` | Fork-context snapshot helper |
| `y4` | Transcript snapshot reader |
| `c4H` | Subagent session builder (assembles `g2` params) |
| `Wx` | System-prompt main-thread loader |
| `EK` | Environment-key extractor |
| `UY` | System-prompt cache helper |
| `ri_` | Agent-identity (mH) builder |
| `dr7` | Model-override section builder |
| `cr7` | Model-preference section builder |
| `ti_` | Context-management mode section builder |
| `To7` | Context-management section wrapper |
| `t26` | Output-style section builder |
| `lr7` | Output-style section wrapper |
| `sr7` | System-prompt section assembler |
| `tr7` | Tool-section builder |
| `er7` | Context-section builder |
| `Ho7` | Permission-section builder |
| `Ko7` | Persona-section wrapper |
| `Ly9` | V4 prompt helper |
| `s3H` | API-provider section builder |
| `Po7` | Brief-mode section builder |
| `Go7` | Focus-mode section builder |
| `Roq` | Metric / qkH state reader |
| `c4H` | Agent session parameter assembler |
| `aS` | Agent session state accessor |
| `Dp1` | Agent tool-type lister |
| `wp1` | Agent tool mapper |
| `bO6` | Fork background-session options builder |
| `vYH` | Fork session configuration finaliser |
| `pX_` | System-prompt plugin-section builder |
| `Fwq` | Shell-task context builder |
| `VVH` | Shell-task state updater |
| `GIH` | Skill-listing helper |
| `vN` | Skill finder |
| `gwq` | Capability-set builder |
| `dH` | Transcript batch writer |
| `QH` | Message writer |
| `nH` | Remote-bridge / REPL connection manager |
| `RX` | Performance mark helper |
| `jR` | Math.round duration helper |
| `Dy1` | First-message-read timer |
| `r8` | Timeout / retry helper |
| `I6` | Environment / cwd resolver |
| `JH` | Keypress interceptor during agent run |
| `tO5` | Keep-alive enqueuer |
| `jH` | Agent run variant (mirrors `D6` entry) |
| `sLK` | Agent stop-output handler |
| `kH` | Active-hook tracker |
| `aLK` | Agent final-message assembler |
| `le_` | Remote-baku helper |
| `de_` | Agent result-set decoder |
| `vH` | Agent tool-execution visualiser |
| `RI6` | Agent result inspector |
| `TQH` | Read-file-state cache manager |
| `Dv8` | Metadata-change notifier |
| `rOH` | Message-splice / UUID helper |
| `MV` | y4 snapshot wrapper |
| `YD8` | Object.values wrapper |
| `xHH` | Interaction-duration tracker |
| `fK` | String coercer |
| `bZ` | Rate-limit helper |
| `$P_` | Prompt-suggestion helper |
| `n_` | Error string coercer |
| `Am_` | Performance-mark collector |
| `$J8` | cP7 helper |
| `_m_` | gP7 / Wu helper |
| `Lz5` | z68 / fD8 session-finaliser |
| `RK` | Post-run cleanup |
| `hb` | Flush helper |
| `aI` | VT async helper |
| `qd6` | Object.values async helper |
| `ovH` | O4H filter helper |
| `RJ6` | TeammateMailbox markMessagesAsRead |
| `BS` | TCq / g6 batch-send helper |
| `tNH` | TeammateTool remove helper |
| `OYH` | Teammate termination notifier |
| `KR_` | MCP tool-refresh awaiter |
| `kx_` | MCP tool cleanup |
| `a17` | MCP tool loader |
| `Cb` | MCP enterprise/project/local config loader |
| `d4H` | Deferred-tools pool builder |
| `hS` | Standard-tool filter |
| `WVH` | Tool-name lowercase matcher |
| `RIH` | Tool-category checker |
| `GR_` | Deferred-tools delta manager |
| `Sw8` | Subagent exit state cleaner |
| `mH` | String() primitive coercer |
| `bH` | c() primitive coercer |
| `uH` | c() primitive coercer (alt path) |
| `SH` | Process-push / logError helper |
| `CH` | JSON.stringify wrapper |
| `ZH` | String() wrapper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.