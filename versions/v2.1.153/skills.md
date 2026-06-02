---
type: feature-spec
feature: "skills"
cc_version: "2.1.153"
updated: "2026-06-02"
tags: ["skills", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: "2.1.139"
analysis_basis: "CC v2.1.139 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/skills`

> Analysis basis: CC v2.1.139 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.139

---

## Overview

The `/skills` command lists the available skills (model capabilities and aliases) that Claude Code can dispatch, presenting them as a rendered JSX component inline in the terminal UI. It is an immediate, locally-handled command: no round-trip to the model is required. Upon invocation, the handler resolves the current model configuration, maps model identifiers to human-readable skill aliases, and returns a JSX element displaying the result.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `skills` |
| description | `List available skills` |
| immediate | `true` |
| module_id | `GOq` |
| load_inline | `true` |
| loc_byte | `11098231` |
| loc_byte_end | `11098363` |
| loc_line | `6709` |
| arbor_handler.name | `sP7` |
| arbor_handler.fqn | `claude-2.1.139::sP7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.139 bundle.js:+11098231

---

## Input Branching

The handler has more than three distinct internal branches driven by model-alias resolution, provider detection, and feature-flag checks. A Mermaid flowchart is used below.

```mermaid
flowchart TD
    A["/skills invoked"] --> B[resolveModelConfig\ncall oU]
    B --> C[buildModelList\ncall rm6 via R1]
    C --> D{Provider type?}
    D -->|firstParty| E[Include standard Claude model list]
    D -->|anthropicAws| F[Filter for AWS inference profile IDs\napplication-inference-profile check]
    D -->|gateway| G[Apply gateway-specific model set]
    E --> H[normalizeModelId\ncall zw]
    F --> H
    G --> H
    H --> I[resolveSkillAlias\ncall Kq]
    I --> J{Alias keyword?}
    J -->|opusplan| K[Map → opus-plan tier\napply bold marker [1m]]
    J -->|sonnet| L[Map → sonnet tier]
    J -->|haiku| M[Map → haiku tier]
    J -->|opus| N[Map → opus tier]
    J -->|best| O[Map → best available]
    J -->|other| P[Pass through normalized ID]
    K --> Q[applyModelTier\ncall eZ / tZ / _oA]
    L --> Q
    M --> Q
    N --> Q
    O --> Q
    P --> Q
    Q --> R{featureFlag check\noU → DKL.has}
    R -->|flag present| S[Adjust capability set\ncall uM / $M]
    R -->|flag absent| T[Use default capability set]
    S --> U[Render JSX element\nyx_.createElement]
    T --> U
    U --> V[Return rendered skills list to UI]
```

Analysis basis: CC v2.1.139 bundle.js:+11098046 (JSX render), +2139409 (resolveModelConfig), +2139248 (buildModelList), +2141183 (aliasResolution)

---

## Behavioral Spec

### 1. Handler Entry (`sP7` — async handler)

The Arbor-resolved handler `sP7` is an `AsyncFunction` reached via `module_id → GOq`. When the user types `/skills`, the CLI invokes `sP7` with the current application context.

```
async function skillsCommandHandler(context):
    modelResult  = await resolveModelConfig(context)       // oU
    elementTree  = renderSkillsElement(modelResult)        // yx_.createElement
    return elementTree
```

Analysis basis: CC v2.1.139 bundle.js:+11098046, +11098120

---

### 2. Model Configuration Resolution (`oU`)

`oU` is the top-level model resolution function. It orchestrates three sub-steps: building the raw model list, checking a feature-flag set, and capping the result at a fixed maximum depth.

```
function resolveModelConfig(context):
    rawList      = buildModelList(context)                 // R1 → rm6
    flagged      = featureFlagFilter(rawList, DKL)         // DKL.has
    capped       = rawList.slice(0, MAX_DISPLAY)           // literal 4 at +2139401
    aliasMap     = normalizeAndAlias(capped)               // Kq
    return aliasMap
```

- Maximum skills displayed: **4** (bundle.js:+2139401)

Analysis basis: CC v2.1.139 bundle.js:+2139409, +2139417, +2139473

---

### 3. Building the Raw Model List (`R1` → `rm6`)

`rm6` enumerates all known model entries via `Object.entries` over an internal registry (`m_`), then `R1` applies normalization and filtering.

```
function buildModelList(context):
    registry     = getModelRegistry()                      // m_ → Ix
    entries      = Object.entries(registry)                // rm6 +2002883
    normalized   = []
    for each [id, meta] in entries:
        norm     = normalizeModelId(id, meta)              // zw
        if isValidForContext(norm, context):               // R1 +2139280 H.includes
            normalized.append(norm)
    return normalized
```

Analysis basis: CC v2.1.139 bundle.js:+2139248, +2002818, +2002883

---

### 4. Model ID Normalization (`zw`)

`zw` lowercases the raw model identifier, checks for a known prefix, and strips or replaces vendor suffixes to produce a canonical form.

```
function normalizeModelId(rawId):
    lower        = rawId.toLowerCase()                     // +2138296
    if lower.includes("application-inference-profile"):    // +2139291
        lower    = lower.replace(inferencePattern, "")     // +2139203
    return lower
```

Known concrete model IDs present in the registry (literals found in traversal):

| Canonical ID | Bundle byte |
|---|---|
| `claude-opus-4-7` | +2138323 |
| `claude-opus-4-6` | +2138380 |
| `claude-opus-4-5` | +2138437 |
| `claude-opus-4-1` | +2138494 |
| `claude-opus-4-0` | +2138583 |
| `claude-sonnet-4-6` | +2138615 |
| `claude-sonnet-4-5` | +2138676 |
| `claude-sonnet-4-0` | +2138771 |
| `claude-haiku-4-5` | +2138805 |
| `claude-3-7-sonnet` | +2138864 |
| `claude-3-5-sonnet` | +2138925 |
| `claude-3-5-haiku` | +2138986 |
| `claude-3-opus` | +2139045 |
| `claude-3-sonnet` | +2139098 |
| `claude-3-haiku` | +2139155 |

Analysis basis: CC v2.1.139 bundle.js:+2138296, +2138312, +2139203

---

### 5. Alias Resolution (`Kq`)

`Kq` maps a normalized model ID to a human-facing skill alias. The mapping uses lowercase comparison and a series of string operations.

```
function resolveSkillAlias(normalizedId):
    trimmed   = normalizedId.trim()                        // +2141154
    lower     = trimmed.toLowerCase()                      // +2141165
    tier      = classifyModelTier(lower)                   // WG → Y_H → SH

    if tier == "opusplan":                                 // +2141250
        label = "[1m]" + formatLabel(trimmed)              // +2141276  bold marker
        skill = applyOpusPlanConfig(label)                 // eZ
    else if tier == "sonnet":                              // +2141291
        skill = applySonnetConfig(trimmed)                 // kbH → $M
    else if tier == "haiku":                               // +2141330
        skill = applyHaikuConfig(trimmed)                  // tZ → $M
    else if tier == "opus":                                // +2141369
        skill = applyOpusConfig(trimmed)                   // tZ → $M
    else if tier == "best":                                // +2141406
        skill = applyBestConfig(trimmed)                   // _oA → tZ
    else:
        skill = applyGenericConfig(trimmed)                // uM

    skill.displayName = formatDisplayName(trimmed)         // EU6, ybH
    return skill
```

- `EU6` checks inclusion in an allow-list `YKL` (bundle.js:+2141692)
- `ybH` delegates to `SH` which calls `String()` for final coercion (bundle.js:+2141730, +25188)
- Boolean flags `"yes"` / `"on"` (bundle.js:+25237, +25243) are recognized by `SH` as truthy strings

Analysis basis: CC v2.1.139 bundle.js:+2141154–+2141496

---

### 6. Provider-Specific Filtering

Three provider literals drive conditional branches inside `uM` / `WA`:

| Provider literal | Bundle byte |
|---|---|
| `firstParty` | +2001932 |
| `anthropicAws` | +2001950 |
| `gateway` | +2001970 |

```
function applyProviderFilter(skillConfig, providerType):
    if providerType == "firstParty":
        return defaultCapabilities(skillConfig)            // WA +2001915
    if providerType == "anthropicAws":
        return awsCapabilities(skillConfig)                // ekH, mAL, tBA, im6 via $M
    if providerType == "gateway":
        return gatewayCapabilities(skillConfig)            // WA via $M +2003074
```

Analysis basis: CC v2.1.139 bundle.js:+2001915, +2001932, +2001950, +2001970, +2003035–+2003074

---

### 7. Feature Flag Gating

After the skill list is assembled, `oU` checks `DKL.has(...)` to determine whether certain extended skills should be shown:

```
function featureFlagFilter(skillList, flagSet):
    result = []
    for skill in skillList:
        if not flagSet.has(skill.flagKey):                 // DKL.has +2139473
            result.append(skill)
    return result
```

The maximum final list size is capped at **3** entries by a literal found at bundle.js:+2139486.

Analysis basis: CC v2.1.139 bundle.js:+2139473, +2139486

---

### 8. JSX Rendering

The handler constructs and returns a React element tree via `yx_.createElement`. No text is streamed to the model; the output is rendered directly in the terminal UI widget layer.

```
function renderSkillsElement(resolvedSkills):
    children = resolvedSkills.map(skill => createElement(SkillRow, skill))
    return createElement(SkillsContainer, {}, ...children)  // yx_.createElement +11098046
```

Analysis basis: CC v2.1.139 bundle.js:+11098046

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal (`telemetry: []`) |
| Hook registration | None observed |
| appState changes | No persistent state mutations detected; read-only model registry access |
| Sound | None detected |
| Model registry read | `m_` → `Ix` consulted at +2002818 / +1184867 |
| Feature flags read | `DKL` Set consulted at +2139473 |
| Random / timer | `Math.random` (+12439009) and `setTimeout` (+12439046) reached via `H`; likely used in display animation or jitter, not core logic |
| Truncation limit | Display list capped at 4 entries (+2139401); post-flag-filter cap at 3 (+2139486) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.139 | Initial analysis |

---

## Common Mistakes

1. **Expecting model output**: `/skills` is `immediate: true` and `local-jsx` — it never sends a prompt to the model. Waiting for a streaming response will time out.
2. **Assuming all registered models appear**: The display list is capped (4 raw, 3 after flag filter). Models present in the registry but beyond the cap will not be shown.
3. **Misreading alias keywords as model IDs**: `opusplan`, `sonnet`, `haiku`, `opus`, and `best` are alias-resolution tier keywords, not literal API model IDs. The actual dispatched ID comes from the normalized registry entry.
4. **Treating provider branches as mutually exclusive UI options**: Provider filtering (`firstParty` / `anthropicAws` / `gateway`) is driven by the current authentication/endpoint configuration, not by user input to `/skills`.
5. **Expecting telemetry events**: No `tengu_*` telemetry events are fired by this command in v2.1.139; do not build observability pipelines expecting them.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `sP7` | Async handler for `/skills` command (Arbor-resolved entry point) |
| `oU` | Top-level model configuration resolver; orchestrates list build + alias mapping |
| `Kq` | Skill alias resolver; maps normalized model IDs to tier labels |
| `H` | Utility / string helper; also holds `Math.random` + `setTimeout` (display jitter) |
| `_` | Generic string utility (toLowerCase, replace operations) |
| `WG` | Model tier classifier; delegates to `Y_H` |
| `Y_H` | Inner tier classification helper; calls `SH` |
| `A` | String normalization helper (toLowerCase, replace) |
| `f` | Connection/stream handle utility (`close` operations) |
| `O_H` | Feature inclusion checker; calls `$_H.includes` |
| `eZ` | OpusPlan-tier capability applicator; calls `uM` and `$M` |
| `uM` | Base capability builder; calls `WA` |
| `$M` | Provider-branched capability builder; calls `ekH`, `mAL`, `tBA`, `im6`, `WA` |
| `kbH` | Sonnet-tier capability applicator; delegates to `$M` |
| `tZ` | Haiku/Opus-tier capability applicator; calls `uM` and `$M` |
| `_oA` | "Best" tier applicator; delegates to `tZ` |
| `EU6` | Display name allow-list checker; uses `YKL.includes` |
| `ybH` | Display name formatter; delegates to `SH` |
| `SH` | String coercion / boolean-string recognizer; calls `String()` |
| `R1` | Model list filter/builder; calls `rm6`, `zw`, `H.includes`, `_Z8`, `uj` |
| `rm6` | Raw model registry enumerator; calls `m_` and `Object.entries` |
| `m_` | Model registry accessor; calls `Ix` |
| `zw` | Model ID normalizer; toLowerCase + includes + replace pipeline |
| `_Z8` | Auxiliary model filter predicate |
| `uj` | Model ID suffix replacer; calls `H.replace` |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.