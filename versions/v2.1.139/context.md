---
type: feature-spec
feature: "context"
cc_version: "2.1.139"
updated: "2026-05-31"
tags: ["context", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.139 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/context`

> Analysis basis: CC v2.1.139 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.139

---

## Overview

`/context` visualizes the current context window usage as a colored grid display, giving the user an at-a-glance breakdown of how the active session's token budget is consumed across system prompt, tool definitions, memory files, conversation messages, and other context categories. The command is dispatched as a control request to the local agent process, which gathers context-usage data and renders a JSX grid component in the terminal.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `context` |
| description | `Visualize current context usage as a colored grid` |
| argumentHint | `[all]` |
| thinClientDispatch | `control-request` |
| module_id | `nAq` |
| load_inline | `true` |
| loc_byte | `10359785` |
| loc_byte_end | `10360011` |
| loc_line | `5727` |
| arbor_handler.name | `xf7` |
| arbor_handler.fqn | `claude-2.1.139::xf7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.139 bundle.js:+10359785

---

## Input Branching

The command accepts an optional `[all]` argument and has several distinct branches (argument trimming, "all" mode toggle, control-request dispatch, grid rendering with multiple category paths). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A([User types /context or /context all]) --> B[Trim input argument]
    B --> C{Argument == "all"?}
    C -- yes --> D[Set showAll = true]
    C -- no --> E[Set showAll = false]
    D & E --> F[Send control-request: get_context_usage]
    F --> G{Response received?}
    G -- no / error --> H[Render error or empty state via JSX component]
    G -- yes --> I[Parse context usage data\nSystem prompt, tools, memory,\nmessages, free space, compact boundary]
    I --> J[Build colored grid segments\nper category]
    J --> K{showAll?}
    K -- yes --> L[Include all categories including\nAutocompact buffer, Project/User/\nLocal/Flag/Policy/Plugin/Built-in segments]
    K -- no --> M[Show summarized view\nclip low-usage categories]
    L & M --> N[Compute percentage usage per segment\nMath.round, locale-format via en-US/compact]
    N --> O{Usage > 80%?}
    O -- yes --> P[Apply warning color]
    O -- no --> Q[Apply normal color]
    P & Q --> R[Render JSX grid with legend\nSystem prompt · System tools ·\nMCP tools · Memory files · Messages\n· Free space · Autocompact buffer etc.]
    R --> S([Display in terminal])
```

Analysis basis: CC v2.1.139 bundle.js:+10358419 (handler `xf7`), +10358450 (`"all"` literal), +10358485 (`sendControlRequest`), +10358515 (`"get_context_usage"`), +10358886 (`80` threshold)

---

## Behavioral Spec

### Handler Entry Point (`xf7`)

```
async function contextCommandHandler(rawInput, appState):
    trimmedInput = rawInput.trim()                  // +10358425
    showAll = (trimmedInput == "all")               // +10358450

    // Resolve compact-boundary from settings
    compactBoundary = getCompactBoundary(appState)  // G$ / Tq7, +10358381

    // Send a control request to the local agent to retrieve context usage
    usageData = await sendControlRequest(           // +10358485
        "get_context_usage"                         // +10358515
    )

    // Set up response listener
    listenForDataEvent(usageData, onDataHandler)    // NdH, +10358545

    // Build the grid React element
    gridElement = createElement(TX6, ...)           // +10358549

    // Determine system context string for display
    systemContextLabel = "system"                   // +10358632

    // Apply usage-coloring threshold: 80%
    if usagePercent > 80:                           // +10358886
        color = warningColor
    else:
        color = normalColor

    // Dispatch state update
    updateAppState(vs, appState)                    // vs / uF9, +10358854

    return gridElement
```

Analysis basis: CC v2.1.139 bundle.js:+10358419

---

### Context Usage Grid Builder (`GX6`)

```
function buildContextGrid(usageData, showAll):
    // Filter to relevant segments
    segments = usageData.filter(...)                // +10356522

    // Locate autocompact buffer entry
    autocompactEntry = usageData.find(...)          // +10356840

    // Define named legend labels:
    //   "Free space"           +10356557
    //   "Autocompact buffer"   +10356580
    //   "Project"              +10357526  (key: "projectSettings"  +10357506)
    //   "User"                 +10357563  (key: "userSettings"     +10357546)
    //   "Local"                +10357598  (key: "localSettings"    +10357580)
    //   "Flag"                 +10357633
    //   "Policy"               +10357669
    //   "Plugin"               +10357699  (key: "plugin"           +10357688)
    //   "Built-in"             +10357731  (key: "built-in"         +10357718)
    //   "MCP"                  +10356 (via literal "MCP"           +1068953)
    //   "Managed"              +1068867

    for each segment in segments:
        pct = Math.round(segment.tokens / total * 100)  // KjH, +10358257
        formattedPct = formatPercent(pct,               // FK/mq, +10356481
                           locale="en-US",              // +204559
                           notation="compact")          // +204577
        // Threshold annotation: "< 20" at 20%          // +202621
        // Grid cell spacing:    padEnd(40, "  ")        // +14334983, +" "x2

        colorCell = applyColor(pct, freeRatio)          // fRH, +10358177
        push gridCell(colorCell, formattedPct, label)

    // Append compact-boundary marker if available
    if compactBoundary:
        addBoundaryMarker("compact_boundary")           // +9845382

    return grid
```

Analysis basis: CC v2.1.139 bundle.js:+10356481

---

### Control Request Response Handler (`NdH`)

```
function setupControlResponseListener(emitter, onResponse):
    emitter.on("data", (rawBuffer) => {             // +7438824, +7438819
        parsed = rawBuffer.toString()               // +7438856
        // Delegate to JSX writer component
        jsxWriter = createWriteableComponent(wu)    // +3621814
        jsxWriter.write(parsed)                     // wu/SAH/n1_, +3621879
        // createElement for terminal output        // ot.createElement, +7438886
    })
```

Analysis basis: CC v2.1.139 bundle.js:+7438819

---

### Compact-Boundary Resolver (`G$` / `Tq7`)

```
function resolveCompactBoundary(appState):
    // Reads the "compact_boundary" key from app settings
    raw = getSettingValue("compact_boundary")       // Tq7/fP, +9845465
    if raw exists:
        return raw.slice(...)                       // +9845535
    return null
```

Analysis basis: CC v2.1.139 bundle.js:+9845382, +9845512

---

### Locale Percent Formatter (`FK` / `mq`)

```
function formatTokenPercent(value):
    // Uses Intl.NumberFormat with locale "en-US", notation "compact"
    // Appends ".0" suffix when fractional part is zero   // +202582
    // Threshold label "< 20" is shown when percent < 20  // +202621, +202612
    formatted = Intl.NumberFormat("en-US", {notation:"compact"}).format(value)
    return formatted
```

Analysis basis: CC v2.1.139 bundle.js:+202568

---

### Settings Loader (supporting call, `Ix` / `vx8`)

```
async function loadSettingsFromDisk(context):
    // Span: "loadSettingsFromDisk_start" .. "loadSettingsFromDisk_end"  // +1185200, +1185254
    emit("settings_load_started")                   // +1182055
    load policySettings                             // +1182181
    load flagSettings                               // +1182557
    emit("settings_load_completed")                 // +1182729
    // Records memory usage via process.memoryUsage  // +205380
```

Analysis basis: CC v2.1.139 bundle.js:+1185171

---

### System Prompt Context Assembler (`g$8` → `Z0`)

The deep call chain under `g$8` assembles the full system context that feeds into token counting. Key sub-routines (depth-2):

| Sub-routine | Role |
|---|---|
| `Z0` (systemContextBuilder) | Orchestrates parallel loading of all context sections |
| `f06` (memoryLoader) | Loads memory files, team memory, CLAUDE.md hierarchy |
| `Jh7` (toolContextBuilder) | Enumerates built-in tools, MCP tools, deferred tools |
| `Th7` (envInfoBuilder) | Gathers OS version, shell, git-worktree info |
| `Eh7` (modelInfoBuilder) | Resolves active model display name and provider |
| `d$8` (perSessionContextBuilder) | Builds per-session system prompt portions |
| `u67` (messageTokenCounter) | Counts tokens across conversation messages |
| `m67` (mcpToolBuilder) | Enumerates MCP tool definitions |
| `p67` (builtinToolBuilder) | Enumerates built-in tool definitions |
| `F67` (fullContextAssembler) | Assembles complete token-usage breakdown |
| `g67` (agentContextBuilder) | Assembles agent-specific context |
| `cG` (conversationNormalizer) | Normalizes conversation message array for token counting |

Analysis basis: CC v2.1.139 bundle.js:+9452521 (`g$8`→`GG`), +12144837 (`Z0`), +9446317 (`u67`), +9447011 (`m67`), +9447466 (`p67`), +9449537 (`F67`), +9805017 (`cG`)

---

### Color-Coding Segments

The grid uses named color keys derived from literals in the bundle:

| Key literal | Segment meaning |
|---|---|
| `"System prompt"` | System prompt tokens (+9453481) |
| `"System tools"` | Built-in tool definitions (+9453560) |
| `"MCP tools"` | MCP server tool definitions (+9453624) |
| `"MCP tools (deferred)"` | Deferred MCP tool definitions (+9453700) |
| `"System tools (deferred)"` | Deferred built-in tools (+9453786) |
| `"Custom agents"` | Custom agent definitions (+9453875) |
| `"Memory files"` | Loaded memory files (+9453942) |
| `"Messages"` | Conversation history (+9454503) |
| `"Skills"` | Skill definitions (+9454004) |
| `"promptBorder"` | Visual border color key (+9453512) |
| `"permission"` | Permission context (+9453906) |
| `"inactive"` | Inactive / below threshold (+9453590) |
| `"warning"` | Warning color (high usage) (+9454028) |
| `"cyan_FOR_SUBAGENTS_ONLY"` | Cyan color reserved for sub-agent display (+9453651) |
| `"purple_FOR_SUBAGENTS_ONLY"` | Purple color reserved for sub-agent display (+9454529) |

Analysis basis: CC v2.1.139 bundle.js:+9453481–+9454529

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_amber_creek` (+3232972), `tengu_pewter_brook` (+3232880), `tengu_marlin_porch` (+3593292), `tengu_amber_redwood2` (+9440962), `tengu_slate_harrier` (+12154142), `tengu_loud_sugary_rock2` (+5176456), `tengu_orchid_mantis_v2` (+12140272), `tengu_orchid_mantis` (+12141121), `tengu_memdir_loaded` (+11989334), `tengu_feature_ok` (+943635), `tengu_moth_copse` (+11994246), `tengu_billiard_aviary` (+3124114), `tengu_coral_fern` (+11993403), `tengu_memdir_disabled` (+11995203), `tengu_herring_clock` (+11995399), `tengu_team_memdir_disabled` (+11995427), `tengu_scratch` (+11999852), `tengu_sparrow_ledger` (+12144705), `tengu_verified_vs_assumed` (+12133501), `tengu_slate_harbor` (+3163029), `tengu_agent_memory_loaded` (+7915893), `tengu_tool_pear` (+12157728), `tengu_fgts` (+12158072) |
| Control request | Sends `"get_context_usage"` control-request to the local agent via `sendControlRequest` (+10358485) |
| thinClientDispatch | `"control-request"` — the command routes through the thin-client control channel, not a regular prompt |
| Hook registration | None detected in depth-2 traversal |
| appState changes | Calls state-update helper (`vs`/`uF9`) to push display state (+10358854); bf6.setState called indirectly (+4351622) |
| Sound | None detected in depth-2 traversal |
| Settings loaded | Settings are loaded from disk as part of context assembly (`loadSettingsFromDisk`, +1185171) |
| Memory files | Memory directory is loaded and checked for team memory during context assembly (`tengu_memdir_loaded`) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.139 | Initial analysis |

---

## Common Mistakes

1. **Omitting the `[all]` argument** when debugging deep context issues — without `all`, low-usage categories (e.g., individual settings layers, deferred tool buckets) may be collapsed or hidden in the summarized view.
2. **Misreading the percentage scale** — values are formatted with `notation:"compact"` (e.g., `"12"` not `"12.0%"`); the `"< 20"` label appears rather than an exact figure when usage is below the 20% threshold (+202621).
3. **Expecting real-time refresh** — `/context` is a point-in-time snapshot sent as a single control request; it does not auto-refresh as new messages are added.
4. **Confusing color keys** — `"cyan_FOR_SUBAGENTS_ONLY"` and `"purple_FOR_SUBAGENTS_ONLY"` are rendered only in sub-agent context views; they will not appear in a normal top-level session.
5. **Assuming the compact-boundary line is always shown** — it only appears when the `"compact_boundary"` setting is active and a value is resolvable from app state (+9845382).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `xf7` | Main async handler for `/context` command (Arbor-resolved) |
| `FA` | Session/agent context orchestrator called by handler |
| `TSH` | Agent type checker (calls `T0K.has`) |
| `r__` | Settings value reader |
| `vq` | Value normalizer (yes/no/on/off strings) |
| `SH` | String conversion / normalization utility |
| `vc` | Terminal capability checker |
| `tvL` | Fullscreen / flicker-detection helper |
| `svL` | Terminal prefix detector (checks `H.startsWith`) |
| `N` | Log / telemetry emitter |
| `y9K` | Nested settings resolver |
| `Xo_` | Settings key helper |
| `yH` | JSON serializer wrapper |
| `LM` | Path-redaction / label helper |
| `os_` | Settings map iterator |
| `QyH` | Write helper (calls `H.write`) |
| `R9K` | Conversation-log / transcript manager |
| `JyH` | Log buffer flush controller |
| `n6H` | Log entry appender |
| `B6` | Path resolver utility |
| `IV8` | Internal writer helper (`w8`) |
| `qt_` | Path join helper |
| `At_` | File rotation helper (stat/rename/unlink) |
| `S9K` | Log file append handler |
| `C9` | Active-session set manager |
| `N46` | Feature flag reader |
| `m_` | Telemetry event emitter |
| `Ix` | Settings load orchestrator |
| `NS` | Settings namespace helper |
| `P1` | Memory usage sampler |
| `vx8` | Disk settings loader (core) |
| `nE6` | Post-load settings finalizer |
| `evL` | Fullscreen render launcher |
| `j6` | React/JSX render helper |
| `L46` | Fullscreen frame builder |
| `M46` | Fullscreen layout helper |
| `Ya` | Display string formatter |
| `Ql6` | Fullscreen state tracker |
| `b6` | Date/time snapshot helper |
| `G3` | Argument parser entry (calls `uJH`) |
| `uJH` | Low-level argument tokenizer |
| `K` | Control-request sender (has `sendControlRequest`) |
| `NdH` | Control-response listener (binds `data` event) |
| `wu` | JSX write dispatcher |
| `n1_` | createElement wrapper for terminal output |
| `SAH` | Terminal string renderer |
| `_pH` | Session render coordinator |
| `GX6` | Context usage grid builder |
| `FK` | Token percentage formatter |
| `mq` | Intl.NumberFormat wrapper |
| `x9K` | Locale format helper |
| `fRH` | Grid cell color selector |
| `KjH` | Per-segment percentage calculator (Math.round) |
| `IH` | String conversion helper |
| `bf7` | Compact-boundary section builder |
| `G$` | Compact-boundary resolver |
| `Tq7` | Setting value accessor for `compact_boundary` |
| `fP` | Setting value extractor |
| `vs` | App state updater |
| `uF9` | setState dispatcher (calls `bf6.setState`) |
| `g$8` | Full system-context assembler (top-level) |
| `GG` | Model/provider context builder |
| `Xo` | Model identifier extractor |
| `lI` | Model list resolver |
| `Po` | Provider-aware model selector |
| `tZ` | Model tier classifier |
| `uM` | Provider type resolver |
| `$M` | First-party model config accessor |
| `eZ` | Extended model config accessor |
| `D0` | AutoCompact settings reader |
| `q7` | AutoCompact config resolver |
| `mT` | AutoCompact state tracker |
| `v8` | AutoCompact version selector |
| `rn` | Context window limit calculator |
| `R1` | Model context-window spec lookup |
| `rm6` | Provider entry enumerator |
| `zw` | Model string normalizer (toLowerCase/includes/replace) |
| `_Z8` | Model alias map |
| `uj` | Model string replacer |
| `iP` | Token limit parser |
| `WG` | Token limit lower-bound helper |
| `gd` | Context limit decision tree |
| `D_H` | Token cap upper-bound helper |
| `Sd6` | Token limit override handler |
| `oY` | Context window override reader |
| `hs` | Token limit validator (parseInt/isNaN) |
| `W_8` | Auto-compact window resolver |
| `T_` | Setting accessor helper |
| `CN_` | Compact-window string parser (parseFloat/parseInt/Math.round) |
| `Z0` | System-context section orchestrator |
| `vB_` | Context section builder entry |
| `C6` | Async context store accessor |
| `ry6` | AsyncLocalStorage store reader |
| `A_` | Context store value extractor |
| `H$8` | Tool definition serializer |
| `lG` | Context section merger |
| `Hh7` | Code-style instruction builder |
| `M__` | Memory instruction formatter |
| `f__` | Memory file formatter |
| `_h7` | Session memory section builder |
| `hB_` | Memory section appender |
| `Rh7` | Memory section router |
| `j$6` | Instruction section builder |
| `Ah7` | Instruction assembler |
| `Jh7` | Tool-context section builder |
| `ap` | Tool availability checker |
| `Cz` | Tool context string formatter |
| `Yh7` | Tool section pre-builder |
| `p36` | Tool section renderer |
| `yV` | Feature-flag checker (disabled check) |
| `C4` | Tool call context helper |
| `wh7` | Tool warning builder |
| `IKH` | Tool diagnostics renderer |
| `tm` | Message content flattener (flatMap/Array.isArray) |
| `f06` | Memory loader (CLAUDE.md + memory files) |
| `IK` | Memory instruction template builder |
| `rKH` | Memory directory initializer (mkdir) |
| `Zi` | Memory file type checker (isFile/isDirectory) |
| `kH` | File feature checker |
| `Sz` | Memory section composer |
| `gc1` | Combined memory prompt builder |
| `lvH` | Memory search instruction builder |
| `Fc1` | Personal memory file loader |
| `Bc1` | Team memory file loader |
| `rU_` | Memory file push helper |
| `Q` | File system stat utility |
| `Kh7` | Session context section placeholder |
| `Eh7` | Model/environment info section builder |
| `cP` | Model display-name resolver |
| `NB_` | Model info formatter |
| `Th7` | Environment info (static) section builder |
| `yB_` | OS info reader (tvH.version/release/type) |
| `lf` | Git worktree detector |
| `kB_` | Shell type detector |
| `yv` | Best-model resolver |
| `Lh7` | Language section builder |
| `fh7` | Output-style section builder |
| `Vh7` | Background-session section builder |
| `Ih7` | Scratchpad section builder |
| `dHH` | Scratchpad content writer |
| `YwH` | Scratchpad path builder |
| `vh7` | FRC section builder |
| `kh7` | Brief-mode section builder (ey7.isBriefEnabled) |
| `Sh7` | Focus-mode section builder |
| `Xh7` | GrowthBook experiment section builder |
| `_A1` | Extra context section loader |
| `A4H` | Extra context entry reader |
| `rE8` | Extra context value resolver |
| `Ph7` | Plan-mode section builder |
| `Mh7` | Model-override section builder |
| `$h7` | Compaction reminder section builder |
| `qh7` | Compaction reminder text builder |
| `Oh7` | Doing-tasks section builder |
| `zh7` | zh7 memory section router |
| `Dh7` | Using-tools section builder |
| `Qj` | Tool section content formatter |
| `jh7` | Tone/style section builder |
| `jEq` | Per-session context builder (entry) |
| `JEq` | Per-session context assembler |
| `hfH` | Away-summary section builder |
| `iT` | Away-summary generator |
| `Q3` | Away-summary formatter |
| `WA` | String assembly helper |
| `dC` | System-prompt retriever (main-thread) |
| `cq` | System-prompt cache reader |
| `Rw` | System-prompt raw extractor |
| `u67` | Message token counter |
| `x67` | Message content extractor (match/split/trim) |
| `d$8` | Per-session context + message builder |
| `Zh7` | Environment section builder (simple) |
| `PEq` | Full per-session context assembler |
| `mZq` | Context prefix parser (indexOf/slice) |
| `HiH` | MCP token counter / tool serializer |
| `jIH` | MCP tool individual serializer |
| `LH` | Token count logger |
| `Io1` | MCP tool full serializer |
| `m67` | MCP tool context builder |
| `sf6` | AutoMem filter helper |
| `p67` | Built-in tool context builder |
| `M` | MCP server manager |
| `WIH` | MCP tool discovery and loading |
| `Niq` | MCP update applier |
| `$` | MCP state accessor |
| `Wa7` | MCP server reconciler |
| `UDH` | Built-in tool serializer |
| `c$8` | Per-tool context builder |
| `z` | Daemon controller |
| `xH` | Daemon background-session checker |
| `NR` | Daemon stop helper |
| `Cb` | Daemon exit coordinator |
| `G` | MCP server availability checker |
| `NP6` | MCP tool capability checker |
| `U08` | MCP tool status helper |
| `P` | IPC message sender |
| `j` | IPC write buffer |
| `w` | Background-session worker manager |
| `kf` | IPC connection handler |
| `ht7` | IPC protocol dispatcher |
| `F67` | Full context assembler (token-usage map builder) |
| `W5` | Token percentage rounder |
| `O` | Background-session output router |
| `x8` | Background output helper |
| `Y` | Background-session lifecycle manager |
| `ul_` | Background-session memory checker |
| `hl_` | Background-session spawner |
| `g67` | Agent context builder |
| `U67` | Custom-agent context builder |
| `m$_` | Agent availability checker |
| `g9H` | Agent filter helper |
| `Vo1` | Agent registry accessor |
| `HK` | Agent cache manager |
| `l67` | Per-message context row builder |
| `Q67` | Message token formatter |
| `d67` | Message detail formatter |
| `c67` | Message summary formatter |
| `cG` | Conversation message normalizer |
| `c17` | Message content block builder |
| `o17` | Content block type router |
| `Sy_` | Content block serializer |
| `a17` | Content block validator |
| `S` | Token-bucket rate limiter |
| `cO8` | Content block filter |
| `Lq7` | Random UUID generator wrapper |
| `$8` | Message ID assigner |
| `r2` | Message reducer helper |
| `fT_` | Message finalization helper |
| `lO8` | Message output block builder |
| `Qm` | Message context formatter |
| `xy_` | Tool-reference remover helper |
| `l17` | Local-command message handler |
| `v` | Session-blurring / away-summary timer |
| `T` | Keyboard input interceptor |
| `V` | Voice session manager |
| `n17` | Thinking-block message handler |
| `ML` | Message length helper |
| `wHq` | Message warning helper |
| `t17` | Message content finalizer |
| `D` | Supervisor write dispatcher |
| `ae1` | Message push helper |
| `iN_` | User-turn content builder (comprehensive) |
| `fq7` | Tool-result formatter |
| `W` | Event debounce manager |
| `s17` | Stream output handler |
| `FY6` | Orphaned-thinking filter |
| `Zq7` | Trailing-thinking filter |
| `BY6` | Whitespace-only assistant filter |
| `Vq7` | Empty-assistant-content fixer |
| `e17` | Message edit appender |
| `oe1` | Message list reducer |
| `se1` | Message tail appender |
| `r17` | Message block validator |
| `B67` | Built-in tool metadata builder |
| `p$_` | Agent-type built-in checker |
| `oU` | Tool display-name resolver |
| `Kq` | Tool name normalizer |
| `HP6` | Tool header builder |
| `jN_` | Tool name formatter |
| `q_` | Error string builder |
| `mqH` | Context window minimum calculator |
| `t9H` | Output token limit resolver |
| `yfH` | Model-specific output token limit |
| `AH` | Voice recording state manager |
| `c` | File watcher / voice session controller |
| `ZX6` | Voice transcript file reader |
| `E9q` | Voice transcript file unlinker |
| `a` | Voice recording finisher |
| `l` | Active request filter |
| `MH` | Voice stream state machine |
| `o8` | Async abort controller |
| `okH` | Language detection helper |
| `Md_` | Workspace file indexer |
| `Xj8` | Voice WebSocket stream manager |
| `hH` | Voice WebSocket connection |
| `vH` | WebSocket render helper |
| `dH` | Audio chunk writer |
| `ZH` | Audio buffer |
| `g` | Permission/hook classifier |
| `Rt6` | Feature usage tracker |
| `n3H` | Feature usage set checker |
| `$OH` | Context/model orchestrator helper |
| `e$6` | Context bootstrapper |
| `A6` | Plugin loader |
| `z9` | Plugin registry |
| `FH` | Plugin connection manager |
| `aK` | Plugin indexer |
| `P9` | Plugin instance list |
| `tA` | Plugin entry builder |
| `Y9` | Terminal output streamer |
| `TH` | Headless session initializer |
| `Z8` | Task tracker |
| `AA` | Terminal character encoder |
| `IA` | CLI error reporter |
| `CP` | Error log writer |
| `wH` | Tool registry |
| `ke` | Tool capability loader |
| `iE` | Tool feature-flag evaluator |
| `pe` | Tool permission filter |
| `YoH` | Tool sort helper |
| `yk` | Tool disabled-flag checker |
| `Gn` | Tool call graph resolver |
| `r0_` | Tool filter helper |
| `qO` | Tool display-string builder |
| `R` | Config file watcher |
| `J` | Worker process killer |
| `X` | MCP client connector |
| `GH` | Plugin-list reader |
| `JZ6` | Tool-list sorter |
| `ys6` | Tool schema validator |
| `ucL` | AJV schema compiler |
| `PH` | Queued-operation dispatcher |
| `Q5` | Queue processor |
| `G3H` | Queue event emitter |
| `p0H` | Queue entry builder |
| `N6` | Headless output writer |
| `bH` | Terminal input handler |
| `s` | Process exit helper |
| `pH` | MCP server health tracker |
| `d2_` | MCP reconnect helper |
| `Eoq` | MCP tool cleanup manager |
| `mH` | MCP server read-only checker |
| `J9` | MCP JWT refresher |
| `QH` | MCP session tracker |
| `Vx` | MCP normalize helper |
| `Ae` | MCP tool name normalizer |
| `nL` | URL/path normalizer |
| `_vH` | Tengu harbor renderer |
| `SR_` | Tengu harbor ledger renderer |
| `nA` | Path include/split helper |
| `GD8` | Tengu harbor ledger entry builder |

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.