---
type: feature-spec
feature: "context"
cc_version: "2.1.187"
updated: "2026-06-24"
tags: ["context", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.187 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/context`

> Analysis basis: CC v2.1.187 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.187

---

## Overview

The `/context` command visualizes the current session's context window utilization as a colored grid displayed in the terminal. It queries context usage data over the active control channel and renders a structured breakdown — including free space, autocompact buffer, system prompt, tools, memory files, and message history — using colored cells. An optional `all` argument requests the full detailed breakdown.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `context` |
| description | `Visualize current context usage as a colored grid` |
| argumentHint | `[all]` |
| thinClientDispatch | `control-request` |
| module_id | `tgl` |
| load_inline | `true` |
| loc_byte | `11465840` |
| loc_byte_end | `11466066` |
| loc_line | `7225` |
| arbor_handler.name | `lef` |
| arbor_handler.fqn | `claude-2.1.187::lef` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.187 bundle.js:+11465840

---

## Input Branching

The command has 4+ distinct paths: no argument vs. `all` argument, control-channel availability check, and JSX rendering vs. plain-text fallback.

```mermaid
flowchart TD
    A["/context invoked"] --> B{argument.trim() === 'all'?}
    B -- yes --> C[detailedMode = true]
    B -- no --> D[detailedMode = false]
    C & D --> E{controlChannel available?}
    E -- no --> F["Return error: 'Context usage isn't available over this remote connection'"]
    E -- yes --> G["sendControlRequest('get_context_usage', {detailed: detailedMode})"]
    G --> H{Response received?}
    H -- error/timeout --> I[Render error JSX via dct/IIo.jsx]
    H -- success --> J[buildContextGrid via YWt]
    J --> K[computePercentages via Bre + Math.round]
    K --> L{terminal supports colors?}
    L -- yes --> M[Render colored grid JSX]
    L -- no --> N[Render plain text fallback]
    M & N --> O[Display context visualization to user]
```

Analysis basis: CC v2.1.187 bundle.js:+11464454, +11464511, +11464538, +11464620, +11464680, +11464684, +11464780

---

## Behavioral Spec

### 1. Handler Entry — `contextCommandHandler` (`lef`)

```
async function contextCommandHandler(args, appState):
    trimmedArg = args.trim()                       // loc: +11464460
    detailedMode = (trimmedArg === "all")          // loc: +11464485

    if not appState.controlChannel:               // loc: +11464511
        return errorMessage("Context usage isn't available over this remote connection")
                                                   // loc: +11464538

    response = await appState.sendControlRequest(
        "get_context_usage",                       // loc: +11464650
        { detailed: detailedMode }
    )                                              // loc: +11464620

    gridData = buildContextGrid(response)          // YWt, loc: +11464780
    formatted = formatAsJSX(gridData, dct, IIo)   // loc: +11464680, +11464684

    return formatted
```

Analysis basis: CC v2.1.187 bundle.js:+11464454

---

### 2. Control Request Dispatch — `sendControlRequest` (`o.sendControlRequest`)

The handler uses `o.sendControlRequest` (the `thinClientDispatch: "control-request"` registration field maps to this path). The request payload carries the string key `"get_context_usage"` and an optional `detailed` flag derived from the `all` argument.

```
function dispatchControlRequest(key, payload):
    channel = getActiveControlChannel()
    paddedMessage = channel.padEnd(padWidth, "  ")   // loc: +17222673, "  " literal +17222694
    return channel.sendControlRequest(key, payload)   // loc: +11464620
```

Analysis basis: CC v2.1.187 bundle.js:+11464620, +17222660

---

### 3. Context Grid Builder — `buildContextGrid` (`YWt`)

`YWt` receives the raw usage object and produces an array of labeled usage segments. It filters relevant entries, locates each named segment, and annotates them with display labels. The segment labels found in the literals are:

| Segment Key | Display Label |
|---|---|
| free space | `"Free space"` (bundle.js:+11462592) |
| autocompact buffer | `"Autocompact buffer"` (bundle.js:+11462615) |
| system (prompt) | `"system"` (bundle.js:+11464757) |
| Project settings | `"Project"` / `"projectSettings"` (+11463561, +11463541) |
| User settings | `"User"` / `"userSettings"` (+11463598, +11463581) |
| Local settings | `"Local"` / `"localSettings"` (+11463633, +11463615) |
| Flag | `"Flag"` (+11463668) |
| Policy | `"Policy"` (+11463704) |
| Plugin | `"Plugin"` / `"plugin"` (+11463734, +11463723) |
| Built-in | `"Built-in"` / `"built-in"` (+11463766, +11463753) |
| MCP | `"MCP"` / `"mcp"` (+11463609, +11463597) |
| Messages | `"Messages"` (+10827554) |
| Memory files | `"Memory files"` (+10827010) |
| System prompt | `"System prompt"` (+10826546) |
| System tools | `"System tools"` (+10826627) |
| MCP tools | `"MCP tools"` (+10826692) |
| Skills | `"Skills"` (+10827072) |
| Custom agents | `"Custom agents"` (+10826943) |

```
function buildContextGrid(usageResponse):
    segments = usageResponse.filter(hasKnownLabel)     // loc: +11462557
    systemEntry = segments.find(isSystemSegment)        // loc: +11462875
    labelled = segments.map(attachDisplayLabel)
    stringified = String(totalTokens)                   // loc: +11463793
    compactBoundary = findCompactBoundary(response)     // loc: +11464212 (G7e)
    percentages = computePercentages(labelled)          // loc: +11464292 (Bre)
    return { segments: labelled, compactBoundary, percentages }
```

Analysis basis: CC v2.1.187 bundle.js:+11462516, +11462557, +11462875

---

### 4. Percentage Computation — `computePercentages` (`Bre`)

```
function computePercentages(segments):
    for each segment in segments:
        segment.pct = Math.round(segment.tokens / totalTokens * 100)  // loc: +221317
        if pct < 20:                                                    // loc: +221297
            displayStr = "< 20"
        else:
            displayStr = toLocaleString(pct, "en-US", "compact")      // loc: +223270, +223288
        segment.displayPct = displayStr + ".0"                         // loc: +221258
    // grid threshold markers at 20 and 10 percent               // loc: +221288, +221330
    return segments
```

Analysis basis: CC v2.1.187 bundle.js:+221317, +221288, +221297

---

### 5. Threshold / Color Logic — `formatPercentage` (`el` → `Gc`)

```
function formatPercentage(value):
    // Uses Gc/aLc for color assignment based on fill ratio
    // Grid cells colored according to usage band:
    //   < 10% remaining → warning color
    //   10–20% remaining → caution color
    //   > 20% remaining → normal color
    return coloredGridCell(value)
```

Analysis basis: CC v2.1.187 bundle.js:+221244, +221191

---

### 6. JSX Renderer — `renderContextDisplay` (`dct`, `IIo.jsx`)

`dct` subscribes to output events (`o.on`), converts response bytes to string (`i.toString`), then delegates to `qW` which calls `xZ` (the context grid renderer). `IIo.jsx` produces the final React/Ink JSX output fragment.

```
function renderContextDisplay(response, appState):
    outputStream = attachOutputListener(response)          // dct, loc: +8184658
    rawString = outputStream.toString()                    // loc: +8184695
    gridJSX = buildGridJSX(rawString, appState)           // qW, loc: +8184722
    return IIo.jsx(gridJSX)                               // loc: +11464684
```

The `xZ` sub-renderer checks model/feature flags (`mx`, `WCe`) before rendering segments, ensuring the grid only shows sections relevant to the active session configuration.

Analysis basis: CC v2.1.187 bundle.js:+8184658, +8184725, +11464684

---

### 7. Autocompact Boundary Marker — `getCompactBoundary` (`MH`)

```
function getCompactBoundary(usageData):
    boundary = locateBoundaryMarker(usageData,
                    key="compact_boundary")              // loc: +13692099
    sliced = usageData.slice(0, boundary)               // MH → e.slice, loc: +13692252
    pageToken = resolvePageToken(boundary)              // pVn → PA, loc: +13692229
    return { boundary, pageToken }
```

The `"compact_boundary"` literal (bundle.js:+13692099) anchors where autocompaction has trimmed the history.

Analysis basis: CC v2.1.187 bundle.js:+11464416, +13692099

---

### 8. Context Utilization Threshold — `contextThreshold` (`i` / `X8n`)

An 80% soft threshold constant is present in the handler scope:

> Context utilization soft threshold: **80%** (bundle.js:+11464986)

When usage exceeds this value the grid highlights the overflow region and may trigger an autocompact recommendation.

Analysis basis: CC v2.1.187 bundle.js:+11464991, +11464986

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | No `tengu_*` events directly attributed to the `/context` handler's `lef` entry point at depth ≤ 2. Indirect calls pass through shared infrastructure that fires `tengu_amber_creek` (+3556463), `tengu_pewter_brook` (+3556371), `tengu_sparrow_ledger` (+13473591), `tengu_silent_harbor` (+13474206) |
| Control channel request | Sends `"get_context_usage"` request over the active control channel; no-ops with an error message when the channel is absent |
| appState changes | Read-only — the command reads usage data but does not mutate any session state |
| Hook registration | `Ei` → `b6o.register` (+67325) is present in the call graph (shared infrastructure); not specific to `/context` |
| Sound | None detected |
| JSX rendering | Produces `local-jsx` output rendered by the Ink/React terminal framework |
| Argument parsing | Checks for literal `"all"` (+11464485) to enable detailed mode; any other argument (or no argument) is treated as summary mode |

---

## Version History

| Version | Change |
|---|---|
| v2.1.187 | Initial analysis |

---

## Common Mistakes

1. **Running over a remote connection without a control channel** — The command silently returns `"Context usage isn't available over this remote connection"` (bundle.js:+11464538) if `thinClientDispatch: "control-request"` cannot resolve a live control channel. This is normal behavior in headless or piped-stdin sessions.
2. **Expecting token counts instead of percentages** — The grid displays percentage bands (with a `< 20` label for low utilization), not raw token counts. Raw totals are computed internally but not necessarily displayed in the default (non-`all`) view.
3. **Misinterpreting the autocompact buffer row** — The `"Autocompact buffer"` segment represents reserved headroom, not consumed tokens. Its size shrinks as context fills.
4. **Using `/context all` expecting agent-internal data** — The `all` argument enables a more detailed breakdown but is still limited to what the control channel exposes; it does not reveal raw system-prompt text.
5. **Assuming color output in non-TTY environments** — Color rendering depends on terminal capability detection. Plain-text fallback is used in piped or non-color terminals.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `lef` | Main async handler for `/context` command (arbor_handler) |
| `bs` | Session/app-state provider called by handler |
| `J$` | Feature-flag / set membership check |
| `mx` | Feature flag query (`ali.isEnabled`) |
| `p9r` | Sub-handler dispatching `nt` (string conversion) |
| `nt` | String normalization utility |
| `fZ` | Terminal/environment detector, delegates to `Kud` |
| `Kud` | Terminal type inspector (`Vud` startsWith check, `g7e` env query, `FTi.spawnSync`) |
| `Vud` | Checks env var prefix for terminal type |
| `g7e` | Environment variable includes/M_r check |
| `T` | Logging/debug output formatter |
| `Xwc` | Log writer pipeline (JP, xcr, I6o) |
| `I6o` | Inner log channel (tCc, nCc) |
| `Me` | JSON.stringify wrapper |
| `wc` | String replacement/truncation utility |
| `c8o` | Maps over `zwc` array for output formatting |
| `dze` | Writer dispatch via `JWo` |
| `JWo` | Raw `e.write` output channel |
| `eLc` | Log file writer orchestrator |
| `FKe` | Async batch flusher (setTimeout/setImmediate/clearTimeout) |
| `dpe` | Path joiner for log entries |
| `Mre` | Log metadata resolver (`cn`) |
| `p8o` | Path join + `kt` helper |
| `Ocr` | File stat/rename/unlink utility |
| `Zwc` | Append-file writer with mkdir |
| `Ei` | Hook registrar (`b6o.register`) |
| `d9r` | Boolean-wrapped dispatcher (`jt`) |
| `Ur` | Settings/state aggregator |
| `PG` | Settings loader orchestrator |
| `qL` | Settings queue processor |
| `ta` | Memory usage tracker (`process.memoryUsage`) |
| `ZEr` | Settings event emitter (Date.now, vn, JYt …) |
| `l2` | App-state field reader (gr, IEt, rar, AEt …) |
| `XYt` | Settings cross-check utility |
| `zud` | Session ID / context dispatcher |
| `it` | Token-usage tracker (V9, hSn, Dt, IW …) |
| `ext` | Token counter input accessor |
| `txt` | Token counter text accessor |
| `V9` | Token sub-counter (`q9`) |
| `hSn` | Dedup set manager (uBr, zIe, lBr, mBr) |
| `Dt` | Date.now-stamped record builder |
| `Nu` | Context-size calculator (`QPe`) |
| `QPe` | Inner context-size computation |
| `oO` | Context-size wrapper (delegates to `Nu`) |
| `dct` | Output-stream event listener and string converter |
| `qW` | Grid JSX builder (Z5r, p6r, xZ) |
| `p6r` | React.createElement wrapper |
| `xZ` | Context grid layout renderer (mx, WCe, e6r) |
| `WCe` | Segment-aware grid cell renderer (fZ, o4r, bs, mx, nt, it) |
| `e6r` | Alternate grid cell path (mx, nt, it) |
| `YWt` | Context-usage segment builder (filter, find, String, G7e, Bre) |
| `el` | Color/percentage lookup (`Gc`) |
| `Gc` | Color band resolver (`aLc`) |
| `aLc` | Underlying color constant table |
| `G7e` | Compact-boundary locator |
| `Bre` | Percentage computer (`el`, `Math.round`) |
| `be` | String coercion helper |
| `aef` | Context-usage formatter entry (`MH`) |
| `MH` | Compact-boundary slicer (`pVn`, `e.slice`) |
| `pVn` | Page-token resolver (`PA`) |
| `PA` | Page-token base implementation |
| `X8n` | Full context preparation pipeline |
| `vk` | Model/plan resolution engine |
| `v9` | Model resolver (S_, lG, Bo, Ba) |
| `S_` | Model string normalizer |
| `lG` | Model alias lookup |
| `Ba` | Plan-upgrade model builder |
| `ab` | Provider/tier builder (xfe, Mfe, Ir, Ao, xi) |
| `xfe` | Provider name normalizer (nt) |
| `Mfe` | Feature-set mapper (xi) |
| `Ir` | Provider identity resolver (nt) |
| `Ao` | Availability checker (ay, H2, Gs) |
| `xi` | Pro-feature gate (jLr, zLr, ay, Gs) |
| `jG` | Model string replacer |
| `n_` | Normalized model name builder (RTe) |
| `RTe` | Model normalization pipeline (Kp, Ir, Vu) |
| `dU` | Model enforcement evaluator (RGs, Ba …) |
| `RGs` | Admin-policy model enforcer |
| `nl` | String normalizer (e.replace) |
| `ix` | Allowlist membership check (`wfe.includes`) |
| `Vu` | Model version resolver (Ir) |
| `joe` | Blocklist check (`A3u.includes`) |
| `gfn` | Model group normalizer (nl, Qo, kwt, ix, Ba) |
| `zNe` | Model tier classifier (nl, ix, Qo, Eo) |
| `Qo` | Model alias normalizer (wH, nl, ix, jNe …) |
| `Eo` | Entitlement checker ($Xe, t_, UEt, Mp) |
| `Lfe` | Model availability resolver (Ir, d3u, uRr) |
| `d3u` | Model set add/u3u helper |
| `uRr` | Array.isArray dispatcher (Dt) |
| `XC` | Cross-check helper (_fn) |
| `_fn` | Validation helper (Kp, Vu) |
| `eC` | Config reader (nt, lc) |
| `lc` | Legacy-config loader (ex, fSr, Tn, Dt) |
| `ex` | Config entry processor (IEt, t.add, pT.filter) |
| `fSr` | Config file resolver (Jm, Coe.resolve) |
| `Tn` | Config chain builder (hsn, l2) |
| `yB` | Auto-compact window resolver |
| `Fy` | Feature-flag resolver (VL) |
| `VL` | Global feature-flag store |
| `oA` | Context window size resolver (Hai, QUr, _ai) |
| `Hai` | Integer parser + NaN check |
| `QUr` | Token window cap resolver (wKe, Hai, _ai) |
| `_ai` | Window display formatter (wH, JG, pU, k_n) |
| `yae` | parseInt + NaN + T helper |
| `oOd` | Context option validator (eC, Number.isInteger …) |
| `Z4i` | Schema array validator (Array.isArray, xi, Object.hasOwn) |
| `yai` | Token option sub-validator (p0) |
| `Eai` | Token option error builder (Dt) |
| `XKr` | Auto-compact threshold resolver (eC, wr, it, YKr) |
| `wr` | Numeric string sanitizer |
| `YKr` | Token unit parser (trim, endsWith, parseFloat, parseInt …) |
| `nOd` | Compact option validator (eC, Object.hasOwn, Z4i) |
| `uR` | Full context assembly pipeline |
| `cPo` | Context prefix builder |
| `Pt` | Async store accessor (xrn, gr) |
| `xrn` | AsyncLocalStorage.getStore + QV |
| `gr` | Global state reader (VL) |
| `wqn` | Context window map builder (Wmt, Pt, T, t.map, Bo) |
| `RIe` | Context injection filter (ZUr) |
| `ZUr` | Injection item validator (wr, eed, Eo, ys, it, p0) |
| `yL` | Language/locale resolver |
| `Nwf` | System-prompt section assembler (Eo, WQ, Pwf, Owf) |
| `WQ` | Brief-mode checker |
| `Pwf` | Brief-mode section builder |
| `Owf` | Brief enablement gate (WQ, aPo.isBriefEnabled, RIe) |
| `Uwf` | Code-style section builder (Ph, lPo) |
| `Fwf` | Irreversibility section builder (bai, lPo) |
| `bai` | Irreversibility guard text builder |
| `x_n` | SDK prefix check (e.startsWith) |
| `XG` | Code normalizer (nl) |
| `YEi` | JSON-schema injector (oxt) |
| `oxt` | Schema freeze/validate (Array.isArray, Object.freeze, Number.isInteger) |
| `fPo` | Tool formatter (Eo, nt, Za, Ph, it) |
| `Za` | String coercion (String) |
| `gLf` | Tool group formatter (fPo) |
| `mq` | Model query helper (Ur) |
| `Zwf` | Session-context injector (oK, oC, Qwf, rbo, Xj, fu, it, hq, Mq) |
| `oK` | Session key accessor |
| `oC` | Session context block builder (nt, Yir) |
| `Qwf` | Queued-command formatter (Xj) |
| `Xj` | Session state formatter (b9i) |
| `fu` | Flag utility |
| `hq` | Hook-context builder (cdt, S6e) |
| `Mq` | Message flattener (e.flatMap, Array.isArray, t.map) |
| `Lxt` | Memory/file system context loader |
| `Kc` | Config path resolver (KR, dl, nt, Za, SSn, Ur) |
| `sie` | Directory creator (Wt, t.mkdir, cn, T, String) |
| `LW` | File type checker (Wt, i.isFile, i.isDirectory, W) |
| `Ve` | Path validator (rKe) |
| `Le` | File reader (W, Pe) |
| `hAi` | Memory file processor (nie, T, be, t.filter, Promise.allSettled …) |
| `ycd` | Memory file single-reader (nie) |
| `f` | Background-process manager |
| `a` | MCP server registry |
| `wxt` | Path trimmer/splitter |
| `dA` | Directory accessor (it) |
| `h0` | Directory traverser (Kc, it) |
| `hA` | Path joiner (Hx.join, xf) |
| `kAi` | Memory index builder (d3r.join, l.push, l.join) |
| `LAi` | Memory listing (lCe) |
| `wAi` | Memory write helper (lCe) |
| `bAi` | Memory content formatter (hA, sAn.join, e.map …) |
| `m` | Background-session process map |
| `h` | Background-session handler (f) |
| `AAi` | Memory metadata builder (xf, hA, lCe) |
| `b3r` | Memory batch reader (lCe) |
| `W` | File system accessor |
| `lLf` | Language/locale assembler (cg, uPo, Mq) |
| `cg` | Language identifier resolver (Ir, e.toLowerCase, Eo) |
| `uPo` | User preferences assembler (Eo) |
| `aLf` | Static environment info assembler (Promise.all, T_, pPo, cg …) |
| `pPo` | OS version/release/type reader (_qe.version, _qe.release, _qe.type) |
| `Hm` | Host metadata reader |
| `dPo` | Dynamic env section builder (e.includes, Yc, f1) |
| `jSn` | Additional env note appender |
| `Vwf` | Vision/capability flag |
| `Kwf` | Keyboard/input capability flag |
| `uLf` | Temp-path assembler (Fuo, $4l.join) |
| `Fuo` | Worktree resolver (Ur) |
| `g4n` | Scratchpad builder (kX, pEe) |
| `kX` | Scratchpad entry (it, gae, oo, e) |
| `pEe` | Scratchpad path builder ($vf, kt) |
| `pLf` | Brief-mode flag resolver (aPo.isBriefEnabled) |
| `hLf` | Focus-mode assembler (wr, Tn, yet, Ph) |
| `yet` | Focus-mode formatter (Ur, Dt) |
| `nLf` | Session label builder (nt, it, T) |
| `Wwf` | Working-directory builder (p0, e.trim, W, it, t.trim) |
| `p0` | Path object builder (Dt, RKt, Object.hasOwn, WEi) |
| `qwf` | Quick-context builder (it, WQ) |
| `uXa` | Attachment cache (PEt, Promise.all, n.compute …) |
| `tLf` | Task-list builder (lPo) |
| `zwf` | Zero-context sentinel |
| `jwf` | Job context builder (Gwf, Mq) |
| `Gwf` | Job metadata assembler |
| `Ywf` | YML context builder (it, Mq) |
| `Xwf` | Cross-format context builder (fPo) |
| `Jwf` | JWT/session context builder (e.has, gv, Mq, oC) |
| `gv` | Session token formatter (r9, Za, nt, it) |
| `eLf` | Empty-list context builder (Mq) |
| `PAi` | Permission context assembler (DAi, b3r) |
| `DAi` | Directory-access builder (Kc, dA, h0, Ph) |
| `xIe` | Extra injection builder (tD, Eu, Ir) |
| `tD` | Tool-declaration builder (oFr, MFe) |
| `Eu` | Error utility (Odn) |
| `B4l` | Budget/token-limit assembler (Sqn, oA, Fy, Aqn) |
| `Aqn` | Max-token bound (Math.max) |
| `U5` | System-prompt assembler (Cc, _v, OD, oo, a, Wh, e.getSystemPrompt …) |
| `Cc` | Prompt cache controller |
| `_v` | Prompt string builder (nt, cw, la) |
| `cw` | Prompt text sanitizer |
| `la` | Prompt metadata loader |
| `oo` | Module initializer (wPe, nsr, aYt.call, lYt.bind, ySc, t9o.set) |
| `lYt` | Module export binder |
| `Wh` | System-prompt section selector |
| `Pe` | File reader wrapper (rKe) |
| `rKe` | Raw file reader |
| `Yrt` | Context-usage post-processor (Eae) |
| `Eae` | Context-usage entry filter (Xrt.has) |
| `FVp` | Full context pipeline (AA, e.filter, UVp, Q8n, lmt …) |
| `UVp` | Token string parser (e.match, e.split, r.trim, n.slice) |
| `Q8n` | Segment group assembler (cLf, OAi, sPo, g4n) |
| `cLf` | Context-list formatter (Promise.all, T_, pPo, Pt, Hm, dPo, jSn, Mq) |
| `OAi` | Ordered-access context builder (DAi, Lxt, xf, sie, LW, Ve, n.trim …) |
| `sPo` | Section path parser (e.indexOf, e.slice, n.startsWith, Error, n.slice) |
| `lmt` | Token-count map builder (c3e, T, be, ke, cal) |
| `c3e` | Token counter (XSo, zSo, ys, hW, hal, vH, uKp, Mp, pW, kf …) |
| `ke` | Token fetch + error handler (fo, nt, Vi, Qru, c7e.push, jJ.logError) |
| `cal` | Cached token counter (XSo, zSo, hal, nt, xre, RI, XC, pW, kf …) |
| `$Vp` | Context-display segment builder (eie, POt, BT, lmt) |
| `eie` | Boolean/Vl/KL validator |
| `Vl` | Display list builder (dl, Ad) |
| `KL` | Kind label resolver |
| `POt` | Permission-object filter (it, e.filter) |
| `BVp` | Background-context pipeline |
| `Txe` | Tool/context entry transformer (Promise.all, e.map, Z8n, lmt, T, i.slice) |
| `Z8n` | Tool definition builder |
| `u` | Daemon stop handler (Le, Re, CU, X6) |
| `Re` | Session reader (W, Pe) |
| `CU` | Session queue manager (q9, Vz.push, u$e, aBr) |
| `X6` | Session terminator (Promise.race, Promise.all, Ome, Vme, Kn, process.exit) |
| `y` | Agent session map |
| `U5e` | Teammate mailbox reader |
| `g` | Timer/setTimeout registry |
| `qVp` | Quick-view context pipeline |
| `ff` | Math.round wrapper |
| `c` | Conversation list |
| `En` | Conversation entry builder |
| `p` | Process exit handler (Kb, process.exit, u.abort) |
| `Kb` | Abort-controller wrapper |
| `VVp` | Verbose-view context pipeline |
| `GVp` | Group-view context pipeline (TVr, Pt, lal, Txe) |
| `TVr` | Tool-view renderer (yb, dae, oK) |
| `dae` | Tool availability checker (e.filter, t.some, b3l) |
| `lal` | Label-list builder (rl) |
| `rl` | Recursive label resolver |
| `YVp` | Year/version pipeline (r.set, KVp, zVp, jVp, lmt, Kw) |
| `KVp` | KV-pair builder (Me, ff) |
| `zVp` | Token display builder (ff, Me, n.get) |
| `jVp` | JSON token builder (Me, ff) |
| `Kw` | Full conversation window assembler |
| `z0f` | Conversation segment pusher |
| `QPo` | Queued-prompt handler |
| `U6l` | Utterance list builder (v6i) |
| `Q0f` | Quota checker (kzr, Rzr, xzr, DLn, Mzr, dot) |
| `U` | Output stream writer (clearTimeout, setTimeout, d.write, Math.round, W, M.unref) |
| `nkf` | Node key filter (sqn, Array.isArray, t.has, n.add) |
| `q` | Queue reference |
| `ZPo` | Zero-path checker (Array.isArray, n.some, t.has) |
| `Z0f` | Zero-offset checker (Array.isArray, t.some) |
| `ekf` | Entry key filter (Array.isArray, t.get, o.startsWith, n.add) |
| `X` | Execution map |
| `Vce` | Version check (t.some) |
| `l` | Session list |
| `F` | Interval handle |
| `N` | Node map |
| `Hkf` | Random UUID header generator (xP.randomUUID) |
| `On` | UUID-stamped record builder (_, xP.randomUUID, y) |
| `Bv` | Block-visibility helper |
| `$fo` | Special format object builder |
| `IQn` | Inline query builder (CQn, G6l, ikf) |
| `MD` | Model descriptor builder (uOt, T, Ir, Eu) |
| `yPo` | YAML-prompt builder (Array.isArray, t.some, t.map, ene) |
| `j0f` | JSON-0-format builder (Array.isArray, n.some, ene, t.has, Ek, n.map, T) |
| `b6l` | Block-list builder (Array.isArray, n.flatMap, t.has) |
| `P` | Parallel-execution list |
| `Y0f` | Year-offset checker (e.some, Array.isArray) |
| `gkf` | Group-key filter (Array.isArray, t.get, fi, a.slice, mkf.has …) |
| `Y4l` | Year/4-level builder |
| `D` | Daemon output writer (FEc, sp, T, ke, GJf, d.write) |
| `okf` | Overflow key filter (T, n.filter, r.some, $6l) |
| `$6l` | Dollar-6-level segment builder (ZBr, t, W, e.filter) |
| `sqn` | Session queue normalizer |
| `x` | Output stream writer (d.write, W) |
| `_kf` | Underscore key formatter (t.push, nOo, t.join, n.trim) |
| `rkf` | Rank key filter (CQn, G6l, akf) |
| `L5e` | Level-5 entry filter/builder |
| `vkf` | Version key formatter (e.at, n.at, AGt, W, Rr, n.slice) |
| `w5e` | Window-5 entry builder (Array.isArray, R6l, i.some, n.add …) |
| `wkf` | Window key filter (Array.isArray, W, Rr, e.slice) |
| `skf` | Segment key filter (t.at, e.slice, t.push, On, Bv, B6l) |
| `N6l` | N-6-level segment builder |
| `B6l` | Block-6-level builder (n.at, IQn, n.push) |
| `J0f` | Join-0-format builder (Array.isArray, l.every, l.filter, c.join …) |
| `WVp` | Window-view context pipeline (SBe, Pt, lal, Txe, sA, E6t, yb, ke, fo) |
| `SBe` | Session-block entry builder (dae, yb, oK) |
| `sA` | Source-annotation builder (Qo, nl, Eo, S3u.has) |
| `E6t` | Event-6-type builder (ff, Eyo) |
| `Eyo` | Event-type formatter |
| `fo` | Error formatter (Error, String) |
| `iee` | Input-entry estimator (Math.min, uge, eC, yB) |
| `uge` | Usage-grid estimator (kIe, yae) |
| `kIe` | Context-limit fetcher (Eo, XZu, Math.min, hai) |
| `ne` | Node-entry set |
| `ee` | Event-entry handler (Promise.all, ZW, H.filter, git, E, nMn, ke, j.applyMcpUpdate …) |
| `ZW` | Async-iterator zip (TypeError, Number.isSafeInteger, …) |
| `H` | Buffer concat handler |
| `git` | Git integer parser |
| `E` | Event source (FUt, eyt) |
| `nMn` | Integer parser (parseInt) |
| `j` | MCP update applier (_.current, V.setTimeout, T, X) |
| `i9e` | Internal 9-event handler (RLe) |
| `uBo` | MCP server retry manager (Object.entries, n.filter, t.getClients …) |
| `te` | Timeout event handler (h) |
| `A` | Animation frame handler (_, Math.max, Math.min) |
| `_` | Main event loop (eyt, qD, Ox, Promise.all, k7, SB, ke, fo) |
| `v` | Visibility tracker |
| `x4` | Context format helper (wr, it) |
| `l5i` | Level-5 index builder (a5i, e.slice, GT, Kw) |
| `a5i` | Level-5 accumulator (Eae, i5i) |
| `i5i` | Level-5 initializer |
| `GT` | Grid transformer (cKp) |
| `cKp` | Context key processor (iwe, sqn) |
| `xt` | Extension point (zho) |
| `zho` | Zero-height object builder (Me) |
| `ye` | Year-entry selector (c, I, ce) |
| `I` | Input handler (Math.max, Math.floor, x.preventDefault, A) |
| `ce` | Context entry builder (vc, mte, ys, F.push, k.enqueue, kt) |
| `vc` | UUID context creator (xP.randomUUID) |
| `mte` | Model-type entry (put) |
| `ys` | Year-session builder (v9, Qo, Kg) |
| `k` | Queue entry manager (wk, w.delete, Date.now, w.get, Dfe, w.set) |
| `kt` | Keyboard-type resolver (VL) |
| `he` | Host entry handler (large subgraph — session/MCP init pipeline) |
| `ie` | Interactive entry pipeline (large subgraph — full session lifecycle) |
| `b7n` | Browser 7 node builder (gr, n.some, mh, Pa, zLo) |
| `sv` | Session viewer (Nxt, vTi, Nud, i9r, T, Uxt, Nw, tE) |
| `z` | Z-event handler (K.preventDefault, U) |
| `mh` | Message handler |
| `YHe` | Year-history entry (Promise.resolve, eut, n.listAllLiveSessions) |
| `V` | View/render orchestrator |
| `Xle` | Session-load entry handler (large subgraph) |
| `we` | Window-event handler (rKt, Math.max, Promise.resolve, ve.slice, Pne, Uue, kq) |
| `$e` | Dollar-entry splice handler (ve.findLastIndex, ve.splice, W, Pe, iKt) |
| `JA` | JSON-A parser (d6o, u6o) |
| `Uy` | Utility helper |
| `Xzt` | Cross-session transfer (E3.join, or, NE, gr, kt, E3.basename, mtr.rename, T) |
| `XY` | XY-position handler (Rc) |
| `LBn` | LB-node builder (Huo, dEt) |
| `hWe` | HW-event handler (Rc) |
| `DEe` | Data-entry event handler |
| `yat` | Year-annotation tag (ono) |
| `ejt` | Event journal type |
| `Qqe` | Queue-entry handler (o, vFo, nQl, r, W, Pe, Fo, _me, Mp) |
| `Zqe` | Z-queue-entry handler |
| `We` | Window-event regex handler (Qe.exec, st.slice, Error) |
| `Ue` | Update-event handler (e) |
| `Zzt` | Zero-zero-t utility |
| `Sz` | Session-zero handler (Vwt, Date.now) |
| `Xue` | XU-event handler (Rc) |
| `tjt` | Task-journal type handler |
| `Yue` | Year-update entry (Rc, Uf, gl.utimes, e.reAppendSessionMetadata) |
| `w` | Window activity tracker (aj, Date.now, Math.min, L, v, fcc, mcc) |
| `Rn` | Registry node (en, ke) |
| `en` | Environment node (Jye, uEe, UA, YEe.cwd, we.filter, np, fpe) |
| `vt` | View-tracker (j.push, Fe) |
| `Fe` | Feature-entry handler (it) |
| `Br` | Broadcast/cleanup handler |
| `Rua` | Remote-URL authenticator (large MCP connect subgraph) |
| `YR` | Year-range parser (e.slice, n.charCodeAt, n.slice) |
| `ln` | Log-node writer (c7e.push, jJ.logMCPDebug) |
| `eL` | Event-log entry (it) |
| `Vc` | Error-log writer (c7e.push, jJ.logMCPError) |
| `ql` | Queue-list utility |
| `os` | Output stream |
| `ur` | Update-registry (Gn.includes, p.includes, p.push, p.filter) |
| `Gn` | Global-node registry |
| `f9` | Format-9 helper (ac) |
| `ac` | Anchor cleaner (e.replace, e.startsWith, t.replace) |
| `xB` | XB-formatter (ac, r.startsWith) |
| `wWi` | Window-widget handler (e.find, vjr, W, it, aUd, T) |
| `aUd` | Auto-update dispatcher (it) |
| `TLn` | TL-node builder (t7) |
| `t7` | Template-7 formatter |
| `h_c` | Hash-context builder (e.find, vjr, FYf.has, Js, W, j6, QBo) |
| `Js` | JavaScript string handler (nSi, Oad.has, K9, Nad.has, Vi, Lme, Qz, r.includes) |
| `j6` | JSON-6 formatter (String) |
| `QBo` | Queue-broadcast object (Js, kme, W, j6, Su, Lme) |
| `_e` | Underscore-entry list (ph, kt, he) |
| `ph` | Path handler (kt, Rc) |
| `Rc` | Resource context (Ei) |
| `qe` | Queue-entry map (Gn.split) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.