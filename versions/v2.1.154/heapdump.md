---
type: feature-spec
feature: "heapdump"
cc_version: "2.1.154"
updated: "2026-06-02"
tags: ["heapdump", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.154 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/heapdump`

> Analysis basis: CC v2.1.154 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.154

---

## Overview

`/heapdump` is a hidden diagnostic command that captures a full JS heap snapshot and a rich memory-usage report to `~/Desktop`. It collects V8 heap statistics, native-memory metrics, open file descriptors, Linux smaps, and process resource data, then writes a `.heapsnapshot` file (loadable in Chrome DevTools) alongside a human-readable text summary. The command is intended for developers diagnosing memory leaks in the Claude Code process itself.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `heapdump` |
| description | `Dump the JS heap to ~/Desktop` |
| supportsNonInteractive | `true` |
| isHidden | `true` |
| module_id | `qn1` |
| load_inline | `true` |
| loc_byte | `12288715` |
| loc_byte_end | `12289143` |
| loc_line | `9215` |
| arbor_handler.name | `m55` |
| arbor_handler.fqn | `claude-2.1.154::m55` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.154 bundle.js:+12288715

---

## Input Branching

The command has four or more distinct execution branches depending on runtime environment and memory profile, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/heapdump invoked"] --> B[collectMemoryStats via memoryStatsCollector]
    B --> C{Platform check}
    C -- "linux" --> D[Read /proc/self/fd\nRead /proc/self/smaps_rollup]
    C -- "other" --> E[Skip proc filesystem reads]
    D --> F[Aggregate V8 heap stats\nprocess.memoryUsage\nresourceUsage\nuptime\nheapSpaceStatistics]
    E --> F
    F --> G{Native > JS heap?}
    G -- "yes\n(native_ratio > 100)" --> H[Warn: native addon leak likely\ne.g. node-pty, sharp]
    G -- "no" --> I[No native leak indicator]
    H --> J[resolveDesktopPath via desktopPathResolver]
    I --> J
    J --> K{OS check for WSL/macOS}
    K -- "macOS / darwin" --> L[Use ~/Desktop directly]
    K -- "WSL detected\n(/mnt/c/Users present)" --> M[Resolve Windows Desktop path\nskip system accounts:\nPublic, Default, All Users]
    K -- "other linux" --> N[Use ~/Desktop fallback]
    L --> O[writeHeapSnapshot via heapSnapshotWriter]
    M --> O
    N --> O
    O --> P{Runtime engine}
    P -- "Bun runtime" --> Q[Bun.gc + Bun.generateHeapSnapshot\nwrite arraybuffer to file]
    P -- "Node/V8 runtime" --> R[Use V8 heap snapshot API\nwrite with mode 'v8'/'arraybuffer']
    Q --> S[Build text summary report\nfilemode 0o600 / decimal 384]
    R --> S
    S --> T{Memory ratio classification}
    T -- "JS heap dominant" --> U[Append: most memory is JS heap\n(inspect the .heapsnapshot)]
    T -- "native dominant" --> V[Append: most memory is native\n(NOT in the .heapsnapshot)]
    T -- "no obvious indicators" --> W[Append: no obvious leak indicators]
    U --> X[Write .txt report via logWriter\nEmit tengu_heap_dump telemetry]
    V --> X
    W --> X
    X --> Y[Return formatted summary lines\nto user via outputFormatter]
```

---

## Behavioral Spec

### Top-level handler (`m55`)

The Arbor-resolved handler is `m55` (an `AsyncFunction`), reached via `module_id → qn1`. It orchestrates the full dump sequence and builds the final output lines.

```
async function heapdumpHandler(context):
    lines = []
    lines.push("Open the .heapsnapshot in Chrome DevTools → Memory → Load to inspect retainers.")
    lines.push(... summary from heapDumpOrchestrator(context) ...)
    lines.push(... formatted table from outputFormatter(lines) ...)
    return lines.join("\n")
```

Analysis basis: CC v2.1.154 bundle.js:+12287584

### Output formatter (`p55`)

Builds a padded, aligned text table from the collected metric rows.

```
function outputFormatter(rows):
    maxWidth = Math.max(...row widths)
    for each row:
        pad row label to maxWidth using padEnd
        append formatted value column
    append H_6 separator line
    return formatted string
```

Analysis basis: CC v2.1.154 bundle.js:+12287703

### Heap dump orchestrator (`k6A`)

Collects all metrics, writes files, and returns structured lines.

```
async function heapDumpOrchestrator(context):
    stats    = await memoryStatsCollector()        // _n1
    desktop  = await desktopPathResolver()         // zVA
    filename = path.join(desktop, timestampedName) // N6A.join
    // Write heapsnapshot with filemode 384 (0o600)
    await fs.writeFile(filename, snapshotBuffer, { mode: 384 })
    // Serialize stats to JSON for the .txt report
    reportJson = JSON.stringify(stats)             // RH
    // Write bun or v8 heap snapshot
    await heapSnapshotWriter(filename)             // u55
    // Log errors if any via errorFormatter        // F_
    // Emit telemetry
    emit("tengu_heap_dump")                        // +12286836
    // Format and return display lines
    return buildSummaryLines(stats)                // hH
```

Analysis basis: CC v2.1.154 bundle.js:+12286246

### Memory stats collector (`_n1`)

Gathers all available memory telemetry from the Node/Bun process and the OS.

```
async function memoryStatsCollector():
    result = {}
    result.memoryUsage      = process.memoryUsage()
    result.heapStatistics   = v8.getHeapStatistics()        // Fk8.getHeapStatistics
    result.resourceUsage    = process.resourceUsage()
    result.uptime           = process.uptime()
    result.heapSpaces       = v8.getHeapSpaceStatistics()   // Fk8.getHeapSpaceStatistics
    result.activeHandles    = process._getActiveHandles().length
    result.activeRequests   = process._getActiveRequests().length

    // Linux-only: open file descriptors
    if platform allows:
        fdList = await fs.readdir("/proc/self/fd")          // +12283990
        result.openFdCount = fdList.length

    // Linux-only: smaps_rollup for native RSS
    if platform allows:
        smaps = await fs.readFile("/proc/self/smaps_rollup", "utf8")  // +12284053
        result.smaps = parseSmaps(smaps)

    // Load bun:jsc module for JSC-specific stats if available  // +12284138
    // Compute native ratio:  (rss - heapUsed) / 1 MB
    // threshold: 3600 seconds uptime window, 1048576 bytes per MB  // +12284279, +12284284
    // If native exceeds JS heap by >100%:                         // +12284431
    //   warn "Native memory > heap - leak may be in native addons (node-pty, sharp, etc.)"  // +12284517
    result.nativeRatio = (rss - heapUsed).toFixed(2)              // X.toFixed +12284640

    return result
```

Analysis basis: CC v2.1.154 bundle.js:+12286259

### Desktop path resolver (`zVA`)

Determines the correct Desktop folder across macOS, WSL, and plain Linux.

```
async function desktopPathResolver():
    home = os.homedir()                            // wi8.homedir +1014948
    defaultDesktop = path.join(home, "Desktop")   // o5.join +1014984 literal "Desktop" +1014994

    if platform is "macos" or "darwin":            // +12285371, +12285790
        return defaultDesktop

    // WSL detection: check /mnt/c/Users           // +1015216
    wslBase = "/mnt/c/Users"
    if wslBase exists:
        candidates = readdir(wslBase)
        // Exclude system accounts                 // literals +1015260, +1015279, +1015299, +1015324
        exclude = ["Public", "Default", "Default User", "All Users"]
        userDir = candidates.filter(d => !exclude.includes(d))[0]
        if userDir:
            return path.join(wslBase, userDir, "Desktop")
            // replace path separators as needed   // q.replace +1015124

    return defaultDesktop
```

Analysis basis: CC v2.1.154 bundle.js:+12286542

### Heap snapshot writer (`u55`)

Writes the actual binary heap snapshot, branching on runtime engine.

```
async function heapSnapshotWriter(outputPath):
    if runtime is Bun:
        Bun.gc(true)                                       // Bun.gc +12287341
        snapshot = Bun.generateHeapSnapshot()              // +12287284
        fs.writeFileSync(outputPath, snapshot, "arraybuffer")  // Hn1.writeFileSync +12287264
    else:
        // V8 path
        // Uses mode string "v8" and format "arraybuffer"  // +12287309, +12287314
        writeV8HeapSnapshot(outputPath)
```

Analysis basis: CC v2.1.154 bundle.js:+12286785

### Summary line builder (`p55` + `m55` join)

After collecting stats, the handler constructs a multi-line text report comparing JS heap vs. native memory usage.

```
function buildSummaryLines(stats):
    lines = []
    lines.push("Open the .heapsnapshot in Chrome DevTools → Memory → Load to inspect retainers.")
    // +12287740

    nativeRatio = (stats.rss - stats.heapUsed) / 1073741824   // 1 GiB divisor +12288633
    // threshold at 8 decimal places                           // +12288359

    if jsHeapDominant(stats):
        lines.push("— most memory is JS heap (inspect the .heapsnapshot)")  // +12288027
    else if nativeDominant(stats):
        lines.push("— most memory is native (NOT in the .heapsnapshot)")    // +12288087
    else:
        lines.push("  (no obvious leak indicators)")                         // +12288224

    lines.push(outputFormatter(metricRows))   // p55 → H_6 separator
    return lines
```

Analysis basis: CC v2.1.154 bundle.js:+12287852

### File write permissions and path joining

The heap snapshot file is written with octal mode `0o600` (decimal `384`) to protect sensitive memory contents from other users.

```
fileOptions = { mode: 384 }   // +12286729
path = path.join(desktopDir, timestampedFilename)   // N6A.join +12286651
await fs.writeFile(path, buffer, fileOptions)        // e86.writeFile +12286694
```

Analysis basis: CC v2.1.154 bundle.js:+12286694

### Debug log writer (`gRK` / logging pipeline)

The command triggers the standard structured log writer with level `"debug"` (literal `+203706`) and mode `"manual"` (literal `+12286222`), with initial log index `0` (literal `+12286233`). The log pipeline involves directory creation, append-file rotation, and file rename for atomicity.

```
function writeDebugLog(content, options):
    dir = path.dirname(logPath)          // X0H.dirname
    fs.mkdir(dir, recursive)             // uI.mkdir
    fs.appendFile(logPath, content)      // uI.appendFile
    if file exceeds rotation threshold:
        fs.rename(logPath, rotatedPath)  // uI.rename + izA
        fs.unlink(old)                   // uI.unlink
```

Analysis basis: CC v2.1.154 bundle.js:+203218

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_heap_dump` (+12286836); also in call graph scope: `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop`, `tengu_bg_attach_legacy_autorespawn`, `tengu_bg_attach`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_stall_respawn`, `tengu_bg_attach_kick` |
| Heap snapshot file | Written to `~/Desktop/<timestamp>.heapsnapshot` with mode `0o600` (384 decimal) |
| Text report | Written alongside the snapshot as a `.txt` file via the log writer pipeline |
| Bun GC | `Bun.gc(true)` called before snapshot on Bun runtime to force a collection cycle |
| File system reads | `/proc/self/fd` directory listing and `/proc/self/smaps_rollup` read on Linux |
| Active handles/requests | `process._getActiveHandles()` and `process._getActiveRequests()` called (internal Node.js APIs) |
| appState changes | None detected in depth-2 traversal |
| Sound | None detected |
| Hook registration | `f$A.register` called via `_9` in the logging pipeline (+58450); no command-specific hook |

---

## Version History

| Version | Change |
|---|---|
| v2.1.154 | Initial analysis |

---

## Common Mistakes

1. **Expecting output on a non-Desktop path**: The command always writes to `~/Desktop` (or the WSL Windows Desktop). If the Desktop folder does not exist, the write will fail. Create `~/Desktop` manually on headless Linux systems.
2. **Running on a system without `/proc`**: The smaps and fd-count metrics are silently skipped on non-Linux platforms; this is expected behavior and does not indicate an error.
3. **Confusing native vs. JS heap classification**: The native-leak warning fires when `(rss − heapUsed) > heapUsed` by more than 100% of the heap (+12284431). A warning about `node-pty` or `sharp` does not mean the `.heapsnapshot` is useless — it means the leak may be outside V8's visibility.
4. **Opening the file as plain JSON**: Chrome DevTools expects the `.heapsnapshot` extension specifically in the **Memory → Load** panel. Renaming the file breaks the DevTools loader.
5. **Forgetting the command is hidden**: `/heapdump` does not appear in `/help` output (`isHidden: true`). It must be typed in full.
6. **Assuming Bun and Node produce identical snapshots**: The Bun path calls `Bun.generateHeapSnapshot()` and forces a GC; the Node path uses the V8 streaming API. The resulting file formats are compatible with Chrome DevTools but may differ in internal structure.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `m55` | Top-level async handler for `/heapdump` (Arbor-resolved entry point) |
| `k6A` | Heap dump orchestrator — collects stats, resolves path, writes files, emits telemetry |
| `k6` | Shared utility / logger initializer called by orchestrator and stats collector |
| `ov` | Sub-utility called by `k6` |
| `_n1` | Memory stats collector — calls process/v8/bun APIs and reads proc filesystem |
| `G` | Shared formatter or result combiner called by stats collector |
| `nV6` | Sub-helper of `G` |
| `Vb8` | Sub-helper of `G` and connection manager |
| `P` | MCP/connection pipeline manager (also reached by stats collector) |
| `hH` | Summary line builder / error presenter called by orchestrator |
| `F_` | Error formatter / exception stringifier |
| `X` | Subprocess I/O handler (streams, buffer concat) |
| `J` | Buffer/stream index tracker |
| `w` | Subprocess / background session manager |
| `xf` | Stream end / RH flush helper |
| `lU5` | Background session message dispatcher (large fanout) |
| `ZH` | String coercion utility |
| `N` | Structured log writer (writes debug-level log entries) |
| `URK` | Log entry constructor |
| `$$A` | Log metadata builder |
| `H` | Random / timeout utility (also appears as map/set wrapper in different contexts) |
| `RH` | JSON serializer (`JSON.stringify` wrapper) |
| `_` | String utility (uppercase, trim operations) |
| `v4` | Path manipulation utility (slice, lastIndexOf, replace) |
| `FzA` | Character-map helper for path encoding |
| `q` | File cleanup / unlink tracker |
| `A` | Lowercase / case-normalisation helper |
| `HuH` | Stream write wrapper |
| `yzA` | Underlying write dispatcher |
| `gRK` | Rotating log file writer (mkdir + appendFile + rename pipeline) |
| `kxH` | Log flush / coalesce scheduler (uses setTimeout + setImmediate) |
| `cMH` | Log chunk assembler |
| `B6` | Shared async utility (awaitable) |
| `B16` | Log segment ID generator |
| `rzA` | Log file path builder (`path.join` wrapper) |
| `izA` | Log file rotation handler (stat + rename + unlink) |
| `FRK` | Bound log-write function (mkdir + appendFile + rotate) |
| `_9` | Hook registrar (`f$A.register`) |
| `K` | Metric row formatter (`padEnd` table builder) |
| `L` | Async task queue with `add` / `delete` / `finally` tracking |
| `f` | Closeable resource wrapper (`close` + queue cleanup) |
| `zVA` | Desktop path resolver (macOS / WSL / Linux) |
| `u55` | Heap snapshot writer (Bun vs. V8 branch) |
| `c` | Context / cancellation token |
| `Wz` | Shared wait/settle utility |
| `p55` | Output formatter — pads metric rows and appends separator |
| `H_6` | Table separator / divider line constant |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.