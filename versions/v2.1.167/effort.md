---
type: feature-spec
feature: "effort"
cc_version: "2.1.167"
updated: "2026-06-11"
tags: ["effort", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.167 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/effort`

> Analysis basis: CC v2.1.167 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.167

---

## Overview

The `/effort` command sets the inference effort level for the current Claude Code session, controlling how much computational and reasoning depth the model applies to tasks. It accepts a named tier (`low`, `medium`, `high`, `xhigh`, `max`, `ultracode`, or `auto`) and either persists the choice as the user's global default or applies it only to the current session. The command dispatches via `thinClientDispatch: "control-request"` and is handled by the async function `effortCommandHandler` (bundle identifier `Wmf`).

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `effort` |
| description | `Set effort level for model usage` |
| argumentHint | `[low\|medium\|high\|xhigh\|max\|ultracode\|auto] \| [low\|medium\|high\|xhigh\|max\|auto]` |
| immediate | `null` |
| thinClientDispatch | `control-request` |
| module_id | `h4K` |
| load_inline | `true` |
| loc_byte | `12762738` |
| loc_byte_end | `12763069` |
| loc_line | `9103` |
| arbor_handler.name | `Wmf` |
| arbor_handler.fqn | `claude-2.1.167::Wmf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.167 bundle.js:+12762738

---

## Input Branching

The command has 6+ distinct branches based on the supplied effort tier argument, plus sub-branches for `ultracode` prerequisite checks, persistence scope decisions, and remote-transport limitations. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/effort [arg]"]) --> B{arg provided?}
    B -- No --> C[Display current effort status\nand available tiers]
    B -- Yes --> D{arg == 'ultracode'?}

    D -- Yes --> E{workflows feature enabled?}
    E -- No --> F[Error: 'Ultracode needs dynamic\nworkflows enabled — see /config.\nValid options: low medium high xhigh max auto'\nbundle.js:+12750745]
    E -- Yes --> G[Set effort = ultracode\nxhigh + dynamic workflow orchestration]

    D -- No --> H{arg in low|medium|high|xhigh|max|auto?}
    H -- No --> I[Error: invalid tier shown to user]
    H -- Yes --> J{remote transport active?}

    J -- Yes --> K[Apply locally only\nAppend note: 'applied locally —\nthis remote transport can't\nchange server effort'\nbundle.js:+12748730]
    J -- No --> L{persist flag set?}

    L -- Yes/Default --> M[Save as global default\nAppend: '(saved as your default\nfor new sessions)'\nbundle.js:+12749688]
    L -- Session only --> N[Apply for this session only\nAppend: '(this session only)'\nbundle.js:+12749732]

    G --> L
    K --> O([Confirm message rendered])
    M --> O
    N --> O
    C --> O
```

---

## Behavioral Spec

### Top-level handler — `effortCommandHandler` (`Wmf`)

The main handler is an `AsyncFunction` reached via `module_id` → `h4K` → `Wmf`.

```
async function effortCommandHandler(commandInput, appContext):
    arg = commandInput.args.trim()

    if arg is empty:
        // Show current status view
        render StatusComponent(mode="current")
        return

    arg_lower = arg.toLowerCase()

    // Validate tier
    if arg_lower NOT IN validTiers:
        render error("Unknown effort level: " + arg)
        return

    // ultracode prerequisite gate
    if arg_lower == "ultracode":
        if NOT workflowsFeatureEnabled(appContext):
            render error(ULTRACODE_NEEDS_WORKFLOWS_MSG)
            return
        // Ultracode = xhigh + dynamic workflow orchestration (session only)
        applyEffort("ultracode", scope="session")
        render confirm("Current effort level: ultracode (xhigh + dynamic workflow orchestration; this session only)")
        return

    // Remote transport guard
    if remoteTransportActive(appContext):
        applyEffortLocally(arg_lower)
        render confirm(buildConfirmMessage(arg_lower) + REMOTE_TRANSPORT_NOTE)
        return

    // Persistence decision
    scope = determinePersistenceScope(commandInput)
    if scope == "global":
        saveGlobalEffortSetting(arg_lower, appContext)
        render confirm(buildConfirmMessage(arg_lower) + SAVED_AS_DEFAULT_NOTE)
    else:
        applyEffortSessionOnly(arg_lower, appContext)
        render confirm(buildConfirmMessage(arg_lower) + SESSION_ONLY_NOTE)
```

Analysis basis: CC v2.1.167 bundle.js:+12760930, +12760947, +12760949, +12761001

---

### Effort tier validation — `effortTierCheck` (`eIH`)

```
function effortTierCheck(arg):
    // validTiers from TN set membership check
    return TN.includes(arg)
    // TN contains: "low", "medium", "high", "xhigh", "max", "auto", "ultracode"
```

The `ultracode` tier only appears in the full argument hint when workflows are available; otherwise the displayed hint omits it.
Analysis basis: CC v2.1.167 bundle.js:+4188942

---

### Workflows feature gate — `workflowsFeatureCheck` (`wf9` / `X9`)

```
function workflowsFeatureCheck(appContext):
    featureFlags = getFeatureFlags(appContext)        // X9: pgL.has check
    if featureFlags.has("allow_workflows"):           // literal bundle.js:+4187138
        return true
    if featureFlags.has("allow_product_feedback"):   // literal bundle.js:+4185711
        return true
    // Additional flag checks via UgL.has, $q, ILH, sIH, q.includes
    return false
```

Analysis basis: CC v2.1.167 bundle.js:+4186830, +4185655, +4185687

---

### Effort level descriptions — `effortDescriptionProvider` (`eiH` / `tIH`)

The handler builds a human-readable description for each tier. The known tier descriptions embedded in the bundle are:

| Tier | Description (cited from literals) |
|---|---|
| `low` | "Quick, straightforward implementation with minimal overhead" (bundle.js:+4191193) |
| `medium` | "Balanced approach with standard implementation and testing" (bundle.js:+4191274) |
| `high` | "Comprehensive implementation with extensive testing and documentation" (bundle.js:+4191352) |
| `xhigh` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `max` | "Maximum capability with deepest reasoning" (bundle.js:+4191516) |
| `ultracode` | Displayed as "xhigh + workflows" (bundle.js:+12753715); status message reads "xhigh + dynamic workflow orchestration; this session only" (bundle.js:+12749905) |
| `auto` | "Use the default effort level for your model" (bundle.js:+12748446) |

Analysis basis: CC v2.1.167 bundle.js:+4188078, +4188460, +4188083

---

### Model-tier mapping — `modelEffortResolver` (`ru`)

Certain model names are mapped to effort tiers or constrained by the resolver:

```
function modelEffortResolver(modelId, effortTier):
    // Models beginning with "claude-3-" (bundle.js:+4187731) have limited tier support
    // Named model constants checked:
    //   "claude-opus-4-0"   (bundle.js:+4187749)
    //   "claude-opus-4-1"   (bundle.js:+4187772)
    //   "claude-sonnet-4-0" (bundle.js:+4187795)
    //   "claude-sonnet-4-5" (bundle.js:+4187820)
    //   "claude-haiku-4-5"  (bundle.js:+4187845)
    //   "claude-opus-4-5"   (bundle.js:+4188210)
    //   "claude-opus-4-6"   (bundle.js:+4187987)
    //   "claude-opus-4-7"   (bundle.js:+4187964)
    //   "claude-opus-4-8"   (bundle.js:+4187941)
    //   "claude-sonnet-4-6" (bundle.js:+4188010)
    // Effort key names "max_effort" (bundle.js:+4188083) and
    //   "xhigh_effort" (bundle.js:+4188460) used internally
    resolvedEffort = mapModelToEffort(modelId, effortTier)
    return resolvedEffort
```

Analysis basis: CC v2.1.167 bundle.js:+4188834, +4188853

---

### Persistence write — `settingsSave` (`UZ_` / `D6`)

```
async function settingsSave(key, value, scope):
    // scope = "global" → writes to userSettings (bundle.js:+1283044)
    // scope = "project" → writes to projectSettings (bundle.js:+1283159)
    // scope = "local"   → writes to localSettings   (bundle.js:+1283182)

    config = loadSettingsFromDisk()      // gU → loadSettingsFromDisk_start/end
    config[key] = value                  // key = "effort" (bundle.js:+4187672)
    writeConfigAtomic(config, filePath)  // D6 → $$6 atomic write pipeline
    emitTelemetry("tengu_slate_finch")   // bundle.js:+4191639
```

The atomic write pipeline (`$$6`) uses `openSync` / `writeFileSync` / `fchmodSync` / `fsyncSync` / `renameSync` to prevent partial writes, with fallback on `ENOENT` / `ELOOP` / `ENOTDIR` errors.
Analysis basis: CC v2.1.167 bundle.js:+4191636, +3244155, +3244192, +1057398

---

### Ultracode visual effect — `ultracodeSplashRenderer` (`v4K` / `LQ`)

When the `ultracode` tier is activated, a visual animation component is rendered. The animation uses:

- A "violet-ripple" theme string (bundle.js:+12753463)
- `Math.floor`, `Math.sqrt`, `Math.cos`, `Math.min`, `Math.round` for geometry calculations
- A particle count of 17 items rendered in a map (bundle.js:+12753407)
- Frame timing step of 3 (bundle.js:+12753403), speed factor 8.5 (bundle.js:+12753582), radius 4 (bundle.js:+12753496), and 18 arc subdivisions (bundle.js:+12753678)
- The label "ultracode" (bundle.js:+12753427) displayed during the animation

Analysis basis: CC v2.1.167 bundle.js:+12753386, +12755119, +12755155

---

### Effort numeric encoding — `numericEffortEncoder` (`ou`)

Effort tiers are mapped to numeric values for API transmission:

```
function numericEffortEncoder(tierString):
    // Uses parseInt with radix 10 (bundle.js:+4189458, value=10)
    // "unset" maps to sentinel (bundle.js:+4189791)
    // "auto"  maps to auto-mode (bundle.js:+4189819)
    // "opus-4-7" and "opus-4-8" have special handling (bundle.js:+4189879, +4189941)
    // isNaN guard applied after parseInt
    numericValue = lookupTable[tierString]
    if isNaN(numericValue):
        return defaultEffort
    return numericValue
```

Analysis basis: CC v2.1.167 bundle.js:+4189364, +4189386, +4189447, +4189466

---

### Status display — `currentEffortStatusComponent`

When `/effort` is invoked with no argument, the handler renders a JSX status component showing the current effort level. The component receives props `mode="current"` and `mode="status"` (bundle.js:+12760970, +12760985) and is constructed via `XA.createElement` (bundle.js:+12761001).

Analysis basis: CC v2.1.167 bundle.js:+12760930

---

### Provider type detection — `providerTypeResolver` (`jY`)

The handler checks provider type to gate certain effort tiers:

```
function providerTypeResolver(modelConfig):
    providerTypes = ["firstParty", "anthropicAws", "foundry", "mantle"]
    // bundle.js:+2101686, +2101704, +2101724, +2101739
    // "application-inference-profile" checked separately (bundle.js:+2245499)
    return classifyProvider(modelConfig)
```

Analysis basis: CC v2.1.167 bundle.js:+2101458, +2101487, +2101509

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_effort_command` (bundle.js:+12750336) — fired on every `/effort` invocation |
| Telemetry | `tengu_workflows_enabled` (bundle.js:+4187339) — fired when workflow feature gate is evaluated |
| Telemetry | `tengu_slate_finch` (bundle.js:+4191639) — fired when effort setting is persisted to disk |
| Telemetry | `tengu_feature_ok` (bundle.js:+1010950) — feature flag check succeeded |
| Telemetry | `tengu_feature_bad` (bundle.js:+1011012) — feature flag check failed |
| Telemetry | `tengu_feature_sad` (bundle.js:+1011093) — feature flag check error state |
| Telemetry | `tengu_config_auth_loss_prevented` (bundle.js:+3262625) — safety check prevented overwriting auth credentials during config save |
| appState changes | Effort level stored under key `"effort"` (bundle.js:+4187672) in user/project/local settings JSON |
| appState changes | Session-scoped effort bypasses disk write; only held in process memory |
| Hook registration | `thinClientDispatch: "control-request"` — dispatched to the thin-client control plane for remote sessions |
| Remote transport | When remote transport is active, the effort is applied locally only; a note is appended to the confirmation message (bundle.js:+12748730) |
| Visual effect | `ultracode` tier triggers a `violet-ripple` particle animation rendered via JSX (bundle.js:+12753463) |
| Config safety | The settings writer (`X8`) checks for auth-loss before committing, emitting `tengu_config_auth_loss_prevented` and refusing to write if auth keys would be removed (bundle.js:+3262497) |
| Flag: `apply_flag_settings` | Applied after effort is set (bundle.js:+12748853) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.167 | Initial analysis — `ultracode` tier added with workflow prerequisite gate and violet-ripple visual effect; `xhigh` and `max` tiers present; remote-transport local-application note; numeric effort encoding via `ou`; atomic config write pipeline |

---

## Common Mistakes

1. **Invoking `/effort ultracode` without enabling dynamic workflows first.** The command will refuse with "Ultracode needs dynamic workflows enabled (see /config). Valid options are: low, medium, high, xhigh, max, auto" (bundle.js:+12750745). Enable workflows via `/config` before using `ultracode`.

2. **Expecting `/effort` changes to persist when using a remote transport.** When connected via a remote transport, the effort change is applied locally only and a note is appended to the confirmation. The server-side effort level is unaffected (bundle.js:+12748730).

3. **Assuming `auto` resets to a neutral state.** `auto` instructs Claude Code to use the model's own default effort level, which varies by model. It is not equivalent to "low" (bundle.js:+4189819).

4. **Using a numeric value instead of a named tier.** The command expects string tier names (`low`, `medium`, `high`, `xhigh`, `max`, `ultracode`, `auto`). Numeric inputs are not valid arguments.

5. **Expecting `ultracode` to persist across sessions.** The confirmation message explicitly states "this session only" (bundle.js:+12749905). Ultracode cannot be saved as a global default.

6. **Confusing `max` with `ultracode`.** `max` means "maximum capability with deepest reasoning" (bundle.js:+4191516) and can be saved as a default. `ultracode` adds dynamic workflow orchestration on top of `xhigh` and is always session-scoped.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Wmf` | `effortCommandHandler` — main async handler for `/effort` (arbor_handler) |
| `tb8` | Top-level command registration / entry wrapper for `/effort` |
| `Ua` | Command argument pre-processor / dispatch router |
| `zP` | Effort validation and feature-gate orchestrator |
| `if8` | Inner argument normaliser (calls string conversion `_6`) |
| `_6` | String coercion utility |
| `aE` | Error display helper |
| `wf9` | Workflow feature flag lookup dispatcher |
| `X9` | Feature flag set membership tester (pgL / UgL checks) |
| `uZ_` | Settings persistence writer orchestrator |
| `FgL` | Effort key writer (uses `_6`, `D6`, `jK`, `Aq`) |
| `BgL` | Error-branch display formatter |
| `pa` | Effort UI component renderer (parent) |
| `h2` | Model-to-effort mapping helper |
| `e1` | Provider type classifier |
| `Jh` | Effort label formatter |
| `jY` | Provider type resolver (`firstParty`/`anthropicAws`/`foundry`/`mantle`) |
| `_kH` | Session-scope effort applicator |
| `C6` | Settings mutation with timestamp (`Date.now`) |
| `sf8` | Additional effort UI sub-renderer |
| `HkH` | Effort confirmation message builder |
| `ou` | Numeric effort encoder (parseInt / isNaN guard) |
| `eiH` | Effort tier description provider (low/medium/high/max) |
| `tIH` | Extended effort description provider (xhigh/ultracode) |
| `oL` | Utility: feature flag reader / settings loader |
| `uTH` | Feature flag utility sub-function |
| `EN` | Effort component entry-point renderer |
| `x7H` | Remote transport guard wrapper |
| `eIH` | Tier membership validator (TN.includes check) |
| `W_H` | String formatter for confirmation messages |
| `UZ_` | Persistence-scope router (calls `ggL`, `C4H`, `D6`) |
| `ggL` | Session-only effort state applicator |
| `C4H` | Global-default effort state applicator |
| `Aq` | Config write orchestrator |
| `GY` | API key and provider config resolver |
| `D6` | Atomic config disk writer |
| `dj6` | Config file path resolver |
| `cj6` | Config schema validator |
| `hu` | Config loader wrapper |
| `yu` | Config cache reader |
| `dq8` | Config deduplicated write helper |
| `yP_` | Config write with UUID + event emit |
| `xP_` | Post-write cache updater |
| `y4K` | Ultracode animation: cosine-based coordinate calculator |
| `k4K` | Ultracode animation: square-root distance helper |
| `v4K` | Ultracode animation: main particle frame renderer |
| `ru` | Model effort resolver (modelId × tier → resolved tier) |
| `E4K` | Ultracode animation: particle array builder |
| `H` | Bootstrap fetch / model list utility |
| `v` | HTTP fetch wrapper (bootstrap) |
| `onK` | HTTP request builder |
| `RH` | JSON serialiser (JSON.stringify wrapper) |
| `G4` | Model name normaliser / path extractor |
| `EUH` | Locale/language utility |
| `enK` | File-based context loader |
| `Y3` | User-agent string builder |
| `uj_` | String splitter / trimmer |
| `q` | Filesystem utility namespace |
| `lHH` | Seen-set membership checker |
| `uj` | String replacer |
| `H9` | Model name parser |
| `m6H` | Model metadata extractor |
| `s9` | Model slug normaliser |
| `FJ` | Model family classifier |
| `o6` | JSX element factory helper |
| `l` | Base JSX renderer |
| `J6` | JSX element post-processor |
| `sb8` | Effort status reader (reads current tier + model) |
| `eb8` | Effort argument dispatcher (lowercase + route) |
| `auf` | Effort set-with-save path |
| `C7A` | Effort apply-to-session path |
| `eP` | Feature flag pass-through |
| `MP6` | Effort UI message compositor |
| `PjH` | Confirmation text builder |
| `o_` | Settings load-and-write pipeline |
| `eO` | Config directory resolver |
| `d6` | Filesystem stat helper |
| `H__` | Config file read helper |
| `kd` | Full settings loader (all scopes) |
| `oP` | Settings merge helper |
| `h8` | ENOENT error classifier |
| `t6_` | Timestamp setter |
| `IZH` | Settings re-reader after write |
| `$$6` | Atomic file writer (open/write/fsync/rename) |
| `LY` | Cache-clear helper (Yp6, HQ8) |
| `yl6` | Gitignore-aware file writer |
| `qu` | `.claude/settings.json` path resolver |
| `W_` | Timeout/retry utility |
| `SH` | Styled JSX message renderer |
| `CH` | Error JSX renderer |
| `gU` | Settings load orchestrator (loadSettingsFromDisk) |
| `hH` | Error logger (pr.logError) |
| `lC` | Effort confirmation message renderer |
| `X8` | Global config save with auth-loss guard |
| `P6` | JSX paragraph component |
| `ym6` | JSX base element |
| `suf` | Effort set-session-only path |
| `HrH` | Argument trimmer + tier validator |
| `ouf` | Effort set-with-persistence path (full) |
| `LQ` | Ultracode animation frame compositor |
| `O` | Animation particle state array |
| `b8` | Background session state reader |