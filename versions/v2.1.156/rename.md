---
type: feature-spec
feature: "rename"
cc_version: "2.1.156"
updated: "2026-06-02"
tags: ["rename", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: "2.1.154"
analysis_basis: "CC v2.1.154 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/rename`

> Analysis basis: CC v2.1.154 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.154

---

## Overview

The `/rename` command (also aliased as `/name`) renames the current conversation session. When called with an explicit name argument it applies that name immediately; when called without an argument it asks the model to generate a name from existing conversation context. The command is marked `immediate`, so it executes synchronously without entering the normal agent turn cycle.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `rename` |
| description | `Rename the current conversation` |
| aliases | `["name"]` |
| argumentHint | `[name]` |
| immediate | `true` |
| module_id | `su1` |
| load_inline | `true` |
| loc_byte | `11738188` |
| loc_byte_end | `11738387` |
| loc_line | `8642` |
| arbor_handler.name | `EA5` |
| arbor_handler.fqn | `claude-2.1.154::EA5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.154 bundle.js:+11738188

---

## Input Branching

There are four distinct branches depending on swarm-teammate status, argument presence, and conversation context availability. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/rename [name] invoked"]) --> B{Is session a swarm teammate?}
    B -- Yes --> C["Return error:\n'Cannot rename: This session is a swarm\n teammate. Teammate names are set by\n the team leader.'"]
    B -- No --> D{Argument supplied\nand non-empty after trim?}
    D -- Yes --> E["Apply supplied name directly\n→ update appState\n→ persist to storage\n→ emit tengu_session_renamed"]
    D -- No --> F{Conversation context\navailable (messages exist)?}
    F -- No --> G["Return error:\n'Could not generate a name: no\n conversation context yet.\n Usage: /rename <name>'"]
    F -- Yes --> H["Invoke AI name-generation\n(mode: 'rename_generate_name',\n tool use denied)\n→ parse text response\n→ apply generated name\n→ emit tengu_session_renamed"]
```

Analysis basis: CC v2.1.154 bundle.js:+11737208 (swarm check), +11737326 (trim), +11737451 (empty check), +11737563 (no-context error literal), +11737346 (swarm error literal)

---

## Behavioral Spec

### Top-level handler (`EA5`)

The Arbor-resolved handler for `/rename` is the async function `EA5`.  
It calls two internal helpers: `LN8` (the core rename logic) and `KN8` (a UI/state-sink helper).

```
async function renameCommandHandler(commandArgs, appState):
    renderSink = initializeStateSink(appState)          // KN8
    await performRename(commandArgs, appState)           // LN8
```

Analysis basis: CC v2.1.154 bundle.js:+11737884 (`EA5 → LN8`), +11737942 (`EA5 → KN8`)

---

### Swarm-teammate guard (`LN8` entry)

```
async function performRename(args, appState):
    isTeammate = checkStoreForTeammateFlag()            // Ff → X0 → K1_.getStore
    if isTeammate:
        return displayError(
            "Cannot rename: This session is a swarm teammate. " +
            "Teammate names are set by the team leader."
        )
    ...
```

Analysis basis: CC v2.1.154 bundle.js:+11737208 (swarm check call), +11737326 (`Ff`), +11737346 (error literal)

---

### Explicit-name path

When the user supplies a non-empty argument after trimming whitespace, the name is applied without any model call:

```
    trimmedArg = args.trim()                            // H.trim at +11737451
    if trimmedArg is not empty:
        updateAppState({ sessionTitle: trimmedArg })    // _.setAppState at +11737691
        persistConversationRecord(appState)             // xYH at +11737733
        emitBasenameUpdate()                            // Kj at +11737737
        logTelemetry("tengu_session_renamed")
        return
```

`persistConversationRecord` (`xYH`) calls helpers for atomic file writes (`gO`), cache invalidation (`qj`), and stat-based change detection (`a9`).

Analysis basis: CC v2.1.154 bundle.js:+11737451 (trim), +11737691 (setAppState), +11737733 (xYH), +11737737 (Kj)

---

### AI name-generation path (`Z86` → `ZA5`)

When no argument is provided and conversation messages exist:

```
    if conversationMessages is empty:
        return displayError(
            "Could not generate a name: no conversation context yet. " +
            "Usage: /rename <name>"
        )

    // Build a forked sub-agent request (Z86 → ZA5)
    forkSessionAndRunQuery(
        mode        = "rename_generate_name",   // literal at +11735594
        toolPolicy  = "deny",                   // literal at +11735476
        systemNote  = "Session name generation cannot use tools",  // +11735491
        origin      = "rename",                 // literal at +11735570
        stopSignal  = AbortController,
        onResult    = applyGeneratedName
    )
```

The forked query calls `u0` (the main query-runner), which:
- Sets up a streaming API call with `K08` (`H.getAppState`, `H.setAppState`)
- Normalises the message history (`jT`)
- Sends the request via `n_K` (the full API call-graph node)
- Collects the response as a `text` content block (literal `"text"` at +11735817)

On receiving the model's reply, the name is extracted and applied identically to the explicit-name path.

Telemetry event `tengu_rename_full_session_fork` is emitted when the fork is initiated.  
Analysis basis: CC v2.1.154 bundle.js:+11736034 (`tengu_rename_full_session_fork`), +11736031 (`E6`), +11736072 (`Jr_`), +11736091 (`ZA5`), +11737563 (no-context error)

---

### Name argument assembly (`AN8`)

Before the name string is persisted, it is normalised by `AN8`:

```
function assembleNameFromParts(parts):
    if Array.isArray(parts):
        result = parts.join("")                  // _.join at +11732965
    else:
        result = parts.slice(...)                // A.slice at +11732997
    result.push(...)                             // _.push at +11732849
    return result
```

Analysis basis: CC v2.1.154 bundle.js:+11736143 (call to `AN8`), +11732849, +11732867, +11732965, +11732997

---

### Session persistence and logging (`xYH` / `Kj`)

```
function persistSession(appState):
    dir  = buildSessionDirectory()               // mK, AT
    file = buildSessionFilePath()                // a9 → dP.join
    atomicWrite(newTitle, dir, file)             // Af → gO (randomBytes + writeFile + rename)
    invalidateCache(file)                        // qj → CYH.delete
    emitBasenameNotification()                   // Kj → dP.basename, k6
```

File operations use `Fe.writeFile`, `Fe.rename`, and `Fe.copyFile` (via `gO`) with random-byte temporary names to ensure atomicity.

Analysis basis: CC v2.1.154 bundle.js:+11737733 (xYH), +4088838 (mK), +4088973 (Af), +4086666 (qj), +11737737 (Kj), +4086144 (dP.basename), +2230631 (Fe.writeFile), +2230684 (Fe.rename)

---

### Logging subsystem (`QSH`)

All session rename operations are routed through the logging subsystem `QSH`, which handles:
- Formatting the log entry via `rf` / `Vv`
- Appending to the log file via `yfH` (`A.appendFileSync`, `A.mkdirSync`)
- Emitting `qy6.emit` events with tag `"custom-title"` (literal at +12891572)
- Emitting `tengu_session_renamed` telemetry (at +12891664)

Analysis basis: CC v2.1.154 bundle.js:+11737677 (call to `QSH`), +12891551 (`dh`), +12891560 (`yfH`), +12891664 (`tengu_session_renamed`), +12891572 (`"custom-title"`)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_rename_full_session_fork` | Fired when the AI name-generation fork is initiated (bundle.js:+11736034) |
| Telemetry: `tengu_session_renamed` | Fired after any successful rename (explicit or AI-generated) (bundle.js:+12891664) |
| Telemetry: `tengu_agent_name_set` | Fired when a swarm agent name is set (bundle.js:+12894693) |
| Telemetry: `tengu_config_parse_error` | Fired on config file parse failure during session persistence (bundle.js:+3210789) |
| appState changes | `sessionTitle` field updated via `_.setAppState` (bundle.js:+11737691) |
| File I/O | Session record written atomically to storage directory via `Fe.writeFile` + `Fe.rename` |
| Log file | Appended via `A.appendFileSync`; directory created with `A.mkdirSync` if missing |
| Event emission | `qy6.emit` with source tag `"custom-title"` or `"ai-title"` (literal at +12891737) |
| Swarm guard | Returns early with error if `K1_.getStore` indicates teammate status |
| Tool policy | AI name-generation sub-agent runs with tool use **denied** (literal `"deny"` at +11735476) |
| AbortController | Registered on `"abort"` event (literal at +11735299) via `H.addEventListener`; calls `A.abort` |

---

## Version History

| Version | Change |
|---|---|
| v2.1.154 | Initial analysis |

---

## Common Mistakes

1. **Calling `/rename` without arguments in a new session**: If no messages have been exchanged, the command cannot auto-generate a name and will return "Could not generate a name: no conversation context yet. Usage: /rename \<name\>". Supply an explicit name instead.
2. **Attempting to rename a swarm teammate session**: Teammate session names are controlled by the team leader. The command will immediately error with a descriptive message; no rename occurs.
3. **Expecting tools to be available during AI name generation**: The name-generation sub-agent runs with tool policy `"deny"` — no tool calls can occur during this phase.
4. **Assuming `/name` and `/rename` differ**: Both aliases invoke the identical handler (`EA5`); there is no behavioral difference.
5. **Expecting immediate UI update during AI generation**: Because the sub-agent must complete a streaming API call, there is a short async delay before the title updates when no explicit name is provided.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `EA5` | Top-level async handler for `/rename` (Arbor-resolved) |
| `LN8` | Core rename logic: swarm guard, trim, branch dispatch |
| `KN8` | UI/state-sink initializer called alongside `LN8` |
| `Ff` | Store-access helper (reads teammate flag) |
| `X0` | Store accessor wrapper |
| `Z86` | AI name-generation orchestrator (fork + apply) |
| `Jr_` | Timestamp helper used at fork start |
| `ZA5` | Sub-agent query runner for name generation |
| `AN8` | Name string assembly/normalisation |
| `u0` | Main streaming query runner |
| `K08` | App-state read/write helper inside query loop |
| `au` | Sub-agent lifecycle manager |
| `jT` | Message history normaliser |
| `n_K` | Full API call-graph node (sends request, handles streaming) |
| `QSH` | Session logging subsystem |
| `dh` | Log entry writer |
| `yfH` | File append + mkdir helper for log files |
| `Vv` | Log format builder |
| `vAH` | AI-title log variant |
| `b5H` | Agent-name log variant |
| `xYH` | Session persistence orchestrator |
| `mK` | Session directory builder |
| `AT` | Session file path builder |
| `a9` | Stat-based cache read/write helper |
| `Af` | Atomic file write dispatcher |
| `gO` | Atomic write implementation (randomBytes + writeFile + rename) |
| `qj` | Cache invalidation helper (`CYH.delete`) |
| `Kj` | Basename notification emitter |
| `E6` | Session record manager (fork telemetry) |
| `DK` | Message filter helper |
| `ST` | State sink target |
| `hH` | Error logging helper |
| `RH` | JSON serialiser wrapper |
| `m6` | JSON parser wrapper |
| `ZH` | String coercion utility |
| `N` | String normalisation utility |
| `GK` | General-purpose utility called in generation path |
| `kP` | API credential/endpoint resolver |
| `dy` | Query dispatch coordinator |
| `aRH` | Assistant-message extractor |
| `Vc_` | Conversation file loader |
| `vT8` | Session data reader/writer |
| `SJ1` | Session index builder |
| `C6` | Path utility wrapper |
| `pxL` | Content block extractor |
| `HAH` | Hook/audit helper |
| `C7H` | Tool-context filter |
| `$v6` | Message-type checker (tombstone, summary, etc.) |
| `jG1` | Deferred tool availability checker |
| `SE8` | Object-keys inspector for app state |
| `P8` | JSON serialise helper |
| `Pk` | MCP transport selector |
| `vSH` | MCP server connection manager |
| `JGK` | MCP connection result applier |
| `Gm5` | MCP server set reconciler |
| `Q8` | Promise-timeout utility |
| `ZQ` | Conversation storage read/write |
| `kM6` | Conversation file read/write helper |
| `W3` | Worker/background task helper |
| `bo1` | Session object builder |
| `SM8` | MCP server-type checker |
| `ok` | MCP client cleanup helper |
| `dH6` | OrH-based MCP diagnostics |
| `wZ8` | MCP update applier |
| `b6` | Config file reader/watcher |
| `bzH` | Config file loader (readFileSync, mkdirSync) |
| `Y17` | Config file watcher (watchFile/unwatchFile) |
| `$z_` | Experiment/event emitter |
| `y88` | Experiment deduplication helper |
| `wz_` | Experiment subscriber |
| `Mx` | Config section accessor |
| `fx` | Config field reader |
| `Hz6` | Config validation |
| `Sz6` | Config schema accessor |
| `Jr_` | Fork timestamp helper |
| `P96` | Fork telemetry helper |
| `L08` | Session limiter |
| `Kh` | Random-bytes key generator |
| `au1` | Sub-agent result collector |
| `FS` | String trim utility |
| `GA` | API provider selector |
| `a9_` | API key type detector |
| `J9` | Credential builder |
| `pBH` | Proxy/base-URL builder |
| `sG` | Generation-step serialiser |
| `ucL` | Context/UI update helper |
| `NAH` | Named-agent state helper |
| `XE8` | Turn-limit checker |
| `D84` | Log-buffer rotating helper |
| `q1` | Error-queue helper |
| `zEA` | Error coercion utility |
| `F_` | Error/string constructor wrapper |