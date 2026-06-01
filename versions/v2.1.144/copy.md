---
type: feature-spec
feature: "copy"
cc_version: "2.1.144"
updated: "2026-06-01"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.144 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.144 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.144

---

## Overview

The `/copy` command copies Claude's most recent assistant response to the system clipboard. When invoked with a numeric argument (`/copy N`), it retrieves the Nth-latest assistant message instead of the most recent one. The command dispatches to a platform-aware clipboard utility (e.g., `pbcopy` on macOS, `wl-copy`/`xclip`/`xsel` on Linux, PowerShell on Windows) and emits a `tengu_copy` telemetry event upon execution.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| loc_byte | `10134856` |
| loc_byte_end | `10135042` |
| loc_line | `5662` |
| module_id | `NLq` |
| load_inline | `true` |
| arbor_handler.name | `gY7` |
| arbor_handler.fqn | `claude-2.1.144::gY7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.144 bundle.js:+10134856

---

## Input Branching

The handler has four distinct branches depending on argument presence, argument validity, message availability, and index bounds — a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument provided?}
    B -- No --> C[Use index 1 — most recent]
    B -- Yes --> D{Is arg a valid integer?}
    D -- No --> E[Show error: invalid argument]
    D -- Yes --> F[N = Number(arg)]
    C --> G{Assistant messages exist?}
    F --> G
    G -- No --> H["Return: 'No assistant message to copy'"]
    G -- Yes --> I[Collect assistant messages in reverse chronological order]
    I --> J{Index N within bounds?}
    J -- Out of bounds --> K[Show error: index out of range]
    J -- In bounds --> L[Extract text content of Nth-latest message]
    L --> M[Invoke platform clipboard writer]
    M --> N[Emit tengu_copy telemetry]
    N --> O[Return success to user]
```

Analysis basis: CC v2.1.144 bundle.js:+10134041 – +10134549

---

## Behavioral Spec

### Main Handler (`gY7`)

The handler is an `AsyncFunction` resolved via `module_id` → `NLq`. The Arbor symbol graph identifies it as `gY7` (FQN: `claude-2.1.144::gY7`).

```
async function copyCommandHandler(args, context):
    messages = collectAssistantMessages(context)   // VLq

    if messages is empty:
        return displayError("No assistant message to copy")  // literal at +10134082

    if args is not empty:
        n = Number(args)                           // +10134151
        if not Number.isInteger(n):                // +10134165
            return displayError("Invalid argument: expected integer N")
    else:
        n = 1

    targetIndex = messages.length - Math.max(1, n)
    if targetIndex < 0:
        return displayError("Index out of range")

    targetMessage = messages[targetIndex]
    textContent = extractText(targetMessage)       // ZLq, uY7

    writeToClipboard(textContent)                  // tb_ → OT
    emitTelemetry("tengu_copy")                    // +10134460
    return success
```

Analysis basis: CC v2.1.144 bundle.js:+10134041

---

### Assistant Message Collection (`collectAssistantMessages` / `VLq`)

Filters the conversation history for messages with role `"assistant"` and content type `"text"`.

```
function collectAssistantMessages(context):
    allMessages = context.messages                 // literal "messages" at +10134346
    result = []
    for message in allMessages:
        if Array.isArray(message):                 // +10130059
            filtered = filterTextBlocks(message)   // WK → H.filter, literal "text" at +9844191
            result.push(...filtered)               // +10130107
        else if message.role == "assistant":       // literal "assistant" at +10129989
            result.push(message)
    return result
```

Analysis basis: CC v2.1.144 bundle.js:+10130059

---

### Text Extraction from Message (`extractText` / `ZLq` and `uY7`)

Parses the message content through a markdown lexer and assembles plain text, handling both `"table"` and `"plaintext"` content sub-types.

```
function extractText(message):
    tokens = markdownLexer(message.content)        // uY7 → of.lexer at +10128867
    for token in tokens:
        sanitized = cleanToken(token)              // tzH → H.replace at +9842547
        accumulate(sanitized)                      // uY7 → A.push at +10128932

    raw = ZLq(tokens)                              // +10129807
    // ZLq calls ELq to format table/plaintext segments:
    //   - literal "table"     at +10129753
    //   - literal "plaintext" at +10130194
    //   - uses " | " separator (literal at +10129329)
    //   - column alignment: "center", "right", "left" (literals at +10129364, +10129406, +10129446)
    //   - replaces "\\|" (literal at +10129170) for escaped pipes
    return raw
```

Analysis basis: CC v2.1.144 bundle.js:+10129640, +10129807

---

### Table Formatting Sub-routine (`ELq`)

When the extracted message contains a Markdown table block, a sub-routine formats cells with padding and alignment.

```
function formatTable(tableTokens):
    rows = tableTokens.map(parseRow)               // mY7 → _.map at +10129092
    colWidths = computeColumnWidths(rows)           // ELq → Math.max at +10129220, M8 → Bun.stringWidth at +204064
    // minimum column count: 3 (literal at +10129229)
    alignments = rows[0].align                     // "center" | "right" | "left"
    output = []
    for row in rows:
        cells = row.map(cell => padCell(cell, colWidths, alignment))
        // padding via K → f.padEnd at +14565381
        // cell separator: " | " (literal at +10129329)
        // inter-column spacing: "  " (literal at +14565402)
        output.push(cells.join(" | "))
    return output.join("\n")
```

Analysis basis: CC v2.1.144 bundle.js:+10129127, +10129234

---

### Platform Clipboard Writer (`writeToClipboard` / `tb_` → `OT`)

Selects and invokes the appropriate system clipboard utility based on the detected OS.

```
function writeToClipboard(text):
    encoded = encodeForTerminal(text)              // OT → OJ → yxL at +3329211

    platform = detectPlatform()
    if platform == "darwin":                       // literal at +3329394
        spawn("pbcopy", [])                        // literal at +3329420
        writeStdin(encoded)

    else if platform == "linux":                   // literal at +3329446
        if available("wl-copy"):                   // literal at +3329485
            spawn("wl-copy", [])
        else if available("xclip"):                // literal at +3329531
            spawn("xclip", ["-selection", "clipboard"])  // literals at +3329552, +3329565
        else if available("xsel"):                 // literal at +3329597
            spawn("xsel", ["--clipboard", "--input"])    // literals at +3329616, +3329630

    else if platform == "win32":                   // literal at +3329897
        spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", ...])
        // literals at +3329909, +3329923, +3329936, +3329954

    else if inTmux():                              // literal "tmux" at +3329081
        spawn("tmux", ["load-buffer", "-w", "-"])  // literals at +3329019, +3329053

    else if inITerm2():                            // literal "iTerm2" at +3329009
        useOSCEscape(encoded)

    else:
        useKittyEscape(encoded)                    // literal "kitty" at +3328516
```

Analysis basis: CC v2.1.144 bundle.js:+3329211, +3329265, +3329281, +3329295

---

### Temporary File for Clipboard Transfer (`vLq` → `mX`)

On some paths (e.g., tmux `load-buffer`), content is written to a temporary file before being passed to the clipboard tool.

```
function writeTempFileForClipboard(text, dir):
    tmpPath = path.join(dir, generatedName)        // mX → D7_.join at +3896476
    ensureDir(tmpPath)                             // mX → lGH.mkdirSync at +3896543
    validatePermissions(tmpPath)                   // PiL → lGH.lstatSync at +3896065
    // chmod mode 448 (octal 0o700, literal at +3896578)
    // chmod mode 511 (octal 0o777, literal at +3896388) for directory
    writeFile(tmpPath, text)                       // vLq → Nw8.writeFile at +10130340
    mkdir(dir, {recursive: true})                  // vLq → Nw8.mkdir at +10130297
    return tmpPath
```

Analysis basis: CC v2.1.144 bundle.js:+10130263, +3896476

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (emitted on every successful copy, loc_byte +10134460) |
| Clipboard | Writes text to system clipboard via OS-specific utility (`pbcopy`, `wl-copy`, `xclip`, `xsel`, PowerShell, tmux `load-buffer`, kitty/iTerm2 OSC escape) |
| Temporary files | May create a short-lived temp file in `CLAUDE_CODE_TMPDIR` (or `/tmp`, literal at +3895897) for clipboard piping; removed after transfer |
| appState changes | None observed within depth-2 traversal |
| Hook registration | None observed within depth-2 traversal |
| Sound | None observed within depth-2 traversal |
| Telemetry (indirect) | `tengu_feature_ok` / `tengu_feature_bad` (loc_bytes +955520 / +955578) — emitted by the shared error/logging layer `kH`, not by `/copy` directly |

---

## Version History

| Version | Change |
|---|---|
| v2.1.144 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument**: `/copy foo` will trigger an argument validation error because `Number.isInteger(Number("foo"))` is false (Analysis basis: CC v2.1.144 bundle.js:+10134165).
2. **N exceeds message count**: `/copy 99` when fewer than 99 assistant messages exist causes an out-of-bounds condition. Use `/copy` (no argument) or a small N.
3. **Clipboard tool not installed on Linux**: If neither `wl-copy`, `xclip`, nor `xsel` is present, the clipboard write will fail silently or produce an error. Install at least one of these tools.
4. **Using `/copy` before Claude has responded**: If no assistant message is present in the session, the command returns `"No assistant message to copy"` (literal at +10134082) and does nothing.
5. **SSH / remote sessions with tmux**: The tmux `load-buffer` path writes a temp file and may behave differently depending on tmux version and socket availability.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `gY7` | Main async handler for `/copy` (Arbor-resolved, FQN `claude-2.1.144::gY7`) |
| `VLq` | Collects and filters assistant messages from conversation history |
| `ZLq` | Orchestrates text extraction from a parsed message (calls `ELq`) |
| `uY7` | Tokenizes message content via markdown lexer; accumulates sanitized tokens |
| `tzH` | Token sanitization — applies string replacement on raw token text |
| `ELq` | Table/plaintext formatter; handles cell padding and column alignment |
| `mY7` | Row parser — maps raw table token rows to structured cell arrays |
| `M8` | String width calculator (delegates to `Bun.stringWidth`) |
| `ILq` | Inline replacement helper for escaped pipe characters (`\|`) |
| `WK` | Filters message content blocks by type `"text"` |
| `tb_` | Clipboard dispatch entry point; calls `OT` for OS detection |
| `OT` | Platform detector and clipboard tool selector |
| `OJ` | Encodes text for terminal output (UTF-8 / base64) |
| `yxL` | Terminal escape sequence builder (kitty protocol) |
| `xxL` | Linux clipboard writer (`wl-copy` / `xclip` / `xsel` dispatch) |
| `RxL` | macOS clipboard writer (`pbcopy`) |
| `hxL` | Text sanitizer — `replaceAll` for terminal-safe output |
| `D8` | Low-level clipboard spawn helper; launches `pbcopy` or equivalent |
| `vLq` | Temp-file-based clipboard transfer (tmux `load-buffer` path) |
| `mX` | Temporary directory/file creator for clipboard piping |
| `wn` | Temp directory path resolver |
| `PiL` | Temp file permission validator (`lstatSync` + `chmodSync`) |
| `M7` | String indexOf helper for argument parsing |
| `kH` | Shared error logger and telemetry emitter (`tengu_feature_ok` / `tengu_feature_bad`) |
| `b_` | Error formatter (wraps Error with String) |
| `xH` | String coercion utility |
| `Aq` | Error telemetry dispatch |
| `bkK` | Circular error buffer manager (shift/push on `ER6`) |
| `d` | Generic async operation wrapper / promise chainer |
| `CH` | JSON serializer (`JSON.stringify`) |