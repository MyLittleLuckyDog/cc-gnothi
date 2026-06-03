---
type: feature-spec
feature: "ide"
cc_version: "2.1.161"
updated: "2026-06-03"
tags: ["ide", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.161 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ide`

> Analysis basis: CC v2.1.161 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.161

---

## Overview

The `/ide` command manages IDE integrations for Claude Code, allowing users to detect connected IDEs (VS Code, Cursor, Windsurf, JetBrains, etc.), open the current project in a detected IDE, and display real-time connection status. When invoked with the optional `open` subcommand, it attempts to open the project directory in the best available IDE. Without arguments, it presents an interactive status panel showing which IDEs are detected and their connection state.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ide` |
| description | `Manage IDE integrations and show status` |
| argumentHint | `[open]` |
| module_id | `$p1` |
| load_inline | `true` |
| loc_byte | `11455949` |
| loc_byte_end | `11456105` |
| loc_line | `7390` |
| arbor_handler.name | `kDf` |
| arbor_handler.fqn | `claude-2.1.161::kDf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.161 bundle.js:+11455949

---

## Input Branching

The command has 4+ distinct branches depending on the argument, detection results, and user selections, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/ide [open]"]) --> B{Parse argument}
    B -->|arg == "open"| C[Detect IDEs via ideDetect]
    B -->|no arg| D[Render status panel / JSX component]

    C --> E{IDEs found?}
    E -->|none| F["Show: 'No IDEs with Claude Code extension detected.'"]
    F --> Z([Exit])

    E -->|one found| G[Use that IDE directly]
    E -->|multiple found| H[Show interactive IDE selector]
    H --> I{User selects?}
    I -->|cancels| J["Show: 'No IDE selected.' / emit ide_selection_cancelled"]
    J --> Z
    I -->|selects IDE| G

    G --> K{Open project}
    K -->|success| L["Emit tengu_ext_ide_command / ide_open_project telemetry"]
    L --> M{Open mode}
    M -->|worktree present| N[Open worktree path]
    M -->|no worktree| O[Open project directory]
    N --> Z
    O --> Z

    K -->|failure| P["Emit ide_open_project_failed telemetry"]
    P --> Q["Show: 'Exited without opening IDE'"]
    Q --> Z

    D --> R{IDE connection state}
    R -->|connected| S[Show connected IDE status with mcp__ide__ tool list]
    R -->|connecting / timeout| T["Emit ide_connect_timeout; show 'Error connecting to IDE.'"]
    R -->|disconnected| U[Show disconnected status]
    S --> Z
    T --> Z
    U --> Z
```

---

## Behavioral Spec

### Main Handler (`kDf`)

The primary async handler `kDf` (resolved via `module_id` → `$p1`) orchestrates the entire `/ide` command flow.

Analysis basis: CC v2.1.161 bundle.js:+11452063

```
async function ideCommandHandler(args, context):
    emit telemetry("tengu_ext_ide_command")   // always fires on entry

    subcommand = args[0] ?? null

    if subcommand == "open":
        return await openIDEFlow(context)
    else:
        return renderIDEStatusPanel(context)
```

### IDE Detection (`U$8` → `p$8` → `reL`)

The detection sub-system collects running IDE processes and validates their socket paths.

Analysis basis: CC v2.1.161 bundle.js:+11452223

```
async function detectIDEs(context):
    candidates = await resolveIDECandidates()      // p$8: parallel resolution
    results    = await Promise.all(
                     candidates.map(c => resolveCandidate(c))  // reL per candidate
                 )

    for each candidate in results:
        validate socket path (startsWith, endsWith checks)
        check homedir for ".claude/ide" directory
        skip WSL paths matching "/mnt/c/Users" + excluded dirs
            excluded: ["Public", "Default", "Default User", "All Users"]
        resolve realpath; deduplicate via seen-set

    return validated IDE list
```

Excluded system user directories (WSL/Windows): `Public`, `Default`, `Default User`, `All Users`.
Analysis basis: CC v2.1.161 bundle.js:+5383371

Detection falls back to a `ps aux` grep on Linux:

```
ps aux | grep -E "code|cursor|windsurf|idea|pycharm|webstorm|phpstorm|
                   rubymine|clion|goland|rider|datagrip|dataspell|
                   aqua|gateway|fleet|android-studio" | grep -v grep
```

Analysis basis: CC v2.1.161 bundle.js:+5390062

Telemetry emitted by detection:
- `ide_detect` — on successful scan
- `ide_detect_failed` — on scan error

Analysis basis: CC v2.1.161 bundle.js:+5386529, +5386593

### IDE Selector (`_H7` / `BX` / `QGH`)

When multiple IDEs are detected, an interactive selector is rendered.

Analysis basis: CC v2.1.161 bundle.js:+5389173

```
function renderIDESelector(ideList):
    display list with display names:
        "vscode"   → VS Code
        "cursor"   → Cursor
        "windsurf" → Windsurf
        "jetbrains"→ JetBrains family
        "appcode"  → AppCode
        "linux"    → Linux detected IDE

    await user selection
    if cancelled:
        emit literal "IDE selection cancelled"   // +11455331
        return null
    return selectedIDE
```

Analysis basis: CC v2.1.161 bundle.js:+11452478, +11452519, +11452560

### Open Project Flow

Analysis basis: CC v2.1.161 bundle.js:+11452185

```
async function openIDEFlow(context):
    ideList = await detectIDEs(context)

    if ideList is empty:
        display "No IDEs with Claude Code extension detected."   // +11452280
        return

    selected = ideList.length == 1
                   ? ideList[0]
                   : await renderIDESelector(ideList)

    if selected is null:
        display "No IDE selected."                               // +11452418
        return

    targetPath = context.worktree ?? context.projectDir         // +11452652/+11452663
    result = await selected.openProject(targetPath)

    if result.ok:
        emit telemetry "ide_open_project"                        // +11452618
    else:
        emit telemetry "ide_open_project_failed"                 // +11452725
        display "Exited without opening IDE"                     // +11453015
```

### Status Panel Component (`Mp1`)

When no subcommand is given, a JSX status panel is rendered showing live IDE connection state.

Analysis basis: CC v2.1.161 bundle.js:+11453951

```
function IDEStatusPanel(props):
    appState        = useAppState()        // via $6 / n2_
    ideConnected    = appState.ideConnected
    connectionState = appState.ideConnectionState

    useEffect(() => {
        attempt connection to IDE socket
        protocol variants tried: "sse-ide", "ws-ide"             // +11450050, +11450070
        emit "ide_connect" telemetry on attempt                  // +11454168
        on success: emit "ide_connect" ok
        on failure: emit "ide_connect_failed"                    // +11454255
        on timeout: emit "ide_connect_timeout"                   // +11454362
                    display "Error connecting to IDE."           // +11454480
    }, [])

    if connected:
        list MCP tools prefixed "mcp__ide__"                     // +11454758
        show IDE type badge

    if timeout / error:
        show "Error connecting to IDE."
        suggest "restart your IDE"                               // +11453283

    on disconnect:
        emit "ide_disconnect" telemetry                          // +11454861
```

### Install Extension Helper (`Pk_` / `_H7`)

When an IDE is detected but the Claude Code extension is not installed, an installation prompt is rendered.

Analysis basis: CC v2.1.161 bundle.js:+11453148

```
function renderInstallExtensionPrompt(ide, onInstallCallback):
    // onInstallCallback wired to _.onInstallIDEExtension   // +11453192
    display extension marketplace URL per IDE type
    on user confirm: invoke onInstallCallback(ide)
```

### IDE Type Normalisation (`BW`)

Analysis basis: CC v2.1.161 bundle.js:+5390937

```
function normaliseIDEType(rawName):
    lower = rawName.toLowerCase()
    // extract relevant segment using eq (indexOf + slice)
    basename = path.basename(lower)
    // map to canonical: vscode / cursor / windsurf / jetbrains / appcode
    return canonicalName ?? rawName
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_ext_ide_command` | Emitted on every invocation of `/ide` (bundle.js:+11452065) |
| Telemetry — `ide_detect` | Emitted after IDE scan succeeds (bundle.js:+5386529) |
| Telemetry — `ide_detect_failed` | Emitted when IDE scan throws (bundle.js:+5386593) |
| Telemetry — `ide_open_project` | Emitted after project is opened in IDE (bundle.js:+11452618) |
| Telemetry — `ide_open_project_failed` | Emitted when IDE open returns a failure (bundle.js:+11452725) |
| Telemetry — `ide_connect` | Emitted when IDE socket connection is attempted (bundle.js:+11454168) |
| Telemetry — `ide_connect_failed` | Emitted on connection error (bundle.js:+11454255) |
| Telemetry — `ide_connect_timeout` | Emitted on connection timeout (bundle.js:+11454362) |
| Telemetry — `ide_disconnect` | Emitted when IDE connection drops (bundle.js:+11454861) |
| appState changes | Updates IDE connection state fields read by status panel via `useSyncExternalStore` |
| MCP tool prefix | Connected IDE exposes tools prefixed `mcp__ide__` (bundle.js:+11454758) |
| Socket protocols | Attempts `sse-ide` then `ws-ide` protocols (bundle.js:+11450050, +11450070) |
| Extension install hook | `_.onInstallIDEExtension` callback registered by UI (bundle.js:+11453192) |
| Sound | None observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.161 | Initial analysis |

---

## Common Mistakes

1. **Running `/ide open` without an active IDE session**: If no IDE with the Claude Code extension is running, the command exits immediately with "No IDEs with Claude Code extension detected." — start the IDE and install the extension first.
2. **Confusing `/ide` (status) with `/ide open`**: The bare command renders a live connection status panel; it does not open a new IDE window. Use `/ide open` to launch or switch focus to an IDE.
3. **WSL users referencing Windows system profiles**: Paths under `/mnt/c/Users/Public`, `/mnt/c/Users/Default`, `/mnt/c/Users/Default User`, and `/mnt/c/Users/All Users` are explicitly excluded from IDE discovery and will never be matched.
4. **Multiple IDEs detected — selection required**: If more than one compatible IDE is running, the command presents an interactive selector. Pressing Escape cancels the flow without opening any IDE.
5. **IDE connection timeout misread as a bug**: The `ide_connect_timeout` event and the message "Error connecting to IDE." indicate the socket handshake exceeded the allowed window; the suggested fix is to restart the IDE so the extension re-registers its socket.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `kDf` | Main async handler for `/ide` command (Arbor-resolved entry point) |
| `X6A` | Inner command dispatcher / argument parser called from handler |
| `h6` | Session/context accessor utility |
| `sg6` | Store getter (reads from `ag6` store) |
| `ji` | Secondary context helper invoked by store getter |
| `P_` | Logger / output channel writer |
| `XN` | Low-level write primitive |
| `U$8` | IDE detection orchestrator (wraps `p$8` and `reL`) |
| `p$8` | Candidate resolution loop (`Promise.all` over IDE paths) |
| `reL` | Single-IDE-path resolver (homedir, symlink, realpath checks) |
| `neL` | Candidate normalisation wrapper around `FL_` |
| `FL_` | IDE entry parser / port extractor (uses `parseInt`, `isNaN`) |
| `h_` | IDE entry data-class constructor |
| `_H7` | IDE selector list builder (filters by type, builds display entries) |
| `BX` | IDE picker UI component wrapper |
| `QGH` | Interactive selector component (renders IDE list, handles choice) |
| `BW` | IDE type normaliser (lowercase, basename, canonical mapping) |
| `eq` | String segment extractor (indexOf + slice) |
| `SA9` | Regex match helper for IDE name patterns |
| `b09` | Process kill helper used during detection cleanup |
| `Pk_` | Extension install prompt renderer |
| `Mp1` | IDE status panel JSX component (main UI for bare `/ide`) |
| `$6` | AppState hook accessor (`useSyncExternalStore` wrapper) |
| `n2_` | Context guard for AppState provider |
| `qA` | Secondary AppState hook |
| `lf` | Ref/memo hook composite used inside status panel |
| `Ek` | Cleanup / effect teardown coordinator |
| `t86` | Hash-based cache key builder |
| `OaH` | SHA-256 hashing helper (`createHash`) |
| `Tv` | MCP job-state connector referenced by status panel |
| `DM` | IDE open-project dispatcher |
| `m$8` | IDE display-name formatter |
| `TDf` | IDE status badge renderer |
| `ya` | Extension install suggestion renderer |
| `b8` | IDE entry builder used by selector |
| `FI` | Path join / resolve utility |
| `pH` | String coercion helper |
| `N6` | Low-level write helper (wraps `XN`) |
| `hH` | Log helper (error level) |
| `RH` | Log helper (info level) |
| `d` | Debug/trace logger |
| `v8` | Error code classifier |
| `k8` | Error guard / rethrow utility |
| `yH` | Error logger with `ri.logError` |
| `SH` | JSON stringify wrapper |
| `m6` | JSON parse wrapper |
| `TH` | String coercion wrapper |
| `i6` | Conditional logger / no-op guard |
| `df` | Error-with-code factory |
| `H` | Bootstrap fetch / HTTP utility module |
| `N` | Command string builder / formatter |
| `Z4` | Path segment extractor (lastIndexOf + slice) |
| `IBK` | File-write orchestrator (atomic append pipeline) |
| `WmH` | Debounced flush scheduler (clearTimeout / setTimeout / setImmediate) |
| `_3H` | Write queue assembler |
| `NBK` | Atomic append writer (mkdir + appendFile) |
| `BJA` | Target path builder (path.join + N6) |
| `UJA` | File rename/unlink handler (stat + rename + unlink) |
| `gJA` | Write gate / capacity checker |
| `Y9` | Hook registrar (`tYA.register`) |
| `XOA` | Daemon workspace manager (roster, job tracking, cleanup) |
| `DOA` | Background session claim handler |
| `FLA` | Auth-file writer for IDE socket |
| `nk6` | Socket-path builder (`F3.join`) |
| `cHA` | Auth directory resolver |
| `w` | Daemon worker lifecycle manager (spawn, monitor, retire) |
| `S` | Worker write channel |
| `D` | Supervisor write/update controller |
| `G` | Remote-control input handler |
| `Y` | Forced-shutdown coordinator |
| `z` | Daemon stop orchestrator |
| `ly` | Daemon-stop event emitter |
| `qp` | Graceful-shutdown race (Promise.race + process.exit) |
| `W` | MCP connection manager |
| `j` | Worker map iterator |
| `o` | MCP update applicator |
| `i` | MCP inbound message handler |
| `c` | Connection cleanup handler |
| `Y95` | Full daemon protocol handler (ping, nudge, yield, lease, dispatch, reply, attach, resize, snapshot, stream, state, subscribe) |
| `WSK` | Request timeout and retry scheduler |
| `D95` | Attach-stall watchdog |
| `z95` | Stall metric recorder |
| `l` | Scheduled-task loop manager |
| `I` | Away-summary generator |
| `rj6` | Pins file reader |
| `WbL` | Job directory scanner |
| `J19` | Job directory initialiser |
| `q1` | Job state file reader/writer |
| `lD` | Active-state aggregator |
| `nV` | Active-state snapshot builder |
| `W5` | Job config file writer |
| `Fj` | Job config cleaner |
| `e_6` | Extension config writer |
| `pF` | Roster entry parser |
| `Kzf` | Roster directory initialiser |
| `n5H` | PTY-pids file path builder |
| `HbH` | PTY directory path builder |
| `AT` | PTY-pids entry writer |
| `mF` | PTY socket path builder |
| `gHA` | PTY auth file resolver |
| `s_6` | PTY socket directory resolver |
| `ER8` | Memory-pressure checker |
| `j6` | Job table updater |
| `Lq8` | Job deduplication tracker |
| `y6` | Job state machine updater |
| `C` | Rate-limit event emitter |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.