---
type: feature-spec
feature: "clear"
cc_version: "2.1.141"
updated: "2026-05-31"
tags: ["clear", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.141 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/clear`

> Analysis basis: CC v2.1.141 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.141

---

## Overview

`/clear` (also aliased as `/reset` and `/new`) starts a brand-new conversation session with an empty context, discarding all in-memory conversation history from the current session. The previous session's data is preserved on disk and remains resumable via `/resume`. An optional `[name]` argument assigns a name to the new session.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `clear` |
| description | Start a new session with empty context; previous session stays on disk (resumable with /resume) |
| aliases | `reset`, `new` |
| argumentHint | `[name]` |
| supportsNonInteractive | `true` |
| thinClientDispatch | `post-text` |
| module_id | `r9q` |
| load_inline | `true` |
| loc_byte | 9975949 |
| loc_byte_end | 9976240 |
| loc_line | 5568 |
| arbor_handler.name | `V37` |
| arbor_handler.fqn | `claude-2.1.141::V37` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | 0 |

Analysis basis: CC v2.1.141 bundle.js:+9975949

---

## Input Branching

The command has three main paths based on the optional `[name]` argument and whether the session is in a backgrounded state, warranting a Mermaid flowchart.

```mermaid
flowchart TD
    A["/clear [name] invoked"] --> B["Trim whitespace from argument\n(V37 → H.trim @ +9975807)"]
    B --> C{Argument provided?}
    C -- "Yes" --> D["Use trimmed string as new session name"]
    C -- "No" --> E["New session name is undefined/empty"]
    D --> F["Call sessionReset handler\n(V37 → Z26 @ +9975837)"]
    E --> F
    F --> G["Emit telemetry: tengu_cache_eviction_hint\n(@ +9974156)"]
    G --> H["Record conversation_clear event\n(literal @ +9974191)"]
    H --> I{Is session backgrounded?\n(isBackgrounded @ +9974259)}
    I -- "Yes (backgrounded)" --> J["Abort current operation signals\nClear in-memory caches and state\nGenerate new session UUID\nSet up fresh session directory"]
    I -- "No (foreground)" --> K["Abort current operation signals\nClear in-memory caches and state\nGenerate new session UUID\nSet up fresh session directory"]
    J --> L["Invoke state-clearing subsystems\n(AC_ @ +9973005)"]
    K --> L
    L --> M["Clear hook caches, MCP state,\ncompact caches, plugin state, output token counters\n(gn, TrH, gy1, n11, Tu8, NL1, $u8, p91, Dq1, oA8)"]
    M --> N["Persist new session to disk\n(tIH, Rb, w6H, bm @ various)"]
    N --> O["Re-initialize session context\n(n$, V26, ZZ8, FQ, Sb)"]
    O --> P["Emit SessionEnd event\n(literal 'SessionEnd' @ +12110041)"]
    P --> Q["Resolve with new empty session"]
```

---

## Behavioral Spec

### Top-Level Handler (`V37`)

`V37` is the async function resolved by Arbor as the handler for `/clear`. It is entered via the `module_id` resolution path from module `r9q`.

```
async function clearCommandHandler(userInput):
    trimmedName = userInput.trim()          // H.trim @ +9975807
    if trimmedName === ""                   // literal 0 @ +9975822
        sessionName = undefined
    else
        sessionName = trimmedName
    result = await sessionResetCore(sessionName)   // Z26 @ +9975837
    return result
```

Analysis basis: CC v2.1.141 bundle.js:+9975807, +9975837

---

### Session Reset Core (`Z26`)

`Z26` performs the full session teardown and re-initialization sequence. Key actions observed in the call graph:

```
async function sessionResetCore(newName):
    // (1) Determine model effort/context limit
    contextLimit = computeContextLimit()     // I26 @ +9974052
        // uses parseInt, Number.isFinite, Math.max, Math.min
        // base radix: 10 (literal @ +12118288)
        // scale factor: 1000 (literal @ +12118464)

    // (2) Reinitialize MCP connections
    mcpState = reconnectMCPServers()         // nvH @ +9974064

    // (3) Create AbortSignal with timeout
    signal = AbortSignal.timeout(...)        // @ +9974112

    // (4) Emit cache eviction telemetry
    emit("tengu_cache_eviction_hint")        // @ +9974156

    // (5) Record conversation_clear event
    record("conversation_clear")             // literal @ +9974191

    // (6) Check backgrounded state
    bg = readFlag("isBackgrounded")          // literal @ +9974259

    // (7) Iterate object values for existing sessions
    Object.values(sessions)                  // @ +9974322

    // (8) Reset state store (M) and MCP update state
    resetMcpAndAppState(M)                   // @ +9974336

    // (9) Generate new session UUID
    sessionId = n9q.randomUUID()             // @ +9974458

    // (10) Run full app state clearing pipeline
    clearAllState()                          // AC_ @ +9974479

    // (11) Set working directory context
    setWorkingDirectory(newName)             // MD @ +9974488

    // (12) Clear in-flight abort controllers
    clearAbortController("abortController")  // literal @ +9974821

    // (13) Flush pending writes (Dz) and clear timeouts
    flushPendingIO()                         // Dz @ +9974886

    // (14) Initialize new session ID store
    initSessionIdStore()                     // idH @ +9974924

    // (15) Re-run initialization hooks
    reinitHookContext()                      // I_1 @ +9975203

    // (16) Set up new session metadata objects
    setupSessionMetadata(                    // n$, V26, ZZ8, FQ @ +9975215..+9975381
        newSessionId, newName
    )

    // (17) Start fresh conversation record
    startNewConversation(                    // Rb, tIH, UT, VM, tf, Sb, w6H, bm
        sessionId, newName
    )

    // (18) Return new session descriptor
    return newSessionDescriptor
```

Analysis basis: CC v2.1.141 bundle.js:+9974052, +9974112, +9974156, +9974191, +9974259, +9974458, +9974479, +9974488

---

### MCP Server Reconnection (`nvH`)

Called during reset to re-establish MCP connections for the fresh session:

```
function reconnectMCPServers():
    // Build new session start payload
    payload = buildSessionPayload()          // M4 @ +12110014
        // emits literal "SessionEnd" @ +12110041
    // Reconnect all configured MCP servers
    newConnections = reinitAllServers()      // L2 @ +12110072
    // Emit progress indicator
    emitProgressView()                       // V6 @ +12110269
    // Wait for server ready states
    awaitServerReady()                       // Pj6 @ +12110274
    return newConnections
```

Analysis basis: CC v2.1.141 bundle.js:+12110014, +12110041, +12110072

---

### Full App State Clear (`AC_`)

`AC_` orchestrates clearing of all in-memory caches and stateful stores:

```
function clearAllAppState():
    resetRecentMessages()          // sR_ @ +9973005
    clearEventBus()                // eHH @ +9973013
    clearNotificationQueues()      // Cn9 @ +9973022
    clearHookRegistry()            // XH6 @ +9973031
    clearSessionHooks(gn)          // @ +9973041
        // gn clears: repl_main_thread state, compact state,
        //   post_compact_cleanup, session_start cache,
        //   autonomous loop delivery flags,
        //   local caches (lA8, oA8, Dq1)
    clearEventStream()             // TrH @ +9973054
        // TrH: CO8.clear @ +9231883
    clearSessionTracking()         // p36 @ +9973060
    clearConversationSummary()     // gy1 @ +9973227
        // CVH.clear, wT_.clear
    clearToolStateCache()          // n11 @ +9973236
        // QQH.clear, $z6.clear
    clearContentCache()            // Tu8 @ +9973245
        // XCH.clear
    clearDiagnosticsStore()        // _d9 @ +9973251
    clearJobIdMapping()            // NL1 @ +9973260
        // j98.clear
    clearTimerState()              // tV8 @ +9973266
    clearMcpResultCache()          // $u8 @ +9973273
        // jCH.clear
    clearPermissionCache()         // rt1 @ +9973279
    clearPolicyCache()             // p91 @ +9973285
        // Sn.clear, eOH.clear
    await Promise.resolve()        // @ +9973291
    reinitVaultState()             // Vv_ @ +9973321
    clearTransientQueue()          // q @ +9973364
    clearUserState()               // U$8 @ +9973399
    clearBroadcast()               // BX @ +9973490
    clearSharedGlobals()           // sgH @ +9973575
```

Analysis basis: CC v2.1.141 bundle.js:+9973005, +9973054, +9973227, +9973260, +9973285

---

### Context Limit Computation (`I26`)

Used to determine the model's context window before spinning up the new session:

```
function computeContextLimit(rawValue):
    parsed = parseInt(rawValue, 10)          // @ +12118277, radix 10 @ +12118288
    if not Number.isFinite(parsed):
        return defaultLimit via tY           // @ +12118342
    clipped = Math.max(                      // @ +12118495
        Math.min(parsed, upperBound),        // @ +12118508
        lowerBound
    )
    // scale: multiply by 1000              // literal @ +12118464
    return clipped
```

Analysis basis: CC v2.1.141 bundle.js:+12118277, +12118288, +12118464, +12118495

---

### Session Reset Persistence / Hook Execution (`bm`)

`bm` handles persisting the cleared session to disk and executing plugin hooks if applicable:

```
async function persistNewSession(sessionId, newName):
    // Build base log entry
    logEntry = buildLogEntry(JL)             // @ +5317029

    // Check model type for effort value
    effortValue = tY(modelConfig)            // @ +5317065

    // Load plugin hooks unless managed-only restriction active
    if allowManagedHooksOnly and not hasManagedPlugins:
        log("Skipping plugin hooks - allowManagedHooksOnly is enabled")
        // literal @ +5317086
    else:
        hooks = loadPluginHooks(LgH)         // @ +5317071
            // iterates Object.entries, checks A.includes

    // Execute lifecycle callback
    executeCallback(JCH, sessionId)          // @ +5317184
        // JCH records Date.now, writes via T8

    // Run hook pipeline
    runAllHooks(Dz6)                         // @ +5318087
        // dispatches to main query runner (oX) and
        // hook executor (M4, L2)

    // Push final session marker entries
    pushEntries(L, f, M)                     // @ +5318130..+5318323

    // Fire additional context hook event
    emit("hook_additional_context")          // literal @ +5318398
```

Analysis basis: CC v2.1.141 bundle.js:+5317029, +5317065, +5317086, +5317184, +5318087, +5318398

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_cache_eviction_hint` (bundle.js:+9974156) — emitted once per clear operation |
| Telemetry | `tengu_run_hook` (bundle.js:+12155595) — fired for each hook execution during session tear-down |
| Telemetry | `tengu_feature_ok` / `tengu_feature_bad` (bundle.js:+945566, +945624) — feature flag evaluation |
| Telemetry | `tengu_repl_hook_finished` (bundle.js:+12139929) — fired when REPL hooks complete |
| Telemetry | `tengu_hook_plugin_injected` (bundle.js:+12153941) — fired when plugin hook is injected |
| Telemetry | `tengu_session_renamed` (bundle.js:+12015137) — fired if a name argument is provided and applied |
| Telemetry | `tengu_shell_set_cwd` (bundle.js:+8473810) — fired if working directory is updated |
| Conversation record | Writes `conversation_clear` event into session log (literal @ +9974191) |
| Session UUID | New UUID generated via `n9q.randomUUID()` (@ +9974458) |
| Disk state | Previous session data is retained on disk; new session directory created via `tIH` / `cg_` (@ +9975501) |
| In-memory caches | All cleared by `AC_` pipeline: event bus, notification queues, hook registry, tool state cache, content cache, permission/policy caches, MCP result cache, job ID mapping |
| AbortController | Existing abort controller identified by literal `"abortController"` is cleared (@ +9974821) |
| Pending I/O | Flushed via `Dz` → `_.flush()` (@ +9974886) |
| MCP connections | Re-initialized by `nvH` → `L2` / MCP server reconnect pipeline |
| SessionEnd event | Literal `"SessionEnd"` emitted to session event stream (@ +12110041) |
| Plugin hooks | Executed if not restricted by `allowManagedHooksOnly`; skipped with log message if restricted |
| Hook caches | Cleared by `TrH` (`CO8.clear`), `gy1` (`CVH.clear`, `wT_.clear`), `n11` (`QQH.clear`, `$z6.clear`) |
| Output token counters | Reset via `Uj` → `Object.values` + `whH` (@ +40191, +40195) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.141 | Initial analysis |

---

## Common Mistakes

1. **Expecting conversation history to disappear from disk** — `/clear` only clears in-memory context; the previous session file remains on disk and can be resumed with `/resume`. The description explicitly states "previous session stays on disk."
2. **Confusing `/clear` with `/reset` or `/new`** — all three names are aliases for the same command. There is no behavioral difference between them.
3. **Providing a name when wanting a truly anonymous session** — the optional `[name]` argument (argument hint `[name]`) sets a custom title on the new session; omitting it leaves the session with a default/generated identity.
4. **Assuming MCP connections are dropped** — the handler reconnects MCP servers as part of the reset; connected MCP tools remain available in the new session.
5. **Using `/clear` inside a non-interactive pipeline and expecting it to block** — `supportsNonInteractive: true` means the command executes and returns; in thin-client mode the dispatch type is `post-text`, which may produce output before the calling context expects it.
6. **Expecting hook state to survive the clear** — `AC_` clears hook registries, MCP result caches, and plugin hook caches; hooks requiring prior state will re-initialize from scratch.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `V37` | Main async handler for `/clear` command (Arbor-resolved entry point) |
| `Z26` | Session reset core — orchestrates full teardown and re-initialization |
| `I26` | Context limit computation (parseInt + clamp + scale by 1000) |
| `tY` | Default context/model limit fallback resolver |
| `I8` | Policy settings reader (literal `"policySettings"`) |
| `xU` | Unknown utility called during context limit computation |
| `Cg` | Effort value helper, calls `gD_` |
| `gD_` | Effort calculation sub-helper, calls `s11` |
| `nvH` | MCP server reconnection coordinator |
| `M4` | Session payload builder / new session initializer |
| `V6` | Progress/view emitter |
| `Ly` | Likely model or capability lookup helper |
| `SX` | Model identification helper (checks model name strings against known claude-* models) |
| `iE` | Effort level encoder (`"high"` literal) |
| `A` | Model effort value resolver (`getEffortValue`, `toLowerCase`) |
| `kk` | Conversation record builder (joins path components) |
| `N6` | Session naming helper, calls `bS6` |
| `L2` | MCP connection manager — new session setup, hook runner dispatch |
| `RH` | String normalization utility |
| `Rm` | State reader utility |
| `v` | Log-level / message formatter (debug, verbose, etc.) |
| `A4H` | Async path resolver (calls `Z_`, `L7`) |
| `HQ_` | Hook query executor — filters and dispatches hook events |
| `O` | Session object / filter helper |
| `vkq` | Possibly a validator or filter key query |
| `eg_` | Hook filter by third-party type |
| `Nkq` | Possibly a negated key query / filter |
| `Q` | General queue or callback dispatcher |
| `SH` | JSON serializer (calls `JSON.stringify`) |
| `kH` | Session key-value store writer (calls `k_`, `RH`, `Vq`, `GvK`) |
| `xH` | Feature flag read helper (calls `Q`) |
| `_XH` | Feature flag check alt path (calls `XS6`) |
| `IZ` | Abort/timeout controller (abort, clearTimeout, setTimeout) |
| `j` | Callback registry (calls `w`) |
| `o6H` | Output / notification emitter |
| `kS` | Session key store accessor |
| `H28` | Session state snapshot builder |
| `tg_` | MCP tool result processor |
| `q28` | Hook output JSON parser (handles non-JSON plain-text fallback) |
| `sg_` | HTTP hook executor (posts to endpoint, checks 200–300 status range) |
| `Ikq` | HTTP hook response processor |
| `BLH` | Block/allow decision resolver |
| `K28` | Shell hook executor (spawns process, handles EPIPE, ABORT_ERR) |
| `hH` | Queue state reader |
| `Pj6` | Server readiness awaiter |
| `eeH` | Event bus factory (PqH, BO8, qs1, Dz8) |
| `M` | MCP state manager (SvH, Eeq, L.get, L.values) |
| `SvH` | MCP server state synchronizer |
| `$HH` | MCP connection configuration merger (Object.assign) |
| `hI` | MCP handshake handler |
| `K` | Padded output row builder |
| `__` | Double-underscore utility (wraps `_`) |
| `rX6` | Reconnect rate limiter |
| `xL7` | MCP connection timestamp recorder |
| `$78` | MCP key index builder |
| `M78` | MCP metadata accessor |
| `_8` | MCP debug logger (calls `Oc.logMCPDebug`) |
| `Nh_` | OAuth/authentication flow handler |
| `kh_` | OAuth callback complete handler |
| `sHq` | MCP server health poller |
| `Ih_` | MCP auth-required handler |
| `fG_` | MCP capability filter |
| `J` | Process kill registry |
| `y` | Daemon write stream |
| `_7` | MCP error logger (calls `Oc.logMCPError`) |
| `TH` | String coercion / type normalizer |
| `iHq` | MCP connection info retriever |
| `oX6` | MCP retry count parser |
| `oh_` | MCP timeout parser |
| `Eeq` | MCP update applicator |
| `fY8` | MCP update serializer |
| `sI` | MCP cleanup coordinator |
| `L` | File handle / resource manager |
| `q` | Temp file cleanup set |
| `f` | Stream close/finally handler |
| `$` | Session dispatch / XTq wrapper |
| `XTq` | Session telemetry timestamp recorder |
| `XA5` | MCP server entry iterator and state builder |
| `_` | Base utility (used by `__`) |
| `z78` | MCP tool filter (tx4.has, ex4.has) |
| `a8` | Process spawn with timeout and cleanup |
| `irH` | MCP internal resource handler |
| `X` | Connection failure and reconnect orchestrator |
| `gT8` | Connection pool getter |
| `k_` | Error/string factory |
| `jj` | Session join/merge helper |
| `P` | IPC buffer handler (Buffer.concat, subarray) |
| `w` | Worker/session dispatch manager |
| `S` | Blurred/focused session timer (Math.min, 3600000 ms max) |
| `YG6` | Memory/platform check (macos, freemem) |
| `u` | Write stream retirer |
| `j6` | Job registry lookup (gMH.has, OF.has/get) |
| `Ao_` | IPC socket connector |
| `Mo_` | Job lifecycle manager (done/killed/crashed/working states) |
| `D` | Session dispose orchestrator |
| `M8` | Message builder |
| `p` | Process handle |
| `yf` | Stream end/SH handler |
| `N15` | Full session attach/detach manager |
| `b6` | JSON parse error handler |
| `k15` | Session keepalive helper |
| `pw` | Background service identifier |
| `Lo_` | Session lookup helper |
| `s6K` | Session heartbeat/timeout manager |
| `BG` | Git path joiner |
| `m$` | Realpath normalizer |
| `t7H` | File tail reader (readline interface) |
| `I15` | Session stall detector |
| `Z` | Interval/tick reference |
| `j6H` | Job handle getter |
| `NK` | Path joiner (kX.join + G0) |
| `v15` | Session phase/kill coordinator |
| `N` | Away-summary generator |
| `qH` | React ref / setTimeout wrapper |
| `b` | Terminal write with throttle |
| `o` | Voice/recording session handler |
| `W` | Skill event emitter |
| `F` | MCP tool call filter (mcp__ prefix) |
| `g` | Permission classifier ($f8, nHH) |
| `c` | Terminal write proxy |
| `l` | Hook filter runner |
| `_Z6` | Stream destroy/write/SH helper |
| `G` | Connection pool + reconnect gate |
| `nD` | New session descriptor builder |
| `AC_` | Full app state clearing orchestrator |
| `sR_` | Recent messages reset |
| `eHH` | Event bus / state initializer |
| `PqH` | Event bus primary queue |
| `BO8` | Event bus secondary component |
| `qs1` | Event bus tertiary component |
| `Dz8` | Debounce/flush utility |
| `Cn9` | Notification queue clearer (Ym.clear) |
| `bTH` | Settings file writer (pH8.mkdir, pH8.writeFile) |
| `XH6` | Hook registry clearer |
| `gn` | Session hook state clearer (repl_main_thread, compact, etc.) |
| `Dm` | Session state flag resetter |
| `lA8` | Ready-state cache clearer (Fn.get, Fn.delete) |
| `p36` | Session-start event tracker |
| `Ge` | AI/YI cache pair clearer |
| `aq1` | Internal state handle |
| `Bn` | Utility state pair |
| `oA8` | Local cache clearer (l8q.clear) |
| `Dq1` | Tool state pair clearer (jz6.clear, tD_.clear) |
| `Uj` | Output token counter resetter (whH + Object.values) |
| `kw_` | Post-clear watcher |
| `TrH` | Event stream clearer (CO8.clear) |
| `gy1` | Conversation summary clearer (CVH.clear, wT_.clear) |
| `n11` | Tool state cache clearer (QQH.clear, $z6.clear) |
| `Tu8` | Content cache clearer (XCH.clear) |
| `_d9` | Diagnostics store clearer |
| `NL1` | Job ID mapping clearer (j98.clear) |
| `tV8` | Timer state checker (H.has) |
| `$u8` | MCP result cache clearer (jCH.clear) |
| `rt1` | Permission cache clearer |
| `p91` | Policy cache clearer (Sn.clear, eOH.clear) |
| `MD` | Working directory setter (tM8.isAbsolute, tM8.resolve) |
| `x6` | Path resolver utility |
| `$8` | Message builder (M8) |
| `Ox8` | CWD context store accessor (CS6.getStore) |
| `x8H` | Path normalizer (H.normalize) |
| `e8` | Entry serializer |
| `gTH` | Session global state handler |
| `VI` | View initializer |
| `Dz` | Pending IO flusher (cX8, QX8.get, _.flush, QX8.delete) |
| `cX8` | Pending set manager (bNq.add, bNq.delete) |
| `idH` | Session ID store initializer (yY1) |
| `yY1` | Session ID sub-initializer |
| `I_1` | Hook context re-initializer (H7H) |
| `H7H` | Hook context sub-initializer |
| `n$` | New session metadata builder (V6, cL) |
| `cL` | Conversation log writer (b9) |
| `b9` | Log entry set manager (jI8.add, jI8.delete, Object.assign) |
| `vp` | Session path builder |
| `Vf` | Conversation path builder (Rd, s3, e8, _$.join, V6) |
| `Rd` | Root directory resolver |
| `V26` | Session record updater (cL) |
| `ZZ8` | UUID emitter (R8H.randomUUID, xV6.emit) |
| `FQ` | Fresh conversation queue initializer (cL) |
| `Rb` | Conversation record committer (_kH, V6, cL, SG6.emit, Q) |
| `_kH` | Log appender (x6, SH, A.appendFileSync, A.mkdirSync) |
| `tIH` | Session directory symlinker (cX8, cg_, S3, vr.symlink, vr.unlink) |
| `cg_` | Session directory creator (vr.mkdir, ZiH) |
| `ZiH` | Session path resolver (Qg_.join, gX8, V6) |
| `S3` | Session path builder (Qg_.join, ZiH) |
| `Q58` | Session file opener (cX8, cg_, S3, vr.open) |
| `UT` | Session state serializer (Rd, s3, e8, V6, Xg_.get, _$.join) |
| `VM` | View-model initializer |
| `tf` | Title/format helper |
| `Sb` | Session broadcast emitter (cL, EO8.emit, _kH, V6) |
| `w6H` | Session isolation latch writer (cL, $Nq, V6) |
| `$Nq` | Async log appender (GL.appendFile, GL.mkdir) |
| `bm` | Plugin hook loader and session persistence orchestrator |
| `JL` | Log entry base builder (RH) |
| `LgH` | Plugin hook config reader (I8, Object.entries, A.includes, _.add) |
| `JCH` | Session lifecycle callback executor (Date.now, T8) |
| `T8` | Log writer with directory creation (rkK, x6, SH, L.appendFileSync, L.mkdirSync) |
| `z` | Daemon control handle (hH, xH, oR, Kx) |
| `oR` | Daemon IPC writer (ws, MF.push, W0H, uA_) |
| `Kx` | Daemon graceful exit orchestrator (Promise.race, process.exit) |
| `Dz6` | Hook execution dispatcher (M4, oX, aX8.randomUUID) |
| `oX` | Main hook execution engine (full REPL hook runner) |
| `$9` | UUID generator wrapper (la1.randomUUID) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.