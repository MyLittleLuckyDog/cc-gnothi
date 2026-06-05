---
type: feature-spec
feature: "clear"
cc_version: "2.1.163"
updated: "2026-06-05"
tags: ["clear", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.163 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/clear`

> Analysis basis: CC v2.1.163 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.163

---

## Overview

The `/clear` command starts a fresh conversation session with an empty context window, discarding all messages from the current in-memory context while leaving the previous session file intact on disk for later resumption via `/resume`. It accepts an optional `[name]` argument to label the new session and supports non-interactive (headless) invocation via the `thinClientDispatch: "post-text"` mechanism.

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
| module_id | `Guq` |
| load_inline | `true` |
| loc_byte | `10992091` |
| loc_byte_end | `10992382` |
| loc_line | `7291` |
| arbor_handler.name | `tzf` |
| arbor_handler.fqn | `claude-2.1.163::tzf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.163 bundle.js:+10992091

---

## Input Branching

The handler has 4+ distinct branching paths based on argument presence, session naming, and background/foreground state.

```mermaid
flowchart TD
    A["/clear [name] invoked"] --> B["Trim argument string\n(tzf → H.trim)"]
    B --> C{Argument provided?}
    C -- "No / empty" --> D["Generate default session context\n(cy6 path)"]
    C -- "Yes" --> E["Validate / normalize name\n(J4 → g2A, H.replace, A.lastIndexOf, A.slice)"]
    E --> F["Use normalized name as session label"]
    F --> G
    D --> G["Emit 'conversation_clear' event\n(cy6, W6 → Nu6)"]
    G --> H["Reset in-memory conversation state\n(j8A → Ox9, zs, MF, ZOq, U9q, wH_, etc.)"]
    H --> I{Is session backgrounded?\n('isBackgrounded' check}
    I -- "No (foreground)" --> J["Perform full session teardown + reinit\n(SbH → V0, gL)"]
    I -- "Yes (background)" --> K["Post-text dispatch path\n(thinClientDispatch)"]
    J --> L["Cache eviction hint\n(tengu_cache_eviction_hint)"]
    K --> L
    L --> M["New empty session ready\n(conversation_reset emitted)"]
    M --> N["Write new session file to disk\n(icK → ncK → Zy.mkdir, Zy.appendFile)"]
    N --> O["Previous session remains on disk\n(resumable via /resume)"]
```

Analysis basis: CC v2.1.163 bundle.js:+10991917 (handler entry `tzf`), +10990008 (`"clear"` literal), +10990134 (`"conversation_clear"` literal), +10990203 (`"isBackgrounded"` literal), +10991218 (`"conversation_reset"` literal)

---

## Behavioral Spec

### 1. Argument Normalization

```
async function clearCommandHandler(rawInput, appContext):
    trimmedInput = rawInput.trim()                    // tzf → H.trim

    if trimmedInput is non-empty:
        sessionName = normalizeSessionName(trimmedInput)  // J4
    else:
        sessionName = null
```

Analysis basis: CC v2.1.163 bundle.js:+10991917

### 2. Session Name Normalization

```
function normalizeSessionName(rawName):
    // Collect reserved/canonical name segments (g2A → BcK.map)
    reservedParts = buildReservedNameList()

    // Replace disallowed characters
    cleaned = rawName.replace(disallowedPattern, replacement)   // J4 → H.replace

    // Determine last valid separator position
    lastSep = cleaned.lastIndexOf(separator)                    // J4 → A.lastIndexOf

    // Trim to canonical form
    result = cleaned.slice(0, lastSep or end)                   // J4 → A.slice

    return result
```

Analysis basis: CC v2.1.163 bundle.js:+198062 (`g2A`), +198089 (`H.replace`), +198225 (`A.lastIndexOf`), +198251 (`A.slice`)

### 3. Conversation State Reset

The bulk of the clear operation is handled by the session-teardown function (handler `cy6`) which:

1. Resolves the current working directory and validates it is absolute (`rD → m08.isAbsolute`, `m08.resolve`).
2. Emits the `"conversation_clear"` event through the application event bus (`W6 → Nu6`).
3. Triggers a comprehensive in-memory cache and state flush (`j8A`):
   - Clears the skill index cache (`Mm → H.clearSkillIndexCache`).
   - Clears the permissions / tool-use caches (`Ox9 → LF.clear`).
   - Resets sub-agent registries (`KY8 → tu.delete`, `hC_.delete`, `t06.delete`).
   - Clears compact-state maps (`fY8 → vSq.clear`).
   - Flushes hook-related caches (`Bx9 → s06.clear`, `kC_.clear`).
   - Resets autonomous-loop delivery counters (`gz7.resetAutonomousLoopDelivered`).
   - Clears additional internal memoisation stores (`ZOq → VRH.clear`, `wl_.clear`; `U9q → kH6.clear`, `MV6.clear`; `wH_ → nBH.clear`; `ib9 → uz8.clear`; `rKq → cs.clear`, `dPH.clear`; `MF → mN8.clear`).
4. Emits `"conversation_reset"` to signal downstream consumers that context is now empty.

```
async function performConversationClear(sessionName, appContext):
    validateWorkingDirectory()          // rD
    emitEvent("conversation_clear")     // cy6 → W6
    flushAllInMemoryCaches()            // j8A (comprehensive)
    emitEvent("conversation_reset")     // cy6 literal at +10991218
    triggerCacheEvictionHint()          // tengu_cache_eviction_hint at +10990096
    await setupNewSession(sessionName)  // SbH → V0
```

Analysis basis: CC v2.1.163 bundle.js:+10990134, +10990266, +10988952 (`j8A`), +10991218

### 4. New Session Initialization

After clearing, `SbH` orchestrates a new session bootstrap:

```
async function initializeNewSession(sessionName, appContext):
    // Build initial context configuration (gL)
    contextConfig = buildContextConfig(effortLevel, modelConfig)

    // Create new session record with UUID (V0 → HuH.randomUUID)
    newSessionId = generateUUID()

    // Persist session file on disk (icK → ncK)
    await ensureSessionDirectory()      // ncK → Zy.mkdir
    await appendSessionData()           // ncK → Zy.appendFile

    // Rotate / archive old session transcript (i2A)
    if oldTranscript.endsWith(".txt"):
        await renameOrUnlinkOldTranscript()    // i2A → Zy.rename / Zy.unlink

    // Flush write buffer for session file (ppH → h2A → H.write)
    flushSessionFileWriter()

    // Register new session with hook subsystem (j9 → MXA.register)
    registerSessionWithHooks(newSessionId)

    // Apply updated MCP connections for new session (cy6 → M → VYA)
    await syncMcpConnections()
```

Analysis basis: CC v2.1.163 bundle.js:+10990004 (`SbH`), +13283773 (`V0`), +205317 (`ncK → Zy.mkdir`), +205376 (`ncK → Zy.appendFile`), +204917 (`i2A → Zy.stat`), +205073 (`i2A → Zy.rename`), +205113 (`i2A → Zy.unlink`), +193190 (`h2A → H.write`), +60323 (`j9 → MXA.register`)

### 5. Transcript File Rotation

The old session transcript file is preserved on disk:

```
function rotateOldTranscript(existingPath):
    stat = await fs.stat(existingPath)          // i2A → Zy.stat

    if existingPath.endsWith(".txt"):           // i2A → H.endsWith
        archivePath = existingPath.slice(0, -4) // i2A → H.slice (removes ".txt")
        try:
            await fs.rename(existingPath, archivePath)  // i2A → Zy.rename
        catch err:
            await fs.unlink(existingPath)               // i2A → Zy.unlink
    // File is now accessible to /resume
```

The `.txt` extension literal used as the suffix sentinel is confirmed at:
Analysis basis: CC v2.1.163 bundle.js:+205021

### 6. Background Session Handling

When the `"isBackgrounded"` flag is set on the current session context, the command takes the `thinClientDispatch: "post-text"` path instead of the full interactive teardown, posting a text event to the thin-client queue rather than running the full synchronous reinit.

Analysis basis: CC v2.1.163 bundle.js:+10990203 (`"isBackgrounded"` literal), registration `thinClientDispatch: "post-text"`

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_cache_eviction_hint` (bundle.js:+10990096) — fired during clear; `tengu_feature_ok` (+1010222), `tengu_feature_bad` (+1010284), `tengu_feature_sad` (+1010365) — general feature outcome events reached transitively; `tengu_session_renamed` (+13196379) — if session is renamed during init; `tengu_repl_hook_finished` (+13316861) — if hooks execute on session start; `tengu_shell_set_cwd` (+8312204) — if working directory is resolved/changed |
| In-memory cache flush | All major caches cleared: skill index, permission cache, compact-state, hook state, sub-agent registry, internal memoisation maps (via `j8A` sub-calls) |
| Session file on disk | Previous session file **preserved** on disk (renamed from `.txt` form or left in place); new session file created under the Claude data directory via `Zy.mkdir` + `Zy.appendFile` |
| Event bus | `"conversation_clear"` emitted pre-flush; `"conversation_reset"` emitted post-flush |
| Hook registration | New session registered with hook subsystem via `MXA.register` (bundle.js:+60323) |
| MCP connections | MCP connection roster re-evaluated for new session (`VYA` → `AbH`, `tU8`) |
| AbortSignal | A timeout-bounded `AbortSignal` is created for the clear operation (`cy6 → AbortSignal.timeout` at +10990052) |
| Write buffer | Session write buffer explicitly flushed (`ppH → h2A → H.write`) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.163 | Initial analysis |

---

## Common Mistakes

1. **Expecting the old context to be gone from disk** — `/clear` only clears the in-memory context window. The previous session transcript remains on disk and is resumable with `/resume`. Use `/clear` when you want a fresh start but may want to revisit history later.
2. **Confusing `/clear` with `/reset` or `/new`** — All three names (`clear`, `reset`, `new`) are registered aliases for the same command and have identical behavior.
3. **Providing a session name with disallowed characters** — The `[name]` argument is normalized (character replacement, last-separator truncation). Names with special characters may be silently sanitized rather than rejected.
4. **Using `/clear` in non-interactive mode without understanding dispatch path** — When `supportsNonInteractive: true` is set and the client is a thin client, the command takes the `post-text` dispatch path rather than the full interactive teardown; callers should not assume synchronous completion of the full reinit sequence.
5. **Expecting MCP tool state to persist** — Clearing the session triggers MCP connection re-evaluation; any per-session MCP state is reset alongside the conversation context.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `tzf` | Main async handler for `/clear` (Arbor-resolved entry point) |
| `cy6` | Core session-clear orchestrator; emits events, flushes caches, coordinates teardown |
| `j8A` | Comprehensive in-memory state flush dispatcher (calls all cache-clear sub-functions) |
| `SbH` | New session bootstrap coordinator (called after clear to init fresh session) |
| `V0` | Session record factory / new session object builder (generates UUID, sets up context) |
| `gL` | Context configuration builder (effort level, model config) |
| `icK` | Session persistence manager (manages session file writes) |
| `ncK` | Session directory + file append worker (`Zy.mkdir`, `Zy.appendFile`) |
| `i2A` | Old transcript rotation logic (`Zy.stat`, `Zy.rename`, `Zy.unlink`) |
| `ppH` | Write buffer flush coordinator |
| `h2A` | Low-level session file writer (`H.write`) |
| `j9` | Hook subsystem registration function (`MXA.register`) |
| `J4` | Session name normalization function |
| `g2A` | Reserved name segment builder (`BcK.map`) |
| `ccK` | Conversation context accessor / state container |
| `OXA` | Conversation state updater |
| `rD` | Working directory resolver and validator |
| `W6` | Event emitter wrapper (emits `"conversation_clear"`) |
| `Mm` | Skill index cache clearer (`H.clearSkillIndexCache`) |
| `Ox9` | Permission / tool-use cache clearer (`LF.clear`) |
| `RyH` | Permission cache rebuild helper |
| `KY8` | Sub-agent registry clearer (`tu.delete`, `hC_.delete`, `t06.delete`) |
| `fY8` | Compact-state map clearer (`vSq.clear`) |
| `Bx9` | Hook-cache clearer (`s06.clear`, `kC_.clear`) |
| `ZOq` | Tool-result cache clearer (`VRH.clear`, `wl_.clear`) |
| `U9q` | Additional map clearer (`kH6.clear`, `MV6.clear`) |
| `wH_` | Node-buffer cache clearer (`nBH.clear`) |
| `ib9` | Utility store clearer (`uz8.clear`) |
| `rKq` | Additional memoisation clearer (`cs.clear`, `dPH.clear`) |
| `MF` | Model-cache clearer (`mN8.clear`) |
| `qH_` | Local buffer clearer (`lBH.clear`) |
| `VYA` | MCP connection roster sync function |
| `AbH` | MCP connection builder/updater |
| `tU8` | MCP connection applicator |
| `kP` | Main REPL agent loop / session runner (called from new session init) |
| `n06` | Session runner bootstrapper (wraps `kP`) |
| `Z5A` | Hook configuration loader |
| `xx8` | Tool execution engine (reached transitively) |
| `X5A` | HTTP hook executor |
| `P5A` | MCP tool hook executor |
| `F1H` | Hook result processor |
| `y$K` | Hook output JSON parser |
| `bx8` | Hook output plain-text handler |
| `Az` | Pending write flush helper |
| `Wx8` | Async write tracker |
| `ICH` | Symlink/worktree state manager |
| `z5A` | Symlink directory creator |
| `CS` | Session log appender |
| `D$H` | File-based session log writer |
| `nm` | Worktree state event emitter |
| `f9H` | Isolation latch handler |
| `zMK` | Async file log appender |
| `dB` | Telemetry batch emitter |
| `PRH` | Session resume helper |
| `SH` | JSON serializer wrapper (`JSON.stringify`) |
| `v8` | Error classifier |
| `R8` | Filesystem error suppressor (ENOENT passthrough) |
| `eH` | String coercer (`String(...)`) |
| `EH` | Error string formatter |
| `uv` | Async utility / promise helper |
| `h6` | Log/trace utility |
| `sz` | Dual-map clearer (`Mm6.clear`, `BF8.clear`) |
| `ED` | Global output-token counter flusher |
| `UD` | Policy settings accessor |
| `Vy` | Conversation context getter |
| `dcK` | Conversation item deleter |
| `aL6` | Session metadata writer |
| `r2A` | Session path resolver |
| `$pH` | Debounced write scheduler (uses `clearTimeout`, `setTimeout`, `setImmediate`) |
| `d3H` | Session directory path builder |
| `Q6` | Filesystem stat/existence check |
| `kH` | Hook execution wrapper (logs errors) |
| `IJ` | Forced shutdown initiator |
| `D` | Process exit / abort controller |
| `UN` | AbortController wrapper |
| `GaH` | CLI event dispatcher (`EV9`) |
| `Wuq` | Internal state sync helper (`I3H`) |
| `g$` | Session render helper |
| `d4` | Render dispatch helper |
| `ly6` | Session reset render path |
| `cF8` | UUID-keyed event emitter (`jm6.emit`) |
| `gn` | Generic render notification |
| `FZ` | Subagent path builder |
| `lM` | Session lock manager |
| `Tq` | Task queue reference |
| `k_` | Module initializer (sets `__esModule`, binds handlers) |
| `G` | Supervisor mode selector (`sk6`, `XK6`) |
| `E` | Remote-control startup event handler |
| `t0` | Settings loader entry point |
| `r_` | Full settings loader (reads `flagSettings`, `userSettings`, `projectSettings`, `localSettings`) |
| `XM` | Session mode selector |
| `TN` | Task notification handler |
| `XG` | Context window garbage collector |
| `XIH` | Internal identifier table |
| `s6` | Bootstrap fetch telemetry handler |
| `P6` | Bootstrap response processor |
| `Nu6` | Core event bus emitter |
| `yP` | Session continuation marker |
| `LJ` | Session lifecycle journal |
| `C1` | UUID factory alias (`fa_.randomUUID`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.