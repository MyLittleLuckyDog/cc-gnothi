---
type: feature-spec
feature: "feedback"
cc_version: "2.1.198"
updated: "2026-07-02"
tags: ["feedback", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.198 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/feedback`

> Analysis basis: CC v2.1.198 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.198

---

## Overview

The `/feedback` command (also accessible via `/share` and `/bug`) opens an interactive JSX-rendered interface that allows users to submit feedback, report a bug, or share their current conversation with Anthropic. Before presenting the UI, the handler evaluates multiple eligibility conditions — environment variable overrides, telemetry policy settings, provider type, organization policy, and credential availability — and returns a disabled-state error message if any condition blocks the submission.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `feedback` |
| description | `Submit feedback, report a bug, or share your conversation` |
| argumentHint | `[report]` |
| aliases | `share`, `bug` |
| module_id | `sBl` |
| load_inline | `true` |
| loc_byte | `11696726` |
| loc_byte_end | `11696949` |
| loc_line | `7655` |
| arbor_handler.name | `R2f` |
| arbor_handler.fqn | `claude-2.1.198::R2f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.198 bundle.js:+11696726

---

## Input Branching

The handler passes through at least six distinct guard conditions before reaching the JSX render path. A Mermaid flowchart is used because there are more than three distinct branches.

```mermaid
flowchart TD
    A(["/feedback invoked"]) --> B{DISABLE_FEEDBACK_COMMAND\nor DISABLE_BUG_COMMAND set?}
    B -- yes --> ERR1["Return: 'disabled'\n(env var message)"]
    B -- no --> C{CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC\nor telemetry mode is 'no-telemetry'?}
    C -- yes --> ERR2["Return: disabled —\nnonessential traffic blocked"]
    C -- no --> D{allow_product_feedback\npolicy flag false?}
    D -- no --> ERR3["Return: disabled —\norganization policy"]
    D -- yes --> E{Provider type check\n(bedrock / vertex / foundry /\ngateway / mantle / anthropicAws)}
    E -- third-party provider --> F{OAuth token available?}
    F -- no --> ERR4["Return: no_oauth_token"]
    F -- yes --> G{Credentials available?}
    E -- first-party --> G
    G -- no creds --> ERR5["Return: no_creds\n'no Anthropic credentials'"]
    G -- creds ok --> H["Render JSX feedback UI\n(iBl.jsx)\nwith timestamp (Date.now)"]
    H --> Z([End])
```

---

## Behavioral Spec

### Top-level handler (AsyncFunction `R2f`)

The Arbor-resolved handler `R2f` is the true async entry point. It delegates immediately to the JSX component factory `oBl`.

```
async function feedbackHandler(context):
    component = buildFeedbackComponent(context)
    return component
```

Analysis basis: CC v2.1.198 bundle.js:+11696557

---

### Guard evaluation (`B7e`)

`B7e` is the eligibility-check function invoked from within the component factory. It runs all disable checks in sequence and returns early on the first failure.

```
function evaluateEligibility(options):

    // 1. Explicit environment variable disables
    if env("DISABLE_FEEDBACK_COMMAND") is set:
        return error("disabled",
            "/feedback has been disabled via the DISABLE_FEEDBACK_COMMAND environment variable")

    if env("DISABLE_BUG_COMMAND") is set:
        return error("disabled",
            "/feedback has been disabled via the DISABLE_BUG_COMMAND environment variable")

    // 2. Non-essential traffic / telemetry mode check
    telemetryMode = resolveTelemetryMode()   // via qi → wSs → st
    if telemetryMode is "no-telemetry"
    or env("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC") is set:
        return error("disabled",
            "/feedback has been disabled via the CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC environment variable")

    // 3. Organization policy flag
    if not isProductFeedbackAllowed():       // checks "allow_product_feedback" flag via js → Tye
        return error("disabled",
            "/feedback has been disabled by your organization's policy")

    // 4. Provider + credential checks
    providerInfo = resolveProviderCredentials()  // via mr → Fm / st
    if providerInfo indicates third-party provider:
        authInfo = resolveOAuthForThirdParty()   // via OV → hX / Eo
        if no OAuth token:
            return error("no_oauth_token", "No OAuth token available")
        if using Cloud gateway:
            return error("disabled", "Not available when using a Cloud gateway")

    if no credentials available:
        return error("no_creds", "no Anthropic credentials")

    // 5. All checks passed — proceed
    return { eligible: true, providerLabel: resolveProviderLabel(), ... }
```

Analysis basis: CC v2.1.198 bundle.js:+11674171

---

### Telemetry mode resolution (`qi` → `wSs` → `st`)

```
function resolveTelemetryMode():
    rawValue = readEnvironmentSetting()     // wSs reads raw env
    normalized = normalizeToString(rawValue) // st → String coercion
    // Known mode values: "essential-traffic", "no-telemetry", "default"
    return normalized
```

- `"essential-traffic"` mode: non-essential endpoints (including feedback) are suppressed.
- `"no-telemetry"` mode: all telemetry and feedback submission are suppressed.
- `"default"` mode: feedback is permitted if other guards pass.

Analysis basis: CC v2.1.198 bundle.js:+11674171, +874067, +873903, +873962, +874036

---

### Product-feedback policy check (`js` → `q9i` / `rG` / `O$` / `Tye`)

```
function isProductFeedbackAllowed():
    // Resolves account/org capabilities
    capabilities = resolveCapabilities()    // q9i → rG
    providerClass = classifyProvider()      // O$ → d2t
    // Checks "allow_product_feedback" flag
    // Also checks whether provider is in a known set (IGd, CGd sets)
    if capabilities includes "allow_product_feedback":
        return true
    return false
```

Provider classification strings evaluated here:
`"firstParty"`, `"third_party_provider"`, `"custom_base_url"`, `"no_auth"`,
`"oauth_no_inference_scope"`, `"enterprise"`, `"team"`, `"prosumer_oauth"`.

Analysis basis: CC v2.1.198 bundle.js:+3416619, +3416607, +3415909

---

### Provider label resolution (`mr` → `Fm` / `st`)

When the feedback UI renders successfully, a human-readable provider label is embedded. The mapping used:

| Internal key | Display label |
|---|---|
| `bedrock` | `Amazon Bedrock` |
| `vertex` | `Vertex AI` |
| `foundry` | `Microsoft Foundry` |
| `anthropicAws` | `Claude Platform on AWS` |
| `mantle` | `Amazon Bedrock (Mantle)` |
| `gateway` | `an API gateway` |

Analysis basis: CC v2.1.198 bundle.js:+11674502, +11674577, +11674648, +11674732, +11674815, +11674900

---

### OAuth / credential resolution for third-party providers (`OV` → `hX`, `Eo`, `pne`)

```
function resolveOAuthForThirdParty(providerInfo):
    // hX path: check Anthropic auth header availability
    anthropicAuthAvailable = checkAnthropicAuthHeader()  // hX → wc → mr
    if providerInfo.isThirdParty:
        // Eo path: validate OAuth token
        oauthToken = getOAuthToken()  // Eo → cE → (wd, pb, wc, Qo, dI, Pw, e$t, Zit)
        accountType = classifyAccount(oauthToken)  // Eo → U3 (Array.isArray check)
        if not oauthToken:
            return { error: "no_oauth_token", message: "No OAuth token available" }
        if isCloudGateway(providerInfo):
            return { error: "disabled", message: "Not available when using a Cloud gateway" }
    // pne path: API key header assembly
    apiKeyHeader = buildApiKeyHeader()  // pne → T6 → Pw
    return { eligible: true, headers: apiKeyHeader }
```

Credential strings examined: `"ANTHROPIC_API_KEY"`, `"apiKeyHelper"`, `"x-api-key"`, `"anthropic-beta"`.

Analysis basis: CC v2.1.198 bundle.js:+3153247, +3153356, +3153368, +3153553, +3153665

---

### JSX component factory (`oBl`)

```
function buildFeedbackComponent(context):
    // String sanitization of any user-supplied argument
    sanitizedArg = sanitizeInput(context.args)   // e → t.replace

    // Timestamp for session correlation
    sessionTimestamp = Date.now()                // rBl → Date.now (timeout: 30000 ms)

    // Render JSX feedback UI
    return renderJSX(FeedbackUI, {              // iBl.jsx
        timestamp: sessionTimestamp,
        arg: sanitizedArg,
        visibility: "public"                    // bundle.js:+11696532
    })
```

- Timeout constant for the submission request: **30,000 ms** (bundle.js:+11696125).
- The `"public"` visibility literal (bundle.js:+11696532) indicates shared conversations are posted to a public endpoint.
- HTTP method for submission: `"post"` (bundle.js:+11675034).

Analysis basis: CC v2.1.198 bundle.js:+11696269, +11696305, +11696328, +11696349

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | No `tengu_*` events detected in depth-2 traversal for this command |
| HTTP request | POST submission to Anthropic feedback endpoint; timeout 30,000 ms (bundle.js:+11696125) |
| Visibility | Shared conversation marked `"public"` (bundle.js:+11696532) |
| Timestamp | `Date.now()` captured at component construction (bundle.js:+11696106) |
| Environment variables read | `DISABLE_FEEDBACK_COMMAND`, `DISABLE_BUG_COMMAND`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` |
| appState changes | None detected in depth-2 traversal |
| Sound | None detected |
| Hook registration | None detected |

---

## Version History

| Version | Change |
|---|---|
| v2.1.198 | Initial analysis |

---

## Common Mistakes

1. **Assuming `/bug` and `/share` are separate commands.** Both are aliases for `/feedback` registered in the same object (`aliases: ["share", "bug"]`). All three names invoke identical logic.
2. **Expecting feedback to work on all providers.** Third-party providers (Bedrock, Vertex, Foundry, etc.) require a valid OAuth token; the command returns `no_oauth_token` if one is absent, even if an API key is present.
3. **Assuming organization policy is user-controllable.** The `allow_product_feedback` flag is set at the account/organization capability level and cannot be overridden by end users.
4. **Not accounting for the `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` variable.** This single variable blocks `/feedback` regardless of whether the specific `DISABLE_FEEDBACK_COMMAND` variable is set, because the check runs independently.
5. **Misreading the `"public"` visibility.** Conversations shared via `/feedback` are submitted with a `"public"` flag, meaning they may be accessible beyond the submitting user's session. Users should review conversation content before submitting.
6. **Expecting immediate feedback on slow networks.** The POST timeout is fixed at 30,000 ms; no retry logic was detected within the depth-2 traversal.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `R2f` | Top-level async handler for `/feedback` (Arbor-resolved entry point) |
| `oBl` | JSX component factory; builds and returns the feedback UI element |
| `B7e` | Eligibility guard function; runs all disable/policy checks in sequence |
| `qi` | Telemetry mode resolver; reads and normalizes the telemetry setting |
| `wSs` | Raw environment setting reader (telemetry mode) |
| `st` | String coercion / normalization utility |
| `js` | Product-feedback policy and provider classification orchestrator |
| `q9i` | Capability set resolver |
| `rG` | Account/capability object builder |
| `O$` | Provider classifier (maps provider keys to classification strings) |
| `d2t` | Provider detail builder (firstParty, third_party_provider, etc.) |
| `Tye` | Flag extractor for `allow_product_feedback` from capability set |
| `r` | Process / runtime environment accessor |
| `As` | CLI error reporter; calls `process.exit` |
| `mr` | Provider type resolver (gateway, bedrock, vertex, etc.) |
| `Fm` | Provider family classifier used by `mr` |
| `OV` | OAuth / credential resolution orchestrator for the feedback path |
| `hX` | Anthropic auth header availability checker |
| `wc` | HTTP header builder used by auth checks |
| `Eo` | OAuth token validator and account-type classifier |
| `cE` | OAuth token reader (reads `ANTHROPIC_API_KEY`, `apiKeyHelper`, etc.) |
| `U3` | Array-based account type inclusion checker |
| `pne` | API key header assembler |
| `T6` | Header value builder used by `pne` |
| `e` | Input argument sanitizer (applies `t.replace`) |
| `t` | String replacement utility |
| `rBl` | Timestamp generator component; calls `Date.now()` with 30,000 ms timeout |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.