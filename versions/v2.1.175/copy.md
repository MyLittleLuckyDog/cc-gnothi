---
type: feature-spec
feature: "copy"
cc_version: "2.1.175"
updated: "2026-06-12"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.175 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.175 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.175

---

## Overview

The `/copy` command copies Claude's most recent assistant response to the system clipboard. An optional numeric argument (`/copy N`) selects the Nth-latest assistant message instead of the most recent one. The command dispatches to a platform-specific clipboard backend (macOS `pbcopy`, Linux `wl-copy`/`xclip`/`xsel`, WSL/Windows PowerShell, tmux buffer, or OSC-52 terminal escape sequence) to perform the actual write.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| loc_byte | `11290101` |
| loc_byte_end | `11290287` |
| loc_line | `7408` |
| module_id | `Kaq` |
| load_inline | `true` |
| arbor_handler.name | `Ry7` |
| arbor_handler.fqn | `claude-2.1.175::Ry7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.175 bundle.js:+11290101

---

## Input Branching

Four distinct branches exist: no argument (copy most recent), numeric argument (copy Nth-latest), invalid/non-integer argument (error), and no assistant messages at all (error). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument present?}
    B -- No --> C[index = 1\n(most recent)]
    B -- Yes --> D{Is arg a valid integer?}
    D -- No --> E[Return error:\nbad argument type]
    D -- Yes --> F[index = Number(arg)]
    C --> G[Collect assistant messages\nfrom conversation history]
    F --> G
    G --> H{Any assistant messages found?}
    H -- No --> I[Return error:\n'No assistant message to copy'\nbundle.js:+11289327]
    H -- Yes --> J[Select message at\nposition: messages.length - index]
    J --> K[Extract plain-text content\nfrom message blocks]
    K --> L[Resolve clipboard backend\nfor current platform]
    L --> M{Platform / terminal type?}
    M -- macOS --> N[pbcopy\nbundle.js:+3511169]
    M -- Linux / wl-clipboard --> O[wl-copy\nbundle.js:+3510226]
    M -- Linux / xclip --> P[xclip -selection clipboard\nbundle.js:+3510295]
    M -- Linux / xsel --> Q[xsel --clipboard --input\nbundle.js:+3510336]
    M -- WSL / Windows --> R[powershell.exe Set-Clipboard\nbundle.js:+3511535]
    M -- tmux --> S[tmux load-buffer\nbundle.js:+3510467]
    M -- OSC-52 capable terminal --> T[Write OSC-52 escape sequence\nbundle.js:+3510117]
    N & O & P & Q & R & S & T --> U[Emit tengu_copy telemetry\nbundle.js:+11289705]
    U --> V[Return success to UI]
```

---

## Behavioral Spec

### Argument parsing (`_aq` / argument-validator)

```
function parseArgument(rawArg):
    if rawArg is not an array or is empty:
        return { index: 1, error: null }   // default: most-recent

    token = first element of rawArg
    n = Number(token)

    if not Number.isInteger(n):
        return { index: null, error: "invalid argument" }

    return { index: n, error: null }
```

Analysis basis: CC v2.1.175 bundle.js:+11285304 (`_aq`), +11289396 (`Number`), +11289410 (`Number.isInteger`)

---

### Message lookup (`Haq` / message-selector)

```
function selectAssistantMessage(conversationMessages, index):
    // Filter to assistant-role messages only
    assistantMessages = conversationMessages.filter(
        msg => msg.role === "assistant"   // literal "assistant" +11285234
    )

    if assistantMessages is empty:
        return null   // triggers "No assistant message to copy" error

    // index 1 = most recent, 2 = second-most-recent, etc.
    target = assistantMessages[ assistantMessages.length - index ]
    return target
```

Analysis basis: CC v2.1.175 bundle.js:+11284931 (`H.indexOf`), +11285052 (`eoq` call), +11285063 (`A.slice`)

---

### Text extraction (`eoq` / content-extractor)

The extractor walks the content blocks of the selected message, collecting only blocks whose type is `"text"` (literal at +11038036). Table-formatted blocks (type `"table"`, +11284998) and plaintext blocks (type `"plaintext"`, +11285439) undergo separate rendering paths. The final plain-text fragments are joined and returned as a single string.

```
function extractText(messageBlocks):
    parts = []

    for block in messageBlocks:
        if block.type === "text":
            parts.push(block.text)
        elif block.type === "table":
            parts.push(renderTable(block))   // uses hy7 / table-renderer
        elif block.type === "plaintext":
            parts.push(block.content)

    return parts.join("")
```

Analysis basis: CC v2.1.175 bundle.js:+11284337 (`hy7` / table-renderer called via `_.map`), +11284388 (`$.map`), +11284399 (`O.replace`), +11284415 (`"\\|"` pipe escape literal)

---

### Table rendering helper (`hy7` / table-renderer)

```
function renderTable(tableBlock):
    // Determine column widths using Bun.stringWidth for correct Unicode width
    colWidths = tableBlock.columns.map(col => measureWidth(col))   // q8 / width-measurer
    colWidths = colWidths.map(w => Math.max(w, 3))                 // minimum 3 wide

    rows = tableBlock.rows.map(row =>
        row.cells.map((cell, i) =>
            padCell(cell, colWidths[i], getAlignment(cell))
        ).join(" | ")   // literal " | " at +11284574
    )

    return rows.join("\n")

function getAlignment(cellMeta):
    // Returns one of: "center" (+11284609), "right" (+11284651), "left" (+11284691)
    return cellMeta.align ?? "left"
```

Analysis basis: CC v2.1.175 bundle.js:+11284465 (`Math.max`), +11284474 (minimum column width `3`), +11284479 (`_.map`), +11284490 (`q8`)

---

### Clipboard dispatch (`TT` / clipboard-writer and `N7A` / platform-resolver)

```
async function writeToClipboard(text):
    platform = resolvePlatform()   // N7A / platform-resolver

    if platform === "macos":
        spawnProcess("pbcopy", [], { stdin: text })         // +3511169

    elif platform === "linux":
        if wayland available:
            spawnProcess("wl-copy", [], { stdin: text })    // +3510226
        elif xclip available:
            spawnProcess("xclip", ["-selection", "clipboard"], { stdin: text })   // +3510295
        elif xsel available:
            spawnProcess("xsel", ["--clipboard", "--input"], { stdin: text })     // +3510336

    elif platform === "wsl":
        spawnProcess("powershell.exe",
            ["-NoProfile", "-NonInteractive", "-Command", "Set-Clipboard"],
            { stdin: text })                                 // +3511535

    elif terminal === "tmux":
        spawnProcess("tmux", ["load-buffer", "-w", "-"], { stdin: text })  // +3510467, +3510501

    elif terminalSupportsOSC52:
        writeOSC52EscapeSequence(text)                      // +3510117

    timeout = 2000ms                                         // +3511135
    await processWithTimeout(timeout)
```

Analysis basis: CC v2.1.175 bundle.js:+11285650 (`TT` entry), +3510764 (`A06`), +3510770 (`tK9`), +3511219 (`jN_`), +3511234 (recursive `tK9`)

---

### Main handler (`Ry7`)

```
async function handleCopyCommand(context):
    { index, error } = parseArgument(context.args)    // _aq

    if error:
        return renderError(error)

    messages = context.appState.messages               // literal "messages" +11289591
    target = selectAssistantMessage(messages, index)   // Haq

    if target is null:
        return renderError("No assistant message to copy")   // +11289327

    text = extractText(target.content)                 // eoq

    await writeToClipboard(text)                       // TT via N7A

    emit telemetry("tengu_copy")                       // +11289705

    return renderSuccess()
```

Analysis basis: CC v2.1.175 bundle.js:+11289286 (`_aq` call), +11289325 (`H` message state), +11289640 (`Haq` call), +11289652 (`Ny7` / lexer helper), +11289661 (`C6` / config-reader), +11289703 (`d`), +11289794 (`N7A` call)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (bundle.js:+11289705) — fired after every successful clipboard write |
| Clipboard | Writes to the system clipboard via a platform-specific subprocess or OSC-52 escape |
| appState reads | Reads `context.appState.messages` (literal `"messages"` at +11289591) to locate assistant turns |
| appState writes | None — read-only access to conversation history |
| Subprocess spawn | Spawns one of: `pbcopy`, `wl-copy`, `xclip`, `xsel`, `powershell.exe`, `tmux` with 2 000 ms timeout (+3511135) |
| Hook registration | None identified at depth-2 traversal |
| Sound | None identified |

---

## Version History

| Version | Change |
|---|---|
| v2.1.175 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy foo` will fail argument validation (`Number.isInteger` check at +11289410). Only integer values are accepted.
2. **Using index 0 or a negative number** — The array indexing (`messages.length - index`) produces an out-of-bounds or unintended position. Always use a positive integer ≥ 1.
3. **Expecting HTML/markdown in the clipboard** — The command strips content to plain text. Rendered markdown, code fences, and table pipes are the only formatting preserved.
4. **Running in a headless/SSH environment without OSC-52** — If no clipboard binary (`pbcopy`, `wl-copy`, etc.) is available and the terminal does not support OSC-52, the copy will silently fail or error. Use a terminal that supports OSC-52 in such environments.
5. **Forgetting that index 1 is the most recent** — `/copy 2` retrieves the second-most-recent assistant message, not the second message overall.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Ry7` | Main handler for `/copy` (AsyncFunction, resolved via `module_id` path) |
| `_aq` | Argument validator / parser |
| `Haq` | Assistant-message selector (filters by role, slices by index) |
| `eoq` | Content extractor (walks message blocks, joins text fragments) |
| `hy7` | Table-block renderer (maps columns to padded strings) |
| `q8` | Unicode string-width measurer (wraps `Bun.stringWidth`) |
| `Aaq` | Text post-processor (applies `.replace` on extracted text) |
| `Zf` | Text-block filter (filters blocks by type `"text"`) |
| `Ny7` | Lexer helper called from main handler (uses `o3.lexer`) |
| `gWH` | Regex-replace helper used by lexer (`H.replace`) |
| `N7A` | Platform resolver for clipboard backend selection |
| `TT` | Clipboard writer dispatcher |
| `A06` | Platform-detection utility used by clipboard writer |
| `tK9` | Clipboard-write executor (spawns child process, recursive retry) |
| `b8` | Process spawn helper (`c_`, `b6`) |
| `jN_` | Secondary clipboard spawn path (Linux backends) |
| `dF4` | Argument-joining helper for clipboard command construction |
| `DN_` | Alternative clipboard method resolver |
| `q06` | Clipboard strategy selector |
| `F0` | Text sanitiser used before clipboard write (`H.replaceAll`) |
| `bY` | OSC-52 / kitty escape-sequence path |
| `sK9` | Kitty-terminal clipboard helper |
| `R4` | String-search utility (`H.indexOf`) |
| `qaq` | Temporary-file writer for clipboard fallback |
| `NJ` | Secure temp-directory creator for clipboard fallback |
| `lm` | Temp-dir path helper |
| `DY9` | Temp-directory permission verifier (`lstatSync`, `chmodSync`) |
| `o3` | Markdown lexer wrapper (`aSH.parse`) |
| `C6` | Global config reader |
| `U7H` | Config file loader (reads JSON, handles ENOENT) |
| `d6` | JSON parser wrapper |
| `kLH` | Text-trim helper (calls `_.trim`, uses 1 000 ms threshold +2279044) |
| `Ls` | Message-formatting utility |
| `hjK` | Daemon-status helper (reads `daemon.status.json` +13046550) |
| `Rp6` | Status-file path builder (`NjK.join`) |
| `RH` | JSON serialiser wrapper (`JSON.stringify`) |
| `n9` | AsyncLocalStorage store reader (`hB4.getStore`) |
| `DCH` | MCP server connection manager |
| `Vi` | MCP server configuration applier |
| `ze` | MCP config layer merger |
| `yg` | MCP SDK-type entry builder |
| `cX8` | MCP error colour formatter |
| `bV6` | MCP SSE/HTTP client builder |
| `eV` | MCP event emitter helper |
| `fw` | MCP state persistence helper |
| `Hi9` | MCP connection hash/fingerprint builder |
| `gg_` | MCP store accessor |
| `l2H` | MCP tool-hash computer (`yQ9.createHash`) |
| `SJ8` | MCP schema-hash computer |
| `RJ8` | MCP reconnect-hash computer |
| `rX` | Hash serialiser (`Hu9.createHash`) |
| `yJ8` | MCP stub builder (`Sf`) |
| `Sf` | MCP tool-stub factory (`Mh1`) |
| `z8` | MCP debug logger (`ua.logMCPDebug`) |
| `DP8` | MCP individual-server connector |
| `hi` | MCP reconnect orchestrator |
| `su` | Process-termination helper (`tK`) |
| `YL` | MCP error logger (`ua.logMCPError`) |
| `TH` | String coercion wrapper |
| `IEL` | SSH-detection / OAuth URL builder |
| `jP8` | MCP OAuth tool injector |
| `lH6` | KP8 map getter |
| `iH6` | fP8 map getter |
| `$i9` | MCP post-connection updater |
| `Y28` | Needs-auth cache path builder (`mcp-needs-auth-cache.json`) |
| `$F_` | MCP client finaliser |
| `nN` | MCP skills telemetry emitter (`tengu_mcp_skills`) |
| `z6` | MCP skills collector |
| `oB_` | MCP tool-visibility checker |
| `X8` | Background retry scheduler |
| `Ki9` | Connection-slot reconciler |
| `W66` | Slot-index parser (`parseInt`, radix 10) |
| `D28` | Connection-attempt counter parser |
| `ki8` | MCP connection-result applier |
| `YCH` | MCP config-change detector |
| `AG` | MCP cleanup-and-reconnect helper |
| `X66` | MCP client-hash comparator |
| `sGA` | MCP server-map updater |
| `tX8` | MCP transport-type checker |
| `i8` | Timeout-with-abort helper |
| `N` | Telemetry feature-flag emitter |
| `J9f` | Feature-flag loader |
| `BvA` | Feature-flag parser |
| `nf` | Log-file path builder |
| `WIA` | Log-level mapper |
| `mgH` | Log writer (`LIA`) |
| `LIA` | Low-level log-write (`H.write`) |
| `G9f` | Log-file rotation manager |
| `$gH` | Log-line batcher (uses `clearTimeout`, `setTimeout`, `setImmediate`) |
| `L4H` | Log-path resolver |
| `l36` | Log error handler |
| `EIA` | Log-directory path builder |
| `je8` | Log-file rename/rotate helper |
| `W9f` | Log-file append helper |
| `u9` | Signal-handler registrar (`pvA.register`) |
| `D` | Background-session manager |
| `b` | Background-session runner |
| `CH` | Feature-ok telemetry emitter |
| `kH` | Feature-bad telemetry emitter |
| `ng8` | Low-memory checker |
| `UG6` | CPU/memory stats reader |
| `SH` | Error-log dispatcher (`ua.logError`) |
| `Q` | Background-process lifecycle manager |
| `dTA` | Daemon socket-claim helper |
| `oTA` | Background-session orchestrator |
| `A6` | Build-info bundle |
| `sp4` | Config file-watcher |
| `yF` | Config-change debouncer |
| `o6` | OS homedir resolver |
| `d` | App-state store |
| `B` | Resource-disposer |
| `E8` | Event-emitter base |

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.