---
type: feature-spec
feature: "feedback"
cc_version: "2.1.153"
updated: "2026-06-02"
tags: ["feedback", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.153 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/feedback`

> Analysis basis: CC v2.1.153 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.153

---

## Overview

`/feedback` opens an interactive UI panel that allows the user to submit product feedback, report a bug, or share their current conversation with Anthropic. The command performs a series of eligibility checks (environment variables, telemetry policy, organizational policy, provider type, credential availability) before presenting the feedback form. It is also reachable via the aliases `/share` and `/bug`.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `feedback` |
| description | `Submit feedback, report a bug, or share your conversation` |
| aliases | `share`, `bug` |
| argumentHint | `[report]` |
| module_id | `aZ1` |
| load_inline | `true` |
| loc_byte | `10698608` |
| loc_byte_end | `10698831` |
| loc_line | `7599` |
| arbor_handler.name | `ZdL` |
| arbor_handler.fqn | `claude-2.1.153::ZdL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.153 bundle.js:+10698608

---

## Input Branching

The command traverses **more than three distinct decision branches** before rendering the feedback UI, so a flowchart is used below.

```mermaid
flowchart TD
    A(["/feedback invoked"]) --> B{DISABLE_FEEDBACK_COMMAND\nor DISABLE_BUG_COMMAND set?}
    B -- yes --> ERR1["Return disabled message\n(feedback or bug variant)"]
    B -- no --> C{Non-essential traffic\ndisabled?\nCLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC}
    C -- yes --> ERR2["Return non-essential\ntraffic disabled message"]
    C -- no --> D{Organization policy:\nallow_product_feedback?}
    D -- no --> ERR3["Return org policy\ndisabled message"]
    D -- yes --> E{Resolve API provider\n(bedrock / vertex / foundry /\nanthropicAws / mantle / gateway)}
    E --> F{Credential check:\nOAuth token or API key available?}
    F -- no creds --> ERR4["Return no_creds message:\n'no Anthropic credentials'"]
    F -- has creds --> G["Build feedback URL\n(bundle='bundle', provider label,\ntimestamp via rZ1, nonce via H)"]
    G --> H_node["Render JSX feedback UI\n(oZ1 → Ui_.createElement)"]
    H_node --> I(["User submits / shares\nconversation via POST"])
```

Analysis basis: CC v2.1.153 bundle.js:+10698141 (call entry), +10676528–10677699 (gate logic)

---

## Behavioral Spec

### 1. Top-level handler dispatch

The Arbor-resolved handler `ZdL` (an `AsyncFunction`) serves as the command entry point. It delegates immediately to the JSX render function `oZ1`.

```
async function feedbackCommandHandler(context):
    renderFeedbackComponent(context)
```

Analysis basis: CC v2.1.153 bundle.js:+10698439

---

### 2. Eligibility gate (`checkFeedbackEligibility`)

Corresponds to `mSH` in the call graph. Executed synchronously before any UI is rendered. Returns an object describing either a disabling reason or a cleared state.

```
function checkFeedbackEligibility(env, config, orgPolicy):

    # Gate 1: explicit env-var disable
    if env.DISABLE_FEEDBACK_COMMAND is truthy:
        return disabled("/feedback has been disabled via the DISABLE_FEEDBACK_COMMAND environment variable")

    if env.DISABLE_BUG_COMMAND is truthy:
        return disabled("/feedback has been disabled via the DISABLE_BUG_COMMAND environment variable")

    # Gate 2: non-essential traffic policy
    trafficPolicy = resolveTrafficPolicy(config)   # _1 → fZA → xH
    if trafficPolicy in ["no-telemetry", "essential-traffic"]:
        # "default" passes through
        return disabled("/feedback has been disabled via the CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC environment variable")

    # Gate 3: organization policy (enterprise / team plans only)
    if orgPlanIs("enterprise") or orgPlanIs("team"):
        if not orgPolicy.allow_product_feedback:
            return disabled("/feedback has been disabled by your organization's policy")

    # Gate 4: provider & credential check
    provider = resolveProvider()                   # X9 → bH9 → kD6
    credResult = resolveCredentials(provider)      # xp → se / GA / l2

    if credResult.status == "no_creds":
        return disabled("no Anthropic credentials")

    return eligible(provider, credResult)
```

Analysis basis: CC v2.1.153 bundle.js:+10676528 (`mSH` opens), +10676581 (disabled literal), +10676753 (bug variant), +10676871 (non-essential traffic), +10677035 (org policy), +10677642 (no_creds)

---

### 3. Provider resolution (`resolveProvider`)

Corresponds to `X9` (calls `bH9` → `kD6`) and the membership check `mj7.has`.

```
function resolveProvider():
    raw = detectProviderKind()    # kD6 queries TR, ID6, T4H
    if mj7.has(raw):
        return raw                # known provider: bedrock, vertex, foundry,
                                  # anthropicAws, mantle, firstParty
    # Fallback label mapping
    switch raw:
        "bedrock"      → label = "Amazon Bedrock"
        "vertex"       → label = "Vertex AI"
        "foundry"      → label = "Microsoft Foundry"
        "anthropicAws" → label = "Claude Platform on AWS"
        "mantle"       → label = "Amazon Bedrock (Mantle)"
        "gateway"      → label = "an API gateway"
        default        → label = "bundle"
    return { kind: raw, label: label }
```

Analysis basis: CC v2.1.153 bundle.js:+4096154 (`mj7.has`), +10677135 ("bundle"), +10677167–10677565 (provider label strings)

---

### 4. Credential resolution (`resolveCredentials`)

Corresponds to `xp` which fans out to `se` (OAuth path), `GA` (HTTP-header path), and `l2` (API-key path).

```
function resolveCredentials(provider):

    if provider.kind is third-party (not firstParty / api.anthropic.com):
        return { status: "third_party",
                 note: "Anthropic auth not used on third-party providers" }

    oauthToken = fetchOAuthToken()                 # se → FO → IA
    if oauthToken is null:
        # Try API key
        apiKey = fetchApiKey()                     # l2 → m$
        if apiKey is null:
            return { status: "no_creds",
                     message: "No API key available" }
        return { status: "api_key", key: apiKey,
                 header: "x-api-key" }

    if provider uses cloud gateway:
        return { status: "gateway_token",
                 note: "Not available when using a Cloud gateway" }

    return { status: "oauth", token: oauthToken,
             header: "anthropic-beta" }
```

Analysis basis: CC v2.1.153 bundle.js:+2974927 (`xp` entry), +2974956 (third-party note), +2975071 (no OAuth), +2975155 ("anthropic-beta"), +2975221 (cloud gateway), +2975306 (no API key), +2975346 ("x-api-key")

---

### 5. Nonce and timestamp generation

Two small utilities are called when building the feedback submission URL.

```
function generateNonce():
    # H — uses Math.random scaled by 2, deferred via setTimeout(_, 30000)
    base = Math.random() * 2
    schedule clearance after 30 000 ms
    return derived_nonce

function generateTimestamp():
    # rZ1 — records Date.now() at invocation time; timeout budget 30 000 ms
    return Date.now()
```

Analysis basis: CC v2.1.153 bundle.js:+13359474 (factor `2`), +13359513 (`setTimeout`), +10697978 (`Date.now`), +10697997 (`30000`)

---

### 6. JSX component render (`renderFeedbackComponent`)

Corresponds to `oZ1`, which constructs a React element tree via `Ui_.createElement`.

```
function renderFeedbackComponent(context):
    eligibility = checkFeedbackEligibility(...)
    if eligibility.disabled:
        return renderErrorText(eligibility.message)

    nonce     = generateNonce()
    timestamp = generateTimestamp()
    payload   = buildPayload(context, nonce, timestamp,
                              visibility="public",
                              method="post")

    return Ui_.createElement(FeedbackPanel, {
        payload:    payload,
        onSubmit:   submitFeedback,
        onShare:    shareConversation,
        ...
    })
```

Analysis basis: CC v2.1.153 bundle.js:+10698221 (`Ui_.createElement`), +10698414 ("public"), +10698200 (`rZ1`), +10698177 (`H`), +10677699 ("post")

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | No `tengu_*` events detected in depth-2 traversal |
| Environment variables read | `DISABLE_FEEDBACK_COMMAND`, `DISABLE_BUG_COMMAND`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_ORGANIZATION_ID` |
| Organization policy checked | `allow_product_feedback` (enterprise / team plans) |
| Network | HTTP `POST` to `api.anthropic.com` (first-party) when credentials are resolved |
| Timer side-effect | `setTimeout` scheduled for 30 000 ms inside nonce generator (`H`) |
| Submission visibility | `"public"` flag included in payload |
| appState changes | None detected at depth ≤ 2 |
| Sound | None detected |

---

## Version History

| Version | Change |
|---|---|
| v2.1.153 | Initial analysis |

---

## Common Mistakes

1. **Forgetting env-var gates**: Setting `DISABLE_FEEDBACK_COMMAND=1` silences `/feedback` but leaves `/bug` active unless `DISABLE_BUG_COMMAND` is also set (they are checked independently).
2. **Non-essential traffic policy blocks silently**: `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` disables feedback without an interactive prompt—users may expect the command to work in restricted environments.
3. **Third-party provider limitations**: When running on Amazon Bedrock, Vertex AI, Microsoft Foundry, or similar cloud gateways, Anthropic OAuth is not used; if no compatible API key is present the command exits with "no Anthropic credentials" rather than offering a degraded form.
4. **Alias confusion**: `/bug` and `/share` are aliases for `/feedback`; all three share the same eligibility gates. Disabling via `DISABLE_FEEDBACK_COMMAND` does **not** automatically disable the `/bug` alias path—both env vars must be set.
5. **Organization policy scope**: The `allow_product_feedback` policy check only activates for `enterprise` and `team` plan accounts; individual API users bypass this gate entirely.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `ZdL` | Top-level async command handler (Arbor-resolved entry point) |
| `oZ1` | JSX render function for the feedback UI component |
| `mSH` | Eligibility gate orchestrator (checks all disable conditions) |
| `xH` | String utility / coercion helper |
| `_1` | Traffic-policy resolver (reads non-essential traffic setting) |
| `fZA` | Inner helper called by traffic-policy resolver |
| `X9` | Provider resolution dispatcher |
| `bH9` | Provider detection wrapper |
| `kD6` | Core provider-kind detector (calls TR, ID6, T4H) |
| `TR` | Provider query helper (calls IA, A5, m$, RP, dq) |
| `IA` | Provider identity accessor |
| `A5` | Auxiliary provider attribute reader |
| `m$` | API-key / credential fetcher (reads ANTHROPIC_API_KEY, apiKeyHelper) |
| `RP` | OAuth token fetcher (reads CLAUDE_CODE_OAUTH_TOKEN) |
| `JKH` | Policy includes-check helper |
| `q` | Array/set of known providers (calls `q.includes`; also references `VTK.unlinkSync`) |
| `xp` | Credential resolution router (OAuth vs API key vs third-party) |
| `se` | OAuth sub-path initiator |
| `FO` | OAuth token retrieval helper |
| `GA` | HTTP-header credential path |
| `Hw` | Header construction helper |
| `yb` | Array type-check utility (`Array.isArray`, `.includes`) |
| `l2` | API-key credential sub-path |
| `H` | Nonce generator (Math.random, setTimeout) |
| `rZ1` | Timestamp generator (Date.now, 30 000 ms budget) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.