---
type: feature-spec
feature: "heapdump"
cc_version: "2.1.148"
updated: "2026-06-01"
tags: ["heapdump", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.148 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/heapdump`

> Analysis basis: CC v2.1.148 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.148

---

## Overview

`/heapdump` is a hidden diagnostic command that captures a JavaScript heap snapshot and a rich memory-statistics report, then writes both to the user's `~/Desktop`. The report includes V8 heap statistics, OS-level memory metrics, active handles/requests, open file descriptors (Linux), and smaps RSS data (Linux), topped with heuristic leak indicators. It is intended for developer/debug use and does not appear in normal help listings.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `heapdump` |
| description | `Dump the JS heap to ~/Desktop` |
| supportsNonInteractive | `true` |
| isHidden | `true` |
| module_id | `Oh1` |
| load_inline | `true` |
| loc_byte | `12048415` |
| loc_byte_end | `12048578` |
| loc_line | `9939` |
| arbor_handler.name | `pF7` |
| arbor_handler.fqn | `claude-2.1.148::pF7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.148 bundle.js:+12048415

---

## Input Branching

The command has 3+ structurally distinct execution paths depending on platform detection, runtime environment (Bun vs Node/V8), and Linux-specific file availability. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A[/heapdump invoked] --> B[Collect memory statistics\nvia collectMemoryStats]
    B --> C{Platform?}
    C -->|linux| D[Read /proc/self/fd\ncount open file descriptors]
    D --> E[Read /proc/self/smaps_rollup\nparse RSS from smaps]
    E --> F[Import bun:jsc module\nfor JSC heap stats]
    C -->|macos| G[Platform label = macos\nbundle.js:+12045071]
    C -->|other| H[Platform label = other]
    G --> I[Compute heap ratio\nnative vs JS heap]
    H --> I
    F --> I
    I --> J{native > JS heap?}
    J -->|yes| K[Emit native-leak warning\nbundle.js:+12044217]
    J -->|no| L[Emit no-obvious-leak message\nbundle.js:+12045336]
    K --> M[formatMemoryReport\nbuild human-readable text]
    L --> M
    M --> N[resolveDesktopPath\nexpand ~/Desktop\nbundle.js:+12046242]
    N --> O{Bun runtime?}
    O -->|yes| P[generateHeapSnapshotBun\nBun.gc + Bun.generateHeapSnapshot\nbundle.js:+12046984]
    O -->|no / fallback| Q[generateHeapSnapshotV8\nwriteFileSync .heapsnapshot\nbundle.js:+12046964]
    P --> R[Write .heapsnapshot JSON\nto Desktop path\nbundle.js:+12046394]
    Q --> R
    R --> S[Write memory-report .txt\nto Desktop path]
    S --> T[Emit telemetry\ntengu_heap_dump\nbundle.js:+12046536]
    T --> U[formatResultMessage\nbuild output lines\nbundle.js:+12047403]
    U --> V[Return result text to user]
```

---

## Behavioral Spec

### Handler: `heapDumpHandler` (bundle ident `pF7`)

The top-level async handler orchestrates the full flow. It calls `runHeapDump` (ident `fh1`) to perform collection and writing, then calls `formatResultMessage` (ident `UF7`) to build the user-visible output lines.

Analysis basis: CC v2.1.148 bundle.js:+12047284

```
async function heapDumpHandler(context):
    lines = []
    result = await runHeapDump(context)
    outputText = formatResultMessage(result)
    lines.push(outputText)
    return lines.join(newline)
```

---

### Sub-feature: Memory Statistics Collection (`collectMemoryStats`, ident `uF7`)

Gathers a comprehensive snapshot of the current process's memory posture.

Analysis basis: CC v2.1.148 bundle.js:+12045959

```
async function collectMemoryStats():
    stats = {}

    // Core V8 / Node metrics
    stats.memoryUsage       = process.memoryUsage()
    stats.heapStatistics    = v8Module.getHeapStatistics()          // bundle.js:+12043471
    stats.resourceUsage     = process.resourceUsage()               // bundle.js:+12043497
    stats.uptimeSeconds     = process.uptime()                      // bundle.js:+12043523
    stats.heapSpaceStats    = v8Module.getHeapSpaceStatistics()     // bundle.js:+12043548
    stats.activeHandles     = process._getActiveHandles().length    // bundle.js:+12043590
    stats.activeRequests    = process._getActiveRequests().length   // bundle.js:+12043627

    // Linux-only: open file descriptors
    if fileExists("/proc/self/fd"):                                  // bundle.js:+12043690
        fdEntries = await fs.readdir("/proc/self/fd")
        stats.openFdCount = fdEntries.length

    // Linux-only: smaps RSS
    if fileExists("/proc/self/smaps_rollup"):                       // bundle.js:+12043753
        smapsText = await fs.readFile("/proc/self/smaps_rollup", "utf8")  // bundle.js:+12043779
        stats.smapsRss = parseSmapsRss(smapsText)

    // Bun / JSC heap (if available)
    jscModule = tryImport("bun:jsc")                                // bundle.js:+12043838
    if jscModule:
        stats.jscHeap = jscModule  // provides additional heap detail

    // Compute heap-to-native ratio
    // Limit: uptimeSeconds clamped to 3600 s (bundle.js:+12043979)
    // Divisor constant: 1048576 (1 MiB) (bundle.js:+12043984)
    stats.heapMB  = stats.memoryUsage.heapUsed / 1048576
    stats.rssMB   = stats.memoryUsage.rss / 1048576

    // Compute ratio as percentage, rounded to 2 decimal places
    // Threshold: 100 (bundle.js:+12044131)
    stats.heapRatioPct = (stats.heapMB / stats.rssMB * 100).toFixed(2)

    if stats.heapRatioPct > 100:
        stats.leakHint = "Native memory > heap - leak may be in native addons (node-pty, sharp, etc.)"
        // bundle.js:+12044217

    return stats
```

---

### Sub-feature: Desktop Path Resolution (`resolveDesktopPath`, ident `XjA`)

Resolves the platform-appropriate Desktop directory, handling WSL and Windows home directory edge cases.

Analysis basis: CC v2.1.148 bundle.js:+12046242

```
function resolveDesktopPath(filename):
    homeDir = os.homedir()                              // bundle.js:+1010357

    // WSL detection: check for /mnt/c/Users prefix    // bundle.js:+1010625
    if platform is WSL-like:
        // Skip known system directories:
        // "Public", "Default", "Default User", "All Users"
        // bundle.js:+1010669, +1010688, +1010708, +1010733
        windowsHome = resolveWindowsHome("/mnt/c/Users")
        desktopDir  = path.join(windowsHome, "Desktop") // bundle.js:+1010403
    else:
        desktopDir = path.join(homeDir, "Desktop")      // bundle.js:+1010393

    return path.join(desktopDir, filename)
```

---

### Sub-feature: Heap Snapshot Generation (`generateHeapSnapshot`, ident `mF7`)

Writes the heap snapshot file. Branches on runtime availability.

Analysis basis: CC v2.1.148 bundle.js:+12046485

```
async function generateHeapSnapshot(outputPath):
    if runtime is Bun:
        // Bun path
        Bun.gc(/* synchronous */ true)                          // bundle.js:+12047041
        snapshot = Bun.generateHeapSnapshot()                   // bundle.js:+12046984
        // snapshot type: "v8" or "arraybuffer"                 // bundle.js:+12047009,+12047014
        fs.writeFileSync(outputPath, snapshot)                  // bundle.js:+12046964
    else:
        // Node/V8 path — uses v8.writeHeapSnapshot or equivalent
        fs.writeFileSync(outputPath, serializeV8Heap())

    return outputPath
```

---

### Sub-feature: Core Orchestrator (`runHeapDump`, ident `fh1`)

Coordinates collection, snapshot generation, and file writing.

Analysis basis: CC v2.1.148 bundle.js:+12046005

```
async function runHeapDump(context):
    // Step 1: gather stats (trigger count = 3, bundle.js:+12046002)
    memStats    = await collectMemoryStats()               // bundle.js:+12045959

    // Step 2: determine platform label
    platform    = getPlatformLabel()                       // calls h6 / bundle.js:+12045946
    if platform == "darwin":                               // bundle.js:+12045490
        platformLabel = "macos"                            // bundle.js:+12045071
    else:
        platformLabel = platform

    // Step 3: resolve output path
    timestamp       = buildTimestamp()
    snapshotName    = "claude-" + timestamp + ".heapsnapshot"
    reportName      = "claude-" + timestamp + ".txt"
    desktopPath     = resolveDesktopPath(snapshotName)     // bundle.js:+12046242

    // Step 4: write heap snapshot
    // File mode: 0o600 (384 decimal) (bundle.js:+12046429)
    await generateHeapSnapshot(desktopPath)               // bundle.js:+12046485

    // Step 5: write text report
    reportPath = resolveDesktopPath(reportName)
    reportText = buildMemoryReport(memStats, platformLabel)
    await fs.writeFile(reportPath, reportText, { mode: 384 })  // bundle.js:+12046394

    // Step 6: encode report for return
    encoded = JSON.stringify(reportText)                   // via CH, bundle.js:+12046410

    // Step 7: emit telemetry
    emitEvent("tengu_heap_dump")                          // bundle.js:+12046536

    // Step 8: handle errors
    // Uses errorWrapper (n_) and async-result helper (Az)    // bundle.js:+12046705,+12046714

    return { desktopPath, reportPath, memStats, reportText }
```

---

### Sub-feature: Result Message Formatting (`formatResultMessage`, ident `UF7`)

Builds the multi-line text returned to the user's terminal.

Analysis basis: CC v2.1.148 bundle.js:+12047403

```
function formatResultMessage(result):
    lines = []

    // Memory sizes, max-normalised           // bundle.js:+12047659
    heapMB  = Math.max(result.memStats.heapMB, 0)
    rssMB   = Math.max(result.memStats.rssMB,  0)

    // Dominant-memory classifier              // bundle.js:+12047727, +12047787
    if heapMB >= rssMB * threshold:
        lines.push("— most memory is JS heap (inspect the .heapsnapshot)")
    else:
        lines.push("— most memory is native (NOT in the .heapsnapshot)")

    // Leak indicator                          // bundle.js:+12047924
    if no obvious indicators:
        lines.push("  (no obvious leak indicators)")

    // Usage threshold: 1 GiB = 1073741824 bytes // bundle.js:+12048333
    if totalRssBytes > 1073741824:
        // flag high RSS
        lines.push(highRssWarning)

    // Column width: 8 chars padding           // bundle.js:+12048059
    // Advice line
    lines.push(
        "Open the .heapsnapshot in Chrome DevTools → Memory → Load to inspect retainers."
        // bundle.js:+12047440
    )

    // leapdump summary via LeH               // bundle.js:+12047971
    summary = buildLeakSummary(result.memStats)
    lines.push(summary)

    return lines.join(newline)
```

---

### Sub-feature: Leak Heuristic Output (`buildMemoryReport`, ident `uF7` output section)

Computes the heuristic annotations attached to the report text.

Analysis basis: CC v2.1.148 bundle.js:+12044493, +12045064

```
function computeLeakHints(stats, platform):
    hints = []

    // Native-addon leak heuristic
    if stats.heapRatioPct > 100:
        hints.push(
            "Native memory > heap - leak may be in native addons (node-pty, sharp, etc.)"
            // bundle.js:+12044217
        )

    // macOS path uses platform label "macos"  // bundle.js:+12045071
    if platform == "macos":
        // macOS-specific smaps not available; note this in report

    // Fallback: no obvious indicators         // bundle.js:+12045336
    if hints is empty:
        hints.push(
            "No obvious leak indicators. Check heap snapshot for retained objects."
        )

    return hints
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_heap_dump` (bundle.js:+12046536) |
| Telemetry (background subsystem, same bundle) | `tengu_bg_dispatch_sigkill_escalate` (+15117585), `tengu_bg_dispatch_low_mem` (+15118164), `tengu_bg_spare_enable` (+15118859), `tengu_bg_spare_claim` (+15118980), `tengu_bg_spare_claim_fail` (+15119243), `tengu_bg_proto_mismatch` (+15105926), `tengu_bg_dispatch_stale_drop` (+15107165), `tengu_bg_attach_legacy_autorespawn` (+15109241), `tengu_bg_attach` (+15109652), `tengu_bg_attach_stall_gave_up` (+15110564), `tengu_bg_attach_stall_respawn` (+15110833), `tengu_bg_attach_kick` (+15111750) — these belong to background-dispatch subsystem traversed by the call graph, not directly to `/heapdump` |
| File writes | `~/Desktop/claude-<timestamp>.heapsnapshot` (heap snapshot, mode 0o600 / 384 decimal, bundle.js:+12046429) |
| File writes | `~/Desktop/claude-<timestamp>.txt` (memory report, bundle.js:+12046394) |
| Garbage collection | `Bun.gc(true)` called before snapshot on Bun runtime (bundle.js:+12047041) |
| Process introspection | Reads `process._getActiveHandles()`, `process._getActiveRequests()` (bundle.js:+12043590, +12043627) |
| Linux file reads | `/proc/self/fd` directory listing (bundle.js:+12043690); `/proc/self/smaps_rollup` (bundle.js:+12043753) |
| appState changes | None identified in depth-2 traversal |
| Sound | None identified |
| Hook registration | `process` finalizer registered via `r9` / `D9A.register` (bundle.js:+57468) — part of log-writer lifecycle, not heap-dump specific |
| isHidden | Command is hidden from normal help/completion listings |
| supportsNonInteractive | Can be invoked in non-interactive (scripted) mode |

---

## Version History

| Version | Change |
|---|---|
| v2.1.148 | Initial analysis |

---

## Common Mistakes

1. **Expecting the command in `/help` listings**: `/heapdump` is registered with `isHidden: true` and will not appear in normal command discovery. You must type it explicitly.
2. **Running on a system without a `~/Desktop` directory**: The command targets `~/Desktop` unconditionally (with WSL path remapping). If that directory does not exist the file write will fail; create it manually first.
3. **Confusing the `.heapsnapshot` with a full memory dump**: The `.heapsnapshot` file captures only the JS heap. As the output message notes, if the dominant memory is native (RSS > heap), the snapshot will not show the leak — inspect native addon usage instead (bundle.js:+12047787).
4. **Ignoring the companion `.txt` report**: The human-readable report contains uptime, heap-space breakdown, smaps RSS (Linux), open FD count, and heuristic leak indicators that are absent from the raw `.heapsnapshot`.
5. **Invoking in a non-Bun environment and expecting `Bun.generateHeapSnapshot`**: On Node.js the code falls back to a V8-based snapshot path. The resulting file is still a valid `.heapsnapshot` but is generated differently (bundle.js:+12046964 vs +12046984).
6. **Assuming the 1 GiB threshold is configurable**: The high-RSS warning threshold is hardcoded to `1073741824` bytes (bundle.js:+12048333).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `pF7` | Top-level async handler for `/heapdump` (`heapDumpHandler`) |
| `fh1` | Core orchestrator: collects stats, writes files (`runHeapDump`) |
| `h6` | Platform / OS detection helper |
| `oV` | Low-level OS call or utility (called by platform detector) |
| `uF7` | Memory statistics collector (`collectMemoryStats`) |
| `G` | Generic utility / formatter called during stats collection |
| `F06` | Sub-utility called from generic formatter |
| `YN8` | Sub-utility called from generic formatter |
| `X` | Async-task / job dispatch helper (background subsystem) |
| `RH` | Background session connection handler |
| `n_` | Error-wrapping / result-type helper |
| `P` | IPC / subprocess communication channel object |
| `J` | Byte buffer / data-stream holder |
| `w` | Supervisor / background-session manager |
| `KM` | IPC message encoder or channel endpoint |
| `fj5` | Background session protocol message dispatcher |
| `ZH` | String-conversion utility |
| `N` | Log-writing subsystem entry point |
| `vJK` | Log formatter or structured-log helper |
| `j9A` | Log destination selector |
| `H` | General-purpose in-memory map / cache structure |
| `CH` | JSON serialisation wrapper (`JSON.stringify`) |
| `_` | String / array utility |
| `f4` | Path or string manipulation helper |
| `l1A` | WJK-map processor (path component mapper) |
| `q` | File or stream utility (also calls `HfK.unlinkSync`) |
| `A` | String lower-case normaliser |
| `lRH` | Log-record writer |
| `b1A` | Low-level write helper for log records |
| `kJK` | Log-file lifecycle manager (mkdir, appendFile, rotate) |
| `XRH` | Timeout/retry scheduler for log operations |
| `XAH` | Log-path builder (joins directory + filename) |
| `F6` | File-system promise wrapper or async FS helper |
| `C_6` | Error-code classifier (`q8` errno checker) |
| `e1A` | Log entry path constructor |
| `t1A` | Log file rotation handler (stat, rename, unlink) |
| `IJK` | Log file append + rotation orchestrator |
| `r9` | Process exit / finalizer registration helper |
| `K` | Column formatter / padEnd helper for output lines |
| `L` | Promise-set lifecycle manager (add / finally / delete) |
| `M` | Resource-close coordinator |
| `XjA` | Desktop path resolver (`resolveDesktopPath`) |
| `mF7` | Heap snapshot generator (`generateHeapSnapshot`) — calls `Bun.generateHeapSnapshot` / `Bun.gc` |
| `c` | Low-level process or stream utility |
| `Az` | Async result unwrapper / error propagator |
| `UF7` | Result message formatter (`formatResultMessage`) |
| `LeH` | Leak-summary builder called from result formatter |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.