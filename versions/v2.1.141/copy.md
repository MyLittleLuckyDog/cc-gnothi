---
type: feature-spec
feature: "copy"
cc_version: "2.1.141"
updated: "2026-05-31"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.141 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.141 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.141

---

## Overview

`/copy` copies the most recent assistant (Claude) response to the system clipboard. An optional integer argument `N` allows copying the Nth-latest assistant message instead of the most recent one. The command dispatches a platform-appropriate clipboard utility (e.g., `pbcopy`, `xclip`, `wl-copy`, PowerShell) and emits a `tengu_copy` telemetry event on completion.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `J1q` |
| load_inline | `true` |
| loc_byte | `9987117` |
| loc_byte_end | `9987303` |
| loc_line | `5619` |
| arbor_handler.name | `B37` |
| arbor_handler.fqn | `claude-2.1.141::B37` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.141 bundle.js:+9987117

---

## Input Branching

Three distinct control paths exist depending on whether the argument is absent, a valid integer index, or invalid:

```mermaid
flowchart TD
    A["/copy [arg]"] --> B{Argument present?}
    B -- No --> C[Use index = 1\n(most recent assistant message)]
    B -- Yes --> D{Number.isInteger\n(Number(arg))?}
    D -- No --> E[Return error / ignore\nnon-integer argument]
    D -- Yes --> F[Use index = N\n(Nth-latest assistant message)]
    C --> G[collectAssistantMessages]
    F --> G
    G --> H{Assistant message found\nat index?}
    H -- No --> I[Return static string:\n'No assistant message to copy']
    H -- Yes --> J[extractTextFromMessage]
    J --> K[writeToClipboard\nplatform-dispatch]
    K --> L[Emit tengu_copy telemetry]
    L --> M[Return success JSX to UI]
    E --> N[Return early / no-op]
```

Analysis basis: CC v2.1.141 bundle.js:+9986302, +9986412, +9986426, +9986343

---

## Behavioral Spec

### 1. Argument Parsing (`B37` entry point)

The handler `B37` (AsyncFunction, resolved via `module_id` → `J1q`) performs the following steps on entry:

```
async function handleCopyCommand(context, rawArg):
    messages = collectAssistantMessages(context)   // calls Y1q

    if rawArg is absent or empty:
        targetIndex = 1                             // most recent
    else:
        n = Number(rawArg)
        if not Number.isInteger(n):
            return earlyResult("No assistant message to copy")
        targetIndex = n

    if messages is empty OR targetIndex > messages.length:
        return staticResult("No assistant message to copy")

    // messages are ordered newest-first; index 1 = latest
    selectedMessage = messages[targetIndex - 1]
    text = extractPlainText(selectedMessage)        // calls z1q / b37
    writeToClipboard(text)                          // calls fC_
    emitTelemetry("tengu_copy")                     // loc_byte 9986721
    return successJSX()
```

Analysis basis: CC v2.1.141 bundle.js:+9986302, +9986341, +9986412, +9986426, +9986656, +9986668, +9986677, +9986719, +9986810

---

### 2. Assistant Message Collection (`Y1q`)

Filters the full conversation message list for entries with `role === "assistant"` and content type `"text"`. Also applies a type-narrowing filter via `TK` that checks for `content[*].type === "text"`.

```
function collectAssistantMessages(context):
    allMessages = context.messages               // or context.message
    assistantMessages = allMessages
        .filter(msg => msg.role === "assistant")
        .filter(msg => hasTextContent(msg))      // TK: type === "text"
    return assistantMessages                     // newest-first order
```

Analysis basis: CC v2.1.141 bundle.js:+9982320, +9982250, +9982352, +9840232, +9986597, +9986607

---

### 3. Text Extraction (`z1q` / `b37`)

`z1q` orchestrates extraction of plain text from an assistant message. `b37` handles the low-level lexer pass that strips markdown/formatting tokens into raw text. The extracted text is the concatenated `"plaintext"` representation of all text content blocks.

```
function extractPlainText(message):
    rawTokens = lexer(message.content)           // af.lexer, loc_byte 9981901 / 9981128
    segments = []
    for token in rawTokens:
        cleaned = applyReplacements(token)       // FYH: H.replace, loc_byte 9838588
        segments.push(cleaned)
    return segments.join("")
```

The literal `"plaintext"` (loc_byte 9982455) and `"table"` (loc_byte 9982014) indicate the extractor recognises both plain and table-formatted content blocks.

Analysis basis: CC v2.1.141 bundle.js:+9981901, +9981947, +9982068, +9982079, +9981128, +9981137, +9981193, +9982455, +9982014

---

### 4. Clipboard Write (`fC_` → `mE` / `hRL`)

`fC_` resolves the platform clipboard backend and writes the extracted text. The dispatch is platform-keyed:

```
function writeToClipboard(text):
    platform = detectPlatform()     // process.platform
    switch platform:
        case "darwin":
            spawn("pbcopy", [], stdin=text)              // loc_byte 3234189
        case "linux":
            if available("wl-copy"):
                spawn("wl-copy", [], stdin=text)         // loc_byte 3234254
            elif available("xclip"):
                spawn("xclip", ["-selection", "clipboard"], stdin=text)  // loc_byte 3234300, 3234321, 3234334
            elif available("xsel"):
                spawn("xsel", ["--clipboard", "--input"], stdin=text)    // loc_byte 3234366, 3234385, 3234399
        case "win32":
            spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", ...], stdin=text)
            // loc_byte 3234678, 3234692, 3234705, 3234723
    // Terminal multiplexer override:
    if insideTmux():
        useCommand("tmux load-buffer -w -", ...)          // loc_byte 3233850, 3233788, 3233822
    if terminalIsKitty():
        useKittyProtocol(text)                            // loc_byte 3233285
    if terminalIsITerm2():
        useITerm2OSC(text)                                // loc_byte 3233778
```

The `mE` function handles encoding (literals `"utf8"` at loc_byte 3233951 and `"base64"` at loc_byte 3233968 are used for the kitty/OSC52 path). `hRL` invokes the OS-level write. `kRL` and `NRL` handle fallback/retry logic and string replacement.

Analysis basis: CC v2.1.141 bundle.js:+9982666, +3234163, +3234189, +3234215, +3234254, +3234300, +3234366, +3234666, +3234678, +3233285, +3233778, +3233850, +3233951, +3233968

---

### 5. Temporary File Handling (`w1q`)

When a pipe-based clipboard backend is used, `w1q` writes the text to a temporary file path under a configured temp directory, then passes the file to the clipboard binary. It uses `aY8.mkdir` and `aY8.writeFile`.

```
function writeTempAndCopy(text, tempDir):
    dir = path.join(tempDir, M1q.join(...))      // loc_byte 9982531
    await fs.mkdir(dir, { recursive: true })      // loc_byte 9982558
    filePath = path.join(dir, ...)
    await fs.writeFile(filePath, text)            // loc_byte 9982601
    spawnClipboardCommand(filePath)
```

Analysis basis: CC v2.1.141 bundle.js:+9982524, +9982531, +9982558, +9982601

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_copy` (loc_byte 9986721) — fired once per successful copy invocation. Also in call-graph scope (infrastructure): `tengu_mcp_oauth_flow_start`, `tengu_mcp_oauth_flow_success`, `tengu_mcp_oauth_flow_error`, `tengu_bg_spare_enable`, `tengu_bg_spare_spawn`, `tengu_daemon_config_reload`, `tengu_config_auth_loss_prevented`, `tengu_daemon_control`, `tengu_daemon_yield`, `tengu_config_parse_error`, `tengu_bg_dispatch_sigkill_escalate`, `tengu_feature_bad`, `tengu_feature_ok`, `tengu_bg_low_mem_mb`, `tengu_bg_dispatch_low_mem`, `tengu_bg_sendclaim_failed`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail` — these originate in shared infrastructure traversed by depth-2 BFS and are not specific to `/copy`. |
| Clipboard side effect | Writes text to the system clipboard via a platform-appropriate native binary (see §4). |
| Temporary files | May write a short-lived temp file under the configured CLAUDE_CODE_TMPDIR or system `/tmp` (loc_byte 3797535) for pipe-based backends; cleaned up after the subprocess exits. |
| appState changes | None observed directly; command is read-only with respect to application state. |
| Sound | None detected in traversal. |
| Hook registration | None — `local-jsx` type, no hook registration side effects. |

---

## Version History

| Version | Change |
|---|---|
| v2.1.141 | Initial analysis |

---

## Common Mistakes

1. **Passing a non-integer argument**: `/copy 1.5` or `/copy last` will not parse as a valid index. The handler checks `Number.isInteger(Number(arg))` (loc_byte +9986426); non-integers result in a no-op or error return.
2. **Index out of range**: `/copy 5` when fewer than five assistant messages exist returns the static string "No assistant message to copy" rather than a partial result or an exception.
3. **SSH / remote sessions and Linux clipboard**: On remote SSH sessions, `wl-copy` and `xclip` may not be forwarded. Users should ensure X11 forwarding or use a terminal multiplexer (tmux) with the `load-buffer` mechanism, which the command supports natively.
4. **tmux vs. native clipboard precedence**: If running inside tmux, the `tmux load-buffer` path may override the OS-native clipboard, meaning the text lands in the tmux paste buffer, not the system clipboard, unless tmux clipboard integration is configured.
5. **Expecting rich formatting in clipboard**: The command extracts plain text (`"plaintext"` literal, loc_byte +9982455). Markdown formatting, code fences, and table markup are stripped or normalised by the lexer pass.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `B37` | Main async handler for `/copy` (arbor_handler; AsyncFunction resolved via module_id `J1q`) |
| `Y1q` | Filters conversation message list to assistant-role text messages |
| `TK` | Predicate: checks message content block type equals `"text"` |
| `z1q` | Orchestrates text extraction from a selected assistant message |
| `b37` | Low-level lexer pass; converts message content tokens to plain text |
| `FYH` | Token cleanup via string replacement (strips formatting) |
| `O1q` | Table/column layout formatter used within text extraction pipeline |
| `x37` | Maps over message content segments |
| `D1q` | Additional string replacement utility in extraction path |
| `fC_` | Clipboard write dispatcher; selects platform backend |
| `mE` | Encoding and invocation layer for clipboard binary |
| `lJ` | Builds argument list for clipboard subprocess |
| `IRL` | Resolves platform-specific command path |
| `hRL` | Executes the clipboard write subprocess |
| `kRL` | Fallback/retry handler for clipboard write |
| `NRL` | String replace utility (used in clipboard content preparation) |
| `H7` | String index-of utility |
| `w1q` | Temp-file-based clipboard write path (mkdir + writeFile) |
| `F2` | Temp directory setup helper |
| `YcL` | Validates and prepares temp directory (lstat, chmodSync) |
| `af` | Lexer module wrapper (used by `z1q` and `b37` via `af.lexer`) |
| `q8` | String-width measurement via `Bun.stringWidth` (column sizing) |
| `K` | Column padding helper (`padEnd`) |
| `SH` | JSON serialisation utility (`JSON.stringify`) |
| `mfH` | Text trimming helper; applies `_.trim` with a 1000 ms / 0 boundary (literals loc_byte +2150806, +2150836) |
| `XTq` | Session/store resolution; reads `daemon.status.json` |
| `p7` | AsyncLocalStorage store accessor (`GcL.getStore`) |
| `b06` | Path joiner using `PTq.join` for status file path |
| `RH` | String conversion utility |
| `kH` | Error logging and structured error emitter |
| `k_` | Low-level error formatter |
| `Vq` | Config/state reader |
| `GvK` | Log-ring manager (shift/push on bounded log buffer) |
| `cMH` | Config file reader (readFileSync, statSync, mkdirSync) |
| `h6` | Config watcher / hot-reload coordinator |
| `EhL` | File watch registration (`mi6.watchFile` / `unwatchFile`) |
| `rE9` | Directory scanner for config files |
| `$9_` | Path join helper for backups subdirectory |
| `b6` | JSON parse utility |
| `DR` | Path prefix stripper (`startsWith` / `slice`) |
| `M8` | Utility: unknown (short helper, reached transitively) |
| `x6` | Utility: unknown (short helper, reached transitively) |
| `_9_` | Utility: unknown (short helper, reached transitively) |
| `Jl` | Utility: unknown (reached via `EhL`) |
| `cl` | Utility: unknown (reached via `F2`) |
| `O8` | Utility: maps to `M_` / `N6` (clipboard or I/O helper) |
| `iHq` | Async iterator / mapper (calls `U$H`) |
| `U$H` | Safe-integer-checked async mapper with `AggregateError` support |
| `oX6` | `parseInt` wrapper (radix 10, loc_byte +9584353) |
| `oh_` | `parseInt` wrapper (radix 20, loc_byte +9584451) — likely for secondary numeric parsing |
| `SvH` | MCP server manager (large orchestrator; reached transitively via message map) |
| `Nh_` | MCP connection lifecycle handler |
| `q6H` | MCP OAuth HTTP callback server |
| `FrH` | MCP connection deduplication (Bz8 Map) |
| `lK7` | SSH detection and RH/N_ dispatch for clipboard on remote |
| `LY8` | Builds path to `mcp-needs-auth-cache.json` |
| `sHq` | MCP status poller (reads daemon status then rh_) |
| `rh_` | MCP reconnect health check |
| `Ih_` | MCP token exchange helper |
| `fG_` | Feature flag checker (`A.includes`) |
| `e6` | Config save with auth-loss guard |
| `XA5` | MCP client update orchestrator |
| `z78` | MCP capability set membership test (`tx4.has`, `ex4.has`) |
| `a8` | Timeout-guarded async operation helper |
| `Eeq` | MCP update applier (`H.applyMcpUpdate`) |
| `sI` | MCP cleanup sequencer |
| `irH` | MCP serialisation helper (`SH`) |
| `SQ` | MCP reconnect sequence orchestrator |
| `DB` | Transaction helper (`tx` / `sL`) |
| `tx` | Low-level transaction/lock (`sL`) |
| `Y` | Daemon supervisor write channel |
| `Mo_` | Background session lifecycle manager |
| `Ao_` | Background session socket connector (`sT8.connect`) |
| `w` | Background session pool manager |
| `N` | Background worker subprocess wrapper |
| `S` | Background worker pool (min/max sizing) |
| `j6` | Hooks-file loader (`h6`, `OF` map) |
| `YG6` | Memory reporter (`c6`, `j6`) |
| `v` | Message renderer / formatter (calls `J7K`, `MSH`, `X7K`) |
| `J7K` | Sub-renderer: resolves `zV`, `w7K`, `Qt_` |
| `Qt_` | Low-level render helper (`jKK`, `PKK`) |
| `t7` | Path/content slice utility |
| `T6A` | Content map formatter |
| `MSH` | Output stream write wrapper (`M6A`) |
| `X7K` | File-system-backed render path (stat, append, rotate) |
| `bhH` | Batched line buffer with `setTimeout`/`setImmediate` flush |
| `A_H` | Append-file helper (`$PH.join`, `p8`, `V6`) |
| `Cv8` | File check utility (`M8`) |
| `y6A` | Path join + V6 helper |
| `k6A` | File rotation helper (stat, rename, unlink) |
| `P7K` | Log file append + rotate orchestrator |
| `b9` | Active-file-set tracker (`jI8.add`/`delete`) |
| `XTq` | (duplicate row — same as above; daemon status reader) |
| `G3` | Hook callback invoker (`TpH`, `h6`, `Y1`) |
| `hI` | Hook result combiner (`G3`, `YG_`) |
| `__` | Underscore re-export shim |
| `rX6` | MCP server filter utility |
| `xL7` | Reconnect timestamp recorder (`Date.now`) |
| `nz8` | Auth-cache path resolver (`p7`, `LY8`) |
| `_8` | MCP debug log emitter (`Oc.logMCPDebug`) |
| `_7` | MCP error log emitter (`Oc.logMCPError`) |
| `TH` | String coercion utility (`String(...)`) |
| `iK7` | Unknown MCP step (reached via `Nh_`) |
| `kh_` | MCP complete-authentication handler |
| `BrH` | Pending auth-request lookup (`Uz8.get`) |
| `grH` | Active connection lookup (`Bz8.get`) |
| `cqH` | MCP config-layer merger (enterprise/user/project/local) |
| `$HH` | MCP config aggregator (`qQ`, `cqH`, `$YH`, `MHH`, `Dw6`) |
| `MHH` | SDK-type server collector |
| `Dw6` | SSE/HTTP server deduplication map builder |
| `M78` | Auth key derivation (`aK`) |
| `aK` | Auth token accessor (`IeA`) |
| `Yj` | SHA-256 hash of config (`WV1.createHash`, "sha256", "hex") |
| `wi` | Environment variable reader (`RH`) |
| `$78` | Config hash comparator |
| `H` | Generic short-lived local variable (context-dependent throughout graph) |
| `p` | Session dispose handle (reached via `w`) |
| `u` | Timeout-clearable write wrapper |
| `y` | Transient write channel (`z.write`) |
| `z` | Output stream (`hH`, `xH`, `oR`, `Kx`) |
| `Q` | Promise/result wrapper (context-dependent) |
| `D` | Daemon lifecycle loop (self-recursive, `Date.now`, `Q`, `kH`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.