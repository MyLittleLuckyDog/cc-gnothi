---
type: feature-spec
feature: "skills"
cc_version: "2.1.195"
updated: "2026-06-27"
tags: ["skills", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.195 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/skills`

> Analysis basis: CC v2.1.195 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.195

---

## Overview

The `/skills` command lists the available skills (capabilities) that Claude Code can perform in the current session. It is a `local-jsx` command that renders its output as a JSX component immediately upon invocation, without requiring a round-trip to the AI model. The command queries the current model and environment context to assemble a skill inventory and presents it to the user inline in the terminal UI.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `skills` |
| description | `List available skills` |
| loc_byte | `12579577` |
| loc_byte_end | `12579709` |
| loc_line | `8489` |
| immediate | `true` |
| module_id | `aVl` |
| load_inline | `true` |
| arbor_handler.name | `cGf` |
| arbor_handler.fqn | `claude-2.1.195::cGf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.195 bundle.js:+12579577

---

## Input Branching

The handler logic branches across more than three distinct paths depending on model family, provider/environment, and feature-flag state. A flowchart best represents this structure.

```mermaid
flowchart TD
    A(["/skills invoked"]) --> B["Resolve current model identifier\n(normalize: trim, lowercase)"]
    B --> C{"Model family detection"}

    C -->|contains 'fable'| D["Fable model branch\n(apply fable-specific capability set)"]
    C -->|contains 'opusplan'| E["Opus-plan model branch"]
    C -->|contains 'sonnet'| F["Sonnet model branch"]
    C -->|contains 'haiku'| G["Haiku model branch"]
    C -->|contains 'opus'| H["Opus model branch"]
    C -->|contains 'claude-mythos-5' or 'claude-mythos-preview'| I["Mythos model branch"]
    C -->|'best' alias| J["Best-model alias branch"]
    C -->|unrecognized| K["Default / fallback capability set"]

    D & E & F & G & H & I & J & K --> L{"Provider / environment check"}

    L -->|bedrock| M["AWS Bedrock constraints applied"]
    L -->|foundry| N["Azure Foundry constraints applied"]
    L -->|anthropicAws / vertex| O["Cloud-provider constraints applied"]
    L -->|gateway| P["Gateway constraints applied"]
    L -->|first-party (direct API)| Q["Full first-party capability set"]

    M & N & O & P & Q --> R{"Policy / feature-flag gates"}

    R -->|policySettings present| S["Filter skills by policy"]
    R -->|application-inference-profile| T["Inference-profile capability adjustments"]
    R -->|mantle flag active| U["Mantle feature gating"]
    R -->|no overriding flags| V["All resolved skills pass through"]

    S & T & U & V --> W{"Skill list construction\n(slug normalization, deduplication,\n[1m] format markers)"}
    W --> X["Render SkillList JSX component\n(lVl.jsx)"]
    X --> Y(["Display to user"])
```

Analysis basis: CC v2.1.195 bundle.js:+12579390 (JSX render), +12579454 (skill resolver entry), +2316767–2317194 (model/environment branching)

---

## Behavioral Spec

### 1. Entry Point — Async Handler (`cGf`)

The Arbor-resolved handler is the `AsyncFunction` `cGf`, reached via `module_id → aVl`. It performs two top-level actions:

```
async function skillsCommandHandler(context):
    skillList = resolveSkillList(context)      // calls ob → Ko pipeline
    return renderSkillListComponent(skillList) // calls lVl.jsx renderer
```

Analysis basis: CC v2.1.195 bundle.js:+12579390 (JSX call), +12579454 (resolver call)

---

### 2. Skill Resolution Entry (`ob`)

`ob` is the first-level resolver. It collects up to **4** candidate skill sources (numeric literal `4` at bundle.js:+2314603), then narrows them by:

- Applying a name normalization transform (`Ha`)
- Running a model-family classifier (`mo`)
- Checking a membership set (`Ipd.has`) for deduplication/exclusion (up to **3** items; literal `3` at bundle.js:+2314670)

```
function resolveSkillList(context):
    candidates = collectCandidates(context, maxSources=4)
    normalized = normalizeNames(candidates)         // Ha
    classified = classifyByModel(normalized)        // mo
    deduplicated = filterByMembershipSet(classified) // Ipd.has, limit=3
    return deduplicated
```

Analysis basis: CC v2.1.195 bundle.js:+2314603 (limit 4), +2314619 (Ha), +2314622 (mo), +2314657 (Ipd.has), +2314670 (limit 3)

---

### 3. Model Identifier Normalization (`Ko`)

`Ko` is the core normalization and classification pipeline. Input model strings are:
1. Trimmed of whitespace (`e.trim`, bundle.js:+2316767)
2. Lowercased (`t.toLowerCase`, bundle.js:+2316778)
3. Passed through a slug-sanitizer (`EH → SHe`, bundle.js:+2316796)
4. Checked against the `[1m]` format marker string (bundle.js:+2316895) for one-minute/tier markers
5. Matched against model-family strings in order: `fable` (+2316844), `opusplan` (+2316911), `sonnet` (+2316956), `haiku` (+2316999), `opus` (+2317041), `best` (+2317079)
6. Processed through provider-detection helpers (`N_`, `zoi`, `td`, `aF`)
7. A final replace pass is applied on the raw token (`t.replace`, +2317194)

```
function normalizeAndClassifyModel(rawModelId):
    step1 = rawModelId.trim()
    step2 = step1.toLowerCase()
    step3 = slugSanitize(step2)           // EH → SHe
    
    family = matchFamily(step3):
        if contains("fable")    → FABLE
        if contains("opusplan") → OPUSPLAN
        if contains("sonnet")   → SONNET
        if contains("haiku")    → HAIKU
        if contains("opus")     → OPUS
        if equals("best")       → BEST
        else                    → UNKNOWN
    
    provider = detectProvider(step3)      // N_, zoi, td, aF pipeline
    formatMarker = checkFormatMarker(step3, "[1m]")
    
    return { family, provider, formatMarker, sanitized: step3.replace(...) }
```

Analysis basis: CC v2.1.195 bundle.js:+2316767–2317194

---

### 4. Provider / Environment Detection (`zoi`, `N_`, `td`, `aF`)

Multiple helpers collaborate to identify the runtime provider:

| Helper | Role | Key signal | loc_byte |
|---|---|---|---|
| `zoi` | Orchestrates provider detection | delegates to `hle`, `QBe`, `La`, `N_` | +2317093 |
| `N_` | Checks for `mantle` model variant | string `"mantle"` | +2302799 |
| `td` | Identifies bedrock/foundry/cloud providers | `"bedrock"`, `"foundry"`, `"anthropicAws"`, `"vertex"` | +2317111 |
| `aF` | Detects mythos-class and first-party models | `"claude-mythos-5"`, `"claude-mythos-preview"`, `"firstParty"` | +2317178 |

```
function detectProvider(modelId):
    if isMantleVariant(modelId):          // N_
        return MANTLE
    if isBedrockModel(modelId):           // td → fr → Lm/ut
        return BEDROCK
    if isFoundryModel(modelId):
        return FOUNDRY
    if isAnthropicAwsModel(modelId):
        return ANTHROPIC_AWS
    if isVertexModel(modelId):
        return VERTEX
    if isGatewayModel(modelId):           // zoi → La
        return GATEWAY
    if isMythosModel(modelId):            // aF: "claude-mythos-5" / "claude-mythos-preview"
        return MYTHOS
    if isFirstParty(modelId):             // G7 → "firstParty"
        return FIRST_PARTY
    return UNKNOWN
```

Analysis basis: CC v2.1.195 bundle.js:+2139751 (bedrock), +2139801 (foundry), +2139857 (anthropicAws), +2139959 (vertex), +2301013 (gateway), +3054075 (claude-mythos-5), +3054098 (claude-mythos-preview), +2140574 (firstParty)

---

### 5. Policy and Feature-Flag Gating (`La`, `Hn`, `mle`)

After provider and model family are resolved, a policy-settings gate (`"policySettings"`, bundle.js:+2297114) filters which skills are surfaced. Inference-profile detection (`"application-inference-profile"`, bundle.js:+2314493) may further restrict capabilities. The `mle` helper checks a known-exclusion list (`Cpd.includes`, bundle.js:+2317627) to omit unsupported skills for the resolved context.

```
function applyPolicyGating(skills, context):
    if context.policySettings:
        skills = filterByPolicy(skills, context.policySettings)
    
    if context.modelId.includes("application-inference-profile"):
        skills = applyInferenceProfileConstraints(skills)
    
    skills = skills.filter(s => !isExcluded(s))   // mle / Cpd.includes
    
    return skills
```

Analysis basis: CC v2.1.195 bundle.js:+2297114 (policySettings), +2314493 (application-inference-profile), +2317627 (Cpd exclusion check)

---

### 6. Slug Normalization Utilities

Several small helpers normalize model/skill name strings before comparison:

- **`Ha`** — applies a `replace` transform to sanitize characters (bundle.js:+2295099)
- **`C0`** — checks against an inclusion list (`HHe.includes`, bundle.js:+2295061)
- **`Qwe`** — applies an additional `replace` pass (bundle.js:+2318855)
- **`ypd`** — lowercases for comparison (`e.toLowerCase`, bundle.js:+2302411)
- **`L8`** — applies a `replace` pass for format normalization (bundle.js:+2304865)
- **`ZBe`** — coerces values via the `ut` string-conversion utility (bundle.js:+2317665)
- **`ut`** — wraps `String(...)` conversion (bundle.js:+29676); boolean-like values `"yes"` and `"on"` are also recognized (bundle.js:+29725, +29731)

---

### 7. JSX Rendering (`lVl.jsx`)

Once the skill list is fully resolved and filtered, the handler delegates to the `lVl.jsx` component for rendering. Because the command is registered with `immediate: true`, the component renders synchronously in the terminal UI without waiting for a model response.

```
function renderSkills(resolvedSkills):
    return <SkillListComponent skills={resolvedSkills} />
    // rendered immediately in terminal (immediate: true)
```

Analysis basis: CC v2.1.195 bundle.js:+12579390

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal |
| Hook registration | None detected |
| appState changes | None detected — read-only display command |
| Sound | None detected |
| Immediate rendering | `immediate: true` — output appears before any model turn |
| Model/provider read | Reads current model ID and environment provider from session context |
| Policy read | Reads `policySettings` from context if present |
| Deduplication | Uses a membership set (`Ipd`) to prevent duplicate skill entries |

---

## Version History

| Version | Change |
|---|---|
| v2.1.195 | Initial analysis |

---

## Common Mistakes

1. **Expecting model output**: `/skills` is `immediate: true` and `local-jsx` — it never sends a prompt to the model. The skill list is computed entirely client-side from the session context.
2. **Assuming a fixed skill list**: The displayed skills depend on the resolved model family (`fable`, `sonnet`, `haiku`, `opus`, `opusplan`, `best`, mythos) and the runtime provider (`bedrock`, `foundry`, `vertex`, `gateway`, `first-party`). The same command may display different skills in different environments.
3. **Ignoring policy filtering**: When `policySettings` are active (e.g., in enterprise deployments), some skills may be hidden even if the model nominally supports them.
4. **Confusing `opus` with `opusplan`**: The model-family matcher checks `opusplan` before `opus`, so an `opusplan` model ID is never classified as plain `opus`.
5. **Expecting telemetry events**: No `tengu_*` telemetry events are fired by this command; do not rely on telemetry for observing `/skills` invocations.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `cGf` | Main async handler for `/skills` (Arbor-resolved entry point) |
| `ob` | Skill-list resolver: collects, normalizes, and deduplicates skill candidates |
| `Ko` | Core model-ID normalization and classification pipeline |
| `EH` | Slug sanitizer dispatcher (delegates to `SHe`) |
| `SHe` | Slug sanitization implementation (uses `ut`) |
| `Ha` | String replace-based name sanitizer |
| `C0` | Inclusion-list checker (`HHe.includes`) |
| `QBe` | Skill-entry builder / formatter (uses `GBr`, `lw`, `G7`, `Qwe`) |
| `GBr` | Sub-builder for skill entries (uses `qp`, `G7`, `Qwe`) |
| `lw` | Utility: likely a logging or listing helper used across builders |
| `G7` | Provider-type classifier (returns `"firstParty"` etc.; uses `fr`, `_u`) |
| `Qwe` | String replace normalization for skill slugs |
| `jL` | Skill-entry variant builder (uses `lw`, `yAn`) |
| `yAn` | Sub-builder with `qp` and `td` |
| `K5` | Another skill-entry builder variant (uses `lw`, `jBr`) |
| `jBr` | Sub-builder using `qp` |
| `L8` | Format-normalization helper (`e.replace`) |
| `N_` | Mantle-model detector (uses `lw`, `Jwe`) |
| `Jwe` | Mantle resolution helper (uses `qp`, `fr`, `td`; string `"mantle"`) |
| `zoi` | Provider-detection orchestrator (uses `hle`, `QBe`, `La`, `N_`) |
| `hle` | Gateway/provider probe (uses `fr`, `_u`, `yHe`, `_He`) |
| `La` | Full skill-list assembly for a resolved provider/model combination |
| `td` | Cloud-provider detector (`bedrock`, `foundry`, `anthropicAws`, `vertex`) |
| `fr` | Provider-resolution core (uses `Lm`, `ut`) |
| `mle` | Exclusion-list checker (`Cpd.includes`) |
| `ZBe` | Value coercion wrapper (uses `ut`) |
| `ut` | String conversion utility (wraps `String(...)`) |
| `ypd` | Lowercase comparator (`e.toLowerCase`) |
| `aF` | Mythos-model and first-party detector (uses `SHe`, `mo`, `Kwe`, `l_`, `_u`) |
| `mo` | Model-family classifier (uses `Ant`, `O_`, `e.includes`, `$vt`, `dp`) |
| `Kwe` | Resolution helper (uses `rpd`) |
| `l_` | Resolution chain helper (uses `QMt`, `Tld`, `fr`, `E8`) |
| `_u` | Environment/context accessor (uses `OEn`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.