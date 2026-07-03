---
type: feature-spec
feature: "advisor"
cc_version: "2.1.199"
updated: "2026-07-03"
tags: ["advisor", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.199 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/advisor`

> Analysis basis: CC v2.1.199 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.199

---

## Overview

`/advisor` lets the user select which stronger model Claude Code consults at key decision moments during a session. The command presents a model-picker UI, validates the chosen model identifier, and — when the user confirms — writes the advisor model setting to the active session's configuration. The change persists for the current session only unless saved to a settings file.

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
| module_id | `ruc` |
| load_inline | `true` |
| loc_byte | `13259108` |
| loc_byte_end | `13259419` |
| loc_line | `9857` |
| arbor_handler.name | `Gcm` |
| arbor_handler.fqn | `claude-2.1.199::Gcm` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.199 bundle.js:+13259108

---

## Input Branching

The command follows 4+ distinct branches depending on control-channel availability, current argument content, model validation outcome, and user confirmation. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/advisor invoked"] --> B{Control channel\navailable?}
    B -- No --> C["Display error:\n'advisor can't be changed —\nview-only or no control channel'"]
    B -- Yes --> D{Argument provided?}
    D -- No / empty --> E["Render model-picker JSX UI\n(Gcm: n8.jsx render)"]
    E --> F["User selects or types model name"]
    F --> G{Validate model name\nvia modelValidator (qYt)}
    D -- Non-empty arg --> G
    G -- Empty string --> H["Error: 'Model name cannot be empty'\nbundle.js:+9802632"]
    G -- Name not in known-models set\n(COo.has check) --> I{API probe:\ncall uF (side_query)}\n
    I -- auth error --> J["Error: 'Authentication failed.\nPlease check your API credentials.'\nbundle.js:+9803368"]
    I -- network error --> K["Error: 'Network error.\nPlease check your internet connection.'\nbundle.js:+9803470"]
    I -- not_found_error --> L["Error: model not found message\nbundle.js:+9803589"]
    I -- success --> M["Cache result in COo (ephemeral)\nbundle.js:+9803090"]
    M --> N{Prompt user\nfor confirmation}
    G -- Already in COo cache --> N
    N -- Confirmed --> O["Write advisor model setting\napply_flag_settings\nbundle.js:+13255010"]
    O --> P["Display confirmation\n'(this session only)'\nbundle.js:+13254870"]
    N -- Cancelled --> Q["Abort — no change"]
```

---

## Behavioral Spec

### 1. Command Entry — `advisorHandler` (Gcm)

The handler is an `AsyncFunction` resolved via `module_id` → `ruc`.

```
async function advisorHandler(inputArg, appContext):
    # Check for control channel
    if not appContext.hasControlChannel():
        display("The advisor can't be changed from this client — "
                "this connection is view-only or has no control channel")
        return

    # Trim whitespace from raw argument
    trimmedArg = inputArg.trim()           # Gcm → n.trim, bundle.js:+13258578

    # Render JSX picker if no argument supplied
    if trimmedArg is empty:
        renderModelPickerUI(appContext)    # Gcm → n8.jsx, bundle.js:+13258614
        return

    # Proceed with provided model name
    result = await validateAndApplyModel(trimmedArg, appContext)
    return result
```

Analysis basis: CC v2.1.199 bundle.js:+13258578

---

### 2. Model Validation — `modelValidator` (qYt)

```
async function modelValidator(rawName, appContext):
    name = rawName.trim()

    if name is empty:
        throw Error("Model name cannot be empty")  # bundle.js:+9802632

    # Normalize
    nameLower = name.toLowerCase()                  # qYt → n.toLowerCase, bundle.js:+9802780

    # Check known-model blocklist / allowlist
    if nameLower in excludedModels (eye.includes):  # bundle.js:+9802799
        throw Error(...)

    # Check ephemeral validation cache (COo)
    if COo.has(nameLower):                          # bundle.js:+9802901
        return cachedResult

    # Perform side-query API probe
    probeResult = await sideQueryProbe(nameLower, appContext)  # qYt → uF, bundle.js:+9802946

    # Cache result ephemerally
    COo.set(nameLower, probeResult)                 # bundle.js:+9803109

    # Build model-tier info object
    tierInfo = buildTierInfo(probeResult)           # qYt → ZCf, bundle.js:+9803150

    return tierInfo
```

Analysis basis: CC v2.1.199 bundle.js:+9802595

---

### 3. Side-Query API Probe — `sideQueryProbe` (uF)

This function performs a lightweight, non-conversation API call (tagged `side_query` at bundle.js:+9327234) to check that the target model actually exists and is accessible under the current credentials.

```
async function sideQueryProbe(modelName, context):
    # Build minimal request payload
    payload = buildMinimalRequest(modelName)        # uF → aq, bundle.js:+9327202

    # Attempt fetch; globalThis.fetch used directly
    # bundle.js:+9327295
    try:
        response = await globalThis.fetch(payload)

        # Validate structured outputs capability
        # bundle.js:+9327362
        checkStructuredOutputs(response)

        # Compute and store response hash (vMo → SHA-256)
        # bundle.js:+9327434
        hashResult = computeSHA256Hash(response)

        # Return normalised probe result
        return buildProbeResult(response, hashResult)

    except AuthError:
        throw Error("Authentication failed. Please check your API credentials.")
                                                     # bundle.js:+9803368
    except NetworkError:
        throw Error("Network error. Please check your internet connection.")
                                                     # bundle.js:+9803470
    except APIError where error.type == "not_found_error":
        throw Error(buildNotFoundMessage(modelName)) # bundle.js:+9803589
```

Analysis basis: CC v2.1.199 bundle.js:+9327189

---

### 4. Model-Tier Info Builder — `tierInfoBuilder` (ZCf)

Converts the raw API probe response into a normalised tier-info object used by the UI and the settings writer.

```
function tierInfoBuilder(probeResponse):
    # Cast response fields
    label = String(probeResponse.label)   # ZCf → String, bundle.js:+9803870

    # Internal normalisation function (evf)
    tierData = normaliseTierFields(probeResponse)  # ZCf → evf, bundle.js:+9803205

    # normaliseTierFields (evf):
    #   - resolves canonical model slug via cd()   bundle.js:+9803902
    #   - lowercases provider tag                 bundle.js:+9803920
    #   - checks known-tier inclusion list        bundle.js:+9803939
    #   - maps to tier constants (tp)             bundle.js:+9804024

    # Known slug suffixes mapped inside evf:
    #   "fable-5" / "fable_5"      bundle.js:+9803950 / +9803973
    #   "opus-4-8" / "opus_4_8"    bundle.js:+9804050 / +9804074
    #   "opus-4-7" / "opus_4_7"    bundle.js:+9804119 / +9804143
    #   "opus-4-6" / "opus_4_6"    bundle.js:+9804188 / +9804212
    #   "opus-4-5" / "opus_4_5"    bundle.js:+9804257 / +9804281
    #   "sonnet-5" / "sonnet_5"    bundle.js:+9804326 / +9804350
    #   "sonnet-4-6" / "sonnet_4_6" bundle.js:+9804397 / +9804423
    #   "sonnet-4-5" / "sonnet_4_5" bundle.js:+9804472 / +9804498

    return tierData
```

Analysis basis: CC v2.1.199 bundle.js:+9803205

---

### 5. Model Name Normalisation — `modelNameNormaliser` (Bo)

Used as a shared utility to canonicalise raw model strings before any comparison or storage.

```
function modelNameNormaliser(rawName):
    name = rawName.trim()          # Bo → e.trim, bundle.js:+2347675
    nameLower = name.toLowerCase() # Bo → t.toLowerCase, bundle.js:+2347686

    # Apply provider-prefix stripping / aliasing
    name = applyProviderAliases(nameLower)   # Bo → vh, bundle.js:+2347704
    name = stripAnthropicPrefix(name)        # Bo → Zi, bundle.js:+2347714
    name = checkTierOverride(name)           # Bo → Uw, bundle.js:+2347732

    # Resolve opusplan alias → "Opus in plan mode, else Sonnet"
    # Literal "opusplan" at bundle.js:+2347819
    # Literal "[1m]" (1M context marker) at bundle.js:+2347803

    # Apply canonical model tier (cit, $w, yX, N$, rA, j6, z_)
    name = applyTierPriority(name)

    # Resolve "best" alias
    # Literal "best" at bundle.js:+2347978

    return { canonicalName: name, tier: resolvedTier }
```

Analysis basis: CC v2.1.199 bundle.js:+2347675

---

### 6. Apply & Persist Setting — `applyAdvisorSetting` (Fqo)

Dispatches the confirmed model choice into active-session state and optionally triggers settings persistence.

```
function applyAdvisorSetting(canonicalModel, appContext):
    # Telemetry: fire tengu_advisor_command
    emit("tengu_advisor_command")              # bundle.js:+13254691

    # Check control channel again (guard)
    if not appContext.hasControlChannel():
        display("The advisor can't be changed from this client — "
                "this connection is view-only or has no control channel")
                                               # bundle.js:+13254752
        return

    # Build display label (includes "(this session only)" suffix)
    label = buildLabel(canonicalModel)         # bundle.js:+13254870

    # Strip ANSI from display label (Ui → Bun.stripANSI)
    cleanLabel = stripANSI(label)

    # Write apply_flag_settings action
    applyFlagSettings(canonicalModel, appContext)  # bundle.js:+13255010

    # Apply context-sensitive message rendering
    #   I9n (filterCurrentMessages), tmt (filterTools),
    #   DDe (displayDelta), s8e (summaryBlock)
    renderConfirmationUI(appContext, cleanLabel)

    # Emit model-options summary (gM → qNt)
    displayModelOptionsSummary()
```

Analysis basis: CC v2.1.199 bundle.js:+13254681

---

### 7. Known Model Registry

The following canonical model identifiers appear as string literals within the model-resolution path reachable from `/advisor`:

| Family | Slugs found |
|---|---|
| Claude Fable | `claude-fable-5` (+2331477), `claude-fable-5` via `fable-5`/`fable_5` |
| Claude Mythos | `claude-mythos-5` (+2344763), `claude-mythos-preview` (+3093870) |
| Claude Opus 4 | `claude-opus-4-8` through `claude-opus-4-0` (+2344820–+2345137) |
| Claude Sonnet 5/4 | `claude-sonnet-5` (+2345169), `claude-sonnet-4-6` through `claude-sonnet-4-0` |
| Claude Haiku 4 | `claude-haiku-4-5` (+2345416) |
| Claude 3.x | `claude-3-7-sonnet` (+2345475), `claude-3-5-sonnet` (+2345536), `claude-3-5-haiku` (+2345597), `claude-3-opus` (+2345656), `claude-3-sonnet` (+2345709), `claude-3-haiku` (+2345766) |

Provider gate strings: `gateway` (+2176344), `bedrock` (+2176401), `foundry` (+2176451), `anthropicAws` (+2176507), `mantle` (+2176561), `vertex` (+2176609), `firstParty` (+2177228).

Analysis basis: CC v2.1.199 bundle.js:+2331477

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_advisor_command` (bundle.js:+13254691) — fired on every confirmed invocation |
| Telemetry | `tengu_api_success` (bundle.js:+9328907) — fired after successful side-query probe |
| Telemetry | `tengu_lone_surrogate_sanitized` (bundle.js:+9328603) — fired when lone surrogates are sanitized in model name |
| Telemetry | `tengu_prompt_cache_1h_config` (bundle.js:+14117851) — fired on prompt-cache configuration path (reachable from side-query) |
| Validation cache | `COo` — ephemeral `Map` (session-scoped); stores model-name → probe result to avoid redundant API calls |
| appState changes | Advisor model written via `apply_flag_settings` action; display label suffixed with `" (this session only)"` |
| Settings files | May touch `settings.json` / `settings.local.json` under `.claude/` (bundle.js:+1349828 / +1349890) if persistence is requested via flag-settings path |
| Control channel | Requires an active control channel (`thinClientDispatch: control-request`); view-only connections are rejected immediately |
| Sound | None observed in depth-2 traversal |
| Hook registration | None observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.199 | Initial analysis |

---

## Common Mistakes

1. **Running `/advisor` in a view-only session.** The command checks for a control channel before any other work; if the session was opened read-only (e.g., a secondary viewer pane), the command silently errors with the "view-only or no control channel" message and makes no change.

2. **Supplying a model alias that has not been seen before.** When the model name is not in the ephemeral cache (`COo`), the command triggers a live API probe. If the network or credentials are incorrect at invocation time, the selection fails with an auth or network error even though the model name may be valid.

3. **Expecting the change to persist across sessions.** The confirmation message explicitly appends `" (this session only)"` (bundle.js:+13254870). To make the advisor model permanent, write it to the project or user `settings.json`.

4. **Confusing short aliases with full slugs.** The normaliser (`Bo`) accepts aliases such as `"best"`, `"sonnet"`, `"opus"`, `"haiku"`, and `"opusplan"`, but the model sent to the API and stored is the canonical full slug. Verify the displayed canonical name before confirming.

5. **Passing a Bedrock ARN directly.** Bedrock ARN prefixes (`arn:aws:bedrock:` — bundle.js:+2343919) and `application-inference-profile` (bundle.js:+2345902) are handled by a separate resolution path; entering a raw ARN in a non-Bedrock session will likely fail validation.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Gcm` | Main handler for `/advisor` command (AsyncFunction, entry point) |
| `qYt` | Model validator: trims, lowercases, checks cache, invokes API probe |
| `uF` | Side-query probe: minimal API call to verify model existence |
| `Bo` | Model name normaliser: trims, lowercases, applies tier/alias resolution |
| `ZCf` | Tier-info builder: converts raw probe response to normalised tier object |
| `evf` | Tier-field normaliser (called by ZCf): slug mapping, provider tag lowercasing |
| `Fqo` | Advisor-setting applier: emits telemetry, writes flag settings, renders confirmation |
| `PDe` | Context-message builder (used by Fqo) |
| `mho` | Message-object constructor (used by PDe) |
| `tmt` | Tool-filter helper (used by Fqo) |
| `I9n` | Current-message filter (used by tmt and Fqo) |
| `DDe` | Display-delta renderer (used by Fqo) |
| `s8e` | Summary-block renderer (used by Fqo) |
| `gM` | Model-options summary display (called from Fqo) |
| `qNt` | Model-option item renderer (called by gM) |
| `Fp` | Model-option row builder (called by qNt) |
| `fv` | Model-list formatter (called by gM) |
| `VNt` | Model-entry detail formatter (called by fv) |
| `Rgi` | Available-model enforcement checker (called by VNt) |
| `NNt` | Model-name tier resolver (used across normalisation path) |
| `vh` | Provider-alias applier (called by Bo) |
| `uye` | Provider-string canonicaliser (called by vh) |
| `Zi` | Anthropic-prefix stripper (called by Bo and others) |
| `Uw` | Tier-override checker (called by Bo, qne, za) |
| `cit` | Tier-priority applier (called by Bo) |
| `DWr` | Tier dispatch (called by cit) |
| `tp` | Model-tier constants resolver |
| `mvn` | Model-variant normaliser (called by DWr, pvn, o0e, NWr) |
| `yX` | Model-family resolver (called by cit, DWr) |
| `CX` | Model-string cleaner (called by cit, Kne, VNt) |
| `xgi` | Full model-identifier resolver (called by Bo) |
| `lye` | Model-list entry builder (called by xgi, mho, sye, dvn) |
| `gr` | Model-tier group getter |
| `gu` | Model-feature-flag getter |
| `aye` | Array-or-scalar normaliser |
| `iye` | Model-includes checker |
| `za` | Context-document builder (system prompt / tool list) |
| `cd` | Canonical-model-id getter (called by NNt, Bo, evf) |
| `Oce` | Model-tier availability checker |
| `y4e` | Model-property extractor |
| `io` | Model-metadata resolver |
| `h_` | Model-name parser (prefix/suffix splitting) |
| `qu` | String replacement helper |
| `hx` | Environment-id resolver |
| `Vg` | Model-capability checker |
| `Q1t` | Model-version resolver |
| `iId` | Model-id prefix checker |
| `OV` | Model-provider object-value resolver |
| `Kw` | Model-context-window resolver |
| `aq` | Core API request builder / executor |
| `T` | HTTP request dispatcher |
| `at` | String-type coercer |
| `kt` | Auth token getter |
| `yf` | Auth helper initialiser |
| `EE` | API response event-stream handler |
| `bb` | API response batch-message handler |
| `Tit` | WIF credentials resolver |
| `vAn` | Proxy-auth helper executor |
| `v4d` | Request-ID / dedup tracker |
| `dze` | Prompt-cache configuration helper |
| `yR` | Structured-output capability resolver |
| `L` | Away-summary / conversation-state manager |
| `Tqt` | Away-summary generator |
| `HDe` | Tool-result content formatter |
| `Adn` | Message-array appendor |
| `rtt` | Message-array replacer |
| `Djr` | Tool-call validator |
| `tHi` | Tool-schema type checker |
| `Mjr` | Tool-dedup tracker |
| `mr` | Event-emitter helper |
| `Zf` | Event-bus getter |
| `qe` | Event-bus factory |
| `Ro` | Root event-bus |
| `u4t` | Subagent spawner |
| `R2` | Agent-type resolver |
| `Pup` | Agent-prefix parser |
| `SO` | Scope resolver |
| `i0t` | Idle-timer manager |
| `Hle` | SDK-version checker |
| `Qo` | Settings-loader entry point |
| `Hf` | Settings-file reader |
| `Qh` | Settings-file path resolver |
| `NLe` | Settings path builder |
| `t9` | Settings object constructor |
| `fKu` | Full settings-loader (reads all layers) |
| `TUr` | Settings merge orchestrator |
| `f_e` | File reader with cache |
| `TNr` | File-read cache writer |
| `S9e` | Policy-settings loader |
| `Zle` | Atomic file writer |
| `a_n` | Git-ignore tracker / settings appender |
| `l_` | Settings-cache clearer |
| `CV` | Settings-validation and save |
| `Ui` | ANSI-strip wrapper (Bun.stripANSI) |
| `vMo` | SHA-256 hash builder |
| `Avn` | API response content normaliser |
| `Evn` | Async-local-storage context getter |
| `sPn` | Model-tier span builder |
| `ZCr` | Prompt-cache request builder |
| `Ckn` | Temperature / capability flag setter |
| `qw` | Message mapper |
| `YEf` | Response-content finder |
| `Bce` | Model-resource resolver |
| `Rjr` | Foundry resource-id builder |
| `OAc` | Correlation-ID generator |
| `cG` | Random-bytes ID generator |
| `Fc` | Message-role formatter |
| `xe` | JSON stringifier wrapper |
| `YP` | Structured-clone wrapper |
| `So` | Conversation-event emitter |
| `HWe` | Tombstone / state-file reader |
| `wcs` | WebSocket connect helper |
| `Mcs` | Daemon session manager |
| `ot` | Daemon-event dispatcher |
| `h` | Background-session orchestrator |
| `phe` | Session-path builder |
| `ven` | Host-managed path builder |
| `Sge` | Session-file path resolver |
| `ke` | File write + error logger |
| `we` | Write-with-provider helper |
| `Le` | Log-entry formatter |
| `Pe` | GZe-based event emitter |
| `sCe` | System-memory reporter |
| `On` | Graceful-kill timer |
| `Ts` | Process-exit handler (emits `cli_error`, exits with code 1) |
| `Fqo` | (see above — advisor-setting applier) |
| `f_` | Vl-based flag resolver |
| `Vl` | Feature-flag evaluator |
| `kgi` | Model-tier sub-entries builder |
| `VNt` | (see above — model-entry detail formatter) |
| `jNt` | Model-list item constructor |
| `Eb` | Model-entry base builder |
| `ONt` | Model-object entry normaliser |
| `sye` | Model-synonym resolver |
| `dvn` | Model-variant dispatcher |
| `Kne` | Model-name completeness checker |
| `Lgi` | Model-label region tagger |
| `zwd` | Model-variant cascade resolver |
| `Nce` | Model-tier label builder |
| `K6` | Model-section renderer |
| `fv` | (see above — model-list formatter) |
| `UWr` | Model-row renderer |
| `Fce` | Max-tier row builder |
| `i0e` | Team-tier row builder |
| `dye` | Enterprise-tier row builder |
| `yb` | Tier-label assembler |
| `Kxe` | Model-context-size annotator |
| `avn` | Model-alias resolver |
| `vX` | Model-extension checker |
| `aBe` | Model-availability badge |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.