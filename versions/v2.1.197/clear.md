---
type: feature-spec
feature: "clear"
cc_version: "2.1.197"
updated: "2026-07-01"
tags: ["clear", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.197 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/clear`

> Analysis basis: CC v2.1.197 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.197

---

## Overview

`/clear` starts a brand-new conversation session with an empty context window while preserving the previous session on disk so it can be retrieved with `/resume`. It is also registered under the aliases `/reset` and `/new`, and accepts an optional session name argument. The command triggers a full in-process teardown of the active conversation state before initialising a fresh one.

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
| module_id | `zNl` |
| load_inline | `true` |
| loc_byte | `11554593` |
| loc_byte_end | `11554884` |
| loc_line | `7357` |
| arbor_handler.name | `ROf` |
| arbor_handler.fqn | `claude-2.1.197::ROf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.197 bundle.js:+11554593

---

## Input Branching

The command has three or more distinct branches depending on whether a session name was supplied, whether the runtime is in a backgrounded state, and the cache-eviction hint path. A flowchart is used below.

```mermaid
flowchart TD
    A(["/clear [name] invoked"]) --> B["Trim optional name argument\n(ROf → e.trim, loc:+11554419)"]
    B --> C{Name argument\nprovided?}
    C -- "yes" --> D["Sanitise name string\n(t.replace, loc:+17659671)"]
    C -- "no" --> E["Use default / auto-generated session name"]
    D --> F
    E --> F["Emit tengu_cache_eviction_hint telemetry\n(DJt, loc:+11554455 / qe, loc:+11552190)"]
    F --> G["Log 'conversation_clear' event\n(literal loc:+11552193)"]
    G --> H{isBackgrounded\nflag set?\n(literal loc:+11552266)}
    H -- "yes" --> I["Skip interactive teardown;\napply backgrounded-session path\n(background session literal, loc:+18076393)"]
    H -- "no" --> J["Full session teardown via resetConversation\n(_$o, loc:+11552515)"]
    J --> K["Clear in-memory caches\n(ufa → Aq.clear, multiple .clear calls)"]
    K --> L["Flush pending hook queues\n(WH → bur.delete, loc:+11553056)"]
    L --> M["Re-initialise MCP skill index\n(Z0 → eW → e.clearSkillIndexCache, loc:+13606911)"]
    M --> N["Write new session to disk &\nregister conversation_reset event\n(literal loc:+11553656)"]
    I --> N
    N --> O["Initialise new conversation loop\n(bq → f4t → Lv, loc:+5420638)"]
    O --> P["Emit SessionEnd for old session\n(literal loc:+13760620)"]
    P --> Q([New empty session active])
```

---

## Behavioral Spec

### 1. Entry point — `clearCommandHandler` (bundle name: `ROf`)

The async handler is resolved via `module_id` → `zNl` → `ROf`.

```
async function clearCommandHandler(rawArgument, appContext):
    name = rawArgument.trim()              // loc:+11554419
    if name != "":
        name = sanitiseSessionName(name)   // t.replace, loc:+17659671

    emitCacheEvictionHint(appContext)      // DJt, loc:+11554455

    logEvent("conversation_clear")         // loc:+11552193

    await tearDownAndReset(name, appContext)
    return
```

Analysis basis: CC v2.1.197 bundle.js:+11554419

---

### 2. Cache eviction hint — `emitCacheEvictionHint` (bundle name: `DJt`)

Before any state is destroyed, the runtime signals the upstream inference layer to drop cached prompt prefixes. This prevents stale KV-cache entries from being reused in the new session.

```
function emitCacheEvictionHint(appContext):
    emit(telemetry: "tengu_cache_eviction_hint")   // loc:+11552155
    tokenCount = parseInt(appContext.tokens, 10)    // OJt → parseInt, loc:+13770171
    if not Number.isFinite(tokenCount):
        tokenCount = 0
    clampedCount = Math.max(0, Math.min(tokenCount, 1000))
    // 1000 literal loc:+13770358; 0 literal loc:+11554434
    signalEviction(clampedCount)                    // $_, E5, zF chain
```

Analysis basis: CC v2.1.197 bundle.js:+11552051

---

### 3. In-memory state reset — `resetConversation` (bundle name: `_$o`)

This is the largest sub-procedure; it clears all live in-process caches and in-flight async operations.

```
function resetConversation(newName, appContext):
    // Clear skill / MCP index
    clearSkillIndexCache()                  // Z0 → eW, loc:+11551019
    clearPluginCache()                      // ufa → Aq.clear, loc:+5407652

    // Flush pending state stores
    flushLocalStateCache()                  // qfe, loc:+11551046
        deleteAbortedEntries()              // Eer → KW.delete, loc:+10976797
        resetCompactState()                 // O9t → bx, loc:+10977221
        clearAuxCache1()                    // ger → Lkl.clear, loc:+10954222
        clearAuxCache2()                    // RRa → n6t.clear / Amo.clear
        resetAutonomousLoopDelivered()      // Exf.resetAutonomousLoopDelivered, loc:+10977297
        clearOutputTokenStore()             // Jy → sQe, loc:+48725

    clearDiffCache()                        // grl → VVe.clear / FCo.clear, loc:+8846993
    clearElicitationCache()                 // EEl → aEt.clear / wzt.clear, loc:+10135860
    clearZvedCache()                        // fMr → Zve.clear, loc:+1161667
    clearBznCache()                         // tll → Bzn.clear, loc:+9106929
    clearFileHistoryCache()                 // rMr → htt.clear, loc:+1152906
    clearQYtCache()                         // EG → QYt.clear, loc:+11273840
    clearMCPToolCache()                     // uOa → Eoe.clear / cDe.clear, loc:+7107690

    // Clear pending hook queue
    flushHookQueue()                        // WH → bur.delete, loc:+11553056

    // Re-route CWD tracking
    reinitCwdTracking()                     // BH, loc:+11552539

    // Reinitialise transcript writer
    startTranscriptWriter(newName)          // zW → lIe, loc:+11553866

    // Emit conversation_reset event
    emitConversationReset()                 // literal loc:+11553656

    // Generate new session UUID
    newSessionId = crypto.randomUUID()      // VNl.randomUUID, loc:+11553695

    // Re-register session event emitter
    registerSessionEmitter(newSessionId)    // iEr → iis / sis, loc:+11553713

    // Reset NJi (background file watcher) state
    resetFileWatcher()                      // NJi, loc:+11553843

    // Setup worktree logging
    setupWorktreeLog()                      // Wbe, loc:+11553973
    startNewConversationLoop()              // bq → f4t → Lv, loc:+5420638
```

Analysis basis: CC v2.1.197 bundle.js:+11552515

---

### 4. Session end notification — `emitSessionEnd` (bundle name: `e7e`)

Before the new conversation is initialised, a `SessionEnd` lifecycle event is emitted for hooks that listen to session boundaries.

```
function emitSessionEnd(oldSessionContext):
    dispatchLifecycleEvent("SessionEnd")    // literal loc:+13760620
    buildFinalSummary(oldSessionContext)    // Ld, loc:+13760593
    finaliseAgentLoop(oldSessionContext)    // a0, loc:+13760651
```

Analysis basis: CC v2.1.197 bundle.js:+13760593

---

### 5. New conversation loop initialisation — `startNewConversationLoop` (bundle name: `bq`)

After teardown, a full new conversation context is constructed including hook re-registration, plugin loading, and a fresh agent loop.

```
async function startNewConversationLoop(name, appContext):
    if safeMode:
        log("Skipping plugin hooks - safe mode disables plugins ...")
        // literal loc:+5419543
    else:
        loadPluginHooks(appContext)          // mtt → Ln, loc:+5419734

    newId = randomUUID()                    // f4t → kur.randomUUID, loc:+13760038
    agentLoop = createAgentLoop(newId, name, appContext)   // Lv, loc:+5420638

    emitEvent("hook_session_start_reload_skills")   // literal loc:+5420986
    emitEvent("hook_additional_context")            // literal loc:+5421114

    // Enqueue any queued_command if one was pending
    // literal loc:+11279535
    return agentLoop
```

Analysis basis: CC v2.1.197 bundle.js:+5420638

---

### 6. Backgrounded-session fast path

When the `isBackgrounded` flag is set (literal: `"isBackgrounded"`, loc:+11552266), the interactive teardown sequence is bypassed. The session is marked `stopped` (literal loc:+18076350) and a lighter-weight path is followed, consistent with the `"background session"` literal found at loc:+18076393.

```
function handleBackgroundedClear(appContext):
    markSessionStopped()          // "stopped" literal loc:+18076350
    // skip interactive cache flush
    logEvent("background session")   // loc:+18076393
    reinitMinimal(appContext)
```

Analysis basis: CC v2.1.197 bundle.js:+11552266

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_cache_eviction_hint` (loc:+11552155); `tengu_run_hook` (loc:+13811295); `tengu_feature_bad` (loc:+1028846); `tengu_feature_ok` (loc:+1028779); `tengu_hook_plugin_metrics` (loc:+13789073); `tengu_repl_hook_finished` (loc:+13794767); `tengu_session_renamed` (loc:+13660789); `tengu_transcript_write_failed` (loc:+13666758); `tengu_hook_plugin_injected` (loc:+13809547); `tengu_shell_set_cwd` (loc:+7261556); `tengu_mcp_skills` (loc:+6838519); `tengu_bg_state_read_transient` (loc:+4337098); `tengu_daemon_config_reload` (loc:+18054237); `tengu_daemon_control` (loc:+18076516) |
| Hook events dispatched | `SessionEnd` (literal loc:+13760620); `SessionStart` (literal loc:+13790216); `hook_session_start_reload_skills` (literal loc:+5420986); `hook_additional_context` (literal loc:+5421114) |
| In-memory caches cleared | Skill index, plugin cache (`Aq`), diff cache (`VVe`/`FCo`), elicitation cache (`aEt`/`wzt`), `Zve`, `Bzn`, `htt`, `QYt`, `Eoe`/`cDe`, hook queue (`bur`), MCP tool cache, autonomous-loop delivery state |
| Conversation log | `conversation_clear` event written at command invocation; `conversation_reset` event written after teardown (literals loc:+11552193 and loc:+11553656) |
| Transcript writer | Flushed and restarted under optional new session name (zW → lIe, loc:+11553866) |
| Session UUID | New UUID generated via `crypto.randomUUID()` for the replacement session (loc:+11553695) |
| Previous session on disk | Preserved; readable by `/resume` |
| File watcher | `NJi` state reset (loc:+11553843); background file watcher re-registered for new session |
| CWD tracking | Re-initialised via `BH` (loc:+11552539); emits `tengu_shell_set_cwd` |
| Worktree log | Re-opened via `Wbe` (loc:+11553973) |
| Abort controllers | Any in-flight AbortController from previous session cancelled (`VR → o.abort`, loc:+9118323) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.197 | Initial analysis |

---

## Common Mistakes

1. **Expecting immediate context loss in non-interactive mode**: `supportsNonInteractive: true` means `/clear` can be invoked from scripts, but the `isBackgrounded` flag changes which teardown path runs — some caches are not flushed on the background path.
2. **Assuming `/reset` and `/new` behave differently**: They are registered as aliases and invoke the same handler (`ROf`). There is no behavioural difference between the three names.
3. **Assuming the previous session is deleted**: The description and code both confirm the old session remains on disk. Use `/resume` to return to it.
4. **Passing a name containing shell-special characters**: The name argument is sanitised through `t.replace` (loc:+17659671) but is not shell-escaped; names with characters outside the sanitisation pattern may be silently modified.
5. **Expecting plugin hooks to run in safe-mode**: When `--safe-mode` is active, the `"Skipping plugin hooks - safe mode disables plugins ..."` log message (literal loc:+5419543) is emitted and plugin hooks are not re-registered for the new session. Managed settings-file hooks still execute.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `ROf` | Main async handler for `/clear` (`clearCommandHandler`) |
| `DJt` | Cache-eviction hint dispatcher; orchestrates full session teardown |
| `OJt` | Token-count parser and clamp logic for eviction hint |
| `$_` | Eviction signal emitter sub-step A |
| `kl` | Internal config/state accessor used by eviction path |
| `Qce` | Eviction signal emitter sub-step B |
| `E5` | Eviction signal emitter sub-step C |
| `zF` | Eviction signal emitter sub-step D; calls cache-clear helpers |
| `XYr` | Cache map get/set helper inside eviction path |
| `n_` | Clears `_in` and `tEr` maps |
| `QYr` | Post-eviction state sync helper |
| `e7e` | Session-end emitter; dispatches `SessionEnd` lifecycle event |
| `Ld` | Final-summary builder for ending session |
| `a0` | Agent-loop finaliser / post-session cleanup |
| `_$o` | `resetConversation` — master in-memory teardown function |
| `Z0` | Skill-index reload dispatcher |
| `eW` | Calls `clearSkillIndexCache` on the MCP skill registry |
| `ufa` | Plugin cache clearer (`Aq.clear`) |
| `uWe` | Plugin directory writer (recreates plugin state dir) |
| `qfe` | Multi-cache flush coordinator |
| `Eer` | Flushes abort-error entries from `KW` store |
| `O9t` | Session-start state initialiser |
| `ger` | Clears `Lkl` (local knowledge list) |
| `RRa` | Clears `n6t` and `Amo` caches |
| `Ypl` | Resets auxiliary state store |
| `POe` | Resets another auxiliary state store |
| `Jy` | Clears output-token usage store |
| `EG` | Clears `QYt` cache |
| `grl` | Clears `VVe` and `FCo` diff caches |
| `EEl` | Clears `aEt` and `wzt` elicitation caches |
| `fMr` | Clears `Zve` cache |
| `tll` | Clears `Bzn` cache |
| `rMr` | Clears `htt` file-history cache |
| `NLl` | Calls `X7t` (normalise path / flush path table) |
| `X7t` | Path-table normaliser |
| `uOa` | Clears `Eoe` and `cDe` MCP tool caches |
| `BH` | CWD re-initialiser; emits `tengu_shell_set_cwd` |
| `tRr` | Resolves CWD from async-local store |
| `WH` | Hook-queue flusher (`bur.delete`) |
| `Iur` | Hook-queue tracker (`Nuc.add/delete`) |
| `Xft` | Auxiliary finaliser step after hook flush |
| `xT` | MCP skill-server cleanup handler |
| `yje` | MCP server hash recomputer |
| `zMe` | Hashes MCP server config for change detection |
| `Kw` | MCP skill-server restart coordinator |
| `it` | MCP server instance manager |
| `KNl` | Post-teardown GC helper |
| `Vg` | Kc-based context restorer |
| `Kc` | Core context accessor / restorer |
| `vi` | Hook registry re-registrar |
| `Zf` | Transcript file path builder |
| `PJt` | Post-reset Kc path restorer |
| `iEr` | Session-emitter factory (generates new UUID, registers emitter) |
| `iis` | Event-id generator sub-step |
| `sis` | Emits `Sin` event on session emitter |
| `T2a` | Utility called during conversation reset |
| `yZ` | Kc accessor used during reset |
| `NJi` | Background file-watcher state resetter |
| `dE` | Deletes stale watcher entries from `Sre` |
| `Yi` | File-watcher re-registration logic |
| `Jd` | New watcher file writer |
| `rg` | Writes watcher lock file with random bytes |
| `Jf` | Watcher startup validator |
| `zW` | Transcript-writer restart orchestrator |
| `lIe` | Low-level transcript file appender / mkdir |
| `v4` | Transcript file context accessor |
| `Oe` | Promise-wrapping helper ($Xe) |
| `Wbe` | Worktree log opener |
| `o8o` | Creates tasks directory for worktree |
| `Wft` | Resolves worktree log path |
| `jm` | Joins worktree log path segments |
| `Jim` | Verifies worktree symlink validity |
| `Lmt` | Opens worktree log file |
| `Cx` | Subagent-log path builder |
| `eo` | Module bootstrap / ESM interop helper |
| `$W` | Worktree-state event emitter |
| `ome` | Isolation-latch writer for new session |
| `w7t` | Isolation-latch file appender |
| `bq` | `startNewConversationLoop` — builds new agent loop |
| `fc` | Hook-loading sub-step (kl path) |
| `yd` | Config accessor for hook loading |
| `cJ` | Aggregates hook definitions from config entries |
| `fn` | Internal hook-set constructor |
| `mtt` | Plugin hook timestamp logger |
| `Ln` | Plugin log writer (appendFileSync) |
| `sSe` | Safe-mode hook skip handler |
| `f4t` | Agent-loop factory dispatcher |
| `Ky` | Agent-loop context key resolver |
| `Lv` | Core agent-loop initialiser |
| `ci` | Conversation-item constructor (uuid + now) |
| `doc` | Session-document writer |
| `E` | SDK MCP connection manager |
| `$Ct` | SSE-transport adapter |
| `er` | Error wrapper |
| `A` | MCP process manager / stop handler |
| `t_r` | Array-check utility for stop logic |
| `e_r` | Shell-string slicer/replacer |
| `H` | Process kill / userinfo accessor |
| `I` | Keyboard input handler (floor/max) |
| `M` | HTTP server route handler |
| `p` | Process-exit scheduler |
| `rI` | Forced-shutdown logger |
| `u` | Abort sequence for daemon stop |
| `$F` | Daemon stop event publisher |
| `Wj` | Daemon-stop race/all coordinator |
| `s` | Active-connection set manager |
| `r` | Connection/registry tracker |
| `vs` | CLI-error exit handler |
| `d` | Supervisor server write/start/stop handler |
| `TYe` | File tool read/stat validator |
| `Ks` | Async-local store accessor |
| `eWo` | File-not-found (ENOENT) handler |
| `he` | String coercion helper |
| `Cic` | Column-width calculator for file output |
| `VR` | Abort-timeout scheduler (clearTimeout/setTimeout) |
| `g` | Callback dispatcher (f) |
| `Pur` | Worktree-create helper |
| `p8o` | MCP tool invocation handler |
| `Uur` | Hook JSON output parser |
| `Zfe` | Hook plugin metrics aggregator |
| `d8o` | HTTP hook executor |
| `vdc` | HTTP hook response parser |
| `jTe` | Hook execution timeout guard |
| `$ur` | Shell hook spawner |
| `Mje` | Hook timeout-cancel helper |
| `xe` | Feature-ok path helper |
| `h9` | Telemetry emitter (oZd.emit) |
| `a0o` | Post-agent-loop cleanup |
| `fwt` | Abort-signal factory sub-step |
| `qe` | Nonconforming-event helper |
| `br` | Ig/qe composite helper |
| `Ig` | $Xe-based signal helper |
| `f` | CWD normaliser |
| `L8` | Path normaliser (sN.normalize) |
| `Sl` | Session-list accessor |
| `bl` | H0-based log helper |
| `dr` | H0-based logger |
| `qt` | Path resolver utility |
| `Sn` | rn-based stringifier |
| `Bee` | owt-based path helper |
| `o_` | e.normalize CWD helper |
| `aWe` | Iteration helper over active tasks |
| `PT` | Pending-task flusher |
| `Re` | Feature-result dispatcher (V/Oe) |
| `sBe` | Mfn-based result helper |
| `Me` | JSON-stringify wrapper |
| `ke` | Error-log dispatcher |
| `V` | Core value wrapper |
| `tge` | Agent-loop stage tagger |
| `v1` | Result accumulator |
| `T` | Message-type dispatcher |
| `Z3` | fn-based context builder |
| `uIe` | r0e-based state-reader |
| `_8o` | Hook-type discriminator / plugin metadata extractor |
| `Ldc` | Hook-list deduplicator |
| `H8o` | Third-party hook filter |
| `Rdc` | Hook-result reducer |
| `Fn` | t-based finaliser |
| `Rt` | Async result wrapper |
| `q1` | H0-based queue logger |
| `QC` | Model-name gating (claude-3/opus/sonnet/haiku) |
| `nO` | Effort-level accessor (high) |
| `zx` | Agent-loop context joiner |
| `Ot` | nmn/dr-based path builder |
| `BFe` | Post-loop cleanup |
| `HS` | Padded-countdown display |
| `EYt` | u1o.set/get session-state accessor |
| `NO` | zre/Yre assistant-usage guard |
| `zre` | XGe.has check |
| `Yre` | Usage post-processing |
| `f$o` | resetConversation pre-step |
| `tnr` | Skill-index token normaliser |
| `PPl` | Plugin-pool updater |
| `dze` | X7t-based path flusher |
| `jwt` | Compact-state writer |
| `Kwt` | H0/Sae-based log helper |
| `JOo` | Post-flush journal writer |
| `jNl` | State-boundary marker |
| `cAr` | e.has guard |
| `GCe` | Post-teardown GC executor |
| `t3` | H0-based transcript path helper |
| `Zh` | Subagent-log path component |
| `XR` | Session-log rotator |
| `ld` | rn-based path logger |
| `Gt` | JSON.parse wrapper |
| `Ed` | Isolation-latch error tagger |
| `Gu` | Guard for worktree-log open |