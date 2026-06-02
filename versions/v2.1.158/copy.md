---
type: feature-spec
feature: "copy"
cc_version: "2.1.158"
updated: "2026-06-02"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.158 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.158 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.158

---

## Overview

The `/copy` command copies Claude's most recent assistant response to the system clipboard. An optional integer argument `N` selects the Nth-latest assistant message instead (e.g. `/copy 2` copies the second-most-recent reply). The command is platform-aware and delegates to the appropriate native clipboard utility (`pbcopy`, `xclip`/`xsel`/`wl-copy`, or PowerShell) depending on the detected operating system.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | Copy Claude's last response to clipboard (or /copy N for the Nth-latest) |
| loc_byte | `10767582` |
| loc_byte_end | `10767768` |
| loc_line | `6682` |
| module_id | `wN1` |
| load_inline | `true` |
| arbor_handler.name | `fiL` |
| arbor_handler.fqn | `claude-2.1.158::fiL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.158 bundle.js:+10767582

---

## Input Branching

The command has four distinct runtime paths (no argument, valid integer N, invalid non-integer argument, no assistant messages found), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/copy [arg]"]) --> B{Argument provided?}
    B -- No --> C[Use N = 1 — most recent]
    B -- Yes --> D{Is argument a valid integer?}
    D -- No --> E[Return error / ignore non-integer input]
    D -- Yes --> F[Parse N = Number(arg)]
    C --> G[Collect assistant messages from conversation history]
    F --> G
    G --> H{Any assistant messages exist?}
    H -- No --> I["Return: 'No assistant message to copy'"]
    H -- Yes --> J["Select Nth-latest message\n(index = max(0, total - N))"]
    J --> K[Render message content to plain text\nor structured format]
    K --> L[Determine clipboard utility by OS]
    L --> M{Platform?}
    M -- darwin --> N["pbcopy"]
    M -- linux --> O{Wayland? → wl-copy\nxclip available? → xclip -selection clipboard\nFallback → xsel --clipboard --input}
    M -- win32 --> P["powershell -NoProfile -NonInteractive -Command ..."]
    M -- tmux/kitty/screen → Q[Terminal-native clipboard escape sequence]
    N --> R[Write text to clipboard process stdin]
    O --> R
    P --> R
    Q --> R
    R --> S[Emit tengu_copy telemetry]
    S --> T([Done])
    I --> T
    E --> T
```

Analysis basis: CC v2.1.158 bundle.js:+10766767 (handler entry `fiL`), +10766877 (integer parse), +10766808 (no-message error string), +3370171 (pbcopy), +3370197 (linux branch), +3370648 (win32 branch)

---

## Behavioral Spec

### 1. Argument Parsing and Message Selection (`fiL`)

The main async handler (`fiL`, resolved via `module_id` → `wN1`) performs the following steps:

```
async function copyCommandHandler(args, conversationState):
    // Step 1 — collect assistant turns
    assistantMessages = collectAssistantMessages(conversationState)
    // Analysis basis: +10766767

    // Step 2 — parse optional index argument
    rawArg = args.trim()
    if rawArg is empty:
        n = 1
    else:
        candidate = Number(rawArg)
        if not Number.isInteger(candidate):
            // Analysis basis: +10766891
            return errorResult("invalid argument")
        n = candidate

    // Step 3 — guard: no messages
    if assistantMessages.length == 0:
        // Analysis basis: +10766808
        return displayMessage("No assistant message to copy")

    // Step 4 — select target message (1-based from newest)
    targetIndex = Math.max(0, assistantMessages.length - n)
    // Analysis basis: +10761946
    targetMessage = assistantMessages[targetIndex]

    // Step 5 — render to text
    renderedText = renderMessageToText(targetMessage)

    // Step 6 — write to clipboard
    writeToClipboard(renderedText)

    // Step 7 — emit telemetry
    emit("tengu_copy")
    // Analysis basis: +10767186
```

### 2. Message Rendering (`ON1` / content-formatting pipeline)

The function responsible for serialising a conversation message to a copyable string (`ON1`) handles mixed content blocks:

```
function renderMessageToText(message):
    blocks = message.content
    parts = []
    for each block in blocks:
        if block.type == "text":
            parts.push(block.text)
        else if block.type == "code":
            // Analysis basis: +10761642
            parts.push(formatCodeBlock(block))
        else if block.type == "table":
            // Analysis basis: +10762479
            parts.push(formatTable(block))
        else:
            parts.push(stringifyBlock(block))

    // Separator: " | "  (Analysis basis: +10762055)
    return parts.join(" | ")
```

The table formatter (`$N1`) uses column alignment modes `"left"`, `"center"`, `"right"` (Analysis basis: +10762172, +10762090, +10762132) and pads columns using `Bun.stringWidth` for Unicode-aware width calculation (Analysis basis: +10761971 → `H8`). Columns are separated by `" | "` and rows are split on the `\|` pattern (Analysis basis: +10761896).

### 3. Plain-text Fallback (`YN1` / `zN1`)

For content typed as `"plaintext"` (Analysis basis: +10762920), the renderer writes the text with a `.txt`-style treatment (Analysis basis: +10762952). The `zN1` function filters content blocks to only `"text"` typed items (Analysis basis: +10762785, +10465932) and pushes them onto the output buffer (Analysis basis: +10762833).

### 4. Clipboard Transport Layer (`QZ` / `Uo_`)

`Uo_` orchestrates dispatch to the platform clipboard subsystem via `QZ`:

```
function writeToClipboard(text):
    platform = detectPlatform()   // process.platform

    if platform == "darwin":
        // Analysis basis: +3370171
        spawnProcess("pbcopy", [], stdinText=text)

    else if platform == "linux":
        // Wayland first
        if envHas("WAYLAND_DISPLAY"):
            // Analysis basis: +3370236
            spawnProcess("wl-copy", [], stdinText=text)
        else if commandExists("xclip"):
            // Analysis basis: +3370282, +3370303, +3370316
            spawnProcess("xclip", ["-selection", "clipboard"], stdinText=text)
        else:
            // Analysis basis: +3370348, +3370367, +3370381
            spawnProcess("xsel", ["--clipboard", "--input"], stdinText=text)

    else if platform == "win32":
        // Analysis basis: +3370660, +3370674, +3370687, +3370705
        spawnProcess("powershell",
            ["-NoProfile", "-NonInteractive", "-Command", "Set-Clipboard"],
            stdinText=text)

    // Terminal multiplexer / special terminal overrides
    if insideTmux():
        // Analysis basis: +3369738, +3369772, +3369800
        runTmuxLoadBuffer(text)

    if terminalIsKitty():
        // Analysis basis: +3369323
        writeKittyClipboardEscape(text)

    if terminalIsScreen():
        // Analysis basis: +3369208
        writeScreenClipboardEscape(text)

    if terminalIsITerm2():
        // Analysis basis: +3369728
        writeITerm2ClipboardEscape(text)
```

Text encoding before dispatch: `utf8` with `base64` encoding used for OSC-52 escape paths (Analysis basis: +3369901, +3369918). The escape sequence for double-ESC terminals is `\x1b\x1b` (Analysis basis: +3369451 → `YW`).

### 5. Temporary File Helper for Clipboard IPC (`DN1` / `kX`)

When the clipboard backend requires an intermediate file (e.g. some Linux paths), a temporary working directory is resolved via `kX`:

```
function ensureTempDir():
    base = env.CLAUDE_CODE_TMPDIR ?? "/tmp"
    // Analysis basis: +3946900
    dir = path.join(base, "claude-code-clipboard")
    fs.mkdirSync(dir, { recursive: true })
    // chmod 448 (0o700) — Analysis basis: +3947581
    fs.chmodSync(dir, 448)
    return dir
```

If `CLAUDE_CODE_TMPDIR` points to a path not controlled by the current user, an error is thrown with the advisory message `"Set CLAUDE_CODE_TMPDIR to a directory you control, or ask an administrator to remove it."` (Analysis basis: +3946975).

The temp file is written via `vV8.writeFile` and the containing directory is created with `vV8.mkdir` (Analysis basis: +10763023, +10763066).

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (emitted on every successful copy attempt, Analysis basis: +10767186); `tengu_config_parse_error` (config read failure path, +3210888); `tengu_feature_ok` / `tengu_feature_bad` (feature-flag probe, +966033 / +966091); `tengu_bg_*` events (background session infrastructure reachable from shared helpers, not directly triggered by `/copy`) |
| Clipboard side effect | Overwrites the system clipboard with the rendered assistant message text |
| Filesystem side effect | May create a temp directory under `/tmp` (or `$CLAUDE_CODE_TMPDIR`) for clipboard IPC on some Linux paths |
| appState changes | No persistent appState mutation; read-only access to conversation history |
| Sound | None identified |
| Hook registration | None identified in `/copy`-specific code |

---

## Version History

| Version | Change |
|---|---|
| v2.1.158 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy 1.5` or `/copy latest` will fail the `Number.isInteger` check (Analysis basis: +10766891) and produce no output; only whole-number indices are accepted.
2. **Expecting 0-based indexing** — The argument is 1-based from the newest message: `/copy 1` is the most recent, `/copy 2` is the second-most-recent.
3. **Clipboard tool not installed on Linux** — The command tries `wl-copy` → `xclip` → `xsel` in order; if none of these utilities are present and `WAYLAND_DISPLAY` is unset, the copy will fail silently or with an OS-level error.
4. **Running inside tmux without X11/Wayland** — tmux's `load-buffer` path is used in parallel with the OS clipboard tool; if neither is accessible the clipboard write will not reach the user's desktop clipboard.
5. **Using `/copy` on an empty conversation** — If no assistant turns exist yet, the command returns the literal string `"No assistant message to copy"` (Analysis basis: +10766808) and writes nothing to the clipboard.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `fiL` | Main async handler for `/copy` command (Arbor-resolved entry point) |
| `ON1` | Message content renderer — converts message blocks to copyable text |
| `$N1` | Table block formatter with column alignment support |
| `_iL` | Column/row splitting helper used by table formatter |
| `HiL` | Code block renderer (handles `"code"` typed content blocks) |
| `ijH` | Code block text normaliser (replaces escape sequences) |
| `zN1` | Plain-text content filter (selects `"text"` typed blocks only) |
| `YN1` | Plaintext mode renderer |
| `jK` | Content block type filter |
| `Uo_` | Clipboard dispatch orchestrator |
| `QZ` | Platform-specific clipboard backend selector |
| `GD_` | Clipboard write helper (generic pipe-to-process) |
| `FD` | Low-level process spawn for clipboard tools |
| `z77` | OS platform detection and routing |
| `v8` | Clipboard command builder |
| `M77` | Alternative clipboard path builder |
| `Wdq` | Terminal escape sequence writer (base helper) |
| `YW` | Double-ESC terminal escape path (screen/tmux variant) |
| `ZJ` | Join helper for escape sequence assembly |
| `f77` | Escape sequence formatter |
| `H7` | String index utility |
| `DN1` | Temporary file orchestrator for clipboard IPC |
| `kX` | Temp directory resolver and permission setter |
| `xx` | Temp path component builder |
| `qJ7` | Directory validation and chmod helper |
| `S6` | Configuration file loader (shared helper, reached via clipboard path) |
| `szH` | Config file reader with backup logic |
| `RFq` | Config backup directory resolver |
| `fY_` | Path join helper for config backups |
| `Qb` | Config value prefix stripper |
| `p6` | JSON parse wrapper |
| `N` | Logging/output helper (reached from config path) |
| `lCK` | Log formatter |
| `v4` | Log line builder |
| `EuH` | Error notification helper |
| `rCK` | File write helper used during config persistence |
| `g6` | Config accessor |
| `HY_` | Config schema validator |
| `m17` | File watcher registration for config |
| `Vr` | Config change event emitter |
| `q9` | Cleanup/unregister helper |
| `$s1` | Daemon status helper |
| `ii` | Session identifier resolver |
| `s1H` | Status string formatter |
| `s9` | AsyncLocalStorage store accessor |
| `pk6` | Status file path builder |
| `RH` | JSON serialiser wrapper |
| `O` | Daemon state object |
| `I8` | Background session status constant mapper |
| `H8` | Unicode-aware string width calculator (wraps `Bun.stringWidth`) |
| `nS6` | Plugin path normaliser |
| `iS6` | Plugin sync path builder |
| `w` | Background worker / daemon manager |
| `S` | Worker process wrapper |
| `bH` | Feature flag bad-state handler |
| `hH` | Feature flag ok-state handler |
| `By8` | Memory usage sampler |
| `fw6` | Background session config reader |
| `SH` | Log flush / error reporter |
| `B` | MCP tool session filter |
| `G6` | Config-aware session loader |
| `jfA` | Background session connection helper |
| `ZfA` | Background session lifecycle manager |
| `D` | Daemon health-check loop |
| `L$` | Lexer/tokeniser for message content |
| `YNH` | Parser for structured content |

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.