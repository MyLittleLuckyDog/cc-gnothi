---
type: feature-spec
feature: "effort"
cc_version: "2.1.168"
updated: "2026-06-11"
tags: ["effort", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.168 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/effort`

> Analysis basis: CC v2.1.168 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.168

---

## Overview

The `/effort` command sets the reasoning and resource effort level that the model applies to subsequent requests within the current session, or optionally persists that setting as the user's default. It accepts a named tier (`low`, `medium`, `high`, `xhigh`, `max`, `ultracode`, or `auto`), validates it against model and feature-flag constraints, then updates the session's effort state and displays confirmation feedback including a visual animated indicator.

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
| module_id | `R4K` |
| load_inline | `true` |
| loc_byte | `12762923` |
| loc_byte_end | `12763254` |
| loc_line | `9103` |
| arbor_handler.name | `Tmf` |
| arbor_handler.fqn | `claude-2.1.168::Tmf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.168 bundle.js:+12762923

---

## Input Branching

Six or more distinct branches exist (effort tier validation, ultracode gate, model compatibility checks, persistence vs. session-only paths, remote-transport limitation, and no-argument status display), so a Mermaid flowchart is required.

```mermaid
flowchart TD
    A(["/effort [arg]"]) --> B{Argument supplied?}
    B -- No --> C[Display current effort status\nand available tiers]
    C --> Z([Done])

    B -- Yes --> D{Normalize: trim + lowercase}
    D --> E{Is arg in valid tier list?}
    E -- No --> F[Show error: invalid tier\nList valid options]
    F --> Z

    E -- Yes --> G{arg == 'ultracode'?}
    G -- Yes --> H{Dynamic workflows\nfeature flag enabled?}
    H -- No --> I["Error: 'Ultracode needs dynamic\nworkflows enabled (see /config)'\nValid options: low medium high\nxhigh max auto"]
    I --> Z

    H -- Yes --> J[Proceed with ultracode\n= xhigh + dynamic workflow\norchestration]

    G -- No --> K{Model compatibility check\nagainst allowed model list}
    K -- Incompatible --> L[Show model-incompatibility\nwarning / fallback message]
    L --> Z

    K -- Compatible --> M{Remote transport\nin use?}
    M -- Yes --> N["Append notice:\n'applied locally — remote\ntransport can't change server effort'"]
    N --> O

    M -- No --> O{Save as default\nor session-only?}
    O -- Save default --> P[Persist effort to user settings\nAppend '(saved as your default\nfor new sessions)']
    O -- Session only --> Q[Apply effort to session state\nAppend '(this session only)']
    P --> R[Update appState effort field\nEmit tengu_effort_command telemetry\nRender animated confirmation JSX]
    Q --> R
    R --> Z
```

Analysis basis: CC v2.1.168 bundle.js:+12750065, +12750930, +12749873, +12749917, +12748915

---

## Behavioral Spec

### 1 — Argument Normalization and Tier Validation

```
function normalizeAndValidateTier(rawArg):
    trimmed = rawArg.trim()
    lower   = trimmed.toLowerCase()

    # Valid tiers when dynamic workflows are available
    fullTierList    = ["low", "medium", "high", "xhigh", "max", "ultracode", "auto"]
    # Valid tiers when workflows are unavailable
    limitedTierList = ["low", "medium", "high", "xhigh", "max", "auto"]

    if lower not in fullTierList:
        return Error("invalid tier", show=limitedTierList)

    return lower
```

Analysis basis: CC v2.1.168 bundle.js:+4189128, +4189170, +12748235

The `argumentHint` field of the registration exposes both tier lists to the shell completion layer: the first variant includes `ultracode`, the second omits it, reflecting the workflow-flag gate.

---

### 2 — Ultracode Guard (Dynamic Workflow Feature Flag)

```
function guardUltracode(tier, appState):
    if tier != "ultracode":
        return Ok

    workflowsEnabled = featureFlagAllowWorkflows(appState)   # checks "allow_workflows"
    if not workflowsEnabled:
        return Error(
            "Ultracode needs dynamic workflows enabled (see /config). " +
            "Valid options are: low, medium, high, xhigh, max, auto"
        )

    return Ok  # ultracode proceeds as xhigh + dynamic workflow orchestration
```

Analysis basis: CC v2.1.168 bundle.js:+12750930, +4187254, +4187379

The string `"allow_workflows"` is the feature-flag key checked internally (bundle.js:+4187254). When the flag is absent or false the `ultracode` tier is silently excluded from the hint list and produces an actionable error message directing the user to `/config`.

---

### 3 — Model Compatibility Resolution

```
function resolveModelCompatibility(tier, currentModel):
    # Known model strings cross-referenced at this site
    supportedModels = [
        "claude-3-*",
        "claude-opus-4-0", "claude-opus-4-1",
        "claude-sonnet-4-0", "claude-sonnet-4-5",
        "claude-haiku-4-5",
        "claude-opus-4-5", "claude-opus-4-6",
        "claude-opus-4-7", "claude-opus-4-8",
        "claude-sonnet-4-6",
    ]

    # High-effort tiers ("max_effort", "xhigh_effort") have additional
    # per-model constraints checked via set membership lookups
    if tier in ["max", "xhigh"] and currentModel not in highEffortAllowList:
        return Warning("model does not support this effort tier; downgrading")

    return Ok
```

Analysis basis: CC v2.1.168 bundle.js:+4187847, +4187865, +4187888, +4187911, +4187936, +4187961, +4188057, +4188080, +4188103, +4188126, +4188199, +4188576

The internal effort-tag strings used for the API call are `"max_effort"` (bundle.js:+4188199) and `"xhigh_effort"` (bundle.js:+4188576).

---

### 4 — Remote Transport Limitation Notice

```
function maybeAppendRemoteNotice(message, transportKind):
    if transportKind == "remote":
        message += " (applied locally — this remote transport can't change server effort)"
    return message
```

Analysis basis: CC v2.1.168 bundle.js:+12748915

This notice is appended to the confirmation string when the session is operating via a remote thin-client transport. The effort change is still recorded locally; only server-side inference parameters are unaffected.

---

### 5 — Persistence Decision

```
function applyEffortSetting(tier, persistDefault, settingsStore, sessionState):
    if persistDefault:
        settingsStore.saveUserDefault("effort", tier)
        confirmSuffix = " (saved as your default for new sessions)"
    else:
        sessionState.effort = tier
        confirmSuffix = " (this session only)"

    return buildConfirmationMessage(tier, confirmSuffix)
```

Analysis basis: CC v2.1.168 bundle.js:+12749873, +12749917

The persistence flag is derived from the invocation context (interactive vs. non-interactive, or an explicit `--save` style flag not directly surfaced in the argument hint).

---

### 6 — Tier Description Table (Confirmation UI)

The command renders a JSX confirmation element that includes a human-readable description of the selected tier:

| Tier | Description string |
|---|---|
| `low` | Quick, straightforward implementation with minimal overhead |
| `medium` | Balanced approach with standard implementation and testing |
| `high` | Comprehensive implementation with extensive testing and documentation |
| `max` | Maximum capability with deepest reasoning |
| `ultracode` | xhigh + dynamic workflow orchestration; this session only |

Analysis basis: CC v2.1.168 bundle.js:+4191297, +4191309, +4191375, +4191390, +4191468, +4191632, +12750090, +12753900

---

### 7 — Animated Visual Indicator (Ultracode)

```
function renderUltracodeAnimation(canvas, frameIndex):
    # Uses cosine-based wave, sqrt distance, floor/round math
    # Emits a "violet-ripple" named animation
    x = Math.cos(angle) * amplitude
    d = Math.sqrt(dx*dx + dy*dy)
    frame = Math.floor(frameIndex % frameCount)
    cell  = Math.round(intensity * scale)
    return renderFrame(canvas, frame)
```

Analysis basis: CC v2.1.168 bundle.js:+12753571, +12753648, +12755203, +12755304, +12755340, +12755362

The animation identifier is `"violet-ripple"` (bundle.js:+12753648). Constants: ripple base period `3` (bundle.js:+12753588), frame count `17` (bundle.js:+12753592), amplitude scale `8.5` (bundle.js:+12753767), cell count steps `4` (bundle.js:+12753681), display row counts `5`, `7`, `9` (bundle.js:+12755735, +12755755, +12756014).

---

### 8 — Status Display (No-Argument Invocation)

```
function displayCurrentEffort(appState):
    currentTier = appState.effort ?? "unset"
    render JSX with:
        - mode = "current"  (bundle.js:+12761155)
        - variant = "status" (bundle.js:+12761170)
        - tier label and description
```

Analysis basis: CC v2.1.168 bundle.js:+12761115, +12761132, +12761134, +12761186, +4189907

When no argument is passed, the handler (resolved as `Tmf` via Arbor `module_id` path) checks whether the current effort is in the known tier list (`sHH.includes`) and renders a status-only JSX component rather than modifying state.

---

### 9 — Settings Persistence Layer

```
function saveEffortToSettings(tier, scope):
    # scope: "userSettings", "projectSettings", "localSettings"
    path = resolvePath(".claude", "settings.json")
    existing = readJSON(path)
    existing["effort"] = tier
    atomicWrite(path, existing)   # uses temp-file + rename pattern
```

Analysis basis: CC v2.1.168 bundle.js:+1282420, +1283044, +1283159, +1283182, +1272961, +1272971, +1058550, +1058802

The settings layer uses an atomic write strategy: write to a temp file, apply permissions, then `renameSync` to the target path (bundle.js:+1058550, +1058802).

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_effort_command` (bundle.js:+12750521) — fired on every successful tier change |
| Telemetry | `tengu_workflows_enabled` (bundle.js:+4187455) — fired during workflow-flag check |
| Telemetry | `tengu_slate_finch` (bundle.js:+4191755) — fired during effort-state write path |
| Telemetry | `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` (bundle.js:+1010950, +1011012, +1011093) — feature health signals emitted by shared settings infrastructure |
| Telemetry | `tengu_config_auth_loss_prevented` (bundle.js:+3262741) — fired if a settings save would overwrite auth tokens; write is aborted |
| appState changes | `effort` field updated to the chosen tier string |
| Settings persistence | Optionally writes `effort` key to `~/.claude/settings.json` (user default path) |
| Hook registration | `apply_flag_settings` hook invoked after effort change (bundle.js:+12749038) |
| JSX render | Confirmation or status component rendered inline; ultracode path renders `"violet-ripple"` animation |
| Sound | None detected |

---

## Version History

| Version | Change |
|---|---|
| v2.1.168 | Initial analysis — `ultracode` tier introduced alongside `allow_workflows` feature flag; `violet-ripple` animation added; remote-transport limitation notice added |

---

## Common Mistakes

1. **Using `ultracode` without enabling dynamic workflows.** The command will reject the tier with an explicit error and redirect to `/config`. Enable the `allow_workflows` feature first.
2. **Expecting server-side effect over a remote transport.** The remote-transport notice (bundle.js:+12748915) means only local session state is updated; the inference server ignores the effort hint.
3. **Confusing `max` with `ultracode`.** `max` means "maximum capability with deepest reasoning" at standard workflow scope; `ultracode` additionally enables dynamic workflow orchestration and requires the feature flag.
4. **Omitting the argument and expecting a change.** Calling `/effort` with no argument only shows the current status; it does not reset or toggle anything.
5. **Assuming persistence by default.** Without an explicit save trigger, changes apply to the current session only and are annotated `"(this session only)"`. To make permanent, ensure the persistence path is taken (confirmation will say `"saved as your default for new sessions"`).
6. **Case sensitivity.** The tier is lowercased internally, but passing an unexpected variant (e.g. `"HIGH"`) should normalize; passing an entirely unknown string (e.g. `"extreme"`) will produce a validation error listing the valid options.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Tmf` | Main async handler for `/effort` command (Arbor-resolved via `module_id` → `R4K`) |
| `eb8` | Top-level command entry point / BFS root called by `Tmf` |
| `Ua` | Effort command orchestrator — delegates to tier-resolution and UI render paths |
| `zP` | Effort tier resolution / model compatibility check coordinator |
| `rf8` | Feature-flag reader (reads `allow_product_feedback` and related flags) |
| `_6` | String coercion / primitive utility |
| `aE` | General-purpose error/result wrapper |
| `jf9` | Workflow-flag check delegator (checks `allow_workflows`) |
| `X9` | Feature flag set membership tester (uses `FgL.has`, `ggL.has`) |
| `mZ_` | Effort metadata builder — assembles tier description records |
| `dgL` | Tier descriptor constructor (maps tier name → description string) |
| `QgL` | Effort validation error formatter |
| `pa` | Effort application and persistence dispatcher |
| `h2` | Model compatibility resolver against known model list |
| `e1` | Application-inference-profile type checker |
| `Xh` | API provider type resolver (`firstParty`, `anthropicAws`, `foundry`, `mantle`) |
| `jY` | Provider-type branch handler |
| `_kH` | Effort-tier membership validator (checks tier against known list) |
| `C6` | Settings write coordinator (includes `Date.now` timestamp) |
| `tf8` | Session-only effort applier |
| `HkH` | Post-change hook invoker (`apply_flag_settings`) |
| `ou` | Effort numeric parser / budget token resolver (uses `parseInt`, `isNaN`) |
| `HrH` | Max-effort (`max_effort`) path handler |
| `tIH` | Xhigh-effort (`xhigh_effort`) path handler |
| `oL` | UI output renderer / message emitter |
| `uTH` | Underlying output transport |
| `EN` | Effort UI component selector |
| `x7H` | Effort display renderer |
| `eIH` | Tier membership inclusion checker (checks against `TN` list) |
| `W_H` | Effort confirmation string builder |
| `BZ_` | Settings persistence writer |
| `cgL` | Config write guard (auth-loss prevention) |
| `C4H` | User settings update function |
| `Aq` | Config accessor / settings object builder |
| `GY` | API key / auth configuration reader |
| `D6` | Settings file writer with cache management |
| `cq8` | Settings dedup / cache-hit checker |
| `hP_` | GrowthBook experiment event emitter |
| `uP_` | Settings post-write side-effect handler |
| `S4K` | Ultracode animation frame renderer (uses `Math.cos`, `Math.min`, `Math.round`) |
| `h4K` | Ultracode distance calculator (uses `Math.sqrt`) |
| `k4K` | Ultracode animation orchestrator (uses `Math.floor`, drives `V4K`) |
| `ru` | Effort state reader from app context |
| `V4K` | Ultracode canvas row mapper |
| `H` | Generic list / array of items (context-dependent) |
| `v` | HTTP fetch / bootstrap fetch utility |
| `snK` | Fetch response parser |
| `RH` | JSON serializer (wraps `JSON.stringify`) |
| `G4` | User-agent / path string builder |
| `EUH` | Network error handler |
| `_iK` | File bootstrap reader |
| `Y3` | Bootstrap cache entry |
| `mj_` | String splitter / token extractor |
| `q` | File system module reference |
| `lHH` | Tracked-path set checker |
| `uj` | String replacer utility |
| `H9` | Model name normalizer / resolver |
| `m6H` | Model string parser |
| `s9` | Model short-name matcher (opusplan, sonnet, haiku, opus, best) |
| `FJ` | Model name resolution chain |
| `o6` | Feature signal emitter (ok path) |
| `l` | React / JSX library reference |
| `J6` | JSX helper / createElement wrapper |
| `tb8` | Combined effort-state + model-name reader |
| `Hx8` | `/effort` interactive UI component (renders status or change confirmation) |
| `tuf` | Effort-change confirmation renderer (non-ultracode path) |
| `b7A` | Output line emitter |
| `eP` | Secondary output emitter |
| `$P6` | Effort confirmation JSX builder |
| `PjH` | JSX text element builder |
| `o_` | Settings load-from-disk function |
| `eO` | Settings directory resolver |
| `d6` | File existence / stat utility |
| `___` | Settings file parser (JSON read + merge) |
| `kd` | Settings schema validator / merger |
| `oP` | Settings cache invalidator |
| `h8` | ENOENT error classifier |
| `e6_` | Settings load timestamp recorder |
| `IZH` | Settings reload after write |
| `O$6` | Atomic file writer (temp + rename) |
| `LY` | Settings cache clearer |
| `hl6` | Git-aware settings file tracker |
| `qu` | Settings path resolver (`.claude/settings.json`) |
| `W_` | Settings write-lock / mutex |
| `SH` | Feature signal emitter (bad path) |
| `CH` | Feature signal emitter (sad path) |
| `gU` | Settings load orchestrator |
| `hH` | Settings error logger |
| `lC` | Effort change state applier |
| `X8` | App-state setter for effort field |
| `P6` | JSX fragment builder |
| `hm6` | React fragment symbol |
| `euf` | Effort-change display for `ultracode`-capable sessions |
| `_rH` | Argument trim + tier-list lookup |
| `suf` | Full effort-change handler (saves + renders) |
| `LQ` | Ultracode animation component (violet-ripple, uses `S4K`, `h4K`) |
| `O` | Animation frame buffer array |
| `b8` | Background session state checker |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.