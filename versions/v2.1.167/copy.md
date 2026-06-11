---
type: feature-spec
feature: "copy"
cc_version: "2.1.167"
updated: "2026-06-11"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.167 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.167 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.167

---

## Overview

`/copy` copies Claude's last assistant response to the system clipboard. An optional numeric argument `N` selects the Nth-latest assistant response (1-based, where 1 is the most recent). The command works across macOS, Linux (Wayland and X11), WSL, and Windows environments by dispatching to the appropriate platform clipboard utility.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `Zpq` |
| load_inline | `true` |
| loc_byte | `11031858` |
| loc_byte_end | `11032044` |
| loc_line | `7352` |
| arbor_handler.name | `Qwf` |
| arbor_handler.fqn | `claude-2.1.167::Qwf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.167 bundle.js:+11031858

---

## Input Branching

Five distinct branches exist: no argument, valid integer argument, non-integer argument, index out of range, and clipboard write success/failure. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument provided?}
    B -- No --> C[Use index 1 — most recent assistant message]
    B -- Yes --> D{Is arg a valid integer?}
    D -- No --> E[Return error: invalid argument]
    D -- Yes --> F[Parse N = Number(arg)]
    C --> G[Collect assistant messages from conversation]
    F --> G
    G --> H{Nth-latest assistant message exists?}
    H -- No --> I["Return error: 'No assistant message to copy'"]
    H -- Yes --> J[Extract text content from message]
    J --> K[Format content via table/plaintext renderer]
    K --> L[Detect platform clipboard tool]
    L --> M{Platform?}
    M -- macOS --> N[pbcopy]
    M -- Linux/Wayland --> O[wl-copy]
    M -- Linux/X11 xclip --> P[xclip -selection clipboard]
    M -- Linux/X11 xsel --> Q[xsel --clipboard --input]
    M -- tmux --> R[tmux load-buffer]
    M -- kitty/screen --> S[Terminal escape sequence or OSC52]
    M -- WSL/Windows --> T[powershell.exe Set-Clipboard]
    N & O & P & Q & R & S & T --> U[Write text to clipboard process stdin]
    U --> V{Write succeeded?}
    V -- Yes --> W[Emit tengu_copy telemetry; return success]
    V -- No --> X[Return error message]
```

Analysis basis: CC v2.1.167 bundle.js:+11031043 (handler entry `Qwf`), +11031153 (`Number` coercion), +11031167 (`Number.isInteger` guard), +11031084 (error literal), +3438348 (`pbcopy`), +3437679 (`wl-copy`), +3437748 (`xclip`), +3437789 (`xsel`), +3437982 (`tmux`), +3437150 (`kitty`), +3438714 (`powershell.exe`)

---

## Behavioral Spec

### 1. Argument Parsing

```
function parseIndexArgument(rawArgs):
    tokens = collectAssistantMessages(rawArgs)   // Gpq: filters message list
    if rawArgs is empty or whitespace:
        return 1
    n = Number(rawArgs.trim())
    if not Number.isInteger(n) or n < 1:
        return ERROR("invalid argument")
    return n
```

Analysis basis: CC v2.1.167 bundle.js:+11031153, +11031167

The handler (`Qwf`) first invokes the assistant-message collector (`Gpq`) to obtain the list of assistant messages from the current conversation, then parses the user-supplied numeric argument.

Analysis basis: CC v2.1.167 bundle.js:+11031043, +11031082

### 2. Assistant Message Collection

```
function collectAssistantMessages(conversationMessages):
    // Gpq calls sK which filters by role == "assistant" and content type == "text"
    filtered = conversationMessages
                   .filter(msg => msg.role == "assistant")
                   .filter(msg => hasTextContent(msg))
    return filtered
```

The filter helper (`sK`) retains only `"assistant"`-role messages that carry text-typed content blocks.

Analysis basis: CC v2.1.167 bundle.js:+11027061 (`Gpq` `Array.isArray` guard), +11027093 (`sK` filter), +10752275 (`"text"` literal), +11026991 (`"assistant"` literal)

### 3. Index Selection and Error Guard

```
function selectMessage(messages, n):
    // Messages are ordered newest-first; index 1 == most recent
    targetIndex = messages.length - n
    if targetIndex < 0 or messages is empty:
        return ERROR("No assistant message to copy")
    return messages[targetIndex]
```

Error literal: `"No assistant message to copy"` (bundle.js:+11031084).

Analysis basis: CC v2.1.167 bundle.js:+11031082, +11031084

### 4. Content Extraction and Formatting

```
function extractText(message):
    // mwf: tokenizes message content via lexer (v$.lexer)
    // jPH: strips/replaces markdown artifacts
    // Wpq: post-processes into final string, handles table rendering
    rawText = lexAndJoin(message.content)   // mwf + v$.lexer
    formatted = applyTableOrPlaintext(rawText, format="plaintext")
    return formatted
```

Two format paths are present in the literals: `"table"` (bundle.js:+11026755) and `"plaintext"` (bundle.js:+11027196). The `/copy` path uses the plaintext renderer. The table-rendering helper (`Ppq`) handles column alignment using `"center"`, `"right"`, `"left"` strings and the `" | "` separator.

Analysis basis: CC v2.1.167 bundle.js:+11025869 (`mwf` lexer call), +11025878 (`jPH` replace), +11026809 (`Wpq` call), +11026642 (`Wpq` lexer), +11026755 (`"table"`), +11027196 (`"plaintext"`)

### 5. Platform Clipboard Dispatch

```
async function writeToClipboard(text, platform):
    tool = selectClipboardTool(platform)
    // selectClipboardTool uses PW_ (Linux selector) and Gt1 (top-level dispatcher)
    // timeout: 2000 ms (bundle.js:+3438314)
    proc = spawn(tool.cmd, tool.args, { timeout: 2000 })
    proc.stdin.write(text, encoding="utf8")   // encoding: "utf8" (bundle.js:+3438083)
    proc.stdin.end()
    await proc.exitPromise
```

**Platform tool selection** (`PW_` / `Gt1`):

| Platform condition | Command | Key args |
|---|---|---|
| macOS | `pbcopy` | — |
| Linux + Wayland | `wl-copy` | — |
| Linux + X11 (xclip) | `xclip` | `-selection clipboard` |
| Linux + X11 (xsel) | `xsel` | `--clipboard --input` |
| tmux (non-iTerm2) | `tmux` | `load-buffer -w` |
| kitty | OSC-52 / escape sequence | — |
| screen | double-escape sequence `\x1b\x1b` | — |
| WSL | `wsl` → `powershell.exe` | `-NoProfile -NonInteractive -Command` |
| Windows (native) | `powershell` | `-NoProfile -NonInteractive -Command` |

Analysis basis: CC v2.1.167 bundle.js:+3438348 (`pbcopy`), +3437679 (`wl-copy`), +3437748 (`xclip`), +3437789 (`xsel`), +3437982 (`tmux`), +3437920 (`load-buffer`), +3437954 (`-w`), +3437150 (`kitty`), +3436681 (`screen`), +3437278 (escape literal), +3438704 (`wsl`), +3438714 (`powershell.exe`), +3438732 (`-NoProfile`), +3438745 (`-NonInteractive`), +3438763 (`-Command`), +3438807 (`powershell`), +3438314 (timeout 2000 ms), +3438083 (`utf8`)

Clipboard write spawn timeout: **2000 ms** (bundle.js:+3438314).

### 6. Post-Write Telemetry and Return

```
async function copyCommandHandler(args, context):
    messages = collectAssistantMessages(context.messages)
    n = parseIndexArgument(args)
    if n is ERROR: return n
    msg = selectMessage(messages, n)
    if msg is ERROR: return msg
    text = extractText(msg)
    result = await writeToClipboard(text)
    emit("tengu_copy")          // bundle.js:+11031462
    return successResult(text)
```

Analysis basis: CC v2.1.167 bundle.js:+11031397 (`Wpq` call), +11031409 (`mwf` call), +11031418 (`C6` config/file call), +11031460 (`l` helper), +11031551 (`U_A` clipboard writer), +11031462 (`tengu_copy` telemetry)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (emitted on every invocation; loc: bundle.js:+11031462) |
| Clipboard write | Spawns a platform-specific subprocess (`pbcopy`, `wl-copy`, `xclip`, `xsel`, `tmux load-buffer`, `powershell.exe`, etc.) with a 2000 ms timeout |
| File I/O | `Epq` may write a temporary file under the configured temp directory (`/tmp` default, overridable via `CLAUDE_CODE_TMPDIR`); cleaned up after write (bundle.js:+4022983, +11027299, +11027342) |
| appState changes | None observed in depth-2 traversal |
| Hook registration | None observed in depth-2 traversal |
| Sound | None observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.167 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy abc` or `/copy 1.5` will fail the `Number.isInteger` guard and return an error rather than copying anything.
2. **Requesting an index higher than the conversation length** — `/copy 10` when fewer than 10 assistant turns have occurred will produce the "No assistant message to copy" error.
3. **Running in an unsupported clipboard environment** — headless CI or containers without `xclip`/`xsel`/`wl-copy` installed will time out after 2000 ms. Set up the appropriate clipboard tool or use the `DISPLAY` / `WAYLAND_DISPLAY` environment variables.
4. **Expecting rich Markdown in the clipboard** — the command uses the plaintext renderer; markdown tables are rendered as ASCII and inline markup is stripped.
5. **Confusing index direction** — index 1 is the *most recent* assistant message, not the first in the conversation.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Qwf` | Main async handler for `/copy` (arbor_handler) |
| `Gpq` | Assistant-message list collector; filters by role and content type |
| `sK` | Text-content filter applied inside `Gpq` |
| `Wpq` | Post-processor / table+plaintext formatter for extracted message text |
| `mwf` | Lexer-based message tokenizer; prepares raw content blocks |
| `jPH` | Inline markdown replacement helper used by `mwf` |
| `Ppq` | Table-rendering helper; handles column alignment and separator `" | "` |
| `pwf` | Column-mapping sub-helper used by `Ppq` |
| `Tpq` | Plaintext renderer; strips markup via `H.replace` |
| `U_A` | Clipboard writer dispatcher; calls platform selector then spawns subprocess |
| `$G` | Top-level clipboard utility selector |
| `Gt1` | Clipboard executor; spawns the chosen tool and pipes text |
| `PW_` | Linux clipboard tool selector (`wl-copy` / `xclip` / `xsel`) |
| `wIL` | Windows/WSL clipboard path (`powershell.exe`) |
| `XW_` | Terminal/multiplexer clipboard path (tmux, kitty, screen) |
| `QW` | Screen/escape-sequence clipboard writer |
| `oJ` | kitty clipboard join helper |
| `Wt1` | Terminal type resolver used by `oJ` |
| `K48` | Clipboard spawn wrapper with timeout |
| `nY` | Low-level async process spawner for clipboard tools |
| `R8` | Clipboard write encoding helper (`utf8` / `base64`) |
| `Epq` | Temp-file writer used for clipboard data staging |
| `lj` | Temp directory setup and permission helper |
| `u49` | Temp file `lstat`/`chmodSync` checker |
| `t4` | String index utility (`H.indexOf`) |
| `C6` | Configuration/context accessor called during copy flow |
| `LwH` | Config file reader (`readFileSync`, `statSync`, etc.) |
| `Vo1` | Config backup/directory scanner |
| `sP_` | Config path joiner |
| `IVL` | Config file watcher |
| `V8` | Config schema validator |
| `Hu` | Config key prefix stripper (`startsWith` / `slice`) |
| `U6` | JSON parser wrapper (`JSON.parse`) |
| `zLK` | Daemon status checker; reads `daemon.status.json` |
| `zC6` | Daemon status path builder (`OLK.join`) |
| `Yo` | Conversation message accessor |
| `b4H` | Text trimmer with 1000 ms delay constant |
| `V9` | Async store accessor (`aNL.getStore`) |
| `RH` | JSON serializer (`JSON.stringify`) |
| `H8` | String width measurer (`Bun.stringWidth`) |
| `b8` | Stopped/background-session state literal holder |

---

*Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.*