---
type: feature-spec
feature: "copy"
cc_version: "2.1.183"
updated: "2026-06-19"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.183 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.183 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.183

---

## Overview

`/copy` copies Claude's most recent assistant response to the system clipboard. When invoked with a numeric argument (`/copy N`), it instead copies the Nth-latest assistant message from the current conversation. The command locates assistant messages in the conversation history, extracts their text content, and writes the result to the clipboard using a platform-appropriate mechanism.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `Asl` |
| load_inline | `true` |
| loc_byte | `11252433` |
| loc_byte_end | `11252619` |
| loc_line | `6950` |
| arbor_handler.name | `zGp` |
| arbor_handler.fqn | `claude-2.1.183::zGp` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.183 bundle.js:+11252433

---

## Input Branching

Four distinct branches exist depending on argument presence/validity and assistant-message availability, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/copy invoked"] --> B{Argument provided?}
    B -- No --> C[Index = 1 (latest)]
    B -- Yes --> D{Parse as integer via Number()}
    D -- Not a valid integer --> E[Show error: invalid argument]
    D -- Valid integer N --> F[Index = N]
    C --> G{Conversation has assistant messages?}
    F --> G
    G -- No --> H["Output: 'No assistant message to copy'"]
    G -- Yes --> I[Filter messages for role='assistant']
    I --> J[Extract Nth-latest message by index]
    J --> K{Extract text content from message}
    K --> L[Normalize text via content-extraction helper]
    L --> M[Write to clipboard via platform writer]
    M --> N{Platform detection}
    N -- macOS --> O["pbcopy"]
    N -- Linux/Wayland --> P["wl-copy"]
    N -- Linux/X11 xclip --> Q["xclip -selection clipboard"]
    N -- Linux/X11 xsel --> R["xsel --clipboard --input"]
    N -- tmux --> S["tmux load-buffer -w"]
    N -- WSL/Windows --> T["powershell.exe Set-Clipboard"]
    N -- OSC52/terminal --> U["OSC52 escape sequence"]
    O & P & Q & R & S & T & U --> V[Emit tengu_copy telemetry]
    V --> W[Return success to UI]
    E --> X[Return error to UI]
    H --> X
```

---

## Behavioral Spec

### Main Handler — Argument Parsing and Message Selection

The Arbor-resolved handler is `zGp` (AsyncFunction). It receives the raw command input string and the current conversation context.

Analysis basis: CC v2.1.183 bundle.js:+11251613

```
async function copyCommandHandler(inputString, conversationContext):
    # Step 1: validate and parse optional numeric argument
    contentFilterResult = filterMessagesByType(inputString)   # psl
    rawArg = extractArgument(inputString)                     # e

    if rawArg is present and non-empty:
        index = Number(rawArg)
        if not Number.isInteger(index):
            return errorResult("invalid argument: expected integer")
    else:
        index = 1   # default: most recent

    # Step 2: retrieve conversation messages
    messages = conversationContext.messages   # literal key "messages" @ +11251918

    # Step 3: filter for assistant messages
    assistantMessages = messages.filter(m => m.role == "assistant")
                                              # literal "assistant" @ +11247560

    if assistantMessages is empty:
        return displayMessage("No assistant message to copy")
                                              # literal @ +11251654

    # Step 4: select Nth-latest (1-based, counting from most recent)
    target = assistantMessages[ assistantMessages.length - index ]

    # Step 5: extract plain text content
    textContent = extractTextContent(target)  # psl / Cc path

    # Step 6: write to clipboard
    writeToClipboard(textContent)             # t_o -> zv -> platform dispatch

    # Step 7: emit telemetry
    emit("tengu_copy")                        # @ +11252032

    return success
```

Analysis basis: CC v2.1.183 bundle.js:+11251613–11252121

---

### Message Content Extraction

The helper identified as `psl` (via callGraph edge `zGp → psl` at +11251613) filters a message's content blocks for text items.

Analysis basis: CC v2.1.183 bundle.js:+11247630

```
function extractTextContent(message):
    if not Array.isArray(message.content):
        # scalar content — pass through Cc filter
        filtered = filterTextBlocks(message.content)   # Cc @ +11247662
        return filtered

    result = []
    for block in message.content:
        if block.type == "text":                        # literal "text" @ +13879574
            result.push(block.text)
    return result.join("")
```

Analysis basis: CC v2.1.183 bundle.js:+11247630

---

### Conversation Message Lookup

`dsl` (callGraph entry `zGp → dsl` at +11251967) performs lexer-assisted parsing of the conversation message log and slices the relevant portion.

Analysis basis: CC v2.1.183 bundle.js:+11247211

```
function lookupMessagesFromConversation(conversationContext, index):
    tokens = lexer(conversationContext)           # RA.lexer @ +11247211
    messageOffset = tokens.indexOf("message")     # literal "message" @ +11251908
    sliced = tokens.slice(messageOffset)          # n.slice @ +11247389
    return sliced
```

Analysis basis: CC v2.1.183 bundle.js:+11247257

---

### Table Rendering Helper (usl)

`usl` is called from `dsl` (edge at +11247378) to format assistant message content into a table or plaintext representation before clipboard extraction. It handles column alignment using string-width measurement.

Analysis basis: CC v2.1.183 bundle.js:+11246710

```
function formatForDisplay(rows, formatType):
    # formatType: "table" @ +11247324, or "plaintext" @ +11247765
    if formatType == "table":
        # measure column widths
        widths = rows.map(row => measureWidth(row))       # jGp, tn (Bun.stringWidth)
        maxWidth = Math.max(...widths)
        paddedRows = rows.map(row => padCell(row, maxWidth))
        separator = " | "                                  # literal @ +11246912
        # alignment: "center" @ +11246947, "right" @ +11246985, "left" @ +11247021
        return paddedRows.join(separator)
    else:
        # escape pipe characters in plaintext
        escaped = content.replace("\\|", ...)             # literal @ +11246753
        return escaped
```

Column width minimum: 3 characters (literal `3` at bundle.js:+11246812).

Analysis basis: CC v2.1.183 bundle.js:+11246710

---

### Clipboard Write Dispatch (zv / t_o)

`t_o` (called from `zGp` at +11252121) dispatches to `zv`, which performs platform detection and routes to the appropriate clipboard backend.

Analysis basis: CC v2.1.183 bundle.js:+11247977

```
async function writeToClipboard(text):
    encodedText = encode(text, "utf8")                  # literal @ +3537177

    platform = detectPlatform()
    terminalType = detectTerminal()

    if platform == "darwin" (macOS):
        spawn("pbcopy", stdin=encodedText)              # literal "pbcopy" @ +3537613
        timeout = 2000ms                                # literal @ +3537579

    else if platform == "linux":
        if wayland:
            spawn("wl-copy", stdin=encodedText)         # literal @ +3536573
        else if xclip available:
            spawn("xclip", ["-selection", "clipboard"], stdin=encodedText)
                                                        # literals @ +3536641, +3537838
        else if xsel available:
            spawn("xsel", ["--clipboard", "--input"], stdin=encodedText)
                                                        # literals @ +3536681, +3537924, +3537938

    else if terminalType == "tmux":
        spawn("tmux", ["load-buffer", "-w", "-"], stdin=encodedText)
                                                        # literals @ +3536860, +3536868, +3536882

    else if environment == "wsl":
        spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Set-Clipboard"])
                                                        # literals @ +3538010, +3538028, +3538041, +3538059

    else if terminalType == "screen":
        useOSC52()                                      # literal "screen" @ +3535568

    else if OSC52 supported:
        # encode as base64 and emit OSC52 escape sequence
        encoded = Buffer.from(text).toString("base64") # literal "base64" @ +3537194
        write("\x1b\x1b" + osc52Sequence(encoded))     # literal ESC ESC @ +3536165

    # Additional terminal variants detected:
    # "kitty" @ +3536037, "tmux-buffer" @ +3536436, "osc52" @ +3536456
    # "raw+dcs" @ +3537292, "dcs" @ +3537315, "raw" @ +3537321, "none" @ +3537366
    # "--primary" flag @ +3537776 and "-selection primary" @ +3537879 (primary selection)
```

Analysis basis: CC v2.1.183 bundle.js:+3537208

The clipboard writer uses a temporary directory rooted at `/tmp` (literal at +3375999), overridable via `CLAUDE_CODE_TMPDIR`. Permissions on the temp path are set to octal `0700` (448 decimal, literal at +3376680) and the directory is created with mode `0777` (511 decimal, literal at +3376490).

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (emitted on every successful copy, bundle.js:+11252032) |
| Telemetry (infra, reachable via callGraph depth-2) | `tengu_mcp_skills`, `tengu_config_auth_loss_prevented`, `tengu_bg_retire_pinned_low_mem`, `tengu_bg_prewarm_per_sweep`, `tengu_config_parse_error`, `tengu_bg_dispatch_sigkill_escalate`, `tengu_scheduled_task_missed`, `tengu_feature_bad`, `tengu_feature_ok`, `tengu_bg_low_mem_mb`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_sendclaim_failed`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_daemon_control` |
| Clipboard side effect | Text written to system clipboard via platform-native tool (pbcopy / wl-copy / xclip / xsel / tmux / powershell.exe / OSC52) |
| Temp file | May create a temporary file under `/tmp` (or `CLAUDE_CODE_TMPDIR`) with mode 0700 for staging clipboard content on some platforms |
| appState changes | None observed in depth-2 traversal |
| Hook registration | None observed in depth-2 traversal |
| Sound | None observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.183 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy foo` will be rejected; only bare integers (e.g. `/copy 2`) are accepted. `Number.isInteger` is used for validation (bundle.js:+11251737).
2. **Expecting `/copy 0` to work as "latest"** — The index is 1-based. Use `/copy 1` (or no argument) for the most recent assistant message.
3. **Assuming clipboard access in headless/SSH environments** — The command attempts platform detection, but without a display server (`DISPLAY` unset on Linux) and without OSC52 terminal support, clipboard writes will silently fail. In tmux or screen sessions the buffer is used as a fallback.
4. **Copying from an empty conversation** — If no assistant message exists yet in the session, the command outputs "No assistant message to copy" (bundle.js:+11251654) and exits without error.
5. **Index out of range** — Requesting `/copy N` where N exceeds the number of assistant messages in the conversation will result in an undefined lookup; no explicit bounds-check error message is shown beyond a silent no-op or UI-level display of undefined content.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `zGp` | Main async handler for `/copy` command (Arbor-resolved, `claude-2.1.183::zGp`) |
| `psl` | Text-content extraction / message content block filter |
| `dsl` | Conversation message lookup with lexer-assisted parsing |
| `usl` | Table/plaintext formatter; measures and pads column widths |
| `jGp` | Column-width mapping helper (called from usl) |
| `t_o` | Clipboard write dispatcher (routes to zv) |
| `zv` | Platform-detection and clipboard backend selector |
| `SHi` | macOS pbcopy clipboard writer |
| `xFr` | Linux X11 clipboard writer (xclip/xsel) |
| `LFr` | Linux Wayland clipboard writer (wl-copy) |
| `EL` | replaceAll-based text normalizer used in clipboard path |
| `aE` | Array-join helper in clipboard content assembly |
| `EHi` | Base content builder (called from aE) |
| `d0t` | Low-level clipboard buffer writer |
| `b_` | Terminal escape / OSC52 sequence emitter |
| `p0t` | Intermediate clipboard staging helper |
| `ged` | Clipboard write coordinator |
| `msl` | Temporary file/directory setup for clipboard staging |
| `XE` | Secure temp directory creator |
| `OAi` | Temp directory lstat/chmod validator |
| `pmr` | Atomic file writer with rename and permission handling |
| `lF` | File handle helper within temp dir creation |
| `GGp` | Lexer-based message boundary helper (called from zGp) |
| `r0e` | String replace helper for message normalization |
| `Cc` | Content block filter (filters for `type=="text"`) |
| `RA` | Lexer module (exposes `RA.lexer`) |
| `fsl` | String replace helper in message extraction |
| `tn` | String-width measurement wrapper (`Bun.stringWidth`) |
| `um` | String repeat / padding utility |
| `jt` | Path join / config path utility |
| `dn` | Error categorization utility |
| `Mn` | Error wrapper for filesystem errors |
| `vKe` | File sync/chmod error handler |
| `Pre` | Config path resolver |
| `csr` | Atomic rename helper |
| `t_c` | Append-file-with-mkdir helper |
| `dsr` | Buffer byte-length helper |
| `n_c` | Top-level logging/file sink (transitive) |
| `YWe` | Debounced write scheduler |
| `rpe` | Log file rotate helper |
| `y9o` | Log file path constructor |
| `qi` | Signal/cleanup handler registrar |
| `u` | Worker/process lifecycle utilities (transitive) |
| `T` | Config read/write orchestrator (transitive) |
| `QHc` | Config format selector (transitive) |
| `j2o` | Config serialization helpers |
| `Kc` | Config key redaction helper (emits `[REDACTED]`) |
| `g9o` | Key mapping array helper |
| `Hqe` | Config write helper |
| `s9o` | Low-level config file write |
| `ci` | AsyncLocalStorage store getter |
| `Pe` | JSON.stringify wrapper |
| `Mjt` | Daemon status path builder (uses `daemon.status.json`) |
| `k0l` | Daemon status write helper |
| `CQ` | Conversation/message serializer |
| `vfe` | Text trimmer (trims to 1000 chars, literal @ +2297969) |
| `Ct` | Config accessor with file-watch integration |
| `Ebf` | Config file watcher |
| `q_e` | Config file reader (guards "Config accessed before allowed") |
| `RFl` | Config backup file finder |
| `Sko` | Config backup path builder |
| `V9` | String prefix stripper |
| `Gt` | JSON.parse wrapper |
| `B$e` | Stale config file cleaner |
| `n3e` | MCP server connection manager (transitive) |
| `dW` | MCP server slot applicator |
| `Ort` | MCP server capability resolver |
| `W7` | MCP server connection orchestrator |
| `k5` | MCP SDK transport builder |
| `NLn` | MCP error color formatter |
| `Mrt` | MCP connection state tracker |
| `Nk` | MCP permission checker |
| `P_` | MCP permission evaluator |
| `EKr` | MCP extra-permissions resolver |
| `Wn` | MCP tool wrapper |
| `pra` | MCP cache builder |
| `w7r` | MCP needs-auth cache reader |
| `d0n` | MCP cache path builder (uses `mcp-needs-auth-cache.json`) |
| `Vwe` | MCP config hash builder (sha256/hex) |
| `Phn` | MCP server config hasher |
| `Ohn` | MCP server identity hasher |
| `EI` | MCP hash helper |
| `Mhn` | MCP server metadata extractor |
| `dc` | MCP metadata field accessor |
| `on` | MCP debug log pusher |
| `oxn` | MCP OAuth connection handler |
| `Lr` | MCP OAuth token manager |
| `CBd` | MCP OAuth flow initiator |
| `vBd` | MCP OAuth callback handler |
| `Sra` | MCP reconnect handler |
| `OKr` | MCP error report helper |
| `Ee` | String coercion wrapper |
| `Uk` | MCP tool registration helper |
| `ct` | MCP tool slot checker |
| `yKr` | MCP include/exclude filter |
| `pn` | Global config read/write (save_global path) |
| `w` | Background worker activity tracker |
| `kz` | Worker blur/focus state tracker |
| `L` | Background worker sweep/lifecycle manager |
| `Dec` | Worker history accessor (`e.at`) |
| `Cu` | MCP error logger |
| `gra` | Async iterator / mapper utility |
| `U8` | Async mapper with abort support |
| `Hot` | parseInt wrapper (radix 10) |
| `p0n` | parseInt wrapper (radix 20) |
| `uZn` | MCP connection result applier |
| `t3e` | MCP config hash comparator |
| `fw` | MCP cleanup/reconnect coordinator |
| `hot` | MCP server teardown helper |
| `mta` | MCP transport adapter selector |
| `Szr` | MCP transport factory |
| `B1o` | MCP roster update dispatcher |
| `jLn` | MCP tool permission set checker |
| `Bn` | Timed retry/abort helper |
| `f` | Background daemon worker manager (transitive) |
| `M` | Scheduled task runner |
| `Re` | Feature flag OK reporter |
| `ke` | Feature flag BAD reporter |
| `YKn` | Low-memory check (macOS) |
| `De` | Error logger with MCP bus push |
| `$` | Permission classifier (deny/classify/ask) |
| `NNo` | Daemon socket connector |
| `jNo` | Worker process lifecycle manager |
| `p` | Forced shutdown handler |
| `Ue` | Early-exit utility |
| `R` | Worker disposal tracker |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.