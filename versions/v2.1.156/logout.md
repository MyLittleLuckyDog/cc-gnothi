---
type: feature-spec
feature: "logout"
cc_version: "2.1.156"
updated: "2026-06-02"
tags: ["logout", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.156 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/logout`

> Analysis basis: CC v2.1.156 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.156

---

## Overview

The `/logout` command signs the user out of their Anthropic account by revoking the active OAuth token, removing local credential files, clearing all in-memory session state, and then exiting the CLI process. It also guards against unintended credential loss in background/daemon sessions by detecting shared-credential contexts and refusing to act in those cases.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `logout` |
| description | Sign out from your Anthropic account |
| loc_byte | `11335797` |
| loc_byte_end | `11336094` |
| module_id | `mC_` |
| load_inline | `true` |
| arbor_handler.name | `f3L` |
| arbor_handler.fqn | `claude-2.1.156::f3L` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.156 bundle.js:+11335797

---

## Input Branching

The handler has four distinct execution paths driven by session context and the outcome of the token-revocation network call, so a flowchart is used.

```mermaid
flowchart TD
    A["/logout invoked"] --> B{Background / daemon session?}
    B -- Yes --> C[Display warning: shared credentials,\nno-op. Return without action.]
    B -- No --> D[Show 'Signing out…' UI]
    D --> E[Call logoutCore:\nrevoke OAuth token via POST]
    E --> F{HTTP revocation succeeded?}
    F -- Success --> G[Emit telemetry: oauth_logout\nUnlink credential file\nClear in-memory auth state\nClear all caches / timers]
    F -- Network error\nor non-2xx --> H[Log error, continue cleanup\n(best-effort logout)]
    G --> I[Write 'Successfully logged out…'\nsystem message to UI]
    H --> I
    I --> J[Mutate app state: mark session ended]
    J --> K[Schedule process exit after\n~200 ms grace period]
    K --> L[Process terminates]
```

Analysis basis: CC v2.1.156 bundle.js:+7713511 (handler entry), +7714847 (background guard message), +7715046 (success message), +7715141 (grace-period delay)

---

## Behavioral Spec

### 1. Background-session guard

```
function checkSharedCredentials(sessionContext):
    if sessionContext.isBackgroundOrDaemon:
        displaySystemMessage(
            "This background session shares credentials with other sessions; "
            "/logout here has no effect. Run /logout from your main terminal to sign out."
        )
        return ABORT
    return CONTINUE
```

When the active session runs in a `bg`, `daemon`, or `daemon-worker` role the handler prints the warning string and returns immediately without touching credentials.

Analysis basis: CC v2.1.156 bundle.js:+7714847, +2199068, +2199078, +2199092

---

### 2. OAuth token revocation (`tokenRevoker`)

```
async function tokenRevoker(oauthConfig):
    endpoint = resolveOAuthEndpoint(oauthConfig)   // bedrock / foundry / vertex / firstParty …
    payload  = { grant_type: "refresh_token", token: currentRefreshToken }
    headers  = { "Content-Type": "application/json" }
    response = await httpPost(endpoint, payload, timeout=5000)
    if isAxiosError(response):
        logNetworkError("oauth_token_revoke", response)
        // continue — best-effort
    emitTelemetry("oauth_logout")
    return response
```

The POST is fire-and-forget with a 5 000 ms timeout; a network failure does not abort the local cleanup steps.

Analysis basis: CC v2.1.156 bundle.js:+2055555 (`bA_`), +2055615 (`refresh_token`), +2055670 (`Content-Type`), +2055685 (`application/json`), +2055713 (timeout 5000), +2055723 (`oauth_token_revoke`), +7714518 (`oauth_logout`)

---

### 3. Credential-file deletion (`credentialFileRemover`)

```
function credentialFileRemover():
    credPath = buildCredentialFilePath()      // uses i9H / iL6 / path.join
    fs.unlink(credPath)                       // async unlink via QkH.unlink
    fs.unlinkSync(credentialLockFile)         // PEK.unlinkSync
```

Both the credential file and any associated lock file are removed from disk.

Analysis basis: CC v2.1.156 bundle.js:+6814063 (`QkH.unlink`), +15457177 (`PEK.unlinkSync`)

---

### 4. In-memory state teardown (`sessionStateClearer`)

```
function sessionStateClearer():
    // Clear multiple in-memory caches
    clearCache(cacheA)          // hzH.clear
    clearCache(cacheB)          // k88.clear
    clearCache(cacheC)          // Iz6.clear
    clearCache(cacheD)          // Oz_.clear
    clearCache(cacheE)          // $U.clear
    clearCache(ratelimitCache)  // YIq.clear

    // Detach process-lifecycle listeners
    process.off("exit", exitHandler)
    process.removeListener("beforeExit", beforeExitHandler)
    clearInterval(heartbeatInterval)

    // Flush pending log entries
    flushErrorLog()
    emitEvent(fQH, "session_end")
```

Analysis basis: CC v2.1.156 bundle.js:+3188625, +3188637, +3188649, +3188661, +3188673 (cache clears), +2938815 (`YIq.clear`), +3188564 (`exit`), +3189221 (`beforeExit`), +3188506 (`process.off`), +3189198 (`process.removeListener`), +3189163 (`clearInterval`)

---

### 5. Config persistence guard (`configSafeWriter`)

During cleanup the config writer checks that any in-cache authentication data is preserved when writing the global config file back to disk. If the re-read config is missing auth that the cache holds, the write is refused to prevent wiping `~/.claude.json`.

```
function configSafeWriter(cachedConfig, onDiskConfig):
    if cachedConfig.hasAuth and not onDiskConfig.hasAuth:
        logWarning("saveGlobalConfig fallback: re-read config is missing auth … refusing to write")
        emitTelemetry("tengu_config_auth_loss_prevented")
        return SKIP_WRITE
    atomicWriteConfig(onDiskConfig)
```

Analysis basis: CC v2.1.156 bundle.js:+3205357 (fallback message), +3208541 (lock-path message), +3208693 (`tengu_config_auth_loss_prevented`)

---

### 6. Success message and process exit

```
async function completeLogout(appState):
    displaySystemMessage("Successfully logged out from your Anthropic account.")
    appState.mutate({ sessionEnded: true })
    appState.delete(sessionKey)
    await sleep(200)          // grace period for UI flush
    exitProcess(0)
```

The 200 ms delay allows the Ink/React UI to finish rendering the success message before the process terminates.

Analysis basis: CC v2.1.156 bundle.js:+7715046 (success string), +7715141 (200 ms constant), +7713934 (`K.mutate`), +7714108 (`K.delete`)

---

### 7. Top-level handler (`f3L` — Arbor-resolved handler)

```
async function f3L(context):
    sessionType = checkSharedCredentials(context.session)
    if sessionType == ABORT:
        return

    displayUI("Signing out…")              // literal at +7715200
    await logoutCore(context):
        await tokenRevoker(context.oauth)
        credentialFileRemover()
        sessionStateClearer()
        configSafeWriter(...)
    await completeLogout(context.appState)
```

`f3L` (FQN `claude-2.1.156::f3L`) is the Arbor-resolved async handler; `yaH` is its primary inner helper. `M3L` is the JSX wrapper that renders the "Signing out…" string and delegates to `yaH`/`f3L`.

Analysis basis: CC v2.1.156 bundle.js:+7714737 (`f3L→V9`), +7714810 (`f3L→yaH`), +7715021 (`f3L→uC_.createElement`), +7715200 (UI string), +7715284 (`M3L→yaH`)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_feature_ok` | Emitted on successful sub-feature completion (bundle.js:+965176) |
| Telemetry — `tengu_feature_sad` | Emitted on sub-feature soft failure (bundle.js:+965311) |
| Telemetry — `tengu_feature_bad` | Emitted on sub-feature hard failure (bundle.js:+965234) |
| Telemetry — `tengu_config_lock_contention` | Emitted when config-lock wait is unexpectedly long (bundle.js:+3208214) |
| Telemetry — `tengu_config_stale_write` | Emitted when a stale config write is detected (bundle.js:+3208350) |
| Telemetry — `tengu_config_parse_error` | Emitted when the on-disk config cannot be parsed (bundle.js:+3210789) |
| Telemetry — `tengu_config_auth_loss_prevented` | Emitted when a write that would erase auth is blocked (bundle.js:+3208693) |
| Telemetry — `tengu_daemon_config_reload` | Emitted when daemon reloads config post-logout (bundle.js:+15493353) |
| Telemetry — `tengu_startup_perf` | Startup profiling — fired during shutdown sequence (bundle.js:+214276) |
| Telemetry — `tengu_scroll_summary` | UI scroll telemetry fired during process teardown (bundle.js:+5329057) |
| Telemetry — `tengu_pewter_brook` | Terminal capability probe telemetry (bundle.js:+3378236) |
| Telemetry — `tengu_cache_eviction_hint` | Cache eviction hint during session_end (bundle.js:+5330090) |
| Network side effect | HTTP POST to OAuth revocation endpoint with `grant_type=refresh_token`; timeout 5 000 ms |
| File system | Credential file deleted via `QkH.unlink`; lock file deleted via `PEK.unlinkSync` |
| In-memory caches cleared | `hzH`, `k88`, `Iz6`, `Oz_`, `$U`, `YIq` |
| Process-event listeners removed | `process.off("exit")`, `process.removeListener("beforeExit")`, `clearInterval(heartbeat)` |
| appState changes | Session key deleted; `sessionEnded` flag set via `K.mutate` / `K.delete` |
| Config write guard | Refuses to write `~/.claude.json` if cached auth would be overwritten (GH #3117) |
| Process exit | `process.exit` called after 200 ms grace period |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.156 | Initial analysis |

---

## Common Mistakes

1. **Running `/logout` inside a background or daemon session.** The command detects `bg`/`daemon`/`daemon-worker` session types and prints a warning instead of logging out. Users must run `/logout` from the main interactive terminal.
2. **Assuming the OAuth token is always successfully revoked before credentials are removed.** The revocation POST has a 5 000 ms timeout; if the network is unavailable, local credentials are still deleted and the process exits. The remote session may remain live until the token expires.
3. **Interrupting the process during the 200 ms grace period.** Killing the process before the UI flush completes can leave the terminal in a dirty state because the Ink renderer may not have finished writing the success message and restoring the cursor.
4. **Expecting `/logout` to clear project-level (`.claude/`) configuration.** The command targets only the global `~/.claude.json` and the OAuth credential file; per-project settings are untouched.
5. **Relying on `/logout` to invalidate API-key–based sessions.** The revocation flow only handles OAuth refresh tokens; sessions authenticated via a static `ANTHROPIC_API_KEY` environment variable are unaffected.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `f3L` | Top-level async logout handler (Arbor-resolved); orchestrates the full logout sequence |
| `yaH` | Core logout implementation helper; calls token revocation, file deletion, and state teardown |
| `M3L` | JSX wrapper component; renders "Signing out…" UI and delegates to `yaH`/`f3L` |
| `q` | Credential lock-file remover (`PEK.unlinkSync` caller) |
| `V9` | Session-type / background-mode checker |
| `VOH` | Background-mode resolver (called by `V9`) |
| `D06` | Session state teardown orchestrator |
| `L26` | Sub-cleaner invoked during state teardown |
| `VgH` | Sub-cleaner invoked during state teardown |
| `TH8` | Rate-limit cache clearer (`YIq.clear`) |
| `VzH` | Sub-cleaner invoked during state teardown |
| `IHH` | Process-listener detacher and event emitter |
| `Mx` | String utility / formatter used during teardown |
| `xH` | Low-level string helper |
| `fx` | String write helper |
| `$QH` | Multi-cache clearer (`hzH`, `k88`, `Iz6`, `Oz_`, `$U`) and `process.off` caller |
| `Jz_` | Interval and listener remover (`clearInterval`, `process.removeListener`) |
| `hH` | Error-log flusher and queue manager |
| `F_` | Error-string formatter |
| `q1` | Essential-traffic queue accessor |
| `D84` | Log-entry queue rotator (`LB6.shift` / `LB6.push`) |
| `Jh9` | Credential-file path builder and async unlinker (`QkH.unlink`) |
| `Ph9` | Path helper used by `Jh9` |
| `RI_` | Keychain/credential path resolver |
| `LyA` | Low-level credential path primitive |
| `i9H` | Path segment component |
| `iL6` | Path joiner (`KyA.join`) |
| `fI_` | Socket/lock file cleaner; calls `H26.unlink` and `clearTimeout` |
| `KI_` | Lock-file timeout clearer |
| `MI_` | Lock-file state checker |
| `I4H` | File-presence checker (`A.some`, `_.includes`) |
| `VcH` | Socket path builder (`e69.join`) |
| `GA` | Auth-provider type inspector (bedrock / foundry / vertex / firstParty …) |
| `oK` | Credential storage accessor |
| `AOq` | Credential read/write/delete facade (secure storage) |
| `H` | Primary secure-storage backend |
| `_` | Secondary / fallback storage backend |
| `pTH` | Storage initialiser / lock-file writer |
| `Qu4` | Storage context provider and directory creator |
| `yH` | Credential write helper |
| `d` | Low-level async data writer |
| `t6` | Credential delete helper |
| `uH` | Credential update helper |
| `L` | Async file-read queue manager |
| `f` | File-handle lifecycle manager |
| `A` | File-name case normaliser |
| `bA_` | OAuth token revocation HTTP caller |
| `Sq` | OAuth endpoint URL builder |
| `AZA` | Environment/stage resolver |
| `q64` | Endpoint string formatter |
| `N` | HTTP request utility (headers, body, retry) |
| `URK` | HTTP transport layer |
| `$$A` | HTTP header builder |
| `RH` | JSON serialiser for request bodies |
| `v4` | URL path manipulator |
| `FzA` | URL character mapper |
| `HuH` | Response write helper |
| `yzA` | Low-level response writer |
| `gRK` | Log file writer with rotation |
| `kxH` | Log flush scheduler (`setTimeout`, `setImmediate`) |
| `cMH` | Log line formatter |
| `B6` | File-existence guard |
| `B16` | EISDIR error handler |
| `rzA` | Log file path builder |
| `izA` | Log file rename/rotate helper |
| `FRK` | Log file append-and-rotate handler |
| `_9` | Log drain registrar (`f$A.register`) |
| `Zt` | Miscellaneous teardown step (<!-- TODO: not found in depth-2 traversal; needs --depth 4 -->) |
| `t3_` | Config persistence writer (global config save with lock) |
| `ZIq` | Config write orchestrator |
| `G1q` | Config path and hash builder |
| `IN` | Config file path normaliser and hash generator |
| `DP` | Config dependency accessor |
| `MV` | OS user-info accessor (`bi6.userInfo`) |
| `ZH` | String coercer |
| `O8` | Global config file reader/writer |
| `hz_` | Config file atomic writer with backup rotation |
| `o$q` | Config object factory |
| `J8` | Error code handler |
| `bzH` | Config file reader with parse and backup |
| `uz6` | Config schema validator |
| `Sz_` | Config backup path builder |
| `$L6` | Atomic file writer (temp → rename pattern) |
| `jQH` | Config cache accessor |
| `pBq` | Config entry iterator |
| `JQH` | Config timestamp recorder |
| `yz_` | Config file path resolver with atomic write |
| `ko6` | Post-write config hook |
| `K` | App-state store (mutate / delete) |
| `nWH` | Miscellaneous logout side-effect step |
| `KNH` | Telemetry attribute builder |
| `H0` | Telemetry string coercer |
| `Y4` | Telemetry event emitter |
| `iu8` | Telemetry event validator |
| `qNH` | OTEL metric recorder |
| `KU` | OTEL span creator |
| `k6` | OTEL attribute setter |
| `C78` | OTEL string converter |
| `Z3H` | Known-event set checker |
| `b7` | OTEL timer helper |
| `ff9` | OTEL histogram helper |
| `R78` | OTEL attribute freeze/sanitise |
| `Q96` | Telemetry queue flusher |
| `SK` | Process shutdown sequencer |
| `tq` | Shutdown executor (UI unmount, drain, exit) |
| `rNH` | UI unmounter (`H.unmount`) |
| `GR` | Terminal restore helper |
| `Yq8` | Terminal cursor restore (`Fr.writeSync`, ESC-7/8) |
| `VV_` | Final output renderer (writes dim goodbye line) |
| `fZ` | Output stream reference |
| `Mb` | Output formatter |
| `BX6` | Binary/executable path resolver |
| `V3` | Shell environment builder |
| `ZJ9` | Output post-processor |
| `vV_` | Process kill sequencer (`process.exit`, `process.kill(SIGKILL)`) |
| `IxH` | I/O drain awaiter (`f$A.drain`) |
| `Y` | Ink renderer supervisor |
| `E2H` | Render-tree diff engine |
| `Lt1` | Layout calculator |
| `T` | Input event handler (stop/start) |
| `QEK` | Heartbeat scheduler |
| `AK6` | Startup-profiling telemetry reporter |
| `rU8` | Performance-mark collector |
| `zYA` | Profiling file path builder |
| `u58` | Scroll-state snapshot capturer |
| `TJ9` | Scroll geometry helper |
| `GJ9` | Scroll metrics calculator |
| `fq` | Terminal capability prober (fullscreen / tmux / SSH detection) |
| `X96` | Cache eviction hint recorder |
| `m58` | Parallel shutdown task runner |
| `Q8` | Timeout-guarded promise wrapper |