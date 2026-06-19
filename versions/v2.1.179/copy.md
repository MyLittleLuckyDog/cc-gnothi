---
type: feature-spec
feature: "copy"
cc_version: "2.1.179"
updated: "2026-06-19"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.179 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.179 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.179

---

## Overview

The `/copy` command copies Claude's most recent assistant response to the system clipboard. An optional numeric argument `N` allows the user to retrieve the Nth-latest assistant message instead of the most recent one. The command resolves the appropriate message from the conversation history, converts it to plain text, and dispatches it to the platform-appropriate clipboard backend.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `fAK` |
| load_inline | `true` |
| loc_byte | `11391595` |
| loc_byte_end | `11391781` |
| loc_line | `7288` |
| arbor_handler.name | `HBL` |
| arbor_handler.fqn | `claude-2.1.179::HBL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.179 bundle.js:+11391595

---

## Input Branching

The command has four distinct branches based on argument parsing and message lookup outcome, requiring a Mermaid flowchart.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument provided?}
    B -- No --> C[Use index 1 — most recent assistant message]
    B -- Yes --> D{Is arg a valid integer?}
    D -- No --> E[Show error: invalid argument]
    D -- Yes --> F[Parse N = Number(arg)]
    C --> G[Collect assistant messages from history via AAK]
    F --> G
    G --> H{Nth-latest message exists?}
    H -- No --> I["Display: 'No assistant message to copy'"]
    H -- Yes --> J[Extract plain text content via _AK]
    J --> K[Write text to clipboard via fzA/uW]
    K --> L[Emit tengu_copy telemetry]
    L --> M[Return success UI]
```

Analysis basis: CC v2.1.179 bundle.js:+11390780 – +11391288

---

## Behavioral Spec

### 1. Argument Parsing

The handler `HBL` (AsyncFunction, resolved via `module_id` path) begins by inspecting the raw command argument string.

```
async function copyCommandHandler(args, context):
    rawArg = args.trim()
    if rawArg is empty:
        index = 1                          # default: most recent
    else:
        parsed = Number(rawArg)
        if not Number.isInteger(parsed) or parsed < 1:
            return showError("invalid argument")
        index = parsed
```

Analysis basis: CC v2.1.179 bundle.js:+11390890 (Number call), +11390904 (Number.isInteger check)

---

### 2. Message Collection

The helper `AAK` scans the conversation messages array, filtering for entries whose role is `"assistant"` and whose content blocks include items of type `"text"`. The helper `m4` performs the per-message content filtering.

```
function collectAssistantMessages(messages):
    result = []
    for each message in messages:
        if message.role == "assistant":
            textBlocks = m4(message.content)  # filters for type=="text"
            if textBlocks is non-empty:
                result.push(message)
    return result  # ordered oldest-first
```

Analysis basis: CC v2.1.179 bundle.js:+11386798 (`AAK` / Array.isArray), +11133558 (literal `"text"`), +11386728 (literal `"assistant"`)

---

### 3. Nth-Latest Selection

After collection, messages are indexed from the end (most recent = index 1).

```
function selectNthLatest(assistantMessages, n):
    target = assistantMessages[assistantMessages.length - n]
    if target is undefined:
        return null
    return target
```

If `target` is `null`, the command renders the literal string `"No assistant message to copy"` and exits without touching the clipboard.

Analysis basis: CC v2.1.179 bundle.js:+11390819 (H / messages array access), +11390821 (literal `"No assistant message to copy"`)

---

### 4. Plain-Text Extraction

The helper `_AK` converts the selected assistant message's content blocks to a single plain-text string. It uses the lexer helper `e3.lexer` to parse any embedded markdown or structured content and then collects only the text portions. The `HAK` sub-routine handles table rendering, column alignment (left / center / right), and pipe-character escaping (`\|`) before producing the final text.

```
function extractPlainText(message):
    tokens = e3.lexer(message.content)    # markdown lexer
    indexOf = tokens.indexOf(separator)
    textParts = _AK(tokens)               # strips non-text blocks
    plaintext = A.slice(textParts)        # assemble final string
    return plaintext
```

Column alignment constants observed: `"left"`, `"center"`, `"right"` (bundle.js:+11386189, +11386115, +11386153). Pipe separator literal `" | "` at +11386080, escaped pipe `\|` at +11385921.

Analysis basis: CC v2.1.179 bundle.js:+11391134 (`_AK` call from `HBL`), +11386379 (`e3.lexer` from `_AK`)

---

### 5. Clipboard Write

The helper `fzA` dispatches to `uW`, which selects the platform-appropriate clipboard mechanism. The selection logic is:

```
function writeToClipboard(text, platform):
    method = detectClipboardMethod(platform)

    switch method:
        case "pbcopy":          # macOS
            spawnProcess("pbcopy", stdin=text)

        case "wl-copy":         # Linux / Wayland
            spawnProcess("wl-copy", stdin=text)

        case "xclip":           # Linux / X11 option A
            spawnProcess("xclip", ["-selection", "clipboard", "--input"], stdin=text)

        case "xsel":            # Linux / X11 option B
            spawnProcess("xsel", ["--clipboard", "--input"], stdin=text)

        case "powershell.exe" / "powershell":   # Windows / WSL
            spawnProcess("powershell.exe",
                ["-NoProfile", "-NonInteractive", "-Command", "<Set-Clipboard>"],
                stdin=text)

        case "tmux":            # tmux buffer fallback
            spawnProcess("tmux", ["load-buffer", "-w", "-"], stdin=text)

        case "osc52" / "dcs" / "raw+dcs" / "raw":   # terminal escape-sequence paths
            writeOSC52orDCSSequence(text)

        case "none" / "unset":
            # no clipboard available; may surface error to user
```

Spawn timeout: 2000 ms (bundle.js:+3579813).  
Platform strings observed: `"linux"` (+3578733), `"screen"` (+3577805), `"kitty"` (+3578274), `"wsl"` (+3580203), `"windows"` (+6579377).  
Encoding helpers: `"utf8"` (+3579411), `"base64"` (+3579428).

Analysis basis: CC v2.1.179 bundle.js:+11391288 (`fzA` call from `HBL`), +11387144 (`uW` call from `fzA`), +3579847 (`"pbcopy"` literal), +3578803 (`"wl-copy"`), +3578872 (`"xclip"`), +3578913 (`"xsel"`), +3580213 (`"powershell.exe"`), +3579094 (tmux `"load-buffer"`)

---

### 6. Format Selection (table vs. plaintext)

Before writing, `_AK` checks the format tag on the selected message. Two output modes are present:

| Tag | Behavior |
|---|---|
| `"table"` | Renders aligned columns with pipe separators and computed column widths via `HAK` / `fM` (string padding and `Bun.stringWidth`) |
| `"plaintext"` | Passes text through with minimal post-processing; `qAK` applies a `.replace()` for any residual escape sequences |

Analysis basis: CC v2.1.179 bundle.js:+11386492 (literal `"table"`), +11386933 (literal `"plaintext"`), +11385996 (`f8` / `Bun.stringWidth`), +11386134 (`fM` / string padding)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (emitted on every successful copy, bundle.js:+11391199) |
| Clipboard side effect | Platform clipboard mutated via `pbcopy`, `wl-copy`, `xclip`, `xsel`, `powershell.exe`, tmux buffer, or OSC52/DCS terminal sequence |
| appState changes | None observed in depth-2 traversal |
| Hook registration | None observed in depth-2 traversal |
| Sound | None observed in depth-2 traversal |
| Error display | Literal `"No assistant message to copy"` rendered in UI when history is empty or index out of range |

---

## Version History

| Version | Change |
|---|---|
| v2.1.179 | Initial analysis |

---

## Common Mistakes

1. **Using `/copy 0` or `/copy -1`**: The command validates the argument with `Number.isInteger` and expects a positive integer ≥ 1. Zero and negative values are rejected as invalid.
2. **Running `/copy N` when fewer than N assistant messages exist**: If the Nth-latest message does not exist in the current session history, the command displays `"No assistant message to copy"` and does not modify the clipboard.
3. **Expecting rich formatting in the clipboard**: The command extracts plain text. Tables are rendered as ASCII pipe-separated text; markdown formatting is stripped by the lexer step.
4. **Clipboard unavailable in restricted environments**: On systems where none of `pbcopy`, `wl-copy`, `xclip`, `xsel`, PowerShell, or tmux are accessible and no terminal escape-sequence path is available, the copy will silently do nothing or surface an OS-level error.
5. **Session boundary**: `/copy` only sees messages from the **current** conversation session. Messages from prior sessions are not accessible.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `HBL` | Main async handler for `/copy` command (Arbor-resolved entry point) |
| `HAK` | Table/column renderer — computes column widths, aligns text, inserts pipe separators |
| `_AK` | Plain-text extractor — walks lexer token list and assembles output string |
| `AAK` | Assistant-message collector — filters conversation history for role=`"assistant"` text blocks |
| `qAK` | Post-processing helper — applies `.replace()` to clean residual escape sequences in plaintext mode |
| `rUL` | Lexer-based token collector — feeds `e3.lexer` output into an accumulator array |
| `NTH` | Token normalizer — applies `.replace()` on individual token text |
| `fzA` | Clipboard dispatch coordinator — selects backend and invokes write |
| `uW` | Platform clipboard writer — spawns OS clipboard process or emits terminal sequences |
| `JT6` | Clipboard sub-helper (likely screen/tmux path) |
| `Mw` | Terminal sequence builder (OSC52 / DCS) |
| `e$9` | Clipboard spawn helper — manages child process lifecycle with 2000 ms timeout |
| `DS_` | Linux clipboard selector — picks between `wl-copy`, `xclip`, `xsel` |
| `Nsf` | Tmux buffer helper — invokes `tmux load-buffer` |
| `YS_` | Screen / terminal variant clipboard path |
| `XT6` | Clipboard sub-helper (JT6 + r6 composition) |
| `_G` | OSC52 double-escape (`\x1b\x1b`) sequence helper |
| `FY` | Kitty terminal clipboard path helper |
| `t$9` | Kitty / terminal helper building on `Mw` |
| `pf` | String indexOf utility used in text assembly |
| `KAK` | File write helper used to stage clipboard content via temp directory |
| `xD` | Temp directory setup helper (`/tmp` base, chmod 448/511) |
| `j09` | Temp directory validator — checks `lstatSync`, asserts directory, sets permissions |
| `m4` | Content-block type filter — retains only `type=="text"` blocks |
| `oUL` | Map helper over message collection |
| `HAK` | (same as row 2 above; dual role: table renderer called from `_AK`) |
| `fM` | String padding helper — uses `H.repeat` and `Number.isFinite` |
| `f8` | Column-width measurer — wraps `Bun.stringWidth` |
| `e3` | Markdown lexer module — exposes `e3.lexer` |
| `h6` | Config/file watcher utility reached from `HBL` |
| `brf` | File watch helper — `oO8.watchFile` / `oO8.unwatchFile` lifecycle |
| `r5H` | Config reader — `readFileSync`, `statSync`, directory traversal |
| `fM9` | Directory backup helper for config files |
| `ay_` | Path join + `z_` utility |
| `d` | General async/deferred utility reached from `HBL` |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.