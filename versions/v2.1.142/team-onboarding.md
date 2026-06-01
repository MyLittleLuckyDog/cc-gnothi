---
type: feature-spec
feature: "team-onboarding"
cc_version: "2.1.142"
updated: "2026-06-01"
tags: ["team-onboarding", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.142 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/team-onboarding`

> Analysis basis: CC v2.1.142 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.142

---

## Overview

`/team-onboarding` is a `prompt`-type slash command that analyzes the invoking user's local Claude Code session transcripts (over a configurable window of days) and co-authors a ready-to-use `ONBOARDING.md` guide for teammates who are new to Claude Code. The command operates through a structured, multi-step conversation: it immediately outputs an acknowledgment line, classifies the user's historical work into task-type categories, writes a fully populated guide, and then conducts a short collaborative review to refine the team name, starter task, and team tips before saving the final document.

---

## Registration

| Field | Value |
|---|---|
| type | `prompt` |
| name | `team-onboarding` |
| description | `Help teammates ramp on Claude Code with a guide from your usage` |
| isHidden | `false` |
| handler_method | `getPromptForCommand` |
| handler_method_start (byte) | `11918867` |
| handler_method_end (byte) | `11919523` |
| loc_byte | `11918529` |
| loc_byte_end | `11919524` |
| loc_line | `7898` |
| prompt_body.length | `4539` characters |
| prompt_body.trace | `identifier→$ (local→1 ext vars)` |
| arbor_handler.name | `getPromptForCommand` |
| arbor_handler.fqn | `claude-2.1.142::getPromptForCommand` |
| arbor_handler.kind | `Method` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `2` |
| `handler_method_start` | `11918867` |
| `handler_method_end` | `11919523` |

Analysis basis: CC v2.1.142 bundle.js:+11918529

---

## Input Branching

The handler performs several distinct branching operations before constructing the final prompt: resolving the transcript window (clamped between 1 and 365 days), scanning and parsing transcript files, reading MCP server configuration, resolving the git user name, and substituting template placeholders. This constitutes more than three distinct paths and is best expressed as a flowchart.

```mermaid
flowchart TD
    A(["/team-onboarding invoked"]) --> B[Emit tengu_flint_harbor_prompt telemetry]
    B --> C[Determine WINDOW_DAYS\nclamp via Math.min / Math.max / Math.floor\ndefault cap: 365 days]
    C --> D[Emit tengu_team_onboarding_invoked telemetry\nrecord window + context]

    D --> E[scanTranscripts — readTranscriptDirectory]
    E --> F{Any .jsonl files\nfound?}
    F -- "Yes" --> G[For each file: stat → readFile → split lines\nparse JSONL → extract sessionDescriptors\nparse MCP tool/server counts\nparse prNumbers via regex]
    F -- "No / ~0 sessions" --> H[Set sessionDescriptors = empty\nWork-type breakdown marked TODO]

    G --> I[readMCPConfig — locate .mcp.json\nparse mcpServers entries\nextract name + urlOrigin]
    I --> J[resolveGitIdentity — run git config user.name\nthen git remote get-url origin]
    J --> K[resolveCurrentRepo — basename of working dir\ncheck sibling repo directories]

    H --> L

    K --> L[buildUsageData object\nserialize to JSON string]
    L --> M[Substitute template placeholders\n{{WINDOW_DAYS}} {{USAGE_DATA}} {{GUIDE_TEMPLATE}}]
    M --> N[buildPromptText — replaceAll placeholders\nwrap in prompt string via String coercion]
    N --> O[Emit tengu_team_onboarding_generated telemetry]
    O --> P[Return prompt object\ntype: text\nto agent via getPromptForCommand]
```

Analysis basis: CC v2.1.142 bundle.js:+11918867

---

## Behavioral Spec

### 1. Handler Entry and Telemetry Preamble

The handler `getPromptForCommand` is the `ObjectMethod` registered directly on the command's registration object. On invocation, it immediately emits the `tengu_flint_harbor_prompt` event, which records that the Flint Harbor prompt path was entered.

```
function getPromptForCommand(context):
    emit telemetry("tengu_flint_harbor_prompt")

    windowDays = Math.floor(
        Math.min(
            Math.max(resolveWindowDays(context), 1),
            365
        )
    )

    emit telemetry("tengu_team_onboarding_invoked", {window: windowDays, ...context})
```

Analysis basis: CC v2.1.142 bundle.js:+11918867, +11919070, +11919116, +11919127

The `365`-day cap is a numeric literal in the handler body.

Analysis basis: CC v2.1.142 bundle.js:+11919116

---

### 2. Transcript Scanning (`scanTranscriptDirectory`)

The `lIq` function (transcript directory scanner) is called from the usage-data builder (`VC7`). It reads the project transcript directory asynchronously, filters for `.jsonl` files, and processes each one.

```
async function scanTranscriptDirectory(transcriptDir, cutoffTimestamp):
    entries = await fs.readdir(transcriptDir)

    cutoff = Date.now() - (windowDays * 24 * 60 * 60 * 1000)
    // constants: 24, 60, 60, 1000 — milliseconds per day

    jsonlFiles = entries
        .filter(entry => path.extname(entry) === ".jsonl")

    sessions = await Promise.all(
        jsonlFiles.map(async filename =>
            filePath = path.join(transcriptDir, filename)
            stat = await fs.stat(filePath)
            if not stat.isFile(): return null

            raw = await fs.readFile(filePath, "utf-8")
            lines = raw.split("\n").filter(line => line.length > 0).slice(0, 10)
            // takes up to 10 lines as session sample

            mcpMatches = raw.matchAll(/"name":"mcp__/g)
            contentMatches = raw.matchAll(/"content":\[/g)
            prNumbers = extractPRNumbers(raw, XC7, WC7)
            // XC7, WC7 are compiled regexes for PR number extraction

            toolCount = Number(GC7.exec(raw))
            messageSample = lines.filter(line => line.startsWith("..."))
                                  .slice(0, 3)

            return buildSessionDescriptor(filename, lines, mcpMatches, prNumbers, toolCount)
        )
    )
    return sessions.filter(s => s !== null)
```

Key constants observed in `lIq`:
- Time window arithmetic: `24 * 60 * 60 * 1000` ms/day (bundle.js:+11907370, +11907373, +11907379)
- Session sample limit: `10` first lines (bundle.js:+11907881)
- MCP detection string: `"name":"mcp__"` (bundle.js:+11908064)
- Content block detection: `"content":["` (bundle.js:+11908414)
- Max PR number capture groups: `3` (bundle.js:+11908517)
- Transcript file extension: `".jsonl"` (bundle.js:+11907485)

Analysis basis: CC v2.1.142 bundle.js:+11909918, +11907357, +11907398

---

### 3. MCP Configuration Reader (`readMCPConfig`)

The `ZC7` function reads the workspace `.mcp.json` file if present.

```
async function readMCPConfig(workspaceRoot):
    configPath = path.join(workspaceRoot, ".mcp.json")
    // literal: ".mcp.json" at bundle.js:+11909596

    try:
        raw = await fs.readFile(configPath, "utf8")
        // literal: "utf8" at bundle.js:+11909609
        parsed = JSON.parse(raw)
        servers = parsed["mcpServers"] ?? {}
        // literal: "mcpServers" at bundle.js:+11909652

        return Object.entries(servers).map(([name, config]) =>
            formatServerEntry(name, config)
        )
    catch:
        return []
```

Analysis basis: CC v2.1.142 bundle.js:+11910035, +11909572

---

### 4. Git Identity and Remote Resolver (`resolveGitIdentity`)

The `O_` function (git identity resolver) runs two git subprocesses to obtain the committer name and remote origin URL.

```
async function resolveGitIdentity():
    nameResult = await runSubprocess("git", ["config", "user.name"])
    // literals: "git", "config", "user.name" at bundle.js:+11910219, +11910226, +11910235

    remoteResult = await runSubprocess("git", ["remote", "get-url", "origin"])
    // literals: "remote", "get-url", "origin" at bundle.js:+11910291, +11910300, +11910310

    return {
        generatedBy: nameResult.stdout.trim() or null,
        remoteOrigin: remoteResult.stdout.trim() or null
    }
```

The subprocess launcher (`_XH`) supports stdout/stderr capture, timeout via `Promise.race`, and process kill on timeout. It accepts up to 1,000,000 byte output before truncating.

Analysis basis: CC v2.1.142 bundle.js:+11910216, +11910361

---

### 5. Usage-Data Builder and Prompt Assembler (`buildUsageDataAndPrompt`)

The `VC7` function (usage-data builder) aggregates transcript scan results, MCP config, git identity, and current repo information, then constructs the final usage-data JSON that is injected into the prompt.

```
function buildUsageDataAndPrompt(context, transcriptSessions, mcpServers, gitIdentity):
    currentRepo = path.basename(workingDirectory)
    siblingRepos = discoverSiblingRepos(workingDirectory)

    usageData = {
        sessionDescriptors: transcriptSessions,
        mcpServers: mcpServers,
        generatedBy: gitIdentity.generatedBy,
        currentRepo: currentRepo,
        siblingRepos: siblingRepos,
        windowDays: windowDays
    }

    usageDataJson = JSON.stringify(usageData)
    guideTemplate = loadGuideTemplate()

    promptText = PROMPT_TEMPLATE
        .replaceAll("{{WINDOW_DAYS}}", String(windowDays))
        .replaceAll("{{USAGE_DATA}}", usageDataJson)
        .replaceAll("{{GUIDE_TEMPLATE}}", guideTemplate)
    // literals: "{{WINDOW_DAYS}}", "{{GUIDE_TEMPLATE}}", "{{USAGE_DATA}}"
    //   at bundle.js:+11919273, +11919313, +11919348

    return { type: "text", text: promptText }
    // literal: "text" at bundle.js:+11919507
```

Analysis basis: CC v2.1.142 bundle.js:+11919251, +11919260, +11919291

---

### 6. Agent Prompt Instructions (Behavioral Summary)

The prompt body (4,539 characters; `identifier→$ (local→1 ext vars)`) instructs the agent to follow a strict five-step protocol. The spec below is derived from the extracted prompt body; no verbatim quotation is used.

```
AgentProtocol:

STEP 1 — Immediate acknowledgment (mandatory first output):
    output exactly one blockquote line summarizing the window
    // e.g. begins with "Looking at how you've used Claude..."
    NO thinking, NO classification, NO tool calls before this line.

STEP 2 — Work-type breakdown:
    for each session in sessionDescriptors:
        classify into one of:
            build_feature | debug_fix | improve_quality |
            analyze_data | plan_design | prototype | write_docs
        primary signal: firstUserMessage
        secondary signals: prNumbers, tool counts, MCP counts
        fallback: if ~0 sessions → mark breakdown as TODO

    select top 3-5 categories with rough percentage estimates
    render in guide with title-case display names (e.g. "Build Feature")

STEP 3 — Gather remaining pieces:
    repos: start from currentRepo, check sibling directories
    mcpServers: infer purpose from name + urlOrigin
    teamTips section: leave as TODO placeholder
    getStarted section: leave as TODO placeholder

STEP 4 — Write ONBOARDING.md:
    follow embedded GUIDE_TEMPLATE exactly
    fill real numbers (not placeholder text)
    generatedBy: use if present, omit if missing
    ASCII bar charts: '█' filled, '░' empty, 20 chars wide
    preserve HTML comment instruction at bottom verbatim

STEP 5 — Render guide + Review turn:
    output guide inside a fenced code block
    add horizontal rule + "**Review**" heading
    ask exactly 3 numbered review questions:
        Q1: confirm team name (or ask if unknown)
        Q2: starter task for new Claude Code users (optional link)
        Q3: team tips not already in CLAUDE.md

    after user responds:
        update ONBOARDING.md with team name, tips, starter task
        close with exact closing line (not paraphrased)
        apply any further edits the user provides
```

Analysis basis: CC v2.1.142 bundle.js:+11918867 (prompt body at offset range 11918867–11919523)

---

### 7. Guide Sharing Hook (`KO8`)

A separate call to `KO8` (Flint Harbor share dispatcher) is made from the handler after the prompt is built. This emits `tengu_flint_harbor_share` telemetry and routes the completed guide artifact through the Flint Harbor sharing pipeline.

```
function dispatchFlintHarborShare(promptResult, context):
    emit telemetry("tengu_flint_harbor_share")
    flintHarborShare(promptResult, context)
    // calls into G6 (session dispatcher) for downstream routing
```

Analysis basis: CC v2.1.142 bundle.js:+11919369, +9051067

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_flint_harbor_prompt` | Emitted at handler entry; records that the Flint Harbor prompt path was entered (bundle.js:+11918904) |
| Telemetry: `tengu_team_onboarding_invoked` | Emitted after window-days resolution; records invocation context and window value (bundle.js:+11919127) |
| Telemetry: `tengu_team_onboarding_generated` | Emitted after prompt assembly is complete (bundle.js:+11919392) |
| Telemetry: `tengu_flint_harbor_share` | Emitted by `KO8` when the guide artifact is dispatched to the Flint Harbor sharing pipeline (bundle.js:+9051067) |
| Telemetry: `tengu_config_parse_error` | Emitted by config reader (`cMH`) if the config file fails to parse (bundle.js:+3155139) |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` | Emitted by feature-flag check functions `SH` / `uH` for feature gate results (bundle.js:+954550, +954608) |
| Telemetry: `tengu_bg_*` (various) | Background session / daemon telemetry emitted by lower-level session dispatcher `G6`; incidental to this command (bundle.js:+14462646, +14463225, +14463840, +14463961, +14464224) |
| File write | Agent writes `ONBOARDING.md` to the working directory after the review turn |
| File read | Handler reads local `.jsonl` transcript files and `.mcp.json` via async fs calls |
| Subprocess | Two `git` subprocesses are spawned: `git config user.name` and `git remote get-url origin` |
| Hook registration | `XhL` registers a file watcher (`vi6.watchFile`) on the transcript directory; unregistered (`vi6.unwatchFile`) when the session ends |
| appState changes | Session descriptor map (`gMH`) and processed-session set (`vA_`) are updated by `Ji6` during transcript scanning |
| Sound | None detected |

---

## Version History

| Version | Change |
|---|---|
| v2.1.142 | Initial analysis |

---

## Common Mistakes

1. **Expecting immediate output other than the acknowledgment line.** The prompt enforces that the very first visible text must be the blockquote acknowledgment line. Any classification thinking, tool calls, or extended reasoning before this line violates the protocol specified in the prompt body.

2. **Pasting the guide template without real data.** The prompt instructs the agent to fill in real numbers from `USAGE_DATA`; placeholder strings such as `{{WINDOW_DAYS}}` should not appear in the rendered guide. If `{{USAGE_DATA}}` is empty (no sessions), the work-type breakdown must be marked `TODO`.

3. **Inventing new task-type categories unnecessarily.** The seven canonical categories (`build_feature`, `debug_fix`, `improve_quality`, `analyze_data`, `plan_design`, `prototype`, `write_docs`) are meant to cover the vast majority of sessions. New categories should only be added when a session genuinely represents a different *type* of task, not a different project domain.

4. **Omitting the review turn.** The command is designed as a two-turn interaction. Skipping the `---` / `**Review**` section after the guide code block and the three numbered review questions breaks the intended collaborative flow.

5. **Misattributing review sessions.** Code review sessions classify as `improve_quality`; doc review sessions as `write_docs`; design review sessions as `plan_design`. The task type follows *what is being reviewed*, not the act of reviewing.

6. **Assuming `.mcp.json` always exists.** The `readMCPConfig` function (`ZC7`) wraps the file read in a try/catch and returns an empty array on failure. Downstream logic must tolerate an empty MCP server list.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `__handler_team-onboarding` | Synthetic BFS entry point for the command handler (bookkeeping only; real handler is `getPromptForCommand`) |
| `G6` | Session dispatcher / background session manager |
| `Z76` | Session dispatcher helper A |
| `V76` | Session dispatcher helper B |
| `ws` | Session state initializer |
| `bH` | String coercion utility |
| `Ds` | Data-store accessor |
| `Su` | Storage utility orchestrator |
| `Ji6` | Session deduplication and descriptor registry updater |
| `IA_` | Session record creator (generates UUID, emits Growthbook event) |
| `f0H` | Session field formatter |
| `hu` | Random-bytes / hex-token generator |
| `RH` | JSON serializer wrapper |
| `nyL` | Session notification emitter |
| `CA_` | Session state cache manager |
| `mY9` | Cache key builder |
| `m_` | Async queue/lock utility |
| `GE9` | Session expiry checker |
| `WRH` | Permission set checker |
| `y6` | Transcript file loader (top-level) |
| `x6` | Path resolver utility |
| `dA_` | Directory path builder |
| `cMH` | Config file reader and parser |
| `q` | Filesystem module reference (sync ops) |
| `b6` | JSON.parse wrapper |
| `DR` | Config key normalizer (startsWith / slice) |
| `_` | General utility / filesystem wrapper |
| `O8` | Error formatter / object serializer |
| `bE9` | Sibling repo directory scanner |
| `v` | Log / debug emitter |
| `NH` | Error handler / log-error dispatcher |
| `d` | Async utility / promise helper |
| `aA_` | Backup directory path builder |
| `w` | Background process manager / daemon lifecycle |
| `XhL` | Transcript file watcher (watchFile / unwatchFile) |
| `wl` | Watcher callback handler |
| `C9` | File-watch event set manager |
| `VC7` | Usage-data builder and prompt assembler |
| `__` | Identifier formatter (calls `JV`) |
| `JV` | Base identifier / string utility |
| `gG` | Project path formatter |
| `kV` | Project directory joiner |
| `DO` | String replacement utility (replaceAll / slice) |
| `H` | Multi-purpose string / process utility |
| `ovK` | Numeric distance calculator (Math.abs) |
| `lIq` | Transcript directory scanner and session descriptor extractor |
| `y9` | Object serializer helper |
| `K` | Array map / filter utility |
| `L` | Promise/task queue entry |
| `f` | File/stream handle utility |
| `O` | File-stat result checker |
| `S8` | Stat result type helper |
| `$` | Transcript file content processor / splitter |
| `zEq` | Session event record builder |
| `z` | Daemon control / background session state |
| `SH` | Feature-flag "ok" checker |
| `uH` | Feature-flag "bad" checker |
| `aR` | Daemon registration handler |
| `Ax` | Promise race/all orchestrator (daemon startup) |
| `D` | Daemon process lifecycle manager |
| `LG6` | Low-memory background session handler |
| `br_` | Spare background session spawner (Bun.spawn) |
| `ZC7` | MCP config file reader (`.mcp.json` parser) |
| `$8` | Object serializer helper B |
| `EC7` | Extra context builder for usage data |
| `O_` | Git identity and remote resolver |
| `_XH` | Subprocess launcher (stdout/stderr capture, timeout) |
| `uOA` | Subprocess argument builder |
| `Fx8` | Subprocess stdout stream handler |
| `gx8` | Subprocess stderr stream handler |
| `dx8` | Subprocess exit code handler |
| `d3A` | Numeric validation (Number.isFinite) |
| `ZA6` | Subprocess result aggregator |
| `Bx8` | Reflect.apply wrapper for subprocess calls |
| `GOA` | Process event listener registrar |
| `Q3A` | Timeout-with-race utility |
| `c3A` | Process kill-on-timeout handler |
| `F3A` | Subprocess stdout data handler (bound) |
| `g3A` | Subprocess kill handler (bound) |
| `XOA` | Subprocess pipe/output collector |
| `NA6` | Subprocess result normalizer |
| `jOA` | Subprocess stream piping setup |
| `POA` | Subprocess stdio add utility |
| `r3A` | Subprocess stdout reader (bound) |
| `gkK` | String coercion helper for subprocess output |
| `LXH` | Git remote URL parser (trim / match / split) |
| `wyK` | URL origin extractor |
| `u1` | String indexOf/slice utility |
| `KO8` | Flint Harbor share dispatcher |
| `$q` | Network traffic classifier / telemetry router |
| `NMA` | Telemetry batch emitter |