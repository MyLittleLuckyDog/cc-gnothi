---
type: feature-spec
feature: "branch"
cc_version: "2.1.147"
updated: "2026-06-01"
tags: ["branch", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.147 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/branch`

> Analysis basis: CC v2.1.147 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.147

---

## Overview

The `/branch` command (alias `/fork`) creates a divergent copy of the current conversation at its present state, replaying the history up to that point into a new session with a fresh UUID. It physically copies the conversation's backing store to a new location on disk, then opens the branched session — enabling the user to explore an alternative direction without affecting the original thread.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `branch` |
| description | `Create a branch of the current conversation at this point` |
| argumentHint | `[name]` |
| aliases | `["fork"]` |
| module_id | `OU_` |
| load_inline | `true` |
| loc_byte | `11952637` |
| loc_byte_end | `11952831` |
| loc_line | `9821` |
| arbor_handler.name | `fT7` |
| arbor_handler.fqn | `claude-2.1.147::fT7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.147 bundle.js:+11952637

---

## Input Branching

There are four distinct behavioral paths depending on the state of the active conversation when `/branch` (or `/fork`) is invoked:

```mermaid
flowchart TD
    A["/branch [name] invoked"] --> B{Active conversation\nhas messages?}
    B -- No messages --> C["Error: 'No messages to branch'\n(bundle.js:+10485268)"]
    B -- Has messages --> D{Conversation\nbacking store\nexists?}
    D -- Missing / no session --> E["Error: 'No conversation to branch'\n(bundle.js:+10484247)"]
    D -- Exists --> F["Generate new UUID\nfor branched session"]
    F --> G["Resolve source title\n(default: 'Branched conversation')"]
    G --> H["Copy conversation store\nto new path on disk"]
    H --> I{Optional [name]\nargument supplied?}
    I -- Yes --> J["Use supplied name\nas branch title"]
    I -- No --> K["Use default title\n'Branched conversation'"]
    J --> L["Open branched session\n& emit tengu_conversation_forked"]
    K --> L
    L --> M["Inject fork marker\n'fork' into new session\n(bundle.js:+10487018)"]
    M --> N["Display 'progress' update\nto UI (bundle.js:+10485186)"]
```

Analysis basis: CC v2.1.147 bundle.js:+10484247, +10485268, +10483800, +10487018, +10485186

---

## Behavioral Spec

### Top-Level Handler (`fT7`)

The Arbor-resolved handler is `fT7` (AsyncFunction, resolved via `module_id` path). It orchestrates the full branch flow by delegating to two main sub-routines: `conversationSetup` (`g$1`) and `fileCopy` (`F$1`).

```
async function branchHandler(context):
    // Resolve active session and current message list
    session = resolveActiveSession(context)            // via g$1 → CO path
    messages = getConversationMessages(session)

    if messages is empty:
        reportError("No messages to branch")           // bundle.js:+10485268
        return

    if session.backingStorePath is null:
        reportError("No conversation to branch")       // bundle.js:+10484247
        return

    // Determine branch title
    suppliedName = parseArgument(context.input)        // B$1 → _.find / A.replace
    title = suppliedName ?? "Branched conversation"    // bundle.js:+10483800

    // Create new session identity
    newSessionId = generateUUID()                      // F$1 → m$1.randomUUID

    // Build destination path and copy history
    destPath = buildDestinationPath(newSessionId)      // F$1 → h6, AO, w_, JV, XM, zR
    ensureDirectory(destPath)                          // F$1 → CP8.mkdir
    copyConversationStore(                             // F$1 → RP8.createReadStream,
        source = session.backingStorePath,             //        RP8.createWriteStream
        dest   = destPath,
        encoding = "utf8"                              // bundle.js:+10484183
    )

    // Inject fork marker and open new session
    openBranchedSession(newSessionId, title, "fork")   // bundle.js:+10487018
    emitTelemetry("tengu_conversation_forked")         // bundle.js:+10486497
    reportProgress("progress")                         // bundle.js:+10485186
```

Analysis basis: CC v2.1.147 bundle.js:+10487282, +10486301, +10486360

---

### Argument Parsing (`B$1`)

Responsible for extracting the optional branch name from the raw command input.

```
function parseArgument(rawInput):
    // Find first non-command token
    token = collection.find(rawInput)                  // B$1 → _.find
    // Sanitise special characters for title use
    cleanName = token.replace(specialChars, escaped)   // B$1 → A.replace
    return cleanName or null
```

Analysis basis: CC v2.1.147 bundle.js:+10483852, +10483930

---

### File Copy Routine (`F$1`)

Handles physical duplication of the conversation backing store to the new session path.

```
async function copyConversationStore(source, dest, opts):
    // Open read stream on source (chunk size 448 bytes)  bundle.js:+10484132
    readStream  = fs.createReadStream(source, { highWaterMark: 448 })
    // Open write stream on destination (chunk size 384)  bundle.js:+10484342
    writeStream = fs.createWriteStream(dest,  { highWaterMark: 384 })

    lineReader = readline.createInterface({ input: readStream })

    // Process lines; apply content-replacement pass      bundle.js:+10484727
    transformedLines = lineReader.map(line => transformLine(line))

    // Write transformed content (text type)              bundle.js:+10483873
    writeStream.write(transformedLines, "utf8")           // bundle.js:+10484183

    // Await drain                                        bundle.js:+10484607
    await waitForDrain(writeStream)

    // Finalise
    writeStream.end()
    await stream.finished(writeStream)                    // F$1 → U$1.finished

    // Cleanup: remove temporary artefacts on error
    on error:
        fs.unlink(dest)                                   // F$1 → CP8.unlink
        throw error
```

Analysis basis: CC v2.1.147 bundle.js:+10484101, +10484150, +10484296, +10484390, +10484510, +10485678

---

### Session Setup and Context Resolution (`g$1`)

Opens the branched session after the store has been copied.

```
async function conversationSetup(newSessionId, title, marker):
    // Initialise conversation context object
    ctx = createConversationContext(newSessionId)      // g$1 → CO, v4

    // Register the copy routine bound to the new id
    copyJob = scheduleCopy(newSessionId)               // g$1 → F$1

    // Find existing session descriptor for source
    sourceDescriptor = sessions.find(s => ...)         // g$1 → $.find

    // Apply title and fork marker to new session
    applyTitle(ctx, title)                             // g$1 → MT7 (via cx path)
    ctx.forkMarker = "fork"                            // bundle.js:+10487018

    // Notify session store of fork event
    emitForkEvent(ctx)                                 // g$1 → bLH → Ir_.emit

    // Begin session resume sequence
    ctx.resume()                                       // g$1 → H.resume

    // Log ISO timestamp of branch creation
    logTimestamp(new Date().toISOString())             // g$1 → z.toISOString
```

Analysis basis: CC v2.1.147 bundle.js:+10486193, +10486301, +10486360, +10486433, +10486464, +10486482, +10487005

---

### Title / Duplicate Detection (`MT7`)

Detects collisions in branch names and appends an incrementing numeric suffix when needed.

```
function resolveUniqueTitle(desiredTitle, existingTitles):
    // Strip/escape special characters
    sanitised = escapeSpecialChars(desiredTitle)       // MT7 → uu (H.replace)

    // Scan existing session titles for conflicts
    usedNumbers = new Set()                            // MT7 → K.add, K.has
    for each title in existingTitles:
        n = parseInt(suffixOf(title))                  // MT7 → parseInt
        if n is valid: usedNumbers.add(n)

    // Find lowest unused suffix
    suffix = findLowestUnused(usedNumbers)
    return suffix > 0 ? sanitised + " " + suffix : sanitised
```

Analysis basis: CC v2.1.147 bundle.js:+10485870, +10485971, +10486065, +10486071, +10486118

---

### Worktree Detection (`uyH`)

Called during path resolution to determine whether the source conversation lives inside a Git worktree, influencing the destination path computation.

```
function detectWorktree(conversationPath):
    // Run git worktree --porcelain           bundle.js:+11657776
    result = execSync(["git", "worktree", "--porcelain"])
    entries = result.split("\n")

    // Find matching worktree root
    match = entries.find(e => e.startsWith("worktree "))  // bundle.js:+11657977
    if match:
        root = match.slice(9)                              // bundle.js:+11658008
        emitTelemetry("tengu_worktree_detection")          // bundle.js:+11657858
        return root
    return null
```

Analysis basis: CC v2.1.147 bundle.js:+11657714, +11657749, +11657858

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_conversation_forked` (bundle.js:+10486497) — emitted on every successful branch |
| Telemetry | `tengu_worktree_detection` (bundle.js:+11657858) — emitted when a Git worktree is detected during path resolution |
| Telemetry | `tengu_session_renamed` (bundle.js:+12637168) — emitted if a custom title is applied via `cx` path |
| Telemetry | `tengu_agent_name_set` (bundle.js:+12640197) — emitted if agent-name metadata is written to the branched session |
| Disk writes | New session directory created under the CC projects store; conversation JSONL copied with content-replacement pass applied |
| Disk reads | Source conversation backing store opened as a read stream |
| Temporary files | Temp artefact removed via `fs.unlink` on copy failure (bundle.js:+10484510) |
| appState changes | New session entry added to the session roster; branched session opened and brought into focus |
| Fork marker | String `"fork"` injected into the new session descriptor (bundle.js:+10487018) |
| Default title | `"Branched conversation"` used when no `[name]` argument is provided (bundle.js:+10483800) |
| Error guard — empty history | Hard error `"No messages to branch"` returned if message list is empty (bundle.js:+10485268) |
| Error guard — no session | Hard error `"No conversation to branch"` returned if backing store path is absent (bundle.js:+10484247) |
| Content type | Lines written with type `"text"` (bundle.js:+10483873) |
| Chunk sizes | Read stream highWaterMark: `448` bytes (bundle.js:+10484132); write stream highWaterMark: `384` bytes (bundle.js:+10484342) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.147 | Initial analysis |

---

## Common Mistakes

1. **Branching an empty session** — `/branch` requires at least one message in the current conversation. Running it immediately after `/new` produces the error `"No messages to branch"`.
2. **Expecting in-place editing** — The branch is a full copy; edits in the branched session do not propagate back to the original conversation.
3. **Forgetting the alias** — `/fork` is a fully supported alias for `/branch` and behaves identically (alias registered at bundle.js:+10487018 literal context; alias array confirmed in registration).
4. **Supplying a name with special characters** — The `[name]` argument is sanitised (special characters are escaped) before being applied as the title. The displayed title may differ slightly from the literal input.
5. **Conflicting branch names** — If the supplied name matches an existing session title, a numeric suffix is appended automatically by the duplicate-detection routine (`MT7`); the user does not receive an explicit warning.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `fT7` | Top-level async handler for `/branch` (Arbor-resolved entry point) |
| `g$1` | Session setup / conversation context initialiser |
| `F$1` | File copy routine — streams source store to destination |
| `B$1` | Argument parser — extracts optional branch name from raw input |
| `MT7` | Unique-title resolver — detects and de-duplicates branch names |
| `rd` | Completion/tab-suggestion provider for the command |
| `uyH` | Worktree detection helper (runs `git worktree --porcelain`) |
| `vU1` | File-system path enumerator used during completion |
| `KhH` | Buffer utility used in path/completion encoding |
| `CO` | Conversation context factory |
| `v4` | Context registration helper |
| `r9` | Low-level runtime registration shim |
| `cx` | Session title ("custom-title") application helper |
| `I7H` | File append / mkdir helper for session metadata |
| `bLH` | Agent-name setter; emits `Ir_.emit` fork event |
| `dF` | Conversation store read/write coordinator |
| `jL6` | JSONL file read/write utility (path join + parse + stringify) |
| `Uq` | String slice helper (indexOf + slice) |
| `uu` | Special-character escaper (H.replace with `\$&` pattern) |
| `h6` | Session path builder |
| `oV` | Base path resolver |
| `w_` | Supplementary path helper |
| `JV` | Joined-path constructor |
| `XM` | Extended path metadata assembler |
| `sy` | Sub-path helper feeding into `oV` |
| `zR` | Path component helper |
| `AO` | Ancillary path option resolver |
| `J8` | Error normaliser |
| `q8` | Promise rejection handler / error channel |
| `RH` | Structured error reporter (logs via `Gl.logError`) |
| `n_` | Error type classifier (`code`/`errno` inspection) |
| `UH` | String coercion utility |
| `j1` | Error-chain builder |
| `XwA` | Error wrapper |
| `FpK` | FIFO error queue (shift/push) |
| `S6A` | Session lifecycle manager (spawn, roster, cleanup) |
| `v6A` | Background session claim / IPC connect routine |
| `sw5` | Claim-frame builder (`KB.buildClaimFrame`) |
| `tw5` | Send-claim timeout handler |
| `ZH` | String coercion wrapper |
| `bU` | Binary frame encoder (Buffer pack for IPC) |
| `So_` | Session persistence writer (`D_H.writeFile` + JSON.stringify) |
| `zT6` | Session directory path builder |
| `Ny` | Session path helper (split variant) |
| `UU` | Session file path builder (with `qF_`) |
| `QLH` | Session roster file path builder |
| `gsH` | Async skill-index / hook refresh helper |
| `bw` | Session state tracker (feeds `TZ` "active" marker) |
| `h5` | Session working-directory helper |
| `dq` | Conversation file cache manager (stat / readFile / hOH map) |
| `RK` | Roster key path builder |
| `K` | Roster entry formatter (padEnd, map) |
| `D` | Daemon spawn / re-spawn orchestrator |
| `V6A` | Background spare process spawner (Bun.spawn) |
| `w` | Worker / agent lifecycle driver |
| `C` | Agent session controller (SfK + Az + N + RH) |
| `N` | Shell command builder / executor |
| `SfK` | Realpath + stat verifier |
| `Nj5` | LY8-based helper |
| `sG8` | Memory-aware session gating |
| `V6` | Low-memory guard (Pg map, V$H set) |
| `T$6` | Pin-file reader (`pins.json`) |
| `M$_` | Pin path resolver (`jX.join` + `wG`) |
| `B6` | JSON.parse wrapper |
| `v9L` | Directory pin enumerator (readdir + readFile) |
| `g` | Settled-session filter / retire helper |
| `oH` | Session filter feeding `Z6` |
| `vH` | Session presence map (has → V) |
| `Y` | Session output / config update manager |
| `j` | Process kill enumerator |
| `y` | Transient session kill handler |
| `W` | Debounced skill/hook refresh queue |
| `qzH` | Skill-index update coordinator |
| `hL` | Hook loader (Z2, EZ, JV, b6) |
| `Ah` | Hook path resolver (feeds `oV`) |
| `Z2` | Model-aware hook config builder |
| `EZ` | Effort-level hook config builder |
| `b6` | Hook source bundler (sb6 + w_) |
| `e2` | Hook execution engine (main hook runner) |
| `Qm` | Policy-settings reader |
| `k7H` | Hook kind dispatcher (h_ + S7) |
| `Ho_` | Hook match / filter engine |
| `FB1` | Hook match result builder |
| `er_` | Third-party hook filter |
| `QB1` | Hook result combiner |
| `CH` | JSON.stringify wrapper |
| `C2H` | Hook context builder (feeds `ub6`) |
| `iZ` | AbortController timeout wrapper |
| `Y_H` | Hook metadata accessor |
| `SV` | Hook result validator |
| `oT8` | Hook type-specific result handler (UQ_ + BQ_) |
| `ar_` | MCP tool hook dispatcher |
| `eT8` | Hook output parser (JSON / plain text) |
| `O8H` | Hook output transformer (fromEntries) |
| `or_` | HTTP hook executor (k_.post) |
| `BB1` | HTTP hook response parser |
| `O7H` | Hook error type classifier |
| `HE8` | Command/shell hook executor (aT8.spawn) |
| `WNH` | Hook watch-path manager |
| `pgH` | Hook pending-check helper |
| `tw8` | Hook debounce timer |
| `qo` | Skill-cache clear coordinator |
| `gHH` | Skill-index cache clearer (FF_ + H.clearSkillIndexCache) |
| `Vw8` | Skill reload trigger |
| `gA1` | Skill registration helper |
| `_kH` | Skill index cache reset (Pw8.clear) |
| `P` | IPC message framer / socket reader |
| `KM` | IPC frame finaliser |
| `fj5` | PTY / background-session attach handler |
| `f` | MCP server state updater |
| `EkH` | MCP connection manager |
| `k7K` | MCP update applier (applyMcpUpdate) |
| `_D5` | MCP client roster diff / reconnect logic |
| `HY` | Background service state accessor (v$H → V6) |
| `v$H` | Background service state map |
| `k6A` | IPC lease tracker |
| `LfK` | IPC lease timeout manager |
| `r8` | Promise-with-timeout helper |
| `X` | Terminal repaint coordinator |
| `YN8` | Repaint scheduler |
| `WT` | Working-tree path joiner |
| `$v` | Project path resolver |
| `Lz` | Path slice / normalise helper |
| `G$` | Realpath / normalize wrapper |
| `RMH` | File line-reader (open + createInterface) |
| `Lj5` | Attach scroll / max-row calculator |
| `u` | PTY write-with-clear-timeout helper |
| `b` | PTY interval helper |
| `Z` | Interval / state accumulator |
| `h8H` | PTY state snapshot helper |
| `Mj5` | PTY respawn / re-attach sequence |
| `I` | Away-summary orchestrator |
| `VY8` | App-state getter (XoH.getState) |
| `xM5` | Away-summary cache check (Be_) |
| `s6K` | Rate-limit check helper |
| `w18` | Away-summary API call wrapper |
| `sM1` | UUID generator for away-summary requests |
| `B` | Message history accessor (g + $) |
| `t` | Voice toggle silence-timeout handler |
| `Q` | Timer wrapper (LT6 + Rw1) |
| `i` | Voice focus-silence handler |
| `p` | Voice PTY write / round helper |
| `e` | Voice focus-silence timeout (G.current) |
| `G` | Voice session state refs (F06 + YN8) |
| `l` | Session filter for output (o.filter) |
| `o` | Voice/session event loop |
| `d` | Voice teardown helper (Ta_) |
| `Ta_` | Voice teardown implementation |
| `KN6` | IPC channel destroy / write helper |
| `hf` | Completion cache lookup |

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.