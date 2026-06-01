---
type: feature-spec
feature: "ide"
cc_version: "2.1.145"
updated: "2026-06-01"
tags: ["ide", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.145 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ide`

> Analysis basis: CC v2.1.145 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.145

---

## Overview

The `/ide` command manages IDE integrations for Claude Code, detects currently running IDE instances that have the Claude Code extension installed, and optionally opens the current project or worktree in a selected IDE. When no argument is provided it shows a status/selection UI; when invoked with `open`, it attempts to open the project in the chosen IDE.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ide` |
| description | `Manage IDE integrations and show status` |
| argumentHint | `[open]` |
| module_id | `r$q` |
| load_inline | `true` |
| loc_byte | `10681303` |
| loc_byte_end | `10681459` |
| loc_line | `5827` |
| arbor_handler.name | `q07` |
| arbor_handler.fqn | `claude-2.1.145::q07` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.145 bundle.js:+10681303

---

## Input Branching

The command has four distinct branches based on argument presence, IDE detection results, and open sub-command handling.

```mermaid
flowchart TD
    A["/ide invoked"] --> B{argument provided?}
    B -- "no argument" --> C[Run IDE detection via ideDetect]
    B -- "\"open\"" --> D[Run IDE detection via ideDetect]

    C --> E{IDEs detected?}
    E -- "none found" --> F["Display: 'No IDEs with Claude Code extension detected.'"]
    E -- "one found" --> G[Auto-select that IDE]
    E -- "multiple found" --> H[Prompt user to select IDE]

    H --> I{User selects?}
    I -- "no selection" --> J["Display: 'No IDE selected.'"]
    I -- "selected" --> G

    G --> K{argument = \"open\"?}
    K -- "no" --> L[Show IDE status / integration info]
    K -- "yes" --> M[Attempt to open project/worktree in IDE]

    D --> E

    M --> N{IDE type}
    N -- "vscode" --> O[Open via VSCode protocol/CLI]
    N -- "cursor" --> P[Open via Cursor protocol/CLI]
    N -- "windsurf" --> Q[Open via Windsurf protocol/CLI]

    O --> R{Success?}
    P --> R
    Q --> R
    R -- "failed" --> S["Emit tengu_ext_ide_command / ide_open_project_failed\nDisplay restart guidance"]
    R -- "success" --> T["Emit ide_open_project telemetry\nReturn worktree or project context"]
```

Analysis basis: CC v2.1.145 bundle.js:+10677363 (handler `q07`), +10677471 (`"open"` literal), +10677580 (no-IDE message), +10677718 (no-selection message)

---

## Behavioral Spec

### Main Handler — ideCommandHandler (`q07`)

```
async function ideCommandHandler(context):
    emit telemetry("tengu_ext_ide_command")          // always fires at entry

    args = context.args
    subcommand = args[0] ?? null                     // "open" or nothing

    // Step 1 — detect running IDEs
    detectedIDEs = await detectRunningIDEs(context)  // calls uQH

    if detectedIDEs is empty:
        display("No IDEs with Claude Code extension detected.")
        return

    // Step 2 — IDE selection
    if detectedIDEs.length == 1:
        selectedIDE = detectedIDEs[0]
    else:
        selectedIDE = await promptUserToSelectIDE(detectedIDEs)  // JSX picker (local-jsx)

    if selectedIDE is null:
        display("No IDE selected.")
        return

    // Step 3 — optional "open" action
    if subcommand == "open":
        await openProjectInIDE(selectedIDE, context)             // calls Y8 / mJ path
    else:
        displayIDEStatus(selectedIDE)

    return
```

Analysis basis: CC v2.1.145 bundle.js:+10677363–10678974

---

### IDE Detection — detectRunningIDEs (`uQH`)

```
async function detectRunningIDEs(context):
    port = parseInt(env or config port hint)         // uQH → parseInt loc:+5238994
    existing = await queryRunningIDEList(port)       // uQH → q_ loc:+5239013
    expanded = await expandIDEPaths(existing)        // uQH → eA8 loc:+5239043

    // Parallel stat/normalize pass
    results = await Promise.all(
        expanded.map(entry => normalizeIDEEntry(entry))
    )                                                // loc:+5239057–5239069

    // Platform-specific process scan fallback (Linux)
    if platform == "linux":
        psOutput = exec(
            "ps aux | grep -E \"code|cursor|windsurf|idea|pycharm|...|fleet|android-studio\" | grep -v grep"
        )                                            // loc:+5243871
        merge psOutput hits into results

    // Filter to entries that responded or have valid socket
    filtered = results.filter(e => e.isReachable)
    emit("ide_detect")                               // loc:+5240337

    if filtered is empty:
        emit("ide_detect_failed")                    // loc:+5240401

    return filtered
```

Analysis basis: CC v2.1.145 bundle.js:+5238994, +5239057, +5240337, +5240401, +5243871

---

### IDE Path Expansion — expandIDECandidatePaths (`eA8`)

```
async function expandIDECandidatePaths(rawList):
    // Resolve home-relative paths
    // loc:+5235548 (Hz4), +5236787, +5236864 (wq1.homedir)
    homedir = os.homedir()
    candidates = []

    for entry in rawList:
        resolved = path.resolve(entry)
        stat = await fs.stat(resolved)

        if stat.isDirectory() or stat.isSymbolicLink():
            // Walk .claude subdirectory for socket/lock files
            // loc:+5236878 (".claude")
            claudeDir = path.join(resolved, ".claude")
            candidates.push(claudeDir)

        // Skip WSL system paths that should not be treated as user IDEs
        // loc:+5237085 ("/mnt/c/Users"), +5237179 ("Public"), +5237198 ("Default")
        if isBlacklistedWSLPath(resolved):
            continue

        seen.add(realpath(resolved))
        candidates.push(resolved)

    return candidates
```

Analysis basis: CC v2.1.145 bundle.js:+5235548, +5236864, +5236878, +5237085

---

### Open Project in IDE — openProjectInIDE (via `Y8` / IDE-specific path)

```
async function openProjectInIDE(ide, context):
    ideType = ide.type   // "vscode" | "cursor" | "windsurf"
                         // loc:+10677778, +10677819, +10677860

    // Determine target path: prefer worktree, fall back to project root
    targetPath = context.worktree ?? context.project
                         // loc:+10677952 ("worktree"), +10677963 ("project")

    try:
        result = await invokeIDEOpenProtocol(ideType, targetPath, ide.connectionInfo)
        emit("ide_open_project", {
            ideType: ideType,
            pathType: targetPath == context.worktree ? "worktree" : "project"
        })               // loc:+10677918

    catch error:
        emit("ide_open_project_failed")              // loc:+10678025
        display("Exited without opening IDE")        // loc:+10678315
        display(bold("restart your IDE"))            // loc:+10678583 ("restart your IDE")
```

Analysis basis: CC v2.1.145 bundle.js:+10677778, +10677918, +10678025, +10678315, +10678583

---

### IDE Name Normalization — normalizeIDEName (`mJ`)

```
function normalizeIDEName(rawName):
    lower = rawName.toLowerCase()                    // loc:+5244746
    base  = path.basename(lower)                     // loc:+5244804

    // Extract display-friendly IDE label using segment helper
    segment = extractFirstSegment(base)              // mJ → Z1 loc:+5244790
    // Z1 uses indexOf + slice pattern
    // loc:+191217, +191246

    return segment
```

Analysis basis: CC v2.1.145 bundle.js:+5244746, +5244804

---

### IDE Status Display — ideStatusFormatter (`dw_` / `Mz4`)

```
function buildIDEStatusDisplay(detectedIDEs):
    // dw_ delegates to Mz4 loc:+5244383
    // Mz4 iterates entries and checks extension/version metadata
    rows = []
    for [key, value] in Object.entries(ideRegistry):   // loc:+5243285
        if value includes recognized IDE type:           // loc:+5243342
            rows.push(formatIDERow(key, value))

        // Lowercase comparison for Jetbrains family
        if name.toLowerCase() includes known Jetbrains id:  // loc:+5243798
            rows.push(formatJetbrainsRow(name))

    // Section header bold("IDE")  loc:+5244691
    return renderTable(rows)
```

Analysis basis: CC v2.1.145 bundle.js:+5244383, +5243285, +5243798, +5244691

---

### Background Daemon Interaction (`tm_` / `w`)

The `/ide` command indirectly interacts with the background daemon layer during IDE connection establishment. The `tm_` function (entry point reached from `q07`) normalizes socket paths, dispatches to the daemon status checker (`b6`), and reads the connected IDE list from the roster.

```
function daemonAwareIDEList(context):
    // Trim trailing slash / normalize NFC
    // loc:+10680896 ("NFC"), +10680808 (H.slice), +10680871 (Math.floor)
    normalizedPaths = rawPaths.map(p =>
        A.normalize(p, "NFC")
    )

    // Query daemon socket for currently attached IDE sessions
    daemonState = queryStore(b6)                     // loc:+10680803
    attached    = daemonState.getStore()             // b6 → AC6 → _C6.getStore loc:+965908

    // Map daemon session entries to IDE records
    // Max display entries: 100 (loc:+10680767), minimum index 0 (loc:+10680786)
    ideRecords = attached
        .slice(0, 100)
        .map(entry => D.normalize(entry))            // loc:+10680917, +10680935

    // Truncate display list: show up to 3 IDEs, then ", …" suffix
    // loc:+10680840 (3), +10681065 (", "), +10681079 (", …")
    displayList = ideRecords.length > 3
        ? ideRecords.slice(0, 3).join(", ") + ", …"
        : ideRecords.join(", ")                      // loc:+10680983, +10681042

    return displayList
```

Analysis basis: CC v2.1.145 bundle.js:+10680767, +10680840, +10680896, +10681065, +10681079

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — entry | `tengu_ext_ide_command` fired on every invocation (loc:+10677365) |
| Telemetry — detect | `ide_detect` on successful IDE scan (loc:+5240337) |
| Telemetry — detect fail | `ide_detect_failed` when no IDE responds (loc:+5240401) |
| Telemetry — open | `ide_open_project` on successful project open (loc:+10677918) |
| Telemetry — open fail | `ide_open_project_failed` on open error (loc:+10678025) |
| Telemetry — daemon | Various `tengu_bg_*` events fired via the daemon layer if a background session is active (e.g., `tengu_bg_spare_claim`, `tengu_daemon_control`) |
| Telemetry — config | `tengu_config_parse_error` if IDE config file is malformed (loc:+3169876) |
| Hook registration | None directly; IDE open may trigger `onInstallIDEExtension` callback (loc:+10678492) |
| appState changes | Connected IDE entry updated in daemon roster; `_JH` / `Y.get` / `Y.set` roster map updated (loc:+14668695) |
| Socket / IPC | Connects to IDE via Unix socket or named pipe; uses `pZ8.connect` (loc:+14637198); sends claim frame via `TU.buildClaimFrame` (loc:+14636816) |
| Filesystem | Reads `.claude` subdirectory for socket/lock files; may call `q.readFileSync`, `q.statSync`, `q.mkdirSync`, `q.readdirStringSync` (loc:+3169295–3170113) |
| Sound | None identified |
| Process scan | On Linux, spawns `ps aux | grep …` (loc:+5243871) to detect running IDEs |
| SSE / WebSocket channels | Registers `sse-ide` (loc:+10675350) and `ws-ide` (loc:+10675370) transport channels for IDE communication |

---

## Version History

| Version | Change |
|---|---|
| v2.1.145 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/ide open` before any IDE has the extension installed** — The command will report "No IDEs with Claude Code extension detected." even if the IDE is running. The extension must be installed and active in the target IDE first.
2. **Expecting `/ide` to work on Windows without WSL** — The WSL path filter (`/mnt/c/Users`) and platform checks mean Windows-native paths may not be scanned correctly. Use the WSL layer for reliable detection.
3. **Multiple IDEs open simultaneously** — When more than one IDE instance is detected, the command presents a picker. Automating `/ide open` without pre-selecting an IDE will stall waiting for user input.
4. **Stale daemon socket after IDE restart** — If the IDE was force-killed, the daemon roster may still reference the old session. Running `/ide` may show "Exited without opening IDE" until the supervisor reconciles; the UI instructs the user to "restart your IDE" (loc:+10678583).
5. **Argument case sensitivity** — The `[open]` argument is matched literally; `Open` or `OPEN` will not trigger the open path.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `q07` | Main async handler for `/ide` command (arbor_handler) |
| `tm_` | Daemon-aware IDE list builder; normalizes paths, slices display list |
| `b6` | Daemon store accessor; reads current attached-IDE state |
| `AC6` | Async context store reader for daemon state |
| `Mc` | Daemon state merge helper |
| `q_` | Running IDE list query (port-based) |
| `IV` | Internal IDE query implementation |
| `uQH` | Full IDE detection pipeline (port scan + path expansion + filtering) |
| `eA8` | IDE candidate path expansion and stat resolution |
| `Hz4` | Single IDE path resolver: home-dir, symlink, WSL exclusion |
| `tO4` | IDE entry normalizer wrapper |
| `mo8` | Low-level IDE process entry parser |
| `Y_` | IDE metadata formatter |
| `Hq1` | IDE name regex matcher |
| `mJ` | IDE display-name normalizer (lowercase + basename) |
| `Z1` | String segment extractor (indexOf + slice) |
| `dw_` | IDE status display builder (delegates to Mz4) |
| `Mz4` | IDE registry table renderer; iterates entries, handles JetBrains |
| `EP` | Extension/plugin presence checker |
| `QXH` | Extension version/config loader |
| `Y8` | IDE open action dispatcher |
| `D` | Daemon normalize / background session manager |
| `Z6` | Extension config reader (reads `.claude` dir, manages watch) |
| `R$H` | Config file reader with migration logic |
| `YxL` | File watcher setup (watchFile / unwatchFile) |
| `h6` | Config snapshot and dispatch coordinator |
| `qo6` | Extension socket connection tracker |
| `b1_` | First-party extension event emitter |
| `U1_` | Extension update notifier |
| `vs_` | Background daemon spawn / PTY host launcher |
| `Is_` | IDE claim-and-attach flow |
| `ul_` | Auth token writer |
| `W06` | Config directory path resolver |
| `Nm_` | Auth directory path builder |
| `d75` | Send-claim with timeout logic |
| `c75` | TCP/socket connect helper for claim |
| `Q75` | Claim frame builder helper |
| `ap` | Binary frame serializer (Buffer alloc + writeUInt32BE) |
| `Rs_` | Background session roster manager |
| `w` | Background session dispatch loop and supervisor |
| `C` | Worker process supervisor |
| `R1K` | Worker process real-path verifier |
| `J55` | Worker path argument builder |
| `w38` | Version array path joiner |
| `z` | Daemon IPC write channel |
| `oN` | IPC message push handler |
| `kx` | Graceful shutdown with Promise.race / process.exit |
| `EMq` | Spare PTY socket path constructor |
| `Gd` | Base socket directory resolver |
| `ZMq` | Secondary spare socket path builder |
| `l75` | Spare PTY config checker |
| `g75` | Spawn metadata assembler |
| `ek` | PTY PID file path builder |
| `AkH` | PTY PID directory resolver |
| `NH` | Error normalizer and log dispatcher |
| `x_` | Error-to-string coercer |
| `Hq` | Error queue processor |
| `JOA` | Error formatter |
| `mhK` | Error ring buffer (shift/push) |
| `dvq` | Daemon status file writer (`daemon.status.json`) |
| `KT6` | Status file path builder |
| `RH` | JSON stringify wrapper |
| `bT6` | Platform + memory check for spare enable |
| `u` | Session idle-timeout / retire-if-settled handler |
| `Is_` | IDE connection claim orchestrator |
| `Rs_` | Roster entry lifecycle manager |
| `JK` | Jobs directory path resolver |
| `l0` | Jobs base path builder |
| `u1` | Roster file reader / cache manager |
| `u6` | JSON.parse wrapper |
| `Dj` | Active roster state machine |
| `eE` | Roster state transition helper |
| `y5` | Atomic file writer for roster |
| `Gz` | Safe atomic write with rename |
| `tP` | Roster cache invalidator |
| `EaH` | NMq promise-then roster updater |
| `AU` | Roster file reader with error handling |
| `p27` | Roster directory creator + atomic write |
| `nLH` | PTY PID file path resolver |
| `_U` | PTY socket path builder |
| `Vm_` | PTY path variant resolver |
| `GaH` | PTY base path builder |
| `Y` | Roster map get/set/delete and daemon config reload |
| `_JH` | Roster entry builder |
| `Wkq` | Roster display formatter (Object.keys + Math.max + padding) |
| `T` | Keyboard / remote-control event handler |
| `V` | Daemon config update and session lifecycle |
| `y1K` | Heartbeat helper |
| `K8` | Feature flag / config value reader |
| `hH` | Platform detection helper (reads `d`) |
| `CH` | OS type detection helper |
| `S9` | Permission error classifier |
| `GH` | String coercer |
| `O8` | Error code accessor |
| `A8` | Error type checker |
| `MI` | IDE extension install callback reference |
| `sW7` | IDE display list filter |
| `qM` | Argument parser helper |
| `xQH` | IDE status JSX renderer |
| `mT` | Terminal output formatter |
| `Mi` | IDE connection metadata builder |
| `W` | Debounced skills/config change handler |
| `DOH` | Policy settings dispatcher |
| `w4` | Hook executor (effort/config) |
| `g2` | Hook runner with full event dispatch |
| `VFH` | Hook list presence checker |
| `V6H` | Hook type router |
| `CrH` | Hook cache invalidator |
| `P` | IPC protocol framing layer |
| `J` | IPC stream reference |
| `Q5` | IPC stream end/response helper |
| `t75` | IPC message dispatcher and terminal repaint loop |
| `f1K` | IPC keep-alive / timeout manager |
| `X` | Terminal repaint coordinator |
| `tG` | PTY path join helper |
| `l$` | PTY realpath normalizer |
| `x5H` | PTY log file tail reader |
| `a75` | Stall-time measurer |
| `s75` | Session phase checker / kill helper |
| `DV6` | IPC stream write/destroy helper |
| `G` | Repaint connection finalizer |
| `jq1` | Process kill helper |
| `N` | Away-summary generator |
| `s` | Voice toggle silence timeout |
| `e` | Voice focus silence timeout |
| `g` | MCP tool call filter |
| `F` | MCP tool + session combiner |
| `l` | Output filter helper |
| `i` | IPC write adapter |
| `c` | Permission response handler |