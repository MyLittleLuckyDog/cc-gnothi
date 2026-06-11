---
type: feature-spec
feature: "branch"
cc_version: "2.1.170"
updated: "2026-06-11"
tags: ["branch", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.170 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/branch`

> Analysis basis: CC v2.1.170 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.170

---

## Overview

The `/branch` command creates a diverging copy of the current conversation at its present point in history, allowing the user to explore an alternative direction without affecting the original session. It does this by forking the underlying conversation transcript into a new session and then launching that new session as an independent Claude Code instance. The command accepts an optional `[name]` argument to label the branch.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `branch` |
| description | `Create a branch of the current conversation at this point` |
| argumentHint | `[name]` |
| module_id | `pqA` |
| load_inline | `true` |
| loc_byte | `12659216` |
| loc_byte_end | `12659393` |
| loc_line | `8991` |
| arbor_handler.name | `l0f` |
| arbor_handler.fqn | `claude-2.1.170::l0f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.170 bundle.js:+12659216

The registration block spans bytes `(12659216, 12659393)`. The handler was resolved via `module_id` → `pqA` → export lookup, yielding the `AsyncFunction` identified as `l0f` in the bundle symbol graph.

---

## Input Branching

The command has more than three distinct execution paths based on pre-conditions (active conversation check, message availability, and the optional user-supplied name), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/branch [name] invoked"]) --> B{Active conversation\nexists?}
    B -- No --> C["Error: 'No conversation to branch'\n(bundle.js:+11109259)"]
    B -- Yes --> D{Message list\nnon-empty?}
    D -- No --> E["Error: 'No messages to branch'\n(bundle.js:+11110378)"]
    D -- Yes --> F{User supplied\na branch name?}
    F -- No --> G["Auto-generate branch title\n'Branched conversation'\n(bundle.js:+11108812)"]
    F -- Yes --> H["Use supplied name\n(sanitised via ZQq / replace)\n(bundle.js:+11108942)"]
    G --> I[Assign new UUID to forked session\n(bundle.js:+11109051)]
    H --> I
    I --> J[Copy transcript up to\ncurrent message index\ninto new session store]
    J --> K[Copy conversation file to\nnew session path via\ncreateReadStream / createWriteStream\n(bundle.js:+11109162, +11109308)]
    K --> L[Launch new CC instance\nin fork mode\n(bundle.js:+11112128)]
    L --> M[Emit tengu_conversation_forked\ntelemetry event\n(bundle.js:+11111607)]
    M --> N([Branch session running])
```

---

## Behavioral Spec

### Guard: Verify Active Conversation

```
function guardActiveConversation(appState):
    currentConversation = findActiveConversation(appState)
    if currentConversation is null:
        raise UserFacingError("No conversation to branch")
    return currentConversation
```

The handler (via `vQq`, entry point reached from `l0f` at bundle.js:+11112392) first calls the conversation-finder utility (`ZQq`, bundle.js:+11108864) to locate an active session. If none is found it surfaces the literal error string `"No conversation to branch"` (bundle.js:+11109259).

Analysis basis: CC v2.1.170 bundle.js:+11108864, +11109259

---

### Guard: Verify Messages Exist

```
function guardMessagesExist(conversation):
    if conversation.messages.length == 0:
        raise UserFacingError("No messages to branch")
    return conversation.messages
```

Before proceeding the implementation checks that the conversation contains at least one message. The literal `"No messages to branch"` (bundle.js:+11110378) is surfaced if the list is empty.

Analysis basis: CC v2.1.170 bundle.js:+11110378

---

### Name Resolution

```
function resolveBranchName(userArg):
    if userArg is absent or blank:
        return "Branched conversation"   # literal at bundle.js:+11108812
    sanitised = sanitizeBranchName(userArg)   # via nameNormaliser (ZQq → A.replace)
    return sanitised
```

When no argument is provided the title defaults to `"Branched conversation"` (bundle.js:+11108812). When a name is provided it is passed through a sanitisation step (`ZQq` calls `A.replace` at bundle.js:+11108942) that normalises characters unsuitable for file or session naming.

Analysis basis: CC v2.1.170 bundle.js:+11108812, +11108942

---

### Session Forking

```
async function forkSession(sourceConversation, branchName, messages):
    newSessionId = crypto.randomUUID()          # bundle.js:+11109051
    targetPath   = buildSessionPath(newSessionId)

    # Snapshot transcript
    sourceStream = fs.createReadStream(sourcePath, {encoding: "utf8", flags: "open"})
                                                # bundle.js:+11109162, +11109195, +11109221
    destStream   = fs.createWriteStream(targetPath)
                                                # bundle.js:+11109308

    await pipeWithLineFilter(sourceStream, destStream, messages)

    emit progress event ("progress")            # bundle.js:+11110296

    # Content replacement pass — rewrite session metadata inside copied file
    # tag: "content-replacement" (bundle.js:+11109739)
    await rewriteSessionMetadata(targetPath, {
        sessionId: newSessionId,
        title:     branchName,
        role:      "text"                       # bundle.js:+11108885
    })

    return newSessionId
```

The fork uses Node `createReadStream` / `createWriteStream` with a 448-byte buffer hint (bundle.js:+11109144) and a secondary 384-byte buffer (bundle.js:+11109354) for the write path. A readline interface (`TQq.createInterface`, bundle.js:+11109402) iterates over lines, re-mapping content with a `"content-replacement"` step (bundle.js:+11109739). If an error occurs during the file copy the implementation deletes the partially-written file (`_b8.unlink`, bundle.js:+11109522) and surfaces the originating error.

Analysis basis: CC v2.1.170 bundle.js:+11109051, +11109162, +11109308, +11109402, +11109739, +11109522

---

### Launch Forked Instance

```
async function launchFork(newSessionId):
    # Spawn a new CC process in "fork" mode
    childProcess = spawnNewProcess({
        mode:      "fork",               # literal bundle.js:+11112128
        sessionId: newSessionId
    })
    await attachProgressReporting(childProcess)
    return childProcess
```

After the transcript copy succeeds, the handler (`vQq`, bundle.js:+11112136) spawns a new process using the resident daemon/spawn infrastructure (`nQ.spawn`, bundle.js:+16531463) in `"fork"` mode (literal at bundle.js:+11112128). Progress events tagged `"progress"` (bundle.js:+11110296) are emitted to the parent UI during the launch.

The branch is marked with mode `"auto"` (bundle.js:+11111561) when no explicit UI disposition is provided.

Analysis basis: CC v2.1.170 bundle.js:+11112128, +11112136, +11111561

---

### Telemetry Emission

```
function emitBranchTelemetry(outcome):
    fire("tengu_conversation_forked", {
        sessionId:  newSessionId,
        timestamp:  Date.now()          # bundle.js:+11111697 (z.getTime / toISOString)
    })
```

The telemetry event `tengu_conversation_forked` is fired at bundle.js:+11111607 upon a successful fork, recording the ISO timestamp of the operation.

Analysis basis: CC v2.1.170 bundle.js:+11111607, +11111697

---

### Error Handling

If the conversation file does not exist, the ENOENT path is caught (literal `"ENOENT"` at bundle.js:+178023) and surfaces as `"Unknown error occurred"` (bundle.js:+11112276) after cleanup. The `model_refusal_fallback` string (bundle.js:+11110053) guards against model-level refusals within the copy pipeline.

Analysis basis: CC v2.1.170 bundle.js:+178023, +11112276, +11110053

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_conversation_forked` (bundle.js:+11111607); indirectly also `tengu_bg_dispatch_sigkill_escalate`, `tengu_daemon_config_reload`, `tengu_daemon_control`, `tengu_scheduled_task_missed`, `tengu_bg_low_mem_mb`, `tengu_bg_dispatch_low_mem`, `tengu_iron_gate_closed`, `tengu_bg_spare_enable`, `tengu_bg_sendclaim_failed`, `tengu_bg_state_read_transient`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_worktree_detection`, `tengu_session_renamed`, `tengu_agent_name_set`, `tengu_feature_bad`, `tengu_feature_ok` via daemon/session subsystems reached through the call graph |
| New session file created | Forked transcript written to a new path derived from a fresh `randomUUID` (bundle.js:+11109051); partially written file is unlinked on failure (bundle.js:+11109522) |
| New process spawned | A child Claude Code process is launched in `"fork"` mode (bundle.js:+11112128) via `nQ.spawn` (bundle.js:+16531463) |
| Progress events | `"progress"` events emitted to parent UI (bundle.js:+11110296) during copy |
| Session metadata rewritten | Session ID, title, and message type metadata patched inside the copied file (`"content-replacement"` pass, bundle.js:+11109739) |
| appState changes | The new branch session is registered in the roster (`_.rosterEntry`, bundle.js:+16537209); the parent session is not modified |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.170 | Initial analysis |

---

## Common Mistakes

1. **Running `/branch` with no active conversation** — the command immediately errors with `"No conversation to branch"` if no session is open. Start a conversation first.
2. **Running `/branch` on a freshly opened session with zero messages** — even with an active session, if no messages have been exchanged yet the command errors with `"No messages to branch"`.
3. **Supplying a branch name with special characters** — the name undergoes a replace-based sanitisation pass; characters that cannot appear in file paths will be normalised silently rather than rejected, so the resulting session title may differ from the input.
4. **Expecting the original session to be closed** — `/branch` does not terminate the parent session; both the original and the branch run independently after the fork.
5. **Expecting an instant response on large conversations** — the fork streams the full transcript through a readline interface; very large transcripts may take a moment before the child process is ready.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `l0f` | Main async handler for `/branch` (arbor_handler; `AsyncFunction`, resolved via `module_id → pqA`) |
| `vQq` | Primary fork orchestrator called from `l0f`; coordinates all sub-steps |
| `VQq` | File-copy and stream pipeline for the transcript snapshot |
| `ZQq` | Active-conversation finder; also performs branch-name sanitisation (calls `_.find`, `A.replace`) |
| `c0f` | Message-index processor; tracks line numbers during transcript copy |
| `XR` | Session-rename helper; writes `"custom-title"` metadata into the forked session file |
| `F3H` | Agent-name setter; writes `"agent-name"` metadata and emits `gzA` events |
| `fr` | Completion / file-context resolver called during fork pipeline |
| `M3H` | Worktree detection helper (calls `git worktree list --porcelain`) |
| `qJK` | File-system traversal and context builder used in the fork pipeline |
| `EpH` | Binary buffer packer used during content serialisation |
| `O$` | Session-store accessor called at fork startup |
| `e4` | Telemetry / event emitter initialisation helper |
| `N9` | Low-level event registration (`LTA.register`) |
| `zv` | String-escape utility (`H.replace` with `"\\$&"` pattern) |
| `f9` | String index/slice utility |
| `v6` | Session path builder |
| `xZ` | Path component utility |
| `W_` | Session working-directory resolver |
| `eN` | Session metadata builder (assembles path, role, message type) |
| `bM` | Message serialiser (`tR`, `p$`, `W_`, `BXH.join`, `v6`) |
| `tR` | Low-level path builder used by message serialiser |
| `hH` | Logging / telemetry buffer manager |
| `jA` | Error constructor wrapper |
| `_6` | String coercion utility |
| `hq` | Log accumulator helper |
| `ImA` | Log-entry formatter |
| `lN4` | Ring-buffer queue manager (shift/push) |
| `k8` | File-existence / error-code checker |
| `V8` | Low-level error-code extractor |
| `O` | Stream event handler (calls `S8` on data events) |
| `S8` | Stream chunk processor |
| `j` | Process lifecycle coordinator (calls `w`) |
| `w` | Background-session manager (spawn, claim, retire) |
| `d` | Shared utility / no-op / disposal helper (context-dependent) |
| `b` | Daemon session object (encapsulates all per-session state) |
| `IhH` | Session-file reader and parser |
| `Y` | Session write / supervisor coordinator |
| `N` | Message-type normaliser (toUpperCase, trim, classify) |
| `Xa` | Hook registration helper |
| `HsH` | Session directory initialiser (`mkdir`, `writeFile`) |
| `mX9` | Filtered message collector |
| `P` | Stream buffer assembler (Buffer.concat, indexOf, subarray) |
| `z` | Daemon control dispatcher (SH, xH, ih, ZU branches) |
| `S` | Session start coordinator |
| `X` | Timeout-guarded session setter |
| `c` | Process-map entry builder (`kb6`, `piq`) |
| `FpK` | Diff / change-summary formatter |
| `FAH` | Full-session archive builder |
| `o8` | Subprocess launcher with timeout and abort |
| `K` | Column formatter (`L.map`, `f.padEnd`) |
| `xH` | Feature-flag checker (`tengu_feature_bad` / `tengu_feature_ok`) |
| `K6` | Feature-flag record builder (`ff6`) |
| `SH` | Feature-flag reader (same shape as `xH`) |
| `dU8` | macOS memory monitor |
| `Y6` | Low-memory policy evaluator |
| `oW6` | Pinned-context loader (`pins.json`) |
| `Kk_` | Pin-file path builder |
| `Q6` | JSON parser wrapper |
| `crL` | Recursive directory reader for pinned contexts |
| `Q` | Retire-if-settled gate for background sessions |
| `lH6` | Iron-gate rule evaluator |
| `LQ` | Permission-policy resolver |
| `W2A` | Background-session claim sender (socket connection) |
| `cYA` | Session-state writer (`iQ.mkdir`, `iQ.writeFile`) |
| `dj5` | Claim-send timeout controller |
| `Qj5` | Claim-frame builder (`nQ.buildClaimFrame`) |
| `Qf` | Error-code extractor (thin wrapper over `V8`) |
| `EH` | String coercion to error message |
| `dV` | Binary frame serialiser (Buffer, writeUInt32BE, writeUInt8) |
| `v2A` | Background-session lifecycle manager |
| `sK` | Session working-path builder |
| `Wq` | Session-state file reader / watcher |
| `MO` | Active-state marker |
| `hjH` | Tool-permission list builder |
| `Sf` | Session-folder setup helper |
| `$K6` | Async-task dispatcher with Date.now timing |
| `xb6` | Session-ID path joiner |
| `z$H` | Metadata file locator (`TmH`) |
| `qZ` | Session-split path resolver |
| `VQ` | Session-variant path builder |
| `bb6` | Base session path builder |
| `D` | Forced-shutdown handler (`process.exit`, `z.abort`) |
| `Qj` | Shutdown-reason recorder |
| `F` | Disposable resource handle |
| `J` | Process-kill iterator (`A.values`, `S.kill`) |
| `Bp` | Duplicate-session guard |
| `$` | Destroy-on-close wrapper (`f$K`) |
| `f$K` | Daemon status file writer (`daemon.status.json`) |
| `m9` | AsyncLocalStorage store accessor (`JCL.getStore`) |
| `hu6` | Status-file path builder |
| `CH` | JSON serialiser wrapper |
| `G` | SDK/HTTP/SSE connection builder |
| `V76` | Transport-type selector |
| `Vy` | Session metadata value extractor |
| `U3` | Context-limit enforcer |
| `a$H` | Log-file appender (`appendFileSync`, `mkdirSync`) |
| `n6` | Path normaliser |
| `Qc` | Conversation-file read/write coordinator |
| `jw6` | Conversation JSON file manager |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.