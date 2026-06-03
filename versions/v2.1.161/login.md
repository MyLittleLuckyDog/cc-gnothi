---
type: feature-spec
feature: "login"
cc_version: "2.1.161"
updated: "2026-06-03"
tags: ["login", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.161 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/login`

> Analysis basis: CC v2.1.161 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.161

---

## Overview

The `/login` command initiates an interactive OAuth-based account sign-in flow, allowing users to switch Anthropic accounts or authenticate for the first time. It renders a JSX component that orchestrates the browser-based OAuth handshake, persists the resulting credentials securely, and optionally enrolls the device as a trusted device. Upon completion it updates application state and can trigger remote settings and policy-limits refresh cycles.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `login` |
| description | `Switch Anthropic accounts \| Sign in with your Anthropic account` |
| module_id | `MO1` |
| load_inline | `true` |
| loc_byte | `11491137` |
| loc_byte_end | `11491357` |
| loc_line | `7874` |
| arbor_handler.name | `Vp1` |
| arbor_handler.fqn | `claude-2.1.161::Vp1` |
| arbor_handler.kind | `Function` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.161 bundle.js:+11491137

---

## Input Branching

The command presents more than three distinct behavioural paths depending on authentication environment, existing token state, and trusted-device eligibility, so a Mermaid flowchart is used below.

```mermaid
flowchart TD
    A["/login invoked"] --> B{CLAUDE_CODE_OAUTH_TOKEN\nenv var set?}
    B -- Yes --> C["Emit runtime warning:\n'CLAUDE_CODE_OAUTH_TOKEN is set…'\n(bundle.js:+9202979)"]
    C --> D[Continue login flow]
    B -- No --> D

    D --> E{Same account + org\nre-login with existing token?}
    E -- Yes --> F["Log: 'Same account+org re-login…'\nskip trusted-device re-enrollment\n(bundle.js:+9202605)"]
    F --> G[Write credentials & complete]
    E -- No --> H[Render OAuth JSX component\n(BXH / Vp1)]

    H --> I{User completes\nbrowser OAuth flow?}
    I -- Cancelled/Interrupted --> J["Display 'Login interrupted'\n(bundle.js:+9203373)"]
    I -- Completed --> K["Display 'Login successful'\n(bundle.js:+9203354)"]

    K --> L{CLAUDE_TRUSTED_DEVICE_TOKEN\nenv var set?}
    L -- Yes --> M["Skip enrollment: env var\ntakes precedence\n(bundle.js:+6953634)"]
    L -- No --> N{Essential traffic\nonly mode?}
    N -- Yes --> O["Skip enrollment: essential\ntraffic only\n(bundle.js:+6953948)"]
    N -- No --> P{OAuth token present?}
    P -- No --> Q["Skip enrollment: no\nOAuth token\n(bundle.js:+6954061)"]
    P -- Yes --> R[Attempt trusted-device\nenrollment via bridge API]

    R --> S{Enrollment HTTP response}
    S -- "201 Created" --> T[Store device token\nto secure storage]
    S -- "HTTP error" --> U["Telemetry: bridge_trusted_device_enroll\nhttp_error (bundle.js:+6954657)"]
    S -- "Missing token field" --> V["Telemetry: missing_token\n(bundle.js:+6954836)"]
    S -- "Storage failure" --> W["Telemetry: storage_failed\n(bundle.js:+6955044)"]

    T --> G
    M --> G
    O --> G
    Q --> G
    U --> G
    V --> G
    W --> G
    G --> X["Update appState via setAppState\n(bundle.js:+9202856)"]
    X --> Y["Trigger remote settings + policy\nlimits refresh\n(bundle.js:+6992076 / +6950868)"]
```

Analysis basis: CC v2.1.161 bundle.js:+9202700 (handler `hR_` / `maH` trusted-device path), +9202856 (appState update), +9202605 (same-account skip guard)

---

## Behavioral Spec

### 1. Command Entry Point — JSX Renderer (`Vp1` / `BXH`)

The top-level JSX component (resolved via Arbor as `Vp1`, rendered through the `BXH` render function) is the entry point for the `/login` command.

```
function loginCommandRenderer(props):
    [loginState, dispatch] = useReducer(loginReducer, initialState)
    useEffect → subscribe to tdH events via appStateSubscriber()
    memoizedCallbacks = useMemo(...)

    if CLAUDE_CODE_OAUTH_TOKEN env var present:
        emit warning message (bundle.js:+9202979)

    return createElement(loginFlow, {
        onDone: handleDone,
        onChangeAPIKey: changeAPIKeyHandler,
        ...memoizedCallbacks
    })
```

Analysis basis: CC v2.1.161 bundle.js:+9203419 (`BXH`), +9203449 (`fO1.useState`), +9203597 (`H.onDone`)

---

### 2. App-State Subscription (`appStateSubscriber`)

```
function appStateSubscriber(store):
    context = useAppStateContext()          // fails outside AppStateProvider
    state   = store.getState()
    return  useSyncExternalStore(store, getSnapshot)
```

Analysis basis: CC v2.1.161 bundle.js:+9200899 (`$6`), +3824509 (`n2_`)

---

### 3. OAuth Flow Orchestration (`oauthFlowOrchestrator`)

```
function oauthFlowOrchestrator(config):
    commandContext = buildCommandContext(config)   // lq
    parsedModel    = parseModelString(commandContext)  // s9
    resolvedProvider = resolveProviderChain(parsedModel)  // b0

    open browser / stdin-based OAuth handshake
    await credential response

    if response.interrupted:
        return { status: "Login interrupted" }

    applyMessageOp(response)                      // H.applyMessageOp
    timestampMessage(response)                    // fmH → Date.now
    return { status: "Login successful" }
```

Analysis basis: CC v2.1.161 bundle.js:+9202352 (`ZG8`→`H.onChangeAPIKey`), +9202371 (`H.applyMessageOp`), +9202427 (`fmH`)

---

### 4. Credential Persistence (`credentialWriter`)

After the OAuth token is obtained, credentials are written atomically:

```
function credentialWriter(token, configDir):
    tmpPath = buildTmpPath(configDir)              // s56 → d1H + sCA.join
    fd      = PyH.open(tmpPath, writeFlags)
    PyH.writeFile(fd, JSON.stringify(token))       // SH
    PyH.datasync(fd)
    PyH.close(fd)
    renameToFinal(tmpPath, finalPath)              // UJA → Ay.rename
    if finalPath.endsWith(".txt"):
        backupOldFile()                            // UJA → Ay.unlink

    writeToSecureStorage(token)                   // zjq
    return success
```

Secure storage write paths emit telemetry:
- `secure_storage_credentials_write` (bundle.js:+2273423)
- `primary_transient_skip_fallback` (bundle.js:+2273521)
- `plaintext_fallback_used` (bundle.js:+2273670)
- `primary_and_fallback_failed` (bundle.js:+2273773)

Analysis basis: CC v2.1.161 bundle.js:+204758 (`IBK`), +6989811 (`$37`→`PyH.open`), +6989892 (`A.datasync`), +2273423

---

### 5. API-Key Helper Resolution (`apiKeyResolver`)

When the login involves an API key rather than OAuth, the resolver inspects environment and config:

```
function apiKeyResolver(env, config):
    if env.ANTHROPIC_API_KEY set:
        return { source: "ANTHROPIC_API_KEY" }
    if env.CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR set:
        fd = parseInt(env.CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR)
        key = readFdSync(fd)                       // e$6 → yfq
        return { source: "API key", value: key }
    if config.apiKeyHelper != "none":
        run helper process → capture stdout
    else:
        throw Error("ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN,
                    CLAUDE_CODE_OAUTH_TOKEN, or WIF env vars … required")
                    // bundle.js:+2991993
```

Analysis basis: CC v2.1.161 bundle.js:+2991530 (`ANTHROPIC_API_KEY`), +2112012 (`CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR`), +2991663 (`none`), +2991993

---

### 6. Trusted-Device Enrollment (`trustedDeviceEnroll`)

```
function trustedDeviceEnroll(oauthToken, appState):
    if env.CLAUDE_TRUSTED_DEVICE_TOKEN set:
        log("[trusted-device] env var takes precedence")  // bundle.js:+6953634
        return

    if isEssentialTrafficOnly(appState):
        log("[trusted-device] Essential traffic only, skipping")  // +6953948
        return

    if not oauthToken:
        log("[trusted-device] No OAuth token, skipping")  // +6954061
        return

    timeout_ms = 10000   // bundle.js:+6954350
    retry_ms   = 500     // bundle.js:+6954376

    response = POST bridgeEnrollEndpoint(oauthToken)
                   with timeout_ms

    if response.status == 201:                     // bundle.js:+6954538
        deviceToken = response.body.device_token
        if not deviceToken:
            emit telemetry("bridge_trusted_device_enroll", "missing_token")
            return
        result = writeToSecureStorage(deviceToken)
        if result.failed:
            emit telemetry("bridge_trusted_device_enroll", "storage_failed")
    else:
        emit telemetry("bridge_trusted_device_enroll", "http_error")
```

Analysis basis: CC v2.1.161 bundle.js:+6953075 (`hR_`), +6954452 (`bridge_trusted_device_enroll`), +6954538 (HTTP 201), +6954735

---

### 7. Remote Settings Refresh After Login (`remoteSettingsAuthRefresh`)

On successful login the remote-settings subsystem is notified of the auth change:

```
function remoteSettingsAuthRefresh():
    log("Remote settings: Refreshed after auth change")  // bundle.js:+6992076
    pullSettings()                                        // eR_ pipeline
    notifyChange(JC)
    if pullSucceeded:
        applyNewSettings()                               // $37
    else if staleCache available:
        log("Remote settings: Using stale cache after fetch failure")
                                                         // bundle.js:+6990565
```

HTTP status handling within `Em9`:

| HTTP Status | Action |
|---|---|
| 200 | Parse and apply new settings |
| 204 | No content, keep existing |
| 304 | Use cached settings (bundle.js:+6988503) |
| 401 | Force-refresh retry → telemetry `tengu_remote_settings_401_force_refresh_retry` |
| 404 | Delete cached file (bundle.js:+6991267) |

Analysis basis: CC v2.1.161 bundle.js:+6992065 (`eR_`), +6988443–+6988470 (status codes), +6992076

---

### 8. Policy Limits Refresh After Login (`policyLimitsAuthRefresh`)

```
function policyLimitsAuthRefresh():
    log("Policy limits: Refreshed after auth change")  // bundle.js:+6950868
    fetch policyLimits endpoint with If-None-Match ETag
    emit telemetry("tengu_policy_limits_fetch", ...)
    on 304: log("Cache still valid")
    on success: applyRestrictions()
    on failure: useStaleCache()
```

Analysis basis: CC v2.1.161 bundle.js:+6950868, +6949560 (`tengu_policy_limits_fetch`), +6950131

---

### 9. Bootstrap Fetch (`bootstrapFetcher`)

Triggered on login context initialisation:

```
function bootstrapFetcher(url):
    log("[Bootstrap] Fetching", url)               // bundle.js:+15504122
    headers = {
        "Content-Type": "application/json",        // +15504207
        "User-Agent": userAgentString              // +15504241
    }
    timeout = 5000                                 // bundle.js:+15504313
    response = await fetch(url, { headers, timeout })
    if parseFailed:
        emit telemetry("api_bootstrap_fetch", "parse_failed")  // +15504456
    else:
        log("[Bootstrap] Fetch ok")                // +15504486
```

Analysis basis: CC v2.1.161 bundle.js:+15504120 (`H`→`N`), +15504158 (`s_.get`), +15504434

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_ok` (+966587), `tengu_feature_bad` (+966650), `tengu_feature_sad` (+966732), `tengu_remote_settings_401_force_refresh_retry` (+6989452), `tengu_managed_settings_security_dialog_shown` (+6985501), `tengu_managed_settings_security_dialog_accepted` (+6985185), `tengu_managed_settings_security_dialog_rejected` (+6985235), `tengu_policy_limits_fetch` (+6949560), `tengu_disable_bypass_permissions_mode` (+10559680), `tengu_auto_mode_config` (+10557570), `tengu_daemon_config_reload` (+15918997) |
| appState changes | `H.setAppState` called on completion (bundle.js:+9202856); auth token written to secure storage via `zjq` |
| Secure storage | Writes device token and OAuth token; falls back to plaintext if primary storage fails (bundle.js:+2273670) |
| File I/O | Credential file written atomically via temp-file + rename pattern; temp files use `.txt` suffix check (bundle.js:+203545); old backup unlinked via `Ay.unlink` (+203637) |
| Remote settings | `JC.notifyChange` emitted after auth change (+6992171); background poll via `Qz8` (`setInterval`/`clearInterval`) resumes |
| Policy limits | Background poll loop (`Qz8`) resumes and refreshes after auth change |
| Timer management | `clearTimeout` and `setTimeout` used by debounce/write-queue (`WmH`); `setImmediate` for immediate flush (+59076) |
| Hook registration | `j_` registers a handler via `L.registerHandler` (+4069375) in the JSX component lifecycle |
| Process listeners | `HcH` removes `exit` listener (+3229190) and `beforeExit` listener (+3229943) on cleanup; `process.off` called (+3229132) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| CLAUDE_CODE_OAUTH_TOKEN warning | Warning message emitted to UI if env var detected at login time (bundle.js:+9202979) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.161 | Initial analysis |

---

## Common Mistakes

1. **Leaving `CLAUDE_CODE_OAUTH_TOKEN` set after login** — the command warns that this environment variable overrides the newly stored login token at runtime (bundle.js:+9202979). Users must unset it after logging in via `/login` for the new credentials to take effect.
2. **Expecting instant remote-settings update** — after login, the remote-settings pull is asynchronous. A 304 Not Modified response means the cached settings remain in use; a new fetch is only triggered if the ETag changes.
3. **Invoking `/login` in essential-traffic-only mode** — trusted-device enrollment is silently skipped in this mode (bundle.js:+6953948); the OAuth login itself still completes, but the device will not be enrolled.
4. **Assuming API-key flow is equivalent to OAuth flow** — when `ANTHROPIC_API_KEY` is set, no browser OAuth handshake occurs and no trusted-device enrollment is attempted; the command writes the key directly.
5. **Interrupting with Ctrl-C mid-flow** — the command treats this as "Login interrupted" (bundle.js:+9203373) and does not persist partial credentials; no cleanup is needed but the session remains unauthenticated.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Vp1` | Top-level login command handler (Arbor-resolved, `direct` path) |
| `ZG8` | Primary login orchestrator function |
| `BXH` | JSX render wrapper for login UI component |
| `LQ7` | Login JSX sub-component (renders outcome messages) |
| `ow` | App-state hook wrapper |
| `$6` | `useAppState` / `useSyncExternalStore` bridge |
| `_O1` | Login UI reducer + effect hook component |
| `oV6` | Main auto-mode / session configuration orchestrator called during login |
| `rV6` | Session configuration resolver |
| `hR_` | Trusted-device enrollment entry point |
| `maH` | Trusted-device bridge enrollment HTTP caller |
| `t7H` | Trusted-device token dispatch helper |
| `j6` | Token dispatch / queue helper |
| `Lq8` | Secure-storage queue reader/writer |
| `zjq` | Secure-storage credential write dispatcher |
| `fZH` | Async secure-storage write helper |
| `O4` | Secure-storage read/write router |
| `laH` | Remote-settings + policy-limits lifecycle manager post-login |
| `eR_` | Remote-settings pull-and-apply function |
| `Em9` | Remote-settings HTTP fetch and parse function |
| `M37` | Remote-settings retry scheduler |
| `F_H` | Exponential back-off calculator |
| `n8` | Generic retry-with-timeout helper |
| `Tm9` | Remote-settings background poll launcher |
| `Qz8` | Interval-based background poller (setInterval/clearInterval wrapper) |
| `z37` | Remote-settings change-notify loop tick |
| `sR_` | Remote-settings change notifier (calls `JC.notifyChange`) |
| `yH` | Settings change notification broadcaster |
| `Z06` | Policy-limits lifecycle manager post-login |
| `nz8` | Policy-limits pull orchestrator |
| `Iu9` | Policy-limits HTTP fetch and parse function |
| `ku9` | Policy-limits background poll launcher |
| `p$7` | Policy-limits poll tick function |
| `Qx` | Model/provider resolver |
| `gx` | Provider chain builder |
| `dR` | Provider descriptor constructor |
| `k6H` | Cleanup/teardown function for login session |
| `HcH` | Process-listener removal and cache-clear on teardown |
| `Aj_` | Interval and process-listener cleanup |
| `zL` | Conversation context builder for login |
| `KD` | Message-sequence builder |
| `lq` | Command-context builder / argument parser |
| `xHH` | Command-string tokeniser |
| `nQ` | Token classifier and routing helper |
| `s9` | Model-string normaliser and selector |
| `x0` | Model-alias lookup helper |
| `NKH` | Model-name validator |
| `aN` | Provider-type resolver |
| `CgH` | Provider fallback helper |
| `KG` | First-party provider resolver |
| `Xwq` | Provider chain wrapper |
| `UM` | Provider instance factory |
| `b0` | Full provider-chain resolver |
| `N` | API-key credential resolver |
| `VBK` | Config-file reader for credentials |
| `HwA` | Config-path builder |
| `IBK` | Atomic file writer with debounce queue |
| `WmH` | Debounce/write-queue flush manager |
| `_3H` | File-path normaliser for config writes |
| `BJA` | Config directory path builder |
| `UJA` | Atomic rename helper (temp → final) |
| `NBK` | Directory-create + append writer |
| `d46` | EISDIR error guard for file writes |
| `Y9` | Hook registry (`tYA.register`) |
| `imH` | Config file write dispatcher |
| `GJA` | Low-level config file writer |
| `Z4` | API-key redaction and normalisation utility |
| `CJA` | Key-prefix mapper |
| `SH` | `JSON.stringify` wrapper |
| `CR_` | Recursive object serialiser for cache hash |
| `xu9` | Settings cache-hash generator (SHA-256) |
| `Xm9` | Structured-clone helper for settings |
| `CX` | `structuredClone` wrapper |
| `Yx` | Settings state-map updater |
| `wm9` | Settings-application orchestrator |
| `sz8` | Settings key enumerator |
| `FaH` | Settings entry merger |
| `Qu9` | Settings validation and merge helper |
| `e$7` | Managed-settings security-dialog queue manager |
| `aU` | File-permission write helper |
| `ql` | Settings persistence finaliser |
| `jm9` | Session-override settings applier |
| `QK` | Per-command settings injector |
| `$37` | Atomic settings file writer |
| `s56` | Settings path builder |
| `iV6` | Permission-mode / app-state applicator |
| `TG8` | Permission mode gate (`bypassPermissions` guard) |
| `_j_` | Permission-mode toggler |
| `jyH` | App-state permission dispatcher |
| `Y$` | Permission rule manager |
| `bM` | Permission rule-set constructor |
| `C_` | Tool-allow/deny list resolver |
| `BN8` | `allowed_tools` resolver |
| `FN8` | `disallowed_tools` resolver |
| `C5H` | Session context mapper |
| `K7H` | Event emitter for permission-mode changes |
| `N4` | Permission-mode-changed event dispatcher |
| `XdH` | Model-compatibility checker for thinking modes |
| `_9` | Model feature-support interrogator |
| `mD6` | Model display-name formatter |
| `w_6` | Auto-mode availability checker |
| `ZQ` | Auto-mode availability result encoder |
| `D` | Ink terminal renderer / supervisor loop |
| `BWH` | Terminal output formatter |
| `H9K` | Column-width calculator |
| `G` | Supervisor input handler |
| `USK` | Heartbeat scheduler |
| `V` | Supervisor start handler |
| `f` | Terminal stream manager |
| `M` | Temp-file cleanup helper |
| `d99` | Text-input component |
| `k0_` | Input field state manager |
| `HC` | Debounced input callback hook |
| `FM` | Footer / hint bar component |
| `uY` | Theme context consumer |
| `j_` | Global key-handler registrar |
| `pj` | Key-handler context consumer |
| `Td` | External-store subscription helper |
| `hcq` | Async microtask subscriber |
| `n2_` | AppState context accessor |
| `t6` | Bootstrap config fetcher |
| `h1H` | Bootstrap response parser |
| `fmH` | Message timestamp stamper (`Date.now`) |
| `PA` | Provider-type string formatter |
| `pH` | String coercion wrapper |
| `TH` | String coercion helper (alt) |
| `a_` | Error/string normaliser |
| `r9` | Queue-key builder |
| `s44` | Ring-buffer queue manager |
| `Rq` | OAuth redirect-URL builder |
| `rNA` | Base OAuth URL resolver |
| `QK4` | OAuth client-ID resolver |
| `v_` | Module export shim |
| `rb6` | Bound module-export helper |
| `AO1` | Post-login app-state patcher |
| `$c_` | Session cleanup helper |
| `qt` | Permission-mode display formatter |
| `_R` | Auto-mode status renderer |
| `wOH` | Cache-clear helper on auth change |
| `uM4` | Multi-cache invalidator |
| `nz` | Dual-cache clear (Cx6, IU8) |
| `EBH` | Error boundary handler for settings pull |
| `mDH` | Login-state machine dispatcher |
| `sJH` | Same-account re-login guard |