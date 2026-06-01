---
type: feature-spec
feature: "logout"
cc_version: "2.1.142"
updated: "2026-06-01"
tags: ["logout", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.142 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/logout`

> Analysis basis: CC v2.1.142 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.142

---

## Overview

The `/logout` command signs the current user out of their Anthropic account by invalidating local OAuth credentials, clearing in-memory auth state, removing credential files, and terminating the CLI session. It is a `local-jsx` command that renders a React element for its confirmation UI, then triggers a multi-stage cleanup sequence before exiting the process. Background (daemon/daemon-worker) sessions detect shared credential state and refuse to perform logout, displaying an informational message instead.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `logout` |
| description | Sign out from your Anthropic account |
| loc_byte | `10637575` |
| loc_byte_end | `10637763` |
| loc_line | `6313` |
| module_id | `pE1` |
| load_inline | `true` |
| arbor_handler.name | `wb4` |
| arbor_handler.fqn | `claude-2.1.142::wb4` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.142 bundle.js:+10637575

---

## Input Branching

Four distinct branches exist: background-session guard, credential-type check (OAuth vs. other), session-type check (main terminal vs. shared), and normal logout flow with final exit. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/logout invoked"]) --> B{Is current session\na background session?\n(bg / daemon / daemon-worker)}
    B -- Yes --> C["Display: shared-credentials warning\n(no logout performed)"]
    C --> Z([Return — no state change])
    B -- No --> D{Auth type\n= 'oauth'?}
    D -- No --> E["Display: not-OAuth notice\n(command is a no-op)"]
    E --> Z
    D -- Yes --> F["Call signOutUser\n(logoutHandler / wb4)"]
    F --> G["Emit tengu event: oauth_logout\nvia subscription-switch path"]
    G --> H["clearSessionState (SD6)\n— clear caches, clear MCP state,\n  remove credential files via unlink,\n  clear config locks"]
    H --> I["clearCredentialStore\n— remove keychain / secure-storage entry\n  (unlinkSync on credential file)"]
    I --> J["clearDaemonConnections (O0H)\n— emit drain event, reset queues,\n  remove process listeners"]
    J --> K["Render JSX confirmation element\n'Successfully logged out …'"]
    K --> L["setTimeout 200 ms\nthen call processExitHandler (OK)"]
    L --> M["processExitHandler:\n  unmount Ink UI,\n  flush stdout,\n  wait up to max(5000,3500) ms\n  for pending I/O,\n  then process.exit / process.kill SIGKILL"]
    M --> Z2([Process terminated])
```

Analysis basis: CC v2.1.142 bundle.js:+7525715 – +7526887

---

## Behavioral Spec

### 1. Background-Session Guard

Before performing any logout action, the handler (`wb4`) reads the current session mode via the session-type accessor (`v1`). If the session mode string resolves to `"bg"`, `"daemon"`, or `"daemon-worker"` (literals at bundle.js:+2165871, +2165881, +2165895), the handler immediately renders a JSX element containing the literal message:

> `"This background session shares credentials with other sessions; /logout here has no effect. Run /logout from your main terminal to sign out."` (bundle.js:+7526593)

No credential or state mutation occurs; the function returns after rendering this element.

Analysis basis: CC v2.1.142 bundle.js:+7526483 – +7526591

```
function logoutHandler(context):
    sessionMode = getSessionMode()          // v1 → mB
    if sessionMode in ["bg", "daemon", "daemon-worker"]:
        render(backgroundWarningMessage)
        return
    proceed to credential-type check
```

### 2. Credential-Type Check

The handler then inspects the current auth configuration via the config reader (`QFH`). Only credentials of type `"oauth"` (literal at bundle.js:+7526537) proceed to the full logout sequence. If the auth type is anything other than `"oauth"`, a no-op path is taken and an informational message is rendered.

Analysis basis: CC v2.1.142 bundle.js:+7526494 – +7526556

```
function checkAuthType(config):
    authType = config.type                  // via QFH → JE, YL
    if authType != "oauth":
        render(notOAuthNotice)
        return
    proceed to signOut
```

### 3. OAuth Logout Sequence (`signOutUser` / `RD6`)

When the guard and type checks pass, the handler delegates to the core sign-out function (`RD6`). The sequence is:

1. **Emit telemetry marker** — fires an internal event tagged `"oauth_logout"` (bundle.js:+7526284) and `"subscription-switch"` (bundle.js:+7526129).
2. **Clear session state** (`SD6`) — calls the following sub-steps in order:
   - `uz6` — clears MCP server registry.
   - `Ml6` — clears project-level caches.
   - `Ol6` — calls `JY9.clear` to wipe the in-memory conversation/history store (bundle.js:+2902115).
   - `xMH` — resets the tool-call registry.
   - `O0H` — tears down daemon/WebSocket connections (see §3a below).
   - `rY1` — removes the OAuth token file via `jZH.unlink` (bundle.js:+6734804) and clears path-derived state (`aY1`, `LP_` → `JDA`, `K96`).
   - `Z0_` — clears the session-level socket/lock file via `z26.unlink` (bundle.js:+9994291) and resolves the lock path via `KD8`.
3. **Remove secure credential store entry** — calls the file-store cleaner (`q` → `g6K.unlinkSync`, bundle.js:+14442182) using the keychain identifier `"claude-code-user"` (bundle.js:+2036433). On failure it logs `"Failed to delete keychain entry"` (bundle.js:+2037144).
4. **Perform background process cleanup** (`v8_`) — triggers the log/session file rotation logic (`IY9` → `NdA`, `t6` → `oA_`).
5. **Flush pending reads** (`oK` → `zeA`) — drains in-flight async read/write operations, resolves or rejects the associated promises via `Promise.all` (bundle.js:+2194596).

Analysis basis: CC v2.1.142 bundle.js:+7525715 – +7525907

```
async function signOutUser():
    emitEvent("oauth_logout")
    await clearSessionState()               // SD6
        clearMcpRegistry()                  // uz6
        clearProjectCache()                 // Ml6
        clearConversationHistory()          // Ol6 → JY9.clear
        clearToolRegistry()                 // xMH
        tearDownConnections()              // O0H
        removeTokenFile()                  // rY1 → jZH.unlink
        removeSocketLock()                 // Z0_ → z26.unlink
    removeSecureCredential("claude-code-user")   // q → unlinkSync
    cleanupBackgroundProcessFiles()        // v8_ → IY9, t6
    drainPendingIO()                       // oK → zeA → Promise.all
```

#### 3a. Connection Teardown (`O0H`)

The daemon-connection cleanup function:
1. Calls the Axios/HTTP client shutdown (`ws` → `bH`, `Ds`).
2. Calls the consolidated connection-manager cleanup (`cmH`):
   - `xA_` — calls `clearInterval` and `process.removeListener` (bundle.js:+3133924, +3133959).
   - `process.off` — removes the `"exit"` listener (bundle.js:+3133325) and `"beforeExit"` listener (bundle.js:+3133982).
   - Clears five internal Maps/Sets: `gMH`, `wi6`, `T76`, `vA_`, `MF` (bundle.js:+3133386 – +3133434).
3. Emits a drain event via `dmH.emit` (bundle.js:+3133139).
4. Calls the queue logger (`NH`) to flush error queues.

Analysis basis: CC v2.1.142 bundle.js:+3133117 – +3133181

### 4. Confirmation Render and Delayed Exit

After the cleanup chain resolves, `wb4` calls `T0_.createElement` (bundle.js:+7526767) to render the success message:

> `"Successfully logged out from your Anthropic account."` (bundle.js:+7526792)

The message is tagged as role `"system"` (bundle.js:+7526745).

A `setTimeout` of **200 ms** (literal at bundle.js:+7526887 value `200`) is then set. When it fires, the process-exit handler (`OK`) is invoked.

Analysis basis: CC v2.1.142 bundle.js:+7526767 – +7526887

```
function scheduleExit():
    render(createElement("system", successMessage))
    setTimeout(200, () => processExitHandler())
```

### 5. Process Exit Handler (`OK` / `R9`)

The exit handler orchestrates a graceful shutdown:

1. Unmounts the Ink UI (`SEH` → `H.unmount`, bundle.js:+5211954), flushes stdout (`QOH.writeSync`, bundle.js:+5211877).
2. Waits for all pending render/write futures via `Promise.race` (bundle.js:+5214159) with a composite timeout: `Math.max(5000, 3500)` ms (literals at bundle.js:+5214039, +5214046).
3. If the race resolves normally, emits telemetry event `"session_end"` (bundle.js:+5214410) then calls `process.exit`.
4. If the timeout wins, calls `process.kill(process.pid, "SIGKILL")` (bundle.js:+5212604) after logging `"unreachable"` (bundle.js:+5212627).
5. A `dOH.unref()` call (bundle.js:+5214055) prevents the timer from blocking the event loop if normal exit is faster.

Analysis basis: CC v2.1.142 bundle.js:+5212694 – +5214479

```
async function processExitHandler():
    flushStdout()                           // SEH → QOH.writeSync
    unmountUI()                             // SEH → H.unmount
    writeStartupPerfIfNeeded()             // VY_ → QOH.writeSync
    timeout = Math.max(5000, 3500)          // 5000 ms
    result = await Promise.race([
        waitForPendingIO(),                 // D_8
        sleep(timeout)
    ])
    emitTelemetry("session_end")
    if normalExit:
        process.exit(0)
    else:
        process.kill(process.pid, "SIGKILL")
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_config_lock_contention` | Fired when config write-lock is contested during credential cleanup (bundle.js:+3152558) |
| Telemetry — `tengu_config_stale_write` | Fired when a config re-read detects a stale write would overwrite auth (bundle.js:+3152694) |
| Telemetry — `tengu_config_parse_error` | Fired if the config JSON cannot be parsed during the cleanup read-back (bundle.js:+3155139) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a write is refused because the re-read config is missing auth that the cache still holds — GH #3117 guard (bundle.js:+3153037) |
| Telemetry — `tengu_feature_ok` / `tengu_feature_sad` / `tengu_feature_bad` | Feature-flag outcome events emitted by sub-feature checks during session teardown (bundle.js:+954550, +954683, +954608) |
| Telemetry — `tengu_daemon_config_reload` | Fired when the daemon re-loads its config as a side-effect of session reset (bundle.js:+14476508) |
| Telemetry — `tengu_startup_perf` | Startup profiling event flushed on exit if profiling was active (bundle.js:+210485) |
| Telemetry — `tengu_scroll_summary` | Scroll/render summary flushed as part of UI teardown (bundle.js:+5213342) |
| Telemetry — `tengu_pewter_brook` | Fullscreen/terminal mode telemetry emitted at session close (bundle.js:+3322057) |
| Telemetry — `tengu_cache_eviction_hint` | Cache eviction hint fired during session end (bundle.js:+5214375) |
| Secure-storage side-effect | `unlinkSync` called on the file path for keychain identifier `"claude-code-user"`; on error, logs `"Failed to delete keychain entry"` |
| Config file write guard | Refuses to overwrite `~/.claude.json` if re-read is missing auth the cache holds — see literals at bundle.js:+3152885 (GH #3117) and +3149767 |
| Config backup | Up to **5** backup copies kept (literal at bundle.js:+3153488), backup files prefixed `".backup."` (bundle.js:+3153355), backup directory named `"backups"` (bundle.js:+3154070); max lock-wait is **60 000 ms** (bundle.js:+3153239) |
| Process listeners removed | `"exit"` and `"beforeExit"` process event listeners are removed; `clearInterval` called for periodic tasks |
| Internal Maps/Sets cleared | `gMH`, `wi6`, `T76`, `vA_`, `MF`, `JY9`, `XS6`, `hRH` |
| Socket/lock file removed | `z26.unlink` removes session socket file (bundle.js:+9994291) |
| OAuth token file removed | `jZH.unlink` removes stored OAuth token file (bundle.js:+6734804) |
| Process exit | `process.exit` (normal) or `process.kill(pid, "SIGKILL")` (forced) after ≤ 5 000 ms |
| Sound | None detected in depth-2 traversal |
| Hook registration | None detected in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.142 | Initial analysis |

---

## Common Mistakes

1. **Running `/logout` from a background/daemon session** — The command silently no-ops and displays a warning. Authentication is shared with the main terminal session; logout must be executed from the interactive main terminal.
2. **Expecting `/logout` to work with API-key auth** — The full logout/credential-removal sequence only activates for `"oauth"` credential types. API-key authenticated sessions will see a no-op or minimal response.
3. **Assuming the process stays alive after `/logout`** — The command schedules a 200 ms delayed process exit. Any work expected after issuing `/logout` in a script or automation will not execute; the CLI process terminates unconditionally.
4. **Auth-loss protection refusing the write** — If the process is interrupted or crashes mid-logout, the GH #3117 guard may prevent `~/.claude.json` from being re-written without the auth block on the next startup. This is intentional data-loss prevention, not a bug.
5. **Keychain entry deletion failure is non-fatal** — If `unlinkSync` on the credential file fails (e.g., file already deleted), the error is logged but the logout sequence continues. Users may see a `"Failed to delete keychain entry"` log entry without the overall logout being aborted.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `wb4` | Main logout handler (`AsyncFunction`, Arbor-resolved via `module_id`) |
| `RD6` | Core sign-out orchestrator (OAuth credential removal, session teardown) |
| `SD6` | Session-state clearing function (caches, MCP registry, files) |
| `uz6` | MCP server registry clearer |
| `Ml6` | Project-level cache clearer |
| `Ol6` | Conversation/history store clearer (calls `JY9.clear`) |
| `xMH` | Tool-call registry resetter |
| `O0H` | Daemon/connection teardown coordinator |
| `ws` | HTTP client shutdown helper |
| `bH` | String coercion / encoding utility |
| `Ds` | HTTP client sub-utility (stream/response handler) |
| `cmH` | Consolidated connection-manager cleanup (clears Maps, removes listeners) |
| `xA_` | Interval and process-listener remover (`clearInterval`, `process.removeListener`) |
| `NH` | Queue logger / error-queue flusher |
| `k_` | Error constructor / string coercion helper |
| `$q` | Essential-traffic queue processor |
| `JvK` | Queue shift/push rotation helper |
| `rY1` | OAuth token file remover (`jZH.unlink`) |
| `aY1` | Auth path resolver sub-helper |
| `LP_` | Config-path lookup helper (calls `JDA`) |
| `JDA` | Path derivation helper |
| `k_H` | Path join helper |
| `K96` | Config path builder (`wDA.join`, `b8`) |
| `Z0_` | Session socket/lock file remover (`z26.unlink`) |
| `pR_` | Lock-file cleanup helper (calls `gR_`, `clearTimeout`) |
| `gR_` | Lock-file sub-cleaner |
| `KD8` | Lock path builder (`Z9q.join`, `b8`) |
| `Oo` | Additional session-state helper |
| `v8_` | Background-process file manager (log rotation) |
| `IY9` | Log/session file orchestrator |
| `NdA` | Config/home directory resolver |
| `uy` | SHA-256 hashing utility for path derivation |
| `ej` | Encoding helper |
| `zN` | OS user-info resolver (`IdA.userInfo`) |
| `v` | Telemetry/logging emit utility |
| `f7K` | Telemetry event builder |
| `H` | Random/timeout scheduling helper |
| `RH` | JSON stringifier wrapper |
| `H5` | String slicing/index utility |
| `BhH` | Telemetry attribute aggregator |
| `O7K` | Telemetry network-write helper |
| `GH` | String-cast utility |
| `t6` | Global config file manager (read/write with lock) |
| `oA_` | Config file save-with-lock implementation |
| `x6` | File existence / stat wrapper |
| `qeA` | Config object merger (`Object.assign`) |
| `d` | Structured telemetry data store |
| `O8` | Error-classification helper |
| `cMH` | Config JSON reader (handles backup, parse error) |
| `h76` | Config parse/validation helper |
| `aA_` | Backup path builder (`Qz.join`, `b8`) |
| `V` | File-watcher / path filter |
| `X` | MCP/SDK connection manager |
| `Z` | Terminal/render controller |
| `TA6` | Atomic file write helper (temp + rename) |
| `amH` | App-state initializer |
| `CE9` | Object-entries iterator for config |
| `smH` | Timestamp helper (`Date.now`) |
| `rA_` | Global config saver (calls `TA6`) |
| `q8_` | Secondary session-file manager |
| `oK` | In-flight async read/write drain |
| `zeA` | Read/write operation tracker (fulfills promises) |
| `bxH` | Async-storage lock helper |
| `NML` | Async-local-storage context manager |
| `SH` | Feature-flag OK reporter |
| `j8` | Feature-flag sad reporter |
| `uH` | Feature-flag bad reporter |
| `RjH` | Remaining session-resource cleaner |
| `QFH` | Auth config reader |
| `JE` | Auth type inspector |
| `YL` | OAuth session emitter / token builder |
| `rZ8` | Token refresh helper |
| `gFH` | OTEL metrics attribute builder |
| `hu` | Session ID / random-bytes generator |
| `V6` | Internal constant registry |
| `E3_` | Build-info string provider |
| `M5` | Metrics scope helper |
| `mr9` | Metrics label builder |
| `z68` | Identity/gateway attribute mapper |
| `MH6` | Workspace host-path builder |
| `OK` | Process-exit handler (outer wrapper) |
| `R9` | Core process-exit implementation (Promise.race, SIGKILL) |
| `K` | Column formatter (`padEnd`) |
| `SEH` | UI unmount + stdout flush helper |
| `sy` | Ink stream helper |
| `io6` | Low-level stdout write with ANSI save/restore |
| `VY_` | Startup profiling report flusher |
| `PV` | Profiling timer reference |
| `rS` | Render stats accumulator |
| `XO6` | Working-directory stat helper |
| `c3` | Config version checker |
| `FA1` | Profiling output formatter |
| `IY_` | Forced-exit helper (`process.exit`, `process.kill`) |
| `DhH` | Pending-promise collector (`Promise.all`, `Array.from`) |
| `Y` | Render supervisor / child-render manager |
| `$JH` | Render-cycle tracker |
| `FVq` | Column-width calculator (`Math.max`, `Object.keys`) |
| `T` | Input event handler (preventDefault, remoteControl) |
| `J8K` | Heartbeat scheduler |
| `X66` | Startup profiling record helper |
| `av8` | Profiling mark recorder |
| `V6A` | Profiling file writer |
| `Y_8` | Scroll/render summary builder |
| `BA1` | Scroll-state snapshot |
| `UA1` | Scroll metrics calculator (`Date.now`, `Math.max`, `Math.round`) |
| `lA` | Terminal/fullscreen mode resolver |
| `geH` | Cache-eviction hint emitter |
| `D_8` | Pending-IO race helper (`Promise.race`, `Promise.all`) |
| `a8` | Timeout-with-abort helper (`setTimeout`, `clearTimeout`) |
| `v1` | Session-mode accessor |
| `mB` | Session-mode string resolver |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.