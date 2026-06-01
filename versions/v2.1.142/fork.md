---
type: feature-spec
feature: "fork"
cc_version: "2.1.142"
updated: "2026-06-01"
tags: ["fork", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.142 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/fork`

> Analysis basis: CC v2.1.142 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.142

---

## Overview

`/fork` spawns a background sub-agent that inherits the full conversation history of the current session. The caller provides a free-text directive; the command validates that at least one conversation turn exists, snapshots the current message history, generates a unique session identity, and then launches the background agent process asynchronously. The parent session continues normally while the forked agent works independently.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `fork` |
| description | `Spawn a background agent that inherits the full conversation` |
| argumentHint | `<directive>` |
| loc_byte | `11987596` |
| loc_byte_end | `11987792` |
| loc_line | `7973` |
| module_id | `HNq` |
| load_inline | `true` |
| arbor_handler.name | `pb7` |
| arbor_handler.fqn | `claude-2.1.142::pb7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.142 bundle.js:+11987596

---

## Input Branching

The command has 3+ distinct branches (directive absent/empty, fork too early — no turns yet, and the normal spawn path), so a flowchart is used.

```mermaid
flowchart TD
    A([User types /fork &lt;directive&gt;]) --> B{Directive present\nand non-empty\nafter trim?}
    B -- No --> C[Emit usage error:\n'Usage: /fork &lt;directive&gt;'\nReturn early]
    B -- Yes --> D{At least one\nconversation turn\nexists?}
    D -- No --> E[Emit error:\n'Cannot fork before the first\nconversation turn'\nReturn early]
    D -- Yes --> F[Snapshot current\nmessage history\n(slice last 50/49 turns)]
    F --> G[Generate unique\nsession ID via\nrandom bytes (8 bytes, hex)]
    G --> H[Record fork timestamp\nvia Date.now]
    H --> I[Assemble sub-agent\nlaunch context:\ntype=fork, launch mode=subagent/spawn]
    I --> J[Build system prompt\nfor background agent\n(includes environment info,\ntool permission context, etc.)]
    J --> K[Register sub-agent\nwith local-agent runtime\n(type=local_agent, status=running,\nkind=general-purpose)]
    K --> L[Spawn background\nagent process asynchronously\nvia EnH / cIH / D28 pipeline]
    L --> M[Parent session\ncontinues normally]
    L --> N[Background agent\nexecutes directive\nindependently]
```

Analysis basis: CC v2.1.142 bundle.js:+11987201 (handler entry `pb7`), +11987225 (usage string), +11987334 (no-turn guard), +10015770 (subagent launch path), +10016004 (session ID generation)

---

## Behavioral Spec

### 1. Argument Validation

```
function validateForkDirective(rawInput):
    directive = rawInput.trim()                 // bundle.js:+11987201
    if directive is empty:
        display "Usage: /fork <directive>"      // bundle.js:+11987225
        return ERROR
    return directive
```

Analysis basis: CC v2.1.142 bundle.js:+11987201, +11987225

---

### 2. Pre-fork Guard — Conversation Turn Check

```
function requireAtLeastOneTurn(appState):
    turns = appState.conversationHistory
    if turns is empty or turns.length == 0:
        display "Cannot fork before the first conversation turn"
                                                // bundle.js:+11987334
        return ERROR
    return turns
```

The guard prevents forking a session that has never had an exchange — there is nothing meaningful to inherit yet.

Analysis basis: CC v2.1.142 bundle.js:+11987334

---

### 3. Conversation Snapshot

```
function snapshotHistory(fullHistory, directive):
    // The handler passes type "fork" and "resume" markers
    // Slices the last 50 (or 49) messages from the live history
    // bundle.js:+10016022, +10016025, +10016035
    slicedMessages = fullHistory.slice(-50)
    // Filters out ephemeral / non-serialisable entries
    serializableMessages = filterConversationMessages(slicedMessages)
    return { messages: serializableMessages, directive: directive }
```

Key message-type constants found in the snapshot filter: `"assistant"`, `"user"`, `"tool_use"`, `"tool_result"`, `"error"`, `"ok"`, `"code"`.

Analysis basis: CC v2.1.142 bundle.js:+10016022, +10016025, +10015837 (`"fork"` label), +10015956 (`"resume"` label)

---

### 4. Session Identity Generation

```
function generateForkSessionId():
    // Uses Node.js crypto.randomBytes(8).toString("hex")
    // bundle.js:+5407965, +5407981 (length=8), +5407993 (encoding="hex")
    rawBytes = cryptoRandomBytes(8)
    sessionId = rawBytes.toString("hex")
    timestamp = Date.now()                      // bundle.js:+10016079
    return { sessionId, timestamp }
```

Analysis basis: CC v2.1.142 bundle.js:+5407965, +5407981, +5407993, +10016079

---

### 5. Sub-Agent Launch Pipeline

The background agent is launched via a multi-step pipeline (`iR_` → `EnH` → `cIH` → `D28`):

```
async function launchForkAgent(snapshotContext, sessionId, directive):

    // Step 1: Build tool permission context
    toolPermCtx = getToolPermissionContext()     // bundle.js:+10016324

    // Step 2: Assemble sub-agent configuration
    agentConfig = {
        type:      "subagent",                  // bundle.js:+10016521
        launchMode:"spawn",                     // bundle.js:+10016586
        sessionId: sessionId,
        messages:  snapshotContext.messages,
        directive: directive,
        systemPrompt: buildSystemPrompt(appState, toolPermCtx)
    }

    // Step 3: Register with the local-agent tracker
    //   status="running", kind="general-purpose"
    //   bundle.js:+9750155, +9750229
    registerLocalAgent(agentConfig)

    // Step 4: Ensure working directory exists for sub-agent artifacts
    //   (mkdir, symlink, open via cIH/LQ_/k$)
    //   bundle.js:+12158503, +12158515, +12158531
    prepareAgentWorkdir(sessionId)

    // Step 5: Spawn process asynchronously; track with D28 set
    //   D28 adds the promise to Ikq, removes on finally
    //   bundle.js:+12156319, +12156330, +12156344
    asyncHandle = spawnAgentProcess(agentConfig)
    trackAsyncAgent(asyncHandle)

    return asyncHandle
```

Analysis basis: CC v2.1.142 bundle.js:+10015750 (`iR_` → `J$7`), +10016092 (`iR_` → `EnH`), +9750063 (`EnH` → `cIH`), +12158478 (`cIH` → `D28`), +9750110 (`"local_agent"`)

---

### 6. System Prompt Assembly for the Forked Agent

The forked agent receives a synthesised system prompt built by the `buildSystemPrompt` function (`HG`) which composes many named sub-sections:

| Sub-section key | Purpose |
|---|---|
| `ant_model_override` | Optional model override (bundle.js:+12288218) |
| `env_info_static` | Static environment description (bundle.js:+12288283) |
| `env_info_simple` | Simplified env block (bundle.js:+12288318) |
| `language` | Output language hint (bundle.js:+12288354) |
| `output_style` | Response style directive (bundle.js:+12288389) |
| `bg-session` | Background session marker — `"bg"` (bundle.js:+12288419, +12294577) |
| `scratchpad` | Scratchpad section (bundle.js:+12288446) |
| `frc` | Feature-flag content block (bundle.js:+12288473) |
| `context_management` | Compaction/context guidance (bundle.js:+12288494) |
| `brief` | Brief-mode section (bundle.js:+12288533) |
| `reproduce_verify_workflow` | Reproduce-and-verify instruction block (bundle.js:+12288587) |
| `worktree` | Git-worktree isolation notice (bundle.js:+12294685) |

A notable constant injected when the fork runs in a git worktree context:

> "This is a git worktree — an isolated copy of the repository. Run all commands from this directory. Do NOT `cd` to the original repository root." (bundle.js:+12290093)

Additionally, background-agent bash paths are reminded with a note about absolute paths (bundle.js:+12293653):

> "- Agent threads always have their cwd reset between bash calls, as a result please only use absolute file paths."

Analysis basis: CC v2.1.142 bundle.js:+12287596 (system-prompt builder `HG`), +12288002–12288802 (sub-section calls)

---

### 7. Stall / Timeout Watchdog

The sub-agent runner (`slH`) includes a watchdog that fires after a configurable period:

```
function watchdogLoop(agentHandle):
    STALL_CHECK_INTERVAL_MS = 10           // bundle.js:+8123555
    MAX_IDLE_MS              = 600000      // bundle.js:+8123560 (10 minutes)

    if agent stalls beyond MAX_IDLE_MS:
        emit telemetry "tengu_async_agent_stall_timeout"
        abort agent                         // bundle.js:+8124451, +8124565
```

Analysis basis: CC v2.1.142 bundle.js:+8123555, +8123560, +8124451

---

### 8. Safety Classifier Handoff

After the background agent completes, a safety classifier reviews its output before the result is surfaced. If the classifier is unavailable, a warning is injected into the result:

```
function handoffClassifierCheck(agentOutput):
    if classifierAvailable():
        return runClassifier(agentOutput)
    else:
        // bundle.js:+8122626, +8122715
        emit warning:
            "Handoff classifier unavailable, allowing sub-agent output with warning"
        attach note:
            "Note: The safety classifier was unavailable when reviewing this
             sub-agent's work. Please carefully verify the sub-agent's actions
             and output before acting on them."
        return agentOutput WITH_WARNING
```

Analysis basis: CC v2.1.142 bundle.js:+8122140, +8122168, +8122626, +8122715

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_async_agent_stall_timeout` | Fired when a background fork agent stalls beyond the 10-minute idle limit (bundle.js:+8124451) |
| Telemetry — `tengu_auto_mode_decision` | Fired during auto-mode classifier evaluation of sub-agent output (bundle.js:+8122193) |
| Telemetry — `tengu_agent_tool_completed` | Fired when a tool call inside the fork completes (bundle.js:+8120550) |
| Telemetry — `tengu_agent_tool_terminated` | Fired on forced agent termination (bundle.js:+8126460) |
| Telemetry — `tengu_forked_agent_default_turns_exceeded` | Fired when a forked agent exhausts its turn budget (bundle.js:+5414344) |
| Telemetry — `tengu_slim_subagent_claudemd` | Fired during sub-agent system-prompt assembly (bundle.js:+9206143) |
| Telemetry — `tengu_agent_summary_skipped` | Fired when agent summary generation is skipped (bundle.js:+6578814) |
| Telemetry — `tengu_cache_eviction_hint` | Fired when prompt cache eviction is hinted during fork (bundle.js:+8121093) |
| appState changes | A new entry is registered in the local-agent registry with `status="running"` and `kind="general-purpose"` (bundle.js:+9750155, +9750229); on completion the entry transitions to `"completed"` (bundle.js:+9747679) |
| File-system side effects | A working directory is created for the sub-agent (`vr.mkdir` at bundle.js:+12156213); a symlink is established (`vr.symlink`, bundle.js:+12158531); on clean exit the directory entry is unlinked (`vr.unlink`, bundle.js:+12158590); the agent's JSONL transcript is written to `<session>.jsonl` (bundle.js:+12075142, +12075196) |
| Async tracking set | The in-flight promise is tracked in an internal set (`Ikq.add`/`Ikq.delete`, bundle.js:+12156319, +12156344); a parallel tracking set `w98` is cleaned up on exit (bundle.js:+5544393) |
| Hook registration | The sub-agent session registers hooks via `K.register` (bundle.js:+9750421); SubagentStart / SubagentStop hook events are fired (bundle.js:+12187548, +12225956) |
| Sound | Not observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.142 | Initial analysis |

---

## Common Mistakes

1. **Forking before the first turn**: Running `/fork <directive>` immediately after starting a session (with no prior exchange) is rejected with `"Cannot fork before the first conversation turn"`. Send at least one message first.
2. **Omitting the directive**: `/fork` with no argument is rejected with the usage hint `"Usage: /fork <directive>"`. The directive is mandatory.
3. **Expecting synchronous results**: The fork is asynchronous. The parent session does not block; the forked agent runs in the background and its output appears separately once the agent completes.
4. **Relative paths in the forked agent**: Because the forked agent's working directory is reset between bash calls, any file operations inside the agent must use absolute paths. The system prompt explicitly warns about this.
5. **Misinterpreting classifier warnings**: If the safety classifier is unavailable at handoff time, the fork result is still surfaced but carries an explicit warning banner. Do not treat the warning as an error — review the output manually.
6. **Assuming git worktree commands work from the original root**: When the fork runs in a git-worktree context, `cd`-ing to the original repository root is explicitly prohibited by the injected system-prompt fragment.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `pb7` | Main async handler for `/fork` (Arbor-resolved entry point) |
| `iR_` | Sub-agent launch orchestrator; builds snapshot, session ID, and fires the agent |
| `J$7` | App-state reader called at fork time to obtain current conversation |
| `HG` | System-prompt builder (assembles all sub-sections for the background agent) |
| `EnH` | Local-agent bootstrap; sets up process identity, abort controller, and agent context |
| `cIH` | Agent working-directory and file-descriptor setup (mkdir, symlink, open) |
| `D28` | Async-promise tracker (add/delete around the agent's lifecycle) |
| `LQ_` | Working-directory creation helper (`vr.mkdir` + `HiH`) |
| `k$` | Path-joining helper for agent artifacts |
| `Q58` | Full working-directory setup sequence (combines `D28`, `LQ_`, `k$`, `vr.open`) |
| `LT` | Sub-agent path resolver (joins `subagents` subdirectory) |
| `Nb` | Core session-runner (drives the agentic query loop for the forked agent) |
| `slH` | Background-agent event loop / watchdog scheduler |
| `Cm` | Random-bytes session-ID generator (`crypto.randomBytes`) |
| `H` | Jitter/delay helper (`Math.random` + `setTimeout`) used during agent startup |
| `bKH` | Agent invocation wrapper (assembles final call to `tX`) |
| `tX` | Low-level query executor (calls the model, streams response, handles hooks) |
| `s87` | Full agent turn-loop implementation |
| `lC` | Agent turn context and lifecycle manager |
| `Cz6` | Streaming-output processor for background agent |
| `jZ` | Stream-event dispatcher for agent messages |
| `Y8` | UUID generator (`crypto.randomUUID`) |
| `Ik_` | Fork-context reference resolver (`"fork-context-ref"`) |
| `we` | Fork-context loader (wraps `qL` + `TvH`) |
| `TvH` | Transcript hydration filter |
| `tJ6` | Agent metadata and transcript persistence (`gL.writeFile` `.jsonl` / `.meta.json`) |
| `QP6` | Sub-agent session configuration builder |
| `z4` | Model-selection and effort-level configurator |
| `Vk_` | MCP-tool permission evaluation for sub-agents |
| `az_` | Tool-permission set reducer |
| `Ti` | Tool permission context builder for the forked agent |
| `GP` | System-prompt permission router (`cli` / `remote` modes) |
| `PE_` | Permission-entry filter |
| `wO` | Permission string parser |
| `A_7` | System-prompt fetcher for sub-agent |
| `Hj6` | System-prompt source resolver (→ `Rm7`) |
| `kQ_` | Sub-agent system-prompt assembly (calls `bH`) |
| `Lz8` | Plugin-type system-prompt fragment builder |
| `Dm7` | Model-ID normaliser (includes `"claude-opus-4-7"` constant) |
| `RQ_` | Compaction-mode selector (`"off"/"additive"/"compact"`) |
| `hO6` | Output-style block builder |
| `Nm7` | Tool-usage section builder (schedule/routines guidance) |
| `c76` | Memory-prompt builder (auto/team memory, `VSL.buildCombinedMemoryPrompt`) |
| `bm7` | Environment-info section builder |
| `Cm7` | Simplified environment-info section builder |
| `Tm7` | Reproduce-and-verify workflow block builder |
| `Em7` | Doing-tasks block builder |
| `Zm7` | Context-management wrapper (delegates to `RQ_`) |
| `Vm7` | Tool-section block builder |
| `km7` | Session-guidance block builder |
| `nZ9` | System-prompt section list finaliser |
| `SMH` | Credential/provider-type discriminator (`firstParty`/`anthropicAws`) |
| `hm7` | Telemetry-sparrow block builder (`tengu_sparrow_ledger`) |
| `rq1` | Skill / REPL-context attachment loader |
| `Pm7` | Model-override section builder |
| `Wm7` | Language-hint section builder |
| `um7` | Scratchpad section builder |
| `mm7` | Fast-mode info section builder (`U6H`/`JJH`) |
| `pm7` | Feature-research-content section builder |
| `Bm7` | Brief-mode enablement check |
| `Qm7` | Brief/focus output-style selector |
| `xf` | API provider type resolver |
| `VA` | Base provider discriminator |
| `EU6` | Provider lowercase-normaliser |
| `Iw` | Full provider-path resolver |
| `IYH` | Model alias resolver (default/inherit/sonnet/opus/haiku/best/opusplan) |
| `m2` | Model object builder (`Ga`/`lV`/`nV`) |
| `n1` | Model name normaliser / API-provider-aware name mapper |
| `I1` | Model capability checker |
| `mc` | Claude-3 / Opus-4 model family detector |
| `Nh1` | Model name inclusion checker |
| `vh1` | Model selection with provider routing |
| `DP` | Model-display-properties builder |
| `M` | MCP-tool state reader and client manager |
| `IvH` | MCP server configuration parser |
| `Peq` | MCP client update handler |
| `n_5` | MCP client session builder |
| `b38` | Conversation history serialiser for sub-agent context |
| `Gt4` | Assistant-message serialiser |
| `Tt4` | Tool-use block serialiser |
| `Wt4` | Tool-result block serialiser (filters by `"code"` type) |
| `Et4` | Error-result block serialiser |
| `t9q` | Trim helper for conversation entries |
| `XJ6` | Sub-agent state updater (calls `NS_`/`Mz`) |
| `NS_` | Agent state timestamp recorder |
| `Mz` | Flush/delete agent in-flight record (`D28`/`z28`) |
| `AKH` | Completed-state recorder (status=`"completed"`, `k$`/`Q5`/`Y5`) |
| `Q5` | HTML-entity replacer for output (`&amp;`/`&lt;`/`&gt;`) |
| `Y5` | Task-notification enqueuer |
| `KKH` | Killed-state recorder (status=`"killed"`) |
| `GJ6` | Cancelled-state recorder |
| `qKH` | State-query helper (→ `WJ6`) |
| `Df8` | Deferred-dispatch helper combining `qKH` and `Of8` |
| `Of8` | Progress tracker (records `"task_progress"`, `Date.now`) |
| `zf8` | Sub-agent result classifier (safe/blocked/unavailable) |
| `NT` | Last-assistant-message finder (`H.findLast`) |
| `wf8` | Auto-mode classifier invocation pipeline |
| `wJ6` | Auto-mode classifier HTTP call orchestrator |
| `Jf8` | Running-state recorder (status=`"running"`, `NS_`/`Mz`/`SH`) |
| `bYH` | Post-tool-use state updater (→ `vvH`) |
| `vvH` | Tool-use category classifier |
| `rN` | AbortController lifecycle manager |
| `Eq` | EventEmitter max-listener setter |
| `LW` | Working-file timestamp updater |
| `alH` | Pending-result filter (→ `$K`) |
| `$K` | Text-type result filter |
| `oVH` | Pending-result consolidator (→ `iq`) |
| `iq` | Recursive result-tree resolver |
| `NH` | Error logger (`Yc.logError`, `hRH.push`) |
| `SH` | No-op / side-effect sentinel |
| `uH` | AppState accessor helper |
| `GH` | String coercion utility |
| `bH` | String coercion utility (base `String` call) |
| `G6` | Full system-prompt section final assembler |
| `y6` | Cache-breaking phrase injector |
| `Ji6` | System-prompt dedup tracker (`vA_` / `gMH`) |
| `dz` | Error-formatter (`bH`) |
| `EL` | Equality-check utility |
| `RK` | `JV` wrapper (path utility) |
| `JV` | Path utility (used for subagent path joins) |
| `V6` | Path resolver |
| `__` | Internal path constant |
| `rq` | Session read helper |
| `ow` | Session write helper |
| `Xb` | System-prompt main-thread assembler |
| `Gf` | No-op guard / feature-flag check |
| `LzH` | Conversation context builder (language detection, context injection) |
| `_ZH` | Language detector |
| `iIH` | Context inclusion checker |
| `Oy_` | Deferred-tool-set manager |
| `$w_` | Sub-agent session runner (sets app state, runs turn loop) |
| `Vk_` | MCP-tool listing and permission evaluator |
| `jKH` | Bundled-tool set builder |
| `l1H` | Tool-availability checker |
| `hU` | Context-window helper |
| `iJ` | Token-budget integer parser |
| `EY` | Expiry-check utility |
| `az_` | Permission-set accumulator |
| `r1H` | Exponential-backoff retry scheduler |
| `tG` | Tool-display-name builder |
| `za1` | Additional-context assembler |
| `q_7` | Slash-command prompt resolver |
| `gP6` | Slash-command `Xk` lookup |
| `Xk` | Slash-command finder |
| `hnH` | Tool-hint list builder |
| `m4` | Tool-type discriminator |
| `T6` | Background-agent session display / write-batch renderer |
| `U6` | Session-list row renderer |
| `p6` | Collapsed-read-search row renderer |
| `yH` | State/metadata reporter |
| `m6` | Slash-command registry accessor |
| `QH` | Slash-command prompt formatter |
| `H_7` | Hook-attachment processor |
| `Ob` | Enterprise / project hook loader |
| `LR1` | Permission-list builder (→ `G6`) |
| `MH` | Main interactive-session UI component |
| `lC` | Per-turn lifecycle runner |
| `s87` | Full agentic turn-loop body |
| `dA8` | Sub-agent exit handler (cleans `nC`, `ww_`) |
| `QP6` | Sub-agent session configuration object builder |
| `tX` | Core query+streaming executor |
| `bKH` | Agent-call wrapper (composes `z4`/`LT`/`tX`) |
| `AS` | Token-usage aggregator |
| `z4` | Model + effort configurator |
| `NT` | Latest-assistant-message extractor |
| `D` | Context-pressure / memory-free monitor |
| `w` | Background-session process supervisor |
| `J` | Background-session kill helper |
| `pB` | Turn-duration recorder |
| `o` | Full session-resume / session-load controller |
| `JHH` | Session-event dispatcher |
| `cT6` | Project-session file renamer |
| `gQ` | Queue helper (→ `qL`) |
| `KvH` | Conversation-queue helper (→ `qL`) |
| `qL` | Persistent conversation-log accessor |
| `ykH` | Session display-name builder |
| `iT6` | Session idle-timeout manager |
| `m6H` | Metadata-queue helper (→ `qL`) |
| `rT6` | Session initialiser (chdir, hooks, context) |
| `u6H` | Session-metadata re-append helper |
| `k_` | Error constructor helper |
| `CG` | Global-event emitter (`GV6.emit`) |
| `uX` | Session UUID accessor |
| `pI` | Agent-state update poster |
| `gIH` | Throttled agent-state flusher |
| `zi1` | Agent-state batch submitter |
| `sBH` | Output-event enqueuer |
| `f$6` | Post-fork cleanup finaliser |
| `HdH` | Fork completion notifier |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.