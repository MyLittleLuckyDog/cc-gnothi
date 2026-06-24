---
type: feature-spec
feature: "copy"
cc_version: "2.1.190"
updated: "2026-06-24"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.190 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.190 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.190

---

## Overview

The `/copy` command copies Claude's most recent assistant response to the system clipboard. An optional numeric argument (`/copy N`) selects the Nth-latest assistant message instead of the most recent one. The command uses a platform-aware clipboard driver that supports macOS (`pbcopy`), Linux Wayland (`wl-copy`), Linux X11 (`xclip` / `xsel`), tmux buffer, OSC 52 terminal escape sequences, and Windows/WSL PowerShell pipelines.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | Copy Claude's last response to clipboard (or /copy N for the Nth-latest) |
| module_id | `rpl` |
| load_inline | `true` |
| loc_byte | `11189384` |
| loc_byte_end | `11189570` |
| arbor_handler.name | `RYp` |
| arbor_handler.fqn | `claude-2.1.190::RYp` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.190 bundle.js:+11189384

---

## Input Branching

Four distinct paths exist based on the presence of an argument and the availability of assistant messages.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument supplied?}
    B -- "No argument" --> C[target index = 0 (most recent)]
    B -- "Argument present" --> D{Is arg a valid integer?}
    D -- "Yes (N >= 1)" --> E[target index = N - 1]
    D -- "No / non-integer" --> F[Show error: invalid argument]
    C --> G[Collect assistant messages from conversation]
    E --> G
    G --> H{Message exists at target index?}
    H -- "No message found" --> I[Return error: 'No assistant message to copy'\nbundle.js:+11188609]
    H -- "Message found" --> J[Extract plain-text content via renderMessagesToText]
    J --> K[Invoke platform clipboard driver]
    K --> L{Clipboard driver succeeds?}
    L -- "Success" --> M[Emit tengu_copy telemetry\nReturn success JSX]
    L -- "Failure" --> N[Surface clipboard error to user]
```

Analysis basis: CC v2.1.190 bundle.js:+11188568 – +11189111

---

## Behavioral Spec

### 1. Argument Parsing (`RYp` entry point)

```
async function handleCopyCommand(args, conversationState):
    rawArg = args.trim()

    if rawArg is empty:
        targetIndex = 0          // most recent assistant message
    else:
        n = Number(rawArg)
        if not Number.isInteger(n) or n < 1:
            return errorComponent("invalid argument; expected a positive integer")
        targetIndex = n - 1      // 1-based user input → 0-based internal index
```

Analysis basis: CC v2.1.190 bundle.js:+11188678, +11188692

### 2. Message Collection (`collectAssistantMessages` / `epl`)

```
function collectAssistantMessages(messageList):
    filtered = []
    for each message in messageList:
        if Array.isArray(message.content):
            textBlocks = filterTextBlocks(message.content)   // keep "text"-typed blocks
            if textBlocks is non-empty:
                filtered.push(textBlocks)
    return filtered
```

`filterTextBlocks` (identifier `Kl`) selects blocks whose type equals `"text"` (literal at bundle.js:+13664599).

Analysis basis: CC v2.1.190 bundle.js:+11184645, +11184677, +11184693

### 3. Conversation Lookup (`lookupNthLatest` / `Zdl`)

```
function lookupNthLatest(allMessages, targetIndex):
    assistantMessages = collectAssistantMessages(allMessages)
    if assistantMessages is empty:
        return null
    // messages are in chronological order; index 0 = most recent
    return assistantMessages[ assistantMessages.length - 1 - targetIndex ]
```

The function also invokes a table-formatting helper (`Qdl`) for structured content blocks before the text is handed to the clipboard layer.

Analysis basis: CC v2.1.190 bundle.js:+11184272, +11184393, +11184404

### 4. Table Rendering Helper (`renderTableContent` / `Qdl`)

When a message block contains tabular data (separator literal `"\\|"` at bundle.js:+11183768), `Qdl` formats columns with padding and alignment strings `"center"` / `"right"` / `"left"` (literals at bundle.js:+11183962, +11184000, +11184036). Column widths are computed with a string-width helper (`sn` → `Bun.stringWidth`) and padded using `Math.max` (bundle.js:+11183818).

Analysis basis: CC v2.1.190 bundle.js:+11183725 – +11184117

### 5. Plain-text Rendering (`renderMessagesToText` / `IYp`)

```
function renderMessagesToText(messageBlocks):
    result = []
    for each block in messageBlocks:
        cleaned = block.replace(markdownTokenRegex, "")   // strip inline markdown tokens
        result.push(cleaned)
    return result.join("\n")
```

`oRe` performs a regex replacement (bundle.js:+13662515) to strip residual markdown punctuation before the string reaches the clipboard.

Analysis basis: CC v2.1.190 bundle.js:+11183465, +11183474, +11183530

### 6. Platform Clipboard Driver (`writeToClipboard` / `Ybo` → `sv` → `GAn` / `kTi`)

```
async function writeToClipboard(text):
    encoding = detectEncoding()          // "utf8" or "base64"
    method   = detectClipboardMethod()   // one of the strategies below

    switch method:
        case "pbcopy":                   // macOS
            spawn("pbcopy"), pipe text
        case "wl-copy":                  // Linux Wayland
            spawn("wl-copy"), pipe text
        case "xclip":                    // Linux X11
            spawn("xclip", ["-selection", "clipboard"]), pipe text
        case "xsel":                     // Linux X11 fallback
            spawn("xsel", ["--clipboard", "--input"]), pipe text
        case "tmux-buffer":              // inside tmux session
            spawn("tmux", ["load-buffer", "-w", "-"]), pipe text
        case "osc52":                    // terminal OSC 52 escape
            if terminal has OSC-52 Clipboard UTF-8 bug (GAn check):
                emit warning: "VS Code 1.123/1.124 will mojibake this paste — update to ≥1.125"
            write OSC 52 escape sequence to stdout
        case "wsl" / "powershell.exe":   // Windows Subsystem for Linux
            spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ...]), pipe text
        case "raw+dcs" / "dcs" / "raw":  // raw terminal passthrough variants
            write DCS-wrapped OSC 52 escape sequence (e.g. for screen/tmux pass-through)
        case "none":
            return failure("no clipboard mechanism available")

    await process completion (timeout ~2000 ms — bundle.js:+3548508)
```

The clipboard method priority and OS detection rely on environment variables and the `platform` field. The `GAn` helper queries `YO.hasOsc52ClipboardUtf8Bug` (bundle.js:+3547512) and calls `Wud` for the warning display.

Analysis basis: CC v2.1.190 bundle.js:+11184992, +3548137 – +3549032, +3547512, +3547544

### 7. Temporary Directory Safety Check (`hA` / `OSi`)

Before writing clipboard data through a file-backed path on some platforms, the implementation verifies the temp directory with `OSi`:

```
function validateTempDir(path):
    stat = iCe.lstatSync(path)
    if not stat.isDirectory():
        throw Error("not a directory")
    check owner matches current process uid
    if mismatch:
        emit error "tempdir_owner_mismatch"
        advise: "Set CLAUDE_CODE_TMPDIR to a directory you control..."
    iCe.chmodSync(path, 0o700)   // mode 448 decimal — bundle.js:+3385687
```

The default temp path falls back to `"/tmp"` (bundle.js:+3384893).

Analysis basis: CC v2.1.190 bundle.js:+3385061, +3385277, +3385687

### 8. Success / Error Response

On success the handler emits a `tengu_copy` telemetry event (bundle.js:+11188987), then returns a JSX component rendered via `QY.jsx` (bundle.js:+11189111) that displays a confirmation to the user.

On failure (no assistant message found) the constant string `"No assistant message to copy"` is returned (bundle.js:+11188609).

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (bundle.js:+11188987) — fired on every successful copy |
| Clipboard write | Writes text to the OS clipboard via the platform-selected mechanism (pbcopy / wl-copy / xclip / xsel / OSC 52 / PowerShell) |
| Temp directory | May create/chmod a temporary directory under `CLAUDE_CODE_TMPDIR` or `/tmp` for file-backed clipboard paths |
| appState changes | None observed in depth-2 traversal |
| Sound | None observed in depth-2 traversal |
| Hook registration | None observed in depth-2 traversal |

Additional telemetry events visible at depth-2 that originate from shared infrastructure (not specific to `/copy`):

| Event | Origin |
|---|---|
| `tengu_daemon_config_reload` | Daemon config watcher (bundle.js:+17214348) |
| `tengu_daemon_yield` | Daemon yield logic (bundle.js:+17218760) |
| `tengu_mcp_skills` | MCP skill enumeration (bundle.js:+6653418) |
| `tengu_config_auth_loss_prevented` | Config save guard (bundle.js:+13748929) |
| `tengu_bg_retire_pinned_low_mem` | Background worker memory pressure (bundle.js:+17202918) |
| `tengu_config_parse_error` | Config parse error handler (bundle.js:+13754586) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.190 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy foo` or `/copy 1.5` is rejected; only positive whole-number integers are accepted as a selection index.
2. **Using 0 as the index** — The argument is 1-based (Nth-latest). `/copy 0` is invalid; use `/copy` (no argument) for the most recent message.
3. **Expecting clipboard to work in all terminal environments** — If no supported clipboard tool (`pbcopy`, `wl-copy`, `xclip`, `xsel`) is installed and OSC 52 is not available, the command will fail silently or report no clipboard mechanism.
4. **Misreading the VS Code warning** — The warning about VS Code 1.123/1.124 mojibake applies only when the OSC 52 clipboard path is selected; upgrade to VS Code ≥ 1.125 to resolve it.
5. **Expecting formatted markdown output** — The clipboard receives plain text with markdown tokens stripped, not the rendered markdown the terminal displays.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `RYp` | Main async handler for `/copy` command (entry point) |
| `Ybo` | Clipboard orchestrator — selects driver and writes content |
| `sv` | Low-level clipboard write dispatcher (encodes and spawns OS process) |
| `GAn` | OSC 52 clipboard bug detection + warning emitter |
| `kTi` | Platform subprocess spawn helper for clipboard tools (pbcopy, wl-copy, etc.) |
| `Uxt` | Clipboard encoding utility (utf8 / base64) |
| `A_` | Terminal environment detector (screen, kitty, etc.) |
| `a9r` | Linux clipboard tool selector (wl-copy / xclip / xsel) |
| `qud` | tmux buffer clipboard strategy |
| `i9r` | Screen/DCS clipboard passthrough strategy |
| `Fxt` | OSC 52 raw escape sequence builder |
| `Nw` | `replaceAll`-based text sanitiser before OSC 52 write |
| `tE` | DCS-wrapped passthrough joiner |
| `LTi` | Terminal escape sequence assembler helper |
| `nu` | String index helper used during clipboard output path selection |
| `npl` | Temp directory creation and path resolver for file-backed clipboard |
| `hA` | Temp directory validator and chmod helper |
| `RU` | Temp directory path resolver |
| `OSi` | Temp directory ownership/permission checker |
| `B_r` | Atomic file write helper (used in temp-file clipboard path) |
| `Zdl` | Conversation lookup — finds the Nth-latest assistant message |
| `Qdl` | Table-content renderer for message blocks |
| `IYp` | Plain-text renderer — strips markdown tokens from message blocks |
| `epl` | Assistant message collector — filters text blocks from message list |
| `Kl` | Text-block filter (keeps blocks of type `"text"`) |
| `oRe` | Markdown token regex-replace helper |
| `CYp` | Message map helper used inside `Qdl` |
| `Nm` | Markdown lexer wrapper (`DBe.parse`) |
| `tpl` | Plaintext post-processor (regex replace) |
| `Dt` | Config/state writer called on success path |
| `SEe` | Config file read/write helper |
| `BRf` | Config watcher/reloader |
| `mIt` | File watch registration helper |
| `Ofe` | String trim+truncation utility (limit 1000 — bundle.js:+2304160) |
| `sn` | String visual-width helper (`Bun.stringWidth`) |
| `Tf` | String repeat/pad helper (`Number.isFinite` guard) |
| `rUl` | Daemon status helper (`daemon.status.json`) |
| `nVt` | Daemon status path joiner |
| `Me` | JSON serialiser wrapper |
| `Xs` | AsyncLocalStorage store accessor (`KFu.getStore`) |
| `En` | String utility referenced during message text extraction |
| `WKe` | Batched I/O writer with `setTimeout`/`setImmediate` flush |
| `iLc` | Log file append/rotation helper |
| `sLc` | Log file write-and-rotate sub-helper |
| `Ncr` | Log file rotation (stat, rename, unlink) |
| `xre` | Path canonicaliser for log rotation |
| `h8o` | Log path joiner |
| `dpe` | Log entry formatter |
| `hze` | stdout/stderr raw write helper |
| `e8o` | Low-level stream write helper |
| `Ei` | Signal/cleanup hook registrar |
| `T` | Top-level logger / structured log emitter |
| `nLc` | Log level router |
| `wc` | Log message formatter (redacts paths) |
| `p8o` | Redaction map builder |
| `w6o` | Platform path helpers |
| `cn` | Error code string extractor |
| `kn` | Error wrapper/normaliser |
| `T7e` | Extended error attribute helper |
| `Is` | Process exit helper (emits `"cli_error"`, calls `process.exit`) |
| `Pe` | Feature-flag evaluator (`tengu_feature_ok` / `tengu_feature_bad`) |
| `Re` | Feature flag OK branch |
| `Le` | Feature flag OK branch (alternate) |
| `ke` | Telemetry event emitter |
| `d9e` | MCP server registry manager |
| `fBo` | MCP connection retry/apply loop |
| `brr` | MCP connection result applicator |
| `zT` | MCP slot cleanup orchestrator |
| `Hit` | MCP slot hash helper |
| `u9e` | MCP slot PLe hash caller |
| `PLe` | Content hash builder (sha256/hex) |
| `RB` | MCP server config resolver |
| `E7` | MCP server initialiser |
| `K4` | SDK-type MCP server helper |
| `CRn` | MCP config error/warning reporter |
| `Pst` | MCP SSE/HTTP transport setup |
| `aF` | Object.create-based prototype helper |
| `Hua` | MCP cache reader |
| `dZr` | MCP needs-auth cache loader |
| `BUt` | MCP connection slot updater |
| `tMn` | MCP cache file path builder |
| `myn` | MCP capability hash builder |
| `hyn` | MCP capability+hash combiner |
| `wT` | Capability hash writer |
| `fyn` | MCP tool fingerprint helper |
| `Gl` | Tool manifest hash helper |
| `zRn` | MCP OAuth/auth transport manager |
| `aKd` | OAuth flow initiator |
| `lKd` | OAuth callback handler |
| `ln` | MCP debug logger |
| `Vc` | MCP error logger |
| `be` | String coercion wrapper |
| `Aua` | MCP argument validator (uses `ZW`) |
| `ZW` | Stream/async mapper (requires mapper function — bundle.js:+4328493) |
| `yit` | parseInt wrapper (radix 10 — bundle.js:+6865511) |
| `nMn` | parseInt wrapper (radix 20 — bundle.js:+6865691) |
| `_la` | MCP config query helper |
| `rQr` | MCP config resolver sub-helper |
| `eL` | MCP skills enumerator (emits `tengu_mcp_skills`) |
| `it` | Tool registration helper |
| `tJr` | MCP error handler/filter |
| `hn` | Global config save helper |
| `w` | Background session scheduler |
| `ij` | Background session blur/focus tracker |
| `L` | Background worker sweep/lifecycle manager |
| `ycc` | Away-summary message detector |
| `Ecc` | Background session event extractor |
| `m` | Background worker kill helper |
| `x` | Background worker write/signal helper |
| `D` | Worker process wrapper |
| `f` | Background worker pool manager |
| `U` | Worker idle-exit timer |
| `L3o` | Worker socket claim/connect helper |
| `P3o` | Worker lifecycle state machine |
| `p` | Forced-shutdown handler |
| `F` | Background worker interval cleaner |
| `B2e` | Disk cleanup helper for worker state files |
| `GXn` | macOS memory pressure monitor |
| `Kn` | Promise timeout wrapper |
| `Wt` | Process working-directory resolver |
| `OOo` | Config object merger |
| `Gt` | JSON.parse wrapper |
| `u9` | Version string prefix stripper |
| `bGl` | Config backup directory scanner |
| `$Oo` | Config backup path joiner |
| `W` | Structured warning/log emitter |
| `cV` | Config validator |

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.