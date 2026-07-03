---
type: feature-spec
feature: "usage-credits"
cc_version: "2.1.199"
updated: "2026-07-03"
tags: ["usage-credits", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.199 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/usage-credits`

> Analysis basis: CC v2.1.199 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.199

---

## Overview

`/usage-credits` is an interactive JSX-rendered slash command that helps users resolve usage-credit exhaustion or cap conditions by checking their organization's current credit status and, where applicable, submitting an admin escalation request or opening the appropriate web settings page. It operates against the Anthropic OAuth API to inspect subscription state, outstanding admin requests, and plan-level entitlements, then guides the user to the correct remediation path.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `usage-credits` |
| description | `Configure usage credits to keep working when you hit a limit` |
| loc_byte | `9853973` |
| loc_byte_end | `9854183` |
| loc_line | `3857` |
| module_id | `GOo` |
| load_inline | `true` |
| arbor_handler.name | `tXt` |
| arbor_handler.fqn | `claude-2.1.199::tXt` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.199 bundle.js:+9853973

---

## Input Branching

The command has five or more distinct outcome branches (unlimited credits already active, out-of-credits, spend-cap reached, limit-increase needed, disabled-until date, existing pending request, non-eligible org) and therefore requires a flowchart.

```mermaid
flowchart TD
    A(["/usage-credits invoked"]) --> B{Check auth & subscription type}
    B -->|No OAuth / non-first-party| Z1["Exit: prompt login / unsupported"]
    B -->|Plan = 'pro' or 'max'| C{Fetch /api/oauth/usage}
    B -->|Plan = 'team' or 'enterprise'| C
    C -->|HTTP error 401| D["Refresh token → retry\n(401→refresh→retry succeeded)"]
    D --> C
    C -->|HTTP error 403 / token revoked| Z2["Exit: show auth-revoked error"]
    C -->|Success| E{Inspect credit status field}
    E -->|Unlimited credits active| Z3["Display: 'Your organization already has unlimited usage credits. No request needed.'"]
    E -->|'out_of_credits'| F["Display: 'Your organization is out of usage credits. Contact your admin to add more.'"]
    E -->|'org_spend_cap_reached'| G["Display: 'Your organization\u2019s usage credit cap is reached for this period. Contact your admin to raise it.'"]
    E -->|'org_level_disabled_until' set| H["Display disabled-until date message"]
    F --> I{User is admin-eligible?}
    G --> I
    H --> I
    I -->|Not eligible| Z4["Display: 'Contact your admin to manage usage credit settings.'"]
    I -->|Eligible| J{Check existing admin requests\n(GET /api/oauth/organizations/:orgUUID/admin_requests)}
    J -->|Pending or dismissed request exists| Z5["Display: 'You\u2019ve already sent a usage credit request to your admin.'"]
    J -->|No existing request| K{Request type}
    K -->|Limit increase needed| L["POST /api/oauth/organizations/:orgUUID/admin_requests\nrequest_type = 'limit_increase'"]
    K -->|Credits disabled| M["POST /api/oauth/organizations/:orgUUID/admin_requests\nrequest_type = credits-enable"]
    L -->|Success| Z6["Display: 'Request sent to your admin to increase your usage credit limit.'"]
    M -->|Success| Z7["Display: 'Request sent to your admin to turn on usage credits.'"]
    L -->|Error ≥500| Z8["Show API error detail"]
    M -->|Error ≥500| Z8
    Z6 --> N{Open browser?}
    Z7 --> N
    Z3 --> N
    N -->|Admin user| O["Open https://claude.ai/admin-settings/usage"]
    N -->|Regular user| P["Open https://claude.ai/settings/usage\n(browser-opened)"]
    O --> Q([Done])
    P --> Q
    Z1 --> Q
    Z2 --> Q
    Z4 --> Q
    Z5 --> Q
    Z8 --> Q
```

Analysis basis: CC v2.1.199 bundle.js:+9811096, +9811150, +9811471, +9811516, +9811598, +9811629, +9811859, +9812018, +9812184, +9812492, +9812558, +9812859, +9812900, +9812967

---

## Behavioral Spec

### 1. Handler Entry and Initialization (`tXt`)

```
async function handleUsageCredits(context):
    render JSX container (via BOo.jsx)
    initialize appState reference
    retrieve subscription/plan details via getSubscriptionInfo()
    determine auth mode (firstParty OAuth required)
    if auth mode is not firstParty:
        display login prompt
        initiate new login flow:
            print "Starting new login following /usage-credits. Exit with Ctrl-C to use existing account."
        return
    proceed to fetchAndDisplayUsageStatus(context)
```

Analysis basis: CC v2.1.199 bundle.js:+9852182, +9852195, +9852231, +9852266, +9852288, +9852610

---

### 2. Plan and Subscription Check (`checkPlanEligibility` → `QYt`, `lke`)

```
function checkPlanEligibility(session):
    planType = session.plan   // "pro", "max", "team", "enterprise"
    if planType not in ["pro", "max", "team", "enterprise"]:
        return INELIGIBLE

    subscriptionSource = getSubscriptionSource(session)
    // sources: "stripe_subscription", "stripe_subscription_contracted",
    //          "apple_subscription", "google_play_subscription"

    emit telemetry: tengu_ember_latch

    return { eligible: true, planType, subscriptionSource }
```

Analysis basis: CC v2.1.199 bundle.js:+9811096, +9811110, +9811150, +9811161, +9811169, +9811177, +9811261, +9811273, +3140568, +3140595, +3140633, +3140659

---

### 3. Usage Data Fetch (`fetchUsageStatus` → `Hpe`)

```
async function fetchUsageStatus(authToken):
    try:
        response = await httpGet(
            url     = "/api/oauth/usage",
            timeout = 5000,
            headers = { "Content-Type": "application/json" },
            auth    = authToken
        )
        return response.data

    catch error where status == 401:
        refreshToken()
        retry once
        append " (401→refresh→retry succeeded)" to log
        return retried response

    catch error where status == 403 OR message contains "OAuth token has been revoked":
        throw AUTH_REVOKED

    catch error (isAxiosError):
        throw FETCH_ERROR
```

Analysis basis: CC v2.1.199 bundle.js:+5353715, +5353750, +5353787, +5353804, +5353875, +5353882, +5353910, +5353924, +5353939, +5354024, +5354125, +3158425, +3158486, +3158514, +3158580

---

### 4. Credit Status Evaluation (`evaluateCreditStatus` → `So`, `Oi`)

```
function evaluateCreditStatus(usageData):
    status = usageData.status

    match status:
        case "out_of_credits":
            return {
                type: OUT_OF_CREDITS,
                message: "Your organization is out of usage credits. Contact your admin to add more."
            }

        case "org_spend_cap_reached":
            return {
                type: SPEND_CAP_REACHED,
                message: "Your organization's usage credit cap is reached for this period. Contact your admin to raise it."
            }

        case where "org_level_disabled_until" field is set:
            return {
                type: DISABLED_UNTIL,
                disabledUntil: usageData.org_level_disabled_until
            }

        case UNLIMITED (no cap):
            return {
                type: UNLIMITED,
                message: "Your organization already has unlimited usage credits. No request needed."
            }

        default:
            return { type: UNKNOWN }
```

Analysis basis: CC v2.1.199 bundle.js:+9811471, +9811500, +9811516, +9811598, +9811629, +9811681, +9811859, +3140017

---

### 5. Admin Request Eligibility Check (`checkAdminEligibility` → `Ibl`)

```
async function checkAdminEligibility(orgUUID, authToken):
    response = await httpGet(
        endpoint = "api_admin_request_eligibility",
        orgUUID  = orgUUID
    )
    if response.org == "teleport-org":
        return INELIGIBLE   // teleport orgs cannot self-serve
    return response.eligible
```

Analysis basis: CC v2.1.199 bundle.js:+9810375, +9810378, +9810432, +9810526, +9810558

---

### 6. Existing Admin Requests Check (`listAdminRequests` → `Tbl`)

```
async function listAdminRequests(orgUUID, authToken):
    response = await httpGet(
        endpoint = "api_admin_request_list",
        params   = { statuses: ["pending", "dismissed"] }
    )
    existing = response.requests
    if existing has any with status "pending" OR "dismissed":
        return {
            hasExisting: true,
            message: "You've already sent a usage credit request to your admin."
        }
    return { hasExisting: false }
```

Analysis basis: CC v2.1.199 bundle.js:+9810024, +9810027, +9810121, +9810130, +9810156, +9812184, +9812194, +9812253

---

### 7. Admin Request Submission (`submitAdminRequest` → `bbl`)

```
async function submitAdminRequest(orgUUID, requestType, authToken):
    // requestType: "limit_increase" or credits-enable
    response = await httpPost(
        url  = "/api/oauth/organizations/:orgUUID/admin_requests",
        body = { type: requestType }
    )

    if response.status >= 500:
        errorDetail = response.data.detail
        displayError(errorDetail)
        return FAILURE

    if requestType == "limit_increase":
        display "Request sent to your admin to increase your usage credit limit."
    else:
        display "Request sent to your admin to turn on usage credits."

    return SUCCESS
```

Analysis basis: CC v2.1.199 bundle.js:+9809759, +9809762, +9809811, +9809819, +9809910, +9810783, +9810989, +9811954, +9812018, +9812492, +9812558

---

### 8. Error Classification for API Responses (`classifyApiError` → `vbl`)

```
function classifyApiError(error):
    if isAxiosError(error):
        if error.response.status == 429:
            return RATE_LIMITED
        if error.response.status >= 500:
            return SERVER_ERROR
        return CLIENT_ERROR
    return UNKNOWN_ERROR
```

Analysis basis: CC v2.1.199 bundle.js:+9810700, +186682, +186794, +500 (literal at +9810783)

---

### 9. Browser Open (`openSettingsUrl` → `Rc` → `RJr` → `kOi`)

```
async function openSettingsUrl(isAdmin):
    if isAdmin:
        url = "https://claude.ai/admin-settings/usage"
    else:
        url = "https://claude.ai/settings/usage"

    validate url (must start with "http:" or "https:")
    if invalid:
        throw { code: "invalid_url" }

    if platform == "darwin":
        exec "open <url>"
    elif platform has DISPLAY:
        exec platform browser command
    else:
        return { result: "no_display" }

    emit status "browser-opened"
```

Analysis basis: CC v2.1.199 bundle.js:+9812859, +9812900, +9812967, +3180447, +3180497, +3180519, +3181653, +3181689, +3181757, +3181798, +3181839, +3181900, +3181942, +3181979

---

### 10. Login Flow Triggered by `/usage-credits` (`triggerLogin` → `mNe`)

When the session lacks a valid OAuth token and the user invokes this command, the handler triggers a new login sequence:

```
async function triggerLogin(context):
    print "Starting new login following /usage-credits. Exit with Ctrl-C to use existing account."
    result = await startOAuthLogin()
    if result == SUCCESS:
        display "Login successful"
        apply new API key via onChangeAPIKey
        update appState
        relaunch with execRelaunch
    else:
        display "Login interrupted"
        emit telemetry: authentication_failed
```

Analysis basis: CC v2.1.199 bundle.js:+9852610, +9852729, +9852810, +9852829, +9806178, +9806197, +9806453, +9807658

---

### 11. App State Side-Effects After Auth Change (`applyAuthChange` → `mNe`)

```
async function applyAuthChange(newCredentials, context):
    emit "update" message op via applyMessageOp
    refresh feature flags via refreshFeatures
    reload remote managed settings (xDn)
    reload policy limits (JYt)
    clear feature cache: (bke, vDn, mBt, YZr, _q) via clearCaches
    reinitialize trusted-device enrollment (dqt) if applicable
    notify kD.notifyChange (policySettings)
    push credential history (Gku: ahn.shift / ahn.push)
    log errors via fne.logError if enrollment fails
```

Analysis basis: CC v2.1.199 bundle.js:+9806197, +9806220, +9806347, +9806354, +9806431, +9806482, +9806566, +9806603, +9806609, +9806615, +9806648, +9806818, +9806991, +9807123, +9807162, +9807265, +9807277, +9807313, +9807348, +9807352, +9807386, +9807392

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_ember_latch` | Fired during subscription/plan check at bundle.js:+9811113 |
| Telemetry: `tengu_feature_ok` | Fired on successful feature flag evaluation at bundle.js:+1039941 |
| Telemetry: `tengu_feature_bad` | Fired on failed feature flag evaluation at bundle.js:+1040008 |
| Telemetry: `tengu_managed_settings_security_dialog_shown` | Fired when remote managed-settings security dialog is displayed at bundle.js:+8105011 |
| Telemetry: `tengu_managed_settings_security_dialog_accepted` | Fired on acceptance at bundle.js:+8105348 |
| Telemetry: `tengu_managed_settings_security_dialog_rejected` | Fired on rejection at bundle.js:+8105507 |
| Telemetry: `tengu_policy_limits_fetch` | Fired during policy limits reload at bundle.js:+14360854 |
| Telemetry: `tengu_disable_bypass_permissions_mode` | Fired if bypass-permissions mode is disabled post-auth at bundle.js:+14235453 |
| Telemetry: `tengu_auto_mode_config` | Fired on auto-mode configuration evaluation at bundle.js:+14233139 |
| Telemetry: `tengu_daemon_config_reload` | Fired on daemon config reload at bundle.js:+18546460 |
| HTTP side-effect | `GET /api/oauth/usage` (timeout 5000 ms) |
| HTTP side-effect | `GET /api/oauth/organizations/:orgUUID/admin_requests?statuses=pending,dismissed` |
| HTTP side-effect | `POST /api/oauth/organizations/:orgUUID/admin_requests` (conditional) |
| appState changes | `onChangeAPIKey`, `setAppState`, `applyMessageOp` triggered on login success |
| Hook registration | `bfs.register` called via `Ai` at bundle.js:+69837 |
| Feature flag caches cleared | `bke`, `vDn`, `mBt`, `YZr`, `_q` cleared on auth change |
| Browser opened | `https://claude.ai/admin-settings/usage` (admin) or `https://claude.ai/settings/usage` (user) |
| Process relaunch | `execRelaunch` called after successful new login |
| Interval management | `GDn` (setInterval/clearInterval) used for background remote-settings polling |
| Sound | `<!-- TODO: not found in depth-2 traversal; needs --depth 4 -->` |

---

## Version History

| Version | Change |
|---|---|
| v2.1.199 | Initial analysis |

---

## Common Mistakes

1. **Invoking on a non-OAuth session**: The command requires a first-party OAuth token. Running it while authenticated via `ANTHROPIC_API_KEY` or a third-party provider will trigger a full re-login prompt rather than showing credit status.
2. **Expecting immediate credit restoration**: The command submits an admin request; it does not itself grant or restore credits. The admin must act on the request separately.
3. **Teleport-org accounts**: Organizations identified as `teleport-org` are silently ineligible for self-service admin requests. The command shows only a contact-admin message with no submit button.
4. **Duplicate request submission**: If a `pending` or `dismissed` admin request already exists, a new POST is blocked. The command displays `"You've already sent a usage credit request to your admin."` and does not create a duplicate.
5. **Browser not opening on headless servers**: On Linux hosts without a display (`DISPLAY` not set), the URL open attempt returns `no_display` rather than throwing an error. The URL is still displayed in the terminal.
6. **Unlimited organizations**: If the organization already has unlimited credits, the command reports this immediately and takes no further action. No admin request is created.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `tXt` | Main async handler for `/usage-credits` (arbor_handler) |
| `QYt` | Subscription/plan eligibility orchestrator |
| `Oi` | OAuth session / auth-mode inspector |
| `c6r` | Auth credential reader (sub-helper of `Oi`) |
| `l6r` | Auth credential loader (sub-helper of `Oi`) |
| `EE` | Session state aggregator |
| `Md` | Config accessor with `--bare` flag support |
| `bb` | Profile/subscription record builder |
| `ic` | First-party auth type classifier |
| `wI` | Auth-mode selector |
| `Jw` | API key / token resolver |
| `m2t` | Subscription-type mapper (sub-helper) |
| `slt` | Auth-state serializer |
| `B0` | Plan-type constant set |
| `ot` | Feature-flag evaluator |
| `hBt` | Feature flag "has" check helper |
| `HBt` | Feature flag "get" check helper |
| `HG` | GrowthBook feature context getter |
| `hG` | Feature payload reader |
| `wDn` | Feature flag cache lookup and write |
| `KZr` | Feature experiment event emitter |
| `eeo` | Feature payload serializer |
| `Mt` | Config access guard (throws "Config accessed before allowed.") |
| `BJo` | Config backend reader |
| `GJo` | Config backend writer |
| `hae` | Config change notifier |
| `lke` | Subscription source normalizer (stripe, apple, google-play) |
| `Fc` | Session/token validator |
| `So` | Credit-status evaluator |
| `c9` | Array-inclusion type check |
| `Pi` | Telemetry pipeline entry |
| `KTs` | Telemetry event formatter |
| `at` | String coercion utility |
| `GSt` | Usage-status orchestrator (fetch + evaluate + display) |
| `_b` | Auth-mode branch selector |
| `Hpe` | `/api/oauth/usage` HTTP fetcher |
| `kl` | HTTP client factory |
| `Le` | HTTP response decoder |
| `we` | HTTP error wrapper |
| `Gw` | HTTP response type-guard |
| `e` | String replace utility |
| `AR` | Axios error handler (401/403/revoked) |
| `O$` | Token refresh cache manager |
| `T` | Logging / debug output sink |
| `gdu` | Debug formatter |
| `xe` | JSON serializer |
| `Nc` | Log-line sanitizer (redacts secrets) |
| `ntt` | Log theme selector |
| `Sdu` | Log file writer (process.on exit) |
| `o` | Column formatter (padEnd) |
| `Ibl` | Admin-request eligibility checker |
| `Tbl` | Admin-request list fetcher |
| `n` | HTTP header builder (toLowerCase) |
| `i` | HTTP connection lifecycle manager |
| `bbl` | Admin-request POST submitter |
| `vbl` | Axios error classifier for admin-request errors |
| `j_` | Status message renderer |
| `ge` | String cast (String()) |
| `ke` | Error formatter + credential history manager |
| `sr` | Error string coercer |
| `Gku` | Credential history ring-buffer (shift/push) |
| `Rc` | URL open orchestrator |
| `RJr` | URL validator + OS dispatcher |
| `c6d` | URL parse error handler |
| `kOi` | Platform-specific open command executor |
| `mNe` | Post-login / auth-change side-effect applier |
| `het` | Timestamp generator (Date.now) |
| `gr` | Gateway/provider classifier |
| `Vm` | Provider type union |
| `qqe` | Remote managed-settings manager |
| `kXa` | Remote settings initializer |
| `Wqe` | Remote settings transport |
| `tPs` | Remote settings transport helper |
| `fZ` | Remote settings fetch executor |
| `ice` | Remote settings cache reader |
| `sce` | Remote settings cache writer |
| `mBe` | Remote settings diff comparator |
| `gu` | Remote settings watcher |
| `lA` | Remote settings load helper A |
| `h2t` | Remote settings load helper B |
| `YVn` | Policy-settings notifier |
| `nPs` | Policy-settings notifier helper |
| `Qvo` | Remote settings polling orchestrator |
| `CXa` | Remote settings consent dialog |
| `_Xa` | Remote settings load-timeout handler |
| `two` | Remote settings apply-and-cache |
| `TLe` | Remote settings cache lookup |
| `kNr` | Remote settings cache entry reader |
| `ePs` | Remote settings event emitter |
| `dVn` | Remote settings hash generator (sha256) |
| `uJp` | Remote settings config merger |
| `Ort` | Remote settings cache entry cleaner |
| `Jvo` | Remote settings batch applier |
| `qe` | Generic event emitter (GZe) |
| `TXa` | Remote managed-settings security check orchestrator |
| `yXa` | Security approval dialog renderer |
| `EXa` | Security approval result handler |
| `IXa` | Remote settings atomic file writer |
| `LXa` | Remote settings ez-cache writer |
| `xXa` | Remote settings background-poll loop |
| `GDn` | Interval manager (setInterval/clearInterval) |
| `pJp` | Remote settings background-poll step |
| `Ai` | BFS hook registrar |
| `eer` | Deep-equality checker for auth state |
| `_Cr` | Auth-state previous-value reference |
| `kn` | App config initializer |
| `iyn` | App config section loader |
| `t9` | App config field binder |
| `f` | Process path resolver |
| `yV` | Path normalizer (replaceAll, normalize) |
| `rer` | Auth-change reaction orchestrator |
| `$cn` | Auth token cache clearer |
| `pq` | Pending-queue flusher |
| `hbl` | COo cache clearer |
| `fue` | Feature-usage cache resetter |
| `ike` | Credential store invalidator |
| `mbl` | Message backlog clearer |
| `wOo` | OAuth context resetter |
| `xDn` | Feature-flag full reload on auth change |
| `$6i` | Feature-flag payload diffuser |
| `B6i` | Feature-flag key-snapshot builder |
| `W4` | Global config reloader |
| `bXa` | Config field loader (at / gV) |
| `gV` | Config field presence checker |
| `zHt` | Remote config section merger |
| `QXp` | Remote config merge helper A |
| `JXp` | Remote config merge helper B |
| `XXp` | Remote config merge helper C |
| `eJp` | Remote config merge helper D |
| `KXp` | Remote config merge helper E |
| `HT` | Flag-settings applier |
| `hBe` | Flag-settings reader |
| `rPn` | Config reload side-effect A |
| `zUr` | CA certificates cache clearer |
| `QUr` | mTLS configuration cache clearer |
| `_1t` | Proxy agent cache clearer |
| `q9e` | Network stack reinitializer |
| `sD` | Network stack selector |
| `kKs` | Network config field binder |
| `MV` | Proxy URL parser |
| `JYt` | Policy-limits reload orchestrator |
| `vJo` | Policy-limits in-flight deduplicator |
| `LJo` | Policy-limits in-flight set |
| `IEe` | Policy-limits eligibility gate |
| `Dgr` | Policy-limits timeout handler |
| `s2` | Policy-limits HTTP fetcher |
| `Lke` | Policy-limits cache file path builder |
| `Ogr` | Policy-limits apply orchestrator |
| `cbc` | Policy-limits apply + cache write |
| `ubc` | Policy-limits background poll |
| `uke` | Policy-limits teardown helper |
| `kue` | Feature-flag teardown orchestrator |
| `qlt` | Feature-flag cache mass-clear |
| `neo` | Feature-flag interval/listener cleaner |
| `H9t` | Trusted-device re-enrollment gate |
| `JCo` | Session context builder |
| `qr` | React state store |
| `$ln` | React reducer binder |
| `ROe` | React subscription helper |
| `Cl` | Credential storage manager |
| `Mhi` | Credential read/write/delete orchestrator |
| `dqt` | Trusted-device enrollment orchestrator |
| `r2` | Feature-flag-gated enrollment gate |
| `W6i` | Feature-flag enrollment check |
| `ZYp` | Session-state snapshot helper |
| `qCo` | Auth-context builder for enrollment |
| `r` | Process exit handler wrapper |
| `Ts` | CLI error exit dispatcher |
| `Fs` | API base URL builder |
| `OTs` | API base URL reader |
| `Oku` | API environment selector |
| `uhn` | Trusted-device enrollment HTTP helper |
| `Hbl` | Trusted-device enrollment result handler |
| `zYt` | OAuth credential refresher |
| `oer` | OAuth token validity checker |
| `teo` | OAuth token feature-flag gate |
| `Cqt` | OAuth credential writer |
| `qH` | Permission-state updater |
| `Or` | Session context last-message finder |
| `Msr` | Voice/audio provider reader A |
| `vo` | Voice/audio provider |
| `Dsr` | Voice/audio provider reader B |
| `wR` | Bypass-permissions mode enforcer |
| `Feo` | Bypass-permissions feature check |
| `kOo` | App-state notification helper |
| `YYt` | Auto-mode gate evaluator |
| `XYt` | Auto-mode config loader |
| `iJ` | Auto-mode daemon start helper |
| `XXo` | Auto-mode plan eligibility check |
| `YXo` | Auto-mode transport selector |
| `ks` | Auto-mode session context reader |
| `tEe` | Auto-mode model compatibility check |
| `zUe` | Auto-mode disabled-reason reporter |
| `Grn` | Auto-mode circuit-breaker evaluator |
| `d` | Supervisor config updater |
| `Zat` | Auto-mode string coercer |
| `ste` | Auto-mode start sequencer |
| `R3` | Auto-mode session validator |
| `ASe` | Permission-mode change event emitter |
| `ACe` | Permission-map updater |
| `$St` | Last-assistant-message finder |
| `Uv` | Message history scanner (findLast) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.