---
type: feature-spec
feature: "copy"
cc_version: "2.1.199"
updated: "2026-07-03"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.199 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.199 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.199

---

## Overview

The `/copy` command copies Claude's most recent assistant response to the system clipboard. When invoked with an optional numeric argument `N` (e.g., `/copy 3`), it instead copies the Nth-latest assistant message from the conversation history. The command resolves clipboard access through a platform-aware mechanism that supports macOS (`pbcopy`), Linux (Wayland `wl-copy`, X11 `xclip`/`xsel`), Windows/WSL (`powershell.exe`), tmux buffers, OSC 52 terminal sequences, and a DCS-wrapped variant.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `Y6l` |
| load_inline | `true` |
| loc_byte | `11851654` |
| loc_byte_end | `11851840` |
| loc_line | `8543` |
| arbor_handler.name | `gWf` |
| arbor_handler.fqn | `claude-2.1.199::gWf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.199 bundle.js:+11851654

---

## Input Branching

The command has 4+ distinct branches depending on: whether an argument is provided and is a valid integer, whether assistant messages exist, what the detected platform/clipboard mechanism is, and whether a file-based clipboard fallback is needed. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument provided?}
    B -- "No" --> C[Use index = 1\n(most recent)]
    B -- "Yes" --> D{Is arg a valid integer?}
    D -- "No" --> E[Treat as N=1\nor parse error path]
    D -- "Yes" --> F[Use N = parsed integer]
    C --> G[Filter conversation messages\nfor role == 'assistant']
    F --> G
    G --> H{Any assistant messages found?}
    H -- "No" --> I[Return error:\n'No assistant message to copy']
    H -- "Yes" --> J[Select Nth-latest\nassistant message\nvia Math.max + slice]
    J --> K[Extract text content blocks\nfilter type == 'text']
    K --> L[Render content to plaintext\nincluding code blocks]
    L --> M{Detect clipboard mechanism}
    M -- "macOS / pbcopy" --> N[Spawn pbcopy process\ntimeout 2000ms]
    M -- "Linux + Wayland" --> O[Spawn wl-copy]
    M -- "Linux + X11 xclip" --> P[Spawn xclip\n-selection clipboard]
    M -- "Linux + X11 xsel" --> Q[Spawn xsel\n--clipboard --input]
    M -- "tmux buffer" --> R[Use tmux load-buffer -w]
    M -- "OSC 52 terminal" --> S[Emit OSC 52 escape sequence\nbase64-encoded UTF-8]
    M -- "Windows / WSL" --> T[Spawn powershell.exe\n-NoProfile -NonInteractive -Command Set-Clipboard]
    M -- "DCS variant" --> U[Emit DCS-wrapped OSC 52\nfor screen/multiplexer]
    N & O & P & Q & R & S & T & U --> V[Emit tengu_copy telemetry]
    V --> W[Render JSX confirmation\nto REPL]
    I --> X[Display error in REPL]
```

---

## Behavioral Spec

### Main Handler — `copyCommandHandler` (bundle: `gWf`)

The primary async function that orchestrates the entire `/copy` flow.

```
async function copyCommandHandler(context):
    rawArg = extractArgumentFromInput(context)
    n = Number(rawArg)
    if Number.isInteger(n) and n >= 1:
        index = n
    else:
        index = 1

    assistantMessages = filterAssistantMessages(context.messages)
    // "No assistant message to copy" (bundle.js:+11850877)
    if assistantMessages is empty:
        return renderError("No assistant message to copy")

    targetMessage = selectNthLatest(assistantMessages, index)
    plaintext = renderMessageToPlaintext(targetMessage)

    emitTelemetry("tengu_copy")   // bundle.js:+11851255
    result = writeToClipboard(plaintext)
    return renderJSX(result)
```

Analysis basis: CC v2.1.199 bundle.js:+11850836

---

### Message Filtering — `filterAssistantMessages` (bundle: `q6l`)

Scans the message list for entries whose role is `"assistant"` and whose content contains `type == "text"` blocks.

```
function filterAssistantMessages(messages):
    if not Array.isArray(messages):
        return []
    result = []
    for each message in messages:
        textBlocks = filterTextBlocks(message)  // bundle: _l → e.filter type=="text"
        if textBlocks is not empty:
            result.push(message)
    return result
```

Analysis basis: CC v2.1.199 bundle.js:+11846897

---

### Plaintext Renderer — `renderMessageToPlaintext` (bundle: `V6l`)

Converts an assistant message (which may contain code blocks and table structures) into a plain text string suitable for clipboard insertion.

```
function renderMessageToPlaintext(message):
    tokens = lexAndParse(message.content)   // wg.lexer → vje.parse
    tableIndex = tokens.indexOf(tableMarker)

    if tableIndex >= 0:
        // Render as table with column separators " | "
        // Pad columns, align center/right/left
        // Replace internal pipe chars using "\\|" escape
        rows = renderTable(tokens, tableIndex)
        return rows.join("\n")
    else:
        // Render code blocks with "code" type markers
        // Render inline content with surrounding pipes stripped
        return renderPlainLines(tokens)
```

Table column separator: `" | "` (bundle.js:+11846179)
Minimum column width padding: `3` (bundle.js:+11846079)
Table type literal: `"table"` (bundle.js:+11846591)
Plaintext type literal: `"plaintext"` (bundle.js:+11847032)
Temporary file extension for clipboard staging: `".txt"` (bundle.js:+11847064)

Analysis basis: CC v2.1.199 bundle.js:+11846478

---

### Clipboard Writer — `writeToClipboard` (bundle: `n5o`)

Platform detection and dispatch to the appropriate clipboard mechanism. Calls `nL` (the cross-platform clipboard write function) then verifies success.

```
async function writeToClipboard(text):
    encoded = encodeUtf8(text)       // encoding: "utf8" / "base64"
    mechanism = detectClipboardMechanism()

    switch mechanism:
        case "macos":
            spawnProcess("pbcopy", [], {timeout: 2000, stdin: encoded})
        case "linux" + Wayland:
            spawnProcess("wl-copy", [], {stdin: encoded})
        case "linux" + X11 (xclip):
            spawnProcess("xclip", ["-selection", "clipboard"], {stdin: encoded})
        case "linux" + X11 (xsel):
            spawnProcess("xsel", ["--clipboard", "--input"], {stdin: encoded})
        case "tmux":
            spawnProcess("tmux", ["load-buffer", "-w", tmpFile], {})
        case "osc52":
            writeOsc52EscapeSequence(encoded)   // via terminal stdout
        case "wsl" / "windows":
            spawnProcess("powershell.exe",
                ["-NoProfile", "-NonInteractive", "-Command", "Set-Clipboard"],
                {stdin: encoded})
        case "raw+dcs" / "dcs":
            writeDcsWrappedOsc52(encoded)
        case "none":
            returnError("no clipboard mechanism available")

    return success
```

Subprocess timeout (macOS `pbcopy`): 2000 ms (bundle.js:+3607392)
OSC 52 bug warning (VS Code ≤1.124): `"VS Code 1.123/1.124 will mojibake this paste — update to ≥1.125"` — cited by fragment only (bundle.js:+3606453)
tmux sub-command: `"load-buffer"` with flag `"-w"` (bundle.js:+3606681, +3606695)

Analysis basis: CC v2.1.199 bundle.js:+11847244

---

### Temporary Directory Setup — `setupTempDir` (bundle: `z6l`)

For clipboard mechanisms that require a file staging area (e.g., tmux `load-buffer`), a secure temporary directory is created under `CLAUDE_CODE_TMPDIR` or `/tmp` (bundle.js:+3455897).

```
function setupTempDir():
    base = env.CLAUDE_CODE_TMPDIR ?? "/tmp"
    validateTempDir(base)   // checks owner, permissions
    // Warns on owner mismatch: "tempdir_owner_mismatch" (bundle.js:+3456291)
    dir = path.join(base, sessionSubdir)
    fs.mkdirSync(dir, {mode: 0o777})  // 511 decimal (bundle.js:+3456501)
    return dir
```

Directory permission mode: `511` (octal `0o777`) (bundle.js:+3456501)
Temp-dir warning level: `"warn"` / `"tempdir_owner_mismatch"` (bundle.js:+3456284, +3456291)
Environment override advice literal: `"Set CLAUDE_CODE_TMPDIR to a directory you control..."` (bundle.js:+3455972)

Analysis basis: CC v2.1.199 bundle.js:+11847101

---

### OSC 52 Clipboard Path — `osc52Writer` (bundle: `XPn`)

Checks for a known terminal bug before writing the OSC 52 escape sequence.

```
function osc52Writer(encodedData):
    if terminalEnvironment.hasOsc52ClipboardUtf8Bug():
        // uses alternative path j7d to avoid mojibake
        useAlternativeWrite(encodedData)
    else:
        emitOsc52Sequence(encodedData)
```

Analysis basis: CC v2.1.199 bundle.js:+11847360

---

### Config Access Guard — `configGuard` (bundle: `Mt`)

Protects against configuration reads before the config store is initialized.

```
function configGuard(accessor):
    try:
        value = BJo(accessor)
    catch:
        throw Error("Config accessed before allowed.")  // bundle.js:+14383512
    validate(value, GJo, hae)
    return value
```

Analysis basis: CC v2.1.199 bundle.js:+11851211

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (bundle.js:+11851255); `tengu_daemon_config_reload` (bundle.js:+18546460, emitted from daemon-config side path, not the copy core path) |
| Clipboard write | Writes plaintext to system clipboard via platform-native mechanism (pbcopy / wl-copy / xclip / xsel / tmux / OSC 52 / PowerShell) |
| Temporary files | May create staging `.txt` file in `CLAUDE_CODE_TMPDIR` or `/tmp` for tmux-buffer path; temp dir mode 511 (0o777) |
| appState changes | None observed in depth-2 traversal |
| Sound | None observed in depth-2 traversal |
| JSX render | Returns a JSX element via `Aee.jsx` (bundle.js:+11851379) to display confirmation or error in the REPL |
| Hook registration | None observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.199 | Initial analysis |

---

## Common Mistakes

1. **Providing a non-integer or zero argument**: The command calls `Number.isInteger()` on the parsed argument (bundle.js:+11850960). Non-integer values (e.g., `/copy 1.5` or `/copy foo`) are not treated as valid indices; the handler falls back to index 1 or surfaces a parse error.
2. **Invoking `/copy` with no prior assistant turn**: If no assistant message with a `type == "text"` content block exists in the session, the command immediately returns `"No assistant message to copy"` (bundle.js:+11850877) without attempting any clipboard operation.
3. **Using `/copy N` where N exceeds history depth**: The `Math.max` guard (bundle.js:+11846070) clamps the slice offset, but if N is larger than the number of available assistant messages, the earliest available message is selected rather than raising an error.
4. **Running in a VS Code terminal ≤1.124 with OSC 52**: The OSC 52 path includes an explicit bug-check for affected VS Code versions (bundle.js:+3606453); the alternative write path is used, but users should update VS Code to ≥1.125 for reliable Unicode clipboard content.
5. **Missing clipboard utilities on Linux**: The mechanism detection probes for `wl-copy`, `xclip`, and `xsel` in order. If none are installed and OSC 52 is unsupported by the terminal, clipboard writes will silently fail or fall through to `"none"`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `gWf` | Main async handler for `/copy` command (`copyCommandHandler`) |
| `q6l` | Filter conversation messages for assistant role (`filterAssistantMessages`) |
| `_l` | Filter array for text-type content blocks |
| `V6l` | Render assistant message to plaintext string (`renderMessageToPlaintext`) |
| `j6l` | Inner table/column layout renderer used by `V6l` |
| `K6l` | Escape/replace pipe characters in table cell content |
| `cWf` | Lex and tokenize message content (used by `V6l`) |
| `n5o` | Top-level clipboard write dispatcher (`writeToClipboard`) |
| `nL` | Cross-platform clipboard write core |
| `XPn` | OSC 52 clipboard writer with bug-check (`osc52Writer`) |
| `j7d` | OSC 52 alternative write path (bug workaround) |
| `z6l` | Temporary directory setup for file-staging clipboard path (`setupTempDir`) |
| `SS` | Secure temp-dir creation and validation helper |
| `zGi` | Temp-dir lstat/owner/permission check |
| `Zle` | Atomic file write helper (used in temp-file clipboard staging) |
| `Mt` | Configuration access guard (`configGuard`) |
| `BJo` | Configuration store accessor (called by `Mt`) |
| `GJo` | Config validation schema (called by `Mt`) |
| `hae` | Config validation helper (called by `Mt`) |
| `W8i` | Platform detection / clipboard mechanism selector |
| `Jto` | Linux clipboard sub-mechanism selector (wl-copy / xclip / xsel) |
| `Un` | Process spawn utility |
| `V7d` | tmux buffer clipboard writer |
| `Xto` | Kitty/screen terminal environment probe |
| `l3t` | DCS-wrapped OSC 52 writer |
| `Lx` | Raw OSC 52 sequence emitter |
| `Q_` | OSC 52 escape sequence builder |
| `G8i` | Base64 encode for OSC 52 payload |
| `IH` | Terminal output writer (stdout) |
| `a3t` | Terminal capability query helper |
| `lNe` | Token text normalizer / replacer |
| `uWf` | Map message content blocks to text |
| `Wfc` | Daemon status file writer |
| `Qne` | Daemon status serializer |
| `fye` | Status field formatter / trimmer |
| `Qs` | Async-local store accessor |
| `Bnn` | Daemon status path builder (uses `"daemon.status.json"`) |
| `xe` | JSON serializer utility |
| `ln` | Session type descriptor (uses `"background session"`, `"stopped"`) |
| `sn` | Terminal string width calculator (via `Bun.stringWidth`) |
| `gf` | String repeat / padding utility |
| `Ts` | Process shutdown / exit handler |
| `Whe` | Billing/spend-limit response handler |
| `wg` | Markdown/content lexer (uses `vje.parse`) |
| `Iu` | String index-of utility |
| `d2` | Temp path component helper |
| `fks` | Atomic file open/write helper |
| `tPt` | File write with permission preservation |
| `grt` | File sync/flush helper |
| `d_e` | Fallback file write utility |
| `yks` | File property definition utility |
| `pn` | ENOENT-safe stat helper |
| `rn` | Error classification helper |
| `T` | Terminal output / ANSI write function |
| `Lx` | Escape-sequence emitter |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.