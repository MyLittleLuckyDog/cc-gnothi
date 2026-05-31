---
type: feature-spec
feature: "branch"
cc_version: "2.1.139"
updated: "2026-05-31"
tags: ["branch", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.139 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/branch`

> Analysis basis: CC v2.1.139 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.139

---

## Overview

The `/branch` command (also aliased as `/fork`) creates an independent copy of the current conversation up to the point it is invoked, opening a new session that diverges from the original history. Under the hood it serialises the current message history into a new conversation file, seeds that file's messages into a freshly-created session, and emits a `tengu_conversation_forked` telemetry event to signal the split. An optional `[name]` argument lets the user label the branch.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `branch` |
| description | `Create a branch of the current conversation at this point` |
| argumentHint | `[name]` |
| aliases | `fork` |
| module_id | `qh_` |
| load_inline | `true` |
| loc_byte | `11296660` |
| loc_byte_end | `11296854` |
| loc_line | `6999` |
| arbor_handler.name | `VK7` |
| arbor_handler.fqn | `claude-2.1.139::VK7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.139 bundle.js:+11296660

---

## Input Branching

Four distinct paths exist depending on conversation state and the presence/content of the optional name argument:

```mermaid
flowchart TD
    A["/branch [name] invoked"] --> B{Active conversation\nexists?}
    B -- No --> C["Error: 'No conversation to branch'\n(bundle.js:+9896281)"]
    B -- Yes --> D{Message list\nnon-empty?}
    D -- No --> E["Error: 'No messages to branch'\n(bundle.js:+9897283)"]
    D -- Yes --> F{name argument\nprovided?}
    F -- No --> G["Use default title\n'Branched conversation'\n(bundle.js:+9895840)"]
    F -- Yes --> H["Sanitise & apply\ncustom name"]
    G --> I[Serialise messages up to\nbranch point]
    H --> I
    I --> J[Copy history file via\nreadStream → writeStream\n(bundle.js:+9896184 / +9896330)]
    J --> K[Create new session\nwith forked history]
    K --> L["Emit tengu_conversation_forked\n(bundle.js:+9898512)"]
    L --> M[Display new branched\nconversation to user]
```

---

## Behavioral Spec

### 1. Guard checks

Before any file I/O the handler verifies two preconditions.

```
async function branchCommandHandler(args, context):
    conversation = context.currentConversation
    if conversation is null or undefined:
        raise UserError("No conversation to branch")   // bundle.js:+9896281

    messages = conversation.messages
    if messages is empty:
        raise UserError("No messages to branch")       // bundle.js:+9897283
```

Analysis basis: CC v2.1.139 bundle.js:+9896281, +9897283

---

### 2. Branch name resolution

The optional `[name]` argument is cleaned via `nameSlug` (identifier `sHq`) which:
1. Searches a pattern table with `_.find` to locate a matching sanitiser rule (bundle.js:+9895892).
2. Applies `A.replace` to strip or normalise disallowed characters (bundle.js:+9895970).

If no argument is supplied, the title defaults to the string literal `"Branched conversation"` (bundle.js:+9895840).

```
function resolvebranchName(rawArg):
    if rawArg is blank:
        return "Branched conversation"
    rule = patternTable.find(matching rule for rawArg)   // bundle.js:+9895892
    return rawArg.replace(rule.pattern, rule.replacement) // bundle.js:+9895970
```

Analysis basis: CC v2.1.139 bundle.js:+9895840, +9895892, +9895970

---

### 3. History serialisation

The main fork worker (identifier `tHq`) serialises the conversation history.

Key constants observed:
- Read-stream high-water mark: **100** bytes (bundle.js:+9896007)
- Internal buffer chunk size: **448** bytes (bundle.js:+9896166)
- Write-stream high-water mark: **384** bytes (bundle.js:+9896376)
- File encoding: `"utf8"` (bundle.js:+9896217)
- Stream open flag: `"open"` (bundle.js:+9896243)

```
async function forkHistoryFile(sourceConversation, destPath):
    newId = crypto.randomUUID()                    // bundle.js:+9896079
    destDir = buildDestinationPath(newId, ...)     // via V6, r3, A_, tN, Tf
    await fs.mkdir(destDir, { recursive: true })   // bundle.js:+9896135

    readStream  = fs.createReadStream(sourcePath,  // bundle.js:+9896184
                      { encoding:"utf8",
                        highWaterMark: 100 })
    writeStream = fs.createWriteStream(destPath,   // bundle.js:+9896330
                      { highWaterMark: 384 })

    readStream.once("open", handler)               // bundle.js:+9896232 / +9896243
    lineInterface = readline.createInterface(readStream) // bundle.js:+9896424

    // pipe lines, applying content-replacement tags  // bundle.js:+9896761
    for each line in lineInterface:
        processedLine = applyContentReplacement(line)
        writeStream.write(processedLine)            // bundle.js:+9896613

    writeStream.on("drain", ...)                   // bundle.js:+9896641
    await streamFinished(writeStream)              // bundle.js:+9897693

    if errorDuringCopy:
        await fs.unlink(destPath)                  // bundle.js:+9896544
        raise error

    return { newId, destPath }
```

Analysis basis: CC v2.1.139 bundle.js:+9896079, +9896135, +9896184, +9896330, +9896613

---

### 4. Message-array construction

After file copy, the handler (still within `tHq`) builds the forked message array:

```
function buildForkedMessages(originalMessages, branchName):
    forked = []
    for each message in originalMessages:
        entry = { ...message }
        if message.role is "text":                 // bundle.js:+9895913
            // keep as-is
        forked.push(entry)                         // bundle.js:+9896801
    forked.push(progressMarker("progress"))        // bundle.js:+9897201 literal "progress"
    return forked
```

Message roles observed: `"user"`, `"assistant"`, `"attachment"` (bundle.js:+11922853, +11922870, +11922892).

Analysis basis: CC v2.1.139 bundle.js:+9895913, +9896801, +9897179, +9897201

---

### 5. New session creation

The outer handler `eHq` (called by `VK7`) orchestrates session setup after the file is prepared.

```
async function orchestrateFork(args, context):
    branchName = resolvebranchName(args.name)
    { newId, destPath } = await forkHistoryFile(context.conversation, ...)

    // Determine auto-naming mode
    autoMode = "auto"                              // bundle.js:+9898466

    // Register forked title as custom-title
    sessionStore.set("custom-title", branchName)  // literal bundle.js:+11951154

    // Emit fork telemetry
    telemetry.emit("tengu_conversation_forked")   // bundle.js:+9898512

    // Signal to the shell that fork is complete
    // (type "fork" used internally)               // bundle.js:+9898988

    openNewSession(newId, destPath, branchName)

    if error is "Unknown error occurred":          // bundle.js:+9899136
        logError(error)
```

Analysis basis: CC v2.1.139 bundle.js:+9898316, +9898375, +9898448, +9898466, +9898510, +9898512, +9898988

---

### 6. Error-path cleanup

If `ENOENT` is encountered during the copy phase (bundle.js:+168330), the error code is classified (identifier `q_`) and a structured error with code `"code"` (bundle.js:+168242) is surfaced to the user. The temp write file is unlinked before the error propagates (bundle.js:+9896544).

```
function handleCopyError(err, destPath):
    if err.code is "ENOENT":                       // bundle.js:+168330
        raise StructuredError("No conversation to branch", code="code")
    await fs.unlink(destPath)                      // bundle.js:+9896544
    raise err
```

Analysis basis: CC v2.1.139 bundle.js:+168242, +168330, +9896544

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_conversation_forked` (bundle.js:+9898512) — fired once per successful branch |
| Telemetry (indirect, traversal depth ≤2) | `tengu_session_renamed` (bundle.js:+11951246); `tengu_agent_name_set` (bundle.js:+11953483); `tengu_worktree_detection` (bundle.js:+11032093) |
| File I/O | Creates a new conversation history file under a UUID-named directory via `fs.mkdir` + stream copy |
| File I/O cleanup | Calls `fs.unlink` on the destination if the copy fails (bundle.js:+9896544) |
| Session store | Sets `custom-title` key to the branch name (bundle.js:+11951154) |
| Session store | Sets `agent-name` when applicable (bundle.js:+11953385) |
| New session | Opens a fresh interactive session pointed at the forked file; old session remains open |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | No branch-specific hook registration found in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.139 | Initial analysis |

---

## Common Mistakes

1. **Running `/branch` with no active conversation** — The command requires an existing conversation with at least one message. Invoking it at a fresh prompt produces the error `"No conversation to branch"`.
2. **Running `/branch` when the message list is empty** — Even if a conversation context exists, an empty message array triggers `"No messages to branch"`.
3. **Expecting the original session to close** — `/branch` opens a new session alongside the existing one; both remain live simultaneously.
4. **Providing a branch name with special characters** — The name sanitiser (`sHq`) strips or replaces characters that do not conform to the internal slug rules; the resulting name may differ from what was typed.
5. **Confusing `/fork` and `/branch`** — They are identical aliases; there is no behavioral difference between them.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `VK7` | Main async handler for `/branch` (arbor_handler; resolved via module_id `qh_`) |
| `eHq` | Fork orchestrator; called by `VK7`; coordinates file copy, session creation, and telemetry |
| `tHq` | History serialisation worker; streams source conversation file to forked destination |
| `sHq` | Branch name sanitiser; uses pattern-find + replace to produce a safe slug |
| `ZK7` | Worktree-related helper called during fork setup; tracks seen IDs |
| `ig` | Conversation/worktree listing helper; sorts and slices results |
| `vvH` | Worktree detection utility; parses `git worktree --porcelain` output |
| `OEq` | File-system completions / directory listing helper reached via `ig` |
| `cvH` | Buffer-building utility used during history serialisation |
| `fb` | Session rename helper; emits `tengu_session_renamed` |
| `dvH` | Conversation log append helper; writes to history file |
| `RqH` | Agent-name setter helper; emits `tengu_agent_name_set` |
| `HB` | Settings read/write helper used during fork metadata persistence |
| `w16` | File read/write utility used by `HB` |
| `i1` | String slice utility (indexOf + slice) |
| `Hx` | String replace utility (escapes regex metacharacters) |
| `Q$` | State-store accessor used during session setup |
| `uL` | Low-level state container helper |
| `C9` | Reactive state-cell implementation (add/delete/assign) |
| `LH` | Logging/error-queue helper; routes errors to error list |
| `q_` | Error classifier; extracts `code` field from error objects |
| `SH` | String coercion utility |
| `D8` | General-purpose async guard / deferred resolver |
| `w8` | Low-level write helper used across I/O paths |
| `IH` | String conversion wrapper |
| `N` | Platform/OS detection helper |
| `yH` | JSON serialisation wrapper (`JSON.stringify`) |
| `U6` | JSON parse wrapper (`JSON.parse`) |
| `tN` | Path construction helper for conversation directories |
| `Tf` | Full path builder combining root, project, and filename segments |
| `V6` | Base directory resolver for conversation storage |
| `A_` | Filename/extension helper |
| `r3` | Project identifier resolver |
| `xH` | Feature-flag telemetry emitter (`tengu_feature_ok`) |
| `kH` | Feature-flag telemetry emitter (`tengu_feature_bad`) |
| `Q` | Promise/deferred utility |
| `O` | Stream wrapper with `on`/`write`/`destroy`/`end` |
| `x8` | Internal stream event handler |
| `P` | Protocol-layer message handler (reply/kill/resize/tail) |
| `W` | Skill/plugin runner with debounce and clear |
| `z` | Background session manager (add/clear) |
| `A3H` | Agent runner coordinator |
| `uX` | Agent execution engine; dispatches hooks, tools, and model calls |
| `NP8` | Hook executor for command/prompt/agent type hooks |
| `ml_` | Background session lifecycle manager |
| `hl_` | Spare background session spawner |
| `Sl_` | Daemon socket claim sender |
| `Tt7` | Daemon claim timeout handler |
| `Gt7` | Daemon claim frame builder |
| `ht7` | Daemon session message protocol handler |
| `D` | Daemon supervisor session controller |
| `fwH` | Daemon IPC frame reader |
| `rWq` | Daemon IPC frame formatter |
| `M` | MCP server state manager |
| `WIH` | MCP server connection initialiser |
| `Niq` | MCP server update applier |
| `Wa7` | MCP retry/recovery orchestrator |
| `g` | Permission classifier (allow/deny/classify/ask) |
| `I78` | Iron-gate permission guard |
| `Be` | Permission UI renderer |
| `F` | Permission filter (strips `mcp__` prefix tools, orphaned permissions) |
| `DH` | Orphaned-permission tracker |
| `bH` | Plugin-list filter |
| `_H` | Voice recording state machine |
| `a` | Voice transcription session handler |
| `m` | Transient output writer with debounce |
| `le` | Skill/hook event broadcaster |
| `spH` | Agent hook presence checker |
| `UnH` | Hook state clearer |

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.