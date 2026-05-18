---
type: feature-spec
feature: "clear"
cc_version: "2.1.143"
updated: "2026-05-18"
tags: ["clear", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.143 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/clear`

> Analysis basis: CC v2.1.143 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.143

---

## Overview

The `/clear` command starts a fresh conversation session with an empty context window while preserving the previous session on disk for later resumption via `/resume`. It is also registered under the aliases `/reset` and `/new`, and it supports non-interactive (scripted) invocation. Internally the command trims any optional name argument, clears all in-memory conversation and cache state across multiple subsystems, emits a new session UUID, and writes a `SessionEnd` lifecycle event before handing control to the new session initializer.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `clear` |
| description | `Start a new session with empty context; previous session stays on disk (resumable with /resume)` |
| argumentHint | `[name]` |
| aliases | `reset`, `new` |
| supportsNonInteractive | `true` |
| thinClientDispatch | `post-text` |
| module_id | `dqq` |

Analysis basis: CC v2.1.143 bundle.js:+10100616

---

## Input Branching

The command entry point (`commandHandler`) receives the raw argument string, trims whitespace, then routes through the session-clear pipeline (`sessionClearPipeline`). The optional name argument controls whether the new session is given a custom title.

```mermaid
flowchart TD
    A(["/clear [name] invoked"]) --> B["Trim argument string\n(H.trim)"]
    B --> C{Argument present\nafter trim?}
    C -- "Yes (custom name)" --> D["Pass name to new-session\ninitializer as custom title"]
    C -- "No (empty)" --> E["Use auto-generated title"]
    D --> F["Emit cache-eviction hint\n(tengu_cache_eviction_hint)"]
    E --> F
    F --> G{Session currently\nbackgrounded?\n(isBackgrounded flag)}
    G -- "Yes" --> H["Skip certain foreground\nstate teardowns"]
    G -- "No" --> I["Full foreground teardown:\nabort running request,\nclear timeout handles"]
    H --> J["Clear all in-memory\nconversation state\n(nC_ subsystem)"]
    I --> J
    J --> K["Emit conversation_clear\ntelemetry event"]
    K --> L["Generate new session UUID\n(Fqq.randomUUID)"]
    L --> M["Write SessionEnd\nlifecycle record"]
    M --> N["Initialize new session\n(sessionInitializer)"]
    N --> O(["New empty session active"])
```

Analysis basis: CC v2.1.143 bundle.js:+10100442, +10100478, +10098852, +10098784, +10099880

---

## Behavioral Spec

### 1. Argument Parsing

```
function parseArgument(rawInput):
    trimmed = rawInput.trim()          // H.trim — bundle.js:+10100442
    if length(trimmed) == 0:
        return null                    // no custom name
    else:
        return trimmed                 // custom session name
```

Analysis basis: CC v2.1.143 bundle.js:+10100442, +10100457

---

### 2. Session-Clear Pipeline (top-level orchestrator)

```
async function sessionClearPipeline(trimmedName, appState):
    emit telemetry: tengu_cache_eviction_hint   // bundle.js:+10098749

    // Determine backgrounded state
    backgrounded = appState["isBackgrounded"]   // bundle.js:+10098852

    // Abort any in-flight request
    clearTimeout(activeTimeoutHandle)           // bundle.js:+10099353
    abortController.abort()                     // bundle.js via SZ → K.abort

    // Clear conversation string literal marker
    mark = "clear"                              // bundle.js:+10098661

    // Invoke multi-subsystem state wipe
    await fullStateClear(appState)

    // Emit conversation_clear event
    emit telemetry: "conversation_clear"        // bundle.js:+10098784

    // Assign new session identifier
    newUUID = crypto.randomUUID()               // Fqq.randomUUID, bundle.js:+10099880

    // Write SessionEnd lifecycle event
    writeSessionEndRecord(newUUID)              // nvH → literal "SessionEnd", bundle.js:+12226761

    // Initialize fresh session
    await newSessionInitializer(trimmedName, newUUID, appState)
```

Analysis basis: CC v2.1.143 bundle.js:+10098645, +10098657, +10098705, +10099353, +10099880

---

### 3. Full State Clear (multi-subsystem wipe)

The subsystem `nC_` (fullStateClear) fans out to clear every in-memory cache and state store without touching the on-disk session record.

```
async function fullStateClear(appState):
    // Clear conversation message cache
    clearConversationCache()           // zi9 → Xm.clear, bundle.js:+4753248

    // Clear abort-signal / request tracker
    clearRequestTracker()              // RTH subsystem, bundle.js:+4742950

    // Clear subagent registry
    subagentRegistry.clear()           // K98 → rC.delete, bundle.js:+5456700

    // Clear compaction state
    postCompactState.clear()           // $98 → lAq.clear, bundle.js:+9876532

    // Clear route / permission caches
    routeCache.clear()                 // rq1 → Xz6.clear, bundle.js:+5398693
    permissionCache.clear()            // rq1 → Pw_.clear, bundle.js:+5398705

    // Clear session-level tool-result caches
    toolResultCache.clear()            // E11 → gn.clear, bundle.js:+5293115
    toolStateCache.clear()             // E11 → fzH.clear, bundle.js:+5293126

    // Clear hook caches
    hookCache.clear()                  // JrH → vz8.clear, bundle.js:+9338371

    // Clear compact-summary caches
    compactSummaryCache1.clear()       // ZS1 → yVH.clear, bundle.js:+7968683
    compactSummaryCache2.clear()       // ZS1 → xT_.clear, bundle.js:+7968695

    // Clear inline-query caches
    inlineQueryCache1.clear()          // yq1 → IQH.clear, bundle.js:+5383967
    inlineQueryCache2.clear()          // yq1 → zz6.clear, bundle.js:+5383979

    // Clear policy/history cache
    historyCache.clear()               // Nu8 → HCH.clear, bundle.js:+1050564

    // Clear autonomous-loop state
    autonomousLoopState.clear()        // $41 → y98.clear, bundle.js:+5560147

    // Clear interrupt/hook callback cache
    hookCallbackCache.clear()          // Ju8 → tRH.clear, bundle.js:+1043104

    // Reset autonomous-loop delivery counter
    autonomousLoopDelivered.reset()    // bz4.resetAutonomousLoopDelivered, bundle.js:+5472860

    // Flush pending output tokens metric
    flushOutputTokens()                // tj → outputTokens, bundle.js:+41769

    await Promise.resolve()            // bundle.js:+10097925
```

Analysis basis: CC v2.1.143 bundle.js:+10097639 – +10098209

---

### 4. New Session Initializer

After the state wipe, the new session is constructed. This mirrors the initial session-start flow (`um` / `Jz6` / `L2`).

```
async function newSessionInitializer(customName, sessionUUID, appState):
    // Build effort and model parameters
    effortValue = getEffortValue(appState)      // A.getEffortValue, bundle.js:+12236247

    // Emit SessionEnd lifecycle write
    writeRecord("SessionEnd", previousSessionId) // literal "SessionEnd", bundle.js:+12226761

    // Resolve working directory
    resolvedCwd = resolveCwd(appState)           // fD subsystem, bundle.js:+10099056

    // Emit conversation_reset telemetry
    emit "conversation_reset"                    // bundle.js:+10099841

    // Generate new session roster entry and UUID
    newRosterEntry = buildRosterEntry(sessionUUID, customName)  // Ub/NZ8, bundle.js:+10099898

    // Flush any pending log writes
    await flushLogWrites()                       // rIH → R28, bundle.js:+10100131

    // Register new session with daemon (if running)
    registerWithDaemon(newRosterEntry)           // g3/KL, bundle.js:+10099783

    // Activate new conversation loop
    await conversationLoop(appState, newRosterEntry)  // um/Jz6/L2 chain
```

Analysis basis: CC v2.1.143 bundle.js:+10099783, +10099841, +10099880, +10100131, +12226761

---

### 5. Session-End Record Writer

```
function writeSessionEndRecord(previousSessionId):
    record = {
        type: "SessionEnd",          // literal, bundle.js:+12226761
        sessionId: previousSessionId,
        timestamp: Date.now()
    }
    appendToSessionLog(record)       // Ub → H4H → A.appendFileSync, bundle.js:+12140073
    emitEvent("SessionEnd", record)  // Ub → lG6.emit, bundle.js:+12141105
```

Analysis basis: CC v2.1.143 bundle.js:+12226761, +12140073, +12141105

---

### 6. Abort / Timeout Cleanup

```
function abortAndClearTimers(sessionState):
    // Cancel pending AbortSignal
    AbortSignal.timeout(0)                    // m26 → AbortSignal.timeout, bundle.js:+10098705
    activeAbortController.abort()             // SZ → K.abort, bundle.js:+8061172
    clearTimeout(activeTimeoutHandle)         // m26 → clearTimeout, bundle.js:+10099353
```

Analysis basis: CC v2.1.143 bundle.js:+10098705, +10099353, +8061172

---

### 7. Random Jitter (background session delay)

A small random delay is introduced when dispatching to the background session layer, to avoid thundering-herd on daemon socket claims.

```
function randomJitterDelay():
    // Values: Math.random() produces [0, 2), floored, yielding 0 or 1
    delay = Math.floor(Math.random() * 2) + 1   // literals 2, 1 — bundle.js:+12638154, +12638170
    setTimeout(callback, delay)                   // bundle.js:+12638193
```

Analysis basis: CC v2.1.143 bundle.js:+12638154, +12638170, +12638193

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry emitted | `tengu_cache_eviction_hint` (bundle.js:+10098749); `tengu_session_renamed` (bundle.js:+12141118); `tengu_repl_hook_finished` (bundle.js:+12256704); `tengu_run_hook` (bundle.js:+12272534); `tengu_feature_ok` / `tengu_feature_bad` (bundle.js:+955068, +955126) |
| Conversation state cleared | All in-memory message history, tool-result caches, compaction summaries, permission caches, hook caches, policy caches, subagent registry — see § 3 |
| On-disk session record | **Preserved** — previous session remains on disk and is resumable via `/resume` |
| Session lifecycle events | `SessionEnd` written to session log before new session starts (bundle.js:+12226761) |
| New session UUID | Generated via `crypto.randomUUID()` (bundle.js:+10099880) |
| Custom title | If a name argument is supplied, stored as `custom-title` metadata on the new session roster entry (literal `custom-title`, bundle.js:+12141026) |
| Active request abort | Any in-flight API request is aborted via `AbortController.abort()` (bundle.js:+8061172) |
| Timeout handles | All active `setTimeout` handles are cleared (bundle.js:+10099353) |
| Autonomous-loop counter | Reset via `bz4.resetAutonomousLoopDelivered` (bundle.js:+5472860) |
| Output-token flush | Pending `outputTokens` metric flushed before new session (bundle.js:+41769) |
| Hook registration | `at_.register` invoked during new-session hook setup via `KL → h9` (bundle.js:+56977) |
| appState changes | `isBackgrounded` flag read but not mutated; new session UUID and roster entry written |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| MCP servers | Not disconnected — MCP server state is preserved across `/clear` (no teardown call observed in depth-2 traversal of `nC_`) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.143 | Initial analysis — `local` command type, aliases `reset`/`new`, `thinClientDispatch: post-text`, `supportsNonInteractive: true` |

---

## Common Mistakes

1. **Confusing `/clear` with session deletion.** The previous session is not deleted; it remains on disk. Use `/resume` to return to it. The command description explicitly states this: "previous session stays on disk (resumable with /resume)".

2. **Using `/clear` when you mean `/compact`.** `/clear` discards the entire in-memory context. `/compact` summarizes and compresses it while keeping the session alive. Use `/compact` when you want to reduce token usage without losing continuity.

3. **Expecting MCP servers to reconnect.** MCP server connections are not torn down by `/clear`. If a server is in a bad state, `/clear` will not reset it; you need to explicitly restart the relevant MCP server.

4. **Passing a multi-word name without quoting in scripted (`--print`) invocations.** Because `supportsNonInteractive` is true, `/clear` can be driven programmatically, but the optional `[name]` argument is taken as the full trimmed remainder of the command string. Ensure the invoking script passes the name as a single token or properly escaped string.

5. **Assuming `/reset` and `/new` behave differently.** Both are exact aliases for `/clear` with identical behavior — they share the same command registration object (bundle.js:+10100616).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `oO7` | Command handler entry point for `/clear` |
| `m26` | Session-clear pipeline orchestrator |
| `U26` | Token/effort parameter resolver |
| `aY` | Policy-settings reader |
| `I8` | Policy settings accessor (reads `policySettings`) |
| `mU` | Global-state getter (reads from `GV`) |
| `Qg` | Session-context query helper |
| `Lw_` | Session context sub-reader (`bq1`) |
| `nvH` | Session-end record writer / `SessionEnd` emitter |
| `L4` | Model/effort configuration builder |
| `V6` | App-state value extractor |
| `Yy` | App-state secondary extractor |
| `QX` | Effort-level resolver (handles model strings and `effort` key) |
| `sE` | High-effort mode checker |
| `QZ` | Conversation message list builder |
| `S6` | Session log appender |
| `j2` | Core new-session executor (hook runner + message loop launcher) |
| `xH` | String coercion utility |
| `bm` | Message-batch builder |
| `v` | REPL message formatter / debug-level handler |
| `_4H` | Effort/model value mapping helper |
| `cQ_` | Hook-event filter and dispatcher (handles PreToolUse, PostToolUse, etc.) |
| `O` | Message/event collection with `N8` lookup |
| `GSq` | Group-selector helper |
| `dQ_` | Third-party hook filter |
| `TSq` | Tool-stop handler |
| `d` | Shared state/config accessor |
| `hH` | JSON serialization wrapper |
| `NH` | Error logging and push reporter |
| `mH` | State mutation accessor |
| `cPH` | Compact-handler invoker (`Zh6`) |
| `SZ` | Abort-controller manager (abort + clearTimeout + setTimeout) |
| `j` | Callback invoker (`w`) |
| `d6H` | Deferred-handler reference |
| `hh` | Hook-execution helper |
| `g28` | Hook group executor (`hh`, `om_`, `am_`) |
| `QQ_` | MCP tool runner |
| `c28` | Hook JSON-output parser |
| `gQ_` | HTTP hook executor |
| `WSq` | HTTP-hook response handler |
| `mLH` | Mutex/lock helper |
| `l28` | Shell/bash hook spawner |
| `SH` | State persistence writer |
| `Wj6` | Session-name writer |
| `ieH` | Cache-eviction hint emitter |
| `M` | MCP server manager (applies updates, reconciles server list) |
| `SvH` | MCP server connection supervisor |
| `KHH` | MCP client connection factory |
| `rI` | MCP reconnect-state tracker |
| `K` | Active-connection map / task padder |
| `H_` | Underscore/path helper |
| `f26` | MCP filter helper |
| `_57` | Timing/date-stamp helper for MCP |
| `v78` | MCP key enumerator |
| `I78` | MCP disconnect helper (`dK`) |
| `A8` | MCP debug-log pusher |
| `Yh_` | OAuth flow initiator for MCP |
| `Dh_` | OAuth completion handler for MCP |
| `x8q` | MCP connection status poller |
| `Oh_` | MCP error reporter |
| `NG_` | MCP include-list checker |
| `J` | Process/session kill-list manager |
| `y` | Daemon write-stream wrapper |
| `_7` | MCP error push logger |
| `XH` | String-coercion error formatter |
| `S8q` | MCP status reporter (`Yn`) |
| `M26` | MCP integer parser |
| `xh_` | MCP secondary integer parser |
| `THK` | MCP update applier (`applyMcpUpdate`) |
| `eY8` | MCP update serializer |
| `wv` | MCP cleanup runner |
| `L` | Connection-set manager (add/finally/delete) |
| `q` | File-unlink executor (`n8K.unlinkSync`) |
| `f` | Connection finalizer (close + cleanup) |
| `$` | Session-record builder (`JZq`) |
| `JZq` | Session timestamp + ID record constructor |
| `B95` | MCP bulk-reconnect coordinator |
| `_` | Underscore/path or utility reference |
| `k78` | MCP capability-set checker |
| `r8` | Retry-with-timeout helper |
| `drH` | MCP debug serializer (`hH`) |
| `Rj` | Running-state marker |
| `w` | Worker/background-session dispatch manager |
| `C` | Session process controller (kill, write, NH) |
| `Z_K` | File realpath/stat resolver |
| `MK5` | Process metadata builder (`p58`) |
| `z` | Daemon stream writer (SH, mH, xN, Ox) |
| `IG6` | Low-memory monitor |
| `G6` | Foreground-session gate checker |
| `x` | Idle-timeout / retire-if-settled manager |
| `h` | Timer handle holder |
| `m` | Timer unref wrapper |
| `Oo_` | Daemon socket claim sender |
| `Gd_` | Session directory/file writer |
| `uq5` | Claim-send timeout enforcer |
| `xq5` | Claim-frame builder |
| `L8` | Promise-race / abort-signal integrator |
| `mp` | Binary-framed message encoder (Buffer.from + writeUInt32BE) |
| `jo_` | Background-session lifecycle manager (create/retire/roster) |
| `IK` | Path joiner for session directories |
| `s1` | Session-file reader/cache manager |
| `rw` | Active-state marker (`lE`) |
| `Bf` | Session-file path builder |
| `SoH` | Session-start hook invoker |
| `wLH` | Session log-path builder |
| `Bk` | Session-name splitter (H.split) |
| `gp` | Session-directory path builder |
| `zW6` | Session directory creator (`Ex_`) |
| `D` | Daemon-wide idle/disposal controller |
| `$o_` | Spare-session spawner (Bun.spawn) |
| `iD` | In-daemon state accessor |
| `nC_` | Full in-memory state clear orchestrator |
| `gC_` | Sub-clear initializer |
| `rHH` | Hook/state pipeline builder (PqH, Cz8, Ft1, LY8) |
| `PqH` | Hook pipeline stage 1 |
| `Cz8` | Hook pipeline stage 2 |
| `Ft1` | Hook pipeline stage 3 |
| `LY8` | Hook pipeline stage 4 |
| `zi9` | Conversation-cache clearer (`Xm.clear`) |
| `RTH` | Request-tracker clearer (`Ai9`, `qi9`) |
| `YH6` | Session-year/date helper |
| `sn` | Multi-subsystem clear fan-out |
| `T1H` | Teammate initializer (`G1H`) |
| `K98` | Subagent registry clearer |
| `F$6` | Session-start event emitter (`XT`) |
| `Pn` | Prompt-state clearer |
| `Pe` | Permission-state clearer (`DI8`, `EI8`) |
| `$98` | Compaction-state clearer (`lAq.clear`) |
| `rq1` | Route/permission cache clearer (`Xz6.clear`, `Pw_.clear`) |
| `CK1` | Conversation-context re-initializer |
| `an` | Autonomous-loop flag resetter |
| `tj` | Output-token metric flusher |
| `iw_` | Post-clear hook invoker |
| `JrH` | Hook-result cache clearer (`vz8.clear`) |
| `ZS1` | Compact-summary cache clearer (`yVH.clear`, `xT_.clear`) |
| `yq1` | Inline-query cache clearer (`IQH.clear`, `zz6.clear`) |
| `Nu8` | Policy/history cache clearer (`HCH.clear`) |
| `md9` | Misc-diagnostic clearer |
| `$41` | Autonomous-loop state clearer (`y98.clear`) |
| `$I8` | Has-check guard for session state |
| `Ju8` | Hook-callback cache clearer (`tRH.clear`) |
| `hHq` | Pending-hook queue flusher |
| `E11` | Tool-result/state cache clearer (`gn.clear`, `fzH.clear`) |
| `fD` | Working-directory resolver |
| `x6` | Path existence checker |
| `$8` | Async-safe path stat wrapper |
| `Px8` | Normalized-path resolver (NFC normalization) |
| `y8H` | Path normalizer (H.normalize) |
| `__` | Global-state helper (`GV`) |
| `UTH` | Session-metadata updater |
| `QI` | Conversation-state query |
| `zz` | Flush-pending-writes helper (`R28`, `S28`) |
| `R28` | Pending-write tracker (`yyq.add/delete`) |
| `SdH` | CLI-mode state setter (`OD1`) |
| `OD1` | CLI state writer |
| `Qqq` | Queue-state helper (`_7H`) |
| `_7H` | Queue-drain helper |
| `g3` | Session-initializer entry (calls `KL`) |
| `KL` | Conversation-loop constructor |
| `h9` | Hook registrar (`at_.register`) |
| `Ip` | App-state inspector |
| `g5` | Conversation-path builder (`CU`, `l$`, `A$H.join`) |
| `CU` | Context-path prefix builder |
| `p26` | Session-loop runner (calls `KL`) |
| `NZ8` | New-session UUID emitter (`v8H.randomUUID`, `xV6.emit`) |
| `rQ` | Roster-query helper (calls `KL`) |
| `Ub` | Session-rename/log writer (`H4H`, `lG6.emit`) |
| `H4H` | File-based session log appender |
| `rIH` | Session-log symlink manager |
| `xQ_` | Log directory creator |
| `AiH` | Log-path constructor |
| `S$` | Symlink target builder |
| `Kf8` | Log-file opener |
| `_T` | Subagent path builder |
| `Wf` | Session-watch initializer |
| `rf` | Session-resume checker |
| `pb` | Worktree-state log writer |
| `$6H` | Isolation-latch log writer |
| `Oyq` | Async append-file helper |
| `um` | Full new-session assembler (collects all subsystem outputs) |
| `TK` | Token-count coercion helper |
| `nFH` | Tool-include set builder |
| `sRH` | Session-start logger |
| `T8` | Sync file log writer |
| `Jz6` | Session-loop factory (calls `L4`, `L2`) |
| `L2` | Core conversation-loop executor |
| `L9` | Session UUID generator (`yt1.randomUUID`) |