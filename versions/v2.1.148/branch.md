---
type: feature-spec
feature: "branch"
cc_version: "2.1.148"
updated: "2026-06-01"
tags: ["branch", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.148 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/branch`

> Analysis basis: CC v2.1.148 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.148

---

## Overview

`/branch` (alias: `/fork`) creates a divergent copy of the current conversation at its current point in history, launching a new independent session that starts from the same message context. It achieves this by copying the conversation transcript into a new session file and then opening that session, leaving the original conversation intact.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `branch` |
| description | `Create a branch of the current conversation at this point` |
| argumentHint | `[name]` |
| aliases | `["fork"]` |
| module_id | `OU_` |
| load_inline | `true` |
| loc_byte | `11952425` |
| loc_byte_end | `11952619` |
| loc_line | `9817` |
| arbor_handler.name | `fT7` |
| arbor_handler.fqn | `claude-2.1.148::fT7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.148 bundle.js:+11952425

---

## Input Branching

The command has 4+ distinct execution paths depending on whether a custom branch name was supplied, whether a conversation history exists, and whether messages are present. A Mermaid flowchart is required.

```mermaid
flowchart TD
    A["/branch [name] invoked"] --> B{Current conversation\nexists?}
    B -- No --> ERR1["Error: 'No conversation to branch'\n(bundle.js:+10484035)"]
    B -- Yes --> C{Messages present\nin history?}
    C -- No --> ERR2["Error: 'No messages to branch'\n(bundle.js:+10485056)"]
    C -- Yes --> D["Generate new session ID\nvia randomUUID()\n(bundle.js:+10483827)"]
    D --> E{Optional [name]\nargument provided?}
    E -- No --> F["Auto-generate title\n'Branched conversation'\n(bundle.js:+10483588)"]
    E -- Yes --> G["Sanitize supplied name\nvia replace()\n(bundle.js:+10483718)"]
    F --> H["Resolve output paths:\n- session directory (XM)\n- worktree paths (JV)\n(bundle.js:+10483853–10483864)"]
    G --> H
    H --> I["mkdir for new session dir\n(bundle.js:+10483889)"]
    I --> J["Create read stream from\nexisting transcript file\n(bundle.js:+10483938)"]
    J --> K["Pipe transcript content\nto new session file\n(bundle.js:+10484084)"]
    K --> L["Emit 'fork' event\nto mark branch point\n(bundle.js:+10486806)"]
    L --> M["Fire tengu_conversation_forked\ntelemetry\n(bundle.js:+10486285)"]
    M --> N["Open branched session\nand resume stream\n(bundle.js:+10486793)"]
    N --> Z["Branch session live\n— original unchanged"]
```

---

## Behavioral Spec

### Handler Entry Point

The primary handler is `fT7` (resolved via `module_id → OU_`, Arbor path: `module_id`). It is an `AsyncFunction`. The call graph roots at `fT7 → g$1`.

Analysis basis: CC v2.1.148 bundle.js:+10487070

### Sub-feature: Conversation Existence Guard

```
async function branchCommandHandler(context, args):
    conversation = lookupCurrentConversation(context)   // B$1 → _.find
    if conversation is null or undefined:
        throw new Error("No conversation to branch")    // +10484035
```

The command calls into `B$1` which uses `_.find` to locate the active conversation object. If none is found, the string literal `"No conversation to branch"` is emitted and execution halts.

Analysis basis: CC v2.1.148 bundle.js:+10484035

### Sub-feature: Message Presence Guard

```
    messages = conversation.messages
    if messages is empty or absent:
        report("No messages to branch")                // +10485056
        return
```

Even when a conversation object exists, if the message array is empty the command reports the literal `"No messages to branch"` and returns without creating any new session.

Analysis basis: CC v2.1.148 bundle.js:+10485056

### Sub-feature: Branch Name Resolution

```
    rawName = args[0] ?? null
    if rawName is provided:
        branchTitle = sanitizeName(rawName)            // A.replace +10483718
    else:
        branchTitle = "Branched conversation"          // +10483588
```

The optional `[name]` argument is accepted. When absent, the default title `"Branched conversation"` is used. When present, it is sanitized via a `replace()` call to strip or normalise problematic characters.

Analysis basis: CC v2.1.148 bundle.js:+10483588, +10483718

### Sub-feature: New Session ID and Path Construction

```
    newSessionId = crypto.randomUUID()                 // m$1.randomUUID +10483827
    sessionDir   = resolveSessionDirectory(            // XM +10483878
                       h6, AO, w_, pathJoin)
    worktreePath = resolveWorktreePath(JV)             // JV +10483864
    mkdir(sessionDir, { recursive: true })             // CP8.mkdir +10483889
```

A UUID is generated for the branch session. `XM` constructs the session directory path by combining base project path components (`h6`, `AO`, `w_`) and joining them. `JV` handles worktree-aware path calculation. The directory is created with `mkdir`.

Analysis basis: CC v2.1.148 bundle.js:+10483827, +10483853, +10483864, +10483889

### Sub-feature: Transcript Copy Pipeline

```
    readStream  = fs.createReadStream(sourceTranscript)   // RP8.createReadStream +10483938
    writeStream = fs.createWriteStream(destTranscript,    // RP8.createWriteStream +10484084
                      { encoding: "utf8" })               // +10483971
    readStream.pipe(writeStream)
    await stream.finished(writeStream)                    // U$1.finished +10485466
```

The existing conversation transcript is streamed (not loaded entirely into memory) to the new session file. The `"utf8"` encoding literal is applied to the write stream. Buffer size `448` bytes is used internally during the pipe. A `"drain"` event is handled for back-pressure management.

Analysis basis: CC v2.1.148 bundle.js:+10483938, +10483971, +10483920, +10484395, +10485466

### Sub-feature: Content-Replacement Tagging

After the copy, the branch record is tagged with a `"content-replacement"` marker, allowing downstream rendering to distinguish the forked transcript from an organic conversation.

Analysis basis: CC v2.1.148 bundle.js:+10484515

### Sub-feature: Fork Event and Title Persistence

```
    emitForkEvent(newSessionId, branchTitle)    // "fork" literal +10486806
    persistTitle(newSessionId, branchTitle)     // cx path: lZ6.emit +12636943
    emitTelemetry("tengu_conversation_forked")  // +10486285
```

A `"fork"` event is emitted to mark the relationship between the parent and child sessions. The branch title is persisted via `cx` / `lZ6.emit`, which also fires the `tengu_session_renamed` telemetry event when a custom title is stored. The primary fork telemetry event `tengu_conversation_forked` is always emitted on success.

Analysis basis: CC v2.1.148 bundle.js:+10486806, +10486285

### Sub-feature: Session Open and Stream Resume

```
    openSession(newSessionId)      // g$1 flow → F$1
    resumeInputStream(context)     // H.resume +10486793
    disposeOldContext(context, "_") // _ +10486814
```

After the file copy completes, `g$1` opens the new branch session (invoking `F$1` which sets up the full PTY / IPC machinery). The original input stream is resumed and any previous context references are released.

Analysis basis: CC v2.1.148 bundle.js:+10486089, +10486793, +10486814

### Sub-feature: Error Handling

```
    try:
        ... (copy pipeline)
    catch error:
        logError(error)         // Gl.logError via RH +10484070
        reportError(error)      // RH → n_ → bbH.push
        return
    finally:
        closeStream(readStream) // O.destroy +10484280
        unlinkTempFile(...)     // CP8.unlink +10484298
```

Errors during the copy are routed through `RH`, which normalises them via `n_` and pushes them onto the error display buffer. Temporary files created during the operation are cleaned up in all exit paths.

Analysis basis: CC v2.1.148 bundle.js:+10484070, +10484280, +10484298

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_conversation_forked` (+10486285) — emitted on every successful branch; `tengu_session_renamed` (+12636956) — emitted when a custom branch title is stored; `tengu_agent_name_set` (+12639985) — emitted if a branch name sets an agent identity |
| File system | New session directory created under project sessions root; transcript copied via streaming pipe; temp files cleaned up on error |
| Session state | New session ID registered in session roster; parent session remains open and unmodified |
| Fork relationship | `"fork"` event emitted linking child session ID to parent; `"content-replacement"` tag applied to branch transcript |
| Input stream | Parent input stream is resumed (`H.resume`) after branch open completes |
| appState changes | New session entry added to session map; branch title stored under new session ID |
| Hook interactions | None directly triggered by `/branch` itself; the new session will fire normal `SessionStart` hooks when it initialises |
| Sound | None observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.148 | Initial analysis |

---

## Common Mistakes

1. **Running `/branch` with no active conversation** — If Claude Code is not currently in a conversation session, the command will immediately fail with `"No conversation to branch"`. Start or resume a conversation first.
2. **Running `/branch` before any messages exist** — Even with a conversation open, invoking `/branch` before any messages have been exchanged produces `"No messages to branch"`. At least one message turn must be present.
3. **Expecting the original session to be replaced** — `/branch` creates an entirely new parallel session. The original session continues to exist unchanged; users must explicitly switch to the branch to continue there.
4. **Providing special characters in the branch name** — The `[name]` argument is sanitised by a `replace()` call. Characters that are invalid in file paths or session titles may be stripped silently; use plain alphanumeric names for predictable results.
5. **Confusing `/branch` with `/fork`** — Both names invoke the identical handler; they are registered as aliases of each other. There is no behavioural difference between them.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `fT7` | Primary async handler for `/branch` (Arbor-resolved, `module_id` path) |
| `g$1` | Branch orchestrator — top-level function called by `fT7`; drives the full copy-and-open flow |
| `F$1` | Session file setup function — creates read/write streams, pipes transcript, manages PTY handoff |
| `B$1` | Conversation lookup helper — uses `_.find` to resolve the active conversation object |
| `MT7` | Title/name deduplication helper — tracks used branch names, calls `parseInt` for numeric suffixes |
| `cx` | Title persistence emitter — stores custom session title and emits `lZ6.emit` |
| `bLH` | Agent-name setter — persists branch identity and fires `Ir_.emit` |
| `CO` | Session registry lookup helper used during open phase |
| `v4` | Session record constructor |
| `r9` | Session registration call (`D9A.register`) |
| `rd` | Worktree detection utility — parses `git worktree --porcelain` output |
| `uyH` | Git worktree list parser — splits output, filters worktree entries |
| `vU1` | Path completion/tab-completion helper for branch name argument |
| `KhH` | Binary buffer builder for worktree data |
| `hf` | Worktree cache lookup helper |
| `uu` | String escape helper — applies `replace()` for safe name embedding |
| `Uq` | Slice-by-index string utility |
| `dF` | Session file writer — delegates to `jL6` for atomic read-modify-write |
| `jL6` | Atomic file update helper — reads, transforms, and writes session JSON |
| `XM` | Session directory path resolver — joins base components |
| `JV` | Worktree-aware path builder |
| `RH` | Error normaliser and display pipeline entry point |
| `n_` | Low-level error coercion (wraps in `Error`, coerces via `String`) |
| `J8` | Error classification / ENOENT handler |
| `q8` | Async retry / promise utility |
| `ZH` | String coercion wrapper |
| `CH` | JSON serialiser wrapper (`JSON.stringify`) |
| `B6` | JSON parser wrapper (`JSON.parse`) |
| `oV` | Base path / home-directory resolver |
| `h6` | Project root path accessor |
| `w_` | Sessions subdirectory path builder |
| `AO` | Additional path component accessor |
| `sy` | Path utility — calls `oV` for base resolution |
| `zR` | Supplementary path resolver |
| `S6A` | Session lifecycle manager — handles full session create/destroy cycle including roster and file cleanup |
| `v6A` | Background session claim sender — connects via IPC and sends claim frame |
| `sw5` | Claim frame builder (`KB.buildClaimFrame`) |
| `tw5` | Claim send timeout enforcer (5000 ms timeout literal at +15099107) |
| `bU` | Binary frame encoder — builds `Buffer` with `writeUInt32BE` / `writeUInt8` |
| `So_` | Session metadata writer — calls `D_H.writeFile` with `JSON.stringify` |
| `zT6` | Session path joiner — `Y$.join` + `MF_` |
| `RK` | Session file path resolver — `jX.join` + `wG` |
| `dq` | Session state file loader — reads and caches session JSON with `hOH` |
| `bw` | Session active-state setter — calls `TZ` with `"active"` |
| `h5` | Session directory initialiser — calls `ez`, `jX.join`, `CH`, `Cw` |
| `gsH` | Session start metrics recorder — measures elapsed time and calls `qI7` |
| `QLH` | Session queue path resolver |
| `Ny` | Session name file path builder with split |
| `UU` | Session UUID / fingerprint builder |
| `Y` | Session render/display controller — manages PTY writer and spinner lifecycle |
| `D` | Session cleanup and re-spawn decision function |
| `V6A` | Background worker spawn function — calls `Bun.spawn` with `--bg-pty-host` args |
| `w` | Background session dispatch function — core IPC coordination loop |
| `C` | Session process supervisor — calls `SfK`, `Az`, `N`, `RH`, `Nj5` |
| `N` | Process environment / shell invocation builder |
| `j` | Running session iterator — kills all via `y.kill` |
| `y` | Individual session kill handler |
| `g` | Session retirement checker (`retireIfSettled`) |
| `oH` | Orphaned-permission filter |
| `vH` | Permission validation set |
| `sG8` | Memory monitor — checks `R6A.freemem` against `1024` MB threshold |
| `V6` | Memory pressure decision — reads `V$H`, calls `As6` / `x6` |
| `T$6` | Pinned-file loader — reads `pins.json` and scans session directories |
| `v9L` | Recursive session directory scanner |
| `M$_` | `pins.json` path builder |
| `W` | Notification/event debouncer — manages `setTimeout` / `clearTimeout` cycle |
| `qzH` | Notification dispatcher — routes to `hL` and `e2` |
| `hL` | Notification renderer / display builder |
| `e2` | Full agent execution runner — the main agent turn loop |
| `fj5` | PTY/IPC frame dispatcher — core message multiplexer between supervisor and worker |
| `P` | IPC socket reader — assembles frames from `Buffer` chunks |
| `KM` | Frame encoder — `H.end` + `CH` |
| `LfK` | Frame dispatch with timeout — enforces 30 000 ms round-trip deadline |
| `Mj5` | Session re-attach helper — handles respawn / resume states |
| `Lj5` | Viewport size calculator — `V6` + `Math.max` |
| `I` | Away-summary generator — checks cache staleness and rate limits |
| `VY8` | App state accessor for away-summary gate |
| `xM5` | Away-summary cache state reader |
| `w18` | Away-summary API call — builds `AbortController`, fires request, handles `FW` / `G8` |
| `sM1` | UUID generator for away-summary request (`wV.randomUUID`) |
| `B` | Message slice accessor — `.at` / `.slice` on conversation history |
| `o` | Voice/input session manager — recording, WebSocket stream, transcription |
| `l` | Input filter — `o.filter` on pending inputs |
| `t` | Toggle-mode input handler |
| `e` | Focus-mode input handler |
| `i` | Shared input routing helper |
| `d` | Input teardown helper (`Ta_`) |
| `p` | Idle-exit timer — `setTimeout` / `clearTimeout` + `z.write` |
| `Q` | Timeout scheduler with `LT6` / `Rw1` |
| `G` | Repaint trigger — `F06` + `YN8` |
| `X` | Full repaint orchestrator — `jy`, `PU`, `Promise.all`, `VLH`, `Ti`, `RH`, `n_` |
| `f` | MCP state reconciler — reads `L`, calls `EkH` and `k7K` |
| `EkH` | MCP server connection initialiser — iterates entries, spawns connections |
| `k7K` | MCP update applier — `H.applyMcpUpdate`, `kJ8`, `A.cleanup`, `sN`, `nj` |
| `_D5` | MCP retry coordinator — filters servers, calls `EkH` / `k7K` |
| `HY` | Background service state reader — `v$H` → `V6` |
| `v$H` | Background service status accessor |
| `k6A` | Frame sequence / lease ID generator |
| `r8` | Promise-with-timeout utility — `setTimeout` / `clearTimeout` + `L.unref` |
| `KN6` | IPC channel writer — `H.destroy` / `H.write` / `CH` |
| `WT` | Working-tree path builder — `FbH.join` + `$v` + `Lz` |
| `G$` | Real-path resolver — `ru.realpath` + `H.normalize` |
| `RMH` | File-based conversation reader — opens file, creates readline interface, streams lines |
| `Lz` | Path slice/replace utility |
| `$v` | Projects subdirectory path helper |
| `Ta_` | Input teardown implementation |
| `CO` | Session registry entry retriever |
| `I7H` | Transcript append-sync writer — `A.appendFileSync` + `A.mkdirSync` |
| `F6` | Transcript file path accessor |
| `Z2` | Effort / model capability resolver |
| `EZ` | Effort-level mapper (`"high"` literal) |
| `Ah` | oV-based path helper |
| `b6` | Model name builder — `sb6` + `w_` |
| `Qm` | Policy settings reader (`"policySettings"`) |
| `k7H` | Hook key builder — `h_` + `S7` |
| `Ho_` | Hook plugin/skill dispatcher — routes `PreToolUse`, `PostToolUse`, etc. |
| `FB1` | Hook filter helper |
| `er_` | Third-party hook filter — `H.filter` + `_E8` |
| `QB1` | Hook queue builder |
| `C2H` | Hook output formatter — `ub6` |
| `iZ` | Abort-controller timeout wrapper |
| `Y_H` | Hook result normaliser |
| `SV` | Hook serialiser |
| `oT8` | Hook async handler — `SV`, `UQ_`, `BQ_`, `N` |
| `ar_` | MCP tool hook runner — `vXH`, `N`, `M.find`, `Ws7`, `iZ` |
| `eT8` | Hook output text parser — handles plain-text vs JSON output |
| `O8H` | Hook parameter transformer — `Object.entries` / `Object.fromEntries` / `A4` |
| `or_` | HTTP hook executor — `Js7`, `pD6`, `k_.post`, `ZH` |
| `BB1` | HTTP hook response parser |
| `HE8` | Shell command hook executor — spawns subprocess, handles env vars, streams output |
| `WNH` | Hook watch-path registrar |
| `pgH` | Pending-hook presence checker |
| `qo` | Skills/index cache manager — `gHH`, `Vw8`, `gA1`, `tw8` |
| `gHH` | Skill index loader — `Promise.resolve`, `FF_`, `H.clearSkillIndexCache` |
| `_kH` | Skill index cache clearer — `Pw8.clear` |
| `SfK` | Process identity verifier — `NN8.realpath` + `NN8.stat` + `J8` |
| `Az` | Process argument builder |
| `Nj5` | Process log path builder — `LY8` |
| `z` | PTY write channel — `bH`, `mH`, `Pk`, `Ou` |
| `mH` | PTY write implementation — calls `c` |
| `bH` | PTY buffer flush — calls `c` |
| `FpK` | Telemetry queue rotator — `lb6.shift` / `lb6.push` |
| `j1` | Telemetry batch dispatcher — `XwA` |
| `XwA` | Telemetry HTTP sender — `UH` |
| `UH` | HTTP response string coercer |
| `Uq` | String slice-by-delimiter utility |