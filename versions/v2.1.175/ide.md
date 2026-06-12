---
type: feature-spec
feature: "ide"
cc_version: "2.1.175"
updated: "2026-06-12"
tags: ["ide", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.175 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ide`

> Analysis basis: CC v2.1.175 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.175

---

## Overview

The `/ide` command manages IDE integrations for Claude Code, allowing users to detect connected IDEs, view their status, and optionally open a project inside a detected IDE. It operates by scanning for running IDE processes, matching them against known IDE identifiers, and — when the optional `open` sub-command is given — establishing or confirming a live MCP connection to the selected IDE extension.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ide` |
| description | `Manage IDE integrations and show status` |
| argumentHint | `[open]` |
| module_id | `t6K` |
| load_inline | `true` |
| loc_byte | `11841890` |
| loc_byte_end | `11842046` |
| loc_line | `7598` |
| arbor_handler.name | `Pu7` |
| arbor_handler.fqn | `claude-2.1.175::Pu7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.175 bundle.js:+11841890

---

## Input Branching

The command has four or more distinct execution paths depending on argument value, IDE detection results, connection state, and whether a connection attempt succeeds or times out.

```mermaid
flowchart TD
    A["/ide [args]"] --> B{args provided?}
    B -- "no args" --> C[Detect running IDEs\nShow status only]
    B -- "args = 'open'" --> D[Detect running IDEs]
    D --> E{Any IDEs detected?}
    E -- "none found" --> F[Emit: 'No IDEs with Claude Code\nextension detected.'\ntelemetry: tengu_ext_ide_command]
    E -- "one found" --> G[Auto-select that IDE]
    E -- "multiple found" --> H[Prompt user to select IDE]
    H --> I{User selects?}
    I -- "cancelled" --> J[Emit: 'IDE selection cancelled'\ntelemetry: tengu_ext_ide_command]
    I -- "selected" --> G
    G --> K[Attempt MCP connection\nto selected IDE extension]
    K --> L{Connection result}
    L -- "success" --> M[Emit success status\ntelemetry: ide_connect\ntelemetry: ide_open_project]
    L -- "failed" --> N[Emit: 'Error connecting to IDE.'\ntelemetry: ide_connect_failed\ntelemetry: ide_open_project_failed]
    L -- "timeout" --> O[Emit timeout notice\ntelemetry: ide_connect_timeout]
    C --> P[Render IDE status JSX\n(list connected IDEs or\n'No IDE selected.')]
```

Analysis basis: CC v2.1.175 bundle.js:+11838006 (handler entry `Pu7`), +11838114 (`"open"` literal), +11838223 (`"No IDEs with Claude Code extension detected."` literal), +11838361 (`"No IDE selected."` literal)

---

## Behavioral Spec

### Top-Level Handler (`Pu7`)

The main async handler for `/ide` is the function identified as `Pu7` by Arbor (resolution path: `module_id → t6K`).

```
async function ideCommandHandler(args, context):
    // Emit initial telemetry
    emit telemetry("tengu_ext_ide_command")

    // Read the first argument
    subCommand = args[0]  // expected: "open" or absent

    // Retrieve current IDE connection state from app store
    connectionState = getAppState()  // via b6 → Pa6 → Xa6.getStore

    if subCommand == "open":
        // Detect running IDEs
        detectedIDEs = await detectIDEs()  // via IP8 → hP8 → bZL

        if detectedIDEs is empty:
            return renderMessage("No IDEs with Claude Code extension detected.")

        // If multiple IDEs, present selection UI
        if detectedIDEs.length > 1:
            selectedIDE = await promptUserToSelect(detectedIDEs)
            if selectedIDE is null:
                return renderMessage("IDE selection cancelled")
        else:
            selectedIDE = detectedIDEs[0]

        // Attempt to open/connect
        result = await connectToIDE(selectedIDE)  // via s6K component → MCP connection

        if result.status == "success":
            emit telemetry("ide_open_project")
            return renderSuccess(selectedIDE)
        else if result.timedOut:
            emit telemetry("ide_connect_timeout")
            return renderMessage("Error connecting to IDE.")
        else:
            emit telemetry("ide_open_project_failed")
            return renderMessage("Error connecting to IDE.")
    else:
        // Status-only display
        if connectionState has no connected IDE:
            return renderMessage("No IDE selected.")
        else:
            return renderStatusView(connectionState)
```

Analysis basis: CC v2.1.175 bundle.js:+11838006, +11838114, +11838128, +11838152, +11838221, +11838361, +11838394, +11838416, +11838459, +11838556, +11838620, +11838644

### IDE Detection (`IP8` / `hP8` / `bZL`)

Detection enumerates running processes and file-system markers to find supported IDEs.

```
async function detectInstalledIDEs(platformInfo):
    candidates = []

    // Enumerate lock-file based sockets (hP8 → bZL)
    lockFilePaths = scanForLockFiles()  // uses ".lock" suffix (bundle.js:+6591941)
    for each lockFile in lockFilePaths:
        entry = parseLockEntry(lockFile)
        if entry is valid directory and not excluded:
            // Exclude: Public, Default, Default User, All Users (WSL paths)
            candidates.push(entry)

    // On Linux, also grep for running processes (gZL)
    if platform == "linux":
        psOutput = exec("ps aux | grep -E \"code|cursor|windsurf|...\" | grep -v grep")
        // (bundle.js:+6600002 — long grep pattern covers VS Code, Cursor, Windsurf,
        //  JetBrains family, Fleet, Android Studio, etc.)
        parse psOutput for IDE names

    // Normalise and deduplicate
    return deduplicate(candidates)
```

Supported IDE name tokens recognised during normalisation (from `_c9` / `yP8`):

| Token | IDE |
|---|---|
| `windsurf` | Windsurf |
| `devin` | Devin Desktop |
| `cursor` | Cursor |
| `insiders` | VS Code Insiders |
| `vscode` / `vs code` / `visual studio code` | VS Code |
| `vscodium` / `code - oss` / `codium` | VSCodium |
| `jetbrains` / `appcode` | JetBrains family |

Analysis basis: CC v2.1.175 bundle.js:+6596152 (`IP8`), +6591831 (`bZL`), +6598072 (`_c9`), +6598515 (`yP8`), +6600002 (ps-grep literal), +6598422 (`"Devin Desktop"`)

Telemetry emitted on detect completion:
- `ide_detect` (bundle.js:+6596632)
- `ide_detect_failed` (bundle.js:+6596696) — on detection error path

### IDE Connection / Open (`s6K` React component)

When the user selects an IDE and the `open` sub-command is active, a React component (`s6K`) manages the connection lifecycle using React hooks (`useState`, `useRef`, `useEffect`, `useCallback`).

```
function IDEConnectComponent(props):
    [status, setStatus] = useState("pending")
    connectionRef = useRef(null)

    useEffect():
        setStatus("pending")
        emit telemetry("ide_connect")

        connectPromise = establishMCPConnection(selectedIDE)
            // connects via WebSocket to "ws:" endpoint (bundle.js:+11840919)
            // checks for "mcp__ide__" prefixed tools (bundle.js:+11840699)

        connectPromise
            .then(result):
                setStatus("connected")
                // Open project in IDE
                openProjectInIDE(worktree or project path)
                    // telemetry: ide_open_project (bundle.js:+11838559)
                    // context: "worktree" | "project" (bundle.js:+11838593, +11838604)
            .catch(error):
                if error.isTimeout:
                    emit telemetry("ide_connect_timeout")
                else:
                    emit telemetry("ide_connect_failed")
                setStatus("error")
                renderMessage("Error connecting to IDE.")

    onDisconnect():
        emit telemetry("ide_disconnect")  // bundle.js:+11840802

    return renderStatusUI(status)
```

Analysis basis: CC v2.1.175 bundle.js:+11839892 (`s6K` useState), +11839970 (useRef), +11839984 (useEffect), +11840109 (`ide_connect`), +11840196 (`ide_connect_failed`), +11840303 (`ide_connect_timeout`), +11840421 (`"Error connecting to IDE."`), +11840699 (`"mcp__ide__"`), +11840802 (`ide_disconnect`), +11840919 (`"ws:"`)

### IDE Name Normalisation (`_G` / `hF_` / `gZL`)

Before display, IDE names are normalised to lower-case and matched against known display names.

```
function normaliseIDEName(rawName):
    lower = rawName.toLowerCase()
    // Map to canonical display form
    if lower includes "windsurf": return "Windsurf"
    if lower includes "devin":    return "Devin Desktop"
    if lower includes "cursor":   return "Cursor"
    if lower includes "insiders": return "VS Code Insiders"
    if lower includes any of ["vscode","vs code","visual studio code"]: return "VS Code"
    if lower includes any of ["vscodium","code - oss","codium"]: return "VSCodium"
    if lower includes "jetbrains" or "appcode": return "JetBrains"
    else: return basename(rawName)  // fallback
```

The display label `"IDE"` (bundle.js:+6600841) is used in UI headings.

Analysis basis: CC v2.1.175 bundle.js:+6600896 (`_G`), +6600528 (`hF_`), +6599080 (`gZL`)

### Status Display (no `open` argument)

When invoked without arguments, `Pu7` reads the MCP connection store (`b6` → `Pa6`) and renders a JSX status panel listing connected IDE(s). The connection display may include a "Connecting to …" prefix (bundle.js:+11841139) followed by IDE name fragments truncated with `", …"` (bundle.js:+11841660) when the list is long. The truncation threshold involves a `Math.floor` calculation with the literal `100` (bundle.js:+11841348) and `0` (bundle.js:+11841367).

Normalisation uses Unicode NFC form (`"NFC"`, bundle.js:+11841489) when comparing IDE paths.

Analysis basis: CC v2.1.175 bundle.js:+11841139, +11841348, +11841367, +11841452, +11841477, +11841489, +11841564, +11841623, +11841646, +11841660

### Fallback / Install Hint (`De`)

When no IDE extension is connected and the user may need guidance, the handler calls `De` (bundle.js:+11839160) to emit an install hint message referencing `"restart your IDE"` (bundle.js:+11839224). The `onInstallIDEExtension` callback is also triggered at bundle.js:+11839133.

Analysis basis: CC v2.1.175 bundle.js:+11839133, +11839160, +11839199, +11839224

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_ext_ide_command` (command invoked, bundle.js:+11838008); `ide_detect` (+6596632); `ide_detect_failed` (+6596696); `ide_open_project` (+11838559); `ide_open_project_failed` (+11838666); `ide_connect` (+11840109); `ide_connect_failed` (+11840196); `ide_connect_timeout` (+11840303); `ide_disconnect` (+11840802) |
| MCP side-effects | Establishes or queries a WebSocket MCP connection identified by the `"mcp__ide__"` tool-name prefix (+11840699); connection uses the `"ws:"` scheme (+11840919) |
| App state reads | Reads IDE connection state via `b6 → Pa6 → Xa6.getStore` (+11838152, +1052544) |
| App state writes | Connection status transitions (`"pending"` → connected / error) managed inside the `s6K` React component |
| React hooks used | `useState`, `useRef`, `useEffect`, `useCallback` (via `s6K`, +11839892 – +11840391) |
| File system (detection) | Reads `.lock` files under IDE socket directories; on Linux runs `ps aux` grep (+6591941, +6600002) |
| Hook registration | `onInstallIDEExtension` callback registered when no extension found (+11839133) |
| Sound | None observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.175 | Initial analysis |

---

## Common Mistakes

1. **Running `/ide` without `open` in a session with no IDE connected** will show `"No IDE selected."` — this is expected behaviour, not an error. To actually connect, use `/ide open`.
2. **Multiple IDEs detected** — the command will interactively prompt for selection. Cancelling the prompt produces `"IDE selection cancelled"` and exits cleanly; it does not leave a dangling connection.
3. **Connection timeouts** — if the IDE extension is installed but the IDE is not responding to the WebSocket (`"ws:"` endpoint), the command will emit `ide_connect_timeout` and display `"Error connecting to IDE."`. Restarting the IDE typically resolves this.
4. **WSL environments** — certain Windows user directory paths (`/mnt/c/Users/Public`, `Default`, `Default User`, `All Users`) are explicitly excluded from IDE detection to avoid false positives; this is intentional.
5. **Extension not installed** — the command detects the IDE process but cannot connect via `mcp__ide__` tools if the Claude Code extension has not been installed. The install hint (`"restart your IDE"`) is shown in this case.
6. **`open` is the only accepted sub-command** — any other argument is treated the same as no argument (status display only), because the branch checks for the string `"open"` exactly (bundle.js:+11838114).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Pu7` | Main async handler for `/ide` command (Arbor-resolved, `AsyncFunction`) |
| `EMA` | IDE status display renderer / connection list builder |
| `s6K` | React component managing IDE connect lifecycle (hooks: useState/useRef/useEffect/useCallback) |
| `IP8` | IDE detection orchestrator (async, coordinates `hP8` and platform-specific paths) |
| `hP8` | Lock-file based IDE socket scanner |
| `bZL` | Individual IDE socket path enumerator (homedir, WSL exclusions) |
| `RZL` | IDE entry result normaliser |
| `iD_` | IDE descriptor parser (spawns shell, parses output) |
| `c_` | IDE connection record constructor |
| `_c9` | IDE name classifier (windsurf/devin/cursor checks) |
| `yP8` | IDE name secondary classifier (vscodium/codium/.cmd checks) |
| `_G` | IDE display-name normaliser (toLowerCase + basename fallback) |
| `hF_` | IDE name canonicaliser (wraps `gZL`) |
| `gZL` | IDE name-to-display-label mapping (Object.entries iteration) |
| `b6` | App state reader (connection state getter) |
| `Pa6` | Store accessor (calls `Xa6.getStore`) |
| `W_` | Utility: async wait / poll helper |
| `iG` | Underlying async primitives helper |
| `D` | Background session / daemon interaction handler |
| `dTA` | Daemon claim / socket connection manager |
| `oTA` | Session lifecycle manager (roster, file cleanup) |
| `M` | MCP server manager (connect/disconnect orchestrator) |
| `DCH` | MCP server connection dispatcher |
| `sGA` | MCP connection state applier |
| `ki8` | MCP connection result applier |
| `AG` | MCP cleanup orchestrator |
| `De` | Install-hint / extension-missing feedback emitter |
| `wu7` | Post-connection UI update helper |
| `b8` | Connection record builder |
| `SD` | Session disposal helper |
| `eM` | App state context accessor |
| `b` | Background session create/manage entry point |
| `NcK` | Scheduled task display formatter |
| `uN` | Cron expression parser |
| `B1H` | Background session sync helper |
| `f8H` | Feature flag / has-check helper |
| `btH` | Background session file writer (`.claude` directory) |
| `yf` | Directory path resolver |
| `TH` | String coercion utility |
| `RH` | JSON stringify wrapper |
| `SH` | Log error emitter |
| `N9` | Error code classifier |
| `y8` | ENOENT/EACCES/EPERM etc. error filter |
| `E8` | Base error constructor helper |
| `d6` | JSON.parse wrapper |
| `Vq` | Job state file reader/writer |
| `ZO` | Active-state sentinel helper |
| `dXH` | Diff/patch helper for file changes |
| `n7` | Atomic file writer (uses `JO`) |
| `JO` | Safe file write (randomBytes temp name, rename) |
| `ef6` | Roster file read/write coordinator |
| `sQ` | Roster JSON parser and updater |
| `lb7` | Roster file write helper |
| `mu6` | Socket path builder |
| `uu6` | Socket directory path helper |
| `aQ` | Roster entry builder |
| `sf6` | PTY path builder |
| `pu6` | Socket cleanup path builder |
| `OOH` | Roster socket path getter |
| `uZ` | Socket file unlink helper |
| `LXA` | Daemon claim file writer |
| `qV5` | Claim send / connection probe |
| `KV5` | Unix socket connect helper |
| `AV5` | Claim frame builder |
| `Xv` | Binary frame encoder |
| `Pm8` | Binary frame decoder |
| `YV5` | Daemon protocol message handler (large dispatch) |
| `P` | Daemon client connection (buffer/socket manager) |
| `Q` | Background PTY session manager |
| `l` | Scheduled task runner |
| `fE6` | Scheduled task next-fire calculator |
| `OD8` | Scheduled task catch-up calculator |
| `F` | Idle-exit timer manager |
| `w` | Supervisor / daemon reload handler |
| `_ZH` | Daemon config reload helper |
| `eXK` | Column-width formatter for status display |
| `gsK` | Heartbeat emitter |
| `S` | Daemon MCP file watcher |
| `csK` | File realpath/stat checker |
| `kV5` | JetBrains socket path finder |
| `c` | IDE socket file reader/unlinker |
| `Su6` | Socket file reader |
| `_HK` | Socket file unlinker |
| `Ls` | Hostname normaliser |
| `kLH` | Hostname trim helper |
| `K` | IDE padded name formatter |
| `ng8` | Low-memory checker |
| `z6` | macOS memory stats reader |
| `Rm` | Memory value formatter |
| `p58` | Memory alert deduplicator |
| `C6` | Memory alert sender |
| `UG6` | Pin file reader (`pins.json`) |
| `ZS_` | Pin path builder |
| `_Z` | Jobs directory path builder |
| `f8L` | Pinned jobs directory scanner |
| `Bj9` | Pin file atomic writer |
| `xz` | Pin validation helper |
| `vaK` | MCP transport type enumerator |
| `J56` | MCP transport key extractor |
| `W` | MCP server connection initiator |
| `GA` | Error/String coercion helper |
| `Vi` | MCP server config validator |
| `eV` | MCP server config filter |
| `n8` | Config presence checker |
| `Hi9` | MCP connect attempt logger |
| `RJ8` | MCP retry scheduler |
| `yJ8` | MCP success logger |
| `z8` | MCP debug logger |
| `DP8` | MCP stdio/SSE connection handler |
| `jP8` | MCP OAuth completion handler |
| `nN` | MCP skills telemetry emitter |
| `$i9` | MCP reconnect attempt helper |
| `$F_` | MCP failure logger |
| `YCH` | MCP connection state updater |
| `X66` | MCP log helper |
| `Ki9` | MCP known-server checker |
| `W66` | MCP integer parser (port) |
| `D28` | MCP integer parser (timeout) |
| `oB_` | MCP capability checker |
| `tX8` | MCP tool-set capability checker |
| `sd9` | Process kill helper |
| `rw9` | Path match helper |
| `Ac9` | IDE name replacement normaliser |
| `Oc9` | IDE path filter |
| `K6` | String coercion wrapper |
| `D6` | App state store hook |
| `ky_` | App state context accessor |
| `EA` | App state secondary accessor |
| `f7` | Theme/display context hook |