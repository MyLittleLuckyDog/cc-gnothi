---
type: feature-spec
feature: "copy"
cc_version: "2.1.169"
updated: "2026-06-11"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.169 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.169 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.169

---

## Overview

The `/copy` command copies Claude's most recent assistant response to the system clipboard. An optional integer argument `N` selects the Nth-latest assistant response instead of the most recent one. The command serialises the selected message content into plain text, invokes a platform-appropriate clipboard utility, and emits a `tengu_copy` telemetry event on completion.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `VQq` |
| load_inline | `true` |
| loc_byte | `11143746` |
| loc_byte_end | `11143932` |
| loc_line | `7393` |
| arbor_handler.name | `F0f` |
| arbor_handler.fqn | `claude-2.1.169::F0f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.169 bundle.js:+11143746

---

## Input Branching

Four distinct paths exist depending on argument validity and message availability, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument provided?}
    B -- No --> C[Use index = 1\n(most recent)]
    B -- Yes --> D{Is arg a valid integer?}
    D -- No --> E[Return error:\n'No assistant message to copy']
    D -- Yes --> F[Parse N = Number(arg)]
    C --> G[Collect assistant messages\nfrom conversation history]
    F --> G
    G --> H{At least N assistant\nmessages exist?}
    H -- No --> I[Return error:\n'No assistant message to copy']
    H -- Yes --> J[Select Nth-latest message\nvia offset from end]
    J --> K[Extract text content\nvia contentExtractor]
    K --> L[Write text to clipboard\nvia platformClipboardWriter]
    L --> M[Emit tengu_copy telemetry]
    M --> N[Return success JSX]
```

---

## Behavioral Spec

### Main Handler — `F0f` (asyncCopyHandler)

Analysis basis: CC v2.1.169 bundle.js:+11142931

```
async function asyncCopyHandler(commandContext):
    rawArg = commandContext.argument   // optional trailing token after /copy

    // 1. Resolve which Nth-latest message the user wants
    if rawArg is absent or empty:
        targetIndex = 1                // default: most recent
    else:
        n = Number(rawArg)
        if not Number.isInteger(n):
            return errorResult("No assistant message to copy")
        targetIndex = n

    // 2. Collect assistant messages from session history
    messages = collectAssistantMessages(commandContext)   // calls TQq

    // 3. Bounds check
    if messages.length < targetIndex:
        return errorResult("No assistant message to copy")

    // 4. Select the Nth-latest (1-based from end)
    selectedMessage = messages[messages.length - targetIndex]

    // 5. Build plain-text representation
    plainText = buildPlainText(selectedMessage)           // calls GQq → WQq

    // 6. Write to system clipboard
    await platformClipboardWriter(plainText)              // calls vqA → BG

    // 7. Telemetry
    emit("tengu_copy")                                    // bundle.js:+11143350

    // 8. Return JSX confirmation to the UI renderer
    return successJsx()
```

### Assistant Message Collector — `TQq` (collectAssistantMessages)

Analysis basis: CC v2.1.169 bundle.js:+11138949

```
function collectAssistantMessages(context):
    history = context.messages          // full conversation turn array
    if not Array.isArray(history):
        return []
    result = []
    for turn in history:
        if turn.role == "assistant":    // literal "assistant" bundle.js:+11138879
            textBlocks = filterTextBlocks(turn.content)   // calls w4
            result.push(textBlocks)
    return result
```

### Text Block Filter — `w4` (filterTextBlocks)

Analysis basis: CC v2.1.169 bundle.js:+11138981

```
function filterTextBlocks(contentArray):
    // Keeps only blocks whose type == "text"
    // literal "text" bundle.js:+10895661
    return contentArray.filter(block => block.type == "text")
```

### Plain-text Builder — `GQq` (buildPlainTextRepresentation)

Analysis basis: CC v2.1.169 bundle.js:+11138530

```
function buildPlainTextRepresentation(messageBlocks):
    // Tokenises blocks through a markdown-aware lexer (y3.lexer)
    tokens = y3.lexer(messageBlocks)

    // Searches for table tokens; if none, falls back to plaintext path
    if tokens.indexOf("table") == -1:    // literal "table" bundle.js:+11138643
        return buildPlaintext(messageBlocks)   // calls EQq
    else:
        return buildTableText(tokens)          // calls WQq

function buildPlaintext(messageBlocks):
    // Strips markdown syntax, joins blocks
    // literal "plaintext" bundle.js:+11139084
    // Output written to a .txt representation  bundle.js:+11139116
    return messageBlocks.replace(markdownPattern, "")
```

### Table Formatter — `WQq` (formatTableText)

Analysis basis: CC v2.1.169 bundle.js:+11138017

```
function formatTableText(tokens):
    // Maps tokens into rows via u0f (rowMapper)
    rows = u0f(tokens).map(...)

    // Splits pipe-delimited cells; literal "\\|" bundle.js:+11138060
    cells = rows.map(row => row.replace("\\|", ""))

    // Compute column widths; minimum column count = 3 (bundle.js:+11138119)
    maxWidth = Math.max(3, cells.map(Bun.stringWidth))

    // Pad cells; separator literal " | " bundle.js:+11138219
    // Alignment modes: "center" (bundle.js:+11138254),
    //                  "right"  (bundle.js:+11138296),
    //                  "left"   (bundle.js:+11138336)
    return cells.map(cell => alignCell(cell, maxWidth)).join(" | ")
```

### Platform Clipboard Writer — `vqA` → `BG` (platformClipboardWriter)

Analysis basis: CC v2.1.169 bundle.js:+11139295

The writer detects the host platform and terminal environment, then delegates to the appropriate native clipboard utility.

```
async function platformClipboardWriter(text):
    encodedText = encode(text, encoding)
    // Encoding choices: "utf8" (bundle.js:+3448088), "base64" (bundle.js:+3448105)

    platform = detectPlatform()
    term     = detectTerminal()

    if term == "kitty":                        // bundle.js:+3447155
        writeViaKittyProtocol(text)            // uses escape sequence bundle.js:+3447283
        return

    if term == "screen":                       // bundle.js:+3446686
        writeViaScreenBuffer(text)             // calls rT_
        return

    if term == "iTerm2":                       // bundle.js:+3447915
        writeViaITermLoadBuffer(text)          // "load-buffer" bundle.js:+3447925
        return

    if term == "tmux":                         // bundle.js:+3447987
        writeViaTmux(text)                     // calls MCL → b8; timeout 2000ms bundle.js:+3448319
        return

    if platform == "darwin":
        spawnProcess("pbcopy", [], text)       // bundle.js:+3448353; timeout 2000ms
        return

    if platform == "linux":                    // bundle.js:+3447614
        // Try Wayland first, then X11 fallbacks
        if wayland available:
            spawnProcess("wl-copy", [], text)  // bundle.js:+3447684
        else if xclip available:
            spawnProcess("xclip",              // bundle.js:+3447753
                ["-selection", "clipboard"],   // bundle.js:+3448533, 3448546
                text)
        else:
            spawnProcess("xsel",               // bundle.js:+3447794
                ["--clipboard", "--input"],    // bundle.js:+3448633, 3448647
                text)
        return

    if platform == "wsl":                      // bundle.js:+3448709
        spawnProcess("powershell.exe",         // bundle.js:+3448719
            ["-NoProfile",                     // bundle.js:+3448737
             "-NonInteractive",                // bundle.js:+3448750
             "-Command"],                      // bundle.js:+3448768
            text)
        return

    if platform == "powershell":               // bundle.js:+3448812
        spawnProcess("powershell", [...], text)
        return

    // Fallback: attempt xsel primary selection
    spawnProcess("xsel", ["--primary"], text)  // bundle.js:+3448483

```

### Temporary File Writer — `ZQq` (writeTempFile)

Analysis basis: CC v2.1.169 bundle.js:+11139153

Some clipboard backends (notably tmux `load-buffer`) require a temporary file path:

```
async function writeTempFile(content):
    tmpDir = process.env.CLAUDE_CODE_TMPDIR ?? "/tmp"   // bundle.js:+4034535
    // Validates tmpDir is a directory the process owns (bundle.js:+4034610)
    dirPath = path.join(tmpDir, uniqueSubdir)
    fs.mkdirSync(dirPath, { mode: 0o700 })              // mode 448 decimal bundle.js:+4035216
    filePath = path.join(dirPath, filename)             // calls ZQq → XQq.join
    await fs.writeFile(filePath, content)               // bundle.js:+11139230
    return filePath
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (bundle.js:+11143350) — emitted on every successful copy operation |
| Clipboard | Writes the selected assistant response text to the OS clipboard via a platform-specific subprocess or terminal escape sequence |
| Temporary files | May create a temporary file under `$CLAUDE_CODE_TMPDIR` or `/tmp` for backends that require it (e.g. tmux `load-buffer`) |
| appState changes | None observed within depth-2 traversal |
| Sound | None observed |
| Hook registration | None observed |

---

## Version History

| Version | Change |
|---|---|
| v2.1.169 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy 2.5` or `/copy last` will fail with "No assistant message to copy" because the handler requires `Number.isInteger(n)` (bundle.js:+11143055).
2. **Requesting an index beyond history depth** — `/copy 10` when fewer than 10 assistant turns exist returns an error rather than wrapping around; there is no modular indexing.
3. **Using in a session with no assistant messages** — If Claude has not yet responded in the current session, `/copy` returns an error immediately.
4. **Clipboard utility not available on Linux** — The command silently falls through `wl-copy` → `xclip` → `xsel`; if none are installed the copy will fail. Install at least one X11/Wayland clipboard utility.
5. **Unsafe `CLAUDE_CODE_TMPDIR`** — If the environment variable points to a directory not owned by the current user, the temporary-file path validation will abort the copy on terminal multiplexer backends.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `F0f` | Main async handler for `/copy` (asyncCopyHandler) |
| `TQq` | Collects assistant-role messages from conversation history |
| `w4` | Filters content blocks to text-type only |
| `GQq` | Builds plain-text representation, dispatches table vs plaintext path |
| `EQq` | Plaintext (non-table) markdown-stripped serialiser |
| `WQq` | Table formatter — pads/aligns columns, joins with pipe separators |
| `u0f` | Row mapper for table token array |
| `X2H` | Cell content cleaner (replace pass on raw token text) |
| `vqA` | Platform clipboard writer dispatcher |
| `BG` | Core clipboard write logic; selects native backend |
| `ZQq` | Temporary file writer used by some clipboard backends |
| `fj` | Low-level file write helper for temp path creation |
| `B59` | Validates temp directory ownership and permissions |
| `v89` | macOS `pbcopy` subprocess spawner |
| `oT_` | Linux `wl-copy` / `xclip` / `xsel` spawner |
| `MCL` | tmux `load-buffer` clipboard backend |
| `b8` | Generic subprocess spawner with timeout (2000 ms) |
| `rT_` | GNU Screen clipboard backend |
| `X0` | Kitty terminal clipboard protocol writer |
| `wX` | iTerm2 `load-buffer`-style writer |
| `V89` | Base escape-sequence clipboard writer |
| `HD` | Clipboard encoding helper (utf8/base64) |
| `zL` | String index utility (indexOf wrapper) |
| `y3` | Markdown lexer module |
| `A8` | Column width calculator using `Bun.stringWidth` |
| `K6` | Internal constant / config object reference |
| `M6` | Module-level constant initialiser |
| `D3K` | Daemon status file reader (`daemon.status.json`) |
| `tx6` | Status JSON path builder |
| `CH` | JSON serialiser wrapper |
| `Oa` | Message content extractor |
| `vLH` | Text trimmer with 1000-character threshold |
| `n6H` | String normalisation helper |
| `S8` | Session state accessor (background/stopped classification) |

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.