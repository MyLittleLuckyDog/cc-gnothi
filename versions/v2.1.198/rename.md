---
type: feature-spec
feature: "rename"
cc_version: "2.1.198"
updated: "2026-07-02"
tags: ["rename", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.198 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/rename`

> Analysis basis: CC v2.1.198 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.198

---

## Overview

The `/rename` command (aliased as `/name`) renames the current conversation session. It accepts an optional name argument: when a name is supplied, it is applied directly; when no argument is provided (and the session has sufficient context), it invokes an AI-assisted name-generation sub-flow that uses the existing conversation history to produce a title automatically.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `rename` |
| description | `Rename the current conversation` |
| argumentHint | `[name]` |
| immediate | `true` |
| aliases | `["name"]` |
| module_id | `k7l` |
| load_inline | `true` |
| loc_byte | `12614886` |
| loc_byte_end | `12615085` |
| loc_line | `8511` |
| arbor_handler.name | `o7f` |
| arbor_handler.fqn | `claude-2.1.198::o7f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.198 bundle.js:+12614886

---

## Input Branching

The command has three distinct top-level branches depending on session state and the presence/absence of a user-supplied name argument, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/rename [name] invoked"] --> B{Is session a teammate?}
    B -- Yes --> C["Return error:\n'Cannot rename: This session is a teammate.\nTeammate names are set by the team leader.'"]
    B -- No --> D{Name argument provided?}
    D -- Yes --> E["Sanitize input via htmlEscapeHelper\n(trim whitespace, escape HTML entities)"]
    E --> F["Apply name directly via setAppState\n(title field updated)"]
    F --> G["Persist to disk via conversationPersist\n(write conversation metadata)"]
    G --> H["Emit tengu_session_renamed telemetry"]
    H --> I["Return success message to UI"]
    D -- No --> J{Conversation has context\n(messages exist)?}
    J -- No --> K["Return error:\n'Could not generate a name: no conversation\ncontext yet. Usage: /rename <name>'"]
    J -- Yes --> L["Fork a sub-agent query\n(generateNameQuery sub-flow)"]
    L --> M["Build restricted prompt:\ntool use denied, 'rename_generate_name' mode"]
    M --> N["Stream AI response via mainQueryRunner"]
    N --> O["Extract text from first assistant message"]
    O --> P["Apply extracted name via setAppState"]
    P --> G
```

Analysis basis: CC v2.1.198 bundle.js:+12614582 (handler `o7f`), +12614050 (teammate error), +12614261 (no-context error), +12614149 (trim), +12614183 (rename apply sub-flow via `RTt`)

---

## Behavioral Spec

### Top-level Handler (`o7f`)

The Arbor-resolved handler is `o7f` (AsyncFunction, resolved via `module_id` path). It dispatches to two internal helpers: `htmlUnescape` (`Dlr`) for name sanitization and `renameHandler` (`Plr`) for the main rename logic.

```
async function renameCommandHandler(context, args):
    rawName = args.trim()
    sanitizedName = htmlEscapeHelper(rawName)   // Dlr → fsr
    return renameHandler(context, sanitizedName)  // Plr
```

Analysis basis: CC v2.1.198 bundle.js:+12614582, +12614598, +12614640

---

### HTML-Entity Sanitization (`Dlr` / `fsr`)

Before any name is applied, special HTML characters are normalized to their entity equivalents. The literals found in the implementation confirm the following substitutions:

| Raw character | Entity replacement |
|---|---|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| CR (U+000D) | `&#13;` |
| LF (U+000A) | `&#10;` |

Analysis basis: CC v2.1.198 bundle.js:+14164454, +14164478, +14164501, +14164525, +14164549

---

### Rename Handler (`Plr`)

```
async function renameHandler(context, sanitizedName):
    sessionStore = getSessionStore(_f → C0 → $6r.getStore)

    // Guard: block renaming of teammate sessions
    if sessionStore.isTeammate:
        return errorMessage(
            "Cannot rename: This session is a teammate. " +
            "Teammate names are set by the team leader."
        )

    if sanitizedName is non-empty:
        // Direct rename path
        applyConversationName(context, sanitizedName)
    else:
        // AI-assisted generation path
        if not hasConversationContext(context):
            return errorMessage(
                "Could not generate a name: no conversation " +
                "context yet. Usage: /rename <name>"
            )
        generatedName = await generateNameViaSubAgent(context)   // RTt
        applyConversationName(context, generatedName)

    persistConversation(context)   // ATe → fj / RZ / y7e
    return successResult()
```

Analysis basis: CC v2.1.198 bundle.js:+12614030 (`_f`), +12614050 (teammate error literal), +12614149 (trim), +12614183 (`RTt` call), +12614261 (no-context error literal), +12614375 (`ATe` persist call), +12614389 (`t.setAppState`), +12614408 (`Esr`), +12614431 (`Fue`)

---

### AI Name Generation Sub-flow (`RTt`)

When no name is provided and the session has messages, a restricted sub-agent query is forked to generate a session title.

```
async function generateNameViaSubAgent(context):
    // Emit fork telemetry
    emit("tengu_rename_full_session_fork")   // nt

    // Build a query restricted to text output only
    queryConfig = {
        mode: "rename_generate_name",
        toolUse: "deny",
        errorMessage: "Session name generation cannot use tools",
        type: "other",
        kind: "rename"
    }

    // Run the AI query with full-session context
    sessionSnapshot = buildSessionContext(g$o)   // conversation history
    abortController = newAbortController(r7f)

    rawResponse = await runQuery(CR, queryConfig, sessionSnapshot)

    // Extract and clean the first text block from the assistant reply
    responseText = extractFirstTextBlock(Rlr, rawResponse)
    cleanName = trimAndFormat(responseText)

    // Persist title origin as "ai-title"
    writeTitleOrigin("ai-title")   // RZ path in logging

    // If direct name supplied instead, origin is "custom-title"
    // writeTitleOrigin("custom-title")   // fj path

    emit("tengu_session_renamed")   // fj / RZ
    return cleanName
```

Analysis basis: CC v2.1.198 bundle.js:+12612699 (`nt` fork), +12612702 (`tengu_rename_full_session_fork`), +12612144 (`"deny"`), +12612159 (`"Session name generation cannot use tools"`), +12612223 (`"other"`), +12612238 (`"rename"`), +12612262 (`"rename_generate_name"`), +12612811 (`Rlr` text extraction), +12612869 (`pc`), +13741183 (`"custom-title"` literal), +13741350 (`"ai-title"` literal), +13741275 (`tengu_session_renamed`)

---

### Conversation Persistence (`ATe` / `fj` / `RZ` / `y7e`)

After a name is applied (direct or AI-generated), conversation metadata is persisted. The persistence layer calls `fj` (custom-title path) or `RZ` (AI-title path), both of which:

1. Write the title to the session log file via `appendFile` / `mkdir` as needed.
2. Fire the `tnn.emit` event to notify subscribers of the title change.
3. Emit `tengu_session_renamed` telemetry.

For agent sub-sessions, `y7e` additionally emits `tengu_agent_name_set` and fires `nKo.emit`.

Analysis basis: CC v2.1.198 bundle.js:+13741183, +13741262 (`tnn.emit`), +13741275 (`tengu_session_renamed`), +13746195 (`nKo.emit`), +13746208 (`tengu_agent_name_set`)

---

### Session-Context Read (`_f` / `C0`)

The command reads the active session store from an async-local-storage context. The store is retrieved via `$6r.getStore()`. A numeric sentinel value `0` is used as a fallback when no store is found.

Analysis basis: CC v2.1.198 bundle.js:+12614030, +2359873, +2358556, +2359885

---

### Response Text Extraction (`Rlr`)

After the sub-agent query returns, the raw response messages are scanned:

```
function extractNameFromResponse(messages):
    parts = []
    for message in messages:
        if message.isMeta: skip
        if message.origin == "human": skip
        if message.type == "text":
            parts.push(message.content)
    joined = parts.join("")
    return joined.slice(0, MAX_NAME_LENGTH)
```

Key string constants: `"isMeta"` (bundle.js:+12609029), `"origin"` (bundle.js:+12609064), `"type"` (bundle.js:+12609202).

Analysis basis: CC v2.1.198 bundle.js:+12609079 (`GG`), +12609148 (`t.push`), +12609166 (`Array.isArray`), +12609264 (`t.join`), +12609296 (`n.slice`)

---

### State Application (`setAppState`)

The resolved name is written to app state:

```
function applyConversationName(context, name):
    context.setAppState({ conversationTitle: name })
    invalidateSessionCache(Esr)   // Object.keys-based cache clear
    updateFileIndex(Fue)          // Zi, dc, gR paths
    updateWorkspaceMetadata(mS)   // wy.basename, zY, kt
```

Analysis basis: CC v2.1.198 bundle.js:+12614389 (`t.setAppState`), +12614408 (`Esr`), +12614431 (`Fue`), +12614435 (`mS`)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_rename_full_session_fork` (emitted when AI name generation is triggered; bundle.js:+12612702) |
| Telemetry | `tengu_session_renamed` (emitted on every successful rename; bundle.js:+13741275) |
| Telemetry | `tengu_agent_name_set` (emitted when an agent sub-session name is updated; bundle.js:+13746208) |
| Telemetry | `tengu_forked_agent_default_turns_exceeded` (emitted by the forked sub-agent query runner if turn limit is hit; bundle.js:+11312503) |
| Telemetry | `tengu_fork_agent_query` (emitted when sub-agent query is dispatched; bundle.js:+11312946) |
| appState changes | `conversationTitle` field updated via `t.setAppState` (bundle.js:+12614389) |
| Event emission | `tnn.emit` fires with title-change payload after persistence (bundle.js:+13741262) |
| Event emission | `nKo.emit` fires for agent sub-session name updates (bundle.js:+13746195) |
| File I/O | Conversation log file appended/created via `Ll.appendFile` / `Ll.mkdir` (bundle.js:+13740389, +13740431) |
| File I/O | Conversation metadata written via `y$.writeFile` / read via `y$.readFile` (bundle.js:+2364246, +2364217) |
| Session cache | Session file index invalidated via `Esr` → `Object.keys` after rename (bundle.js:+12614408, +11721246) |
| Teammate guard | Rename is blocked entirely if the session is identified as a teammate session (bundle.js:+12614050) |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.198 | Initial analysis |

---

## Common Mistakes

1. **Omitting the name argument when there is no conversation history.** If `/rename` is invoked without an argument before any messages have been exchanged, the command returns `"Could not generate a name: no conversation context yet. Usage: /rename <name>"` (bundle.js:+12614261). Always supply an explicit name before the first exchange.

2. **Attempting to rename a teammate session.** If the current session is classified as a teammate (not the team leader), the command always returns `"Cannot rename: This session is a teammate. Teammate names are set by the team leader."` (bundle.js:+12614050) regardless of arguments.

3. **Including raw HTML/XML characters in the name.** The input is HTML-entity-escaped before storage (`&`, `<`, `>`, CR, LF are converted). If the downstream display layer does not reverse these entities, the stored title will contain entity strings instead of the intended characters.

4. **Expecting immediate disk persistence.** The name is applied to in-memory `appState` first; file I/O happens asynchronously in the persistence layer (`fj` / `RZ` / `y7e`). A crash between the state write and the file write could cause a discrepancy between the displayed name and the persisted name.

5. **Confusing the `/name` alias with a separate command.** `/name` is a pure alias for `/rename` (same registration object); it has identical behavior and limitations.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `o7f` | Top-level async handler for `/rename` (Arbor-resolved entry point) |
| `Dlr` | HTML-entity escape dispatcher (calls `fsr`) |
| `fsr` | Core `replaceAll`-based HTML entity substitution function |
| `HC` | Utility called by entity dispatcher (secondary sanitization helper) |
| `Plr` | Main rename handler: teammate guard, direct vs. AI-generation dispatch, state apply |
| `_f` | Session store accessor wrapper |
| `C0` | Async-local-storage reader (calls `$6r.getStore`) |
| `RTt` | AI name generation orchestrator (sub-agent fork + response extraction) |
| `nt` | Sub-agent session forking function (emits `tengu_rename_full_session_fork`) |
| `n2t` | Fork helper #1 |
| `r2t` | Fork helper #2 |
| `tG` | Fork pipeline stage (calls `eG`) |
| `eG` | Session context builder used by fork pipeline |
| `aMn` | Sub-agent registration/deduplication (checks `BJr`, `k0e`) |
| `FJr` | Sub-agent instantiation (random UUID, event emit) |
| `qJr` | Sub-agent query dispatcher |
| `Dt` | Conversation data reader/writer (calls `SCt`, `qHm`) |
| `zt` | Low-level storage utility |
| `A7o` | Storage path helper |
| `SCt` | Config/file sync helper (reads config, manages backups) |
| `qHm` | Conversation watcher cleanup utility |
| `g$o` | Session context snapshot builder (calls `vs`, `GLt`) |
| `vs` | Model/version resolution utility |
| `w6` | Rendering context helper |
| `Fo` | Model name normalization function |
| `IH` | Model alias lookup table |
| `GLt` | Conversation message aggregator |
| `r7f` | AbortController / query runner setup |
| `Npe` | Pre-query context builder |
| `CR` | Core query runner (main API call orchestrator) |
| `PZn` | App state accessor within query runner |
| `OZn` | Post-query state reconciler |
| `IP` | ID/nonce generator (uses `randomBytes`) |
| `jde` | Log/audit event emitter pair |
| `T` | Streaming output writer |
| `AU` | Sub-agent lifecycle tracker |
| `CP` | Conversation pruner |
| `ZKe` | Message type filter (checks `oEf`) |
| `Jse` | Session event emitter |
| `Prr` | Progress reporter |
| `n_l` | Tombstone/summary filter |
| `f` | Message accumulator array |
| `Wde` | Tool-use deduplication filter |
| `V` | JSX renderer / UI component factory |
| `Z1f` | Forked-agent turn renderer |
| `xn` | Message chunk constructor |
| `y` | Chunk payload builder |
| `_` | Message assembly helper |
| `r` | Response stream processor |
| `As` | Fatal error handler (calls `process.exit`) |
| `x7l` | Name extractor from query result |
| `u6` | String trimmer utility wrapper |
| `he` | String-to-string coercion helper |
| `Rlr` | Response text extractor (joins text blocks from assistant messages) |
| `GG` | Message field accessor for `isMeta` / `origin` guard |
| `wR` | Streaming response processor (calls `Yrr`, `ann`) |
| `pc` | Payload codec |
| `Yrr` | Full conversation serializer/writer |
| `zrr` | Conversation directory resolver |
| `TR` | Turn renderer (large multi-path message assembler) |
| `NNf` | Nested content-block flattener |
| `Pt` | Platform path helper |
| `Me` | JSON serializer wrapper |
| `Gt` | JSON parser wrapper |
| `oUl` | File notification helper |
| `en` | Error normalizer |
| `s` | Async lifecycle tracker (add/finally/delete pattern) |
| `ann` | Agent response processor (calls `k$o`, `tgc`) |
| `k$o` | Fallback request handler |
| `tgc` | Core API call engine (large orchestrator) |
| `RM` | React/render mount helper |
| `sw` | Symbol registry |
| `ZC` | UI shell / layout renderer |
| `Tw` | Terminal width utility |
| `mr` | Model resolver |
| `fu` | Feature flag reader |
| `k6r` | API key classifier (login managed key vs. `sk-ant-`) |
| `L6` | Layout component |
| `o9` | Output finalizer |
| `Hf` | Hook dispatcher |
| `kt` | Hook runner base |
| `Sl` | Message filter (`.filter`) |
| `ATe` | Conversation persistence orchestrator |
| `HL` | Hook list accessor |
| `Th` | Hook execution helper |
| `i3` | Hook symbol accessor #1 |
| `ar` | Hook symbol accessor #2 |
| `fj` | Custom-title persistence path (emits `tengu_session_renamed`) |
| `bv` | Log entry builder |
| `pj` | File append/write logger (calls `Ll.appendFile`) |
| `S2` | Log format helper |
| `eu` | Process event handler setup |
| `Pe` | React component base |
| `OQe` | Root component symbol |
| `RZ` | AI-title persistence path (emits `tengu_session_renamed`) |
| `bE` | Background persistence trigger |
| `ime` | Inline metadata emitter |
| `a` | HTTP response / spend-limit checker |
| `tge` | JSON stringify wrapper for responses |
| `ame` | Async metadata emitter |
| `y7e` | Agent-name persistence path (emits `tengu_agent_name_set`) |
| `YY` | Conversation state writer (calls `W1t`) |
| `W1t` | File-based conversation store reader/writer |
| `Ul` | Utility loader |
| `ute` | Utility execution helper |
| `Esr` | Session cache invalidator (`Object.keys`-based) |
| `Fue` | File index updater (calls `dc`, `Zi`, `mE`, `ip`) |
| `dc` | Directory context builder |
| `gR` | Path join helper |
| `Zi` | File watcher / cache manager (lstat, readFile, writeFile) |
| `d` | Worker process manager (start/stop/updateConfig) |
| `SXe` | File stat checker |
| `rdc` | File read-size calculator |
| `E` | Worker process controller |
| `A` | Auth/OAuth client |
| `lQc` | Heartbeat sender |
| `I` | Input event handler |
| `u` | Daemon control dispatcher |
| `xe` | Daemon stop handler (emits `tengu_feature_ok`) |
| `Le` | Daemon stop-failure handler (emits `tengu_feature_bad`) |
| `M$` | Background session registrar |
| `l8` | Process race/exit controller |
| `mn` | Error encoder |
| `gd` | Error encoder variant |
| `mE` | Cache entry deleter |
| `ip` | Index persistence helper (calls `Uf`) |
| `Uf` | Atomic file writer (randomBytes, copyFile, chmod, unlink) |
| `JBe` | Write-lock helper |
| `lm` | Lock-based file writer |
| `Re` | Retry/error logger |
| `sr` | Error stringifier |
| `st` | String coercion utility |
| `qi` | Write queue manager |
| `jvu` | Queue shift/push helper |
| `mS` | Workspace metadata updater (basename, `zY`, `kt`) |
| `zY` | Workspace path resolver |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.