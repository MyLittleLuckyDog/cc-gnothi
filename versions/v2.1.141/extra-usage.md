---
type: feature-spec
feature: "extra-usage"
cc_version: "2.1.141"
updated: "2026-05-31"
tags: ["extra-usage", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.141 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/extra-usage`

> Analysis basis: CC v2.1.141 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.141

---

## Overview

`/extra-usage` allows users to configure extra usage capacity so that work can continue even when standard usage limits are hit. Depending on the caller's account type, organization role, and current subscription state, the command either displays a confirmation that unlimited usage is already active, submits an admin request for a limit increase, or opens a browser to a usage management page. The command is exclusively available to accounts authenticated via OAuth (`pro` or `max` plan) and is not accessible to API-key–only or third-party-provider sessions.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `extra-usage` |
| description | Configure extra usage to keep working when limits are hit |
| loc_byte | `8137748` |
| loc_byte_end | `8137953` |
| loc_line | `3046` |
| module_id | `XC1` |
| load_inline | `true` |
| arbor_handler.name | `iJ6` |
| arbor_handler.fqn | `claude-2.1.141::iJ6` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.141 bundle.js:+8137748

---

## Input Branching

The command follows more than three distinct execution paths based on plan type, organization role, current subscription status, and whether an admin request already exists. A Mermaid flowchart is used below.

```mermaid
flowchart TD
    A[/extra-usage invoked] --> B{Account plan is 'pro' or 'max'?}
    B -- No --> C[Trigger new login flow\n'Starting new login following /extra-usage...']
    B -- Yes --> D{Organization type: 'team' or 'enterprise'?}
    D -- No: personal --> P[Check personal subscription status]
    P --> P1{Subscription already unlimited?}
    P1 -- Yes --> P2[Display: 'Your organization already has unlimited extra usage. No request needed.']
    P1 -- No --> P3[Open browser: https://claude.ai/settings/usage]
    D -- Yes: team/enterprise --> E{Caller role is 'admin', 'billing', 'owner', or 'primary_owner'?}
    E -- No: non-admin member --> F[Display: 'Please contact your admin to manage extra usage settings.']
    E -- Yes: admin-eligible --> G[Fetch eligibility via GET /api/oauth/usage]
    G --> H{Eligibility result}
    H -- Already unlimited --> I[Display: 'Your organization already has unlimited extra usage. No request needed.']
    H -- limit_increase type --> J[Fetch existing admin requests\nGET /api/oauth/organizations/:orgUUID/admin_requests\nwith statuses=pending,dismissed]
    J --> K{Existing request found with status 'pending' or 'dismissed'?}
    K -- Yes --> L[Display: 'You have already submitted a request for extra usage to your admin.']
    K -- No --> M[Submit new request\nPOST /api/oauth/organizations/:orgUUID/admin_requests]
    M --> N{Request type: increase or enable?}
    N -- increase --> O[Display: 'Request sent to your admin to increase extra usage.']
    N -- enable --> Q[Display: 'Request sent to your admin to enable extra usage.']
    H -- Admin self-manage --> R[Open browser: https://claude.ai/admin-settings/usage]
    G --> S{HTTP error during fetch?}
    S -- 401 → token refresh → retry --> T[Retry with refreshed token\n'401→refresh→retry succeeded']
    S -- 500 or other --> U[Parse error detail field and surface message]
    C --> V{Login succeeds?}
    V -- Yes --> W[Display: 'Login successful'\nTrigger _.onChangeAPIKey]
    V -- No/Interrupted --> X[Display: 'Login interrupted']
```

Analysis basis: CC v2.1.141 bundle.js:+8136708 (handler entry), +8136870 (orchestrator), +8091611 (team/enterprise branch), +8091963 (limit_increase path), +8092199 (pending/dismissed check), +8092785 (admin browser open), +8092826 (personal browser open)

---

## Behavioral Spec

### Plan-gate check

The handler (`iJ6`) begins by inspecting the current session's plan tier. Only `"pro"` and `"max"` plan tokens proceed to the main logic.

```
async function extraUsageHandler(context):
    planTier = getCurrentPlanTier(context)          // literals: "pro", "max"
    if planTier not in ["pro", "max"]:
        displayMessage("Starting new login following /extra-usage. Exit with Ctrl-C to use existing account.")
        loginResult = await initiateLoginFlow()
        if loginResult.success:
            displayMessage("Login successful")
            triggerOnChangeAPIKey()
        else:
            displayMessage("Login interrupted")
        return
    await orchestrateExtraUsage(context)
```

Analysis basis: CC v2.1.141 bundle.js:+8136708, +8136719, +8136730, +8136975, +8137075, +8137098, +8137117

---

### Authentication provider eligibility

Before any usage API calls, the handler verifies that the current auth provider supports the feature. Providers `"bedrock"`, `"foundry"`, `"anthropicAws"`, `"mantle"`, and `"vertex"` are classified as non-first-party; only `"firstParty"` sessions are eligible.

```
function checkProviderEligibility(authState):
    provider = authState.provider
    nonFirstPartyProviders = ["bedrock", "foundry", "anthropicAws", "mantle", "vertex"]
    if provider in nonFirstPartyProviders:
        return ineligible
    return eligible                                  // "firstParty"
```

Analysis basis: CC v2.1.141 bundle.js:+2006501, +2006551, +2006607, +2006661, +2006709, +2006718

---

### Organization role check

For `team` or `enterprise` organizations, the caller's role is evaluated. Only roles `"admin"`, `"billing"`, `"owner"`, and `"primary_owner"` may submit requests or open the admin settings page.

```
function isAdminEligibleRole(role):
    adminRoles = ["admin", "billing", "owner", "primary_owner"]
    return role in adminRoles
```

Analysis basis: CC v2.1.141 bundle.js:+2009391, +2009399, +2009409, +2009417, +8091622, +8091634

---

### Eligibility API call (`fetchUsageEligibility`)

A GET request is issued to `/api/oauth/usage` with a 5000 ms timeout. The `Content-Type: application/json` header is sent. When authentication fails with HTTP 401, the OAuth token is refreshed and the request is retried once; success is logged with the suffix `" (401→refresh→retry succeeded)"`. HTTP 500 and other server errors cause the `detail` field of the response body to be extracted and surfaced to the user. The endpoint tag `"api_usage_fetch"` identifies this operation internally.

```
async function fetchUsageEligibility(authToken):
    response = await httpGet("/api/oauth/usage",
        headers={"Content-Type": "application/json"},
        timeout=5000,
        auth=authToken
    )
    if response.status == 401:
        newToken = await refreshOAuthToken()
        response = await httpGet("/api/oauth/usage", auth=newToken)
        logInfo("401→refresh→retry succeeded")
    if response.status >= 500:
        errorDetail = response.body["detail"]
        throw UsageApiError(errorDetail)
    return response.body
```

Analysis basis: CC v2.1.141 bundle.js:+8090845, +8090873, +8090887, +8090902, +8091072, +8091197, +8091280, +8091486, +8090635

---

### Already-unlimited guard

When the eligibility response indicates the organization already has unlimited extra usage, the command short-circuits with a message and takes no further action.

```
function handleAlreadyUnlimited(eligibilityData):
    if eligibilityData.message == "Your organization already has unlimited extra usage. No request needed.":
        displayMessage(eligibilityData.message)
        return
```

Analysis basis: CC v2.1.141 bundle.js:+8091854, +8091870

---

### Admin request list check (`listAdminRequests`)

For `limit_increase` eligibility type, the handler fetches existing admin requests for the organization, filtering to `"pending"` and `"dismissed"` statuses. If any such request exists, the user is informed that a request was already submitted and no duplicate is created.

```
async function listAdminRequests(orgUUID, authToken):
    // Operation tag: "api_admin_request_list"
    response = await httpGet(
        "/api/oauth/organizations/:orgUUID/admin_requests",
        params={statuses: ["pending", "dismissed"]},
        auth=authToken
    )
    if error: throw AdminRequestListError(response)
    return response.requests

function checkDuplicateRequest(requests):
    for req in requests:
        if req.status in ["pending", "dismissed"]:
            displayMessage("You have already submitted a request for extra usage to your admin.")
            return true
    return false
```

Analysis basis: CC v2.1.141 bundle.js:+8089951, +8090054, +8092199, +8092209, +8092268

---

### Admin request creation (`createAdminRequest`)

If no duplicate request exists, a POST is submitted to `/api/oauth/organizations/:orgUUID/admin_requests` with request type `"limit_increase"`. The success message differs based on whether the request is for increasing an existing allowance or enabling extra usage from scratch.

```
async function createAdminRequest(orgUUID, requestType, authToken):
    // Operation tag: "api_admin_request_create"
    response = await httpPost(
        "/api/oauth/organizations/:orgUUID/admin_requests",
        body={type: requestType},
        auth=authToken
    )
    if error: throw AdminRequestCreateError(response)
    if requestType == "increase":
        displayMessage("Request sent to your admin to increase extra usage.")
    else:
        displayMessage("Request sent to your admin to enable extra usage.")
```

Analysis basis: CC v2.1.141 bundle.js:+8089686, +8089743, +8091963, +8092517, +8092571

---

### Non-admin member path

Members of team/enterprise organizations who do not hold an admin-eligible role see a static message directing them to their administrator.

```
function handleNonAdminMember():
    displayMessage("Please contact your admin to manage extra usage settings.")
```

Analysis basis: CC v2.1.141 bundle.js:+8092027

---

### Browser-open for self-managed usage pages

When the user is a self-managing admin or on a personal plan without unlimited access, the command opens a browser to the appropriate URL via a platform-aware open command.

```
function openUsagePage(isAdmin):
    if isAdmin:
        url = "https://claude.ai/admin-settings/usage"
    else:
        url = "https://claude.ai/settings/usage"
    openBrowser(url)                    // platform dispatch: darwin→"open", win32→"rundll32 url,OpenURL", other→"xdg-open"
    emitEvent("browser-opened")
```

Analysis basis: CC v2.1.141 bundle.js:+8092785, +8092826, +8092893, +7462510, +7462526, +7462684, +7462691, +7462610

---

### Eligibility API request (`fetchAdminRequestEligibility`)

The eligibility for admin-managed increases is fetched under the operation tag `"api_admin_request_eligibility"`. A special `"teleport-org"` marker is recognized in the response to indicate organization teleport status, which may alter subsequent routing.

```
async function fetchAdminRequestEligibility(orgUUID, authToken):
    // Operation tag: "api_admin_request_eligibility"
    response = await httpGet(
        "/api/oauth/usage",
        params={org: orgUUID},
        auth=authToken
    )
    if response.teleportOrg == "teleport-org":
        handleTeleportOrg(response)
    return response.eligibility
```

Analysis basis: CC v2.1.141 bundle.js:+8090302, +8090450

---

### OAuth token credential resolution

The command resolves credentials via environment variable `ANTHROPIC_API_KEY` or the OAuth token. An `ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN env var is required` error is raised when neither is available. File descriptor–based credential reading is supported via `CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR` (for API keys) and `CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR` (for OAuth tokens). The credential history is capped at the last 20 entries.

Analysis basis: CC v2.1.141 bundle.js:+2895985, +2896406, +2024089, +2024233, +2025575

---

### Subscription type recognition

The command recognizes the following subscription type strings when evaluating the account's current plan state:

- `"stripe_subscription"` (bundle.js:+2911878)
- `"stripe_subscription_contracted"` (bundle.js:+2911905)
- `"apple_subscription"` (bundle.js:+2911943)
- `"google_play_subscription"` (bundle.js:+2911969)

Analysis basis: CC v2.1.141 bundle.js:+2911831

---

### Feature flag evaluation

Feature flags are evaluated via the Growthbook experiment infrastructure. Events tagged `"GrowthbookExperimentEvent"` are emitted to the internal event bus (`wl.emit`) when an experiment variant is assigned. The production environment guard (`"production"`) ensures experiments only run in non-development builds. The experiment event name used is `"growthbook_experiment"`.

Analysis basis: CC v2.1.141 bundle.js:+3114109, +3113963, +3114536, +3114490

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_ember_latch` (bundle.js:+8136755); `tengu_feature_ok` (bundle.js:+945566); `tengu_feature_bad` (bundle.js:+945624) |
| Hook registration | `_.onChangeAPIKey` is triggered after a successful login flow initiated by this command (bundle.js:+8137075) |
| appState changes | OAuth token state may be refreshed; credential store updated on successful login |
| Network I/O | GET `/api/oauth/usage` (timeout 5000 ms); GET `/api/oauth/organizations/:orgUUID/admin_requests`; POST `/api/oauth/organizations/:orgUUID/admin_requests` |
| Browser open | Opens `https://claude.ai/admin-settings/usage` or `https://claude.ai/settings/usage` depending on role; emits `"browser-opened"` signal |
| Random bytes | 32-byte hex token generated via `oE9.randomBytes` during session setup (bundle.js:+3146140, +3146156, +3146169) |
| UUID generation | `bA_.randomUUID()` used during session tracking (bundle.js:+3114146) |
| Error logging | `Oc.logError` called on recoverable failures within the notification queue (bundle.js:+951053) |
| Sound | None detected |

---

## Version History

| Version | Change |
|---|---|
| v2.1.141 | Initial analysis |

---

## Common Mistakes

1. **Invoking on a non-OAuth session**: The command silently triggers a new login flow instead of managing usage when the current session is not a `pro` or `max` OAuth plan. Users on API key–only sessions should expect a login prompt, not a usage management screen.
2. **Non-admin team member confusion**: Members of team or enterprise organizations without `admin`, `billing`, `owner`, or `primary_owner` roles receive only an informational message. They cannot submit or view requests themselves.
3. **Duplicate request submission**: The command checks for existing `pending` or `dismissed` requests before creating a new one. Attempting to run `/extra-usage` again while a request is pending will not create a second request — it will display the "already submitted" message.
4. **Third-party provider users**: Users authenticated via Bedrock, Vertex, Azure Foundry, or Mantle providers will not be eligible for this command's usage management flow, as the feature targets first-party (`api.anthropic.com`) accounts only.
5. **Token expiry mid-flow**: The command handles a single 401 → refresh → retry cycle. A second 401 after refresh will result in an error rather than prompting re-login.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `iJ6` | Main handler for `/extra-usage` (AsyncFunction, arbor_handler) |
| `qq` | Auth/session state reader (reads provider, plan, token) |
| `SdA` | Session data accessor sub-function |
| `hdA` | Session header accessor sub-function |
| `mw` | Credential/auth context builder |
| `JL` | Environment variable reader |
| `RH` | String utility / normalization helper |
| `FR` | API key resolution orchestrator |
| `FU6` | OAuth token file descriptor reader |
| `Q46` | API key string validator |
| `ja` | OAuth token file descriptor handler |
| `yu` | Flag settings loader |
| `tj` | Auth provider classifier (bedrock/foundry/etc.) |
| `WA` | Provider string mapper |
| `j$` | Credential assembly and validation orchestrator |
| `G8_` | API key helper utility |
| `$V` | Auth context value extractor |
| `DH6` | VSCode environment detection (checks `"claude-vscode"`) |
| `pl8` | API key file descriptor reader |
| `h6` | Timestamp / session metadata recorder |
| `IR` | Credential history slicer (last 20 entries) |
| `RV` | Plan tier resolver |
| `j6` | Growthbook / experiment variant resolver |
| `b76` | Experiment config loader |
| `x76` | Experiment assignment helper |
| `Js` | Experiment result serializer |
| `ws` | Growthbook client wrapper |
| `Su` | Growthbook SDK initializer |
| `vi6` | Experiment deduplication guard (uses `pA_` Set and `gMH` Map) |
| `mA_` | Experiment event emitter (emits `"GrowthbookExperimentEvent"` to `wl`) |
| `W0H` | Growthbook event payload builder |
| `hu` | Random hex token generator (32 bytes) |
| `SH` | JSON serializer wrapper |
| `ayL` | Experiment analytics sink |
| `cA_` | Experiment request filter / eligibility gate |
| `sY9` | Experiment cache lookup |
| `p_` | Experiment persistence writer |
| `xE9` | Experiment timeout handler |
| `FRH` | Feature flag membership checker |
| `CMH` | Subscription type checker (stripe/apple/google_play) |
| `q5` | Subscription state resolver |
| `KA` | Auth state + subscription aggregator |
| `RB` | Boolean coercion helper |
| `Vq` | Session/context accessor wrapper |
| `cMA` | Context string formatter |
| `Nf8` | Extra-usage orchestrator (main async workflow) |
| `Mu` | Role-aware auth state checker |
| `NnH` | Usage API fetch + routing logic |
| `F1` | API client factory / token attacher |
| `_` | Locale/text utility |
| `hH` | Text formatter (feature-ok path) |
| `xH` | Text formatter (feature-bad path) |
| `NE` | Session accessor for non-admin path |
| `DAH` | Timeout/deadline setter (300000 ms guard) |
| `SE` | HTTP error handler with 401/403 branching and retry |
| `H` | Retry delay with jitter (Math.random + setTimeout, base 2) |
| `Du` | In-flight request deduplication map (W8_) |
| `v` | API response normalizer / log redactor |
| `J7K` | Response body parser |
| `t7` | Path/URL sanitizer (redacts `[REDACTED]`) |
| `MSH` | Response metadata extractor |
| `X7K` | File upload helper (Buffer.byteLength, 1000/100 byte limits) |
| `rR1` | Admin request eligibility fetcher (`api_admin_request_eligibility`) |
| `iR1` | Admin request list fetcher (`api_admin_request_list`) |
| `A` | FormData / multipart request builder |
| `f` | HTTP stream closer |
| `nR1` | Admin request creator (`api_admin_request_create`) |
| `kH` | Notification queue manager (push/shift with `aRH`, error logging) |
| `k_` | Error string formatter |
| `GvK` | Notification ring-buffer manager (kS6 queue, shift/push) |
| `Ug4` | Axios error classifier for usage API errors |
| `eq` | Browser open dispatcher (platform-aware: darwin/win32/linux) |
| `jb4` | URL scheme validator (http:/https:) |
| `O8` | Child process spawner for browser open |
| `M_` | Process execution wrapper (1000000 byte output cap, 10 concurrent limit) |
| `N6` | Process spawn error handler |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.