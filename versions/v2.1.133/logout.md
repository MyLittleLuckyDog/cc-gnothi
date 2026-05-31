---
type: feature-spec
feature: "logout"
cc_version: "2.1.133"
updated: "2026-05-31"
tags: ["logout", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.133 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/logout`

> Analysis basis: CC v2.1.133 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.133

---

## Overview

The `/logout` command signs the user out of their Anthropic account by clearing stored OAuth credentials, cleaning up credential-related state, and terminating the current session. It is a `local-jsx` command that renders a JSX confirmation element and, after a short delay, triggers a full session teardown. In background (daemon/worker) sessions the command is a no-op: it prints an informational message and exits without modifying any credentials.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `logout` |
| description | `Sign out from your Anthropic account` |
| module_id | `HJ9` |
| load_inline | `true` |
| loc_byte (open) | `10400556` |
| loc_byte_end (close) | `10400744` |
| loc_line | `6233` |
| arbor_handler.name | `iG4` |
| arbor_handler.fqn | `claude-2.1.133::iG4` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |
| `loc_byte_end` | `10400744` |

Analysis basis: CC v2.1.133 bundle.js:+10400556

The registration block spans bytes `10400556`–`10400744`. The handler is resolved via `module_id` → `HJ9` → export `iG4`. Because `load_inline: true` is set, the module is loaded through an inline `Promise.resolve({call: …})` shape; no separate file path is involved.

---

## Input Branching

The command has three distinct execution paths depending on session context and credential type, so a flowchart is used.

```mermaid
flowchart TD
    A["/logout invoked"] --> B{Is this a background session?\n(daemon / daemon-worker / bg)}
    B -- Yes --> C["Print: 'This background session shares credentials…\nRun /logout from your main terminal to sign out.'"]
    C --> Z[Return — no credential changes]
    B -- No --> D["Detect credential / auth type"]
    D --> E{Auth type}
    E -- oauth --> F["Call session cleanup (logoutAndCleanupSession)\nClear OAuth tokens\nUnlink credential files\nClear in-memory caches"]
    E -- other/apikey --> G["Call general credential cleanup\nRemove stored credentials\nClear config auth fields"]
    F --> H["Render JSX success element\n'Successfully logged out…'"]
    G --> H
    H --> I["setTimeout ~200 ms delay"]
    I --> J["Call shutdownHandler (fL → Q1)\n→ graceful process exit / SIGKILL fallback"]
```

Analysis basis: CC v2.1.133 bundle.js:+7364289 (handler entry `iG4`), +7364422 (background-session guard string), +7364343 (oauth branch literal), +7364597 (success message string), +7364660 (setTimeout call)

---

## Behavioral Spec

### 1. Top-level handler (`iG4`)

The Arbor-resolved handler `iG4` is an `AsyncFunction` reached via `module_id` resolution.

```
async function logoutCommandHandler(context):

    // Step 1 — resolve error classifier
    errorClassifier = getErrorClassifier()          // E9 → hr

    // Step 2 — check for background session
    sessionKind = getSessionKind(context)           // i$6 background-mode detection
    if sessionKind in ["bg", "daemon", "daemon-worker"]:
        renderJSX(BackgroundSessionNotice,
            message: "This background session shares credentials…")
        return                                       // loc_byte:+7364422

    // Step 3 — determine credential type
    credType = readAuthType(context)                // literal "oauth" at loc_byte:+7364343
                                                    // literal "logout" at loc_byte:+7364312

    // Step 4 — perform credential removal
    if credType == "oauth":
        await oauthLogoutAndCleanup(context)        // i$6 → n$6 path
    else:
        await generalCredentialCleanup(context)     // i$6 → n$6 path

    // Step 5 — emit telemetry hook
    emitEvent("oauth_logout")                       // literal at loc_byte:+7364091

    // Step 6 — render success
    renderJSX(SuccessElement,
        message: "Successfully logged out from your Anthropic account.")
                                                    // literal at loc_byte:+7364597

    // Step 7 — delayed shutdown
    setTimeout(shutdownHandler, 200)                // loc_byte:+7364660
                                                    // literal 200 at loc_byte:+7364692
```

Analysis basis: CC v2.1.133 bundle.js:+7364289

---

### 2. Session cleanup orchestrator (`i$6`)

`i$6` is the logout execution core called from `iG4` for non-background sessions.

```
async function logoutExecutionCore(context):

    await Promise.resolve()                         // loc_byte:+7363537

    // Close active socket connections
    closeConnection_dwA()                           // dwA at loc_byte:+7363567
    closeConnectionPair(f, q)                       // f.close loc_byte:+14167103
                                                    // q.close loc_byte:+14167113
    // Unlink credential socket / pid file
    unlinkSync_Ydq()                                // Ydq.unlinkSync loc_byte:+14137065

    // Shut down background process registry
    backgroundProcessCleanup(_)                     // _ at loc_byte:+7363588

    // Clear auth error state
    clearAuthErrorState(E9)                         // E9 at loc_byte:+7363592

    // Run credential-type-specific logout steps
    await credentialTypeLogout(n$6)                 // n$6 at loc_byte:+7363604

    // Persist session stats / write config
    saveConfig(xHH)                                 // xHH at loc_byte:+7363666

    // Flush pending analytics
    flushAnalytics(Fa8)                             // Fa8 at loc_byte:+7363682

    // Reset credential store
    credentialStoreReset(dK)                        // dK at loc_byte:+7363688

    // Write global config
    writeGlobalConfig(e6)                           // e6 at loc_byte:+7363714

    // Emit "oauth_logout" hook event
    emitHookEvent("oauth_logout")                   // hH at loc_byte:+7364088
                                                    // literal at loc_byte:+7364091
```

Analysis basis: CC v2.1.133 bundle.js:+7363537

---

### 3. Credential-type logout dispatcher (`n$6`)

```
async function credentialTypeLogout():

    clearSubscriptionSwitchState(sM6)               // sM6 loc_byte:+7364148
    clearOAuthTokenCache(iF6)                       // iF6 loc_byte:+7364154

    // Clear in-memory auth L71 cache
    clearAuthL71Cache(sF6)                          // sF6 → L71.clear loc_byte:+2869498

    clearAuthFlags(v5H)                             // v5H loc_byte:+7364166

    // Tear down the OTEL / metrics pipeline
    teardownMetricsPipeline(A2H)                    // A2H loc_byte:+7364191
        // → Po (metrics publisher) loc_byte:+3092060
        // → AxH (interval/listener cleanup) loc_byte:+3092076
        //     clearInterval()              loc_byte:+3092855
        //     process.removeListener()     loc_byte:+3092890
        //     process.off()               loc_byte:+3092210
        //     clear b5H, pq6, Ut8, cU     loc_bytes:+3092329..+3092365
        // → HxH.emit()                    loc_byte:+3092082
        // → fH (log flush)                loc_byte:+3092121

    // Remove OAuth persistent token file
    deleteOAuthTokenFile(E49)                       // E49 loc_byte:+7364244
        // → xGH.unlink()                  loc_byte:+6574673

    // Remove lock / session files
    deleteLockFile(lwA)                             // lwA loc_byte:+7364256
        // → IJ6.unlink()                  loc_byte:+9784419
        // → clearTimeout()                loc_byte:+9779399
```

Analysis basis: CC v2.1.133 bundle.js:+7364148

---

### 4. Keychain / credential-store interaction (`dK` → `l41`)

```
function credentialStoreReset(store):
    // l41 wraps a dual-store (primary + fallback) credential backend
    store.H.read()           // primary read    loc_byte:+2864269
    store.A.read()           // fallback read   loc_byte:+2864318
    store.H.delete()         // primary delete  loc_byte:+2864609
    store.A.delete()         // fallback delete loc_byte:+2864506
    // Telemetry hooks fire on write path:
    //   "secure_storage_credentials_write"  loc_byte:+2864527
    //   "plaintext_fallback_used"           loc_byte:+2864665
    //   "primary_and_fallback_failed"       loc_byte:+2864768
```

Credential deletion targets the `claude-code-user` keychain service (string literal `"claude-code-user"` at bundle.js:+1998359). Key derivation uses SHA-256 (`"sha256"` at +1998179, `"hex"` at +1998206, 8-byte slice at +1998225).

Analysis basis: CC v2.1.133 bundle.js:+2864269

---

### 5. Shutdown sequence (`fL` → `Q1`)

After the 200 ms delay (literal `200` at +7364692), the handler calls the shutdown routine `fL`, which orchestrates the graceful-exit pipeline `Q1`.

```
function shutdownHandler():
    // Flush terminal output
    writeSync(stdout)                               // UUH.writeSync loc_byte:+5053005
    // Unmount Ink/React tree
    inkInstance.unmount()                           // H.unmount loc_byte:+5050532
    // Write final output line
    writeOutputFinal(HfA)                           // loc_byte:+5051352
    // Schedule SIGKILL fallback after 5000 ms      // literal 5000 at loc_byte:+5052358
    //   (3500 ms soft deadline)                    // literal 3500 at loc_byte:+5052365
    // Wait for pending promises (Promise.race)     // loc_byte:+5052478
    // On clean exit → process.exit()              // AfA loc_byte:+5051132
    // On timeout   → process.kill(SIGKILL)        // AfA loc_byte:+5051157
                                                    // literal "SIGKILL" at +5051182
```

Analysis basis: CC v2.1.133 bundle.js:+5051272

---

### 6. Config write-protection guard

During `e6` (global config save), a safety check prevents wiping `~/.claude.json` if the re-read config is missing authentication data that the in-memory cache holds. Two separate guards exist:

- **`saveConfigWithLock` guard**: refuses write if re-read config lacks auth present in cache (literal message referencing GH #3117 at +3111600).
- **`saveGlobalConfig` fallback guard**: same logic for fallback path (literal at +3108482).

Lock contention threshold: 100 iterations (literal `100` at +3111178). Warning: `"Lock acquisition took longer than expected…"` at +3111184. Config backup retention: 5 copies (literal `5` at +3112203), backup file age window: 60000 ms (literal `60000` at +3111954).

Analysis basis: CC v2.1.133 bundle.js:+3111600, +3108482

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_config_lock_contention` | Fired when config lock takes too long (bundle.js:+3111273) |
| Telemetry — `tengu_config_stale_write` | Fired when a stale write is detected during config save (bundle.js:+3111409) |
| Telemetry — `tengu_config_parse_error` | Fired on JSON parse failure reading `~/.claude.json` (bundle.js:+3113854) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when the GH #3117 write-protection guard triggers (bundle.js:+3111752) |
| Telemetry — `tengu_feature_ok` | Fired on successful credential-store operation (bundle.js:+907381) |
| Telemetry — `tengu_feature_sad` | Fired on non-fatal credential-store failure (bundle.js:+907507) |
| Telemetry — `tengu_feature_bad` | Fired on fatal credential-store failure (bundle.js:+907437) |
| Telemetry — `tengu_daemon_config_reload` | Fired when daemon reloads config after logout (bundle.js:+14170592) |
| Telemetry — `tengu_startup_perf` | Fired during startup profiling flush on exit (bundle.js:+171233) |
| Telemetry — `tengu_scroll_summary` | Fired during scroll state serialisation on exit (bundle.js:+5051913) |
| Telemetry — `tengu_pewter_brook` | Fired during terminal/fullscreen teardown (bundle.js:+3195249) |
| Telemetry — `tengu_cache_eviction_hint` | Fired on cache cleanup at session end (bundle.js:+5052694) |
| Hook event | `"oauth_logout"` emitted via event bus (`hH`) at bundle.js:+7364091 |
| Hook event | `"subscription-switch"` state cleared (literal at +7363936) |
| Credential store | Primary and fallback keychain entries deleted under service `"claude-code-user"` |
| In-memory caches | `L71`, `b5H`, `pq6`, `Ut8`, `cU` all `.clear()`-ed |
| File deletions | OAuth token file (`xGH.unlink`), lock/session file (`IJ6.unlink`), credential socket/pid file (`Ydq.unlinkSync`) |
| Config file | `~/.claude.json` auth fields cleared; write guarded by re-read check (GH #3117) |
| OTEL pipeline | `clearInterval`, `process.removeListener`, `process.off` called; metric Sets cleared |
| Process lifecycle | `process.exit()` called after graceful drain; SIGKILL sent as fallback after 5000 ms |
| Background session guard | No credential changes; informational JSX message rendered only |
| appState changes | Auth type cleared; subscription-switch state reset; session marked `"session_end"` (literal at +5052729) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.133 | Initial analysis |

---

## Common Mistakes

1. **Running `/logout` inside a background terminal session** — The command detects `"bg"`, `"daemon"`, or `"daemon-worker"` session kinds and exits immediately with an informational message. Credentials are **not** removed. Users must run `/logout` from the primary (foreground) terminal.

2. **Expecting an instant prompt return** — The handler inserts a `setTimeout` of 200 ms before calling the shutdown routine, followed by a graceful-drain phase up to 5000 ms and a SIGKILL fallback. The terminal will close; `/logout` is not a toggleable state.

3. **Manually editing `~/.claude.json` to remove auth** — The GH #3117 write-protection guard checks that the in-memory cache and the on-disk file agree. If they disagree, the save is refused and `tengu_config_auth_loss_prevented` fires. Partial manual edits can block the automatic write.

4. **Assuming API-key authentication is handled identically to OAuth** — The credential-type dispatcher (`n$6`) takes a separate code path for `"oauth"` vs. other auth types. Keychain entries and file deletions differ between paths.

5. **Expecting the credential store to be cleared synchronously** — Deletion of the primary and fallback keychain entries, the OAuth token file, and the lock file all occur as part of the async teardown chain inside `i$6`; they are not instantaneous.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `iG4` | Top-level logout command handler (AsyncFunction; Arbor-resolved via module_id `HJ9`) |
| `i$6` | Logout execution core — orchestrates credential removal and teardown |
| `n$6` | Credential-type logout dispatcher — clears caches, token files, OTEL pipeline |
| `sM6` | Subscription-switch state clearer |
| `iF6` | OAuth token in-memory cache clearer |
| `sF6` | Auth `L71` map clearer |
| `v5H` | Auth flags clearer |
| `A2H` | OTEL / metrics pipeline teardown |
| `Po` | Metrics publisher |
| `kH` | String utility / key formatter |
| `jo` | Metrics export helper |
| `AxH` | Interval and process-listener cleanup |
| `nt8` | `clearInterval` + `process.removeListener` wrapper |
| `fH` | Log flush / error logger |
| `HA` | Error constructor wrapper |
| `yq` | Essential-traffic log helper |
| `NJL` | Log queue shift/push manager |
| `E49` | OAuth token file deletion helper |
| `Z49` | Token file path resolver |
| `kOA` | Token file format helper |
| `_q_` | Token path sub-helper |
| `V6H` | File path utility |
| `RH6` | Path join + node helper |
| `lwA` | Lock / session file deletion helper |
| `NVA` | Lock file cleanup with `clearTimeout` |
| `SVA` | Lock file sub-helper |
| `dM8` | Session file path builder |
| `xHH` | Session stats / config flush |
| `Fa8` | Analytics flush helper |
| `J71` | Analytics shutdown sub-routine |
| `Tu_` | User-info / hash derivation |
| `Wk` | SHA-256 key derivation helper |
| `RP` | Analytics batch sender |
| `RV` | OS user-info reader |
| `e6` | Global config writer (saveGlobalConfig) |
| `fe8` | Config file write with locking (saveConfigWithLock) |
| `F6` | Filesystem existence check |
| `ql_` | Config object merge helper |
| `k` | Log-level / config-level formatter |
| `d` | Debug logger |
| `w8` | Warning logger |
| `m5H` | Config file reader with backup logic |
| `lq6` | Config cache accessor |
| `SH` | JSON stringify helper |
| `Me8` | Backup file path builder |
| `KhH` | Atomic file writer (temp + rename) |
| `fxH` | Config change event emitter |
| `jX1` | Config entries iterator |
| `MxH` | Config timestamp updater |
| `Ke8` | Config key-value setter helper |
| `Wa8` | Analytics sub-helper |
| `dK` | Credential store reset entry point |
| `l41` | Dual-store credential backend (primary + fallback) |
| `hH` | Hook event emitter (ok path) |
| `Z8` | Hook event emitter (bad path) |
| `uH` | Hook event emitter (sad path) |
| `PpH` | Telemetry attribute builder |
| `KV` | Attribute key formatter |
| `vH` | String coercion helper |
| `I4` | OTEL metric event emitter |
| `bW8` | OTEL instrument lookup |
| `jpH` | OTEL span / metric recorder |
| `pU` | Random-bytes session ID generator |
| `v6` | Version string accessor |
| `nLA` | Key-hash helper for OTEL |
| `F7` | OTEL export helper |
| `wp1` | OTEL gauge/counter helpers |
| `haH` | OTEL attribute set builder |
| `fL` | Shutdown handler entry point |
| `Q1` | Graceful-exit pipeline |
| `L` | Column pad utility |
| `FUH` | Terminal unmount + stdout flush |
| `Fk` | Ink render cleanup |
| `wl6` | ANSI cursor-save/restore writer |
| `HfA` | Final output line writer |
| `nT` | Ink stdout reference |
| `Sh` | Ink stderr reference |
| `Rf6` | Git repo path resolver |
| `y$` | Version comparison helper |
| `Go1` | Output formatter |
| `AfA` | Process exit / SIGKILL dispatcher |
| `mNH` | Promise.all wrapper |
| `D` | Supervisor config watcher |
| `eDH` | Config file reader for supervisor |
| `bwq` | Config diff calculator |
| `E` | Remote-control event handler |
| `Bdq` | Heartbeat sender |
| `CsH` | Telemetry flush writer |
| `PiA` | Startup perf reporter |
| `jiA` | Perf path builder |
| `_E` | Atomic fsync writer |
| `DiA` | Perf checkpoint formatter |
| `kt6` | Scroll summary emitter |
| `Wo1` | Scroll state accessor |
| `Po1` | Scroll metrics calculator |
| `s_` | Terminal / fullscreen teardown |
| `DaH` | Session-end helper |
| `$` | Transcript writer |
| `XDq` | Transcript file flusher |
| `O` | Background-session state marker |
| `d8` | Background-session stop helper |
| `r8` | Abort-signal / timeout wrapper |
| `E9` | Error classifier / auth-error state accessor |
| `hr` | Error classification helper |
| `_` | Background process registry |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.