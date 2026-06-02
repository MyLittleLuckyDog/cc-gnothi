---
type: feature-spec
feature: "team-onboarding"
cc_version: "2.1.152"
updated: "2026-06-01"
tags: ["team-onboarding", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.152 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/team-onboarding`

> Analysis basis: CC v2.1.152 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.152

---

## Overview

`/team-onboarding` is a `prompt`-type slash command that scans the invoking user's local Claude Code session transcripts, derives a usage profile, and co-authors a ready-to-commit `ONBOARDING.md` guide tailored for teammates who are new to Claude Code. The command operates as a multi-turn collaborative workflow: it generates a concrete draft immediately, then asks three targeted review questions before writing the final file.

---

## Registration

| Field | Value |
|---|---|
| type | `prompt` |
| name | `team-onboarding` |
| description | `Help teammates ramp on Claude Code with a guide from your usage` |
| isHidden | `false` |
| handler_method | `getPromptForCommand` |
| handler_method_start (loc_byte) | `12666227` |
| handler_method_end (loc_byte) | `12666937` |
| loc_byte | `12665889` |
| loc_byte_end | `12666938` |
| loc_line | `10973` |
| prompt_body.length | `4539` characters |
| prompt_body.trace | `identifier→$ (local→1 ext vars)` |
| arbor_handler.name | `getPromptForCommand` |
| arbor_handler.kind | `Method` |
| arbor_handler.fqn | `claude-2.1.152::getPromptForCommand` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `2` |
| `handler_method_start` | `12666227` |
| `handler_method_end` | `12666937` |

Analysis basis: CC v2.1.152 bundle.js:+12665889

---

## Input Branching

The handler has more than three distinct execution paths (transcript scan present vs. absent, session count near-zero, MCP server data present or absent, guide template substitution variants), so a flowchart is used.

```mermaid
flowchart TD
    A([User invokes /team-onboarding]) --> B[Emit tengu_team_onboarding_invoked telemetry]
    B --> C[Gather usage window: Math.min / Math.max / Math.floor\nover last 365-day cap]
    C --> D[Call transcript scanner — Ya1\nRead .jsonl files from projects dir\nup to 24 h × 60 min × 1000 ms age limit]
    D --> E{Session count?}
    E -- "~0 sessions" --> F[Mark work-type breakdown as TODO\nin guide draft]
    E -- ">0 sessions" --> G[Classify sessionDescriptors\ninto up to 7 task-type buckets]
    G --> H[Pick top 3-5 categories with %]
    H --> I[Gather repo context via N35\ncurrentRepo + sibling dirs]
    F --> I
    I --> J[Read .mcp.json via v35\nExtract mcpServers entries]
    J --> K{.mcp.json present?}
    K -- "Yes" --> L[Populate MCP server section\nwith name + urlOrigin hints]
    K -- "No / ENOENT" --> M[Leave MCP section sparse]
    L --> N[Substitute template variables:\n{{WINDOW_DAYS}}, {{USAGE_DATA}},\n{{GUIDE_TEMPLATE}}]
    M --> N
    N --> O[Build prompt string via\nString + _.replaceAll calls]
    O --> P[Emit tengu_flint_harbor_prompt telemetry]
    P --> Q[Submit prompt to agent — YeH dispatch]
    Q --> R[Agent outputs acknowledgment line FIRST\nthen renders ONBOARDING.md draft\nin a code block]
    R --> S[Agent posts Review section\nwith 3 numbered questions]
    S --> T{User answers?}
    T -- "Provides answers" --> U[Agent updates ONBOARDING.md\nwith team name, tips, starter task]
    U --> V[Write file; emit\ntengu_team_onboarding_generated telemetry]
    V --> W[Agent outputs confirmation line\nSaved to ONBOARDING.md …]
    T -- "Further edits" --> X[Apply edits to file and repeat]
    X --> W
    W --> Z([End])
```

Analysis basis: CC v2.1.152 bundle.js:+12666227

---

## Behavioral Spec

### 1. Handler Entry — `getPromptForCommand`

The Arbor-resolved handler is the `getPromptForCommand` method defined inline on the registration object (resolution path: `direct`, n_hits: 2).

```
function getPromptForCommand(context):
    emit telemetry "tengu_team_onboarding_invoked"

    windowDays = clampWindowDays(context.windowDays, maxDays=365)
    // Math.min / Math.max / Math.floor applied here
    // Analysis basis: CC v2.1.152 bundle.js:+12666430, +12666439, +12666448, +12666476

    usageData = scanLocalTranscripts(context)
    // Calls transcript scanner (Ya1) — see §2

    mcpConfig = readMcpConfig(context)
    // Calls MCP config reader (v35) — see §3

    gitInfo = gatherGitContext(context)
    // Calls git context gatherer (N35) — see §4

    promptText = buildPromptString(windowDays, usageData, mcpConfig, gitInfo)
    // String construction + replaceAll for template vars
    // Analysis basis: CC v2.1.152 bundle.js:+12666674, +12666705

    emit telemetry "tengu_flint_harbor_prompt"
    // Analysis basis: CC v2.1.152 bundle.js:+12666264

    return dispatchToAgent(promptText)
    // Via YeH → V1 / IZ / E6
    // Analysis basis: CC v2.1.152 bundle.js:+12666783
```

Analysis basis: CC v2.1.152 bundle.js:+12666233

---

### 2. Transcript Scanner — `transcriptScanner` (Ya1)

Reads `.jsonl` files from the user's local Claude Code projects directory to build a `USAGE_DATA` payload.

```
async function transcriptScanner(projectsDir):
    cutoffMs = Date.now() - (24 * 60 * 1000)
    // 24 h × 60 min × 1000 ms rolling window
    // Analysis basis: CC v2.1.152 bundle.js:+12654725, +12654728, +12654734

    entries = await fs.readdir(projectsDir)
    files   = entries.filter(f => path.extname(f) == ".jsonl")
    // Analysis basis: CC v2.1.152 bundle.js:+12654840

    results = await Promise.all(files.map(async f =>
        stat = await fs.stat(join(projectsDir, f))
        if not stat.isFile(): return null

        raw  = await fs.readFile(join(projectsDir, f))
        lines = raw.split("\n")
        // Analysis basis: CC v2.1.152 bundle.js:+12655210

        sessions = []
        for line in lines:
            if line.includes("\"name\":\"mcp__"):
                // MCP tool-call hit — increment mcp count
                // Analysis basis: CC v2.1.152 bundle.js:+12655419

            match = G35_REGEX.exec(line)   // session title extractor
            match = T35_REGEX.exec(line)   // PR-number extractor
            // Analysis basis: CC v2.1.152 bundle.js:+12655560, +12655616

            if line.matchAll(CONTENT_BLOCK_RE):
                // Extract first user message up to limit of 10 chars sampled
                // Analysis basis: CC v2.1.152 bundle.js:+12655297, +12655236

            if D.startsWith pattern (3-char prefix check):
                sessionDescriptor = buildDescriptor(title, prNumbers, firstMsg,
                                                    toolCount, mcpCount)
                sessions.push(sessionDescriptor.slice(0, 3))
                // Analysis basis: CC v2.1.152 bundle.js:+12655876, +12655872

        return sessions
    ))
    return flatten(results)
```

Analysis basis: CC v2.1.152 bundle.js:+12654712

---

### 3. MCP Config Reader — `mcpConfigReader` (v35)

Reads the workspace `.mcp.json` file and extracts server definitions for the guide.

```
async function mcpConfigReader(workspaceRoot):
    filePath = path.join(workspaceRoot, ".mcp.json")
    // Analysis basis: CC v2.1.152 bundle.js:+12656951

    try:
        raw  = await fs.readFile(filePath, encoding="utf8")
        // Analysis basis: CC v2.1.152 bundle.js:+12656964

        parsed = JSON.parse(raw)
        servers = parsed["mcpServers"] ?? {}
        // Analysis basis: CC v2.1.152 bundle.js:+12657007

        for each server in servers:
            if missing fields: use fallback via errorWrapper (j8 / n_)
        return servers

    catch ENOENT:
        return {}   // file absent — handled gracefully
```

Analysis basis: CC v2.1.152 bundle.js:+12656927

---

### 4. Git Context Gatherer — `gitContextGatherer` (N35)

Collects the repository name, git user name, and remote origin URL to populate `generatedBy` and repo fields in the guide.

```
async function gitContextGatherer(workspaceRoot):
    projectPath = resolveProjectPath(workspaceRoot)
    // oW → ov (joins "projects" segment)
    // Analysis basis: CC v2.1.152 bundle.js:+12657259

    userName = await runGit(["config", "user.name"])
    // literals: "git", "config", "user.name"
    // Analysis basis: CC v2.1.152 bundle.js:+12657574, +12657581, +12657590

    remoteUrl = await runGit(["remote", "get-url", "origin"])
    // literals: "remote", "get-url", "origin"
    // Analysis basis: CC v2.1.152 bundle.js:+12657646, +12657655, +12657665

    repoName = path.basename(workspaceRoot)
    // Analysis basis: CC v2.1.152 bundle.js:+12657762

    claudeConfig = await parseClaudeConfig(workspaceRoot)
    // HGH — trims, matches git/ prefix, lower-cases team name hint
    // Analysis basis: CC v2.1.152 bundle.js:+12657754

    return { userName, remoteUrl, repoName, claudeConfig }
```

Analysis basis: CC v2.1.152 bundle.js:+12657252

---

### 5. Template Variable Substitution — `buildPromptString`

Three template placeholders are replaced before the prompt is sent to the agent.

```
function buildPromptString(windowDays, usageData, guideTemplate):
    text = PROMPT_TEMPLATE_BASE   // 4539-char constant
    text = text.replaceAll("{{WINDOW_DAYS}}",    String(windowDays))
    text = text.replaceAll("{{GUIDE_TEMPLATE}}", guideTemplate)
    text = text.replaceAll("{{USAGE_DATA}}",     JSON.stringify(usageData))
    // Analysis basis: CC v2.1.152 bundle.js:+12666687, +12666727, +12666762, +12666674
    return text
```

Analysis basis: CC v2.1.152 bundle.js:+12666674

---

### 6. Agent Execution Protocol (prompt body summary)

The 4,539-character prompt body instructs the agent to follow a strict ordered protocol. Key behavioral constraints derived from the prompt (short citation fragments only — body is © Anthropic PBC):

1. **Immediate acknowledgment** — the agent must emit a specific acknowledgment line beginning `"Looking at how you've used Claude…"` as its very first visible output, before any classification or tool use.

2. **Work-type classification** — the agent reads the `sessionDescriptors` array and classifies each session into one of seven canonical task types (`build_feature`, `debug_fix`, `improve_quality`, `analyze_data`, `plan_design`, `prototype`, `write_docs`). It selects the top 3–5 with approximate percentages. Categories are rendered in title-case with spaces (e.g., "Build Feature"). If no sessions are present, the breakdown is left as a `TODO`.

3. **Context gathering** — the agent resolves repos from `currentRepo` plus sibling directories; infers MCP server purposes from `name` and `urlOrigin`; leaves Team Tips and Get Started as `TODO` placeholders until the review step.

4. **Guide generation** — the agent writes `ONBOARDING.md` using the injected `{{GUIDE_TEMPLATE}}`. It fills real numbers, uses `generatedBy` for the author name (omits if absent), and renders ASCII bar charts (20 chars wide, `█` / `░`).

5. **First-turn close** — after the code block, a `---` rule and `**Review**` heading separate the guide from exactly three numbered questions about team name, starter task, and team tips.

6. **Second-turn update** — the agent incorporates answers into the file and closes with a fixed confirmation line (`"Saved to ONBOARDING.md. Drop it in your team docs…"`). Subsequent edits are applied to the file.

Analysis basis: CC v2.1.152 bundle.js:+12666227 — +12666937

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — invocation | `tengu_team_onboarding_invoked` (bundle.js:+12666487) — fired once when the command is triggered |
| Telemetry — harbor prompt | `tengu_flint_harbor_prompt` (bundle.js:+12666264) — fired when the constructed prompt is dispatched |
| Telemetry — guide generated | `tengu_team_onboarding_generated` (bundle.js:+12666806) — fired after the guide is written to disk |
| Telemetry — harbor share | `tengu_flint_harbor_share` (bundle.js:+9484000) — fired via YeH dispatch path |
| Telemetry — config parse error | `tengu_config_parse_error` (bundle.js:+3204028) — fired if config file is malformed |
| Telemetry — config lock contention | `tengu_config_lock_contention` (bundle.js:+3201453) |
| Telemetry — config stale write | `tengu_config_stale_write` (bundle.js:+3201589) |
| Telemetry — config auth loss prevented | `tengu_config_auth_loss_prevented` (bundle.js:+3201932) |
| File read | Scans `~/.claude/projects/**/*.jsonl` (transcript files) |
| File read | Reads `.mcp.json` from workspace root (ENOENT-safe) |
| File write | Creates / overwrites `ONBOARDING.md` in working directory after user confirms review answers |
| Config access | Reads global Claude config via `getPromptForCommand` context; protected by lock (S$_ path) |
| Git subprocess | Runs `git config user.name` and `git remote get-url origin` via T_ → a0H subprocess path |
| appState changes | None observed in depth-2 traversal |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | `tq → CMA.register` observed in call graph (bundle.js:+58661); scope is file-watch lifecycle, not command-specific |

---

## Version History

| Version | Change |
|---|---|
| v2.1.152 | Initial analysis |

---

## Common Mistakes

1. **Running the command outside a Git repository.** The git context gatherer (`N35`) calls `git config user.name` and `git remote get-url origin`. If neither is configured the `generatedBy` field is omitted from the guide silently, but the command still completes.

2. **No `.jsonl` transcripts available.** If the local projects directory contains no `.jsonl` files (e.g., a fresh install or non-standard `CLAUDE_DATA_DIR`), the session count will be zero and the work-type breakdown section in the generated guide is left as `TODO`, requiring manual fill-in.

3. **Skipping the Review step.** The command is designed as a two-turn workflow. Sending `/team-onboarding` and then immediately closing the session will leave `ONBOARDING.md` with `TODO` placeholders for Team Tips and Get Started. The file is only finalized after the three review questions are answered.

4. **Expecting immediate file output.** `ONBOARDING.md` is not written until the second turn (after the user answers the review questions). The first turn only renders the draft inside a code block.

5. **Confusing task-type categories.** The classifier uses snake_case internally but the rendered guide uses title-case with spaces. If team members paste the raw category keys into their own docs they will see `build_feature` instead of `Build Feature`.

6. **Large window day values.** The handler clamps the analysis window using `Math.min` / `Math.max` / `Math.floor` with a hard ceiling of 365 days (bundle.js:+12666476). Requesting a longer window has no effect.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `__handler_team-onboarding` | Synthetic BFS entry point for the command handler (not a real bundle symbol) |
| `E6` | Session / agent dispatch coordinator |
| `hO6` | Sub-helper A of dispatch coordinator |
| `SO6` | Sub-helper B of dispatch coordinator |
| `oe` | Prompt routing helper |
| `uH` | String conversion utility |
| `Qb` | Config / context reader |
| `QS` | Config sub-reader |
| `P68` | Deduplication / cache-check for prompts |
| `$$_` | Prompt-send core (builds message, emits event) |
| `LEH` | First-party flag resolver |
| `Sp` | Random-bytes / ID generator for prompt messages |
| `CH` | JSON serializer wrapper |
| `K_7` | Prompt metadata builder |
| `w$_` | Background-session writer |
| `ONq` | Error formatter for background sessions |
| `s_` | Stream writer |
| `amq` | Async message queue helper |
| `efH` | LiK-set membership checker |
| `x6` | Config file accessor / writer |
| `Q6` | Path resolver utility |
| `N$_` | Config default provider |
| `zzH` | Config file read + parse core |
| `q` | Filesystem operations namespace (sync) |
| `B6` | JSON parse wrapper |
| `Mb` | String prefix stripper |
| `_` | Generic filesystem / string utility |
| `L8` | Logger / error reporter |
| `zpq` | Directory backup scanner |
| `N` | String formatter / log helper |
| `c` | Application context / state accessor |
| `R$_` | Backup path builder |
| `w` | Background session spawner / lifecycle manager |
| `C_7` | File-watcher for config |
| `xi` | File-watch event handler |
| `tq` | CMA hook registrar |
| `M8` | Config save with lock (global config writer) |
| `S$_` | Config save with lock (project config writer) |
| `L` | Filesystem lock helper |
| `M` | Session / connection lifecycle manager |
| `Efq` | Config object merger |
| `Iq_` | Config schema validator |
| `uO6` | Auth-loss guard |
| `A` | Process / agent map |
| `V` | Versioned config field |
| `P` | MCP server connection manager |
| `IR8` | MCP transport initializer |
| `hH` | MCP server connector |
| `n_` | Error constructor helper |
| `Z` | Config backup slice |
| `z76` | Atomic file writer (write-rename pattern) |
| `O` | File stat result wrapper |
| `j8` | Logged error wrapper |
| `H` | Random-delay / retry helper (also process env accessor in other callsites) |
| `bgH` | Config background-load helper |
| `Opq` | Object-entries iterator for config |
| `xgH` | Timestamp recorder |
| `h$_` | Config path builder |
| `N35` | Git context gatherer (user name, remote URL, repo name) |
| `z_` | Project-path resolver inner |
| `pv` | Path segment helper |
| `oW` | Project-path resolver outer |
| `ov` | Projects-dir joiner |
| `vz` | Path string normalizer |
| `ZeK` | Absolute-value / hash helper |
| `Ya1` | Transcript scanner (reads `.jsonl` files) |
| `eq` | Error-logger for transcript scan |
| `K` | Pad / map array formatter |
| `$` | Session / app context (holds Sn1 sub-session factory) |
| `Sn1` | Sub-session factory |
| `z` | Daemon / background session controller |
| `SH` | Daemon stop handler |
| `mH` | Daemon stop-failed handler |
| `_y` | Session list push helper |
| `qm` | Process-exit race helper |
| `D` | Background session dispatcher |
| `jI8` | Low-memory detector |
| `Q4A` | Spare background session spawner |
| `Tz` | Timeout / cancellation helper |
| `v35` | MCP config reader (reads `.mcp.json`) |
| `V35` | Additional context variable for git gatherer |
| `T_` | Git subprocess runner |
| `a0H` | Child-process spawner core |
| `cEA` | Win32 command wrapper |
| `nl8` | Spawn stream-attach helper A |
| `il8` | Spawn stream-attach helper B |
| `ol8` | Spawn option builder |
| `tZA` | Finite-number validator for spawn options |
| `D76` | Spawn error handler |
| `ll8` | Reflect-apply wrapper for spawn |
| `yEA` | Process exit-event listener |
| `sZA` | Spawn timeout wrapper |
| `eZA` | Process kill helper |
| `oZA` | Spawn output handler A |
| `aZA` | Spawn kill escalator |
| `IEA` | Spawn stdio collector |
| `X76` | Spawn result normalizer |
| `vEA` | Spawn pipe connector |
| `NEA` | ZEA stream adder |
| `qEA` | stdout/stderr stream binder |
| `w64` | String coercion for spawn args |
| `HGH` | CLAUDE.md / config text parser (trims, matches, lowercases) |
| `Q64` | Config section parser |
| `L9` | indexOf / slice string scanner |
| `YeH` | Flint-harbor prompt dispatcher |
| `V1` | Traffic-policy checker |
| `mGA` | String-to-traffic-policy mapper |
| `IZ` | Prompt queue enqueuer |

---

*Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.*