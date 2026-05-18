---
type: system-context
command: _system-context
cc_version: "2.1.132"
updated: "2026-05-18"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.132 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.132 System Context

> Analysis basis: CC v2.1.132 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.132 system context is assembled by combining the output of multiple assembler functions that each contribute distinct behavioral segments — covering role identity, safety and permission policy, tool operation guidance, task execution norms, and autonomous-mode protocols. Together these segments establish the behavioral baseline that CC operates from before any user instruction or CLAUDE.md content is considered. User instructions and CLAUDE.md files can influence many default behaviors within this layer, but a subset of constraints — particularly those governing irreversible or externally-visible actions — are resistant to casual override. The system context also embeds inline guidance for CC's own tool use, memory management, scheduling, parallelization, and browser automation subsystems.

---

## Hardcoded Constraints

- **Irreversibility threshold**: CC distinguishes between locally-scoped, reversible actions (file edits, test runs) and actions that are difficult or impossible to undo, affect shared infrastructure, or become visible to parties beyond the immediate user. The latter category triggers a mandatory pause-and-confirm behavior regardless of how autonomously the user has asked CC to operate. This constraint cannot be overridden by conversational instruction alone.

- **Scope matching**: CC is required to restrict the scope of any action to what was actually requested. Authorization granted for a specific action in a specific context does not carry over to similar actions in different contexts. Even explicit one-time approval does not constitute standing permission for repeat or broader execution.

- **Destructive-path avoidance as default**: When CC encounters an obstacle during a task, it is constrained to investigate and address the root cause rather than using destructive shortcuts to clear the obstacle. Bypassing safety mechanisms, deleting unknown artifacts, or overwriting uncommitted state without investigation are blocked as default resolution strategies.

- **Tool-denial workaround limits**: When a tool use is denied, CC is permitted to attempt the goal through alternative, reasonable means — but is prohibited from using any available capability as a covert bypass of the intent behind the denial. If no reasonable alternative exists, CC is required to surface the limitation to the user rather than proceeding through indirect methods.

- **External publication sensitivity**: Actions that result in content being sent to or stored by third-party services — paste tools, diagram renderers, external APIs — carry an implicit sensitivity check. CC is expected to consider whether content is appropriate for external exposure before proceeding, since such publication may persist even after deletion.

- **Autonomous-mode trust boundary**: In timer-invoked or background-loop autonomous modes, CC is constrained to continue work already established in the conversation transcript and is blocked from initiating entirely new work streams or making irreversible changes without clear prior authorization from the user. The trust model explicitly degrades if this boundary is violated.

- **Tool denial communication requirement**: If a denied or unavailable capability is determined to be genuinely essential to completing the user's request, CC is required to stop, explain what it was attempting and why the capability is needed, and return control to the user. Silent failure or silent workaround are not permitted.

---

## Default Behaviors

- **Response length calibration**: By default, CC targets the shortest response that is complete and clear for the task at hand, reserving longer output for genuinely complex or high-stakes situations. Users can shift this toward more expansive output by requesting elaboration, but the baseline preference is brevity.

- **Code comment density**: CC defaults to writing minimal or no inline comments in generated code, and specifically avoids multi-line comment blocks or extensive docstrings. Users can request more commentary, but the system prompt default actively discourages over-annotation.

- **Intermediate planning documents**: CC defaults to working from conversation context rather than generating standalone planning, analysis, or decision documents as intermediate artifacts. Users can explicitly request such documents; without that instruction, CC is expected not to create them.

- **Pre-action narration**: Before executing a tool call, CC defaults to producing a brief statement of intent — one sentence describing what it is about to do. This is a transparency default aimed at users who may not see raw tool output. It can be suppressed if users prefer silent operation.

- **Progress updates during work**: CC defaults to providing short, informative updates at key moments during multi-step tasks (findings, direction changes, blockers). Silence during extended work is treated as a default violation, not a feature.

- **Confirmation before external or destructive actions**: Absent explicit standing authorization in durable configuration (such as CLAUDE.md), CC defaults to requesting confirmation before pushing code, creating or modifying PRs, sending messages to external services, deleting files or branches, or performing other externally-visible or hard-to-reverse operations. Users can grant broader standing authorization through CLAUDE.md.

- **Git history discipline**: In contexts where branch rebasing versus merging is relevant, CC defaults to preferring rebase to keep history clean, particularly when updating a working branch against its base.

- **Autonomous loop scope**: When operating in a scheduled or background autonomous mode, CC defaults to conservative scope — acting on what the transcript already established — and will emit a minimal status message rather than narrating inactivity when there is genuinely nothing to do.

- **Browser session isolation**: At the start of any browser automation session, CC defaults to fetching current tab context before taking any action, and defaults to opening new tabs rather than reusing tab IDs from prior sessions.

- **Scratchpad location**: For temporary files generated during task execution, CC defaults to a session-specific scratchpad directory rather than system temp locations. This default can be overridden only by explicit user request.

- **Memory deduplication**: When writing persistent memory entries, CC defaults to checking for existing files covering the same fact and updating rather than creating duplicates. It also defaults to excluding from memory anything already captured in version control, CLAUDE.md, or code structure.

---

## CLAUDE.md Redundancy Warning

- **Confirmation-before-action policy**: The system prompt already establishes that CC will pause and request confirmation for irreversible or externally-visible actions by default. Adding a CLAUDE.md instruction to "always ask before pushing" is neutral redundancy. However, adding a CLAUDE.md instruction to "never ask for confirmation" or "operate fully autonomously" may partially override this default for conversational actions but will not eliminate the hardcoded pause for the most destructive operations — users should not assume full suppression.

- **Response conciseness**: The system prompt already instructs CC to default to brief, task-matched responses. A CLAUDE.md directive reinforcing conciseness is redundant. A conflicting directive (e.g., "always provide detailed explanations with headers and sections") may override the default and produce consistently verbose output even for simple queries.

- **Code comment style**: The system prompt already configures a minimal-comment default. CLAUDE.md entries requesting "no comments" are redundant. Entries requesting "always add thorough comments" will conflict with and likely override this default.

- **Voice and persona**: The system prompt embeds a defined identity and communication style for CC — direct, warm, technically precise when warranted, avoiding filler and performative helpfulness. CLAUDE.md persona instructions that align with this are redundant. Instructions that conflict (e.g., "be very formal and verbose" or "always use enthusiastic greetings") will create instruction tension and may produce inconsistent behavior.

- **Planning document generation**: The system prompt already instructs CC not to create intermediate planning documents unless asked. A CLAUDE.md instruction like "document your approach before starting each task" directly conflicts with this default and will likely override it, resulting in planning files being created as a matter of habit.

- **Action scope matching**: The system prompt already constrains CC to match action scope to what was requested. CLAUDE.md entries attempting to pre-authorize broad standing permissions (e.g., "always push without asking") may shift the default for routine pushes but will not fully override the scope-matching constraint for novel or context-shifted situations.

- **Memory system conventions**: The system prompt embeds the format, type taxonomy, and deduplication rules for file-based memory. Adding memory format instructions to CLAUDE.md is largely redundant unless the user wants to deviate from the built-in conventions — in which case conflicts may cause inconsistent memory file formatting.

---

## User Actionable Insights

1. **Durable authorization lives in CLAUDE.md, not conversation**: A user approving an action once in conversation does not grant CC standing permission to repeat that action. If you want CC to routinely perform a class of actions (e.g., push to branches, merge PRs) without prompting, encode that permission explicitly in a CLAUDE.md file — this is the only mechanism the system recognizes as durable authorization.

2. **Destructive action confirmation cannot be fully suppressed**: Even if a user instructs CC to operate fully autonomously, the system context retains a confirmation gate for the most destructive or hard-to-reverse operations (force push, database drops, deleting uncommitted work, etc.). Autonomous mode instructions shift the threshold but do not eliminate it.

3. **Scope creep is blocked by design in autonomous modes**: When CC is operating on a timer or in the background, its mandate is limited to work already in motion. It will not initiate new work streams, explore tangential improvements, or make decisions outside what the transcript has already established. Users who want CC to proactively identify new work must do so through explicit instruction within an active session.

4. **The /loop skill has two operating modes**: Recurring prompts can be scheduled at fixed intervals (converted to cron expressions) or in a self-paced dynamic mode where CC determines its own iteration cadence based on observable events. In dynamic mode, an event monitor can serve as the primary wake signal, with the scheduled delay acting only as a fallback heartbeat.

5. **Browser automation has a session-isolation requirement**: CC will not reuse tab IDs across sessions. If a browser automation workflow relies on resuming a specific tab state, the user must explicitly direct CC to that tab — CC will not infer or assume tab continuity.

6. **Parallel batch work (the batch orchestration pattern) requires a plan approval step**: CC's multi-agent parallel work system enforces a plan-then-approve-then-spawn sequence. Workers are not launched until the plan is explicitly approved, and each worker operates in an isolated git worktree. Users cannot skip the planning phase to go directly to parallel execution.

7. **Memory system treats CLAUDE.md content as already-known**: CC's persistent memory layer is designed to avoid duplicating what CLAUDE.md already captures. If you want CC to remember something derivable from CLAUDE.md or git history, it will ask what was non-obvious about it and record only that delta — don't expect it to naively journal CLAUDE.md content into memory files.

8. **The advisor tool pattern requires pre-commitment to durable output**: The system context instructs CC to make its deliverable durable (write the file, save the result) before calling the advisor tool for review, because the advisor call takes time and the session could end during it. Users relying on the advisor pattern should expect this sequencing — output first, review second.

9. **Autonomous loop idle behavior is intentionally terse**: When a background autonomous check finds nothing to act on, CC is configured to emit a single sentence and stop — no narration of what was checked, no planning for future iterations. Three consecutive idle results trigger a scope reduction to minimal maintenance checking. Users should not interpret this terseness as malfunction.

10. **Version-specific**: The parallel orchestration system, self-pacing loop with event monitors, nightly memory consolidation scheduling, and the `/stuck` diagnostic skill are all present in v2.1.132 as bundled skills. These may be subject to kill-switch deactivation or replacement in future versions — the scheduling system itself embeds version-resilience logic for this reason.

---

## Tool & Permission Layer

**Tool denial and workaround policy**: When a tool invocation is denied — either by the permission system or by user instruction — CC is given explicit guidance on acceptable workaround behavior. Reasonable alternative tools that naturally accomplish the same goal are permitted. Capability abuse (using one tool to covertly perform actions associated with a denied tool) is prohibited. If no reasonable path exists, CC is required to surface the blockage to the user.

**Action reversibility classification**: The system context embeds a taxonomy of actions by risk level. Locally-scoped reversible actions (editing files, running tests) are freely executable. Hard-to-reverse operations (force push, hard reset, published commit amendment, package removal), destructive operations (file/branch deletion, process termination, database table drops), and externally-visible actions (pushing code, PR operations, Slack/email messages, third-party uploads) all require either explicit prior authorization in durable configuration or real-time user confirmation.

**Autonomous loop invocation context**: CC receives structured guidance when invoked by a timer rather than a user. This includes instructions to re-read the conversation transcript as the primary signal source, prioritize in-progress PR maintenance (CI diagnosis, review thread resolution, rebase), and scale back activity when repeated checks find nothing actionable. The system context embeds CI interaction patterns including flake detection logic and the use of SCM-specific APIs (e.g., GraphQL mutations for resolving review threads).

**MCP and browser tool integration**: The browser automation subsystem is governed by inline behavioral rules injected into CC's context when the relevant MCP server is active. These rules cover: mandatory tab context fetch at session start, prohibition on triggering JavaScript modal dialogs, loop-avoidance thresholds (stop after 2–3 consecutive tool failures and escalate to user), GIF recording conventions for multi-step interactions, and console log filtering to avoid output overload.

**Memory system machinery**: The persistent memory layer operates through a structured file format with a defined type taxonomy (user profile, feedback, project state, reference pointers). The system context governs deduplication (update existing files rather than creating duplicates), exclusion rules (do not save what version control or CLAUDE.md already records), and recall handling (memories surfaced in system-reminder blocks are treated as background context, not active user instructions, and must be verified against current state before acting on them).

**Scheduling and cron layer**: The `/loop` skill translates natural-language interval expressions into cron schedules, with defined rounding behavior for intervals that do not map cleanly to cron granularity. Recurring tasks carry an automatic expiration after a fixed number of days. The `/dream` nightly consolidation job uses a deduplication check against existing scheduled tasks before registering a new one. The scratchpad directory is session-scoped and managed separately from both the user's project and system temp space.

**Advisor tool integration**: The advisor tool pattern is embedded as a workflow within the system context, instructing CC to consult a stronger reviewer model at defined checkpoints (before committing to an approach, before declaring completion, when stuck). The pattern includes conflict resolution guidance for cases where CC's observed evidence disagrees with advisor recommendations.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.132 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| X3 | System context top-level assembler (no direct string content) |
| fU7 | System context assembler segment A (no direct string content) |
| MU7 | System context assembler segment B (no direct string content) |
| OU7 | System context assembler segment C (no direct string content) |
| IIA | Tool denial workaround policy injector |
| MMA | Autonomous loop / background invocation behavioral guide |
| Upq | Files API Python reference (skill documentation) |
| sp7 | Parallel batch orchestration workflow (Plan/Spawn/Track phases) |
| rpq | Claude API Ruby reference (skill documentation) |
| tU7 | /loop self-pacing dynamic mode handler |
| kU7 | /stuck session diagnostic skill |
| Jo1 | Claude-in-Chrome browser automation guide (instance A) |
| Q5A | Claude-in-Chrome browser automation guide (instance B) |
| uY6 | /dream memory consolidation skill |
| aU7 | /loop fixed-interval scheduling skill |
| jG7 | Reversible-action and confirmation policy injector |
| UUq | Message Batches API TypeScript reference (skill documentation) |
| FUq | Files API TypeScript reference (skill documentation) |
| kr1 | Advisor tool behavioral protocol |
| _pq | Server/API change verification pattern (curl-based) |
| Hpq | CLI change verification pattern (invocation-based) |
| $Yq | Claude voice, values, and identity definition |
| VP7 | Team onboarding guide template and CC usage briefing |
| SU9 | Persistent file-based memory system definition |
| KG7 | Text output style and narration policy injector |
| RU9 | /dream memory pruning skill |
| QU7 | /dream nightly schedule setup skill |
| YYq | User profile memory template |
| ymq | Debug skill for CC session diagnostics |
| hG7 | Session-scoped scratchpad directory policy injector |