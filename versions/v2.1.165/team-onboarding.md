---
type: feature-spec
feature: "team-onboarding"
cc_version: "2.1.165"
updated: "2026-06-05"
tags: ["team-onboarding", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.165 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/team-onboarding`

> Analysis basis: CC v2.1.165 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.165

---

## Overview

`/team-onboarding` is a `prompt`-type slash command that scans the current user's local Claude Code transcript history, extracts a structured usage-data summary, and sends it to the agent along with a detailed co-authoring prompt. The agent produces a draft `ONBOARDING.md` guide tailored to the team's actual workflow patterns, then conducts a short interactive review with the guide creator before finalising the file.

---

## Registration

| Field | Value |
|---|---|
| type | `prompt` |
| name | `team-onboarding` |
| description | `Help teammates ramp on Claude Code with a guide from your usage` |
| isHidden | `false` |
| handler_method | `getPromptForCommand` |
| handler_method_start (byte) | `12081837` |
| handler_method_end (byte) | `12082547` |
| loc_byte | `12081499` |
| loc_byte_end | `12082548` |
| loc_line | `8484` |
| prompt_body.length | `4539` characters |
| prompt_body.trace | `identifier→$ (local→1 ext vars)` |
| arbor_handler.name | `getPromptForCommand` |
| arbor_handler.kind | `Method` |
| arbor_handler.fqn | `claude-2.1.165::getPromptForCommand` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `2` |
| `handler_method_start` | `12081837` |
| `handler_method_end` | `12082547` |

Analysis basis: CC v2.1.165 bundle.js:+12081499

---

## Input Branching

The handler executes several distinct preprocessing branches before building the final prompt: transcript scanning (with an empty-session guard), MCP config reading (file-present vs. absent), git identity resolution, and template variable substitution. Four or more distinct conditional paths warrant a Mermaid flowchart.

```mermaid
flowchart TD
    A(["/team-onboarding invoked"]) --> B[Emit tengu_team_onboarding_invoked]
    B --> C[Compute WINDOW_DAYS\nMath.min / Math.max / Math.floor\nover a 365-day cap]
    C --> D[Call transcript scanner — sVf\nread JSONL files from projects dir]
    D --> E{Any .jsonl transcripts\nfound in last WINDOW_DAYS?}
    E -- "~0 sessions" --> F[Set USAGE_DATA with\nempty sessionDescriptors;\nwork-type breakdown → TODO]
    E -- "sessions found" --> G[Parse each transcript line\nExtract sessionDescriptors:\ntitle, prNumbers, firstMessage,\ntool counts, MCP counts]
    G --> H[Run MCP config reader — aVf\nRead .mcp.json]
    F --> H
    H --> I{.mcp.json present\nand parseable?}
    I -- "yes" --> J[Extract mcpServers entries\nname + urlOrigin for each server]
    I -- "no / ENOENT" --> K[mcpServers = empty list]
    J --> L[Run git identity resolver — S_\ngit config user.name\ngit remote get-url origin]
    K --> L
    L --> M{git commands\nsucceeded?}
    M -- "yes" --> N[Set generatedBy = git user name\nSet currentRepo = remote origin basename]
    M -- "no" --> O[generatedBy omitted\ncurrentRepo = cwd basename fallback]
    N --> P[Substitute template variables\ninto prompt body via replaceAll:\n{{WINDOW_DAYS}}, {{USAGE_DATA}},\n{{GUIDE_TEMPLATE}}]
    O --> P
    P --> Q[Emit tengu_team_onboarding_generated]
    Q --> R[Return assembled prompt string\ntype: text]
    R --> S([Agent receives prompt\nand begins guide generation])
```

Analysis basis: CC v2.1.165 bundle.js:+12081843 (handler entry), +12082040 (Math.min/max/floor), +12082086 (365-day literal), +12082275 (sVf call), +12082284 (replaceAll), +12082393 (X_6 / template substitution), +12082416 (tengu_team_onboarding_generated), +12082531 (text return type)

---

## Behavioral Spec

### 1. Handler Entry and Invocation Telemetry

```
function getPromptForCommand(context):
    emit("tengu_flint_harbor_prompt")          // shared prompt-command event
    emit("tengu_team_onboarding_invoked")      // command-specific invocation event
    windowDays = clampWindowDays(context)
    ...
```

The handler first fires two telemetry events: the generic `tengu_flint_harbor_prompt` (shared across all `flint`-class prompt commands) and the command-specific `tengu_team_onboarding_invoked`.

Analysis basis: CC v2.1.165 bundle.js:+12081874 (tengu_flint_harbor_prompt), +12082097 (tengu_team_onboarding_invoked)

---

### 2. Window Days Calculation

```
function clampWindowDays(context):
    raw   = context.windowDays ?? DEFAULT_WINDOW
    capped = Math.min(raw, 365)          // hard upper bound: 365 days
    floored = Math.floor(Math.max(capped, 1))
    return floored
```

The look-back window is bounded to a maximum of **365 days** and a minimum of **1 day** using `Math.min`, `Math.max`, and `Math.floor`. This value becomes the `{{WINDOW_DAYS}}` placeholder in the prompt.

Analysis basis: CC v2.1.165 bundle.js:+12082040 (Math.min), +12082049 (Math.max), +12082058 (Math.floor), +12082086 (365 literal)

---

### 3. Transcript Scanner (`sVf` / `gaq`)

```
function scanTranscripts(projectsDir, windowDays):
    cutoff = Date.now() - (windowDays * 24 * 60 * 1000)
    files  = fs.readdir(projectsDir)
    jsonlFiles = files.filter(f => extname(f) == ".jsonl")

    sessions = []
    for each file in jsonlFiles:
        stat = fs.stat(file)
        if not stat.isFile():
            continue
        raw = fs.readFile(file, "utf-8")
        lines = raw.split("\n").slice(0, 10)      // first 10 lines sampled
        for each line in lines:
            if line includes '"name":"mcp__':
                // extract MCP tool usage counts
            if line matches '"content":['  regex:
                // extract first user message text
            parse sessionDescriptor (title, prNumbers, firstMessage,
                                     toolCount, mcpCount)
        sessions.push(sessionDescriptor)

    return { sessionDescriptors: sessions, currentRepo: cwdBasename }
```

The scanner reads `.jsonl` transcript files from the user's local `projects` directory (path built via `vx`/`nv` helpers using a `projects` sub-path). It timestamps each file against the computed cutoff. Key string sentinels used during line parsing:

- `"name":"mcp__"` (byte +12071029) — detects MCP tool invocations
- `"content":["` (byte +12071379) — detects assistant/user content blocks

Numeric constants involved: look-back unit conversion uses **24** hours × **60** minutes × **1000** ms (bytes +12070335, +12070338, +12070344). The line sampler takes the first **10** lines of each file (byte +12070846).

Analysis basis: CC v2.1.165 bundle.js:+12072862 (X_ path helper), +12072869 (vx), +12072883 (gaq), +12070363 (readdir), +12070433 (extname filter), +12070450 (.jsonl literal), +12070706 (readFile), +12070820 (split lines), +12071170 (lVf.exec regex), +12071226 (nVf.exec regex), +12071401 (iVf.exec regex)

---

### 4. MCP Config Reader (`aVf`)

```
function readMcpConfig(workspaceDir):
    configPath = path.join(workspaceDir, ".mcp.json")
    try:
        raw = fs.readFile(configPath, "utf8")
        parsed = JSON.parse(raw)
        servers = parsed["mcpServers"] ?? {}
        return buildServerList(servers)   // name + urlOrigin per entry
    catch ENOENT:
        return []
    catch parseError:
        return []
```

The function looks for `.mcp.json` (byte +12072561) in the current workspace directory, reads it as UTF-8 (byte +12072574), and extracts the `mcpServers` key (byte +12072617). On any read or parse failure it returns an empty list silently. The resulting server list is injected into the usage data passed to the agent so it can generate MCP-setup instructions in the guide.

Analysis basis: CC v2.1.165 bundle.js:+12073000 (aVf call site), +12072537 (readFile), +12072550 (path join), +12072584 (JSON.parse via B6), +12072617 (mcpServers key)

---

### 5. Git Identity Resolver (`S_` / `pTH`)

```
function resolveGitIdentity(cwd):
    userName = spawnSync("git", ["config", "user.name"], {cwd})
    if userName.stdout is non-empty:
        generatedBy = userName.stdout.trim()
    else:
        generatedBy = null

    remoteUrl = spawnSync("git", ["remote", "get-url", "origin"], {cwd})
    if remoteUrl.stdout is non-empty:
        currentRepo = basename(remoteUrl.stdout.trim())
    else:
        currentRepo = basename(cwd)

    return { generatedBy, currentRepo }
```

Two synchronous git invocations are made: `git config user.name` (bytes +12073191, +12073200) and `git remote get-url origin` (bytes +12073256, +12073265, +12073275). The `pTH` helper trims output and extracts the basename. If either command fails the corresponding field is omitted or falls back to the working-directory basename.

Analysis basis: CC v2.1.165 bundle.js:+12073181 (S_ call site), +12073184 (git literal), +12073191 (config), +12073200 (user.name), +12073256 (remote), +12073265 (get-url), +12073275 (origin), +12073364 (pTH), +12073372 (aS8.basename)

---

### 6. Template Variable Substitution

```
function buildFinalPrompt(promptBody, windowDays, usageData, guideTemplate):
    s = promptBody
    s = s.replaceAll("{{WINDOW_DAYS}}",    String(windowDays))
    s = s.replaceAll("{{GUIDE_TEMPLATE}}", guideTemplate)
    s = s.replaceAll("{{USAGE_DATA}}",     JSON.stringify(usageData))
    return { type: "text", content: s }
```

Three mustache-style placeholders are substituted via `String.prototype.replaceAll` (byte +12082284): `{{WINDOW_DAYS}}` (byte +12082297), `{{GUIDE_TEMPLATE}}` (byte +12082337), and `{{USAGE_DATA}}` (byte +12082372). The result is returned as a `{ type: "text" }` object (byte +12082531).

The `X_6` helper (byte +12082393) performs the guide-template look-up, calling `Dq` (config access) and `WZ`/`n1` to resolve the template string before injection.

Analysis basis: CC v2.1.165 bundle.js:+12082284 (replaceAll), +12082297 ({{WINDOW_DAYS}}), +12082315 (String cast), +12082337 ({{GUIDE_TEMPLATE}}), +12082372 ({{USAGE_DATA}}), +12082393 (X_6), +12082531 (text)

---

### 7. Agent-Side Guide Generation (Prompt-Driven Behavior)

Once the assembled prompt reaches the agent, the agent is instructed to:

1. **Immediately output an acknowledgment line** before any classification or tool use — the prompt is explicit that "the guide creator is staring at a blank screen." (prompt body, opening task section)
2. **Classify sessions** from `sessionDescriptors` into up to seven task-type buckets: `build_feature`, `debug_fix`, `improve_quality`, `analyze_data`, `plan_design`, `prototype`, `write_docs`. The top 3–5 by rough percentage are selected. Display names use title case with spaces (e.g., "Build Feature"). If the session count is approximately zero the breakdown is left as a TODO placeholder.
3. **Gather repo and MCP context** from the injected `currentRepo` field and the `mcpServers` list.
4. **Write `ONBOARDING.md`** using the injected `{{GUIDE_TEMPLATE}}` template, populating real numbers, ASCII bar charts (20 chars wide, `█` filled / `░` empty), and the `generatedBy` name if available.
5. **Render the draft in a code block**, then add a `---` separator and a `**Review**` heading with exactly three numbered questions about team name, a starter task, and team tips.
6. **After the creator replies**, update `ONBOARDING.md` and close with the fixed completion line: `Saved to` `` `ONBOARDING.md` ``. `` Drop it in your team docs and channels…``

Analysis basis: CC v2.1.165 bundle.js:+12081499–12082548 (registration block / prompt body)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — invocation | `tengu_flint_harbor_prompt` (byte +12081874) — fires on every prompt-command dispatch |
| Telemetry — command | `tengu_team_onboarding_invoked` (byte +12082097) — fires at handler entry |
| Telemetry — completion | `tengu_team_onboarding_generated` (byte +12082416) — fires after prompt assembly succeeds |
| Telemetry — config errors | `tengu_config_parse_error` (byte +3262552), `tengu_config_lock_contention` (+3259977), `tengu_config_stale_write` (+3260113), `tengu_config_auth_loss_prevented` (+3260456) — emitted by config subsystem if accessed during handler |
| Telemetry — background | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_retire_pinned_low_mem`, `tengu_bg_prewarm_per_sweep` — background daemon events reachable via call graph, not specific to this command |
| Telemetry — share | `tengu_flint_harbor_share` (byte +9808382) — emitted by the harbor-share path reachable via X_6 |
| File reads | `projects/` directory listing + per-file `.jsonl` reads (transcript scan) |
| File reads | `.mcp.json` in workspace (MCP config) |
| File writes | `ONBOARDING.md` written (or updated) by the agent during the conversation — not by the handler itself |
| External process spawns | `git config user.name`, `git remote get-url origin` (synchronous, via `S_`/`pTH`) |
| appState changes | None detected in depth-2 traversal |
| Hook registration | `j9` → `zXA.register` reachable via `WTL` (file-watcher hook); not specific to this command |
| Sound | None detected |

---

## Version History

| Version | Change |
|---|---|
| v2.1.165 | Initial analysis |

---

## Common Mistakes

1. **Running `/team-onboarding` in a directory with no `.claude` transcript history** — the scanner finds zero `.jsonl` files, the `sessionDescriptors` array is empty, and the agent leaves the work-type breakdown as a TODO. Run it in the same working directory you normally use with Claude Code.
2. **No git remote configured** — the `git remote get-url origin` call fails silently; `currentRepo` falls back to the working-directory basename, which may be generic (e.g., `src`). Set a remote or manually tell the agent the repo name during the Review step.
3. **Expecting the agent to ask questions before producing a draft** — the prompt explicitly instructs the agent to generate first and ask second. If the response stalls before producing `ONBOARDING.md`, the acknowledgment line may be suppressed by the model's extended thinking; this is a known ordering constraint documented in the prompt body.
4. **`{{GUIDE_TEMPLATE}}` appearing literally in the output** — indicates the `X_6` config look-up returned `null` or an empty string (config not yet initialised or accessed before allowed). The literal `Config accessed before allowed.` error string (byte +3261921) may appear in logs.
5. **Window days exceeding 365** — any value larger than 365 is silently clamped to 365. Passing `windowDays=0` is clamped up to 1. There is no user-visible error for out-of-range values.
6. **Editing `ONBOARDING.md` externally mid-conversation** — the file watcher (`WTL` / `a98.watchFile`) may reload config state during the session, potentially causing stale-write protection (`tengu_config_stale_write`) to fire if the config cache diverges. Save external edits only after the agent closes the session.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `__handler_team-onboarding` | Synthetic BFS entry point for the command handler (not a real bundle symbol) |
| `D6` | Session/context dispatcher — routes incoming command context to sub-handlers |
| `Hj6` | Sub-handler A invoked by dispatcher |
| `_j6` | Sub-handler B invoked by dispatcher |
| `qu` | Queue or promise-chain utility called by dispatcher |
| `Au` | Async utility / awaiter helper |
| `fC` | Core flow controller (calls transcript-path helpers lGL, H3, wM6) |
| `B98` | Deduplication / caching layer (uses DX_ Set, yDH Map) |
| `YX_` | Session record builder (generates UUID, emits Growthbook event) |
| `QNH` | Hash/digest helper called by session builder |
| `oU` | Random-bytes / ID generator (uses zr1.randomBytes, 32-byte hex) |
| `SH` | JSON serialiser wrapper (delegates to JSON.stringify) |
| `gEL` | Event emitter helper used during session creation |
| `XX_` | Async parallel executor / fan-out helper |
| `fm1` | File-manifest builder |
| `e_` | Error normaliser / wrapper |
| `oi1` | Output iterator helper |
| `ZHH` | Set-membership guard (uses c44.has) |
| `y6` | Primary transcript-data aggregator |
| `Q6` | Logging / debug-output helper |
| `kX_` | Key extractor / field picker |
| `bDH` | Config file reader (reads utf-8, handles ENOENT) |
| `q` | Filesystem facade (readFileSync, statSync, mkdirSync, etc.) |
| `B6` | JSON.parse wrapper |
| `Ix` | String prefix stripper (startsWith / slice) |
| `_` | General utility / lodash-like helper |
| `v8` | Verbose/debug logger |
| `Or1` | Directory-tree walker (readdirStringSync, statSync) |
| `v` | Value formatter / renderer |
| `c` | Config accessor singleton |
| `bX_` | Backup-path builder (appends `backups/` segment) |
| `w` | Background-session manager / daemon worker |
| `WTL` | File watcher (wraps a98.watchFile / a98.unwatchFile) |
| `No` | Notification / observer helper |
| `j9` | Hook registrar (calls zXA.register) |
| `X8` | Usage-data collector — top-level transcript scan entry |
| `CX_` | Per-project transcript processor / file copier |
| `L` | Async resource-set manager (add/delete/finally) |
| `f` | Stream / handle closer (close A, close q) |
| `XP1` | Config merge helper (Object.assign) |
| `k5_` | Config loader (calls JP1) |
| `fj6` | Field-presence / schema validator |
| `A` | Lowercase normaliser / text util |
| `V` | Path/string prefix checker (startsWith) |
| `P` | Terminal / PTY session manager |
| `J` | Worker reference holder |
| `j` | Worker-set iterator / killer |
| `H` | Bootstrap fetcher (API fetch with User-Agent, Content-Type headers) |
| `z` | Daemon stopper (stop / stop-failed telemetry) |
| `Y` | Supervisor config reloader |
| `h` | Background sweep / memory-pressure handler |
| `L3A` | Vim-mode operator registry |
| `C` | Rate-limit event enqueuer |
| `T` | Background worker controller (start/stop/updateConfig) |
| `TM6` | Atomic file writer (open/write/fsync/rename/chmod) |
| `O` | Filesystem stat result wrapper (isSymbolicLink) |
| `R8` | Error code normaliser |
| `_lH` | Internal lookup helper for X8 |
| `$r1` | Object.entries-based iterator |
| `t98` | Timestamp helper (Date.now wrapper) |
| `RX_` | Config-write path (per-project, calls TM6) |
| `sVf` | Top-level usage-data builder (orchestrates gaq, aVf, S_, pTH) |
| `X_` | Projects-directory path resolver |
| `uv` | Platform path utility |
| `vx` | Full project-dir path builder |
| `nv` | Base project-path builder (Vr.join + `projects`) |
| `_Y` | Relative-path normaliser |
| `gW4` | Path-distance / depth calculator (Math.abs) |
| `gaq` | Transcript file scanner (readdir, readFile, regex parse) |
| `s1` | Error-code inspector |
| `K` | Column formatter (map + padEnd) |
| `$` | Tenant/session state map |
| `NKK` | Notification/event queue entry builder |
| `D` | Forced-shutdown handler (process.exit, abort) |
| `IJ` | Shutdown reason recorder |
| `aVf` | MCP config reader (reads .mcp.json, extracts mcpServers) |
| `oVf` | Output-value formatter used after MCP reading |
| `S_` | Git identity + repo resolver (spawns git commands) |
| `bTH` | Child-process spawner (win32/posix, timeout, kill) |
| `FbA` | Process argument builder (win32 .exe / cmd /q handling) |
| `le8` | Spawn option builder A |
| `ne8` | Spawn option builder B (vG4 variant) |
| `re8` | Spawn option builder C (yG4 variant) |
| `rCA` | Number.isFinite validator / TypeError thrower |
| `VM6` | Process output buffer collector |
| `ce8` | Reflect.apply-based proxy trap |
| `NbA` | Process-event ('exit') listener installer |
| `iCA` | Timeout-race wrapper (setTimeout / clearTimeout / Promise.race) |
| `oCA` | Kill-on-finally helper (H.kill + q.finally) |
| `lCA` | Output-line collector (bound) |
| `nCA` | SIGKILL sender (bound) |
| `ZbA` | Stream-drain awaiter (Promise.all) |
| `kM6` | Post-spawn setup (Ne8) |
| `EbA` | Stdio pipe connector |
| `TbA` | PbA.default spawner with Set tracking |
| `eCA` | xe8.bind stdout/stderr/all stream handler |
| `bG4` | String coercion helper |
| `K$` | Key-set / permissions helper |
| `kH` | Structured error logger (logError, hBH push) |
| `HA` | Error-to-string converter |
| `eH` | String coercion for error messages |
| `Dq` | Config-value accessor (reads from config store) |
| `qW4` | Ring-buffer manager (kd6 shift/push) |
| `pTH` | Git output parser (trim, match, startsWith, split, toLowerCase) |
| `$E4` | Host/URL parser helper |
| `Q1` | String slicer (indexOf + slice) |
| `X_6` | Guide-template resolver + harbor-share dispatcher |
| `WZ` | Template lookup helper (calls n1) |

---

*Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.*