---
type: feature-spec
feature: "clear"
cc_version: "2.1.143"
updated: "2026-06-01"
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

`/clear` starts a fresh conversation session with an empty context window, discarding the active in-memory conversation while preserving the previous session on disk so it can be resumed later with `/resume`. It accepts an optional `[name]` argument to label the new session. The command is also reachable via the aliases `/reset` and `/new`.

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
| load_inline | `true` |
| loc_byte | `10100616` |
| loc_byte_end | `10100907` |
| arbor_handler.name | `oO7` |
| arbor_handler.fqn | `claude-2.1.143::oO7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.143 bundle.js:+10100616

---

## Input Branching

Three distinct branches are present depending on the optional `[name]` argument and the session's background state:

```mermaid
flowchart TD
    A["/clear [name] invoked"] --> B["Trim argument string\n(oO7 → H.trim)"]
    B --> C{Argument provided?}
    C -- "Yes (non-empty after trim)" --> D["Use argument as new session name"]
    C -- "No (empty string)" --> E["Use default / auto-generated name"]
    D --> F["Call sessionReset\n(m26)"]
    E --> F
    F --> G{Session backgrounded?\n(isBackgrounded flag)}
    G -- "Yes" --> H["Emit tengu_cache_eviction_hint\nSkip UI teardown path"]
    G -- "No" --> I["Run full reset pipeline:\nclear state caches,\nreset conversation stores,\nreinit session UUID,\nreload plugin hooks"]
    H --> J["Persist prior session to disk\n(conversation_clear event)"]
    I --> J
    J --> K["Emit conversation_reset event\nfor new session"]
    K --> L["Return success to caller"]
```

Analysis basis: CC v2.1.143 bundle.js:+10100442, +10100457, +10100478, +10098661, +10098784, +10098852

---

## Behavioral Spec

### 1. Entry Point — Handler `oO7`

The Arbor-resolved async handler is `oO7` (resolution path: `module_id → dqq`).

```
async function clearCommandHandler(rawArgument, context):
    trimmedArg = rawArgument.trim()          # oO7 → H.trim (+10100442)
    nameArg    = trimmedArg.length > 0       # literal 0 (+10100457)
                   ? trimmedArg
                   : undefined
    result = await sessionReset(nameArg, context)   # oO7 → m26 (+10100478)
    return result
```

Analysis basis: CC v2.1.143 bundle.js:+10100442

---

### 2. Session Reset Pipeline — `m26`

`m26` is the core reset function invoked by the handler. It orchestrates cache eviction, state clearing, hook reloading, and event emission.

```
async function sessionReset(newName, context):
    # Step 1 — compute token / context window metrics
    tokenWindowInfo = computeContextWindow()    # m26 → U26 (+10098645)

    # Step 2 — save / flush the current session to disk
    # emits "clear" literal (+10098661) and "conversation_clear" event (+10098784)
    flushCurrentSession()

    # Step 3 — check background state
    if context.isBackgrounded:                 # literal "isBackgrounded" (+10098852)
        emitTelemetry("tengu_cache_eviction_hint")   # (+10098749)
        # lightweight path: skip UI teardown
    else:
        # Step 4 — full reset: clear in-memory state stores
        fullStateReset(context)                # m26 → nC_ (+10099047)

    # Step 5 — abort any running operation
    clearTimeout(existingTimer)                # m26 → clearTimeout (+10099353)
    abortActiveController()                    # literal "abortController" (+10099389)

    # Step 6 — reinitialise session identity
    newSessionId = crypto.randomUUID()         # m26 → Fqq.randomUUID (+10099880)
    emitSessionCreatedEvent(newSessionId)      # m26 → NZ8 (+10099898)

    # Step 7 — reload MCP servers
    mcpRefresh(context)                        # m26 → M (+10098929)

    # Step 8 — reload plugin hooks
    loadPluginHooks(context)                   # m26 → um (+10100222)

    # Step 9 — emit conversation_reset telemetry
    emitConversationReset()                    # literal "conversation_reset" (+10099841)

    # Step 10 — start new agent loop
    startAgentLoop(newName)                    # m26 → g3 (+10099783)

    return { ok: true }
```

Analysis basis: CC v2.1.143 bundle.js:+10098645, +10098661, +10098784, +10098852, +10099047, +10099353, +10099389, +10099841, +10099880

---

### 3. Context-Window Metrics — `U26`

Before clearing, the runtime records context-window utilisation, likely for telemetry or UI feedback.

```
function computeContextWindow():
    raw       = parseInt(windowSize)               # U26 → parseInt (+12234997)
    if not Number.isFinite(raw): return default    # U26 → Number.isFinite (+12235019)
    policy    = getPolicySettings()                # U26 → aY (+12235062)
    # literal "policySettings" (+5388489)
    base      = getBaseValue()                     # U26 → mU (+12235070)
    adjusted  = getAdjustedValue()                 # U26 → Qg (+12235097)
    clamped   = Math.max(0, Math.min(1000, …))     # U26 → Math.max/min (+12235215/+12235228)
    # literal 1000 (+12235184), literal 10 (+12235008)
    return clamped
```

Analysis basis: CC v2.1.143 bundle.js:+12234997, +12235019, +12235184

---

### 4. Full In-Memory State Reset — `nC_`

When not backgrounded, `nC_` clears every in-memory store before the new session begins.

```
function fullStateReset(context):
    clearConversationStore()          # nC_ → gC_ (+10097639)
    clearRenderedHookData()           # nC_ → rHH (+10097647)
    clearPromptCache()                # nC_ → zi9 (+10097656)
    resetSessionHooks()               # nC_ → YH6 (+10097665)
    resetAllStateSlices()             # nC_ → sn (+10097675)
      # sn clears: post-compact state (K98), feature flags (F$6),
      #            compact state (Pn/Pe), cache sets ($98, rq1),
      #            token counters (CK1/an), autonomousLoopDelivered flag,
      #            and tool output maps (tj/iw_)
    clearVectorStoreCache()           # nC_ → JrH (+10097688)
    clearSessionStore()               # nC_ → ZS1 (+10097861)
    clearContextQueryCache()          # nC_ → yq1 (+10097870)
    clearHistoryCache()               # nC_ → Nu8 (+10097879)
    clearDiagnosticsCache()           # nC_ → md9 (+10097885)
    clearEditorAnnotations()          # nC_ → $41 (+10097894)
    clearInternalFlagStore()          # nC_ → $I8 (+10097900)
    clearJupyterKernelCache()         # nC_ → Ju8 (+10097907)
    clearHookQueue()                  # nC_ → hHq (+10097913)
    clearEventEmitterState()          # nC_ → E11 (+10097919)
    # resolve immediately after all clears
    Promise.resolve()                 # nC_ → Promise.resolve (+10097925)
    runPostClearCallbacks(context)    # nC_ → lv_, q, OO8, oX, BgH
```

Analysis basis: CC v2.1.143 bundle.js:+10097639, +10097656, +10097675, +10097688, +10097870, +10097879, +10097919, +10097925

---

### 5. MCP Server Refresh — `M` / `SvH`

After clearing state the command triggers an MCP reconnect cycle. This re-enumerates server configurations, kills stale connections, and reconnects.

```
async function mcpRefresh(context):
    for each serverConfig in Object.values(mcpConfig):    # m26 → M (+10098929)
        serverState = startOrRefreshServer(serverConfig)  # M → SvH (+14234051)
        if serverState.status == "disabled": continue     # literal "disabled" (+9694745)
        reconnectIfNeeded(serverState)
        # transport types handled: stdio, sse, sse-ide, ws-ide (+9694847/881/946/982)
    applyMcpUpdate(results)                               # M → THK (+14234061)
```

Analysis basis: CC v2.1.143 bundle.js:+10098929, +14234051, +9694745

---

### 6. Plugin Hook Reload — `um`

```
async function loadPluginHooks(context):
    # literal "Skipping plugin hooks - allowManagedHooksOnly is enabled..."
    if allowManagedHooksOnly and noManagedPlugins:
        log("Skipping…")                          # literal (+5394416)
        return
    emitTelemetry("load_plugin_hooks")             # literal (+5394518)
    cloneOrUpdatePlugins()                         # um → aY (+5394395)
    buildHookConfig()                              # um → nFH (+5394401)
    startNewAgentWithHooks()                       # um → Jz6 (+5395417)
    # error handling paths for: network, permissions, parse/JSON/schema errors
```

Analysis basis: CC v2.1.143 bundle.js:+5394395, +5394416, +5394518

---

### 7. New Agent Loop Start — `Jz6` / `L2`

Once all state is cleared and hooks are loaded, a new agent loop is started for the fresh session.

```
async function startNewAgentLoop(sessionName):
    buildInitialContext()               # Jz6 → L4 (+12226072)
    loop = createAgentLoop()            # Jz6 → L2 (+12226153)
    loop.sessionId = randomUUID()       # Jz6 → p28.randomUUID (+12226179)
    await loop.run()
```

Analysis basis: CC v2.1.143 bundle.js:+12226072, +12226153, +12226179

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_cache_eviction_hint` | Fired when the session is backgrounded; signals lightweight clear path (bundle.js:+10098749) |
| Telemetry — `tengu_run_hook` | Fired during hook execution within the new session setup (bundle.js:+12272534) |
| Telemetry — `tengu_feature_ok` / `tengu_feature_bad` | Fired on successful / failed feature gate checks during reset (bundle.js:+955068, +955126) |
| Telemetry — `tengu_repl_hook_finished` | Fired after REPL hook completes on new session (bundle.js:+12256704) |
| Telemetry — `tengu_session_renamed` | Fired when a custom name is applied to the new session (bundle.js:+12141118) |
| Telemetry — `tengu_shell_set_cwd` | Fired if working directory is re-applied during reset (bundle.js:+8556995) |
| Telemetry — `tengu_hook_plugin_injected` | Fired when a plugin hook is injected into the new session (bundle.js:+12270880) |
| Event — `conversation_clear` | Emitted to signal the old session is persisted to disk (bundle.js:+10098784) |
| Event — `conversation_reset` | Emitted to signal the new session has started (bundle.js:+10099841) |
| Event — `SessionEnd` | Broadcast via the session event bus at close of the old session (literal `"SessionEnd"` bundle.js:+12226761) |
| AbortController cleared | Any in-flight agent abort controller is cleared before the new loop starts (bundle.js:+10099353, +10099389) |
| All in-memory caches cleared | Conversation store, prompt cache, vector store, Jupyter kernel cache, hook queue, editor annotations, etc. (bundle.js:+10097639–+10097925) |
| MCP servers restarted | All configured MCP servers are re-enumerated and reconnected (bundle.js:+10098929) |
| Plugin hooks reloaded | Plugin hook configuration is rebuilt and re-injected (bundle.js:+10100222) |
| Disk persistence | Previous session JSONL transcript remains on disk; no deletion occurs |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.143 | Initial analysis |

---

## Common Mistakes

1. **Expecting the old context to be gone permanently.** `/clear` only removes the conversation from the active in-memory window. The prior session is persisted to disk and remains resumable via `/resume`.
2. **Using `/clear` to rename the current session.** The optional `[name]` argument names the *new* session that is created, not the session being discarded.
3. **Assuming backgrounded and foreground clears are equivalent.** When the session is backgrounded (`isBackgrounded` flag), only a lightweight eviction path runs; a full state reset is skipped.
4. **Invoking `/clear` when a long-running tool is active.** The command aborts the active `AbortController` (bundle.js:+10099389). Any in-flight tool call will be cancelled without waiting for completion.
5. **Relying on MCP tool availability immediately after `/clear`.** MCP servers are reconnected asynchronously. There may be a brief window where MCP tools are unavailable in the new session.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `oO7` | Main async handler for `/clear` (Arbor-resolved entry point) |
| `m26` | Core session-reset orchestrator |
| `U26` | Context-window metrics calculator |
| `aY` | Policy-settings reader |
| `I8` | Internal state accessor |
| `mU` | Base context-window value provider |
| `Qg` | Adjusted context-window value provider |
| `Lw_` | Window-value helper |
| `nvH` | Session-end event emitter / pre-clear setup |
| `L4` | Initial context builder for new agent loop |
| `V6` | State-value getter (shared utility) |
| `Yy` | Secondary state-value getter |
| `QX` | Effort / model-selection helper |
| `sE` | Effort threshold evaluator |
| `QZ` | Context-query builder |
| `S6` | Session log appender |
| `j2` | Agent-loop runner |
| `xH` | String coercion utility |
| `bm` | Message builder |
| `v` | Debug-mode / verbosity checker |
| `_4H` | Hook-type evaluator |
| `cQ_` | Hook configuration resolver |
| `O` | Generic collection filter/map helper |
| `GSq` | Hook-group selector |
| `dQ_` | Third-party hook filter |
| `TSq` | Hook timeout selector |
| `d` | Low-level logger |
| `hH` | JSON serialiser wrapper |
| `NH` | Error-logging helper |
| `mH` | Message-state helper |
| `cPH` | Compact-phase helper |
| `SZ` | Abort-signal/timeout manager |
| `j` | Hook callback dispatcher |
| `d6H` | Date/time formatter |
| `hh` | Hook-output formatter |
| `g28` | Hook-result aggregator |
| `QQ_` | MCP tool result handler |
| `c28` | Hook JSON-output parser |
| `gQ_` | HTTP hook executor |
| `WSq` | HTTP hook response parser |
| `mLH` | Hook metadata logger |
| `l28` | Shell hook spawner |
| `SH` | State-history helper |
| `Wj6` | Session-end broadcaster |
| `ieH` | Cache eviction hint emitter |
| `M` | MCP server manager |
| `SvH` | MCP server initialiser / reconnector |
| `KHH` | MCP server config mapper |
| `rI` | MCP credential resolver |
| `K` | MCP server list helper |
| `H_` | MCP server state helper |
| `f26` | MCP server filter helper |
| `_57` | MCP connection timestamp tracker |
| `v78` | MCP tool registry builder |
| `I78` | MCP tool type inspector |
| `A8` | MCP debug logger |
| `Yh_` | OAuth MCP flow initiator |
| `Dh_` | OAuth callback handler |
| `x8q` | MCP health-check helper |
| `Oh_` | MCP tool permission checker |
| `NG_` | MCP server filter (by include list) |
| `J` | Process manager / MCP process list |
| `y` | Background process writer |
| `_7` | MCP error logger |
| `XH` | String error formatter |
| `S8q` | MCP status poller |
| `M26` | MCP retry-count parser |
| `xh_` | MCP backoff-interval parser |
| `THK` | MCP update applicator |
| `eY8` | MCP update event emitter |
| `wv` | MCP cleanup helper |
| `L` | Session / file manager |
| `q` | Temporary file unlinker |
| `f` | File handle wrapper |
| `$` | Background session factory |
| `JZq` | Background session init helper |
| `B95` | MCP full-reconnect orchestrator |
| `k78` | MCP connection-state checker |
| `r8` | Retry scheduler |
| `drH` | MCP disconnect logger |
| `Rj` | Running-state guard |
| `w` | Daemon/background-worker manager |
| `C` | Worker process controller |
| `Z_K` | Worker filesystem resolver |
| `MK5` | Worker socket path builder |
| `z` | Worker output stream |
| `IG6` | Low-memory monitor |
| `G6` | Memory-event dispatcher |
| `x` | Worker retirement manager |
| `Oo_` | Spare-worker claimer |
| `Gd_` | Spare-worker directory creator |
| `uq5` | Claim-send timeout handler |
| `xq5` | Claim frame builder |
| `L8` | Generic async retry helper |
| `mp` | Binary message framer |
| `jo_` | Worker lifecycle manager |
| `IK` | Worker socket path builder |
| `s1` | Session roster reader |
| `rw` | Active-session state setter |
| `Bf` | Session file writer |
| `SoH` | Session health-probe runner |
| `wLH` | Worker log-path resolver |
| `Bk` | Worker log reader |
| `gp` | Worker state-file reader |
| `zW6` | Worker state-file writer |
| `D` | Daemon lifecycle controller |
| `$o_` | Spare-worker spawner |
| `iD` | In-progress guard |
| `nC_` | Full in-memory state reset orchestrator |
| `gC_` | Conversation-store clearer |
| `rHH` | Rendered-hook-data clearer |
| `zi9` | Prompt-cache clearer |
| `RTH` | Cache-directory writer |
| `YH6` | Session-hook resetter |
| `sn` | Multi-slice state resetter |
| `T1H` | Main-thread state resetter |
| `K98` | Post-compact state clearer |
| `F$6` | Feature-flag resetter |
| `Pe` | Compact-state pair resetter |
| `$98` | Cache-set clearer (lAq) |
| `rq1` | Context-query cache clearer |
| `CK1` | Token-counter resetter |
| `an` | Autonomous-loop counter resetter |
| `tj` | Output-token counter resetter |
| `JrH` | Vector-store cache clearer |
| `ZS1` | Session-store clearer |
| `yq1` | Context-query cache clearer (secondary) |
| `Nu8` | History cache clearer |
| `md9` | Diagnostics cache clearer |
| `$41` | Editor-annotation cache clearer |
| `$I8` | Internal-flag store clearer |
| `Ju8` | Jupyter kernel cache clearer |
| `hHq` | Hook-queue clearer |
| `E11` | Event-emitter state clearer |
| `fD` | Working-directory resolver |
| `x6` | Path existence checker |
| `$8` | Async error wrapper |
| `Px8` | CWD store accessor |
| `y8H` | Path normaliser |
| `__` | Global-variable accessor |
| `UTH` | UI teardown helper |
| `QI` | Quit-signal inspector |
| `zz` | Stream-flush manager |
| `R28` | Async-set tracker |
| `SdH` | Shell-daemon helper |
| `OD1` | CLI-mode checker |
| `Qqq` | Queue-drain helper |
| `g3` | New-agent-loop launcher |
| `KL` | Agent-loop factory |
| `h9` | Finaliser registration helper |
| `Ip` | Interrupt-policy reader |
| `g5` | Context-path builder |
| `CU` | Config-directory resolver |
| `p26` | Pre-loop setup runner |
| `NZ8` | Session-created event emitter |
| `rQ` | Request-quota checker |
| `Ub` | Session-rename handler |
| `H4H` | Synchronous log appender |
| `rIH` | Symlink/task-dir creator |
| `xQ_` | Tasks-directory initialiser |
| `AiH` | Task-path builder |
| `S$` | Task-symlink creator |
| `Kf8` | Task-log file opener |
| `_T` | Subagent path builder |
| `Wf` | Worktree-state initialiser |
| `rf` | Isolation-latch checker |
| `pb` | Worktree-state writer |
| `$6H` | Isolation-latch writer |
| `Oyq` | Async log appender |
| `um` | Plugin-hook loader |
| `TK` | String formatter (hooks) |
| `nFH` | Hook-config builder |
| `sRH` | Plugin-clone runner |
| `T8` | Synchronous file log writer |
| `Jz6` | Agent-loop launcher with hooks |
| `L2` | Full agent-loop implementation |
| `L9` | Session-UUID generator |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.