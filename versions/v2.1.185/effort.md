---
type: feature-spec
feature: "effort"
cc_version: 2.1.185
updated: "2026-06-19"
tags: ["effort", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.181
analysis_basis: "CC v2.1.181 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/effort`

> Analysis basis: CC v2.1.181 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.181

---

## Overview

The `/effort` command sets the inference effort level used by the model for the current session or persistently. It accepts a named tier (`low`, `medium`, `high`, `xhigh`, `max`, `ultracode`, or `auto`) and applies the corresponding token-budget and workflow configuration to subsequent requests. The special `ultracode` tier additionally requires dynamic workflow orchestration to be enabled, and is restricted to sessions where that feature flag is active.

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
| module_id | `vLl` |
| load_inline | `true` |
| loc_byte | `12980305` |
| loc_byte_end | `12980636` |
| loc_line | `8517` |
| arbor_handler.name | `Tlf` |
| arbor_handler.fqn | `claude-2.1.181::Tlf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.181 bundle.js:+12980305

---

## Input Branching

The command has six or more distinct branches based on the argument supplied, plus orthogonal sub-branches for persistence scope and workflow-feature gating. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/effort [arg]"] --> B{Argument provided?}
    B -- No --> SHOW[Display current effort level and status]
    B -- Yes --> C{Normalize: trim + toLowerCase}
    C --> D{Is arg 'ultracode'?}
    D -- Yes --> E{Dynamic workflows enabled?}
    E -- No --> ERR_ULT["Error: 'Ultracode needs dynamic workflows enabled\n(see /config). Valid options: low,medium,high,xhigh,max,auto'"]
    E -- Yes --> ULT[Set effort = ultracode\n(xhigh + workflow orchestration, this session only)]
    D -- No --> F{Is arg a valid tier?\nlow | medium | high | xhigh | max | auto}
    F -- No --> ERR_INV[Display error: invalid effort level]
    F -- Yes --> G{Persistence mode?}
    G -- "Session only\n(no save flag)" --> SESS[Apply to current session only\nDisplay '(this session only)']
    G -- "Save as default\n(save flag present)" --> SAVE[Persist to user settings\nDisplay '(saved as your default for new sessions)']
    SESS --> H[Apply model-tier + budget\nEmit tengu_effort_command]
    SAVE --> H
    ULT --> I[Apply xhigh budget + workflow orchestration\nEmit tengu_effort_command\nEmit tengu_workflows_enabled]
    SHOW --> J[Render current effort status via JSX]
```

Analysis basis: CC v2.1.181 bundle.js:+12967363, +12967569, +12968228, +12967171, +12967215

---

## Behavioral Spec

### Handler Entry Point

The primary handler is `Tlf` (AsyncFunction, resolved via `module_id` → `vLl`).

```
async function effortCommandHandler(context):
    arg = context.argument
    if arg is undefined or empty:
        return renderCurrentEffortStatus(context)
    normalizedArg = arg.trim().toLowerCase()
    if normalizedArg == "ultracode":
        return handleUltracodeEffort(context)
    if not isValidEffortTier(normalizedArg):
        return renderInvalidEffortError(normalizedArg)
    return applyEffortLevel(context, normalizedArg)
```

Analysis basis: CC v2.1.181 bundle.js:+12978494, +12978512, +12978533, +12978548, +12978564

---

### Effort Tier Validation

```
function isValidEffortTier(value):
    VALID_TIERS = ["low", "medium", "high", "xhigh", "max", "auto"]
    return VALID_TIERS.includes(value)
```

The `ultracode` tier is handled separately before this check.
Analysis basis: CC v2.1.181 bundle.js:+12965484, +12965545

---

### Ultracode Gating

```
function handleUltracodeEffort(context):
    if not dynamicWorkflowsEnabled(context):
        display("Ultracode needs dynamic workflows enabled (see /config). " +
                "Valid options are: low, medium, high, xhigh, max, auto")
        return
    applyEffortAsSessionOnly(context, "ultracode")
    // ultracode is always session-scoped — never persisted
    display("Current effort level: ultracode " +
            "(xhigh + dynamic workflow orchestration; this session only)")
    emitTelemetry("tengu_effort_command")
    emitTelemetry("tengu_workflows_enabled")
```

Analysis basis: CC v2.1.181 bundle.js:+12968228, +12967388, +3360562

---

### Effort Application and Persistence

```
function applyEffortLevel(context, tier):
    saveAsDefault = context.saveFlag  // derived from argument parsing
    applyTierToSession(context, tier)
    if saveAsDefault:
        persistToUserSettings(tier)
        display(tierDescription(tier) + " (saved as your default for new sessions)")
    else:
        display(tierDescription(tier) + " (this session only)")
    emitTelemetry("tengu_effort_command")
```

Analysis basis: CC v2.1.181 bundle.js:+12967171, +12967215

---

### Tier Descriptions

Each named tier maps to a human-readable description displayed after the level is applied:

| Tier | Description |
|---|---|
| `low` | Quick, straightforward implementation with minimal overhead |
| `medium` | Balanced approach with standard implementation and testing |
| `high` | Comprehensive implementation with extensive testing and documentation |
| `xhigh` | (no separate literal; maps to xhigh_effort budget internally) |
| `max` | (maps to max_effort budget internally) |
| `auto` | Use the default effort level for your model |
| `ultracode` | xhigh + dynamic workflow orchestration; this session only |

Analysis basis: CC v2.1.181 bundle.js:+3364783, +3364795, +3364861, +3364876, +3364954, +12965941, +12967388

---

### Model Compatibility Checks

The handler verifies model compatibility with the selected effort tier. A set of known supported model identifiers is checked against the active model:

- Prefix check: `"claude-3-"` (bundle.js:+3360954)
- Named models: `claude-opus-4-0`, `claude-opus-4-1`, `claude-sonnet-4-0`, `claude-sonnet-4-5`, `claude-haiku-4-5`, `claude-fable-5`, `claude-mythos-5`, `claude-opus-4-8`, `claude-opus-4-7`, `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-opus-4-5` (bundle.js:+3360972 – +3361478)
- Additional internal aliases: `opus-4-7`, `opus-4-8`, `fable-5` (bundle.js:+3363237, +3363299, +3363361)

```
function checkModelEffortCompatibility(modelId, tier):
    if modelId.startsWith("claude-3-"):
        return limitedEffortOnly(tier)
    if XHIGH_CAPABLE_MODELS.includes(modelId):
        allowXhigh = true
    if MAX_CAPABLE_MODELS.includes(modelId):
        allowMax = true
    return buildEffortConstraints(tier, allowXhigh, allowMax)
```

Analysis basis: CC v2.1.181 bundle.js:+3360934, +3360943, +3360954

---

### Remote Transport Limitation

When the active transport is not a first-party API (e.g., an AWS Bedrock application-inference-profile endpoint), effort changes are applied locally only — server-side effort cannot be changed:

```
function checkTransportForEffort(transportKind):
    if transportKind == "application-inference-profile":
        appendMessage(" (applied locally — this remote transport can't change server effort)")
```

Supported provider types checked: `firstParty`, `anthropicAws`, `foundry`, `mantle`
(bundle.js:+2124064, +2124082, +2124102, +2124117)

Analysis basis: CC v2.1.181 bundle.js:+2286342, +12966225

---

### Status Display (No-Argument Mode)

When invoked with no argument, the handler renders the current effort state as a JSX element via `Lo.createElement`. The display reports either:
- The active named tier, or
- `"unset"` / `"auto"` if no override is in effect.

```
function renderCurrentEffortStatus(context):
    currentTier = getActiveEffortTier(context)  // may be "unset" or "auto"
    return createElement(StatusComponent, { mode: "current", tier: currentTier })
```

Analysis basis: CC v2.1.181 bundle.js:+12978533, +12978548, +12978564, +3363149, +3363177

---

### Settings Persistence

When saving as default, the effort level is written to user settings (not project settings):

```
function persistToUserSettings(tier):
    settings = readUserSettings("userSettings")
    settings["effort"] = tier
    writeUserSettings(settings)
    // file paths:
    //   ~/.claude/settings.json        (global)
    //   ./.claude/settings.local.json  (local, not used for effort default)
```

The settings subsystem uses atomic write-and-flush with a temp file, chmod preservation, and rename (bundle.js:+1095312, +1095374, +1095730). The `allow_workflows` flag (bundle.js:+3360361) is separately required for `ultracode`.

Analysis basis: CC v2.1.181 bundle.js:+1329880, +1310058, +1310068

---

### Ultracode Visual Animation

When ultracode is activated, a particle/ripple animation is triggered in the UI:

- Color theme: `"violet-ripple"` (bundle.js:+12970946)
- Particle count: `3` groups of up to `17` particles (bundle.js:+12970886, +12970890)
- Animation uses `Math.cos`, `Math.sqrt`, `Math.round`, `Math.floor`, `Math.random`, `setTimeout`
- The label `"xhigh + workflows"` is displayed alongside the animation (bundle.js:+12971198)

Analysis basis: CC v2.1.181 bundle.js:+12970869, +12970910, +12970946, +12972602, +12972638, +12972660

---

### Pro-tier Feature Gate

The `allow_workflows` feature is gated on the `"pro"` subscription tier. If the user is not on a qualifying plan, workflow-dependent effort tiers (i.e., `ultracode`) are unavailable. The `allow_product_feedback` flag is also checked during feature availability resolution.

Analysis basis: CC v2.1.181 bundle.js:+3360807, +3360361, +3340727

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_effort_command` (emitted on every successful tier change, bundle.js:+12967819); `tengu_workflows_enabled` (emitted when ultracode activated, bundle.js:+3360562); `tengu_slate_finch` (emitted during effort/workflow resolution, bundle.js:+3365249); `tengu_feature_ok` / `tengu_feature_sad` / `tengu_feature_bad` (feature-flag gate results, bundle.js:+1019804, +1019952, +1019871); `tengu_config_auth_loss_prevented` (safety guard during settings write, bundle.js:+13936136) |
| Hook registration | `KKe.emit` called on configuration application (bundle.js:+1330452) |
| appState changes | Active effort tier stored in session state; persisted to `~/.claude/settings.json` when save-as-default is requested |
| Settings files | Reads/writes `~/.claude/settings.json` (global user settings); reads `.claude/settings.json` (project) and `.claude/settings.local.json` (local) |
| Sound / animation | Ultracode activation triggers `violet-ripple` particle animation (JSX, `Tq` component); no audio |
| Workflow flag | `allow_workflows` must be truthy for ultracode; checked via `tengu_workflows_enabled` gate |
| Growthbook | Experiment event `growthbook_experiment` / `GrowthbookExperimentEvent` emitted during feature-flag evaluation (bundle.js:+3314245, +3314696) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.181 | Initial analysis — `ultracode` tier introduced with violet-ripple animation; `thinClientDispatch: control-request`; `local-jsx` type |

---

## Common Mistakes

1. **Invoking `/effort ultracode` without enabling dynamic workflows first** — this produces the error `"Ultracode needs dynamic workflows enabled (see /config)..."` and leaves the effort level unchanged. Enable workflows via `/config` before switching to `ultracode`.
2. **Expecting ultracode to persist across sessions** — `ultracode` is always session-scoped; it cannot be saved as a default. If you restart Claude Code, the effort level reverts.
3. **Using `/effort` on a non-supported model** — some effort tiers (particularly `xhigh` and `max`) are only available on newer model versions. On `claude-3-*` models the tier set may be restricted.
4. **Confusion between `max` and `ultracode`** — `max` sets the maximum token budget without workflow orchestration; `ultracode` adds dynamic workflow orchestration on top of `xhigh`, but is not simply an alias for `max`.
5. **Remote transport limitations** — when connected via an AWS application-inference-profile endpoint, effort changes take effect only locally in the client; the server-side effort cannot be adjusted.
6. **Omitting the argument** — `/effort` with no argument displays status rather than setting anything; always supply the tier name explicitly to change the level.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Tlf` | Primary async handler for `/effort` command (arbor_handler, module_id `vLl`) |
| `pVn` | Top-level effort command render/dispatch function |
| `YQ` | Argument parsing and routing entry point |
| `kC` | Feature-flag / capability checker for effort tiers |
| `pHn` | String normalization helper (trim + type coercion) |
| `rt` | String conversion utility |
| `px` | State accessor / getter helper |
| `ami` | Allow-workflows feature gate evaluator |
| `ii` | Individual feature flag checker (checks V7u, K7u sets) |
| `gNr` | Model-tier compatibility resolver |
| `cYu` | Model metadata lookup and effort constraint builder |
| `lYu` | Effort-level state setter |
| `zQ` | Core effort dispatch router (routes to sub-handlers by tier) |
| `DC` | Model-list membership checker for effort capability |
| `Go` | Provider/transport kind classifier |
| `e1` | First-party provider resolver |
| `HH` | Extended model-list handler (xhigh/max capable model check) |
| `oFe` | Ultracode-specific effort handler |
| `It` | Telemetry event emitter |
| `Hj` | Notification / display message helper |
| `HHn` | High/xhigh effort range handler |
| `rFe` | Effort value parser (string → canonical tier) |
| `QU` | Integer effort-value normalizer (parseInt, isNaN guard) |
| `tFe` | `max_effort` tier handler |
| `rIe` | `xhigh_effort` tier handler |
| `fd` | Settings file reader |
| `jRe` | Low-level file read helper |
| `DR` | Effort persistence orchestrator |
| `Hme` | Default-effort tier resolver |
| `nFe` | Valid-tier membership checker (tM.includes) |
| `$se` | Effort-to-string serializer |
| `yNr` | Session-settings applier |
| `uYu` | Session state updater for effort |
| `lfe` | Settings write helper for effort |
| `da` | Config persistence entry point |
| `DTr` | Config directory resolver |
| `kTr` | Config key builder |
| `uy` | User settings writer |
| `ut` | Settings loader/orchestrator |
| `txt` | Synchronous text file reader |
| `nxt` | Next-tick / deferred executor |
| `p4` | Settings parse entry |
| `d4` | JSON settings deserializer |
| `Ygn` | Settings cache manager |
| `V1r` | Settings cache value constructor |
| `Q1r` | Settings cache queue processor |
| `CLl` | Cosine animation helper (ultracode ripple) |
| `ILl` | Sqrt animation helper (ultracode ripple) |
| `bLl` | Ultracode particle animation orchestrator |
| `A4` | Effort + model constraint combiner |
| `_Ll` | Particle array builder (map + slice) |
| `dVn` | JSX rendering entry for effort display (includes ultracode branch) |
| `Ns` | Model selector / display renderer |
| `xK` | Model info component builder |
| `S_` | Model name formatter |
| `CG` | Model capability flags aggregator |
| `Tl` | Full model record renderer (JSX) |
| `pbt` | Spinner/loading indicator (nns, tns) |
| `fbt` | Model metadata fetcher |
| `nc` | String replace/sanitize utility |
| `O1e` | Token-budget label checker |
| `CR` | Capability-restriction checker |
| `Vcn` | Nested capability resolver |
| `C2s` | Entry-object serializer |
| `Tn` | Model tier name formatter |
| `w7e` | Object-entries mapper for model metadata |
| `I2s` | Index-of-model lookup |
| `Iku` | Model capability gate with start-check |
| `gs` | Token/model display string builder |
| `DIt` | Model tier descriptor |
| `Cku` | Capability-with-prefix checker |
| `Ug` | Status display wrapper |
| `lL` | Model status list renderer |
| `QCr` | Model status row builder |
| `Xcn` | Full model configuration renderer |
| `fVn` | Effort UI component (JSX, main render function) |
| `nlf` | No-argument status render path |
| `lCo` | Current-effort display helper |
| `$S` | Settings-backed current value reader |
| `gxt` | Argument-present dispatch helper |
| `oIe` | Effort option list builder |
| `ao` | Full config file loader (flagSettings, userSettings, projectSettings, localSettings) |
| `ZA` | Config file path resolver |
| `jt` | JSON parse helper |
| `OAr` | Atomic file write helper |
| `x2` | Config schema validator |
| `Sv` | Query-string / URL builder |
| `Dn` | ENOENT-safe file reader |
| `I` | Logger / debug emitter |
| `qmr` | Request timestamp tracker |
| `jOe` | Config parse-and-validate entry |
| `lSt` | Atomic write-and-flush (temp file + rename) |
| `Re` | JSON.stringify wrapper |
| `fH` | Cache invalidation (kKt.clear, Ser.clear) |
| `NZo` | Gitignore / exclude-file tracker |
| `O9` | `.claude` directory path builder |
| `gr` | Runtime environment accessor |
| `xe` | Feature-ok gate (`tengu_feature_ok`) |
| `Ut` | Feature-sad gate (`tengu_feature_sad`) |
| `Me` | Feature-bad gate (`tengu_feature_bad`) |
| `tj` | Settings-disk loader (loadSettingsFromDisk) |
| `ke` | Error logger (jJ.logError) |
| `nB` | Effort-apply notification builder |
| `un` | Global config save (saveGlobalConfig) |
| `j` | React/JSX runtime |
| `Qe` | Error boundary / Rht fallback |
| `Rht` | Error fallback component |
| `rlf` | Effort-set-with-model-check render path |
| `ZJe` | Argument trim and tier-check entry |
| `tlf` | Full effort set render orchestrator |
| `Tq` | Ultracode particle animation JSX component |
| `c` | Animation frame / particle array |
| `bn` | Background-session check (`"background session"`, `"stopped"`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.