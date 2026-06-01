---
type: feature-spec
feature: "logout"
cc_version: "2.1.149"
updated: "2026-06-01"
tags: ["logout", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.149 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/logout`

> Analysis basis: CC v2.1.149 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.149

---

## Overview

The `/logout` command signs the user out of their Anthropic account by revoking the active OAuth token, clearing stored credentials and in-memory session state, and then terminating the CLI process. When invoked from a background session (daemon or daemon-worker context), the command detects this condition and emits an informational message instead of performing any action, instructing the user to run `/logout` from a main terminal.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `logout` |
| description | Sign out from your Anthropic account |
| loc_byte | `11251042` |
| loc_byte_end | `11251230` |
| loc_line | `9091` |
| module_id | `gpq` |
| load_inline | `true` |
| arbor_handler.name | `q9L` |
| arbor_handler.fqn | `claude-2.1.149::q9L` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.149 bundle.js:+11251042

---

## Input Branching

The handler has four distinct execution paths depending on session context, token type, and network outcome.

```mermaid
flowchart TD
    A[/logout invoked] --> B{Background session?\nbg / daemon / daemon-worker}
    B -- Yes --> C[Emit: background-session warning message\nNo logout performed]
    B -- No --> D{Auth type}
    D -- oauth --> E[Call token-revocation endpoint\nPOST refresh_token\nContent-Type: application/json\ntimeout: 5000 ms]
    D -- other / non-oauth --> F[Skip token revocation\nProceed directly to credential wipe]
    E --> G{HTTP response}
    G -- Success --> H[Log oauth_token_revoke success]
    G -- Network error / Axios error --> I[Log network error\nContinue anyway]
    H --> J[Clear credentials & session state]
    I --> J
    F --> J
    J --> K[Emit: oauth_logout telemetry marker]
    K --> L[Write success message to output:\n'Successfully logged out from your Anthropic account.']
    L --> M[Terminate CLI process via exit handler]
```

Analysis basis: CC v2.1.149 bundle.js:+7588517 (handler entry `q9L`), +7588627 (background-session guard literal), +2046744 (refresh_token), +2046842 (5000 ms timeout), +7588826 (success message literal)

---

## Behavioral Spec

### Background-Session Guard

```
function checkBackgroundSession(sessionType):
    if sessionType in {"bg", "daemon", "daemon-worker"}:
        display("This background session shares credentials with " +
                "other sessions; /logout here has no effect. " +
                "Run /logout from your main terminal to sign out.")
        return ABORT
    return CONTINUE
```

When the process is running as a background/daemon worker (identified by process-type string literals `"bg"`, `"daemon"`, `"daemon-worker"`), the handler emits the advisory message and returns without performing any side effects.

Analysis basis: CC v2.1.149 bundle.js:+2189581, +2189591, +2189605, +7588627

---

### OAuth Token Revocation

```
async function revokeOAuthToken(authState):
    if authState.type != "oauth":
        return skipRevocation()

    response = await httpClient.post(oauthEndpoint, {
        body: { grant_type: "refresh_token", token: authState.refreshToken },
        headers: { "Content-Type": "application/json" },
        timeout: 5000
    })

    if isAxiosError(response):
        logError("network", response)
        // non-fatal: continue logout regardless
    else:
        log("oauth_token_revoke")
```

The revocation call uses the `"refresh_token"` grant parameter with a 5 000 ms timeout. Network failures are classified under the `"network"` error category and do not abort the logout flow.

Analysis basis: CC v2.1.149 bundle.js:+2046744, +2046799, +2046814, +2046842, +2046852, +2046976

---

### Credential and State Wipe

```
async function clearSessionState(configStore, credentialStore, socketStore):
    // 1. Close any open IPC sockets
    closeAllSockets(socketStore)         // A.close, q.close

    // 2. Remove on-disk credential file (unlinkSync)
    credentialStore.unlinkSync()         // SJK.unlinkSync

    // 3. Clear in-memory caches
    clearYE9Cache()                      // Ms6 → YE9.clear
    clearMOHState()                      // MOH
    clearETHListeners()                  // eTH: process.off, interval clear,
                                         //      YOH/De6/e36/FM_/lg caches

    // 4. Delete MCP-related lock / socket files
    unlinkMCPSocket()                    // MNH.unlink  (zZq path)
    unlinkPersistenceFile()              // kY6.unlink  (pJ_ path)

    // 5. Mark telemetry
    emit("oauth_logout")
```

The wipe sequence closes IPC sockets, removes on-disk credential artifacts, and clears every in-memory cache layer before emitting the `"oauth_logout"` marker.

Analysis basis: CC v2.1.149 bundle.js:+15272033, +15272043, +15239407, +2927171, +7588393, +3174363, +6688125, +4686101, +7588298

---

### Config Safety During Wipe

The config-write helpers (`saveConfigWithLock`, `saveGlobalConfig`) contain guards that refuse to overwrite `~/.claude.json` if the in-memory cache contains auth data that is absent from the freshly re-read file, preventing accidental credential loss.

Relevant literals observed in the call graph:

- `"saveConfigWithLock: re-read config is missing auth that cache has; refusing to write to avoid wiping ~/.claude.json. See GH #3117."` (bundle.js:+3194037)
- `"saveGlobalConfig fallback: re-read config is missing auth that cache has; refusing to write. See GH #3117."` (bundle.js:+3190919)

Telemetry event `tengu_config_auth_loss_prevented` is fired when this guard activates.

Analysis basis: CC v2.1.149 bundle.js:+3194037, +3190919, +3194189

---

### Process Termination

```
async function terminateProcess(exitHandler):
    // Write success confirmation to stdout
    writeSync("Successfully logged out from your Anthropic account.")

    // Schedule exit with a brief grace period for output flush
    setTimeout(() -> exitHandler.exit(0), 200)
```

After a short delay (literal `200`, bundle.js:+7588921), the process exits cleanly. The exit path flows through the shutdown helper (`IK` → `_q` → `a0_`), which unmounts the Ink render tree, drains the write buffer, and calls `process.exit`.

Analysis basis: CC v2.1.149 bundle.js:+7588826, +7588889, +7588921, +5284395

---

### Subscription-Switch Interaction

A literal `"subscription-switch"` (bundle.js:+7588143) appears in the handler's lexical scope alongside the `"oauth_logout"` marker, indicating that the logout path also handles the case where the user has switched subscription plans mid-session; the wipe procedure is applied uniformly in either case.

Analysis basis: CC v2.1.149 bundle.js:+7588143

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_feature_ok` | Fired on successful secure-storage write during credential operations (bundle.js:+963421) |
| Telemetry — `tengu_feature_sad` | Fired on non-fatal storage failure (bundle.js:+963556) |
| Telemetry — `tengu_feature_bad` | Fired on hard storage error (bundle.js:+963479) |
| Telemetry — `tengu_config_lock_contention` | Fired when config lock takes longer than expected (bundle.js:+3193710) |
| Telemetry — `tengu_config_stale_write` | Fired on a detected stale config write attempt (bundle.js:+3193846) |
| Telemetry — `tengu_config_parse_error` | Fired when config JSON cannot be parsed (bundle.js:+3196285) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when the auth-loss guard blocks a write (bundle.js:+3194189) |
| Telemetry — `tengu_startup_perf` | Fired by startup-profiling subsystem (bundle.js:+212856) |
| Telemetry — `tengu_scroll_summary` | Fired by scroll-summary subsystem reached during process teardown (bundle.js:+5285263) |
| Telemetry — `tengu_cache_eviction_hint` | Fired during session-end cache cleanup (bundle.js:+5286296) |
| Telemetry — `tengu_pewter_brook` | Fired by fullscreen/PTY environment probe (bundle.js:+3360499) |
| Telemetry — `tengu_daemon_config_reload` | Fired when daemon detects a config reload event (bundle.js:+15275522) |
| Credential file | Removed via `unlinkSync` on the credential store path |
| MCP socket file | Removed via `MNH.unlink` |
| Persistence lock file | Removed via `kY6.unlink` |
| In-memory caches | `YE9`, `YOH`, `De6`, `e36`, `FM_`, `lg` all cleared |
| IPC sockets | All open connections closed (`A.close`, `q.close`) |
| Process intervals | Cleared via `clearInterval` / `process.removeListener` in `nM_` |
| Process exit | `process.exit(0)` called after ~200 ms grace period |
| Config backup | Up to 5 rotating backups retained under `backups/` directory during any config write triggered by teardown (bundle.js:+3194640) |
| Sound | None observed |

---

## Version History

| Version | Change |
|---|---|
| v2.1.149 | Initial analysis |

---

## Common Mistakes

1. **Running `/logout` inside a background/daemon session** — The command detects the `"bg"`, `"daemon"`, or `"daemon-worker"` process type and does nothing. Always run `/logout` from the primary terminal session.
2. **Expecting the token to be invalidated server-side when offline** — The OAuth revocation request has a 5 000 ms timeout; if the network is unavailable, revocation is skipped silently and only local credentials are removed.
3. **Re-launching immediately after logout** — The process terminates approximately 200 ms after the success message is displayed. Any automation that inspects the credential file within that window may observe a partially-torn-down state.
4. **Assuming `/logout` is idempotent across concurrent sessions** — The credential-file unlink is a destructive filesystem operation. Concurrent Claude Code sessions reading from the same credential file will lose their auth context immediately.
5. **Ignoring the auth-loss guard in CI** — If a script reads `~/.claude.json` and invokes `/logout` simultaneously, the `saveConfigWithLock` guard (GH #3117) may fire `tengu_config_auth_loss_prevented` and refuse to write, leaving the config in an inconsistent state that requires manual cleanup.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `q9L` | Main logout handler (AsyncFunction; Arbor-resolved) |
| `DP6` | Logout setup / initialization helper |
| `YP6` | Session-state teardown orchestrator |
| `KJ6` | Sub-helper within session teardown |
| `Ls6` | Sub-helper within session teardown |
| `Ms6` | Cache-clear helper (calls `YE9.clear`) |
| `MOH` | In-memory state reset helper |
| `eTH` | Event-listener and interval cleanup helper |
| `we` | String/toLowerCase normalization utility |
| `mH` | String conversion utility |
| `Gb` | OS-detection helper |
| `qFH` | Process-listener and multi-cache clear helper |
| `nM_` | Interval/process-listener removal helper |
| `RH` | Error routing / retry queue helper |
| `c_` | Error construction helper |
| `G1` | Traffic-classification helper (`essential-traffic`) |
| `uiK` | Queue shift/push helper (`Hm6`) |
| `bq` | Background-session type classifier (`bg`/`daemon`/`daemon-worker`) |
| `f$H` | Background-session display helper |
| `zZq` | MCP socket file unlink helper |
| `DZq` | Sub-helper of MCP socket unlink |
| `jZ_` | Sub-helper of MCP socket unlink |
| `XZA` | Sub-helper of MCP socket unlink |
| `p9H` | Path utility used in MCP socket path resolution |
| `V46` | Path join helper for MCP socket |
| `pJ_` | Persistence-lock file unlink helper |
| `CJ_` | Sub-helper of persistence-lock unlink |
| `UJ_` | Sub-helper of persistence-lock unlink |
| `e98` | Path join helper for persistence lock |
| `RA` | Auth-type discriminator (`bedrock`/`foundry`/`anthropicAws`/`mantle`/`vertex`/`firstParty`) |
| `FK` | Secure-storage credential accessor |
| `$L9` | Secure-storage read/write/delete implementation |
| `H` | Primary secure-storage backend (system keychain) |
| `_` | Secondary/fallback credential store |
| `LGH` | Async read orchestrator for credential store |
| `Mk4` | Storage context / ALS store helper |
| `bH` | Credential serialization helper |
| `_8` | Credential deserialization helper |
| `uH` | Credential update helper |
| `K` | Padded-output / column-format utility |
| `OH_` | OAuth token-revocation HTTP caller |
| `h9` | OAuth endpoint URL builder |
| `jPA` | Sub-helper for OAuth URL construction |
| `InK` | Sub-helper for OAuth URL construction |
| `N` | HTTP request wrapper / logger |
| `MVK` | HTTP error classifier |
| `T7A` | Error code mapper (`fTK`, `$TK`) |
| `CH` | JSON.stringify wrapper |
| `X4` | URL redaction helper (replaces tokens with `[REDACTED]`) |
| `s5A` | Header-map helper |
| `HbH` | HTTP response writer |
| `B5A` | Low-level write helper |
| `OVK` | Append-file / log-rotation writer |
| `ICH` | Buffered-write / drain helper |
| `q9H` | Log path helper |
| `Q6` | Filesystem existence check |
| `G96` | Error-code classifier (`EISDIR`) |
| `LMA` | Log path join helper |
| `KMA` | Atomic file rename helper (`.txt` extension) |
| `$VK` | Append-file with directory creation |
| `a9` | Write-queue registration helper |
| `$s` | Miscellaneous state helper reached during teardown |
| `hL_` | Config-file write orchestrator |
| `TE9` | Config write wrapper |
| `y69` | Config path resolver (NFC normalize, sha256 hash) |
| `Qv` | Path normalizer + hash generator |
| `sX` | Sub-helper for path resolution |
| `PZ` | OS user-info resolver (`vc6.userInfo`) |
| `EH` | String coercion helper |
| `f8` | Global-config save helper |
| `$f_` | Config-with-lock save helper |
| `_L9` | Config object merger |
| `K8` | Generic error handler |
| `JOH` | Config file reader (with backup rotation) |
| `f$6` | Config field accessor |
| `Of_` | Backup-directory path builder |
| `V` | Config iteration variable (used in startsWith check) |
| `P` | Session/project orchestrator reached during teardown |
| `Z` | Renderer or display manager (start/stop/updateConfig) |
| `UK6` | Atomic file-write helper (temp file + rename, fchmod) |
| `OFH` | Object field enumerator |
| `ub9` | Object.entries iterator helper |
| `zFH` | Timestamp helper (`Date.now`) |
| `ff_` | Config directory initializer |
| `$__` | Miscellaneous config helper |
| `W2H` | Additional state helper reached during teardown |
| `LcH` | Pre-logout display / confirmation renderer |
| `ZW` | Display string coercion helper |
| `f4` | Event emitter / OTEL attribute builder |
| `CR8` | OTEL attribute helper |
| `SVH` | OTEL metrics / telemetry session builder |
| `$p` | Random-bytes session-ID generator |
| `S6` | Metrics sink helper (`Dv`) |
| `pP_` | Metrics padding helper |
| `R5` | Metrics flush helper |
| `dqq` | Metrics batch helpers (`tW7`, `sW7`) |
| `w18` | Identity/attribute freeze helper |
| `ZA6` | OTEL attribute assignment helper |
| `IK` | Process-exit orchestrator (calls `_q`) |
| `_q` | Core exit sequence (unmount → drain → race → exit) |
| `TvH` | Ink unmount + terminal-restore helper |
| `wS` | Terminal-state restore helper |
| `l68` | Low-level writeSync / terminal-escape helper |
| `o0_` | Pre-exit output flush helper |
| `jv` | Output-path helper |
| `jC` | Output-channel helper |
| `Aj6` | Working-directory stat helper |
| `gO` | Sub-helper for working-directory check |
| `e$q` | Exit summary formatter |
| `a0_` | Final process.exit / process.kill dispatcher |
| `kCH` | Write-queue drain helper |
| `Y` | Supervisor / renderer lifecycle manager |
| `tXH` | Renderer config-key enumerator |
| `kc1` | Column-width calculator |
| `G` | Keyboard-input stop helper |
| `AXK` | Heartbeat emitter |
| `u96` | Telemetry flush helper |
| `Cx8` | Telemetry batch sender |
| `EMA` | Telemetry file writer |
| `X48` | Scroll-summary builder |
| `t$q` | Scroll-summary sub-helper |
| `s$q` | Scroll-metric aggregator |
| `Y9` | PTY / fullscreen environment probe |
| `t_6` | Session-end marker helper |
| `P48` | Promise.race / abort-signal wrapper |
| `r8` | Timeout-with-abort helper |