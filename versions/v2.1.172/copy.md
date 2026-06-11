---
type: feature-spec
feature: "copy"
cc_version: "2.1.172"
updated: "2026-06-11"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.172 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.172 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.172

---

## Overview

`/copy` copies the text content of Claude's most recent assistant response to the system clipboard. When invoked with a numeric argument (`/copy N`), it instead copies the Nth-latest assistant response (1 = most recent, 2 = second-most-recent, etc.). The command adapts its clipboard mechanism to the host platform and terminal environment, covering macOS, Linux (Wayland, X11), Windows/WSL, and terminal multiplexers such as tmux.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `enq` |
| load_inline | `true` |
| loc_byte | `11238604` |
| loc_byte_end | `11238790` |
| loc_line | `7403` |
| arbor_handler.name | `Wv7` |
| arbor_handler.fqn | `claude-2.1.172::Wv7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.172 bundle.js:+11238604

---

## Input Branching

Four distinct decision branches are present: (1) no argument → copy last response, (2) numeric argument → copy Nth-latest response, (3) no assistant message found → return error, (4) clipboard write → platform dispatch sub-branches. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument provided?}
    B -- No --> C[index = 1\n(most recent)]
    B -- Yes --> D{Is arg a valid integer?}
    D -- No --> E[Show usage / ignore arg\ndefault to index 1]
    D -- Yes --> F[index = Number(arg)]
    C --> G[Collect assistant messages\nfrom conversation history]
    E --> G
    F --> G
    G --> H{Assistant message\nat index exists?}
    H -- No --> I[Return error:\n'No assistant message to copy'\nbundle.js:+11237830]
    H -- Yes --> J[Extract text content\nfrom message blocks]
    J --> K[Render to plaintext string\nbundle.js:+11233942]
    K --> L[writeToClipboard(text)\nbundle.js:+11234153]
    L --> M{Detect platform / terminal}
    M -- macOS --> N[pbcopy\nbundle.js:+3494384]
    M -- Linux / Wayland --> O[wl-copy\nbundle.js:+3493441]
    M -- Linux / X11 xclip --> P[xclip -selection clipboard\nbundle.js:+3493510]
    M -- Linux / X11 xsel --> Q[xsel --clipboard --input\nbundle.js:+3493551]
    M -- WSL --> R[powershell.exe clip\nbundle.js:+3494740]
    M -- tmux --> S[tmux load-buffer\nbundle.js:+3493682]
    M -- iTerm2 OSC52 --> T[OSC 52 escape sequence\nbundle.js:+3493672]
    M -- kitty --> U[kitty clipboard protocol\nbundle.js:+3492912]
    M -- screen --> V[screen DCS sequence\nbundle.js:+3492443]
    N & O & P & Q & R & S & T & U & V --> W[Emit tengu_copy telemetry\nbundle.js:+11238208]
    W --> X[Return success to UI]
    I --> Z[Return error to UI]
```

---

## Behavioral Spec

### 1. Argument Parsing

The handler `Wv7` (resolved via Arbor `module_id` path) begins by inspecting the raw argument string passed after `/copy`.

```
function parseIndex(rawArg):
    if rawArg is absent or empty:
        return 1                         // default: most-recent response
    n = Number(rawArg.trim())
    if not Number.isInteger(n) or n < 1:
        return 1                         // invalid input: fall back to 1
    return n
```

Analysis basis: CC v2.1.172 bundle.js:+11237899 (Number cast), +11237913 (Number.isInteger guard)

### 2. Assistant Message Collection

The function `collectAssistantMessages` (obfuscated: `anq`) walks the current conversation history array and filters entries whose role is `"assistant"` (literal at bundle.js:+11233737). It extracts content blocks of type `"text"` (literal at bundle.js:+10987236), delegating block-type detection to helper `filterTextBlocks` (obfuscated: `Gf`).

```
function collectAssistantMessages(history):
    result = []
    for each message in history:
        if message.role == "assistant":
            textBlocks = filterTextBlocks(message.content)
            if textBlocks is not empty:
                result.push(join(textBlocks))
    return result           // ordered newest-first or oldest-first per original list
```

Analysis basis: CC v2.1.172 bundle.js:+11233807 (Array.isArray check), +11233839 (filterTextBlocks call), +11233855 (push)

### 3. Index Resolution and Error Guard

After collection, the handler selects the target message using the parsed index.

```
function resolveMessage(messages, index):
    target = messages[messages.length - index]   // Nth from end
    if target is undefined:
        return Error("No assistant message to copy")
    return target
```

The literal `"No assistant message to copy"` is present at bundle.js:+11237830. This error is surfaced directly to the user in the CLI UI.

### 4. Content Rendering

The selected message is passed through a plaintext renderer `renderPlaintext` (obfuscated: `snq`), which strips markdown formatting (pipes, table delimiters) via `String.replace` calls, normalising the output before it reaches the clipboard writer.

Relevant literals found in the rendering pipeline:
- Table separator detection: `"\\|"` (bundle.js:+11232918)
- Column separator: `" | "` (bundle.js:+11233077)
- Alignment keywords: `"center"`, `"right"`, `"left"` (bundle.js:+11233112, +11233154, +11233194)
- Output format tag: `"plaintext"` (bundle.js:+11233942)
- Output format tag: `"table"` (bundle.js:+11233501)

The renderer uses `Bun.stringWidth` (via obfuscated `f8`, bundle.js:+11232993) to measure terminal display width of cells for accurate column padding, and `Math.max` (bundle.js:+11232968) to track the widest column.

```
function renderPlaintext(messageText):
    if messageText contains table markup:
        parse columns, compute max widths via stringWidth()
        reformat each row with padded cells and " | " separators
        return formatted table string
    else:
        strip residual pipe/backslash escapes
        return cleaned text
```

Analysis basis: CC v2.1.172 bundle.js:+11232875 (table detection helper `Dv7`), +11232840 (`_.map` over rows), +11232902 (`O.replace` for separator stripping)

### 5. Clipboard Write Dispatch

The core clipboard function is `writeToClipboard` (obfuscated: `zT`, reached via `k4A` at bundle.js:+11238297). It selects among multiple backend strategies based on the detected runtime environment:

```
async function writeToClipboard(text):
    env = detectClipboardEnv()   // inspects TERM, TMUX, SSH_TTY, WSL_DISTRO_NAME, etc.

    if env.isMacOS:
        spawn("pbcopy", stdin=text, timeout=2000ms)

    else if env.isLinux:
        if env.hasWayland:
            spawn("wl-copy", stdin=text)
        else if env.hasXclip:
            spawn("xclip", ["-selection", "clipboard"], stdin=text)
        else if env.hasXsel:
            spawn("xsel", ["--clipboard", "--input"], stdin=text)

    else if env.isWSL:
        spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "...clip..."], stdin=text)

    else if env.isTmux:
        spawn("tmux", ["load-buffer", "-w", "-"], stdin=text)

    else if env.isITerm2:
        write OSC 52 escape sequence (base64-encoded text) to terminal

    else if env.isKitty:
        use kitty clipboard protocol (via "kitty" sequence)

    else if env.isScreen:
        write DCS/raw sequence to terminal

    else:
        attempt OSC 52 fallback or signal failure
```

Platform literal evidence:
- `"pbcopy"` bundle.js:+3494384
- `"wl-copy"` bundle.js:+3493441
- `"xclip"` bundle.js:+3493510, `"xsel"` bundle.js:+3493551
- `"wsl"` / `"powershell.exe"` bundle.js:+3494740, +3494750
- `"tmux"` / `"load-buffer"` bundle.js:+3493744, +3493682
- `"iTerm2"` bundle.js:+3493672
- `"kitty"` bundle.js:+3492912
- `"screen"` bundle.js:+3492443
- Timeout: `2000` ms (bundle.js:+3494350)
- Text encoding: `"utf8"` / `"base64"` (bundle.js:+3493948, +3493965)

The OSC 52 path further distinguishes `"raw+dcs"`, `"dcs"`, `"raw"`, and `"none"` modes (bundle.js:+3494063, +3494086, +3494092, +3494137) and the tmux variant `"tmux-buffer"` (bundle.js:+3493312) vs `"osc52"` (bundle.js:+3493332).

Analysis basis: CC v2.1.172 bundle.js:+11234153 (entry into `zT`), +3493979 (`wW6` env-detection helper), +3493985 (`y99` macOS path), +3493441 (Linux Wayland)

### 6. Temporary File Handling (Clipboard Helper)

Some clipboard backends (notably the tmux and OSC 52 paths) write content through a temporary file managed by `manageTempFile` (obfuscated: `tnq`, bundle.js:+11234233). The temp directory is resolved from `CLAUDE_CODE_TMPDIR` or `/tmp` (bundle.js:+4077819). Directories are created with mode `0o511` (bundle.js:+4078310) and files with mode `0o448` (bundle.js:+4078500). Existing sockets/files are validated before use via `lstatSync` (bundle.js:+4077987).

```
function manageTempFile(content):
    dir = env.CLAUDE_CODE_TMPDIR ?? "/tmp"
    validateTmpDir(dir)          // throws if dir is controlled by another user
    filePath = join(dir, generatedName)
    mkdir(filePath, mode=0o511, recursive=true)
    writeFile(filePath, content)
    return filePath
```

Analysis basis: CC v2.1.172 bundle.js:+11234045 (`ox8.mkdir`), +11234088 (`ox8.writeFile`), +4077819 (`/tmp` literal)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` fired on every invocation (bundle.js:+11238208) |
| Clipboard write | Side-effects the OS clipboard via a spawned subprocess or terminal escape sequence; no in-process state is mutated |
| Temp files | Temporary files may be written under `CLAUDE_CODE_TMPDIR` or `/tmp` for some clipboard backends; cleaned up by the helper after the subprocess reads them |
| appState changes | None observed within depth-2 traversal |
| Sound | None |
| Hook registration | None |

---

## Version History

| Version | Change |
|---|---|
| v2.1.172 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy foo` is silently treated as `/copy 1` (the most-recent message). There is no validation error message for non-numeric input beyond the fallback to index 1.
2. **Expecting `/copy 0`** — Index 0 is not a valid integer index; the guard `Number.isInteger(n) && n >= 1` will fall back to 1. Use `/copy 1` for the latest response.
3. **Clipboard failure in headless/SSH sessions without OSC 52** — If no supported clipboard backend is detected and OSC 52 is unsupported by the terminal, the write will fail silently or produce no useful clipboard content. Setting `CLAUDE_CODE_TMPDIR` to a writable path does not itself fix clipboard access in remote sessions.
4. **Counting from the wrong end** — `N` counts from the most-recent response backwards; `/copy 2` is the second-to-last assistant turn, not the second turn in the session.
5. **tmux clipboard isolation** — On tmux, the content lands in the tmux paste buffer (`load-buffer`), not necessarily the system clipboard. A `tmux show-buffer` or `Ctrl-b ]` paste is required to retrieve it.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Wv7` | Main async handler for `/copy` (entry point resolved by Arbor) |
| `anq` | Assistant-message collector — filters history by role and text block type |
| `onq` | Inner message indexer — resolves Nth assistant message from collected list |
| `rnq` | Table-aware plaintext renderer — measures column widths, reformats rows |
| `snq` | Fallback plaintext cleaner — strips pipe/backslash escapes from non-table text |
| `Dv7` | Table-detection helper — maps message lines to detect markdown table structure |
| `Gf` | Text-block filter — selects `"text"` content blocks from message content array |
| `k4A` | Clipboard dispatch router — selects platform strategy and invokes `zT` |
| `zT` | Core clipboard write function — dispatches to platform-specific backend |
| `wW6` | Environment detection helper — inspects env vars and terminal capabilities |
| `y99` | macOS clipboard path — spawns `pbcopy` with stdin |
| `uV_` | Linux clipboard path — selects among `wl-copy`, `xclip`, `xsel` |
| `wp4` | tmux clipboard path — invokes `tmux load-buffer` |
| `xV_` | OSC 52 escape-sequence writer |
| `YW6` | tmux-buffer variant of OSC 52 |
| `b0` | Raw/DCS terminal sequence writer — handles `raw+dcs` / `dcs` / `raw` modes |
| `yX` | kitty clipboard protocol writer |
| `k99` | screen DCS sequence writer |
| `tnq` | Temporary file manager for clipboard backends that need a file path |
| `EJ` | Temp directory initialiser — creates dir with enforced permissions |
| `QO9` | Temp path validator — lstat + chmod enforcement |
| `V4` | String indexOf utility used during argument parsing |
| `OWH` | String replacement helper used in rendering pipeline |
| `Yv7` | Token/lexer wrapper used in message content parsing |
| `c3` | Lexer module accessor (`c3.lexer`) for content tokenisation |
| `f8` | Terminal display-width measurer wrapping `Bun.stringWidth` |
| `OLH` | String trimmer with a 1000-character ceiling (bundle.js:+2264894) |
| `TwK` | Daemon status reader — reads `daemon.status.json` (unrelated to copy core path) |
| `km6` | Status-file path joiner using `GwK.join` |
| `CH` | JSON serialiser wrapping `JSON.stringify` |
| `m8` | Stopped/background-session label provider |
| `pa` | Daemon status object builder |