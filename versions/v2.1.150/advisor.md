---
type: feature-spec
feature: "advisor"
cc_version: "2.1.150"
updated: "2026-06-01"
tags: ["advisor", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.150 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/advisor`

> Analysis basis: CC v2.1.150 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.150

---

## Overview

The `/advisor` command configures the **Advisor Tool** — a subsystem that delegates to a stronger model (e.g., a more capable Claude variant) at key decision points during an agentic task. It presents a JSX-rendered UI, validates a target model string, performs a live model-validation call, and then persists the chosen advisor model into session state. The command is a `local-jsx` type, meaning it renders an interactive React component rather than emitting plain text.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `advisor` |
| description | Configure the Advisor Tool to consult a stronger model for guidance at key moments during a task |
| loc_byte | `12248553` |
| loc_byte_end | `12248840` |
| loc_line | `9996` |
| argumentHint | `null` |
| isHidden | `null` |
| module_id | `lB1` |
| load_inline | `true` |
| arbor_handler.name | `t85` |
| arbor_handler.fqn | `claude-2.1.150::t85` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.150 bundle.js:+12248553

---

## Input Branching

The handler has four distinct execution paths based on the trimmed argument string, requiring a Mermaid flowchart.

```mermaid
flowchart TD
    A["/advisor invoked"] --> B["Trim argument string\n(t85 → A.trim, bundle.js:+12248009)"]
    B --> C{Argument value?}

    C -- "\"off\" or \"unset\"" --> D["Disable advisor:\nClear advisor model from state\n(literals: 'off' @ +12248085, 'unset' @ +12248096)"]
    D --> E["Render JSX confirmation\n(jJ.createElement @ +12248045)"]

    C -- "empty string" --> F["Display current advisor config\nor interactive model picker\n(nq @ +12248163, rZ8 @ +12248177)"]
    F --> G["List available models via\nmodelResolver (Xg @ rZ8 callgraph)"]
    G --> E

    C -- "non-empty model name" --> H["Validate model name not empty\n('Model name cannot be empty' @ +12240412)"]
    H --> I["Normalize: toLowerCase\n(rZ8 → _.toLowerCase @ +12240535)"]
    I --> J{"Model in known-model\ncache (FB1.has @ +12240656)?"}
    J -- "yes (cached)" --> K["Skip live validation;\nuse cached result"]
    J -- "no" --> L["Run model validation API call\n(Gx @ +12240701 → Kp → side_query)"]
    L --> M{"Validation result?"}
    M -- "success" --> N["Store result in FB1\n(FB1.set @ +12240864)"]
    M -- "auth error" --> O["'Authentication failed…'\n(@ +12241111)"]
    M -- "network error" --> P["'Network error…'\n(@ +12241213)"]
    M -- "not_found_error" --> Q["'model:' prefix error msg\n(@ +12241414)"]
    N --> R["Apply model via F85/g85\n(@ +12240905/+12240960)"]
    K --> R
    R --> S["Persist advisor model\n(cf @ +12241724)"]
    S --> E

    C -- "shorthand alias" --> T["Resolve alias:\n'sonnet','haiku','opus','best','opusplan'\n(nq resolver @ +2180463–+2180619)"]
    T --> I
```

---

## Behavioral Spec

### Handler Entry Point — `advisorCommandHandler` (`t85`)

The Arbor-resolved handler `t85` is an `AsyncFunction` that serves as the sole entry point.

```
async function advisorCommandHandler(commandArgs, appContext):
    rawInput = commandArgs.trim()                        // A.trim @ +12248009
    jsxElement = createElement(AdvisorPanel, props)      // jJ.createElement @ +12248045

    if rawInput == "off" or rawInput == "unset":         // literals @ +12248085, +12248096
        disableAdvisor(appContext)
        return renderConfirmation("Advisor disabled")

    if rawInput == "":
        currentConfig = resolveCurrentAdvisorModel(appContext)   // nq @ +12248163
        modelList     = buildModelOptionsList(appContext)         // rZ8 @ +12248177
        return renderInteractivePicker(currentConfig, modelList)

    resolvedName = resolveModelAlias(rawInput)           // nq alias resolver
    return validateAndApplyModel(resolvedName, appContext)
```

Analysis basis: CC v2.1.150 bundle.js:+12248009

---

### Model Alias Resolution — `modelAliasResolver` (`nq`)

Accepts a raw string and resolves shorthand tokens to canonical model identifiers before any validation occurs.

```
function resolveModelAlias(input):
    normalized = input.trim().toLowerCase()              // nq → H.trim @ +2180367, _.toLowerCase @ +2180378

    // Tier aliases (literals @ +2180463–+2180619)
    aliasMap = {
        "opusplan": <opusplan canonical id>,             // +2180463
        "[1m]":     <1m-context canonical id>,           // +2180489
        "sonnet":   <latest sonnet canonical id>,        // +2180504
        "haiku":    <latest haiku canonical id>,         // +2180543
        "opus":     <latest opus canonical id>,          // +2180582
        "best":     <highest-tier canonical id>,         // +2180619
    }

    if normalized in aliasMap:
        return expandAlias(aliasMap[normalized])         // bW → ZqH → mH @ +2918119

    // Check provider-qualified names (e.g., "anthropic.claude-*")
    if normalized contains "anthropic.":                 // literal @ +2174609
        return validateProviderQualified(normalized)     // GqH @ +2180442

    // Apply replacement normalization for display
    cleaned = input.replace(pattern, replacement)        // nq → A.replace @ +2180406
    return cleaned
```

Analysis basis: CC v2.1.150 bundle.js:+2180367

---

### Model Option List Builder — `buildModelOptionsList` (`rZ8`)

Constructs the list of selectable models displayed in the interactive picker.

```
function buildModelOptionsList(appContext):
    rawModelId = appContext.currentModel.trim()          // rZ8 → H.trim @ +12240375

    if rawModelId == "":
        throw Error("Model name cannot be empty")        // literal @ +12240412

    availableModels = fetchModelRegistry(appContext)     // rZ8 → Xg @ +12240446
    normalized      = rawModelId.toLowerCase()           // rZ8 → _.toLowerCase @ +12240535

    // Filter models whose provider prefix is in the allowed list
    allowedProviders = WqH                               // rZ8 → WqH.includes @ +12240554
    filtered = availableModels.filter(m => allowedProviders.includes(m.provider))

    return filtered
```

Analysis basis: CC v2.1.150 bundle.js:+12240375

---

### Model Registry Fetcher — `modelRegistryFetcher` (`Xg`)

Builds the full structured model list from internal registries, enriched with provider metadata.

```
function buildRegistryList(appContext):
    base        = getBaseModelTable()                    // Xg → TA @ +2174456
    entries     = base.map(entry => entry.trim())        // Xg → A.map @ +2174533, f.trim @ +2174544

    // Prefix checks
    for entry in entries:
        if entry.startsWith("anthropic."):               // literal @ +2174609
            entry = resolveAnthropicProvider(entry)      // Xg → Yc6 @ +2174653

    // Apply exclusion list
    excluded = wI4                                       // Xg → ppH → wI4.includes @ +2173797
    entries  = entries.filter(e => !excluded.includes(e.provider))

    // Deduplicate by index
    entries = deduplicateByIndex(entries)                // Xg → Y79 → A.indexOf @ +2174340

    // Classify each model (Anthropic-first, partner, etc.)
    for entry in entries:
        isAnthropicModel = checkAnthropicOwnership(entry)  // Xg → jI4 @ +2174767
        if isAnthropicModel:
            entry.tier = classifyTier(entry)               // jI4 → nq @ +2174005

    return entries
```

Analysis basis: CC v2.1.150 bundle.js:+2174456

---

### Model Validation — `modelValidator` (`rZ8` + `Gx` + `Kp`)

Performs a live API call to confirm that the target model is accessible under the current credentials.

```
async function validateModel(modelId, appContext):
    // Cache check
    if FB1.has(modelId):                                 // rZ8 → FB1.has @ +12240656
        return FB1.get(modelId)

    // Build validation request (side_query mechanism)
    request = buildSideQuery({                           // Gx @ +12240701; literal "side_query" @ +13038804
        model:   modelId,
        content: "Hi",                                   // literal @ +12240820
        cache:   "ephemeral",                            // literal @ +12240845
        maxTokens: 1,                                    // implied by validation purpose
    })

    try:
        result = await apiClient.call(request)           // Kp @ +13038772 → full API stack

        // Store successful result
        FB1.set(modelId, result)                         // rZ8 → FB1.set @ +12240864

        // Determine canonical model alias for display
        applyCanonicalAlias(modelId, result)             // F85 @ +12240905 → g85 @ +12240960

        // Persist into advisor config
        persistAdvisorModel(modelId)                     // g85 → cf @ +12241724

        return { ok: true, model: modelId }

    catch AuthError:
        return { ok: false, message: "Authentication failed. Please check your API credentials." }
        // literal @ +12241111

    catch NetworkError:
        return { ok: false, message: "Network error. Please check your internet connection." }
        // literal @ +12241213

    catch ApiError where error.type == "not_found_error":
        return { ok: false, message: "model: " + modelId + " not found" }
        // literals @ +12241332, +12241414
```

Analysis basis: CC v2.1.150 bundle.js:+12240656

---

### Canonical Alias Application — `canonicalAliasApplier` (`F85` / `g85`)

After a successful validation, maps the raw model string to a normalised internal alias used in state and UI display.

```
function applyCanonicalAlias(modelId, validationResult):
    raw      = String(modelId)                           // F85 → String @ +12241601
    lowered  = raw.toLowerCase()                         // g85 → H.toLowerCase @ +12241651

    // Alias table (literals @ +12241681–+12241989)
    canonicalMap = {
        "opus-4-7"   : "opus_4_7",
        "opus-4-6"   : "opus_4_6",
        "opus-4-5"   : "opus_4_5",
        "sonnet-4-6" : "sonnet_4_6",
        "sonnet-4-5" : "sonnet_4_5",
    }

    // Check known-model inclusion list
    if not knownModels.includes(lowered):                // g85 → _.includes @ +12241670
        return null

    // Derive provider context
    providerCtx = resolveProviderFromModel(lowered)      // g85 → Z3 @ +12241633

    // Apply model config via cf
    persistModelConfig(providerCtx, canonicalMap[lowered] ?? lowered)  // g85 → cf @ +12241724
```

Analysis basis: CC v2.1.150 bundle.js:+12241601

---

### MCP Server State Refresh — `mcpServerRefresher` (`lv5` / `UyH` / `gDK`)

Called within the handler context to reflect any changed MCP connectivity after the advisor model is applied.

```
async function refreshMcpServers(appContext):
    entries = Object.entries(appContext.mcpConfig)       // lv5 → Object.entries @ +14981370
    active  = entries.filter(isActiveServer)             // lv5 → A.filter @ +14981394

    for server in active:
        clients = server.getClients()                    // lv5 → _.getClients @ +14981417

    // Update disabled/connected/failed status
    statusMap = {}
    for client in clients:
        transport = detectTransport(client)              // UyH; literals: "stdio"@+10090807, "sse"@+10090841, "http"@+10090873
        if transport == "disabled":                      // literal @ +10090705
            statusMap[client.name] = "disabled"
        else:
            result = await connectClient(client)
            if result.ok:
                statusMap[client.name] = "connected"    // literal @ +10091568
            else:
                statusMap[client.name] = "failed"       // literal @ +10092141

    // Apply updates to app state
    applyMcpUpdate(appContext, statusMap)                // gDK → H.applyMcpUpdate @ +14980996

    // Log retry stop if all remote servers recovered
    // "[MCP] Retry: all remote servers recovered, stopping" @ +14981566
```

Analysis basis: CC v2.1.150 bundle.js:+14981370

---

### Provider Resolution — `providerResolver` (`zc6` / `RA` / `cf`)

Determines which API provider backend to route the advisor model call through.

```
function resolveProvider(modelId):
    known = _H_.find(entry => entry.model == modelId)    // zc6 → _H_.find @ +2036725

    if known:
        provider = known.provider
    else:
        provider = inferProviderFromPrefix(modelId)      // zc6 → Ot @ +2036772

    // Provider literals (@ +2035544–+2036233)
    switch provider:
        case "bedrock":      return bedrockConfig()
        case "foundry":      return foundryConfig()
        case "anthropicAws": return anthropicAwsConfig()
        case "mantle":       return mantleConfig()
        case "vertex":       return vertexConfig()
        case "firstParty":   return firstPartyConfig()
        case "gateway":      return gatewayConfig()
        default:             return defaultConfig()
```

Analysis basis: CC v2.1.150 bundle.js:+2036725

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_api_success` | Fired on successful API call through core request handler (`Kp`); loc_byte +13040255 |
| Telemetry — `tengu_prompt_cache_1h_config` | Fired when 1-hour prompt cache configuration is applied to the side-query request; loc_byte +13000987 |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Fired if background dispatcher must escalate to SIGKILL; loc_byte +15260871 |
| Telemetry — `tengu_bg_dispatch_low_mem` | Fired when background dispatcher detects low memory; loc_byte +15261450 |
| Telemetry — `tengu_bg_spare_enable` | Fired when a spare background session slot is enabled; loc_byte +15262145 |
| Telemetry — `tengu_bg_spare_claim` | Fired when a spare session is claimed; loc_byte +15262266 |
| Telemetry — `tengu_bg_spare_claim_fail` | Fired on spare session claim failure; loc_byte +15262529 |
| Telemetry — `tengu_bg_proto_mismatch` | Fired on background protocol version mismatch; loc_byte +15249212 |
| Telemetry — `tengu_bg_dispatch_stale_drop` | Fired when a stale background dispatch is dropped; loc_byte +15250451 |
| Telemetry — `tengu_bg_attach_legacy_autorespawn` | Fired on legacy job auto-respawn during attach; loc_byte +15252527 |
| Telemetry — `tengu_bg_attach` | Fired on successful background session attach; loc_byte +15252938 |
| Telemetry — `tengu_bg_attach_stall_gave_up` | Fired when attach stall retry limit is exhausted; loc_byte +15253850 |
| Telemetry — `tengu_bg_attach_stall_respawn` | Fired when stalled attach triggers a respawn; loc_byte +15254119 |
| Telemetry — `tengu_bg_attach_kick` | Fired when attacher kicks an idle session; loc_byte +15255036 |
| Validation cache (`FB1`) | `FB1.has` / `FB1.set` used to cache per-model validation results; avoids redundant API calls on repeated invocations |
| Advisor model persistence | On successful validation, `cf` (model config persister) writes the resolved model name into session/project config; loc_byte +12241724 |
| MCP server state | `gDK` → `H.applyMcpUpdate` refreshes MCP connection state after model change; loc_byte +14980996 |
| JSX render | `jJ.createElement` is called to mount the `AdvisorPanel` component in the CLI UI; loc_byte +12248045 |
| Sound | No sound effects detected in depth-2 traversal |
| OAuth token check | Logs `[API:auth] OAuth token check starting` / `complete` during API client init; literals @ +2907203, +2907257 |

---

## Version History

| Version | Change |
|---|---|
| v2.1.150 | Initial analysis |

---

## Common Mistakes

1. **Using a bare alias without checking provider access.** Shorthand aliases like `"best"` or `"opus"` resolve to the highest-capability model, which may not be available under all API keys or subscription tiers. The validation step will surface an authentication or not-found error if the resolved model is unavailable.

2. **Forgetting `"off"` and `"unset"` are the only disable tokens.** Passing `"none"`, `"disable"`, or an empty string does not disable the advisor — only the exact literals `"off"` and `"unset"` trigger the disable path (literals at bundle.js:+12248085 and +12248096).

3. **Assuming instant effect on MCP tools.** The MCP server refresh (`lv5`) is asynchronous; tools backed by MCP servers may briefly show stale connectivity status immediately after `/advisor` returns.

4. **Re-specifying the same model repeatedly.** The `FB1` validation cache means the second invocation with the same model string skips the live API call. This is a feature, not a bug, but users relying on the call to test current API health should be aware it is cached for the session lifetime.

5. **Providing a model string with leading/trailing whitespace.** The handler trims input (`A.trim` at +12248009), but the empty-string guard fires after trimming, so a whitespace-only argument is treated as empty and opens the interactive picker rather than applying a model.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `t85` | Main handler — `advisorCommandHandler` (AsyncFunction; Arbor-resolved entry point) |
| `nq` | Model alias resolver — maps shorthand tokens to canonical model IDs |
| `rZ8` | Model option list builder / initial input normaliser |
| `Xg` | Model registry fetcher — constructs full provider-annotated model list |
| `F85` | Canonical alias applier — outer wrapper, converts raw string |
| `g85` | Canonical alias applier — inner logic, applies provider context and persists |
| `Gx` | Model validation orchestrator — builds and dispatches the side-query API call |
| `Kp` | Core API request client — handles auth, headers, retry, OAuth |
| `lv5` | MCP server state refresher — iterates configured MCP servers post-model-change |
| `UyH` | MCP client connection handler — per-transport connect logic |
| `gDK` | MCP state applicator — calls `applyMcpUpdate` on app state |
| `cf` | Model config persister — writes resolved model to session/project config |
| `zc6` | Provider resolver — maps model ID to API provider backend |
| `RA` | Provider config builder — constructs provider-specific request config |
| `bW` | Alias expansion helper — expands shorthand to full model descriptor |
| `ZqH` | Alias table lookup utility |
| `mH` | String normalisation / model name formatter |
| `GqH` | Provider-qualified model name checker (e.g., `anthropic.*` prefix) |
| `cv` | Model classification coordinator |
| `Z3` | Provider-from-model deriver |
| `UpH` | Model config updater — delegates to `cf` |
| `GZ` | Combined provider + config resolver |
| `D79` | Chained resolver wrapper around `GZ` |
| `Fl6` | Inclusion-list filter — checks against `PI4` allow-list |
| `BpH` | Model name builder — uses `mH` for formatting |
| `Yc6` | Anthropic provider model resolver — calls `HA`, iterates entries |
| `HA` | Base model table accessor |
| `ppH` | Exclusion filter — checks against `wI4` deny-list |
| `Y79` | Deduplicator — removes duplicates by index |
| `jI4` | Anthropic-ownership classifier — determines if model belongs to Anthropic |
| `JI4` | Alternate model classifier (handles `claude-` prefix models) |
| `z79` | Prefix checker for `claude-` model strings |
| `iw6` | Inline model-case normaliser — lowercase + includes check |
| `FD` | Async-store getter (reads from `j79` AsyncLocalStorage) |
| `Jl4` | Header parser — splits and trims multi-value headers |
| `bq` | Background-mode header injector (`bg` / `cli-bg`) |
| `Fn` | User-agent string builder |
| `S6` | SDK version info accessor |
| `y8_` | URL encoder for API path segments |
| `t$` | Retry/backoff scheduler |
| `W79` | Boolean-coercion guard for optional config fields |
| `dD` | API key / credential assembler |
| `wl4` | Timeout handler builder |
| `Mg6` | Proxy auth helper — reads `proxyAuthHelper` setting, enforces trust gate |
| `Wl4` | OAuth connection manager — manages token cache, UUID assignment |
| `UD` | Upstream provider dispatcher |
| `zY` | Proxy-Authorization header builder |
| `jl4` | Authorization header composer |
| `Y$H` | Response metrics recorder — records `Date.now` timestamps |
| `qC8` | Request timestamp recorder |
| `H36` | Header case-normaliser (lowercases header names) |
| `HOH` | SDK error/warn logger (`[Anthropic SDK ERROR]`) |
| `sa6` | Stream-response assembler |
| `h` | Focus/blur idle tracker (blurred/focused state, 3600000ms threshold) |
| `I` | Away-summary generator — `away_summary_generate` logic |
| `V2H` | Model prefix verifier — checks `startsWith` against `$TK` |
| `Rj` | Error response wrapper |
| `ev` | Event dispatcher for API responses |
| `apH` | WIF token exchange handler |
| `Pn6` | WIF credentials resolver — `fetch`-based credential acquisition |
| `G` | OAuth token getter — handles `remoteControlAtStartup` |
| `X` | IPC message framer — `Buffer.concat`, `indexOf`, subarray |
| `J` | IPC transport channel |
| `w` | Background session process manager — spawn/kill/memory checks |
| `zM` | IPC stream terminator |
| `Ok5` | Background daemon protocol handler — full message dispatch loop |
| `EH` | String coercion utility (`String(x)`) |
| `kTH` | Model capability tester — checks Bedrock profile, Claude-3 prefix |
| `Xq` | Model provider qualifier |
| `sh` | Gateway model resolver |
| `T` | MCP tool/server capability registry |
| `jf5` | Side-query message finder — locates user/text message in history |
| `PHA` | SHA-256 hash generator (`Bo1.createHash`) |
| `dl6` | Cache-control header builder (` cch=00000;` pattern) |
| `gl6` | AsyncLocalStorage context reader (`P79.getStore`) |
| `he6` | Model route validator |
| `ovH` | Prompt-cache configuration applicator (`1h` cache, `repl_main_thread*`) |
| `EA` | Streaming event aggregator |
| `V6` | Tool-use cache registrar |
| `vZ` | Cache-key builder |
| `KL_` | Cache-key prefix resolver |
| `OP` | Model-name character replacer |
| `Ks6` | Temperature override checker for specific model families |
| `G2` | Message mapper (maps history to API content blocks) |
| `VzH` | Full API request assembler |
| `CH` | JSON stringifier wrapper |
| `$p` | Random-bytes nonce generator |
| `R5` | Tool-result cache builder |
| `hVH` | Interrupt/hook signal handler |
| `iW7` | Built-in agent hook dispatcher |
| `RH` | Hook result renderer |
| `rQ` | Agent type router |
| `nW7` | Custom agent name parser |
| `RHH` | Thread-type classifier (`repl_main_thread`, `hook_agent`, etc.) |
| `HA6` | Cache TTL enforcer |