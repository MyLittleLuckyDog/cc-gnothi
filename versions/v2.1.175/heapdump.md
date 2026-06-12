---
type: feature-spec
feature: "heapdump"
cc_version: "2.1.175"
updated: "2026-06-12"
tags: ["heapdump", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.175 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/heapdump`

> Analysis basis: CC v2.1.175 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.175

---

## Overview

`/heapdump` is a hidden diagnostic command that dumps the JavaScript heap to the user's Desktop directory and collects a comprehensive set of memory and process statistics. It is intended for debugging memory issues in the Claude Code process itself, producing both a `.heapsnapshot` file (openable in Chrome DevTools) and a human-readable summary of memory usage. The command runs entirely non-interactively and requires no user arguments.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `heapdump` |
| description | `Dump the JS heap to ~/Desktop` |
| supportsNonInteractive | `true` |
| isHidden | `true` |
| module_id | `szK` |
| load_inline | `true` |
| loc_byte | `12881169` |
| loc_byte_end | `12881597` |
| loc_line | `9126` |
| arbor_handler.name | `qa7` |
| arbor_handler.fqn | `claude-2.1.175::qa7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.175 bundle.js:+12881169

---

## Input Branching

The command has more than three distinct internal branches (memory stats collection, platform-specific Desktop resolution, heap snapshot generation via Bun vs. V8 path, leak indicator classification, and output formatting). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/heapdump invoked"] --> B[collectMemoryStats - ozK]
    B --> C[process.memoryUsage]
    B --> D[v8.getHeapStatistics]
    B --> E[process.resourceUsage]
    B --> F[process.uptime]
    B --> G[v8.getHeapSpaceStatistics]
    B --> H[process._getActiveHandles / _getActiveRequests]
    B --> I{Linux: read /proc/self/smaps_rollup?}
    I -- yes --> J[jL6.readFile utf8]
    I -- no --> K[skip smaps]
    J --> L[resolveDesktopPath - FQA]
    K --> L
    L --> M{Platform?}
    M -- darwin/linux --> N[os.homedir + Desktop]
    M -- windows/WSL --> O[/mnt/c/Users/... + Desktop or Public fallback]
    N --> P[generateHeapSnapshot - Aa7]
    O --> P
    P --> Q{Bun runtime available?}
    Q -- yes --> R[Bun.generateHeapSnapshot + Bun.gc]
    Q -- no --> S[V8 arraybuffer snapshot path]
    R --> T[writeFileSync to Desktop path, mode 0o600]
    S --> T
    T --> U[classifyLeakIndicators - Ka7]
    U --> V{native RSS >> heap used?}
    V -- yes --> W["— most memory is native (NOT in .heapsnapshot)"]
    V -- no --> X["— most memory is JS heap (inspect .heapsnapshot)"]
    X --> Y{any obvious leak indicators?}
    W --> Y
    Y -- none --> Z["(no obvious leak indicators)"]
    Y -- found --> AA[list indicators]
    Z --> AB[formatOutput - Ka7 + main handler qa7]
    AA --> AB
    AB --> AC[emit text result with snapshot path + stats table]
    AC --> AD[log telemetry: tengu_heap_dump]
    AD --> AE[return result to CLI]
```

---

## Behavioral Spec

### Main Handler (`qa7`)

The top-level async function resolves through module `szK` (via `load_inline`). It orchestrates the sub-steps below in sequence, then assembles the final text output.

```
async function heapdumpHandler(context):
    statsLines  = []
    snapshotPath = resolveDesktopPath()          // FQA
    memStats     = collectMemoryStats()          // ozK
    snapshotFile = generateHeapSnapshot(snapshotPath)  // Aa7 via DwA

    summary      = classifyLeakIndicators(memStats)   // Ka7
    lines        = buildOutputLines(memStats, summary)

    lines.push("Open the .heapsnapshot in Chrome DevTools → Memory → Load to inspect retainers.")
    return { type: "text", content: lines.join("\n") }
```

Analysis basis: CC v2.1.175 bundle.js:+12880038

---

### Memory Statistics Collection (`ozK`)

Gathers all available runtime metrics from the Node/Bun process, plus Linux `/proc` pseudo-files when present.

```
function collectMemoryStats():
    stats = {}
    stats.memory   = process.memoryUsage()
    stats.heap     = v8.getHeapStatistics()
    stats.resource = process.resourceUsage()
    stats.uptime   = process.uptime()
    stats.spaces   = v8.getHeapSpaceStatistics()
    stats.handles  = process._getActiveHandles().length
    stats.requests = process._getActiveRequests().length

    // Linux only: open file-descriptor count
    try:
        fds = await fs.readdir("/proc/self/fd")
        stats.fdCount = fds.length
    catch:
        pass  // non-Linux, silently ignored

    // Linux only: smaps_rollup for native RSS breakdown
    try:
        smaps = await fs.readFile("/proc/self/smaps_rollup", "utf8")
        stats.smaps = smaps
    catch:
        pass

    // Threshold constants used later:
    //   uptime threshold  : 3600 s   (bundle.js:+12876733)
    //   RSS threshold unit: 1 048 576 bytes (bundle.js:+12876738)
    //   formatting limit  : 500 MB   (bundle.js:+12877126)

    return stats
```

Analysis basis: CC v2.1.175 bundle.js:+12876201

---

### Desktop Path Resolution (`FQA`)

Locates the platform-appropriate Desktop directory to write the snapshot file.

```
function resolveDesktopPath():
    home = os.homedir()

    if platform == "windows" or isWSL():
        // WSL path: scan /mnt/c/Users, skip Public / Default / Default User / All Users
        wslUsers = listDirectory("/mnt/c/Users")
        user = firstNonSystemUser(wslUsers)
        if user:
            return path.join("/mnt/c/Users", user, "Desktop")
        else:
            return path.join("/mnt/c/Users", "Public", "Desktop")
    else:
        // macOS / Linux
        return path.join(home, "Desktop")
```

Analysis basis: CC v2.1.175 bundle.js:+12878996 (FQA call site); literals `"Desktop"` at +1093229, `"windows"` at +1093247, `"/mnt/c/Users"` at +1093451.

---

### Heap Snapshot Generation (`Aa7`)

Writes the snapshot file and triggers garbage collection to keep subsequent stats clean.

```
function generateHeapSnapshot(desktopDir):
    timestamp  = currentTimestamp()
    filename   = "claude-" + timestamp + ".heapsnapshot"
    fullPath   = path.join(desktopDir, filename)

    if Bun is available:
        snapshot = Bun.generateHeapSnapshot()    // bundle.js:+12879738
        Bun.gc(/* expose= */ true)               // bundle.js:+12879795
        fs.writeFileSync(fullPath, snapshot, { mode: 0o600 })   // 384 decimal, bundle.js:+12879183
    else:
        // V8 arraybuffer path
        snapshot = generateV8HeapSnapshot("arraybuffer")  // literals "v8"/"arraybuffer" at +12879763/+12879768
        fs.writeFileSync(fullPath, snapshot, { mode: 0o600 })

    emit telemetry: tengu_heap_dump                       // bundle.js:+12879290
    return fullPath
```

Analysis basis: CC v2.1.175 bundle.js:+12879239

---

### Leak Indicator Classification (`Ka7`)

Compares native RSS against heap usage and flags potential memory categories.

```
function classifyLeakIndicators(stats):
    indicators = []
    nativeRSS  = stats.memory.rss - stats.heap.used_heap_size

    if nativeRSS > stats.heap.used_heap_size:
        indicators.push("Native memory > heap - leak may be in native addons (node-pty, sharp, etc.)")
        // literal at bundle.js:+12876971
        memorySummary = "— most memory is native (NOT in the .heapsnapshot)"
        // literal at bundle.js:+12880541
    else:
        memorySummary = "— most memory is JS heap (inspect the .heapsnapshot)"
        // literal at bundle.js:+12880481

    if indicators is empty:
        summaryLine = "  (no obvious leak indicators)"  // literal at bundle.js:+12880678
    else:
        summaryLine = formatIndicators(indicators)

    // Column width: Math.max padding, formatted to 8 columns (bundle.js:+12880813)
    // Threshold comparison: 1 073 741 824 bytes (1 GiB) at bundle.js:+12881087

    return { memorySummary, summaryLine, indicators }
```

Analysis basis: CC v2.1.175 bundle.js:+12880157

---

### Diagnostic Context Collection (`DwA`)

Wraps `collectMemoryStats` and `generateHeapSnapshot`, resolves the output path, serialises the stats table, and calls `SH` (the structured error/output helper) to format rows.

```
async function runDiagnostics(context):
    memStats     = await collectMemoryStats()      // ozK, bundle.js:+12878713
    desktopPath  = resolveDesktopPath()            // FQA, bundle.js:+12878996
    snapshotFile = await generateHeapSnapshot(desktopPath)  // Aa7, bundle.js:+12879239

    // Stringify stats for the table (RH = JSON.stringify wrapper, bundle.js:+12879164)
    tableRows = formatStatsTable(memStats)         // K, bundle.js:+12878801

    // Platform branch for macOS-specific guidance
    if platform == "darwin":                       // literal at bundle.js:+12878244
        addPlatformNote(tableRows)

    // "auto-1.5GB" label for heap limit display  (literal at bundle.js:+12879356)
    // trigger mode: "manual", gc-count: 0         (literals at +12878676, +12878687)

    output = assembleOutput(tableRows, snapshotFile)
    logToConsole(output)                           // N (output writer), bundle.js:+12878759
    return output
```

Analysis basis: CC v2.1.175 bundle.js:+12878700

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_heap_dump` (bundle.js:+12879290); also reachable from call-graph depth-2: `tengu_daemon_control` (+16914553), `tengu_bg_dispatch_sigkill_escalate` (+16877366), `tengu_bg_dispatch_low_mem` (+16877967), `tengu_bg_spare_enable` (+16878671), `tengu_bg_spare_claim` (+16878799), `tengu_bg_spare_claim_fail` (+16879065), `tengu_scheduled_task_missed` (+16371033) |
| File written | `~/Desktop/claude-<timestamp>.heapsnapshot` (mode `0o600`, owner-read-write only) |
| GC triggered | `Bun.gc(true)` called after snapshot if Bun runtime is present (bundle.js:+12879795) |
| `/proc` reads | `/proc/self/fd` (fd count) and `/proc/self/smaps_rollup` (native RSS) on Linux; silently skipped elsewhere |
| appState changes | None observed in depth-2 traversal |
| Sound | None observed in depth-2 traversal |
| Hook registration | None observed in depth-2 traversal |
| Platform branches | `darwin` / `macos` labelled separately; Windows/WSL Desktop path via `/mnt/c/Users` scan |

---

## Version History

| Version | Change |
|---|---|
| v2.1.175 | Initial analysis |

---

## Common Mistakes

1. **Expecting output in the current directory** — the snapshot is always written to `~/Desktop` (or the WSL equivalent), never to `cwd`. If Desktop does not exist, the write will fail.
2. **Running on a non-Bun runtime without V8 heap access** — if neither `Bun.generateHeapSnapshot` nor the V8 arraybuffer path is available, the command will error; this is not a bug in the command invocation.
3. **Interpreting "native memory > heap" as a JS leak** — the diagnostic message explicitly attributes this to native addons (`node-pty`, `sharp`, etc.); the `.heapsnapshot` file will not contain native allocations.
4. **Opening the snapshot in a non-Chrome tool** — the output message specifically instructs loading the `.heapsnapshot` in Chrome DevTools → Memory → Load; other tools may not parse the format correctly.
5. **Invoking in a non-hidden command palette** — `isHidden: true` means this command does not appear in autocomplete; it must be typed exactly as `/heapdump`.
6. **Expecting a response in non-interactive mode** — `supportsNonInteractive: true` means the command executes without a TTY, but the result is still a plain-text block, not structured JSON.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `qa7` | Main async handler for `/heapdump` (entry point resolved via Arbor `module_id` path) |
| `DwA` | Diagnostic orchestrator — collects stats, resolves path, writes file, formats output |
| `ozK` | Memory statistics collector (`process.memoryUsage`, `v8.getHeapStatistics`, `/proc` reads) |
| `Ka7` | Leak indicator classifier and output formatter (column alignment, summary lines) |
| `Aa7` | Heap snapshot writer (`Bun.generateHeapSnapshot` / V8 arraybuffer + `writeFileSync`) |
| `FQA` | Desktop path resolver (cross-platform: macOS, Linux, Windows/WSL) |
| `h6` | Low-level filesystem or path utility (called from `DwA` and `ozK`) |
| `iG` | Sub-utility called from `h6` |
| `G` | Application shell / event dispatch root (large call fan-out; not heapdump-specific) |
| `N` | Console/output writer helper |
| `K` | Stats table row formatter (`padEnd` column alignment) |
| `SH` | Structured output/error formatter |
| `RH` | JSON serialisation wrapper (`JSON.stringify`) |
| `GA` | Error construction utility |
| `vM` | Output emit helper (used after snapshot write) |
| `d` | Generic utility called by `DwA` |
| `J9f` | Sub-logger or path utility called from `N` |
| `BvA` | Called from `J9f`; likely path/buffer helper |
| `nf` | String formatting/redaction helper |
| `WIA` | Array map helper for output formatting |
| `mgH` | Output write wrapper |
| `LIA` | Low-level write helper |
| `G9f` | File-append / log-rotation manager |
| `$gH` | Buffered output flusher (uses `setTimeout`, `setImmediate`) |
| `L4H` | Log file path assembler |
| `EIA` | Log directory path joiner |
| `je8` | Log file rotation helper (`stat`, `rename`, `unlink`) |
| `W9f` | Log file writer (`mkdir`, `appendFile`) |
| `l36` | Error classifier (checks `EISDIR`) |
| `u9` | Signal/handler registration utility |
| `o6` | Platform detection helper |
| `a6` | Utility called from `ozK` and `FQA` |
| `JL6` | Called from `Ka7`; formatting constant or helper |
| `ZyK` | Vim-mode operator: find |
| `qyK` | Vim-mode operator: yank |
| `MyK` | Vim-mode operator: visual replace |
| `zyK` | Vim-mode operator: visual case |
| `YyK` | Vim-mode operator: visual paste |
| `eIK` | Vim-mode operator: indent |
| `HyK` | Vim-mode operator: visual indent |
| `W2A` | Vim-mode operator dispatcher (many sub-operators) |
| `Pc` | Utility called from `G` |
| `j` | Process kill helper (iterates active processes) |
| `b` | Register/clipboard manager |
| `f` | Promise tracking set (add/delete/finally) |
| `D` | Daemon session manager (spawn, kill, memory check) |
| `H` | History search / random-delay helper |
| `P` | Stream buffer reader (Buffer.concat, indexOf, subarray) |
| `S` | Command executor (write to supervisor) |
| `X` | Timeout/formatting wrapper |
| `M` | Module cache/registry helper |
| `q` | Timer utility (`u1` sub-call) |
| `K6` | String coercion helper |
| `qq` | Queue helper |
| `QgA` | Queue entry formatter |
| `mxf` | Sliding-window queue (shift/push) |
| `L` | Stream close wrapper |
| `I` | Event handler sub-utility |
| `Y` | Forced-shutdown executor (`process.exit`, `z.abort`) |
| `T` | Key event preprocessor |
| `z` | Key-down dispatch / abort controller |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.