---
type: feature-spec
feature: "usage-credits"
cc_version: "2.1.157"
updated: "2026-06-02"
tags: ["usage-credits", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.157 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/usage-credits`

> Analysis basis: CC v2.1.157 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.157

---

## Overview

`/usage-credits` is a local JSX command that helps users continue working when they have hit a usage limit on their Anthropic account. It inspects the current subscription tier, contacts the Anthropic API to determine eligibility and existing admin-request state, then either opens the appropriate billing settings page in a browser or sends an admin request on the user's behalf to increase or enable usage credits.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `usage-credits` |
| description | `Configure usage credits to keep working when you hit a limit` |
| loc_byte | `9182600` |
| loc_byte_end | `9182810` |
| loc_line | `4044` |
| module_id | `nF_` |
| load_inline | `true` |
| arbor_handler.name | `KE6` |
| arbor_handler.fqn | `claude-2.1.157::KE6` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.157 bundle.js:+9182600

---

## Input Branching

The command exhibits five or more distinct paths depending on subscription tier, admin eligibility, and existing request status. A Mermaid flowchart is therefore required.

```mermaid
flowchart TD
    A(["/usage-credits invoked"]) --> B{Subscription tier check}
    B -- "pro or max" --> C[Proceed with OAuth flow if needed]
    B -- "team or enterprise" --> C
    B -- "other / none" --> Z1([Abort: unsupported plan])

    C --> D{Already logged in with valid OAuth?}
    D -- "No" --> E["Start new login\n'Starting new login following /usage-credits...'"]
    E --> F{Login result}
    F -- "success" --> G["'Login successful'"]
    F -- "interrupted" --> Z2(["'Login interrupted'"])
    D -- "Yes" --> G

    G --> H["Fetch usage data\nGET /api/oauth/usage\n(timeout 5000 ms, no-auth header)"]
    H --> I{HTTP 401?}
    I -- "Yes" --> J[Refresh token, retry once]
    J --> K{"Retry succeeded?\n(suffix ' (401→refresh→retry succeeded)')"}
    K -- "Yes" --> L[Continue with fresh data]
    K -- "No" --> Z3([Surface auth error])
    I -- "No" --> L

    L --> M{Check admin eligibility\n(api_admin_request_eligibility)}
    M -- "unlimited credits already" --> Z4(["'Your organization already has\nunlimited usage credits.\nNo request needed.'"])
    M -- "not eligible / not admin role" --> Z5(["'Contact your admin to manage\nusage credit settings.'"])
    M -- "eligible" --> N{Check existing requests\n(api_admin_request_list, statuses=pending,dismissed)}

    N -- "pending or dismissed request exists" --> Z6(["'You've already sent a usage\ncredit request to your admin.'"])
    N -- "no existing request" --> O{Request type needed}

    O -- "limit_increase" --> P["POST /api/oauth/organizations/:orgUUID/admin_requests\n(limit_increase)"]
    O -- "enable credits" --> P

    P --> Q{POST result}
    Q -- "success (limit_increase)" --> R(["'Request sent to your admin to\nincrease your usage credit limit.'"])
    Q -- "success (enable)" --> S(["'Request sent to your admin to\nturn on usage credits.'"])
    Q -- "HTTP 500" --> T{isAxiosError?}
    T -- "Yes" --> U[Extract detail field from response]
    T -- "No" --> Z7([Re-throw error])

    R --> V{Open browser?}
    S --> V
    V -- "admin role" --> W["Open https://claude.ai/admin-settings/usage"]
    V -- "non-admin / user" --> X["Open https://claude.ai/settings/usage"]
    W --> Y(["browser-opened signal emitted"])
    X --> Y
```

Analysis basis: CC v2.1.157 bundle.js:+9181021, +9181051, +9181065, +9181105, +9181183, +9181218

---

## Behavioral Spec

### Main Handler (`KE6` — command entry point)

```
async function usageCreditsHandler(context):
    tier = getCurrentSubscriptionTier()   // checks "pro" or "max" literals
    if tier not in ["pro", "max", "team", "enterprise"]:
        return earlyExit()

    if not hasValidOAuthSession():
        log("Starting new login following /usage-credits. Exit with Ctrl-C to use existing account.")
        result = await startLoginFlow()
        if result == interrupted:
            log("Login interrupted")
            return
        log("Login successful")
        notifyAPIKeyChange()              // _.onChangeAPIKey callback

    usageData = await fetchUsageData()
    adminResult = await checkEligibilityAndRequest(usageData)
    openBrowserIfAppropriate(adminResult)
```

Analysis basis: CC v2.1.157 bundle.js:+9181021, +9181288, +9181390, +9181413, +9181432

---

### OAuth / Auth Layer (`aW8` — authentication orchestrator)

```
async function authOrchestrator(context):
    sessionInfo = resolveSession(context)    // X1
    if sessionInfo.planType in ["team", "enterprise"]:
        eligibility = await fetchAdminRequestEligibility(sessionInfo)
        if eligibility.unlimited:
            return message("Your organization already has unlimited usage credits. No request needed.")

    usageInfo  = await fetchUsageInfo(sessionInfo)   // UXH
    requestInfo = await listAdminRequests(sessionInfo) // q51
    
    if existingRequest(requestInfo, statuses=["pending","dismissed"]):
        return message("You've already sent a usage credit request to your admin.")

    response = await createAdminRequest(sessionInfo)  // A51
    if response.type == "limit_increase":
        return message("Request sent to your admin to increase your usage credit limit.")
    else:
        return message("Request sent to your admin to turn on usage credits.")
```

Analysis basis: CC v2.1.157 bundle.js:+9135392, +9135432, +9135460, +9135489, +9135742, +9135954, +9136198, +9136421

---

### Usage Data Fetch (`UXH` — API caller)

```
async function fetchUsageData(sessionInfo):
    endpoint = "/api/oauth/usage"
    options  = {
        timeout:      5000,                  // ms
        headers:      {"Content-Type": "application/json"},
        authMode:     "no-auth"
    }
    try:
        response = await U9.get(endpoint, options)
        return response
    catch HTTP_401:
        refreshedToken = await refreshOAuthToken()
        response = await U9.get(endpoint, options)  // retry once
        log(" (401→refresh→retry succeeded)")
        return response
    catch other:
        throw Error(response)
```

Analysis basis: CC v2.1.157 bundle.js:+9134608, +9134615, +9134643, +9134657, +9134672, +9134757, +9134858

---

### Admin Request Eligibility (`K51`)

```
async function checkAdminRequestEligibility(sessionInfo):
    response = await U9.get("api_admin_request_eligibility", sessionInfo)
    if response fails:
        if isTeleportOrg(response):    // "teleport-org" literal
            handle teleport edge case
        throw Error(response)
    return eligibility
```

Analysis basis: CC v2.1.157 bundle.js:+9134115, +9134118, +9134172, +9134266, +9134298

---

### Admin Request List (`q51`)

```
async function listAdminRequests(sessionInfo):
    params   = { statuses: ["pending", "dismissed"] }
    endpoint = "api_admin_request_list"
    response = await U9.get(endpoint, { ...sessionInfo, ...params })
    // appends statuses param via A.append
    if response fails:
        throw Error(response)
    return response
```

Analysis basis: CC v2.1.157 bundle.js:+9133764, +9133861, +9133870, +9133896, +9134000, +9135976, +9135986

---

### Admin Request Create (`A51`)

```
async function createAdminRequest(sessionInfo):
    endpoint = "/api/oauth/organizations/:orgUUID/admin_requests"
    body     = { type: "limit_increase" }
    response = await U9.post(endpoint, body, sessionInfo)
    if response fails:
        throw Error(response)
    return response
```

Analysis basis: CC v2.1.157 bundle.js:+9133499, +9133502, +9133551, +9133559, +9133650

---

### Error Extraction (`f51`)

```
function extractErrorDetail(error):
    if c_.isAxiosError(error):
        if error.response.status == 500:
            return error.response.data["detail"]
    throw error
```

Analysis basis: CC v2.1.157 bundle.js:+9134978, +9135061, +9135267

---

### Browser Launch (`JK` — cross-platform URL opener)

```
async function openBrowserForUsageSettings(role):
    if role in ["admin", "billing", "owner", "primary_owner"]:
        url = "https://claude.ai/admin-settings/usage"
    else:
        url = "https://claude.ai/settings/usage"

    platform = process.platform
    if platform == "darwin":
        spawn("open", [url])
    else if platform == "win32":
        spawn("rundll32", ["url,OpenURL", url])
    else:
        spawn("xdg-open", [url])

    emit("browser-opened")
```

Analysis basis: CC v2.1.157 bundle.js:+6698948, +6698961, +6699020, +6699036, +6699069, +6699120, +6699132, +6699194, +6699201, +9136421, +9136431, +9136488, +9136518, +9136651, +9136692, +9136759

---

### Auth Environment Resolution (`EY` / `F3` — auth method selector)

```
function resolveAuthEnvironment(config):
    apiKey = env("ANTHROPIC_API_KEY")
    if apiKey:
        authMethod = "ANTHROPIC_API_KEY"
    else if env("ANTHROPIC_AUTH_TOKEN") or env("CLAUDE_CODE_OAUTH_TOKEN"):
        authMethod = "user_oauth"
    else if apiKeyHelper configured:
        authMethod = "apiKeyHelper"
    else if apiKeyFileFd = env("CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR"):
        authMethod = read from fd
    else if oauthTokenFileFd = env("CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR"):
        authMethod = "OAuth token"
    else:
        throw Error("ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, CLAUDE_CODE_OAUTH_TOKEN, or WIF env vars (ANTHROPIC_FEDERATION_RULE_ID + ANTHROPIC_ORGANIZATION_ID) required")

    if isVSCode client (client == "claude-vscode"):
        use --bare flag for subprocess
    
    profileType = "profile-implicit"
    return resolvedAuthConfig
```

Analysis basis: CC v2.1.157 bundle.js:+2942347, +2942445, +2942466, +2942474, +2942499, +2942552, +2944279, +2944366, +2944447, +2944460, +2944499, +2944829, +2068395, +2068401, +2068413, +2068479, +2068544, +2068556, +2068618

---

### Provider Platform Check (`NO` / `TA`)

```
function checkProviderPlatform(authConfig):
    platform = authConfig.platform
    unsupportedPlatforms = ["bedrock", "foundry", "anthropicAws", "mantle", "vertex"]
    supportedPlatforms   = ["firstParty"]
    if platform in unsupportedPlatforms:
        return error("Platform not supported for usage credits")
    return "firstParty"
```

Analysis basis: CC v2.1.157 bundle.js:+2046208, +2046248, +2046298, +2046354, +2046408, +2046456, +2046465, +2046525

---

### Feature Flag Gate (`hH` / `bH` via `X1`)

```
function checkFeatureFlag(flagName):
    flagSettings = loadFlagSettings()
    if flagSettings[flagName] == true:
        emit("tengu_feature_ok")
        return true
    else:
        emit("tengu_feature_bad")
        return false
```

Analysis basis: CC v2.1.157 bundle.js:+966031, +966033, +966089, +966091, +966501, +966512, +2945434

---

### Subscription Type Classifier (`f1` / `WA`)

```
function classifySubscription(accountData):
    subscriptionType = accountData.subscription.type
    knownTypes = [
        "stripe_subscription",
        "stripe_subscription_contracted",
        "apple_subscription",
        "google_play_subscription"
    ]
    if Array.isArray(subscriptionType):
        return subscriptionType.includes(knownTypes)
    return subscriptionType
```

Analysis basis: CC v2.1.157 bundle.js:+2961367, +2961394, +2961432, +2961458, +2961614, +2961627, +2961637, +2961660, +2960816, +2960837, +2960840

---

### Ember Latch / GrowthBook Experiment (`G6` — feature experiment tracker)

```
function recordEmberLatch(experimentContext):
    emit("tengu_ember_latch")
    if not izH.has(experimentId):
        experimentData = e88(experimentId)    // cache lookup
        if not mz_.has(experimentId):
            mz_.add(experimentId)
            session = uz_(experimentData)     // create session
            session.uuid = Cz_.randomUUID()
            session.token = hFq.randomBytes(32).toString("hex")
            emitEvent("GrowthbookExperimentEvent")
            Er.emit("growthbook_experiment", session)
    rz6.add(experimentId)
    if PU.has(experimentId):
        return PU.get(experimentId)
    return S6(experimentContext)
```

Analysis basis: CC v2.1.157 bundle.js:+9181065, +9181068, +3187108, +3187145, +3187180, +3187197, +3187208, +3187220, +3187234, +3187251, +3187271, +3180734, +3181161, +3180588, +3213446, +3213462, +3213475

---

### HTTP Error Classification (`AT`)

```
function classifyHttpError(error):
    if c_.isAxiosError(error):
        status = error.response.status
        if status == 401:
            return "unauthenticated"
        if status == 403:
            if error.message.includes("OAuth token has been revoked"):
                return "token_revoked"
            return "forbidden"
        if status == 429:
            return "rate_limited"
    return "unknown"
```

Analysis basis: CC v2.1.157 bundle.js:+2977879, +2977896, +2977957, +2977985, +2978051, +2978098, +2978143

---

### API Key Logging (`N` — credential sanitiser)

```
function sanitiseAndLogCredential(key):
    if isDebugMode:
        display = key.toUpperCase()
        redacted = key.replace(sensitivePattern, "[REDACTED]")
        log("debug", redacted)
    return sanitised
```

Analysis basis: CC v2.1.157 bundle.js:+204151, +204175, +204193, +204215, +204233, +204277, +204297, +204300, +204316, +204322, +204336, +196276

---

### Org Config File Loader (`lCK`)

```
function loadOrgConfig(configPath):
    resolved = rxH(configPath)
    dir      = N0H.dirname(resolved)
    content  = readFileSync(resolved)
    byteLen  = Buffer.byteLength(content)
    if byteLen > 1000:
        warn("Config exceeds 1000 bytes")
    if byteLen > 100:
        warn("Config exceeds 100 bytes")
    parsed = JSON.parse(content)
    return Gx6.then(cCK.bind(null, parsed))
```

Analysis basis: CC v2.1.157 bundle.js:+203663, +203688, +203696, +203726, +203741, +203816, +203833, +203865, +203871, +203904, +203921, +203930, +203982, +204001, +204026

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_ember_latch` | Fired when a GrowthBook experiment latch is evaluated (bundle.js:+9181068) |
| Telemetry: `tengu_feature_ok` | Fired when a feature flag gate passes (bundle.js:+966033) |
| Telemetry: `tengu_feature_bad` | Fired when a feature flag gate fails (bundle.js:+966091) |
| GrowthBook experiment event | `GrowthbookExperimentEvent` emitted via `Er.emit("growthbook_experiment", …)` (bundle.js:+3180734, +3181161) |
| OAuth session mutation | Token refresh stored via `rp` → `f3_.set` on 401 retry (bundle.js:+2956358) |
| API side effect: eligibility check | `GET api_admin_request_eligibility` (bundle.js:+9134118) |
| API side effect: request list | `GET api_admin_request_list` with `statuses=pending,dismissed` (bundle.js:+9133767) |
| API side effect: request create | `POST /api/oauth/organizations/:orgUUID/admin_requests` (bundle.js:+9133559) |
| Browser launch | Platform-specific subprocess spawned; `browser-opened` signal emitted (bundle.js:+9136759) |
| Log output | "Starting new login…", "Login successful", "Login interrupted" messages written to terminal (bundle.js:+9181288, +9181413, +9181432) |
| `_.onChangeAPIKey` callback | Fired after successful login to notify downstream subscribers (bundle.js:+9181390) |
| SH / error queue | Errors pushed to `YpH` queue; logged via `Vi.logError` (bundle.js:+971731, +971771) |
| Experiment deduplication set | `mz_` (Set) tracks which experiment IDs have already fired events (bundle.js:+3184799, +3184839) |
| Random bytes generation | 32-byte hex token created via `hFq.randomBytes` for experiment sessions (bundle.js:+3213446, +3213462) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.157 | Initial analysis |

---

## Common Mistakes

1. **Running on an unsupported platform** — The command is only meaningful for `firstParty` Anthropic accounts. Users on `bedrock`, `foundry`, `anthropicAws`, `mantle`, or `vertex` providers will receive an unsupported-platform error and no admin request will be sent (bundle.js:+2046248–+2046465).

2. **Expecting immediate credit** — The command sends a request to an admin; it does not grant credits directly. The admin must act on the request through `https://claude.ai/admin-settings/usage`.

3. **Repeated invocation** — If a `pending` or `dismissed` request already exists, the command reports "You've already sent a usage credit request" and does not create a duplicate (bundle.js:+9135976, +9135986).

4. **Non-admin user expecting the admin URL** — The browser URL opened depends on the user's role. Only roles `admin`, `billing`, `owner`, or `primary_owner` see the admin-settings URL; others are directed to the personal settings URL (bundle.js:+2051698–+2051724, +9136651, +9136692).

5. **Aborting the login flow** — If the user presses Ctrl-C during the OAuth login re-initiation, the command exits with "Login interrupted" and no request is sent (bundle.js:+9181432).

6. **Organization with unlimited credits** — If the org already has unlimited usage credits, the command short-circuits with an informational message and takes no further action (bundle.js:+9135651).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `KE6` | Main async handler for `/usage-credits` command |
| `f1` | Subscription data resolver / account info fetcher |
| `Yq_` | Subscription field accessor (depth-1 from f1) |
| `zq_` | Subscription type extractor (depth-1 from f1) |
| `EY` | Auth environment resolver / credential dispatcher |
| `BK` | Config reader utility |
| `CH` | String / environment variable accessor |
| `pP` | Auth method selector (API key, OAuth, helper) |
| `fr6` | File-descriptor credential reader |
| `rgH` | Credential string formatter |
| `di` | OAuth token file-descriptor handler |
| `lN` | Flag-settings loader |
| `YR` | Array membership tester for subscription types |
| `NO` | Provider platform classifier |
| `TA` | Platform string mapper |
| `AX` | Auth config assembler |
| `F3` | Primary auth method builder |
| `aO6` | API-key-helper invoker |
| `gxH` | VS Code client detector |
| `YM6` | API key file-descriptor reader |
| `S6` | Persistent state store (read/write) |
| `DR` | Recent-history slicer (last 20 items) |
| `tO6` | Credential formatter wrapper |
| `kZ` | Tier/plan guard (pro / max check) |
| `G6` | GrowthBook experiment evaluator |
| `az6` | Experiment config fetcher |
| `sz6` | Experiment variant selector |
| `Ex` | Experiment context builder |
| `Zx` | Feature flag resolver |
| `vR` | Flag value reader |
| `e88` | Experiment session cache lookup |
| `uz_` | Experiment session creator |
| `FEH` | Experiment flag state initialiser |
| `wU` | Random token generator for experiment sessions |
| `RH` | JSON serialiser wrapper |
| `q17` | Experiment event payload builder |
| `Fz_` | Experiment event emitter orchestrator |
| `Nyq` | Queue helper for experiment events |
| `B_` | Promise/async task scheduler |
| `jFq` | Experiment flush trigger |
| `B$H` | Experiment deduplication cache checker |
| `gzH` | App-state React component / context hook |
| `_7` | State slice reader |
| `WA` | Subscription type classifier (array/string) |
| `L1` | Network traffic tier selector |
| `fVA` | Traffic tier resolver |
| `aW8` | Authentication orchestrator for usage-credits flow |
| `sb` | Role-based admin check helper |
| `UXH` | Usage data fetcher (`/api/oauth/usage`) |
| `X1` | Auth session resolver |
| `_` | Base session / credential object |
| `hH` | Feature-ok flag evaluator |
| `bH` | Feature-bad flag evaluator |
| `YV` | Subscription array membership checker |
| `H` | Jitter/retry delay utility |
| `AT` | HTTP error classifier (401/403/429) |
| `rp` | OAuth token cache manager (get/set/delete) |
| `N` | Credential sanitiser and debug logger |
| `QCK` | Config path resolver |
| `v4` | Path normaliser with redaction |
| `EuH` | Environment variable validator |
| `lCK` | Org config file loader |
| `K51` | Admin request eligibility checker |
| `q51` | Admin request list fetcher |
| `A` | HTTP form-data / query-string builder |
| `f` | HTTP connection manager |
| `A51` | Admin request creator (POST) |
| `f51` | Axios error detail extractor |
| `Iz` | Result message formatter |
| `EH` | String coercion helper |
| `SH` | Error queue and log dispatcher |
| `F_` | Error/String wrapper |
| `X_4` | Rotating error buffer (shift/push) |
| `JK` | Cross-platform browser launcher |
| `Lo7` | URL validation / scheme checker |
| `FD` | Browser process spawner |
| `v8` | Platform-specific command builder |
| `G_` | Child process executor with timeout |
| `h6` | Process output collector |