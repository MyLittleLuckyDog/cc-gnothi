---
type: feature-spec
feature: "goal"
cc_version: "2.1.162"
updated: "2026-06-04"
tags: ["goal", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.162 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/goal`

> Analysis basis: CC v2.1.162 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.162

---

## Overview

The `/goal` command sets a persistent goal condition that Claude Code will actively pursue, continuing to work until the stated condition is satisfied. When invoked with a condition string, it registers a stop-hook that evaluates goal completion after each agent turn; when invoked with `clear` (or without arguments), it removes any active goal. The command mutates `appState` directly and injects a system-level directive into the conversation.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `goal` |
| description | `Set a goal — keep working until the condition is met` |
| argumentHint | `[<condition> \| clear]` |
| immediate | `true` |
| module_id | `sKK` |
| load_inline | `true` |
| loc_byte | `12913077` |
| loc_byte_end | `12913280` |
| loc_line | `9472` |
| arbor_handler.name | `Sbf` |
| arbor_handler.fqn | `claude-2.1.162::Sbf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.162 bundle.js:+12913077

---

## Input Branching

The handler distinguishes at least four meaningful input paths (no argument, `clear`, a valid condition string, and an oversized condition string), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/goal invoked"]) --> B{Argument present?}
    B -- No argument --> C[Read current goal from appState]
    C --> D{Goal already set?}
    D -- No --> E["Display: 'No goal set'"]
    D -- Yes --> F[Display current goal text]
    B -- Argument present --> G{arg.trim().toLowerCase() == 'clear'?}
    G -- Yes --> H[Remove goal from appState\nUnregister stop-hook\nEmit tengu_stop_hook_removed]
    G -- No --> I{Condition too long?}
    I -- Yes --> J[Reject with 'too_long' error\nEmit goal_set / too_long telemetry]
    I -- No --> K[Trim & store condition in appState\nInject system message with goal text\nRegister stop-hook via Je_ / c_6\nEmit tengu_stop_hook_added\nEmit goal_set telemetry]
    K --> L[Append 'goal' message op to conversation\nGenerate random UUID for attachment\nEmit tengu_feature_ok]
    H --> M([Done])
    E --> M
    F --> M
    J --> M
    L --> M
```

Analysis basis: CC v2.1.162 bundle.js:+12911672, +12911778, +12911792, +12911806, +12911831, +12911917, +12911928

---

## Behavioral Spec

### 1. Entry Point — Handler `Sbf` (AsyncFunction)

```
async function goalCommandHandler(context, rawArg):
    trimmedArg = rawArg.trim()                    // Sbf → A.trim

    if trimmedArg is empty:
        return displayCurrentGoal(context)        // Sbf → H (display branch)

    if isSkipSignal(trimmedArg):                  // literal "skip" at +12911778
        return                                    // early exit

    if goalAlreadyActive(context):               // Sbf → HI8 (zff.has / toLowerCase)
        // check existing goal state
        pass

    if trimmedArg.toLowerCase() == "clear":
        return clearGoal(context)                // Sbf → l_6 (clear path)
    
    result = setGoal(context, trimmedArg)        // Sbf → c_6 (set path)
    emitTelemetry("goal_set", ...)              // +12911917
    return result
```

Analysis basis: CC v2.1.162 bundle.js:+12911672, +12911760, +12911792, +12911806, +12912040, +12912153

---

### 2. Display Current Goal — `H` (bootstrap/fetch helper)

When no argument is supplied, the handler calls `H`, which performs a bootstrapped API fetch sequence:

```
function displayCurrentGoal(context):
    log("[Bootstrap] Fetching")                  // literal at +15590993
    set headers: "Content-Type: application/json"  // +15591078, +15591093
    set headers: "User-Agent: ..."               // +15591112
    timeout = 5000 ms                            // literal at +15591194

    response = await fetchWithTimeout(url, headers, timeout)

    if response ok:
        log("[Bootstrap] Fetch ok")              // +15591367
        parseAndDisplay(response)
    else:
        log("parse_failed")                      // +15591337
        emit telemetry "api_bootstrap_fetch"     // +15591315

    applyMessageToConversation(context, currentGoalText)
```

> Note: `H` also calls `_3`, `AY_`, `LHH`, `bJ`, `a1`, `SA5`, and `t6`, suggesting it builds a rich goal-status display including conversation-history parsing and model-name resolution.

Analysis basis: CC v2.1.162 bundle.js:+15590991, +15591029, +15591125, +15591164, +15591203, +15591312

---

### 3. Goal-Active Check — `HI8`

```
function goalAlreadyActive(context):
    normalized = context.arg.toLowerCase()       // HI8 → H.toLowerCase at +10746758
    return activeGoalSet.has(normalized)         // HI8 → zff.has at +10746750
```

Analysis basis: CC v2.1.162 bundle.js:+12911792, +10746750, +10746758

---

### 4. Clear Goal — `l_6`

```
async function clearGoal(context):
    s6Result = buildClearPayload()               // l_6 → S6 at +10747943
    d6Result = removeGoalEntry(context)          // l_6 → d_6 at +10747950

    previousAppState = context.getAppState()     // l_6 → H.getAppState at +10747954
    newAppState = removeGoalKey(previousAppState)
    context.setAppState(newAppState)             // l_6 → H.setAppState at +10748083

    context.applyMessageOp("append", ...)        // l_6 → H.applyMessageOp at +10748152
    attachmentId = generateUUID()                // l_6 → _Sq → thq.randomUUID at +10748303
    
    emit telemetry "tengu_stop_hook_removed"     // at +10748209
    
    renderResult = buildJSXResult(context, ...)  // l_6 → c, E6
    return renderResult
```

Analysis basis: CC v2.1.162 bundle.js:+10747943, +10747950, +10747954, +10748083, +10748152, +10748194, +10748207, +10748209

---

### 5. Set Goal — `c_6`

```
async function setGoal(context, condition):
    // Gate checks
    hooksGatePass  = checkGate("hooks_gate")     // literal at +10747347
    trustGatePass  = checkGate("trust_gate")     // literal at +10747401

    // Build stop-hook registration
    stopHookPayload = buildStopHookPayload(       // c_6 → Je_ at +10747451
        action = "Stop",                          // literal at +10747159
        kind   = "prompt",                        // literal at +10747266
        condition = condition
    )

    timestamp = Date.now()                        // c_6 → Date.now at +10747700
    tokenBudget = computeTokenBudget()            // c_6 → GJ → outputTokens

    previousAppState = context.getAppState()      // c_6 → _.getAppState at +10747536
    updatedState = mergeGoalIntoState(
        previousAppState,
        goalText = condition,
        goalKind = "goal"                         // literal at +10748243
    )
    context.setAppState(updatedState)             // c_6 → _.setAppState at +10747738

    context.applyMessageOp("append", ...)         // c_6 → _.applyMessageOp at +10747780
    //   messageKind = "attachment"               // literal at +10748285

    attachmentId = generateUUID()                 // c_6 → _Sq at +10747822
    
    emit telemetry "tengu_stop_hook_added"        // at +10747837
    
    systemMsg = buildSystemDirective(condition)   // type "system" literal at +12911875
    renderResult = buildJSXResult(context, ...)   // c_6 → c, E6, hH

    emit telemetry "goal_status" event            // literal at +10748372

    return renderResult
```

Analysis basis: CC v2.1.162 bundle.js:+10747347, +10747401, +10747451, +10747536, +10747700, +10747738, +10747780, +10747822, +10747835, +10747837, +10747888, +10747901

---

### 6. Stop-Hook Builder — `Je_`

```
function buildStopHookPayload(action, kind, condition):
    base = buildBaseHook(action)                  // Je_ → dU at +10747312
    extended = extendWithPromptKind(base, kind)   // Je_ → xY at +10747318
    filtered = applyPolicySettings(extended)      // Je_ → U_ at +10747365
                                                  // m8 → policySettings literal +3280463
    wrapped = wrapInLifecycle(filtered)           // Je_ → Lf at +10747372
    return wrapped
```

The lifecycle wrapper `Lf` → `yWL` orchestrates async resolution via `bY.resolve` and manages intermediate states (`tH`, `UmH`, `T9`, `C6`, `ucH`, `xQ`, `x6`).

Analysis basis: CC v2.1.162 bundle.js:+10747312, +10747318, +10747347, +10747365, +10747372, +10747401

---

### 7. Condition Validation

```
function validateCondition(condition):
    if condition is too long:                     // "too_long" literal at +12911928
        return error("too_long")
    // Normal flow continues to setGoal
```

The exact character/byte limit is not directly exposed as a named constant at depth ≤ 2; `Buffer.byteLength` is called in the write path (`EgK` → `Buffer.byteLength` at +205513), suggesting byte-length enforcement rather than character counting.

Analysis basis: CC v2.1.162 bundle.js:+12911928, +205513

<!-- TODO: exact maximum condition length constant not found in depth-2 traversal; needs --depth 4 -->

---

### 8. File-write / Persistence Path — `EgK`

The goal condition is persisted to disk through a multi-step write pipeline:

```
function persistGoalToDisk(content, contextDir):
    logDir = path.dirname(contextPath)            // EgK → Qe.dirname at +205339
    resolvedPath = resolvePath(logDir)            // EgK → Xy at +205368
    
    if fileExceedsLimit(content):
        rotateLogs(...)                           // EgK → HPA (rename/unlink .txt files)
    
    byteLen = Buffer.byteLength(content)          // EgK → Buffer.byteLength at +205513
    
    writeChunk(content, resolvedPath)             // EgK → GgK.bind at +205572
    //   mkdir if missing                         // GgK → jy.mkdir at +205060
    //   appendFile                               // GgK → jy.appendFile at +205119

    registerWithShutdown(handle)                  // EgK → J9 → jJA.register at +60123
```

A log-rotation guard uses `EISDIR` error code (`+175445`) to skip directory entries, and `.txt` extension is used for rotated files (`+204765`). Rotation keeps at most 4 prior files (literal `4` at `+204787`).

Analysis basis: CC v2.1.162 bundle.js:+205306, +205339, +205368, +205445, +205458, +205475, +205507, +205513, +205546, +205563, +205572, +205668

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_stop_hook_added` | Emitted when a new goal is successfully registered; bundle.js:+10747837 |
| Telemetry: `tengu_stop_hook_removed` | Emitted when goal is cleared (explicit `clear` argument or teardown); bundle.js:+10748209 |
| Telemetry: `tengu_feature_ok` | Emitted on successful feature path completion; bundle.js:+1008233 |
| Telemetry: `tengu_feature_sad` | Emitted on feature error path; bundle.js:+1008376 |
| Telemetry: `api_bootstrap_fetch` | Emitted during bootstrap display fetch; bundle.js:+15591315 |
| Literal event string: `goal_set` | Recorded in session telemetry on goal set; bundle.js:+12911917 |
| Literal event string: `goal_status` | Recorded in appState telemetry field; bundle.js:+10748372 |
| appState changes | `goal` key written/cleared via `setAppState` (bundle.js:+10747738, +10748083) |
| Stop-hook registration | A "Stop"-action stop-hook is registered via `jJA.register` (bundle.js:+60123) when goal is set; removed on clear |
| Message operations | `applyMessageOp("append", ...)` appends an `attachment`-type message (bundle.js:+10748175, +10748285) |
| UUID generation | Each goal attachment is assigned a fresh `crypto.randomUUID()` (bundle.js:+10748303) |
| System message injection | A `"system"`-typed directive is injected into the conversation (bundle.js:+12911875) |
| File persistence | Goal data is appended to a managed log file via `appendFile`; rotation at 4 files with `.txt` suffix (bundle.js:+205060, +205119, +204765, +204787) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.162 | Initial analysis |

---

## Common Mistakes

1. **Passing a very long condition string** — The handler enforces a byte-length limit and will reject conditions that are too long with a `too_long` error (bundle.js:+12911928). Keep conditions concise.
2. **Expecting `/goal` alone to clear the goal** — Invoking `/goal` with no argument displays the current goal (or "No goal set"); it does not clear it. Use `/goal clear` to remove an active goal (bundle.js:+12911831).
3. **Assuming multiple concurrent goals are supported** — The implementation stores a single `goal` key in `appState` and a single stop-hook; setting a new goal while one is active will overwrite the previous one without a warning prompt.
4. **Confusing `skip` with `clear`** — The literal `"skip"` (bundle.js:+12911778) is an internal guard signal that causes an early silent return, not a user-facing synonym for `clear`.
5. **Expecting immediate task completion** — `/goal` sets a *condition* that the agent evaluates via a stop-hook after each turn. The agent will continue looping until the condition evaluates as satisfied; it does not execute the goal as a one-shot command.
6. **Running in environments that block file I/O** — The persistence layer uses `fs.appendFile` and `fs.mkdir`; sandboxed or read-only environments will cause the write path to fail silently or throw.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Sbf` | Main async handler for `/goal` command (arbor_handler) |
| `A` | Argument string variable / generic accumulator in call contexts |
| `f` | File-handle / stream object in write pipeline |
| `q` | Secondary collection/handle (Set or queue) in write pipeline |
| `L` | Write-lifecycle manager (add / finally / delete) |
| `H` | Bootstrap fetch + display-current-goal function |
| `v` | Internal write/format dispatch function |
| `PgK` | Protocol-layer helper (calls Xy, XgK, PJA) |
| `PJA` | Lower-level protocol formatter (calls GUK, EUK) |
| `SH` | JSON serialisation helper |
| `_` | Context / appState accessor object |
| `V4` | String-replacement / slice utility |
| `rXA` | Map-over-model-list utility |
| `WpH` | Write-path wrapper |
| `pXA` | Low-level write helper (H.write) |
| `EgK` | File-persistence orchestrator (mkdir, appendFile, rotate) |
| `dmH` | Debounced timer / batch-write scheduler (setTimeout, setImmediate) |
| `E3H` | Path-join / suffix builder for persistence |
| `i6` | Inline helper within EgK path |
| `zL6` | EISDIR-guard / volume check helper |
| `_PA` | Path-join helper (Qe.join, S6) |
| `HPA` | File-rotation handler (stat, rename, unlink .txt) |
| `GgK` | Chunked append-file writer (mkdir + appendFile) |
| `J9` | Shutdown-handler registration (jJA.register) |
| `_3` | Conversation-history accessor in display path |
| `AY_` | Argument parser (split, trim, indexOf, slice) |
| `LHH` | Known-goal-ID set membership check (Y94.has) |
| `bJ` | String-replacement sanitiser for display |
| `a1` | High-level message formatter (calls oHH, qq, rX) |
| `oHH` | Message-structure builder (k0, OqH, yA, Dd) |
| `k0` | Token-count or primitive builder |
| `OqH` | Content-block constructor |
| `Dd` | Content-part parser / chunker |
| `qq` | Model-alias normaliser (trim, toLowerCase, replace) |
| `Q0` | Model-alias lookup (BKH) |
| `pKH` | Model-family membership check (mKH.includes) |
| `qI` | Model-tier resolver (UM, G5) |
| `LQH` | Fallback model-tier resolver (G5) |
| `PE` | Provider-type classifier (firstParty, UM, G5, wA) |
| `RJ1` | Retry-wrapper for PE |
| `UM` | wA-based auth helper |
| `Xt6` | Model-allowlist check (z8L.includes) |
| `fQH` | Feature-flag gate helper (tH) |
| `rX` | Compound message builder (qq, g0) |
| `g0` | Rich message assembler (WA, H6H, ozH, MQH, PE, A2, UM, wA, G5, qI) |
| `t6` | Telemetry event emitter (c, Z6) |
| `c` | Low-level telemetry record constructor |
| `Z6` | Telemetry transport dispatcher (Zx6) |
| `Zx6` | Telemetry sink / serialiser |
| `HI8` | Active-goal-set membership check (zff.has, toLowerCase) |
| `l_6` | Clear-goal orchestrator (getAppState, setAppState, applyMessageOp, UUID) |
| `S6` | Nv-based state serialiser |
| `Nv` | Primitive state helper |
| `d_6` | Goal-entry removal helper (rPH, A.push) |
| `rPH` | Map-entry setter (K.set, FMq) |
| `K` | Padded-column formatter (L.map, f.padEnd) |
| `FMq` | Array-map helper (H.map) |
| `_Sq` | UUID generator wrapper (thq.randomUUID) |
| `E6` | JSX render helper (Zx6) |
| `c_6` | Set-goal orchestrator (Je_, t6, S6, d_6, getAppState, setAppState, applyMessageOp, _Sq, GJ) |
| `Je_` | Stop-hook payload builder (dU, xY, U_, Lf) |
| `dU` | Base stop-hook constructor (m8) |
| `m8` | Policy-settings accessor (Xc6, gQ, policySettings) |
| `xY` | Prompt-kind extender for stop-hook (m8, yA) |
| `U_` | Gate-check applicator (hooks_gate, trust_gate) |
| `Lf` | Stop-hook lifecycle wrapper (yWL) |
| `yWL` | Async lifecycle manager (tH, UmH, T9, C6, ucH, xQ, x6, bY.resolve) |
| `GJ` | Token-budget calculator (NmH, Object.values, outputTokens) |
| `hH` | JSX error-state renderer (c, Z6) |
| `_I8` | Post-set cleanup / finaliser |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.