---
type: feature-spec
feature: "fork"
cc_version: "2.1.199"
updated: "2026-07-03"
tags: ["fork", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.199 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/fork`

> Analysis basis: CC v2.1.199 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.199

---

## Overview

The `/fork` command spawns a background subagent that inherits the full current conversation context and begins executing a user-supplied directive independently. It clones the existing conversation transcript into a new agent session, applies the given directive as the forked agent's initial goal, and runs that agent in a detached background mode — leaving the parent session free to continue interactively. This is the user-facing entry point to Claude Code's subagent forking subsystem.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `fork` |
| description | Spawn a background agent that inherits the full conversation |
| argumentHint | `<directive>` |
| loc_byte | `13206645` |
| loc_byte_end | `13206848` |
| loc_line | `9839` |
| module_id | `xlc` |
| load_inline | `true` |
| arbor_handler.name | `klm` |
| arbor_handler.fqn | `claude-2.1.199::klm` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.199 bundle.js:+13206645

---

## Input Branching

The handler has 4+ distinct code paths depending on session mode, missing directive, coordinator context, and conversation state. A Mermaid flowchart is required.

```mermaid
flowchart TD
    A["/fork <directive> invoked"] --> B{Trim directive\nfrom input}
    B --> C{Directive\nempty?}
    C -- Yes --> D[Emit usage error:\n'Usage: /fork <directive>'\nReturn early]
    C -- No --> E{Session type\nis coordinator?}
    E -- Yes --> F[Emit error:\n'Forking is not available in\ncoordinator sessions. Use /branch instead.'\nReturn early]
    E -- No --> G{Conversation\nhas at least one turn?}
    G -- No --> H[Emit error:\n'Cannot fork before the\nfirst conversation turn'\nReturn early]
    G -- Yes --> I[Build context snapshot:\nslice transcript, resolve REPL contexts,\nassemble system prompt identifier 'system']
    I --> J[Compute fork ID\nvia random bytes generator\nwith entropy parameters 50/49]
    J --> K[Tag message type as 'fork',\nresume mode = 'resume',\npass directive to new agent context]
    K --> L[Launch subagent via\nsubagent-spawn pipeline\n(subagent_launch + subagent_fork_coordinator_mode telemetry)]
    L --> M[Register background session\nwith daemon / agent registry]
    M --> N[Return to parent session;\nforked agent runs detached]
```

Analysis basis: CC v2.1.199 bundle.js:+13206204, +13206228, +13206268, +13206342, +13206415, +11778025

---

## Behavioral Spec

### 1. Directive Validation

```
async function forkCommandHandler(input, context):
    directive = input.trim()                         // klm → n.trim
    if directive is empty:
        emit error: "Usage: /fork <directive>"       // literal at +13206228
        return

    sessionType = context.getSystemPrompt()           // _j → e.getSystemPrompt
    if sessionType indicates coordinator mode:
        emit error: "Forking is not available in coordinator sessions. Use /branch instead."
                                                      // literal at +13206342
        return
```

Analysis basis: CC v2.1.199 bundle.js:+13206204, +13206228, +13206342

---

### 2. Conversation Pre-condition Check

```
    appState = context.getAppState()                  // Y6f → e.getAppState
    messages = Array.from(appState.transcript)        // Y6f → Array.from
    lastAssistantMessage = messages.findLast(
        m => m.role == "assistant"
    )                                                 // Or → n.findLast

    if lastAssistantMessage is undefined:
        emit error: "Cannot fork before the first conversation turn"
                                                      // literal at +13206415
        return
```

Analysis basis: CC v2.1.199 bundle.js:+11779847, +11779947, +11434641, +13206415

---

### 3. Context Snapshot Assembly

```
    replContexts = context.getReplContexts()          // _4o → t.getReplContexts
    workingDir    = appState["working_directory"]     // literal at +11434666
    allowedTools  = appState["allowed_tools"]         // literal at +11434721
    permissionMode = appState["permission_mode"]      // literal at +11434939
    sessionSettings = {
        effort: ..., model: ..., max_thinking_tokens: ...,
        flag_settings: ...
    }                                                 // literals at +11435294..+11435345

    transcriptSlice = transcriptContextBuilder(       // zrr
        messages,
        replContexts,
        { assistantFilter, toolUseFilter, toolResultFilter }
    )                                                 // literals "assistant","tool_use","tool_result"
```

Analysis basis: CC v2.1.199 bundle.js:+11778256, +11434666, +11434721, +11434939, +11435294

---

### 4. Fork Identity and Unique ID Generation

```
    forkId = uniqueIdGenerator(                       // VP → Tcn.randomBytes
        length=8,                                     // literal at +28164
        entropy=63,                                   // literal at +28138
        encoding="hex"                                // literal at +28176
    )
    // transcript slice is trimmed to last 50 entries (literal at +11778432),
    // or at most 49 tokens (literal at +11778445), to fit agent context.
    trimmedSlice = transcriptSlice.slice(-50)
```

Analysis basis: CC v2.1.199 bundle.js:+11778351, +11778383, +11778432, +11778445, +28138, +28164

---

### 5. Subagent Spawn

```
    agentConfig = buildSubagentConfig({
        type: "fork",                                 // literal at +11778216
        resumeMode: "resume",                         // literal at +11778335
        directive: directive,
        systemPromptTag: "system",                    // literal at +13206268
        conversationContext: trimmedSlice,
        workingDir, allowedTools, permissionMode,
        sessionSettings
    })

    emit telemetry: "subagent_launch"                 // literal at +11778025
    emit telemetry: "subagent_fork_coordinator_mode"  // literal at +11778043

    if directive was not provided and reached here:
        emit telemetry: "subagent_fork_prompt_missing"// literal at +11778167

    forkHandle = await spawnSubagent(agentConfig)     // _4o → vHt (xpe → Fmr, RYo, Wp)
    registerBackgroundSession(forkHandle)             // _4o → e5 → ... (daemon registration)
```

Analysis basis: CC v2.1.199 bundle.js:+11778025, +11778043, +11778167, +11778216, +11778335, +13206268

---

### 6. Forked Agent Execution Context

The forked agent runs as a `"local_agent"` (literal at +8015470) with mode `"background"` (literal at +9772413). It starts in `"running"` state (literal at +8015515) and is registered under type `"general-purpose"` (literal at +8015633). The fork context reference is stored on disk under the key `"fork-context-ref"` (literal at +13843636). Agent metadata is written as `.meta.json` (literal at +13824149) alongside a `.jsonl` transcript file (literal at +13824305).

The watchdog stall detection applies: if the forked agent emits no stream events, `"subagent_stall_timeout"` telemetry is recorded (literal at +9773917) and the agent is terminated. Maximum timeout before stall action: 600,000 ms (10 minutes) (literal at +9772564). A secondary 1,000 ms grace tick applies before the stall is finalised (literal at +9773849).

Analysis basis: CC v2.1.199 bundle.js:+8015470, +8015515, +8015633, +9772413, +9772564, +9773849, +9773917, +13843636, +13824149, +13824305

---

### 7. Background Session Lifecycle

```
    // After launch, the daemon registers the fork in its session table.
    // The forked agent's completion triggers:
    onAgentComplete(forkHandle):
        recordCompletionStatus(forkHandle)            // cfe → yOe → Ebe.setState
        emit "subagent_complete"                      // literal at +9773897
        notifyParentSession(result)                   // bqe, z8n

    // If the agent is killed:
    onAgentKill(forkHandle):
        emit "subagent_end"                           // literal at +9768690
        cleanupResources(forkHandle)                  // uH → Fmr, ECe.delete
```

Analysis basis: CC v2.1.199 bundle.js:+9773897, +9768690, +7726074, +13934524

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_async_agent_stall_timeout` (+9773657), `tengu_agent_tool_completed` (+9768095), `tengu_agent_tool_terminated` (+9777525), `tengu_auto_mode_decision` (+9770588), `tengu_forked_agent_default_turns_exceeded` (+11433194), `tengu_agent_summary_skipped` (+9652858), `tengu_bg_dispatch_sigkill_escalate` (+18528964), `tengu_bg_spare_claim` (+18530488), `tengu_daemon_yield` (+18551243), `tengu_shale_finch` (+9763548) |
| Subagent registration | Fork is registered in the daemon's background-session map; agent handle is stored under a unique fork ID |
| Filesystem | `.meta.json` agent metadata and `.jsonl` transcript written to a subagent-specific directory; `"fork-context-ref"` symlink or reference created (+13843636) |
| appState changes | Parent appState is read (not mutated) to build the context snapshot; forked agent receives its own isolated appState copy |
| Watchdog timer | `setTimeout` / `clearTimeout` pair set at 600,000 ms stall threshold (+9772564); secondary 1,000 ms grace period (+9773849) |
| Sound | No audio side-effect observed in traversal |
| Background daemon | Fork triggers background-mode process via daemon spawn pathway (`xpe` → `Fmr`, `RYo`, `Wp`, `cw.symlink`, `cw.unlink`) |
| Error literals emitted | `"Usage: /fork <directive>"`, `"Forking is not available in coordinator sessions. Use /branch instead."`, `"Cannot fork before the first conversation turn"` |

---

## Version History

| Version | Change |
|---|---|
| v2.1.199 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/fork` without a directive** — the command requires a non-empty `<directive>` argument. Calling `/fork` with no text results in the usage error `"Usage: /fork <directive>"` and no agent is spawned.
2. **Using `/fork` in a coordinator session** — coordinator-mode sessions block forking entirely. The error message directs users to `/branch` instead.
3. **Forking before any conversation turn exists** — the command checks that at least one assistant message is present in the transcript before proceeding. Using `/fork` immediately after session start (before the model has replied) will fail.
4. **Expecting the parent session to pause** — `/fork` is non-blocking: the parent session remains fully interactive while the forked agent runs in the background. Users should not assume the parent waits for the fork to complete.
5. **Mistaking stall timeout for completion** — if the forked agent produces no stream events for 10 minutes, the watchdog kills it and emits `"subagent_stall_timeout"`. This is not normal completion.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `klm` | Main handler for `/fork` command (AsyncFunction, arbor-resolved) |
| `_4o` | Subagent spawn orchestrator; builds fork config and launches agent |
| `Y6f` | Context snapshot builder; reads appState, assembles transcript slice |
| `Or` | Transcript message finder; uses `findLast` to locate last assistant message |
| `Msr` | Subagent config field mapper (`working_directory`) |
| `Dsr` | Subagent config field mapper (`disallowed_tools`) |
| `wR` | REPL context resolver |
| `uM` | System prompt assembler; compiles all prompt sections |
| `_j` | Agent memory and system prompt loader |
| `iie` | Model resolver; maps model names to API identifiers |
| `d7e` | Agent execution loop / run-loop controller |
| `e5` | Full agent lifecycle manager (transcript, tools, hooks, MCP, monitoring) |
| `vHt` | Subagent process spawner (filesystem symlinks, PID registration) |
| `xpe` | Filesystem setup for new agent directory (mkdir, symlink, unlink) |
| `Fmr` | Active-session tracker (add/delete on Set) |
| `qSl` | Per-turn query executor |
| `zrr` | Transcript context builder (filters assistant/tool_use/tool_result messages) |
| `VP` | Unique ID generator using `crypto.randomBytes` |
| `I5l` | Directive trimmer |
| `Ts` | CLI error reporter / process.exit handler |
| `gJe` | Error event emitter for CLI errors |
| `xI` | Secondary CLI error handler |
| `cOo` | Subagent completion handler (records result, emits telemetry) |
| `cfe` | Agent state transition manager (thinking/responding/unknown) |
| `yOe` | UI state setter for agent spinner/mode |
| `bqe` | Task notification dispatcher |
| `z8n` | Task status updater |
| `uH` | Session flush and cleanup (ECe map) |
| `$T` | Background session state tracker (pending/running) |
| `UT` | Process environment builder for spawned agent |
| `Lr` | Content renderer / JSX output helper |
| `ot` | System prompt feature-flag resolver |
| `JBt` | Memory/CLAUDE.md loader and injector |
| `oSm` | Session-specific guidance section builder |
| `GEm` | Core behavioral instructions assembler |
| `WEm` | Reversible-action confirmation instruction builder |
| `jEm` | Autonomy-append instruction builder |
| `EEc` | Countdown/spinner UI component |
| `ptr` | Tool permission resolver (allowed/disallowed/bundled tools) |
| `Bxf` | MCP and plugin configuration loader |
| `R3f` | Main query-loop engine (API call, streaming, tool execution) |
| `GU` | Turn/session orchestrator entry point |
| `Ht` | Background session connection manager (JZo, Bt) |
| `JZo` | CCR v2 bridge / worker event stream handler |
| `u7e` | Tool approval and permission-check pipeline |
| `WTe` | Subagent task dispatcher (Bd, ew, C1) |
| `ew` | Agent-level tool execution and hook runner |
| `Sqe` | Tool result classifier / search-read detection |
| `nNo` | Process lifecycle handler (exit, fork-context-ref) |
| `Lpe` | Fork context reference loader |
| `Dme` | Agent metadata writer (.meta.json, .jsonl) |
| `rNo` | Streaming response accumulator |
| `WR` | API streaming response parser |
| `At` | FCT redaction handler for transcript entries |
| `vr` | Message-type byte classifier |
| `qoe` | Config dump/load utility |
| `utr` | App-state update handler (setAppState, applyFileHistoryOp) |
| `jMa` | OpenTelemetry span manager for subagent.spawn |
| `ZDe` | OTel async-context enter-with |
| `X2` | OTel active-span accessor |
| `C8e` | OTel span attribute builder |
| `Er` | Plugin / MCP server tool index builder |
| `oCe` | Plugin cache refresh orchestrator |
| `Bd` | Agent prompt assembler (Sv, TO, $v sections) |
| `li` | Message UUID and timestamp stamper |
| `ve` | MCP elicitation handler |
| `Re` | Plugin loader and sorter |
| `fn` | Plugin command dispatcher (getPromptForCommand) |
| `_8t` | MCPB/DXT archive extractor |
| `Zn` | Transcript write-back utility (Bt.writeMessages) |
| `Ut` | Workflow agent executor |
| `Kt` | Key event / keypress handler |
| `pe` | Plugin timer and command dispatcher |
| `Nt` | Plugin manifest reader (HXl.readFile) |
| `BSl` | Non-shell monitor connection manager |
| `LTe` | Monitor lifecycle (connect/close/GPo tracking) |
| `Wka` | Shell monitor (local_bash/MCP/WS) lifecycle manager |
| `xAe` | Shell task update handler (BT, uH) |
| `HSt` | Skill/tool progress tracker (NYt cache) |
| `hSt` | Transcript-to-tool-input mapper (Rl, Tme) |
| `OE` | Compact-boundary message assembler |
| `ibm` | Inline-block message builder (Krn, lCt, Pn) |
| `rNo` | Stream accumulator / response-length tracker |
| `EAe` | Tool-search eligibility checker (t1, cQ, HUe, q3o) |
| `q3o` | Deferred-tools pool manager |
| `HUe` | Tool-search wl gate |
| `cQ` | Vertex AI tool-search beta-header guard |
| `t1` | Standard tool builder |
| `Rz` | Agent metadata lookup (_mr, yym) |
| `RA` | Bundled tool set builder (fmr, ISl, Tj) |
| `vt` | Tool version tracker (yvo) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.