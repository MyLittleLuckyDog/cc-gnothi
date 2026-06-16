---
type: feature-spec
feature: "branch"
cc_version: "2.1.178"
updated: "2026-06-16"
tags: ["branch", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.178 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/branch`

> Analysis basis: CC v2.1.178 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.178

---

## Overview

The `/branch` command creates a divergent copy ("fork") of the current conversation at its present point in history, optionally assigning the new branch a user-supplied name. Internally it serialises the current message thread to a new session file and spawns a fresh REPL session seeded with that history, emitting a `tengu_conversation_forked` telemetry event on success.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `branch` |
| description | `Create a branch of the current conversation at this point` |
| argumentHint | `[name]` |
| module_id | `o$A` |
| load_inline | `true` |
| loc_byte | `12886459` |
| loc_byte_end | `12886636` |
| loc_line | `8882` |
| arbor_handler.name | `hmL` |
| arbor_handler.fqn | `claude-2.1.178::hmL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.178 bundle.js:+12886459

---

## Input Branching

The command has four distinct input/state branches: (1) no active conversation, (2) no messages yet, (3) a branch name supplied by the user, and (4) automatic name generation. A Mermaid flowchart is therefore used.

```mermaid
flowchart TD
    A["/branch [name] invoked"] --> B{Active conversation\nsession exists?}
    B -- No --> C["Error: 'No conversation to branch'\n(bundle.js:+11312007)"]
    B -- Yes --> D{Message history\nnon-empty?}
    D -- No --> E["Error: 'No messages to branch'\n(bundle.js:+11313126)"]
    D -- Yes --> F{User supplied\na branch name?}
    F -- Yes --> G["Sanitise & use supplied name\n(s6K: find + replace, bundle.js:+11311612)"]
    F -- No --> H["Generate name:\n'Branched conversation'\n(bundle.js:+11311560)"]
    G --> I[Allocate new UUID\n(r6K.randomUUID, bundle.js:+11311799)]
    H --> I
    I --> J[Copy conversation messages\nto new session file]
    J --> K[Spawn fresh REPL with\nforked session as seed]
    K --> L["Emit tengu_conversation_forked\n(bundle.js:+11314355)"]
    L --> M[Display 'fork' indicator\nto user\n(bundle.js:+11314876)]
```

---

## Behavioral Spec

### Handler Entry Point (`hmL`)

`hmL` is the resolved async handler for `/branch`.  
Analysis basis: CC v2.1.178 bundle.js:+11315140 (call to `e6K`)

```
async function branchCommandHandler(args, appContext):
    result = await executeBranch(args, appContext)
    return result
```

### Branch Execution (`e6K`)

`e6K` is the core branching routine called immediately from `hmL`.

```
async function executeBranch(args, appContext):

    # 1. Resolve current session
    session = getSessionContext(appContext)              # R6, loc:+11314051
    if session is null or not valid:
        throw Error("No conversation to branch")        # loc:+11312007

    # 2. Validate message history
    messages = session.messages
    if messages is empty:
        throw Error("No messages to branch")            # loc:+11313126

    # 3. Determine branch name
    rawName = args.trim()
    if rawName is non-empty:
        branchName = sanitiseName(rawName)              # s6K, loc:+11314218
    else:
        branchName = "Branched conversation"            # loc:+11311560

    # 4. Assign ISO timestamp
    timestamp = new Date().toISOString()                # loc:+11314445
    epochMs   = new Date().getTime()                    # loc:+11314494

    # 5. Allocate new session identity
    newUUID = crypto.randomUUID()                       # loc:+11311799

    # 6. Serialise conversation to new file
    newSessionPath = buildSessionPath(newUUID)          # nM, loc:+11311850
    await writeSessionFile(newSessionPath, messages,    # t6K, loc:+11311861+
                           branchName, timestamp)

    # 7. Emit telemetry
    emit("tengu_conversation_forked")                   # loc:+11314355

    # 8. Switch REPL to forked session
    launchForkedSession(newUUID, "fork")                # loc:+11314876
```

Analysis basis: CC v2.1.178 bundle.js:+11314159

### Name Sanitisation (`s6K`)

```
function sanitiseName(rawInput):
    found = knownNames.find(rawInput)                   # _.find,  loc:+11311612
    cleaned = rawInput.replace(problematicChars, "")    # A.replace, loc:+11311690
    return cleaned
```

Analysis basis: CC v2.1.178 bundle.js:+11311612

### Session File Writer (`t6K`)

Handles the low-level file operations required to persist the branched conversation.

```
async function writeSessionToFile(path, messages, branchName, timestamp):
    await fs.mkdir(parentDir, { recursive: true })      # xB8.mkdir, loc:+11311861

    # Stream messages from the current session file
    reader = fs.createReadStream(currentSessionFile,    # loc:+11311910
                                 { encoding: "utf8",    # loc:+11311943
                                   highWaterMark: 448 }) # loc:+11311892

    # If current session is absent, surface actionable error
    on ENOENT:
        throw Error("No conversation to branch")        # loc:+11312001 / loc:+11312007

    writer = fs.createWriteStream(newPath)              # loc:+11312056

    # Transform: inject branch metadata into message stream
    interface = readline.createInterface(reader)        # loc:+11312150
    for each line in interface:
        parsed  = safeJsonParse(line)                   # i6, loc:+11312454
        # Replace first user message content type       # loc:+11311633 ("text")
        modified = applyContentReplacement(parsed)      # loc:+11312487 "content-replacement"
        writer.write(JSON.stringify(modified))

    # Await full stream flush                           # loc:+11313522 O.end
    await streamFinished(writer)                        # loc:+11313536

    # Progress reporting up to 100 steps               # loc:+11311727 (100)
    reportProgress("progress", step)                    # loc:+11313044
```

Analysis basis: CC v2.1.178 bundle.js:+11311799

### Completion Notification (`NmL`)

After the session is written and the forked REPL has been initialised, `NmL` handles tab/window management for the new branch session.

```
function completeBranchSetup(newSession):
    completions = buildCompletions(newSession)          # Ha, loc:+11313728
    sanitised   = sanitiseTitle(newSession.name)        # DN, loc:+11313829
    trackOpenSession(newSession.id)                     # K.add, loc:+11313923
    index = parseInt(newSession.index)                  # loc:+11313929
    if alreadyOpen(newSession.id):                      # K.has, loc:+11313976
        return (no duplicate)
```

Analysis basis: CC v2.1.178 bundle.js:+11313728

### Auto-completion Provider (`Ha`)

Provides branch-name completions when the user types `/branch <TAB>`.

```
function buildBranchCompletions(context):
    worktrees = detectWorktrees(context)                # mOH, loc:+13635931
    paths     = scanProjectPaths(context)               # pNK, loc:+13635949
    hashed    = hashPaths(paths)                        # SFH, loc:+13635971
    lowered   = paths.map(p => p.toLowerCase())         # H.toLowerCase, loc:+13635991
    filtered  = lowered.filter(isEligible)              # L.filter, loc:+13636016
    cached    = completionCache.get(filtered)           # O.get, loc:+13636182
    if cached is missing:
        result = Array.from(completionCache.values())   # loc:+13636238
        result.sort(byRecency)                          # z.sort, loc:+13636264
        result = result.slice(0, limit)                 # z.slice, loc:+13636330
        completionCache.set(key, result)                # O.set, loc:+13636220
    return result
```

Analysis basis: CC v2.1.178 bundle.js:+13635931

### Session Writer (`VB` / `cUH`)

`VB` handles writing the custom title metadata of the branched conversation, while `cUH` records the agent-name metadata. Both call shared utilities for path building (`qy`) and log appending (`YYH`).

```
function writeBranchTitle(session, title):
    path     = buildSessionMetaPath(session.id)         # qy, loc:+13628812
    appendToLog(path, title)                            # YYH, loc:+13628821
    emit("tengu_session_renamed")                       # loc:+13628925

function writeBranchAgentName(session, agentName):
    path     = buildSessionMetaPath(session.id)         # qy, loc:+13632343
    appendToLog(path, agentName)                        # YYH, loc:+13632352
    emit("tengu_agent_name_set")                        # loc:+13632462
```

Analysis basis: CC v2.1.178 bundle.js:+13628812, +13632343

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_conversation_forked` (loc:+11314355); `tengu_session_renamed` (loc:+13628925); `tengu_agent_name_set` (loc:+13632462); various daemon/bg events from shared infrastructure |
| New session file | Written to the project's session directory under a fresh UUID; path built via `nM` / `qy` utilities |
| Session directory | Created with `fs.mkdir({ recursive: true })` if absent (loc:+11311861) |
| REPL launch | A new REPL process is spawned seeded with the forked session (mode flag: `"fork"`, loc:+11314876) |
| Tab/window tracking | Open-session set updated via `K.add` / `K.has` (loc:+11313923, +11313976) |
| Completion cache | Branch-name completion cache populated/queried via `O.get` / `O.set` (loc:+13636182, +13636220) |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.178 | Initial analysis |

---

## Common Mistakes

1. **Running `/branch` before any conversation starts** — the command requires at least one message in the active session. Invoking it on a fresh REPL produces the error `"No conversation to branch"` (loc:+11312007).
2. **Running `/branch` with an empty history** — even if a session object exists, having zero messages triggers `"No messages to branch"` (loc:+11313126). Send at least one turn before branching.
3. **Expecting the original session to be modified** — `/branch` is non-destructive; it copies history into a new session file and opens a separate REPL. The original session continues unchanged.
4. **Supplying a name containing special characters** — the name undergoes sanitisation (`s6K`); characters that cannot appear in a file-safe title are silently removed (loc:+11311690).
5. **Confusing `/branch` with a git branch operation** — the command branches the Claude conversation history, not the git working tree, even when git worktrees are detected for completion purposes.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `hmL` | Async handler entry point for `/branch` (resolved by Arbor via `module_id`) |
| `e6K` | Core branch execution function; orchestrates validation, file write, and REPL launch |
| `s6K` | Branch name sanitisation utility (find + replace on raw user input) |
| `t6K` | Low-level session file writer; streams current session and transforms messages |
| `NmL` | Post-fork completion: tab tracking, title sanitisation, duplicate guard |
| `Ha` | Auto-completion provider for branch name argument |
| `mOH` | Git worktree detection helper used during completion |
| `pNK` | Project-path scanner used during completion |
| `SFH` | Path-hashing helper used during completion |
| `VB` | Writes custom-title metadata for the new branch session |
| `cUH` | Writes agent-name metadata for the new branch session |
| `DN` | Title sanitisation (regex replace for shell/display safety) |
| `qy` | Session metadata path builder |
| `YYH` | Append-to-log utility for session metadata files |
| `nM` | Session path builder used for new session directory creation |
| `R6` | Session context resolver |
| `Y$` | Session state helper called during context resolution |
| `Wf` | Session registration helper |
| `F9` | XSA registration adapter |
| `Z9` | String slice/index utility |
| `i6` | Safe JSON parse wrapper |
| `xH` | JSON serialisation wrapper (`JSON.stringify`) |
| `TT` | Path construction helper shared across session utilities |
| `W_` | Path join helper |
| `LO` | Session loader utility |
| `eh` | Session event handler |
| `zb` | Path builder sub-utility |
| `RH` | Error-reporting / log-queue manager |
| `jA` | Error construction wrapper |
| `L6` | String coercion helper |
| `qq` | Log queue flusher |
| `biA` | Log-line formatter |
| `RQ4` | Ring-buffer manager for error log |
| `x8` | Stream-safe write helper |
| `Z8` | Core write primitive |
| `bH` | Feature-flag bad-path telemetry emitter |
| `SH` | Feature-flag ok-path telemetry emitter |
| `dH` | Feature-flag result dispatcher |
| `ul8` | Memory pressure checker (macOS) |
| `O6` | Background session state machine |
| `dRH` | Daemon roster reader / stale-entry cleaner |
| `aE6` | Roster path builder |
| `yf7` | Recursive session-directory scanner |
| `D` | Background session dispatcher / supervisor loop |
| `b` | Background session record object / factory |
| `yCH` | Session config reader |
| `Y` | Supervisor write / config-reload handler |
| `N` | Agent name formatter |
| `zt` | Daemon stop helper |
| `NH6` | `.claude` directory writer |
| `Ah9` | Session filter (active-session pruner) |
| `P` | IPC frame buffer / socket reader |
| `z` | Daemon control-message dispatcher |
| `S` | Session state-write handler |
| `X` | Socket timeout manager |
| `MtK` | Prompt-change summary formatter |
| `i9H` | Session sync helper |
| `o8` | Timeout-with-abort helper |
| `K` | Column formatter / open-session set |
| `ZhA` | Daemon claim/spawn coordinator |
| `SGA` | Session-roster writer |
| `$b5` | Claim send-timeout handler |
| `Mb5` | Claim frame builder |
| `hL` | Write-safe helper |
| `TH` | String cast helper |
| `khA` | Background process lifecycle manager |
| `w4` | Path join utility (project root) |
| `Mq` | File-watcher / session-cache manager |
| `HO` | Active-session status checker |
| `f2H` | Ignore-file / allowlist parser |
| `SL` | Session lock helper |
| `HL6` | Daemon health-check poller |
| `XU6` | Socket path builder (variant A) |
| `hzH` | Socket path builder (variant B) |
| `lI` | Socket path builder (variant C) |
| `lv` | NqK-based socket namer |
| `JU6` | Socket path builder (variant D) |
| `w` | Forced-shutdown handler |
| `bX` | Exit-code helper |
| `j` | Process kill-all iterator |
| `YB` | Session tag writer |
| `$` | Session destroy / cleanup handler |
| `xGK` | Daemon-status JSON writer |
| `f9` | Async-local-storage store reader |
| `XF6` | Daemon-status file path builder |
| `W` | SDK HTTP/SSE transport layer |
| `j36` | HTTP request builder |
| `OA4` | Request-key enumerator |
| `Fv` | Binary frame encoder |
| `sB8` | Binary frame decoder |
| `MV` | NqK socket name helper |
| `C8` | IPC message dispatcher |
| `J$` | Completion deduplicator |
| `Rn` | Persistent config read/write helper |
| `$P6` | Config file I/O wrapper |