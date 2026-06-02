---
type: feature-spec
feature: "branch"
cc_version: "2.1.152"
updated: "2026-06-01"
tags: ["branch", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.152 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/branch`

> Analysis basis: CC v2.1.152 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.152

---

## Overview

The `/branch` command (also accessible as `/fork`) creates a divergent copy of the current conversation at the invoking message boundary. It duplicates the conversation history up to that point into a new session, optionally applying a user-supplied name to the resulting branch. The implementation relies on a filesystem-level copy of the conversation log followed by session roster registration.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `branch` |
| description | `Create a branch of the current conversation at this point` |
| argumentHint | `[name]` |
| aliases | `["fork"]` |
| module_id | `Ln_` |
| load_inline | `true` |
| loc_byte | `12172661` |
| loc_byte_end | `12172855` |
| loc_line | `10148` |
| arbor_handler.name | `nFL` |
| arbor_handler.fqn | `claude-2.1.152::nFL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.152 bundle.js:+12172661

---

## Input Branching

Four distinct paths exist based on session/conversation state and the presence of an optional name argument:

```mermaid
flowchart TD
    A["/branch [name] invoked"] --> B{Active conversation\nexists?}
    B -- No --> C["Error: 'No conversation to branch'\n(bundle.js:+10691949)"]
    B -- Yes --> D{Message history\nnon-empty?}
    D -- No --> E["Error: 'No messages to branch'\n(bundle.js:+10692970)"]
    D -- Yes --> F["Generate new UUID for branch session\n(bundle.js:+10691741)"]
    F --> G{Optional [name]\nargument provided?}
    G -- Yes --> H["Sanitize and apply name\n(bundle.js:+10691502)"]
    G -- No --> I["Default title: 'Branched conversation'\n(bundle.js:+10691502)"]
    H --> J["Copy conversation log to new session path\n(bundle.js:+10691852)"]
    I --> J
    J --> K["Register branch in session roster\n(bundle.js:+10694199)"]
    K --> L["Emit tengu_conversation_forked telemetry\n(bundle.js:+10694199)"]
    L --> M["Signal 'fork' completion\n(bundle.js:+10694720)"]
```

---

## Behavioral Spec

### Guard Checks

Before any fork work begins, the handler verifies preconditions:

```
async function branchHandler(args, appState):
    conversation = findActiveConversation(appState)
    if conversation is null:
        raise UserError("No conversation to branch")   // bundle.js:+10691949

    messages = getConversationMessages(conversation)
    if messages is empty:
        raise UserError("No messages to branch")       // bundle.js:+10692970
```

Analysis basis: CC v2.1.152 bundle.js:+10691949, +10692970

---

### Name Resolution

The optional `[name]` argument is processed to produce the title for the new session:

```
function resolveBranchTitle(rawArg):
    if rawArg is present and non-empty:
        title = sanitize(rawArg)       // applies string replacement — bundle.js:+10691632
    else:
        title = "Branched conversation" // bundle.js:+10691502
    return title
```

Analysis basis: CC v2.1.152 bundle.js:+10691502, +10691632

---

### Session Identifier Allocation

A fresh universally unique identifier is generated to avoid collision with existing sessions:

```
function allocateBranchSessionId():
    id = crypto.randomUUID()           // bundle.js:+10691741
    return id
```

Analysis basis: CC v2.1.152 bundle.js:+10691741

---

### Conversation Log Duplication

The core fork mechanism copies the existing conversation log file to the new session's storage path. The copy is performed using a streaming read/write pipeline with a configurable chunk size:

```
async function duplicateConversationLog(sourcePath, targetSessionId):
    targetDir  = buildSessionDirectory(targetSessionId)  // bundle.js:+10691803
    mkdir(targetDir, { recursive: true })

    readStream  = createReadStream(sourcePath, {
        encoding: "utf8",                // bundle.js:+10691885
        highWaterMark: 448               // bundle.js:+10691834
    })
    writeStream = createWriteStream(targetPath, {
        highWaterMark: 384               // bundle.js:+10692044
    })

    readStream.pipe(writeStream)

    on error:
        destroy streams
        unlink partial target file       // bundle.js:+10692212
        raise error
```

Analysis basis: CC v2.1.152 bundle.js:+10691803, +10691834, +10691852, +10691885, +10692044, +10692212

---

### Message Filtering and Content Replacement

Before the copied log is finalised, message content is examined line-by-line (via a readline interface). Lines are parsed as JSON, and a `"content-replacement"` pass is applied to mark the fork boundary:

```
function processForkedMessages(lineIterator):
    results = []
    for line in lineIterator:
        parsed = JSON.parse(line)         // bundle.js:+10692396
        if parsed.type == "text":         // bundle.js:+10691575
            parsed = applyContentReplacement(parsed)  // bundle.js:+10692429
        results.push(parsed)
    return results
```

Analysis basis: CC v2.1.152 bundle.js:+10691575, +10692396, +10692429

---

### Progress Reporting

While the copy pipeline runs, incremental progress updates are surfaced to the UI. Progress values are emitted as numeric percentages up to 100:

```
function emitProgress(pct):
    // pct ∈ [0, 100] — bundle.js:+10691669
    sendProgressEvent({ type: "progress", value: pct })  // bundle.js:+10692888
```

Analysis basis: CC v2.1.152 bundle.js:+10691669, +10692888

---

### Session Roster Registration

After the log copy succeeds, the branch is formally registered in the application session roster so it becomes navigable:

```
async function registerBranchSession(newSessionId, title, parentSessionId):
    rosterEntry = buildRosterEntry({
        id:       newSessionId,
        title:    title,
        parentId: parentSessionId,
        kind:     "fork"               // bundle.js:+10694720
    })
    roster.set(newSessionId, rosterEntry)
    emitTelemetry("tengu_conversation_forked")  // bundle.js:+10694199
```

Analysis basis: CC v2.1.152 bundle.js:+10694199, +10694720

---

### Error Handling and Cleanup

All errors surface a generic fallback message when no more-specific error string is available:

```
function handleBranchError(err):
    if err.code == "ENOENT":           // bundle.js:+173660
        // source file missing — treat as no conversation
        raise UserError("No conversation to branch")
    else:
        message = err.message ?? "Unknown error occurred"  // bundle.js:+10694868
        log.error(message)
        raise message
```

Analysis basis: CC v2.1.152 bundle.js:+173660, +10694868

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_conversation_forked` (bundle.js:+10694199); secondary infrastructure events listed below |
| Session roster | New entry added with kind `"fork"` and resolved title |
| Filesystem | New session directory created; conversation log file copied into it; partial copy removed on failure |
| Active session | Parent session remains active; new branch session is registered but not automatically switched to |
| Infrastructure telemetry (indirect) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_daemon_control`, `tengu_feature_bad`, `tengu_feature_ok`, `tengu_bg_low_mem_mb`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_sendclaim_failed`, `tengu_daemon_config_reload`, `tengu_bg_spare_claim`, `tengu_bg_spare_spawn`, `tengu_bg_spare_claim_fail`, `tengu_daemon_yield`, `tengu_amber_anchor`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop`, `tengu_bg_attach_legacy_autorespawn`, `tengu_bg_attach`, `tengu_bg_attach_stall_ms`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_stall_respawn`, `tengu_daemon_idle_exit`, `tengu_bg_attach_kick`, `tengu_session_renamed`, `tengu_agent_name_set`, `tengu_worktree_detection` — all from modules reachable within depth-2 traversal; not directly triggered by `/branch` but observable when the daemon infrastructure is active |

---

## Version History

| Version | Change |
|---|---|
| v2.1.152 | Initial analysis |

---

## Common Mistakes

1. **Running `/branch` before sending any messages** — the guard at bundle.js:+10692970 rejects the command with "No messages to branch" if the conversation history is empty. Send at least one exchange first.
2. **Expecting automatic session switch** — the command registers the branch in the roster but does not navigate to it; users must manually select the new session.
3. **Using `/fork` and expecting different behaviour** — `/fork` is a registered alias; it is fully equivalent to `/branch`.
4. **Passing a name with special characters without quoting** — the name argument undergoes a string-replace sanitisation pass (bundle.js:+10691632); some characters may be altered in the resulting title.
5. **Calling `/branch` in a session with no active conversation** — the first guard (bundle.js:+10691949) raises an error; the command requires an initialised conversation object, not just an open session window.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `nFL` | Primary handler (`AsyncFunction`) for `/branch`; Arbor-resolved entry point |
| `OT1` | Core branch orchestration function; called by `nFL` |
| `$T1` | Conversation log copy pipeline (read/write stream setup) |
| `fT1` | Argument parsing / source conversation lookup |
| `lFL` | Session roster entry builder |
| `Kl` | Worktree / git metadata helper |
| `LRH` | Git worktree list parser |
| `bt1` | File tree enumeration helper |
| `uRH` | Buffer allocation utility (used in log copy) |
| `Ph` | Session rename / custom-title emitter |
| `YMH` | File-based append logger with directory creation |
| `J5H` | Agent-name setter; emits `tengu_agent_name_set` |
| `rg` | Persistent state read/write helper |
| `yM6` | JSON file read-modify-write helper |
| `Q6` | Internal constant / enum used by `YMH` |
| `L9` | String slice utility (indexOf + slice) |
| `KS` | Regex-safe string escape helper |
| `Qf` | Session filter predicate |
| `OT1` | (see above) Branch orchestration |
| `J3` | Session initialisation helper |
| `I4` | Session context builder |
| `tq` | Performance-mark registration wrapper |
| `y6` | State selector / reactive store getter |
| `pv` | Reactive store primitive |
| `z_` | Derived reactive store |
| `Ov` | Session path builder |
| `uI` | UI state accessor |
| `mM` | Session metadata assembler |
| `oh` | Store subscription helper |
| `hH` | Error classification / logging utility |
| `n_` | Error type discriminator |
| `uH` | String coercion utility |
| `V1` | Log entry formatter |
| `mGA` | Message string formatter |
| `UtK` | Ring-buffer queue (shift/push) |
| `NO` | Null-safe object accessor |
| `k8` | Background session event handler |
| `w` | Background session manager |
| `c` | App state context reference |
| `R` | Background worker process handle |
| `WGK` | Worker binary path resolver (realpath + stat) |
| `Tz` | Timeout / timer utility |
| `N` | OS platform / signal utility |
| `Wx5` | Process health check helper |
| `z` | IPC write stream |
| `mH` | Memory-pressure state writer |
| `SH` | Memory-pressure state reader |
| `jI8` | macOS memory check helper |
| `E6` | Background session state machine |
| `mY6` | Pinned-file manifest reader |
| `pj_` | `pins.json` path builder |
| `B6` | Safe JSON parse wrapper |
| `QD7` | Project directory scanner |
| `d4A` | Background daemon claim/connect routine |
| `h_A` | Session storage initialiser (mkdir + writeFile) |
| `lb5` | Claim timeout watchdog |
| `cb5` | Claim frame builder |
| `GH` | String coercion wrapper |
| `IB` | Binary framing encoder (Buffer alloc + writeUInt32BE) |
| `a4A` | Background session lifecycle manager |
| `K` | Session status formatter (padEnd) |
| `uK` | Session data directory path helper |
| `n9` | Session file stat and cache manager |
| `tw` | Session active-state updater |
| `d5` | Checksum / hash path helper |
| `A66` | Session result poller |
| `N5H` | Session log path builder |
| `Gh` | Session log line parser |
| `bB` | Session log writer |
| `Jv6` | Session metadata file writer |
| `Y` | Daemon config / MCP reload manager |
| `D` | Background spawn supervisor loop |
| `Q4A` | Spare worker spawner |
| `j` | Worker kill-all iterator |
| `y` | Individual worker kill helper |
| `tR` | Session transition signal |
| `W` | Output buffer accumulator |
| `_L` | Output line decoder |
| `X` | IPC frame reader / dispatcher |
| `ZM` | IPC response serialiser |
| `CH` | JSON stringify wrapper |
| `Hx5` | IPC protocol handler (full message dispatch) |
| `_x5` | IPC message type discriminator |
| `f` | MCP client configuration applicator |
| `lhH` | MCP server connection builder |
| `dPK` | MCP update applier |
| `yR5` | MCP retry / recovery orchestrator |
| `cO` | Background service context accessor |
| `fzH` | Background service E6 wrapper |
| `n4A` | IPC pending-request registry |
| `r0K` | IPC request timeout manager |
| `n8` | Promise-with-timeout utility |
| `P` | Terminal repaint coordinator |
| `IR8` | Ink render scheduler |
| `oW` | Project path normaliser |
| `ov` | Project subdirectory resolver |
| `vz` | Path segment sanitiser |
| `x3` | Filesystem realpath normaliser |
| `Y3H` | JSONL file line reader |
| `tb5` | Background attach stall detector |
| `m` | Terminal write-with-debounce helper |
| `b` | Session health poll timer |
| `V` | Timer reference holder |
| `e_H` | Session phase transition handler |
| `eb5` | Background attach state machine |
| `I` | Away-summary scheduler |
| `iP8` | Global state reader for away-summary gate |
| `ZN5` | Away-summary cache key resolver |
| `M$K` | Away-summary rate-limit checker |
| `hL8` | Away-summary API caller |
| `PW1` | Request UUID generator |
| `g` | Message history accessor |
| `o` | Voice toggle silence-timeout handler |
| `Q` | Daemon socket timeout helper |
| `r` | Voice/focus mode state router |
| `x` | Daemon idle-exit timer |
| `t` | Voice focus-silence-timeout handler |
| `G` | Terminal render state holder |
| `l` | Input filter for terminal events |
| `e` | Voice session lifecycle manager |
| `d` | Permission-allow state handler |
| `rk8` | Permission state machine step |
| `Jh6` | IPC error-frame serialiser |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.