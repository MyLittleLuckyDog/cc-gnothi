---
type: feature-spec
feature: "feedback"
cc_version: "2.1.143"
updated: "2026-05-18"
tags: ["feedback", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.143 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/feedback`

> Analysis basis: CC v2.1.143 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.143

---

## Overview

The `/feedback` command (aliased as `/bug`) provides a mechanism for users to submit feedback or bug reports about Claude Code directly from the CLI. Before opening the feedback submission flow, the command performs a multi-stage gate check — evaluating environment variables, organizational policy, and provider type — and aborts with an explanatory message if any gate fails. When all gates pass, it constructs a React JSX element and renders the feedback UI with a randomized interaction delay.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `feedback` |
| description | `Submit feedback about Claude Code` |
| argumentHint | `[report]` |
| aliases | `["bug"]` |
| module\_id | `kqq` |

Analysis basis: CC v2.1.143 bundle.js:+10084882

---

## Input Branching

The command runs a sequential series of gate checks before rendering any UI. Each gate can independently abort the command with a user-facing message. The gates are evaluated in the order shown below.

```mermaid
flowchart TD
    A(["/feedback invoked"]) --> B{DISABLE_FEEDBACK_COMMAND\nenvironment variable set?}
    B -- Yes --> B1["Return error:\n'/feedback has been disabled via\nthe DISABLE_FEEDBACK_COMMAND\nenvironment variable'"]
    B -- No --> C{DISABLE_BUG_COMMAND\nenvironment variable set?}
    C -- Yes --> C1["Return error:\n'/feedback has been disabled via\nthe DISABLE_BUG_COMMAND\nenvironment variable'"]
    C -- No --> D{CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC\nenvironment variable set?\n(essential-traffic check)}
    D -- Yes --> D1["Return error:\n'/feedback has been disabled via\nthe CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC\nenvironment variable'"]
    D -- No --> E{Organization policy:\nallow_product_feedback == 0?}
    E -- Yes --> E1["Return error:\n'/feedback has been disabled by\nyour organization's policy'"]
    E -- No --> F{Provider type check}
    F -- "bedrock / foundry /\nanthropicAws / mantle /\nvertex / gateway" --> F1["Resolve human-readable\nprovider name\n(e.g. 'Amazon Bedrock',\n'Vertex AI', etc.)"]
    F1 --> F2["Check credential availability\nfor that provider"]
    F2 -- "No Anthropic auth\n(third-party provider)" --> G1["Abort: 'Anthropic auth not\nused on third-party providers'"]
    F2 -- "No OAuth token" --> G2["Abort: 'No OAuth token available'"]
    F2 -- "Cloud gateway in use" --> G3["Abort: 'Not available when\nusing a Cloud gateway'"]
    F2 -- "No API key" --> G4["Abort: 'No API key available'"]
    F2 -- "no_creds state" --> G5["Abort: 'no Anthropic credentials'"]
    F -- firstParty --> H{Credential check passes?}
    H -- No --> G4
    H -- Yes --> I["Resolve bundle + provider metadata"]
    I --> J["Build feedback POST request\nwith x-api-key header\nand anthropic-beta header"]
    J --> K["Apply random delay\n(Math.random + setTimeout,\nbase multiplier: 2)"]
    K --> L["Render JSX feedback UI element\nvia mC_.createElement"]
    L --> M([Done])
```

Analysis basis: CC v2.1.143 bundle.js:+10084548, +10063098, +10063406, +10063546, +10063673, +10064174, +10084608

---

## Behavioral Spec

### Gate 1 — `DISABLE_FEEDBACK_COMMAND` Environment Variable Check

```
function checkFeedbackEnvVar(environment):
    value = environment.get("DISABLE_FEEDBACK_COMMAND")
    normalizedValue = toString(value).toLowerCase()
    if normalizedValue is "yes" or "on" or "disabled":
        return Err("/feedback has been disabled via the DISABLE_FEEDBACK_COMMAND environment variable")
    return Ok
```

Analysis basis: CC v2.1.143 bundle.js:+10063098, +10063151, +10063169, +26373, +26422, +26428

The environment variable is coerced to a string before comparison. Recognized truthy values are `"yes"`, `"on"`, and `"disabled"` (Analysis basis: CC v2.1.143 bundle.js:+26422, +26428, +10063151).

---

### Gate 2 — `DISABLE_BUG_COMMAND` Environment Variable Check

```
function checkBugEnvVar(environment):
    value = environment.get("DISABLE_BUG_COMMAND")
    normalizedValue = toString(value).toLowerCase()
    if normalizedValue is "yes" or "on" or "disabled":
        return Err("/feedback has been disabled via the DISABLE_BUG_COMMAND environment variable")
    return Ok
```

Analysis basis: CC v2.1.143 bundle.js:+10063323

This gate mirrors Gate 1 but targets the alias-specific variable, ensuring that the `/bug` alias can also be independently suppressed.

---

### Gate 3 — Non-Essential Traffic Suppression Check

```
function checkNonEssentialTrafficFlag(trafficConfig):
    category = trafficConfig.getCategory()
    if category == "essential-traffic":
        return Err("/feedback has been disabled via the CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC environment variable")
    return Ok
```

Analysis basis: CC v2.1.143 bundle.js:+10063406, +959244, +959252, +10063441

The category string `"essential-traffic"` is resolved via the `zq` → `A$A` call edge. When the runtime is in essential-traffic-only mode, all non-essential network traffic — including feedback submission — is suppressed.

---

### Gate 4 — Organizational Policy Check

```
function checkOrgPolicy(policyStore):
    sessionSet    = getSessionPolicySet()          // reads U37.has
    hasPolicyKey  = sessionSet.has("allow_product_feedback")
    policyValue   = policyStore.get("allow_product_feedback")

    if hasPolicyKey and policyValue == 0:
        return Err("/feedback has been disabled by your organization's policy")
    return Ok
```

Analysis basis: CC v2.1.143 bundle.js:+10063546, +10026132, +10026148, +10026161, +10026167, +10026179, +10026205, +10026229, +10063605

The numeric value `0` (Analysis basis: CC v2.1.143 bundle.js:+10026229) is the falsy policy sentinel. Only when the key is present **and** its value equals `0` is the command blocked.

---

### Gate 5 — Provider Resolution and Credential Validation

```
function resolveProviderAndCredentials(apiConfig):
    providerKey = apiConfig.getProviderKey()   // internal enum

    switch providerKey:
        case "bedrock":
            humanName = "Amazon Bedrock"
        case "vertex":
            humanName = "Vertex AI"
        case "foundry":
            humanName = "Microsoft Foundry"
        case "anthropicAws":
            humanName = "Claude Platform on AWS"
        case "mantle":
            humanName = "Amazon Bedrock (Mantle)"
        case "gateway":
            humanName = "an API gateway"
        case "firstParty":
            humanName = null   // first-party path; no extra label

    credentials = resolveCredentials(providerKey)

    if providerKey != "firstParty" and noAnthropicAuth(credentials):
        return Err("Anthropic auth not used on third-party providers")

    if credentials.oauthToken is absent:
        if usingCloudGateway(apiConfig):
            return Err("Not available when using a Cloud gateway")
        return Err("No OAuth token available")

    if credentials.apiKey is absent:
        if credentialState == "no_creds":
            return Err("no Anthropic credentials")
        return Err("No API key available")

    return Ok(humanName, credentials)
```

Analysis basis: CC v2.1.143 bundle.js:+10063673, +2020504, +2020544, +2020594, +2020650, +2020704, +2020752, +2020761, +10063705, +10063720, +10063737, +10063812, +10063883, +10063967, +10064050, +10064081, +10064135, +2942862, +2942891, +2942946, +2942958, +2943006, +2943090, +2943115, +2943156, +2943206, +2943241, +2943281, +10064212, +10064229

The `anthropic-beta` header is included in the outgoing feedback request (Analysis basis: CC v2.1.143 bundle.js:+2943090). The `x-api-key` header carries the resolved API key (Analysis basis: CC v2.1.143 bundle.js:+2943281). The HTTP method is `"post"` (Analysis basis: CC v2.1.143 bundle.js:+10064269).

---

### Feedback UI Rendering with Randomized Delay

```
function renderFeedbackUI(resolvedProvider, credentials, userInput):
    // Apply jitter to avoid thundering-herd on feedback endpoint
    delay = Math.random() * BASE_MULTIPLIER   // BASE_MULTIPLIER = 2
    setTimeout(submitFeedback, delay)

    element = createElement(FeedbackComponent, {
        provider: resolvedProvider,
        input: userInput
    })
    return element
```

Analysis basis: CC v2.1.143 bundle.js:+10084548, +10084584, +10084608, +12638154, +12638156, +12638193

The random delay base multiplier is `2` (Analysis basis: CC v2.1.143 bundle.js:+12638154). The JSX element is created via `mC_.createElement` (Analysis basis: CC v2.1.143 bundle.js:+10084608).

---

### Top-Level Command Handler

```
function feedbackCommandHandler(commandInput, appContext):
    // Gate checks are evaluated in strict order; first failure aborts
    result = checkFeedbackEnvVar(appContext.environment)
    if result is Err: return result

    result = checkBugEnvVar(appContext.environment)
    if result is Err: return result

    result = checkNonEssentialTrafficFlag(appContext.trafficConfig)
    if result is Err: return result

    result = checkOrgPolicy(appContext.policyStore)
    if result is Err: return result

    (providerInfo, credentials) = resolveProviderAndCredentials(appContext.apiConfig)
    // resolveProviderAndCredentials raises on failure; no explicit Err check needed here

    return renderFeedbackUI(providerInfo, credentials, commandInput)
```

Analysis basis: CC v2.1.143 bundle.js:+10084548, +10084751

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None found in depth-2 traversal (`telemetry` array is empty) |
| Hook registration | Command registered under module `kqq`; aliased as `bug` (Analysis basis: CC v2.1.143 bundle.js:+10084882) |
| appState changes | No direct appState mutations detected in depth-2 traversal |
| Network I/O | Sends an HTTP `POST` request with `x-api-key` and `anthropic-beta` headers when all gates pass (Analysis basis: CC v2.1.143 bundle.js:+10064269, +2943090, +2943281) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Rendering | Produces a `local-jsx` React element via `mC_.createElement` (Analysis basis: CC v2.1.143 bundle.js:+10084608) |
| Timing side effect | `setTimeout` with a `Math.random()`-scaled delay before submission (Analysis basis: CC v2.1.143 bundle.js:+12638193, +12638156) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.143 | Initial analysis |

---

## Common Mistakes

1. **Setting `DISABLE_FEEDBACK_COMMAND=1` and expecting it to suppress the command.** Only the string values `"yes"`, `"on"`, and `"disabled"` are recognized as truthy; the integer `1` is not matched. Use `DISABLE_FEEDBACK_COMMAND=yes` or `DISABLE_FEEDBACK_COMMAND=disabled` instead. (Analysis basis: CC v2.1.143 bundle.js:+26422, +26428, +10063151)

2. **Expecting `/bug` and `/feedback` to behave identically under environment suppression.** The two aliases are gated by *separate* environment variables (`DISABLE_FEEDBACK_COMMAND` vs. `DISABLE_BUG_COMMAND`). Setting only one will not suppress the other. (Analysis basis: CC v2.1.143 bundle.js:+10063169, +10063323)

3. **Assuming the command works on third-party providers with custom API keys.** When the provider is `bedrock`, `vertex`, `foundry`, `anthropicAws`, `mantle`, or a `gateway`, Anthropic-issued credentials are required. If those are absent the command aborts silently with a provider-specific message rather than opening the feedback URL. (Analysis basis: CC v2.1.143 bundle.js:+2942891)

4. **Expecting immediate network submission.** The actual POST is dispatched after a random jitter delay (scaled by the constant `2`). Closing the terminal immediately after invoking `/feedback` may prevent the request from being sent. (Analysis basis: CC v2.1.143 bundle.js:+12638154, +12638193)

5. **Believing organizational policy only applies to managed enterprise accounts.** The `allow_product_feedback` policy key is evaluated from the session policy store regardless of account tier; any deployment that injects this key with value `0` will suppress the command. (Analysis basis: CC v2.1.143 bundle.js:+10026179, +10026229, +10063605)

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Nqq` | Top-level feedback command render function (JSX producer) |
| `CC_` | Multi-gate orchestrator; runs env-var, traffic, policy, and provider checks in sequence |
| `xH` | Environment variable string normalizer / coercion utility |
| `zq` | Non-essential traffic category resolver |
| `uq` | Organizational policy gate evaluator (`allow_product_feedback` check) |
| `DA` | Provider key-to-human-name resolver |
| `nR` | Credential resolver and HTTP header builder |
| `H` | Randomized delay scheduler (`Math.random` + `setTimeout`) |
| `hO7` | Command registration entry point; wires `Nqq` into the slash-command registry |