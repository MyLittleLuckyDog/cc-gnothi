---
type: feature-spec
feature: "copy"
cc_version: "2.1.176"
updated: "2026-06-13"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.176 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.176 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.176

---

## Overview

`/copy` copies Claude's most recent assistant response to the system clipboard. An optional numeric argument `N` selects the Nth-latest assistant message (e.g. `/copy 2` copies the second-most-recent reply). The command locates the target message in the conversation history, extracts its text content, and dispatches it to the platform-appropriate clipboard backend.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `jeq` |
| load_inline | `true` |
| loc_byte | `11332711` |
| loc_byte_end | `11332897` |
| loc_line | `7430` |
| arbor_handler.name | `dCL` |
| arbor_handler.fqn | `claude-2.1.176::dCL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.176 bundle.js:+11332711

---

## Input Branching

The command has four distinct behavioral paths based on argument parsing and message availability, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Parse argument}
    B -->|no argument| C[index = 1\n(most recent)]
    B -->|arg is integer string| D[index = Number(arg)\nNth-latest]
    B -->|arg is non-integer| E[treat as index 1\nor surface error]
    C --> F{Find Nth assistant\nmessage in history}
    D --> F
    E --> F
    F -->|no assistant message found| G[Return error:\n'No assistant message to copy'\nbundle.js:+11331937]
    F -->|message found| H[Extract text content\nfrom message blocks]
    H --> I{Detect terminal/\nclipboard backend}
    I -->|macOS| J[pbcopy\nbundle.js:+3517877]
    I -->|Linux + Wayland| K[wl-copy\nbundle.js:+3516833]
    I -->|Linux + X11 xclip| L[xclip -selection clipboard\nbundle.js:+3516902]
    I -->|Linux + X11 xsel| M[xsel --clipboard --input\nbundle.js:+3516943]
    I -->|tmux environment| N[tmux load-buffer -w\nbundle.js:+3517132]
    I -->|OSC 52 / DCS capable| O[OSC52 escape sequence\nbundle.js:+3516724]
    I -->|WSL / Windows| P[powershell.exe Set-Clipboard\nbundle.js:+3518243]
    J & K & L & M & N & O & P --> Q[Emit tengu_copy telemetry\nbundle.js:+11332315]
    Q --> R[Return JSX confirmation\nto terminal UI]
```

---

## Behavioral Spec

### 1. Argument Parsing and Index Resolution

Handler `dCL` (AsyncFunction, `claude-2.1.176::dCL`) begins by examining the raw argument string passed after `/copy`.

```
async function copyCommandHandler(rawArg, appState):
    trimmedArg = trim(rawArg)

    if trimmedArg is empty:
        targetIndex = 1
    else if Number.isInteger(Number(trimmedArg)):
        targetIndex = Number(trimmedArg)   // Nth-latest (1 = most recent)
    else:
        targetIndex = 1                    // fallback; may surface parse warning
```

Analysis basis: CC v2.1.176 bundle.js:+11332006, +11332020

---

### 2. Message History Traversal

The handler delegates to helper `weq` (message-filter utility), which walks the conversation message array looking for entries with `role === "assistant"`.

```
function filterAssistantMessages(messages):
    // Array.isArray guard applied first
    result = []
    for msg in messages:
        if msg.role === "assistant":
            result.push(msg)
    return result
```

Analysis basis: CC v2.1.176 bundle.js:+11327914, +11327946

The filtered list is then indexed from the tail: index 1 = `result[result.length - 1]`, index N = `result[result.length - N]`.

If the resolved entry does not exist (conversation has fewer than N assistant turns), the handler immediately returns the literal error string `"No assistant message to copy"`.

Analysis basis: CC v2.1.176 bundle.js:+11331937

---

### 3. Text Extraction

Helper `zeq` (content-block extractor) receives the located message object and extracts plain text from its content blocks.

```
function extractTextFromMessage(message):
    textParts = []
    for block in message.content:
        if block.type === "text":
            textParts.push(block.text)
    return join(textParts, separator)
```

The extractor also applies a table-rendering pass via helper `Oeq` (table formatter) when markdown table syntax is detected — it formats `|`-delimited rows with column alignment (`"center"`, `"right"`, `"left"` modes are supported) and computes column widths using `Bun.stringWidth`.

Analysis basis: CC v2.1.176 bundle.js:+11327495, +11327608, +11327231, +11327269, +11327305

Output format is either `"table"` (rendered) or `"plaintext"` depending on content detection.

Analysis basis: CC v2.1.176 bundle.js:+11327608, +11328049

---

### 4. Clipboard Backend Selection

Helper `mMA` (clipboard dispatcher) coordinates with helper `yT` (clipboard write) and `g79` (platform clipboard writer) to dispatch the extracted text.

```
async function dispatchToClipboard(text):
    env = detectEnvironment()  // inspects TERM, SSH, WSL, OS env vars

    if env.isMacOS:
        spawn("pbcopy", stdin=text)

    else if env.isLinux:
        if env.hasWayland:
            spawn("wl-copy", stdin=text)
        else if env.hasXclip:
            spawn("xclip", ["-selection", "clipboard"], stdin=text)
        else if env.hasXsel:
            spawn("xsel", ["--clipboard", "--input"], stdin=text)

    else if env.isTmux:
        spawn("tmux", ["load-buffer", "-w", "-"], stdin=text)

    else if env.isOSC52Capable:
        // encode text as base64, emit OSC52 escape sequence via terminal
        writeOSC52EscapeSequence(text)  // "osc52" path

    else if env.isWSL or env.isWindows:
        spawn("powershell.exe", ["-NoProfile", "-NonInteractive",
                                 "-Command", "Set-Clipboard ..."])

    else:
        // fallback: raw DCS or raw+dcs path
        writeRawDCS(text)
```

Supported terminal capability strings identified in bundle: `"osc52"`, `"dcs"`, `"raw+dcs"`, `"raw"`, `"tmux-buffer"`, `"none"`.

Analysis basis: CC v2.1.176 bundle.js:+3517877, +3516833, +3516902, +3516943, +3517132, +3516724, +3518243, +3517556, +3517579, +3517585, +3517630

The clipboard write timeout is **2000 ms** for the spawned process.

Analysis basis: CC v2.1.176 bundle.js:+3517843

Encoding used when base64 wrapping is required: `"base64"` over `"utf8"` input.

Analysis basis: CC v2.1.176 bundle.js:+3517441, +3517458

Special handling is applied for the `"kitty"` terminal and `"screen"` multiplexer environments.

Analysis basis: CC v2.1.176 bundle.js:+3516304, +3515835

---

### 5. Telemetry Emission

After a successful clipboard write, the handler fires the `tengu_copy` event. The event is emitted via the shared telemetry sink regardless of which backend was selected.

Analysis basis: CC v2.1.176 bundle.js:+11332315

---

### 6. Return Value (JSX)

`dCL` returns a JSX element rendered to the terminal UI (type `local-jsx`). On success the element confirms the copy action. On failure (no message found, process spawn error) an appropriate error message is surfaced in the same JSX slot.

Analysis basis: CC v2.1.176 bundle.js:+11332711 – +11332897

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (bundle.js:+11332315) — fired on every `/copy` invocation after the target message is resolved |
| Clipboard write | Side-effects the OS clipboard via one of: `pbcopy`, `wl-copy`, `xclip`, `xsel`, `tmux load-buffer`, OSC52 escape, or `powershell.exe Set-Clipboard` |
| appState changes | None observed in depth-2 traversal; read-only access to message history |
| Hook registration | None observed in depth-2 traversal |
| Sound | None observed in depth-2 traversal |
| Process spawn timeout | 2000 ms hard limit on clipboard helper subprocess |

---

## Version History

| Version | Change |
|---|---|
| v2.1.176 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy foo` does not produce a meaningful selection; the argument is expected to be a positive integer N referring to the Nth-latest assistant message.
2. **Running `/copy N` with N larger than the conversation length** — if fewer than N assistant turns exist in the session the command returns the "No assistant message to copy" error rather than copying a partial result.
3. **Clipboard not working over SSH without OSC52** — when connected via SSH without a terminal that supports the OSC52 protocol, none of the native clipboard tools (`pbcopy`, `xclip`, etc.) can reach the local clipboard. Configure the terminal emulator to allow OSC52 passthrough, or use tmux's buffer mechanism.
4. **WSL without `powershell.exe` on PATH** — on WSL environments where `powershell.exe` is not accessible, the Windows clipboard path will fail silently; ensure WSL interop is enabled.
5. **Expecting formatted output for non-table content** — the table-rendering path only activates when pipe-delimited markdown table syntax is detected; plain prose is copied as-is without additional formatting.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `dCL` | Main async handler for `/copy` command (arbor_handler) |
| `Oeq` | Table formatter — renders markdown `|`-delimited tables with column alignment |
| `UCL` | Column content mapper used inside table formatter |
| `zeq` | Content-block extractor — walks message content array, produces text |
| `weq` | Assistant-message filter — filters conversation history to assistant turns |
| `Yf` | Text-block type filter (`type === "text"`) |
| `pCL` | Markdown lexer helper — tokenises message text |
| `N0H` | Token normaliser / replace helper |
| `mMA` | Clipboard dispatcher — selects backend and initiates write |
| `yT` | Clipboard write orchestrator |
| `g79` | Platform clipboard writer (spawns OS-specific process) |
| `dh_` | Linux clipboard path selector (wl-copy / xclip / xsel) |
| `yc4` | Clipboard method resolver |
| `Qh_` | OSC52 / terminal escape writer |
| `KG6` | Terminal capability detector |
| `NY` | Terminal environment reader |
| `fG6` | Fallback clipboard path |
| `i0` | tmux-buffer clipboard path |
| `QY` | Raw DCS escape path |
| `F79` | Kitty terminal clipboard path |
| `p8` | Subprocess spawn wrapper |
| `x4` | Argument index finder |
| `Deq` | Temp-file writer used during clipboard operation |
| `gJ` | Temp directory / file setup helper |
| `qJ9` | Temp directory validation helper |
| `K8` | String-width calculator (wraps `Bun.stringWidth`) |
| `fM` | Padding/repeat helper for table column layout |
| `K` | Column padEnd formatter |
| `CH` | JSON serialiser wrapper |
| `C6` | Config file watcher / loader |
| `G5H` | Global config reader |
| `kPK` | Daemon status helper |
| `zLH` | Trim + length utility |
| `Cs` | Message content normaliser |
| `LbH` | MCP server manager (reached via deep call graph; not directly invoked by `/copy`) |
| `vZA` | MCP client registry accessor |