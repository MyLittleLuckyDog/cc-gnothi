---
type: feature-spec
feature: "branch"
cc_version: "2.1.173"
updated: "2026-06-11"
tags: ["branch", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.173 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/branch`

> Analysis basis: CC v2.1.173 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.173

---

## Overview

The `/branch` command forks the current conversation at its present point in time, creating a new independent conversation session that begins from the same message history. It copies the existing conversation transcript into a fresh session context, optionally assigning a user-supplied name, and emits the `tengu_conversation_forked` telemetry event on success. The core mechanism involves serializing current conversation state, generating a new session identifier, writing the branched transcript to disk, and launching a new session context.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `branch` |
| description | `Create a branch of the current conversation at this point` |
| argumentHint | `[name]` |
| module_id | `ofA` |
| load_inline | `true` |
| loc_byte | `12725503` |
| loc_byte_end | `12725680` |
| loc_line | `8999` |
| arbor_handler.name | `KV7` |
| arbor_handler.fqn | `claude-2.1.173::KV7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.173 bundle.js:+12725503

---

## Input Branching

Four distinct execution paths exist depending on conversation state and user input, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/branch [name] invoked"] --> B{Active conversation\nexists?}
    B -- No --> C["Return error:\n'No conversation to branch'\n(bundle.js:+11168508)"]
    B -- Yes --> D{Messages present\nin conversation?}
    D -- No --> E["Return error:\n'No messages to branch'\n(bundle.js:+11169627)"]
    D -- Yes --> F{User supplied\na branch name?}
    F -- No --> G["Auto-generate name\nfrom conversation content\n(bundle.js:+11170810)"]
    F -- Yes --> H["Sanitize supplied name\nvia nameSlugifier\n(bundle.js:+11168191)"]
    G --> I[Generate new UUID for branch session]
    H --> I
    I --> J[Serialize conversation transcript\nup to current point]
    J --> K["Write 'Branched conversation'\nheader + transcript to disk\n(bundle.js:+11168061)"]
    K --> L[Register new session\nwith fork type marker\n(bundle.js:+11171377)]
    L --> M[Emit tengu_conversation_forked\ntelemetry]
    M --> N[Launch new session\nin branch context]
    N --> O[Return success to UI]
```

---

## Behavioral Spec

### Entry Point — Main Branch Handler (`KV7`)

The handler is an `AsyncFunction` resolved via the `module_id` path (`ofA`). It is the sole top-level entry point for the `/branch` command.

```
async function branchCommandHandler(commandInput, appContext):
    branchName = commandInput.args.trim()  // optional user-supplied name

    // Step 1: Guard — require an active conversation
    conversationSession = lookupCurrentConversation(appContext)
    if conversationSession is null:
        return errorResult("No conversation to branch")
        // Analysis basis: CC v2.1.173 bundle.js:+11168508

    // Step 2: Guard — require at least one message
    messageList = getConversationMessages(conversationSession)
    if messageList is empty:
        return errorResult("No messages to branch")
        // Analysis basis: CC v2.1.173 bundle.js:+11169627

    // Step 3: Determine branch name
    if branchName is empty:
        resolvedName = autoGenerateName(conversationSession)
        // "auto" mode — Analysis basis: CC v2.1.173 bundle.js:+11170810
    else:
        resolvedName = sanitizeName(branchName)
        // Analysis basis: CC v2.1.173 bundle.js:+11168191

    // Step 4: Delegate to fork orchestrator
    result = await forkOrchestrator(conversationSession, resolvedName, appContext)
    return result
```

Analysis basis: CC v2.1.173 bundle.js:+11171641

---

### Fork Orchestrator (`Blq`)

This function coordinates the full fork sequence: transcript serialization, disk I/O, session registration, and telemetry emission.

```
async function forkOrchestrator(session, resolvedName, appContext):
    // Step 1: Snapshot the message stream up to the current timestamp
    forkTimestamp = new Date()
    snapshotMessages = collectMessagesUpTo(session, forkTimestamp)
    // Analysis basis: CC v2.1.173 bundle.js:+11170995

    // Step 2: Write branched transcript via transcriptWriter
    newSessionId = generateUUID()
    // Analysis basis: CC v2.1.173 bundle.js:+11168300

    transcriptWriter(
        sessionId    = newSessionId,
        title        = "Branched conversation",   // fixed literal
        messages     = snapshotMessages,
        contentType  = "text"
    )
    // "Branched conversation" — Analysis basis: CC v2.1.173 bundle.js:+11168061
    // "text" content type   — Analysis basis: CC v2.1.173 bundle.js:+11168134

    // Step 3: Find matching conversation entry for parent session
    parentEntry = find(appContext.conversations, session.id)
    // Analysis basis: CC v2.1.173 bundle.js:+11170723

    // Step 4: Register the new session as a fork
    registerSession(newSessionId, resolvedName, forkType = "fork", parentEntry)
    // "fork" marker — Analysis basis: CC v2.1.173 bundle.js:+11171377

    // Step 5: Emit telemetry
    emit("tengu_conversation_forked")
    // Analysis basis: CC v2.1.173 bundle.js:+11170856

    // Step 6: Resume input stream, signal completion
    resumeInputStream(session)
    // Analysis basis: CC v2.1.173 bundle.js:+11171364

    return { type: "fork", sessionId: newSessionId, name: resolvedName }
```

Analysis basis: CC v2.1.173 bundle.js:+11170552

---

### Transcript Writer (`Ulq`)

This async function handles the actual serialization of conversation history into a new on-disk session file.

```
async function transcriptWriter(sessionId, title, messages, contentType):
    // Step 1: Build the destination directory path
    destDir = buildSessionPath(sessionId)
    // mkdirSync equivalent — Analysis basis: CC v2.1.173 bundle.js:+11168362

    // Step 2: Create a read stream from the current session's backing store
    readStream = createReadStream(currentSessionFile)
    // Analysis basis: CC v2.1.173 bundle.js:+11168411

    // Step 3: Handle content-replacement markers
    // Annotates messages with "content-replacement" type tag
    // Analysis basis: CC v2.1.173 bundle.js:+11168988

    // Step 4: Write the branched conversation to the new session file
    writeStream = createWriteStream(destPath, flags = 0o600)
    // Mode 384 (0o600) — Analysis basis: CC v2.1.173 bundle.js:+11168603

    pipe(readStream, writeStream)

    // Step 5: Await stream completion
    await streamFinished(writeStream)
    // Analysis basis: CC v2.1.173 bundle.js:+11170037

    // Step 6: Post-write — emit progress signal, clean up temp files
    emit("progress")
    // Analysis basis: CC v2.1.173 bundle.js:+11169545

    // Step 7: Apply model_refusal_fallback handling if needed
    // Analysis basis: CC v2.1.173 bundle.js:+11169302
```

Analysis basis: CC v2.1.173 bundle.js:+11168300

---

### Name Sanitizer (`plq`)

Normalises the user-supplied branch name to a filesystem-safe slug.

```
function sanitizeName(rawName):
    // Step 1: Find a matching known pattern via _.find
    match = patternRegistry.find(rawName)
    // Analysis basis: CC v2.1.173 bundle.js:+11168113

    // Step 2: Replace disallowed characters
    safeName = rawName.replace(disallowedPattern, replacement)
    // Analysis basis: CC v2.1.173 bundle.js:+11168191

    return safeName
```

Analysis basis: CC v2.1.173 bundle.js:+11168113

---

### Branch Name Builder for Auto Mode (`qV7`)

When no name is supplied, this function builds a name from the conversation content.

```
function autoNameBuilder(session, inputHint):
    // Step 1: Build a candidate name from conversation participant data
    candidate = buildNameFromParticipants(session)
    // nameNormalizer(kv) strips special chars — Analysis basis: CC v2.1.173 bundle.js:+11170330

    // Step 2: Deduplicate against the existing branch name registry
    nameSet = new Set()
    index = parseInt(collisionIndex)
    // Analysis basis: CC v2.1.173 bundle.js:+11170430

    while nameSet.has(candidate):
        candidate = candidate + "-" + index
        index++
    nameSet.add(candidate)
    // Analysis basis: CC v2.1.173 bundle.js:+11170477

    return candidate
```

Analysis basis: CC v2.1.173 bundle.js:+11170229

---

### Session Title / Agent Name Side Effects (`xR`, `P$H`)

After registering the new fork, two optional metadata side-effects are applied:

```
function applySessionTitle(sessionId, title):
    // Writes "custom-title" metadata to the session record
    // Analysis basis: CC v2.1.173 bundle.js:+13451099
    logFile(sessionId, "custom-title", title)
    emit("tengu_session_renamed")
    // Analysis basis: CC v2.1.173 bundle.js:+13451191

function applyAgentName(sessionId, agentName):
    // Writes "agent-name" metadata to the session record
    // Analysis basis: CC v2.1.173 bundle.js:+13454122
    logFile(sessionId, "agent-name", agentName)
    emit("tengu_agent_name_set")
    // Analysis basis: CC v2.1.173 bundle.js:+13454220
```

Analysis basis: CC v2.1.173 bundle.js:+11170823, +11170841

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_conversation_forked` | Fired on successful fork completion (bundle.js:+11170856) |
| Telemetry — `tengu_session_renamed` | Fired when the branch receives a custom title (bundle.js:+13451191) |
| Telemetry — `tengu_agent_name_set` | Fired when an agent name is attached to the branched session (bundle.js:+13454220) |
| Disk I/O | New session directory created; transcript written with mode `0o600` (384 decimal) (bundle.js:+11168362, +11168603) |
| New UUID | Branch session ID generated via `crypto.randomUUID` (bundle.js:+11168300) |
| Stream state | Parent session input stream is resumed after fork completes (bundle.js:+11171364) |
| `appState` changes | New session entry registered in the conversation roster with type `"fork"` (bundle.js:+11171377) |
| Progress signal | `"progress"` event emitted during write phase (bundle.js:+11169545) |
| Temp-file cleanup | Any intermediate temp files are unlinked after stream finishes (bundle.js:+11168771) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.173 | Initial analysis |

---

## Common Mistakes

1. **Running `/branch` before any messages exist** — The command will return `"No messages to branch"` (bundle.js:+11169627) if the conversation has not yet produced any messages. Start a conversation first.
2. **Running `/branch` outside a conversation context** — If no active conversation session is found, the command returns `"No conversation to branch"` (bundle.js:+11168508). The command is only available inside an active Claude Code session.
3. **Supplying a name with special characters** — The name sanitizer (`plq`) strips disallowed characters from the supplied branch name (bundle.js:+11168191). Unexpected name transformations can result; prefer alphanumeric names with hyphens.
4. **Expecting the parent conversation to be paused** — The parent session's input stream is explicitly resumed after the fork (bundle.js:+11171364). The parent conversation continues normally; only a snapshot is copied.
5. **Assuming the branch is a Git branch** — Despite the name, `/branch` operates on Claude Code's own conversation transcript files and session registry. It does not create a Git branch in the working directory unless a separate tool call performs that action.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `KV7` | Main branch command handler (AsyncFunction, arbor-resolved entry point) |
| `Blq` | Fork orchestrator — coordinates snapshot, disk write, session registration, and telemetry |
| `Ulq` | Transcript writer — handles read/write stream pipeline for the new session file |
| `plq` | Name sanitizer — normalises user-supplied branch name to a filesystem-safe slug |
| `qV7` | Auto-name builder — generates a branch name when none is supplied |
| `Nr` | Conversation participant/name resolution helper |
| `GPK` | File-system directory scanner used during name resolution |
| `u3H` | Git worktree detection utility called during session context setup |
| `epH` | Buffer packing helper used in transcript serialisation |
| `xR` | Session title side-effect writer (emits `tengu_session_renamed`) |
| `P$H` | Agent-name side-effect writer (emits `tengu_agent_name_set`) |
| `NOH` | Low-level log file appender used by `xR` and `P$H` |
| `Kl` | Persistent metadata store writer (reads/writes JSON metadata files) |
| `zj6` | File-based key-value store used by `Kl` |
| `M9` | String slice utility (indexOf + slice pattern) |
| `kv` | Name character normaliser (replace special chars) |
| `y6` | Session state accessor |
| `BG` | Base state getter |
| `P_` | Session path resolver |
| `Jh` | Session log path builder |
| `lM` | Log message formatter |
| `YC` | Session directory resolver |
| `c$` | Config accessor |
| `ok` | Operation lock helper |
| `X$` | Session lookup by ID |
| `$4` | Session type classifier |
| `y9` | Session event registrar |
| `R8` | Error code classifier |
| `N8` | Error normaliser |
| `SH` | Structured error reporter / log emitter |
| `JA` | Error code extractor |
| `f6` | String coercion helper |
| `Rq` | Telemetry queue flusher |
| `CBA` | Telemetry batch builder |
| `MRf` | Telemetry ring-buffer manager |
| `CH` | JSON serialiser wrapper |
| `EH` | String coercion wrapper |
| `a7` | Error-code equality helper |
| `D` | Background session spawn/dispatch manager |
| `b` | Background process launcher |
| `w` | Background session write/update coordinator |
| `N` | Message type normaliser |
| `S` | Background session state machine step |
| `Q` | Daemon IPC connection manager |
| `l` | Task scheduler loop |
| `Q0A` | Daemon claim+connect helper |
| `MjA` | Daemon directory setup helper |
| `k05` | Claim timeout monitor |
| `I05` | Claim frame builder |
| `r0A` | Roster entry lifecycle manager |
| `Hf` | Session path join helper |
| `Tq` | Session state file watcher |
| `YO` | Session active-state resolver |
| `DXH` | Tool-use allowlist filter |
| `m7` | Minimal session metadata writer |
| `Of6` | Async fire-and-forget dispatcher |
| `mx6` | Daemon socket path helper |
| `B$H` | Daemon status path helper |
| `RQ` | Daemon roster-entry path builder |
| `ux6` | Socket path builder |
| `hZ` | Platform socket path resolver |
| `ZwK` | Session status file writer |
| `d9` | Async-local-storage store reader |
| `Sm6` | Status file path builder |
| `Ua` | Session metadata accessor |
| `QsH` | Session checkpoint writer |
| `DW9` | Session history filter |
| `W1H` | Conversation roster loader |
| `OgK` | Tool-change notification formatter |
| `d` | Tool-result renderer |
| `Y` | Forced-shutdown handler |
| `HX` | Abort signal broadcaster |
| `j` | Active-session kill-all helper |
| `ip` | Session index tracker |
| `$` | Session connection object |
| `W` | API request dispatcher |
| `N76` | Request retry classifier |
| `kF8` | macOS memory pressure monitor |
| `Y6` | Feature-flag evaluator |
| `i06` | Pinned-context loader |
| `ck_` | Pins.json path builder |
| `n6` | Safe JSON parser |
| `ht4` | Pinned-file directory scanner |
| `d8` | Process spawn wrapper with timeout |
| `K` | Column formatter |
| `bH` | Feature-flag false-branch handler |
| `kH` | Feature-flag true-branch handler |
| `A6` | Feature-flag state recorder |
| `p` | IPC message framer |
| `Lv` | Binary frame encoder |
| `Hu8` | Binary frame decoder |
| `C` | Write-drain coordinator |
| `B` | Reconnect backoff scheduler |
| `P` | Socket read buffer manager |