---
type: feature-spec
feature: "copy"
cc_version: "2.1.153"
updated: "2026-06-02"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.153 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.153 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.153

---

## Overview

The `/copy` command copies Claude's last assistant response to the system clipboard. An optional numeric argument `N` selects the Nth-latest response instead of the most recent one. The command dispatches to a platform-aware clipboard writer that handles macOS (`pbcopy`), Linux (Wayland `wl-copy`, X11 `xclip`/`xsel`), Windows (`powershell`), and terminal multiplexers (tmux, kitty, iTerm2).

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `bE1` |
| load_inline | `true` |
| loc_byte | `10725822` |
| loc_byte_end | `10726008` |
| loc_line | `7652` |
| arbor_handler.name | `AcL` |
| arbor_handler.fqn | `claude-2.1.153::AcL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.153 bundle.js:+10725822

---

## Input Branching

The handler contains 4+ distinct decision branches (argument present/absent, integer validation, assistant message found/not-found, platform dispatch). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument provided?}
    B -- No --> C[Use index = 0\n(most recent)]
    B -- Yes --> D{Is arg a valid integer?}
    D -- No --> E[Return error:\nshow usage hint]
    D -- Yes --> F[index = Number(arg) - 1]
    C --> G[Collect assistant messages\nfrom conversation history\nvia messageCollector]
    F --> G
    G --> H{Any assistant messages\nexist at computed index?}
    H -- No --> I[Return error:\n'No assistant message to copy']
    H -- Yes --> J[Extract text content\nfrom message at index]
    J --> K[Render to plaintext\nvia textRenderer]
    K --> L[platformCopy: detect OS/terminal]
    L --> M{Platform?}
    M -- darwin --> N[spawn pbcopy]
    M -- linux/Wayland --> O[spawn wl-copy]
    M -- linux/X11 xclip --> P[spawn xclip -selection clipboard]
    M -- linux/X11 xsel --> Q[spawn xsel --clipboard --input]
    M -- win32 --> R[spawn powershell -Command Set-Clipboard]
    M -- tmux/kitty/iTerm2 --> S[terminal-native OSC/escape sequence]
    N & O & P & Q & R & S --> T[Emit tengu_copy telemetry]
    T --> U[Return success JSX\nconfirmation to user]
    I --> V[End]
    E --> V
```

---

## Behavioral Spec

### Argument Parsing

The handler (`AcL`) first inspects whether a trailing argument was provided after `/copy`.

```
async function copyCommandHandler(args, context):
    rawArg = args.trim()

    if rawArg is empty:
        targetIndex = 0                     // most-recent response
    else:
        n = Number(rawArg)
        if not Number.isInteger(n) or n < 1:
            return errorResult("usage: /copy N  where N >= 1")
        targetIndex = n - 1                 // 0-based offset from newest
```

Analysis basis: CC v2.1.153 bundle.js:+10725007 (messageCollector call via `SE1`), +10725117 (Number coercion), +10725131 (Number.isInteger guard)

---

### Message Collection

The helper (`SE1`) walks the conversation history and extracts entries whose `role` equals `"assistant"`. Only content blocks whose type is `"text"` are collected.

```
function collectAssistantMessages(conversationHistory):
    results = []
    for message in conversationHistory:
        if message.role == "assistant":
            for block in message.content:
                if block.type == "text":
                    results.push(block.text)
    return results          // ordered newest-first or oldest-first per caller
```

Analysis basis: CC v2.1.153 bundle.js:+10721025 (`SE1` Array.isArray check), +10721057 (text-type filter via `jK`), +10720955 (literal `"assistant"`), +10425080 (literal `"text"`)

---

### Index Resolution and Text Extraction

After collecting messages, the handler selects the entry at `targetIndex`. If the index is out-of-range, it returns the no-message error string.

```
function resolveMessage(messages, targetIndex):
    if messages is empty or targetIndex >= messages.length:
        return { ok: false, reason: "No assistant message to copy" }
    return { ok: true, text: messages[targetIndex] }
```

Analysis basis: CC v2.1.153 bundle.js:+10725046 (H reference for message lookup), +10725048 (literal `"No assistant message to copy"`)

---

### Plaintext Rendering

Before writing to the clipboard, the selected message text is passed through a plaintext renderer (`RE1`). This strips any markdown or terminal-formatting characters so the clipboard content is clean plain text.

```
function renderPlaintext(rawText):
    return rawText.replace(markdownOrAnsiPattern, "")
```

Analysis basis: CC v2.1.153 bundle.js:+10721120 (`RE1` → `H.replace`), +10721160 (literal `"plaintext"`)

---

### Platform-Aware Clipboard Write

The core clipboard function (`RZ`) detects the operating system and active terminal environment, then selects the appropriate native mechanism.

```
async function platformCopy(text):
    encoded = Buffer.from(text, "utf8").toString("base64")   // or raw utf8 pipe

    if env is tmux:
        use tmux load-buffer -w <tempfile>
    else if terminal is kitty:
        write OSC 52 escape sequence
    else if TERM_PROGRAM is iTerm2:
        write iTerm2 escape sequence with base64-encoded payload
    else if platform == "darwin":
        spawn "pbcopy", pipe text to stdin
    else if platform == "linux":
        try "wl-copy"                           // Wayland first
        fallback "xclip" -selection clipboard
        fallback "xsel" --clipboard --input
    else if platform == "win32":
        spawn "powershell" -NoProfile -NonInteractive -Command <Set-Clipboard>
    
    await process exit
```

Analysis basis: CC v2.1.153 bundle.js:+3363674 (`sz_` encoding selector), +3363866 (literal `"darwin"`), +3363892 (literal `"pbcopy"`), +3363918 (literal `"linux"`), +3363957 (literal `"wl-copy"`), +3364003 (literal `"xclip"`), +3364024 (literal `"-selection"`), +3364037 (literal `"clipboard"`), +3364069 (literal `"xsel"`), +3364088 (literal `"--clipboard"`), +3364102 (literal `"--input"`), +3364369 (literal `"win32"`), +3364381 (literal `"powershell"`), +3364395 (literal `"-NoProfile"`), +3363542 (literal `"tmux"`), +3363065 (literal `"kitty"`), +3363470 (literal `"iTerm2"`), +3363480 (literal `"load-buffer"`), +3363643 (literal `"utf8"`), +3363660 (literal `"base64"`)

---

### Temporary File Handling (tmux path)

When operating inside tmux, the text is written to a temporary file under a controlled directory before being loaded into the tmux clipboard buffer, then the file is cleaned up.

```
function writeTempAndLoadTmux(text):
    tmpDir = resolvedTmpDir()           // honours CLAUDE_CODE_TMPDIR
    tmpPath = path.join(tmpDir, randomName)
    ensureDirSecure(tmpPath)            // chmod 448 / 511 checks
    writeFile(tmpPath, text)
    spawn "tmux", ["load-buffer", "-w", tmpPath]
    await exit
    unlink(tmpPath)
```

Analysis basis: CC v2.1.153 bundle.js:+3363514 (literal `"-w"`), +3937622 (literal `"/tmp"`), +3938303 (literal `448` — chmod mode), +3938113 (literal `511` — chmod mode), +3937697 (CLAUDE_CODE_TMPDIR error message fragment)

---

### Telemetry Emission

On successful copy, the handler fires a single telemetry event immediately after the platform write completes.

```
after successful clipboard write:
    emit telemetry("tengu_copy", { ... })
```

Analysis basis: CC v2.1.153 bundle.js:+10725426 (`tengu_copy` event)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (fired on successful clipboard write, +10725426) |
| Clipboard | System clipboard is mutated with the rendered plaintext of the selected assistant message |
| Temp files | A temporary file may be created and deleted under `CLAUDE_CODE_TMPDIR` (or `/tmp`) on the tmux path |
| Process spawning | A short-lived child process (`pbcopy`, `wl-copy`, `xclip`, `xsel`, or `powershell`) is spawned and awaited |
| appState changes | None observed within depth-2 traversal |
| Sound | None observed within depth-2 traversal |
| Hook registration | None observed within depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.153 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy foo` is rejected; the argument must be a positive integer `N ≥ 1`.
2. **Expecting rich-text in clipboard** — The command always strips markdown and ANSI formatting before writing; clipboard content will be plain text.
3. **Running in an unsupported terminal without a clipboard daemon** — On Linux, if none of `wl-copy`, `xclip`, or `xsel` are installed, the copy silently fails. Install at least one clipboard utility.
4. **Off-by-one in N** — `/copy 1` copies the *most recent* response (not the second); `/copy 2` copies the second-most-recent, and so on.
5. **Using `/copy` before Claude has responded** — If no assistant message exists in the current session, the command returns `"No assistant message to copy"` and does not modify the clipboard.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `AcL` | Main async handler for `/copy` command (arbor-resolved entry point) |
| `SE1` | Assistant message collector — filters conversation history for `role=="assistant"` text blocks |
| `RE1` | Plaintext renderer — strips markdown/ANSI from message text before clipboard write |
| `hE1` | Table/layout formatter used when rendering the response preview |
| `adL` | Secondary text extraction helper called from `AcL` |
| `jjH` | Regex replace helper used during text extraction |
| `jK` | Text-type block filter used inside message collector |
| `yE1` | Column/table layout builder (cell padding and alignment) |
| `sdL` | Map helper used by `yE1` |
| `RZ` | Platform-aware clipboard write dispatcher |
| `sz_` | Encoding selector (utf8 / base64) for clipboard payload |
| `hD` | Low-level clipboard write primitive |
| `Q17` | Darwin (`pbcopy`) clipboard path |
| `B17` | Linux Wayland/X11 clipboard path |
| `Zgq` | tmux clipboard path |
| `X0` | kitty OSC-52 clipboard path |
| `fJ` | iTerm2 escape-sequence clipboard path |
| `U17` | Clipboard payload assembler for terminal escape paths |
| `si_` | Clipboard strategy selector (dispatches to `RZ`, `Q4`, `CE1`) |
| `Q4` | Index-search helper (H.indexOf wrapper) |
| `CE1` | Secure temporary directory writer for tmux path |
| `XX` | Temp file directory creator with permission enforcement |
| `hD7` | Directory permission checker (lstatSync + chmodSync) |
| `Md` | Path resolver used inside temp-dir creator |
| `b6` | Config/context loader called from `AcL` |
| `CO_` | Config object helper called from `b6` |
| `EzH` | Global config reader |
| `U6` | JSON.parse wrapper |
| `Pb` | String prefix stripper |
| `UUq` | Config backup directory enumerator |
| `UO_` | Backup path joiner |
| `c` | Generic async callback/continuation |
| `N8` | Background-session state label helper |
| `a6` | String width calculator (wraps `Bun.stringWidth`) |
| `Ar1` | Daemon status file reader |
| `Zi` | Message text extractor called by `Ar1` |
| `v1H` | Text trimmer (trim + pt helper) |
| `r9` | App store accessor (`pD7.getStore`) |
| `dI6` | Path joiner for daemon status (`daemon.status.json`) |
| `RH` | JSON stringifier |
| `J8` | Generic error/result wrapper |
| `wk8` | Memory/platform info helper |
| `yH` | Error logger (`an.logError`) |
| `uH` | Telemetry feature-ok logger |
| `SH` | Telemetry feature-bad logger |