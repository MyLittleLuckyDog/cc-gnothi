---
type: feature-spec
feature: "branch"
cc_version: "2.1.185"
updated: "2026-06-21"
tags: ["branch", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.185 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/branch`

> Analysis basis: CC v2.1.185 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.185

---

## Overview

The `/branch` command creates a divergent copy ("fork") of the current conversation at the point it is invoked. It serialises the message history up to that moment into a new session file and spawns a fresh Claude Code process that resumes from that snapshot, letting the user explore an alternative trajectory without disturbing the original session.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `branch` |
| description | `Create a branch of the current conversation at this point` |
| argumentHint | `[name]` |
| module_id | `_Ho` |
| load_inline | `true` |
| loc_byte | `12763536` |
| loc_byte_end | `12763713` |
| loc_line | `8420` |
| arbor_handler.name | `k6p` |
| arbor_handler.fqn | `claude-2.1.185::k6p` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.185 bundle.js:+12763536

---

## Input Branching

Five distinct paths exist depending on the state of the active conversation and the presence of an optional name argument.

```mermaid
flowchart TD
    A(["/branch [name] invoked"]) --> B{Active session\nexists?}
    B -- No --> ERR1["Error: 'No conversation to branch'\n(bundle.js:+11183855)"]
    B -- Yes --> C{Message list\nnon-empty?}
    C -- No --> ERR2["Error: 'No messages to branch'\n(bundle.js:+11184974)"]
    C -- Yes --> D["Generate new session UUID\n(bundle.js:+11183647)"]
    D --> E{Optional [name]\nargument supplied?}
    E -- Yes --> F["Sanitise name via\nname-cleaner helper\n(bundle.js:+11183460)"]
    E -- No --> G["Default title:\n'Branched conversation'\n(bundle.js:+11183408)"]
    F --> H["Write forked session\nfile to disk\n(bundle.js:+11183709)"]
    G --> H
    H --> I["Spawn child process\nfor new session\n(bundle.js:+11186724 'fork')"]
    I --> J["Emit tengu_conversation_forked\ntelemetry\n(bundle.js:+11186203)"]
    J --> K([Branch open in new window/pane])
```

---

## Behavioral Spec

### 1. Guard Checks

Before any branching work begins, the handler validates that there is something to branch.

```
async function branchCommandHandler(args, appState):
    activeSession = getActiveSession(appState)
    if activeSession is null or undefined:
        displayError("No conversation to branch")
        return                                    # bundle.js:+11183855

    messages = getSessionMessages(activeSession)
    if messages is empty:
        displayError("No messages to branch")
        return                                    # bundle.js:+11184974
```

Analysis basis: CC v2.1.185 bundle.js:+11183855, +11184974

### 2. Branch Name Resolution

The optional `[name]` argument is processed to produce a human-readable title for the new session.

```
function resolveBranchName(rawArg):
    if rawArg is present and non-empty:
        cleaned = nameCleaner(rawArg)             # bundle.js:+11183460
        # nameCleaner performs t.find + n.replace to
        # strip or transform disallowed characters
        return cleaned
    else:
        return "Branched conversation"            # bundle.js:+11183408
```

Analysis basis: CC v2.1.185 bundle.js:+11183460, +11183408

### 3. Session Serialisation and Disk Write

A new universally unique identifier is generated for the branch, the current message list is serialised, and a session file is written to disk.

```
async function writeBranchedSession(messages, title):
    newId = generateUUID()                        # bundle.js:+11183647

    sessionData = buildSessionRecord(
        id       = newId,
        title    = title,
        messages = messages,                      # content-type "text" bundle.js:+11183481
        metadata = { origin: "branch" }
    )

    targetDir  = resolveSessionDirectory()        # uses Lt, Hg, Ar, tD, Gm  bundle.js:+11183666–11183698
    await mkdirRecursive(targetDir)               # bundle.js:+11183709

    # Stream-copy approach: ReadStream → WriteStream
    readStream  = createReadStream(sourcePath, { encoding: "utf8" })   # bundle.js:+11183758, +11183791
    writeStream = createWriteStream(targetPath)                        # bundle.js:+11183904

    # readline interface wraps the read stream
    rl = createInterface(readStream)              # bundle.js:+11183998

    # Entries are replayed; progress tracked in 100-unit increments
    # (constant 100 at bundle.js:+11183575)
    for each line in rl:
        write serialised line to writeStream      # content-replacement tagging bundle.js:+11184335

    await streamFinished(writeStream)             # bundle.js:+11185384
    return newId
```

Analysis basis: CC v2.1.185 bundle.js:+11183647, +11183709, +11183758, +11183904, +11183998, +11184335, +11185384

### 4. Child Process Spawn (Fork)

After the file is committed the command launches a new Claude Code instance that opens the branched session.

```
async function spawnBranchedProcess(newSessionId):
    spawnMode = "fork"                            # bundle.js:+11186724

    childProcess = zq.spawn({
        sessionId : newSessionId,
        mode      : spawnMode
    })

    # Socket handshake / claim sequence is handled by
    # the daemon-layer utilities (NNo, Zrl, x6p)
    await claimSession(childProcess)              # bundle.js:+11186988–11186007
    return childProcess
```

Analysis basis: CC v2.1.185 bundle.js:+11186724, +11186988

### 5. Conversation History Replay Utilities

Two helpers build the message stream that is copied into the branch.

```
function buildMessageHistoryForBranch(rawMessages):
    # Jrl: locate the "auto" boundary marker bundle.js:+11186157
    boundary = rawMessages.find(isBoundaryMarker)   # bundle.js:+11183460 (t.find)
    trimmed  = rawMessages.replace(boundary, ...)   # bundle.js:+11183538 (n.replace)
    return trimmed

function sanitiseTitle(input):
    lower = input.toLowerCase()                   # bundle.js:+17302667
    # padEnd with width 40 for display alignment   # bundle.js:+17302741
    return lower.padEnd(40)
```

Analysis basis: CC v2.1.185 bundle.js:+11183460, +11183538, +17302667, +17302741

### 6. Error Path — Missing Source File

If the source session file does not exist on disk the handler surfaces an `ENOENT`-class error rather than crashing.

```
async function safeCopySession(sourcePath, destPath):
    try:
        stat = await lstat(sourcePath)            # bundle.js:+11183758 area
    catch err:
        if err.code == "ENOENT":                  # bundle.js:+182403
            logError("cli_error", err)            # bundle.js:+13324753
            process.exit(1)                       # bundle.js:+13324779
        raise
```

Analysis basis: CC v2.1.185 bundle.js:+182403, +13324753, +13324779

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_conversation_forked` (bundle.js:+11186203) — emitted once per successful branch |
| Telemetry (ambient, daemon layer) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_daemon_config_reload`, `tengu_daemon_control`, `tengu_scheduled_task_missed`, `tengu_feature_bad`, `tengu_feature_ok`, `tengu_bg_low_mem_mb`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_sendclaim_failed`, `tengu_bg_state_read_transient`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_worktree_detection`, `tengu_session_renamed`, `tengu_agent_name_set` — all from supporting daemon/session infrastructure traversed at depth ≤ 2 |
| Disk writes | New session JSON file created under the Claude session directory (bundle.js:+11183709, +11183904) |
| Process spawn | A child `fork`-mode process is spawned for the branched session (bundle.js:+11186724) |
| Socket / daemon claim | Daemon claim handshake performed for the new process via `NNo` / `zq.claim` layer (bundle.js:+11186988) |
| appState changes | The parent session continues unmodified; the branch runs as an independent session |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | `qi` → `B2o.register` (bundle.js:+69538) — standard command hook registration path |

---

## Version History

| Version | Change |
|---|---|
| v2.1.185 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/branch` before any messages exist** — the command aborts with "No messages to branch" (bundle.js:+11184974). Send at least one message before branching.
2. **Expecting the original session to change** — `/branch` creates a new independent session; the parent continues as-is. Changes made in the branch do not propagate back.
3. **Providing a name with special characters** — the name-cleaner helper (bundle.js:+11183460) transforms or strips disallowed characters. Stick to alphanumeric names and hyphens to avoid unexpected title mutations.
4. **Branching outside a Claude Code session context** — if there is no active session object the handler returns immediately with "No conversation to branch" (bundle.js:+11183855). The command is only valid inside a running interactive session.
5. **Assuming immediate availability** — the spawned fork process goes through the full daemon claim/socket handshake sequence before it is ready; a short delay before the new window appears is expected.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `k6p` | Main async handler for `/branch` (arbor_handler; AsyncFunction) |
| `Zrl` | Branch orchestrator — coordinates serialisation, spawn, and telemetry |
| `Qrl` | Session file copy engine — manages ReadStream/WriteStream pipeline |
| `Jrl` | Message history boundary finder and replacer |
| `x6p` | Spawn argument builder / UUID deduplication tracker |
| `dX` | Completion-source / context-file resolver called during branch setup |
| `Rge` | Git worktree detection utility (called by `dX`) |
| `IOl` | Directory-aware context file scanner (called by `dX`) |
| `Ije` | Binary/buffer packer helper (called by `dX`) |
| `B6` | Session rename emitter (custom-title path) |
| `B6e` | Agent-name setter emitter |
| `$_e` | Log appender / synchronous file writer |
| `mq` | Message queue / serialisation formatter |
| `mh` | Module initialiser called during handler bootstrap |
| `Au` | Sub-module activator (called by `mh`, `B6`, `B6e`) |
| `qi` | Hook registration entry point → `B2o.register` |
| `Lt` | Session-directory path resolver |
| `Ar` | Alternative path resolver (complements `Lt`) |
| `Hg` | Session metadata accessor |
| `tD` | Conversation record builder (user/assistant/attachment/system roles) |
| `Gm` | Path joiner for session storage |
| `eO` | Session object factory |
| `De` | Error logger / structured error reporter |
| `Ho` | Low-level error constructor wrapper |
| `st` | String coercion utility |
| `ra` | Request-traffic classifier |
| `eJo` | Inner traffic classifier helper |
| `Bzc` | Rolling buffer manager (shift/push) |
| `Mn` | Notification / message dispatcher |
| `dn` | Low-level notification sender |
| `Pe` | JSON serialiser wrapper |
| `Gt` | Safe JSON parser |
| `Di` | String index/slice utility |
| `V0` | Regex-escape helper for branch names |
| `Ah` | Context-cache lookup helper |
| `NNo` | Daemon socket claim orchestrator |
| `Nko` | Session state file writer (JSON.stringify + mkdir) |
| `f6f` | Send-claim timeout enforcer |
| `p6f` | Claim-frame builder |
| `FM` | Binary frame encoder (Buffer operations) |
| `wp` | Notification sender (wraps `dn`) |
| `Ee` | String coercion helper |
| `jNo` | Background session lifecycle manager |
| `fa` | Session-file state reader/cache manager |
| `Ic` | Session path builder |
| `pg` | Active-state tracker |
| `OCe` | Permission/ignore-list classifier |
| `Pp` | Session-path resolver with permission checks |
| `rft` | Async task runner with timing |
| `P6t` | Path-join + metadata helper |
| `e_e` | Context-extension loader |
| `iD` | Late-state initialiser |
| `BN` | Session-file cleanup helper |
| `WM` | Late-mount session helper |
| `R6t` | Base path resolver |
| `fae` | File-watcher aggregator / reload trigger |
| `Dtt` | Session-file reader and message deserialiser |
| `CMt` | `.claude` directory and config writer |
| `J1i` | Session filter / TTL pruner |
| `Jnc` | Plural-message formatter |
| `CQ` | Config value fetcher |
| `T` | Log-level / severity classifier |
| `d` | Supervisor I/O writer |
| `M` | Background session dispatcher (main daemon entry) |
| `f` | Background session runner / process manager |
| `A` | Runner launcher |
| `Bn` | Timeout-with-abort helper |
| `o` | Column formatter (padEnd) |
| `Re` | Feature-flag OK reporter |
| `ke` | Feature-flag error reporter |
| `Ue` | Feature-flag event emitter |
| `YKn` | macOS memory pressure monitor |
| `ct` | Memory pressure cache checker |
| `B$e` | pins.json reader and file pruner |
| `nDt` | Pin file path builder |
| `zAd` | Recursive directory scanner |
| `$` | Permission policy resolver |
| `zlt` | Policy rule evaluator |
| `R6` | Policy decision engine |
| `NNo` | Daemon claim socket handler (duplicate entry — same role) |
| `jNo` | Background session lifecycle manager (duplicate entry — same role) |
| `p` | Forced-shutdown / abort handler |
| `WT` | Shutdown reason tagger |
| `m` | Active-session killer (iterates and kills) |
| `S6` | Session-set membership checker |
| `l` | Stream destructor / k0l dispatcher |
| `k0l` | Daemon-status JSON writer |
| `ci` | AsyncLocalStorage store reader |
| `Mjt` | `daemon.status.json` path builder |
| `_` | SDK transport manager |
| `xht` | Transport type dispatcher |
| `pcc` | Transport key enumerator |
| `g` | Buffer accumulator / socket data handler |
| `u` | Daemon stop/start controller |
| `k` | Config-reload writer |
| `h` | Socket connection holder with timeout |
| `Fs` | CLI error exit handler |
| `yje` | CLI error formatter (called by `Fs`) |
| `eI` | Error output writer (called by `Fs`) |
| `Tn` | Background-session state tagger |
| `YK` | Stats/counter updater with timestamp |
| `_Ct` | Persistent config file read/write helper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.