---
type: feature-spec
feature: "team-onboarding"
cc_version: "2.1.191"
updated: "2026-06-25"
tags: ["team-onboarding", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.191 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/team-onboarding`

> Analysis basis: CC v2.1.191 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.191

---

## Overview

`/team-onboarding` is a `prompt`-type slash command that analyzes the invoking user's local Claude Code session transcripts (scanned over a configurable recent window) and co-authors a structured `ONBOARDING.md` guide for teammates who are new to Claude Code. The command operates as a multi-turn collaborative workflow: it immediately drafts a concrete guide, then iterates with the guide creator over team name, tips, and a starter task before finalizing the file.

---

## Registration

| Field | Value |
|---|---|
| type | `prompt` |
| name | `team-onboarding` |
| description | `Help teammates ramp on Claude Code with a guide from your usage` |
| isHidden | `false` |
| handler_method | `getPromptForCommand` |
| handler_method_start (byte) | `13139628` |
| handler_method_end (byte) | `13140338` |
| loc_byte | `13139265` |
| loc_byte_end | `13140339` |
| loc_line | `8920` |
| prompt_body.length | `4539` characters |
| prompt_body.trace | `identifier→l (local→1 ext vars)` |
| arbor_handler.name | `getPromptForCommand` |
| arbor_handler.kind | `Method` |
| arbor_handler.fqn | `claude-2.1.191::getPromptForCommand` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `2` |
| `handler_method_start` | `13139628` |
| `handler_method_end` | `13140338` |

Analysis basis: CC v2.1.191 bundle.js:+13139265

---

## Input Branching

The handler has four or more distinct branches (feature-gate check, usage-data collection, window-day clamping, template population, and prompt dispatch), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/team-onboarding invoked"]) --> B{Feature gate:\nallow_team_onboarding\nin config?}
    B -- "No / not set" --> C[Return early / no-op\nor surface permission error]
    B -- "Yes" --> D[Emit telemetry:\ntengu_team_onboarding_invoked]
    D --> E[Read local JSONL transcripts\nvia transcript-scanner\ncollectUsageData]
    E --> F[Clamp WINDOW_DAYS:\nMath.min / Math.max / Math.floor\nrange: 1–365 days]
    F --> G[Collect currentRepo,\nsibling repos, MCP server list\nvia collectContextData]
    G --> H[Read GUIDE_TEMPLATE\nfrom internal constant]
    H --> I[Populate prompt:\nreplace {{WINDOW_DAYS}},\n{{USAGE_DATA}}, {{GUIDE_TEMPLATE}}]
    I --> J[Emit telemetry:\ntengu_flint_harbor_prompt]
    J --> K[Dispatch prompt to agent\nvia promptDispatch / nt]
    K --> L{Agent first turn:\noutput acknowledgment line\nthen draft ONBOARDING.md}
    L --> M[Agent asks 3 Review questions:\nteam name · starter task · tips]
    M --> N{Guide creator replies}
    N --> O[Agent updates ONBOARDING.md\nwith answers]
    O --> P[Emit telemetry:\ntengu_team_onboarding_generated]
    P --> Q[Agent writes final close line\nto ONBOARDING.md]
    Q --> R([Done])
```

Analysis basis: CC v2.1.191 bundle.js:+13139628, +13139831, +13139840, +13139849, +13139877, +13139888, +13140066, +13140075, +13140184, +13140207

---

## Behavioral Spec

### 1. Feature-Gate Check

Before any work begins, the handler reads the `allow_team_onboarding` configuration flag (literal found at bundle.js:+10287422). If the flag is absent or falsy, execution stops and no prompt is dispatched. The gate is evaluated via the `checkFeatureEnabled` helper (identifier `vs`) which consults the config-state cache.

```
function checkTeamOnboardingGate(config):
    if not config.get("allow_team_onboarding"):
        return BLOCKED
    return ALLOWED
```

Analysis basis: CC v2.1.191 bundle.js:+10287422, +10287419

### 2. Window-Day Clamping

The handler derives `WINDOW_DAYS` — the look-back period used to scope transcript scanning — from user context or a default. It applies arithmetic guards to keep the value in the closed interval [1, 365]:

```
function clampWindowDays(rawDays):
    bounded = Math.max(1, rawDays)      // floor at 1
    bounded = Math.min(365, bounded)    // ceiling at 365
    return Math.floor(bounded)          // integer only
```

Constants: minimum `1` (bundle.js:+13139874), maximum `365` (bundle.js:+13139877).

Analysis basis: CC v2.1.191 bundle.js:+13139831, +13139840, +13139849, +13139874, +13139877

### 3. Usage-Data Collection (`collectUsageData` / `gn`)

The `collectUsageData` function (`gn`) scans local `.jsonl` transcript files to produce the `USAGE_DATA` JSON blob injected into the prompt. It is the most structurally complex part of the handler.

```
function collectUsageData(windowDays):
    cutoffMs = Date.now() - windowDays * 24 * 60 * 60 * 1000
    transcriptDir = resolveTranscriptDir()          // via transcriptDirResolver (U7t)
    files = fs.readdir(transcriptDir)
                .filter(f => f.endsWith(".jsonl"))  // literal ".jsonl" at +13128310
                .filter(f => stat(f).mtime >= cutoffMs)

    sessions = []
    for file in files:
        lines = fs.readFile(file).split("\n")       // up to 10 lines sampled (+13128706)
        meta = extractSessionMeta(lines)            // title, prNumbers, firstUserMessage
        mcpHits = countMcpToolCalls(lines)          // regex O1f, N1f, U1f
        sessions.append(meta)

    usageData = {
        generatedBy:       resolveGitUserName(),    // git config user.name
        currentRepo:       resolveCurrentRepo(),    // git remote get-url origin
        sessionDescriptors: sessions,
        windowDays:        windowDays,
        mcpServers:        collectMcpServers(),     // from .mcp.json
        toolCounts:        aggregateToolCounts(sessions)
    }
    return JSON.stringify(usageData)
```

Key sub-calls and their roles:
- **`transcriptDirResolver` (`U7t`)** — resolves the Claude projects directory, acquires a config lock, copies backup files (up to 5 backups, literal at +13866854), guards against lock contention with a 60 000 ms timeout (literal at +13866599). Analysis basis: CC v2.1.191 bundle.js:+13862115, +13865626, +13866599, +13866854
- **`sessionMetaExtractor` (`v8l`)** — reads each `.jsonl` file, applies three compiled regular expressions (`O1f`, `N1f`, `U1f`) to detect MCP tool invocations and PR numbers, and extracts the first user message. It skips files older than `cutoffMs` (24 h × 60 min × 60 s window, literals at +13128195/+13128198). Analysis basis: CC v2.1.191 bundle.js:+13128223, +13128566, +13128680, +13129030, +13129086, +13129261
- **`mcpServerReader` (`B1f`)** — reads `.mcp.json` from the project root (literal at +13130340), parses it as JSON, and extracts `mcpServers` entries. Analysis basis: CC v2.1.191 bundle.js:+13130316, +13130340, +13130396
- **`gitContextCollector` (`G1f`)** — runs `git config user.name` and `git remote get-url origin` to populate `generatedBy` and `currentRepo`. Literals: `"git"` (+13130963), `"config"` (+13130970), `"user.name"` (+13130979), `"remote"` (+13131035), `"get-url"` (+13131044), `"origin"` (+13131054). Analysis basis: CC v2.1.191 bundle.js:+13130641, +13130779, +13130960

### 4. Prompt Template Population

After usage data is assembled, the handler performs three `String.replaceAll` substitutions on the prompt body:

```
function populatePrompt(promptTemplate, windowDays, usageDataJson, guideTemplate):
    result = promptTemplate.replaceAll("{{WINDOW_DAYS}}", String(windowDays))
    result = result.replaceAll("{{USAGE_DATA}}", usageDataJson)
    result = result.replaceAll("{{GUIDE_TEMPLATE}}", guideTemplate)
    return result
```

Placeholder literals confirmed at: `"{{WINDOW_DAYS}}"` (+13140088), `"{{GUIDE_TEMPLATE}}"` (+13140128), `"{{USAGE_DATA}}"` (+13140163). The `replaceAll` call site is at +13140075.

Analysis basis: CC v2.1.191 bundle.js:+13140075, +13140088, +13140106, +13140128, +13140163

### 5. Prompt Dispatch (`promptDispatch` / `nt`)

The populated prompt string is handed to the shared prompt-dispatch subsystem (`nt`), which handles conversation-state management, session deduplication (via `x5r` / `xve` sets), and event emission. This subsystem is shared across all `prompt`-type commands.

```
function promptDispatch(populatedPrompt, context):
    sessionId = crypto.randomUUID()
    if sessionRegistry.has(sessionId):
        sessionId = resolveConflict(sessionId)
    conversationState = buildConversationEntry(populatedPrompt, sessionId)
    eventBus.emit("prompt_ready", conversationState)
    return conversationState
```

Analysis basis: CC v2.1.191 bundle.js:+3336540, +3336629, +3336640, +3336652, +3329730

### 6. Agent Behavior (Prompt-Directed)

The 4 539-character prompt instructs the agent to execute a precise five-step protocol:

**Step 1 — Immediate acknowledgment (no thinking allowed first):** The agent must emit a specific blockquote line referencing `{{WINDOW_DAYS}}` as its very first visible output before any reasoning, classification, or tool calls. The prompt is explicit that the guide creator is waiting at a blank screen.

**Step 2 — Session classification:** The agent reads `sessionDescriptors` from the injected usage data and assigns each session to one of seven task types: `build_feature`, `debug_fix`, `improve_quality`, `analyze_data`, `plan_design`, `prototype`, or `write_docs`. It selects the top 3–5 by frequency and expresses them as rough percentages. Display uses title-case with spaces (e.g., "Build Feature"). If `sessionDescriptors` is empty (zero sessions), the breakdown is left as a `TODO` placeholder.

**Step 3 — Context gathering:** The agent uses `currentRepo` from usage data and scans for sibling repository directories. MCP server entries are described by their `name` (and `urlOrigin` where present). The Team Tips and Get Started sections are left as `TODO` placeholders pending the Review round.

**Step 4 — Write `ONBOARDING.md`:** The agent fills in the `{{GUIDE_TEMPLATE}}` structure with real numbers from the usage data. ASCII bar charts use `█` for filled and `░` for empty segments, at 20 characters wide. The `generatedBy` field from usage data provides the author name; if absent, the name is omitted. An HTML comment instruction at the bottom of the template is preserved verbatim.

**Step 5 — Review round and final save:** After rendering the guide in a fenced code block, the agent adds a horizontal rule and a `**Review**` heading, then poses exactly three numbered questions: (1) team-name confirmation or request, (2) optional starter task, (3) team tips not in `CLAUDE.md`. After the guide creator replies, the agent updates `ONBOARDING.md` with the answers and closes with a specific, exact closing line referencing the file and instructing the user to share it.

Analysis basis: CC v2.1.191 bundle.js:+13139265 (prompt_body, length 4539)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_team_onboarding_invoked` | Emitted immediately after the feature-gate passes, before usage-data collection (bundle.js:+13139888) |
| Telemetry: `tengu_flint_harbor_prompt` | Emitted when the populated prompt is dispatched to the agent (bundle.js:+13139665) |
| Telemetry: `tengu_team_onboarding_generated` | Emitted after the guide is fully generated and written (bundle.js:+13140207) |
| Telemetry: `tengu_flint_harbor_share` | Emitted via the `checkFeatureEnabled` / `vs` path when feature-gate is evaluated (bundle.js:+10287484) |
| Telemetry: `tengu_config_lock_contention` | Emitted by `transcriptDirResolver` when config lock takes longer than expected (bundle.js:+13865550) |
| Telemetry: `tengu_config_stale_write` | Emitted when a stale config write is detected during transcript scanning (bundle.js:+13865686) |
| Telemetry: `tengu_config_parse_error` | Emitted when config JSON fails to parse during transcript dir setup (bundle.js:+13869283) |
| Telemetry: `tengu_config_auto_repaired` | Emitted when config is auto-repaired from cache under lock (bundle.js:+13866063) |
| Telemetry: `tengu_config_auth_loss_prevented` | Emitted when a write that would erase auth fields is blocked (bundle.js:+13866393) |
| Telemetry: `tengu_config_fallback_write` | Emitted when the config write falls back to an alternative path (bundle.js:+13865166) |
| File write: `ONBOARDING.md` | Written to the current working directory by the agent at the end of the multi-turn session |
| Config lock | A file-system lock is acquired during transcript scanning; 60 000 ms timeout; contention triggers `tengu_config_lock_contention` (bundle.js:+13866599) |
| Backup files | Up to 5 config backup files may be created/rotated under a `backups/` subdirectory (bundle.js:+13866854, literal `"backups"` at +13867437) |
| Feature gate | Reads `allow_team_onboarding` boolean from config before proceeding (bundle.js:+10287422) |
| Git subprocess | Spawns `git config user.name` and `git remote get-url origin` via `childProcessRunner` (`Kr`) to collect author and repo context (bundle.js:+13130963, +13131054) |
| `.mcp.json` read | Reads project-local `.mcp.json` (bundle.js:+13130340) to enumerate MCP servers for the guide |
| Transcript JSONL read | Reads `.jsonl` files from the Claude projects directory filtered to the clamped window (bundle.js:+13128223, +13128310) |
| appState changes | Session is registered in the shared conversation/session registry (`x5r`, `xve`, `bDt`, `gW` sets) via the prompt-dispatch subsystem (bundle.js:+3333835, +3336652, +3336666) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.191 | Initial analysis |

---

## Common Mistakes

1. **Invoking when `allow_team_onboarding` is not enabled.** The command silently exits (or returns an error) if the feature gate in the user config is falsy. Ensure the flag is present and `true` before expecting output.
2. **Expecting an interactive Q&A before the guide.** The prompt explicitly instructs the agent to produce a complete draft first and ask revision questions afterward. Providing answers before seeing the draft is not the intended flow.
3. **Running from a directory with no `.jsonl` transcripts in range.** If no sessions fall within the clamped window, the `sessionDescriptors` array will be empty and the work-type breakdown will be a `TODO` placeholder — the guide is still generated but is nearly empty.
4. **Expecting `ONBOARDING.md` to be written immediately.** The file is written by the agent at the end of the multi-turn Review round, not at command invocation time. The user must complete the Review exchange (team name, tips, starter task) for the file to be finalized.
5. **Using `WINDOW_DAYS` values outside [1, 365].** Values below 1 or above 365 (or non-integer values) are silently clamped and floored; there is no user-visible warning.
6. **Assuming the guide includes MCP servers automatically.** MCP server entries are read from `.mcp.json` in the project root; if that file is absent or malformed, the MCP section of the guide will be empty.
7. **Paraphrasing or reformatting the final closing line.** The prompt instructs the agent to emit a specific exact closing sentence referencing `ONBOARDING.md`; downstream tooling or team workflows may rely on detecting this exact string.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `__handler_team-onboarding` | Synthetic BFS entry point for the command handler (callGraph bookkeeping) |
| `nt` | Prompt-dispatch subsystem — routes the populated prompt into conversation state |
| `IDt` | Prompt-dispatch sub-helper A (called by `nt`) |
| `CDt` | Prompt-dispatch sub-helper B (called by `nt`) |
| `B4` | Conversation-entry builder (called by `nt`) |
| `$4` | Conversation-payload formatter |
| `yB` | Payload finalizer / schema applicator |
| `RTn` | Session-deduplication resolver |
| `w5r` | Session-registry writer |
| `eBe` | Event-bus wrapper (called by `w5r`) |
| `P4` | Random session-ID generator (uses `crypto.randomBytes`) |
| `ke` | JSON-stringify wrapper |
| `VHd` | Conversation-state validator |
| `P5r` | Conversation-pipeline orchestrator |
| `Tmi` | Pipeline step: pre-prompt formatter |
| `Rr` | Pipeline step: route resolver |
| `jCi` | Pipeline step: context injector |
| `U2` | Seen-message deduplicator |
| `ag` | Telemetry emitter (wraps `kt`) |
| `kt` | Core telemetry recorder |
| `W` | App-state reader / config accessor |
| `gn` | Usage-data collector (scans transcripts) |
| `U7t` | Transcript-directory resolver and config-lock manager |
| `t` | Generic filesystem or utility reference (context-dependent) |
| `Gt` | Filesystem guard / path validator |
| `s` | Filesystem module reference (context-dependent) |
| `r` | Filesystem module reference (context-dependent) |
| `i` | Stream or iterator reference (context-dependent) |
| `kzs` | Config-object merger (uses `Object.assign`) |
| `hOr` | Config-read helper |
| `T` | Transcript-line parser / message classifier |
| `wNc` | Message-type discriminator |
| `e` | Transcript-event processor (multi-purpose loop variable) |
| `Dc` | Path-display formatter (applies `[REDACTED]` masking) |
| `a7e` | String sanitizer |
| `kNc` | Config-file reader with byte-length guard |
| `dn` | Error logger / debug emitter |
| `tEt` | Config-file read-and-parse with backup rotation |
| `$t` | JSON-parse wrapper |
| `n4` | Path-prefix stripper |
| `L2o` | Project-directory walker |
| `R2o` | Canonical path resolver |
| `m` | Process-registry reference (context-dependent) |
| `nEt` | Config-environment initializer |
| `n` | Generic iterator / lowercase helper (context-dependent) |
| `w` | Path-prefix matcher (context-dependent) |
| `y` | Session-JSONL line iterator |
| `PGe` | Teammate-mailbox message reader |
| `I` | Scroll/slice offset calculator |
| `k` | Write-stream reference (context-dependent) |
| `A` | UI-state updater |
| `Rvt` | Atomic file-write helper (rename+fsync pattern) |
| `jd` | Realpath resolver |
| `u` | Stat/symbolic-link checker (context-dependent) |
| `vn` | Error-code classifier |
| `hXe` | fchmod error-code handler |
| `ius` | Property-descriptor definer |
| `dOe` | Transcript-directory existence checker |
| `v2o` | Object-entries iterator for session data |
| `O7t` | Timestamp formatter (Date.now-based) |
| `P7t` | Config-prerequisite checker |
| `Xnr` | Config-save orchestrator (global config write path) |
| `Pe` | Post-save callback dispatcher |
| `eze` | Event-zone entry point |
| `G1f` | Git-context collector (user.name + remote origin) |
| `Hr` | Child-process result parser |
| `ux` | Raw child-process output extractor |
| `q2` | Project-path resolver |
| `BO` | Projects-directory joiner |
| `WE` | Relative-path formatter |
| `Hgu` | Absolute-offset calculator |
| `v8l` | Session-JSONL file scanner (per-file extractor) |
| `zo` | Warning logger |
| `o` | Filter/map utility (context-dependent) |
| `c` | File-stat checker |
| `An` | Async-helper initializer |
| `l` | Line-split result iterator |
| `rGl` | Log-entry reader |
| `p` | Process-control reference (context-dependent) |
| `oT` | Forced-shutdown initiator |
| `B1f` | MCP-server config reader (reads `.mcp.json`) |
| `$1f` | MCP-server list post-processor |
| `Kr` | Child-process runner (spawns git commands) |
| `wUe` | Child-process execution engine |
| `gps` | Platform-specific command builder (win32 `.exe` / `cmd /q`) |
| `Obr` | stdout-stream handler |
| `Nbr` | stderr-stream handler |
| `Fbr` | Combined-output handler |
| `bds` | Numeric-argument validator (uses `Number.isFinite`) |
| `Mvt` | Child-process result aggregator |
| `Pbr` | Reflect-apply wrapper |
| `Zds` | Process-exit event binder |
| `Ads` | Timeout-race wrapper (setTimeout + Promise.race) |
| `Tds` | SIGTERM-kill wrapper |
| `Eds` | stdout-data event handler |
| `Sds` | Force-kill handler |
| `Jds` | Promise.all output collector |
| `Nvt` | Buffer-size guard |
| `Yds` | Pipe-stream connector |
| `Xds` | stdio-stream adder |
| `wds` | stdout-binding helper |
| `cHu` | String-coercion wrapper |
| `up` | Output-encoding selector |
| `lHu` | Error-code normalizer |
| `Le` | Essential-traffic HTTP client |
| `fo` | Error-to-string converter |
| `rt` | String normalizer |
| `Yi` | URL-path extractor |
| `Rmu` | Request-queue manager |
| `kUe` | Git URL parser (detects `"git/"` prefix, extracts host) |
| `FHu` | URL-component extractor |
| `yi` | Index-of-based string slicer |
| `vgt` | Feature-gate + prompt-dispatch coordinator (top-level handler body) |
| `vs` | Feature-gate evaluator (reads `allow_team_onboarding`) |
| `Hvi` | Provider-type resolver |
| `G4` | Auth-provider classifier |
| `gF` | Auth-detail extractor |
| `DDt` | Auth-type constants map |
| `Qge` | Capability-check helper |
| `nS` | Conversation-state setter |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.