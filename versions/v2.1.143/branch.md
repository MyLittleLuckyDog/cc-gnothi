---
type: feature-spec
feature: "branch"
cc_version: "2.1.143"
updated: "2026-06-01"
tags: ["branch", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.143 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/branch`

> Analysis basis: CC v2.1.143 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.143

---

## Overview

`/branch` (also available as `/fork`) creates a divergent copy of the current conversation at the point where the command is invoked. It duplicates the conversation history up to that point into a new session, allowing the user to explore an alternative direction without modifying the original session. The new session receives an optional user-supplied name; if none is provided a default title is assigned.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `branch` |
| description | `Create a branch of the current conversation at this point` |
| argumentHint | `[name]` |
| aliases | `["fork"]` |
| module_id | `VC_` |
| load_inline | `true` |
| loc_byte | `11482531` |
| loc_byte_end | `11482725` |
| loc_line | `7075` |
| arbor_handler.name | `LO7` |
| arbor_handler.fqn | `claude-2.1.143::LO7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.143 bundle.js:+11482531

---

## Input Branching

The command has four distinct execution paths, determined by the presence of existing messages and whether a name argument is supplied:

```mermaid
flowchart TD
    A["/branch [name] invoked"] --> B{Active conversation\nexists?}
    B -- No --> ERR1["Error: 'No conversation to branch'\n(bundle.js:+10050778)"]
    B -- Yes --> C{Messages present\nin conversation?}
    C -- No --> ERR2["Error: 'No messages to branch'\n(bundle.js:+10051780)"]
    C -- Yes --> D{Name argument\nprovided?}
    D -- No --> E["Use default title:\n'Branched conversation'\n(bundle.js:+10050337)"]
    D -- Yes --> F["Sanitise & use\nsupplied name"]
    E --> G[Copy history up to\ncurrent point]
    F --> G
    G --> H[Generate new session UUID\n(bundle.js:+10050576)]
    H --> I[Create session directory\n& write files]
    I --> J[Register new session\nin roster]
    J --> K[Emit tengu_conversation_forked\n(bundle.js:+10053009)]
    K --> L[Switch active session\nto branch]
    L --> DONE["Branch ready"]
```

---

## Behavioral Spec

### Top-level handler — `LO7` (AsyncFunction)

The Arbor symbol graph resolves the handler as `LO7` via `module_id` resolution from module `VC_`.

Analysis basis: CC v2.1.143 bundle.js:+10053794 (entry point of `LO7`)

```
async function branchCommandHandler(context):
    // Step 1 — guard: conversation must exist
    if no active conversation:
        raise UserError("No conversation to branch")    // +10050778

    // Step 2 — guard: messages must be present
    conversationMessages = getMessagesUpToCursor(context)
    if conversationMessages is empty:
        raise UserError("No messages to branch")        // +10051780

    // Step 3 — resolve branch name
    rawName = getArgumentFromInput(context)             // +10050389 (s1q: find + replace)
    if rawName is blank:
        branchTitle = "Branched conversation"           // +10050337
    else:
        branchTitle = sanitiseName(rawName)

    // Step 4 — generate new session identity
    newSessionId = crypto.randomUUID()                  // +10050576 (r1q.randomUUID)

    // Step 5 — build session filesystem layout
    sessionDir = buildSessionPath(newSessionId)         // calls g5 → QZ → path helpers
    fs.mkdir(sessionDir, { recursive: true })           // +10050632 (hD8.mkdir)

    // Step 6 — stream-copy existing conversation file
    sourceStream = fs.createReadStream(existingPath,    // +10050681
                       { encoding: "utf8",              // +10050714
                         highWaterMark: 448 })          // +10050663
    destStream   = fs.createWriteStream(destPath)       // +10050827
    pipe(sourceStream → destStream)
    await streamFinished(destStream)                    // +10052190 (a1q.finished)

    // Step 7 — process message lines (content-replacement pass)
    for each line read via createInterface:             // +10050921
        annotate line type as "text"                    // +10050410
        push to new message list

    // Step 8 — write session metadata
    writeSessionMetadata(newSessionId, branchTitle,     // calls Ub / bKH
                         conversationMessages)
    emitSessionRenamedTelemetry()                       // +12141118 (tengu_session_renamed)
    // tag as "fork" in session record                  // +10053530

    // Step 9 — register in session roster
    addToRoster(newSessionId, rosterEntry)              // +14509022 (_.rosterEntry)

    // Step 10 — record progress / fire telemetry
    emit("progress")                                    // +10051698
    emitTelemetry("tengu_conversation_forked")          // +10053009

    // Step 11 — switch active session
    activateSession(newSessionId, context)
```

### Name resolution sub-function — `s1q`

Analysis basis: CC v2.1.143 bundle.js:+10050389

```
function resolveInputName(rawInput):
    found = rawInput.find(commandTokenPattern)     // +10050389 (_.find)
    cleaned = found.replace(leadingSlashPattern)   // +10050467 (A.replace)
    return cleaned
```

### Session path builder — `g5` / `QZ`

Analysis basis: CC v2.1.143 bundle.js:+10050621 (call to `g5`), +10050613 (call to `QZ`)

```
function buildSessionPath(sessionId):
    base = getDataDirectory()         // V6 → GV
    parts = [base, sessionId]
    return parts.join(pathSeparator)  // QZ.Kw.join / g5.A$H.join
```

### New-session UUID generation — `t1q`

Analysis basis: CC v2.1.143 bundle.js:+10050576

```
async function createBranchSession(sourceConversation, title):
    id  = crypto.randomUUID()           // r1q.randomUUID  +10050576
    dir = buildSessionPath(id)          // V6              +10050595
    await fs.mkdir(dir, recursive)      // hD8.mkdir       +10050632

    // copy file content (highWaterMark = 448 bytes)      +10050663
    reader = fs.createReadStream(src, { highWaterMark: 448, encoding:"utf8" })
    writer = fs.createWriteStream(dst)
    lineReader = readline.createInterface(reader)          // o1q.createInterface +10050921

    messages = []
    for line of lineReader:
        parsed = JSON.parse(line)                         // R6 +10051225
        // content-replacement pass                       +10051258
        messages.push(processLine(parsed))

    writer.end()
    await finished(writer)

    return { id, dir, messages }
```

### Session metadata writer — `Ub` / `bKH`

Analysis basis: CC v2.1.143 bundle.js:+10052976 (`Ub`), +10052994 (`bKH`)

```
function writeSessionTitle(sessionDir, title):
    // appends to per-session log file using appendFileSync
    H4H.appendFileSync(logPath, encoded)       // +12140073
    H4H.mkdirSync(dir, recursive)              // +12140112
    emitTelemetry("tengu_session_renamed")     // +12141118

function writeAgentName(sessionDir, agentName):
    // writes agent-name file and emits event
    bKH → lB → WQ_.emit()                     // +12144134
    emitTelemetry("tengu_agent_name_set")      // +12144147

```

### Telemetry emission at fork completion

Analysis basis: CC v2.1.143 bundle.js:+10053009

```
function emitForkTelemetry(context):
    // fires exactly once per successful /branch execution
    telemetry.emit("tengu_conversation_forked", {
        sessionId: newSessionId,
        sourceSessionId: context.sessionId,
        tag: "fork"                            // +10053530
    })
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_conversation_forked` (bundle.js:+10053009); `tengu_session_renamed` (bundle.js:+12141118); `tengu_agent_name_set` (bundle.js:+12144147) |
| Filesystem | Creates new session directory via `fs.mkdir` recursive (+10050632); writes conversation transcript via `createReadStream`/`createWriteStream` pipe (+10050681, +10050827); writes session metadata files (appendFileSync +12140073) |
| Session roster | Adds new session entry via roster registration call (+14509022) |
| Active session | Switches the active session to the newly created branch after all writes complete |
| Event emitter | Fires internal events via `lG6.emit` (+12141105), `WQ_.emit` (+12144134) |
| appState changes | The active conversation pointer is updated; the new session is inserted into the session list |
| Sound | None detected in depth-2 traversal |
| Hook registration | None detected specific to this command |
| `progress` event | Emitted during copy operation (+10051698) with `"content-replacement"` tag (+10051258) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.143 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/branch` outside a conversation** — The command requires an existing active conversation. Running it before any exchange has taken place produces `"No conversation to branch"` (bundle.js:+10050778).
2. **Invoking `/branch` when no messages exist** — Even with an active session, if no messages have been exchanged the command aborts with `"No messages to branch"` (bundle.js:+10051780). This can occur if a session was opened but the first user message has not yet been sent.
3. **Expecting the original session to be affected** — `/branch` only reads the source history; it does not modify the original session in any way. All subsequent changes occur in the new branch session.
4. **Supplying a branch name with special shell characters** — The `s1q` name-resolution path runs a `replace` normalisation pass (+10050467); exotic characters may be stripped silently rather than producing an error.
5. **Confusing `/branch` with `/fork`** — Both names trigger identical behaviour; `fork` is registered as an alias (registration field `aliases: ["fork"]`).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `LO7` | Main async handler for `/branch` command (resolved by Arbor via module_id `VC_`) |
| `e1q` | Outer orchestration function called by `LO7`; drives the full branch-creation flow |
| `t1q` | Session-copy async function; creates directory, streams conversation file, builds message list |
| `s1q` | Input-name resolver; finds and cleans the argument token from raw command input |
| `KO7` | Session deduplication helper; tracks seen session IDs to prevent conflicts |
| `nQ` | Completion/notification dispatcher called after branch is registered |
| `uNH` | Worktree detection utility used during session path resolution |
| `Dyq` | Path completion / directory listing helper used when resolving session directories |
| `tNH` | Buffer-encoding utility used during file copy |
| `g5` | Session path assembly (joins base data directory with session ID) |
| `QZ` | Conversation path builder (extends `g5` with conversation-specific subpath) |
| `V6` | Base data-directory accessor |
| `GV` | Low-level platform directory resolver |
| `__` | Utility: constructs filesystem paths from components |
| `l$` | Utility: retrieves configured data root |
| `Ub` | Writes custom session title (fires `tengu_session_renamed`) |
| `H4H` | File-system helpers: `appendFileSync`, `mkdirSync` for session log files |
| `bKH` | Writes agent-name metadata for the new session (fires `tengu_agent_name_set`) |
| `lB` | Wrapper that calls `gq6` to persist config changes and records timestamp |
| `gq6` | Reads and writes session config JSON files |
| `m1` | String utilities: `indexOf` / `slice` for message line parsing |
| `xx` | String escaping helper used during session naming |
| `iM` | Map-based lookup helper used in completion suggestion filtering |
| `R6` | JSON parse wrapper used when deserialising conversation lines |
| `hH` | JSON stringify wrapper used when serialising messages |
| `jo_` | Session-manager worker; handles session lifecycle state transitions |
| `Oo_` | Daemon claim-and-spawn helper; used when the branch needs a background worker |
| `w` | Supervisor process manager; manages worker processes |
| `D` | Session-slot scheduler; decides when to recycle or spawn new session slots |
| `NH` | Sub-process spawner used for background execution |
| `xH` | String coercion utility |
| `v_` | Error classification helper (checks error codes) |
| `SH` | Rendered-output flusher |
| `mH` | Display-update dispatcher |
| `G6` | Memory-aware session gate (checks available memory before spawning) |
| `IG6` | Low-memory metrics collector |
| `Gd_` | Session directory initialiser (mkdir + writeFile for roster entry) |
| `$o_` | Background spare-session spawner (`Bun.spawn`) |
| `cq5` | PTY / attach loop handler; manages terminal attach lifecycle |
| `dq5` | PTY-initialisation sub-step within the attach loop |
| `s8K` | Dispatch-slot timeout manager |
| `Vf` | PTY-frame encoder / decoder |
| `P` | Inbound message framer (buffers chunks and splits on frame boundaries) |
| `M` | MCP session orchestrator |
| `SvH` | MCP server connection manager |
| `THK` | MCP update applier |
| `B95` | MCP bulk-update coordinator |
| `Bw` | Background-service context builder |
| `tMH` | Service-mode label resolver |
| `r8` | Async retry-with-backoff utility |
| `I3H` | Skill/hook pipeline runner |
| `L4` | Agent-turn executor |
| `j2` | Tool-use and hook dispatch engine |
| `l28` | Hook spawner (forks subprocess for hook commands) |
| `cQ_` | Hook-configuration loader |
| `gQ_` | HTTP-hook dispatcher |
| `WSq` | Hook-output parser |
| `c28` | Hook-result normaliser |
| `QQ_` | Hook-completion handler |
| `SZ` | Abort-signal / timeout controller |
| `W` | Skill-result accumulator with debounced flush |
| `rHH` | Skill-result renderer |
| `Y` | Session open/close lifecycle controller |
| `XJH` | Session-open implementation |
| `cIq` | Terminal-layout recalculator |
| `T` | Remote-control event handler |
| `c2` | Settings loader called during remote-control setup |
| `p_` | Full settings-chain resolver (policy → flag → user → project → local) |
| `N` | Away-summary generator |
| `KM8` | Rate-limit state reader |
| `Te7` | Away-summary eligibility checker |
| `W18` | Away-summary API caller |
| `K1q` | UUID generator for away-summary requests |
| `g` | Conversation-history slice helper |
| `AH` | Voice-recording session manager |
| `o` | Voice input event loop |
| `G_K` | Heartbeat scheduler |
| `Zs` | Heartbeat tick handler |
| `mp` | Binary-frame packer for IPC messages |
| `IK` | Session-label formatter |
| `K` | Label padding helper |
| `s1` | Session-file stat / cache helper |
| `rw` | Active-session state transition helper |
| `Bf` | Session-flag writer |
| `SoH` | Session-hook async dispatcher |
| `wLH` | Windows-specific path utility |
| `Bk` | Platform path reader (splits on OS separator) |
| `gp` | Session-roster query helper |
| `zW6` | Roster-entry directory writer |
| `d6H` | Diagnostic/debug log emitter |
| `IBH` | Active-session presence check |
| `JrH` | Debounce-cache clearer |
| `C` | Process-supervisor bootstrap |
| `Z_K` | Supervisor binary realpath resolver |
| `MK5` | Supervisor argument builder |
| `z` | PTY write-stream wrapper |
| `y` | Process kill helper |
| `j` | Subprocess manager |
| `O` | Readline / IPC stream wrapper |
| `Ap` | Session-attachment helper |
| `GSq` | Tool-group selector |
| `TSq` | Tool-schema transformer |
| `dQ_` | Third-party hook filter |
| `_4H` | Effort-level resolver |
| `bm` | Model-capability checker |
| `hh` | Per-turn context assembler |
| `g28` | Turn-metadata builder |
| `d1` | AsyncLocalStorage store accessor |
| `eF_` | Session-store initialiser |
| `Yy` | Config file locator |
| `QX` | Model-effort parameter builder |
| `sE` | Effort-to-token-budget mapper |
| `S6` | System-prompt builder |
| `mLH` | Message-length tracker |
| `XX` | Token-count estimator |
| `FK` | Finalised-message serialiser |
| `Jp` | Spawn-args builder for hook subprocess |
| `Fj6` | Hook environment-variable injector |
| `T_H` | Hook timeout enforcer |
| `G$8` | Hook output size limiter |
| `E_` | Token-budget calculator |
| `WV8` | Effort-string validator |
| `jSq` | Async-hook poller |
| `oL` | Hook-result logger |
| `JZ` | Replacement-token substituter |
| `Qt` | Output-capture helper |
| `g1H` | Plugin-root expander |
| `fH` | File-content embedder for hooks |
| `w$8` | Shell-command builder |
| `NS` | Named-pipe creator |
| `cA8` | Process-environment builder |
| `C2` | Canonical project-path resolver |
| `hV` | Project-path joiner |
| `YO` | Path normaliser |
| `d$` | Realpath resolver |
| `A5H` | File-head reader (reads first N lines) |
| `Qq5` | Terminal-size estimator |
| `z6H` | PTY-dimensions broadcaster |
| `HZ6` | PTY write helper |
| `Do_` | Dispatch-slot map accessor |
| `N8` | IPC message decoder |
| `Oc_` | PTY write-queue manager |
| `c6` | Keyboard-event router |
| `F` | MCP-tool permission filter |
| `P6` | Orphaned-permission tracker |
| `KL` | Configuration loader (reads claude config file) |
| `h9` | Config file registry |
| `x6` | Config file path resolver |
| `xx` | Regex-escape helper (replaces special chars with `\$&` literal) |
| `iM` | Completion-cache map |
| `PqH` | Skill-result type guard |
| `Cz8` | Skill-result content extractor |
| `Ft1` | Skill-result error handler |
| `LY8` | Skill-result display renderer |