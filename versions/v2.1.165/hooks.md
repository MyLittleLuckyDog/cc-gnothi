---
type: feature-spec
feature: "hooks"
cc_version: "2.1.165"
updated: "2026-06-05"
tags: ["hooks", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.165 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/hooks`

> Analysis basis: CC v2.1.165 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.165

---

## Overview

The `/hooks` command displays the current hook configurations associated with tool events in the active Claude Code session. It is a read-only, immediate `local-jsx` command that renders hook configuration data directly in the terminal UI by reading application state and presenting it via a React element tree.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `hooks` |
| description | `View hook configurations for tool events` |
| loc_byte | `12467591` |
| loc_byte_end | `12467741` |
| loc_line | `8927` |
| immediate | `true` |
| module_id | `x8K` |
| load_inline | `true` |
| arbor_handler.name | `Whf` |
| arbor_handler.fqn | `claude-2.1.165::Whf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.165 bundle.js:+12467591

---

## Input Branching

The command's rendering logic branches across several distinct paths depending on whether hooks exist, what type of hooks are configured, whether tool-narrowing overrides apply, and the enabled/blocked state of individual hooks. A Mermaid flowchart is used below.

```mermaid
flowchart TD
    A[/hooks invoked] --> B[Read app state via getAppState]
    B --> C[Collect hook configuration entries]
    C --> D{Any hooks configured?}
    D -- No --> E[Render empty / no-hooks message]
    D -- Yes --> F[Iterate over hook event categories]
    F --> G{Hook entry type}
    G -- allowed tool event --> H[Render allowed hook details]
    G -- disallowed tool event --> I[Render disallowed hook details]
    G -- session-scoped --> J[Render session hook details]
    H --> K{Tool narrowing override present?}
    I --> K
    J --> K
    K -- cliArg narrowing --> L[Annotate with CLI-arg source]
    K -- toolsNarrowing --> M[Annotate with tools-narrowing source]
    K -- None --> N[Render hook row as-is]
    L --> O[Render final hook table / list]
    M --> O
    N --> O
    O --> P{Any hook blocked?}
    P -- Yes --> Q[Mark blocked hooks visually]
    P -- No --> R[Display clean hook listing]
    Q --> S[Return JSX element tree]
    R --> S
```

---

## Behavioral Spec

### Main Handler — `hooksCommandHandler`

This is the async function resolved by Arbor as `Whf` (fqn: `claude-2.1.165::Whf`), reached via `module_id` resolution through module `x8K`.

```
async function hooksCommandHandler(context):
    emit telemetry event "tengu_hooks_command"
    appState = readCurrentAppState()           // via getAppState helper
    hookConfig = collectHookConfiguration(appState)
    uiElement = buildHooksJSX(hookConfig, appState)
    return uiElement
```

Analysis basis: CC v2.1.165 bundle.js:+12467389, +12467391, +12467431, +12467461

---

### App State Reader — `appStateReader`

Resolves to identifier `R_`. Calls `H.getAppState` to obtain the current session's live configuration snapshot, then searches backward through session history using `A.findLast` to locate the most recent relevant state entry.

```
function appStateReader(sessionHistory):
    state = H.getAppState()
    lastRelevantEntry = sessionHistory.findLast(entry => isRelevant(entry))
    return buildStateSnapshot(state, lastRelevantEntry)
```

Key fields extracted from state (literals found in traversal):

- `working_directory` (bundle.js:+10916390)
- `allowed_tools` (bundle.js:+10916445)
- `disallowed_tools` (bundle.js:+10916500)
- `avoid_prompts` (bundle.js:+10916561)
- `session` (bundle.js:+10916860)
- `effort` (bundle.js:+10916885)
- `model` (bundle.js:+10916898)
- `max_thinking_tokens` (bundle.js:+10916910)
- `flag_settings` (bundle.js:+10916936)

Analysis basis: CC v2.1.165 bundle.js:+10916285, +10916365

---

### Hook Configuration Collector — `hookConfigCollector`

Resolves through `Av` (the JSX rendering coordinator). Reads hook configuration by:

1. Filtering session hooks via `u1H` (hook filter function).
2. Expanding denied tools using `EI6` → `YMH` which calls `eI8.flatMap` to flatten nested hook definitions.
3. For each hook entry, checking the deny/allow state (literal `"deny"` at bundle.js:+10651818).
4. Annotating tool source as `"cliArg"` (bundle.js:+10652404) or `"toolsNarrowing"` (bundle.js:+10652425).

```
function hookConfigCollector(appState):
    rawHooks = appState.hooks.filter(isHookEntry)
    expanded = rawHooks.flatMap(expandNestedHookDefs)
    annotated = []
    for hook in expanded:
        source = determineSource(hook)   // "cliArg" | "toolsNarrowing" | null
        blocked = isBlocked(hook)        // literal "blocked" at +9857752
        annotated.append({hook, source, blocked})
    return annotated
```

Analysis basis: CC v2.1.165 bundle.js:+9858499, +9857691, +9857706, +10652467, +10651741, +10652404, +10652425, +9857752

---

### JSX Renderer — `hooksJSXRenderer`

Resolves to identifier `Av`. Orchestrates the complete React element tree for display. Internally:

1. Calls `MG` to set up the React render context (checking `"cli"` vs `"remote"` environment literals at bundle.js:+4793649, +4793660).
2. Calls `Ro_` to set up keyboard / input event bindings.
3. Calls `OP` to determine workflow and feature-flag state (checking `"allow_workflows"` at bundle.js:+4179842, `"allow_product_feedback"` at bundle.js:+4178415).
4. Calls `Zt` to render the main hook display panel, which itself uses:
   - `PP` for permission-level rendering.
   - `Co_` for hook-category grouping.
   - `n9` for agent-teams rendering (literal `"--agent-teams"` at bundle.js:+5481208).
   - `xN` for environment/mode rendering (literals `"standard"`, `"tst"`, `"tst-auto"` at bundle.js:+6580130, +6580209, +6580259).
5. Checks `lq.isEnabled` and `O.isEnabled` to gate feature-flag-controlled hook categories.
6. Filters hooks by `DrH.has` membership check.
7. Maps each hook to a rendered row via `K.map`.
8. Calls `$.includes` to check inclusion in the active tool set.

```
function hooksJSXRenderer(annotatedHooks, appState):
    env = detectEnvironment()          // "cli" or "remote"
    renderCtx = setupRenderContext(env)
    keyBindings = setupKeyBindings()
    featureFlags = resolveFeatureFlags()   // allow_workflows, allow_product_feedback
    
    rows = []
    for hook in annotatedHooks:
        if not featureFlags.isEnabled(hook.category):
            continue
        if not dragonHookSet.has(hook.id):
            continue
        row = renderHookRow(hook)
        rows.append(row)
    
    panel = renderMainPanel(rows, appState)
    return createElement(panel)
```

Analysis basis: CC v2.1.165 bundle.js:+9858376, +9858463, +9858477, +9858499, +9858514, +9858526, +9858586, +9858686, +9858704, +9858731, +9858744, +9858755, +9858831, +9858846, +9858874, +9858885, +9858927, +9858972, +12467461

---

### Blocked Hook Rendering

When a hook entry carries the `"blocked"` flag (bundle.js:+9857752), the renderer applies a distinct visual treatment. The `"deny"` literal (bundle.js:+10651818) is used to label the hook's permission state in the output table.

```
function renderHookRow(hook):
    label = hook.name
    source = hook.source ?? ""
    state = hook.blocked ? "blocked" : (hook.allow ? "allow" : "deny")
    return formatRow(label, source, state)
```

Analysis basis: CC v2.1.165 bundle.js:+9857752, +10651818

---

### Table Formatting

The hook display table uses `aLK` to compute column widths:

```
function computeColumnWidths(hookRows):
    keys = Object.keys(hookRows[0])
    maxWidth = Math.max(...keys.map(k => measureColumnWidth(hookRows, k)))
    return maxWidth
```

Column padding uses a two-space separator literal `"  "` (bundle.js:+16158457) and a column width cap of `40` characters (bundle.js:+16160428).

Analysis basis: CC v2.1.165 bundle.js:+12931188, +12931233, +16158457, +16160428

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_hooks_command` | Fired immediately when `/hooks` is invoked (bundle.js:+12467391) |
| Telemetry: `tengu_feature_ok` | Fired on successful feature check path (bundle.js:+1010222) |
| Telemetry: `tengu_feature_sad` | Fired on degraded feature check path (bundle.js:+1010365) |
| Telemetry: `tengu_feature_bad` | Fired on failed feature check path (bundle.js:+1010284) |
| Telemetry: `tengu_slate_harbor` | Fired during render context setup (bundle.js:+4793679) |
| Telemetry: `tengu_workflows_enabled` | Fired when workflow feature flag is active (bundle.js:+4180043) |
| Telemetry: `tengu_cobalt_ridge` | Fired during hook-category resolution (bundle.js:+4910281) |
| Telemetry: `tengu_daemon_control` | Fired during daemon interaction in UI (bundle.js:+16170625) |
| Telemetry: `tengu_daemon_config_reload` | Fired when daemon config is reloaded from UI (bundle.js:+16149069) |
| Telemetry: `tengu_amber_flint` | Fired during agent-teams hook resolution (bundle.js:+5481320) |
| appState reads | `working_directory`, `allowed_tools`, `disallowed_tools`, `avoid_prompts`, `session`, `effort`, `model`, `max_thinking_tokens`, `flag_settings` |
| appState mutations | None — command is read-only display |
| React element creation | `cKA.createElement` called to produce JSX output (bundle.js:+12467461) |
| Hook registration | Keyboard/input event bindings set up via `Ro_` for interactive navigation within the hook display |
| Sound | None detected in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.165 | Initial analysis |

---

## Common Mistakes

1. **Expecting `/hooks` to modify hook configuration** — this command is purely display/read-only. Use Claude Code settings files or CLI arguments to change hook definitions.
2. **Assuming hooks are always shown** — hooks gated by feature flags (`lq.isEnabled`, `O.isEnabled`) will not appear in the output if the flag is disabled, which may make hooks appear missing even if they are configured.
3. **Interpreting `blocked` as deleted** — a hook marked `"blocked"` is still in the configuration; it is simply prevented from executing in the current session context (e.g. due to tool-narrowing overrides).
4. **Confusing `cliArg` and `toolsNarrowing` sources** — `"cliArg"` indicates the tool restriction was passed on the command line; `"toolsNarrowing"` indicates it was applied via the session's internal tools-narrowing mechanism. Both affect which hooks fire.
5. **Running `/hooks` expecting daemon-level hook state** — the `"daemon.status.json"` file (bundle.js:+12743842) tracks daemon status separately; `/hooks` reads session-level app state, not the daemon status file directly.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Whf` | Main handler (`hooksCommandHandler`) — async function, Arbor-resolved entry point |
| `c` | Telemetry emit helper (used at call-start and in sub-renderers) |
| `R_` | App state reader (`appStateReader`) — calls `H.getAppState` |
| `H` | App state / bootstrap fetch module |
| `v` | Debug/log utility (uses `"debug"` literal) |
| `icK` | Log formatter sub-utility |
| `SH` | JSON serialization helper (wraps `JSON.stringify`) |
| `J4` | String path/slice utility |
| `ppH` | String processing helper |
| `acK` | File/buffer hook processor (uses `Buffer.byteLength`, limits 1000/100) |
| `e$` | Secondary app state accessor |
| `Gw_` | String split/trim/index utility |
| `q` | File system operation module (uses `unlinkSync`) |
| `ZHH` | Set membership checker (`c44.has`) |
| `uj` | String replacement utility |
| `e1` | Text normalization entry point |
| `D6H` | Text normalization sub-processor |
| `Aq` | Model name normalizer (handles `"opusplan"`, `"sonnet"`, `"haiku"`, `"opus"`, `"best"`) |
| `eX` | Extended text normalizer |
| `s6` | Feature check runner |
| `P6` | Feature check sub-handler (calls `Nu6`) |
| `A` | Stream/connection object |
| `f` | Connection handle (close operations) |
| `L` | Async operation set manager (add/delete/finally) |
| `pk8` | Permission handler variant A |
| `Uk8` | Permission handler variant B |
| `L1` | Shared permission resolution function |
| `Av` | JSX rendering coordinator (`hooksJSXRenderer`) |
| `MG` | Render context setup (cli/remote environment detection) |
| `cQ` | Render context sub-component |
| `JK` | String conversion wrapper |
| `eH` | String constructor wrapper |
| `D6` | Dependency/subscription registry |
| `Hj6` | Registry sub-helper A |
| `_j6` | Registry sub-helper B |
| `qu` | Registry lookup helper |
| `B98` | Registry set/get manager |
| `y6` | Subscription event emitter |
| `Y` | Supervisor/daemon UI interaction module |
| `C0H` | Hook display table renderer |
| `N9` | Async store accessor (`QZL.getStore`) |
| `v8` | ENOENT error handler |
| `X7A` | Table row builder |
| `EH` | String coercion helper |
| `K` | Column formatter (map + padEnd) |
| `aLK` | Column width calculator (`Object.keys`, `Math.max`) |
| `E` | Event handler (preventDefault, remoteControlAtStartup) |
| `b` | Event object |
| `t0` | Settings writer (`"userSettings"`) |
| `T` | Supervisor process controller (stop/updateConfig/start) |
| `$mK` | Heartbeat handler |
| `L8H` | Heartbeat sub-routine |
| `V` | Secondary supervisor controller |
| `Ro_` | Keyboard/input binding setup |
| `k_` | Module initializer (ES module setup, `fwA.set`) |
| `Zu6` | Bound callback factory |
| `OP` | Feature-flag / workflow state resolver |
| `Q78` | Workflow query helper |
| `nT` | Workflow state sub-checker |
| `aL9` | Workflow allowance resolver |
| `W9` | Workflow permission gate (`allow_workflows`) |
| `ET_` | Extended tool-flag resolver |
| `SBL` | Tool-flag sub-processor (`"pro"` tier check) |
| `hBL` | Feedback flag resolver |
| `u1H` | Hook entry filter |
| `EI6` | Hook expansion coordinator |
| `YMH` | Nested hook flattener (`eI8.flatMap`) |
| `OHA` | Hook object builder |
| `iSq` | Hook inclusion checker |
| `Co_` | Hook category grouper |
| `pC` | Category sub-processor (`"windows"` platform check) |
| `V4` | Secondary category processor |
| `z` | Daemon control module |
| `hH` | Daemon stop event emitter (`"daemon_stop"`) |
| `RH` | Daemon stop-failed event emitter (`"daemon_stop_failed"`) |
| `Yh` | Daemon control event handler (`"firstParty"`) |
| `Au` | Daemon lifecycle helper |
| `QNH` | Daemon notification handler |
| `zX_` | UUID-based daemon event emitter (`$X_.randomUUID`) |
| `Tp` | Process shutdown coordinator (`Promise.race`, `Promise.all`, `process.exit`) |
| `Ac` | Shutdown initiator (`KLH.shutdown`) |
| `fc` | Timeout clearer (`clearTimeout`) |
| `l8` | Abort/timeout promise (`"aborted"`, `"abort"`) |
| `Zt` | Main hook display panel renderer |
| `PP` | Permission-level renderer |
| `ig8` | Permission sub-renderer |
| `ow` | Permission string formatter |
| `Y_6` | Display layout helper |
| `n9` | Agent-teams hook renderer (`"--agent-teams"`) |
| `r97` | Agent-teams sub-processor |
| `D8f` | Display component A |
| `w8f` | Display component B |
| `xN` | Environment/mode renderer (`"standard"`, `"tst"`, `"tst-auto"`) |
| `hR_` | Mode-specific renderer |
| `XA` | Provider renderer (`"bedrock"`, `"foundry"`, `"anthropicAws"`, `"mantle"`, `"vertex"`) |
| `Hf` | Supplementary display component |
| `C4` | Feature capability check |
| `O` | Secondary feature-flag gate (`isEnabled`) |
| `b8` | Feature-flag backing store |
| `$` | Active tool set module |
| `NKK` | Daemon status reader (`"daemon.status.json"`) |
| `nr` | Status file path resolver |
| `JR6` | Status file path joiner (`VKK.join`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.