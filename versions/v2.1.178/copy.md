---
type: feature-spec
feature: "copy"
cc_version: "2.1.178"
updated: "2026-06-16"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.178 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.178 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.178

---

## Overview

The `/copy` command copies Claude's most recent assistant response text to the system clipboard. An optional numeric argument `N` selects the Nth-latest assistant response instead of the most recent one. The command resolves the target message from conversation history, extracts its text content, and delegates to a platform-aware clipboard-writing subsystem that supports macOS, Linux (Wayland and X11), Windows/WSL, tmux buffers, and OSC 52 terminal escape sequences.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| loc_byte | `11380516` |
| loc_byte_end | `11380702` |
| loc_line | `7277` |
| module_id | `Y_K` |
| load_inline | `true` |
| arbor_handler.name | `dpL` |
| arbor_handler.fqn | `claude-2.1.178::dpL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.178 bundle.js:+11380516

---

## Input Branching

The command has four distinct top-level branches (no argument, valid integer N, invalid argument, no assistant message found), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument present?}
    B -- No --> C[Use N = 1\n(most-recent)]
    B -- Yes --> D{Is arg a valid integer?}
    D -- No --> E[Return error:\n'No assistant message to copy']
    D -- Yes --> F[Parse N = Number(arg)]
    C --> G[Scan conversation history\nfor Nth-latest assistant message]
    F --> G
    G --> H{Assistant message found\nat position N?}
    H -- No --> I[Return error:\n'No assistant message to copy']
    H -- Yes --> J[Extract text content blocks\nfrom message]
    J --> K[Flatten & join text]
    K --> L[writeToClipboard(text)]
    L --> M{Platform detection}
    M -- macOS --> N[pbcopy]
    M -- Linux / Wayland --> O[wl-copy]
    M -- Linux / X11 --> P[xclip or xsel]
    M -- Windows / WSL --> Q[powershell.exe\nSet-Clipboard]
    M -- tmux --> R[tmux load-buffer]
    M -- OSC 52 terminal --> S[OSC 52 escape sequence\nvia raw+dcs / dcs / raw]
    M -- none detected --> T[No-op / fallback]
    N & O & P & Q & R & S & T --> U[Emit tengu_copy telemetry]
    U --> V[Return success JSX]
```

Analysis basis: CC v2.1.178 bundle.js:+11379701 (handler entry `dpL`), +11379740, +11379811, +11379825, +11380055

---

## Behavioral Spec

### 1. Argument Parsing (`$_K` → array-guard + filter utility `U4`)

```
function parseArgument(rawArgs):
    if not Array.isArray(rawArgs):
        args = []
    else:
        args = rawArgs

    // filter using U4 (text-content filter)
    textParts = U4.filter(args, kind == "text")
    argString = textParts.join("").trim()

    if argString is empty:
        return { n: 1, valid: true }

    n = Number(argString)
    if not Number.isInteger(n) or n < 1:
        return { n: null, valid: false }

    return { n: n, valid: true }
```

Analysis basis: CC v2.1.178 bundle.js:+11375719 (`$_K`), +11375751 (`U4`), +11379701, +11379811, +11379825

### 2. Message Lookup (`M_K` with lexer via `M$`)

```
function findNthLatestAssistantMessage(conversationMessages, n):
    // Tokenize / lex the message list (M$.lexer)
    lexed = lexer(conversationMessages)

    // Walk backward through messages keeping only role == "assistant"
    assistantMessages = []
    for msg in reverse(lexed):
        if msg.role == "assistant":
            assistantMessages.push(msg)

    if assistantMessages.length < n:
        return null

    // n is 1-indexed; index 0 = most recent
    return assistantMessages[n - 1]
```

Analysis basis: CC v2.1.178 bundle.js:+11375300 (`M_K` → `M$.lexer`), +11375346, +11375467, +11375478; literal `"assistant"` at +11375649

### 3. Text Extraction (`ppL`)

```
function extractTextFromMessage(message):
    // Lex content blocks (ppL uses M$.lexer + OTH string-replace helper)
    blocks = lexer(message.content)
    texts = []
    for block in blocks:
        if block.type == "text":
            cleaned = OTH.replace(block.text)  // normalize whitespace/escapes
            texts.push(cleaned)
    return texts.join("")
```

Analysis basis: CC v2.1.178 bundle.js:+11374539 (`ppL` → `M$.lexer`), +11374548 (`OTH`), +11374604; literal `"text"` at +11122547

### 4. Table / Column Formatting Helper (`L_K`)

```
function formatResponseTable(lines):
    // Split on pipe separators (literal "\\|" at +11374842)
    // Calculate max column widths using Bun.stringWidth (_8)
    // Pad columns to width+3 (literal 3 at +11374901)
    // Align: "center" / "right" / "left" (literals at +11375036, +11375074, +11375110)
    // Join with " | " (literal at +11375001)
    // Replace pipe escape sequences (O.replace via C8)
    return formattedText
```

Analysis basis: CC v2.1.178 bundle.js:+11374799 (`L_K` → `UpL`), +11374815, +11374826, +11374892, +11374906, +11374917 (`_8`/`Bun.stringWidth`), +11375055 (`OM`/`H.repeat`)

### 5. No-message Error Path

```
function handleMissingMessage():
    // Literal string confirmed at +11379742
    return errorResponse("No assistant message to copy")
```

Analysis basis: CC v2.1.178 bundle.js:+11379740 (branch), +11379742 (literal `"No assistant message to copy"`)

### 6. Clipboard Write Dispatch (`ROA` → `QW` and sub-utilities)

```
async function writeToClipboard(text):
    encoded = base64(text)               // literal "base64" at +3530385

    environment = detectTerminalEnvironment()
    // environment values: "unset", "tmux", "screen", "kitty", etc.

    switch environment:
        case "tmux":
            exec(["tmux", "load-buffer", "-w", "-"])   // literals at +3530051, +3530059, +3530073
            write(text)

        case "screen":
            useOSC52(encoded, mode="raw+dcs" or "dcs")  // literals at +3530483, +3530506

        case "kitty":
            useEscapeSequence("\x1b\x1b", encoded)       // literal at +3529359

        case platform == "linux":
            tryInOrder([
                ["wl-copy"],                             // literal "wl-copy" at +3529760
                ["xclip", "-selection", "clipboard"],    // literals at +3529829, +3530984, +3530997
                ["xsel", "--clipboard", "--input"],      // literals at +3529870, +3531084, +3531098
            ])

        case platform == "macos":
            exec(["pbcopy"])                             // literal "pbcopy" at +3530804

        case platform == "wsl" or "windows":
            exec(["powershell.exe", "-NoProfile",
                  "-NonInteractive", "-Command",
                  "Set-Clipboard ..."])                  // literals at +3531170, +3531188, +3531201, +3531219

        case osc52Available:
            writeOSC52(encoded,
                mode="raw+dcs"|"dcs"|"raw"|"none")       // literals at +3530483–3530557

        default:
            // tmux-buffer fallback or no-op
            // literal "tmux-buffer" at +3529631
            // literal "osc52" at +3529651

    timeout = 2000 ms                                    // literal at +3530770
```

Analysis basis: CC v2.1.178 bundle.js:+11380209 (`ROA`), +11376065 (`QW`), +3530399 (`zT6`), +3530405 (`J39`), +3530418 (`qof`), +3530431 (`yI_`), +3529683 (`kI_` Linux path), +3530804 (pbcopy)

### 7. Main Handler Entry (`dpL`)

```
async function copyCommandHandler(args, context):
    { n, valid } = parseArgument(args)

    if not valid:
        return errorJSX("No assistant message to copy")

    messages = context.messages          // literal "messages" at +11380006
    message  = findNthLatestAssistantMessage(messages, n)

    if message is null:
        return errorJSX("No assistant message to copy")

    text = extractTextFromMessage(message)

    emit_telemetry("tengu_copy")         // loc_byte +11380120

    await writeToClipboard(text)

    return successJSX()
```

Analysis basis: CC v2.1.178 bundle.js:+11379701 (`dpL`→`$_K`), +11380055 (`M_K`), +11380067 (`ppL`), +11380076 (`S6` config read), +11380118 (`d` success render), +11380120 (telemetry `tengu_copy`), +11380209 (`ROA` clipboard write)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (emitted once per successful invocation; loc_byte +11380120) |
| Clipboard write | Mutates OS clipboard via platform-specific subprocess or terminal escape sequence; timeout 2000 ms (+3530770) |
| Config read | Reads global config via `S6` / `_MH` to detect clipboard method preferences (+11380076, +3347543) |
| File watch | `wnf` / `$O8.watchFile` may be active for config hot-reload — not triggered by `/copy` itself, but part of the same module (+3347046) |
| appState changes | None observed in depth-2 traversal |
| Sound | None observed in depth-2 traversal |
| Hook registration | None observed for this command specifically |

---

## Version History

| Version | Change |
|---|---|
| v2.1.178 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy abc` or `/copy 1.5` will fail the `Number.isInteger` guard and return "No assistant message to copy" rather than a helpful parse error. Only whole positive integers are accepted.
2. **Index out of range** — `/copy 5` when fewer than five assistant messages exist returns the same generic error message; there is no distinct "out of range" message to distinguish from "no messages at all."
3. **Clipboard tool not available on Linux** — if none of `wl-copy`, `xclip`, or `xsel` is installed, the clipboard write silently falls back to an OSC 52 sequence or no-op. Users in minimal container environments should install at least one X11/Wayland clipboard utility.
4. **Remote SSH sessions** — OSC 52 support depends on the terminal multiplexer or terminal emulator forwarding the escape sequence. In SSH sessions without OSC 52 passthrough, the copy may silently fail.
5. **Using `/copy 0`** — zero is not a valid 1-indexed position; it fails the integer validity check and returns an error.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `dpL` | Main async handler for `/copy` (Arbor-resolved; `claude-2.1.178::dpL`) |
| `$_K` | Argument parser — array-guard + content-block extraction |
| `U4` | Text-block filter utility (filters content blocks by `kind == "text"`) |
| `M_K` | Nth-latest assistant message lookup (uses lexer + role scan) |
| `M$` | Lexer module (exposes `M$.lexer`; parses message/content structures) |
| `ppL` | Text content extractor from a single message |
| `OTH` | String normalization/replace helper used during text extraction |
| `L_K` | Table/column formatter for pipe-separated response text |
| `UpL` | Column-splitting helper called by `L_K` |
| `_8` | String-width measurement wrapper (`Bun.stringWidth`) |
| `OM` | Padding/repeat helper (`H.repeat`, `Number.isFinite`) |
| `O_K` | Pipe-escape replacement helper (`H.replace`) |
| `ROA` | Clipboard write dispatcher — selects platform strategy |
| `QW` | Core clipboard write implementation (spawns OS clipboard tools) |
| `zT6` | OSC 52 / terminal escape sequence writer |
| `Iw` | Low-level terminal write primitive |
| `J39` | macOS `pbcopy` executor |
| `g8` | Subprocess spawner utility (`Q_`, `u6`) |
| `kI_` | Linux clipboard tool selector (`wl-copy`, `xclip`, `xsel`) |
| `qof` | Fallback clipboard path (uses `g8`, `N`) |
| `yI_` | OSC 52 encoder/writer |
| `YT6` | tmux-buffer clipboard path |
| `DG` | String escaping helper for clipboard content (`H.replaceAll`) |
| `iw` | Kitty terminal escape path (`j39`, `H.join`) |
| `j39` | Kitty-specific OSC writer (`Iw`) |
| `z_K` | Temporary-file writer used as clipboard staging area (`rB8.writeFile`) |
| `rj` | Temp-directory setup utility (`cPH.mkdirSync`, `C29`) |
| `C29` | Directory validation and chmod helper |
| `S6` | Global config reader (config object provider) |
| `_MH` | Config file parser (`q.readFileSync`, JSON parse, backup logic) |
| `wnf` | Config file watcher (`$O8.watchFile` / `$O8.unwatchFile`) |
| `cLH` | Text trimming/cleaning helper (uses `_.trim`) |
| `zt` | Message text accessor (calls `cLH`) |
| `xGK` | Daemon status reader (`daemon.status.json`) |
| `XF6` | Status file path joiner (`bGK.join`, `M_`) |
| `xH` | JSON serializer wrapper (`JSON.stringify`) |
| `C8` | Background-session type resolver (literal `"background session"`) |
| `f9` | AsyncLocalStorage store accessor (`P2f.getStore`) |
| `TH` | String coercion utility (`String`) |
| `uf` | String index-of helper (`H.indexOf`) |
| `Cp` | Temp-path builder |