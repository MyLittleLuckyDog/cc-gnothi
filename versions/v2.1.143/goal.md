---
type: feature-spec
feature: "goal"
cc_version: "2.1.143"
tags: ["goal", "commands", "slash-commands"]
updated: "2026-05-18"
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.143 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/goal`

> Analysis basis: CC v2.1.143 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.143

---

## Overview

The `/goal` slash command lets the user declare a natural-language condition that Claude Code must keep working toward until it is satisfied. Internally the command installs or removes a stop-hook that is evaluated after every agent turn; if the condition is not yet met the agent loop continues rather than pausing for user input. Passing the special keyword `clear` (or providing no argument when a goal is already active) removes the active goal and unregisters the hook.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `goal` |
| description | `Set a goal — keep working until the condition is met` |
| argumentHint | `[<condition> \| clear]` |
| immediate | `true` |
| module_id | `bvq` |

Analysis basis: CC v2.1.143 bundle.js:+11937578

---

## Input Branching

The command handler (`commandEntryPoint`) receives the raw argument string, trims it, and routes execution through four distinct paths.

```mermaid
flowchart TD
    A(["/goal invoked"]) --> B["Trim argument string\n(A.trim)"]
    B --> C{Argument present?}
    C -- No --> D{Goal currently set?}
    D -- No --> E["Render 'No goal set' notice\n(system message)"]
    D -- Yes --> F["Clear active goal\n→ removeGoalHook path"]
    C -- Yes --> G{arg.toLowerCase == 'clear'?}
    G -- Yes --> F
    G -- No --> H{Is arg in skip-list?\n(RO8 / skipWordCheck)}
    H -- Yes --> I["Silently skip / no-op"]
    H -- No --> J["Set new goal\n→ installGoalHook path"]
    F --> K["Emit tengu_stop_hook_removed\nEmit tengu_feature_ok"]
    J --> L["Emit tengu_stop_hook_added\nEmit tengu_feature_ok or tengu_feature_sad"]
    E --> M([Done])
    K --> M
    L --> M
    I --> M
```

Analysis basis: CC v2.1.143 bundle.js:+11936167 (trim), +11936255 (clear path), +14528099 (toLowerCase), +11936273 (skip literal), +11936326 (no-goal notice), +11936287 (skip-word check)

---

## Behavioral Spec

### Argument Normalisation

```
function normaliseArgument(rawInput):
    trimmed = rawInput.trim()                 // strip leading/trailing whitespace
    return trimmed
```

Analysis basis: CC v2.1.143 bundle.js:+11936167

---

### Skip-Word Gate

Before any state change the normalised argument is tested against an internal set of reserved or disallowed words.

```
function isSkippedWord(word):
    lower = word.toLowerCase()
    return SKIP_WORD_SET.has(lower)           // SKIP_WORD_SET is an internal Set<string>
```

If `isSkippedWord` returns `true` the command performs no further action.

Analysis basis: CC v2.1.143 bundle.js:+11936287 (call to skipWordCheck), +9108002 (set `.has`), +9108010 (`.toLowerCase`)

---

### "No Goal Active" Notice

When the user invokes `/goal` with no argument and no goal is currently stored in app state, a system-role message is appended to the conversation:

```
function handleEmptyWithNoGoal():
    emit system-role message with text "No goal set"
```

Analysis basis: CC v2.1.143 bundle.js:+11936326 (string literal `"No goal set"`), +11936370 (string literal `"system"`)

---

### Installing a New Goal (`installGoalHook`)

```
function installGoalHook(condition, appStateHandle):
    existingGoal = appStateHandle.getAppState().goal      // read current state
    hookList     = buildHookList(existingGoal)            // giH: collect existing hooks
    hookList.push({ type: "prompt", ... })                // register new stop-hook entry

    uuid         = generateUUID()                         // Go1 → Po1.randomUUID
    goalRecord   = {
        id:        uuid,
        type:      "goal",
        content:   condition,
        role:      "attachment",
        status:    "goal_status",
    }

    timestamp    = Date.now()
    outputCount  = collectOutputTokenCounts()             // tj: sums outputTokens across turns

    appStateHandle.setAppState({ goal: goalRecord, hooks: hookList, ... })
    appStateHandle.applyMessageOp("append", goalRecord)

    emitTelemetry("tengu_stop_hook_added")
    emitFeatureResult(success=true)                       // SH → tengu_feature_ok
```

Analysis basis: CC v2.1.143 bundle.js:+9108518 (`"prompt"`), +9108527 (`.push`), +9109488 (`"goal"`), +9109529 (`"attachment"`), +9109616 (`"goal_status"`), +9108788 (`.getAppState`), +9108990 (`.setAppState`), +9109032 (`.applyMessageOp`), +9109074 (Go1 / UUID), +9108952 (`Date.now`), +9108977 (output-token collection), +9109087 (`d` call), +9109149 (SH)

---

### Removing an Active Goal (`removeGoalHook`)

```
function removeGoalHook(appStateHandle):
    appStateHandle.getAppState()                          // read current state
    closePrimaryStream()                                  // f → A.close  (loc +14513628)
    closeSecondaryStream()                                // f → q.close  (loc +14513638)
    invokeCleanupCallback()                               // f → L        (loc +14513778)

    appStateHandle.setAppState({ goal: null, hooks: [] })
    appStateHandle.applyMessageOp("append", removalNotice)

    uuid = generateUUID()                                 // Go1 → Po1.randomUUID

    emitTelemetry("tengu_stop_hook_removed")
    emitFeatureResult(success=true)                       // d → tengu_feature_ok
```

Analysis basis: CC v2.1.143 bundle.js:+14513628 (close A), +14513638 (close q), +14513778 (L cleanup), +9109202 (`.getAppState`), +9109331 (`.setAppState`), +9109400 (`.applyMessageOp`), +9109423 (`"append"`), +9109442 (Go1), +9109455 (`d`), +9109457 (`tengu_stop_hook_removed`)

---

### Stop-Hook Evaluation (post-turn callback)

After each agent turn the registered stop-hook fires. The implementation uses a small randomised delay before re-evaluating.

```
function stopHookCallback():
    delay = Math.random() * 2 + 1        // random jitter: between 1 and 3 (approx)
    setTimeout(evaluateGoalCondition, delay * BASE_UNIT)
```

`Math.random` is seeded fresh each invocation; the constants `2` and `1` gate the jitter range.

Analysis basis: CC v2.1.143 bundle.js:+12638154 (literal `2`), +12638170 (literal `1`), +12638156 (`Math.random`), +12638193 (`setTimeout`)

---

### Hook-Gate Guards (`hooksGateCheck` / `trustGateCheck`)

Before a new stop-hook is pushed onto the hook list two gate checks run:

```
function buildHookList(existingGoal):
    passHooksGate = checkGate("hooks_gate")    // Yk_ → hooks_gate check
    passTrustGate = checkGate("trust_gate")    // Yk_ → trust_gate check

    if not passHooksGate or not passTrustGate:
        return existingHookList unchanged

    // proceed to mutate hook list
    return updatedHookList
```

Analysis basis: CC v2.1.143 bundle.js:+9108599 (`"hooks_gate"`), +9108653 (`"trust_gate"`), +9108703 (QiH → Yk_)

---

### Output-Token Accumulation

When a goal is set, the current cumulative output-token count is snapshotted via:

```
function collectOutputTokenCounts():
    values = Object.values(turnMap)         // tj → Object.values
    return sum of value.outputTokens        // "outputTokens" field per turn record
```

Analysis basis: CC v2.1.143 bundle.js:+41736 (eyH), +41740 (`Object.values`), +41769 (`"outputTokens"`), +9108977 (call site)

---

### Telemetry Result Reporting

Two helper wrappers emit success/failure telemetry:

```
function emitFeatureOk():
    emitTelemetry("tengu_feature_ok")    // SH path

function emitFeatureSad():
    emitTelemetry("tengu_feature_sad")   // J8 path
```

Both are called via the shared low-level dispatcher (`d`).

Analysis basis: CC v2.1.143 bundle.js:+955068 (`tengu_feature_ok`), +955201 (`tengu_feature_sad`), +955066 (SH→d), +955199 (J8→d)

---

### Clear-Keyword Detection

```
function isClearKeyword(arg):
    return arg.toLowerCase() == "clear"
```

The comparison is case-insensitive; `"Clear"`, `"CLEAR"` etc. all trigger removal.

Analysis basis: CC v2.1.143 bundle.js:+14528099 (`.toLowerCase`), +14528173 (literal `40` — character-index bound used internally for the truncated display label)

---

### Goal-Set Telemetry Event

When the full install path completes successfully, the discrete event `"goal_set"` is emitted alongside the standard feature-ok event. If the condition string exceeds an internal length budget the discriminator `"too_long"` is recorded instead.

```
function reportGoalSetOutcome(condition):
    if condition.length > MAX_CONDITION_LENGTH:
        emit "goal_set", { result: "too_long" }
    else:
        emit "goal_set", { result: "ok" }
```

Analysis basis: CC v2.1.143 bundle.js:+11936412 (`"goal_set"`), +11936423 (`"too_long"`), +11936409 (J8 call site)

Maximum condition display label length: 40 characters (bundle.js:+14528173)
<!-- TODO: absolute MAX_CONDITION_LENGTH byte limit not found in depth-2 traversal; needs --depth 4 -->

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — stop hook added | `tengu_stop_hook_added` (bundle.js:+9109089) |
| Telemetry — stop hook removed | `tengu_stop_hook_removed` (bundle.js:+9109457) |
| Telemetry — success | `tengu_feature_ok` (bundle.js:+955068) |
| Telemetry — failure | `tengu_feature_sad` (bundle.js:+955201) |
| Hook registration | A `"prompt"`-type stop-hook is pushed into the app-state hook list on goal set (bundle.js:+9108518, +9108527) |
| Hook removal | Both primary and secondary streams are closed and a cleanup callback is invoked on goal clear (bundle.js:+14513628, +14513638, +14513778) |
| appState changes — set | `goal` record written; hook list mutated; message appended via `"append"` op (bundle.js:+9108990, +9109032) |
| appState changes — clear | `goal` field nulled; hook list cleared; removal notice appended (bundle.js:+9109331, +9109400) |
| UUID generation | A new `crypto.randomUUID()` is issued for each goal record and each removal notice (bundle.js:+9109547) |
| Output-token snapshot | Cumulative `outputTokens` across all turn records snapshotted at goal-set time (bundle.js:+41769) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.143 | Initial analysis |

---

## Common Mistakes

1. **Passing `Clear` or `CLEAR` instead of lowercase** — the comparison is case-insensitive so any casing works, but users expecting case-sensitivity may be surprised when their condition text that starts with "clear" is interpreted as a removal command.
2. **Invoking `/goal` with no argument to clear** — when no argument is given and a goal *is* active, the goal is cleared silently; users expecting a status display should use `/goal` when no goal is set to see the "No goal set" notice.
3. **Using a reserved skip-word as the condition** — words in the internal skip-word set are silently ignored; the command produces no output and no goal is stored (bundle.js:+11936273, +11936287).
4. **Assuming the agent stops immediately** — the stop-hook fires after each turn with a randomised jitter delay, not synchronously (bundle.js:+12638156, +12638193).
5. **Expecting the full condition text in UI labels** — the display label is capped at 40 characters; the full condition is stored internally but may be visually truncated (bundle.js:+14528173).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `gb7` | Command entry-point handler (top-level `/goal` dispatch function) |
| `A` | Normalised argument string / argument-processing context |
| `f` | Goal-clear / stream-teardown closure |
| `H` | Stop-hook callback with randomised delay |
| `RO8` | Skip-word gate check function |
| `diH` | Remove-goal-hook orchestrator |
| `V6` | Shared utility — app-state accessor helper |
| `giH` | Hook-list builder / existing-hooks collector |
| `Go1` | UUID generation wrapper (delegates to `crypto.randomUUID`) |
| `d` | Low-level telemetry dispatcher |
| `J8` | `tengu_feature_sad` emitter wrapper |
| `QiH` | Install-goal-hook orchestrator |
| `Yk_` | Gate-check runner (hooks_gate / trust_gate) |
| `_` | App-state handle used inside install path |
| `tj` | Output-token accumulator across turn records |
| `SH` | `tengu_feature_ok` emitter wrapper |
| `CO8` | Post-dispatch cleanup or render helper called after main branch |