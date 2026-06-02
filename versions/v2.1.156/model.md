---
type: feature-spec
feature: "model"
cc_version: "2.1.156"
updated: "2026-06-02"
tags: ["model", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.156 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/model`

> Analysis basis: CC v2.1.156 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.156

---

## Overview

The `/model` command allows users to switch the active AI model used by Claude Code mid-session. It accepts a model name or alias as its argument, validates it against the user's account permissions and available models, optionally performs a live API validation probe, and then updates either the session-only or persistent default model setting. The command surfaces rich status annotations (fast mode, credit draw) and emits structured telemetry for inline model selection events.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `model` |
| description | Set the AI model for Claude Code |
| argumentHint | `<model>` |
| supportsNonInteractive | `true` |
| module_id | `Lr1` |
| load_inline | `true` |
| loc_byte | `12385765` |
| loc_byte_end | `12385939` |
| loc_line | `9244` |
| arbor_handler.name | `TM5` |
| arbor_handler.fqn | `claude-2.1.156::TM5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.156 bundle.js:+12385765

---

## Input Branching

The handler has four or more distinct input paths (empty input, alias resolution, permission gate, 1M-context availability, live validation, save-vs-session decision), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/model <arg>]) --> B{arg present\nand non-empty?}
    B -- No --> ERR1["Error: 'Model name cannot be empty'"]
    B -- Yes --> C[Trim & normalise arg]
    C --> D{Arg matches\nknown alias?}
    D -- "sonnet / haiku / opus / best\nopusplan / sonnet[1m] / sonnet-4-6[1m]" --> E[Resolve to canonical model ID]
    D -- No match --> F[Use arg as literal model ID]
    E & F --> G{Model in\npermitted list?\ntU6.includes / S3H.includes}
    G -- No --> ERR2["Error: model_switch / not_allowed"]
    G -- Yes --> H{Requires 1M context?}
    H -- "opus[1m]" --> I{Account supports\nOpus 1M?}
    I -- No --> ERR3["opus_1m_unavailable:\nhttps://code.claude.com/docs/…"]
    H -- "sonnet[1m] / sonnet-4-6[1m]" --> J{Account supports\nSonnet 1M?}
    J -- No --> ERR4["sonnet_1m_unavailable:\nhttps://code.claude.com/docs/…"]
    I -- Yes & J -- Yes --> K{Already validated\nin cache? zi1.has}
    K -- Yes --> L[Skip live probe]
    K -- No --> M[Live API probe\n'model_validation' via zu]
    M --> N{HTTP result}
    N -- "not_found_error" --> ERR5["invalid_model"]
    N -- Auth fail --> ERR6["Authentication failed…"]
    N -- Network fail --> ERR7["Network error…"]
    N -- Success --> O[Store result in\nvalidation cache zi1.set]
    L & O --> P{Non-interactive\nor no save prompt?}
    P -- Non-interactive / inline --> Q["Emit tengu_model_command_inline\nSet session model only\n'for this session only'"]
    P -- Interactive --> R{User confirms\nsave as default?}
    R -- Yes --> S["Persist to userSettings\n'and saved as your default for new sessions'\nEmit model_set_default"]
    R -- No --> Q
    Q & S --> T[Display model name\n+ status annotations\n'Fast mode ON/OFF'\n'Draws from usage credits']
    T --> Z([Done])
```

---

## Behavioral Spec

### 1. Entry Point — Handler `TM5` (async)

Analysis basis: CC v2.1.156 bundle.js:+12377372

```
async function handleModelCommand(context, rawArg):
    trimmedArg = rawArg.trim()                        // +12377372

    if trimmedArg is empty:
        return error("Model name cannot be empty")    // +12338535

    resolvedModel = resolveAlias(trimmedArg)          // calls aliasResolution

    if not isInPermittedSet(resolvedModel):           // tU6.includes / S3H.includes +12377388 +12377475
        return error(not_allowed)                     // +12340380

    check1MContextAvailability(resolvedModel)         // may raise opus_1m_unavailable / sonnet_1m_unavailable

    appState = getAppState()                          // +12377411

    validatedModel = validateModel(resolvedModel, appState)   // calls liveValidation (ik8 → lk8)

    displayResult = buildDisplayBlock(validatedModel, appState)  // calls displayBuilder (Yi1 → i6A)

    emit("tengu_model_command_inline", ...)           // +12377530

    return displayResult
```

### 2. Alias Resolution — `resolveAlias` (derived from `e9`, `WQ` paths)

Analysis basis: CC v2.1.156 bundle.js:+2189788

Known aliases resolved at runtime (all compared case-insensitively after `.toLowerCase()`):

| Alias | Meaning |
|---|---|
| `sonnet` | Maps to current Sonnet canonical ID |
| `haiku` | Maps to current Haiku canonical ID |
| `opus` | Maps to current Opus canonical ID |
| `best` | Maps to highest-capability available model |
| `opusplan` | Opus in plan mode, else Sonnet (bundle.js:+2188414) |
| `sonnet[1m]` | Sonnet with 1M extended context (bundle.js:+12342399) |
| `sonnet-4-6[1m]` | Sonnet 4.6 with 1M extended context (bundle.js:+12342425) |

```
function resolveAlias(input):
    normalised = input.trim().toLowerCase()
    match normalised:
        case "sonnet"       → return canonicalSonnet
        case "haiku"        → return canonicalHaiku
        case "opus"         → return canonicalOpus
        case "best"         → return bestAvailableModel
        case "opusplan"     → return opusPlanModel
        case "sonnet[1m]"   → return sonnetWith1MContext
        case "sonnet-4-6[1m]" → return sonnet46With1MContext
        default             → return input   // treat as literal model ID
```

Strings starting with `"anthropic."` or `"claude-"` pass a prefix check before alias lookup (bundle.js:+2183859, +2183480).

### 3. Permission Gate — `isInPermittedSet`

Analysis basis: CC v2.1.156 bundle.js:+12377388

The handler calls `.includes()` on two permission sets (`tU6` and `S3H`). The permitted set is derived from the active account plan tier. Recognised plan tiers found in literals:

| Tier key | Value |
|---|---|
| `max` | Claude Max plan (bundle.js:+2963047) |
| `team` | Team plan (bundle.js:+2963118) |
| `default_claude_max_5x` | Max 5× usage tier (bundle.js:+2963133) |
| `enterprise` | Enterprise plan (bundle.js:+2963228) |
| `enterprise_usage_based` | Enterprise usage-based (bundle.js:+2963250) |

Provider contexts where model availability is further filtered:

| Provider key | bundle.js offset |
|---|---|
| `firstParty` | +2186098 |
| `anthropicAws` | +2045012 |
| `gateway` | +2045032 |
| `bedrock` | +2044343 |
| `foundry` | +2044393 |
| `mantle` | +2044503 |
| `vertex` | +2044551 |

### 4. Extended-Context (1M) Availability Check

Analysis basis: CC v2.1.156 bundle.js:+12340527, +12340744

```
function check1MContextAvailability(resolvedModel):
    if resolvedModel requires Opus 1M context:
        if not accountSupportsOpus1M():
            raise error(
                code    = "opus_1m_unavailable",
                message = "Opus with 1M context is not available for your account. " +
                          "Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m"
            )
    if resolvedModel requires Sonnet 1M context:
        if not accountSupportsSonnet1M():
            raise error(
                code    = "sonnet_1m_unavailable",
                message = "Sonnet 4.6 with 1M context is not available for your account. " +
                          "Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m"
            )
```

### 5. Live Model Validation — `liveModelValidator` (`lk8`)

Analysis basis: CC v2.1.156 bundle.js:+12338498

```
async function liveModelValidator(modelId, cache):
    modelId = modelId.trim()                       // +12338498
    if modelId is empty:
        raise "Model name cannot be empty"         // +12338535

    resolvedAlias = resolveAlias(modelId)          // +12338569

    normalised = resolvedAlias.toLowerCase()       // +12338658

    if normalised is in disabledModelList:         // I1H.includes +12338677
        raise appropriate error

    if cache.has(normalised):                      // zi1.has +12338779
        return cached result

    // Live API probe via apiClient (zu)
    response = await apiProbe(                     // +12338824
        query    = "Hi",                           // +12338943
        role     = "user",                         // +12338909
        cacheCtl = "ephemeral",                    // +12338968
        event    = "model_validation"              // +12338874
    )

    on AuthError:
        raise "Authentication failed. Please check your API credentials."  // +12339234
    on NetworkError:
        raise "Network error. Please check your internet connection."       // +12339336
    on response.type == "not_found_error":
        raise error containing "model:" + modelId  // +12339537

    cache.set(normalised, result)                  // zi1.set +12338987
    return result
```

The API probe (`zu`) uses `globalThis.fetch` (bundle.js:+13150362), caps max tokens at 1024 (bundle.js:+13150125), uses query type `"side_query"` (bundle.js:+13150309), and records `tengu_api_success` on completion (bundle.js:+13151760).

### 6. Display Builder — `displayBuilder` (`i6A`)

Analysis basis: CC v2.1.156 bundle.js:+12341357

```
function buildDisplayBlock(validatedModel, appState):
    lines = []

    // Model name line (bold)
    nameLine = bold(validatedModel.displayName)     // j6.bold +12341485

    // Annotate for "opus-4-6", "opus-4-7", "opus-4-8" variants
    if modelIsOpusVariant(validatedModel):          // WY +12341605; literals +2176205 +2176259 +2176283
        // Check fast mode state
        if fastModeEnabled(appState):               // Ii / q.includes +2176194
            nameLine += " · Fast mode ON"           // +12341668
        else:
            nameLine += " · Fast mode OFF"          // +12341765

    // Credit draw annotation
    if modelDrawsFromUsageCredits(validatedModel):  // JPH +12341697; sonnet-4-6 +10834412
        nameLine += " · Draws from usage credits"  // +12341719

    lines.append(nameLine)

    // Save-as-default section (r6A)
    saveInfo = buildSaveBlock(validatedModel, appState)  // r6A +12341797
    lines.append(saveInfo)

    return lines
```

### 7. Save-as-Default Logic — `buildSaveBlock` (`r6A`)

Analysis basis: CC v2.1.156 bundle.js:+12341905

```
function buildSaveBlock(validatedModel, appState):
    settingsPath = resolveSettingsPath()      // pGH → h8 → hb; paths .claude/settings.json +1218079+1218089
    managedLabel = "Managed settings"        // +12342071 shown when policy controls the value

    if modelIsSaved(appState):               // model_set_default +12341862
        suffix = " and saved as your default for new sessions"  // +12341504
        emit("model_set_default")
    else:
        suffix = " for this session only"    // +12341550

    return dim("Model: " + validatedModel.id + suffix)
```

The resolved settings file paths observed in literals:
- `.claude/settings.json` (user settings, bundle.js:+1218079, +1218089)
- `.claude/settings.local.json` (local project settings, bundle.js:+1218151)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_model_command_inline` | Fired on every inline (non-interactive / non-save) model switch (bundle.js:+12377530) |
| Telemetry: `tengu_api_success` | Fired after a successful live model-validation API probe (bundle.js:+13151760) |
| Telemetry: `tengu_feature_ok` | Fired on general feature success path inside the validation helper (bundle.js:+965176) |
| Telemetry: `tengu_feature_bad` | Fired on failure/error path inside the validation helper (bundle.js:+965234) |
| Validation cache (`zi1`) | `Map` keyed by normalised model ID. `zi1.has` avoids repeat probes; `zi1.set` stores result (bundle.js:+12338779, +12338987) |
| appState changes | Active model updated in app state via `_.getAppState()` (bundle.js:+12377411); persisted to `userSettings` when user confirms save (bundle.js:+1227571) |
| Settings files written | `.claude/settings.json` or `.claude/settings.local.json` when user opts to save as default |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.156 | Initial analysis |

---

## Common Mistakes

1. **Passing a model ID that has a whitespace prefix or suffix** — the handler trims the argument, but an empty string after trimming raises `"Model name cannot be empty"` immediately (bundle.js:+12338535). Always supply a non-empty, trimmed token.
2. **Using a 1M-context alias on an unsupported account** — `sonnet[1m]`, `sonnet-4-6[1m]`, and opus 1M variants will be rejected with a clear message and a documentation URL; the user must upgrade their plan first.
3. **Expecting the model to persist across sessions without confirmation** — unless the user explicitly confirms the save prompt (interactive mode) or runs in a context that persists the setting, the switch is session-only. The suffix text `" for this session only"` (bundle.js:+12341550) indicates no file was written.
4. **Assuming all model aliases work on all providers** — the permission gate is provider-aware (`bedrock`, `vertex`, `mantle`, `gateway`, etc.); an alias valid on Anthropic first-party may be rejected on a Bedrock or Vertex deployment.
5. **Treating the validation cache as persistent** — `zi1` is an in-process `Map`; restarting Claude Code clears it, causing the live API probe to re-fire on the next `/model` invocation.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `TM5` | Main async handler for `/model` command (arbor_handler) |
| `H` | Utility / string helper (trim, random delay) |
| `_` | App-state accessor / string utilities |
| `ik8` | Model validation orchestrator (wraps `th` and cache logic) |
| `th` | Model list builder (calls `WM6` + `w0`) |
| `WM6` | Model entry constructor (calls `GY`, `e9`) |
| `GY` | Model group/category helper |
| `e9` | Alias-to-canonical-model resolver |
| `w0` | Available-model-list builder (aggregates provider-aware entries) |
| `EA` | Model entry factory (plan-tier aware) |
| `pe` | Max-plan model filter |
| `ZOH` | Team-plan / Max-5× model filter |
| `BBH` | Enterprise model filter |
| `EZ` | Model metadata lookup helper |
| `vP` | Model list aggregator (calls `EA`, `K1`) |
| `Bf` | Model capability descriptor |
| `GA` | Provider-type resolver |
| `M5` | Model spec builder (calls `JxH`, `GR4`, `GA`) |
| `hN` | Model display-name helper |
| `d` | Logger / diagnostic emitter |
| `Yi1` | Display block orchestrator (calls `n6A`, `i6A`) |
| `n6A` | Validation + availability-check coordinator |
| `WQ` | Alias lookup table / model list query |
| `A` | Alias array / model name collection |
| `M` | MCP model registry accessor |
| `K` | Model name column formatter (padEnd 40) |
| `q` | File/cache utility (includes unlinkSync) |
| `Ti6` | Object-entries model iterator |
| `mBH` | Exclusion-list membership checker |
| `K$q` | Alias index-of helper |
| `sx4` | String-includes alias matcher |
| `y1H` | Disabled-model-list checker |
| `tx4` | Prefix-based alias matcher (`claude-`, `startsWith`) |
| `uH` | Diagnostic feature-flag helper |
| `bf5` | Sonnet-1M availability checker |
| `to` | Model probe request builder |
| `xf5` | Sonnet-4-6-1M availability checker |
| `s7H` | Alternate probe request builder |
| `Cf5` | Opus-1M availability checker |
| `lk8` | Live model validation (API probe + cache) |
| `zu` | Core API fetch client |
| `Sf5` | Validation result formatter |
| `ZH` | String coercion utility |
| `i6A` | Display block builder (name + annotations) |
| `ik6` | Settings persistence helper (calls `U_`) |
| `U_` | Settings file read/write (policySettings, userSettings, projectSettings) |
| `yH` | Feature telemetry wrapper |
| `RK` | Rich-text renderer (GA + xH) |
| `xH` | String renderer / ANSI wrapper |
| `WOH` | Session-model setter |
| `WY` | Opus-variant annotator (fast mode) |
| `Ii` | Fast-mode state reader |
| `JPH` | Credit-draw annotator (sonnet-4-6 check) |
| `$X` | Combined model display helper |
| `j0` | Prompt formatter |
| `r6A` | Save-as-default display block builder |
| `pGH` | Settings path resolver (tE + h8) |
| `h8` | File existence / read helper |
| `hb` | Path joiner (.claude/settings.json) |
| `yi` | Status row composer (y1H + GY + e9) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.