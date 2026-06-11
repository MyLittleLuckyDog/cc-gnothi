---
type: feature-spec
feature: "model"
cc_version: "2.1.169"
updated: "2026-06-11"
tags: ["model", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.169 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/model`

> Analysis basis: CC v2.1.169 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.169

---

## Overview

The `/model` command allows users to change the AI model used by Claude Code either for the current session only or persistently as the new default. When invoked with a model name argument, the handler validates the input, resolves it against known aliases and provider-specific rules, optionally performs a live API validation call, then writes the updated model preference to app state and (optionally) to the project settings file.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `model` |
| description | `Set the AI model for Claude Code` |
| argumentHint | `<model>` |
| supportsNonInteractive | `true` |
| module_id | `k5K` |
| load_inline | `true` |
| loc_byte | `12853221` |
| loc_byte_end | `12853395` |
| loc_line | `9139` |
| arbor_handler.name | `DQf` |
| arbor_handler.fqn | `claude-2.1.169::DQf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.169 bundle.js:+12853221

---

## Input Branching

The handler has more than three distinct branches based on argument content and account capabilities. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/model &lt;arg&gt;"]) --> B{arg present?}
    B -- No arg --> C[Display current model info\nand available models list]
    B -- Has arg --> D[Trim whitespace from arg]
    D --> E{arg empty after trim?}
    E -- Yes --> F[Error: 'Model name cannot be empty']
    E -- No --> G{arg is inline/text type?}
    G -- Yes --> H[Emit tengu_model_command_inline telemetry\nReturn early]
    G -- No --> I[Resolve model alias\ne.g. 'best', 'opus', 'sonnet', 'haiku',\n'opusplan', '[1m]' suffix variants]
    I --> J{Provider allows model switch?}
    J -- Not allowed --> K[Error: 'not_allowed'\nReturn without change]
    J -- Allowed --> L{Resolved to Opus 1M?}
    L -- Yes, unavailable --> M[Error: 'opus_1m_unavailable'\nUser message with doc link]
    L -- No or available --> N{Resolved to Sonnet 1M variant?}
    N -- Yes, unavailable --> O[Error: 'sonnet_1m_unavailable'\nUser message with doc link]
    N -- No or available --> P[Run live API validation\nvia side-query with ephemeral 'Hi' message]
    P --> Q{API response}
    Q -- Auth failure --> R[Error: authentication failed]
    Q -- Network error --> S[Error: check internet connection]
    Q -- not_found_error / 'model:' in message --> T[Error: 'invalid_model']
    Q -- Exception --> U[Error: 'validate_exception']
    Q -- Success --> V{Save as default?}
    V -- Yes --> W[Write 'model' key to project settings file\nSuffix: ' and saved as your default for new sessions']
    V -- No --> X[Session-only update\nSuffix: ' for this session only']
    W --> Y[Update appState model field\nEmit telemetry: model_set_default / model_switch]
    X --> Y
    Y --> Z[Display confirmation with\nfast-mode / usage-credit annotations]
```

---

## Behavioral Spec

### Entry Point — Main Handler (`DQf`)

Analysis basis: CC v2.1.169 bundle.js:+12822256

```
async function handleModelCommand(inputArg, appState, options):
    trimmedArg = inputArg.trim()                          // +12822256

    if trimmedArg is in the inline/text-type set:         // +12822272
        emitTelemetry("tengu_model_command_inline")       // +12822414
        return early

    if trimmedArg is empty or no arg provided:
        return displayModelMenu(appState)                 // +12822295 (getAppState)

    resolvedModel = resolveAndValidateModel(trimmedArg, appState)  // +12822339 (am8)

    if resolvedModel indicates not_allowed:
        return error response

    fingerprintHash = computeShortHash(trimmedArg)        // +12822454 (_$, sha256 → hex[:12])

    result = await performModelSwitch(resolvedModel, appState, options)  // +12822509 (pfK)
    return result
```

### Model Alias Resolution (`resolveAndValidateModel` / `am8` → `ZR`, `pD6`, `c9`)

Analysis basis: CC v2.1.169 bundle.js:+12787364, +2250747, +2252078

The resolver normalises the user-supplied string to a canonical model identifier by applying a chain of alias mappings:

```
function resolveModelAlias(rawInput):
    s = rawInput.trim().toLowerCase()

    // Short alias mappings (resolved in order):
    if s == "opusplan"  → return "Opus Plan" alias (plan-mode model)  // +2252174
    if s == "[1m]"      → expand to 1M-context variant                // +2252200
    if s == "sonnet"    → resolve to current sonnet model             // +2252215
    if s == "haiku"     → resolve to current haiku model              // +2252254
    if s == "opus"      → resolve to current opus model               // +2252293
    if s == "best"      → resolve to recommended default              // +2252330

    // Provider prefixes checked: "anthropic.", bedrock, foundry,
    //   vertex, anthropicAws, gateway, mantle                         // +2246054, +2105194..

    // If alias "opusplan": description = "Opus in plan mode, else Sonnet"  // +2250704

    return canonicalModelId
```

### Availability Gate for Extended-Context Models (`om8`)

Analysis basis: CC v2.1.169 bundle.js:+12785044, +12785222, +12785439

```
function checkExtendedContextAvailability(resolvedModel, accountCapabilities):
    // Opus 1M check
    if resolvedModel requires opus-1M context:
        if account does not have opus-1M capability:
            return error {
                code: "opus_1m_unavailable",                           // +12785222
                message: "Opus with 1M context is not available …"    // +12785260
            }

    // Sonnet 4.6 1M check
    if resolvedModel is "sonnet[1m]" or "sonnet-4-6[1m]":             // +12787100, +12787126
        if account does not have sonnet-1M capability:
            return error {
                code: "sonnet_1m_unavailable",                         // +12785439
                message: "Sonnet 4.6 with 1M context is not available …" // +12785479
            }

    return ok
```

### Live API Validation (`im8`)

Analysis basis: CC v2.1.169 bundle.js:+12783192, +12783568

The handler sends a minimal "side query" to the Anthropic API using the candidate model before committing to the switch. This validates that the model ID is accepted by the API for the current credentials.

```
async function validateModelViaApi(canonicalModelId, appState):
    if canonicalModelId is empty after trim:
        return error("Model name cannot be empty")                     // +12783229

    normalised = canonicalModelId.trim().toLowerCase()                 // +12783352

    if normalised already in validationCache (mfK.has):               // +12783473
        return cachedResult

    // Build ephemeral test message
    request = {
        model: normalised,
        messages: [{ role: "user", content: "Hi" }],                  // +12783637
        cache_control: "ephemeral",                                     // +12783662
        type: "model_validation"                                        // +12783568
    }

    response = await sideQuery(request)                                // +12783518 (qp)

    // Error classification
    if response.status == 401 / auth error:
        return error("Authentication failed. Please check your API credentials.")  // +12783928
    if response is network error:
        return error("Network error. Please check your internet connection.")      // +12784030
    if response.type == "not_found_error" or response.message contains "model:":  // +12784149, +12784231
        return error { code: "invalid_model" }                        // +12785722

    store result in validationCache (mfK.set)                         // +12783681
    return ok(validatedModelId)
```

### Model Switch and Persistence (`pfK` → `pMA`)

Analysis basis: CC v2.1.169 bundle.js:+12786004, +12786563, +12786205, +12786251

```
async function performModelSwitch(validatedModel, appState, saveAsDefault):
    // Determine save scope
    if saveAsDefault:
        settingsSuffix = " and saved as your default for new sessions"  // +12786205
        writeSettingsKey("model", validatedModel, scope="projectSettings") // +12786610
        emitTelemetry("model_set_default")                              // +12786563
    else:
        settingsSuffix = " for this session only"                       // +12786251

    // Update live app state
    appState.model = validatedModel
    emitTelemetry("model_switch")                                       // +12785060

    // Build display confirmation
    annotation = buildAnnotation(validatedModel)
    // annotation examples:
    //   " · Fast mode ON"          (+12786369)
    //   " · Draws from usage credits" (+12786420)
    //   " · Fast mode OFF"         (+12786466)
    // If managed settings apply: show "Managed settings" label          (+12786772)

    displayConfirmation(validatedModel + annotation + settingsSuffix)
    return success
```

### Short Hash Generation (`_$`)

Analysis basis: CC v2.1.169 bundle.js:+12822454, +3494957, +3494972, +3494999, +3495014

```
function computeShortHash(input):
    digest = crypto.createHash("sha256")                               // +3494957
                   .update(input)
                   .digest("hex")                                       // +3494999
    return digest.slice(0, 12)                                         // +3495014
```

Used for telemetry/logging purposes to identify models without transmitting the full string.

### Bootstrap / Model List Fetch (`H` → `N`)

Analysis basis: CC v2.1.169 bundle.js:+16097954, +16097992, +16098041, +16098157

When `/model` is invoked without an argument, the available model list may be fetched from a remote endpoint:

```
async function fetchModelList(endpoint):
    log("[Bootstrap] Fetching", endpoint)                              // +16097956

    headers = {
        "Content-Type": "application/json",                            // +16098041
        "User-Agent": <version string>                                 // +16098075
    }

    response = await fetch(endpoint, { headers, timeout: 5000 })      // +16098157

    if fetch fails:
        emitTelemetry("api_bootstrap_fetch", { result: "parse_failed" }) // +16098278, +16098300

    if ok:
        log("[Bootstrap] Fetch ok")                                    // +16098330
        cachedList = MA.get(response)                                  // +16097992

    return modelList
```

### Settings Persistence Layer (`t_` / config writer)

Analysis basis: CC v2.1.169 bundle.js:+1286576, +1286598, +1287222, +1287337, +1287360

The settings writer handles layered configuration files:

```
function writeModelToSettings(key, value, scope):
    // Scope resolution order:
    //   policySettings  (+1286576)
    //   flagSettings    (+1286598)
    //   userSettings    (+1287222)   → ~/.claude/settings.json
    //   projectSettings (+1287337)   → <project>/.claude/settings.json
    //   localSettings   (+1287360)   → <project>/.claude/settings.local.json

    targetFile = resolveSettingsPath(scope)
    ensureDirectory(targetFile.dir)
    appendOrUpdateJson(targetFile, key, value)

    // Side-effect checks after write:
    //   "gitignore_global_rule"  (+1287488)
    //   "already_tracked"        (+1287532)
    //   "write_ineffective"      (+1287629)
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_model_command_inline` | Fired when the argument appears to be an inline/text-type value rather than a model ID (bundle.js:+12822414) |
| Telemetry: `tengu_feature_ok` | Fired on successful feature path (bundle.js:+1013926) |
| Telemetry: `tengu_feature_bad` | Fired on feature failure path (bundle.js:+1013988) |
| Telemetry: `tengu_feature_sad` | Fired on degraded/partial feature path (bundle.js:+1014069) |
| Telemetry: `tengu_api_success` | Fired after successful API response during side-query validation (bundle.js:+13636175) |
| Telemetry: `tengu_lone_surrogate_sanitized` | Fired when lone surrogates are sanitised from API response content (bundle.js:+13635924) |
| appState changes | `appState.model` is updated to the newly validated model identifier |
| Settings file write | When saving as default: writes `"model"` key to the appropriate `.claude/settings.json` layer |
| Validation cache | `mfK` (a Map) is populated with validated model IDs to avoid redundant API round-trips (bundle.js:+12783473, +12783681) |
| Hook registration | `ZGA.register` called via `Z9` — registers a cleanup/signal handler (bundle.js:+62328) |
| Timer management | `TBH` manages `setTimeout` / `clearTimeout` / `setImmediate` for async write buffering (bundle.js:+61742, +61906, +61999) |
| File I/O | `Mh.mkdir`, `Mh.appendFile`, `Mh.rename`, `Mh.unlink`, `Mh.stat` used by settings writer (bundle.js:+208157, +208216, +207728, +207884, +207924) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.169 | Initial analysis |

---

## Common Mistakes

1. **Passing a display name instead of an alias or model ID** — e.g. typing `/model Claude Sonnet` (with spaces and capitalisation) instead of `/model sonnet`. The handler lowercases input but the multi-word form will not match any known alias and will be sent to the API as-is, likely resulting in an `invalid_model` error.
2. **Expecting persistence without confirming scope** — by default the command may update the model for the current session only. Confirm whether the `saveAsDefault` path was triggered by checking the confirmation suffix ("and saved as your default for new sessions" vs "for this session only").
3. **Using extended-context suffixes on unsupported accounts** — appending `[1m]` to a model name (e.g. `/model opus[1m]`) will be rejected with `opus_1m_unavailable` or `sonnet_1m_unavailable` if the account does not have access to the extended-context tier.
4. **Invoking the command in non-interactive mode without an argument** — `/model` with no argument triggers the interactive model-list display, which is not meaningful in non-interactive (`--no-interactive`) contexts even though `supportsNonInteractive: true` is set on the registration (the flag governs the argument-provided path).
5. **Assuming instant effect with no API round-trip** — the handler performs a live "side query" (`sideQuery` / `qp`) to validate the model before committing the switch. In high-latency or offline environments this will produce a network error rather than a silent failure.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `DQf` | Main async handler for `/model` command (entry point) |
| `H` | Bootstrap / model-list fetch function; also used as generic parameter name in multiple sub-functions |
| `N` | Model list display / no-arg path orchestrator |
| `ItK` | Model list item renderer / formatter |
| `vGA` | Sub-renderer for individual model entries |
| `CH` | JSON serialisation helper (wraps `JSON.stringify`) |
| `R4` | Model ID normaliser / string manipulation helper |
| `qZA` | Maps over known model list (`ZtK.map`) |
| `rBH` | Config file write coordinator |
| `lEA` | Low-level file write wrapper (`H.write`) |
| `StK` | Settings persistence orchestrator (mkdir, appendFile, rotate) |
| `TBH` | Async write buffer manager (setTimeout/clearTimeout/setImmediate) |
| `_4H` | Settings path builder |
| `n56` | Error code handler (EISDIR check) |
| `MZA` | Settings path join helper |
| `Vo8` | Settings file rotation handler (stat, rename, unlink) |
| `htK` | Settings append-file worker |
| `Z9` | Signal/cleanup hook registrar (`ZGA.register`) |
| `w2_` | String splitter / trimmer utility |
| `u6H` | Provider allow-list checker (`vO4.has`) |
| `n3` | String replace utility |
| `M9` | Model resolution top-level function |
| `Cc` | Model alias dispatcher |
| `CC` | Model string parser (trims, checks `anthropic.` prefix, maps aliases) |
| `c9` | Canonical model ID builder (handles alias tokens: opusplan, [1m], sonnet, haiku, opus, best) |
| `u2` | ZLH-based utility called from model builder |
| `TLH` | Provider inclusion checker (`GLH.includes`) |
| `Mk` | Model variant resolver (zM + F5) |
| `QcH` | Model capability checker (F5) |
| `AE` | Model attribute extractor (zM, F5, YA) |
| `dG1` | Alias → attribute delegator (calls AE) |
| `zM` | Model metadata lookup (YA) |
| `__8` | Suffix/flag inclusion check (`Q5L.includes`) |
| `dcH` | String post-processor (`_6`) |
| `eD` | Model descriptor builder (calls c9, hG) |
| `hG` | Model descriptor assembler (yA, AE, zM, YA, F5, Mk) |
| `o6` | Feature telemetry dispatcher (calls d, K6) |
| `d` | Telemetry event emitter (tengu_feature_ok / bad / sad) |
| `K6` | Telemetry transport wrapper |
| `c76` | Low-level telemetry sink |
| `am8` | Model resolution + account capability gate (calls ZR, _) |
| `ZR` | Account/provider context resolver (calls pD6, hG) |
| `pD6` | Provider descriptor builder (calls e$, c9) |
| `e$` | Model descriptor helper (dDH) |
| `_$` | Short SHA-256 hash generator (12 hex chars) |
| `NI` | Hash utility wrapper |
| `pfK` | Model switch executor (calls om8, pMA) |
| `om8` | Pre-switch validation orchestrator (CC, bH, Zgf, Vgf, Egf, im8, EH) |
| `bH` | Provider context fetcher (d, K6) |
| `Zgf` | Opus-1M availability checker |
| `mt` | Capability token parser (ZLH, yA, tr9) |
| `x2` | Capability flag evaluator (ZLH, VLH, YA, yA, Oq) |
| `Vgf` | Sonnet-1M availability checker |
| `$MH` | Sonnet capability token parser |
| `Egf` | General model exclusion checker (`GLH.includes`) |
| `im8` | Live API model validator (trim, CC, lowercase, GLH, mfK, qp, Ggf) |
| `qp` | Side-query API call executor (fetch, parse, telemetry) |
| `Ggf` | Validation result formatter (Tgf, String) |
| `EH` | Error string formatter (String) |
| `pMA` | Post-validation model switch finaliser (settings write, display) |
| `FKH` | Settings key resolver |
| `gx6` | Config write dispatcher (t_, SH) |
| `t_` | Settings file writer (all scopes: policy, flag, user, project, local) |
| `SH` | Settings read/write low-level helper (d, K6) |
| `A4` | Display string builder (YA, _6) |
| `YA` | String rendering primitive (_6) |
| `_6` | String coercion wrapper |
| `FDH` | Formatting detail helper |
| `l3` | Model label builder (A4, hG, c9) |
| `GGH` | Model display entry builder (yA, c9, eD, l3, u2) |
| `yA` | Async UI component builder (IY, kC, D9) |
| `UMA` | Confirmation message composer (AvH, y8, ku, J6, Ma) |
| `AvH` | Confirmation sub-component (Tv, y8) |
| `y8` | UI element factory (Ho6, YB) |
| `ku` | Path joiner for `.claude` config dir (`iI.join`) |
| `Ma` | Model display description builder (TLH, e$, c9) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.