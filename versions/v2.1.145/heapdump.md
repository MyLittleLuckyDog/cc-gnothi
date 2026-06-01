---
type: feature-spec
feature: "heapdump"
cc_version: "2.1.145"
updated: "2026-06-01"
tags: ["heapdump", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.145 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/heapdump`

> Analysis basis: CC v2.1.145 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.145

---

## Overview

`/heapdump` is a hidden diagnostic command that captures a snapshot of the JavaScript heap (and supplementary memory statistics) and writes two files to the user's Desktop: a `.heapsnapshot` file suitable for inspection in Chrome DevTools and a human-readable `.txt` summary. It is intended for first-party memory-leak investigation and is not surfaced in the normal command list.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `heapdump` |
| description | `Dump the JS heap to ~/Desktop` |
| supportsNonInteractive | `true` |
| isHidden | `true` |
| module_id | `SEq` |
| load_inline | `true` |
| loc_byte | `11628726` |
| loc_byte_end | `11628889` |
| loc_line | `7191` |
| arbor_handler.name | `HR7` |
| arbor_handler.fqn | `claude-2.1.145::HR7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.145 bundle.js:+11628726

---

## Input Branching

The command has more than three distinct execution paths (runtime environment detection, heap-snapshot engine selection, platform-specific Desktop resolution, leak-indicator classification, and output formatting), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/heapdump invoked"]) --> B[collectMemoryStats]
    B --> C{Linux?\ncheck /proc/self/smaps_rollup}
    C -- yes --> D[read smaps_rollup for native RSS]
    C -- no --> E[use process.memoryUsage only]
    D --> F[buildRawReport]
    E --> F
    F --> G{Bun runtime\navailable?}
    G -- yes --> H[generateBunHeapSnapshot\nBun.gc + Bun.generateHeapSnapshot]
    G -- no --> I[generateV8HeapSnapshot\nvia bun:jsc module,\narraybuffer mode]
    H --> J[resolveDesktopPath]
    I --> J
    J --> K{Platform?}
    K -- darwin/macOS --> L[homedir + /Desktop]
    K -- WSL/Windows --> M[/mnt/c/Users/... path resolution]
    K -- other Linux --> N[homedir + /Desktop fallback]
    L --> O[writeHeapsnapshotFile\nmode 0o600 / decimal 384]
    M --> O
    N --> O
    O --> P[classifyLeakIndicators]
    P --> Q{native RSS > JS heap?}
    Q -- yes --> R["warn: native addon leak\n(node-pty, sharp, etc.)"]
    Q -- no --> S{any warning flags?}
    S -- yes --> T[list specific indicators]
    S -- no --> U["'no obvious leak indicators'"]
    R --> V[buildTextSummary\n_R7]
    T --> V
    U --> V
    V --> W[writeTextSummaryFile]
    W --> X[emit tengu_heap_dump telemetry]
    X --> Y[return formatted result\nwith file paths]
```

---

## Behavioral Spec

### Top-level handler (`HR7`)

`HR7` is the `AsyncFunction` resolved by Arbor as the command's main handler (resolution path: `module_id → SEq`). It orchestrates collection, snapshot generation, file writing, and result formatting.

Analysis basis: CC v2.1.145 bundle.js:+11627595

```
async function heapdumpHandler(args):
    rawStats    = await collectAndWriteFullReport(args)   // yEq
    summaryText = buildTextSummary(rawStats)              // _R7
    lines       = []
    lines.push(...)                                       // _.push  +11627741
    result      = lines.join(...)                         // _.join  +11627863
    return result
```

### Memory statistics collection (`tS7`)

Gathers all available memory metrics from multiple Node.js / Bun APIs and, on Linux, augments them with data from `/proc`.

Analysis basis: CC v2.1.145 bundle.js:+11626270

```
async function collectMemoryStats():
    stats = {}
    stats.memoryUsage      = process.memoryUsage()           // +11623758
    stats.heapStatistics   = v8.getHeapStatistics()          // H28.getHeapStatistics +11623782
    stats.resourceUsage    = process.resourceUsage()         // +11623808
    stats.uptime           = process.uptime()                // +11623834
    stats.heapSpaces       = v8.getHeapSpaceStatistics()     // H28.getHeapSpaceStatistics +11623859
    stats.activeHandles    = process._getActiveHandles()     // +11623901
    stats.activeRequests   = process._getActiveRequests()    // +11623938

    // Linux-only: open file-descriptor count and smaps RSS
    if filesystem.readdir("/proc/self/fd") succeeds:         // UsH.readdir +11623989
        stats.openFdCount = count of entries

    if filesystem.readFile("/proc/self/smaps_rollup", "utf8") succeeds:  // UsH.readFile +11624051
        stats.smapsRollup = parsed values

    // Detect possible native-memory leak
    // threshold: native > 100% of JS heap  (+11624442)
    nativeRatio = stats.resourceUsage.maxRSS / stats.memoryUsage.heapUsed
    if nativeRatio > 100:                                    // literal 100 +11624442
        stats.warnings.push(
            "Native memory > heap - leak may be in native addons (node-pty, sharp, etc.)"
        )                                                    // string literal +11624528

    // bun:jsc module is imported for JSC-level statistics   // literal "bun:jsc" +11624149
    stats.jscStats = loadModule("bun:jsc")                   // G +11624162

    return stats
```

### Full report writer (`yEq`)

Calls `collectMemoryStats`, resolves the Desktop output directory, generates the heap snapshot, writes both output files, fires telemetry, and returns the collected stats object.

Analysis basis: CC v2.1.145 bundle.js:+11626257

```
async function collectAndWriteFullReport(args):
    // Resolve output directory
    desktopPath = resolveDesktopPath()                       // JzA +11626553
    //   uses os.homedir() (zm8.homedir +1005439)
    //   joins with "Desktop"  (literal +1005485)
    //   on WSL resolves via /mnt/c/Users (literal +1005707)

    stats = await collectMemoryStats()                       // tS7 +11626270

    // Snapshot output path
    outputPath = path.join(desktopPath, ...)                 // Eg_.join +11626662

    // Write heap snapshot (mode 384 = 0o600)               // literal 384 +11626740
    await filesystem.writeFile(outputPath, snapshotBuffer, {mode: 384})
                                                             // UsH.writeFile +11626705

    // Serialise stats to JSON for the .txt companion file
    jsonText = JSON.stringify(stats)                         // RH +11626721

    // Generate heap snapshot content
    snapshotData = await generateHeapSnapshot()              // eS7 +11626796

    // Emit telemetry
    emit("tengu_heap_dump")                                  // +11626847

    // Handle errors / format output
    if error:
        formatError(error)                                   // x_ +11627016
        logError(error)                                      // _N +11627025
        notifyUI(error)                                      // NH +11627103

    return stats
```

### Heap snapshot generator (`eS7`)

Selects the appropriate snapshot engine based on the detected runtime.

Analysis basis: CC v2.1.145 bundle.js:+11626796

```
async function generateHeapSnapshot():
    if Bun runtime is detected:
        // Force a garbage collection pass first
        Bun.gc(true)                                         // Bun.gc +11627352
        snapshot = Bun.generateHeapSnapshot()                // Bun.generateHeapSnapshot +11627295
    else:
        // V8 / JSC path: write using bun:jsc in arraybuffer mode
        // literals "v8" +11627320, "arraybuffer" +11627325
        snapshot = jsc.generateHeapSnapshot("v8", "arraybuffer")

    filesystem.writeFileSync(outputPath, snapshot)           // kEq.writeFileSync +11627275
    return snapshot
```

### Summary text builder (`_R7`)

Formats a human-readable diagnostic summary appended to the `.txt` file, including memory totals, leak-indicator classification, and instructions for the developer.

Analysis basis: CC v2.1.145 bundle.js:+11627714

```
function buildTextSummary(stats):
    lines = []

    // Header with memory totals (Math.max used for alignment) // +11627970
    heapUsedMB  = stats.memoryUsage.heapUsed  / 1_048_576    // literal 1048576 +11624295
    rssMB       = stats.resourceUsage.maxRSS  / 1_048_576
    uptime      = stats.uptime

    // Classify whether most memory is in JS heap or native
    if heapUsedMB / rssMB is large fraction:
        lines.push("— most memory is JS heap (inspect the .heapsnapshot)")
                                                             // literal +11628038
    else:
        lines.push("— most memory is native (NOT in the .heapsnapshot)")
                                                             // literal +11628098

    // Leak indicator summary
    if no warnings:
        lines.push("  (no obvious leak indicators)")         // literal +11628235
    else:
        for each warning in stats.warnings:
            lines.push(warning)

    // Max column width: 8                                   // literal 8 +11628370
    // Additional formatting via BsH                         // +11628282

    // Developer instruction appended
    lines.push(
        "Open the .heapsnapshot in Chrome DevTools → Memory → Load to inspect retainers."
    )                                                        // literal +11627751

    // 1 GB threshold reference (1073741824)                 // literal +11628644
    // used for classifying "auto-1.5GB" heap budget         // literal "auto-1.5GB" +11626913

    return lines.join("\n")
```

### Desktop path resolver (`JzA`)

Determines the correct Desktop path for the current OS / WSL environment.

Analysis basis: CC v2.1.145 bundle.js:+11626553

```
function resolveDesktopPath():
    home = os.homedir()                                      // zm8.homedir +1005439
    base = path.join(home, "Desktop")                        // M5.join +1005475

    // WSL detection: check for /mnt/c/Users               // literal +1005707
    if running under WSL:
        // Enumerate /mnt/c/Users skipping "Public",         // literal +1005751
        // "Default", "Default User", "All Users"            // literals +1005770/+1005790/+1005815
        winUser = firstRealUser(enumerateWslUsers())
        base = path.join("/mnt/c/Users", winUser, "Desktop")

    return base
```

### Platform leak-indicator summary (`c6`, macOS branch)

Generates a macOS-specific diagnostic note when the platform is `darwin`.

Analysis basis: CC v2.1.145 bundle.js:+11625375

```
function buildPlatformSummary(stats, platform):
    if platform === "darwin":                                // literal +11625801
        label = "macos"                                      // literal +11625382
    // If no warning indicators were detected:
    if stats.warnings.length === 0:
        return "No obvious leak indicators. Check heap snapshot for retained objects."
                                                             // literal +11625647
    return buildIndicatorList(stats.warnings)
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_heap_dump` (fires on each successful invocation, bundle.js:+11626847) |
| Telemetry (background session infra, co-located) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop`, `tengu_bg_attach_legacy_autorespawn`, `tengu_bg_attach`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_stall_respawn`, `tengu_bg_attach_kick` |
| File output — heap snapshot | `~/Desktop/<timestamp>.heapsnapshot` (mode `0o600`, decimal `384`) — Analysis basis: +11626740 |
| File output — text summary | `~/Desktop/<timestamp>.txt` companion file with human-readable memory stats |
| Bun GC side-effect | When the Bun runtime is detected, `Bun.gc(true)` is called before snapshot capture, triggering a synchronous garbage collection pass — Analysis basis: +11627352 |
| Error logging | Errors are routed through the shared error-log facility (`_N`) and UI notification (`NH`) |
| appState changes | None observed within depth-2 traversal |
| Sound | None observed |
| Hook registration | `h9` / `w6A.register` is reachable from the write-log path (`R$K`) — likely session-log hook, not specific to `/heapdump` |

---

## Version History

| Version | Change |
|---|---|
| v2.1.145 | Initial analysis |

---

## Common Mistakes

1. **Running on a non-Desktop OS session**: The command resolves `~/Desktop` via `os.homedir()`. On headless Linux servers, this directory may not exist; the command will fail with an `ENOENT`-style error at the `writeFile` step.
2. **Expecting output in the working directory**: Output is always written to `~/Desktop` (or the WSL Windows Desktop equivalent), not the current project directory.
3. **Interpreting native-memory warnings as conclusive**: The `"Native memory > heap"` warning fires when `maxRSS / heapUsed > 100`; this is a heuristic threshold, not a definitive leak diagnosis. The note specifically calls out `node-pty` and `sharp` as common false-positive sources.
4. **Opening the `.heapsnapshot` in the wrong tool**: The file is in Chrome DevTools heap-snapshot format (V8 / JSC `"v8"` mode). Opening it in a generic JSON viewer loses retainer-graph information. Use Chrome DevTools → Memory → Load profile.
5. **Assuming the command is interactive-only**: `supportsNonInteractive: true` means it can be invoked from scripts or pipelines, but the output files still land on the Desktop regardless of invocation mode.
6. **Not accounting for WSL path mapping**: On WSL, the Desktop path is resolved from `/mnt/c/Users/<user>/Desktop`, not the Linux home directory. Ensure Windows filesystem is mounted before invoking.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `HR7` | Main async handler for `/heapdump` (Arbor-resolved, `AsyncFunction`) |
| `yEq` | Full report orchestrator: collects stats, writes files, fires telemetry |
| `tS7` | Memory statistics collector (process, V8, /proc, bun:jsc) |
| `eS7` | Heap snapshot generator (Bun or V8/JSC path) |
| `_R7` | Text summary builder (leak classification, DevTools hint) |
| `JzA` | Desktop path resolver (macOS / Linux / WSL) |
| `k6` | Shared filesystem utility (used in multiple paths) |
| `IV` | Dependency of filesystem utility `k6` |
| `G` | `bun:jsc` module loader / JSC statistics helper |
| `i26` | Dependency of `G` (JSC module sub-utility) |
| `kZ8` | Dependency of `G` and `X` |
| `X` | Connection/session manager (background daemon infrastructure) |
| `NH` | Error notification / UI alert utility |
| `x_` | Error formatter (wraps `Error` + `String`) |
| `P` | IPC/process pipe handler (background session infra) |
| `J` | Buffer/stream utility (used by pipe handler) |
| `w` | Background session worker manager |
| `Q5` | Stream-end helper |
| `t75` | Background session message dispatcher |
| `GH` | String conversion helper |
| `I` | Log writer / debug output utility |
| `y$K` | Logging sub-utility |
| `J6A` | Logging format helper |
| `H` | Shared timing/random utility (setTimeout, Math.random) |
| `RH` | JSON serialiser wrapper (`JSON.stringify`) |
| `_` | Output line accumulator (array used in `HR7`) |
| `B4` | Path/string normalisation utility |
| `n_A` | String map helper (used by `B4`) |
| `q` | File-unlink / cleanup utility |
| `A` | Lowercase / case-normalisation utility |
| `RSH` | Stdio write utility |
| `x_A` | Handle-write helper (used by `RSH`) |
| `R$K` | Session log / file-append manager |
| `qSH` | Queue/batch flush utility |
| `I_H` | Log path join utility |
| `U6` | Async error/result wrapper |
| `M86` | App-state accessor (`A8`) |
| `HAA` | Log directory path resolver |
| `e_A` | File rotation / rename utility |
| `S$K` | Append-file / mkdir log writer |
| `h9` | Hook registration shim (`w6A.register`) |
| `K` | Identifier/name formatting utility (padEnd) |
| `L` | Active-task tracker (add/delete/finally) |
| `f` | Task close/cleanup handler |
| `d` | Generic teardown / dispose helper |
| `_N` | Error log sink |
| `BsH` | Column-width / alignment helper (used in summary formatting) |
| `c6` | Platform-specific diagnostic summary builder |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.