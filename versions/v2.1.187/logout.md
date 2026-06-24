---
type: feature-spec
feature: "logout"
cc_version: "2.1.187"
updated: "2026-06-24"
tags: ["logout", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.187 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/logout`

> Analysis basis: CC v2.1.187 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.187

---

## Overview

The `/logout` command signs the current user out of their Anthropic account by revoking the active OAuth token, clearing stored credentials and session state, and then terminating the CLI process. It is a `local-jsx` command that renders a transitional UI message before executing the sign-out sequence.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `logout` |
| description | Sign out from your Anthropic account |
| loc_byte | `11632010` |
| loc_byte_end | `11632294` |
| loc_line | `7767` |
| module_id | `Iao` |
| load_inline | `true` |
| arbor_handler.name | `TSp` |
| arbor_handler.fqn | `claude-2.1.187::TSp` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.187 bundle.js:+11632010

---

## Input Branching

The command has three distinct execution branches based on the session context detected at runtime:

```mermaid
flowchart TD
    A[/logout invoked] --> B{Detect session type}
    B -->|Background session\nshares credentials| C[Display warning message\n'shares credentials with\nother sessions']
    C --> D[No-op: return without logout]
    B -->|OAuth auth present\nin foreground session| E[Show 'Signing out…' UI]
    E --> F[Invoke logout handler: tokenRevoke]
    F --> G{Token revocation\nHTTP result}
    G -->|HTTP 200 success\nor non-auth error| H[Clear credentials from\nsecure storage / config]
    H --> I[Emit oauth_logout telemetry]
    I --> J[Display success message\n'Successfully logged out…']
    J --> K[Schedule process.exit via setTimeout]
    G -->|Auth / network error| L[Log error, attempt\ncredential clear anyway]
    L --> K
    B -->|No oauth credentials| M[No credentials to revoke;\nsilent or informational exit]
```

Analysis basis: CC v2.1.187 bundle.js:+8169792 (handler entry `TSp`), +8169902 (background-session guard string), +8170096 (success string), +8170160 (setTimeout for exit)

---

## Behavioral Spec

### Handler Entry — `logoutCommandHandler` (`TSp`)

The Arbor-resolved handler (`TSp`, `AsyncFunction`) is the true entry point for this command.

```
async function logoutCommandHandler(context):
    sessionStore = readSessionStore()          // Ws, +8169792

    if sessionStore.isBackgroundSession():
        renderJSX(warningMessage(
            "This background session shares credentials …"
        ))
        return   // no-op; exit early

    // Render transitional UI
    renderJSX("Signing out…")                 // ISp sub-render +8170251

    // Delegate to core logout flow
    await coreLogoutFlow(context)             // lct, +8169865
```

Analysis basis: CC v2.1.187 bundle.js:+8169792

---

### Core Logout Flow — `coreLogoutFlow` (`lct`)

`lct` orchestrates the full sign-out sequence. It is called from `TSp` and executes several sub-steps in order.

```
async function coreLogoutFlow(context):
    // 1. Resolve OAuth token and issue revocation HTTP call
    await revokeOAuthToken()                  // IO, +8168459

    // 2. Clear session-level caches / in-memory stores
    clearSessionState()                        // Ws, +8168303
    clearDaemonState()                         // lBt, +8168315

    // 3. Wipe credentials from secure/plaintext storage
    deleteStoredCredentials()                  // r, +8168299

    // 4. Emit oauth_logout telemetry event
    recordTelemetry("oauth_logout")            // Le, +8169570

    // 5. Update config file atomically
    persistLogoutToConfig()                    // CFr, +8168629

    // 6. Display success and exit
    await renderSuccessAndExit(context)        // gi (via Ic), +8170176
```

Analysis basis: CC v2.1.187 bundle.js:+8168248 through +8169570

---

### OAuth Token Revocation — `revokeOAuthToken` (`IO`)

```
async function revokeOAuthToken():
    url = buildRevocationEndpoint()           // Ls, +8168459
    // Endpoint includes refresh_token grant type
    // Content-Type: application/json
    // Timeout: 5000 ms                       // +2143188
    response = await httpPost(url, {
        grant_type: "refresh_token"           // +2143090
    })                                        // ho.post, +2143030

    if isAxiosError(response):               // +2143235
        errorCategory = classifyError(response)
        // Categories: auth (401/403), timeout, network, http, other
        log("oauth_token_revoke", errorCategory) // +2143198
        // Non-fatal: continue with credential clearing
    else:
        log("oauth_token_revoke", "success")

    return response
```

Constants:
- HTTP timeout: 5000 ms (bundle.js:+2143188)
- Grant type literal: `"refresh_token"` (bundle.js:+2143090)
- Telemetry event for revocation: `"oauth_token_revoke"` (bundle.js:+2143198)

Analysis basis: CC v2.1.187 bundle.js:+2143030

---

### Credential Deletion — `deleteStoredCredentials` (`r` → `Is`)

```
function deleteStoredCredentials():
    try:
        result = readSecureStorage()         // Is, +17093488
        // data property access +17093478
        writeConfigFile(emptyCredentials)    // oT, +13085954
        // Writes via Ore.writeFileSync      // +200185
    catch error:
        logError(error, "cli_error")        // aqe → console.error, +13085902
        // Error string tagged "cli_error"  // +13085957
    finally:
        process.exit(0)                     // +13085970
```

Note: `process.exit` is called inside the credential-deletion path when run standalone (e.g. non-OAuth or terminal-only flow). In the full OAuth flow it is deferred via `setTimeout` after JSX unmount.

Analysis basis: CC v2.1.187 bundle.js:+17093488, +13085970

---

### Secure Storage Write — `writeCredentialsStore` (`TWs`)

The credential storage layer (`TWs`, reached via `Gl`) supports both primary (OS keychain) and plaintext fallback modes.

```
function writeCredentialsStore(key, value):
    // Attempt primary secure storage
    primaryResult = primaryStorage.write(key, value)  // e.read/e.readAsync paths

    if primaryResult.skippedFallback:
        emitTelemetry("secure_storage_credentials_write",
                       "primary_transient_skip_fallback")  // +2337350

    else if primaryResult.usedFallback:
        emitTelemetry("secure_storage_credentials_write",
                       "plaintext_fallback_used")          // +2337499

    else if primaryResult.bothFailed:
        emitTelemetry("secure_storage_credentials_write",
                       "primary_and_fallback_failed")      // +2337602
```

Analysis basis: CC v2.1.187 bundle.js:+2337252, +2337350, +2337499, +2337602

---

### Session-State Clearing — `clearDaemonState` (`lBt`)

```
function clearDaemonState():
    clearKnownDaemonConnections()    // zDn, +8169650
    resetQueryQueue()                // qQ,  +8169656
    clearEventEmitters()             // Eme → Mai.clear, +8169661
    clearOpenIntervals()             // OIe, +8169667
    shutdownProcessListeners()       // jse, +8169692
        // jse removes exit/beforeExit listeners (+3332885, +3333629)
        // clears multiple interval/timeout sets: zIe, fSn, QRt, uBr, IW
    removeSocketFiles()              // qHa → bat.unlink, +8169746
        // unlinkSync on socket path if it exists
    stopMcpConnections()             // Cao → EOo, +8169758
        // clearTimeout on pending MCP timers
        // Aqe.unlink on MCP socket file
```

Analysis basis: CC v2.1.187 bundle.js:+8169650 through +8169758

---

### Config Persistence — `persistLogoutToConfig` (`CFr`)

```
async function persistLogoutToConfig():
    configPath = resolveConfigPath()          // Kai → MFs → CO, +3067336
    // CO uses sha256 to derive a per-user path key  (+2156408, hex +2156435)
    // Username from os.userInfo()            // ZM → Zdn.userInfo, +2156556
    // Service name: "claude-code-user"       // +2156588

    await saveWithLock(configPath, {
        // Auth fields removed from config
    })                                        // hn → GQn, +13746874
    // GQn acquires a file lock, re-reads config before write
    // Guards against auth-loss: if re-read config has auth but cache
    // does not, write is refused to protect credentials    // +13750618
    // Backup rotation: keeps last 5 backups // +13751221
    // Lock contention emits tengu_config_lock_contention  // +13750291
```

Auth-loss guard message (citation fragment only): `"saveConfigWithLock: re-read config is…"` (bundle.js:+13750618)

Analysis basis: CC v2.1.187 bundle.js:+3067213, +13750291

---

### Exit Rendering — `renderSuccessAndExit` (`Ic` → `gi`)

```
async function renderSuccessAndExit(context):
    unmountCurrentUI()                         // U9e, +7229542
    // fHe.writeSync for terminal output       // +7232231
    printFooter("Successfully logged out …")  // Bto, +7229548
    // Uses St.dim for dimmed text             // +7229136

    scheduleExit()                             // Gto, +7229554
    // clearTimeout on pending exit timer
    // process.exit(0) after drain             // +7229328
    // Falls back to process.kill(SIGKILL)     // +7229378 if exit stalls

    // Race: allow up to 3500 ms for UI drain  // +7231767
    await Promise.race([drainTimeout(3500), exitSignal])
    // Additional 2000 ms safety setTimeout    // +7231945
```

Analysis basis: CC v2.1.187 bundle.js:+7229468, +7231767

---

### Background-Session Guard (inline in `TSp`)

```
function isBackgroundSession(sessionStore):
    // Checks for session type flags: "bg", "daemon", "daemon-worker"
    // Values: +2309148, +2309158, +2309172
    return sessionStore.type in ["bg", "daemon", "daemon-worker"]
```

When this returns `true`, the UI renders the message (citation fragment): `"This background session shares credentials…"` (bundle.js:+8169902) and returns immediately without touching credentials or calling `process.exit`.

Analysis basis: CC v2.1.187 bundle.js:+8169902, +2309148

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_feature_ok` | Emitted on successful feature path (bundle.js:+1025122) |
| Telemetry — `tengu_feature_sad` | Emitted on non-fatal feature degradation (bundle.js:+1025270) |
| Telemetry — `tengu_feature_bad` | Emitted on hard feature failure (bundle.js:+1025189) |
| Telemetry — `tengu_config_lock_contention` | Emitted when config file lock is contested during credential wipe (bundle.js:+13750291) |
| Telemetry — `tengu_config_stale_write` | Emitted when a stale config write is detected (bundle.js:+13750427) |
| Telemetry — `tengu_config_parse_error` | Emitted if config JSON cannot be parsed during save (bundle.js:+13752866) |
| Telemetry — `tengu_config_auth_loss_prevented` | Emitted when the auth-loss guard refuses a write (bundle.js:+13750770) |
| Telemetry — `tengu_config_fallback_write` | Emitted when config is written via fallback path (bundle.js:+13749907) |
| Telemetry — `tengu_daemon_config_reload` | Emitted when daemon detects config change during exit (bundle.js:+17212183) |
| Telemetry — `tengu_scroll_summary` | Emitted during UI teardown scroll state (bundle.js:+7231176) |
| Telemetry — `tengu_pewter_brook` | Emitted during terminal fullscreen mode detection (bundle.js:+3556371) |
| Telemetry — `tengu_cache_eviction_hint` | Emitted during session-level cache eviction on exit (bundle.js:+7232119) |
| OAuth token revocation | HTTP POST to revocation endpoint with `refresh_token`; timeout 5000 ms |
| Secure storage | Credentials deleted from OS keychain (primary) or plaintext fallback |
| Config file (`~/.claude.json`) | Auth fields removed atomically with lock and backup rotation (5 backups kept) |
| Process lifecycle | `process.exit(0)` called after UI drain; `SIGKILL` fallback if drain exceeds threshold |
| Event listeners | `exit` and `beforeExit` process listeners removed; intervals/timers cleared |
| MCP connections | All MCP client connections stopped and socket files unlinked |
| Session store | In-memory session state cleared via `Ws` / `nUe` |

---

## Version History

| Version | Change |
|---|---|
| v2.1.187 | Initial analysis |

---

## Common Mistakes

1. **Running `/logout` from a background/daemon session**: The command detects background sessions (`"bg"`, `"daemon"`, `"daemon-worker"`) and explicitly no-ops, displaying a message that credentials are shared. The user must run `/logout` from the main interactive terminal session.
2. **Expecting an immediate credential wipe on HTTP failure**: Token revocation errors (network, auth, timeout) are classified and logged but are non-fatal. The credential-clearing and `process.exit` sequence still runs after a failed HTTP revocation call.
3. **Re-opening Claude Code immediately after `/logout`**: The process terminates via `process.exit` (with a `SIGKILL` fallback after ~3500 ms drain). Any unsaved in-memory state is discarded; no graceful save of conversation history occurs during logout.
4. **Assuming keychain is always used**: The credential writer (`TWs`) falls back to plaintext storage if OS keychain operations fail, and emits the `"plaintext_fallback_used"` telemetry marker. The logout path targets whichever store holds the credentials.
5. **Ignoring the auth-loss guard in custom tooling**: Any external tool that patches `~/.claude.json` concurrently with `/logout` risks triggering the stale-write guard (`tengu_config_auth_loss_prevented`), which refuses to overwrite the file to prevent credential loss.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `TSp` | Main logout command handler (`AsyncFunction`; Arbor-resolved entry point) |
| `ISp` | Inner JSX render sub-component for logout UI (renders "Signing out…" / success) |
| `lct` | Core logout orchestrator (sequences revocation, state clear, config write, exit) |
| `r` | Credential deletion dispatcher (calls `Is` to read then wipe stored credentials) |
| `Is` | Secure-storage credential reader/deleter (reads `data` field, delegates write) |
| `aqe` | Error reporter for credential deletion failures (`console.error` + `St.red`) |
| `oT` | Config file writer called after credential clearing (`Ore.writeFileSync`) |
| `Ws` | Session store accessor (reads session type to detect background sessions) |
| `nUe` | Session store clearing helper (clears in-memory session data) |
| `lBt` | Daemon / process state teardown coordinator |
| `zDn` | Known daemon connection map clear |
| `qQ` | Query queue reset |
| `Eme` | Event emitter clear (`Mai.clear`) |
| `OIe` | Open-interval registry clear |
| `jse` | Process listener removal and interval/timer shutdown |
| `V9` | Process listener deregistration helper |
| `q9` | Inner process-event list builder |
| `net` | Bulk cleanup: removes process events, clears interval/timeout sets |
| `gBr` | `clearInterval` + `process.removeListener` wrapper |
| `ke` | Logging/error queue manager (pushes error records, calls `jJ.logError`) |
| `fo` | Error formatter (wraps native `Error`, stringifies) |
| `nt` | String coercion utility |
| `Vi` | Traffic-classification helper (`"essential-traffic"`) |
| `Qru` | Circular error-log buffer manager (`Crn.shift` / `Crn.push`) |
| `qHa` | Socket file removal helper (`bat.unlink`) |
| `zHa` | Socket path resolver |
| `r$t` | Socket base-path builder (`bas`) |
| `bas` | Base socket directory constant |
| `Gpe` | Path join utility |
| `Ron` | Path join + `or` error-handler wrapper |
| `Cao` | MCP connection teardown coordinator |
| `EOo` | MCP pending-timer canceller (`clearTimeout`) |
| `AOo` | MCP auxiliary clear helper |
| `Bme` | MCP state filter (`n.some`, `t.includes`, `qQ`) |
| `QIe` | MCP socket file unlink helper (`tSi.join`, `or`) |
| `Ir` | Auth-type identifier used in credential routing (`nt` string coercion) |
| `Gl` | Credential storage layer entry point (routes to `TWs`) |
| `TWs` | Secure-storage read/write dispatcher (primary keychain + plaintext fallback) |
| `lUe` | Storage async-read coordinator (`d9u`) |
| `d9u` | AsyncLocalStorage context builder for storage operations |
| `Le` | Telemetry emission wrapper (`tengu_feature_ok` / `tengu_feature_bad`) |
| `W` | Generic telemetry event builder |
| `Pe` | Telemetry event publisher (`rKe`) |
| `Mt` | Telemetry sad-path emitter (`tengu_feature_sad`) |
| `Re` | Telemetry bad-path emitter (`tengu_feature_bad`) |
| `IO` | OAuth token revocation HTTP caller (`ho.post`) |
| `Ls` | OAuth endpoint URL builder (selects prod/staging/local, validates custom URLs) |
| `kXo` | OAuth base URL selector |
| `dGc` | OAuth URL path builder |
| `T` | General log/output formatter (debug level, redaction, file write) |
| `Xwc` | Log-level router |
| `I6o` | Terminal colour code applicator |
| `Me` | `JSON.stringify` wrapper |
| `wc` | Log-line builder (redacts tokens with `"[REDACTED]"`) |
| `c8o` | Redaction map builder |
| `dze` | Stdout write dispatcher (`JWo`) |
| `JWo` | Raw `e.write` to stdout |
| `eLc` | Rotating-log-file writer (manages file size, rotation, mkdir) |
| `FKe` | Buffered log-line aggregator (uses `setTimeout`/`setImmediate`) |
| `dpe` | Log file path builder (`hze`, `upe.join`) |
| `Wt` | File-existence check helper |
| `Mre` | EISDIR error handler |
| `p8o` | Log subdirectory path builder |
| `Ocr` | Log-file rotation executor (`RN.stat`, `RN.rename`, `RN.unlink`) |
| `Zwc` | Log-file append writer (`RN.mkdir`, `RN.appendFile`) |
| `Ei` | Log drain registration (`b6o.register`) |
| `gJ` | Supplemental log/trace helper |
| `CFr` | Config persistence orchestrator (calls `Kai` + `hn`) |
| `Kai` | Config path resolver + writer entry |
| `MFs` | Per-user config path builder (`CO`, `NC`, `ZM`) |
| `CO` | Path normaliser + SHA-256 hasher for config key (`NFC`, `sha256`, `hex`) |
| `NC` | Config namespace resolver (`N1e`) |
| `ZM` | Username resolver (`Zdn.userInfo`, `"claude-code-user"`) |
| `be` | String-coerce helper (`String()`) |
| `hn` | Global config save-with-lock entry (`GQn`) |
| `GQn` | Atomic config file writer with lock, re-read guard, and backup rotation |
| `_Ws` | Lock-state initialiser (`jRr`, `Object.assign`) |
| `cn` | Config JSON serialiser |
| `_Ee` | Config file reader with parse + backup logic |
| `MHt` | Config merge helper |
| `NOo` | Backup directory path builder (`IS.join`) |
| `oIt` | Atomic file-write helper (temp file + rename, `fchmodSync`, `fsyncSync`) |
| `ADe` | Config access guard (throws if config accessed before allowed) |
| `DOo` | Config object entries iterator |
| `MKt` | Timestamp helper (`Date.now`) |
| `BQn` | Fallback config save path (saves to alternate path if lock fails) |
| `nmn` | Config notification messenger |
| `o` | MCP/options state reader (`s.map`, `i.padEnd`) |
| `YPe` | Supplemental state delete helper |
| `W2e` | Auth context wrapper (`US`, `Su`) |
| `US` | Auth-context `be` wrapper |
| `Su` | Auth-session builder (`G2e`, OTEL attribute assignment) |
| `G2e` | OTEL attribute map builder (user, org, session, version, entrypoint) |
| `yW` | Session credential hydrator (`hn`, random bytes for session ID) |
| `kt` | Key-value lookup helper (`VL`) |
| `GCn` | Identity source descriptor (`gateway-oidc`, `user.id`, `user.email`) |
| `qDt` | `nt`-based string formatter |
| `J$` | Feature-flag set membership check (`stu.has`) |
| `hc` | Auth-context decorator (`ay`, `Dt`) |
| `OCd` | Base64url JWT payload decoder (`JSON.parse`, `Buffer.from`, `"base64url"`) |
| `yNi` | JWT field extractor (`MCd`, `xCd`) |
| `$Et` | Auth header builder |
| `xir` | OTEL event attribute builder |
| `a` | MCP manager event dispatcher (`a9e`, `brr`, `hla`) |
| `a9e` | MCP server connection orchestrator |
| `brr` | MCP connection result applier (`e.applyMcpUpdate`, `n.cleanup`) |
| `hla` | MCP hook caller (`tQr`) |
| `l` | MCP client list iterator (`JNl`) |
| `uBo` | MCP server-state updater and retry coordinator |
| `Mir` | OTEL metric emitter for auth events |
| `Ic` | UI lifecycle manager (orchestrates unmount, footer print, exit scheduling) |
| `gi` | Full CLI exit sequence (drain, timeout race, `process.exit`, `SIGKILL` fallback) |
| `U9e` | Ink/React UI unmount helper (`fHe.writeSync`, `e.unmount`, `yTn`) |
| `OU` | UI output stream reference |
| `yTn` | Terminal escape sequence writer (`RZ.writeSync`, ANSI save/restore cursor) |
| `Bto` | Exit footer printer (dimmed text via `St.dim`, `fHe.writeSync`) |
| `cw` | Terminal column width resolver |
| `B3` | Terminal row-count resolver |
| `XFt` | Workspace path stat checker |
| `ph` | Terminal renderer reference (`Rc`) |
| `vga` | Footer content formatter |
| `Gto` | Process exit scheduler (`clearTimeout`, `process.exit`, `process.kill(SIGKILL)`) |
| `$Ke` | Log drain awaiter (`b6o.drain`) |
| `d` | File-watcher / supervisor manager (starts/stops watchers on exit) |
| `Z8e` | File stat and read helper (`p$l.stat`, `i.isFile`, `vxo`) |
| `f$l` | File-content width calculator |
| `E` | Watcher entry (`.stop`, `.updateConfig`, `.start`) |
| `OEc` | Supervisor heartbeat handler (`Xse`) |
| `$ga` | Parallel MCP cleanup (`Promise.allSettled`, `Array.from`) |
| `QSt` | Startup profiling writer (`Xcr`, `w8o`) |
| `Xcr` | Profiling data formatter (`M8o`, `W`) |
| `w8o` | Profiling file writer (`JSON.stringify`, `M8o`) |
| `oPn` | Scroll-summary emitter (`Cga`, `Iga`) |
| `Cga` | Scroll-state snapshot builder |
| `Iga` | Scroll-metric calculator (`Date.now`, `Math.round`, `Object.assign`) |
| `bs` | Terminal-mode resolver (fullscreen vs default, tmux/SSH detection) |
| `oEt` | Exit-state finaliser |
| `Ve` | React renderer reference (`rKe`) |
| `rKe` | Root React/Ink renderer |
| `Rr` | Non-conforming renderer wrapper (`Ng`, `Ve`) |
| `Ng` | Non-conforming render helper (`rKe`) |
| `$9e` | Deferred exit promise (`ePn`) |
| `ePn` | Exit promise resolver |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.