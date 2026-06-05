---
type: feature-spec
feature: "copy"
cc_version: "2.1.165"
updated: "2026-06-05"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.165 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.165 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.165

---

## Overview

`/copy` copies Claude's last assistant response to the system clipboard. An optional numeric argument `N` selects the Nth-latest assistant message instead of the most recent one. The command resolves the target message from the conversation history, extracts its text content, and invokes a platform-aware clipboard utility to write the result.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `duq` |
| load_inline | `true` |
| loc_byte | `11003641` |
| loc_byte_end | `11003827` |
| loc_line | `7342` |
| arbor_handler.name | `XYf` |
| arbor_handler.fqn | `claude-2.1.165::XYf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.165 bundle.js:+11003641

---

## Input Branching

The handler has four distinct paths depending on whether the user supplies an argument and whether a valid assistant message is found.

```mermaid
flowchart TD
    A["/copy invoked"] --> B{Argument present?}
    B -- No --> C[N = 1 (most recent)]
    B -- Yes --> D[Parse argument as integer]
    D --> E{Number.isInteger?}
    E -- No --> F[Return error: argument not a valid integer]
    E -- Yes --> C2[N = parsed integer]
    C --> G[Search conversation history for Nth assistant message]
    C2 --> G
    G --> H{Assistant message found?}
    H -- No --> I[Return error: 'No assistant message to copy'\nbundle.js:+11002867]
    H -- Yes --> J[Extract text content from message blocks]
    J --> K[Write to clipboard via platform helper]
    K --> L[Emit tengu_copy telemetry\nbundle.js:+11003245]
    L --> M[Return success result to UI]
```

---

## Behavioral Spec

### 1. Argument Parsing

```
async function copyCommandHandler(context):
    rawArg = context.userInput  // text after "/copy"

    if rawArg is empty or whitespace:
        targetIndex = 1          // default: most recent assistant message
    else:
        parsed = Number(rawArg)
        if not Number.isInteger(parsed):
            return errorResult("argument is not a valid integer")
        targetIndex = parsed     // 1-based ordinal from most recent
```

Analysis basis: CC v2.1.165 bundle.js:+11002936, +11002950

### 2. Message History Lookup

The handler delegates to `messageFilterHelper` (bundle identifier `Fuq`) to locate the Nth assistant message.

```
function messageFilterHelper(conversationMessages, targetIndex):
    // Filter conversation to assistant-role messages only
    // literal "assistant" used as role discriminator
    assistantMessages = conversationMessages
        .filter(msg => msg.role === "assistant")

    // Messages are ordered newest-first (or reversed before lookup)
    // targetIndex=1 → most recent, targetIndex=2 → second most recent, etc.
    if assistantMessages.length < targetIndex:
        return null

    return assistantMessages[ assistantMessages.length - targetIndex ]
```

Analysis basis: CC v2.1.165 bundle.js:+11002826, +10998774, +11003180

The string constant `"No assistant message to copy"` is emitted when the result is `null`.

Analysis basis: CC v2.1.165 bundle.js:+11002867

### 3. Text Extraction

Content extraction is handled by `contentExtractor` (bundle identifier `zYf`), which uses the lexer (`G$.lexer`) to parse message content blocks and accumulates plain-text portions.

```
function contentExtractor(assistantMessage):
    tokens = lexer(assistantMessage.content)
    textParts = []
    for token in tokens:
        normalized = normalizeWhitespace(token)   // via UXH → H.replace
        textParts.push(normalized)
    return textParts.join("")
```

Analysis basis: CC v2.1.165 bundle.js:+10997652, +10997661, +10997717

A complementary helper `tableFormatter` (bundle identifier `Uuq`) is also called, suggesting that structured content (tables) is rendered to a plain-text representation before being placed on the clipboard. Column alignment uses `"center"`, `"right"`, and `"left"` constants and a pipe separator `" | "`, with `Math.max` used for column width calculation and `Bun.stringWidth` (via `A8`) for display-width-aware padding.

Analysis basis: CC v2.1.165 bundle.js:+10997912, +10998005, +10998114, +10998149, +10998191, +10998231, +10998303; literal `"\\|"` at +10997955

### 4. Platform-Aware Clipboard Write

The clipboard write is performed by `clipboardWriter` (bundle identifier `AG`), which dispatches to a platform-specific mechanism:

```
async function clipboardWriter(text):
    platform = detectPlatform()

    if platform is "macos":
        spawn("pbcopy", stdin=text, timeout=2000ms)

    else if platform is "linux":
        if waylandAvailable():
            spawn("wl-copy", stdin=text)
        else if xclipAvailable():
            spawn("xclip", "-selection", "clipboard", stdin=text)
        else:
            spawn("xsel", "--clipboard", "--input", stdin=text)

    else if platform is "wsl":
        spawn("powershell.exe", ["-NoProfile", "-NonInteractive",
              "-Command", "Set-Clipboard"], stdin=text)

    else if platform is "windows":
        spawn("powershell", [...], stdin=text)

    // tmux / screen / kitty terminal multiplexer paths also handled
    if inTmux():
        spawn("tmux", ["load-buffer", "-w", "-"], stdin=text)
    if inKitty():
        writeOSC52Escape(text)
```

Analysis basis: CC v2.1.165 bundle.js:+3432734 (`"pbcopy"`), +3432065 (`"wl-copy"`), +3432134 (`"xclip"`), +3432175 (`"xsel"`), +3433100 (`"powershell.exe"`), +3433193 (`"powershell"`), +3433090 (`"wsl"`), +3432368 (`"tmux"`), +3432306 (`"load-buffer"`), +3432340 (`"-w"`), +3431536 (`"kitty"`), +3432700 (timeout 2000 ms), +3432864 (`"--primary"`), +3432927 (`"clipboard"`), +3432914 (`"-selection"`), +3432968 (`"primary"`), +3433028 (`"--input"`), +3433014 (`"--clipboard"`), +3431995 (`"linux"`), +3431067 (`"screen"`)

The text is encoded as `utf8` or `base64` depending on the clipboard mechanism selected.

Analysis basis: CC v2.1.165 bundle.js:+3432469 (`"utf8"`), +3432486 (`"base64"`)

### 5. Temporary File Handling

For some clipboard backends the text is written through a temporary file in a secure temp directory managed by `tmpDirHelper` (bundle identifier `Quq`/`lj`). The path `/tmp` is used as a fallback base, with `CLAUDE_CODE_TMPDIR` overriding it.

Analysis basis: CC v2.1.165 bundle.js:+4016146 (`"/tmp"`), +10999082 (`Hy8.mkdir`), +10999125 (`Hy8.writeFile`), +4016221

### 6. Result Return

After a successful clipboard write the handler emits the `tengu_copy` telemetry event and returns a UI result element (JSX, consistent with `local-jsx` type).

```
function buildResult(text, targetIndex):
    emit telemetry("tengu_copy")
    return JSX success indicator with character count or preview
```

Analysis basis: CC v2.1.165 bundle.js:+11003245

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (emitted on every successful copy; bundle.js:+11003245) |
| Clipboard | System clipboard mutated via platform subprocess (`pbcopy`, `wl-copy`, `xclip`, `xsel`, `powershell.exe`, tmux buffer, kitty OSC52) |
| Temp files | Transient file written to secure temp directory for some clipboard backends; cleaned up after write |
| appState changes | None observed in depth-2 traversal |
| Hook registration | None observed in depth-2 traversal |
| Sound | None observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.165 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy 2.5` or `/copy last` will fail argument validation because `Number.isInteger` rejects non-integer values. Use a plain positive integer: `/copy 2`.
2. **Calling `/copy N` with N larger than the number of assistant turns** — if the conversation has fewer than N assistant messages the command returns the "No assistant message to copy" error. Check the conversation length before using a large index.
3. **Clipboard unavailable in headless/remote environments** — when none of the expected clipboard tools (`pbcopy`, `wl-copy`, `xclip`, `xsel`, `powershell`) are installed or accessible (e.g. a remote SSH session without X forwarding), the subprocess spawn will fail. Configure `DISPLAY` or use tmux with OSC52 support.
4. **`/copy` vs `/copy 1`** — both are equivalent; `1` is the default and refers to the most recent assistant message, not the first one in the conversation.
5. **`CLAUDE_CODE_TMPDIR` permissions** — if `CLAUDE_CODE_TMPDIR` points to a world-writable or attacker-controlled path, the tool emits a warning and refuses to use it (bundle.js:+4016221).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `XYf` | Main async handler for `/copy` command (arbor_handler) |
| `Fuq` | Message filter helper — selects Nth assistant message from history |
| `Buq` | Conversation message walker / content builder |
| `zYf` | Content extractor — lexes and normalises message content blocks |
| `Uuq` | Table formatter — renders structured content to plain-text with column alignment |
| `YYf` | Map helper used inside table formatter |
| `guq` | String replace helper used inside content pipeline |
| `lK` | Text-block filter — strips non-text content blocks |
| `UXH` | Whitespace normaliser (H.replace wrapper) |
| `G$` | Lexer entry point (`G$.lexer`) |
| `E8A` | Clipboard write orchestrator — calls `AG` and helpers |
| `AG` | Platform dispatcher — routes to correct clipboard tool |
| `Ls1` | macOS clipboard writer (`pbcopy`) |
| `eP_` | Linux clipboard writer (`wl-copy`, `xclip`, `xsel`) |
| `tP_` | Terminal / multiplexer clipboard writer (`tmux`, `kitty`, `screen`) |
| `bW` | Multiplexer string escaper (`H.replaceAll`) |
| `sJ` | OSC52 / kitty clipboard payload builder |
| `Ks1` | Terminal-specific escape sequence builder |
| `HK8` | Clipboard encoding helper (`FY`) |
| `C8` | Subprocess spawner helper |
| `LNL` | Locale / encoding selection helper |
| `Quq` | Temporary directory setup orchestrator |
| `lj` | Temp directory creator and chmod helper |
| `Wu` | Temp path resolver |
| `WK9` | Directory validation (lstat, isDirectory, chmodSync) |
| `r4` | Index-of utility |
| `A8` | Display-width calculator (`Bun.stringWidth`) |
| `NKK` | Daemon status reader |
| `JR6` | Status path joiner (`VKK.join`) |
| `nr` | File read helper |
| `L4H` | File content trimmer |
| `N9` | Store accessor (`QZL.getStore`) |
| `SH` | JSON serialiser (`JSON.stringify`) |
| `_yq` | Argument validation helper |
| `hB` | Safe-integer / type validator |
| `zA6` | Integer parser (parseInt, radix 10) |
| `RI8` | Integer parser variant (parseInt, radix 20) |
| `b8` | String replacement helper |
| `Uuq` | (see table formatter above) |
| `K` | Column padding helper (`f.padEnd`) |
| `D` | Process-exit / abort handler |
| `O` | String operation helper |
| `M` | MCP server map helper |
| `AbH` | MCP server connection manager |
| `IYA` | MCP server roster iterator |
| `eU8` | MCP connection result applier |
| `mk` | MCP connection cleanup |
| `bl` | MCP server slot handler |
| `wG6` | MCP server config loader |
| `ws` | MCP server connect loop |
| `Cl` | MCP SDK server lister |
| `uY8` | MCP config error reporter |
| `DG6` | MCP connection cache manager |
| `fk` | MCP feature flag checker |
| `oO` | Feature flag resolver |
| `ts_` | MCP session startup orchestrator |
| `Sn` | MCP reconnect handler |
| `es_` | OAuth complete-authentication tool |
| `o1H` | MCP OAuth server handler |
| `i1H` | OAuth token exchange helper |
| `r_6` | Concurrent connection limiter |
| `_I8` | MCP needs-auth cache checker |
| `Myq` | MCP server initialiser with auth |
| `SI8` | Auth cache path builder |
| `ss_` | MCP connection status helper |
| `Lb_` | Clipboard capability detector |
| `X8` | Global config reader |
| `bDH` | Config file loader |
| `y6` | Config file watcher |
| `WTL` | File watcher setup |
| `kX_` | Config path resolver |
| `Or1` | Config backup finder |
| `bX_` | Config backup path builder |
| `Ix` | Path prefix stripper |
| `B6` | JSON parser |
| `v8` | Config error handler |
| `VXH` | Hash builder (`nu9.createHash`, sha256) |
| `bY8` | MCP config hash helper |
| `GP` | Short hash generator |
| `RY8` | MCP slot key builder |
| `M4` | Slot version resolver |
| `xY8` | MCP config fingerprint |
| `O8` | MCP debug logger |
| `T7` | MCP error logger |
| `EH` | Error string coercer |
| `hH` | Feature OK telemetry emitter |
| `RH` | Feature error telemetry emitter |
| `s6` | Feature telemetry reporter |
| `P6` | Async scheduler (Nu6-based) |
| `W6` | Chokidar file watcher helper |
| `I` | File watcher event handler |
| `S` | Watcher write helper |
| `w` | Background session manager |
| `hDA` | Background session lifecycle handler |
| `VDA` | Daemon connection helper |
| `vb8` | Memory monitor |
| `zX6` | Config file async reader |
| `kH` | Subprocess error handler |
| `g` | Process kill/timeout helper |
| `j` | Worker value iterator |
| `R` | Worker process controller |
| `j9` | Signal handler registrar |
| `No` | Config change notifier |
| `yx` | Session initialiser |
| `Y` | Supervisor config updater |
| `Ad` | Auth initialiser |
| `D6` | Skill file loader |
| `FN` | Skill manager |
| `Gw_` | Header parser (split/trim/indexOf/slice) |
| `ZHH` | Feature flag set checker |
| `uj` | Markdown cleaner (H.replace) |
| `e1` | Block renderer |
| `H` | Bootstrap fetcher / content formatter |
| `v` | HTTP response formatter |
| `e$` | Bootstrap cache getter |
| `pY8` | MCP tool capability checker |
| `l8` | Timeout-guarded async runner |
| `Ae_` | MCP needs-auth evaluator |
| `sk6` | MCP slot filter |
| `skq` | MCP slot processor |
| `UKf` | SSH detection + clipboard helper |
| `FKf` | OAuth race resolver |
| `_bH` | MCP update hash checker |
| `$A6` | MCP server reinitialiser |
| `cD` | MCP cleanup finaliser |
| `Ck` | Connection status summariser |
| `xn` | Tool list builder |
| `yI8` | Tool schema validator |
| `xB` | Tool result packager |
| `hB` | Safe-integer checker (duplicate — see above) |
| `__` | Lodash/underscore re-export |
| `c` | React/JSX element creator |
| `Q6` | Path utilities |
| `UD` | Path module (basename/join/dirname) |
| `VwH` | Filesystem module (lstatSync/chmodSync/mkdirSync) |
| `Hy8` | Async filesystem (mkdir/writeFile) |
| `QL8` | Path join helper |
| `WK9` | Directory validator (see above) |
| `Wu` | Temp path resolver (see above) |