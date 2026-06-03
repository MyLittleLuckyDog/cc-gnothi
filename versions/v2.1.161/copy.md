---
type: feature-spec
feature: "copy"
cc_version: "2.1.161"
updated: "2026-06-03"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.161 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.161 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.161

---

## Overview

The `/copy` command copies Claude's most recent assistant response to the system clipboard. Optionally, the user may specify a positive integer argument `N` to retrieve the Nth-latest assistant message instead of the most recent one. The command selects the target message from conversation history, formats its content, and writes it to the OS clipboard via a platform-aware backend.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `ER1` |
| load_inline | `true` |
| loc_byte | `10912156` |
| loc_byte_end | `10912342` |
| loc_line | `7204` |
| arbor_handler.name | `uff` |
| arbor_handler.fqn | `claude-2.1.161::uff` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.161 bundle.js:+10912156

---

## Input Branching

The command has 4+ distinct branches based on argument parsing, message existence, integer validation, and platform clipboard routing, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Parse argument\nfrom input}
    B --> C{Argument present?}
    C -->|No| D[Use index = 1\n(most recent)]
    C -->|Yes| E{Is valid integer?}
    E -->|No| F[Return error:\ninvalid argument]
    E -->|Yes| D2[Use index = N\n(Nth-latest)]
    D --> G[Collect assistant messages\nfrom conversation history]
    D2 --> G
    G --> H{Assistant message\nfound at index?}
    H -->|No| I[Return error:\n'No assistant message to copy']
    H -->|Yes| J[Extract and format\nmessage content]
    J --> K[Invoke platform clipboard\nwrite function]
    K --> L{Platform detection}
    L -->|macOS| M[pbcopy]
    L -->|Linux / Wayland| N[wl-copy]
    L -->|Linux / X11 xclip| O[xclip -selection clipboard]
    L -->|Linux / X11 xsel| P[xsel --clipboard --input]
    L -->|tmux| Q[tmux load-buffer]
    L -->|kitty| R[kitty clipboard OSC]
    L -->|WSL / Windows| S[powershell.exe\nSet-Clipboard]
    M & N & O & P & Q & R & S --> T[Emit telemetry:\ntengu_copy]
    T --> U[Return success to UI]
```

Analysis basis: CC v2.1.161 bundle.js:+10911341 (handler `uff`), +10911382 (error string), +10911465 (integer check), +3411292 (pbcopy), +3410623 (wl-copy)

---

## Behavioral Spec

### 1. Main Handler — Argument Parsing and Message Selection

The Arbor-resolved handler is `uff` (AsyncFunction). It is the authoritative entry point.

```
async function copyCommandHandler(commandInput):
    # Step 1: collect assistant messages from current conversation
    assistantMessages = collectAssistantMessages(commandInput)

    # Step 2: check that at least one assistant message exists
    if assistantMessages is empty:
        return errorResult("No assistant message to copy")

    # Step 3: parse optional numeric argument
    rawArg = parseArgument(commandInput)   # strips leading/trailing whitespace
    if rawArg is present:
        n = Number(rawArg)
        if not Number.isInteger(n) or n < 1:
            return errorResult("invalid argument — expected positive integer")
        index = n
    else:
        index = 1   # default: most recent assistant message

    # Step 4: retrieve the Nth-latest assistant message (1-based from end)
    targetMessage = assistantMessages[ assistantMessages.length - index ]
    if targetMessage is undefined:
        return errorResult("No assistant message to copy")

    # Step 5: render/format the message content
    formattedText = renderMessageToPlaintext(targetMessage)

    # Step 6: write to OS clipboard
    writeToClipboard(formattedText)

    # Step 7: telemetry
    emit("tengu_copy")

    return successResult()
```

Analysis basis: CC v2.1.161 bundle.js:+10911341 (`uff`→`PR1`), +10911380 (`uff`→`H`), +10911451 (`uff`→`Number`), +10911465 (`uff`→`Number.isInteger`), +10911695 (`uff`→`JR1`), +10911707 (`uff`→`hff`), +10911760 (telemetry)

---

### 2. Assistant Message Collector

`PR1` filters the conversation message list for entries with role `"assistant"` and content type `"text"`.

```
function collectAssistantMessages(messages):
    if not Array.isArray(messages):
        return []
    result = []
    for each message in messages:
        if message.role == "assistant":
            textParts = filterTextContent(message)   # hK: filter content blocks of type "text"
            result.push(textParts)
    return result
```

Analysis basis: CC v2.1.161 bundle.js:+10907359 (`PR1`→`Array.isArray`), +10907391 (`PR1`→`hK`), +10907407 (`PR1`→`_.push`), +10605989 (`hK`→`H.filter`), +10606012 (literal `"text"`), +10907289 (literal `"assistant"`)

---

### 3. Message Renderer — Markdown to Plaintext

`JR1` converts a structured message to a printable string. It handles inline code/text, tables (`"table"` layout), and plain paragraphs (`"plaintext"`).

```
function renderMessageToPlaintext(message):
    tokens = lexMessage(message)           # X$.lexer: tokenize structured content
    tableColumnWidths = []
    for each token in tokens:
        if token is table separator (matches "\|"):
            tableColumnWidths = computeColumnWidths(token, Math.max)
    lines = []
    for each token in tokens:
        rendered = renderToken(token, tableColumnWidths)
        lines.push(rendered)
    return lines.join("\n")
```

Sub-steps for `renderToken` include:
- Replacing `\|` pipe-escape sequences via `O.replace` (Analysis basis: CC v2.1.161 bundle.js:+10906454)
- Applying column padding with `"left"`, `"center"`, `"right"` alignment (literals at +10906746, +10906664, +10906706)
- Column separator `" | "` (literal at +10906629)
- Minimum column width: 3 characters (literal `3` at +10906529)
- String width measurement via `Bun.stringWidth` (`_8`, Analysis basis: CC v2.1.161 bundle.js:+10906545→+207379)
- Path normalization for any embedded file references via `nC6` (Analysis basis: CC v2.1.161 bundle.js:+15618560)

Analysis basis: CC v2.1.161 bundle.js:+10906940 (`JR1`→`X$.lexer`), +10906986 (`JR1`→`H.indexOf`), +10907107 (`JR1`→`jR1`), +10907118 (`JR1`→`A.slice`), +10907053 (literal `"table"`), +10907494 (literal `"plaintext"`), +10907526 (literal `".txt"`)

---

### 4. Table Row Formatter

`jR1` is a dedicated table-row formatting helper called from the renderer.

```
function formatTableRow(cells, columnWidths):
    escapedCells = cells.map(cell => cell.replace("\|", "|"))  # unescape pipes
    paddedCells = []
    for i, cell in escapedCells:
        width = Math.max(columnWidths[i], 3)
        paddedCells.push(padCell(cell, width))   # _8: Bun.stringWidth-aware padding
    return paddedCells.join(" | ")
```

Analysis basis: CC v2.1.161 bundle.js:+10906392 (`jR1` calls `Sff` and `_.map`), +10906454 (`O.replace`), +10906520 (`Math.max`), +10906545 (`_8`)

---

### 5. Platform Clipboard Writer — `HZ` / `xiq` / `RJ_` / `SJ_` / `ZW` / `QJ`

`Ge_` (called from `uff` at +10911849) is a clipboard-write orchestrator. It invokes `HZ`, which selects the appropriate OS backend.

```
async function writeToClipboard(text):
    encodedText = encodeText(text, "utf8")      # fallback: "base64"
    platform = detectPlatform()

    if platform == "darwin" (macOS):
        spawn("pbcopy", stdin=encodedText)       # xiq path, loc +3411292
    elif platform == "linux":
        if waylandAvailable():
            spawn("wl-copy", stdin=encodedText)  # RJ_ path, loc +3410623
        elif xclipAvailable():
            spawn("xclip", ["-selection", "clipboard"], stdin=encodedText)  # loc +3410692
        elif xselAvailable():
            spawn("xsel", ["--clipboard", "--input"], stdin=encodedText)    # loc +3410733
        else:
            raise ClipboardError
    elif insideTmux():
        spawn("tmux", ["load-buffer", "-w"], stdin=encodedText)   # L0L path, loc +3410926
    elif insideKitty():
        useKittyOSCProtocol(encodedText)          # QJ/biq path, loc +3410094
    elif platform == "win32" or insideWSL():
        spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Set-Clipboard ..."])
        # loc +3411658, +3411676, +3411689, +3411707
    elif insideScreen():
        useScreenPasteBuffer(encodedText)         # SJ_/ZW path, loc +3409625

    # Timeout for clipboard subprocess: 2000 ms
    # loc_byte: +3411258
```

Encoding constants: `"utf8"` (+3411027), `"base64"` (+3411044).
Subprocess timeout: **2000 ms** (Analysis basis: CC v2.1.161 bundle.js:+3411258).
macOS subprocess retries tracked with max retries constant **10** (Analysis basis: CC v2.1.161 bundle.js:+1051079).

Analysis basis: CC v2.1.161 bundle.js:+10911849 (`uff`→`Ge_`), +10907705 (`Ge_`→`HZ`), +3411058 (`HZ`→`P98`), +3411064 (`HZ`→`xiq`), +3411077 (`HZ`→`L0L`), +3411090 (`HZ`→`SJ_`), +3411144 (`HZ`→`ZW`), +3411186 (`HZ`→`QJ`)

---

### 6. Argument Tokenizer / Lexer Helper

`hff` (called from `uff` at +10911707) tokenizes the raw argument string using the same lexer (`X$.lexer`) as the renderer, in order to strip markup from the index argument before parsing.

```
function tokenizeArgument(rawInput):
    tokens = X$.lexer(rawInput)           # ZIH.parse-based lexer
    result = []
    for each token in tokens:
        cleaned = stripMarkupFromToken(token)   # oJH: H.replace for markup removal
        result.push(cleaned)
    return result.join("")
```

Analysis basis: CC v2.1.161 bundle.js:+10906167 (`hff`→`X$.lexer`), +10906176 (`hff`→`oJH`), +10906232 (`hff`→`A.push`), +10604368 (`oJH`→`H.replace`)

---

### 7. File-Save Side Path (XR1 / WR1)

When the `"plaintext"` render mode is active and a `.txt` output path is configured, `WR1` persists the clipboard text to disk as a side-effect of the copy operation.

```
function saveToFile(outputPath, text):
    dir = YR1.join(outputPath)
    KI8.mkdir(dir, {recursive: true})
    KI8.writeFile(outputPath, text)
    setPermissions(outputPath, 0o700)   # octal 448 decimal, loc +3994424
```

Analysis basis: CC v2.1.161 bundle.js:+10907454 (`XR1`→`H.replace`), +10907570 (`WR1`→`YR1.join`), +10907597 (`WR1`→`KI8.mkdir`), +10907640 (`WR1`→`KI8.writeFile`), +10907526 (literal `".txt"`), +3994424 (literal `448`)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (emitted on every invocation, success or failure — loc +10911760) |
| Telemetry (indirect — clipboard subsystem) | `tengu_feature_ok` (+966587), `tengu_feature_bad` (+966650), `tengu_feature_sad` (+966732) |
| Clipboard write | System clipboard modified via OS-native subprocess (pbcopy / wl-copy / xclip / xsel / tmux / kitty / powershell) |
| File write (conditional) | Optional `.txt` file written to disk when plaintext mode path is set (`WR1` path) |
| appState changes | None identified in depth-2 traversal |
| Sound | None identified |
| Hook registration | None identified |

---

## Version History

| Version | Change |
|---|---|
| v2.1.161 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument**: `/copy 2.5` or `/copy last` will fail argument validation. The argument must be a positive integer; the handler calls `Number.isInteger()` and rejects any non-integer value (Analysis basis: CC v2.1.161 bundle.js:+10911465).
2. **Using `/copy 0` or a negative index**: Index must be ≥ 1. Passing `0` or a negative number will fail the integer validity check or produce an out-of-bounds lookup.
3. **Expecting copy to work when no assistant turn exists**: If the conversation has no assistant messages yet, the command returns the error `"No assistant message to copy"` immediately (Analysis basis: CC v2.1.161 bundle.js:+10911382).
4. **Clipboard unavailable on headless Linux**: The clipboard backend requires one of `wl-copy`, `xclip`, or `xsel` to be installed. On a headless server without a display server or Wayland compositor, all three may be absent and the command will fail silently or error.
5. **Index out of range**: Requesting `/copy N` where N is larger than the number of assistant messages in the session results in an undefined target and returns an error. The conversation history is bounded to the current session only.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `uff` | Main handler (`AsyncFunction`) for `/copy` — Arbor-resolved entry point |
| `jR1` | Table row formatter — pads cells and joins with ` | ` separator |
| `Sff` | Table column-width scanner helper (called by `jR1`) |
| `y_K` | Daemon status reader / session metadata helper |
| `Zr` | Status check wrapper calling `hKH` |
| `hKH` | String trim/normalize helper (uses `HHH` and `_.trim`) |
| `$1` | AsyncLocalStorage store accessor (`yRL.getStore`) |
| `Fh6` | Joins path components for `daemon.status.json` |
| `SH` | JSON serializer wrapper (`JSON.stringify`) |
| `u8` | "stopped" / "background session" state constant provider |
| `_8` | Display-width measurement (`Bun.stringWidth`) |
| `nC6` | Plugin/path normalizer — validates and resolves relative paths |
| `iC6` | Plugin path builder using `ck.join` |
| `JR1` | Message-to-plaintext renderer — tokenizes and reassembles content |
| `X$` | Lexer module wrapping `ZIH.parse` |
| `XR1` | Plaintext output post-processor (`H.replace`) |
| `PR1` | Assistant message collector — filters conversation by role |
| `hK` | Content-block filter (keeps blocks of type `"text"`) |
| `hff` | Argument tokenizer / markup stripper using `X$.lexer` |
| `oJH` | Markup-removal replace helper (`H.replace`) |
| `y6` | Config/settings loader orchestrator |
| `F6` | Config base-path resolver |
| `Dj_` | Settings directory path helper |
| `nDH` | Config file reader with backup/migration logic |
| `m6` | JSON parse wrapper |
| `Ox` | String prefix stripper (`H.startsWith` / `H.slice`) |
| `rcq` | Backup directory scanner / config file locator |
| `Xj_` | Backup path joiner (`RY.join`) |
| `d` | Logger / debug output function |
| `w` | Background session / worker lifecycle manager |
| `S` | Worker write/signal helper |
| `RH` | Worker event handler (logs via `h1H`) |
| `hH` | Worker output handler (logs via `h1H`) |
| `ER8` | Memory check helper (macOS: `i6`/`j6`, threshold 1024 MB) |
| `rj6` | Background task roster reader |
| `yH` | Background task health poller |
| `B` | Background session retirement tracker |
| `j6` | Background worker dispatching and queue logic |
| `DOA` | Daemon IPC connection handler (`Mp8.connect`) |
| `XOA` | Background session execution and lifecycle orchestrator |
| `Y` | Forced shutdown handler (`process.exit`, `z.abort`) |
| `C` | Rate-limit event queue / UUID generator |
| `bXL` | Config file watcher (`Pq8.watchFile` / `Pq8.unwatchFile`) |
| `er` | Config watch event handler |
| `Y9` | Signal / atexit registration (`tYA.register`) |
| `Ge_` | Clipboard write orchestrator — calls `HZ` and `p4` |
| `HZ` | Platform dispatcher — routes to OS-specific clipboard function |
| `P98` | Screen terminal clipboard helper |
| `RD` | Low-level clipboard subprocess spawner |
| `xiq` | macOS `pbcopy` clipboard writer |
| `b8` | macOS clipboard retry loop helper |
| `RJ_` | Linux Wayland `wl-copy` writer |
| `L0L` | tmux `load-buffer` clipboard writer |
| `SJ_` | GNU Screen paste-buffer writer |
| `ZW` | Screen escape-sequence clipboard writer (`H.replaceAll`) |
| `QJ` | kitty terminal clipboard writer (OSC protocol) |
| `biq` | kitty clipboard subprocess helper |
| `p4` | Clipboard error position finder (`H.indexOf`) |
| `WR1` | File-save side path — writes clipboard text to `.txt` file |
| `mj` | Directory creation and permission setter for file output |
| `Au` | Output directory path resolver |
| `oA9` | File system stat/chmod helper (validates target path, sets mode 511/448) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.