---
type: feature-spec
feature: "clear"
cc_version: "2.1.183"
updated: "2026-06-19"
tags: ["clear", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.183 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/clear`

> Analysis basis: CC v2.1.183 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.183

---

## Overview

`/clear` starts a new Claude Code session with an empty context window, discarding all conversation history from the active session while leaving the previous session persisted on disk for later resumption via `/resume`. It also accepts optional aliases `/reset` and `/new`, and an optional `[name]` argument that names the new session.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `clear` |
| description | `Start a new session with empty context; previous session stays on disk (resumable with /resume)` |
| argumentHint | `[name]` |
| supportsNonInteractive | `true` |
| thinClientDispatch | `post-text` |
| aliases | `reset`, `new` |
| module_id | `Xol` |
| load_inline | `true` |
| loc_byte | `11243950` |
| loc_byte_end | `11244241` |
| loc_line | `6942` |
| arbor_handler.name | `RGp` |
| arbor_handler.fqn | `claude-2.1.183::RGp` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.183 bundle.js:+11243950

---

## Input Branching

There are 3+ distinct paths depending on argument presence, backgrounded state, and cache-eviction conditions.

```mermaid
flowchart TD
    A["/clear [name] invoked"] --> B{Trim argument string}
    B --> C{Argument provided?}
    C -- "No (empty string)" --> D[Use auto-generated session name]
    C -- "Yes" --> E[Use provided name for new session]
    D --> F{Is session backgrounded?\n(isBackgrounded check)}
    E --> F
    F -- "Yes: backgrounded" --> G[Emit tengu_cache_eviction_hint\n+ conversation_clear event\nwith isBackgrounded=true]
    F -- "No: foreground" --> H[Emit conversation_clear event\nwith isBackgrounded=false]
    G --> I[Run full session reset:\nclearCaches, resetState,\nclearHooks, generateNewSessionId]
    H --> I
    I --> J[Fire SessionEnd hook\nto registered hook listeners]
    J --> K[Persist previous session to disk\n(remains resumable via /resume)]
    K --> L[Initialize new empty session\nwith new UUID + optional name]
    L --> M[Emit conversation_reset telemetry]
    M --> N[Return new empty session context]
```

---

## Behavioral Spec

### Handler Entry Point

The handler is the async function `RGp` (resolved via `module_id → Xol`). It accepts an argument string representing an optional session name.

Analysis basis: CC v2.1.183 bundle.js:+11243776

```
async function clearCommandHandler(rawArg):
    trimmedArg = rawArg.trim()                        // +11243776
    sessionName = trimmedArg if len(trimmedArg) > 0 else null

    // Delegate to the full session-clear orchestrator
    result = await performSessionClear(sessionName)
    return result
```

### Session-Clear Orchestrator (`G5t`)

`G5t` is the primary orchestration function called by the handler. It coordinates cache eviction, hook teardown, state reset, and new session initialization.

Analysis basis: CC v2.1.183 bundle.js:+11241632

```
async function performSessionClear(optionalName):
    // 1. Parse and validate optional session label
    sessionLabel = parseSessionLabel(optionalName)        // W5t: parseInt + Number.isFinite, +13589407

    // 2. Emit SessionEnd hook event to all registered hooks
    fireSessionEndEvent()                                // lGe → "SessionEnd" literal, +13579957

    // 3. Emit telemetry for cache eviction hint
    emit("tengu_cache_eviction_hint", {                  // +11241736
        event: "conversation_clear",                     // +11241774
        isBackgrounded: <current backgrounded state>     // +11241847
    })

    // 4. Request a new unique session identifier
    newSessionId = crypto.randomUUID()                   // Kol.randomUUID, +11243094

    // 5. Full application-state reset sequence
    resetAllCaches()                                     // QHo: clears many subsystem caches
    clearHookRegistrations()                             // mH → Szt.clear + ctr.clear, +34016
    clearPolicySettings()                                // eie, +3394639
    resetShellCwd()                                      // wH, +11242051
    clearRunningAbortControllers()                       // i_ + Yzn, +13549351
    clearCompletionCaches()                              // t.clear, +11242060
    clearSubagentState()                                 // hM + Gm, +5217104

    // 6. Emit conversation_reset telemetry
    emit("conversation_reset")                           // literal +11243055

    // 7. Write previous session state to disk (preserves resumability)
    persistCurrentSessionToDisk()                        // ftr → L2o + w2o, +48123

    // 8. Initialise new empty session with optional name
    newSession = initializeNewSession({
        id: newSessionId,
        name: optionalName ?? autoGeneratedName,
        roleType: "normal"                               // literal +11243467
    })

    return newSession
```

### Session-Label Parsing (`W5t`)

`W5t` converts the raw argument string into a validated label, enforcing that it is a finite integer index when numeric.

Analysis basis: CC v2.1.183 bundle.js:+13589407

```
function parseSessionLabel(raw):
    if raw is null:
        return null
    parsed = parseInt(raw, 10)                          // base 10 literal +13589418
    if Number.isFinite(parsed):
        // Clamp to valid range using Math.max / Math.min
        clamped = Math.max(0, Math.min(parsed, 1000))   // limits +13589594
        return clamped
    return raw   // treat as free-form string name
```

### SessionEnd Hook Dispatch (`lGe`)

After the conversation is cleared, a `SessionEnd` hook event is fired to all registered lifecycle hook listeners before any state is destroyed.

Analysis basis: CC v2.1.183 bundle.js:+13579930

```
async function fireSessionEndEvent():
    hookEvent = { type: "SessionEnd" }                  // string literal +13579957
    await dispatchHookEvent(hookEvent)                  // Id → full hook pipeline (cx)
    // cx is the general hook execution engine, handles
    // command / prompt / agent / http / mcp_tool types
```

### Full Cache Reset Orchestration (`QHo`)

`QHo` clears all major subsystem caches atomically. The following subsystems are wiped in sequence:

Analysis basis: CC v2.1.183 bundle.js:+11240591

```
function resetAllCaches():
    clearSkillIndexCache()        // AM → Y5 → e.clearSkillIndexCache, +13436798
    clearConversationState()      // nBi → tW.clear, +5199448
    clearContextCache()           // nne → many subsystem clears
    clearAgentStateCache()        // A5 → s5t.clear, +10980079
    clearSessionRecordCache()     // nRt → Xx, +5059193
    clearPluginMetricsCaches()    // pka → u4e.clear + Ioo.clear, +8519081
    clearWorktreeCache()          // ZDa → Olt.clear + y2t.clear, +8711477
    clearMcpCache()               // dAr → mSe.clear, +1150530
    clearMcpPluginCache()         // fRa → GFn.clear, +8772110
    clearCommandRegistryCache()   // mrr, +64113
    clearToolkitCache()           // tAr → UKe.clear, +1142839
    clearBgSessionCache()         // bYa → o4t, +10483903
    clearConnectionStateCache()   // Ura → Bee.clear + iLe.clear, +6881787

    // Reset autonomous loop delivered counter
    K2p.resetAutonomousLoopDelivered()                  // +10686510

    // Reset output token counters
    resetOutputTokenCounters()    // ry → RWe + Object.values, +50627
```

### Hook Engine Core (`cx`)

The hook execution engine processes `SessionEnd` and all other hook types. Key behaviors:

Analysis basis: CC v2.1.183 bundle.js:+13629208

```
async function executeHook(hookEvent, context):
    // Determine hook type and dispatch appropriately
    hookType = hookEvent.type   // one of the lifecycle literals

    match hookType:
        "command" | "prompt" | "agent":
            result = await runSpawnedHook(hookEvent)     // d7n, +13633292
        "http":
            result = await runHttpHook(hookEvent)        // Lxo, +13632206
        "mcp_tool":
            result = await runMcpToolHook(hookEvent)     // xxo, +13630908
        "callback":
            // function hooks outside REPL context raise error
            raise Error("Internal error: function hook executed outside REPL context")
            // literal +13632097
        else:
            emit_warn("hook_type_unsupported")           // literal +13630709

    // Emit telemetry on completion
    emit("tengu_run_hook", { result })                   // +13629573
    emit("tengu_repl_hook_finished", metrics)            // +13613284

    return result
```

### New Session Initialization (`ftr` + `w2o`)

After the reset, a new session record is created and broadcast.

Analysis basis: CC v2.1.183 bundle.js:+48023

```
function initializeNewSession(config):
    newId = crypto.randomUUID()                         // Dde.randomUUID, +48023
    sessionRecord = buildSessionRecord(newId, config)   // L2o, +48123
    broadcastSessionStarted(sessionRecord)              // w2o → Izt.emit, +48202
    return sessionRecord
```

### Backgrounded-Session Path

When the session is running in a backgrounded context (e.g., daemon or headless), the clear command emits additional telemetry.

Analysis basis: CC v2.1.183 bundle.js:+11241847

```
function buildClearEventPayload(sessionCtx):
    return {
        event: "conversation_clear",                    // +11241774
        isBackgrounded: sessionCtx.isBackgrounded       // +11241847
    }
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_cache_eviction_hint` | Fired with `conversation_clear` + `isBackgrounded` flag (bundle.js:+11241736) |
| Telemetry — `tengu_run_hook` | Fired for each hook dispatched during SessionEnd (bundle.js:+13629573) |
| Telemetry — `tengu_repl_hook_finished` | Fired after each hook completes with timing metrics (bundle.js:+13613284) |
| Telemetry — `tengu_hook_plugin_metrics` | Fired when plugin hook metrics are collected (bundle.js:+13607657) |
| Telemetry — `tengu_feature_ok` / `tengu_feature_bad` | Fired for successful / failed hook feature checks (bundle.js:+1021887, +1021954) |
| Telemetry — `tengu_shell_set_cwd` | Fired when working directory is reset during clear (bundle.js:+7031167) |
| Telemetry — `tengu_session_renamed` | May fire if the new session gets a name different from the previous (bundle.js:+13487017) |
| Hook registration | All hook registrations (`Szt`, `ctr`) are cleared via `mH` (bundle.js:+34016, +34028) |
| Hook lifecycle event | `SessionEnd` hook event is dispatched to all registered listeners before session state is destroyed (bundle.js:+13579957) |
| Policy settings | Policy settings cache (`policySettings`) is cleared via `eie` (bundle.js:+3394669) |
| Shell CWD | Working directory context is reset via `wH` (bundle.js:+7031012) |
| Abort controllers | All running abort controllers are flushed via `i_` → `Yzn` (bundle.js:+13549351) |
| Completion caches | In-memory completion caches (`t.clear`) wiped (bundle.js:+11242060) |
| Conversation state | `tW.clear` wipes the active message store (bundle.js:+5199448) |
| Skill index cache | Cleared via `e.clearSkillIndexCache` (bundle.js:+13436798) |
| Previous session | Persisted to disk; fully resumable with `/resume`. Not deleted. |
| New session UUID | Generated with `crypto.randomUUID()` (bundle.js:+11243094) |
| appState changes | `conversation_reset` literal emitted as state transition event (bundle.js:+11243055) |
| Sound | No sound side-effect found in depth-2 traversal |
| Thin-client dispatch | `post-text` — the result is dispatched as a post-text message in thin-client mode |

---

## Version History

| Version | Change |
|---|---|
| v2.1.183 | Initial analysis |

---

## Common Mistakes

1. **Expecting history to be deleted**: `/clear` does not delete the previous session. It remains on disk and is resumable via `/resume`. Use a dedicated session-delete workflow if permanent removal is intended.
2. **Confusing aliases**: `/reset` and `/new` are exact aliases for `/clear` and share identical behavior. There is no functional distinction between them.
3. **Omitting the name argument**: The optional `[name]` argument names the *new* session, not the old one. Passing a number coerces to a clamped integer index; passing a non-numeric string uses it as a free-form label.
4. **Running in non-interactive mode without expecting hook side effects**: `supportsNonInteractive: true` means `/clear` can be invoked headlessly, but `SessionEnd` hooks still fire — external hook scripts must handle this gracefully.
5. **Assuming instant state destruction**: The clear sequence fires `SessionEnd` hooks *before* wiping caches. Hook scripts that query session state will still see the old context during the hook execution window.
6. **Expecting thinClientDispatch to suppress the response**: `post-text` means the CLI still posts a text response to the thin client after clearing; it does not silently swallow the operation.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `RGp` | Main handler (AsyncFunction) for `/clear` command; entry point resolved via module_id `Xol` |
| `G5t` | Session-clear orchestrator; coordinates all reset sub-steps |
| `W5t` | Session-label parser; validates and clamps numeric session index arguments |
| `ub` | Policy-settings loader called during state reset |
| `Ul` | Config-store accessor (reads/writes CLI config entries) |
| `eie` | Policy-settings cache clearer |
| `KG` | Config-key getter utility |
| `gx` | Generic state-getter primitive used by multiple config accessors |
| `m8` | Hook-state reset coordinator |
| `CUr` | Hook registration cache accessor (get/set) |
| `mH` | Hook store clearer (`Szt.clear`, `ctr.clear`) |
| `vUr` | Hook config re-loader after clear |
| `lGe` | SessionEnd hook dispatcher; fires the `SessionEnd` lifecycle event |
| `Id` | Hook execution router; selects the correct hook handler by type |
| `Lt` | Low-level logger/tracer used throughout |
| `NO` | State-read helper |
| `PC` | Model-string classifier (checks claude-3-*, claude-opus-*, etc.) |
| `jR` | Reasoning-effort setter (`high`) |
| `tD` | Tool-definition builder |
| `Mt` | Message-array builder |
| `cx` | Full hook execution engine (dispatches all hook types) |
| `hB` | Hook context builder |
| `T` | Message/content formatter utility |
| `G_e` | Hook-type classifier |
| `Pxo` | Hook-file loader and plugin hook scanner |
| `Rxo` | Third-party hook filter |
| `Wn` | Hook-watcher initializer |
| `Pe` | JSON serialization helper |
| `De` | Hook error logger |
| `Re` | Feature-bad telemetry emitter |
| `TOe` | Feature-ok telemetry emitter wrapper |
| `wM` | AbortController manager with timeout/clear |
| `uce` | Hook result processor |
| `FP` | Hook worktree context builder |
| `a7n` | Worktree-create hook helper |
| `xxo` | MCP-tool hook executor |
| `u7n` | Hook output parser (JSON vs plain text) |
| `Qce` | Hook plugin metrics aggregator |
| `Lxo` | HTTP hook executor |
| `F1l` | HTTP hook response parser |
| `b_e` | Hook block-mode checker |
| `d7n` | Spawned-process hook executor |
| `u3e` | Hook result merger |
| `ke` | Feature-ok telemetry emitter |
| `F8` | Telemetry event emitter with dedup/throttle |
| `H5e` | Backgrounded-session state accessor |
| `Dgt` | Daemon background-session dispatch helper |
| `Qe` | Event-loop queue wrapper |
| `ogt` | Primitive async scheduler |
| `Ur` | Non-conforming response handler |
| `ey` | Non-conforming async helper |
| `s` | Session-lifecycle set tracker |
| `r` | Session registry set |
| `Fs` | Fatal-error / process-exit handler |
| `i` | Active-session object |
| `n` | Server-connection object |
| `f` | Background-session spawn handler |
| `M` | Daemon session manager |
| `Dtt` | Session-file reader |
| `d` | Daemon write/update dispatcher |
| `CQ` | Config-version checker |
| `CMt` | Session-directory writer |
| `J1i` | Session-file filter |
| `g` | Stream-buffer accumulator |
| `u` | Daemon-control command set |
| `k` | Daemon config-reload handler |
| `h` | Socket connection holder |
| `Jnc` | Background-session summary formatter |
| `fae` | Session-state file manager |
| `Bn` | IPC timeout/retry wrapper |
| `o` | Output padding helper |
| `YKn` | Memory-check helper |
| `ct` | Cache-token budget controller |
| `B$e` | Pinned-files reader |
| `nDt` | Pins-file path builder |
| `Gt` | JSON parse helper |
| `Mn` | ENOENT-safe error wrapper |
| `zAd` | Directory recursive scanner |
| `$` | Permission-decision engine |
| `zlt` | Permission classifier |
| `R6` | Allow/deny/ask decision router |
| `NNo` | Background-session send-claim handler |
| `Nko` | Claim-file writer |
| `f6f` | Claim-send timeout/retry handler |
| `p6f` | Claim frame builder |
| `wp` | Low-level IPC writer |
| `Ee` | String coercion helper |
| `FM` | Binary frame encoder (uint32BE + uint8) |
| `jNo` | Background-session lifecycle manager |
| `Ic` | Socket-path resolver |
| `fa` | Session-file state tracker |
| `pg` | Session-active-state checker |
| `OCe` | Watch-path deduplicator |
| `Pp` | Session-persistence helper |
| `rft` | Roster-entry finalizer |
| `P6t` | Session-path builder (join + M6t) |
| `e_e` | Session-state extension reader |
| `iD` | Late-session-read handler |
| `BN` | Session-timeout writer |
| `WM` | Late-session-read wrapper |
| `R6t` | Session-root path builder |
| `p` | Forced-shutdown handler |
| `WT` | Shutdown trigger |
| `dn` | Debug-level logger |
| `Ue` | Non-conforming async queue |
| `R` | Permission disposable |
| `od` | Session-object decorator |
| `_E` | Background-session state setter |
| `QHo` | Full cache-reset orchestrator |
| `KHo` | Session-cache-reset pre-step |
| `AM` | Skill-index and model-cache resetter |
| `Y5` | Skill-index cache clearer |
| `dGn` | Diagnostics reset |
| `Ytl` | Tool-list cache clearer |
| `v6e` | o4t-based cache clearer |
| `nBi` | Conversation-state clearer (`tW.clear`) |
| `V2e` | Session-dir writer (mkdir + writeFile) |
| `uHt` | Usage-history cache clearer |
| `nne` | Multi-subsystem context cache clearer |
| `mFe` | Main-agent state resetter |
| `x5n` | Subagent-exit cache clearer |
| `nRt` | Session-start recorder |
| `cHt` | Compact-state clearer |
| `pHt` | Post-compact cleanup hook |
| `T5n` | eQa query-cache clearer |
| `gea` | COt/izr cache clearer |
| `zUa` | zUa-state resetter |
| `f0e` | f0e-state resetter |
| `ry` | Output-token counter resetter |
| `$Ao` | appState change emitter |
| `A5` | s5t cache clearer |
| `pka` | Plugin metric cache clearer (`u4e`, `Ioo`) |
| `ZDa` | Worktree cache clearer (`Olt`, `y2t`) |
| `dAr` | MCP client cache clearer (`mSe`) |
| `Vol` | Vol-cache clearer |
| `fRa` | MCP plugin cache clearer (`GFn`) |
| `mrr` | Command-registry cache checker |
| `tAr` | Toolkit cache clearer (`UKe`) |
| `bYa` | Background-session cache clearer |
| `o4t` | J4n-based cache getter/clearer |
| `Ura` | Connection-state cache clearer (`Bee`, `iLe`) |
| `wH` | Shell CWD resetter |
| `jt` | File-system stat helper |
| `emr` | CWD store reader |
| `AH` | Path normalizer |
| `wre` | CWD validator |
| `Ar` | Logging/tracing sink |
| `B2e` | Session-history state resetter |
| `o0` | In-flight request tracker |
| `i_` | Abort-controller flush coordinator |
| `Yzn` | jOl-set abort-controller tracker |
| `Xot` | waa-based completion cache clearer |
| `fw` | Hook cleanup + Uk trigger |
| `hot` | Hash-based hook watcher |
| `Vwe` | Config hash builder (IQi.createHash sha256) |
| `Uk` | MCP skills telemetry emitter (`tengu_mcp_skills`) |
| `Yol` | sEe-based session event logger |
| `sEe` | Session-event store |
| `mh` | Subagent-list builder |
| `Au` | Append-log writer |
| `qi` | B2o.register hook caller |
| `eO` | Tool-result encoder |
| `Gm` | Context-window path builder |
| `p2` | gx-based state reader |
| `j5t` | Subagent-stop handler |
| `ftr` | New-session record initializer |
| `L2o` | Session-record builder |
| `w2o` | Session-start broadcaster (`Izt.emit`) |
| `Rca` | Session-rename watcher |
| `fX` | Isolation-latch initializer |
| `B6` | Session-rename emitter (`O8t.emit`, `tengu_session_renamed`) |
| `$_e` | Append-log writer helper |
| `mq` | Log-file path builder |
| `m6e` | Symlink-based worktree-state manager |
| `bxo` | Worktree-dir creator |
| `Got` | Worktree-path resolver |
| `fh` | Worktree-file path builder |
| `mlt` | Worktree-file opener |
| `hM` | Subagent-slot state writer |
| `wf` | Session-watcher cleanup |
| `ro` | Module-init bootstrapper |
| `MKt` | Module-export binder |
| `_` | MCP server connection manager |
| `xht` | MCP SSE/SDK config reader |
| `pcc` | MCP config key enumerator |
| `Ho` | Error string formatter |
| `y` | MCP server restart handler |
| `l1t` | Low-level logger for MCP |
| `iA` | Coordinator-role setter |
| `M6` | worktree-state emitter |
| `sue` | Isolation-latch setter |
| `SOl` | Isolation-latch log appender |
| `nW` | Plugin hook loader and watcher |
| `hc` | Safe-mode hook-skip checker |
| `dp` | Config-value getter (st + GKt) |
| `aZ` | Permission-scope set builder |
| `xn` | Config store accessor (Mnn + B2) |
| `NKe` | Plugin hook metric logger |
| `Ln` | Append-file logger |
| `lhe` | Plugin hook safe-mode skip logger |
| `NRt` | New-session request builder |
| `Gy` | Gy-state getter |
| `sv` | Full REPL session-runner (main conversation loop) |
| `a` | MCP server update handler |
| `n3e` | MCP connection builder |
| `uZn` | MCP update applier |
| `mta` | Szr-based MCP state manager |
| `l` | k0l socket lister |
| `B1o` | MCP client manager |
| `gi` | UUID + timestamp generator for session records |