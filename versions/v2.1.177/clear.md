---
type: feature-spec
feature: "clear"
cc_version: "2.1.177"
updated: "2026-06-13"
tags: ["clear", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.177 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/clear`

> Analysis basis: CC v2.1.177 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.177

---

## Overview

`/clear` starts a new, empty Claude Code session by discarding the current in-memory conversation context and resetting all associated runtime state, while leaving the previous session safely persisted on disk so it can be resumed later with `/resume`. It accepts an optional session name argument and supports non-interactive (scripted) use. The command is also registered under the aliases `/reset` and `/new`.

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
| module_id | `Keq` |
| load_inline | `true` |
| loc_byte | `11322454` |
| loc_byte_end | `11322745` |
| loc_line | `7379` |
| arbor_handler.name | `UCL` |
| arbor_handler.fqn | `claude-2.1.177::UCL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.177 bundle.js:+11322454

---

## Input Branching

The command has 3+ distinct branches based on the optional `[name]` argument and backgrounded-session state:

```mermaid
flowchart TD
    A["/clear invoked"] --> B["Trim argument string\n(UCL → H.trim)"]
    B --> C{Argument provided?}
    C -- "No (empty string)" --> D["Use default/auto session name"]
    C -- "Yes (name string)" --> E["Use provided name\nas new session label"]
    D --> F{Is session backgrounded?\n(isBackgrounded check)}
    E --> F
    F -- "Yes (backgrounded)" --> G["Emit tengu_cache_eviction_hint\nwith conversation_clear tag\n(bundle.js:+11320261, +11320299)"]
    F -- "No (foreground)" --> H["Proceed directly\nto state teardown"]
    G --> I["Call session-initializer\n(sessionInitializer / $m6)"]
    H --> I
    I --> J["Emit SessionEnd event\n(bundle.js:+13652353)"]
    J --> K["Reset conversation state\n(conversationResetTelemetry / mMA)"]
    K --> L["Generate new session UUID\n(_eq.randomUUID)"]
    L --> M["Clear caches, hooks,\nMCP state, skill index"]
    M --> N["Emit conversation_reset\n(bundle.js:+11321576)"]
    N --> O["New empty session ready"]
```

---

## Behavioral Spec

### Entry Point — Handler (`UCL`)

The primary handler is the async function `UCL` (Arbor resolution path: `module_id` → `Keq` → `UCL`).

```
async function handleClear(commandArgs, context):
    trimmedName = commandArgs.trim()          // H.trim — bundle.js:+11322280
    sessionName = trimmedName or defaultName

    emit telemetry: tengu_cache_eviction_hint  // bundle.js:+11320261
        with tag: "conversation_clear"         // bundle.js:+11320299

    call sessionInitializer(sessionName, context)  // $m6 — bundle.js:+11322316
```

Analysis basis: CC v2.1.177 bundle.js:+11322280

---

### Session Initializer (`$m6`)

This is the core orchestrator that tears down the current session and stands up a fresh one.

```
async function sessionInitializer(sessionName, context):
    // 1. Parse optional session index/number
    parsedIndex = parseSessionIndex(sessionName)   // zm6 — bundle.js:+11320157
        uses: parseInt, Number.isFinite, Math.max, Math.min

    // 2. Set up new session event pipeline
    setupNewSessionPipeline(context)               // WUH — bundle.js:+11320169
        emits: "SessionEnd"                        // bundle.js:+13652353

    // 3. Set AbortSignal timeout for the transition
    AbortSignal.timeout(...)                       // bundle.js:+11320217

    // 4. Record "isBackgrounded" state flag
    check context["isBackgrounded"]                // bundle.js:+11320368

    // 5. Clear all in-memory data structures
    _.clear()                                      // bundle.js:+11320581
    Object.keys(registry).forEach(clearEntry)      // bundle.js:+11320606

    // 6. Flush pending writes (tz / Oc8)
    flushPendingWrites()                           // bundle.js:+11320982

    // 7. Reset conversation state comprehensively
    resetConversation()                            // mMA — bundle.js:+11320563

    // 8. Set working directory resolver
    resolveWorkingDirectory()                      // az — bundle.js:+11320572

    // 9. Clear CLI output buffer
    clearOutputBuffer()                            // T_ — bundle.js:+11320575

    // 10. Generate new session UUID
    newSessionId = _eq.randomUUID()                // bundle.js:+11321615

    // 11. Initialize new session scaffolding
    initNewSession()                               // ea8 — bundle.js:+11321633

    // 12. Emit conversation_reset telemetry
    emit "conversation_reset"                      // bundle.js:+11321576

    // 13. Start main agent loop for new session
    startAgentLoop()                               // sg — bundle.js:+11322055
```

Analysis basis: CC v2.1.177 bundle.js:+11320157

---

### Conversation State Reset (`mMA`)

This function performs a comprehensive in-process cache and state purge across all subsystems.

```
function resetConversation():
    // Clear skill index cache
    clearSkillIndex()                   // qv → YU → H.clearSkillIndexCache
                                        // bundle.js:+11319125

    // Clear filesystem cache
    clearFilesystemCache()              // Lh9 → ag.clear — bundle.js:+11319133

    // Reset agent lifecycle state (q6H)
    resetAgentLifecycle():              // bundle.js:+11319152
        resetCompactionState()          // Qx8
        clearFunctionZone()             // FZ6
        clearAnnotationCache()          // mx8 → $cq.clear
        clearSearchIndexes()            // Ji9 → AN6.clear, IQ_.clear
        resetAutonomousLoopDelivered()  // LvL.resetAutonomousLoopDelivered
        clearOutputTokens()             // DD

    // Clear plugin/tool caches
    clearPluginCache()                  // xp → Tu6.clear — bundle.js:+11319166
    clearFunctionZone()                 // FZ6 — bundle.js:+11319171

    // Clear network caches
    clearNetworkCaches()                // lNq → EmH.clear, o_A.clear
                                        // bundle.js:+11319416

    // Clear UI caches
    clearUICaches()                     // IWq → U96.clear, rS6.clear
                                        // bundle.js:+11319425

    // Clear notification cache
    clearNotificationCache()            // Q4_ → ncH.clear — bundle.js:+11319434

    // Clear background-queue caches
    clearBGQueueCaches()                // C4_ → lcH.clear — bundle.js:+11319462

    // Clear background session registry
    clearBGSessionRegistry()            // va9 → de.clear, dWH.clear
                                        // bundle.js:+11319474

    // Emit "running" state marker
    emit state: "running"               // bundle.js:+11320789

    // Resolve Promise immediately
    Promise.resolve()                   // bundle.js:+11319480
```

Analysis basis: CC v2.1.177 bundle.js:+11319116

---

### Session End Pipeline (`WUH`)

Before the new session begins, a `SessionEnd` event is dispatched through the hook pipeline.

```
function setupNewSessionPipeline(context):
    // Build session context (V7)
    buildSessionContext(context)        // bundle.js:+13652326
        includes: model effort settings, tool configs

    // Execute hook pipeline for SessionEnd (QG)
    runHookPipeline("SessionEnd")       // bundle.js:+13652384
        // SessionEnd hook string literal:
        //   "SessionEnd" — bundle.js:+13652353
        runs: pre/post tool hooks, plugin hooks, MCP hooks

    // Dispatch to background session if applicable (PmH)
    dispatchToBGSession()               // bundle.js:+13652586
```

Analysis basis: CC v2.1.177 bundle.js:+13652326

---

### Cache Eviction Hint

When a clear is initiated, a telemetry hint is fired before state teardown.

```
function emitCacheEvictionHint(context):
    emit tengu_cache_eviction_hint with:
        tag = "conversation_clear"      // bundle.js:+11320299
        sessionInfo = context.session
```

Analysis basis: CC v2.1.177 bundle.js:+11320261

---

### Working Directory Resolution (`az`)

After state reset, the working directory is re-anchored for the new session.

```
function resolveWorkingDirectory(path):
    if path is absolute:
        use path as-is               // v08.isAbsolute — bundle.js:+6972677
    else:
        resolve relative to cwd      // v08.resolve — bundle.js:+6972697

    validate path exists             // Q6, C8 — bundle.js:+6972712
    if invalid: throw Error          // bundle.js:+6972779

    set store working directory      // bf_ → Cs6.getStore — bundle.js:+1054085
    normalize path                   // Mz → H.normalize — bundle.js:+64041
```

Analysis basis: CC v2.1.177 bundle.js:+6972677

---

### Session Index Parsing (`zm6`)

If a numeric index is embedded in the session name argument, it is parsed and clamped.

```
function parseSessionIndex(name):
    raw = parseInt(name, 10)           // bundle.js:+13661834 (radix 10)
    if not Number.isFinite(raw):
        return defaultIndex = 0        // bundle.js:+11322295
    clamp = Math.max(0, Math.min(raw, 1000))
        // min clamp: 0 — bundle.js:+13662052
        // max clamp: 1000 — bundle.js:+13662021
    return clamp
```

Analysis basis: CC v2.1.177 bundle.js:+13661834

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_cache_eviction_hint` | Fired at start of clear with `"conversation_clear"` tag (bundle.js:+11320261) |
| Telemetry — `tengu_run_hook` | Fired during `SessionEnd` hook pipeline execution (bundle.js:+13701783) |
| Telemetry — `tengu_feature_ok` / `tengu_feature_bad` | Fired by hook-runner depending on outcome (bundle.js:+1018758, +1018825) |
| Telemetry — `tengu_repl_hook_finished` | Fired when REPL hook completes (bundle.js:+13685551) |
| Telemetry — `tengu_hook_plugin_metrics` | Fired with plugin hook timing metrics (bundle.js:+13680078) |
| Telemetry — `tengu_session_renamed` | Fired if the new session receives a name (bundle.js:+13562579) |
| Telemetry — `tengu_shell_set_cwd` | Fired when working directory is re-anchored (bundle.js:+6972832) |
| `SessionEnd` event | Dispatched through hook pipeline before context wipe (bundle.js:+13652353) |
| `conversation_reset` event | Emitted after state reset completes (bundle.js:+11321576) |
| In-memory caches cleared | Skill index, filesystem cache, compaction state, annotation cache, search indexes, plugin cache, network cache, UI cache, notification cache, background-queue cache, background session registry |
| Cache stores cleared | `ag`, `Tu6`, `AN6`, `IQ_`, `EmH`, `o_A`, `U96`, `rS6`, `ncH`, `PG8`, `lcH`, `de`, `dWH`, `$cq` |
| New session UUID | Generated via `_eq.randomUUID()` (bundle.js:+11321615) |
| Previous session | Preserved on disk; resumable via `/resume` |
| Hook registration | `SessionEnd` hooks registered via `QG` hook runner (bundle.js:+13701451) |
| AbortSignal timeout | Applied to session transition (bundle.js:+11320217) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.177 | Initial analysis |

---

## Common Mistakes

1. **Confusing `/clear` with a permanent wipe.** The previous session's transcript remains on disk and is fully resumable with `/resume`. Only in-memory state is discarded.
2. **Expecting the named argument to set a permanent label.** The `[name]` argument seeds the new session's name/index, but numeric values are clamped to the range `[0, 1000]` (bundle.js:+13662021, +13662052).
3. **Relying on `/clear` to reset MCP server connections.** While caches related to MCP tool state are cleared, active MCP server processes are not killed; only their in-process state registries are wiped.
4. **Using `/clear` instead of `/reset` or `/new` when scripting.** All three names (`clear`, `reset`, `new`) are registered aliases and are functionally identical (registration aliases: bundle.js:+11322454).
5. **Assuming `SessionEnd` hooks will not fire.** `/clear` triggers the full `SessionEnd` hook pipeline before wiping context, so any hooks registered for that event (including plugin hooks) will execute.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `UCL` | Primary handler for `/clear` (AsyncFunction, resolved via module_id `Keq`) |
| `$m6` | Session initializer — orchestrates teardown and new session setup |
| `zm6` | Session index parser — validates and clamps numeric session argument |
| `mMA` | Conversation state reset — purges all in-process caches and registries |
| `WUH` | Session end pipeline setup — dispatches `SessionEnd` event |
| `QG` | Hook runner — executes registered hooks for session lifecycle events |
| `V7` | Session context builder — assembles model/tool config for new session |
| `tz` | Pending-write flusher — drains write queue before state wipe |
| `Oc8` | Write tracker — tracks in-flight writes (add/delete from set) |
| `az` | Working directory resolver — re-anchors cwd for new session |
| `T_` | Output buffer clearer — clears CLI render buffer |
| `sg` | Agent loop starter — initializes new agent loop after reset |
| `ea8` | Session scaffolding initializer — sets up new session UUID and metadata |
| `qv` | Skill index cache clearer — calls `H.clearSkillIndexCache` |
| `YU` | Skill cache reset helper — resolves clearance promise |
| `Lh9` | Filesystem cache clearer — calls `ag.clear` |
| `q6H` | Agent lifecycle state resetter — resets compaction, annotations, search |
| `Qx8` | Compaction state resetter — removes entries from `eU`, `Y4A`, `mx6` |
| `Ji9` | Search index clearer — clears `AN6` and `IQ_` |
| `mx8` | Annotation cache clearer — clears `$cq` |
| `xp` | Plugin cache clearer — clears `Tu6` |
| `lNq` | Network cache clearer — clears `EmH` and `o_A` |
| `IWq` | UI cache clearer — clears `U96` and `rS6` |
| `Q4_` | Notification cache clearer — clears `ncH` |
| `C4_` | Background-queue cache clearer — clears `lcH` |
| `va9` | Background session registry clearer — clears `de` and `dWH` |
| `Q8q` | Background stats clearer — clears `PG8` |
| `Bgq` | Background index clearer — calls `yx6` |
| `DD` | Output token counter resetter — iterates `Object.values` of token store |
| `cN_` | Policy settings cache accessor — get/set on `yf9` |
| `Kz` | Dual-cache clearer — clears `Ac6` and `oa8` |
| `lN_` | Hooks state resetter — reinitializes hook registry |
| `wV6` | Agent-loop variant starter — used from `sg` for new session |
| `u2` | Full agent-loop implementation — the main REPL agent loop |
| `DC` | Session event emitter — emits to `nB6` event bus |
| `NzH` | Filesystem log writer — appends to log file with mkdir-p |
| `Yd` | Agent context builder — assembles agent metadata |
| `VpH` | Worktree symlink manager — manages task/worktree symlinks |
| `PmH` | Background session dispatcher — sends clear event to bg session |
| `iU` | Session rename handler — handles `worktree-state` metadata |
| `sKH` | Isolation latch setter — sets `isolation-latch` session state |
| `Nc8` | Hook spawn executor — spawns hook subprocesses |
| `ib` | App state reader — reads current app state |
| `hzH` | Hook context formatter — formats hook context for dispatch |
| `rPA` | Hook matcher — matches hooks to events by type |
| `iPA` | Third-party hook filter — filters non-third-party hooks |
| `kH` | Logger / error reporter — logs errors via `$s.logError` |
| `bH` | Feature-bad telemetry emitter — emits `tengu_feature_bad` |
| `IH` | Feature-ok telemetry emitter — emits `tengu_feature_ok` |
| `xg` | Telemetry emitter — emits events via `u97.emit` with timestamp |
| `Wh` | Abort controller manager — cancels in-flight requests |
| `dPA` | MCP tool hook dispatcher — dispatches to MCP tool hooks |
| `QPA` | HTTP hook dispatcher — dispatches to HTTP endpoint hooks |
| `_VK` | Hook output slicer — strips prefix from hook output |
| `vc8` | Hook output parser — parses JSON or plain-text hook output |
| `lKH` | Hook metadata transformer — transforms hook entries via `Object.fromEntries` |
| `Ec8` | Hook callback executor — calls registered hook callbacks |
| `AqH` | Async hook tracker — manages async hook lifecycle |
| `Ph` | Hook progress reporter — reports hook execution progress |
| `N` | Model name normalizer — uppercases/trims model identifiers |
| `CH` | JSON stringifier wrapper — calls `JSON.stringify` |
| `TH` | String coercer — calls `String()` |
| `Z8` | Error code checker — checks `error.code` field |
| `C8` | ENOENT guard — checks for `ENOENT` error code |
| `c6` | JSON parser — calls `JSON.parse` |
| `d` | State object accessor — general-purpose state getter |
| `H` | Timer / sleep helper — uses `Math.random` + `setTimeout` for jitter |
| `K6` | Module initializer — calls `nM6` |
| `nM6` | Low-level module init — base initializer |
| `tH` | Module config setter — calls `nM6` |
| `vL` | Value logger — logs values during session init |
| `oD` | Output dispatcher — dispatches output during init |
| `nRH` | Registry entry remover — removes entries by key |
| `FT` | Final teardown helper — called at end of clear pipeline |
| `i86` | Idle hook runner — runs `YHq` idle hooks |
| `wG` | MCP server config watcher — monitors MCP server configuration |
| `D86` | MCP server config hasher — hashes MCP config for change detection |
| `SWH` | SHA-256 hasher for config — uses `yl9.createHash` |
| `Yh` | MCP skill cache resetter — calls `$6` |
| `qeq` | Compact state helper — calls `cwH` |
| `x$` | REPL command dispatcher — dispatches REPL commands via `P4` |
| `P4` | Command pipeline entry — main REPL pipeline function |
| `Qh` | Output handler — handles command output |
| `dM` | Display message formatter — formats display messages |
| `iC` | Message renderer — renders to `eG` |
| `Om6` | Alternate command dispatcher — secondary REPL dispatch |
| `yo` | Yield handler — yields control back to event loop |
| `Kv` | Sub-agent context builder — assembles subagent context |
| `W5` | Watcher stopper — stops file watchers |
| `iq` | Input queue drainer — drains pending input |
| `C_` | Module export initializer — sets `__esModule`, binds handlers |
| `qh` | Queue handler — processes queued operations |
| `W` | SDK connection manager — manages SDK connections |
| `jM6` | MCP config key enumerator — calls `Object.keys` via `MHf` |
| `MHf` | MHf — enumerates MCP server config keys |
| `T` | Transport manager — manages SDK transport |
| `M3` | Mode switcher — switches between coordinator/normal mode |
| `sg` | Agent session bootstrapper — bootstraps new agent session with hooks |
| `Zf` | Worktree resolver — resolves git worktree via `RK` |
| `XL` | Bare worktree builder — builds bare git args |
| `RK` | Git command runner — runs git commands |
| `wt` | Tool permission collector — collects tool permissions |
| `R8` | Permission state reader — reads `Pe6` / `Tb` permission stores |
| `ccH` | Startup timer — records startup timestamp |
| `b8` | Persistent logger — appends to log file via `f.appendFileSync` |
| `rMH` | Safe-mode hook skipper — skips plugin hooks in safe mode |
| `LbH` | MCP server connector — connects configured MCP servers |
| `_o8` | MCP server updater — applies MCP update and calls `wG` |
| `M` | MCP manager — orchestrates MCP server lifecycle |
| `yZA` | MCP connection reconciler — reconciles connection state |
| `z9` | Session UUID generator — uses `jLA.randomUUID` |
| `bf_` | Store accessor — gets from `Cs6.getStore` |
| `Mz` | Path normalizer — normalizes to NFC |
| `I8H` | Working dir setter — calls `w36` |
| `az` | Path resolver — resolves absolute/relative cwd |
| `eG` | Terminal output writer — low-level terminal write |
| `iB` | UI state accessor — reads UI state via `eG` |
| `Lg` | Conversation ledger manager — updates conversation entry |
| `cN_` | Policy cache accessor — caches policy settings in `yf9` |
| `Kz` | Dual-store clearer — clears `Ac6` and `oa8` stores |
| `lN_` | Hook state re-initializer — rebuilds hook registry |
| `tAH` | Policy settings applier — applies `policySettings` |
| `cj` | Config compositor — composes config from `RK` + `tAH` |
| `aSH` | File pin manager — reads/writes `pins.json` |
| `cT6` | Pin path builder — builds path via `nj.join` + `zZ` |
| `M97` | Directory scanner — recursively scans directories |
| `Cv` | Late-join socket writer — writes `late` frame to socket |
| `hk` | Session history writer — writes session to `B$.join` path |
| `QOH` | Session roster writer — writes to roster via `UUH` |
| `im6` | Session path builder — joins `B$` + `lm6` |
| `nm6` | Session dir builder — joins `B$` + `lm6` for directory |
| `lZ` | Socket unlink helper — calls `U_K` |
| `yVA` | Background session lifecycle manager — manages bg session state |
| `EVA` | Background session connector — connects to background session |
| `k2A` | Session state file writer — writes session JSON to disk |
| `D` | Background session dispatcher — dispatches to bg sessions |
| `b` | Background session runner — runs bg session process |
| `bRH` | Session config reader — reads session config file |
| `w` | Supervisor message writer — writes supervisor messages |
| `keH` | Config file writer — writes `.claude` config files |
| `Y9H` | Session file updater — updates session files |
| `pZ9` | Session file filter — filters session files by age |
| `p1` | Exit handler — calls `process.exit` with `cli_error` |
| `frK` | Diff formatter — formats file diffs |
| `Q` | PTY session manager — manages background PTY sessions |
| `c` | Scheduled task runner — runs scheduled tasks |
| `C` | PTY write helper — writes to PTY output |
| `Dd8` | Memory pressure checker — checks free memory on macOS |
| `$6` | MCP skill registry accessor — queries `KXH`, `qg` stores |
| `Yf` | Pin file path builder — joins path via `nj` + `zZ` |
| `Oq` | File watcher — watches files for changes |
| `AO` | Active watcher marker — marks watchers as `active` |
| `hPH` | MCP hint parser — parses MCP tool hints |
| `xL` | Symlink creator — creates symlinks via `lJ` |
| `A76` | Skill reload trigger — triggers skill index reload |
| `Bgq` | Background index cache clearer — calls `yx6` |
| `yx6` | Index cache entry invalidator — removes from `Yx8` via `Nx6` |
| `at8` | Cache sentinel checker — checks `H.has` |
| `Q4_` | Notification clear helper — clears `ncH` |
| `gaq` | General async queue helper |
| `Nm8` | Skill namespace manager |
| `jrq` | Job request queue manager |
| `mpH` | MCP plugin hook runner — calls `yx6` |
| `r36` | Registry entry resetter |
| `i36` | In-flight tracker resetter |
| `a36` | Annotation store resetter — calls `eG`, `h8H` |
| `BWq` | Background work queue — calls `H` |
| `CGH` | Config getter/setter — reads `H`, `_` |
| `T4A` | Task agent resetter |
| `FZ6` | Function zone clearer — calls `uT` |
| `cyH` | Main-thread checker — calls `Cb` |
| `KyA` | Session key builder |
| `qyA` | Session event emitter — emits via `fc6.emit` |
| `DC` | Debug log + event emitter — emits to `nB6`, logs via `NzH` |
| `Yd` | Agent ID builder — constructs from `A6`, `yEK`, `iu`, `TyH` |
| `BEK` | Async log writer — appends via `iK.appendFile` with mkdir-p |
| `sKH` | Isolation latch writer — writes `isolation-latch` via `BEK` |
| `iU` | Worktree-state emitter — emits worktree state via `Nu8.emit` |
| `VpH` | Task symlink manager — creates/removes task symlinks |
| `mPA` | Symlink directory preparer — mkdir + file path builder |
| `F86` | Task file path builder — joins `xPA` + `A56` + `I6` |
| `b$` | Task symlink path builder |
| `pq6` | Task file opener — opens via `r6H.open` |
| `Kv` | Subagent context builder — joins `Q2H` path for subagents |
| `W` | SDK transport manager — manages `sdk`/`sse` transports |
| `jA` | Error normalizer — wraps in Error with String coercion |
| `uN6` | Connection URL builder |
| `SR` | SDK request sender |
| `Dh` | SDK disconnect handler |
| `Jr` | SDK join/reconnect handler |
| `hx` | SDK health checker |
| `jM6` | Transport key enumerator |
| `MHf` | SDK config key mapper |
| `Wh` | In-flight request aborter — aborts via `K.abort` + `clearTimeout` |
| `Ec8` | Hook callback wrapper — calls `Ph`, `fwA`, `LwA`, `N` |
| `DbH` | Debug hook logger |
| `LzH` | Hook lifecycle logger |
| `xg` | Telemetry event emitter — emits via `u97.emit` with timestamp |
| `gl` | Session GL helper — calls `Z8` |
| `fI5` | Claim-frame timeout handler — 5 000 ms timeout |
| `KI5` | Claim-frame builder — calls `ed.buildClaimFrame` |
| `EVA` | BG session connector — connects socket, writes claim frame |
| `yv` | Binary frame writer — encodes frames with Buffer ops |
| `mp8` | Binary frame reader — decodes frames with Buffer ops |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.