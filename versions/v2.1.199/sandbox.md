---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.199"
updated: "2026-07-03"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.199 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.199 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.199

---

## Overview

The `/sandbox` command configures the sandboxing execution environment for Claude Code, controlling which shell commands are permitted or excluded from the sandbox. It validates platform support, checks policy locks, and — when invoked with the `exclude` sub-command and a valid pattern — appends an exclusion rule to the project-local settings file (`.claude/settings.local.json`). Pressing Enter without arguments opens an interactive configuration UI (a JSX component).

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
| module_id | `Dcc` |
| load_inline | `true` |
| loc_byte | `13243362` |
| loc_byte_end | `13244057` |
| loc_line | `9855` |
| arbor_handler.name | `hcm` |
| arbor_handler.fqn | `claude-2.1.199::hcm` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.199 bundle.js:+13243362

---

## Input Branching

The handler exhibits four distinct decision branches based on platform support, policy lock state, and user-supplied arguments. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/sandbox invoked"] --> B{Platform supported?\nTo.isSupportedPlatform}
    B -- "No (WSL1)" --> C["Return error:\n'Sandboxing requires WSL2.\nWSL1 is not supported.'"]
    B -- "No (other OS)" --> D["Return error:\n'Sandboxing is currently only supported\non macOS, Linux, and WSL2.'"]
    B -- Yes --> E{Check dependencies\nTo.checkDependencies}
    E -- "Missing deps" --> F["Return error message\nfrom dependency check"]
    E -- OK --> G{Platform in enabled list?\nTo.isPlatformInEnabledList}
    G -- No --> H["Return platform not enabled\nerror/info message"]
    G -- Yes --> I{Arguments supplied?}
    I -- "No args\n(Enter pressed)" --> J["Render interactive JSX\nconfiguration component\nPcc.jsx"]
    I -- "Arg[0] == 'exclude'" --> K{Policy locked?\nTo.areSandboxSettingsLockedByPolicy}
    K -- Yes --> L["Return error:\n'Sandbox settings are overridden by a\nhigher-priority configuration and\ncannot be changed locally.'"]
    K -- No --> M{Pattern argument\npresent? (index 1+)}
    M -- No --> N["Return error:\n'Please provide a command pattern\nto exclude (e.g., /sandbox exclude\n\"npm run test:*\")'"]
    M -- Yes --> O["Parse exclusion pattern\nfrom args (split, slice at index 8)"]
    O --> P["Apply pattern via\nexcludeCommandRule\nZuo/Hf pipeline"]
    P --> Q["Persist rule to\n.claude/settings.local.json"]
    Q --> R["Display relative path +\n'success' confirmation"]
    I -- "Other subcommand" --> J
```

Analysis basis: CC v2.1.199 bundle.js:+13241998 through +13243030

---

## Behavioral Spec

### Platform and Dependency Guard

```
async function sandboxHandler(context, args):
    theme = getThemeKind()             // ts() — determines "light" or dark
    wslVersion = getWslVersion()       // jt()

    if NOT platformSupported(platform):
        if wslVersion == "wsl" and wslVersion < 2:
            return errorResult("Sandboxing requires WSL2. WSL1 is not supported.")
        else:
            return errorResult("Sandboxing is currently only supported on macOS, Linux, and WSL2.")

    depCheck = await checkDependencies()   // To.checkDependencies
    if depCheck has errors:
        return errorResult(depCheck.message, type="error")

    if NOT isPlatformInEnabledList(platform):  // To.isPlatformInEnabledList
        return infoResult("platform not in enabled list")
```

Analysis basis: CC v2.1.199 bundle.js:+13241998, +13242020, +13242029, +13242206, +13242246, +13242273

### Interactive Configuration (No-Argument Path)

```
    if args is empty OR args[0] != "exclude":
        return renderJSX(SandboxConfigComponent)   // Pcc.jsx
```

When invoked with no arguments (or Enter key, due to `immediate: true`), the command returns a JSX element rendered by the sandbox configuration component, presenting an interactive UI to the user.

Analysis basis: CC v2.1.199 bundle.js:+13242652

### Exclude Sub-command

```
    subCommand = args.split()[0]           // index 0
    if subCommand == "exclude":
        if areSandboxSettingsLockedByPolicy():   // To.areSandboxSettingsLockedByPolicy
            return errorResult(
                "Error: Sandbox settings are overridden by a higher-priority " +
                "configuration and cannot be changed locally."
            )

        // Extract the pattern — args are split; pattern starts after the "exclude" keyword
        // The slice offset of 8 characters corresponds to stripping "exclude " prefix
        rawArgs   = args.split()
        pattern   = args.slice(8)   // strips "exclude " (8 chars)

        if pattern is empty or blank:
            return errorResult(
                'Error: Please provide a command pattern to exclude ' +
                '(e.g., /sandbox exclude "npm run test:*")'
            )

        // Apply the exclusion rule through the settings pipeline
        await addExcludeRule(pattern)      // Zuo → Hf → fKu → settings write
```

Analysis basis: CC v2.1.199 bundle.js:+13242703, +13242716, +13242726, +13242743, +13242751, +13242788, +13242435, +13242494

### Exclude Rule Persistence Pipeline

```
async function addExcludeRule(pattern):
    // Zuo: filter existing rules, detect "addRules" action
    filtered = filterRules(existingRules, type="addRules")   // Zuo / Cyp pattern match

    // Hf: settings loader — reads layered settings
    //   Priority order: policySettings > flagSettings > userSettings >
    //                   projectSettings > localSettings
    settings = await loadSettingsLayer("localSettings")      // Hf → fKu → NLe

    // Append the new exclusion pattern to sandbox exclude list
    updatedSettings = appendExcludePattern(settings, pattern)

    // Persist to .claude/settings.local.json via atomic write
    await writeSettings(updatedSettings, ".claude/settings.local.json")  // Zle / a_n

    // Compute relative path for display
    relativePath = path.relative(cwd, ".claude/settings.local.json")    // Mcc.relative

    // Emit success confirmation
    displayResult(relativePath + " — success")
    telemetryEmit("sandbox_exclude_command")                 // Lo / _J
```

Analysis basis: CC v2.1.199 bundle.js:+13242936, +13242949, +13242973, +13242986, +13242995, +13243030, +4972131, +4972154, +4972305, +4972414, +4972489, +1369622, +1369644, +1349564, +1349615, +1349637

### Settings Layering (Read Path)

The settings loading called by `fKu` respects a five-layer priority stack:

| Priority | Layer | Storage Key |
|---|---|---|
| 1 (highest) | Policy settings | `policySettings` |
| 2 | Flag settings | `flagSettings` |
| 3 | User settings | `userSettings` |
| 4 | Project settings | `projectSettings` |
| 5 (lowest) | Local settings | `localSettings` |

Write operations from `/sandbox exclude` target **localSettings** only (`.claude/settings.local.json`).

Analysis basis: CC v2.1.199 bundle.js:+1369622, +1369644, +1349564, +1349615, +1349637, +1349818, +1349828, +1349890

### ANSI Color Rendering in Output

The `Lo` → `tRe` call chain renders colored terminal output for the command result. It resolves color names (`black`, `red`, `green`, …, `whiteBright`) to ANSI escape sequences, and supports `hex(…)`, `ansi256(…)`, and `rgb(…)` color formats. Foreground and background variants are both supported. The theme context (`"light"` vs dark) established at handler entry influences color selection.

Analysis basis: CC v2.1.199 bundle.js:+3995402, +3995446, +3995459, +3995500, +3995526, +3995542, +13242010

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_ok` (bundle.js:+1039941), `tengu_feature_bad` (bundle.js:+1040008), `tengu_feature_sad` (bundle.js:+1040089), `tengu_daemon_control` (bundle.js:+18569105) |
| Settings write | Appends sandbox exclusion rule to `.claude/settings.local.json` on successful `exclude` sub-command |
| Policy check | `To.areSandboxSettingsLockedByPolicy` blocks all local writes when policy overrides are active |
| Platform guard | Enforces macOS / Linux / WSL2-only at handler entry; WSL1 is explicitly rejected |
| Cache invalidation | `l_` clears internal settings caches (`Ccn.clear`, `$Tr.clear`) after write |
| Telemetry event | `sandbox_exclude_command` emitted via `Lo` / `_J` on successful exclude rule addition (bundle.js:+4972489) |
| JSX rendering | Renders `Pcc.jsx` interactive component when no `exclude` argument is provided |
| Atomic file write | Uses `Zle` (temp file + rename + chmod + sync + close) for safe atomic write of settings |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.199 | Initial analysis |

---

## Common Mistakes

1. **Running on WSL1**: The command explicitly rejects WSL1 with a clear error. Upgrade to WSL2 to use sandboxing.
2. **Omitting the pattern with `exclude`**: `/sandbox exclude` with no pattern argument triggers an error; the pattern (e.g., `"npm run test:*"`) must follow.
3. **Expecting global persistence**: The `exclude` sub-command writes only to `.claude/settings.local.json` (local project settings, lowest priority). Rules will be overridden silently if higher-priority layers (policy, flag, user, project) set conflicting values.
4. **Attempting changes under policy lock**: If an administrator has locked sandbox settings via policy, any `exclude` invocation returns an error and no file is written. Only the admin can change these settings.
5. **Assuming cross-platform availability**: Sandboxing is supported only on macOS, Linux, and WSL2. Running `/sandbox` on Windows (native) or other platforms will return an unsupported-platform error.
6. **Confusing `immediate: true` behavior**: Because the command is registered as `immediate`, pressing Enter without arguments immediately opens the interactive JSX UI rather than waiting for additional input.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `hcm` | Main async handler for `/sandbox` command (arbor_handler) |
| `Lo` | ANSI color rendering / terminal output formatter |
| `tRe` | ANSI color-code resolver (maps color names and hex/rgb/ansi256 to escape sequences) |
| `_J` | Telemetry / event emitter helper called after exclude rule success |
| `Whe` | Spend-block / billing check helper (JSON.stringify wrapper) |
| `Le` | Feature flag OK reporter (`tengu_feature_ok`) |
| `V` | Feature flag value resolver |
| `Pe` | Feature flag persistence helper |
| `GZe` | Feature flag storage initializer |
| `we` | Feature flag bad reporter (`tengu_feature_bad`) |
| `n2` | Daemon control orchestrator (`tengu_daemon_control`) |
| `hG` | Daemon session manager |
| `b9` | Daemon process builder |
| `B6e` | First-party tool registry |
| `bx` | Tool executor |
| `qZr` | Session initializer (UUID + event emit) |
| `ADn` | Agent runner / tool-call dispatcher |
| `cG` | Cryptographic token generator (randomBytes → hex) |
| `w8` | Daemon lifecycle controller (Promise.race shutdown + process.exit) |
| `yEe` | Daemon shutdown trigger |
| `wEe` | Daemon timeout/watchdog handler |
| `XJo` | HTTP post to monitoring endpoint (Datadog) |
| `On` | Abort/timeout orchestrator for daemon operations |
| `o` | Output padding/map helper |
| `r` | Data stream handler (1024-byte chunks) |
| `c` | Background session stop handler |
| `s` | Promise tracking set (add/delete/finally) |
| `Zuo` | Exclude-rule filter and dispatch function |
| `Cyp` | Rule pattern matcher (`e.match`) |
| `Hf` | Settings loader with cache (myn.get/set) |
| `Qh` | Settings layer reader |
| `NLe` | Settings file path resolver (user/project/local layers) |
| `t9` | Settings schema validator / parser |
| `fKu` | Settings write pipeline (read → merge → atomic write → cache clear) |
| `TUr` | Settings merge/priority resolver |
| `f_e` | File reader with size limit (4096-byte slice) |
| `pn` | ENOENT-safe file reader |
| `T` | Logger / output writer (debug/write/flush) |
| `zt` | Filesystem path utility |
| `TNr` | Settings cache timestamp updater (Date.now) |
| `S9e` | Settings fallback/default provider |
| `Zle` | Atomic file writer (temp→rename→chmod→sync→close) |
| `xe` | JSON serializer wrapper |
| `l_` | Settings cache invalidator (Ccn.clear + $Tr.clear) |
| `a_n` | Gitignore/excludes-file rule appender |
| `L6` | `.claude` directory path builder |
| `ar` | Config directory resolver |
| `Et` | Feature flag sad reporter (`tengu_feature_sad`) |
| `CV` | Settings load lifecycle emitter (start/end events) |
| `ke` | Error logger with logError |
| `ule` | Final result formatter / display helper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.