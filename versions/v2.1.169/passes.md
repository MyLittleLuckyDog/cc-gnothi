---
type: feature-spec
feature: "passes"
cc_version: "2.1.169"
updated: "2026-06-11"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.169 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.169 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.169

---

## Overview

The `/passes` command presents a UI for sharing free trial weeks of Claude Code with friends and contacts. It is a `local-jsx` type command, meaning it renders a JSX component inline within the Claude Code terminal interface rather than dispatching an agent prompt. On invocation, it fires a telemetry event, initialises configuration/session state, and mounts the guest-passes React component.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| loc_byte | `12584820` |
| loc_byte_end | `12585142` |
| loc_line | `8893` |
| isHidden | `null` (not hidden) |
| module_id | `cKK` |
| load_inline | `true` |
| arbor_handler.name | `uUf` |
| arbor_handler.fqn | `claude-2.1.169::uUf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.169 bundle.js:+12584820

---

## Input Branching

The command has a straightforward linear activation flow with a single notable branch (daemon/session state check before rendering). Two branches are detectable from the call graph, so numbered pseudocode is used.

1. `/passes` is typed in the CLI input.
2. The CLI dispatcher resolves the command registration from module `cKK` via the inline `load` wrapper, yielding handler `uUf`.
3. `uUf` is invoked as an `AsyncFunction`.
4. `uUf` immediately fires the `tengu_guest_passes_visited` telemetry event (Analysis basis: CC v2.1.169 bundle.js:+12584643).
5. `uUf` calls `Tu8` to perform session/config initialisation (Analysis basis: CC v2.1.169 bundle.js:+12584537).
6. `uUf` calls `X8` to resolve the configuration store and validate daemon readiness (Analysis basis: CC v2.1.169 bundle.js:+12584543).
7. `uUf` calls `y6` to load or refresh state from persistent storage (Analysis basis: CC v2.1.169 bundle.js:+12584503).
8. `uUf` calls `l5A.createElement` to mount the guest-passes JSX component in the terminal UI (Analysis basis: CC v2.1.169 bundle.js:+12584692).
9. The rendered component is returned to the CLI renderer for display.

---

## Behavioral Spec

### Top-level Handler — `uUf` (guestPassesCommandHandler)

```
async function guestPassesCommandHandler(context):
    emit telemetry("tengu_guest_passes_visited")

    sessionConfig = await initSessionConfig(context)       // Tu8
    configStore   = await resolveConfigAndDaemon(context)  // X8
    passesState   = await loadPassesState(context)         // y6

    uiElement = createElement(GuestPassesComponent, {
        sessionConfig,
        configStore,
        passesState,
        ...context
    })

    return uiElement
```

Analysis basis: CC v2.1.169 bundle.js:+12584503–12584692

---

### Session / Config Initialisation — `Tu8` (initSessionConfig)

`Tu8` is called first and sets up the session layer. It delegates to:

- `FL` — config file loader, which itself calls `IY` (config parser/validator) and `y6` (state reader).
- `y6` — shared persistent state accessor (also called directly from the top-level handler).

```
function initSessionConfig(context):
    fileConfig = loadConfigFile(context)    // FL → IY
    state      = loadSharedState(context)   // y6
    return { fileConfig, state }
```

Analysis basis: CC v2.1.169 bundle.js:+12193602, +12193650

---

### Config Store & Daemon Resolution — `X8` (resolveConfigAndDaemon)

`X8` reads the current global configuration and verifies daemon connectivity before the UI mounts.

Key sub-calls observed in depth-2 traversal:

| Sub-function | Role |
|---|---|
| `UL8` | Reads/writes the `~/.claude.json` config with locking (calls `saveConfigWithLock` logic) |
| `y7H` | Parses the on-disk config JSON; throws `"Config accessed before allowed."` on premature access (Analysis basis: CC v2.1.169 bundle.js:+3274258) |
| `VG` | Likely a reactive state signal/getter |
| `OJH` | Internal option/flag resolver |
| `Ie1` | Iterates config entries via `Object.entries` |
| `MP6` | Timestamp utility using `Date.now` |
| `pL8` | Sub-config persistence helper |
| `N` | Network request helper (bootstrap fetch with `"api_bootstrap_fetch"` telemetry) |
| `d` | Shared dependency/utility |

```
async function resolveConfigAndDaemon(context):
    rawConfig  = parseConfigFile(context)           // y7H (may throw)
    configObj  = buildConfigObject(rawConfig)       // UL8, VG
    entries    = Object.entries(configObj)          // Ie1
    timestamp  = Date.now()                         // MP6
    subConfig  = persistSubConfig(configObj)        // pL8
    return configObj
```

Config-locking constants observed:
- Lock contention warning string: `"Lock acquisition took longer than expected…"` (Analysis basis: CC v2.1.169 bundle.js:+3272225)
- Auth-loss guard string fragment: `"saveConfigWithLock: re-read config is missing auth…"` (Analysis basis: CC v2.1.169 bundle.js:+3272641)
- Backup file prefix: `".backup."` (Analysis basis: CC v2.1.169 bundle.js:+3273111)
- Maximum config backups retained: `5` (Analysis basis: CC v2.1.169 bundle.js:+3273244)
- Config file permissions (octal): `384` (= `0o600`) (Analysis basis: CC v2.1.169 bundle.js:+3273526)

---

### Passes State Loader — `y6` (loadPassesState)

`y6` is the shared state accessor invoked both from `Tu8` and directly from the top-level handler. It coordinates:

- `l6` — low-level logger/emitter.
- `VG` — reactive signal.
- `NG_` — notification or state-change callback.
- `y7H` — config parser (see above).
- `jhL` — file-watch subscription for live config updates, which itself calls `xL8.watchFile` / `xL8.unwatchFile`, `Vu` (a string helper), `Z9` (hook registrar via `ZGA.register`), and `tB` (timer/debounce).
- `Date.now` — for timestamping the loaded state.

```
function loadPassesState(context):
    log(context)                        // l6
    signal = getSignal()                // VG
    notify = getNotifier()              // NG_

    config = parseConfigFile(context)   // y7H

    timestamp = Date.now()

    watcher = watchConfigFile({         // jhL
        onUpdate: (newConfig) =>
            notify(parseValue(newConfig))   // Vu
        onUnwatch: () =>
            deregisterHook()                // Z9 → ZGA.register
    })

    return { config, timestamp, watcher }
```

Analysis basis: CC v2.1.169 bundle.js:+3271006–3271149

---

### Config File Parser — `y7H` (parseConfigFile)

```
function parseConfigFile(context):
    if configNotYetAllowed(context):
        throw new Error("Config accessed before allowed.")

    log(context)                                    // l6
    raw = fs.readFileSync(configPath, "utf-8")      // q.readFileSync
    parsed = JSON.parse(raw)                        // F6 → JSON.parse

    // Normalise path prefix
    prefix = normalisePrefix(parsed.path)           // Vu → H.startsWith, H.slice

    backupDir = resolveBackupDir()                  // ke1
    statResult = fs.statSync(configPath)            // q.statSync

    if statResult.error === "ENOENT":
        // Config file missing — return defaults
        return defaultConfig()

    // Build canonical config object
    configObj = buildConfigObject(parsed, prefix, backupDir)

    return configObj
```

Error codes observed: `"ENOENT"` (Analysis basis: CC v2.1.169 bundle.js:+3274488), `"EEXIST"` (Analysis basis: CC v2.1.169 bundle.js:+3275103), `"error"` field key (Analysis basis: CC v2.1.169 bundle.js:+3274809).

---

### JSX Component Mount — `l5A.createElement`

After all state is resolved, `uUf` calls `l5A.createElement` with the guest-passes component and the resolved props. This is the standard React-compatible element-creation path used throughout Claude Code's local-jsx commands.

Analysis basis: CC v2.1.169 bundle.js:+12584692

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_guest_passes_visited` (fired on every `/passes` invocation, bundle.js:+12584643) |
| Telemetry (config layer) | `tengu_config_parse_error`, `tengu_config_lock_contention`, `tengu_config_stale_write`, `tengu_config_auth_loss_prevented` (emitted by config subsystem during handler execution) |
| Telemetry (daemon layer) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_low_mem_mb`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_sendclaim_failed`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop`, `tengu_bg_attach`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_stall_respawn`, `tengu_bg_attach_kick`, `tengu_bg_attach_legacy_autorespawn`, `tengu_scheduled_task_missed` (reachable via daemon connectivity path) |
| Telemetry (feature flags) | `tengu_feature_ok`, `tengu_feature_bad` (reachable via feature-flag check within session init) |
| Telemetry (bootstrap) | `tengu_bg_low_mem_mb` maps to literal `"api_bootstrap_fetch"` / `"parse_failed"` path (Analysis basis: CC v2.1.169 bundle.js:+16098278) |
| Hook registration | `Z9` calls `ZGA.register` to register a file-watch teardown hook (Analysis basis: CC v2.1.169 bundle.js:+62328) |
| File-system side effects | `~/.claude.json` may be read (and re-written with lock) during config initialisation; backup files written under a `backups/` subdirectory with `".backup."` prefix |
| appState changes | Passes state object is injected into the JSX component tree; no direct global `appState` mutation observed at depth ≤ 2 |
| Sound | None observed |
| Config lock | A mutex/lock is acquired around `~/.claude.json` writes; contention is telemetered as `tengu_config_lock_contention` |

---

## Version History

| Version | Change |
|---|---|
| v2.1.169 | Initial analysis |

---

## Common Mistakes

1. **Expecting agent output**: `/passes` is a `local-jsx` command. It renders a UI component and does not send a prompt to the Claude model; no assistant text response is produced.
2. **Running without authentication**: The config parser (`y7H`) enforces that configuration must be accessible before the command renders. Running `/passes` before completing OAuth or API-key setup will throw `"Config accessed before allowed."` and the component will not mount.
3. **Stale config file**: If `~/.claude.json` is modified externally while Claude Code is running, the file-watch (`jhL` / `xL8.watchFile`) will trigger a re-parse. Manually removing or corrupting the file while `/passes` is open can cause a `tengu_config_parse_error` event and a blank passes panel.
4. **Daemon not running**: The `X8` path checks daemon connectivity. If the background daemon is not reachable, related telemetry (`tengu_bg_spare_claim_fail`, `tengu_bg_sendclaim_failed`) will fire and the command may surface an error state inside the component.
5. **Confusing `/passes` with a billing command**: This command is specifically for *gifting* trial access to other users, not for managing the current user's subscription or API quota.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `uUf` | Top-level async handler for `/passes` (guestPassesCommandHandler) |
| `y6` | Shared passes/config state loader |
| `l6` | Low-level logger / emitter |
| `NG_` | State-change notification callback |
| `y7H` | Config file parser (reads and parses `~/.claude.json`) |
| `q` | Node `fs`-like I/O wrapper (readFileSync, statSync, mkdirSync, etc.) |
| `$1` | CLI error handler (calls `process.exit`) |
| `F6` | JSON parse wrapper |
| `Vu` | String prefix normaliser (startsWith / slice) |
| `H` | HTTP bootstrap fetch helper |
| `_` | General utility / filesystem abstraction |
| `E8` | Error classification/formatting helper |
| `ke1` | Backup directory resolver |
| `yG_` | Path join helper for backup dirs |
| `M` | Config map/store manager |
| `$` | Additional config utility |
| `N` | Network request helper (bootstrap fetch) |
| `ItK` | Request initiator sub-utility |
| `CH` | JSON stringify wrapper |
| `R4` | String redaction/replacement helper |
| `rBH` | Log entry formatter |
| `StK` | Async config write-with-lock helper |
| `d` | Shared low-level dependency/utility |
| `w` | Daemon worker/process manager |
| `A` | Process/session map |
| `b` | Background session lifecycle manager |
| `a8` | Async abort/timeout utility |
| `bH` | Feature-flag "bad" reporter |
| `SH` | Feature-flag "ok" reporter |
| `MU8` | Memory usage / macOS low-memory checker |
| `JW6` | Config file async reader |
| `hH` | Session error logger |
| `Q` | Settled-session retirement manager |
| `D6` | Daemon dispatch / session lookup |
| `uPA` | Daemon socket claim/connect helper |
| `gPA` | Background session lifecycle orchestrator |
| `L` | Session queue / task tracker |
| `D` | Forced shutdown handler |
| `K6` | PTY/terminal capability reporter |
| `F` | Disposable resource handle |
| `jhL` | Config file-watch subscription manager |
| `tB` | Debounce/timer utility for file-watch |
| `Z9` | Hook registrar (wraps `ZGA.register`) |
| `Tu8` | Session config initialiser |
| `FL` | Config file loader (delegates to `IY`) |
| `IY` | Config parser and validator |
| `i7` | CLI argument parser (supports `--bare` flag) |
| `_j` | Profile/auth resolver |
| `oL` | OAuth first-party handler |
| `LP` | Auth layer provider |
| `AO` | Top-level auth orchestrator |
| `AX6` | Auth context builder |
| `UnH` | Auth context utility |
| `X8` | Config store and daemon readiness resolver |
| `UL8` | Config read/write with file-lock |
| `hT1` | Config object builder (Object.assign path) |
| `Tz_` | Config schema validator |
| `ViH` | Config value inspector |
| `V` | Config version string holder |
| `P` | IPC framing / buffer manager |
| `X` | IPC timeout manager |
| `J` | Session kill orchestrator |
| `Df` | IPC stream end helper |
| `Lj5` | Daemon IPC protocol handler (full message dispatch) |
| `EH` | String coercion helper |
| `E` | Array slice / bounds utility |
| `G` | SDK connection manager |
| `WO6` | Atomic file write helper (temp + rename) |
| `O` | Symbolic-link / stat resolver |
| `k8` | Error code extractor |
| `f` | File handle / stream wrapper |
| `OJH` | Option/flag resolver for config |
| `Ie1` | Config entry iterator (Object.entries) |
| `MP6` | Timestamp utility (Date.now) |
| `pL8` | Sub-config persistence helper |