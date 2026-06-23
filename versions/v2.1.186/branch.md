---
type: feature-spec
feature: "branch"
cc_version: "2.1.186"
updated: "2026-06-23"
tags: ["branch", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.186 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/branch`

> Analysis basis: CC v2.1.186 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.186

---

## Overview

The `/branch` command creates a divergent copy of the current conversation at the point it is invoked, preserving the message history up to that point in a new session. It accepts an optional name argument, generates a fresh session identifier, copies the conversation transcript via a streaming read/write pipeline, and then opens the new branched session in the foreground. A `tengu_conversation_forked` telemetry event is emitted on success.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `branch` |
| description | `Create a branch of the current conversation at this point` |
| argumentHint | `[name]` |
| module_id | `YAo` |
| load_inline | `true` |
| loc_byte | `12638177` |
| loc_byte_end | `12638354` |
| loc_line | `8558` |
| arbor_handler.name | `mYp` |
| arbor_handler.fqn | `claude-2.1.186::mYp` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.186 bundle.js:+12638177

---

## Input Branching

The command has four or more distinct paths depending on session state and message availability, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/branch [name] invoked"] --> B{Active conversation\nexists?}
    B -- No --> C["Error: 'No conversation to branch'\n(bundle.js:+11234618)"]
    B -- Yes --> D{Messages present\nin conversation?}
    D -- No --> E["Error: 'No messages to branch'\n(bundle.js:+11235737)"]
    D -- Yes --> F[Sanitize optional name argument\nvia nameSlugifier]
    F --> G[Generate new UUID for branched session\n(bundle.js:+11234410)]
    G --> H[Resolve paths: source transcript\nand destination directory]
    H --> I[mkdir for destination\n(bundle.js:+11234472)]
    I --> J[Stream-copy transcript file\nvia createReadStream → createWriteStream\n(bundle.js:+11234521, +11234667)]
    J --> K{Stream completed\nsuccessfully?}
    K -- Error --> L[Unlink partial destination file\n(bundle.js:+11234881)\nLog error and surface to UI]
    K -- Yes --> M[Attach forked session to worktree context\n(bundle.js:+11237487)]
    M --> N[Emit tengu_conversation_forked\n(bundle.js:+11236966)]
    N --> O[Transition UI to new branched session]
    O --> P["Display 'Branched conversation' label\n(bundle.js:+11234171)"]
```

---

## Behavioral Spec

### Main Handler — `branchCommandHandler` (bundle identifier: `mYp`)

The Arbor-resolved handler is `mYp` (AsyncFunction), reached via `module_id` resolution from module `YAo`.

```
async function branchCommandHandler(commandInput, appContext):
    // Step 1: Resolve active conversation
    session = resolveCurrentSession(appContext)
    if session is null:
        return errorResult("No conversation to branch")

    // Step 2: Guard on message presence
    messages = session.messages
    if messages is empty:
        return errorResult("No messages to branch")

    // Step 3: Sanitize branch name
    rawName = commandInput.args[0] ?? "Branched conversation"
    branchName = sanitizeName(rawName)   // toLowerCase, slug-safe replace

    // Step 4: Generate fresh identity
    newSessionId = crypto.randomUUID()

    // Step 5: Resolve filesystem paths
    srcPath  = resolveTranscriptPath(session)
    destDir  = resolveDestDir(newSessionId)
    destPath = path.join(destDir, transcriptFileName)

    // Step 6: Prepare destination
    await fs.mkdir(destDir, { recursive: true })

    // Step 7: Copy transcript via streaming pipeline
    try:
        readStream  = fs.createReadStream(srcPath, { encoding: "utf8", flags: "open" })
        writeStream = fs.createWriteStream(destPath)
        await pipeline(readStream, writeStream)
    catch err:
        await fs.unlink(destPath)   // clean up partial file
        logError(err)
        return errorResult(err.message ?? "Unknown error occurred")

    // Step 8: Attach to worktree / fork context
    attachSessionToWorktree(newSessionId, appContext, type="fork")

    // Step 9: Emit telemetry
    emitEvent("tengu_conversation_forked")

    // Step 10: Transition UI
    openSession(newSessionId, label="Branched conversation")
```

Analysis basis: CC v2.1.186 bundle.js:+11237770 (entry `mYp → Vul`)

---

### Session Orchestrator — `sessionOrchestrator` (bundle identifier: `Vul`)

`Vul` is the immediate callee of `mYp`. It coordinates the full fork lifecycle.

```
async function sessionOrchestrator(forkArgs, appContext):
    // Build runtime context
    runtimeCtx = buildRuntimeContext()          // Rt, ch → Oc → Ai
    queuedPipeline = buildTranscriptPipeline()  // qul

    // Resolve and sanitize branch name
    sanitizedName = sanitizeBranchName(forkArgs.name)  // Wul
    worktreeList  = listWorktrees(appContext)            // l.find, fYp

    // Set up logging
    setupTranscriptLog()  // o6, tEe

    // Execute agent rename / session label
    applySessionLabel(sanitizedName)  // eWe (emits tengu_agent_name_set)

    // Mark fork type
    setForkMetadata(type="fork", timestamp=Date.now())  // u.toISOString, u.getTime

    // Resume event stream and open final session
    resumeEventStream()  // e.resume
    loadSessionState()   // Oie, JE
    finalizeTransition(forkArgs)  // t
```

Analysis basis: CC v2.1.186 bundle.js:+11236662

---

### Transcript Pipeline — `transcriptPipeline` (bundle identifier: `qul`)

Handles the low-level file copy and progress reporting.

```
async function transcriptPipeline(srcPath, destPath, messages):
    newId = crypto.randomUUID()             // $ul.randomUUID
    buildContext(Rt, Hg, gr)
    resolveOutputPaths(hR, Of)

    await fs.mkdir(destDir, { recursive: true })

    readStream = fs.createReadStream(srcPath, {
        encoding : "utf8",
        flags    : "open",
        highWaterMark: 448                  // bundle.js:+11234503
    })

    // Event: first data chunk received
    readStream.once("open", onOpen)         // jAo.once, bundle.js:+11234569

    // Error handling callback
    readStream.on("error", onReadError)     // Re → ao, Ki, Pnu

    writeStream = fs.createWriteStream(destPath, {
        highWaterMark: 384                  // bundle.js:+11234713
    })

    // Progress throttle: report every 100 messages
    progressInterval = 100                  // bundle.js:+11234338

    // Stream data with back-pressure drain handling
    readStream.on("data", chunk => {
        if not writeStream.write(chunk):
            readStream.pause()
            writeStream.once("drain", () => readStream.resume())
    })

    // On stream completion
    readStream.on("end", async () => {
        // Finalize write
        writeStream.end()
        await streamFinished(writeStream)  // Gul.finished

        // Inject content-replacement marker
        injectContentReplacement(writeStream)   // literal "content-replacement", bundle.js:+11235098

        // Report progress
        emitProgressUpdate()    // "progress", bundle.js:+11235655

        // Handle model-refusal fallback case
        handleRefusalFallback() // "model_refusal_fallback", bundle.js:+11235412
    })

    // Cleanup on failure
    on error:
        writeStream.destroy()
        readStream.destroy()
        await fs.unlink(destPath)
        // Report via "No conversation to branch" or "No messages to branch"
```

Analysis basis: CC v2.1.186 bundle.js:+11234410

---

### Branch Name Sanitizer — `sanitizeBranchName` (bundle identifier: `Wul`)

```
function sanitizeBranchName(rawInput):
    // Locate known separator tokens
    found = tokenList.find(token => rawInput includes token)   // t.find
    // Replace unsafe characters with slug-safe equivalents
    sanitized = rawInput.replace(unsafePattern, replacement)   // n.replace
    return sanitized
```

Analysis basis: CC v2.1.186 bundle.js:+11234223

---

### Worktree Resolution — `worktreeResolver` (bundle identifier: `fYp`)

Called by `Vul` to determine the Git worktree context for the branched session.

```
async function worktreeResolver(sessionCtx):
    // Run: git worktree list --porcelain
    rawOutput = await runGitWorktree(["worktree", "list", "--porcelain"])
    // Parse "worktree " prefix lines (length prefix 9, bundle.js:+8552412)
    entries = parseWorktreeOutput(rawOutput)

    // Collect seen paths, detect auto vs explicit
    seenIds = new Set()
    for entry of entries:
        mode = "auto"   // bundle.js:+11236920
        trackId(seenIds, parseInt(entry.id))
        seenIds.add(entry.id)
    return entries
```

Analysis basis: CC v2.1.186 bundle.js:+11236339 (`WY` → worktree list/parse pipeline, `tengu_worktree_detection` event at bundle.js:+8552259)

---

### Session State Write-Back — `sessionStateWriter` (bundle identifier: `KBo`)

After the transcript is copied, `KBo` persists the new session's state to disk and updates in-memory structures.

```
async function sessionStateWriter(newSessionId, forkMeta):
    // Build roster entry
    rosterEntry = buildRosterEntry(newSessionId, forkMeta)  // t.rosterEntry

    // Write session directory structure via JWt, QWt, dye, nN helpers
    baseDir  = path.join(sessionsRoot, XWt(newSessionId))
    await fs.mkdir(baseDir, { recursive: true })

    await fs.writeFile(path.join(baseDir, "daemon.status.json"),
                       JSON.stringify(statusPayload))

    // Register with active session map
    activeSessionMap.set(newSessionId, rosterEntry)

    // Schedule cleanup timeout (300 000 ms = 5 min, bundle.js:+17165531)
    setTimeout(cleanupEntry, 300000)

    // Persist state
    persistState(newSessionId)  // Kt, dye, yR, rM
```

Analysis basis: CC v2.1.186 bundle.js:+17163682

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_conversation_forked` | Emitted on successful fork (bundle.js:+11236966) |
| Telemetry: `tengu_worktree_detection` | Emitted during Git worktree enumeration (bundle.js:+8552259) |
| Telemetry: `tengu_agent_name_set` | Emitted if session agent name is updated (bundle.js:+13371160) |
| Telemetry: `tengu_session_renamed` | Emitted when the session title changes (bundle.js:+13367623) |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | May fire if background session cleanup requires SIGKILL (bundle.js:+17157626) |
| Telemetry: `tengu_daemon_config_reload` | Daemon config refreshed on session state changes (bundle.js:+17173497) |
| Telemetry: `tengu_daemon_control` | Daemon lifecycle event (bundle.js:+17194642) |
| Telemetry: `tengu_scheduled_task_missed` | Background scheduler watchdog (bundle.js:+16616739) |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` | Feature flag probe results (bundle.js:+1024705, +1024772) |
| Telemetry: `tengu_bg_*` (multiple) | Background session management signals (various loc_bytes) |
| Filesystem: transcript copy | Reads source via `createReadStream` (highWaterMark 448, bundle.js:+11234503); writes via `createWriteStream` (highWaterMark 384, bundle.js:+11234713) |
| Filesystem: session directory | New session directory created under `.claude` hierarchy (bundle.js:+4918418); `daemon.status.json` written (bundle.js:+12892849) |
| Filesystem: partial-file cleanup | On copy error, `fs.unlink` removes incomplete destination file (bundle.js:+11234881) |
| appState changes | Active session map updated with new branched session entry; roster entry created |
| Session ID | New UUID generated via `crypto.randomUUID()` (bundle.js:+11234410) |
| Fork type marker | Written as `"fork"` (bundle.js:+11237487) |
| Branched session label | Defaults to `"Branched conversation"` when no name is supplied (bundle.js:+11234171) |
| Cleanup timeout | 300 000 ms (5 minutes) for stale session removal (bundle.js:+17165531) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.186 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/branch` before any messages exist** — the command emits `"No messages to branch"` (bundle.js:+11235737) and aborts. Ensure at least one exchange has occurred in the current session first.
2. **Invoking `/branch` with no active conversation** — yields `"No conversation to branch"` (bundle.js:+11234618). The command requires an ongoing session context with a resolvable transcript file.
3. **Supplying a name with special characters** — the name argument is slugified (lowercased and unsafe characters replaced). The final branch name may differ from the literal string provided; review the UI label after branching.
4. **Expecting the original session to be replaced** — `/branch` opens a *new* session; the original remains intact. Both the source and branched sessions coexist independently after the command completes.
5. **Confusing `/branch` with Git branching** — while the command respects Git worktree context (it enumerates worktrees via `git worktree list --porcelain`), it does not create a Git branch. It branches the *conversation*, not the repository.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `mYp` | Main async handler for `/branch` (Arbor-resolved entry point) |
| `Vul` | Session orchestrator; coordinates the full fork lifecycle |
| `qul` | Transcript streaming pipeline (read → write with back-pressure) |
| `Wul` | Branch name sanitizer (token find + character replace) |
| `fYp` | Worktree resolver (enumerates Git worktrees, parses `--porcelain` output) |
| `WY` | Worktree list parser and cache manager |
| `FHe` | Worktree entry parser (splits lines, detects worktree prefix) |
| `r9l` | File system directory scanner used during worktree resolution |
| `KBo` | Session state writer; persists new session directory and roster entry |
| `Oie` | Session state loader for branched session initialization |
| `o6` | Session log/title writer (emits `tengu_session_renamed`) |
| `eWe` | Agent name setter (emits `tengu_agent_name_set`) |
| `tEe` | Transcript log appender (appendFileSync, mkdirSync) |
| `QB` | Base session context builder |
| `JE` | Session basename resolver |
| `Oi` | File watch/cache manager for session files |
| `ec` | Path builder utility (joins base dir) |
| `kd` | Session directory descriptor builder |
| `jmt` | Session dispatch helper with timestamp tracking |
| `QWt` | Session path writer helper (Wh.join + XWt) |
| `JWt` | Session directory creator (Wh.join + XWt) |
| `dye` | Daemon roster update helper |
| `nN` | Daemon session registration (RIo + path join) |
| `yR` | Session resume signal helper |
| `rM` | Late-resume signal helper |
| `MOo` | Daemon session writer (mkdir + writeFile + JSON.stringify) |
| `pYf` | Send-claim timeout handler (5 000 ms, bundle.js:+17134339) |
| `dYf` | Claim frame builder |
| `$Bo` | Background session claim logic (socket connect + auth) |
| `gR` | Binary frame encoder (Buffer alloc + writeUInt32BE + writeUInt8) |
| `Jd` | Logger/notification helper |
| `Ae` | String coercion utility |
| `Rt` | Runtime context accessor |
| `GL` | Global state map |
| `gr` | Global registry accessor |
| `hR` | Session metadata resolver (user/assistant/attachment/system roles) |
| `gP` | Session profile loader |
| `Of` | Output path resolver (joins Dwe paths) |
| `T$` | Path utility (GL-backed) |
| `kn` | Error classification helper |
| `mn` | Low-level logger / console emitter |
| `Re` | Error reporter (ao, ot, Ki, Pnu, VJ.logError chain) |
| `ao` | Error constructor wrapper |
| `ot` | String coercer |
| `Ki` | Error queue inserter |
| `ins` | Error formatter |
| `Pnu` | Ring-buffer error log (shift + push) |
| `ch` | Capability checker (Rt → Oc) |
| `Oc` | Capability registry |
| `Ai` | Capability registrar (O5o.register) |
| `fi` | String slicer utility (indexOf + slice) |
| `fw` | Regex escape utility (e.replace) |
| `dh` | Directory history/cache helper |
| `nqe` | Buffer allocation helper (alloc + push) |
| `D` | Background worker / daemon process manager |
| `grt` | Transcript file reader (readFile + zhe + Re + De + s1) |
| `d` | Daemon IPC writer (supervisor channel) |
| `T` | Token/model name formatter (toUpperCase, trim, Lc, XP, eze, Fvc) |
| `_Q` | Configuration reader (Cfe) |
| `NPt` | Conversation state persister (mkdir + writeFile in .claude) |
| `PBi` | Message filter with timestamp (hrt) |
| `H` | Byte-stream frame reader (Buffer.concat, subarray, bYf, Ae) |
| `u` | Daemon stop controller (ke, xe, gU, j6) |
| `x` | File change detector (mtime changed, Tyc, ip, GYf, d.write) |
| `g` | Session timeout scheduler (r.setTimeout) |
| `Mdc` | Column/layout renderer (kD, Math.max, r.join) |
| `uae` | Conversation archive writer (QV, grt, NPt) |
| `Bn` | Timeout/abort controller (setTimeout, clearTimeout, s.unref) |
| `o` | Row formatter (s.map + i.padEnd) |
| `xe` | Feature-ok reporter (W, Pe → KVe) |
| `Pe` | Feature flag lookup (KVe) |
| `ke` | Feature-ok emitter (W, Pe) |
| `IXn` | macOS low-memory watcher (Kt, it) |
| `it` | Memory monitor (ORt, NRt, $9, OIe, JEn, DRt, TW, wt) |
| `D2e` | Pins file reader (hb.lstat, hb.rm, hb.readFile, YTd) |
| `dDt` | Pins path builder (ay.join, Wk) |
| `Bt` | JSON parser wrapper |
| `YTd` | Directory lstat walker (readdir, lstat, isDirectory, isFile, KOi) |
| `N` | Permission manager (Zut, J5 — allow/deny/warn/classify/ask) |
| `Zut` | Permission decision engine (Ado, y9t, T) |
| `J5` | Permission rule executor (zc, bit, IA, ot, Zpt, o_o, s_o, iel, RD) |
| `QNl` | Daemon status writer (_Q, Date.now, Xs, zqt, De) |
| `Xs` | AsyncLocalStorage store accessor (bUu.getStore) |
| `zqt` | Status file path builder (JNl.join, or) |
| `De` | JSON.stringify wrapper |
| `_` | SDK connection manager (N_t, BD, xx, Promise.all, I7, mB, Re, ao) |
| `N_t` | Transport header builder (JHc → Object.keys) |
| `JHc` | HTTP header key enumerator |
| `p` | Forced-shutdown handler (Kb, process.exit, u.abort) |
| `m` | Worker kill-all helper (n.values, x.kill) |
| `l` | Daemon IPC destroy handler (QNl) |
| `Ts` | CLI error exit (X8e, sT, process.exit with code 1) |
| `ly` | Cache invalidator (GZ.delete) |
| `Xf` | File watch notifier (mn, sOe.has, T, Ae, Re) |
| `fg` | Session state classifier (g0 → "active") |
| `ive` | Tool permission filter (startsWith, indexOf, d4.has, lDt.has, x2e.has, VTd) |
| `Oc` | (see above) |