---
type: feature-spec
feature: "resume"
cc_version: "2.1.191"
updated: "2026-06-25"
tags: ["resume", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.191 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/resume`

> Analysis basis: CC v2.1.191 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.191

---

## Overview

`/resume` (alias: `/continue`) lets the user re-enter a previous Claude Code conversation by specifying a session ID or free-text search term. The command queries all live and persisted session records, applies fuzzy filtering, and either restores the matching session directly or presents a selection UI when multiple candidates match. When the target session is still running as a background agent, the command blocks resumption and instructs the user to use `claude agents` instead.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `resume` |
| description | `Resume a previous conversation` |
| aliases | `["continue"]` |
| argumentHint | `[conversation id or search term]` |
| module_id | `vNl` |
| load_inline | `true` |
| loc_byte | `12343829` |
| loc_byte_end | `12344026` |
| loc_line | `8081` |
| arbor_handler.name | `GCf` |
| arbor_handler.fqn | `claude-2.1.191::GCf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.191 bundle.js:+12343829

---

## Input Branching

Five or more distinct resolution paths exist (no argument vs. argument, single match vs. multiple matches, background-running vs. normal session, no conversations found), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/resume [arg]"]) --> B{Argument provided?}

    B -- No argument --> C[List all persisted sessions\nvia listSessionsFunction]
    B -- Has argument --> D[Filter sessions by ID prefix\nor search-term match]

    C --> E{Any sessions found?}
    D --> E

    E -- None --> F["Display: 'No conversations found to resume.'\n(bundle.js:+12342884)"]
    F --> Z([End])

    E -- Sessions found --> G{How many match?}

    G -- Exactly one --> H{Is session currently\nrunning as bg agent?}
    G -- Multiple --> I[Render session picker UI\n(JSX component via i9.jsx)\nwith 'multipleMatches' state\n(bundle.js:+12340211)]

    I --> J[User selects a session] --> H

    H -- Yes, bg running --> K["Display error:\n'That session is still running as a\nbackground agent. Open claude agents\nto attach to it, or stop it there\nfirst to resume here.'\n(bundle.js:+12342473)"]
    K --> Z

    H -- No --> L[Resolve session metadata\nvia sessionContextLoader]
    L --> M[Emit slash_command_session_id\nand slash_command_title literals\n(bundle.js:+12343146, +12343371)]
    M --> N[Load conversation transcript\nand reconstruct turn history]
    N --> O[Launch restored REPL\nwith prior context]
    O --> Z
```

---

## Behavioral Spec

### Top-level handler — `resumeCommandHandler` (`GCf`)

```
async function resumeCommandHandler(commandArgs, appContext):
    # Step 1: Collect candidate sessions
    liveSessions = await listLiveSessions(appContext)        # Nye → n.listAllLiveSessions
    allSessions  = filterAndMerge(liveSessions, commandArgs) # CNl → e.filter / Sg

    # Step 2: Apply search/filter
    if commandArgs is non-empty:
        candidates = matchByIdOrSearchTerm(allSessions, commandArgs)
    else:
        candidates = allSessions

    if candidates is empty:
        display("No conversations found to resume.")         # bundle.js:+12342884
        return

    # Step 3: Resolve single vs. multiple
    if candidates.length > 1:
        selected = await renderSessionPicker(candidates)    # i9.jsx, state="multipleMatches"
    else:
        selected = candidates[0]

    # Step 4: Guard against live background sessions
    if isActiveBackgroundAgent(selected):
        display("That session is still running as a background agent. "
                "Open `claude agents` to attach to it, or stop it there "
                "first to resume here.")                    # bundle.js:+12342473
        return

    # Step 5: Load and restore
    metadata = await loadSessionMetadata(selected)          # Oye / iKl / due
    context  = await buildConversationContext(metadata)     # eJ / aKl / Fye
    emitSlashCommandMeta(
        sessionId = selected.id,    # literal "slash_command_session_id" bundle.js:+12343146
        title     = metadata.title  # literal "slash_command_title"       bundle.js:+12343371
    )
    launchRestoredSession(context, appContext)               # Le / Ae / Date.now
```

Analysis basis: CC v2.1.191 bundle.js:+12342463 (GCf entry), +12342471 (session enumeration)

---

### Session listing — `listSessionsFunction` (`Nye`)

```
async function listSessionsFunction(appContext):
    # Fast path: resolve immediately if no async store needed
    await Promise.resolve()                                  # bundle.js:+8692385
    paginatedSessions = await appContext.listAllLiveSessions()  # bundle.js:+8692437
    # Apply label / format helper
    formattedSessions = formatSessions(paginatedSessions)   # gpt helper, bundle.js:+8692415
    return formattedSessions
```

Analysis basis: CC v2.1.191 bundle.js:+12342463

---

### Search-term matching — `sessionSearchFilter` (`Mye`)

```
function sessionSearchFilter(sessions, query):
    normalized = normalizePath(query)                       # MH → e.normalize("NFC") bundle.js:+66187
    parts      = normalized.split(separator)                # bundle.js:+8680757

    for each session in sessions:
        path = session.worktreePath                         # literal "worktree " bundle.js:+8680795
        if path.startsWith(part):                           # bundle.js:+8680782
            path = path.slice(prefixLength)                 # bundle.js:+8680821 (prefix len 9)

    # Sort candidates with locale-aware comparison
    candidates = sessions.filter(matchFn)                   # bundle.js:+8680967
    candidates.sort((a, b) => a.label.localeCompare(b.label))  # bundle.js:+8681000
    return candidates
```

Analysis basis: CC v2.1.191 bundle.js:+8680532 (Mye entry)

---

### Session context loader — `sessionContextLoader` (`Oye` / `iKl`)

```
async function sessionContextLoader(sessionRecord):
    # Load persisted transcript store
    transcriptData = await loadTranscriptDatabase(sessionRecord)  # iKl → due
    # Merge with any in-memory overlay
    merged = Object.assign({}, transcriptData, inMemoryOverlay)   # bundle.js:+13390680

    # Validate and rebuild turn chain
    turnChain = rebuildTurnChain(merged)                     # Uye, EFf, HFf, rKl
    # Walk forward from oldest known parent
    orderedTurns = walkChain(turnChain)                      # rKl → e.values / t.get / r.push

    return { sessionRecord, orderedTurns, metadata: merged.metadata }
```

Analysis basis: CC v2.1.191 bundle.js:+13391026 (iKl), +13391866 (Uye), +13390666 (due)

---

### Conversation turn reconstruction — `buildConversationContext` (`eJ`)

```
async function buildConversationContext(sessionData):
    rootPath  = resolveRootPath(sessionData)                 # Mye / Hr
    fileRefs  = await collectFileReferences(rootPath)        # aKl → fl.readdir / fl.realpath
    snapshots = await loadSnapshots(fileRefs)                # lqe → Buffer.alloc / GFf
    turns     = sessionData.orderedTurns
                  .filter(isValidTurn)                       # eJ → i.filter bundle.js:+13380370
                  .map(normalizeTurn)                        # eJ → e.toLowerCase bundle.js:+13380345

    # Apply inclusion filter (search query may narrow displayed turns)
    if searchQuery:
        turns = turns.filter(t => t.includes(searchQuery))  # eJ → p.includes bundle.js:+13380470

    # Sort by timestamp descending and slice to display limit
    sorted = Array.from(cache.values()).sort(...)            # eJ → u.sort bundle.js:+13380618
    paged  = sorted.slice(0, displayLimit)                   # eJ → u.slice bundle.js:+13380684

    return { turns: paged, fileRefs, snapshots }
```

Analysis basis: CC v2.1.191 bundle.js:+13380285 (eJ entry)

---

### Background-agent guard — `isActiveBackgroundAgent` (`oD` + inline check)

```
function isActiveBackgroundAgent(session):
    # Test whether session matches the "interactive" mode exclusion pattern
    return lpcPatternTest(session.mode)                      # oD → lPc.test bundle.js:+27890
    # Caller also checks literal "interactive" at bundle.js:+8692528
    # If true → display blocking message (bundle.js:+12342473)
```

Analysis basis: CC v2.1.191 bundle.js:+12342985 (oD call), +12342473 (blocking message literal)

---

### Session not-found / multiple-match UI — `sessionNotFoundRenderer` (`TNl`)

```
function sessionNotFoundRenderer(state, candidates):
    # state is one of:
    #   "sessionNotFound"   (bundle.js:+12340140)
    #   "multipleMatches"   (bundle.js:+12340211)
    if state == "sessionNotFound":
        renderBoldMessage("No conversations found to resume.")   # St.bold bundle.js:+12340175
    else if state == "multipleMatches":
        renderSelectionList(candidates)
```

Analysis basis: CC v2.1.191 bundle.js:+12343421 (TNl call), +12340175 (St.bold)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | No `tengu_*` events were found **directly inside** `GCf`'s immediate call graph at depth ≤ 2. Indirectly reachable events (via background-session infrastructure) include: `tengu_bg_attach` (bundle.js:+17361741), `tengu_bg_attach_kick` (+17363926), `tengu_bg_attach_stall_respawn` (+17362934), `tengu_bg_attach_stall_gave_up` (+17362664), `tengu_transcript_phantom_parent` (+13385000), `tengu_transcript_parent_cycle` (+13389092), `tengu_chain_parent_cycle` (+13363561), `tengu_chain_timestamp_fallback` (+13363710), `tengu_chain_parallel_tr_recovered` (+13365576), `tengu_worktree_detection` (+8680676) |
| Slash-command metadata | Emits `slash_command_session_id` (bundle.js:+12343146) and `slash_command_title` (bundle.js:+12343371) into app state |
| Session state read | Reads `daemon.status.json` (bundle.js:+12894435) via `ozt` / `rGl` to determine live-session status |
| File I/O | Reads transcript database files via `fl.readFile`, `fl.stat`, `fl.readdir`, `fl.realpath` (via `due` / `aKl`) |
| appState changes | Reconstructs and loads prior conversation turn history into active REPL context; does not write new turn data |
| Hook registration | None observed at depth ≤ 2 |
| Sound | None observed |
| Process side effects | May call `process.exit(1)` on CLI error via `Cs → process.exit` (bundle.js:+13196585, exit code `1`) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.191 | Initial analysis |

---

## Common Mistakes

1. **Using `/resume` on a running background session** — The command will refuse and display an instructional message. Use `claude agents` to attach to or stop a background session first.
2. **Ambiguous search terms** — If the query matches more than one session, a selection UI appears. Using the full session UUID as the argument avoids this.
3. **Confusing `/resume` with `/continue`** — Both names are registered aliases and behave identically; `/continue` is not a separate command with different semantics.
4. **Expecting cross-machine session resume** — The command reads local transcript files and daemon state; sessions are bound to the machine where they ran.
5. **Omitting the argument when many sessions exist** — With no argument, every persisted session is listed and the user must navigate the picker, which can be slow if many sessions exist.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `GCf` | Main async handler for `/resume` command (`resumeCommandHandler`) |
| `CNl` | Session list filter / entry-point wrapper that calls `e.filter` and `Sg` |
| `Nye` | Live-session listing function (`listSessionsFunction`) |
| `Mye` | Session search-term filter and worktree-path normaliser |
| `eJ` | Conversation context builder (`buildConversationContext`) |
| `Oye` | Session context loader, outer coordinator |
| `iKl` | Session context loader, inner implementation |
| `due` | Transcript database accessor and metadata store manager |
| `Fye` | Conversation state accessor (multi-map `.get` dispatcher) |
| `TNl` | Session-not-found / multiple-match JSX renderer |
| `oD` | Background-agent guard (applies `lPc.test` pattern) |
| `RQn` | Sub-handler that builds resumption prompt/title for the agent |
| `m7t` | Prompt assembly helper used by `RQn` |
| `aKl` | File-reference collector and directory walker |
| `lqe` | Snapshot loader using `Buffer.alloc` |
| `GFf` | Per-file snapshot reader |
| `kFf` | Binary transcript file parser |
| `MFf` | Synchronous transcript metadata reader |
| `RFf` | Transcript file binary parser (secondary format) |
| `Uye` | Turn-chain reconstructor |
| `EFf` | Turn-chain compaction / deduplication helper |
| `HFf` | Turn-chain ordering / priority-queue helper |
| `rKl` | Turn-chain forward-walk helper |
| `yFf` | Turn validity checker (`Number.isNaN` guard) |
| `oFo` | Session record timestamp extractor |
| `Gyt` | `Date.parse`-based timestamp helper |
| `bKt` | Conversation turn type classifier |
| `rFo` | Summary text normaliser |
| `iFo` | Turn content inclusion filter |
| `SFf` | Array-type content filter |
| `AFf` | Alternate array-content filter |
| `WUo` | Windowed turn-content accessor |
| `ypt` | Turn-map accessor |
| `Otr` | Turn reference resolver |
| `Ntr` | Turn value iterator (`Array.from` / `e.values`) |
| `Ntr` | Ntr — turn collection converter |
| `Mql` | Session-record dependency / link-map builder |
| `hFf` | Link-map helper with priority ordering |
| `DFf` | Directory-state loader used by `iKl` |
| `Mw` | Directory reader helper (`V2.readdir`) |
| `ASe` | Additional session enrichment step in `GCf` |
| `Sg` | Session record shape validator / filter predicate |
| `Hr` | Display-string helper using `ux` |
| `Ae` | String-coercion wrapper (`String(...)`) |
| `Le` | Logging / error-reporting helper |
| `wN` | Main API call orchestrator (side-query path) |
| `oW` | HTTP client / Anthropic SDK request wrapper |
| `Kr` | Process-spawn / subprocess manager |
| `wUe` | Worker/subprocess lifecycle handler |
| `rGl` | Daemon status file reader |
| `ozt` | Daemon status path joiner |
| `MH` | Unicode path normaliser (`e.normalize("NFC")`) |
| `Cs` | CLI error reporter (`process.exit`) |
| `L6o` | Message turn serialiser / context-window formatter |
| `gsm` | Token/map setter used inside `L6o` |
| `msm` | Auto-classifier input builder |
| `ke` | `JSON.stringify` wrapper |
| `hx` | Surrogate-pair-aware string slicer |
| `Pe` | React `eze` component wrapper |
| `Re` | React component (alternative to `Pe`) |
| `we` | React component (tertiary variant) |
| `T` | HTTP header / model-string builder |
| `rt` | `String(...)` coercion helper |
| `sp` | URL-fragment replacement helper |
| `Oo` | `eze`-based component |
| `Tr` | Thin wrapper calling `lh` / `Ve` |
| `Ve` | `eze` binding wrapper |
| `eze` | Core React-Ink rendering primitive |
| `D` | Terminal output writer / supervisor frame handler |
| `Fjo` | Background-session file lifecycle manager |
| `Mjo` | Background-session socket connection manager |
| `f` | Background-session worker runner (main loop) |
| `Opm` | Daemon IPC message dispatcher (large switch) |
| `H` | Daemon IPC frame buffer / session host |
| `Z` | Voice / recording session state machine |
| `ne` | Symbol-table namespace bundle (`Z`, `te`, `A`, `w`) |
| `GW` | Promise concurrency / channel mapper |
| `J` | MCP update applicator |
| `hGo` | MCP server client enumerator |
| `cSt` | Context-tip classifier dispatcher |
| `M6n` | Context-tip tool-use finder |
| `D6n` | Context-tip schema parser |
| `usm` | Session formatter entry |
| `csm` | Session turn map builder |
| `hsm` | Session summary string builder |
| `S4` | Session JSX card renderer |
| `PPr` | Sub-renderer for session card |
| `zp` | Session card data extractor |
| `wD` | Cache-control header builder |
| `C3r` | Cache-control `_r` wrapper |
| `A2e` | Cache-control `rt` / `mZ` wrapper |
| `etn` | Message array normaliser (pops / pushes) |
| `u7e` | Alternate message array normaliser |
| `Qen` | Message type checker |
| `Zen` | Message content replacer |
| `iD` | `structuredClone` wrapper |
| `LOr` | `_r` / `l7s` HTTP origin resolver |
| `l7s` | URL/origin parser and validator |
| `wOr` | Request-deduplication / permission-set manager |
| `XSn` | Tool-temperature / model selector helper |
| `av` | Message array mapper |
| `Txe` | Agent tool-call executor |
| `P4` | Random-bytes / token generator |
| `Sc` | Agent executor sub-step |
| `nt` | Tool result / IDt-CDt dispatcher |
| `aje` | Agent main execution loop |
| `To` | Agent step renderer |
| `dpr` | Agent debug printer |
| `ppr` | Agent post-process helper |
| `NF` | Agent-mode name resolver |
| `nOd` | Built-in / custom agent name parser |
| `xD` | Thread-type checker (`repl_main_thread`) |
| `H1t` | Agent background initialiser |
| `v3i` | Agent background sub-initialiser |
| `Rot` | Agent background `lh` caller |
| `h1t` | Agent background step helper |
| `ZVa` | Model-list constant |
| `mbe` | Metrics / telemetry buffer |
| `kAt` | Cache-write helper |
| `b2e` | Foundry / Bedrock model capability checker |
| `ao` | Model provider string resolver |
| `o1` | `_r` accessor wrapper |
| `lie` | OAuth token accessor |
| `vOr` | Foundry resource-name replacer |
| `CBp` | Structured-output capability finder |
| `SHo` | SHA-256 hash helper |
| `Ghn` | User-agent string builder |
| `ol` | `String(...)` coercion (second site) |
| `_r` | `rt`-based string formatter |
| `uu` | `Ymn`-based helper |
| `$hn` | Async-local-storage store accessor |
| `hCe` | Header-cache enrichment helper |
| `aIn` | `_r` injection helper |
| `XKs` | `Boolean(...)` coercion wrapper |
| `_y` | Auth credential pipeline coordinator |
| `_ud` | Auth token refresh helper |
| `Kdn` | Proxy-auth helper runner |
| `Iud` | Request-ID / verbose-logging injector |
| `PH` | `Sxt` / `lWu` / `_r` / `IFe` request-header enricher |
| `G2` | `Imu` / `dUe` utility pair |
| `fy` | Request retry / backoff handler |
| `Tud` | `Sfi` / `_fi` / `_r` request teardown helper |
| `yud` | `BSn` / `dUe` / `Fze` streaming helper |
| `SCe` | `e_` / `Date.now` / SSE stream handler |
| `Rdr` | `Date.now` rate-limiter |
| `pMt` | `Object.entries` header case-normaliser |
| `dve` | `console.error` SDK log adapter |
| `BSn` | `NI` / `Es` / `ao` / `dUe` stream batch helper |
| `Ng` | `rAn` OAuth refresh helper |
| `Mz` | `$hn` error string builder |
| `GPr` | `e.replace` / `encodeURIComponent` URL builder |
| `ACe` | WIF token-exchange caller |
| `TZe` | WIF credentials resolver / fetcher |
| `nv` | `iH` notification helper |
| `yA` | Profile / credential selector |
| `xr` | Credential context accessor |
| `e_` | Environment variable accessor |
| `Ooe` | Provider-prefix finder |
| `mz` | Request-metadata helper |
| `Ks` | `HCe` header-cache builder |

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.