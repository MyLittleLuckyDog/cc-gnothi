---
type: feature-spec
feature: "context"
cc_version: "2.1.158"
updated: "2026-06-02"
tags: ["context", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.158 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/context`

> Analysis basis: CC v2.1.158 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.158

---

## Overview

`/context` is a local-JSX slash command that visualizes the current conversation's context window usage as a colored grid. It dispatches a `get_context_usage` control request to gather token-consumption data, then renders a React component showing categorized context segments (system prompt, memory files, tools, messages, etc.) each colored according to fill level, with a numeric usage percentage and optional `[all]` argument to show full details.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `context` |
| description | `Visualize current context usage as a colored grid` |
| argumentHint | `[all]` |
| thinClientDispatch | `control-request` |
| module_id | `Ey1` |
| load_inline | `true` |
| loc_byte | `11190590` |
| loc_byte_end | `11190816` |
| loc_line | `6812` |
| arbor_handler.name | `VsL` |
| arbor_handler.fqn | `claude-2.1.158::VsL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.158 bundle.js:+11190590

---

## Input Branching

The command has four distinct branches based on argument value and data availability, so a flowchart is used.

```mermaid
flowchart TD
    A([User types /context {arg}]) --> B{arg present?}
    B -- "No arg" --> C[arg = '' trimmed]
    B -- "arg provided" --> D{arg == 'all'?}
    D -- "Yes" --> E[showAll = true]
    D -- "No" --> F[showAll = false]
    C --> G[showAll = false]
    E --> H[Send control-request: get_context_usage]
    F --> H
    G --> H
    H --> I{Response received?}
    I -- "No / error" --> J[Render empty / error state via JSX]
    I -- "Yes" --> K[Parse context-usage payload]
    K --> L{showAll?}
    L -- "false" --> M[Render compact colored grid\n≥80% threshold highlighted]
    L -- "true" --> N[Render full grid with all segment labels\nProject/User/Local/Flag/Policy/Plugin/Built-in rows]
    M --> O([Return JSX element to shell])
    N --> O
    J --> O
```

Analysis basis: CC v2.1.158 bundle.js:+11189290 (argument trim), +11189315 (`"all"` literal), +11189726 (`80` threshold literal)

---

## Behavioral Spec

### Handler Entry Point (`VsL`)

The Arbor-resolved handler is `VsL` (AsyncFunction, resolution via `module_id → Ey1`).

```
async function contextCommandHandler(args, appContext):
    trimmedArg = args.trim()                          // +11189290
    showAll    = (trimmedArg == "all")                // +11189315

    // 1. Retrieve context-usage data via thin-client dispatch
    usageResponse = await sendControlRequest(
        kind   = "get_context_usage",                 // +11189380
        target = appContext.sessionTransport
    )

    // 2. Build grid data from usage response
    gridData = buildContextGrid(usageResponse, showAll)

    // 3. Render JSX
    return createElement(ContextGridComponent, { gridData, showAll })
```

Analysis basis: CC v2.1.158 bundle.js:+11189350 (`sendControlRequest`), +11189380 (`"get_context_usage"`)

---

### Control Request Dispatch (`sendControlRequest`)

The command uses `thinClientDispatch: "control-request"` which routes through the bridge-repl layer.

```
function sendControlRequest(kind, transport):
    requestId = generateUUID()
    message   = { type: "control_request", kind, uuid: requestId }
    transport.sendControlRequest(message)        // +11189350
    response  = await waitForControlResponse(requestId)
    return response
```

The bridge-repl handler for `get_context_usage` is present: if no `onGetContextUsage` callback is registered the bridge logs `"get_context_usage is not supported in this context"` and returns an error response.

Analysis basis: CC v2.1.158 bundle.js:+12380399

---

### Context Grid Builder (`xN6`)

`xN6` is the component/function that transforms the raw usage payload into renderable grid segments.

```
function buildContextGrid(usagePayload, showAll):
    segments = []

    // Filter to visible segment types
    allSegments = usagePayload.filter(...)           // +11187388
    targetSeg   = allSegments.find(...)              // +11187706

    // Named segment categories (literals found in implementation):
    categories = [
        { key: "projectSettings", label: "Project"   },   // +11188372/+11188392
        { key: "userSettings",    label: "User"       },   // +11188412/+11188429
        { key: "localSettings",   label: "Local"      },   // +11188446/+11188464
        { key: "flagSettings",    label: "Flag"       },   // +11188499
        { key: "policySettings",  label: "Policy"     },   // +11188535
        { key: "plugin",          label: "Plugin"     },   // +11188554/+11188565
        { key: "built-in",        label: "Built-in"   },   // +11188584/+11188597
    ]

    for each category in categories:
        if showAll OR category.visible:
            segments.push(buildSegment(category, usagePayload))

    // Special named bands always shown:
    //   "Free space"          (+11187423)
    //   "Autocompact buffer"  (+11187446)
    //   "Messages"            (+9982493)
    //   "System prompt"       (+9981468)
    //   "Memory files"        (+9981929)
    //   "MCP tools"           (+9981611)
    //   "System tools"        (+9981547)
    //   "Skills"              (+9981991)
    //   "Custom agents"       (+9981862)

    return segments
```

Analysis basis: CC v2.1.158 bundle.js:+11187347 (`HK`/`wK` context-window helpers), +11187388, +11187706

---

### Percentage Formatter (`st`)

A small helper rounds and formats the usage percentage for display.

```
function formatUsagePercent(rawFraction):
    pct = Math.round(rawFraction * 100)    // +210034
    if pct < 20:
        label = "< 20"                     // +210014
    else:
        label = String(pct) + ".0"         // +209976
    return label
```

Threshold for highlighting: **80%** (bundle.js:+11189726). Segments at or above this threshold receive an alert color in the grid.

Analysis basis: CC v2.1.158 bundle.js:+210034, +210005, +210014, +11189726

---

### JSX Renderer (`qsH` / `bU`)

The React element tree is constructed via two helpers:

- **`qsH`** — subscribes to the `"data"` event on the control-response stream (`+7832300`), converts the binary/string payload to a React-renderable form via `toString()` (`+7832332`), then delegates to `bU`.
- **`bU`** — calls `NJ_` which wraps `qsq.createElement` (`+3773499`) and `v4H` for color/style application, passing `showAll` and the formatted segment list.

```
function renderContextGrid(stream, showAll):
    stream.on("data", (chunk) => {                   // +7832295
        text = chunk.toString()                      // +7832332
        element = createElement(ContextGrid, {
            segments : parseSegments(text),
            showAll  : showAll,
            threshold: 80,                           // +11189726
        })
        return element
    })
```

Analysis basis: CC v2.1.158 bundle.js:+11189410, +7832295, +7832332, +7832362

---

### Auto-compact Boundary Marker (`HO` / `RE8`)

The grid annotates the position of the auto-compact boundary using the `"compact_boundary"` sentinel.

```
function locateCompactBoundary(messageList):
    boundary = messageList.find(
        msg => msg.type == "compact_boundary"        // +10494110
    )
    if boundary:
        return boundary.slice(...)                   // +10494263
    return null
```

Analysis basis: CC v2.1.158 bundle.js:+11189246 (`EsL`/`HO`), +10494110 (`"compact_boundary"`)

---

### Context Window Size Resolver (`xl` / `BX1` / `rc_`)

`xl` determines the effective context-window size for the current model:

```
function resolveContextWindow(modelId, settings):
    // Check env override first
    envVal = process.env["CLAUDE_CODE_AUTO_COMPACT_WINDOW"]  // +9968050
    if envVal is set and valid integer:
        return clamp(envVal, minWindow, maxWindow)

    // Otherwise select by model limits (literals):
    //   1 000 000 tokens  (+2927540)
    //   128 000 tokens    (+2928191)
    //    64 000 tokens    (+2928183)
    //    32 000 tokens    (+2928279)

    window = lookupModelContextWindow(modelId)
    return Math.max(minAllowed, Math.min(maxAllowed, window))  // +9968168/+9968208
```

Analysis basis: CC v2.1.158 bundle.js:+9968050, +9967973 (`xl`), +9967793 (`BX1`)

---

### Full Context Assembly (`MZ8`)

`MZ8` is the top-level async function that assembles every numbered segment fed into the grid. Its call graph reaches:

| Sub-function | Role |
|---|---|
| `RZ` / `se` / `bQ` | System-prompt assembly |
| `xT` + sub-functions (`jP5`, `WY6`, `TP5`, etc.) | Per-segment context assemblers (environment, memory, tools, instructions) |
| `$uL` | Built-in system-prompt segment collector |
| `OuL` | MCP-tool segment collector |
| `zuL` | Background-session / daemon segment collector |
| `wuL` | Message-history segment collector |
| `juL` | Per-message token analyzer |
| `YuL` | Active-context window calculator |
| `WuL` | Token-count aggregator producing final grid data |
| `DuL` | Deferred-tool segment collector |
| `hAH` | Auto-compact window size helper |

Analysis basis: CC v2.1.158 bundle.js:+9980510 (`MZ8`), call graph entries throughout

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_amber_creek` (+3377806); `tengu_pewter_brook` (+3377714); `tengu_marlin_porch` (+3744418); `tengu_amber_redwood2` (+9967861); `tengu_amber_redwood3` (+9967746); `tengu_sparrow_ledger` (+13098417); `tengu_chair_sermon` (+10457605); `tengu_agent_memory_loaded` (+9354593); `tengu_memdir_loaded` (+3293542); `tengu_moth_copse` (+3297778); `tengu_scratch` (+12945747) |
| Control request | Emits `get_context_usage` control-request over the thin-client bridge transport; no side-effects on session state |
| appState changes | None — read-only inspection of current context state |
| Sound | None detected in depth-2 traversal |
| Hook registration | `q9` calls `qOA.register` (+58858) for a progress/timeout hook inside the file-write subsystem; unrelated to `/context` display path |
| React rendering | Returns a JSX element; rendered inline in the Claude Code terminal UI |

---

## Version History

| Version | Change |
|---|---|
| v2.1.158 | Initial analysis |

---

## Common Mistakes

1. **Forgetting the `[all]` argument**: Without `all`, only the top-level summary grid is shown. Pass `/context all` to see every labeled segment (Project, User, Local, Flag, Policy, Plugin, Built-in, Skills, Custom agents).
2. **Expecting live-update**: `/context` is a one-shot snapshot; it does not subscribe to ongoing context changes. Re-run the command to refresh.
3. **Misreading the 80% highlight**: The red/alert color fires at ≥ 80% fill, not at 100%. Segments above this threshold warrant immediate attention to avoid triggering auto-compact.
4. **Running in a context where `onGetContextUsage` is not registered**: In headless or SDK-embedded contexts the bridge will respond with an error (`"get_context_usage is not supported in this context"`); the grid will render empty.
5. **Confusing token counts with message counts**: The grid shows *token* consumption per band, not the number of messages. The "Messages" band can be small even when many messages are present if they are short.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `VsL` | Main handler (AsyncFunction) for `/context` command |
| `Aq` | Context-window state reader / feature-flag accessor |
| `B$H` | Feature-set membership check |
| `ND_` | Terminal color-support probe |
| `y1` | Color capability string normalizer ("no"/"off") |
| `CH` | Color capability string normalizer ("yes"/"on") |
| `mr` | Fullscreen-mode detector |
| `W77` | iTerm/tmux control-mode detector |
| `P77` | Terminal prefix checker (`screen`, `tmux`) |
| `N` | Logger / shell-command executor |
| `lCK` | Debug-level logger |
| `LOA` | Log-level helpers |
| `RH` | JSON serializer wrapper |
| `v4` | Path basename extractor |
| `pYA` | Character map builder |
| `EuH` | Output writer helper |
| `NYA` | Stream write wrapper |
| `rCK` | File-write / conversation-log manager |
| `rxH` | Async queue / throttle utility |
| `M$H` | Log-file path builder |
| `KK6` | File I/O utility |
| `lYA` | Log-path joiner |
| `cYA` | Log-file rotation helper |
| `iCK` | Log-append writer |
| `q9` | Hook/progress registrar |
| `vD_` | Platform/OS detector (windows check) |
| `B_` | Settings loader |
| `Cp` | Settings orchestrator |
| `DZ` | Settings de-serializer |
| `Z9` | Memory-usage sampler |
| `va8` | Settings load executor |
| `$Q` | Settings sub-field extractor |
| `G77` | Fullscreen mode initializer |
| `G6` | App-state getter |
| `sz6` | State subscription helper |
| `tz6` | State change notifier |
| `Ex` | State equality checker |
| `q_8` | Deduplicated state-update emitter |
| `S6` | App-state setter |
| `V$` | Session-ID / context-key builder |
| `f0H` | Context-key formatter |
| `qsH` | Control-response stream subscriber |
| `bU` | JSX element factory for context grid |
| `NJ_` | React createElement wrapper |
| `v4H` | Grid color/style applicator |
| `AcH` | Segment style resolver |
| `xN6` | Context-grid data builder (filter/find segments) |
| `HK` | Context-window size helper |
| `wK` | Token-count formatter |
| `sCK` | Locale number formatter (en-US compact) |
| `ppH` | Grid row renderer |
| `st` | Percentage formatter (Math.round + "< 20" label) |
| `EH` | String coercion helper |
| `EsL` | Compact-boundary locator |
| `HO` | Message-list boundary finder |
| `RE8` | Boundary type extractor |
| `Vj` | Boundary position calculator |
| `MZ8` | Full context-assembly top-level async function |
| `RZ` | System-prompt assembler |
| `se` | Prompt section builder |
| `KN` | Prompt key normalizer |
| `G9H` | Prompt section header builder |
| `bQ` | System-prompt text parser |
| `cG` | Provider-type resolver |
| `iM` | First-party provider checker |
| `w5` | Provider-variant resolver |
| `WA` | Provider string normalizer |
| `UN` | Provider display-name builder |
| `VT` | Auto-compact enabled checker |
| `Q4` | Legacy global config reader |
| `qV` | Config set membership helper |
| `y8` | Settings + config aggregator |
| `xl` | Context-window size resolver |
| `f9` | Model-ID normalizer / alias expander |
| `Hr6` | Object-entries iterator helper |
| `fw` | Model-ID lowercase normalizer |
| `mp8` | Model metadata accessor |
| `tw` | Model-name replacer |
| `XV` | Context-window lookup by model |
| `V0` | Default context-window size provider |
| `ap` | Claude-3 family context-window selector |
| `te` | Claude-3 family limit helper |
| `BH8` | Extended context-window selector |
| `M0` | Minimum context-window constant |
| `J8H` | Env-var integer parser |
| `BX1` | Context-window clamp/selector |
| `R_` | Settings value reader |
| `rc_` | Auto-compact window string parser |
| `xT` | Per-segment context assembler orchestrator |
| `m9A` | Model display-name builder |
| `h6` | Async-storage context accessor |
| `iB6` | Async-local-storage getter |
| `O_` | Null-coalescing helper |
| `GT8` | Tool-list flattener |
| `qv` | Conversation-ID accessor |
| `_P5` | Code-style instruction injector |
| `AP5` | Code-style prompt builder |
| `Ya6` | Task-continuity segment builder |
| `qP5` | Task-continuity prompt accessor |
| `F9A` | Instruction block assembler |
| `SP5` | Secondary instruction assembler |
| `jP5` | SDK/tool-type segment builder |
| `Ng` | Tool-availability checker |
| `uX` | SDK-type identifier |
| `wP5` | SDK-specific prompt builder |
| `vV_` | Feature-flag segment injector |
| `KE` | Experiment/feature flag reader |
| `DL` | Deferred-tool listing helper |
| `CF` | Session-specific guidance builder |
| `$F` | Flat-map content helper |
| `WY6` | Memory-file segment loader |
| `Y4` | Memory-file parser |
| `f4H` | Memory directory creator |
| `kr` | Memory-file stat checker |
| `hH` | Memory-file read helper |
| `zw` | Memory-dir state setter |
| `Egq` | Memory-path joiner |
| `Zgq` | Memory auto-loader |
| `Tgq` | Team-memory auto-loader |
| `uY_` | Memory-prompt builder |
| `d` | Filesystem stat/read helper |
| `ZP5` | Environment-info (simple) assembler |
| `sw` | Shell/OS environment probe |
| `p9A` | Shell display-name builder |
| `TP5` | Environment-info (static) assembler |
| `B9A` | OS version/type collector |
| `HM` | Home-directory accessor |
| `U9A` | Shell detection logic |
| `fP5` | Language-locale segment builder |
| `MP5` | Output-style segment builder |
| `VP5` | Background-session segment builder |
| `Jm_` | Worktree detector |
| `vP5` | Scratchpad segment builder |
| `RqH` | Scratchpad state reader |
| `Q2H` | Scratchpad path joiner |
| `IP5` | Brief-mode segment builder |
| `hP5` | Focus segment builder |
| `PP5` | Reproduce-verify-workflow segment builder |
| `LP5` | Heron-brook segment builder |
| `EI9` | MCP-instruction segment builder |
| `nMH` | MCP server config reader |
| `hp8` | MCP instruction cache |
| `XP5` | Context-management segment builder |
| `$P5` | Thinking-reminder segment builder |
| `OP5` | System section builder |
| `KP5` | Auto-compact system prompt injector |
| `zP5` | Verified-vs-assumed segment builder |
| `YP5` | Doing-tasks segment builder |
| `DP5` | Using-tools segment builder |
| `x0` | CLI/remote context injector |
| `JP5` | Session-guidance segment builder |
| `Rgq` | Memory-prompt loader (combined) |
| `Sgq` | Team-memory enablement checker |
| `UzH` | Permissions segment builder |
| `PV` | Permission-mode resolver |
| `u5` | Permission label helper |
| `zm` | Agent-memory loader |
| `EK` | Memory-dir existence checker |
| `KC` | Memory-file metadata extractor |
| `JZ` | Memory JSON parser |
| `d_` | Memory content cleaner |
| `Z_` | Module initializer / ESM interop |
| `cR6` | CommonJS require binding |
| `M` | Plugin path resolver |
| `nS6` | Plugin staging-path resolver |
| `XD` | System-prompt override accessor |
| `$uL` | Built-in system-prompt segment collector |
| `MuL` | Prompt-section splitter |
| `OZ8` | Parallel segment assembler |
| `EP5` | Environment + MCP combined segment builder |
| `Cgq` | Combined memory segment builder |
| `gAK` | Segment prefix stripper |
| `A66` | Token-count accumulator |
| `bSH` | Token-usage breakdown builder |
| `SH` | Segment error logger |
| `QX1` | Token-count request builder |
| `OuL` | MCP-tool token-usage collector |
| `TJ6` | Tool-list filter |
| `zuL` | Background/daemon segment collector |
| `$PH` | Per-session token aggregator |
| `zZ8` | Tool-definition token builder |
| `z` | Daemon-session list accessor |
| `bH` | Session-type checker |
| `Sy` | Session-segment builder |
| `Fm` | Daemon process race helper |
| `T` | Active-transport accessor |
| `Xv6` | Transport type checker |
| `Ox8` | Transport state accessor |
| `X` | Socket/pipe message handler |
| `J` | Message queue |
| `w` | Daemon worker manager |
| `Qf` | Socket end-handler |
| `FB5` | Full daemon frame-buffer supervisor |
| `wuL` | Message-history token collector |
| `Rf` | Token-count rounding helper |
| `O` | Output stream manager |
| `I8` | Output stream type checker |
| `D` | Daemon session disposer |
| `$` | Session store |
| `By8` | Low-memory event emitter |
| `wfA` | Spare-worker spawner |
| `Iz` | Session-ID validator |
| `J8` | File-write sync helper |
| `juL` | Per-message token analyzer |
| `YuL` | Active context-window calculator |
| `RV_` | Active-context tool checker |
| `b8H` | Tool-availability filter |
| `gX1` | Context-window entry accessor |
| `ZK` | Context-window cache getter/setter |
| `WuL` | Token-count final aggregator |
| `JuL` | Tool-use token accumulator |
| `XuL` | Tool-result token accumulator |
| `PuL` | Attachment token accumulator |
| `ET` | Message-history assembler / system-reminder injector |
| `XQL` | Message reorder helper |
| `ni_` | Non-injection message filter |
| `EQL` | Empty-message pruner |
| `ZQL` | Typed-content block builder |
| `VQL` | Content-type presence checker |
| `h` | Rate-limit / blur-focus tracker |
| `kE8` | Tool-use presence checker |
| `uQL` | UUID generator for tool uses |
| `E8` | Tool-use block builder |
| `BT` | Tool-result block builder |
| `dg_` | Deferred-tool delta injector |
| `yE8` | Tool-use/result pair linker |
| `yI` | Standard output-style injector |
| `si_` | Tool-references remover (search not enabled) |
| `PQL` | Tool-reference pruner |
| `E` | Event emitter / content accumulator |
| `V` | Version/variant accessor |
| `WQL` | Whitespace-only assistant message detector |
| `xQL` | MCP-tool prefix checker |
| `y4` | Message metadata accessor |
| `EZ1` | Empty-content fixer |
| `NQL` | Non-text-block filter |
| `qZ1` | Message content partitioner |
| `Dl_` | Full message-list assembler / diagnostics injector |
| `mQL` | Tool-reference text builder |
| `G` | Keyboard-event handler (remote control) |
| `vQL` | Version-qualified message linker |
| `EZ6` | Orphaned-thinking-block filter |
| `cQL` | Trailing-thinking-block filter |
| `ZZ6` | Whitespace-only assistant filter |
| `lQL` | Empty-content assistant filter |
| `IQL` | Tool-result sequence validator |
| `AZ1` | Assistant-message aggregator |
| `KZ1` | Tool-use tail appender |
| `TQL` | System-reminder injector |
| `DuL` | Deferred-tool segment collector |
| `CV_` | Deferred-tool availability checker |
| `lG` | Language/locale segment builder |
| `_1` | Locale string normalizer |
| `RV6` | Token-count rate tracker |
| `Rc_` | Token-count rate calculator |
| `F_` | Error string coercion helper |
| `hAH` | Auto-compact window size helper |
| `a7H` | Model max-output-tokens resolver |
| `mzH` | Context-window capper |
| `HH` | Voice/recording session manager |
| `Q` | Remote-file I/O handler |
| `UN6` | Remote readFile helper |
| `wh1` | Remote unlink helper |
| `a` | Permission-gate wrapper |
| `c` | Permission-state checker |
| `s78` | Usage/quota checker |
| `X8H` | Quota-flag reader |
| `pc` | Context-percentage calculator |
| `nH` | MCP bridge-repl v2 session manager |
| `LH` | MCP connection handler |
| `AH` | MCP active-request tracker |
| `L8` | MCP debug logger |
| `oV6` | MCP tool-call dispatcher |
| `TEK` | MCP elicitation title extractor |
| `aV6` | MCP elicitation response sender |
| `jl` | MCP notification sender |
| `y` | MCP transient-message queue |
| `I6` | Async-queue promise builder |
| `w8` | Structured file logger |
| `sq4` | Log-file path builder |
| `B` | MCP server filter |
| `VH` | Plugin manifest reader |
| `dH` | Orphaned-permission tracker |
| `k6` | MCP batch writer |
| `b6` | MCP message renderer |
| `u6` | MCP message ring buffer |
| `uH` | MCP write-messages helper |
| `O6` | MCP session-close handler |
| `zH` | MCP stream ender |
| `_H` | MCP server state manager |
| `Go1` | Bridge-repl message ingress handler |
| `IM8` | Bridge message type checker |
| `p6` | JSON.parse wrapper |
| `w$5` | Bridge message type map |
| `j$5` | Bridge control-response router |
| `a8A` | Bridge UUID validator |
| `To1` | Bridge control-request processor |
| `Y` | MCP server config updater |
| `j` | Worker kill helper |
| `I` | Away-summary generator |
| `E6` | Plugin-server bridge handler |
| `mq` | Plugin stream descriptor |
| `J4` | Server-stream descriptor |
| `n9` | Named-server stream list |
| `Nq` | Anonymous-server stream list |
| `BA` | Fatal CLI error reporter |
| `wH` | Active-worker list |
| `WH` | Worker-state notifier |
| `IH` | MCP message store |
| `rH` | Headless managed-settings waiter |
| `kpH` | Structured log writer |
| `Q38` | Settings-ready checker |
| `Qc` | MCP server reconciler |
| `A26` | MCP server activator |
| `r8H` | MCP server config processor |
| `gc` | MCP config entry iterator |
| `y$8` | MCP color/health indicator builder |
| `_26` | MCP server state tracker |
| `zEK` | Headless plugin installer |
| `fB` | Color formatter |
| `yT8` | Marketplace reconciler |
| `eXH` | Install-cache clearer |
| `F0` | Plugin feature-flag checker |
| `tw9` | Plugin zip-cache validator |
| `ew9` | Plugin zip-cache error builder |
| `Xm` | Plugin manifest parser |
| `Cb8` | Plugin install tracker |
| `Aj9` | Marketplace seed registrar |
| `$EK` | Plugin diff applier |
| `WS8` | Plugin install/update executor |
| `v6` | MCP server-list builder |
| `$$H` | Object.assign shim |
| `mH` | MCP server-map merger |
| `aT` | Round-trip-time calculator |
| `BH` | Token-count cache |
| `mU_` | Token-count cache value builder |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.