---
type: feature-spec
feature: "copy"
cc_version: "2.1.160"
updated: "2026-06-02"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.160 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.160 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.160

---

## Overview

`/copy` copies Claude's most recent assistant response to the system clipboard. An optional integer argument `N` selects the Nth-latest assistant response instead of the most recent one. The command resolves the target message, extracts its text content, and dispatches the result to the platform-appropriate clipboard backend.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| loc_byte | `10880712` |
| loc_byte_end | `10880898` |
| loc_line | `7193` |
| module_id | `ny1` |
| load_inline | `true` |
| arbor_handler.name | `D4f` |
| arbor_handler.fqn | `claude-2.1.160::D4f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.160 bundle.js:+10880712 – +10880898

---

## Input Branching

The command has four distinct logical branches depending on whether the optional argument is present, valid, and whether an assistant message exists.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument provided?}
    B -- No --> C[Use index = 1 (most recent)]
    B -- Yes --> D{Parse as integer via Number()}
    D -- Not an integer --> E[Treat as index = 1 / ignore invalid arg]
    D -- Is integer N --> F[Use index = N (Nth-latest)]
    C --> G[Collect assistant messages from conversation history]
    E --> G
    F --> G
    G --> H{Assistant message found at index?}
    H -- No --> I[Return error: 'No assistant message to copy']
    H -- Yes --> J[Extract text content blocks from message]
    J --> K[Render message content via renderMessageContent]
    K --> L[Write rendered text to clipboard via platform backend]
    L --> M[Emit tengu_copy telemetry]
    M --> N[Return success JSX notification]
```

Analysis basis: CC v2.1.160 bundle.js:+10879897 – +10880405

---

## Behavioral Spec

### 1. Argument Parsing

```
async function copyCommandHandler(context):
    rawArg = context.userInput  // text following "/copy"
    index = 1                   // default: most-recent assistant message

    if rawArg is not empty:
        n = Number(rawArg.trim())
        if Number.isInteger(n) AND n >= 1:
            index = n
        // non-integer arguments are silently treated as default (index=1)
```

Analysis basis: CC v2.1.160 bundle.js:+10880007 – +10880021

### 2. Message Collection and Selection

```
function collectAssistantMessages(conversationHistory):
    // Filter conversation messages to role == "assistant"
    // Only include messages with content blocks of type "text"
    assistantMessages = conversationHistory
        .filter(msg => msg.role == "assistant")
        .filter(msg => hasTextContent(msg))
    return assistantMessages
```

The filter for text-type blocks is performed by function `filterByContentType`
(obfuscated: `IK`) which retains only blocks where the `type` field equals `"text"`.

Analysis basis: CC v2.1.160 bundle.js:+10875915, +10875947, +10575288

```
function selectTargetMessage(assistantMessages, index):
    // index is 1-based from most recent; reverse-order lookup
    target = assistantMessages[assistantMessages.length - index]
    if target is undefined:
        return ERROR("No assistant message to copy")
    return target
```

Analysis basis: CC v2.1.160 bundle.js:+10879936 – +10879938

### 3. Content Rendering

The selected message's content is processed by `renderMessageContent` (obfuscated: `Qy1`), which:

1. Tokenises the message body via the lexer (`J$.lexer`).
2. Locates table blocks and renders them with column-width calculations using `Math.max` and `Bun.stringWidth` for terminal-aware character counting.
3. Column alignment strings `"center"`, `"right"`, and `"left"` are supported (bundle.js:+10875220, +10875262, +10875302); pipes are escaped as `"\\|"` (bundle.js:+10875026).
4. Joins rendered segments with `" | "` separator (bundle.js:+10875185).
5. Non-table sections pass through as `"plaintext"` (bundle.js:+10876050).

Analysis basis: CC v2.1.160 bundle.js:+10875496 – +10875674

### 4. Clipboard Dispatch

After rendering, `writeToClipboard` (obfuscated: `sG`, called via `bs_`) selects the appropriate platform backend:

```
function writeToClipboard(text):
    platform = detectPlatform()

    if platform == "macos":
        if terminalEnv == "iTerm2":
            // use tmux load-buffer with -w flag (OSC 52 passthrough)
            exec("tmux", ["load-buffer", "-w", "-"])
        else if terminalEnv == "tmux":
            exec("tmux", ["load-buffer", "-"])
        else if terminalEnv == "screen":
            // use OSC escape sequences directly
            writeOSCSequence(text)
        else if terminalEnv == "kitty":
            // kitty clipboard protocol
            writeKittyClipboard(text)
        else:
            exec("pbcopy")

    else if platform == "linux":
        // Try Wayland first, then X11 variants
        if waylandDisplayAvailable():
            exec("wl-copy")
        else if xclipAvailable():
            exec("xclip", ["-selection", "clipboard"])
        else:
            exec("xsel", ["--clipboard", "--input"])

    else if platform == "wsl":
        exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ...])

    else if platform == "windows":
        exec("powershell", ...)

    // Write text encoded as utf-8 or base64 depending on backend
    // Timeout for clipboard subprocess: 2000 ms
    await spawnWithTimeout(clipboardProcess, text, timeout=2000)
```

Analysis basis: CC v2.1.160 bundle.js:+3406875 – +3407689
Clipboard subprocess timeout: 2000 ms (bundle.js:+3407075)
Platforms detected: `"macos"` (+3407109), `"linux"` (+3407135), `"wsl"` (+3407586), `"windows"` (+3407689)
Terminal environments: `"iTerm2"` (+3406671), `"tmux"` (+3406743), `"screen"` (+3406099), `"kitty"` (+3406214)
Encodings used: `"utf8"` (+3406844), `"base64"` (+3406861)

### 5. Temporary File Path Resolution

The platform's temp-dir helper (`pP`) resolves an appropriate working directory for clipboard subprocess I/O:

```
function resolveTempDir():
    base = env.CLAUDE_CODE_TMPDIR ?? "/tmp"
    // Validates ownership: if directory is not owned by current user,
    // throws with message advising to set CLAUDE_CODE_TMPDIR
    // Creates subdirectory with mode 448 (octal 0o700) if absent
    // Sets mode 511 (octal 0o777) on the leaf path
    return joinedPath
```

Analysis basis: CC v2.1.160 bundle.js:+3984986, +3984407, +3985088, +3984898
Error message: `"Set CLAUDE_CODE_TMPDIR to a directory you control, or ask an administrator to remove it."` (bundle.js:+3984482)

### 6. Output File Format for Plaintext

When the rendered content type is `"plaintext"`, the output is written with extension `".txt"` (bundle.js:+10876082) before being piped into the clipboard subprocess.

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` emitted on every successful copy invocation (bundle.js:+10880316) |
| Telemetry (indirect) | `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` for feature-flag checks (bundle.js:+966123, +966181, +966258) |
| Telemetry (indirect) | `tengu_config_parse_error` if config read fails during handler setup (bundle.js:+3248346) |
| Clipboard side effect | Writes rendered assistant message text to the system clipboard via OS-native subprocess |
| Temp file I/O | May create a temporary file under `CLAUDE_CODE_TMPDIR` or `/tmp` for clipboard pipe |
| Hook registration | No command-specific hooks detected in depth-2 traversal |
| appState changes | None detected in depth-2 traversal |
| Sound | None detected |

---

## Version History

| Version | Change |
|---|---|
| v2.1.160 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy foo` silently falls back to copying the most recent message rather than reporting an error. Users expecting an error notification may be confused.
2. **Using index 0 or negative values** — Only positive integers ≥ 1 are treated as valid indices. Index 0 will not select any message and the command will fall back to default behaviour or emit the "No assistant message to copy" error.
3. **No assistant message in history** — Running `/copy` at the very start of a session (before Claude has replied) yields the literal error string `"No assistant message to copy"` (bundle.js:+10879938) with no clipboard write.
4. **Clipboard tool unavailable on Linux** — If none of `wl-copy`, `xclip`, or `xsel` is installed, the clipboard dispatch will fail silently or with a subprocess error; no user-facing fallback message is surfaced within the depth-2 call graph.
5. **WSL environment detection** — Users running WSL must ensure `powershell.exe` is accessible in their PATH; the command does not fall back to Linux clipboard tools when running under WSL.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `D4f` | Main async handler for `/copy` command (Arbor-resolved entry point) |
| `gy1` | Table-rendering helper: formats assistant message content as a terminal table |
| `f4f` | Table cell content mapper (called within table renderer) |
| `Qy1` | `renderMessageContent`: tokenises and renders full message content |
| `L4f` | Lexer-based code-block extractor: collects fenced code blocks from message text |
| `ZJH` | Code-block text cleaner / escape normaliser |
| `cy1` | Inline text replacement helper |
| `dy1` | Message content array accumulator: checks `Array.isArray`, pushes items |
| `IK` | `filterByContentType`: filters content blocks by `type == "text"` |
| `bs_` | Clipboard write orchestrator: calls `sG` and manages temp-file lifecycle |
| `sG` | Platform clipboard dispatcher: selects backend and spawns subprocess |
| `rw_` | Platform/environment detector used by clipboard dispatcher |
| `MY` | Low-level clipboard write primitive |
| `ZXL` | Tmux clipboard backend handler |
| `h8` | Generic subprocess spawn helper for clipboard tools |
| `EXL` | Tmux load-buffer variant (passthrough mode) |
| `blq` | Screen/OSC escape-sequence clipboard writer |
| `JW` | Kitty clipboard protocol writer |
| `bJ` | Fallback concatenation clipboard writer |
| `TXL` | Base primitive for escape-sequence clipboard backends |
| `LL` | Utility: `indexOf`-based substring search |
| `ly1` | Temp-file write helper: creates directory and writes clipboard payload to file |
| `pP` | Temp-dir resolver: validates `CLAUDE_CODE_TMPDIR` or `/tmp` |
| `sx` | Temp path joiner / path-component utility |
| `PyL` | Directory permission validator and `chmodSync` applier |
| `aHK` | Daemon status accessor (reads `daemon.status.json`) |
| `ny6` | Status file path builder |
| `SH` | `JSON.stringify` wrapper |
| `q8` | Terminal string-width calculator (wraps `Bun.stringWidth`) |
| `K` | Column padding helper: `padEnd` for table column alignment |
| `qC6` | Plugin path normaliser / relative-path resolver |
| `KC6` | Plugin subdirectory path joiner |
| `J$` | Lexer module: exposes `J$.lexer` for tokenising message content |
| `R6` | Config loader / project config reader |
| `ZDH` | Config file reader: `readFileSync`, backup logic, `statSync` |
| `nQq` | Backup directory enumerator for config files |
| `uY_` | Backup path join helper |
| `m6` | `JSON.parse` wrapper |
| `Ax` | String prefix stripper (`startsWith` + `slice`) |
| `G8` | Generic utility (reachable from multiple paths; exact role unclear) |
| `d6` | Config directory path resolver |
| `hY_` | Config path helper |
| `ojL` | Config file watcher (registers `watchFile`/`unwatchFile`) |
| `O9` | FinalizationRegistry registration helper |
| `Br` | Config-change callback handler |
| `d` | Logging / diagnostics utility |
| `w` | Background session worker / daemon orchestrator |
| `S` | Daemon subprocess writer |
| `RH` | Daemon session reporter |
| `hH` | Daemon health-check helper |
| `gh8` | Memory monitor (reads `os.freemem`, emits `tengu_bg_low_mem_mb`) |
| `fj6` | Background session config file reader |
| `yH` | Background session state updater |
| `F` | Promise/task retirement helper |
| `W6` | Config refresh orchestrator |
| `w$A` | Spare-process claim handler |
| `T$A` | Background task lifecycle manager |
| `Y` | Forced-shutdown handler (`process.exit`) |
| `R` | Rate-limit event enqueuer |
| `H` | Bootstrap fetch helper (context-dependent; appears in multiple call chains) |
| `N` | Bootstrap response normaliser |
| `o$` | Bootstrap error handler |
| `Ce` | Feature-flag set lookup |
| `wj` | Bootstrap text replacement utility |
| `gq` | Bootstrap response formatter |
| `t6` | Bootstrap error reporter |
| `M` | Plugin staging cleaner |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.