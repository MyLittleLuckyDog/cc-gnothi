---
type: feature-spec
feature: "resume"
cc_version: "2.1.196"
updated: "2026-06-30"
tags: ["resume", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.196 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/resume`

> Analysis basis: CC v2.1.196 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.196

---

## Overview

`/resume` (alias: `/continue`) lets the user re-enter a previously created Claude Code conversation by session ID or by a free-text search term. The command queries the daemon's live-session registry and the on-disk transcript store, then either restores the chosen session directly or presents an interactive picker when multiple matches exist. If the target session is still running as a background agent, the command blocks the resume and directs the user to `/agents` instead.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `resume` |
| description | `Resume a previous conversation` |
| argumentHint | `[conversation id or search term]` |
| aliases | `["continue"]` |
| module_id | `Czl` |
| load_inline | `true` |
| loc_byte | `12613572` |
| loc_byte_end | `12613769` |
| loc_line | `8488` |
| arbor_handler.name | `eqf` |
| arbor_handler.fqn | `claude-2.1.196::eqf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.196 bundle.js:+12613572

---

## Input Branching

The handler has five or more distinct decision branches (active session guard, no-results guard, UUID exact-match, single-result auto-select, multiple-results picker), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/resume [arg]"]) --> B{Arg provided?}
    B -- No arg --> C[List all sessions via listAllLiveSessions\n+ on-disk transcript scan]
    B -- Arg provided --> C

    C --> D{Session list empty?}
    D -- Yes --> E["Display: 'No conversations found to resume.'\n(bundle.js:+12612627)"]
    E --> Z([End])

    D -- No --> F{Arg looks like a UUID?\nNM / UUID-regex test\n(bundle.js:+12612728)}

    F -- UUID match --> G[Look up session by exact ID]
    F -- Not UUID / no arg --> H[Filter sessions by\nlowercase substring match on title/summary]

    G --> I{Session found?}
    H --> I

    I -- Not found --> J["Render 'sessionNotFound' JSX component\n(bundle.js:+12609843)"]
    J --> Z

    I -- Found: still running as bg agent --> K["Display error:\n'That session is still running as a background agent…'\n(bundle.js:+12612176)"]
    K --> Z

    I -- Found: exactly 1 match --> L[Auto-select session\nCall context.resume\n(bundle.js:+12612397)]

    I -- Found: 2+ matches --> M["Render 'multipleMatches' JSX picker\n(bundle.js:+12609914)"]
    M -- User selects --> L

    L --> N{context.resume succeeded?}
    N -- Error --> O["Log 'resume: context.resume failed'\n(bundle.js:+12612409)\nEmit error to logError"]
    N -- OK --> P[Build new conversation context:\nDate.now timestamp, slash_command_session_id,\nslash_command_title metadata\n(bundle.js:+12612535, +12612889, +12613114)]
    P --> Q[Invoke conversation-start pipeline\nGAe → Gr → LBe\n(bundle.js:+12612559)]
    Q --> Z([Session resumed])
```

---

## Behavioral Spec

### 1. Session Discovery (`sessionDiscovery` — `Zpe`)

The handler begins by calling the daemon's `listAllLiveSessions` to obtain all currently known live sessions (bundle.js:+8866664). In parallel (or immediately after), it scans on-disk transcript directories via the conversation index builder (`conversationIndexBuilder` — `qAe`, bundle.js:+12612867). The combined list is the candidate pool.

```
async function sessionDiscovery(daemonClient):
    liveSessions  = await daemonClient.listAllLiveSessions()
    indexedConvos = await buildConversationIndex()   // reads JSONL transcripts
    return merge(liveSessions, indexedConvos)
```

Analysis basis: CC v2.1.196 bundle.js:+12612166, +12612867

---

### 2. Argument Parsing and UUID Detection (`uuidDetect` — `NM`)

If the user supplied an argument, `NM` applies a compiled UUID regular expression (`PJc`) to decide whether the argument is an exact session ID (bundle.js:+12612728). This gates the branch between exact-ID lookup and fuzzy-title search.

```
function isUUID(arg):
    return PJc_regex.test(arg)
```

Analysis basis: CC v2.1.196 bundle.js:+12612728, +27889

---

### 3. Active-Agent Guard

Before allowing a resume, the handler checks whether the matched session is currently running as a background agent (flag value `"interactive"`, bundle.js:+8866755). When that flag is set, the resume is blocked and the following user-visible message is displayed (bundle.js:+12612176):

> "That session is still running as a background agent. Open `claude agents` to attach to it, or stop it there first to resume here."

The handler then returns early without modifying application state.

Analysis basis: CC v2.1.196 bundle.js:+12612176

---

### 4. Empty-Results Guard

When the candidate list is empty after all filtering, the handler displays the literal string `"No conversations found to resume."` (bundle.js:+12612627) and returns.

```
if candidates.length == 0:
    display("No conversations found to resume.")
    return
```

Analysis basis: CC v2.1.196 bundle.js:+12612627

---

### 5. Single vs. Multiple Match Resolution

```
function resolveMatch(candidates, arg):
    filtered = filterByArg(candidates, arg)   // substring on lowercased title

    if filtered.length == 0:
        renderComponent("sessionNotFound")    // bundle.js:+12609843
        return null

    if filtered.length == 1:
        return filtered[0]                    // auto-select

    // 2+ matches
    choice = await renderPicker("multipleMatches", filtered)  // bundle.js:+12609914
    return choice
```

The JSX picker component (`bzl`, which calls `It.bold` for formatting, bundle.js:+12609878) renders the session list with bold titles so the user can navigate and select.

Analysis basis: CC v2.1.196 bundle.js:+12609843, +12609914, +12609878

---

### 6. Context Resume (`contextResume` — `Re`)

After a session is chosen, `Re` (context-resume helper) is called (bundle.js:+12612397). On failure, the error string `"resume: context.resume failed"` (bundle.js:+12612409) is logged via `Ete.logError`, and the operation is aborted. The error is recorded under the category `"error"` (bundle.js:+1059453).

```
async function contextResume(session):
    try:
        result = await Re(session)
        return result
    catch error:
        Ete.logError("resume: context.resume failed", error)
        throw error
```

Analysis basis: CC v2.1.196 bundle.js:+12612397, +12612409

---

### 7. Conversation Initialization (`conversationInit` — `GAe`)

On a successful resume, the handler:

1. Records `Date.now()` as the conversation start timestamp (bundle.js:+12612535).
2. Attaches `slash_command_session_id` metadata (bundle.js:+12612889) to the new context, pointing at the resumed session's ID.
3. Attaches `slash_command_title` metadata (bundle.js:+12613114).
4. Calls `GAe` (conversation-start orchestrator, bundle.js:+12612559), which in turn calls `Gr` (git-worktree detection, bundle.js:+8854609), querying `git worktree list --porcelain` (literals: `"worktree"`, `"list"`, `"--porcelain"`, bundle.js:+8854618–8854636).
5. `Gr` then delegates to `LBe` (process executor / child-process launcher, bundle.js:+1146856) to spawn the sub-agent process if needed.

```
async function conversationInit(session, resumeResult):
    metadata = {
        slash_command_session_id: session.id,
        slash_command_title:      session.title,
        startedAt:                Date.now()
    }
    return await GAe(resumeResult, metadata)
```

Analysis basis: CC v2.1.196 bundle.js:+12612535, +12612559, +12612889, +12613114, +8854609

---

### 8. Worktree Detection (`worktreeDetect` — `GAe` inner)

`GAe` identifies the git worktree for the session's working directory by splitting `git worktree list --porcelain` output on newlines, looking for lines beginning with `"worktree "` (9 characters, bundle.js:+8854837, +8854871), and normalising paths with `o_` (NFC normalisation, bundle.js:+66884, `"NFC"` literal at +66896). The detected worktree path is passed downstream and logged as the `tengu_worktree_detection` telemetry event.

Analysis basis: CC v2.1.196 bundle.js:+8854799, +8854824, +8854860

---

### 9. Conversation Index Builder (`conversationIndexBuilder` — `qAe`)

`qAe` reads JSONL transcript files from the projects directory (`b2` / `sMe.join` + `"projects"`, bundle.js:+5422452). It filters entries by message type, sorts them by timestamp via `OYe` / `Date.parse` (bundle.js:+13647580), and assembles a ranked list of past conversations. Session metadata fields extracted during indexing include:

| Metadata key | Literal value | Byte offset |
|---|---|---|
| Summary | `"summary"` | 13671454 |
| Last prompt | `"last-prompt"` | 13671521 |
| Custom title | `"custom-title"` | 13671725 |
| AI title | `"ai-title"` | 13671803 |
| Tag | `"tag"` | 13671873 |
| Agent name | `"agent-name"` | 13672010 |
| Mode | `"mode"` | 13672240 |
| Permission mode | `"permission-mode"` | 13672303 |

Analysis basis: CC v2.1.196 bundle.js:+13663468, +13664016, +13671454–13672303

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_worktree_detection` (bundle.js:+8854718) — fired during worktree discovery for the resumed session |
| Telemetry (transitive, bg-layer) | `tengu_daemon_control`, `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_retire_pinned_low_mem`, `tengu_bg_prewarm_per_sweep`, `tengu_daemon_idle_exit`, `tengu_daemon_yield`, `tengu_daemon_config_reload` — emitted by the background-agent and daemon layers exercised on resume |
| Telemetry (transcript layer) | `tengu_transcript_phantom_parent`, `tengu_transcript_parent_cycle`, `tengu_relink_walk_broken`, `tengu_chain_parent_cycle`, `tengu_chain_timestamp_fallback`, `tengu_chain_parallel_tr_recovered` — fired during conversation index reconstruction |
| appState changes | `slash_command_session_id` and `slash_command_title` are written into the new conversation context (bundle.js:+12612889, +12613114) |
| Error logging | `"resume: context.resume failed"` is sent to `Ete.logError` under category `"error"` on context-resume failure (bundle.js:+12612409) |
| Hook registration | No direct hook registration found in depth-2 traversal |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Child process | `LBe` may spawn a sub-agent process via `hz.spawn` when resuming into a worktree-based session (bundle.js:+17995249) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.196 | Initial analysis |

---

## Common Mistakes

1. **Trying to resume an active background session directly** — `/resume` will refuse with a clear message and redirect you to `claude agents`. You must detach or stop the background session first before `/resume` will allow re-entry.
2. **Passing a partial UUID** — the UUID-detection regex (`PJc`) requires a full UUID format. A truncated ID will fall through to fuzzy-title search, potentially matching unintended conversations.
3. **Using `/resume` when no prior sessions exist** — if the projects directory contains no transcript files and the daemon has no live sessions, the command immediately returns `"No conversations found to resume."` with no further interaction.
4. **Expecting instant resume across worktrees** — when the resumed session is associated with a git worktree, `GAe` runs `git worktree list --porcelain` before handing off; slow or broken git repos will delay or error the resume.
5. **Confusing `/continue` with a continuation of the *current* session** — `/continue` is only an alias for `/resume`; it presents the same session-picker flow and does not auto-continue the session that is currently open.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `eqf` | Main async handler for `/resume` (Arbor-resolved, `module_id` path) |
| `Izl` | Session list filter helper (pre-handler) |
| `qg` | Shared utility called by list filter and main handler |
| `Zpe` | Live-session fetcher; calls `listAllLiveSessions` |
| `Re` | Context-resume helper; emits `"resume: context.resume failed"` on error |
| `er` | Error constructor wrapper |
| `ct` | String coercion utility |
| `zi` | Telemetry level resolver |
| `Fbs` | Telemetry formatter |
| `_Nu` | Telemetry queue manager (shift/push) |
| `Uo` | Object.assign-based state merger |
| `he` | String helper used in context building |
| `GAe` | Conversation-start orchestrator; triggers worktree detection and process launch |
| `Gr` | Git worktree query + child-process delegation |
| `LBe` | Child-process executor (spawns sub-agent) |
| `svs` | Process spawn helper (sets up stdio) |
| `Bkr` | Spawn option builder A |
| `Gkr` | Spawn option builder B |
| `jkr` | Spawn option builder C |
| `fCs` | Numeric-argument validator (`Number.isFinite`) |
| `hkt` | Process result validator |
| `Fkr` | `Reflect.apply` wrapper |
| `WCs` | Event-listener registration helper (`e.on "exit"`) |
| `pCs` | Timeout-race wrapper (`Promise.race` + `clearTimeout`) |
| `mCs` | Process kill helper (`e.kill` + `r.finally`) |
| `uCs` | stdout/stderr data handler |
| `dCs` | Forced-kill handler |
| `BCs` | Parallel-streams collector (`Promise.all`) |
| `Ekt` | Exit-code extractor |
| `$Cs` | Pipe attachment helper |
| `FCs` | Stream-set manager |
| `_Cs` | Bound stdio bind helper |
| `nI` | "forced shutdown" emitter |
| `rFu` | String-coercion wrapper for exec output |
| `T` | API request builder / message formatter |
| `eeu` | Request serialiser |
| `Me` | `JSON.stringify` wrapper |
| `Pc` | Path formatter (slice/lastIndexOf/at) |
| `KQe` | Locale-sensitive string helper |
| `oeu` | Context builder (joins dir, reads file, measures buffer) |
| `rn` | Shared runtime reference |
| `nFu` | Runtime-reference wrapper |
| `V` | Shared value/state cell |
| `l` | Session-or-path object used in worktree lookup |
| `eoc` | Daemon status file reader (`daemon.status.json`) |
| `Zte` | Status file path resolver |
| `Ks` | AsyncLocalStorage store getter |
| `HZt` | Status-file path builder (`Zrc.join` + `"daemon.status.json"`) |
| `o_` | Path normaliser (NFC) |
| `dr` | Project-root resolver |
| `g0` | Low-level path helper |
| `Zir` | Context-injection helper |
| `Len` | System-prompt assembler |
| `auc` | File-context collector (readdir, realpath, stat) |
| `b2` | Projects-directory path builder |
| `E` | MCP/SDK connection manager |
| `o` | Column-padding formatter |
| `Fo` | Tool-list builder |
| `BUe` | Batch file-context builder |
| `Sjo` | Recursive directory scanner |
| `_en` | File-cache manager (get/set) |
| `PS` | Path sanitiser (replace/slice) |
| `A` | User-info / auth-record accessor |
| `d` | Supervisor / daemon-worker controller |
| `I` | Scroll/layout math helper |
| `m` | HTTP-route or array-type handler |
| `h` | Background-session lifecycle manager |
| `y` | lqe-based mapping helper |
| `g` | Sub-function container `f` |
| `_` | Flat-array helper |
| `$Ye` | System-prompt buffer builder |
| `Eim` | Prompt-segment injector |
| `NM` | UUID detector (uses `PJc` regex) |
| `Qoe` | Conversation-object constructor |
| `qAe` | Conversation index builder (reads transcript JSONL) |
| `nfe` | Full transcript parser and metadata extractor |
| `Psm` | Transcript-parsing initialiser |
| `P` | Transcript-map storage |
| `bW` | Transcript walk helper |
| `YQe` | JSONL token parser |
| `lln` | JSONL line validator |
| `cln` | JSONL line cleaner |
| `_E` | Metadata field extractor |
| `a` | Spend/billing response handler |
| `kge` | `JSON.stringify` billing helper |
| `c` | `yn`-delegating helper |
| `yn` | Daemon IPC writer |
| `f` | Path normaliser for Windows (`L8`) |
| `L8` | Windows-path replacer (`oN.normalize` + `jt`) |
| `QTe` | Array-type-checking filter |
| `H` | Worker-kill map |
| `v` | Shared value store |
| `w` | Rate-limit / token-budget tracker |
| `hJ` | Token-budget base helper |
| `L` | Away-summary gating logic |
| `UOc` | Array `.at` accessor wrapper |
| `$Oc` | Tool-result set manager |
| `q` | Allow-list or request-queue |
| `Y` | `ytn`-delegating helper |
| `x` | Cookie-string splitter |
| `k` | File-watcher + interval manager |
| `O` | Background-worker sweep scheduler |
| `M` | Full MCP/OAuth/HTTP route handler (large) |
| `Ots` | Route-pair helper (`Mts`/`Dts`) |
| `B` | Route-sub helper |
| `M8c` | `sXe`-based route helper |
| `zts` | `startsWith`-based route matcher |
| `Ats` | Route-auth helper |
| `ee` | Slice helper |
| `Zts` | Route-token validator |
| `dVc` | UUID + token generator |
| `qHr` | Shared HTTP helper |
| `qie` | `Response.json` wrapper |
| `H8c` | Random-float generator |
| `h8c` | `randomBytes` wrapper |
| `Lts` | SHA-256 hash creator |
| `vts` | Token-store setter |
| `VHr` | Key-derivation helper |
| `Lon` | `sXe`/`ZHr` login helper |
| `N` | HTTP-request dispatcher |
| `d8c` | OAuth-state encoder |
| `iXe` | OAuth-callback HTML builder |
| `p8c` | `Sts`-based helper |
| `wts` | Token-store writer |
| `oe` | Promise.all + claim mapper |
| `ye` | Token-store update helper |
| `hu` | `M2m`-delegating token helper |
| `X` | Voice / recording session manager |
| `ne` | JWT claims parser |
| `n_r` | Header-entry scanner |
| `bVc` | Billing-timestamp helper |
| `CVc` | Parallel-request circuit manager |
| `tVc` | `Response.json` + `Gts` route helper |
| `J8c` | `sBm.includes` check |
| `Q8c` | Full HTTP-request processor |
| `Y8c` | Bedrock auth applicator |
| `uim` | JSONL binary parser (Buffer.allocUnsafe, openSync) |
| `suc` | Buffer `.at` helper |
| `Gt` | `JSON.parse` wrapper |
| `lim` | Buffer comparator |
| `j` | Timeout-based write-queue manager |
| `z` | MCP-update applicator |
| `yhe` | `JSON.parse` helper for transcript records |
| `dim` | JSONL file reader (openSync/readSync/closeSync) |
| `W` | Keyboard / UI input pair |
| `kcc` | Conversation-chain walker |
| `Ksm` | Chain-relink walker |
| `Mo` | `$Xe` flag helper |
| `$n` | Passthrough `t` helper |
| `cim` | JSONL chunk accumulator (Buffer.concat) |
| `rwe` | Stream-framing parser |
| `jFu` | Frame-prefix helper |
| `VFu` | Delimiter-search helper |
| `KFu` | JSON-frame extractor |
| `qFu` | Line-end frame extractor |
| `zo` | `rn`-delegating helper |
| `K` | Key-event handler (preventDefault) |
| `ae` | Input-composition state manager |
| `Ytn` | Composition helper |
| `le` | Trim-delegate helper |
| `re` | Voice-focus handler (calls `X`) |
| `Z` | Snapshot file manager (lstat/rm/readFile) |
| `Qse` | Snapshot read helper |
| `WBl` | Snapshot unlink helper |
| `OYe` | Timestamp parser (`Date.parse`) |
| `D` | Low-level writer (`d.write`) |
| `Mjo` | `OYe`-based date converter |
| `VAe` | Session-chain builder (relinks parents) |
| `Jsm` | Chain NaN-check / deduplicator |
| `Xsm` | Parallel-transcript recovery sorter |
| `zsm` | Chain-sort helper |
| `ruc` | Chain-range accumulator |
| `CHt` | `e.map` formatter |
| `kjo` | Title extractor (replaceAll/slice) |
| `NQt` | Title normaliser (Array.isArray check) |
| `Ol` | Markdown-trim parser (exec/slice) |
| `Pjo` | Content-type filter |
| `Qsm` | Content-type trimmer |
| `Zsm` | Content-type array tester |
| `FAe` | Shared filter flag |
| `JPe` | Shared predicate helper |
| `aur` | Accumulator get/set/push helper |
| `lur` | `Array.from` values helper |
| `jAe` | Conversation-resume context assembler |
| `iuc` | Transcript-init caller (`nfe` + `Object.assign`) |
| `pim` | Project-path resolver (stat + join) |
| `t3` | `g0`-delegating path helper |
| `zL` | Directory lister (`nN.readdir`) |
| `yjo` | Conversation-item accessor (at/kjo/CHt/Pjo) |
| `OTe` | Output-type extractor |
| `_Z` | Search/filter orchestrator (calls `GAe`, `auc`, `$Ye`) |
| `bzl` | JSX renderer for session-not-found / multiple-matches UI (`It.bold`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.