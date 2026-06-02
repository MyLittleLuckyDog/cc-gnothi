---
type: feature-spec
feature: "model"
cc_version: "2.1.159"
updated: "2026-06-02"
tags: ["model", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.159 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/model`

> Analysis basis: CC v2.1.159 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.159

---

## Overview

The `/model` command sets the AI model that Claude Code uses for the current session, with an optional flag to persist the choice as the default for all future sessions. It accepts a model name argument (including shorthand aliases such as `sonnet`, `haiku`, `opus`, `best`, and `opusplan`), validates the model against available models for the authenticated account, performs a live API probe to confirm reachability, and then updates application state accordingly.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `model` |
| description | `Set the AI model for Claude Code` |
| argumentHint | `<model>` |
| supportsNonInteractive | `true` |
| module_id | `Qo1` |
| load_inline | `true` |
| loc_byte | `12401470` |
| loc_byte_end | `12401644` |
| loc_line | `8265` |
| arbor_handler.name | `m$5` |
| arbor_handler.fqn | `claude-2.1.159::m$5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.159 bundle.js:+12401470

---

## Input Branching

The command has more than three distinct branches depending on argument presence, alias resolution, account-tier availability, and whether a default save is requested. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/model called"]) --> B{Argument provided?}
    B -- No --> C[Display current model\nand available model list]
    B -- Yes --> D[Trim whitespace from argument]
    D --> E{Is argument in\nknown-alias list?}
    E -- Yes --> F[Resolve alias to\ncanonical model string]
    E -- No --> G[Use argument as-is]
    F --> H[Validate resolved model\nagainst available-models list]
    G --> H
    H --> I{Model allowed\nfor account tier?}
    I -- No --> J["Emit model_switch / not_allowed\nerror; abort"]
    I -- Yes --> K{Extended-context 1M\nrequested?}
    K -- Yes, Opus 1M --> L{Account supports\nOpus 1M?}
    L -- No --> M["Error: opus_1m_unavailable\n(bundle.js:+12356563)"]
    L -- Yes --> N[Continue]
    K -- Yes, Sonnet 1M --> O{Account supports\nSonnet 4.6 1M?}
    O -- No --> P["Error: sonnet_1m_unavailable\n(bundle.js:+12356780)"]
    O -- Yes --> N
    K -- No --> N
    N --> Q[Send ephemeral 'Hi' probe\nvia API — model_validation]
    Q --> R{API response}
    R -- Auth failure --> S["Error: Authentication failed.\nPlease check your API credentials.\n(bundle.js:+12355270)"]
    R -- Network error --> T["Error: Network error.\nPlease check your internet connection.\n(bundle.js:+12355372)"]
    R -- not_found_error --> U["Error: invalid_model\n(bundle.js:+12357063)"]
    R -- Other error --> V["Error: validate_exception\n(bundle.js:+12357160)"]
    R -- Success --> W{Save as default\nrequested?}
    W -- Yes --> X["Persist model to userSettings\n(settings.json)\nShow ' and saved as your default\nfor new sessions' suffix\n(bundle.js:+12357540)"]
    W -- No --> Y["Session-only change\nShow ' for this session only' suffix\n(bundle.js:+12357586)"]
    X --> Z[Update appState.model\nEmit telemetry model_set_default\n(bundle.js:+12357898)]
    Y --> Z
    Z --> AA[Display confirmation with\nFast mode / usage-credits\nannotations if applicable]
```

---

## Behavioral Spec

### 1. Handler Entry — Argument Normalisation

Analysis basis: CC v2.1.159 bundle.js:+12393077

```
async function handleModelCommand(args, options):
    rawInput = args.trim()                          // bundle.js:+12393077
    if rawInput is in validModelTypes list:         // bundle.js:+12393093
        appState = getAppState()                    // bundle.js:+12393116
        // Branch: inline model setting path
        result = resolveAndSetModel(appState, rawInput, options)
        emitTelemetry("tengu_model_command_inline") // bundle.js:+12393235
    else if rawInput is in restricted-model list:  // bundle.js:+12393180
        // Handled by interactive model picker path
        result = runInteractiveModelPicker(options) // bundle.js:+12393233
    return result
```

### 2. Available-Model Resolution (`resolveAvailableModels`)

Analysis basis: CC v2.1.159 bundle.js:+12357276

The available-model resolution function (`l8A` → `resolveAvailableModels`) is the central list-building step. It:

1. Retrieves the base set of available models via the model-catalogue function (`CQ` → `buildModelCatalogue`), which reads account tier (`max`, `team`, `default_claude_max_5x`, `enterprise`, `enterprise_usage_based`) and provider type (`firstParty`, `anthropicAws`, `gateway`) to determine eligibility.
2. Applies per-alias normalisation (`oM5`, `aM5`, `rM5` — see §3 below) to expand shorthand tokens.
3. Invokes the full alias-expansion function (`Ck8` → `expandModelAlias`) that trims input, resolves against the catalogue, and performs the live API probe (see §4).
4. Formats the display string via (`nM5` → `formatModelEntry`) which calls `String` coercion and sub-formatting helpers.
5. Returns a final list including a `"default"` sentinel entry (bundle.js:+12356361).

### 3. Alias Normalisation

Analysis basis: CC v2.1.159 bundle.js:+12358296 – +12358424

Three normalisation helpers operate on shorthand aliases:

```
function normaliseShortAlias(input):
    lower = input.toLowerCase()             // bundle.js:+12358296
    // oM5 path: resolves against model list with includes check
    if modelList.includes(lower): return resolvedEntry
    // aM5 path: similar but for DLH display-name helper
    // rM5 path: checks Q1H list before toLowerCase

function resolveOpusPlanAlias(modelString):
    // "opusplan" → "Opus Plan" display name (bundle.js:+2191674)
    // "Opus in plan mode, else Sonnet" description (bundle.js:+2191379)
    // Maps literal "opusplan" (bundle.js:+2191362)
```

Known shorthand aliases and their semantics (bundle.js:+2192875 – +2193043):

| Alias | Description |
|---|---|
| `sonnet` | Resolves to the current Sonnet model |
| `haiku` | Resolves to the current Haiku model |
| `opus` | Resolves to the current Opus model |
| `best` | Resolves to the highest-capability available model |
| `opusplan` | Opus in plan mode, else Sonnet (bundle.js:+2191379) |
| `[1m]` suffix | Requests 1M-context variant (bundle.js:+2192875) |

Extended-context variants `sonnet[1m]` (bundle.js:+12358435) and `sonnet-4-6[1m]` (bundle.js:+12358461) are accepted. If the account does not support Opus 1M, error string `"opus_1m_unavailable"` (bundle.js:+12356563) is raised with message: "Opus with 1M context is not available for your account. Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m" (bundle.js:+12356601). Equivalently, if the account does not support Sonnet 4.6 1M, error `"sonnet_1m_unavailable"` (bundle.js:+12356780) is raised (bundle.js:+12356820).

### 4. Model Validation Probe (`expandModelAlias`)

Analysis basis: CC v2.1.159 bundle.js:+12354534

```
async function expandModelAlias(rawName):
    name = rawName.trim()                       // bundle.js:+12354534
    if name is empty:
        raise "Model name cannot be empty"      // bundle.js:+12354571
    catalogue = buildModelCatalogue(name)       // bundle.js:+12354605
    name = name.toLowerCase()                   // bundle.js:+12354694
    if name in Q1H_reserved_list:              // bundle.js:+12354713
        // Cache probe: check ir1 Map
        if ir1.has(name):                       // bundle.js:+12354815
            return cached result
        // Fire live probe via apiCall (ku)
        response = await apiProbe(name)         // bundle.js:+12354860
        ir1.set(name, response)                 // bundle.js:+12355023
        result = formatModelEntry(response)     // bundle.js:+12355064
        return result
```

The probe function (`ku` → `apiProbe`) sends a minimal `"user"` role message with body `"Hi"` using `"ephemeral"` cache control (bundle.js:+12354945, +12354979, +12355004) and a maximum token budget of 1024 (bundle.js:+13166344). It is classified as a `"side_query"` (bundle.js:+13166528). On success it emits `tengu_api_success` (bundle.js:+13167979).

Error mapping from the probe:

| Condition | Error string | Message |
|---|---|---|
| Auth failure | — | "Authentication failed. Please check your API credentials." (bundle.js:+12355270) |
| Network error | — | "Network error. Please check your internet connection." (bundle.js:+12355372) |
| `not_found_error` type | `invalid_model` | Derived from `"model:"` prefix (bundle.js:+12355491, +12355573) |
| Other exception | `validate_exception` | (bundle.js:+12357160) |

### 5. Model Catalogue Construction (`buildModelCatalogue`)

Analysis basis: CC v2.1.159 bundle.js:+2186671

```
function buildModelCatalogue(input):
    baseProvider = getProviderType()        // firstParty / anthropicAws / gateway
    tier = getAccountTier()                 // max / team / enterprise / ...
    filtered = allModels
        .map(normaliseEntry)
        .filter(isEligible(tier, provider))
    // Provider checks (bundle.js:+2046208):
    //   bedrock    (bundle.js:+2046248)
    //   foundry    (bundle.js:+2046298)
    //   mantle     (bundle.js:+2046408)
    //   vertex     (bundle.js:+2046456)
    // Tier checks:
    //   max        (bundle.js:+2962823)
    //   team       (bundle.js:+2962894)
    //   default_claude_max_5x (bundle.js:+2962909)
    //   enterprise (bundle.js:+2963004)
    //   enterprise_usage_based (bundle.js:+2963026)
    return filtered
```

The `anthropic.` prefix check at bundle.js:+2186824 and the `claude-` prefix check at bundle.js:+2186445 are used to classify model IDs during catalogue filtering.

### 6. Settings Persistence and Confirmation Display

Analysis basis: CC v2.1.159 bundle.js:+12357529 – +12357898

```
function applyModelChange(resolvedModel, saveAsDefault):
    // Determine confirmation suffix
    if saveAsDefault:
        suffix = " and saved as your default for new sessions" // bundle.js:+12357540
        persistToSettings(resolvedModel, "userSettings")       // settings.json
        emitTelemetry("model_set_default")                     // bundle.js:+12357898
    else:
        suffix = " for this session only"                      // bundle.js:+12357586

    updateAppState("model", resolvedModel)                     // bundle.js:+12357945

    // Build display annotations
    annotations = []
    if fastModeEnabled(resolvedModel):
        annotations.append(" · Fast mode ON")                  // bundle.js:+12357704
    if drawsFromUsageCredits(resolvedModel):
        annotations.append(" · Draws from usage credits")      // bundle.js:+12357755
    if fastModeOff(resolvedModel):
        annotations.append(" · Fast mode OFF")                 // bundle.js:+12357801

    displayConfirmation(resolvedModel + suffix + annotations)
```

Settings are written to `~/.claude/settings.json` (bundle.js:+1219331, +1219341). A local override can live in `settings.local.json` (bundle.js:+1219403). The full settings hierarchy recognised at this layer is `policySettings`, `flagSettings`, `userSettings`, `projectSettings`, and `localSettings` (bundle.js:+1228177 – +1228961).

Managed-settings notice ("Managed settings", bundle.js:+12358107) is shown when the model choice is overridden by an organisational policy layer.

### 7. Opus model version awareness

Analysis basis: CC v2.1.159 bundle.js:+2179164

The display layer tracks specific Opus release identifiers: `opus-4-6` (bundle.js:+2179164), `opus-4-7` (bundle.js:+2179218), `opus-4-8` (bundle.js:+2179242). The `sonnet-4-6` identifier is similarly tracked (bundle.js:+10846359). These are used to annotate the fast-mode and usage-credit indicators in the confirmation message.

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_model_command_inline` (bundle.js:+12393235) — fired on inline model set path |
| Telemetry | `tengu_api_success` (bundle.js:+13167979) — fired when probe API call succeeds |
| Telemetry | `tengu_feature_ok` (bundle.js:+966033) — fired on general feature success path |
| Telemetry | `tengu_feature_bad` (bundle.js:+966091) — fired on general feature failure path |
| Telemetry (settings) | `model_set_default` (bundle.js:+12357898) — fired when model is persisted as default |
| Telemetry (validation) | `model_switch / not_allowed` (bundle.js:+12356401, +12356416) — fired when model is disallowed for account |
| Telemetry (validation) | `invalid_model` (bundle.js:+12357063) — fired when API probe returns not-found |
| Telemetry (validation) | `validate_exception` (bundle.js:+12357160) — fired on unexpected probe error |
| appState changes | `appState.model` updated to the resolved canonical model string (bundle.js:+12357945) |
| Settings file write | `~/.claude/settings.json` written when save-as-default is chosen (bundle.js:+1219331) |
| API side effect | Ephemeral `"Hi"` probe message sent to target model endpoint (bundle.js:+12354979) |
| Probe cache | Result cached in `ir1` Map keyed by lower-cased model name (bundle.js:+12354815, +12355023) |
| Sound | None detected in depth-2 traversal |
| Hook registration | `spH.emit` called during settings persistence path (bundle.js:+1229395) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.159 | Initial analysis |

---

## Common Mistakes

1. **Passing an empty string** — The handler explicitly rejects empty model names with `"Model name cannot be empty"` (bundle.js:+12354571). Always supply a non-whitespace argument.
2. **Using a 1M-context alias without account entitlement** — `opus[1m]` and `sonnet[1m]` / `sonnet-4-6[1m]` will fail with account-specific errors if the subscription tier does not include extended-context access.
3. **Expecting instant persistence without the save flag** — Without the save-as-default option, the model reverts at the end of the session. The confirmation message explicitly says "for this session only".
4. **Assuming all canonical model IDs are accepted** — The catalogue is filtered by account tier and provider (bedrock, foundry, vertex, mantle, etc.). A model available in one deployment may not appear in another.
5. **Ignoring the `Managed settings` notice** — When an organisation policy enforces a specific model, `/model` will display a managed-settings warning; the change may not take effect.
6. **Reusing a cached probe result after credential rotation** — The probe cache (`ir1`) is in-memory per session. After changing API credentials mid-session, the cached validation result for a model name may be stale.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `m$5` | Main async handler for `/model` command (arbor_handler) |
| `H` | Input string variable / random-delay helper |
| `_` | App-state / utility accessor |
| `xk8` | Model-type resolution dispatcher |
| `YS` | Available-model set builder (top-level) |
| `dM6` | Model list construction helper |
| `NY` | Model entry normalisation helper |
| `A1` | Model alias string processor (trim / toLowerCase / replace chain) |
| `G0` | Model catalogue tier/provider filter |
| `TA` | Tier-check utility (max/team/enterprise) |
| `te` | Tier helper variant |
| `FOH` | Team / default_claude_max_5x tier predicate |
| `OFH` | Enterprise / enterprise_usage_based tier predicate |
| `QG` | Provider-type resolver (firstParty / anthropicAws / gateway) |
| `yP` | Model display-name formatter |
| `nM` | Nested model-name utility |
| `GA` | Provider/channel type classifier |
| `z5` | Sub-provider resolver (bedrock / foundry / mantle / vertex) |
| `mN` | Model-name compound resolver |
| `d` | Low-level feature telemetry emitter |
| `rr1` | Model resolution and display orchestrator |
| `l8A` | `resolveAvailableModels` — available-model list builder |
| `CQ` | `buildModelCatalogue` — catalogue construction with tier/provider filtering |
| `A` | Map callback / model-entry iterator |
| `M` | Trim + cache-set helper in catalogue |
| `K` | Pad-end / map helper for display alignment |
| `q` | Includes / unlink helper |
| `_r6` | Object.entries-based settings reader |
| `fFH` | Model inclusion predicate (Dm4 list check) |
| `MOq` | Model index-of resolver |
| `wm4` | Model includes + alias expander |
| `d1H` | Q1H-list inclusion checker |
| `jm4` | Alias expansion with prefix check |
| `bH` | Low-level data accessor |
| `oM5` | Shorthand alias normaliser — primary path |
| `Xa` | Alias display helper (l1H / TA / vS9) |
| `aM5` | Shorthand alias normaliser — secondary path |
| `DLH` | Alias display helper variant |
| `rM5` | Reserved-list alias normaliser |
| `Ck8` | `expandModelAlias` — full alias expansion + live probe |
| `ku` | `apiProbe` — live model validation API call |
| `nM5` | `formatModelEntry` — model entry string formatter |
| `EH` | String-coercion helper |
| `n8A` | Confirmation display builder |
| `kk6` | Settings-write orchestrator |
| `U_` | Settings persistence writer (policySettings / userSettings / projectSettings) |
| `hH` | Feature result emitter (ok/bad) |
| `xK` | Model name + channel display helper |
| `CH` | String coercion / display primitive |
| `pOH` | Confirmation prefix builder |
| `vY` | Fast-mode / usage-credits annotation builder |
| `ri` | Channel-type display helper |
| `bPH` | Sonnet-specific annotation helper |
| `WX` | Model+provider compound display helper |
| `T0` | l1H-based display token |
| `i8A` | Managed-settings / dim+bold display helper |
| `sGH` | AV / y8 settings layer compositor |
| `y8` | yg6 / MQ settings writer |
| `ob` | Path join helper (.claude / settings.json) |
| `oi` | d1H / NY / A1 compound alias resolver |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.