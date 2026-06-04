---
type: feature-spec
feature: "branch"
cc_version: "2.1.162"
updated: "2026-06-04"
tags: ["branch", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.162 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/branch`

> Analysis basis: CC v2.1.162 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.162

---

## Overview

`/branch` creates a divergent copy of the current conversation at its present point in history, preserving all prior messages and allowing the user to explore an alternative direction without modifying the original session. The command serialises the conversation transcript up to the fork point into a new session file, then opens that session — optionally naming it via the `[name]` argument. A `tengu_conversation_forked` telemetry event is emitted on success.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `branch` |
| description | `Create a branch of the current conversation at this point` |
| argumentHint | `[name]` |
| module_id | `LHA` |
| load_inline | `true` |
| loc_byte | `12416119` |
| loc_byte_end | `12416296` |
| loc_line | `8785` |
| arbor_handler.name | `MMf` |
| arbor_handler.fqn | `claude-2.1.162::MMf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.162 bundle.js:+12416119

---

## Input Branching

Four distinct execution paths exist (no messages, no conversation, named branch, unnamed branch), so a flowchart is used.

```mermaid
flowchart TD
    A(["/branch [name] invoked"]) --> B{Active conversation\nexists?}
    B -- No --> C["Error: 'No conversation to branch'\n(bundle.js:+10889674)"]
    B -- Yes --> D{Any messages in\nthe conversation?}
    D -- No --> E["Error: 'No messages to branch'\n(bundle.js:+10890695)"]
    D -- Yes --> F{name argument\nprovided?}
    F -- No --> G["Default title: 'Branched conversation'\n(bundle.js:+10889227)"]
    F -- Yes --> H["Sanitise and use\nprovided name"]
    G --> I[Serialise conversation\ntranscript up to fork point]
    H --> I
    I --> J[Generate new UUID for\nbranched session\n(bundle.js:+10889466)]
    J --> K[Build destination path\nand create directory\n(bundle.js:+10889528)]
    K --> L[Stream source JSONL file\ninto new session file\n(bundle.js:+10889577)]
    L --> M{Stream completed\nwithout error?}
    M -- Error --> N[Destroy write stream,\nunlink partial file\n(bundle.js:+10889919,+10889937)]
    M -- Yes --> O[Write branch metadata\nand close streams\n(bundle.js:+10890006,+10891091)]
    O --> P[Emit tengu_conversation_forked\n(bundle.js:+10891924)]
    P --> Q[Open branched session\nin current window]
    Q --> R([Done])
    N --> S([Error reported to user])
    C --> S
    E --> S
```

---

## Behavioral Spec

### Entry Point — `branchCommandHandler` (`MMf`)

The Arbor-resolved handler `MMf` is an `AsyncFunction` that orchestrates the entire branch operation.

```
async function branchCommandHandler(commandInput, appState):
    conversation = getCurrentConversation(appState)
    if conversation is null or undefined:
        displayError("No conversation to branch")
        return

    messages = getConversationMessages(conversation)
    if messages is empty:
        displayError("No messages to branch")
        return

    branchTitle = commandInput.args.trim() || "Branched conversation"
    newSessionId  = generateUUID()           // KCq.randomUUID
    sourcePath    = buildSessionFilePath(conversation)
    destDir       = buildBranchDirectory(newSessionId)
    destPath      = joinPath(destDir, sessionFileName)

    await makeDirectory(destDir, { recursive: true })

    await streamCopySession(sourcePath, destPath, branchTitle)

    emitTelemetry("tengu_conversation_forked")
    openSession(newSessionId)
```

Analysis basis: CC v2.1.162 bundle.js:+10892709

---

### Sub-feature: Session File Copy — `copySessionFile` (`$Cq`)

`$Cq` performs the low-level streaming copy of the conversation JSONL file from the source session to the new branched-session directory. It reads up to and including the fork-point message, rewrites the session header fields (title, session ID), and pipes into the destination write stream.

```
async function copySessionFile(sourcePath, destPath, branchTitle):
    readStream  = createReadStream(sourcePath, { encoding: "utf8" })
    writeStream = createWriteStream(destPath)

    lineInterface = createLineByLineInterface(readStream)
    messageCount  = 0
    MAX_MESSAGES  = 100           // literal: +10889394

    for each line in lineInterface:
        parsed = parseJSON(line)
        if messageCount >= MAX_MESSAGES:
            break
        if parsed.type is "text":
            rewrite title field with branchTitle
        messageCount++
        writeStream.write(serialise(parsed))

    if messageCount == 0:
        writeStream.destroy()
        unlink(destPath)
        throw Error("No messages to branch")

    writeStream.end()
    await streamFinished(writeStream)      // fCq.finished
```

Key constants:
- Message copy limit: **100** messages (bundle.js:+10889394)
- Read-stream buffer size: **448** bytes initial (bundle.js:+10889559)
- Write-stream buffer size: **384** bytes (bundle.js:+10889769)
- Encoding: `"utf8"` (bundle.js:+10889610)

Analysis basis: CC v2.1.162 bundle.js:+10891728

---

### Sub-feature: Slug / Path Construction — `sanitiseBranchName` (`MCq`)

`MCq` is responsible for turning the optional user-supplied name into a filesystem-safe slug used as part of the new session's title metadata.

```
function sanitiseBranchName(rawName, existingTitles):
    matched = find(existingTitles, t => t matches rawName)
    safe    = rawName.replace(unsafe characters, "-")
    return safe
```

Analysis basis: CC v2.1.162 bundle.js:+10889279

---

### Sub-feature: Fork Event Recording — `recordForkEvent` (`OCq`)

`OCq` is the wrapper that calls `$Cq` and, upon successful completion, emits the `tengu_conversation_forked` telemetry event and transitions the UI to the new session.

```
async function recordForkEvent(args, appState):
    // Resolve fork metadata
    forkType  = "fork"                  // literal: +10892445
    timestamp = (new Date()).toISOString()
    sessionId = generateUUID()

    try:
        await copySessionFile(...)
        emitTelemetry("tengu_conversation_forked")
        openBranchedSession(sessionId)
    catch error:
        if error.message exists:
            displayError(error.message)
        else:
            displayError("Unknown error occurred")   // literal: +10892593
```

Analysis basis: CC v2.1.162 bundle.js:+10892709, +10891922, +10891924

---

### Sub-feature: Completion / Autocomplete — `branchAutocompletion` (`fMf`)

`fMf` provides tab-completion candidates for the optional `[name]` argument by enumerating existing session titles and filtering them against the partial input.

```
function branchAutocompletion(partial, sessions):
    seen   = new Set()
    result = []
    for each session in sessions:
        title     = normalise(session.title)
        candidate = title.slice(0, parseInt(partial.length))
        if not seen.has(candidate):
            seen.add(candidate)
            result.push(candidate)
    return result
```

Analysis basis: CC v2.1.162 bundle.js:+10891860, +10891492, +10891498, +10891545

---

### Sub-feature: Conversation History Retrieval — `getConversationHistory` (`Vn`)

`Vn` loads and sorts the conversation messages that will be cloned into the branch. It interfaces with the worktree detection subsystem to resolve the correct session file path.

```
async function getConversationHistory(sessionId, workdir):
    worktrees = await detectWorktrees(workdir)  // uses ibH
    filePath  = resolveSessionPath(sessionId, worktrees)
    messages  = await readAndParseMessages(filePath)  // uses C7K

    // Filter to messages with known types
    valid = messages.filter(m => m.type in ["user","assistant","system","attachment"])
    valid.sort((a, b) => a.timestamp - b.timestamp)
    return valid
```

Analysis basis: CC v2.1.162 bundle.js:+10891297, +13137535, +12116160

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_conversation_forked` (bundle.js:+10891924) |
| New session file created | Written to the CC sessions directory under a new UUID-keyed path |
| Read stream opened | Source session JSONL opened with `createReadStream` (bundle.js:+10889577) |
| Write stream opened | Destination file created with `createWriteStream` (bundle.js:+10889723) |
| Partial file cleanup | If the copy fails, the incomplete destination file is unlinked via `hI8.unlink` (bundle.js:+10889937) |
| appState changes | Active session pointer transitions to the new branched session ID on success |
| UI navigation | The CLI navigates to the new session (equivalent to opening it fresh) |
| Sound | None detected in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.162 | Initial analysis |

---

## Common Mistakes

1. **Running `/branch` with no active conversation** — the command immediately errors with `"No conversation to branch"`. Ensure at least one session is open and has been started before invoking `/branch`.
2. **Running `/branch` before any messages exist** — even with an active session, if the session's JSONL file contains zero messages the command errors with `"No messages to branch"`. Send at least one message first.
3. **Expecting unlimited history in the branch** — the streaming copy caps at **100 messages** (bundle.js:+10889394). Conversations longer than 100 turns will have their tail truncated in the branch.
4. **Providing special characters in the name argument** — `MCq` sanitises the name by replacing unsafe characters, so the resulting title may differ from the literal string typed.
5. **Assuming the original session is modified** — `/branch` is non-destructive: the source session JSONL is read-only during the operation; only a new file is written.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `MMf` | Main async handler for `/branch` (Arbor-resolved entry point) |
| `OCq` | Fork orchestrator — calls `$Cq`, emits telemetry, opens new session |
| `$Cq` | Low-level streaming session-file copy function |
| `MCq` | Branch name sanitisation / slug builder |
| `fMf` | Tab-completion provider for the `[name]` argument |
| `Vn` | Conversation history loader (reads & sorts session messages) |
| `ibH` | Worktree detection helper |
| `C7K` | Session file parser / message enumeration |
| `kxH` | Buffer-level JSONL serialiser used during copy |
| `g$` | Session path resolver |
| `U4` | Hook registration helper |
| `kS` | Session rename side-effect handler (sets custom-title metadata) |
| `r5H` | Agent-name metadata setter for forked sessions |
| `Jd` | Persistent store write helper (reads/writes session JSON) |
| `KO6` | Low-level file read/write wrapper for session metadata |
| `dMH` | Append-file + mkdir sync helper for session log |
| `sN` | Message-role classifier (`user`/`assistant`/`system`/`attachment`) |
| `wM` | Path builder for session working directory |
| `S6` | Session state accessor |
| `X_` | Session directory path resolver |
| `Nv` | Filesystem path normaliser |
| `Rk` | Session registry entry builder |
| `$R` | Session root path helper |
| `R8` | Error-code checker (`ENOENT`, `EISDIR`) |
| `V8` | Typed-error factory |
| `kH` | Log/error-queue writer |
| `t_` | Error constructor helper |
| `tH` | String coercion wrapper |
| `wq` | Telemetry traffic classifier |
| `UyA` | Telemetry string formatter |
| `Gj4` | Circular log-queue manager (shift/push) |
| `hv` | String escape helper for special characters |
| `$9` | Substring extraction utility |
| `V$` | Session visibility / filter predicate |
| `Zx6` | Low-level async error boundary |
| `Z6` | Async wrapper / promise utility |
| `c` | Core async scheduler / microtask runner |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.