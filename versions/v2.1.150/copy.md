---
type: feature-spec
feature: "copy"
cc_version: "2.1.150"
updated: "2026-06-01"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.150 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.150 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.150

---

## Overview

The `/copy` command copies Claude's last assistant response to the system clipboard. An optional integer argument `N` selects the Nth-latest assistant response instead of the most recent one. The command locates the target message in the conversation history, extracts its text content, invokes a platform-aware clipboard writer, and emits a `tengu_copy` telemetry event on completion.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `zW1` |
| load_inline | `true` |
| loc_byte | `10676396` |
| loc_byte_end | `10676582` |
| loc_line | `8422` |
| arbor_handler.name | `iuL` |
| arbor_handler.fqn | `claude-2.1.150::iuL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.150 bundle.js:+10676396

---

## Input Branching

Four distinct branches exist depending on the argument supplied and the state of the conversation history.

```mermaid
flowchart TD
    A(["/copy [N] invoked"]) --> B{Argument present?}
    B -- No --> C[target index = 0\n(most recent assistant message)]
    B -- Yes --> D[parse argument as Number]
    D --> E{Number.isInteger\ncheck passes?}
    E -- No --> F[Treat as invalid;\nfall through to message lookup\nwith NaN / default index]
    E -- Yes --> G[target index = N - 1\n(1-based → 0-based)]
    C --> H[Scan messages array in reverse\nfor role === 'assistant']
    G --> H
    F --> H
    H --> I{Assistant message\nfound at target index?}
    I -- No --> J[Return error JSX:\n'No assistant message to copy']
    I -- Yes --> K[extractPlaintext from message content]
    K --> L[writeToClipboard — platform dispatch]
    L --> M[Emit tengu_copy telemetry]
    M --> N([Return success JSX])
```

Analysis basis: CC v2.1.150 bundle.js:+10675581 (handler entry `iuL`), +10675691 (Number parse), +10675705 (Number.isInteger), +10675622 (error string)

---

## Behavioral Spec

### 1. Argument Parsing

The handler (`iuL`) reads the raw argument string appended after `/copy`. It coerces the string with `Number()` and then validates with `Number.isInteger()`. If the value is a valid integer, it is converted from 1-based user input to a 0-based offset for array indexing via `Math.max` clamping (minimum index 0). When no argument is provided, the offset defaults to `0`, targeting the most recent assistant message.

```
function parseTargetIndex(rawArg):
    if rawArg is empty or whitespace:
        return 0
    n = Number(rawArg)
    if not Number.isInteger(n):
        return 0          // treat invalid input as "most recent"
    return Math.max(0, n - 1)
```

Analysis basis: CC v2.1.150 bundle.js:+10675691, +10675705, +10670760

### 2. Message Selection (`messageSelector` / `MW1`)

`MW1` walks the conversation messages array in reverse, collecting entries whose `role` field equals `"assistant"` (literal at +10671529). It selects the entry at the computed 0-based offset. If the offset exceeds the count of assistant messages found, the result is `undefined`.

```
function messageSelector(messages, targetIndex):
    assistantMessages = []
    for msg in reverse(messages):
        if msg.role == "assistant":
            assistantMessages.push(msg)
    return assistantMessages[targetIndex]   // undefined if out of range
```

Analysis basis: CC v2.1.150 bundle.js:+10671347, +10671529

### 3. No-Message Guard

Immediately after message selection, `iuL` tests whether a message was found. When the result is falsy it returns a JSX element carrying the string `"No assistant message to copy"` and halts further processing.

```
function guardMessageExists(msg):
    if msg is null or undefined:
        return errorJSX("No assistant message to copy")
    return null   // continue
```

Analysis basis: CC v2.1.150 bundle.js:+10675620, +10675622

### 4. Content Extraction (`contentExtractor` / `fW1`)

`fW1` normalises the message content field into a flat list of text strings. It handles both the array-of-blocks form and the plain-string form. Only blocks of type `"text"` (literal at +10379737) are kept; other block types are filtered out by `$K`.

```
function contentExtractor(content):
    if Array.isArray(content):
        blocks = content
    else:
        blocks = [content]
    textBlocks = filterByType(blocks, "text")  // $K
    return textBlocks.map(b => b.text or b).join("")
```

Analysis basis: CC v2.1.150 bundle.js:+10671599, +10671631, +10379737

### 5. Plain-Text Rendering (`plaintextFormatter` / `LW1`)

`LW1` converts the raw message text (which may include markdown table syntax) into a clean plain-text representation suitable for clipboard insertion.

Key steps:
1. Tokenise the text with the markdown lexer (`Nf.lexer`).
2. Detect table tokens; if present, reformat them with aligned columns using `w8` (which calls `Bun.stringWidth` for Unicode-aware column widths) and the separators `" | "` (literal at +10670869), `"center"` / `"right"` / `"left"` alignment strings (+10670904, +10670946, +10670986).
3. Map remaining tokens to plain text strings via `guL`, which strips markdown formatting using `tDH` (`H.replace` at +10378093).
4. Strip residual escaped pipe characters (`\|` literal at +10670710) from the final output.
5. Render using the `"plaintext"` format token (literal at +10671734).

```
function plaintextFormatter(rawText):
    tokens = markdownLexer(rawText)
    output = []
    for token in tokens:
        if token.type == "table":
            output.push(formatTable(token, columnWidthFn))
        else:
            output.push(stripMarkdown(token))
    result = output.join("")
    result = result.replace("\\|", "")
    return result
```

Analysis basis: CC v2.1.150 bundle.js:+10671180, +10670694, +10670710, +10670869, +10670904, +10670946, +10670986, +10671734

### 6. Clipboard Writer (`clipboardWriter` / `KE` → `cj` / `iH7` / `cH7` / `dH7`)

`md_` orchestrates clipboard writing. It first calls `KE`, which internally selects the appropriate platform backend:

| Platform | Backend |
|---|---|
| `darwin` | `pbcopy` |
| `linux` (Wayland) | `wl-copy` |
| `linux` (X11 via xclip) | `xclip -selection clipboard` |
| `linux` (X11 via xsel) | `xsel --clipboard --input` |
| `win32` | `powershell -NoProfile -NonInteractive -Command …` |
| iTerm2 / tmux | OSC 52 or `tmux load-buffer -w` |
| Kitty terminal | Kitty graphics protocol |

`KE` encodes content as `base64` (literal at +3352713) when needed for OSC-52/Kitty paths. The temp directory for intermediate files defaults to `/tmp` (literal at +3922914), overridable via `CLAUDE_CODE_TMPDIR`.

`OW1` handles file-system operations when the clipboard backend requires a temporary file: it creates the directory (`d08.mkdir`), writes the file (`d08.writeFile`), using `qW1.join` for path construction.

```
function clipboardWriter(text, platform):
    encoded = (needsBase64(platform)) ? base64Encode(text) : text
    cmd = selectBackend(platform)   // darwin→pbcopy, linux→wl-copy/xclip/xsel, win32→powershell
    if isOSC52orKitty(platform):
        writeViaTerminalEscape(encoded)
    elif isTmux(platform):
        writeViaTmux(encoded)
    else:
        spawnProcess(cmd, stdin=text)
```

Analysis basis: CC v2.1.150 bundle.js:+3352725, +3352908, +3352934, +3352960, +3352999, +3353045, +3353079, +3353111, +3353411, +3353423, +3352523, +3352533, +3352030, +3352713, +3922914

### 7. Telemetry Emission

After a successful clipboard write, `iuL` emits the `tengu_copy` event (at +10676000). The event fires unconditionally on the success path; no properties beyond the event name are visible in the depth-2 traversal.

```
function emitCopyTelemetry():
    track("tengu_copy")
```

Analysis basis: CC v2.1.150 bundle.js:+10676000

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (emitted on successful clipboard write, +10676000) |
| Clipboard | System clipboard is overwritten with the extracted plain-text content of the target assistant message |
| Temporary files | May write a temporary file under `/tmp` (or `CLAUDE_CODE_TMPDIR`) when the clipboard backend requires an intermediate path (+3922914) |
| appState changes | None observed at depth ≤ 2 |
| Hook registration | None observed at depth ≤ 2 |
| Sound | None observed |

---

## Version History

| Version | Change |
|---|---|
| v2.1.150 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy foo` will be parsed by `Number("foo")` → `NaN`, which fails `Number.isInteger`, so the command silently falls back to copying the most recent assistant message instead of reporting an error.
2. **1-based vs 0-based confusion** — `/copy 1` copies the most recent message; `/copy 2` copies the second-most-recent. Passing `0` is coerced to index `Math.max(0, -1)` = `0`, so it also copies the most recent message.
3. **No assistant messages in session** — invoking `/copy` before Claude has replied returns a JSX error ("No assistant message to copy") and nothing is written to the clipboard.
4. **Clipboard tool unavailability on Linux** — if neither `wl-copy`, `xclip`, nor `xsel` is installed, the clipboard write will fail silently or with a spawn error; no fallback is visible in the depth-2 traversal.
5. **Table alignment in copied output** — tables are reformatted to plain-text pipe-delimited form with Unicode-aware column widths; the result may differ from the rendered markdown appearance in the terminal.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `iuL` | Main async handler for `/copy` (arbor_handler) |
| `LW1` | Plain-text formatter / markdown-to-plaintext converter |
| `QuL` | Markdown token map helper called by plain-text formatter |
| `MW1` | Message selector — finds Nth assistant message in history |
| `guL` | Markdown token stripper (lexer token → plain string) |
| `tDH` | Regex-based markdown stripping function |
| `fW1` | Content extractor — normalises message content to text blocks |
| `$K` | Block-type filter (keeps only `"text"` blocks) |
| `$W1` | Plaintext post-processor (replace calls) |
| `md_` | Clipboard write orchestrator |
| `KE` | Platform clipboard backend selector |
| `cj` | Clipboard write implementation (base path) |
| `gH7` | Kitty terminal clipboard helper |
| `iH7` | Clipboard backend — darwin / pbcopy path |
| `cH7` | Clipboard backend — Linux/Wayland/X11 path |
| `dH7` | Clipboard backend — string replaceAll helper for clipboard content |
| `OW1` | Temporary file writer for clipboard backends that require a file |
| `VP` | Temp directory setup / permission check |
| `hp` | Temp dir path helper |
| `kM7` | Temp dir lstat + chmod guard |
| `Nf` | Markdown lexer wrapper |
| `w8` | Unicode-aware string width function (wraps `Bun.stringWidth`) |
| `HQ1` | Daemon status helper |
| `Pn` | Daemon status reader |
| `vqH` | Low-level status field accessor |
| `A1` | App store accessor |
| `$v6` | Status file path joiner |
| `CH` | JSON serialiser wrapper |
| `O7` | String indexOf utility |
| `lv5` | MCP server lifecycle manager |
| `UyH` | MCP connection handler |
| `gDK` | MCP update applicator |
| `OI` | MCP cleanup orchestrator |
| `ytH` | MCP session state formatter |
| `ZW8` | MCP state serialiser |
| `j6H` | MCP config resolver |
| `G4H` | MCP server config builder |
| `Rj6` | MCP server type handler |
| `Sj6` | MCP server deduplication handler |
| `w6H` | MCP SDK server list builder |
| `bN` | MCP server bootstrap |
| `HO` | MCP feature flag checker |
| `hB_` | MCP connection runner |
| `f_H` | MCP OAuth server runner |
| `SB_` | MCP complete-authentication handler |
| `Dc` | MCP reconnect handler |
| `IY1` | MCP needs-auth cache writer |
| `EW8` | MCP needs-auth cache path builder |
| `VkL` | MCP auth-cache loader |
| `vF_` | MCP auth-cache file reader |
| `kB_` | MCP session key builder |
| `lT_` | MCP transport selector |
| `f8` | Global config writer |
| `m6` | Config file watcher/loader |
| `Tt4` | Config file watch manager |
| `JOH` | Config file reader |
| `mb9` | Config backup locator |
| `Of_` | Config backup path builder |
| `xC` | Config path prefix stripper |
| `g6` | JSON.parse wrapper |
| `K8` | Error code checker |
| `N` | Notification / output renderer |
| `LVK` | Notification formatter |
| `T7A` | Terminal title setter |
| `X4` | ANSI/markup text processor |
| `s5A` | Markup token mapper |
| `HbH` | Terminal output writer |
| `B5A` | Raw write helper |
| `$VK` | Transcript / log file writer |
| `ICH` | Buffered write scheduler |
| `q9H` | Log line formatter |
| `G96` | Log error code classifier |
| `LMA` | Log file path builder |
| `KMA` | Log file rotation handler |
| `fVK` | Log file append handler |
| `a9` | Signal handler registrar |
| `r8` | Timeout-guarded async executor |
| `R78` | MCP tool filter (has-check) |
| `ZY1` | Async map with concurrency limit |
| `li` | Concurrency-limited async mapper (core) |
| `_E6` | Integer parser (radix 10) |
| `NF_` | Integer parser (radix 20) |
| `RH` | Error logger |
| `V6` | Config reload trigger |
| `yqA` | Background session connector |
| `uqA` | Background session lifecycle manager |
| `w` | Background session dispatcher |
| `D` | Background spare session manager |
| `Kv8` | Free-memory reporter |
| `Oz6` | Conversation file reader |
| `g` | Session retire-if-settled helper |
| `S` | Session state machine |
| `c` | Generic async error handler |
| `uH` | Feature-ok telemetry helper |
| `bH` | Feature-bad telemetry helper |
| `CL` | MCP error logger |
| `EH` | String error formatter |
| `ym` | Async operation wrapper |
| `Y` | Supervisor config updater |
| `MI` | MCP idle checker |
| `yNL` | SSH/remote environment detector |
| `SNL` | Auth completion signal handler |
| `jtH` | MCP connection cache setter |
| `JtH` | MCP connection cache getter |
| `wtH` | MCP disconnection cache getter |
| `z8` | MCP debug logger |
| `hNL` | MCP server initialiser |
| `nF` | MCP transport factory |
| `INL` | MCP capability negotiator |
| `f_H` | MCP OAuth flow runner |
| `ENL` | MCP error classifier |
| `s28` | Auth cache state loader |
| `h78` | MCP server hash builder |
| `JX` | MCP server identity hasher |
| `k78` | MCP server fingerprint builder |
| `FK` | Fingerprint serialiser |
| `y78` | MCP tool schema hasher |
| `z6H` | MCP schema key extractor |
| `HE6` | MCP health evaluator |
| `t8` | Async retry helper |
| `aT_` | MCP server approval checker |
| `m6` | Config watcher/loader (also above) |
| `Af_` | Config access guard |
| `rn` | File watch debouncer |
| `OI` | MCP cleanup orchestrator (also above) |
| `E8` | Terminal escape sequence builder |
| `G_` | OSC escape builder |
| `x6` | Terminal escape terminator |