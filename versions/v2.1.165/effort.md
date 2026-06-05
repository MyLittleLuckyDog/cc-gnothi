---
type: feature-spec
feature: "effort"
cc_version: "2.1.165"
updated: "2026-06-05"
tags: ["effort", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.165 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/effort`

> Analysis basis: CC v2.1.165 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.165

---

## Overview

The `/effort` command sets the reasoning/effort level applied to model inference for the current or future sessions. It accepts a named tier (`low`, `medium`, `high`, `xhigh`, `max`, `ultracode`, or `auto`) and either persists the selection as the user's default for new sessions or applies it only to the current session. The `ultracode` tier is a special compound mode that enables `xhigh` effort plus dynamic workflow orchestration and is only available when the `allow_workflows` feature flag is active.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `effort` |
| description | Set effort level for model usage |
| argumentHint | `[low\|medium\|high\|xhigh\|max\|ultracode\|auto] \| [low\|medium\|high\|xhigh\|max\|auto]` |
| immediate | `null` |
| thinClientDispatch | `control-request` |
| module_id | `dqK` |
| load_inline | `true` |
| loc_byte | `12726413` |
| loc_byte_end | `12726744` |
| loc_line | `9089` |
| arbor_handler.name | `cbf` |
| arbor_handler.fqn | `claude-2.1.165::cbf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.165 bundle.js:+12726413

---

## Input Branching

The command exhibits 5+ distinct branches depending on the argument supplied and the session/environment state. A Mermaid flowchart is used below.

```mermaid
flowchart TD
    A["/effort [arg]"] --> B{Argument provided?}
    B -- No --> C[Display current effort level and available tiers]
    B -- Yes --> D{arg == 'ultracode'?}
    D -- Yes --> E{allow_workflows feature enabled?}
    E -- No --> F[Error: 'Ultracode needs dynamic workflows enabled\nsee /config. Valid options: low,medium,high,xhigh,max,auto']
    E -- Yes --> G[Set effort = xhigh + dynamic workflow orchestration\nDisplay: 'this session only']
    D -- No --> H{arg is valid tier?\nlow|medium|high|xhigh|max|auto}
    H -- No --> I[Display usage / unknown tier error]
    H -- Yes --> J{Remote transport active?\nthinClientDispatch = control-request}
    J -- Yes --> K[Apply effort locally\nAppend note: 'applied locally — this remote transport\ncannot change server effort']
    J -- No --> L{arg should persist?}
    L -- Yes/default --> M[Save as user default for new sessions\nDisplay: 'saved as your default for new sessions']
    L -- Session-only flag --> N[Apply this session only\nDisplay: 'this session only']
    G --> O[Emit tengu_effort_command telemetry]
    M --> O
    N --> O
    K --> O
```

Analysis basis: CC v2.1.165 bundle.js:+12713563, +12714428, +12713371, +12713415, +12712413

---

## Behavioral Spec

### Handler Entry Point (`cbf`)

The Arbor-resolved handler is the async function `cbf` (FQN `claude-2.1.165::cbf`, resolved via `module_id`).

```
async function handleEffortCommand(args, appState):
    normalizedArg = args.trim().toLowerCase()

    if normalizedArg is empty:
        return renderCurrentEffortStatus(appState)

    if normalizedArg == "ultracode":
        return handleUltracodeVariant(appState)

    if normalizedArg not in VALID_TIERS:
        return renderUsageError()

    return applyEffortTier(normalizedArg, appState)
```

Analysis basis: CC v2.1.165 bundle.js:+12724605, +12724622, +12724624, +12724676

---

### Display-Current-Status Path

When no argument is provided, the handler renders the current effective effort level. If the current mode is `ultracode`, a dedicated status string is displayed:

> "Current effort level: ultracode (xhigh + dynamic workflow orchestration; this session only)"

(bundle literal, ≤30-char citation fragment: `"Current effort level: ul…"`)

Analysis basis: CC v2.1.165 bundle.js:+12713588

```
function renderCurrentEffortStatus(appState):
    currentLevel = resolveEffortLevel(appState)
    if currentLevel == "ultracode":
        display ULTRACODE_STATUS_STRING
    else:
        display formatted status for currentLevel
```

---

### Effort Tier Validation (`resolveEffortAllowedSet`)

The valid tier set is determined by whether `allow_workflows` is active in the session feature flags. The `ultracode` option is added to the hint string only when workflows are permitted.

```
function buildAllowedTiers(featureFlags):
    baseTiers = ["low", "medium", "high", "xhigh", "max", "auto"]
    if featureFlags.allow_workflows == true:
        return baseTiers + ["ultracode"]
    else:
        return baseTiers
```

The `argumentHint` registration field reflects this: the first bracket includes `ultracode`; the second (shown when workflows are unavailable) does not.

Analysis basis: CC v2.1.165 bundle.js:+4179842, +12711733

---

### Tier Descriptions

Each named tier carries a human-readable description surfaced in the UI:

| Tier | Description literal (partial) |
|---|---|
| `low` | "Quick, straightforward implementation…" |
| `medium` | "Balanced approach with standard implementation…" |
| `high` | "Comprehensive implementation with extensive testing…" |
| `xhigh` | (no separate description literal found at depth-2) |
| `max` | "Maximum capability with deepest reasoning" |
| `ultracode` | Composite: `xhigh` + workflow orchestration |
| `auto` | "Use the default effort level for your model" |

Analysis basis: CC v2.1.165 bundle.js:+4183885, +4183897, +4183963, +4183978, +4184056, +4184220, +12712129

---

### Ultracode Variant Handler

```
async function handleUltracodeVariant(appState):
    workflowsEnabled = checkFeatureFlag(appState, "allow_workflows")
    if not workflowsEnabled:
        return displayError(
            "Ultracode needs dynamic workflows enabled (see /config). " +
            "Valid options are: low, medium, high, xhigh, max, auto"
        )
    setSessionEffort("xhigh")
    enableDynamicWorkflowOrchestration(appState)
    displayConfirmation("this session only")
    emitTelemetry("tengu_effort_command")
```

Analysis basis: CC v2.1.165 bundle.js:+12714428, +4179842, +12713415

---

### Applying a Standard Effort Tier (`applyEffortTier`)

```
async function applyEffortTier(tier, appState):
    isRemoteTransport = (thinClientDispatch == "control-request")
    if isRemoteTransport:
        applyEffortLocally(appState, tier)
        appendNote(" (applied locally — this remote transport can't change server effort)")
    else:
        if shouldPersistAsDefault(appState):
            saveUserDefaultEffort(tier)
            appendNote(" (saved as your default for new sessions)")
        else:
            setSessionEffort(appState, tier)
            appendNote(" (this session only)")
    emitTelemetry("tengu_effort_command")
```

Analysis basis: CC v2.1.165 bundle.js:+12712413, +12713371, +12713415

---

### Effort-Level Normalisation (`normalizeEffortValue`)

Numeric string inputs (e.g., passed programmatically) are parsed via `parseInt` and checked with `isNaN`. The special internal tokens `"opus-4-7"` and `"opus-4-8"` found in the call graph suggest that some model identifiers are translated to effort tokens internally. The base-10 parse uses radix `10`.

```
function normalizeEffortValue(raw):
    if typeof raw == "string":
        n = parseInt(raw, 10)
        if not isNaN(n):
            return mapNumericToTier(n)
    return raw  // already a named tier string
```

Analysis basis: CC v2.1.165 bundle.js:+4182151, +4182170, +4182583, +4182645

---

### Model-Specific Effort Constraints (`checkModelEffortSupport`)

The call graph traverses a model-ID allow-list. The following Claude model identifiers are explicitly referenced in literals:

- `claude-3-*` prefix family
- `claude-opus-4-0`, `claude-opus-4-1`, `claude-opus-4-5`, `claude-opus-4-6`, `claude-opus-4-7`, `claude-opus-4-8`
- `claude-sonnet-4-0`, `claude-sonnet-4-5`, `claude-sonnet-4-6`
- `claude-haiku-4-5`

The `high` and `xhigh` literals appear in the context of per-model capability checks.

```
function modelSupportsEffortTier(modelId, tier):
    if tier in ["high", "xhigh", "max"]:
        return SUPPORTED_MODELS_SET.has(modelId)
    return true  // low, medium, auto always allowed
```

Analysis basis: CC v2.1.165 bundle.js:+4180435, +4180453 – +4180714, +4184559, +4184601

---

### Visual Ripple Effect (`ultracode` activation animation)

When `ultracode` is activated, a "violet-ripple" animation is triggered using cosine/square-root easing over a computed arc. Constants found in the relevant call cluster: frame count `17`, particle count `3`, radius factor `8.5`, step `4`, animation identifiers `QqK`/`gqK`/`BqK`.

```
function triggerUltracodeRippleAnimation():
    animationName = "violet-ripple"
    frameCount    = 17
    particleCount = 3
    radiusFactor  = 8.5
    stepSize      = 4
    for each frame in range(frameCount):
        x = Math.cos(frame * PI / frameCount)
        r = Math.min(radiusFactor * x, MAX_RADIUS)
        pts = buildParticlePositions(particleCount, Math.sqrt(r))
        renderFrame(pts, Math.round(r))
```

Analysis basis: CC v2.1.165 bundle.js:+12717069, +12717086, +12717090, +12717110, +12717146, +12717168, +12717265, +12718802, +12718838, +12718860, +12718701

---

### Settings Persistence (`saveUserDefaultEffort`)

Effort persistence uses the standard CC settings layer (`.claude/settings.json` / `.claude/settings.local.json`). The key written is `"effort"`.

```
async function saveUserDefaultEffort(tier):
    settings = loadSettingsFromDisk("userSettings")
    settings.effort = tier
    writeSettingsAtomically(settings, path=".claude/settings.json")
    emitTelemetry("tengu_effort_command")
```

Analysis basis: CC v2.1.165 bundle.js:+4180376, +1269308, +1269318, +1278808

---

### Settings-Write Guard (auth-loss prevention)

Before writing settings to disk, the config-save path checks that auth credentials present in the cached config are not absent from the freshly re-read file. If auth would be lost, the write is aborted and telemetry event `tengu_config_auth_loss_prevented` is emitted.

Analysis basis: CC v2.1.165 bundle.js:+3256998, +3257126

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_effort_command` | Fired on every successful effort change (standard tier or ultracode). Analysis basis: CC v2.1.165 bundle.js:+12714019 |
| Telemetry — `tengu_workflows_enabled` | Fired when the `allow_workflows` feature flag is read as `true` during effort resolution. Analysis basis: CC v2.1.165 bundle.js:+4180043 |
| Telemetry — `tengu_slate_finch` | Fired in the settings-write path. Analysis basis: CC v2.1.165 bundle.js:+4184343 |
| Telemetry — `tengu_feature_ok` | Fired on successful feature flag check. Analysis basis: CC v2.1.165 bundle.js:+1010222 |
| Telemetry — `tengu_feature_sad` | Fired when a feature check returns a non-fatal negative. Analysis basis: CC v2.1.165 bundle.js:+1010365 |
| Telemetry — `tengu_feature_bad` | Fired on feature-check error. Analysis basis: CC v2.1.165 bundle.js:+1010284 |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired if settings write is blocked to prevent auth loss. Analysis basis: CC v2.1.165 bundle.js:+3257126 |
| appState changes | Session effort level updated in-memory; persisted to `userSettings` when default-save path is taken |
| Settings file write | `.claude/settings.json` (global default) or session-only in-memory; uses atomic write with temp file + rename + fsync |
| Dynamic workflow orchestration | Enabled in appState when `ultracode` is selected and `allow_workflows` is `true` |
| Visual animation | "violet-ripple" particle animation rendered in the CLI UI on `ultracode` activation |
| thinClientDispatch | Set to `"control-request"` — when a remote transport is active, effort is applied client-side only with an informational note |
| Hook registration | No dedicated hook registration found at depth-2 traversal |
| Sound | No sound effect found at depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.165 | Initial analysis |

---

## Common Mistakes

1. **Passing `ultracode` without enabling dynamic workflows**: The command will reject `ultracode` with a clear error message directing the user to `/config`. Enable `allow_workflows` first.
2. **Expecting `ultracode` to persist across sessions**: The `ultracode` mode is explicitly session-only (`this session only`). It cannot be saved as a default.
3. **Assuming effort changes propagate to the server when using a remote/thin-client transport**: When `thinClientDispatch` is `"control-request"`, the effort change is applied locally in the client only; the server-side inference profile is not altered.
4. **Providing a numeric tier value interactively**: The argument hint shows named strings. Numeric inputs may be accepted programmatically via `parseInt` but this is not the intended interactive API.
5. **Omitting the argument expecting a toggle**: `/effort` with no argument displays current status — it does not cycle or toggle the level.
6. **Confusing `xhigh` and `ultracode`**: `ultracode` sets `xhigh` effort *plus* dynamic workflow orchestration. Selecting `xhigh` directly does not enable workflows.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `cbf` | Main async handler for `/effort` command (Arbor-resolved, FQN `claude-2.1.165::cbf`) |
| `uC8` | Top-level effort command entry / JSX render function |
| `mC8` | Effort command UI component (renders argument-hint and current status) |
| `Tbf` | Effort-apply sub-handler (non-ultracode path, standard tier) |
| `Vbf` | Effort-apply sub-handler (variant / thin-client path) |
| `Zbf` | Effort command dispatcher / argument router |
| `DLA` | Settings-load and apply helper |
| `EX6` | Effort-set-and-confirm renderer |
| `ZC` | Config-save guard (auth-loss prevention wrapper) |
| `X8` | Atomic config write implementation |
| `Wa` | Effort level resolution / model-tier mapping |
| `UW` | Model-ID to effort capability checker |
| `TIH` | Session-only effort setter |
| `n78` | Effort persistence (save-as-default) helper |
| `EIH` | Effort level normaliser (string→enum) |
| `Nu` | Numeric effort parser (`parseInt` + `isNaN` guard) |
| `WX6` | Max-effort path handler (`max_effort`) |
| `DiH` | xhigh-effort path handler (`xhigh_effort`) |
| `ON` | Effort option set builder / allowed-tier checker |
| `K7H` | Model capability gate for `high`/`xhigh` tiers |
| `GIH` | Model allow-list membership check |
| `i8H` | Effort-level string formatter |
| `VT_` | Settings write with `tengu_slate_finch` telemetry |
| `OP` | Workflow feature flag resolver |
| `W9` | Feature flag reader (`allow_product_feedback`, `allow_workflows`) |
| `aL9` | `allow_workflows` specific flag check |
| `ET_` | Effort UI message builder |
| `SBL` | Effort confirmation message formatter |
| `hBL` | Fallback/error message for unsupported effort level |
| `Ga` | Effort component compositor |
| `Q78` | Effort string coercion helper |
| `eH` | String conversion utility |
| `nT` | No-op / identity transform helper |
| `BqK` | Ultracode ripple animation driver |
| `QqK` | Ripple frame cosine + round computation |
| `gqK` | Ripple radius square-root computation |
| `uqK` | Particle position map helper |
| `xg` | Ripple animation JSX renderer |
| `xC8` | Effort status display (current-level path) |
| `wiH` | Argument trim + GIH dispatch |
| `Vu` | Effort UI compound component |
| `s4` | App settings accessor |
| `MEH` | Settings mutation helper |
| `D6` | Event emitter / session state writer |
| `y6` | Session timestamp recorder |
| `_q` | Settings serialiser |
| `zY` | Settings file writer (atomic, uses fsync) |
| `r_` | Config read/write orchestrator (loads policy, flag, user, project, local settings) |
| `DU` | Settings-from-disk loader |
| `Kd` | Settings schema validator / field extractor |
| `TM6` | Atomic file write with temp-rename |
| `vc6` | Per-file settings tracker (gitignore-aware) |
| `Sx` | `.claude` directory path builder |
| `sz` | Cache clear on config reload |
| `pH_` | Settings timestamp recorder |
| `rTH` | Settings reload helper |
| `e1` | Model name normaliser |
| `Aq` | Model alias resolver (`opusplan`, `sonnet`, `haiku`, `opus`, `best`) |
| `t1` | Model inference-profile type checker (`application-inference-profile`) |
| `ny` | API provider type resolver |
| `CD` | Provider classification (`firstParty`, `anthropicAws`, `foundry`, `mantle`) |
| `Au` | Conversation context accessor |
| `qu` | Active session resolver |
| `B98` | Session state cache (get/set with `DX_` dedup set) |
| `YX_` | Session initialiser (emits `GrowthbookExperimentEvent`) |
| `XX_` | Session event emitter chain |
| `H` | HTTP bootstrap fetch helper |
| `v` | HTTP request constructor |
| `s6` | React component helper (uses `Nu6`) |
| `c` | Core React createElement alias |
| `P6` | React component wrapper (`Nu6`) |
| `SH` | JSON serialiser wrapper |
| `J4` | Path/string utility (replace, slice, lastIndexOf) |
| `ppH` | Content formatter (`C2A`) |
| `acK` | File content loader (Buffer.byteLength, async read) |
| `Gw_` | String split/trim/slice helper |
| `ZHH` | Cache membership checker (`c44`) |
| `uj` | String replace utility |
| `D6H` | Model context builder |
| `eX` | Model context wrapper |
| `kH` | Error logger (`Er.logError`) |
| `hH` | UI component (uses `c`, `P6`) |
| `RH` | UI component (uses `c`, `P6`) |
| `O` | Background-session state array |
| `b8` | Background session object type |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.