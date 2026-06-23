---
type: feature-spec
feature: "context"
cc_version: "2.1.186"
updated: "2026-06-23"
tags: ["context", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.186 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/context`

> Analysis basis: CC v2.1.186 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.186

---

## Overview

`/context` visualizes the current context window utilization as a colored grid, displaying token consumption across multiple categories such as the system prompt, tools, memory files, and conversation messages. It dispatches a control request to gather live usage data and renders the result as a JSX component in the terminal UI. The command also accepts an optional `all` argument to reveal additional detail about every registered context segment.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `context` |
| description | `Visualize current context usage as a colored grid` |
| argumentHint | `[all]` |
| thinClientDispatch | `control-request` |
| module_id | `agl` |
| load_inline | `true` |
| loc_byte | `11578813` |
| loc_byte_end | `11579039` |
| loc_line | `7235` |
| arbor_handler.name | `gtf` |
| arbor_handler.fqn | `claude-2.1.186::gtf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.186 bundle.js:+11578813

---

## Input Branching

The command has three distinct execution paths based on connectivity and argument presence, so a flowchart is used.

```mermaid
flowchart TD
    A["/context [arg] invoked"] --> B{Control channel available?}
    B -- No --> C["Return error message:\n'Context usage isn't available\nover this remote connection'"]
    B -- Yes --> D{arg.trim() === 'all'?}
    D -- Yes --> E["Request full detail mode\n(all segments)"]
    D -- No --> F["Request summary mode\n(default segments only)"]
    E --> G["Send control request:\n'get_context_usage'"]
    F --> G
    G --> H["Receive context data\nfrom agent runtime"]
    H --> I["Build segment list\n(contextSegmentBuilder)"]
    I --> J["Compute threshold:\n< 20% → warning tier,\n< 80% → normal,\n≥ 80% → critical"]
    J --> K["Render colored grid\n(contextGrid JSX)"]
    K --> L["Return JSX output\nto terminal UI"]
```

Analysis basis: CC v2.1.186 bundle.js:+11577427, +11577458, +11577511, +11577593, +11577623

---

## Behavioral Spec

### Handler Entry Point — `contextHandler` (`gtf`)

```
async function contextHandler(inputArg, opts):
    trimmedArg = inputArg.trim()

    // Check whether a control channel is reachable
    if not controlChannelAvailable(opts):
        return errorResult(
            "Context usage isn't available over this remote connection"
        )

    // Determine detail level
    showAll = (trimmedArg === "all")

    // Dispatch control request to the running agent
    usageData = await opts.sendControlRequest("get_context_usage")

    // Build the segment breakdown
    segments = buildContextSegments(usageData, showAll)

    // Compute compact-boundary marker position
    compactBoundary = resolveCompactBoundary(usageData)

    // Render threshold-coloured grid
    grid = renderContextGrid(segments, compactBoundary)

    return jsxOutput(grid)
```

Analysis basis: CC v2.1.186 bundle.js:+11577427

### Control Channel Check — `controlChannelGuard` (`nO`)

```
function controlChannelGuard(opts):
    // Examines the connection object for the 'controlChannel' property
    // Returns false when the connection is remote-only (no control plane)
    return opts has property "controlChannel"
```

Analysis basis: CC v2.1.186 bundle.js:+11577481, literal `"controlChannel"` at +11577484

### Segment Builder — `contextSegmentBuilder` (`$Wt`)

The builder assembles an ordered list of named context segments and their token counts. Each segment carries a label, a token count, and a color class.

Known segment labels (from literals):

| Label string | Source key |
|---|---|
| `"System prompt"` | system prompt block |
| `"System tools"` | built-in tool definitions |
| `"MCP tools"` | connected MCP tool schemas |
| `"MCP tools (deferred)"` | deferred MCP schemas |
| `"System tools (deferred)"` | deferred built-in schemas |
| `"Memory files"` | loaded memory file content |
| `"Custom agents"` | registered agent definitions |
| `"Skills"` | invoked skill definitions |
| `"Messages"` | conversation turn content |
| `"Autocompact buffer"` | reserved compaction buffer |
| `"Free space"` | remaining available tokens |

```
function contextSegmentBuilder(usageData, showAll):
    segments = []
    for each knownCategory in SEGMENT_ORDER:
        if not showAll and category.isDetailOnly:
            continue
        tokenCount = usageData[category.key] ?? 0
        segments.push({
            label: category.label,
            tokens: tokenCount,
            colorClass: resolveColorClass(tokenCount, totalTokens)
        })
    return segments
```

Analysis basis: CC v2.1.186 bundle.js:+11575489, +11575530, +11575848, literals at +11576534 through +11576739, +10941870–+10942904

### Grid Renderer — `contextGrid` (`pB` / `O8n`)

```
function renderContextGrid(segments, compactBoundary):
    totalTokens = sum(segment.tokens for segment in segments)
    usedFraction = computeUsedFraction(segments)

    // Assign cell colours
    cells = []
    for each segment in segments:
        fraction = segment.tokens / totalTokens
        color = selectColor(fraction, usedFraction)
        cells.push(coloredCell(color, fraction))

    // Insert compact-boundary marker
    if compactBoundary exists:
        insertMarkerAt(cells, compactBoundary.position)

    // Percentage tiers applied per cell block
    // < 20% remaining  → warning color (literal "< 20" at +220999)
    // ≥ 80% used       → critical color (literal 80 at +11577959)

    return gridComponent(cells, legend(segments))
```

Analysis basis: CC v2.1.186 bundle.js:+11577753, +11577837, +10940719, literal `80` at +11577959, literals `20` at +220990, `"< 20"` at +220999, `10` at +221032

### Compact-Boundary Resolver — `compactBoundaryResolver` (`htf` / `LH`)

```
function compactBoundaryResolver(usageData):
    // Reads the 'compact_boundary' field from usage data
    // Returns a position value used to draw a divider line in the grid
    // Slices the position from the raw usage object
    boundary = usageData["compact_boundary"]
    if boundary is undefined:
        return null
    return boundary
```

Analysis basis: CC v2.1.186 bundle.js:+11577926, +11577389, literal `"compact_boundary"` at +13792565

### Number Formatter — `numberFormatter` (`tl` / `Fre`)

Formats token counts as locale-aware compact strings (e.g. `"12.3k"`).

```
function formatTokenCount(n):
    // Uses "en-US" locale, "compact" notation
    // Appends ".0" when the compact form omits a decimal
    formatted = Intl.NumberFormat("en-US", {notation: "compact"}).format(n)
    if not formatted.includes("."):
        formatted = formatted + ".0"   // literal ".0" at +220960
    return formatted
```

Analysis basis: CC v2.1.186 bundle.js:+220946, literals `"en-US"` at +222972, `"compact"` at +222990, `".0"` at +220960

### Output Response Constructor — `contextResponseRenderer` (`Qlt`)

After the control request resolves, this sub-routine wraps the populated grid into a JSX element and forwards it to the output stream.

```
function contextResponseRenderer(rawData):
    parsed = rawData.toString()
    element = buildContextElement(parsed)   // qW
    return jsx(element)
```

Analysis basis: CC v2.1.186 bundle.js:+11577653, +8170392, +8170429, +8170456

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | No `tengu_*` events are emitted directly by the `/context` handler itself within the depth-2 traversal. Events fired by called subsystems (e.g. `tengu_amber_creek` at +3551256, `tengu_pewter_brook` at +3551164) may fire as part of the context-data assembly pipeline. |
| Hook registration | None directly registered by this command. |
| appState changes | None — read-only display command; no mutations to application state. |
| Control request | Sends `"get_context_usage"` over the control channel (literal at +11577623). |
| Sound | None. |
| Remote guard | When `thinClientDispatch` is `"control-request"` and no control channel exists, the command exits early with the error string (literal at +11577511) before any rendering occurs. |

---

## Version History

| Version | Change |
|---|---|
| v2.1.186 | Initial analysis |

---

## Common Mistakes

1. **Running `/context` over a remote or thin-client connection** — the command requires a live control channel. If Claude Code is connected via a remote transport without the control plane, the command returns `"Context usage isn't available over this remote connection"` immediately.
2. **Expecting `/context` to modify session state** — this is a read-only visualization; it does not compact, truncate, or alter any context.
3. **Omitting the `all` argument and wondering where fine-grained segments are** — deferred tool blocks, custom-agent entries, and skill definitions are only shown when `/context all` is used.
4. **Confusing the percentage tiers** — the `< 20` label in the legend denotes that fewer than 20% of tokens remain (high-utilization warning), not that only 20% are used.
5. **Interpreting the compact-boundary marker as a hard limit** — the divider rendered by the compact-boundary resolver indicates the point at which auto-compaction would activate, not the absolute end of the context window.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `gtf` | Main handler for `/context` (contextHandler) — AsyncFunction |
| `Es` | Context usage data assembler (contextDataAssembler) |
| `G$` | Feature-flag gate check |
| `dx` | Feature-enable check (isEnabled wrapper) |
| `O3r` | OS/terminal type resolver |
| `ot` | String coercion utility |
| `dZ` | Color-support / display detection |
| `Ccd` | Terminal capability detector (iTerm / tmux / screen check) |
| `Icd` | Terminal name prefix checker (startsWith) |
| `o7e` | Tmux control-mode inspector |
| `T` | Logger / trace emitter |
| `Pvc` | Model-name formatter |
| `Lc` | Model alias resolver |
| `SWo` | Model alias map |
| `Fvc` | Conversation-log file writer |
| `wKe` | Batched write flush manager |
| `npe` | Log path resolver |
| `Uvc` | Log append worker |
| `pcr` | Log rotation / rename handler |
| `P3r` | Platform (Windows) detector |
| `Nr` | Settings loader |
| `DG` | Settings load dispatcher |
| `na` | Memory usage sampler |
| `vEr` | Settings-load executor |
| `Z$` | Settings merge aggregator |
| `vcd` | Token-budget tracker |
| `it` | Token-count state accessor |
| `$9` | Token-count sub-calculator |
| `JEn` | Token deduplication guard |
| `wt` | Conversation-message writer |
| `Nu` | Control-channel presence checker |
| `qPe` | Control-channel getter |
| `nO` | Control-channel guard (returns early if absent) |
| `Qlt` | Control-request response renderer |
| `qW` | Context-element builder (JSX) |
| `P5r` | JSX element factory wrapper |
| `kZ` | Context grid layout component |
| `RCe` | Context cell renderer |
| `b5r` | Context legend row renderer |
| `$Wt` | Context segment builder |
| `tl` | Token count formatter (compact locale) |
| `$c` | Intl.NumberFormat wrapper |
| `Kvc` | Number format cache |
| `L7e` | Segment label resolver |
| `Fre` | Percentage formatter (Math.round) |
| `Ae` | String coercion helper |
| `htf` | Compact-boundary resolver dispatcher |
| `LH` | Compact-boundary data extractor |
| `Qqn` | Compact-boundary position calculator |
| `DA` | Compact-boundary raw data accessor |
| `O8n` | Context grid renderer (main render function) |
| `Tk` | Model-state resolver |
| `b9` | Model config getter |
| `ja` | Model alias expander |
| `sb` | Model tier classifier |
| `Di` | Provider-tier checker |
| `zo` | Language-alias normaliser |
| `pB` | Context segment data extractor |
| `So` | Message-content normaliser |
| `vXe` | Settings key reader |
| `YH` | Content type classifier |
| `nA` | Auto-compact window resolver |
| `kii` | Integer parser |
| `TUr` | Compact threshold calculator |
| `Rii` | Token-limit resolver |
| `Hae` | Env-var integer reader |
| `NDd` | Deferred-tool segment builder |
| `EKr` | Memory-file segment builder |
| `yKr` | Token-string parser (k/M suffix) |
| `PDd` | Permission-segment builder |
| `cR` | System-prompt assembly orchestrator |
| `Ot` | Async-local-storage context reader |
| `hrn` | Store getter |
| `gr` | Generic logger |
| `mqn` | Tool-definition token counter |
| `EIe` | Inline-tool builder |
| `IUr` | Pewter-owl tool injector |
| `MLf` | System-prompt segment builder |
| `xLf` | Brief-mode system-prompt builder |
| `DLf` | Irreversible-action reminder injector |
| `PLf` | Oii / confirm-action segment |
| `YDo` | System-prompt section assembler |
| `uxt` | Memory file loader / context injector |
| `qc` | Memory index reader |
| `nie` | Memory directory creator |
| `LW` | File stat checker |
| `Ke` | File-read wrapper |
| `ke` | File-content loader |
| `ASi` | Memory file parallel loader |
| `Zad` | Memory file content reader |
| `cxt` | Memory snippet extractor |
| `lA` | Token-count for memory items |
| `u0` | Memory context injector |
| `fA` | Memory path joiner |
| `NSi` | Team-memory path builder |
| `OSi` | Memory schema validator (team) |
| `PSi` | Memory schema validator (user) |
| `kSi` | Memory instruction builder |
| `LSi` | Memory content formatter |
| `zBr` | Memory schema enforcer |
| `o0f` | Tool-listing segment builder |
| `og` | Tool display-name resolver |
| `KDo` | Tool-token counter |
| `r0f` | Environment info builder |
| `jDo` | OS info collector (version/release/type) |
| `zDo` | Shell info resolver |
| `BLf` | Language-instruction injector |
| `GLf` | Output-style injector |
| `i0f` | Worktree / bg-session info builder |
| `huo` | Nr-backed worktree resolver |
| `p4n` | Scratchpad / tmp builder |
| `l0f` | Brief-mode checker |
| `d0f` | Context-management instruction injector |
| `QLf` | System-reminder template |
| `FLf` | Heron-brook instruction injector |
| `$Lf` | Amber-sextant injector |
| `TXa` | Tool-cache / compute resolver |
| `JLf` | qDo-based injector |
| `qLf` | ULf-backed context builder |
| `VLf` | Verified-vs-assumed tracker |
| `KLf` | YDo-backed segment |
| `zLf` | hv-backed CLI/remote segment |
| `hv` | CLI-vs-remote mode selector |
| `XLf` | Rq-backed tool reference builder |
| `GSi` | Combined context-segment aggregator |
| `BSi` | Base segment set assembler |
| `SIe` | ZM / vFe segment |
| `ZM` | kUr / vFe segment factory |
| `Su` | ydn-backed segment |
| `U4l` | aqn / nA / Uy / lqn combined segment |
| `lqn` | Context-window-size Math.max resolver |
| `D5` | Agent-memory loader |
| `Cc` | Memory-content cache |
| `Hv` | Memory cell data extractor |
| `to` | Module initialiser (EPe/Mor shape) |
| `Prt` | _ae-backed tool-result tracker |
| `_ae` | Tool-result set checker |
| `zKp` | Prompt-component builder (main) |
| `KKp` | Prompt text tokeniser |
| `U8n` | Promise.all prompt assembler |
| `s0f` | Sub-prompt assembler |
| `WSi` | Working-set segment injector |
| `BDo` | Header parser |
| `Jft` | Token count calculator per segment |
| `t3e` | Per-tool token counter |
| `Re` | Error reporter / logger |
| `Hal` | Aggregate token counter |
| `jKp` | Built-in tool token builder |
| `Jse` | ClaudeMd reader |
| `Ql` | ClaudeMd parser (Hl/Ud) |
| `ik` | ClaudeMd post-processor |
| `mOt` | AutoMem filter |
| `YKp` | MCP tool token builder |
| `hxe` | MCP tool token accumulator |
| `F8n` | Per-MCP-tool token counter |
| `u` | Daemon-stop helper |
| `xe` | File-content reader |
| `gU` | Task token accumulator |
| `j6` | Daemon process runner |
| `y` | Session registry |
| `v5e` | Teammate-mailbox message reader |
| `g` | Session timeout manager |
| `QKp` | MCP-prompt token builder |
| `ff` | Math.round wrapper |
| `c` | Background-session registry |
| `bn` | Session entry |
| `p` | Process abort helper |
| `ZKp` | Skill token builder |
| `XKp` | jqr / Ot / gal / hxe combined builder |
| `jqr` | _b / cae / tK combined sub-builder |
| `cae` | Filter / some / A3l sub-check |
| `gal` | rl-backed cache lookup |
| `rl` | Recursive token cache reader |
| `rzp` | Context token map setter |
| `ezp` | De / ff sub-accumulator |
| `tzp` | De / ff / n.get sub-accumulator |
| `nzp` | De / ff sub-accumulator (variant) |
| `qw` | Full context assembly pipeline (main) |
| `Wkf` | Message list builder |
| `V8n` | Message token renderer |
| `N6l` | Message group builder |
| `B6l` | Message append helper |
| `zkf` | Message filter (thinking blocks) |
| `JKp` | MCP-resource token builder |
| `hBe` | cae / _b / tK combined checker |
| `kI` | kI — Zo/yl/So/nBu combined accessor |
| `u6t` | ff / eyo combined |
| `eyo` | Sub-token calculator |
| `ao` | Error string coercer |
| `ree` | Math.min / rge / ZI / pB combined |
| `rge` | yIe / Hae combined resolver |
| `yIe` | Token-ceiling calculator |
| `ne` | Session context array |
| `ee` | Promise.all session resolver |
| `ZW` | Async iterable combiner |
| `H` | Buffer / stream reader |
| `nit` | parseInt wrapper |
| `E` | yUt / N_t stream helper |
| `Oxn` | parseInt stream parser |
| `Y` | MCP update applier |
| `Q3e` | ELe-backed post-processor |
| `q2o` | MCP client entry iterator |
| `te` | h-backed sub-resolver |
| `A` | Math.max / Math.min scaler |
| `_` | N_t / BD / xx / Promise.all pipeline |
| `v` | Session sub-context |
| `C4` | Lr / it context reader |
| `c4i` | l4i / e.slice / FT / qw orchestrator |
| `l4i` | _ae / a4i sub-orchestrator |
| `a4i` | Sub-entry resolver |
| `FT` | Hzp / V8n context format dispatcher |
| `Hzp` | jve / V8n sub-dispatcher |
| `kt` | who-backed token push accumulator |
| `who` | De-backed token counter |
| `de` | Session list filter |
| `ie` | Main session loop / render driver |
| `a7n` | gr / n.some / dh / Da / RLo sub-driver |
| `rv` | Terminal input decoder |
| `z` | Key event handler |
| `dh` | Key dispatch helper |
| `BHe` | Interactive session lister |
| `q` | Scheduled-task / loop dispatcher |
| `zle` | Session resume / load pipeline |
| `we` | YVt / Promise.resolve / Mne / Due scaler |
| `We` | Tombstone / splice helper |
| `vc` | UUID generator |
| `jA` | T5o / b5o helper |
| `Ny` | Directory name helper |
| `Bzt` | m3 / or / DE / gr / Rt / Yer file saver |
| `VY` | Oc-backed viewer |
| `hBn` | zco / jyt sub-helper |
| `sWe` | Oc-backed writer |
| `IEe` | eK / MDe / T / h_ / Zo / Jy / ja / Mg model loader |
| `iat` | Ito-backed init |
| `Vzt` | Session state tracker |
| `Bqe` | o / aFo / ZJl / r / W / Pe / Go / ume / Rp response builder |
| `Gqe` | NBf / Mg / Jer / W / Pe / UBf / Rp / gKe / iG response builder |
| `Ve` | et.exec / st.slice / Error parser |
| `$e` | e-backed accessor |
| `qzt` | Quiet-mode checker |
| `yz` | Cwt / Date.now timestamp helper |
| `Kue` | Oc-backed context reader |
| `Kzt` | hm / Y5 / Ot / process.chdir / kH / WR / A0 / WRe / UK / _E / jJn init |
| `Vue` | Oc / Of / hl.utimes / e.reAppendSessionMetadata file-touch |
| `w` | oj / Date.now / Math.min / L / v / hcc / gcc focus tracker |
| `Xn` | Vt / Re session validator |
| `Vt` | Session presence / filter checker |
| `tn` | Jte / W / Mr / Xm / Go / KQ / OBe tool-name resolver |
| `Jte` | Tool-entry base |
| `Mr` | yH / Ke tool display helper |
| `Xm` | yH / Ke tool alt-display helper |
| `Go` | KVe-backed tool renderer |
| `KQ` | yH / Vg tool key |
| `OBe` | W / Boolean / Pe / Wrt / Mr / o.slice / W4i / Zd / Lr / Grt / Vu / V4i / kl model-refusal handler |
| `jn` | f-backed cleanup helper |
| `wca` | MCP connection orchestrator |
| `zR` | String slice / charCodeAt truncation helper |
| `ln` | MCP debug logger |
| `Qw` | it-backed MCP skill loader |
| `Wc` | MCP error logger |
| `fc` | Filter-and-cache helper |
| `Xo` | MCP output router |
| `Un` | p-backed background-session checker |
| `c9` | dl-backed URL prefix normaliser |
| `dl` | e.replace / e.startsWith / t.replace URL cleaner |
| `G4` | dl / r.startsWith URL prefix checker |
| `vGi` | e.find / Xzr / W / it / F1d / T experiment-gate resolver |
| `F1d` | it-backed gate evaluator |
| `iLn` | Jj-backed injector |
| `Jj` | Auto-inject helper |
| `Qvl` | nLo / JSON.stringify / oge / br / VU / b0 schema normaliser |
| `nLo` | br / mz / ja / Sfe / oge tool-definition normaliser |
| `oge` | it / YDd schema object builder |
| `VU` | oge / XDd / Jsr schema union builder |
| `b0` | br / yo / TTe / P9 schema base |
| `Jgc` | e.find / Xzr / Fjf.has / Js / W / K6 / mBo tool-gate resolver |
| `Js` | cEi / gid.has / C2 / Hid.has / Ki / Sme / Xz / r.includes permission gate |
| `K6` | String-backed tool name formatter |
| `mBo` | Js / Ame / W / K6 / Au / Sme tool metadata builder |
| `he` | Nq / Rt / Boolean / ee.has session checker |
| `Nq` | Rt / Oc session-name resolver |
| `Rt` | GL-backed runtime helper |
| `Oc` | Ai-backed output channel |
| `Te` | ch / Rt / he session-entry builder |
| `ch` | Rt / Oc channel helper |
| `je` | RY / $te / aE / R8e / zP / $e.find / Ate / qn.filter / fc / cXt / brt session-command map |
| `RY` | mP / $te / o.concat / o.sort / aE tool-registry reader |
| `mP` | hv / d.push / o_o / pb / $te / s_o / zc / u.push / J5 / n.has / o.some / fc / sl.isEnabled / o.filter / Irt.has / o.map / c.isEnabled / rC / l.includes tool-availability resolver |
| `$te` | e.filter / j5t tool-entry filter |
| `R8e` | jOe / aE / o.sort / r.sort / X0o.isCoordinatorMode / kMl tool sorter |
| `kMl` | s.trim / e.some / Jw / vMl / ke / e.filter / wVr.has / LMl / V2n / aHf.has / r.has coordinator-role filter |
| `zP` | GL-backed permission validator |
| `Ate` | Tdo / Ido / u.filter / f / bdo / H.set / t.map / hv / d.has / H.get / zm / D.split / U.trim / H.has / E.push / t0 / q1e / L.has / v.push / L.add / Irt.has / p.has / m / y.has / I.push / A.push / rC / v.some / fc / x.push / A.splice permission-grant processor |
| `Tdo` | e.filter / Jw / fc / nwe.has / vVr.has / QPt.has / Ga / y3i.has permission pre-filter |
| `Ido` | zm / t.add / n.add / t0 / r.add / r.has / q1e / t.has / s permission-set accumulator |
| `bdo` | e.includes / zm / t.push / o.split / s.trim permission string parser |
| `d` | W8e / r.write / p$l / i.get / E.stop / i.delete / A.stop / A.updateConfig / A.start / Syc / i.set / I.start / W MCP-server lifecycle manager |
| `zm` | tau / Hk / nau / e.substring / eau tool-name normaliser |
| `t0` | e.split / o.join path joiner |
| `q1e` | u9-backed query resolver |
| `L` | Date.now / w.values / q.shiftGraceClocksForward / k / CVt / q2l / D2e / Re / $.has / q.respawnIfIdleStale / Promise.all / q.retireIfSettled / Wn / e / W / V.retireIfSettled / CXn / it / z.respawnIfIdleStale worker lifecycle sweeper |
| `I` | Math.max / Math.floor / x.preventDefault / A scroll/input handler |
| `qn` | Command filter list |
| `cXt` | Command type classifier |
| `brt` | c3i.get / vxd / c3i.set schema-cache resolver |
| `vxd` | t.validateSchema / t.errorsText / t.compile / r / String JSON-schema validator |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.