---
type: feature-spec
feature: "copy"
cc_version: "2.1.145"
updated: "2026-06-01"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.145 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.145 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.145

---

## Overview

`/copy` copies Claude's most recent assistant response to the system clipboard. An optional numeric argument (`/copy N`) selects the Nth-latest assistant message instead of the most recent one. The command extracts plain-text content from the conversation message list, dispatches the result to a platform-appropriate clipboard backend, and emits a `tengu_copy` telemetry event on completion.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `C4q` |
| load_inline | `true` |
| loc_byte | `10156682` |
| loc_byte_end | `10156868` |
| loc_line | `5642` |
| arbor_handler.name | `iw7` |
| arbor_handler.fqn | `claude-2.1.145::iw7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.145 bundle.js:+10156682

---

## Input Branching

Four distinct branches exist based on argument parsing and message lookup results, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument provided?}
    B -- "No" --> C[Use N = 1 (most recent)]
    B -- "Yes" --> D{Is arg a valid integer?}
    D -- "No" --> E["Error: argument not a valid integer\n(fallback / no-op)"]
    D -- "Yes" --> F["N = Number(arg)"]
    C --> G[Collect assistant messages from conversation]
    F --> G
    G --> H{Assistant message at index N-1 exists?}
    H -- "No" --> I["Display: 'No assistant message to copy'"]
    H -- "Yes" --> J[Extract plain-text content via messageToPlaintext]
    J --> K[Invoke platform clipboard writer]
    K --> L[Emit tengu_copy telemetry]
    L --> M[Return success JSX / confirmation]
```

Analysis basis: CC v2.1.145 bundle.js:+10155867 (handler entry `iw7`), +10155908 (error string), +10155977 (Number coercion), +10155991 (integer guard)

---

## Behavioral Spec

### 1. Argument Parsing (`iw7` — main handler)

The handler `iw7` is an `AsyncFunction` resolved via `module_id → C4q`.

```
async function copyCommandHandler(rawInput, appContext):
    # Parse optional numeric argument
    arg = rawInput.trim()

    if arg is empty:
        targetIndex = 1          # default: most-recent assistant message
    else:
        n = Number(arg)
        if not Number.isInteger(n):
            return displayError("No assistant message to copy")
        targetIndex = n

    # Retrieve assistant messages
    messages = collectAssistantMessages(appContext)   # calls messageCollector (h4q)

    if messages.length < targetIndex:
        return displayError("No assistant message to copy")

    # Nth-latest: index from the end
    selectedMessage = messages[messages.length - targetIndex]

    plainText = convertMessageToPlaintext(selectedMessage)  # calls plaintextConverter (y4q → k4q)

    writeToClipboard(plainText)   # calls clipboardWriter (Au_ → GT)

    emit("tengu_copy")

    return successJSX(plainText)
```

Analysis basis: CC v2.1.145 bundle.js:+10155867, +10155906, +10155977, +10155991, +10156221, +10156233, +10156242, +10156284, +10156375

---

### 2. Assistant Message Collection (`messageCollector` — `h4q`)

Filters the conversation message list to retain only entries whose role is `"assistant"` and whose content type is `"text"`.

```
function collectAssistantMessages(appContext):
    allMessages = appContext.messages          # full conversation array
    result = []
    for each message in allMessages:
        if Array.isArray(message.content):
            textBlocks = filterTextBlocks(message.content)   # PK: filters by type=="text"
            if textBlocks.length > 0 and message.role == "assistant":
                result.push(message)
    return result
```

Relevant literals: `"assistant"` (bundle.js:+10151815), `"text"` (bundle.js:+9868348).

Analysis basis: CC v2.1.145 bundle.js:+10151885, +10151917, +10151933

---

### 3. Plaintext Conversion (`plaintextConverter` — `y4q` / `k4q`)

The conversion pipeline renders structured message content as human-readable plain text. It handles both ordinary text blocks and table-formatted content.

```
function convertMessageToPlaintext(message):
    tokens = markdownLexer(message.content)    # _M.lexer call
    result = []

    for each token in tokens:
        if token.type == "table":
            tableText = renderTableAsText(token)   # k4q renders columns
            result.push(tableText)
        else:
            result.push(token.text ?? token.raw)

    return result.join("")

function renderTableAsText(tableToken):
    # Determine column widths via Bun.stringWidth (stringWidthHelper — $8)
    # Compute max width per column; minimum column width: 3 characters
    # Align cells: "left" | "center" | "right" per header alignment
    # Separator row uses "\\|" (bundle.js:+10150996)
    # Cells joined with " | " (bundle.js:+10151155)
    columnCount = Math.max(...)
    rows = _.map(columns)
    paddedRows = A.map(rows, padEnd)
    return rows.join("\n")
```

Relevant literals: `"table"` (bundle.js:+10151579), `"plaintext"` (bundle.js:+10152020), `" | "` (bundle.js:+10151155), `"center"` (bundle.js:+10151190), `"right"` (bundle.js:+10151232), `"left"` (bundle.js:+10151272), column separator `"\\|"` (bundle.js:+10150996), minimum column count `3` (bundle.js:+10151055).

Analysis basis: CC v2.1.145 bundle.js:+10151466, +10151512, +10151633, +10150953, +10150969, +10150980, +10151046, +10151060, +10151071, +10151344, +10151357

---

### 4. Clipboard Writer (`clipboardWriter` — `Au_` → `GT`)

Platform dispatch selects the appropriate OS clipboard mechanism. All paths write the plain-text string via a subprocess or terminal escape sequence.

```
function writeToClipboard(text):
    platform = process.platform

    if terminalIsKitty():
        useKittyProtocol(text)              # "kitty" literal, bundle.js:+3330285
    else if terminalIsITerm2():
        useTmuxLoadBuffer(text, "-w")       # "iTerm2", "load-buffer", "-w", bundle.js:+3330778–3330822
    else if platform == "darwin":
        spawn("pbcopy", stdin=text)         # bundle.js:+3331189
    else if platform == "linux":
        try spawn("wl-copy", stdin=text)    # bundle.js:+3331254  (Wayland)
        fallback spawn("xclip", "-selection", "clipboard", stdin=text)  # bundle.js:+3331300
        fallback spawn("xsel", "--clipboard", "--input", stdin=text)    # bundle.js:+3331366
    else if platform == "win32":
        spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", ...], stdin=text)
        # bundle.js:+3331678–3331723
    else if inTmuxSession():
        useTmuxLoadBuffer(text)             # "tmux" literal, bundle.js:+3330850

    # Text encoding: utf8 / base64 depending on transport
    # bundle.js:+3330951, +3330968
```

Analysis basis: CC v2.1.145 bundle.js:+10156375, +10152231, +3330980, +3331034, +3331050, +3331064, +3331163, +3331215, +3331666

---

### 5. Temporary-File Staging for Clipboard (`tempFileWriter` — `R4q`)

For clipboard backends that require a file path (rather than stdin), a temporary file is written under a controlled temp directory.

```
function writeTempClipboardFile(text):
    tmpDir = resolveTempDir(rP)          # rP: joins z5_.join path, checks CLAUDE_CODE_TMPDIR
    filePath = I4q.join(tmpDir, generatedName)
    Xj8.mkdir(tmpDir, { recursive: true })
    Xj8.writeFile(filePath, text)
    return filePath
```

Analysis basis: CC v2.1.145 bundle.js:+10152089, +10152096, +10152123, +10152166

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (bundle.js:+10156286) — fired once per successful copy invocation. Indirect telemetry reachable in the deep call graph includes MCP/daemon events; those are not triggered by normal `/copy` usage. |
| Clipboard OS write | Spawns one of: `pbcopy` (macOS), `wl-copy` / `xclip` / `xsel` (Linux/Wayland/X11), `powershell` (Windows), Kitty/tmux escape (terminal-specific) |
| Temp files | A staging file may be written to `CLAUDE_CODE_TMPDIR` (or `/tmp` fallback) and cleaned up after the clipboard backend reads it |
| appState changes | None observed in depth-2 traversal for the happy path |
| Hook registration | None observed in depth-2 traversal for `/copy` itself |
| Sound | None observed |
| Error display | Inline JSX message `"No assistant message to copy"` (bundle.js:+10155908) rendered in the CLI on failure |

---

## Version History

| Version | Change |
|---|---|
| v2.1.145 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy 1.5` or `/copy latest` will fail the `Number.isInteger` guard and display "No assistant message to copy" instead of copying anything. Only whole positive integers are accepted.
2. **Requesting an index larger than the message count** — `/copy 99` when fewer than 99 assistant messages exist silently fails with the same error message. Verify the conversation depth before using large N values.
3. **Clipboard tool not installed (Linux)** — On X11/Wayland systems, at least one of `wl-copy`, `xclip`, or `xsel` must be present in `PATH`. The command will fail without an informative error if none are available.
4. **Running over SSH without clipboard forwarding** — The subprocess-based clipboard write targets the server's clipboard. Without X11/Wayland forwarding or an OSC-52-capable terminal, the content will not reach the local client clipboard.
5. **Confusing copy direction** — `/copy` only copies the *last assistant* message. It does not copy the current user prompt or the entire conversation.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `iw7` | Main `/copy` command handler (AsyncFunction, resolved via module_id `C4q`) |
| `h4q` | Assistant message collector — filters conversation array by role and content type |
| `y4q` | Plaintext conversion entry — tokenises message content via markdown lexer |
| `k4q` | Table-to-plaintext renderer — aligns columns, computes widths, joins with separators |
| `gw7` | Markdown lexer wrapper — invokes `_M.lexer` and accumulates token list |
| `S4q` | String replacement helper used during plaintext normalisation |
| `$YH` | Token text replacement utility called from `gw7` |
| `Au_` | Clipboard writer dispatcher — selects platform backend |
| `GT` | Platform clipboard strategy resolver — branches on OS and terminal type |
| `$j` | Kitty terminal clipboard helper — encodes content for Kitty protocol |
| `bmL` | Kitty protocol encoder (`aj` combinator) |
| `BmL` | macOS `pbcopy` clipboard backend |
| `mmL` | Linux Wayland/X11 clipboard backend (`wl-copy`, `xclip`, `xsel`) |
| `umL` | String replaceAll helper used in clipboard payload preparation |
| `Y8` | Subprocess spawner for clipboard tools |
| `R4q` | Temp file writer for clipboard staging |
| `rP` | Temp directory resolver (respects `CLAUDE_CODE_TMPDIR`) |
| `ToL` | Temp directory validator — checks lstat, isDirectory, applies chmod |
| `U4` | String indexOf utility called from `Au_` |
| `_M` | Markdown lexer module — exposes `.lexer()` |
| `PK` | Text-block filter — retains only content blocks with `type == "text"` |
| `Qw7` | Column-mapping helper called from `k4q` |
| `$8` | String-width helper (delegates to `Bun.stringWidth`) |
| `K` | Column pad-end formatter |
| `k8` | Session-state helper accessed via `O.replace` path |
| `lAH` | Trim/clean helper — calls `_.trim` with 1000 ms threshold constant |
| `dvq` | Daemon status reader — reads `daemon.status.json` |
| `KT6` | Status JSON path joiner (`Qvq.join`) |
| `RH` | JSON serialiser (`JSON.stringify` wrapper) |
| `Q1` | Store accessor (`yoL.getStore`) |
| `NH` | Error logger — pushes to `GCH`, calls `gc.logError` |
| `xH` | String conversion helper |
| `Hq` | Essential-traffic queue helper |
| `mhK` | Rolling log buffer manager (`aR6.shift` / `aR6.push`) |
| `d` | Generic utility / context object (referenced broadly) |
| `GT` | (see `Au_` row above — `GT` is the inner strategy resolver) |
| `kn` | Temp-dir name generator called from `rP` |