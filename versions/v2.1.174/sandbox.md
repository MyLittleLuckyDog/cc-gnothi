---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.174"
updated: "2026-06-12"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.174 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.174 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.174

---

## Overview

The `/sandbox` command configures the sandboxing (process-isolation) environment for Claude Code's tool execution. It validates platform support, checks for policy locks, and — when invoked with the `exclude` sub-command — parses and persists a command-pattern exclusion rule to `.claude/settings.local.json`. When invoked without arguments it opens the interactive sandbox configuration UI.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `sandbox` |
| description | ` ...   ...  (⏎ to configure)` |
| argumentHint | `exclude "command pattern"` |
| immediate | `true` |
| isHidden | `null` |
| module_id | `FzK` |
| load_inline | `true` |
| loc_byte | `12897310` |
| loc_byte_end | `12897959` |
| loc_line | `9137` |
| arbor_handler.name | `No7` |
| arbor_handler.fqn | `claude-2.1.174::No7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.174 bundle.js:+12897310

---

## Input Branching

The handler has 5+ distinct branches driven by platform checks, policy locks, and the presence/shape of the `exclude` sub-command argument.

```mermaid
flowchart TD
    A(["/sandbox invoked"]) --> B{Platform check\nmA.isSupportedPlatform}
    B -- "WSL1 detected" --> C["Error: Sandboxing requires WSL2.\nWSL1 is not supported.\n(bundle.js:+12896002)"]
    B -- "Unsupported OS" --> D["Error: Sandboxing is currently only\nsupported on macOS, Linux, and WSL2.\n(bundle.js:+12896060)"]
    B -- "Supported" --> E{mA.checkDependencies}
    E -- "Missing deps" --> F["Render error via IA\n(foreground display)\n(bundle.js:+12896137)"]
    E -- "OK" --> G{mA.isPlatformInEnabledList}
    G -- "Not enabled" --> H["Render info/config UI via H\n(bundle.js:+12896161)"]
    G -- "Enabled" --> I{mA.areSandboxSettingsLockedByPolicy}
    I -- "Locked" --> J["Error: Sandbox settings are overridden\nby a higher-priority configuration\n(bundle.js:+12896425)"]
    I -- "Not locked" --> K{args split: first token == 'exclude'?\n(bundle.js:+12896652)}
    K -- "No args / other" --> L["Open interactive config UI\n(bundle.js:+12896161)"]
    K -- "'exclude' token present" --> M{pattern token present?\n(bundle.js:+12896700)}
    M -- "Missing" --> N["Error: Please provide a command\npattern to exclude\n(bundle.js:+12896737)"]
    M -- "Pattern supplied" --> O["Resolve settings path\n.claude/settings.local.json\n(bundle.js:+12896943)"]
    O --> P["Call WC_ to load & merge localSettings\n(bundle.js:+12896885)"]
    P --> Q["Call u3 / xB to write updated\nexclude rule via addRules\n(bundle.js:+12896898)"]
    Q --> R["Emit tengu telemetry:\nsandbox_exclude_command\n(bundle.js:+4705132)"]
    R --> S(["Return — rule persisted"])
```

---

## Behavioral Spec

### 1. Entry Point — Handler `No7` (sandboxCommandHandler)

```
async function sandboxCommandHandler(args, context):

    # Step 1: Theme/display context
    theme = getThemeContext()            # dA (bundle.js:+12895929)
    appConfig = getAppConfig()          # a6 (bundle.js:+12895951)

    # Step 2: Platform validation
    if not sandboxPlatform.isSupportedPlatform():
        wslVersion = detectWSLVersion()
        if wslVersion == "wsl" and wslVersion != "wsl2":
            renderError("Error: Sandboxing requires WSL2. WSL1 is not supported.")
            # bundle.js:+12896002
            return
        renderError("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")
        # bundle.js:+12896060
        return

    # Step 3: Dependency check
    depResult = sandboxPlatform.checkDependencies()  # bundle.js:+12896177
    if depResult.level == "error":
        renderColorizedMessage(depResult, theme)     # IA → gJH, bundle.js:+12896137
        return

    # Step 4: Enabled-list check
    if not sandboxPlatform.isPlatformInEnabledList(): # bundle.js:+12896204
        renderConfigUI(appConfig)                    # H, bundle.js:+12896161
        return

    # Step 5: Policy lock check
    if sandboxPlatform.areSandboxSettingsLockedByPolicy(): # bundle.js:+12896366
        renderError("Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally.")
        # bundle.js:+12896425
        return

    # Step 6: Argument dispatch
    tokens = args.split()                            # M.split, bundle.js:+12896652
    subCommand = tokens[0]

    if subCommand == "exclude":                      # bundle.js:+12896675
        pattern = tokens.slice(1).join(" ")          # bundle.js:+12896692 (offset 8 = len("exclude "))
        if not pattern:
            renderError('Error: Please provide a command pattern to exclude (e.g., /sandbox exclude "npm run test:*")')
            # bundle.js:+12896737
            return
        applyExcludeRule(pattern, context)
    else:
        openInteractiveSandboxConfig(appConfig)
```

Analysis basis: CC v2.1.174 bundle.js:+12895929 – +12896885

---

### 2. Exclude Rule Application — `applyExcludeRule`

```
async function applyExcludeRule(pattern, context):

    # Resolve target settings file
    settingsPath = ".claude/settings.local.json"    # bundle.js:+12896943

    # Load current local settings via WC_ (localSettingsLoader)
    localSettings = loadLocalSettings(settingsPath) # WC_ → C8 → ms6, bundle.js:+12896885

    # Filter and augment addRules list
    existing = localSettings.addRules ?? []         # bundle.js:+4704846
    updatedRules = filterDuplicates(existing)        # WC_ → _.filter, bundle.js:+4704823

    # Match / validate pattern
    if not patternMatchCheck(pattern):              # TqL → H.match, bundle.js:+4704997
        renderError("Invalid pattern")
        return

    # Write via settings writer (fA)
    updatedSettings = merge(localSettings, { addRules: [...updatedRules, pattern] })
    writeLocalSettings(settingsPath, updatedSettings)  # fA → la6 → XYH.writeFile, bundle.js:+1315834

    # Emit telemetry
    emitEvent("sandbox_exclude_command")            # bundle.js:+4705132

    # Visual feedback
    renderSuccess(pattern)                          # kH / CH, bundle.js:+4705129
```

Analysis basis: CC v2.1.174 bundle.js:+12896885

---

### 3. Platform Detection — `sandboxPlatformChecker`

```
function isSupportedPlatform():
    platform = mA.isSupportedPlatform()             # bundle.js:+12895960
    return platform

function checkWSLVersion(raw):
    if raw.startsWith("wsl"):                       # IA → H.startsWith, bundle.js:+3877444
        if raw == "wsl" (WSL1):
            return ERROR_WSL1                       # bundle.js:+12896002
    return OK

function checkDependencies():
    result = mA.checkDependencies()                 # bundle.js:+12896177
    if result.level == "error":                     # bundle.js:+12896140
        return DEPENDENCY_ERROR
    return OK
```

Analysis basis: CC v2.1.174 bundle.js:+12895960

---

### 4. Colorized Message Renderer — `colorizedMessageRenderer` (IA → gJH)

```
function renderColorizedMessage(message, theme):
    # theme is "light" (bundle.js:+12895941) or dark variant
    if message.startsWith("rgb("):                  # bundle.js:+3877457
        applyRgbColor(message)
    elif message.startsWith("ansi256("):            # bundle.js:+3877498
        applyAnsi256Color(message)
    elif message.startsWith("ansi:"):               # bundle.js:+3877524
        applyAnsiColor(message)
    else:
        # Named color dispatch (black, red, green, yellow, blue, magenta, cyan, white,
        # and Bright variants) via X6 color library
        # bundle.js:+3542062 through +3543168
        applyNamedColor(message)
    renderToForeground(message)                     # "foreground", bundle.js:+3877400
```

Analysis basis: CC v2.1.174 bundle.js:+3877444

---

### 5. Settings Loader — `localSettingsLoader` (WC_)

```
function loadLocalSettings(path):
    raw = fileSystemReadSync(path)                   # C8 → ms6, bundle.js:+4704752
    parsed = parseSettings(raw)                      # IVA → NQ6, bundle.js:+1297145
    filtered = parsed.filter(isValidRule)            # bundle.js:+4704823
    if parsed.includes(existingPattern):             # bundle.js:+4705036
        return DUPLICATE_SKIP
    return { localSettings: parsed }                 # "localSettings", bundle.js:+4704755
```

Analysis basis: CC v2.1.174 bundle.js:+4704752

---

### 6. MCP Connection Manager (reached via `M.split` → `HCH`)

The `M` context reachable from the handler includes the MCP subsystem (`HCH`) which manages server lifecycle, OAuth flows, and reconnection logic. Within the `/sandbox` command's execution context this is invoked to synchronize settings state — it is **not** directly user-facing but affects side effects:

- OAuth flow management: `nX8` → `H9H` spins up a local HTTP callback server on `127.0.0.1` with a `/callback` route (bundle.js:+6519628), timeout of 300 000 ms (bundle.js:+6521131), emitting `tengu_mcp_oauth_flow_start` / `tengu_mcp_oauth_flow_success` / `tengu_mcp_oauth_flow_error`.
- Connection reconnect logic: `Ei` emits `tengu_mcp_reconnect`, `tengu_mcp_reconnect_not_connected`, `tengu_mcp_reconnect_needs_auth_discovery`, `tengu_mcp_reconnect_failed`.
- Daemon supervisor: `w` (supervisor context) emits `tengu_daemon_config_reload` (bundle.js:+16873690).

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_mcp_oauth_flow_start` | Fired when MCP OAuth flow begins (bundle.js:+6516571) |
| Telemetry — `tengu_mcp_oauth_flow_success` | Fired on successful OAuth completion (bundle.js:+6521557) |
| Telemetry — `tengu_mcp_oauth_flow_error` | Fired on OAuth failure (bundle.js:+6523268) |
| Telemetry — `tengu_daemon_config_reload` | Fired when daemon reloads config (bundle.js:+16873690) |
| Telemetry — `tengu_mcp_skills` | Fired during MCP skill sync (bundle.js:+6623670) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a save would have dropped auth tokens (bundle.js:+3312009) |
| Telemetry — `tengu_feature_ok` | Generic feature success signal (bundle.js:+1016891) |
| Telemetry — `tengu_feature_bad` | Generic feature failure signal (bundle.js:+1016958) |
| Telemetry — `tengu_daemon_control` | Daemon start/stop control event (bundle.js:+16895373) |
| Telemetry — `tengu_feature_sad` | Generic feature warning signal (bundle.js:+1017039) |
| File write | `exclude` sub-command writes to `.claude/settings.local.json` (bundle.js:+12896943) |
| appState changes | Interactive config path updates sandbox-enabled state via `mA.isPlatformInEnabledList` result |
| MCP side effects | Settings reload can trigger MCP server reconnection cycles (`Ei`, `nX8`) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.174 | Initial analysis |

---

## Common Mistakes

1. **Omitting quotes around patterns with wildcards.** The `argumentHint` (`exclude "command pattern"`) requires the pattern to be quoted when it contains spaces or glob characters (e.g., `npm run test:*`). Unquoted patterns will be split and the parser will only see the first token.
2. **Running on WSL1.** The command hard-errors when WSL1 is detected; users must upgrade to WSL2 before sandbox features are available (bundle.js:+12896002).
3. **Trying to change settings under an enterprise policy lock.** When `areSandboxSettingsLockedByPolicy()` returns true, no local override is possible. The command will return an error without modifying any file (bundle.js:+12896425).
4. **Expecting `/sandbox exclude` to update a global or project config.** The exclusion rule is always written to `.claude/settings.local.json`, never to user-level or project-level settings (bundle.js:+12896943).
5. **Invoking `/sandbox` on Windows (non-WSL).** The platform support list covers macOS, Linux, and WSL2 only; native Windows is explicitly rejected (bundle.js:+12896060).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `No7` | Main async handler for `/sandbox` command (sandboxCommandHandler) |
| `IA` | Colorized terminal message renderer (foreground output) |
| `gJH` | Named-color dispatch utility (maps color names to X6 chalk-style calls) |
| `mA` | Sandbox platform capability object (isSupportedPlatform, checkDependencies, isPlatformInEnabledList, areSandboxSettingsLockedByPolicy) |
| `H` | UI/config renderer and spinner utility; also used for random/setTimeout scheduling |
| `M` | MCP settings state manager (split/slice/values/get) |
| `HCH` | MCP connection pool orchestrator |
| `Wi` | MCP server slot processor |
| `PV6` | MCP slot initializer |
| `Le` | MCP server connection lifecycle handler |
| `Zg` | MCP SDK-type server builder |
| `VX8` | MCP error/warning color renderer (red/yellow) |
| `JV6` | MCP connection cache manager (sse/http type routing) |
| `tV` | MCP transport validator |
| `Hw` | MCP transport helper (jAH/C6/fq) |
| `VB_` | MCP transport variant builder |
| `zn9` | MCP config hash/cache writer |
| `jg_` | MCP cache path resolver |
| `m2H` | MCP config hash generator (sha256, bundle.js:+6496549) |
| `OJ8` | MCP config key extractor |
| `zJ8` | MCP config identity/hash resolver |
| `iX` | MCP content hash utility (createHash) |
| `MJ8` | MCP config serializer (If → GN1) |
| `If` | Generic object serializer |
| `Y8` | MCP debug logger (logMCPDebug) |
| `nX8` | MCP server connection runner (OAuth, stdio, SSE) |
| `STL` | MCP stdio transport builder |
| `pc` | MCP connection context (cu/tK) |
| `d1H` | MCP dependency resolver (Zb9/sjL) |
| `c1H` | MCP client config builder |
| `H9H` | MCP OAuth HTTP callback server manager |
| `bH6` | MCP pending-connection tracker (UX8 map) |
| `Y` | Process exit/abort on forced shutdown |
| `rX8` | MCP cache refresh helper (c9/lP8) |
| `Ei` | MCP reconnection orchestrator |
| `cu` | MCP context helper (tK) |
| `w` | MCP daemon supervisor (write/start/stop/updateConfig) |
| `zL` | MCP error logger (logMCPError) |
| `TH` | Generic string coercer (String) |
| `RTL` | MCP reconnect result resolver |
| `kTL` | SSH/URL environment type detector (eH.isSSH, L6, Zq) |
| `iX8` | MCP OAuth tool registration handler |
| `CH6` | MCP pending-connection getter (pX8) |
| `xH6` | MCP active-connection getter (UX8) |
| `Wn9` | MCP config watcher/reload trigger |
| `c9` | Async-local-storage store getter (yU4.getStore) |
| `lP8` | MCP cache file path builder (cP8.join) |
| `RH` | JSON stringifier |
| `uB_` | MCP token/credential validator (iX/If/Y8/TH) |
| `lN` | MCP skills telemetry emitter (w6 → tengu_mcp_skills) |
| `w6` | MCP skills event dispatcher |
| `ZB_` | MCP tool filter (G8 + A.includes) |
| `G8` | MCP tool metadata builder |
| `y` | Usage-credits warning renderer (ea/A) |
| `ea` | Usage warning component builder (d4) |
| `jn9` | Async iterator utility (tF) |
| `tF` | Generic async-iterator / event stream handler |
| `f66` | Integer parser (radix 10, bundle.js:+6741588) |
| `nP8` | Integer parser variant (bundle.js:+6741686) |
| `Mi8` | MCP connection result applicator (applyMcpUpdate) |
| `eRH` | MCP update event emitter (m2H) |
| `_G` | MCP server cleanup orchestrator (q66/lN) |
| `q66` | MCP server state reset helper (m2H) |
| `N` | Config formatting / log writer |
| `Z1f` | Config value resolver (qI/Ut8/fvA) |
| `fvA` | Config field accessor (v8f/N8f) |
| `df` | Config path redactor ([REDACTED], bundle.js:+202144) |
| `UhA` | Config map printer (W1f.map) |
| `VgH` | Config writer dispatcher (hhA) |
| `hhA` | Low-level config write (H.write) |
| `h1f` | Settings file write pipeline (oFH/sfH/Qt8/N1f) |
| `oFH` | Write-queue debouncer (clearTimeout/setTimeout/setImmediate) |
| `sfH` | Settings filename resolver (NgH/M8H.join/q_/k6) |
| `C36` | File error handler (V8/EISDIR) |
| `ghA` | Settings path helper (M8H.join/k6) |
| `Qt8` | Atomic file rename helper (xk.stat/xk.rename/xk.unlink) |
| `N1f` | File append/write worker (xk.mkdir/xk.appendFile) |
| `R9` | Signal handler registrar (qvA.register) |
| `$` | Background session manager (mDK) |
| `mDK` | Daemon status writer (As/Date.now/c9/Dp6/RH) |
| `As` | Daemon status builder (VLH) |
| `Dp6` | Daemon status path resolver (uDK.join/q_) |
| `NGA` | MCP remote-server retry manager |
| `RX8` | MCP server capability checker (ATL/IB_) |
| `l8` | Async timeout/retry utility |
| `O` | Background session state object (x8) |
| `z` | Daemon lifecycle controller (kH/CH/WS/dU) |
| `kH` | Feature-ok telemetry emitter (c/A6 → tengu_feature_ok) |
| `c` | Telemetry event payload builder |
| `A6` | Telemetry event dispatcher (S56) |
| `S56` | Low-level telemetry submit |
| `CH` | Feature-bad telemetry emitter (c/A6 → tengu_feature_bad) |
| `WS` | Daemon stop orchestrator (zm/chH/qX_) |
| `zm` | Daemon shutdown sequencer (tC) |
| `tC` | Process shutdown utility (C24/iO/_NH) |
| `chH` | Daemon connection closer (PS) |
| `PS` | MCP connection shutdown (w6) |
| `qX_` | Daemon shutdown emitter (_X_.randomUUID/_iH/HF/H.emit) |
| `KK8` | OAuth client builder |
| `HF` | Crypto token generator ($19.randomBytes/G8/N) |
| `dU` | Daemon exit handler (Promise.race/Promise.all/ULH/BLH/l8/process.exit) |
| `ULH` | MCP SDK shutdown caller (pLH.shutdown) |
| `BLH` | Daemon shutdown finalizer (clearTimeout/yV_) |
| `yV_` | Telemetry flush on shutdown (Kj.post/N) |
| `WC_` | Local settings loader + exclude-rule merger |
| `C8` | Settings file reader (ms6/xB) |
| `ms6` | Settings cache lookup (IVA/ef_/yVA) |
| `IVA` | Settings in-memory cache (NQ6.has/NQ6.get) |
| `ef_` | Settings parser (onA/IYH/bB/nnA/Ra) |
| `yVA` | Settings cache setter (NQ6.set) |
| `xB` | Settings schema validator/builder |
| `j_` | Settings path canonicalizer (rG) |
| `TM6` | Settings migration helper |
| `Da8` | Settings default filler |
| `PM6` | Settings policy merger |
| `TVH` | Settings type validator |
| `EVH` | Settings enum validator |
| `ZM6` | Settings range validator |
| `kYH` | Settings key sanitizer |
| `SYH` | Settings key filter |
| `D4_` | Settings diff utility |
| `wiA` | Settings change notifier |
| `Ba` | Settings backup helper |
| `sw6` | Settings write dispatcher (a6/ow6/i2) |
| `TqL` | Glob pattern validator (H.match) |
| `fA` | Exclude-rule file writer (u3/xB/la6/N/kH/CH) |
| `u3` | Settings update entry point (IYH/xB) |
| `IYH` | Settings path resolver (EI.join/us6/ZUf/nu/EUf) |
| `Q2` | Config context loader (Ca) |
| `Ca` | Config file reader (r6/M$/N/Ha6/_.readFileSync/_a6) |
| `k8` | File system error guard (V8/ENOENT) |
| `V8` | Generic fs error handler |
| `Of_` | Settings write timestamp recorder (sa6.set/Date.now) |
| `vNH` | Settings value normalizer (us6/xB) |
| `us6` | Settings path resolver (EI.resolve/q_/EI.dirname) |
| `fw6` | Symlink-safe file writer (b3.writeFileSync/b3.fchmodSync/b3.fsyncSync) |
| `lO` | Settings cache clearer (NQ6.clear/ir8.clear) |
| `la6` | Settings file append/write orchestrator (XYH.mkdir/XYH.readFile/XYH.appendFile/XYH.writeFile) |
| `b6` | Git-check helper for settings files (eo6/j_) |
| `lK_` | Settings lock manager (W4) |
| `ca6` | gitignore pattern matcher (p_) |
| `amf` | Path normalizer / tilde expander (sK_.homedir/h4H.join) |
| `icA` | Settings integrity checker (p_) |
| `rcA` | Settings rollback helper |
| `nu` | Settings join helper (EI.join) |
| `t6` | Feature-sad telemetry emitter (c/A6 → tengu_feature_sad) |
| `uB` | Settings load pipeline (nG/Kq/H4_/xB/hQ6) |
| `nG` | Settings load pre-check |
| `Kq` | Memory-usage sampler on settings load (process.memoryUsage) |
| `H4_` | Settings load executor (Date.now/b8/IQ6/Ra/aw6/onA/IYH/bB/nnA) |
| `hQ6` | Settings load post-processor |
| `SH` | Shell execution wrapper (DA/L6/_q/dbf/EdH.push/Sa.logError) |
| `DA` | Shell error builder (Error/String) |
| `L6` | String coercer for shell output |
| `_q` | Shell output post-processor ($gA) |
| `dbf` | Shell output ring buffer (io6.shift/io6.push) |
| `ad` | Final result handler / return value builder |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.