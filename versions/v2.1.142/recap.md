---
type: feature-spec
feature: "recap"
cc_version: "2.1.142"
updated: "2026-06-01"
tags: ["recap", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.142 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/recap`

> Analysis basis: CC v2.1.142 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.142

---

## Overview

`/recap` triggers an immediate, on-demand generation of a single-line session summary without waiting for the session's natural completion. It delegates to the same "away summary" subsystem used for background session summarisation, enforcing a tool-free, non-interactive execution path. The resulting recap line is emitted as post-text output, or a user-facing error message is shown if the session has no turns yet, the operation is cancelled, or the API call fails.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `recap` |
| description | `Generate a one-line session recap now` |
| loc_byte | `11895486` |
| loc_byte_end | `11895702` |
| loc_line | `7756` |
| supportsNonInteractive | `false` |
| thinClientDispatch | `post-text` |
| load_inline | `true` |
| load_ident | `nR7` |
| arbor_handler.name | `nR7` |
| arbor_handler.fqn | `claude-2.1.142::nR7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `load_ident` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.142 bundle.js:+11895486

---

## Input Branching

The command has four distinct outcome paths based on session state and API result, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/recap invoked"]) --> B{Session has turns?}
    B -- No --> C["Emit: 'Nothing to recap yet — send a message first.'"]
    B -- Yes --> D{Away summary prerequisites met?\n(CacheSafeParams saved?)}
    D -- No --> E["Log: '[awaySummary] no CacheSafeParams saved, skipping'\nReturn no-turn result"]
    D -- Yes --> F["Invoke away-summary agent\n(tool use denied, tool-free mode)"]
    F --> G{API / agent result}
    G -- aborted --> H["Emit: 'Recap cancelled.'"]
    G -- api-error --> I["Emit: 'Couldn't generate a recap. Run with --debug for details.'"]
    G -- ok --> J["Emit one-line recap text as post-text"]
    G -- failed --> I
```

Analysis basis: CC v2.1.142 bundle.js:+11895236, +11895328, +11895386, +6640082, +6640140, +6640600, +6640689, +6640750, +6640769

---

## Behavioral Spec

### Top-level Handler (`nR7`)

The handler is an `AsyncFunction` resolved via the `load_ident` inline `Promise.resolve({call: nR7})` shape. It is the sole entry point for `/recap`.

```
async function recapHandler(context):
    turns = getCurrentSessionTurns(context)

    if turns is empty:
        return postText("Nothing to recap yet — send a message first.")

    result = await awaysSummaryDispatch(context)

    match result.status:
        case "aborted":
            return postText("Recap cancelled.")
        case "api-error" | "failed":
            return postText("Couldn't generate a recap. Run with --debug for details.")
        case "ok":
            return postText(result.summaryLine)
```

Analysis basis: CC v2.1.142 bundle.js:+11895094, +11895236, +11895328, +11895386

---

### Away-Summary Dispatch (`awaySummaryDispatch` ← `A18`)

`A18` is the shared away-summary orchestration function. When invoked from `/recap`, it:

1. Checks that `CacheSafeParams` are saved from a prior turn; if not, logs the skip message and returns a `"no-turn"` sentinel.
2. Registers an `abort` listener on the session's `AbortController`; if the user cancels mid-flight, the signal fires and the result is tagged `"aborted"`.
3. Calls the query pipeline (`queryPipeline`) with the `away_summary` mode label, setting tool-use permission to `"deny"` (literal: `"Away summary cannot use tools"`), preventing any tool calls during recap generation.
4. Discriminates the final result into one of: `"aborted"`, `"api-error"`, `"ok"`, `"failed"`, `"other"`.

```
async function awaySummaryDispatch(context):
    if not cacheSafeParamsSaved(context):
        log("[awaySummary] no CacheSafeParams saved, skipping")
        return { status: "no-turn" }

    abortController = context.abortController
    abortController.signal.addEventListener("abort", onAbort)

    try:
        queryResult = await queryPipeline(context, {
            mode: "away_summary",
            toolPermission: "deny",   // "Away summary cannot use tools"
            label: "other"
        })

        return classifyResult(queryResult)
            // possible: "aborted" | "api-error" | "ok" | "failed" | "other"
    finally:
        abortController.signal.removeEventListener("abort", onAbort)
```

Analysis basis: CC v2.1.142 bundle.js:+6640061, +6640082, +6640140, +6640177, +6640196, +6640208, +6640373, +6640388, +6640441, +6640456, +6640600, +6640689, +6640750, +6640769

---

### Query Pipeline (`queryPipeline` ← `jZ`)

`jZ` is the main query orchestration function. For `/recap` it is called in away-summary mode. Key behaviour within depth-2 reach:

1. Records `Date.now()` at entry for latency tracking.
2. Constructs the agent call via `agentQueryCore` (`$w_`), which reads `appState`, `toolPermissionContext`, and sets up memory/compaction parameters.
3. Selects the model entry via `G.at("main")` (literal `"main"`).
4. Generates a random session ID component using `crypto.randomBytes` (8 bytes, hex-encoded).
5. Uses `uuid` and `randomUUID` for turn/message IDs.
6. Iterates the agentic loop via `agentLoop` (`s87`), which contains the full streaming/tool/compaction machinery — but for away-summary mode the tool permission is `"deny"`, so tool-use branches inside `s87` are never exercised.
7. Summarises completed turns via `turnSummariser` (`lC`), which calls `conversationSummariser` (`s87`) and `subagentExitHandler` (`dA8`).
8. Pushes progress updates via the `D.push` observable.
9. Finalises via `recapResultFinaliser` (`N34`).

```
async function queryPipeline(context, options):
    startTime = Date.now()
    sessionId = hex(randomBytes(8))

    agentState = agentQueryCore(context, options)
        // reads appState, toolPermissionContext
        // sets compaction params (micro/auto compact windows)

    model = modelRegistry.at("main")

    async for turn in agentLoop(agentState, model):
        pushProgress(turn)

    summary = turnSummariser(agentState)
    return recapResultFinaliser(summary)
```

Analysis basis: CC v2.1.142 bundle.js:+5412629, +5412934, +5412745, +5412985, +5413009, +5413028, +5413098, +5413159, +5413339, +5413429, +5413458, +5413808, +5414120, +5414342, +5414436

---

### Agent Core Setup (`agentQueryCore` ← `$w_`)

Sets up the state object that the agentic loop consumes:

- Reads current `appState` via `H.getAppState`.
- Reads `toolPermissionContext` via `H.getToolPermissionContext`.
- Loads memory state via `memoryLoader` (`v1H`): calls `Jm` (memory subsystem), `_.load`, `H.dump`.
- Sets `appState` for the recap turn via `H.setAppState`.
- Merges extra context via `Object.assign`.
- Generates a per-query random token via `crypto.randomBytes` (8 bytes, hex).
- Generates a `randomUUID` for the query.
- Tracks in-flight tasks via a `Set` (add/finally/delete pattern).

Analysis basis: CC v2.1.142 bundle.js:+5409430, +5409533, +5409830, +5409969, +5410244, +5410350, +5410550, +5410649, +5411565, +5412111, +5412205, +5407981, +5407993

---

### Agentic Loop (`agentLoop` ← `s87`)

`s87` is the full agentic loop shared with normal query execution. For `/recap` (away-summary mode) only the subset of branches relevant to a tool-denied, single-turn summary call are exercised:

- Emits lifecycle markers: `stream_request_start`, `query_fn_entry`, `query_started`, `query_setup_start`, `query_setup_end`, `query_api_loop_start`, `query_api_streaming_start`, `query_api_streaming_end`.
- Calls the model via `D.callModel`.
- Handles compaction checks (micro-compact, auto-compact) — these may fire if the context is large.
- Because `toolPermission` is `"deny"`, any tool-use response from the model is rejected without execution.
- On normal completion, emits `completed`.
- On output-token-limit hit, emits recovery instructions (literals: `"Output token limit hit. Resume directly…"` / `"Pick up mid-thought…"`).
- On malformed tool call, retries once with the literal `"Your tool call was malformed and could not be parsed. Please retry."`

Analysis basis: CC v2.1.142 bundle.js:+9182176, +9183516, +9183543, +9183575, +9187618, +9188491, +9189200, +9190303, +9190678, +9191887, +9192220, +9192323, +9194449, +9194544, +9195230, +9195794

---

### Turn Summariser (`turnSummariser` ← `lC`)

After the agentic loop exits, `lC` post-processes the completed turn:

1. Invokes `conversationSummariser` (`s87`) in summary mode to extract the one-line recap text.
2. Calls `subagentExitHandler` (`dA8`) to clean up subagent state:
   - Checks cache readiness (`"ready"` sentinel).
   - Deletes the subagent record from the cache map.
   - Removes the associated watcher entry.
   - Emits `"subagent_exit"` to the observable stream.
3. Returns the structured summary containing the recap line.

Analysis basis: CC v2.1.142 bundle.js:+9182176, +9182229, +9182492, +9182615, +5440874, +5440883, +5440908, +5440916, +5440958, +5440975, +5440991

---

### Transcript Writer (`transcriptWriter` ← `O7K`)

`O7K` handles durable logging of the recap turn to the session transcript file:

- Resolves the transcript directory via `path.dirname` and `path.join`.
- Checks file existence; if the `.txt` extension is detected, trims the last 4 characters from the path (`".txt"` literal, offset 4 via slice).
- Appends the turn content via `fs.appendFile` after ensuring the directory exists (`fs.mkdir`).
- Rotates / renames the file if it exceeds the byte-length threshold (`Buffer.byteLength`).
- Handles `"EISDIR"` errors from `fs.stat` gracefully.
- Fires `fs.unlink` for superseded rotation targets.

Analysis basis: CC v2.1.142 bundle.js:+200171, +200196, +200204, +200234, +200249, +200324, +200341, +200373, +200379, +200412, +200429, +200438, +200534, +199525, +199618, +199629, +199640, +199651, +199681, +199709, +199721, +199856, +199870, +199925, +199984, +171408

---

### Session State Notifications (`sessionStateNotifier` ← `YhH`)

`YhH` batches and debounces state-change events across the session observable:

- Uses `clearTimeout` / `setTimeout` / `setImmediate` for debouncing.
- Joins pending notification arrays with `$.join`, `L.join`, `j.join`.
- Pushes new items via `$.push` / `L.push`.
- Dispatches to downstream subscribers (`O`, `D`, `w`, `Y` callbacks).

Analysis basis: CC v2.1.142 bundle.js:+56080, +56121, +56152, +56154, +56198, +56219, +56244, +56279, +56337, +56377, +56428, +56450, +56472, +56495

---

### Progress Emitter (`progressEmitter` ← `v`)

`v` is called by the query pipeline to push intermediate progress updates:

- Normalises the event kind to uppercase (`.toUpperCase()`).
- Checks inclusion in the known-event set (`H.includes`).
- Serialises the payload via `JSON.stringify` (via `RH`).
- Appends to the path via `pathAppender` (`H5`), which uses `lastIndexOf`, `slice`, and `.at()` for path component extraction.
- Replaces sensitive substrings with `"[REDACTED]"` before emission.
- Trims whitespace (`H.trim`).
- Calls `fileWriter` (`BhH`) → `writeHandle` (`gHA`) → `H.write`.
- Applies debug-level filtering (literal `"debug"` at bundle.js:+200659).

Analysis basis: CC v2.1.142 bundle.js:+200659, +200683, +200701, +200723, +200741, +200785, +200805, +200808, +200824, +200830, +200844, +192784

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry (query core) | `tengu_auto_compact_rapid_refill_breaker`, `tengu_auto_compact_succeeded`, `tengu_ptl_surfaced_to_user`, `tengu_orphaned_messages_tombstoned`, `tengu_model_fallback_triggered`, `tengu_query_error`, `tengu_model_response_keyword_detected`, `tengu_malformed_tool_use_response`, `tengu_stop_hook_block_count`, `tengu_streaming_tool_execution_used`, `tengu_streaming_tool_execution_not_used`, `tengu_loop_dynamic_wakeup_ends_turn`, `tengu_post_autocompact_turn`, `tengu_query_before_attachments`, `tengu_query_after_attachments`, `tengu_mcp_tools_refreshed_mid_turn` |
| Telemetry (forked agent) | `tengu_forked_agent_default_turns_exceeded`, `tengu_fork_agent_query` |
| Telemetry (background daemon) | `tengu_bg_spare_enable`, `tengu_bg_low_mem_mb`, `tengu_bg_spare_spawn`, `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail` |
| Telemetry (feature flags) | `tengu_feature_ok`, `tengu_feature_bad` |
| Tool permission | Forced to `"deny"` for the entire recap query; any tool-use response from the model is rejected |
| appState changes | `H.setAppState` called during agent setup; `H.getAppState` read at setup and during the agentic loop |
| Transcript write | The recap turn is appended to the session transcript file via `fs.appendFile`; file rotation may occur |
| AbortController | An `"abort"` event listener is registered on the session signal and removed in `finally` |
| Observable push | Progress events (e.g., `"tool_use_summary"`, `"notification"`, `"post_turn_summary"`, `"active_goal"`, `"conversation_reset"`) are pushed to the session observable stream |
| Subagent cache | Cleaned up via `nC.delete` / `ww_.delete` after the turn completes |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | `supportsNonInteractive: false` — the command cannot run in non-interactive mode; no hook registration evidence found in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.142 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `/recap` has `supportsNonInteractive: false`. Attempting to invoke it from a script or pipe context will fail or be silently ignored.
2. **Expecting recap before any turns**: If no messages have been exchanged in the session, the command immediately returns `"Nothing to recap yet — send a message first."` — no API call is made.
3. **Expecting tool output in the recap**: The away-summary path sets tool permission to `"deny"`. Any model attempt to call a tool during recap generation is blocked. The recap is strictly text-only.
4. **Cancelling mid-generation and expecting a partial result**: If the user sends an abort signal, the result is `"Recap cancelled."` — no partial summary is returned.
5. **Assuming recap is synchronous with the session state**: The recap queries the model using a snapshot of `CacheSafeParams` saved at the last turn boundary. If no such snapshot exists (e.g., the session was just started), the command skips and returns a no-turn result.
6. **Interpreting `--debug` output**: On API error, the user is directed to re-run with `--debug`. The error details are logged at the `"debug"` level and are not shown in normal output.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `nR7` | Top-level recap handler (AsyncFunction; resolved via `load_ident`) |
| `A18` | Away-summary orchestration / dispatch function |
| `iEH` | CacheSafeParams existence check |
| `v` | Progress emitter / event normaliser |
| `f7K` | File progress writer coordinator |
| `Zt_` | File-write state machine (sub-coordinator) |
| `H` | Session/context object (varies by call site; also random-delay helper) |
| `RH` | JSON serialisation wrapper |
| `_` | String utility / path segment helper |
| `H5` | Path component extractor / appender |
| `H6A` | Path-map builder |
| `q` | File cleanup / unlink helper |
| `A` | Path string / file lowercase utility |
| `BhH` | File writer dispatcher |
| `gHA` | Low-level write handle caller |
| `O7K` | Transcript writer / file rotation manager |
| `YhH` | Session state notifier (debounced batch emitter) |
| `i8H` | Notification payload builder |
| `x6` | Directory resolution helper |
| `Vv8` | EISDIR error handler |
| `$6A` | Path join / version-path builder |
| `M6A` | File stat / rename / unlink rotation handler |
| `$7K` | Append-file + rotation orchestrator (bound method) |
| `C9` | Observable subscription manager (add/delete/assign) |
| `jZ` | Query pipeline / main orchestration function |
| `$w_` | Agent query core setup function |
| `rN` | Agent runner / abort + handler binder |
| `v1H` | Memory loader (load/dump) |
| `HOH` | Context merge helper |
| `Or9` | Permission context builder |
| `L` | In-flight task tracker (Set + finally) |
| `bA8` | Agent state initialiser |
| `Cm` | Random-bytes token generator |
| `G` | Model registry / global config accessor |
| `lX6` | Model entry loader (primary) |
| `hT8` | Model entry loader (fallback) |
| `we` | Agent loop wrapper |
| `qL` | Observable subscription helper |
| `TvH` | Tool filter / ant-mode selector |
| `lC` | Turn summariser |
| `s87` | Agentic loop (full streaming / tool / compaction engine) |
| `dA8` | Subagent exit handler / cache cleanup |
| `SH` | Feature-flag OK reporter |
| `uH` | Feature-flag BAD reporter |
| `RA8` | Seen-set membership check |
| `qzH` | Query-state accumulator |
| `mA8` | Message assembler |
| `D` | Observable / message push target (also daemon manager) |
| `G6` | Background session creator |
| `$` | Disposable / subscription handle |
| `LG6` | Low-memory background session launcher |
| `br_` | Background daemon spare-spawn function |
| `d` | Logger / debug emitter |
| `NH` | Error logger with structured fields |
| `N34` | Recap result finaliser |
| `Y8` | Session lifecycle manager |
| `j` | Daemon manager accessor |
| `w` | Daemon session worker / process manager |
| `J` | Process kill coordinator |
| `h` | Process kill scheduler (blur/focus/timeout aware) |
| `sz1` | Result flat-mapper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.