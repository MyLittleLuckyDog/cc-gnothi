---
type: feature-spec
feature: "feedback"
cc_version: 2.1.190
updated: "2026-06-24"
tags: ["feedback", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.187
analysis_basis: "CC v2.1.187 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/feedback`

> Analysis basis: CC v2.1.187 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.187

---

## Overview

The `/feedback` command (also invocable as `/share` or `/bug`) opens a feedback submission flow that lets the user submit general feedback, report a bug, or share the current conversation with Anthropic. Before presenting the UI, the handler performs a multi-stage eligibility check — evaluating environment variables, telemetry policy, API provider, OAuth state, and organizational policy — and surfaces a specific disabled-state message if any gate fails.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `feedback` |
| description | `Submit feedback, report a bug, or share your conversation` |
| argumentHint | `[report]` |
| aliases | `share`, `bug` |
| module_id | `adl` |
| load_inline | `true` |
| loc_byte | `11156559` |
| loc_byte_end | `11156782` |
| loc_line | `7002` |
| arbor_handler.name | `P7p` |
| arbor_handler.fqn | `claude-2.1.187::P7p` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.187 bundle.js:+11156559

---

## Input Branching

The command has more than three distinct gate branches before the feedback UI is rendered, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/feedback invoked"]) --> B{DISABLE_FEEDBACK_COMMAND\nor DISABLE_BUG_COMMAND set?}
    B -- yes --> B1["Return: 'disabled' —\nenv-var disabled message"]
    B -- no --> C{CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC set?}
    C -- yes --> C1["Return: 'disabled' —\nnonessential-traffic disabled message"]
    C -- no --> D{Telemetry policy =\n'no-telemetry' or 'essential-traffic'?}
    D -- yes --> D1["Return: 'disabled' —\ntelemetry policy disabled message"]
    D -- no --> E{Provider type check\n(bundle / third-party / gateway)?}
    E -- "third-party provider\n(Bedrock, Vertex, Foundry,\nmantle, anthropicAws)" --> E1["Return: 'disabled' —\nthird-party provider message"]
    E -- "custom_base_url / gateway" --> E2["Return: 'disabled' —\nnot available via Cloud gateway"]
    E -- firstParty --> F{OAuth token\navailable?}
    F -- no --> F1["Return: 'disabled' —\nno_oauth_token message"]
    F -- yes --> G{allow_product_feedback\norg policy?}
    G -- false --> G1["Return: 'disabled' —\norganization policy message"]
    G -- true --> H{Anthropic credentials\npresent?}
    H -- no --> H1["Return: 'no_creds' —\nno Anthropic credentials"]
    H -- yes --> I["Render feedback JSX UI\n(ldl.jsx)\nvia async handler P7p → idl"]
```

Analysis basis: CC v2.1.187 bundle.js:+11133762, +11133780, +11133921, +11134039, +11134203, +11134810, +11156182

---

## Behavioral Spec

### 1. Top-level async handler (`P7p`)

The Arbor-resolved handler `P7p` is an `AsyncFunction` (resolution path: `module_id → adl`). It delegates immediately to the inner command implementation function (`idl`).

```
async function feedbackHandler(context):
    return await feedbackCommandImpl(context)
```

Analysis basis: CC v2.1.187 bundle.js:+11156390

---

### 2. Eligibility gate chain (`checkFeedbackEligibility`)

Called as the first action inside `feedbackCommandImpl`. Corresponds to `CWe` in the call graph.

```
function checkFeedbackEligibility(env, config, authState):

    # Gate 1: hard env-var disablement
    if env.DISABLE_FEEDBACK_COMMAND is set:
        return disabled("/feedback has been disabled via the DISABLE_FEEDBACK_COMMAND ...")
    if env.DISABLE_BUG_COMMAND is set:
        return disabled("/feedback has been disabled via the DISABLE_BUG_COMMAND ...")

    # Gate 2: non-essential traffic suppression
    if env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC is set:
        return disabled("/feedback has been disabled via the CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC ...")

    # Gate 3: telemetry policy (resolveTrafficPolicy)
    policy = resolveTrafficPolicy(config)   # Vi → jns → nt
    if policy in ["no-telemetry", "essential-traffic"]:
        return disabled(...)

    # Gate 4: API provider classification (getProviderKind)
    providerInfo = getProviderKind(authState)   # Ir
    if providerInfo.bundle == "provider":
        providerName = matchProvider(providerInfo)
        # Mapped values: "Amazon Bedrock", "Vertex AI", "Microsoft Foundry",
        #                "Claude Platform on AWS", "Amazon Bedrock (Mantle)",
        #                "an API gateway"
        if providerName in third-party set:
            return disabled("Anthropic auth not used on third-party providers")
        if providerName == "an API gateway":
            return disabled("Not available when using a Cloud gateway")

    # Gate 5: OAuth token check (buildRequestHeaders)
    headers = buildRequestHeaders(authState)   # HW → Ao / Gs / Ir / qC
    if no OAuth token in authState:
        return disabled("No OAuth token available")   # no_oauth_token

    # Gate 6: API key fallback
    if no api key in headers:
        return disabled("No API key available")   # no_api_key

    # Gate 7: credential presence
    if credentials absent:
        return {kind: "no_creds", message: "no Anthropic credentials"}

    # Gate 8: organizational policy
    orgPolicy = resolveOrgPolicy(config)   # Js → nSi / Qz / K9 / lxt / Lme
    if NOT orgPolicy.allow_product_feedback:
        return disabled("/feedback has been disabled by your organization's policy")

    return {eligible: true}
```

Analysis basis: CC v2.1.187 bundle.js:+11134004, +11134144, +11134271, +11134772, +11134810, +11134203

---

### 3. Telemetry policy resolution (`resolveTrafficPolicy`)

Corresponds to call chain `Vi → jns → nt`. Evaluates two named policy levels.

```
function resolveTrafficPolicy(config):
    raw = readConfigValue(config, "trafficPolicy")   # nt → String coercion
    if raw == "no-telemetry":
        return "no-telemetry"
    if raw == "essential-traffic":
        return "essential-traffic"
    return "default"
```

Recognized literal values: `"essential-traffic"` (bundle.js:+1054264), `"no-telemetry"` (bundle.js:+1054323), `"default"` (bundle.js:+1054397).

---

### 4. Organizational policy check (`resolveOrgPolicy`)

Corresponds to call chain `Js → nSi → Qz → K9 → lxt`. Inspects provider kind against known sets (`Oad`, `Nad`) and checks `allow_product_feedback` flag.

```
function resolveOrgPolicy(config):
    providerKind = classifyProviderKind(config)   # K9 → lxt
    # lxt checks: "firstParty", "third_party_provider", "custom_base_url",
    #             "no_auth", "oauth_no_inference_scope",
    #             "enterprise", "team", "prosumer_oauth"
    seenProviders = getKnownProviderSets()   # Oad.has, Nad.has
    if not seenProviders.has(providerKind):
        return {allow_product_feedback: false}
    policyValue = lookupPolicyFlag(config, "allow_product_feedback")
    return {allow_product_feedback: policyValue}
```

Literal `"allow_product_feedback"` found at bundle.js:+3352407.

Analysis basis: CC v2.1.187 bundle.js:+3352335, +3352407, +3351697

---

### 5. Provider kind classification (`getProviderKind`)

Corresponds to `Ir`. Matches the internal provider string against known third-party identifiers.

```
function getProviderKind(authState):
    provider = authState.provider
    # Known provider identifiers:
    #   "bedrock"       → display "Amazon Bedrock"
    #   "vertex"        → display "Vertex AI"
    #   "foundry"       → display "Microsoft Foundry"
    #   "anthropicAws"  → display "Claude Platform on AWS"
    #   "mantle"        → display "Amazon Bedrock (Mantle)"
    #   "gateway"       → display "an API gateway"
    return {bundle: "provider", providerKey: provider}
```

Analysis basis: CC v2.1.187 bundle.js:+2131018, +2131068, +2131124, +2131178, +2131226, +11134335, +11134410, +11134481, +11134565, +11134648, +11134733

---

### 6. Request header / credential builder (`buildRequestHeaders`)

Corresponds to call chain `HW → Ao → ay / Gs / Ir / qC`. Builds authentication headers and validates that the required tokens are present before the feedback submission can proceed.

```
function buildRequestHeaders(authState):
    if authState.providerKind == "third_party":
        # No Anthropic auth used
        return {skip: true, reason: "third_party"}
    oauthToken = getOAuthToken(authState)   # Ao → ay → ...
    if not oauthToken:
        raise NoOAuthToken("No OAuth token available")   # no_oauth_token
    if betaHeader needed:
        headers["anthropic-beta"] = ...
    apiKey = getApiKey(authState)   # qC → Yg → ...
    if not apiKey:
        raise NoApiKey("No API key available")   # no_api_key
    headers["x-api-key"] = apiKey
    return headers
```

Analysis basis: CC v2.1.187 bundle.js:+3093483, +3093574, +3093652, +3093690, +3093764, +3093830, +3093936, +3094000

---

### 7. Feedback command implementation and JSX render (`feedbackCommandImpl` / `idl`)

After all gates pass, the implementation function constructs a random session seed, records a submission timestamp, and renders the feedback React component.

```
async function feedbackCommandImpl(context):
    eligibility = checkFeedbackEligibility(env, config, authState)
    if not eligibility.eligible:
        return renderDisabledMessage(eligibility.message)

    # Generate a random submission identifier (2 random values via Math.random)
    submissionSeed = generateSubmissionId()   # e → Math.random (×2, literal: 2 at +14093348)

    # Record submission start timestamp
    startTimestamp = getSubmissionTimestamp()   # sdl → Date.now, timeout 30000ms (+11155958)

    # Render JSX feedback UI
    return renderJsx(FeedbackComponent, {       # ldl.jsx (+11156182)
        seed: submissionSeed,
        timestamp: startTimestamp,
        visibility: "public"                   # literal "public" at +11156365
    })
```

Analysis basis: CC v2.1.187 bundle.js:+11156102, +11156138, +11156161, +11156182, +11156365, +14093348, +14093387, +11155939, +11155958

---

### 8. Timestamp / timeout helper (`sdl`)

```
function getSubmissionTimestamp():
    start = Date.now()
    # Internal timeout constant: 30000 ms (30 seconds)
    scheduleTimeout(callback, 30000)
    return start
```

Timeout literal: `30000` at bundle.js:+11155958.

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal (telemetry array is empty) |
| Hook registration | None observed in this traversal depth |
| appState changes | None directly; eligibility gates read from `config` / `authState` but do not mutate them |
| Environment variable reads | `DISABLE_FEEDBACK_COMMAND` (bundle.js:+11133762), `DISABLE_BUG_COMMAND` (bundle.js:+11133921), `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` (bundle.js:+11134039) |
| Auth credential reads | `ANTHROPIC_API_KEY` (bundle.js:+3054580), `apiKeyHelper` (bundle.js:+3054605), OAuth token, WIF env vars |
| Async / timing | `Math.random` called twice for submission seed; `Date.now` recorded at submission start; 30-second internal timeout via `setTimeout` |
| JSX render | Renders `ldl.jsx` (FeedbackComponent) when all gates pass; visibility is `"public"` (bundle.js:+11156365) |
| Network | HTTP `post` request implied (literal `"post"` at bundle.js:+11134867) for feedback submission |
| Process exit | `process.exit` reachable via error path `r → Is` (bundle.js:+13085970); triggered only on unrecoverable CLI error |

---

## Version History

| Version | Change |
|---|---|
| v2.1.187 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/feedback` under a third-party provider** (Bedrock, Vertex AI, Microsoft Foundry, etc.) — the command is disabled for all non-firstParty providers. Users on these platforms will always see the third-party disabled message.
2. **Setting `DISABLE_FEEDBACK_COMMAND` or `DISABLE_BUG_COMMAND`** — these environment variables are checked first and unconditionally disable the command regardless of all other configuration.
3. **Using a `no-telemetry` or `essential-traffic` policy** — even if the provider is firstParty and credentials are valid, this policy suppresses the feedback command.
4. **Missing OAuth token in firstParty context** — if the OAuth token is absent, the command is blocked at Gate 5 with `no_oauth_token` before organizational policy is even evaluated.
5. **Expecting feedback to work behind a custom API gateway** — any `custom_base_url` / gateway configuration triggers the "Not available when using a Cloud gateway" gate and disables the command.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `P7p` | Top-level async handler for `/feedback` (Arbor-resolved entry point) |
| `idl` | Feedback command implementation function; orchestrates gates and JSX render |
| `CWe` | Eligibility gate chain function (checks env vars, telemetry, provider, OAuth, org policy) |
| `Vi` | Telemetry / traffic policy reader (dispatches to `jns`) |
| `jns` | Traffic policy resolution logic (evaluates `no-telemetry` / `essential-traffic`) |
| `nt` | String coercion / config value reader utility |
| `Js` | Organizational policy check function |
| `nSi` | Org policy sub-resolver; calls `Qz` |
| `Qz` | Provider-set lookup and policy flag evaluator |
| `K9` | Provider kind classifier (calls `lxt`) |
| `lxt` | Low-level provider-kind detector; returns `firstParty`, `third_party_provider`, etc. |
| `Lme` | Additional config/policy lookup helper (calls `nt`) |
| `r` | Unrecoverable error / process-exit path module |
| `Is` | CLI error handler (calls `process.exit`) |
| `Ir` | Provider kind matcher against known provider strings (bedrock, vertex, foundry, etc.) |
| `HW` | Request header / credential builder orchestrator |
| `Fz` | Header-build sub-step (calls `Nl`) |
| `Nl` | Inner auth-header builder (calls `Ir`) |
| `Ao` | OAuth token retrieval orchestrator |
| `ay` | OAuth token fetch / exchange function |
| `H2` | Array-inclusion check utility (used in token validation) |
| `qC` | API key retrieval orchestrator (calls `Yg`) |
| `Yg` | API key resolution function; raises errors for missing key / missing env vars |
| `e` | Submission ID generator (uses `Math.random` × 2 and `setTimeout`) |
| `sdl` | Submission timestamp recorder (uses `Date.now`, sets 30 s timeout) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.