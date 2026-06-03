---
type: feature-spec
feature: "usage-credits"
cc_version: 2.1.161
updated: "2026-06-02"
tags: ["usage-credits", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.160
analysis_basis: "CC v2.1.160 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/usage-credits`

> Analysis basis: CC v2.1.160 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.160

---

## Overview

`/usage-credits` is a local-JSX command that helps users configure usage credits when they hit a rate or usage limit. It interacts with the Anthropic OAuth API to check eligibility, inspect existing admin requests, and optionally submit a new limit-increase or credit-enable request to the user's organization administrator. When the user is not logged in with a qualifying plan (`pro` or `max`), it can trigger a fresh login flow before proceeding.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `usage-credits` |
| description | `Configure usage credits to keep working when you hit a limit` |
| loc_byte | `9236662` |
| loc_byte_end | `9236872` |
| loc_line | `4055` |
| module_id | `yQ_` |
| load_inline | `true` |
| arbor_handler.name | `YV6` |
| arbor_handler.fqn | `claude-2.1.160::YV6` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.160 bundle.js:+9236662

---

## Input Branching

The command involves 5+ distinct branches depending on plan type, organization role, and existing request state; a Mermaid flowchart is used.

```mermaid
flowchart TD
    A([/usage-credits invoked]) --> B{Current plan is\n'pro' or 'max'?}

    B -- No --> C[Print login prompt\n'Starting new login following /usage-credits...']
    C --> D[Trigger OAuth login flow]
    D --> E{Login outcome}
    E -- Success --> F[Emit 'Login successful'\nCall onChangeAPIKey]
    E -- Interrupted --> G[Emit 'Login interrupted'\nAbort]
    F --> H

    B -- Yes --> H{Organization plan is\n'team' or 'enterprise'?}

    H -- No --> I[Show personal usage URL\nhttps://claude.ai/settings/usage\nOpen browser]

    H -- Yes --> J{User role is admin /\nbilling / owner /\nprimary_owner?}

    J -- No --> K[Show message:\n'Contact your admin to\nmanage usage credit settings.']

    J -- Yes --> L[Fetch /api/oauth/usage\n(api_usage_fetch)]

    L --> M{Organization already has\nunlimited usage credits?}

    M -- Yes --> N[Show message:\n'Your organization already has\nunlimited usage credits.\nNo request needed.']

    M -- No --> O[Check eligibility\n(api_admin_request_eligibility)]

    O --> P{Eligibility type}

    P -- 'limit_increase' --> Q[List existing requests\n(api_admin_request_list)]
    P -- Other --> Q

    Q --> R{Existing request\nin 'pending' or 'dismissed' state?}

    R -- Yes --> S[Show message:\n'You have already sent a\nusage credit request to\nyour admin.']

    R -- No --> T[Create new admin request\nPOST /api/oauth/organizations/:orgUUID/admin_requests\n(api_admin_request_create)]

    T --> U{Request type}
    U -- 'limit_increase' --> V[Show message:\n'Request sent to your admin\nto increase your usage\ncredit limit.']
    U -- other/enable --> W[Show message:\n'Request sent to your admin\nto turn on usage credits.']

    V --> X([Done])
    W --> X
    S --> X
    N --> X
    K --> X
    I --> X
    G --> X
```

Analysis basis: CC v2.1.160 bundle.js:+9235096, +9235107, +9235118, +9189466, +9189477, +9189489, +9188525, +9188192, +9189820, +9189725, +9190050, +9190358, +9190424

---

## Behavioral Spec

### Main Handler — `usageCreditsHandler` (`YV6`)

```
async function usageCreditsHandler(context):
    plan = getCurrentPlan(context)            // checks 'pro' or 'max' literal

    if plan is not in ['pro', 'max']:
        print("Starting new login following /usage-credits. Exit with Ctrl-C to use existing account.")
        outcome = await triggerLoginFlow()    // invokes W6 (experimentTracker/login)
        if outcome == 'success':
            emit('Login successful')
            invokeOnChangeAPIKey()            // _.onChangeAPIKey
        else:
            emit('Login interrupted')
            return
    
    return await buildUsageCreditUI(context) // delegates to HT8
```

Analysis basis: CC v2.1.160 bundle.js:+9235096, +9235107, +9235118, +9235363, +9235465, +9235488, +9235507

---

### Plan / Subscription Detection — `subscriptionTypeResolver` (`YDH`)

```
function subscriptionTypeResolver(billingInfo):
    type = billingInfo.type
    if type in ['stripe_subscription', 'stripe_subscription_contracted',
                'apple_subscription', 'google_play_subscription']:
        return resolveViaStripeOrStore(billingInfo)   // fL → bD, R6
    return resolveViaApiResponse(billingInfo)         // EA → bD, IR, mq
```

Analysis basis: CC v2.1.160 bundle.js:+9235180, +3005326, +3005348, +3005373, +3005400, +3005438, +3005464

---

### Usage Data Fetch — `usageFetcher` (`wXH`)

```
async function usageFetcher(orgUUID, authToken):
    try:
        response = await httpClient.get('/api/oauth/usage')   // E9.get
        // label: 'api_usage_fetch'
        return parseUsageResponse(response)
    except AxiosError where status == 401:
        refreshToken()
        retryResponse = await httpClient.get('/api/oauth/usage')
        // appends ' (401→refresh→retry succeeded)' to log
        return parseUsageResponse(retryResponse)
    except error where 'no-auth':
        throw Error(...)
```

Analysis basis: CC v2.1.160 bundle.js:+9188522, +9188525, +9188557, +9188682, +9188799, +9188831, +9188932

---

### Admin Request Eligibility — `eligibilityChecker` (`QM1`)

```
async function eligibilityChecker(orgUUID, authToken):
    // label: 'api_admin_request_eligibility'
    // teleport-org header may be set
    response = await httpClient.get(eligibilityEndpoint)    // E9.get
    if response is error:
        throw Error(...)
    return response.data    // contains eligibility type, e.g. 'limit_increase'
```

Analysis basis: CC v2.1.160 bundle.js:+9188189, +9188192, +9188246, +9188340, +9188372

---

### Admin Request List — `adminRequestLister` (`gM1`)

```
async function adminRequestLister(orgUUID, authToken):
    // label: 'api_admin_request_list'
    response = await httpClient.get(adminRequestsEndpoint, { statuses: [...] })   // E9.get
    if response is error:
        throw Error(...)
    return response.data.requests
```

Analysis basis: CC v2.1.160 bundle.js:+9187838, +9187935, +9187944, +9187970, +9188074

---

### Admin Request Creation — `adminRequestCreator` (`FM1`)

```
async function adminRequestCreator(orgUUID, requestType, authToken):
    // label: 'api_admin_request_create'
    endpoint = '/api/oauth/organizations/:orgUUID/admin_requests'
    response = await httpClient.post(endpoint, { type: requestType })    // E9.post
    if response is error:
        throw Error(...)
    return response.data
```

Analysis basis: CC v2.1.160 bundle.js:+9187573, +9187576, +9187625, +9187724

---

### Error Normalizer — `axiosErrorNormalizer` (`cM1`)

```
function axiosErrorNormalizer(error):
    if c_.isAxiosError(error):
        statusCode = error.response.status
        if statusCode >= 500:
            return buildServerErrorMessage(error)
        detail = error.response.data.detail
        return detail ?? error.message
    return error.message
```

Analysis basis: CC v2.1.160 bundle.js:+9189052, +9189135, +9189341

---

### UI Outcome Rendering — `usageCreditUIHandler` (`HT8`)

```
async function usageCreditUIHandler(context):
    orgPlan = getOrgPlan(context)

    if orgPlan in ['team', 'enterprise']:
        userRole = getUserRole(context)    // checks admin/billing/owner/primary_owner

        if userRole not in ['admin', 'billing', 'owner', 'primary_owner']:
            showMessage('Contact your admin to manage usage credit settings.')
            showAdminSettingsURL('https://claude.ai/admin-settings/usage')
            openBrowserIfConfirmed()      // kK → vL7, MY, h8
            return

        usageData = await usageFetcher(orgUUID, token)

        if usageData.hasUnlimitedCredits:
            showMessage('Your organization already has unlimited usage credits. No request needed.')
            return

        eligibility = await eligibilityChecker(orgUUID, token)

        if eligibility.type == 'limit_increase':
            existingRequests = await adminRequestLister(orgUUID, token)
            hasPendingOrDismissed = existingRequests.some(
                r => r.status in ['pending', 'dismissed']
            )
            if hasPendingOrDismissed:
                showMessage("You've already sent a usage credit request to your admin.")
                return
            await adminRequestCreator(orgUUID, 'limit_increase', token)
            showMessage('Request sent to your admin to increase your usage credit limit.')
        else:
            await adminRequestCreator(orgUUID, eligibility.type, token)
            showMessage('Request sent to your admin to turn on usage credits.')

    else:
        // Personal plan — show personal usage URL
        openURL('https://claude.ai/settings/usage')   // kK → vL7
        emit('browser-opened')
```

Analysis basis: CC v2.1.160 bundle.js:+9189466, +9189477, +9189489, +9189506, +9189534, +9189563, +9189709, +9189725, +9189820, +9189884, +9190028, +9190050, +9190060, +9190119, +9190272, +9190358, +9190424, +9190495, +9190505, +9190562, +9190592, +9190725, +9190766, +9190833

---

### Auth / Credential Resolution — `credentialResolver` (`e3`)

```
function credentialResolver(config):
    // Checks for ANTHROPIC_API_KEY env var
    if env.ANTHROPIC_API_KEY is set:
        return { type: 'apiKey', value: env.ANTHROPIC_API_KEY }

    // Checks apiKeyHelper
    if config.apiKeyHelper and config.apiKeyHelper != 'none':
        return resolveViaHelper(config.apiKeyHelper)    // HD6

    // Checks OAuth token via file descriptor
    if env.CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR:
        key = readFileDescriptor(env.CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR)   // w$6 → yLq
        return { type: 'fileDescriptorKey', value: key }

    // Checks OAuth token
    if env.CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR:
        token = readFileDescriptor(env.CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR)   // Kr → yLq
        return { type: 'oauth', value: token }

    throw Error('ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, CLAUDE_CODE_OAUTH_TOKEN, or WIF env vars required')
```

Analysis basis: CC v2.1.160 bundle.js:+2986555, +2988282, +2988369, +2988450, +2988463, +2988502, +2988561, +2988614, +2988815, +2988826, +2988832, +2989068, +2989354, +2109545, +2109688

---

### Experiment / Feature-Flag Tracking — `experimentTracker` (`W6`)

```
function experimentTracker(featureKey, context):
    if WDH.has(featureKey):
        return WDH.get(featureKey)         // cached result

    result = fetchExperimentVariant(featureKey)   // px → mx → BR
    if result is valid:
        HA8(featureKey, result)            // deduplicate + emit GrowthbookExperimentEvent
    tD6.add(featureKey)
    if SU.has(featureKey):
        return SU.get(featureKey)
    return logAndRecord(featureKey, result)   // R6
```

Analysis basis: CC v2.1.160 bundle.js:+3224808, +3224845, +3224880, +3224897, +3224908, +3224920, +3224934, +3224951, +3224971

---

### Browser Opener — `browserOpener` (`kK`)

```
function browserOpener(url):
    if url scheme not in ['http:', 'https:']:
        throw Error('invalid protocol')    // vL7

    platform = process.platform
    if platform == 'darwin':
        spawn('open', [url])
    elif platform == 'win32':
        spawn('rundll32', ['url,OpenURL', url])
    else:
        spawn('xdg-open', [url])           // MY, h8
```

Analysis basis: CC v2.1.160 bundle.js:+6749865, +6749915, +6749937, +6750152, +6750165, +6750224, +6750240, +6750273, +6750324, +6750336, +6750398, +6750405

---

### HTTP Request Builder — `apiRequestBuilder` (`N`)

```
function apiRequestBuilder(endpoint, options):
    // logs '[Bootstrap] Fetching'
    headers = {
        'Content-Type': 'application/json',
        'User-Agent': ...,
        ...options.headers
    }
    // timeout: 5000 ms
    // redacts sensitive values to '[REDACTED]' in debug logs
    // emits 'api_bootstrap_fetch' on completion or 'parse_failed' on parse error
    // logs '[Bootstrap] Fetch ok' on success
    return httpRequest(endpoint, { headers, timeout: 5000 })
```

Analysis basis: CC v2.1.160 bundle.js:+15451798, +15451800, +15451885, +15451900, +15451919, +15451991, +15452000, +15452109, +15452112, +15452134, +15452164

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_ember_latch` | Fired during experiment/feature-flag tracking (`W6`). Analysis basis: CC v2.1.160 bundle.js:+9235143 |
| Telemetry: `tengu_feature_ok` | Fired when a feature flag lookup succeeds. Analysis basis: CC v2.1.160 bundle.js:+966123 |
| Telemetry: `tengu_feature_bad` | Fired when a feature flag lookup fails. Analysis basis: CC v2.1.160 bundle.js:+966181 |
| Telemetry: `api_usage_fetch` | Label attached to OAuth usage endpoint GET call. Analysis basis: CC v2.1.160 bundle.js:+9188525 |
| Telemetry: `api_admin_request_eligibility` | Label attached to eligibility GET call. Analysis basis: CC v2.1.160 bundle.js:+9188192 |
| Telemetry: `api_admin_request_list` | Label attached to existing-request list GET call. Analysis basis: CC v2.1.160 bundle.js:+9187841 |
| Telemetry: `api_admin_request_create` | Label attached to new admin request POST. Analysis basis: CC v2.1.160 bundle.js:+9187576 |
| Telemetry: `api_bootstrap_fetch` | Label attached to bootstrap HTTP fetches. Analysis basis: CC v2.1.160 bundle.js:+9188525, +15452112 |
| Telemetry: `growthbook_experiment` | Event emitted via `Ur.emit` when an experiment result is recorded. Analysis basis: CC v2.1.160 bundle.js:+3218862 |
| Telemetry: `GrowthbookExperimentEvent` | Event class used during experiment deduplication. Analysis basis: CC v2.1.160 bundle.js:+3218435 |
| Telemetry: `browser-opened` | Emitted after the personal-plan URL is opened in the browser. Analysis basis: CC v2.1.160 bundle.js:+9190833 |
| Network side effect | GET `/api/oauth/usage` — reads current usage data. |
| Network side effect | GET eligibility endpoint — checks org's eligibility for credits. |
| Network side effect | GET admin requests list endpoint — reads existing requests. |
| Network side effect | POST `/api/oauth/organizations/:orgUUID/admin_requests` — creates new admin request. |
| Login flow | When plan is not `pro`/`max`, a full OAuth login sequence is started (`W6`), which generates a random 32-byte hex session token (`iQq.randomBytes`, length 32) and a UUID (`zY_.randomUUID`). Analysis basis: CC v2.1.160 bundle.js:+3251213, +3251229, +3251242, +3218472 |
| `onChangeAPIKey` callback | Invoked via `_.onChangeAPIKey` after a successful fresh login. Analysis basis: CC v2.1.160 bundle.js:+9235465 |
| `flagSettings` state | Read during credential resolution flow (`sN`). Analysis basis: CC v2.1.160 bundle.js:+2989437 |
| Error logging | `mi.logError` is called for unexpected errors during streaming/processing. Analysis basis: CC v2.1.160 bundle.js:+971861 |
| History queue | Managed via `lF6.shift` / `lF6.push` by the history-management helper (`T14`). Analysis basis: CC v2.1.160 bundle.js:+971141, +971153 |
| Browser OS dispatch | Opens URLs using `open` (macOS), `rundll32 url,OpenURL` (Windows), or `xdg-open` (Linux). Analysis basis: CC v2.1.160 bundle.js:+6750224, +6750240, +6750398, +6750405 |
| OAuth token revocation detection | 401/403 responses with message `"OAuth token has been revoked"` are specially handled. Analysis basis: CC v2.1.160 bundle.js:+3021963, +3021991, +3022057 |

---

## Version History

| Version | Change |
|---|---|
| v2.1.160 | Initial analysis |

---

## Common Mistakes

1. **Running `/usage-credits` on a non-`pro`/`max` plan without expecting a login prompt.** The command silently initiates a full OAuth login flow if the current session does not have a `pro` or `max` plan. Users who press Ctrl-C to abort will see "Login interrupted" and the command will exit without making any changes. Analysis basis: CC v2.1.160 bundle.js:+9235107, +9235118, +9235363, +9235507

2. **Expecting the command to work for non-admin personal-plan users in an org.** Users whose role is not `admin`, `billing`, `owner`, or `primary_owner` receive only an informational message directing them to contact their admin — no request is submitted on their behalf. Analysis basis: CC v2.1.160 bundle.js:+9189884, +2092727, +2092735, +2092745, +2092753

3. **Triggering the command repeatedly after a request has already been submitted.** The command checks for existing requests in `pending` or `dismissed` state before creating a new one and will show a "You've already sent a usage credit request" message rather than submitting a duplicate. Analysis basis: CC v2.1.160 bundle.js:+9190050, +9190060, +9190119

4. **Assuming the command can act on `team`/`enterprise` orgs that already have unlimited credits.** If the org already has unlimited usage credits, the command exits immediately with an informational message and does not attempt any API write. Analysis basis: CC v2.1.160 bundle.js:+9189725

5. **Using the command in a non-OAuth environment.** The entire flow depends on OAuth tokens and the `/api/oauth/usage` endpoint. In environments relying solely on `ANTHROPIC_API_KEY` without OAuth, the credential resolver may not reach the OAuth path and behavior may be undefined beyond the credential-resolution step. Analysis basis: CC v2.1.160 bundle.js:+2988826, +2988832, +9188689

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `YV6` | Main handler (`usageCreditsHandler`) — AsyncFunction entry point for `/usage-credits` |
| `z1` | Credential/auth context builder — assembles auth state for downstream calls |
| `g9_` | Auth context sub-helper A (called by `z1`) |
| `F9_` | Auth context sub-helper B (called by `z1`) |
| `bD` | Auth provider selector — routes between apiKey / OAuth / Bedrock / Vertex / etc. |
| `eK` | Environment variable reader |
| `FH` | React/JSX element factory or render helper |
| `hJ` | OAuth token resolver — reads `CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR`, `profile-implicit`, `user_oauth` |
| `$o6` | OAuth config sub-helper |
| `cQH` | Auth context composer |
| `Kr` | OAuth token file-descriptor reader (reads `CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR`) |
| `sN` | Flag-settings reader (`flagSettings`) |
| `IR` | Array inclusion checker |
| `bM` | Cloud provider checker (Bedrock / Foundry / Vertex / Mantle) |
| `jA` | Provider constant mapper |
| `jP` | Auth header builder |
| `e3` | Credential resolution orchestrator |
| `HD6` | `apiKeyHelper` resolver |
| `uuH` | VSCode environment detector (`claude-vscode`) |
| `w$6` | API key file-descriptor reader (`CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR`) |
| `R6` | Telemetry/event recorder |
| `kR` | Array slicer (slices up to 20 items) |
| `AD6` | Auth context wrapper |
| `uG` | Plan/subscription getter |
| `W6` | Experiment tracker / login-flow coordinator |
| `HY6` | Experiment variant fetcher A |
| `_Y6` | Experiment variant fetcher B |
| `px` | API endpoint builder |
| `mx` | HTTP client wrapper |
| `BR` | Network request dispatcher |
| `HA8` | Experiment result deduplicator (uses `jY_` Set and `WDH` Map) |
| `wY_` | Experiment event emitter (emits `GrowthbookExperimentEvent`) |
| `vVH` | Growthbook feature evaluator |
| `kU` | Session token generator (32-byte hex random + UUID) |
| `SH` | JSON serializer wrapper |
| `TjL` | Experiment result persistence helper |
| `WY_` | Experiment assignment storer |
| `dSq` | Request-hash helper |
| `l_` | Logging pipe helper |
| `CQq` | Assignment cache setter |
| `Ce` | Feature-flag set checker (`F64.has`) |
| `YDH` | Subscription type resolver |
| `fL` | Stripe/store subscription resolver |
| `EA` | API-response subscription resolver |
| `n9` | Network-class/traffic-tier resolver (`essential-traffic`, `no-telemetry`, `default`) |
| `KNA` | Network-class string normalizer |
| `HT8` | Usage-credit UI orchestrator (main branching logic) |
| `wx` | Org-role permission checker (admin/billing/owner/primary_owner) |
| `wXH` | Usage data fetcher wrapper (`api_usage_fetch`) |
| `Z1` | Feature-flag gate evaluator |
| `_` | Feature-flag key constant holder |
| `hH` | Feature-flag "ok" path handler |
| `RH` | Feature-flag "bad" path handler |
| `TV` | Org-plan type filter (team/enterprise/includes check) |
| `H` | Bootstrap HTTP fetch orchestrator |
| `zE` | OAuth error handler (401/403 token-revocation detection) |
| `$U` | Token-refresh cache manager (`UO_` Map) |
| `N` | HTTP request builder (`apiRequestBuilder`) |
| `lmK` | Request header assembler |
| `x4` | API key redactor (`[REDACTED]`) |
| `PmH` | User-agent string builder |
| `rmK` | Request body/file processor |
| `QM1` | Admin request eligibility checker (`api_admin_request_eligibility`) |
| `gM1` | Admin request lister (`api_admin_request_list`) |
| `A` | HTTP response object (lowercase headers via `f.toLowerCase`) |
| `f` | HTTP connection/socket object |
| `FM1` | Admin request creator (`api_admin_request_create`) |
| `cM1` | Axios error normalizer |
| `Fz` | UI state setter for command result |
| `GH` | String coercion wrapper |
| `yH` | Streaming response processor |
| `d_` | Error/String dual coercer |
| `T14` | History queue manager (`lF6.shift` / `lF6.push`) |
| `kK` | Browser opener (OS-aware: `open` / `rundll32` / `xdg-open`) |
| `vL7` | URL protocol validator |
| `MY` | Child-process spawn wrapper |
| `h8` | Process execution helper |
| `v_` | Agent/session run loop |
| `S6` | Session state initializer |