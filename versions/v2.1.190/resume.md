---
type: feature-spec
feature: "resume"
cc_version: "2.1.190"
updated: "2026-06-24"
tags: ["resume", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.190 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/resume`

> Analysis basis: CC v2.1.190 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.190

---

## Overview

`/resume` (aliased as `/continue`) allows a user to reattach to or replay a previous Claude Code conversation, identified either by an explicit session UUID or by a fuzzy search term. The command queries live sessions via the daemon, matches the user's argument against stored conversations, and either attaches the terminal to a running background session or restores a completed session's context. A blocking error is raised when the matched session is still live as a background agent, redirecting the user to `/agents` instead.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `resume` |
| description | Resume a previous conversation |
| aliases | `["continue"]` |
| argumentHint | `[conversation id or search term]` |
| module_id | `ILl` |
| load_inline | `true` |
| loc_byte | `12235899` |
| loc_byte_end | `12236096` |
| loc_line | `8132` |
| arbor_handler.name | `Npf` |
| arbor_handler.fqn | `claude-2.1.190::Npf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.190 bundle.js:+12235899

---

## Input Branching

The handler contains at least five distinct decision paths (background-session conflict, no-matches found, single-match, multiple-matches requiring disambiguation, and JSX rendering branches), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/resume [arg]"]) --> B[Fetch live sessions via listAllLiveSessions]
    B --> C[Run session-store query / filter conversations matching arg]
    C --> D{Match count}

    D -- "0 matches" --> E["Display: 'No conversations found to resume.'\n(bundle.js:+12234954)"]

    D -- "1 match" --> F{Is matched session\nrunning as background agent?}
    F -- "yes\n(session status = interactive)" --> G["Display blocking message:\n'That session is still running as a\nbackground agent. Open `claude agents`\nto attach to it, or stop it there first…'\n(bundle.js:+12234543)"]
    F -- "no" --> H[Resolve conversation & worktree context via XHe]

    D -- ">1 match" --> I[Present disambiguation list\n(sessionNotFound / multipleMatches path)\n(bundle.js:+12232210, +12232281)]
    I --> J[User selects entry]
    J --> F

    H --> K[Build session-restore arguments\n- emit slash_command_session_id telemetry key\n- emit slash_command_title telemetry key\n(bundle.js:+12235216, +12235441)]
    K --> L[Render JSX result component via h3.jsx\n(bundle.js:+12234829)]
    L --> M{Is conversation\nassociated with a git worktree?}
    M -- "yes" --> N[Run worktree detection\nvia XHe / git worktree list --porcelain\n(bundle.js:+8567086)]
    M -- "no" --> O[Attach / replay inline session]
    N --> O

    O --> P([Session resumed])
```

---

## Behavioral Spec

### 1. Entry Point — Handler `resumeCommandHandler` (`Npf`)

`Npf` is the primary async handler resolved by Arbor via `module_id` path from module `ILl`.

```
async function resumeCommandHandler(context):
    // 1. Collect live daemon sessions
    liveSessions = await listAllLiveSessions(context)           // QHe → n.listAllLiveSessions

    // 2. Filter conversations matching the user argument
    arg = context.userArgument  // may be UUID fragment or search term
    candidates = filterConversations(allConversations, arg)     // i.filter (bundle.js:+12235073)

    // 3. Branch on match count
    if candidates.length == 0:
        return renderError("No conversations found to resume.")  // bundle.js:+12234954

    if candidates.length > 1:
        return renderDisambiguationUI(candidates)               // multipleMatches path, bundle.js:+12232281

    selected = candidates[0]

    // 4. Background-agent conflict check
    if isBackgroundSession(selected, liveSessions):             // checks "interactive" status (bundle.js:+8578595)
        return renderError(BACKGROUND_AGENT_BLOCKED_MESSAGE)    // bundle.js:+12234543

    // 5. Resolve worktree / context
    resolvedContext = await resolveSessionContext(selected)     // XHe (bundle.js:+12234886)

    // 6. Emit tracking identifiers and render
    emitSessionIdTag("slash_command_session_id", selected.id)  // bundle.js:+12235216
    emitTitleTag("slash_command_title", selected.title)        // bundle.js:+12235441
    timestamp = Date.now()                                     // bundle.js:+12234862

    return renderJSX(SessionResumeComponent, resolvedContext)   // h3.jsx (bundle.js:+12234829)
```

Analysis basis: CC v2.1.190 bundle.js:+12234533 – +12235491

---

### 2. Live-Session Fetch — `liveSessionFetcher` (`QHe`)

```
async function liveSessionFetcher(daemonClient):
    await Promise.resolve()                       // bundle.js:+8578452
    sessions = await daemonClient.listAllLiveSessions()  // bundle.js:+8578504
    filter by status == "interactive"             // literal "interactive" (bundle.js:+8578595)
    return sessions
```

Analysis basis: CC v2.1.190 bundle.js:+12234533

---

### 3. Worktree Context Resolution — `sessionContextResolver` (`XHe`)

Detects whether the stored conversation was recorded inside a git worktree and resolves the working directory.

```
async function sessionContextResolver(session):
    baseTime = Date.now()                         // bundle.js:+8567051
    rawPath  = session.workingDirectory

    // Normalize path (Unicode NFC form, literal "NFC" bundle.js:+66175)
    normalizedPath = pathNormalize(rawPath)       // TH (bundle.js:+8567337)

    // Run: git worktree list --porcelain
    // literals: "worktree", "list", "--porcelain" (bundle.js:+8567095-8567113)
    worktrees = await runGitWorktreeList()        // Wr (bundle.js:+8567086)

    // Split output, find matching worktree entry starting with "worktree "
    // (literal "worktree " bundle.js:+8567314, offset 9 chars bundle.js:+8567348)
    matched = worktrees
        .split('\n')                              // bundle.js:+8567276
        .filter(l => l.startsWith("worktree "))  // bundle.js:+8567301
        .find(match for session path)             // bundle.js:+8567440

    // Sort candidates locale-comparatively
    sorted = candidates.sort(localeCompare)       // bundle.js:+8567519

    emit telemetry: "tengu_worktree_detection"    // bundle.js:+8567195

    return { path: resolvedPath, worktrees: sorted }
```

Analysis basis: CC v2.1.190 bundle.js:+8567051 – +8567519

---

### 4. Conversation Store Reader — `conversationStoreBuilder` (`e_e` / `Qle`)

Reads JSONL transcript files from disk, reconstructs conversation chains, and populates the in-memory store used for fuzzy matching.

```
function buildConversationStore(storeRoot):
    // Read per-message metadata from binary JSONL index (wvf)
    // Message types recognized: "assistant", "attachment", "system",
    //   "compact_boundary", "summary", "last-prompt", "custom-title",
    //   "ai-title", "tag", "agent-name", "agent-color", "agent-setting",
    //   "mode", "permission-mode", "isolation-latch", "worktree-state",
    //   "pr-link", "bridge-session", "file-history-snapshot",
    //   "attribution-snapshot", "content-replacement", "fork-context-ref"
    //   (bundle.js:+13275122 – +13276994)

    messages = readAndParseTranscript(storeRoot)   // wvf (bundle.js:+13271617)

    // Build parent→child chains; detect cycles
    // telemetry: tengu_transcript_phantom_parent (bundle.js:+13274165)
    // telemetry: tengu_transcript_parent_cycle   (bundle.js:+13278085)
    // telemetry: tengu_chain_parent_cycle        (bundle.js:+13254060)
    // telemetry: tengu_chain_timestamp_fallback  (bundle.js:+13254209)
    // telemetry: tengu_chain_parallel_tr_recovered (bundle.js:+13256075)
    chains = relinkChains(messages)               // ZHe, gvf, fvf, s9l

    // Populate keyed maps for each metadata type
    for each metadataEntry in chains:
        storeMap.set(entry.type, entry.value)

    return storeMap
```

Analysis basis: CC v2.1.190 bundle.js:+13267614 – +13278974

---

### 5. Conversation Listing — `listConversations` (`YY`)

Aggregates all stored conversations, applies a fuzzy/prefix match against the user's search term, and sorts by recency.

```
function listConversations(searchTerm, storeRoot):
    // Build context: XHe (worktree), gr (home dir), c9l (file scanner)
    allEntries = buildConversationStore(storeRoot)   // c9l (bundle.js:+13269443)
    indexData  = buildContentIndex(allEntries)       // Hqe (bundle.js:+13269465)

    // Case-fold the search term
    term = searchTerm.toLowerCase()                  // bundle.js:+13269485

    // Filter: must not be already-excluded entries
    filtered = entries.filter(not excluded)          // bundle.js:+13269510

    // Include only entries whose searchable fields include the term
    matched  = filtered.filter(e => e.fields.includes(term))  // bundle.js:+13269610

    // Sort by descending timestamp
    sorted   = matched.sort((a,b) => b.time - a.time)         // bundle.js:+13269758

    // Truncate to display window
    display  = sorted.slice(0, displayLimit)                   // bundle.js:+13269824

    return display
```

Analysis basis: CC v2.1.190 bundle.js:+13269425 – +13269824

---

### 6. File-System Conversation Scanner — `fileConversationScanner` (`c9l`)

Walks the project-store directories, reads transcript shards, and builds the searchable conversation index passed to `listConversations`.

```
async function fileConversationScanner(projectRoot):
    // Resolve base directory: a7 (bundle.js:+13282568)
    // a7 joins the "projects" literal (bundle.js:+5244764) under the store root

    files = await fs.readdir(projectRoot, { recursive: true })  // gl.readdir (bundle.js:+13283192)

    // For each shard file:
    results = await Promise.all(files.map(async shard => {
        // Build content hash (Hqe), read metadata entries (nKt, yDe)
        // Resolve real path (gl.realpath, bundle.js:+13284034)
        // Join path components (Zh.join, bundle.js:+13283687)
        // Check directory flag (E.isDirectory, bundle.js:+13283517)
        return parseShardMetadata(shard)
    }))

    // Flatten and de-duplicate (p.has / p.add, bundle.js:+13283438/+13283581)
    // Sort final list (d.sort, bundle.js:+13283117)
    return results.flat()
```

Analysis basis: CC v2.1.190 bundle.js:+13282568 – +13284829

---

### 7. Background-Session Conflict Guard

When the resolved session is flagged as still running interactively inside the daemon, the handler short-circuits with a user-facing error rather than attempting to resume:

- Status field checked: `"interactive"` (bundle.js:+8578595)
- Error message shown to user: begins with `"That session is still running as a background agent…"` (bundle.js:+12234543)
- User is directed to open `claude agents` or stop the session there first.
- Role tag used when constructing the blocked message: `"user"` (bundle.js:+12234684)
- Skip sentinel used in related flow: `"skip"` (bundle.js:+12234746)

Analysis basis: CC v2.1.190 bundle.js:+12234543

---

### 8. Bold Title Renderer — `boldTitleRenderer` (`ALl`)

```
function boldTitleRenderer(title):
    return St.bold(title)    // bundle.js:+12232245
```

Used in the disambiguation and session-not-found UI components.

Analysis basis: CC v2.1.190 bundle.js:+12235491

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_worktree_detection` | Fired when the worktree-detection step runs during context resolution (bundle.js:+8567195) |
| Telemetry — `tengu_daemon_control` | Fired during daemon lifecycle operations reached through this flow (bundle.js:+17235957) |
| Telemetry — `tengu_bg_attach` | Fired when the process attaches to an existing background session worker (bundle.js:+17189413) |
| Telemetry — `tengu_bg_attach_stall_gave_up` | Fired if the attach stalls and the system gives up (bundle.js:+17190343) |
| Telemetry — `tengu_bg_attach_stall_respawn` | Fired if the attach stalls and triggers a worker respawn (bundle.js:+17190613) |
| Telemetry — `tengu_bg_attach_kick` | Fired when a competing attacher is kicked (bundle.js:+17191610) |
| Telemetry — `tengu_bg_attach_upgrade` | Fired when attaching triggers a CC upgrade (bundle.js:+13055158) |
| Telemetry — `tengu_transcript_phantom_parent` | Fired when a message references a non-existent parent UUID (bundle.js:+13274165) |
| Telemetry — `tengu_transcript_parent_cycle` | Fired when a cycle is detected in transcript parentage (bundle.js:+13278085) |
| Telemetry — `tengu_chain_parent_cycle` | Fired for chain-level cycle detection (bundle.js:+13254060) |
| Telemetry — `tengu_chain_timestamp_fallback` | Fired when timestamp sorting falls back to insertion order (bundle.js:+13254209) |
| Telemetry — `tengu_chain_parallel_tr_recovered` | Fired when parallel transaction chains are reconciled (bundle.js:+13256075) |
| Telemetry — `tengu_relink_walk_broken` | Fired when a relink walk encounters a broken chain link (bundle.js:+13253566) |
| Session-ID tag | `slash_command_session_id` written into the resuming session's context (bundle.js:+12235216) |
| Title tag | `slash_command_title` written into the resuming session's context (bundle.js:+12235441) |
| appState changes | Conversation store maps (`Qle`) updated with metadata entries for the resumed session; active conversation pointer updated |
| Sound | None detected |
| Daemon socket | `listAllLiveSessions` called over the daemon IPC socket; attach IPC messages sent for background sessions |
| File I/O | Transcript JSONL shards read synchronously via `l$.openSync` / `l$.readSync` / `l$.closeSync` during index build |
| Git invocation | `git worktree list --porcelain` executed to detect worktree associations (bundle.js:+8567095–8567113) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.190 | Initial analysis |

---

## Common Mistakes

1. **Attempting to resume an active background session directly**: `/resume` will refuse with the "still running as a background agent" message (bundle.js:+12234543). Use `/agents` to attach or stop the session first.
2. **Using a non-unique search term**: If the term matches multiple conversations, the command enters a disambiguation UI rather than resuming immediately. Prefer supplying the full session UUID to avoid ambiguity.
3. **Confusing `/resume` with `/agents`**: `/resume` is for completing or replaying sessions; live multi-agent sessions should be managed via `/agents` (or the `claude agents` command).
4. **Expecting `/resume` to work without a running daemon**: The command calls `listAllLiveSessions` through the daemon socket; if the daemon is not running the live-session check will fail or return empty, and only file-backed conversations will be offered.
5. **Forgetting the alias**: `/continue` is a registered alias and is fully equivalent to `/resume` (registration aliases field).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Npf` | Primary async resume command handler (`resumeCommandHandler`) |
| `TLl` | Conversation list filter / pre-filter helper |
| `QHe` | Live-session fetcher (calls `listAllLiveSessions`) |
| `XHe` | Session context resolver (worktree detection, path normalization) |
| `Wr` | Process / daemon runner (executes `git worktree list`) |
| `B1e` | Child-process spawner and lifecycle manager |
| `e_e` | Conversation-store population (top-level store builder) |
| `Qle` | Per-shard metadata dispatcher (sets metadata-type maps) |
| `wvf` | Binary JSONL transcript reader (low-level shard parser) |
| `vvf` | Alternate transcript/buffer parser |
| `Lvf` | Synchronous shard read helper |
| `D3l` | Metadata chain walker and deduplicator |
| `pvf` | Parent-chain relinking helper |
| `ZHe` | Cycle-detecting chain builder |
| `gvf` | Parallel-transaction reconciler |
| `fvf` | Forward-chain sorter |
| `s9l` | Chain segment collector |
| `hvf` | NaN-guard / chain value validator |
| `YY` | Conversation listing with fuzzy match and sort |
| `c9l` | File-system conversation scanner |
| `k5e` | Conversation-state hydrator (reads all map entries after `e_e`) |
| `l9l` | Store-initializer that calls `Qle` and assigns object |
| `kvf` | Single-shard metadata loader with stat check |
| `nKt` | Cache-backed metadata-entry getter/setter |
| `yDe` | Shard content builder (assembles display entries) |
| `sDo` | Directory walker for transcript shards |
| `pKt` | Context-pack builder (calls `c9l`, `gr`, `T`) |
| `T7n` | Top-level context aggregator invoked from `Npf` |
| `Hqe` | Content-hash / index builder |
| `Uvf` | Index-entry writer |
| `MM` | UUID-format tester (regex check) |
| `ute` | Session-restore argument builder |
| `e_e` | (same as above — store builder entry) |
| `rKt` | Timestamp parser (`Date.parse` wrapper) |
| `aut` | Message-array mapper |
| `gDo` | Display-text normalizer |
| `Eqt` | Message-entry formatter |
| `ml` | Markdown-line parser |
| `_Do` | Attachment-type filter |
| `Hvf` | Attachment array checker |
| `_vf` | Attachment-some predicate |
| `LJn` | Linked-message getter/setter |
| `kJn` | Linked-message array converter |
| `rDo` | Per-conversation render-data builder |
| `ALl` | Bold-title renderer (wraps `St.bold`) |
| `mh` | Message-history helper |
| `ke` | Error-logging / error-formatting utility |
| `fo` | Error constructor wrapper |
| `nt` | String coercion helper |
| `Vi` | Variant / options builder |
| `Jns` | Inner string formatter used by `Vi` |
| `oou` | Ring-buffer push/shift for recent entries |
| `be` | String-to-display formatter |
| `gr` | Home-directory resolver |
| `VL` | Home-directory constant |
| `TH` | Path normalizer (Unicode NFC) |
| `rUl` | Daemon-status file reader (`daemon.status.json`) |
| `nVt` | Status-file path joiner |
| `AQ` | Config/store accessor |
| `Xs` | AsyncLocalStorage store getter |
| `NE` | Path-segment sanitizer |
| `M$` | Store-root resolver (uses `VL`) |
| `Ew` | Recursive directory reader |
| `$ye` | Session-not-found UI component |
| `evf` | Event-record factory for Qle |
| `N5` | Notification or count helper |
| `VJt` | JSON value transformer |
| `WJt` | Regex-based value classifier |
| `qJt` | String-escape processor |
| `NA` | No-op / null-assignment sentinel |
| `d9e` | MCP connection configurator |
| `brr` | MCP connection result applier |
| `_la` | MCP retry/cleanup scheduler |
| `fBo` | MCP slot map builder |
| `H` | IPC client connection manager |
| `mp` | IPC message end-writer |
| `RJf` | IPC dispatch router (handles all message types) |
| `f` | Session-worker lifecycle manager |
| `D` | Worker-process controller |
| `Kn` | Timeout-with-abort helper |
| `Re` | Feature-flag "ok" reporter |
| `Le` | Feature-flag "ok" reporter (alternate path) |
| `GXn` | Memory-usage sampler |
| `B2e` | State-file lstat/read/clean helper |
| `U` | Idle-timeout / retire-if-settled manager |
| `it` | Worker-status updater |
| `L3o` | Unix-socket connect helper |
| `P3o` | Session-state file manager |
| `Pe` | Process-exit / cleanup hook |
| `F` | Interval-based sweep disposer |
| `nEe` | Non-array-safe filter wrapper |
| `V` | Scheduled-task runner |
| `sOt` | Task-drift calculator |
| `Gwn` | Grace-clock advancer |
| `Odc` | Boolean coercion gate |
| `eK` | Set membership tester |
| `uae` | Grace-period filter |
| `L` | Background-worker sweep orchestrator |
| `w` | Grace-clock map manager |
| `k` | Grace-clock entry updater |
| `PVt` | Memory-threshold check |
| `J2l` | Worker retirement by memory |
| `WXn` | Upgrade-attach helper |
| `z` | Backspace / keyboard-input interceptor |
| `wvf` | (same as above — JSONL reader) |
| `K` | Byte buffer used in JSONL parsing |
| `a9l` | Buffer `.at()` accessor |
| `te` | Comparison-buffer reference |
| `Gt` | `JSON.parse` wrapper |
| `x` | Attachment-set tracker |
| `Cvf` | Buffer comparator |
| `j` | Voice / recording timeout helper |
| `X` | IZn-keyed store (React ref) |
| `se` | Header-field parser |
| `ZSe` | JSON-parse with fallback |
| `ee` | Multi-session MCP connection updater |
| `D3l` | (same as above — chain walker) |
| `pvf` | (same as above — relink helper) |
| `Fo` | Promise factory (`aKe` wrapper) |
| `QAe` | Binary-header decoder (BOM detection) |
| `bau` | BOM-prefix detector |
| `Tau` | JSONL-line extractor |
| `Cau` | JSON-segment parser |
| `Iau` | Buffer-to-string entry parser |
| `O` | Orphan-entry collector |
| `Xo` | `cn`-based path helper |
| `sp` | Subprocess pipe helper |
| `cn` | Path constant / config-dir resolver |
| `Piu` | Config-dir path builder |
| `Oiu` | String-pad/trim helper |
| `p` | Forced-shutdown handler |
| `jb` | Signal broadcaster |
| `u` | Daemon-stop sequencer |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.