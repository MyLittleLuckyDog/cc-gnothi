---
type: feature-spec
feature: "team-onboarding"
cc_version: "2.1.149"
updated: "2026-06-01"
tags: ["team-onboarding", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.149 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/team-onboarding`

> Analysis basis: CC v2.1.149 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.149

---

## Overview

`/team-onboarding` is a `prompt`-type slash command that analyses the invoking user's local Claude Code session transcripts (up to 365 days back) and co-authors a ready-to-commit `ONBOARDING.md` guide with them. The guide is designed to help new teammates ramp on Claude Code by surfacing the real workflow patterns of an experienced user on their team. The command drives a structured, multi-turn conversation: it delivers a concrete draft first, then asks three targeted review questions before writing the final file.

---

## Registration

| Field | Value |
|---|---|
| `type` | `prompt` |
| `name` | `team-onboarding` |
| `description` | Help teammates ramp on Claude Code with a guide from your usage |
| `isHidden` | `false` |
| `handler_method` | `getPromptForCommand` |
| `handler_method_start` (byte) | 12590384 |
| `handler_method_end` (byte) | 12591094 |
| `loc_byte` | 12590046 |
| `loc_byte_end` | 12591095 |
| `loc_line` | 10677 |
| `prompt_body.length` | 4539 characters |
| `prompt_body.trace` | `identifier→$ (local→1 ext vars)` |
| `arbor_handler.name` | `getPromptForCommand` |
| `arbor_handler.kind` | `Method` |
| `arbor_handler.resolution_path` | `direct` |
| `arbor_handler.fqn` | `claude-2.1.149::getPromptForCommand` |
| `arbor_handler.n_hits` | 2 |
| `handler_method_start` | `12590384` |
| `handler_method_end` | `12591094` |

Analysis basis: CC v2.1.149 bundle.js:+12590046

---

## Input Branching

The handler executes a multi-stage pipeline with four distinct code paths (transcript file availability, data window clamping, template variable substitution, and response-type selection), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A([User invokes /team-onboarding]) --> B[Read current repo + workspace context\nvia usageDataReader]
    B --> C{Transcript .jsonl files\nfound in ~/.claude/projects?}
    C -- None found --> D[Build empty USAGE_DATA\nwith zero session count]
    C -- Files found --> E[Read & parse each .jsonl file\nFilter to WINDOW_DAYS = 365 days\nvia transcriptScanner]
    E --> F[Extract session descriptors:\ntitle, prNumbers, first user message,\ntool counts, MCP counts]
    F --> G[Clamp window:\nMath.min / Math.max / Math.floor\non session timestamps]
    D --> H
    G --> H[Load GUIDE_TEMPLATE\nfrom embedded constant]
    H --> I[Substitute template variables:\n{{WINDOW_DAYS}}, {{USAGE_DATA}},\n{{GUIDE_TEMPLATE}}]
    I --> J[Emit telemetry:\ntengu_team_onboarding_invoked]
    J --> K[Build prompt string\nand dispatch to agent via\nflintHarborPrompt / RsH]
    K --> L{Agent first-turn output}
    L -- Draft guide produced --> M[Render ONBOARDING.md draft\nin code block + Review questions]
    L -- Zero sessions edge case --> N[Draft with TODO placeholders\nfor work-type breakdown]
    M --> O{User answers Review questions}
    N --> O
    O --> P[Agent updates ONBOARDING.md\nwith team name, tips, starter task]
    P --> Q[Emit telemetry:\ntengu_team_onboarding_generated]
    Q --> R([Saved to ONBOARDING.md — closing line emitted])
```

Analysis basis: CC v2.1.149 bundle.js:+12590384 (handler open) – +12591094 (handler close)

---

## Behavioral Spec

### 1. Usage Data Collection (`transcriptScanner` / `usageDataReader`)

The handler calls `transcriptScanner` (bundle identifier `Ul1`) to enumerate `.jsonl` files under the Claude projects directory. For each file it:

1. Reads the directory listing asynchronously (`G66.readdir`).
2. Filters entries whose extension is `.jsonl` (bundle literal `.jsonl` at +12578997).
3. Stats each file (`G66.stat`) to confirm it is a regular file.
4. Reads the file content (`G66.readFile`) and splits on newlines.
5. Parses JSON lines and applies a 24-hour × 60-minute × 60-second × 1000 ms window calculation to restrict results to the configured look-back period.
6. Extracts per-session descriptor objects containing: session title, any PR numbers, and the first user message text.
7. Scans for MCP tool call patterns using regex matches against `"name":"mcp__` (literal at +12579576) and content array patterns (`"content":[` at +12579926) to count tool and MCP invocations as weak classification hints.

```
function transcriptScanner(projectsDir, windowDays):
    cutoffMs = Date.now() - (windowDays * 24 * 60 * 1000)
    files = await readdir(projectsDir)
    jsonlFiles = files.filter(f => extname(f) == ".jsonl")
    sessionDescriptors = []
    for each file in jsonlFiles:
        stat = await stat(join(projectsDir, file))
        if not stat.isFile(): continue
        raw = await readFile(join(projectsDir, file), "utf8")
        lines = raw.split("\n")
        descriptor = parseSessionDescriptor(lines, cutoffMs)
        if descriptor != null:
            sessionDescriptors.push(descriptor)
    return sessionDescriptors
```

Analysis basis: CC v2.1.149 bundle.js:+12578869 (`Ul1` open), +12578997 (`.jsonl` literal), +12579576 (`mcp__` literal)

---

### 2. Window and Date Clamping

The handler applies arithmetic clamping directly to constrain the look-back window before building the usage data payload:

```
WINDOW_DAYS_MAX = 365          // literal at +12590633
rawWindow = configuredDays     // from invocation context
clampedDays = Math.floor(
    Math.max(1,
        Math.min(WINDOW_DAYS_MAX, rawWindow)
    )
)
```

The `Math.min`, `Math.max`, and `Math.floor` calls all occur within the handler method body.

Analysis basis: CC v2.1.149 bundle.js:+12590587 (`Math.min`), +12590596 (`Math.max`), +12590605 (`Math.floor`), +12590633 (365 literal)

---

### 3. MCP Server Enumeration (`mcpConfigReader`)

The handler calls `mcpConfigReader` (bundle identifier `O45`) to read `.mcp.json` (literal at +12581108) from the project root. It:

1. Reads the file with `readFile` using `utf8` encoding (literal at +12581121).
2. Parses the JSON blob.
3. Extracts the `mcpServers` key (literal at +12581164).
4. For each server entry, surfaces `name` and `urlOrigin` fields so the agent can infer access instructions in the guide.

```
function mcpConfigReader(projectRoot):
    mcpPath = join(projectRoot, ".mcp.json")
    try:
        raw = await readFile(mcpPath, "utf8")
        config = JSON.parse(raw)
        return config.mcpServers ?? {}
    catch (ENOENT):
        return {}
```

Analysis basis: CC v2.1.149 bundle.js:+12581084 (`O45` open), +12581108 (`.mcp.json`), +12581164 (`mcpServers`)

---

### 4. Git Context Resolution (`gitContextResolver`)

The handler calls `gitContextResolver` (bundle identifier `z45`) to determine the current repository name and the guide creator's display name:

```
function gitContextResolver(workspaceRoot):
    generatedBy = await runGit(["config", "user.name"])  // +12581747
    remoteUrl   = await runGit(["remote", "get-url", "origin"])  // +12581822
    repoName    = basename(remoteUrl)
    return { generatedBy, repoName }
```

Supporting helpers:
- `j_` / `Dv` — path resolution utilities.
- `FT` / `Nv` / `Jz` / `WrK` — project path construction, reading from the `projects` directory (literal at +999464) and applying a fixed 36-character segment (literal at +999311) for project ID extraction.
- `oWH` — parses `git/` prefixes (literal at +1063627) from remote URLs and lowercases the host (for `localhost` detection at +1067746).
- `sV8.basename` — extracts the repo name from the remote URL.

Analysis basis: CC v2.1.149 bundle.js:+12590822 (`z45` call site), +12581731 (`git`), +12581747 (`user.name`), +12581803 (`remote`), +12581822 (`origin`)

---

### 5. Template Variable Substitution

After collecting usage data, MCP config, and git context, the handler performs `replaceAll` substitutions (call at +12590831) on the prompt body string to fill three template variables:

| Placeholder | Source |
|---|---|
| `{{WINDOW_DAYS}}` | Clamped integer day count (literal at +12590844) |
| `{{USAGE_DATA}}` | JSON-serialised session descriptor array (literal at +12590919) |
| `{{GUIDE_TEMPLATE}}` | Embedded markdown template constant (literal at +12590884) |

The substitution uses `String(...)` coercion (call at +12590862) before replacing, ensuring numeric values are safely stringified.

Analysis basis: CC v2.1.149 bundle.js:+12590831 (`_.replaceAll`), +12590844 (`{{WINDOW_DAYS}}`), +12590884 (`{{GUIDE_TEMPLATE}}`), +12590919 (`{{USAGE_DATA}}`)

---

### 6. Prompt Dispatch and Agent Instructions

The fully-substituted prompt string is dispatched via `flintHarborPrompt` (bundle identifier `V6`, call site +12590418) through the shared harbor/prompt infrastructure. The prompt instructs the agent to follow a strict five-step procedure:

1. **Immediate acknowledgment line** — emitted before any reasoning or tool use, referencing the window duration. This is an explicit first-visible-output requirement to prevent a blank-screen experience.

2. **Work-type classification** — session descriptors are classified into up to seven predefined task categories (build_feature, debug_fix, improve_quality, analyze_data, plan_design, prototype, write_docs). The agent selects the top 3–5 by rough percentage. Categories are displayed in Title Case in the rendered guide.

3. **Context gathering** — the agent reads `currentRepo`, sibling workspace repos, and MCP server entries to populate repository and tooling sections. Team Tips and Get Started sections are intentionally left as TODO placeholders at this stage.

4. **Guide file authoring** — the agent writes `ONBOARDING.md` following the embedded `{{GUIDE_TEMPLATE}}`. Real numbers from usage data are substituted; ASCII bar charts use `█` (filled) and `░` (empty) at 20 characters wide. The `generatedBy` field provides the author name; if absent it is omitted.

5. **Review turn** — after rendering the draft in a code block, the agent adds a `---` separator and a `**Review**` heading, then asks exactly three numbered questions: team name confirmation, optional starter task link, and additional team tips not already in `CLAUDE.md`. After the user responds, the agent updates `ONBOARDING.md` and closes with the canonical saved-confirmation line.

Analysis basis: CC v2.1.149 bundle.js:+12590390 (`getPromptForCommand` entry), +12590418 (`V6` / flintHarborPrompt call), +12590384–+12591094 (full handler body)

---

### 7. Return Value

The handler returns a `{ type: "text", ... }` object (literal `"text"` at +12591078) wrapping the fully-rendered prompt string. This is the standard `prompt`-type command return shape consumed by the CC agent dispatch layer.

Analysis basis: CC v2.1.149 bundle.js:+12591078

---

## State & Side Effects

| Item | Detail |
|---|---|
| **Telemetry — invocation** | `tengu_team_onboarding_invoked` (+12590644) — fired after usage data is assembled, before prompt dispatch |
| **Telemetry — completion** | `tengu_team_onboarding_generated` (+12590963) — fired after the guide generation turn completes |
| **Telemetry — harbor prompt** | `tengu_flint_harbor_prompt` (+12590421) — fired by the shared harbor dispatch layer on every prompt-type command |
| **Telemetry — harbor share** | `tengu_flint_harbor_share` (+9369198) — fired by `RsH` when the result is shared back to the session |
| **Telemetry — config errors** | `tengu_config_parse_error` (+3196285), `tengu_config_lock_contention` (+3193710), `tengu_config_stale_write` (+3193846), `tengu_config_auth_loss_prevented` (+3194189) — emitted by config I/O helpers reachable from the handler's file-reading path |
| **File write** | `ONBOARDING.md` written (and updated) in the current working directory via the agent's file-write tools during the multi-turn conversation |
| **File reads** | Claude project `.jsonl` transcript files under `~/.claude/projects`; `.mcp.json` in the project root; `~/.claude.json` global config (via config helpers) |
| **No appState mutation** | The handler itself does not mutate persistent app state beyond what the agent's tool calls effect |
| **No hook registration** | No `watchFile` / `unwatchFile` calls directly in the handler; those appear only in deeper daemon helpers (`Et4`) not invoked by this command's primary path |
| **Sound** | None detected in depth-2 traversal |
| **Config backup path** | Config save helpers use a `"backups"` subdirectory (literal +3195222) and keep up to 5 backups (literal +3194640) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.149 | Initial analysis — command introduced with 4539-char prompt body, 365-day transcript window, five-step guide authoring flow, and `tengu_team_onboarding_invoked` / `tengu_team_onboarding_generated` telemetry pair |

---

## Common Mistakes

1. **Running in an empty project directory** — If no `.jsonl` transcript files exist under `~/.claude/projects` for the current workspace, the session descriptor array will be empty and the work-type breakdown section of the generated guide will contain TODO placeholders rather than real data. Run the command after accumulating meaningful Claude Code usage in the project.

2. **Missing `git remote origin`** — The handler shells out `git remote get-url origin` to derive the repo name used in the guide header. If the workspace is not a Git repository, or has no `origin` remote, the repo name will be absent and the agent will prompt for it during the Review turn.

3. **No `.mcp.json` present** — The MCP server section of the guide will be empty if `.mcp.json` does not exist at the project root. This is not an error, but teammates will see a blank tooling section. Add `.mcp.json` before invoking if MCP context is important.

4. **Editing `ONBOARDING.md` before the Review turn completes** — The command is designed as a two-turn flow. Making external edits to `ONBOARDING.md` between the draft output and the Review answers may cause the agent's final update to overwrite those changes.

5. **Expecting sub-365-day granularity** — The window is clamped to a maximum of 365 days. Configuring a larger value will silently be reduced to 365 by the `Math.min` call in the handler.

6. **Treating the acknowledgment line as optional** — The prompt body explicitly instructs the agent to emit the acknowledgment line before any reasoning. If a model or configuration suppresses this (e.g., via a system prompt that redirects first output), the user may experience a noticeable blank-screen delay before output appears.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `__handler_team-onboarding` | Synthetic BFS entry node for the command handler (not a real bundle symbol; prefer `getPromptForCommand` per Arbor) |
| `V6` | `flintHarborPrompt` — shared prompt-dispatch function used by all `prompt`-type commands |
| `_$6` | Harbor prompt helper (arg preparation, path 1) |
| `A$6` | Harbor prompt helper (arg preparation, path 2) |
| `we` | Prompt string builder / template renderer |
| `mH` | String-coercion / encoding utility |
| `Gb` | Session context accessor |
| `OS` | Transcript file reader orchestrator |
| `Hs4` | Low-level transcript line parser |
| `G$` | Transcript timestamp extractor |
| `RK6` | Transcript filtering helper |
| `we6` | Harbor session deduplication / dispatch |
| `BM_` | First-party event emitter |
| `aTH` | Event schema validator |
| `$p` | Random hex token generator (uses `pb9.randomBytes`) |
| `CH` | `JSON.stringify` wrapper |
| `is4` | Event serialisation helper |
| `cM_` | Outbound API call wrapper |
| `uE9` | Request header builder |
| `HA` | HTTP response handler |
| `Zb9` | Response body decoder |
| `WxH` | API allowlist checker (uses `AQK.has`) |
| `m6` | Config read/write orchestrator |
| `Q6` | Config path resolver |
| `Af_` | Config schema validator |
| `JOH` | Config file reader (reads, parses, handles `ENOENT` / `utf-8`) |
| `q` | Filesystem namespace (sync I/O: `readFileSync`, `statSync`, `mkdirSync`, `readdirStringSync`, `copyFileSync`) |
| `g6` | `JSON.parse` wrapper |
| `xC` | String prefix stripper (`startsWith` + `slice`) |
| `_` | Filesystem utilities (mixed sync/async) |
| `K8` | Error construction / wrapping utility |
| `mb9` | Backup directory enumerator |
| `N` | Log / diagnostic formatter |
| `c` | Core application state accessor |
| `Of_` | Path join + existence check helper |
| `w` | Background session dispatcher / process manager |
| `Et4` | File watcher (watchFile / unwatchFile lifecycle) |
| `rn` | File watch callback handler |
| `a9` | Signal / IPC registration helper |
| `f8` | Global config save orchestrator (with lock and backup) |
| `$f_` | Project config save orchestrator (with lock, backup, 5-file rotation) |
| `L` | Active lock set (tracks open file locks) |
| `M` | Lock/close lifecycle manager |
| `_L9` | Config merge helper (`Object.assign`) |
| `A__` | Config schema migrator |
| `f$6` | Auth-presence guard (prevents writing config that would lose auth) |
| `A` | Case-normalisation helper (`toLowerCase`) |
| `V` | Config field validator |
| `P` | MCP server connection manager |
| `wh8` | MCP transport factory |
| `RH` | MCP connection lifecycle handler |
| `c_` | Error wrapper (`Error` + `String`) |
| `Z` | Config slice accessor |
| `UK6` | Atomic file write helper (temp file + rename, `fchmodSync`, `fsyncSync`) |
| `O` | Stat result wrapper (`isSymbolicLink`) |
| `j8` | Error code classifier |
| `H` | Runtime / process utilities (varies by call site) |
| `OFH` | Unknown helper (reached via `f8`) |
| `ub9` | Object-entries iterator for config serialisation |
| `zFH` | Timestamp recorder for config writes |
| `ff_` | Config write finaliser (dirname + atomic write) |
| `z45` | Git context + transcript collection orchestrator (main data-gathering entry) |
| `j_` | Path resolution sub-utility |
| `Dv` | Path canonicalisation sub-utility |
| `FT` | Project path constructor |
| `Nv` | Project directory joiner |
| `Jz` | Project ID slice/replace helper |
| `WrK` | Absolute value utility (for path segment length) |
| `Ul1` | Transcript scanner (reads `.jsonl`, extracts session descriptors) |
| `s9` | Error swallower / silent-catch helper |
| `K` | Array padding/map helper (`padEnd`) |
| `$` | Session transcript state machine |
| `_Q1` | Session descriptor builder |
| `z` | Daemon background process handle |
| `bH` | Background process stdout handler |
| `uH` | Background process stderr handler |
| `Rk` | Daemon session enqueue helper |
| `pu` | Daemon shutdown orchestrator (`Promise.race`, `process.exit`) |
| `D` | Background session worker (dispatch + memory monitoring) |
| `Kv8` | Platform detection helper (macos / windows) |
| `kqA` | Bun-based background process spawner |
| `Dz` | Diagnostic / structured-log helper |
| `O45` | MCP config reader (reads `.mcp.json`, returns `mcpServers`) |
| `$45` | Additional MCP context helper |
| `G_` | Subprocess execution wrapper (git calls) |
| `lWH` | Child process manager (Anthropic SDK subprocess layer) |
| `SGA` | Process argument builder (win32 / non-win32 paths) |
| `Sd8` | Process stdout stream adapter |
| `Rd8` | Process stderr stream adapter |
| `bd8` | Stream close handler |
| `U0A` | Timeout validator (`Number.isFinite`) |
| `FK6` | Child process error handler |
| `hd8` | Reflect-based property definer for process streams |
| `jGA` | Process `exit` event listener registrar |
| `p0A` | Promise timeout wrapper (`Promise.race` + `clearTimeout`) |
| `B0A` | Process kill helper |
| `u0A` | Stdin data handler |
| `m0A` | Graceful kill handler (`H.kill`) |
| `DGA` | Process I/O draining helper |
| `cK6` | Process cleanup finaliser |
| `zGA` | Stream pipe setup |
| `YGA` | Stream aggregator (`fGA.default` + `A.add`) |
| `d0A` | Stdout line binder (`Gd8.bind`) |
| `zaK` | String coercion for process output |
| `oWH` | Git URL parser (trim, match, `git/` prefix detection) |
| `BaK` | URL host extractor |
| `Cq` | String slice-by-delimiter utility (`indexOf` + `slice`) |
| `RsH` | Harbor share / result publisher (emits `tengu_flint_harbor_share`) |
| `G1` | Message envelope builder |
| `Z2A` | Message content formatter |

---

*Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.*