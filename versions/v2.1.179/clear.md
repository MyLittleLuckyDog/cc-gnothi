---
type: feature-spec
feature: "clear"
cc_version: "2.1.179"
updated: "2026-06-19"
tags: ["clear", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.179 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/clear`

> Analysis basis: CC v2.1.179 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.179

---

## Overview

The `/clear` command starts a brand-new Claude Code session with an empty context window, discarding all messages from the current conversation in memory while preserving the session transcript on disk. The previous session remains resumable via `/resume`. The command accepts an optional `[name]` argument to assign a label to the new session.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `clear` |
| description | Start a new session with empty context; previous session stays on disk (resumable with /resume) |
| argumentHint | `[name]` |
| supportsNonInteractive | `true` |
| thinClientDispatch | `post-text` |
| aliases | `reset`, `new` |
| module_id | `g_K` |
| load_inline | `true` |
| loc_byte | 11383118 |
| loc_byte_end | 11383409 |
| loc_line | 7280 |
| arbor_handler.name | `FUL` |
| arbor_handler.fqn | `claude-2.1.179::FUL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | 0 |

Analysis basis: CC v2.1.179 bundle.js:+11383118

---

## Input Branching

The command has 3+ distinct branches depending on whether a session name argument is provided, whether the environment is backgrounded, and the nature of the reset sequence (cache eviction hint, conversation clear, reset UUID). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/clear [name] invoked"] --> B["Trim argument string\n(FUL → H.trim)"]
    B --> C{Argument provided?}
    C -->|Yes| D["Use trimmed string as new session name"]
    C -->|No| E["Use empty/default session name"]
    D --> F["Emit tengu_cache_eviction_hint\n(bundle.js:+11380904)"]
    E --> F
    F --> G["Emit conversation_clear event\n(bundle.js:+11380942)"]
    G --> H{isBackgrounded?\n(bundle.js:+11381015)}
    H -->|Yes| I["Skip interactive reset steps\nfor background sessions"]
    H -->|No| J["Generate new conversation UUID\n(U_K.randomUUID / xe8)\n(bundle.js:+11382262)"]
    J --> K["Emit conversation_reset event\n(bundle.js:+11382223)"]
    K --> L["Clear internal state collections\n(_.clear at bundle.js:+11381228)"]
    L --> M["Run full session re-initialization\nvia resetSessionState (up6)\n(bundle.js:+11380812)"]
    I --> N["Return to caller"]
    M --> N
```

---

## Behavioral Spec

### Top-level Handler (`FUL`)

`FUL` is an `AsyncFunction` resolved by Arbor via `module_id` path (`g_K`). It is the sole entry point for `/clear`, `/reset`, and `/new`.

```
async function handleClear(rawArgument, appContext):
    name = rawArgument.trim()          // H.trim at bundle.js:+11382944

    emit telemetry: tengu_cache_eviction_hint   // bundle.js:+11380904
    emit event: "conversation_clear"            // bundle.js:+11380942

    if appContext.isBackgrounded:               // bundle.js:+11381015
        return   // no interactive reset needed

    newSessionId = crypto.randomUUID()          // U_K.randomUUID at bundle.js:+11382262
    emit event: "conversation_reset"            // bundle.js:+11382223

    resetSessionState(appContext, name, newSessionId)   // up6
    return
```

Analysis basis: CC v2.1.179 bundle.js:+11382944, +11382980

---

### Session State Reset (`up6`)

`up6` is the main orchestrator that tears down the existing live session and bootstraps a clean one. It calls a deep chain of helpers.

```
async function resetSessionState(appContext, sessionName, newSessionId):
    // 1. Compute scroll/display state
    computeTerminalLayout(appContext)         // pp6 at bundle.js:+11380800
    //    pp6 calls parseInt, Number.isFinite, Math.max/min for layout bounds
    //    uses 1000ms value (bundle.js:+13748412) and base 10 (bundle.js:+13748236)

    // 2. Abort and rebuild background agent pool
    rebuildAgentPool(appContext)             // PBH at bundle.js:+11380812
    //    PBH orchestrates SessionEnd (bundle.js:+13738775) signalling
    //    calls sub-routines: buildInitialContext (I7), setupRepl (sG), etc.

    // 3. Set AbortSignal timeout for reset
    signal = AbortSignal.timeout(timeoutMs)  // bundle.js:+11380860

    // 4. Handle "nonconforming" mode (bundle.js:+11381015 / literal "nonconforming")
    configureConformanceMode(appContext)     // a_ at bundle.js:+11380980

    // 5. Kill lingering background sub-processes
    for each activeProcess in Object.values(processList):  // bundle.js:+11381078
        terminateProcess(activeProcess)      // D at bundle.js:+11381107

    // 6. Clear in-memory state
    appContext.state.clear()                 // _.clear at bundle.js:+11381228
    Object.keys(stateMap).forEach(cleanup)  // bundle.js:+11381253

    // 7. Re-initialize signal/hook listeners
    reinitHooks(appContext)                  // nCH at bundle.js:+11381294

    // 8. Flush pending I/O
    flushPendingOutput(appContext)           // oz at bundle.js:+11381629
    //    oz calls the flush helper (Qn8.delete / _.flush)

    // 9. Re-attach environment and CWD
    resolveAndSetCwd(appContext)             // Tz at bundle.js:+11381219
    //    Tz uses xT8.isAbsolute/resolve; emits tengu_shell_set_cwd

    // 10. Reinitialize skills/plugin cache
    clearAndReloadSkills(appContext)         // AzA at bundle.js:+11381210
    //    AzA → Kv → XU → H.clearSkillIndexCache
    //    AzA → ER9 → GQ.clear (erases prompt/hint caches)
    //    AzA → R6H which calls many sub-resets (see State & Side Effects)

    // 11. Reinitialize log writers
    reinitLogWriters(appContext)             // YB / Z4H at bundle.js:+11382412,+11382681

    // 12. Recreate session context object
    newSession = buildSession(sessionName, newSessionId)  // xe8 at bundle.js:+11382280
    //    xe8 → pSA → mSA → nl6.emit(event)

    // 13. Re-register MCP servers
    reconnectMcpServers(appContext)          // M at bundle.js:+11382615 (via TQ)

    // 14. Restart hook infrastructure
    reloadHookRunners(appContext)            // TQ at bundle.js:+11382708
    //    TQ calls Sv6 (full agent bootstrap) and emits hook events

    // 15. Emit session-level telemetry
    emitConversationReset()                  // xe8 / mSA at bundle.js:+11382280
    //    Emits literal "conversation_reset" (bundle.js:+11382223)

    return newSession
```

Analysis basis: CC v2.1.179 bundle.js:+11380800 through +11382708

---

### Layout Computation Sub-routine (`pp6`)

```
function computeTerminalLayout(state):
    rawHeight = parseInt(state.terminalHeight, 10)   // bundle.js:+13748225
    if not Number.isFinite(rawHeight):               // bundle.js:+13748247
        rawHeight = 1000                             // bundle.js:+13748412
    clampedHeight = Math.max(0, Math.min(rawHeight, MAX))  // bundle.js:+13748443,+13748456
    updateScrollState(state, clampedHeight)
```

Analysis basis: CC v2.1.179 bundle.js:+13748225

---

### Agent Pool Rebuild (`PBH`)

```
async function rebuildAgentPool(appContext):
    fireSessionEndEvent("SessionEnd")      // I7 at bundle.js:+13738748; literal bundle.js:+13738775
    dispatchToRepl(appContext)             // sG at bundle.js:+13738806
    updateClientView(appContext)           // I6 at bundle.js:+13739003
    refreshHelpContext(appContext)         // hpH at bundle.js:+13739008
```

Analysis basis: CC v2.1.179 bundle.js:+13738748

---

### Skills and Plugin Cache Reset (`AzA`)

`AzA` is a comprehensive reset of every in-memory cache related to skills, MCP clients, and plugin hooks.

```
async function clearSkillsAndPluginCaches(appContext):
    clearSkillIndex()          // Kv → XU → H.clearSkillIndexCache (bundle.js:+13599001)
    clearPromptCache()         // ER9 → GQ.clear (bundle.js:+5187017)
    clearPluginState()         // R6H (bundle.js:+11379795)
        R6H calls:
          - clearSubagentPool()          // Dp8 (wB.delete, y5A.delete, eu6.delete, I5A.delete)
          - clearSessionStore()          // qv6 → cT (bundle.js:+5104059)
          - revertPostCompact()          // r$6
          - clearSkillStore()            // s$6 → OT
          - clearPluginMetricsCache()    // Mp8 → prq.clear (bundle.js:+10618663)
          - clearTaskQueues()            // ys9 → jh6.clear, Tl_.clear (bundle.js:+6655875)
          - clearAgentRegistry()         // Qkq → H (bundle.js:+9085738)
          - resetAutonomousLoopDelivered() // oIL.resetAutonomousLoopDelivered (bundle.js:+10640835)
          - clearSystemValues()          // zD → FQH, Object.values (bundle.js:+46957)
    clearDomainEventCache()    // gp → dm6.clear (bundle.js:+10939402)
    clearMcpEventCaches()      // CGq → WmH.clear, Q8A.clear (bundle.js:+8516241)
    clearConversationCache()   // XZq → gq6.clear, $C6.clear (bundle.js:+8704701)
    clearInstructionCache()    // h5_ → nlH.clear (bundle.js:+1146345)
    clearCompletionCache()     // SEq → kS8.clear (bundle.js:+8765220)
    clearContextHasMap()       // u6_ → H.has (bundle.js:+60652)
    clearCommandCache()        // X5_ → clH.clear (bundle.js:+1138681)
    clearLlmClientCache()      // wnq → gu6 → bm8.get/Bu6 (bundle.js:+10439798)
    clearHookResultCache()     // pHq → zHH.clear, k0H.clear (bundle.js:+6851551)
    // Re-bootstrap from clean state
    Promise.resolve()          // bundle.js:+11380123
    // Additional hook re-registration steps follow
```

Analysis basis: CC v2.1.179 bundle.js:+11379759 through +11380407

---

### Hook System Re-initialization (`TQ`)

After state is cleared, `/clear` re-initializes the hook runner infrastructure:

```
async function reloadHookRunners(appContext):
    loadPersistedHookConfig()         // N4 → pK (bundle.js:+3424964)
    reloadScrollState()               // Qj (bundle.js:+5198585)
    reloadPolicySettings()            // pK with "policySettings" key (bundle.js:+3426824)
    loadHooks()                       // ut → R8 (bundle.js:+3425920)
    // "hooks" key literal (bundle.js:+3426662)
    if safeMode:
        log("Safe mode: skipping plugin hook registration")  // bundle.js:+5196067
        return
    loadPluginHooks()                 // T3H → N (bundle.js:+5196065)
    // tengu telemetry: load_plugin_hooks (bundle.js:+5198813)
    startAgentBootstrap()             // Sv6 → I7 (bundle.js:+13738043)
    emitSessionStartEvent()           // TQ → yR.emit (bundle.js:+5200048)
    reloadSkillsOnSessionStart()      // SR9 (bundle.js:+5200152)
    // hook_session_start_reload_skills literal (bundle.js:+5200061)
```

Analysis basis: CC v2.1.179 bundle.js:+5198535 through +5200189

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_cache_eviction_hint` (bundle.js:+11380904), `tengu_run_hook` (bundle.js:+13788174), `tengu_feature_bad` (bundle.js:+1020546), `tengu_feature_ok` (bundle.js:+1020479), `tengu_repl_hook_finished` (bundle.js:+13771942), `tengu_hook_plugin_injected` (bundle.js:+13786536), `tengu_hook_plugin_metrics` (bundle.js:+13766469), `tengu_mcp_skills` (bundle.js:+6682260), `tengu_shell_set_cwd` (bundle.js:+7001409), `tengu_session_renamed` (bundle.js:+13646512) |
| Conversation events emitted | `"conversation_clear"` (bundle.js:+11380942), `"conversation_reset"` (bundle.js:+11382223), `"SessionEnd"` (bundle.js:+13738775) |
| In-memory caches cleared | Skill index, prompt cache (`GQ`), plugin metrics (`prq`), task queues (`jh6`, `Tl_`), agent registry (`wB`, `y5A`, `eu6`, `I5A`), domain event cache (`dm6`), MCP event caches (`WmH`, `Q8A`), conversation cache (`gq6`, `$C6`), instruction cache (`nlH`), completion cache (`kS8`), command cache (`clH`), hook result caches (`zHH`, `k0H`), scroll state (`dl6`, `Se8` via `Mz` at bundle.js:+27695) |
| New session UUID | Generated via `U_K.randomUUID` (bundle.js:+11382262) and `xe8` (bundle.js:+44293) |
| Hook registration | Hook runners are fully re-initialized via `TQ`; safe-mode skips plugin hook registration (bundle.js:+5196067) |
| CWD resolution | `Tz` re-resolves working directory using `xT8.isAbsolute`/`xT8.resolve` (bundle.js:+7001254); emits `tengu_shell_set_cwd` |
| Active sub-process cleanup | Running background processes are signalled via `D` → `b.kill` → `SIGKILL` (bundle.js:+17067350); `AbortSignal.timeout` guards the shutdown (bundle.js:+11380860) |
| Disk persistence | Previous session transcript is NOT deleted; it remains on disk and is resumable via `/resume` |
| Log writers | Log file handles are re-created (`YB` / `Z4H` / `OwH` / `yhK`; file append at bundle.js:+13645452, +13645915) |
| Sound | None observed in depth-2 traversal |
| appState changes | `isBackgrounded` is checked (literal bundle.js:+11381015); state map is cleared (`_.clear` bundle.js:+11381228) |
| Background mode | If `isBackgrounded` is true, interactive reset steps are skipped entirely |
| Non-interactive support | `supportsNonInteractive: true` — command may be invoked in CI/pipe contexts |
| thinClientDispatch | `"post-text"` — response is dispatched as plain text in thin-client mode |

---

## Version History

| Version | Change |
|---|---|
| v2.1.179 | Initial analysis |

---

## Common Mistakes

1. **Expecting context to be gone from disk** — `/clear` only clears the in-memory context. The previous session is persisted on disk and can be restored with `/resume`. Do not assume data is deleted.
2. **Confusing `/clear`, `/reset`, and `/new`** — all three names are aliases for the same command (`aliases: ["reset", "new"]`). They behave identically.
3. **Passing a name in non-interactive mode and expecting persistence** — the `[name]` argument labels the new session but does not pin it permanently; the label is stored as part of the session object emitted during the reset.
4. **Assuming `/clear` kills all background tasks** — while active child processes are sent kill signals, the cleanup runs under an `AbortSignal.timeout` guard. Processes that do not exit promptly may be forcibly killed (SIGKILL, bundle.js:+17067350), but this is best-effort.
5. **Running `/clear` in safe mode and expecting plugin hooks** — safe mode explicitly skips plugin hook registration after the reset (bundle.js:+5196067). Only settings-file hooks continue to run.
6. **Expecting immediate MCP reconnection** — MCP servers are re-connected asynchronously as part of the reset sequence (`M` / `TQ` pipeline); tools may be briefly unavailable immediately after `/clear`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `FUL` | Main handler for `/clear` (AsyncFunction; Arbor-resolved via module_id `g_K`) |
| `up6` | Session state reset orchestrator |
| `pp6` | Terminal layout / scroll state computation |
| `Qj` | Scroll state reload helper |
| `pK` | Policy/config key reader |
| `k1H` | Policy settings applier |
| `$F` | Config field accessor (calls `OT`) |
| `Sg` | Hook state synchronizer |
| `YI_` | Cache map get/set wrapper (`CM9`) |
| `Mz` | Scroll-state cache clearer (`dl6.clear`, `Se8.clear`) |
| `DI_` | Hook dispatcher (calls `R8`, `pK`, `SD`, `tA`) |
| `PBH` | Agent pool rebuilder; fires SessionEnd |
| `I7` | Session-end event emitter |
| `I6` | UI/view updater |
| `vk` | View kernel helper |
| `Y2` | Model capability/effort resolver (references model name literals) |
| `kN` | Effort-level enforcer ("high" effort) |
| `ch` | Context-header builder |
| `x6` | Extension/plugin context builder |
| `sG` | Full REPL setup / new session bootstrapper |
| `ab` | App-state accessor helper |
| `N` | Log/diagnostic formatter |
| `wwH` | Worker web helper |
| `EGA` | Hook event generator (iterates hook types) |
| `O` | Object utilities |
| `lkK` | MCP list-key helper |
| `ZGA` | MCP filter helper |
| `rkK` | MCP roster key helper |
| `d` | Generic store/state accessor |
| `bH` | JSON serializer wrapper |
| `SH` | Session hook runner |
| `CH` | Feature-ok telemetry emitter |
| `BhH` | Feature-bad telemetry emitter |
| `hh` | Hook abort/timeout helper |
| `J` | Callback dispatcher |
| `xKH` | Hook execution key helper |
| `Nh` | Notification helper |
| `Ai8` | Async hook initializer |
| `PGA` | MCP tool result processor |
| `fi8` | Hook output parser (plain-text vs JSON) |
| `J4H` | Hook plugin metrics aggregator |
| `XGA` | HTTP hook dispatcher |
| `ckK` | Command hook parser |
| `gzH` | Watch-path helper |
| `Li8` | Subprocess hook spawner |
| `wxH` | Watch-path change handler |
| `IH` | Feature-ok telemetry inner helper |
| `KQ` | Rate-limit / event-emitter throttle |
| `hpH` | Help/hint context refresher |
| `W$6` | Worker-set helper |
| `q6` | Non-conforming mode accessor |
| `n36` | Store primitive |
| `a_` | Conformance mode configurator |
| `Xj` | Extended conformance accessor |
| `f` | Promise/set management helper |
| `q` | Active-session set |
| `p1` | CLI error handler (calls `process.exit`) |
| `L` | Session lifecycle manager |
| `A` | Active-session accessor |
| `D` | Background process kill manager |
| `b` | Daemon/background session object |
| `bCH` | Config file reader |
| `w` | Daemon write helper |
| `Ht` | Hash/transform helper |
| `dH6` | `.claude` directory writer |
| `pk9` | Session file filter |
| `P` | Buffer/stream reader |
| `z` | Daemon control helper |
| `S` | Daemon supervisor writer |
| `X` | Socket timeout handler |
| `ctK` | MCP prompt update builder |
| `g9H` | History/session file gatherer |
| `n8` | Subprocess wrapper |
| `K` | Column formatter |
| `il8` | Memory/OS checker (macOS path) |
| `Y6` | Memory guard / pinned-file checker |
| `oRH` | Pins file reader |
| `_E6` | Pins path resolver |
| `l6` | JSON parser wrapper |
| `x8` | ENOENT guard |
| `eL7` | Directory recursive scanner |
| `g` | Permission-gate helper |
| `tq6` | Permission classifier |
| `xd` | Permission allow/deny resolver |
| `_kA` | Daemon socket claim handler |
| `LTA` | Daemon state writer |
| `nb5` | Send-claim timeout handler |
| `lb5` | Claim-frame builder |
| `VL` | String/value guard |
| `GH` | String coercer |
| `hv` | Binary frame serializer |
| `MkA` | Session roster manager |
| `P4` | Session path resolver |
| `zq` | Session file state machine |
| `i$` | Active-state marker |
| `D2H` | Session-start key tokenizer |
| `yL` | Session join/log helper |
| `qL6` | Session promise tracker |
| `vU6` | Session path builder (version-specific) |
| `EzH` | Error path builder |
| `aE` | Error token builder |
| `uI` | Session info path builder |
| `Cv` | Late-state token builder |
| `VU6` | Version URL builder |
| `Y` | Forced-shutdown handler |
| `NX` | Shutdown notifier |
| `G8` | Generic value guard |
| `QH` | Store primitive reader |
| `B` | Disposable resource holder |
| `y7` | Session-ready marker |
| `TP` | Terminal position helper |
| `AzA` | Skills and plugin cache master-reset |
| `sOA` | Skill-index reset initializer |
| `Kv` | Skill index cache clearer |
| `XU` | Skill index clear executor |
| `tU8` | Tool update helper |
| `ttq` | Tool tracker helper |
| `xUH` | Tool cache reset (calls `gu6`) |
| `ER9` | Prompt cache clearer |
| `_bH` | Prompt cache write helper |
| `o$6` | Old-state cleanup helper |
| `R6H` | Plugin/subagent state resetter |
| `FyH` | Feature flag helper |
| `Dp8` | Subagent pool cleaner |
| `qv6` | Session-store resetter (`cT`) |
| `r$6` | Post-compact revert helper |
| `s$6` | Skill store clearer |
| `Mp8` | Plugin metrics cache clearer (`prq.clear`) |
| `ys9` | Task queue clearer (`jh6.clear`, `Tl_.clear`) |
| `Qkq` | Agent registry clearer |
| `uTH` | UI thread helper |
| `zD` | System values resetter |
| `U5A` | Unknown state-flag reset |
| `gp` | Domain event cache clearer (`dm6.clear`) |
| `CGq` | MCP event cache clearer (`WmH.clear`, `Q8A.clear`) |
| `XZq` | Conversation cache clearer (`gq6.clear`, `$C6.clear`) |
| `h5_` | Instruction cache clearer (`nlH.clear`) |
| `h6K` | Unknown cache helper |
| `SEq` | Completion cache clearer (`kS8.clear`) |
| `u6_` | Context-has-map checker |
| `X5_` | Command cache clearer (`clH.clear`) |
| `wnq` | LLM client cache clearer (calls `gu6`) |
| `gu6` | LLM client pool accessor |
| `pHq` | Hook result cache clearer (`zHH.clear`, `k0H.clear`) |
| `Tz` | CWD resolver |
| `c6` | Config accessor |
| `PL_` | Store path resolver |
| `$z` | Path normalizer |
| `A_H` | Alternate path helper |
| `G_` | Output formatter |
| `nCH` | Hook listener reinitializer |
| `tT` | Timeout tracker |
| `oz` | Pending-output flusher |
| `cn8` | Async hook registration helper |
| `e_6` | Extra event helper |
| `pAq` | Hook payload helper |
| `GG` | MCP server cleanup/reconnect trigger |
| `W_6` | Worktree state hash helper |
| `j0H` | Hash/SHA builder |
| `Yh` | MCP skills reloader |
| `F_K` | Watch-path file helper |
| `VYH` | Watch event handler |
| `q$` | Log-writer builder |
| `Pf` | Log file path helper |
| `U9` | Signal/signal-handler registrar |
| `Fh` | Prompt formatter |
| `FM` | Full message builder |
| `sC` | System context builder |
| `mp6` | Minimal prompt builder |
| `xe8` | New session object creator |
| `pSA` | Session event emitter (pre-emit) |
| `mSA` | Session event emitter (main; calls `nl6.emit`) |
| `e9q` | Environment query helper |
| `no` | Notification object builder |
| `YB` | Log writer initializer (user mode) |
| `OwH` | Log file appender (sync) |
| `md` | Log metadata builder |
| `ZUH` | Symlink/task directory setup |
| `zGA` | Task directory creator |
| `l_6` | Task path builder |
| `A$` | Task symlink helper |
| `Tq6` | Task file opener |
| `fv` | Subagent log writer |
| `n5` | Unknown context helper |
| `g_` | Module bootstrap / ESM interop |
| `Kl6` | Module loader helper |
| `W` | MCP server reconnect manager |
| `J36` | MCP connection entry builder |
| `eA4` | MCP config key enumerator |
| `WA` | Error/string coercer |
| `T` | MCP server type router |
| `ih6` | MCP server id helper |
| `q3` | Queue cleanup helper |
| `KB` | Worktree-state log writer |
| `Z4H` | Isolation-latch log writer |
| `yhK` | Isolation-latch file appender |
| `TQ` | Hook runner and session-start re-initializer |
| `N4` | Hook config loader |
| `ZL` | Hook config bare-mode loader |
| `ut` | Hook policy applier |
| `R8` | Policy store reader |
| `dlH` | Date-stamped log helper |
| `C8` | Log file append-sync helper |
| `T3H` | Plugin hook loader |
| `Sv6` | Agent bootstrap (full session start) |
| `EY` | Event yield helper |
| `F2` | Full agent run loop |
| `M` | MCP server manager |
| `KxH` | MCP connection slot handler |
| `Us8` | MCP update applier |
| `$` | MCP state accessor |
| `fhA` | MCP client factory |
| `w9` | Random UUID / timestamp generator |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.