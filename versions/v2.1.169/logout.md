---
type: feature-spec
feature: "logout"
cc_version: "2.1.169"
updated: "2026-06-11"
tags: ["logout", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.169 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/logout`

> Analysis basis: CC v2.1.169 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.169

---

## Overview

The `/logout` command signs the user out of their Anthropic account by revoking the active OAuth token, clearing stored credentials, cleaning up session state, and then terminating the CLI process. In background (`bg`/`daemon`) session modes the command detects the shared-credential context and exits early with an informational message instead of performing any destructive action.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `logout` |
| description | Sign out from your Anthropic account |
| loc_byte | `11739071` |
| loc_byte_end | `11739355` |
| loc_line | `8069` |
| module_id | `un_` |
| load_inline | `true` |
| arbor_handler.name | `dn7` |
| arbor_handler.fqn | `claude-2.1.169::dn7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.169 bundle.js:+11739071

---

## Input Branching

Four distinct execution paths exist, requiring a Mermaid flowchart.

```mermaid
flowchart TD
    A(["/logout invoked"]) --> B{Session mode?}
    B -- "bg / daemon / daemon-worker" --> C["Display: shared-credentials warning\n(no logout performed)"]
    C --> Z([Return — no state change])
    B -- "normal / interactive" --> D{Auth type?}
    D -- "oauth" --> E[Revoke OAuth token via network POST\ntelemetry: oauth_token_revoke]
    D -- "other / API key" --> F[Skip token-revoke network call]
    E --> G[Clear stored credentials\n(keychain + config)]
    F --> G
    G --> H[Emit telemetry: oauth_logout]
    H --> I[Tear down session state:\nclear maps, remove listeners,\nunlink lock files, clear daemon files]
    I --> J[Render JSX 'Successfully logged out' message\n+ 200 ms delay]
    J --> K[Terminate process via shutdown helper]
    K --> Z2([process.exit])
```

Analysis basis: CC v2.1.169 bundle.js:+8259402 (handler entry `dn7`), +8258285 (logout execution path `p86`), +8259512 (background-session guard literal), +8259183 (`oauth_logout` telemetry literal)

---

## Behavioral Spec

### Handler entry point (`dn7`)

The Arbor-resolved handler `dn7` is an `AsyncFunction` reached via `module_id → un_`.

```
async function logoutHandler(context):
    sessionMode = getSessionMode(context)          // w9 / nDH

    if sessionMode in ["bg", "daemon", "daemon-worker"]:
        renderMessage(
            "This background session shares credentials with other sessions; " +
            "/logout here has no effect. Run /logout from your main terminal to sign out."
        )
        return                                     // early exit, no state mutation

    // Build React/JSX element for status display
    statusElement = createElement(...)             // xn_.createElement @ +8259686

    // Execute the actual logout sequence
    await performLogout(context)                   // p86 @ +8259475

    // Schedule process termination after brief UI delay
    setTimeout(() => shutdownProcess(j4), 200)    // +8259774, literal 200 @ +8259806
```

Analysis basis: CC v2.1.169 bundle.js:+8259402

---

### Session-mode guard

```
function getSessionMode(appState):
    // nDH resolves the running mode string
    // Known values: "bg", "daemon", "daemon-worker" (background),
    //               "local-agent", others (interactive)
    return appState.currentMode                    // nDH @ +2261679
```

Literals observed: `"bg"` (+2261602), `"daemon"` (+2261612), `"daemon-worker"` (+2261626).

Analysis basis: CC v2.1.169 bundle.js:+2261602

---

### Core logout sequence (`p86`)

```
async function performLogout(context):
    // 1. Resolve a settled Promise to begin async chain
    await Promise.resolve()                        // +8258285

    // 2. Determine credential store identity
    credentialStore = resolveCredentialStore(bn_)  // +8258315

    // 3. Read current auth config
    authConfig = await readAuthConfig(V4 → mT1)   // +8258399

    // 4. If authType == "oauth":
    //      POST /oauth/token/revoke with refresh_token
    //      (S3_ → MA.post, literal "refresh_token" @ +2116937)
    //      on network error: log telemetry "oauth_token_revoke" @ +2117045
    //                        classify error (network / auth / timeout / http)
    if authConfig.type == "oauth":
        revokeOAuthToken(S3_)                      // +8258494

    // 5. Emit oauth_logout telemetry event
    emitTelemetry("oauth_logout")                  // +8259183

    // 6. Wipe credentials from config and keychain
    clearStoredCredentials(K.mutate → K.delete)    // +8258617, +8258791

    // 7. Update in-memory state (K.mutate)
    mutateAppState(K.mutate)                       // +8258617

    // 8. Write updated config to disk
    saveConfig(X8)                                 // +8258824

    // 9. Tear down session / process resources
    teardownSession(WI6)                           // +8258352

    // 10. Persist final config snapshot
    flushConfig(SH)                                // +8259180

    // 11. Log error-level message via hH (logAppend)
    appendLog(hH)                                  // +8258772
```

Analysis basis: CC v2.1.169 bundle.js:+8258285

---

### OAuth token revocation (`S3_`)

```
async function revokeOAuthToken(authConfig):
    endpoint = buildOAuthEndpoint(n1)              // constructs revoke URL
    // Sends POST with body { token: authConfig.refresh_token }
    response = await httpClient.post(endpoint,
                   { refresh_token: authConfig.refreshToken })  // MA.post @ +2116877

    if httpClient.isAxiosError(response.error):    // +2117082
        classifyError(N)                           // network/auth/timeout/http @ +2117127
        emitTelemetry("oauth_token_revoke", { outcome: "network" })
    else:
        // success path — continue credential wipe
        pass
```

Literal `"refresh_token"` (+2116937), `"oauth_token_revoke"` (+2117045), `"network"` (+2117169).

Analysis basis: CC v2.1.169 bundle.js:+2116877

---

### Credential wipe (`$1` → `ij`)

```
function wipeCredentials(configPath):
    // smH: print red error text to console on failure
    // ij:  write blank/null credential block to disk
    credPath = path.join(configDir, credentialFile)   // Do8.join @ +194917
    fs.writeFileSync(credPath, emptyCredentials)       // nBH.writeFileSync @ +194899
```

On write failure `smH` emits to `console.error` with `J6.red` formatting (+13208326, +13208340) and records `"cli_error"` (+13208381).

Analysis basis: CC v2.1.169 bundle.js:+13208371

---

### Session teardown (`WI6`)

```
async function teardownSession():
    // a. Clear in-memory auth/API client caches
    clearApiClientCache(Av6)                       // +8259260
    clearNetworkState(xnH)                         // +8259266
    clearTokenMap(jK8 → eF1.clear)                // +8259272, +3002711

    // b. Clear owner/user state
    clearOwnerState(owH)                           // +8259278

    // c. Shut down process-level listeners and interval timers
    shutdownProcessListeners(X_H):                 // +8259303
        tu()   // sub-shutdown step 1                // +3251566
        PiH(): // remove process listeners            // +3251582
            clearInterval(XG_)                     // +3252476
            process.removeListener(...)            // +3252511
            process.off("exit", ...)               // +3251716
            clearAll(qJH, EL8, tX6, zG_, sB)      // +3251842–+3251890
        jiH.emit(...)                              // +3251588
        XE()   // additional teardown               // +3251603
        hH()   // log append                        // +3251627

    // d. Remove OAuth lock/state files
    removeLockFiles(Ba9):                          // +8259356
        Qa9()                                      // +7358063
        Sg_ → JFA()                               // +7358069
        R4H()                                      // +7358092
        Er6(): path.join(...) + unlink             // +7358115
        sH6.unlink(...)                            // +7358127

    // e. Clean up daemon socket / PID files
    cleanDaemonFiles(dF_):                         // +8259368
        gF_ → cF_()                               // +7303438
        kfH():
            check active connections (A.some)      // +4211434
            clearTimeout(...)                      // +7303491
        SRH.unlink(...)                            // +7307871
        NjH(): path.join(R$9, ...) + unlink       // +7307882
```

Literals `"beforeExit"` (+3252534), `"exit"` (+3251774).

Analysis basis: CC v2.1.169 bundle.js:+8259352

---

### Config persistence (`X8` / `UL8`)

```
function saveGlobalConfig(configData):
    // Acquires a file lock (60 000 ms timeout, literal @ +3272995)
    // Validates that cached auth is not lost before writing
    // (guard literal: "saveGlobalConfig fallback: re-read config is missing auth..." @ +3269335)
    acquireLock(UL8):
        if lockContention: emit tengu_config_lock_contention    // @ +3272314
        readCurrentFile()
        if authLossPrevented: emit tengu_config_auth_loss_prevented  // @ +3272793
        atomicWrite(WO6):          // write-rename-fsync pattern
            writeToTempFile()
            fchmodSync(permissions=384)  // octal 0600, literal @ +3273526
            fsyncSync()
            renameSync(tmp → target)
        keepBackups(count ≤ 5)     // literal 5 @ +3273244
```

Analysis basis: CC v2.1.169 bundle.js:+3269309

---

### Shutdown helper (`j4` / `P9`)

```
async function shutdownProcess():
    // Unmounts Ink/React rendering (pRH → H.unmount @ +7316244)
    // Writes final output line (v58 → Xs.writeSync @ +3800371)
    // Waits up to 3500 ms for pending I/O (literal @ +7318591)
    // Drains stdout buffer (EBH → ZGA.drain @ +62371)
    // Races shutdown steps vs 2000 ms hard timeout (literal @ +7318769)
    // Settles all pending operations (co9 → Promise.allSettled @ +13420783)
    // Emits session_end event (literal @ +7318981)
    // Calls process.exit (Hg_ @ +7316831)
```

Analysis basis: CC v2.1.169 bundle.js:+7316971

---

### Success UI (`cn7`)

```
function renderLogoutUI():
    // Renders JSX element displaying "Signing out…" (literal @ +8259865)
    // After completion shows "Successfully logged out from your Anthropic account."
    //   (literal @ +8259711)
    // Passes through UyH (status-line component), m4 (event emit)
    // String-formats final message
```

Literals: `"Signing out…"` (+8259865), `"Successfully logged out from your Anthropic account."` (+8259711), `"logout"` (+8259898), `"oauth"` (+8259929).

Analysis basis: CC v2.1.169 bundle.js:+8259863

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — oauth_logout | Emitted after credential wipe decision; literal at +8259183 |
| Telemetry — oauth_token_revoke | Emitted on network-level error during OAuth POST revocation; +2117045 |
| Telemetry — tengu_config_lock_contention | Config lock wait exceeded; +3272314 |
| Telemetry — tengu_config_stale_write | Attempted write with stale config data; +3272450 |
| Telemetry — tengu_config_parse_error | Config file could not be parsed; +3274889 |
| Telemetry — tengu_config_auth_loss_prevented | Write aborted to prevent wiping auth; +3272793 |
| Telemetry — tengu_feature_ok / tengu_feature_sad / tengu_feature_bad | General feature outcome tracking; +1013926, +1014069, +1013988 |
| Telemetry — tengu_scroll_summary | Scroll/rendering stats at session end; +7318000 |
| Telemetry — tengu_cache_eviction_hint | Cache eviction signal during shutdown; +7318943 |
| Telemetry — tengu_daemon_config_reload | Daemon config reload during teardown; +16521994 |
| Credential files | Credential file written blank/null via `nBH.writeFileSync`; +194899 |
| Config file | `~/.claude.json` updated atomically with auth fields removed; mode 0600; +3273526 |
| Config backups | Up to 5 rolling backups kept in `backups/` subdirectory; +3273244, +3273826 |
| OAuth lock files | Lock/state files removed via `sH6.unlink` and `SRH.unlink`; +7358127, +7307871 |
| Process listeners | All `process.on("exit")`, `process.on("beforeExit")` handlers removed; +3251774, +3252534 |
| Interval timers | All active intervals cleared via `clearInterval`; +3252476 |
| In-memory maps | `eF1`, `qJH`, `EL8`, `tX6`, `zG_`, `sB` cleared; +3002711, +3251842–+3251890 |
| Process exit | `process.exit` called unconditionally after teardown; +7316831 |
| Sound | None observed in traversal |
| Background-session guard | When `sessionMode ∈ {bg, daemon, daemon-worker}`, no state is mutated and no network calls are made; +8259512 |

---

## Version History

| Version | Change |
|---|---|
| v2.1.169 | Initial analysis |

---

## Common Mistakes

1. **Running `/logout` in a background/daemon session**: The command detects `bg`, `daemon`, and `daemon-worker` modes and prints a warning without performing any logout. Users must run `/logout` from the main interactive terminal.
2. **Expecting the process to stay alive**: `/logout` always terminates the CLI process. Any unsaved work or in-flight operations will be lost.
3. **Assuming network failure blocks logout**: If the OAuth token-revocation POST fails (network error, timeout, 401, 403), the command still proceeds to wipe local credentials. The revocation failure is recorded in telemetry but does not abort the logout.
4. **Ignoring the auth-loss guard**: The config persistence layer will refuse to write `~/.claude.json` if the in-memory cache contains auth that the re-read file no longer has, emitting `tengu_config_auth_loss_prevented`. This can leave partial state; rerunning `/logout` is safe.
5. **Using `/logout` to switch accounts**: `/logout` terminates the process immediately; it does not provide an in-session account-switcher. Re-launch Claude Code and authenticate with the new account.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `dn7` | Main logout handler (AsyncFunction, Arbor-resolved via module_id `un_`) |
| `p86` | Core logout execution sequence (credential revoke → wipe → teardown) |
| `cn7` | Logout UI renderer (JSX status messages "Signing out…" / success) |
| `q` | Async data-stream utility called by credential wipe path |
| `$1` | Credential file wipe helper (calls `smH` on error, `ij` to write) |
| `smH` | Error printer (console.error + red formatting via J6.red) |
| `ij` | Credential file writer (nBH.writeFileSync + Do8.join) |
| `w9` | Session-mode resolver (returns "bg"/"daemon"/etc.) |
| `nDH` | Session-mode reader called by w9 |
| `WI6` | Session teardown orchestrator |
| `Av6` | API client cache clear helper |
| `xnH` | Network state clear helper |
| `jK8` | Token map clear helper (eF1.clear) |
| `owH` | Owner/user state clear helper |
| `X_H` | Process-listener shutdown orchestrator |
| `tu` | Sub-shutdown step 1 inside X_H |
| `su` | Sub-shutdown step 2 called by tu |
| `PiH` | Process listener removal (process.off, clearInterval, map clears) |
| `XG_` | Interval/listener cleanup (clearInterval + process.removeListener) |
| `hH` | Log-append helper (logError path via bo.logError) |
| `wA` | Error constructor wrapper |
| `_6` | String utility |
| `kq` | Essential-traffic log manager |
| `av4` | Di6 queue shift/push helper |
| `Ba9` | OAuth lock/state file removal orchestrator |
| `Qa9` | Lock file removal helper 1 |
| `Sg_` | Lock file removal helper 2 (calls JFA) |
| `JFA` | Lock file removal step |
| `R4H` | Lock file removal helper 3 |
| `Er6` | Lock file path builder + unlink (wFA.join + A_) |
| `dF_` | Daemon file cleanup orchestrator |
| `gF_` | Daemon socket cleanup (calls cF_, kfH, clearTimeout) |
| `cF_` | Daemon socket sub-cleanup |
| `kfH` | Active-connection check before socket removal (A.some, _.includes) |
| `NjH` | Daemon PID file path builder + unlink |
| `YA` | String utility wrapper used in logout path |
| `V4` | Auth config reader (delegates to mT1) |
| `mT1` | Secure storage read/write/delete orchestrator |
| `KNH` | Storage-write helper with retry logic |
| `yML` | Async-local-storage context reader for storage writes |
| `SH` | Config snapshot flush helper |
| `K6` | c76 constant accessor |
| `bH` | Config delete helper |
| `S3_` | OAuth token-revocation HTTP caller (MA.post) |
| `n1` | OAuth endpoint URL builder |
| `JSA` | OAuth base URL constant |
| `hY4` | OAuth endpoint path helper |
| `tr` | Telemetry emit call in logout path |
| `o2_` | Config persistence path (calls Yg1, X8, S_8) |
| `Yg1` | Config path resolver (calls Kw1, N, EH) |
| `Kw1` | Platform config path constructor (Ak, V2, yv) |
| `Ak` | Path normaliser + SHA-256 hasher |
| `V2` | Config value getter (gVH) |
| `yv` | OS userInfo resolver (F68.userInfo) |
| `EH` | String coercion helper |
| `X8` | Global config save orchestrator (UL8 → atomic write) |
| `UL8` | Atomic config file write with lock, backup, and symlink resolution |
| `hT1` | Storage initialiser (Tz_, Object.assign) |
| `E8` | File-existence check helper |
| `y7H` | Config file reader with backup logic |
| `ViH` | Config validator helper |
| `CH` | JSON.stringify wrapper |
| `yG_` | Backup directory path builder (fw.join + A_) |
| `WO6` | Atomic file write helper (write-rename-fsync, symlink-safe) |
| `OJH` | Config object merge helper |
| `Ie1` | Object.entries mapper for config |
| `MP6` | Timestamp helper (Date.now) |
| `pL8` | Config sub-write helper |
| `S_8` | Config persistence sub-step |
| `K` | App-state accessor (L.map, padEnd) |
| `KZH` | App-state key deletion helper |
| `UyH` | Status-line UI component (gJ, m4) |
| `gJ` | UI string formatter (EH) |
| `m4` | Event emitter for UI updates (M.emit, kn8) |
| `pyH` | OTEL metrics attributes builder |
| `iB` | Session ID generator (ye1.randomBytes, X8) |
| `I6` | xZ constant accessor |
| `H$8` | Metrics resource builder (W$, qZH, MrL, Object.freeze) |
| `xW6` | Attribute filter helper (_6) |
| `FL` | Metrics flush helper (IY, y6) |
| `jO9` | Metrics shutdown helper (OrL, $rL) |
| `of6` | Metrics sub-component |
| `kn8` | Event sequence tracker |
| `M` | MCP / app-state event bus (mSH, cd8, dXA) |
| `mSH` | MCP server connection manager |
| `cd8` | MCP connection result applier |
| `dXA` | MCP server state reconciler |
| `yn8` | UI notification helper |
| `j4` | Process shutdown dispatcher (P9, pRH, eF_, Hg_) |
| `P9` | Main shutdown sequencer (unmount, drain, race, exit) |
| `pRH` | Ink renderer unmount + final write |
| `Hb` | Post-unmount helper |
| `v58` | Terminal cursor restore + final line write |
| `eF_` | Pre-exit output formatter (path display, dim text) |
| `tW` | Terminal width helper |
| `ex` | Exit code resolver |
| `Yv6` | Working-directory stat helper |
| `f$` | Shell command formatter |
| `xo9` | Output truncation helper |
| `Hg_` | Hard-exit helper (clearTimeout, process.exit / process.kill SIGKILL) |
| `EBH` | Stdout drain helper (ZGA.drain) |
| `Y` | Supervisor/renderer stop-start orchestrator |
| `ITH` | Renderer state inspector |
| `BOK` | Column-width calculator for output |
| `T` | Renderer stop helper (OZ6, M76) |
| `edK` | Heartbeat stop helper (W_H) |
| `co9` | Promise.allSettled shutdown waiter |
| `zM6` | Startup profiling reporter (xo8, ZZA) |
| `xo8` | Profiling data reader (kZA) |
| `ZZA` | Profiling report formatter + writer |
| `bP8` | Scroll/session summary emitter (Co9, E1) |
| `bo9` | Scroll stats collector |
| `Co9` | Timing calculator (Date.now, Math.max/round, Object.assign) |
| `E1` | Local-agent session stats builder |
| `Xf6` | Cache-eviction hint helper |
| `M6` | c76 constant accessor (parallel to K6) |
| `c76` | Core constant value |
| `BRH` | Session-end bookkeeping helper (RP8) |
| `RP8` | Session-end sub-step |
| `mw8` | MCP client filter predicate (used inside dXA) |