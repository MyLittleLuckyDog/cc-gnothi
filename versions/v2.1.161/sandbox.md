---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.161"
updated: "2026-06-03"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.161 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.161 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.161

---

## Overview

`/sandbox` configures the sandboxing behavior for Claude Code's tool execution environment. It supports toggling sandbox settings and adding command patterns to the exclusion list (commands that should run outside the sandbox). The command validates platform compatibility, checks policy locks, and persists changes to the local settings file.

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
| module_id | `dHK` |
| load_inline | `true` |
| loc_byte | `12493363` |
| loc_byte_end | `12494012` |
| loc_line | `8778` |
| arbor_handler.name | `_vf` |
| arbor_handler.fqn | `claude-2.1.161::_vf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.161 bundle.js:+12493363

---

## Input Branching

The command exhibits 5+ distinct input/state paths, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/sandbox invoked"] --> B{Platform check:\nisSupportedPlatform?}
    B -- "No (not macOS/Linux/WSL2)" --> C["Return error:\n'Sandboxing is currently only supported\non macOS, Linux, and WSL2.'"]
    B -- "WSL1 detected" --> D["Return error:\n'Sandboxing requires WSL2.\nWSL1 is not supported.'"]
    B -- "Supported" --> E{Check dependencies:\ncheckDependencies}
    E -- "Missing deps" --> F["Return dependency error UI"]
    E -- "OK" --> G{isPlatformInEnabledList?}
    G -- "Not enabled" --> H["Render configuration UI\n(toggle/configure sandbox)"]
    G -- "Enabled" --> I{areSandboxSettingsLockedByPolicy?}
    I -- "Locked" --> J["Return error:\n'Sandbox settings are overridden by\na higher-priority configuration\nand cannot be changed locally.'"]
    I -- "Not locked" --> K{Parse argument:\nfirst token == 'exclude'?}
    K -- "No / empty args" --> H
    K -- "Yes: 'exclude'" --> L{Remainder length > 8 chars?}
    L -- "No / empty pattern" --> M["Return error:\n'Please provide a command pattern\nto exclude (e.g., /sandbox exclude\n\"npm run test:*\")'"]
    L -- "Yes: pattern present" --> N["Parse exclude pattern\nfrom argument slice"]
    N --> O["Load local settings\nfrom .claude/settings.local.json"]
    O --> P["Append pattern to\nsandboxExcludeRules list"]
    P --> Q["Persist updated settings\nvia settingsWriter"]
    Q --> R["Emit telemetry:\nsandbox_exclude_command"]
    R --> S["Return success UI"]
```

Analysis basis: CC v2.1.161 bundle.js:+12491982 – +12493031

---

## Behavioral Spec

### 1. Platform Validation

```
async function handleSandboxCommand(args, context):
    themeMode = getThemeMode()   // checks for "light" theme variant

    platformInfo = getPlatformInfo()
    wslVersion = getWSLVersion(platformInfo)

    if wslVersion == "wsl" (i.e. WSL1):
        return errorMessage("Error: Sandboxing requires WSL2. WSL1 is not supported.")

    if NOT isSupportedPlatform(platformInfo):
        return errorMessage("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")
```

Analysis basis: CC v2.1.161 bundle.js:+12492004, +12492013, +12492049, +12492055, +12492113

### 2. Dependency and Enablement Check

```
    depResult = await checkDependencies()
    if depResult has errors:
        return renderDependencyErrorUI(depResult)

    if NOT isPlatformInEnabledList(platformInfo):
        return renderConfigureUI(context)   // interactive toggle UI
```

Analysis basis: CC v2.1.161 bundle.js:+12492230, +12492257

### 3. Policy Lock Guard

```
    if areSandboxSettingsLockedByPolicy():
        return errorMessage(
            "Error: Sandbox settings are overridden by a higher-priority " +
            "configuration and cannot be changed locally."
        )
```

Policy lock takes priority over all local configuration changes.

Analysis basis: CC v2.1.161 bundle.js:+12492419, +12492478

### 4. Argument Parsing — Exclude Sub-Command

```
    tokens = args.split(...)
    firstToken = tokens[0]

    if firstToken == "exclude":
        pattern = args.slice(8)    // skip "exclude " prefix (8 chars)

        if pattern is empty or too short:
            return errorMessage(
                'Error: Please provide a command pattern to exclude ' +
                '(e.g., /sandbox exclude "npm run test:*")'
            )

        excludeRules = loadExcludeRules(currentSettings)
        updatedRules = appendRule(excludeRules, pattern)
        writeLocalSettings(updatedRules)
        emitTelemetry("sandbox_exclude_command")
        return successUI()
    else:
        return renderConfigureUI(context)
```

The literal `8` corresponds to `len("exclude ")`. The argument hint `exclude "command pattern"` matches this parsing logic.

Analysis basis: CC v2.1.161 bundle.js:+12492705, +12492728, +12492745, +12492753, +12492790

### 5. Settings Persistence

```
function writeLocalSettings(updatedSettings):
    targetPath = ".claude/settings.local.json"
    settingsLoader = loadSettingsFromDisk()
    mergedSettings = merge(currentLocalSettings, updatedSettings)
    atomicWrite(targetPath, JSON.stringify(mergedSettings))
    emitEvent("success")
```

Changes are written exclusively to `.claude/settings.local.json`, leaving project-level and user-level settings untouched.

Analysis basis: CC v2.1.161 bundle.js:+12492938, +12492975, +12492988, +12492996, +12493031

### 6. Exclude Rule Application (localSettings / addRules)

The `addRules` path within the settings layer (`localSettings`) collects patterns from the `exclude` sub-command and merges them into the sandbox configuration before writing. A filter step checks whether a rule already matches an existing entry to avoid duplicates.

Analysis basis: CC v2.1.161 bundle.js:+4669365, +4669433, +4669456, +4669646, +4669660

### 7. Interactive Configuration UI

When no recognized sub-command is supplied and the platform is supported but sandbox is not yet in the enabled list — or after a non-`exclude` invocation on an enabled platform — the command renders a JSX-based configuration panel. This panel allows the user to toggle sandbox on/off interactively. The `immediate: true` registration flag means the UI is rendered without requiring an Enter confirmation.

Analysis basis: CC v2.1.161 bundle.js:+12492190, +12492214

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_feature_ok` | Emitted on successful feature operations (bundle.js:+966587) |
| Telemetry — `tengu_feature_sad` | Emitted when feature encounters a non-fatal degraded state (bundle.js:+966732) |
| Telemetry — `tengu_feature_bad` | Emitted on feature failure conditions (bundle.js:+966650) |
| Telemetry — `tengu_daemon_control` | Emitted during daemon lifecycle operations invoked indirectly through the sandbox layer (bundle.js:+15940522) |
| Telemetry — `sandbox_exclude_command` | Emitted when an exclude pattern is successfully added (bundle.js:+4669742) |
| Settings write | Persists changes to `.claude/settings.local.json` (bundle.js:+12492996) |
| Settings read | Loads current local settings via `loadSettingsFromDisk` before merging (bundle.js:+1230098) |
| Cache clear | `nz` clears internal settings caches (`Cx6`, `IU8`) on settings reload (bundle.js:+26612, +26624) |
| Daemon interaction | Daemon stop/stop-failed paths reachable via the sandbox orchestration layer (literals: `daemon_stop`, `daemon_stop_failed` at bundle.js:+15940447, +15940484) |
| Process exit | `process.exit` reachable in daemon shutdown path (bundle.js:+15935615) |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.161 | Initial analysis |

---

## Common Mistakes

1. **Running on unsupported platforms**: `/sandbox` will immediately return an error if invoked on Windows (non-WSL) or WSL1. WSL2 is the minimum Windows subsystem requirement.
2. **Omitting quotes around patterns with wildcards**: The argument hint `exclude "command pattern"` signals that patterns containing spaces or glob characters (e.g., `npm run test:*`) must be quoted to be parsed as a single token.
3. **Attempting local configuration when policy is locked**: If an organization policy has locked sandbox settings, `/sandbox` will reject all local changes with an explicit error message regardless of what is passed as arguments.
4. **Expecting project-level settings to be modified**: The command writes exclusively to `.claude/settings.local.json`. Project-level (`settings.json`) and user-level settings are never mutated by this command.
5. **Passing `exclude` without a pattern**: Typing `/sandbox exclude` with no following pattern will trigger the missing-pattern error. A non-empty command pattern string must follow the `exclude` keyword.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `_vf` | Main async handler for `/sandbox` command (arbor_handler) |
| `WA` | Terminal color/ANSI string renderer used for output formatting |
| `H` | Bootstrap fetch / network utility (settings and API loader) |
| `N` | Log/debug message formatter with level support |
| `VBK` | Log entry constructor (wraps `qy`, `ZBK`, `HwA`) |
| `SH` | JSON serializer utility (`JSON.stringify` wrapper) |
| `Z4` | String redaction and path manipulation utility |
| `imH` | Settings field getter (`GJA` wrapper) |
| `IBK` | File write utility with byte-length tracking and staging |
| `s$` | Secondary settings/state accessor |
| `ne` | Platform/feature set membership checker |
| `Ij` | String replace helper |
| `lq` | Model name resolver/normalizer |
| `xHH` | Model name normalization core logic |
| `s9` | Model alias expander (handles `sonnet`, `haiku`, `opus`, `best`, etc.) |
| `xP` | Model selection pipeline orchestrator |
| `t6` | UI render helper (terminal output) |
| `d` | Base terminal output / logging primitive |
| `h1H` | Terminal formatter (wraps `d` output) |
| `LYH` | ANSI/chalk color tag parser (handles named colors, hex, rgb, ansi256) |
| `yd` | Color theme resolver |
| `M` | Temporary file / staging path manager |
| `nC6` | Plugin name resolver and path validator |
| `iC6` | Plugin path joiner |
| `L` | Temporary resource set (add/delete/finally cleanup) |
| `q` | Filesystem unlink / delete set |
| `f` | Socket or stream close handler |
| `z` | Daemon orchestrator (start/stop/communicate) |
| `hH` | Daemon-related output formatter (success path) |
| `RH` | Daemon-related output formatter (failure path) |
| `ly` | Daemon process launcher |
| `gx` | Process spawn wrapper |
| `dR` | Low-level process executor |
| `sVH` | First-party plugin classifier |
| `cy` | Plugin type resolver |
| `rw_` | Daemon session initializer (UUID, emit) |
| `tA8` | Daemon RPC message builder |
| `hU` | Random-bytes / hex token generator |
| `qp` | Daemon shutdown coordinator (Promise.race, process.exit) |
| `Gd` | Daemon shutdown signal sender |
| `vd` | Timeout-clear + signal dispatcher |
| `Zj_` | Datadog/telemetry post utility |
| `n8` | Abort/timeout orchestrator |
| `K` | Server list formatter (padEnd) |
| `O` | Background session state holder |
| `VT_` | Settings rule filter and exclude-rule builder |
| `m8` | Settings loader entry point |
| `xd6` | Settings cache lookup |
| `IYA` | Settings cache read (`Cx6.has` / `Cx6.get`) |
| `Xe8` | Settings merge orchestrator |
| `kYA` | Settings cache writer (`Cx6.set`) |
| `TQ` | Settings object builder (all layers) |
| `P_` | Settings validator / schema checker |
| `mK6` | Settings field: model key handler |
| `BB8` | Settings field handler |
| `CK6` | Settings field handler |
| `zEH` | Settings field handler |
| `DEH` | Settings field handler |
| `UK6` | Settings field handler |
| `zOH` | Settings field handler |
| `DOH` | Settings field handler |
| `ze8` | Settings field handler |
| `UCA` | Settings field handler |
| `Kr` | Settings field handler |
| `HM6` | Settings field: feature-flag merger |
| `GFL` | Argument pattern matcher (regex match on raw args) |
| `l_` | Core settings loader and writer (disk I/O, cache, gitignore) |
| `BO` | Settings read orchestrator (combines `jOH` + `TQ`) |
| `jOH` | User/project settings path resolver |
| `F6` | Filesystem existence check |
| `mX` | Settings merge helper |
| `ai` | File reader with size limit (4096-byte chunk) |
| `k8` | ENOENT-safe file reader |
| `v8` | Null-safe file content wrapper |
| `wt8` | Settings write-timestamp recorder |
| `qTH` | Settings path resolver (`bd6` + `TQ`) |
| `bd6` | Settings file path resolver (resolve/dirname) |
| `Y56` | Atomic file writer (temp + rename, fchmod, fsync) |
| `nz` | Settings cache invalidator (`Cx6.clear`, `IU8.clear`) |
| `QQ6` | Gitignore / excludesfile read-write handler |
| `h6` | Git check-ignore runner |
| `as8` | Git config reader wrapper |
| `A` | Platform lowercase string utility |
| `gQ6` | Git ignore pattern helper |
| `K54` | Path expander with homedir resolution |
| `dSA` | Git ignore check utility |
| `cSA` | Git ignore append utility |
| `wx` | `.claude` directory path joiner |
| `np` | Settings load coordinator (start/end telemetry) |
| `ZT` | Settings load-start telemetry emitter |
| `C9` | Memory-usage telemetry sampler |
| `We8` | Full settings load implementation (multi-layer merge) |
| `bx6` | Settings load-end telemetry emitter |
| `yH` | Error log and queue manager |
| `a_` | Error wrapper (String coercion) |
| `pH` | String coercion primitive |
| `r9` | Essential-traffic queue checker |
| `s44` | Log queue shift/push ring buffer |
| `ji` | Settings write finalizer / post-write action |

---

*Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.*