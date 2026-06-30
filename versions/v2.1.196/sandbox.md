---
type: feature-spec
feature: "sandbox"
cc_version: 2.1.196
updated: "2026-06-27"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.195
analysis_basis: "CC v2.1.195 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.195 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.195

---

## Overview

The `/sandbox` command configures Claude Code's sandboxing behavior, controlling which shell commands are permitted or excluded from the active sandbox environment. It validates platform support, checks for policy locks, parses an optional `exclude` sub-command with a pattern argument, and persists the resulting rule to `.claude/settings.local.json`. The command is rendered as a local JSX component and resolves immediately (`immediate: true`) without requiring a full agent turn.

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
| module_id | `kJl` |
| load_inline | `true` |
| loc_byte | `12936838` |
| loc_byte_end | `12937533` |
| loc_line | `8919` |
| arbor_handler.name | `yVf` |
| arbor_handler.fqn | `claude-2.1.195::yVf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.195 bundle.js:+12936838

---

## Input Branching

Five or more distinct execution paths are present (platform checks, WSL version check, policy lock guard, missing-argument error, and successful exclude-rule write), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/sandbox [args]"]) --> B{Check platform\nisSupportedPlatform}
    B -- unsupported OS --> C[Return error:\n'Sandboxing is currently only supported\non macOS, Linux, and WSL2.']
    B -- WSL detected --> D{WSL version check}
    D -- WSL1 --> E[Return error:\n'Sandboxing requires WSL2.\nWSL1 is not supported.']
    D -- WSL2 --> F{checkDependencies}
    B -- supported non-WSL --> F
    F -- deps missing --> G[Return dependency error]
    F -- deps OK --> H{isPlatformInEnabledList}
    H -- platform not in list --> I[Show configuration UI\nvia JSX component]
    H -- platform in list --> J{areSandboxSettingsLockedByPolicy}
    J -- locked --> K[Return error:\n'Sandbox settings are overridden by a\nhigher-priority configuration…']
    J -- not locked --> L{Parse args:\nfirst token == 'exclude'?}
    L -- no / empty --> I
    L -- yes, but no pattern\n after slice index 8 --> M[Return error:\n'Please provide a command pattern\nto exclude (e.g., /sandbox exclude\n\"npm run test:*\")']
    L -- yes + pattern present --> N[Build exclude rule\nvia sandboxRuleWriter]
    N --> O[Persist rule to\n.claude/settings.local.json]
    O --> P[Emit sandbox_exclude_command event\nReturn success]
```

Analysis basis: CC v2.1.195 bundle.js:+12935475–12936506

---

## Behavioral Spec

### 1. Platform Validation

The handler `sandboxCommandHandler` (bundle ident `yVf`) begins by calling two helper functions before any argument parsing occurs.

```
async function sandboxCommandHandler(args, context):
    theme = getTheme()                    // Go — reads light/dark theme token
    rendererFn = getRenderer()            // Vt — acquires JSX renderer

    platformInfo = sandboxPlatformLib.isSupportedPlatform()   // Lo.isSupportedPlatform
    if not platformInfo.supported:
        wslVariant = platformInfo.wslVariant
        if wslVariant == "wsl" and wslVariant is WSL1:
            return renderError("Error: Sandboxing requires WSL2. WSL1 is not supported.")
        else:
            return renderError("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")
```

- WSL1 guard literal: `"Error: Sandboxing requires WSL2. WSL1 is not supported."` (bundle.js:+12935548)
- General unsupported platform literal: `"Error: Sandboxing is currently only supported on macOS, Linux, and WSL2."` (bundle.js:+12935606)
- Platform check entry: bundle.js:+12935506

### 2. Dependency and Policy Checks

```
    depResult = await sandboxPlatformLib.checkDependencies()   // Lo.checkDependencies
    if depResult.error:
        return renderError(depResult.error)

    inEnabledList = sandboxPlatformLib.isPlatformInEnabledList()  // Lo.isPlatformInEnabledList
    if not inEnabledList:
        return renderJSXConfigUI(context)                 // MJl.jsx — shows configuration panel

    policyLocked = sandboxPlatformLib.areSandboxSettingsLockedByPolicy()  // Lo.areSandboxSettingsLockedByPolicy
    if policyLocked:
        return renderError(
            "Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally."
        )
```

- Policy-lock error literal: bundle.js:+12935971
- `checkDependencies` call: bundle.js:+12935723
- `isPlatformInEnabledList` call: bundle.js:+12935750
- `areSandboxSettingsLockedByPolicy` call: bundle.js:+12935912
- JSX render call: bundle.js:+12936129

### 3. Argument Parsing — Exclude Sub-command

```
    tokens = args.split(...)                    // a.split — bundle.js:+12936180
    firstToken = tokens[0]                      // index 0 — bundle.js:+12936193

    if firstToken != "exclude":                 // literal "exclude" — bundle.js:+12936203
        return renderJSXConfigUI(context)

    // The raw argument string is sliced at character offset 8
    // (length of "exclude " = 7 chars + 1 space)
    patternRaw = args.slice(8)                  // numeric literal 8 — bundle.js:+12936228

    if patternRaw is empty or whitespace:
        return renderError(
            "Error: Please provide a command pattern to exclude (e.g., /sandbox exclude \"npm run test:*\")"
        )
        // literal — bundle.js:+12936265
```

- Slice offset constant: `8` (bundle.js:+12936228)
- "exclude" token constant: `"exclude"` (bundle.js:+12936203)

### 4. Rule Persistence

Once a valid pattern is extracted, the handler invokes the settings persistence pipeline:

```
    cleanPattern = patternRaw.replace(...)       // u.replace — bundle.js:+12936384
                                                 // uses string utility Le/ke helpers

    ruleSet = buildExcludeRules(cleanPattern)    // xro — bundle.js:+12936413
    // xro internally:
    //   1. loadSettings("localSettings")        // Hn → gmn/p3 chain
    //   2. filterExistingRules(ruleSet)         // t.filter — bundle.js:+4904276
    //   3. matchPattern(pattern)                // Tnp — bundle.js:+4904450
    //   4. checkInclusion(ruleSet)              // r.includes — bundle.js:+4904489
    //   5. writeSettingsLayer(io)               // io — bundle.js:+4904503
    //      → emits "sandbox_exclude_command"    // Le — bundle.js:+4904582

    workingDir = getWorkingDirectory()           // Lg — bundle.js:+12936426
    relativePath = path.relative(workingDir, settingsPath)  // RJl.relative — bundle.js:+12936450

    // Final result rendering
    result = renderFinalStatus(relativePath)     // Rz — bundle.js:+12936463
    // persists to ".claude/settings.local.json" (literal — bundle.js:+12936471)
    // on success, status token is "success"     // literal — bundle.js:+12936506
```

- Settings file path: `".claude/settings.local.json"` (bundle.js:+12936471)
- Success status literal: `"success"` (bundle.js:+12936506)
- `sandbox_exclude_command` event key: bundle.js:+4904585

### 5. Settings Layer Architecture (called by `xro` / `io`)

The settings write path traverses a multi-layer settings hierarchy:

```
function writeExcludeRuleToLocal(pattern):
    // Load order (lowest → highest priority):
    //   userSettings     → ~/.claude/settings.json
    //   projectSettings  → <project>/.claude/settings.json
    //   localSettings    → <project>/.claude/settings.local.json  ← write target
    //   flagSettings     → CLI flags
    //   policySettings   → admin policy (read-only)

    localSettings = loadSettingsLayer("localSettings")
    localSettings.addRules(buildAddRulesPayload(pattern))
    writeSettingsLayer("localSettings", localSettings)
    // atomic write via temp file → rename (aRt pipeline)
    // emits event via Fet.emit
```

- `"localSettings"` literal: bundle.js:+4904208
- `"addRules"` literal: bundle.js:+4904299
- `"userSettings"` literal: bundle.js:+1324992
- `"projectSettings"` literal: bundle.js:+1325043
- `"policySettings"` literal: bundle.js:+1329654
- `"flagSettings"` literal: bundle.js:+1329733

### 6. Color/Theme Rendering (via `wo` / `zxe`)

The JSX configuration UI uses the terminal color engine `zxe` which maps color tokens to ANSI escape sequences. The theme selector differentiates between `"light"` and other modes (bundle.js:+12935487). Supported color modes surfaced in literals: `"light-ansi"`, `"dark-ansi"`, `"light-daltonized"`, `"dark-daltonized"` (bundle.js:+3530258–3530347). The `"foreground"` color role is used for primary text (bundle.js:+3941223).

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_feature_ok` | Fired on successful feature gate checks (bundle.js:+1027363) |
| Telemetry — `tengu_feature_bad` | Fired on failed feature gate checks (bundle.js:+1027430) |
| Telemetry — `tengu_feature_sad` | Fired on soft/unexpected feature state (bundle.js:+1027511) |
| Telemetry — `tengu_daemon_control` | Fired during daemon stop events triggered by the settings write pipeline (bundle.js:+17924594) |
| Settings write | Appends an exclude rule to `.claude/settings.local.json` on successful `exclude` invocation |
| Event emission | `sandbox_exclude_command` event emitted via `Fet.emit` after a rule is written (bundle.js:+1346089, key literal bundle.js:+4904585) |
| Daemon interaction | `daemon_stop` / `daemon_stop_failed` events may be emitted if the settings pipeline triggers a daemon restart (literals bundle.js:+17924519, +17924556) |
| File system | Atomic write uses temp file + `renameSync` via `aRt`; `fchmodSync` preserves original permissions (bundle.js:+1104301); falls back to in-place write on `EACCES` (bundle.js:+1104952) |
| appState changes | Settings cache cleared via `Kon.clear` / `QHr.clear` after write (`n_` — bundle.js:+29196, +29208) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.195 | Initial analysis |

---

## Common Mistakes

1. **Omitting the pattern quotes**: The argument hint is `exclude "command pattern"`. Passing `/sandbox exclude npm run test:*` without quotes may cause the shell or CLI parser to misinterpret glob characters before they reach the handler's `slice(8)` extraction logic.
2. **Running on WSL1**: The command explicitly rejects WSL1 with a hard error. Users must upgrade to WSL2; there is no fallback or partial-sandbox mode for WSL1.
3. **Attempting to override policy-managed settings**: If sandbox settings are controlled by an organization policy (`areSandboxSettingsLockedByPolicy` returns `true`), the command returns a hard error — there is no `--force` option to bypass this.
4. **Expecting project-level persistence**: The exclude rule is always written to `.claude/settings.local.json` (the local layer), not to the project-level `settings.json`. The local file is typically git-ignored; team-shared rules require manual edits to the project settings file.
5. **Using `/sandbox` on Windows (native)**: Only macOS, Linux, and WSL2 are supported. Native Windows is rejected at the platform-check stage.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `yVf` | Main sandbox command handler (AsyncFunction) — Arbor-resolved entry point |
| `wo` | Terminal color string renderer — dispatches raw color strings to ANSI sequences |
| `zxe` | ANSI color code mapper — maps named colors and hex/rgb/ansi256 to escape codes |
| `GY` | Color output finalizer / fallback renderer |
| `age` | Spend/billing gate checker — JSON.stringify wrapper for spend state |
| `Le` | Daemon stop initiator |
| `W` | Feature gate OK reporter |
| `Oe` | Feature gate error reporter (wraps `OJe`) |
| `OJe` | Low-level feature gate error record builder |
| `ke` | Daemon stop failure reporter |
| `SF` | Daemon control orchestrator — coordinates stop and plugin emission |
| `p6` | Settings load orchestrator |
| `D3` | Settings layer merger |
| `y4e` | Settings write queue manager |
| `YL` | Settings persistence scheduler |
| `GKr` | Plugin/tool event emitter with UUID tagging |
| `Hxn` | Tool execution pipeline runner |
| `a6` | Token generator (32-byte random hex, `Njo.randomBytes`) |
| `yj` | Process exit coordinator — races daemon shutdown against timeout |
| `T_e` | Daemon shutdown trigger |
| `k_e` | Timeout-based exit fallback with `clearTimeout` |
| `Wjo` | Datadog telemetry poster (`ly.post`) |
| `Un` | Abortable async operation wrapper with timeout (`setTimeout`/`clearTimeout`) |
| `o` | Column-padded map formatter (`padEnd`) |
| `r` | Data stream chunker (1024-byte chunks) |
| `c` | Background session label resolver |
| `s` | Async operation tracker (`r.add` / `r.delete` / `i.finally`) |
| `xro` | Sandbox exclude rule builder and local-settings writer |
| `Hn` | Settings loader entry point |
| `gmn` | Settings cache resolver (`Kon.has` / `Kon.get`) |
| `qns` | Settings cache lookup helper |
| `Tkr` | Settings layer splitter (policy / flag / local layers) |
| `Kns` | Settings cache setter (`Kon.set`) |
| `p3` | Settings object constructor / merger |
| `Hr` | Settings path resolver (`u0`) |
| `Cvt` | User settings layer loader |
| `byr` | Project settings layer loader |
| `bvt` | Local settings layer loader |
| `Y$e` | Flag settings layer loader |
| `J$e` | Policy settings layer loader |
| `wvt` | Settings validator |
| `jae` | Settings migration helper |
| `Rve` | Settings schema checker |
| `Amn` | Settings default applier |
| `gvs` | Settings diff/change tracker |
| `Jee` | Settings event notifier |
| `akt` | Settings write dispatcher |
| `Tnp` | Command pattern matcher (`e.match`) |
| `io` | Local settings write pipeline — full atomic write with git-ignore and cache-clear |
| `Lg` | Settings path + object builder for local layer |
| `wve` | Settings path resolver (joins `.claude` directory components) |
| `qt` | File existence checker |
| `Xv` | Settings file reader with cache |
| `Wee` | Raw settings file reader (`readFileSync`, 4096-byte read) |
| `Cn` | Error code classifier (`on` / ENOENT handler) |
| `on` | ENOENT-specific error handler |
| `T` | Settings serializer / file writer coordinator |
| `RYc` | JSON settings formatter (`w1` / `eAr` / `Drs`) |
| `Me` | JSON.stringify wrapper with redaction |
| `Lc` | File path normalizer with `[REDACTED]` masking |
| `jXe` | Settings audit logger (`ais`) |
| `PYc` | Async settings file writer (Buffer.byteLength, 1000ms/100ms timeouts) |
| `RRr` | Settings mutation recorder (`Cfn.set` / `Date.now`) |
| `oBe` | Settings backup / fallback resolver (`fmn` / `p3`) |
| `fmn` | Settings directory path builder (`z1.resolve` / `z1.dirname`) |
| `aRt` | Atomic file write engine (temp → rename, `fchmodSync`, `fsyncSync`) |
| `Gd` | Real path resolver (`realpathSync`, symlink-safe) |
| `i` | Stream close/connection helper |
| `ZZe` | Extended attribute / xattr error suppressor (EINVAL/ENOTSUP/EPERM/ENOSYS) |
| `lAs` | Object property definer (`Object.defineProperty`) |
| `n_` | Settings cache invalidator (`Kon.clear` / `QHr.clear`) |
| `eIs` | Git-ignore integration helper (`git check-ignore`, `core.excludesfile`) |
| `Ot` | Git ignore rule loader (`Rpn` / `Hr`) |
| `fRr` | Git ignore rule parser (`Tu`) |
| `n` | String lowercase normalizer |
| `Sfn` | Git executable resolver (`Wr`) |
| `e1u` | Global gitignore path expander (handles `~/` prefix, `xhe.join`) |
| `QTs` | Git `ls-files` tracker checker |
| `ZTs` | Git ignore write helper |
| `M5` | Claude config directory path builder (`.claude/settings.json`) |
| `wt` | Feature telemetry sad-path reporter (`Oe`) |
| `d8` | Settings load-from-disk orchestrator (emits `loadSettingsFromDisk_start`/`_end`) |
| `c0` | Pre-load settings snapshot capturer |
| `pa` | Memory usage sampler (`process.memoryUsage`, `EAr.push`) |
| `Ikr` | Settings load event tracer (`settings_load_started` / `settings_load_completed`) |
| `zon` | Post-load settings diff reporter |
| `xe` | Settings write error handler and log emitter (`Gee.logError`, `GZe.push`) |
| `Zr` | Error stringifier |
| `ut` | String coercion utility |
| `qi` | Settings write retry scheduler (`rSs`) |
| `BMu` | Write queue manager (`Tpn.shift` / `Tpn.push`) |
| `Rz` | Final sandbox command result renderer |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.