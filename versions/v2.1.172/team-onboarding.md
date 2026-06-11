---
type: feature-spec
feature: "team-onboarding"
cc_version: "2.1.172"
updated: "2026-06-11"
tags: ["team-onboarding", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.172 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/team-onboarding`

> Analysis basis: CC v2.1.172 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.172

---

## Overview

`/team-onboarding` is a `prompt`-type slash command that analyses the invoking user's local Claude Code session transcripts (from the past year) and co-authors a ready-to-ship `ONBOARDING.md` guide for teammates who are new to Claude Code. The guide is generated immediately from real usage data — work-type breakdown, repository context, MCP server setup, and ASCII bar charts — and is then refined collaboratively through a structured review conversation.

---

## Registration

| Field | Value |
|---|---|
| type | `prompt` |
| name | `team-onboarding` |
| description | `Help teammates ramp on Claude Code with a guide from your usage` |
| isHidden | `false` |
| handler_method | `getPromptForCommand` |
| handler_method_start (byte) | `12326317` |
| handler_method_end (byte) | `12327027` |
| loc_byte | `12325979` |
| loc_byte_end | `12327028` |
| loc_line | `8550` |
| prompt_body.length | `4539` characters |
| prompt_body.trace | `identifier→$ (local→1 ext vars)` |
| arbor_handler.name | `getPromptForCommand` |
| arbor_handler.fqn | `claude-2.1.172::getPromptForCommand` |
| arbor_handler.kind | `Method` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `2` |
| `handler_method_start` | `12326317` |
| `handler_method_end` | `12327027` |

Analysis basis: CC v2.1.172 bundle.js:+12325979

---

## Input Branching

The handler has more than three distinct execution paths (session-data present vs. absent, template substitution branches, guide generation vs. error paths), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/team-onboarding invoked"]) --> B[Emit telemetry: tengu_team_onboarding_invoked]
    B --> C[Call usageDataCollector — scan local .jsonl transcripts\nlast 365 days · Math.min/max/floor clamping]
    C --> D{Transcript files found?}
    D -- "~0 sessions" --> E[Set USAGE_DATA with empty/minimal payload\nwork-type breakdown left as TODO]
    D -- "sessions present" --> F[Parse each .jsonl file\nExtract sessionDescriptors array]
    F --> G[Resolve currentRepo via git config user.name\nand git remote get-url origin]
    G --> H[Read .mcp.json → mcpServers map]
    H --> I[Build USAGE_DATA JSON blob]
    E --> J
    I --> J[Substitute template variables:\n{{WINDOW_DAYS}} → 365\n{{USAGE_DATA}} → JSON blob\n{{GUIDE_TEMPLATE}} → guide skeleton]
    J --> K[Call getPromptForCommand — assemble final prompt string\nusing replaceAll on variable placeholders]
    K --> L[Emit telemetry: tengu_flint_harbor_prompt]
    L --> M[Send prompt to agent — type: text]
    M --> N[Agent outputs acknowledgment line FIRST\nthen classifies sessions into task types]
    N --> O[Agent writes ONBOARDING.md in one pass]
    O --> P[Agent renders guide in code block\nthen asks 3 Review questions]
    P --> Q{User answers Review}
    Q -- "Provides team name / tips / starter task" --> R[Agent updates ONBOARDING.md\nwrites final save confirmation line]
    Q -- "Further edits requested" --> R
    R --> S[Emit telemetry: tengu_team_onboarding_generated]
    S --> T([Done])
```

Analysis basis: CC v2.1.172 bundle.js:+12326317 (handler method), +12326520 (Math clamping), +12326566 (365-day constant), +12326777 (WINDOW_DAYS placeholder), +12326817 (GUIDE_TEMPLATE placeholder), +12326852 (USAGE_DATA placeholder)

---

## Behavioral Spec

### 1 — Handler Invocation and Telemetry

When the command is invoked, the handler (`getPromptForCommand`) is called directly (Arbor resolution: `direct`, 2 hits). Immediately after entry, the `tengu_team_onboarding_invoked` telemetry event is fired.

```
function handleTeamOnboarding(context):
    emit("tengu_team_onboarding_invoked")
    usageData = collectUsageData(context)
    promptText = buildPrompt(usageData)
    emit("tengu_flint_harbor_prompt")
    return { type: "text", content: promptText }
```

Analysis basis: CC v2.1.172 bundle.js:+12326323 (getPromptForCommand call edge), +12326577 (tengu_team_onboarding_invoked), +12326354 (tengu_flint_harbor_prompt)

---

### 2 — Usage Data Collection (`usageDataCollector` / `UqK`)

The data-collection function reads the user's local Claude Code transcript directory. The observation window is computed via `Math.min`, `Math.max`, and `Math.floor` to clamp the day count; the literal `365` (days) sets the upper bound of the window.

```
async function collectUsageData(context):
    nowMs        = Date.now()
    windowDays   = Math.floor(Math.min(Math.max(0, configuredDays), 365))
    cutoffMs     = nowMs - windowDays * 24 * 60 * 60 * 1000

    transcriptDir = resolveTranscriptDir(context)   # uses Su / MI helpers
    files = await readdir(transcriptDir)
    jsonlFiles = files.filter(f => extname(f) == ".jsonl")

    sessions = await Promise.all(
        jsonlFiles.map(async file =>
            stat = await statFile(join(transcriptDir, file))
            if not stat.isFile(): return null
            if stat.mtimeMs < cutoffMs: return null
            raw = await readFile(join(transcriptDir, file))
            return parseSessionDescriptor(raw)
        )
    )
    sessions = sessions.filter(not null)

    mcpConfig    = await readMcpJson()       # bU7: reads .mcp.json → mcpServers
    repoInfo     = await resolveRepoInfo()   # u_:  git config user.name + git remote get-url origin
    generatedBy  = repoInfo.userName

    return buildUsageBlob(sessions, mcpConfig, repoInfo, generatedBy, windowDays)
```

Key constants:
- Observation window upper bound: **365 days** (bundle.js:+12326566)
- Transcript file filter: `.jsonl` extension (bundle.js:+12314930)
- Concurrency: `Promise.all` over file list (bundle.js:+12314949)
- MCP config file: `.mcp.json` → key `mcpServers` (bundle.js:+12317041, +12317097)
- Git identity lookup: `git config user.name` (bundle.js:+12317680)
- Git remote lookup: `git remote get-url origin` (bundle.js:+12317736, +12317745, +12317755)

Analysis basis: CC v2.1.172 bundle.js:+12326520 (Math clamping), +12314802 (Date.now), +12314843 (readdir), +12314913 (extname), +12315014 (stat), +12315186 (readFile), +12317363 (UqK entry), +12317480 (bU7 entry), +12317661 (u_ entry)

---

### 3 — Session Descriptor Parsing

Each `.jsonl` file is read as UTF-8 text and split on newlines. The parser looks for lines containing `"name":"mcp__` (to identify MCP tool calls) and `"content":[` (to extract first user messages). Regular expressions (`kU7`, `yU7`, `SU7`) are applied to extract titles, PR numbers, and message text. Lines starting with a known prefix are sliced to recover the payload.

```
function parseSessionDescriptor(rawText):
    lines = rawText.split("\n")
    descriptor = { title: null, prNumbers: [], firstUserMessage: null,
                   toolCount: 0, mcpCount: 0 }

    for line in lines:
        if MCP_NAME_REGEX.exec(line):   # detects "name":"mcp__
            descriptor.mcpCount += 1
        if CONTENT_REGEX.exec(line):    # detects "content":[
            if descriptor.firstUserMessage == null:
                descriptor.firstUserMessage = extractMessage(line)
        if TITLE_REGEX.exec(line):
            descriptor.title = extractTitle(line)
        if PR_REGEX.exec(line):
            descriptor.prNumbers.push(Number(extractPR(line)))

    return descriptor
```

Sentinel strings observed:
- `"name":"mcp__` (bundle.js:+12315509) — MCP tool-call detector
- `"content":[` (bundle.js:+12315859) — content array start
- Minimum sessions yielding non-empty classification: **3** sessions (bundle.js:+12315962)

Analysis basis: CC v2.1.172 bundle.js:+12315300 (split), +12315341 (includes), +12315387 (matchAll), +12315650 (kU7.exec), +12315706 (yU7.exec), +12315881 (SU7.exec), +12315966 (startsWith), +12315999 (slice)

---

### 4 — MCP Server Resolution (`bU7`)

The function reads `.mcp.json` from the project root, parses it as JSON, and extracts the `mcpServers` map. Each entry's `name` (and optionally `urlOrigin`) is used by the agent to infer what the server does and how a teammate would obtain access.

```
async function readMcpJson(projectRoot):
    path = join(projectRoot, ".mcp.json")
    try:
        raw  = await readFile(path)
        data = JSON.parse(raw)
        return data.mcpServers ?? {}
    except (ENOENT | parse error):
        return {}
```

Analysis basis: CC v2.1.172 bundle.js:+12317017 (readFile), +12317030 (join), +12317041 (.mcp.json literal), +12317064 (n6 / JSON.parse), +12317097 (mcpServers key)

---

### 5 — Repository Info Resolution (`u_` / `dvH`)

Git subprocess calls resolve the guide creator's identity and the remote origin URL. Output is trimmed and lowercased for matching.

```
async function resolveRepoInfo(cwd):
    userName  = await runGit(["config", "user.name"], cwd)
    originUrl = await runGit(["remote", "get-url", "origin"], cwd)
    repoName  = basename(originUrl)   # path.basename via op8
    return { userName: userName.trim(), originUrl, repoName }
```

The `dvH` helper further normalises the URL: strips a leading `git/` prefix (4 chars, bundle.js:+12317664/+1143869), applies `.replace` and `.slice`, then `.toLowerCase()`.

Analysis basis: CC v2.1.172 bundle.js:+12317661 (u_ call edge), +12317664 (git literal), +12317671 (config literal), +12317680 (user.name literal), +12317736 (remote literal), +12317745 (get-url literal), +12317755 (origin literal), +12317844 (dvH), +12317852 (op8.basename)

---

### 6 — Prompt Assembly and Template Substitution

The handler assembles the final prompt string by calling `replaceAll` on three placeholder tokens, then wrapping in a `{ type: "text" }` envelope.

```
function buildPrompt(usageBlob, windowDays, guideTemplate):
    body = PROMPT_TEMPLATE                          # 4539-char string in bundle
    body = body.replaceAll("{{WINDOW_DAYS}}", String(windowDays))
    body = body.replaceAll("{{USAGE_DATA}}",  JSON.stringify(usageBlob))
    body = body.replaceAll("{{GUIDE_TEMPLATE}}", guideTemplate)
    return { type: "text", content: body }
```

Template placeholder literals (bundle.js):
- `{{WINDOW_DAYS}}` → +12326777
- `{{GUIDE_TEMPLATE}}` → +12326817
- `{{USAGE_DATA}}` → +12326852

Analysis basis: CC v2.1.172 bundle.js:+12326764 (replaceAll call), +12326795 (String coercion), +12327011 ("text" envelope key)

---

### 7 — Agent Execution Protocol (as instructed by the prompt)

The prompt instructs the agent to follow a strict five-step protocol. The ordering constraint on the acknowledgment line is explicit and enforced before any other reasoning.

```
procedure agentExecution(prompt):

    # Step 1 — mandatory first output (no thinking permitted before this)
    output "> Looking at how you've used Claude over the last N days…"

    # Step 2 — classify sessions
    for session in prompt.usageData.sessionDescriptors:
        taskType = classifySession(session)
        # categories: build_feature | debug_fix | improve_quality |
        #             analyze_data | plan_design | prototype | write_docs
    pick top 3–5 categories with rough percentages
    render category names in "Title Case" (not snake_case)

    # Step 3 — gather context
    repos    = [currentRepo] + siblingDirs(workspace)
    mcpSetup = inferMcpAccess(prompt.usageData.mcpServers)
    # Team Tips and Get Started remain as TODO placeholders

    # Step 4 — write ONBOARDING.md
    writeFile("ONBOARDING.md", renderGuide(
        workBreakdown, repos, mcpSetup,
        asciiBarCharts(workBreakdown, width=20),   # █ filled, ░ empty
        generatedBy = prompt.usageData.generatedBy
    ))

    # Step 5 — render guide in code block + Review questions
    output codeBlock(ONBOARDING.md)
    output "---"
    output "**Review**"
    output "1. Team name confirmation or question"
    output "2. Starter task request (ticket/doc link, optional)"
    output "3. Team tips not already in CLAUDE.md"

    # After user replies:
    updateFile("ONBOARDING.md", answers)
    output "Saved to `ONBOARDING.md`. Drop it in your team docs…"
    # Apply any further edits on request
```

Analysis basis: CC v2.1.172 bundle.js:+12326317–12327027 (prompt body via getPromptForCommand)

---

### 8 — Transcript Sharing Telemetry Hook (`Gq6`)

After the guide is generated, a secondary call graph branch via `Gq6` fires the `tengu_flint_harbor_share` event. This shares the invocation context into the Flint Harbor telemetry pipeline (the same pipeline used by the `/share` family of commands, via `BE` → `W9`).

```
function postGenerationHook(context):
    emit("tengu_team_onboarding_generated")
    flintHarborShare(context)   # Gq6 → BE → W9
    emit("tengu_flint_harbor_share")
```

Analysis basis: CC v2.1.172 bundle.js:+12326873 (Gq6 call), +12326896 (tengu_team_onboarding_generated), +10103449 (BE), +10103473 (tengu_flint_harbor_share)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: tengu_team_onboarding_invoked | Fired at handler entry (bundle.js:+12326577) |
| Telemetry: tengu_flint_harbor_prompt | Fired when prompt is dispatched to agent (bundle.js:+12326354) |
| Telemetry: tengu_team_onboarding_generated | Fired after guide generation completes (bundle.js:+12326896) |
| Telemetry: tengu_flint_harbor_share | Fired via Gq6/BE post-generation hook (bundle.js:+10103473) |
| Telemetry: tengu_config_parse_error | May fire if config read fails during data collection (bundle.js:+3314707) |
| Telemetry: tengu_config_lock_contention | May fire if config lock is contested during file writes (bundle.js:+3312132) |
| Telemetry: tengu_config_auth_loss_prevented | Safety guard if auth fields would be wiped (bundle.js:+3312611) |
| File written | `ONBOARDING.md` created/updated in working directory |
| File read | `.mcp.json` from project root (ENOENT is silently ignored) |
| Subprocess | `git config user.name` and `git remote get-url origin` |
| File system | Local `.jsonl` transcript files read (read-only); `stat` used to filter by mtime |
| Config lock | Shared config lock (`W7H`) acquired during any config write in the call graph |
| Hook registration | `y9` → `hZA.register` observed in Gx4 (file-watch registration path) |
| appState changes | None observed in depth-2 traversal |
| Sound | None observed |

---

## Version History

| Version | Change |
|---|---|
| v2.1.172 | Initial analysis — command introduced; 4539-char prompt body; 365-day window; five-step agent protocol; ASCII bar chart rendering |

---

## Common Mistakes

1. **Running from a directory with no transcripts.** If the Claude Code transcript directory is empty or all files predate the 365-day window, `USAGE_DATA` will be sparse and the work-type breakdown will be emitted as a `TODO`. The guide is still generated but will be less useful.
2. **Missing `.mcp.json`.** If the project has no `.mcp.json`, the MCP server section of the guide will be omitted. The command treats the file as optional (ENOENT is caught silently).
3. **No git remote configured.** `git remote get-url origin` will fail if the repository has no remote named `origin`. The `repoName` field in the guide will fall back to the directory basename; `originUrl` will be blank.
4. **Expecting the agent to ask questions before drafting.** The prompt explicitly instructs the agent to produce a full draft immediately and only then ask review questions. Attempting to interrupt with clarifying questions before the draft will not match the intended flow.
5. **Editing `ONBOARDING.md` by hand before the Review step.** The agent is instructed to overwrite the file with the reviewed version after the user's answers; manual edits made between the initial draft and the Review response may be lost.
6. **Confusing `generatedBy` absence.** If `git config user.name` returns nothing (empty repository or no global git identity), the guide omits the author byline entirely rather than inserting a placeholder.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `__handler_team-onboarding` | Synthetic BFS entry point for the command handler (not a real bundle symbol) |
| `Y6` | Usage data orchestrator / transcript scanning coordinator |
| `N26` | Sub-helper called from transcript coordinator (role unclear at depth 2) |
| `h26` | Sub-helper called from transcript coordinator (role unclear at depth 2) |
| `Ym` | Intermediate dispatcher within transcript coordinator |
| `eu` | Core session/event utility shared across telemetry paths |
| `nC` | Low-level event emission helper (calls oJ4, QO, Zz6) |
| `N78` | Deduplication guard — checks/adds to seen-set before processing |
| `_J_` | Session record builder; generates UUID, emits to event bus |
| `GhH` | Sub-helper within session record builder |
| `QB` | Random-bytes generator for session IDs (32 bytes, hex-encoded) |
| `CH` | JSON serialiser wrapper (delegates to JSON.stringify) |
| `lX4` | Post-emit hook within session record builder |
| `qZ_` | Session pipeline stage after deduplication |
| `Lu1` | Normalisation helper called from qZ_ |
| `B_` | Branch within qZ_ (role unclear at depth 2) |
| `X_9` | Branch within qZ_ (role unclear at depth 2) |
| `j8H` | Set-membership check against Dkf |
| `b6` | Config read/write orchestrator (uses W7H, Gx4, Date.now) |
| `o6` | Logging/debug output helper |
| `jZ_` | Sub-helper within config orchestrator |
| `W7H` | Config file reader/writer with lock, backup, and ENOENT handling |
| `q` | Filesystem module reference (readFileSync, statSync, etc.) |
| `n6` | JSON.parse wrapper |
| `bu` | String prefix-strip helper (startsWith + slice) |
| `_` | Generic utility / filesystem ops reference |
| `N8` | Error normaliser / code extractor |
| `S_9` | Sibling-directory discovery (basename, readdirSync, path joins) |
| `N` | String formatter with case conversion and includes checks |
| `c` | App state / context accessor |
| `XZ_` | Path join + atomic-write helper |
| `D` | Daemon / background session manager (spawn, retire, low-mem checks) |
| `Gx4` | File-watcher setup/teardown (watchFile, unwatchFile) |
| `wF` | Sub-helper within file-watcher |
| `y9` | Hook registration entry point (→ hZA.register) |
| `E8` | Transcript scan entry point (calls F78, W7H, etc.) |
| `F78` | Per-file transcript processor (stat, read, parse, copy, backup) |
| `f` | Async task/file handle manager |
| `L` | Stream/socket lifecycle manager (close, finally) |
| `mV1` | Object-assign merge helper for session metadata |
| `dY_` | Sub-helper called from mV1 |
| `brH` | Auth-loss prevention guard for config writes |
| `A` | String lowercasing utility |
| `V` | String with startsWith check in transcript processor |
| `P` | Byte-buffer / IPC message framer |
| `X` | Socket/timeout handler |
| `j` | Process kill orchestrator |
| `I7` | Stream end + JSON serialise helper |
| `x05` | Main IPC/PTY message dispatcher (large handler) |
| `EH` | String coercion helper |
| `E` | Array slice with Math.min/max bounds |
| `W` | SDK connection manager (Promise.all, connected/failed states) |
| `Sz6` | Atomic file write via temp file + rename (symlink-aware) |
| `O` | Stat/stream object (isSymbolicLink, removeAllListeners, etc.) |
| `R8` | Error code extractor (→ N8) |
| `H` | Random/timeout utility (Math.random + setTimeout) |
| `HJH` | Sub-helper in transcript scan entry |
| `y_9` | Object.entries iterator helper |
| `b26` | Date.now timestamp helper |
| `B78` | Backup file writer (Sz6 delegator for config backups) |
| `xU7` | Top-level usage data collector (orchestrates UqK, bU7, u_, dvH) |
| `P_` | Sub-helper at start of xU7 (→ BG) |
| `BG` | Initialisation/boot helper called from P_ |
| `Su` | Transcript directory path resolver (Ja.join + MI + Sw) |
| `MI` | Projects sub-path builder (Ja.join + A_) |
| `Sw` | Path string normaliser (replace, slice, dRf) |
| `dRf` | Absolute-value + dwH offset calculator for path normalisation |
| `UqK` | JSONL file reader and session descriptor extractor (core data loop) |
| `T9` | Error code checker (→ N8) |
| `K` | Array map + padEnd formatter |
| `$` | Top-level prompt template variable (holds the 4539-char prompt body) |
| `TwK` | Prompt body builder / template resolver (pa, d9, km6, CH) |
| `z` | Runtime environment / process wrapper (kH, bH, wS, CU) |
| `kH` | Feature-flag check — ok branch (→ tengu_feature_ok) |
| `bH` | Feature-flag check — bad branch (→ tengu_feature_bad) |
| `wS` | Event emission helper (eu, GhH, HJ_) |
| `CU` | Process exit / race-condition handler (Promise.race + process.exit) |
| `Y` | AbortController / forced-shutdown handler |
| `HX` | Sub-helper in Y (forced shutdown label) |
| `bU7` | MCP config reader (.mcp.json → mcpServers) |
| `CU7` | Sub-helper called after bU7 in xU7 |
| `u_` | Git subprocess runner (git config user.name, git remote get-url origin) |
| `BvH` | Child-process spawner and lifecycle manager |
| `uQA` | Process argument builder (win32 → .exe/cmd path handling) |
| `wq_` | NQA-delegating sub-helper |
| `Yq_` | NQA + Ibf sub-helper |
| `jq_` | Sbf sub-helper |
| `dgA` | Number.isFinite guard / TypeError thrower |
| `Cz6` | Error builder for child-process failures |
| `zq_` | Reflect.apply + Reflect.defineProperty proxy helper |
| `GQA` | Process 'exit' event listener registrar |
| `QgA` | Promise.race + setTimeout/clearTimeout for process timeout |
| `cgA` | Process kill helper (H.kill + q.finally) |
| `FgA` | Bound stdio handler |
| `ggA` | Bound process kill handler |
| `PQA` | Promise.all over process output streams |
| `mz6` | c9_ sub-helper in process manager |
| `JQA` | Zbf + A.pipe stream connector |
| `XQA` | YQA.default + A.add set registration |
| `rgA` | Hq_.bind handler registration |
| `ubf` | String coercion helper for process output |
| `v3` | Sub-helper in u_ (role unclear at depth 2) |
| `SH` | Logging/error-reporting pipeline (JA, f6, Rq, fRf) |
| `JA` | Error + String formatter |
| `f6` | String coercion at log entry |
| `Rq` | yBA log routing helper |
| `fRf` | Ring-buffer logger (Ko6 shift + push) |
| `dvH` | Git URL/output normaliser (trim, match, replace, slice, toLowerCase) |
| `zxf` | M9 sub-helper for URL parsing |
| `M9` | String indexOf + slice extractor |
| `Gq6` | Post-generation hook dispatcher (Rq + BE + Y6) |
| `BE` | Flint Harbor share dispatcher (→ W9) |

---

_Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js._