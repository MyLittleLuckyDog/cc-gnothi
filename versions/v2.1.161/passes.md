---
type: feature-spec
feature: "passes"
cc_version: "2.1.161"
updated: "2026-06-03"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.161 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.161 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.161

---

## Overview

The `/passes` command surfaces a UI panel that allows the current Claude Code user to share a free week of Claude Code with friends (a "guest pass"). The command is implemented as a local JSX component rendered via React, with a dedicated telemetry event (`tengu_guest_passes_visited`) fired on entry. It is a purely presentational, non-agentic command — it renders UI rather than sending a prompt to the model.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | Share a free week of Claude Code with friends |
| loc_byte | `12309429` |
| loc_byte_end | `12309751` |
| loc_line | `8547` |
| isHidden | `null` (not hidden) |
| module_id | `js1` |
| load_inline | `true` |
| arbor_handler.name | `BTf` |
| arbor_handler.fqn | `claude-2.1.161::BTf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.161 bundle.js:+12309429

---

## Input Branching

The command has a simple linear flow with no user-input branching. On invocation, the handler fires telemetry, resolves infrastructure dependencies, and renders a JSX element. Pseudocode is sufficient.

---

## Behavioral Spec

### Top-level Handler (`BTf`)

The Arbor-resolved handler (`BTf`) is an `AsyncFunction` reached via `module_id → js1`. It is the sole entry point for `/passes`.

```
async function passesCommandHandler(context):

    // 1. Fire visit telemetry
    emit telemetry event "tengu_guest_passes_visited"
    // Analysis basis: CC v2.1.161 bundle.js:+12309252

    // 2. Resolve session / config state
    sessionState = await resolveSessionState()           // calls sessionStateResolver (y6)
    passesData   = await fetchGuestPassInfo(sessionState) // calls guestPassFetcher (Qy8)

    // 3. Build and return a JSX element for the passes panel
    element = createElement(passesUIComponent, {
        sessionState: sessionState,
        passesData:   passesData,
        onClose:      context.onClose
    })
    // Analysis basis: CC v2.1.161 bundle.js:+12309301

    return element
```

Analysis basis: CC v2.1.161 bundle.js:+12309112

---

### Session State Resolver (`y6`)

Called by the top-level handler; provides the live configuration and daemon session context required by the passes UI.

```
function resolveSessionState(configAccessor, stateManager, dispatcher, fileWatcher):

    // Reads current configuration via configAccessor (F6)
    config = configAccessor.read()

    // Reads app state flags via stateManager (S0)
    appState = stateManager.getFlags()

    // Registers file-watch callback via dispatcher (Dj_)
    dispatcher.watch(config.path, onConfigChange)

    // Delegates to fileWatcher subsystem (nDH) for
    // config file parsing and backup management
    parsedConfig = fileWatcher.loadAndParse(config.path)

    // Records timestamp for staleness detection
    timestamp = Date.now()
    // Analysis basis: CC v2.1.161 bundle.js:+3248213

    // Starts watch cycle via watchCycleManager (bXL)
    watchCycleManager.start(parsedConfig, timestamp)

    return { config, appState, parsedConfig, timestamp }
```

Analysis basis: CC v2.1.161 bundle.js:+12309112

---

### Guest Pass Info Fetcher (`Qy8`)

Fetches available guest-pass data from the Anthropic back-end or local cache, delegating to the authenticated network layer.

```
async function fetchGuestPassInfo(sessionState):

    // Delegates to authenticated API layer (zL)
    // which in turn calls the config-aware session builder (y6)
    apiClient = await buildAuthenticatedClient(sessionState)
    // Analysis basis: CC v2.1.161 bundle.js:+11933537

    passInfo = await apiClient.getGuestPasses()
    // Analysis basis: CC v2.1.161 bundle.js:+12309146

    return passInfo
```

Analysis basis: CC v2.1.161 bundle.js:+12309146

---

### Config File Parser / Backup Manager (`nDH`)

A shared utility (also used by config write paths) that reads, parses, and optionally backs up the Claude configuration file. The passes handler uses this only in read mode.

```
function loadAndParseConfig(configPath):

    // Guard: config must be accessible before use
    if not configIsAllowed():
        throw Error("Config accessed before allowed.")
        // Analysis basis: CC v2.1.161 bundle.js:+3251241

    raw = fs.readFileSync(configPath, "utf-8")
    // Analysis basis: CC v2.1.161 bundle.js:+3251324

    parsed = JSON.parse(raw)

    // Validate prefix of file identifier via prefixChecker (Ox)
    if prefixChecker.startsWith(parsed.id):
        // strip prefix
        parsed.id = prefixChecker.slice(parsed.id)

    // Resolve backup directory via backupPathResolver (rcq)
    backupDir = resolveBackupPath(configPath)   // uses "backups" literal
    // Analysis basis: CC v2.1.161 bundle.js:+3250809

    // On ENOENT, emit telemetry and return default
    if error.code === "ENOENT":
        // handled silently; returns null/default
        pass

    // On parse failure, emit tengu_config_parse_error
    on JSON parse failure:
        emit telemetry "tengu_config_parse_error"
        // Analysis basis: CC v2.1.161 bundle.js:+3251872

    return parsed
```

Analysis basis: CC v2.1.161 bundle.js:+3251235

---

### Config Persistence / Lock Manager (`Pj_` / `W8`)

These utilities handle the locked read-write path for configuration and are reached transitively. They are not directly invoked for the read-only `/passes` display path but appear in the depth-2 call graph because session state initialisation shares the same module.

Key constants observed:
- Lock contention warning message: `"Lock acquisition took longer than expected…"` (bundle.js:+3249208)
- Auth-loss guard message prefix: `"saveConfigWithLock: re-read config is missing auth…"` (bundle.js:+3249624)
- Backup file keep count: **5** (bundle.js:+3250227)
- Config file permissions mask: **384** (octal 0600) (bundle.js:+3250509)
- Backup filename marker: `".backup."` (bundle.js:+3250094)

Telemetry emitted from this sub-system (reachable from `/passes` session init):

| Event | Trigger |
|---|---|
| `tengu_config_lock_contention` | Lock held too long (bundle.js:+3249297) |
| `tengu_config_stale_write` | Detected stale write attempt (bundle.js:+3249433) |
| `tengu_config_auth_loss_prevented` | Auth data loss prevented on write (bundle.js:+3249776) |

---

### Authenticated API / Session Builder (`zL` → `KD` → `e3`)

Provides the OAuth / API-key-authenticated client used to fetch guest-pass entitlement data.

```
async function buildAuthenticatedClient(sessionState):

    // Resolve auth profile: checks for ANTHROPIC_API_KEY,
    // ANTHROPIC_AUTH_TOKEN, CLAUDE_CODE_OAUTH_TOKEN, or WIF env vars
    // Analysis basis: CC v2.1.161 bundle.js:+2991993
    authProfile = resolveAuthProfile(sessionState.config)

    if authProfile is null:
        throw Error(
            "ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, " +
            "CLAUDE_CODE_OAUTH_TOKEN, or WIF env vars required"
        )

    // Build first-party client token ("firstParty" literal at bundle.js:+2050221)
    client = constructClient(authProfile, "firstParty")

    return client
```

Analysis basis: CC v2.1.161 bundle.js:+3008436

---

### Bootstrap Network Fetch Sub-system (`H` / `N`)

Used transitively during session state resolution for API bootstrap data.

Key constants:
- Timeout: **5000 ms** (bundle.js:+15504313)
- Content-Type header value: `"application/json"` (bundle.js:+15504222)
- Telemetry event on fetch: `"api_bootstrap_fetch"` (bundle.js:+15504434)
- Parse failure marker: `"parse_failed"` (bundle.js:+15504456)

---

### Daemon / Background Worker Infrastructure (`w`, `DOA`, `XOA`)

The `/passes` command touches the background-worker subsystem transitively through session state resolution. This subsystem manages spare worker slots and memory limits.

Key constants observed:
- Background session timeout: **300 000 ms** (5 minutes) (bundle.js:+15911273)
- Low-memory threshold helper: `ER8` checks platform (`"macos"` at bundle.js:+12883153) with a divisor of **1024** (bundle.js:+12883202)
- Worker state strings: `"spare"`, `"exec"`, `"active"`, `"idle"`, `"working"`, `"crashed"`, `"blocked"`, `"done"`, `"killed"`, `"stopped"`, `"failed"`, `"resuming"`

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_guest_passes_visited` | Fired immediately on command entry (bundle.js:+12309252) |
| Telemetry — `tengu_config_parse_error` | Fired if the config file cannot be parsed (bundle.js:+3251872) |
| Telemetry — `tengu_config_lock_contention` | Fired if the config lock is slow (bundle.js:+3249297) |
| Telemetry — `tengu_config_stale_write` | Fired on stale write detection (bundle.js:+3249433) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when auth-loss guard activates (bundle.js:+3249776) |
| Telemetry — `tengu_bg_spare_enable` | Fired by background spare-worker subsystem (transitive, bundle.js:+15905783) |
| Telemetry — `tengu_bg_spare_claim` | Fired on spare-worker claim (transitive, bundle.js:+15905904) |
| Telemetry — `tengu_bg_spare_claim_fail` | Fired on spare-worker claim failure (transitive, bundle.js:+15906167) |
| Telemetry — `tengu_bg_dispatch_low_mem` | Fired when memory headroom is low (transitive, bundle.js:+15905088) |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Fired on SIGKILL escalation of bg worker (transitive, bundle.js:+15904509) |
| Telemetry — `tengu_bg_sendclaim_failed` | Fired on failed daemon claim (transitive, bundle.js:+15885155) |
| Telemetry — `tengu_daemon_yield` | Fired when daemon yields to foreground (transitive, bundle.js:+15923216) |
| Telemetry — `tengu_daemon_control` | Fired on daemon start/stop control (transitive, bundle.js:+15940522) |
| Telemetry — `tengu_daemon_config_reload` | Fired on daemon config reload (transitive, bundle.js:+15918997) |
| Telemetry — `tengu_feature_ok` / `tengu_feature_bad` | Fired by feature-flag checker (transitive, bundle.js:+966587 / +966650) |
| Telemetry — `api_bootstrap_fetch` | Fired by bootstrap network layer (transitive, bundle.js:+15504434) |
| Telemetry — `tengu_bg_low_mem_mb` | Fired when macOS low-memory threshold is crossed (transitive, bundle.js:+12883180) |
| Hook registration | `Y9` registers a cleanup hook via `tYA.register` (bundle.js:+59405) during file-watch setup |
| File system | Config file is read (not written) during `/passes` invocation; backup directory resolved but not written |
| appState changes | None directly; session state is read-only for this command |
| Sound | None |
| JSX render | Returns a React element (`bqA.createElement`) for the passes panel (bundle.js:+12309301) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.161 | Initial analysis |

---

## Common Mistakes

1. **Expecting a model response**: `/passes` is a `local-jsx` command; it renders UI directly and does not send any prompt to the Claude model. No assistant turn is generated.
2. **Running in non-interactive / piped mode**: Because the command renders a JSX component, it requires an interactive terminal. Invoking it in a headless or scripted context will produce no visible output.
3. **Confusing with a billing command**: `/passes` manages *guest passes* for friends, not the user's own subscription or billing. It cannot be used to extend or modify the invoking user's own plan.
4. **Assuming instant availability**: The command calls the authenticated API layer; if credentials (`ANTHROPIC_API_KEY`, OAuth token, etc.) are absent or expired, the session builder will throw before the UI is shown.
5. **Expecting config writes**: The command reads configuration state but does not write it. Auth-loss guards and lock telemetry visible in the call graph are inherited from shared config infrastructure, not triggered by this command's happy path.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `BTf` | Top-level passes command handler (AsyncFunction; Arbor-resolved entry point) |
| `y6` | Session state resolver (reads config + app state, starts file watch) |
| `F6` | Config accessor / file reader utility |
| `Dj_` | Config-change dispatcher / watcher registration |
| `nDH` | Config file parser and backup manager |
| `Ox` | Config-ID prefix checker (startsWith / slice) |
| `H` | Bootstrap HTTP fetch function |
| `m6` | JSON parse wrapper |
| `rcq` | Backup path resolver (uses `"backups"` directory) |
| `Xj_` | Path join helper for backup directory construction |
| `M` | Temp-file/backup set manager (has/add/rm) |
| `$` | Symlink-path resolver helper |
| `N` | HTTP request builder and header assembler |
| `VBK` | Request options constructor |
| `SH` | JSON serialiser wrapper (`JSON.stringify`) |
| `Z4` | HTTP response body processor |
| `imH` | Response parse-error handler |
| `IBK` | Multipart / byte-length body builder |
| `v8` | Error type classifier |
| `d` | Logger / debug output sink |
| `w` | Background worker manager / dispatcher |
| `A` | Worker registry map |
| `S` | Worker process wrapper |
| `RH` | Feature-flag "bad" reporter |
| `hH` | Feature-flag "ok" reporter |
| `ER8` | Platform memory headroom calculator |
| `rj6` | Background session roster file reader |
| `yH` | Background session lifecycle event emitter |
| `B` | Settled-promise retirer for worker slots |
| `j6` | Background session enqueue / dispatch function |
| `DOA` | Daemon claim-and-connect handler |
| `XOA` | Background worker execution wrapper |
| `L` | Pending-task set (add/delete/finally wrappers) |
| `Y` | Forced shutdown / process.exit handler |
| `C` | Rate-limit event enqueuer |
| `bXL` | File-watch cycle manager (watchFile / unwatchFile) |
| `er` | Watch-cycle error handler |
| `Y9` | Cleanup-hook registrar (`tYA.register`) |
| `Qy8` | Guest pass info fetcher (calls authenticated API) |
| `zL` | Authenticated API client factory |
| `KD` | Session / connection builder |
| `eK` | OAuth token resolver |
| `Sj` | Auth profile assembler |
| `pM` | First-party client constructor |
| `jj` | Auth header injector |
| `e3` | Full session builder with fallback and error path |
| `dD6` | Transient session sub-builder |
| `TdH` | Session-type selector |
| `W8` | Config read-write lock manager (top level) |
| `Pj_` | Locked config writer with backup rotation |
| `qjq` | Config merge/assign helper |
| `Y7_` | Config schema validator |
| `iY6` | Auth presence validator |
| `V` | Locked-write state tracker |
| `X` | Terminal / editor input component |
| `J` | Worker-process list accessor |
| `j` | Worker kill dispatcher |
| `z` | Daemon stop controller |
| `D` | Daemon config reload manager |
| `h` | Scroll/viewport position tracker |
| `lfA` | Vim-mode key-handler dispatcher |
| `Z` | Config backup slice manager |
| `Y56` | Atomic file write helper (temp → rename) |
| `O` | Symbolic-link stat checker |
| `k8` | Error code wrapper |
| `f` | File handle / stream abstraction |
| `McH` | Config cache accessor |
| `icq` | Config entry enumerator (`Object.entries`) |
| `$cH` | Config timestamp recorder (`Date.now`) |
| `Jj_` | Global config fallback writer |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.