---
type: feature-spec
feature: "clear"
cc_version: "2.1.154"
updated: "2026-06-02"
tags: ["clear", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.154 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/clear`

> Analysis basis: CC v2.1.154 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.154

---

## Overview

The `/clear` command (also available as `/reset` and `/new`) starts a fresh Claude Code session with an empty context window while preserving the previous session on disk so it can be recovered later with `/resume`. It accepts an optional `[name]` argument to label the new session, orchestrates a full in-memory state teardown, flushes pending background work, and then reinitialises the conversation runtime with a new session ID.

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
| module_id | `yV1` |
| load_inline | `true` |
| loc_byte | `10745589` |
| loc_byte_end | `10745880` |
| loc_line | `7610` |
| arbor_handler.name | `alL` |
| arbor_handler.fqn | `claude-2.1.154::alL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.154 bundle.js:+10745589

---

## Input Branching

The command has more than three distinct execution paths: optional name argument present/absent, session running vs. backgrounded, cache-eviction hint, and several error/teardown branches.

```mermaid
flowchart TD
    A(["/clear [name] invoked"]) --> B["Trim optional name argument\n(alL → H.trim @ +10745415)"]
    B --> C{Name argument\nprovided?}
    C -- yes --> D["Pass name to session\nreinitialisation"]
    C -- no --> E["Use default session label"]
    D & E --> F["Emit tengu_cache_eviction_hint\n(+10743598)"]
    F --> G["Invoke session teardown\n(dv6 @ +10745451)"]
    G --> H["Flush pending context window\n(lv6 via dv6 @ +10743494)"]
    H --> I["Clear in-memory caches\n(Xz: lR6.clear + Hu8.clear @ +26612/26624)"]
    I --> J["Persist SessionEnd event\n(sSH → literal 'SessionEnd' @ +12981088)"]
    J --> K["Emit 'clear' literal\n(+10743510) and\n'conversation_clear'\ntelemetry (+10743633)"]
    K --> L{Session currently\nbackgrounded?\n('isBackgrounded' @ +10743701)}
    L -- yes --> M["Background teardown path\n(daemon/spawn cleanup)"]
    L -- no --> N["Foreground teardown path\n(abort controllers, timeouts)"]
    M & N --> O["Abort live background\noperations (_v: K.abort @ +6646093)"]
    O --> P["Generate new session UUID\n(NV1.randomUUID @ +10744755)"]
    P --> Q["Emit 'conversation_reset'\n(+10744716)"]
    Q --> R["Run SessionStart reset pipeline\n(sr_ and co @ +10742459)"]
    R --> S["Reinitialise conversation\nstate (Lu8 → tR6.emit @ +40795)"]
    S --> T(["New empty session ready"])
    G --> ERR["On error: hH logs error\n(Li.logError @ +970914)"]
```

---

## Behavioral Spec

### Entry Point — Handler (`alL`)

The Arbor-resolved handler is the async function `alL` (fqn: `claude-2.1.154::alL`, resolution path: `module_id`).

```
async function clearCommandHandler(rawArgs, appContext):
    name = rawArgs.trim()          // H.trim @ +10745415
    emitTelemetry("tengu_cache_eviction_hint")  // +10743598
    await performSessionReset(name, appContext) // dv6 @ +10745451
```

Analysis basis: CC v2.1.154 bundle.js:+10745415

---

### Session Reset Orchestrator (`dv6`)

`dv6` is the primary teardown/reinitialisation function. It coordinates all sub-steps synchronously and asynchronously.

```
async function performSessionReset(name, appContext):
    // 1. Flush and bound the current context window
    flushContextWindow(appContext)          // lv6 @ +10743494

    // 2. Persist session-end marker
    persistSessionEndEvent(appContext)      // sSH @ +10743506

    // 3. Set up an abort signal with timeout for cleanup
    signal = AbortSignal.timeout(...)       // @ +10743554

    // 4. Collect active background sessions
    activeValues = Object.values(appContext.sessions) // @ +10743764

    // 5. Terminate or suspend each active runner
    for each session in activeValues:
        terminateRunner(session)           // w @ +10743793

    // 6. Add new entry to session roster
    appContext.sessionSet.add(newEntry)    // Y.add @ +10743816

    // 7. Push initial conversation frame
    appContext.conversationFrames.push(...) // D.push @ +10743833

    // 8. Emit 'clear' marker and 'conversation_clear'
    emit("clear")          // literal @ +10743510
    emit("conversation_clear") // literal @ +10743633

    // 9. Check isBackgrounded flag
    if appContext.isBackgrounded:          // @ +10743701
        backgroundTeardown(appContext)
    else:
        foregroundTeardown(appContext)

    // 10. Clear internal map/set caches
    appContext.internalCache.clear()       // _.clear @ +10743914

    // 11. Iterate known keys and remove stale entries
    Object.keys(appContext.registry)       // @ +10743939

    // 12. Cancel and reset pending timers
    clearTimeout(appContext.debounceTimer) // @ +10744214

    // 13. Flush pending file I/O
    flushLogs(appContext)                  // hH @ +10744309

    // 14. Flush pending MCP tool queue
    flushMcpQueue(appContext)              // kO @ +10744315

    // 15. Generate fresh session UUID
    newId = crypto.randomUUID()            // NV1.randomUUID @ +10744755

    // 16. Emit conversation_reset with new ID
    emitSessionReset(newId)               // Lu8 → tR6.emit @ +10744773 / +40795

    // 17. Run session start reset pipeline
    runSessionStartReset(appContext, newId) // sr_ @ +10743896
```

Analysis basis: CC v2.1.154 bundle.js:+10743494

---

### Context Window Flush (`lv6`)

Handles bounded numeric arithmetic to ensure the context window length is within valid limits before reset.

```
function flushContextWindow(appContext):
    parsed = parseInt(appContext.contextLength, 10) // @ +12990428
    if not Number.isFinite(parsed):
        parsed = DEFAULT_CONTEXT // fallback
    bounded = Math.max(
        Math.min(parsed, MAX_CONTEXT),  // @ +12990659
        MIN_CONTEXT                     // @ +12990646
    )
    // Numeric constants: 10 (base, +12990439), 1000 (scale factor, +12990615)
    applyContextBound(appContext, bounded) // MD, sm, YU
```

Analysis basis: CC v2.1.154 bundle.js:+12990428

---

### In-Memory Cache Clear (`Xz`)

Called via `YU` → `Xz`. Clears two internal caches used for permission/policy state.

```
function clearInMemoryCaches():
    primaryCache.clear()    // lR6.clear @ +26612
    secondaryCache.clear()  // Hu8.clear @ +26624
```

Analysis basis: CC v2.1.154 bundle.js:+26612

---

### Session-End Persistence (`sSH`)

Writes a `"SessionEnd"` event (literal at +12981088) to the session log before tearing down, so the session remains resumable.

```
async function persistSessionEndEvent(appContext):
    buildSessionEndPayload(appContext) // D7 @ +12981061
    await writeSessionEndLog(appContext, "SessionEnd") // dW @ +12981119
    emitStatusLine(appContext)         // k6 @ +12981316
    emitNotification(appContext)       // nyH @ +12981321
```

Analysis basis: CC v2.1.154 bundle.js:+12981088

---

### Session Start Reset Pipeline (`sr_`)

Clears all runtime caches, skill indices, compact state, hook registries, and then fires a new `SessionStart` sequence.

```
function runSessionStartReset(appContext, newSessionId):
    resetSkillIndexCache()              // nr_ → Xu.H.clearSkillIndexCache @ +12851265
    dispatchStateResetSignals($C)       // SG8, QD1, YSH @ +12851317–12851329
    clearContextPolicyCache(NV9)        // qB.clear @ +6485200
    resetPluginHookState(co)            // nvH, if8, oj6, W8H, sf8, Hv9, aV9, HjH
        // includes: R01.clear, DP6.clear, WN_.clear, wl7.resetAutonomousLoopDelivered
    clearSearchCache(go)                // VG8.clear @ +9709041
    clearAnnotationCaches(G91)          // tyH.clear, JU_.clear @ +8780588
    clearToolCaches(Ea9)                // ksH.clear, ZG6.clear @ +8084448
    clearPermissionCache(Jr8)           // MpH.clear @ +1062050
    clearOtherRegistryCaches(OV9, cm8, qr8, G_9)
        // vf8.clear @ +6473725; fpH.clear @ +1054829
    clearDtCaches(Dt9)                  // ka.clear, RJH.clear @ +8150869
    // Fire the reset pipeline with Promise.resolve @ +10742822
    scheduleSpareReplacement(Bp_)
    runPostClearCallbacks(q, n08, sO, CNH)
```

Analysis basis: CC v2.1.154 bundle.js:+10742459

---

### Background Runner Termination (`w`)

When active background sessions exist, each is terminated gracefully before the new session starts.

```
async function terminateRunner(session):
    handle = activeHandles.get(session.id)   // A.get @ +15478486
    if handle is alive:
        handle.kill("SIGKILL")               // R.kill @ +15478645
        await setTimeout(100)                // @ +15478676 (100 ms grace)
    checkMemoryPressure()                    // k5A.freemem @ +15479013
    retireIfSettled(session)                 // B.retireIfSettled @ +15479315
    recordSpawnState(session)                // W5A @ +15479932
```

Analysis basis: CC v2.1.154 bundle.js:+15478486

---

### Abort Controller Reset (`_v`)

Cancels any in-flight async operations attached to the current session before context wipe.

```
function abortAndResetController(controllerRef):
    cancelPendingOperations(controllerRef) // C1 @ +6646055
    controllerRef.abort("abort")           // K.abort @ +6646093 (literal "abort" @ +6646254)
    clearTimeout(controllerRef.timer)      // @ +6646163
    reschedule = setTimeout(...)           // @ +6646206
```

Analysis basis: CC v2.1.154 bundle.js:+6646093

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_cache_eviction_hint` | Fired at session teardown start (bundle.js:+10743598) |
| Telemetry — `tengu_run_hook` | Fired during hook pipeline execution triggered by SessionEnd/SessionStart (bundle.js:+13029781) |
| Telemetry — `tengu_feature_bad` / `tengu_feature_ok` | Fired by hook feature gate check (bundle.js:+965234 / +965176) |
| Telemetry — `tengu_hook_plugin_metrics` | Fired per plugin hook measurement (bundle.js:+13008209) |
| Telemetry — `tengu_repl_hook_finished` | Fired after each REPL hook completes (bundle.js:+13013658) |
| Telemetry — `tengu_hook_plugin_injected` | Fired when a plugin hook is injected into the session (bundle.js:+13028121) |
| Telemetry — `tengu_session_renamed` | Fired if the new session receives a custom name (bundle.js:+12891664) |
| Telemetry — `tengu_shell_set_cwd` | Fired when working directory is reset for the new session (bundle.js:+8137170) |
| Telemetry — `tengu_bg_spare_enable` | Fired if background spare session is activated post-clear (bundle.js:+15479878) |
| Telemetry — `tengu_bg_spare_claim` | Fired when a background spare session is claimed (bundle.js:+15479999) |
| Telemetry — `tengu_bg_spare_spawn` | Fired when a new spare session subprocess is spawned (bundle.js:+15478297) |
| Telemetry — `tengu_daemon_control` | Fired by daemon lifecycle operations during teardown (bundle.js:+15514441) |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Fired if SIGKILL escalation is needed (bundle.js:+15478604) |
| Literal emitted — `"clear"` | Internal event marker emitted at reset (bundle.js:+10743510) |
| Literal emitted — `"conversation_clear"` | Conversation-level reset marker (bundle.js:+10743633) |
| Literal emitted — `"conversation_reset"` | New session ID broadcast (bundle.js:+10744716) |
| Session persistence | Previous session written with `"SessionEnd"` marker; remains on disk for `/resume` |
| In-memory caches cleared | `lR6`, `Hu8`, `qB`, `R01`, `DP6`, `WN_`, `VG8`, `tyH`, `JU_`, `ksH`, `ZG6`, `MpH`, `vf8`, `fpH`, `ka`, `RJH` |
| Abort controllers | All live `AbortController` instances for the current session are aborted with reason `"abort"` |
| Timers | All debounce/delay timers are cancelled via `clearTimeout` |
| Background processes | Any backgrounded session runners are sent `SIGKILL` and given a 100 ms grace period |
| New session UUID | Generated via `crypto.randomUUID()` (NV1.randomUUID @ +10744755) and broadcast |
| Hook pipeline | `SessionEnd` hooks fire before teardown; `SessionStart` hooks fire after reinitialisation |
| Sound | None detected in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.154 | Initial analysis |

---

## Common Mistakes

1. **Expecting immediate context wipe** — The command is asynchronous. Background process termination (with a 100 ms SIGKILL window) means the new session may not be ready instantaneously; avoid issuing a prompt in the same tick.
2. **Confusing `/clear` with permanent deletion** — The previous session is preserved on disk (a `"SessionEnd"` marker is written). Use `/resume` to return to it. Disk cleanup must be done separately.
3. **Using the name argument for a model switch** — The `[name]` argument only labels the new session; it does not change the model or configuration.
4. **Running in non-interactive scripts without `supportsNonInteractive`** — `/clear` sets `supportsNonInteractive: true`, so it is safe to call from headless scripts, but callers must account for the asynchronous teardown.
5. **Assuming all caches are warm immediately after** — The reset pipeline clears over a dozen in-memory caches (skill index, permission, tool caches, etc.). The first prompt after `/clear` will trigger cache repopulation and may be marginally slower.
6. **Treating aliases as distinct commands** — `/reset` and `/new` are exact aliases registered in the same command object; they execute identical logic.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `alL` | Primary `/clear` command handler (AsyncFunction; Arbor FQN: `claude-2.1.154::alL`) |
| `dv6` | Session reset orchestrator |
| `lv6` | Context window flush / numeric bounding |
| `MD` | Policy/settings cache accessor |
| `h8` | In-memory state reader |
| `sm` | State mutation helper |
| `YU` | Session cache reset coordinator |
| `lz_` | Cache lookup/set helper |
| `Xz` | In-memory dual-cache clear (`lR6`, `Hu8`) |
| `nz_` | Settings/hook reapplication helper |
| `sSH` | Session-end persistence writer |
| `D7` | Session log payload builder |
| `k6` | Status line emitter |
| `ES` | Environment/state query helper |
| `$W` | Model capability/effort resolver |
| `hV` | Token-effort resolver |
| `Vv` | Conversation frame builder |
| `C6` | Conversation state helper |
| `dW` | Hook execution engine (main pipeline) |
| `xH` | String conversion / normalisation helper |
| `zU` | App-state reader |
| `N` | Log level router / normalised logger |
| `hfH` | Hook filter helper |
| `SqA` | Hook loader / scanner |
| `a8K` | Hook argument builder |
| `hqA` | Hook filter (third-party) |
| `t8K` | Hook timeout resolver |
| `c` | Configuration accessor |
| `RH` | JSON serialise helper |
| `hH` | Error logger / push to error queue |
| `uH` | Configuration reader (feature gate) |
| `MGH` | Feature OK emitter helper |
| `_v` | Abort controller manager |
| `J` | Callback registry |
| `zqH` | Hook context builder |
| `mv` | Message validator |
| `Hh8` | Hook block-response handler |
| `NqA` | MCP tool hook executor |
| `qh8` | JSON-or-plaintext hook output parser |
| `MAH` | Plugin metrics aggregator |
| `vqA` | HTTP hook executor |
| `o8K` | HTTP response body parser |
| `zfH` | Hook cancellation handler |
| `Kh8` | Shell/spawn hook executor |
| `WyH` | Post-hook callback runner |
| `yH` | Feature-OK telemetry helper |
| `nyH` | Notification emitter |
| `X96` | AbortSignal timeout wrapper |
| `L` | Background session roster manager |
| `q` | Unlink-on-exit cleanup set |
| `f` | Background session file handle |
| `A` | Active session handle map |
| `w` | Background runner terminator |
| `R` | Session process record |
| `lEK` | Real-path resolver for session file |
| `Wz` | Process wait helper |
| `$B5` | Session audit writer |
| `z` | Stdio stream wrapper |
| `eI8` | Memory pressure checker |
| `E6` | Memory event recorder |
| `FD6` | Pins file reader |
| `lX_` | Pins file path resolver |
| `m6` | JSON parse helper |
| `P8` | ENOENT-tolerant file reader |
| `yX7` | Directory pins loader |
| `B` | Session pool manager (`retireIfSettled`) |
| `pH` | Session filter pipeline |
| `cH` | Session state check helper |
| `W5A` | Background spare session launcher |
| `L9A` | Spare session file writer |
| `mU5` | Claim-send with timeout |
| `uU5` | Claim frame builder |
| `bM` | Error code normaliser |
| `ZH` | String converter |
| `AF` | Binary frame serialiser (IPC) |
| `N5A` | Spare session lifecycle manager |
| `K` | Session column formatter |
| `mK` | Session metadata path resolver |
| `a9` | Session file stat/cache reader |
| `Lj` | Session active-state writer |
| `Af` | Session roster entry writer |
| `Q66` | Session telemetry recorder |
| `d5H` | Session directory path builder |
| `lh` | Session log line splitter |
| `OF` | Session output file manager |
| `PN6` | Session directory initialiser |
| `Y` | Session watcher/manager |
| `D` | Session dispatcher |
| `$` | Dispose callback helper |
| `P5A` | Spare subprocess spawner |
| `J8` | Error/result normaliser |
| `S` | Session dispose helper |
| `QX` | Post-reset state flag setter |
| `Pj` | Session roster push helper |
| `sr_` | Session-start reset pipeline |
| `nr_` | Pre-reset noop/gate |
| `$C` | State signal dispatcher (skills, compact, etc.) |
| `Xu` | Skill index cache clearer |
| `SG8` | Compact state reset signal |
| `QD1` | Hook state reset signal |
| `YSH` | Additional state reset signal |
| `NV9` | Context policy cache clearer (`qB.clear`) |
| `YkH` | Context policy file writer |
| `F96` | Feature flag cache clearer |
| `co` | Plugin/hook state reset coordinator |
| `nvH` | Plugin hook namespace resetter |
| `if8` | Subagent exit cache clearer |
| `oj6` | Session-start event emitter |
| `W8H` | Compact cleanup cache clearer |
| `sf8` | R01 cache clearer |
| `Hv9` | DP6/WN_ cache clearer |
| `aV9` | State flag resetter |
| `HjH` | Hook pipeline state resetter |
| `Fw` | Output token counter resetter |
| `xN_` | Post-reset hook callback |
| `go` | Search/VG8 cache clearer |
| `G91` | Annotation cache clearer (tyH, JU_) |
| `Ea9` | Tool result cache clearer (ksH, ZG6) |
| `Jr8` | Permission cache clearer (MpH) |
| `G_9` | Additional registry clearer |
| `OV9` | vf8 cache clearer |
| `cm8` | Map membership checker |
| `qr8` | fpH cache clearer |
| `Fj1` | Feature latch clearer |
| `Dt9` | ka/RJH cache clearer |
| `Ww` | Working directory resolver/setter |
| `B6` | Path utility helper |
| `Ki8` | Normalised path resolver |
| `eqH` | Path normalisation helper |
| `$_` | Internal flag/state helper |
| `HvH` | Internal state visitor |
| `Wk` | Registry walker |
| `kO` | MCP tool queue flusher |
| `Qy8` | Pending-operation set manager |
| `NiH` | CLI flag state resetter |
| `KX9` | CLI flag registry accessor |
| `IV1` | Memory model refresher |
| `yMH` | Memory model state writer |
| `V3` | Conversation frame initialiser |
| `U4` | Conversation frame factory |
| `_9` | Exit handler registrar |
| `ak` | Conversation annotation helper |
| `rf` | Conversation role formatter |
| `WS` | Role string resolver |
| `cv6` | Context frame builder variant |
| `Lu8` | New session ID broadcaster |
| `Rl` | Conversation frame recycler |
| `dh` | Conversation event logger |
| `yfH` | File append logger |
| `ahH` | Task directory symlink manager |
| `WqA` | Task directory creator |
| `msH` | Task path builder |
| `N3` | Task symlink target resolver |
| `utH` | Task file opener |
| `ME` | Subagent state resolver |
| `EM` | Subagent cleanup helper |
| `G_` | Keypress/signal handler registrar |
| `W` | Remote control state reader |
| `OL` | Remote control option parser |
| `T` | Keypress event dispatcher |
| `b` | Keypress event object |
| `Z0` | Settings loader (on key event) |
| `U_` | Settings merger |
| `sM` | Coordinator role setter |
| `_m` | Conversation-state event emitter |
| `IAH` | Isolation latch setter |
| `C6K` | Isolation log appender |
| `KB` | Full session initialisation runner (post-clear) |
| `lK` | Bare-flag checker |
| `mEH` | Policy settings collector |
| `LpH` | Plugin load duration timer |
| `I8` | Plugin load file appender |
| `$P6` | Conversation bootstrap (post-clear) |
| `kX` | Bootstrap flag resolver |
| `gX` | Main conversation run loop |
| `M` | MCP server manager |
| `vSH` | MCP server connection handler |
| `JGK` | MCP connection result applier |
| `Gm5` | MCP retry/refresh coordinator |
| `Eq` | Random UUID emitter for conversation tracking |