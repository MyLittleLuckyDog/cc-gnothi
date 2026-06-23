---
type: feature-spec
feature: "model"
cc_version: "2.1.186"
updated: "2026-06-23"
tags: ["model", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.186 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/model`

> Analysis basis: CC v2.1.186 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.186

---

## Overview

The `/model` command allows users to select or change the AI model used by Claude Code for the current session (or persistently as a new default). When invoked with a model name argument, the handler validates the model against the known model list, checks for policy constraints and org-level permissions, optionally probes the API to confirm availability, and then updates the active model in application state. When invoked without arguments, it displays the interactive model picker.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `model` |
| description | `Set the AI model for Claude Code` |
| argumentHint | `<model>` |
| supportsNonInteractive | `true` |
| module_id | `l1l` |
| load_inline | `true` |
| loc_byte | `12843713` |
| loc_byte_end | `12843887` |
| loc_line | `8694` |
| arbor_handler.name | `Qyf` |
| arbor_handler.fqn | `claude-2.1.186::Qyf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.186 bundle.js:+12843713

---

## Input Branching

The handler has more than three distinct execution paths depending on whether an argument is present, whether the model is a Fable-class model requiring consent, whether the session is interactive, policy/org constraints, and the outcome of API validation. A flowchart is used to represent this.

```mermaid
flowchart TD
    A(["/model called"]) --> B{Argument provided?}

    B -- No --> C[Show interactive model picker\nvia model-picker UI]
    C --> Z([Done])

    B -- Yes --> D["Trim argument string\n(Qyf → e.trim)"]
    D --> E{Argument in known\nshorthand alias list?\n(aoe.includes)"}

    E -- Yes --> F[Resolve shorthand to\ncanonical model ID]
    E -- No --> G[Use argument as-is]

    F & G --> H["Read current appState\n(t.getAppState)"]
    H --> I{Model is Fable-class\n(model_fable_consent check)?}

    I -- Yes, non-interactive --> J["Emit telemetry: noninteractive_set_blocked\nReturn error message:\n'Fable 5 uses usage credits…'"]
    J --> Z

    I -- Yes, interactive --> K{User has already\ngiven consent?}
    K -- No --> L[Prompt user for\none-time consent]
    L -- Refused --> Z
    L -- Accepted --> M

    K -- Yes --> M[Proceed with\nmodel selection]
    I -- No --> M

    M --> N["Check org/policy constraints\n(n9.includes, policy check)"]
    N --> O{Blocked by\norg policy?}

    O -- Yes --> P["Emit telemetry: disabled_by_org\nReturn policy-blocked error"]
    P --> Z

    O -- No --> Q["Validate model via API probe\n(I9t → $5 → API call)"]
    Q --> R{API probe\nresult}

    R -- "not_found_error" --> S[Show invalid model error\n'Model name cannot be empty'\nor unknown-model message]
    S --> Z

    R -- Auth failure --> T[Show auth error:\n'Authentication failed…']
    T --> Z

    R -- Network error --> U[Show network error:\n'Network error…']
    U --> Z

    R -- Success --> V{Save as default\nor session-only?}

    V -- "Default (yWt path)" --> W["Update global config\n(ro → saveSettings)\nEmit: model_set_default"]
    V -- "Session only" --> X["Update session appState\nonly (no config write)"]

    W & X --> Y["Display confirmation:\nbold model name +\n'and saved as your default'\nOR 'for this session only'\n+ optional flags (Fast mode ON/OFF,\nDraws from usage credits)"]
    Y --> Z
```

Analysis basis: CC v2.1.186 bundle.js:+12806590 (handler entry), +12806606 (alias check), +12806629 (appState read), +12806895 (Fable consent branch), +12806920 (noninteractive block), +12807120 (model-set-default path)

---

## Behavioral Spec

### 1. Handler Entry and Argument Normalization

The primary handler (`Qyf`, an AsyncFunction) receives the raw user-supplied argument string and the command context.

```
async function handleModelCommand(rawArg, context):
    arg = rawArg.trim()                  // e.trim — loc:+12806590
    if arg is in shorthandAliasList:     // aoe.includes — loc:+12806606
        arg = resolveAlias(arg)
    appState = context.getAppState()     // loc:+12806629
```

Known shorthand aliases found in literals include:
- `"sonnet"` → resolves to a canonical Sonnet model (bundle.js:+2294516)
- `"haiku"` → resolves to a canonical Haiku model (bundle.js:+2294555)
- `"opus"` → resolves to a canonical Opus model (bundle.js:+2294594)
- `"best"` → resolves to the highest available model (bundle.js:+2294628)
- `"fable"` → resolves to the Fable 5 model (bundle.js:+2294412)
- `"opusplan"` → Opus in plan mode, else Sonnet (bundle.js:+2292728)

Analysis basis: CC v2.1.186 bundle.js:+12806590

---

### 2. Known Model Catalog

The model resolution subsystem (`Zo`, `YH`) contains a registry mapping canonical model IDs to display names. The following models are confirmed in the bundle:

| Canonical ID | Display Name |
|---|---|
| `claude-fable-5` | Fable 5 |
| `claude-mythos-5` | Mythos 5 |
| `claude-opus-4-8` | Opus 4.8 |
| `claude-opus-4-7` | Opus 4.7 |
| `claude-opus-4-6` | Opus 4.6 |
| `claude-opus-4-5` | Opus 4.5 |
| `claude-opus-4-1` | Opus 4.1 |
| `claude-opus-4-0` | Opus 4 |
| `claude-sonnet-4-6` | Sonnet 4.6 |
| `claude-sonnet-4-5` | Sonnet 4.5 |
| `claude-sonnet-4-0` | Sonnet 4 |
| `claude-haiku-4-5` | Haiku 4.5 |
| `claude-3-7-sonnet` | Sonnet 3.7 |
| `claude-3-5-sonnet` | Sonnet 3.5 |
| `claude-3-5-haiku` | Haiku 3.5 |
| `claude-3-opus` | (legacy Opus 3) |
| `claude-3-sonnet` | (legacy Sonnet 3) |
| `claude-3-haiku` | (legacy Haiku 3) |

Additionally, extended-context (1M token) variants exist for some models. When applicable, a ` (1M context)` suffix is appended to the display name (bundle.js:+2293373).

Analysis basis: CC v2.1.186 bundle.js:+2291059–2291948 (catalog), +2293433–2294017 (display names)

---

### 3. Fable Consent Gate

When the resolved model is in the Fable family, a special consent gate is applied.

```
function fableConsentGate(model, isInteractive, appState):
    if isFableModel(model):
        if not isInteractive:
            emitTelemetry("noninteractive_set_blocked")    // loc:+12806920
            return error(
                "Fable 5 uses usage credits and needs a one-time consent"
                + " · pick Fable from /model in an interactive session to set it up"
            )                                              // loc:+12806969
        if not hasUserConsented(appState):
            consentResult = promptUserForConsent()
            if consentResult == REFUSED:
                return ABORT
    return PROCEED
```

The consent check is tied to the `model_fable_consent` telemetry key (bundle.js:+12806898). This gate exists because Fable 5 draws from usage credits.

Analysis basis: CC v2.1.186 bundle.js:+12806895, +12806920, +12806969

---

### 4. Inline Model Command (Non-Interactive Path)

When `/model <name>` is provided inline (e.g. as a CLI flag or in a non-interactive pipeline), the handler emits a distinct telemetry event before proceeding.

```
function handleInlineModelSet(model, context):
    emitTelemetry("tengu_model_command_inline")   // loc:+12806740
    // Fable gate checked; if blocked, return noninteractive_set_blocked
    // Otherwise continue to validation
```

Analysis basis: CC v2.1.186 bundle.js:+12806740

---

### 5. Model Validation via API Probe

After local alias resolution and policy checks, the handler performs an API-level validation probe via the `I9t` function (model validation subsystem), which calls `$5` (the API request function).

```
async function validateModelViaAPI(resolvedModel, context):
    if resolvedModel is empty:
        return error("Model name cannot be empty")    // loc:+9065793

    // Check known-models cache first (Ydo.has)       loc:+9066062
    if modelInKnownCache(resolvedModel):
        return SUCCESS

    // Otherwise probe the API with a minimal request
    probeResult = await apiProbe(resolvedModel)       // $5 → loc:+9066107

    switch probeResult.errorType:
        case AUTH_FAILURE:
            return error("Authentication failed. Please check your API credentials.")
                                                      // loc:+9066529
        case NETWORK_ERROR:
            return error("Network error. Please check your internet connection.")
                                                      // loc:+9066631
        case "not_found_error":                        // loc:+9066750
            return error("model: <name> not found")   // loc:+9066832
        case SUCCESS:
            Ydo.set(resolvedModel, validationData)    // loc:+9066270
            return SUCCESS
```

Short-form model aliases used in API probe normalization include `"fable-5"` / `"fable_5"`, `"opus-4-8"` / `"opus_4_8"`, `"sonnet-4-6"` / `"sonnet_4_6"`, etc. (bundle.js:+9067111–9067588).

Analysis basis: CC v2.1.186 bundle.js:+9065756, +9065793, +9066062, +9066107, +9066270, +9066311

---

### 6. Policy and Org-Level Checks

Before the API probe, a policy check evaluates whether the model is permitted in the current org/seat context.

```
function checkPolicyConstraints(resolvedModel, appState):
    if resolvedModel in blockedModelList:            // n9.includes — loc:+12806693
        emitTelemetry("disabled_by_org")            // loc:+11333836
        return BLOCKED

    // Check feature flags and seat-tier constraints
    // via ETe (model-policy subsystem)              loc:+12806780
    policyResult = evaluateModelPolicy(resolvedModel, appState)

    switch policyResult:
        case "disabled":    return POLICY_BLOCKED   // loc:+2280433
        case "absent":      return POLICY_BLOCKED   // loc:+2280558
        default:            return ALLOWED
```

The `ETe` function (model-policy evaluator) performs detailed checks including model tier status (`"refused"`, `"inactive"`, `"active"` — bundle.js:+2283326, +2283364, +2283406), gateway vs. firstParty provider routing (`"gateway"`, `"bedrock"`, `"vertex"`, `"firstParty"` — bundle.js:+2279434, +2128842, +2129050, +2129059), and org-level disablement.

Analysis basis: CC v2.1.186 bundle.js:+12806693, +12806780, +11333836, +2280433

---

### 7. 1M Context Window Variants

Some models have 1M-token context variants. These are gated by account eligibility:

```
function handle1MContextVariants(resolvedModel, appState):
    if resolvedModel matches "sonnet[1m]" or "sonnet-4-6[1m]":
                                                    // loc:+11335622, +11335648
        if not account.has1MAccess():
            emitTelemetry("sonnet_1m_unavailable")  // loc:+11333568
            return error(
                "Sonnet 4.6 with 1M context is not available for your account."
                + " Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m"
            )                                       // loc:+11333608

    if resolvedModel matches opus "[1m]" variant:
        if not account.has1MAccess():
            emitTelemetry("opus_1m_unavailable")    // loc:+11333351
            return error(
                "Opus with 1M context is not available for your account."
                + " Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m"
            )                                       // loc:+11333389
```

Analysis basis: CC v2.1.186 bundle.js:+11333351, +11333389, +11333568, +11333608, +11335622, +11335648

---

### 8. Model Application and Confirmation Display

On successful validation, the handler updates state and displays a confirmation message.

```
async function applyModelSelection(resolvedModel, saveAsDefault, context):
    if saveAsDefault:
        await saveModelToGlobalConfig(resolvedModel)    // ro → saveSettings
        emitTelemetry("model_set_default")              // loc:+11335094

    updateAppStateModel(resolvedModel)                  // yWt path — loc:+12806821

    // Build confirmation string
    displayName = getDisplayName(resolvedModel)
    suffix = saveAsDefault
        ? " and saved as your default for new sessions"  // loc:+11334736
        : " for this session only"                       // loc:+11334782

    extras = []
    if modelHasFastMode(resolvedModel):
        extras.append(" · Fast mode ON")                // loc:+11334900
    if modelDrawsFromCredits(resolvedModel):
        extras.append(" · Draws from usage credits")    // loc:+11334951
    if modelFastModeOff(resolvedModel):
        extras.append(" · Fast mode OFF")               // loc:+11334997

    print(bold(displayName) + suffix + join(extras))
```

Analysis basis: CC v2.1.186 bundle.js:+11334736, +11334782, +11334900, +11334951, +11334997, +11335094

---

### 9. Bootstrap / Model Discovery

At startup or when the model list needs refreshing, the `Xlt` function performs a bootstrap fetch from the Anthropic API.

```
async function bootstrapModelDiscovery(context):
    if CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY not set:
        log("[Bootstrap] Skipped gateway /v1/models (CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY not set)")
                                                       // loc:+8158348
        return

    if essentialTrafficDisabled:
        log("[Bootstrap] Skipped: Nonessential traffic disabled")
                                                       // loc:+8158503
        return

    if provider is third-party (Bedrock/Vertex):
        log("[Bootstrap] Skipped: 3P provider")        // loc:+8158594
        return

    response = await fetch(modelsEndpoint, {
        headers: { "Content-Type": "application/json",
                   "anthropic-version": "2023-06-01"  // loc:+8160948
        },
        timeout: [1000, 5000]                          // loc:+8160994, +8161008
    })

    if response.ok:
        updateModelCache(response)
        emitTelemetry("api_bootstrap_fetch")           // loc:+8158977
        log("[Bootstrap] Fetch ok")                    // loc:+8159029
    else:
        emitTelemetry("api_bootstrap_fetch", "parse_failed")
```

Analysis basis: CC v2.1.186 bundle.js:+8158271, +8158348, +8158503, +8158977

---

### 10. Fable Probe for Availability

When Fable is selected, a secondary probe checks if the model is available for the account beyond consent:

```
async function probeFableAvailability(context):
    result = await sendMinimalProbe("fable-5")
    if result == UNAVAILABLE:
        emitTelemetry("fable_unavailable")    // loc:+11334087
        return UNAVAILABLE
    if result == PROBE_FAILED:
        emitTelemetry("fable_probe_failed")   // loc:+11334107
        return ERROR
    return AVAILABLE
```

Analysis basis: CC v2.1.186 bundle.js:+11334087, +11334107

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_model_command_inline` | Fired when `/model` is used non-interactively / inline (bundle.js:+12806740) |
| Telemetry: `tengu_api_success` | Fired on successful API model validation probe (bundle.js:+8948728) |
| Telemetry: `tengu_feature_ok` | Fired when model feature gate passes (bundle.js:+1024705) |
| Telemetry: `tengu_feature_bad` | Fired when model feature gate fails (bundle.js:+1024772) |
| Telemetry: `tengu_feature_sad` | Fired for degraded feature state (bundle.js:+1024853) |
| Telemetry: `tengu_config_lock_contention` | Fired when config file lock is contested during model save (bundle.js:+13850557) |
| Telemetry: `tengu_config_stale_write` | Fired when config write detects stale data (bundle.js:+13850693) |
| Telemetry: `tengu_config_auth_loss_prevented` | Fired when a config write that would remove auth is blocked (bundle.js:+13851036) |
| Telemetry: `tengu_config_parse_error` | Fired when config JSON cannot be parsed (bundle.js:+13853132) |
| Telemetry: `tengu_config_fallback_write` | Fired when the config system falls back to an alternative write path (bundle.js:+13850173) |
| Telemetry: `tengu_lone_surrogate_sanitized` | Fired when lone Unicode surrogates are sanitized in model response (bundle.js:+8948424) |
| Telemetry: `tengu_prompt_cache_1h_config` | Fired when 1-hour prompt cache is configured (bundle.js:+13604140) |
| Telemetry: `tengu_bg_retire_pinned_low_mem` | Fired when pinned workers are retired due to low memory (bundle.js:+17162316) |
| Telemetry: `tengu_bg_prewarm_per_sweep` | Fired during background worker prewarm sweep (bundle.js:+17162437) |
| appState changes | Active model updated in session state after successful validation |
| Global config write | `~/.claude.json` updated when saving model as default; protected by file lock to prevent auth loss (see `saveGlobalConfig` guard at bundle.js:+13847337) |
| API probe | A lightweight API call is made to validate unknown models (uses `anthropic-version: 2023-06-01`, timeout 1000–5000 ms) |
| Model known-model cache | Successful validations are stored in `Ydo` (a Map) to avoid redundant probes |
| Bootstrap cache | Model list fetched at startup from Anthropic API gateway; result persisted to disk cache |

---

## Version History

| Version | Change |
|---|---|
| v2.1.186 | Initial analysis — Fable 5 consent gate, 1M context variants, org-level policy enforcement, API probe validation, bootstrap discovery |

---

## Common Mistakes

1. **Providing an empty model name** — The handler checks for an empty string after trimming and returns `"Model name cannot be empty"` immediately (bundle.js:+9065793). Always supply a non-empty argument.
2. **Attempting to set Fable in non-interactive mode** — `/model fable` (or equivalents) inside a script or `--print` mode is blocked with the `noninteractive_set_blocked` error; consent must be granted in an interactive session first.
3. **Using the full canonical API ID when a shorthand exists** — Shorthands like `"sonnet"`, `"opus"`, `"haiku"`, `"best"`, and `"fable"` are resolved before validation; using a raw ID like `"claude-sonnet-4-6"` also works but bypasses alias friendliness.
4. **Expecting a 1M-context variant to be available without account eligibility** — Models suffixed with `[1m]` (e.g. `sonnet[1m]`) are gated by account tier; attempting them without access returns a link to the documentation.
5. **Assuming model changes persist across sessions without confirmation** — The handler explicitly states `"for this session only"` or `"and saved as your default for new sessions"`. Without seeing the `"saved"` message, the change is ephemeral.
6. **Confusing `"opusplan"` with standard Opus** — The `"opusplan"` alias selects Opus specifically in plan-mode contexts but falls back to Sonnet otherwise (bundle.js:+2292728); it is not a plain Opus alias.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Qyf` | Primary `/model` command handler (AsyncFunction) |
| `yVn` | Model alias resolution and known-model list lookup |
| `Zx` | Model catalog / shorthand-to-canonical mapping orchestrator |
| `gwt` | Model display-name resolution wrapper |
| `Zd` | Individual model record constructor |
| `Zo` | Full model-name-to-display-name resolver |
| `vw` | Model provider / feature-flag evaluation wrapper |
| `Bkr` | Model status record builder (active/inactive/refused) |
| `rfn` | Model list builder and policy-mapping engine |
| `tp` | SHA-256 model ID hasher (12-char hex prefix) |
| `yH` | Hash utility wrapper |
| `KVe` | Crypto hash primitive |
| `yWt` | Model-set orchestrator (applies model, triggers save, shows confirmation) |
| `ja` | Settings loader / model-aware settings resolution |
| `VIt` | Settings validation and merging |
| `hls` | Settings filter (remote-only entries) |
| `mls` | Settings merger |
| `KIt` | Settings key-iteration and deduplication |
| `JAe` | Remote managed settings fetcher |
| `Z$` | Settings schema validator |
| `Aoe` | Settings accessor helper |
| `GIt` | Settings group iterator |
| `r5o` | Settings property resolver |
| `boe` | Settings boolean override evaluator |
| `ssn` | Settings string normalizer |
| `Qon` | Policy settings reader |
| `vXe` | Policy entries enumerator |
| `Nr` | Policy constraint checker |
| `In` | Policy settings loader |
| `BNe` | Blocked-model list checker |
| `XM` | Provider-mode detector |
| `Zpn` | Model shorthand chain resolver |
| `dwt` | Model tier and feature-flag evaluator |
| `$6s` | Settings object iterator |
| `z2u` | Model-provider-mode chain evaluator |
| `N6s` | Provider index resolver |
| `j2u` | Model-starts-with chain evaluator |
| `U6s` | Model prefix checker |
| `xe` | Feature gate pass handler |
| `Pe` | Feature gate pass telemetry emitter |
| `jbo` | Opus-1M availability checker |
| `see` | Credit/limit status evaluator |
| `Tfe` | Output renderer / text formatter |
| `yo` | UI component renderer |
| `g4i` | Terminal widget builder |
| `sb` | Model display-row builder |
| `Ife` | Pro-tier indicator renderer |
| `br` | Base renderer |
| `Di` | Model row item renderer |
| `Ybo` | Sonnet-1M availability checker |
| `sge` | Sonnet-1M credit/limit evaluator |
| `ETe` | Model-policy evaluator (disabled/absent/gateway checks) |
| `Su` | Anthropic provider resolver |
| `ydn` | Provider context resolver |
| `YH` | Model canonical-ID normalizer (replaces version separators) |
| `Efe` | Model feature array evaluator |
| `wt` | Telemetry event emitter |
| `So` | Model suffix / 1M-context appender |
| `EEt` | Model entitlement tester |
| `Rp` | String replacement utility |
| `mz` | Gateway-mode model evaluator |
| `zoe` | Gateway inclusion tester |
| `Yoe` | Model suffix handler (endsWith checks) |
| `nfn` | Non-firstParty model evaluator |
| `nJe` | Non-firstParty inclusion tester |
| `tJe` | Model tier-join evaluator |
| `I9t` | Model validation orchestrator (API probe + cache) |
| `$5` | Core API request function |
| `Lf` | API endpoint resolver |
| `dW` | HTTP client / API session builder |
| `g` | Request timeout wrapper |
| `wFe` | Response-feature checker (supports structured outputs etc.) |
| `ese` | Response cache reader |
| `Ikp` | Model-find utility (searches known-model list) |
| `ddo` | Model fingerprint hasher (SHA-256 via YBa) |
| `ufn` | API response body parser |
| `CSn` | API error classifier |
| `Z5e` | Memory-relevance / cache-relevance scorer |
| `ZM` | API response cacher |
| `L` | Background worker lifecycle manager |
| `JBa` | Request body serializer |
| `__n` | Temperature / inference parameter injector |
| `jC` | Message array mapper |
| `Awe` | Request payload assembler |
| `fWo` | Message content push handler |
| `EN` | Deep-clone utility (structuredClone) |
| `vJt` | Message content pop/push handler |
| `Ke` | Auth token resolver |
| `MRr` | Model rate-limit handler |
| `xRr` | Request deduplication / coalescing handler |
| `ASe` | API success state recorder |
| `Mr` | Model response metadata recorder |
| `Go` | API base URL resolver |
| `EDt` | API error detail extractor |
| `FU` | Subagent API request handler |
| `Wyt` | Streaming response handler |
| `PRp` | Model probe response parser |
| `ORp` | Model probe response classifier |
| `Kpl` | Model lowercase normalizer for picker |
| `Xlt` | Bootstrap model discovery orchestrator |
| `nEp` | Bootstrap fetch executor |
| `T` | Text/message formatter |
| `oEp` | Bootstrap response processor |
| `Ki` | Essential-traffic gate checker |
| `Zh` | Bootstrap cache reader |
| `gUr` | Header line parser (split/trim/indexOf/slice) |
| `G$` | Gateway-zone inclusion checker |
| `_s` | Provider-settings accessor |
| `Mt` | UI message printer |
| `WC` | WebSocket / connection wrapper |
| `iA` | OAuth implicit-auth flow handler |
| `LTe` | WIF (Workload Identity Federation) token exchanger |
| `mJe` | Anthropic API credentials resolver |
| `ks` | OAuth endpoint validator |
| `qC` | Axios error array classifier |
| `Dk` | HTTP error status handler (401/403) |
| `ke` | Auth token loader for bootstrap |
| `bRa` | Bootstrap cache writer |
| `_n` | Global config save orchestrator |
| `IQn` | Config file write-with-lock handler |
| `fDe` | Config file dirty-flag accessor |
| `hOo` | Config entries iterator |
| `TKt` | Config lock timestamp recorder |
| `cEe` | Config file reader |
| `EHt` | Config environment-variable overrides applier |
| `TQn` | Config save-with-fallback handler |
| `WH` | Bootstrap cache hash comparator |
| `Re` | Error reporter / log error emitter |
| `ao` | Error string coercer |
| `ot` | Output terminal renderer |
| `Pnu` | Log queue shift/push manager |
| `Ae` | String coercer for display |
| `zY` | Model-confirmed display builder |
| `ib` | Model display-name with suffix builder |
| `YG` | Model display-name suffix appender |
| `TOt` | Confirmation message renderer |
| `vKr` | Model confirmation UI component builder |
| `LBe` | Confirmation panel layout builder |
| `ywe` | Confirmation widget styler |
| `b0` | Confirmation icon/badge renderer |
| `VU` | Confirmation footer renderer |
| `_Vn` | Model-confirmed full output handler (writes message, triggers settings save) |
| `Ire` | Session-model-only flag resolver |
| `EWt` | Model-confirmed settings write handler |
| `ro` | Settings write-to-disk orchestrator |
| `jm` | Settings file path resolver |
| `Gt` | File-system path builder |
| `CEr` | Settings validator and writer |
| `MC` | Settings migration checker |
| `kn` | Path normalizer |
| `Nyr` | Settings write timestamp recorder |
| `z1e` | Settings on-disk loader |
| `BTt` | Atomic file write helper (temp→rename) |
| `De` | JSON serializer |
| `EH` | Cache clear utility |
| `Xss` | CLAUDE.md / project-settings file tracker |
| `p9` | Project settings path resolver (`.claude/settings.json`) |
| `gr` | Gitignore-rule evaluator |
| `DG` | Settings load-from-disk orchestrator |
| `$l` | Model row compact renderer |
| `_Te` | Model row "session only" tag renderer |
| `vm` | Model row full renderer (compact + provider info) |
| `Nxe` | Model picker item renderer |
| `$g` | Provider-info formatter |
| `TH` | Model display-name shortener |
| `zbo` | Model picker list builder |
| `Gpe` | Picker section header builder |
| `QR` | Picker already-selected tracker |
| `hz` | Picker item with provider-badge builder |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.