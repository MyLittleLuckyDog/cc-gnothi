---
type: feature-spec
feature: "mcp"
cc_version: "2.1.168"
updated: "2026-06-11"
tags: ["mcp", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.168 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/mcp`

> Analysis basis: CC v2.1.168 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.168

---

## Overview

The `/mcp` command is the primary management interface for Model Context Protocol (MCP) servers within Claude Code. It allows users to inspect the status of configured MCP servers and perform lifecycle operations — reconnecting, enabling, or disabling individual servers or all servers at once. Internally, the command is handled by an async function that parses a subcommand argument, queries the current MCP registry state, and dispatches the appropriate action (status display, reconnect, enable, or disable).

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `mcp` |
| description | `Manage MCP servers` |
| argumentHint | `[reconnect\|enable\|disable [<server>\|all]]` |
| supportsNonInteractive | `true` |
| module_id | `jlq` |
| load_inline | `true` |
| loc_byte | `11940468` |
| loc_byte_end | `11940660` |
| loc_line | `8248` |
| arbor_handler.name | `XGf` |
| arbor_handler.fqn | `claude-2.1.168::XGf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.168 bundle.js:+11940468

---

## Input Branching

The command supports 5 distinct execution paths based on argument parsing and server state, requiring a Mermaid flowchart.

```mermaid
flowchart TD
    A["/mcp called with args"] --> B[Trim & lowercase argument\nbundle.js:+11688205]
    B --> C{Subcommand?}

    C -->|no arg / empty| D[Status display path]
    C -->|reconnect| E[Reconnect path]
    C -->|enable| F[Enable path]
    C -->|disable| G[Disable path]
    C -->|unknown subcommand| H[Error / fallback output]

    D --> D1{Any MCP servers\nconfigured?}
    D1 -->|No| D2[Emit: 'No MCP servers are configured.\nAdd one with `claude mcp add`.' \nbundle.js:+11689178]
    D1 -->|Yes| D3[Render server list\nwith status per server\nbundle.js:+11688430]
    D3 --> D4{Server status\nper entry}
    D4 -->|connected| S1[Show: connected]
    D4 -->|pending| S2[Show: pending]
    D4 -->|failed| S3[Show: failed\n+ reconnect hint\nbundle.js:+11688706]
    D4 -->|needs-auth| S4[Show: needs-auth\n+ auth hint\nbundle.js:+11690405]
    D4 -->|disabled| S5[Show: disabled]
    D4 -->|needs-approval| S6[Show: needs-approval\nbundle.js:+11687614]

    E --> E1{Terminal UI\navailable?}
    E1 -->|No| E2[Emit: 'MCP controls aren't available\nright now...' bundle.js:+11689377]
    E1 -->|Yes| E3{Target arg}
    E3 -->|'all'| E4[Filter servers not already\nconnected/connecting\nbundle.js:+11690119]
    E3 -->|<server name>| E5[Reconnect named server]
    E4 --> E6[Promise.allSettled over\nreconnect operations\nbundle.js:+11690195]
    E5 --> E6
    E6 --> E7[Report fulfilled/rejected\nresults per server\nbundle.js:+11690260]

    F --> F1[Mark server(s) enabled\nbundle.js:+11691567]
    F1 --> F2[Emit status line:\n'Enabled'\nbundle.js:+11691333]

    G --> G1[Mark server(s) disabled\nbundle.js:+11691577]
    G1 --> G2[Emit status line:\n'Disabled']
    G2 --> G3[Append: 'Run /mcp in terminal\nto see status'\nbundle.js:+11692402]
```

---

## Behavioral Spec

### Argument Parsing

The handler (`XGf`) begins by trimming the raw argument string and converting it to lowercase.

```
async function mcpCommandHandler(context):
    rawArg = context.args
    trimmedArg = rawArg.trim()                         // bundle.js:+11688205
    subcommand = trimmedArg.toLowerCase()              // bundle.js:+11688265

    mcpRegistry = context.getMcp()                     // bundle.js:+11688216

    if subcommand includes "ide" context marker:       // bundle.js:+11688256
        // IDE-specific routing

    dispatch(subcommand, mcpRegistry, context)
```

Analysis basis: CC v2.1.168 bundle.js:+11688205

---

### Status Display (no subcommand)

When `/mcp` is invoked with no argument, the handler retrieves the current list of MCP servers and renders their connection states.

```
function renderMcpStatus(mcpRegistry, outputWriter):
    servers = mcpRegistry.getAll()

    if servers is empty:
        outputWriter.write("No MCP servers are configured. Add one with `claude mcp add`.")
        // bundle.js:+11689178
        return

    for each server in servers:
        status = server.connectionStatus   // one of: connected, pending, failed,
                                           // needs-auth, disabled, needs-approval
        renderServerRow(server.name, status)

        if status == "failed":
            appendHint(" Reply `/mcp reconnect all` here to retry.")
            // bundle.js:+11688706

        if status == "needs-auth":
            appendHint("Authenticate with `/mcp` in the terminal.")
            // bundle.js:+11690405

        if status == "failed" or status == "needs-auth":
            appendHint("Check its config with `/mcp` in the terminal.")
            // bundle.js:+11690449
```

Analysis basis: CC v2.1.168 bundle.js:+11688430

---

### Reconnect Subcommand

The `reconnect` subcommand attempts to re-establish connections. It first checks that the terminal UI is available before proceeding.

```
async function handleReconnect(targetArg, mcpRegistry, uiContext):
    if terminal UI not available:                          // bundle.js:+11689343
        emit("MCP controls aren't available right now — the terminal is still starting up or is showing another view.")
        // bundle.js:+11689377
        return

    if targetArg == "all":                                 // bundle.js:+11688912
        candidates = mcpRegistry.filter(                   // bundle.js:+11689116
            server => server.status not in [connected, connecting]
        )
        if candidates is empty:
            emit("All enabled MCP servers are already connected or connecting.")
            // bundle.js:+11690119
            return
    else:
        candidates = [mcpRegistry.getByName(targetArg)]

    results = await Promise.allSettled(                    // bundle.js:+11690195
        candidates.map(server => reconnectServer(server))  // bundle.js:+11690214
    )

    for each result in results:
        if result.status == "fulfilled":                   // bundle.js:+11690260
            reportSuccess(result.value)
        else:
            reportFailure(result.reason)

    if any server needs-auth:                              // bundle.js:+11690739
        renderAuthHint(server)                             // via IxH: bundle.js:+11690751
```

Analysis basis: CC v2.1.168 bundle.js:+11688925

---

### Enable / Disable Subcommands

```
async function handleEnableDisable(action, targetArg, mcpRegistry):
    // action: "enable" (bundle.js:+11688942) or "disable" (bundle.js:+11688956)

    if targetArg == "all":
        servers = mcpRegistry.getAll()
    else:
        servers = [mcpRegistry.getByName(targetArg)]

    for each server in servers:
        if action == "enable":
            server.setEnabled(true)
            emit("Enabled")                                // bundle.js:+11691567
            emit("enabled")                               // bundle.js:+11691333
        else:
            server.setEnabled(false)
            emit("Disabled")                              // bundle.js:+11691577

    emit(". Run `/mcp` in the terminal to see status.")   // bundle.js:+11692402
```

Analysis basis: CC v2.1.168 bundle.js:+11688942

---

### Inline MCP Reconnect (Non-Interactive / Agent Context)

When the command is invoked from an inline/agent context (detected separately from interactive terminal), a different telemetry path fires and results are written as `text` type output.

```
function handleInlineMcpCommand(context):
    // Fires telemetry: tengu_mcp_command_inline   bundle.js:+11689055
    servers = context.getMcpServers().filter(...)         // bundle.js:+11689116
    resultOutput = buildTextOutput(servers)               // output type: "text" bundle.js:+11692476
    return resultOutput
```

Analysis basis: CC v2.1.168 bundle.js:+11689055

---

### Server Connection Lifecycle & Daemon Interaction

Reconnect operations reach into the daemon control layer, which manages connection state via async race/all patterns.

```
async function reconnectServer(server):
    // Uses shutdownIfNeeded (RLH → SLH.shutdown)        // bundle.js:+16228998
    // Then races reconnect promise with timeout          // bundle.js:+16228971
    //   timeout default: 500ms                          // bundle.js:+16229015
    // On abort: emits daemon_stop / daemon_stop_failed   // bundle.js:+16233897

    try:
        await Promise.race([
            serverConnect(server),
            timeoutPromise(500)                          // bundle.js:+16229015
        ])
    catch abort:
        emitEvent("daemon_stop")                         // bundle.js:+16233897
        if failed:
            emitEvent("daemon_stop_failed")              // bundle.js:+16233934
```

Analysis basis: CC v2.1.168 bundle.js:+16228971

---

### Config Write / State Persistence

The enable/disable path writes updated configuration back to disk via an async file-append pipeline.

```
async function persistMcpConfig(configData, configPath):
    // Resolves config directory via path helpers          // bundle.js:+206115
    // Creates directory if absent (mkdir)                // bundle.js:+205836
    // Appends to config file (appendFile)                // bundle.js:+205895
    // Rotates/renames log on .txt suffix                 // bundle.js:+205511
    // Checks byte length before write                    // bundle.js:+206290
    // Registers hook via hook registration utility       // bundle.js:+60369
```

Analysis basis: CC v2.1.168 bundle.js:+206252

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_mcp_command_inline` | Fired when `/mcp` is invoked from an inline/agent (non-interactive) context — bundle.js:+11689055 |
| Telemetry: `tengu_feature_ok` | Fired on successful feature execution path — bundle.js:+1010950 |
| Telemetry: `tengu_feature_bad` | Fired when feature encounters a handled error — bundle.js:+1011012 |
| Telemetry: `tengu_feature_sad` | Fired on unexpected/sad path (e.g., terminal unavailable) — bundle.js:+1011093 |
| Telemetry: `tengu_daemon_control` | Fired during daemon lifecycle operations (connect/disconnect) — bundle.js:+16233972 |
| MCP registry mutation | `enable` and `disable` subcommands write updated server enabled-state back to config file via async append pipeline |
| File I/O | Config directory created if absent; file appended atomically; `.txt`-suffixed logs rotated — bundle.js:+205836, +205895, +205511 |
| Hook registration | A hook is registered after config write via the hook registration utility (`NPA.register`) — bundle.js:+60369 |
| Daemon interaction | `reconnect` triggers daemon shutdown-then-reconnect cycle; uses `Promise.race` with 500 ms timeout — bundle.js:+16228971, +16229015 |
| Terminal UI guard | Interactive operations (`reconnect`) are gated on terminal UI readiness; non-interactive path is separately handled — bundle.js:+11689343, +11689377 |
| Output format | Inline/agent invocation produces `"text"` typed output — bundle.js:+11692476 |
| `supportsNonInteractive` | `true` — the command can be invoked in non-interactive (scripted / agent) sessions |

---

## Version History

| Version | Change |
|---|---|
| v2.1.168 | Initial analysis |

---

## Common Mistakes

1. **Omitting the server name with `enable`/`disable`**: The `argumentHint` requires `[<server>|all]` as a second token after the subcommand. Invoking `/mcp enable` without a server name or `all` will produce no targeted action.
2. **Expecting instant reconnect**: The `reconnect` subcommand is asynchronous and races against a 500 ms timeout per server (bundle.js:+16229015). Servers that are slow to respond may be reported as failed even if they eventually recover.
3. **Using `/mcp reconnect` in a non-interactive context**: The terminal-UI availability guard blocks interactive reconnect when the terminal is starting up or showing another view (bundle.js:+11689377). Use the inline path or wait for the terminal to be ready.
4. **Assuming `reconnect all` re-tries disabled servers**: The filter at bundle.js:+11689116 excludes servers that are disabled — only servers that are not already connected or connecting are retried.
5. **Expecting persistent effect from reconnect alone**: `reconnect` changes connection state but does not alter the enabled/disabled configuration. To permanently re-enable a server, use `/mcp enable <server>`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `XGf` | Main async handler for `/mcp` command (arbor_handler) |
| `H` | Bootstrap fetch / output stream helper (multi-role) |
| `v` | MCP subcommand dispatch / argument routing function |
| `snK` | Server connection state handler |
| `IPA` | Connection initialization helper |
| `RH` | JSON serialization utility (wraps `JSON.stringify`) |
| `G4` | Server name normalization / path resolution helper |
| `K0A` | Server list mapper |
| `EUH` | Output write coordinator |
| `nWA` | Low-level stream writer |
| `_iK` | Config file persistence orchestrator |
| `npH` | Async queue / timeout manager (clearTimeout / setTimeout / setImmediate) |
| `YKH` | Config path builder |
| `B76` | EISDIR-aware directory validator |
| `$0A` | Config join/resolve helper |
| `ll8` | File rename / rotate utility (handles `.txt` suffix) |
| `HiK` | Config append writer (mkdir + appendFile) |
| `j9` | Hook registration dispatcher |
| `mj_` | Argument token splitter (split / trim / indexOf / slice) |
| `lHH` | Known-server set membership checker |
| `uj` | Server name sanitizer (replace) |
| `H9` | Markdown/text rendering orchestrator for server status |
| `m6H` | Model/provider string builder |
| `qB` | Per-server status row renderer |
| `s9` | Model alias normalizer (handles opusplan, sonnet, haiku, opus, best) |
| `Y2` | Model string resolver |
| `h4H` | Anthropic provider inclusion checker |
| `CI` | Connected status formatter |
| `DdH` | Disconnected/failed status formatter |
| `bT` | Status label builder (firstParty, mantle, etc.) |
| `lP1` | Pending status formatter |
| `lM` | Provider type mapper (anthropicAws, gateway) |
| `NH8` | Auth-required status checker |
| `wdH` | Disabled state handler |
| `FJ` | Full server row formatter (calls `s9` + `_G`) |
| `_G` | Rich status line composer |
| `o6` | Feature telemetry dispatcher (ok/bad/sad) |
| `l` | Core feature event emitter |
| `J6` | Secondary event routing helper |
| `hm6` | Issue reporting URL holder |
| `CE` | MCP server status categorizer |
| `a8` | Argument string accessor |
| `xS8` | Terminal UI availability checker |
| `Ylq` | Terminal readiness validator |
| `a1A` | Needs-auth server filter helper |
| `IxH` | Auth hint renderer |
| `DLK` | Daemon status file writer |
| `Yo` | Daemon status row builder |
| `b4H` | Status entry formatter |
| `V9` | AsyncLocalStorage store accessor |
| `YC6` | Daemon status path builder |
| `E` | Reconnect candidate list |
| `O` | Background session marker |
| `b8` | Background session state holder |
| `D` | Forced-shutdown dispatcher |
| `IJ` | Forced shutdown initiator |
| `z` | Daemon lifecycle controller (abort / stop) |
| `SH` | Daemon start event emitter |
| `CH` | Daemon stop event emitter |
| `uh` | Daemon event bus connector |
| `yu` | Connection state initializer |
| `EvH` | Event handler registrar |
| `yP_` | UUID-based session event emitter |
| `sp` | Graceful shutdown orchestrator (Promise.race / Promise.all) |
| `RLH` | Shutdown request sender (SLH.shutdown) |
| `pLH` | Shutdown timeout cleaner |
| `r8` | Timed abort promise builder |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.