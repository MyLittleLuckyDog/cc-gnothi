---
type: feature-spec
feature: "upgrade"
cc_version: "2.1.196"
updated: "2026-06-30"
tags: ["upgrade", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.196 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/upgrade`

> Analysis basis: CC v2.1.196 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.196

---

## Overview

The `/upgrade` command guides users from a standard Claude account to a **Claude Max** subscription, which offers higher rate limits and broader access to Opus-class models. When invoked, it inspects the active OAuth session's subscription plan and either opens the upgrade URL in a browser or, if the user is already on the highest Max tier, informs them of that fact and suggests switching to an API-billed account instead. If the browser cannot be opened automatically, it falls back to printing the upgrade URL as plain text.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `upgrade` |
| description | `Upgrade to Max for higher rate limits and more Opus` |
| module_id | `M6o` |
| load_inline | `true` |
| loc_byte | `13120658` |
| loc_byte_end | `13120905` |
| loc_line | `9040` |
| arbor_handler.name | `pZt` |
| arbor_handler.fqn | `claude-2.1.196::pZt` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.196 bundle.js:+13120658

---

## Input Branching

Four distinct execution paths exist, warranting a Mermaid flowchart.

```mermaid
flowchart TD
    A["/upgrade invoked"] --> B{Check active OAuth\nsubscription plan}
    B -->|plan == 'claude_max'\nAND tier == 'default_claude_max_20x'\n(highest tier)| C["Display already-on-highest-plan message\n'You are already on the highest Max subscription plan…'"]
    C --> Z[Return — no browser opened]

    B -->|plan == 'claude_max'\nbut lower tier, OR\nplan == 'max'| D["Attempt to open browser\nURL: https://claude.ai/upgrade/max"]
    B -->|Any other plan\n(free, pro, etc.)| D

    D -->|Browser open succeeds| E["Display 'Starting new login following /upgrade'\nmessage — initiate re-login flow"]
    E --> F["Await login completion\n(wOe / re-auth flow)"]
    F -->|Login successful| G["Display 'Login successful'"]
    F -->|Login interrupted / Ctrl-C| H["Display 'Login interrupted'"]

    D -->|Browser open fails| I["Display fallback message:\n'Failed to open browser. Please visit\nhttps://claude.ai/upgrade/max to upgrade.'"]
    I --> Z2[Return]
```

Analysis basis: CC v2.1.196 bundle.js:+13119540 (handler entry), +13119626 (plan literal `"max"`), +13119651 (tier literal `"default_claude_max_20x"`), +13119770 (plan literal `"claude_max"`), +13119871 (already-highest message), +13120017 (upgrade URL), +13120166 (re-login message), +13120360 (login-success literal), +13120379 (login-interrupted literal), +13120451 (browser-open-failure fallback)

---

## Behavioral Spec

### Top-level handler — `upgradeCommandHandler` (`pZt`)

```
async function upgradeCommandHandler(commandContext):

    # 1. Resolve current account profile
    accountProfile = await fetchOAuthProfile(commandContext)   # vLe
    plan           = accountProfile.plan                       # string field

    # 2. Already on highest tier — bail early
    if plan == "claude_max" AND subscriptionTier == "default_claude_max_20x":
        # setTimeout used for async display scheduling
        displayMessage(
            "You are already on the highest Max subscription plan. " +
            "For additional usage, run /login to switch to an API " +
            "usage-billed account."
        )
        return

    # 3. Attempt browser launch
    upgradeURL = "https://claude.ai/upgrade/max"
    browserResult = openURL(upgradeURL)   # xc → LKr → ZLi

    if browserResult.error:
        displayMessage(
            "Failed to open browser. Please visit " +
            upgradeURL + " to upgrade."
        )
        return

    # 4. Start re-login flow
    displayMessage(
        "Starting new login following /upgrade. " +
        "Exit with Ctrl-C to use existing account."
    )

    loginOutcome = await performReLogin(commandContext)   # Nc → aE / Dt  +  wOe re-auth

    if loginOutcome == "success":
        displayMessage("Login successful")
    else:
        displayMessage("Login interrupted")

    # 5. Credential / state refresh
    refreshCredentialStore(commandContext)   # Re
```

Analysis basis: CC v2.1.196 bundle.js:+13119540

---

### Plan detection — `planCheck` (`Ao`)

```
function planCheck(sessionState):
    # Delegates to authStateReader (aE) and conditionalRenderer (R3 / Vs)
    authInfo = readAuthState(sessionState)   # aE
    isMaxTier = checkPlanField(authInfo)     # R3 → Array.isArray + e.includes
    return { plan: authInfo.plan, isMaxTier }
```

Analysis basis: CC v2.1.196 bundle.js:+13119540 (`pZt → Ao`), +3114151 (`Ao → R3`)

---

### OAuth profile fetch — `fetchOAuthProfile` (`vLe`)

```
async function fetchOAuthProfile(ctx):
    baseURL   = buildOAuthBaseURL(ctx)          # Us → env-based URL selection
    cacheHit  = oauthProfileCache.get(baseURL)  # fo.get
    if cacheHit: return cacheHit

    response = await httpGet(
        baseURL,
        headers: { "Content-Type": "application/json" },
        timeout: 10000   # ms
    )

    # Telemetry on success / failure paths
    emit("oauth_profile_fetch")          # on HTTP success
    emit("oauth_profile_token_failed")   # on token/auth error

    if response.error:
        logError(response)               # Re → Ete.logError
        return null

    return parseProfile(response.data)
```

Analysis basis: CC v2.1.196 bundle.js:+13119712 (`pZt → vLe`), +2160325 (`"Content-Type"`), +2160368 (timeout `10000`), +2160384 (`"oauth_profile_fetch"`), +2160451 (`"oauth_profile_token_failed"`)

---

### Browser open — `openURL` (`xc → LKr → ZLi`)

```
function openURL(url):
    # Validate URL scheme
    if NOT (url.startsWith("http:") OR url.startsWith("https:")):
        return { error: "invalid_url" }

    platform = process.platform

    if platform == "darwin":
        spawn("open", [url])
    elif platform == "linux":
        if DISPLAY env var missing:
            return { error: "no_display" }
        spawn("xdg-open", [url])   # or equivalent opener
    else:   # windows / other
        spawn(platformOpener, [url])

    # Error classification (ZLi / bOd)
    if exitCode == 127 OR error.code == "ENOENT":
        return { error: "opener_missing" }
    if error.code in ["ETIMEDOUT", "timed out"]:
        return { error: "timeout" }
    if error.code in ["EACCES", "EPERM"]:
        return { error: "spawn_error" }
    if exitCode != 0:
        return { error: "nonzero_exit" }
    return { error: null }
```

Analysis basis: CC v2.1.196 bundle.js:+13120014 (`pZt → xc`), +3154473 (`"http:"`), +3154495 (`"https:"`), +3155665 (`"invalid_url"`), +3155876 (`"darwin"`), +3155561 (`"linux"`), +3155918 (`"no_display"`), +3155955 (`"open"`), +3156161 (exit code `127`), +3156177 (`"ENOENT"`), +3156207 (`"opener_missing"`), +3156248–3156306 (timeout literals), +3156340–3156391 (permission/spawn literals), +3156447 (`"nonzero_exit"`)

Analysis basis: CC v2.1.196 bundle.js:+13120017 (upgrade URL `"https://claude.ai/upgrade/max"`)

---

### Re-authentication flow — `performReLogin` (`Nc`)

```
async function performReLogin(ctx):
    # Delegates to authStateReader (aE) and diagnosticTimer (Dt)
    authFlow   = startAuthFlow(ctx)     # aE
    diagnostic = startDiagTimer(ctx)    # Dt → Date.now + Ldm

    outcome = await authFlow
    return outcome
```

Analysis basis: CC v2.1.196 bundle.js:+13120056 (`pZt → Nc`), +3114583 (`Nc → aE`), +3114588 (`Nc → Dt`)

---

### Post-login UI render — `wOe` (JSX component)

After a successful re-login the handler mounts a JSX component (`wOe`, invoked at `bundle.js:+13120279`) that:

1. Applies the updated API key/OAuth token to the session (`e.onChangeAPIKey`, `e.applyMessageOp`).
2. Triggers remote-settings and policy-limits refresh (`m8e`, `cKt`).
3. Updates feature flags from the new account context (`I7n → lRn → lFi`).
4. Re-renders the permission and trusted-device state (`h4`, `FGt`).
5. Dispatches `appState` changes via `e.getAppState` / `e.setAppState`.
6. If the account changed (different user/org), disconnects any active Remote Control session: `"[bridge:repl] Account changed via /login — disconnecting Remote Control session"` (bundle.js:+9258288).

Analysis basis: CC v2.1.196 bundle.js:+13120279, +9257563, +9257582, +9258203, +9258376, +9258288

---

### Credential store refresh — `credentialRefresh` (`Re`)

```
function credentialRefresh(ctx):
    # Rotates in-flight request queue
    drainQueue(ctx)          # _Nu → zfn.shift / zfn.push
    pushNewCredentials(ctx)  # zet.push
    logErrorIfNeeded(ctx)    # Ete.logError
```

Analysis basis: CC v2.1.196 bundle.js:+13120430 (`pZt → Re`), +1059419 (`Re → zet.push`), +1059478 (`Re → Ete.logError`)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `oauth_profile_fetch` | Emitted when the OAuth profile HTTP call succeeds (bundle.js:+2160384) |
| Telemetry — `oauth_profile_token_failed` | Emitted when the profile call fails due to an auth/token error (bundle.js:+2160451) |
| Telemetry — `tengu_feature_ok` | Emitted by the feature-flag check layer on a successful flag evaluation (bundle.js:+1028610) |
| Telemetry — `tengu_feature_sad` | Emitted on a degraded (non-fatal) flag evaluation (bundle.js:+1028758) |
| Telemetry — `tengu_feature_bad` | Emitted on a failed flag evaluation (bundle.js:+1028677) |
| Telemetry — `tengu_managed_settings_security_dialog_shown` | Emitted if a new remote-managed settings diff requires a security consent dialog (bundle.js:+7489776) |
| Telemetry — `tengu_managed_settings_security_dialog_accepted` | Emitted when the user accepts the settings diff (bundle.js:+7490113) |
| Telemetry — `tengu_managed_settings_security_dialog_rejected` | Emitted when the user rejects the settings diff (bundle.js:+7490272) |
| Telemetry — `tengu_policy_limits_fetch` | Emitted when policy limits are re-fetched after login (bundle.js:+14135155) |
| Telemetry — `tengu_disable_bypass_permissions_mode` | Emitted if the new account's policy disables bypass-permissions mode (bundle.js:+14015380) |
| Telemetry — `tengu_auto_mode_config` | Emitted when auto-mode configuration is evaluated post-login (bundle.js:+14013170) |
| Telemetry — `tengu_daemon_config_reload` | Emitted when daemon configuration is reloaded after credential change (bundle.js:+18010884) |
| Browser side-effect | Spawns OS browser opener process pointing to `https://claude.ai/upgrade/max` (bundle.js:+13120017) |
| `appState` changes | Updated via `e.setAppState` after successful re-login; session credentials rotated (bundle.js:+9258376) |
| Remote Control disconnect | If account identity changes, the bridge/REPL Remote Control session is disconnected (bundle.js:+9258288) |
| Hook registration — `vi` | `fis.register` hook wired during the post-login output rendering path (bundle.js:+68542) |
| Remote-settings poll | Background polling interval (`yRn → setInterval/clearInterval`) is restarted with new credentials (bundle.js:+3396756) |
| Feature-flag cache | `t0e`, `sRn`, `wV` caches cleared and repopulated from new account payload (`lFi`) (bundle.js:+3379130–3379846) |
| Credential queue drain | In-flight request queue (`zfn`) rotated; new credentials pushed to `zet` (bundle.js:+1058752–1059438) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.196 | Initial analysis |

---

## Common Mistakes

1. **Running `/upgrade` when already on the highest Max tier** — the command exits immediately with an informational message and no browser is opened. Use `/login` to switch to an API-billed account if you need additional usage beyond the Max quota.
2. **Missing display / headless environments on Linux** — the browser-open step will fail with `no_display` if the `DISPLAY` environment variable is absent. Copy the printed URL (`https://claude.ai/upgrade/max`) manually in that case.
3. **Interrupting with Ctrl-C during the re-login phase** — the command catches the interruption and prints "Login interrupted"; the existing session credentials remain active and unchanged.
4. **Expecting an immediate model change** — the command only upgrades the subscription and refreshes credentials; model selection is governed separately by session config and flag settings, not by `/upgrade` alone.
5. **Confusing `/upgrade` with `/login`** — `/upgrade` is specifically for moving from a free/pro account to a Max plan. If you are already on Max but want to switch accounts or auth methods, use `/login` directly.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `pZt` | Top-level upgrade command handler (AsyncFunction) |
| `Ao` | Plan-check helper — reads session auth state and evaluates Max tier |
| `aE` | Auth-state reader — central auth context resolver |
| `Hd` | CLI argument parser / flag reader |
| `ct` | String coercion / primitive converter |
| `lan` | `--bare` flag handler |
| `cb` | Auth-mode classifier — dispatches among OAuth, API-key, gateway, etc. |
| `gAn` | OAuth token extractor helper |
| `Jst` | Auth-context normalizer |
| `K8` | File-descriptor credential reader (API key / OAuth token FD) |
| `gk` | Flag-settings accessor |
| `R3` | Array-include membership test utility |
| `Lc` | Provider/gateway classifier (gateway, bedrock, foundry, vertex, …) |
| `Hr` | Provider type resolver |
| `aI` | API key environment-variable reader |
| `TH` | Auth-flow orchestrator — checks `ANTHROPIC_API_KEY`, `apiKeyHelper`, etc. |
| `yUt` | Auth-helper validator |
| `mQe` | VSCode integration probe (`claude-vscode`) |
| `gPt` | OAuth-token file-descriptor initializer |
| `Dt` | Diagnostic timer / session timestamp recorder |
| `hF` | Array slice utility (depth-20 trimmer) |
| `AUt` | Auth-context upgrade helper |
| `vLe` | OAuth profile fetch function |
| `Us` | OAuth base-URL builder (env-based: prod / staging / local) |
| `EHs` | Environment-variable reader for custom OAuth URL |
| `HSu` | Approved-endpoint set for custom OAuth URLs |
| `xe` | React/Ink render helper (feature-ok path) |
| `V` | React/Ink base component |
| `Oe` | React/Ink overlay component |
| `$Xe` | Root render-target accessor |
| `wt` | React/Ink render helper (feature-sad path) |
| `x_` | Render context accessor |
| `T` | Terminal output writer / logger |
| `eeu` | Log-entry formatter |
| `gis` | Log channel multiplexer |
| `Me` | `JSON.stringify` wrapper |
| `Pc` | Log-path sanitizer (redacts sensitive segments) |
| `Zls` | Log-file path map builder |
| `KQe` | Stream writer wrapper |
| `Gls` | Raw stream `write` caller |
| `oeu` | Async log-rotation writer |
| `SQe` | Batched write scheduler (setTimeout/setImmediate) |
| `bhe` | Log-file path joiner |
| `qt` | Session token getter |
| `xae` | File existence prober |
| `ncs` | Log directory path builder |
| `sTr` | Log-file rotation (rename / unlink old `.txt`) |
| `reu` | Log-file append writer (mkdir + appendFile) |
| `vi` | Hook registrar (`fis.register`) |
| `Re` | Credential store refresher / in-flight queue manager |
| `er` | Error serializer |
| `zi` | Network traffic classifier |
| `Fbs` | Traffic-type resolver |
| `_Nu` | Request queue rotator (shift + push on `zfn`) |
| `xc` | URL-open dispatcher — validates scheme and delegates to OS opener |
| `LKr` | OS-specific browser launcher |
| `SOd` | URL scheme validator (throws on non-http/https) |
| `ZLi` | Platform-specific opener executor |
| `fH` | Platform detection helper (darwin / linux / windows) |
| `QLi` | Linux display-availability checker |
| `bOd` | Opener error classifier (ENOENT, ETIMEDOUT, EACCES, …) |
| `Pn` | Process spawner with timeout |
| `Nc` | Re-login orchestrator (delegates to `aE` + `Dt`) |
| `wOe` | Post-login JSX component — applies new credentials and refreshes all subsystems |
| `dQe` | Timestamp generator (`Date.now`) |
| `m8e` | Remote-managed-settings manager |
| `FBa` | Settings fetch initiator |
| `p8e` | Settings cache reader |
| `Cws` | Cache validity checker |
| `oQ` | Settings HTTP fetcher |
| `sHe` | Settings HTTP client |
| `mle` | Settings response parser |
| `PFe` | Settings merge helper |
| `Rm` | Response-code classifier |
| `Su` | Transaction rollback helper |
| `KS` | Settings-apply coordinator |
| `CUt` | Settings commit helper |
| `$5n` | Settings change notifier (`vO.notifyChange`) |
| `vws` | Settings diff serializer |
| `vyo` | Settings load-with-timeout orchestrator |
| `PBa` | Settings timeout resolver |
| `wBa` | Settings loading-promise deferred creator |
| `xyo` | Settings fetch-and-apply pipeline |
| `iHe` | HTTP ETag/cache-control header helper |
| `l5n` | SHA-256 hash builder for settings payload |
| `G$p` | Settings security-check dispatcher |
| `ke` | React/Ink render helper (security dialog) |
| `Ctt` | Cache-null sentinel checker |
| `qe` | React/Ink root accessor |
| `MBa` | Settings security-approved handler |
| `LBa` | Settings security-dialog renderer (JSX) |
| `xBa` | Settings rejection handler |
| `DBa` | Settings atomic file writer (open/writeFile/datasync/close) |
| `UBa` | Settings poller cleanup |
| `$Ba` | Background settings polling manager |
| `yRn` | Interval manager (setInterval / clearInterval) |
| `j$p` | Settings background-poll tick handler |
| `A7n` | Auth-change observer |
| `kSr` | Auth-state comparator |
| `fn` | Notification dispatcher |
| `Bgn` | Notification channel router |
| `I3` | Notification subscriber registry |
| `f` | Process relaunch helper |
| `L8` | Relaunch path normalizer |
| `I7n` | Feature-flag refresh orchestrator |
| `Rin` | Feature-flag state reader |
| `EV` | Feature-flag event emitter |
| `wcl` | Policy-limits cache clearer (`PLo.clear`) |
| `Sce` | Session-context reader |
| `Fxe` | Feature-experiment resolver |
| `Ccl` | Config-cache clearer |
| `NLo` | Network-options loader |
| `lRn` | Feature-flag full reload |
| `P6` | Feature-flag provider |
| `lFi` | Feature-flag payload applicator (clears + repopulates `t0e`, `sRn`, `wV`) |
| `cFi` | Feature-flag snapshot builder |
| `h4` | Permission and global-config refresh orchestrator |
| `Lcl` | Permission-layer initializer |
| `I8` | Permission set checker (`CPu.has`) |
| `F_t` | Network-config refresher (CA certs, mTLS, proxy) |
| `Vlf` | Network-config version tracker |
| `jlf` | CA-certificate config iterator |
| `Wlf` | mTLS config iterator |
| `Klf` | Proxy config iterator |
| `Blf` | Network-config commit helper |
| `sT` | Tool-allow-list updater |
| `NFe` | Tool-definition registry |
| `PRn` | Permission-reload callback |
| `Axs` | CA-certificate cache clearer |
| `vxs` | mTLS cache clearer |
| `KUr` | Proxy-agent cache clearer |
| `vDt` | Proxy-agent builder |
| `YM` | Proxy URL parser |
| `t6s` | Proxy-auth credential injector |
| `W8` | Proxy hostname/port resolver |
| `cKt` | Policy-limits manager |
| `VVo` | Policy-limits cache invalidator |
| `KVo` | Cache-expiry checker |
| `lye` | Auth-type filter (OAuth-only gate) |
| `pdr` | Policy-limits load-with-timeout orchestrator |
| `GF` | Policy-limits HTTP fetcher |
| `a0e` | Policy-limits cache-file path builder |
| `mdr` | Policy-limits fetch-and-apply pipeline |
| `dmc` | Policy-limits diff applier |
| `pmc` | Policy-limits background poller |
| `Wxe` | WebSocket/bridge context accessor |
| `Bce` | Feature-flag teardown (clears all caches, removes process listeners) |
| `Uit` | Feature-flag cleanup executor |
| `tYr` | Interval/listener cleanup |
| `I2t` | Trusted-device enrollment check |
| `__o` | Bridge initializer |
| `eo` | Bridge module loader (`Lsn.call`, `xsn.bind`) |
| `xsn` | Bridge bind helper |
| `PDe` | Bridge permission-demand evaluator |
| `it` | Feature-demand checker (`t0e.has`, `wV.has/get`) |
| `Ml` | Credential store manager |
| `tci` | Credential CRUD dispatcher (read/readAsync/update/delete) |
| `FGt` | Trusted-device enrollment executor |
| `FF` | Feature-demand evaluator (Boolean coerce + `iRn`) |
| `C$t` | Feature-config reader |
| `v$t` | Feature-version resolver |
| `iRn` | Feature-flag live-value resolver (`z7r`, `t0e`, `q7r`, `Z7r`) |
| `dFi` | Feature-flag with-default resolver |
| `IUp` | Bridge network-layer initializer |
| `f_o` | Bridge context getter |
| `o` | Policy accessor (isPolicyAllowed / isPolicyEnforced) |
| `s` | Async operation guard (add/finally/delete) |
| `i` | Stream pair (close) |
| `smn` | Trusted-device server hostname accessor |
| `he` | String coercion utility |
| `Rcl` | Remote-control session clearer |
| `sKt` | Auto-mode configuration evaluator |
| `C7n` | Auto-mode feature-flag reader |
| `eYr` | Auto-mode demand resolver |
| `hWt` | Auto-mode permission updater |
| `OH` | Permission-state updater (setMode, addRules, replaceRules, …) |
| `Ur` | Session-context loader (working_directory, allowed_tools, …) |
| `ptr` | Tool-filter loader |
| `Fo` | Tool-filter constructor |
| `ftr` | Disallowed-tool loader |
| `Sk` | Bypass-permissions mode setter |
| `FYr` | Bypass-permissions enforcer (checks org policy + settings) |
| `FLo` | Feature-limits loader |
| `iKt` | MCP/session options applicator |
| `aKt` | Full session-options update orchestrator |
| `nJ` | Auto-mode availability resolver |
| `gVo` | Session-options validator |
| `mVo` | Session-options merge helper |
| `Ts` | Model-string resolver |
| `F_e` | Model-family classifier (claude-3-*, opus-4-*, sonnet-4-*, haiku-*) |
| `ANe` | Auto-mode gating checker |
| `d` | Supervisor/daemon config updater |
| `jst` | Model-string coercer |
| `nee` | Provider-specific model validator |
| `s3` | Session-state snapshot builder |
| `sEe` | Permission-mode-changed event emitter (`Jc`) |
| `mIe` | MCP-server config iterator |
| `W_t` | Last-assistant-message finder |
| `$w` | Conversation-history tail accessor (`findLast`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.