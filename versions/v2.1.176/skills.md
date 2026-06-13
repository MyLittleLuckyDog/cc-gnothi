---
type: feature-spec
feature: "skills"
cc_version: 2.1.176
updated: "2026-06-12"
tags: ["skills", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.175
analysis_basis: "CC v2.1.175 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/skills`

> Analysis basis: CC v2.1.175 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.175

---

## Overview

The `/skills` command is a `local-jsx` immediate command that lists the available skills (model capabilities/tiers) accessible within the current Claude Code session. It renders its output as a JSX component, resolving which skills are available by inspecting the active model configuration, provider context, and policy settings — then presenting the result inline without invoking the agent loop.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `skills` |
| description | `List available skills` |
| immediate | `true` |
| module_id | `J5K` |
| load_inline | `true` |
| loc_byte | `12540504` |
| loc_byte_end | `12540636` |
| loc_line | `8702` |
| arbor_handler.name | `$n7` |
| arbor_handler.fqn | `claude-2.1.175::$n7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.175 bundle.js:+12540504

---

## Input Branching

The command's handler resolves skill availability through multiple branching paths depending on model tier, provider, and policy settings. There are 5+ distinct branches, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/skills invoked"] --> B[Resolve current model identifier via normalizeModelId]
    B --> C[Lowercase + trim model string]
    C --> D{Model tier detection}
    D -->|contains 'fable' / 'claude-fable-5'| E[Fable tier]
    D -->|contains 'opusplan' / '[1m]'| F[Opus Plan tier]
    D -->|contains 'sonnet'| G[Sonnet tier]
    D -->|contains 'haiku'| H2[Haiku tier]
    D -->|contains 'opus' / 'claude-opus-4-x'| I[Opus tier]
    D -->|contains 'best'| J[Best tier]
    D -->|fallback / unrecognized| K[Default / unknown tier]

    E & F & G & H2 & I & J & K --> L[Resolve provider context]
    L --> M{Provider check}
    M -->|bedrock / anthropicAws| N[AWS Bedrock path]
    M -->|vertex| O[GCP Vertex path]
    M -->|foundry| P[Foundry path]
    M -->|gateway| Q[Gateway path]
    M -->|first-party / direct| R[Anthropic first-party path]

    N & O & P & Q & R --> S[Check policy settings]
    S --> T{application-inference-profile present?}
    T -->|yes| U[Apply inference profile constraints]
    T -->|no| V[Standard skill set]

    U & V --> W[Check feature flags: yes/on booleans]
    W --> X[Build skill list via createElement JSX tree]
    X --> Y[Render skill entries with formatted display names]
    Y --> Z[Return JSX component to terminal renderer]
```

Analysis basis: CC v2.1.175 bundle.js:+12540319, +2271132, +2273143, +2273161, +2112563

---

## Behavioral Spec

### Handler Entry Point — `skillsCommandHandler`

The async handler (`$n7`) is resolved via `module_id` `J5K`. It is an `AsyncFunction` that immediately returns a JSX element tree without entering the agent loop.

```
async function skillsCommandHandler(context):
    element = createElement(SkillsView, context)
    skillList = resolveAvailableSkills(context)
    return element containing skillList
```

Analysis basis: CC v2.1.175 bundle.js:+12540319, +12540393

---

### Skill Resolution — `resolveAvailableSkills`

The core skill-resolution pipeline (`$W`) calls into `buildSkillDescriptor` (`J1`) and applies several normalization and classification steps.

```
function resolveAvailableSkills(context):
    rawModelId = context.currentModelId
    normalizedId = normalizeInput(rawModelId)       // trim + lowercase
    tier = classifyModelTier(normalizedId)
    provider = detectProvider(context)
    policyConstraints = getPolicySettings(context)
    inferenceProfile = checkInferenceProfile(context)

    skillEntries = buildSkillDescriptor(
        tier, provider, policyConstraints, inferenceProfile
    )

    deduped = deduplicateSkills(skillEntries)       // Set-based dedup (sD4.has)
    return deduped
```

Analysis basis: CC v2.1.175 bundle.js:+2271140, +2271148, +2271151, +2271186

---

### Model Normalization — `normalizeInput`

```
function normalizeInput(raw):
    trimmed = raw.trim()
    lower = trimmed.toLowerCase()
    replaced = applyCanonicalReplacements(lower)    // _f: H.replace
    return replaced
```

Analysis basis: CC v2.1.175 bundle.js:+2273132, +2273143, +2253620

---

### Model Tier Classification — `classifyModelTier`

String matching against known tier keywords. The literals found in the bundle define the exact recognized tier tokens:

- `"fable"` → Fable tier (bundle.js:+2273209)
- `"[1m]"` → Opus Plan / 1M-context tier (bundle.js:+2273257)
- `"opusplan"` → Opus Plan tier (bundle.js:+2273272)
- `"sonnet"` → Sonnet tier (bundle.js:+2273313)
- `"haiku"` → Haiku tier (bundle.js:+2273352)
- `"opus"` → Opus tier (bundle.js:+2273391)
- `"best"` → Best-available tier (bundle.js:+2273425)
- `"claude-fable-5"` → Fable-5 model (bundle.js:+3247697)
- `"claude-mythos-5"` → Mythos-5 model (bundle.js:+3247719)
- `"claude-opus-4-7"` → Opus 4.7 model (bundle.js:+3247742)
- `"claude-opus-4-8"` → Opus 4.8 model (bundle.js:+3247765)

```
function classifyModelTier(normalizedId):
    if normalizedId includes "fable" or matches "claude-fable-5":
        return TIER_FABLE
    if normalizedId includes "claude-mythos-5":
        return TIER_MYTHOS
    if normalizedId includes "[1m]" or "opusplan":
        return TIER_OPUS_PLAN
    if normalizedId includes "sonnet":
        return TIER_SONNET
    if normalizedId includes "haiku":
        return TIER_HAIKU
    if normalizedId includes "opus" or matches "claude-opus-4-7" or "claude-opus-4-8":
        return TIER_OPUS
    if normalizedId includes "best":
        return TIER_BEST
    return TIER_UNKNOWN
```

Analysis basis: CC v2.1.175 bundle.js:+2273161, +3247663, +3247684, +3247697–3247765

---

### Provider Detection — `detectProvider`

```
function detectProvider(context):
    providerString = resolveProviderString(context)   // n_ / K6

    if providerString includes "bedrock" or "anthropicAws":
        return PROVIDER_AWS_BEDROCK
    if providerString includes "foundry":
        return PROVIDER_FOUNDRY
    if providerString includes "vertex":
        return PROVIDER_VERTEX
    if providerString includes "gateway":
        return PROVIDER_GATEWAY
    if providerString includes "firstParty":
        return PROVIDER_FIRST_PARTY
    return PROVIDER_UNKNOWN
```

Known provider literals: `"bedrock"` (bundle.js:+2112603), `"foundry"` (bundle.js:+2112653), `"anthropicAws"` (bundle.js:+2112709), `"vertex"` (bundle.js:+2112811), `"firstParty"` (bundle.js:+2113427), `"gateway"` (bundle.js:+2258894).

Analysis basis: CC v2.1.175 bundle.js:+2112563, +2113160, +2113420

---

### Policy Settings & Inference Profile Check

```
function getPolicySettings(context):
    settings = context.lookup("policySettings")    // literal: bundle.js:+2255233
    return settings

function checkInferenceProfile(context):
    profileId = context.inferenceProfileId
    if profileId includes "application-inference-profile":  // bundle.js:+2271022
        return INFERENCE_PROFILE_APP
    return INFERENCE_PROFILE_NONE
```

Analysis basis: CC v2.1.175 bundle.js:+2255230, +2255233, +2271022

---

### Skill Descriptor Construction — `buildSkillDescriptor`

The `J1` function is the central skill-descriptor builder. It assembles a structured list of skill entries by combining tier, provider, policy, and inference-profile data. It calls several sub-functions to format individual entries:

- **`formatSkillEntry`** (`hLH`) — formats a single skill entry with display name and metadata (bundle.js:+2273224)
- **`applyProviderSkillFilter`** (`zT`) — filters or annotates skills based on provider constraints (bundle.js:+2273290)
- **`applyPolicyFilter`** (`AjH`) — applies policy-based restrictions (bundle.js:+2273367)
- **`applyModelReplacements`** (`AF`) — substitutes canonical model display strings (bundle.js:+2273407)
- **`resolveSkillChain`** (`JD`) — builds the ordered skill chain for a given tier (bundle.js:+2273410)
- **`resolveUserSkills`** (`YN1`) — resolves user-level skill assignments and overrides (bundle.js:+2273439)
- **`resolveModelCapabilities`** (`gI`) — queries model capability flags (bundle.js:+2273520)

```
function buildSkillDescriptor(tier, provider, policy, inferenceProfile):
    base = resolveSkillChain(tier)
    filtered = applyProviderSkillFilter(base, provider)
    policyFiltered = applyPolicyFilter(filtered, policy)
    userSkills = resolveUserSkills(policyFiltered)
    capabilities = resolveModelCapabilities(tier, provider)
    entries = mergeSkillsAndCapabilities(userSkills, capabilities)
    formatted = entries.map(e => formatSkillEntry(e))
    replaced = applyModelReplacements(formatted)
    return replaced
```

Analysis basis: CC v2.1.175 bundle.js:+2273224, +2273290, +2273367, +2273407, +2273410, +2273439, +2273520

---

### Deduplication

A `Set`-backed membership check (via `sD4.has`) prevents duplicate skill entries in the final list. The numeric literal `3` (bundle.js:+2271199) and `4` (bundle.js:+2271132) appear to be threshold or slice constants used in set-trimming logic.

```
function deduplicateSkills(entries):
    seen = new Set()
    result = []
    for entry in entries:
        key = computeDedupeKey(entry)
        if not seen.has(key):
            seen.add(key)
            result.append(entry)
    return result
```

Analysis basis: CC v2.1.175 bundle.js:+2271186, +2271199, +2271132

---

### Feature Flag Evaluation

The string literals `"yes"` (bundle.js:+28042) and `"on"` (bundle.js:+28048) are checked as truthy boolean-like values during feature flag resolution (via `K6` / `String` coercion at bundle.js:+27993).

```
function isFlagEnabled(flagValue):
    coerced = String(flagValue).toLowerCase()
    return coerced == "yes" or coerced == "on" or coerced == "true"
```

Analysis basis: CC v2.1.175 bundle.js:+27993, +28042, +28048

---

### Random/Async Utility (`H`)

The `H` utility function uses `Math.random` (bundle.js:+14073685) and `setTimeout` (bundle.js:+14073722) with constants `2` (bundle.js:+14073683) and `1` (bundle.js:+14073699). This is consistent with a jitter or debounce helper used during async model-info fetches, not directly part of skill display logic.

```
function withJitter(fn):
    delay = Math.random() * 2 + 1   // 1–3 ms jitter
    return setTimeout(fn, delay)
```

Analysis basis: CC v2.1.175 bundle.js:+14073683, +14073685, +14073699, +14073722

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal |
| Hook registration | None detected (`immediate: true` — no agent loop hook) |
| appState changes | None — read-only command; queries model/provider state but does not mutate it |
| Sound | None detected |
| Rendering | Returns a JSX element tree via `aOA.createElement` (bundle.js:+12540319); rendered inline by the terminal JSX renderer |
| Set side-effect | `sD4` (Set) used for deduplication — ephemeral, not persisted (bundle.js:+2271186) |
| Async | Handler is `AsyncFunction`; may perform async model-info resolution before returning |

---

## Version History

| Version | Change |
|---|---|
| v2.1.175 | Initial analysis |

---

## Common Mistakes

1. **Expecting agent output**: `/skills` is `immediate: true` — it does not invoke the agent loop. The output is rendered as a JSX component directly, not as a streamed agent response.
2. **Assuming static skill list**: The displayed skills depend on the active model ID, provider (Bedrock, Vertex, Foundry, Gateway, first-party), policy settings, and inference profile. The list is dynamic and context-sensitive.
3. **Unrecognized model names**: If the current model ID does not match any of the recognized tier tokens (`fable`, `opusplan`, `sonnet`, `haiku`, `opus`, `best`, `claude-fable-5`, `claude-mythos-5`, `claude-opus-4-7`, `claude-opus-4-8`), the command falls back to a default/unknown tier with a potentially reduced skill listing.
4. **Missing inference profile**: On AWS Bedrock, the presence of an `application-inference-profile` identifier changes which skills are shown. Omitting or misconfiguring the profile can produce an incomplete skill list.
5. **Feature flags not recognized**: Only the exact strings `"yes"` and `"on"` (case-insensitively after `String()` coercion) are treated as truthy flag values; any other truthy string will be treated as disabled.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `$n7` | Main handler for `/skills` command (`skillsCommandHandler`); async function resolved via module_id `J5K` |
| `$W` | Top-level skill resolution dispatcher (`resolveAvailableSkills`) |
| `J1` | Central skill descriptor builder (`buildSkillDescriptor`) |
| `H` | Jitter/debounce async utility (uses `Math.random` + `setTimeout`) |
| `_` | Input string being normalized (trim/lowercase subject) |
| `Rz` | Model string classifier or router |
| `ILH` | Model capability index lookup |
| `_f` | String replacement helper (`applyCanonicalReplacements`) |
| `UI` | Inclusion/exclusion filter using `vhH.includes` |
| `hLH` | Single skill entry formatter (`formatSkillEntry`) |
| `mD_` | Sub-formatter composing `S7`, `Ol`, `ij6` |
| `Ol` | Skill node builder using `n_` and `jL` |
| `ij6` | String replacement sub-step within entry formatting |
| `zT` | Provider-based skill filter (`applyProviderSkillFilter`) |
| `t18` | Provider filter sub-step using `S7` and `q7` |
| `AjH` | Policy-based skill filter (`applyPolicyFilter`) |
| `UD_` | Policy filter sub-step using `S7` |
| `AF` | Model display string replacer (`applyModelReplacements`) |
| `JD` | Ordered skill chain resolver (`resolveSkillChain`) |
| `hhH` | Skill chain entry constructor using `S7`, `n_`, `q7` |
| `YN1` | User-level skill resolver (`resolveUserSkills`) |
| `I_H` | User skill assignment handler using `n_`, `jL`, `_jH`, `NLH` |
| `oK` | Comprehensive skill-set assembler (called from `YN1`; many sub-calls) |
| `q7` | Skill property accessor using `n_` |
| `n_` | Base node/property resolver (uses `K6`) |
| `IhH` | Inclusion check against `tD4` array |
| `xnH` | String-to-key converter via `K6` |
| `K6` | Primitive coercion utility (wraps `String()`) |
| `lD4` | Lowercase normalizer (`H.toLowerCase`) |
| `gI` | Model capability resolver (`resolveModelCapabilities`); calls `ILH`, `q1`, `_z`, `jL` |
| `q1` | Capability query function using `qnH`, `Sz`, `H.includes`, `nM6`, `U7` |
| `_z` | Capability flag evaluator using `qj6`, `$z4`, `n_`, `Aj6` |
| `jL` | JSX/node list builder (uses `EA8`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.