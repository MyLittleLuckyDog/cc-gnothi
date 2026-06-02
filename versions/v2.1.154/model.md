---
type: feature-spec
feature: "model"
cc_version: "2.1.154"
updated: "2026-06-02"
tags: ["model", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.154 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/model`

> Analysis basis: CC v2.1.154 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.154

---

## Overview

The `/model` command allows users to switch the active AI model used by Claude Code within an interactive session. It accepts a model name argument (or an alias such as `sonnet`, `haiku`, `opus`, `best`, or `opusplan`), validates the model against the user's account entitlements, and—after an optional live validation call—updates the app state and optionally persists the choice as the user default.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `model` |
| description | `Set the AI model for Claude Code` |
| argumentHint | `<model>` |
| supportsNonInteractive | `true` |
| module_id | `Lr1` |
| load_inline | `true` |
| loc_byte | `12385504` |
| loc_byte_end | `12385678` |
| loc_line | `9244` |
| arbor_handler.name | `TM5` |
| arbor_handler.fqn | `claude-2.1.154::TM5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.154 bundle.js:+12385504

---

## Input Branching

The handler has more than three distinct branches depending on: whether input is empty, whether it is a known alias, whether extended-context variants are requested, account entitlement checks, live API validation, and save-as-default logic.

```mermaid
flowchart TD
    A(["/model [arg]"]) --> B{arg present\nafter trim?}
    B -- No --> C[Display available models list\nand return]
    B -- Yes --> D{arg in known\nalias list?\nsonnet/haiku/opus/best/opusplan}
    D -- Yes --> E[Resolve alias to full model ID]
    D -- No --> F[Use raw model string]
    E --> G{1M context\nvariant requested?\neg 'sonnet\[1m\]' / 'opus\[1m\]'}
    F --> G
    G -- opus\[1m\] --> H{Account allows\nOpus 1M?}
    G -- sonnet\[1m\] --> I{Account allows\nSonnet 1M?}
    G -- No --> J[Proceed with base model ID]
    H -- No --> K[Emit 'opus_1m_unavailable' error\nwith docs URL]
    H -- Yes --> J
    I -- No --> L[Emit 'sonnet_1m_unavailable' error\nwith docs URL]
    I -- Yes --> J
    J --> M{Model already in\nvalidated cache?}
    M -- Yes --> N[Skip live API call]
    M -- No --> O[Live API validation:\nsend ephemeral 'Hi' message\nwith 'model_validation' tag]
    O --> P{API response}
    P -- Auth error --> Q[Return auth failure message]
    P -- Network error --> R[Return network error message]
    P -- not_found_error --> S[Return 'invalid_model' error]
    P -- Other exception --> T[Return 'validate_exception' error]
    P -- Success --> U[Store model in validated cache]
    N --> V[Update appState model]
    U --> V
    V --> W{Non-interactive\nmode?}
    W -- Yes --> X[Emit tengu_model_command_inline\nand return silently]
    W -- No --> Y[Display confirmation UI:\nmodel name, plan mode status,\nfast mode, usage credits info]
    Y --> Z{Save as default?}
    Z -- Yes --> AA[Persist model to userSettings\nvia settings writer]
    Z -- No --> AB[Session-only change]
    AA --> AC([Done])
    AB --> AC
```

---

## Behavioral Spec

### Main Handler — modelCommandHandler (TM5)

```
async function modelCommandHandler(args, context):
    rawInput = args.trim()                          // bundle.js:+12377111

    if rawInput is empty:
        displayModelList(context)
        return

    if rawInput in knownAliasList:                  // bundle.js:+12377127
        resolvedModel = resolveAlias(rawInput)
    else:
        resolvedModel = rawInput

    result = await resolveAndValidateModel(resolvedModel, context)

    if result.error:
        return result.error

    if context.nonInteractive:                      // bundle.js:+12377267
        emitTelemetry("tengu_model_command_inline") // bundle.js:+12377269
        applyModelToAppState(result.modelId)
        return

    displayModelConfirmation(result, context)       // bundle.js:+12377334
```

Analysis basis: CC v2.1.154 bundle.js:+12377111

---

### Alias Resolution — resolveModelAlias (vP, e9)

The command maintains a fixed set of short aliases mapping to canonical model IDs:

| Alias | Resolved Meaning |
|---|---|
| `sonnet` | Latest Sonnet model |
| `haiku` | Latest Haiku model |
| `opus` | Latest Opus model |
| `best` | Highest-capability model available |
| `opusplan` | Opus in plan mode, else Sonnet (bundle.js:+2188414) |

Extended-context variants are indicated by appending `[1m]` to the alias, e.g. `sonnet[1m]` (bundle.js:+12342138) or `sonnet-4-6[1m]` (bundle.js:+12342164).

```
function resolveAlias(aliasString):
    base = aliasString.toLowerCase().trim()

    if base ends with "[1m]":
        extendedContext = true
        base = base without "[1m]" suffix
    else:
        extendedContext = false

    canonicalId = lookupAliasTable(base)   // sonnet/haiku/opus/best/opusplan

    if extendedContext:
        return canonicalId + "[1m]"
    return canonicalId
```

Analysis basis: CC v2.1.154 bundle.js:+2189925 (sonnet), +2189964 (haiku), +2190003 (opus), +2190040 (best), +2188397 (opusplan)

---

### Entitlement Guard for 1M Context (bf5, xf5, Cf5)

Before issuing a live validation call, the handler checks whether the account subscription tier permits the extended-context variant.

```
function checkExtendedContextEntitlement(modelVariant, accountTier):
    if modelVariant is "opus[1m]":
        if accountTier does not permit Opus 1M:
            return error(
                code = "opus_1m_unavailable",
                message = "Opus with 1M context is not available..." // bundle.js:+12340304
            )

    if modelVariant is "sonnet[1m]" or "sonnet-4-6[1m]":
        if accountTier does not permit Sonnet 1M:
            return error(
                code = "sonnet_1m_unavailable",
                message = "Sonnet 4.6 with 1M context is not available..." // bundle.js:+12340523
            )

    return ok
```

Account tier identifiers observed in the call graph include `max` (bundle.js:+2963047), `team` (bundle.js:+2963118), `default_claude_max_5x` (bundle.js:+2963133), `enterprise` (bundle.js:+2963228), and `enterprise_usage_based` (bundle.js:+2963250).

Analysis basis: CC v2.1.154 bundle.js:+12340266, +12340483

---

### Live Model Validation (lk8 → zu)

Once entitlements pass, the handler checks a per-session cache (`zi1`) to avoid redundant API calls. On a cache miss it performs a minimal API round-trip.

```
async function validateModelWithApi(modelId, cache):
    if cache.has(modelId):                              // bundle.js:+12338518
        return ok

    if modelId is empty:
        return error("Model name cannot be empty")      // bundle.js:+12338274

    normalizedId = modelId.toLowerCase()                // bundle.js:+12338397

    response = await apiSideQuery({                     // bundle.js:+13150048
        model: normalizedId,
        messages: [{ role: "user", content: "Hi" }],   // bundle.js:+12338682
        max_tokens: 1024,                               // bundle.js:+13149864
        system: [{ type: "text",                        // bundle.js:+12377178
                   cache_control: "ephemeral" }],       // bundle.js:+12338707
        metadata: { tag: "model_validation" }           // bundle.js:+12338613
    })

    if response is auth error:
        return error("Authentication failed...")        // bundle.js:+12338973

    if response is network error:
        return error("Network error...")                // bundle.js:+12339075

    if response.type == "not_found_error":              // bundle.js:+12339194
        return error(code="invalid_model")              // bundle.js:+12340766

    if response is unexpected exception:
        return error(code="validate_exception")         // bundle.js:+12340863

    cache.set(modelId, true)                            // bundle.js:+12338726
    emitTelemetry("tengu_api_success")
    return ok
```

Analysis basis: CC v2.1.154 bundle.js:+12338563

---

### Model List Display (n6A → WQ)

When no argument is provided, the handler renders all available models using the model catalogue (resolveModelList / WQ).

```
function displayModelList(context):
    models = fetchAvailableModelList()
    for each model in models:
        line = model.id.padEnd(40)                  // bundle.js:+15504339
        + "  "                                      // bundle.js:+15502368
        + model.description
        if model.id.startsWith("anthropic."):       // bundle.js:+2183859
            line = annotateAnthropicFirst(line)
        if model.id.startsWith("claude-"):          // bundle.js:+2183480
            line = annotateClaude(line)
        output(line)
```

Analysis basis: CC v2.1.154 bundle.js:+12340088

---

### Confirmation UI and Default-Save (i6A → r6A)

After successful validation in interactive mode the user sees a confirmation screen.

```
function displayModelConfirmation(result, context):
    label = bold(result.modelId)

    annotations = []
    if result.fastModeOn:
        annotations.append(" · Fast mode ON")      // bundle.js:+12341407
    if result.usesUsageCredits:
        annotations.append(" · Draws from usage credits") // bundle.js:+12341458
    if result.fastModeOff:
        annotations.append(" · Fast mode OFF")     // bundle.js:+12341504

    display(label + join(annotations))

    saveAsDefault = promptUser("Save as default?")
    if saveAsDefault:
        writeToUserSettings("model", result.modelId)     // bundle.js:+12341648
        emitTelemetry("model_set_default")               // bundle.js:+12341601
        display(" and saved as your default for new sessions") // bundle.js:+12341243
        display("Managed settings · " + settingsPath)   // bundle.js:+12341810
    else:
        display(" for this session only")                // bundle.js:+12341289
```

Analysis basis: CC v2.1.154 bundle.js:+12341048

---

### Settings Persistence (settingsWriter / U_)

When the user confirms "save as default", the model key is written to `userSettings` inside the `.claude/settings.json` file.

```
function writeToUserSettings(key, value):
    settingsPath = join(home, ".claude", "settings.json") // bundle.js:+1218071, +1218079, +1218089
    currentSettings = readJsonFile(settingsPath, encoding="utf-8") // bundle.js:+1227623
    currentSettings[key] = value
    writeJsonFile(settingsPath, currentSettings)
    emitEvent("kpH.emit", { type: "userSettings",          // bundle.js:+1227571
                             change: key })
```

Project-level overrides live in `.claude/settings.local.json` (bundle.js:+1218151). Policy settings and flag settings are also consulted (bundle.js:+1226925, +1226947) but are read-only from the command's perspective.

Analysis basis: CC v2.1.154 bundle.js:+1227037

---

### Model Availability by Provider (GA / xH)

The provider routing layer maps model IDs to backend providers:

| Provider token | Meaning |
|---|---|
| `bedrock` | AWS Bedrock endpoint (bundle.js:+2044343) |
| `foundry` | Azure AI Foundry (bundle.js:+2044393) |
| `mantle` | Internal Mantle routing (bundle.js:+2044503) |
| `vertex` | Google Vertex AI (bundle.js:+2044551) |
| `anthropicAws` | Anthropic-on-AWS (bundle.js:+2045012) |
| `gateway` | Anthropic API gateway (bundle.js:+2045032) |
| `firstParty` | Direct first-party API (bundle.js:+2186098) |

Analysis basis: CC v2.1.154 bundle.js:+2044303

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_model_command_inline` (bundle.js:+12377269) — fired in non-interactive mode after successful switch |
| Telemetry | `tengu_api_success` (bundle.js:+13151499) — fired after a successful live model validation API call |
| Telemetry | `tengu_feature_ok` (bundle.js:+965176) — general feature success signal emitted by shared feature wrapper |
| Telemetry | `tengu_feature_bad` (bundle.js:+965234) — general feature failure signal emitted by shared feature wrapper |
| Validation cache | Per-session `zi1` Map updated (`set`) after first successful validation of a model ID (bundle.js:+12338726) |
| appState changes | Active model ID updated via `_.getAppState` accessor (bundle.js:+12377150) after validation succeeds |
| Settings write | `userSettings` → `.claude/settings.json` `model` key updated when user elects to save as default (bundle.js:+12341648) |
| Sound | None observed in depth-2 traversal |
| Hook registration | `kpH.emit` settings-change event emitted after userSettings write (bundle.js:+1228143) |
| API side-query | Minimal `"Hi"` message sent with `max_tokens=1024`, ephemeral cache control, tag `"model_validation"` (bundle.js:+12338563) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.154 | Initial analysis |

---

## Common Mistakes

1. **Passing a model alias without knowing the resolved name** — aliases like `best` and `opusplan` resolve at runtime based on available models and account tier; the displayed model name after switching may differ from the alias typed.
2. **Expecting 1M context without entitlement** — appending `[1m]` to a model name (e.g. `opus[1m]`) triggers an account-entitlement check before any API call; accounts without the `max`, `team`, or `enterprise` tier will receive an `opus_1m_unavailable` or `sonnet_1m_unavailable` error with a documentation URL.
3. **Assuming the switch is persistent by default** — unless the user explicitly confirms "save as default" in the interactive prompt, the model change applies to the current session only (bundle.js:+12341289).
4. **Using `/model` in non-interactive pipelines expecting output** — in non-interactive mode the command switches the model silently; it emits `tengu_model_command_inline` telemetry but produces no human-readable confirmation text.
5. **Empty argument** — `/model ` (with only whitespace) is treated as no argument after `trim()` and causes the model list to be displayed rather than an error (bundle.js:+12338274 guards downstream; empty-after-trim re-routes to list display at bundle.js:+12377111).
6. **Provider-specific model IDs** — when using Bedrock, Vertex, Foundry, or other non-first-party providers, model ID format requirements differ; the live validation call may return `not_found_error` for IDs that are valid in another provider context.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `TM5` | Main async handler for `/model` command (modelCommandHandler) |
| `H` | Input string / generic local variable (used for trim, random-delay helper) |
| `_` | App state accessor / generic context object |
| `ik8` | Model-application helper; applies resolved model to app state and returns output type |
| `th` | Model catalogue builder; assembles list of available models with metadata |
| `WM6` | Model catalogue entry constructor |
| `GY` | Model display-name formatter |
| `e9` | Single model entry builder / alias expander |
| `w0` | Available-models list assembler |
| `EA` | Tier/plan resolver (maps account plan to capability set) |
| `pe` | Plan-type checker (`max` tier) |
| `ZOH` | Plan-type checker (`team` / `default_claude_max_5x` tier) |
| `BBH` | Plan-type checker (`enterprise` / `enterprise_usage_based` tier) |
| `EZ` | Provider resolver (maps model ID to backend provider token) |
| `vP` | Alias-to-canonical-model mapper |
| `Bf` | Model feature-flag reader |
| `GA` | Provider kind classifier (bedrock / foundry / mantle / vertex / etc.) |
| `M5` | Extended provider metadata resolver |
| `hN` | Model availability filter |
| `c` | Shared error/result constructor |
| `Yi1` | Interactive model-selection flow orchestrator |
| `n6A` | Model resolution and entitlement-guard pipeline |
| `WQ` | Model list renderer (formats and pads model IDs for display) |
| `A` | Model array / iteration variable |
| `M` | MCP/dynamic model source accessor |
| `K` | Padded model-name formatter |
| `q` | Filtered model array / fs unlink reference (separate call site) |
| `Ti6` | Model metadata entries iterator |
| `mBH` | Alias inclusion checker |
| `K$q` | Alias index-of locator |
| `sx4` | Model alias search helper |
| `y1H` | Model-ID prefix/inclusion tester |
| `tx4` | Claude-prefixed model handler |
| `uH` | Error wrapper / telemetry emitter (tengu_feature_bad) |
| `bf5` | Opus-1M entitlement checker |
| `to` | Capability query helper |
| `xf5` | Sonnet-1M entitlement checker |
| `s7H` | Capability query helper (Sonnet path) |
| `Cf5` | Extended-context inclusion checker |
| `lk8` | Live API model-validation orchestrator |
| `zu` | API side-query executor (fetches with globalThis.fetch, handles streaming) |
| `Sf5` | Validation response parser / error classifier |
| `ZH` | String coercion utility |
| `i6A` | Confirmation UI renderer (model name, annotations, default-save prompt) |
| `ik6` | Settings-write trigger |
| `U_` | Settings file writer (reads/writes userSettings, projectSettings, localSettings) |
| `yH` | Feature success/failure telemetry emitter |
| `RK` | Model display label builder |
| `xH` | String conversion utility |
| `WOH` | UI layout helper for model confirmation screen |
| `WY` | Fast-mode / opus-version annotation builder |
| `Ii` | Inline string formatter |
| `JPH` | Usage-credits annotation builder |
| `$X` | Model row builder combining provider and plan info |
| `j0` | Subscription/tier label provider |
| `r6A` | Post-confirmation default-save handler |
| `pGH` | Settings path resolver |
| `h8` | Settings file reader |
| `hb` | Settings file path joiner (.claude/settings.json) |
| `yi` | Opus-plan display label builder ("Opus Plan") |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.