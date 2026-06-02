---
type: feature-spec
feature: "advisor"
cc_version: "2.1.157"
updated: "2026-06-02"
tags: ["advisor", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.157 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/advisor`

> Analysis basis: CC v2.1.157 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.157

---

## Overview

The `/advisor` command configures the **Advisor Tool**, a feature that allows Claude Code to consult a stronger or more capable model for guidance at key decision points during a task. It renders a JSX UI component and accepts an optional model name argument, performing validation, normalization, and alias resolution before storing the chosen advisor model in application state. The command supports enabling, disabling, or resetting the advisor, as well as selecting specific model targets including several shorthand aliases.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `advisor` |
| description | Configure the Advisor Tool to consult a stronger model for guidance at key moments during a task |
| loc_byte | `12360694` |
| loc_byte_end | `12360981` |
| loc_line | `8258` |
| argumentHint | `null` |
| isHidden | `null` |
| module_id | `gr1` |
| load_inline | `true` |
| arbor_handler.name | `lM5` |
| arbor_handler.fqn | `claude-2.1.157::lM5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.157 bundle.js:+12360694

---

## Input Branching

The command handler branches across more than three distinct paths based on the trimmed argument string, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/advisor [arg]"] --> B["Trim whitespace from argument\nbundle.js:+12360150"]
    B --> C{Argument value?}

    C -- "empty string" --> D["Render current advisor status\n(JSX component)\nbundle.js:+12360186"]

    C -- "\"off\" or \"unset\"" --> E["Disable advisor / clear setting\nbundle.js:+12360226, +12360237"]

    C -- "known alias\n(opusplan, sonnet, haiku, opus, best)" --> F["Resolve alias → canonical model string\nbundle.js:+2192792–2192948"]

    C -- "model-like string\n(starts with 'claude-' or 'anthropic.')" --> G["Validate model name via API probe\nbundle.js:+12352409, +12352443"]

    C -- "other non-empty string" --> H["Attempt alias/model match;\nif unrecognized, return error\nbundle.js:+12360304"]

    F --> I["Normalize: trim, lowercase\nbundle.js:+2192707"]
    G --> J{Validation result}

    J -- "Auth failure" --> K["Return error: 'Authentication failed...'\nbundle.js:+12353108"]
    J -- "Network error" --> L["Return error: 'Network error...'\nbundle.js:+12353210"]
    J -- "not_found_error for model:" --> M["Return error listing available models\nbundle.js:+12353329–12353411"]
    J -- "Pass" --> N["Store validated model in config"]

    I --> N
    N --> O["Re-render JSX with updated advisor model\nbundle.js:+12360186"]
    D --> O
    E --> P["Clear advisor config, re-render\nbundle.js:+12360226"]
```

---

## Behavioral Spec

### Top-Level Handler: advisorCommandHandler (`lM5`)

The handler is an `AsyncFunction` resolved via `module_id` → `gr1`. It is the sole entry point for `/advisor`.

```
async function advisorCommandHandler(args, appState):
    rawInput = args.trim()                          // bundle.js:+12360150

    if rawInput is empty:
        return renderAdvisorStatusComponent(appState)   // bundle.js:+12360186

    normalizedInput = rawInput.toLowerCase()

    if normalizedInput is "off" or "unset":         // bundle.js:+12360226, +12360237
        clearAdvisorModel(appState)
        return renderAdvisorStatusComponent(appState)

    resolvedModel = resolveModelAlias(normalizedInput)  // bundle.js:+12360304
    if resolvedModel is null:
        resolvedModel = normalizedInput

    validationResult = validateModelName(resolvedModel) // bundle.js:+12360318
    if validationResult.error:
        return renderError(validationResult.error)

    setAdvisorModel(appState, resolvedModel)
    availableModels = buildAvailableModelsList(appState) // bundle.js:+12360461
    return renderAdvisorStatusComponent(appState)
```

Analysis basis: CC v2.1.157 bundle.js:+12360150

---

### Model Alias Resolution (`_1`)

The alias resolver maps several short tokens to canonical or internally-formatted model references. Known aliases at this version:

| Alias token | Notes |
|---|---|
| `opusplan` | Mapped with `[1m]` formatting marker (bundle.js:+2192792, +2192818) |
| `sonnet` | Maps to sonnet-family canonical (bundle.js:+2192833) |
| `haiku` | Maps to haiku-family canonical (bundle.js:+2192872) |
| `opus` | Maps to opus-family canonical (bundle.js:+2192911) |
| `best` | Maps to best-available selection (bundle.js:+2192948) |

```
function resolveModelAlias(lowercaseInput):
    normalizedInput = stripFormatMarkers(lowercaseInput)    // bundle.js:+2192735
    if isKnownAlias(normalizedInput):                       // bundle.js:+2185910
        return expandAlias(normalizedInput)
    return applyProviderNormalization(normalizedInput)      // bundle.js:+2192810
```

The alias check delegates to an inclusion test against a known-alias list (`n1H.includes`, bundle.js:+2185910). Format markers such as `[1m]` are stripped or applied depending on context (bundle.js:+2192818).

Analysis basis: CC v2.1.157 bundle.js:+2192696

---

### Model Name Validation (`II8`)

When the argument is not a recognized alias, a lightweight validation call is made against the API to confirm the model exists.

```
async function validateModelName(modelName):
    if modelName.trim() is empty:
        return error("Model name cannot be empty")          // bundle.js:+12352409

    normalizedName = modelName.toLowerCase()                // bundle.js:+12352532

    if normalizedName in knownModelCache (mr1):             // bundle.js:+12352653
        return cached result

    providerCompatibility = checkProviderCompatibility(normalizedName) // bundle.js:+12352443

    result = await makeValidationAPICall(normalizedName)    // calls Vu → OU pipeline
    if result.type == "not_found_error" and
       result.message contains "model:":                    // bundle.js:+12353329, +12353411
        return error("Model not found; available: " + listedModels)

    if authFailure:
        return error("Authentication failed. Please check your API credentials.") // bundle.js:+12353108
    if networkFailure:
        return error("Network error. Please check your internet connection.")     // bundle.js:+12353210

    mr1.set(normalizedName, result)                         // bundle.js:+12352861
    return success(result)
```

The validation call uses a `"model_validation"` task type (bundle.js:+12352748) with an ephemeral cache hint (bundle.js:+12352842). The probe sends a minimal `"Hi"` message (bundle.js:+12352817) to confirm the model is accessible.

Analysis basis: CC v2.1.157 bundle.js:+12352372

---

### Provider-Aware Model Normalization (`uM5`)

After validation, a secondary normalization step maps version-tagged shorthand strings to fully-qualified model IDs. Observed mappings at this version:

| Short form | Canonical form |
|---|---|
| `opus-4-8` / `opus_4_8` | resolved via provider (bundle.js:+12353678, +12353702) |
| `opus-4-7` / `opus_4_7` | resolved via provider (bundle.js:+12353747, +12353771) |
| `opus-4-6` / `opus_4_6` | resolved via provider (bundle.js:+12353816, +12353840) |
| `opus-4-5` / `opus_4_5` | resolved via provider (bundle.js:+12353885, +12353909) |
| `sonnet-4-6` / `sonnet_4_6` | resolved via provider (bundle.js:+12353954, +12353980) |
| `sonnet-4-5` / `sonnet_4_5` | resolved via provider (bundle.js:+12354029, +12354055) |

```
function normalizeVersionedModelName(rawName, providerContext):
    lowerName = rawName.toLowerCase()                   // bundle.js:+12353648
    if lowerName includes known short-form alias:       // bundle.js:+12353667
        return resolveViaProviderTable(lowerName, providerContext) // bundle.js:+12353721
    return rawName
```

Analysis basis: CC v2.1.157 bundle.js:+12352957

---

### Provider Compatibility Check (`eX6`)

Before dispatching, the provider context is checked to determine if the proposed advisor model is compatible with the current API provider (e.g., Bedrock, Vertex, Anthropic direct).

```
function checkProviderCompatibility(modelName):
    providerLower = currentProvider.toLowerCase()   // bundle.js:+5348797
    if providerLower not in supportedProvidersForModel(modelName): // bundle.js:+5348820
        return incompatible
    return compatible
```

Analysis basis: CC v2.1.157 bundle.js:+12360392

---

### JSX Render Component

The handler returns a JSX element created via `FJ.createElement` (bundle.js:+12360186). The component displays the current advisor model setting and presents the list of available models joined with `", "` (bundle.js:+12360461, +12360470). The render path is taken both on a bare `/advisor` call and after any successful configuration change.

---

### Model Validation API Pipeline (`Vu` → `OU`)

The validation probe flows through the main API client pipeline. Key behaviors observed in the call graph:

- `"side_query"` task type is used to label validation calls (bundle.js:+13164043), keeping them distinct from main conversation turns.
- The pipeline applies standard request headers including `"User-Agent"`, `"X-Claude-Code-Session-Id"`, and `"x-app"` (bundle.js:+2914886, +2914914, +2914932).
- Token/auth check is performed before dispatch with log messages `"[API:auth] OAuth token check starting"` and `"[API:auth] OAuth token check complete"` (bundle.js:+2915469, +2915523).
- Prompt-cache configuration with `"1h"` TTL may be applied (bundle.js:+13164893; telemetry: `tengu_prompt_cache_1h_config`).
- On success, `tengu_api_success` telemetry is emitted (bundle.js:+13165494).

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_api_success` (bundle.js:+13165494) — emitted on successful model validation API call |
| Telemetry | `tengu_prompt_cache_1h_config` (bundle.js:+13125157) — emitted when 1-hour prompt cache is configured for validation probe |
| Telemetry | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop`, `tengu_bg_attach_legacy_autorespawn`, `tengu_bg_attach`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_stall_respawn`, `tengu_bg_attach_kick` — background session/daemon events reachable transitively through the API pipeline (not directly triggered by `/advisor` in normal use) |
| Config write | Advisor model stored in application settings when a valid model name or alias is provided |
| Config clear | Advisor model cleared when `off` or `unset` is passed as argument |
| Model cache | Validated model result stored in `mr1` Map to avoid redundant API probes (bundle.js:+12352861) |
| JSX render | A JSX status component is always rendered as the command's return value (bundle.js:+12360186) |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | Advisor model field updated or cleared in global app state |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.157 | Initial analysis |

---

## Common Mistakes

1. **Passing a model name that is not yet available on your configured provider.** The validation probe confirms model availability against the active API provider. A model available on Anthropic direct may not be accessible on Bedrock or Vertex, resulting in a `not_found_error`.
2. **Using hyphens vs. underscores in short-form aliases.** Both `opus-4-5` and `opus_4_5` are recognized (bundle.js:+12353885, +12353909), but other delimiters are not.
3. **Forgetting that `off` and `unset` are the only disable tokens.** Passing `none`, `null`, `false`, or an empty string will not disable the advisor — only `off` or `unset` (case-insensitive) trigger the clear path (bundle.js:+12360226, +12360237).
4. **Assuming the alias `best` selects a fixed model.** The `best` alias is resolved dynamically based on available models and may change across versions (bundle.js:+2192948).
5. **Expecting instant effect on in-flight tasks.** The advisor configuration is applied to the application state; any currently-running task continuation may not consult the newly-set advisor model until the next invocation boundary.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `lM5` | Top-level `/advisor` command handler (AsyncFunction) |
| `_1` | Model alias resolver |
| `II8` | Model name validator (API probe) |
| `uM5` | Versioned model name normalizer (short-form → canonical) |
| `xM5` | Outer wrapper for model normalization pipeline |
| `eX6` | Provider compatibility checker |
| `bQ` | Model string parser / pre-validation processor |
| `Vu` | Side-query API dispatcher (validation probe entry) |
| `OU` | Core API request builder and executor |
| `E0` | Model string normalizer helper |
| `o1H` | String conversion utility (calls `CH`) |
| `CH` | String constructor wrapper |
| `i1H` | Known-alias inclusion checker (queries `n1H`) |
| `pN` | Provider-aware model resolution coordinator |
| `iM` | Provider context accessor |
| `TA` | Provider type constants accessor |
| `w5` | Model-to-provider table lookup |
| `pxH` | Provider-specific model list |
| `VC4` | Composite model resolution (provider + alias + table) |
| `r1q` | Object.entries-based model table builder |
| `si6` | Provider model finder (calls `fq_.find`) |
| `LFH` | Model list formatter |
| `Z0` | Model resolution fallback chain |
| `e3q` | Chained alias resolver |
| `Co6` | `Lm4`-based model inclusion check |
| `fFH` | Model display name formatter |
| `M` | File/path manager reached via model validation path |
| `cS6` | Plugin/path resolution utility |
| `K` | Padded-column formatter |
| `ti6` | `B_`-based model table builder |
| `B_` | Configuration store accessor |
| `KFH` | `_m4`-based model filter |
| `t3q` | Model index finder |
| `Am4` | Compound model alias matcher |
| `qm4` | Prefix-aware model resolver |
| `s3q` | Model string prefix checker |
| `WH7` | Request header builder (split/trim/index/slice) |
| `v9` | Background-mode header injector (`bg`) |
| `Jr` | Error context builder (references GitHub issues URL) |
| `k6` | Anthropic SDK version accessor (`AN`) |
| `S1_` | URL encoder for API paths |
| `N` | Core HTTP request dispatcher |
| `kO` | Request signing / additional-protection handler |
| `LOq` | Boolean coercion utility |
| `EY` | Auth credential resolver (API key + OAuth) |
| `u3` | Async context / store helper |
| `XH7` | Request metadata injector |
| `R_` | Retry / backoff logic |
| `lc6` | Proxy-auth helper executor |
| `vH7` | Streaming response handler (SSE / EventStream) |
| `Lw` | Provider enum / type-guard |
| `Cz` | Session-expiry and token-refresh handler |
| `PH7` | Response parser (chunk handling) |
| `nOH` | Rate-limit / timing manager |
| `om8` | Timestamp recorder |
| `dO6` | Header case-normalizer (authorization etc.) |
| `uzH` | SDK-level error logger |
| `xH8` | Chunk-to-message assembler |
| `S` | Subprocess / write-stream wrapper |
| `h` | Away-summary blur/focus handler |
| `k` | Away-summary generator |
| `E` | API response envelope handler |
| `$0H` | Client-app header finder |
| `qW` | API request wrapper (`F3`) |
| `pP` | Auth credential pipeline (key + OAuth + profile) |
| `GFH` | Provider-header builder |
| `Da6` | WIF (Workload Identity Federation) credential resolver |
| `G` | OAuth token source |
| `X` | Subprocess IPC stream reader |
| `J` | Stream data emitter |
| `w` | Background daemon session manager |
| `Qf` | Stream finisher |
| `pB5` | Daemon protocol message handler |
| `EH` | String coercion utility |
| `GEH` | Model compatibility filter (claude-3, opus-4, sonnet-4) |
| `f9` | Model feature-flag checker |
| `zR` | Provider-type resolver |
| `T` | MCP transport list |
| `Jv6` | MCP transport type A |
| `Lx8` | MCP transport type B |
| `$25` | Message content finder |
| `F9A` | SHA-256 hash generator |
| `uo6` | Cache-control header builder |
| `y1` | String utility (String constructor) |
| `bo6` | Async store getter (`KOq.getStore`) |
| `X_8` | Provider-type assertion |
| `ckH` | Prompt-cache configuration (1h, auto_mode, memdir_relevance) |
| `WA` | EY/YR/Bq composite auth invoker |
| `yp8` | Prompt cache helper A |
| `G6` | Token/event-stream session entry |
| `hp8` | Prompt cache helper B |
| `UZ` | HIPAA-compliance handler |
| `_3_` | HIPAA provider-type check |
| `WEH` | HIPAA flag formatter |
| `ZqK` | Token usage accumulator |
| `yP` | HTML entity / escape replacement |
| `cH8` | Temperature/side-query parameter injector |
| `NP` | Message array mapper |
| `fDH` | Full API request assembler (model + messages + params) |
| `RH` | JSON stringifier |
| `wU` | Request ID generator (random bytes) |
| `_7` | EY+S6 composite request dispatcher |
| `QMH` | API metrics recorder |
| `d` | Timing / date utility |
| `bJ6` | Token-count / billing tracker |
| `PM9` | Token accounting helper |
| `pnH` | Token accounting sub-helper |
| `CJ6` | Extended token tracker |
| `jc` | Agent-ID resolver |
| `bI7` | Built-in agent prefix stripper |
| `M8H` | Agent thread-type classifier |
| `SH` | Log/error sink with cache |
| `u96` | Usage/metrics finalizer |
| `Mw` | Async local store getter (`_Oq.getStore`) |
| `kO` | Additional-protection signer |
| `Bq` | Credential cache |
| `LOq` | Boolean coercion |
| `YR` | Token refresh orchestrator |
| `CTH` | OAuth credential type check |
| `qyq` | OAuth access token fetcher |
| `Kyq` | OAuth refresh token fetcher |
| `dp` | Credential serializer |
| `lN` | Auth token logger |
| `di` | Auth debug flag |
| `fr6` | Credential source resolver |
| `rgH` | Auth result formatter |
| `BK` | API key validator |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.