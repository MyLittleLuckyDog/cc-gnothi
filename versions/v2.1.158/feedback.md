---
type: feature-spec
feature: "feedback"
cc_version: "2.1.158"
updated: "2026-06-02"
tags: ["feedback", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: "2.1.157"
analysis_basis: "CC v2.1.157 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/feedback`

> Analysis basis: CC v2.1.157 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.157

---

## Overview

The `/feedback` command allows users to submit feedback, report bugs, or share their conversation with Anthropic. Before opening the feedback submission flow, it performs a multi-stage eligibility check that evaluates environment variable overrides, telemetry/traffic policy settings, organizational policy flags, and the active API provider. If all checks pass, it renders an interactive JSX component that posts feedback to the Anthropic back-end.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `feedback` |
| description | `Submit feedback, report a bug, or share your conversation` |
| argumentHint | `[report]` |
| aliases | `share`, `bug` |
| module_id | `Iv1` |
| load_inline | `true` |
| loc_byte | `10739881` |
| loc_byte_end | `10740104` |
| loc_line | `6629` |
| arbor_handler.name | `EnL` |
| arbor_handler.fqn | `claude-2.1.157::EnL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.157 bundle.js:+10739881 – +10740104

---

## Input Branching

The command evaluates six distinct gate conditions before proceeding to render the feedback UI. A Mermaid flowchart is used because there are more than three distinct branches.

```mermaid
flowchart TD
    A(["/feedback invoked"]) --> B{DISABLE_FEEDBACK_COMMAND\nor DISABLE_BUG_COMMAND set?}
    B -- yes --> C[Return error:\n'disabled' — env-var message]
    B -- no --> D{Traffic policy:\nno-telemetry or\nessential-traffic mode?}
    D -- yes --> E[Return error:\nCLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC message]
    D -- no --> F{Organization policy:\nallow_product_feedback == false?}
    F -- yes --> G[Return error:\n'disabled by your organization policy']
    F -- no --> H{Active provider}
    H -- bedrock --> I[Label = 'Amazon Bedrock']
    H -- vertex --> J[Label = 'Vertex AI']
    H -- foundry --> K[Label = 'Microsoft Foundry']
    H -- anthropicAws --> L[Label = 'Claude Platform on AWS']
    H -- mantle --> M[Label = 'Amazon Bedrock (Mantle)']
    H -- gateway --> N[Label = 'an API gateway']
    H -- firstParty --> O[No provider label]
    I & J & K & L & M & N --> P{Anthropic credentials\navailable?}
    O --> P
    P -- no --> Q[Return error:\n'no Anthropic credentials']
    P -- yes --> R[Resolve OAuth token\nor API key for auth header]
    R --> S[Generate session timestamp\nvia Date.now — 30 000 ms window]
    S --> T[Render JSX feedback component\nvia createElement]
    T --> U([Feedback UI shown to user])
```

Analysis basis: CC v2.1.157 bundle.js:+10717795, +10718103, +10718243, +10718302, +10718402, +10718909

---

## Behavioral Spec

### Gate 1 — Environment Variable Disable Check

The command checks for the presence of `DISABLE_FEEDBACK_COMMAND` (or its alias equivalent `DISABLE_BUG_COMMAND`). When either variable is set, the handler returns immediately with a string constant `"disabled"` and an explanatory message, preventing any further processing.

```
function checkEnvDisable(args, invocationAlias):
    if env.DISABLE_FEEDBACK_COMMAND is set:
        return disabledError(
            "/feedback has been disabled via the DISABLE_FEEDBACK_COMMAND environment variable"
        )
    if invocationAlias == "bug" and env.DISABLE_BUG_COMMAND is set:
        return disabledError(
            "/feedback has been disabled via the DISABLE_BUG_COMMAND environment variable"
        )
    return null  // gate passed
```

Analysis basis: CC v2.1.157 bundle.js:+10717848, +10717866, +10718020

---

### Gate 2 — Traffic / Telemetry Policy Check

The active traffic policy is resolved (values observed: `"essential-traffic"`, `"no-telemetry"`, `"default"`). When the policy is `"essential-traffic"` or `"no-telemetry"`, the command is blocked because submitting feedback constitutes non-essential outbound traffic.

```
function checkTrafficPolicy(trafficPolicy):
    if trafficPolicy in ["essential-traffic", "no-telemetry"]:
        return disabledError(
            "/feedback has been disabled via the CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC environment variable"
        )
    return null  // gate passed
```

Analysis basis: CC v2.1.157 bundle.js:+970052, +970111, +970185, +10718138

---

### Gate 3 — Organizational Policy Check

When the user's account tier is `"enterprise"` or `"team"`, the command queries the organization's policy map for the key `"allow_product_feedback"`. If that flag is absent or evaluates to false, the command returns a policy-disabled error.

```
function checkOrgPolicy(accountTier, orgPolicies):
    if accountTier in ["enterprise", "team"]:
        if not orgPolicies.has("allow_product_feedback"):
            return disabledError(
                "/feedback has been disabled by your organization's policy"
            )
    return null  // gate passed
```

Analysis basis: CC v2.1.157 bundle.js:+4107376, +4107411, +4107621, +4107652, +10718302

---

### Gate 4 — Provider Resolution and Labeling

The active API provider is resolved from the session configuration. Recognized provider identifiers map to human-readable labels used in the feedback payload metadata. Provider detection follows a priority chain inspecting bundle configuration and provider type strings.

```
function resolveProviderLabel(providerConfig):
    match providerConfig.type:
        case "bedrock":      return "Amazon Bedrock"
        case "vertex":       return "Vertex AI"
        case "foundry":      return "Microsoft Foundry"
        case "anthropicAws": return "Claude Platform on AWS"
        case "mantle":       return "Amazon Bedrock (Mantle)"
        case "gateway":      return "an API gateway"
        case "firstParty":   return null   // no third-party label
        default:             return null
```

Analysis basis: CC v2.1.157 bundle.js:+10718402, +10718417, +10718434, +10718509, +10718580, +10718664, +10718747, +10718778, +10718832

---

### Gate 5 — Credential Check

When a third-party provider is active, the command verifies that Anthropic-issued credentials are still present (OAuth token or API key). If neither is available, the command returns with error code `"no_creds"` and message `"no Anthropic credentials"`.

```
function checkCredentials(providerConfig, authState):
    if providerConfig.isThirdParty:
        // "Anthropic auth not used on third-party providers"
        // attempt to retrieve OAuth token; if absent:
        if not authState.oauthToken:
            return credentialError("no_creds", "no Anthropic credentials")
    else:
        if not authState.apiKey:
            return credentialError("no_creds", "no Anthropic credentials")
    return null  // gate passed
```

Analysis basis: CC v2.1.157 bundle.js:+2977433, +2977548, +10718909, +10718926

---

### Gate 6 — Auth Header Construction

Once all gates pass, the command builds the outbound HTTP auth header. For OAuth sessions it uses the `user_oauth` profile type and a `profile-implicit` flow to obtain the bearer token. For API-key sessions it attaches the key under the `x-api-key` header. The header `anthropic-beta` is included in the request envelope.

```
function buildAuthHeader(authState):
    if authState.oauthToken:
        return { "Authorization": "Bearer " + authState.oauthToken }
    else if authState.apiKey:
        return { "x-api-key": authState.apiKey }
    else:
        raise Error("ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, CLAUDE_CODE_OAUTH_TOKEN, or WIF env vars required")
```

Analysis basis: CC v2.1.157 bundle.js:+2941338, +2941411, +2944366, +2944829, +2977632, +2977823

---

### Feedback Submission — JSX Component Rendering

After all gates pass, the handler (resolved as `EnL`) delegates to the component factory (`kv1`), which:

1. Generates a session nonce using `Date.now()` within a 30 000 ms validity window.
2. Randomizes a minor UI element via `Math.random()` with a `setTimeout` delay (number literal `2` used for retry count).
3. Calls `createElement` to instantiate the React/JSX feedback panel.
4. Issues an HTTP `POST` request to the Anthropic feedback endpoint carrying provider label metadata, conversation snapshot, and auth header.
5. The feedback visibility scope is tagged `"public"` in the submission payload.

```
function renderFeedbackComponent(providerLabel, authHeader, conversationContext):
    sessionToken = Date.now()            // validity window: 30 000 ms
    nonce        = Math.random()
    payload = {
        scope:    "public",
        provider: providerLabel,
        auth:     authHeader,
        context:  conversationContext,
        token:    sessionToken
    }
    schedule POST via setTimeout (delay ≤ 30000 ms, retries ≤ 2)
    return createElement(FeedbackPanel, { payload })
```

Analysis basis: CC v2.1.157 bundle.js:+10739251, +10739270, +10739450, +10739473, +10739494, +10739687, +10739712, +13423029, +13423031, +13423068

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | No `tengu_*` telemetry events detected in depth-2 traversal |
| HTTP POST | Issues a `POST` request to Anthropic's feedback endpoint with auth header and provider metadata (bundle.js:+10718966) |
| Auth header | Reads OAuth token or API key from session auth state; may trigger `profile-implicit` OAuth refresh (bundle.js:+2941338) |
| Session timestamp | Captures `Date.now()` at render time; 30 000 ms expiry window (bundle.js:+10739270) |
| Random nonce | `Math.random()` used for UI variation; `setTimeout` scheduling with retry count of 2 (bundle.js:+13423029) |
| appState changes | No direct appState mutation detected; UI rendered via JSX component lifecycle |
| Sound | None detected |
| Environment reads | `DISABLE_FEEDBACK_COMMAND`, `DISABLE_BUG_COMMAND`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` |
| Organization policy read | `allow_product_feedback` flag from org policy map (bundle.js:+4107652) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.157 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/bug` while `DISABLE_BUG_COMMAND` is set** — the alias `bug` shares the same disable pathway as `feedback`; both env vars must be unset for either invocation to proceed.
2. **Using `/feedback` on a third-party provider without Anthropic credentials** — providers such as Amazon Bedrock, Vertex AI, and Microsoft Foundry require that Anthropic OAuth or API credentials remain present in the session; the command will return a `"no_creds"` error otherwise.
3. **Expecting feedback to work in `no-telemetry` or `essential-traffic` mode** — these traffic policies block the command entirely; users must use the `default` traffic policy.
4. **Organizational plan restriction** — enterprise and team accounts may have `allow_product_feedback` disabled by their administrator; the error message explicitly states the policy block.
5. **Assuming `/share` is a separate command** — `share` is registered as an alias for `feedback` and follows exactly the same gate sequence.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `EnL` | Top-level async handler for `/feedback` (Arbor-resolved, `AsyncFunction`); entry point from module `Iv1` |
| `kv1` | Feedback JSX component factory; renders the feedback panel UI |
| `YRH` | Multi-gate eligibility checker; orchestrates env-var, traffic-policy, org-policy, and provider checks |
| `CH` | String utility / coercion helper (called at multiple sites) |
| `L1` | Traffic policy resolver; maps env config to `essential-traffic` / `no-telemetry` / `default` |
| `fVA` | Inner helper called by traffic policy resolver |
| `N9` | Organizational policy gate; checks `allow_product_feedback` for enterprise/team tiers |
| `n89` | Organization data fetcher called by org-policy gate |
| `Dw6` | Policy record constructor / normalizer |
| `gR` | Provider-type resolver; maps provider config to canonical type string |
| `TA` | Provider configuration accessor |
| `u5` | Secondary provider attribute reader |
| `F3` | Auth configuration builder; handles API key and OAuth flows |
| `pP` | OAuth token retrieval and profile-implicit flow handler |
| `gKH` | Policy map reader; performs `has()` lookup on org policy set |
| `q` | File-system utility (includes `unlinkSync`); used in session cleanup path |
| `DU` | Auth header assembler; routes between OAuth bearer and `x-api-key` headers |
| `_d` | Third-party provider auth guard (emits "Anthropic auth not used on third-party providers") |
| `NO` | Provider type classifier called by auth guard |
| `WA` | OAuth token wrapper and validation helper |
| `EY` | HTTP request builder; assembles headers including `anthropic-beta` |
| `YR` | Array / inclusion utility (`Array.isArray`, `includes`) |
| `qW` | Cloud-gateway credential check helper |
| `H` | Session nonce generator (`Math.random` + `setTimeout`) |
| `Nv1` | Timestamp factory (`Date.now`); produces the 30 000 ms session window value |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.