---
type: feature-spec
feature: "copy"
cc_version: "2.1.143"
updated: "2026-05-18"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.143 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.143 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.143

---

## Overview

The `/copy` command copies the most recent assistant response to the system clipboard. An optional integer argument `N` allows the user to target the Nth-latest assistant message instead of the most recent one. The command lexes the conversation message list, extracts and renders the target message's text content, and writes it to the clipboard, emitting a `tengu_copy` telemetry event on completion.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `OKq` |

Analysis basis: CC v2.1.143 bundle.js:+10111789

---

## Input Branching

The command entry point (`commandHandler`) receives the raw user argument string, parses an optional integer index, validates the conversation state, and then dispatches to message extraction and clipboard writing.

```mermaid
flowchart TD
    A(["/copy [arg] invoked"]) --> B{Argument provided?}
    B -- No --> C[Use index = 1\n(most recent assistant message)]
    B -- Yes --> D[Parse argument as Number]
    D --> E{Number.isInteger\nand value >= 1?}
    E -- No --> F[Display error:\nargument must be a positive integer]
    E -- Yes --> G[Use index = N]
    C --> H[Collect assistant messages\nfrom conversation history]
    G --> H
    H --> I{Any assistant\nmessages found?}
    I -- No --> J[Display error:\n'No assistant message to copy']
    I -- Yes --> K[Slice list to target index\nvia messageListExtractor]
    K --> L[Extract text content blocks\nwith role = 'assistant']
    L --> M[Render markdown tokens\nvia lexer pipeline]
    M --> N[Write rendered text\nto clipboard via clipboardWriter]
    N --> O[Emit tengu_copy telemetry]
    O --> P([Done])
    F --> P
    J --> P
```

Analysis basis: CC v2.1.143 bundle.js:+10110974, +10111084, +10111098, +10111013, +10111015, +10111328, +10111340, +10111349, +10111391, +10111393

---

## Behavioral Spec

### Argument Parsing

```
function parseIndexArgument(rawArg):
    if rawArg is absent or empty:
        return 1

    parsed = Number(rawArg)

    if not Number.isInteger(parsed) or parsed < 1:
        return ERROR("argument must be a positive integer")

    return parsed
```

Analysis basis: CC v2.1.143 bundle.js:+10111084, +10111098

---

### Assistant Message Collection

The collector (`assistantMessageCollector`) filters the full conversation message list to retain only entries with `role = "assistant"`. It checks that at least one such entry exists; if the filtered list is empty it surfaces the literal error string `"No assistant message to copy"`.

```
function assistantMessageCollector(messages):
    assistantMessages = messages.filter(msg => msg.role == "assistant")

    if assistantMessages is empty:
        return ERROR("No assistant message to copy")

    return assistantMessages
```

Analysis basis: CC v2.1.143 bundle.js:+10106922, +10111015

---

### Index Resolution and Message Slicing

After collection, `messageListExtractor` resolves the Nth-latest message. Index 1 means the last element, index 2 means second-to-last, and so on. The list is sliced from the tail using the parsed index.

```
function messageListExtractor(assistantMessages, index):
    // index is 1-based from the tail
    targetPosition = Math.max(0, length(assistantMessages) - index)
    targetMessage  = assistantMessages[targetPosition]
    return targetMessage
```

Analysis basis: CC v2.1.143 bundle.js:+10106153, +10106751

---

### Text Content Extraction

`textContentExtractor` iterates over the content blocks of the target message, retaining only blocks whose type is `"text"`. The extracted text strings are joined to produce the raw content string passed downstream.

```
function textContentExtractor(message):
    textParts = []
    for block in message.content:
        if block.type == "text":
            textParts.push(block.text)
    return join(textParts)
```

Analysis basis: CC v2.1.143 bundle.js:+10106992, +10107024, +10107040, bundle.js:+9962903

---

### Markdown Lexing and Rendering

The raw text is passed through a markdown lexer pipeline (`markdownLexer`) which tokenises the string into structured tokens (including `"code"` and `"table"` token types among others). A secondary renderer (`markdownRenderer`) maps tokens back to plain-text or formatted output suitable for clipboard consumption. Table cells are separated using the literal separator `" | "` and pipes in content are escaped with `"\\|"`. Cell content is padded using `Math.max` with a minimum column width of 3 characters.

```
function markdownLexer(rawText):
    tokens = lf.lexer(rawText)           // tokenise with marked lexer
    return tokens

function markdownRenderer(tokens):
    output = []
    for token in tokens:
        if token.type == "table":
            renderTable(token, output)   // uses " | " separator, "\\|" escaping
        elif token.type == "code":
            renderCodeBlock(token, output)
        else:
            renderInline(token, output)
    return join(output, "\n")

function renderTable(tableToken, output):
    for row in tableToken.rows:
        cells = row.map(cell => padCell(cell, columnWidth))
        output.push(join(cells, " | "))

function padCell(cellText, width):
    // minimum column width: 3 characters
    effectiveWidth = Math.max(3, width)
    return cellText.padEnd(effectiveWidth)
```

Analysis basis: CC v2.1.143 bundle.js:+10106573, +10105800, +10105849, +10106087, +10106103, +10106153, +10106162, +10106262, +10106297, +10106339, +10106379

Token types observed in literals: `"table"` (bundle.js:+10106686), `"code"` (bundle.js:+10105849), `"plaintext"` (bundle.js:+10107127).

---

### Clipboard Write

`clipboardWriter` receives the rendered string and writes it to the OS clipboard. It first ensures the destination directory exists (creating it with permission bits `448` decimal, equivalent to octal `0o700`) and then writes the file using `cD8.writeFile`.

```
function clipboardWriter(renderedText):
    dirPath  = buildTempPath()
    cD8.mkdir(dirPath, { recursive: true, mode: 448 })
    filePath = join(dirPath, generateFileName())
    cD8.writeFile(filePath, renderedText)
    invokeSystemClipboard(filePath)
```

Temporary file extension used for plaintext output: `".txt"` (bundle.js:+10107159).
Directory permission mode: `448` (decimal) (bundle.js:+10107261).

Analysis basis: CC v2.1.143 bundle.js:+10107196, +10107203, +10107230, +10107261, +10107273

---

### Telemetry Emission

Immediately after a successful clipboard write, the `tengu_copy` event is fired. This is the sole telemetry event associated with this command.

```
function emitCopyTelemetry():
    emit("tengu_copy")
```

Analysis basis: CC v2.1.143 bundle.js:+10111393

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (bundle.js:+10111393) — fired once per successful copy operation |
| Hook registration | `tengu_config_parse_error` event fired if config file parsing fails during context resolution (bundle.js:+3164878) |
| appState changes | None observed within depth-2 traversal |
| Clipboard | Rendered assistant message text written to OS clipboard via a temporary file and system clipboard invocation |
| Filesystem | Temporary directory created (mode `448`/`0o700`) and a `.txt` file written transiently during clipboard write (bundle.js:+10107230, +10107273) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.143 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer or zero argument** — `/copy 0` or `/copy 1.5` will not resolve to a message; `N` must be a positive integer (`Number.isInteger` check at bundle.js:+10111098).
2. **Running `/copy N` in an empty session** — if no assistant turn exists yet the command immediately exits with `"No assistant message to copy"` rather than copying anything (bundle.js:+10111015).
3. **Expecting `/copy 2` to mean the second message overall** — the index is tail-relative; `/copy 2` targets the second-to-last assistant response, not the second assistant response from the beginning of the conversation.
4. **Assuming rich HTML is copied** — the clipboard content is plain rendered text derived from the markdown lexer pipeline, not HTML or RTF. Tables are rendered as pipe-separated ASCII (bundle.js:+10106262).
5. **Expecting the command to work on user messages** — only messages with `role = "assistant"` are considered; user turns are excluded by the filter (bundle.js:+10106922).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `KKq` | Table/markdown renderer — renders tokenised message content into display-ready text |
| `fz7` | Column-map helper — maps over table columns to compute display widths |
| `JZq` | Session initialiser — sets up a new background session with timestamp |
| `N8` | Background-session status handler — manages "stopped"/"background session" states |
| `M8` | String-width measurer — wraps `Bun.stringWidth` for Unicode-aware column sizing |
| `LKq` | Message list extractor — slices the assistant message list to the target index |
| `lf` | Markdown lexer wrapper — invokes `uTH.parse` to tokenise markdown text |
| `MKq` | Plaintext sanitiser — applies `.replace` to strip or escape markup from raw text |
| `fKq` | Content-block iterator — checks `Array.isArray` and collects `"text"`-type blocks |
| `DK` | Text-block filter — filters message content blocks by type `"text"` |
| `Yz7` | Command entry point / handler — top-level function implementing `/copy` logic |
| `Lz7` | Code-block renderer — lexes and renders fenced code blocks, pushes to output array |
| `nYH` | Code-content sanitiser — applies `.replace` on code block inner text |
| `N6` | Config-file watcher initialiser — sets up file watch with `Date.now` timestamp |
| `x6` | Config path resolver — resolves file paths for config access |
| `z9_` | Config state checker — validates config access preconditions |
| `H$H` | Config file reader — reads config via `readFileSync`, handles `ENOENT`/`EEXIST` |
| `nhL` | File-watch handler — manages `watchFile`/`unwatchFile` lifecycle |
| `aC_` | Clipboard write orchestrator — coordinates temp-dir creation and file write |
| `qT` | File encoder — handles `utf8`/`base64` encoding for file writes |
| `H7` | String index searcher — wraps `H.indexOf` for substring location |
| `$Kq` | Temp-file writer — calls `cD8.mkdir` and `cD8.writeFile` with mode `448` |
| `SvH` | MCP server connector — manages multi-transport MCP connection lifecycle |
| `THK` | MCP update applier — applies incremental MCP server state updates |
| `B95` | MCP config builder — builds MCP server config objects from entries |
| `M` | MCP manager — top-level MCP lifecycle coordinator |
| `v` | Platform/environment detector — checks platform strings, trims, uppercases |