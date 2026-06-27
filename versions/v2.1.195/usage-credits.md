---
type: feature-spec
feature: "usage-credits"
cc_version: "2.1.195"
updated: "2026-06-27"
tags: ["usage-credits", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.195 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/usage-credits`

> Analysis basis: CC v2.1.195 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.195

---

## Overview

`/usage-credits` is an interactive JSX-rendered command that helps users and organization members manage usage credit limits when the Claude API quota has been exhausted. It inspects the current subscription plan and organization credit state, then presents contextual actions — such as requesting a limit increase from an admin, opening a browser to relevant settings pages, or initiating a fresh OAuth login flow — so work can continue after hitting a usage cap.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `usage-credits` |
| description | `Configure usage credits to keep working when you hit a limit` |
| loc_byte | `9244311` |
| loc_byte_end | `9244521` |
| loc_line | `3633` |
| module_id | `bvo` |
| load_inline | `true` |
| arbor_handler.name | `xVt` |
| arbor_handler.fqn | `claude-2.1.195::xVt` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.195 bundle.js:+9244311 – +9244521

---

## Input Branching

The command has more than three distinct execution paths depending on plan tier, organization credit state, existing pending requests, and whether the user holds an admin-eligible role. A Mermaid flowchart is used to represent the branching shape.

```mermaid
flowchart TD
    A(["/usage-credits invoked"]) --> B[Fetch subscription plan\nvia emberLatch telemetry]
    B --> C{Plan tier?}
    C -- pro / max --> D[Fetch API usage\n via /api/oauth/usage]
    C -- team / enterprise --> E[Fetch API usage\nand org eligibility]
    D --> F{Credit state?}
    E --> F
    F -- out_of_credits --> G[Show 'org out of credits'\nmessage · contact admin]
    F -- org_spend_cap_reached --> H[Show spend cap reached\nmessage · contact admin]
    F -- unlimited credits --> I[Show 'already unlimited'\nmessage · no action needed]
    F -- limit_increase eligible --> J{Existing request?}
    J -- pending / dismissed --> K[Show 'already sent request'\nmessage]
    J -- none --> L{User role?}
    L -- admin / billing / owner\n/ primary_owner --> M[Open browser to\nhttps://claude.ai/admin-settings/usage]
    L -- non-admin --> N[POST admin_request\nto /api/oauth/organizations/:orgUUID/admin_requests]
    N --> O{Request result?}
    O -- success limit_increase --> P["Request sent — increase limit"]
    O -- success enable credits --> Q["Request sent — turn on credits"]
    O -- HTTP 4xx/5xx --> R[Show axios error detail]
    M --> S[Mark browser-opened\nand show confirmation]
    G --> T([Return JSX result])
    H --> T
    I --> T
    K --> T
    P --> T
    Q --> T
    R --> T
    S --> T
    B --> U{No OAuth / not\nfirst-party account?}
    U -- true --> V[Initiate new login flow\n"Starting new login following /usage-credits…"]
    V --> W{Login result?}
    W -- success --> X["Login successful"]
    W -- interrupted --> Y["Login interrupted"]
    X --> T
    Y --> T
```

Analysis basis: CC v2.1.195 bundle.js:+9201440, +9201494, +9201815, +9201942, +9202203, +9202298, +9202528, +9203203, +9242948

---

## Behavioral Spec

### Top-level handler — `usageCreditsHandler` (bundle: `xVt`)

The handler is an `AsyncFunction` resolved via `module_id` → `bvo`. It is the primary entry point for the command.

```
async function usageCreditsHandler(context):
    planTier = detectPlanTier(context)         // checks "pro" / "max" / "team" / "enterprise"
    if planTier requires login:
        displayMessage("Starting new login following /usage-credits. Exit with Ctrl-C to use existing account.")
        result = await performLogin(context)   // calls loginFlow
        if result == "success":
            displayMessage("Login successful")
        else:
            displayMessage("Login interrupted")
        return renderJSX(result)

    render usageCreditsUI(context, planTier)   // delegates to uiComponentBuilder
```

Analysis basis: CC v2.1.195 bundle.js:+9242520, +9242533, +9242948, +9243148, +9243167

---

### Plan and subscription detection — `planDetector` (bundle: `vVt`)

```
function planDetector(context):
    tier = readTierFromState()   // checks literals "pro", "max", "team", "enterprise"
    emit telemetry("tengu_ember_latch")
    subscriptionKind = resolveSubscriptionKind()
    // subscription kinds checked: "stripe_subscription",
    //   "stripe_subscription_contracted", "apple_subscription",
    //   "google_play_subscription"
    return { tier, subscriptionKind }
```

Analysis basis: CC v2.1.195 bundle.js:+9201440, +9201454, +9201494, +9201505, +9201605, +9201617, +3099675

---

### API usage fetch — `apiUsageFetch` (bundle: `que`)

```
async function apiUsageFetch(authToken):
    // Sends GET /api/oauth/usage
    // timeout: 5000 ms
    // Content-Type: application/json
    response = await httpGet("/api/oauth/usage", {
        timeout: 5000,
        headers: { "Content-Type": "application/json" }
    })
    if response.status == 401:
        refreshToken()
        retryRequest()          // appends " (401→refresh→retry succeeded)" on success
    if response.status == 403:
        handleOAuthRevocation() // checks "OAuth token has been revoked"
    return response.data
```

Analysis basis: CC v2.1.195 bundle.js:+5277764, +5277931, +5277959, +5277973, +5277988, +5278073, +5278174, +3117456, +3117484, +3117550

---

### Credit-state branching — `creditStateRouter` (bundle: `$Ht`)

```
function creditStateRouter(usageData, planTier, userRole):
    state = usageData.state   // one of: "out_of_credits", "org_spend_cap_reached",
                              //         "org_level_disabled_until", "limit_increase"

    if state == "out_of_credits":
        return showMessage("Your organization is out of usage credits. Contact your admin to add more.")

    if state == "org_spend_cap_reached":
        return showMessage("Your organization's usage credit cap is reached for this period. Contact your admin to raise it.")

    if state == "unlimited":
        return showMessage("Your organization already has unlimited usage credits. No request needed.")

    if state == "limit_increase":
        existingRequests = fetchAdminRequestList()   // GET api_admin_request_list
        if existingRequests contains status "pending" or "dismissed":
            return showMessage("You've already sent a usage credit request to your admin.")

        if userRole in ["admin", "billing", "owner", "primary_owner"]:
            openBrowser("https://claude.ai/admin-settings/usage")
            markState("browser-opened")
        else:
            sendAdminRequest("limit_increase")
            if requestType == "increase":
                showMessage("Request sent to your admin to increase your usage credit limit.")
            else:
                showMessage("Request sent to your admin to turn on usage credits.")
```

Analysis basis: CC v2.1.195 bundle.js:+9201815, +9201844, +9201860, +9201942, +9201973, +9202025, +9202203, +9202298, +9202362, +9202528, +9202538, +9202597, +9202836, +9202902, +2145514, +2145522, +2145532, +2145540

---

### Admin eligibility check — `adminEligibilityCheck` (bundle: `wsl`)

```
async function adminEligibilityCheck(orgToken):
    // GET api_admin_request_eligibility
    // checks "teleport-org" header value
    response = await httpGet("api_admin_request_eligibility", orgToken)
    if response.error:
        throw Error(response)
    return response.data
```

Analysis basis: CC v2.1.195 bundle.js:+9200719, +9200722, +9200776, +9200870, +9200902

---

### Admin request list fetch — `adminRequestListFetch` (bundle: `vsl`)

```
async function adminRequestListFetch(orgToken):
    // GET api_admin_request_list
    // appends statuses field to query
    response = await httpGet("api_admin_request_list", { statuses: [...] }, orgToken)
    if response.error:
        throw Error(response)
    return response.data
```

Analysis basis: CC v2.1.195 bundle.js:+9200368, +9200371, +9200465, +9200474, +9200500, +9200604

---

### Admin request creation — `adminRequestCreate` (bundle: `Csl`)

```
async function adminRequestCreate(orgUUID, requestType, orgToken):
    // POST /api/oauth/organizations/:orgUUID/admin_requests
    response = await httpPost(
        `/api/oauth/organizations/${orgUUID}/admin_requests`,
        { type: requestType },
        orgToken
    )
    if response.error:
        throw Error(response)
    return response.data
```

Analysis basis: CC v2.1.195 bundle.js:+9200103, +9200106, +9200155, +9200163, +9200254

---

### Axios error handler — `axiosErrorHandler` (bundle: `xsl`)

```
function axiosErrorHandler(error):
    if isAxiosError(error):
        statusCode = error.response.status
        if statusCode >= 500:
            return error.response.data.detail
        if statusCode == 429:
            handleRateLimit()
    return stringifyError(error)
```

Analysis basis: CC v2.1.195 bundle.js:+9201044, +9201127, +9201333, +184718, +184830

---

### Browser opener — `browserOpener` (bundle: `ac` → `$Ci`)

```
function browserOpener(url):
    if not url.startsWith("http:") and not url.startsWith("https:"):
        throw Error("Invalid URL scheme")
    if platform == "darwin":
        exec("open", url)
    else:
        exec platform-default open command
    // admin URL: https://claude.ai/admin-settings/usage
    // user URL:  https://claude.ai/settings/usage
```

Analysis basis: CC v2.1.195 bundle.js:+9203203, +9203244, +9203311, +3139417, +3139467, +3139489, +3140591, +3140604, +3140662, +3140721, +3140740

---

### Login re-initiation — `loginReinitiator` (bundle: `UPe`)

When no valid OAuth token is present or the account is not first-party (`"firstParty"`), the handler triggers a full re-authentication sequence.

```
async function loginReinitiator(context):
    displayMessage("Starting new login following /usage-credits. Exit with Ctrl-C to use existing account.")
    applyMessageOp("update")
    onChangeAPIKey(newKey)
    startLoginFlow()              // triggers _je / wX / Zho internals
    await waitForLoginResult()
    if success:
        return "Login successful"
    return "Login interrupted"
```

Subscription tier constants checked during flow: `"pro"`, `"max"` (bundle.js:+9201494, +9201505).

Analysis basis: CC v2.1.195 bundle.js:+9196570, +9196589, +9196705, +9196739, +9196793, +9196874, +9242948, +9243148, +9243167

---

### Feature-flag and config reload — `featureFlagRefresh` (bundle: `IKn` → `Ixn`)

Called during handler setup to ensure the latest feature flags and remote configuration are applied before credit-state decisions are made.

```
function featureFlagRefresh():
    clearLvoCache()            // lvo.clear
    refreshFeatures()          // e.refreshFeatures
    reloadGlobalPayload()      // G1i: hxe.clear, Axn.clear, rV.clear, then re-set
    emitRstEvent()             // Rst.emit
    if error: logZrError()     // Zr error handler
```

Analysis basis: CC v2.1.195 bundle.js:+9192537, +9192545, +9192551, +9192557, +9192625, +3357366, +3357421, +3357518

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_ember_latch` | Emitted when plan-tier latch value is read from subscription state (bundle.js:+9201457) |
| Telemetry: `tengu_feature_ok` | Emitted on successful feature-flag evaluation (bundle.js:+1027363) |
| Telemetry: `tengu_feature_bad` | Emitted on failed feature-flag evaluation (bundle.js:+1027430) |
| Telemetry: `tengu_config_parse_error` | Emitted if the global config file cannot be parsed (bundle.js:+14073004) |
| Telemetry: `tengu_managed_settings_security_dialog_shown` | Emitted when remote managed-settings security dialog is displayed (bundle.js:+7430796) |
| Telemetry: `tengu_managed_settings_security_dialog_accepted` | Emitted on acceptance (bundle.js:+7431133) |
| Telemetry: `tengu_managed_settings_security_dialog_rejected` | Emitted on rejection (bundle.js:+7431292) |
| Telemetry: `tengu_policy_limits_fetch` | Emitted when organization policy limits are fetched (bundle.js:+14048105) |
| Telemetry: `tengu_disable_bypass_permissions_mode` | Emitted if bypass-permissions mode is rejected during config setup (bundle.js:+13929301) |
| Telemetry: `tengu_auto_mode_config` | Emitted during auto-mode gate evaluation (bundle.js:+13927092) |
| Telemetry: `tengu_daemon_config_reload` | Emitted when the daemon configuration is reloaded (bundle.js:+17902328) |
| API call: GET `/api/oauth/usage` | Fetches current usage credits state with 5 000 ms timeout (bundle.js:+5277931) |
| API call: GET `api_admin_request_eligibility` | Checks whether the org admin can act on a credit request (bundle.js:+9200722) |
| API call: GET `api_admin_request_list` | Lists existing admin requests to detect prior pending/dismissed entries (bundle.js:+9200371) |
| API call: POST `/api/oauth/organizations/:orgUUID/admin_requests` | Creates a new admin request of type `limit_increase` (bundle.js:+9200163) |
| Browser open | Opens `https://claude.ai/admin-settings/usage` for admin roles, or `https://claude.ai/settings/usage` for non-admin (bundle.js:+9203203, +9203244) |
| appState changes | Reads and writes app state via `e.getAppState` / `e.setAppState`; logs `[bridge:repl] Account changed via /login — disconnecting Remote Control session` when account changes (bundle.js:+9197210, +9197383, +9197295) |
| Feature-flag cache | Clears and rebuilds `hxe`, `Axn`, `rV` caches during feature refresh (bundle.js:+3353650, +3353662, +3354366) |
| Hook registration | `vi` → `krs.register` used during background polling setup (bundle.js:+68053) |
| Sound | None identified in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.195 | Initial analysis |

---

## Common Mistakes

1. **Invoking outside a first-party OAuth session**: The command requires a valid first-party (`"firstParty"`) OAuth token. If no token is present, it immediately launches a full re-login sequence instead of displaying credit options. Users expecting an instant credit management UI when unauthenticated will instead see the login prompt.

2. **Expecting admin actions as a non-admin**: Only users whose role is `"admin"`, `"billing"`, `"owner"`, or `"primary_owner"` will have a browser opened to the admin settings page. All other roles receive a POST request that sends an email/request to the admin — they cannot self-serve the credit increase.

3. **Running redundant requests**: If a credit increase request is already `"pending"` or `"dismissed"`, the command detects this via `api_admin_request_list` and shows the message `"You've already sent a usage credit request to your admin."` without sending a duplicate POST. Re-invoking the command will not generate a new request.

4. **Assuming the command works on all subscription tiers equally**: Behavior differs significantly between `"pro"` / `"max"` (individual) and `"team"` / `"enterprise"` (organizational) tiers; the organization credit flow and admin eligibility check are only triggered on organizational plans.

5. **Confusing `org_spend_cap_reached` with `out_of_credits`**: These are two distinct states with different user messages. The spend cap state (`org_level_disabled_until`) means the period cap was hit; the out-of-credits state means the org has no credits at all. Both require admin intervention, but the displayed messages and underlying API reasons differ.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `xVt` | Top-level async handler for `/usage-credits` (arbor_handler) |
| `vVt` | Plan/subscription tier detector |
| `Mi` | Auth / account context reader |
| `EFr` | Auth error formatter |
| `yFr` | Auth response parser |
| `eE` | Authentication state manager |
| `md` | CLI flag / bare-mode checker |
| `ab` | OAuth profile builder (`"profile-implicit"`, `"user_oauth"`) |
| `Ql` | First-party gateway resolver |
| `oI` | OAuth token inspector |
| `TH` | Auth credential validator (checks `ANTHROPIC_API_KEY`, `apiKeyHelper`, env vars) |
| `lNt` | Token lifecycle helper |
| `jot` | Auth utility wrapper |
| `b0` | Subscription plan base reader |
| `at` | Feature flag evaluator (uses `hxe`, `VKr`, `rV` maps) |
| `lUt` | Feature flag loader |
| `cUt` | Feature flag cache writer |
| `f6` | Feature payload fetcher |
| `p6` | Feature store reader |
| `bxn` | Feature flag lookup with caching |
| `WKr` | GrowthBook experiment event emitter |
| `JKr` | Feature flag result processor |
| `Mt` | Config file reader/writer with backup |
| `qt` | Config path resolver |
| `Mjo` | Config migration helper |
| `oTt` | Config file I/O (readFileSync, mkdirSync, copyFileSync) |
| `Csm` | Config file watcher (uses `Jcc.unwatchFile`) |
| `txe` | Subscription type classifier |
| `kc` | Account state combiner |
| `yo` | Subscription kind checker |
| `y3` | Array inclusion checker |
| `qi` | Telemetry / traffic mode checker (`"essential-traffic"`, `"no-telemetry"`) |
| `rSs` | Telemetry consent resolver |
| `ut` | String coercion utility |
| `$Ht` | Credit-state UI orchestrator (main JSX component builder) |
| `tb` | Role/tier eligibility checker |
| `que` | API usage fetch coordinator |
| `Hl` | HTTP request helper (wraps `t` / `Le` / `ke`) |
| `Le` | HTTP GET wrapper |
| `ke` | HTTP authenticated GET wrapper |
| `dw` | Subscription-type-to-display mapper |
| `ik` | Axios error classifier (401/403 handler) |
| `rF` | Token refresh cache manager (`K8r` map) |
| `T` | Logging / debug output utility |
| `RYc` | Request header builder |
| `Me` | JSON serializer |
| `Lc` | Header redaction helper (`[REDACTED]`) |
| `jXe` | Auth info serializer |
| `PYc` | HTTP request dispatcher (Buffer.byteLength, retry logic, 1000/100 ms timing) |
| `wsl` | Admin eligibility API caller |
| `vsl` | Admin request list API caller |
| `Csl` | Admin request creation API caller (POST) |
| `xsl` | Axios error surface handler (500, 429 codes) |
| `R_` | Result renderer |
| `ye` | String coercion helper |
| `xe` | Error logger (pushes to `GZe`, calls `Gee.logError`) |
| `Zr` | Error constructor wrapper |
| `BMu` | Rolling error buffer manager (`Tpn` shift/push) |
| `ac` | URL validator and browser-open dispatcher |
| `vRd` | URL scheme validator (`http:` / `https:`) |
| `$Ci` | Browser open executor (darwin: `open`) |
| `fH` | Platform detection helper |
| `Mn` | Child-process spawner (depth limit 10) |
| `UPe` | Login re-initiation and account-change orchestrator |
| `lXe` | Timestamp generator (`Date.now`) |
| `fr` | Auth mode resolver (`"gateway"`, `"bedrock"`, `"foundry"`, etc.) |
| `Lm` | Session metadata builder |
| `_je` | Login flow controller |
| `RUa` | Login flow pre-check |
| `hje` | Login UI initializer |
| `UIs` | Login UI state machine |
| `wX` | Login sequence executor |
| `Rhe` | OAuth redirect handler |
| `$ae` | OAuth state generator |
| `Q$e` | OAuth callback receiver |
| `_u` | OAuth event emitter |
| `jS` | Subscription update notifier |
| `pNt` | Plan change notifier |
| `N9n` | Post-login state synchronizer (`sO.notifyChange`) |
| `$Is` | Session initialization helper |
| `Zho` | Consent dialog manager (with `setTimeout`) |
| `CUa` | Consent flow builder |
| `yUa` | Consent timeout handler |
| `nHo` | Remote managed settings fetch and apply |
| `khe` | Settings hash verifier |
| `E9n` | Settings hash computer (SHA-256) |
| `SPp` | Settings payload builder |
| `Iet` | Settings integrity checker |
| `je` | Object key validator |
| `TUa` | Settings change detector |
| `EUa` | Managed settings security dialog renderer |
| `SUa` | Settings apply helper |
| `IUa` | Settings file writer (writeFile, datasync, close; 384-byte limit) |
| `LUa` | Settings load timeout resolver |
| `xUa` | Background settings poll scheduler |
| `Oxn` | Interval manager (setInterval / clearInterval) |
| `bPp` | Background poll executor |
| `vi` | Hook/listener registrar (`krs.register`) |
| `AKn` | Deep-equality account change detector (`Bun.deepEquals`) |
| `Ryr` | Account object differ |
| `Hn` | Notification dispatcher |
| `gmn` | Notification queue manager |
| `p3` | Notification type router |
| `f` | Process exec wrapper |
| `o8` | Path normalizer (Windows path fixer) |
| `IKn` | Feature flag + config reload coordinator |
| `asn` | Feature store initializer |
| `Fte` | Feature flag resolver |
| `Hsl` | LVO cache clearer |
| `jle` | Feature diff logger |
| `exe` | Feature experiment tracker |
| `gsl` | Feature store getter |
| `uvo` | Feature update validator |
| `Ixn` | Feature payload refresher (emits `Rst`) |
| `G1i` | Feature payload syncer (hxe/Axn/rV maps) |
| `W1i` | Feature map exporter (Object.fromEntries) |
| `r4` | Global config assembler |
| `_sl` | Config section parser |
| `l7` | Config key validator (`Y0u.has`) |
| `PHt` | Config field aggregator |
| `Srf` | Config section: TLS/cert settings |
| `Erf` | Config section: EVt-gated settings |
| `yrf` | Config section: `_rf`-gated settings |
| `brf` | Config section: `Arf`-gated settings (uppercased keys) |
| `Hrf` | Config section: remaining fields |
| `NC` | Flag-settings merger (`flagSettings`, `Cvt`) |
| `Cvt` | Config value type enforcer |
| `Qxn` | Config change broadcaster |
| `Dvs` | CA certificate cache clearer |
| `$vs` | mTLS config cache clearer |
| `V1r` | Proxy agent cache clearer |
| `_Mt` | HTTP agent rebuilder |
| `xM` | Agent instance manager |
| `f9s` | Proxy URL parser |
| `_8` | Proxy host/port parser (ports 443, 80) |
| `CVt` | Policy limits loader and watcher |
| `yjo` | Policy limits cache invalidator |
| `Sjo` | Policy limits cache reader |
| `L_e` | Policy limits feature check |
| `Acr` | Policy limits fetch scheduler (setTimeout) |
| `TF` | Policy limits HTTP fetcher |
| `Sxe` | Policy limits file path builder |
| `Tcr` | Policy limits refresh coordinator |
| `Vcc` | Policy limits apply-and-persist |
| `qcc` | Policy limits background poll (Oxn-based) |
| `rxe` | Policy limits cleanup helper |
| `cce` | Feature client teardown (clears hxe, Axn, iUt, VKr, rV) |
| `kst` | Feature client full stop (QKr + process listeners) |
| `QKr` | Interval and process-listener cleaner |
| `sFt` | Trusted-device flow skip checker |
| `rho` | Trusted-device enrollment initiator |
| `ro` | Trusted-device registration executor |
| `KMe` | Trusted-device pre-condition checker |
| `Cl` | Secure credential storage writer |
| `Gsi` | Credential store read/write/delete coordinator |
| `H6t` | Trusted-device enrollment HTTP caller (POST, 10 000 ms timeout) |
| `AF` | Feature-gated flag evaluator |
| `V1i` | Feature value getter with fallback |
| `fDp` | Trusted-device session binder |
| `Qgo` | Trusted-device session checker |
| `Cs` | CLI fatal error handler (`process.exit`) |
| `Os` | URL base builder (prod/staging/local, checks `Hdn`) |
| `Ppn` | Trusted-device payload builder |
| `Esl` | Account-change side-effect handler |
| `AVt` | Permission mode updater |
| `CKn` | Permission mode validator |
| `XKr` | Feature-gated permission evaluator |
| `P6t` | Permission map writer |
| `PH` | Permission rule manager (addRules, replaceRules, removeRules, addDirectories, removeDirectories) |
| `Br` | Task/session init param builder |
| `uZn` | Working-directory param extractor |
| `dZn` | Tool allowlist param extractor |
| `xF` | Permission disable mode setter |
| `fvo` | Session notification helper |
| `bVt` | Auto-mode config and session initializer |
| `TVt` | Auto-mode gate and model selector |
| `xY` | Auto-mode transaction manager |
| `WWo` | Auto-mode model capability checker |
| `GWo` | Auto-mode policy gate |
| `As` | Model picker helper |
| `c_e` | Model family classifier (claude-3-*, claude-opus-4-*, etc.) |
| `R1e` | Auto-mode fallback resolver |
| `d` | Supervisor/daemon config writer |
| `$ot` | Token budget helper |
| `vZ` | Session variable initializer |
| `GB` | Auto-mode gate notification builder |
| `Iye` | Permission-mode-changed event emitter |
| `wTe` | Session tool-map builder |
| `UHt` | Last-assistant-message finder |
| `Nw` | Message tail searcher (`e.findLast`) |
| `ion` | Module binding helper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.