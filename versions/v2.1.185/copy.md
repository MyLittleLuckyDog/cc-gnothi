---
type: feature-spec
feature: "copy"
cc_version: "2.1.185"
updated: "2026-06-21"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.185 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.185 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.185

---

## Overview

`/copy` copies Claude's most recent assistant response to the system clipboard. An optional numeric argument (`/copy N`) selects the Nth-most-recent assistant message instead of the latest. The command dispatches to a platform-aware clipboard writer that supports macOS (`pbcopy`), Linux (`wl-copy`, `xclip`, `xsel`), WSL/Windows (`powershell.exe`/`wsl`), tmux buffers, and OSC 52 terminal escape sequences.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| loc_byte | `11252432` |
| loc_byte_end | `11252618` |
| loc_line | `6950` |
| module_id | `Asl` |
| load_inline | `true` |
| arbor_handler.name | `zGp` |
| arbor_handler.fqn | `claude-2.1.185::zGp` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.185 bundle.js:+11252432

---

## Input Branching

The command has four distinct branches based on argument parsing and message availability:

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Parse argument}
    B -- "arg absent or empty" --> C[index = 1 — most recent]
    B -- "arg present" --> D{Is arg a valid integer?}
    D -- "No" --> E[Validate message list — fall through with index 1]
    D -- "Yes" --> F[index = Number(arg)]
    C --> G{Assistant messages exist?}
    E --> G
    F --> G
    G -- "No messages" --> H["Output: 'No assistant message to copy'"]
    G -- "Messages found" --> I[Extract Nth-latest assistant message text]
    I --> J[Render message content as plaintext]
    J --> K{Detect platform / clipboard mechanism}
    K -- "macOS" --> L["Spawn pbcopy"]
    K -- "Linux / Wayland" --> M["Spawn wl-copy"]
    K -- "Linux / X11 xclip" --> N["Spawn xclip -selection clipboard"]
    K -- "Linux / X11 xsel" --> O["Spawn xsel --clipboard --input"]
    K -- "WSL" --> P["Spawn wsl powershell.exe -Command Set-Clipboard"]
    K -- "Windows native" --> Q["Spawn powershell.exe -NoProfile -NonInteractive -Command Set-Clipboard"]
    K -- "tmux" --> R["Spawn tmux load-buffer -w"]
    K -- "OSC 52 / DCS terminal" --> S["Write OSC-52 escape sequence"]
    K -- "screen" --> T["Use screen copy mechanism"]
    K -- "none / unset" --> U["No-op or error"]
    L & M & N & O & P & Q & R & S & T --> V[Emit tengu_copy telemetry]
    U --> V
    H --> W[Return without copying]
```

---

## Behavioral Spec

### 1. Argument Parsing

The handler `zGp` first invokes the argument-parsing helper (`psl`) to extract a clean argument string from the raw command input.

```
async function copyCommandHandler(context):
    rawArg = parseSlashCommandArg(context)        // psl
    indexArg = rawArg.trim()

    if indexArg is empty:
        targetIndex = 1
    else:
        parsed = Number(indexArg)
        if Number.isInteger(parsed) and parsed >= 1:
            targetIndex = parsed
        else:
            targetIndex = 1   // fallback; invalid non-integer ignored
```

Analysis basis: CC v2.1.185 bundle.js:+11251612 – +11251736

### 2. Message List Retrieval

The handler walks the current conversation message list, filtering for messages with `role === "assistant"` and extracting their text content blocks (`type === "text"`).

```
function collectAssistantMessages(messageList):   // dsl + usl path
    results = []
    for each message in messageList:
        if message.role == "assistant":
            textContent = extractTextBlocks(message)  // Cc → e.filter(type=="text")
            results.push(textContent)
    return results   // ordered oldest-first
```

Analysis basis: CC v2.1.185 bundle.js:+11247559, +11247629, +13879575

### 3. Index Selection and Absent-Message Guard

```
function selectMessage(assistantMessages, targetIndex):
    if assistantMessages is empty:
        return ERROR("No assistant message to copy")   // literal at +11251653

    // targetIndex 1 = most recent, 2 = second-most-recent, etc.
    reverseIndex = assistantMessages.length - targetIndex
    if reverseIndex < 0:
        reverseIndex = 0
    return assistantMessages[reverseIndex]
```

Analysis basis: CC v2.1.185 bundle.js:+11251651, +11251653

### 4. Plaintext Rendering

The selected message content is converted to a plaintext string. Table-style content uses the `"table"` / `"plaintext"` render modes detected from the literal constants. A lexer helper (`RA` → `v2e.parse`) tokenises markdown, and the rendering pipeline (`usl` / `jGp`) formats columns with `Math.max` for width normalisation, `" | "` separators, and left/center/right alignment strings.

```
function renderToPlaintext(messageContent):
    tokens = lexer(messageContent)              // RA.lexer
    rows   = mapTokensToRows(tokens)            // jGp / t.map
    widths = computeColumnWidths(rows, Math.max)
    lines  = []
    for each row in rows:
        cells = row.cells.map(cell =>
            padCell(cell, widths[col], alignment))  // "left","center","right"
        lines.push(cells.join(" | "))
    return lines.join("\n")
        .replace("\\|", "|")                   // fsl / c.replace unescape
```

Analysis basis: CC v2.1.185 bundle.js:+11246674, +11246725, +11246802, +11246911, +11246946, +11246984, +11247020, +11247724

### 5. Clipboard Write Dispatch

The platform-detection and write routine (`zv`, called from `t_o`) selects among the mechanisms listed in the flowchart above. Key platform strings resolved from literals:

| Literal | loc_byte |
|---|---|
| `"pbcopy"` | 3537606 |
| `"wl-copy"` | 3536566 |
| `"xclip"` | 3536634 |
| `"xsel"` | 3536674 |
| `"-selection"` / `"clipboard"` | 3537818, 3537831 |
| `"--clipboard"` / `"--input"` | 3537917, 3537931 |
| `"powershell.exe"` | 3538003 |
| `"-NoProfile"` / `"-NonInteractive"` / `"-Command"` | 3538021, 3538034, 3538052 |
| `"wsl"` | 3537993 |
| `"tmux"` / `"load-buffer"` / `"-w"` | 3536853, 3536861, 3536875 |
| `"screen"` | 3535561 |
| `"osc52"` | 3536449 |
| `"raw+dcs"` / `"dcs"` / `"raw"` | 3537285, 3537308, 3537314 |
| `"none"` / `"unset"` | 3537359, 3536827 |
| `"--primary"` / `"primary"` | 3537769, 3537872 |
| `"linux"` | 3536488 |
| `"kitty"` | 3536030 |

```
async function writeToClipboard(text, platform):  // zv → SHi / xFr / LFr / EL / aE
    mechanism = detectClipboardMechanism(platform)

    switch mechanism:
        case "pbcopy":
            spawnAndWrite("pbcopy", [], text)
        case "wl-copy":
            spawnAndWrite("wl-copy", [], text)
        case "xclip":
            spawnAndWrite("xclip", ["-selection", "clipboard"], text)
        case "xsel":
            spawnAndWrite("xsel", ["--clipboard", "--input"], text)
        case "wsl":
            spawnAndWrite("powershell.exe",
                ["-NoProfile", "-NonInteractive", "-Command", "Set-Clipboard ..."], text)
        case "powershell":
            spawnAndWrite("powershell", [...], text)
        case "tmux-buffer":
            spawnAndWrite("tmux", ["load-buffer", "-w", "<tmpfile>"], text)
        case "osc52" or "raw+dcs" or "dcs" or "raw":
            writeEscapeSequence(encodeBase64(text))   // base64 at +3537187
        case "screen":
            useScreenCopyMechanism(text)
        default:
            // no-op
```

The OSC-52 path encodes the text as base64 and writes it directly to the terminal's stdout stream (literals `"utf8"` at +3537170, `"base64"` at +3537187). A 2000 ms spawn timeout is applied for external clipboard tools (literal `2000` at +3537572).

Analysis basis: CC v2.1.185 bundle.js:+11247976, +3537201, +3537207, +3537285–3538096

### 6. Telemetry Emission

Immediately after the clipboard write attempt resolves, the handler fires the `tengu_copy` telemetry event.

```
    emit("tengu_copy")    // loc_byte +11252031
```

Analysis basis: CC v2.1.185 bundle.js:+11252029 – +11252031

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (emitted on every invocation, success or no-message path) — bundle.js:+11252031 |
| Clipboard | Writes text to the OS clipboard via the detected mechanism; no persistent app-state mutation |
| Temporary files | tmux path may write a temporary file and then pass its path to `tmux load-buffer` |
| appState changes | None — the command is read-only with respect to conversation state |
| Sound | None detected |
| Hook registration | None detected in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.185 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy foo` silently falls back to copying the most recent message rather than producing an error; users expecting an error message may be confused.
2. **Using `/copy 0` or a negative index** — the index is coerced; behaviour for out-of-range values defaults to the first (oldest visible) assistant message rather than erroring.
3. **Clipboard silent failure on headless Linux** — if neither `wl-copy`, `xclip`, nor `xsel` is installed, the mechanism resolves to `"none"` / `"unset"` and no text is written; the command succeeds without output.
4. **OSC-52 truncation in some terminals** — terminals that limit OSC-52 payload size may silently truncate long responses; this is a terminal limitation, not a CC bug.
5. **Assuming the Nth argument is 0-indexed** — `/copy 1` copies the *most* recent message, not the second-most-recent; the index is 1-based.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `zGp` | Main async handler for `/copy` command (arbor_handler) |
| `psl` | Slash-command argument parser (extracts raw arg string) |
| `dsl` | Conversation message list walker / assistant-message collector |
| `usl` | Plaintext table renderer (column width, alignment, separator) |
| `jGp` | Token-to-row mapper used inside table renderer |
| `fsl` | Post-render pipe-character unescaper (`\|` → `|`) |
| `GGp` | Lexer invocation wrapper (feeds `RA.lexer`) |
| `RA` | Markdown lexer module (wraps `v2e.parse`) |
| `r0e` | Token text replacement helper inside lexer path |
| `Cc` | Content-block filter (keeps `type === "text"` blocks) |
| `t_o` | Clipboard write orchestrator (detects platform, calls `zv`) |
| `zv` | Platform-aware clipboard writer (dispatches to `SHi`, `xFr`, `LFr`, `EL`, `aE`) |
| `SHi` | macOS `pbcopy` clipboard write path |
| `xFr` | Linux OSC-52 / DCS escape-sequence write path |
| `LFr` | Linux native tool write path (`wl-copy`, `xclip`, `xsel`) |
| `EL` | WSL / Windows PowerShell clipboard write path |
| `aE` | tmux buffer write path |
| `EHi` | Screen terminal copy path |
| `d0t` | Clipboard utility helper (base-level write primitive) |
| `b_` | Low-level byte / buffer helper used by clipboard paths |
| `p0t` | Additional clipboard sub-path helper |
| `ged` | Clipboard mechanism generic helper |
| `Un` | Spawn helper used by clipboard tool launcher |
| `msl` | Temporary-file manager for tmux buffer copy |
| `XE` | Temp directory setup (`/tmp` or `CLAUDE_CODE_TMPDIR`) |
| `OAi` | Temp directory permission / lstat checker |
| `lF` | Temp directory path join helper |
| `$u` | String index-of utility |
| `pmr` | Atomic file write helper (used in tmux path) |
| `Mn` | Error wrapper for filesystem errors |
| `vKe` | fsync / flush helper |
| `tn` | String-width measurement (wraps `Bun.stringWidth`) |
| `um` | Character-repeat / pad helper |
| `jt` | Config path resolver |
| `Ct` | Config reader / watcher |
| `q_e` | Config file read helper |
| `Pe` | JSON serialiser wrapper |
| `Ee` | String coercion utility |
| `ci` | AsyncLocalStorage store accessor |
| `k0l` | Daemon status helper |
| `Mjt` | Daemon status JSON path builder |
| `CQ` | Daemon communication helper |
| `vfe` | Text trim/truncation helper (1000 ms / 0 constants) |
| `j` | Generic utility / conditional helper |
| `T` | Theme / config value accessor |
| `Kc` | Redaction / path-stripping helper (`[REDACTED]`) |
| `n_c` | Log-file writer |
| `De` | Error logger |
| `Ue` | Startup / exit helper |

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.