---
type: feature-spec
feature: "copy"
cc_version: "2.1.132"
updated: "2026-05-18"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.132 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.132 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.132

---

## Overview

The `/copy` command copies Claude's most recent assistant response to the system clipboard. An optional numeric argument `N` instructs the command to copy the Nth-latest assistant message instead of the most recent one. The command locates assistant-role messages in the current conversation history, extracts their text content, and writes the result to the clipboard.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `yo9` |

Analysis basis: CC v2.1.132 bundle.js:+9839513

---

## Input Branching

```mermaid
flowchart TD
    A["/copy invoked"] --> B{Argument provided?}
    B -- "No argument" --> C[Use N = 1 (most recent)]
    B -- "Argument present" --> D{Parse argument as Number}
    D -- "Not a valid integer" --> E[Error: show usage hint]
    D -- "Valid positive integer N" --> F[Use N = parsed integer]
    C --> G[Collect assistant-role messages from conversation history]
    F --> G
    G --> H{Enough messages for index N?}
    H -- "No messages at all" --> I[Display: 'No assistant message to copy'\nbundle.js:+9838739]
    H -- "Fewer than N messages" --> J[Clamp index via Math.max to available count\nbundle.js:+9833877]
    H -- "N or more messages exist" --> K[Select Nth-latest assistant message]
    J --> K
    K --> L[Extract text content blocks from message]
    L --> M{Content type check}
    M -- "type == 'text'" --> N[Accumulate text\nbundle.js:+9705707]
    M -- "other type" --> O[Skip block]
    N --> P[Render markdown tokens via lexer\nbundle.js:+9834297]
    P --> Q{Token type?}
    Q -- "table" --> R[Format as aligned table\nbundle.js:+9834410]
    Q -- "code" --> S[Emit code block\nbundle.js:+9833573]
    Q -- "plaintext" --> T[Emit plain text\nbundle.js:+9834851]
    R --> U[Assemble final string]
    S --> U
    T --> U
    O --> U
    U --> V[Write to clipboard via writeFile utility\nbundle.js:+9834997]
    V --> W[Emit tengu_copy telemetry\nbundle.js:+9839117]
    W --> X[Return JSX result to shell]
    I --> X
    E --> X
```

---

## Behavioral Spec

### 1. Argument Parsing

```
function parseArgument(rawArgs):
    trimmed = rawArgs.trim()
    if trimmed is empty:
        return 1                          // default: most-recent message
    n = Number(trimmed)
    if not Number.isInteger(n) or n < 1:
        return ERROR("argument must be a positive integer")
    return n
```

Analysis basis: CC v2.1.132 bundle.js:+9838808, +9838822

---

### 2. Assistant Message Collection

```
function collectAssistantMessages(conversationMessages):
    result = []
    for each message in conversationMessages:
        if message.role == "assistant":        // literal "assistant" bundle.js:+9834646
            result.push(message)
    return result                              // ordered oldest → newest
```

Analysis basis: CC v2.1.132 bundle.js:+9834646, +9834764

---

### 3. Index Resolution

```
function resolveIndex(assistantMessages, n):
    total = assistantMessages.length
    if total == 0:
        return NOT_FOUND                       // triggers "No assistant message to copy"
    // n=1 → last, n=2 → second-to-last, etc.
    rawIndex = total - n
    clampedIndex = Math.max(0, rawIndex)       // never goes below index 0
    return clampedIndex
```

The `Math.max` call clamps the index to prevent out-of-bounds access when `N` exceeds the total number of available assistant messages.

Analysis basis: CC v2.1.132 bundle.js:+9833877

---

### 4. Text Content Extraction

```
function extractTextContent(message):
    parts = []
    content = message.content
    if Array.isArray(content):
        for each block in content:
            filtered = filterByType(block, "text")   // type literal bundle.js:+9705707
            if filtered is not null:
                parts.push(filtered.text)
    else:
        parts.push(String(content))
    return parts.join("")
```

Analysis basis: CC v2.1.132 bundle.js:+9834716, +9834748, +9705707

---

### 5. Markdown Token Rendering

The extracted text is passed through a lexer (via the markdown parser utility) that tokenises the string and dispatches each token to a format-specific renderer.

```
function renderForClipboard(rawText):
    tokens = lexer(rawText)                    // bundle.js:+9834297
    outputParts = []
    for each token in tokens:
        switch token.type:
            case "table":
                outputParts.push(renderTable(token))
            case "code":
                outputParts.push(renderCode(token))
            case "plaintext":
                outputParts.push(token.text)   // bundle.js:+9834851
            default:
                outputParts.push(token.text)
    return outputParts.join("")
```

Analysis basis: CC v2.1.132 bundle.js:+9834297, +9834851, +9833573, +9834410

---

### 6. Table Formatting

When a table token is encountered, column values are separated by the pipe-space-space-pipe delimiter `" | "` and cells are padded according to alignment hints (`"left"`, `"center"`, `"right"`). Column separators containing `\|` are normalised.

```
function renderTable(tableToken):
    rows = tableToken.rows
    columnWidths = computeColumnWidths(rows, minWidth=3)   // Math.max, min 3 bundle.js:+9833886
    lines = []
    for each row in rows:
        cells = []
        for each cell, colIndex in row:
            width   = columnWidths[colIndex]
            align   = tableToken.align[colIndex]   // "left"|"center"|"right"
            padded  = padCell(cell, width, align)
            cells.push(padded)
        lines.push(cells.join(" | "))              // bundle.js:+9833986
    return lines.join("\n")
```

Alignment literal values observed: `"center"` (bundle.js:+9834021), `"right"` (bundle.js:+9834063), `"left"` (bundle.js:+9834103). Pipe escape sequence `\|` is replaced during cell normalisation (bundle.js:+9833827).

---

### 7. Clipboard Write

```
async function writeToClipboard(text):
    dir  = resolveClipboardStagingDir()        // creates dir if absent, mode 448 bundle.js:+9834985
    file = buildTempFilePath(dir)              // e.g. staging/clipboard.txt (.txt bundle.js:+9834883)
    await fileSystem.mkdir(dir, recursive=true)   // bundle.js:+9834954
    await fileSystem.writeFile(file, text)        // bundle.js:+9834997
```

The file extension for the staging file is `.txt` (bundle.js:+9834883). Directory permissions use octal `0o700` (decimal `448`, bundle.js:+9834985).

---

### 8. Error Path — No Assistant Message

```
function handleNoMessage():
    display("No assistant message to copy")    // literal bundle.js:+9838739
    return early without writing clipboard
```

Analysis basis: CC v2.1.132 bundle.js:+9838739

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` emitted after each successful clipboard write (bundle.js:+9839117) |
| Telemetry (incidental, depth-2) | `tengu_mcp_retry_failed_remote` (bundle.js:+13846663); `tengu_config_parse_error` (bundle.js:+3107927) — these belong to shared utilities reached transitively and are not directly triggered by `/copy` |
| Clipboard staging file | Written to a temporary directory with mode `0o700` (448); file extension `.txt` |
| File-system side effects | `mkdir` (recursive) + `writeFile` on the staging path |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.132 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy 2.5` or `/copy last` will fail argument validation because `Number.isInteger` rejects non-integer values. Always pass a whole positive number.
2. **Expecting `/copy 0` to work** — Index `0` is not a valid position; the minimum meaningful value is `1` (the most recent message). Using `0` or a negative number will fail the `n < 1` guard.
3. **Assuming N counts from oldest** — `N` is 1-based from the *newest* assistant message, not from the start of the conversation. `/copy 2` retrieves the second-most-recent assistant response.
4. **Running `/copy` in a session with no assistant turns** — If no assistant-role message exists yet in the conversation, the command exits early with `"No assistant message to copy"` and nothing is written to the clipboard.
5. **Expecting rich formatting in the clipboard output** — The command renders markdown through a token-based formatter. Only `table`, `code`, and `plaintext` token types have dedicated renderers; other markdown constructs may be emitted as raw text.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Io9` | Table-row renderer / column layout helper |
| `te4` | Column-width mapping function |
| `mzq` | Background session / timer utility |
| `Q8` | Session state accessor |
| `z8` | String display-width measurer (wraps `Bun.stringWidth`) |
| `Vo9` | Markdown token dispatcher / per-token render entry point |
| `Gf` | Markdown lexer/parser wrapper |
| `No9` | Text replacement / sanitise helper |
| `vo9` | Content-block array flattener |
| `vL` | Content-block type filter |
| `qH7` | Top-level `/copy` command handler (argument parse → select → render → write) |
| `se4` | Code-block token extractor |
| `IOH` | Code content replacement/clean-up helper |
| `R6` | Clipboard write orchestrator |
| `k5H` | Config/file-system read utility |
| `DPK` | File-watch helper |
| `XVA` | Clipboard staging-directory setup |
| `bE` | File encoding detection (`utf8` / `base64`) |
| `n4` | String index-of utility wrapper |
| `ko9` | Staging directory creator + file writer |
| `UZH` | MCP connection initialiser |
| `ZBq` | MCP update applicator |
| `j6` | MCP session deduplication guard |
| `$F7` | MCP client orchestrator |
| `k` | Log-level / debug mode resolver |
| `M` | App-state map / MCP state container |
| `K` | Process-exit-aware resource wrapper |
| `L` | Column-header padding renderer |
| `q` | File-system module reference |
| `f` | Stream close / teardown helper |
| `H` | Random delay / setTimeout utility |
| `d` | Telemetry dispatcher |