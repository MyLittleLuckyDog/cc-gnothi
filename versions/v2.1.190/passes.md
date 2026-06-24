---
type: feature-spec
feature: "passes"
cc_version: "2.1.190"
updated: "2026-06-24"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.190 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.190 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.190

---

## Overview

The `/passes` command surfaces a "guest passes" UI that allows the current user to share a free week of Claude Code access with friends or colleagues. When invoked, the command fires a telemetry event recording the visit, then renders a JSX component that presents the available passes and sharing interface. The command is implemented as an async function that resolves to a rendered JSX element via the `Dxl.jsx` rendering pipeline.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| loc_byte | `12479657` |
| loc_byte_end | `12479979` |
| loc_line | `8450` |
| isHidden | `null` (not hidden) |
| module_id | `Mxl` |
| load_inline | `true` |
| arbor_handler.name | `qhf` |
| arbor_handler.fqn | `claude-2.1.190::qhf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.190 bundle.js:+12479657

---

## Input Branching

The command has a simple linear flow with no conditional branching on user input — it is invoked without arguments and proceeds through a fixed sequence of steps. A numbered pseudocode representation is appropriate here.

```
1. User types /passes and confirms
2. Handler qhf() is invoked (async)
3. Fire telemetry: tengu_guest_passes_visited
4. Resolve configuration and auth state via hn() / n7n()
5. Render JSX component via Dxl.jsx with passes data
6. Return JSX element to CLI rendering pipeline
```

---

## Behavioral Spec

### Main Handler — Guest Passes Entry Point

The primary handler (`qhf`, resolved via module `Mxl`) is an `AsyncFunction` that orchestrates the passes UI lifecycle.

```
async function guestPassesHandler(context):
    # Step 1: record the visit
    emitTelemetry("tengu_guest_passes_visited")          # bundle.js:+12479490

    # Step 2: load configuration and network state
    configState  = await loadConfigState(context)        # via hn(), bundle.js:+12479390
    sessionState = await resolveSessionContext(context)  # via n7n(), bundle.js:+12479384

    # Step 3: retrieve the logger / warning helper
    logWarning = resolveWarningHelper(context)           # via W, bundle.js:+12479488

    # Step 4: render and return the JSX component
    return renderJSX(GuestPassesComponent, {
        config:  configState,
        session: sessionState,
    })                                                   # via Dxl.jsx, bundle.js:+12479539
```

Analysis basis: CC v2.1.190 bundle.js:+12479350

---

### Configuration Loading — `hn` subsystem

The configuration loader (`hn`) is called early in the handler to obtain the current global config, auth state, and pass entitlements. It delegates to several sub-routines:

```
function loadConfigState(context):
    rawConfig   = readRawConfig(context)          # via n0, bundle.js:+13748598
    authState   = resolveAuthState(context)       # via CDe, bundle.js:+13748650
    passData    = fetchPassEntitlements()         # via NOo, bundle.js:+13748669
    timestamp   = DKt.getTimestamp()             # via DKt, bundle.js:+13748694
    fileBackup  = saveConfigWithLock(context)    # via BQn, bundle.js:+13749041
    return { rawConfig, authState, passData, timestamp }
```

The pass entitlements step (`NOo`) iterates `Object.entries` over the response payload, categorising each pass by its status string. Observed status literal values used in the entitlement classification logic:

| Status literal | Location |
|---|---|
| `"unknown"` | bundle.js:+13749278 |
| `"local"` | bundle.js:+13749353 |
| `"migrated"` | bundle.js:+13749340 |
| `"native"` | bundle.js:+13749385 |
| `"installed"` | bundle.js:+13749371 |
| `"disabled"` | bundle.js:+13749404 |
| `"enabled"` | bundle.js:+13749430 |
| `"no_permissions"` | bundle.js:+13749444 |
| `"not_configured"` | bundle.js:+13749465 |
| `"global"` | bundle.js:+13749484 |

Analysis basis: CC v2.1.190 bundle.js:+13748594 – +13749484

---

### Session and Auth Resolution — `n7n` subsystem

The session context resolver (`n7n`) locates the active Claude session and authenticates the user before the passes UI may be displayed.

```
function resolveSessionContext(context):
    sessionHandle = openSessionHandle(context)   # via hc, bundle.js:+12126850
    agentState    = attachToAgent(sessionHandle) # via Dt, bundle.js:+12126898
    return { sessionHandle, agentState }
```

The `hc` sub-call in turn invokes the authentication flow (`ay`) which checks for API key / OAuth token presence and raises an error string containing the message `"ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, CLAUDE_CODE_OAUTH_TOKEN, or WIF env vars … required"` if credentials are absent (bundle.js:+3057194).

Analysis basis: CC v2.1.190 bundle.js:+12479384

---

### Config Persistence — `BQn` / `GQn` subsystem

The config lock-and-save subsystem is shared with other commands. Relevant safety guards observed in the literals:

- Lock-contention warning: `"Lock acquisition took longer than expected…"` (bundle.js:+13751922)
- Auth-loss guard: `"saveConfigWithLock: re-read config is missing auth that cache has; refusing to write…"` (bundle.js:+13752338)
- Backup file naming: files are stored under a path containing `"backups"` (bundle.js:+13753523) and identified by the `.backup.` infix (bundle.js:+13752808); a maximum of 5 backup files is retained (literal `5`, bundle.js:+13752941).

Analysis basis: CC v2.1.190 bundle.js:+13749041

---

### JSX Rendering

After the data is resolved, the handler renders a JSX element via `Dxl.jsx` (bundle.js:+12479539). The `local-jsx` registration type means the CLI host receives a React/JSX element rather than plain text. The element is expected to display pass availability, sharing links, and expiry information to the user.

```
function renderGuestPassesUI(config, session):
    return Dxl.jsx(GuestPassesComponent, {
        passes:  config.passData,
        session: session,
        theme:   resolveTheme(),    # literals: "dark"/"auto"/"normal" bundle.js:+13746761
    })
```

Analysis basis: CC v2.1.190 bundle.js:+12479539

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_guest_passes_visited` (bundle.js:+12479490) — fired on every invocation of `/passes` |
| Telemetry (config subsystem, shared) | `tengu_config_lock_contention`, `tengu_config_stale_write`, `tengu_config_auth_loss_prevented`, `tengu_config_parse_error`, `tengu_config_fallback_write` |
| Telemetry (bg/daemon subsystem, shared) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_low_mem_mb`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_sendclaim_failed`, `tengu_bg_attach`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_stall_respawn`, `tengu_bg_attach_kick`, `tengu_bg_attach_legacy_autorespawn`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop`, `tengu_daemon_idle_exit`, `tengu_daemon_yield`, `tengu_daemon_control` |
| Telemetry (feature flags, shared) | `tengu_feature_ok`, `tengu_feature_bad` |
| Hook registration | None observed at depth ≤ 2 |
| appState changes | Config may be re-written to disk via the config lock path; auth state is read but not mutated by this command directly |
| Sound | None observed |
| File I/O | Config backup files are read/written under the `backups/` directory; `.backup.` files are pruned to a maximum of 5 entries (bundle.js:+13752941) |
| Network | Auth token validation and pass entitlement fetch occur during session resolution |

---

## Version History

| Version | Change |
|---|---|
| v2.1.190 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/passes` without valid credentials** — the auth resolution step (`n7n` → `ay` → `Yg`) will throw an error if no API key, OAuth token, or WIF environment variables are present. Ensure authentication is configured before using this command.
2. **Expecting text output** — `/passes` is registered as `local-jsx`, so it returns a rendered UI component, not a plain-text response. Piping or scripting the output will not produce useful text.
3. **Misreading the pass status values** — the entitlement system uses a specific set of status strings (`"enabled"`, `"disabled"`, `"no_permissions"`, etc.). An `"unknown"` status means the server could not classify the pass, not that passes are unavailable.
4. **Assuming the command accepts arguments** — the registration carries no `args` or `userFacingName` field; the command takes no parameters and ignores any trailing input.
5. **Triggering config corruption** — the config write path includes a guard that aborts the write if auth data would be lost (bundle.js:+13752338, GH #3117). If this guard fires, the config file is left unchanged and a `tengu_config_auth_loss_prevented` event is emitted.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `qhf` | Main handler for `/passes` (`AsyncFunction`, arbor_handler) |
| `Dt` | Agent/daemon state accessor called by the main handler |
| `Wt` | Path/workspace resolver utility |
| `OOo` | Observed-options or operation-options helper |
| `SEe` | Config file reader with error handling |
| `Is` | CLI data stream / stdin reader |
| `Gt` | JSON-parse wrapper |
| `u9` | String prefix-check / slice utility |
| `cn` | Config-node accessor |
| `bGl` | Backup file listing utility |
| `$Oo` | Path join + origin resolver |
| `T` | Token / message formatting helper |
| `nLc` | Token normalisation / content-policy checker |
| `Me` | JSON-stringify wrapper |
| `wc` | String replacement / redaction helper (`[REDACTED]` literal nearby) |
| `hze` | Error-object helper |
| `iLc` | File content loader with byte-length check |
| `W` | Logging / warning emitter |
| `f` | Background-session manager (dispatch, spawn, retire) |
| `n` | Process/session name normaliser |
| `D` | Daemon process handle |
| `Kn` | Timeout-with-abort helper |
| `Re` | Feature-flag OK reporter |
| `Le` | Feature-flag OK reporter (alternate path) |
| `GXn` | Low-memory detector (macOS) |
| `B2e` | Async file lstat/read/remove helper |
| `ke` | Error logger with structured push |
| `U` | Daemon idle-exit / retire-if-settled helper |
| `it` | Session-token watcher |
| `L3o` | Socket-claim / daemon connection helper |
| `P3o` | Background job lifecycle manager |
| `s` | Background job lifecycle manager (alias) |
| `p` | Forced-shutdown / abort helper |
| `Pe` | Feature initialiser |
| `F` | Interval-clear / dispose helper |
| `BRf` | Config watch / file-watch lifecycle manager |
| `mIt` | File-watch registration helper |
| `cV` | Config version helper |
| `Ei` | Signal/event registration helper |
| `n7n` | Session context resolver (called by `qhf`) |
| `hc` | Session handle opener |
| `ay` | Auth + agent state resolver |
| `Ad` | CLI argument parser (bare mode) |
| `dA` | Profile / auth provider selector |
| `Nl` | First-party auth helper |
| `rT` | Runtime context helper |
| `Yg` | Auth credential validator (raises on missing keys) |
| `eRt` | Auth environment-variable reader |
| `mZe` | Native credential resolver |
| `hn` | Config-state loader called by `qhf` |
| `GQn` | Config-with-lock save routine |
| `SWs` | Object-assign-based state merger |
| `YRr` | Config change event emitter |
| `PHt` | Path-hash / config path helper |
| `I` | Scroll / viewport dimension calculator |
| `x` | Terminal write / key-event handler |
| `A` | Clamp-to-range (Math.max/min) helper |
| `H` | Daemon socket message framer/reader |
| `g` | Socket timeout / data-buffer helper |
| `m` | Session map / kill helper |
| `mp` | Message-end / serialise helper |
| `RJf` | Daemon protocol dispatcher (large routing function) |
| `be` | String coercion helper |
| `sIt` | Atomic file write helper (temp + rename) |
| `Nd` | Real-path resolver |
| `u` | Abort controller / signal helper |
| `kn` | Config node creator |
| `i` | Socket close/read helper |
| `T7e` | fchmod error-code handler |
| `CDe` | Auth-state resolver (inside `hn`) |
| `NOo` | Pass-entitlement iterator (Object.entries over server response) |
| `DKt` | Timestamp helper (Date.now wrapper) |
| `BQn` | Config save-with-lock orchestrator |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.