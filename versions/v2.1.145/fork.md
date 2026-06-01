---
type: feature-spec
feature: "fork"
cc_version: "2.1.145"
updated: "2026-06-01"
tags: ["fork", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.145 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/fork`

> Analysis basis: CC v2.1.145 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.145

---

## Overview

`/fork` spawns a background agent that inherits the full current conversation history. The user supplies a directive string that becomes the new agent's initial task; the parent session continues unblocked. The forked agent runs asynchronously and reports results back through the normal subagent-notification channel.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `fork` |
| description | Spawn a background agent that inherits the full conversation |
| argumentHint | `<directive>` |
| module_id | `uhq` |
| load_inline | `true` |
| loc_byte | `12085294` |
| loc_byte_end | `12085490` |
| loc_line | `7973` |
| arbor_handler.name | `MB7` |
| arbor_handler.fqn | `claude-2.1.145::MB7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.145 bundle.js:+12085294

---

## Input Branching

Three distinct branches exist based on directive presence and conversation state:

```mermaid
flowchart TD
    A["/fork <directive> invoked"] --> B{directive present\nafter trim?}
    B -- "No / empty" --> C[Emit usage error\n'Usage: /fork <directive>'\nreturn early]
    B -- "Yes" --> D{At least one\nconversation turn\nexists?}
    D -- "No" --> E[Emit error:\n'Cannot fork before the\nfirst conversation turn'\nreturn early]
    D -- "Yes" --> F[Trim conversation history\nto last 50 messages\n(indices 49..end slice)]
    F --> G[Generate random hex session ID\nvia 8-byte randomBytes]
    G --> H[Record fork start timestamp\nvia Date.now]
    H --> I[Build subagent context:\ninherit conversation + system prompt\ncollect REPL contexts]
    I --> J[Launch background agent\nvia subagentLaunch helper]
    J --> K[Register agent in\nrunning-agents registry]
    K --> L[Return — parent session\ncontinues immediately]
```

Analysis basis: CC v2.1.145 bundle.js:+12084899, +12084923, +12085032, +10094255, +10094530

---

## Behavioral Spec

### 1. Command Entry and Argument Validation

```
async function forkCommandHandler(directiveRaw):
    directive = directiveRaw.trim()
    if directive is empty:
        emit usage message: "Usage: /fork <directive>"
        return

    conversationHistory = getConversationHistory()
    if conversationHistory has no turns:
        emit error: "Cannot fork before the first conversation turn"
        return

    proceed to fork setup
```

Analysis basis: CC v2.1.145 bundle.js:+12084899 (`A.trim`), +12084923 (usage string), +12085032 (pre-turn guard)

---

### 2. Conversation History Slicing

The handler passes the existing conversation to the child but trims it to avoid token overflow. The slice uses a fixed boundary of 50/49:

```
function sliceHistoryForFork(messages):
    // keep at most the last 50 messages (slice from index 49 when > 50)
    if messages.length > 50:
        return messages.slice(messages.length - 49)
    return messages
```

Analysis basis: CC v2.1.145 bundle.js:+10094527 (literal `50`), +10094530 (`H.slice`), +10094540 (literal `49`)

---

### 3. Session Identity Generation

A unique identifier for the forked session is produced using cryptographic random bytes:

```
function generateForkSessionId():
    rawBytes = crypto.randomBytes(8)        // 8 bytes
    return rawBytes.toString("hex")         // 16 hex chars
```

Analysis basis: CC v2.1.145 bundle.js:+6474482 (`PY1.randomBytes`), +6474498 (literal `8`), +6474510 (literal `"hex"`)

---

### 4. System Prompt and Context Inheritance

The forked agent receives a full copy of the parent system prompt plus any active REPL contexts:

```
function buildForkContext(conversationSlice, directive):
    systemPrompt  = getSystemPrompt()                // from appState
    replContexts  = getReplContexts()                // live REPL state
    contextBundle = assembleSubagentContext(
        messages      = conversationSlice,
        system        = systemPrompt,
        repl          = replContexts,
        role          = "system",                    // literal "system"
        agentKind     = "fork"                       // literal "fork"
    )
    return contextBundle
```

Analysis basis: CC v2.1.145 bundle.js:+10094272 (`CH`), +10094382 (`_.getReplContexts`), +12084963 (literal `"system"`), +10094342 (literal `"fork"`)

---

### 5. Agent Launch and Registry

```
async function launchForkAgent(contextBundle, directive):
    agentId    = generateForkSessionId()
    startedAt  = Date.now()

    // initialise background-agent infrastructure
    subagentSession = await subagentLaunchHelper(
        context    = contextBundle,
        directive  = directive,
        sessionId  = agentId,
        kind       = "local_agent",           // literal
        status     = "running",               // literal
        agentType  = "general-purpose"        // literal
    )

    // register in the running-agents map so the parent can poll/cancel
    runningAgentsRegistry.register(agentId, subagentSession)

    // subagent now executing asynchronously
    return agentId
```

Analysis basis: CC v2.1.145 bundle.js:+10094597 (`$rH`), +9669442 (literal `"local_agent"`), +9669487 (literal `"running"`), +9669561 (literal `"general-purpose"`), +9669753 (`K.register`)

---

### 6. Stall Watchdog

The background-agent infrastructure arms a watchdog timer. If the agent emits no output within the allowed window it is reported as stalled:

```
function watchdogLoop(agentHandle):
    STALL_LIMIT_MS = 600_000   // 10 minutes
    POLL_INTERVAL  = 10        // iterations

    while agent is running:
        sleep(POLL_INTERVAL)
        if timeSinceLastOutput() > STALL_LIMIT_MS:
            recordEvent("watchdog_stall")
            notify parent: event "subagent_stall_timeout"
            break
```

Analysis basis: CC v2.1.145 bundle.js:+6556307 (literal `10`), +6556312 (literal `600000`), +6556798 (literal `"watchdog_stall"`), +6557460 (literal `"subagent_stall_timeout"`)

---

### 7. Completion and Result Notification

When the forked agent finishes, the registry entry is updated and a completion notification is delivered to the parent:

```
function onForkAgentComplete(agentId, result):
    updateAgentStatus(agentId, status = "completed")
    notify parent: event "subagent_complete"
    if result has summary:
        attachSummary(agentId, result.summary)

function onForkAgentError(agentId, error):
    updateAgentStatus(agentId, status = "subagent_async_errored")
    notify parent with error details
```

Analysis basis: CC v2.1.145 bundle.js:+6557440 (literal `"subagent_complete"`), +6557572 (literal `"subagent_async_errored"`), +9667011 (literal `"completed"`)

---

### 8. Telemetry Events Emitted During Fork

```
// At fork initiation
emit("subagent_launch")                    // +10094275

// If directive was missing
emit("subagent_fork_prompt_missing")       // +10094293

// During agent lifecycle
emit("task_local_agent")                   // +9669227
emit("task_local_agent_failed")            // +9669246  (on failure)
emit("subagent_complete")                  // +6557440  (on success)
emit("subagent_stall_timeout")             // +6557460  (watchdog)
emit("subagent_async_errored")             // +6559572  (runtime error)
emit("subagent_completed")                 // +6553583  (final teardown)
emit("subagent_end")                       // +6553880
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_async_agent_stall_timeout` (bundle.js:+6557203); `tengu_forked_agent_default_turns_exceeded` (+10070233); `tengu_agent_tool_completed` (+6553302); `tengu_agent_tool_terminated` (+6559131); `tengu_slim_subagent_claudemd` (+8667898) |
| Subagent registry | New entry added via `K.register` (+9669753); removed on completion via `LRq.delete` (+12254667) |
| Filesystem | Session directory created via `qo.mkdir` (+12256854); symlink created/removed via `qo.symlink`/`qo.unlink` (+12256854, +12256913); transcript JSONL written via `gL.writeFile` (+12173099) |
| appState changes | `getAppState` read at fork time (+10095827, +10066464); `setAppState` written during agent lifecycle (+10067320) |
| AbortController | New `AbortController` created per fork; signal wired to `jk` helper (+10094557, +4640930) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Context window | Conversation sliced to ≤50 messages before being passed to the child (+10094527) |
| Worktree / bg-session hint | Agent may be told `"Edit files directly in your working directory"` when no worktree isolation is configured (literal `"bg"` at +12396343; literal `"bg-session"` at +12390185) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.145 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/fork` before any conversation turn.** The handler guards against this with an explicit error: `"Cannot fork before the first conversation turn"` (bundle.js:+12085032). Type at least one message first.
2. **Omitting the directive.** `/fork` with no argument (or only whitespace) triggers a usage error and does nothing. A non-empty directive is mandatory.
3. **Expecting synchronous output.** The forked agent runs entirely in the background. Results arrive through the notification system, not as an immediate reply in the current conversation.
4. **Assuming full history is forwarded.** Only the last ~50 messages are passed to the child agent (+10094527). Very long conversations are silently trimmed; the child will not have early context.
5. **Cancelling the parent session to stop the fork.** The child holds its own `AbortController` and runs independently. Closing the parent does not automatically kill the forked agent; use the task-management interface instead.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `MB7` | Main async handler for `/fork` command (Arbor-resolved) |
| `Nx_` | Fork subagent launch orchestrator |
| `BD7` | App-state snapshot collector for forked agent context |
| `k_` | Allowed-tools / config reader called during fork setup |
| `Tx_` | Option extractor (`allowed_tools`, `avoid_prompts`, `effort`, `model`) |
| `YG` | System-prompt builder (aggregates all prompt sections) |
| `$f6` | Memory/CLAUDE.md prompt assembler |
| `sg7` | Tool-section composer for system prompt |
| `ob` | System-prompt getter with main-thread guard |
| `CH` | Context bundle constructor |
| `$z8` | Message-history transformer for subagent handoff |
| `em` | Cryptographic random-bytes utility (session ID generation) |
| `$rH` | Background-agent runner / registry integration |
| `BIH` | Session-directory and symlink manager |
| `A08` | Running-set tracker (add/finally/delete) |
| `nc_` | Mkdir helper for agent session directory |
| `m$` | Path-join helper for session files |
| `NH` | Error logger / notification pusher |
| `hO8` | File-open helper for session socket |
| `WT` | Subagent path resolver |
| `jk` | AbortController factory for forked agents |
| `pq` | Signal max-listeners setter |
| `bW` | Timestamp-stamped metadata writer |
| `kdH` | Background-agent main event loop / watchdog |
| `w06` | File-read handler in agent loop |
| `YMq` | File-unlink handler in agent loop |
| `TY6` | Agent-status update on turn completion |
| `PC_` | Turn-progress recorder |
| `hz` | Flush helper for agent output buffers |
| `lqH` | Agent speculation abort / result merge |
| `EY6` | Agent query dispatcher |
| `IZ` | Streaming-event processor for forked agent |
| `cc1` | Agent-state updater on query response |
| `fYH` | Tool-classification wrapper |
| `zNH` | Tool-category classifier |
| `n18` | Auto-mode classifier entry point |
| `PY6` | Auto-mode classifier core logic |
| `d18` | Subagent-completion handler |
| `EM` | Error-message formatter |
| `zqH` | Plugin-name SHA-256 hasher |
| `mb` | Subagent REPL session runner (main loop for background agents) |
| `HYH` | Subagent system-prompt assembler |
| `IN_` | Subagent initialiser (sets appState, creates AbortController) |
| `vN_` | MCP tool-set resolver for subagent |
| `fD7` | Core agent query loop (calls model, handles streaming) |
| `ib` | Agent turn executor |
| `Gi` | Permission-check and tool-dispatch layer |
| `JP_` | Tool-call filter (checks permission sets) |
| `eKH` | Subagent session configurator |
| `C2` | Full agent session orchestrator (hooks, tools, streaming) |
| `J6` | Agent run-loop (message lifecycle, flush, teardown) |
| `se4` | MCP server setup for subagent |
| `NN_` | Fork-context reference resolver |
| `f6H` | Fork history loader (reads `.jsonl` transcript) |
| `BP6` | Transcript writer (writes `.jsonl` + `.meta.json`) |
| `SSq` | Session-path constructor for transcript files |
| `Z6` | Notification dispatcher |
| `h6` | Notification rate-limiter / dedup |
| `vL` | Generic value validator / coercer |
| `Zw_` | Token-budget tracker for forked agents |
| `NZH` | Exponential-backoff retry timer |
| `sz1` | REPL-context synchroniser |
| `dZH` | REPL-context updater with debounce |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.