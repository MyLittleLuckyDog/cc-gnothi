---
type: feature-spec
feature: "autocompact"
cc_version: 2.1.187
updated: "2026-06-19"
tags: ["autocompact", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.181
analysis_basis: "CC v2.1.181 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/autocompact`

> Analysis basis: CC v2.1.181 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.181

---

## Overview

`/autocompact` controls how full the conversation context window must become before Claude Code automatically summarizes (compacts) the conversation history. The command accepts a numeric token threshold, the special keyword `auto`, or reset/unset keywords, and persists the chosen value to user settings. When invoked without arguments it opens an interactive dialog for configuration.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `autocompact` |
| description | `Set how full the context gets before auto-summarizing` |
| argumentHint | `[auto\|<tokens>]` |
| isHidden | `false` |
| module_id | `Eol` |
| load_inline | `true` |
| loc_byte | `11256364` |
| loc_byte_end | `11256628` |
| loc_line | `6978` |
| arbor_handler.name | `P5p` |
| arbor_handler.fqn | `claude-2.1.181::P5p` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.181 bundle.js:+11256364

---

## Input Branching

The command has 4+ distinct branches depending on argument presence, environment variable override, and the value parsed from the argument string.

```mermaid
flowchart TD
    A["/autocompact invoked"] --> B{Argument provided?}
    B -- No --> C[Open interactive dialog\ntengu_autocompact_dialog_opened]
    B -- Yes --> D{CLAUDE_CODE_AUTO_COMPACT_WINDOW\nenv var set?}
    D -- Yes --> E[Emit warning: env var takes precedence\nReturn early with warning message]
    D -- No --> F[Trim argument string]
    F --> G{Argument value}
    G -- '"auto"' --> H[Set compact window to auto mode\nDisplay 'Auto-compact window set to auto']
    G -- '"reset" / "unset" / "default"' --> I[Remove user setting\nRestore default behaviour]
    G -- Numeric string --> J[parseTokenValue: trim, detect unit suffix\nparseFloat / parseInt, apply scaling]
    J --> K{Parsed value valid?}
    K -- Invalid / NaN --> L[Return error: invalid value]
    K -- Valid integer --> M{Value in acceptable range?}
    M -- Out of range --> N[Clamp via Math.max / Math.min\nand report capped status]
    M -- In range --> O[Persist token threshold to settings\ntengu_autocompact_command emitted]
    N --> O
    O --> P[Reload settings from disk\nApply flag settings\nEmit success JSX response]
```

Analysis basis: CC v2.1.181 bundle.js:+11250717, +11250751, +11250853, +11250882, +11250895, +11250908, +11251574, +5076727

---

## Behavioral Spec

### Top-Level Handler (`P5p`)

```
async function autocompactCommandHandler(args, context):
    if args is empty or not provided:
        emit telemetry("tengu_autocompact_dialog_opened")
        return createElement("dialog", interactiveDialogComponent)

    emit telemetry("tengu_autocompact_command")
    return await processAutocompactArgument(args, context)
```

Analysis basis: CC v2.1.181 bundle.js:+11256046, +11256062, +11256079, +11256081, +11256123, +11256138

---

### Argument Parser (`x5t`)

```
async function processAutocompactArgument(rawArgs, context):
    trimmed = rawArgs.trim()

    if envVar("CLAUDE_CODE_AUTO_COMPACT_WINDOW") is set:
        return warningMessage(
            "CLAUDE_CODE_AUTO_COMPACT_WINDOW is set and takes precedence. " +
            "Unset it to change this setting."
        )

    if trimmed in ["reset", "unset", "default"]:
        removeUserSetting("autoCompactEnabled")
        reloadSettings()
        return successResponse()

    parsedMode = parseTokenOrAutoValue(trimmed)   // calls vGr

    if parsedMode == "auto":
        applyAutoCompactSetting("auto")
        applyFlagSettings()
        return successMessage("Auto-compact window set to auto")

    numericThreshold = parsedMode   // integer token count

    result = applyCompactWindowSetting(numericThreshold, context)  // calls UB
    reloadSettings()                                               // calls Kr → tj
    return renderResult(result)
```

Analysis basis: CC v2.1.181 bundle.js:+11250717, +11250751, +11250853, +11250882, +11250895, +11250908, +11250925, +11251093, +11251189, +11251293, +11251354, +11251392, +11251413, +11251558, +11251574

---

### Token Value Parser (`vGr`)

```
function parseTokenOrAutoValue(input):
    trimmed = input.trim()

    if trimmed.endsWith suffix that implies a unit:
        raw = parseFloat(trimmed)
        if Number.isFinite(raw):
            scaled = Math.round(raw * scalingFactor)   // e.g. "k" suffix → ×1000
            return scaled
    else:
        raw = parseInt(trimmed, 10)
        if not Number.isFinite(raw):
            return null   // invalid

    if trimmed == "auto":
        return "auto"

    return raw
```

Numeric parsing supports at minimum base-10 integers and floating-point values with unit suffixes. The minimum granularity after `parseInt` is 1000-unit steps (literal `1000` at bundle.js:+5076105) and a percentage minimum of 100 (literal `100` at bundle.js:+5076141).

Analysis basis: CC v2.1.181 bundle.js:+5075970, +5076000, +5076029, +5076047, +5076105, +5076121, +5076141, +5076167, +5076214

---

### Setting Application and Validation (`UB`)

```
function applyCompactWindowSetting(tokenCount, context):
    // Read environment override first
    envValue = process.env["CLAUDE_CODE_AUTO_COMPACT_WINDOW"]
    if envValue is set:
        parsedEnv = parseAndValidateTokenValue(envValue)   // calls aae → Aei

    // Validate the incoming token count
    validationResult = validateTokenCount(tokenCount)      // calls aae

    if validationResult.status == "invalid":
        return { status: "invalid", ... }

    // Clamp to safe boundaries
    clamped = Math.max(lowerBound, Math.min(upperBound, tokenCount))
    //   bundle.js:+5076845 (Math.max), +5076885 (Math.min)

    if clamped != tokenCount:
        status = "capped"

    // Determine the setting source priority:
    // priority order: env → settings → clientdata → experiment → model-default
    source = resolveSettingSource(context)   // calls dTd → qC / gei

    if envOverride active:
        emit tengu_amber_redwood2
        return { status: "env", value: parsedEnv }

    if uTdSet.has(context):                  // policy / flag gate
        delegateToPolicyResolver(context)    // calls PRr

    persistSetting(clamped, "settings")      // calls qC → Ec / rt
    return { status: validationResult.status, value: clamped }
```

Key literals:
- Environment variable name: `CLAUDE_CODE_AUTO_COMPACT_WINDOW` (bundle.js:+5076727)
- Setting key: `autoCompactEnabled` (bundle.js:+5073884)
- Source labels (in priority order): `env` → `settings` → `clientdata` → `experiment` → `model-default` (bundle.js:+5076919, +5076989, +5077074, +5077163, +5077260)
- Status strings: `valid` (bundle.js:+5074259), `invalid` (bundle.js:+5074334), `capped` (bundle.js:+5074464)

Analysis basis: CC v2.1.181 bundle.js:+5076654, +5076661, +5076723, +5076845, +5076885, +5077007, +5077094, +5077188, +5077200, +5077284, +5077290

---

### Numeric Token Validation (`aae` / `Aei`)

```
function validateTokenCount(raw):
    parsed = parseInt(raw, 10)        // bundle.js:+5074274 / +3025533
    if isNaN(parsed):                 // bundle.js:+5074292 / +3025593
        return { status: "invalid" }

    // Additional range check (separate function Aei):
    // base 10, minimum digits checked: 10 (literal at +3025585)
    // lower bound literal: 0  (+3025605)
    // upper bound literal: 1000000 (+3025717)
    if parsed < 0 or parsed > 1000000:
        return { status: "invalid" }

    return { status: "valid", value: parsed }
```

Maximum token value: **1 000 000** (bundle.js:+3025717)
Minimum token value: **0** (bundle.js:+3025605)

Analysis basis: CC v2.1.181 bundle.js:+5074274, +5074292, +3025533, +3025585, +3025593, +3025605, +3025717

---

### Settings Persistence and Reload (`ao` / settings subsystem)

```
function persistAndReloadSettings(key, value):
    // Load current settings layers from disk (calls ZA → fSe, x2)
    // Layers: policySettings, flagSettings, userSettings, projectSettings, localSettings
    //         "SDK inline settings"
    currentSettings = loadSettingsFromDisk()

    // Write new value to userSettings layer
    targetFile = path.join(".claude", "settings.json")   // +1310058, +1310068
    localFile  = path.join(".claude", "settings.local.json") // +1310130

    writeFileAtomically(targetFile, updatedSettings)    // calls lSt (atomic write)

    // Check gitignore / global ignore rules
    checkGitignoreStatus(targetFile)   // calls NZo → T7c / Qen
    if file matches global gitignore:
        emitWarning("gitignore_global_rule")            // +1330146

    // Detect ineffective writes (settings overridden by higher-priority source)
    if writtenValueNotEffective:
        emitWarning("write_ineffective")                // +1330287

    clearSettingsCache()    // calls fH: kKt.clear + Ser.clear
    reloadFromDisk()        // calls tj → NAr (loadSettingsFromDisk_start / _end)
```

Analysis basis: CC v2.1.181 bundle.js:+1329296, +1329331, +1329368, +1329456, +1329905, +1330041, +1330066, +1330090, +1330143, +1330208, +1330250, +1330428, +1330442, +1330452

---

### Interactive Dialog (no-argument path, `P5p` → `_g.createElement`)

When `/autocompact` is invoked with no arguments, the handler renders a JSX dialog component (type `"dialog"`, bundle.js:+11256126) using React's `createElement`. The dialog is presumed to present token threshold options (including `auto`) interactively. Telemetry event `tengu_autocompact_dialog_opened` is emitted at dialog render time.

Analysis basis: CC v2.1.181 bundle.js:+11256079, +11256081, +11256123, +11256126, +11256138

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_autocompact_command` | Fired on every argument-based invocation (bundle.js:+11251356) |
| Telemetry: `tengu_autocompact_dialog_opened` | Fired when no argument is supplied and the dialog is rendered (bundle.js:+11256081) |
| Telemetry: `tengu_amber_redwood2` | Fired inside the compact-window setting subsystem, likely when env override is active (bundle.js:+5076316) |
| Telemetry: `tengu_feature_ok` | Generic feature success event, fired from the JSX renderer path (bundle.js:+1019804) |
| Telemetry: `tengu_feature_bad` | Generic feature error/warning event (bundle.js:+1019871) |
| Telemetry: `tengu_feature_sad` | Generic feature failure event (bundle.js:+1019952) |
| Telemetry: `tengu_daemon_control` | Daemon lifecycle telemetry, reached transitively (bundle.js:+17138162) |
| Settings write | Persists `autoCompactEnabled` key to `~/.claude/settings.json` (userSettings layer) |
| Settings cache clear | `kKt.clear()` and `Ser.clear()` called after write (bundle.js:+27824, +27836) |
| Settings reload | Full disk reload triggered via `loadSettingsFromDisk_start` / `loadSettingsFromDisk_end` span |
| Gitignore check | Settings file checked against global gitignore rules; warning emitted if ignored |
| env var override | `CLAUDE_CODE_AUTO_COMPACT_WINDOW` suppresses all writes and returns a precedence warning |
| Flag settings applied | `apply_flag_settings` span applied after auto-mode change (bundle.js:+11251293) |
| appState changes | `autoCompactEnabled` in settings layer updated; compact threshold reflected in subsequent sessions |
| Sound | None detected in depth-2 traversal |
| Hook registration | Event emitted via `KKe.emit` after settings write (bundle.js:+1330452) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.181 | Initial analysis |

---

## Common Mistakes

1. **Setting the value while `CLAUDE_CODE_AUTO_COMPACT_WINDOW` is exported** — the environment variable always takes precedence and the command will return a warning without persisting anything. Unset the variable first.
2. **Providing a token value above 1 000 000** — values exceeding the maximum are silently clamped and reported as `capped`; no error is thrown.
3. **Expecting immediate effect in the current session** — the command reloads settings from disk after writing, but already-running agent loops may have cached the old threshold.
4. **Using non-integer strings** — while floating-point input with unit suffixes is parsed, non-numeric strings (e.g., `/autocompact high`) return an `invalid` status and no setting is written.
5. **Confusing `reset`/`unset`/`default`** — all three keywords perform the same action (remove the user-level override); there is no behavioural distinction between them.
6. **Omitting the argument expecting a query** — invoking `/autocompact` with no argument opens the interactive dialog rather than printing the current threshold.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `P5p` | Top-level async handler for `/autocompact` command (arbor_handler) |
| `x5t` | Argument processing function: trims input, branches on value type, orchestrates setting flow |
| `UB` | Core compact-window setting applicator: validation, clamping, source resolution, persistence |
| `Go` | Model name / identifier normalisation utility (reached via `UB`) |
| `w7e` | Model identifier object-entries walker |
| `e_` | Model string normaliser (toLowerCase, includes, replace) |
| `Ugt` | Model identifier helper (called from `Go`) |
| `Tf` | String replace utility for model names |
| `Ny` | Utility reached from `UB` (likely logging or notification) |
| `fx` | Low-level log/output primitive |
| `ZS` | Compact-window validation orchestrator (calls `Aei`, `PRr`, `hei`) |
| `Aei` | Token integer parser and range validator (parseInt, isNaN, bounds 0–1 000 000) |
| `PRr` | Settings conflict resolver (calls `_We`, `Aei`, `hei`) |
| `hei` | Setting writer for compact threshold (calls `v_`, `_j`, `RU`, `aAn`) |
| `aae` | Token count validation wrapper (parseInt, isNaN, status strings valid/invalid/capped) |
| `I` | Shared string/value classification utility |
| `dTd` | Setting source resolver: determines whether value comes from env, settings, clientdata, experiment, or model-default |
| `qC` | Settings accessor / reader |
| `gei` | Setting existence check (calls `It`) |
| `wGr` | Compact window writer with source tracking (calls `qC`, `Lr`, `ut`, `vGr`) |
| `Lr` | Setting layer helper |
| `ut` | Settings transaction / cache helper (txt, nxt, p4, Vj map operations) |
| `vGr` | Token string parser: trim, suffix detection, parseFloat/parseInt, Number.isFinite, Math.round |
| `ao` | Settings persistence orchestrator: loads layers, writes file, checks gitignore, clears cache, emits hook |
| `ZA` | Settings file locator (calls `fSe`, `x2`) |
| `fSe` | Settings file path builder (KO.join, layer keys) |
| `x2` | Settings object constructor / merger |
| `jt` | File-system utility (used across settings and file writing) |
| `OAr` | Settings writer to disk (calls `Nts`, `fSe`, `ej`, `Pts`, `WJ`) |
| `Nts` | Settings key enumerator / merger (Object.keys, `PAr`, `WJ`) |
| `ej` | JSON serialiser for settings file (calls `ZFo`, `eU`, `DAr`, `e$o`) |
| `Pts` | SDK inline settings handler (calls `eU`, `Epe`, `_U`, `WKe`) |
| `Sv` | Settings-read helper (calls `qJ`) |
| `qJ` | File reader for settings (readFileSync, slice, replaceAll, 4096-byte limit) |
| `Dn` | Error code helper (calls `ln`) |
| `ln` | ENOENT / filesystem error classifier |
| `qmr` | Timestamp recorder (rtn.set, Date.now) |
| `jOe` | Settings post-processor (calls `jtn`, `x2`) |
| `jtn` | Path resolver for settings files (KO.resolve, KO.dirname, `sr`) |
| `lSt` | Atomic file writer (readlink, lstat, open/close/write/fsync/rename, randomBytes for temp name) |
| `r` | Node.js `fs` sync bindings wrapper |
| `Jp` | Real-path resolver (realpathSync) |
| `u` | fs.Stats / symbolic link checker |
| `i` | Stream / handle close helper |
| `cKe` | Permission application helper (fchmod; handles EINVAL/ENOTSUP/EPERM/ENOSYS) |
| `Re` | JSON.stringify wrapper |
| `fH` | Settings cache invalidator (kKt.clear, Ser.clear) |
| `NZo` | Git-ignore checker for settings files (mkdir, readFile, appendFile, writeFile, `git check-ignore`) |
| `Mt` | Git helper initialiser (calls `cen`, `gr`) |
| `vmr` | Git command runner (calls `Ru`) |
| `n` | String lowercaser utility |
| `Qen` | Git check-ignore executor (calls `Vr`) |
| `T7c` | Global gitignore path resolver (git config --global core.excludesfile, homedir expansion) |
| `PZo` | Gitignore result parser (calls `Vr`) |
| `OZo` | Gitignore state tracker |
| `O9` | Path joiner for `.claude` directory (KO.join) |
| `gr` | Logging / event emitter primitive (calls `fx`) |
| `xe` | Feature-ok telemetry emitter (tengu_feature_ok) |
| `j` | Core telemetry dispatch function |
| `$e` | Telemetry envelope builder (calls `Rht`) |
| `Ut` | Feature-sad telemetry emitter (tengu_feature_sad) |
| `Me` | Feature-bad telemetry emitter (tengu_feature_bad) |
| `tj` | Settings reload orchestrator (loadSettingsFromDisk_start/end span; calls `px`, `ha`, `NAr`, `x2`, `DKt`) |
| `px` | Span/trace helper |
| `ha` | Memory-usage sampler (process.memoryUsage, S3o set, Por push) |
| `NAr` | Full disk settings loader (Date.now span, `Nts`, `ej`, `Pts`, `fSe`, KO.resolve) |
| `DKt` | Post-load settings applicator |
| `ke` | JSX response renderer (calls `Ho`, `rt`, `ta`, `fVc`; pushes to QVe; logError on failure) |
| `Ho` | Error-to-string converter |
| `rt` | String coercion utility |
| `ta` | Response queue helper (calls `qYo`) |
| `fVc` | Response ring-buffer manager (ren.shift, ren.push) |
| `Kr` | Flag-settings applicator trigger (calls `tj`) |
| `Qe` | Telemetry tag/label helper (calls `Rht`) |
| `Rht` | Base telemetry record constructor |
| `gl` | Number formatter (en-US locale, "compact" notation; calls `su`) |
| `su` | Intl.NumberFormat wrapper (calls `Nhc`) |
| `Nhc` | Locale/format string builder |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.