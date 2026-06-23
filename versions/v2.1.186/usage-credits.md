---
type: feature-spec
feature: "usage-credits"
cc_version: "2.1.186"
updated: "2026-06-23"
tags: ["usage-credits", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.186 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/usage-credits`

> Analysis basis: CC v2.1.186 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.186

---

## Overview

`/usage-credits` is a local-JSX slash command that helps users continue working when they have reached a usage limit enforced by their organization. It inspects the current account's credit and subscription state, presents contextual information about the limit condition, and — depending on the user's plan and role — either opens the relevant settings URL in a browser, sends an admin-request to increase the credit cap, or initiates a fresh OAuth login flow.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `usage-credits` |
| description | `Configure usage credits to keep working when you hit a limit` |
| loc_byte | `9118444` |
| loc_byte_end | `9118654` |
| loc_line | `3482` |
| module_id | `upo` |
| load_inline | `true` |
| arbor_handler.name | `O9t` |
| arbor_handler.fqn | `claude-2.1.186::O9t` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.186 bundle.js:+9118444

---

## Input Branching

The command resolves five or more distinct outcome paths based on organization state, subscription type, and admin-request status. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A[/usage-credits invoked] --> B{Current auth type}
    B -- "Non-OAuth / no token\n(bedrock, vertex, gateway, etc.)" --> C[Start new OAuth login flow\nlog: 'Starting new login following /usage-credits...']
    B -- "OAuth token present" --> D{Subscription plan check\n(pro / max / team / enterprise)}
    D -- "No eligible plan" --> C
    D -- "Eligible plan" --> E{Fetch eligibility\n(api_admin_request_eligibility)}
    E -- "HTTP error / 5xx" --> F[Display HTTP error detail]
    E -- "org already unlimited" --> G[Display: 'Your organization already has\nunlimited usage credits. No request needed.']
    E -- "out_of_credits" --> H{User role check}
    E -- "org_spend_cap_reached\n(org_level_disabled_until set)" --> H
    E -- "limit_increase eligible" --> H
    H -- "admin / billing / owner / primary_owner" --> I[Open browser URL:\nhttps://claude.ai/admin-settings/usage]
    H -- "Non-admin member" --> J{Fetch existing requests\n(api_admin_request_list)}
    J -- "pending or dismissed request exists" --> K[Display: 'You've already sent a\nusage credit request to your admin.']
    J -- "No existing request" --> L[Create new request\n(api_admin_request_create)\nPOST /api/oauth/organizations/:orgUUID/admin_requests]
    L -- "out_of_credits action" --> M[Display: 'Request sent to your admin\nto turn on usage credits.']
    L -- "limit_increase action" --> N[Display: 'Request sent to your admin\nto increase your usage credit limit.']
    I --> O[Emit 'browser-opened' result]
    M --> P[End]
    N --> P
    K --> P
    G --> P
    F --> P
    O --> P
    C --> P
```

Analysis basis: CC v2.1.186 bundle.js:+9116670 (handler entry `O9t`), +9075722 (subscription check via `bIe`), +9075803 (`mdt` dispatch), +9116988 (`pc` login path)

---

## Behavioral Spec

### 1. Handler Entry (`O9t` — main async handler)

```
async function usageCreditsHandler(context):
    // Acquire config and check auth state
    config = getConfig(context)           // via M9t → Di + bIe + Ki
    authType = getAuthType(config)

    if authType is non-OAuth
        (bedrock, foundry, anthropicAws, mantle, vertex, gateway, etc.):
        log("Starting new login following /usage-credits. Exit with Ctrl-C to use existing account.")
        startNewLoginFlow(context)        // via pc → OAuth login
        return

    // Render JSX component
    renderJSX(UsageCreditsComponent, context)   // via cpo.jsx
    await runUsageCreditsLogic(context)          // via mdt
```

Analysis basis: CC v2.1.186 bundle.js:+9116670, +9116683, +9116988, +9117098

---

### 2. Config and Ember Latch (`M9t`)

```
function loadConfigAndEmberLatch(context):
    config = loadDi(context)              // Di: loads global config + auth
    emitTelemetry("tengu_ember_latch")    // telemetry checkpoint
    sessionState = getSessionState(context)   // n0
    subscriptionChecker = buildSubscriptionChecker()   // it
    subscriptionInfo = checkSubscription(config)       // bIe
    commandInfo = getCommandInfo()                     // Ki
    return { config, subscriptionInfo, commandInfo }
```

Subscription tiers checked: `"pro"`, `"max"`, `"team"`, `"enterprise"` (bundle.js:+9075703, +9075714, +9075814, +9075826).
Subscription payment types inspected: `stripe_subscription`, `stripe_subscription_contracted`, `apple_subscription`, `google_play_subscription` (bundle.js:+3072586–3072677).

Analysis basis: CC v2.1.186 bundle.js:+9075642, +9075649, +9075663, +9075722, +9075730

---

### 3. Subscription / Role Check (`bIe`, `yo`)

```
function checkSubscriptionAndRole(config):
    subscriptionType = getSubscriptionPaymentType(config)  // yo → stripe_subscription etc.
    userRole = getUserRole(config)     // yo → Gs
    // Roles that grant admin access:
    // "admin", "billing", "owner", "primary_owner"
    isAdmin = userRole in {"admin", "billing", "owner", "primary_owner"}
    return { subscriptionType, isAdmin }
```

Analysis basis: CC v2.1.186 bundle.js:+3072539, +3072561, +2134567–2134593

---

### 4. Core Usage-Credits Logic (`mdt`)

```
async function usageCreditsLogic(context):
    // Step 1: fetch eligibility from API
    eligibility = await fetchEligibility(context)     // yae → GET /api/oauth/usage (5180063)
    // Timeout: 5000 ms (loc_byte 5180091)
    // Auth header passed as Bearer token; retry on 401 with refresh (5180306)

    if eligibility is error:
        errorDetail = extractErrorDetail(eligibility)  // D9a → co.isAxiosError
        return displayError(errorDetail)               // Ae → String

    creditState = eligibility.state   // may be: "out_of_credits", "org_spend_cap_reached",
                                      //         "limit_increase", or org already unlimited

    // Step 2: branch on credit state
    if creditState == "out_of_credits":
        if orgAlreadyUnlimited:
            return display("Your organization already has unlimited usage credits. No request needed.")
        else:
            return handleMemberRequest(context, "out_of_credits", isAdmin)

    if creditState == "org_spend_cap_reached":
        // org_level_disabled_until field present
        return handleMemberRequest(context, "org_spend_cap_reached", isAdmin)

    if creditState == "limit_increase":
        return handleMemberRequest(context, "limit_increase", isAdmin)

    // Contact admin fallback
    return display("Contact your admin to manage usage credit settings.")
```

Key literals: `"out_of_credits"` (bundle.js:+9076024), `"org_spend_cap_reached"` (bundle.js:+9076182), `"limit_increase"` (bundle.js:+9076507), `"org_level_disabled_until"` (bundle.js:+9076151).

Analysis basis: CC v2.1.186 bundle.js:+9075803, +9075843, +9075871, +9076503, +9077182

---

### 5. Eligibility Fetch (`yae`)

```
async function fetchApiUsage(config):
    endpoint = "/api/oauth/usage"     // (loc_byte 5180063)
    headers = {
        "Content-Type": "application/json",   // (loc_byte 5180105, 5180120)
    }
    response = await httpGet(endpoint, { timeout: 5000, headers })
    if response.status == 401:
        refreshToken()
        response = retryRequest()   // " (401→refresh→retry succeeded)" (loc_byte 5180306)
    if response.status in {401, 403}:
        if errorContains("OAuth token has been revoked"):
            triggerLogout()         // Dk → ZN path (loc_byte 3090460)
    return response.data
```

Analysis basis: CC v2.1.186 bundle.js:+5179896, +5180056, +5180063, +5180091, +5180105, +5180205

---

### 6. Admin-Path: Open Browser (`Jl`)

```
function openBrowserUrl(isAdmin, creditState):
    if isAdmin:
        url = "https://claude.ai/admin-settings/usage"   // (loc_byte 9077412)
    else:
        url = "https://claude.ai/settings/usage"         // (loc_byte 9077453)

    openUrl(url)    // Nai → On → platform-specific open (darwin: "open", loc_byte 3113083)
    emitResult("browser-opened")     // (loc_byte 9077520)
```

URL safety check: only `http:` and `https:` schemes are permitted before opening (bundle.js:+3112376, +3112398).

Analysis basis: CC v2.1.186 bundle.js:+9077182, +9077192, +9077412, +9077453, +9077520

---

### 7. Member-Path: Existing-Request Check and Create (`x9a`, `R9a`, `k9a`)

```
async function handleMemberRequest(context, action, isAdmin):
    if isAdmin:
        return openBrowserUrl(isAdmin=true, action)

    // Fetch list of existing requests
    existingRequests = await apiGet(
        "api_admin_request_list",     // (loc_byte 9074580)
        params = { statuses: ["pending", "dismissed"] }   // (loc_byte 9074683, 9076737, 9076747)
    )
    if existingRequests contains pending or dismissed entry:
        return display("You've already sent a usage credit request to your admin.")
                                        // (loc_byte 9076806)

    // Create new request
    orgUUID = getOrgUUID(config)
    response = await apiPost(
        "api_admin_request_create",    // (loc_byte 9074315)
        url = "/api/oauth/organizations/:orgUUID/admin_requests",  // (loc_byte 9074372)
        body = { action: action }
    )

    if action == "limit_increase":
        display("Request sent to your admin to increase your usage credit limit.")
                                        // (loc_byte 9077045)
    else:  // out_of_credits
        display("Request sent to your admin to turn on usage credits.")
                                        // (loc_byte 9077111)
```

HTTP error handling: status 500 results in detail extraction from response body (bundle.js:+9075336, +9075542); Axios errors are inspected via `co.isAxiosError` (bundle.js:+9075253).

Analysis basis: CC v2.1.186 bundle.js:+9074312, +9074364, +9074463, +9074577, +9074580, +9074683, +9075253, +9076959, +9077045, +9077111

---

### 8. Login Flow Path (`nRe` — OAuth re-login)

When the command determines no usable OAuth token is available, it triggers the standard login flow:

```
function startLoginFlow(context):
    log("Starting new login following /usage-credits. Exit with Ctrl-C to use existing account.")
                              // (loc_byte 9117098)
    onChangeAPIKey(context)   // e.onChangeAPIKey (loc_byte 9071086)
    applyMessageOp(context)   // e.applyMessageOp (loc_byte 9071105)
    // Executes full OAuth consent + credential storage sequence
    // On success: display "Login successful"   (loc_byte 9117299)
    // On interrupt: display "Login interrupted" (loc_byte 9117318)
    if loginSucceeded:
        execRelaunch()        // f.execRelaunch — restarts the process (loc_byte 9071327)
```

Analysis basis: CC v2.1.186 bundle.js:+9117098, +9071086, +9071105, +9071327, +9117299, +9117318

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_ember_latch` | Fired during config load at command start (bundle.js:+9075666) |
| Telemetry: `tengu_config_parse_error` | Fired on config file parse failure (bundle.js:+13853132) |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` | Fired on feature-flag evaluation (bundle.js:+1024705, +1024772) |
| Telemetry: `tengu_auto_mode_config` | Fired when auto-mode config is inspected (bundle.js:+13711309) |
| Telemetry: `tengu_policy_limits_fetch` | Fired when org policy limits are fetched (bundle.js:+13830674) |
| Telemetry: `tengu_disable_bypass_permissions_mode` | Fired if bypass-permissions mode is rejected (bundle.js:+13713420) |
| Browser open | Admin-eligible users: `https://claude.ai/admin-settings/usage`; members: `https://claude.ai/settings/usage`; result token `"browser-opened"` |
| API calls | GET `/api/oauth/usage` (eligibility); GET admin-request list; POST `/api/oauth/organizations/:orgUUID/admin_requests` |
| OAuth token refresh | Automatic on 401; revoked-token detection on 403 triggers logout |
| Process relaunch | `execRelaunch()` called after successful login in no-token path |
| appState changes | `e.getAppState` / `e.setAppState` called during login and credit-state transitions (bundle.js:+9071658, +9071831) |
| Hook registration | `O5o.register` via `Ai` (bundle.js:+67125) for interval/watch cleanup |
| Sound | None detected in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.186 | Initial analysis |

---

## Common Mistakes

1. **Running `/usage-credits` on a non-OAuth setup (Bedrock, Vertex, AWS, gateway)** — the command immediately starts a new OAuth login flow rather than checking credits. Use API-key-based billing management through your cloud provider console instead.
2. **Expecting the command to work without an active internet connection** — all three API endpoints (`/api/oauth/usage`, admin-request list, admin-request create) require network access; failures produce HTTP error details, not graceful degradation.
3. **Invoking as a non-admin member when a pending request already exists** — the command silently displays "You've already sent a usage credit request to your admin" and exits without creating a duplicate. The status check covers both `pending` and `dismissed` states.
4. **Expecting an immediate credit increase** — the command only sends an admin notification (or opens the admin settings URL). Actual credit changes require administrator action.
5. **Confusing the `org_spend_cap_reached` and `out_of_credits` states** — `org_spend_cap_reached` is a periodic cap (governed by `org_level_disabled_until`), while `out_of_credits` is an absolute exhaustion. Both flow to the same admin-request path, but their user-facing messages differ.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `O9t` | Main async handler for `/usage-credits` (arbor handler, AsyncFunction) |
| `M9t` | Config + ember-latch loader; orchestrates Di, n0, it, bIe, Ki |
| `Di` | Global config / auth-state loader |
| `ALr` | Auth-loader sub-routine A |
| `SLr` | Auth-loader sub-routine B |
| `ny` | Auth-state resolver (checks env vars and stored credentials) |
| `Ud` | Underlying credential read helper |
| `iA` | OAuth profile builder (constructs auth object from stored credentials) |
| `Nl` | First-party auth classifier |
| `nT` | Auth negotiation helper |
| `Wg` | Auth validation / environment-variable checker (ANTHROPIC_API_KEY etc.) |
| `Dkt` | Token request deduplicator |
| `XQe` | Token cache accessor |
| `n0` | Session state getter |
| `it` | Subscription / feature-flag checker |
| `ORt` | Feature-registry reader A |
| `NRt` | Feature-registry reader B |
| `$9` | Feature payload accessor |
| `F9` | Feature store lookup |
| `JEn` | Feature evaluation with dedup-set guard |
| `M2r` | GrowthBook experiment evaluator (emits `tengu_ember_latch`) |
| `F2r` | Feature-flag response processor |
| `wt` | Config file reader / watcher orchestrator |
| `Gt` | Config path resolver |
| `mOo` | Config path constant provider |
| `cEe` | Config file read + backup routine |
| `Lxf` | Config file watcher (uses `AQn.watchFile`) |
| `bIe` | Subscription-type checker (pro/max/team/enterprise + payment type) |
| `pc` | Auth-presence guard (routes to login if no token) |
| `yo` | Role and subscription-type extractor |
| `l2` | Array include-check helper |
| `Ki` | Command-info builder |
| `ins` | Command string normalizer |
| `ot` | String coercion utility |
| `mdt` | Core usage-credits logic dispatcher (yae, T, x9a, R9a, k9a, D9a, WH, Ae, Re, Jl) |
| `nb` | Role-check helper used by mdt |
| `yae` | Eligibility fetch orchestrator (GET `/api/oauth/usage`) |
| `_l` | HTTP client factory / request builder |
| `ke` | HTTP request sender (GET path) |
| `xe` | HTTP request sender (alternate path) |
| `qC` | Subscription-tier guard inside yae |
| `e` | Retry-with-jitter helper (Math.random + setTimeout) |
| `Dk` | OAuth-error detector (401/403, revoked-token check) |
| `ZN` | Token-refresh cache manager |
| `T` | HTTP transport layer (sends authenticated requests) |
| `Pvc` | Request auth header builder |
| `De` | JSON serializer (JSON.stringify wrapper) |
| `Lc` | URL path formatter |
| `eze` | Content-type encoder |
| `Fvc` | Full HTTP request executor with Buffer.byteLength and redirect handling |
| `x9a` | API eligibility GET caller (`api_admin_request_eligibility`) |
| `R9a` | Admin-request LIST caller (`api_admin_request_list`, GET with `statuses` param) |
| `n` | FormData / header builder (n.append) |
| `i` | Socket/connection manager |
| `k9a` | Admin-request CREATE caller (`api_admin_request_create`, POST) |
| `D9a` | Axios-error extractor for HTTP responses |
| `WH` | Credit-state message selector |
| `Ae` | String coercion helper |
| `Re` | Error reporting / log-push utility |
| `ao` | Error constructor wrapper |
| `Pnu` | Rolling error queue (shift/push) |
| `Jl` | Browser-open orchestrator (validates URL scheme, platform dispatch) |
| `oed` | URL scheme validator (`http:`/`https:`) |
| `Nai` | Platform-specific open command builder |
| `g_` | Open-command argument builder |
| `On` | Child-process spawner for URL open |
| `nRe` | OAuth login-flow handler (called when no token present) |
| `_Ke` | Timestamp helper (Date.now) |
| `br` | Auth-provider type classifier (bedrock/foundry/mantle/vertex etc.) |
| `O9e` | Remote-managed-settings orchestrator |
| `qga` | Remote settings init signal |
| `UFt` | Managed-settings fetch dispatcher |
| `Dis` | Remote settings data store |
| `P7` | Remote settings fetch executor |
| `Dpe` | Remote settings cache accessor |
| `goe` | Remote settings hash checker |
| `$Pe` | Remote settings payload parser |
| `GH` | Remote settings state holder |
| `Su` | Remote settings subscription notifier |
| `aA` | Remote settings apply-success handler |
| `Ukt` | Remote settings rejection handler |
| `nPn` | Policy-notification sender |
| `Pis` | Policy-notification payload builder |
| `Gto` | Remote settings load-with-timeout orchestrator |
| `Fga` | Remote settings timeout/consent logic |
| `xga` | Remote settings consent-dialog trigger |
| `Vto` | Remote settings pull and apply logic |
| `Ppe` | Remote settings cache writer |
| `Qha` | Remote settings hash calculator (SHA-256) |
| `$Zd` | Remote settings security-check dispatcher |
| `R7e` | Remote settings enrollment checker |
| `Nga` | Remote settings validation helper |
| `Mga` | Remote settings security-dialog presenter |
| `Dga` | Remote settings "no check needed" path |
| `Uga` | Remote settings atomic file writer |
| `Gga` | Remote settings W8 state emitter |
| `Wga` | Remote settings background-poll orchestrator |
| `cSn` | Interval scheduler (setInterval/clearInterval wrapper) |
| `GZd` | Remote settings poll executor |
| `Ai` | Hook/lifecycle registrar (O5o.register) |
| `J3n` | Deep-equality login-change detector |
| `Bir` | Login-state snapshot builder |
| `In` | Credential storage orchestrator |
| `Qon` | Credential store dispatcher |
| `Z$` | Credential store composite (secure + fallback) |
| `f` | Daemon process manager (spawn, kill, relaunch) |
| `W` | File-system path resolver |
| `D` | Daemon lifecycle controller |
| `grt` | Daemon config file reader |
| `d` | Daemon stdio writer |
| `_Q` | Daemon config transformer |
| `NPt` | Daemon workspace initializer |
| `PBi` | Daemon process filter |
| `H` | Daemon socket data buffer |
| `u` | Daemon stop-signal sender |
| `x` | Daemon mtime-watcher |
| `g` | Daemon connection timeout manager |
| `V` | Daemon process map |
| `s` | Daemon task-promise tracker |
| `Mdc` | Daemon log formatter |
| `uae` | Daemon config-reload handler |
| `Bn` | Daemon reconnect/abort orchestrator |
| `o` | Process table formatter |
| `r` | Transport stream wrapper |
| `c` | Background-session label builder |
| `IXn` | macOS memory-pressure checker |
| `D2e` | Daemon pin-file reader/writer |
| `dDt` | Pin-file path builder |
| `Bt` | JSON parse wrapper |
| `kn` | File-content normalizer |
| `YTd` | Recursive directory pin scanner |
| `N` | Session lifecycle manager (retireIfSettled) |
| `Zut` | Session retire logic |
| `J5` | Session state machine |
| `$Bo` | Daemon claim/spawn orchestrator |
| `MOo` | Daemon claim-file writer |
| `pYf` | Claim send-with-timeout |
| `dYf` | Claim frame builder |
| `Jd` | Manifest file writer |
| `gR` | Binary frame encoder (Buffer operations) |
| `KBo` | Daemon session roster manager |
| `ec` | Daemon session path builder |
| `Oi` | Daemon file-state tracker |
| `fg` | Active-session detector |
| `ive` | Session ignore-list filter |
| `kd` | Session order/state sorter |
| `jmt` | Session task-promise debouncer |
| `QWt` | Session roster path builder |
| `dye` | Session roster directory builder |
| `yR` | Roster late-write handler |
| `nN` | Roster initialization helper |
| `rM` | Roster error handler |
| `JWt` | Roster file path builder |
| `p` | Forced-shutdown handler (process.exit) |
| `Kb` | Shutdown pre-flight |
| `mn` | Log/warn emitter |
| `Pe` | Permission-mode key validator |
| `KVe` | Permission-mode constant set |
| `$` | Disposable resource tracker |
| `e9n` | Auth-change event dispatcher |
| `KYt` | Auth-change event type |
| `BQ` | Auth broadcast emitter |
| `A9a` | Ydo cache clearer |
| `Cse` | Auth-change subscriber A |
| `AIe` | Auth-change subscriber B |
| `E9a` | Auth-change subscriber C |
| `Jdo` | Auth-change subscriber D |
| `ZEn` | Feature-flag refresh-on-auth-change handler |
| `Fyi` | Feature-flag payload reloader |
| `$yi` | Feature-flag snapshot builder |
| `W5` | Global-config update handler |
| `b9a` | Config key sanitizer |
| `LK` | Known-config-key validator |
| `pdt` | Config diff applier |
| `BRp` | Config diff base |
| `$Rp` | Config entry validator |
| `FRp` | Config flag-settings updater |
| `NRp` | Config cleanup helper |
| `QR` | Flag-settings merge helper |
| `aEt` | Flag-settings schema constant |
| `TSn` | Trusted-device state notifier |
| `kls` | CA-cert cache clearer |
| `Dls` | mTLS config cache clearer |
| `zIr` | Proxy-agent cache clearer |
| `jCt` | Proxy configuration reloader |
| `zN` | Proxy-env-var reader |
| `lvs` | Proxy URL builder |
| `oz` | Proxy URL parser |
| `x9t` | Policy-limits refresh orchestrator |
| `tOo` | Policy-limits timeout handler |
| `rOo` | Policy-limits stale-cache accessor |
| `Mme` | Policy-limits model-version guard |
| `mQn` | Policy-limits delayed-resolve scheduler |
| `C2` | Policy-limits data store |
| `GIe` | Policy-limits file path builder |
| `gQn` | Policy-limits background-poll launcher |
| `dGl` | Policy-limits fetch and apply logic |
| `pGl` | Policy-limits poll interval manager |
| `IIe` | Trusted-device enrollment trigger |
| `Vse` | Feature-flag teardown handler |
| `GZe` | Feature-flag registry clearer |
| `B2r` | Feature-flag interval/process-listener clearer |
| `TMt` | Trusted-device re-enrollment guard |
| `tto` | React rendering bootstrap (oo + to + Nl + a0e + Bl) |
| `to` | React root initializer |
| `V7t` | React virtual-DOM binder |
| `a0e` | React render queue dispatcher |
| `Bl` | React store/subscription bridge |
| `NGs` | React state read/write/delete coordinator |
| `EFt` | Trusted-device enrollment executor (POST to bridge) |
| `HU` | Feature-flag guard for trusted-device |
| `Gyi` | Feature-flag value resolver for trusted-device |
| `dZd` | React aF/to composite |
| `Xeo` | React Fu/to composite |
| `ks` | Trusted-device URL builder |
| `GYo` | Environment base-URL selector |
| `X5c` | Endpoint allow-list checker |
| `yrn` | Trusted-device enrollment response parser |
| `T9a` | Trusted-device token storage helper |
| `w9t` | Permission-mode update handler |
| `n9n` | Permission-mode bootstrap |
| `$2r` | Permission-mode feature-flag reader |
| `PFt` | Permission-mode applicator |
| `tH` | Permission rule store (add/delete/filter) |
| `Pr` | Session-init parameter extractor |
| `w8n` | Working-directory session param reader |
| `Xo` | Session parameter schema |
| `L8n` | Tool-list session param reader |
| `L2` | Session param orchestrator |
| `epo` | Session-end cleanup hook |
| `L9t` | Auto-mode configuration loader |
| `k9t` | Auto-mode full config resolver |
| `Kz` | Auto-mode feature-flag reader |
| `wPo` | Auto-mode plan checker |
| `vPo` | Auto-mode $o accessor |
| `_s` | Auto-mode env-var checker |
| `dme` | Auto-mode model-version guard |
| `Fxe` | Auto-mode circuit-breaker reader |
| `VQe` | Model version string normalizer |
| `Fne` | Auto-mode flag-settings override reader |
| `w$` | Auto-mode disabled-reason selector |
| `whe` | Auto-mode permission-mode change emitter |
| `lEe` | Auto-mode lEe settings mapper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.