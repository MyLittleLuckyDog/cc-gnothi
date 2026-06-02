---
type: feature-spec
feature: "copy"
cc_version: "2.1.156"
updated: "2026-06-02"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.156 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.156 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.156

---

## Overview

The `/copy` command copies Claude's most recent assistant response to the system clipboard. An optional numeric argument `N` selects the Nth-latest assistant message instead of the most recent one. The command extracts text content from the conversation message list, renders it in the appropriate output format (plain text or table), and writes it to the platform-specific clipboard mechanism.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `oV1` |
| load_inline | `true` |
| loc_byte | `10757033` |
| loc_byte_end | `10757219` |
| loc_line | `7661` |
| arbor_handler.name | `DnL` |
| arbor_handler.fqn | `claude-2.1.156::DnL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.156 bundle.js:+10757033

---

## Input Branching

The handler has four distinct paths based on argument validity and message availability, plus a sub-branch for output format rendering — a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument provided?}
    B -- No --> C[Use N = 1 (most recent)]
    B -- Yes --> D{Is arg a valid integer?}
    D -- No --> E[Show error: not a valid number]
    D -- Yes --> F[Use N = parsed integer]
    C --> G[Collect assistant messages from conversation]
    F --> G
    G --> H{Nth-latest message exists?}
    H -- No --> I[Show error: 'No assistant message to copy']
    H -- Yes --> J[Extract text content from message]
    J --> K{Content type?}
    K -- table --> L[Render as formatted table\ncolumn alignment: left/center/right\nseparator: ' | ']
    K -- plaintext/default --> M[Render as plain text]
    L --> N[Write to platform clipboard]
    M --> N
    N --> O[Emit tengu_copy telemetry]
    O --> P[Return success to UI]
```

Analysis basis: CC v2.1.156 bundle.js:+10756218 (handler entry `DnL`), +10756259 (error literal), +10751930 (table literal), +10752371 (plaintext literal)

---

## Behavioral Spec

### 1. Argument Parsing

The main handler (`DnL`) begins by inspecting the raw argument string passed after `/copy`.

```
async function copyCommandHandler(rawArg, conversationContext):
    assistantMessages = collectAssistantMessages(conversationContext)
    # collectAssistantMessages filters conversation for role == "assistant"
    # and content type == "text" (bundle.js:+10752166, +10455828)

    if rawArg is empty or absent:
        targetIndex = 1   # default: most recent
    else:
        n = Number(rawArg)
        if not Number.isInteger(n):
            displayError("No assistant message to copy")
            return
        targetIndex = n
```

Analysis basis: CC v2.1.156 bundle.js:+10756328 (`Number` call), +10756342 (`Number.isInteger` check), +10756259 (error string literal)

---

### 2. Message Selection

After validating the index, the handler navigates the assistant message list in reverse (latest-first) order.

```
function selectNthLatestMessage(assistantMessages, n):
    # Messages are enumerated via nV1 (message list filter)
    # Array.isArray check guards against malformed conversation state
    reversedMessages = assistantMessages reversed
    if reversedMessages.length < n:
        return null   # triggers "No assistant message to copy"
    return reversedMessages[n - 1]
```

Analysis basis: CC v2.1.156 bundle.js:+10756218 (`nV1` call from `DnL`), +10752236 (`Array.isArray` guard in `nV1`), +10752268 (`DK` text-type filter), +10756513 ("message"), +10756523 ("messages")

---

### 3. Content Extraction and Format Detection

Once the target message is selected, content is extracted and its render format is determined.

```
function extractAndRenderContent(message):
    rawContent = message.content   # text blocks only

    format = detectFormat(rawContent)
    # format is one of: "table" | "plaintext"
    # "table" detected when content contains markdown table syntax ("|" separator)

    if format == "table":
        return renderTable(rawContent)
    else:
        return renderPlaintext(rawContent)
```

Analysis basis: CC v2.1.156 bundle.js:+10751930 ("table" literal), +10752371 ("plaintext" literal), +10751347 (`\\|` separator regex literal in `cV1`)

---

### 4. Table Rendering (sub-feature)

When table format is detected, the `cV1` helper constructs a padded, aligned table.

```
function renderTable(rawTableText):
    rows = lexAndParseTableRows(rawTableText)
    # Uses oM.lexer (markdown lexer) at bundle.js:+10751817

    columnWidths = computeColumnWidths(rows)
    # Math.max across all cells; minimum column width: 3 chars (bundle.js:+10751397)
    # Cell width measured via stringWidthHelper (Bun.stringWidth, bundle.js:+206493)

    alignments = parseHeaderAlignments(rows[1])
    # Supported values: "left" | "center" | "right"
    # bundle.js:+10751623, +10751541, +10751583

    renderedRows = []
    for each row in rows:
        cells = row.cells.map(cell => padCell(cell, columnWidth, alignment))
        renderedRows.push(cells.join(" | "))
        # Separator string " | " at bundle.js:+10751506

    return renderedRows.join("\n")
```

Analysis basis: CC v2.1.156 bundle.js:+10751304 (`cV1` entry), +10751269 (`MnL` map call), +10751320 (`$.map`), +10751331 (`O.replace` with `\\|`), +10751406 (column-minimum `3`), +10751506 (" | " join separator)

---

### 5. Clipboard Write

The rendered text is written to the system clipboard via platform-specific subprocess dispatch (`xZ` → platform fork).

```
async function writeToClipboard(text):
    platform = process.platform

    if platform == "darwin":
        spawn("pbcopy", stdin=text)
        # bundle.js:+3370693

    elif platform == "linux":
        if wayland display available:
            spawn("wl-copy", stdin=text)
            # bundle.js:+3370758
        elif "xclip" available:
            spawn("xclip", ["-selection", "clipboard"], stdin=text)
            # bundle.js:+3370804, +3370825, +3370838
        else:
            spawn("xsel", ["--clipboard", "--input"], stdin=text)
            # bundle.js:+3370870, +3370889, +3370903

    elif platform == "win32":
        spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", <pipe-cmd>], stdin=text)
        # bundle.js:+3371182, +3371196, +3371209, +3371227

    # Terminal multiplexer overrides (checked before OS path):
    # tmux:   tmux load-buffer (bundle.js:+3370281)
    # kitty:  OSC-52 escape sequence (bundle.js:+3369866)
    # screen: ESC-ESC sequence (bundle.js:+3369751, +3369994)
    # iTerm2: load-buffer -w (bundle.js:+3370271, +3370315)

    encodeAs = "utf8" | "base64"   # depending on mechanism
    # bundle.js:+3370444, +3370461
```

Analysis basis: CC v2.1.156 bundle.js:+10752582 (`xZ` clipboard write dispatch, called from `Ho_`), +3370475 (`dY_` → `xD` platform detection), +3370481 (`F47` darwin branch), +3370719 (linux), +3371170 (win32)

---

### 6. Telemetry Emission

After a successful clipboard write, a single telemetry event is emitted.

```
function emitCopyTelemetry(result):
    emit("tengu_copy", { success: true })
    # bundle.js:+10756637
```

Analysis basis: CC v2.1.156 bundle.js:+10756637

---

### 7. Temporary File Path for Clipboard Operations

When clipboard operations require a temporary file (e.g., for tmux `load-buffer -w`), the system uses `/tmp` as the default base directory, overridable via `CLAUDE_CODE_TMPDIR`.

```
function getTempDir():
    return env.CLAUDE_CODE_TMPDIR ?? "/tmp"
    # bundle.js:+3946453
    # Directory validated via lstatSync and chmodSync (bundle.js:+3946621, +3946955)
    # Permissions octal 448 (0o700) enforced (bundle.js:+3947134)
```

Analysis basis: CC v2.1.156 bundle.js:+3946453, +3946528, +3947134

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` emitted on successful clipboard write (bundle.js:+10756637) |
| Clipboard side effect | Platform subprocess spawned; text written to OS clipboard |
| Temp files | May create a temp file under `/tmp` (or `CLAUDE_CODE_TMPDIR`) for multiplexer copy paths; cleaned up after use |
| appState changes | None observed in depth-2 traversal |
| Hook registration | None observed in depth-2 traversal |
| Sound | None observed in depth-2 traversal |
| Error display | Inline error message `"No assistant message to copy"` rendered in UI when no valid message found (bundle.js:+10756259) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.156 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy foo` or `/copy 1.5` causes an immediate error because `Number.isInteger` rejects non-whole values. Use only positive whole numbers.
2. **Index out of range** — `/copy 5` when the conversation has fewer than five assistant messages silently fails with the "No assistant message to copy" message. The index counts assistant turns only, not all messages.
3. **Expecting rich formatting in clipboard** — The clipboard always receives plain text (or a pipe-delimited plain-text table). Markdown bold, code fences, and other markup are not preserved as formatting in the clipboard output.
4. **SSH/remote sessions and clipboard** — On remote SSH sessions, the subprocess clipboard tools (`pbcopy`, `xclip`, etc.) may not be available or may not forward to the local machine's clipboard. Use a terminal that supports OSC-52 forwarding, or use the tmux/kitty paths if applicable.
5. **CLAUDE_CODE_TMPDIR permissions** — If `CLAUDE_CODE_TMPDIR` is set to a world-writable or attacker-controlled directory, the tool will refuse to proceed and log a warning. Set it to a directory you own with mode `0700`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `DnL` | Main async handler for `/copy` command (arbor-resolved entry point) |
| `nV1` | Assistant message list filter (filters conversation by role and content type) |
| `lV1` | Table content extraction and row parsing coordinator |
| `cV1` | Table renderer (column width computation, cell padding, alignment) |
| `MnL` | Row mapper within table renderer |
| `fnL` | Plaintext content extractor (lexer-based) |
| `NjH` | Text content normalizer / replacer used during plaintext extraction |
| `oM` | Markdown lexer wrapper (`avH.parse` backed) |
| `iV1` | Output format string replacer / post-processor |
| `DK` | Text-type content filter (filters for `"text"` content blocks) |
| `Ho_` | Clipboard write orchestrator (selects platform path, calls `xZ`) |
| `xZ` | Clipboard write dispatcher (platform detection → subprocess selection) |
| `dY_` | Platform detection helper feeding into clipboard tool selection |
| `xD` | Low-level clipboard write primitive |
| `F47` | macOS `pbcopy` clipboard path |
| `V8` | macOS clipboard subprocess spawner |
| `p47` | macOS clipboard fallback path |
| `kQq` | Screen/tmux clipboard helper |
| `V0` | Screen escape-sequence clipboard path (`replaceAll`) |
| `DJ` | Kitty / OSC-52 clipboard path (array join) |
| `m47` | Generic clipboard subprocess helper |
| `rV1` | Temp-file writer used for multiplexer copy (`bE8.writeFile`) |
| `EX` | Temp directory setup (mkdir + chmod validation) |
| `Cj7` | Temp directory permission checker (`lstatSync` + `chmodSync`) |
| `a4` | String index helper used in clipboard path branching |
| `s6` | String width measurement helper (`Bun.stringWidth`) |
| `Si` | Conversation state accessor |
| `C1H` | Text trimmer / content extractor for conversation messages |
| `bo1` | Daemon status reader (`daemon.status.json`) |
| `MI6` | Status file path joiner |
| `RH` | JSON serializer utility (`JSON.stringify`) |
| `k8` | Stopped/background session state label accessor |
| `kd` | Path helper used during temp directory creation |
| `d` | General-purpose async/callback utility |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.