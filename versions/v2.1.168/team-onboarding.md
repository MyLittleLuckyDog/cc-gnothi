---
type: feature-spec
feature: "team-onboarding"
cc_version: "2.1.168"
updated: "2026-06-11"
tags: ["team-onboarding", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.168 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/team-onboarding`

> Analysis basis: CC v2.1.168 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.168

---

## Overview

`/team-onboarding` is a `prompt`-type slash command that scans the invoking user's local Claude Code session transcripts (up to the last 365 days), derives a usage-data snapshot, and passes it — together with a detailed multi-step authoring brief — to the Claude agent. The agent co-authors a personalized `ONBOARDING.md` guide that teammates new to Claude Code can paste back into Claude for an interactive walkthrough.

---

## Registration

| Field | Value |
|---|---|
| type | `prompt` |
| name | `team-onboarding` |
| description | `Help teammates ramp on Claude Code with a guide from your usage` |
| isHidden | `false` |
| handler_method | `getPromptForCommand` |
| handler_method_start (byte) | 12117326 |
| handler_method_end (byte) | 12118036 |
| loc_byte | 12116988 |
| loc_byte_end | 12118037 |
| loc_line | 8499 |
| prompt_body.length | 4539 characters |
| prompt_body.trace | `identifier→$ (local→1 ext vars)` |
| arbor_handler.name | `getPromptForCommand` |
| arbor_handler.kind | `Method` |
| arbor_handler.fqn | `claude-2.1.168::getPromptForCommand` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | 2 |
| `handler_method_start` | `12117326` |
| `handler_method_end` | `12118036` |

Analysis basis: CC v2.1.168 bundle.js:+12116988

---

## Input Branching

The handler assembles the prompt through several distinct preparation steps before dispatching. Four or more identifiable branches/paths exist (transcript scan present vs. absent, MCP config present vs. absent, repo detection success vs. fallback, and usage-window clamping), so a flowchart is the appropriate representation.

```mermaid
flowchart TD
    A([User invokes /team-onboarding]) --> B[Emit tengu_flint_harbor_prompt telemetry]
    B --> C[Compute window: Math.min / Math.max / Math.floor\nclamp to ≤365 days from Date.now]
    C --> D[scanTranscripts — read .jsonl files\nfrom projects directory]
    D --> E{Transcripts found?}
    E -- Yes --> F[Parse each transcript:\nextract sessionDescriptors,\ntool counts, MCP counts,\nfirst user message, prNumbers]
    E -- No / empty --> G[usage data = empty / zero-session stub]
    F --> H[readMcpConfig — load .mcp.json\nfrom cwd, parse mcpServers]
    G --> H
    H --> I{.mcp.json present\nand parseable?}
    I -- Yes --> J[Include MCP server list\nname + urlOrigin in USAGE_DATA]
    I -- No / error --> K[MCP server list = empty]
    J --> L[resolveCurrentRepo:\ngit config user.name +\ngit remote get-url origin]
    K --> L
    L --> M{git commands succeed?}
    M -- Yes --> N[Include currentRepo + generatedBy\nin USAGE_DATA JSON]
    M -- No --> O[Omit currentRepo / generatedBy]
    N --> P[Build prompt:\nreplace template placeholders\n{{WINDOW_DAYS}}, {{USAGE_DATA}}, {{GUIDE_TEMPLATE}}]
    O --> P
    P --> Q[Emit tengu_team_onboarding_invoked telemetry]
    Q --> R[Return prompt string to agent\ntype: text]
    R --> S([Agent begins multi-turn\nco-authoring session])
```

Analysis basis: CC v2.1.168 bundle.js:+12117326 – +12118036

---

## Behavioral Spec

### 1 · Handler Entry and Window Calculation

```
function getPromptForCommand(context):
    emit telemetry("tengu_flint_harbor_prompt")

    windowDays = Math.floor(
        Math.max(1,
            Math.min(365, (Date.now() - earliestTranscriptTimestamp) / MS_PER_DAY)
        )
    )
    // 365 is the hard upper bound (bundle.js:+12117575)
```

Analysis basis: CC v2.1.168 bundle.js:+12117529 (Math.min), +12117538 (Math.max), +12117547 (Math.floor), +12117575 (365 literal), +12117675 (Date.now)

---

### 2 · Transcript Scanning (`scanTranscripts` / `Ctq`)

```
async function scanTranscripts(projectsDir, windowStartMs):
    entries = await fs.readdir(projectsDir)
    jsonlFiles = entries
        .filter(name => path.extname(name) === ".jsonl")
        // extension check: ".jsonl" (bundle.js:+12105939)

    results = await Promise.all(
        jsonlFiles.map(async file =>
            filePath = path.join(projectsDir, file)
            stat = await fs.stat(filePath)
            if not stat.isFile(): return null

            raw = await fs.readFile(filePath, "utf-8")
            lines = raw.split("\n")
            // up to 10 lines examined for first user message (bundle.js:+12106335)

            sessionData = {
                title: extractTitle(lines),
                prNumbers: extractPRNumbers(lines),   // regex ZIf/VIf
                firstUserMessage: extractFirstUserMsg(lines, limit=10),
                toolCounts: countToolUses(lines),
                mcpCounts: countMcpUses(lines),       // pattern "\"name\":\"mcp__" (bundle.js:+12106518)
                hasContent: countContentBlocks(lines) // pattern "\"content\":[" (bundle.js:+12106868)
            }
            return sessionData
        )
    )
    return results.filter(r => r != null)
```

Key constants (all from `Ctq`):
- Window: `24 * 60 * 1000` ms per minute factor at bundle.js:+12105824/+12105827/+12105833
- Extension filter: `".jsonl"` at bundle.js:+12105939
- First-user-message line scan limit: `10` at bundle.js:+12106335
- MCP detection pattern: `"\"name\":\"mcp__"` at bundle.js:+12106518
- Content block pattern: `"\"content\":["` at bundle.js:+12106868

Analysis basis: CC v2.1.168 bundle.js:+12105811 – +12107008

---

### 3 · MCP Config Reading (`readMcpConfig` / `kIf`)

```
async function readMcpConfig(cwd):
    mcpConfigPath = path.join(cwd, ".mcp.json")
    // filename: ".mcp.json" (bundle.js:+12108050)
    try:
        raw = await fs.readFile(mcpConfigPath, "utf8")
        // encoding: "utf8" (bundle.js:+12108063)
        parsed = JSON.parse(raw)
        servers = parsed["mcpServers"] ?? {}
        // key: "mcpServers" (bundle.js:+12108106)
        return servers
    catch (error):
        return {}   // silently ignore missing / malformed config
```

Analysis basis: CC v2.1.168 bundle.js:+12108026 – +12108285

---

### 4 · Repository and Author Resolution (`resolveRepoInfo` / `yIf`, `JZH`)

```
async function resolveRepoInfo(cwd):
    // Locate projects directory via ex/YI helpers
    projectsDir = buildProjectsPath(cwd)
    // "projects" literal: bundle.js:+12108287 (via YI/ex)

    authorName = await runGit(["config", "user.name"])
    // args: "git", "config", "user.name" (bundle.js:+12108673/+12108680/+12108689)

    remoteUrl = await runGit(["remote", "get-url", "origin"])
    // args: "git", "remote", "get-url", "origin" (bundle.js:+12108745/+12108754/+12108764)

    repoName = path.basename(parseGitUrl(remoteUrl))
    // JZH trims, matches, strips "git/" prefix (bundle.js:+12108853)
    // "localhost" guard: bundle.js:+12108861 (via JZH)

    return { currentRepo: repoName, generatedBy: authorName }
```

Analysis basis: CC v2.1.168 bundle.js:+12108351 – +12108861

---

### 5 · Prompt Assembly and Template Substitution

```
function buildPrompt(windowDays, usageData, guideTemplate, promptTemplate):
    // Three placeholders are replaced via String.replaceAll:
    //   "{{WINDOW_DAYS}}"   → String(windowDays)   (bundle.js:+12117786)
    //   "{{USAGE_DATA}}"    → JSON.stringify(usageData)  (bundle.js:+12117861)
    //   "{{GUIDE_TEMPLATE}}"→ guideTemplate string  (bundle.js:+12117826)

    filled = promptTemplate
        .replaceAll("{{WINDOW_DAYS}}", String(windowDays))
        .replaceAll("{{USAGE_DATA}}", usageDataJson)
        .replaceAll("{{GUIDE_TEMPLATE}}", guideTemplate)

    emit telemetry("tengu_team_onboarding_invoked")

    return { type: "text", content: filled }
    // return type "text" confirmed by literal at bundle.js:+12118020
```

Analysis basis: CC v2.1.168 bundle.js:+12117773 (replaceAll), +12117804 (String), +12117882 (zA6 / share helper), +12117905 (tengu_team_onboarding_generated), +12118020 (type: "text")

---

### 6 · Agent-Side Authoring Protocol (from `prompt_body`)

Once the prompt reaches the agent, it follows a strict five-step protocol:

```
procedure agentAuthorGuide(prompt):

    // Step 1 — Immediate acknowledgment (mandatory first output)
    print "> Looking at how you've used Claude over the last N days..."
    // Must precede any reasoning, classification, or tool calls.

    // Step 2 — Classify sessions from sessionDescriptors
    for each session in usageData.sessionDescriptors:
        taskType = classify(session) into one of:
            [build_feature, debug_fix, improve_quality, analyze_data,
             plan_design, prototype, write_docs]
        // Review sessions → mapped to type being reviewed
    select top 3-5 types with rough percentages
    // Display as title-case with spaces in output (e.g., "Build Feature")

    // Step 3 — Gather repo, MCP server info; leave Team Tips + Get Started as TODO

    // Step 4 — Write ONBOARDING.md using guide template
    //   - Fill real numbers (no placeholders)
    //   - Use generatedBy for author name; omit if absent
    //   - ASCII bar charts: █ = filled, ░ = empty, 20 chars wide
    //   - Preserve HTML comment instruction verbatim

    // Step 5 — Render guide in code block, then Review section
    print "---"
    print "**Review**"
    print "1. Team name confirmation question"
    print "2. Starter task question (ticket/doc link, optional)"
    print "3. Team tips question"

    // After user answers: update ONBOARDING.md with name, tips, starter task
    // Close with exact line (no variation):
    print "Saved to `ONBOARDING.md`. Drop it in your team docs and channels..."

    // Apply any subsequent edits to the file.
```

Analysis basis: CC v2.1.168 bundle.js:+12116988 – +12118036 (prompt_body, length 4539)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — invocation | `tengu_flint_harbor_prompt` (emitted at handler entry, bundle.js:+12117363) |
| Telemetry — command invoked | `tengu_team_onboarding_invoked` (emitted after usage-data assembly, bundle.js:+12117586) |
| Telemetry — guide generated | `tengu_team_onboarding_generated` (emitted after prompt build, bundle.js:+12117905) |
| Telemetry — share path | `tengu_flint_harbor_share` (emitted via `zA6` helper, bundle.js:+9832195) |
| Telemetry — config errors (indirect) | `tengu_config_parse_error`, `tengu_config_lock_contention`, `tengu_config_stale_write`, `tengu_config_auth_loss_prevented` (via config subsystem) |
| File reads | `.jsonl` transcript files under projects directory; `.mcp.json` in cwd |
| File writes | `ONBOARDING.md` in cwd (written by agent during multi-turn session, not by handler directly) |
| Git subprocess calls | `git config user.name`; `git remote get-url origin` |
| appState changes | None observed in depth-2 traversal |
| Hook registration | `j9` → `NPA.register` observed in call graph (bundle.js:+60369); role in this command is <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | None observed |
| Return value | `{ type: "text", content: <filledPromptString> }` (bundle.js:+12118020) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.168 | Initial analysis |

---

## Common Mistakes

1. **Running in a directory with no transcripts.** If the projects directory is empty or contains no `.jsonl` files, the usage data will be empty and the agent will produce a mostly blank guide with TODO placeholders. Run the command from a workspace where you have active Claude Code history.
2. **No `.mcp.json` present.** The MCP server section of the guide will be omitted silently. This is expected behaviour; add a `.mcp.json` before invoking if you want MCP setup instructions included.
3. **Not being inside a Git repository.** Both `git config user.name` and `git remote get-url origin` will fail, omitting `currentRepo` and `generatedBy` from the guide. The guide will still be generated but the author byline and repo name will be absent.
4. **Expecting an interactive Q&A before the draft.** The command instructs the agent to produce a complete draft immediately. Answering questions before seeing the guide is not the intended flow; the Review section comes after the first draft, not before.
5. **Manually editing `ONBOARDING.md` before the Review round-trip.** The agent updates the file in response to Review answers. Editing it externally between turns may cause the agent's update to overwrite your changes.
6. **Confusing the 365-day upper bound with a rolling default.** The window is clamped to a maximum of 365 days (bundle.js:+12117575) but is derived from the actual span of available transcripts, not a fixed default.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `D6` | Top-level command dispatch / session orchestration helper |
| `cj6` | Sub-helper called during session dispatch (role unclear at depth 2) |
| `lj6` | Sub-helper called during session dispatch (role unclear at depth 2) |
| `hu` | Intermediate dispatch helper wrapping `yu` |
| `yu` | Inner dispatch helper wrapping config accessor `kC` |
| `kC` | Config access coordinator (calls `AZL`, `D3`, `_$6`) |
| `cq8` | Deduplication / caching layer for session records |
| `hP_` | Session record constructor / emitter |
| `EvH` | Sub-step of session record construction (calls `xh`) |
| `ZB` | Random-bytes / hex token generator (calls `vo1.randomBytes`) |
| `RH` | JSON serialisation wrapper |
| `tZL` | Post-emit cleanup step |
| `uP_` | Session record persistence helper |
| `Ep1` | Sub-step of persistence (calls `flH`) |
| `l_` | Storage utility wrapping `gU` |
| `zo1` | Additional persistence sub-step |
| `lHH` | Duplicate-check set helper (calls `o74.has`) |
| `C6` | Config file read/watch orchestrator |
| `d6` | Low-level debug/log helper |
| `nP_` | Config helper (role unclear at depth 2) |
| `LwH` | Config file reader: reads, parses, backs up config JSON |
| `U6` | JSON parse wrapper |
| `Hu` | String prefix-strip utility (`startsWith` / `slice`) |
| `V8` | Structured error / validation wrapper |
| `No1` | Sibling-repo directory scanner (uses `readdirStringSync`, `basename`) |
| `v` | String formatting / colour utility (uppercase, trim, includes) |
| `tP_` | Path join + type utility |
| `w` | Daemon worker lifecycle manager (spawn, kill, memory checks) |
| `hVL` | Config file watcher (uses `watchFile` / `unwatchFile`) |
| `co` | Config watcher sub-step (role unclear at depth 2) |
| `j9` | Hook registration shim (calls `NPA.register`) |
| `X8` | Usage-data snapshot builder (main aggregation function) |
| `sP_` | Config save-with-lock implementation |
| `L` | Task/promise lifecycle manager (`add`, `delete`, `finally`) |
| `f` | Connection/stream close helper (`A.close`, `q.close`) |
| `R21` | Object merge utility (calls `QM_`, `Object.assign`) |
| `QM_` | Deep-merge helper (calls `S21`) |
| `aj6` | Additional aggregation sub-step (role unclear at depth 2) |
| `A` | String normalisation helper (`toLowerCase`) |
| `V` | Versioned value helper (`startsWith`) |
| `P` | Editor / terminal stream controller (NFC normalise, execute, setOffset) |
| `J` | Worker wrapper (calls `w`) |
| `j` | Worker kill helper (`A.values`, `S.kill`) |
| `H` | HTTP bootstrap fetch handler (`[Bootstrap] Fetching`) |
| `z` | Daemon stop controller (`SH`, `CH`, `uh`, `sp`) |
| `Y` | Supervisor config reload handler (`E.stop`, `E.start`, `E.updateConfig`) |
| `h` | Background session sweep / memory manager |
| `EOA` | Vim-mode operator dispatcher (operator, find, replace, indent …) |
| `C` | Rate-limit event queue executor |
| `E` | Supervisor / background worker (role shared across sub-features) |
| `O$6` | Atomic file write utility (temp file, fchmod, fsync, rename) |
| `O` | Symlink / stat wrapper (`isSymbolicLink`) |
| `h8` | Error-code helper (calls `V8`) |
| `dlH` | Directory list helper (role unclear at depth 2) |
| `Vo1` | Object entries iterator wrapper |
| `qK8` | Timestamp snapshot helper (`Date.now`) |
| `aP_` | Per-file write path resolver (dirname, xJ, RH, O$6) |
| `yIf` | Top-level usage-data assembly function (calls `Ctq`, `kIf`, `C_`, `JZH`) |
| `W_` | Environment/platform helper (calls `tv`) |
| `tv` | Terminal/platform detection primitive |
| `ex` | Projects-directory path builder (joins via `YI`) |
| `YI` | Base projects path helper (`Fr.join`, `t8`) |
| `OY` | Path relative-to-home formatter (`replace`, `slice`, `aG4`) |
| `aG4` | Absolute-value path helper (`Math.abs`, `_zH`) |
| `Ctq` | Transcript scanner: reads `.jsonl`, extracts session descriptors |
| `t1` | Error-wrapping helper (calls `V8`) |
| `K` | Array map + pad helper (`L.map`, `f.padEnd`) |
| `$` | Session event stream consumer (calls `DLK`) |
| `DLK` | Session record factory (`Yo`, `Date.now`, `V9`, `YC6`, `RH`) |
| `D` | Process exit / abort controller (`process.exit`, `z.abort`) |
| `IJ` | Forced-shutdown helper |
| `kIf` | MCP config reader: reads `.mcp.json`, returns `mcpServers` map |
| `IIf` | Supplementary data collector (role unclear at depth 2) |
| `C_` | Child-process executor wrapper (calls `YZH`) |
| `YZH` | Full child-process lifecycle manager (spawn, pipe, timeout, kill) |
| `oxA` | Platform-specific executable resolver (win32 `.exe` / `cmd`) |
| `M6_` | Argument builder sub-step (calls `BxA`) |
| `$6_` | Argument builder with extension handling (calls `BxA`, `xE4`) |
| `z6_` | Process option builder (calls `pE4`) |
| `qxA` | Numeric-argument validator (`Number.isFinite`) |
| `Y$6` | Process promise wrapper (`eT4`, error, Boolean) |
| `f6_` | Reflect-apply trampoline (proxy / wrap) |
| `bxA` | Exit-event listener installer (`H.on exit`) |
| `AxA` | Process timeout handler (`setTimeout`, `Promise.race`, `clearTimeout`) |
| `KxA` | Graceful-kill helper (`H.kill`, `q.finally`) |
| `HxA` | stdout/stderr data handler |
| `_xA` | SIGKILL escalation handler |
| `RxA` | Parallel sub-process launcher (`L6_`, `K6_`, `Promise.all`) |
| `J$6` | Process finaliser (calls `FH_`) |
| `hxA` | Stream pipe setup (calls `Ol6`, `A.pipe`) |
| `SxA` | Stream collector (calls `IxA.default`, `A.add`) |
| `$xA` | stdio binding helper (calls `aH_.bind`) |
| `QE4` | String coercion helper |
| `O$` | Error reporting sub-step (role unclear at depth 2) |
| `hH` | Structured logger / error formatter (`AA`, `_6`, `$q`, `DG4`) |
| `AA` | Error/string formatter primitive |
| `_6` | String-based error code helper |
| `$q` | Core logger (calls `dRA`) |
| `DG4` | Log-buffer ring manager (`Rc6.shift`, `Rc6.push`) |
| `JZH` | Git URL parser: trim, match, strip `"git/"` prefix, normalise hostname |
| `PZ4` | URL component extractor (calls `d1`) |
| `d1` | String index/slice utility |
| `zA6` | Flint harbor share helper (calls `$q`, `VZ`, `D6`) |
| `VZ` | Internal routing / state helper (calls `r1`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.