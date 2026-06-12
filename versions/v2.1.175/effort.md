---
type: feature-spec
feature: "effort"
cc_version: "2.1.175"
updated: "2026-06-12"
tags: ["effort", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.175 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/effort`

> Analysis basis: CC v2.1.175 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.175

---

## Overview

The `/effort` command sets the inference effort level for the current model session, controlling the degree of reasoning and resource usage applied to each request. It accepts a named tier (`low`, `medium`, `high`, `xhigh`, `max`, `ultracode`, or `auto`), validates it against the active model and transport capabilities, and either persists the choice to user settings as a new default or applies it only for the current session. The special `ultracode` tier additionally requires dynamic workflow orchestration to be enabled.

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
| module_id | `cDK` |
| load_inline | `true` |
| loc_byte | `13028884` |
| loc_byte_end | `13029215` |
| loc_line | `9164` |
| arbor_handler.name | `gt7` |
| arbor_handler.fqn | `claude-2.1.175::gt7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.175 bundle.js:+13028884

---

## Input Branching

The command has more than three distinct input paths (no argument / query status, valid named tier, `ultracode` requiring workflow check, remote-transport caveat, session-only vs. persisted save), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/effort [arg]"] --> B{Argument provided?}
    B -- No --> C[Display current effort status\nand available tier list]
    B -- Yes --> D{Normalize arg\nto lowercase}
    D --> E{arg == 'ultracode'?}
    E -- Yes --> F{Dynamic workflows\nenabled?}
    F -- No --> G[Error: 'Ultracode needs dynamic\nworkflows enabled — valid options:\nlow medium high xhigh max auto']
    F -- Yes --> H[Proceed with ultracode tier]
    E -- No --> I{arg in valid tier set?\nlow|medium|high|xhigh|max|auto}
    I -- No --> J[Error: unknown tier,\nshow valid options]
    I -- Yes --> H
    H --> K{Remote transport\n(thin-client)?}
    K -- Yes --> L[Apply effort locally;\nappend caveat:\n'applied locally — remote\ntransport can't change server effort']
    K -- No --> M{Save as default?}
    M -- Yes --> N[Persist to user settings\nAppend: 'saved as your default\nfor new sessions']
    M -- No --> O[Apply session-only\nAppend: 'this session only']
    L --> P[Emit tengu_effort_command telemetry\nRender confirmation JSX]
    N --> P
    O --> P
    C --> Q[Render status JSX\nwith current tier label]
```

Analysis basis: CC v2.1.175 bundle.js:+13027076, +13016802, +13015745, +13015789, +13014799

---

## Behavioral Spec

### 1. Handler Entry Point (`gt7`)

The Arbor-resolved handler is `gt7` (AsyncFunction, FQN `claude-2.1.175::gt7`, reached via `module_id` → `cDK`). It is the primary dispatch point for `/effort`.

```
async function effortCommandHandler(args, context):
    rawArg = args[0] ?? null

    if rawArg == null:
        return renderEffortStatus(context)          // show current + tier list

    normalized = rawArg.toLowerCase()

    if not isKnownTier(normalized, context):
        return renderError(invalidTierMessage(normalized, context))

    if normalized == "ultracode":
        if not dynamicWorkflowsEnabled(context):
            return renderError(
                "Ultracode needs dynamic workflows enabled (see /config). " +
                "Valid options are: low, medium, high, xhigh, max, auto"
            )

    applyEffortTier(normalized, context)
    emitTelemetry("tengu_effort_command", context)
    return renderEffortConfirmation(normalized, context)
```

Analysis basis: CC v2.1.175 bundle.js:+13027076, +13027093, +13027095, +13027147, +13016393

---

### 2. Tier Validation (`isKnownTier`)

Valid named tiers are drawn from a fixed set. The `ultracode` value appears only when the argument hint first pipe-group is active (dynamic workflows available); the second pipe-group omits it.

```
function isKnownTier(tier, context):
    baseSet = {"low", "medium", "high", "xhigh", "max", "auto"}
    if dynamicWorkflowsEnabled(context):
        return tier in (baseSet ∪ {"ultracode"})
    else:
        return tier in baseSet
```

Tier descriptions resolved from literals:

| Tier | Description |
|---|---|
| `low` | Quick, straightforward implementation with minimal overhead |
| `medium` | Balanced approach with standard implementation and testing |
| `high` | Comprehensive implementation with extensive testing and documentation |
| `xhigh` | Extended high-effort (mapped to `xhigh_effort` internally) |
| `max` | Maximum effort (mapped to `max_effort` internally) |
| `ultracode` | `xhigh` + dynamic workflow orchestration; session only |
| `auto` | Use the default effort level for the active model |

Analysis basis: CC v2.1.175 bundle.js:+2536836, +2536848, +2536914, +2536929, +2537007, +2535921, +2535229, +13019484

---

### 3. `ultracode` Tier Checks

`ultracode` requires that the `allow_workflows` flag be active in the current session context. If not, the command rejects the request with a descriptive error message and lists the always-available alternatives.

```
function dynamicWorkflowsEnabled(context):
    return context.featureFlags.has("allow_workflows")  // flag literal at +2532413
```

When `ultracode` is accepted, the session-only caveat is always appended; `ultracode` cannot be persisted as a default.

```
function applyEffortTier(tier, context):
    if tier == "ultracode":
        context.sessionEffort = "ultracode"
        appendConfirmationSuffix("(xhigh + workflows)", sessionOnly=true)
        return

    isPersisted = shouldPersistAsDefault(context)
    if isPersisted:
        saveToUserSettings("effort", tier)
        appendConfirmationSuffix("saved as your default for new sessions")
    else:
        context.sessionEffort = tier
        appendConfirmationSuffix("this session only")
```

Analysis basis: CC v2.1.175 bundle.js:+2532413, +13019772, +13015745, +13015789, +13015962

---

### 4. Remote Transport Caveat (`thinClientDispatch`)

The registration declares `thinClientDispatch: "control-request"`. When the active transport is a thin-client (remote) connection, effort changes cannot propagate to the server side. The handler detects this and appends a caveat to the confirmation message.

```
function buildConfirmationMessage(tier, context):
    base = "Current effort level set to: " + tier
    if context.transport == "thin-client":
        base += " (applied locally — this remote transport can't change server effort)"
    elif persisted:
        base += " (saved as your default for new sessions)"
    else:
        base += " (this session only)"
    return base
```

Analysis basis: CC v2.1.175 bundle.js:+13014799, +13015745, +13015789

---

### 5. Status Display (no-argument path)

When `/effort` is invoked without an argument, the handler calls into `sF8` (render-effort-status component) which reads the current effort from app state and renders a JSX status panel.

```
function renderEffortStatus(context):
    current = context.appState.effortLevel ?? "unset"
    available = listAvailableTiers(context)
    return JSX StatusPanel(
        current=current,
        available=available,
        autoNote="auto: Use the default effort level for your model"
    )
```

The literal `"unset"` is used when no effort has been configured for the session (bundle.js:+2535201). The `"auto"` tier note text is literal at +13014515: `"- auto: Use the default effort level for your model"`.

Analysis basis: CC v2.1.175 bundle.js:+13027095, +2535201, +13014515

---

### 6. Internal Effort-Level Mapping

The effort tiers map to internal API strings. Key mappings found in literals:

| User-facing tier | Internal string |
|---|---|
| `max` | `max_effort` (bundle.js:+2533403) |
| `xhigh` | `xhigh_effort` (bundle.js:+2533825) |
| `high` | `high` (bundle.js:+2537517) |
| `xhigh` (cap) | `xhigh` (bundle.js:+2537601) |
| `ultracode` | session-only `ultracode` label (bundle.js:+13019484) |

The model list gating logic (inside `cP`/`LIH`/`ZjH`) checks model identifiers such as `"claude-3-"`, `"claude-opus-4-0"`, `"claude-opus-4-5"`, `"claude-sonnet-4-5"`, and others to determine which effort tiers are available for a given model endpoint.

Analysis basis: CC v2.1.175 bundle.js:+2533403, +2533825, +2537517, +2537601, +2533006, +2533024, +2533070, +2533095

---

### 7. Settings Persistence (`wA` / settings write path)

When the effort change is to be saved as the new default, the handler delegates to the settings-writer (internally `wA`) which writes to one of:

- `~/.claude/settings.json` (user global settings, literal at +1298382, +1298392)
- `~/.claude/settings.local.json` (local override, literal at +1298454)

The writer uses an atomic temp-file rename pattern (random bytes → temp file → `fchmodSync` to preserve permissions → `fsyncSync` → `renameSync`), with a guard that prevents writes if the re-read config is missing auth that the cache already holds (guard message literal: `"saveGlobalConfig fallback: re-read config is missing auth that cache has; refusing to write. See GH #3117."`, bundle.js:+3325182).

Analysis basis: CC v2.1.175 bundle.js:+1298382, +1298392, +1298454, +3325182, +1090105, +1090171, +1090299

---

### 8. JSX Rendering (`gt7` → `yA.createElement`)

The handler uses React-style JSX rendering (via `yA.createElement`) for all output panels, both the status display and the confirmation message. The `Yd` component handles animated particle/ripple effects for the `ultracode` activation visual (using `Math.cos`, `Math.sqrt`, `Math.round`, and color label `"violet-ripple"` at +13019520).

Analysis basis: CC v2.1.175 bundle.js:+13027147, +13021285, +13021440, +13021444, +13019520

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_effort_command` (bundle.js:+13016393); `tengu_workflows_enabled` (bundle.js:+2532614); `tengu_slate_finch` (bundle.js:+2537302); `tengu_feature_ok` (bundle.js:+1017151); `tengu_feature_sad` (bundle.js:+1017299); `tengu_feature_bad` (bundle.js:+1017218); `tengu_config_auth_loss_prevented` (bundle.js:+3325310) |
| appState changes | Session effort level updated to the selected tier; `"unset"` cleared once any tier is chosen |
| Settings write | When persisting as default: atomic write to `~/.claude/settings.json` under the `"effort"` key (literal at +2532947) |
| Transport dispatch | `thinClientDispatch: "control-request"` — effort changes over thin-client are local-only with caveat appended |
| Visual effect | `ultracode` activation triggers a `"violet-ripple"` particle animation rendered via JSX component `Yd` |
| Feature flags read | `allow_workflows` flag checked before `ultracode` is permitted; `allow_product_feedback` flag checked in broader context |
| Cache invalidation | Settings cache cleared via `rO` (calls `dQ6.clear` + `Go8.clear`, bundle.js:+27646, +27658) after successful write |

---

## Version History

| Version | Change |
|---|---|
| v2.1.175 | Initial analysis — tiers: `low`, `medium`, `high`, `xhigh`, `max`, `ultracode`, `auto`; `ultracode` requires `allow_workflows`; thin-client caveat; atomic settings persistence |

---

## Common Mistakes

1. **Invoking `/effort ultracode` without enabling dynamic workflows** — the command will reject with an explicit error directing the user to `/config`. The `allow_workflows` feature flag must be active first.
2. **Expecting `ultracode` to persist across sessions** — `ultracode` is always session-only; it cannot be saved as the default effort level.
3. **Using `/effort` over a thin-client/remote transport and expecting the server to honour it** — the server-side effort is unchanged; only local behaviour is affected, and a caveat is appended to the confirmation.
4. **Omitting the argument when intending to change the tier** — `/effort` with no argument only displays the current status; it does not reset or toggle any value.
5. **Supplying an unrecognized tier string** — e.g. `"ultra"` or `"maximum"` — the command will emit an error listing valid options rather than fuzzy-matching.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `gt7` | Primary handler for `/effort` command (AsyncFunction, Arbor-resolved) |
| `tF8` | JSX render component for effort UI panels (thin-client variant) |
| `eF8` | JSX render component for effort UI panels (full variant, includes ultracode path) |
| `sF8` | Render-effort-status component (no-argument / status-display path) |
| `Xs` | Effort command orchestrator (dispatches to sub-functions) |
| `dP` | Effort state resolver / feature-flag checker |
| `CK8` | Feature-flag lookup wrapper |
| `K6` | String coercion utility |
| `nG` | Notification/feedback emitter |
| `RU1` | Workflow-availability resolver |
| `h9` | Feature-flag presence tester (checks `allow_workflows`, `allow_product_feedback`) |
| `mX_` | Effort tier applicator / session writer |
| `B04` | Effort-tier-to-internal-string mapper |
| `U04` | User-facing confirmation message builder |
| `Js` | Tier definition table builder |
| `cP` | Model-gated effort tier checker |
| `q1` | Model identifier normalizer |
| `RI` | Settings read helper |
| `_z` | Settings write helper (provider-aware: `firstParty`, `anthropicAws`, `foundry`, `mantle`) |
| `OIH` | Tier subset filter (e.g. opus-4-7, opus-4-8, fable-5 gating) |
| `C6` | Growthbook/experiment event emitter |
| `y_H` | Experiment callback helper |
| `pK8` | Additional tier constraint handler |
| `$IH` | Token-budget / integer-effort parser |
| `Gm` | Numeric effort parser (`parseInt`, `isNaN` guard) |
| `LIH` | Max-effort tier handler (maps to `max_effort`) |
| `ZjH` | Xhigh-effort tier handler (maps to `xhigh_effort`) |
| `qL` | App-state accessor |
| `pVH` | App-state getter helper |
| `LN` | Effort label/description builder |
| `iLH` | Label inclusion checker |
| `MIH` | Tier membership tester (`SV.includes`) |
| `c_H` | String-format utility for confirmation messages |
| `BX_` | Effort persistence writer (delegates to `z6`) |
| `F04` | Settings-write guard |
| `yLH` | Settings-write dispatcher |
| `$q` | Global config writer |
| `Tw_` | Config write path A |
| `Gw_` | Config write path B |
| `cw` | Core config write implementation (handles `ANTHROPIC_API_KEY`, `apiKeyHelper`) |
| `z6` | Settings file write orchestrator |
| `XW6` | Settings serializer path A |
| `PW6` | Settings serializer path B |
| `Rm` | Settings merge helper |
| `Wm` | Settings object builder |
| `p58` | Deduplication guard for settings writes |
| `SX_` | Settings write dispatcher with UUID and event emit |
| `uV_` | Post-write side-effect handler |
| `dDK` | Ripple animation: cosine wave calculator |
| `QDK` | Ripple animation: sqrt distance calculator |
| `FDK` | Ultracode particle animation renderer |
| `mDK` | Particle array builder |
| `Tm` | Effort level display renderer (with ZjH sub-call) |
| `Yd` | Animated particle/ripple JSX component |
| `sF8` | Status-display renderer (current effort + tier list) |
| `U1` | Settings loader (reads from disk via `oK`) |
| `Xl` | Settings parse/validate chain entry |
| `oK` | Settings file parser (JSON + policy merge) |
| `WY6` | Settings schema validator A |
| `GY6` | Settings schema validator B (with `Object.keys`) |
| `_f` | String replacement utility |
| `NhH` | Policy field inclusion checker |
| `UI` | Model-string inclusion tester |
| `zN1` | Recursive settings merger |
| `ON1` | Object-entries settings flattener |
| `I8` | Policy settings extractor |
| `qnH` | Settings entry iterator |
| `$N1` | Settings index-of finder |
| `QD4` | Settings field resolver |
| `J1` | Model alias normalizer (fable, opusplan, sonnet, haiku, opus, best) |
| `Fj6` | Model family classifier |
| `dD4` | Model-string prefix checker (`claude-`) |
| `jO` | Settings composition entry |
| `OT` | Settings orchestrator (BD_ + H98) |
| `BD_` | Settings field writer (NA, k_H, qjH, unH paths) |
| `H98` | Settings policy mapper / model resolution engine |
| `Gt7` | UI sub-render: status row builder |
| `JYA` | Transport-awareness checker |
| `PX` | Transport-state accessor |
| `HX6` | Config load + Mb merge |
| `wA` | Settings write (atomic file write, flagSettings, userSettings, projectSettings, localSettings) |
| `p3` | Settings path resolver |
| `h4_` | Home-dir settings file locator |
| `nC` | Multi-source settings aggregator |
| `c2` | Settings cache accessor |
| `y8` | File error classifier (ENOENT handler) |
| `N` | Log/debug emitter |
| `uf_` | Settings timestamp tracker |
| `bNH` | Settings bundle accessor |
| `Ww6` | Atomic file writer (temp + rename + fchmod + fsync) |
| `RH` | JSON serializer wrapper |
| `rO` | Settings cache invalidator (`dQ6.clear`, `Go8.clear`) |
| `Os6` | Append/write file helper (mkdir + readFile + appendFile + writeFile) |
| `eu` | `.claude` directory path builder |
| `W_` | Global config path resolver |
| `kH` | Feature-flag OK reporter (`tengu_feature_ok`) |
| `t6` | Feature-flag SAD reporter (`tengu_feature_sad`) |
| `CH` | Feature-flag BAD reporter (`tengu_feature_bad`) |
| `gB` | Settings loader from disk (`loadSettingsFromDisk_start/end`) |
| `SH` | Hook/event publisher for settings changes |
| `Mb` | Config merge helper |
| `X8` | Global config reader with auth-loss guard |
| `Tt7` | Full effort UI renderer (includes ultracode branch + all tiers) |
| `NiH` | Tier trim + MIH inclusion check |
| `Wt7` | Effort UI renderer (no-ultracode branch) |
| `d` | React JSX runtime |
| `M6` | React fragment helper |
| `d56` | Fragment symbol |
| `O` | Background session / stopped state checker |
| `C8` | Session state reader |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.