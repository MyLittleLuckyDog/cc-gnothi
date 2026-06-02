---
type: feature-spec
feature: "login"
cc_version: "2.1.158"
updated: "2026-06-02"
tags: ["login", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.158 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/login`

> Analysis basis: CC v2.1.158 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.158

---

## Overview

`/login` allows users to switch Anthropic accounts or sign in with their Anthropic account from within the Claude Code CLI. The command renders a JSX-based interactive UI that orchestrates the full OAuth authentication flow, including credential storage, trusted-device enrollment, remote settings synchronization, and policy-limits loading. On success or cancellation it notifies the application state and updates persisted credentials.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `login` |
| description | `Switch Anthropic accounts \| Sign in with your Anthropic account` |
| loc_byte | `11346822` |
| loc_byte_end | `11347055` |
| module_id | `K51` |
| load_inline | `true` |
| arbor_handler.name | `WR1` |
| arbor_handler.fqn | `claude-2.1.158::WR1` |
| arbor_handler.kind | `Function` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.158 bundle.js:+11346822 – +11347055

---

## Input Branching

Five distinct branches are reachable from the command's handler, warranting a Mermaid flowchart.

```mermaid
flowchart TD
    A["/login invoked"] --> B{CLAUDE_TRUSTED_DEVICE_TOKEN\nenv var set?}
    B -- yes --> C[Log: skip enrollment\n(env var takes precedence)\nbundle.js:+6887105]
    B -- no --> D{Essential-traffic-only\nmode?}
    D -- yes --> E[Log: skip enrollment\nbundle.js:+6887419]
    D -- no --> F{OAuth token\npresent?}
    F -- no --> G[Log: skip enrollment — no token\nbundle.js:+6887532]
    F -- yes --> H{Same account+org\nre-login with existing token?}
    H -- yes --> I[Log: skip re-enrollment\nbundle.js:+9131800]
    H -- no --> J[Run full OAuth flow\n→ OAuthFlowComponent]
    J --> K{Flow outcome}
    K -- success --> L[Store credentials\nNotify: Login successful\nbundle.js:+9132549]
    K -- interrupted --> M[Notify: Login interrupted\nbundle.js:+9132568]
    L --> N{CLAUDE_CODE_OAUTH_TOKEN\nenv var detected?}
    N -- yes --> O[Emit override warning\nbundle.js:+9132174]
    N -- no --> P[Continue]
    O --> P
    P --> Q[Trigger trusted-device\nenrollment: OoH]
    Q --> R[Refresh remote settings\n& policy limits]
    R --> S[Done]
    C --> S
    E --> S
    G --> S
    I --> S
    M --> S
```

---

## Behavioral Spec

### 1. Command Entry — Main Handler (`WR1` / `eW8`)

The handler is resolved directly inside the registration byte range (Arbor `direct` resolution). It constructs the login React component tree and mounts it as a local-JSX command result.

```
function loginCommandHandler(appState):
    currentState = appState.getAppState()           // bundle.js:+9131955
    applyMessageOperation(currentState, "update")   // bundle.js:+9131589, +9131566
    recordTimestamp()                               // mxH → Date.now, bundle.js:+45161

    if isSameAccountReLogin(currentState):
        log("[trusted-device] Same account+org re-login … skipping re-enrollment")
                                                    // bundle.js:+9131800
        return earlyExit()

    return mountJSXComponent(LoginComponent)        // pVL → Ks.createElement, bundle.js:+9132452
```

Analysis basis: CC v2.1.158 bundle.js:+9131547

---

### 2. OAuth Flow Orchestration (`OoH`)

`OoH` is the core OAuth-flow React component. It checks policy gates before opening the browser, posts credentials, and stores the resulting token.

```
function oauthFlowComponent(props):
    if env("CLAUDE_TRUSTED_DEVICE_TOKEN") is set:
        log("[trusted-device] … skipping enrollment (env var takes precedence)")
                                            // bundle.js:+6887105
        return skipEnrollment()

    if isEssentialTrafficOnly():            // bundle.js:+6887419
        return skipEnrollment()

    if not hasOAuthToken():                 // bundle.js:+6887532
        return skipEnrollment()

    if not isPolicyAllowed():               // K.isPolicyAllowed, bundle.js:+6887282
        return policyGateBlocked()

    if isPolicyEnforced():                  // K.isPolicyEnforced, bundle.js:+6887305
        enforcePolicyBehavior()

    // Validate custom OAuth URL when CLAUDE_CODE_CUSTOM_OAUTH_URL is set
    validateOAuthEndpoint()                 // kq → HEA+z84, bundle.js:+9132601
    //   Allowed environments: "prod", "local", "staging"
    //   Error if URL not in approved list:
    //   "CLAUDE_CODE_CUSTOM_OAUTH_URL is not an approved endpoint."
    //                                      bundle.js:+951338

    response = httpPost(oauthEndpoint,      // c_.post, bundle.js:+6887633
                        headers={
                          "Content-Type": "application/json",  // bundle.js:+6887778
                          "User-Agent": …
                        },
                        timeout=10000,      // bundle.js:+6887821
                        retryDelay=500)     // bundle.js:+6887847

    if response.status == 201:              // bundle.js:+6888009
        token = response.body.device_token
        if not token:
            emitTelemetry("bridge_trusted_device_enroll", {result:"missing_token"})
                                            // bundle.js:+6887923, +6888307
            return enrollmentError("missing device_token field")
                                            // bundle.js:+6888206
        storeToken(token)                   // aK → eOq, bundle.js:+6888347
    else if response.status == 4xx or 5xx:
        emitTelemetry("bridge_trusted_device_enroll", {result:"http_error"})
                                            // bundle.js:+6888128
    else if storageFailed:
        emitTelemetry("bridge_trusted_device_enroll", {result:"storage_failed"})
                                            // bundle.js:+6888515

    if CLAUDE_CODE_OAUTH_TOKEN env var detected:
        displayWarning(
          "Warning: CLAUDE_CODE_OAUTH_TOKEN is set … unset that variable …")
                                            // bundle.js:+9132174

    notifyResult("Login successful")        // bundle.js:+9132549
    OR
    notifyResult("Login interrupted")       // bundle.js:+9132568
```

Analysis basis: CC v2.1.158 bundle.js:+6886842

---

### 3. Credential & API-Key Validation (`F3` / `Pa`)

Before completing auth, the credentials subsystem validates the key source and selects the credential provider.

```
function resolveCredentials(config):
    provider = detectProvider(config)   // WA → CH, bundle.js:+2046208
    // Recognized provider strings (bundle.js:+2046248 – +2046465):
    //   "bedrock", "foundry", "anthropicAws", "mantle", "vertex", "firstParty"

    if provider == "firstParty":
        apiKey = resolveApiKey(config)  // F3 → nN, bundle.js:+2944725
        // Checks in order:
        //   1. ANTHROPIC_API_KEY env var          bundle.js:+2944701
        //   2. apiKeyHelper script                bundle.js:+2944795
        //   3. CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR bundle.js:+2068556
        //   4. OAuth token (profile-implicit)     bundle.js:+2941673
        //        auth type: "user_oauth"          bundle.js:+2941746

        if no credential found:
            throw Error(
              "ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, CLAUDE_CODE_OAUTH_TOKEN, " +
              "or WIF env vars … required")  // bundle.js:+2945164

    if provider == "gateway":           // bundle.js:+6920629
        resolveGatewayAuth()
        // Sub-types: "local-agent", "enterprise", "team"
        //            bundle.js:+6920769, +6920857, +6920879

    flagSettings = loadFlagSettings()   // bundle.js:+2945769
    return credentialObject
```

Analysis basis: CC v2.1.158 bundle.js:+2944614

---

### 4. Secure Credential Storage (`aK` / `eOq`)

Credentials are written using a primary secure-storage path with a plaintext fallback.

```
function storeCredential(cred):
    try:
        result = primaryStore.write(cred)        // eOq → H.read+H.update, bundle.js:+2230038
        emitTelemetry("secure_storage_credentials_write")
                                                 // bundle.js:+2230690
        if primaryTransientError and not fallbackAllowed:
            emitTelemetry("primary_transient_skip_fallback")
                                                 // bundle.js:+2230788
            return

    catch primaryFailure:
        emitTelemetry("plaintext_fallback_used") // bundle.js:+2230937
        plaintextFallback.write(cred)

    if both primary and fallback fail:
        emitTelemetry("primary_and_fallback_failed")
                                                 // bundle.js:+2231040
        raise storageError
```

Analysis basis: CC v2.1.158 bundle.js:+2230313

---

### 5. Remote Managed Settings Refresh (`WoH` / `xy_` / `is7`)

After a successful credential change the handler triggers a remote-settings pull.

```
function refreshAfterAuthChange():
    log("Remote settings: Refreshed after auth change")   // bundle.js:+6926278

    settingsResult = fetchRemoteSettings()                // cs7 → yR9, bundle.js:+6922163
    // HTTP responses handled:
    //   200 → parse and validate                        bundle.js:+6922645
    //   204 → no content                               bundle.js:+6922654
    //   304 → "Using cached settings (304)"            bundle.js:+6922705
    //   401 → force-refresh retry                      bundle.js:+6923585, telemetry +6923654
    //   404 → delete cached file                       bundle.js:+6925453, +6925469

    // Retry back-off (q_H): base=32000ms, pow=0.25, jitter via Math.random
    //                       cap=32000, floor=10, parseInt      bundle.js:+10520463

    if fetchFailed and staleCache available:
        log("Remote settings: Using stale cache after fetch failure")
                                                              // bundle.js:+6924767
        emitLiteral("remote_managed_settings_fetch_failed")   // bundle.js:+6924716

    if newSettings differ from cached:
        checksum = sha256(normalize(newSettings))              // dS9, bundle.js:+6893244
        showSecurityDialog()                                   // ER9 → ms7, bundle.js:+6919712
        // Dialog outcomes:
        //   "approved"  → applySettings     bundle.js:+6919385
        //   "rejected"  → use cached        bundle.js:+6925174

    notifyChange()                                            // Cy_ → HC.notifyChange, bundle.js:+6926373
```

Analysis basis: CC v2.1.158 bundle.js:+6926267

---

### 6. Policy Limits Load (`y26` / `uS9` / `Ps7`)

Concurrently with remote settings, policy limits are fetched and cached.

```
function loadPolicyLimits():
    emitTelemetry("tengu_policy_limits_fetch")   // bundle.js:+6883031

    // Auth-type routing:
    //   "wif"     → WIF endpoint     bundle.js:+6881001
    //   "oauth"   → OAuth endpoint   bundle.js:+6881040
    //   "api_key" → key endpoint     bundle.js:+6881057

    response = fetchWithRetry(policyEndpoint)    // js7 → q_H, bundle.js:+6881232

    if response.status == 304:
        log("Policy limits: Cache still valid (304 Not Modified)")
                                                 // bundle.js:+6883444
    else if fetchFailed and staleCache:
        log("Policy limits: Using stale cache after fetch failure")
                                                 // bundle.js:+6883273
        emitLiteral("stale_cache_used")          // bundle.js:+6883341
    else if success:
        applyRestrictions()                      // uS9 → Xs7, bundle.js:+6883556
        log("Policy limits: Applied new restrictions successfully")
                                                 // bundle.js:+6883602
    else if empty:
        log("Policy limits: No restrictions (cached empty)")
                                                 // bundle.js:+6883657

    if backgroundPollChange:
        log("Policy limits: Changed during background poll")
                                                 // bundle.js:+6884584
        emitLiteral("policy_limits_poll")        // bundle.js:+6884526

    if loadingPromiseTimedOut:
        log("Policy limits: Loading promise timed out, resolving anyway")
                                                 // bundle.js:+6880358
```

Analysis basis: CC v2.1.158 bundle.js:+6884265

---

### 7. Interactive JSX Component (`pXH` / `kw` / `tL1`)

The login UI is a React component rendered inline by the `local-jsx` command type.

```
function LoginComponent(props):
    [state, dispatch] = useReducer(loginReducer)   // tL1 → phH.useReducer, bundle.js:+9129876
    memoizedFlow     = useMemo(computeFlow)         // kw → phH.useMemo, bundle.js:+9130171
    modelParser      = parseModelString(_1)         // kw → _1, bundle.js:+9130187

    useEffect(subscribeToEvents, [])               // tL1 → phH.useEffect, bundle.js:+9129910

    onDone = H.onDone                              // bundle.js:+9132792

    registerHandler("confirm:no", cancelHandler)  // M_ → L.registerHandler, bundle.js:+4021874
                                                   // literal "confirm:no" bundle.js:+9132951

    // Key bindings rendered in UI:
    //   "Ctrl-C"  → interrupt/cancel             bundle.js:+4064978
    //   "Ctrl-D"  → exit                         bundle.js:+4065023
    //   "Esc"     → cancel                       bundle.js:+9133172
    //   "Press [x] again to exit"                bundle.js:+9133066

    // Width constants for layout:
    //   21 columns   bundle.js:+9132620
    //   3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,19 (slot indices)

    return createElement("Login",                  // bundle.js:+9133656
        renderPermissionView("permission"))        // bundle.js:+9133681
```

Analysis basis: CC v2.1.158 bundle.js:+9132614

---

### 8. App-State Mutation (`_$` / `AkH` / `tZ6`)

On outcome the handler writes login state back to the application store.

```
function updateAppState(outcome):
    currentAppState = H.getAppState()            // bundle.js:+9131955

    // Permission-mode change handling:
    //   "setMode"              bundle.js:+4667124
    //   "bypassPermissions"    bundle.js:+10420593
    //   Guard: if disableBypassPermissionsMode set, log and skip
    //                          bundle.js:+4667212

    // Rule operations applied:
    //   "addRules"         → alwaysAllowRules / alwaysDenyRules / alwaysAskRules
    //   "replaceRules"     bundle.js:+4667836
    //   "removeRules"      bundle.js:+4668493
    //   "addDirectories"   bundle.js:+4668147
    //   "removeDirectories" bundle.js:+4668877

    appState.setAppState(newState)               // bundle.js:+9132051
    HC.notifyChange("policySettings")            // Cy_, bundle.js:+6926389
```

Analysis basis: CC v2.1.158 bundle.js:+9131971

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_remote_settings_401_force_refresh_retry` | Fired on 401 response from remote-settings endpoint (bundle.js:+6923654) |
| Telemetry: `tengu_feature_bad` | Fired when a feature flag check fails (bundle.js:+966091) |
| Telemetry: `tengu_feature_ok` | Fired when a feature flag check passes (bundle.js:+966033) |
| Telemetry: `tengu_feature_sad` | Fired on a degraded feature-flag state (bundle.js:+966168) |
| Telemetry: `tengu_managed_settings_security_dialog_shown` | Fired when the managed-settings security dialog is displayed (bundle.js:+6919712) |
| Telemetry: `tengu_managed_settings_security_dialog_accepted` | Fired when user accepts new managed settings (bundle.js:+6919396) |
| Telemetry: `tengu_managed_settings_security_dialog_rejected` | Fired when user rejects new managed settings (bundle.js:+6919446) |
| Telemetry: `tengu_policy_limits_fetch` | Fired at start of every policy-limits HTTP request (bundle.js:+6883031) |
| Telemetry: `tengu_disable_bypass_permissions_mode` | Fired when bypass-permissions mode is blocked (bundle.js:+10419832) |
| Telemetry: `tengu_auto_mode_config` | Fired when auto-mode configuration is evaluated (bundle.js:+10417860) |
| Telemetry: `tengu_daemon_config_reload` | Fired when daemon config is reloaded after login (bundle.js:+15482137) |
| Credential storage | Writes OAuth token via primary secure storage; falls back to plaintext. Emits `secure_storage_credentials_write`, `plaintext_fallback_used`, `primary_and_fallback_failed` (bundle.js:+2230690) |
| Remote settings | Fetches and validates managed settings over HTTPS; writes cache file; fires `HC.notifyChange("policySettings")` (bundle.js:+6926373) |
| Policy limits | Fetches usage restrictions; stores to cache file via `Xs7 → k26.writeFile` (bundle.js:+6882693) |
| Trusted-device enrollment | POSTs to bridge endpoint; stores device token; emits `bridge_trusted_device_enroll` telemetry with result code (bundle.js:+6887923) |
| Hook registration | `M_ → L.registerHandler` registers `"confirm:no"` keyboard handler for cancel (bundle.js:+4021874) |
| appState changes | `H.setAppState` updates permission rules and mode after login outcome (bundle.js:+9132051) |
| Process listeners | `RQH` clears multiple interval/listener sets on cleanup: `izH`, `__8`, `oz6`, `Bz_`, `PU` (bundle.js:+3188473) |
| Sound | Not observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.158 | Initial analysis |

---

## Common Mistakes

1. **`CLAUDE_CODE_OAUTH_TOKEN` env var override**: Setting this environment variable before running `/login` will cause the new token to be silently overridden at runtime. The CLI emits a warning (bundle.js:+9132174), but users frequently miss it. Unset the variable after logging in.

2. **`CLAUDE_CODE_CUSTOM_OAUTH_URL` must be an approved endpoint**: Only `prod`, `local`, and `staging` environment URLs are permitted. Any other value causes an immediate error: "CLAUDE_CODE_CUSTOM_OAUTH_URL is not an approved endpoint." (bundle.js:+951338).

3. **Re-login with the same account skips trusted-device re-enrollment**: If the same account+org combination is detected with an existing token, enrollment is silently skipped (bundle.js:+9131800). This is intentional, but operators expecting a fresh enrollment must revoke the old token first.

4. **Essential-traffic-only mode suppresses enrollment**: When the network is constrained to essential traffic, the trusted-device enrollment step is bypassed without error (bundle.js:+6887419).

5. **Policy limits and remote settings are fetched asynchronously after login**: Subsequent commands may briefly operate on stale limits if issued immediately after `/login` before the background fetch completes.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `WR1` | Main login command handler (Arbor-resolved, `direct` path) |
| `eW8` | Login command core function; orchestrates state and component mount |
| `pVL` | Login JSX wrapper component (renders `Ks.createElement`) |
| `pXH` | Interactive login UI React component |
| `kw` | Login UI hook/memo setup |
| `tL1` | Login UI reducer + effect initialiser |
| `OoH` | OAuth flow component; handles trusted-device enrollment |
| `aK` | Credential-read orchestrator |
| `eOq` | Secure credential read/write core |
| `oTH` | Inner credential async-read helper |
| `WoH` | Auth-change → settings/policy refresh coordinator |
| `xy_` | Remote managed settings apply/update function |
| `is7` | Remote settings incremental sync |
| `cs7` | Remote settings fetch dispatcher |
| `yR9` | Remote settings HTTP fetch worker |
| `q_H` | Exponential back-off/jitter calculator |
| `dS9` | Settings payload hasher (sha256) |
| `jy_` | Recursive settings normaliser |
| `ER9` | Settings security-check / dialog gate |
| `ms7` | Managed-settings security dialog controller |
| `ZR9` | Settings approval state machine |
| `woH` | Settings header/key normaliser |
| `C38` | Settings key extractor |
| `sS9` | Settings structure validator |
| `bU` | Settings write-permission guard |
| `VR9` | Settings rejection handler |
| `ls7` | Settings cache file writer |
| `SR9` | Remote settings background poll manager |
| `E38` | Background poll interval controller |
| `Cy_` | Settings change notifier (calls `HC.notifyChange`) |
| `SH` | Settings notification queue |
| `G_4` | Notification queue ring-buffer manager |
| `y26` | Policy limits load entry point |
| `uS9` | Policy limits fetch + apply worker |
| `Ps7` | Policy limits background-poll handler |
| `mS9` | Policy limits poll coordinator |
| `Ds7` | Policy limits payload hasher |
| `ws7` | Policy limits request builder |
| `js7` | Policy limits retry-loop |
| `Xs7` | Policy limits cache file writer |
| `Ky_` | Policy limits load-timeout guard |
| `v38` | Policy limits timeout + fallback scheduler |
| `QR` | Policy limits HTTP fetch core |
| `rcH` | Policy limits cache-file path resolver |
| `Dw6` | Policy limits cache-file reader |
| `I38` | Policy limits load orchestrator |
| `F3` | API-key resolution and credential construction |
| `Pa` | Credential provider selector |
| `WA` | Provider type classifier |
| `CH` | String-based provider/key helper |
| `nN` | API-key environment variable reader |
| `pP` | Auth-token profile builder |
| `DM6` | File-descriptor API key reader |
| `wR` | Token substring extractor (slice, length 20) |
| `S6` | Flag-settings loader |
| `BZ` | Credential serialiser |
| `fz6` | Credential deserialiser |
| `_0H` | Credential field accessor |
| `u3` | Credential utility (small helper) |
| `u5` | Credential utility (small helper) |
| `Z3H` | Settings cache clear helper |
| `vz` | Dual-cache clear (`yC6`, `uu8`) |
| `_K4` | Settings structure deserialiser |
| `cb` | Conversation-state accessor |
| `zP` | Structured-clone wrapper |
| `IR9` | Settings state initialiser |
| `bK` | Settings rejection classifier |
| `N` | File-based config loader |
| `lCK` | Config file reader |
| `RH` | JSON stringify wrapper |
| `v4` | Config path resolver |
| `EuH` | Config normaliser |
| `rCK` | Config file write worker (with `Buffer.byteLength`, chunk size 1000/100) |
| `iHH` | Session cleanup / event-emitter teardown |
| `RQH` | Resource cleanup (clears intervals, process listeners, Maps) |
| `lz_` | Interval + process-listener cleaner |
| `Ex` | Event-emitter factory |
| `Zx` | Emitter chain helper |
| `NR` | Emitter core |
| `_7` | Credential model builder (EY + S6) |
| `EY` | Model object assembler |
| `eO6` | Header formatter |
| `ogH` | HTTP header builder |
| `NO` | Provider-aware wrapper |
| `Yy_` | Login state machine step |
| `Z_` | Module initialiser |
| `PLH` | Login progress/phase controller |
| `G6` | Login phase step executor |
| `q_8` | Deduplication guard (Bz_/izH sets) |
| `Cy` | Streaming-response phase handler |
| `WFq` | Feature-value streamed-response handler |
| `Ws7` | Transition helper (ku + Z_) |
| `$y_` | Phase-5 transition helper |
| `kq` | OAuth endpoint validator |
| `HEA` | Hostname extractor |
| `z84` | Environment classifier (prod/local/staging) |
| `EH` | Error string coercer |
| `eL1` | Login continuation callback |
| `tZ6` | App-state transition coordinator |
| `tW8` | Permission-mode change worker |
| `cz_` | Streaming-state permission merger |
| `AkH` | App-state permission rule applier |
| `_$` | Permission rule set mutator |
| `vM` | Rule validation helper |
| `V_` | Session-init-flag reader |
| `LV8` | `working_directory` init flag handler |
| `fV8` | `allowed_tools` / `disallowed_tools` init flag handler |
| `QF_` | Post-login callback dispatcher |
| `eZ6` | Main component loop / render cycle |
| `HE6` | Render frame builder |
| `rHH` | Streaming-feature check |
| `K_8` | Feature-gate streaming wrapper |
| `pi_` | Render phase pre-check |
| `mi_` | Model-aware render guard |
| `J9` | Message parser entry |
| `se` | Message segment classifier |
| `_1` | Model-string parser (opusplan/sonnet/haiku/opus/best) |
| `PX` | Parsed-model container |
| `lgH` | Model display-name resolver |
| `f9` | Model-family classifier (claude-3-x, claude-opus-4-x, etc.) |
| `iH8` | Display-name formatter |
| `C66` | OQ accessor |
| `Y` | Terminal output writer |
| `u2H` | Terminal output formatter |
| `xe1` | Terminal column layout calculator |
| `f` | Terminal file handle manager |
| `G` | Supervisor/heartbeat controller |
| `E` | Config-reload daemon |
| `dVK` | Heartbeat emitter |
| `V` | Daemon start/stop controller |
| `Vs` | Render visibility state |
| `uS` | Render update scheduler |
| `Z7H` | Event-sequence emitter (D4) |
| `D4` | Structured event builder |
| `i5H` | Permission-mode event mapper |
| `J6` | AppState context reader |
| `hJ_` | Context null-guard |
| `tL1` | UI reducer + effect |
| `$d` | External store subscription |
| `DFq` | Microtask-deferred dispatch |
| `E0` | Command-line model selector |
| `GA` | Auth-model combiner |
| `DR` | Array/includes type guard |
| `AHH` | Plan-model resolver |
| `f1` | Plan classifier (max/default_claude_max_5x/pro etc.) |
| `FOH` | Enterprise-usage-based plan handler |
| `Hd` | wq_ plan handler |
| `MFH` | jyq plan handler |
| `jyq` | Plan → `_7` forwarder |
| `cG` | Model+width combiner |
| `iM` | WA-delegate model helper |
| `w5` | pxH+WA model builder |
| `yP` | Full model resolution pipeline |
| `o1H` | CH-based model string helper |
| `a1H` | f1-delegate model helper |
| `UN` | Unified model+width selector |
| `zD` | Context hook (KvH) |
| `M_` | Global keyboard handler registrar |
| `fj` | Context accessor (lYH) |
| `SM` | Scroll/dialog manager |
| `D89` | Dialog state controller |
| `zP_` | Dialog component (useState/useMemo/useCallback) |
| `pR` | Polling ref + callback |
| `M` | Temp-file cleanup (q0.rm) |
| `mxH` | Timestamp recorder (Date.now) |
| `My_` | Policy-limits pre-load trigger |
| `c4H` | Auth-type filter (B3q/ngH) |
| `B3q` | Auth-type set |
| `ngH` | Auth-type unknown handler |
| `Yw6` | Policy-limits cache-path helper |
| `apH` | Login app-state accessor |
| `hH` | Error-logging helper (`d` delegate) |
| `bH` | Info-logging helper (`d` delegate) |
| `t6` | Warning-logging helper (`d` delegate) |
| `d` | Logger core |
| `QzH` | Login-phase state helper |
| `ojH` | Login early-exit helper |