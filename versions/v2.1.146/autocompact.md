---
type: feature-spec
feature: "autocompact"
cc_version: "2.1.146"
updated: "2026-06-01"
tags: ["autocompact", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.146 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/autocompact`

> Analysis basis: CC v2.1.146 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.146

---

## Overview

`/autocompact` configures the automatic context-window compaction threshold for the current Claude Code session. It accepts a token count, the special keyword `auto`, or a reset/unset keyword; validates the argument; and then writes the new value into user settings—unless the environment variable `CLAUDE_CODE_AUTO_COMPACT_WINDOW` is set, in which case it refuses any change and reports that the environment variable takes precedence. When invoked with no argument it opens a dialog UI for interactive configuration.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `autocompact` |
| description | Configure the auto-compact window size |
| argumentHint | `[auto\|<tokens>]` |
| isHidden | `false` |
| module_id | `k$1` |
| load_inline | `true` |
| loc_byte | `10528191` |
| loc_byte_end | `10528440` |
| loc_line | `8449` |
| arbor_handler.name | `m07` |
| arbor_handler.fqn | `claude-2.1.146::m07` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.146 bundle.js:+10528191

---

## Input Branching

The command has four distinct top-level branches (environment-variable block → no argument → reset/unset/default keywords → numeric or `auto` value), requiring a Mermaid flowchart.

```mermaid
flowchart TD
    A["/autocompact [arg]"] --> B{CLAUDE_CODE_AUTO_COMPACT_WINDOW\nenvironment variable set?}
    B -- yes --> C[Return error message:\n'env var takes precedence,\nunset to change']
    B -- no --> D{argument provided?}
    D -- no --> E[Open interactive dialog\nEmit: tengu_autocompact_dialog_opened]
    D -- yes --> F[Trim argument string]
    F --> G{arg in\n'reset' | 'unset' | 'default'?}
    G -- yes --> H[Remove autoCompactWindow\nfrom user settings\nEmit: tengu_autocompact_command]
    G -- no --> I[Call token-string parser\neC_ / parseTokenArg]
    I --> J{parsed result valid?}
    J -- invalid --> K[Return validation error\nto user]
    J -- 'auto' keyword --> L[Set autoCompactWindow = 'auto'\nin user settings\nDisplay: 'Auto-compact window\nset to auto'\nEmit: tengu_autocompact_command]
    J -- numeric token count --> M{value in range\n[0 .. 1 000 000]\nand finite?}
    M -- out of range --> K
    M -- in range --> N[Clamp with Math.max / Math.min\nWrite token count to\nuser settings\nEmit: tengu_autocompact_command]
    N --> O[Reload settings from disk\nvia settingsLoader]
    L --> O
    H --> O
    O --> P[Return confirmation\nJSX element to user]
```

---

## Behavioral Spec

### Handler entry point — `m07` (AsyncFunction)

Analysis basis: CC v2.1.146 bundle.js:+10527876

The Arbor-resolved handler is the async function `m07` (FQN `claude-2.1.146::m07`, resolved via `module_id` path). It receives the raw command invocation context and delegates all parsing and persistence work to the inner command executor `XG6`.

```
async function autocompactHandler(invocationContext):
    telemetry.emit("tengu_autocompact_dialog_opened")   // when dialog path taken
    rawArg = invocationContext.argument
    result = await commandExecutor(rawArg, invocationContext.appState)
    return React.createElement("dialog", result)
```

### Environment-variable guard — inside `commandExecutor` (`XG6`)

Analysis basis: CC v2.1.146 bundle.js:+10522593 and +10522627

Before any write is attempted, the executor reads the environment variable `CLAUDE_CODE_AUTO_COMPACT_WINDOW` (bundle.js:+9742633). If the variable is present and non-empty, the command immediately returns the hard-coded message:

> "CLAUDE_CODE_AUTO_COMPACT_WINDOW is set and takes precedence. Unset it to change this setting."
> (bundle.js:+10522627)

No settings mutation occurs in this path.

### Argument parsing — `parseTokenArg` (`eC_`)

Analysis basis: CC v2.1.146 bundle.js:+10522801, +9742029

```
function parseTokenArg(rawString):
    s = rawString.trim()
    if s == "auto":
        return { kind: "auto" }
    if s.endsWith("%"):
        // percentage branch: parseFloat, validate finite,
        // scale to absolute token count via Math.round
        pct = parseFloat(s)
        if not Number.isFinite(pct):
            return { kind: "invalid" }
        return { kind: "percent", value: Math.round(pct) }
    // integer branch
    n = parseInt(s, 10)           // radix 10 (bundle.js:+9742180)
    if not Number.isFinite(n):
        return { kind: "invalid" }
    return { kind: "tokens", value: n }
```

Boundaries enforced downstream:
- Minimum token value: `0` (bundle.js:+2903068)
- Maximum token value: `1 000 000` (bundle.js:+2903095)
- Percentage scaling divisor: `100` (bundle.js:+9742200)
- Minimum percentage denominator implied by divisor `1000` (bundle.js:+9742164)

### Reset / unset path

Analysis basis: CC v2.1.146 bundle.js:+10522758, +10522771, +10522784

When the trimmed argument is exactly `"reset"`, `"unset"`, or `"default"`, the executor removes the `autoCompactWindow` key from the user settings layer entirely and does not write a numeric value.

### Settings write path — `autoCompactSettingsWriter` (`Zd`)

Analysis basis: CC v2.1.146 bundle.js:+10522593 → +9742557

After a valid value is determined, the writer function `Zd` orchestrates the following steps:

```
async function autoCompactSettingsWriter(parsedValue, appState):
    // 1. Determine the effective source priority
    //    priority: env > policySettings > flagSettings > userSettings > projectSettings > localSettings
    //    (bundle.js:+1208234, +1208256, +1199292, +1199343, +1199365)

    // 2. Apply Math.max(0, Math.min(1_000_000, value))  (bundle.js:+9742751, +9742791)
    clamped = Math.max(0, Math.min(1_000_000, parsedValue))

    // 3. Merge into user settings JSON
    userSettings.autoCompactWindow = clamped   // or "auto"

    // 4. Persist via atomic file writer (hq6):
    //    - open temp file with random suffix (6 bytes hex)  (bundle.js:+1001890, +1001906)
    //    - writeFileSync content
    //    - fchmodSync to preserve original permissions  (bundle.js:+1002384)
    //    - fsyncSync  (bundle.js:+1002450)
    //    - renameSync temp → target  (bundle.js:+1002578)

    // 5. Invalidate in-memory settings caches (jY): clear KI6, clear pN8  (bundle.js:+26086, +26098)

    // 6. Reload settings from disk (gu → jF8)
    //    emits "settings_load_started" / "settings_load_completed"  (bundle.js:+1203656, +1204333)

    // 7. Emit tengu_autocompact_command telemetry  (bundle.js:+10523232)

    return updatedSettings
```

### Settings source resolution — `autoCompactSettingSourceResolver` (`mw8`)

Analysis basis: CC v2.1.146 bundle.js:+9742913

This function determines which settings layer currently owns the `autoCompactWindow` value and reports its source label. Known source labels: `"env"` (bundle.js:+9742825), `"settings"` (bundle.js:+9742895), `"experiment"` (bundle.js:+9742982).

It also reads `autoCompactEnabled` from the settings object to decide whether automatic compaction is currently active (bundle.js:+9744236).

### Token argument validation — `tokenValidator` (`n0`)

Analysis basis: CC v2.1.146 bundle.js:+9742565

```
function tokenValidator(rawValue):
    stringified = String(rawValue)          // via mH  (bundle.js:+26373)
    n = parseInt(stringified, 10)
    if isNaN(n): return { status: "invalid" }
    if n < 0 or n > 1_000_000: return { status: "invalid" }
    // Additional model-tier checks via bl, Z9H, $r6:
    //   - checks for "claude-3-" prefix  (bundle.js:+2902629)
    //   - checks provider type: firstParty / anthropicAws / mantle
    //     (bundle.js:+2902517, +2902541, +2902561)
    //   - validates Number.isFinite after final parseInt  (bundle.js:+2903417)
    return { status: "valid", value: n }
```

### Context validation — `contextValidator` (`ie`)

Analysis basis: CC v2.1.146 bundle.js:+9742630 and +4878946

```
function contextValidator(input):
    n = parseInt(input)
    if isNaN(n): return "invalid"           // (bundle.js:+4879006)
    if n > contextMax: return "capped"      // (bundle.js:+4879136)
    return "valid"                          // (bundle.js:+4878931)
```

### Model list used during validation — `modelList` (`Gj` / `Eq`)

Analysis basis: CC v2.1.146 bundle.js:+2163064

The validation layer consults a static list of known model identifiers when classifying provider type. Models present in the bundle at depth ≤ 2:

| Model string | loc_byte |
|---|---|
| `claude-opus-4-7` | 2162139 |
| `claude-opus-4-6` | 2162196 |
| `claude-opus-4-5` | 2162253 |
| `claude-opus-4-1` | 2162310 |
| `claude-opus-4-0` | 2162399 |
| `claude-sonnet-4-6` | 2162431 |
| `claude-sonnet-4-5` | 2162492 |
| `claude-sonnet-4-0` | 2162587 |
| `claude-haiku-4-5` | 2162621 |
| `claude-3-7-sonnet` | 2162680 |
| `claude-3-5-sonnet` | 2162741 |
| `claude-3-5-haiku` | 2162802 |
| `claude-3-opus` | 2162861 |
| `claude-3-sonnet` | 2162914 |
| `claude-3-haiku` | 2162971 |

`application-inference-profile` is a provider-type sentinel (bundle.js:+2163107).

### Settings-flag application — `applyFlagSettings`

Analysis basis: CC v2.1.146 bundle.js:+10523169

After the new value is confirmed, a flag-settings application step fires with event label `"apply_flag_settings"` and action `"set"` (bundle.js:+10523286). This synchronises the live in-process flag state with the newly persisted value.

### Success confirmation output — `successFormatter` (`P1`)

Analysis basis: CC v2.1.146 bundle.js:+10523430, +10523446

When the value is `"auto"`, the formatter returns the string `"Auto-compact window set to auto"` (bundle.js:+10523446). For numeric values, a locale-formatted number string is constructed using locale `"en-US"` and `"compact"` notation (bundle.js:+209118, +209136), then returned as a JSX element.

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_autocompact_command` | Emitted on every non-dialog invocation (set, reset, unset). (bundle.js:+10523232) |
| Telemetry: `tengu_autocompact_dialog_opened` | Emitted when command is invoked with no argument and the dialog UI is opened. (bundle.js:+10527911) |
| Telemetry: `tengu_amber_redwood2` | Emitted inside the settings-source resolution path `mw8` → `N6`. (bundle.js:+9742445) |
| User settings file | `~/.claude/settings.json` mutated atomically: `autoCompactWindow` key set or removed. (bundle.js:+1199546, +1199556) |
| In-memory settings cache | Two cache stores (`KI6`, `pN8`) cleared on every write. (bundle.js:+26086, +26098) |
| Settings reload | Full settings reload from disk triggered after every successful write; emits `settings_load_started` and `settings_load_completed` log events. (bundle.js:+1203656, +1204333) |
| Flag settings | `apply_flag_settings` synchronisation step fires after write. (bundle.js:+10523169) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | `autoCompactEnabled` field updated to reflect new effective value. (bundle.js:+9744236) |
| Environment variable read | `CLAUDE_CODE_AUTO_COMPACT_WINDOW` read from `process.env`; if set, all writes are blocked. (bundle.js:+9742633) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.146 | Initial analysis |

---

## Common Mistakes

1. **Expecting changes to stick while `CLAUDE_CODE_AUTO_COMPACT_WINDOW` is set.** The command will always reject write attempts with an explanatory message when this environment variable is present. Unset it first.
2. **Passing a token value outside `[0, 1 000 000]`.** Values outside this range are treated as invalid and rejected before any write occurs (bundle.js:+2903068, +2903095).
3. **Using `reset` / `unset` / `default` expecting a numeric default to be written.** These keywords *remove* the key from user settings entirely, causing the effective value to fall back to whatever the policy or experiment layer provides.
4. **Passing a percentage string and assuming integer rounding matches your intent.** The parser rounds percentages via `Math.round`, which may produce unexpected token counts when the context window size varies.
5. **Invoking `/autocompact` without an argument and expecting an immediate change.** No argument opens the interactive dialog; the setting is only changed once the dialog is confirmed.
6. **Assuming project-level settings can be changed by this command.** The writer only targets the `userSettings` layer (`~/.claude/settings.json`). Project or local settings are read-only from this command's perspective.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `m07` | Main async handler for `/autocompact` (Arbor-resolved entry point) |
| `XG6` | Inner command executor: env-var guard, argument dispatch, telemetry |
| `Zd` | Auto-compact settings writer: clamp, persist, cache-invalidate, reload |
| `Eq` | Model-list lookup / provider-type classifier |
| `Vg6` | Object.entries iterator helper for model map |
| `Gj` | Model name normaliser: toLowerCase, includes, replace |
| `H` | Utility / random/timeout helper (Math.random, setTimeout) |
| `Bk8` | Branch helper within model classification |
| `lP` | String replace helper within classification path |
| `n0` | Token value validator: parseInt, isNaN, range check |
| `mH` | Safe String() coercion utility |
| `ET` | Settings-value reader helper (calls V9H) |
| `bl` | Model-tier validator: provider type checks, claude-3 prefix check |
| `Z9H` | Alternative settings-value reader (firstParty / anthropicAws / mantle) |
| `$r6` | Final numeric settings validator: parseInt + Number.isFinite |
| `IP` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `ie` | Context-size validator: parseInt, isNaN, valid/invalid/capped |
| `N` | Log/notification formatter: trim, toUpperCase, locale helpers |
| `mw8` | Settings-source resolver: env vs settings vs experiment |
| `yG` | Settings object builder / merger (calls mH, S7) |
| `C_` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `N6` | Telemetry/feature-flag registry: gf6, Qf6, Tt, M$H, Kg, m6 |
| `eC_` | Token-string argument parser: trim, endsWith, parseFloat, parseInt, Math.round |
| `HA` | Settings file orchestrator: load, cache, atomic write, event emit |
| `oO` | Settings composition helper (calls pfH, KF) |
| `pfH` | Settings layer merger: userSettings, projectSettings, localSettings |
| `KF` | Settings object constructor with typed fields |
| `Q6` | Path/filesystem utility |
| `wF8` | Settings disk loader: mXA, pfH, qF, bXA, Ol |
| `mXA` | Settings file reader: Object.keys, Ol |
| `qF` | Settings file parser: Z_A, kP, zF8, V_A |
| `bXA` | SDK inline settings reader: kP, fC, A2, RfH |
| `RP` | Settings resolver orchestrator (calls zl) |
| `zl` | Raw settings file reader: readFileSync, slice, replaceAll |
| `J8` | Error code helper (calls L8) |
| `L8` | Low-level error code constant provider |
| `XB8` | Timestamp recorder: Dx6.set, Date.now |
| `U2H` | Settings cache updater: tx6, KF |
| `tx6` | Path resolver for settings: qv.resolve, i8, qv.dirname |
| `hq6` | Atomic file writer: random bytes temp name, writeFileSync, fchmodSync, fsyncSync, renameSync |
| `q` | File system module reference |
| `O` | File stat/symlink helper |
| `f` | File handle / stream utility |
| `CH` | JSON serialiser wrapper (JSON.stringify) |
| `jY` | Settings cache invalidator: clears KI6 and pN8 |
| `Lx6` | Settings file path resolver and read/write helper |
| `x6` | Git check-ignore runner (calls Wb6, D_) |
| `_B8` | Settings path sub-helper (calls Q4) |
| `fB8` | Settings path variant helper (calls V_) |
| `XUK` | Home-directory path builder: Kx6.join, vJA.homedir |
| `MC` | `.claude` directory path builder (qv.join) |
| `D_` | Process/env utility (calls uV) |
| `uV` | Low-level environment accessor |
| `gu` | Settings loader with instrumentation: xR, Wq, jF8, KF, LI6 |
| `xR` | Settings load pre-hook |
| `Wq` | Memory-usage recorder: QqA.has/add, Wu, rqA.push, process.memoryUsage |
| `jF8` | Core settings load logic: Date.now, pfH, qF, bXA, mXA, qv.resolve |
| `LI6` | Settings load post-hook |
| `SH` | Error/log appender: n_, mH, X1, PuK, jbH.push, $l.logError |
| `n_` | Error message formatter: Error, String |
| `X1` | Log queue helper (calls lYA) |
| `PuK` | Circular log buffer manager: Db6.shift, Db6.push |
| `e_` | Settings reload trigger (calls gu) |
| `c` | React/UI context reference |
| `P1` | Success message formatter: YK (locale number format) |
| `YK` | Locale number formatter (calls jwK, appends ".0") |
| `jwK` | Intl.NumberFormat wrapper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.