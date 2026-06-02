---
type: feature-spec
feature: "copy"
cc_version: "2.1.157"
updated: "2026-06-02"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.157 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.157 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.157

---

## Overview

The `/copy` command copies Claude's most recent assistant response to the system clipboard. An optional numeric argument (`/copy N`) selects the Nth-latest assistant message instead of the most recent one. The command is implemented as an async function that extracts assistant message content, serialises it to plain text, and writes it to the OS clipboard via platform-appropriate mechanisms.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | Copy Claude's last response to clipboard (or /copy N for the Nth-latest) |
| loc_byte | `10767107` |
| loc_byte_end | `10767293` |
| loc_line | `6682` |
| module_id | `zN1` |
| load_inline | `true` |
| arbor_handler.name | `qiL` |
| arbor_handler.fqn | `claude-2.1.157::qiL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.157 bundle.js:+10767107

---

## Input Branching

Four distinct branches exist based on argument parsing and message availability, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument present?}
    B -- No --> C[Target index = 1 (most recent)]
    B -- Yes --> D{Is arg a valid integer?}
    D -- No --> E[Show error / usage hint]
    D -- Yes --> F[Target index = N]
    C --> G[Collect assistant messages from conversation]
    F --> G
    G --> H{At least N assistant messages exist?}
    H -- No --> I["Return: 'No assistant message to copy'"]
    H -- Yes --> J[Extract Nth-latest assistant message content]
    J --> K[Serialise content to plain text]
    K --> L[Write to OS clipboard via platform writer]
    L --> M[Emit tengu_copy telemetry]
    M --> N[Return success feedback to UI]
```

Analysis basis: CC v2.1.157 bundle.js:+10766292 – +10766800

---

## Behavioral Spec

### 1. Argument Parsing

The handler (`qiL`) begins by inspecting the raw command argument string.

```
async function copyCommandHandler(rawArg, conversationContext):
    trimmedArg = trim(rawArg)

    if trimmedArg is empty:
        targetIndex = 1          // default: most recent
    else:
        n = Number(trimmedArg)
        if not Number.isInteger(n) or n < 1:
            return errorResult("invalid argument; expected a positive integer")
        targetIndex = n
```

Analysis basis: CC v2.1.157 bundle.js:+10766402, +10766416

---

### 2. Assistant Message Collection

The handler calls the message-collection helper (`MN1`) to gather all assistant-role messages from the current conversation state.

```
function collectAssistantMessages(conversationMessages):
    result = []
    for each message in conversationMessages:
        if Array.isArray(message.content):
            textBlocks = filterTextBlocks(message.content)  // jK: keeps kind=="text"
            result.push(textBlocks)
        else:
            result.push(message)
    return result   // ordered oldest-first
```

Key literals observed in the traversal:
- Role filter string: `"assistant"` (bundle.js:+10762240)
- Content block kind filter: `"text"` (bundle.js:+10465457)

Analysis basis: CC v2.1.157 bundle.js:+10766292, +10762310, +10762342, +10762358

If no assistant messages are found, the handler returns immediately with the user-facing string `"No assistant message to copy"` (bundle.js:+10766333).

---

### 3. Nth-Latest Selection

```
function selectNthLatest(assistantMessages, n):
    // messages are oldest-first; index from the end
    targetPosition = assistantMessages.length - n
    if targetPosition < 0:
        return null   // not enough messages
    return assistantMessages[targetPosition]
```

Analysis basis: CC v2.1.157 bundle.js:+10766646 (call to `fN1`)

The index calculation uses `Math.max` to clamp the lower bound (bundle.js:+10761471).

---

### 4. Content Serialisation

The selected message content is serialised to a plain-text string. Two output formats are identified in the literals:

| Format constant | loc_byte |
|---|---|
| `"table"` | +10762004 |
| `"plaintext"` | +10762445 |

The serialiser (`fN1` → `LN1`) processes structured content blocks:
- Pipes/columns are re-assembled using `" | "` as a separator (bundle.js:+10761580).
- Pipe characters inside cell values are escaped with `"\|"` (bundle.js:+10761421).
- Column alignment supports `"center"`, `"right"`, and `"left"` (bundle.js:+10761615, +10761657, +10761697).
- Column width is measured with `Bun.stringWidth` (via `H8`, bundle.js:+10761496) and padded to a minimum of 3 characters (literal `3` at bundle.js:+10761480).
- Code blocks are tagged with the `"code"` kind (bundle.js:+10761167).
- Plain-text fallback appends `.txt` (bundle.js:+10762477).

```
function serialiseToPlainText(messageContent):
    lines = []
    for each block in messageContent:
        if block.type == "table":
            lines.append(renderTableAsText(block))
        elif block.type == "code":
            lines.append(renderCodeBlock(block))
        else:
            lines.append(block.text)
    return join(lines, "\n")
```

Analysis basis: CC v2.1.157 bundle.js:+10761378 – +10762069

---

### 5. Clipboard Writing

The clipboard write is handled by `mo_` → `QZ`, which selects a platform-appropriate tool:

```
function writeToClipboard(text):
    platform = process.platform

    if platform == "darwin":
        // Use pbcopy
        spawnAndPipe("pbcopy", [], text)

    elif platform == "linux":
        // Try Wayland first, then X11 fallbacks
        if envHasWayland():
            spawnAndPipe("wl-copy", [], text)
        elif commandExists("xclip"):
            spawnAndPipe("xclip", ["-selection", "clipboard"], text)
        elif commandExists("xsel"):
            spawnAndPipe("xsel", ["--clipboard", "--input"], text)

    elif platform == "win32":
        spawnAndPipe("powershell", [
            "-NoProfile", "-NonInteractive", "-Command", "<clip-command>"
        ], text)

    // Terminal multiplexer / special terminal overrides:
    if insideTmux():
        spawnAndPipe("tmux", ["load-buffer", "-w", "-"], text)
        // iTerm2 passthrough also attempted

    if insideKitty() or insideScreen():
        // Use OSC 52 escape sequence
        writeOSC52(text)
```

Platform literal evidence (bundle.js):
- `"darwin"` → +3369810, `"pbcopy"` → +3369836
- `"linux"` → +3369862, `"wl-copy"` → +3369901
- `"xclip"` → +3369947, `"-selection"` → +3369968, `"clipboard"` → +3369981
- `"xsel"` → +3370013, `"--clipboard"` → +3370032, `"--input"` → +3370046
- `"win32"` → +3370313, `"powershell"` → +3370325
- `"tmux"` → +3369465, `"load-buffer"` → +3369403, `"-w"` → +3369437
- `"iTerm2"` → +3369393, `"kitty"` → +3368988, `"screen"` → +3368873
- OSC 52 escape prefix `"\x1b\x1b"` → +3369116
- Encoding constants `"utf8"` → +3369566, `"base64"` → +3369583

Analysis basis: CC v2.1.157 bundle.js:+10762656 – +10762736 (`mo_` → `QZ`)

---

### 6. Temporary File Handling (Clipboard Pipe)

When spawning a clipboard helper process, a temporary directory is used:

```
function prepareTmpDir():
    baseTmp = env.CLAUDE_CODE_TMPDIR ?? "/tmp"
    tmpDir = path.join(baseTmp, <session-unique-suffix>)
    mkdirSync(tmpDir, { recursive: true })
    validateNotWorldWritable(tmpDir)   // HJ7: lstatSync + chmodSync check
    return tmpDir
```

- Default base: `"/tmp"` (bundle.js:+3946565)
- Permission bits written: `448` (octal `0o700`, bundle.js:+3947246) and `511` (octal `0o777` check, bundle.js:+3947056)
- Safety error string: `"Set CLAUDE_CODE_TMPDIR to a directory you control…"` (bundle.js:+3946640)

Analysis basis: CC v2.1.157 bundle.js:+10762514 (`kX`), +3947144 – +3947252

---

### 7. Telemetry Emission

After a successful clipboard write, the handler emits one telemetry event:

```
emitTelemetry("tengu_copy", {
    messageIndex: targetIndex,
    // additional context fields from appState
})
```

Analysis basis: CC v2.1.157 bundle.js:+10766711

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (bundle.js:+10766711) — fired on every successful copy operation |
| Telemetry (infrastructure) | `tengu_config_parse_error` (+3210553), `tengu_bg_dispatch_sigkill_escalate` (+15466951), `tengu_feature_bad` (+966091), `tengu_feature_ok` (+966033), `tengu_bg_low_mem_mb` (+12729087), `tengu_bg_dispatch_low_mem` (+15467530), `tengu_bg_spare_enable` (+15468225), `tengu_bg_sendclaim_failed` (+15447680), `tengu_bg_spare_claim` (+15468346), `tengu_bg_spare_spawn` (+15466644), `tengu_bg_spare_claim_fail` (+15468609) — belong to background daemon infrastructure reached transitively via shared modules |
| Clipboard side effect | Writes serialised text to the OS clipboard using a platform-specific subprocess (`pbcopy` / `wl-copy` / `xclip` / `xsel` / `powershell` / tmux / OSC 52) |
| Filesystem side effect | May create a temporary directory under `$CLAUDE_CODE_TMPDIR` or `/tmp` for piping clipboard content to subprocess |
| appState changes | Reads conversation message history (read-only); no conversation state mutation observed |
| Sound | None observed |
| Hook registration | None observed for this command specifically |

---

## Version History

| Version | Change |
|---|---|
| v2.1.157 | Initial analysis |

---

## Common Mistakes

1. **Expecting `/copy 0` to work** — the argument must be a positive integer (`≥ 1`). Index `0` is not valid and will produce an error or unexpected result.
2. **Using `/copy` when no assistant message exists** — if Claude has not yet responded in the session, the command returns `"No assistant message to copy"` and writes nothing to the clipboard.
3. **Clipboard tool not installed on Linux** — the command requires at least one of `wl-copy`, `xclip`, or `xsel` to be present. If none are available and Wayland/X11 detection fails, the copy will silently fail or error.
4. **World-writable `/tmp`** — if the system `/tmp` directory is world-writable and `CLAUDE_CODE_TMPDIR` is not overridden, the command will refuse to use it and print a remediation hint. Set `CLAUDE_CODE_TMPDIR` to a directory you control.
5. **Running inside an unsupported terminal multiplexer** — only `tmux` and terminals with OSC 52 support (kitty, iTerm2, screen) receive special handling. Other multiplexers may intercept or drop the clipboard write.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `qiL` | Main async handler for `/copy` command (arbor_handler) |
| `MN1` | Assistant message collection helper |
| `jK` | Text-block filter (keeps `type == "text"` blocks) |
| `fN1` | Message content serialiser / format selector |
| `LN1` | Table-to-plain-text renderer |
| `tnL` | Column-map helper used by table renderer |
| `snL` | Lexer/token helper for content serialisation |
| `ijH` | String-replace helper inside token processing |
| `$N1` | String replacement utility (plain-text post-processor) |
| `L$` | Lexer entry point (`YNH.parse` wrapper) |
| `mo_` | Clipboard write dispatcher (calls `QZ`) |
| `QZ` | Platform-detection and clipboard tool selector |
| `XD_` | OSC 52 / escape-sequence clipboard writer |
| `FD` | Low-level subprocess / write primitive |
| `M77` | Darwin (`pbcopy`) clipboard handler |
| `K77` | Shared subprocess invoker |
| `v8` | Subprocess spawn wrapper |
| `Jdq` | Generic subprocess write helper |
| `zW` | String replaceAll + escape helper |
| `TJ` | Argument join helper for clipboard commands |
| `q77` | Low-level FD write helper |
| `H7` | String indexOf utility |
| `ON1` | Temporary directory creator / path resolver |
| `kX` | Tmp-dir setup and permission enforcer |
| `xx` | Tmp-dir path component helper |
| `HJ7` | Directory permission validator (lstatSync + chmodSync) |
| `H8` | String-width measurer (`Bun.stringWidth` wrapper) |
| `K` | Column pad-end formatter |
| `S6` | Configuration file accessor / watcher |
| `szH` | Config file reader (readFileSync + JSON parse) |
| `p6` | JSON.parse wrapper |
| `gb` | String startsWith/slice helper |
| `yFq` | Config directory resolver (readdirStringSync) |
| `qY_` | Config path join helper |
| `b17` | File watcher registration helper |
| `Vr` | Watcher callback helper |
| `K9` | Cleanup/unregister helper (`_OA.register`) |
| `N` | Config normaliser / key formatter |
| `QCK` | Config key validation helper |
| `v4` | Config value formatter (redaction-aware) |
| `EuH` | Config value validator |
| `lCK` | Config byte-length and write helper |
| `LN1` | Table column renderer (reused symbol) |
| `ii` | Message text extractor |
| `s1H` | Text trimmer with threshold |
| `Ls1` | Daemon status file writer |
| `uI6` | Status path joiner |
| `RH` | JSON.stringify wrapper |
| `O` | Background session state holder |
| `k8` | Session status string resolver |
| `cS6` | Plugin path sanitiser |
| `lS6` | Plugin path join helper |
| `S` | Background worker process manager |
| `w` | Background session dispatcher |
| `bH` | Feature-bad telemetry emitter |
| `hH` | Feature-ok telemetry emitter |
| `uy8` | Memory availability checker |
| `Lw6` | Session roster file reader |
| `SH` | Session error/log handler |
| `B` | MCP tool-use message filter |
| `G6` | Background session getter |
| `DfA` | Background session claim sender |
| `GfA` | Background session lifecycle manager |
| `D` | Background session disposal / restart loop |
| `g6` | Config directory path getter |
| `sz_` | Config schema validator |
| `j8` | Structured logger |
| `d` | App/process state container |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.