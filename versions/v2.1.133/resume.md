---
type: feature-spec
feature: "resume"
cc_version: "2.1.133"
updated: "2026-05-31"
tags: ["resume", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.133 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/resume`

> Analysis basis: CC v2.1.133 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.133

---

## Overview

`/resume` (alias: `/continue`) allows a user to re-open a previous Claude Code conversation by supplying a conversation ID or a free-text search term. The command locates matching sessions from the stored conversation history, resolves the best match, and restores the conversation context so that work can continue seamlessly.

---

## Registration

| Field | Value |
|---|---|
| `type` | `local-jsx` |
| `name` | `resume` |
| `description` | Resume a previous conversation |
| `argumentHint` | `[conversation id or search term]` |
| `aliases` | `["continue"]` |
| `module_id` | `K4q` |
| `load_inline` | `true` |
| `loc_byte` | `10932124` |
| `loc_byte_end` | `10932321` |
| `loc_line` | `6556` |
| `arbor_handler.name` | `u37` |
| `arbor_handler.fqn` | `claude-2.1.133::u37` |
| `arbor_handler.kind` | `AsyncFunction` |
| `arbor_handler.resolution_path` | `module_id` |
| `arbor_handler.n_hits` | `0` |

Analysis basis: CC v2.1.133 bundle.js:+10932124

---

## Input Branching

The command exhibits four distinct runtime branches depending on the argument supplied and the state of the conversation store, so a flowchart is used.

```mermaid
flowchart TD
    A([User invokes /resume]) --> B{Argument provided?}
    B -- No argument --> C[List all stored conversations\nsorted by recency]
    B -- Argument present --> D[Resolve argument as\nconversation ID or search term]

    C --> E{Any conversations exist?}
    E -- None --> F[Render error:\n'No conversations found to resume.']
    E -- One or more --> G[Present conversation picker UI]

    D --> H{Exact ID match found?}
    H -- Yes --> I[Load conversation by ID\ndirectly]
    H -- No --> J[Filter & rank conversations\nby search term match]

    J --> K{Match count?}
    K -- Zero --> F
    K -- Exactly one --> I
    K -- Multiple --> L{Ambiguous: render\n'multipleMatches' state]

    I --> M[Restore session context\nvia session-loader]
    G --> M
    L --> N[Prompt user to refine\nsearch or select]

    M --> O[Conversation resumed —\nnew messages appended to restored thread]
```

Analysis basis: CC v2.1.133 bundle.js:+10930804 (filter), +10930927 (handler entry `u37`), +10931177 (no-conversations literal), +10928671 (`sessionNotFound`), +10928742 (`multipleMatches`)

---

## Behavioral Spec

### 1. Top-level Handler — `resumeCommandHandler` (`u37`)

The Arbor-resolved handler for this command is the async function identified as `u37` in the bundle, reached via `module_id` resolution from module `K4q`.

```
async function resumeCommandHandler(commandArgs, appContext):
    # Step 1 — Resolve worktrees (telemetry: tengu_worktree_detection)
    worktrees = detectWorktrees(appContext)          # calls aIH → git worktree list --porcelain

    # Step 2 — Load all stored conversations
    allConversations = loadConversationStore()       # calls d1H → Tt (transcript store)

    # Step 3 — Narrow candidates
    if commandArgs is empty:
        candidates = allConversations
    else:
        candidates = searchConversations(allConversations, commandArgs)   # see §2

    # Step 4 — Branch on result count
    if len(candidates) == 0:
        return renderError("No conversations found to resume.")  # literal at +10931177

    if len(candidates) == 1:
        selectedSession = candidates[0]
    else:
        selectedSession = await presentConversationPicker(candidates, appContext)

    # Step 5 — Emit telemetry session id
    emitTelemetry("slash_command_session_id", selectedSession.id)   # literal at +10931438

    # Step 6 — Build JSX resume element and restore session
    resumeElement = createElement(selectedSession)  # lX.createElement, loc +10931028
    titleHint     = extractTitle(selectedSession)   # _4q → bold formatter, loc +10931712
    emitTelemetry("slash_command_title", titleHint) # literal at +10931662

    return resumeElement
```

Analysis basis: CC v2.1.133 bundle.js:+10930927 (`u37` entry), +10931028, +10931099, +10931278, +10931404, +10931483, +10931544, +10931563, +10931712

---

### 2. Conversation Search — `searchConversations` (`aIH`)

`aIH` accepts the raw argument string and the full conversation list, applies normalisation, and returns a sorted, filtered subset.

```
function searchConversations(allConversations, queryString):
    # Worktree context: run git worktree list --porcelain
    # Literals: "worktree" (+10928027), "list" (+10928038), "--porcelain" (+10928045)
    worktreeInfo = runGitWorktree()             # calls GA → sJH (subprocess)

    # Parse worktree paths
    # Strip 9-character "worktree " prefix (number literal 9 at +10928277)
    # Apply Unicode NFC normalisation (literal "NFC" at +10928290)
    parsedPaths = parseWorktreePaths(worktreeOutput)

    # Normalise query: lowercase, trim, split on whitespace
    tokens = queryString.toLowerCase().trim().split()

    # Prefix detection: if query starts with "worktree " (literal at +10928246)
    #   strip prefix and search only worktree-scoped conversations
    if queryString.startsWith("worktree "):
        scopedQuery = queryString.slice(9)          # number 9 at +10928277
    else:
        scopedQuery = queryString

    # Find exact ID match first
    exactMatch = allConversations.find(c => c.id.startsWith(scopedQuery))  # K.find +10928385

    if exactMatch:
        return [exactMatch]

    # Fuzzy filter: keep conversations whose searchable fields
    #   include at least one token
    filtered = allConversations.filter(c => tokenMatch(c, tokens))    # K.filter +10928431

    # Sort by locale-aware comparison on title/date (localeCompare +10928464)
    filtered.sort((a, b) => a.title.localeCompare(b.title))

    return filtered
```

Analysis basis: CC v2.1.133 bundle.js:+10928018 (`GA`), +10928125, +10928208, +10928233, +10928269, +10928385, +10928404, +10928431, +10928464

---

### 3. Conversation Store Loader — `conversationStoreLoader` (`d1H`)

`d1H` reads the on-disk JSONL transcript store and reconstructs conversation summaries.

```
function conversationStoreLoader():
    # Open JSONL conversation files via YN.openSync / SK.readFile (Tt sub-calls)
    rawMessages = readTranscriptFiles()            # vG7, VG7 — binary JSONL readers

    # Build ordered chain: parent-UUID graph (Q1H, JG7, DG7)
    # Handles cycles (telemetry: tengu_transcript_parent_cycle +11843920,
    #                            tengu_chain_parent_cycle +11823697)
    # Handles timestamp fallback (telemetry: tengu_chain_timestamp_fallback +11823846)
    # Recovers parallel transcript anomalies (tengu_chain_parallel_tr_recovered +11825712)
    conversationChains = buildParentChain(rawMessages)

    # Extract metadata per conversation:
    #   summary       ("summary"       literal +11841638)
    #   last-prompt   ("last-prompt"   literal +11841705)
    #   custom-title  ("custom-title"  literal +11841801)
    #   ai-title      ("ai-title"      literal +11841879)
    #   tag           ("tag"           literal +11841949)
    #   agent-name    ("agent-name"    literal +11842010)
    #   mode          ("mode"          literal +11842240)
    conversations = conversationChains.map(extractMetadata)

    # Sort by mtime descending (gY8 → Date.parse +11823477)
    conversations.sort(byModificationTime)

    return conversations
```

Analysis basis: CC v2.1.133 bundle.js:+11834272 (`d1H` entry), +11834664 (`Tt`), +11834696, +11834840, +11843231, +11843439

---

### 4. Session Context Restorer — `sessionContextRestorer` (`Jz6`)

Once a conversation is selected, `Jz6` reconstructs the full in-memory session object from stored data.

```
function sessionContextRestorer(conversationId, storeSnapshot):
    # Load full message chain (Q1H) for the selected conversation
    chain = loadChainForId(conversationId)        # Q1H +11846253

    # Resolve all Map-backed state stores (q, K, $, G, L, f, M, Y, w, J, O, z, D, X, W)
    # Each get/set pair ensures atomic restore
    restoreAllStateSlices(chain)

    # Re-attach compact boundary context ("compact_boundary" +9750908)
    reattachCompactBoundary(chain)

    # Walk conversation files for fork-context-ref ("fork-context-ref" +11843015)
    # and worktree-state ("worktree-state" +11842461)
    resolveWorktreeState(chain)

    # Emit phantom-parent warning if orphaned node detected
    # (telemetry: tengu_transcript_phantom_parent +11840508)
    # (telemetry: tengu_relink_walk_broken +11822681)
    validateChainIntegrity(chain)

    return reconstructedSession
```

Analysis basis: CC v2.1.133 bundle.js:+11846025 (`Fjq`/`Tt` session init), +11846095, +11846253, +11846264, +11846629

---

### 5. Conversation List Renderer — `conversationListRenderer` (`fg`)

`fg` prepares the JSX list of resumable conversations shown in the picker.

```
function conversationListRenderer(candidates, appContext):
    # Load JSONL message headers (aIH, gjq)
    # Build display entries: title, last-prompt snippet, timestamp
    displayEntries = candidates.map(buildDisplayEntry)

    # Filter: hide conversations with no recoverable messages
    visible = displayEntries.filter(hasRecoverableContent)    # f.filter +11835966

    # Sort by recency (z.sort +11836214, then z.slice to cap list size)
    sorted  = visible.sort(byRecency).slice(0, maxVisible)    # z.slice +11836280

    # Return rendered JSX via lX.createElement
    return renderPickerComponent(sorted)
```

Analysis basis: CC v2.1.133 bundle.js:+11835881 (`fg` entry), +11835885, +11835899, +11835921, +11835941, +11835966, +11836114, +11836188, +11836199, +11836214, +11836280

---

### 6. Conversation File Scanner — `conversationFileScanner` (`gjq`)

`gjq` lists project conversation directories and collects JSONL filenames for loading.

```
async function conversationFileScanner(projectsDir):
    # Base path: join(configDir, "projects")  # "projects" literal +11802784
    entries = await SK.readdir(projectsDir)              # +11848669

    # Filter to directories only (j.isDirectory +11848891)
    projectDirs = entries.filter(isDirectory)

    # For each project dir, list *.jsonl files
    # Track visited paths (Y.has/Y.add dedup set, +11848955 / +11849033)
    allFiles = []
    for dir in projectDirs:
        if not visited.has(dir):
            visited.add(dir)
            files = listJsonlFiles(dir)             # K.startsWith filter +11848211
            allFiles.push(...files)

    # Parallel load of file headers (Promise.all +11848279)
    headers = await Promise.all(allFiles.map(loadFileHeader))

    # Merge session entries (EP6, KYH) and sort (D.sort +11848594)
    merged = mergeAndSort(headers)

    return merged
```

Analysis basis: CC v2.1.133 bundle.js:+11847905 (`gjq` entry), +11848669, +11848711, +11848891, +11848955, +11849033, +11849042, +11849061, +11848279, +11848594

---

### 7. Subprocess Spawner — `subprocessRunner` (`GA`)

`GA` is used to execute `git worktree list --porcelain` in order to detect multi-worktree layouts relevant to conversation scoping.

```
async function subprocessRunner(cmd, args, options):
    # Delegate to sJH (process spawner with timeout/kill machinery)
    process = await spawnProcess(cmd, args, options)   # sJH +989626

    # Collect stdout/stderr (rL_: kill on excess, nL_: timeout logic)
    output  = await collectOutput(process)

    # Truncate to 1 000 000 byte limit (number literal +989587)
    # Keep at most 10 lines of stderr (number literal +989445)
    trimmedOutput = trimOutput(output, maxBytes=1_000_000, maxErrLines=10)

    return trimmedOutput
```

Analysis basis: CC v2.1.133 bundle.js:+989626 (`sJH`), +989394 (`qPL`), +989445, +989587, +989819, +989942

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_worktree_detection` | Fired when worktree detection runs to scope conversation search. CC v2.1.133 bundle.js:+10928127 |
| Telemetry — `tengu_transcript_phantom_parent` | Fired when a conversation node references a parent UUID that cannot be found. CC v2.1.133 bundle.js:+11840508 |
| Telemetry — `tengu_relink_walk_broken` | Fired when the parent-UUID walk encounters a broken link. CC v2.1.133 bundle.js:+11822681 |
| Telemetry — `tengu_transcript_parent_cycle` | Fired when a cycle is detected in the parent-UUID graph. CC v2.1.133 bundle.js:+11843920 |
| Telemetry — `tengu_chain_parent_cycle` | Fired on a chain-level parent cycle. CC v2.1.133 bundle.js:+11823697 |
| Telemetry — `tengu_chain_timestamp_fallback` | Fired when sort order falls back to a secondary timestamp heuristic. CC v2.1.133 bundle.js:+11823846 |
| Telemetry — `tengu_chain_parallel_tr_recovered` | Fired when a parallel transcript inconsistency is auto-resolved. CC v2.1.133 bundle.js:+11825712 |
| Telemetry — `slash_command_session_id` | String literal emitted with the selected conversation's session ID. CC v2.1.133 bundle.js:+10931438 |
| Telemetry — `slash_command_title` | String literal emitted with the resolved conversation title. CC v2.1.133 bundle.js:+10931662 |
| appState changes | Restores all Map-backed state slices (`q`, `K`, `$`, `G`, `L`, `f`, `M`, `Y`, `w`, `J`, `O`, `z`, `D`, `X`, `W`) for the selected session. CC v2.1.133 bundle.js:+11846264 ff. |
| Session metadata keys written | `summary`, `last-prompt`, `custom-title`, `ai-title`, `tag`, `agent-name`, `mode`, `permission-mode`, `isolation-latch`, `worktree-state`, `pr-link`, `fork-context-ref`, `file-history-snapshot`, `attribution-snapshot`, `content-replacement`. Various `+1184xxxx` offsets. |
| Conversation filter flag | `"skip"` marker (literal at +10930945) is used by `L4q` to exclude certain conversation entries from the candidate list before ranking. CC v2.1.133 bundle.js:+10930804 |
| Error string | `"No conversations found to resume."` shown when the candidate list is empty after filtering. CC v2.1.133 bundle.js:+10931177 |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.133 | Initial analysis. Handler `u37` in module `K4q`; alias `/continue` introduced; worktree-scoped search and `multipleMatches` disambiguation flow confirmed. |

---

## Common Mistakes

1. **Providing a non-unique prefix**: If the supplied argument matches multiple conversation IDs or titles, the command enters the `multipleMatches` branch (`sessionNotFound`/`multipleMatches` literals at +10928671 / +10928742) and asks for clarification instead of loading a conversation. Supply a longer, unambiguous prefix or the full UUID.

2. **Expecting cross-worktree results without a scope prefix**: Conversations are scoped per worktree by default. To search across a different worktree, prefix the query with `"worktree "` followed by the path or search term (literal at +10928246).

3. **Running `/resume` before any conversation exists**: If no JSONL files are present in the projects directory, the command immediately renders `"No conversations found to resume."` (literal +10931177) without opening any picker UI.

4. **Confusing `/resume` with re-invoking the last prompt**: The command restores the _conversation thread_ (message history and session metadata), not a specific prompt. Use it to pick up an old thread, not to replay a previous action.

5. **Using the alias `/continue` with an argument that looks like a sentence**: Because `/continue` is fully aliased to `/resume`, the argument parser treats the entire string after the command as the search term, which may match unexpectedly broadly. Prefer a UUID fragment when precision is needed.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `u37` | Top-level async handler for `/resume` (Arbor-resolved, `AsyncFunction`, module `K4q`) |
| `L4q` | Conversation candidate pre-filter; applies `"skip"` exclusion flag |
| `aIH` | Conversation search function: normalises query, runs git worktree detection, filters/sorts candidates |
| `GA` | General subprocess runner (wraps `sJH`); used for `git worktree list --porcelain` |
| `sJH` | Low-level process spawner with timeout (`nL_`), kill (`rL_`, `lL_`), stdout/stderr collection |
| `fH` | Logging/error-reporting utility (calls `yQ.logError`, pushes to `cyH`) |
| `vH` | String coercion helper (wraps `String`) |
| `d1H` | Conversation store loader; reads transcript JSONL files and builds in-memory chain |
| `Tt` | Core transcript state initialiser; sets all Map-backed session state slices |
| `Q1H` | Parent-UUID chain builder; detects cycles and phantom parents |
| `JG7` | Conversation chain sorter and metadata aggregator |
| `DG7` | Chain deduplication and ordering helper (shift/push queue logic) |
| `mjq` | Map-backed message index builder |
| `wG7` | NaN-safe value validator for chain ordering |
| `gY8` | Mtime-based conversation sorter (`Date.parse`) |
| `Jz6` | Session context restorer; re-hydrates all Map state slices from stored chain |
| `Fjq` | Session init coordinator: calls `kG7` (path resolver) and `Tt` (state init) |
| `kG7` | Conversation file path resolver (`O$.join`, `SK.stat`) |
| `fg` | Conversation list renderer; builds JSX picker entries |
| `gjq` | Conversation file scanner; reads project directories and collects JSONL headers |
| `aIH` | (see above — same identifier used for both search and worktree-parse logic) |
| `cO8` | JSONL transcript reader coordinator (calls `hP6`) |
| `hP6` | Per-file JSONL loader; decodes entries and dispatches to `gjq`/`JVH` |
| `JVH` | Binary JSONL block parser (Buffer.alloc-based) |
| `mG7` | JSONL record decoder; validates record type and dispatches to `k` |
| `k` | Single-message deserialiser; handles debug/tool/text variants |
| `vtq` | Message content-block builder (computes byte length, resolves paths) |
| `KYH` | Session entry accumulator (slice/push into display list, calls `ByH`) |
| `EP6` | Session entry Map cache (get/set/values) |
| `IqH` | Session-not-found state renderer |
| `_4q` | Title formatter using bold styling (`M6.bold`) |
| `ic` | UUID-format validator (`DA4.test` regex) |
| `kl` | Conversation ID normaliser |
| `GM` | Generic conversation metadata getter |
| `qPL` | Subprocess output string coercer |
| `BK_` | Process command builder (handles `win32`/`.exe`/`cmd /q` paths) |
| `Kh8` | Process stdout stream handler |
| `fh8` | Process stderr stream handler |
| `UH6` | Subprocess result parser (bufferedData extraction) |
| `nL_` | Subprocess timeout enforcer (`setTimeout`/`Promise.race`/`clearTimeout`) |
| `rL_` | Subprocess kill-on-excess-output handler |
| `lL_` | Subprocess unconditional kill helper |
| `IK_` | Process exit event registrar |
| `Lh8` | Process property definer (`Reflect.defineProperty`) |
| `TK_` | Subprocess parallel-output collector (`Promise.all`) |
| `tL_` | Subprocess stdio bind helper |
| `GK_` | Subprocess pipe manager |
| `EK_` | Subprocess event counter |
| `QH6` | Subprocess result wrapper (`Uy8`) |
| `HxA` | Message text extractor with replaceAll/slice normalisation |
| `IQH` | Message array mapper |
| `_xA` | Structural content-block validator (`XG7`, `jG7`) |
| `XG7` | Array-of-content trim validator |
| `jG7` | Content-block `some` predicate |
| `cbA` | Compact boundary context re-attacher |
| `QY8` | Conversation Map get/set cache |
| `dY8` | Array.from wrapper over Map values |
| `Gjq` | Transcript message re-linker (H.values/H.get/H.set dedup walk) |
| `vG7` | Binary JSONL record scanner (Buffer-based, openSync/readSync/closeSync) |
| `VG7` | JSONL attribution-snapshot parser |
| `NG7` | JSONL snapshot reader (allocUnsafe, readSync, p6 JSON parse) |
| `LXH` | JSONL stream framer (`pPL`/`UPL`/`FPL`/`BPL` sub-parsers) |
| `HA` | Error constructor wrapper (used in error-path branches) |
| `kH` | String identity coercer |
| `J9_` | Nested string coercion helper |
| `NJL` | Log-ring shift/push buffer (AN6) |
| `yq` | Log entry formatter (calls `J9_`) |
| `lFA` | Background daemon spare-process spawner (`Bun.spawn`, `daemon_bg_spare_refill`) |
| `Y` | Daemon background-session orchestrator (memory check, session creation, recycling) |
| `sFA` | Daemon low-memory reporter (`tengu_bg_low_mem_mb`) |
| `Og7` | MCP server retry coordinator |
| `mFq` | MCP update applicator |
| `iZH` | MCP client connection handler (stdio/sse/http/sse-ide/ws-ide variants) |
| `tFA` | Background session lifecycle manager (done/killed/blocked/crashed/working/active states) |
| `nFA` | Background session IPC connector (`NP8.connect`) |
| `w` | Foreground session manager (spawn, kill, memory tracking) |
| `rfH` | Skill/config-change event handler |
| `W` | Debounced skill-change notifier (`setTimeout`/`clearTimeout`) |
| `BcH` | Cache-clear helper (`c58.clear`) |
| `et` | Skill state event emitter |
| `D` | Daemon supervisor config manager (stop/updateConfig/start) |
| `Zf8` | Skill data accessor |
| `_mH` | Skill-list `some` predicate |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.