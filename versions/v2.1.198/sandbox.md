---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.198"
updated: "2026-07-02"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.198 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.198 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.198

---

## Overview

The `/sandbox` command configures the Claude Code sandboxing subsystem, which restricts the execution environment for shell commands run by the agent. Its primary interactive use is adding exclusion patterns for commands that should bypass sandbox restrictions, and it can also open a configuration UI when invoked without arguments. Platform support is enforced before any configuration change is applied.

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
| module_id | `koc` |
| load_inline | `true` |
| loc_byte | `13120129` |
| loc_byte_end | `13120824` |
| loc_line | `8981` |
| arbor_handler.name | `ynm` |
| arbor_handler.fqn | `claude-2.1.198::ynm` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.198 bundle.js:+13120129

---

## Input Branching

The handler has five or more distinct paths depending on platform support, argument presence, subcommand keyword, policy lock, and error state. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/sandbox invoked"] --> B{Check theme: 'light'?}
    B --> C[Resolve color mode]
    C --> D{isSupportedPlatform?}
    D -- No, wsl=false --> E["Return error:\nWSL2 required\n(bundle.js:+13118838)"]
    D -- No, not macOS/Linux/WSL2 --> F["Return error:\nmacOS/Linux/WSL2 only\n(bundle.js:+13118896)"]
    D -- Yes --> G{checkDependencies passed?}
    G -- No --> H["Return error type 'error'\n(bundle.js:+13118976)"]
    G -- Yes --> I{isPlatformInEnabledList?}
    I -- No --> J["Render JSX configuration UI\n(bundle.js:+13119419)"]
    I -- Yes --> K{areSandboxSettingsLockedByPolicy?}
    K -- Yes --> L["Return error:\nSettings locked by policy\n(bundle.js:+13119261)"]
    K -- No --> M{Arguments provided?}
    M -- No --> N["Render JSX configuration UI"]
    M -- Yes --> O{arg[0] === 'exclude'?}
    O -- No --> P["Return error:\nProvide command pattern\n(bundle.js:+13119555)"]
    O -- Yes --> Q{arg.length >= 8 chars after split?}
    Q -- No --> P
    Q -- Yes --> R["Parse pattern string\nStrip surrounding quotes\n(bundle.js:+13119510)"]
    R --> S["Write exclusion rule to\n.claude/settings.local.json\n(bundle.js:+13119762)"]
    S --> T["Emit 'sandbox_exclude_command' telemetry\n(bundle.js:+4960236)"]
    T --> U["Return 'success'\n(bundle.js:+13119797)"]
```

---

## Behavioral Spec

### Platform Guard

The handler begins by checking the active terminal color theme (literal `"light"` at bundle.js:+13118777) then immediately invokes the platform support checker.

```
async function sandboxCommandHandler(args, context):
    colorMode = resolveColorMode(context)   // checks "light" literal

    if not isSupportedPlatform(context):
        wslVersion = detectWSLVersion(context)
        if wslVersion == "wsl" and wslVersion != "wsl2":
            return error("Error: Sandboxing requires WSL2. WSL1 is not supported.")
        else:
            return error("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")
```

Analysis basis: CC v2.1.198 bundle.js:+13118796, +13118832, +13118838, +13118896

---

### Dependency and Capability Checks

After platform validation, the handler verifies that required sandbox dependencies are present and that the current platform is in the enabled-platforms list.

```
    depResult = await checkDependencies(context)
    if depResult.type == "error":
        return depResult

    platformEnabled = isPlatformInEnabledList(context)
    if not platformEnabled:
        return renderConfigurationUI(context)   // JSX component
```

Analysis basis: CC v2.1.198 bundle.js:+13119013, +13119040, +13119419

---

### Policy Lock Check

If the platform is enabled, the handler checks whether sandbox settings have been locked by a higher-priority policy (e.g., enterprise/organization configuration). If locked, no local changes are permitted.

```
    locked = areSandboxSettingsLockedByPolicy(context)
    if locked:
        return error("Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally.")
```

Policy error literal: `"Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally."` (bundle.js:+13119261)

Analysis basis: CC v2.1.198 bundle.js:+13119202

---

### Argument Dispatch

With no arguments, the handler falls through to render the interactive configuration UI (a JSX component via `Roc.jsx`). With arguments, the first token is checked against the subcommand `"exclude"`.

```
    if args is empty:
        return renderConfigurationUI(context)

    parts = args.split(...)         // tokenize argument string
    subcommand = parts[0]           // index 0 (bundle.js:+13119483)

    if subcommand != "exclude":
        return error("Error: Please provide a command pattern to exclude (e.g., /sandbox exclude \"npm run test:*\")")

    patternRaw = parts.slice(1).join(" ")
    if patternRaw.length < 8:       // minimum pattern length constant: 8 (bundle.js:+13119518)
        return error("Error: Please provide a command pattern to exclude (e.g., /sandbox exclude \"npm run test:*\")")
```

- Minimum argument token length after `"exclude"`: **8 characters** (bundle.js:+13119518)
- Subcommand keyword: `"exclude"` (bundle.js:+13119493)
- Error message literal fragment: `"Error: Please provide a command pattern…"` (bundle.js:+13119555)

Analysis basis: CC v2.1.198 bundle.js:+13119470, +13119483, +13119493, +13119510, +13119518, +13119555

---

### Pattern Normalization and Rule Writing

The exclusion pattern is stripped of surrounding quotes (using `u.replace` on the pattern string, bundle.js:+13119674), converted to a relative path via `xoc.relative` (bundle.js:+13119740), then written to the local settings file.

```
    pattern = stripSurroundingQuotes(patternRaw)
    pattern = normalizeToRelativePath(pattern, context.cwd)

    localSettings = readLocalSettings(".claude/settings.local.json")
    localSettings.addRules = appendToRules(localSettings.addRules, pattern)

    writeSettingsFile(".claude/settings.local.json", localSettings)
    emitTelemetry("sandbox_exclude_command")
    return "success"
```

- Settings file path: `.claude/settings.local.json` (bundle.js:+13119762)
- Result literal on success: `"success"` (bundle.js:+13119797)
- Settings key for exclusions: `"addRules"` (bundle.js:+4959950)
- Settings layer label used internally: `"localSettings"` (bundle.js:+4959859)

Analysis basis: CC v2.1.198 bundle.js:+13119674, +13119703, +13119716, +13119740, +13119753, +13119762, +13119797

---

### Local Settings Read Path (`getLocalSettings`)

The handler reads the existing local settings via a settings loader function (resolved through `$lo` → `Hn` → layer-aware settings pipeline). The loader recognises the following settings layer keys:

| Layer key | Purpose |
|---|---|
| `"policySettings"` (bundle.js:+1350824) | Enterprise/org-managed policy overrides |
| `"flagSettings"` (bundle.js:+1350903) | Feature-flag-driven settings |
| `"localSettings"` (bundle.js:+4959859) | Per-workspace `.claude/settings.local.json` |
| `"userSettings"` (bundle.js:+1346162) | Global user-level `settings.json` |
| `"projectSettings"` (bundle.js:+1346213) | Per-project `settings.json` |

The loader merges these layers in priority order before returning the effective settings object.

Analysis basis: CC v2.1.198 bundle.js:+4959856, +1350824, +1350903, +1346162, +1346213

---

### Pattern Matching Utility (`patternMatcher`)

Exclusion patterns are matched against incoming command strings using `gmp` (pattern-match helper). The helper calls `e.match` (bundle.js:+4944993) against each stored pattern and filters the result list with `t.filter` (bundle.js:+4959927). The inclusion check uses `r.includes` (bundle.js:+4960140).

```
function matchesExclusionPattern(command, rules):
    for rule in rules:
        if patternMatcher(command, rule):   // gmp: uses e.match()
            return true
    return false
```

Analysis basis: CC v2.1.198 bundle.js:+4960101, +4944993, +4959927, +4960140

---

### Color/ANSI Rendering Utilities

The JSX configuration UI rendered for the interactive path relies on a terminal color utility (`cke`) that parses color specifier prefixes before dispatching to the appropriate ANSI/RGB/hex rendering call. This is a standard terminal styling subsystem shared with other commands, not specific to sandbox logic.

```
function resolveTerminalColor(colorSpec):
    if colorSpec.startsWith("ansi:"):   prefix=5 chars → ansi256 path
    if colorSpec.startsWith("ansi256("): → ansi256 renderer
    if colorSpec.startsWith("rgb("):    → rgb renderer
    else:                               → named color lookup (black, red, …, whiteBright)
```

Supported named colors: `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, and their `Bright` and `bg*` variants, plus `hex`, `ansi256`, `rgb`.

Analysis basis: CC v2.1.198 bundle.js:+3990336, +3990349, +3990390, +3990416, +3645390

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_feature_ok` | Emitted on successful feature gate check (bundle.js:+1039573) |
| Telemetry: `tengu_feature_bad` | Emitted on failed feature gate check (bundle.js:+1039640) |
| Telemetry: `tengu_feature_sad` | Emitted on feature gate degraded/warning state (bundle.js:+1039721) |
| Telemetry: `tengu_daemon_control` | Emitted during daemon start/stop operations triggered by settings change (bundle.js:+18414881) |
| Telemetry: `tengu_daemon_config_reload` | Emitted when sandbox daemon configuration is reloaded after rule write (bundle.js:+18392244) |
| Custom telemetry: `sandbox_exclude_command` | Emitted specifically when an exclusion rule is successfully added (bundle.js:+4960236) |
| File write | Appends an entry under the `addRules` key in `.claude/settings.local.json` |
| Settings cache invalidation | Calls `o_` which invokes `iln.clear` and `PAr.clear` to flush in-memory settings caches (bundle.js:+29196, +29208) |
| Daemon control | May invoke daemon stop (`daemon_stop` / `daemon_stop_failed`) and reload after settings update (bundle.js:+18414806, +18414843) |
| JSX render | When no valid subcommand is given or platform not in enabled list, renders an interactive configuration component via `Roc.jsx` |
| `immediate` flag | Set to `true` — the command handler is invoked immediately without waiting for an agent turn |

---

## Version History

| Version | Change |
|---|---|
| v2.1.198 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/sandbox` on an unsupported platform** — The command will immediately return an error on Windows (non-WSL), or on WSL1. Only macOS, Linux, and WSL2 are supported (bundle.js:+13118838, +13118896).
2. **Omitting quotes around patterns with wildcards** — The argument hint `exclude "command pattern"` is intentional: the pattern should be quoted so the shell does not expand glob characters before the command receives them.
3. **Providing a pattern shorter than 8 characters** — The handler enforces a minimum token length of 8 for the pattern string after `exclude`; shorter strings produce the usage-error message (bundle.js:+13119518).
4. **Expecting `/sandbox` to work when settings are policy-locked** — If an enterprise or organization policy has locked sandbox settings, the command will refuse to write changes regardless of local permissions (bundle.js:+13119202, +13119261).
5. **Expecting changes to take effect without a daemon reload** — After writing the exclusion rule, the sandbox daemon is reloaded automatically. If the daemon fails to restart (`daemon_stop_failed`), the new rule may not be active until the session restarts.
6. **Confusing `/sandbox` with a toggle** — The command does not enable or disable sandboxing globally in a single invocation without arguments; bare invocation opens the interactive configuration UI (JSX) rather than flipping a boolean.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `ynm` | Main async handler for `/sandbox` command (arbor_handler) |
| `wo` | Terminal color/ANSI prefix resolver utility |
| `cke` | Full ANSI/RGB/hex color dispatch utility (named color table) |
| `UX` | Color rendering output helper called from color resolver |
| `tge` | Spend/billing gate helper (JSON.stringify wrapper) |
| `xe` | Feature gate check — emits `tengu_feature_ok` |
| `V` | Feature gate OK emitter sub-function |
| `Pe` | Feature gate result processor |
| `OQe` | Feature gate underlying check function |
| `Le` | Feature gate check — emits `tengu_feature_bad` |
| `M$` | Daemon control orchestrator (stop/reload) |
| `eG` | Daemon group management helper |
| `Z3` | Daemon state resolver |
| `V5e` | Daemon config builder |
| `tx` | Daemon config task scheduler |
| `UJr` | Daemon stop/restart sequencer |
| `tMn` | Daemon process manager (Promise.all, external spawn) |
| `z6` | Random bytes / session ID generator for daemon |
| `l8` | Daemon lifecycle controller (Promise.race/exit) |
| `kye` | Daemon shutdown invoker |
| `$ye` | Daemon stop with timeout helper |
| `R7o` | HTTP POST to daemon control endpoint |
| `Mn` | Background session manager / abort handler |
| `o` | Session map/pad formatter |
| `r` | Data stream / abort signal handler |
| `c` | Background session utility (calls `un`) |
| `s` | Active session set tracker |
| `$lo` | Local settings loader with rule filtering |
| `Hn` | Settings system initializer |
| `UHn` | Settings cache accessor |
| `Ecs` | Settings cache read (iln.has / iln.get) |
| `h1r` | Settings layer reader (policy, flag, user, project) |
| `Scs` | Settings cache write (iln.set) |
| `x3` | Settings object assembler / merger |
| `ar` | Low-level settings reader sub-function |
| `H2e` | Settings field extractor |
| `sTr` | Settings transform helper |
| `mZe` | Settings merge utility |
| `p2e` | Settings validation helper |
| `f2e` | Settings filter helper |
| `axt` | Settings accessor sub-utility |
| `Lle` | Settings layer label resolver |
| `zwe` | Settings write-back helper |
| `VHn` | Settings version/hash checker |
| `pMs` | Settings persistence manager |
| `Yte` | Settings diff/patch utility |
| `KDt` | Settings key dispatcher |
| `gmp` | Exclusion pattern matcher (uses e.match) |
| `eo` | Full settings read/write pipeline (loadSettingsFromDisk) |
| `Oh` | Settings overlay composer |
| `Vwe` | User/project settings file path resolver |
| `zt` | Filesystem stat/exist utility |
| `Nk` | File content loader with shebang/slice handling |
| `IHe` | File reader with encoding and slice (readFileSync) |
| `mn` | Error code normaliser (ENOENT handler) |
| `en` | Error wrapper / re-throw helper |
| `T` | Shell command executor (main runner) |
| `Hiu` | Shell environment builder |
| `Me` | JSON stringify wrapper for command args |
| `Oc` | Command path sanitiser / redactor |
| `YZe` | Shell options resolver |
| `biu` | Shell subprocess spawner with timeout |
| `HOr` | Timestamp recorder (Vgn.set / Date.now) |
| `I3e` | Settings path resolver (OHn + x3) |
| `OHn` | Canonical settings path builder (gN.resolve/dirname) |
| `BMt` | Atomic file writer (temp + rename + fsync) |
| `Wd` | Filesystem realpath resolver |
| `d` | Supervisor / watcher lifecycle controller |
| `zws` | Temp file writer with fstat/permissions |
| `i` | Stream/connection close manager |
| `$Mt` | File open/read utility with fstat |
| `ant` | Extended attribute / xattr handler |
| `$Dr` | Directory creator / path initialiser |
| `eLs` | Object.defineProperty wrapper for file metadata |
| `o_` | Settings cache invalidator (iln.clear + PAr.clear) |
| `Fgn` | Gitignore / excludes-file rule writer |
| `Pt` | Git command invoker (check-ignore) |
| `eOr` | Git result parser |
| `n` | String lowercase normaliser |
| `Ugn` | Git check-ignore runner |
| `p6u` | Path expander (tilde, absolute resolution) |
| `q0s` | Git ls-files runner |
| `K0s` | Git excludes-file updater |
| `m6` | `.claude` directory path builder |
| `St` | Feature gate — emits `tengu_feature_sad` |
| `X8` | Settings load orchestrator (loadSettingsFromDisk entry) |
| `a0` | Pre-load preparation helper |
| `_a` | Memory-usage / dedup tracker for settings load |
| `g1r` | Settings load span / telemetry emitter |
| `aln` | Settings load completion recorder |
| `Re` | Error logger / reporter |
| `sr` | Error string formatter |
| `st` | String coercion utility |
| `qi` | Essential-traffic queue manager |
| `jvu` | Queue shift/push manager (Bmn) |
| `Lae` | Post-write UI refresh / notification emitter |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.