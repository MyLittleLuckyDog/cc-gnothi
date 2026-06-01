---
type: feature-spec
feature: "copy"
cc_version: "2.1.146"
updated: "2026-06-01"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.146 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.146 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.146

---

## Overview

The `/copy` command copies Claude's most recent assistant-role response to the system clipboard. An optional numeric argument (`/copy N`) selects the Nth-latest assistant message instead of the most recent one. The command works across macOS, Linux (Wayland/X11), Windows, tmux, and Kitty terminal environments by dispatching to the appropriate platform clipboard mechanism.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `r31` |
| load_inline | `true` |
| loc_byte | `10500694` |
| loc_byte_end | `10500880` |
| loc_line | `8370` |
| arbor_handler.name | `P07` |
| arbor_handler.fqn | `claude-2.1.146::P07` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.146 bundle.js:+10500694

---

## Input Branching

Four distinct branches exist: (1) no argument / argument is not a valid integer → use the most-recent assistant message; (2) valid integer N provided → use the Nth-latest assistant message; (3) no assistant message found → return an error notice; (4) message found → render and copy.

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{arg present?}
    B -- "no" --> C[index = 0\n(most recent)]
    B -- "yes" --> D{Number.isInteger\n(Number(arg))?}
    D -- "no" --> C
    D -- "yes" --> E[index = Number(arg) - 1]
    C --> F[collectAssistantMessages]
    E --> F
    F --> G{assistant message\nat index exists?}
    G -- "no" --> H[Return error:\n'No assistant message to copy']
    G -- "yes" --> I[renderMessageToPlaintext]
    I --> J[writeToClipboard\nplatform dispatch]
    J --> K[Emit tengu_copy\ntelemetry event]
    K --> L[Return JSX\nconfirmation UI]
```

Analysis basis: CC v2.1.146 bundle.js:+10499879 – +10500694

---

## Behavioral Spec

### 1. Argument Parsing

```
function parseIndexArgument(rawArg):
    if rawArg is absent or blank:
        return 0                        // most-recent (0-based)
    n = Number(rawArg)
    if not Number.isInteger(n):
        return 0                        // fall back to most-recent
    return n - 1                        // convert 1-based user input to 0-based
```

Analysis basis: CC v2.1.146 bundle.js:+10499989 – +10500003

---

### 2. Collecting Assistant Messages

The handler calls `collectAssistantMessages` (bundle ident `l31`) which:

1. Checks whether its argument is an array (`Array.isArray`).
2. Filters conversation entries through `filterTextContent` (`jK`), which retains only items whose `type` equals `"text"` (Analysis basis: CC v2.1.146 bundle.js:+10211852).
3. Keeps only entries with `role === "assistant"` (literal `"assistant"`, Analysis basis: CC v2.1.146 bundle.js:+10495827).
4. Pushes matching entries into an accumulator and returns it.

```
function collectAssistantMessages(messages):
    if not Array.isArray(messages):
        return []
    result = []
    for each msg in messages:
        textParts = filterTextContent(msg)   // keeps role=assistant, type=text items
        result.push(textParts)
    return result
```

Analysis basis: CC v2.1.146 bundle.js:+10495897 – +10495945

---

### 3. Missing-Message Guard

```
function guardMessageExists(assistantMessages, index):
    msg = assistantMessages[index]
    if msg is undefined or null:
        return { ok: false, text: "No assistant message to copy" }
    return { ok: true, message: msg }
```

Literal error string: `"No assistant message to copy"` (Analysis basis: CC v2.1.146 bundle.js:+10499920).

---

### 4. Rendering to Plaintext

`renderToPlaintext` (bundle ident `c31`) converts the selected message to a plain string suitable for clipboard:

1. Runs the message content through the Markdown lexer (`lexMarkdown`, ident `EM`) (Analysis basis: CC v2.1.146 bundle.js:+10495478).
2. Searches for pipe characters (`\|`) to detect table tokens (literal `"\\|"`, Analysis basis: CC v2.1.146 bundle.js:+10495008).
3. When a table is detected it routes to `renderTable` (`d31`), which:
   - Maps each row through `measureColumnWidths` (`Y07`) using `_.map`.
   - Replaces separators and re-joins cells with ` | ` (literal, Analysis basis: CC v2.1.146 bundle.js:+10495167).
   - Applies `Math.max` for column-width calculation with a minimum column width of `3` (literal, Analysis basis: CC v2.1.146 bundle.js:+10495067).
   - Supports alignment modes `"center"`, `"right"`, and `"left"` (literals, Analysis basis: CC v2.1.146 bundle.js:+10495202, +10495244, +10495284).
   - Uses `measureStringWidth` (`w8`) which delegates to `Bun.stringWidth` for Unicode-aware width (Analysis basis: CC v2.1.146 bundle.js:+10495083).
4. Non-table blocks are serialised through `serializePlainBlock` (`n31`) which performs HTML-entity replacement via `H.replace` (Analysis basis: CC v2.1.146 bundle.js:+10495992).
5. Returns the fully rendered plaintext string (registered token type `"plaintext"`, literal, Analysis basis: CC v2.1.146 bundle.js:+10496032).

```
function renderToPlaintext(message):
    tokens = lexMarkdown(message)
    idx = tokens.indexOf(TABLE_SEPARATOR)   // scans for "|"
    if idx >= 0:
        return renderTable(tokens)
    else:
        return serializePlainBlock(tokens)
```

Analysis basis: CC v2.1.146 bundle.js:+10495478 – +10495656

---

### 5. Platform Clipboard Dispatch

`writeToClipboard` (bundle ident `ST`, called via `Ep_`) selects the appropriate clipboard tool:

```
function writeToClipboard(text):
    platform = process.platform
    if terminalIsKitty():
        return writeKittyClipboard(text)           // Kitty OSC 52
    if env.TMUX is set or isTmux():
        return writeTmuxBuffer(text,               // tmux load-buffer -w
                               tmpFile)
    if platform == "darwin":
        spawn("pbcopy", stdin=text)                // macOS
    else if platform == "linux":
        if wayland():
            spawn("wl-copy", stdin=text)           // Wayland
        else if xclipAvailable():
            spawn("xclip", ["-selection","clipboard"], stdin=text)
        else:
            spawn("xsel", ["--clipboard","--input"], stdin=text)
    else if platform == "win32":
        spawn("powershell",
              ["-NoProfile","-NonInteractive","-Command","..."],
              stdin=text)
```

Relevant literals confirmed:
- `"darwin"` (Analysis basis: CC v2.1.146 bundle.js:+3332257)
- `"pbcopy"` (Analysis basis: CC v2.1.146 bundle.js:+3332283)
- `"linux"` (Analysis basis: CC v2.1.146 bundle.js:+3332309)
- `"wl-copy"` (Analysis basis: CC v2.1.146 bundle.js:+3332348)
- `"xclip"` / `"-selection"` / `"clipboard"` (Analysis basis: CC v2.1.146 bundle.js:+3332394, +3332415, +3332428)
- `"xsel"` / `"--clipboard"` / `"--input"` (Analysis basis: CC v2.1.146 bundle.js:+3332460, +3332479, +3332493)
- `"win32"` (Analysis basis: CC v2.1.146 bundle.js:+3332760)
- `"powershell"` / `"-NoProfile"` / `"-NonInteractive"` / `"-Command"` (Analysis basis: CC v2.1.146 bundle.js:+3332772, +3332786, +3332799, +3332817)
- `"kitty"` (Analysis basis: CC v2.1.146 bundle.js:+3331379)
- `"tmux"` (Analysis basis: CC v2.1.146 bundle.js:+3331944)
- `"load-buffer"` / `"-w"` (Analysis basis: CC v2.1.146 bundle.js:+3331882, +3331916)
- `"iTerm2"` is also detected for special handling (Analysis basis: CC v2.1.146 bundle.js:+3331872)

Temporary file operations for tmux flow use a directory derived from `CLAUDE_CODE_TMPDIR` or `/tmp` (literal, Analysis basis: CC v2.1.146 bundle.js:+3901934). The temp directory is created with mode `448` (octal `0700`) and secured with chmod mode `511` (Analysis basis: CC v2.1.146 bundle.js:+3902615, +3902425).

Analysis basis: CC v2.1.146 bundle.js:+3332074 – +3332128 (handler `ST`), +10496243 – +10496323 (caller `Ep_`)

---

### 6. Clipboard path resolution and file handling

`resolveClipboardPath` (bundle ident `i31`) sets up a temporary scratch directory for clipboard intermediary files:

```
function resolveClipboardPath(basePath):
    dir = path.join(basePath, subdir)
    mkdirSync(dir, { recursive: true })
    ensureDirectoryPermissions(dir)     // chmodSync if needed
    return path.join(dir, filename)
```

Analysis basis: CC v2.1.146 bundle.js:+10496101 – +10496178

---

### 7. Telemetry emission

Immediately after a successful clipboard write, the handler emits the `tengu_copy` event (Analysis basis: CC v2.1.146 bundle.js:+10500298).

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (emitted on successful copy, CC v2.1.146 bundle.js:+10500298) |
| Clipboard | Writes plaintext to OS clipboard via platform-specific subprocess or OSC escape |
| Temp files | May create a temporary file under `CLAUDE_CODE_TMPDIR` or `/tmp` for tmux clipboard path (Analysis basis: CC v2.1.146 bundle.js:+3901934) |
| Hook registration | None detected in depth-2 traversal |
| appState changes | None detected in depth-2 traversal |
| Sound | None detected in depth-2 traversal |
| Indirect telemetry (reachable callgraph) | `tengu_mcp_oauth_flow_start`, `tengu_mcp_oauth_flow_success`, `tengu_mcp_oauth_flow_error`, `tengu_bg_spare_enable`, `tengu_bg_spare_spawn`, `tengu_daemon_config_reload`, `tengu_config_auth_loss_prevented`, `tengu_daemon_yield`, `tengu_config_parse_error`, `tengu_bg_dispatch_sigkill_escalate`, `tengu_feature_bad`, `tengu_feature_ok`, `tengu_bg_low_mem_mb`, `tengu_bg_dispatch_low_mem`, `tengu_daemon_idle_exit`, `tengu_bg_sendclaim_failed`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail` (all via shared infrastructure, not directly related to `/copy` behaviour) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.146 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument** — `/copy foo` silently falls back to copying the most-recent response rather than producing an error, which can be surprising.
2. **Expecting 0-based indexing** — The command uses 1-based indexing for users (`/copy 1` = most recent, `/copy 2` = second most recent). Passing `0` is not a valid integer in the expected range and will fall back to the most-recent message.
3. **Clipboard tool not installed on Linux** — The command tries `wl-copy`, then `xclip`, then `xsel` in order. If none is present, the copy will silently fail or throw an error. Install at least one of these tools in Wayland/X11 environments.
4. **SSH remote sessions and tmux** — On remote SSH sessions without a display server, the tmux code path writes to a temp file and runs `tmux load-buffer`; this only works if the `tmux` binary is reachable and the user is inside a tmux session.
5. **CLAUDE_CODE_TMPDIR security** — If `CLAUDE_CODE_TMPDIR` points to a world-writable or untrusted location, the bundle refuses to use it and logs a warning (literal: `"Set CLAUDE_CODE_TMPDIR to a directory you control…"`, Analysis basis: CC v2.1.146 bundle.js:+3902009).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `P07` | Main async handler for `/copy` command (arbor_handler) |
| `l31` | `collectAssistantMessages` — filters conversation to assistant-role text entries |
| `c31` | `renderToPlaintext` — converts a message to clipboard-ready plain text |
| `d31` | `renderTable` — formats Markdown table tokens as aligned plain-text table |
| `n31` | `serializePlainBlock` — serialises non-table Markdown tokens to plain text |
| `Y07` | `measureColumnWidths` — maps rows to compute per-column widths |
| `w8` | `measureStringWidth` — Unicode-aware string width via `Bun.stringWidth` |
| `jK` | `filterTextContent` — keeps only `type:"text"` message parts |
| `z07` | `lexMarkdownToTokens` — tokenises Markdown input via `EM.lexer` |
| `EM` | `markdownLexer` — Markdown lexer module (wraps `MZH.parse`) |
| `FYH` | `sanitizeTokenText` — applies text replacements to token values |
| `Ep_` | `copyToClipboardOrchestrator` — top-level clipboard write coordinator |
| `ST` | `platformClipboardWriter` — dispatches to OS-specific clipboard command |
| `hj` | `kittyClipboardWriter` — writes via Kitty OSC 52 escape sequence |
| `DQ4` | `buildKittyOscPayload` — constructs Kitty clipboard OSC escape |
| `WQ4` | `darwinClipboardWriter` — spawns `pbcopy` on macOS |
| `JQ4` | `linuxClipboardWriter` — spawns `wl-copy`/`xclip`/`xsel` on Linux |
| `jQ4` | `windowsClipboardWriter` — spawns PowerShell clipboard command on Windows |
| `W8` | `spawnClipboardProcess` — generic process spawner for clipboard commands |
| `i31` | `resolveClipboardTmpPath` — sets up secure temp directory for clipboard intermediary |
| `fX` | `ensureSecureTmpDir` — creates and chmods the temp directory |
| `tHL` | `validateTmpDirSecurity` — lstat + permission checks on temp dir |
| `CL` | `findSubstringIndex` — utility for `indexOf` scanning |
| `c31` | `renderToPlaintext` (see above) |
| `zS1` | `daemonStatusReader` — reads `daemon.status.json` (unrelated to copy flow, reached via shared call graph) |
| `GE6` | `buildDaemonStatusPath` — joins path to `daemon.status.json` |
| `N9H` | `trimDaemonOutput` — trims and processes daemon status content |
| `ul` | `parseDaemonStatus` — parses daemon status JSON |
| `M1` | `getAsyncLocalStore` — retrieves async-local storage context |
| `CH` | `jsonStringifyHelper` — wraps `JSON.stringify` |
| `SH` | `logAndReportError` — unified error logger |
| `n_` | `formatErrorString` — converts Error/string to loggable form |
| `mH` | `coerceToString` — converts value to String |
| `v8` | `backgroundSessionLabel` — returns `"background session"` label |
| `O` | `resolveSessionType` — resolves session type (uses `"stopped"` sentinel) |
| `_O5` | `mcpServerOrchestrator` — MCP server lifecycle manager (shared infra) |
| `_kH` | `mcpConnectionManager` — manages MCP client connections (shared infra) |
| `z4K` | `applyMcpUpdate` — applies MCP config updates (shared infra) |
| `FN` | `cleanupMcpServer` — MCP server cleanup helper |
| `NaH` | `formatMcpCleanupMessage` — formats cleanup notification |
| `yb_` | `mcpConnect` — MCP connection handler (shared infra) |
| `f8H` | `mcpOAuthFlowRunner` — runs MCP OAuth flow (shared infra) |
| `Y$H` | `globalConfigWriter` — saves global config to disk |
| `m6` | `watchGlobalConfig` — sets up config file watcher |
| `cB4` | `configFileWatcher` — file-watch helper for config |
| `pK_` | `getConfigFilePath` — resolves config file path |
| `rI9` | `resolveConfigDir` — finds config directory with backup logic |
| `cK_` | `buildBackupPath` — joins backup sub-path |
| `AC` | `stripConfigPrefix` — strips leading prefix from config key |
| `g6` | `parseJsonSafe` — wraps `JSON.parse` |
| `L8` | `handleEisdir` — handles `EISDIR` filesystem errors |
| `N6` | `loadAndCacheModule` — module loading with cache (shared infra) |
| `AHA` | `daemonSocketConnect` — connects to daemon socket |
| `$HA` | `manageDaemonSession` — manages daemon session lifecycle |
| `rE6` | `checkMemoryPressure` — checks free memory (macOS) |
| `uH` | `reportFeatureBad` — emits `tengu_feature_bad` telemetry |
| `bH` | `reportFeatureOk` — emits `tengu_feature_ok` telemetry |
| `Mi` | `promiseMapperUtility` — generic async mapper with concurrency |
| `wK1` | `buildMcpToolList` — constructs MCP tool list |
| `Y06` | `parseIntRadix10a` — `parseInt` wrapper (base 10) |
| `vx_` | `parseIntRadix10b` — `parseInt` wrapper (base 10, variant) |
| `vd` | `mcpReconnectHandler` — handles MCP reconnection |
| `Fu` | `getAuthTokens` — retrieves auth token set |
| `Yz7` | `detectSshSession` — detects SSH session for clipboard fallback |
| `ZH` | `coerceToStringAlt` — alternate `String()` coercion |