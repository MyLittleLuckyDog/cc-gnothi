---
type: feature-spec
feature: "branch"
cc_version: "2.1.142"
updated: "2026-06-01"
tags: ["branch", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.142 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/branch`

> Analysis basis: CC v2.1.142 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.142

---

## Overview

`/branch` (aliased as `/fork`) creates a diverging copy of the current conversation at the point it is invoked, duplicating the session's message history up to that moment and launching a new independent session from it. The command resolves an optional user-supplied branch name, copies the conversation log, and emits a `tengu_conversation_forked` telemetry event on success.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `branch` |
| description | `Create a branch of the current conversation at this point` |
| aliases | `["fork"]` |
| argumentHint | `[name]` |
| module_id | `aR_` |
| load_inline | `true` |
| loc_byte | `11446016` |
| loc_byte_end | `11446210` |
| loc_line | `7071` |
| arbor_handler.name | `P$7` |
| arbor_handler.fqn | `claude-2.1.142::P$7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.142 bundle.js:+11446016

---

## Input Branching

Four distinct branches are identifiable from literals and the call graph: (1) no active conversation to branch, (2) no messages present in the conversation, (3) optional branch name supplied by the user, and (4) no branch name supplied (auto-naming). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/branch [name] invoked"]) --> B{Active conversation\nexists?}
    B -- No --> C["Error: 'No conversation to branch'\n(bundle.js:+10018614)"]
    B -- Yes --> D{Message history\nnon-empty?}
    D -- No --> E["Error: 'No messages to branch'\n(bundle.js:+10019616)"]
    D -- Yes --> F{User supplied\na branch name?}
    F -- Yes --> G["Sanitise & normalise\nuser-supplied name\n(bundle.js:+10018303)"]
    F -- No --> H["Auto-generate name:\n'Branched conversation'\n(bundle.js:+10018173)"]
    G --> I[Generate new UUID\n(bundle.js:+10018412)]
    H --> I
    I --> J[Copy conversation\nhistory to new session\nfile via stream\n(bundle.js:+10018517)]
    J --> K[Write new session\nmetadata / roster entry\n(bundle.js:+10018663)]
    K --> L["Emit tengu_conversation_forked\n(bundle.js:+10020845)"]
    L --> M["Open branched session\n(mode: 'fork')\n(bundle.js:+10021366)"]
    M --> N([Done])
```

---

## Behavioral Spec

### Top-level handler — `branchCommandHandler` (`P$7`)

`P$7` is the primary async handler resolved by Arbor via `module_id → aR_`. The call graph enters `P$7` first, then delegates to `conversationBranchOrchestrator` (`L1q`).

```
async function branchCommandHandler(commandInput, appContext):
    result = await conversationBranchOrchestrator(commandInput, appContext)
    if result.error:
        display error to user
    return result
```

Analysis basis: CC v2.1.142 bundle.js:+10021630

---

### Orchestration — `conversationBranchOrchestrator` (`L1q`)

```
async function conversationBranchOrchestrator(commandInput, appContext):
    # Resolve the session context
    sessionConfig = resolveSessionConfig()          # c3 / qL
    currentSession = lookupCurrentSession()

    # Guard: must have an active conversation
    if not currentSession:
        return { error: "No conversation to branch" }  # +10018614

    # Normalise the optional branch name argument
    rawName = commandInput.argument?.trim()
    if rawName:
        branchName = sanitiseBranchName(rawName)   # q1q → A.replace +10018303
    else:
        branchName = "Branched conversation"        # +10018173

    # Guard: must have at least one message
    messages = currentSession.messages
    if messages is empty:
        return { error: "No messages to branch" }   # +10019616

    # Create the branch
    newSessionId = generateUUID()                   # H1q.randomUUID +10018412
    await copyConversationToNewSession(
        sourceSession = currentSession,
        newId         = newSessionId,
        branchName    = branchName,
        progress      = progressCallback            # "progress" +10019534
    )

    # Open the forked session
    openSession(newSessionId, mode = "fork")        # "fork" +10021366

    # Telemetry
    emit("tengu_conversation_forked")               # +10020845
```

Analysis basis: CC v2.1.142 bundle.js:+10020541

---

### Branch name sanitisation — `sanitiseBranchName` (`q1q`)

```
function sanitiseBranchName(rawInput):
    # Find any matching preset pattern
    match = presetPatterns.find(rawInput)           # _.find +10018225
    # Replace unsafe characters for filesystem/session use
    safeName = rawInput.replace(unsafePattern, "")  # A.replace +10018303
    return safeName.toLowerCase()                   # A.toLowerCase +14487490
```

Analysis basis: CC v2.1.142 bundle.js:+10018225

---

### Conversation copy — `copyConversationToNewSession` (`K1q`)

```
async function copyConversationToNewSession(sourceSession, newId, branchName, progress):
    # Build destination path
    destDir = buildSessionPath(newId)               # $5, FZ +10018449
    await fs.mkdir(destDir, { recursive: true })    # $D8.mkdir +10018468

    # Stream copy: source history → destination file
    # Buffer size hint: 448 bytes (+10018499), encoding: "utf8" (+10018550)
    readStream  = fs.createReadStream(sourcePath)   # MD8.createReadStream +10018517
    writeStream = fs.createWriteStream(destPath)    # MD8.createWriteStream +10018663

    # Await stream completion
    readStream.pipe(writeStream)
    await streamFinished(writeStream)               # A1q.finished +10020026

    # Tag the copy as a branch with content-replacement metadata
    # content-type marker: "content-replacement" (+10019094)
    await writeMetadata(destDir, {
        title:  branchName,
        type:   "text",                             # +10018246
        mode:   "fork"                              # +10021366
    })

    # Register roster entry for the new session
    rosterEntry = buildRosterEntry(newId, branchName)
    saveRosterEntry(rosterEntry)                    # _.rosterEntry +14468413

    # Signal progress to UI (100 steps, +10018340)
    progress.report(100)

    # Clean up on error
    on error:
        if destDir exists:
            await fs.unlink(destDir)               # $D8.unlink +10018877
        throw new Error("No conversation to branch") # +10018614
```

Analysis basis: CC v2.1.142 bundle.js:+10018412

---

### Session name normalisation — `normaliseAgentName` (`xb` / `RKH`)

When a custom branch name is accepted the session title pipeline runs through two helpers:

- `xb` emits `tengu_session_renamed` (+12103375) and persists the title under the key `"custom-title"` (+12103283).
- `RKH` emits `tengu_agent_name_set` (+12106404) using the key `"agent-name"` (+12106306).

```
function persistBranchName(sessionId, name):
    if name is user-supplied:
        writeSessionMeta(sessionId, "custom-title", name)
        emit("tengu_session_renamed")
    writeSessionMeta(sessionId, "agent-name", name)
    emit("tengu_agent_name_set")
```

Analysis basis: CC v2.1.142 bundle.js:+12103262, +12106285

---

### Session open — `openForkedSession` (`j$7`)

```
function openForkedSession(newSessionId):
    # Escape any special regex chars in session id
    safeId = escapeRegex(newSessionId)             # Nx → H.replace +10020319
    # Mark session as visited
    visitedSessions.add(newSessionId)              # K.add +10020413
    # Parse integer session index if applicable
    parseInt(...)                                  # +10020419
    if sessionAlreadyOpen(newSessionId):           # K.has +10020466
        focus existing
    else:
        launch session in "fork" mode
```

Analysis basis: CC v2.1.142 bundle.js:+10020218

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_conversation_forked` (bundle.js:+10020845) |
| Telemetry — session rename | `tengu_session_renamed` (bundle.js:+12103375) |
| Telemetry — agent name | `tengu_agent_name_set` (bundle.js:+12106404) |
| Telemetry — daemon / bg | `tengu_bg_dispatch_sigkill_escalate`, `tengu_daemon_control`, `tengu_daemon_yield`, `tengu_bg_spare_*`, `tengu_bg_sendclaim_failed`, `tengu_bg_attach*` (background session management, reached transitively) |
| Telemetry — feature flags | `tengu_feature_ok`, `tengu_feature_bad` (bundle.js:+954550, +954608) |
| File system writes | New session directory created under the CC projects path; history streamed via `createReadStream` / `createWriteStream`; metadata written via `fs.writeFile` |
| Roster update | New entry written to the session roster (`.rosterEntry`) |
| Session title | Persisted under `"custom-title"` key when a name argument is supplied |
| appState changes | Active session list updated; new session opened in `"fork"` mode |
| Error cleanup | Destination directory unlinked on failure (`$D8.unlink`, +10018877) |
| Hook registration | None specific to `/branch`; general `WorktreeCreate` hook type is present in the broader hook system (+12234107) |
| Sound | None observed |

---

## Version History

| Version | Change |
|---|---|
| v2.1.142 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/branch` with no prior messages** — The command will exit early with `"No messages to branch"` (+10019616). At least one exchange must exist in the current conversation before branching.
2. **Invoking `/branch` outside an active session** — If no conversation is loaded the guard fires `"No conversation to branch"` (+10018614) and no files are written.
3. **Expecting the original session to be modified** — `/branch` is non-destructive: the source session is opened read-only via `createReadStream`. The original conversation is left intact.
4. **Using `/fork` and expecting different behaviour** — `/fork` is a registered alias and is functionally identical to `/branch`.
5. **Special characters in the branch name** — The sanitiser (`q1q → A.replace`) strips unsafe characters. Names with symbols or path separators will be silently normalised.
6. **Branching mid-stream** — Invoking the command while Claude is actively generating a response may capture a partial message history depending on the flush state of the write stream.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `P$7` | Primary async handler for `/branch` (Arbor-resolved, `AsyncFunction`) |
| `L1q` | Conversation branch orchestrator; main coordination function |
| `K1q` | Low-level copy-conversation-to-new-session implementation |
| `q1q` | Branch name sanitiser; applies regex replacements |
| `j$7` | Open-forked-session helper; deduplicates and launches the new session |
| `xb` | Session title persistence; emits `tengu_session_renamed` |
| `RKH` | Agent name persistence; emits `tengu_agent_name_set` |
| `c3` | Session config resolver |
| `qL` | Session config lookup helper |
| `C9` | Config change subscriber |
| `BQ` | Session completion / worktree detection helper |
| `hNH` | Worktree detection implementation |
| `$kq` | File-system completion / autocomplete walker |
| `iNH` | Buffer allocation helper for completion |
| `iM` | Completion cache helper |
| `Nx` | Regex-escape utility (used when opening forked session) |
| `u1` | String slice / index helper |
| `L1q` | (see above — orchestrator) |
| `V6` | Config/state value accessor |
| `JV` | Base config object |
| `__` | Config merge/override helper |
| `FZ` | Session path builder |
| `$5` | Path segment joiner |
| `NU` | Config node utility |
| `NH` | Logger / error reporter |
| `k_` | Error constructor wrapper |
| `bH` | String coercion helper |
| `$q` | Telemetry-mode resolver |
| `NMA` | Telemetry mode normaliser |
| `JvK` | Log ring-buffer (shift/push) |
| `O8` | Async operation wrapper |
| `GH` | String formatting helper |
| `RH` | JSON stringify wrapper |
| `Fr_` | Background session / worker manager |
| `K` | Session status formatter (padEnd, map) |
| `IK` | Session path join helper |
| `o1` | Session file stat / cache manager |
| `dw` | Active-session watcher |
| `gf` | Session config file helper |
| `ZoH` | Async timing / debounce wrapper |
| `OLH` | Session path builder (join + stat) |
| `uk` | Session path helper with split |
| `pp` | Session path helper with callback |
| `i26` | Session roster write helper |
| `D` | Background session disposer / spawner |
| `br_` | Background spare session spawner |
| `w` | Background session dispatch / retry loop |
| `xr_` | Claim-and-attach helper |
| `dQ_` | Session metadata writer |
| `Q95` | Send-claim timeout handler |
| `g95` | Build-claim-frame helper |
| `Cp` | Binary protocol frame builder (Buffer ops) |
| `j` | Session kill / cleanup trigger |
| `y` | Supervisor write helper |
| `z` | Daemon IPC write helper |
| `uH` | Daemon `d`-helper (signal) |
| `SH` | Daemon `d`-helper (signal) |
| `LG6` | macOS memory check helper |
| `G6` | Memory/worktree gate |
| `S` | Session retire-if-settled |
| `b6` | JSON.parse wrapper |
| `J` | All-sessions kill iterator |
| `h` | Session kill with backoff |
| `N` | Away-summary generator |
| `Ff8` | App-state getter |
| `Ns7` | Away-summary system prompt builder |
| `wcq` | Rate-limit check |
| `V` | Session focus tracker |
| `A18` | API request helper |
| `q9q` | UUID generator wrapper |
| `g` | Message history accessor (at / slice) |
| `tm` | Timer / telemetry marker |
| `Y` | Session close / config-reload handler |
| `$JH` | Session store writer |
| `u7` | Async-storage getter |
| `IF_` | Session format helper |
| `FVq` | Session key formatter |
| `T` | Remote-control stop handler |
| `p` | PTY/keyboard event |
| `l2` | Config change handler |
| `p_` | Settings loader |
| `Z` | Config update/start/stop object |
| `J8K` | Heartbeat helper |
| `js` | Heartbeat implementation |
| `W` | Skill/session update batch |
| `J3H` | Skill config change processor |
| `z4` | Config-change event builder |
| `Ly` | Config value helper |
| `xX` | Model/effort resolver |
| `sE` | Effort value helper |
| `h6` | Config diff helper |
| `O2` | Main agent-loop / hook dispatcher |
| `ym` | Terminal view helper |
| `aLH` | Config key helper |
| `jQ_` | Hook runner (PreToolUse, PostToolUse, etc.) |
| `JQ_` | Third-party hook filter |
| `Pyq` | Hook result processor |
| `Xyq` | Hook extra-data processor |
| `gPH` | Signal helper |
| `yZ` | Abort controller wrapper |
| `B6H` | Hook callback result handler |
| `VS` | Hook result validator |
| `Z28` | Hook result merger |
| `wQ_` | MCP hook executor |
| `v28` | Hook output text parser |
| `DQ_` | HTTP hook executor |
| `jyq` | HTTP hook response parser |
| `CLH` | Hook cleanup helper |
| `N28` | Spawn-hook executor |
| `TBH` | Session-has-active-hooks check |
| `mz8` | Skill metadata object |
| `nHH` | Skill state helpers bundle |
| `DqH` | Skill state constant |
| `Oz8` | Skill state constant |
| `_t1` | Skill state constant |
| `zrH` | Cache clear helper |
| `P` | Background IPC protocol handler |
| `vf` | IPC response writer |
| `s95` | Background session attacher / PTY bridge |
| `t95` | PTY frame type constant |
| `M` | MCP server manager |
| `IvH` | MCP connection initialiser |
| `Peq` | MCP update applier |
| `n_5` | MCP retry / reconnect manager |
| `xw` | Background service context helper |
| `QMH` | Background service G6 wrapper |
| `pr_` | PTY protocol reader |
| `n6K` | PTY lease tracker |
| `a8` | Async timeout/retry helper |
| `gG` | Working-directory resolver |
| `kV` | Projects-path joiner |
| `DO` | Path sanitiser |
| `R3` | Realpath normaliser |
| `r7H` | File reader (readline interface) |
| `o95` | Terminal size helper |
| `$6H` | PTY mode helper |
| `a95` | Session phase / kill helper |
| `qH` | Voice/recording state ref |
| `G` | Ref accessor with fallback |
| `Q` | Session timer wrapper |
| `r` | Ref pair (w, l) |
| `x` | PTY write with timeout |
| `F` | Key-event filter |
| `d6` | Key-event dispatcher |
| `tH` | Orphaned-permission tracker |
| `l` | PTY stream writer |
| `Cd_` | PTY stream implementation |
| `c` | Terminal input filter |
| `a` | Voice session manager |
| `UE6` | IPC write helper |
| `oLH` | Log-append helper |
| `x6` | Config path resolver |
| `pB` | Roster persistence helper |
| `Rq6` | Roster read/write implementation |