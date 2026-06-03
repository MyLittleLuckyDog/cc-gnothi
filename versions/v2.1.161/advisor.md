---
type: feature-spec
feature: "advisor"
cc_version: "2.1.161"
updated: "2026-06-03"
tags: ["advisor", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.161 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/advisor`

> Analysis basis: CC v2.1.161 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.161

---

## Overview

The `/advisor` command configures the **Advisor Tool** — a subsystem that consults a stronger (or specifically designated) model for guidance at key decision points during an ongoing task. When invoked, the handler validates the supplied model name, stores the selection in a persistent map, performs a lightweight API probe to verify model availability and authentication, and renders a JSX confirmation UI. If no argument is supplied or the argument is `off`/`unset`, the advisor is disabled.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `advisor` |
| description | Configure the Advisor Tool to consult a stronger model for guidance at key moments during a task |
| loc_byte | `12513424` |
| loc_byte_end | `12513711` |
| loc_line | `8781` |
| argumentHint | `null` |
| isHidden | `null` |
| module_id | `Y6K` |
| load_inline | `true` |
| arbor_handler.name | `Cvf` |
| arbor_handler.fqn | `claude-2.1.161::Cvf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.161 bundle.js:+12513424

---

## Input Branching

The command has four distinct input paths (no argument / `off` / `unset` / model name string), plus sub-branches for model validation success, authentication failure, network failure, and not-found error. A Mermaid flowchart is therefore used.

```mermaid
flowchart TD
    A(["/advisor [arg]"]) --> B{Argument present?}
    B -- "No argument" --> OFF[Disable advisor\nstore 'off' state]
    B -- "arg == 'off'" --> OFF
    B -- "arg == 'unset'" --> OFF
    B -- "Non-empty string" --> C[Trim & normalise model name]
    C --> D{Name empty after trim?}
    D -- "Yes" --> ERR_EMPTY["Error: Model name cannot be empty\n(bundle.js:+12505139)"]
    D -- "No" --> E[Lowercase + canonicalise\nvia modelNormaliser]
    E --> F{Name in known-model map?}
    F -- "Already cached" --> SKIP[Skip API probe\nuse cached entry]
    F -- "Not in cache" --> G[Call advisorModelValidate\n(side-query API call)]
    G --> H{API response}
    H -- "200 / success" --> OK[Store model in M6K map\nrender confirmation JSX]
    H -- "401 / auth error" --> ERR_AUTH["Error: Authentication failed.\nCheck API credentials.\n(bundle.js:+12505838)"]
    H -- "Network error" --> ERR_NET["Error: Network error.\nCheck internet connection.\n(bundle.js:+12505940)"]
    H -- "not_found_error type" --> ERR_NF["Error: model: <name> not found\n(bundle.js:+12506059 / +12506141)"]
    SKIP --> OK
    OFF --> RENDER_OFF[Render 'advisor disabled' JSX]
```

Analysis basis: CC v2.1.161 bundle.js:+12512880, +12512956, +12512967, +12513034, +12513048

---

## Behavioral Spec

### Handler Entry — `advisorCommandHandler` (Cvf)

The Arbor-resolved handler is the async function `Cvf`, reached via `module_id` → `Y6K`.

```
async function advisorCommandHandler(inputArg, appContext):
    rawText = inputArg.trim()                        // bundle.js:+12512880

    # ── Disable path ──────────────────────────────────────────────
    if rawText == "" or rawText == "off" or rawText == "unset":
        // literals "off" @ +12512956, "unset" @ +12512967
        disableAdvisor(appContext)
        return renderAdvisorDisabledJSX()            // DP.createElement @ +12512916

    # ── Validate & normalise model name ───────────────────────────
    normalised = modelNameResolver(rawText)          // s9 @ +12513034
    if normalised is null:
        raise "Model name cannot be empty"           // +12505139

    # ── Cache check ───────────────────────────────────────────────
    if knownModelMap.has(normalised):                // M6K.has @ +12505383
        return renderConfirmationJSX(normalised)

    # ── API validation probe ──────────────────────────────────────
    result = await advisorModelValidate(normalised)  // $S8 @ +12513048
    knownModelMap.set(normalised, result)            // M6K.set @ +12505591

    # ── Build & return UI ─────────────────────────────────────────
    modelList = joiner(appContext.availableModels)   // joH.join @ +12513191
    return renderAdvisorConfiguredJSX(normalised,
                                      modelList,
                                      appContext)    // H @ +12513074, n26 @ +12513122
```

Analysis basis: CC v2.1.161 bundle.js:+12512880

---

### Sub-feature: Model Name Resolver — `modelNameResolver` (s9)

Translates user-supplied shorthand aliases into canonical model identifiers. Aliases recognised at depth-2 include `opusplan`, `sonnet`, `haiku`, `opus`, and `best` (literals at bundle.js:+2236154, +2236195, +2236234, +2236273, +2236310). The `[1m]` suffix token (bundle.js:+2236180) is also consumed during parsing.

```
function modelNameResolver(rawName):
    trimmed = rawName.trim()                          // +2236058
    lower   = trimmed.toLowerCase()                   // +2236069

    # Known shorthand table
    if lower in {"opusplan","sonnet","haiku","opus","best"}:
        return expandAlias(lower)                     // x0 @ +2236087

    # Strip provider prefix patterns like "anthropic."
    cleaned = trimmed.replace(providerPrefixRegex, "") // +2236097

    # Validate character set via allowlist check
    if not charsetValidator(cleaned):                  // NKH @ +2236133
        raise validation error

    return canonicalModelName(cleaned)                 // aN @ +2236172
```

Analysis basis: CC v2.1.161 bundle.js:+2236058

---

### Sub-feature: Advisor Model Validate — `advisorModelValidate` ($S8)

Fires a lightweight `side_query` API call (literal `"side_query"` at bundle.js:+13322059) using the standard API client (`gu` → `vU`) to confirm the model exists and credentials are valid.

```
async function advisorModelValidate(modelName):
    trimmed = modelName.trim()                        // +12505102

    lower   = trimmed.toLowerCase()                   // +12505262

    # Reject unsupported provider prefixes
    if providerBlocklist.includes(lower):             // vKH.includes @ +12505281
        raise validation error

    telemetry("model_validation", {model: lower})     // literal @ +12505478

    # Probe call
    response = await sideQueryApiCall(lower)          // nQ @ +12505173, gu @ +12505428

    if response.error.type == "not_found_error":      // +12506059
        raise formatError("model: " + modelName)      // +12506141

    if response.isAuthError:
        raise "Authentication failed. Please check your API credentials."  // +12505838

    if response.isNetworkError:
        raise "Network error. Please check your internet connection."      // +12505940

    # Cache the validated result with ephemeral cache control
    // literal "ephemeral" @ +12505572
    storeWithEphemeralCache(modelName, response)      // M6K.set @ +12505591

    return buildAdvisorConfig(response)               // Tvf @ +12505632
```

Analysis basis: CC v2.1.161 bundle.js:+12505102

---

### Sub-feature: Advisor Config Builder — `buildAdvisorConfig` (Tvf → Zvf)

Builds the final advisor configuration record that is persisted and surfaced in the UI.

```
function buildAdvisorConfig(validationResponse):
    config = innerConfigBuilder(validationResponse)   // Zvf @ +12505687

    # Zvf canonicalises the model string one more time
    base   = modelBaseFormatter(config)               // UM @ +12506360
    lc     = config.name.toLowerCase()               // +12506378
    if specialModelList.includes(lc):                 // _.includes @ +12506397
        // Recognises "opus-4-8/7/6/5", "sonnet-4-6/5" variant strings
        // literals @ +12506408 … +12506785
        variant = resolveVariantModel(lc)             // Vf @ +12506451
        config  = mergeVariant(base, variant)

    return String(config)                             // +12506328
```

Analysis basis: CC v2.1.161 bundle.js:+12505687

---

### Sub-feature: Locale / Model Include Check — `includeCheck` (n26)

Called near the end of `advisorCommandHandler` to decide whether the confirmed model name should appear in the rendered model list.

```
function includeCheck(modelName, candidateList):
    lower = modelName.toLowerCase()                   // +5406461
    return candidateList.includes(lower)              // +5406484
```

Analysis basis: CC v2.1.161 bundle.js:+5406461

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_api_success` | Fired on successful side-query API call (bundle.js:+13323512) |
| Telemetry — `tengu_prompt_cache_1h_config` | Fired when 1-hour prompt-cache configuration is applied to the side query (bundle.js:+13282782) |
| Telemetry — `tengu_feature_sad` | Fired on certain failure paths in the API layer (bundle.js:+966732) |
| Persistent map write | `M6K.set(normalised, result)` — caches the validated model for the session lifetime (bundle.js:+12505591) |
| appState changes | Advisor model stored in application state; disabling clears it (`"off"` / `"unset"` literals at +12512956 / +12512967) |
| JSX render | Returns a `DP.createElement`-based component (bundle.js:+12512916) for inline terminal UI |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.161 | Initial analysis |

---

## Common Mistakes

1. **Passing a bare alias without checking accepted values** — only a fixed set of aliases (`opusplan`, `sonnet`, `haiku`, `opus`, `best`) are expanded. Arbitrary shorthand strings will fail validation (bundle.js:+2236133).
2. **Using `off` to change the model** — both `off` and `unset` unconditionally disable the advisor; they are not treated as model names (bundle.js:+12512956, +12512967).
3. **Expecting instant availability after `/advisor <model>`** — the command fires an async `side_query` API call; in high-latency environments the confirmation UI may appear after a noticeable pause.
4. **Supplying a model string with an empty result after trimming** — the handler raises "Model name cannot be empty" (bundle.js:+12505139) before reaching the API probe.
5. **Using a variant name suffix not on the recognised list** — model variant identifiers such as `opus-4-8`, `sonnet-4-5`, etc. are matched case-insensitively against an internal list (bundle.js:+12506408–+12506785); unexpected capitalisation or additional suffixes will fall through to a generic not-found error.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Cvf` | Main handler — `advisorCommandHandler` (AsyncFunction, arbor_handler) |
| `s9` | Model name resolver / alias expander |
| `$S8` | Advisor model validate (API probe) |
| `Tvf` | Advisor config builder (outer) |
| `Zvf` | Advisor config builder (inner, canonicalises variant model strings) |
| `n26` | Include-check helper (toLowerCase + includes) |
| `gu` | Side-query API call orchestrator |
| `vU` | Core Anthropic API client (request builder + sender) |
| `nQ` | Model query formatter (trims, maps, validates provider prefix) |
| `M6K` | Known-model persistent Map (has/set used for cache) |
| `DP` | React / JSX createElement reference |
| `joH` | Available-model array used for join in confirmation render |
| `A` | Generic trimmed-string / result variable (context-dependent) |
| `f` | File/stream handle (context-dependent) |
| `q` | Queue / collection (context-dependent) |
| `L` | Lifecycle / cleanup helper |
| `H` | Generic argument / response object (context-dependent) |
| `N` | Bootstrap fetch / model info retrieval helper |
| `VBK` | Provider URL builder |
| `SH` | JSON serialiser helper |
| `Z4` | String slicer / redactor (produces `[REDACTED]` literal at +196705) |
| `imH` | Model info annotator |
| `IBK` | File-based model cache reader |
| `ne` | Workspace trust / allow-list check |
| `Ij` | Path / name replacement helper |
| `lq` | Model resolution pipeline |
| `xHH` | Resolution sub-pipeline (calls NT, o9H, VA, nQ) |
| `xP` | Extended resolution path (calls s9, b0) |
| `t6` | Feature-flag / sad-path handler |
| `d` | Generic data/descriptor object |
| `h1H` | Sad-path sub-handler (calls Xa8) |
| `x0` | Alias expander dispatcher |
| `kKH` | Alias lookup table wrapper |
| `pH` | String conversion / coercion utility |
| `NKH` | Charset / allowed-model validator |
| `aN` | Canonical model name constructor |
| `UM` | Model base formatter |
| `PA` | Provider adapter / config reader |
| `Vf` | Variant model resolver |
| `MmH` | Model metadata helper |
| `fB4` | Full model record builder |
| `r7q` | Object.entries-based model-list iterator |
| `_a6` | Model find + annotator |
| `CgH` | Config-get helper (calls Vf) |
| `KG` | Config-set helper (calls UM, Vf, PA) |
| `Xwq` | Config-swap helper (calls KG) |
| `Us6` | Allowed-provider list checker |
| `bgH` | Provider name formatter (calls pH) |
| `nC6` | Plugin / staging path resolver |
| `K` | Column-padding / display formatter |
| `Aa6` | Object.entries-based annotation helper |
| `t_` | Annotation base builder |
| `RgH` | Operator include-list checker |
| `Pwq` | Index-of based model position finder |
| `zHL` | Compound include-checker (H.includes + NKH + s9) |
| `DHL` | Prefix-based model discriminator (Jwq + s9) |
| `Jwq` | `claude-` prefix startsWith guard |
| `Nw` | AsyncLocalStorage store reader |
| `IzL` | Session-ID string parser (split/trim/indexOf/slice) |
| `W9` | Background context tag getter (`"bg"` literal) |
| `lr` | Store retrieval helper (calls Bs6) |
| `N6` | XN-based module resolver |
| `BL_` | URL-encode helper (replace + encodeURIComponent) |
| `T3` | ND_-based request finaliser |
| `Vwq` | Boolean coercion wrapper |
| `KD` | API key / auth credential builder |
| `n3` | Generic numeric / counter helper |
| `vzL` | jj/PdH-based response validator |
| `B_` | Generic boolean flag |
| `Hi6` | Proxy-auth helper (trust check, 30 s timeout) |
| `CzL` | Request context / UUID builder |
| `IY` | Model capability checker |
| `HD` | Response header parser |
| `NzL` | Retry / backoff controller |
| `pzH` | Timing / promise-resolve helper |
| `lB8` | Date.now timestamp helper |
| `CD6` | Header case-normaliser (toLowerCase) |
| `yDH` | SDK error/warn logger |
| `B88` | Request pipeline entry (tX, lq, _9, EN) |
| `S` | Stream / daemon write channel |
| `h` | Focus/blur session timer |
| `I` | Away-summary generator |
| `Z` | Generic accumulator |
| `GEH` | Provider prefix finder |
| `JW` | e3-based job-wait helper |
| `Sj` | OAuth session builder |
| `BzH` | Provider info extender (ngH + RH + X6L) |
| `ngH` | WIF credentials resolver (fetch + AbortSignal) |
| `G` | Remote-control event handler |
| `P` | IPC message pump (Buffer.concat) |
| `J` | Socket / stream reference |
| `w` | Background worker manager (spawn, kill, freemem) |
| `e5` | Stream-end / SH serialiser |
| `Y95` | Full daemon session handler (PTY protocol) |
| `TH` | String-based type header builder |
| `SVH` | Model-tier selector (_9, IY, Iy) |
| `_9` | Annotation + inference-profile builder |
| `Iy` | PA-based secondary capability checker |
| `W` | SDK transport wrapper (http/sse/dynamic) |
| `Y16` | SDK initialiser |
| `yH` | Error-recovery / retry helper |
| `a_` | Error string normaliser |
| `euf` | User-message finder |
| `SLA` | SHA-256 hash builder (O7K.createHash) |
| `gs6` | Cache-string formatter (` cch=00000;` pattern) |
| `v1` | String identity helper |
| `Bs6` | Zwq AsyncLocalStorage getter |
| `Zq8` | PA-based response post-processor |
| `HyH` | Main REPL thread request builder |
| `wA` | KD/SR/Bq credential assembler |
| `VF8` | Feature-flag reader |
| `j6` | Model-dispatch selector (gY6, QY6, Qx) |
| `vF8` | Secondary feature-flag reader |
| `kV` | HIPAA / compliance config gate |
| `PD_` | PA-based HIPAA config reader |
| `hVH` | kL_-based HIPAA enforcement helper |
| `U7K` | Usage-tracking helper |
| `a88` | Temperature / sampling parameter builder |
| `oX` | H.map-based message formatter |
| `KwH` | Request finaliser (SH, hU, zL, N6) |
| `hU` | Random-bytes nonce generator |
| `zL` | KD/y6 request-context linker |
| `u$H` | Unknown usage helper |
| `NX6` | qD9/YrH/vX6-based agent-type router |
| `qD9` | elL/yH agent dispatcher |
| `YrH` | Agent result handler |
| `vX6` | m58-based agent variant handler |
| `vc` | tlL/d8H/yH agent entry point |
| `tlL` | `agent:builtin:` / `agent:custom:` prefix dispatcher |
| `d8H` | `repl_main_thread` thread-type checker |
| `EK6` | End-of-request cleanup |