---
type: feature-spec
feature: "autocompact"
cc_version: "2.1.191"
updated: "2026-06-25"
tags: ["autocompact", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.191 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/autocompact`

> Analysis basis: CC v2.1.191 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.191

---

## Overview

`/autocompact` configures the context-fill threshold at which Claude Code automatically summarizes (compacts) the conversation. It accepts either the literal keyword `auto`, a numeric token count, or one of several reset keywords (`reset`, `unset`, `default`), then persists the chosen threshold to user settings and reflects the change in the UI. When no argument is provided the command opens an interactive dialog for threshold selection.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `autocompact` |
| description | Set how full the context gets before auto-summarizing |
| argumentHint | `[auto\|<tokens>]` |
| isHidden | `false` |
| module_id | `OAl` |
| load_inline | `true` |
| loc_byte | `11325909` |
| loc_byte_end | `11326173` |
| loc_line | `7044` |
| arbor_handler.name | `Jcf` |
| arbor_handler.fqn | `claude-2.1.191::Jcf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.191 bundle.js:+11325909

---

## Input Branching

Five or more distinct branches exist based on argument parsing, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/autocompact called"]) --> B{Argument provided?}

    B -- No --> DIALOG["Open interactive dialog\n(tengu_autocompact_dialog_opened)"]
    DIALOG --> END

    B -- Yes --> ENV_CHECK{CLAUDE_CODE_AUTO_COMPACT_WINDOW\nenvironment variable set?}

    ENV_CHECK -- Yes --> ENV_WARN["Emit warning:\n'CLAUDE_CODE_AUTO_COMPACT_WINDOW is set\nand takes precedence. Unset it to change.'"]
    ENV_WARN --> END

    ENV_CHECK -- No --> PARSE["Trim argument string\nCheck for reset keywords"]

    PARSE --> RESET_CHECK{Argument is\n'reset' | 'unset' | 'default'?}

    RESET_CHECK -- Yes --> CLEAR["Clear autoCompactEnabled setting\nWrite settings to disk"]
    CLEAR --> FEEDBACK_RESET["Render success feedback"]
    FEEDBACK_RESET --> END

    RESET_CHECK -- No --> AUTO_CHECK{Argument is 'auto'?}

    AUTO_CHECK -- Yes --> SET_AUTO["Set threshold to auto\n(emit 'Auto-compact window set to auto')"]
    SET_AUTO --> TELEMETRY_SET["Emit tengu_autocompact_command\n(apply_flag_settings / set)"]
    TELEMETRY_SET --> FEEDBACK_AUTO["Render success feedback"]
    FEEDBACK_AUTO --> END

    AUTO_CHECK -- No --> NUMERIC["Parse argument as integer token count\nvalidate via parseInteger helper"]

    NUMERIC --> VALID_CHECK{Parse result\nvalid?}

    VALID_CHECK -- invalid --> ERR["Render error / 'invalid' state feedback"]
    ERR --> END

    VALID_CHECK -- capped --> CAP["Apply capped value\n(numeric boundaries enforced via Math.max / Math.min)"]
    CAP --> WRITE

    VALID_CHECK -- valid --> WRITE["Persist threshold to settings\n(loadSettingsFromDisk → write settings file)"]
    WRITE --> TELEMETRY_SET2["Emit tengu_autocompact_command"]
    TELEMETRY_SET2 --> FEEDBACK_NUM["Render success feedback with formatted token count"]
    FEEDBACK_NUM --> END([Done])
```

Analysis basis: CC v2.1.191 bundle.js:+11320323, +11320459, +11320488, +11320514, +11325634

---

## Behavioral Spec

### 1. Top-level handler (`Jcf`)

The Arbor-resolved handler is an `AsyncFunction`. It is the entry point for the command.

```
async function autocompactHandler(commandContext):
    if commandContext.argument is absent or empty:
        emit telemetry: tengu_autocompact_dialog_opened
        render InteractiveDialog via JSX
        return

    result = processAutocompactArgument(commandContext.argument, commandContext.settings)
    render JSX feedback component with result
```

Analysis basis: CC v2.1.191 bundle.js:+11325599, +11325615, +11325632, +11325676, +11325691

---

### 2. Argument processing (`LVt`)

`LVt` is the core argument-processing function called by `Jcf`.

```
function processAutocompactArgument(rawArg, appState):
    trimmed = rawArg.trim()

    // Environment variable guard
    if environmentVariable("CLAUDE_CODE_AUTO_COMPACT_WINDOW") is set:
        return WarningResult("CLAUDE_CODE_AUTO_COMPACT_WINDOW is set and takes precedence. Unset it to change this setting.")

    // Reset keywords
    if trimmed is one of ["reset", "unset", "default"]:
        clearSettingKey("autoCompactEnabled", appState)
        persistSettings(appState)
        return ResetResult()

    // "auto" keyword
    if parseAutoCompactValue(trimmed) returns "auto":
        updateSetting("autoCompactEnabled", "auto", appState)
        persistSettings(appState)
        emit telemetry: tengu_autocompact_command  { action: "set" }
        return AutoResult("Auto-compact window set to auto")

    // Numeric token threshold
    parseResult = parseTokenValue(trimmed)   // returns {status: "valid"|"invalid"|"capped", value}
    if parseResult.status == "invalid":
        return ErrorResult()

    clampedValue = clamp(parseResult.value, using Math.max / Math.min)
    updateSetting("autoCompactEnabled", clampedValue, appState)
    persistSettings(appState)
    emit telemetry: tengu_autocompact_command  { action: "set" }
    return SuccessResult(clampedValue)
```

Analysis basis: CC v2.1.191 bundle.js:+11320323, +11320357, +11320459, +11320488, +11320501, +11320514, +11320531, +11320699, +11320795, +11320960, +11320998, +11321164

---

### 3. Token-value parser (`LJr`)

`LJr` is reused across several settings parsers. It handles the `auto` keyword, k/M suffixes, and decimal notation.

```
function parseTokenValue(input):
    trimmed = input.trim()

    if trimmed == "auto":
        return {status: "valid", value: "auto"}

    // Suffix handling (e.g. "100k", "1.5m")
    if trimmed ends with a known suffix:
        base = parseFloat(trimmed without suffix)
        multiplier = suffix multiplier   // "k" → 1000, "m" → 100 (per bundle)
        candidate = Math.round(base * multiplier)
    else:
        candidate = parseInt(trimmed)

    if not Number.isFinite(candidate):
        return {status: "invalid"}

    return {status: "valid", value: candidate}
```

Analysis basis: CC v2.1.191 bundle.js:+11320531, +5204110, +5204169, +5204187, +5204245, +5204261, +5204281, +5204307, +5204354

---

### 4. Validation and clamping (`xle`)

`xle` classifies a parsed integer as `"valid"`, `"invalid"`, or `"capped"`.

```
function classifyTokenCount(value):
    parsed = parseInt(value)
    if isNaN(parsed):
        return {status: "invalid"}

    // Boundary enforcement — exact limits not exposed at depth-2
    clamped = Math.max(lowerBound, Math.min(upperBound, parsed))
    if clamped != parsed:
        return {status: "capped", value: clamped}

    return {status: "valid", value: parsed}
```

Analysis basis: CC v2.1.191 bundle.js:+5202414, +5202432, +5202399, +5202474, +5202545, +5202604, +5205567, +5205607

---

### 5. Environment-variable override (`xle` / `CLAUDE_CODE_AUTO_COMPACT_WINDOW`)

If the environment variable `CLAUDE_CODE_AUTO_COMPACT_WINDOW` is set, no write to settings is performed and the user receives a warning message.

- Environment variable name: `CLAUDE_CODE_AUTO_COMPACT_WINDOW` (bundle.js:+5205449)
- Source-priority label: `"env"` (bundle.js:+5205641)
- Settings-priority label: `"settings"` (bundle.js:+5205711)
- Warning string begins with "CLAUDE_CODE_AUTO_COMPACT_WINDOW is set…" (bundle.js:+11320357)

---

### 6. Settings persistence (`IGd` / `bGd` / `uo`)

After a value is accepted the handler calls the settings-write subsystem (`uo`), which:

1. Loads the current settings layers (`policySettings`, `flagSettings`, `userSettings`, `projectSettings`, `localSettings`) via `sg` / `VTe` / `z2`.
2. Merges or removes the `autoCompactEnabled` key (bundle.js:+5201981).
3. Validates the resulting settings object via `IGd` (uses `Number.isInteger`, `Array.isArray`, `Object.hasOwn`).
4. Writes the merged JSON to `~/.claude/settings.json` or `settings.local.json` via `Rvt` (atomic write: temp file → `fsync` → rename).
5. Clears the in-memory settings caches (`kH`: clears `sZt` and `Zcr`, bundle.js:+29197, +29209).
6. Emits `tJe.emit` to notify subscribers of the settings change.

Analysis basis: CC v2.1.191 bundle.js:+5205729, +5205817, +5205837, +5205931, +5206051, +1340421, +1340616, +1340645

---

### 7. Interactive dialog path (`Jcf` → `e` / `xM.jsx`)

When no argument is provided the handler renders a JSX dialog component (identified as the `"dialog"` literal at bundle.js:+11325679). The dialog likely presents preset threshold options. Telemetry event `tengu_autocompact_dialog_opened` is fired immediately before the render.

Analysis basis: CC v2.1.191 bundle.js:+11325615, +11325634, +11325676, +11325691

---

### 8. Feedback rendering (`LVt` → `W` / `Ve` / `sl`)

After any non-dialog path the handler renders a JSX feedback element. The number formatter (`sl` → `Kc` → `FNc`) uses `"en-US"` locale and `"compact"` notation (bundle.js:+223639, +223657) with a `.0` suffix pattern (bundle.js:+221627) to display token counts.

Success message for the `auto` path: `"Auto-compact window set to auto"` (bundle.js:+11321180).

Analysis basis: CC v2.1.191 bundle.js:+11320960, +11320998, +11321164

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_autocompact_command` (bundle.js:+11320962) — fired on every successful non-dialog write |
| Telemetry | `tengu_autocompact_dialog_opened` (bundle.js:+11325634) — fired when no argument is given and dialog opens |
| Telemetry | `tengu_amber_redwood2` (bundle.js:+5201753) — fired during settings validation layer |
| Telemetry | `tengu_amber_redwood3` (bundle.js:+5201784) — fired during settings validation layer |
| Telemetry | `tengu_feature_ok` (bundle.js:+1025725) — generic feature-success tracking |
| Telemetry | `tengu_feature_bad` (bundle.js:+1025792) — generic feature-failure tracking |
| Telemetry | `tengu_feature_sad` (bundle.js:+1025873) — generic feature-warning tracking |
| Telemetry | `tengu_daemon_control` (bundle.js:+17408260) — daemon lifecycle event (indirect) |
| Settings write | Modifies `autoCompactEnabled` in the active settings layer (user or local) |
| Settings key | `"autoCompactEnabled"` (bundle.js:+5201981) |
| Cache invalidation | Clears `sZt` and `Zcr` in-memory caches via `kH` (bundle.js:+29197, +29209) |
| Event bus | Emits `tJe.emit` after settings are written (bundle.js:+1341027) |
| File I/O | Atomic write to `~/.claude/settings.json` or `settings.local.json` (temp → fsync → rename) |
| Environment guard | If `CLAUDE_CODE_AUTO_COMPACT_WINDOW` is set, no write is performed |
| appState changes | `autoCompactEnabled` updated to `"auto"`, a clamped integer, or cleared |
| Sound | None observed |

---

## Version History

| Version | Change |
|---|---|
| v2.1.191 | Initial analysis |

---

## Common Mistakes

1. **Setting a value while `CLAUDE_CODE_AUTO_COMPACT_WINDOW` is set** — the environment variable always takes precedence; the command will warn and refuse to write. Unset the variable first.
2. **Passing a non-integer string expecting auto-rounding** — values that fail `parseInt` / `isNaN` checks are classified `"invalid"` and rejected; use whole numbers or the `auto` keyword.
3. **Expecting project-wide effect without a local settings file** — the write targets the user or local settings layer; project-level policy (`policySettings`) is read-only from this command.
4. **Using `/autocompact 0` to disable** — passing zero or a value below the minimum clamps to the lower bound rather than disabling; use `reset` / `unset` / `default` to clear the setting entirely.
5. **Omitting the argument and not completing the dialog** — dismissing the interactive dialog without confirming does not change any setting; no write occurs.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Jcf` | Top-level async handler for `/autocompact` (Arbor-resolved entry point) |
| `LVt` | Argument-processing function: parses input, guards on env var, dispatches to write or reset |
| `l3` | Core autocompact settings logic — orchestrates parsing, clamping, IGd write |
| `ao` | Model-name normalization / inference-profile detection helper |
| `PQe` | Model entry lookup (iterates `Object.entries`) |
| `l_` | Model string normalizer (`toLowerCase`, `includes`, `replace`) |
| `ubt` | Unknown utility called during model-context resolution |
| `sp` | String sanitizer (`replace`) used in model path |
| `Jy` | Unknown utility reaching `ux` |
| `ux` | Low-level utility (reached from both `Hr` and `Jy`) |
| `mA` | Auto-compact value parser orchestrator (calls `Rfi`, `E3r`, `kfi`) |
| `Rfi` | Integer validation helper (`parseInt`, `isNaN`, base-10 check) |
| `E3r` | Extended parse helper (calls `Ize`, `Rfi`, `kfi`) |
| `kfi` | Settings-write helper (calls `nH`, `jj`, `QU`, `WSn`); max token constant 1 000 000 (bundle.js:+3039251) |
| `xle` | Token-count classifier — returns `"valid"` / `"invalid"` / `"capped"` |
| `T` | Localization / translation helper (`cNe`, `wNc`, `ke`, `Dc`, `MO`) |
| `IGd` | Settings object validator (`Number.isInteger`, `Array.isArray`, `Object.hasOwn`) |
| `cC` | Settings layer builder (`rt`, `fc`) |
| `c7i` | Settings schema validator (`Array.isArray`, `wi`, `Object.hasOwn`, `i7i`) |
| `n` | Case-normalizer (`i.toLowerCase`) |
| `Mfi` | Settings merge helper (calls `kx`) |
| `Dfi` | Settings diff helper (calls `kt`) |
| `xJr` | Settings-write orchestrator (`cC`, `xr`, `$Ut`, `LJr`) |
| `xr` | Unknown settings accessor |
| `$Ut` | Settings path resolver (`nt`) |
| `LJr` | Token-value string parser — handles `auto`, numeric, suffix notation |
| `bGd` | Settings layer presence checker (`cC`, `Object.hasOwn`, `c7i`) |
| `uo` | Settings persistence controller — loads, merges, writes, clears caches, emits events |
| `sg` | Settings aggregator (calls `VTe`, `z2`) |
| `VTe` | Settings file reader for `userSettings`, `projectSettings`, `localSettings` |
| `z2` | Settings layer merger (combines `Hr`, `JAt`, `Tdr`, etc.) |
| `Gt` | Path resolution helper |
| `EIr` | Settings-from-disk loader (calls `Yms`, `VTe`, `Cj`, `Kms`, `jQ`) |
| `Yms` | YAML/JSON settings parser (`yIr`, `Object.keys`, `jQ`, `n.some`) |
| `Cj` | Settings conflict resolver (`rqo`, `iD`, `hIr`, `oqo`) |
| `Kms` | SDK inline-settings handler (`iD`, `gme`, `OU`, `QXe`; label "SDK inline settings") |
| `VC` | Config-file reader |
| `WQ` | Raw file loader (`Gt`, `jd`, `T`, `jin`, `t.readFileSync`, `Win`, slice/replaceAll) |
| `vn` | Error-code helper (`dn`) |
| `dn` | ENOENT / file-error classifier |
| `wTr` | Timestamp recorder (`Oan.set`, `Date.now`) |
| `GUe` | Settings path resolver (`Iln`, `z2`) |
| `Iln` | Path join/resolve helper (`JO.resolve`, `Zn`, `JO.dirname`) |
| `Rvt` | Atomic file writer (temp file, `fsync`, rename, permission copy) |
| `r` | `fs`-like module reference |
| `jd` | Real-path resolver (`Hu`, `wm`, `Gfr`, `e.realpathSync`) |
| `u` | Stat/daemon-stop wrapper (`we`, `Re`, `pF`, `BG`) |
| `i` | Stream/close abstraction (`n.close`, `r.close`, `s`) |
| `hXe` | Chmod error handler (catches `EINVAL`, `ENOTSUP`, `EPERM`, `ENOSYS`) |
| `ius` | File-property definer (`Ae`, `Object.defineProperty`) |
| `ke` | JSON serializer (`JSON.stringify`) |
| `kH` | Cache-clear function (clears `sZt` and `Zcr`) |
| `Yps` | Git-ignore / settings-file writer (`Dt`, `uTr`, `Ran`, `BHu`, `Kps`, `zps`) |
| `Dt` | Directory initializer (`Gin`, `Hr`) |
| `uTr` | Settings-update transformer (`_u`) |
| `Ran` | Git-ignore checker (`Kr`; args: `git check-ignore --`) |
| `BHu` | Excludes-file resolver (`Kr`; `git config --global --get core.excludesfile`) |
| `Kps` | Gitignore-rule writer (`Kr`) |
| `zps` | Unknown settings writer utility |
| `c4` | `.claude` config path builder (`JO.join`) |
| `Hr` | App-state reader (`ux`) |
| `we` | Feature-ok event emitter (`W`, `Pe`; event `tengu_feature_ok`) |
| `W` | Core event emitter / analytics sink |
| `Pe` | Event payload builder (`eze`) |
| `Lt` | Feature-sad event emitter (`W`, `Pe`; event `tengu_feature_sad`) |
| `Re` | Feature-bad event emitter (`W`, `Pe`; event `tengu_feature_bad`) |
| `vj` | Settings-load-from-disk orchestrator (`cx`, `ia`, `SIr`, `z2`, `iZt`) |
| `cx` | Unknown load helper |
| `ia` | Memory-usage tracker (`x7o`, `O9`, `Hmr.push`, `process.memoryUsage`) |
| `SIr` | Settings-load logger (`Date.now`, `Ln`, `aZt`, `jQ`, `wwt`, `Yms`, `VTe`, `Cj`, `Kms`) |
| `iZt` | Unknown post-load step |
| `Le` | Log / error-reporter (`fo`, `rt`, `Yi`, `Rmu`, `sXe.push`, `GQ.logError`) |
| `fo` | Error formatter (`Error`, `String`) |
| `rt` | String coercer (`String`) |
| `Yi` | Log-queue inspector (`ncs`) |
| `Rmu` | Rotating log buffer manager (`Oin.shift`, `Oin.push`) |
| `Rr` | App-state updater (calls `vj`) |
| `Ve` | JSX element factory (`eze`) |
| `eze` | Low-level React/JSX runtime reference |
| `sl` | Number formatter entry point (`Kc`) |
| `Kc` | Locale formatter (`FNc`; locale `"en-US"`, notation `"compact"`) |
| `FNc` | `Intl.NumberFormat` wrapper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.