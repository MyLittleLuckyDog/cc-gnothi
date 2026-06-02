---
type: feature-spec
feature: "model"
cc_version: "2.1.157"
updated: "2026-06-02"
tags: ["model", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.157 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/model`

> Analysis basis: CC v2.1.157 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.157

---

## Overview

The `/model` command allows users to set or switch the AI model used by Claude Code within a running session. It accepts a model name (or a shorthand alias) as an argument, validates availability for the current account and subscription tier, optionally persists the selection as the user default across future sessions, and emits status output indicating the active model, fast-mode state, and billing context.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `model` |
| description | Set the AI model for Claude Code |
| argumentHint | `<model>` |
| supportsNonInteractive | `true` |
| module_id | `Ro1` |
| load_inline | `true` |
| loc_byte | `12399308` |
| loc_byte_end | `12399482` |
| loc_line | `8265` |
| arbor_handler.name | `v$5` |
| arbor_handler.fqn | `claude-2.1.157::v$5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.157 bundle.js:+12399308

---

## Input Branching

The handler logic has five or more distinct branches (empty input, alias expansion, availability guard, model validation via API, and persistence decision), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/model <arg>]) --> B{arg present\nand non-empty?}
    B -- No --> SHOW[Display current model\nand available aliases]
    B -- Yes --> C[Trim whitespace from arg]
    C --> D{arg matches a\nknown shorthand alias?}
    D -- Yes --> E[Expand alias to\ncanonical model name]
    D -- No --> F[Use arg as literal model name]
    E --> G
    F --> G{Is selected model in\nallowed-models list?}
    G -- No --> NOTALLOWED[Emit model_switch/not_allowed\nerror; abort]
    G -- Yes --> H{Model requires 1M context\nextended access?}
    H -- Opus 1M --> I{Account has\nOpus 1M access?}
    I -- No --> OPUS1MERR[Emit opus_1m_unavailable\nerror message with docs link; abort]
    I -- Yes --> VALIDATE
    H -- Sonnet 1M --> J{Account has\nSonnet 1M access?}
    J -- No --> SONNET1MERR[Emit sonnet_1m_unavailable\nerror message with docs link; abort]
    J -- Yes --> VALIDATE
    H -- Neither --> VALIDATE
    VALIDATE[Call model validation\nAPI side-query with\nephemeral 'Hi' message] --> K{API response OK?}
    K -- Auth error --> AUTHERR[Emit authentication\nfailed message; abort]
    K -- Network error --> NETERR[Emit network error\nmessage; abort]
    K -- not_found_error type --> INVALMOD[Emit invalid_model\nerror; abort]
    K -- Other exception --> EXCEP[Emit validate_exception\nerror; abort]
    K -- Success --> L{Non-interactive\nmode?}
    L -- Yes --> SETSTATE[Update appState model;\nno persistence prompt]
    L -- No --> M{Prompt: save as\ndefault for new sessions?}
    M -- Yes --> PERSIST[Write model to\nuserSettings / projectSettings;\nemit model_set_default telemetry]
    M -- No --> SESSION[Apply for this\nsession only]
    PERSIST --> OUT
    SESSION --> OUT
    SETSTATE --> OUT
    OUT[Emit confirmation:\nmodel name, fast-mode indicator,\nbilling context suffix]
```

---

## Behavioral Spec

### Handler Entry Point (`v$5`)

The Arbor-resolved handler is the `AsyncFunction` `v$5` (fqn: `claude-2.1.157::v$5`).

```
async function handleModelCommand(args, context):
    rawArg = args[0] ?? ""
    modelArg = rawArg.trim()                          // loc_byte 12390915

    if modelArg is in CB6 (content-type list):        // loc_byte 12390931
        // arg was a flag token, not a model name; treat as empty
        modelArg = ""

    if modelArg is empty:
        appState = context.getAppState()              // loc_byte 12390954
        call displayCurrentModelAndAliases(appState)  // hI8, loc_byte 12390998
        return

    call processModelSwitch(modelArg, context)        // pr1, loc_byte 12391138
    emit telemetry "tengu_model_command_inline"       // loc_byte 12391073
```

Analysis basis: CC v2.1.157 bundle.js:+12390915

---

### Display Current Model and Aliases (`hI8`)

```
function displayCurrentModelAndAliases(appState):
    aliases = buildAliasList()                        // fS, loc_byte 12356537
    currentModel = appState.model
    print formatted table of alias → expansion mappings
    print current active model
```

The alias table construction (via `fS` → `UM6` → `_1`) produces rows including at minimum:

| Alias | Expansion / Description |
|---|---|
| `sonnet` | Canonical Sonnet model name (bundle.js:+2192833) |
| `haiku` | Canonical Haiku model name (bundle.js:+2192872) |
| `opus` | Canonical Opus model name (bundle.js:+2192911) |
| `best` | Best available model (bundle.js:+2192948) |
| `opusplan` | Opus in plan mode, else Sonnet (bundle.js:+2191305, +2191322) |
| `[1m]` | 1M-context variant suffix indicator (bundle.js:+2192818) |

Analysis basis: CC v2.1.157 bundle.js:+12356537

---

### Alias Normalization (`_1`, reached via `UM6`)

```
function normalizeModelAlias(rawName):
    name = rawName.trim().toLowerCase()               // loc_byte 2192696, 2192707
    name = applyCharacterSubstitutions(name)          // E0, loc_byte 2192725
    name = name.replace(knownPatterns)                // loc_byte 2192735
    if name matches "opusplan":
        return opusPlanExpansion()                    // iM/Co6/fFH, loc_byte 2192980+
    if name matches "sonnet":
        return canonicalSonnetName()
    if name matches "haiku":
        return canonicalHaikuName()
    if name matches "opus":
        return canonicalOpusName()
    if name matches "best":
        return canonicalBestModel()
    // 1M suffix handling
    if name ends with "[1m]":
        return base + "-1m-context variant"
    return name   // pass-through for fully-qualified model strings
```

Analysis basis: CC v2.1.157 bundle.js:+2192696

---

### Subscription-Tier Model Availability (`bQ`, `KFH`, `t3q`, `Am4`, `i1H`, `qm4`)

```
function isModelAllowedForAccount(modelName, subscriptionInfo):
    // subscriptionInfo encodes tier: "max", "team", "default_claude_max_5x",
    //   "enterprise", "enterprise_usage_based", "firstParty"
    //   (loc_byte 2961744, 2961815, 2961830, 2961925, 2961947, 2189002)

    if modelName.startsWith("anthropic."):            // loc_byte 2186761
        // Bedrock-prefixed model; check against allowed set
        ...
    if modelName.startsWith("claude-"):               // loc_byte 2186382
        // Standard model; check tier membership
        ...
    if modelName is in blocklist for current tier:
        return NOT_ALLOWED
    return ALLOWED
```

Analysis basis: CC v2.1.157 bundle.js:+2186608

---

### 1M Context Availability Guards (`pM5`, `UM5`)

```
function checkOpus1MAvailability(modelName, accountFeatures):
    name = modelName.toLowerCase()                    // loc_byte 12356134
    if name matches "sonnet[1m]" or "sonnet-4-6[1m]":
        // loc_byte 12356273, 12356299
        if not accountFeatures.includes(sonnet1mFlag): // loc_byte 12356262
            raise sonnet_1m_unavailable               // loc_byte 12354618
            // message: "Sonnet 4.6 with 1M context is not available..."
            //          (loc_byte 12354658)
    if name matches opus 1M variant:
        if not accountFeatures.includes(opus1mFlag):
            raise opus_1m_unavailable                 // loc_byte 12354401
            // message: "Opus with 1M context is not available..."
            //          (loc_byte 12354439)
```

Analysis basis: CC v2.1.157 bundle.js:+12356134

---

### Model Validation via API (`II8` + `Vu`)

```
async function validateModelWithAPI(modelName, apiClient):
    name = modelName.trim()                           // loc_byte 12352372
    if name is empty:
        raise "Model name cannot be empty"            // loc_byte 12352409

    // Check cache (mr1 Map) first
    if cache.has(modelName):                          // loc_byte 12352653
        return cache.get(modelName)

    // Send ephemeral side-query to confirm model exists
    response = await apiCall({                        // Vu, loc_byte 12352698
        model: modelName,
        max_tokens: 1024,                             // loc_byte 13163859
        messages: [{ role: "user", content: "Hi" }], // loc_byte 12352817
        type: "side_query",                           // loc_byte 13164043
        cache_control: "ephemeral"                    // loc_byte 12352842
    })

    // Error classification
    if response is auth error:
        raise "Authentication failed. Please check your API credentials."
        // loc_byte 12353108
    if response is network error:
        raise "Network error. Please check your internet connection."
        // loc_byte 12353210
    if response.error.type == "not_found_error":      // loc_byte 12353329
        // check message contains "model:"            // loc_byte 12353411
        emit telemetry "invalid_model"                // loc_byte 12354901
        abort
    if unexpected exception:
        emit telemetry "validate_exception"           // loc_byte 12354998
        abort

    cache.set(modelName, validatedResult)             // mr1.set, loc_byte 12352861
    emit telemetry "tengu_api_success"                // loc_byte 13165494
    return validatedResult
```

Maximum tokens sent in the side-query: 1024 (bundle.js:+13163859)

Analysis basis: CC v2.1.157 bundle.js:+12352372

---

### Model Selection Output and Persistence (`p8A`, `ZI6`, `U8A`)

```
async function applyAndReportModelSelection(modelName, context, validationResult):
    // Determine display suffix
    fastModeActive = context.isFastModeOn()
    fastSuffix = fastModeActive ? " · Fast mode ON" : " · Fast mode OFF"
    // loc_byte 12355542, 12355639

    if model draws from usage credits:
        creditSuffix = " · Draws from usage credits"  // loc_byte 12355593

    // Determine persistence scope
    if not nonInteractive:
        saveAsDefault = await promptUser("Save as default for new sessions?")
        // ZI6 writes to settings file, loc_byte 12355696
        if saveAsDefault:
            writeModelToSettings(modelName, "userSettings")
            persistenceSuffix = " and saved as your default for new sessions"
            // loc_byte 12355378
            emit telemetry key "model_set_default"    // loc_byte 12355736
        else:
            persistenceSuffix = " for this session only"
            // loc_byte 12355424

    // If managed settings apply, show advisory
    if managedSettingsActive:                         // loc_byte 12355945
        print "Managed settings" advisory

    // Update appState
    appState.model = modelName                        // "model" key, loc_byte 12355783
    emit telemetry key "model_set_default" on persist

    // Format and print confirmation line
    print bold(modelName) + persistenceSuffix + fastSuffix + creditSuffix
```

Settings files written: `.claude/settings.json` and/or `.claude/settings.local.json`
(bundle.js:+1219331, +1219341, +1219403)

Analysis basis: CC v2.1.157 bundle.js:+12355231

---

### Opus Plan Alias (`opusPlanExpansion`, within `_1`)

When the alias `opusplan` is resolved, the expander checks whether the session is in "plan mode". If plan mode is active it selects the Opus model; otherwise it falls back to Sonnet. This produces the description "Opus in plan mode, else Sonnet" shown in the alias table (bundle.js:+2191305, +2191322).

Analysis basis: CC v2.1.157 bundle.js:+2191305

---

### Opus Model Recency Check (`TY`, via `p8A`)

```
function resolveLatestOpusVariant(aliasStem):
    // Checks known versioned Opus identifiers in order:
    //   "opus-4-6", "opus-4-7", "opus-4-8"
    //   (loc_byte 2179101, 2179155, 2179179)
    // Returns the highest available variant whose release status is "active"
    //   (loc_byte 2179680)
    for variant in ["opus-4-8", "opus-4-7", "opus-4-6"]:
        if variant is active:
            return variant
    return defaultOpusName
```

Analysis basis: CC v2.1.157 bundle.js:+2179101

---

### Sonnet Tier Gate (`CPH`, via `p8A`)

```
function checkSonnetTierAccess(modelName, subscriptionTier):
    // Specifically guards "sonnet-4-6"  (loc_byte 10844401)
    if modelName matches sonnet-4-6:
        if not tierAllowsSonnet46(subscriptionTier):
            emit tier-restriction message
            abort
```

Analysis basis: CC v2.1.157 bundle.js:+10844245

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_model_command_inline` | Fired when a model name argument is provided inline (loc_byte 12391073) |
| Telemetry: `tengu_api_success` | Fired when the validation side-query API call returns successfully (loc_byte 13165494) |
| Telemetry: `tengu_feature_bad` | Fired by the `d` helper on feature failure paths (loc_byte 966091) |
| Telemetry: `tengu_feature_ok` | Fired by the `hH` helper on feature success paths (loc_byte 966033) |
| Telemetry key `model_set_default` | Written into settings telemetry when the model is persisted as default (loc_byte 12355736) |
| Telemetry key `model_validation` | Used during the API validation sub-flow (loc_byte 12352748) |
| Telemetry key `invalid_model` | Emitted when API returns `not_found_error` for model (loc_byte 12354901) |
| Telemetry key `validate_exception` | Emitted on unexpected exception during validation (loc_byte 12354998) |
| Telemetry key `model_switch/not_allowed` | Emitted when the chosen model is blocked for the account tier (loc_byte 12354239, 12354254) |
| appState changes | `appState.model` is updated to the validated model name (loc_byte 12355783) |
| Settings persistence | Model written to `.claude/settings.json` or `.claude/settings.local.json` when user confirms default save (loc_byte 1219331, 1219341, 1219403) |
| API side-query | An ephemeral single-message call ("Hi") is sent to validate the model exists; result cached in `mr1` Map (loc_byte 12352698, 12352653) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.157 | Initial analysis |

---

## Common Mistakes

1. **Providing a fully-qualified model ID when a shorthand works** — aliases such as `sonnet`, `haiku`, `opus`, `best`, and `opusplan` are expanded internally; using the wrong casing or extra characters prevents alias resolution and falls through to literal name validation.
2. **Expecting immediate persistence without confirmation** — unless `--non-interactive` / non-interactive mode is active, the command prompts before writing the model to settings. Running from scripts without handling the prompt will hang.
3. **Using `[1m]` suffix models without the appropriate account entitlement** — `sonnet[1m]` and Opus 1M variants check account-level flags before proceeding; attempting them on ineligible accounts aborts with a documentation link error.
4. **Assuming the model switch is free of API cost** — the validation step sends a live ephemeral API call ("Hi") to confirm the model name is valid. On metered accounts this may consume a small number of tokens.
5. **Not checking subscription tier when switching to `sonnet-4-6`** — this specific model has an additional tier gate beyond the general allowed-models list; the command will abort silently if the tier is insufficient.
6. **Confusing session-only vs. persisted state** — answering "No" to the persistence prompt applies the model only for the current session; the next session will revert to the previously stored default.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `v$5` | Main handler for `/model` command (AsyncFunction, Arbor-resolved) |
| `H` | Argument string variable / timer utility (context-dependent) |
| `_` | App-state / utility accessor |
| `hI8` | Display-current-model-and-aliases function |
| `fS` | Alias-list builder (calls `UM6` and `T0`) |
| `UM6` | Alias entry constructor (creates alias→name mappings) |
| `ZY` | Alias table entry formatter |
| `_1` | Alias normalization / expansion function |
| `T0` | Model metadata / plan-mode object builder |
| `WA` | Subscription tier resolver |
| `AHH` | "max" tier handler |
| `FOH` | "team" / `default_claude_max_5x` tier handler |
| `MFH` | "enterprise" / `enterprise_usage_based` tier handler |
| `Z0` | First-party model info resolver |
| `IP` | Model list / availability resolver |
| `iM` | Model identity / canonical name helper |
| `TA` | Provider type classifier (bedrock / vertex / foundry / mantle / gateway / anthropicAws) |
| `w5` | Model feature-flag reader |
| `pN` | Plan-mode model selector |
| `d` | Telemetry event emitter (`tengu_feature_bad`) |
| `pr1` | Process-model-switch orchestrator |
| `m8A` | Model switch logic entry point (calls `bQ`, `bH`, `pM5`, `UM5`, `mM5`, `II8`, `EH`) |
| `bQ` | Allowed-models list checker |
| `A` | Model name array / map helper |
| `M` | Model metadata record helper |
| `K` | Model display formatter / padEnd helper |
| `q` | Model file / cache helper |
| `ti6` | Object.entries-based tier settings iterator |
| `KFH` | Blocklist membership checker (`_m4.includes`) |
| `t3q` | Tier index lookup |
| `Am4` | Anthropic-prefix model availability checker |
| `i1H` | `n1H.includes` wrapper (model-in-list checker) |
| `qm4` | `claude-` prefix model availability checker |
| `bH` | Feature-flag side-effect helper (calls `d`) |
| `pM5` | Opus 1M availability guard |
| `Da` | Model availability lookup helper |
| `UM5` | Sonnet 1M availability guard |
| `XLH` | Sonnet 1M helper (calls `o1H`, `WA`, `jS9`) |
| `mM5` | Model name lowercase normalization helper |
| `II8` | Model validation via API (side-query orchestrator) |
| `Vu` | API call executor (globalThis.fetch, handles auth/network/not_found errors) |
| `xM5` | Validation result formatter |
| `EH` | String coercion utility (calls `String`) |
| `p8A` | Apply-and-report-model-selection function |
| `ZI6` | Settings persistence writer (calls `U_`) |
| `U_` | Settings file read/write handler (user/project/local settings) |
| `hH` | Success telemetry emitter (`tengu_feature_ok`) |
| `uK` | Confirmation message formatter |
| `CH` | String formatter utility |
| `pOH` | Prompt/output helper |
| `TY` | Latest Opus variant resolver |
| `ci` | Conditional message builder |
| `CPH` | Sonnet tier gate checker |
| `XX` | Model metadata cross-reference helper |
| `E0` | Character substitution / normalization helper |
| `U8A` | Output display / managed-settings advisory renderer |
| `rGH` | Settings path resolver |
| `I8` | Settings key reader |
| `cb` | Path join helper (`.claude` directory) |
| `li` | Alias list display helper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.