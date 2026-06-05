---
type: feature-spec
feature: "autocompact"
cc_version: 2.1.165
updated: "2026-06-05"
tags: ["autocompact", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.163
analysis_basis: "CC v2.1.163 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/autocompact`

> Analysis basis: CC v2.1.163 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.163

---

## Overview

`/autocompact` lets the user configure the context-window threshold at which Claude Code automatically summarizes (compacts) the conversation. The command accepts either the special token `auto`, a numeric token count, or one of several reset keywords (`reset`, `unset`, `default`), and persists the chosen value into user settings. When invoked without an argument it opens an interactive dialog instead.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `autocompact` |
| description | `Set how full the context gets before auto-summarizing` |
| argumentHint | `[auto\|<tokens>]` |
| isHidden | `false` |
| module_id | `Emq` |
| load_inline | `true` |
| loc_byte | `11032237` |
| loc_byte_end | `11032501` |
| loc_line | `7421` |
| arbor_handler.name | `uYf` |
| arbor_handler.fqn | `claude-2.1.163::uYf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.163 bundle.js:+11032237

---

## Input Branching

The command has 5+ distinct input paths (no argument, `auto`, numeric token string, reset keywords, and an env-var override guard), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/autocompact [arg]"] --> B{CLAUDE_CODE_AUTO_COMPACT_WINDOW\nenvironment variable set?}
    B -- Yes --> C[Emit warning:\n'env var takes precedence'\nReturn early with notice]
    B -- No --> D{arg provided?}
    D -- No --> E[Open interactive dialog\ntelemetry: tengu_autocompact_dialog_opened]
    D -- Yes --> F{arg == 'auto'?}
    F -- Yes --> G[parseAutoValue\nSet threshold to auto mode\ntelemetry: tengu_autocompact_command\nEmit 'Auto-compact window set to auto']
    F -- No --> H{arg in reset keywords?\n'reset' | 'unset' | 'default'}
    H -- Yes --> I[Remove stored autoCompact\nsetting from userSettings\ntelemetry: tengu_autocompact_command]
    H -- No --> J{arg is numeric string?}
    J -- No --> K[Show error / usage hint]
    J -- Yes --> L[parseTokenCount\nparseInt → validate finite\nclamp to model-aware bounds\ntelemetry: tengu_autocompact_command]
    L --> M{Parsed value valid?}
    M -- No --> K
    M -- Yes --> N[Write autoCompactEnabled +\nthreshold to userSettings via\nsettings persistence layer]
    G --> N
    I --> O[Persist removal via\nsettings persistence layer]
    N --> P[Render JSX confirmation\nvia j3.createElement / 'dialog']
    O --> P
    E --> P
    C --> P
```

Analysis basis: CC v2.1.163 bundle.js:+11026632, +11026666, +11026797, +11027473, +11031954

---

## Behavioral Spec

### 1 — Top-level handler (`uYf`)

The async entry point is resolved by Arbor via the `module_id` path (`Emq → uYf`).

```
async function autocompactHandler(commandInput, appContext):
    renderDialogOrResult = buildJSXResponse(appContext)   // j3.createElement, 'dialog' shape
    return renderDialogOrResult
```

The handler delegates immediately to the argument-processing layer (`_h6`) and wraps the outcome in a JSX `dialog` element for rendering.

Analysis basis: CC v2.1.163 bundle.js:+11031919, +11031952, +11031996, +11032011

---

### 2 — Argument processing (`_h6`)

```
function processAutocompactArg(rawArg, appContext):
    // Guard: env var override
    if env.CLAUDE_CODE_AUTO_COMPACT_WINDOW is set:
        return warning("CLAUDE_CODE_AUTO_COMPACT_WINDOW is set and takes precedence. Unset it to change this setting.")

    trimmedArg = rawArg.trim()

    // No argument → interactive dialog
    if trimmedArg is empty:
        emit telemetry("tengu_autocompact_dialog_opened")
        return openInteractiveDialog(appContext)

    // Parse the value to a canonical form
    parsedValue = parseAutocompactValue(trimmedArg)   // Zs_

    // Reset / removal keywords
    if trimmedArg in ["reset", "unset", "default"]:
        removeSettingKey("autoCompact", userSettings)
        emit telemetry("tengu_autocompact_command", {action: "unset"})
        applyFlagSettings(appContext)   // apply_flag_settings
        return confirmationView(appContext)

    // 'auto' keyword
    if parsedValue == "auto":
        writeUserSetting("autoCompactEnabled", true, mode="auto")
        emit telemetry("tengu_autocompact_command", {action: "set"})
        return successView("Auto-compact window set to auto")

    // Numeric token count
    if parsedValue is a finite integer:
        clampedValue = clamp(parsedValue, modelMinTokens, modelMaxTokens)
        writeUserSetting("autoCompact", clampedValue)
        emit telemetry("tengu_autocompact_command", {action: "set"})
        applyFlagSettings(appContext)
        return confirmationView(clampedValue, appContext)

    // Fallback: invalid input
    return errorView(usage hint)
```

Analysis basis: CC v2.1.163 bundle.js:+11026632, +11026768, +11026797, +11026810, +11026823, +11027008, +11027271, +11027307, +11027328, +11027473, +11027489

---

### 3 — Token-value parser (`Zs_`)

Parses the string argument into either the literal `"auto"` or a numeric token count. Called from both `_h6` and the main config-reader (`yn`).

```
function parseAutocompactValue(rawString):
    s = rawString.trim()

    if s.endsWith("%"):
        // Percentage mode
        floatVal = parseFloat(s)
        if not Number.isFinite(floatVal):
            return null
        return Math.round(floatVal)   // percentage → rounded integer

    if s == "auto":
        return "auto"

    // Plain integer (minimum 1000, base-10 parse required)
    intVal = parseInt(s, 10)    // minimum granularity: 1000 tokens (loc +10212768)
    if not Number.isFinite(intVal):
        return null
    // Values below 100 are rejected (loc +10212804)
    if intVal < 100:
        return null
    return intVal
```

Analysis basis: CC v2.1.163 bundle.js:+10212633, +10212692, +10212710, +10212784, +10212830, +10212877, +11026840

---

### 4 — Autocompact threshold resolver (`yn`)

Used at session startup to determine the effective threshold.

```
function resolveAutocompactThreshold(appState):
    // 1. Env variable takes highest precedence
    envValue = process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW   // loc +10213237
    if envValue is set:
        parsed = parseAutocompactValue(envValue)   // I_H
        if parsed is valid:
            return { value: parsed, source: "env" }   // loc +10213429

    // 2. Explicit user / project settings
    settingsValue = readSetting("autoCompact")
    if settingsValue is present:
        parsed = parseAutocompactValue(String(settingsValue))
        if parsed is valid:
            return { value: parsed, source: "settings" }   // loc +10213499

    // 3. Experiment / feature-flag override
    if featureFlag("experiment") is active:   // loc +10213586
        return { value: flagValue, source: "experiment" }

    // 4. Model-default
    modelDefault = resolveModelDefault(currentModel)   // AT, "model-default" loc +10213673
    clampedMin  = Math.max(modelDefault, lowerBound)   // loc +10213355
    clampedMax  = Math.min(clampedMin,   upperBound)   // loc +10213395

    // 5. Check Jqf feature-flag set
    if Jqf.has(currentModel):   // loc +10213610
        return { value: clampedMax, source: "model-default" }

    return { value: clampedMax, source: "model-default" }
```

Analysis basis: CC v2.1.163 bundle.js:+10213160, +10213168, +10213173, +10213233, +10213355, +10213395, +10213517, +10213610, +10213697

---

### 5 — Settings persistence (`r_`)

The write path involves loading the multi-layer settings stack (`policySettings` → `flagSettings` → `userSettings` → `projectSettings` → `localSettings`) and writing back to user settings only.

```
function writeAutocompactSetting(key, value):
    layers = loadSettingsLayers()  // policySettings, flagSettings, userSettings,
                                   // projectSettings, localSettings
    // Check write-effectiveness guard
    effectiveLayer = resolveWritableLayer(layers)
    if write would be ineffective:
        emit telemetry("write_ineffective")   // loc +1279215
        return

    userSettingsPath = path.join(".claude", "settings.json")   // loc +1269308, +1269318
    updated = merge(existingUserSettings, { [key]: value })
    atomicWriteFile(userSettingsPath, JSON.stringify(updated))
    invalidateSettingsCache()   // sz: clears Mm6, BF8
    emitEvent("jFH.emit")       // notify subscribers
```

Atomic write uses `openSync` + `writeFileSync` + `fsyncSync` + `renameSync` to prevent partial writes.

Analysis basis: CC v2.1.163 bundle.js:+1278162, +1278184, +1278351, +1278503, +1278827, +1278843, +1278969, +1278994, +1279018, +1279136, +1279178, +1279356, +1279380

---

### 6 — Model-awareness in token limits (`H9` / `tX`)

The compaction threshold is validated against model-specific limits. The model string is normalised (`.toLowerCase()`, `.replace()`) and checked against a known list. The model list observed in literals includes `claude-opus-4-*`, `claude-sonnet-4-*`, `claude-haiku-4-5`, `claude-3-7-sonnet`, `claude-3-5-sonnet`, `claude-3-5-haiku`, `claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku`, and `application-inference-profile` entries.

Hard numeric constants observed:
- Minimum radix for parseInt: `10` (bundle.js:+2981061)
- Token floor guard: `0` (bundle.js:+2981081)
- Token ceiling multiplier seed: `1 000 000` (bundle.js:+2981108)
- Scale reference: `1` (bundle.js:+2980368)

Analysis basis: CC v2.1.163 bundle.js:+2241197, +2241220, +2241229, +2241240, +2241280, +2241284

---

### 7 — Interactive dialog path (`_h6` → `pq` → `IK`)

When no argument is supplied, an interactive dialog component is rendered via the JSX layer (`j3.createElement`). The dialog telemetry event fires immediately on open.

```
function openInteractiveDialog(appContext):
    emit telemetry("tengu_autocompact_dialog_opened")
    component = renderDialogComponent(
        currentThreshold = resolveAutocompactThreshold(appContext),
        onConfirm        = (newValue) => writeAutocompactSetting("autoCompact", newValue),
        onCancel         = () => closeDialog()
    )
    return component  // local number formatter uses "en-US" + "compact" style
```

The number formatter uses locale `"en-US"` with `"compact"` notation (bundle.js:+213919, +213937), producing human-readable token counts (e.g. "200K").

Analysis basis: CC v2.1.163 bundle.js:+11027473, +11031954, +11032011, +211893

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_autocompact_command` | Fired on every successful argument-driven set/unset action (bundle.js:+11027271) |
| Telemetry: `tengu_autocompact_dialog_opened` | Fired when the command is run with no argument and the interactive dialog is shown (bundle.js:+11031954) |
| Telemetry: `tengu_amber_redwood2` | Fired during threshold resolution, likely an experiment/feature-flag check (bundle.js:+10213048) |
| Telemetry: `tengu_feature_ok` / `tengu_feature_sad` / `tengu_feature_bad` | Feature-flag evaluation outcomes emitted by the flag-checking subsystem (bundle.js:+1010222, +1010365, +1010284) |
| Settings write | `autoCompact` / `autoCompactEnabled` persisted to `~/.claude/settings.json` via atomic write |
| Settings cache invalidation | In-memory caches `Mm6` and `BF8` are cleared after every write (bundle.js:+26768, +26780) |
| Event bus | `jFH.emit` notifies the rest of the application of the setting change (bundle.js:+1279380) |
| Flag settings re-application | `apply_flag_settings` (bundle.js:+11027208) is called after write to reconcile policy/flag layers |
| appState changes | `autoCompactEnabled` flag updated in app state via `AT` / `g4` path (bundle.js:+10215452, +10215508) |
| Sound | None observed |

---

## Version History

| Version | Change |
|---|---|
| v2.1.163 | Initial analysis |

---

## Common Mistakes

1. **Setting the value while `CLAUDE_CODE_AUTO_COMPACT_WINDOW` is set in the environment** — The environment variable always takes precedence. The command will warn and refuse to write. Unset the variable first.
2. **Passing a token count below 100** — The parser rejects values smaller than 100 (bundle.js:+10212804). Use `auto` or a value ≥ 100.
3. **Expecting the change to survive without a writable `~/.claude/settings.json`** — If the user settings layer is non-writable, the write will be silently marked `write_ineffective` (bundle.js:+1279215) and no change will persist.
4. **Omitting the argument expecting a status display** — With no argument the command opens an interactive dialog rather than printing the current value as plain text.
5. **Using percentage syntax outside the supported range** — The percentage branch calls `parseFloat` and `Math.round` but does not apply the token-floor guard; passing `"0%"` may produce a value that is subsequently rejected by the model-limit clamp.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `uYf` | Top-level async handler for `/autocompact` (Arbor-resolved entry point) |
| `_h6` | Argument-processing function; dispatches to sub-paths based on arg value |
| `yn` | Session-startup autocompact threshold resolver |
| `H9` | Model-string normalisation and model-list lookup |
| `Bs6` | Model registry enumeration helper (uses `Object.entries`) |
| `tX` | Model string normaliser (`toLowerCase`, `includes`, `replace`) |
| `H` | Bootstrap/API fetch utility (Content-Type, User-Agent, 5000 ms timeout) |
| `dQ8` | Model inference-profile check helper |
| `uj` | String replacement utility used in model name processing |
| `dV` | Token-count validation dispatcher |
| `o0` | Token validation sub-case (lower bound, returns `q4H` result) |
| `RU` | Token validation sub-case (model-family check, `claude-3-` prefix) |
| `w6H` | Token validation sub-case (provider-type check: firstParty / anthropicAws / mantle) |
| `EA8` | Token validation sub-case (finite integer check path) |
| `u0` | Reads raw setting value for autocompact from merged settings |
| `I_H` | Env-var value parser (`parseInt`, `isNaN`); returns `valid`/`invalid`/`capped` |
| `v` | General-purpose model/version lookup (debug mode, `SH`, `VR`) |
| `Ovq` | Threshold computation orchestrator (calls `AT`, `U_`, `D6`, `Zs_`) |
| `AT` | Model-default threshold loader; reads `autoCompactEnabled` from settings |
| `U_` | Upper-bound resolver for autocompact window |
| `D6` | Feature-flag / experiment lookup (uses `yDH`, `tw6`, `eU` sets) |
| `Zs_` | Canonical value parser: handles `"auto"`, percentage strings, plain integers |
| `r_` | Settings write/read orchestrator; performs atomic file write |
| `cO` | Settings file path resolver |
| `HzH` | Settings file path composer (joins `.claude`, `settings.json`, etc.) |
| `Kd` | Multi-layer settings loader (policy, flag, user, project, local) |
| `Q6` | File-existence / stat utility |
| `F6_` | Full settings load from disk (delegates to `SmA`, `HzH`, `qd`, `kmA`) |
| `SmA` | Settings object merger / key enumerator |
| `qd` | JSON-parse helper for settings files |
| `kmA` | SDK inline-settings reader |
| `oP` | Settings read helper (delegates to `Zr`) |
| `Zr` | File-read utility with 4096-byte slice support |
| `R8` | Error-code handler (`ENOENT`) |
| `v8` | Low-level error value wrapper |
| `mH_` | Cache-set helper (`Rc6.set`, `Date.now`) |
| `rTH` | Settings re-read trigger (post-write cache refresh) |
| `Xl6` | Path resolver for `.claude` directory |
| `TM6` | Atomic file-write implementation (open/write/fsync/rename/unlink) |
| `q` | Node `fs` module proxy (readlink, lstat, stat, rename, unlink) |
| `O` | Stat-result wrapper (`isSymbolicLink`) |
| `f` | File-descriptor wrapper (close, toString) |
| `SH` | `JSON.stringify` wrapper |
| `sz` | Settings cache invalidator (clears `Mm6`, `BF8`) |
| `vc6` | User-settings write function (mkdir, readFile, appendFile, writeFile) |
| `b6` | Settings base-path resolver |
| `WH_` | Settings write helper (`F4`) |
| `A` | String utility (`endsWith`, `toLowerCase`) |
| `Nc6` | Git-ignore check helper (`S_`) |
| `ME4` | Path normaliser (home-dir expansion, `~/` prefix, `isAbsolute`) |
| `XxA` | Git `ls-files --error-unmatch` tracker |
| `PxA` | Settings post-write validator |
| `hx` | `.claude` directory path helper (`_I.join`) |
| `X_` | Environment/platform detection (`uv`) |
| `uv` | Platform constant provider |
| `hH` | Feature-flag reader (`c`, `P6`) |
| `c` | Feature-flag store accessor |
| `P6` | Feature-flag evaluator (`Nu6`) |
| `s6` | Feature-flag "sad" path reader |
| `RH` | Feature-flag "bad" path reader |
| `DU` | Settings load-from-disk orchestrator (`nT`, `u9`, `g6_`, `Kd`, `$m6`) |
| `nT` | Pre-load hook for settings |
| `u9` | Memory-usage sampler (`KWA`, `Uc8`, `process.memoryUsage`) |
| `g6_` | Settings load worker (reads all layers, emits `settings_load_started/completed`) |
| `$m6` | Post-load settings finaliser |
| `kH` | Error logger / history ring-buffer (`HA`, `eH`, `Dq`, `HW4`, `hBH`) |
| `HA` | Error constructor wrapper |
| `eH` | Error string formatter (`String`) |
| `Dq` | Error reporter (`RSA`) |
| `HW4` | Error history ring-buffer manager (`kd6.shift`, `kd6.push`) |
| `e_` | Settings dirty-check helper (calls `DU`) |
| `W6` | JSX primitive factory (`Nu6`) |
| `Nu6` | React/JSX createElement base |
| `pq` | Dialog component builder (calls `IK`) |
| `IK` | Number formatter (locale `en-US`, `compact` notation, calls `acK`) |
| `acK` | Locale number format helper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.