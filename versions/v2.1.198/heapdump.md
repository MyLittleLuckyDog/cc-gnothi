---
type: feature-spec
feature: "heapdump"
cc_version: "2.1.198"
updated: "2026-07-02"
tags: ["heapdump", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.198 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/heapdump`

> Analysis basis: CC v2.1.198 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.198

---

## Overview

`/heapdump` is a hidden diagnostic slash command that captures a V8/Bun heap snapshot and writes it to the user's Desktop directory (`~/Desktop`). It also collects comprehensive memory diagnostics (heap statistics, resource usage, file-descriptor counts, smaps) and assembles a human-readable analysis report that classifies whether the dominant memory usage is JS heap or native memory, and flags potential leak indicators. The command is intended for developer/support use and does not appear in the normal command listing.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `heapdump` |
| description | `Dump the JS heap to ~/Desktop` |
| supportsNonInteractive | `true` |
| isHidden | `true` |
| module_id | `ooc` |
| load_inline | `true` |
| loc_byte | `13098844` |
| loc_byte_end | `13099272` |
| loc_line | `8981` |
| arbor_handler.name | `nnm` |
| arbor_handler.fqn | `claude-2.1.198::nnm` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.198 bundle.js:+13098844

---

## Input Branching

The command has 3+ distinct execution branches based on runtime environment detection (Bun vs Node/V8), platform (macOS/Linux/Windows), and memory profile classification (JS-heap-dominant vs native-dominant vs no obvious indicator). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/heapdump invoked"] --> B[Collect memory diagnostics\ncollectMemoryDiagnostics]
    B --> C{Runtime: Bun available?}
    C -- Yes --> D[generateHeapSnapshot via Bun.generateHeapSnapshot\nBun.gc to trigger GC first]
    C -- No --> E[Generate V8 heap snapshot\nusing v8 / arraybuffer strategy]
    D --> F[Resolve Desktop output path\nresolveDesktopPath]
    E --> F
    F --> G{Platform detection}
    G -- darwin/macOS --> H[~/Desktop path]
    G -- Windows / WSL --> I[/mnt/c/Users/.../Desktop path\nor fallback Public/Default]
    G -- other --> J[homedir + Desktop]
    H --> K[Write .heapsnapshot file\npIt.writeFile, mode 0o600=384]
    I --> K
    J --> K
    K --> L[Classify memory profile\nclassifyMemory]
    L --> M{Native RSS >> heap used?}
    M -- Yes --> N["'Native memory > heap - leak may be in\nnative addons (node-pty, sharp, etc.)'"]
    M -- No --> O{JS heap dominant?}
    O -- Yes --> P["'most memory is JS heap\n(inspect the .heapsnapshot)'"]
    O -- No --> Q["'most memory is native\n(NOT in the .heapsnapshot)'"]
    Q --> R{No obvious leak indicators?}
    R -- Yes --> S["'no obvious leak indicators'"]
    R -- No --> T[Other indicator text]
    N --> U[Build text report\nbuildReport]
    P --> U
    S --> U
    T --> U
    U --> V[Emit report with\nOpen the .heapsnapshot in Chrome DevTools hint]
    V --> W[Emit telemetry: tengu_heap_dump]
    W --> X[Return result to UI]
```

---

## Behavioral Spec

### Top-Level Handler (`nnm` → `heapDumpHandler`)

The async function `nnm` (resolved via Arbor as `claude-2.1.198::nnm`) is the command's main entry point.

```
async function heapDumpHandler(context):
    lines = []
    dumpResult = await performDump(context)        // pjo
    report = buildReport(dumpResult)               // rnm
    lines.push(report)
    lines.push("Open the .heapsnapshot in Chrome DevTools → Memory → Load to inspect retainers.")
    return lines.join("\n")
```

Analysis basis: CC v2.1.198 bundle.js:+13097713, +13097832, +13097859, +13097981

---

### Heap Snapshot Writer (`pjo` → `performDump`)

`performDump` orchestrates path resolution, diagnostics collection, snapshot generation, file writing, memory classification, and telemetry emission.

```
async function performDump(context):
    // Step 1 — collect memory statistics
    stats = collectMemoryDiagnostics()             // noc

    // Step 2 — resolve Desktop output path
    outputPath = resolveDesktopPath()              // tLs
    snapshotFilename = buildSnapshotFilename()     // djo.join
    fullPath = path.join(outputPath, snapshotFilename)

    // Step 3 — generate heap snapshot
    if runtime is Bun:
        generateBunSnapshot(fullPath)              // tnm
    else:
        generateV8Snapshot(fullPath)               // implicit via V8 module

    // Step 4 — write snapshot file
    await fs.writeFile(fullPath, snapshotData, { mode: 384 })   // 0o600
    
    // Step 5 — JSON-encode and write diagnostics
    await fs.writeFile(diagPath, JSON.stringify(stats), mode 384)
    
    // Step 6 — classify memory profile
    classification = classifyMemory(stats)
    
    // Step 7 — emit telemetry
    emitTelemetry("tengu_heap_dump")               // V

    // Step 8 — error handling
    on error:
        logError(error)                            // Re / Zd
    
    return { fullPath, stats, classification }
```

Analysis basis: CC v2.1.198 bundle.js:+13096375, +13096671, +13096780, +13096823, +13096858, +13096914, +13096963, +13097134, +13097143, +13097221

File write mode is decimal `384` = octal `0o600` (owner read/write only).
Analysis basis: CC v2.1.198 bundle.js:+13096858

---

### Memory Diagnostics Collector (`noc` → `collectMemoryDiagnostics`)

Gathers a broad set of runtime memory signals from multiple OS and runtime APIs.

```
function collectMemoryDiagnostics():
    result = {}

    // JS heap from Node/Bun runtime
    result.memoryUsage = process.memoryUsage()

    // V8 heap statistics (total heap, used heap, external, etc.)
    result.heapStats = v8.getHeapStatistics()

    // OS-level resource usage (maxRSS, etc.)
    result.resourceUsage = process.resourceUsage()

    // Process uptime in seconds
    result.uptime = process.uptime()

    // Per-heap-space breakdown (new space, old space, code space, etc.)
    result.heapSpaceStats = v8.getHeapSpaceStatistics()

    // Active handle count (sockets, timers, etc.)
    result.activeHandles = process._getActiveHandles().length

    // Active request count (I/O requests in flight)
    result.activeRequests = process._getActiveRequests().length

    // File descriptor count via /proc/self/fd (Linux)
    try:
        fdEntries = await fs.readdir("/proc/self/fd")
        result.fdCount = fdEntries.length
    except:
        result.fdCount = null

    // Native memory breakdown via /proc/self/smaps_rollup (Linux)
    try:
        smaps = await fs.readFile("/proc/self/smaps_rollup", "utf8")
        result.smaps = parseSmaps(smaps)
    except:
        result.smaps = null

    // Bun JSC heap stats (if available via "bun:jsc" module)
    if runtime is Bun:
        result.jscStats = require("bun:jsc").getHeapStatistics()

    // Uptime in hours (3600 seconds / hour)
    result.uptimeHours = result.uptime / 3600

    // Memory in MB (1048576 bytes / MB)
    result.heapUsedMB = result.memoryUsage.heapUsed / 1048576

    return result
```

Constants:
- Seconds per hour: `3600` (bundle.js:+13094408)
- Bytes per MB: `1048576` (bundle.js:+13094413)
- `/proc/self/fd` path (bundle.js:+13094119)
- `/proc/self/smaps_rollup` path (bundle.js:+13094182)
- Encoding `"utf8"` (bundle.js:+13094208)
- Bun JSC module: `"bun:jsc"` (bundle.js:+13094267)

Analysis basis: CC v2.1.198 bundle.js:+13093876, +13093900, +13093926, +13093952, +13093977, +13094019, +13094056, +13094107, +13094169, +13094280

---

### Desktop Path Resolver (`tLs` → `resolveDesktopPath`)

Determines the correct Desktop directory across platforms.

```
function resolveDesktopPath():
    home = os.homedir()                   // VDr.homedir

    if platform == "windows":
        // WSL / Windows interop path
        // Scans /mnt/c/Users/* excluding "Public", "Default", "Default User", "All Users"
        candidates = listDir("/mnt/c/Users")
        for user in candidates:
            if user not in ["Public", "Default", "Default User", "All Users"]:
                return path.join("/mnt/c/Users", user, "Desktop")
    
    if platform == "darwin" or "macos":
        return path.join(home, "Desktop")   // Kc.join

    // Fallback: all platforms
    return path.join(home, "Desktop")
```

Literals observed:
- `"Desktop"` (bundle.js:+1118519)
- `"windows"` (bundle.js:+1118537)
- `"/mnt/c/Users"` (bundle.js:+1118741)
- `"Public"` (bundle.js:+1118785)
- `"Default"` (bundle.js:+1118804)
- `"Default User"` (bundle.js:+1118824)
- `"All Users"` (bundle.js:+1118849)
- `"darwin"` (bundle.js:+13095919)
- `"macos"` (bundle.js:+13095500)

Analysis basis: CC v2.1.198 bundle.js:+1118466, +1118473, +1118509, +1118649, +1118686, +1118958

---

### Bun Snapshot Generator (`tnm` → `generateBunSnapshot`)

When running under the Bun runtime, uses Bun-native APIs to produce a heap snapshot.

```
function generateBunSnapshot(outputPath):
    // Write a preliminary marker file (synchronous)
    fs.writeFileSync(outputPath + ".tmp", ...)    // toc.writeFileSync

    // Generate heap snapshot in Bun format
    snapshot = Bun.generateHeapSnapshot()         // Bun.generateHeapSnapshot

    // Force garbage collection before snapshot
    Bun.gc(/* aggressive= */ true)                // Bun.gc

    // Write final snapshot
    // Format selection: "v8" / "arraybuffer" mode observed
    // "v8" literal: bundle.js:+13097438
    // "arraybuffer" literal: bundle.js:+13097443
    writeSnapshotData(snapshot, outputPath)
```

Analysis basis: CC v2.1.198 bundle.js:+13097393, +13097413, +13097470, +13097438, +13097443

---

### Memory Profile Classifier (`rnm` → `buildReport`)

Produces the human-readable text report shown to the user after the dump completes.

```
function buildReport(dumpResult):
    lines = []
    { stats, fullPath, classification } = dumpResult

    // Compute native vs JS heap ratio
    nativeMemMB = stats.resourceUsage.maxRSS / 1048576
    heapUsedMB  = stats.memoryUsage.heapUsed / 1048576
    ratio = nativeMemMB / max(heapUsedMB, 1)      // Math.max avoids div-by-zero

    // Threshold: 500 MB difference triggers native-leak warning
    // bundle.js:+13094801
    NATIVE_THRESHOLD_MB = 500

    if (nativeMemMB - heapUsedMB) > NATIVE_THRESHOLD_MB:
        lines.push("Native memory > heap - leak may be in native addons (node-pty, sharp, etc.)")
        // bundle.js:+13094646
    elif heapUsedMB is dominant:
        lines.push("— most memory is JS heap (inspect the .heapsnapshot)")
        // bundle.js:+13098156
    else:
        lines.push("— most memory is native (NOT in the .heapsnapshot)")
        // bundle.js:+13098216

    // Append "auto-1.5GB" note if heap limit near default V8 ceiling
    // literal "auto-1.5GB": bundle.js:+13097031

    // No-leak indicator
    if no_obvious_indicators:
        lines.push("  (no obvious leak indicators)")
        // bundle.js:+13098353
    else:
        lines.push("No obvious leak indicators. Check heap snapshot for retained objects.")
        // bundle.js:+13095765

    // Column alignment: 8 chars wide (fIt helper)
    // bundle.js:+13098488

    // 1 GB boundary constant: 1073741824 bytes
    // bundle.js:+13098762

    return lines.join("\n")
```

Analysis basis: CC v2.1.198 bundle.js:+13097832, +13098088, +13098400, +13098156, +13098216, +13098353, +13094646, +13094801

---

### Subprocess / Background Session Dispatcher (`g` → `bgSessionDispatcher`)

The call graph shows that `pjo` calls into a background session dispatch utility (via `_`). This component manages spawning, memory-pressure monitoring, and process lifecycle for background worker sessions. It is not unique to `/heapdump` but is reached transitively.

Key behaviors observed in call graph:
- Spawns processes via `Dz.spawn` (bundle.js:+18376609)
- Monitors free memory via `QJc.freemem` (bundle.js:+18375342)
- Sends SIGTERM then SIGKILL on timeout: 30 s / 15 s (bundle.js:+18374711, +18374722)
- Retries up to 100 times (bundle.js:+18374831)
- Emits low-memory telemetry `tengu_bg_dispatch_low_mem` (bundle.js:+18375462)
- File-descriptor limit 448 (bundle.js:+18374499)
- Uses `Date.now` for timestamps (bundle.js:+18376311)

Analysis basis: CC v2.1.198 bundle.js:+13096476, +18374756, +18375462, +18376152

---

### Subprocess Output Logger (`T` → `subprocessOutputLogger`)

Called by `pjo` at bundle.js:+13096434. Routes subprocess stdout/stderr lines through a buffered logger that:
- Accumulates lines into buffers (`l.push`, `s.push`, `h.join`) with `setImmediate`/`setTimeout` flushing (1000 ms debounce, bundle.js:+67112)
- Redacts sensitive tokens: replaces matches with `"[REDACTED]"` (bundle.js:+209027), truncated to 2-character minimum (bundle.js:+209056)
- Uppercases log level prefix: `"debug"` (bundle.js:+218003)
- Writes to output stream via `o.write` / `o.flush`
- Logs to rotating file via `Siu` (appendFile, mkdir) with `Buffer.byteLength` accounting

Analysis basis: CC v2.1.198 bundle.js:+218027, +218045, +218067, +218085, +218129, +218149, +218152, +218168, +218194, +218203, +218218

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_heap_dump` (bundle.js:+13096965) — fired after snapshot write |
| Telemetry (transitive, bg dispatch) | `tengu_bg_dispatch_sigkill_escalate` (bundle.js:+18374756), `tengu_bg_dispatch_low_mem` (bundle.js:+18375462), `tengu_bg_spare_enable` (bundle.js:+18376152), `tengu_bg_spare_claim` (bundle.js:+18376280), `tengu_bg_spare_claim_fail` (bundle.js:+18376546) |
| File system writes | `.heapsnapshot` file written to `~/Desktop` (or platform equivalent) with mode `0o600` (owner read/write only) |
| File system writes | Diagnostics JSON written alongside snapshot with mode `0o600` |
| Process signals | SIGTERM then SIGKILL sent to stale background workers (30 s / 15 s windows) |
| GC side effect | `Bun.gc()` called before snapshot generation when running under Bun |
| Active handles / requests | Counted and included in diagnostic report via `process._getActiveHandles()` / `process._getActiveRequests()` |
| Log file | Subprocess output appended to rotating log file via `Siu` (mkdir + appendFile) |
| Process event listener | `process.on("exit", ...)` registered by `biu` (bundle.js:+217658) |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.198 | Initial analysis |

---

## Common Mistakes

1. **Expecting the command in the command palette**: `/heapdump` is `isHidden: true` and will not appear in autocomplete or the help listing. It must be typed exactly.
2. **Wrong output location on WSL**: On Windows Subsystem for Linux, the Desktop path is resolved under `/mnt/c/Users/<username>/Desktop`, not the Linux home directory. Users with only the `Public`, `Default`, `Default User`, or `All Users` directories will get no valid target.
3. **Assuming the snapshot reflects all memory**: When the diagnostic report states "most memory is native (NOT in the .heapsnapshot)", the `.heapsnapshot` file captures only JS heap objects. Native addon memory (node-pty, sharp, etc.) will be invisible in Chrome DevTools.
4. **Opening the snapshot before the write completes**: The command is async; the snapshot file may not be fully flushed until the command returns. Do not open the file while the command is still running.
5. **Ignoring the 0o600 file permissions**: The snapshot file is written with owner-only permissions. Attempting to read it as another user (e.g., via `sudo` in a shared environment) will fail unless permissions are manually relaxed.
6. **Misreading the 500 MB threshold**: The "native memory > heap" warning triggers only when native RSS exceeds JS heap used by more than 500 MB (bundle.js:+13094801), not when native memory is merely larger.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `nnm` | `heapDumpHandler` — top-level async command handler (Arbor FQN: `claude-2.1.198::nnm`) |
| `pjo` | `performDump` — orchestrates snapshot path, generation, write, classify, telemetry |
| `noc` | `collectMemoryDiagnostics` — gathers heap stats, resource usage, fd count, smaps |
| `kt` | `logLine` or logger utility called by `performDump` and `collectMemoryDiagnostics` |
| `sw` | Helper called by `logLine` (shallow utility) |
| `tLs` | `resolveDesktopPath` — platform-aware Desktop directory resolver |
| `tnm` | `generateBunSnapshot` — Bun-native heap snapshot generator |
| `rnm` | `buildReport` — assembles human-readable memory analysis text |
| `fIt` | `columnFormatter` — pads/aligns columns in report output (8-char width) |
| `_` | `buildConversationMessages` — constructs message array for subprocess invocation |
| `g` | `bgSessionDispatcher` — background session spawn/monitor/kill lifecycle manager |
| `h` | `messageBuffer` — accumulates conversation message objects |
| `vgm` | `generateSystemUUID` — creates UUIDs via `crypto.randomUUID` for system messages |
| `xn` | `buildUserMessage` — constructs user-role message with UUID |
| `HC` | `humanConversationContext` — wraps conversation context for handler |
| `H` | `activeWorkerRegistry` — map/list of active background worker processes |
| `o` | `workerMap` / output stream (context-dependent, overloaded identifier) |
| `P` | `workerProcess` — individual background worker process handle |
| `T` | `subprocessOutputLogger` — routes subprocess stdout/stderr through redaction + log |
| `Hiu` | `logLineFormatter` — formats individual log lines |
| `cus` | `logLevelResolver` — resolves log level string to numeric priority |
| `e` | Generic local variable (string/array, context-dependent) |
| `t` | Generic local variable (array accumulator, context-dependent) |
| `Me` | `jsonStringifyHelper` — wraps `JSON.stringify` |
| `Oc` | `redactSensitiveTokens` — replaces sensitive strings with `[REDACTED]` |
| `Kps` | `buildRedactionPatterns` — constructs regex patterns for sensitive data |
| `r` | Generic local (array/string, context-dependent) |
| `n` | Generic local (string, often lowercased) |
| `YZe` | `streamWriteHelper` — writes formatted output to stream via `Ops` |
| `Ops` | `streamWriter` — low-level `stream.write` wrapper |
| `biu` | `runSubprocess` — spawns and manages subprocess with logging and exit handler |
| `AZe` | `debouncedLineBuffer` — batches log lines with `setTimeout`/`setImmediate` |
| `jae` | `assembleSubprocessArgs` — builds argument array for subprocess spawn |
| `Siu` | `rotatingFileLogger` — appends subprocess output to log file with mkdir |
| `Si` | `signalHandlerRegistrar` — registers signal handlers via `sus.register` |
| `zt` | `telemetryEmitter` — fires telemetry events |
| `Uae` | `errorNormalizer` — normalizes error objects (checks EISDIR etc.) |
| `Jps` | `buildLogFilePath` — joins log directory path using `Wae.join` and `kt` |
| `V` | `emitHeapDumpTelemetry` — emits `tengu_heap_dump` event |
| `sr` | `errorStringifier` — converts Error/unknown to string via `String()` |
| `Zd` | `errorLogger` — logs errors encountered during dump |
| `Re` | `reportError` — full error reporting pipeline (stringify, queue, log) |
| `st` | `toStringHelper` — wraps `String()` conversion |
| `qi` | `errorQueue` — manages queued error reporting |
| `wSs` | `errorQueueWorker` — processes queued errors via `st` |
| `jvu` | `errorQueueShifter` — shifts/pushes items in error queue (`Bmn`) |