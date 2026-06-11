---
type: feature-spec
feature: "clear"
cc_version: "2.1.168"
updated: "2026-06-11"
tags: ["clear", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.168 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/clear`

> Analysis basis: CC v2.1.168 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.168

---

## Overview

`/clear` starts a brand-new conversation session while preserving the previous session on disk so it can be resumed later with `/resume`. The command accepts an optional `[name]` argument to label the new session. It also supports the aliases `/reset` and `/new`, and is callable in non-interactive (scripted) mode.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `clear` |
| description | Start a new session with empty context; previous session stays on disk (resumable with /resume) |
| argumentHint | `[name]` |
| aliases | `reset`, `new` |
| supportsNonInteractive | `true` |
| thinClientDispatch | `post-text` |
| module_id | `qpq` |
| load_inline | `true` |
| loc_byte | 11020858 |
| loc_byte_end | 11021149 |
| loc_line | 7301 |
| arbor_handler.name | `ywf` |
| arbor_handler.fqn | `claude-2.1.168::ywf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | 0 |

Analysis basis: CC v2.1.168 bundle.js:+11020858

---

## Input Branching

The handler has more than three distinct paths depending on whether an optional session name is provided, whether the session is running in a backgrounded state, and which internal reset sub-routines succeed or fail.

```mermaid
flowchart TD
    A["/clear [name] invoked"] --> B{Argument provided?}
    B -- "yes" --> C[Trim whitespace from argument\nbundle.js:+11020684]
    B -- "no" --> D[Use empty/default session name]
    C --> E[Pass trimmed name to session-init helper]
    D --> E

    E --> F[Emit cache-eviction hint\nbundle.js:+11018863]
    F --> G{Session backgrounded?\nbundle.js:+11018970}
    G -- "yes (isBackgrounded)" --> H[Log 'conversation_clear'\nbundle.js:+11018901\nSkip interactive teardown]
    G -- "no" --> I[Full interactive teardown:\nclear in-memory state,\nflush writers, abort pending\noperations]

    H --> J[Invoke full state-reset routine\n(clearStateForSession)\nbundle.js:+11017719..11018366]
    I --> J

    J --> K[Re-initialise new session context\nbundle.js:+11018771]
    K --> L{New name supplied?}
    L -- "yes" --> M[Apply custom title to new session\nbundle.js:+13234268]
    L -- "no" --> N[New session uses auto-generated ID]
    M --> O[Emit 'conversation_reset'\nbundle.js:+11019985]
    N --> O
    O --> P[Return post-text to caller]
```

---

## Behavioral Spec

### Entry Point — Handler `ywf`

```
async function clearCommandHandler(userInput):
    rawName = userInput.trim()          // bundle.js:+11020684
    trimmedName = rawName if non-empty else null

    emitTelemetry("tengu_cache_eviction_hint")  // bundle.js:+11018863

    // Delegate to the session-lifecycle orchestrator
    await orchestrateSessionClear(trimmedName)
```

Analysis basis: CC v2.1.168 bundle.js:+11020684, +11020720

---

### Session-Lifecycle Orchestrator — `Uh6`

This is the primary async routine that coordinates all sub-steps. It is invoked by `ywf` after the optional name argument is trimmed.

```
async function orchestrateSessionClear(optionalName):
    // 1. Resolve terminal dimensions for the new session render
    terminalSize = resolveTerminalSize()    // via Fh6; bundle.js:+11018759

    // 2. Prepare abort signal with a timeout
    signal = AbortSignal.timeout(...)       // bundle.js:+11018819

    // 3. Build the new session worker set
    newWorkers = buildNewWorkerSet()        // bundle.js:+11019033

    // 4. Tear down existing conversation context
    clearConversationState()               // bundle.js:+11019183

    // 5. Reset all in-memory caches
    clearAllStateCaches(optionalName)      // via m_A; bundle.js:+11019165

    // 6. Validate / set working directory
    resolveWorkingDirectory()              // via qw; bundle.js:+11019174

    // 7. Emit session-reset signal
    emitConversationResetEvent()           // literal "conversation_reset"; bundle.js:+11019985

    // 8. Re-initialise session (spawn new session context)
    await reinitialiseSession(optionalName, newWorkers, signal)
                                           // via LxH → S0; bundle.js:+11018771

    // 9. Apply custom title when name was provided
    if optionalName != null:
        applyCustomTitle(optionalName)     // literal "custom-title"; bundle.js:+13234268

    // 10. Emit completion markers
    emitResetCompletionMarkers()
```

Analysis basis: CC v2.1.168 bundle.js:+11018771, +11019079, +11019183, +11019985

---

### Cache & State Reset — `m_A`

Called during step 5 above; wipes every cached sub-system before the new session object is created.

```
function clearAllStateCaches(optionalName):
    clearSkillIndex()          // via vk → mm; bundle.js:+13191724
    clearContextCache()        // via Cu9; bundle.js:+11017736
    clearProcessCache()        // via hs; bundle.js:+11017755
    clearToolCache()           // via zD8; bundle.js:+6779589
    clearSessionEventCache()   // via YW6; bundle.js:+11017773
    clearHookState()           // via VAH; bundle.js:+6779961
    clearMcpToolCache()        // via DD8; bundle.js:+11018027 (JKq)
    clearPluginState()         // via $m9; bundle.js:+6779973
    clearTuningCaches()        // via fYq, JKq, S6_; bundle.js:+11018018..+11018036
    clearCapabilityRegistries()// via b59, Xu9, od8, T6_, $Iq, vLq; bundle.js:+11018042..+11018076
    // Resolves immediately after all clears
    return Promise.resolve()   // bundle.js:+11018082
```

Analysis basis: CC v2.1.168 bundle.js:+11017719, +11018082

---

### Session Re-Initialisation — `LxH` / `S0`

This routine creates the new blank session and wires up all subsystems.

```
async function reinitialiseSession(optionalName, workers, signal):
    // Emit SessionEnd hook before teardown completes
    runHook("SessionEnd")                  // literal; bundle.js:+13321684

    // Build fresh conversation record
    newSession = createNewSessionRecord(optionalName)  // via S0; bundle.js:+13321715

    // Attach hooks, tool listeners, and MCP state
    attachLifecycleHooks(newSession)
    wireMcpTooling(newSession)
    attachPermissionHandlers(newSession)

    // Emit SessionStart hook
    runHook("SessionStart")                // literal; bundle.js:+13350440

    // Wire up stop / abort handling
    wireAbortHandlers(signal)

    return newSession
```

Analysis basis: CC v2.1.168 bundle.js:+13321657, +13321715, +13370886

---

### Terminal-Size Resolution — `Fh6`

Determines the number of columns/rows available before rendering the new session prompt.

```
function resolveTerminalSize(rawWidth, rawHeight):
    parsed = parseInt(rawWidth, 10)       // bundle.js:+13331126
    if not Number.isFinite(parsed):
        parsed = defaultWidth             // bundle.js:+13331148
    clamped = Math.max(minCols, Math.min(maxCols, parsed))
              // bundle.js:+13331344, +13331357
    return clamped
```

Radix base: `10` (constant at bundle.js:+13331137).

Analysis basis: CC v2.1.168 bundle.js:+13331126

---

### Working-Directory Validation — `qw`

```
function resolveWorkingDirectory(path):
    if not path.isAbsolute(path):         // bundle.js:+8326954
        path = path.resolve(path)         // bundle.js:+8326974
    if not exists(path):                  // via h8; bundle.js:+8327044
        throw Error(...)                  // bundle.js:+8327056
    normalise(path)                       // via TH_ → jO; bundle.js:+1021121
    return normalisedPath
```

Analysis basis: CC v2.1.168 bundle.js:+8326954

---

### Session-File Persistence — `_iK`

Manages the on-disk representation of the cleared (now-closed) session so it remains resumable.

```
async function persistSessionToDisk(session):
    dir = path.dirname(sessionFilePath)   // bundle.js:+206115
    ensure directory exists               // via KI; bundle.js:+206145

    // Rotate old file if needed
    rotateIfNeeded(sessionFilePath)       // via ll8; bundle.js:+206284
      // ll8: stat → if ends with ".txt" → rename; else unlink
      // literal ".txt"; bundle.js:+205511

    byteLen = Buffer.byteLength(payload)  // bundle.js:+206290

    // Append to session log
    appendToFile(dir, payload)            // via HiK; bundle.js:+206349
    updateSessionIndex()                  // via $0A; bundle.js:+206252

    // Register cleanup hook
    registerCleanup()                     // via j9; bundle.js:+206445
```

Analysis basis: CC v2.1.168 bundle.js:+206115, +206284, +205511

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_cache_eviction_hint` (bundle.js:+11018863) — fired on every `/clear` invocation |
| Telemetry (contextual) | `tengu_repl_hook_finished`, `tengu_run_hook`, `tengu_session_renamed`, `tengu_shell_set_cwd` — fired by sub-routines during session teardown/re-init |
| Hook events emitted | `SessionEnd` (before tear-down), `SessionStart` (after new session created) |
| in-memory caches cleared | Skill index, context cache, process cache, tool cache, session-event cache, hook state, MCP tool cache, plugin state, tuning caches, capability registries |
| Disk side effects | Previous session file stays on disk (renamed/rotated if needed); new session file/directory created; session index updated |
| AbortController | A new `AbortSignal.timeout` is created for the re-init path (bundle.js:+11018819); the previous abort controller registered under the key `"abortController"` (bundle.js:+11019519) is cleared |
| Conversation-reset event | Emits internal `"conversation_reset"` signal (bundle.js:+11019985); separate `"conversation_clear"` string logged when backgrounded (bundle.js:+11018901) |
| appState changes | `isBackgrounded` flag consulted (bundle.js:+11018970); custom-title field set when `[name]` argument present (bundle.js:+13234268) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.168 | Initial analysis |

---

## Common Mistakes

1. **Expecting immediate tool-state continuity** — `/clear` wipes all in-memory tool and MCP caches. Any tools that were loaded or authenticated in the previous session must re-initialise after a clear.
2. **Confusing `/clear` with a hard delete** — the previous session is preserved on disk and can be restored with `/resume`. `/clear` only resets the in-memory conversation context.
3. **Providing a name with leading/trailing spaces** — the argument is trimmed before use (bundle.js:+11020684), so `"/clear  my-session  "` and `"/clear my-session"` produce the same result.
4. **Using `/clear` mid-hook execution** — the command is intended for REPL use; calling it while a hook is running may conflict with the hook's abort/cleanup paths (see `SessionEnd` hook ordering at bundle.js:+13321684).
5. **Expecting the alias `/new` to behave differently** — `/new` and `/reset` are registered as exact aliases and go through the same `ywf` handler with identical behaviour.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `ywf` | Main handler for `/clear` (AsyncFunction; Arbor resolution via module_id `qpq`) |
| `Uh6` | Session-lifecycle orchestrator called by `ywf` |
| `Fh6` | Terminal-size resolver (parseInt + clamp) |
| `LxH` | Session re-initialisation wrapper |
| `S0` | Core new-session builder / state wirer |
| `m_A` | Bulk cache-reset routine (clears all sub-system caches) |
| `_iK` | Session file persistence handler (disk write/rotate) |
| `ll8` | Session file rotation logic (stat, rename, unlink) |
| `HiK` | File append + directory-creation helper |
| `$0A` | Session index updater |
| `qw` | Working-directory validator (absolute path check + normalise) |
| `TH_` | Working-directory normaliser using async-local store |
| `jO` | Path normalise (NFC Unicode) helper |
| `npH` | Buffered writer flush / timer management |
| `YKH` | Output writer finalisation helper |
| `j9` | Cleanup hook registration |
| `B76` | Session directory builder |
| `vk` | Skill-index reset entry point |
| `mm` | Skill-index cache clear (`clearSkillIndexCache`) |
| `Cu9` | Context cache clear (clears `bF` Map) |
| `DhH` | Context persistence helper |
| `hs` | Process / session-state cache reset coordinator |
| `zD8` | Tool-session cache eviction (Map deletes) |
| `YW6` | Session-event cache reset |
| `VAH` | Hook-state cache reset |
| `DD8` | LCq cache clear |
| `$m9` | Plugin-state cache clear (gG6, tb_) |
| `fYq` | fCH / Qn_ cache clear |
| `JKq` | W66 / eV6 cache clear |
| `S6_` | xFH cache clear |
| `Xu9` | gY8 cache clear |
| `T6_` | bFH cache clear |
| `$Iq` | fy6-based capability registry flush |
| `vLq` | zt / G2H cache clear |
| `vm` | tv8 cache clear |
| `od8` | H.has-based state check |
| `mG6` | Agent re-connection / session start coordinator |
| `hP` | Full agent-loop re-initialisation (large orchestrator) |
| `dMA` | Hook descriptor loader |
| `BL` | Session-context builder helper |
| `EUH` | Writer flush wrapper |
| `nWA` | Low-level stream write helper |
| `RH` | JSON stringify helper |
| `G4` | Session name sanitiser |
| `K0A` | Name token mapper |
| `snK` | Session init sub-helper |
| `IPA` | Session ID generator |
| `H9` | Model-name resolver |
| `s9` | Model-alias normaliser |
| `Dz` | Pending-request drain/flush |
| `Uu8` | Request-tracking set manager |
| `LbH` | Symlink / worktree path manager |
| `RMA` | Worktree directory creator |
| `R86` | Worktree file-open helper |
| `lZ` | Subagent path builder |
| `Zp` | Session-rename emitter |
| `y9H` | Isolation-latch writer |
| `A3K` | Async append-file + mkdir helper |
| `_R` | Session-rename orchestrator |
| `Q$H` | Sync append + mkdir helper |
| `Bh6` | Session-rename trigger |
| `fQ8` | UUID + event emitter for session events |
| `Apq` | Hook-orchestration entry (HOH delegation) |
| `s$` | Session hook runner |
| `r4` | Hook-callback dispatcher |
| `xF` | Plugin-hook loader and executor |
| `CFH` | Log-file writer with timestamp |
| `C8` | Sync append-file log helper |
| `BLH` | Policy-settings / hook-type set builder |
| `w` | Daemon worker manager |
| `dwA` | Daemon worker teardown / replacement |
| `pwA` | Daemon spare-session claimer |
| `T$A` | Daemon session-file writer |
| `F$5` | Daemon claim-send with timeout |
| `B$5` | Daemon claim-frame builder |
| `D6` | Background memory tracker |
| `lx8` | macOS memory probe |
| `eX6` | Pinned-session reader |
| `SgL` | Pinned-session directory scanner |
| `e9` | Session-state file reader/writer |
| `VY` | Session-state activator |
| `zf` | Session socket-path builder |
| `gg` | Session roster entry writer |
| `yE` | Session roster split/join helper |
| `PS6` | Session socket-path writer |
| `q$H` | Session socket path resolver |
| `Q` | Daemon process lifecycle manager |
| `My` | Binary frame packer (Buffer ops) |
| `GH` | String coercion helper |
| `AA` | Error string coercion helper |
| `V8` | ENOENT / EISDIR error classifier |
| `h8` | Filesystem error classifier |
| `Tf` | Generic error classifier |
| `R6` | Low-level async state transition helper |
| `ev` | EventEmitter wrapper |
| `W_` | Terminal-output helper |
| `uR` | Output renderer helper |
| `TM` | Terminal message formatter |
| `SO` | Terminal output sink |
| `Ky` | Keyboard input handler |
| `G` | MCP connection manager |
| `M` | MCP server state manager |
| `xbH` | MCP tool list builder |
| `PF8` | MCP connection result applicator |
| `cDA` | MCP client/server sync orchestrator |
| `hH` | Hook error logger |
| `CH` | Session-complete callback |
| `SH` | Session-start callback |
| `aEH` | Session-cleanup helper |
| `o6` | Feature-flag check wrapper |
| `l` | Feature-ok event emitter |
| `J6` | Feature-bad/sad event emitter |
| `XF` | Telemetry event emitter with dedup |
| `Hm8` | Hook subprocess spawner and output parser |
| `dMA` | Hook type/plugin descriptor resolver |
| `pMA` | HTTP hook executor |
| `TOK` | Hook output parser |
| `eu8` | Hook output JSON parser |
| `O9H` | Hook metadata extractor |
| `UMA` | MCP-tool hook executor |
| `aN` | Async timeout/abort wrapper |
| `au8` | Hook input builder |
| `iN` | Hook-result normaliser |
| `EAH` | Hook error payload builder |
| `Z$H` | Hook environment variable injector |
| `IRH` | Hook post-processing finaliser |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.