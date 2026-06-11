---
type: feature-spec
feature: "copy"
cc_version: "2.1.168"
updated: "2026-06-11"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.168 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.168 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.168

---

## Overview

`/copy` copies Claude's most recent assistant response to the system clipboard. An optional numeric argument `N` selects the Nth-latest assistant message instead of the most recent one. The command uses platform-specific clipboard utilities (`pbcopy`, `wl-copy`, `xclip`, `xsel`, `powershell.exe`, or terminal escape sequences) to write the extracted text.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `Npq` |
| load_inline | `true` |
| loc_byte | `11032043` |
| loc_byte_end | `11032229` |
| loc_line | `7352` |
| arbor_handler.name | `cwf` |
| arbor_handler.fqn | `claude-2.1.168::cwf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.168 bundle.js:+11032043

---

## Input Branching

The handler has three distinct top-level branches (no argument / valid integer N / invalid argument) and further sub-branches for clipboard backend selection — a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument present?}
    B -- No --> C[Use N=1 (most recent)]
    B -- Yes --> D{Number.isInteger(Number(arg))?}
    D -- No --> E[Return error: not a valid integer]
    D -- Yes --> F[Use N = parsed integer]
    C --> G[Filter conversation messages for role=assistant]
    F --> G
    G --> H{Nth assistant message found?}
    H -- No --> I["Return 'No assistant message to copy'"]
    H -- Yes --> J[Extract text content from message]
    J --> K[Render message to plaintext via renderToPlaintext]
    K --> L[Write text to clipboard]
    L --> M{Platform?}
    M -- macOS/iTerm2/tmux --> N[pbcopy / tmux load-buffer / OSC52 escape]
    M -- Linux Wayland --> O[wl-copy]
    M -- Linux X11 --> P[xclip or xsel --clipboard]
    M -- Windows/WSL --> Q["powershell.exe -Command Set-Clipboard"]
    M -- Kitty terminal --> R[Kitty clipboard protocol]
    N --> S[Emit tengu_copy telemetry]
    O --> S
    P --> S
    Q --> S
    R --> S
    S --> T[Return success JSX confirmation]
    I --> U[Return JSX error]
    E --> U
```

---

## Behavioral Spec

### Main Handler — `cwf` (async)

Analysis basis: CC v2.1.168 bundle.js:+11031228

```
async function handleCopyCommand(context):
    arg = context.input.trim()

    // Determine which Nth-latest assistant message to copy
    if arg is empty:
        targetIndex = 1            // most recent
    else:
        n = Number(arg)
        if not Number.isInteger(n):
            return errorJSX("No assistant message to copy")
        targetIndex = n

    // Retrieve conversation message list
    messages = getMessagesFromContext(context)   // field key "messages"

    // Filter to assistant-role messages only (literal: "assistant")
    assistantMessages = filterMessagesByRole(messages, "assistant")

    // Select Nth-latest (1-indexed from the end)
    selected = assistantMessages[ assistantMessages.length - targetIndex ]
    if selected is undefined:
        return errorJSX("No assistant message to copy")  // literal at +11031269

    // Convert message content to plain text
    plainText = renderMessageToPlaintext(selected)       // via Epq, sK, Zpq pipeline

    // Write to clipboard
    writeToClipboard(plainText)                          // via B_A → $G → platform dispatch

    // Emit telemetry
    emit("tengu_copy")                                   // loc_byte: +11031647

    return successJSX(plainText)
```

### Plaintext Rendering Pipeline — `Epq` / `sK` / `Zpq`

Analysis basis: CC v2.1.168 bundle.js:+11027246, +10752403, +11027341

```
function renderMessageToPlaintext(message):
    blocks = []
    if Array.isArray(message.content):
        textBlocks = filterToTextBlocks(message.content)  // sK: filter where type="text"
        for block in textBlocks:
            blocks.push(block.text)
    else:
        blocks.push(message.content)

    // Normalize line endings and strip trailing whitespace
    joined = blocks.join("")
    normalized = joined.replace(escapedPipePattern, "|")  // Zpq, literal "\\|" at +11026357
    return normalized
```

### Table-Format Renderer — `Gpq`

Analysis basis: CC v2.1.168 bundle.js:+11026279, +11026330, +11026416

The renderer `Gpq` is invoked for structured/table content within a message. It:

1. Maps message content blocks through `Bwf` to produce row arrays.
2. Splits columns on the pipe separator `" | "` (literal at +11026516).
3. Computes minimum column width of 3 (literal at +11026416) and measures each cell via `Bun.stringWidth` (through `H8`, +11026432).
4. Pads cells with `Math.max`-bounded widths.
5. Supports alignment tokens: `"center"` (+11026551), `"right"` (+11026593), `"left"` (+11026633).
6. Outputs a formatted plain-text table with `" | "` separators.

```
function renderTable(contentBlocks):
    rows = contentBlocks.map(toRowArray)           // via Bwf
    columnWidths = computeColumnWidths(rows, minWidth=3)
    alignments = detectAlignments(rows)            // center / right / left
    return rows.map(row =>
        row.map((cell, i) => padCell(cell, columnWidths[i], alignments[i]))
            .join(" | ")
    ).join("\n")
```

### Clipboard Write — `B_A` → `$G` → Platform Dispatch

Analysis basis: CC v2.1.168 bundle.js:+11027592, +3438230, +3438464

The clipboard writer (`B_A`) invokes the cross-platform writer (`$G`). Platform detection and dispatch:

```
async function writeToClipboard(text):
    encoded = Buffer.from(text, "utf8").toString("base64")  // literals "utf8", "base64" at +3438199/3438216

    terminalEnv = detectTerminalEnvironment()

    if terminalEnv is "iTerm2":                             // literal at +3438026
        use tmux load-buffer with -w flag                   // literals at +3438036, +3438070
        timeout = 2000 ms                                   // literal at +3438430

    else if terminalEnv is "tmux":                          // literal at +3438098
        use tmux load-buffer

    else if terminalEnv is "kitty":                         // literal at +3437266
        use Kitty OSC 52 / clipboard escape sequence
        // escape sequence uses "\x1b\x1b" prefix           // literal at +3437394

    else if platform is "linux":                            // literal at +3437725
        try in order:
            "wl-copy"                                       // literal at +3437795
            "xclip" with args ["-selection", "clipboard"]   // literals at +3437864, +3438657
            "xsel"  with args ["--clipboard", "--input"]    // literals at +3437905, +3438744, +3438758

    else if platform is "darwin" (macOS):
        use "pbcopy"                                        // literal at +3438464

    else if platform is "wsl" or "windows":                 // literals at +3438820, +3438923 ("powershell")
        use "powershell.exe" with args                      // literal at +3438830
            ["-NoProfile", "-NonInteractive", "-Command",   // literals at +3438848, +3438861, +3438879
             "Set-Clipboard -Value <text>"]

    spawn chosen process, pipe text as stdin
    await completion with timeout 2000 ms                   // literal at +3438430
```

### Temporary Directory for Clipboard Intermediary — `lj`

Analysis basis: CC v2.1.168 bundle.js:+4023678, +4023099, +4023780

Some clipboard paths write content via a temporary file:

```
function ensureClipboardTmpDir():
    baseTmpDir = env.CLAUDE_CODE_TMPDIR ?? "/tmp"           // literal at +4023099
    path = join(baseTmpDir, ...)
    mkdir(path, { recursive: true })
    chmod(path, 0o700)                                      // octal 448 decimal at +4023780
    // Also validates directory ownership to avoid symlink attacks
    // Error string: "Set CLAUDE_CODE_TMPDIR to a directory you control..." at +4023174
    return path
```

### Argument Parsing Detail — `Tpq` / `Uwf`

Analysis basis: CC v2.1.168 bundle.js:+11026827, +11026994, +11026054

```
function parseCommandArgs(rawInput):
    tokens = lexer.tokenize(rawInput)         // v$.lexer at +11026827
    idx = tokens.indexOf(commandName)
    remaining = tokens.slice(idx + 1)         // Tpq, +11026994
    // Uwf normalizes tokens: strips ANSI escapes via jPH (+11026063),
    // collects non-flag tokens into array
    return remaining
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (loc_byte: +11031647) — fired after successful clipboard write |
| Clipboard | Writes plain-text content of the selected assistant message to the OS clipboard |
| Temporary files | May create a temp file under `CLAUDE_CODE_TMPDIR` or `/tmp` during clipboard write, cleaned up after spawn |
| appState changes | None observed in depth-2 traversal |
| Hook registration | None observed in depth-2 traversal |
| Sound | None observed in depth-2 traversal |
| Process spawning | Spawns one of: `pbcopy`, `wl-copy`, `xclip`, `xsel`, `powershell.exe`, or `tmux` as a child process |

---

## Version History

| Version | Change |
|---|---|
| v2.1.168 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy foo` will fail because `Number("foo")` is `NaN` and `Number.isInteger(NaN)` is `false`. Always pass a positive integer or no argument.
2. **Index out of range** — `/copy 5` when there are fewer than five assistant messages returns "No assistant message to copy". The index is 1-based and counts backwards from the most recent.
3. **Clipboard utility not installed on Linux** — On X11 systems without `xclip` or `xsel`, and Wayland systems without `wl-copy`, the write will fail silently or error. Install the appropriate utility.
4. **WSL clipboard forwarding** — In WSL environments, the command delegates to `powershell.exe`. If Windows PowerShell is not accessible from the WSL PATH, the copy will fail.
5. **tmux / iTerm2 environment detection** — The command detects the terminal multiplexer from environment variables. Running Claude Code inside a nested `screen` session without tmux set in `$TERM` or `$TMUX` may cause incorrect backend selection.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `cwf` | Main async handler for `/copy` command (Arbor-resolved) |
| `Gpq` | Table content renderer (formats columnar data with alignment) |
| `Bwf` | Row-array mapper used by table renderer |
| `Tpq` | Command argument parser (lexer-based token splitter) |
| `Uwf` | Argument normalizer (strips ANSI, collects token array) |
| `jPH` | ANSI escape strip helper used by argument normalizer |
| `Epq` | Message content extractor (array vs scalar branch) |
| `sK` | Text-block filter (keeps only `type="text"` content blocks) |
| `Zpq` | Plaintext normalizer (pipe escape replacement) |
| `B_A` | Clipboard write orchestrator |
| `$G` | Cross-platform clipboard writer dispatcher |
| `Tt1` | Platform-specific clipboard write executor (macOS `pbcopy`) |
| `WW_` | Linux clipboard writer (`wl-copy` / `xclip` / `xsel`) |
| `XIL` | Fallback clipboard writer helper |
| `PW_` | Kitty terminal clipboard writer |
| `QW` | Clipboard content post-processor (replaceAll normalization) |
| `oJ` | Terminal escape sequence builder for OSC 52 |
| `Gt1` | Kitty escape sequence constructor |
| `L48` | Clipboard context initializer |
| `nY` | Clipboard base writer primitive |
| `Vpq` | Temp-file write helper for clipboard intermediary |
| `lj` | Temp directory setup for clipboard intermediary |
| `m49` | Temp directory validator / chmod helper |
| `t4` | Index-of helper for argument parsing |
| `DLK` | Daemon status reader (traversal side-path) |
| `YC6` | Daemon status formatter |
| `b4H` | Message text extractor with trim |
| `H8` | String visual width measurer (wraps `Bun.stringWidth`) |
| `xbH` | MCP server connection manager (traversal side-path) |
| `cDA` | MCP server state reconciler |
| `wk8` | MCP server connect/reconnect orchestrator |
| `an` | MCP reconnect handler |
| `phq` | MCP connection initiator |
| `hhq` | MCP tool-hash computer |
| `NHA` | MCP server capability fetcher |
| `tXH` | MCP tool descriptor hasher |
| `W9H` | MCP OAuth server / connection lifecycle handler |
| `Jk8` | MCP cache path resolver |
| `ck8` | MCP needs-auth cache path builder |
| `Ze_` | MCP error logger for connections |
| `jk8` | MCP OAuth complete-authentication tool |
| `QA6` | MCP in-flight connection map getter |
| `cA6` | MCP deduplication map getter |
| `L16` | MCP slot-index parser (parseInt base 10) |
| `lk8` | MCP slot-limit parser (parseInt base 20) |
| `bhq` | MCP async iterator mapper |
| `AF` | Generic async iterable mapper |
| `PF8` | MCP connection result applier |
| `bbH` | MCP tool-state updater helper |
| `Ay` | MCP server cleanup orchestrator |
| `q16` | MCP tool-hash refresh helper |
| `BD8` | MCP descriptor builder |
| `EP` | MCP tool descriptor hash function |
| `mD8` | MCP tool ID resolver |
| `z4` | MCP short-ID generator |
| `M8` | MCP debug logger |
| `v7` | MCP error logger |
| `GH` | String coercion helper |
| `CH` | Foreground task completion emitter |
| `SH` | Foreground task success emitter |
| `hH` | Background session health monitor |
| `w` | Background session lifecycle manager |
| `dwA` | Background worker state machine |
| `pwA` | Background worker IPC connection |
| `Q` | Process retirement handler |
| `lx8` | Low-memory check helper |
| `eX6` | Background session config reader |
| `D6` | MCP skills telemetry emitter |
| `tN` | MCP skills event dispatcher |
| `hx_` | MCP hook dispatcher |
| `X8` | Config file saver |
| `C6` | Config watcher |
| `LwH` | Config file reader |
| `No1` | Config backup directory resolver |
| `tP_` | Config backup path builder |
| `hVL` | Config file watcher subscription manager |
| `j9` | File-watch registration helper |
| `V8` | Config schema validator |
| `Hu` | Config value prefix stripper |
| `U6` | JSON parser helper |
| `RH` | JSON serializer helper |
| `nP_` | Config path normalizer |
| `d6` | Config directory resolver |
| `b8` | Session state string constant holder |
| `Yo` | Message text getter |
| `V9` | Async local store getter |
| `YC6` | Daemon status path builder |
| `r8` | Timeout-with-abort helper |
| `o6` | Feature flag evaluator |
| `J6` | Feature flag bad-path emitter |
| `P6` | Feature flag ok-path emitter |
| `sl` | MCP config slot reconciler |
| `qT6` | MCP slot type dispatcher |
| `bs` | MCP server bootstrap handler |
| `al` | MCP SDK entry builder |
| `cD8` | MCP config error reporter |
| `AT6` | MCP tool-registration manager |
| `kk` | MCP tool validator |
| `qz` | MCP tool schema parser |
| `xx_` | MCP tool extra-field stripper |
| `mj_` | HTTP header parser |
| `lHH` | MIME type checker |
| `uj` | Text content cleaner |
| `H9` | Markdown block processor |
| `t75` | Message role classifier |
| `Y3` | Message timestamp extractor |
| `a8` | Generic identity/passthrough helper |
| `ly6` | MCP server filter |
| `du` | Temp directory existence checker |
| `nD8` | MCP suppression set checker |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.