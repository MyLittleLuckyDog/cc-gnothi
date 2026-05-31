---
type: feature-spec
feature: "copy"
cc_version: "2.1.139"
updated: "2026-05-31"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.139 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.139 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.139

---

## Overview

The `/copy` command copies Claude's last assistant response to the system clipboard. An optional numeric argument `N` (e.g. `/copy 2`) selects the Nth-latest assistant message instead of the most recent one. The command resolves message content, formats it as plain text, and dispatches it to the OS clipboard via a platform-appropriate utility.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| loc_byte | `9949443` |
| loc_byte_end | `9949629` |
| loc_line | `5597` |
| module_id | `o6q` |
| load_inline | `true` |
| arbor_handler.name | `IL7` |
| arbor_handler.fqn | `claude-2.1.139::IL7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.139 bundle.js:+9949443

---

## Input Branching

The command has four distinct branches based on argument parsing and message lookup:

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument present?}
    B -- No --> C[Use N = 1 (most recent)]
    B -- Yes --> D{Is arg a valid integer?}
    D -- No --> E[Error: invalid argument]
    D -- Yes --> F[Use N = parsed integer]
    C --> G[Search message history for Nth assistant message]
    F --> G
    G --> H{Assistant message found?}
    H -- No --> I["Return error: 'No assistant message to copy'"]
    H -- Yes --> J[Extract text content from message]
    J --> K[Write to clipboard via platform utility]
    K --> L[Emit tengu_copy telemetry]
    L --> M[Return success to user]
```

Analysis basis: CC v2.1.139 bundle.js:+9948628, +9948738, +9948667, +9948669

---

## Behavioral Spec

### 1. Argument Parsing

The handler (`IL7`) begins by inspecting the raw command input string.

```
async function copyCommandHandler(inputString, appContext):
    rawArg = extractArgument(inputString)      // strips "/copy" prefix

    if rawArg is absent or blank:
        targetIndex = 1                        // default: most recent
    else:
        n = Number(rawArg)
        if not Number.isInteger(n) or n < 1:
            return errorResult("invalid argument")
        targetIndex = n
```

- `Number` coercion and `Number.isInteger` check are used to validate the argument. Analysis basis: CC v2.1.139 bundle.js:+9948738, +9948752
- The string `"No assistant message to copy"` is returned verbatim when the lookup fails. Analysis basis: CC v2.1.139 bundle.js:+9948669

### 2. Message History Lookup

The handler calls `extractContentBlocks` (`n6q`) to walk the conversation messages array.

```
function extractContentBlocks(messages):
    if not Array.isArray(messages):
        return []
    result = []
    for each message in messages:
        if message.role == "assistant":        // literal "assistant"
            contentItems = filterTextBlocks(message.content)
            result.push(contentItems)
    return result
```

- The role filter uses the string literal `"assistant"`. Analysis basis: CC v2.1.139 bundle.js:+9944576
- Text blocks are identified by type `"text"`. Analysis basis: CC v2.1.139 bundle.js:+9815168
- `filterTextBlocks` (`NK`) filters the content array for items of type `"text"`. Analysis basis: CC v2.1.139 bundle.js:+9815145

After collecting all assistant message blocks, the handler selects the Nth item from the end (1-indexed) using the `targetIndex` computed above.

```
function selectNthLatest(assistantBlocks, n):
    reversed = assistantBlocks reversed
    if n > len(reversed):
        return null
    return reversed[n - 1]
```

Analysis basis: CC v2.1.139 bundle.js:+9948982

### 3. Content Rendering to Plain Text

Once the target message block is identified, the handler calls `renderMessageToPlaintext` (`l6q`) to convert it to a copyable string.

```
function renderMessageToPlaintext(contentBlocks, context):
    // Uses Ff.lexer (markdown lexer) to parse block content
    // Strips formatting markers; pipe characters are escaped ("\\|")
    // Table rendering: columns separated by " | ", aligned left/center/right
    // Falls back to joining raw text spans
    return plaintextString
```

- The markdown lexer (`Ff` / `zGH.parse`) is invoked to tokenise content. Analysis basis: CC v2.1.139 bundle.js:+9944227
- Pipe character `"|"` is escaped as `"\\|"` during table rendering. Analysis basis: CC v2.1.139 bundle.js:+9943757
- Column separator literal is `" | "`. Analysis basis: CC v2.1.139 bundle.js:+9943916
- Alignment values `"left"`, `"center"`, `"right"` are used during table cell padding. Analysis basis: CC v2.1.139 bundle.js:+9943951, +9943993, +9944033
- A minimum column width of `3` characters is enforced via `Math.max`. Analysis basis: CC v2.1.139 bundle.js:+9943816
- `Bun.stringWidth` (`L8`) is used to compute display width of cell content for alignment. Analysis basis: CC v2.1.139 bundle.js:+199857
- The output format literal `"plaintext"` is used to gate plain-text rendering mode. Analysis basis: CC v2.1.139 bundle.js:+9944781
- A secondary path handles `"table"` format. Analysis basis: CC v2.1.139 bundle.js:+9944340

### 4. Content Sanitization

Before the string is sent to the clipboard, `sanitizeForClipboard` (`i6q`) applies a `String.replace` pass to remove or normalize special characters.

```
function sanitizeForClipboard(text):
    return text.replace(pattern, replacement)
```

Analysis basis: CC v2.1.139 bundle.js:+9944741

### 5. Clipboard Write

The handler calls `writeToClipboard` (`yh_`), which internally delegates to `tT` and selects a platform-specific subprocess command.

```
async function writeToClipboard(text):
    encoded = base64Encode(text)              // "base64" encoding used

    platform = process.platform
    switch platform:
        case "darwin":
            run("pbcopy")
        case "linux":
            if wayland:
                run("wl-copy")
            elif xclip available:
                run("xclip", "-selection", "clipboard")
            else:
                run("xsel", "--clipboard", "--input")
        case "win32":
            run("powershell", "-NoProfile", "-NonInteractive", "-Command", ...)
        default:
            // kitty / tmux terminal fallback:
            if in_kitty:
                run kitty clipboard protocol
            elif in_tmux:
                run("tmux", "load-buffer", "-w", ...)
            else:
                // iTerm2 OSC 52 escape sequence
```

- `"base64"` is the encoding used when writing content. Analysis basis: CC v2.1.139 bundle.js:+3226061
- `"pbcopy"` is the macOS clipboard utility. Analysis basis: CC v2.1.139 bundle.js:+3226282
- `"wl-copy"` is the Wayland clipboard utility. Analysis basis: CC v2.1.139 bundle.js:+3226347
- `"xclip"` with `"-selection"` `"clipboard"` is the X11 primary path. Analysis basis: CC v2.1.139 bundle.js:+3226393, +3226414, +3226427
- `"xsel"` with `"--clipboard"` `"--input"` is the X11 fallback. Analysis basis: CC v2.1.139 bundle.js:+3226459, +3226478, +3226492
- `"powershell"` with `"-NoProfile"`, `"-NonInteractive"`, `"-Command"` is used on Windows. Analysis basis: CC v2.1.139 bundle.js:+3226771, +3226785, +3226798, +3226816
- `"tmux"` `"load-buffer"` `"-w"` is the tmux terminal fallback. Analysis basis: CC v2.1.139 bundle.js:+3225881, +3225915
- `"kitty"` terminal protocol is detected and used. Analysis basis: CC v2.1.139 bundle.js:+3225378
- `"iTerm2"` is detected for OSC 52 fallback. Analysis basis: CC v2.1.139 bundle.js:+3225871
- The temp-file path for intermediate clipboard writes uses the system tmp directory, with permissions `448` (octal 0700) enforced. Analysis basis: CC v2.1.139 bundle.js:+3793460, +3794141

The helper `sP` joins paths and `FvL` selects among terminal image/clip protocols using `vZ`. Analysis basis: CC v2.1.139 bundle.js:+3225370, +3225195

The temp-file directory is validated against symlink/directory attacks: `lUL` checks `lstatSync`, verifies it is a directory with `q.isDirectory`, and applies `chmodSync` with mode `511` (octal 0777) if needed. Analysis basis: CC v2.1.139 bundle.js:+3793628, +3793649, +3793951

### 6. Telemetry Emission

After the clipboard write completes (success or failure), the handler emits a `tengu_copy` telemetry event.

```
function emitCopyTelemetry(outcome):
    emit("tengu_copy", { result: outcome })
```

Analysis basis: CC v2.1.139 bundle.js:+9949047

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (emitted after clipboard write; loc +9949047) |
| Clipboard side effect | Overwrites system clipboard contents with the selected assistant message text |
| Subprocess spawned | Platform-appropriate clipboard utility (`pbcopy`, `wl-copy`, `xclip`, `xsel`, `powershell`, `tmux load-buffer`) |
| Temp file | May create a temporary file under `CLAUDE_CODE_TMPDIR` or `/tmp` for clipboard data piping; cleaned up after use |
| appState changes | None observed in depth-2 traversal |
| Hook registration | None observed in depth-2 traversal |
| Sound | None observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.139 | Initial analysis |

---

## Common Mistakes

1. **Providing a non-integer argument**: `/copy 1.5` or `/copy last` will fail argument validation because `Number.isInteger` rejects non-integers. Only positive whole numbers are accepted.
2. **Index out of range**: `/copy 5` when only 3 assistant messages exist returns the "No assistant message to copy" error. The index is 1-based and counts from the most recent message backward.
3. **Clipboard unavailable in headless/SSH environments**: On remote SSH sessions without a display server, `xclip`/`xsel`/`wl-copy` may not be available. The command falls back to terminal-based OSC 52 protocols (kitty, iTerm2, tmux) but will silently fail if none are detected.
4. **Omitting `/copy` and just typing the number**: The number must be part of the `/copy N` invocation; standalone numbers are not interpreted by this command.
5. **Expecting rich formatting in clipboard**: The command deliberately strips markdown formatting to plain text. Tables are rendered with pipe separators, but emphasis, code fences, and other markdown syntax are removed.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `IL7` | Main async handler for `/copy` command (arbor-resolved handler) |
| `n6q` | Extract and collect assistant message content blocks from history |
| `NK` | Filter message content array for text-type blocks |
| `l6q` | Render message content blocks to plain-text string |
| `c6q` | Table/column layout and alignment helper used during plaintext rendering |
| `GL7` | Map helper used inside table column width calculation |
| `WL7` | Secondary markdown-to-text rendering path (uses lexer + `FzH`) |
| `FzH` | Replace helper for markdown syntax normalisation |
| `i6q` | Sanitize text string before clipboard write (`String.replace` pass) |
| `yh_` | Write-to-clipboard orchestrator; selects platform path |
| `tT` | Platform clipboard dispatcher; calls `sP`, `lvL`, `dvL`, `QvL` |
| `sP` | Kitty clipboard protocol writer; uses `FvL`/`vZ` |
| `FvL` | Terminal image/clip protocol selector |
| `lvL` | Clipboard write via `O8` for one terminal type |
| `dvL` | Clipboard write via `O8` for another terminal type |
| `QvL` | Clipboard write using `replaceAll` escape pass |
| `O8` | Low-level clipboard output helper using `$_` and `C6` |
| `r6q` | Temp-directory and temp-file creation for clipboard piping |
| `w2` | Temp-directory initialiser; enforces permissions via `lUL` |
| `lUL` | Temp-directory safety validator (`lstatSync`, `chmodSync`) |
| `t4` | String index-of helper used in content extraction |
| `L8` | Display-width calculator (`Bun.stringWidth`) for table alignment |
| `Ff` | Markdown lexer wrapper (`zGH.parse`) |
| `b5H` | Content text extraction with trim; uses `T8H` and `_.trim` |
| `NXq` | Daemon status writer using `Date.now` and `RD` |
| `RD` | Atomic file writer (`randomBytes`, `writeFile`, `rename`) |
| `fW6` | Path joiner for daemon status file (`daemon.status.json`) |
| `yH` | JSON serialiser wrapper (`JSON.stringify`) |
| `Q` | General-purpose result/error wrapper |
| `LH` | Structured logger / error reporter |
| `SH` | String coercion utility |
| `IH` | String conversion helper |
| `b6` | Config loader with file-watcher (`pVL`) |
| `cfH` | Config file reader and parser |
| `WIH` | MCP server manager / connection orchestrator |
| `Kk_` | MCP server connection lifecycle handler |
| `se` | MCP OAuth flow server (HTTP callback listener) |
| `Fg` | MCP reconnect handler |
| `M` | MCP update applicator; calls `WIH` and `Niq` |
| `Wa7` | MCP server list synchroniser |
| `Niq` | Apply MCP update and cleanup stale connections |
| `WI` | MCP connection cleanup helper |
| `DiH` | MCP connection state serialiser |
| `w` | Background daemon worker / session manager |
| `ml_` | Background session roster entry manager |
| `Sl_` | Background session claim and connect helper |
| `ul_` | Memory pressure check helper (`o6`, `j6`) |
| `j6` | Daemon process lookup via config (`b6`) |
| `v` | Background worker process object |
| `S` | Background worker supervisor |
| `xH` | Telemetry event emitter (`tengu_feature_bad`) |
| `kH` | Telemetry event emitter (`tengu_feature_ok`) |
| `N3H` | Async iterator / stream processor |
| `la1` | MCP server-side async tool handler |
| `kP6` | Port parser (radix 10) |
| `Nk_` | Secondary port parser (radix 20) |
| `vO8` | MCP config serialiser (`yH`) |
| `R9K` | Transcript/log file rotation manager |
| `S9K` | Log file appender with rotation |
| `At_` | Log file rename/unlink helper |
| `IV8` | File-write error classifier (`EISDIR`) |
| `qt_` | Log file path builder |
| `n6H` | Log directory initialiser |
| `JyH` | Batched log flush scheduler |
| `LM` | Log-level and path formatter |
| `os_` | Log entry formatter |
| `QyH` | Log write dispatcher (`ms_`) |
| `ms_` | Low-level log write (`H.write`) |
| `C9` | Active-write-set tracker (`$Z8`) |
| `B6` | Filesystem path utilities |
| `ic` | Directory existence checker |
| `Xc` | Config change subscriber |
| `pVL` | File watcher for config reload |