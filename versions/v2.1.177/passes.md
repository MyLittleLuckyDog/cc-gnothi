---
type: feature-spec
feature: "passes"
cc_version: "2.1.177"
updated: "2026-06-13"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.177 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.177 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.177

---

## Overview

The `/passes` command allows a Claude Code user to share a free week of Claude Code access with friends via a guest-pass mechanism. The command renders a JSX-based UI component (`local-jsx` type) and emits a dedicated telemetry event (`tengu_guest_passes_visited`) immediately upon invocation. Its handler (`btL`) is an async function resolved through the `EwK` module.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| module_id | `EwK` |
| load_inline | `true` |
| isHidden | `null` (not hidden) |
| loc_byte | `12776827` |
| loc_byte_end | `12777149` |
| loc_line | `8932` |
| arbor_handler.name | `btL` |
| arbor_handler.fqn | `claude-2.1.177::btL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.177 bundle.js:+12776827

---

## Input Branching

The command flow is linear on invocation (no user-input branches are visible at depth ≤ 2). The handler fires, logs telemetry, fetches configuration context, and returns a JSX element. A simple numbered pseudocode is therefore appropriate.

1. User types `/passes` in the Claude Code REPL.
2. CLI resolves the command registration from module `EwK`, invoking the async handler `btL`.
3. Handler emits `tengu_guest_passes_visited` telemetry immediately.
4. Handler calls the configuration-access helper (`P8`) to obtain the current user config (global and project-level).
5. Handler calls the session-initialisation helper (`yF8`) to obtain the current session/app state context.
6. Handler constructs and returns a JSX element via `fDA.createElement`, rendering the passes UI to the terminal.

---

## Behavioral Spec

### Handler Invocation (`btL`)

```
async function passesCommandHandler(context):
    emit_telemetry("tengu_guest_passes_visited")

    configState  = await readConfig(context)          // P8
    sessionState = await initSessionContext(context)  // yF8

    uiElement = createElement(PassesComponent, {
        config:  configState,
        session: sessionState,
    })

    return uiElement
```

Analysis basis: CC v2.1.177 bundle.js:+12776510 (btL → R6), +12776544 (btL → yF8), +12776550 (btL → P8), +12776648 (btL → d / telemetry emission), +12776699 (btL → fDA.createElement)

### Configuration Loading (`P8`)

```
function readConfig(context):
    globalConfig  = loadGlobalConfigSync()            // uses MT, H (random/timeout internals)
    projectConfig = loadProjectConfig(context)        // G5H — reads from filesystem with utf-8 encoding
    mergedConfig  = mergeConfigs(globalConfig, projectConfig)

    if configAccessedBeforeAllowed:
        throw Error("Config accessed before allowed.")  // literal at +3337588

    return mergedConfig
```

Config statuses tracked in the merged result include string tokens: `"unknown"`, `"local"`, `"migrated"`, `"native"`, `"installed"`, `"disabled"`, `"enabled"`, `"no_permissions"`, `"not_configured"`, `"global"`.

Analysis basis: CC v2.1.177 bundle.js:+3332401 (P8 → J38), +3332582 (P8 → G5H), +3337588 (Error literal), +3333025–3333252 (status-string literals)

### Session Context Initialisation (`yF8`)

```
function initSessionContext(context):
    appState = loadAppState()                   // of → sw → kO
    authInfo = resolveAuthentication(appState)  // kO checks ANTHROPIC_API_KEY, OAuth, apiKeyHelper
    return { appState, authInfo }
```

If no valid authentication credential is found (`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, WIF env vars), the helper raises an error with the literal message found at +3272859.

Analysis basis: CC v2.1.177 bundle.js:+12776544 (btL → yF8), +12391403 (yF8 → of), +3291776 (of → sw), +3270345 (sw → kO), +3272859 (auth-required literal)

### Project-Config File Helper (`G5H`)

```
function loadProjectConfigFile(configPath):
    if configPath not allowed yet:
        throw Error("Config accessed before allowed.")

    raw = fs.readFileSync(configPath, "utf-8")    // encoding literal at +3337671
    parsed = JSON.parse(raw)                       // via c6

    if parsed.code === "ENOENT":                   // literal at +3337818
        return defaultConfig()

    backupDir = path.join(configDir, "backups")    // literal at +3337156
    writeBackupIfNeeded(backupDir, parsed)

    return parsed
```

Analysis basis: CC v2.1.177 bundle.js:+3337582 (Error), +3337629 (Q6), +3337644 (readFileSync), +3337671 ("utf-8"), +3337691 (c6/JSON.parse), +3337818 ("ENOENT"), +3337156 ("backups")

### Config Save Guard (`J38`)

The config-save path (reached via `P8 → J38`) includes several safety checks before writing:

```
function saveConfigWithLock(configData):
    acquireLock()                                          // uses Date.now + mkdirSync
    if lockContentionDetected:
        emit_telemetry("tengu_config_lock_contention")    // +3335644

    reRead = readCurrentConfigFromDisk()
    if reRead is stale:
        emit_telemetry("tengu_config_stale_write")        // +3335780

    if reRead missing auth that cache has:
        emit_telemetry("tengu_config_auth_loss_prevented")
        // literal warning at +3335971:
        // "saveConfigWithLock: re-read config is missing auth…"
        return  // refuse to write

    atomicWrite(configData)                               // EY6 — uses randomBytes for temp filename,
                                                          // fchmodSync (mode 0o600 = 384 decimal, +3336856),
                                                          // fsyncSync, renameSync
```

Maximum backup copies retained: `5` (literal at +3336574).
The `.backup.` marker string is used to identify backup filenames (literal at +3336441).

Analysis basis: CC v2.1.177 bundle.js:+3335644, +3335780, +3335971, +3336123, +3336441, +3336574, +3336856

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_guest_passes_visited` emitted at +12776650 on every invocation |
| Telemetry — config lock | `tengu_config_lock_contention` (+3335644) if lock acquisition is slow |
| Telemetry — stale write | `tengu_config_stale_write` (+3335780) if on-disk config is ahead of cache |
| Telemetry — auth guard | `tengu_config_auth_loss_prevented` (+3336123) if write would erase cached auth |
| Telemetry — config parse error | `tengu_config_parse_error` (+3338219) if project config JSON is malformed |
| Telemetry — background (indirect) | Various `tengu_bg_*` events reached through the daemon/session layer (depth-2 traversal only; not directly caused by `/passes`) |
| Filesystem reads | Project config file read via `fs.readFileSync` (utf-8) |
| Filesystem writes | Config backup written to `<configDir>/backups/` directory; atomic config save via temp file + rename |
| Backup retention | Maximum 5 backup copies (literal +3336574) |
| Config file permissions | Mode `0o600` (384 decimal) applied to saved config files (+3336856) |
| JSX render | A React/JSX element is created via `fDA.createElement` and returned to the CLI renderer (+12776699) |
| appState changes | Session state is read (not mutated) during handler execution |
| Sound | None observed in depth-2 traversal |
| Hook registration | None observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.177 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/passes` before authentication is configured** — the session-context helper (`yF8 → kO`) will throw if none of `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, or the WIF env-var pair are present. Set at least one credential before running the command.
2. **Corrupted project config JSON** — if the `.claude.json` project config cannot be parsed, the handler emits `tengu_config_parse_error` and may return a degraded UI or abort. Validate JSON with `jq . .claude.json` before filing a bug.
3. **Race condition with another Claude instance** — the config-lock path emits `tengu_config_lock_contention` when lock acquisition takes longer than expected (literal at +3335555). Ensure only one Claude Code instance writes to the config directory at a time.
4. **Expecting a text response** — `/passes` is a `local-jsx` command; it renders a UI widget rather than producing a conversational reply. Running it in a non-interactive or piped context may yield no visible output.
5. **Confusing the backup directory** — backups are stored in `<configDir>/backups/` and identified by the `.backup.` filename marker. Do not manually delete these files while Claude Code is running; the rotation logic assumes the directory is intact.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `btL` | Main async handler for `/passes` command (Arbor-resolved, FQN: `claude-2.1.177::btL`) |
| `R6` | Config watch / file-change watcher orchestrator |
| `Q6` | Config path resolver utility |
| `NN_` | App-state accessor |
| `G5H` | Project config file loader (readFileSync + backup logic) |
| `q` | Node `fs` module wrapper (synchronous ops) |
| `p1` | CLI error-exit helper (calls `process.exit`) |
| `c6` | JSON-parse utility wrapper |
| `Jm` | String prefix/slice utility |
| `H` | Random/timeout utility (Math.random, setTimeout) |
| `_` | Filesystem read-dir + stat utility |
| `Z8` | Logger / structured-log emitter |
| `sK9` | Subdirectory scanner (readdirStringSync + path helpers) |
| `yN_` | Backup path resolver (path.join + fallback) |
| `M` | Module/feature registry map |
| `$` | Feature-flag resolver |
| `N` | Token/message formatter |
| `tff` | Formatting sub-helper (Vy, FH_, WyA) |
| `CH` | JSON.stringify wrapper |
| `xf` | String replacement / redaction helper (emits `"[REDACTED]"`) |
| `kQH` | Config key builder |
| `A4f` | Async file-write helper (Buffer.byteLength, al6.then chain) |
| `d` | Logging/debug sink |
| `D` | Background daemon process manager |
| `A` | Process/session map |
| `b` | Scheduled-task runner (Date.now, P.has/add, X.set) |
| `l8` | Timeout/abort controller helper |
| `bH` | Background session create handler |
| `IH` | Background session init helper |
| `Dd8` | macOS memory reporter (t6, $6) |
| `aSH` | Async file cleanup helper (cJ.lstat/rm/readFile) |
| `kH` | Log-error batch pusher |
| `Q` | Background PTY retire/reconnect manager |
| `$6` | Background spare-session enabler |
| `EVA` | Daemon socket claim + connect handler |
| `yVA` | Background job lifecycle manager (done/killed/stopped/failed states) |
| `f` | Promise-set tracker (q.add/delete/finally) |
| `Y` | Forced-shutdown helper (process.exit, z.abort) |
| `tH` | nM6 wrapper (low-level timer utility) |
| `B` | Disposable resource manager |
| `ng4` | Config file watcher (w38.watchFile / unwatchFile) |
| `Kg` | Config-watch debouncer |
| `m9` | Hook registrar (XyA.register) |
| `yF8` | Session context initialiser (of + R6 call chain) |
| `of` | App-state loader (sw + R6) |
| `sw` | Session wrapper orchestrator |
| `XL` | Bare-mode arg injector (`--bare` literal) |
| `Fj` | Auth-profile resolver (`profile-implicit`, `user_oauth`) |
| `rf` | First-party auth handler (`firstParty`) |
| `QP` | OAuth token provider |
| `kO` | Auth credential resolver (ANTHROPIC_API_KEY, apiKeyHelper, OAuth) |
| `L06` | LaH wrapper |
| `LaH` | Auth object constructor |
| `P8` | Global + project config loader (entry for config read path) |
| `J38` | Config atomic save with lock and backup rotation |
| `nI1` | Config object merge helper (Object.assign) |
| `aJ_` | Config initialiser (lI1 sub-helper) |
| `EaH` | Global config fallback writer |
| `V` | Config version string holder |
| `P` | IPC/daemon message framer (Buffer.concat, X.indexOf) |
| `X` | Socket timeout manager |
| `j` | Session kill orchestrator (A.values, S.kill) |
| `mL` | Message stream terminator (H.end, CH) |
| `jI5` | Full daemon IPC dispatch handler |
| `TH` | String coercion utility |
| `E` | Session slice/clamp helper (Math.max, Math.min) |
| `W` | SDK connection manager (SR, Dh, Promise.all, kH) |
| `EY6` | Atomic file write utility (randomBytes temp name, fchmodSync, fsyncSync, renameSync) |
| `O` | Background-session descriptor |
| `C8` | Log-level formatter (Z8) |
| `L` | File descriptor close wrapper |
| `zXH` | Config schema validator |
| `aK9` | Config entries iterator (Object.entries) |
| `h06` | Config timestamp helper (Date.now) |
| `j38` | Config project-file sub-save helper (EY6) |