---
type: feature-spec
feature: "remote-control"
cc_version: 2.1.187
updated: "2026-06-11"
tags: ["remote-control", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.169
analysis_basis: "CC v2.1.169 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/remote-control`

> Analysis basis: CC v2.1.169 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.169

---

## Overview

`/remote-control` (alias `/rc`) manages the Remote Control feature, which allows an external client — such as a phone or the claude.ai/code web interface — to control the current Claude Code CLI session. Depending on whether a remote-control session is already active, the command either disconnects the existing session or initiates a new one by rendering a JSX component. It accepts an optional `[name]` argument to identify the remote session.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `remote-control` |
| description | `Disconnect Remote Control \| Control this session from your phone or claude.ai/code` |
| aliases | `["rc"]` |
| argumentHint | `[name]` |
| immediate | `true` |
| isHidden | `null` (not hidden) |
| module_id | `M3K` |
| load_inline | `true` |
| loc_byte | `12902530` |
| loc_byte_end | `12902854` |
| loc_line | `9154` |
| arbor_handler.name | `odf` |
| arbor_handler.fqn | `claude-2.1.169::odf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `3` |

Analysis basis: CC v2.1.169 bundle.js:+12902530

---

## Input Branching

The command has 3+ distinct execution paths based on input argument presence, existing session state, and close/connect logic, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/remote-control called\nwith optional arg]) --> B[Trim and normalize argument\nvia handler odf]
    B --> C{Argument provided\nand non-empty?}
    C -- "No argument" --> D{Active remote-control\nsession exists?}
    C -- "Argument provided" --> E[Normalize argument\nto lowercase]
    E --> D2{Active remote-control\nsession exists?}
    D -- "No active session" --> F[Render JSX component\nto prompt new connection]
    D -- "Active session" --> G[Close existing\nremote-control connections]
    D2 -- "No active session" --> F2[Render JSX component\nwith named session]
    D2 -- "Active session" --> G
    G --> H[Call close on primary\nand secondary connection objects]
    H --> I[Connection cleanup:\nremove from active set,\nfinalize connection lifecycle]
    I --> J{Cleanup success?}
    J -- "Error during cleanup" --> K[Report cli_error,\nexit with code 1]
    J -- "Success" --> L([Session disconnected])
    F --> M([JSX UI rendered\nfor new session])
    F2 --> M
```

Analysis basis: CC v2.1.169 bundle.js:+12902196, +12902220, +16518551, +16518561, +16518701, +13208371, +13208394

---

## Behavioral Spec

### Handler Entry: Argument Normalization

The async handler `odf` is the primary entry point resolved via `module_id` → `M3K`.

```
async function remoteControlHandler(args, context):
    rawArg = args.trim()                  // strip whitespace from input argument
    if rawArg is non-empty:
        normalizedArg = rawArg.toLowerCase()   // case-insensitive session name
    else:
        normalizedArg = null
    
    if activeSessionExists():
        disconnectSession(normalizedArg)
    else:
        return renderConnectionUI(normalizedArg)
```

Analysis basis: CC v2.1.169 bundle.js:+12902196

### JSX Rendering for New Connection

When no active remote-control session exists, the handler renders a JSX element via `createElement` to present the user with connection options (phone or claude.ai/code).

```
function renderConnectionUI(sessionName):
    element = createElement(RemoteControlComponent, {
        name: sessionName
    })
    return element   // local-jsx type: returned element is rendered by the CLI shell
```

Analysis basis: CC v2.1.169 bundle.js:+12902220

### Session Disconnect Logic

When an active session is detected, the disconnect path is followed. Two connection objects are closed in sequence, then a cleanup function manages the session registry.

```
function disconnectSession(sessionName):
    // Close both tracked connection handles
    primaryConnection.close()       // loc_byte: 16518551
    secondaryConnection.close()     // loc_byte: 16518561
    
    // Run post-close lifecycle management
    manageConnectionLifecycle()
```

Analysis basis: CC v2.1.169 bundle.js:+16518549, +16518551, +16518561

### Connection Lifecycle Management

A dedicated function (`connectionLifecycleManager`, obfuscated as `L`) handles adding and removing connections from the active session set, and registers a `.finally()` cleanup handler.

```
function connectionLifecycleManager(connection):
    activeSessionSet.add(connection)         // register in active set
    connection.finally(() => {
        activeSessionSet.delete(connection)  // remove on completion
    })
```

Analysis basis: CC v2.1.169 bundle.js:+16512500, +16512509, +16512523

### Data Stream Processing

Incoming data from the remote connection is read from a `"data"` event stream. A maximum chunk size of **1024 bytes** applies per read operation (bundle.js:+16413011). Lines/tokens are normalized with a length cap of **40 characters** (bundle.js:+16533353).

```
function processRemoteStream(stream):
    stream.on("data", (chunk) => {     // event name: "data", loc_byte: 16412958
        if chunk.length > 1024:
            chunk = chunk.slice(0, 1024)    // enforce 1024-byte limit
        token = chunk.toLowerCase()
        if token.length > 40:
            token = token.slice(0, 40)      // enforce 40-char token limit
        handleToken(token)
    })
```

Analysis basis: CC v2.1.169 bundle.js:+16412958, +16413011, +16533279, +16533353

### Error Handling and Exit

If a CLI-level error occurs during connection teardown or stream processing, the error is reported as a `"cli_error"` event and the process exits with code `1`.

```
function handleFatalError(error):
    reportError("cli_error", error)     // telemetry-like error identifier
    process.exit(1)                     // exit code 1
```

Analysis basis: CC v2.1.169 bundle.js:+13208371, +13208378, +13208381, +13208394, +13208407

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal (`telemetry: []`) |
| Active session set | Entries added via `activeSessionSet.add()` on connect; removed via `activeSessionSet.delete()` on finalize (bundle.js:+16512500, +16512523) |
| Connection close | Calls `.close()` on two distinct connection objects when disconnecting (bundle.js:+16518551, +16518561) |
| JSX rendering | Returns a `createElement`-based UI element for the CLI shell to render when initiating a new session (bundle.js:+12902220) |
| Error exit | Fatal errors during teardown trigger `process.exit(1)` (bundle.js:+13208394) |
| Data stream | Reads from `"data"` events on the remote stream; enforces 1024-byte chunk limit and 40-character token limit |
| Argument normalization | Input argument is trimmed and lowercased before use (bundle.js:+12902196, +16533279) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.169 | Initial analysis |

---

## Common Mistakes

1. **Calling `/rc` expecting it always to open a new session** — if a remote-control session is already active, the command will disconnect it instead of opening a new one. Check connection state before invoking.
2. **Passing a mixed-case session name** — the argument is normalized to lowercase internally; relying on case-sensitive session name matching in downstream tooling will fail.
3. **Expecting a confirmation prompt** — the command is registered with `immediate: true`, meaning it executes without waiting for additional user confirmation dialogs.
4. **Ignoring the exit-code-1 path** — errors during disconnect are fatal and cause `process.exit(1)`. Scripts that call `/rc` programmatically should handle non-zero exit codes.
5. **Exceeding the 1024-byte stream chunk limit** — remote data payloads larger than 1024 bytes per chunk will be silently truncated; senders should respect this limit.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `odf` | Primary async handler for `/remote-control` (Arbor-resolved, module M3K) |
| `A` | Argument string / connection or token object used in normalization and close logic |
| `f` | Active connection manager / session controller that invokes close on both connection handles |
| `q` | Secondary connection handle (receives `.close()` and `.add()` / `.delete()` calls) |
| `$1` | Fatal error callback — invokes error reporter, calls `process.exit(1)` |
| `L` | Connection lifecycle manager — manages the active session set (add/finally/delete) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.