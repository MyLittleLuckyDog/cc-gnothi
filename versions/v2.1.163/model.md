---
type: feature-spec
feature: "model"
cc_version: "2.1.163"
updated: "2026-06-05"
tags: ["model", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.163 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/model`

> Analysis basis: CC v2.1.163 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.163

---

## Overview

The `/model` command lets users switch the active AI model for the current Claude Code session, optionally persisting the selection as the default for future sessions. When invoked with an argument, it validates the model name (including account-level feature checks for extended-context variants), performs a lightweight live probe against the API, then updates both the in-session app state and, conditionally, the user settings file on disk. When invoked without an argument it displays the currently active model.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `model` |
| description | `Set the AI model for Claude Code` |
| argumentHint | `<model>` |
| supportsNonInteractive | `true` |
| module_id | `B9K` |
| load_inline | `true` |
| loc_byte | `12694466` |
| loc_byte_end | `12694640` |
| loc_line | `9080` |
| arbor_handler.name | `RCf` |
| arbor_handler.fqn | `claude-2.1.163::RCf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.163 bundle.js:+12694466

---

## Input Branching

The command has more than three distinct execution paths (no argument / empty argument, inline model shorthand expansion, account feature checks, live API validation, and settings persistence), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/model [arg] invoked"]) --> B{Argument provided?}
    B -- No --> C[Display current model name and exit]
    B -- Yes --> D["Trim whitespace from input\n(RCf → H.trim, +12661421)"]
    D --> E{Input empty after trim?}
    E -- Yes --> F[Error: 'Model name cannot be empty'\n(+12622437)]
    E -- No --> G{Is input a known shorthand alias?\ne.g. 'best', 'opus', 'sonnet',\n'haiku', 'opusplan', '[1m]' suffixes}
    G -- Yes --> H[Resolve canonical model ID via\nalias expansion table\n(+2243153–2243495)]
    G -- No --> I[Use input as-is, normalise case\n(+12622560)]
    H --> J{Check provider context\nbedrock / vertex / foundry / firstParty}
    I --> J
    J --> K{Extended-context '1M' model requested?}
    K -- opus[1m] --> L{Account has opus-1M entitlement?}
    L -- No --> M[Error: opus_1m_unavailable\n(+12624430)\nReturn early]
    L -- Yes --> N[Continue]
    K -- sonnet[1m] / sonnet-4-6[1m] --> O{Account has sonnet-1M entitlement?}
    O -- No --> P[Error: sonnet_1m_unavailable\n(+12624647)\nReturn early]
    O -- Yes --> N
    K -- No 1M suffix --> N
    N --> Q["Live API probe: send minimal\n'Hi' user message + ephemeral\ncache control to model\n(+12622845, +12622870)"]
    Q --> R{HTTP / API result}
    R -- Auth error --> S[Error: Authentication failed\n(+12623136)]
    R -- Network error --> T[Error: Network error\n(+12623238)]
    R -- not_found_error --> U[Error: invalid_model\n(+12624930)]
    R -- Exception --> V[Error: validate_exception\n(+12625027)]
    R -- Success --> W{Non-interactive mode OR\ninteractive session?}
    W --> X["Update appState: set model field\n(+12625812)"]
    X --> Y{User settings writable &\nnot managed policy?}
    Y -- Yes, save default --> Z["Persist model to userSettings\n(model_set_default, +12625765)\nMessage: '…saved as your default'\n(+12625407)"]
    Y -- No / session only --> AA["Session-only change\nMessage: '…for this session only'\n(+12625453)"]
    Z --> AB[Display confirmation with\nfast-mode and credits annotations\n(+12625571, +12625622, +12625668)]
    AA --> AB
    AB --> AC([Done])
    M --> AC
    P --> AC
    S --> AC
    T --> AC
    U --> AC
    V --> AC
    F --> AC
    C --> AC
```

---

## Behavioral Spec

### 1 — Entry point: handler `RCf`

`RCf` is an `AsyncFunction` resolved via `module_id` → `B9K`.

```
async function handleModelCommand(options):
    rawArg = options.args  // from CLI or REPL input

    // Trim leading/trailing whitespace
    trimmedArg = rawArg.trim()                        // +12661421

    // No argument: display mode
    if trimmedArg is empty and no argument supplied:
        displayCurrentModel(getAppState().model)
        return

    // Empty after trim: error
    if trimmedArg == "":
        return error("Model name cannot be empty")    // +12622437

    // Telemetry: command used inline (non-prompt path)
    emit("tengu_model_command_inline")                // +12661579

    // Check provider allow-list
    if not allowedInCurrentContext(trimmedArg):       // +12661437 Ed6.includes
        return error("not_allowed")                   // +12624283

    // Resolve alias → canonical model ID
    canonicalModel = resolveModelAlias(trimmedArg)    // calls normaliseAndExpand

    // Account-level feature gate for 1M extended context
    checkExtendedContextEntitlement(canonicalModel)   // may return early

    // Live validation probe
    result = await validateModelLive(canonicalModel)  // calls modelValidationProbe

    if result.error:
        return displayError(result)

    // Apply to session
    applyModelToSession(canonicalModel, result)
```

Analysis basis: CC v2.1.163 bundle.js:+12661421

---

### 2 — Alias resolution (`normaliseAndExpand` / `Aq`)

The alias table maps short tokens to canonical Anthropic model IDs. Normalisation lowercases the input before lookup.

```
function normaliseAndExpand(input):
    lower = input.trim().toLowerCase()               // +2243153, +2243164

    // Tier aliases
    if lower == "opusplan":  return OPUS_PLAN_MODEL  // +2243249
    if lower contains "[1m]": handle 1M suffix       // +2243275
    if lower == "sonnet":    return SONNET_MODEL      // +2243290
    if lower == "haiku":     return HAIKU_MODEL       // +2243329
    if lower == "opus":      return OPUS_MODEL        // +2243368
    if lower == "best":      return BEST_MODEL        // +2243405

    // Provider-qualified replacement (e.g. strip/prepend prefixes)
    normalised = applyProviderReplacement(lower)     // +2243192, +2243495

    return normalised
```

The special alias `"Opus in plan mode, else Sonnet"` (bundle literal, +2241779) is the human-readable label for the `opusplan` tier that maps Opus when the session is in plan mode and Sonnet otherwise.

Analysis basis: CC v2.1.163 bundle.js:+2243153

---

### 3 — Extended-context entitlement gate (`jC8`)

```
function checkExtendedContextEntitlement(modelId):
    // Opus 1M path
    if modelId matches opus[1m] pattern:              // +12624430
        if not accountHasOpus1M():
            displayError(
              "opus_1m_unavailable",
              "Opus with 1M context is not available for your account. " +
              "Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m"
            )                                         // +12624468
            return EARLY_EXIT

    // Sonnet 1M path — checks "sonnet[1m]" and "sonnet-4-6[1m]"
    if modelId in {"sonnet[1m]", "sonnet-4-6[1m]"}:  // +12626302, +12626328
        if not accountHasSonnet1M():
            displayError(
              "sonnet_1m_unavailable",
              "Sonnet 4.6 with 1M context is not available for your account. " +
              "Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m"
            )                                         // +12624687
            return EARLY_EXIT
```

Analysis basis: CC v2.1.163 bundle.js:+12624430

---

### 4 — Live model validation probe (`DC8` → `_m`)

The command performs a real API call to confirm the model exists and the credentials are valid before committing the change.

```
async function validateModelLive(modelId):
    // Check deduplication cache to avoid repeat probes
    if validationCache.has(modelId):                  // +12622681  r1K.has
        return validationCache.get(modelId)

    // Build minimal probe message
    probePayload = {
        model: modelId,
        messages: [{ role: "user", content: "Hi" }],  // +12622845
        cache_control: { type: "ephemeral" }           // +12622870
    }

    try:
        response = await sendAPIRequest(probePayload) // _m → globalThis.fetch +13461301
        validationCache.set(modelId, SUCCESS)          // +12622889  r1K.set
        return { ok: true }

    catch AuthError:
        return { error: "Authentication failed. Please check your API credentials." }
                                                       // +12623136
    catch NetworkError:
        return { error: "Network error. Please check your internet connection." }
                                                       // +12623238
    catch APIError where type == "not_found_error":
        return { error: "invalid_model", detail: error.message }
                                                       // +12623357, +12624930
    catch Exception:
        return { error: "validate_exception" }         // +12625027
```

The probe message content (`"Hi"`, +12622845) is intentionally minimal to keep latency and token cost negligible. The cache key is the raw model ID string; the cache (`r1K`) is a `Map` that persists for the duration of the CLI process.

Analysis basis: CC v2.1.163 bundle.js:+12622681

---

### 5 — Session application and persistence (`I4A`)

```
async function applyModelToSession(modelId, validationResult):
    // Determine save scope
    settingsWritable = isUserSettingsWritable()       // calls r_ settings layer
    managedPolicy    = isManagedSettingsActive()      // +12625974

    if settingsWritable and not managedPolicy:
        saveModelToUserSettings(modelId)              // r_ userSettings path +1278808
        scopeLabel = " and saved as your default for new sessions"  // +12625407
        emit("model_set_default")                     // +12625765
    else:
        scopeLabel = " for this session only"         // +12625453

    // Update live app state
    appState.model = modelId                          // "model" key, +12625812

    // Build confirmation display
    annotation = ""
    if fastModeActive():
        annotation += " · Fast mode ON"              // +12625571
    if drawsFromUsageCredits(modelId):
        annotation += " · Draws from usage credits"  // +12625622
    if not fastModeActive():
        annotation += " · Fast mode OFF"             // +12625668

    displayConfirmation(modelId + annotation + scopeLabel)
```

Analysis basis: CC v2.1.163 bundle.js:+12625407

---

### 6 — Settings layer resolution (`r_`)

When persisting the model, the command walks a layered settings hierarchy in priority order:

```
function resolveSettingsLayer(key):
    // Layer priority (highest → lowest)
    layers = [
        "policySettings",    // +1278162  (managed — read-only guard)
        "flagSettings",      // +1278184
        "userSettings",      // +1278808  (target for /model writes)
        "projectSettings",   // +1278923
        "localSettings"      // +1278946
    ]
    // Writes go to userSettings (~/.claude/settings.json)
    // Path: join([homeDir, ".claude", "settings.json"])  +1269308, +1269318
```

Analysis basis: CC v2.1.163 bundle.js:+1278162

---

### 7 — Transcript / conversation logging (`icK` family)

Model changes trigger a log write through the conversation-logging subsystem, which manages rotating `.txt` log files:

```
function writeModelChangeToLog(entry):
    logDir  = path.dirname(currentLogPath)            // +205596
    logPath = path.join(logDir, filename)             // r2A +205248
    byteLen = Buffer.byteLength(entry)                // +205771

    if currentLogFile.endsWith(".txt"):               // +205021
        // Rotate when needed (slice first 4 bytes +205043)
        renameIfNeeded(currentLogFile)                // i2A → Zy.rename +205073
        unlinkStale()                                 // i2A → Zy.unlink +205113

    fs.mkdir(logDir, { recursive: true })             // ncK → Zy.mkdir +205317
    fs.appendFile(logPath, entry)                     // ncK → Zy.appendFile +205376
```

Analysis basis: CC v2.1.163 bundle.js:+205596

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_model_command_inline` | Fired when `/model` is called with an argument in inline (non-prompt) mode (bundle.js:+12661579) |
| Telemetry — `tengu_api_success` | Fired on successful live validation API call (bundle.js:+13462829) |
| Telemetry — `tengu_lone_surrogate_sanitized` | Fired if lone Unicode surrogates are found in the API response and sanitised (bundle.js:+13462527) |
| Telemetry — `tengu_feature_ok` | General feature success path (bundle.js:+1010222) |
| Telemetry — `tengu_feature_bad` | General feature failure path (bundle.js:+1010284) |
| Telemetry — `tengu_feature_sad` | General feature soft-error path (bundle.js:+1010365) |
| appState changes | `appState.model` is updated to the new canonical model ID (bundle.js:+12625812) |
| User settings file | `~/.claude/settings.json` — `model` key written when user settings are writable and no managed policy is active (bundle.js:+12625765) |
| Validation cache | In-process `Map` (`r1K`) caches per-model probe outcomes for the duration of the process to avoid redundant API calls (bundle.js:+12622681) |
| Log file | Model-change event appended to rotating `.txt` conversation log under the `.claude` log directory (bundle.js:+205376) |
| Hook registration | `j9` → `MXA.register` — a hook is registered after settings are written (bundle.js:+60323) |
| Sound | None detected in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.163 | Initial analysis — includes entitlement gates for Opus-1M and Sonnet-4.6-1M, live API probe validation, rotating log integration, and Managed Settings guard |

---

## Common Mistakes

1. **Using a shorthand alias in a script expecting a canonical ID in output.** The command resolves `"best"`, `"opus"`, `"sonnet"`, `"haiku"`, and `"opusplan"` aliases internally; the confirmation message will display the resolved canonical name, not the alias. Downstream scripts should not hard-code aliases.
2. **Expecting persistence when a managed policy is active.** When "Managed settings" are in effect (+12625974), the model change applies to the current session only and is *not* written to `settings.json`, even if the command succeeds and prints a confirmation.
3. **Invoking `/model` with a 1M extended-context model without the required account entitlement.** The command returns an early error (`opus_1m_unavailable` or `sonnet_1m_unavailable`) before attempting any API call. Check account entitlements at `https://code.claude.com/docs/en/model-config#extended-context-with-1m` first.
4. **Assuming the command is instant.** `/model` performs a live round-trip API probe (the `"Hi"` message, +12622845) to validate the model before committing the change. On slow connections this may be noticeable. Results are cached per-process, so subsequent `/model` calls to the same model skip the probe.
5. **Passing an empty string or whitespace-only argument.** After trimming, an empty argument triggers the error `"Model name cannot be empty"` (+12622437) rather than displaying the current model. Omit the argument entirely to display the current model.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `RCf` | Main handler for `/model` command (`AsyncFunction`, arbor_handler) |
| `H` | Bootstrap / API fetch utility; also used for string operations throughout the call graph |
| `v` | Model alias normalisation and resolution dispatcher |
| `ccK` | Provider context helper called during alias resolution |
| `OXA` | Sub-helper within provider context resolution |
| `SH` | JSON serialisation utility (calls `JSON.stringify`) |
| `J4` | Path / token extraction helper (uses `replace`, `at`, `lastIndexOf`, `slice`) |
| `g2A` | Model list mapper (`BcK.map`) |
| `q` | File-system utility (calls `xuK.unlinkSync`) |
| `A` | String normalisation helper (calls `f.toLowerCase`) |
| `ppH` | Log/output write dispatcher |
| `h2A` | Low-level write helper (`H.write`) |
| `icK` | Conversation log manager (mkdir, appendFile, rotate logic) |
| `$pH` | Debounced I/O scheduler (clearTimeout / setTimeout / setImmediate) |
| `d3H` | Log path builder (joins paths, calls `a8`, `h6`) |
| `Q6` | File-path utility |
| `aL6` | Settings loader helper (calls `v8`) |
| `r2A` | Log filename resolver (`KHH.join`, `h6`) |
| `i2A` | Log file rotation helper (`Zy.stat`, `rename`, `unlink`) |
| `ncK` | Log append worker (`Zy.mkdir`, `Zy.appendFile`) |
| `j9` | Hook registration entry point (`MXA.register`) |
| `e$` | Session state accessor |
| `Pw_` | String splitting / trimming utility |
| `ZHH` | Set membership checker (`g44.has`) |
| `uj` | String replacement utility |
| `t1` | Model selection UI / display renderer |
| `D6H` | Display sub-component router |
| `x0` | Display sub-component |
| `IqH` | Display sub-component |
| `yd` | Model label formatter (trims, checks `anthropic.` prefix, maps tiers) |
| `Aq` | Core model normalisation function (trim, toLowerCase, alias expansion) |
| `o0` | Provider-specific lookup helper (calls `q4H`) |
| `_4H` | Exclusion-list checker (`H4H.includes`) |
| `wI` | Formatted model entry builder (calls `gM`, `Z5`) |
| `NQH` | Alternative model entry builder (calls `Z5`) |
| `NE` | Model entry constructor (`gM`, `Z5`, `XA`) |
| `kX1` | Wrapper calling `NE` |
| `gM` | Provider-type annotator (calls `XA`) |
| `Pe6` | Inclusion-list checker (`l1L.includes`) |
| `vQH` | Variant resolver (calls `eH`) |
| `eX` | Extended entry constructor (calls `Aq`, `r0`) |
| `r0` | Rich model entry builder (multi-field: `ZA`, `NE`, `gM`, `XA`, `Z5`, `wI`) |
| `s6` | Feature telemetry wrapper (calls `c`, `P6`) |
| `c` | Core telemetry emitter |
| `P6` | Telemetry transport (calls `Nu6`) |
| `Nu6` | Low-level telemetry sink |
| `JC8` | Model-list fetcher / boostrap cache reader |
| `gS` | Model-list processor (calls `BO6`, `r0`) |
| `BO6` | Model entry transformer (calls `rO`, `Aq`) |
| `rO` | Model name cross-reference helper (calls `XYH`) |
| `gE` | SHA-256 hash utility (calls `eb`, `Ct1.createHash`) |
| `eb` | Hash helper (calls `Nu6`) |
| `o1K` | Model selection orchestrator (calls `jC8`, `I4A`) |
| `jC8` | Model validation + entitlement checker (calls `yd`, `DC8`, `gRf`, `QRf`, `FRf`) |
| `RH` | Display renderer variant (calls `c`, `P6`) |
| `gRf` | Sonnet-1M entitlement checker (`H.toLowerCase`, `Ws`, `z2`) |
| `Ws` | API feature-flag reader (calls `q4H`, `ZA`, `RU9`) |
| `z2` | Model-string parser / comparator (`q4H`, `K4H`, `XA`, `ZA`) |
| `QRf` | Sonnet-4-6-1M entitlement checker |
| `hfH` | Entitlement lookup helper (calls `q4H`, `ZA`, `RU9`) |
| `FRf` | Model exclusion-list filter (`H4H.includes`, `H.toLowerCase`) |
| `DC8` | Live model validation probe orchestrator (trim, `yd`, `_m`, cache) |
| `_m` | HTTP API call executor (`globalThis.fetch`, response processing) |
| `URf` | API error response parser (calls `BRf`, `String`) |
| `EH` | Error message stringifier |
| `I4A` | Post-validation session applicator and display builder |
| `KR6` | Settings write coordinator (calls `r_`, `hH`) |
| `r_` | Layered settings read/write engine |
| `hH` | Display renderer (calls `c`, `P6`) |
| `sK` | Styled text builder (calls `XA`, `eH`) |
| `XA` | Text styling wrapper (calls `eH`) |
| `eH` | Terminal string coercer (`String`) |
| `jYH` | Confirmation message component |
| `zO` | Model-scope display builder (calls `sK`, `r0`, `Aq`) |
| `IWH` | Extended-context annotation builder (calls `ZA`, `Aq`, `eX`, `zO`, `o0`) |
| `ZA` | UI layout container (calls `zY`, `nR`, `n1`) |
| `k4A` | Confirmation UI renderer (calls `oTH`, `x8`, `hx`, `j6.dim`, `j6.bold`, `cr`) |
| `oTH` | UI sub-component (calls `hV`, `x8`) |
| `x8` | Layout primitive (calls `Pl6`, `Kd`) |
| `hx` | Path display helper (`_I.join`) |
| `cr` | Model display chip builder (calls `_4H`, `rO`, `Aq`) |

---

*Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.*