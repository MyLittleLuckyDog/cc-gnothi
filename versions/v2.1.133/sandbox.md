---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.133"
updated: "2026-05-31"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.133 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.133 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.133

---

## Overview

The `/sandbox` command manages the sandboxing configuration for Claude Code, allowing users to view the current sandbox state, configure it interactively (via an inline prompt when invoked without arguments), or add command-pattern exclusions from sandboxing. It enforces platform compatibility checks and respects policy-level lock-out before making any changes. The command renders a JSX component (`local-jsx` type) for its interactive configuration UI.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `sandbox` |
| description | `" ...   ...  (⏎ to configure)"` |
| argumentHint | `exclude "command pattern"` |
| immediate | `true` |
| isHidden | `null` (not hidden) |
| module_id | `d$q` |
| load_inline | `true` |
| loc_byte | `11311435` |
| loc_byte_end | `11312084` |
| loc_line | `7096` |
| arbor_handler.name | `kY7` |
| arbor_handler.fqn | `claude-2.1.133::kY7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.133 bundle.js:+11311435

The `immediate: true` flag means the command handler fires immediately on invocation without waiting for a user-confirmation step. The handler was resolved by the Arbor indexer following the `module_id` (`d$q`) → module exports → name lookup chain, landing on the `AsyncFunction` identified as `kY7` with 2 confirmed hits in the symbol graph.

---

## Input Branching

The handler has 4+ distinct branches driven by platform checks, policy locks, and the presence/value of the argument string. A Mermaid flowchart is used below.

```mermaid
flowchart TD
    A["/sandbox invoked"] --> B{Check theme/color mode\nbundle.js:+11310066}
    B --> C[Resolve color rendering helper\ncolorStyleResolver]
    C --> D{gA.isSupportedPlatform?\nbundle.js:+11310085}
    D -- "No, platform is plain Linux/macOS/WSL2?" --> E{Is WSL present?\nbundle.js:+11310121}
    E -- "WSL1 detected" --> F["Return error:\n'Sandboxing requires WSL2.\nWSL1 is not supported.'\nbundle.js:+11310127"]
    E -- "Non-WSL unsupported platform" --> G["Return error:\n'Sandboxing is currently only\nsupported on macOS, Linux,\nand WSL2.'\nbundle.js:+11310185"]
    D -- "Supported platform" --> H[renderStatusLine at 'error' level\nbundle.js:+11310265]
    H --> I[gA.checkDependencies\nbundle.js:+11310302]
    I --> J[gA.isPlatformInEnabledList\nbundle.js:+11310329]
    J --> K{gA.areSandboxSettingsLockedByPolicy?\nbundle.js:+11310491}
    K -- "Locked by policy" --> L["Return error:\n'Sandbox settings are overridden\nby a higher-priority configuration\nand cannot be changed locally.'\nbundle.js:+11310550"]
    K -- "Not locked" --> M{Parse argument string\nbundle.js:+11310777}
    M -- "arg starts with 'exclude'\nbundle.js:+11310800" --> N{Remainder after slice(8)\nbundle.js:+11310825}
    N -- "Empty / missing pattern" --> O["Return error:\n'Please provide a command\npattern to exclude\n(e.g., /sandbox exclude\n\"npm run test:*\")'\nbundle.js:+11310862"]
    N -- "Pattern provided" --> P[Write exclusion rule to\n.claude/settings.local.json\nbundle.js:+11311068]
    P --> Q[Emit telemetry:\nsandbox_exclude_command\nbundle.js:+3990916]
    Q --> R[Reload settings via settingsLoader\nbundle.js:+11311010]
    M -- "No arg / interactive" --> S[Open sandbox config UI\nvia JSX component\nbundle.js:+11311023]
    S --> T[Resolve relative path\ng$q.relative\nbundle.js:+11311047]
    T --> U[Render interactive\nsandbox configuration\nbundle.js:+11311060]
```

---

## Behavioral Spec

### Platform Validation

```
async function sandboxCommandHandler(args, context):
    colorMode = resolveColorMode(context)          // L_, a6 — bundle.js:+11310054
    colorStyleHelper = buildColorStyleHelper(colorMode)  // K_, a5H — bundle.js:+11310262

    if not platformSupport.isSupportedPlatform():  // gA.isSupportedPlatform — bundle.js:+11310085
        wslStatus = detectWSL()
        if wslStatus == "wsl" and wslVersion == 1:
            return errorResult(
                "Error: Sandboxing requires WSL2. WSL1 is not supported."
            )                                      // bundle.js:+11310127
        else:
            return errorResult(
                "Error: Sandboxing is currently only supported on macOS, Linux, and WSL2."
            )                                      // bundle.js:+11310185
```

Analysis basis: CC v2.1.133 bundle.js:+11310085

The handler immediately calls `gA.isSupportedPlatform()`. On failure it inspects the WSL version string (literal `"wsl"` at bundle.js:+11310121) to distinguish WSL1 from non-WSL unsupported platforms, returning a descriptive error for each.

---

### Dependency and Policy Check

```
    renderStatusLine("error", ...)                 // bundle.js:+11310265
    dependencyCheck = await platformSupport.checkDependencies()
                                                   // gA.checkDependencies — bundle.js:+11310302
    enabledCheck = platformSupport.isPlatformInEnabledList()
                                                   // gA.isPlatformInEnabledList — bundle.js:+11310329

    if platformSupport.areSandboxSettingsLockedByPolicy():
                                                   // gA.areSandboxSettingsLockedByPolicy — bundle.js:+11310491
        return errorResult(
            "Error: Sandbox settings are overridden by a higher-priority configuration " +
            "and cannot be changed locally."
        )                                          // bundle.js:+11310550
```

Analysis basis: CC v2.1.133 bundle.js:+11310491

When enterprise or project-level policy has locked the sandbox configuration, the handler exits early with a human-readable policy error, preventing any local mutation.

---

### Argument Parsing

```
    argParts = args.split(...)                     // M.split — bundle.js:+11310777
    argSlice = argParts.slice(...)                 // M.slice — bundle.js:+11310817

    if argSlice starts with "exclude":             // literal "exclude" — bundle.js:+11310800
        patternRemainder = argSlice.slice(8)       // skip "exclude " prefix, length 8 — bundle.js:+11310825
        if patternRemainder is empty:
            return errorResult(
                'Error: Please provide a command pattern to exclude ' +
                '(e.g., /sandbox exclude "npm run test:*")'
            )                                      // bundle.js:+11310862
        else:
            writeExclusionRule(patternRemainder)   // see Exclusion Rule Writing below
    else:
        openInteractiveSandboxUI(args, context)    // see Interactive UI below
```

Analysis basis: CC v2.1.133 bundle.js:+11310777

The argument string is split and the first token is compared against the literal `"exclude"`. The substring offset `8` (bundle.js:+11310825) strips the `"exclude "` prefix (7 characters + 1 space) from the argument, leaving the raw pattern string.

---

### Exclusion Rule Writing

```
function writeExclusionRule(pattern):
    sanitizedPattern = pattern.replace(...)        // z.replace — bundle.js:+11310981
    settingsLoader = loadSettingsModule(context)   // x1A — bundle.js:+11311010
    settingsLoader.addRules(                       // literal "addRules" — bundle.js:+3990630
        [sanitizedPattern],
        ".claude/settings.local.json"              // literal — bundle.js:+11311068
    )
    emitTelemetry("sandbox_exclude_command")       // literal — bundle.js:+3990916, hH — bundle.js:+3990913
    reloadSettings()
```

Analysis basis: CC v2.1.133 bundle.js:+11311010

Exclusion rules are always persisted to the **project-local** settings file (`.claude/settings.local.json`), not to global user settings. The `addRules` code path (bundle.js:+3990630) internally filters existing rules (`A.filter` at bundle.js:+3990607) and validates the pattern via `lxK` (bundle.js:+3990781) before writing.

---

### Interactive UI

```
function openInteractiveSandboxUI(args, context):
    resolvedDir = ZO(context)                      // directory resolver — bundle.js:+11311023
    relativePath = g$q.relative(resolvedDir, ...)  // path.relative equivalent — bundle.js:+11311047
    uiComponent = eg(relativePath, args, context)  // JSX component factory — bundle.js:+11311060
    return { type: "local-jsx", component: uiComponent }
```

Analysis basis: CC v2.1.133 bundle.js:+11311023

When invoked without an `exclude` argument (or with no argument at all), the command renders an interactive JSX configuration UI (indicated by the `local-jsx` type and the `⏎ to configure` hint in the description). The UI component receives the relative working directory path and the raw args.

---

### Color/Style Resolution Sub-calls

```
function resolveColorMode(context):
    mode = L_(context)                             // bundle.js:+11310054
    theme = a6(mode)                               // bundle.js:+11310076
    // theme is "light" (literal at bundle.js:+11310066) or "dark"
    return theme

function buildColorStyleHelper(theme):
    // K_ dispatches to a5H which maps ANSI color names
    // (black, red, green, yellow, blue, magenta, cyan, white, and Bright variants)
    // as well as hex, ansi256, rgb color modes
    // bundle.js:+11310262
    return colorHelper
```

Analysis basis: CC v2.1.133 bundle.js:+11310054

The color resolution sub-path (`K_` → `a5H`) uses a foreground rendering mode (literal `"foreground"` at bundle.js:+3553244) and dispatches ANSI color escape generation for all 16 standard colors plus bright variants, hex, ansi256, and RGB. This drives the terminal styling of the sandbox status display.

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_feature_ok` | Emitted on successful feature rendering (bundle.js:+907381, via `hH` → `d`) |
| Telemetry — `tengu_mcp_oauth_flow_start` | Emitted from MCP OAuth sub-path reached via settings loader traversal (bundle.js:+9406234) |
| Telemetry — `tengu_mcp_oauth_flow_success` | Emitted on successful OAuth completion (bundle.js:+9410609) |
| Telemetry — `tengu_mcp_oauth_flow_error` | Emitted on OAuth failure (bundle.js:+9411696) |
| Telemetry — `tengu_config_auth_loss_prevented` | Emitted when a config write would have erased stored auth tokens (bundle.js:+3108610) |
| Telemetry — `tengu_config_parse_error` | Emitted on settings file parse failure (bundle.js:+3113854) |
| Telemetry — `tengu_mcp_retry_failed_remote` | Emitted when MCP remote server retry fails during settings reload (bundle.js:+13870729) |
| Telemetry — `tengu_bg_spare_enable` | Background spare session enable event (bundle.js:+14156457) |
| Telemetry — `tengu_bg_spare_spawn` | Background spare session spawn event (bundle.js:+14156817) |
| Telemetry — `tengu_daemon_config_reload` | Daemon config reload triggered by settings change (bundle.js:+14170592) |
| Telemetry — `tengu_daemon_control` | Daemon control signal event (bundle.js:+14191366) |
| Telemetry — `tengu_daemon_yield` | Daemon yield-to-foreground event (bundle.js:+14174626) |
| File write | Exclusion rules written to `.claude/settings.local.json` (bundle.js:+11311068) |
| Settings reload | Full settings reload triggered after any rule mutation, including MCP server state reconciliation via `Og7` (bundle.js:+13871684) |
| appState changes | Sandbox enable/disable state is reflected in the interactive JSX component; changes propagate through the settings layer (`x1A` → `xA` → `db`) |
| Sound | None identified in depth-2 traversal |
| Hook registration | `uk6.emit` (bundle.js:+1166055) — settings-change event emitted after mutation |

---

## Version History

| Version | Change |
|---|---|
| v2.1.133 | Initial analysis |

---

## Common Mistakes

1. **Using `/sandbox exclude` without a pattern** — The command requires a non-empty command pattern after `exclude`. Invoking `/sandbox exclude` alone (or with only whitespace) produces the error: `"Error: Please provide a command pattern to exclude (e.g., /sandbox exclude "npm run test:*")"` (bundle.js:+11310862).

2. **Running on WSL1** — The sandbox feature explicitly rejects WSL1. Users must upgrade to WSL2; WSL1 detection occurs via the `"wsl"` version string check (bundle.js:+11310121).

3. **Expecting to override policy-locked settings** — If sandbox settings are locked by an enterprise or project-level policy, `/sandbox` will not allow any local change and will display the policy override error (bundle.js:+11310550). The only remedy is to adjust the higher-priority configuration.

4. **Assuming exclusion rules apply globally** — Exclusion rules added via `/sandbox exclude "pattern"` are always written to `.claude/settings.local.json` (project-local), not to the user-level global settings file. They will not apply in other projects.

5. **Invoking on unsupported platforms** — The command only supports macOS, Linux, and WSL2. Attempting to use it on Windows native or other platforms (without WSL2) returns a platform-not-supported error (bundle.js:+11310185).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `kY7` | Main async handler for `/sandbox` command (arbor_handler) |
| `K_` | Color-style dispatcher; routes to ANSI color helper based on theme |
| `a5H` | ANSI color string builder; maps color names and modes to escape sequences |
| `cp` | Color prefix/suffix helper used within color-style dispatcher |
| `M` | Settings/MCP module aggregator; entry point for settings reload path |
| `iZH` | MCP server connection manager; orchestrates connect/reconnect lifecycle |
| `zt` | MCP settings merge and diff utility |
| `SEH` | MCP configuration loader; reads and validates multi-layer config |
| `Ot` | MCP server SDK-type enumerator |
| `XO6` | MCP server SSE/HTTP connection factory |
| `$I` | MCP server instance formatter |
| `dM` | MCP display metadata builder |
| `CJA` | MCP connection annotation helper |
| `L` | Async task list / spinner list manager |
| `K` | Async task set with add/delete/finally lifecycle |
| `f` | Stream or connection handle with close/read operations |
| `AA` | Utility wrapper (single-function adapter) |
| `AJ6` | MCP server filter predicate |
| `so4` | MCP needs-auth cache reader |
| `KIA` | Reads the auth-needs cache file from disk |
| `G98` | MCP server config hasher/identity resolver |
| `Vl` | MCP server validation helper |
| `W98` | MCP server directory key builder |
| `GJ` | SHA-256 hash utility for config identity |
| `K8` | MCP debug log emitter |
| `gZA` | MCP server connection lifecycle handler (connect, OAuth, reconnect) |
| `qo4` | OAuth URL builder for MCP servers |
| `lp` | OAuth token storage accessor (read/write) |
| `_e` | Full MCP OAuth flow controller (server, callback, token exchange) |
| `KlH` | Active OAuth request tracker (Map-based) |
| `Y` | Background spare session health monitor |
| `AM8` | Removes the MCP auth-needs cache entry (unlink) |
| `eF` | MCP reconnect orchestrator |
| `Fb` | OAuth token backend accessor |
| `D` | Daemon config reload and supervisor restart trigger |
| `T7` | MCP error log emitter |
| `vH` | String coercion utility |
| `Lo4` | MCP connection timeout handler |
| `_o4` | SSH-aware MCP URL resolver |
| `QZA` | MCP `complete_authentication` tool handler |
| `LlH` | Reads active request from Map by session key |
| `flH` | Reads active OAuth request state |
| `Yl9` | Writes/updates the MCP auth-needs cache file |
| `JM8` | Builds the path to the MCP auth-needs cache file |
| `SH` | JSON serialization utility (`JSON.stringify` wrapper) |
| `BZA` | MCP config/auth token persistence helper |
| `dK` | Low-level config file writer |
| `Bw6` | Clears stored OAuth tokens from config |
| `kJA` | MCP tool inclusion predicate (checks if tool is in active server list) |
| `e6` | MCP tool registration entry builder |
| `_` | General array/string utility (toLowerCase, includes, values) |
| `J` | Process group manager; kills tracked child processes |
| `v` | Child process lifecycle handler with blur/focus/reconnect timing |
| `S` | Output stream writer (transient session) |
| `z` | Terminal output stream with write/hH/uH/bS/cC operations |
| `d` | General deferred/logging sink |
| `$l9` | MCP integer parameter parser (wraps `GMH`) |
| `GMH` | Safe integer mapper / async iterator adapter |
| `_J6` | Parses radix-10 integer from string (parseInt wrapper, base 10) |
| `fIA` | Parses radix-20 integer from string (parseInt wrapper, base 20) |
| `mFq` | Applies MCP config update and triggers cleanup/reconnect |
| `XM8` | Serializes updated MCP config to disk |
| `hI` | MCP server cleanup initiator |
| `DlH` | Calls serializer then fires cleanup on server list |
| `k` | Terminal log formatter (handles ANSI, uppercase, trimming) |
| `Ztq` | ANSI-aware log line formatter |
| `xcA` | ANSI color tag tokenizer |
| `Uf` | Log line prefix builder (trims, replaces sensitive tokens with `[REDACTED]`) |
| `rnA` | Maps log line tokens to prefix strings |
| `LkH` | Writes formatted log line to output stream |
| `UnA` | Raw stream write helper |
| `vtq` | File-based transcript/log writer with rotation |
| `uNH` | Output debounce / flush buffer manager |
| `aHH` | Appends a formatted log entry to the transcript file |
| `F6` | General filesystem error handler / fallback |
| `dG8` | Checks for EISDIR error code |
| `_iA` | Builds transcript file path from directory and filename |
| `AiA` | Atomic file rename helper (stat → rename → unlink on conflict) |
| `Vtq` | Appends to log file with rotation via `AiA` |
| `y1` | Active-write-set tracker (add/delete around async file ops) |
| `$` | Daemon state snapshot serializer |
| `XDq` | Writes daemon status JSON to disk |
| `yr` | Daemon status path builder |
| `iY` | Atomic file write (random bytes temp name → rename) |
| `Sj6` | Builds daemon status file path (`daemon.status.json`) |
| `J6` | Session/conversation record factory |
| `Bq6` | Conversation ID generator |
| `gq6` | Session metadata builder |
| `Po` | Session record validator |
| `kH` | String coercion / type normalizer |
| `jo` | Event emitter for session lifecycle events |
| `_d6` | Session deduplication guard (checks `Ut8` set) |
| `pt8` | New session record constructor and emitter |
| `ct8` | Session state machine initializer |
| `R6` | File watcher and hot-reload coordinator |
| `He8` | File watch event debouncer |
| `m5H` | Config file reader and directory bootstrapper |
| `u2K` | `fs.watchFile`-based file change monitor |
| `Og7` | MCP server reconciler after config update (diff → connect/disconnect) |
| `T98` | Checks MCP server connection-type capability sets |
| `q` | Cleanup utility (unlinkSync on temp files) |
| `r8` | Retry-with-backoff helper |
| `O` | Background session state holder |
| `x1A` | Settings load + rule-add orchestrator (main settings pipeline) |
| `h8` | Settings cache accessor (JG6 Map get/set) |
| `OcA` | Settings cache lookup (JG6 has/get) |
| `j5_` | Layered settings assembler (policy, user, project, local, flag layers) |
| `X5_` | Policy settings layer loader |
| `ZO` | Project settings file resolver (`.claude/settings.json`) |
| `Hr` | User settings file loader |
| `Y5_` | SDK inline settings injector |
| `zcA` | Writes assembled settings to cache (JG6 set) |
| `lxK` | Validates exclusion pattern string (regex match) |
| `xA` | Core settings write path (validates, writes, emits change event) |
| `OE` | Settings file write guard |
| `Fp` | Raw settings file reader (readFileSync, 4096-byte limit) |
| `D8` | `w8` filesystem error wrapper |
| `w8` | Low-level filesystem error classifier |
| `rh8` | Settings write timestamp recorder |
| `C6H` | Resolves canonical settings file path |
| `LA` | Settings directory bootstrapper |
| `oLH` | Checks if path is inside allowed directories |
| `KhH` | Atomic settings file writer (temp file + fsync + rename, preserves permissions) |
| `l2` | Clears settings caches (JG6 and Q28) |
| `iN6` | Reads and writes settings files with git-ignore awareness |
| `N6` | Git-ignore check runner |
| `Ch8` | YK-based settings validator |
| `mh8` | Runs `git check-ignore` for a path |
| `yPL` | Resolves `~/.config/ignore` path |
| `fH` | Error logger (logs to `cyH` and `yQ.logError`) |
| `Qb` | Resolves `.claude/settings.json` path |
| `db` | Full settings disk-load orchestrator (calls `vWL` then `Oq`) |
| `Yp` | Settings load result post-processor |
| `vWL` | Settings file watcher and change emitter |
| `Oq` | Records memory usage snapshot after settings load |
| `$cA` | Settings load completion handler |
| `hH` | Display/render helper (calls `d` sink) |
| `eg` | Interactive sandbox JSX component factory (final render target) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.