---
type: feature-spec
feature: "passes"
cc_version: "2.1.144"
updated: "2026-06-01"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.144 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.144 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.144

---

## Overview

The `/passes` command surfaces a UI for sharing free "guest pass" weeks of Claude Code with friends. It is implemented as a `local-jsx` command, meaning the handler renders a JSX component directly in the terminal UI rather than sending a prompt to the model. Invoking the command fires a telemetry event (`tengu_guest_passes_visited`) and renders the passes interface via React elements.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | Share a free week of Claude Code with friends |
| loc_byte | `11453771` |
| loc_byte_end | `11454093` |
| loc_line | `6995` |
| isHidden | `null` (not hidden) |
| module_id | `mWq` |
| load_inline | `true` |
| arbor_handler.name | `Ak7` |
| arbor_handler.fqn | `claude-2.1.144::Ak7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.144 bundle.js:+11453771

---

## Input Branching

The command has a simple linear flow with no meaningful user-input branches — it accepts no arguments and directly renders a JSX component. A numbered pseudocode representation is appropriate.

1. User invokes `/passes` in the CLI.
2. The CLI resolves the `local-jsx` registration and calls the async handler (`Ak7`, resolved via `module_id → mWq`).
3. The handler fires the `tengu_guest_passes_visited` telemetry event.
4. The handler calls the config-reading/session utilities (`y6`, `Qj8`, `t6`) to gather any prerequisite session/config state.
5. The handler invokes `QB_.createElement` to build a JSX tree representing the guest-pass sharing UI.
6. The rendered component is returned to the CLI shell for display.

---

## Behavioral Spec

### Main Handler — Guest Passes Entry Point

Analysis basis: CC v2.1.144 bundle.js:+11453454

```
async function guestPassesHandler(context):
    # Fire telemetry immediately on entry
    emitTelemetry("tengu_guest_passes_visited")

    # Gather current session state
    sessionInfo  = readSessionConfig(context)       # calls configReader (y6)
    passesState  = loadPassesModule(context)        # calls passesLoader (Qj8)
    sessionCtx   = resolveSessionContext(context)   # calls sessionContextResolver (t6)

    # Build and return the JSX UI element
    uiElement = createElement(GuestPassesComponent, {
        session: sessionInfo,
        passes:  passesState,
        ctx:     sessionCtx
    })
    return uiElement
```

### Config Reader — Session State Acquisition

Analysis basis: CC v2.1.144 bundle.js:+3163715

```
function readSessionConfig(context):
    # Reads current config, checks timestamps, sets up file-watch
    now = Date.now()
    watchConfigFile(configPath, onChange)   # xr6.watchFile
    config = loadRawConfig()               # m6 / C0
    token  = resolveAuthToken(config)      # TR (strips prefix, slices)
    if config stale or missing:
        refreshConfig()
    return { config, token, timestamp: now }
```

### Config File Loader — Low-Level Read

Analysis basis: CC v2.1.144 bundle.js:+3166825

```
function loadConfigFromDisk(configPath):
    if configPath not yet accessible:
        throw Error("Config accessed before allowed.")   # literal at +3166831

    raw  = fs.readFileSync(configPath, "utf-8")          # literal "utf-8" at +3166914
    data = JSON.parse(raw)                               # b6 → JSON.parse

    prefix = resolvePrefix(data)                         # TR: H.startsWith / H.slice
    dirs   = resolveBackupDirs(configPath)               # GV1 → "backups" literal +3166399

    if ENOENT error:                                     # literal "ENOENT" at +3167061
        handle missing file gracefully
    return data
```

### Passes Module Loader

Analysis basis: CC v2.1.144 bundle.js:+11113888

```
function loadPassesModule(context):
    # Resolves passes data via the feature-flag / passes sub-module (f5, KJ)
    authCtx = resolveAuthContext()         # KJ → $I → uB6, SK, xH
    apiAuth = getApiKeyOrOAuthToken()      # n$ checks ANTHROPIC_API_KEY
    if no auth:
        # Literal: "ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN env var is required"
        #          at +2914674
        throw AuthError
    session = buildPassesSession(authCtx)  # Lz → JA ("firstParty" at +2022280)
    return session
```

### Session Context Resolver

Analysis basis: CC v2.1.144 bundle.js:+3161889

```
function resolveSessionContext(context):
    # Orchestrates config save/lock, backup rotation, daemon coordination
    configDir = path.dirname(configPath)          # K9_ → fY.dirname
    ensureDir(configDir)                          # L.mkdirSync
    timestamp = Date.now()

    # Determine installation type from literals
    # Possible values: "unknown", "local", "migrated", "native",
    #                  "installed", "disabled", "enabled",
    #                  "no_permissions", "global", "not_configured"
    #                  (all at +3162528–+3162755)
    installType = detectInstallType(config)

    lockResult = acquireConfigLock()
    if lock contention detected:
        emitTelemetry("tengu_config_lock_contention")
        # Warning: "Lock acquisition took longer than expected …" at +3164798

    savedConfig = saveConfigWithLock(config, lockResult)
    if savedConfig missing auth that cache has:
        emitTelemetry("tengu_config_auth_loss_prevented")
        # Refuse write — safety guard per GH #3117 (literal at +3165214)

    backups = rotateBackups(configDir, maxBackups=5)   # literal 5 at +3165817
    return { installType, timestamp, backups }
```

### Backup Rotation Sub-routine

Analysis basis: CC v2.1.144 bundle.js:+3166432

```
function resolveBackupDirectory(configPath):
    base    = path.basename(configPath)       # fY.basename
    backDir = path.join(configDir, "backups") # literal "backups" at +3166399
    entries = fs.readdirStringSync(backDir)

    for entry in entries:
        if not entry.startsWith(prefix):
            continue
        fullPath = path.join(backDir, entry)
        stat     = fs.statSync(fullPath)
        # filter by mtime, keep newest 5
    return backDir
```

### Atomic Config Write

Analysis basis: CC v2.1.144 bundle.js:+1000753

```
function atomicConfigWrite(targetPath, data, mode=384):
    # mode 384 = 0o600 (literal at +3166099)
    tmpPath = targetPath + "." + randomHex(6) + ".tmp"   # Ju8.randomBytes, 6 bytes, "hex"
    fd      = fs.openSync(tmpPath, flags)
    fs.writeFileSync(tmpPath, serialize(data))
    fs.fchmodSync(fd, mode)
    fs.fsyncSync(fd)
    fs.closeSync(fd)
    fs.renameSync(tmpPath, targetPath)
    if error in [ELOOP, ENOTDIR]:                        # literals at +1001126, +1001139
        cleanup(tmpPath)
        raise
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_guest_passes_visited` | Fired on every invocation of `/passes` (bundle.js:+11453594) |
| Telemetry — `tengu_config_parse_error` | Fired if config JSON cannot be parsed (bundle.js:+3167468) |
| Telemetry — `tengu_config_lock_contention` | Fired when config lock takes unexpectedly long (bundle.js:+3164887) |
| Telemetry — `tengu_config_stale_write` | Fired when a stale config write is detected (bundle.js:+3165023) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a write that would erase cached auth is refused (bundle.js:+3165366) |
| Telemetry — `tengu_feature_ok` / `tengu_feature_bad` | Feature-flag probe result (bundle.js:+955520, +955578) |
| Telemetry — `tengu_bg_*` family | Background/daemon lifecycle events emitted by session-context utilities; not directly user-visible from `/passes` but reached via depth-2 call graph |
| Hook registration | `h1 → OHA.register` — registers a cleanup/teardown hook during session setup (bundle.js:+57049) |
| File-system side effects | Config file read, optional backup directory creation under `backups/`, atomic temp-file write with `fchmod`/`fsync`/`rename` |
| appState changes | Session config may be updated (auth token, install type); JSX element returned to shell for rendering |
| Sound | None observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.144 | Initial analysis |

---

## Common Mistakes

1. **Expecting model output**: `/passes` is a `local-jsx` command — it renders a UI component, not a model response. Passing a query argument has no effect.
2. **Calling without authentication**: The passes loader (`Qj8 → f5 → KJ → n$`) requires either `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` to be set; without one the command will surface an auth error before the UI is shown.
3. **Concurrent Claude instances and config lock**: If multiple Claude Code instances are running simultaneously, config lock contention (`tengu_config_lock_contention`) can delay the command; only one instance should manage the config at a time.
4. **Mistaking backup artifacts**: The command's session-context setup may create files under `~/.claude/backups/`; these are internal rotation backups, not user-facing outputs of `/passes`.
5. **Expecting `/passes` to re-emit telemetry silently**: Every visit fires `tengu_guest_passes_visited`, which is sent even if the user immediately dismisses the UI.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Ak7` | Main async handler for `/passes` (guestPassesHandler) |
| `y6` | Session/config reader (readSessionConfig) |
| `m6` | Raw config loader primitive |
| `t1_` | Auth token helper |
| `V$H` | Config-from-disk loader (loadConfigFromDisk) |
| `q` | Filesystem utilities namespace (fs-like) |
| `b6` | JSON parse wrapper |
| `TR` | Auth-token prefix resolver (startsWith / slice) |
| `H` | String/identifier utility |
| `_` | General filesystem/utility namespace |
| `A8` | App-state accessor |
| `GV1` | Backup directory resolver |
| `L9_` | Config directory path builder |
| `M` | MCP / module registry |
| `$` | Secondary module/utility namespace |
| `v` | API request builder / message formatter |
| `vfK` | Request builder sub-utility |
| `CH` | JSON stringify wrapper |
| `x4` | Content formatter / redactor |
| `YhH` | Header builder |
| `yfK` | File-context builder (dirname, byteLength, etc.) |
| `kH` | Logger / error reporter |
| `b_` | Error wrapper |
| `xH` | String coercion helper |
| `Aq` | Traffic-class resolver ("essential-traffic") |
| `bkK` | Queue rotation helper (shift/push) |
| `d` | Display/render primitive |
| `w` | Subprocess/daemon manager |
| `A` | Model/session map |
| `C` | Subprocess controller (kill, write) |
| `bH` | Feature-bad reporter |
| `RH` | Feature-ok reporter |
| `fT6` | Memory/platform check (macOS, 1024 MB) |
| `x` | Daemon idle-exit timer |
| `P6` | Config watcher / event emitter |
| `Ea_` | Daemon connection manager (spawn, claim, connect) |
| `ka_` | Background session lifecycle manager |
| `L` | Background session lifecycle manager (alias) |
| `D` | Spare-daemon reaper |
| `h` | Timer handle |
| `fCL` | File-watch config monitor |
| `Rl` | Render/update callback |
| `h1` | Hook registrar (OHA.register) |
| `Qj8` | Passes module loader |
| `f5` | Passes session bootstrap |
| `KJ` | Auth-context orchestrator |
| `SK` | Auth string coercion |
| `$I` | OAuth/API key resolver |
| `Lz` | First-party auth resolver |
| `cJ` | Credential cache |
| `n$` | Auth requirements checker (ANTHROPIC_API_KEY) |
| `J1H` | Token validator |
| `t6` | Session context resolver |
| `K9_` | Config save-with-lock / backup rotation |
| `UH1` | Config object merge helper |
| `Yo8` | Config schema validator |
| `w56` | Config write helper |
| `V` | Directory entry filter |
| `P` | MCP server connection pool |
| `bE8` | MCP transport builder |
| `Z` | Backup entry list |
| `aA6` | Atomic file writer |
| `O` | Symlink/stat checker |
| `O8` | App-state error handler |
| `f` | Socket/stream handle |
| `PpH` | Platform path helper |
| `WV1` | Object-entries iterator wrapper |
| `WpH` | Timestamp-based change detector |
| `q9_` | Config directory atomic write helper |

---

_Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js._