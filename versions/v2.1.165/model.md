---
type: feature-spec
feature: "model"
cc_version: "2.1.165"
updated: "2026-06-05"
tags: ["model", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.165 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/model`

> Analysis basis: CC v2.1.165 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.165

---

## Overview

The `/model` command allows users to switch the AI model used by Claude Code during a session or persistently. When invoked with a model name argument, it validates the requested model against the current account's available models, optionally performs a live API probe, and then applies the change either for the current session only or as the saved default for new sessions.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `model` |
| description | `Set the AI model for Claude Code` |
| argumentHint | `<model>` |
| supportsNonInteractive | `true` |
| module_id | `Q9K` |
| load_inline | `true` |
| loc_byte | `12694831` |
| loc_byte_end | `12695005` |
| loc_line | `9080` |
| arbor_handler.name | `bCf` |
| arbor_handler.fqn | `claude-2.1.165::bCf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.165 bundle.js:+12694831

---

## Input Branching

Six or more distinct input/state branches are present (empty argument, alias resolution, 1M-context availability check, API validation failure modes, session-only vs. default-save, managed-settings guard). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/model <arg>]) --> B{Argument\nprovided?}
    B -- "no / whitespace only" --> C[Show current model\n+ available model list\nand return]
    B -- "yes" --> D[Trim & normalize\nargument string]
    D --> E{Alias\nresolution}
    E -- "opusplan / best / etc." --> F[Resolve to canonical\nmodel identifier]
    E -- "already canonical" --> G[Use as-is]
    F --> H{1M-context\nvariant requested?}
    G --> H
    H -- "opus[1m] requested" --> I{Account supports\nOpus 1M?}
    I -- "no" --> J[Emit error:\nopus_1m_unavailable\nwith docs link]
    I -- "yes" --> K[Proceed with\nOpus 1M model]
    H -- "sonnet[1m] / sonnet-4-6[1m]\nrequested" --> L{Account supports\nSonnet 1M?}
    L -- "no" --> M[Emit error:\nsonnet_1m_unavailable\nwith docs link]
    L -- "yes" --> N[Proceed with\nSonnet 1M model]
    H -- "standard model" --> O[Proceed with\nstandard model]
    K --> P[API validation probe\n'Hi' ephemeral message]
    N --> P
    O --> P
    P --> Q{API probe\nresult}
    Q -- "auth error" --> R[Emit auth-failed\nerror message]
    Q -- "network error" --> S[Emit network-error\nmessage]
    Q -- "not_found_error\ncontaining 'model:'" --> T[Emit invalid_model\nerror + telemetry]
    Q -- "other exception" --> U[Emit validate_exception\nerror + telemetry]
    Q -- "success" --> V{Managed\nsettings active?}
    V -- "yes" --> W[Apply session-only\nmodel change\n'for this session only'\nmessage]
    V -- "no" --> X{Save as\ndefault?}
    X -- "yes" --> Y[Persist to\nuser settings\n'saved as your default'\nmessage\ntelemetry: model_set_default]
    X -- "no" --> W
    W --> Z([Done])
    Y --> Z
    J --> Z
    M --> Z
    R --> Z
    S --> Z
    T --> Z
    U --> Z
    C --> Z
```

---

## Behavioral Spec

### Main Handler — Argument Parsing and Dispatch

Analysis basis: CC v2.1.165 bundle.js:+12661786

```
async function handleModelCommand(rawArgument, context):
    trimmed = rawArgument.trim()                        // +12661786

    if trimmed is empty:
        displayCurrentModelAndList(context)             // show current + available
        return

    // Inline command telemetry fired immediately
    emit telemetry "tengu_model_command_inline"         // +12661944

    modelInput = resolveModelAlias(trimmed)             // alias + normalization
    result = await validateAndApplyModel(modelInput, context)
    return result
```

### Alias Resolution

Analysis basis: CC v2.1.165 bundle.js:+206051, +2243249, +2243275, +2243290, +2243329, +2243368, +2243405, +2241779

```
function resolveModelAlias(input):
    normalized = input.toLowerCase().trim()

    // Short-name and alias table (literals found in bundle)
    aliasMap = {
        "opusplan"  -> canonical Opus-in-plan-mode identifier,  // +2243249
        "[1m]"      -> 1M-context variant suffix,               // +2243275
        "sonnet"    -> canonical Sonnet identifier,             // +2243290
        "haiku"     -> canonical Haiku identifier,              // +2243329
        "opus"      -> canonical Opus identifier,               // +2243368
        "best"      -> "Opus in plan mode, else Sonnet"         // +2243405, +2241779
    }

    // Provider prefix check: model names beginning with "anthropic." are
    // treated as first-party                                   // +2237210
    // Provider tags: anthropicAws, gateway, mantle, bedrock,
    //   foundry, vertex also recognised                        // +2097366, +2097386,
    //                                                          // +2240098, +2096693,
    //                                                          // +2096743, +2096901

    if normalized matches an alias key:
        return aliasMap[normalized]
    else:
        return input   // pass through verbatim
```

### 1M-Context Availability Check

Analysis basis: CC v2.1.165 bundle.js:+12624795, +12624833, +12625012, +12625052, +12626667, +12626693

```
function check1MContextAvailability(modelIdentifier, accountCapabilities):
    // Opus 1M variant
    if modelIdentifier is an Opus-1M variant:
        if NOT accountCapabilities.supportsOpus1M:
            return error {
                code: "opus_1m_unavailable",              // +12624795
                message: "Opus with 1M context is not available for your account. " +
                         "Learn more: https://code.claude.com/docs/en/model-config" +
                         "#extended-context-with-1m"      // +12624833
            }

    // Sonnet 1M variants: "sonnet[1m]", "sonnet-4-6[1m]"
    if modelIdentifier in {"sonnet[1m]", "sonnet-4-6[1m]"}:  // +12626667, +12626693
        if NOT accountCapabilities.supportsSonnet1M:
            return error {
                code: "sonnet_1m_unavailable",            // +12625012
                message: "Sonnet 4.6 with 1M context is not available for your account. " +
                         "Learn more: https://code.claude.com/docs/en/model-config" +
                         "#extended-context-with-1m"      // +12625052
            }

    return ok
```

### API Validation Probe

Analysis basis: CC v2.1.165 bundle.js:+12622765, +12622802, +12623141, +12623176, +12623210, +12623235, +12623501, +12623603, +12623701, +12623722, +12623741, +12623804, +12625295, +12625392

The bundle sends a minimal, ephemeral probe message to the Anthropic API to confirm the model exists and the credentials are valid before committing the switch.

```
async function validateModelViaApi(modelId, apiClient):
    if modelId.trim() == "":
        return error { message: "Model name cannot be empty" }  // +12622802

    normalizedId = modelId.toLowerCase().trim()

    // Check a seen-models cache to skip repeat probes         // +12623046 (s1K.has)
    if seenModelsCache.has(normalizedId):
        return getCachedResult(normalizedId)

    try:
        response = await apiClient.sendMessage({
            role: "user",                                       // +12623176
            content: "Hi",                                      // +12623210
            cache_control: { type: "ephemeral" }               // +12623235
        }, { model: modelId })

        seenModelsCache.set(normalizedId, response)            // +12623254
        return ok

    catch AuthenticationError:
        emit telemetry "model_validation" with outcome "not_allowed"  // +12624648
        return error {
            message: "Authentication failed. Please check your API credentials."
                                                               // +12623501
        }

    catch NetworkError:
        return error {
            message: "Network error. Please check your internet connection."
                                                               // +12623603
        }

    catch ApiError where error.type == "not_found_error"       // +12623722
                   AND   error.message contains "model:"       // +12623804
        emit telemetry "model_validation" with outcome "invalid_model"  // +12625295
        return error { code: "invalid_model" }

    catch other:
        emit telemetry "model_validation" with outcome "validate_exception"  // +12625392
        return error { ... }
```

### Model Application and Persistence

Analysis basis: CC v2.1.165 bundle.js:+12625508, +12625577, +12625772, +12625818, +12625857, +12625936, +12625987, +12626033, +12626130, +12626177, +12626339

```
async function applyModelSelection(validatedModelId, context):
    isManagedSettings = detectManagedSettingsPolicy(context)    // +12626339

    if isManagedSettings:
        // Session-only: do not write to disk
        applySessionModel(context, validatedModelId)
        displayMessage(validatedModelId + " for this session only")  // +12625818
        appendFastModeIndicator(context)                             // +12625936 / +12626033
        appendUsageCreditsNote(context)                              // +12625987
        return

    // Persist to user settings file
    writeModelToUserSettings(validatedModelId)                   // path: .claude/settings.json
    emit telemetry "model_set_default"                          // +12626130

    displayMessage(validatedModelId +
                   " and saved as your default for new sessions")    // +12625772

    appendFastModeIndicator(context)
    appendUsageCreditsNote(context)

    // Confirmation includes bold-formatted model name          // +12625753, +12626397
```

### Settings File Write Path

Analysis basis: CC v2.1.165 bundle.js:+1269300, +1269308, +1269318, +1269380, +1278808, +1278923, +1278946

```
function resolveSettingsPath(kind):
    // Settings hierarchy (priority order):
    // 1. policySettings    — managed/enterprise policy         // +1278162
    // 2. flagSettings      — feature-flag overrides            // +1278184
    // 3. userSettings      — ~/.claude/settings.json           // +1278808
    // 4. projectSettings   — <project>/.claude/settings.json   // +1278923
    // 5. localSettings     — .claude/settings.local.json       // +1278946

    userSettingsPath = join(homeDir, ".claude", "settings.json")   // +1269308, +1269318
    localSettingsPath = join(projectDir, ".claude", "settings.local.json")
                                                                    // +1269380

    // "model" key written under the selected settings layer    // +12626177
    return targetPath
```

### Model List Display (No-Argument Path)

Analysis basis: CC v2.1.165 bundle.js:+12661802, +12661825, +12661869

When `/model` is invoked with no argument (or only whitespace), the handler:

1. Reads the current `model` value from application state via `getAppState()` (Analysis basis: CC v2.1.165 bundle.js:+12661825).
2. Checks whether the current context type is `"text"` (Analysis basis: CC v2.1.165 bundle.js:+12661853).
3. Calls the model-list renderer (mapped to `XC8`) which enumerates available models, formats them with display names, provider tags, and capability annotations such as `"Opus in plan mode, else Sonnet"` (Analysis basis: CC v2.1.165 bundle.js:+12661869, +2241779).
4. Checks a blocklist (`Ed6.includes`) and an allowed-list (`yOH.includes`) before rendering each entry (Analysis basis: CC v2.1.165 bundle.js:+12661802, +12661889).

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_model_command_inline` | Fired immediately when a non-empty argument is supplied (bundle.js:+12661944) |
| Telemetry — `tengu_model_command` (via `model_switch` literal) | Fired on successful switch with outcome tag (bundle.js:+12624633) |
| Telemetry — `model_set_default` | Fired when model is persisted to user settings (bundle.js:+12626130) |
| Telemetry — `model_validation` | Fired on validation failure with outcome codes `not_allowed`, `invalid_model`, `validate_exception` (bundle.js:+12624648, +12625295, +12625392) |
| Telemetry — `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` | Generic feature outcome events emitted by shared command infrastructure (bundle.js:+1010222, +1010284, +1010365) |
| Telemetry — `tengu_api_success` | Emitted on successful API probe response (bundle.js:+13463194) |
| Telemetry — `tengu_lone_surrogate_sanitized` | Emitted if lone surrogates are found in API response content during probe (bundle.js:+13462943) |
| Telemetry — `api_bootstrap_fetch` | Fired during bootstrap fetch with `parse_failed` sub-tag on JSON parse error (bundle.js:+15724905, +15724927) |
| appState changes | Active model ID updated in application state via `getAppState()` setter |
| File write | `~/.claude/settings.json` updated with `"model"` key when not under managed policy |
| Seen-models cache | In-memory `Map` (`s1K`) caches validated model IDs to avoid repeated API probes (bundle.js:+12623046, +12623254) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | `zXA.register` called via `j9` for conversation/context hooks (bundle.js:+60323) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.165 | Initial analysis |

---

## Common Mistakes

1. **Passing an empty string or only spaces** — the handler guards against this explicitly (error: "Model name cannot be empty", bundle.js:+12622802); always provide a non-whitespace model name.
2. **Using short aliases in scripted non-interactive mode** — aliases such as `"best"` or `"opusplan"` are resolved internally; if the resolved canonical name changes in a future version the alias behaviour may silently change.
3. **Expecting persistence under managed/enterprise policy** — when policy settings are active, `/model` applies the change for the current session only and does **not** write to `settings.json`, regardless of user intent.
4. **Requesting 1M-context variants on unsupported accounts** — `opus[1m]` and `sonnet[1m]` / `sonnet-4-6[1m]` will immediately fail with an informative error and a documentation link; no API probe is attempted.
5. **Assuming the API probe is free** — the validation step sends a real `"Hi"` message to the selected model; this counts against token usage. The in-memory seen-models cache (`s1K`) amortises repeated calls within a session.
6. **Confusing session-only vs. default-save** — the confirmation message explicitly states whether the change was saved as the default; check the trailing phrase to know which path was taken.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `bCf` | Main `/model` command handler (AsyncFunction; Arbor FQN: `claude-2.1.165::bCf`) |
| `H` | Bootstrap / model-list fetch utility |
| `v` | Model normalization / alias-resolution core function |
| `icK` | Input sanitization helper (trims, checks debug flag) |
| `DXA` | Debug-mode branch handler |
| `SH` | JSON serialization helper |
| `J4` | Model identifier canonicalization (REDACTED-replacement, slice, lastIndexOf) |
| `c2A` | Model map builder (`QcK.map`) |
| `ppH` | Output write wrapper |
| `C2A` | Stdout write helper (`H.write`) |
| `acK` | Conversation/session logger — append-file orchestrator |
| `$pH` | Debounced flush scheduler (clearTimeout / setTimeout / setImmediate) |
| `d3H` | Log-line formatter (join, prefix) |
| `Q6` | Settings path resolver helper |
| `aL6` | EISDIR-aware directory handler |
| `s2A` | Log file path builder (KHH.join) |
| `a2A` | Log rotation handler (stat, rename, unlink) |
| `ocK` | Log file append core (mkdir, appendFile) |
| `j9` | Hook registrar (`zXA.register`) |
| `e$` | Model-entry formatter |
| `Gw_` | String split/trim/indexOf/slice utility |
| `ZHH` | Model blocklist checker (`c44.has`) |
| `uj` | String replacement helper |
| `e1` | Model display entry builder |
| `D6H` | Display-name construction orchestrator |
| `x0` | Display-name prefix builder |
| `IqH` | Display-name suffix builder |
| `yd` | Model metadata parser (provider prefix, tags) |
| `Aq` | Canonical model-name normalizer (trim, toLowerCase, alias lookup) |
| `o0` | Anthropic-model family lookup |
| `_4H` | Model tier/family includes checker (`H4H.includes`) |
| `wI` | Speed/tier classifier (`gM`, `Z5`) |
| `NQH` | Model speed-tag builder |
| `NE` | Model capability tag builder (firstParty, etc.) |
| `SX1` | Extended capability wrapper |
| `gM` | Provider type resolver (`XA`) |
| `Pe6` | Provider includes check (`r1L.includes`) |
| `vQH` | Provider display-label builder |
| `eX` | Model entry extended builder |
| `r0` | Model full-metadata assembler |
| `s6` | Feature telemetry event emitter |
| `c` | Core telemetry dispatch (feature ok/bad/sad) |
| `P6` | Telemetry payload formatter |
| `Nu6` | Telemetry transport primitive |
| `XC8` | Available-models list renderer |
| `gS` | Model list data provider |
| `BO6` | Model entry decorator |
| `rO` | Model entry XYH-tag appender |
| `gE` | SHA-256 hash utility (`ut1.createHash`, hex, length 12) |
| `Hx` | Hash transport helper |
| `t1K` | Model switch top-level orchestrator (calls `JC8`, `h4A`) |
| `JC8` | Model validation + switch logic (default/model_switch telemetry) |
| `RH` | Feature event helper for model switch |
| `dRf` | Opus-1M availability checker (toLowerCase, `Ws`, `z2`) |
| `Ws` | Model capability query helper |
| `z2` | Model identity resolver (q4H, K4H, XA, ZA, _q) |
| `cRf` | Sonnet-1M availability checker |
| `hfH` | Sonnet capability query helper |
| `QRf` | Model tier includes + toLowerCase checker |
| `wC8` | API probe / model-validation function (sends "Hi" ephemeral) |
| `_m` | API inference request executor (fetch, streaming, token accounting) |
| `FRf` | Validation error formatter |
| `EH` | String coercion helper |
| `h4A` | Post-validation display + settings-write orchestrator |
| `KR6` | User-settings writer (calls `r_`) |
| `r_` | Settings file read/write core (policySettings, userSettings, projectSettings) |
| `hH` | Feature telemetry for settings write |
| `sK` | Display string builder |
| `XA` | Provider type enumerator |
| `eH` | String coercion wrapper |
| `jYH` | Fast-mode indicator builder |
| `zO` | Opus-4 variant check (opus-4-6, opus-4-7, opus-4-8) |
| `IWH` | Sonnet-4-6 active-check + display builder |
| `ZA` | Async settings writer (zY, nR, n1) |
| `S4A` | Managed-settings display builder (dim/bold, "Managed settings") |
| `oTH` | Settings-source label resolver |
| `x8` | Settings path helper (Pl6, Kd) |
| `Sx` | Path join helper (`_I.join`, `.claude`) |
| `cr` | Model display-name post-processor (_4H, rO, Aq) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.