---
type: feature-spec
feature: "extra-usage"
cc_version: "2.1.139"
updated: "2026-05-31"
tags: ["extra-usage", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.139 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/extra-usage`

> Analysis basis: CC v2.1.139 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.139

---

## Overview

The `/extra-usage` command allows users to configure extra usage capacity so that work can continue when their normal usage limits are reached. It checks the user's subscription tier and organizational role, then either notifies the user that unlimited extra usage is already active, submits an admin-approval request, or opens a browser to a settings page — depending on the account type and existing request state.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `extra-usage` |
| description | `Configure extra usage to keep working when limits are hit` |
| loc_byte | `8119867` |
| loc_byte_end | `8120072` |
| loc_line | `3031` |
| module_id | `Zy1` |
| load_inline | `true` |
| arbor_handler.name | `Iw6` |
| arbor_handler.fqn | `claude-2.1.139::Iw6` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.139 bundle.js:+8119867

---

## Input Branching

The command has 5+ distinct outcomes depending on plan type, organizational role, existing request state, and authentication status. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A[/extra-usage invoked] --> B{Auth state: OAuth session?}
    B -- No OAuth / API key only --> C[Error: Web sessions require\nClaude.ai OAuth login.\nSuggest /login]
    B -- OAuth OK --> D{Subscription tier}
    D -- pro / max --> E{Organization type}
    D -- Other tier --> F[Open browser to\nhttps://claude.ai/settings/usage\nwith browser-opened signal]
    E -- team / enterprise --> G{User role}
    E -- Other --> F
    G -- admin / billing / owner / primary_owner --> H[Call api_admin_request_eligibility]
    G -- Non-admin role --> I[Message: Contact your admin\nto manage extra usage settings]
    H --> J{Eligibility result}
    J -- Already unlimited --> K[Message: Organization already\nhas unlimited extra usage]
    J -- Eligible for limit_increase --> L[Call api_admin_request_list]
    L --> M{Existing request state}
    M -- pending or dismissed --> N[Message: Request already\nsubmitted to admin]
    M -- None found --> O[Call api_admin_request_create]
    O --> P{Request type}
    P -- limit_increase --> Q[Message: Request sent to admin\nto increase extra usage]
    P -- Other --> R[Message: Request sent to admin\nto enable extra usage]
    F --> S[Browser opened]
    Q --> T[Done]
    R --> T
    K --> T
    N --> T
    I --> T
    C --> U{Trigger login flow?}
    U -- Yes --> V[Start login: emit\n'Starting new login following /extra-usage']
    V --> W{Login result}
    W -- Success --> X[Message: Login successful]
    W -- Interrupted --> Y[Message: Login interrupted]
```

Analysis basis: CC v2.1.139 bundle.js:+8118827, +8073707, +8073961, +8074117, +8074311, +8074665, +8119094

---

## Behavioral Spec

### 1. Main Handler — Authentication & Plan Gating

The main handler (`Iw6`) is an `AsyncFunction` resolved via `module_id` → `Zy1`.

```
async function handleExtraUsage(context):
    authState = getAuthState(context)           # calls o1
    planInfo  = getPlanInfo(context)            # calls j6

    if not authState.hasOAuthSession:
        if authState.isApiKeyOnly:
            display("Claude Code web sessions require authentication with a "
                    "Claude.ai account. API key authentication is not "
                    "sufficient. Please run /login to authenticate, or "
                    "check your authentication status with /status.")
            triggerLoginFlow(context)           # see §3
            return

    subscriptionKind = resolveSubscriptionKind(planInfo)  # "pro" | "max" | other
    orgType          = resolveOrgType(context)             # "team" | "enterprise" | other
```

Analysis basis: CC v2.1.139 bundle.js:+8118827, +8118857, +8118871, +8118911, +8118919, +6504975

### 2. Auth-State Resolution

```
function resolveAuthState(context):
    flags = getAuthFlags(context)       # reads flagSettings
    if flags includes "claude-desktop":
        return { provider: "claude-desktop" }
    token = readEnvToken()              # reads ANTHROPIC_API_KEY or
                                        # CLAUDE_CODE_OAUTH_TOKEN
    if not token:
        raise Error("ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN "
                    "env var is required")
    return classifyProvider(token)
    # Provider strings: bedrock, foundry, anthropicAws, mantle,
    #                   vertex, firstParty
```

Analysis basis: CC v2.1.139 bundle.js:+2886236, +2889289, +2889710, +2001281

### 3. Login Flow (OAuth fallback)

When the user is not authenticated via OAuth and consents to log in:

```
function triggerLoginFlow(context):
    emit("Starting new login following /extra-usage. "
         "Exit with Ctrl-C to use existing account.")
    result = await runOAuthLogin(context)       # calls aZ
    context.onChangeAPIKey(result)              # fires _.onChangeAPIKey
    if result.success:
        display("Login successful")
    else:
        display("Login interrupted")
```

Analysis basis: CC v2.1.139 bundle.js:+8119094, +8119194, +8119217, +8119236

### 4. Plan & Org Classification

```
function classifyPlanAndOrg(planInfo):
    tier = planInfo.tier    # "pro" | "max"
    org  = planInfo.org     # "team" | "enterprise"
    role = planInfo.role    # "admin" | "billing" | "owner" | "primary_owner"
    return { tier, org, role }
```

Supported subscription types checked at runtime:
- `stripe_subscription` (bundle.js:+2904852)
- `stripe_subscription_contracted` (bundle.js:+2904879)
- `apple_subscription` (bundle.js:+2904917)
- `google_play_subscription` (bundle.js:+2904943)

Analysis basis: CC v2.1.139 bundle.js:+8073707, +8073719, +2003844, +8118838, +8118849

### 5. Eligibility Check (`api_admin_request_eligibility`)

```
async function checkEligibility(orgUuid, authHeaders):
    # GET /api/oauth/usage with 5000 ms timeout
    response = await apiGet("/api/oauth/usage",
                            headers = buildHeaders(orgUuid, authHeaders),
                            timeout = 5000)
    if response.message == "Your organization already has unlimited extra usage. No request needed.":
        return { unlimited: true }
    if response includes "limit_increase":
        return { canRequest: true, type: "limit_increase" }
    return { canRequest: false }
```

Header set:
- `Content-Type: application/json` (bundle.js:+8072971)
- `x-organization-uuid: <orgUuid>` (bundle.js:+8072484)
- `no-auth` mode flag (bundle.js:+8073055)

If a 401 is received, the handler attempts a token refresh and retries once; on success appends ` (401→refresh→retry succeeded)` to the log (bundle.js:+8073156).
Timeout: 5000 ms (bundle.js:+8072957).
On HTTP 500+: extracts `detail` field from response body (bundle.js:+8073571).

Analysis basis: CC v2.1.139 bundle.js:+8072719, +8072929, +8072957, +8073055, +8073156, +8073365, +8073571, +8073868

### 6. Request List Check (`api_admin_request_list`)

```
async function listExistingRequests(orgUuid, authHeaders):
    # Fetches existing admin requests for the org
    response = await apiGet(buildAdminRequestListUrl(orgUuid),
                            headers = buildHeaders(orgUuid, authHeaders))
    for request in response:
        if request.status in ["pending", "dismissed"]:
            display("You have already submitted a request for extra "
                    "usage to your admin.")
            return { alreadyRequested: true }
    return { alreadyRequested: false }
```

Analysis basis: CC v2.1.139 bundle.js:+8072078, +8074139, +8074149, +8074208

### 7. Request Creation (`api_admin_request_create`)

```
async function createAdminRequest(orgUuid, authHeaders, requestType):
    # POST to admin request creation endpoint
    response = await apiPost(buildAdminRequestCreateUrl(orgUuid),
                             body    = { type: requestType },
                             headers = buildHeaders(orgUuid, authHeaders))
    if requestType == "limit_increase":
        display("Request sent to your admin to increase extra usage.")
    else:
        display("Request sent to your admin to enable extra usage.")
```

Analysis basis: CC v2.1.139 bundle.js:+8071815, +8074397, +8074451

### 8. Non-Admin Role Path

```
function handleNonAdminRole():
    display("Please contact your admin to manage extra usage settings.")
```

Analysis basis: CC v2.1.139 bundle.js:+8074025

### 9. Browser Open (non-team/enterprise or non-pro/max tiers)

```
async function openSettingsBrowser(isAdmin):
    if isAdmin:
        url = "https://claude.ai/admin-settings/usage"
    else:
        url = "https://claude.ai/settings/usage"
    openBrowser(url)        # platform-dispatched: darwin→open,
                            # win32→rundll32 url,OpenURL, linux→xdg-open
    emit("browser-opened")
```

Analysis basis: CC v2.1.139 bundle.js:+8074665, +8074706, +8074773, +7432911, +7432927, +7433011, +7433085, +7433092

### 10. HTTP Retry & Token Refresh

The API call wrapper (`Uv`) implements exponential back-off with jitter:

```
async function callWithRetry(request, maxAttempts=2):
    for attempt in 1..maxAttempts:
        try:
            response = await httpCall(request)
            return response
        except AxiosError as err:
            if err.status == 401:
                refreshed = await refreshOAuthToken()
                if refreshed:
                    request.headers = updatedAuthHeaders()
                    continue
                if err.message contains "OAuth token has been revoked":
                    raise
            if err.status == 403:
                raise
            wait = (2 ** attempt) * randomJitter()   # base=2, bundle.js:+12439007
            await sleep(wait)                        # setTimeout
    raise lastError
```

Cache timeout for auth context: 300 000 ms (bundle.js:+2010477).

Analysis basis: CC v2.1.139 bundle.js:+2914619, +2914680, +2914708, +2914774, +2914866, +12439007, +12439046, +2010477

### 11. Org UUID Resolution

```
function resolveOrgUuid(context):
    uuid = context.orgUuid
    if not uuid:
        raise Error("Unable to get organization UUID")
    return uuid
```

Analysis basis: CC v2.1.139 bundle.js:+6505214

### 12. API Usage Fetch Helper

```
async function fetchApiUsage(orgUuid, authToken):
    # action identifier: "api_usage_fetch"
    response = await GET("/api/oauth/usage",
                         headers = {
                             "Content-Type":       "application/json",
                             "x-organization-uuid": orgUuid
                         },
                         timeout = 5000)
    return response
```

Action string: `"api_usage_fetch"` (bundle.js:+8072719).

Analysis basis: CC v2.1.139 bundle.js:+8072719, +8072922, +8072929

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_ember_latch` (bundle.js:+8118874); `tengu_feature_ok` (bundle.js:+943635); `tengu_feature_bad` (bundle.js:+943693) |
| API calls | `GET /api/oauth/usage` (usage fetch & eligibility); internal admin request list & create endpoints |
| Browser launch | Opens `https://claude.ai/admin-settings/usage` or `https://claude.ai/settings/usage` depending on role; emits `"browser-opened"` signal |
| OAuth / login | May trigger full OAuth login flow if user lacks an active session; fires `_.onChangeAPIKey` on completion |
| Token cache | Auth token cache TTL: 300 000 ms |
| Growthbook experiment events | `growthbook_experiment` events emitted via `za.emit`; experiment data serialised with `JSON.stringify` |
| Random bytes | 32-byte hex nonce generated for session tokens (`V09.randomBytes`, hex encoding) |
| Log error | Errors appended to `RSH` queue via `Jd.logError` |

---

## Version History

| Version | Change |
|---|---|
| v2.1.139 | Initial analysis |

---

## Common Mistakes

1. **Invoking without OAuth authentication** — The command requires an active Claude.ai OAuth session. Using only `ANTHROPIC_API_KEY` is insufficient and triggers a mandatory login flow or an error message directing the user to `/login`.
2. **Running as a non-admin member in a team/enterprise org** — Non-admin roles (not `admin`, `billing`, `owner`, or `primary_owner`) receive a "contact your admin" message and no request is created.
3. **Expecting immediate activation** — The command submits a request to the org admin; it does not immediately grant extra usage. Users must wait for admin approval.
4. **Duplicate requests** — If a request with status `pending` or `dismissed` already exists, the command reports this and does not submit a duplicate.
5. **Using the command in orgs already on unlimited usage** — The API response for unlimited orgs short-circuits the flow with an informational message and no action is taken.
6. **Network timeout misunderstanding** — The usage API call has a hard 5 000 ms timeout (bundle.js:+8072957); slow networks may cause a transient error even when the account is valid.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Iw6` | Main handler for `/extra-usage` (AsyncFunction, arbor_handler) |
| `o1` | Auth-state / current-user resolution helper |
| `fFA` | Auth flag reader sub-helper (called from o1) |
| `LFA` | Auth flag reader sub-helper (called from o1) |
| `Pw` | Provider/credential classifier |
| `fL` | Token file descriptor loader |
| `SH` | String normalisation utility |
| `WR` | Credential wrapper / reader |
| `_p6` | Auth header builder sub-helper |
| `JL6` | String helper used during credential wrapping |
| `Do` | OAuth token file descriptor handler |
| `sx` | Flag-settings accessor |
| `dO` | Cloud-provider type detector (bedrock/foundry/vertex/etc.) |
| `WA` | Cloud-provider string mapper |
| `w$` | Full credential resolution (env vars, API key, OAuth token) |
| `LH_` | API key helper reader |
| `yZ` | Credential mode classifier ("none" etc.) |
| `ptH` | VS Code platform detector |
| `Ed8` | OAuth token file descriptor handler (write path) |
| `b6` | Session/token state record builder |
| `AR` | Token slicer (last-20-chars preview) |
| `aZ` | OAuth login flow initiator |
| `j6` | Plan/subscription info resolver |
| `L46` | Plan data fetcher sub-helper |
| `M46` | Plan data fetcher sub-helper |
| `Ya` | Subscription type evaluator |
| `Da` | Experiment assignment fetcher |
| `ex` | Growthbook experiment evaluator |
| `Ql6` | Experiment deduplication / caching layer |
| `G8_` | Growthbook experiment event builder |
| `zWH` | Experiment variant resolver |
| `tx` | Random nonce / session token generator |
| `yH` | JSON serialiser wrapper |
| `DVL` | Experiment event dispatcher helper |
| `k8_` | Experiment assignment recorder |
| `k$9` | Experiment assignment sub-helper |
| `m_` | Internal state accessor |
| `$09` | Experiment storage writer |
| `TSH` | Feature flag set checker |
| `RfH` | Subscription eligibility checker (stripe/apple/google) |
| `a7` | Subscription provider resolver |
| `e_` | Boolean credential presence check |
| `lU` | Boolean coercion utility |
| `S1` | Telemetry / feature-flag gate |
| `G7A` | Feature gate string helper |
| `d78` | Core extra-usage action dispatcher |
| `Cx` | Role / permission checker |
| `lcH` | API usage fetcher (`api_usage_fetch`, GET /api/oauth/usage) |
| `x1` | HTTP request builder with auth headers |
| `_` | Base URL / environment resolver |
| `kH` | URL builder (environment-aware) |
| `xH` | URL builder variant |
| `cT` | Auth header injector |
| `__H` | Cache timestamp recorder |
| `Uv` | HTTP retry wrapper with 401-refresh logic |
| `H` | Jitter/back-off sleep helper (Math.random + setTimeout) |
| `Fd` | Token cache manager (get/set/delete on KH_) |
| `N` | HTTP response normaliser / log formatter |
| `y9K` | Response body parser |
| `LM` | Redaction helper ("[REDACTED]" for sensitive fields) |
| `QyH` | MIME / content-type helper |
| `R9K` | File/buffer size checker (Buffer.byteLength) |
| `LH` | Error logger / queue pusher |
| `q_` | Error string formatter |
| `CGK` | Log queue rotator (shift/push on Qy6) |
| `ak1` | Admin eligibility request helper (`api_admin_request_eligibility`) |
| `mw` | Web-session auth assertion (raises if not OAuth) |
| `D7` | Org UUID extractor |
| `Vv` | Org UUID error formatter |
| `ZM` | Anthropic API version header builder |
| `e_H` | `anthropic-version` / `anthropic-client-platform` header values |
| `GA` | Base API URL builder with environment selection |
| `$4A` | Environment variable reader for API URL |
| `V0K` | Approved endpoint validator |
| `ok1` | Admin request list helper (`api_admin_request_list`) |
| `rk1` | Admin request create helper (`api_admin_request_create`) |
| `lu4` | Axios error classifier for admin request responses |
| `iq` | Browser open dispatcher (platform-aware) |
| `Tk4` | URL scheme validator (http/https) |
| `O8` | Browser process spawner |
| `$_` | Child-process launcher |
| `C6` | Platform command resolver (open/rundll32/xdg-open) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.