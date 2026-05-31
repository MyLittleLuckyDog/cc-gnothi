---
type: feature-spec
feature: "heapdump"
cc_version: "2.1.139"
updated: "2026-05-31"
tags: ["heapdump", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.139 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/heapdump`

> Analysis basis: CC v2.1.139 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.139

---

## Overview

`/heapdump` is a hidden, non-interactive diagnostic command that captures a JavaScript heap snapshot of the running Claude Code process and writes it to the user's Desktop directory. It also collects a rich memory-usage summary (heap stats, native memory, open file descriptors, smaps rollup) and appends a human-readable diagnostic report alongside the `.heapsnapshot` file, annotating it with heuristic leak indicators.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `heapdump` |
| description | `Dump the JS heap to ~/Desktop` |
| supportsNonInteractive | `true` |
| isHidden | `true` |
| module_id | `ZJq` |
| load_inline | `true` |
| loc_byte | `11392236` |
| loc_byte_end | `11392399` |
| loc_line | `7121` |
| arbor_handler.name | `G07` |
| arbor_handler.fqn | `claude-2.1.139::G07` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.139 bundle.js:+11392236

---

## Input Branching

The command has 4+ distinct execution branches based on runtime environment, memory ratios, and Bun vs V8 runtime availability. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A[/heapdump invoked/] --> B[collectMemorySnapshot]
    B --> C[Read process.memoryUsage]
    B --> D[Read v8.getHeapStatistics]
    B --> E[Read process.resourceUsage]
    B --> F[Read process.uptime]
    B --> G[Read v8.getHeapSpaceStatistics]
    B --> H{Platform check}
    H -- linux --> I[Read /proc/self/fd directory]
    I --> J[Read /proc/self/smaps_rollup UTF-8]
    H -- other --> K[Skip proc filesystem reads]
    B --> L[Compute nativeMemoryMB = rss - heapUsed / 1048576]
    L --> M{nativeMemoryMB > 100?}
    M -- yes --> N[Append native leak warning]
    M -- no --> O[No native leak warning]
    N --> P[resolveDesktopPath]
    O --> P
    P --> Q{Platform}
    Q -- darwin/linux --> R[os.homedir + Desktop]
    Q -- WSL / Windows --> S[/mnt/c/Users search, fallback Public/Desktop]
    R --> T[writeHeapSnapshotFile]
    S --> T
    T --> U{Runtime check}
    U -- Bun available --> V[Bun.generateHeapSnapshot arraybuffer format]
    U -- V8 / Node --> W[writeFileSync with v8 heap snapshot format]
    V --> X[Write .heapsnapshot file mode 0o600]
    W --> X
    X --> Y[buildDiagnosticReport via formatSummaryTable]
    Y --> Z{nativeRatio branch}
    Z -- native dominant --> AA[Append: most memory is native NOT in heapsnapshot]
    Z -- heap dominant --> AB[Append: most memory is JS heap inspect the .heapsnapshot]
    Z -- no obvious indicators --> AC[Append: no obvious leak indicators]
    AA --> AD[emit telemetry tengu_heap_dump]
    AB --> AD
    AC --> AD
    AD --> AE[Return text result to user]
```

---

## Behavioral Spec

### 1. Top-Level Handler (`G07`)

The Arbor-resolved handler `G07` is an `AsyncFunction` that orchestrates two sequential sub-operations and then assembles the final user-facing text output.

```
async function heapdumpHandler(commandContext):
    snapshotResult = await collectAndWriteHeapDump(commandContext)
    summaryTable  = await buildSummaryTable(snapshotResult)

    lines = []
    lines.push("Open the .heapsnapshot in Chrome DevTools → Memory → Load to inspect retainers.")
    lines.push(summaryTable)
    lines.push(snapshotResult.diagnosticNotes.join("\n"))

    emit telemetry event "tengu_heap_dump"
    return { type: "text", content: lines.join("\n") }
```

Analysis basis: CC v2.1.139 bundle.js:+11391105

---

### 2. Memory Snapshot Collection (`X07`)

`X07` gathers all raw memory metrics from Node/Bun APIs, conditionally reads Linux-specific proc filesystem data, and computes derived ratios.

```
async function collectMemoryMetrics():
    mem        = process.memoryUsage()        // rss, heapUsed, heapTotal, external
    heapStats  = v8Module.getHeapStatistics()
    resUsage   = process.resourceUsage()
    uptime     = process.uptime()
    heapSpaces = v8Module.getHeapSpaceStatistics()
    activeHandles   = process._getActiveHandles().length
    activeRequests  = process._getActiveRequests().length

    fdCount     = null
    smapsRollup = null
    if platform is linux:
        fdEntries   = await fs.readdir("/proc/self/fd")   // +11387580
        fdCount     = fdEntries.length
        smapsRollup = await fs.readFile("/proc/self/smaps_rollup", "utf8")  // +11387655

    // Import bun:jsc module for additional Bun-specific heap info if available
    jscModule = tryRequire("bun:jsc")   // +11387740

    rssMB      = mem.rss / 1048576                          // 1048576 constant +11387886
    heapUsedMB = mem.heapUsed / 1048576
    nativeMB   = rssMB - heapUsedMB

    leakWarnings = []
    if nativeMB > 100:                                      // threshold 100 +11388033
        leakWarnings.push(
            "Native memory > heap - leak may be in native addons (node-pty, sharp, etc.)"
            // +11388119
        )

    fragmentationPct = ((heapStats.heap_size_limit - heapStats.used_heap_size)
                        / heapStats.heap_size_limit * 100).toFixed(2)   // +11388242

    return { mem, heapStats, resUsage, uptime, heapSpaces,
             activeHandles, activeRequests, fdCount, smapsRollup,
             rssMB, heapUsedMB, nativeMB, leakWarnings, fragmentationPct }
```

Analysis basis: CC v2.1.139 bundle.js:+11387349

---

### 3. Desktop Path Resolution (`E5A`)

`E5A` resolves the target directory where the `.heapsnapshot` and report files are written. It handles macOS/Linux natively and uses a heuristic scan under WSL/Windows.

```
async function resolveDesktopPath():
    home = os.homedir()                     // zC8.homedir +989785
    candidate = path.join(home, "Desktop")  // "Desktop" literal +989831

    if candidate exists:
        return candidate

    // WSL / Windows fallback: scan /mnt/c/Users
    usersRoot = "/mnt/c/Users"              // +990053
    entries   = listDir(usersRoot)
    // Skip system accounts: Public, Default, Default User, All Users  +990097–990161
    userDirs  = entries.filter(e => !SYSTEM_ACCOUNTS.includes(e))
    for dir in userDirs:
        candidate2 = path.join(usersRoot, dir, "Desktop")
        if candidate2 exists:
            return candidate2

    // Ultimate fallback: write to home directory
    return home
```

Analysis basis: CC v2.1.139 bundle.js:+989785

---

### 4. Heap Snapshot Write (`W07`)

`W07` generates the actual heap snapshot, choosing the Bun API when available and falling back to a V8-compatible approach otherwise.

```
async function writeHeapSnapshot(destDir, timestamp):
    filename = path.join(destDir, `claude-heapdump-${timestamp}.heapsnapshot`)

    if typeof Bun !== "undefined":
        // Bun path
        snapshot = Bun.generateHeapSnapshot("v8", "arraybuffer")  // +11390805, +11390830, +11390835
        Bun.gc(true)                                               // +11390862
        fs.writeFileSync(filename, Buffer.from(snapshot))
    else:
        // Node/V8 path — uses writeHeapSnapshot from v8 module
        fs.writeFileSync(filename, generateV8HeapSnapshot())       // +11390785

    // File mode 0o600 (384 decimal)                               // 384 +11390331
    chmod(filename, 0o600)
    return filename
```

Analysis basis: CC v2.1.139 bundle.js:+11390785

---

### 5. Heap Dump Orchestrator (`TJq`)

`TJq` ties together metric collection, path resolution, file writing, and report generation. It calls `collectMemoryMetrics` (`X07`), `resolveDesktopPath` (`E5A`), `writeHeapSnapshot` (`W07`), and then formats the output.

```
async function heapDumpOrchestrator():
    metrics     = await collectMemoryMetrics()     // X07
    desktopPath = await resolveDesktopPath()       // E5A
    snapshotFile = await writeHeapSnapshot(desktopPath, Date.now())   // W07

    // Build the report JSON and write alongside snapshot
    reportData = buildReportObject(metrics)
    reportJson = JSON.stringify(reportData)         // yH +11390312
    reportFile = snapshotFile.replace(".heapsnapshot", "-report.json")
    await fs.writeFile(reportFile, reportJson, { mode: 0o600 })  // XoH.writeFile +11390296

    // Emit heap_dump telemetry marker
    // (tengu_heap_dump fired in G07 after this returns)

    diagnosticNotes = compileDiagnosticNotes(metrics)
    return { snapshotFile, reportFile, metrics, diagnosticNotes }
```

Analysis basis: CC v2.1.139 bundle.js:+11389848

---

### 6. Summary Table Builder (`T07`)

`T07` produces a padded text table of memory metrics for display to the user.

```
function buildSummaryTable(metrics):
    rows = [
        ["RSS",          formatMB(metrics.rssMB)],
        ["Heap Used",    formatMB(metrics.heapUsedMB)],
        ["Heap Total",   formatMB(metrics.mem.heapTotal / 1048576)],
        ["Native",       formatMB(metrics.nativeMB)],
        ["External",     formatMB(metrics.mem.external / 1048576)],
        ["Uptime",       metrics.uptime + "s"],
        ["Active Handles", metrics.activeHandles],
        ["Active Reqs",  metrics.activeRequests],
    ]

    columnWidth = max(rows.map(r => r[0].length)) + 2   // Math.max +11391480
    output = rows.map(r => r[0].padEnd(columnWidth, " ") + r[1])
    return output.join("\n")
```

Analysis basis: CC v2.1.139 bundle.js:+11391480

---

### 7. Diagnostic Notes Compiler

Based on memory ratios the command appends one of three heuristic annotations:

```
function compileDiagnosticNotes(metrics):
    notes = []
    nativeRatio = metrics.nativeMB / metrics.rssMB

    if nativeRatio is dominant (native >> heap):
        notes.push("— most memory is native (NOT in the .heapsnapshot)")  // +11391608
    elif heap is dominant:
        notes.push("— most memory is JS heap (inspect the .heapsnapshot)")  // +11391548
    else:
        notes.push("  (no obvious leak indicators)")  // +11391745

    // Threshold: 1 GB = 1073741824 bytes                          // +11392154
    if metrics.mem.rss > 1073741824:
        notes.push("WARNING: RSS exceeds 1 GB")

    return notes
```

Analysis basis: CC v2.1.139 bundle.js:+11391548

---

### 8. Process-Level Memory Context (Startup)

The `auto-1.5GB` literal (`+11390504`) indicates that heap limit management (likely `--max-old-space-size`) is applied automatically during the command's setup phase before snapshotting begins.

Analysis basis: CC v2.1.139 bundle.js:+11390504

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_heap_dump` (fired once per invocation, +11390438) |
| File writes | `.heapsnapshot` file written to `~/Desktop` (or WSL Desktop) with mode `0o600` (384 decimal) |
| File writes | Companion `-report.json` written alongside the snapshot |
| Bun GC | `Bun.gc(true)` called after `Bun.generateHeapSnapshot` when running under Bun runtime (+11390862) |
| appState changes | None detected in depth-2 traversal |
| Sound | None detected in depth-2 traversal |
| Hook registration | None detected in depth-2 traversal |
| Platform detection | `process.platform === "darwin"` literal (+11389392); `"macos"` (+11388973); `"linux"` implicit via `/proc/self/fd` read |
| Proc filesystem reads (Linux only) | `/proc/self/fd` directory listing (+11387580); `/proc/self/smaps_rollup` UTF-8 read (+11387655) |
| Native leak heuristic | Warning emitted when native memory exceeds 100 MB above heap (+11388033, +11388119) |
| 1 GB RSS threshold | Diagnostic note emitted when RSS > 1 073 741 824 bytes (+11392154) |
| Log format guidance | Output includes reference to Chrome DevTools → Memory → Load workflow (+11391261) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.139 | Initial analysis |

---

## Common Mistakes

1. **Expecting visible output in the UI:** `/heapdump` is `isHidden: true` and is not shown in the slash-command picker. It must be typed manually.
2. **Running on a system without a Desktop folder:** On headless Linux servers `~/Desktop` does not exist and no WSL path will match, so the snapshot falls back to the home directory. Check the printed path in the command's text response.
3. **Assuming the snapshot is unprotected:** Both the `.heapsnapshot` and companion report are written with mode `0o600` — only the owning user can read them. Running the command as root in a shared environment still exposes potentially sensitive heap data to root.
4. **Interpreting the native-memory warning as definitive:** The heuristic fires whenever native memory exceeds 100 MB. Normal node-pty or sharp usage can trigger it without an actual leak.
5. **Opening the report JSON instead of the snapshot:** Memory structure inspection requires the `.heapsnapshot` file opened in Chrome DevTools → Memory → Load, not the companion `-report.json` text report.
6. **Expecting Bun-specific stats on Node.js:** The `bun:jsc` module is attempted at runtime (+11387740); when absent (pure Node.js), those additional heap-space statistics are silently omitted.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `G07` | Top-level async handler for `/heapdump` (Arbor-resolved entry point) |
| `TJq` | Heap dump orchestrator — calls metric collector, path resolver, file writer, and report builder |
| `X07` | Memory metrics collector — gathers `process.memoryUsage`, `v8` stats, proc filesystem data |
| `E5A` | Desktop path resolver — handles macOS/Linux home and WSL/Windows `/mnt/c/Users` fallback |
| `W07` | Heap snapshot writer — branches on Bun vs V8 runtime, writes `.heapsnapshot` |
| `T07` | Summary table formatter — builds padded text table of memory metrics |
| `V6` | Utility / formatting helper called by orchestrator and metric collector |
| `N` | HTTP/transport layer helper (called from orchestrator; carries debug-level log flag) |
| `y9K` | Sub-helper within transport layer |
| `Xo_` | Sub-helper within transport layer |
| `LM` | String path manipulation utility |
| `os_` | Path mapping helper (used by `LM`) |
| `QyH` | Write-to-stream helper |
| `ms_` | Low-level stream write wrapper |
| `R9K` | File-append / log rotation helper (called by transport layer) |
| `JyH` | Timeout-managed write dispatcher |
| `n6H` | Log entry formatter |
| `B6` | Generic async utility / promise wrapper |
| `IV8` | Error wrapper (raises `EISDIR`-type errors) |
| `qt_` | Path join helper with fs-check |
| `At_` | File rename/rotate helper (handles `.txt` extension, `eI.rename`, `eI.unlink`) |
| `S9K` | Append-file-with-rotation handler |
| `C9` | Active-set manager (`$Z8.add`, `$Z8.delete`, `Object.assign`) |
| `K` | Table column padding helper (`padEnd`) |
| `L` | Resource lifecycle manager (`q.add`, `f.finally`, `q.delete`) |
| `q` | Temp-file tracker (`Aaq.unlinkSync` on cleanup) |
| `f` | File-handle finalizer (`A.close`, `q.close`) |
| `Q` | General queue/state object referenced by orchestrator |
| `G` | Shared utility (calls `NP6`, `U08`) |
| `NP6` | Sub-utility called by `G` |
| `U08` | Sub-utility called by `G` and `X` |
| `X` | Connection/pool manager (`Promise.all`, `rqH`, `ql`, `LH`) |
| `LH` | Connection lifecycle helper (`q_`, `SH`, `S1`, `CGK`, `RSH.push`, `Jd.logError`) |
| `q_` | Error factory (wraps `Error`, `String`) |
| `P` | IPC/socket protocol handler (`Buffer.concat`, `j.indexOf`, `w.off`, `kf`, `IH`) |
| `j` | Buffer accumulator for protocol handler |
| `w` | Background session/worker manager (`Ip.spawn`, `S.kill`, `A.get/set/values`) |
| `kf` | Connection teardown helper (`H.end`, `yH`) |
| `ht7` | Full background session protocol dispatcher (ping/nudge/yield/lease/kill/resize/attach) |
| `IH` | String coercion utility |
| `H` | Random back-off / timer helper (`Math.random`, `setTimeout`) |
| `yH` | JSON serializer (`JSON.stringify`) |
| `_` | Accumulator array in top-level handler (`_.push`, `_.join`) |
| `A` | Map/collection used by session manager and path utilities |
| `WoH` | Output renderer called by `T07` |
| `reH` | Sub-utility called by `N` |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.