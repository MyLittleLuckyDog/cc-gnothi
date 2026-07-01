---
type: feature-spec
feature: "usage-credits"
cc_version: 2.1.197
updated: "2026-06-30"
tags: ["usage-credits", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.196
analysis_basis: "CC v2.1.196 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/usage-credits`

> Analysis basis: CC v2.1.196 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.196

---

## Overview

`/usage-credits` is a local-JSX interactive command that helps users configure or request usage credits when they have hit an organization-level usage limit. It inspects the current account and organization credit state, determines whether the user is eligible to request a limit increase or enable credits, and either submits that request automatically or guides the user to the appropriate admin settings URL. If no authenticated session is present, it initiates a new OAuth login flow before proceeding.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `usage-credits` |
| description | Configure usage credits to keep working when you hit a limit |
| module_id | `JLo` |
| load_inline | `true` |
| loc_byte | `9305304` |
| loc_byte_end | `9305514` |
| loc_line | `3671` |
| arbor_handler.name | `fKt` |
| arbor_handler.fqn | `claude-2.1.196::fKt` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.196 bundle.js:+9305304

---

## Input Branching

The command has 5+ distinct execution paths based on authentication state, organization plan, and credit status. A Mermaid flowchart is required.

```mermaid
flowchart TD
    A[/usage-credits invoked] --> B{Active OAuth session?}
    B -- No --> C[Start new login flow\n'Starting new login following /usage-credits...']
    C --> D{Login succeeded?}
    D -- No --> Z1[Emit 'Login interrupted'\nReturn early]
    D -- Yes --> E[Emit 'Login successful']
    E --> F

    B -- Yes --> F{Check plan tier}
    F -- pro / max --> G[Check organization credit state]
    F -- team / enterprise --> G
    F -- other --> Z2[Show 'Contact your admin'\nmessage and exit]

    G --> H{Credit state?}
    H -- out_of_credits --> I[Message: org is out of credits\nContact admin]
    H -- org_spend_cap_reached\norg_level_disabled_until --> J{Check eligibility\nvia api_admin_request_eligibility}
    H -- unlimited credits --> K[Show: 'already has unlimited credits'\nNo action needed]
    H -- limit_increase eligible --> J

    J --> L{User is admin/billing/\nowner/primary_owner?}
    L -- Yes --> M[Open browser to\nhttps://claude.ai/admin-settings/usage]
    L -- No --> N{Existing pending/dismissed\nrequest? api_admin_request_list}
    N -- Already pending --> O[Show: 'already sent a request'\nNo duplicate sent]
    N -- No existing request --> P[POST api_admin_request_create\nto /api/oauth/organizations/:orgUUID/admin_requests]
    P --> Q{Request type?}
    Q -- limit_increase --> R[Show: 'Request sent to admin\nto increase your usage credit limit']
    Q -- credits enable --> S[Show: 'Request sent to admin\nto turn on usage credits']

    M --> T[Open browser: browser-opened]
    T --> U[For non-admin users:\nhttps://claude.ai/settings/usage]
```

Analysis basis: CC v2.1.196 bundle.js:+9262808, +9262966, +9263018, +9263196, +9263291, +9263521, +9263829, +9263895, +9264196, +9264237

---

## Behavioral Spec

### Top-Level Handler (`fKt`)

```
async function usageCreditsHandler(context):
    session = getActiveOAuthSession(context)

    if not session:
        log("Starting new login following /usage-credits. Exit with Ctrl-C...")
        loginResult = await runLoginFlow(context)
        if loginResult is interrupted:
            emit("Login interrupted")
            return
        emit("Login successful")
        session = getActiveOAuthSession(context)

    renderJSX(usageCreditsUI(context, session))
```

Analysis basis: CC v2.1.196 bundle.js:+9303513, +9303526, +9303619, +9303831, +9303941, +9304060, +9304141, +9304160

---

### Pre-flight: Plan and Credit State Check (`uKt`)

```
function checkPlanAndCreditState(session):
    plan = getPlanTier(session)   // "pro", "max", "team", "enterprise"
    fireEmberLatch(plan)          // telemetry: tengu_ember_latch

    if plan not in ["pro", "max", "team", "enterprise"]:
        return { status: "contact_admin", message: DEFAULT_ADMIN_MESSAGE }

    subscriptionType = getSubscriptionType(session)
    // Types: stripe_subscription, stripe_subscription_contracted,
    //        apple_subscription, google_play_subscription

    creditState = fetchCreditState(session)
    return creditState
```

Analysis basis: CC v2.1.196 bundle.js:+9262426, +9262433, +9262447, +9262487, +9262498, +9262506, +9262514, +9262598, +9262610

---

### Credit State Resolution (`j_t` — UI component orchestrator)

```
function resolveAndRenderCreditState(session, context):
    creditState = fetchOAuthUsageState(session)
    // GET /api/oauth/usage  (timeout: 5000 ms)
    // Content-Type: application/json

    match creditState.kind:

        case "out_of_credits":
            showMessage("Your organization is out of usage credits. "
                        "Contact your admin to add more.")
            return

        case "org_spend_cap_reached":
            showMessage("Your organization's usage credit cap is reached "
                        "for this period. Contact your admin to raise it.")
            checkEligibilityAndRoute(session, "limit_increase")
            return

        case "org_level_disabled_until":
            // Similar cap-reached path, disabled for period
            checkEligibilityAndRoute(session, "limit_increase")
            return

        case unlimited:
            showMessage("Your organization already has unlimited usage credits. "
                        "No request needed.")
            return

        default:
            checkEligibilityAndRoute(session, "limit_increase")
```

Analysis basis: CC v2.1.196 bundle.js:+9262808, +9262837, +9262853, +9262935, +9262966, +9263018, +9263196, +9263291, +9262684

---

### Eligibility Check (`$cl`)

```
async function checkAdminRequestEligibility(session, orgUUID):
    // GET endpoint: api_admin_request_eligibility
    // Header: teleport-org with orgUUID

    response = await axiosGet("api_admin_request_eligibility", {
        headers: { "teleport-org": orgUUID }
    })

    if response indicates error:
        throw Error with detail field

    return eligibility   // includes whether caller is admin role
```

Analysis basis: CC v2.1.196 bundle.js:+9261715, +9261769, +9261863, +9261895, +9263287

---

### Admin Role Routing (`j_t` branch)

```
function routeByAdminRole(eligibility, creditStateKind):
    userRole = eligibility.role

    if userRole in ["admin", "billing", "owner", "primary_owner"]:
        // Open browser to admin settings
        openURL("https://claude.ai/admin-settings/usage")
        recordBrowserOpened("browser-opened")
        return

    // Non-admin path: check for existing pending requests
    existingRequests = fetchAdminRequestList(session)
    // GET api_admin_request_list, filter by statuses

    hasPendingOrDismissed = existingRequests.some(r =>
        r.status in ["pending", "dismissed"])

    if hasPendingOrDismissed:
        showMessage("You've already sent a usage credit request to your admin.")
        return

    // Submit new request
    submitAdminRequest(session, creditStateKind)
```

Analysis basis: CC v2.1.196 bundle.js:+9263499, +9263521, +9263531, +9263590, +9263743, +9263966, +9264196, +9264237, +9264304, +2158915, +2158923, +2158933, +2158941

---

### Admin Request List Fetch (`Ucl`)

```
async function fetchAdminRequestList(session, orgUUID):
    // GET api_admin_request_list
    formData = new FormData()
    formData.append("statuses", serializedStatuses)

    response = await axiosGet("api_admin_request_list", formData, {
        params: { teleport-org: orgUUID }
    })

    if response indicates error:
        throw Error

    return response.data
```

Analysis basis: CC v2.1.196 bundle.js:+9261361, +9261364, +9261458, +9261467, +9261493, +9261597

---

### Admin Request Creation (`Ncl`)

```
async function createAdminRequest(session, orgUUID, requestKind):
    // POST /api/oauth/organizations/:orgUUID/admin_requests
    // kind: "limit_increase" or credits-enable variant

    response = await axiosPost(
        "/api/oauth/organizations/" + orgUUID + "/admin_requests",
        { kind: requestKind }
    )

    if response indicates error:
        throw Error

    if requestKind == "limit_increase":
        showMessage("Request sent to your admin to increase your usage credit limit.")
    else:
        showMessage("Request sent to your admin to turn on usage credits.")
```

Analysis basis: CC v2.1.196 bundle.js:+9261096, +9261099, +9261148, +9261156, +9261247, +9263829, +9263895

---

### Error Handling in UI (`Bcl`)

```
function handleAxiosError(error):
    if fo.isAxiosError(error):
        statusCode = error.response?.status

        if statusCode >= 500:
            // Server error: surface detail field
            return { kind: "server_error", detail: error.response.data.detail }

        // Other HTTP errors handled per status
        return { kind: "http_error", status: statusCode }

    // Non-Axios error
    return { kind: "unknown_error" }
```

Status codes observed in literals: `401`, `403`, `429`, `500`.

Analysis basis: CC v2.1.196 bundle.js:+9262037, +9262120, +9262326, +3132462, +3132490

---

### Usage Data Fetch (`Sde`)

```
async function fetchOAuthUsage(session):
    // GET /api/oauth/usage
    // timeout: 5000 ms
    // Content-Type: application/json
    // Auth mode: standard OAuth bearer

    response = await axiosGet("/api/oauth/usage", {
        timeout: 5000,
        headers: { "Content-Type": "application/json" }
    })

    if response.status == 401:
        // Attempt token refresh and retry
        // On success: append " (401→refresh→retry succeeded)" to log
        refreshToken()
        return retry(fetchOAuthUsage)

    if response indicates no-auth:
        handleNoAuth()

    return parseUsagePayload(response.data)
```

API endpoint literal: `/api/oauth/usage` (bundle.js:+5312610)
Request timeout: 5000 ms (bundle.js:+5312638)
Content-Type: `application/json` (bundle.js:+5312667)

Analysis basis: CC v2.1.196 bundle.js:+5312443, +5312446, +5312478, +5312603, +5312610, +5312638, +5312652, +5312667, +5312752, +5312853

---

### Browser Open (`xc` → `LKr` → `ZLi`)

```
async function openExternalURL(url):
    validateURL(url):
        if not url.startsWith("http:") and not url.startsWith("https:"):
            throw Error("invalid_url")

    platform = detectPlatform()   // "darwin", linux, or Windows

    if platform == "darwin":
        spawnCommand("open", [url])
    elif DISPLAY env not set:
        return { result: "no_display" }
    else:
        spawnXdgOpen(url)

    return { result: "browser-opened" }
```

URLs used:
- Admin URL: `https://claude.ai/admin-settings/usage` (bundle.js:+9264196)
- User URL: `https://claude.ai/settings/usage` (bundle.js:+9264237)

Analysis basis: CC v2.1.196 bundle.js:+9264304, +3154423, +3154473, +3154495, +3155629, +3155665, +3155733, +3155817, +3155876, +3155918, +3155939, +3155949

---

### Login Trigger Sub-flow (`wOe`)

When no OAuth session exists, the handler triggers a full login flow via the component identified as the session-state orchestrator. Key sub-operations observed in the call graph include:

- `e.onChangeAPIKey` — detects API key changes (bundle.js:+9257563)
- `e.applyMessageOp` — applies a message operation during transition (bundle.js:+9257582)
- `f.execRelaunch` — optionally relaunches the process after credential update (bundle.js:+9257838)
- `I7n` (remote-settings refresher) — refreshes feature flags and remote managed settings after auth change; emits "Remote settings: Refreshed after auth change" (bundle.js:+9257936, +7497562)
- `cKt` (policy limits refresher) — refreshes org policy limits; emits "Policy limits: Refreshed after auth change" (bundle.js:+9257988, +14137203)
- `sKt` / `hWt` (session token writer) — persists updated session/config (bundle.js:+9258733)
- `iKt` / `aKt` (auto-mode configurator) — reconfigures auto mode for new session (bundle.js:+9258777)

Log message on entry: `"Starting new login following /usage-credits. Exit with Ctrl-C to use existing account."` (bundle.js:+9303941)

Analysis basis: CC v2.1.196 bundle.js:+9257563, +9257739, +9257951, +9257988, +9258000, +9258033, +9258203, +9258286, +9258376, +9258508, +9258662, +9258698, +9258733, +9258737, +9258771, +9258777

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_ember_latch` | Fired when plan tier is resolved during credit state preflight (bundle.js:+9262450) |
| Telemetry: `tengu_config_parse_error` | Fired when config file cannot be parsed during session initialization (bundle.js:+14160796) |
| Telemetry: `tengu_feature_ok` | Fired when a feature flag resolves correctly (bundle.js:+1028610) |
| Telemetry: `tengu_feature_bad` | Fired when a feature flag resolution fails (bundle.js:+1028677) |
| Telemetry: `tengu_managed_settings_security_dialog_shown` | Fired when remote managed settings require user confirmation (bundle.js:+7489776) |
| Telemetry: `tengu_managed_settings_security_dialog_accepted` | Fired on user acceptance of new managed settings (bundle.js:+7490113) |
| Telemetry: `tengu_managed_settings_security_dialog_rejected` | Fired on user rejection of new managed settings (bundle.js:+7490272) |
| Telemetry: `tengu_policy_limits_fetch` | Fired when org policy limits are fetched (bundle.js:+14135155) |
| Telemetry: `tengu_disable_bypass_permissions_mode` | Fired if bypass-permissions mode is disabled by policy during session setup (bundle.js:+14015380) |
| Telemetry: `tengu_auto_mode_config` | Fired when auto mode configuration is evaluated after login (bundle.js:+14013170) |
| Telemetry: `tengu_daemon_config_reload` | Fired when daemon config is reloaded (bundle.js:+18010884) |
| HTTP requests | GET `/api/oauth/usage` (5 s timeout); GET `api_admin_request_eligibility`; GET `api_admin_request_list`; POST `/api/oauth/organizations/:orgUUID/admin_requests` |
| Browser open | Conditionally opens `https://claude.ai/admin-settings/usage` (admin) or `https://claude.ai/settings/usage` (non-admin) |
| appState changes | `e.getAppState` / `e.setAppState` called during login sub-flow; `[bridge:repl]` disconnect message logged if account changes (bundle.js:+9258203, +9258376, +9258286) |
| Feature flag refresh | `lRn` refreshes GrowthBook payload; clears and repopulates `t0e`, `sRn`, `wV` maps (bundle.js:+3382846, +3379130) |
| Remote settings refresh | `I7n` triggers remote managed settings pull after auth change (bundle.js:+9253539) |
| Policy limits refresh | `cKt` triggers policy limits reload after auth change (bundle.js:+9257988) |
| Session persistence | `hWt` / `OH` writes updated session tokens to config store (bundle.js:+9256368, +14016264) |
| Hook registration | `vi` → `fis.register` called during background polling setup (bundle.js:+68542) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.196 | Initial analysis |

---

## Common Mistakes

1. **Running without an OAuth session on an API-key-only setup**: The command requires an OAuth-based account for the credit management APIs. If only `ANTHROPIC_API_KEY` is set (not an OAuth token), the command will attempt a new login flow rather than immediately showing credit state. The required env vars are `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, or WIF variables (`ANTHROPIC_FEDERATION_RULE_ID` + `ANTHROPIC_ORGANIZATION_ID`).

2. **Expecting this to work for all plan tiers**: Credit management is only available for `pro`, `max`, `team`, and `enterprise` plans. Other plan types receive a generic "contact your admin" response without credit-request functionality.

3. **Sending duplicate admin requests**: The command checks for existing `pending` or `dismissed` requests before submitting a new one. If a request is already pending, it shows an informational message rather than creating a duplicate — this is by design, not a bug.

4. **Expecting immediate credit restoration**: The command submits a request to an admin; it does not directly modify credit limits. The admin must act on the request via the Claude admin console.

5. **Browser URL confusion by role**: Admins are directed to `https://claude.ai/admin-settings/usage`; non-admins are directed to `https://claude.ai/settings/usage`. These are distinct pages and the routing is determined server-side from the eligibility endpoint response.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `fKt` | Top-level async handler for `/usage-credits` (arbor_handler) |
| `uKt` | Plan-tier and credit-state preflight checker |
| `Mi` | Auth configuration resolver |
| `uBr` | Auth utility sub-function A |
| `cBr` | Auth utility sub-function B |
| `aE` | Authentication environment builder |
| `Hd` | Auth helper (bare-flag aware) |
| `cb` | OAuth profile/credential resolver |
| `Lc` | First-party credential loader |
| `aI` | Auth input normalizer |
| `TH` | API key / auth token validator |
| `AUt` | Auth upgrade helper |
| `Jst` | Session token formatter |
| `L0` | Plan-tier constant loader |
| `it` | Feature flag evaluator |
| `C$t` | Feature flag context reader A |
| `v$t` | Feature flag context reader B |
| `P6` | Feature flag SDK accessor |
| `D6` | GrowthBook client getter |
| `iRn` | Feature flag cache lookup/populate |
| `q7r` | GrowthBook experiment evaluator |
| `Z7r` | Feature flag result assembler |
| `Dt` | Config file read/write dispatcher |
| `qt` | Config path resolver |
| `sqo` | Config serializer |
| `lIt` | Config file reader with backup rotation |
| `Ldm` | Config file watcher/writer |
| `Bxe` | Subscription type classifier |
| `Nc` | Account/session state reader |
| `Ao` | Account role checker |
| `R3` | Role inclusion tester |
| `zi` | Telemetry mode checker |
| `Fbs` | Telemetry flag resolver |
| `ct` | String coercer |
| `j_t` | Usage-credits UI orchestrator component |
| `sb` | Session + role composite checker |
| `Sde` | OAuth usage data fetcher (`/api/oauth/usage`) |
| `Tl` | Axios instance factory |
| `xe` | Axios success path handler |
| `ke` | Axios error path handler |
| `gw` | Account role guard for Axios |
| `e` | String/pattern utility |
| `hk` | HTTP error classifier (401/403/OAuth revoke) |
| `EF` | Axios response cache (get/set/delete) |
| `T` | General logging/tracing utility |
| `eeu` | Log transport initializer |
| `Me` | JSON serializer wrapper |
| `Pc` | Log redaction utility (`[REDACTED]`) |
| `KQe` | Log formatter |
| `oeu` | File-based log writer |
| `$cl` | Admin request eligibility fetcher |
| `Ucl` | Admin request list fetcher |
| `n` | FormData/header builder |
| `i` | Stream/socket pair |
| `Ncl` | Admin request creation POSTer |
| `Bcl` | Axios error handler for UI |
| `x_` | UI state reset helper |
| `he` | Error message extractor |
| `Re` | Error logger / queue pusher |
| `er` | Error formatter |
| `_Nu` | Error queue manager (shift/push) |
| `xc` | Browser URL opener dispatcher |
| `LKr` | URL validator and open-command builder |
| `SOd` | URL parse/validate helper |
| `ZLi` | Platform-specific browser spawner |
| `wOe` | Login/session-change orchestrator component |
| `dQe` | Timestamp utility (Date.now) |
| `Hr` | Auth type classifier (firstParty/gateway/etc.) |
| `Rm` | Auth type constants holder |
| `m8e` | Remote managed settings coordinator |
| `FBa` | Remote settings bootstrap |
| `p8e` | Remote settings initial loader |
| `Cws` | Remote settings cache reader |
| `oQ` | Remote settings fetcher (HTTP) |
| `sHe` | Remote settings state getter |
| `mle` | Remote settings metadata extractor |
| `PFe` | Remote settings parse/validate |
| `Su` | Remote settings subscription manager |
| `KS` | Remote settings role validator A |
| `CUt` | Remote settings role validator B |
| `$5n` | Remote settings change notifier |
| `vws` | Remote settings version writer |
| `vyo` | Remote settings load-with-timeout |
| `PBa` | Remote settings load result handler |
| `wBa` | Remote settings timeout sentinel |
| `xyo` | Remote settings fetch-and-apply loop |
| `iHe` | Remote settings apply helper |
| `l5n` | Remote settings hash calculator (SHA-256) |
| `G$p` | Remote settings HTTP fetch with ETag |
| `Ctt` | Remote settings apply writer |
| `qe` | React/JSX helper |
| `MBa` | Remote settings gwe-writer |
| `LBa` | Remote settings security check dialog |
| `xBa` | Remote settings rejection handler |
| `DBa` | Remote settings atomic file writer |
| `UBa` | Remote settings job-queue consumer |
| `$Ba` | Remote settings background poll scheduler |
| `yRn` | Interval manager (set/clear) |
| `j$p` | Remote settings poll cycle executor |
| `vi` | Hook/listener registrar (`fis.register`) |
| `A7n` | Deep-equality change detector for auth state |
| `kSr` | Auth state snapshot taker |
| `fn` | Settings store initializer |
| `Bgn` | Settings store backend selector |
| `I3` | Settings registry builder |
| `f` | Process/exec utility |
| `L8` | Path normalizer (Windows-aware) |
| `I7n` | Remote settings refresh-after-auth trigger |
| `Rin` | Auth-change event emitter |
| `EV` | Event emitter utility |
| `wcl` | Session cache clearer |
| `Sce` | Session credential extractor |
| `Fxe` | Feature refresh trigger |
| `Ccl` | Credential clear helper |
| `NLo` | Notification/log sink |
| `lRn` | GrowthBook feature payload refresher |
| `lFi` | Feature map rebuilder (clear + repopulate) |
| `cFi` | Feature payload snapshot builder |
| `h4` | Global config assembler post-login |
| `Lcl` | Config read helper with I8 check |
| `I8` | Config access gate |
| `F_t` | Config diff/merge applier |
| `Vlf` | Config field validator A |
| `jlf` | Config field validator B |
| `Wlf` | Config field validator C |
| `Klf` | Config field upper-caser |
| `Blf` | Config field validator D |
| `sT` | Flag-settings updater |
| `NFe` | Feature flag set initializer |
| `PRn` | Post-login notification dispatcher |
| `Axs` | CA certificate cache clearer |
| `vxs` | mTLS config cache clearer |
| `KUr` | Proxy agent cache clearer |
| `vDt` | Network proxy configurator |
| `YM` | Proxy env-var reader |
| `t6s` | HTTP proxy agent builder |
| `W8` | Proxy URL parser |
| `cKt` | Policy limits refresh-after-auth trigger |
| `VVo` | Policy limits load-with-timeout |
| `KVo` | Policy limits initial loader |
| `lye` | Policy limits filter/validator |
| `pdr` | Policy limits timeout scheduler |
| `GF` | Policy limits state accessor |
| `a0e` | Policy limits file path builder |
| `mdr` | Policy limits fetch-and-apply orchestrator |
| `dmc` | Policy limits HTTP fetch loop |
| `pmc` | Policy limits background poll scheduler |
| `Wxe` | Workspace/org context extractor |
| `Bce` | Feature flag teardown on logout |
| `Uit` | GrowthBook client teardown |
| `tYr` | Interval + process-listener cleaner |
| `I2t` | Trusted-device enrollment checker |
| `__o` | React root / app bootstrap |
| `eo` | Module-export binder |
| `xsn` | Export name-binding helper |
| `PDe` | App state provider initializer |
| `Ml` | Credential store multi-backend reader |
| `tci` | Credential store read/write/delete dispatcher |
| `FGt` | Trusted-device enrollment executor |
| `FF` | Feature flag evaluator (boolean gate) |
| `dFi` | Feature value resolver with cache |
| `IUp` | Trusted-device N2 initializer |
| `f_o` | Trusted-device Gc initializer |
| `o` | Policy-check utility |
| `s` | Set with finally-cleanup |
| `r` | Data stream / VS pipe |
| `vs` | Process exit handler |
| `Us` | OAuth base URL builder |
| `EHs` | Environment name resolver |
| `HSu` | Hostname builder |
| `smn` | Trusted-device enrollment request body builder |
| `Rcl` | Remote control session disconnector |
| `sKt` | Session token persistence coordinator |
| `C7n` | Feature flag boolean evaluator for session |
| `eYr` | Feature flag boolean gate (raw) |
| `hWt` | Config writer post-login |
| `OH` | Permission rules store (set/filter/delete) |
| `Ur` | Last-message context reader |
| `ptr` | Message finder by type A |
| `Fo` | Message type constant |
| `ftr` | Message finder by type B |
| `Sk` | Bypass-permissions mode enforcer |
| `FYr` | Permission mode checker |
| `FLo` | Post-login notification marker |
| `iKt` | Auto-mode configuration loader |
| `aKt` | Auto-mode full configurator |
| `nJ` | Auto-mode state initializer |
| `gVo` | Auto-mode availability checker |
| `mVo` | Auto-mode settings reader |
| `Ts` | Session state triplet builder |
| `F_e` | Model-family compatibility checker |
| `ANe` | Auto-mode gate evaluator |
| `d` | Terminal writer / spinner controller |
| `jst` | Auth token stringifier |
| `nee` | Auto-mode warning emitter |
| `s3` | Auto-mode plan checker |
| `sEe` | Permission mode change emitter |
| `mIe` | MCP tool permission map builder |
| `W_t` | Last-assistant-message finder helper |
| `$w` | Conversation findLast helper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.