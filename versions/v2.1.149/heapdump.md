---
type: feature-spec
feature: "heapdump"
cc_version: "2.1.149"
updated: "2026-06-01"
tags: ["heapdump", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.149 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/heapdump`

> Analysis basis: CC v2.1.149 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.149

---

## Overview

`/heapdump` is a hidden developer-diagnostic command that captures a V8/Bun heap snapshot, gathers comprehensive memory and process statistics, and writes both the snapshot file and a human-readable summary report to `~/Desktop`. It is intended for diagnosing memory leaks in the Claude Code process itself, and its output can be loaded directly into Chrome DevTools for heap inspection.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `heapdump` |
| description | `Dump the JS heap to ~/Desktop` |
| supportsNonInteractive | `true` |
| isHidden | `true` |
| module_id | `pU1` |
| load_inline | `true` |
| loc_byte | `12195789` |
| loc_byte_end | `12195952` |
| loc_line | `9974` |
| arbor_handler.name | `a65` |
| arbor_handler.fqn | `claude-2.1.149::a65` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.149 bundle.js:+12195789

---

## Input Branching

The command follows a linear execution path with several internal conditional branches (platform check, memory ratio analysis, leak indicator detection). The top-level flow has more than three distinct conditional paths, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/heapdump invoked"]) --> B[Collect memory statistics\ncollectMemoryStats]
    B --> C[Collect process info\nprocess.memoryUsage\nv8.getHeapStatistics\nprocess.resourceUsage\nprocess.uptime\nv8.getHeapSpaceStatistics]
    C --> D{Linux?\nCheck /proc/self/smaps_rollup}
    D -- "Linux: read smaps_rollup" --> E[Parse native RSS from smaps]
    D -- "Non-Linux / read fails" --> F[Native RSS = undefined]
    E --> G[Compute memory ratio\nnativeRSS / heapUsed]
    F --> G
    G --> H{Ratio > 100?\nbundle.js:+12191505}
    H -- "Yes: native >> heap" --> I[Emit warning:\n'Native memory > heap –\nleak may be in native addons'\nbundle.js:+12191591]
    H -- "No" --> J[No native-leak warning]
    I --> K[Resolve Desktop output path\ndesktopOutputPath]
    J --> K
    K --> L{Platform == 'darwin'?\nbundle.js:+12192864}
    L -- "macOS" --> M[macOS Desktop path resolution\nbundle.js:+12192445]
    L -- "Other / WSL" --> N[Generic Desktop path via homedir\nbundle.js:+1012949]
    M --> O[Format summary report\nformatSummaryLines]
    N --> O
    O --> P{heapUsed > total * threshold?\nDetermine dominant memory type}
    P -- "JS heap dominant" --> Q[Annotate: '— most memory is JS heap\n(inspect the .heapsnapshot)'\nbundle.js:+12195101]
    P -- "Native dominant" --> R[Annotate: '— most memory is native\n(NOT in the .heapsnapshot)'\nbundle.js:+12195161]
    P -- "No obvious indicators" --> S[Annotate: '(no obvious leak indicators)'\nbundle.js:+12195298]
    Q --> T[Generate heap snapshot\ngenerateHeapSnapshot]
    R --> T
    S --> T
    T --> U[Call Bun.generateHeapSnapshot\nbundle.js:+12194358]
    U --> V[Call Bun.gc\nbundle.js:+12194415]
    V --> W[Write .heapsnapshot file\nwriteFileSync, mode 0o600\nbundle.js:+12193803]
    W --> X[Write text summary file\ncH6.writeFile\nbundle.js:+12193768]
    X --> Y[Emit telemetry: tengu_heap_dump\nbundle.js:+12193910]
    Y --> Z[Return formatted result text\nwith Chrome DevTools hint\nbundle.js:+12194814]
```

---

## Behavioral Spec

### Top-level Handler (`a65`)

The async entry point dispatches to the core dump orchestrator and then assembles the final result string for display.

```
async function heapdumpCommandHandler(args):
    result = await runHeapDump(args)
    lines = []
    lines.push(result.summary)
    lines.join("\n")
    return { type: "text", text: lines }
```

Analysis basis: CC v2.1.149 bundle.js:+12194658, +12194777, +12194804, +12194926

---

### Core Orchestrator (`uU1`)

Coordinates the full dump sequence: statistics collection, path resolution, file writing, and returning the assembled report.

```
async function runHeapDump(context):
    // 1. Collect memory metrics
    stats = await collectMemoryStats()

    // 2. Determine output directory (~/Desktop with platform fallback)
    desktopPath = await resolveDesktopPath()

    // 3. Build output filename including timestamp
    snapshotPath = path.join(desktopPath, <timestamp>.heapsnapshot)
    summaryPath  = path.join(desktopPath, <timestamp>-summary.txt)

    // 4. Generate and write heap snapshot
    await writeHeapSnapshot(snapshotPath)

    // 5. Format summary lines
    summaryText = formatSummaryLines(stats)

    // 6. Write summary text file (utf8, mode 0o600 = 384 decimal)
    await fs.writeFile(summaryPath, summaryText, { mode: 384 })

    // 7. Emit telemetry event
    emit("tengu_heap_dump")

    // 8. Build return value
    return buildResultObject(stats, snapshotPath, summaryPath)
```

Analysis basis: CC v2.1.149 bundle.js:+12193320, +12193333, +12193379, +12193421, +12193616, +12193628, +12193725, +12193768, +12193784, +12193859, +12193908, +12193803

---

### Memory Statistics Collector (`r65`)

Aggregates all available memory data from the runtime and, on Linux, from `/proc` virtual filesystem entries.

```
async function collectMemoryStats():
    memUsage      = process.memoryUsage()
    heapStats     = v8Module.getHeapStatistics()
    resourceUsage = process.resourceUsage()
    uptime        = process.uptime()
    heapSpaces    = v8Module.getHeapSpaceStatistics()

    activeHandleCount  = process._getActiveHandles().length
    activeRequestCount = process._getActiveRequests().length

    // Linux-only: open file descriptor count from /proc/self/fd
    fdCount = undefined
    try:
        entries = await fs.readdir("/proc/self/fd")
        fdCount = entries.length
    catch: pass

    // Linux-only: native RSS from /proc/self/smaps_rollup
    nativeRSS = undefined
    try:
        smaps = await fs.readFile("/proc/self/smaps_rollup", "utf8")
        nativeRSS = parseRSSFromSmaps(smaps)
    catch: pass

    // Compute ratio: seconds of uptime per MB heap — used for leak indicator
    // Time-to-heap ratio window: 3600 seconds / 1048576 bytes
    ratio = computeLeakRatio(uptime, memUsage.heapUsed,
                              windowSeconds=3600,
                              windowBytes=1048576)

    // Native leak warning threshold: nativeRSS / heapUsed > 100
    if nativeRSS defined and (nativeRSS / memUsage.heapUsed) > 100:
        addWarning("Native memory > heap - leak may be in native addons (node-pty, sharp, etc.)")

    return { memUsage, heapStats, resourceUsage, uptime, heapSpaces,
             activeHandleCount, activeRequestCount, fdCount, nativeRSS, ratio }
```

Analysis basis: CC v2.1.149 bundle.js:+12190821, +12190845, +12190871, +12190897, +12190922, +12190964, +12191001, +12191052, +12191064, +12191114, +12191127, +12191153, +12191212, +12191353, +12191358, +12191505, +12191591

---

### Heap Snapshot Writer (`o65`)

Generates the Bun heap snapshot and writes it to disk, then triggers a garbage collection pass for a cleaner post-dump baseline.

```
function writeHeapSnapshot(outputPath):
    // Generate snapshot using Bun's built-in JSC snapshot API
    snapshot = Bun.generateHeapSnapshot()   // returns ArrayBuffer (v8/arraybuffer format)

    // Write synchronously to guarantee file integrity before GC
    fs.writeFileSync(outputPath, snapshot)   // mode: default (0o600 applied by caller)

    // Trigger GC to measure post-dump reclaimable memory
    Bun.gc(/* synchronous */ true)
```

Analysis basis: CC v2.1.149 bundle.js:+12194338, +12194358, +12194383, +12194388, +12194415

---

### Desktop Path Resolver (`ZWA`)

Resolves the platform-appropriate Desktop directory, handling macOS native paths and WSL Windows user directories.

```
async function resolveDesktopPath():
    base = os.homedir()
    candidate = path.join(base, "Desktop")

    // WSL: scan /mnt/c/Users for a real Windows user (skip Public/Default/All Users)
    if isWSL():
        usersDir = "/mnt/c/Users"
        entries = readdir(usersDir)
        for entry in entries:
            if entry not in ["Public", "Default", "Default User", "All Users"]:
                candidate = path.join(usersDir, entry, "Desktop")
                break

    // Verify the path exists; if not, fall back to homedir
    if not exists(candidate):
        candidate = base

    return candidate
```

Analysis basis: CC v2.1.149 bundle.js:+1012942, +1012949, +1012985, +1013125, +1013162, +1013217, +1013261, +1013280, +1013300, +1013325, +1013434

---

### Summary Formatter (`s65`)

Builds the human-readable multi-line report, classifying the dominant memory type and emitting the Chrome DevTools hint.

```
function formatSummaryLines(stats):
    lines = []

    // Heap usage section with fixed-point formatting
    lines.append(formatHeapLine(stats.memUsage.heapUsed))    // X.toFixed(...)
    lines.append(formatHeapLine(stats.heapStats.totalHeapSize))

    // Classify dominant memory type
    jsHeapFraction = stats.memUsage.heapUsed / stats.memUsage.rss
    if jsHeapFraction above threshold:
        lines.append("— most memory is JS heap (inspect the .heapsnapshot)")
    else if nativeRSS significantly exceeds heapUsed:
        lines.append("— most memory is native (NOT in the .heapsnapshot)")
    else:
        lines.append("  (no obvious leak indicators)")

    // Per-heap-space breakdown (padded columns, width 8)
    for space in stats.heapSpaces:
        lines.append(formatSpaceLine(space, padWidth=8))

    // Active handle / request / fd counts
    lines.append("Active handles: " + stats.activeHandleCount)
    lines.append("Active requests: " + stats.activeRequestCount)

    // Chrome DevTools usage hint
    lines.append("Open the .heapsnapshot in Chrome DevTools → Memory → Load to inspect retainers.")

    return lines.join("\n")
```

Analysis basis: CC v2.1.149 bundle.js:+12191714, +12195033, +12195101, +12195161, +12195298, +12195345, +12194814, +12195433, +12195707

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_heap_dump` (bundle.js:+12193910) |
| File written: heap snapshot | `~/Desktop/<timestamp>.heapsnapshot` — binary V8/JSC heap snapshot, written synchronously via `Bun.generateHeapSnapshot` then `writeFileSync` (bundle.js:+12194338, +12194358) |
| File written: summary report | `~/Desktop/<timestamp>-summary.txt` — UTF-8 text, file mode `0o600` (decimal `384`) (bundle.js:+12193768, +12193803) |
| Bun GC triggered | `Bun.gc(true)` called after snapshot write, causing a synchronous garbage-collection pass (bundle.js:+12194415) |
| `/proc` reads (Linux only) | Reads `/proc/self/fd` (fd count) and `/proc/self/smaps_rollup` (native RSS) — both are best-effort; failures are silently swallowed (bundle.js:+12191052, +12191114) |
| `bun:jsc` module import | Imported at collection time for `getHeapStatistics` / `getHeapSpaceStatistics` when running under Bun (bundle.js:+12191212) |
| appState changes | None detected in depth-2 traversal |
| Sound | None detected |
| Hook registration | None detected at command level |

---

## Version History

| Version | Change |
|---|---|
| v2.1.149 | Initial analysis |

---

## Common Mistakes

1. **Expecting the file on a non-Desktop path**: The output is always written to `~/Desktop` (or the WSL Windows Desktop equivalent). If that directory does not exist the resolver falls back to `~`, which may be surprising.
2. **Opening a stale snapshot**: `Bun.gc()` is called *after* writing the snapshot, so the snapshot itself reflects pre-GC heap state. The summary text, however, is written after GC and may show lower live-object counts. Compare the two carefully.
3. **Running in CI / non-interactive mode**: The command sets `supportsNonInteractive: true`, so it will run without a terminal. However, the resulting files land on the machine running the Claude Code process, which in CI may not be easily accessible.
4. **Missing native-leak context on macOS**: The native RSS ratio check (`nativeRSS / heapUsed > 100`) only fires on Linux (where `/proc/self/smaps_rollup` is available). On macOS the warning is never emitted; native memory leaks must be inferred from the snapshot indirectly.
5. **Assuming the snapshot is V8 format**: The snapshot is generated via `Bun.generateHeapSnapshot`, which targets the JavaScriptCore (JSC) heap. Chrome DevTools Memory panel accepts it, but some V8-specific tooling (e.g., `heapdump` npm package utilities) may not parse it correctly.
6. **Confusing the two output files**: The `.heapsnapshot` is binary/JSON object graph; the `-summary.txt` is a plain-text digest. Only the `.heapsnapshot` can be loaded into DevTools; the summary is for quick triage only.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `a65` | Top-level async command handler (arbor_handler; dispatches to `uU1`, assembles result lines) |
| `uU1` | Core heap-dump orchestrator (coordinates stats, path, snapshot, file write, telemetry) |
| `r65` | Memory statistics collector (aggregates V8, process, and `/proc` metrics) |
| `o65` | Heap snapshot generator/writer (`Bun.generateHeapSnapshot`, `writeFileSync`, `Bun.gc`) |
| `s65` | Summary report formatter (classifies dominant memory type, emits Chrome DevTools hint) |
| `ZWA` | Desktop path resolver (handles macOS, Linux, WSL Windows user directories) |
| `S6` | Utility: string/path helper (called from both `uU1` and `r65`) |
| `Dv` | Low-level utility reached from `S6` |
| `T` | Utility function reached from `r65` (calls `HE6`, `wh8`) |
| `HE6` | Sub-utility reached from `T` |
| `wh8` | Sub-utility reached from `T` and `P` |
| `P` | Async task / promise utility (wraps `Promise.all`, connection state management) |
| `RH` | Error logging / reporting helper (calls `ll.logError`, `uiK`) |
| `c_` | Error constructor/wrapper utility |
| `X` | Buffer/stream processing utility (calls `Buffer.concat`, subprocess output handling) |
| `J` | Stream or array buffer utility used by `X` |
| `w` | Subprocess / worker management (spawns processes, handles `SIGKILL`, memory checks) |
| `zM` | Stream end/channel helper used by `X` and `zk5` |
| `zk5` | Large multiplexed message-dispatch handler (PTY/session protocol; reached via `X`) |
| `EH` | String conversion utility reached from `X` |
| `N` | Telemetry / event emitter dispatcher (routes events, calls `CH`, `MVK`, `OVK`) |
| `MVK` | Event routing sub-handler (calls `Gv`, `LVK`, `T7A`) |
| `T7A` | Event type classifier (calls `fTK`, `$TK`) |
| `H` | Randomised retry / timeout helper (calls `Math.random`, `setTimeout`) |
| `CH` | JSON serialisation helper (`JSON.stringify`) |
| `_` | String or array utility used across multiple callers |
| `X4` | Path/string manipulation utility (slice, replace, lastIndexOf) |
| `s5A` | String mapping sub-utility used by `X4` |
| `q` | Queue or temp-file manager (calls `SJK.unlinkSync`) |
| `A` | String normalisation utility (`toLowerCase`) |
| `HbH` | File write wrapper (calls `B5A`) |
| `B5A` | Low-level stream write utility |
| `OVK` | Log file manager / rotating writer (mkdir, appendFile, rename, unlink) |
| `ICH` | Async queue / batch processor (setTimeout, setImmediate, join operations) |
| `q9H` | Log path resolver sub-utility |
| `Q6` | General-purpose async utility (called from `uU1`, `ZWA`, `OVK`) |
| `G96` | File-system error classifier (calls `K8`) |
| `LMA` | Log path join helper |
| `KMA` | Log file rotation handler (stat, rename, unlink) |
| `$VK` | Log segment writer (mkdir, appendFile, rotation) |
| `a9` | Cleanup/signal registration utility (`W7A.register`) |
| `K` | Column formatter / pad utility (`L.map`, `M.padEnd`) |
| `L` | Promise set tracker (`q.add`, `q.delete`, `M.finally`) |
| `M` | Resource lifecycle manager (`A.close`, `q.close`) |
| `c` | Low-level constructor or configuration object |
| `Dz` | Post-dump result builder or display formatter |
| `lH6` | Sub-utility reached from summary formatter `s65` |