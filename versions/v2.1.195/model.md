---
type: feature-spec
feature: "model"
cc_version: "2.1.195"
updated: "2026-06-27"
tags: ["model", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.195 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/model`

> Analysis basis: CC v2.1.195 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.195

---

## Overview

The `/model` command allows users to view or change the AI model used by Claude Code for the current session or persistently. When called with an argument, it validates the requested model name against a known set of aliases and full model identifiers, checks entitlements and organizational policies, optionally performs a live probe against the API, and then updates application state; when called without an argument, it displays the current model selection along with an interactive picker.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `model` |
| description | Set the AI model for Claude Code |
| argumentHint | `<model>` |
| supportsNonInteractive | `true` |
| module_id | `GXl` |
| load_inline | `true` |
| loc_byte | 13021725 |
| loc_byte_end | 13021899 |
| loc_line | 8933 |
| arbor_handler.name | `vqf` |
| arbor_handler.fqn | `claude-2.1.195::vqf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | 0 |

Analysis basis: CC v2.1.195 bundle.js:+13021725

---

## Input Branching

The command has six or more distinct execution branches depending on argument presence, model alias resolution, entitlement state, Fable consent state, org policy, and interactive vs. non-interactive context.

```mermaid
flowchart TD
    A["/model [arg]"] --> B{Argument provided?}
    B -- No --> C[Display current model + interactive picker\nbundle.js:+11501047]
    B -- Yes --> D[Trim & normalize input\nbundle.js:+12984381]
    D --> E{Input is empty after trim?}
    E -- Yes --> ERR1["Error: 'Model name cannot be empty'\nbundle.js:+9190615"]
    E -- No --> F{Alias lookup: short name?\ne.g. sonnet, opus, haiku, best, fable, opusplan, sonnet[1m]}
    F -- Known alias --> G[Resolve to canonical model ID\nbundle.js:+12984397]
    F -- Unknown / full ID --> H[Pass through as-is]
    G --> I[Check known model list\nbundle.js:+12984397]
    H --> I
    I --> J{Model in known list OR starts with 'claude-'?}
    J -- No --> ERR2[Return error: unrecognized model]
    J -- Yes --> K{Is 'fable' / 'claude-fable-5'?}
    K -- Yes & non-interactive --> ERR3["noninteractive_set_blocked: consent required\nbundle.js:+12984711"]
    K -- Yes & interactive --> L{Fable consent already given?}
    L -- No --> M[Show consent dialog\nbundle.js:+12984689]
    M -- Declined --> ERR4[Abort]
    M -- Accepted --> N[Proceed]
    L -- Yes --> N
    K -- No --> N
    N --> O{Org policy allows model?}
    O -- No --> ERR5["disabled_by_org\nbundle.js:+11498632"]
    O -- Yes --> P{Entitlement check: extended-context (1M) requested?}
    P -- Opus 1M & unavailable --> ERR6["opus_1m_unavailable\nbundle.js:+11498147"]
    P -- Sonnet 1M & unavailable --> ERR7["sonnet_1m_unavailable\nbundle.js:+11498364"]
    P -- OK --> Q[API probe / model validation\nbundle.js:+9190979]
    Q --> R{API response}
    R -- not_found_error --> ERR8["invalid_model\nbundle.js:+11499178"]
    R -- Auth failure --> ERR9["Authentication failed\nbundle.js:+9191351"]
    R -- Network error --> ERR10["Network error\nbundle.js:+9191453"]
    R -- Success --> S{Save as default?}
    S -- Yes, default session --> T["Update userSettings model + emit 'model_set_default'\nbundle.js:+11499890"]
    S -- Session-only --> U["Update appState only\nbundle.js:+12984420"]
    T --> V[Display confirmation + fast-mode indicator]
    U --> V
    V --> Z[Done]
```

---

## Behavioral Spec

### 1. Argument Normalization

Analysis basis: CC v2.1.195 bundle.js:+12984381

```
function normalizeModelInput(rawInput):
    trimmed = rawInput.trim()
    if trimmed is empty:
        raise UserError("Model name cannot be empty")  // bundle.js:+9190615
    normalized = trimmed.toLowerCase()
    return normalized
```

### 2. Alias Resolution

Short aliases are mapped to canonical tier names or full model identifiers.
Analysis basis: CC v2.1.195 bundle.js:+12984397

```
ALIASES = {
    "sonnet"   -> tier alias for latest Sonnet,
    "haiku"    -> tier alias for latest Haiku,
    "opus"     -> tier alias for latest Opus,
    "best"     -> tier alias for highest capability,
    "fable"    -> "claude-fable-5",
    "opusplan" -> "Opus in plan mode, else Sonnet",  // bundle.js:+2315181
    "sonnet[1m]"     -> extended-context Sonnet variant,
    "sonnet-4-6[1m]" -> extended-context Sonnet 4.6 variant,
    "[1m]"           -> extended-context suffix marker,
}

function resolveAlias(normalized):
    if normalized in ALIASES:
        return ALIASES[normalized]
    return normalized  // treat as full model ID or prefix-matched name
```

Known full model IDs observed in literals (bundle.js:+2313356 – +2314357):
`claude-fable-5`, `claude-mythos-5`, `claude-opus-4-8`, `claude-opus-4-7`, `claude-opus-4-6`, `claude-opus-4-5`, `claude-opus-4-1`, `claude-opus-4-0`, `claude-sonnet-4-6`, `claude-sonnet-4-5`, `claude-sonnet-4-0`, `claude-haiku-4-5`, `claude-3-7-sonnet`, `claude-3-5-sonnet`, `claude-3-5-haiku`, `claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku`.

### 3. Known Model Inclusion Check

Analysis basis: CC v2.1.195 bundle.js:+12984397

```
function isKnownModel(resolvedId):
    if resolvedId in KNOWN_MODEL_LIST:
        return true
    if resolvedId.startsWith("claude-"):  // bundle.js:+2306343
        return true
    // also accept application-inference-profile IDs  // bundle.js:+2314493
    return false
```

If the resolved identifier does not match, the command returns an error without touching application state.

### 4. Fable 5 Consent Gate

Analysis basis: CC v2.1.195 bundle.js:+12984689

```
function checkFableConsent(resolvedId, context):
    if resolvedId != "claude-fable-5":
        return PROCEED

    if context.isNonInteractive:
        // telemetry: tengu_model_command_inline
        raise BlockedError(
            "Fable 5 uses usage credits and needs a one-time consent · " +
            "pick Fable from /model in an interactive session to set it up"
        )  // bundle.js:+12984760

    if userSettings.fableConsentGiven:
        return PROCEED

    // Show interactive consent dialog
    consentResult = showFableConsentDialog()
    if consentResult == DECLINED:
        return ABORT
    persistFableConsent()
    return PROCEED
```

### 5. Org Policy / Entitlement Check

Analysis basis: CC v2.1.195 bundle.js:+11498632, +11498147, +11498364, +11498632

```
function checkEntitlements(resolvedId, context):
    orgSettings = context.getAppState().policySettings  // bundle.js:+2297114

    // Org-level disable
    if orgSettings.disabledModels.includes(resolvedId):
        return Error("disabled_by_org")  // bundle.js:+11498632

    // Extended-context gating
    if isOpus1MVariant(resolvedId):
        if not userHasOpus1MEntitlement(context):
            return Error(
                "opus_1m_unavailable",
                "Opus with 1M context is not available for your account. " +
                "Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m"
            )  // bundle.js:+11498147, +11498185

    if isSonnet1MVariant(resolvedId):
        if not userHasSonnet1MEntitlement(context):
            return Error(
                "sonnet_1m_unavailable",
                "Sonnet 4.6 with 1M context is not available for your account. " +
                "Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m"
            )  // bundle.js:+11498364, +11498404

    return OK
```

### 6. Live API Model Validation (Probe)

Analysis basis: CC v2.1.195 bundle.js:+9190979, +9191133

```
async function probeModelValid(resolvedId, context):
    // Cache check: lvo Map keyed by model id  // bundle.js:+9190884
    if validationCache.has(resolvedId):
        return validationCache.get(resolvedId)

    try:
        result = await sendMinimalAPIRequest(resolvedId, context)
        // On success, cache and return OK
        validationCache.set(resolvedId, OK)  // bundle.js:+9191092
        return OK
    catch apiError:
        if apiError.type == "not_found_error":  // bundle.js:+9191572
            return Error("invalid_model")  // bundle.js:+11499178
        if isAuthError(apiError):
            return Error("Authentication failed. Please check your API credentials.")  // +9191351
        if isNetworkError(apiError):
            return Error("Network error. Please check your internet connection.")  // +9191453
        // Other errors (e.g. validate_exception)  // bundle.js:+11499275
        return Error("validate_exception")
```

The probe sends a `"model_validation"` side-query (literal at bundle.js:+9190979) with a minimal `"Hi"` prompt (bundle.js:+9191048) under an `"ephemeral"` cache policy (bundle.js:+9191073).

### 7. Model Name Normalization for Display (Tier Name Map)

Analysis basis: CC v2.1.195 bundle.js:+2315868 – +2316452

```
DISPLAY_NAMES = {
    "claude-fable-5"     -> "Fable 5",
    "claude-mythos-5"    -> "Mythos 5",
    "claude-opus-4-8"    -> "Opus 4.8",
    "claude-opus-4-7"    -> "Opus 4.7",
    "claude-opus-4-6"    -> "Opus 4.6",
    "claude-opus-4-5"    -> "Opus 4.5",
    "claude-opus-4-1"    -> "Opus 4.1",
    "claude-opus-4-0"    -> "Opus 4",
    "claude-sonnet-4-6"  -> "Sonnet 4.6",
    "claude-sonnet-4-5"  -> "Sonnet 4.5",
    "claude-sonnet-4-0"  -> "Sonnet 4",
    "claude-3-7-sonnet"  -> "Sonnet 3.7",
    "claude-3-5-sonnet"  -> "Sonnet 3.5",
    "claude-haiku-4-5"   -> "Haiku 4.5",
    "claude-3-5-haiku"   -> "Haiku 3.5",
    // 1M extended variants append " (1M context)"  // bundle.js:+2315808
}

function getDisplayName(resolvedId, is1M):
    base = DISPLAY_NAMES.get(resolvedId, resolvedId)
    if is1M:
        base += " (1M context)"
    return base
```

### 8. Persistence and State Update

Analysis basis: CC v2.1.195 bundle.js:+11499890, +12984420

```
function applyModelChange(resolvedId, context, saveAsDefault):
    context.getAppState().currentModel = resolvedId  // appState mutation

    if saveAsDefault:
        userSettings.model = resolvedId
        persistUserSettings()
        emitTelemetry("model_set_default")  // bundle.js:+11499890
        confirmationSuffix = " and saved as your default for new sessions"  // +11499532
    else:
        confirmationSuffix = " for this session only"  // +11499578

    displayName = getDisplayName(resolvedId, ...)
    print("Model set to " + displayName + confirmationSuffix)

    // Fast-mode indicator  // bundle.js:+11499696
    if isFastModeModel(resolvedId):
        print(" · Fast mode ON")
        print(" · Draws from usage credits")  // +11499747
    else:
        print(" · Fast mode OFF")  // +11499793
```

### 9. No-Argument / Interactive Picker Path

Analysis basis: CC v2.1.195 bundle.js:+11501047

```
function showModelPicker(context):
    currentModel = context.getAppState().currentModel
    availableModels = buildAvailableModelList(context)
    // Renders interactive list via modelSelectComponent (str / Y1o)
    selected = renderInteractivePicker(availableModels, currentModel)
    if selected != null:
        applyModelChange(selected, context, saveAsDefault=true)
```

The picker displays tier names, fast-mode indicators, and managed-settings labels when applicable (literal `"Managed settings"` at bundle.js:+11500099).

### 10. Bootstrap / Model Discovery

Analysis basis: CC v2.1.195 bundle.js:+8342269 (modelDiscoveryBootstrap via `sAo`/`RDe`)

```
async function bootstrapModelDiscovery(context):
    if CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY not set:
        log("[Bootstrap] Skipped gateway /v1/models ...")  // +8340595
        return

    if nonessentialTrafficDisabled(context):
        log("[Bootstrap] Skipped: Nonessential traffic disabled")  // +8340750
        return

    if isThirdPartyProvider(context):
        log("[Bootstrap] Skipped: 3P provider")  // +8340841
        return

    // Fetch /v1/models with anthropic-version: 2023-06-01  // +8343693, +8343713
    response = await fetchModels(context)
    if cacheUnchanged(response):
        log("[Bootstrap] Cache unchanged, skipping write")  // +8343030
    else:
        log("[Bootstrap] Cache updated, persisting to disk")  // +8343086
        persistModelCache(response)
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_model_command_inline` (bundle.js:+12984531) — fired when `/model` is invoked non-interactively with an inline argument |
| Telemetry | `tengu_feature_ok` / `tengu_feature_sad` / `tengu_feature_bad` (bundle.js:+1027363, +1027511, +1027430) — feature gate outcome events |
| Telemetry | `tengu_api_success` (bundle.js:+8647228) — fired on successful API call during probe |
| Telemetry | `tengu_client_data_cache_key` (bundle.js:+8342719) — bootstrap cache key event |
| Telemetry | `tengu_config_lock_contention`, `tengu_config_stale_write`, `tengu_config_auto_repaired`, `tengu_config_auth_loss_prevented`, `tengu_config_fallback_write` — config persistence safety events (bundle.js:+14069271, +14069407, +14069784, +14070114, +14068887) |
| Telemetry | `tengu_saffron_credits_only_tiers` (bundle.js:+5255082) — fired during entitlement resolution |
| Telemetry | `tengu_prompt_cache_1h_config` (bundle.js:+13816734) |
| Telemetry | `tengu_lone_surrogate_sanitized` (bundle.js:+8646924) — API request sanitization |
| appState changes | `currentModel` field updated on successful model change (bundle.js:+12984420) |
| userSettings changes | `model` field written to persistent config when saving as default (bundle.js:+11499890); protected by file lock (bundle.js:+14069271) |
| Config file locking | Lock-protected write via `saveConfigWithLock`; auto-repair if re-read parse error (bundle.js:+14069656); auth-loss guard (bundle.js:+14069962) |
| API probe side-query | A minimal `"model_validation"` inference request is sent to verify the model ID is accessible under the current credentials (bundle.js:+9190979) |
| Model cache persistence | Bootstrap discovery writes a model cache to disk; protected by hash comparison (bundle.js:+8343030) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.195 | Initial analysis |

---

## Common Mistakes

1. **Using a non-interactive context for Fable 5**: Running `/model fable` in a script or `--print` mode will always be blocked with `noninteractive_set_blocked`. Fable 5 consent can only be granted in an interactive session.
2. **Expecting instant effect from the default-save path**: The model is written to `userSettings` and protected by a file lock; concurrent Claude Code instances may cause brief lock contention (see `tengu_config_lock_contention`).
3. **Specifying `[1m]` suffix without entitlement**: The `sonnet[1m]` and `opus[1m]` variants require specific account entitlements; supplying them without access produces a user-facing error with a documentation URL rather than a silent fallback.
4. **Assuming all `claude-*` strings are valid**: The command accepts any string starting with `"claude-"` without rejecting it at the alias-check stage, but the subsequent API probe will return `invalid_model` for unrecognized identifiers.
5. **Relying on gateway model discovery without the env flag**: The `/v1/models` gateway bootstrap is skipped unless `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY` is set; the model list used for validation is the statically embedded list in the bundle.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `vqf` | Main handler for `/model` command (AsyncFunction, module GXl) |
| `itr` | Model selection orchestrator — dispatches to model resolver and state updater |
| `RD` | Model resolver — coordinates `BDt` (alias table) and `BC` (validation/display) |
| `BDt` | Alias/tier-name table builder — constructs the known-model + short-alias map |
| `Cp` | Model record constructor — assembles a model descriptor object |
| `Ko` | Individual model entry builder — maps full model ID to display name and properties |
| `BC` | Model display / validation coordinator — wraps `VBr`, `AAn`, `SAn` |
| `VBr` | Model list formatter / display renderer |
| `AAn` | Model validation and policy-filter logic |
| `SAn` | Session-model application / state-write helper |
| `hYt` | Model change application — orchestrates entitlement, probe, and state write |
| `yVt` | Model validation probe — sends side-query and caches result |
| `grf` / `hrf` | Model probe response normalizer / display-name formatter for probe result |
| `SU` | API request executor (main inference call builder) |
| `q8` | HTTP request builder — assembles headers, auth tokens, and request body |
| `RDe` | Bootstrap model-discovery fetch handler |
| `sAo` | Bootstrap dispatch — checks flags and calls `RDe` |
| `OKp` | Bootstrap HTTP fetch and cache-write logic |
| `UKp` | Bootstrap response parser and cache update |
| `str` | Model confirmation message builder — formats output text after successful switch |
| `L1e` | Model picker / interactive selector component |
| `Y1o` | Interactive model list renderer with labels |
| `VQ` | No-argument path handler — shows current model and opens picker |
| `b3t` | Fable consent dialog orchestrator |
| `Vue` | Fable consent UI component |
| `pio` | Consent form renderer |
| `La` | Settings loader / project+user settings merger |
| `mkt` / `gkt` | Settings file readers (`flagSettings` and `userSettings` layers) |
| `io` | Full settings-load pipeline (disk read, merge, validation) |
| `HYt` | Post-load settings applicator |
| `aRt` | Atomic file write helper (temp file + rename + fsync) |
| `xZt` | Config file write with lock, backup, and auto-repair |
| `gn` | Global config save coordinator |
| `Mcr` | Config fallback write path |
| `ODt` | App-state updater after model change |
| `Mt` | Telemetry event emitter |
| `xe` | Error logger / telemetry error sink |
| `Md` | Hash utility (SHA-256, used for cache-key generation) |
| `w8` | Model entry list builder helper |
| `gpd` | Model set membership tracker |
| `mpd` | Model normalization helper (trim + display name) |
| `O_` | Model ID string normalizer (lowercase, prefix strip) |
| `mo` | Model object builder (combines ID, provider, display) |
| `Ant` | Provider metadata resolver |
| `Ha` | String replace / sanitize utility |
| `C0` | Provider-type inclusion check |
| `dp` | Model ID string cleaner (regex replace) |
| `fr` | Logger / debug output utility |
| `ut` | String coercion utility |
| `Lm` | Logging sink |
| `Oe` | Telemetry feature-gate emitter wrapper |
| `W` | Telemetry event dispatcher |
| `ke` | Feature-gate checker |
| `Le` | Spinner / progress display wrapper |
| `wt` | Spinner show/hide controller |
| `nb` | Model display-name lookup |
| `x8` | Model display-name fallback |
| `J7` | Extended-context (1M) suffix appender |
| `Ywe` | Model entitlement / policy checker |
| `hle` | Model disable-state resolver |
| `_He` | Disable-reason string matcher |
| `EAn` | Extended-context entitlement checker |
| `Qnt` | Context-size include checker |
| `J1o` | Opus-1M availability checker |
| `X1o` | Sonnet-1M availability checker |
| `mre` / `mEe` | Per-model entitlement probe helpers |
| `Pia` | Credits/entitlement tier resolver |
| `SHe` | Entitlement string mapper |
| `yo` | Render/output primitive |
| `oT` | Model entry renderer with state annotations |
| `bHe` | "Pro" tier label helper |
| `Mi` | Model UI row renderer |
| `pPl` | Provider-type display label helper |
| `HAn` | Settings merge helper (policy + user) |
| `PDt` | Policy settings field extractor |
| `qoi` | Settings object iterator |
| `Hn` / `gmn` | Settings source resolver (project vs. user) |
| `sF` | Model filter (allowed-list check) |
| `Hpd` / `hpd` | Settings path helpers |
| `joi` / `Woi` | Settings key matchers |
| `Voi` | Settings index finder |
| `vve` | Remote managed-settings reader |
| `Hvs` / `mkt` | Flag-settings file reader |
| `p3` | Settings entry constructor |
| `dkt` | Settings entry with source tag |
| `Zns` | Settings sentinel |
| `NC` | Settings dedup tracker |
| `Uhe` | Settings applicator |
| `Z7` | Model display wrapper (combines provider check + model object) |
| `SH` | Provider + model compositor |
| `EH` | Provider entitlement string helper |
| `sc` | Output formatter primitive |
| `rg` | Fast-mode indicator renderer |
| `tF` / `Kwe` | Fast-mode string builder |
| `zwe` | Output separator |
| `eIs` | Settings file I/O (read/write/append) |
| `n_` | Cache clear utility |
| `Me` | JSON serializer wrapper |
| `M5` | Settings path joiner |
| `d8` | Settings entry with kind/source metadata |
| `oBe` | Settings entry with override flag |
| `Lg` | Settings list builder |
| `Xv` | Watcher registration |
| `Cn` | Event emitter wrapper |
| `RRr` | Settings timestamp recorder |
| `Hr` | Home-directory resolver |
| `qt` | File existence check |
| `Tkr` | Settings file watcher |
| `iJp` | Model search helper (find by alias or ID) |
| `vbo` | Model cache hash generator |
| `LAn` | Conversation context header builder |
| `e0n` | Request metadata logger |
| `$8e` | Model context-window annotator |
| `LP` | Prompt-cache configuration helper |
| `gw` | Tool list mapper |
| `uke` | Tool call formatter |
| `Fin` | Message array builder |
| `aP` | Message deep-clone utility |
| `qXe` | Message pop/push utility |
| `je` | Telemetry no-op / passthrough |
| `B3r` | Request body serializer |
| `F3r` | Request dedup / coalescing cache |
| `JIe` | Request ID generator |
| `br` | Request hash builder |
| `No` | Noop/sentinel |
| `t2t` | Token budget tracker |
| `YF` | Retry policy builder |
| `avt` | API response handler |
| `Dvn` | Model capability flag resolver |
| `ab` | Auth token attacher |
| `iLe` | WIF token exchange helper |
| `urt` | Credential resolver |
| `Os` | OAuth URL validator |
| `dw` | Error type discriminator |
| `ik` | Auth error handler |
| `uw` | Request timeout wrapper |
| `uKa` | Cache staleness checker |
| `kxn` | Cache hash comparator |
| `oNi` | Cache entry transformer |
| `rNi` | Cache field filter |
| `R_` | Cache invalidation helper |
| `BMu` | Error queue manager |
| `Zr` | Error string formatter |
| `ye` | String coercion (output) |
| `dKa` | Bootstrap state tracker |
| `w8r` | Response header parser |
| `qi` | Essential-traffic gate |
| `T` | Telemetry event builder / formatter |
| `sUe` | Config save guard (auth-loss check) |
| `Djo` | Config entry iterator |
| `wZt` | Config write timestamp |
| `vZt` | Config version checker |
| `sTt` | Config backup path builder |
| `xZt` | Atomic config write with lock |
| `Mcr` | Fallback config write path |
| `gn` | Global config save orchestrator |