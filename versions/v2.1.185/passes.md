---
type: feature-spec
feature: "passes"
cc_version: "2.1.185"
updated: "2026-06-21"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.185 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.185 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.185

---

## Overview

The `/passes` command presents a UI for sharing a free week of Claude Code with friends (a "guest pass" feature). It is a `local-jsx` command, meaning it renders a React/JSX component directly in the terminal UI rather than invoking the agent model. When invoked, it fires a telemetry event and renders an interactive component that facilitates pass distribution.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| loc_byte | `12711113` |
| loc_byte_end | `12711435` |
| loc_line | `8322` |
| isHidden | `null` (not hidden) |
| module_id | `EIl` |
| load_inline | `true` |
| arbor_handler.name | `Dif` |
| arbor_handler.fqn | `claude-2.1.185::Dif` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.185 bundle.js:+12711113

---

## Input Branching

The handler `Dif` does not branch on user-supplied text input — it is a `local-jsx` command that unconditionally renders a JSX component. The flow is essentially linear: fire telemetry → resolve configuration and background-session state → render the passes UI component.

```
1. Command is invoked (/passes)
2. Fire telemetry: tengu_guest_passes_visited
3. Resolve configuration (pn) and acquire/validate background-session state (Aqn)
4. Render JSX element via WIo.createElement (passes UI component)
5. Return rendered component to the CLI shell for display
```

Because this is a linear flow with no distinct user-input branches (the command takes no arguments), a Mermaid flowchart is not required.

---

## Behavioral Spec

### Top-Level Handler

The Arbor-resolved handler is `Dif` (an `AsyncFunction`), reached via `module_id` resolution through module `EIl`.

Analysis basis: CC v2.1.185 bundle.js:+12710796

```
async function guestPassesHandler(context):
    // Immediately emit telemetry to record that the user visited the passes screen
    emit("tengu_guest_passes_visited")

    // Resolve global/session configuration
    config = await resolveConfiguration(context)       // pn path
    sessionState = await resolveSessionState(context)  // Aqn path

    // Build and return a JSX element representing the passes UI
    element = createJsxElement(PassesComponent, { config, sessionState, ...context })
    return element
```

Analysis basis: CC v2.1.185 bundle.js:+12710830, +12710836, +12710934, +12710985

### Configuration Resolution (`pn`)

`pn` is the configuration-resolution utility called early in the handler. It accesses global config state, acquires a file-system lock for safety, reads and parses the config JSON, and exposes structured config values. It relies on a background file-watcher (`Ebf`) to keep the in-memory config fresh and fires telemetry on lock contention or stale writes.

Analysis basis: CC v2.1.185 bundle.js:+13963319

```
function resolveConfiguration(context):
    acquire config lock (with contention telemetry if slow)
    read config file (UTF-8, via r.readFileSync)
    parse JSON (Gt → JSON.parse)
    validate auth fields — if auth present in cache but missing in re-read, abort write
        (emit tengu_config_auth_loss_prevented, log "saveConfigWithLock: re-read config is missing auth...")
    apply config object merges
    return parsed config
```

Key config status strings observed in literals (Analysis basis: CC v2.1.185 bundle.js:+13964065 – +13964209):

| Status Token | Meaning |
|---|---|
| `"unknown"` | Status could not be determined |
| `"local"` | Local installation |
| `"migrated"` | Config migrated from older format |
| `"native"` | Native installation path |
| `"installed"` | Package installed |
| `"disabled"` | Feature disabled |
| `"enabled"` | Feature enabled |
| `"no_permissions"` | Permissions not granted |
| `"not_configured"` | Not yet configured |
| `"global"` | Global scope setting |

### Session State Resolution (`Aqn`)

`Aqn` calls into the background-session infrastructure (`Mc` → `hy`) to determine whether a daemon session is running. It delegates to `Ct` (the background-session client) and exposes current session status to the JSX component.

Analysis basis: CC v2.1.185 bundle.js:+12710830, +12349971, +3070528

```
async function resolveSessionState(context):
    sessionClient = createSessionClient(context)   // Mc / hy
    state = await sessionClient.getState()         // Ct
    return state
```

### Config Watcher (`Ebf`)

A file-watcher is registered via `B7n.watchFile` to detect external changes to the config file. On change, the watcher re-reads the config. `qi` registers the watcher using `B2o.register`. The watcher is unregistered with `B7n.unwatchFile` on cleanup.

Analysis basis: CC v2.1.185 bundle.js:+13965007, +13965174, +69538

### Config Backup Logic (`q_e` / `W7n`)

The config subsystem (reached transitively via `pn`) maintains backup copies of the configuration file:

```
function manageConfigBackups(configPath, fs):
    backupDir = join(configPath, "backups")       // literal "backups" at +13968258
    if backupDir does not exist:
        fs.mkdirSync(backupDir)
    entries = fs.readdirStringSync(backupDir)
    // Keep only the most recent N=5 backups           // literal 5 at +13967676
    while entries.length > 5:
        remove oldest entry
    timestamp = Date.now()
    fs.copyFileSync(configPath, join(backupDir, basename + timestamp))
```

Analysis basis: CC v2.1.185 bundle.js:+13968258, +13967676, +13969829

Files matching `".backup."` pattern are recognised as backup entries (literal at CC v2.1.185 bundle.js:+13967543).

### JSX Rendering (`WIo.createElement`)

Because `type` is `local-jsx`, the handler's return value is a React element rather than a text string. The element is constructed by calling `WIo.createElement` with the passes-specific component and the resolved props.

Analysis basis: CC v2.1.185 bundle.js:+12710985

```
function renderPassesUI(config, sessionState):
    return createElement(PassesComponent, {
        config: config,
        session: sessionState
    })
```

No agent model call is made; the component is rendered entirely in the CLI's React/Ink layer.

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_guest_passes_visited` | Fired immediately when the command is invoked (bundle.js:+12710936) |
| Telemetry — `tengu_config_parse_error` | Fired if the config JSON cannot be parsed (bundle.js:+13969321) |
| Telemetry — `tengu_config_lock_contention` | Fired if the config file lock takes longer than expected (bundle.js:+13966746) |
| Telemetry — `tengu_config_stale_write` | Fired on a detected stale config write (bundle.js:+13966882) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a write is aborted to protect auth data (bundle.js:+13967225) |
| Telemetry — `tengu_config_fallback_write` | Fired when the global config write falls back to an alternate strategy (bundle.js:+13966362) |
| Telemetry — `tengu_bg_*` (various) | Background-session daemon events fired transitively by session-state resolution (e.g., `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, etc.) |
| Config file backup | Up to 5 timestamped backup copies written to `<configDir>/backups/` |
| Config file lock | File lock acquired and released around config reads/writes |
| File watcher | `B7n.watchFile` registered on the config file; unregistered on cleanup via `B7n.unwatchFile` |
| appState changes | Session state is read-only from `/passes`; no appState mutations observed at depth ≤ 2 |
| Sound | None observed |
| JSX render | Returns a React element; rendered by the CLI shell's Ink/React layer; no agent turn is created |

---

## Version History

| Version | Change |
|---|---|
| v2.1.185 | Initial analysis |

---

## Common Mistakes

1. **Expecting text output**: `/passes` is a `local-jsx` command. It renders an interactive UI panel, not printed text. Piping or scripting its output will not capture meaningful content.
2. **Passing arguments**: The command accepts no user-supplied arguments. Any trailing text after `/passes` is ignored.
3. **Expecting an agent response**: Because this is `local-jsx`, no Claude model turn is initiated. The command is handled entirely client-side.
4. **Confusing with `/help` or `/account`**: `/passes` is specifically for distributing guest-pass credits to others, not for managing your own subscription.
5. **Assuming instant availability**: The command resolves config and background-session state asynchronously before rendering; on slow systems with lock contention, there may be a brief delay before the UI appears.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Dif` | Top-level handler for `/passes` (AsyncFunction; Arbor-resolved via module_id `EIl`) |
| `Ct` | Background-session client; manages daemon session lifecycle |
| `jt` | Logging / debug utility |
| `Hko` | Hook or helper called during session setup |
| `q_e` | Config read, backup-management, and parse helper |
| `r` | Node.js `fs` module binding (synchronous operations) |
| `Fs` | Process/data bootstrap utility; calls `process.exit` on fatal errors |
| `Gt` | JSON-parse wrapper |
| `V9` | String-prefix utility (uses `startsWith` / `slice`) |
| `dn` | Error/diagnostic display helper |
| `RFl` | Directory-listing and backup enumeration helper |
| `Sko` | Path-join wrapper (uses `vS.join`) |
| `T` | Multi-purpose utility: logging, string transforms, path operations |
| `QHc` | Sub-utility of `T` |
| `Pe` | JSON.stringify wrapper |
| `Kc` | String-redaction / sanitisation helper (replaces sensitive values with `[REDACTED]`) |
| `Hqe` | Sub-utility helper |
| `n_c` | File-write utility with byte-length tracking and promise chaining |
| `j` | General-purpose utility / logger |
| `f` | Background-session dispatch / worker-management function |
| `n` | Map-based registry (keyed by lowercase string) |
| `M` | Scheduled-task / timer manager (calls `Date.now`, `setTimeout`) |
| `Bn` | Async retry / timeout helper (uses `clearTimeout`) |
| `Re` | Feature-flag OK reporter (emits `tengu_feature_ok`) |
| `ke` | Feature-flag error reporter (emits `tengu_feature_bad`) |
| `YKn` | macOS memory-check utility (emits `tengu_bg_low_mem_mb`) |
| `B$e` | Async file-cleanup helper (lstat → rm → readFile → filter) |
| `De` | Error-logging sink (calls `QJ.logError`) |
| `$` | Settled-promise retirement utility (`retireIfSettled`) |
| `ct` | Cache/registry lookup with `pIe.has` / `u8.get` gates |
| `NNo` | Daemon socket connection manager (claim → connect → auth → write) |
| `jNo` | Background job lifecycle manager (add → finally → delete → cleanup) |
| `s` | Alias for `jNo` sub-operations (r.add / i.finally / r.delete) |
| `p` | Forced-shutdown initiator (`process.exit`, `u.abort`) |
| `Ue` | Utility resolved to `ogt` |
| `Ebf` | Config-file watcher (watchFile / unwatchFile) |
| `Kq` | Sub-helper called within config watcher |
| `qi` | Watcher registration via `B2o.register` |
| `Aqn` | Session-state resolver; delegates to `Mc` and `Ct` |
| `Mc` | Session-client factory (calls `hy`, `Ct`) |
| `hy` | Auth-profile resolver (profile-implicit, user_oauth, firstParty) |
| `dp` | Auth-bootstrap helper (`--bare` flag handler) |
| `ib` | Auth-credential builder (lcn, AJe, wj, eM, Kti, zti) |
| `Ac` | OAuth/auth-type classifier (`firstParty`) |
| `YT` | Utility referenced by session-client setup |
| `Ug` | Full session-client orchestrator (spawns Ct, handles ANTHROPIC_API_KEY, apiKeyHelper, none) |
| `vLt` | Utility helper wrapping `AJe` |
| `AJe` | Auth-state accessor |
| `pn` | Config-management entry point (read, lock, watch) |
| `W7n` | Config-save-with-lock implementation (mkdirSync, statSync, copyFileSync, unlinkSync) |
| `C3s` | Object-assign wrapper with `_wr` |
| `_wr` | Internal write helper (`I3s`) |
| `AAt` | Auxiliary helper in config path |
| `I` | Scroll/layout utility (Math.max, Math.floor, preventDefault) |
| `k` | Supervisor write utility (`d.write`, `j6f`) |
| `E` | Clamp utility (Math.max, Math.min) |
| `g` | Buffer/stream framing utility (Buffer.concat, indexOf, subarray) |
| `h` | Socket-timeout helper |
| `m` | Worker-kill manager (n.values, k.kill) |
| `Qp` | Stream-end helper |
| `T6f` | Daemon protocol message dispatcher (handles ping, nudge, yield, lease, dispatch, attach, reply, snapshot, resize, subscribe, etc.) |
| `Ee` | String-coercion utility |
| `MSt` | Atomic file-write with symlink resolution, permissions, fsync, and rename |
| `jp` | Real-path resolver (realpathSync) |
| `u` | Worker subprocess handle (ke, Re, rF, SG) |
| `Mn` | Error normaliser (`dn`) |
| `i` | Stream/socket close handler |
| `vKe` | Filesystem-error classifier (EINVAL, ENOTSUP, EPERM, ENOSYS) |
| `LMe` | Config helper referenced in `pn` |
| `_ko` | Object.entries iterator helper |
| `oWt` | Timestamp helper (`Date.now`) |
| `j7n` | Config-file atomic-write orchestrator (MSt, Pe, sI) |