---
type: feature-spec
feature: "copy"
cc_version: "2.1.159"
updated: "2026-06-02"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.159 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.159 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.159

---

## Overview

`/copy` copies Claude's most recent assistant-turn response to the system clipboard. An optional integer argument `N` selects the Nth-latest assistant response instead of the most recent one. The command supports platform-specific clipboard backends (macOS `pbcopy`, Linux `wl-copy`/`xclip`/`xsel`, Windows PowerShell, tmux, kitty, and screen multiplexers) and emits a single telemetry event on completion.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `TN1` |
| load_inline | `true` |
| loc_byte | `10769066` |
| loc_byte_end | `10769252` |
| loc_line | `6682` |
| arbor_handler.name | `JiL` |
| arbor_handler.fqn | `claude-2.1.159::JiL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.159 bundle.js:+10769066

---

## Input Branching

Four distinct paths exist based on whether an argument is supplied, whether it is a valid integer, whether any assistant messages exist in the conversation, and which clipboard backend is available. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/copy [arg]"]) --> B{arg supplied?}
    B -- No --> C[index = 1\n(most recent)]
    B -- Yes --> D{arg is integer?}
    D -- No --> E[Return error:\nbad argument]
    D -- Yes --> F[index = Number(arg)]
    C --> G[Collect assistant messages\nvia messageCollector]
    F --> G
    G --> H{Any assistant\nmessages found?}
    H -- No --> I[Return error:\n'No assistant message to copy']
    H -- Yes --> J[Select Nth-latest message\nvia messageSelector]
    J --> K[Render to plaintext\nvia plaintextRenderer]
    K --> L[Determine clipboard backend\nfor current platform]
    L --> M{Platform?}
    M -- darwin --> N[pbcopy]
    M -- linux/wl --> O[wl-copy]
    M -- linux/x11 --> P[xclip / xsel]
    M -- win32 --> Q[powershell\n-Command Set-Clipboard]
    M -- tmux env --> R[tmux load-buffer]
    M -- kitty env --> S[kitty clipboard OSC]
    M -- screen env --> T[screen paste buffer]
    N --> U[Write text to backend process]
    O --> U
    P --> U
    Q --> U
    R --> U
    S --> U
    T --> U
    U --> V[Emit tengu_copy telemetry]
    V --> W([Done])
    I --> X([Return early])
    E --> X
```

---

## Behavioral Spec

### 1. Argument Parsing (`JiL` entry point)

The handler `JiL` (Arbor-resolved via `module_id` path) is an `AsyncFunction`. It receives the raw command input string.

```
async function copyCommandHandler(rawInput, appState):
    tokens = parseTokens(rawInput)           # messageCollector / PN1
    arg = tokens[0] if tokens else null

    if arg is not null:
        n = Number(arg)
        if not Number.isInteger(n):
            return renderError("invalid argument")
        index = n
    else:
        index = 1                            # default: most recent
```

Analysis basis: CC v2.1.159 bundle.js:+10768251, +10768361, +10768375

### 2. Message Collection (`messageCollector` / `PN1`)

The collector iterates the conversation message array and filters for entries whose role equals `"assistant"` and whose content type includes `"text"`. Only text-typed content blocks are collected.

```
function collectAssistantMessages(messageList):
    result = []
    for msg in messageList:
        if Array.isArray(msg):
            # handle array form
        filtered = filterByContentType(msg, contentType="text")  # jK
        if filtered has assistant role:
            result.push(filtered)
    return result
```

Analysis basis: CC v2.1.159 bundle.js:+10764269, +10764301, +10764317, +10467417

### 3. Message Selection (`messageSelector` / `XN1`)

After collecting all assistant messages, the handler selects the Nth-latest by indexing from the end of the list. It then slices the relevant portion of the message content.

```
function selectNthLatest(assistantMessages, index):
    total = assistantMessages.length
    targetIndex = Math.max(0, total - index)  # clamp to 0
    selected = assistantMessages[targetIndex]
    return selected.slice(...)                # XN1 → A.slice
```

Analysis basis: CC v2.1.159 bundle.js:+10763430, +10764017, +10764028

If no assistant messages are available, the handler returns the literal error string `"No assistant message to copy"`.

Analysis basis: CC v2.1.159 bundle.js:+10768290, +10768292

### 4. Plaintext Rendering (`plaintextRenderer` / `JN1`)

The selected message content is converted to a plain-text string. Markdown table structures are detected and rendered with column separators (`" | "`) and alignment (`"center"`, `"right"`, `"left"`). Pipe characters in cell content are escaped (`"\|"`). Column widths are computed using a Unicode string-width utility (referencing `Bun.stringWidth`). Non-table content is rendered as-is. Output format is controlled by the `"plaintext"` mode constant; a `.txt` extension is referenced for export paths.

```
function renderToPlaintext(messageContent):
    blocks = lexMessage(messageContent)        # K$.lexer
    output = []
    for block in blocks:
        if block.type == "table":
            rows = renderTableRows(block, separator=" | ",
                                   escape="\|", align=["center","right","left"])
            output.append(rows)
        else:
            output.append(block.text)
    return output.join("\n")
```

Analysis basis: CC v2.1.159 bundle.js:+10763302, +10763337, +10763353, +10763364, +10763380, +10763539, +10763574, +10763616, +10763656, +10763850, +10763963, +10764404

### 5. Clipboard Backend Selection and Write (`clipboardWriter` / `h6` → `dZ` → platform dispatch)

The clipboard subsystem (`h6`) selects among multiple backends based on the runtime platform and environment. The resolution order is:

1. **tmux** — detected via `$TMUX` environment variable; uses `tmux load-buffer -w` piped to the paste buffer. The terminal emulator name is checked for `"iTerm2"` as a special case.
2. **kitty** — detected via terminal environment; uses OSC clipboard protocol.
3. **screen** — detected via `$STY` environment variable.
4. **darwin** — uses `pbcopy`.
5. **linux** — tries `wl-copy` (Wayland) first; falls back to `xclip -selection clipboard`, then `xsel --clipboard --input`.
6. **win32** — uses `powershell -NoProfile -NonInteractive -Command Set-Clipboard`.

If no backend succeeds, an error is surfaced to the user.

```
async function writeToClipboard(text, platform, env):
    if env.TMUX:
        if terminalName.startsWith("iTerm2"):
            useOSCMethod(text)
        else:
            spawn("tmux", ["load-buffer", "-w", "-"], stdin=text)
        return
    if env.KITTY_WINDOW_ID:
        useKittyOSC(text)
        return
    if env.STY:                          # screen
        useScreenMethod(text)
        return
    if platform == "darwin":
        spawn("pbcopy", [], stdin=text)
    elif platform == "linux":
        try: spawn("wl-copy", [], stdin=text)
        except: try: spawn("xclip", ["-selection", "clipboard"], stdin=text)
        except: spawn("xsel", ["--clipboard", "--input"], stdin=text)
    elif platform == "win32":
        spawn("powershell", ["-NoProfile", "-NonInteractive",
                             "-Command", "Set-Clipboard ..."], stdin=text)
    else:
        raiseError("unsupported platform")
```

Analysis basis: CC v2.1.159 bundle.js:+3370472, +3370482, +3370516, +3370544, +3370889, +3370915, +3370941, +3370980, +3371026, +3371047, +3371060, +3371092, +3371111, +3371125, +3371392, +3371404, +3371418, +3371431, +3371449

The `screen` multiplexer path uses an escape-sequence approach (`"\x1b\x1b"`) to pass data through the terminal.

Analysis basis: CC v2.1.159 bundle.js:+3369952, +3370195

The encoding used for the clipboard payload is either `"utf8"` or `"base64"` depending on the backend protocol.

Analysis basis: CC v2.1.159 bundle.js:+3370645, +3370662

### 6. Temporary Directory Handling (`tempDirInitializer` / `yX`)

Before spawning clipboard processes, a secure temporary directory is resolved. The default base is `/tmp`, but the environment variable `CLAUDE_CODE_TMPDIR` overrides it. Directory existence and permissions (`448` = `0o700`, `511` = `0o777`) are validated; if the path is not a directory or is controlled by a different owner, a fatal error is thrown:

> "Set CLAUDE_CODE_TMPDIR to a directory you control, or ask an administrator to remove it."

Analysis basis: CC v2.1.159 bundle.js:+3947659, +3947734, +3948150, +3948161, +3948340

### 7. Telemetry Emission

After a successful clipboard write, `JiL` emits the event `tengu_copy`.

Analysis basis: CC v2.1.159 bundle.js:+10768670

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (emitted on successful copy; bundle.js:+10768670) |
| Telemetry (infra) | `tengu_config_parse_error` (+3211632), `tengu_bg_dispatch_sigkill_escalate` (+15469493), `tengu_feature_bad` (+966091), `tengu_feature_ok` (+966033), `tengu_bg_low_mem_mb` (+12731249), `tengu_bg_dispatch_low_mem` (+15470072), `tengu_bg_spare_enable` (+15470767), `tengu_bg_sendclaim_failed` (+15450222), `tengu_bg_spare_claim` (+15470888), `tengu_bg_spare_spawn` (+15469186), `tengu_bg_spare_claim_fail` (+15471151) — these are reachable via shared infrastructure traversed at depth 2 and are not specific to `/copy` |
| Subprocess spawn | Spawns a platform clipboard binary (`pbcopy`, `wl-copy`, `xclip`, `xsel`, `tmux`, `powershell`) with the rendered text piped to stdin |
| Filesystem | Reads/creates a secure temporary directory under `/tmp` (or `CLAUDE_CODE_TMPDIR`) for subprocess IPC; uses `mkdirSync`, `lstatSync`, `chmodSync` |
| appState changes | None detected at depth-2 traversal beyond reading the conversation message list |
| Sound | None detected |
| Hook registration | `zOA.register` is reachable via `K9` (depth 2 via `l17`); this is a file-watch registration hook in the config subsystem, not specific to `/copy` |

---

## Version History

| Version | Change |
|---|---|
| v2.1.159 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy 2.5` or `/copy last` will fail argument validation since `Number.isInteger` is used. Only whole-number integers are accepted.
2. **Using `/copy N` with N larger than the number of assistant turns** — the index is clamped via `Math.max(0, total - N)`, so very large N values silently resolve to the oldest message rather than returning an error.
3. **Expecting `/copy` to work in a clipboard-less environment** — on Linux without `wl-copy`, `xclip`, or `xsel` installed, all backend attempts will fail. Install at least one of these tools.
4. **Expecting rich markdown output** — the command renders to `"plaintext"` mode; markdown formatting (bold, code fences, etc.) is stripped. Tables are preserved with pipe-separated columns.
5. **Using `/copy` when no assistant message exists** — running the command at the very start of a session (before Claude has responded) returns the literal error `"No assistant message to copy"` and nothing is written to the clipboard.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `JiL` | Main async handler for `/copy` command (Arbor-resolved entry point) |
| `JN1` | Plaintext renderer — converts message content blocks to plain text |
| `ziL` | Table cell map helper used during plaintext rendering |
| `XN1` | Message selector — picks Nth-latest assistant message from collected list |
| `OiL` | Lexer wrapper — tokenises message content for rendering |
| `PN1` | Message collector — filters conversation array for assistant text messages |
| `jK` | Content-type filter — retains only `"text"`-typed content blocks |
| `WN1` | String replacement helper used during rendering |
| `lo_` | Clipboard dispatch coordinator — routes to platform backend |
| `dZ` | Platform clipboard writer — contains per-platform spawn logic |
| `ND_` | Screen multiplexer clipboard helper |
| `FD` | Low-level process spawn primitive used by clipboard backends |
| `G77` | Darwin/macOS clipboard handler (`pbcopy`) |
| `X77` | Linux clipboard handler (`wl-copy`/`xclip`/`xsel`) |
| `Ndq` | Fallback clipboard write helper |
| `KW` | Escape-sequence clipboard method (screen `"\x1b\x1b"` path) |
| `WJ` | Kitty/OSC clipboard handler |
| `J77` | Additional multiplexer clipboard helper |
| `a4` | String index-of utility used in message processing |
| `GN1` | Temporary directory initializer — creates and validates secure tmp dir |
| `yX` | Tmp dir path resolver and permission checker |
| `Ux` | Tmp dir path construction helper |
| `DJ7` | Tmp dir lstat/chmod validator |
| `h6` | Clipboard subsystem entry point — selects backend and triggers write |
| `g6` | Config accessor used by clipboard subsystem |
| `fY_` | Config readiness guard |
| `tzH` | Config file reader/parser |
| `U6` | JSON parser wrapper |
| `nb` | String prefix stripper used in config parsing |
| `w8` | Config write helper |
| `UFq` | Config backup directory scanner |
| `DY_` | Backup path joiner |
| `N` | Logging/formatting utility (reached via config subsystem) |
| `tCK` | Log entry formatter |
| `E4` | Log message builder with `[REDACTED]` sanitisation |
| `vuH` | Log colour/style helper |
| `_bK` | Log persistence writer |
| `d` | General async utility / Promise wrapper |
| `w` | Daemon/background-session manager (infra; reachable at depth 2) |
| `S` | Subprocess supervisor (infra) |
| `bH` | Feature-flag OK reporter (`tengu_feature_ok`) |
| `hH` | Feature-flag bad reporter (`tengu_feature_bad`) |
| `Fy8` | Memory check helper (`tengu_bg_low_mem_mb`) |
| `Yw6` | Daemon status file reader (`daemon.status.json`) |
| `SH` | Daemon log-error handler |
| `B` | MCP tool-use session filter (`mcp__` prefix, `tool_use`) |
| `G6` | Background session dispatcher |
| `ZfA` | Background session claim sender |
| `yfA` | Background session lifecycle manager |
| `D` | Daemon restart/dispose loop |
| `l17` | File-watch registration helper |
| `kr` | File-watch callback |
| `K9` | Hook registration wrapper (`zOA.register`) |
| `Xs1` | Daemon status record builder |
| `si` | Daemon status timestamp utility |
| `i1H` | Status text trimmer (limit: 1000 chars; bundle.js:+2198055) |
| `e9` | AsyncLocalStorage store accessor (`TJ7.getStore`) |
| `gk6` | Status JSON path builder (`daemon.status.json`) |
| `RH` | JSON serialiser (`JSON.stringify`) |
| `O` | Background session state object (includes `"stopped"`, `"background session"`) |
| `k8` | Session state label mapper |
| `H8` | Terminal column-width measurer (`Bun.stringWidth`) |
| `aS6` | Plugin path resolver |
| `sS6` | Plugin sync-path builder |
| `rjH` | Code-block language tag stripper |
| `K$` | Markdown lexer module |