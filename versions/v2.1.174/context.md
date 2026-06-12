---
type: feature-spec
feature: "context"
cc_version: "2.1.174"
updated: "2026-06-12"
tags: ["context", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.174 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/context`

> Analysis basis: CC v2.1.174 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.174

---

## Overview

The `/context` command visualizes the current session's context window usage as a colored grid rendered in the terminal. It queries the active control channel for real-time token-usage statistics and, when the optional `all` argument is supplied, additionally reveals detailed per-source breakdowns (system prompt, tools, memory files, MCP tools, messages, etc.). The command is dispatched as a `control-request` and therefore requires a live local control channel; it gracefully degrades with an informational message when invoked over a remote connection that lacks one.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `context` |
| description | `Visualize current context usage as a colored grid` |
| argumentHint | `[all]` |
| thinClientDispatch | `control-request` |
| module_id | `Ttq` |
| load_inline | `true` |
| loc_byte | `11700162` |
| loc_byte_end | `11700388` |
| loc_line | `7540` |
| arbor_handler.name | `BR7` |
| arbor_handler.fqn | `claude-2.1.174::BR7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.174 bundle.js:+11700162

---

## Input Branching

Four distinct execution paths exist (remote-guard, argument normalization, control-request dispatch, JSX render), warranting a Mermaid flowchart.

```mermaid
flowchart TD
    A["/context [args]"] --> B{Is connection type\n'controlChannel'?}
    B -- No --> C["Return message:\n'Context usage isn't available\nover this remote connection'"]
    B -- Yes --> D["Trim and normalize args\n(BR7 → A.trim)"]
    D --> E{arg === 'all'\nor arg.trim() === 'all'?}
    E -- Yes --> F["Set showAll = true\nrequest all context sources"]
    E -- No --> G["Set showAll = false\nrequest summary only"]
    F --> H["Send control-request:\n'get_context_usage' via\nK.sendControlRequest"]
    G --> H
    H --> I["Await response via\nkA6 event listener\n(K.on → L.toString)"]
    I --> J["Render JSX grid\nvia Mu6.createElement\n+ Lu6 (breakdown builder)\n+ UR7 (usage formatter)\n+ Lx8 (token-slot renderer)"]
    J --> K_end["Display colored grid\nin terminal"]
```

Analysis basis: CC v2.1.174 bundle.js:+11698756, +11698762, +11698787, +11698813, +11698840, +11698922, +11698952, +11698982, +11698986

---

## Behavioral Spec

### Handler Entry (`BR7` — AsyncFunction)

```
async function contextCommandHandler(args, appContext):
    # Trim whitespace from raw argument string
    normalizedArg = args.trim()                       # BR7 → A.trim :+11698762

    # Acquire control-channel availability flag
    channelType = resolveControlChannelType(appContext) # BR7 → _L :+11698795
                                                        # _L → yVH :+1129154

    # Guard: remote connections cannot supply context data
    if channelType !== "controlChannel":               # literal :+11698813
        return uiMessage(
            "Context usage isn't available over this remote connection"
        )                                              # literal :+11698840

    # Determine verbosity mode
    showAll = (normalizedArg === "all")                # literal :+11698787

    # Send control request to the local agent
    response = await sendControlRequest(
        appContext,
        "get_context_usage",                          # literal :+11698952
        { all: showAll }
    )                                                  # BR7 → K.sendControlRequest :+11698922

    # Attach response listener
    setupResponseListener(response, onContextData)    # BR7 → kA6 :+11698982

    # Render the JSX grid component
    return createElement(ContextGridComponent, {      # BR7 → Mu6.createElement :+11698986
        breakdown: buildBreakdown(response),          # BR7 → Lu6 :+11699092
        formatUsage: formatUsageFraction,             # BR7 → UR7 :+11699265
        maxWidth: 80,                                 # literal :+11699298
        slotRenderer: tokenSlotRenderer,              # BR7 → Lx8 :+11699315
    })
```

Analysis basis: CC v2.1.174 bundle.js:+11698756

---

### Response Listener Setup (`kA6`)

```
function setupResponseListener(responseStream, callback):
    responseStream.on("data", (chunk) => {            # kA6 → K.on :+8345563
        text = chunk.toString()                       # kA6 → L.toString :+8345600
        uiFragment = renderFragment(text)             # kA6 → QF :+8345627
        attachToRoot(uiFragment)                      # kA6 → XqH.createElement :+8345630
    })
```

Analysis basis: CC v2.1.174 bundle.js:+8345563

---

### Breakdown Builder (`Lu6`)

`Lu6` takes the raw usage response and constructs the per-source breakdown array consumed by the grid renderer.

```
function buildBreakdown(usageData):
    segments = []

    # Filter and locate each known context source
    for source in usageData.filter(isVisible):        # Lu6 → A.filter :+11696859
        entry = usageData.find(matchesSource)         # Lu6 → A.find :+11697177

        # Labeled segment types (literals define display names and source keys):
        # "Free space"         :+11696894
        # "Autocompact buffer" :+11696917
        # "Project"            :+11697863  (key: "projectSettings"  :+11697843)
        # "User"               :+11697900  (key: "userSettings"     :+11697883)
        # "Local"              :+11697935  (key: "localSettings"    :+11697917)
        # "Flag"               :+11697970
        # "Policy"             :+11698006
        # "Plugin"             :+11698036  (key: "plugin"           :+11698025)
        # "Built-in"           :+11698068  (key: "built-in"         :+11698055)
        # "MCP"                :+11698094  (key: "mcp"              :+11698088 area)

        tokenCount = String(entry.tokens)             # Lu6 → String :+11698095
        percentage = computePercentage(entry, total)  # Lu6 → z8H :+11698594
        segments.push({ label, tokenCount, percentage, color })

    segments.push(buildIdLegend(usageData))           # Lu6 → idH :+11698514
    return segments
```

Analysis basis: CC v2.1.174 bundle.js:+11696818, +11696859, +11697177, +11698095, +11698514, +11698594

---

### Percentage Formatter (`z8H`)

```
function computePercentage(entry, total):
    raw = getTokenFraction(entry, total)              # z8H → fK :+216579
    rounded = Math.round(raw * 100)                   # z8H → Math.round :+216582
    # Threshold: < 20% shown as "< 20"               # literal :+216562
    # Threshold: < 10% suppressed                     # literal :+216595 (value 10)
    if rounded < 20:
        return "< 20"
    return formatLocale(rounded, "en-US", "compact")  # literals :+218535, +218553
```

Analysis basis: CC v2.1.174 bundle.js:+216579

---

### Usage Fraction Formatter (`UR7`)

```
function formatUsageFraction(usedTokens, totalTokens):
    # Locate compact-boundary marker
    boundary = locateBoundary(usedTokens)             # UR7 → fz :+11698718
    # fz calls Ju8 which resolves the "compact_boundary" key
    # literal: "compact_boundary"  :+11050985
    fraction = usedTokens / totalTokens
    slicedLabel = buildSliceLabel(fraction)           # fz → H.slice :+11051138
    return slicedLabel
```

Analysis basis: CC v2.1.174 bundle.js:+11698718, +11698718

---

### Token-Slot Grid Renderer (`Lx8`)

`Lx8` is the most complex sub-function. It assembles the colored grid of slots, one slot per token bucket.

```
function tokenSlotRenderer(breakdownSegments, terminalWidth):
    # Resolve auto-compact window setting
    compactWindow = resolveCompactWindow()            # Lx8 → Cr :+10746116
    # Env var: "CLAUDE_CODE_AUTO_COMPACT_WINDOW"     # literal :+10732433

    # Gather full context state
    contextState = gatherContextState()               # Lx8 → uE :+10746026
    # uE calls wl → yz (parses model/provider)
    # uE calls ZX → ZLH (Lq, subscription tier)

    # Build system-prompt slot group
    systemPromptSlots = buildSystemPromptSlots()      # Lx8 → $U :+10746176
    # $U → H.getSystemPrompt :+9841480

    # Build per-category slot groups via parallel resolution
    toolSlots      = await resolveToolSlots()         # Lx8 → PE7 :+10746710
    builtinSlots   = await resolveBuiltinSlots()      # Lx8 → WE7 :+10746759
    mcpSlots       = await resolveMcpSlots()          # Lx8 → GE7 :+10746765
    deferredSlots  = await resolveDeferredSlots()     # Lx8 → ZE7 :+10746780
    attachSlots    = await resolveAttachmentSlots()   # Lx8 → VE7 :+10746795
    templateSlots  = await resolveTemplateSlots()     # Lx8 → TE7 :+10746802
    indexedSlots   = await resolveIndexedSlots()      # Lx8 → IE7 :+10746813
    extraSlots     = await resolveExtraSlots()        # Lx8 → EE7 :+10746831
    await Promise.all([...all slot groups])            # Lx8 → Promise.all :+10746697

    # Labelled section headings (literals used in grid display):
    # "System prompt"          :+10746982
    # "System tools"           :+10747060
    # "MCP tools"              :+10747123
    # "MCP tools (deferred)"   :+10747198
    # "System tools (deferred)":+10747283
    # "Custom agents"          :+10747371
    # "Memory files"           :+10747437
    # "Skills"                 :+10747498
    # "Messages"               :+10748024

    # Compute layout metrics
    totalSlots = Math.max(...slotCounts)              # Lx8 → Math.max :+10747850
    maxSlots   = Math.min(totalSlots, terminalWidth)  # Lx8 → Math.min :+10747861

    # Apply rounding to slot counts
    slotMap = slots.reduce(roundingReducer)            # Lx8 → s.reduce :+10747785
    slotMap = slotMap.map(Math.round)                  # Lx8 → Math.round :+10748440
    slotMap = slotMap.map(Math.floor)                  # Lx8 → Math.floor :+10748602

    # Push rendered row arrays
    rows = []
    for group in segmentedGroups:
        rows.push(buildRow(group, slotMap))            # Lx8 → lH.push :+10748691

    # Filter visible, locate active, slice
    visibleRows = rows.filter(isVisible)               # Lx8 → s.filter :+10748360
    activeRow   = rows.find(isActive)                  # Lx8 → s.find :+10749060

    # Cache computed entries
    cache.set(cacheKey, activeRow)                     # Lx8 → xH.set :+10749522
    return Array.from(cache.entries())                 # Lx8 → Array.from :+10749694
```

Analysis basis: CC v2.1.174 bundle.js:+10746026, +10746116, +10746176, +10746697, +10746710, +10746759, +10746765, +10746780, +10746795, +10746802, +10746813, +10746831

---

### Context State Resolver (`N1`)

`N1` is a shared helper called from multiple sites. It assembles the full runtime context object consumed by the grid.

```
function resolveContextState(appState):
    terminalInfo = detectTerminalEnvironment()        # N1 → y8H :+3506898
    # y8H checks aSf.has for iTerm2/tmux/screen detection
    # Literals: "iTerm.app" :+3506101, "screen" :+3506169, "tmux" :+3506194

    fullscreenMode = resolveFullscreenMode()          # N1 → rv_ :+3506988
    # Literals: "fullscreen" :+3507443, "default" :+3507469

    settingsLayer = loadSettings()                    # N1 → ls :+3507049
    # ls → _F4 → vK9.spawnSync

    notificationState = getNotificationState()        # N1 → N :+3507107

    fullscreenWarnings = []
    if tmuxCCMode:
        fullscreenWarnings.push(
            "fullscreen disabled: tmux -CC (iTerm2 integration mode) detected..."
        )                                             # literal :+3507109
    if windowsSSH:
        fullscreenWarnings.push(
            "fullscreen disabled: Windows over SSH (ConPTY re-rendering) detected..."
        )                                             # literal :+3507295

    agentState = resolveAgentState()                  # N1 → g_ :+3507429
    contextData = resolveContextData()                # N1 → AF4 :+3507491
    # AF4 → w6 (reactive state layer)

    return {
        terminalInfo, fullscreenMode, settingsLayer,
        notificationState, agentState, contextData,
        fullscreenWarnings,
    }
```

Analysis basis: CC v2.1.174 bundle.js:+3506898, +3506988, +3507049, +3507107, +3507429, +3507491

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | No `tengu_*` events are emitted directly from the `/context` command handler (`BR7`) itself. Telemetry events in the call graph originate from shared infrastructure helpers (settings loading, memory dir, bg-session dispatch, etc.) and fire only when those sub-systems are exercised independently. |
| Control channel I/O | Sends a `"get_context_usage"` control request over the local IPC channel (`K.sendControlRequest` at +11698922); attaches a `"data"` event listener on the returned stream (`K.on` at +8345563). |
| Remote-connection guard | When `thinClientDispatch` detects a non-`controlChannel` transport, the command returns immediately with a static string message and performs no I/O. Analysis basis: CC v2.1.174 bundle.js:+11698813, +11698840 |
| JSX render | Calls `Mu6.createElement` (+11698986) to produce a React-style element; no DOM/process side effects. |
| Cache write | `Lx8` writes computed slot-layout entries into a `Map` (`xH.set` at +10749522) for subsequent renders. |
| appState changes | None observed in the depth-2 traversal; the command is read-only with respect to session state. |
| Sound | None. |

---

## Version History

| Version | Change |
|---|---|
| v2.1.174 | Initial analysis |

---

## Common Mistakes

1. **Invoking over a remote/SSH thin-client session** — the command silently returns `"Context usage isn't available over this remote connection"` because no local control channel exists. Use `/context` only in a local terminal or desktop-app session.
2. **Omitting or misspelling the `all` argument** — `/context al` or `/context ALL` (uppercase) will not enable the verbose breakdown; the argument comparison is case-sensitive (literal `"all"` at +11698787). Use exactly `/context all`.
3. **Expecting token counts to sum to 100 %** — segments whose rounded share is below the 20 % threshold are labeled `"< 20"` rather than their exact value, so visible percentages may not add to 100.
4. **Running in a narrow terminal** — the slot grid width is clamped by `Math.min(totalSlots, terminalWidth)` (+10747861); in very narrow terminals some color-coded columns will be dropped or merged.
5. **Confusing `/context` with `/clear`** — `/context` is read-only diagnostic tooling; it does not clear or reset the context window.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `BR7` | Main async handler for the `/context` command (arbor_handler) |
| `N1` | Runtime context-state assembler (terminal, settings, fullscreen, agent) |
| `y8H` | Terminal environment detector (iTerm2 / tmux / screen sniff) |
| `rv_` | Fullscreen mode resolver |
| `ls` | Settings layer loader |
| `_F4` | Settings file reader (calls `vK9.spawnSync`) |
| `HF4` | Terminal type check (startsWith "iTerm.app") |
| `N` | Notification / UI state manager |
| `Z1f` | Notification-state sub-resolver |
| `fvA` | Feature-flag helper |
| `RH` | JSON.stringify wrapper |
| `df` | Text display formatter |
| `UhA` | W1f map helper for display |
| `VgH` | Stream write helper |
| `hhA` | H.write wrapper |
| `h1f` | Disk/file log writer (appendFile, mkdir, rotate) |
| `oFH` | Batched write scheduler (setTimeout / setImmediate) |
| `sfH` | Log-segment joiner |
| `C36` | Directory guard (calls `V8`) |
| `ghA` | Path join helper |
| `Qt8` | Log-file rotation handler |
| `N1f` | Append-file writer with rotation |
| `R9` | Hook registration dispatcher |
| `iv_` | Boolean filter / Windows detection |
| `g_` | Agent-state resolver |
| `uB` | Settings load orchestrator |
| `Kq` | Dedup-set tracker for settings events |
| `H4_` | Per-layer settings loader (policy / flag phases) |
| `xB` | Multi-source settings combiner |
| `AF4` | Context-data loader (delegates to `w6`) |
| `w6` | Reactive state subscription layer |
| `Vm` | State mapper (calls `zm`) |
| `X58` | State subscription de-duper |
| `C6` | Reactive cache updater (Date.now gated) |
| `_L` | Control-channel type resolver |
| `jI` | Secondary channel resolver |
| `K` | Control-request transport object |
| `kA6` | Response-stream event listener setup |
| `QF` | Fragment renderer (UI_ / sI_) |
| `sI_` | createElement wrapper (f$9) |
| `zt` | Composite UI tree builder |
| `q5H` | Sub-tree compositor |
| `Lu6` | Context breakdown builder (per-source segments) |
| `fK` | Token fraction computer |
| `Hf` | Fraction helper (calls `k1f`) |
| `idH` | Legend / ID builder for breakdown |
| `z8H` | Percentage formatter (Math.round, locale) |
| `TH` | String coercion helper |
| `UR7` | Usage-fraction label formatter |
| `fz` | Compact-boundary locator |
| `Ju8` | Boundary key resolver (calls `pJ`) |
| `Lx8` | Token-slot grid renderer (main layout engine) |
| `uE` | Context-state gatherer (model / provider / subscription) |
| `wl` | Model-info loader |
| `OY` | Output-style resolver |
| `fB` | Provider-flag reader |
| `yz` | Model-string parser |
| `ZX` | Subscription-tier resolver |
| `ELH` | Tier-to-L6 mapper |
| `ZLH` | Plan resolver (calls `Lq`) |
| `n_` | L6 display builder |
| `GA` | Gateway / provider switcher |
| `Lq` | Subscription plan resolver (az_ / oz_ / Uw) |
| `Vj6` | String replacement helper |
| `YD` | Model-display name resolver |
| `hL` | Multi-source name builder |
| `y7` | Name fallback via `n_` |
| `zT` | Composite name builder (y7 + hL) |
| `SZ` | Auto-compact state reader |
| `nf` | Context-config reader |
| `rv` | Permission-set builder |
| `J4_` | Async resolver (calls `u3`) |
| `C8` | Combined state reader (ms6 + xB) |
| `Cr` | Compact-window calculator (env / settings / experiment) |
| `A1` | Token-analysis helper (llH + jJ + bM6 + q5) |
| `llH` | g_ + Object.entries combiner |
| `jJ` | String normalizer (toLowerCase / includes / replace) |
| `q5` | Replace-pattern helper |
| `$X` | Entry-set helper (calls `rG`) |
| `fW` | Token-limit resolver ($A9 / EZ_ / OA9) |
| `$A9` | parseInt / isNaN token parser |
| `EZ_` | Extended limit resolver (mFH / $A9 / OA9) |
| `OA9` | Limit-object constructor (NY / sB / uI / e78) |
| `x1H` | Max-output token resolver (parseInt / isNaN / N) |
| `uQq` | Compact-window selector (SZ / R_ / w6 / AfA) |
| `AfA` | Token-string parser (parseFloat / parseInt / Math.round) |
| `IZ` | Full system-prompt assembler (very large; calls 30+ sub-builders) |
| `JJA` | Prompt-body entry resolver |
| `b6` | Store-context reader (calls `eo6`) |
| `eo6` | AsyncLocalStorage.getStore wrapper |
| `j_` | rG-based utility |
| `bx8` | Object.values mapper with context |
| `irH` | Tool-listing builder (ZZ_) |
| `ZZ_` | Tool-entry formatter |
| `A95` | Agent-role text selector |
| `V_H` | Role-text builder (calls `A1`) |
| `_95` | Brief-mode role selector |
| `q95` | Confirmation-policy text builder |
| `K95` | Team-confirmation text builder |
| `GJA` | System-section builder (A1 / L6 / OK / O$ / w6) |
| `OK` | String coercion (String) |
| `u95` | System-section delegator (calls `GJA`) |
| `OQ` | Permission-query helper (calls `g_`) |
| `P95` | Permission-section builder |
| `Y2` | L6 / fa8 helper |
| `X95` | Permission-detail builder (calls `cb`) |
| `cb` | Permission-entry constructor (pG9) |
| `JL` | Join-list helper |
| `dg` | Diagnostic helper (h86 / QCH) |
| `SQ` | Flat-map segment array builder |
| `IW6` | Memory / CLAUDE.md loader (reads memory dirs, team mem, builds prompt) |
| `j4` | Memory-path resolver (WC / dK / L6 / OK / T58 / g_) |
| `EAH` | Directory maker (r6 / _.mkdir / V8 / N / String) |
| `NF` | File-type checker (isFile / isDirectory) |
| `$6` | S56 helper |
| `kH` | File-content reader (c / A6) |
| `l19` | Parallel file-read orchestrator (Promise.allSettled) |
| `vU4` | vJH-based file helper |
| `hW6` | Path splitter and slicer |
| `L99` | Memory-path join builder |
| `f99` | NJH memory formatter |
| `K99` | NJH memory formatter (alt path) |
| `Av_` | NJH memory combiner |
| `h95` | Simple environment-info builder (bw / XJA / SQ) |
| `bw` | n_ / toLowerCase / A1 provider display |
| `XJA` | Extended environment-info builder (A1) |
| `N95` | Full environment block builder (OS, shell, cwd, git) |
| `WJA` | OS info reader (os.version / os.release / os.type) |
| `PJA` | Shell detector (zsh / bash / PowerShell) |
| `y95` | Scratchpad / tmp path builder |
| `nt_` | Worktree state reader (calls `g_`) |
| `k95` | Context-management section builder (HfH / AZH) |
| `HfH` | Brief-mode helper (calls `w6`) |
| `AZH` | Auto-compact path builder (QK.join / dL6 / k6) |
| `R95` | Brief-enabled section builder |
| `x95` | Focus-mode builder (R_ / C8 / JoH / O$) |
| `JoH` | Focus-section renderer (g_ / C6) |
| `T95` | System-tools section builder (L6 / w6 / N) |
| `M95` | Output-style section builder |
| `$95` | Autonomy-append section builder |
| `zCq` | MCP instructions loader |
| `G95` | jJA-based section builder |
| `Y95` | Auto-compact section builder (L95 / SQ) |
| `D95` | Task-doing section builder (w6 / SQ) |
| `j95` | Task delegator (calls `GJA`) |
| `J95` | Tool-use section builder (H.has / hT / SQ / Y2) |
| `hT` | Tool-display helper (vc / OK / L6 / w6) |
| `W95` | Tone/style section builder (calls `SQ`) |
| `P99` | Memory-prompt assembler (X99 / Av_) |
| `X99` | Memory-prompt section builder (j4 / hj / UyH / O$) |
| `OJH` | CLAUDE.md output builder (LN / YL / n_) |
| `LN` | hZ_ / EyH wrapper |
| `YL` | HA8 wrapper |
| `$U` | System-prompt main assembler (Sf / yW / mN / I_ / M / dz / H.getSystemPrompt / c / A6 / $6) |
| `PE7` | Tool-slot builder (Rj / XE7 / oK6 / Object.entries / Promise.all) |
| `XE7` | Tool-entry parser (match / split / trim / slice) |
| `$x8` | Parallel context builders (I95 / W99 / zGK) |
| `I95` | Inner system-prompt builder |
| `W99` | Memory-section assembler |
| `zGK` | Section-key parser (indexOf / slice / startsWith) |
| `oK6` | Token-count executor (jRH / N / TH / SH / pQq) |
| `jRH` | Built-in token counter |
| `SH` | Token-count storage helper (DA / L6 / _q / dbf / Sa.logError) |
| `pQq` | MCP token counter |
| `WE7` | Built-in tool slot resolver (PAH / DE6 / QX / oK6) |
| `PAH` | Boolean / Of / WE filter |
| `DE6` | Tool filter (w6 / H.filter) |
| `GE7` | MCP tool slot resolver (JTH / z.map / G.has / X.add / Promise.all) |
| `JTH` | Tool-message assembler (Ox8 / oK6 / N / L.slice) |
| `Ox8` | Individual tool entry builder |
| `ZE7` | Deferred tool slot resolver |
| `bM` | Math.round token helper |
| `VE7` | Attachment slot resolver (oK6 / _.entries) |
| `TE7` | Template slot resolver (Mb_ / b6 / mQq / JTH) |
| `Mb_` | Template helper (SJ / k1H / _c) |
| `k1H` | Tool-filter helper (H.filter / _.some / AWK) |
| `mQq` | cK-based cache lookup |
| `cK` | Recursive cache getter (Object.hasOwn / V19 / v19 / Wp4) |
| `IE7` | Indexed slot resolver (vE7 / NE7 / hE7 / oK6 / LZ) |
| `vE7` | Indexed entry builder (RH / bM) |
| `NE7` | Nested entry builder (bM / RH / A.get) |
| `hE7` | Hierarchy entry builder (RH / bM) |
| `LZ` | Large message-history analyzer / context-slot compiler |
| `EE7` | Extra slot resolver ($b_ / b6 / mQq / JTH / MW / iC6 / SH / DA) |
| `$b_` | Extra-template helper (k1H / SJ / _c) |
| `MW` | Message-context analyzer (T9 / KW / A1 / _D4) |
| `T9` | Token-type classifier (trim / toLowerCase / KW / Ol / GLH / zT / YD / y7) |
| `iC6` | Token-size categorizer (bM / p9A) |
| `DA` | Error/String coercion pair |
| `$KH` | Max-output-token calculator (Math.min / $MH / SZ / Cr) |
| `$MH` | $JH / x1H sub-resolver |
| `$JH` | Token-limit builder (A1 / LA9 / Math.min) |
| `lH` | Slot-row array builder (qH / Object.keys / Object.entries / boK) |
| `qH` | Row-element renderer (E / AH / x.current / HB6 / OH / C / _H) |
| `AH` | Row-detail renderer (i.trim / D / M / B / F) |
| `boK` | MCP-state reconciler (SX8 / rt / Zg / VF6 / xoK) |
| `xoK` | Full MCP reconciliation loop (very large; manages server lifecycle) |
| `Zg` | Object.entries t1H mapper |
| `eRH` | Cache-hash helper (calls `m2H`) |
| `m2H` | SHA-256 hasher (RH / Array.isArray / Ug9.createHash) |
| `cu` | String normalizer (calls `tK`) |
| `tK` | replace / startsWith / replace chain |
| `DH` | Math.floor / lH.push delegator |
| `lS6` | Filtered-trailing-thinking-block handler |
| `cv7` | Filtered-empty-assistant handler |
| `nS6` | Orphaned-thinking-message filter |
| `Jx8` | Large message-normalizer / serializer (core of LZ) |
| `slq` | mV_ / _ / c / H.filter combiner |
| `k6` | rG-based logging primitive |
| `cH` | Stream-chunk buffer handler (Y6H / cKH / hHH) |
| `hHH` | Stream-chunk assembler (amH / k6 / HZH / BOH) |
| `BOH` | Chunk display renderer (L6 / PWK / Pu / PhH) |
| `M4` | Chunk-event emitter (calls `R9`) |

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.