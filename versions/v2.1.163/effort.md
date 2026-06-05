---
type: feature-spec
feature: "effort"
cc_version: "2.1.163"
updated: "2026-06-05"
tags: ["effort", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.163 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/effort`

> Analysis basis: CC v2.1.163 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.163

---

## Overview

The `/effort` command sets the reasoning/compute effort level that Claude Code applies during a session. It accepts a named level (e.g., `low`, `medium`, `high`, `xhigh`, `max`, `ultracode`, or `auto`) and updates session state — and optionally persists the choice to user settings — so that subsequent model calls use the corresponding inference budget. When invoked with no argument it displays the current effort level.

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
| module_id | `FqK` |
| load_inline | `true` |
| loc_byte | `12726048` |
| loc_byte_end | `12726379` |
| loc_line | `9089` |
| arbor_handler.name | `Qbf` |
| arbor_handler.fqn | `claude-2.1.163::Qbf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.163 bundle.js:+12726048

---

## Input Branching

The command has six or more distinct input paths (no argument → status display; `ultracode` with workflows disabled → error; `ultracode` with workflows enabled → special xhigh+workflow mode; standard named level → apply with optional persistence; `auto` → reset to model default; unrecognised token → error). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/effort [arg]"]) --> B{Argument provided?}
    B -- No --> C[Display current effort level\nand available options]
    B -- Yes --> D{Normalize: trim + toLowerCase}
    D --> E{arg == 'ultracode'?}
    E -- Yes --> F{Dynamic workflows enabled?\ncheck allow_workflows flag}
    F -- No --> G["Error: Ultracode needs dynamic\nworkflows enabled — show valid options:\nlow, medium, high, xhigh, max, auto"]
    F -- Yes --> H[Set effort = xhigh\nEnable workflow orchestration\nSession-only — no persistence]
    E -- No --> I{arg in valid set?\nlow | medium | high | xhigh | max | auto}
    I -- No --> J[Error: unrecognised effort level\nShow usage hint]
    I -- Yes --> K{Session-only flag\nor persistent save?}
    K -- "Session-only\n(thin-client / remote transport)" --> L["Apply effort to session state\nAppend notice:\n'applied locally — remote transport\ncannot change server effort'"]
    K -- "Persistent (default)" --> M[Save effort to user settings via\nsaveSettings pipeline\nAppend notice: 'saved as your default\nfor new sessions']
    H --> N[Render effort status UI\nwith ultracode indicator]
    L --> N
    M --> N
    C --> N
    G --> O([Return error message to user])
    J --> O
    N --> P([Emit tengu_effort_command telemetry\nReturn JSX status component])
```

Analysis basis: CC v2.1.163 bundle.js:+12713198, +12714063, +12712048, +12713006, +12713050

---

## Behavioral Spec

### 1. Entry — Main Handler (`Qbf`)

The Arbor-resolved handler is `Qbf` (AsyncFunction, resolved via `module_id` → `FqK`).

```
async function effortCommandHandler(args, appState):
    rawArg = args.trim()
    if rawArg is empty:
        return renderCurrentEffortStatus(appState)

    normalizedArg = rawArg.toLowerCase()

    if normalizedArg == "ultracode":
        return handleUltracodeLevel(appState)

    if normalizedArg not in validLevels:
        return renderError("unrecognised effort level", validLevels)

    return applyEffortLevel(normalizedArg, appState)
```

Analysis basis: CC v2.1.163 bundle.js:+12724240, +12724257, +12724259

---

### 2. Effort Level Validation (`getValidLevels` / `isValidLevel`)

Valid named levels are drawn from two sets depending on whether the session is a thin-client / remote-transport session. The standard set is:

| Level | Description |
|---|---|
| `low` | Quick, straightforward implementation with minimal overhead |
| `medium` | Balanced approach with standard implementation and testing |
| `high` | Comprehensive implementation with extensive testing and documentation |
| `xhigh` | Extended high reasoning |
| `max` | Maximum capability with deepest reasoning |
| `auto` | Use the default effort level for the model |
| `ultracode` | First-party sessions only: `xhigh` + dynamic workflow orchestration (session only) |

Analysis basis: CC v2.1.163 bundle.js:+4183815, +4183827, +4183893, +4183908, +4183986, +4184150, +4184489, +4184531, +12716745

The argument hint exposes `ultracode` only when the `allow_workflows` feature flag is active (Analysis basis: CC v2.1.163 bundle.js:+12711368, +4179772).

---

### 3. Ultracode Guard (`handleUltracodeLevel`)

```
async function handleUltracodeLevel(appState):
    workflowsEnabled = checkFeatureFlag("allow_workflows", appState)
    if not workflowsEnabled:
        return renderError(
            "Ultracode needs dynamic workflows enabled (see /config).\n" +
            "Valid options are: low, medium, high, xhigh, max, auto"
        )
    // Set underlying effort to xhigh and enable workflow orchestration
    applyEffortToSession("xhigh", appState)
    enableWorkflowOrchestration(appState)
    // Session-only: no persistence written
    return renderEffortStatus("ultracode", sessionOnly=true)
```

Analysis basis: CC v2.1.163 bundle.js:+12714063, +4179772

The `ultracode` mode maps internally to `xhigh` effort with a dynamic workflow layer enabled. The status display string reads "ultracode (xhigh + dynamic workflow orchestration; this session only)" (fragment: `"ultracode (xhigh + dynamic workflow"`, Analysis basis: CC v2.1.163 bundle.js:+12713223).

---

### 4. Standard Level Application (`applyEffortLevel`)

```
async function applyEffortLevel(level, appState):
    isRemoteTransport = detectThinClientOrRemoteTransport(appState)

    if isRemoteTransport:
        applyEffortToSessionOnly(level, appState)
        notice = " (applied locally — this remote transport can't change server effort)"
    else:
        persistEffortToUserSettings(level)   // saves to userSettings via saveSettings pipeline
        notice = " (saved as your default for new sessions)"

    emitTelemetry("tengu_effort_command")
    return renderEffortStatus(level, notice)
```

Analysis basis: CC v2.1.163 bundle.js:+12712048, +12713006, +12713050, +12713654

The persistence path calls into the `saveSettings` pipeline (`applyFlagSettings` → settings I/O via `vc6`, writing to `.claude/settings.json`). Analysis basis: CC v2.1.163 bundle.js:+12712171, +1269308, +1269318.

---

### 5. No-Argument Status Display (`renderCurrentEffortStatus`)

```
function renderCurrentEffortStatus(appState):
    currentLevel = readEffortFromState(appState)   // returns e.g. "unset", "auto", "high", etc.
    return renderEffortStatusJSX(currentLevel, mode="current")
```

When no effort has been explicitly set the level reads as `"unset"` (Analysis basis: CC v2.1.163 bundle.js:+4182425). `"auto"` means delegate to model default (Analysis basis: CC v2.1.163 bundle.js:+4182453).

The JSX component (`Qbf` → `PA.createElement`, Analysis basis: CC v2.1.163 bundle.js:+12724311) renders the status inline in the CLI terminal, including a visual animation for the `ultracode` level (`xg` component using cosine/sqrt math for a particle effect, Analysis basis: CC v2.1.163 bundle.js:+12718437, +12718336).

---

### 6. Effort-to-Model Mapping (`isModelCompatible`)

Certain effort/model combinations are noted in the bundle. Notable constants:

| Constant | Meaning |
|---|---|
| `"effort"` | Settings key used to store the effort preference (bundle.js:+4180306) |
| `"max_effort"` | Internal flag for max-level inference (bundle.js:+4180717) |
| `"xhigh_effort"` | Internal flag for xhigh-level inference (bundle.js:+4181094) |
| `"unset"` | Sentinel meaning no effort has been chosen (bundle.js:+4182425) |
| `"auto"` | Sentinel meaning use model-default effort (bundle.js:+4182453) |
| `parseInt` base 10 | Used to parse numeric effort tokens; NaN check follows (bundle.js:+4182081, +4182100) |

Models explicitly referenced in the effort-compatibility checks include `claude-opus-4-0/1/5/6/7/8`, `claude-sonnet-4-0/4-5/4-6`, `claude-haiku-4-5`, and the `claude-3-*` family prefix (Analysis basis: CC v2.1.163 bundle.js:+4180365 – +4180644).

The `application-inference-profile` model type is handled separately in the compatibility logic (Analysis basis: CC v2.1.163 bundle.js:+2241240).

---

### 7. Settings Persistence Pipeline (summary)

```
function persistEffortToUserSettings(level):
    // 1. Load current settings from disk (loadSettingsFromDisk)
    settings = loadFromDisk()   // DU → Kd → settings I/O
    // 2. Write updated effort key
    settings["effort"] = level
    // 3. Atomic write via temp file + rename
    writeToDiskAtomic(settings)   // TM6 pipeline
    // 4. Emit apply_flag_settings event
    emit("apply_flag_settings")
```

Analysis basis: CC v2.1.163 bundle.js:+12712171, +1276855, +1276911, +1278808

The atomic write uses `randomBytes(6).toString('hex')` for the temp filename, `fchmodSync` to mirror permissions, `fsyncSync` for durability, and `renameSync` for the final swap (Analysis basis: CC v2.1.163 bundle.js:+1057380, +1057874, +1057940, +1058068).

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_effort_command` (emitted on every successful level change, bundle.js:+12713654); `tengu_workflows_enabled` (emitted when workflow flag state is read, bundle.js:+4179973); `tengu_slate_finch` (emitted during effort display render path, bundle.js:+4184273); `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` (feature-flag evaluation, bundle.js:+1010222, +1010284, +1010365); `tengu_config_auth_loss_prevented` (settings save guard, bundle.js:+3257056) |
| appState changes | `effort` key in session state updated to chosen level; `ultracode` additionally sets workflow orchestration flag |
| Settings persistence | Writes `effort` key to `~/.claude/settings.json` (persistent path) or skips write for remote-transport sessions |
| UI / JSX | Renders an inline JSX status component via `PA.createElement`; `ultracode` level triggers an animated particle display (`xg` component) |
| thinClientDispatch | Registered as `control-request` — the command is dispatched as a control message in thin-client / remote-transport sessions |
| Sound | None identified |

---

## Version History

| Version | Change |
|---|---|
| v2.1.163 | Initial analysis — `ultracode` level introduced alongside `xhigh`, `max`, `high`, `medium`, `low`, `auto`; remote-transport local-only mode; animated status UI |

---

## Common Mistakes

1. **Using `ultracode` without workflows enabled** — The command will return an error directing you to `/config` to enable dynamic workflows first. `ultracode` is not available via the argument hint until that flag is active.
2. **Expecting `ultracode` to persist** — Unlike other levels, `ultracode` is always session-only and is never written to `settings.json`. A notice "(this session only)" is always appended.
3. **Using `/effort` over a remote transport and expecting server-side change** — On remote / thin-client transports the effort is applied locally to the client session only; the model server's effort budget is not changed. The CLI appends a notice to this effect.
4. **Supplying an unrecognised level string** — Levels are case-insensitive after normalization (`toLowerCase`), but spelling must match exactly one of the valid tokens. Any other string results in an error with the valid list shown.
5. **Assuming numeric effort values are supported** — The bundle contains `parseInt` / `isNaN` handling, suggesting partial numeric parsing exists internally, but the public argument hint only documents named levels.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Qbf` | Main async handler for `/effort` (Arbor-resolved entry point) |
| `xC8` | Effort command JSX component / render orchestrator |
| `bC8` | Sub-component: effort level display helper |
| `uC8` | Sub-component: effort argument normalizer / dispatcher |
| `Ebf` | Sub-handler: standard effort level apply path |
| `Gbf` | Sub-handler: persistent-save effort path |
| `Tbf` | Sub-handler: session-only (thin-client) effort path |
| `mqK` | Ultracode animation / visual renderer |
| `xg` | Particle / ripple animation component (ultracode indicator) |
| `BqK` | Cosine-based animation math helper |
| `UqK` | Square-root-based animation math helper |
| `CqK` | Animation frame mapper |
| `Ga` | Effort option list / validation set builder |
| `OP` | Feature flag resolver for effort context |
| `W9` | `allow_product_feedback` / feature flag check |
| `iL9` | `allow_workflows` feature flag checker |
| `WT_` | Workflow-enabled effort path initiator |
| `yBL` | Pro-tier effort branching logic |
| `kBL` | Effort normalization helper (nT calls) |
| `Wa` | Effort application orchestrator (session + persist) |
| `UW` | Model-compatibility checker for effort levels |
| `H9` | Inference-profile detection helper |
| `WX6` | `max_effort` application path |
| `DiH` | `xhigh_effort` application path |
| `TIH` | Effort state reader (current level lookup) |
| `EIH` | Effort state writer (session update) |
| `Nu` | Effort value parser (parseInt / isNaN / string coercion) |
| `ON` | Effort UI data aggregator |
| `K7H` | Effort option label generator |
| `GIH` | Valid-levels inclusion check |
| `i8H` | Effort string formatter (String coercion) |
| `TT_` | Effort persistence trigger (calls saveGlobalConfig) |
| `K4H` | Settings mutation helper |
| `_q` | Config update pipeline entry |
| `zY` | API key / auth config context |
| `D6` | `saveGlobalConfig` (atomic write to disk) |
| `B98` | Config cache + disk write coordinator |
| `OX_` | Config write executor (UUID temp file, emit) |
| `jX_` | Post-write event emitter |
| `n78` | Effort status description builder |
| `wiH` | Argument trim + level-check gate |
| `s4` | Settings reader utility |
| `iX` | Settings reader (alternate path) |
| `OLA` | Settings load + parse orchestrator |
| `EX6` | Settings save pipeline entry |
| `r_` | Full settings I/O manager |
| `DU` | `loadSettingsFromDisk` entry |
| `Kd` | Settings file path resolver |
| `TM6` | Atomic file write (temp + rename) |
| `vc6` | Append/write settings file helper |
| `hx` | `.claude` directory path builder |
| `X_` | Path utility wrapper |
| `TC` | `saveGlobalConfig` caller in settings pipeline |
| `X8` | Global config write guard (auth-loss prevention) |
| `sz` | Cache clear utility |
| `mH_` | Timestamp recorder for settings cache |
| `rTH` | Settings reload after write |
| `Vu` | Effort + model state reader |
| `t1` | Model name / alias resolver |
| `Aq` | Model string normalization |
| `eX` | Model alias expansion |
| `S6` | Session state updater |
| `Nu6` | Base UI component |
| `W6` | UI wrapper component |
| `c` | Core React-like render primitive |
| `P6` | UI element factory |
| `eH` | String coercion utility |
| `nT` | Null/undefined guard |
| `SH` | JSON serializer |
| `v` | File fetch / content loader |
| `H` | Model list / config array |
| `O` | Output buffer / array |
| `b8` | Background session type constant |
| `Pw_` | String split / trim / slice utility |
| `ZHH` | Feature-gate set checker |
| `uj` | String replace utility |
| `D6H` | Model descriptor builder |
| `s6` | UI section component |
| `hH` | UI help-text component |
| `RH` | UI result component |
| `kH` | Error log / push handler |
| `Q6` | File existence / read helper |
| `cO` | Config file path helper |
| `F6_` | Settings directory walker |
| `oP` | Symlink resolver |
| `R8` | ENOENT error handler |
| `Nc6` | Gitignore / exclude file rule checker |
| `ME4` | Settings migration helper |
| `J4` | Path manipulation utility |
| `ppH` | Path helper variant |
| `icK` | File content chunker / size checker |
| `ccK` | Config content validator |
| `ny` | Auth / API key injector |
| `RD` | API provider type resolver (`firstParty`, `anthropicAws`, `foundry`, `mantle`) |
| `AO6` | Auth object builder |
| `M8L` | API key extractor |
| `XA` | Auth config merger |
| `ps6` | Provider settings resolver |
| `Bs6` | Inference profile type checker |
| `tX` | Model string prefix matcher |
| `dQ8` | Model capability flag reader |
| `Q78` | Effort option entry constructor |
| `Au` | Config reader (low-level) |
| `LC` | Config store accessor |
| `qu` | Config get helper |
| `Hj6` | Config key normalizer |
| `_j6` | Config default merger |
| `yDH` | Config Map store |
| `tw6` | Dirty-tracking Set |
| `eU` | Session config Map |
| `MEH` | Settings read entry |
| `Jo` | Model-effort compatibility gate |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.