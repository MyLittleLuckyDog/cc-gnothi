---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.165"
updated: "2026-06-05"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.165 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.165 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.165

---

## Overview

The `/sandbox` command manages the sandbox execution environment for Claude Code, controlling which shell commands are permitted to run outside the sandbox. It renders an interactive JSX configuration panel and supports a sub-command (`exclude`) that allows users to add glob-style command exclusion patterns to the local settings file (`.claude/settings.local.json`). The command performs platform-compatibility checks before taking any action and respects policy locks that prevent local overrides.

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
| module_id | `b1K` |
| load_inline | `true` |
| loc_byte | `12611019` |
| loc_byte_end | `12611668` |
| loc_line | `9060` |
| arbor_handler.name | `ERf` |
| arbor_handler.fqn | `claude-2.1.165::ERf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.165 bundle.js:+12611019

---

## Input Branching

The handler has four distinct paths based on platform support, policy locks, and sub-command argument parsing, requiring a flowchart representation.

```mermaid
flowchart TD
    A(["/sandbox invoked"]) --> B{Platform supported?\nkA.isSupportedPlatform}
    B -- "No: WSL1 detected" --> C["Return error:\n'Sandboxing requires WSL2.\nWSL1 is not supported.'"]
    B -- "No: unsupported OS" --> D["Return error:\n'Sandboxing is currently only\nsupported on macOS, Linux, and WSL2.'"]
    B -- "Yes" --> E{kA.checkDependencies\ncheck result}
    E -- "dependency missing" --> F["Return error result\nvia VA/colorRenderer"]
    E -- "OK" --> G{args contains\n'exclude' keyword?}
    G -- "No" --> H["kA.isPlatformInEnabledList check\nRender interactive JSX\nconfiguration panel"]
    G -- "Yes" --> I{Policy locked?\nkA.areSandboxSettingsLockedByPolicy}
    I -- "Yes (policy lock)" --> J["Return error:\n'Sandbox settings are overridden by a\nhigher-priority configuration and\ncannot be changed locally.'"]
    I -- "No" --> K{Pattern argument\npresent after 'exclude'?}
    K -- "No pattern" --> L["Return error:\n'Please provide a command pattern\nto exclude (e.g., /sandbox exclude\n\"npm run test:*\")'"]
    K -- "Pattern provided" --> M["Parse exclude pattern\nWrite to .claude/settings.local.json\nEmit tengu_sandbox_exclude_command\nReturn success via lV_/r_"]
```

---

## Behavioral Spec

### Platform Validation

```
async function sandboxHandler(args, context):
    theme = resolveTheme()   // "light" or dark
    colorSpec = buildColorSpec(theme, VA)

    if not platformUtils.isSupportedPlatform():
        wslVersion = detectWSL()
        if wslVersion == "wsl" and not wsl2:
            return errorResult("Error: Sandboxing requires WSL2. WSL1 is not supported.")
        else:
            return errorResult("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")

    depCheck = await platformUtils.checkDependencies()
    if depCheck.failed:
        return renderColoredError(depCheck.message, colorSpec)
```

Analysis basis: CC v2.1.165 bundle.js:+12609638, +12609669, +12609705, +12609711, +12609769

### Argument Parsing and Sub-command Dispatch

```
async function parseAndDispatch(args, context):
    tokens = args.split(" ")
    subcommand = tokens[0]  // e.g., "exclude"

    if subcommand == "exclude":
        // slice off the "exclude" keyword (length 8) to get pattern
        pattern = args.slice(8).trim()
        if pattern is empty:
            return errorResult(
                'Error: Please provide a command pattern to exclude ' +
                '(e.g., /sandbox exclude "npm run test:*")'
            )
        return handleExclude(pattern, context)
    else:
        // No recognized sub-command: render interactive panel
        return renderConfigPanel(context)
```

Analysis basis: CC v2.1.165 bundle.js:+12610361, +12610384, +12610401, +12610409, +12610446

### Policy Lock Check

```
async function handleExclude(pattern, context):
    if platformUtils.areSandboxSettingsLockedByPolicy():
        return errorResult(
            "Error: Sandbox settings are overridden by a higher-priority " +
            "configuration and cannot be changed locally."
        )
    return writeExcludePattern(pattern, context)
```

Analysis basis: CC v2.1.165 bundle.js:+12610075, +12610134

### Exclude Pattern Write

```
async function writeExcludePattern(pattern, context):
    // localSettings refers to .claude/settings.local.json
    settingsPath = resolveSettingsPath(".claude/settings.local.json")
    currentSettings = loadLocalSettings(settingsPath)        // via lV_/x8/r_

    // Filter and validate: ZnL regex match, q.includes check
    validated = validatePattern(pattern)    // ZnL.match
    if not valid:
        return errorResult("Invalid pattern")

    // Append to addRules exclusion list within localSettings
    updatedSettings = appendExcludeRule(currentSettings, pattern)

    // Persist atomically: uses TM6 (atomic write via temp file + rename)
    writeSettingsAtomic(settingsPath, updatedSettings)

    // Emit telemetry
    emit("sandbox_exclude_command")    // literal at +4696356

    // Report result to UI
    return renderResult(buildRelativePath(settingsPath), context)
```

Analysis basis: CC v2.1.165 bundle.js:+12610594, +12610607, +12610631, +12610644, +12610652, +4696356

### Color / Theme Rendering

```
function buildColorSpec(colorInput, renderFn):
    // VA resolves theme: checks startsWith "rgb(", "ansi256(", "ansi:"
    // then delegates to nDH which maps color names (black/red/green/...) 
    // to j6.* chalk-style color functions
    // Foreground/background pairs are constructed for terminal output
    if colorInput.startsWith("rgb("):
        return j6.rgb(r, g, b) / j6.bgRgb(r, g, b)
    elif colorInput.startsWith("ansi256("):
        return j6.ansi256(n) / j6.bgAnsi256(n)
    elif colorInput.startsWith("ansi:"):
        return j6.ansi(n)
    else:
        return namedColorLookup(colorInput)  // black, red, green, ..., whiteBright
```

Analysis basis: CC v2.1.165 bundle.js:+12609846, +3812909, +3813005, +3474756

### Interactive Configuration Panel (no sub-command)

```
function renderConfigPanel(context):
    // isPlatformInEnabledList determines current sandbox enabled state
    isEnabled = platformUtils.isPlatformInEnabledList()

    // Renders JSX component (local-jsx type):
    // - shows current sandbox on/off state
    // - allows toggling and viewing exclusion rules
    // - pressing ⏎ opens configuration (per description hint)
    return <SandboxConfigPanel enabled={isEnabled} context={context} />
```

Analysis basis: CC v2.1.165 bundle.js:+12609913, +12611019

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_ok` (+1010222), `tengu_feature_bad` (+1010284), `tengu_feature_sad` (+1010365) — generic feature outcome events fired by platform-check utilities; `sandbox_exclude_command` string constant (+4696356) — fired on successful exclusion write |
| Settings written | `.claude/settings.local.json` — `addRules` / exclusion list updated when `/sandbox exclude <pattern>` succeeds (+12610652) |
| Atomic file write | Uses TM6-class atomic write (temp file + `renameSync`) to persist settings safely (+1057816, +1058068) |
| Platform checks | `kA.isSupportedPlatform`, `kA.checkDependencies`, `kA.isPlatformInEnabledList`, `kA.areSandboxSettingsLockedByPolicy` called on every invocation |
| appState changes | None directly observed at depth ≤ 2; configuration panel may trigger reactive updates via JSX rendering |
| Sound | None observed |
| Hook registration | None observed |

---

## Version History

| Version | Change |
|---|---|
| v2.1.165 | Initial analysis |

---

## Common Mistakes

1. **Using `/sandbox exclude` without quotes around patterns containing spaces or wildcards** — the pattern is everything after the literal 8-character prefix `exclude `. Shell quoting is the user's responsibility; unquoted wildcards may not be stored as intended.
2. **Attempting to use `/sandbox` on WSL1** — WSL1 is explicitly blocked with an error message. Users must upgrade to WSL2 for sandbox support.
3. **Attempting to modify sandbox settings when enterprise policy is active** — the `areSandboxSettingsLockedByPolicy` check will block any `exclude` writes and display a policy-override error. Changes must be made at the policy configuration level, not locally.
4. **Omitting the pattern argument to `/sandbox exclude`** — running `/sandbox exclude` with no following pattern produces an error prompting for a valid glob pattern example.
5. **Expecting `/sandbox exclude` to affect the global or user-level settings** — the command always writes to `.claude/settings.local.json` in the project directory, not to user-level or enterprise config files.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `ERf` | Main async handler for `/sandbox` (Arbor-resolved via module_id `b1K`) |
| `VA` | Color/theme spec builder; parses rgb/ansi256/named color strings for terminal output |
| `H` | Bootstrap/fetch utility; also used as a general context/helper object in call chains |
| `v` | Command execution / fetch core utility |
| `icK` | Inner fetch/request handler (depth-1 from `v`) |
| `SH` | JSON serialization helper (`JSON.stringify` wrapper) |
| `J4` | Argument/token parser; handles replace, at, lastIndexOf, slice operations |
| `ppH` | Post-processing helper (`C2A` wrapper) |
| `acK` | Async file/content collector; uses `Buffer.byteLength`, directory ops |
| `e$` | Auxiliary helper reached from bootstrap `H` |
| `Gw_` | String splitter/trimmer for argument tokenization |
| `ZHH` | Cache set membership checker |
| `uj` | String replacement utility |
| `e1` | Shell command / execution normalizer |
| `D6H` | Command dispatch helper (calls `SA`, `IqH`, `yd`) |
| `Aq` | Model alias resolver (opusplan/sonnet/haiku/opus/best → canonical names) |
| `eX` | Extended command executor wrapping `Aq` |
| `s6` | UI/render utility (calls `c`, `P6`) |
| `nDH` | Named-color-to-chalk mapper (black, red, green … whiteBright, hex, ansi256, rgb) |
| `zc` | Auxiliary color finalizer called from `VA` |
| `M` | MCP server manager / settings orchestrator |
| `AbH` | MCP connection batch handler; drives `bl`, `fk`, `ts_`, `Sn`, etc. |
| `bl` | MCP server loader (enterprise/user/project/local tiers) |
| `wG6` | MCP worker utility (`ih`, `ZKH`) |
| `ws` | MCP server connection worker; handles stdio/sse/http transports |
| `Cl` | MCP config entry collector |
| `uY8` | MCP warning renderer (red/yellow color coding) |
| `DG6` | MCP server slot manager (sse/http); manages cache get/set |
| `fk` | MCP tool filter/formatter |
| `oO` | Tool output renderer (`qlH`, `y6`, `m9`) |
| `zb_` | Auxiliary MCP formatter |
| `K` | Padded-display utility; maps and pads entries |
| `L` | Async task tracker with add/delete/finally lifecycle |
| `f` | Stream/connection object (close, get, set operations) |
| `__` | Underscore/lodash-like utility wrapper |
| `sk6` | MCP server filter step |
| `skq` | MCP server connection attempt orchestrator |
| `Ae_` | Pre-connection validator (`N9`, `SI8`, `B6`) |
| `VXH` | Config hash builder (SHA-256, `nu9.createHash`) |
| `bY8` | Auth/credentials cache reader (`AAH`, `Object.keys`) |
| `xY8` | Extended auth checker (`bY8` + `GP`) |
| `GP` | Config hash generator (`SH`, `gu9.createHash`) |
| `RY8` | Config slot reader (`M4`) |
| `M4` | Settings persistence reader (`VP1`) |
| `O8` | MCP debug logger (`hBH.push`, `Er.logMCPDebug`) |
| `ts_` | MCP transport session manager; orchestrates OAuth, reconnect, daemon |
| `BKf` | Pre-session bootstrap check |
| `Ad` | Auth token accessor (`yx`, `GK`) |
| `i1H` | Session initializer (`pvq`, `XKf`) |
| `r1H` | Session recovery handler |
| `o1H` | MCP OAuth server manager; creates HTTP callback server, manages tokens |
| `r_6` | In-flight connection tracker (`iv8` map operations) |
| `D` | Forced shutdown handler (`IJ`, `process.exit`, `z.abort`) |
| `_I8` | Needs-auth status checker (`N9`, `SI8`) |
| `Sn` | MCP reconnect orchestrator |
| `yx` | Token resolver (`GK`) |
| `Y` | Supervisor/daemon config updater |
| `T7` | MCP error logger (`hBH.push`, `Er.logMCPError`) |
| `EH` | Error-to-string converter |
| `FKf` | Final connection step |
| `UKf` | SSH/URL transport selector (`T6.isSSH`, `eH`, `Wq`) |
| `es_` | OAuth session handler (`Ad`, `pKf`, `i_6`, `o_6`) |
| `i_6` | Needs-auth cache getter (`nv8.get`) |
| `o_6` | In-flight getter (`iv8.get`) |
| `Myq` | MCP reconnect pending handler (`Ae_`, `N9`, `SI8`) |
| `N9` | AsyncLocalStorage store getter (`QZL.getStore`) |
| `SI8` | Needs-auth file path joiner (`hI8.join`, `a8`) |
| `ss_` | MCP server status probe (`GP`, `M4`, `O8`, `EH`) |
| `Lb_` | Tool-list inclusion checker (`X8`, `A.includes`) |
| `X8` | Tool entry builder (uses `CX_`, `eT`, `_lH`, `$r1`, `t98`, `v`) |
| `A` | String lowercaser utility |
| `j` | Process kill dispatcher (`A.values`, `R.kill`) |
| `R` | Child process wrapper (`YmK`, `K$`, `kH`, `U55`, `Y.write`) |
| `FN` | Skill/MCP capability broadcaster (`D6`) |
| `D6` | Capability registry manager (`Hj6`, `_j6`, `qu`, `yDH`, `eU`) |
| `I` | Chokidar file-watcher wrapper (`v`, `c`, `W6`, `S`) |
| `W6` | Error constructor helper (`Nu6`) |
| `S` | Write/close stream manager |
| `_yq` | Promise mapper utility (`hB`) |
| `hB` | Async iterator/mapped-promise engine |
| `zA6` | Integer parser (parseInt, radix 10) |
| `RI8` | Integer parser variant (parseInt, radix 20) |
| `eU8` | MCP apply-connection-result handler; disposes orphaned connections |
| `_bH` | Config hash comparator (`VXH`) |
| `mk` | MCP cleanup driver (`$A6`, `K.cleanup`, `FN`) |
| `$A6` | Pre-cleanup hash validator (`VXH`) |
| `$` | Daemon status record builder (`NKK`) |
| `NKK` | Daemon status JSON serializer (`nr`, `Date.now`, `N9`, `JR6`, `SH`) |
| `nr` | Log path resolver (`L4H`) |
| `JR6` | Daemon status path builder (`VKK.join`, `a8`) |
| `IYA` | MCP server sync/retry manager; calls `AbH`, `eU8` |
| `pY8` | Server permission set checker (`tY7.has`, `fb_.has`) |
| `l8` | Timed async operation wrapper (setTimeout/clearTimeout) |
| `O` | Background session sentinel (`b8`) |
| `z` | Process/session controller (`hH`, `RH`, `Yh`, `Tp`) |
| `hH` | Success result renderer (`c`, `P6`) |
| `RH` | Error result renderer (`c`, `P6`) |
| `Yh` | Session teardown orchestrator (`Au`, `QNH`, `zX_`) |
| `Au` | Graceful shutdown initiator (`fC`) |
| `fC` | Connection shutdown (`lGL`, `H3`, `wM6`) |
| `QNH` | Shutdown hook caller (`zh`) |
| `zh` | Shutdown callback (`D6`) |
| `zX_` | Session UUID generator and emitter (`$X_.randomUUID`, `GcH`, `oU`, `H.emit`) |
| `C98` | Full session runner (async; `e1`, `$2`, `nU`, `Promise.all`, `bEL`, `Ec6`) |
| `oU` | Random-bytes key generator (`zr1.randomBytes`, `X8`, `v`) |
| `Tp` | Shutdown race/all coordinator (`Promise.race`, `Promise.all`, `Ac`, `fc`, `l8`) |
| `Ac` | KLH shutdown caller |
| `fc` | Timeout cleaner and UX_ poster |
| `UX_` | Post-shutdown reporter (`rP.post`, `v`) |
| `lV_` | Local settings exclude-rule writer; calls `x8`, `ZnL`, `r_`, `hH` |
| `x8` | Settings file loader (`Pl6`, `Kd`) |
| `Pl6` | Settings cache manager (`UJA`, `g6_`, `BJA`) |
| `UJA` | Settings cache lookup (`Mm6.has`, `Mm6.get`) |
| `g6_` | Settings parser (`bmA`, `HzH`, `qd`, `SmA`, `Tr`) |
| `BJA` | Settings cache setter (`Mm6.set`) |
| `Kd` | Settings path resolver (`X_`, `g46`, `_Q8`, `p46`, `eGH`, `HEH`, `d46`, `aOH`, `sOH`, `b6_`, `DmA`, `hr`, `w$6`) |
| `X_` | Base path expander (`uv`) |
| `ZnL` | Pattern validator via regex match (`H.match`) |
| `r_` | Exclude-rule appender and settings writer; uses `cO`, `Kd`, `TM6`, `sz`, `vc6`, `DU`, `kH`, `pH_` |
| `cO` | Sandbox config object builder (`HzH`, `Kd`) |
| `HzH` | Settings file path constructor (`_I.join`, `Xl6`, `dT4`, `Sx`, `QT4`) |
| `Q6` | Directory existence checker |
| `oP` | File read orchestrator (`Zr`) |
| `Zr` | Sync file reader (`Q6`, `R$`, `v`, `xd6`, `_.readFileSync`, `ud6`) |
| `R8` | Error classifier (`v8`) |
| `v8` | ENOENT/error code mapper |
| `pH_` | Timestamp recorder for settings (`Rc6.set`, `Date.now`) |
| `rTH` | Settings path re-resolver (`Xl6`, `Kd`) |
| `Xl6` | Absolute path resolver (`_I.resolve`, `a8`, `_I.dirname`) |
| `TM6` | Atomic file writer (temp + `renameSync`, `fchmodSync`, `fsyncSync`) |
| `sz` | Settings cache invalidator (`Mm6.clear`, `FF8.clear`) |
| `vc6` | Settings persistence writer (`b6`, `GH_`, `H.replaceAll`, `Nc6`, `zE4`, `wKH`, `FOH`) |
| `b6` | Base settings loader (`bd6`, `X_`) |
| `GH_` | Git-aware path handler (`F4`) |
| `Nc6` | gitignore rule checker (`S_`) |
| `zE4` | Path expander with home-dir support (`S_`, `_.trim`, `wKH.join`, `vH_.homedir`) |
| `GxA` | Settings diff/merge helper (`S_`) |
| `ExA` | Append-mode write helper |
| `Sx` | Path joiner (`_I.join`) |
| `DU` | Settings load dispatcher (`nT`, `u9`, `Q6_`, `Kd`, `$m6`) |
| `nT` | Pre-load telemetry emitter |
| `u9` | Memory usage tracker (`MWA`, `Ox`, `Bc8`, `process.memoryUsage`) |
| `Q6_` | Settings load executor (`Date.now`, `j8`, `Om6`, `Tr`, `D$6`, `bmA`, `HzH`) |
| `kH` | Shell command runner with error logging (`HA`, `eH`, `Dq`, `qW4`, `hBH`, `Er.logError`) |
| `HA` | Error string builder |
| `eH` | String coercer |
| `Dq` | Traffic-type classifier (`xSA`, `essential-traffic` literal) |
| `qW4` | Command queue manager (`kd6.shift`, `kd6.push`) |
| `ie` | Final result renderer called at end of `ERf` |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.