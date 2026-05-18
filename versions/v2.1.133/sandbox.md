---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.133"
updated: "2026-05-18"
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

The `/sandbox` command manages the sandbox execution environment for Claude Code, allowing users to configure which command patterns are excluded from sandboxed execution. It validates platform compatibility, enforces policy-level lock checks, parses an `exclude` sub-command, and writes the resulting exclusion rule into the project-local settings file (`.claude/settings.local.json`). The command is marked `immediate`, meaning it executes synchronously without entering the normal agent turn loop.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `sandbox` |
| description | *(null — no description registered)* |
| argumentHint | `exclude "command pattern"` |
| immediate | `true` |
| module\_id | `d$q` |

Analysis basis: CC v2.1.133 bundle.js:+11311435

---

## Input Branching

The command handler (`sandboxCommandHandler`) follows a multi-stage gate sequence before performing any write. The flowchart below captures all branching paths visible in the depth-2 call graph.

```mermaid
flowchart TD
    A(["/sandbox invoked"]) --> B{checkSupportedPlatform}
    B -- "not macOS / Linux / WSL2" --> E1["Emit error:\n'Sandboxing is currently only supported\non macOS, Linux, and WSL2.'"]
    B -- "WSL1 detected" --> E2["Emit error:\n'Sandboxing requires WSL2.\nWSL1 is not supported.'"]
    B -- "platform OK" --> C{areSandboxSettingsLockedByPolicy?}
    C -- "yes (policy lock)" --> E3["Emit error:\n'Sandbox settings are overridden by a\nhigher-priority configuration and cannot\nbe changed locally.'"]
    C -- "no" --> D{parse sub-command token}
    D -- "token == 'exclude'" --> F{pattern argument present?}
    D -- "unknown / missing token" --> E4["Emit usage hint:\n/sandbox exclude \"command pattern\""]
    F -- "no pattern argument" --> E5["Emit error:\n'Error: Please provide a command pattern\nto exclude (e.g.,\n/sandbox exclude \"npm run test:*\")'"]
    F -- "pattern present" --> G[resolveSettingsPath → .claude/settings.local.json]
    G --> H[loadAndMergeSettings]
    H --> I[appendExcludeRule to localSettings]
    I --> J[writeSettingsFile utf-8]
    J --> K[emit telemetry: sandbox_exclude_command]
    K --> L(["Return 'success'"])

    E1 --> Z([exit / return error])
    E2 --> Z
    E3 --> Z
    E4 --> Z
    E5 --> Z
```

Analysis basis: CC v2.1.133 bundle.js:+11310054 – +11311103

---

## Behavioral Spec

### Platform Guard

```
function checkPlatformSupport(platformInfo):
    if platformInfo.isSupportedPlatform() == false:
        if platformInfo.type == "wsl" AND platformInfo.version == 1:
            return error("Error: Sandboxing requires WSL2. WSL1 is not supported.")
        else:
            return error("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")
    return ok
```

- Supported platforms: macOS, Linux, WSL2.
- WSL1 is explicitly rejected with a distinct message from a fully unsupported OS.

Analysis basis: CC v2.1.133 bundle.js:+11310085 (platform check call), +11310121 (WSL string), +11310127 (WSL1 error message), +11310185 (generic unsupported platform message)

---

### Dependency and Platform Enablement Check

```
function runPreconditionChecks(platformInfo, config):
    checkDependencies(platformInfo)          // verifies required sandbox binaries
    isPlatformInEnabledList(platformInfo)    // cross-references allow-list
```

These checks are performed in sequence after the platform guard and before the policy-lock gate.

Analysis basis: CC v2.1.133 bundle.js:+11310302 (checkDependencies call), +11310329 (isPlatformInEnabledList call)

---

### Policy Lock Gate

```
function enforcePolicyLock(config):
    if areSandboxSettingsLockedByPolicy(config):
        return error(
            "Error: Sandbox settings are overridden by a higher-priority configuration " +
            "and cannot be changed locally."
        )
    return ok
```

When a higher-priority configuration (e.g., enterprise managed settings) locks sandbox options, any local modification attempt is rejected.

Analysis basis: CC v2.1.133 bundle.js:+11310491 (policy check call), +11310550 (error string literal)

---

### Sub-command Parsing

```
function parseSubCommand(rawArgs):
    tokens = rawArgs.split(separator)       // split on whitespace
    subCommand = tokens[0]

    if subCommand == "exclude":
        // slice off the leading "exclude" keyword (offset 8 characters)
        patternArg = rawArgs.slice(8).trim()
        if patternArg == "":
            return error(
                'Error: Please provide a command pattern to exclude ' +
                '(e.g., /sandbox exclude "npm run test:*")'
            )
        return { action: "exclude", pattern: patternArg }
    else:
        return error("usage hint")
```

- The sub-command keyword `"exclude"` is 7 characters; the implementation slices at offset 8 to skip the keyword plus its trailing space, making the effective slice start 8.
- Only the `exclude` action is present in this traversal depth.

Analysis basis: CC v2.1.133 bundle.js:+11310777 (split call), +11310800 (literal `"exclude"`), +11310817 (slice call), +11310825 (numeric literal `8`), +11310862 (error message string)

---

### Settings Resolution and Write

```
function resolveAndWriteExcludeRule(pattern, cwdRelativePath):
    // Determine the target settings file path
    settingsPath = resolveSettingsPath()
    // → resolves to: <project-root>/.claude/settings.local.json

    // Load existing settings layers:
    //   policySettings, flagSettings, userSettings, projectSettings, localSettings
    currentSettings = loadSettings(settingsPath, encoding="utf-8")

    // Append the new exclude pattern to localSettings.addRules
    updatedSettings = appendToLocalSettings(currentSettings, {
        addRules: [ pattern ]
    })

    // Persist
    writeFile(settingsPath, JSON.stringify(updatedSettings), encoding="utf-8")

    // Compute display path relative to cwd for confirmation message
    displayPath = path.relative(cwd, settingsPath)
    // → ".claude/settings.local.json"

    emitTelemetry("sandbox_exclude_command", { pattern: pattern })
    return "success"
```

Settings layer hierarchy (from lowest to highest priority):

| Layer | Source key | File |
|---|---|---|
| Local (written here) | `localSettings` | `.claude/settings.local.json` |
| Project | `projectSettings` | `.claude/settings.json` |
| User | `userSettings` | `~/.claude/settings.json` |
| Flag | `flagSettings` | *(feature-flag overrides)* |
| Policy | `policySettings` | `managed-settings.json` |

Analysis basis: CC v2.1.133 bundle.js:+11311023 (path resolution call), +11311047 (relative path call), +11311068 (literal `.claude/settings.local.json`), +11311103 (literal `"success"`), +3990539 (literal `"localSettings"`), +3990630 (literal `"addRules"`), +1165169 (literal `"policySettings"`), +1165191 (literal `"flagSettings"`), +1165720 (literal `"userSettings"`), +1165835 (literal `"projectSettings"`), +1165772 (encoding `"utf-8"`), +1157700 (literal `"managed-settings.json"`), +1161075 (literal `"settings.json"`), +1161436 (literal `"settings.local.json"`)

---

### Terminal Color Rendering (Internal Utility)

The command output path routes through a terminal color helper (`ansiColorRenderer`) that maps named color tokens to ANSI escape sequences. Supported named colors:

`black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, and the `*Bright` variants of each, plus `hex(…)`, `bgHex(…)`, `ansi256(…)`, and `rgb(…,…,…)` forms. Background (`bg*`) variants are also fully supported.

Color token prefixes parsed:
- `"rgb("` — 3-component RGB
- `"ansi256("` — 256-color index
- `"ansi:"` — raw ANSI code

Analysis basis: CC v2.1.133 bundle.js:+3553301 (`"rgb("`), +3553342 (`"ansi256("`), +3553368 (`"ansi:"`), +3227667–+3228887 (full color method call sites)

---

### Theme Detection

The color renderer respects the terminal theme. Detected theme tokens:

| Token | Meaning |
|---|---|
| `"light"` | Light background terminal |
| `"light-ansi"` | Light + ANSI-only colors |
| `"dark-ansi"` | Dark + ANSI-only colors |
| `"light-daltonized"` | Light + daltonized (color-blind accessible) |
| `"dark-daltonized"` | Dark + daltonized |

The `"foreground"` literal drives foreground-color selection in the ANSI renderer.

Analysis basis: CC v2.1.133 bundle.js:+11310066 (literal `"light"`), +3553244 (literal `"foreground"`), +1090232–+1090321 (theme token literals)

---

### MCP Server Coordination (Side Effect)

During settings application, the implementation touches the MCP client layer. This includes:

- Iterating current MCP server entries via `Object.entries`
- Applying configuration updates to active clients (`applyMcpUpdate`)
- Performing cleanup on stale connections (`cleanup`)
- Retrying failed remote servers; logging `"[MCP] Retry: all remote servers recovered, stopping"` when all recover
- Emitting `tengu_mcp_retry_failed_remote` if retry ultimately fails

Transport types recognized during MCP reconnection: `"stdio"`, `"sse"`, `"http"`, `"sse-ide"`, `"ws-ide"`, `"claudeai-proxy"`.

Analysis basis: CC v2.1.133 bundle.js:+13870916 (applyMcpUpdate), +13871045 (cleanup), +13870729 (telemetry event), +13871486 (log string), +9474979–+9475114 (transport literals)

---

### Daemon Lifecycle (Side Effect on Exit Path)

If the process exits during command execution (e.g., via `process.exit` in the process-race path), a daemon stop sequence is triggered:

```
function daemonShutdown():
    try:
        stopDaemon()
        emit("daemon_stop")
    catch:
        emit("daemon_stop_failed")
```

A 500 ms grace-period timeout is applied inside the process-race (`Promise.race`) before `process.exit` is called.

Analysis basis: CC v2.1.133 bundle.js:+14191288 (daemon stop entry), +14191291 (literal `"daemon_stop"`), +14191328 (literal `"daemon_stop_failed"`), +14191366 (telemetry `tengu_daemon_control`), +14186532 (Promise.race), +14186574 (numeric literal `500`), +14186613 (process.exit)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_mcp_retry_failed_remote` | Fired when MCP remote server retry exhausts all attempts (bundle.js:+13870729) |
| Telemetry — `tengu_feature_ok` | Fired on successful feature flag / settings read (bundle.js:+907381) |
| Telemetry — `tengu_feature_bad` | Fired on failed feature flag / settings read (bundle.js:+907437) |
| Telemetry — `tengu_daemon_control` | Fired during daemon start/stop lifecycle triggered on process exit (bundle.js:+14191366) |
| Telemetry — `sandbox_exclude_command` | Fired after a successful exclude-rule write (bundle.js:+3990916) |
| Settings file written | `.claude/settings.local.json` — appends to `addRules` inside `localSettings` layer |
| MCP clients updated | `applyMcpUpdate` called on active MCP sessions after settings change |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.133 | Initial analysis — `exclude` sub-command, platform guard (macOS/Linux/WSL2), policy lock enforcement, `localSettings` write to `.claude/settings.local.json` |

---

## Common Mistakes

1. **Running on WSL1**: The command explicitly rejects WSL1 with a distinct error. Upgrade to WSL2 before using `/sandbox`.
2. **Omitting the pattern argument**: `/sandbox exclude` with no trailing pattern triggers the usage-hint error. Always quote patterns that contain spaces or wildcards, e.g., `/sandbox exclude "npm run test:*"`.
3. **Expecting global settings to change**: The command writes exclusively to `.claude/settings.local.json` (the project-local layer). Enterprise-managed or user-level settings are not modified and, if locked by policy, will block the command entirely.
4. **Assuming Windows (non-WSL) support**: The supported platform list is macOS, Linux, and WSL2 only. Native Windows is not supported.
5. **Double-quoting glob patterns in shells**: Because the argument hint itself shows a quoted string (`exclude "command pattern"`), users running from a shell may inadvertently strip inner quotes. Pass the pattern so that Claude Code receives the literal quotes.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `kY7` | Top-level sandbox command handler function |
| `K_` | ANSI color string parser / renderer dispatcher |
| `H` | Random-delay / setTimeout utility (used in color spinner or retry backoff) |
| `a5H` | Named-color-to-ANSI-escape mapping function |
| `cp` | Color-pipeline compositor / chalk-like chain finisher |
| `M` | MCP server manager / settings orchestrator |
| `iZH` | MCP connection initializer (iterates server entries, builds client list) |
| `mFq` | MCP update applicator (calls `applyMcpUpdate`, cleanup, reconnect) |
| `K` | Async task queue manager (add/delete with finally cleanup) |
| `k` | Log-level / debug formatter (normalizes log strings, trims, uppercases) |
| `$` | Cross-domain query dispatcher (wraps `XDq`) |
| `J6` | Tool-permission / allow-set manager (checks `b5H`, `cU` sets) |
| `Og7` | MCP retry-and-reconcile orchestrator (filters, calls `iZH`, `mFq`) |
| `z` | Daemon lifecycle controller (stop, stop-failed, process-exit race) |
| `hH` | Daemon stop attempt function |
| `uH` | Daemon stop failure handler |
| `bS` | First-party server bootstrapper |
| `cC` | Process-exit race runner (Promise.race with 500 ms timeout) |
| `x1A` | Settings file loader and rule appender (`localSettings` / `addRules`) |
| `h8` | Feature-flag reader (emits `tengu_feature_ok` / `tengu_feature_bad`) |
| `A` | Current settings object being processed (context-dependent) |
| `lxK` | Pattern match utility (calls `H.match` on rule strings) |
| `q` | Active-request set or file-unlink utility (context-dependent) |
| `xA` | Settings file writer (resolves layers, writes JSON with utf-8 encoding) |
| `ZO` | Settings path resolver (joins `.claude/settings.json` and related paths) |
| `C6H` | Absolute path resolver (wraps `wj.resolve`, traverses upward) |
| `TWL` | Settings file existence checker (`IaH`, `kH` sub-checks) |
| `Qb` | User-level settings path builder (`~/.claude/settings.local.json`) |
| `GWL` | Managed-settings path builder (`managed-settings.json` via `wj.join`) |
| `oLH` | Directory creation / mkdir utility |
| `eg` | Final output emitter / result renderer for the sandbox command |