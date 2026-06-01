---
type: feature-spec
feature: "copy"
cc_version: "2.1.148"
updated: "2026-06-01"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.148 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.148 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.148

---

## Overview

`/copy` copies Claude's most recent assistant response to the system clipboard. An optional numeric argument `N` selects the Nth-latest assistant message instead of the default last one. The command delegates clipboard writing to a platform-aware utility that dispatches to `pbcopy` (macOS), `wl-copy`/`xclip`/`xsel` (Linux), PowerShell `Set-Clipboard` (Windows), or Kitty/tmux terminal integrations.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `eO1` |
| load_inline | `true` |
| loc_byte | `10543481` |
| loc_byte_end | `10543667` |
| loc_line | `8387` |
| arbor_handler.name | `wE7` |
| arbor_handler.fqn | `claude-2.1.148::wE7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.148 bundle.js:+10543481

---

## Input Branching

The command has four distinct branches based on argument parsing and message availability, so a flowchart is used.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument provided?}
    B -- "No" --> C[Use index = 1 (last message)]
    B -- "Yes, raw string" --> D{Is arg a valid integer?}
    D -- "No" --> E[Return error: 'No assistant message to copy']
    D -- "Yes, N" --> F[Use index = N]
    C --> G[Collect assistant messages from conversation]
    F --> G
    G --> H{Message at index exists?}
    H -- "No" --> I[Return error: 'No assistant message to copy']
    H -- "Yes" --> J[Extract text content from message]
    J --> K[Write to clipboard via platform writer]
    K --> L[Emit tengu_copy telemetry]
    L --> M[Return JSX confirmation to UI]
```

Analysis basis: CC v2.1.148 bundle.js:+10542666, +10542776, +10542790, +10542707

---

## Behavioral Spec

### 1. Argument Parsing (`assistantMessageCollector` / `wE7`)

The Arbor-resolved handler is the async function `wE7`.

```
async function copyCommandHandler(args, context):
    rawArg = args.trim()

    if rawArg is empty:
        targetIndex = 1          // default: last assistant message
    else:
        n = Number(rawArg)
        if not Number.isInteger(n) or n < 1:
            return errorResult("No assistant message to copy")
        targetIndex = n

    messages = collectAssistantMessages(context)
    // messages is ordered newest-first (index 1 = most recent)

    if targetIndex > messages.length:
        return errorResult("No assistant message to copy")

    selected = messages[targetIndex - 1]
    text = extractPlaintext(selected)

    await writeToClipboard(text)
    emit telemetry: "tengu_copy"
    return jsxConfirmation(text)
```

Analysis basis: CC v2.1.148 bundle.js:+10542666, +10542705, +10542776, +10542790, +10543020, +10543083, +10543085

---

### 2. Message Collection (`oO1`)

```
function collectAssistantMessages(context):
    allMessages = context.messages          // full conversation history
    assistantMessages = []

    for msg in allMessages:
        if msg.role == "assistant":         // literal "assistant" at +10538614
            textBlocks = filterTextBlocks(msg.content)
            // filterTextBlocks keeps only blocks with type == "text" (+10249185)
            if textBlocks is non-empty:
                plaintext = renderToPlaintext(textBlocks)
                assistantMessages.prepend(plaintext)  // newest-first order

    return assistantMessages
```

Analysis basis: CC v2.1.148 bundle.js:+10538432, +10538443, +10538614, +10249185

---

### 3. Plaintext Rendering (`sO1` / `rO1` table renderer)

Two rendering paths exist depending on content type detected by the lexer (`Vf.lexer`):

- **`table` mode** (`"table"` literal at +10538378): Content containing `|`-separated rows is parsed and reformatted. Column widths are computed with `Bun.stringWidth` (at +204663). Alignment tokens `"center"`, `"right"`, `"left"` are honoured (literals at +10537989, +10538031, +10538071). The separator character `"\\|"` is used (literal at +10537795), and columns are joined with `" | "` (literal at +10537954). Minimum column count is 3 (literal at +10537854).
- **`plaintext` mode** (`"plaintext"` literal at +10538819): Raw text replacement via `H.replace` (at +10538779) strips terminal control sequences before writing.

```
function renderToPlaintext(content):
    tokens = lexer(content)

    if tokens indicate tabular structure:
        columns = parseTableColumns(tokens)
        widths = columns.map(col => Bun.stringWidth(col))
        widths = widths.map(w => Math.max(w, 3))
        rows = formatRows(columns, widths, alignment)
        return rows.join("\n")
    else:
        return stripControlSequences(content)
```

Analysis basis: CC v2.1.148 bundle.js:+10537492, +10537752, +10537795, +10537845, +10537954, +10538265, +10538311, +10538378, +10538819

---

### 4. Platform Clipboard Writer (`mT` → `rc4` / `lc4` / `cc4`)

```
async function writeToClipboard(text):
    platform = process.platform

    if terminalIsKitty():
        useKittyProtocol(text)        // "kitty" literal at +3343184
        return

    if terminalIsITerm2():
        useTmuxLoadBuffer(text)       // "load-buffer" / "iTerm2" literals at +3343677, +3343687
        return

    if tmuxIsActive():
        writeTmuxBuffer(text)         // "tmux" literal at +3343749; uses tmp file at +3913661
        return

    if platform == "darwin":          // "darwin" at +3344062
        spawn("pbcopy", [], stdin=text)   // "pbcopy" at +3344088

    else if platform == "linux":      // "linux" at +3344114
        if wlCopyAvailable():
            spawn("wl-copy", [], stdin=text)           // "wl-copy" at +3344153
        else if xclipAvailable():
            spawn("xclip", ["-selection", "clipboard"], stdin=text)  // literals at +3344220, +3344233
        else if xselAvailable():
            spawn("xsel", ["--clipboard", "--input"], stdin=text)    // literals at +3344284, +3344298

    else if platform == "win32":      // "win32" at +3344565
        spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", "Set-Clipboard ..."])
        // literals at +3344577, +3344591, +3344604, +3344622

    else:
        throw UnsupportedPlatformError
```

Analysis basis: CC v2.1.148 bundle.js:+3343176, +3343184, +3343677, +3343687, +3343749, +3344062, +3344088, +3344114, +3344153, +3344199, +3344265, +3344565, +3344577

The `mU_` wrapper calls `mT` and passes a temp-directory resolver (`tO1` → `DX`) when a temporary file is needed (e.g., tmux path at +3913661). Temp-dir permissions are enforced: mode `448` (octal 700, literal at +3914342) and `511` (octal 777, literal at +3914152).

Analysis basis: CC v2.1.148 bundle.js:+10539030, +10539071, +10539110, +3914240, +3914307, +3914342

---

### 5. Error Path

When no qualifying assistant message is found (either no messages exist or the requested index is out of range), the handler returns a static error string:

> "No assistant message to copy" — string literal at +10542707

No clipboard write is attempted and no telemetry is emitted in the error path.

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (emitted on successful clipboard write; loc_byte +10543085) |
| Clipboard | System clipboard is mutated via a spawned subprocess or terminal escape sequence |
| Temp files | A temporary file under `CLAUDE_CODE_TMPDIR` (or `/tmp`) may be created for tmux path; it is cleaned up after the subprocess exits |
| appState changes | None observed in depth-2 traversal |
| Hook registration | None observed |
| Sound | None observed |

---

## Version History

| Version | Change |
|---|---|
| v2.1.148 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy foo` triggers the `Number.isInteger` guard and returns the "No assistant message to copy" error immediately without touching the clipboard.
2. **Index out of range** — `/copy 5` when only 3 assistant messages exist silently returns the same error. There is no "index too large" message distinct from "no messages at all".
3. **Unsupported Linux clipboard tool** — on headless Linux without `wl-copy`, `xclip`, or `xsel` installed, the clipboard write silently fails or throws; the user must install one of those tools.
4. **SSH remote sessions** — Kitty and tmux paths require terminal multiplexer support; on a plain SSH session without those, the Darwin/Linux native tool paths are used, which may fail if the remote has no display.
5. **Counting direction** — `/copy 1` is the *most recent* assistant message, not the oldest. Users accustomed to 0-based or oldest-first indexing may copy the wrong message.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `wE7` | Main async handler for `/copy` command (Arbor-resolved) |
| `rO1` | Table row formatter (computes column widths, alignment) |
| `$E7` | Column extraction helper called by table formatter |
| `oO1` | Assistant message collector; walks conversation history |
| `sO1` | Plaintext strip / control-sequence remover |
| `aO1` | Message content filter (keeps `type == "text"` blocks) |
| `fE7` | Lexer-based content tokenizer (calls `Vf.lexer`) |
| `zDH` | Token string replacer used during tokenization |
| `LK` | Text-block filter helper |
| `mU_` | Clipboard write orchestrator; selects platform path |
| `mT` | Core clipboard dispatcher (platform switch) |
| `mj` | Kitty-protocol clipboard writer |
| `Qc4` | Kitty escape sequence builder |
| `rc4` | macOS/Linux native clipboard writer (`pbcopy` / `xclip` etc.) |
| `T8` | Subprocess spawn wrapper used by clipboard writers |
| `lc4` | tmux `load-buffer` clipboard writer |
| `cc4` | String replace helper used in tmux path |
| `tO1` | Temporary file/directory resolver for tmux clipboard path |
| `DX` | Temp directory creator (enforces mode 448/511 permissions) |
| `y_L` | Directory stat + chmod helper called by `DX` |
| `$i` | Path sanitiser used by temp directory creator |
| `fL` | String index helper (calls `H.indexOf`) |
| `p9H` | Trim/truncation helper (uses `_.trim`, limit 1000 at +2177171) |
| `ZC1` | Daemon status file reader (`daemon.status.json`) |
| `aE6` | Status JSON path joiner |
| `ll` | Low-level file reader feeding `ZC1` |
| `M1` | AsyncLocalStorage store accessor |
| `CH` | JSON serialiser wrapper |
| `j8` | String-width calculator (delegates to `Bun.stringWidth`) |
| `v8` | Background-session label resolver (`"stopped"` / `"background session"` states) |
| `RH` | Error logging dispatcher |
| `n_` | Error string normaliser |
| `UH` | String coercer |
| `j1` | Traffic-class checker |
| `FpK` | Rolling log-buffer manager (shift/push) |
| `c` | Shared small utility (context-dependent) |
| `EQ4` | Config file watcher |
| `k$H` | Global config reader/writer |
| `B6` | JSON parse wrapper |
| `OC` | String prefix stripper |
| `q8` | Filesystem write helper |
| `hy9` | Config backup directory scanner |
| `AL_` | Backup path joiner |
| `x6` | Config load-and-watch entry point |
| `o4_` | Config object validator |
| `F6` | Config file path resolver |
| `Vf` | Markdown/text lexer module |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.