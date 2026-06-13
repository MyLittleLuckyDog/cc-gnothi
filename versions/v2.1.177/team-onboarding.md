---
type: feature-spec
feature: "team-onboarding"
cc_version: "2.1.177"
updated: "2026-06-13"
tags: ["team-onboarding", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.177 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/team-onboarding`

> Analysis basis: CC v2.1.177 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.177

---

## Overview

`/team-onboarding` is a `prompt`-type slash command that scans the invoking user's local Claude Code conversation transcripts (up to the last 365 days), derives a usage-data snapshot, and co-authors a structured `ONBOARDING.md` guide tailored for teammates who are new to Claude Code. The command operates as a two-turn collaborative flow: it immediately renders a concrete draft guide and then asks three targeted review questions before writing the final file.

---

## Registration

| Field | Value |
|---|---|
| type | `prompt` |
| name | `team-onboarding` |
| description | Help teammates ramp on Claude Code with a guide from your usage |
| isHidden | `false` |
| loc_byte | `12429898` |
| loc_byte_end | `12430972` |
| loc_line | `8581` |
| handler_method | `getPromptForCommand` |
| handler_method_start | `12430261` |
| handler_method_end | `12430971` |
| prompt_body.length | `4539` characters |
| prompt_body.trace | `identifier→$ (local→1 ext vars)` |
| arbor_handler.name | `getPromptForCommand` |
| arbor_handler.kind | `Method` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.fqn | `claude-2.1.177::getPromptForCommand` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.177 bundle.js:+12429898

---

## Input Branching

The handler has more than three distinct execution paths (feature-gating check, transcript scanning, template substitution, guide rendering, and review loop), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A([User invokes /team-onboarding]) --> B{allow_team_onboarding\nfeature flag set?}
    B -- No --> C[Abort / show not-available message]
    B -- Yes --> D[Emit tengu_team_onboarding_invoked telemetry\nRecord Date.now timestamp]
    D --> E[Collect transcript data via usageDataCollector\n± 365-day window clamp via Math.min/max/floor]
    E --> F[Substitute template variables\n{{WINDOW_DAYS}}, {{USAGE_DATA}}, {{GUIDE_TEMPLATE}}]
    F --> G[Build final prompt string\nvia replaceAll + String coercion]
    G --> H[Emit tengu_flint_harbor_prompt telemetry]
    H --> I[Return prompt to agent runtime\ntype: text]
    I --> J[Agent outputs acknowledgment line\nimmediately, before any reasoning]
    J --> K[Agent classifies sessions into\nwork-type breakdown — top 3-5 categories]
    K --> L[Agent gathers repo + MCP\nserver context]
    L --> M[Agent writes ONBOARDING.md draft\nwith ASCII bar charts]
    M --> N[Agent renders draft in code block\nthen asks 3 Review questions]
    N --> O{User replies with\nteam name / tips / starter task}
    O -- Answers provided --> P[Agent updates ONBOARDING.md\nwith user answers]
    P --> Q[Agent emits closing save line\nverbatim]
    Q --> R[Emit tengu_team_onboarding_generated telemetry]
    O -- Further edits --> P
```

Analysis basis: CC v2.1.177 bundle.js:+12430267 (handler entry), +12430464 (Math.min/max/floor), +12430510 (365 literal), +12430521 (invoked telemetry), +12430699 (usageDataCollector call), +12430708 (replaceAll), +12430840 (generated telemetry)

---

## Behavioral Spec

### 1. Feature-Gate Check

The handler first verifies the `allow_team_onboarding` feature flag (literal found at bundle.js:+10184094). If the flag is absent or falsy, the command does not proceed to collect transcripts or build a prompt.

```
function checkFeatureGate(appState):
    if not featureFlags.has("allow_team_onboarding"):
        return ABORT
    return PROCEED
```

Analysis basis: CC v2.1.177 bundle.js:+10184094

---

### 2. Transcript Scanning and Usage-Data Collection

Upon gate pass, the handler calls the usage-data collector (resolved via `EiL` → `zMK`) against the user's local `.jsonl` transcript files. The scan window is bounded:

```
function computeWindowDays(now):
    rawDays = (now - earliestTranscriptTimestamp) / MS_PER_DAY
    windowDays = Math.floor(Math.min(Math.max(rawDays, 0), 365))
    return windowDays
```

- The constant `365` is the hard upper ceiling for `WINDOW_DAYS` (bundle.js:+12430510).
- `Math.min`, `Math.max`, and `Math.floor` are all called in the handler (bundle.js:+12430464–12430482).
- `Date.now()` is captured at invocation start (bundle.js:+12430610).

The collector (`zMK`) reads the transcript directory:
- Lists `.jsonl` files via `Q76.readdir` (bundle.js:+12418757).
- Filters by `.jsonl` extension via `xF8.extname` (bundle.js:+12418827).
- Reads each file with `Q76.readFile` (bundle.js:+12419100).
- Parses lines; scans for `"name":"mcp__` occurrences to count MCP tool calls (literal bundle.js:+12419423) and `"content":[` occurrences to count content blocks (literal bundle.js:+12419773).
- Applies a minimum-session threshold of `3` sessions before the breakdown is treated as meaningful (literal bundle.js:+12419876).
- The scan window constant is `24 * 60` minutes (literals bundle.js:+12418729, +12418732).

A secondary reader (`TiL`) loads `.mcp.json` to enumerate configured MCP servers:
- Reads via `YMK.readFile` (bundle.js:+12420931), joined with `uF8.join` (bundle.js:+12420944).
- Parses the `mcpServers` key (literal bundle.js:+12421011).

Git context is gathered via `d_` (bundle.js:+12421575):
- `git config user.name` (literals bundle.js:+12421578, +12421585, +12421594) — used as `generatedBy`.
- `git remote get-url origin` (literals bundle.js:+12421650, +12421659, +12421669) — used as `currentRepo`.

Analysis basis: CC v2.1.177 bundle.js:+12430464, +12430482, +12430510, +12418757, +12418827, +12419100, +12419423, +12419773, +12419876, +12420931, +12421011, +12421578

---

### 3. Template Substitution

The handler substitutes three named placeholders into the prompt body before returning it:

```
function buildPrompt(promptTemplate, windowDays, usageDataJSON, guideTemplate):
    result = promptTemplate
        .replaceAll("{{WINDOW_DAYS}}", String(windowDays))
        .replaceAll("{{USAGE_DATA}}", usageDataJSON)
        .replaceAll("{{GUIDE_TEMPLATE}}", guideTemplate)
    return result
```

- `{{WINDOW_DAYS}}` — the computed day count (literal bundle.js:+12430721).
- `{{USAGE_DATA}}` — the serialised usage JSON (literal bundle.js:+12430796).
- `{{GUIDE_TEMPLATE}}` — the Markdown template string for `ONBOARDING.md` (literal bundle.js:+12430761).
- `_.replaceAll` is called at bundle.js:+12430708; `String` coercion at bundle.js:+12430739.

Analysis basis: CC v2.1.177 bundle.js:+12430708, +12430721, +12430739, +12430761, +12430796

---

### 4. Agent Execution — First Turn (Immediate Draft)

The assembled prompt instructs the agent to follow a strict ordering:

```
procedure agentFirstTurn(usageData, guideTemplate):

    // Step 1 — mandatory first output line (no reasoning before this)
    print("Looking at how you've used Claude over the last <WINDOW_DAYS> days ...")

    // Step 2 — session classification
    for each session in usageData.sessionDescriptors:
        taskType = classifySession(session)
            // categories: build_feature, debug_fix, improve_quality,
            //             analyze_data, plan_design, prototype, write_docs
    breakdown = topN(taskTypes, n=3..5, format="title case with %")

    // Step 3 — gather repo and MCP context
    repos   = [currentRepo] + siblingRepoDirs
    servers = mcpServers.map(s => inferAccess(s.name, s.urlOrigin))

    // Step 4 — write ONBOARDING.md draft
    draft = renderGuide(guideTemplate, breakdown, repos, servers,
                        generatedBy, asciiBarCharts)
    writeFile("ONBOARDING.md", draft)

    // Step 5 — render draft in code block, then Review section
    print(codeBlock(draft))
    print("---")
    print("**Review**")
    print("1. Team name confirmation question")
    print("2. Starter task question (ticket or doc link, optional)")
    print("3. Team tips question (not already in CLAUDE.md)")
```

Key constraints encoded in the prompt body:
- The acknowledgment line **must** precede any extended thinking or tool calls (prompt_body, bundle.js:+12429898).
- ASCII bar charts use `█` (filled) and `░` (empty), 20 characters wide.
- `generatedBy` comes from `git config user.name`; omitted if missing.
- `Team Tips` and `Get Started` sections are left as TODO placeholders in the first-turn draft.

Analysis basis: CC v2.1.177 bundle.js:+12429898 (prompt body), +12430267 (handler entry), +12430840 (generated telemetry)

---

### 5. Agent Execution — Subsequent Turns (Revision Loop)

```
procedure agentSubsequentTurns(userReply):
    update ONBOARDING.md with:
        - teamName    (from userReply.q1)
        - starterTask (from userReply.q2, optional)
        - teamTips    (from userReply.q3)
    apply any further edits requested by the guide creator
    if final update:
        print("Saved to `ONBOARDING.md`. Drop it in your team docs ...")
        // closing line is verbatim — not paraphrased
```

Analysis basis: CC v2.1.177 bundle.js:+12429898 (prompt body closing-line instruction)

---

### 6. Prompt Dispatch

After substitution the handler wraps the completed prompt string as a `text`-typed return value (literal `"text"` at bundle.js:+12430955) and returns it to the agent runtime. The `tengu_flint_harbor_prompt` event is emitted by the `$6` helper called immediately after `getPromptForCommand` (bundle.js:+12430295, +12430298).

```
function dispatchPrompt(promptString):
    emit("tengu_flint_harbor_prompt")
    return { type: "text", content: promptString }
```

Analysis basis: CC v2.1.177 bundle.js:+12430295, +12430298, +12430955

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — invoked | `tengu_team_onboarding_invoked` (bundle.js:+12430521) — fired on every successful gate-passed invocation |
| Telemetry — generated | `tengu_team_onboarding_generated` (bundle.js:+12430840) — fired after guide generation completes |
| Telemetry — prompt dispatch | `tengu_flint_harbor_prompt` (bundle.js:+12430298) — fired when the built prompt is handed to the agent runtime |
| Telemetry — share | `tengu_flint_harbor_share` (bundle.js:+10184156) — fired by the outer Pf6 wrapper, likely on guide save/share |
| File write | `ONBOARDING.md` created/updated in the working directory during the agent turn |
| Config reads | Global config read via `G5H`/`P8` path; lock contention guarded by `J38` (bundle.js:+12430570) |
| Git subprocess | `git config user.name` and `git remote get-url origin` spawned via `d_` (bundle.js:+12421575) |
| Feature flag check | `allow_team_onboarding` checked against feature-flag store `Pf6`/`$9` (bundle.js:+12430817, +10184094) |
| appState changes | No direct appState mutation observed within depth-2 traversal |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | `m9` → `XyA.register` (bundle.js:+65203) observed in the call graph; role is likely file-watcher registration within the transcript scanner |

---

## Version History

| Version | Change |
|---|---|
| v2.1.177 | Initial analysis |

---

## Common Mistakes

1. **Invoking without `allow_team_onboarding` enabled.** The command silently aborts if the feature flag is absent. Ensure the flag is present in the organisation or account configuration before expecting the command to function.

2. **Running in a directory with no `.jsonl` transcripts.** If the local transcript store is empty or inaccessible, `usageDataCollector` (`zMK`) will produce an empty `sessionDescriptors` array. The agent will leave the work-type breakdown as a TODO placeholder per the prompt instructions; the guide will still be written but will contain minimal usage context.

3. **Expecting an instant final file.** The command is a two-turn flow by design. The first turn always produces a draft plus three Review questions. The file is only finalised after the user answers them (or explicitly skips).

4. **Misreading the 365-day window as a configuration parameter.** The 365-day ceiling is a hard-coded constant (bundle.js:+12430510), not a user-settable option. The actual window shown in the guide is the lesser of 365 days and the age of the oldest available transcript.

5. **Assuming the closing save line can be paraphrased.** The prompt body instructs the agent to emit the closing sentence verbatim. Custom instructions or system-prompt overrides that alter the agent's phrasing may break this guarantee and should be tested carefully.

6. **Expecting MCP server details without a `.mcp.json` file.** If `.mcp.json` is absent in the workspace, the MCP-server section of `ONBOARDING.md` will be empty. Place `.mcp.json` in the project root before invoking the command if MCP context is desired.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `__handler_team-onboarding` | Synthetic BFS entry point for the command handler (maps to `getPromptForCommand`) |
| `$6` | Prompt-dispatch helper; emits `tengu_flint_harbor_prompt` and routes the assembled prompt |
| `W06` | Sub-helper called by prompt dispatcher (role: <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->) |
| `G06` | Sub-helper called by prompt dispatcher (role: <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->) |
| `em` | Helper called by dispatcher; leads to `Fm` (session/conversation store accessor) |
| `Fm` | Conversation store / session registry accessor |
| `Rb` | Lower-level store helper; calls `EE4`, `Lz`, `eNH` |
| `H38` | Cache-and-deduplicate helper for prompt dispatch; checks `zN_` set and `KXH` map |
| `M2_` | Prompt message builder; calls `Fm`, `iyH`, `uF`, `OrH`, `K2_.randomUUID`, `CH`, `PZ4`, `Fs.emit` |
| `iyH` | Inner helper within message builder; calls `BV` |
| `uF` | Random-ID generator; calls `R6`, `tK9.randomBytes`, `P8`, `N` |
| `CH` | JSON serialiser wrapper (`JSON.stringify`) |
| `PZ4` | Post-build step within message builder |
| `jN_` | Session lookup helper; calls `XF1`, `n_`, `pK9`, `L_H` |
| `XF1` | OrH-calling sub-helper in session lookup |
| `n_` | Helper leading to `GF` (likely global-function registry) |
| `L_H` | Buffer-presence check (`buf.has`) |
| `R6` | File-read/stat orchestrator; calls `Q6`, `MT`, `NN_`, `G5H`, `Date.now`, `ng4` |
| `Q6` | Path-resolution utility used widely |
| `NN_` | Utility called alongside `R6`/`G5H` |
| `G5H` | Config-file reader; throws `"Config accessed before allowed."` guard; calls `q.readFileSync`, `c6`, `Jm`, `sK9`, `N`, `Z8`, `sK9`, `q.statSync`, `q.mkdirSync`, `q.copyFileSync` |
| `c6` | JSON parse wrapper (`JSON.parse`) |
| `Jm` | String prefix-stripper (`H.startsWith` / `H.slice`) |
| `sK9` | Sibling-directory scanner; reads directory tree relative to current repo |
| `Z8` | Error/warning emitter used throughout the config layer |
| `N` | Log/format helper; handles `debug`-level messages, uppercase transforms, trim |
| `d` | General-purpose utility called in multiple contexts |
| `yN_` | Path-join helper (`xD.join` + `$_`) |
| `D` | Daemon / background-session manager; spawns processes, manages memory |
| `ng4` | File-watcher setup/teardown (`w38.watchFile` / `w38.unwatchFile`) |
| `Kg` | Helper called within file watcher |
| `m9` | Hook/listener registration via `XyA.register` |
| `P8` | Config save/load orchestrator; calls `J38`, `MT`, `zXH`, `aK9`, `h06`, `N`, `G5H`, `EaH`, `j38` |
| `J38` | Atomic config writer with lock; calls `f.mkdirSync`, `nI1`, `N`, `d`, `G5H`, `EaH`, `Z8`, `EY6`, `f.unlinkSync` |
| `f` | File-handle / write-queue manager |
| `L` | Resource lifecycle controller (`A.close`, `q.close`) |
| `nI1` | Timestamp + assign helper for config writes (`aJ_`, `Object.assign`) |
| `aJ_` | Calls `lI1`; part of config timestamping |
| `EaH` | Post-write validation helper |
| `A` | General-purpose map/registry (various `.get`, `.set`, `.values` uses) |
| `EY6` | Atomic file-write helper using temp file + rename (`c3.writeFileSync`, `q.renameSync`, `q.unlinkSync`) |
| `C8` | Error-type classifier (calls `Z8`) |
| `H` | Random-delay helper (`Math.random`, `setTimeout`) |
| `zXH` | Called by config save; role: <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `aK9` | Iterates config entries (`Object.entries`) |
| `h06` | Timestamp helper for config writes (`Date.now`) |
| `j38` | Config save path variant; calls `h06`, `MT`, `Q6`, `xD.dirname`, `xX`, `CH`, `EY6`, `N` |
| `EiL` | Usage-data collection orchestrator; calls `T_`, `Xb`, `zMK`, `TiL`, `GiL`, `d_`, `CH`, `jhH`, `uF8.basename` |
| `T_` | Calls `eG`; likely environment/context initialiser |
| `eG` | Entry-point for environment detection |
| `Xb` | Project-path builder; calls `Jl.join`, `Cy`, `Qw` |
| `Cy` | Base-path constructor (`Jl.join`, `$_`) using `"projects"` segment |
| `Qw` | Path slug encoder; calls `H.replace`, `_.slice`, `YBf` |
| `YBf` | Hash helper for path slugging (`Math.abs`, `oYH`) |
| `zMK` | Transcript directory scanner and usage-data extractor; reads `.jsonl` files, counts MCP calls, extracts session descriptors |
| `M9` | Calls `Z8`; error handler within transcript scanner |
| `K` | Map/pad utility (`f.map`, `L.padEnd`) |
| `$` | Outer variable holding prompt template or config snapshot; feeds `FPK` |
| `FPK` | Calls `bs`, `Date.now`, `n9`, `dU6`, `CH`; likely prompt-cache or rate-limit tracker |
| `z` | Feature-flag / capability checker; routes to `IH`, `bH`, `gS`, `hB` |
| `IH` | Feature-ok path handler; calls `d`, `tH` |
| `bH` | Feature-bad path handler; calls `d`, `tH` |
| `gS` | Feature-gate side-effect handler; calls `Fm`, `iyH`, `L2_` |
| `hB` | Abort/exit helper; calls `Promise.race`, `Promise.all`, `NLH`, `hLH`, `l8`, `process.exit` |
| `Y` | Process-exit wrapper; calls `EX`, `process.exit`, `z.abort` |
| `EX` | Pre-exit cleanup |
| `TiL` | MCP config reader; reads `.mcp.json`, parses `mcpServers` key |
| `GiL` | Post-collection helper called by `EiL` |
| `d_` | Git context runner; spawns `git config user.name` and `git remote get-url origin` via `zhH` |
| `zhH` | Subprocess executor (execa-style); calls `UiA`, `G4_`, `T4_`, `Z4_`, `nnA`, `VY6`, `W4_`, `ZiA`, `lnA`, `inA`, `dnA`, `cnA`, `VnA`, `TiA`, `yY6`, `WiA`, `GiA`, `snA` |
| `UiA` | Argument normaliser for subprocess (`_gf`, `mnA`, `_.unshift`) |
| `G4_` | Subprocess option builder (calls `IiA`) |
| `T4_` | Subprocess option variant (calls `IiA`, `aFf`) |
| `Z4_` | Option setter (calls `eFf`) |
| `nnA` | Input validation for subprocess args (`Number.isFinite`, `TypeError`) |
| `VY6` | Subprocess result handler (`JFf`, `Error`, `Boolean`) |
| `W4_` | Reflect-based property setter (`Reflect.apply`, `Reflect.defineProperty`) |
| `ZiA` | Event-subscription helper (`H.on`, `A`) |
| `lnA` | Timeout-race wrapper (`setTimeout`, `Promise.race`, `clearTimeout`) |
| `inA` | Kill-on-close helper (`ws`, `H.kill`, `q.finally`) |
| `dnA` | Data-event binder (`H`, `TFf`) |
| `cnA` | Kill handler bound to subprocess (`H.kill`) |
| `TiA` | Stream-reader (`P4_`, `Promise.all`, `X4_`) |
| `yY6` | Output-buffer handler (`tf_`) |
| `WiA` | Pipe connector (`lFf`, `ft6`, `A.pipe`) |
| `GiA` | Stream-adapter creator (`JiA.default`, `A.add`) |
| `snA` | Bound cleanup helper (`$4_.bind`) |
| `Kgf` | String coercion utility (`String`) used in git output processing |
| `L5` | Utility called during git-output post-processing |
| `kH` | Error logger; calls `jA`, `A6`, `qq`, `hUf`, `ycH.push`, `$s.logError` |
| `jA` | Error formatter (`Error`, `String`) |
| `A6` | String utility (`String`) |
| `qq` | Error-classification helper (calls `ScA`) |
| `hUf` | Rolling error buffer (`ys6.shift`, `ys6.push`) |
| `jhH` | Git-URL normaliser; strips `git/` prefix, lowercases (`H.trim`, `_.match`, `bgf`, `f.startsWith`, `L.split`, `L.toLowerCase`) |
| `bgf` | URL component extractor (calls `G9`) |
| `G9` | Substring extractor (`H.indexOf`, `H.slice`) |
| `Pf6` | Feature-gate + prompt dispatch wrapper; checks `allow_team_onboarding`, calls `qq`, `$9`, `ZT`, `$6` |
| `$9` | Feature-flag resolution; checks `kZ4`, `SZ4`, calls `xb`, `qq`, `GLH`, `AJH`, `Eg1` |
| `Eg1` | Feature-flag evaluation entry (calls `AJH`) |
| `AJH` | Flag-value resolver (`xb`, `HP6`, `yLH`) |
| `xb` | Auth/plan resolver; calls `l_`, `L7`, `kO`, `Fj`, `H9` |
| `l_` | Auth lookup helper (calls `A6`) |
| `L7` | Plan-level lookup (calls `p18`) |
| `kO` | API-key / auth-type selector; checks `ANTHROPIC_API_KEY`, `apiKeyHelper`, `none` |
| `Fj` | OAuth/profile resolver; handles `profile-implicit`, `user_oauth` paths |
| `GLH` | Flag-gate helper (calls `A6`) |
| `ZT` | Calls `H9`; downstream of feature-flag check |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.