---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.143"
updated: "2026-05-18"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.143 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.143 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.143

---

## Overview

The `/sandbox` command configures Claude Code's sandbox execution environment by managing which command patterns are excluded from sandboxed execution. Its primary sub-command is `exclude`, which writes an exclusion rule into the local project settings file (`.claude/settings.local.json`). Before applying any changes the command performs platform compatibility checks and policy lock guards.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `sandbox` |
| description | *(null — no description registered)* |
| argumentHint | `exclude "command pattern"` |
| immediate | `true` |
| module\_id | `QGq` |

Analysis basis: CC v2.1.143 bundle.js:+11610426

---

## Input Branching

The command handler (`sandboxCommandHandler`) follows these decision branches upon invocation:

```mermaid
flowchart TD
    A(["/sandbox [args]"]) --> B{isSupportedPlatform?}
    B -- No --> C{platform == 'wsl'?}
    C -- Yes --> D["Emit error:\nWSL1 not supported\n(WSL2 required)"]
    C -- No --> E["Emit error:\nOnly macOS / Linux / WSL2 supported"]
    B -- Yes --> F{checkDependencies OK?}
    F -- No --> G["Emit dependency error\n(type: 'error')"]
    F -- Yes --> H{isPlatformInEnabledList?}
    H -- No --> I["Emit platform-not-enabled warning"]
    H -- Yes --> J{areSandboxSettingsLockedByPolicy?}
    J -- Yes --> K["Emit error:\nSettings overridden by higher-priority config"]
    J -- No --> L{args split — first token == 'exclude'?}
    L -- No / missing --> M["Emit usage error:\nProvide a command pattern\n(e.g. /sandbox exclude \"npm run test:*\")"]
    L -- Yes --> N{pattern token present?\n(args.slice(8) non-empty)}
    N -- No --> M
    N -- Yes --> O["Strip surrounding quotes\nvia z.replace()"]
    O --> P["Read localSettings via settingsReader\nkey: 'localSettings'"]
    P --> Q["Append rule via addRulesHandler\nkey: 'addRules'"]
    Q --> R["Persist to\n.claude/settings.local.json"]
    R --> S["Emit 'sandbox_exclude_command'\ntelemetry via settingsPersist"]
    S --> T(["Display success message"])
```

Analysis basis: CC v2.1.143 bundle.js:+11609045 – +11610094

---

## Behavioral Spec

### Platform Compatibility Check

```
function checkPlatformCompatibility(platformInfo):
    if NOT platformInfo.isSupportedPlatform():
        if platformInfo.kind == "wsl":
            return error("Error: Sandboxing requires WSL2. WSL1 is not supported.")
        else:
            return error("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")
    return OK
```

Analysis basis: CC v2.1.143 bundle.js:+11609076, +11609112, +11609118, +11609176

Supported platforms: macOS, Linux, and WSL2. WSL1 is explicitly rejected with a distinct error message.

---

### Dependency Check

```
function checkSandboxDependencies(context):
    result = context.checkDependencies()
    if result.failed:
        emit({ type: "error", message: result.errorMessage })
        return ABORT
    return OK
```

Analysis basis: CC v2.1.143 bundle.js:+11609293, +11609256

The dependency check result is surfaced with `type: "error"`.

---

### Platform Enabled-List Check

```
function checkPlatformEnabled(context):
    if NOT context.isPlatformInEnabledList():
        emit warning to UI
        // execution may still continue; this is advisory
    return CONTINUE
```

Analysis basis: CC v2.1.143 bundle.js:+11609320

---

### Policy Lock Guard

```
function checkPolicyLock(context):
    if context.areSandboxSettingsLockedByPolicy():
        return error(
            "Error: Sandbox settings are overridden by a higher-priority configuration " +
            "and cannot be changed locally."
        )
    return OK
```

Policy lock is evaluated after platform and dependency checks. When locked, no settings write is attempted.

Analysis basis: CC v2.1.143 bundle.js:+11609482, +11609541

---

### Argument Parsing — Exclude Sub-command

```
function parseExcludeArgument(rawArgs):
    tokens = rawArgs.split(separator)           // M.split
    subCommand = tokens[0]                      // first token

    if subCommand != "exclude":
        return error(
            "Error: Please provide a command pattern to exclude " +
            "(e.g., /sandbox exclude \"npm run test:*\")"
        )

    // The literal offset 8 corresponds to len("exclude ") = 8
    patternRaw = rawArgs.slice(8)               // M.slice, offset literal: 8

    if patternRaw is empty:
        return error(same usage message as above)

    // Strip optional surrounding double-quotes
    pattern = patternRaw.replace(quoteStripRegex, "")   // z.replace

    return { subCommand: "exclude", pattern: pattern }
```

Analysis basis: CC v2.1.143 bundle.js:+11609768, +11609791, +11609808, +11609816, +11609853, +11609972

Slice offset constant: `8` (bundle.js:+11609816), matching the byte length of the prefix `"exclude "`.

---

### Settings Read and Rule Addition

```
function applyExcludeRule(pattern, projectRoot):
    // Read current local settings
    localSettings = settingsReader.get("localSettings")     // key literal: "localSettings"

    // Filter existing rules, check for inclusion
    existingRules = localSettings.filter(...)               // jf_._.filter
    alreadyPresent = existingRules.includes(pattern)        // q.includes

    if NOT alreadyPresent:
        // Append new rule via addRules handler
        updatedSettings = addRulesHandler(                  // key literal: "addRules"
            localSettings,
            pattern
        )

        // Resolve target path
        relPath = FGq.relative(projectRoot, ...)            // path.relative
        targetFile = ".claude/settings.local.json"          // literal

        // Persist settings
        settingsPersist(updatedSettings, targetFile)

    // Emit telemetry regardless
    emit telemetry("sandbox_exclude_command")
```

Analysis basis: CC v2.1.143 bundle.js:+11610001, +11610014, +11610038, +11610051, +11610059, +11610094

Target settings file: `.claude/settings.local.json` (bundle.js:+11610059).

---

### Settings Persistence Layer

The persistence path (`settingsPersistHandler`) delegates through a layered settings stack. Layers resolved during traversal (by key name constants found in the call graph):

| Layer key | Description |
|---|---|
| `policySettings` | Read-only; enforced by administrator policy |
| `flagSettings` | Feature-flag overrides |
| `userSettings` (encoded `utf-8`) | Per-user settings |
| `projectSettings` | Per-project settings |
| `localSettings` | Per-project local overrides (`.claude/settings.local.json`) |

Analysis basis: CC v2.1.143 bundle.js:+1206298, +1206320, +1206856, +1206908, +1206971

The `localSettings` layer is the only layer written by `/sandbox exclude`.

---

### Pattern Matching Utility

```
function matchesExcludePattern(input, pattern):
    // Uses regex exec against input string
    result = patternRegex.exec(input)           // ZeL: H.match
    return result != null
```

Analysis basis: CC v2.1.143 bundle.js:+4436054, +4428389

---

### Color / ANSI Output Rendering

The output renderer (`ansiColorRenderer`) supports the full terminal color palette for displaying command results. Supported color modes (from literals):

- Named colors: `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white` and their `Bright` variants
- `ansi256(n)` — 256-color palette
- `rgb(r,g,b)` — true-color
- `hex(#rrggbb)` — hex notation
- Theme variants: `light-ansi`, `dark-ansi`, `light-daltonized`, `dark-daltonized`

The renderer checks whether output begins with `"foreground"` or color-prefix tokens (`"rgb("`, `"ansi256("`, `"ansi:"`) before applying styling.

Analysis basis: CC v2.1.143 bundle.js:+3692201, +3692245, +3692258, +3692299, +3692325, +3302115

---

### MCP State During Command Execution

The `/sandbox` command shares execution infrastructure with the MCP (Model Context Protocol) connection manager. During execution, the call graph reaches MCP-related routines including:

- `mcpConnectionManager.get` and `mcpConnectionManager.values` — reading current server state
- `applyMcpUpdate` — applying any pending MCP configuration updates
- MCP transport types checked: `stdio`, `sse`, `http`, `sse-ide`, `ws-ide`, `claudeai-proxy`
- Connection states observed: `disabled`, `needs-auth`, `connected`, `failed`
- Log message emitted on full recovery: `"[MCP] Retry: all remote servers recovered, stopping"`

Analysis basis: CC v2.1.143 bundle.js:+9694745, +9694847, +9694881, +9694913, +9694946, +9694982, +9695254, +9695386, +9695452, +9695554, +9696127, +14234339, +14234909

<!-- TODO: depth-2 traversal reaches MCP manager but the precise interaction contract between /sandbox and MCP lifecycle requires --depth 4 to fully characterize. -->

---

### Daemon Control (via Settings Persist Path)

The settings persistence path can trigger daemon lifecycle events:

```
function daemonControlOnPersist(settings):
    try:
        stopDaemon()                    // event: "daemon_stop"
        emitTelemetry("tengu_daemon_control")
    catch error:
        emitTelemetry("tengu_feature_bad")  // via mH → d
        logEvent("daemon_stop_failed")
```

Analysis basis: CC v2.1.143 bundle.js:+14538195, +14538218, +14538273, +955066, +955124

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_feature_ok` | Fired on successful settings write path (bundle.js:+955068) |
| Telemetry — `tengu_feature_bad` | Fired on settings write failure / daemon stop failure (bundle.js:+955126) |
| Telemetry — `tengu_daemon_control` | Fired when daemon stop is triggered via settings persistence (bundle.js:+14538273) |
| Settings write | Appends exclusion rule to `.claude/settings.local.json` |
| Hook registration | `WCH.emit` called during settings persist path (bundle.js:+1207214) — triggers registered settings-change hooks |
| appState changes | Local settings layer (`localSettings`) updated in memory and on disk |
| Pattern telemetry | `sandbox_exclude_command` string written to telemetry on rule addition (bundle.js:+4436189) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| File unlink | `n8K.unlinkSync` reachable via `q` path (bundle.js:+14482768) — may remove stale lock/temp files during settings operation |
| Process exit | `process.exit` reachable via `Ox` / `processRaceHandler` (bundle.js:+14533452) — used in daemon shutdown path; 500 ms timeout constant (bundle.js:+14533413) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.143 | Initial analysis — `exclude` sub-command, platform guards, policy lock, `.claude/settings.local.json` persistence |

---

## Common Mistakes

1. **Running on WSL1**: The command explicitly detects WSL version and rejects WSL1 with a distinct error. Users must upgrade to WSL2. Analysis basis: CC v2.1.143 bundle.js:+11609112.

2. **Omitting the pattern argument**: Calling `/sandbox exclude` with no pattern after the keyword produces a usage error. The pattern must follow the keyword with exactly one space (the slice offset is hardcoded to `8`). Analysis basis: CC v2.1.143 bundle.js:+11609816, +11609853.

3. **Expecting changes when policy locks are active**: If an administrator policy has locked sandbox settings, the command exits with an error and writes nothing. The local settings file is not modified. Analysis basis: CC v2.1.143 bundle.js:+11609482.

4. **Editing `.claude/settings.json` instead of `.claude/settings.local.json`**: The command always writes to the *local* settings file. Changes to the non-local project settings file will not be reflected as exclusion rules added by this command. Analysis basis: CC v2.1.143 bundle.js:+11610059.

5. **Assuming the command works on Windows (non-WSL)**: Only macOS, Linux, and WSL2 are in the supported platform list. Native Windows is not supported and will produce the generic platform error. Analysis basis: CC v2.1.143 bundle.js:+11609176.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `dk7` | Sandbox command handler (main entry point) |
| `OA` | ANSI color string prefix parser / foreground color resolver |
| `w$H` | ANSI color name-to-method dispatcher |
| `vF` | Color rendering fallback / passthrough renderer |
| `M` | MCP server connection manager |
| `SvH` | MCP server connection initializer / connector |
| `THK` | MCP update applier (applies pending config deltas) |
| `L` | Async task queue / promise tracker for MCP operations |
| `v` | Log-level filter / debug message formatter |
| `$` | MCP client registry lookup helper |
| `B95` | MCP server state reconciler (filter + update loop) |
| `z` | Settings file path resolver |
| `SH` | Daemon stop handler (success path) |
| `mH` | Daemon stop handler (failure path) |
| `xN` | First-party tool/server registration handler |
| `Ox` | Process race / shutdown coordinator (with 500 ms timeout) |
| `jf_` | Exclude-rule list manager (read, filter, add rules) |
| `I8` | Settings layer initializer (`localSettings` key reader) |
| `ZeL` | Command pattern regex matcher |
| `q` | Stale-file cleanup handler (`unlinkSync`) |
| `p_` | Settings persistence writer (multi-layer) |
| `wO` | Settings file path constructor |
| `k5H` | Settings file join / path builder |
| `WB` | Settings object builder (assembles all layer objects) |
| `Fd` | Success / result renderer for `/sandbox` output |