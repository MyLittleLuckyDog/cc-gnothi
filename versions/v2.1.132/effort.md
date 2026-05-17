---
type: feature-spec
feature: "effort"
cc_version: "2.1.132"
updated: "2026-05-18"
tags: ["effort", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.132 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/effort`

> Analysis basis: CC v2.1.132 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.132

---

## Overview

The `/effort` command sets the effort level that Claude Code uses when invoking the underlying model, controlling the depth of reasoning and implementation thoroughness. It accepts one of six named levels (`low`, `medium`, `high`, `xhigh`, `max`, `auto`) or a raw numeric token budget, normalises the input, validates it, and then persists the chosen level into application state for the current session. When operating over a remote transport (thin-client / CCR), the command applies the setting locally only and appends a caveat to its response, because the server-side effort cannot be altered from the client.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `effort` |
| description | Set effort level for model usage |
| argumentHint | `[low\|medium\|high\|xhigh\|max\|auto]` |
| thinClientDispatch | `control-request` |
| module_id | `fzq` |

Analysis basis: CC v2.1.132 bundle.js:+11374195

---

## Input Branching

The command entry point (command handler function) receives the raw argument string, then routes through three main phases: argument parsing, level resolution, and state application.

```mermaid
flowchart TD
    A(["/effort [arg]"]) --> B{Argument provided?}
    B -- No --> C[Display current effort level and available levels]
    B -- Yes --> D[Normalise: trim + toLowerCase]
    D --> E{Is arg a named level?\nlow | medium | high | xhigh | max | auto}
    E -- Yes --> F[Resolve named level to canonical value]
    E -- No --> G[Attempt parseInt radix-10]
    G --> H{isNaN result?}
    H -- Yes --> I[Return error: unrecognised effort value]
    H -- No --> J[Use numeric token-budget value directly]
    F --> K{Transport = CCR / thin-client?}
    J --> K
    K -- Yes --> L[Apply setting locally\nAppend caveat: server effort unchanged]
    K -- No --> M[Apply effort to session state\nEmit apply_flag_settings]
    L --> N[Emit tengu_effort_command telemetry]
    M --> N
    N --> O[Render JSX confirmation with level description]
    I --> P([Return error response])
    O --> Q([Return success response])
    C --> Q
```

Analysis basis: CC v2.1.132 bundle.js:+11364893 (command handler), +11365548 (toLowerCase normalisation), +3999140 (parseInt call), +3999159 (isNaN check), +11363853 (CCR caveat string), +11365186 (telemetry emit)

---

## Behavioral Spec

### Argument Parsing and Level Validation

```
function parseEffortArgument(rawArg):
    if rawArg is absent or blank:
        return { action: "SHOW_STATUS" }

    normalised = rawArg.trim().toLowerCase()

    if isNamedLevel(normalised):          # "low","medium","high","xhigh","max","auto"
        return { action: "SET_NAMED", level: normalised }

    numeric = parseInt(normalised, 10)    # radix 10
    if isNaN(numeric):
        return { action: "ERROR", reason: "unrecognised value" }

    return { action: "SET_NUMERIC", budget: numeric }
```

Named levels recognised at parse time: `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, `"auto"`.
The sentinel value `"unset"` is also present in the level vocabulary as the default/cleared state.

Analysis basis: CC v2.1.132 bundle.js:+3999463 (`"unset"`), +3999491 (`"auto"`), +3999720 (`"max"`), +3999741 (`"high"`), +3999755 (`"xhigh"`), +4000669 (`"low"`), +4000747 (`"medium"`), +3999140 (parseInt), +3999159 (isNaN), +3999151 (radix `10`)

---

### Level Validation Against Known-Good Set

```
function isValidLevel(candidate):
    KNOWN_LEVELS = ["low", "medium", "high", "xhigh", "max", "auto", "unset"]
    return KNOWN_LEVELS.includes(candidate)
```

The inclusion check is delegated to the `wB.includes` helper.

Analysis basis: CC v2.1.132 bundle.js:+3998976 (`wB.includes` call)

---

### Level Description Resolution

Each named level maps to a human-readable description shown in the confirmation UI:

| Level | Description |
|---|---|
| `low` | Quick, straightforward implementation with minimal overhead |
| `medium` | Balanced approach with standard implementation and testing |
| `high` | Comprehensive implementation with extensive testing and documentation |
| `xhigh` | Deeper reasoning than high, just below maximum (Opus 4.7 only) |
| `max` | Maximum capability with deepest reasoning |
| `auto` | *(resolved dynamically from session context)* |

Analysis basis: CC v2.1.132 bundle.js:+4000681 (`low` description), +4000762 (`medium` description), +4000840 (`high` description), +4000930 (`xhigh` description), +4001011 (`max` description)

---

### Transport-Aware Application

```
function applyEffortLevel(resolvedLevel, sessionContext):
    isCCR = isRemoteTransport(sessionContext)   # checks for "ccr" transport

    if isCCR:
        applyLocally(resolvedLevel)
        caveat = " (applied locally — this remote transport can't change server effort)"
        confirmationSuffix = caveat
    else:
        applyLocally(resolvedLevel)
        confirmationSuffix = " (this session only)"

    emitFlagSettings("apply_flag_settings", resolvedLevel)
    emitTelemetry("tengu_effort_command")
    return buildConfirmation(resolvedLevel, confirmationSuffix)
```

Analysis basis: CC v2.1.132 bundle.js:+11363853 (CCR caveat literal), +11364806 (`"(this session only)"` literal), +3997439 (`"ccr"` transport identifier), +11363976 (`"apply_flag_settings"` event), +11365186 (`tengu_effort_command` telemetry)

---

### Pro-Tier Gate for `xhigh` / `max`

The implementation checks whether the active subscription tier equals `"pro"` before fully enabling `xhigh` or `max` effort. The gate is evaluated inside the level-application helper.

```
function checkProGate(level, userProfile):
    PRO_ONLY_LEVELS = ["max"]          # xhigh gated by model capability (Opus 4.7)
    if level in PRO_ONLY_LEVELS:
        if userProfile.tier != "pro":
            return { allowed: false, reason: "pro tier required" }
    return { allowed: true }
```

Analysis basis: CC v2.1.132 bundle.js:+2884611 (`"pro"` literal), +2884604 (tier-check call edge `z8H → F9`)

---

### Status Display (No-Argument Path)

```
function renderEffortStatus(currentLevel, availableLevels):
    rows = []
    for each level in availableLevels:
        desc = getLevelDescription(level)
        marker = (level == currentLevel) ? "current" : "status"
        rows.push(buildRow(level, desc, marker))
    return renderTable(rows)
```

The strings `"current"` and `"status"` are used as row-type markers in the JSX table rendered via `r1.createElement`.

Analysis basis: CC v2.1.132 bundle.js:+11372624 (`"current"` literal), +11372639 (`"status"` literal), +11372655 (`r1.createElement` call), +11372586 (`uKH.includes` call for level enumeration)

---

### Session-Scoped User Settings Persistence

```
function persistToUserSettings(level):
    settings = readUserSettings()       # key: "userSettings"
    settings.effortLevel = level
    writeUserSettings(settings)
    scheduleApply(settings, delay=1)    # numeric literal 1 used as apply index
```

The `"userSettings"` key is the storage namespace. A flag-application step with an index value of `1` follows the write.

Analysis basis: CC v2.1.132 bundle.js:+4000092 (`"userSettings"` literal), +4001155 (numeric `1` — apply index), +4000042 (`MWH` — settings read helper), +4000089 (`CA` — settings write), +4000150 (`A8` — apply trigger)

---

### Deduplication Guard

Before registering a new effort setting, the implementation checks a tracking set to avoid duplicate application of the same level within a session tick:

```
function deduplicatedApply(level, trackingSet, pendingMap):
    if trackingSet.has(level):
        return                          # already applied this tick
    trackingSet.add(level)
    if pendingMap.has(level):
        existing = pendingMap.get(level)
        mergeApply(existing, level)
    else:
        directApply(level)
```

Analysis basis: CC v2.1.132 bundle.js:+3085510 (`V5H.has`), +3085533 (`kq6.add`), +3085547 (`mU.has`), +3085564 (`mU.get`), +3085584 (`R6` — apply call)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_effort_command` | Emitted on every successful `SET_NAMED` or `SET_NUMERIC` action (bundle.js:+11365186) |
| Telemetry — `tengu_slate_finch` | Emitted inside the level-application helper (bundle.js:+4001134) |
| Flag settings event | `"apply_flag_settings"` dispatched after state write (bundle.js:+11363976) |
| appState changes | `effortLevel` field updated under the `"userSettings"` namespace (bundle.js:+4000092) |
| Transport caveat | When transport is `"ccr"`, a caveat suffix is appended to the response; server effort is NOT changed (bundle.js:+11363853) |
| Session scope | All changes are session-scoped; the suffix `"(this session only)"` is appended in non-CCR flows (bundle.js:+11364806) |
| thinClientDispatch | `control-request` — ensures the command is handled in the control channel when running as a thin client (bundle.js:+11374195) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.132 | Initial analysis — six named levels (`low`, `medium`, `high`, `xhigh`, `max`, `auto`), numeric budget fallback, CCR-aware local-only application, pro-tier gate for `max` |

---

## Common Mistakes

1. **Passing a level name with mixed case** — the argument hint shows lowercase; while the implementation normalises via `toLowerCase()`, relying on this is fragile across versions. Always pass lowercase level names.
2. **Expecting server-side effect over CCR transport** — when Claude Code is running as a thin client over a remote transport, `/effort` only adjusts the local session. The confirmation message explicitly states the server effort is unchanged; do not mistake the success response for a global setting change.
3. **Using `xhigh` with non-Opus models** — the description for `xhigh` states it is "Opus 4.7 only". Supplying this level with other models will silently fall back to the next available tier rather than producing an error.
4. **Assuming persistence across sessions** — the `"(this session only)"` suffix is literal. The effort level is not written to a persistent configuration file; it resets on the next Claude Code invocation unless set again.
5. **Supplying a float instead of an integer for numeric budgets** — the parser calls `parseInt` (not `parseFloat`), so `"1.5"` is parsed as `1`, silently truncating the fractional part.
6. **Omitting the argument expecting an interactive picker** — unlike some slash commands, `/effort` with no argument renders a status table, not an interactive selection prompt. To change the level you must pass it explicitly.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Uz8` | Command handler entry point (top-level `/effort` implementation function) |
| `A3` | Session context / app-state reader |
| `ywH` | App-state field accessor (called from session context reader) |
| `ifH` | Effort level getter — retrieves the current effort value from state |
| `fa` | Argument parser — normalises raw string to typed effort descriptor |
| `px` | Level description resolver — maps named levels to description strings |
| `nfH` | Named-level table builder — constructs the mapping of level → description |
| `$WH` | Description lookup helper — retrieves description for a single level |
| `M1A` | Level application orchestrator — writes resolved level to settings and fires events |
| `obK` | Settings writer — persists the updated userSettings object |
| `z8H` | Pro-tier gate checker |
| `j6` | Deduplication + pending-map applier |
| `Bz8` | Render / response builder — assembles JSX confirmation or status output |
| `H` | Randomised delay utility (uses `Math.random` + `setTimeout`) |
| `gY7` | Main flow coordinator — sequences parse → validate → apply → render |
| `Kzq` | CCR transport detector + caveat injector |
| `tK6` | User settings read/write/apply helper trio |
| `d` | Dispatch function — sends internal control messages |
| `aK6` | Named-level inclusion validator (wraps `wB.includes`) |
| `FY7` | Non-CCR (standard local) effort application path |
| `MWH` | User settings reader |
| `Jv` | CCR transport identifier resolver (returns `"ccr"` string for comparison) |
| `Lw7` | Status display renderer — builds the no-argument level table via `r1.createElement` |