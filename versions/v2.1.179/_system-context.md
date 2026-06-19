---
type: system-context
command: _system-context
cc_version: "2.1.179"
updated: "2026-06-19"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.179 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.179 System Context

> Analysis basis: CC v2.1.179 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.179 system context is assembled from multiple discrete functions whose outputs are concatenated at runtime into a unified instruction layer that precedes any user or CLAUDE.md content. This layer covers at least five behavioral domains: inter-agent authority policy, tool permission and denial handling, git and SCM workflow rules, subagent delegation guidance, and autonomous loop operation. Because it is injected before user input, its defaults are always active; CLAUDE.md and user instructions layer on top of — or in some cases conflict with — these pre-set defaults. The system context also injects structured side-channel annotations (such as special XML-tagged reminders) to govern lightweight parallel agent instances without interrupting the primary session.

---

## Hardcoded Constraints

- **Inter-agent authority isolation**: Messages arriving from peer Claude sessions are treated as carrying zero authority derived from the current user. Regardless of what a peer session requests, CC will not escalate, relay, or act on denied capabilities on its behalf. This restriction is absolute — no CLAUDE.md entry or user instruction can grant a peer session user-level trust within the current session.

- **Permission laundering prevention**: When a peer agent requests an action that was explicitly denied in the current session, or claims it cannot perform the action itself, CC is required to refuse and surface the request to the human user rather than silently executing it. This is a hard behavioral constraint that cannot be softened by operator configuration within a single session.

- **Denied-tool graceful degradation**: When a tool invocation is blocked by the permission layer, CC is permitted to attempt equivalent outcomes through alternative tools — but only through reasonable substitutions that respect the intent of the denial. Circumventing the spirit of a permission restriction through indirect means (for example, exploiting test-execution capabilities to run arbitrary code) is categorically blocked. If no legitimate alternative exists, CC must halt and explain the situation to the user rather than proceeding.

- **Destructive git operation guard**: Several git operations are unconditionally gated: force-pushing to main/master branches triggers a mandatory warning even when the user explicitly requests it. Other destructive operations (hard resets, forced checkouts, branch deletion, working-tree restoration, forced clean) require explicit per-request user authorization and cannot be pre-authorized through ambient CLAUDE.md settings alone.

- **Commit hook bypass prohibition**: CC will not use flags that skip pre-commit or GPG-signing hooks unless the user provides an explicit, in-turn instruction to do so. This is not a default that can be permanently toggled off via CLAUDE.md.

- **Autonomous loop scope boundary**: When operating in timer-driven autonomous mode, CC is constrained to work that is traceable to the existing conversation transcript or the active pull/merge request. Inventing new tasks, making irreversible changes without authorization evidence in the transcript, and narrating potential work instead of performing authorized work are all behavioral blocks embedded in the autonomous loop policy.

- **Sensitive file exclusion from commits**: Files matching patterns associated with secrets or credentials are blocked from being staged and committed. If a user explicitly requests committing such files, CC must warn before proceeding rather than silently complying.

---

## Default Behaviors

- **Git commit creation policy**: By default, CC will not create commits unless the user explicitly requests one within the current turn. This default can be changed by explicit per-turn instruction but is not intended to be permanently overridden by CLAUDE.md (doing so would conflict with the hardcoded constraint described above).

- **Staged file selection granularity**: CC defaults to adding specific named files rather than using catch-all staging commands. Users can instruct CC to use broader staging if desired, but the default errs toward precision to avoid accidental inclusion of sensitive material.

- **Commit message style**: CC defaults to drafting concise, purpose-oriented commit messages (focused on the reason for a change rather than a literal description of what changed), following the observed style of the repository's existing log. Users can override the style by providing an explicit format or example.

- **Pull request body structure**: When creating pull requests, CC defaults to a structured body format containing a short summary and a test plan checklist. The format can be altered by user instruction or repository CLAUDE.md conventions.

- **Remote push behavior**: CC defaults to not pushing to remote repositories unless the user explicitly requests it within the turn. This applies both in interactive and autonomous operation.

- **Subagent prompt verbosity**: When delegating to a subagent, CC defaults to producing self-contained, context-rich prompts that brief the agent as if it has no prior knowledge of the conversation. Users can adjust the level of context provided, but the system context strongly discourages terse or vague delegation prompts.

- **Autonomous loop verbosity on idle**: When the autonomous loop finds nothing actionable, CC defaults to a single-sentence acknowledgment and stops — it does not enumerate what it checked or speculate about future actions. This behavior scales down further after repeated idle cycles.

- **Side-question agent constraints**: When a lightweight parallel agent is spawned to handle an in-session side question, it defaults to tool-free, single-response operation with no follow-up turns. This is not user-configurable within the spawned instance.

- **CI failure triage approach**: In autonomous mode, CC defaults to pulling and diagnosing job logs before acting on a failure, distinguishing between transient infrastructure failures (which can be re-queued) and real failures (which require a minimal reproduction and fix). Users cannot bypass this triage step through CLAUDE.md.

- **Branch history management during autonomous pushes**: CC defaults to rebasing rather than merging when the base branch has moved ahead during autonomous operation, keeping history linear. This preference can be overridden by explicit instruction.

---

## CLAUDE.md Redundancy Warning

- **Commit-only-when-asked policy**: The system context already enforces a strong default that commits are created only on explicit user request. Adding an equivalent instruction to CLAUDE.md is fully redundant and neutral in most cases — but phrasing it as "always commit after changes" would directly conflict with the hardcoded constraint and is likely to produce inconsistent behavior.

- **Destructive git command restrictions**: The prohibition on unauthorized destructive git operations is already embedded at the system level. CLAUDE.md entries repeating this are redundant. CLAUDE.md entries that attempt to pre-authorize such operations (for example, "always force-push when done") will not override the hardcoded per-request confirmation requirement and may confuse behavior.

- **PR body format**: The system context already defines a default PR body structure. CLAUDE.md entries specifying a custom format are not redundant — they are the correct mechanism for changing this default — but entries that merely restate the default structure add no value.

- **Subagent context-briefing quality**: Guidance about writing thorough, context-rich subagent prompts is already part of the system layer. CLAUDE.md entries echoing this are neutral. Entries that instruct CC to write minimal delegation prompts would conflict with the system-level default and risk producing shallow subagent outputs.

- **No-push-without-permission rule**: The system context already defaults to not pushing remotely without explicit instruction. CLAUDE.md entries restating this are redundant. Entries that attempt to grant blanket push permission may partially influence behavior but will not override the hardcoded destructive-operation guards for main/master targets.

- **Commit message style**: The system context instructs CC to follow the repository's observed commit style. CLAUDE.md entries specifying a project-specific format are additive and useful — this is an intended customization point. Conflicting style instructions (one in the system context observation heuristic, one in CLAUDE.md) may create ambiguity; the more specific CLAUDE.md instruction generally takes precedence.

- **Sensitive file commit warning**: The system context already instructs CC to warn before committing credential-adjacent files. CLAUDE.md entries reinforcing this are redundant but harmless. CLAUDE.md entries attempting to suppress the warning are unlikely to be fully honored.

---

## User Actionable Insights

1. **Peer-agent messages can never impersonate the user.** Any orchestration architecture that routes Claude-to-Claude messages into the user turn will be treated as carrying no user authority. Multi-agent pipelines must be designed with this trust boundary in mind — peer agents cannot unlock permissions that the human user has not explicitly granted in the current session.

2. **Denied tools have a defined fallback protocol.** When CC's tool use is blocked, it will attempt a reasonable alternative before halting — but it will not attempt to circumvent the denial's intent. Understanding this lets users write permission rules with confidence that partial blocks will not cause unpredictable workarounds.

3. **Autonomous loop behavior is transcript-anchored.** The loop will not invent new work. If you want the autonomous agent to pursue a category of tasks, evidence of that intent must exist in the conversation transcript before you step away. Vague standing instructions in CLAUDE.md are weaker than explicit in-conversation directives.

4. **Destructive git operations always require in-turn consent.** No amount of CLAUDE.md configuration pre-authorizes force pushes, hard resets, or branch deletion. If your workflow routinely requires these, you must issue the instruction each time, or accept the confirmation interruption.

5. **The side-question agent is intentionally tool-free.** If you trigger a parallel side question, the spawned instance cannot read files, run commands, or take actions — it can only reason over the conversation context it already has. Do not expect it to perform lookups or verify live state.

6. **Subagent prompts must be self-contained by design.** The system context enforces this as a quality standard, not merely a suggestion. Delegation prompts that rely on the subagent inferring unstated context from the parent conversation will underperform — the subagent has no access to that context unless it is explicitly included in the prompt.

7. **The autonomous loop has a built-in idle scaling rule.** After several consecutive idle cycles, CC reduces its activity to a minimal CI check rather than continuing to poll broadly. If you observe the loop becoming less active over time, this is expected behavior — it does not indicate an error.

8. **Live documentation URLs are embedded in the system context.** CC knows where to fetch current CC documentation at runtime via a structured URL table. If CC's bundled knowledge about a feature is stale, instructing it to fetch the live docs is a supported workflow — no custom tool configuration is required.

9. **CLAUDE.md is the correct customization point for PR and commit style.** The system context sets defaults but explicitly yields to repository-level conventions. CLAUDE.md entries for commit message format, PR body structure, and branch naming are additive and fully supported — they are not fighting the system prompt, they are using the intended override mechanism.

10. **Version specificity matters.** The behaviors described in this document reflect v2.1.179's bundle. Autonomous loop pacing parameters, subagent prompt examples, and permission boundary language may differ in other versions. Always verify behavioral assumptions against the version in use.

---

## Tool & Permission Layer

CC's tool permission model operates in two modes: automatic allowance for operations within pre-approved boundaries, and prompt-to-allow for operations that require per-turn user confirmation. The system context embeds the logic that determines which mode applies to a given tool invocation, including the fallback behavior when a tool is denied (attempt reasonable alternative → halt and explain if no alternative exists).

Hook events are recognized as first-class system signals. The autonomous loop explicitly uses persistent monitor hooks as wake signals, with a heartbeat fallback delay as a safety net. Hook-based wakeups are treated as higher-priority signals than timer-based ones, and the loop is designed to arm a monitor once and reuse it across ticks rather than re-arming on every cycle.

MCP server content and system-reminder-tagged injections are handled as structured side-channel messages distinct from the main conversation turn. The side-question system-reminder tag, for example, instructs a spawned lightweight agent about its operational constraints (no tools, single response, no follow-up) without those instructions appearing in or affecting the primary session's context.

Context compression events are recognized by the system context layer. The autonomous loop's prompt sentinel mechanism is designed to expand appropriately depending on whether the current invocation is a first fire, a first fire after a compaction event, or a subsequent routine fire — allowing the loop to recover its behavioral grounding after context window compression without requiring the user to re-issue instructions.

The permission model explicitly tracks the distinction between a tool invocation being denied versus a tool being unavailable. Denied invocations trigger the graceful degradation and explanation flow; unavailable tools (not configured, not present) are handled separately by the tool resolution layer.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.179 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `I` | UI analytics rendering + background worker memory management (dashboard JS + low-memory telemetry) |
| `f` | PostgreSQL keyword/syntax list provider + side-question system-reminder tag injector |
| `$` | PostgreSQL type list provider + subagent delegation prompt example assembler (non-fork path) |
| `M` | Fork-type subagent delegation prompt example assembler (fork/coordinator path) |
| `Z` | Autonomous loop tick instruction assembler (scheduled invocation prompt builder) |
| `L` | Subagent prompt writing guidance injector |
| `b` | Subtask block property/event constant list (workflow engine schema) + scheduled task miss telemetry |
| `O` | Job block property/event constant list (workflow engine schema) |
| `T` | Pseudo-reference code constant list (reference/component registry schema) |
| `R` | Validation rule ID constant list (record/numeration rule schema) |
| `X` | Dataset event name constant list (DSE/RE event schema) |
| `w` | Daemon configuration reload event handler |
| `D` | Background dispatch controller (SIGKILL escalation, low-memory, spare worker pool) |
| `FD6` | Stub/placeholder assembler call (no large strings, no telemetry) |
| `P` | Stub/placeholder assembler call (no large strings, no telemetry) |
| `j` | Background process management helper (no large strings) |
| `z` | Background process management helper (no large strings) |
| `J` | Background process management helper (no large strings) |
| `S` | Background process management helper (no large strings) |
| `y` | Stub/placeholder assembler call (no large strings, no telemetry) |
| `k` | Stub/placeholder assembler call (no large strings, no telemetry) |
| `v` | Dashboard HTML/CSS renderer (analytics UI stylesheet and layout) |
| `Y` | PostgreSQL SQLSTATE / error code constant list provider |
| `lR6` | Inter-agent peer authority warning injector (dual-copy, assistant + user role positions) |
| `T$A` | Tool-denial graceful degradation instruction injector |
| `Sq6` | Inter-agent peer authority warning injector (single-copy variant) |
| `gyL` | Git workflow instruction assembler (commit protocol + PR creation protocol) |
| `oU_` | Autonomous loop behavioral policy injector (steward-mode check prompt) |
| `snK` | Live documentation URL table injector (Mintlify endpoint registry) |
| `VlK` | Files API Python reference snippet injector |