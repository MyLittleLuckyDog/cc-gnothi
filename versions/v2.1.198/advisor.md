---
type: feature-spec
feature: "advisor"
cc_version: "2.1.198"
updated: "2026-07-02"
tags: ["advisor", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.198 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/advisor`

> Analysis basis: CC v2.1.198 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.198

---

## Overview

The `/advisor` command lets users configure which AI model Claude Code consults as a "stronger" advisor at key decision points during a session. It validates the requested model name, applies the setting (either permanently or for the current session only), and renders a JSX-based confirmation UI. The command operates through an async handler that resolves via the `module_id`-linked `Vnm` function.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `advisor` |
| description | `Let Claude consult a stronger model at key moments` |
| argumentHint | `[ ... ]` |
| thinClientDispatch | `control-request` |
| isHidden | `null` (not hidden) |
| module_id | `esc` |
| load_inline | `true` |
| loc_byte | `13135875` |
| loc_byte_end | `13136186` |
| loc_line | `8983` |
| arbor_handler.name | `Vnm` |
| arbor_handler.fqn | `claude-2.1.198::Vnm` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.198 bundle.js:+13135875

---

## Input Branching

The command has four or more distinct branches depending on the connection mode, model validation outcome, and scope flag, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/advisor [model] [flags]"] --> B{Control channel available?}
    B -- No --> C[Return error:\n'advisor can't be changed\nfrom this client']
    B -- Yes --> D{Input argument present?}
    D -- No --> E[Render current advisor UI\nwith available model list]
    D -- Yes --> F[Trim & normalize model name]
    F --> G{Model name empty after trim?}
    G -- Yes --> H[Return error:\n'Model name cannot be empty']
    G -- No --> I[Validate model name via\nmodelValidator / normalize]
    I --> J{Model valid / recognized?}
    J -- No --> K[Return error:\nnot_found_error or auth/network error]
    J -- Yes --> L{Session-only flag set?}
    L -- Yes --> M[Apply advisor setting\nfor this session only\nappend ' (this session only)' label]
    L -- No --> N[Persist advisor setting\nvia apply_flag_settings]
    M --> O[Emit tengu_advisor_command telemetry]
    N --> O
    O --> P[Render JSX confirmation UI]
```

Analysis basis: CC v2.1.198 bundle.js:+13135345, +13135381, +13131519, +13131637, +9770502, +9770816, +13131777

---

## Behavioral Spec

### 1. Entry Point — Main Handler (`Vnm`)

The Arbor-resolved handler is `Vnm` (an `AsyncFunction`), reached via `module_id: "esc"` with `load_inline: true`.

```
async function advisorCommandHandler(userInput, appContext):
    rawArg = userInput.trim()                          // +13135345

    if not appContext.hasControlChannel():
        return renderError(
            "The advisor can't be changed from this client"
            + " — this connection is view-only or has no control channel"
        )                                              // +13131519

    jsxElement = buildJsx(Nj, ...)                    // +13135381
    modelResult = await resolveModelSelection(rawArg, appContext)  // +13135479
    commandContext = buildCommandContext(appContext)   // +13135493

    if rawArg is not empty:
        await applyAdvisorChange(rawArg, appContext, commandContext)
    else:
        renderCurrentAdvisor(appContext)              // +13135567, +13135640

    return jsxElement
```

Analysis basis: CC v2.1.198 bundle.js:+13135345, +13135381, +13135493

---

### 2. Model Name Validation (`C7t`)

Called with the raw argument string. Normalizes and validates the supplied model name.

```
async function validateModelName(rawName, appContext):
    name = rawName.trim()                             // +9770465

    if name is empty:
        raise Error("Model name cannot be empty")     // +9770502

    normalized = name.toLowerCase()                   // +9770650

    if modelIsInKnownSet(normalized, knownModelsSet): // +9770771 (JMo.has)
        recordValidation(normalized)                  // +9770979 (JMo.set)
        return normalized

    // Unknown — attempt live validation via side query
    validationResult = await performSideQuery(normalized, appContext)  // +9770816 (WU)

    if validationResult.error == "not_found_error":   // +9771459
        raise ModelNotFoundError("model:" + normalized)  // +9771541

    if validationResult is authError:
        raise Error("Authentication failed. Please check your API credentials.")  // +9771238

    if validationResult is networkError:
        raise Error("Network error. Please check your internet connection.")  // +9771340

    emitTelemetry("model_validation", { model: normalized })  // +9770866

    return normalized
```

Analysis basis: CC v2.1.198 bundle.js:+9770465, +9770502, +9770650, +9770771, +9770816, +9770866

---

### 3. Side-Query API Call (`WU`)

Sends a minimal `side_query` request to the Anthropic API (or configured gateway) to confirm the model exists. Used by `C7t` for models not already in the local known-models cache.

```
async function sideQueryModelValidation(modelName, appContext):
    headers = buildStandardHeaders(appContext)        // +9297470 (xV)
    headers["side_query"] = "structured_outputs"     // +9297502, +9297630

    // Constructs a minimal user/text message pair
    message = { role: "user", content: [{ type: "text", text: "Hi" }] }
                                                     // +9297067, +9297165, +9770935

    cacheKey = hashMessage(message, modelName)        // +9296492 (sha256 hex) // +9297693 (eko)
    if cache.has(cacheKey):
        return cache.get(cacheKey)

    // Sends request, reads first two streaming chunks maximum
    response = await callAPI(modelName, [message], { maxChunks: 2 })
                                                     // +9297329 (number: 2)

    result = parseResponse(response)
    cache.set(cacheKey, result)
    emitTelemetry("tengu_api_success", result)        // +9299175
    return result
```

Analysis basis: CC v2.1.198 bundle.js:+9297457, +9297470, +9297502, +9297559, +9297563, +9297630, +9299175

---

### 4. Model Name Resolution and Normalization (`Fo` / `resolveModelFullName`)

Converts shorthand names (e.g., `"opus"`, `"sonnet"`, `"haiku"`, `"best"`, `"opusplan"`) to canonical model IDs. Also validates against known model tiers.

```
function resolveModelFullName(rawInput, context):
    trimmed = rawInput.trim()                         // +2342743
    lower = trimmed.toLowerCase()                     // +2342754

    // Shorthand expansions
    if lower matches "opus":     return resolveOpus(context)   // +2328796
    if lower matches "sonnet":   return resolveSonnet(context) // +2328975
    if lower matches "haiku":    return resolveHaiku(context)  // +2329156
    if lower matches "fable":    return "claude-fable-5" (or similar) // +2328600
    if lower matches "best":     return resolveBestModel(context)  // +2343046
    if lower matches "opusplan": return resolveOpusPlan(context)   // +2342887
    if lower matches "[1m]":     append "(1M context)" suffix  // +2342871, +2342418

    // Tier-aware resolution via model registry (lpi, nl, x1t, etc.)
    canonicalId = resolveViaModelRegistry(lower, context)  // +2342835, +2342913

    return canonicalId
```

Known concrete model identifiers found in literals include `claude-fable-5`, `claude-mythos-5`, `claude-opus-4-8` through `claude-opus-4-0`, `claude-sonnet-5`, `claude-sonnet-4-6` through `claude-sonnet-4-0`, `claude-haiku-4-5`, `claude-3-7-sonnet`, `claude-3-5-sonnet`, `claude-3-5-haiku`, `claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku`.

Analysis basis: CC v2.1.198 bundle.js:+2342743, +2342754, +2342800, +2343046, +2343060, +2343078

---

### 5. Applying the Advisor Setting (`bjo` / `applyAdvisorSetting`)

After validation, persists or temporarily applies the new advisor model.

```
function applyAdvisorSetting(validatedModel, appContext, sessionOnly):
    if not appContext.hasControlChannel():
        // Guard is checked again here as defence-in-depth
        return renderError("The advisor can't be changed from this client...")  // +13131519

    if sessionOnly:
        // Apply in-memory only; append scope label to UI
        appContext.setAdvisorModelTemp(validatedModel)
        label = validatedModel + " (this session only)"  // +13131637
    else:
        // Persist via flagSettings path
        applyFlagSettings("apply_flag_settings", { advisor: validatedModel })  // +13131777

    emitTelemetry("tengu_advisor_command", {
        model: validatedModel,
        sessionOnly: sessionOnly
    })                                                  // +13131458

    renderAdvisorConfirmation(validatedModel, label)    // +13131845 (eo), +13131921 (Qu)
```

Analysis basis: CC v2.1.198 bundle.js:+13131448, +13131456, +13131508, +13131519, +13131637, +13131777, +13131458, +13131845

---

### 6. Advisor State UI Component (`WMe` / `renderAdvisorState`)

Renders the current advisor state and available models as a JSX component. Called both when no argument is supplied (display-only) and after a successful change.

```
function renderAdvisorState(appContext):
    commandList = buildAvailableCommandsList(appContext)  // +5584071 (nl)
    filteredList = filterByPermissions(commandList)       // +5584089 (Kfo)
    modelInfo = resolveCurrentAdvisorModel(appContext)    // +5584110 (so), +5584118 (Yfo)

    // Yfo internally queries: so, Fo, hr, y_e, S_e, rst, qIn
    // to produce a structured model-info object
    return <AdvisorPanel
        currentModel={modelInfo}
        availableModels={filteredList}
    />
```

Analysis basis: CC v2.1.198 bundle.js:+5584071, +5584089, +5584110, +5584118, +5583826, +5583829

---

### 7. Available-Models Listing (`Vpt` / `buildAvailableModelsList`)

```
function buildAvailableModelsList(appContext):
    allModels = Lbp.filter(isPermitted)               // +5584027
    return allModels.map(m => formatModelEntry(m, Qu, Fo))  // +5584043 (n3n)
```

Analysis basis: CC v2.1.198 bundle.js:+5584027, +5584043

---

### 8. Process-Exit on Unrecoverable Error (`As`)

When a fatal CLI error occurs during advisor handling (e.g., unrecoverable API failure), the error path calls `process.exit(1)`.

```
function handleFatalError(errorData):
    emitTelemetry("cli_error", errorData)             // +13219803
    logError(errorData)                               // +13219800 (fI)
    process.exit(1)                                   // +13219816, literal: 1
```

Analysis basis: CC v2.1.198 bundle.js:+13219793, +13219800, +13219803, +13219816

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_advisor_command` | Fired on every successful advisor model change (bundle.js:+13131458) |
| Telemetry — `tengu_api_success` | Fired after a successful side-query API call validates the model (bundle.js:+9299175) |
| Telemetry — `tengu_feature_ok` | Fired when a feature check succeeds in the `Le`/`xe` path (bundle.js:+1039573) |
| Telemetry — `tengu_feature_bad` | Fired when a feature check fails (bundle.js:+1039640) |
| Telemetry — `tengu_feature_sad` | Fired on a feature check sad path (bundle.js:+1039721) |
| Telemetry — `tengu_lone_surrogate_sanitized` | Fired when lone surrogates are sanitized in API response (bundle.js:+9298871) |
| Telemetry — `tengu_prompt_cache_1h_config` | Fired when 1-hour prompt cache config is applied during the side-query (bundle.js:+13992499) |
| Telemetry — `tengu_daemon_control` | Fired on daemon control operations triggered indirectly (bundle.js:+18414881) |
| appState changes | Sets the advisor model in appState (session-only via in-memory flag, or persisted via `apply_flag_settings`/flagSettings). See literals `"apply_flag_settings"` (bundle.js:+13131777) and `"flagSettings"` (bundle.js:+1366072). |
| Settings persistence | Permanent changes are written through the settings subsystem (`userSettings`, `projectSettings`, `localSettings`). |
| Control-channel guard | Command refuses to execute model changes if `thinClientDispatch: "control-request"` cannot be fulfilled — returns a view-only error string (bundle.js:+13131519). |
| Hook registration | No direct hook registration detected at depth-2. |
| Sound | No sound effects detected in this command's call graph. |
| Model cache | The side-query result is cached in `JMo` (a `Map`) keyed by a SHA-256 hash (4 nibbles, 7 nibbles, 20 nibbles) of the query. Cache hit skips the live API call (bundle.js:+9770771, +9296492). |

---

## Version History

| Version | Change |
|---|---|
| v2.1.198 | Initial analysis |

---

## Common Mistakes

1. **Passing a bare shorthand without understanding tier resolution.** Names like `"opus"`, `"sonnet"`, `"haiku"`, and `"best"` are expanded to canonical model IDs based on the current session's tier and policy. The result may differ across team, enterprise, and personal accounts.
2. **Expecting a permanent change from a view-only or thin-client session.** The command checks for a control channel first. If the session was started with limited dispatch capabilities (`thinClientDispatch: "control-request"` is not satisfiable), the advisor cannot be changed and an error is returned.
3. **Omitting the argument when intending to change the advisor.** Running `/advisor` with no argument renders the current advisor and available model list — it does not reset the advisor. Supply the model name or shorthand explicitly.
4. **Using a model name that passes trim but is otherwise invalid.** After whitespace normalization the name is sent to a live side-query validation call. Network errors or authentication failures surface as distinct messages; a not-found response produces a `not_found_error` type error.
5. **Assuming session-only changes survive a restart.** When the session-only scope is active (implied by the `" (this session only)"` label), the advisor setting lives only in memory and is not persisted to `userSettings` or `projectSettings`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Vnm` | Main async handler for `/advisor` command (entry point) |
| `C7t` | Model name validation function; trims, normalizes, and live-validates model strings |
| `WU` | Side-query API call function; sends minimal validation request to confirm model existence |
| `Fo` | Model full-name resolver; expands shorthands to canonical model IDs |
| `bjo` | Advisor-setting apply function; persists or temporarily sets the advisor model |
| `WMe` | Advisor state UI renderer; builds JSX panel showing current model and available options |
| `Vpt` | Available-models list builder; filters and formats models for display |
| `n3n` | Model-entry formatter called by `Vpt` |
| `Yfo` | Current-advisor-model resolver; queries session state and model registry |
| `As` | Fatal CLI error handler; logs and calls `process.exit(1)` |
| `nl` | Command/model list builder used by the UI layer |
| `lpi` | Model list preparation helper feeding `nl` |
| `S_e` | Model-state resolver helper |
| `kw` | Model keyword resolution dispatcher |
| `so` | Model sort/select utility |
| `p_` | Model prefix-routing helper (handles region prefix "us", ARN patterns, etc.) |
| `ySf` | Per-model-tier advisor mapping function |
| `_Sf` | Advisor tier-dispatch function wrapping `ySf` |
| `Eo` | Tier-context resolver (max, team, enterprise tiers) |
| `x1t` | Full command/parameter parser (deep in the slash-command parsing pipeline) |
| `QC` | Command context builder |
| `QR` | Command renderer |
| `k1t` | Inner command resolver |
| `Op` | Option-parser for command arguments |
| `tCn` | API call setup helper (headers, context) |
| `cKe` | Main REPL API dispatch used by the side-query path |
| `nR` | HIPAA/compliance filter applied during API calls |
| `mr` | Model-record lookup |
| `fu` | Model-feature-flags accessor |
| `st` | String utility / coerce-to-string |
| `ca` | Canonical model-ID cleanup |
| `Aw` | Model-availability check helper |
| `Md` | Model display-name resolver |
| `Qle` | Model allowlist inclusion check |
| `A1t` | Model argument normalizer with prefix handling (`claude-`) |
| `GIn` | Recursive model-list resolver |
| `ost` | Outer model-string tokenizer |
| `I6r` | Inner model-token router |
| `KIn` | Model-keyword index lookup |
| `rp` | Raw model parameter builder |
| `UY` | First-party model resolver |
| `VY` | Model-name replacer/normalizer |
| `KS` | Sonnet-family resolver |
| `VIn` | Sonnet-variant inner resolver |
| `L6` | Haiku-family resolver |
| `w6r` | Haiku-variant inner resolver |
| `Ey` | Opus-family resolver |
| `pxe` | Opus-variant inner resolver |
| `xV` | Low-level Anthropic API call builder (headers, auth, streaming) |
| `I$d` | Streaming response session manager |
| `oSn` | Proxy-auth helper runner |
| `hh` | HTTP response parser and chunk accumulator |
| `Qxn` | Streaming chunk processor |
| `pb` | Parsed-response object builder |
| `Sxe` | WIF token exchange credential provider |
| `_st` | WIF credentials resolver (fetch-based) |
| `eko` | SHA-256 hash builder for cache keys |
| `ghf` | Model cache lookup (find in known-models arrays) |
| `IGr` | Cache-set-and-tag helper |
| `CGr` | Response field extractor |
| `Mfi` | Response mime-type / field matcher |
| `yr` | Non-conforming model flag helper |
| `Um` | UI primitive (OQe wrapper) |
| `Do` | UI display object |
| `Ke` | UI element wrapper |
| `eo` | Settings loader (reads all settings layers from disk) |
| `Oh` | Settings resolution entry |
| `Vwe` | Settings file path resolver |
| `x3` | Settings context builder |
| `h1r` | Disk settings reader |
| `XRs` | Settings merge helper |
| `m1r` | Settings field collector |
| `Y8` | Settings cache manager |
| `d1r` | Settings document parser |
| `zRs` | Settings inline-SDK merger |
| `Wnt` | Settings field normalizer |
| `IHe` | File reader with encoding detection |
| `Wd` | Path resolver (realpath) |
| `BMt` | Atomic file writer |
| `Fgn` | Gitignore-aware file writer |
| `g` | Background-daemon session dispatcher |
| `gis` | Background-session lifecycle manager |
| `dis` | Daemon socket connector |
| `nt` | Tool-call registry helper |
| `Re` | Telemetry push helper |
| `Le` | Feature-flag evaluator |
| `xe` | Feature-flag sad-path evaluator |
| `Pe` | Feature gate checker |
| `z` | MCP tool filter (`mcp__` prefix) |
| `E7e` | Away-summary state reader |
| `L` | Away-summary generation orchestrator |
| `sVt` | Away-summary request builder |
| `F7t` | Local-workflow task tracker |
| `tMe` | Loop-pending check |
| `w2c` | Conversation-tail reader |
| `L2c` | Recap message builder |
| `CFm` | Window-focus context reader |
| `X3t` | Span/workspace tracker |
| `a2` | Agent-type resolver |
| `vsp` | Agent prefix parser |
| `tO` | Thread-type classifier |
| `lfl` | Lone-surrogate sanitizer |
| `eun` | Message array mutation helper (pop/push) |
| `XZe` | Message array text normalizer |
| `LP` | Structured-clone helper |
| `Qcn` | Text-content block validator |
| `Zcn` | Text-content block normalizer |
| `IMe` | Inference-request builder |
| `z6` | Conversation-ID generator (random bytes) |
| `Fc` | Full inference context builder |
| `Me` | JSON serializer wrapper |
| `FMn` | Model-record fetcher for inference |
| `s0n` | Temperature / sampling-params builder |
| `xw` | Message mapper |
| `Exe` | Stream-timing tracker |
| `pTr` | Performance timestamp helper |
| `FFt` | Header field lowercaser |
| `T$d` | Session-cookie manager |
| `y$d` | Streaming session state machine |
| `Hf` | HTTP client factory |
| `kt` | Low-level stream writer |
| `KY` | URL builder |
| `h7r` | Header line parser |
| `li` | App-type label resolver (`bg`, `cli-bg`, `cli`) |
| `pX` | User-agent string builder |
| `D6r` | URL encoder |
| `T` | API transport (write/flush) |
| `Fh` | OAuth token refresher |
| `hpi` | Boolean coercion helper |
| `cE` | Auth-flow coordinator |
| `_$d` | Git context reader |
| `I3` | Locale/time-zone context builder |
| `hh` | HTTP chunk accumulator (duplicate entry, same as above) |
| `u0e` | SDK error logger |
| `I$` | Inference-profile ARN handler |
| `b6` | Bedrock credential resolver |
| `KWr` | Foundry credential resolver |
| `FKr` | Azure Foundry credential resolver |
| `qKr` | Anthropic-on-AWS credential resolver |
| `Mn` | Process timeout/abort helper |
| `oXe` | Memory stats collector (macOS) |
| `EGe` | File-based context reader |
| `Q` | Background session retire helper |
| `Oi` | ANSI strip utility |
| `c_` | Control-channel accessor |
| `Ul` | UI element factory |