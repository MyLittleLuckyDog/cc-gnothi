---
type: feature-spec
feature: "feedback"
cc_version: "2.1.170"
updated: "2026-06-11"
tags: ["feedback", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.170 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/feedback`

> Analysis basis: CC v2.1.170 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.170

---

## Overview

The `/feedback` command (also accessible as `/share` and `/bug`) allows users to submit feedback, report bugs, or share their current conversation with Anthropic. Before presenting the feedback UI, the command performs a multi-layer disable check — evaluating environment variables, telemetry policy, account tier, and organization-level policy — and aborts with an explanatory message if any check fails.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `feedback` |
| description | `Submit feedback, report a bug, or share your conversation` |
| argumentHint | `[report]` |
| aliases | `share`, `bug` |
| module_id | `oQq` |
| load_inline | `true` |
| loc_byte | `11144322` |
| loc_byte_end | `11144545` |
| loc_line | `7338` |
| arbor_handler.name | `GGf` |
| arbor_handler.fqn | `claude-2.1.170::GGf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.170 bundle.js:+11144322

---

## Input Branching

The command passes through six distinct disable-gate branches before reaching the feedback UI render path.

```mermaid
flowchart TD
    A["/feedback invoked"] --> B{DISABLE_FEEDBACK_COMMAND\nor DISABLE_BUG_COMMAND set?}
    B -- yes --> ERR1["Abort: disabled via env var\n(feedback or bug message)"]
    B -- no --> C{CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC\nenvironment variable set?}
    C -- yes --> ERR2["Abort: disabled via\nnonessential-traffic env var"]
    C -- no --> D{Telemetry mode:\nno-telemetry?}
    D -- yes --> ERR3["Abort: disabled\n(no-telemetry mode)"]
    D -- no --> E{Telemetry mode:\nessential-traffic only?}
    E -- yes --> ERR4["Abort: disabled\n(essential-traffic mode)"]
    E -- no --> F{Account tier:\nenterprise or team?}
    F -- yes --> G{org policy:\nallow_product_feedback?}
    G -- no --> ERR5["Abort: disabled by\norganization policy"]
    G -- yes --> H[Proceed to provider/credential check]
    F -- no --> H
    H --> I{Provider type:\nbedrock / vertex /\nfoundry / anthropicAws /\nmantle / gateway?}
    I -- third-party provider --> J[Render UI with provider label\n& note no Anthropic auth]
    I -- no credentials --> ERR6["Abort: no Anthropic credentials"]
    I -- first-party / API key --> K[Build feedback payload\n(bundle, provider, timestamp, UUID)]
    K --> L[Render JSX feedback UI\nvia AKA.createElement]
    L --> M[POST submission on confirm]
```

Analysis basis: CC v2.1.170 bundle.js:+11122197, +11122356, +11122474, +11122638, +11122197

---

## Behavioral Spec

### Top-Level Handler (`GGf`)

`GGf` is the async entry-point resolved by Arbor via the `module_id` path. It delegates immediately to the JSX render function `rQq`.

```
async function feedbackCommandHandler(input):
    return renderFeedbackComponent(input)
```

Analysis basis: CC v2.1.170 bundle.js:+11144153

---

### Disable-Gate Checks (`tuH`)

`tuH` is the pre-render gate function. It executes the following checks in strict order, aborting with a descriptive string on the first failure.

```
function disableGateCheck(commandName, appState):

    // Gate 1 — per-command env var
    if commandName == "feedback" AND env DISABLE_FEEDBACK_COMMAND is set:
        return DISABLED_MSG_FEEDBACK_ENV          // +11122215
    if commandName == "bug" AND env DISABLE_BUG_COMMAND is set:
        return DISABLED_MSG_BUG_ENV               // +11122356

    // Gate 2 — nonessential traffic env var
    if env CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC is set:
        return DISABLED_MSG_NONESSENTIAL           // +11122474

    // Gate 3 & 4 — telemetry mode
    telemetryMode = resolveTelemetryMode(appState) // hq -> ImA -> _6
    if telemetryMode == "no-telemetry":            // +1018337
        return DISABLED_MSG_NO_TELEMETRY
    if telemetryMode == "essential-traffic":       // +1018278
        return DISABLED_MSG_ESSENTIAL_TRAFFIC

    // Gate 5 — org policy for enterprise/team tiers
    tier = resolveAccountTier(appState)            // u9 -> ZwL.has / VwL.has
    if tier in ["enterprise", "team"]:             // +2511453, +2511488
        if NOT orgPolicyAllows("allow_product_feedback", appState): // +2511754
            return DISABLED_MSG_ORG_POLICY         // +11122638

    return null  // all gates passed
```

Analysis basis: CC v2.1.170 bundle.js:+11122197 through +11122638

---

### Telemetry Mode Resolution (`hq` → `ImA` → `_6`)

Determines the effective telemetry level from application state. Returns one of: `"no-telemetry"`, `"essential-traffic"`, `"default"`.

```
function resolveTelemetryMode(appState):
    raw = readConfigValue(appState)           // ImA -> _6 -> String coercion
    if raw == "no-telemetry":   return "no-telemetry"
    if raw == "essential-traffic": return "essential-traffic"
    return "default"                          // +1018411
```

Analysis basis: CC v2.1.170 bundle.js:+11122439, +1018278, +1018337, +1018411

---

### Account Tier & Org Policy Resolution (`u9`, `FC`, `Aj`)

Resolves the authenticated account tier and queries the organization policy set.

```
function resolveAccountAndPolicy(appState):
    // Check enterprise/team membership via set lookups
    isEnterprise = ZwL.has(appState)          // +2511698
    isTeam       = VwL.has(appState)          // +2511730

    if isEnterprise OR isTeam:
        // Fetch org policy flags
        policyFlags = fetchOrgPolicies(appState)  // FC -> qO -> ...
        return { tier: isEnterprise ? "enterprise" : "team",
                 allowFeedback: policyFlags.allow_product_feedback }

    return { tier: "other", allowFeedback: true }
```

```
function fetchOrgPolicies(appState):
    // FC -> Aj (profile resolution) -> qO (credential / API key resolution)
    profile = resolveProfile(appState)        // Aj -> $88, a7, biH, IB, mv
    creds   = resolveCredentials(profile)     // qO -> a7, mv, WP6, $P, hBH
    return creds.orgPolicies
```

Analysis basis: CC v2.1.170 bundle.js:+2511698, +2511730, +2511754, +2511713

---

### Provider Detection & Credential Check (`tuH` → `r_`, `BB`)

After all disable gates pass, the handler identifies the deployment provider and checks for valid credentials.

```
function detectProviderAndCredentials(appState):
    providerKind = resolveProviderKind(appState)  // r_ -> _6

    providerLabel = match providerKind:
        "bedrock"      -> "Amazon Bedrock"         // +11122770
        "vertex"       -> "Vertex AI"              // +11122845
        "foundry"      -> "Microsoft Foundry"      // +11122916
        "anthropicAws" -> "Claude Platform on AWS" // +11123000
        "mantle"       -> "Amazon Bedrock (Mantle)"// +11123083
        "gateway"      -> "an API gateway"         // +11123168
        "firstParty"   -> null  (direct Anthropic)

    if providerKind is third-party:
        // BB -> jl (sL, r_): note that Anthropic auth is not used
        note = "Anthropic auth not used on third-party providers"  // +3279484
        return { provider: providerLabel, note: note, hasCreds: true }

    // BB -> NA -> RC: check OAuth token availability
    oauthToken = resolveOAuthToken(appState)   // NA -> IY -> ...
    if oauthToken is absent:
        // BB -> j9: check API key
        apiKey = resolveApiKey(appState)       // BB -> O0 -> qO
        if apiKey is absent:
            return { provider: null, hasCreds: false,
                     reason: "no Anthropic credentials" }  // +11123262
        return { provider: "firstParty", hasCreds: true, authType: "api_key" }

    return { provider: "firstParty", hasCreds: true, authType: "oauth" }
```

Analysis basis: CC v2.1.170 bundle.js:+11122706, +11122738, +11122753, +11123207, +11123245

---

### Feedback Payload Construction & UI Render (`rQq`, `iQq`)

When all checks pass, the component builds the submission payload and renders the interactive JSX UI.

```
function renderFeedbackComponent(props):
    // iQq: capture current timestamp for session binding
    sessionTimestamp = Date.now()               // +11143692

    // H: generate UUID with jitter for deduplication
    uuid = generateUUID()                       // Math.random +13939352
    scheduleTimeout(uuid, 30000)                // setTimeout 30s timeout +11143711

    // Build payload context
    payload = {
        bundle:    "bundle",                    // +11122738
        provider:  resolvedProviderLabel,       // +11122753
        timestamp: sessionTimestamp,
        uuid:      uuid,
        visibility: "public"                    // +11144128
    }

    // Render JSX tree
    return AKA.createElement(FeedbackUI, {      // +11143935
        payload:   payload,
        onSubmit:  (data) => postFeedback(data) // POST method +11123302
    })
```

Analysis basis: CC v2.1.170 bundle.js:+11143692, +11143711, +11143855, +11143914, +11143935, +11144128, +11144153

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | No `tengu_*` events detected in depth-2 traversal |
| Environment variables read | `DISABLE_FEEDBACK_COMMAND`, `DISABLE_BUG_COMMAND`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` |
| Org policy flag checked | `allow_product_feedback` (bundle.js:+2511754) |
| Network I/O | HTTP POST submitted on user confirmation (bundle.js:+11123302); target host `api.anthropic.com` referenced in credential chain (bundle.js:+2107005) |
| Timeout | 30 000 ms timeout registered for UUID / dedup tracking (bundle.js:+11143711) |
| UUID generation | `Math.random`-based UUID generated per invocation (bundle.js:+13939352) |
| Visibility tag | Payload tagged `"public"` (bundle.js:+11144128) |
| appState changes | No direct appState mutations observed in depth-2 traversal |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| JSX renderer | `AKA.createElement` (bundle.js:+11143935) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.170 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/feedback` in a no-telemetry environment** — If `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is set or telemetry mode is `no-telemetry` or `essential-traffic`, the command is unconditionally disabled and returns an error message rather than the feedback UI.
2. **Assuming `/bug` and `/share` have independent disable toggles** — Both aliases share the same disable-gate logic; only the specific env var message differs between `DISABLE_FEEDBACK_COMMAND` and `DISABLE_BUG_COMMAND`.
3. **Expecting feedback to work on enterprise/team accounts without checking org policy** — Accounts on enterprise or team tiers require the `allow_product_feedback` org policy flag to be set; absence silently blocks the command.
4. **Using `/feedback` behind third-party providers expecting full Anthropic auth** — On Bedrock, Vertex AI, Microsoft Foundry, Mantle, Claude Platform on AWS, or a generic API gateway, the command notes that Anthropic authentication is not used and adjusts the submission path accordingly.
5. **Assuming no credentials means a warning** — If no OAuth token and no API key are found, the command hard-aborts with a `"no Anthropic credentials"` message rather than degrading gracefully.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `GGf` | Top-level async handler (Arbor-resolved entry point via module_id) |
| `rQq` | JSX feedback component render function |
| `tuH` | Disable-gate check function |
| `iQq` | Timestamp / UUID initialization helper |
| `hq` | Telemetry mode reader (top-level) |
| `ImA` | Telemetry config value extractor |
| `_6` | String coercion / primitive normalizer |
| `u9` | Account tier and org policy resolver |
| `gb1` | Org policy fetch orchestrator |
| `FNH` | Policy flag unpacker |
| `FC` | Credential + profile fetch coordinator |
| `r_` | Provider kind resolver |
| `FL` | First-party flag resolver |
| `qO` | Credential resolution (API key / auth token) |
| `Aj` | Profile resolver |
| `ULH` | Telemetry mode string normalizer |
| `q` | Data/config store accessor |
| `Y1` | Config process exit handler |
| `BB` | Auth token / API key fetch dispatcher |
| `jl` | Third-party provider auth note builder |
| `sL` | Provider string mapper |
| `NA` | OAuth token resolver |
| `IY` | OAuth token detail extractor |
| `RC` | Array inclusion checker for provider list |
| `O0` | API key fetch wrapper |
| `H` | UUID generator with setTimeout dedup |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.