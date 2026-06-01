---
type: feature-spec
feature: "clear"
cc_version: "2.1.147"
updated: "2026-06-01"
tags: ["clear", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.147 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/clear`

> Analysis basis: CC v2.1.147 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.147

---

## Overview

`/clear` (also accessible as `/reset` and `/new`) starts a fresh Claude Code session by discarding the current in-memory conversation context while leaving the previous session file intact on disk. The previous session remains resumable via `/resume`. An optional `[name]` argument can be provided to label the new session.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `clear` |
| description | `Start a new session with empty context; previous session stays on disk (resumable with /resume)` |
| aliases | `reset`, `new` |
| argumentHint | `[name]` |
| supportsNonInteractive | `true` |
| thinClientDispatch | `post-text` |
| module_id | `CO1` |
| load_inline | `true` |
| loc_byte | `10532508` |
| loc_byte_end | `10532799` |
| loc_line | `8340` |
| arbor_handler.name | `sT7` |
| arbor_handler.fqn | `claude-2.1.147::sT7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.147 bundle.js:+10532508

---

## Input Branching

The handler has three meaningful input/state paths: (1) argument provided vs. absent, (2) backgrounded session vs. foreground session, and (3) cache-eviction hint emission. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/clear [name] invoked"] --> B["Trim argument string\n(H.trim @ +10532334)"]
    B --> C{Argument present\nafter trim?}
    C -- "yes" --> D["Use trimmed string\nas new session name"]
    C -- "no" --> E["New session name = undefined/empty\n(literal 0 @ +10532349)"]
    D --> F["Call session-reset routine\n(mG6 @ +10532370)"]
    E --> F

    F --> G["Emit cache-eviction hint\n(tengu_cache_eviction_hint @ +10530615)\nwith telemetry key 'conversation_clear'\n(literal @ +10530650)"]
    G --> H{Session is\nbackgrounded?\n(isBackgrounded @ +10530718)}
    H -- "yes" --> I["Skip certain foreground teardown\nbranches; continue reset flow"]
    H -- "no" --> J["Full foreground teardown path"]
    I --> K["Abort running requests\n/ clear abort controllers"]
    J --> K
    K --> L["Clear in-memory\nconversation state\n(_.clear @ +10530931)"]
    L --> M["Re-initialise session ID\n(hO1.randomUUID @ +10531772)"]
    M --> N["Emit 'conversation_reset'\ntelemetry\n(literal @ +10531733)"]
    N --> O["Reset UI / hook state\nbU_ wide-cache-clear\n(@ +10530913)"]
    O --> P["Re-register hooks /\nre-initialise MCP connections\n(QI8 @ +10531790)"]
    P --> Q["Return new empty session\nto caller; display cleared REPL"]
```

---

## Behavioral Spec

### 1. Entry Point — Handler `sT7`

Analysis basis: CC v2.1.147 bundle.js:+10532334

```
async function handleClear(rawArgument, appContext):
    sessionName = rawArgument.trim()          // H.trim @ +10532334
    if sessionName == "":
        sessionName = null                    // literal 0 @ +10532349

    await performSessionReset(sessionName, appContext)   // mG6 @ +10532370
    return                                   // no return value to caller
```

### 2. Session-Reset Orchestrator (`mG6`)

Analysis basis: CC v2.1.147 bundle.js:+10530511

```
async function performSessionReset(newName, appContext):
    // 1. Snapshot context-window token counts for bookkeeping
    tokenStats = computeContextWindowStats(appContext)   // UG6 @ +10530511

    // 2. Abort any in-flight agent request
    abortRunningRequests(appContext)                     // rkH @ +10530523

    // 3. Obtain a fresh AbortSignal with timeout
    signal = AbortSignal.timeout(...)                   // @ +10530571

    // 4. Emit cache-eviction telemetry hint
    emitTelemetry("tengu_cache_eviction_hint", {        // Y86 @ +10530602
        event: "conversation_clear"                     // literal @ +10530650
    })

    // 5. Check backgrounded flag
    isBackground = appContext["isBackgrounded"]         // literal @ +10530718

    // 6. Propagate session values / object-values iteration
    for each value in Object.values(appContext):        // @ +10530781
        applySessionTransition(value)                   // L @ +10530795

    // 7. Kill any still-running child processes
    killStaleProcesses(appContext)                      // w @ +10530810

    // 8. Prepare new session name
    resolvedName = resolveWorkingDirectory(newName)     // wP @ +10530827

    // 9. Register new session entry
    addNewSessionEntry(resolvedName)                    // Y.add @ +10530833
    pushSessionToHistory(resolvedName)                  // D.push @ +10530850

    // 10. Queue wide-cache clear
    clearAllCaches()                                    // bU_ @ +10530913

    // 11. Resolve CWD and validate it
    validateWorkingDirectory(appContext)                // rD @ +10530922

    // 12. Clear in-memory conversation messages
    appContext.messages.clear()                         // _.clear @ +10530931

    // 13. Re-key on Object.keys for any remaining state
    for key in Object.keys(appContext):                 // @ +10530956
        applyKeyedReset(key)                            // hEH @ +10530997

    // 14. Flush pending stream/display items
    flushDisplayQueue(appContext)                       // M @ +10531038

    // 15. Re-enumerate entries
    for [k,v] in Object.entries(appContext):            // @ +10531070
        applyEntryReset(k, v)                           // EN @ +10531153

    // 16. Clear pending timers
    clearTimeout(...)                                   // @ +10531231

    // 17. Flush output queue
    flushOutput(appContext)                             // RH @ +10531326

    // 18. Flush pending analytics batch
    flushAnalyticsBatch(appContext)                     // _O @ +10531332

    // 19. Flush display cache
    flushDisplayCache(appContext)                       // fcH @ +10531370

    // 20. Re-register tool definitions
    reRegisterTools(appContext)                         // RO1 @ +10531663

    // 21. Re-render conversation view
    reRenderConversationUI(appContext)                  // CO @ +10531675

    // 22. Compose new empty context header
    buildNewContextHeader(appContext)                   // zR @ +10531695

    // 23. Compose context modifiers
    buildContextModifiers(appContext)                   // XM @ +10531701

    // 24. Attach plugin/hook pipeline
    attachPluginHooks(appContext)                       // pG6 @ +10531716

    // 25. Mint new session UUID
    newSessionId = hO1.randomUUID()                     // @ +10531772

    // 26. Emit session-reset event to subscribers
    emitSessionResetEvent(newSessionId)                 // QI8 @ +10531790

    // 27. Emit conversation_reset telemetry
    emitTelemetry("conversation_reset", {...})          // literal @ +10531733

    // 28. Attach debug/logging hooks
    attachLoggingHooks(appContext)                      // od @ +10531903

    // 29. Attach context-window hooks
    attachContextWindowHooks(appContext)                // cx @ +10531916

    // 30. Attach notification hooks
    attachNotificationHooks(appContext)                 // nIH @ +10532023

    // 31. Attach file-event hooks
    attachFileEventHooks(appContext)                    // fE @ +10532032

    // 32. Attach metric hooks
    attachMetricHooks(appContext)                       // nM @ +10532035

    // 33. Attach Nf hook
    attachNfHook(appContext)                            // Nf @ +10532057

    // 34. Initialise mx hook (worktree-state)
    initWorktreeStateHook(appContext)                   // mx @ +10532067

    // 35. Initialise k8H hook (isolation-latch)
    initIsolationLatchHook(appContext)                  // k8H @ +10532087

    // 36. Load plugin hooks
    loadPluginHooks(appContext)                         // $U @ +10532114
```

### 3. Context-Window Token-Stats (`UG6`)

Analysis basis: CC v2.1.147 bundle.js:+12733912

```
function computeContextWindowStats(appContext):
    rawValue  = parseInt(appContext.contextLimit, 10)   // @ +12733912
    isValid   = Number.isFinite(rawValue)               // @ +12733934
    baseline  = resolveBaselineTokens(appContext)       // BY @ +12733977
    current   = getCurrentTokenUsage(appContext)        // hu @ +12733985
    delta     = computeDelta(current, baseline)         // dm @ +12734012
    clamped   = Math.max(0, Math.min(delta, 1000))      // @ +12734130, +12734143
    // 1000 is the upper clamp constant (literal @ +12734099)
    return clamped
```

Constant: upper clamp on context delta = **1000 tokens** (bundle.js:+12734099).

### 4. Abort Running Requests (`rkH`)

Analysis basis: CC v2.1.147 bundle.js:+12724610

```
function abortRunningRequests(appContext):
    sessionEndEvent = "SessionEnd"                    // literal @ +12724637
    buildSessionEndPayload(appContext)                 // hL @ +12724610
    sendAbortSignal(sessionEndEvent)                  // e2 @ +12724668
    markSessionHeadNode(appContext)                   // h6 @ +12724865
    notifyInternalNodes(appContext)                   // iNH @ +12724870
```

### 5. Wide-Cache Clear (`bU_`)

Analysis basis: CC v2.1.147 bundle.js:+10529554

This routine clears every in-process cache store when a new session starts. Key sub-operations in traversal order:

```
function clearAllCaches(appContext):
    clearSkillIndexCache()          // yU_ / gHH.clearSkillIndexCache @ +10529554
    flushQueryCache()               // qo @ +10529562
    clearPendingWorkQueue()         // iwq / Up.clear @ +10529570
    clearPostCompactStore()         // b86 @ +10529579
    resetSessionStore($o)           // $o @ +10529589
      resetSubagentStateMap()       //   Vj8
      clearCompactState()           //   kz6
      clearK8HStore()               //   K8H
      clearR51Cache()               //   kj8 / R51.clear @ +10160316
      clearDelayQueues()            //   mJq / nD6.clear + t2_.clear
      clearTxqState()               //   Txq
      clearWHState()                //   $wH
      resetAutonomousLoopDelivered()//   SY7.resetAutonomousLoopDelivered @ +9759046
      clearPwOutputTokens()         //   Pw / _RH
      clearEbStore()                //   eb_
    clearKHStore()                  // _kH / Pw8.clear @ +9470523
    clearCompactStore2()            // kz6 (second reference)
    clearNHCache()                  // Gcq / eNH.clear + ek_.clear @ +8523446
    clearYxqCache()                 // Yxq / PiH.clear + YP6.clear @ +7827330
    clearTbHCache()                 // eB8 / tbH.clear @ +1057460
    clearMl9Cache()                 // ml9
    clearO18Cache()                 // Rwq / o18.clear @ +6418236
    clearHy8State()                 // hy8
    clearSbHCache()                 // gB8 / sbH.clear @ +1050238
    clearUq1State()                 // uq1
    clearJwHCache()                 // jmq / hr.clear + JwH.clear @ +7899381
    // remaining vk_, q, BD8, ZX, FdH entries follow similar pattern
```

### 6. Plugin-Hooks Loader (`$U`)

Analysis basis: CC v2.1.147 bundle.js:+8526559

```
async function loadPluginHooks(appContext):
    // Check policy settings
    policyKey = "policySettings"                     // literal @ +3207221
    policy    = getPolicySetting(policyKey)          // cK / BY @ +8526559

    if allowManagedHooksOnly and no managed plugins:
        log("Skipping plugin hooks - allowManagedHooksOnly is enabled and no managed plugins")
        // literal @ +8526616
        return

    emitTelemetry("load_plugin_hooks", {...})        // literal @ +8526718

    try:
        cloneOrFetchPlugins(appContext)
    catch networkError (ETIMEDOUT | ENOTFOUND):      // literals @ +8526876, +8526901
        log("Failed to clone")                       // literal @ +8526822
        log("This appears to be a network issue...")
    catch permissionError (EACCES | EPERM):          // literals @ +8527052, +8527074
        log("This appears to be a permissions issue...")
    catch parseOrSchemaError (Invalid | JSON | schema): // literals @ +8527191, +8527235, +8527255
        log("This appears to be a configuration issue...")

    buildHookLists(appContext)                       // CX6 @ +8527618
    // push to L, M, f lists                        // @ +8527661, +8527734, +8527854
    attachAdditionalContextHooks(appContext)         // Guq @ +8527892
    attachW9Hook(appContext)                         // W9 @ +8527920
    emitTelemetry("hook_additional_context", {...}) // literal @ +8527929
```

### 7. Session-End Event Pipeline (`e2`)

Analysis basis: CC v2.1.147 bundle.js:+12772326

`e2` is the main agent-loop turn coordinator, reached via the abort path. On `/clear` it is called to flush and terminate the running turn:

```
async function flushAndEndSession(sessionEndPayload):
    sessionId      = UH(sessionEndPayload)              // @ +12772326
    modelMetadata  = buildModelMetadata(Qm)             // @ +12772415
    normalizedModel = normalizeModelName(N)             // @ +12772427
    contextHeaders  = buildContextHeaders(k7H)          // @ +12772503
    baseUrl         = resolveBaseUrl(H)                 // @ +12772592
    nodeType        = resolveNodeType(h6)               // @ +12772605
    hookPayload     = buildHookPayload(Ho_)             // @ +12772618
    filteredMessages = filterMessages(O.filter)         // @ +12772685
    buildFB1Payload(FB1)                                // @ +12772700
    filterPluginErrors(er_)                             // @ +12772729
    buildQB1Payload(QB1)                                // @ +12772738
    checkCancelled(c)                                   // @ +12772745
    serializeContext(CH)                                // @ +12772812 → JSON.stringify
    emitToRH(RH)                                        // @ +12772885
    readMH(mH)                                          // @ +12772891
    readC2H(C2H)                                        // @ +12772894
    buildOutputMap(O.map)                               // @ +12772943
    abortSignalController = iZ(...)                     // @ +12773083
    newTurnUUID = MhH.randomUUID()                      // @ +12773113
    invokeCallback(J.callback)                          // @ +12773138
    dispatchWorktreeCreateEvent("WorktreeCreate")       // literal @ +12773315
    blockingGuard("block")                              // literal @ +12773471
    // ... hook pipeline continues through oT8, ar_, eT8, O8H, or_, BB1 ...
    runHookExecution(HE8)                               // @ +12776413
    notifyWNH(WNH)                                      // @ +12776425
    await Promise.all([...])                            // @ +12777433
    applyBhState(bH)                                    // @ +12777471
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_cache_eviction_hint` | Fired at session-clear time with key `conversation_clear` (bundle.js:+10530615, +10530650) |
| Telemetry — `tengu_run_hook` | Fired for every hook invocation during teardown/re-init (bundle.js:+12772747) |
| Telemetry — `tengu_feature_bad` | Fired on hook or feature failure (bundle.js:+960887) |
| Telemetry — `tengu_feature_ok` | Fired on successful hook or feature execution (bundle.js:+960829) |
| Telemetry — `tengu_hook_plugin_metrics` | Fired with plugin hook timing data (bundle.js:+12751418) |
| Telemetry — `tengu_repl_hook_finished` | Fired when a REPL hook completes (bundle.js:+12756826) |
| Telemetry — `tengu_hook_plugin_injected` | Fired when a plugin hook is injected into session (bundle.js:+12771093) |
| Telemetry — `tengu_session_renamed` | Fired if the new session receives an explicit name argument (bundle.js:+12637168) |
| Telemetry — `tengu_shell_set_cwd` | Fired when CWD is validated/set during session reset (bundle.js:+7885680) |
| Telemetry — `tengu_daemon_control` | Fired for background daemon lifecycle events (bundle.js:+15153889) |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Fired if a stale process requires SIGKILL escalation (bundle.js:+15117797) |
| Conversation messages | Cleared from in-memory store (`_.clear` @ bundle.js:+10530931); prior session persisted on disk |
| Session UUID | New UUID minted via `hO1.randomUUID` (bundle.js:+10531772) |
| Hook registration | Hooks are fully torn down and re-registered: logging, context-window, notification, file-event, metric, worktree-state, isolation-latch, and plugin hooks |
| MCP connections | MCP client connections are iterated and potentially restarted via `_D5` / `EkH` / `k7K` pipeline (bundle.js:+14845013) |
| In-flight requests | Any running agent turn is aborted via `rkH` → `e2` before the reset (bundle.js:+10530523) |
| Wide-cache stores | All in-process caches (skill index, compact state, query cache, work queues, delay queues, token-output maps, etc.) are cleared via `bU_` (bundle.js:+10530913) |
| Pending timers | `clearTimeout` called to cancel any active timeout (bundle.js:+10531231) |
| appState changes | `isBackgrounded` flag consulted (literal @ bundle.js:+10530718); session name optionally updated; session history appended |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Disk | Previous session file is **not** deleted; new session directory created via `So_` / `D_H.mkdir` + `D_H.writeFile` pipeline when the session is persisted (bundle.js:+12918623, +12918670) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.147 | Initial analysis |

---

## Common Mistakes

1. **Expecting the previous session to be deleted** — `/clear` intentionally preserves the previous session on disk; use `/resume` to return to it. The in-memory context is discarded, but the JSONL transcript file is not removed.
2. **Using `/clear` to force an MCP reconnect** — While `/clear` does iterate MCP connections and may restart failed ones, it is not a dedicated reconnect command; use `/mcp` for targeted MCP management.
3. **Passing a multi-word name without quoting** — The `[name]` argument is taken as-is after trimming; no shell-style quoting is applied at the handler level. Ensure the calling environment passes the full name as a single token.
4. **Expecting immediate disk persistence** — The wide-cache clear and in-memory reset are synchronous, but the new session directory write (`D_H.writeFile`) runs asynchronously; do not assume disk state is settled immediately after the command returns.
5. **Confusing `/reset` and `/new` with separate features** — Both are registered aliases for `/clear` and exhibit identical behaviour (registration aliases @ bundle.js:+10532508).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `sT7` | Main async handler for `/clear` command (Arbor-resolved entry point) |
| `H` | Generic helper / utility reference (context-dependent, appears in multiple call sites) |
| `mG6` | Session-reset orchestrator; coordinates all teardown and re-init steps |
| `UG6` | Context-window token-stats calculator (parseInt + clamp) |
| `BY` | Baseline-token resolver (reads `policySettings`) |
| `m8` | Policy-settings accessor |
| `hu` | Current-token-usage reader |
| `oV` | Low-level state accessor |
| `dm` | Token-delta calculator |
| `PL_` | Delta pipeline helper |
| `rkH` | Abort-running-requests coordinator; emits `SessionEnd` |
| `hL` | Session-end payload builder |
| `h6` | Node-type resolver |
| `Ah` | Internal state node accessor |
| `Z2` | Effort / model-family resolver (checks `claude-3-`, `claude-opus-4-*`, etc.) |
| `EZ` | High-effort path resolver |
| `JV` | Context-header builder |
| `b6` | Context-suffix builder |
| `e2` | Agent-loop turn coordinator / flush-and-end-session |
| `UH` | Session-ID stringifier |
| `Qm` | Model-metadata builder |
| `N` | Model-name normaliser |
| `k7H` | Context-header assembler |
| `Ho_` | Hook payload builder (enumerates hook types) |
| `O` | Message-array reference |
| `FB1` | Filtered-message payload builder |
| `er_` | Plugin-error filter |
| `QB1` | Secondary payload builder |
| `c` | Cancellation / abort-check helper |
| `CH` | JSON serialisation helper |
| `RH` | Output-queue emitter / logger |
| `mH` | App-state reader |
| `C2H` | Secondary app-state reader |
| `iZ` | Abort-signal / timeout controller |
| `J` | Callback dispatcher |
| `Y_H` | Yield helper |
| `SV` | Stream-view helper |
| `oT8` | Pre-hook-execution setup |
| `ar_` | MCP-tool-result hook handler |
| `eT8` | Hook-output JSON parser |
| `O8H` | Hook-entry transformer |
| `or_` | HTTP hook executor |
| `BB1` | HTTP-body parser for hooks |
| `O7H` | Hook output-object resolver |
| `HE8` | Shell/spawn hook executor |
| `WNH` | Post-hook notification dispatcher |
| `bH` | App-state writer |
| `iNH` | Internal-node notifier |
| `Y86` | Cache-eviction telemetry emitter |
| `L` | Session-lifecycle manager (add / finally / delete) |
| `q` | File-unlink / close helper |
| `M` | Connection / stream manager |
| `A` | Process / stream reference |
| `w` | Running-process kill coordinator |
| `C` | Child-process wrapper |
| `SfK` | Realpath + stat helper |
| `Az` | Process-state accessor |
| `Nj5` | LY8 path builder |
| `z` | Write-stream wrapper |
| `sG8` | Memory-threshold checker |
| `V6` | Token-usage tracker / cache writer |
| `T$6` | Pins-file reader |
| `M$_` | Pins-file path builder |
| `B6` | JSON-parse helper |
| `_` | Generic iterable / array reference |
| `J8` | ENOENT-aware file helper |
| `v9L` | Directory-recursive reader |
| `g` | Retired-session filter |
| `oH` | Session-filter helper |
| `vH` | Orphaned-permission detector |
| `v6A` | New-session spawner (Bun.spawn path) |
| `So_` | Session-directory writer (mkdir + writeFile) |
| `tw5` | Send-claim timeout handler |
| `sw5` | Claim-frame builder |
| `q8` | Error-code checker |
| `ZH` | String-coercion helper |
| `bU` | Binary-protocol frame builder (Buffer ops) |
| `S6A` | Session-lifecycle full orchestrator |
| `K` | Column formatter |
| `RK` | Session-directory path resolver |
| `dq` | Session-stat / cache reader |
| `bw` | Active-session tracker |
| `h5` | Session-path CH helper |
| `gsH` | Background-session health checker |
| `QLH` | Session-log path builder |
| `Ny` | Session-name split helper |
| `UU` | Session-qF_ path builder |
| `zT6` | Session-directory MF_ builder |
| `Y` | Session-config manager (stop / updateConfig / start) |
| `D` | Spare-pool orchestrator |
| `$` | Dispose-and-ZC1 helper |
| `V6A` | Background spare-session spawner |
| `S` | Dispose helper |
| `wP` | Working-directory resolver for new session name |
| `Qw` | Session-push helper |
| `bU_` | Wide-cache-clear coordinator |
| `yU_` | Skill-index-cache pre-clear helper |
| `qo` | Query-cache flush coordinator |
| `gHH` | Skill-index FF_ + clearSkillIndexCache caller |
| `Vw8` | Vw8 sub-cache flush |
| `gA1` | gA1 sub-cache flush |
| `tw8` | tw8 sub-cache flush |
| `iwq` | Pending-work-queue clear (Up.clear) |
| `gVH` | gVH store writer (Bwq / Fwq / mkdir / writeFile) |
| `b86` | Post-compact store clear |
| `$o` | Session-store reset coordinator |
| `ZZH` | ZZH / a1H state reset |
| `Vj8` | Subagent-state-map clearer (Fx.get / Fx.delete) |
| `kz6` | Compact-state clearer (HE) |
| `K8H` | K8H store clearer (by8 / Qy8) |
| `kj8` | R51 cache clearer |
| `mJq` | Delay-queue clearer (nD6.clear + t2_.clear) |
| `Txq` | Txq-state clearer |
| `$wH` | $wH-state clearer |
| `Pw` | Output-token map clearer (_RH + Object.values) |
| `eb_` | eb_ store reset |
| `_kH` | Pw8 cache clearer |
| `Gcq` | eNH + ek_ cache clearer |
| `Yxq` | PiH + YP6 cache clearer |
| `eB8` | tbH cache clearer |
| `ml9` | ml9 cache clearer |
| `Rwq` | o18 cache clearer |
| `hy8` | hy8 state clearer |
| `gB8` | sbH cache clearer |
| `uq1` | uq1 state clearer |
| `jmq` | hr + JwH cache clearer |
| `rD` | CWD resolver and validator |
| `F6` | File-existence checker |
| `QU8` | CWD normaliser (ab6.getStore + H.normalize) |
| `e_H` | Path normalise helper |
| `w_` | oV-backed state writer |
| `hEH` | Keyed-reset applier |
| `EN` | Entry-reset applier |
| `_O` | Analytics-batch flusher (BT8 / pT8) |
| `BT8` | FU1 add/finally/delete wrapper |
| `fcH` | Display-cache flusher (V5q) |
| `V5q` | V5q display-cache inner impl |
| `RO1` | Tool-definition re-registrar (S5H) |
| `S5H` | S5H tool store |
| `CO` | Conversation-view re-renderer |
| `v4` | View-node factory |
| `r9` | D9A.register wrapper |
| `zR` | Context-header composer |
| `XM` | Context-modifier builder (sy / AO / w_ / aYH.join) |
| `sy` | oV-backed state reader |
| `pG6` | Plugin/hook pipeline attacher |
| `QI8` | Session-reset event emitter (randomUUID + FI6.emit) |
| `od` | Debug/logging hook attacher |
| `cx` | Context-window hook attacher |
| `I7H` | File-append log writer (appendFileSync / mkdirSync) |
| `nIH` | Notification hook attacher (symlink / unlink / open) |
| `Qr_` | Task-directory mkdir helper |
| `yiH` | Task-path builder (Fr_.join + mT8) |
| `A3` | Alternate task-path builder |
| `IrH` | IrH inner notification hook (BT8 / Qr_ / A3 / open) |
| `fE` | File-event hook attacher |
| `nM` | Metric hook attacher |
| `Nf` | Nf hook attacher |
| `mx` | Worktree-state hook initialiser |
| `k8H` | Isolation-latch hook initialiser |
| `EU1` | Async file-append log writer (HL.appendFile / HL.mkdir) |
| `$U` | Plugin-hooks loader (clone / validate / build lists) |
| `cK` | UH-backed policy-key reader |
| `zTH` | Policy-settings entry iterator |
| `abH` | Plugin-load timing logger |
| `C8` | Sync file-append logger |
| `CX6` | Hook-list builder (hL + l2 + lT8.randomUUID) |
| `l2` | Full agent-turn execution coordinator (large function) |
| `f` | MCP server-list reference |
| `EkH` | MCP connection builder (stdio / sse / ws-ide etc.) |
| `k7K` | MCP update applier (applyMcpUpdate / cleanup) |
| `_D5` | MCP server-diff orchestrator |
| `W9` | Session-UUID mint helper (wA1.randomUUID) |

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.