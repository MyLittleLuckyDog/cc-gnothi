---
type: feature-spec
feature: "logout"
cc_version: "2.1.163"
updated: "2026-06-05"
tags: ["logout", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.163 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/logout`

> Analysis basis: CC v2.1.163 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.163

---

## Overview

The `/logout` command signs the user out of their Anthropic account by revoking the OAuth token on the server side, removing local credential files, clearing in-memory session state, and then terminating the CLI process. In background (`bg`/`daemon`/`daemon-worker`) sessions the command is a no-op — it prints a notice directing the user to run `/logout` from the main terminal instead.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `logout` |
| description | Sign out from your Anthropic account |
| loc_byte | 11590075 |
| loc_byte_end | 11590359 |
| loc_line | 8013 |
| module_id | `mB_` |
| load_inline | `true` |
| arbor_handler.name | `SC7` |
| arbor_handler.fqn | `claude-2.1.163::SC7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | 0 |

Analysis basis: CC v2.1.163 bundle.js:+11590075

---

## Input Branching

Four distinct paths exist based on session context and operation outcome, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/logout invoked"] --> B{Session type check\nvia sessionContext}
    B -- "bg / daemon / daemon-worker" --> C["Print notice:\n'This background session shares\ncredentials…'\nReturn immediately (no-op)"]
    B -- "Normal / foreground" --> D["Render 'Signing out…' JSX\nvia createElement"]
    D --> E["Perform logout sequence\nvia logoutHandler (keH)"]
    E --> F{Token revocation\nvia revokeOAuthToken (UL_)}
    F -- "HTTP success" --> G["Record telemetry:\noauth_logout"]
    F -- "Axios error / network error" --> H["Log error; continue cleanup\n(non-fatal)"]
    G --> I["Delete credential file\nvia unlinkSync (q)"]
    H --> I
    I --> J["Clear global session state\nvia clearSessionState (HZ6)"]
    J --> K["Clear MCP / process listeners\nvia cleanupListeners (q8H + rcH)"]
    K --> L["Persist updated config\nvia saveConfig (X8)"]
    L --> M["Display success message:\n'Successfully logged out…'\nwith 200 ms delay"]
    M --> N["Terminate process\nvia exitProcess (iK → M9)"]
```

Analysis basis: CC v2.1.163 bundle.js:+7933408 (SC7 entry), +7932291 (keH entry), +7933518 (background-session literal), +7933717 (success literal)

---

## Behavioral Spec

### 1. Top-level handler — `logoutCommandHandler` (`SC7`)

```
async function logoutCommandHandler(context):
    sessionType = getSessionContext()          // Z9 / GYH
    if sessionType in ["bg", "daemon", "daemon-worker"]:
        return renderNotice(
            "This background session shares credentials…"
        )                                      // literal @+7933518

    renderProgressUI("Signing out…")           // createElement @+7933692
    await performLogout(context)               // keH @+7933481
    show("Successfully logged out…")           // literal @+7933717
    setTimeout(exitProcess, 200)               // +7933780
```

Analysis basis: CC v2.1.163 bundle.js:+7933408

---

### 2. Core logout sequence — `performLogout` (`keH`)

```
async function performLogout(context):
    await Promise.resolve()                    // +7932291

    credentialPath = resolveCredentialPath()   // xB_ @+7932321
    unlinkCredentialFile(credentialPath)       // q / xuK.unlinkSync @+7932342

    clearSessionContext()                      // Z9 @+7932346
    clearGlobalState(context)                  // HZ6 @+7932358

    apiClient = buildApiClient()               // XA @+7932378
    configStore = readConfig()                 // M4 @+7932405
    await configStore.readAsync()              // L.readAsync @+7932445

    try:
        await revokeToken(apiClient)           // UL_ @+7932500
    catch:
        logError()                             // kH @+7932778

    recordTelemetry("oauth_logout")            // hH / literal @+7933186, @+7933189

    writeConfig()                              // X8 @+7932830
    configStore.delete(AUTH_KEY)               // K.delete @+7932797
    configStore.mutate(STATE_KEY, null)        // K.mutate @+7932623

    qEH()                                      // additional state flush @+7932808
```

Analysis basis: CC v2.1.163 bundle.js:+7932291

---

### 3. Session type guard — `getSessionContext` (`Z9` → `GYH`)

Reads the running session's context label. Known values found in literals:

- `"bg"` — background session (bundle.js:+2252437)
- `"daemon"` — daemon session (bundle.js:+2252447)
- `"daemon-worker"` — daemon-worker session (bundle.js:+2252461)

Any of these three causes the no-op branch.

Analysis basis: CC v2.1.163 bundle.js:+2252437

---

### 4. Token revocation — `revokeOAuthToken` (`UL_`)

```
async function revokeOAuthToken(apiClient):
    payload = { grant_type: "refresh_token" }  // literal @+2108326
    response = await apiClient.post(payload)   // _A.post @+2108266

    resolveBaseUrl()                           // U1 @+2108277
    // URL helpers: _vA, n74, _.replace, kQ6.includes

    if isAxiosError(response):                 // _A.isAxiosError @+2108471
        recordSubEvent("oauth_token_revoke")   // literal @+2108434
        classifyError(response)                // v @+2108516
        // error classes: network, auth, timeout, http
        logSubError()                          // s6 @+2108603
        // non-fatal: logout continues regardless
```

Analysis basis: CC v2.1.163 bundle.js:+2108266

---

### 5. Global state teardown — `clearGlobalState` (`HZ6`)

Orchestrates several sub-cleanups in sequence:

```
function clearGlobalState(context):
    iG6()            // internal state reset
    YcH()            // clears auth-related store
    clearCache()     // RA8 → bu1.clear @+2991924
    ZDH()            // additional store flush

    cleanupListeners()   // q8H @+7933309
    cleanupTempFiles()   // rB9 @+7933362
    cleanupLockFiles()   // Lx_ @+7933374
```

Analysis basis: CC v2.1.163 bundle.js:+7933266

---

### 6. Listener / process cleanup — `cleanupListeners` (`q8H` → `rcH`)

```
function cleanupListeners():
    emitExitEvent()              // ncH.emit @+3239383; literal "exit" @+3239569
    mE()                         // additional cleanup

    // via rcH:
    stopMainInterval()           // XX_ → clearInterval @+3240264
    process.removeListener(...)  // @+3240299; literal "beforeExit" @+3240322
    process.off(...)             // @+3239511
    yDH.clear()                  // @+3239630
    p98.clear()                  // @+3239642
    tw6.clear()                  // @+3239654
    zX_.clear()                  // @+3239666
    eU.clear()                   // @+3239678

    // error logging helpers: kH → HA, eH, Dq, HW4, hBH.push, Er.logError
```

Analysis basis: CC v2.1.163 bundle.js:+3239361

---

### 7. Temporary and lock-file removal

**Temp file removal — `cleanupTempFiles` (`rB9`)**

```
function cleanupTempFiles():
    aB9()                          // enumerate temp paths
    vma = buildTempPath()          // Cx_ → VmA @+7028123
    TKH()                          // path join helper
    buildOutputPath()              // O$6 → ZmA.join, a8
    OhH.unlink(tempPath)           // async unlink @+7032018
```

Analysis basis: CC v2.1.163 bundle.js:+7031954

**Lock-file removal — `cleanupLockFiles` (`Lx_`)**

```
function cleanupLockFiles():
    stopLockWatcher()             // qx_ → fx_, q7H, clearTimeout @+6987635
    // q7H checks: zX1, A.some, _.includes, YcH
    gG6.unlink(lockPath)          // @+6991853
    buildLockPath()               // YiH → cL9.join, a8
```

Analysis basis: CC v2.1.163 bundle.js:+6991837

---

### 8. Config persistence — `saveConfig` (`X8`)

```
function saveConfig():
    acquireLock()           // SX_ @+3256721
    // SX_ guards with file-system lock (TM6 for atomic write)
    // Emits tengu_config_lock_contention on delay @+3259907
    // Emits tengu_config_stale_write on stale-write detection @+3260043
    // Emits tengu_config_auth_loss_prevented on auth-loss guard @+3260386
    // Backup rotation: keeps last 5 backups; backup files prefixed ".backup."
    // Lock acquisition warning threshold: 60000 ms @+3260588
    writeSafe()             // TM6 → atomic rename
    // TM6 uses randomBytes (6 bytes @+1057396), temp file, fchmodSync, fsyncSync
```

Analysis basis: CC v2.1.163 bundle.js:+3256721

---

### 9. Process exit — `exitProcess` (`iK` → `M9`)

```
async function exitProcess():
    writeExitOutput()         // JyH → AfH.writeSync, H.unmount, YC, U48
    printShutdownStatus()     // LS_ → AfH.writeSync, j6.dim, _.replaceAll
    flushDrainableOutputs()   // OpH → MXA.drain
    await Promise.race([
        settleAllHandlers(),  // gZ9 → Promise.allSettled
        AbortSignal.timeout(),
        raceTimeout()
    ])
    recordSessionEnd()        // W6 / literal "session_end" @+5448163
    process.exit()            // fS_ → process.exit @+5445886
```

Exit is deferred by `setTimeout(exitProcess, 200)` — the 200 ms literal is at bundle.js:+7933812.

Analysis basis: CC v2.1.163 bundle.js:+5446026

---

## State & Side Effects

| Item | Detail |
|---|---|
| Credential file | Deleted synchronously via `xuK.unlinkSync` before token revocation (bundle.js:+16110347) |
| OAuth token revocation | HTTP POST to the Anthropic token endpoint with `grant_type: "refresh_token"` (bundle.js:+2108266, +2108326) |
| Auth store | Cleared via `YcH` and `bu1.clear`; key deleted from config map via `K.delete` (bundle.js:+2991924, +7932797) |
| Process listeners | All `exit` / `beforeExit` listeners removed; five internal Maps cleared (bundle.js:+3239511, +3240322) |
| Lock / temp files | Async-unlinked via `OhH.unlink` and `gG6.unlink` (bundle.js:+7032018, +6991853) |
| Config file | Re-written atomically with auth fields removed; up to 5 rolling backups kept (bundle.js:+3260520, +3260837) |
| MCP connections | Torn down as part of `clearGlobalState` → `q8H` listener cleanup chain |
| Process exit | `process.exit()` called after 200 ms delay (bundle.js:+7933780, +5445886) |
| Telemetry — oauth_logout | Emitted after revocation step (bundle.js:+7933189) |
| Telemetry — tengu_feature_ok | Emitted on successful feature path (bundle.js:+1010222) |
| Telemetry — tengu_feature_sad | Emitted on degraded feature path (bundle.js:+1010365) |
| Telemetry — tengu_feature_bad | Emitted on failed feature path (bundle.js:+1010284) |
| Telemetry — tengu_config_lock_contention | Emitted when config-lock acquisition is slow (bundle.js:+3259907) |
| Telemetry — tengu_config_stale_write | Emitted when a stale write is detected (bundle.js:+3260043) |
| Telemetry — tengu_config_parse_error | Emitted when config JSON fails to parse (bundle.js:+3262482) |
| Telemetry — tengu_config_auth_loss_prevented | Emitted when an auth-loss write is blocked (bundle.js:+3260386) |
| Telemetry — tengu_scroll_summary | Emitted during exit rendering (bundle.js:+5447055) |
| Telemetry — tengu_cache_eviction_hint | Emitted at session end (bundle.js:+5448125) |
| Telemetry — tengu_pewter_brook | Emitted from fullscreen-mode detection during teardown (bundle.js:+3440377) |
| Telemetry — tengu_daemon_config_reload | Emitted if daemon config is reloaded mid-teardown (bundle.js:+16148704) |
| Telemetry — tengu_startup_perf | Emitted as part of exit profiling (bundle.js:+217090) |
| Sound | None detected in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.163 | Initial analysis |

---

## Common Mistakes

1. **Running `/logout` in a background/daemon session** — The command silently no-ops and prints an advisory message. You must run `/logout` in the main foreground terminal for it to take effect (bundle.js:+7933518).
2. **Expecting immediate re-authentication** — After `/logout` the process exits with a 200 ms delay. Re-authentication requires restarting the CLI; no re-auth prompt is shown in the same session (bundle.js:+7933780).
3. **Interrupted logout leaving stale credentials** — If the process is killed between credential-file deletion and config persistence, the config file may retain stale auth fields. The `tengu_config_auth_loss_prevented` guard protects against writing auth data back afterward, but a clean restart and re-authentication is recommended.
4. **Token revocation failures are silent** — Network errors during the HTTP token-revoke call are logged internally and classified (network / auth / timeout / http) but do not abort the logout flow. The local credentials are removed regardless of server-side revocation success (bundle.js:+2108471).
5. **Background-process credential sharing** — The notice at bundle.js:+7933518 indicates that background sessions share credentials with the parent session; running `/logout` there has no effect on either session's stored credentials.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `SC7` | Top-level logout command handler (AsyncFunction; arbor_handler) |
| `keH` | Core logout sequence orchestrator |
| `RC7` | Logout command registration / render wrapper |
| `q` | Credential-file unlink helper (calls `xuK.unlinkSync`) |
| `Z9` | Session-context reader |
| `GYH` | Session-context value resolver |
| `HZ6` | Global state teardown coordinator |
| `iG6` | Internal state reset |
| `YcH` | Auth store clear helper |
| `RA8` | Cache clear dispatcher (calls `bu1.clear`) |
| `ZDH` | Additional store flush |
| `q8H` | Listener and event cleanup orchestrator |
| `qu` | Sub-routine within listener cleanup |
| `Au` | Sub-routine within listener cleanup |
| `rcH` | Process-listener and Map-clear executor |
| `XX_` | Interval stopper (calls `clearInterval`, `process.removeListener`) |
| `kH` | Error logging helper |
| `HA` | Error classification helper |
| `eH` | String error code extractor |
| `Dq` | Essential-traffic error router |
| `HW4` | Error queue manager (shift/push on `kd6`) |
| `rB9` | Temporary-file cleanup |
| `aB9` | Temp-path enumerator |
| `Cx_` | Temp-path builder |
| `VmA` | Path index for temp directory |
| `TKH` | Path join utility |
| `O$6` | Output-path builder (`ZmA.join`, `a8`) |
| `Lx_` | Lock-file cleanup coordinator |
| `qx_` | Lock-watcher stopper (calls `clearTimeout`) |
| `fx_` | Lock-watcher inner handler |
| `q7H` | Lock-file predicate checker (`A.some`, `_.includes`, `YcH`) |
| `YiH` | Lock-path builder (`cL9.join`, `a8`) |
| `XA` | API client builder |
| `M4` | Config reader |
| `EP1` | Config store operations (read / update / delete) |
| `H` | Config store object (context-dependent) |
| `v` | Config value accessor / HTTP header helper |
| `e$` | Config entry accessor |
| `Pw_` | Config line parser (split, trim, indexOf, slice) |
| `ZHH` | Config cache lookup (`g44.has`) |
| `uj` | Config string replacer |
| `t1` | Config field transformer (`D6H`, `Aq`, `eX`) |
| `s6` | Error sub-logger (`c`, `P6`) |
| `aZH` | Async config read helper |
| `C9L` | Config store context resolver (AsyncLocalStorage, mkdir, join) |
| `hH` | Telemetry event emitter (`c`, `P6`) |
| `c` | Low-level telemetry emitter |
| `P6` | Telemetry payload builder (`Nu6`) |
| `RH` | Fallback telemetry emitter (`c`, `P6`) |
| `L` | Async file handle abstraction |
| `f` | File handle inner object (open/close/queue) |
| `A` | File-name lowercaser / MCP filter helper |
| `UL_` | OAuth token revoker (HTTP POST, error handling) |
| `U1` | Base-URL resolver (`_vA`, `n74`, `_.replace`, `kQ6.includes`) |
| `_vA` | Environment-based URL selector |
| `n74` | OAuth endpoint path builder |
| `Ui` | Auth-UI state handler |
| `tw_` | Config-lock file system helper |
| `lu1` | Config-path builder (`Q$1`, `v`, `EH`) |
| `Q$1` | Config-directory path resolver (`zI`, `tP`, `FV`) |
| `zI` | Config path normalizer (NFC, sha256 hash, `U1`) |
| `tP` | Config path suffix builder |
| `FV` | User-info reader (`Ht6.userInfo`, `Z8L.test`) |
| `EH` | String coercion helper |
| `X8` | Config persistence / save-with-lock |
| `SX_` | Atomic config-write implementation (lock, backup, rename) |
| `Q6` | File-existence checker |
| `wP1` | Config object merger (`v5_`, `Object.assign`) |
| `v8` | File stat helper |
| `bDH` | Config-file reader with backup rotation |
| `fj6` | Config data validator |
| `SH` | JSON stringifier wrapper |
| `RX_` | Backup-path builder (`pD.join`, `a8`) |
| `V` | Backup-file predicate |
| `P` | Text/cursor component (INSERT/NORMAL mode) |
| `T` | Renderer / spinner component |
| `TM6` | Atomic file writer (randomBytes, openSync, writeFileSync, fchmodSync, fsyncSync, renameSync) |
| `_lH` | Lock metadata holder |
| `Lr1` | Lock-entries iterator |
| `t98` | Timestamp helper (`Date.now`) |
| `hX_` | Lock-file writer (`TM6`, `SH`, `UJ`) |
| `ie6` | Additional lock/config helper |
| `K` | State-map (mutate / delete / map / padEnd operations) |
| `qEH` | State-flush finalizer |
| `IkH` | Logout UI renderer (`Vj`, `N4`, `String`) |
| `Vj` | Text node renderer |
| `N4` | Telemetry attribute builder (`vkH`, `e46`, `K.split`, `M.emit`) |
| `vkH` | OTEL resource-attribute assembler |
| `oU` | Session-ID generator (`Mr1.randomBytes`, `X8`) |
| `h6` | UV handle wrapper |
| `k$8` | OTEL attribute-key registry (`H3`, `AEH`, `ssL`) |
| `B26` | Attribute-key string helper |
| `hL` | Metrics writer (`zY`, `S6`) |
| `Wj9` | OTEL exporter helper (`esL`, `tsL`) |
| `e46` | Event-name attribute builder |
| `Sg8` | Telemetry span emitter |
| `M` | MCP manager / event emitter |
| `AbH` | MCP server connection builder |
| `tU8` | MCP connection result applier |
| `$` | MCP key resolver (`TKK`) |
| `VYA` | MCP remote-server retry handler |
| `Rg8` | Telemetry metric recorder |
| `iK` | Process-exit initiator |
| `M9` | Full process-exit sequence |
| `JyH` | Exit output writer (`AfH.writeSync`, `H.unmount`, `YC`, `U48`) |
| `YC` | Terminal cursor restore helper |
| `U48` | Terminal output finalizer (`Aa.writeSync`, `SvH`, `TvH`, `bW`, `K$`) |
| `LS_` | Shutdown status printer (`AfH.writeSync`, `j6.dim`) |
| `qE` | Shutdown label builder |
| `Kx` | Shutdown formatter |
| `w06` | Working-directory stat helper |
| `g$` | Directory display helper (`h6`, `d4`) |
| `CZ9` | Path escape helper |
| `fS_` | Final exit caller (`process.exit`, `process.kill`, `clearTimeout`) |
| `OpH` | Output drain awaiter (`MXA.drain`) |
| `Y` | Render-loop controller (start/stop/updateConfig) |
| `C0H` | Render-frame builder |
| `iLK` | Layout calculator (`Math.max`, `vD`) |
| `E` | Key-event handler |
| `LmK` | Heartbeat emitter (`L8H`) |
| `gZ9` | All-settled shutdown awaiter (`Promise.allSettled`, `Array.from`) |
| `j76` | Startup-profiling reporter (`pc8`, `OWA`) |
| `pc8` | Profile-log writer (`jWA`, `c`) |
| `OWA` | Profile-report formatter (`JSON.stringify`, `K.map`) |
| `mO8` | Scroll-summary emitter (`RZ9`, `SZ9`, `M1`) |
| `RZ9` | Scroll-state reader |
| `SZ9` | Scroll-metric calculator (`Date.now`, `Math.max`, `Math.round`) |
| `M1` | Display-mode resolver (`ZHH`, `q2_`, `mo`, `A2_`, `e_`, `wNL`, `D6`) |
| `Z46` | Cache-eviction hint emitter |
| `W6` | Session-end event recorder (`Nu6`) |
| `Nu6` | Base event builder |
| `pO8` | Parallel-shutdown task runner (`Promise.all`, `Promise.race`, `l8`) |
| `l8` | Timeout-with-abort helper (`setTimeout`, `clearTimeout`, `L.unref`) |