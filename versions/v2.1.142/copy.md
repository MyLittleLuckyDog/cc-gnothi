---
type: feature-spec
feature: "copy"
cc_version: "2.1.142"
updated: "2026-06-01"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.142 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.142 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.142

---

## Overview

`/copy` copies Claude's most recent assistant response to the system clipboard. An optional integer argument `N` selects the Nth-latest assistant response instead of the most recent one. The command extracts the plain-text content of the target message, dispatches it to the OS-specific clipboard mechanism, fires a `tengu_copy` telemetry event, and renders a JSX confirmation component.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| loc_byte | `10078637` |
| loc_byte_end | `10078823` |
| loc_line | `5644` |
| module_id | `wqq` |
| load_inline | `true` |
| arbor_handler.name | `T37` |
| arbor_handler.fqn | `claude-2.1.142::T37` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.142 bundle.js:+10078637

---

## Input Branching

The command has 4+ distinct paths (no argument, valid integer N, invalid non-integer argument, and no assistant messages present), requiring a Mermaid flowchart.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument provided?}
    B -- No --> C[Use index = 1 (most recent)]
    B -- Yes --> D{Is arg a valid integer?}
    D -- No --> E[Render error / ignore non-integer input]
    D -- Yes --> F[Parse N via Number()]
    F --> G{N is a safe integer?}
    G -- No --> E
    G -- Yes --> H[Use index = N]
    C --> I[collectAssistantMessages from conversation history]
    H --> I
    I --> J{Any assistant messages?}
    J -- No --> K[Render 'No assistant message to copy'\nbundle.js:+10077863]
    J -- Yes --> L[Select Nth-latest message\nbundle.js:+10078176]
    L --> M[extractPlainText via messageTextExtractor]
    M --> N[writeToClipboard via platformClipboardWriter]
    N --> O[Fire tengu_copy telemetry\nbundle.js:+10078241]
    O --> P[Render JSX success confirmation]
```

---

## Behavioral Spec

### Main Handler — `copyCommandHandler` (bundle identifier: `T37`)

```
async function copyCommandHandler(commandArgs, conversationContext):
    // 1. Parse optional numeric index
    rawArg = extractArgString(commandArgs)          // T37 → zqq path
    if rawArg is not empty:
        n = Number(rawArg)
        if not Number.isInteger(n):
            return renderError("invalid argument")
    else:
        n = 1   // default: most recent

    // 2. Collect assistant messages from history
    assistantMessages = collectAssistantMessages(conversationContext)
    //   filters role == "assistant", content type == "text"
    //   Analysis basis: bundle.js:+10073770, +9930201

    if assistantMessages.length == 0:
        return renderStaticMessage("No assistant message to copy")
        // literal at bundle.js:+10077863

    // 3. Select target message (1-based, newest-first)
    targetMessage = assistantMessages[assistantMessages.length - n]
    // Analysis basis: bundle.js:+10078176

    // 4. Render message content as plain text
    plainText = renderMessageAsPlaintext(targetMessage)
    // passes through messageTextExtractor (Oqq) → tableFormatter ($qq) path
    // Analysis basis: bundle.js:+10073975, +10073534

    // 5. Write to clipboard
    await platformClipboardWriter(plainText)
    // ZC_ → FE dispatches OS-specific copy tool
    // Analysis basis: bundle.js:+10078330

    // 6. Emit telemetry
    emit("tengu_copy")
    // Analysis basis: bundle.js:+10078241

    // 7. Return JSX success component
    return renderCopyConfirmation()
```

Analysis basis: CC v2.1.142 bundle.js:+10077822

---

### Argument Parser — `argumentCollector` (bundle identifier: `zqq`)

```
function argumentCollector(inputTokens):
    if Array.isArray(inputTokens):
        // iterate tokens, push text fragments
        for token in inputTokens:
            if token matches plaintext kind:
                push token value
    return joined argument string
    // Analysis basis: bundle.js:+10073840, +10073888
```

Analysis basis: CC v2.1.142 bundle.js:+10077822

---

### Message Text Extractor — `messageTextExtractor` (bundle identifier: `Oqq`)

```
function messageTextExtractor(messageObject):
    // use lexer (rf) to tokenize message content
    tokens = rf.lexer(messageObject)
    // find first plain-text or table segment
    idx = tokens.indexOf(...)
    // delegate to tableAwareFormatter ($qq) for structured content
    result = tableAwareFormatter(tokens.slice(idx))
    return result
    // Analysis basis: bundle.js:+10073421, +10073467, +10073588
```

Analysis basis: CC v2.1.142 bundle.js:+10073421

---

### Table-Aware Formatter — `tableAwareFormatter` (bundle identifier: `$qq`)

```
function tableAwareFormatter(tokens):
    // replace escaped pipe characters: "\|" → "|"
    // Analysis basis: bundle.js:+10072951
    columns = tokens.map(measureColumnWidth)
    maxWidth = Math.max(...columnWidths)
    // pad columns to at least 3 characters wide
    // Analysis basis: bundle.js:+10073010
    rows = tokens.map(renderRow)
    // separates cells with " | " (literal at bundle.js:+10073110)
    // supports column alignments: "center", "right", "left"
    // Analysis basis: bundle.js:+10073145, +10073187, +10073227
    return rows joined with newlines
```

Analysis basis: CC v2.1.142 bundle.js:+10072908

---

### Platform Clipboard Writer — `platformClipboardWriter` (bundle identifier: `ZC_` → `FE`)

```
async function platformClipboardWriter(text):
    platform = detectPlatform()   // checks process.platform

    if terminal == "kitty":
        // use kitty terminal OSC 52 escape sequence
        // literal: "kitty" at bundle.js:+3314367
        kittyClipboardTransport(text)

    else if platform == "darwin":
        // spawn: "pbcopy"
        // literal at bundle.js:+3315245, +3315271
        spawnAndPipe("pbcopy", [], text)

    else if platform == "linux":
        // try in order: "wl-copy", "xclip -selection clipboard", "xsel --clipboard --input"
        // literals at bundle.js:+3315336, +3315382, +3315416, +3315448, +3315467, +3315481
        for tool in [wlCopyCmd, xclipCmd, xselCmd]:
            try:
                spawnAndPipe(tool, args, text)
                return

    else if platform == "win32":
        // spawn: powershell -NoProfile -NonInteractive -Command ...
        // literals at bundle.js:+3315760, +3315774, +3315787, +3315805
        spawnAndPipe("powershell", ["-NoProfile", "-NonInteractive", "-Command", ...], text)

    // tmux / iTerm2 special handling also present
    // "iTerm2" literal at bundle.js:+3314860
    // "tmux load-buffer -w" at bundle.js:+3314870, +3314904, +3314932
```

Analysis basis: CC v2.1.142 bundle.js:+10078330, +3315062, +3315116, +3315132, +3315146

---

### Column Width Measurer — `columnWidthMeasurer` (bundle identifier: `j37`)

```
function columnWidthMeasurer(cellText):
    // delegates to Bun.stringWidth for Unicode-aware display width
    // Analysis basis: bundle.js:+10072873, +203446
    return Bun.stringWidth(cellText)
```

Analysis basis: CC v2.1.142 bundle.js:+10072908

---

### Plaintext Renderer — `plaintextRenderer` (bundle identifier: `Yqq`)

```
function plaintextRenderer(content):
    // strips markdown / formatting via H.replace
    // Analysis basis: bundle.js:+10073935
    return cleaned string
```

Analysis basis: CC v2.1.142 bundle.js:+10073935

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` fired after successful clipboard write (bundle.js:+10078241) |
| Clipboard | OS-level clipboard mutated via `pbcopy` / `wl-copy` / `xclip` / `xsel` / PowerShell / kitty OSC 52 / tmux load-buffer |
| appState changes | None observed in depth-2 traversal |
| Hook registration | None observed in depth-2 traversal |
| Sound | None observed in depth-2 traversal |
| Error output | Static message `"No assistant message to copy"` rendered when no assistant turn exists (bundle.js:+10077863) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.142 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy foo` will fail the `Number.isInteger` check (bundle.js:+10077946); the argument must be a whole number or omitted entirely.
2. **Index out of range** — `/copy 99` when fewer than 99 assistant messages exist will silently select an undefined entry or wrap unexpectedly; always verify how many turns are in the session.
3. **Assuming rich formatting is preserved** — the command targets the `"plaintext"` rendering path (bundle.js:+10073975), so Markdown tables are converted to pipe-separated plain text and other markup is stripped.
4. **Expecting clipboard to work over SSH without setup** — on remote sessions the Linux clipboard tools (`wl-copy`, `xclip`, `xsel`) may not have a display available; users must configure a forwarding mechanism separately.
5. **Confusing 1-based vs 0-based indexing** — `/copy 1` returns the most recent response, not the second; the index counts back from the end of the assistant message list.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `T37` | Main async handler for `/copy` command (`copyCommandHandler`) |
| `zqq` | Argument collector — parses raw input tokens into argument string |
| `Oqq` | Message text extractor — tokenizes and routes message content |
| `$qq` | Table-aware formatter — renders table/plain tokens as aligned text |
| `Yqq` | Plaintext renderer — strips formatting from message content |
| `j37` | Column width measurer — wraps `Bun.stringWidth` for Unicode display width |
| `J37` | Lexer-based content builder — constructs content token array |
| `ZC_` | Platform clipboard writer dispatcher — selects OS copy mechanism |
| `FE` | Clipboard implementation router — dispatches to `Bw`, `dRL`, `gRL`, `FRL` |
| `Bw` | Kitty terminal clipboard transport |
| `dRL` | Darwin (`pbcopy`) clipboard writer |
| `gRL` | Linux clipboard writer (`wl-copy` / `xclip` / `xsel`) |
| `FRL` | Windows PowerShell clipboard writer |
| `uYH` | Content replacement helper used in token building |
| `$K` | Text-type content filter |
| `f8` | Unicode string width helper (delegates to `Bun.stringWidth`) |
| `S8` | String-to-identifier normalizer |
| `Va` | Clipboard result formatter / text trimmer |
| `ufH` | Text trimming utility (delegates to `_.trim`, limit 1000; bundle.js:+2162362) |
| `zEq` | Clipboard write coordinator — joins path components, timestamps write |
| `h06` | Path joiner using `OEq.join` (uses `"daemon.status.json"` literal) |
| `RH` | JSON serializer wrapper (`JSON.stringify`) |
| `IP` | Temporary directory initializer for clipboard pipe |
| `vcL` | Directory permission validator |
| `Dqq` | Clipboard temp-file writer (mkdir + writeFile) |
| `H7` | String index-of utility |
| `il` | Inline path/file helper used by temp-dir initializer |