---
type: feature-spec
feature: "branch"
cc_version: "2.1.144"
updated: "2026-06-01"
tags: ["branch", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.144 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/branch`

> Analysis basis: CC v2.1.144 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.144

---

## Overview

`/branch` (aliased as `/fork`) creates a divergent copy of the current conversation at the point it is invoked, forking the message history into a new independent session. It copies the conversation transcript up to the current message cursor into a fresh session with a new UUID, persisting the forked state to disk via the background daemon infrastructure before emitting a `tengu_conversation_forked` telemetry event.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `branch` |
| description | `Create a branch of the current conversation at this point` |
| argumentHint | `[name]` |
| aliases | `["fork"]` |
| module_id | `vb_` |
| load_inline | `true` |
| loc_byte | `11504934` |
| loc_byte_end | `11505128` |
| loc_line | `7089` |
| arbor_handler.name | `uz7` |
| arbor_handler.fqn | `claude-2.1.144::uz7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.144 bundle.js:+11504934

---

## Input Branching

The command has 4+ distinct code paths depending on conversation state and argument presence, warranting a Mermaid flowchart.

```mermaid
flowchart TD
    A(["/branch [name] invoked"]) --> B{Active conversation\nexists?}
    B -- No --> C["Return error:\n'No conversation to branch'\n(bundle.js:+10075403)"]
    B -- Yes --> D{Message list\nnon-empty?}
    D -- No --> E["Return error:\n'No messages to branch'\n(bundle.js:+10076424)"]
    D -- Yes --> F["Generate new UUID\n(randomUUID)\n(bundle.js:+10075195)"]
    F --> G{Optional [name]\nargument provided?}
    G -- Yes --> H["Use supplied name as\nbranch conversation title"]
    G -- No --> I["Default title:\n'Branched conversation'\n(bundle.js:+10074956)"]
    H --> J["Copy message history\nup to current cursor\n(slice/find, bundle.js:+10075008)"]
    I --> J
    J --> K["Build forked session object\n(worktree-aware path resolution,\nbundle.js:+10075257)"]
    K --> L["Write forked session to disk\n(mkdir + createWriteStream,\nbundle.js:+10075257/+10075452)"]
    L --> M["Stream copy of source\ncontent via createReadStream\n(bundle.js:+10075306)"]
    M --> N["Await stream 'open' event\n(bundle.js:+10075365)"]
    N --> O["Emit progress updates\n(bundle.js:+10076342)"]
    O --> P["Register forked session\nwith session roster\n(bundle.js:+14548058)"]
    P --> Q["Emit tengu_conversation_forked\n(bundle.js:+10077653)"]
    Q --> R([Branch complete —\nnew session available])
    L -- Error --> S["Log error via errorLogger\n(bundle.js:+10075397)"]
    S --> T([Return error to user])
```

---

## Behavioral Spec

### Top-Level Handler: `uz7` (AsyncFunction)

The Arbor-resolved handler `uz7` is the async entry point for the `/branch` command.

```
async function branchCommandHandler(args, context):
    // Delegate to inner orchestrator
    result = await branchOrchestrator(args, context)
    return result
```

Analysis basis: CC v2.1.144 bundle.js:+10078438

---

### Orchestrator: `JKq`

`JKq` is the primary orchestrator called by `uz7`. It coordinates prerequisite checks, session setup, and stream copy.

```
async function branchOrchestrator(args, context):
    // 1. Resolve current session configuration
    sessionConfig = await resolveSessionConfig(context)      // I6

    // 2. Normalize branch name from args
    branchName = normalizeBranchName(args)                   // n3

    // 3. Prepare worktree state
    worktreeState = await prepareWorktreeState(context)      // wKq (via tQ)

    // 4. Resolve existing messages from session
    messageList = findMessages(context)                      // DKq + _.find

    if messageList is empty or null:
        return errorResult("No messages to branch")          // +10076424

    // 5. Build forked session name/title
    if branchName supplied:
        title = sanitize(branchName)                         // A.replace (+10075086)
    else:
        title = "Branched conversation"                      // +10074956

    // 6. Execute the fork via copySession
    forkedSession = await copySession(messageList, title, context)  // wKq

    // 7. Register with session registry
    registerFork(forkedSession)                              // _.rosterEntry (+14548058)

    // 8. Emit fork telemetry
    emit("tengu_conversation_forked")                        // +10077653

    // 9. Tag as "fork" type
    setForkTag(forkedSession, "fork")                        // +10078174

    return forkedSession
```

Analysis basis: CC v2.1.144 bundle.js:+10077349

---

### Session Copy Engine: `wKq`

`wKq` performs the actual file-system copy operation that persists the forked conversation.

```
async function copySession(messageList, title, context):
    // 1. Allocate new session UUID
    newId = crypto.randomUUID()                              // OKq.randomUUID (+10075195)

    // 2. Resolve source and destination paths
    sourcePath = resolveSessionPath(context)                 // I6, i$, q_ (+10075214-+10075224)
    destDir    = resolveDestPath(newId, context)             // FZ, o5 (+10075232-+10075246)

    // 3. Create destination directory
    await fs.mkdir(destDir, { recursive: true })             // Dw8.mkdir (+10075257)

    // 4. Open source for reading (utf8)
    readStream = fs.createReadStream(sourcePath, "utf8")     // Yw8.createReadStream (+10075306)

    // 5. Await 'open' event before proceeding
    await once(readStream, "open")                           // Ib_.once (+10075354/+10075365)

    // 6. Guard: verify source has content
    if sourceIsEmpty:
        throw new Error("No conversation to branch")         // +10075403

    // 7. Open write stream for destination (buffer size 384 bytes)
    writeStream = fs.createWriteStream(destPath, {
        flags: "w",
        highWaterMark: 384                                   // +10075498
    })                                                       // Yw8.createWriteStream (+10075452)

    // 8. Attach line-by-line interface
    lineInterface = readline.createInterface(readStream)     // zKq.createInterface (+10075546)

    // 9. Copy lines with optional content-replacement pass
    for each line in lineInterface:
        processed = applyContentReplacement(line)            // "content-replacement" +10075883
        writeToStream(writeStream, processed)

    // 10. Attach drain listener for backpressure
    writeStream.on("drain", ...)                             // "drain" +10075763

    // 11. Signal progress
    emitProgress()                                           // "progress" +10076342

    // 12. Finalise: close streams and clean up temp file if needed
    await finishStream(writeStream)                          // O.end (+10076820)
    await streamFinished(writeStream)                        // YKq.finished (+10076834)

    // 13. Apply jitter delay before returning
    await applyJitter(messageList)                           // H.map + Math.random + setTimeout (+10075601)

    return { id: newId, title: title, path: destDir }
```

Analysis basis: CC v2.1.144 bundle.js:+10075195

---

### Message Lookup: `DKq`

`DKq` resolves which messages from the current conversation will be included in the branch.

```
function findMessagesForBranch(context):
    // Find the target message boundary
    target = Array.find(context.messages, matchFn)          // _.find (+10075008)

    // Sanitise any special characters in message content
    cleaned = target.replace(pattern, replacement)          // A.replace (+10075086)

    return cleaned
```

Analysis basis: CC v2.1.144 bundle.js:+10075008

---

### Worktree Detection: `tQ` → `LkH`

When the repository is git-worktree-aware, the branch operation uses worktree paths rather than standard project paths.

```
async function resolveWorktreeAwarePath(context):
    // Read git worktree list (--porcelain format)
    rawList = exec("git worktree list --porcelain")         // "worktree", "--porcelain" +11238848
    parsed  = parseWorktreeOutput(rawList)                  // LkH

    // Record detection in telemetry
    emit("tengu_worktree_detection")                        // +11238930

    // Sort by date, then filter by prefix "worktree "
    entries = parsed
        .filter(e => e.startsWith("worktree "))             // +11239049
        .sort(localeCompare)                                 // $.localeCompare +11239267

    return entries
```

Analysis basis: CC v2.1.144 bundle.js:+11238786

---

### Session Naming: `sb` / `ZLH`

After the copy completes, the forked session is assigned a title.

```
function applySessionTitle(session, title):
    if title is custom (user-supplied):
        setCustomTitle(session, title)                      // "custom-title" +12167365
        emit("tengu_session_renamed")                       // +12167457
    else:
        setAgentName(session, title)                        // "agent-name" +12170388
        emit("tengu_agent_name_set")                        // +12170486

    persistTitle(session)                                   // G4H, DL, I6
```

Analysis basis: CC v2.1.144 bundle.js:+12167344

---

### Error Handling

Two specific error strings are embedded in the copy engine:

- **"No conversation to branch"** — emitted when the source session reference cannot be resolved (bundle.js:+10075403).
- **"No messages to branch"** — emitted when `messageList` is empty after resolution (bundle.js:+10076424).
- **"Unknown error occurred"** — generic catch-all surfaced to the user (bundle.js:+10078322).

The error logger (`kH`) writes an `"error"` severity entry (bundle.js:+10075438) and optionally records to the session log via `Sc.logError`.

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_conversation_forked` (+10077653), `tengu_worktree_detection` (+11238930), `tengu_session_renamed` (+12167457), `tengu_agent_name_set` (+12170486) |
| Telemetry (infra, indirect) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_daemon_control`, `tengu_feature_bad`, `tengu_feature_ok`, `tengu_bg_low_mem_mb`, `tengu_bg_dispatch_low_mem`, `tengu_daemon_idle_exit`, `tengu_bg_spare_enable`, `tengu_bg_sendclaim_failed`, `tengu_daemon_config_reload`, `tengu_bg_spare_claim`, `tengu_bg_spare_spawn`, `tengu_bg_spare_claim_fail`, `tengu_daemon_yield`, `tengu_run_hook`, `tengu_hook_plugin_metrics`, `tengu_amber_anchor`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop`, `tengu_bg_attach`, `tengu_bg_attach_stall_ms`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_stall_respawn`, `tengu_bg_attach_kick`, `tengu_bg_attach_legacy_autorespawn` |
| Filesystem | Creates destination directory via `fs.mkdir` (+10075257); writes forked conversation file via `fs.createWriteStream` (+10075452); unlinkSync on temp file on error (+14520889) |
| Session registry | Forked session is added to the session roster (`_.rosterEntry`, +14548058) |
| Hook registration | None directly from `/branch` handler; background session infrastructure registers hooks via `ka_` |
| appState changes | New session entry added; source session state unchanged |
| Sound | None directly observed |
| Default title | `"Branched conversation"` (+10074956) |
| Content type | `"text"` (+10075029) |
| Read buffer | 100 bytes initially (+10075123); write stream highWaterMark 384 bytes (+10075498) |
| PTY socket message size | 448 bytes (+10075288) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.144 | Initial analysis |

---

## Common Mistakes

1. **Using `/branch` with no active conversation** — The command requires an existing session with at least one message. If invoked before any conversation turn, it will return `"No conversation to branch"` or `"No messages to branch"`.
2. **Expecting the branch to inherit live tool state** — The branch copies the persisted message transcript, not in-memory tool state or pending operations. Any inflight tool calls are not cloned.
3. **Assuming `/fork` behaves differently** — `/fork` is a registered alias for `/branch` and is entirely identical in behavior (bundle.js:+10078174 confirms the `"fork"` tag is set on the same code path).
4. **Supplying a name with special characters** — The branch name passes through a `.replace()` sanitization step (+10075086); names with special shell or filesystem characters may be normalized silently.
5. **Expecting immediate availability in a multi-window setup** — The forked session is written to disk and registered with the session roster; in multi-window scenarios there may be a short propagation delay before the branch appears in all windows.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `uz7` | Top-level async handler for `/branch` command (Arbor-resolved entry point) |
| `JKq` | Branch orchestrator — coordinates prereq checks, path resolution, copy, registry |
| `wKq` | Session copy engine — filesystem read/write streams, UUID allocation |
| `DKq` | Message lookup — finds and sanitizes messages to include in branch |
| `tQ` | Worktree-aware path resolver — dispatches to `LkH` and `NSq` |
| `LkH` | Git worktree list parser — reads `--porcelain` output, filters entries |
| `NSq` | File-system directory scanner used during worktree resolution |
| `VkH` | Buffer utility used during content copy |
| `xz7` | Argument parser for branch name / metadata extraction |
| `Qx` | String replacement helper (sanitizes branch name characters) |
| `V9` | Substring slicer used when parsing worktree paths |
| `sb` | Custom session title setter — writes `"custom-title"` metadata |
| `ZLH` | Agent-name setter — writes `"agent-name"` metadata |
| `G4H` | Low-level title persistence — appends to session file, creates dir |
| `n3` | Branch name normalizer |
| `DL` | Session directory locator |
| `h1` | OHA registration helper |
| `I6` | Session config accessor |
| `q_` | Project root resolver |
| `FZ` | Forked path builder |
| `o5` | Path segment joiner for forked session |
| `FU` | Base path utility |
| `kH` | Error logger / structured error writer |
| `b_` | Low-level error constructor |
| `xH` | String coercion utility |
| `Aq` | Error aggregator |
| `D3A` | Error formatter |
| `bkK` | Error queue manager (shift/push) |
| `O8` | Generic async operation wrapper |
| `A8` | Async result unwrapper |
| `ka_` | Background session lifecycle manager |
| `wJ` | Session state machine (`"active"` state handler) |
| `B9` | Session roster file reader/writer |
| `v5` | Session path utility |
| `roH` | Background session watcher / poller |
| `RLH` | Session log path resolver |
| `dk` | Session log reader (split-based) |
| `rp` | Session log writer |
| `cW6` | Session metadata writer |
| `PK` | Session path joiner |
| `K` | Session label formatter (padEnd) |
| `Y` | Session state transition manager |
| `D` | Session cleanup / disposal orchestrator |
| `Ta_` | Spare PTY spawner |
| `Ea_` | Claim-send infrastructure (daemon socket) |
| `yc_` | Session persistence writer (writeFile) |
| `EL5` | Claim timeout handler |
| `TL5` | Claim frame builder |
| `GH` | String coercion helper |
| `v` | Telemetry value formatter / model-string classifier |
| `dp` | Binary protocol framer (Buffer write) |
| `w` | Background worker dispatch loop |
| `C` | Worker process supervisor |
| `yAK` | Worker identity verifier (realpath/stat) |
| `iL5` | Worker state probe |
| `z` | Worker write multiplexer |
| `bH` | Daemon result handler |
| `RH` | Daemon result handler (alternative path) |
| `fT6` | Memory pressure checker |
| `P6` | Low-memory action dispatcher |
| `x` | Worker heartbeat / retire-if-settled |
| `j` | Worker kill orchestrator |
| `J` | Worker set iterator / kill-all |
| `y` | Individual worker terminator |
| `W` | Session update queue / flush |
| `AOH` | Session update applier |
| `Y4` | Config-change applier |
| `Ey` | Config value setter |
| `_2` | Model capability checker |
| `dE` | Effort-level validator |
| `C6` | Context window resolver |
| `R2` | Main agent-run loop |
| `iu` | Policy settings loader |
| `T4H` | Session Z-order manager |
| `td_` | Hook dispatcher (PreToolUse/PostToolUse etc.) |
| `sd_` | Third-party hook filter |
| `CH` | JSON stringify wrapper |
| `YPH` | Feature-flag ok reporter |
| `PZ` | Abort-controller timeout wrapper |
| `TW8` | Hook response parser |
| `rd_` | MCP tool hook executor |
| `IW8` | Hook output text parser |
| `O6H` | Hook environment builder |
| `id_` | HTTP hook executor |
| `bhq` | Hook prefix parser |
| `eLH` | Hook error label mapper |
| `vW8` | Shell-hook executor (spawn) |
| `AFH` | Hook-some checker |
| `D6H` | Skill dispatcher |
| `pqH` | Skill path resolver |
| `zz8` | Skill metadata reader |
| `ha9` | Skill executor |
| `pz8` | Skill result formatter |
| `$rH` | Cache clear on skill result |
| `X` | PTY socket protocol handler |
| `B5` | PTY message encoder |
| `hL5` | PTY session attach / message loop |
| `RL5` | PTY reply serializer |
| `M` | MCP server update handler |
| `dvH` | MCP tool discovery |
| `k6K` | MCP update applier |
| `vq5` | MCP client enumerator |
| `Mz` | Background-service path resolver |
| `E$H` | Background-service config loader |
| `Ia_` | PTY dispatch ID tracker |
| `qAK` | PTY dispatch timeout manager |
| `r8` | Promise-with-timeout utility |
| `P` | Render/repaint scheduler |
| `bE8` | Render buffer |
| `cG` | Project path canonicalizer |
| `hV` | Project path joiner |
| `JO` | Path slice/replace utility |
| `u3` | Realpath normalizer |
| `I5H` | File line-reader (createInterface) |
| `yL5` | Stall detector max-calculator |
| `p` | Write-with-timeout helper |
| `V` | PTY resize scheduler |
| `h6H` | PTY resize debouncer |
| `SL5` | Session lifecycle loop (getPhase/kill) |
| `N` | Away-summary scheduler |
| `g$8` | App state reader (getState) |
| `j65` | Away-summary trigger |
| `xnq` | Away-summary cooldown checker |
| `yA8` | Away-summary API caller |
| `h1q` | UUID generator for summary |
| `F` | Message history slice helper |
| `t` | Voice toggle-silence handler |
| `Q` | Voice setTimeout scheduler |
| `r` | Voice state machine |
| `e` | Voice focus-silence handler |
| `G` | Voice render ref |
| `g` | MCP-tool filter (mcp__ prefix) |
| `eH` | Tool-use filter |
| `YH` | Orphaned-permission set |
| `l` | Session output filter |
| `o` | Main REPL input/output loop |
| `c` | Voice state transition helper |
| `Wl_` | Voice websocket closer |
| `UZ6` | PTY socket write helper |
| `qM` | Worktree cache map |
| `sb` | Session renaming handler (see above) |
| `eB` | Config file read/write with date stamp |
| `OK6` | Config persistence layer |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.