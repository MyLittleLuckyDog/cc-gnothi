---
type: feature-spec
feature: "resume"
cc_version: "2.1.160"
updated: "2026-06-02"
tags: ["resume", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.160 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/resume`

> Analysis basis: CC v2.1.160 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.160

---

## Overview

The `/resume` command (also accessible as `/continue`) allows a user to pick up a previous Claude Code conversation session by supplying a conversation ID or a search term. It enumerates live and persisted sessions, resolves the target session, guards against re-attaching to an actively running background agent, and then reconstructs the conversation context before handing control back to the interactive loop.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `resume` |
| description | `Resume a previous conversation` |
| argumentHint | `[conversation id or search term]` |
| aliases | `["continue"]` |
| module_id | `hc1` |
| load_inline | `true` |
| loc_byte | `12024424` |
| loc_byte_end | `12024621` |
| loc_line | `8214` |
| arbor_handler.name | `AXf` |
| arbor_handler.fqn | `claude-2.1.160::AXf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.160 bundle.js:+12024424

---

## Input Branching

The command has five or more distinct outcome branches (no match, single match, multiple matches, session still running as background agent, and skip/cancel), so a flowchart is used.

```mermaid
flowchart TD
    A(["/resume [arg]"]) --> B[List all live sessions\nvia listAllLiveSessions]
    B --> C[Resolve sessions\nusing sessionResolver]
    C --> D{Match result}
    D -->|No sessions found| E["Render: 'No conversations found to resume.'\n(bundle.js:+12023461)"]
    D -->|sessionNotFound\n(bundle.js:+12020670)| F["Render: session-not-found UI\nwith bold hint"]
    D -->|multipleMatches\n(bundle.js:+12020741)| G["Render: disambiguation list\nsorted by localeCompare"]
    D -->|Single match| H{Is session running\nas background agent?}
    H -->|Yes – interactive mode| I["Render error:\n'That session is still running as a\nbackground agent. Open claude agents\nto attach to it, or stop it there first\nto resume here.'\n(bundle.js:+12023026)"]
    H -->|No| J[Build conversation context\nvia contextBuilder]
    J --> K[Emit Date.now timestamp\n(bundle.js:+12023338)]
    K --> L[Apply session metadata\nslash_command_session_id\n(bundle.js:+12023722)\nslash_command_title\n(bundle.js:+12023946)]
    L --> M[Render conversation view\nvia conversationRenderer]
    M --> N([Return to interactive loop])
    D -->|User selects 'skip'\n(bundle.js:+12023229)| O([Cancel — no action])
```

---

## Behavioral Spec

### Session Enumeration (`xfH` — sessionListFetcher)

```
async function sessionListFetcher(context):
    sessions = await Promise.resolve()
    if daemonHandle is available:
        liveSessions = await daemonHandle.listAllLiveSessions()
    else:
        liveSessions = []
    return liveSessions
```

Analysis basis: CC v2.1.160 bundle.js:+12023016, +8895938

### Session Search and Resolution (`cCH` — sessionResolver)

The resolver accepts a raw argument string (conversation ID or search term) and returns one of several outcomes.

```
function sessionResolver(arg, allSessions):
    // Detect git worktrees for context (runs "git worktree list --porcelain")
    // telemetry: tengu_worktree_detection
    worktrees = detectWorktrees()          // bundle.js:+12020034, +12020045, +12020052

    // Normalise the raw argument
    normalised = arg.split(...)
    if normalised.startsWith("worktree "):  // bundle.js:+12020253
        trim offset 9 chars                 // bundle.js:+12020287

    // Attempt exact-ID lookup first
    exactMatch = allSessions.find(s => s.id matches normalised)

    if exactMatch:
        return { kind: "single", session: exactMatch }

    // Fall back to substring / fuzzy search
    candidates = allSessions.filter(s => s.startsWith(query) or contains query)
    candidates = candidates.sort((a,b) => a.localeCompare(b))  // bundle.js:+12020458

    if candidates.length == 0:
        return { kind: "sessionNotFound" }   // bundle.js:+12020670
    if candidates.length > 1:
        return { kind: "multipleMatches", list: candidates }  // bundle.js:+12020741
    return { kind: "single", session: candidates[0] }
```

Analysis basis: CC v2.1.160 bundle.js:+12020215, +12020240, +12020276, +12020379, +12020398, +12020425

### Background-Agent Guard (`AXf` — mainHandler)

Once a single session is resolved, the handler checks whether it is currently active as a background/interactive agent before attempting resumption.

```
async function mainHandler(resolvedSession, appContext):
    if resolvedSession.mode == "interactive":   // bundle.js:+8896029
        // Session is live as a background agent — block resumption
        displayError(
            "That session is still running as a background agent. " +
            "Open `claude agents` to attach to it, or stop it there first " +
            "to resume here."
        )
        // bundle.js:+12023026
        return

    // Proceed to context reconstruction
    timestamp = Date.now()   // bundle.js:+12023338
    contextElements = buildConversationContext(resolvedSession)
    ...
```

Analysis basis: CC v2.1.160 bundle.js:+12023016, +12023024, +12023026

### Context Reconstruction (`Kn` — contextBuilder)

Assembles the conversation messages and metadata needed to re-enter a past session.

```
function contextBuilder(session, options):
    // Retrieve stored messages via transcript reader (cCH, _1K)
    messages = loadTranscript(session.id)

    // Filter by applicable worktree / project root
    messages = messages.filter(m => m.startsWith(projectRoot))   // bundle.js:+12023580

    // Sort and render session entries
    entries = sortEntries(messages)                 // bundle.js:+13044344
    rendered = entries.map(e => renderEntry(e))    // bundle.js:+13044276

    // Build display buffer (VbH — transcriptRenderer)
    buffer = buildDisplayBuffer(rendered)          // bundle.js:+13056242

    return { messages, buffer, sessionId: session.id }
```

Analysis basis: CC v2.1.160 bundle.js:+12023847, +13031122, +13031140

### Session Metadata Attachment (`AXf`)

After context is built, two telemetry-adjacent string keys are attached to the app state before the conversation view is rendered.

```
function attachSessionMetadata(sessionId, title, appState):
    appState.set("slash_command_session_id", sessionId)   // bundle.js:+12023722
    appState.set("slash_command_title", title)            // bundle.js:+12023946
```

Analysis basis: CC v2.1.160 bundle.js:+12023722, +12023946

### Conversation View Rendering (`Ic1` — conversationRenderer)

```
function conversationRenderer(buffer):
    // Uses j6.bold for emphasis on key fields
    // bundle.js:+12020705
    return renderJSX(buffer)
```

Analysis basis: CC v2.1.160 bundle.js:+12023996, +12020705

### Error and Empty States

| Condition | Message / Behaviour |
|---|---|
| No sessions found | `"No conversations found to resume."` (bundle.js:+12023461) |
| Session not found by ID/term | `sessionNotFound` UI path, bold hint rendered (bundle.js:+12020670, +12020705) |
| Multiple ambiguous matches | `multipleMatches` disambiguation list displayed (bundle.js:+12020741) |
| Session running as background agent | Inline error message (bundle.js:+12023026) |
| User cancels selection | `"skip"` signal returned; no state change (bundle.js:+12023229) |

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — worktree detection | `tengu_worktree_detection` fired during session resolution (bundle.js:+12020134) |
| Telemetry — feature health | `tengu_feature_ok`, `tengu_feature_bad`, `tengu_feature_sad` emitted by sub-systems reached via `yH` (bundle.js:+966123, +966181, +966258) |
| Telemetry — daemon control | `tengu_daemon_control` (bundle.js:+15883547) |
| Telemetry — bg dispatch | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_dispatch_low_mem` reachable through daemon sub-graph |
| Telemetry — transcript | `tengu_transcript_phantom_parent`, `tengu_transcript_parent_cycle` (bundle.js:+13035849, +13039474) |
| appState changes | `slash_command_session_id` and `slash_command_title` written (bundle.js:+12023722, +12023946) |
| File I/O | Transcript files are read from the projects directory (`nc → sjH.join → "projects"`, bundle.js:+6681848); git worktree list is executed as a child process |
| Daemon interaction | `listAllLiveSessions` called on daemon handle if available (bundle.js:+8895938) |
| Hook registration | `O9 → HDA.register` reached through transcript persistence path (bundle.js:+59048) |
| Sound | No sound side-effects found in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.160 | Initial analysis |

---

## Common Mistakes

1. **Providing a partial ID that matches multiple sessions** — the command will show a disambiguation list rather than resuming. Supply a more specific prefix or the full UUID to avoid the `multipleMatches` branch.
2. **Trying to resume a session that is still running as a background agent** — the command blocks with an explicit error. Use `/agents` to attach or stop the background session first.
3. **Using `/resume` in a different working directory** — session matching uses git worktree context; running the command from a different project root may cause the session to appear not found even when it exists.
4. **Omitting the argument entirely** — without a conversation ID or search term, the resolver falls back to listing all sessions. In environments with many sessions this may trigger the `multipleMatches` path unexpectedly.
5. **Expecting `/resume` and `/continue` to behave differently** — they are registered aliases for the same handler; behaviour is identical.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `AXf` | Main async handler for `/resume` (arbor_handler) |
| `yc1` | Module-level initialiser / export wrapper for the resume command |
| `xfH` | Session list fetcher (calls `listAllLiveSessions`) |
| `cCH` | Session resolver — parses argument, searches sessions, detects worktrees |
| `Kn` | Context builder — loads and assembles past conversation messages |
| `Ic1` | Conversation view renderer (uses `j6.bold`) |
| `lh6` | Transcript project-root formatter |
| `_1K` | Transcript file scanner / directory walker |
| `VbH` | Display buffer builder for conversation entries |
| `DSf` | Transcript file reader / parser |
| `mAH` | App-state manager (large map of state keys) |
| `pfH` | State snapshot accessor |
| `SZ6` | State facade / combined accessor |
| `H1K` | State initialiser — calls `mAH` and `Object.assign` |
| `rmK` | Conversation persistence writer |
| `QuH` | Output queue / debounced writer |
| `R$H` | Session path resolver |
| `gwA` | Session directory path builder |
| `FwA` | File stat / rename / unlink helper |
| `imK` | Conversation append-file writer |
| `O9` | Hook registrar (calls `HDA.register`) |
| `xfH` | Session list fetcher |
| `yH` | Telemetry / error reporter (feature ok/bad/sad) |
| `d_` | Error string formatter |
| `FH` | String coercion helper |
| `n9` | Telemetry aggregator |
| `KNA` | Telemetry sub-reporter |
| `T14` | Rolling log buffer manager |
| `GH` | String converter used in context construction |
| `v_` | Session execution orchestrator |
| `jEH` | Child-process / execution engine |
| `Y_` | Directory path helper (calls `zN`) |
| `Rk8` | Session formatter / summary builder |
| `TWH` | Entry batch processor |
| `x1A` | Directory recursive reader |
| `ph6` | Metadata getter/setter |
| `Qz` | Path fragment normaliser |
| `qSf` | Directory existence / stat checker |
| `dT` | Directory listing helper |
| `C1A` | Combined context accessor |
| `YH6` | Message map helper |
| `d1A` | Compact-summary extractor |
| `Dy6` | Message content parser |
| `l1A` | Attachment/image filter |
| `mfH` | Chain builder (conversation thread walker) |
| `chf` | Parallel-chain deduplicator |
| `ghf` | Chain sorter |
| `a9K` | Session metadata setter |
| `b9K` | Conversation index manager |
| `K_` | Index lookup helper |
| `Fhf` | Walk-broken relink helper |
| `wS8` | State write helper |
| `jS8` | State array-from helper |
| `YS8` | Date-parse sort key helper |
| `aHK` | Daemon status writer |
| `ny6` | Status file path builder |
| `RO` | Path normaliser (NFC) |
| `E$` | Session export helper |
| `va` | UUID pattern tester |
| `ws` | Conversation context object |
| `l5H` | Session label formatter |
| `SH` | JSON stringify helper |
| `xwA` | Message content mapper |
| `x4` | Argument path extractor |
| `lmK` | Log-level debug formatter |
| `ADA` | Debug sub-logger |
| `PmH` | Write-through helper (calls `ZwA`) |
| `ZwA` | Stream writer |
| `N` | Core conversation renderer / main render function |
| `Y46` | Render sub-helper |
| `lmK` | Debug formatter |
| `cmK` | Debug classifier |
| `A46` | Renderer utility |
| `G8` | General utility (called from multiple sites) |
| `Ce` | Feature-flag checker (`F64.has`) |
| `wj` | String replace helper |
| `gq` | Model/prompt parser |
| `GHH` | Prompt structure builder |
| `lQ` | Prompt line tokeniser |
| `K1` | Model name normaliser |
| `DKH` | Model family classifier |
| `dN` | Model detail resolver |
| `tT` | Token budget calculator |
| `XDq` | Token budget wrapper |
| `xM` | API parameter builder |
| `xa6` | Streaming-support checker |
| `AgH` | API flag setter |
| `yP` | Prompt preprocessor |
| `R0` | Request object assembler |
| `t6` | CLI flag accessor |
| `d` | Core I/O / render primitive |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.