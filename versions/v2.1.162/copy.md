---
type: feature-spec
feature: "copy"
cc_version: "2.1.162"
updated: "2026-06-04"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.162 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.162 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.162

---

## Overview

The `/copy` command copies Claude's last assistant response to the system clipboard. When invoked with an optional integer argument `N` (e.g., `/copy 2`), it instead copies the Nth-latest assistant response from the conversation history. The command extracts plain text from the target message, invokes the platform-appropriate clipboard utility, and reports success or failure via a JSX notification.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `Wbq` |
| load_inline | `true` |
| loc_byte | `10951595` |
| loc_byte_end | `10951781` |
| loc_line | `7202` |
| arbor_handler.name | `X$f` |
| arbor_handler.fqn | `claude-2.1.162::X$f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.162 bundle.js:+10951595

---

## Input Branching

Four distinct branches are present: no argument vs. a valid integer argument, plus two error paths (no assistant messages found; invalid/non-integer argument). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument provided?}
    B -- "No" --> C[Use index = 1\n(most recent assistant msg)]
    B -- "Yes" --> D{Is arg a valid integer?}
    D -- "No / NaN" --> E[Return error:\n'No assistant message to copy']
    D -- "Yes" --> F[N = Number(arg)]
    C --> G[Collect assistant messages\nfrom conversation history]
    F --> G
    G --> H{Nth-latest message exists?}
    H -- "No" --> I[Return error:\n'No assistant message to copy']
    H -- "Yes" --> J[Extract plain-text content\nfrom target message]
    J --> K[writeToClipboard:\nplatform dispatch]
    K --> L{Platform?}
    L -- "macOS" --> M[pbcopy]
    L -- "Linux/Wayland" --> N[wl-copy]
    L -- "Linux/X11" --> O["xclip or xsel"]
    L -- "Windows/WSL" --> P["powershell.exe\nSet-Clipboard"]
    L -- "tmux/screen" --> Q["tmux load-buffer\nor OSC-52 escape"]
    M & N & O & P & Q --> R[Emit tengu_copy telemetry]
    R --> S[Return JSX success notice]
    I --> T[Return JSX error notice]
    E --> T
```

Analysis basis: CC v2.1.162 bundle.js:+10950780 (handler entry `X$f`), +10950821 (error literal), +10950890 (Number coercion), +10950904 (Number.isInteger guard)

---

## Behavioral Spec

### 1. Argument Parsing

```
async function copyCommandHandler(commandInput, appContext):
    rawArg = parseTokensFromInput(commandInput)   // jbq: tokenize input
    
    if rawArg is absent or empty:
        targetIndex = 1
    else:
        n = Number(rawArg)
        if not Number.isInteger(n) or n < 1:
            return jsxErrorResult("No assistant message to copy")
        targetIndex = n
```

Analysis basis: CC v2.1.162 bundle.js:+10950780 (`jbq` call), +10950890 (`Number` coercion), +10950904 (`Number.isInteger` check)

### 2. Message Collection

```
function collectAssistantMessages(conversationState):
    // filterContentBlocks: keep only content blocks of type "text"
    allMessages = conversationState.messages           // literal "messages" +10951085
    assistantMessages = allMessages
        .filter(msg => msg.role == "assistant")        // literal "assistant" +10946728
        .map(msg => extractTextContent(msg))           // iK: filter text blocks, literal "text" +10671297
    return assistantMessages   // ordered newest-first
```

Analysis basis: CC v2.1.162 bundle.js:+10946728 (`"assistant"` role filter), +10671274 (`iK` text-block filter), +10951075 (`"message"`), +10951085 (`"messages"`)

### 3. Target Selection and Text Extraction

```
function selectTargetMessage(assistantMessages, targetIndex):
    // targetIndex is 1-based; 1 = most recent
    if assistantMessages.length < targetIndex:
        return null
    return assistantMessages[assistantMessages.length - targetIndex]

function extractPlainText(messageEntry):
    // Uses Jbq to lex/parse markdown blocks; Xbq to strip residual markup
    lexed    = markdownLexer(messageEntry.content)    // W$.lexer  +10946379
    plain    = stripMarkdownSymbols(lexed)            // Xbq: H.replace +10946893
    return plain
```

Analysis basis: CC v2.1.162 bundle.js:+10946379 (`W$.lexer`), +10946425 (`H.indexOf`), +10946546 (`wbq` table formatter), +10946893 (`Xbq` strip)

### 4. Table Rendering Helper (wbq)

The `wbq` function formats structured content blocks (e.g., tool-result tables) into a plain-text representation before clipboard transfer. It:

1. Maps content blocks through a column-width calculator (`D$f` / `_.map`).
2. Replaces pipe characters (`\|`) in cell values to avoid column-separator collisions (literal `"\\|"` at +10945909).
3. Computes per-column widths using `Math.max` (+10945959) and `L8` (which delegates to `Bun.stringWidth` for Unicode-aware width, +208599).
4. Aligns cells according to alignment hints: `"center"` (+10946103), `"right"` (+10946145), `"left"` (+10946185).
5. Joins columns with ` | ` (+10946068) and outputs rows.

The minimum column width constant is `3` (literal at +10945968).

Analysis basis: CC v2.1.162 bundle.js:+10945866, +10945893, +10945909, +10945959, +10945968, +10946068, +10946103, +10946145, +10946185, +10946257

### 5. Clipboard Write Dispatch (writeToClipboard / mHA → wZ)

```
async function writeToClipboard(text):
    encoded = encodeContent(text)        // wZ: detects encoding utf8/base64  +3417332
    platform = detectPlatform()

    if platform == "macOS" or terminalIsiTerm2:
        spawnProcess("pbcopy", [], stdin=encoded)        // +3417597
        timeout = 2000 ms                                // +3417563
    else if platform == "linux":
        try wl-copy (Wayland)                            // +3416928
        fallback xclip with args ["-selection","clipboard"] // +3416997, +3417790
        fallback xsel  with args ["--clipboard","--input"]  // +3417038, +3417877, +3417891
    else if isWSL or platform == "windows":
        spawnProcess("powershell.exe",
            ["-NoProfile","-NonInteractive","-Command", "Set-Clipboard"])
        // literals: +3417963, +3417981, +3417994, +3418012
    else if insideTmux:
        spawnProcess("tmux", ["load-buffer", "-w", ...]) // +3417169, +3417203
        // optional primary selection: "--primary"        // +3417727
    else if terminal == "kitty":
        emitOSC52Escape(encoded)                         // +3416399
    else if terminal == "screen":
        emitScreenEscape(encoded)                        // +3415930

    await processExit within timeout
    return success
```

Analysis basis: CC v2.1.162 bundle.js:+10947144 (`wZ` entry via `mHA`), +3417363, +3417597 (`pbcopy`), +3416858 (`linux`), +3416928 (`wl-copy`), +3416997 (`xclip`), +3417038 (`xsel`), +3417953 (`wsl`), +3417963 (`powershell.exe`), +3417159 (`iTerm2`), +3417231 (`tmux`), +3415930 (`screen`), +3416399 (`kitty`)

### 6. Success / Error Response

```
function buildResult(success, targetIndex):
    if success:
        emitTelemetry("tengu_copy")          // +10951199
        return jsxSuccessNotice(
            "Copied response #" + targetIndex + " to clipboard"
        )
    else:
        return jsxErrorNotice("No assistant message to copy")  // +10950821
```

The JSX rendering path uses `c` (the JSX factory, +10951197) and `C6` (the conversation-context accessor, +10951155) to inject the result into the CLI output stream.

Analysis basis: CC v2.1.162 bundle.js:+10951155, +10951197, +10951199, +10950821

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (emitted on every invocation, success or failure — +10951199) |
| Clipboard | OS clipboard is mutated via an external subprocess (`pbcopy`, `wl-copy`, `xclip`, `xsel`, `powershell.exe`, `tmux load-buffer`, or OSC-52/screen escape sequence) |
| appState changes | None — the command is read-only with respect to conversation state |
| Hook registration | None observed in depth-2 traversal |
| Sound | None observed in depth-2 traversal |
| Subprocess timeout | 2000 ms hard timeout on clipboard write subprocess (+3417563) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.162 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy 1.5` or `/copy latest` will fail the `Number.isInteger` guard and return an error instead of copying anything.
2. **Requesting an index beyond history depth** — `/copy 5` when there are only 3 assistant messages silently returns the error string rather than a partial result.
3. **Missing clipboard utility on Linux** — The command tries `wl-copy`, then `xclip`, then `xsel` in order; if none are installed the subprocess spawn will fail. There is no fallback OSC-52 path for generic X11 terminals.
4. **Running in a headless/SSH environment without X11 or Wayland** — Clipboard write will fail because no display server is available. Users should ensure `DISPLAY` or `WAYLAND_DISPLAY` is set, or use a terminal that supports OSC-52 (Kitty) or tmux's buffer mechanism.
5. **Confusing index direction** — `/copy 1` means the *most recent* response, not the first one in the conversation. Higher numbers go further back in history.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `X$f` | Main async handler for `/copy` command (Arbor-resolved, `AsyncFunction`) |
| `wbq` | Table-to-plaintext formatter (column width, alignment, pipe escaping) |
| `D$f` | Column-width mapper helper called by `wbq` |
| `jbq` | Input tokenizer / argument parser for the copy command |
| `Jbq` | Markdown lexer driver; feeds `W$.lexer` to extract content blocks |
| `Xbq` | Markdown symbol stripper; applies `H.replace` to clean output |
| `z$f` | Secondary lexer helper used during content extraction |
| `mHA` | Clipboard write orchestrator; dispatches to `wZ` |
| `wZ` | Cross-platform clipboard writer; selects OS tool and invokes it |
| `ar1` | Platform dispatch helper inside `wZ`; spawns clipboard subprocess |
| `C8` | Child-process spawner used by `ar1` |
| `RX_` | Linux clipboard tool selector (`wl-copy`/`xclip`/`xsel`) |
| `SX_` | Screen/tmux escape path helper |
| `yW` | OSC-52 / `replaceAll`-based escape sequence builder |
| `HX` | Kitty escape join helper |
| `or1` | Screen escape builder |
| `fEL` | Encoding helper (`utf8`/`base64`) feeding `C8` |
| `s98` | `bD` wrapper; entry point for terminal-type detection |
| `bD` | Terminal environment detector |
| `Pbq` | Temporary-file writer for clipboard content staging (uses `gI8.writeFile`) |
| `dJ` | Temp-directory resolver used by `Pbq` |
| `D99` | Directory validation / chmod helper used by `dJ` |
| `iK` | Text-block filter; keeps only `"text"` content blocks from a message |
| `PXH` | Markdown token string replacer used during text extraction |
| `Q4` | Index-of helper for content scanning |
| `L8` | Unicode-aware string width calculator (wraps `Bun.stringWidth`) |
| `C6` | Conversation-context / config accessor |
| `p1K` | Daemon status reader (reads `daemon.status.json`) |
| `GS6` | Status-file path joiner |
| `V9` | Store accessor (`d0L.getStore`) |
| `Ur` | Higher-level message accessor used during history traversal |
| `gKH` | Message text trimmer (applies `_.trim`, 1000 ms timeout literal at +2245657) |
| `x8` | Stopped/background-session state label provider |
| `W$` | Markdown lexer module (exposes `W$.lexer`) |

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.