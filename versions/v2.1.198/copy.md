---
type: feature-spec
feature: "copy"
cc_version: "2.1.198"
updated: "2026-07-02"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.198 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.198 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.198

---

## Overview

The `/copy` command copies Claude's most recent assistant message to the system clipboard. An optional numeric argument `N` selects the Nth-latest assistant message instead of the most recent. The command supports multiple clipboard backends (OSC 52, native OS tools, tmux buffer, etc.) and renders a JSX confirmation panel in the terminal.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| loc_byte | `11729241` |
| loc_byte_end | `11729427` |
| loc_line | `7669` |
| module_id | `XBl` |
| load_inline | `true` |
| arbor_handler.name | `yBf` |
| arbor_handler.fqn | `claude-2.1.198::yBf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.198 bundle.js:+11729241

---

## Input Branching

The command has four distinct runtime paths depending on the optional numeric argument and the state of the conversation history, requiring a Mermaid flowchart.

```mermaid
flowchart TD
    A["/copy [N] invoked"] --> B{Parse argument}
    B -- "No argument" --> C[Use N = 1 (most recent)]
    B -- "Argument present" --> D{Is argument an integer?}
    D -- "No" --> E[Display error: invalid argument]
    D -- "Yes" --> F[Use N from argument]
    C --> G[Collect assistant messages from history]
    F --> G
    G --> H{Any assistant messages found?}
    H -- "None" --> I["Display: 'No assistant message to copy'"]
    H -- "At least one" --> J[Select Nth-latest assistant message]
    J --> K[Convert message content to plaintext]
    K --> L{Determine clipboard backend}
    L -- "OSC 52 capable terminal" --> M[Write via OSC 52 escape sequence]
    L -- "macOS" --> N["Spawn pbcopy"]
    L -- "Linux / Wayland" --> O["Spawn wl-copy"]
    L -- "Linux / X11 xclip" --> P["Spawn xclip -selection clipboard"]
    L -- "Linux / X11 xsel" --> Q["Spawn xsel --clipboard --input"]
    L -- "WSL / Windows" --> R["Spawn powershell.exe Set-Clipboard"]
    L -- "tmux" --> S["Load into tmux buffer via load-buffer"]
    L -- "None available" --> T[Clipboard write skipped / warn user]
    M & N & O & P & Q & R & S & T --> U[Emit tengu_copy telemetry]
    U --> V[Render JSX confirmation panel]
```

---

## Behavioral Spec

### 1. Entry point — handler `yBf` (AsyncFunction)

Analysis basis: CC v2.1.198 bundle.js:+11728425

```
async function copyCommandHandler(context):
    rawArg = extractArgument(context)           // KBl  (+11728425)

    if rawArg is present:
        n = Number(rawArg)                      // (+11728535)
        if not Number.isInteger(n):             // (+11728549)
            return renderError("invalid argument")
    else:
        n = 1   // default: most recent message

    messages = collectAssistantMessages(context)   // qBl  (+11728779)

    if messages is empty:
        return renderError("No assistant message to copy")  // (+11728466)

    targetMessage = messages indexed by (n - 1) from the end

    plaintext = convertMessageToPlaintext(targetMessage)   // fBf  (+11728791)

    writeToClipboard(plaintext)                            // FBo  (+11728933)

    emitTelemetry("tengu_copy")                           // V    (+11728842/+11728844)

    return renderJSX(confirmationPanel)                    // $Z.jsx (+11728968)
```

---

### 2. Collecting assistant messages — `qBl`

Analysis basis: CC v2.1.198 bundle.js:+11724083

```
function collectAssistantMessages(context):
    tokens = lexer(context.messages)                 // bh.lexer  (+11724083)

    idx = tokens.indexOf(roleMarker)                 // (+11724129)

    filteredMessages = []
    for each token in tokens:
        if token.role == "assistant":                // literal "assistant" (+11724432)
            filteredMessages.push(token)

    result = renderTableLayout(filteredMessages)     // VBl  (+11724250)
    return result.slice(n)                           // (+11724261)
```

### 3. Table layout renderer — `VBl`

Analysis basis: CC v2.1.198 bundle.js:+11723582

The table renderer formats message content into a terminal-width-aware columnar layout. Key behaviors:

- Calls `mBf` to map raw message tokens (+11723582).
- Replaces pipe characters (`\|`) in content to avoid column-separator conflicts (+11723609, literal `"\\|"` at +11723625).
- Computes column widths using `Math.max` (+11723675) and terminal string-width measurement via `Bun.stringWidth` (through `an`, +11723700).
- Pad separator: `" | "` (literal at +11723784).
- Alignment options `"center"` (+11723819), `"right"` (+11723857), `"left"` (+11723893).
- Minimum column count: `3` (literal at +11723684).
- Uses `hf` to repeat fill characters (+11723838); `Number.isFinite` guards infinite widths (+205091).
- Type string `"table"` (literal at +11724196).

### 4. Plaintext converter — `fBf`

Analysis basis: CC v2.1.198 bundle.js:+11723322

```
function convertMessageToPlaintext(message):
    tokens = lexer(message)                  // bh.lexer  (+11723322)
    result = []
    for each token in tokens:
        if token.type == "code":             // literal "code" (+11723371)
            cleaned = stripMarkdown(token)   // m1e  (+11723331)
        else:
            cleaned = token.text
        result.push(cleaned)                 // n.push  (+11723387)
    return result.join("")
```

- `m1e` uses `e.replace` to strip markdown decoration (Analysis basis: +14157578).
- Message type filter: only tokens with type `"text"` are passed through the `Sl` filter (`e.filter`, +14160064); type literal `"text"` at +14160087.

### 5. Clipboard write — `FBo`

Analysis basis: CC v2.1.198 bundle.js:+11724849

The clipboard write sub-system (`$w` → `yGi` / `W8d` / `GZr` / `z2t` / `ax` / `B_`) selects the appropriate method at runtime.

```
function writeToClipboard(text):
    method = detectClipboardMethod()     // $w  (+3601854)

    match method:
        case "osc52":
            encodeBase64(text)           // literal "base64" (+3601840)
            writeOSC52EscapeSequence()
            if terminal has OSC-52 UTF-8 bug:  // KN.hasOscClipboardUtf8Bug (+3601229)
                warn("VS Code 1.123/1.124 will mojibake this paste — update to ≥1.125")
                                         // literal at +3601286

        case "tmux-buffer":
            spawnCommand("tmux", ["load-buffer", "-w", tempFile])
                                         // literals at +3601506, +3601514, +3601528

        case "macos":
            spawnCommand("pbcopy", [])   // literal "pbcopy" (+3602259)
            timeout: 2000 ms             // literal (+3602225)

        case "linux" / "wl-copy":
            spawnCommand("wl-copy", [])  // literal (+3601017)

        case "linux" / "xclip":
            spawnCommand("xclip", ["-selection", "clipboard"])
                                         // literals (+3601086, +3602488)

        case "linux" / "xsel":
            spawnCommand("xsel", ["--clipboard", "--input"])
                                         // literals (+3601127, +3602575, +3602589)

        case "wsl" / "windows":
            spawnCommand("powershell.exe", ["-NoProfile", "-NonInteractive",
                                            "-Command", "Set-Clipboard"])
                                         // literals (+3602661, +3602679, +3602692, +3602710)

        case "none":
            // No clipboard available; skip silently or warn
```

**Terminal detection constants** (from `$w` sub-graph):
- `"screen"` (+3600010) — detect GNU Screen.
- `"kitty"` (+3600479) — Kitty terminal.
- `"tmux"` (+3601506), `"tmux-buffer"` (+3600879).
- `"raw+dcs"`, `"dcs"`, `"raw"`, `"none"` (+3601938, +3601961, +3601967, +3602012) — OSC-52 capability levels.
- `"linux"` (+3600938), `"macos"` (+3602248), `"windows"` (+3602740), `"wsl"` (+3602651).
- Encoding: `"utf8"` (+3601823), `"base64"` (+3601840).
- Escape sequence double-ESC: `"\x1b\x1b"` (+3600607).

**Temp-file path** for clipboard intermediary: base under `"/tmp"` (+3451225), permissions `448` (octal 700) (+3452019) and `511` (octal 777) (+3451829). Environment variable `CLAUDE_CODE_TMPDIR` is checked; if the directory owner does not match, error code `"tempdir_owner_mismatch"` (+3451619) is raised with advisory message `"Set CLAUDE_CODE_TMPDIR to a directory you control, or ask an administrator to remove it."` (+3451300).

### 6. Plaintext file write — `YBl`

Analysis basis: CC v2.1.198 bundle.js:+11724706

When a file-based path is required (e.g., for the tmux-buffer method):

```
function writeTextFile(content):
    dir = joinPaths(GBl, randomSuffix)    // GBl.join  (+11724713)
    mkdirAsync(dir)                        // BBl.mkdir (+11724740)
    resolveSymlinks(dir)                   // GMt        (+11724783)
    filename = content + ".txt"            // literal ".txt" (+11724669)
    write(filename, content,
          encoding = "plaintext")          // literal (+11724637)
```

The atomic file write utility (`GMt`) performs symlink resolution, random-bytes temp naming, fsync, and rename to ensure durability (Analysis basis: +1115423–+1117641).

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (+11728844); `tengu_config_parse_error` (+14259169); `tengu_daemon_config_reload` (+18392244) |
| Clipboard write | Writes to system clipboard via one of: OSC 52, `pbcopy`, `wl-copy`, `xclip`, `xsel`, `powershell.exe`, or tmux buffer |
| Temp file | May create a temp file under `/tmp` (or `CLAUDE_CODE_TMPDIR`) with permissions `0700`; cleaned up after clipboard operation |
| appState changes | None observed at depth ≤ 2 |
| Hook registration | `sus.register` reached transitively via config reload path (`Si`, +69675); not directly invoked by `/copy` |
| Sound | None observed |
| JSX render | Renders a confirmation component via `$Z.jsx` (+11728968) |
| Error display | Literal `"No assistant message to copy"` (+11728466) rendered when history has no assistant turns |

---

## Version History

| Version | Change |
|---|---|
| v2.1.198 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy 1.5` or `/copy foo` will fail the `Number.isInteger` check and display an error rather than copying anything.
2. **Requesting N beyond history depth** — if fewer than N assistant messages exist in the current session, the selection will be out of range and no content will be copied.
3. **Clipboard unavailable in headless/CI environments** — when no clipboard backend is detected (`"none"` path), the command completes without error but the clipboard is not populated; there is no explicit warning in all paths.
4. **VS Code terminal UTF-8 clipboard bug** — VS Code versions 1.123 and 1.124 have a known OSC-52 UTF-8 encoding bug; the command emits a warning when this terminal is detected, but the paste may still be garbled unless VS Code is updated to ≥ 1.125.
5. **`CLAUDE_CODE_TMPDIR` ownership** — if `CLAUDE_CODE_TMPDIR` is set to a directory not owned by the current user, the temp-file path is rejected with `tempdir_owner_mismatch` and the clipboard write fails.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `yBf` | Main async handler for `/copy` command (entry point) |
| `KBl` | Argument extraction utility |
| `qBl` | Assistant message collector / history filter |
| `VBl` | Terminal table layout renderer |
| `mBf` | Message token mapper (called by table renderer) |
| `fBf` | Message-to-plaintext converter |
| `m1e` | Markdown strip / replace helper |
| `Sl` | Content-type filter (`"text"` blocks only) |
| `FBo` | Clipboard write dispatcher |
| `$w` | Clipboard method selector / OSC-52 encoder |
| `yGi` | OSC-52 sequence writer |
| `W8d` | tmux clipboard write helper |
| `GZr` | Terminal type detector |
| `z2t` | Clipboard command builder |
| `ax` | Escape-sequence escape helper (double-ESC) |
| `B_` | Clipboard argument joiner |
| `_Gi` | Terminal capability probe |
| `K2t` | Platform identifier resolver |
| `HH` | Low-level terminal write |
| `xDn` | OSC-52 UTF-8 bug detector |
| `G8d` | Bug-detection branch handler |
| `Cu` | String indexOf utility |
| `YBl` | Plaintext temp-file writer |
| `pS` | Temp directory setup |
| `B$` | Temp directory path builder |
| `C4i` | Directory stat / ownership checker |
| `GMt` | Atomic file write (symlink-safe, fsync+rename) |
| `zws` | File write with lock helper |
| `$Mt` | File open/write/close primitive |
| `ant` | fsync error handler |
| `JBe` | File rename helper |
| `mn` | Error normalizer |
| `eLs` | Object.defineProperty helper |
| `zBl` | Text escape/replace helper |
| `bh` | Markdown lexer wrapper |
| `Flc` | Daemon status accessor |
| `ftn` | Daemon status file path builder (`daemon.status.json`) |
| `Ys` | AsyncLocalStorage store reader |
| `Me` | JSON serializer |
| `Ene` | Content normalizer |
| `C_e` | Text trimmer (max 1000 chars, +2356745) |
| `un` | Session state tagger (`"stopped"`, `"background session"`) |
| `an` | Terminal string-width measurer (`Bun.stringWidth`) |
| `hf` | Character repeat utility |
| `tge` | Spend-block response builder |
| `As` | CLI exit handler |
| `Dt` | Configuration loader dispatcher |
| `SCt` | Configuration file reader |
| `qHm` | Config watch / reload orchestrator |
| `QMt` | File watcher setup |
| `Re` | Config change event emitter |
| `yhe` | Config reload helper |
| `Si` | Hook/signal registrar |
| `V` | Telemetry emitter |
| `T` | Debug log writer |
| `Hiu` | Log formatter |
| `Oc` | Log line builder |
| `biu` | Subprocess runner |
| `UEr` | Path prefix stripper |
| `k` | File watcher (chokidar-style) |
| `I7o` | Config backup directory resolver |
| `v7o` | Backup path joiner |
| `Gt` | JSON.parse wrapper |
| `c6` | Version prefix parser |
| `en` | Error encoder |
| `A7o` | Config schema validator |
| `d` | MCP server supervisor manager |
| `h` | Async file write handle |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.