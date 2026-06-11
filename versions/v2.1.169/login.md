---
type: feature-spec
feature: "login"
cc_version: "2.1.169"
updated: "2026-06-11"
tags: ["login", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.169 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/login`

> Analysis basis: CC v2.1.169 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.169

---

## Overview

The `/login` command initiates an interactive OAuth-based authentication flow that allows users to sign in with their Anthropic account or switch between Anthropic accounts. It renders a JSX UI component that manages the full login lifecycle — from credential collection through secure token storage — and updates application state upon successful authentication. The command also handles trusted-device enrollment and remote-settings refresh following a successful sign-in.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `login` |
| description | `Switch Anthropic accounts \| Sign in with your Anthropic account` |
| module_id | `FGq` |
| load_inline | `true` |
| loc_byte | `11738790` |
| loc_byte_end | `11739010` |
| loc_line | `8069` |
| arbor_handler.name | `Hoq` |
| arbor_handler.fqn | `claude-2.1.169::Hoq` |
| arbor_handler.kind | `Function` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.169 bundle.js:+11738790

The registration block spans bytes `(11738790, 11739010)`. Because `load_inline` is `true`, there is no separate `module_id` indirection; the handler is resolved directly via the Arbor symbol graph to `Hoq` (`arbor_handler.resolution_path: "direct"`). The `handler_name` field in the index independently corroborates the primary render entrypoint as `Wqf` (the JSX component tree root), while `Hoq` is the outer function that returns the registration object containing that component.

---

## Input Branching

The `/login` flow has more than three distinct runtime paths (fresh login, interrupted login, same-account re-login skip, OAuth-token-override warning, and trusted-device conditional enrollment), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/login invoked"]) --> B{Existing OAuth token\nmatches current account+org?}
    B -- Yes --> C["Log: same-account re-login,\nskip re-enrollment\n(bundle.js:+9512257)"]
    C --> Z([Done — no-op])

    B -- No --> D["Render Login JSX component\n(Wqf / j0H)"]
    D --> E{User action}

    E -- "Completes OAuth flow" --> F["Receive credential token"]
    F --> G{CLAUDE_CODE_OAUTH_TOKEN\nenv var set?}
    G -- Yes --> H["Emit warning:\nenv var will override token\n(bundle.js:+9512631)"]
    H --> I["Store credential securely\n(mT1 / secure_storage_credentials_write)"]
    G -- No --> I

    I --> J["Update appState\n(H.setAppState — bundle.js:+9512508)"]
    J --> K["Trigger remote-settings refresh\n(tH6 / bg_ / xI7)"]
    K --> L{Trusted-device enrollment\nconditions met?\n(FH6)"}
    L -- "Env var CLAUDE_TRUSTED_DEVICE_TOKEN set" --> M["Skip enrollment\n(bundle.js:+7310587)"]
    L -- "Essential-traffic-only mode" --> N["Skip enrollment\n(bundle.js:+7310901)"]
    L -- "No OAuth token" --> O["Skip enrollment\n(bundle.js:+7311014)"]
    L -- "Conditions OK" --> P["POST bridge_trusted_device_enroll\n(bundle.js:+7311405)"]
    P --> Q{HTTP status}
    Q -- "201" --> R["Store device token\n(bundle.js:+7311491)"]
    Q -- "Other" --> S["Record http_error telemetry\n(bundle.js:+7311610)"]
    R --> T(["Login successful\n(bundle.js:+9513006)"])
    S --> T
    M --> T
    N --> T
    O --> T

    E -- "Interrupts / Cancels" --> U["Display 'Login interrupted'\n(bundle.js:+9513025)"]
    U --> Z2([Done])
```

---

## Behavioral Spec

### 1. Re-login Guard (same-account short-circuit)

Before rendering any UI, the handler checks whether an existing OAuth credential already matches the account and organization the user would be logging into.

```
function reloginGuard(currentToken, incomingAccount, incomingOrg):
    if currentToken exists
        AND currentToken.account == incomingAccount
        AND currentToken.org    == incomingOrg:
        log("[trusted-device] Same account+org re-login with existing token, skipping re-enrollment")
        return SKIP
    return PROCEED
```

Analysis basis: CC v2.1.169 bundle.js:+9512249 (call to `G2H`), +9512257 (log literal)

### 2. Login JSX Component Tree

When the guard passes `PROCEED`, the `local-jsx` type causes CC to mount the React component exported by the `Wqf` / `j0H` component tree. Key hooks used:

```
component LoginRoot(props):
    [state, dispatch] = useReducer(loginReducer, initialState)  // xGq
    appState          = useAppStateContext()                      // j6 / Ov_
    themeContext      = useThemeContext()                         // Dw
    [done, setDone]   = useState(false)                          // BGq.useState
    keyHandler        = useKeyHandler(...)                        // y_

    on props.onDone callback:
        if outcome == SUCCESS:
            maybeWarnOAuthEnvOverride()
            finalize(credential)
        else:
            showInterrupted()

    return <LoginUI state={state} dispatch={dispatch} />
```

Analysis basis: CC v2.1.169 bundle.js:+9512973 (`Wqf` → `UI8`), +9513083 (`j0H` → `IJ`), +9513101 (`BGq.useState`), +9513249 (`H.onDone`)

### 3. OAuth Environment-Variable Override Warning

If the environment variable `CLAUDE_CODE_OAUTH_TOKEN` is set at the time the user completes login, the command emits a prominently displayed warning before proceeding to store the new credential:

```
function maybeWarnOAuthEnvOverride(env):
    if env.CLAUDE_CODE_OAUTH_TOKEN is set:
        displayWarning(
            "Warning: CLAUDE_CODE_OAUTH_TOKEN is set … unset that variable …"
        )
        // literal at bundle.js:+9512631
```

Analysis basis: CC v2.1.169 bundle.js:+9512631

### 4. Credential Acceptance and Application-State Update

```
function finalizeLogin(credential):
    applyMessageOp("update", credential)    // H.applyMessageOp, literal "update" at +9512046
    setAppState(newAuthFields)              // H.setAppState at +9512508
    getAppState()                           // H.getAppState at +9512412
```

Analysis basis: CC v2.1.169 bundle.js:+9512023, +9512046, +9512412, +9512508

### 5. Secure Credential Storage

The credential token is written via the cross-platform secure-storage subsystem (`mT1`). Storage outcomes are tracked with dedicated telemetry strings:

| Outcome | Literal key |
|---|---|
| Primary write succeeded | `secure_storage_credentials_write` |
| Primary transient skip → no fallback | `primary_transient_skip_fallback` |
| Plaintext fallback used | `plaintext_fallback_used` |
| Both primary and fallback failed | `primary_and_fallback_failed` |

Analysis basis: CC v2.1.169 bundle.js:+2289691, +2289789, +2289938, +2290041

### 6. Post-Login Remote-Settings Refresh

After state is updated, the login handler triggers a remote-settings pull cycle (`tH6` → `bg_`). This refreshes cached managed settings so that any org-level policy changes take effect immediately in the new session.

```
function postLoginRefresh(authChangeSignal):
    remoteSettingsManager.refresh(authChangeSignal)   // bg_ / xI7
    log("Remote settings: Refreshed after auth change")  // literal at +7359972
```

Analysis basis: CC v2.1.169 bundle.js:+7359946, +7359972

### 7. Policy-Limits Refresh

In parallel with remote settings, the policy-limits subsystem (`sV6` / `vP8`) also refreshes:

```
function postLoginPolicyRefresh():
    policyLimitsManager.refreshAfterAuth()   // sV6 at +9512091
    log("Policy limits: Refreshed after auth change")  // literal at +7307788
```

Analysis basis: CC v2.1.169 bundle.js:+9512091, +7307788

### 8. Trusted-Device Enrollment

After auth is confirmed, the trusted-device enrollment function (`FH6`) runs with the following short-circuit checks:

```
function enrollTrustedDevice(oauthToken, platform, networkMode):
    if env.CLAUDE_TRUSTED_DEVICE_TOKEN is set:
        log("[trusted-device] CLAUDE_TRUSTED_DEVICE_TOKEN env var is set, skipping")
        return  // bundle.js:+7310587

    if networkMode == "essential-traffic":
        log("[trusted-device] Essential traffic only, skipping enrollment")
        return  // bundle.js:+7310901

    if oauthToken is null:
        log("[trusted-device] No OAuth token, skipping enrollment")
        return  // bundle.js:+7311014

    response = POST("bridge_trusted_device_enroll", payload,
                    timeout=10000ms, retryDelay=500ms)  // +7311303, +7311329

    if response.status == 201:                           // +7311491
        if response.body.device_token is missing:
            emitTelemetry("bridge_trusted_device_enroll", outcome="missing_token")
            return  // +7311789
        storeDeviceToken(response.body.device_token)
    else:
        emitTelemetry("bridge_trusted_device_enroll", outcome="http_error")  // +7311610
```

Analysis basis: CC v2.1.169 bundle.js:+7310587, +7310901, +7311014, +7311303, +7311329, +7311405, +7311491, +7311610, +7311789

### 9. Bootstrap API Fetch (dependency on `H` / `N`)

During the login sequence the bootstrap fetch utility (`H` → `N`) is invoked to retrieve initial configuration:

```
function bootstrapFetch(url):
    log("[Bootstrap] Fetching", url)        // literal at +16097956
    headers = {
        "Content-Type": "application/json", // +16098041, +16098056
        "User-Agent":   <userAgent>,        // +16098075
    }
    response = fetch(url, headers, timeout=5000)  // number 5000 at +16098157
    if parse fails:
        emitTelemetry("api_bootstrap_fetch", result="parse_failed")  // +16098278, +16098300
    else:
        log("[Bootstrap] Fetch ok")          // +16098330
```

Analysis basis: CC v2.1.169 bundle.js:+16097954, +16097956, +16098157

### 10. Interrupt / Cancel Path

If the user presses `Esc` or `Ctrl-C` during the login flow, the `onDone` callback receives a non-success signal:

```
function handleInterrupt():
    displayMessage("Login interrupted")    // literal at +9513025
    cleanupLoginComponent()
```

Analysis basis: CC v2.1.169 bundle.js:+9513025

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — feature flag checks | `tengu_feature_ok` (+1013926), `tengu_feature_bad` (+1013988), `tengu_feature_sad` (+1014069) |
| Telemetry — remote settings | `tengu_remote_settings_401_force_refresh_retry` (+7357429) |
| Telemetry — managed settings security dialog | `tengu_managed_settings_security_dialog_shown` (+7353041), `tengu_managed_settings_security_dialog_accepted` (+7352693), `tengu_managed_settings_security_dialog_rejected` (+7352743) |
| Telemetry — policy limits | `tengu_policy_limits_fetch` (+7306326) |
| Telemetry — trusted-device enrollment | `bridge_trusted_device_enroll` (outcome keys: `http_error`, `missing_token`, `unknown`, `storage_failed`) (+7311405) |
| Telemetry — bypass permissions mode | `tengu_disable_bypass_permissions_mode` (+11015640) |
| Telemetry — auto-mode config | `tengu_auto_mode_config` (+11013530) |
| Telemetry — daemon config reload | `tengu_daemon_config_reload` (+16521994) |
| Telemetry — keybinding fallback | `tengu_keybinding_fallback_used` (+4152476) |
| appState changes | `H.setAppState` called with new auth fields after successful login (+9512508); `H.getAppState` read before writing (+9512412) |
| Secure storage write | `mT1` writes credential via OS keychain / plaintext fallback; emits `secure_storage_credentials_write` on success |
| Remote-settings side effect | Full remote-settings refresh cycle initiated post-login (+7359972) |
| Policy-limits side effect | Policy-limits cache refreshed post-login (+7307788) |
| Trusted-device POST | HTTP POST to `bridge_trusted_device_enroll` endpoint on macOS (`darwin`) when conditions are met (+7311210, +7311405) |
| Environment-variable warning | Warning displayed if `CLAUDE_CODE_OAUTH_TOKEN` is present in env (+9512631) |
| Hook registration | `y_` registers a keyboard handler via `L.registerHandler` (+4109526); `fl` subscribes to the app event bus via `jiH.subscribe` (+3247679) |
| Process lifecycle listeners | `PiH` clears multiple internal maps (`qJH`, `EL8`, `tX6`, `zG_`, `sB`) and calls `process.off` on cleanup (+3251716); `XG_` removes `clearInterval` / `process.removeListener` on exit (+3252476, +3252511) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.169 | Initial analysis |

---

## Common Mistakes

1. **Leaving `CLAUDE_CODE_OAUTH_TOKEN` set after login.** The command warns about this explicitly (bundle.js:+9512631) but does not unset the variable itself. The new login token will be silently overridden at the next startup until the environment variable is removed.
2. **Running `/login` when already signed in to the same account/org.** The re-login guard will silently no-op (+9512257) without displaying any UI, which can appear to do nothing if the user expects a confirmation screen.
3. **Expecting trusted-device enrollment on non-macOS platforms.** The enrollment POST is only issued on `darwin` (+7311210); other platforms skip this step without error.
4. **Assuming the command works without network access.** Both the bootstrap fetch (timeout: 5 000 ms, +16098157) and the trusted-device enrollment endpoint (timeout: 10 000 ms, +7311303) require outbound connectivity; essential-traffic-only mode skips enrollment entirely (+7310901).
5. **Interrupting login with Ctrl-C expecting a partial credential save.** An interrupted flow emits `"Login interrupted"` (+9513025) and discards any credential collected so far; no partial state is persisted.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Hoq` | Outer registration-factory function (arbor_handler; returns the `/login` command registration object) |
| `Wqf` | Login JSX root component (handler_name; top-level render function) |
| `UI8` | Inner login logic component (mounts OAuth UI, manages credential flow) |
| `j0H` | Login shell component (wraps `IJ` + key/state plumbing) |
| `IJ` | Login state machine component (useReducer + useMemo + calls `c9` / `hG`) |
| `xGq` | Login reducer hook (useReducer + useEffect; drives state transitions) |
| `FH6` | Trusted-device enrollment function |
| `mT1` | Secure credential storage writer |
| `KNH` | Async credential read / update helper |
| `tH6` | Post-login orchestrator (remote-settings + policy-limits refresh) |
| `bg_` | Remote-settings background refresh function |
| `sV6` | Policy-limits refresh function |
| `xI7` | Remote-settings change-on-poll handler |
| `Rg_` | Remote-settings loading-promise timeout handler |
| `Ca9` | Remote-settings security-check orchestrator |
| `Ua9` | Remote-settings HTTP fetch function |
| `CI7` | Remote-settings retry / backoff controller |
| `dAH` | Exponential-backoff delay calculator |
| `Go9` | Policy-limits cache load and apply function |
| `vP8` | Policy-limits fetch-and-store function |
| `To9` | Policy-limits background-poll loop |
| `HI7` | Policy-limits poll iteration handler |
| `aP8` | Remote-settings notification dispatcher |
| `Gh6` | Permission-mode / app-state update handler |
| `Th6` | App-state reconciler (permission mode, auto-mode config, model settings) |
| `N9A` | Auto-mode config applicator |
| `dwH` | Model-name resolver for extended-thinking eligibility |
| `RfH` | Permission-mode-changed event emitter |
| `m4` | Permission event dispatcher |
| `c3H` | App-state entry mapper |
| `YO` | Permission-state update function |
| `wv6` | Permission store subscriber |
| `pI8` | `bypassPermissions` mode guard |
| `jG_` | Disable-bypass-permissions telemetry emitter |
| `FL` | Authentication config loader |
| `IY` | Auth config resolver (reads API key, OAuth token, WIF settings) |
| `AO` | API key / auth source resolver |
| `_j` | Auth profile builder |
| `Cv` | API key helper runner |
| `y6` | Auth change notifier / event emitter |
| `rF_` | Main conversation-session initializer |
| `FH6` | (see above — trusted-device enrollment) |
| `OMH` | Session context dispatcher |
| `D6` | Session feature-gate evaluator |
| `VL8` | Feature-value lookup with caching |
| `V4` | Conversation-history manager |
| `X_H` | Session cleanup / teardown function |
| `PiH` | Internal-map clear on exit |
| `XG_` | Process listener removal on exit |
| `su` | Subscription manager init |
| `lC` | Low-level subscription setup |
| `tu` | Transport-level session utility |
| `H3` | Input handler manager |
| `R39` | Key-binding registry |
| `cN_` | Input capture component |
| `Mb` | Debounced input callback hook |
| `N4` | Input context hook |
| `y_` | Keyboard-handler registration hook |
| `Yw` | Theme/context accessor |
| `fl` | App-event-bus subscription hook |
| `$e1` | Microtask-queued event pump |
| `n3` | Model-name sanitizer |
| `M9` | Model-alias resolver |
| `Cc` | Model capability checker |
| `c9` | Model name normalizer / tokenizer |
| `TLH` | Allowed-model-list checker |
| `Mk` | Opus-plan model mapper |
| `AE` | Model tier resolver |
| `zM` | Provider-type classifier |
| `eD` | Model metadata extractor |
| `hG` | Model descriptor builder |
| `R4` | API-key format validator / masker |
| `qZA` | Key prefix mapper |
| `N` | Bootstrap HTTP fetch |
| `ItK` | HTTP-response parser |
| `vGA` | Redirect-URL resolver |
| `rBH` | Credential file writer |
| `lEA` | Low-level file write for credentials |
| `StK` | Conversation-log writer |
| `TBH` | Async write-queue manager |
| `_4H` | Log-file path builder |
| `Vo8` | Log-file rotation handler |
| `htK` | Log-file append function |
| `MZA` | Log directory path resolver |
| `n56` | EISDIR error handler |
| `Z9` | Cleanup-hook registrar (ZGA.register) |
| `CH` | JSON serializer wrapper |
| `w2_` | String splitter / trimmer utility |
| `u6H` | Feature-flag set membership checker |
| `o6` | Event emitter dispatcher |
| `K6` | Core event-bus emitter |
| `c76` | Low-level event handler |
| `$BH` | Timestamp generator (Date.now wrapper) |
| `Sg_` | Pre-session signal handler |
| `sn` | Session initialization builder |
| `YA` | String-conversion utility |
| `_6` | Primitive-to-string coercer |
| `qZH` | Session-queue state accessor |
| `W$` | Promise-result unwrapper |
| `$f` | Session-feature-flag accessor |
| `JE` | Tool-use dispatcher (D9) |
| `OX6` | Tool-output dispatcher (D9) |
| `AO` | (see above) |
| `i7` | Bare-repo detection (`--bare` flag) |
| `wBH` | VS Code extension check (`claude-vscode`) |
| `$D6` | API-key-file-descriptor reader (`CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR`) |
| `hC` | Credential string slicer (length 20) |
| `aP8` | (see above — notification dispatcher) |
| `hH` | Notification queue manager |
| `kq` | Notification deduplicator |
| `av4` | Notification ring-buffer manager |
| `Rg_` | (see above) |
| `Ra9` | Remote-settings timeout resolver |
| `C4H` | Cache-invalidation handler |
| `Zy4` | Cache-entry validator |
| `yO` | Dual-cache clear function (`aB6`, `Cl8`) |
| `ao9` | Settings hash calculator (sha256) |
| `Dg_` | Deep-object hash helper |
| `SI7` | Remote-settings initial-state builder |
| `a8` | Generic async-retry wrapper |
| `bH` | Feature-gate event emitter (variant B) |
| `WQH` | Cache warm-up on auth change |
| `SH` | Feature-gate event emitter (variant S) |
| `ma9` | Settings-update orchestrator |
| `TYH` | Settings-field warning emitter |
| `La9` | Settings diff applier |
| `nH6` | Settings key normalizer / uppercaser |
| `pP8` | Settings key enumerator |
| `tW` | Settings-change transactor |
| `Sa9` | Settings-approval checker |
| `vI7` | Settings-pending-queue manager |
| `wF` | Settings write dispatcher |
| `on` | Settings-change observer |
| `ba9` | Session-context binder |
| `j4` | Session-parameter resolver |
| `pa9` | Settings-file atomic writer (open/writeFile/datasync/close) |
| `Er6` | Settings-file path builder |
| `Fa9` | Settings-timeout guard |
| `ga9` | Settings-poll loop manager |
| `TP8` | Interval-based poll timer |
| `gF_` | Policy-limits pre-check |
| `kfH` | Policy-limits field validator |
| `ZP8` | Policy-limits timeout guard |
| `Db` | API-call dispatcher for policy limits |
| `NjH` | Policy-limits file-path builder |
| `VW6` | Policy-limits cache file reader |
| `Wo9` | Policy-limits cache freshness checker |
| `ZW6` | Policy-limits cache-validity sentinel |
| `oN7` | Policy-limits hash calculator |
| `aN7` | Policy-limits HTTP response handler |
| `sN7` | Policy-limits retry scheduler |
| `eN7` | Policy-limits cache file writer |
| `owH` | Session ownership validator |
| `rF_` | (see above — session initializer) |
| `x_` | Module-export bootstrapper |
| `YB6` | Module-bind helper |
| `AX6` | Auth-extension loader |
| `UnH` | Auth nonce/hash utility |
| `u_` | Init-parameters reader (working_directory, allowed_tools, etc.) |
| `US8` | Init-param field extractor (variant US) |
| `BS8` | Init-param field extractor (variant BS) |
| `Jb` | Feature-disable handler |
| `st_` | Session-tracker initializer |
| `P_H` | Permission-mode validator |
| `vL8` | Permission-feature-gate bridge |
| `I9A` | Auto-mode availability checker |
| `Wq6` | Auto-mode UI notifier |
| `yu` | Auto-mode notification renderer |
| `Y` | Supervisor / daemon loop manager |
| `ITH` | Config-file reader (ENOENT-tolerant) |
| `BOK` | Config-diff renderer |
| `edK` | Heartbeat scheduler |
| `V` | Daemon start/stop controller |
| `T` | Daemon config manager |
| `f` | Daemon connection handle |
| `oe` | Session-overflow handler |
| `tR` | Rate-limit tracker |
| `Dw` | Theme context accessor |
| `Wqf` | (see above — top-level render) |
| `D` | Forced-shutdown handler (process.exit + z.abort) |
| `GF` | Input-mode selector |
| `Ov_` | AppState context accessor (throws ReferenceError outside provider) |
| `j6` | AppState store hook (useSyncExternalStore) |
| `xGq` | (see above — login reducer hook) |
| `uGq` | Telemetry init function called from login component |
| `Wh6` | Permission-update observer |
| `JSA` | OAuth URL builder |
| `hY4` | OAuth redirect-URI builder |
| `n1` | OAuth state-param generator |
| `LP` | Auth-token persistence layer |
| `HX6` | Auth provider selector |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.