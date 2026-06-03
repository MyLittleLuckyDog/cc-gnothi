---
type: feature-spec
feature: "effort"
cc_version: "2.1.161"
updated: "2026-06-03"
tags: ["effort", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.161 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/effort`

> Analysis basis: CC v2.1.161 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.161

---

## Overview

The `/effort` command sets the inference effort level for the current session or globally, controlling how deeply the model reasons about tasks. It accepts a named tier (`low`, `medium`, `high`, `xhigh`, `max`, `ultracode`, or `auto`) and propagates the selection through application state and configuration. The command is rendered as a local-JSX component and, when operating over a remote thin-client transport, applies the setting locally while noting that server-side effort cannot be changed remotely.

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
| module_id | `i8K` |
| load_inline | `true` |
| loc_byte | `12584131` |
| loc_byte_end | `12584462` |
| loc_line | `8797` |
| arbor_handler.name | `$If` |
| arbor_handler.fqn | `claude-2.1.161::$If` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.161 bundle.js:+12584131

---

## Input Branching

The command has 6+ distinct named branches (one per effort tier) plus a no-argument status path and an ultracode prerequisite guard, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/effort invoked"]) --> B{Argument provided?}
    B -- No --> C[Display current effort level\nand available tiers]
    B -- Yes --> D{Normalize argument\n.trim().toLowerCase()}
    D --> E{Is value in valid tier list?}
    E -- No --> F[Show error: invalid tier\nList valid options]
    E -- Yes --> G{Is value 'ultracode'?}
    G -- Yes --> H{Dynamic workflows enabled?}
    H -- No --> I["Error: 'Ultracode needs dynamic\nworkflows enabled (see /config).\nValid options: low, medium, high,\nxhigh, max, auto'"]
    H -- Yes --> J[Apply ultracode:\nset effort=xhigh + workflow flag]
    G -- No --> K{Is value 'max'?}
    K -- Yes --> L[Apply max_effort setting]
    K -- No --> M{Is value 'xhigh'?}
    M -- Yes --> N[Apply xhigh_effort setting]
    M -- No --> O{Is value low/medium/high/auto?}
    O -- Yes --> P[Apply named tier to session config]
    O -- No --> Q[Fallback / unset handling]
    J --> R{Thin-client transport?}
    L --> R
    N --> R
    P --> R
    Q --> R
    R -- Yes --> S["Append note: '(applied locally —\nthis remote transport can't\nchange server effort)'"]
    R -- No --> T[Persist effort setting\nvia settings writer]
    S --> U[Emit tengu_effort_command telemetry]
    T --> U
    U --> V[Render JSX status confirmation]
```

---

## Behavioral Spec

### Handler: `$If` (AsyncFunction, resolved via module_id `i8K`)

Analysis basis: CC v2.1.161 bundle.js:+12582323

```
async function effortCommandHandler(args, context):
    // $If is the Arbor-resolved handler; callGraph entry IS8 is the
    // module-level wiring function that wires it into the command system.

    rawArg = args.trim()

    if rawArg is empty:
        return renderCurrentStatus(context)   // shows "current" and "status" fields

    normalized = rawArg.toLowerCase()

    if not isValidEffortTier(normalized):
        return renderError("Invalid effort level", listValidTiers(context))

    if normalized == "ultracode":
        return handleUltracode(context)

    applyEffortTier(normalized, context)
    return renderConfirmation(normalized, context)
```

Analysis basis: CC v2.1.161 bundle.js:+12582323

---

### Sub-feature: Effort tier validation (`NNH` / tier-list checker)

```
function isValidEffortTier(value):
    // NNH checks membership in the wI list
    validTiers = ["low", "medium", "high", "xhigh", "max", "ultracode", "auto"]
    return validTiers.includes(value)
```

Analysis basis: CC v2.1.161 bundle.js:+4158776 (NNH → wI.includes)

---

### Sub-feature: Ultracode prerequisite guard (`gNf`)

The `ultracode` tier is a supermode that combines `xhigh` effort with dynamic workflow orchestration. Before activating it, the handler checks whether workflows are currently enabled in the session configuration.

```
function handleUltracode(context):
    workflowsEnabled = checkFeatureFlag("allow_workflows", context)

    if not workflowsEnabled:
        return renderError(
            "Ultracode needs dynamic workflows enabled (see /config). " +
            "Valid options are: low, medium, high, xhigh, max, auto"
        )
        // Error string: bundle.js:+12572150

    // Apply xhigh effort + workflow orchestration flag
    setEffortLevel("xhigh", context)
    setWorkflowOrchestration(true, context)

    // Annotate as session-only
    appendNote(" (this session only)")   // literal: bundle.js:+12571141
    emitTelemetry("tengu_effort_command")
    return renderConfirmation("ultracode (xhigh + dynamic workflow orchestration; this session only)")
```

Analysis basis: CC v2.1.161 bundle.js:+12572130, +12571141, +12572150

The status message for an active ultracode session reads (in part): `"Current effort level: ultracode (xhigh + dynamic workflow orchestration; this session only)"` — Analysis basis: CC v2.1.161 bundle.js:+12571314

---

### Sub-feature: Effort tier application (`kW`, `qJ6`, `EnH`)

```
function applyEffortTier(tier, context):
    match tier:
        case "max":
            // kW path; writes "max_effort" key
            setConfigKey("max_effort", true, context)   // literal: bundle.js:+4157917

        case "xhigh":
            // EnH path; writes "xhigh_effort" key
            setConfigKey("xhigh_effort", true, context)  // literal: bundle.js:+4158294

        case "low" | "medium" | "high" | "auto":
            // qJ6 path; writes "effort" key with tier string
            setConfigKey("effort", tier, context)         // literal: bundle.js:+4157506

        case "unset":
            clearEffortConfig(context)                    // literal "unset": bundle.js:+4159625

    if isThinClientTransport(context):
        appendNote(" (applied locally — this remote transport can't change server effort)")
        // literal: bundle.js:+12570180
```

Analysis basis: CC v2.1.161 bundle.js:+4157912 (`qJ6` → `nr`), +4158289 (`EnH` → `nr`), +4157501 (`kW` → `nr`)

---

### Sub-feature: Tier descriptions (`yLH`)

Each named tier carries a human-readable description surfaced in the status display:

| Tier | Description |
|---|---|
| `low` | Quick, straightforward implementation with minimal overhead |
| `medium` | Balanced approach with standard implementation and testing |
| `high` | Comprehensive implementation with extensive testing and documentation |
| `xhigh` | (maps to xhigh_effort config key) |
| `max` | Maximum capability with deepest reasoning |
| `ultracode` | xhigh + dynamic workflow orchestration; this session only |
| `auto` | Use the default effort level for your model |

Analysis basis: CC v2.1.161 bundle.js:+4161015 (`low`), +4161093 (`medium`), +4161186 (`high`), +4161350 (`max`), +12569896 (`auto`), +12571314 (`ultracode` status string)

---

### Sub-feature: Model compatibility check (`_9`)

Before applying certain effort tiers, the handler checks whether the active model supports the requested level. Models are matched against a known list including prefixes and explicit model strings:

- Prefix check: `"claude-3-"` (bundle.js:+4157565)
- Named models checked include: `claude-opus-4-0`, `claude-opus-4-1`, `claude-sonnet-4-0`, `claude-sonnet-4-5`, `claude-haiku-4-5`, `claude-opus-4-5`, `claude-opus-4-6`, `claude-opus-4-7`, `claude-opus-4-8`, `claude-sonnet-4-6`

Analysis basis: CC v2.1.161 bundle.js:+4157545 (`_9`), +4157565–4157844 (model string literals)

The `_9` function also checks the API provider type, distinguishing `firstParty`, `anthropicAws`, `foundry`, and `mantle` backends (bundle.js:+2050667–2050720) and whether the model identifier includes `"application-inference-profile"` (bundle.js:+2234145).

---

### Sub-feature: Numeric budget parser (`Ou`)

For effort tiers that carry a numeric budget (such as internal model-budget values), `Ou` converts a string representation to an integer:

```
function parseNumericBudget(raw):
    s = String(raw)
    parsed = parseInt(s, 10)
    if isNaN(parsed):
        return defaultBudgetValue
    return parsed
```

Analysis basis: CC v2.1.161 bundle.js:+4159281 (`parseInt`), +4159300 (`isNaN`), +4159220 (`String`)

The literal `10` is used as the radix (bundle.js:+4159292).

---

### Sub-feature: Status / no-argument rendering (`$If` → JSX path)

When no argument is supplied, the handler renders the current effort state as a JSX component. The rendered output includes two labelled fields: `"current"` (the active tier name) and `"status"` (a human-readable description or `"stopped"` for a background session).

Analysis basis: CC v2.1.161 bundle.js:+12582363 (`"current"`), +12582378 (`"status"`), +12582394 (`zA.createElement`)

---

### Sub-feature: Animated ultracode indicator (`_g`, `n8K`, `l8K`, `d8K`)

When the active effort level is `ultracode`, the JSX component renders an animated visual indicator. The animation uses:

- `Math.cos` for oscillation — bundle.js:+12576520
- `Math.sqrt` for distance calculation — bundle.js:+12576419
- `Math.min` for clamping — bundle.js:+12576556
- `Math.round` for pixel rounding — bundle.js:+12576578
- `Math.floor` for frame indexing — bundle.js:+12574886

The indicator is labeled `"violet-ripple"` (bundle.js:+12574864) and uses numeric parameters including values `3`, `17`, `4`, `8.5`, `18` (bundle.js:+12574804–12575079).

The `d8K` function renders `ultracode`-labeled segments (literal `"ultracode"`: bundle.js:+12574828) and passes the description `"xhigh + workflows"` (bundle.js:+12575116). The visual array contains entries mapped at indices involving steps `5`, `7`, `9` (bundle.js:+12576951, +12576971, +12577230) and uses `2` as a cosine scaling factor (bundle.js:+12576529).

Analysis basis: CC v2.1.161 bundle.js:+12574787 (`d8K` → `$u`)

---

### Sub-feature: Settings persistence (`e0_`, `yKH`, `a9`, `KD`)

After computing the new effort value, the handler writes it through the settings subsystem:

```
function persistEffortSetting(key, value):
    // e0_ orchestrates:
    // 1. Read current settings from disk via KD (which handles ANTHROPIC_API_KEY,
    //    apiKeyHelper, and multi-layer config merge)
    // 2. Merge new key/value into the appropriate settings layer
    // 3. Write back atomically via Y56 (rename-based atomic write)
    // 4. Emit tengu_slate_finch telemetry on completion

    currentSettings = loadSettingsFromDisk()   // np → loadSettingsFromDisk_start/end events
    merged = mergeSettingsLayer(currentSettings, key, value)
    atomicWrite(merged)                         // Y56: openSync → writeFileSync → fsyncSync → renameSync
    emitTelemetry("tengu_slate_finch")
```

Analysis basis: CC v2.1.161 bundle.js:+4161441 (`e0_` → `RbL`), +4161463 (`e0_` → `yKH`), +3008781 (`a9` → `ZK_`), +1230098 (`loadSettingsFromDisk_start` literal), +1230154 (`loadSettingsFromDisk_end` literal)

The atomic write uses `fchmodSync` to preserve original file permissions (literal: `"Applied original permissions to temp file"`, bundle.js:+1014259).

---

### Sub-feature: `apply_flag_settings` hook (`BNf`)

After writing the effort setting, the handler triggers an `"apply_flag_settings"` pass (bundle.js:+12570303) that reconciles any flag-gated settings (including workflow enablement) with the freshly written configuration. This ensures that ultracode's workflow dependency is applied atomically with the effort tier.

Analysis basis: CC v2.1.161 bundle.js:+12570303

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_effort_command` | Fired on every successful effort-tier change (bundle.js:+12571745) |
| Telemetry: `tengu_slate_finch` | Fired after settings are successfully persisted to disk (bundle.js:+4161473) |
| Telemetry: `tengu_workflows_enabled` | Fired when the workflow-enabled flag state is read during ultracode validation (bundle.js:+4157173) |
| Telemetry: `tengu_feature_ok` | Fired on successful feature-flag check in sub-path (bundle.js:+966587) |
| Telemetry: `tengu_feature_sad` | Fired on a non-fatal feature-flag check issue (bundle.js:+966732) |
| Telemetry: `tengu_feature_bad` | Fired on a fatal feature-flag check failure (bundle.js:+966650) |
| Telemetry: `tengu_config_auth_loss_prevented` | Fired if the settings writer detects that a re-read config is missing auth that the cache holds — write is refused to prevent auth loss (bundle.js:+3246565; literal: `"saveGlobalConfig fallback: re-read config is missing auth…"`, bundle.js:+3246437) |
| appState changes | Writes `effort`, `max_effort`, or `xhigh_effort` key into the active settings layer; optionally sets workflow-orchestration flag for ultracode |
| Settings files | Reads/writes `.claude/settings.json` (bundle.js:+1222551, +1222561) and `.claude/settings.local.json` (bundle.js:+1222623) |
| Thin-client transport | When `thinClientDispatch` is `"control-request"`, the effort change is applied locally only; a notice is appended to the output (bundle.js:+12570180) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook: `apply_flag_settings` | Triggered after write to reconcile flag-gated config (bundle.js:+12570303) |
| Hook: `WBH.emit` | Event bus emission after settings save (bundle.js:+1232623) |
| Cache invalidation | `nz` clears two internal caches (`Cx6`, `IU8`) after settings write (bundle.js:+26612, +26624) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.161 | Initial analysis; ultracode tier present with animated violet-ripple indicator; xhigh and max as distinct config keys; thin-client dispatch as `control-request` |

---

## Common Mistakes

1. **Passing `ultracode` without enabling dynamic workflows first.** The command will reject the tier with an explicit error directing the user to `/config`. Workflows must be enabled before `ultracode` is accepted.
2. **Expecting `ultracode` to persist across sessions.** The ultracode mode is marked `"this session only"` (bundle.js:+12571141); the underlying `xhigh_effort` setting may persist but the workflow-orchestration flag is session-scoped.
3. **Using `ultracode` over a thin-client/remote transport.** The effort change will apply only locally; the server-side inference effort is not changed. The output explicitly notes this limitation (bundle.js:+12570180).
4. **Confusing `max` and `xhigh`.** These are separate config keys (`max_effort` vs. `xhigh_effort`) with distinct behaviors, not simply adjacent tiers. `xhigh` enables `xhigh_effort` and is the prerequisite for ultracode; `max` enables `max_effort` for deepest reasoning.
5. **Assuming the argument is case-sensitive.** The handler normalizes the argument with `.toLowerCase()` before matching, so `HIGH`, `High`, and `high` are all equivalent.
6. **Omitting the argument to change the level.** Calling `/effort` with no argument only displays the current status; it does not reset or toggle the setting.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `$If` | Main async handler for `/effort` (Arbor-resolved, module_id `i8K`) |
| `IS8` | Module-level wiring function; connects `$If` into the command registry |
| `lo` | Top-level orchestrator called by `IS8`; delegates to config-read and render paths |
| `cP` | Config-read coordinator; fetches current effort and workflow state |
| `fL8` | Feature-flag reader sub-function within config coordinator |
| `pH` | Primitive helper (used by multiple callers for value normalization / stringification) |
| `ZT` | Shared utility (called from `fL8` and `hbL`) |
| `y19` | Workflow-settings reader |
| `G9` | Workflow eligibility checker (checks `allow_workflows`, `allow_product_feedback`, set membership) |
| `a0_` | Pro-tier / subscription checker |
| `SbL` | Subscription-level resolver; checks `"pro"` tier and `tengu_workflows_enabled` telemetry |
| `hbL` | Secondary config path within `cP` |
| `co` | Render/dispatch coordinator for the effort command output |
| `kW` | Max-effort path handler |
| `_9` | Model-compatibility checker (checks model name prefix and inference profile type) |
| `A` | Model name normalizer (calls `.toLowerCase()`) |
| `Iy` | Config persistence helper A (called from `kW`, `qJ6`, `EnH`) |
| `IY` | Config persistence helper B (calls `d$6`, `KB4`, `PA`, `Ha6`) |
| `kNH` | Ultracode mode handler within `co` |
| `y6` | Timestamp-aware state updater (calls `Date.now`) |
| `zL8` | Additional effort-state resolver within `co` |
| `INH` | Effort-status display renderer (calls `Ou`, `String`, `parseInt`, `isNaN`) |
| `Ou` | Numeric budget parser (`parseInt` / `isNaN` wrapper) |
| `qJ6` | Named-tier (low/medium/high/auto) effort path handler |
| `EnH` | xhigh-effort path handler |
| `OL` | Output/display helper (used by `IS8`, `FNf`, `gNf`) |
| `WEH` | Sub-helper of `OL` |
| `iV` | JSX rendering entry point for effort status |
| `yLH` | Tier-description mapper (low → "Quick…", medium → "Balanced…", etc.) |
| `NNH` | Valid-tier membership checker (checks `wI.includes`) |
| `X8H` | String-conversion helper for output formatting |
| `e0_` | Settings persistence orchestrator (calls `RbL`, `yKH`, `j6`) |
| `RbL` | Settings pre-read helper |
| `yKH` | Settings merge/write helper (calls `a9`) |
| `a9` | Settings layer resolver (calls `ZK_`, `TK_`, `KD`, `Bq`) |
| `ZK_` | Settings key resolver A |
| `TK_` | Settings key resolver B |
| `KD` | Settings writer core (handles `ANTHROPIC_API_KEY`, `apiKeyHelper`, atomic write) |
| `j6` | Settings-write dispatcher (calls `gY6`, `QY6`, `Qx`, `Lq8`, `BY6`, `CU`, `y6`) |
| `gY6` | Settings write sub-helper A |
| `QY6` | Settings write sub-helper B |
| `Qx` | Settings write sub-helper C (calls `pH`, `gx`) |
| `gx` | Low-level write primitive (calls `dR`) |
| `Lq8` | Settings cache manager (checks/adds to `aw_`/`QDH`, calls `ow_`, `Hj_`) |
| `ow_` | Event emitter for settings change (calls `tr.emit`, `nw_.randomUUID`, `SH`) |
| `Hj_` | Settings-change hook dispatcher (calls `lCq`, `t_`, `xcq`, `ne`) |
| `n8K` | Ultracode animation: cosine oscillation computation |
| `l8K` | Ultracode animation: square-root distance computation |
| `d8K` | Ultracode animated indicator renderer (calls `$u`, `Math.floor`, `B8K`) |
| `$u` | Effort-mode display builder (calls `cP`, `EnH`) |
| `B8K` | Indicator segment mapper (calls `H.map`, `H.slice`) |
| `H` | Message/context array (fetches bootstrap data, model list) |
| `N` | Bootstrap fetch and normalization function |
| `VBK` | Response parser helper |
| `SH` | JSON serialization helper (`JSON.stringify`) |
| `Z4` | Path/model-name formatter |
| `imH` | Gitignore/exclude helper |
| `IBK` | File-read-with-byte-limit helper |
| `s$` | Session state accessor |
| `ne` | Hook registry checker (`WA4.has`) |
| `Ij` | String replacement utility |
| `lq` | Model-name alias resolver |
| `xHH` | Model-name normalization sub-function |
| `s9` | Full model-name normalization (handles opusplan, sonnet, haiku, opus, best aliases) |
| `xP` | Model-name parsing wrapper |
| `t6` | React hook: component A |
| `d` | React hook: component B (called by `t6`, `hH`, `RH`, `W8`) |
| `h1H` | React hook sub-helper |
| `NS8` | Argument-hint builder (appends `"\|ultracode"` for capable contexts) |
| `kS8` | Primary render function for the effort JSX component |
| `FNf` | Render path A (first-party / non-workflows contexts) |
| `q1A` | Sub-render helper A (calls `OL`, `rE`) |
| `rE` | Output formatter (calls `OL`) |
| `LJ6` | Render path B (calls `_wH`, `l_`, `KC`) |
| `_wH` | Session-context reader |
| `l_` | Full settings loader (reads policy, flag, user, project, local settings layers) |
| `BO` | Settings-file opener helper |
| `F6` | File existence checker |
| `Xe8` | Settings file reader |
| `TQ` | Settings schema validator/merger |
| `mX` | Platform detection helper |
| `k8` | File-not-found error handler |
| `wt8` | Settings cache timestamper |
| `qTH` | Settings re-read helper |
| `Y56` | Atomic file writer (open → write → fsync → rename) |
| `nz` | Cache invalidator (clears `Cx6` and `IU8`) |
| `QQ6` | Gitignore/append-log file writer |
| `wx` | Config path joiner (`.claude/settings.json`) |
| `P_` | Config directory resolver |
| `hH` | React hook: component C |
| `RH` | React hook: component D |
| `np` | Settings-from-disk loader (emits `loadSettingsFromDisk_start`/`_end`) |
| `yH` | Error logger for settings path |
| `KC` | Effort-status component compositor |
| `W8` | Global config writer (guards against auth-loss on re-read; emits `tengu_config_auth_loss_prevented`) |
| `gNf` | Render path C (ultracode-capable contexts; checks workflows, appends `" ultracode,"` to hint) |
| `GnH` | Input normalizer for effort argument (calls `H.trim`, `NNH`) |
| `BNf` | Render path D (applies flag settings; calls `_wH`, `rE`, `q1A`, `LJ6`, `X8H`, `e0_`) |
| `_g` | Ultracode ripple animation driver (calls `n8K`, `l8K`, `O.at`, `O.push`, `O.map`) |
| `O` | Animation frame array (calls `u8` for frame generation) |
| `u8` | Animation frame generator |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.