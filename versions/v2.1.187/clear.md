---
type: feature-spec
feature: "clear"
cc_version: "2.1.187"
updated: "2026-06-24"
tags: ["clear", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.187 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/clear`

> Analysis basis: CC v2.1.187 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.187

---

## Overview

`/clear` starts a fresh Claude Code session with an empty conversation context, discarding the in-memory state of the current conversation while leaving the previous session's data intact on disk so it can be resumed later with `/resume`. It is aliased as `/reset` and `/new`, accepts an optional session name argument, and supports non-interactive (scripted) invocation.

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
| module_id | `Mdl` |
| load_inline | `true` |
| loc_byte | `11180109` |
| loc_byte_end | `11180400` |
| loc_line | `7006` |
| arbor_handler.name | `aYp` |
| arbor_handler.fqn | `claude-2.1.187::aYp` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.187 bundle.js:+11180109

---

## Input Branching

The handler has three or more distinct branches (optional session name present/absent, backgrounded state check, and the full session-reset pipeline), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/clear [name] invoked"]) --> B["Trim argument string\n(aYp → e.trim)"]
    B --> C{Optional name\nprovided?}
    C -- No --> D["Use auto-generated\nor default session name"]
    C -- Yes --> E["Adopt supplied name\nas new session label"]
    D --> F["Call session-reset\norchestrator (fWt)"]
    E --> F
    F --> G["Parse integer context size\n(hWt → parseInt, Number.isFinite)"]
    G --> H["Clamp value with Math.max / Math.min\n(bounds: 0 … 1000)"]
    H --> I["Clear in-memory caches\n(bH → YYt.clear, xsr.clear)"]
    I --> J["Reset app state and\npolicy settings (o3r → tie)"]
    J --> K["Emit 'SessionEnd' event\n(RWe)"]
    K --> L["Emit telemetry:\ntengu_cache_eviction_hint\n(Ve, Rr)"]
    L --> M{Is session\nbackgrounded?\n(isBackgrounded)}
    M -- Yes --> N["Skip certain UI resets;\nreturn early"]
    M -- No --> O["Broadcast 'conversation_clear'\nand 'conversation_reset' signals"]
    O --> P["Execute full hook pipeline\n(qbo reset cascade)"]
    P --> Q["Clear skill index cache\n(d5 → e.clearSkillIndexCache)"]
    Q --> R["Clear MCP server caches\n(qGi → g8.clear)"]
    R --> S["Reset plugin / hook registries\n(Yte, DNa, Vza, Fyr, gBa, Lyr)"]
    S --> T["Re-register session hooks\n(K_e, pH flush)"]
    T --> U["Emit telemetry:\ntengu_cache_eviction_hint"]
    U --> V(["New empty session ready"])
    N --> V
```

Analysis basis: CC v2.1.187 bundle.js:+11179935 (entry), +11177765 (hWt), +11177867 (W/fWt body), +11178193 (t.clear)

---

## Behavioral Spec

### 1. Handler Entry — Argument Parsing

```
async function clearCommandHandler(rawArgument, context):
    trimmedName = rawArgument.trim()          // e.trim @ +11179935
    if trimmedName is empty:
        sessionName = undefined               // use default later
    else:
        sessionName = trimmedName
    await runSessionReset(sessionName, context)
```

Analysis basis: CC v2.1.187 bundle.js:+11179935, +11179971

---

### 2. Session Reset Orchestrator (`fWt`)

```
async function runSessionReset(sessionName, context):
    // Parse and clamp context window size (base 10)
    rawSize   = parseInt(context.contextSize, 10)   // +13367584
    validSize = Number.isFinite(rawSize)             // +13367606
    size      = Math.max(0, Math.min(1000, rawSize)) // +13367802, +13367815

    // Clear in-memory conversation caches
    clearCaches()                                     // bH → YYt.clear +29197, xsr.clear +29209

    // Reset app-level state
    resetAppState(context)                            // o3r; resets "hooks" +3403879
                                                     //      resets "policySettings" +3404041

    // Emit SessionEnd lifecycle event
    emitSessionEnd()                                  // RWe → "SessionEnd" literal +13358134

    // Emit telemetry for cache eviction
    emit("tengu_cache_eviction_hint")                 // +11177869

    // Determine abort signal with timeout
    signal = AbortSignal.timeout(...)                 // +11177825

    // Check background state
    if context.isBackgrounded:                        // "isBackgrounded" literal +11177980
        return earlyExit()

    // Run the full cache-and-hook reset pipeline
    await runFullResetCascade(sessionName, signal)    // qbo @ +11178175

    // Re-attach logging and persistence subsystems
    attachLoggingSinks()                              // i6, dEe, MGn
    reRegisterHooks()                                 // K_e, pH

    // Emit final "conversation_reset" signal
    emitConversationReset()                           // "conversation_reset" +11179188

    // Apply worktree / coordinator mode if configured
    applyExecutionMode(context)                       // _, E @ +11179601

    // Return new session object
    return newSessionObject
```

Analysis basis: CC v2.1.187 bundle.js:+11177765–11179935

---

### 3. Full Reset Cascade (`qbo`)

The cascade calls more than a dozen sub-routines that clear independent subsystem caches. Key actions in execution order:

```
function fullResetCascade(sessionName, signal):
    // 1. Clear skill index
    clearSkillIndex()                  // d5 → e.clearSkillIndexCache +13208916

    // 2. Clear tool-use registries (Lx)
    resetToolRegistries()              // Rqn, Rll, XGe

    // 3. Clear MCP server state
    clearMcpCaches()                   // qGi → g8.clear +5226362

    // 4. Reset teammate / subagent state
    resetTeammateState()               // Yte → YWn, DOt, OEt, FEt, qWn, faa

    // 5. Clear autonomous-loop delivery flag
    resetAutonomousLoop()              // y8p.resetAutonomousLoopDelivered +10617014

    // 6. Clear background-task registry
    clearBgTaskRegistry()              // D4 → RGt.clear +10915358

    // 7. Clear Vw session-start state
    resetSessionStartState()           // DOt → Vw +5083706

    // 8. Clear MCP tool plugin caches
    clearPluginCaches()                // DNa → A5e.clear +8555910, fco.clear +8555922
                                       // Vza → $pt.clear +9809115, p5t.clear +9809127
                                       // Fyr → KAe.clear +1152949
                                       // gBa → _3n.clear +8809204
                                       // Lyr → x7e.clear +1145268
                                       // Bua → Pee.clear +6916021, qLe.clear +6916033

    // 9. Re-resolve working directory
    resolveWorkingDirectory()          // DH → QMn.isAbsolute / .resolve +7065336

    // 10. Flush pending write buffers
    flushWriteBuffers()                // pH → WJn flush +13323081

    // 11. Generate new session UUID
    newId = crypto.randomUUID()        // kdl.randomUUID +11179227

    // 12. Emit "conversation_clear" signal
    emit("conversation_clear")         // literal +11177781, +11177907

    // 13. Re-initialize hook file watchers
    reinitHookWatchers()               // K_e @ +11179505

    // 14. Apply execution-mode (coordinator / normal)
    applyMode(sessionName)             // _, E; literals "coordinator" +11179607,
                                       //                "normal"      +11179621
```

Analysis basis: CC v2.1.187 bundle.js:+11176724–11177372 (qbo body)

---

### 4. Session-End Broadcast (`RWe`)

```
function emitSessionEnd(context):
    // Collects tool-use metadata, formats output blocks (od, xL pipeline)
    buildSessionEndPayload()    // od → FI, sD, EL, Pt
    // Dispatches "SessionEnd" to all registered listeners
    broadcast("SessionEnd")     // literal +13358134
    // Logs via background node (Nfo)
    logToBackground()           // Nfo @ +13358367
```

Analysis basis: CC v2.1.187 bundle.js:+13358107–13358367

---

### 5. App-State Reset (`o3r`)

```
function resetAppState(context):
    retrieveCurrentState()      // Tn → hsn, l2 @ +3403137
    clearHooksConfig()          // key "hooks" +3403879
    clearPolicySettings()       // key "policySettings" +3404041
    rebuildBaseConfig()         // Bo @ +3403914, XE @ +3403876
    persistNewState()           // dl @ +3403848
```

Analysis basis: CC v2.1.187 bundle.js:+3403757–3403914

---

### 6. Cache Pair Clear (`bH`)

```
function clearInMemoryCaches():
    primaryConversationCache.clear()    // YYt.clear @ +29197
    secondaryConversationCache.clear()  // xsr.clear @ +29209
```

Analysis basis: CC v2.1.187 bundle.js:+29197, +29209

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_cache_eviction_hint` (+11177869); `tengu_run_hook` (+13407750); `tengu_feature_ok` (+1025122); `tengu_feature_bad` (+1025189); `tengu_hook_plugin_metrics` (+13385834); `tengu_repl_hook_finished` (+13391461); `tengu_session_renamed` (+13259784); `tengu_shell_set_cwd` (+7065491); `tengu_mcp_skills` (+6652661); `tengu_hook_plugin_injected` (+13406079) |
| Conversation cache | `YYt` and `xsr` maps fully cleared (+29197, +29209) |
| Skill index cache | Invalidated via `e.clearSkillIndexCache` (+13208916) |
| MCP server state | `g8`, `A5e`, `fco`, `$pt`, `p5t`, `KAe`, `_3n`, `x7e`, `Pee`, `qLe` all cleared (various byte offsets in qbo) |
| Teammate/subagent state | `mWn`, `SEo`, `B6t`, `sWe` caches deleted; autonomous-loop flag reset (+10616435–10617014) |
| Background task registry | `RGt` cleared (+10915358) |
| Hook file watchers | Re-registered via `K_e` (symlink / unlink pattern, +13324017) |
| Write-buffer flush | `WJn` buffer flushed before reset (+13323081) |
| Session UUID | New UUID generated with `kdl.randomUUID` (+11179227) |
| Working directory | Re-resolved with `QMn.resolve` (+7065356) |
| Pending timeouts | Cleared via `clearTimeout` (+11178493) |
| AppState fields | `hooks` and `policySettings` keys reset (+3403879, +3404041) |
| Disk persistence | Previous session data left intact on disk; resumable via `/resume` |
| `isBackgrounded` guard | If `true` (+11177980), the full reset cascade is skipped and handler returns early |
| Hook lifecycle events | `SessionEnd` emitted before reset; `SessionStart` conditions re-established after |
| `thinClientDispatch` | `post-text` — in thin-client mode the command output is delivered as a post-text message |

---

## Version History

| Version | Change |
|---|---|
| v2.1.187 | Initial analysis |

---

## Common Mistakes

1. **Expecting context to survive** — `/clear` genuinely empties the in-memory conversation. Files edited during the previous session remain on disk, but Claude has no memory of them until re-read or the session is resumed with `/resume`.
2. **Confusing `/clear` with process restart** — The CLI process continues running; only the conversation state is reset. Background daemon sessions and file watchers are re-initialized, not terminated.
3. **Omitting the name argument when branching sessions** — `/clear my-feature` stores a named checkpoint. Omitting the name creates an anonymous session, which is harder to resume by name later.
4. **Using `/clear` in backgrounded sessions** — When `isBackgrounded` is `true` the full reset cascade is skipped (+11177980). Operators relying on cache invalidation should not invoke `/clear` against a backgrounded session and expect all caches to be flushed.
5. **Assuming telemetry is suppressed** — Even in non-interactive (`supportsNonInteractive: true`) mode, telemetry events such as `tengu_cache_eviction_hint` are still emitted.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `aYp` | Main async handler for `/clear` (Arbor-resolved, `module_id` path) |
| `fWt` | Session-reset orchestrator called by `aYp` |
| `hWt` | Context-size parser and clamp helper (`parseInt`, `Number.isFinite`, `Math.max/min`) |
| `eE` | App-state configuration loader |
| `dl` | App-state persistence writer |
| `tie` | Policy-settings reset helper |
| `G3` | Global state accessor (`VL`) |
| `Y9` | Reset pipeline entry, coordinates `bH` → `o3r` |
| `r3r` | Cache-map lookup/set helper (`aAi`) |
| `bH` | In-memory conversation cache clearer (`YYt.clear`, `xsr.clear`) |
| `o3r` | App-state reset helper (clears `hooks`, `policySettings`) |
| `RWe` | `SessionEnd` broadcaster |
| `od` | Session-end payload builder |
| `xL` | Full session execution engine (new session bootstrap) |
| `F2` | State-transition helper (`Tn`) |
| `T` | Message formatting / locale helper |
| `fEe` | Tool-result accumulator (`YIe`) |
| `KDo` | Plugin/skill descriptor builder |
| `VDo` | Third-party filter (`iQn`) |
| `tQn` | Hook token sequencer (`LP`, `Zwo`, `eLo`) |
| `BDo` | MCP tool execution dispatcher |
| `oQn` | Hook-output plain-text parser |
| `Yce` | Hook-entry merger (`Object.fromEntries`) |
| `$Do` | HTTP hook dispatcher (`BS.post`) |
| `H4l` | HTTP-hook response body parser |
| `sQn` | Shell-command hook executor (spawns subprocess via `nQn.spawn`) |
| `H9e` | Hook timeout/race coordinator |
| `Le` | Feature-ok telemetry emitter (`W`, `Pe`) |
| `tB` | Telemetry batch emitter (`LCd.emit`) |
| `Nfo` | Background-node logger |
| `Ve` | Cache-eviction hint emitter (`rKe`) |
| `Rr` | Nonconforming-mode telemetry wrapper (`Ng`, `Ve`) |
| `Is` | Fatal error handler (`process.exit`) |
| `f` | Background daemon dispatch loop |
| `D` | Daemon worker controller (`ke`, `GJf`, `d.write`) |
| `FEc` | Daemon file-system verifier (`Zrr.realpath`, `Zrr.stat`) |
| `GJf` | Daemon config-change handler (`B2n`) |
| `d` | Daemon I/O writer (`r.write`, `f$l`) |
| `Kn` | Kill-with-timeout helper |
| `o` | Output formatter (`s.map`, `i.padEnd`) |
| `GXn` | Low-memory monitor (`jt`, `it`) |
| `it` | Token-usage tracker (`zIe.has`, `IW.get`, `Dt`) |
| `N2e` | Pin-file reader/cleanup (`gb.lstat`, `gb.readFile`, `gb.rm`) |
| `xDt` | Pin-path builder (`py.join`, `Vk`) |
| `fCd` | Recursive directory reader for pins |
| `U` | Idle-session reaper (`clearTimeout`, `setTimeout`) |
| `C3o` | Daemon socket claim sender (`dV.claim`, `Yrr.connect`) |
| `ZOo` | Session-state file writer (`pV.writeFile`, `JSON.stringify`) |
| `pJf` | Claim send-timeout watcher (`Date.now`, `Error`) |
| `dJf` | Claim-frame builder (`dV.buildClaimFrame`) |
| `Jd` | Utility logger (`cn`) |
| `be` | String coercion helper (`String`) |
| `gR` | Binary-frame encoder (`Buffer.from`, `Buffer.allocUnsafe`) |
| `x3o` | Background-session lifecycle manager |
| `ec` | Session-path resolver (`py.join`, `Vk`) |
| `Di` | Session-state file tracker (`qZ.get/set/delete`, `gb.lstat`) |
| `_g` | Active-state setter (`S0`) |
| `_ve` | Roster-entry field parser |
| `kd` | Session-metadata writer (`py.join`, `Me`, `fy`) |
| `iht` | Idle-session heartbeat (`_tf`) |
| `i8t` | Session-path joiner (`jh.join`, `o8t`) |
| `Eye` | Session-path resolver with `ZWe` |
| `yR` | Late-result handler (`iHl`) |
| `uN` | Session-unlink helper (`jh.join`, `sht`) |
| `lM` | Late-delivery handler (`iHl`) |
| `s8t` | State-path builder (`jh.join`, `o8t`) |
| `p` | Process exit coordinator (`Kb`, `process.exit`, `u.abort`) |
| `u` | Abort-chain runner (`Le`, `Re`, `CU`, `X6`) |
| `Pe` | Feature-bad telemetry emitter (`rKe`) |
| `F` | Interval-clear disposable (`clearInterval`) |
| `rc` | Run-context tracker |
| `fE` | Execution-flag helper |
| `qbo` | Full cache-and-hook reset cascade |
| `Fbo` | Reset cascade preamble |
| `Lx` | Tool/skill-registry rebuilder (`Rqn`, `Rll`, `XGe`) |
| `d5` | Skill-index cache invalidator (`e.clearSkillIndexCache`) |
| `XGe` | Skill-registry refresher (`T6t`) |
| `qGi` | MCP server cache clearer (`g8.clear`) |
| `jBe` | MCP skill-directory writer (`o0n.mkdir`, `o0n.writeFile`) |
| `Yte` | Teammate/subagent state resetter |
| `a$e` | Subagent main-state resetter (`rD`) |
| `YWn` | Agent-slot cache deleter (`s6.delete`, `SEo.delete`, `B6t.delete`, `sWe.delete`) |
| `DOt` | Session-start state resetter (`Vw`) |
| `FEt` | Feature-flag cache clearer (`VL`, `bre`) |
| `qWn` | Tool-call cache clearer (`xol.clear`) |
| `faa` | Token-budget cache clearer (`oUt.clear`, `NJr.clear`) |
| `g6a` | Global-agent state resetter |
| `HRe` | Hook-registry resetter |
| `Y_` | Output-token tracker resetter (`bKe`, `Object.values`) |
| `LEo` | Post-reset lifecycle hook emitter |
| `D4` | Background-task registry clearer (`RGt.clear`) |
| `DNa` | MCP plugin cache clearer (`A5e.clear`, `fco.clear`) |
| `Vza` | Tool-availability cache clearer (`$pt.clear`, `p5t.clear`) |
| `Fyr` | Hook-availability cache clearer (`KAe.clear`) |
| `Ldl` | Locale/display cache reset helper |
| `gBa` | Hook-name cache clearer (`_3n.clear`) |
| `$ar` | Feature-gate checker (`e.has`) |
| `Lyr` | Extended hook cache clearer (`x7e.clear`) |
| `Gtl` | Tool-graph cache clearer (`T6t`) |
| `T6t` | Tool-graph node accessor (`mWn.get`, `A6t`) |
| `Bua` | UI-state cache clearer (`Pee.clear`, `qLe.clear`) |
| `DH` | Working-directory resolver (`QMn.isAbsolute`, `QMn.resolve`) |
| `Wt` | Path-normalization helper |
| `w_r` | Store-based path lookup (`Rrn.getStore`, `TH`) |
| `TH` | Path normalizer (`e.normalize`) |
| `Ire` | Path validation helper (`Jyt`) |
| `gr` | Global-registry reader (`VL`) |
| `WBe` | State-writer batch helper |
| `jT` | Journal/transcript writer |
| `pH` | Write-buffer flush coordinator (`VJn`, `WJn`) |
| `VJn` | Pending-write set manager (`S9l.add/delete`) |
| `Kit` | Hook-kit loader (`Pma`) |
| `KT` | Hook-configuration reloader (`mit`, `o.cleanup`, `eL`) |
| `mit` | Hook-configuration hash builder (`RLe`) |
| `RLe` | Hook-config SHA-256 hasher (`msa.createHash`) |
| `eL` | Hook skill-context binder (`it`) |
| `xdl` | Orphaned-hook detector (`OSe`) |
| `ph` | Hook-runner dispatcher (`kt`, `Rc`) |
| `Rc` | Hook-runner registry (`Ei`) |
| `Ei` | Hook registrar (`b6o.register`) |
| `pR` | Permission-resolver helper |
| `Uf` | Subagent-path resolver (`M$`, `Ag`, `gr`, `Vwe.join`, `kt`) |
| `M$` | Module-store reader (`VL`) |
| `mWt` | MCP-watcher restart helper (`Rc`) |
| `Nsr` | Session-UUID generator (`Ude.randomUUID`, `d6o`, `u6o`) |
| `d6o` | UUID broadcast helper |
| `u6o` | UUID event emitter (`QYt.emit`) |
| `Wga` | Workspace-guard helper |
| `XY` | Hook-execution coordinator (`Rc`) |
| `W1i` | File-pin sync helper (`fy`, `Di`, `kd`) |
| `fy` | Pin cache deleter (`qZ.delete`) |
| `Df` | File-tracker event emitter (`ipe.has`, `T`, `be`, `ke`) |
| `i6` | Logger re-initializer (`EL`, `dEe`, `Rc`, `cKt.emit`) |
| `dEe` | Append-log file writer (`n.appendFileSync`, `n.mkdirSync`) |
| `s3` | Log-level checker (`nt`, `$3l`, `B3`, `eUe`) |
| `K_e` | Hook file-watcher re-registrar (`VJn`, `xDo`, `gm`, `$ne.symlink/unlink`) |
| `xDo` | Watch-directory creator (`$ne.mkdir`, `Uit`) |
| `Uit` | Watch-path builder (`kDo.join`, `mqe`, `kt`) |
| `gm` | Watch-symlink path builder (`kDo.join`, `Uit`) |
| `uut` | Hook-watch opener (`VJn`, `xDo`, `gm`, `$ne.open`) |
| `jw` | Subagents-path resolver (`M$`, `Ag`, `gr`, `Hjr.get`, `Vwe.join`) |
| `cd` | Context-description builder |
| `oo` | Module-export initializer (`wPe`, `nsr`, `aYt.call`, `lYt.bind`, `ySc`, `t9o.set`) |
| `lYt` | Module bind-target helper |
| `_` | Execution-mode router (`eyt`, `qD`, `Ox`, `Promise.all`) |
| `eyt` | SDK-execution mode runner (`fyc`) |
| `fyc` | Object-key enumerator for SDK mode |
| `fo` | Error-to-string converter (`Error`, `String`) |
| `E` | Fallback execution runner (`FUt`, `eyt`) |
| `FUt` | Final-execution helper |
| `Hm` | Hook-merge helper |
| `Q5` | Worktree-state emitter (`Rc`, `R8n.emit`, `dEe`, `kt`) |
| `tue` | Isolation-latch handler (`Rc`, `MGn`, `kt`) |
| `MGn` | Async-log file appender (`gl.appendFile`, `gl.mkdir`) |
| `H8` | Session-bootstrap orchestrator (plugin hook loading) |
| `Vl` | State-store initializer (`dl`, `Ad`) |
| `Ad` | State-writer with safe-mode flag (`nt`, `GXt`) |
| `ej` | Hook-entry set builder (`Tn`, `Object.entries`, `t.add`) |
| `Tn` | State-store accessor (`hsn`, `l2`) |
| `k7e` | Transcript-log writer (`Date.now`, `vn`) |
| `vn` | Append-file logger (`Miu`, `Wt`, `Me`, `s.appendFileSync`) |
| `_ge` | Safe-mode plugin hook skip handler (`dl`, `T`, `eWi`) |
| `g1t` | Main-session runner (`od`, `ph`, `Uy`, `kt`, `dC`) |
| `Uy` | UI-update helper |
| `dC` | Conversation-driver (full REPL loop) |
| `a` | MCP connection manager (`a9e`, `brr`, `hla`, `uBo`) |
| `a9e` | MCP server connector (`RB`, `Qw`, `zn`, `mua`) |
| `brr` | MCP update applier (`e.applyMcpUpdate`, `KT`, `aE`) |
| `hla` | MCP health-check launcher (`tQr`) |
| `uBo` | MCP slot reconciler (`mit`, `a9e`, `brr`, `Object.fromEntries`) |
| `ti` | Queued-command dispatcher (`HAo.randomUUID`, `t.uuid`, `t.now`) |
| `cn` | Console/output utility |
| `kn` | Error-boundary / no-op logger (`cn`) |