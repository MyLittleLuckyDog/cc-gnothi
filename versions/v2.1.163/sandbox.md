---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.163"
updated: "2026-06-05"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.163 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.163 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.163

---

## Overview

The `/sandbox` command configures the sandboxing policy for shell command execution within Claude Code. It checks platform support and policy lock status before allowing the user to add exclusion patterns (command globs that should bypass sandbox restrictions), persisting changes to `.claude/settings.local.json`. When invoked without arguments, it opens an interactive configuration dialog (⏎ to configure).

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
| module_id | `S1K` |
| load_inline | `true` |
| loc_byte | `12610654` |
| loc_byte_end | `12611303` |
| loc_line | `9060` |
| arbor_handler.name | `WRf` |
| arbor_handler.fqn | `claude-2.1.163::WRf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.163 bundle.js:+12610654

---

## Input Branching

Five distinct branches are present in the handler, warranting a Mermaid flowchart.

```mermaid
flowchart TD
    A(["/sandbox [args]"]) --> B{Platform check\nisSupportedPlatform}
    B -- "unsupported\n(not macOS/Linux/WSL2)" --> C["Emit error:\n'only supported on macOS, Linux, and WSL2'\nbundle.js:+12609404"]
    B -- "WSL version is WSL1" --> D["Emit error:\n'Sandboxing requires WSL2. WSL1 is not supported.'\nbundle.js:+12609346"]
    B -- supported --> E{Policy lock check\nareSandboxSettingsLockedByPolicy}
    E -- locked --> F["Emit error:\n'Sandbox settings are overridden by a higher-priority\nconfiguration and cannot be changed locally.'\nbundle.js:+12609769"]
    E -- not locked --> G{args present?}
    G -- "no args" --> H["Open interactive\nconfiguration UI\n(⏎ to configure)"]
    G -- "args start with 'exclude'" --> I{Pattern provided?}
    I -- "no pattern after 'exclude'" --> J["Emit error:\n'Please provide a command pattern to exclude\n(e.g., /sandbox exclude \"npm run test:*\")'\nbundle.js:+12610081"]
    I -- pattern given --> K["Parse exclusion pattern\nCall sandboxExcludeCommand helper\nbundle.js:+12610229"]
    K --> L["Write updated rules to\n.claude/settings.local.json\nbundle.js:+12610287"]
    L --> M([Done])
    H --> M
    C --> N([Exit with error display])
    D --> N
    F --> N
    J --> N
```

---

## Behavioral Spec

### Main Handler: sandboxCommandHandler (WRf)

The Arbor-resolved handler is `WRf` (AsyncFunction, `claude-2.1.163::WRf`), reached via `module_id` resolution through module `S1K`.

Analysis basis: CC v2.1.163 bundle.js:+12609273

```
async function sandboxCommandHandler(commandContext):
    // Step 1: Light-mode / theme check
    themeMode = getThemeMode()           // SA call at +12609273
    colorOutput = getColorOutput()       // a6 call at +12609295

    // Step 2: Platform gating
    if NOT platformSupport.isSupportedPlatform():  // +12609304
        if wslVersionIs("wsl1"):                    // literal "wsl" at +12609340
            return showError("Error: Sandboxing requires WSL2. WSL1 is not supported.")
                                                    // +12609346
        else:
            return showError("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")
                                                    // +12609404

    // Step 3: Log error level for UI  (literal "error" at +12609484)
    renderLevel = "error"
    colorizeOutput(renderLevel, colorArgs)          // VA call at +12609481

    // Step 4: Fetch MCP/settings context
    mcpState = getMcpState()                        // H call at +12609505

    // Step 5: Dependency check
    checkDependencies()                             // kA.checkDependencies at +12609521

    // Step 6: Policy enabled-list check
    isPlatformEnabled = platformSupport.isPlatformInEnabledList()
                                                    // +12609548

    // Step 7: Policy lock check
    if platformSupport.areSandboxSettingsLockedByPolicy():  // +12609710
        return showError(
          "Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally."
        )                                           // +12609769

    // Step 8: Argument dispatch
    rawArgs = commandContext.args
    parts   = rawArgs.split(...)                    // M.split at +12609996

    if parts[0] == "exclude":                       // literal "exclude" at +12610019
        patternPart = parts.slice(1)                // slice offset 8 at +12610044

        if patternPart is empty:
            return showError(
              "Error: Please provide a command pattern to exclude (e.g., /sandbox exclude \"npm run test:*\")"
            )                                       // +12610081

        // Step 9: Process exclusion rule
        sanitizedPattern = replaceSpecialChars(patternPart)  // z.replace at +12610200
        exclusionResult  = applyExclusionRules(sanitizedPattern)
                                                    // dV_ call at +12610229
        resolvedPath = relativizePath(cwd, exclusionResult)
                                                    // y1K.relative at +12610266

        // Step 10: Persist to local settings
        persistToLocalSettings(resolvedPath)        // ie call at +12610279
        // Target file: ".claude/settings.local.json"  +12610287

    else:
        // No sub-command: open interactive configuration UI
        openSandboxConfigDialog(commandContext)     // cO call at +12610242
```

Analysis basis: CC v2.1.163 bundle.js:+12609273 – +12610287

---

### Sub-handler: applyExclusionRules (dV_)

Called when the `exclude` sub-command is used with a valid pattern. Resolves tool configuration and filters applicable rules.

Analysis basis: CC v2.1.163 bundle.js:+12610229

```
function applyExclusionRules(pattern):
    // Load local settings layer ("localSettings")  +4695909
    localConfig = loadSettings("localSettings")     // x8 call at +4695906

    // Filter existing rules
    filtered = localConfig.filter(...)              // _.filter at +4695977

    // Match pattern against command globs
    matchResult = matchCommandPattern(pattern)      // EnL call at +4696151
                                                    // uses H.match internally at +4686891

    // Check for existing inclusion
    alreadyIncluded = ruleList.includes(pattern)    // q.includes at +4696190

    // Append new exclusion rule ("addRules" shape)  +4696000
    updatedRules = buildRuleObject("addRules", pattern)  // r_ call at +4696204

    // Emit telemetry for exclusion command
    emitTelemetry("sandbox_exclude_command")        // +4696286

    return updatedRules
```

Analysis basis: CC v2.1.163 bundle.js:+4695906

---

### Sub-handler: sandboxConfigDialog (cO)

Opens the interactive configuration panel when no argument is provided.

Analysis basis: CC v2.1.163 bundle.js:+12610242

```
function sandboxConfigDialog(context):
    // Resolve current tool config hierarchy
    toolConfig = resolveToolConfig()    // HzH call at +1276359
    displayConfig = buildDisplay()      // Kd call at +1276365
    renderInteractiveUI(displayConfig)
```

---

### Sub-handler: colorizeOutputSegment (VA)

Applies ANSI terminal color coding to output segments. Handles foreground/background variants for 16 named colors, `ansi256(N)`, `rgb(R,G,B)`, and hex color strings.

Analysis basis: CC v2.1.163 bundle.js:+12609481

```
function colorizeOutputSegment(text, colorSpec):
    if colorSpec.startsWith("rgb("):      // literal at +3812852
        return applyRgbColor(text, colorSpec)
    if colorSpec.startsWith("ansi256("): // literal at +3812893
        return applyAnsi256Color(text, colorSpec)
    if colorSpec.startsWith("ansi:"):    // literal at +3812919
        return applyAnsiNamedColor(text, colorSpec)
    // else: map named color strings (black, red, green, yellow, blue,
    //        magenta, cyan, white, and *Bright variants) to chalk methods
    return applyNamedColor(text, colorSpec)  // nDH covers full color table
```

Analysis basis: CC v2.1.163 bundle.js:+3812839 (VA), +3812935 (nDH color map)

---

### Platform Support Checks (kA methods)

Three distinct checks on the `kA` platform support object gate entry to sandbox configuration:

| Check | Call site | Effect on failure |
|---|---|---|
| `kA.isSupportedPlatform` | +12609304 | Emits OS-not-supported error (macOS/Linux/WSL2 required) |
| `kA.isPlatformInEnabledList` | +12609548 | Records whether the platform appears in the policy allow-list |
| `kA.areSandboxSettingsLockedByPolicy` | +12609710 | Blocks all local changes when enterprise policy overrides are active |

Analysis basis: CC v2.1.163 bundle.js:+12609304, +12609548, +12609710

---

### Settings Persistence Layer

After a successful `exclude` invocation, the updated rule set is written to `.claude/settings.local.json` (literal at +12610287). The settings layering hierarchy visible in the call graph includes:

| Layer name | Literal | Source |
|---|---|---|
| `policySettings` | +1273046 | Enterprise/MDM policy |
| `flagSettings` | +1273125 | Feature flags |
| `userSettings` | +1269054 | `~/.claude/settings.json` |
| `projectSettings` | +1269105 | `.claude/settings.json` |
| `localSettings` | +4695909 | `.claude/settings.local.json` ← write target |

Analysis basis: CC v2.1.163 bundle.js:+12610287, +4695909

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `sandbox_exclude_command` | Fired when an exclusion pattern is successfully processed (bundle.js:+4696286) |
| Telemetry — `tengu_feature_ok` | General feature-success event emitted from the shared feature-gate helper (bundle.js:+1010222) |
| Telemetry — `tengu_feature_bad` | Feature-gate failure path (bundle.js:+1010284) |
| Telemetry — `tengu_feature_sad` | Feature-gate sad path (bundle.js:+1010365) |
| File write | On `exclude` success: `.claude/settings.local.json` updated with new exclusion rule (bundle.js:+12610287) |
| Platform guard | `kA.isSupportedPlatform`, `kA.isPlatformInEnabledList`, `kA.areSandboxSettingsLockedByPolicy` called on every invocation (bundle.js:+12609304, +12609548, +12609710) |
| Interactive UI | No file writes; opens JSX config dialog when no sub-command is given |
| MCP state read | `getMcpState` (H) is called during handler setup (bundle.js:+12609505) |
| Color rendering | VA / nDH color pipeline applied to output strings |

---

## Version History

| Version | Change |
|---|---|
| v2.1.163 | Initial analysis |

---

## Common Mistakes

1. **Using `/sandbox` on Windows (non-WSL) or WSL1.** The command hard-gates on `isSupportedPlatform`; only macOS, Linux, and WSL2 are accepted. WSL1 produces a specific error distinguishing it from other unsupported platforms.
2. **Omitting the pattern with `exclude`.** `/sandbox exclude` with no following argument produces a usage-hint error. The pattern must be quoted if it contains spaces or glob characters (e.g., `/sandbox exclude "npm run test:*"`).
3. **Expecting enterprise-locked settings to be editable.** When `areSandboxSettingsLockedByPolicy` returns true, the command exits immediately with an error regardless of arguments. Local `.claude/settings.local.json` will not be modified.
4. **Assuming changes affect all settings layers.** The `exclude` sub-command only writes to the `localSettings` layer (`.claude/settings.local.json`), not to `userSettings` or `projectSettings`.
5. **Forgetting that `/sandbox` (no args) is interactive.** It renders a JSX configuration dialog; scripted non-interactive usage requires the `exclude` sub-command with an explicit pattern argument.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `WRf` | Main async handler for `/sandbox` command |
| `VA` | Color output pipeline / ANSI string colorizer |
| `H` | MCP state accessor / context fetcher |
| `v` | HTTP bootstrap / fetch utility |
| `ccK` | HTTP request builder helper |
| `SH` | JSON serialization helper |
| `J4` | String fragment extractor / pattern parser |
| `ppH` | Path/pattern helper |
| `icK` | File byte-length and write pipeline |
| `e$` | Context extraction helper |
| `Pw_` | Argument tokenizer / string splitter |
| `q` | File system unlink / sync operations |
| `ZHH` | Set-membership guard |
| `uj` | String replacement utility |
| `t1` | Tool-config normalizer |
| `D6H` | Config field resolver |
| `Aq` | Tool-name normalizer (trim / lowercase / alias map) |
| `eX` | Tool-name resolution wrapper |
| `s6` | Settings bootstrap helper |
| `c` | Core config read utility |
| `P6` | Config loader (Nu6-backed) |
| `nDH` | Full ANSI/chalk color-name dispatch table |
| `zc` | Secondary color segment handler |
| `M` | MCP supervisor / connection manager |
| `AbH` | MCP server connection orchestrator |
| `bl` | MCP connection launcher |
| `wG6` | Connection slot initializer |
| `ws` | MCP server worker / transport manager |
| `Cl` | MCP config entry collector |
| `xY8` | MCP error/warning renderer |
| `DG6` | MCP server slot registry |
| `fk` | MCP tool-call dispatcher |
| `oO` | Tool call executor |
| `Mb_` | Tool call result binder |
| `K` | Async task queue / padded display renderer |
| `L` | Async task lifecycle manager |
| `f` | Stream/channel close handler |
| `__` | Underscore utility wrapper |
| `sk6` | MCP server filter predicate |
| `rkq` | MCP server hash/fingerprint builder |
| `et_` | Server state snapshot helper |
| `VXH` | Object hash builder (SHA-256) |
| `CY8` | Tool schema key extractor |
| `bY8` | Tool schema hash builder |
| `GP` | Schema content hasher |
| `SY8` | Schema key normalizer (M4-backed) |
| `M4` | Schema primitive mapper |
| `O8` | MCP debug log emitter |
| `os_` | MCP server lifecycle orchestrator (connect/reconnect) |
| `pKf` | MCP pre-connect preparation |
| `Ad` | App-state accessor (kx + GK) |
| `i1H` | MCP connect initializer |
| `r1H` | MCP reconnect trigger |
| `o1H` | MCP OAuth flow and server runner |
| `r_6` | In-flight connection tracker |
| `D` | Process exit / abort controller |
| `HI8` | Server state snapshot factory |
| `Sn` | MCP reconnection supervisor |
| `kx` | App-state reader |
| `Y` | Daemon config reload handler |
| `T7` | MCP error log emitter |
| `EH` | Error-to-string coercer |
| `UKf` | MCP connection timeout guard |
| `mKf` | SSH environment detector |
| `as_` | MCP authentication completion helper |
| `i_6` | In-flight auth session lookup |
| `o_6` | Pending connection lookup |
| `Kyq` | MCP server capability query |
| `N9` | AsyncLocalStorage store accessor |
| `hI8` | Auth cache path builder |
| `rs_` | MCP schema hash recorder |
| `Ab_` | MCP tool include/exclude filter |
| `X8` | Global config save helper (auth-loss guard) |
| `A` | File name case-normalizer |
| `j` | Process kill helper |
| `R` | Subprocess write/kill manager |
| `FN` | MCP skills telemetry emitter |
| `D6` | Skill file loader / change detector |
| `I` | Chokidar file-watch wrapper |
| `W6` | Config write utility (Nu6-backed) |
| `S` | Daemon output write helper |
| `tkq` | MCP concurrency limiter (hB-backed) |
| `hB` | Async semaphore / mutex |
| `zA6` | Port range start parser (parseInt, base 10) |
| `SI8` | Port range end parser (parseInt, base 20) |
| `tU8` | MCP connection result applier / orphan disposer |
| `_bH` | Connection result hash verifier |
| `mk` | MCP slot cleanup orchestrator |
| `$A6` | MCP slot state hasher |
| `$` | MCP status broadcast |
| `TKK` | Daemon status writer |
| `nr` | Status path builder |
| `JR6` | Daemon status file path (daemon.status.json) |
| `VYA` | MCP server reconciliation loop |
| `mY8` | MCP server suppression checker |
| `l8` | Timeout-guarded async operation |
| `O` | Background session label |
| `z` | Daemon lifecycle controller |
| `hH` | Daemon start helper |
| `RH` | Daemon stop helper |
| `Yh` | MCP server registry |
| `Au` | MCP server registration helper |
| `LC` | MCP registry loader |
| `QNH` | MCP server name resolver |
| `zh` | MCP server descriptor builder |
| `$X_` | MCP server instance launcher |
| `C98` | MCP server full initialization pipeline |
| `oU` | Random-bytes secret generator |
| `Tp` | Process shutdown sequence |
| `Ac` | KLH shutdown caller |
| `fc` | Shutdown timeout clearer |
| `mX_` | Datadog post helper |
| `dV_` | Exclusion rule processor (localSettings `addRules`) |
| `x8` | Settings loader (localSettings layer) |
| `Pl6` | Settings cache getter/setter |
| `uJA` | Settings cache has/get |
| `F6_` | Settings file reader |
| `mJA` | Settings cache setter |
| `Kd` | Tool config display builder |
| `X_` | Config root resolver (uv-backed) |
| `g46` | Config field accessor |
| `HQ8` | Config field validator |
| `p46` | Config policy field accessor |
| `eGH` | Config enterprise field reader |
| `HEH` | Config field presence check |
| `d46` | Config default value accessor |
| `aOH` | Config key iterator |
| `sOH` | Config section merger |
| `C6_` | Config write-path resolver |
| `OmA` | Config section updater |
| `hr` | Config section deleter |
| `w$6` | Settings write dispatcher (a6 + Y$6 + eP) |
| `EnL` | Command glob matcher (H.match) |
| `r_` | Exclusion rule builder / gitignore writer |
| `cO` | Interactive sandbox config dialog opener |
| `HzH` | Tool config hierarchy resolver |
| `Q6` | File-exists checker |
| `oP` | Gitignore rule applicator |
| `Zr` | Gitignore file reader |
| `R8` | Error code classifier |
| `v8` | ENOENT handler |
| `mH_` | Last-write timestamp recorder |
| `rTH` | Tool config path resolver |
| `Xl6` | .claude config path builder |
| `TM6` | Atomic file writer (temp-rename) |
| `sz` | Settings cache invalidator |
| `vc6` | Settings file read/write helper (mkdir + readFile + writeFile) |
| `b6` | Config base-path resolver |
| `WH_` | Config path formatter |
| `Nc6` | Git check-ignore runner |
| `ME4` | Global gitignore path resolver |
| `XxA` | Gitignore rule existence checker |
| `PxA` | Gitignore rule appender |
| `hx` | .claude directory path builder |
| `DU` | Settings load dispatcher |
| `nT` | Settings load start marker |
| `u9` | Memory-usage telemetry sampler |
| `g6_` | Settings loader core (reads all layers) |
| `$m6` | Settings load end marker |
| `kH` | Error logger (Er.logError) |
| `HA` | Error formatter |
| `eH` | String coercer |
| `Dq` | Essential-traffic classifier |
| `HW4` | Error ring-buffer manager |
| `ie` | Local settings persister |

---

*Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.*