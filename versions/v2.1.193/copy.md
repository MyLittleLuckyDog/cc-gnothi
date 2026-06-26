---
type: feature-spec
feature: "copy"
cc_version: "2.1.193"
updated: "2026-06-26"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.193 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.193 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.193

---

## Overview

The `/copy` command copies Claude's last assistant response to the system clipboard. An optional integer argument `N` selects the Nth-latest assistant message instead of the most recent one. The command renders a JSX confirmation element and dispatches a platform-appropriate clipboard write operation.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| loc_byte | `11395148` |
| loc_byte_end | `11395334` |
| loc_line | `7165` |
| module_id | `vIl` |
| load_inline | `true` |
| arbor_handler.name | `imf` |
| arbor_handler.fqn | `claude-2.1.193::imf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.193 bundle.js:+11395148

---

## Input Branching

The command has four distinct branches based on the argument and conversation state:

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument provided?}
    B -- No --> C[Default: index = 1\n(most recent assistant message)]
    B -- Yes --> D{Is arg a valid integer?}
    D -- No --> E[Error: 'No assistant message to copy'\nbundle.js:+11394373]
    D -- Yes --> F[index = Number(arg)\nbundle.js:+11394442]
    C --> G{Assistant messages exist\nin conversation?}
    F --> G
    G -- No --> H[Return error UI:\n'No assistant message to copy'\nbundle.js:+11394373]
    G -- Yes --> I[Extract Nth-latest\nassistant message text]
    I --> J[Dispatch clipboard write\nvia platform-appropriate method]
    J --> K[Emit tengu_copy telemetry\nbundle.js:+11394751]
    K --> L[Return JSX confirmation element]
```

---

## Behavioral Spec

### Main Handler: `copyCommandHandler` (bundle ident: `imf`)

The Arbor-resolved handler is `imf` (AsyncFunction, resolved via `module_id` path).

Analysis basis: CC v2.1.193 bundle.js:+11394332

```
async function copyCommandHandler(commandInput, appContext):
    # Step 1: Parse the argument
    rawArg = commandInput.args.trim()

    # Step 2: Collect assistant messages from conversation history
    assistantMessages = filterAssistantMessages(appContext.messages)
    # Uses TIl (messageFilterFn) which calls Kl (filterByRole)
    # Kl filters for role == "text" / assistant content blocks
    # bundle.js:+11394332, +11390409, +11390441

    # Step 3: Validate that messages exist
    if assistantMessages is empty:
        return errorJSX("No assistant message to copy")
        # literal: bundle.js:+11394373

    # Step 4: Determine index (1-based, counting from most recent)
    if rawArg is non-empty AND Number.isInteger(Number(rawArg)):
        index = Number(rawArg)
        # bundle.js:+11394442, +11394456
    else:
        index = 1  # default: most recent

    # Step 5: Resolve the target message (Nth-latest)
    targetMessage = assistantMessages[assistantMessages.length - index]
    if targetMessage is undefined:
        return errorJSX("No assistant message to copy")

    # Step 6: Extract plain text from the message content
    textContent = extractPlainText(targetMessage)
    # Uses bIl (messageTextExtractor) → AIl (contentBlockRenderer)
    # bundle.js:+11394686, +11390157

    # Step 7: Write to clipboard
    await writeToClipboard(textContent)
    # Uses lRo (clipboardWriter) → jv (platformClipboard)
    # bundle.js:+11394840, +11390756

    # Step 8: Emit telemetry
    emitTelemetry("tengu_copy", { message: "message", messages: "messages" })
    # bundle.js:+11394751

    # Step 9: Return JSX confirmation
    return renderJSX(WJ.jsx, confirmationElement)
    # bundle.js:+11394875
```

---

### Sub-feature: Message Text Extraction (`bIl` / `AIl`)

Responsible for converting structured message content blocks into plain text suitable for clipboard output.

Analysis basis: CC v2.1.193 bundle.js:+11390157, +11389489

```
function extractMessageText(messageContentBlocks):
    # Uses a markdown/table lexer (zm.lexer / w4e.parse) on each block
    # bundle.js:+11389990

    result = []
    for block in messageContentBlocks:
        if block.type == "text":
            rendered = renderContentBlock(block)
            # AIl calls tmf for column/table formatting
            # bundle.js:+11389489
            result.push(rendered)

    # Join blocks, replacing pipe-escaped sequences
    combined = result.join(" | ")   # literal: bundle.js:+11389691
    combined = combined.replace("\\|", "|")   # literal: bundle.js:+11389532

    return combined

function renderContentBlock(block):
    # AIl builds a columnar representation when content has table structure
    # Alignment modes: "center", "left", "right"
    # literals: bundle.js:+11389726, +11389800, +11389764
    # Uses tn (terminalStringWidth via Bun.stringWidth) for column sizing
    # bundle.js:+11389607
    # Uses xf (repeatChar) guarded by Number.isFinite
    # bundle.js:+11389745, +203092
    # Column separator width: 3 (literal: bundle.js:+11389591)
    # Math.max used for column width normalization: bundle.js:+11389582
    return formattedText
```

---

### Sub-feature: Output Format Classification (`IIl` / `TIl`)

Before extraction, each content block is classified to determine rendering mode.

Analysis basis: CC v2.1.193 bundle.js:+11390409, +11390504, +11390544

```
function classifyOutputFormat(contentBlock):
    if Array.isArray(contentBlock):
        # Push into structured message accumulator (TIl)
        # bundle.js:+11390409, +11390457
        # Kl filters for "text" role: bundle.js:+13884666, +13884689
        return "message"

    # IIl handles string replacement for plaintext normalization
    # bundle.js:+11390504
    # Format label "plaintext": bundle.js:+11390544
    # Format label "table": bundle.js:+11390103
    return "plaintext"
```

---

### Sub-feature: Platform Clipboard Write (`lRo` / `jv`)

Determines the correct OS-level mechanism for writing to the clipboard. This is a multi-platform dispatcher.

Analysis basis: CC v2.1.193 bundle.js:+11390756, +11390797, +11390872, +11390895

```
async function writeToClipboard(text):
    # lRo orchestrates clipboard strategy selection

    # Strategy 1: OSC 52 escape sequence (terminal-native)
    # jv encodes text as base64 and emits OSC 52: bundle.js:+3540936
    # RWr builds the raw OSC escape: bundle.js:+3539025
    # Mvn checks for VS Code OSC52 UTF-8 bug (versions 1.123/1.124):
    #   literal warning: "VS Code 1.123/1.124 will mojibake this paste — update to ≥1.125"
    #   bundle.js:+3540382
    # q1.hasOsc52ClipboardUtf8Bug guard: bundle.js:+3540325

    # hu resolves the terminal type (e.indexOf check): bundle.js:+11390797, +204775

    terminalType = detectTerminal()

    if terminalType == "kitty":      # bundle.js:+3539575
        # Use Kitty escape: Eki → Xh: bundle.js:+3539567, +3538976
        strategy = "raw+dcs"         # bundle.js:+3541034

    elif terminalType == "screen":   # bundle.js:+3539106
        strategy = "dcs"             # bundle.js:+3541057

    elif terminalType == "tmux":     # bundle.js:+3540602
        # tmux load-buffer -w: bundle.js:+3540610, +3540624
        strategy = "tmux-buffer"     # bundle.js:+3539975
        # IL handles replaceAll for escape sequence normalization: bundle.js:+3539683

    else:
        strategy = "osc52"           # bundle.js:+3539995

    if strategy in ["raw+dcs", "dcs", "osc52", "tmux-buffer"]:
        emitEscapeSequence(text, strategy)
    else:
        strategy = "none"            # bundle.js:+3541108

    # Strategy 2: Native OS clipboard tool (Ski / kWr)
    # Used as fallback or primary on supported platforms
    # bundle.js:+3541334, +3540027

    platform = detectPlatform()

    if platform == "macos":          # bundle.js:+3541344
        spawn("pbcopy", [], text)    # bundle.js:+3541355
        # timeout: 2000ms: bundle.js:+3541321

    elif platform == "linux":        # bundle.js:+3540034
        # Try in order: wl-copy, xclip, xsel
        # wl-copy: bundle.js:+3540113
        # xclip -selection clipboard: bundle.js:+3540182, +3541584
        # xsel --clipboard --input: bundle.js:+3540223, +3541671, +3541685
        # --primary option available: bundle.js:+3541521
        spawn(preferredLinuxTool, args, text)

    elif platform == "wsl":          # bundle.js:+3541747
        # powershell.exe -NoProfile -NonInteractive -Command ...
        # bundle.js:+3541757, +3541775, +3541788, +3541806
        spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ...], text)

    elif platform == "windows":      # bundle.js:+3541836
        spawn("powershell", [...], text)   # bundle.js:+3541850

    # Strategy 3: Temp-file + atomic write path (CIl / sIr / BA)
    # CIl creates a secure temp directory: bundle.js:+11390895, +11390613
    # BA validates temp dir ownership (CLAUDE_CODE_TMPDIR or /tmp):
    #   literal: bundle.js:+3395243
    #   chmod mode 448 (0o700): bundle.js:+3396037
    #   chmod mode 511 (0o777): bundle.js:+3395847
    #   warning: "Set CLAUDE_CODE_TMPDIR to a directory you control..."
    #   bundle.js:+3395318
    # sIr performs atomic write: readlink → realpath → open → writeFile → sync
    #   → rename, with fallback for EACCES/ELOOP/ENOTDIR errors
    #   bundle.js:+1105330 – +1107696
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (bundle.js:+11394751) — fired once per successful copy invocation |
| Telemetry (indirect) | `tengu_daemon_config_reload` (bundle.js:+17498707), `tengu_config_parse_error` (bundle.js:+13977384), `tengu_mcp_skills` (bundle.js:+6781017) — fired by subsystems traversed in depth-2 call graph, not directly by `/copy` |
| Clipboard write | Writes plain text of the selected assistant message to the OS clipboard via OSC 52 escape sequence or platform native tool (`pbcopy`, `wl-copy`, `xclip`, `xsel`, `powershell.exe`) |
| Temp file | May create a temp file under `CLAUDE_CODE_TMPDIR` or `/tmp` during atomic write operations; cleaned up via `sIr` unlink logic (bundle.js:+1107391) |
| appState changes | No persistent appState mutation observed in depth-2 traversal |
| Hook registration | No hook registration directly observed |
| Sound | None observed |
| JSX render | Returns a JSX element via `WJ.jsx` (bundle.js:+11394875) for inline UI feedback |

---

## Version History

| Version | Change |
|---|---|
| v2.1.193 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument**: Providing `/copy foo` will fail the `Number.isInteger` check (bundle.js:+11394456) and fall through to the "No assistant message to copy" error, not silently default to index 1.
2. **Expecting zero-based indexing**: The index `N` in `/copy N` is 1-based and counts from the most recent assistant message backward. `/copy 1` is the default (most recent); `/copy 2` is the second-most-recent.
3. **No messages in session**: Running `/copy` at the very start of a session (before Claude has responded) returns the error `"No assistant message to copy"` (bundle.js:+11394373) rather than hanging.
4. **Clipboard tool not installed on Linux**: If none of `wl-copy`, `xclip`, or `xsel` is available and the terminal does not support OSC 52, the clipboard write will silently fail or fall back to a limited escape-sequence path. Users should ensure at least one native clipboard tool is installed.
5. **VS Code terminal OSC 52 bug**: Versions 1.123 and 1.124 of VS Code have a known UTF-8 mojibake bug with OSC 52 clipboard pastes (bundle.js:+3540382). Users on those versions should upgrade to VS Code ≥ 1.125 or use the native tool fallback.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `imf` | Main async handler for `/copy` command (Arbor-resolved entry point) |
| `TIl` | Content block classifier / array branch handler |
| `Kl` | Message filter by role (filters for assistant "text" blocks) |
| `bIl` | Message text extractor (top-level, calls `AIl`) |
| `AIl` | Content block renderer (handles table/column formatting) |
| `tmf` | Column table formatter helper (called by `AIl`) |
| `IIl` | Plaintext string replacement normalizer |
| `emf` | Alternate message renderer (uses markdown lexer `zm`) |
| `BMe` | String replace helper for markdown normalization |
| `zm` | Markdown lexer dispatcher (wraps `w4e.parse`) |
| `lRo` | Clipboard write orchestrator (selects strategy) |
| `jv` | Platform clipboard dispatcher (OSC 52 + native tool) |
| `Mvn` | OSC 52 UTF-8 bug detector (VS Code 1.123/1.124 guard) |
| `XTd` | OSC 52 sequence builder (post-bug-check path) |
| `MOt` | OSC 52 raw sequence constructor |
| `Xh` | Escape sequence emitter (writes to terminal stdout) |
| `Ski` | macOS `pbcopy` clipboard writer |
| `Pn` | Process spawner for clipboard tools |
| `kWr` | Linux clipboard tool selector (`wl-copy`, `xclip`, `xsel`) |
| `JTd` | Clipboard spawn result handler |
| `RWr` | Raw OSC escape sequence builder |
| `DOt` | DCS-wrapped OSC 52 builder |
| `IL` | tmux escape sequence replaceAll normalizer |
| `wE` | Kitty clipboard escape builder |
| `Eki` | Kitty raw escape emitter |
| `hu` | Terminal type detector (`e.indexOf`) |
| `CIl` | Secure temp directory manager for clipboard file path |
| `BA` | Temp directory validator and chmod enforcer |
| `Cxi` | Temp dir ownership/stat checker |
| `sIr` | Atomic file writer (open → writeFile → sync → rename) |
| `mJe` | File sync error handler (EINVAL/ENOTSUP/EPERM/ENOSYS) |
| `In` | General async error handler |
| `Ops` | Object.defineProperty wrapper utility |
| `AIl` | Content block column layout renderer |
| `tn` | Terminal string width calculator (`Bun.stringWidth`) |
| `xf` | Character repeat utility (guarded by `Number.isFinite`) |
| `yn` | String replace utility (called by content pipeline) |
| `iee` | Message content extractor helper |
| `Yge` | Text trim + length utility (1000ms timeout literal nearby) |
| `C8l` | Daemon status reader (`daemon.status.json`) |
| `v7t` | Status file path joiner |
| `ke` | JSON serializer (`JSON.stringify`) |
| `qs` | App store accessor (`Kqu.getStore`) |
| `Is` | Process exit handler (emits `cli_error`) |
| `V` | Telemetry emit function (used by `imf` at `tengu_copy`) |