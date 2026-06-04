---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.162"
updated: "2026-06-04"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.162 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.162 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.162

---

## Overview

The `/sandbox` command manages the sandboxing configuration for Claude Code's tool execution environment. It allows users to configure sandbox settings interactively (with no arguments) or to add exclusion patterns for specific command patterns that should bypass sandboxing. The command enforces platform-support checks, dependency verification, and policy-lock guards before applying any changes to `.claude/settings.local.json`.

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
| module_id | `l8K` |
| load_inline | `true` |
| loc_byte | `12548343` |
| loc_byte_end | `12548992` |
| loc_line | `8918` |
| arbor_handler.name | `Mkf` |
| arbor_handler.fqn | `claude-2.1.162::Mkf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.162 bundle.js:+12548343

---

## Input Branching

The handler has 5+ distinct paths (platform unsupported → WSL1 check → dependency failure → policy lock → subcommand dispatch), so a Mermaid flowchart is required.

```mermaid
flowchart TD
    A(["/sandbox [args]"]) --> B{Platform supported?\nIA.isSupportedPlatform}
    B -- No, WSL1 detected --> C["Return error:\n'Sandboxing requires WSL2.\nWSL1 is not supported.'"]
    B -- No, other platform --> D["Return error:\n'Sandboxing is currently only\nsupported on macOS, Linux, and WSL2.'"]
    B -- Yes --> E{IA.checkDependencies}
    E -- Fail --> F["Return error result\n(dependency missing)"]
    E -- Pass --> G{IA.areSandboxSettingsLockedByPolicy}
    G -- Locked --> H["Return error:\n'Sandbox settings are overridden\nby a higher-priority configuration\nand cannot be changed locally.'"]
    G -- Not locked --> I{Parse args:\nfirst token}
    I -- token == 'exclude' --> J{Remaining args\npresent?}
    J -- No --> K["Return error:\n'Please provide a command pattern\nto exclude (e.g., /sandbox exclude\n\"npm run test:*\")'"]
    J -- Yes --> L["Call VZ_ with pattern\nEmit sandbox_exclude_command\nWrite exclusion rule to\n.claude/settings.local.json"]
    I -- no args / other --> M["Open interactive\nconfiguration UI\n(JSX component via hi)"]
    L --> N([Done])
    M --> N
```

Analysis basis: CC v2.1.162 bundle.js:+12546962

---

## Behavioral Spec

### Main Handler — Platform and Policy Guard

```
async function sandboxCommandHandler(args, appState):
    // Step 1: Detect rendering theme (light/dark)
    theme = getTheme()                          // yA  — loc +12546962
    outputHelper = getOutputHelper()            // o6  — loc +12546984

    // Step 2: Platform check
    if not sandboxPlatform.isSupportedPlatform():   // IA.isSupportedPlatform — loc +12546993
        platformInfo = getPlatformInfo()
        if platformInfo includes "wsl":             // literal "wsl" — loc +12547029
            return errorResult(
                "Error: Sandboxing requires WSL2. WSL1 is not supported."
            )                                       // literal — loc +12547035
        else:
            return errorResult(
                "Error: Sandboxing is currently only supported on macOS, Linux, and WSL2."
            )                                       // literal — loc +12547093

    // Step 3: Render platform/dependency status (EA)
    statusDisplay = renderSandboxStatus(theme)  // EA — loc +12547170

    // Step 4: Dependency check
    depResult = await sandboxPlatform.checkDependencies()   // IA.checkDependencies — loc +12547210
    if depResult.failed:
        return errorResult(depResult)

    // Step 5: Policy lock check
    if sandboxPlatform.areSandboxSettingsLockedByPolicy():  // IA.areSandboxSettingsLockedByPolicy — loc +12547399
        return errorResult(
            "Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally."
        )                                           // literal — loc +12547458

    // Step 6: Parse subcommand
    tokens = args.split(...)                    // M.split — loc +12547685
    firstToken = tokens[0]

    if firstToken == "exclude":                 // literal "exclude" — loc +12547708
        pattern = tokens.slice(8)               // M.slice — loc +12547725 (byte offset 8 into token)
        if pattern is empty:
            return errorResult(
                "Error: Please provide a command pattern to exclude (e.g., /sandbox exclude \"npm run test:*\")"
            )                                   // literal — loc +12547770
        // Step 6a: Apply exclude rule
        processExclusion(pattern, appState)     // VZ_ — loc +12547918
        relPath = path.relative(cwd, settingsPath)  // d8K.relative — loc +12547955
        // Writes to .claude/settings.local.json — literal loc +12547976
    else:
        // Step 6b: Open interactive configuration
        openSandboxConfigUI(appState)           // hi — loc +12547968
```

Analysis basis: CC v2.1.162 bundle.js:+12546962

---

### Sub-feature: Status Display Renderer (`EA`)

```
function renderSandboxStatus(theme):
    // Checks prefix-based color codes
    if colorSpec.startsWith("rgb("):            // H.startsWith — loc +3797377
        parseRgbColor(colorSpec)
    elif colorSpec.startsWith("ansi256("):
        parseAnsi256Color(colorSpec)
    elif colorSpec.startsWith("ansi:"):
        parseAnsiColor(colorSpec)
    else:
        // Map named color strings to chalk methods (NYH)
        // Supports: black, red, green, yellow, blue, magenta, cyan, white,
        //           plus Bright variants and bg* variants
        //           — loc range +3459619 to +3460774
        applyNamedColor(colorSpec)              // NYH — loc +3797473

    return colorizedStatusString
```

Analysis basis: CC v2.1.162 bundle.js:+3797377

---

### Sub-feature: Exclusion Pattern Processor (`VZ_`)

```
function processExclusion(rawPattern, appState):
    // Load current local settings
    localSettings = loadSettings("localSettings")   // m8 — literal "localSettings" loc +4678927

    // Filter existing rules
    existingRules = localSettings.filter(...)       // _.filter — loc +4678995

    // Validate pattern format
    if not patternMatchesExpected(rawPattern):      // VQL / H.match — loc +4669893
        // report validation issue
        return

    if not exclusionList.includes(rawPattern):      // q.includes — loc +4679208
        // Apply the new rule via rule-adder
        applyRule = addRules(rawPattern)            // r_ — loc +4679222, literal "addRules" loc +4679018

    // Render feedback (hH)
    renderFeedback(appState)                        // hH — loc +4679301

    // Emit telemetry event
    emit("sandbox_exclude_command")                 // literal loc +4679304
```

Analysis basis: CC v2.1.162 bundle.js:+4678924

---

### Sub-feature: Settings Persistence (`r_` / Settings Layer)

```
function writeExclusionToSettings(pattern):
    // Resolve path to .claude/settings.local.json
    settingsPath = resolve(".claude", "settings.local.json")
    //   literal ".claude/settings.local.json" loc +12547976
    //   literal "settings.local.json"          loc +1266601

    // Load existing file (Zd6 — async read via WOH.readFile)
    existing = await readSettingsFile(settingsPath)

    // Merge exclusion rule
    updated = mergeRule(existing, pattern)

    // Write atomically (u56 — uses temp file + rename)
    //   writes to temp file  — f$.writeFileSync  loc +1055825
    //   applies permissions  — f$.fchmodSync     loc +1055883
    //   syncs to disk        — f$.fsyncSync      loc +1055949
    //   renames atomically   — q.renameSync      loc +1056077
    atomicWrite(settingsPath, updated)
```

Analysis basis: CC v2.1.162 bundle.js:+1276215 (Zd6), +1054673 (u56)

---

### Sub-feature: Sandbox Platform Checks (`IA`)

The object referenced as `IA` (sandboxPlatform) exposes three methods called from the main handler:

| Method | Purpose | loc_byte |
|---|---|---|
| `IA.isSupportedPlatform` | Returns boolean; false on unsupported OS or WSL1 | +12546993 |
| `IA.checkDependencies` | Async; verifies required system tools are present | +12547210 |
| `IA.isPlatformInEnabledList` | Checks whether current platform is in the allow-list | +12547237 |
| `IA.areSandboxSettingsLockedByPolicy` | Returns boolean; true when enterprise/policy settings prohibit local override | +12547399 |

Analysis basis: CC v2.1.162 bundle.js:+12546993

---

### Sub-feature: Interactive Configuration UI (`hi`)

When invoked without a recognized subcommand, the handler delegates to `hi` (loc +12547968), which renders a JSX-based interactive configuration component. This component is a `local-jsx` type widget that allows the user to toggle sandbox settings interactively (press `⏎` to configure, as indicated in the description field). The exact UI shape is rendered in-terminal as a React/Ink component.

Analysis basis: CC v2.1.162 bundle.js:+12547968

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `sandbox_exclude_command` (literal, loc +4679304) emitted when an exclusion rule is successfully added. No `tengu_*` events are emitted directly from the top-level handler; the `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` events (locs +1008233, +1008295, +1008376) are emitted from the shared feature-outcome helper (`hH` / `RH`). |
| Settings file written | `.claude/settings.local.json` (literal loc +12547976) — exclusion rules are persisted here via atomic rename. |
| Policy guard | When `areSandboxSettingsLockedByPolicy()` is true, no file write occurs; an error message is returned instead. |
| Platform guard | On WSL1 or unsupported platforms, command terminates early with a descriptive error; no side effects. |
| appState changes | Sandbox exclusion rules are added to the `localSettings` layer; the `addRules` path updates the in-memory settings object as well as the file. |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | None identified in depth-2 traversal. |

---

## Version History

| Version | Change |
|---|---|
| v2.1.162 | Initial analysis |

---

## Common Mistakes

1. **Forgetting to quote the pattern**: The argument hint shows `exclude "command pattern"`. Patterns containing spaces or glob wildcards (e.g., `npm run test:*`) must be quoted; passing them unquoted causes the pattern to be parsed incorrectly or only the first token to be treated as the pattern.
2. **Running on WSL1**: The command explicitly rejects WSL1 (literal loc +12547035). Users must upgrade to WSL2 before sandbox configuration is available.
3. **Enterprise/policy lock**: In managed environments, `areSandboxSettingsLockedByPolicy()` may return `true`, blocking all local changes. The error message (loc +12547458) indicates the setting is controlled at a higher priority level; changes must be made at the policy source instead.
4. **Expecting immediate tool-call effect**: `/sandbox` modifies `.claude/settings.local.json`. The new exclusion rules apply to subsequent agent turns, not to any tool call already in flight.
5. **Running on unsupported platforms**: Sandboxing is only available on macOS, Linux, and WSL2. Running on native Windows (without WSL2) produces the unsupported-platform error (loc +12547093).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Mkf` | Main async handler for `/sandbox` command (arbor_handler) |
| `EA` | Sandbox status display renderer; parses color specs and renders status string |
| `NYH` | Named-color-to-chalk mapper; maps color name strings to chalk fg/bg methods |
| `IA` | Sandbox platform object; exposes `isSupportedPlatform`, `checkDependencies`, `isPlatformInEnabledList`, `areSandboxSettingsLockedByPolicy` |
| `VZ_` | Exclusion pattern processor; loads local settings, validates pattern, calls rule-adder |
| `VQL` | Pattern format validator; calls `H.match` against expected glob/command format |
| `r_` | Rule application and settings-write orchestrator |
| `m8` | Settings loader; resolves and loads the local settings object |
| `Xc6` | Settings cache reader (checks `Lu6` map for cached settings) |
| `cwA` | Settings cache writer (`Lu6.set`) |
| `dwA` | Settings cache lookup (`Lu6.has` / `Lu6.get`) |
| `gQ` | Settings object builder; assembles all settings sub-objects |
| `NM6` | Settings initialization; calls output helper (`o6`) and sets up settings module |
| `vH_` | Settings field hydrator; applies defaults and field transformations |
| `gO` | Get-or-create settings helper used in exclusion path |
| `COH` | User/project settings path resolver; joins `.claude` directory paths |
| `Zd6` | Async settings file reader/writer; reads, merges, and writes settings JSON |
| `u56` | Atomic file writer; uses temp file + `fchmodSync` + `fsyncSync` + `renameSync` |
| `I24` | Settings path normalizer; handles `~/` expansion and absolute-path resolution |
| `Td6` | Git-check helper used during settings directory resolution |
| `ZCA` | Settings merge/validation helper |
| `cz` | Settings cache clear utility (`Lu6.clear`, `VB8.clear`) |
| `_U` | Settings load orchestrator; calls `IH_` (load-from-disk) and `gQ` (build object) |
| `IH_` | Disk-based settings loader; emits `settings_load_started` / `settings_load_completed` telemetry |
| `C9` | Memory-usage sampler called during settings load (`process.memoryUsage`) |
| `pT` | Settings load pre-check helper |
| `kH` | Shell execution helper used during dependency/platform checks |
| `t_` | Error-to-string converter |
| `tH` | String coercion helper |
| `wq` | Network traffic category resolver (`essential-traffic`) |
| `Gj4` | Command queue manager (`vQ6.shift` / `vQ6.push`) |
| `hH` | "Feature OK" UI feedback renderer; emits `tengu_feature_ok` |
| `RH` | "Feature Bad" UI feedback renderer; emits `tengu_feature_bad` |
| `t6` | Rendering utility used in feedback path |
| `Z6` | Low-level render primitive |
| `c` | Base render/component primitive |
| `hi` | Interactive sandbox configuration JSX component (opened when no subcommand given) |
| `H` | Bootstrap/fetch utility; fetches remote config with `Content-Type`/`User-Agent` headers |
| `v` | HTTP request builder; constructs fetch calls with debug logging |
| `PgK` | HTTP response parser |
| `SH` | JSON serialization helper (`JSON.stringify`) |
| `V4` | URL/path construction helper |
| `WpH` | HTTP helper wrapper (`pXA`) |
| `EgK` | Byte-length-aware streaming helper (`Buffer.byteLength`) |
| `AY_` | String splitter/trimmer for parsed responses |
| `LHH` | Token/key set membership checker (`Y94.has`) |
| `bJ` | String replacement utility (`H.replace`) |
| `a1` | Shell-command argument normalizer (`oHH`, `qq`, `rX`) |
| `oHH` | Command output formatter |
| `qq` | Model-name normalizer; maps shorthand names (`sonnet`, `haiku`, `opus`, `best`) |
| `rX` | Command result wrapper |
| `M` | MCP server manager; handles `RCH` (reconnect/connect) and `xp8` (apply connection result) |
| `RCH` | MCP connection orchestrator; manages server lifecycle, auth, and retry |
| `jl` | MCP server list builder |
| `g_H` | Per-server connection handler |
| `Jl` | SDK-type server enumerator |
| `hz8` | MCP error/warning color renderer |
| `E06` | MCP server slot state machine (SSE/HTTP type handling) |
| `sI` | MCP state initializer (`nO`, `CR_`) |
| `nO` | MCP connection state constructor |
| `Pvq` | MCP connection attempt orchestrator |
| `Ps_` | MCP pre-connection validator |
| `AXH` | MCP config hasher (`ub9.createHash`, `sha256`) |
| `kz8` | MCP config key extractor |
| `yz8` | MCP config hash updater (`wP`) |
| `wP` | Hash computation helper (`Sb9.createHash`) |
| `vz8` | MCP config version resolver (`W4`) |
| `W4` | Version normalization helper (`Nj1`) |
| `Y8` | MCP debug logger (`Dr.logMCPDebug`) |
| `ja_` | MCP server connection manager; spawns transport, handles OAuth |
| `SAf` | MCP transport factory |
| `BQ` | MCP base transport constructor |
| `y1H` | MCP claude.ai connector helper |
| `S1H` | MCP OAuth flow runner; manages local callback server, state, token exchange |
| `z_6` | MCP pending-auth map manager (`CN8`) |
| `FN8` | MCP auth cache file handler (`mcp-needs-auth-cache.json`) |
| `Dn` | MCP server reconnect orchestrator |
| `Nx` | MCP transport base |
| `D` | MCP server supervisor/daemon writer |
| `G7` | MCP error logger (`Dr.logMCPError`) |
| `TH` | String coercion helper (toString) |
| `hAf` | SSH/remote session detector (`y6.isSSH`) |
| `Xa_` | MCP OAuth callback URL handler |
| `O_6` | MCP pending request map reader (`RN8.get`) |
| `D_6` | MCP pending auth map reader (`CN8.get`) |
| `kvq` | MCP connection retry helper |
| `V9` | AsyncLocalStorage accessor (`d0L.getStore`) |
| `jv8` | MCP cache path builder (`Jv8.join`) |
| `Ja_` | MCP config hash comparison helper |
| `IR_` | MCP server filter (excludes disabled/suppressed) |
| `G8` | Global config save guard; prevents auth-loss writes |
| `xp8` | MCP connection result applier; handles orphaned connections |
| `SCH` | MCP slot config hasher |
| `hk` | MCP cleanup orchestrator |
| `N_6` | MCP tool list hasher (`AXH`) |
| `ROA` | MCP remote server retry manager |
| `Rz8` | MCP server status set checker (`a$7.has`, `yR_.has`) |
| `n8` | Timer-based async helper with abort support |
| `O` | Background session marker |
| `z` | App-level session object; holds `hH`, `RH`, `Kh`, `jp` |
| `Kh` | Session shutdown initiator; emits `tengu_daemon_control` |
| `ex` | Session cleanup runner |
| `HC` | Session state finalizer |
| `ZNH` | Session listener teardown |
| `qh` | Hook cleanup helper |
| `iJ_` | Session UUID generator and event emitter |
| `R18` | Session initialization orchestrator |
| `pU` | Random-bytes token generator |
| `jp` | Process exit coordinator (`Promise.race`, `process.exit`) |
| `Bd` | Graceful shutdown initiator (`F4H.shutdown`) |
| `dd` | Datadog flush helper (`FP.post`) |
| `Tj_` | Datadog POST transport |
| `p1K` | Daemon status file writer (`daemon.status.json`) |
| `Ur` | Daemon status serializer |
| `GS6` | Daemon status path builder (`m1K.join`) |
| `Te8` | Tool-call timestamp recorder (`yd6.set`) |
| `yTH` | Settings path resolver helper |
| `jc6` | Settings file path builder (`lv.resolve`, `lv.dirname`) |
| `Ix` | `.claude` directory path joiner |
| `x6` | Settings read helper |
| `Ke8` | Settings node parser (`n4`) |
| `VCA` | Settings write helper |
| `fu6` | Settings post-load finalizer |
| `A46` | Settings field: policy settings accessor |
| `UF8` | Settings field accessor |
| `tK6` | Settings field accessor |
| `xGH` | Settings field accessor |
| `uGH` | Settings field accessor |
| `K46` | Settings field accessor |
| `yOH` | Settings field accessor |
| `hOH` | Settings field accessor |
| `WH_` | Settings field accessor |
| `jxA` | Settings field accessor |
| `Er` | Settings field accessor |
| `X_` | Settings primitive loader (`Nv`) |
| `PB` | Promise/async stream iterator (internal concurrency primitive) |
| `Tvq` | MCP protocol version negotiator |
| `I_6` | MCP integer parser (`parseInt`, base 10) |
| `Xv8` | MCP integer parser variant (`parseInt`, base 20) |
| `K` | Padded-line renderer (`f.padEnd`) |
| `f` | Session channel object (`A.close`, `q.close`) |
| `L` | Async task set manager (`q.add`, `q.delete`) |
| `q_` | Quoted-string builder |
| `sI6` | MCP server state inspector |
| `CR_` | MCP connection result constructor |
| `SAf` | MCP server address formatter |
| `RAf` | MCP reconnect result handler |
| `h1H` | MCP claude.ai secondary connector |
| `iN` | MCP inactivity tracker |
| `ZB` | MCP zero-byte sentinel |
| `Nk` | MCP notification handler |
| `jn` | MCP JSON-RPC framer |
| `hN` | MCP hook notifier (`j6`) |
| `j6` | Hook dispatch core |
| `wv8` | MCP write buffer |
| `C4` | MCP capability checker |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.