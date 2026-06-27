---
type: feature-spec
feature: "insights"
cc_version: "2.1.195"
updated: "2026-06-27"
tags: ["insights", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.195 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/insights`

> Analysis basis: CC v2.1.195 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.195

---

## Overview

The `/insights` command generates a shareable HTML usage report by analyzing the user's accumulated Claude Code session data. It collects session transcripts and facets from the local data store, computes statistics (tool usage, response times, activity patterns, token spend, and more), writes a timestamped `report.html` file to disk, and then instructs the agent to surface a ready-made confirmation message verbatim to the user.

---

## Registration

| Field | Value |
|---|---|
| type | `prompt` |
| name | `insights` |
| description | `Generate a report analyzing your Claude Code sessions` |
| loc_byte | `13511720` |
| loc_byte_end | `13513024` |
| loc_line | `10231` |
| handler_method | `getPromptForCommand` |
| handler_method_start | `13511894` |
| handler_method_end | `13513023` |
| prompt_body.length | `513` |
| prompt_body.trace | `call→Woc(...) (1 literals)` |
| arbor_handler.name | `getPromptForCommand` |
| arbor_handler.kind | `Method` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.fqn | `claude-2.1.195::getPromptForCommand` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.195 bundle.js:+13511720

---

## Input Branching

The handler follows a linear pre-flight sequence before prompt construction, then branches at several decision points during data collection and report generation. The dominant flow has 4+ distinct paths.

```mermaid
flowchart TD
    A([User runs /insights]) --> B[listProjectSessions\ncollect session dirs from data store]
    B --> C{Sessions found?}
    C -- None --> D[Return empty summary\n'_No insights generated_']
    C -- Found --> E[Slice to most-recent N sessions\ndefault cap applies]
    E --> F[readSessionData per session\nload .jsonl + session-meta JSON]
    F --> G{Read errors?}
    G -- Error --> H[Skip session / partial data]
    G -- OK --> I[processSessionFacets\ncompute per-session statistics]
    I --> J[collectInsightsData\naggregate all facets into report model]
    J --> K[buildReportHTML\nrender HTML with embedded charts]
    K --> L{HTML build OK?}
    L -- Error --> M[Log error via errorReporter]
    L -- OK --> N[mkdir output dir\nwrite report.html with timestamp]
    N --> O[writeReportMetadata\nwrite facets JSON sidecar]
    O --> P[constructPromptBody\ncall Woc() to interpolate data into prompt template]
    P --> Q[Return prompt string to agent\nAgent outputs <message> block verbatim]
```

Analysis basis: CC v2.1.195 bundle.js:+13511893 (handler entry), +13511993 (data collection branch), +13500907 (report write)

---

## Behavioral Spec

### 1. Session Discovery (`listProjectSessions`)

The handler begins by enumerating project session directories stored under the local `projects` subdirectory of the Claude Code data root.

```
function listProjectSessions(dataRoot):
    projectsDir = path.join(dataRoot, "projects")
    entries = fs.readdir(projectsDir, {withFileTypes: true})
    dirs = entries.filter(e => e.isDirectory())
    sessionDirs = []
    for each dir in dirs:
        subEntries = fs.readdir(dir.path, {withFileTypes: true})
        jsonlFiles = subEntries.filter(e => e.isFile() AND matchesJsonlPattern(e.name))
        for each file in jsonlFiles:
            sessionDirs.push({
                name: path.basename(file),
                path: path.join(dir.path, file.name),
                stat: fs.stat(file.fullPath)
            })
    sessionDirs.sort(byMtimeDescending)
    return sessionDirs
```

- Session files must match the `.jsonl` extension pattern. Analysis basis: CC v2.1.195 bundle.js:+13600320
- Directories are collected at depth 1 under `projects`. Analysis basis: CC v2.1.195 bundle.js:+13498279
- The list is sorted and then a cap of recent sessions is applied (cap observed as 50 sessions sliced from the front). Analysis basis: CC v2.1.195 bundle.js:+13498671

### 2. Per-Session Data Loading (`readSessionData`)

For each session directory the handler reads two data sources:

```
function readSessionData(sessionPath, dataRoot):
    // Load raw transcript
    rawJsonl = fs.readFile(sessionPath, "utf-8")
    messages = parseJsonl(rawJsonl)   // each line is JSON.parse'd

    // Load session metadata (usage-data / session-meta)
    metaPath = buildMetaPath(dataRoot, "usage-data", "session-meta")
    metaJson = fs.readFile(metaPath, "utf-8")
    meta = JSON.parse(metaJson)

    return { messages, meta }
```

- The metadata subdirectory structure is `<dataRoot>/usage-data/session-meta`. Analysis basis: CC v2.1.195 bundle.js:+13437486, +13437582
- JSON lines are decoded with `Bt` (a thin `JSON.parse` wrapper). Analysis basis: CC v2.1.195 bundle.js:+13443652
- Encoding is always `utf-8`. Analysis basis: CC v2.1.195 bundle.js:+13443635

### 3. Facet Computation (`processSessionFacets`)

Each loaded session is processed into a structured facet object capturing the key usage dimensions:

```
function processSessionFacets(messages, meta, sessionName):
    facet = {}

    // Tool usage analysis
    toolUses = messages.filter(m => m.type == "tool_use")
    for each use in toolUses:
        classify tool name → category (WebSearch, WebFetch, Edit, Write, mcp__*, Other)
        record outcome (exit code / rejected / edit-failed / file-changed / too-large / not-found)
        detect git operations ("git commit", "git push")

    // Response time buckets: <2s, 2-10s, 10-30s, 30s-1m, 1-2m, 2-5m, 5-15m, >15m
    // Time-of-day buckets: Morning(6-12), Afternoon(12-18), Evening(18-24), Night(0-6)
    // Session duration: binned at 3600s boundary
    // Token spend aggregation

    return facet
```

- Tool categories detected: `WebSearch`, `WebFetch`, `Edit`, `Write`, `mcp__` prefix, `Other`. Analysis basis: CC v2.1.195 bundle.js:+13438158, +13438179, +13438203, +13438310, +13438322
- Session duration threshold: 3600 seconds (1 hour). Analysis basis: CC v2.1.195 bundle.js:+13438983
- Response time bucket boundaries (seconds): 2, 10, 30, 60, 120, 300, 900. Analysis basis: CC v2.1.195 bundle.js:+13455042, +13455124
- Time-of-day hour boundaries: 6, 12, 18, 0. Analysis basis: CC v2.1.195 bundle.js:+13455670

### 4. Insights Aggregation (`collectInsightsData`)

```
function collectInsightsData(sessionFacets, sessionMeta, recentSessions):
    aggregate = {
        totalSessions:    count(sessionFacets),
        toolUseCounts:    sumByCategory(sessionFacets),
        errorBreakdown:   groupByOutcome(sessionFacets),
        responseTimeDist: mergeHistograms(sessionFacets),
        timeOfDayDist:    mergeHistograms(sessionFacets),
        tokenSpend:       sum(sessionFacets.tokenCounts),
        gitActivity:      sum(gitCommits + gitPushes),
        atAGlanceSummary: computeAtAGlance(aggregate)
    }

    // Cap session listing at 20 most-recent for display
    recentList = recentSessions.slice(0, 20)

    return aggregate
```

- Display cap for recent sessions in the report: 20. Analysis basis: CC v2.1.195 bundle.js:+13450485
- The `at_a_glance` key is computed and embedded separately. Analysis basis: CC v2.1.195 bundle.js:+13451849
- Fallback text when no data is captured: `"None captured"`. Analysis basis: CC v2.1.195 bundle.js:+13451183

### 5. HTML Report Generation (`buildReportHTML`)

The handler renders a self-contained HTML file with inline charts and tables. Key rendering helpers:

```
function buildReportHTML(insightsData):
    html = renderShell(insightsData)   // top-level layout

    // Sections rendered via dedicated sub-renderers:
    html += renderToolUsageTable(insightsData.toolUseCounts)
    html += renderErrorChart(insightsData.errorBreakdown)       // chart colors: #dc2626, #16a34a, #eab308
    html += renderResponseTimeChart(insightsData.responseTimeDist)
                // colors: #2563eb, #0891b2, #10b981, #8b5cf6
    html += renderTimeOfDayChart(insightsData.timeOfDayDist)
    html += renderTokenSpendSection(insightsData.tokenSpend)
    html += renderSuggestionsSection(insightsData)

    // Empty-state placeholders:
    // "<p class=\"empty\">No data</p>"
    // "<p class=\"empty\">No response time data</p>"
    // "<p class=\"empty\">No tool errors</p>"
    // "<p class=\"empty\">No time data</p>"

    return html
```

- Chart color palette documented in bundle literals. Analysis basis: CC v2.1.195 bundle.js:+13492487, +13492625, +13492797, +13492940, +13496203, +13496452, +13496945
- Maximum token budget for rendered report body: 8192 characters. Analysis basis: CC v2.1.195 bundle.js:+13453991
- HTML entity escaping applied to user-visible strings (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`). Analysis basis: CC v2.1.195 bundle.js:+5428438

### 6. Report File Writing

```
function writeReport(html, dataRoot):
    now = new Date()
    timestamp = String(now.getFullYear()) +
                padded(now.getMonth()) +
                padded(now.getDate()) +
                padded(now.getHours()) +
                padded(now.getMinutes()) +
                padded(now.getSeconds())

    outputDir = path.join(dataRoot, "insights")   // literal "insights"
    fs.mkdir(outputDir, {recursive: true})

    filename = "report.html"
    outputPath = path.join(outputDir, filename)
    fs.writeFile(outputPath, html)

    // Write facets sidecar JSON
    facetsDir = path.join(outputDir, "facets")
    writeFacetsSidecar(facetsDir, insightsData)

    return { reportUrl: fileUrl(outputPath), htmlFile: outputPath, facetsDir }
```

- Output filename is always `report.html`. Analysis basis: CC v2.1.195 bundle.js:+13500909
- Output directory literal: `"insights"`. Analysis basis: CC v2.1.195 bundle.js:+13445408
- Buffer size for file I/O: 4096 bytes. Analysis basis: CC v2.1.195 bundle.js:+13445517
- Facets sidecar max row budget: 384 entries. Analysis basis: CC v2.1.195 bundle.js:+13444284

### 7. Prompt Construction and Agent Instruction (`getPromptForCommand` → `Woc`)

```
function getPromptForCommand(context):
    insightsResult = collectAndBuildReport(context)

    // Compute at-a-glance text for agent context
    atAGlanceText = insightsResult.atAGlance ?? "_No insights generated_"

    // Separator literal: " · "
    summaryLine = formatSummaryLine(insightsResult, separator=" · ")

    // Call template interpolator (Woc) with report URLs and summary
    promptBody = Woc(
        insightsData    = insightsResult.data,
        reportUrl       = insightsResult.reportUrl,
        htmlFile        = insightsResult.htmlFile,
        facetsDir       = insightsResult.facetsDir,
        atAGlance       = atAGlanceText
    )

    return { type: "prompt", text: promptBody }
```

- The prompt instructs the agent to output the text between `<message>` tags **verbatim as its entire response**, ensuring the user sees a consistent confirmation message. Analysis basis: CC v2.1.195 bundle.js:+13511894 (handler start), +13512926 (Woc call)
- The at-a-glance summary is provided to the agent for context only; the user has not yet seen any output at this point (per prompt structure). Analysis basis: prompt_body extraction, +13512791
- Fallback string when no insights are generated: `"_No insights generated_"`. Analysis basis: CC v2.1.195 bundle.js:+13512791
- Separator used in summary formatting: `" · "`. Analysis basis: CC v2.1.195 bundle.js:+13512352
- `Math.round` is applied to numeric values before embedding them in the prompt. Analysis basis: CC v2.1.195 bundle.js:+13512281

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_transcript_phantom_parent` (bundle.js:+13584971), `tengu_relink_walk_broken` (bundle.js:+13561043), `tengu_transcript_parent_cycle` (bundle.js:+13589073), `tengu_chain_parent_cycle` (bundle.js:+13562820), `tengu_chain_timestamp_fallback` (bundle.js:+13562969), `tengu_chain_parallel_tr_recovered` (bundle.js:+13564835) — all fired during transcript chain reconstruction; none are insights-specific success/failure events |
| File writes | `<dataRoot>/insights/report.html` (timestamped content, overwritten each invocation); `<dataRoot>/insights/facets/` sidecar JSON |
| Directory creation | `<dataRoot>/insights/` created with `recursive: true` if absent |
| File reads | Session `.jsonl` transcripts from `<dataRoot>/projects/**/*.jsonl`; session metadata from `<dataRoot>/usage-data/session-meta/` |
| Hook registration | None observed in depth-2 traversal |
| appState changes | None observed in depth-2 traversal |
| Sound | None observed in depth-2 traversal |
| Agent output | Agent is instructed to output the `<message>` block verbatim as its entire response (no additional prose) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.195 | Initial analysis |

---

## Common Mistakes

1. **Running before any sessions exist**: If no `.jsonl` session files are found under `<dataRoot>/projects/`, the agent receives the fallback summary `"_No insights generated_"` and the report file will be empty or absent. At least one completed session is required for meaningful output.

2. **Expecting real-time data**: The report reflects data already persisted to disk. In-progress sessions are not included until they have been written to their `.jsonl` files.

3. **Assuming the agent will elaborate**: The prompt explicitly instructs the agent to output the `<message>` block verbatim as its **entire** response. Follow-up questions in the same turn may not yield additional analysis beyond what the template provides.

4. **Misidentifying the output location**: The report is written to `<dataRoot>/insights/report.html`. The `<dataRoot>` is the Claude Code configuration/data directory (not the current working project directory).

5. **Stale facets directory**: The facets sidecar is regenerated on every invocation. If an external tool is reading the facets directory concurrently, it may observe a partial write during report generation.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `__handler_insights` | Synthetic BFS entry point for the `/insights` command handler |
| `Goc` | Main data-collection orchestrator: loads sessions, builds facets, writes report |
| `fZf` | Session directory lister (reads project dirs, filters `.jsonl` files, sorts by mtime) |
| `a2` | Path join helper for `projects` subdirectory |
| `Fbt` | Per-directory `.jsonl` file enumerator with `fs.stat` metadata collection |
| `yM` | `.jsonl` extension pattern test |
| `tZf` | Per-session data reader (reads raw JSONL + session-meta JSON) |
| `v6o` | Path resolver for session data subdirectories |
| `WQt` | Base path builder for `usage-data` / `session-meta` |
| `$oc` | Session-meta parse helper |
| `Bt` | Thin `JSON.parse` wrapper |
| `rlr` | Facets aggregator: iterates sessions, calls per-session processors, assembles report model |
| `Lpe` | Transcript chain reconstructor (rebuilds parent-child message graph from JSONL) |
| `DZf` | Chain initializer |
| `eW` | Chain walk helper |
| `qXe` | Message tree traversal utility |
| `pA` | Append-to-chain helper |
| `cem` | Binary JSONL parser (Buffer-based, handles large files) |
| `uem` | Synchronous JSONL header reader |
| `lem` | Streaming JSONL record splitter |
| `msc` | Session index / cache manager |
| `mve` | Codec helpers for transcript records |
| `$sc` | Session lookup by ID |
| `lAe` | Per-session facet processor (tool use, timing, outcomes) |
| `YZf` | NaN-safe numeric accumulator |
| `JZf` | Tool-usage histogram builder |
| `KZf` | Session ordering/deduplication helper |
| `Eht` | Facet field mapper |
| `sGo` | String sanitizer for report content |
| `lXt` | Text chunk renderer |
| `lGo` | Content-type classifier for message blocks |
| `XZf` | Array/string presence tester |
| `QZf` | Array element matcher |
| `rAe` | Report aggregation reducer |
| `Hlr` | Histogram getter/setter |
| `_lr` | Value-set flattener (Array.from + values) |
| `KQf` | NaN guard for numeric session fields |
| `L6o` | Per-session metric extractor (rounds values, trims strings) |
| `Uoc` | Tool-use record classifier (maps tool names to categories and outcomes) |
| `GQt` | Tool name normalizer |
| `qQf` | File extension extractor |
| `fke` | Diff utility caller |
| `hu` | Index-of helper |
| `N` | Network/fetch utility (unrelated to insights core path) |
| `M` | Auth/OAuth handler (unrelated to insights core path) |
| `Vg` | Numeric value formatter |
| `w6o` | Report metadata writer |
| `nZf` | Metadata directory creator and JSON writer |
| `Me` | `JSON.stringify` wrapper |
| `ZQf` | Cached report reader (reads and optionally deletes stale report files) |
| `nlr` | Base path builder for output directory |
| `joc` | File unlink helper |
| `rZf` | Full report builder: calls HTML generator, calls API report endpoint, writes file |
| `QQf` | Report section assembler (slices and joins content chunks) |
| `YQf` | Per-section metric formatter |
| `myt` | API-side report submission helper |
| `Ec` | Error class base |
| `CZn` | Agent listing diff/snapshot utility |
| `Rn` | Random UUID generator wrapper |
| `g7e` | Report generation caller (calls external render function, validates output) |
| `kR` | Report configuration reader |
| `p0` | Process/shell utility |
| `bN` | Report data normalizer |
| `Noc` | Network request wrapper for report upload |
| `N_` | Low-level HTTP client |
| `of` | HTTP response handler |
| `Kl` | Response filter |
| `Zr` | Error string coercer |
| `eZf` | Facets directory and JSON sidecar writer |
| `mZf` | Object-key enumerator for report sections |
| `Boc` | Per-section statistics aggregator (sort, median, percentiles) |
| `$bt` | Section entry mapper |
| `yi` | String index/slice helper |
| `Foc` | Numeric distribution builder (sort, set operations, histogram fill) |
| `sZf` | Full HTML report renderer (iterates facet values, calls sub-renderers) |
| `Ooc` | Per-session HTML block generator |
| `GQf` | HTTP helper for report publishing |
| `dZf` | Main HTML document builder (layout, charts, tables, CSS) |
| `ip` | HTML entity escaper |
| `zl` | String `replaceAll` helper |
| `tlr` | Table row renderer |
| `uZf` | JSON-stringify helper for embedded data |
| `STe` | Columnar table renderer (max-width, uppercase headers) |
| `lZf` | Column width calculator |
| `cZf` | Chart bar renderer |
| `Woc` | Prompt template interpolator — fills report URLs and summary into the 513-char prompt body |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.