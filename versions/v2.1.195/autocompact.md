---
type: feature-spec
feature: "autocompact"
cc_version: 2.1.195
updated: "2026-06-26"
tags: ["autocompact", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.193
analysis_basis: "CC v2.1.193 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/autocompact`

> Analysis basis: CC v2.1.193 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.193

---

## Overview

`/autocompact` controls the threshold at which Claude Code automatically summarizes (compacts) the conversation context window. The command accepts either the special token `auto` or an explicit token count, persisting the setting to user or project settings. When invoked with no argument it opens an interactive dialog for configuration.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `autocompact` |
| description | Set how full the context gets before auto-summarizing |
| argumentHint | `[auto\|<tokens>]` |
| isHidden | `false` |
| module_id | `sCl` |
| load_inline | `true` |
| loc_byte | `11424870` |
| loc_byte_end | `11425134` |
| loc_line | `7244` |
| arbor_handler.name | `vmf` |
| arbor_handler.fqn | `claude-2.1.193::vmf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.193 bundle.js:+11424870

---

## Input Branching

The command exhibits 4+ distinct branches depending on the presence and value of the argument, the state of the `CLAUDE_CODE_AUTO_COMPACT_WINDOW` environment variable, and whether a dialog should be opened. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/autocompact [arg]"] --> B{CLAUDE_CODE_AUTO_COMPACT_WINDOW\nenv var set?}
    B -- Yes --> C[Display warning:\n'CLAUDE_CODE_AUTO_COMPACT_WINDOW is set\nand takes precedence. Unset it to change\nthis setting.' and return early]
    B -- No --> D{Argument provided?}
    D -- No --> E[Open interactive dialog\ntengu_autocompact_dialog_opened]
    D -- Yes --> F{Parse argument value}
    F -- '"reset" / "unset" / "default"' --> G[Remove autoCompactEnabled\nfrom settings]
    F -- '"auto"' --> H[Set autoCompactEnabled = auto\nDisplay: 'Auto-compact window set to auto']
    F -- Numeric token string --> I{Parse token value via\ntoken-parser utility}
    I -- Valid integer >= 1000 tokens --> J[Clamp with Math.max / Math.min\nSet autoCompactEnabled = clamped value\nPersist to settings]
    I -- Invalid / NaN --> K[Display error / usage message]
    J --> L[Emit tengu_autocompact_command\nApply flag settings if applicable]
    H --> L
    G --> L
    K --> L
    E --> M[Dialog renders JSX component\nUser selects value interactively]
```

Analysis basis: CC v2.1.193 bundle.js:+11419318, +11419420, +11419449, +11419475, +11420141, +11424560, +11424595

---

## Behavioral Spec

### 1. Environment Variable Guard

Before processing any argument, the handler checks whether the environment variable `CLAUDE_CODE_AUTO_COMPACT_WINDOW` is set. If it is, the command emits a warning message indicating that the environment variable takes precedence and cannot be overridden via the slash command, then returns without making any changes.

```
function autocompactHandler(args, context):
    if env.CLAUDE_CODE_AUTO_COMPACT_WINDOW is set:
        display("CLAUDE_CODE_AUTO_COMPACT_WINDOW is set and takes precedence. Unset it to change this setting.")
        return
    trimmedArg = args.trim()
    return dispatchByArgument(trimmedArg, context)
```

Analysis basis: CC v2.1.193 bundle.js:+11419318, +5226527

---

### 2. Argument Dispatch

After the environment guard passes, the trimmed argument string determines the execution path.

```
function dispatchByArgument(arg, context):
    if arg is empty:
        openDialog(context)          // no-argument path
        return

    if arg in ["reset", "unset", "default"]:
        removeAutoCompactSetting(context)
        return

    if arg == "auto":
        setAutoCompact("auto", context)
        display("Auto-compact window set to auto")
        return

    tokenValue = parseTokenArgument(arg)
    if tokenValue.status == "valid":
        clampedValue = clamp(tokenValue.value, MIN_TOKENS, MAX_TOKENS)
        setAutoCompact(clampedValue, context)
        emitTelemetry("tengu_autocompact_command", {mode: "set"})
        return

    if tokenValue.status == "invalid":
        display(usageError)
        return
```

Analysis basis: CC v2.1.193 bundle.js:+11419449, +11419462, +11419475, +11419921, +11419959, +11419980, +11420125, +11420141

---

### 3. Token Argument Parsing (`$Zr` — token-string parser)

The token-string parser is a shared utility (also used elsewhere in the settings subsystem). It handles both plain integer strings and strings with suffixes (e.g., `"k"`).

```
function parseTokenArgument(str):
    trimmed = str.trim()
    if trimmed == "auto":
        return {status: "auto"}

    // Suffix handling
    if trimmed ends with "k" or "K":
        numeric = parseFloat(trimmed without suffix)
        if Number.isFinite(numeric):
            return {status: "valid", value: Math.round(numeric * 1000)}

    intValue = parseInt(trimmed)
    if Number.isFinite(intValue):
        return {status: "valid", value: intValue}

    return {status: "invalid"}
```

The constant `1000` appears at bundle.js:+5225323 and `100` at +5225359 as numeric boundaries within this parser.

Analysis basis: CC v2.1.193 bundle.js:+5225188, +5225247, +5225265, +5225323, +5225339, +5225385, +5225432, +11419492

---

### 4. Validation and Clamping (`_ce` — validity classifier)

After parsing, a validity classifier determines whether the resulting integer is within acceptable bounds and produces a status string.

```
function classifyTokenValue(intValue):
    if isNaN(intValue) or not integer:
        return "invalid"
    if intValue > MAX_TOKENS:
        return "capped"     // value will be clamped
    return "valid"
```

The values `Math.max` and `Math.min` are called at bundle.js:+5226645 and +5226685 respectively to clamp the final stored value.

Status strings `"valid"`, `"invalid"`, and `"capped"` appear at bundle.js:+5223477, +5223552, +5223682.

Analysis basis: CC v2.1.193 bundle.js:+5223477, +5223492, +5223510, +5223552, +5223623, +5223682, +5226645, +5226685

---

### 5. Settings Persistence (`k3` — compact-window settings writer)

The core settings writer resolves the active configuration source (environment variable, settings file, or client data), computes the final value, validates the model context, and writes the result.

```
function writeAutoCompactSetting(parsedValue, context):
    // Priority resolution
    envValue = env.CLAUDE_CODE_AUTO_COMPACT_WINDOW
    if envValue is set:
        return {source: "env", value: envValue}

    // Determine setting scope
    modelDefault = resolveModelDefault(context.model)
    windowValue  = resolveWindowValue(parsedValue, modelDefault)

    // Persist
    updateSettings("autoCompactEnabled", windowValue, scope: "user")
    emitTelemetry("tengu_autocompact_command")
    applyFlagSettings(context)
```

Source priority strings observed: `"env"` (+5226719), `"settings"` (+5226789), `"clientdata"` (+5226895), `"experiment"` (+5226984), `"model-default"` (+5227083).

The settings key `"autoCompactEnabled"` is stored at bundle.js:+5223008.
The environment variable name `"CLAUDE_CODE_AUTO_COMPACT_WINDOW"` is stored at bundle.js:+5226527.

Analysis basis: CC v2.1.193 bundle.js:+5226523, +5226527, +5226645, +5226685, +5226719, +5226789, +5226807, +5226895, +5226915, +5226984, +5227009, +5227083, +5227131

---

### 6. No-Argument Dialog Path (`vmf` — handler top-level)

When invoked without arguments, `vmf` constructs and renders a JSX dialog component using `JM.jsx`. The dialog event is reported immediately upon open.

```
async function autocompactHandlerMain(args, context):
    emitTelemetry("tengu_autocompact_dialog_opened")
    dialogElement = JM.jsx(AutoCompactDialogComponent, {
        mode: "dialog",
        context: context,
        ...
    })
    renderToUI(dialogElement)
```

Analysis basis: CC v2.1.193 bundle.js:+11424560, +11424576, +11424593, +11424595, +11424637, +11424652

---

### 7. Model-Aware Token Bounds (`MA`, `uhi`, `b4r`, `dhi`)

The settings subsystem consults the active model identifier to derive the default context window. Model names are matched against known prefixes/substrings (`"claude-"` at +3044445) and a list of named model strings (Opus, Sonnet, Haiku variants, see literals). A numeric clamp of `[0, 1000000]` tokens is enforced at the bounds layer (bundle.js:+3044261), with `parseInt` and `isNaN` used for string-to-int coercion (bundle.js:+3044076, +3044136).

```
function resolveModelTokenLimit(modelId):
    if modelId starts with "claude-":
        match known model list → return model_context_size
    if modelId contains "application-inference-profile":
        return profile_default
    return fallback_default   // 1_000_000 upper bound
```

Analysis basis: CC v2.1.193 bundle.js:+3043920, +3043952, +3043979, +3044076, +3044128, +3044136, +3044148, +3044191, +3044214, +3044248, +3044261, +3044445

---

### 8. Settings Load / Save Infrastructure

The `co` function (settings loader/saver) is invoked transitively by the write path. It loads the layered settings stack (policy → flag → user → project → local → SDK inline), merges them, and writes back to the appropriate layer. Relevant file paths are `~/.claude/settings.json` (user) and `settings.local.json` (local project).

```
function loadAndMergeSettings():
    layers = [
        load("policySettings"),
        load("flagSettings"),
        load("userSettings"),      // ~/.claude/settings.json
        load("projectSettings"),
        load("localSettings"),     // settings.local.json
        load("SDK inline settings")
    ]
    return mergeLayered(layers)
```

Analysis basis: CC v2.1.193 bundle.js:+1323973, +1324024, +1324046, +1324219, +1324227, +1324237, +1324299, +1343849, +1343871

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_autocompact_command` | Fired on every successful argument-based change (set / reset / auto). Analysis basis: CC v2.1.193 bundle.js:+11419923 |
| Telemetry — `tengu_autocompact_dialog_opened` | Fired immediately when the no-argument dialog path is taken. Analysis basis: CC v2.1.193 bundle.js:+11424595 |
| Telemetry — `tengu_amber_redwood2` / `tengu_amber_redwood3` | Emitted by the settings-write infrastructure (`iFt`). Analysis basis: CC v2.1.193 bundle.js:+5222780, +5222811 |
| Telemetry — `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` | Emitted by the feature-flag check utility (`we`, `Re`, `vt`). Analysis basis: CC v2.1.193 bundle.js:+1026754, +1026821, +1026902 |
| Telemetry — `tengu_daemon_control` | Emitted by daemon-stop utilities reached transitively. Analysis basis: CC v2.1.193 bundle.js:+17520352 |
| Settings write | `autoCompactEnabled` key written to the resolved settings layer (`~/.claude/settings.json` for user scope). |
| Environment override | `CLAUDE_CODE_AUTO_COMPACT_WINDOW` fully supersedes any slash-command value; no write occurs when set. |
| Flag settings apply | `applyFlagSettings` is called after a successful write (bundle.js:+11419860). |
| Cache invalidation | `PH` (cache-clear utility) clears `Den` and `Xdr` caches during settings reload (bundle.js:+29196, +29208). |
| JSX render | On no-argument invocation, a JSX dialog element is mounted in the UI (`JM.jsx`, bundle.js:+11424652). |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.193 | Initial analysis |

---

## Common Mistakes

1. **Setting a value while `CLAUDE_CODE_AUTO_COMPACT_WINDOW` is set** — The command will display a warning and make no change. Unset the environment variable first.
2. **Providing a non-numeric, non-keyword argument** — Anything that is not `auto`, `reset`/`unset`/`default`, or a parseable integer (optionally with a `k` suffix) will be treated as invalid.
3. **Expecting project-scope persistence** — By default the value is written to user settings. Project-level overrides require separate configuration.
4. **Using very low token values** — The parser applies a numeric lower bound via `Math.max`; values below the minimum will be silently clamped rather than rejected.
5. **Omitting the argument to set a value** — Invoking `/autocompact` with no argument opens an interactive dialog rather than querying the current value; use the settings inspection commands for read-only checks.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `vmf` | Main async handler for `/autocompact` (arbor_handler) |
| `Qqt` | Argument-dispatch function; parses arg string and routes to set/reset/auto/dialog paths |
| `k3` | Compact-window settings writer; resolves priority, clamps value, persists to settings |
| `_ce` | Token-value validity classifier; returns `"valid"` / `"invalid"` / `"capped"` |
| `$Zr` | Token-string parser; handles `auto`, numeric, and `k`-suffix forms |
| `MA` | Model-aware settings resolver; consults model ID to derive token bounds |
| `uhi` | Integer coercion utility used within model-token resolver (`parseInt` + `isNaN`) |
| `b4r` | Token-bounds builder; assembles min/max from model context size |
| `dhi` | Settings-bounds enforcer; applies `[0, 1_000_000]` clamp and calls downstream writers |
| `mVd` | Settings-validation orchestrator; checks `Number.isInteger`, `Array.isArray`, `Object.hasOwn` |
| `QXi` | Nested settings-object validator |
| `pVd` | Settings-persistence helper; checks `Object.hasOwn` and calls `QXi` |
| `FZr` | Settings-file writer coordinator; calls `DC`, `Tr`, `iFt`, `$Zr` |
| `iFt` | Low-level settings file writer; emits `tengu_amber_redwood2/3` telemetry |
| `DC` | Settings-object accessor utility |
| `co` | Layered settings loader/saver; merges policy → flag → user → project → local → SDK |
| `dg` | Settings-load dispatcher; routes to `GIe` and `yB` |
| `GIe` | Per-layer settings loader; runs `g1.join`, `BAu`, `U4`, `FAu` |
| `yB` | Settings-merge aggregator; calls all individual layer loaders |
| `Svr` | Settings-source resolver; calls `vHs`, `GIe`, `uW`, `IHs` |
| `vHs` | Settings-version checker; uses `Object.keys`, `nW`, `n.some` |
| `uW` | Settings-write helper; calls `Mzo`, `LD`, `Hvr`, `Dzo` |
| `IHs` | SDK-inline settings loader |
| `hv` | Settings-file reader utility |
| `MZ` | File-read helper; uses `t.readFileSync`, `s.slice`, `s.replaceAll` |
| `Qwt` | Atomic file-write utility (temp-rename pattern); uses `tIr.randomBytes`, `hf.writeFileSync`, `r.renameSync` |
| `wgs` | Gitignore-aware settings path resolver; checks `git check-ignore` |
| `fSu` | Path normalizer; resolves `~/` prefix via `gCr.homedir` |
| `Cgs` | Git-ls-files tracker checker |
| `ke` | JSON serializer wrapper (`JSON.stringify`) |
| `PH` | Cache-clear utility; clears `Den` and `Xdr` caches |
| `wCr` | Cache-set helper (`gcn.set` + `Date.now`) |
| `B$e` | Settings-reload trigger after write |
| `dW` | Settings-load orchestrator; calls `xx`, `ia`, `Avr`, `yB`, `Pen` |
| `Avr` | Async settings-load worker; emits `settings_load_started/completed` telemetry |
| `ia` | Memory-usage sampler during load (`process.memoryUsage`) |
| `we` | Feature-flag OK checker; emits `tengu_feature_ok` |
| `Re` | Feature-flag BAD checker; emits `tengu_feature_bad` |
| `vt` | Feature-flag SAD checker; emits `tengu_feature_sad` |
| `xe` | Error-logging utility; pushes to `rJe`, calls `kZ.logError` |
| `eo` | Error-wrapping helper |
| `at` | String-coercion utility |
| `Bi` | Request-routing utility referencing `Rds` |
| `e_u` | FIFO queue manager (`fln.shift`, `fln.push`) |
| `kr` | Settings-write dispatcher; calls `dW` |
| `Ve` | JSX component renderer (calls `Zze`) |
| `Zze` | Core React/JSX reconciler entry |
| `dl` | Number formatter; calls `ru` → `r2c` (locale `"en-US"`, style `"compact"`) |
| `ru` | Intl.NumberFormat wrapper |
| `r2c` | Compact number-format helper |
| `mE` | Module-export helper calling `Rx` |
| `Rx` | Module registry accessor |
| `T` | String/token formatting utility; handles `iUe`, `qFc`, `ke`, `Lc`, `XO`, `iYe`, `XFc` |
| `to` | Model-ID normalizer; calls `PZe`, `__`, `RTt`, `up` |
| `PZe` | Model-entry lookup via `Object.entries` |
| `__` | Model-name canonical matcher; uses `toLowerCase`, `includes`, `replace` |
| `up` | Model-name string cleaner (`e.replace`) |
| `n` | Lowercase comparator (`i.toLowerCase`) |
| `phi` | Auto-compact threshold helper calling `Jx` |
| `fhi` | Compact-trigger helper calling `kt` |
| `Tr` | Settings-transaction helper |
| `In` | ENOENT-safe file-access utility |
| `an` | ENOENT error classifier |
| `Md` | Realpath resolver (`e.realpathSync`, `Gc`, `$p`, `KI`, `Ggr`) |
| `mJe` | Permission-error classifier (`EINVAL`, `ENOTSUP`, `EPERM`, `ENOSYS`) |
| `Ops` | Object-property descriptor helper (`Object.defineProperty`) |
| `Pen` | Post-load settings notifier |
| `xx` | Pre-load settings initializer |
| `U4` | `.claude` directory path builder (`g1.join`) |
| `mr` | Module-registration helper calling `Rx` |
| `V` | React/JSX element factory |
| `Oe` | UI component wrapper calling `Zze` |
| `ucn` | Gitignore-path resolver calling `Vr` |
| `uCr` | Settings-cache reader calling `Iu` |
| `Pt` | Settings-event emitter calling `Eln`, `mr` |
| `vgs` | Settings-write-warning emitter |
| `r` | Node `fs` module reference |
| `u` | Daemon/process control module (`we`, `Re`, `R$`, `Hj`) |
| `i` | Stream/socket handle (`n.close`, `r.close`, `s`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.