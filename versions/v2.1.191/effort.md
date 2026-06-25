---
type: feature-spec
feature: "effort"
cc_version: "2.1.191"
updated: "2026-06-25"
tags: ["effort", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.191 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/effort`

> Analysis basis: CC v2.1.191 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.191

---

## Overview

The `/effort` command sets the reasoning and implementation effort level for the active Claude model, controlling how thoroughly the model approaches tasks. It accepts a named effort tier (`low`, `medium`, `high`, `xhigh`, `max`, `ultracode`, or `auto`) and applies the setting either to the current session only or persistently as the user's default for new sessions. A special `ultracode` tier activates xhigh effort combined with dynamic workflow orchestration, but requires that the workflows feature be enabled first.

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
| module_id | `S6l` |
| load_inline | `true` |
| loc_byte | `12876751` |
| loc_byte_end | `12877082` |
| loc_line | `8644` |
| arbor_handler.name | `HMf` |
| arbor_handler.fqn | `claude-2.1.191::HMf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.191 bundle.js:+12876751

---

## Input Branching

The command exhibits six or more distinct input paths (one per named tier plus error and session-persistence branches), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/effort [arg]"] --> B{Argument provided?}
    B -- No --> C[Display current effort status\nand available tiers]
    B -- Yes --> D{Normalize: lowercase trim}
    D --> E{Is 'ultracode'?}
    E -- Yes --> F{Dynamic workflows enabled?}
    F -- No --> G[Error: 'Ultracode needs dynamic\nworkflows enabled — see /config'\nValid options listed without ultracode]
    F -- Yes --> H[Set xhigh effort +\nworkflow orchestration flag\nSession-only annotation]
    E -- No --> I{Is valid tier?\nlow / medium / high /\nxhigh / max / auto}
    I -- No --> J[Error: unknown effort level\nShow valid tiers]
    I -- Yes --> K{Remote transport active?}
    K -- Yes --> L[Apply effort locally;\nappend note: 'applied locally —\nremote transport can't change\nserver effort']
    K -- No --> M{Save as default?}
    M -- Yes --> N[Persist to userSettings\nas new-session default\nAppend '(saved as your default\nfor new sessions)']
    M -- No --> O[Apply for this session only\nAppend '(this session only)']
    H --> P[Emit tengu_effort_command telemetry]
    N --> P
    O --> P
    L --> P
    P --> Q[Render JSX status confirmation]
```

Analysis basis: CC v2.1.191 bundle.js:+12862260, +12863228, +12864503, +12865004, +12865827

---

## Behavioral Spec

### Main Handler (`HMf`)

The Arbor-resolved handler `HMf` is an `AsyncFunction` reached via the `module_id` (`S6l`) resolution path. It is the authoritative entry point for the `/effort` command.

```
async function effortCommandHandler(context):
    arg = context.argument
    if arg includes "current" or arg is absent:
        return renderCurrentEffortStatus(context)
    if arg includes "status":
        return renderCurrentEffortStatus(context)
    tier = normalize(arg)   // lowercase, trim whitespace
    proceed to effortSetter(tier, context)
```

Analysis basis: CC v2.1.191 bundle.js:+12874952, +12874968, +12874970, +12875022

---

### Tier Validation (`cBe` — tier membership check)

```
function isSupportedTier(value):
    knownTiers = ["low", "medium", "high", "xhigh", "max", "auto"]
    // ultracode is handled separately before this call
    return knownTiers includes value
```

Analysis basis: CC v2.1.191 bundle.js:+3379048, +3379160

---

### Effort Setter Dispatch (`zkf` path — non-ultracode tiers)

```
async function effortSetter(tier, context):
    if tier == "ultracode":
        workflowsEnabled = checkWorkflowsFeatureFlag(context)
        if not workflowsEnabled:
            return errorMessage(
                "Ultracode needs dynamic workflows enabled (see /config). " +
                "Valid options are: low, medium, high, xhigh, max, auto"
            )
        applyXhighWithWorkflows(context)
        displayMessage("Current effort level: ultracode " +
                       "(xhigh + dynamic workflow orchestration; this session only)")
        return

    if not isSupportedTier(tier):
        return errorMessage("Unknown effort level. Valid: low, medium, high, xhigh, max, auto")

    isRemote = detectRemoteTransport(context)
    if isRemote:
        applyEffortLocally(tier, context)
        suffix = " (applied locally — this remote transport can't change server effort)"
    else:
        saveAsDefault = promptOrInferPersistence(context)
        if saveAsDefault:
            persistEffortToUserSettings(tier, context)
            suffix = " (saved as your default for new sessions)"
        else:
            applyEffortSessionOnly(tier, context)
            suffix = " (this session only)"

    emitTelemetry("tengu_effort_command", {tier: tier})
    renderConfirmation(tier, suffix)
```

Analysis basis: CC v2.1.191 bundle.js:+12863228, +12863379, +12863695, +12863927, +12863947, +12863991, +12865004

---

### Effort Level Descriptions (`phe` — description lookup)

Each named tier maps to a human-readable description displayed in the help/status view:

| Tier | Description |
|---|---|
| `low` | Quick, straightforward implementation with minimal overhead |
| `medium` | Balanced approach with standard implementation and testing |
| `high` | Comprehensive implementation with extensive testing and documentation |
| `xhigh` | (extended high; see literal `xhigh_effort` mapping) |
| `max` | Maximum effort (maps to `max_effort` internally) |
| `ultracode` | xhigh + dynamic workflow orchestration; session-only |
| `auto` | Use the default effort level for your model |

Analysis basis: CC v2.1.191 bundle.js:+3381531, +3381543, +3381609, +3381624, +3381702, +3380616, +3378099, +3378521, +12862717

---

### Model-Tier Compatibility Check (`VI` — model allowlist)

Certain effort tiers are only available for specific model families. The handler inspects the active model identifier against an allowlist:

```
function isTierSupportedByModel(tier, modelId):
    supportedModels = [
        "claude-3-*",       // prefix match
        "claude-opus-4-0",
        "claude-opus-4-1",
        "claude-sonnet-4-0",
        "claude-sonnet-4-5",
        "claude-haiku-4-5",
        "claude-fable-5",
        "claude-mythos-5",
        "claude-opus-4-8",
        "claude-opus-4-7",
        "claude-opus-4-6",
        "claude-sonnet-4-6",
        "claude-opus-4-5"
    ]
    return modelId matches any entry in supportedModels
```

Analysis basis: CC v2.1.191 bundle.js:+3377691, +3377702, +3377720, +3377743, +3377766, +3377791, +3377816, +3377847

---

### Ultracode Visual Animation (`H6l`, `qV`, `E6l`, `y6l` — particle effect renderer)

The `ultracode` tier triggers a JSX-rendered animation effect. The renderer uses trigonometric functions (`Math.cos`, `Math.sqrt`, `Math.floor`, `Math.min`, `Math.round`) to compute a particle ripple, with a named color constant `"violet-ripple"`. Parameters observed:

- Frame count threshold: `17` frames (Analysis basis: CC v2.1.191 bundle.js:+12867656)
- Particle count per frame: `3` (Analysis basis: CC v2.1.191 bundle.js:+12867652)
- Radius multiplier: `8.5` (Analysis basis: CC v2.1.191 bundle.js:+12867831)
- Minimum display threshold: `4` (Analysis basis: CC v2.1.191 bundle.js:+12867745)
- Frame step count: `18` (Analysis basis: CC v2.1.191 bundle.js:+12867927)

```
function renderUltracodeAnimation(frameIndex):
    particleRadius = 8.5
    for i in range(3):
        angle = computeAngle(i, frameIndex)  // Math.cos-based
        x = Math.round(Math.min(particleRadius, computeDistance(angle)))
        renderParticle(x, color="violet-ripple")
    if frameIndex < 4:
        return  // suppress until threshold
    if frameIndex >= 18:
        return  // animation complete
```

Analysis basis: CC v2.1.191 bundle.js:+12867635, +12867676, +12867712, +12867734, +12869237, +12869338, +12869374, +12869396

---

### Effort Status Display (`HMf` — no-argument path)

When invoked with no argument, or with `current`/`status`:

```
function renderEffortStatus(context):
    currentTier = readCurrentEffortFromSession(context)
    displayTiers = ["low", "medium", "high", "xhigh", "max", "auto"]
    if workflowsEnabled(context):
        displayTiers.append("ultracode")
    renderJSX(
        currentTier,
        availableTiers = displayTiers,
        descriptions = tierDescriptionMap()
    )
```

Analysis basis: CC v2.1.191 bundle.js:+12874952, +12874991, +12875006, +12862321, +12862717

---

### Settings Persistence (`a6r` → `nt` path)

When the user confirms saving as default:

```
async function persistEffortToUserSettings(tier, context):
    settings = loadUserSettings()
    settings.effort = tier
    writeUserSettings(settings)   // via nt → Rvt atomic write path
    applyFlagSettings(context, "apply_flag_settings")
```

The atomic write path (`Rvt`) uses `fchmodSync`, `fsyncSync`, `renameSync`, and a temp-file fallback strategy.

Analysis basis: CC v2.1.191 bundle.js:+12863927, +12864418, +3381965, +3381994, +12863124

---

### Workflow Feature Gate (`vvi` → `vs`)

```
function checkWorkflowsFeatureFlag(context):
    featureSet = getFeatureSet(context)
    return featureSet.has("allow_workflows")
```

Analysis basis: CC v2.1.191 bundle.js:+3376801, +3377106, +3377109

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_effort_command` (emitted on every successful tier change, loc_byte:+12864595); `tengu_workflows_enabled` (emitted when workflow flag is checked, loc_byte:+3377310); `tengu_slate_finch` (emitted during settings persistence path, loc_byte:+3381997) |
| Session state | Active effort tier written to in-memory session state; affects subsequent API calls in the same session |
| Persistent settings | When saving as default: writes `effort` field to `userSettings` (`.claude/settings.json`); uses atomic rename/fsync write path |
| JSX render | Renders a status confirmation component via `Ya.jsx`; ultracode tier triggers animated particle effect (`violet-ripple`) |
| Workflow flag interaction | `ultracode` tier requires `allow_workflows` feature to be set; otherwise displays error with redirect to `/config` |
| Remote transport note | When a remote transport is detected, effort is applied client-side only; a note is appended to the confirmation message |
| thinClientDispatch | `control-request` — the command is dispatched as a control request, not a regular prompt, in thin-client configurations |

---

## Version History

| Version | Change |
|---|---|
| v2.1.191 | Initial analysis — six tiers supported (`low`, `medium`, `high`, `xhigh`, `max`, `auto`); `ultracode` tier gated on `allow_workflows`; animated violet-ripple particle effect for `ultracode`; persistent vs. session-only save distinction |

---

## Common Mistakes

1. **Attempting `ultracode` without enabling workflows**: The command will reject `ultracode` with an explicit error message directing the user to `/config`. Enable dynamic workflows first, then re-run `/effort ultracode`.
2. **Expecting `ultracode` to persist across sessions**: The `ultracode` tier is always session-only (`"this session only"` annotation). It cannot be saved as the default; only the underlying `xhigh` tier can be persisted.
3. **Assuming remote transport respects effort changes**: When connected via a remote transport, effort changes apply locally to the client only. The server-side effort level is unaffected; the confirmation message will note this.
4. **Omitting the argument**: Running `/effort` with no argument displays the current status and tier list — it does not reset or toggle effort. To change the level, an explicit tier argument is required.
5. **Using tier names not in the allowlist**: Tier names are case-insensitive and trimmed, but must exactly match one of the seven recognized values. Abbreviated or partial names (e.g., `hi` for `high`) are not accepted.
6. **Confusing `max` and `ultracode`**: `max` is a standard persistable tier mapping to `max_effort` internally. `ultracode` is a superset mode (`xhigh` + workflow orchestration) that requires a feature flag and is always session-scoped.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `HMf` | Main async handler for `/effort` command (Arbor-resolved) |
| `eer` | Top-level command entry wrapper (calls QZ and other helpers) |
| `QZ` | Command dispatch coordinator (calls uE, JZ) |
| `uE` | Effort state reader / feature flag checker |
| `YTn` | String normalization utility (trim + case) |
| `rt` | String coercion helper |
| `cx` | Context/state accessor |
| `vvi` | Workflow feature flag evaluator |
| `vs` | Feature set membership checker (allow_workflows, allow_product_feedback) |
| `o6r` | Effort description builder |
| `D_d` | Tier description formatter |
| `M_d` | Model-tier compatibility helper |
| `JZ` | Core effort-setting dispatcher (branches to VI, dBe, eIn, uBe, lBe, Nve) |
| `VI` | Model allowlist checker and effort applicator |
| `ao` | Provider/transport type inspector |
| `o1` | Settings reader helper |
| `PH` | Provider classification helper (firstParty, anthropicAws, foundry, mantle) |
| `dBe` | Future/preview model tier handler (opus-4-7, opus-4-8, fable-5) |
| `kt` | Telemetry event emitter |
| `Gj` | UI notification helper |
| `eIn` | Effort level applicator (high/xhigh path) |
| `uBe` | Budget/effort token calculator |
| `_F` | Numeric effort value parser (parseInt, isNaN) |
| `lBe` | Max-effort tier handler |
| `Nve` | Xhigh-effort tier handler |
| `Vu` | Session state reader |
| `W1e` | Session state writer |
| `kD` | Effort command orchestrator (calls JZ, phe) |
| `phe` | Tier description lookup table |
| `cBe` | Tier membership validator (checks knownTiers list) |
| `rae` | Effort confirmation message builder |
| `a6r` | Persistent settings writer |
| `P_d` | Settings path resolver |
| `nge` | Settings write orchestrator |
| `wi` | User settings writer (delegates to _y) |
| `_y` | Atomic settings write implementation |
| `nt` | Settings save coordinator (IDt, CDt, B4, RTn) |
| `B4` | Settings store accessor |
| `$4` | Settings state getter |
| `RTn` | Settings update/deduplicate handler |
| `w5r` | Settings write-and-emit (randomUUID, KZ.emit) |
| `P5r` | Settings validation and commit |
| `H6l` | Ultracode animation frame renderer |
| `W4` | Effort UI component builder |
| `p6l` | Particle list mapper |
| `E6l` | Cosine-based position calculator |
| `y6l` | Distance calculator (Math.sqrt) |
| `ZZn` | Effort display component root (calls W4, Es) |
| `Es` | Effort label/model display builder |
| `E4` | Label layout helper |
| `Na` | Model name parser and normalizer |
| `Nwt` | Model name tokenizer |
| `Uwt` | Model family classifier |
| `NFe` | Model name trim/lookup |
| `Xme` | Model alias resolver |
| `il` | String replace utility |
| `OFe` | Model family membership checker |
| `Dk` | Tier/model type discriminator |
| `xhn` | Model name classifier helper |
| `GKs` | Model entry iterator |
| `In` | Settings store interface |
| `PQe` | Provider entries resolver |
| `BKs` | Model index finder |
| `qqu` | Model qualifier helper |
| `Qo` | Full model name resolver |
| `r0t` | Model ID prefix handler |
| `Kqu` | Tier qualifier helper |
| `rH` | Model display string builder |
| `Fw` | Full model name formatter |
| `OPr` | Model identifier renderer |
| `Phn` | Model property parser |
| `Dhn` | Model section extractor |
| `ter` | Effort command render function (lowercase, branches to Ykf, Xkf, cnt, W4, Es, zkf) |
| `Ykf` | Effort set handler (no-persist path) |
| `c1o` | Session effort applicator |
| `YS` | Session state updater |
| `jDt` | Effort apply and confirm (calls uo, SB) |
| `Uve` | Session effort field setter |
| `uo` | Settings load-and-apply coordinator |
| `sg` | Settings file locator |
| `Gt` | File existence checker |
| `EIr` | Config directory resolver |
| `z2` | Full settings loader |
| `VC` | Config path builder |
| `vn` | ENOENT handler |
| `wTr` | Timestamp setter |
| `GUe` | Settings cache invalidator |
| `Rvt` | Atomic file writer (fchmodSync, fsyncSync, renameSync) |
| `kH` | Cache clear helper |
| `Yps` | File append/write orchestrator |
| `c4` | `.claude` directory path builder |
| `Hr` | Home directory resolver |
| `Lt` | Settings-write confirmation emitter |
| `vj` | Settings field updater |
| `Le` | Settings write logger |
| `SB` | Confirmation message assembler |
| `gn` | Global config save orchestrator |
| `Xkf` | Effort set handler (persist path) |
| `cnt` | Input trim and tier validate |
| `zkf` | Effort set handler (ultracode + remote path) |
| `HMf` | Main async handler (see above) |
| `qV` | Ultracode particle animation component |
| `An` | Animation frame state manager |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.