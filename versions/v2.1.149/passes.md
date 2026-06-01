---
type: feature-spec
feature: "passes"
cc_version: "2.1.149"
updated: "2026-06-01"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.149 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.149 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.149

---

## Overview

The `/passes` command allows Claude Code users to share a free week of Claude Code access ("guest passes") with friends. It is implemented as a `local-jsx` command, meaning it renders a React JSX component directly in the terminal UI rather than delegating to the agent loop. The command fires a `tengu_guest_passes_visited` telemetry event when the user visits it.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| loc_byte | `12048594` |
| loc_byte_end | `12048916` |
| loc_line | `9758` |
| isHidden | `null` (not hidden) |
| module_id | `_m1` |
| load_inline | `true` |
| arbor_handler.name | `fH5` |
| arbor_handler.fqn | `claude-2.1.149::fH5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.149 bundle.js:+12048594

---

## Input Branching

The `/passes` command is a `local-jsx` type — it renders a UI component rather than processing free-form textual input from the user. The handler (`fH5`) follows a linear initialization path: emit telemetry, load configuration state, then render a JSX element. There are no distinct user-input branches to diagram.

```
1. User invokes /passes
2. Handler fH5 begins execution (AsyncFunction)
3. Emit telemetry: tengu_guest_passes_visited
4. Load configuration / auth state via configLoader (f8) and sessionInfo (EE8)
5. Render JSX element via Co_.createElement to display the guest-pass UI
6. Return rendered component to the CLI shell
```

---

## Behavioral Spec

### Main Handler — `passesCommandHandler` (`fH5`)

Analysis basis: CC v2.1.149 bundle.js:+12048277

```
async function passesCommandHandler(context):
    # Step 1 — record visit
    emit telemetry event "tengu_guest_passes_visited"

    # Step 2 — load session / auth state
    sessionData  = await loadSessionInfo(context)       # EE8 → R5, m6
    configState  = await loadConfigWithLock(context)    # f8 → $f_, JOH, ff_

    # Step 3 — obtain current user context
    userContext  = buildUserContext(configState)         # c

    # Step 4 — render JSX guest-pass UI
    element = Co_.createElement(GuestPassComponent, {
        session: sessionData,
        config:  configState,
        user:    userContext,
    })

    return element
```

Analysis basis: CC v2.1.149 bundle.js:+12048311 – +12048466

---

### Config Load with Lock — `loadConfigWithLock` (`f8`)

The config subsystem is reached via the call chain `fH5 → f8 → $f_`. It acquires a file-system lock before reading `~/.claude.json`, applies backup rotation, and resolves the current config state.

```
async function loadConfigWithLock():
    # Acquire filesystem lock; emit tengu_config_lock_contention if slow
    lock = acquireLock()                         # $f_

    try:
        raw = fs.statSync(configPath)            # L.statSync
        entries = fs.readdirStringSync(dir)      # L.readdirStringSync

        # Filter backup files (contain ".backup." in name)
        backups = entries.filter(name => name.includes(".backup."))

        # Keep at most 5 backups; unlink oldest
        if backups.length > 5:
            fs.unlinkSync(oldest)                # L.unlinkSync

        # Read and parse config
        raw = fs.readFileSync(configPath, "utf-8")   # JOH → q.readFileSync
        parsed = JSON.parse(raw)                     # g6

        # Guard: refuse write if re-read config is missing auth that cache has
        # (protection against GH #3117 data loss)
        if cacheHasAuth and not parsedHasAuth:
            emit telemetry "tengu_config_auth_loss_prevented"
            log warning "saveConfigWithLock: re-read config is missing auth…"

        # Atomically write via temp file + rename
        tempPath = generateTempPath(randomBytes(6), "hex")   # UK6, sQ8.randomBytes
        fs.writeFileSync(tempPath, newContent)               # Df.writeFileSync
        fs.fchmodSync(tempPath, 384)                         # permissions 0o600
        fs.fsyncSync(tempFd)
        fs.renameSync(tempPath, configPath)                  # q.renameSync

        emit telemetry "tengu_config_stale_write" (if stale)

    finally:
        releaseLock(lock)
```

Backup subdirectory name constant: `"backups"` (bundle.js:+3195222)  
Maximum backup count: `5` (bundle.js:+3194640)  
Config file permissions (octal): `0o600` → decimal `384` (bundle.js:+3194922)  
Lock contention warning text: `"Lock acquisition took longer than expected…"` (bundle.js:+3193621)

---

### Session Info Loader — `loadSessionInfo` (`EE8`)

```
async function loadSessionInfo(context):
    authConfig = loadAuthConfig(context)    # R5 → dD
    sessionRef = loadSessionModule(context) # R5 → m6

    # Validate API credentials
    if not authConfig.hasValidCredentials():
        throw Error("ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN env var is required")
        # literal: bundle.js:+2933984

    return { authConfig, sessionRef }
```

Analysis basis: CC v2.1.149 bundle.js:+12048311

---

### Auth Configuration Loader — `authConfigLoader` (`dD`)

```
function authConfigLoader():
    base     = buildBaseConfig()        # K4
    extended = buildExtendedConfig()    # ev → Wc6, O1H, HN
    origin   = resolveOrigin()          # yO → RA (firstParty check, literal: "firstParty" +2035828)
    helpers  = loadApiKeyHelpers()      # hJ
    session  = buildSessionConfig()     # e$
    return mergeConfigs(base, extended, origin, helpers, session)
```

Analysis basis: CC v2.1.149 bundle.js:+2949907

---

### Config File Path Resolution — `resolveConfigPath` (`Of_`)

```
function resolveConfigPath(baseName):
    dir  = path.join(homeDir, ".claude")    # iY.join
    stat = fs.statSync(dir)                 # i8
    return path.join(dir, baseName)
```

Analysis basis: CC v2.1.149 bundle.js:+3195209

---

### Config State Classification — `classifyConfigState` (`f8` / `ub9`)

When building the guest-pass UI, the handler inspects current configuration state. The literals indicate the following discrete states are enumerated (bundle.js:+3191351–+3191578):

| Numeric Code | String Label | Meaning |
|---|---|---|
| `0` | `"unknown"` | State cannot be determined |
| — | `"local"` | Local config present |
| — | `"migrated"` | Config migrated from older format |
| — | `"native"` | Native credential store in use |
| — | `"installed"` | Extension/tool installed |
| `1` | `"disabled"` | Feature disabled |
| — | `"enabled"` | Feature enabled |
| — | `"no_permissions"` | Insufficient permissions |
| — | `"not_configured"` | Not yet configured |
| — | `"global"` | Global (user-level) config active |

Analysis basis: CC v2.1.149 bundle.js:+3191351 – +3191578

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_guest_passes_visited` | Fired immediately when the user opens `/passes` (bundle.js:+12048417) |
| Telemetry — `tengu_config_lock_contention` | Fired if config lock acquisition is slow (bundle.js:+3193710) |
| Telemetry — `tengu_config_stale_write` | Fired if a stale config write is detected (bundle.js:+3193846) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a write is refused to prevent auth data loss (bundle.js:+3194189) |
| Telemetry — `tengu_config_parse_error` | Fired on JSON parse failure in config read path (bundle.js:+3196285) |
| Telemetry — `tengu_feature_ok` / `tengu_feature_bad` | Feature flag evaluation outcomes (bundle.js:+963421 / +963479) |
| Config file write | Atomically updates `~/.claude.json` via temp-file + rename pattern; permissions set to `0o600` |
| Config backup rotation | Keeps up to `5` backup files in the `backups/` subdirectory; prunes oldest beyond limit |
| JSX rendering | Produces a React element via `Co_.createElement`; displayed inline in the CLI TUI |
| appState changes | Config state is read; no direct appState mutation observed in depth-2 traversal |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | `a9` calls `W7A.register` (bundle.js:+58272) — a file-watch hook registration in the config watch path |

---

## Version History

| Version | Change |
|---|---|
| v2.1.149 | Initial analysis |

---

## Common Mistakes

1. **Expecting agent output**: `/passes` is a `local-jsx` command. It renders a React component directly in the TUI; it does not invoke the AI agent loop or produce conversational output.
2. **Assuming passes are unlimited**: The command name indicates a "free week" entitlement per pass. The UI component (not the handler itself) is responsible for displaying available pass counts and redemption links — check the rendered component's props for live availability.
3. **Ignoring auth pre-conditions**: The handler traverses the full auth-config loader chain (`dD`, `e$`). If no valid `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` is present, the auth loader will throw before the UI is rendered.
4. **Config write race conditions**: The config subsystem uses a file lock. Running multiple Claude Code instances concurrently may trigger `tengu_config_lock_contention`. The `saveConfigWithLock` guard (GH #3117) will silently refuse a write that would erase cached auth data.
5. **Backup directory confusion**: The path helper `resolveConfigPath` places backups under `~/.claude/backups/`. Files containing `".backup."` in their name are subject to automatic pruning beyond 5 entries.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `fH5` | Main handler — `passesCommandHandler` (AsyncFunction) |
| `m6` | Session/config module loader |
| `Q6` | Config path helper / base path resolver |
| `Af_` | Config initialization utility |
| `JOH` | Config file reader (reads raw JSON, handles ENOENT/backups) |
| `q` | Filesystem abstraction (readFileSync, statSync, etc.) |
| `g6` | JSON parser wrapper |
| `xC` | String prefix/slice utility |
| `H` | General-purpose utility / random / timer helper |
| `_` | Filesystem utility (readdirStringSync, statSync, toUpperCase, filter) |
| `K8` | Logging / error reporting helper |
| `mb9` | Backup directory scanner |
| `Of_` | Config path resolver (joins home dir + `.claude`) |
| `f` | MCP / feature-flag map accessor |
| `$` | Feature-flag / config map utility |
| `N` | Network/HTTP request dispatcher |
| `MVK` | HTTP request builder |
| `CH` | JSON.stringify wrapper |
| `X4` | URL / string replacement helper |
| `HbH` | Response body parser |
| `OVK` | HTTP send helper (Buffer.byteLength, bind, then) |
| `c` | General async/callback utility |
| `w` | Background-session / daemon manager |
| `A` | Process / session map |
| `C` | Background worker process wrapper |
| `uH` | Callback utility (on success) |
| `bH` | Callback utility (on error) |
| `Kv8` | Memory / platform check helper |
| `Oz6` | Background config file reader (readFile + JSON) |
| `RH` | Error log dispatcher |
| `g` | Session retirement / filter helper |
| `V6` | Session dispatch / routing helper |
| `yqA` | Background session connection handler |
| `uqA` | Background session lifecycle manager |
| `L` | Session task queue / promise tracker |
| `D` | Daemon supervisor / health-check loop |
| `S` | Disposable resource handle |
| `Et4` | File-watch config listener |
| `rn` | Config change notifier |
| `a9` | File-watch hook registrar |
| `EE8` | Session info loader (auth + session) |
| `R5` | Auth + session module combiner |
| `dD` | Auth config loader |
| `K4` | Base config builder |
| `ev` | Extended config builder |
| `yO` | Origin resolver (firstParty check) |
| `hJ` | API key helper loader |
| `e$` | Session config builder |
| `O1H` | Credential provider helper |
| `f8` | Config-with-lock loader |
| `$f_` | Atomic config write handler (lock + backup + rename) |
| `_L9` | Config object assignment utility |
| `A__` | Config merge helper |
| `f$6` | Config field extractor |
| `V` | Config version string handler |
| `P` | MCP / plugin runner |
| `wh8` | Plugin initialization helper |
| `c_` | Error string coercer |
| `Z` | Config slice / trim helper |
| `UK6` | Atomic file write utility (temp + rename + fsync) |
| `O` | Symlink / lstat resolver |
| `j8` | File descriptor utility |
| `M` | Socket / stream handle |
| `OFH` | Output format helper |
| `ub9` | Config state enumerator (Object.entries over state map) |
| `zFH` | Timestamp utility (Date.now wrapper) |
| `ff_` | Config directory writer (dirname + mkdir + write) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.