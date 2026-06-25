---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.191"
updated: "2026-06-25"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.191 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.191 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.191

---

## Overview

The `/sandbox` command configures the process-sandboxing policy for Claude Code, allowing users to enable, disable, or modify which shell commands are excluded from sandbox enforcement. It performs platform compatibility checks before presenting an interactive JSX-based configuration UI, and writes any resulting changes to the local settings file (`.claude/settings.local.json`). Policy overrides from enterprise configuration can lock sandbox settings, preventing local modification.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `sandbox` |
| description | ` ...   ...  (⏎ to configure)` |
| argumentHint | `exclude "command pattern"` |
| immediate | `true` |
| isHidden | `null` (not hidden) |
| module_id | `i4l` |
| load_inline | `true` |
| loc_byte | `12760629` |
| loc_byte_end | `12761324` |
| loc_line | `8619` |
| arbor_handler.name | `iRf` |
| arbor_handler.fqn | `claude-2.1.191::iRf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.191 bundle.js:+12760629

---

## Input Branching

The handler `iRf` has five distinct paths based on platform support, policy lock status, and subcommand argument. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/sandbox invoked"] --> B{Platform check\nxo.isSupportedPlatform}
    B -- "not supported\n(not macOS/Linux/WSL2)" --> C{WSL version\ncheck via Wt}
    C -- "WSL1 detected" --> D["Error: Sandboxing requires WSL2.\nWSL1 is not supported.\n(bundle.js:+12759339)"]
    C -- "not WSL" --> E["Error: Sandboxing is currently only supported\non macOS, Linux, and WSL2.\n(bundle.js:+12759397)"]
    B -- "supported" --> F{Policy lock\nxo.areSandboxSettingsLockedByPolicy}
    F -- "locked by policy" --> G["Error: Sandbox settings are overridden by\na higher-priority configuration and\ncannot be changed locally.\n(bundle.js:+12759762)"]
    F -- "not locked" --> H{Argument\npresent?}
    H -- "arg starts with 'exclude'\n(bundle.js:+12759994)" --> I{Pattern\nprovided?}
    I -- "no pattern after\n'exclude ' prefix\n(bundle.js:+12760056)" --> J["Error: Please provide a command pattern\nto exclude (e.g., /sandbox exclude\n\"npm run test:*\")"]
    I -- "pattern provided" --> K["Parse pattern, apply exclusion rule,\nwrite to .claude/settings.local.json\n(bundle.js:+12760262)"]
    K --> L["Emit tengu event:\nsandbox_exclude_command\n(bundle.js:+4867287)"]
    H -- "no arg or\nnon-exclude arg" --> M["Render interactive JSX\nconfiguration UI\n(bundle.js:+12759920)"]
```

Analysis basis: CC v2.1.191 bundle.js:+12759266, +12759297, +12759703, +12759994

---

## Behavioral Spec

### Platform and Dependency Validation

```
async function sandboxHandler(args, context):
    // Step 1: Check dependencies (e.g., sandbox binary availability)
    checkDependencies()  // jo @ bundle.js:+12759266

    // Step 2: Determine WSL version if applicable
    wslVersion = getWslVersion()  // Wt @ bundle.js:+12759288

    // Step 3: Platform gate
    if not isSupportedPlatform():  // xo.isSupportedPlatform @ bundle.js:+12759297
        if wslVersion == "wsl" and wslVersion is WSL1:
            return errorMessage("Error: Sandboxing requires WSL2. WSL1 is not supported.")
            // literal @ bundle.js:+12759339
        else:
            return errorMessage("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")
            // literal @ bundle.js:+12759397

    // Step 4: Policy lock gate
    if areSandboxSettingsLockedByPolicy():  // xo.areSandboxSettingsLockedByPolicy @ bundle.js:+12759703
        return errorMessage("Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally.")
        // literal @ bundle.js:+12759762
```

Analysis basis: CC v2.1.191 bundle.js:+12759266, +12759297, +12759703

---

### Argument Parsing and Subcommand Dispatch

```
    // Step 5: Parse incoming argument string
    argString = args  // a.split used @ bundle.js:+12759971

    if argString starts with "exclude":  // Lo/e.startsWith @ bundle.js:+3913573
        // Extract the pattern portion after the 'exclude' keyword
        // Byte offset 8 accounts for 'exclude ' prefix length
        // literal 8 @ bundle.js:+12760019
        pattern = argString.slice(8)  // a.slice @ bundle.js:+12760011

        if pattern is empty or missing:
            return errorMessage(
                'Error: Please provide a command pattern to exclude (e.g., /sandbox exclude "npm run test:*")'
            )
            // literal @ bundle.js:+12760056

        // Sanitize/format the pattern for storage
        sanitizedPattern = pattern.replace(...)  // u.replace @ bundle.js:+12760175

        // Delegate to config writer to persist the exclusion rule
        writeExcludeRule(sanitizedPattern)  // cYr @ bundle.js:+12760204
    else:
        // No recognized subcommand — open interactive UI
        renderSandboxConfigUI()  // a4l.jsx @ bundle.js:+12759920
```

Analysis basis: CC v2.1.191 bundle.js:+12759971, +12759994, +12760011, +12760019, +12760056, +12760175, +12759920

---

### Exclusion Rule Persistence

When a valid `exclude` pattern is supplied, the command invokes the exclusion-rule writer (identified as `cYr` in the call graph):

```
function writeExcludeRule(pattern):
    // Load current settings layers (localSettings, addRules)
    // literals @ bundle.js:+4866910, +4867001
    settings = loadSettingsLayer("localSettings")  // In @ bundle.js:+4866907

    // Filter and validate existing rules
    existingRules = settings.filter(...)  // t.filter @ bundle.js:+4866978

    // Check for pattern match conflicts
    conflicts = checkPatternConflicts(existingRules, pattern)  // B3d.e.match @ bundle.js:+4855346

    if pattern already included in rules:  // r.includes @ bundle.js:+4867191
        // No-op or notify user
        return

    // Append the new rule via uo (settings updater)
    applyNewRule(pattern)  // uo @ bundle.js:+4867205

    // Emit telemetry for the exclusion action
    emitTelemetry("sandbox_exclude_command")  // literal @ bundle.js:+4867287

    // Determine relative path to project settings file
    relativePath = s4l.relative(...)  // s4l.relative @ bundle.js:+12760241
    // Target: .claude/settings.local.json
    // literal @ bundle.js:+12760262

    // Finalize and write via Kq
    finalizeWrite()  // Kq @ bundle.js:+12760254
```

Analysis basis: CC v2.1.191 bundle.js:+12760204, +4866907, +4866978, +4867191, +4867205, +4867287, +12760241, +12760262, +12760254

---

### Settings Layer Resolution

The settings resolution chain (`sg` → `z2` / `VTe`) loads multiple settings layers in priority order:

```
function resolveSettings():
    // Priority order (from literals found in call graph):
    layers = [
        "policySettings",   // highest priority — literal @ bundle.js:+1324630
        "flagSettings",     // literal @ bundle.js:+1324709
        "localSettings",    // literal @ bundle.js:+4866910
        "projectSettings",  // literal @ bundle.js:+1320018
        "userSettings",     // literal @ bundle.js:+1319967
    ]
    // Each layer loaded from its respective config path
    // .claude/settings.local.json used for local writes
    // literal @ bundle.js:+12760262
    return mergedSettings(layers)
```

Analysis basis: CC v2.1.191 bundle.js:+1324630, +1324709, +4866910, +1320018, +1319967

---

### Color/ANSI Rendering for UI Output

When the interactive configuration UI is displayed, the handler uses a full ANSI color renderer (`Lo` → `iwe`) to format terminal output. The renderer supports the following color modes detected at runtime:

- Named foreground/background colors (black, red, green, yellow, blue, magenta, cyan, white and their bright variants)
- `ansi256(N)` — 256-color palette (prefix literal: `"ansi256("` @ bundle.js:+3913627)
- `rgb(R,G,B)` — true-color (prefix literal: `"rgb("` @ bundle.js:+3913586)
- `ansi:N` — raw ANSI code (prefix literal: `"ansi:"` @ bundle.js:+3913653)
- Theme variants: `light-ansi`, `dark-ansi`, `light-daltonized`, `dark-daltonized` (literals @ bundle.js:+3503484–+3503573)

Analysis basis: CC v2.1.191 bundle.js:+3913573, +3913586, +3913627

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `sandbox_exclude_command` | Emitted when a valid `exclude` pattern is successfully written to local settings (literal @ bundle.js:+4867287) |
| Telemetry: `tengu_api_success` | Emitted on successful API interaction within the broader API call chain (bundle.js:+8938998) |
| Telemetry: `tengu_feature_ok` | Emitted on successful feature invocation path (bundle.js:+1025725) |
| Telemetry: `tengu_feature_bad` | Emitted when a feature invocation path fails validation (bundle.js:+1025792) |
| Telemetry: `tengu_feature_sad` | Emitted on a degraded/partial feature outcome (bundle.js:+1025873) |
| Telemetry: `tengu_mcp_skills` | Emitted during MCP skills registration in the call graph (bundle.js:+6756547) |
| Telemetry: `tengu_context_tip_classifier_outcome` | Emitted during context tip classification (bundle.js:+16672225) |
| Telemetry: `tengu_lone_surrogate_sanitized` | Emitted when lone surrogates are found and sanitized in output (bundle.js:+8938694) |
| Telemetry: `tengu_config_auth_loss_prevented` | Emitted when a config write is blocked to prevent auth data loss (bundle.js:+13862444) |
| Telemetry: `tengu_daemon_config_reload` | Emitted when daemon configuration reloads (bundle.js:+17386661) |
| Telemetry: `tengu_daemon_yield` | Emitted when background daemon yields to foreground (bundle.js:+17391071) |
| Telemetry: `tengu_daemon_control` | Emitted on daemon control operations (bundle.js:+17408260) |
| Telemetry: `tengu_prompt_cache_1h_config` | Emitted when the 1-hour prompt cache configuration is applied (bundle.js:+13616098) |
| Telemetry: `tengu_bg_retire_pinned_low_mem` | Emitted when pinned background workers are retired under memory pressure (bundle.js:+17375231) |
| Telemetry: `tengu_bg_prewarm_per_sweep` | Emitted during background pre-warm sweep (bundle.js:+17375352) |
| File write | Exclusion rules persisted to `.claude/settings.local.json` (literal @ bundle.js:+12760262) |
| Policy gate | If `xo.areSandboxSettingsLockedByPolicy()` returns true, all writes are blocked with an error message (bundle.js:+12759703) |
| Platform gate | Command is a no-op with error output on unsupported platforms (non-macOS, non-Linux, non-WSL2) (bundle.js:+12759397) |
| Interactive UI | When no `exclude` subcommand is given, renders a JSX component via `a4l.jsx` (bundle.js:+12759920) |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.191 | Initial analysis |

---

## Common Mistakes

1. **Missing pattern after `exclude`** — Running `/sandbox exclude` without a quoted pattern produces the error `"Error: Please provide a command pattern to exclude (e.g., /sandbox exclude "npm run test:*")"`. Always supply a quoted glob pattern.
2. **Unsupported platform** — Attempting `/sandbox` on WSL1 or a non-Linux/macOS system will produce a hard error; the command does not fall through to a degraded mode.
3. **Enterprise policy lock** — In managed/enterprise deployments, sandbox settings may be locked by policy. The command will display an error and refuse to write any configuration; this is not a bug but an intentional policy enforcement.
4. **Expecting global config changes** — The `exclude` subcommand writes only to `.claude/settings.local.json` (the local project settings layer), not to user-level or global settings. Changes are project-scoped.
5. **Glob quoting** — The argument hint `exclude "command pattern"` signals that patterns should be quoted. Unquoted patterns with shell metacharacters may be misinterpreted by the CLI argument parser before reaching the handler.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `iRf` | Main async handler for `/sandbox` (Arbor-resolved entry point) |
| `Lo` | Argument parser / foreground color rendering dispatcher |
| `L6o` | Context/message windowing and truncation utility |
| `gsm` | Map setter helper within message context builder |
| `har` | Content hashing/classification helper |
| `msm` | Auto-classifier input transformer |
| `wN` | Core API request builder and dispatcher |
| `xf` | Thread/worker type detector (`"main"` literal) |
| `oW` | HTTP API transport layer (headers, auth, retries) |
| `h` | HTTP header helper |
| `b2e` | Model-capability filter (checks for claude-3-x / opus-4 / sonnet-4 support) |
| `lie` | OAuth/auth token retriever |
| `CBp` | Tool-use block finder in API responses |
| `SHo` | SHA-256 hash builder for request deduplication |
| `Ghn` | User-agent / session header assembler |
| `aIn` | Log record appender |
| `aje` | Prompt cache / 1-hour cache config applicator |
| `wD` | Structured output schema applicator |
| `L` | Background worker lifecycle sweep (respawn, retire, prewarm) |
| `ZVa` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `sp` | String sanitizer (lone surrogate replacement) |
| `XSn` | Temperature override applier for specific models |
| `av` | Content-block array mapper |
| `Txe` | Tool result schema validator / formatter |
| `etn` | Message array mutator (pop/push with type checks) |
| `iD` | Deep clone via `structuredClone` |
| `u7e` | Alternate message array mutator |
| `W` | Shared state/store reference |
| `Ve` | Feature flag checker |
| `LOr` | Log writer with structured record output |
| `wOr` | Cache-hit checker and setter for request deduplication |
| `mbe` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `Tr` | Timing / telemetry record emitter |
| `Oo` | Feature flag reader (alternate path) |
| `H1t` | Side-query response handler |
| `NF` | Sub-agent node factory |
| `kAt` | Cache-control header injector |
| `S4` | Event emitter wrapper |
| `ev` | Event type constant holder |
| `PPr` | Promise resolution helper |
| `usm` | Sandbox classifier input builder |
| `csm` | Message mapper for classifier |
| `hsm` | Prompt string assembler (push/join) |
| `M6n` | Tool-use block finder (alternate) |
| `T` | React/JSX element factory (core renderer) |
| `wNc` | JSX render context / key formatter |
| `ke` | JSON serializer wrapper |
| `Dc` | Path/identifier formatter for display |
| `a7e` | Style resolver |
| `kNc` | File context loader and byte-length measurer |
| `cSt` | UI component: sandbox status display |
| `Pe` | UI primitive: styled box/panel |
| `Re` | UI component: alternate render path |
| `D6n` | Zod schema safe-parser wrapper |
| `we` | UI component: warning/error display |
| `Ae` | String coercion utility |
| `iwe` | ANSI/chalk color string parser and applier |
| `e7` | Color theme selector |
| `a` | MCP server configuration applicator (top-level) |
| `s5e` | MCP server connection manager (start/stop/reconnect) |
| `S3` | MCP server registry and tool loader |
| `zat` | MCP server init helper |
| `bY` | MCP server slot builder and approval checker |
| `B5` | MCP tool list builder |
| `kPn` | MCP error colorizer (red/yellow) |
| `Vat` | MCP server state tracker (set/get/has) |
| `XF` | Object prototype-less record factory |
| `d` | Daemon/supervisor worker controller |
| `mL` | MCP server module loader |
| `ag` | MCP server agent capability builder |
| `Pno` | MCP plugin registry entry |
| `Gn` | Generic getter helper |
| `U2t` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `vEa` | MCP server connection validator / hash checker |
| `Koo` | Auth cache key builder |
| `y0e` | Config object hasher |
| `LAn` | Settings object key enumerator and merger |
| `xAn` | Settings hash comparator |
| `PT` | Settings fingerprint hasher |
| `wAn` | Settings write lock coordinator |
| `Wl` | Atomic write utility wrapper |
| `ln` | MCP debug log emitter |
| `ZPn` | MCP connection orchestrator |
| `xr` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `Cop` | MCP stdio/SSE connection handler |
| `vop` | MCP OAuth connection handler |
| `$2t` | MCP auth-cache reader |
| `qs` | Async store getter |
| `a1n` | Auth cache filename builder |
| `Xno` | MCP server hash/reconnect coordinator |
| `m` | Worker process map (values/kill) |
| `n` | Worker name normalizer |
| `k` | Worker write/kill interface |
| `hL` | MCP tool registration finalizer |
| `nt` | Tool registry entry registrar |
| `Dno` | MCP transport type includer |
| `gn` | Global config save coordinator |
| `v` | Background worker state object |
| `t7` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `w` | Shared worker/session state |
| `Hyc` | Context window history accessor |
| `_yc` | Context window viewport calculator |
| `Xc` | MCP error log emitter |
| `kEa` | Async iterator / stream mapper |
| `GW` | Generic async iterable wrapper |
| `xlt` | Integer parser (radix-based) |
| `l1n` | Alternate integer parser |
| `Gar` | MCP connection result applier |
| `o5e` | MCP orphan connection disposer (config-changed path) |
| `tI` | MCP connection cleanup coordinator |
| `wlt` | MCP connection hash validator |
| `w_a` | MCP foreground connection initiator |
| `Fro` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `s` | Session/connection set manager |
| `i` | Session close/open coordinator |
| `l` | Daemon status reader |
| `rGl` | Daemon status file writer |
| `HZ` | Daemon runtime info collector |
| `ozt` | Daemon status filename builder |
| `hGo` | MCP server retry and reconnect orchestrator |
| `UPn` | MCP server suppression checker |
| `jn` | Timeout-wrapped promise helper |
| `c` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `u` | Background session / daemon lifecycle manager |
| `pF` | Background session starter |
| `$4` | Session config builder |
| `yB` | Session credential loader |
| `eBe` | Background session event subscriber |
| `Vw` | Background session tool registrar |
| `v5r` | Background session UUID and event emitter |
| `ITn` | Background session API client factory |
| `P4` | Random-bytes key generator |
| `BG` | Background session shutdown coordinator |
| `ohe` | Shutdown signal sender |
| `fhe` | Shutdown timeout and post handler |
| `O2o` | Datadog/metrics POST sender |
| `cYr` | Exclusion rule writer (reads localSettings, appends rule, writes to disk) |
| `In` | Settings loader (top-level dispatcher) |
| `vln` | Settings cache reader |
| `VVo` | Settings cache has/get accessor |
| `EIr` | Settings file parser (policy/flag/user layers) |
| `qVo` | Settings cache setter |
| `z2` | Settings layer merger |
| `Hr` | File existence checker |
| `JAt` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `Tdr` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `zAt` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `N1e` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `U1e` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `ZAt` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `xse` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `KTe` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `Dln` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `dgs` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `JQ` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `Lwt` | Settings load sequence coordinator |
| `B3d` | Pattern conflict detector (regex match on existing rules) |
| `uo` | Settings updater / rule applier (core write path) |
| `sg` | Settings layer sequencer |
| `VTe` | Settings file path resolver (.claude/settings.local.json etc.) |
| `Gt` | File stat/existence helper |
| `VC` | CLAUDE.md / project settings file reader |
| `WQ` | Settings file sync reader (readFileSync, replaceAll) |
| `vn` | ENOENT-safe file reader |
| `dn` | Filesystem error classifier |
| `wTr` | Write timestamp recorder |
| `GUe` | Settings path resolver (Iln-based) |
| `Iln` | Path join/resolve utility |
| `Rvt` | Atomic file writer (temp → rename, fsync) |
| `jd` | Real path resolver (realpathSync) |
| `hXe` | Extended attribute / permission error handler |
| `ius` | File property definer |
| `kH` | Settings cache invalidator (clear sZt and Zcr) |
| `Yps` | Git-ignore-aware file writer |
| `Dt` | Git presence detector |
| `uTr` | Gitignore rule reader |
| `Ran` | Git check-ignore runner |
| `BHu` | Gitignore global excludes file locator |
| `Kps` | Git ls-files tracker checker |
| `zps` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `c4` | .claude directory path builder |
| `Lt` | UI component: confirmation/result display |
| `vj` | Settings load-from-disk orchestrator |
| `cx` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `ia` | Memory usage sampler |
| `SIr` | Settings file watcher / hot-reload handler |
| `iZt` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `Le` | Error logger (GQ.logError path) |
| `fo` | Error string formatter |
| `rt` | String coercer (String() wrapper) |
| `Yi` | Named character set encoder |
| `Rmu` | Rolling error log (shift/push ring buffer) |
| `Kq` | Final write coordinator / result handler for sandbox config |