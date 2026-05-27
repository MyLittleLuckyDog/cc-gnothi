---
type: system-context
command: _system-context
cc_version: "2.1.152"
updated: "2026-05-27"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.152 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.152 System Context

> Analysis basis: CC v2.1.152 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.152 system context is assembled from multiple cooperating functions embedded in the bundle, rather than a single monolithic prompt string. These functions collectively cover: the agent's self-identity and role declaration, tool permission and confirmation policy, subagent orchestration behavior, autonomous loop operation, denial-handling guidance, and integration with external reminder injection mechanisms. The assembled context sits above user instructions and CLAUDE.md in the authority hierarchy for hardcoded constraints, while leaving a defined surface area that user configuration can legitimately influence. The relationship between this layer and CLAUDE.md is additive by default — CLAUDE.md extends or adjusts, but cannot override absolute constraints baked into the system context functions.

---

## Hardcoded Constraints

- **Tool-denial response policy**: When a requested tool action is blocked by the permission layer, CC is directed to cease the blocked approach, transparently explain to the user what action was attempted and why it cannot be completed, and defer the decision about how to proceed entirely to the user. Circumventing the intent behind a denial through indirect means is explicitly prohibited — only reasonable, good-faith alternative approaches that do not undermine the purpose of the restriction are permitted. This constraint is absolute and cannot be overridden by CLAUDE.md.

- **Subagent prompt integrity**: When CC delegates work to a subagent or background worker, it is required to compose self-contained, fully-briefed prompts. The agent is prohibited from offloading synthesis, analysis, or judgment to the subagent by using vague delegation language. Prompts must demonstrate that CC itself understood the problem — referencing specific file paths, specific changes, and specific context — before delegating execution. This governs all subagent dispatch regardless of user instruction.

- **Autonomous operation scope boundary**: In autonomous or daemon loop modes, CC is constrained to act only on work that the existing conversation transcript clearly authorizes. Inventing new work, expanding scope beyond what was established, or making irreversible changes without clear prior authorization are treated as trust-eroding behaviors to be avoided. When ambiguity exists about whether an action falls within established scope, CC is directed to err on the side of restraint. This boundary is enforced at the behavioral level and is not adjustable by the user mid-loop.

- **Side-question agent isolation**: When a lightweight side-question agent is spawned to answer a query without interrupting the main agent, that agent is hardcoded to operate with no tools available, produce exactly one response with no follow-up turns, and never misrepresent its own status (e.g., must not imply it was interrupted or was previously doing something else). These constraints are injected via a system-reminder tag and are not user-configurable.

- **Background agent wake/stop discipline**: The loop scheduling system enforces that monitoring tasks are armed at most once per event type, that the loop termination procedure includes canceling any armed monitors, and that the scheduling call always occurs as the final action of a turn. These sequencing constraints are structural and cannot be reordered by user instruction.

---

## Default Behaviors

- **Subagent orchestration style**: By default, CC takes on the role of a coordinating agent that delegates execution to subagents while retaining synthesis and judgment. Users can influence the granularity of decomposition (how many parallel work units are created) and the type of subagent assigned, but the fundamental coordinator-worker pattern is the default posture. CLAUDE.md can specify preferred decomposition strategies or subagent types for a project.

- **Autonomous loop pacing**: In dynamic self-pacing mode, CC defaults to selecting fallback heartbeat intervals in a roughly 20–30 minute range when a monitor is active, and shorter intervals when there is active work in flight. Users can influence pacing by specifying explicit intervals in loop invocations, or by arming event-based monitors that replace time-based wakeups as the primary signal. CLAUDE.md can document preferred loop cadences for a project's CI cycle.

- **PR and branch maintenance scope**: When operating autonomously on a branch, CC defaults to prioritizing in-progress work from the active conversation transcript above generic branch hygiene, and branch hygiene (CI, review threads, rebase) above idle sweeping. Users cannot override the priority ordering, but can constrain which maintenance categories CC performs via CLAUDE.md or explicit session instructions.

- **Worker prompt verbosity**: When composing prompts for parallel background workers, CC defaults to including the full goal, the specific unit's task, codebase conventions discovered during research, and a concrete end-to-end verification recipe. Users can influence the verification recipe (e.g., specify the preferred testing approach) but the requirement to include all components is a default that CLAUDE.md can only add to, not subtract from.

- **Loop termination reporting**: When no actionable work is found during an autonomous check, CC defaults to a single brief status statement with no elaboration. After several consecutive idle results, CC defaults to scaling back to minimal-effort checks before stopping. CLAUDE.md cannot suppress the termination signal, but can influence what constitutes "actionable work" for a given project.

- **Confirmation behavior for tool actions**: The permission layer defaults to prompting for confirmation on sensitive or irreversible tool actions unless the session is configured for auto-allow mode. Users can shift individual tool categories to auto-allow within the bounds of the permission model. CLAUDE.md can document project-level permission preferences, but the auto-allow scope is ultimately gated by the permission layer configuration, not CLAUDE.md alone.

---

## CLAUDE.md Redundancy Warning

- **Subagent briefing quality**: The system context already instructs CC to produce fully-contextualized, judgment-enabling subagent prompts with specific file references and clear change descriptions. Adding generic instructions to CLAUDE.md like "write detailed prompts for subagents" or "include context in agent calls" is redundant. Conflicting instructions that encourage brevity in subagent prompts may degrade output quality by creating tension with the hardcoded standard.

- **Autonomous scope conservatism**: The system context already establishes a strong default toward restraint when scope is ambiguous in autonomous modes. CLAUDE.md entries that say "be conservative" or "don't do things I didn't ask for" are redundant. However, CLAUDE.md entries that *define* what counts as established work for a specific project (e.g., "maintaining the staging branch is always in scope") are additive and useful.

- **Loop pacing preferences**: The system context already provides a full self-pacing framework with sensible defaults. Adding vague pacing instructions to CLAUDE.md ("check frequently" or "don't run too often") is likely to conflict with the structured pacing logic. Instead, CLAUDE.md should document concrete event signals or explicit interval preferences that compose cleanly with the loop's own pacing algorithm.

- **PR maintenance behavior**: The system context already defines a prioritized PR maintenance checklist (CI → review threads → rebase → sweep). CLAUDE.md entries that re-specify this same checklist are redundant. Project-specific additions (e.g., "always resolve review threads via the project's GraphQL endpoint, not CLI") are non-redundant and valuable.

- **Worker verification recipes**: The system context already requires CC to discover and document an end-to-end verification recipe during the research phase of parallel orchestration. CLAUDE.md entries that say "always test your changes" are redundant. CLAUDE.md entries that specify the project's concrete verification path (e.g., "use `bun run dev` on port 3000 and curl `/api/health`") directly feed into the recipe-discovery step and are actively useful.

- **Denial transparency**: The system context already mandates that CC explain blocked actions to the user and stop rather than work around them. Adding "tell me if you can't do something" to CLAUDE.md is fully redundant and neutral in effect.

---

## User Actionable Insights

1. **The denial-handling policy is absolute.** No CLAUDE.md instruction, system prompt addition, or user message can instruct CC to silently work around a tool permission denial or find a backdoor to accomplish a blocked action. If CC encounters a denial, it will surface it. Design your permission configuration accordingly — don't rely on workarounds.

2. **Subagent prompt quality is system-enforced, not just best practice.** The system context actively instructs CC to reject vague delegation. If your workflow depends on CC dispatching subagents, investing in clear CLAUDE.md documentation of project context (file structure, conventions, testing approach) directly improves subagent prompt quality because CC will incorporate that context into its briefings.

3. **Autonomous loop behavior has a built-in trust model.** The loop is designed to avoid scope creep by design. If you want CC to treat certain maintenance tasks as always-authorized (e.g., keeping a specific branch up to date), make that explicit in the conversation that initiates the loop or in CLAUDE.md — ambiguous scope defaults to restraint, not action.

4. **Event-based monitors are the preferred wakeup mechanism.** The system context treats time-based polling as a fallback, not a primary loop mechanism. For CI-gated workflows, structuring your loop to arm an event monitor for CI completion will result in faster response and lower resource consumption than relying on the heartbeat interval alone.

5. **The side-question agent is genuinely isolated.** When CC spawns a lightweight side-question responder, that instance has no tools and no follow-up capability. If you ask a side question that requires file access or command execution, the side agent will correctly report it cannot help rather than fabricating an answer. This is a feature, not a limitation — it prevents context pollution in the main agent's working state.

6. **Parallel orchestration requires upfront research investment.** The batch orchestration system is designed with a mandatory research phase before workers are dispatched. Attempts to skip straight to spawning workers (e.g., by providing a pre-decomposed task list without letting CC verify it) may conflict with the orchestrator's planning gate. Allow the research phase to complete for best results.

7. **CLAUDE.md is most valuable for project-specific specifics, not behavioral re-specification.** Since the system context already covers orchestration patterns, loop behavior, denial handling, and agent briefing standards, CLAUDE.md has the highest leverage when it documents project-specific facts: testing commands, relevant file paths, SCM platform details, coding conventions. Generic behavioral re-statements are largely redundant.

8. **Version-specific note (v2.1.152):** This version includes a structured dynamic-mode loop sentinel mechanism where the scheduling prompt is a fixed token that expands at fire time rather than the full instruction set. This means loop prompts stored in conversation history are intentionally compact; the full instruction expansion happens at runtime. Do not attempt to manually replicate or override this expansion by passing verbose loop prompts — the system handles it automatically.

---

## Tool & Permission Layer

The permission model embedded in the system context distinguishes between two operational modes: a standard confirmation mode where sensitive or potentially irreversible tool actions trigger a user-facing prompt before execution, and an auto-allow mode where pre-authorized tool categories proceed without per-action confirmation. The system context explains both modes to CC itself, establishing the behavioral expectations for each.

The denial-handling pathway is a first-class part of the permission layer: when an action is blocked, CC is directed through a specific response protocol (stop, explain, defer) rather than being left to improvise. This pathway is invoked regardless of which permission mode is active — the distinction between modes governs whether a confirmation is shown, not whether CC can attempt to bypass a hard block.

Hook events are handled as structured inputs to the loop machinery. The system context describes how task-notification messages arriving as user-role messages wake the loop immediately when a monitor fires, and how these notifications should be handled (process the event, then reschedule the loop's safety-net timer without disrupting the active monitor). This is the mechanism by which CI events, PR comments, and similar external signals integrate with CC's autonomous operation.

The system-reminder tag is used to inject context-specific behavioral constraints into spawned agent instances — most notably for side-question agents, which receive their isolation constraints (no tools, single response, no action promises) via this injection mechanism rather than through the main system prompt. This allows the constraints to be scoped precisely to the spawned instance.

Context compression events are anticipated in the loop design: the dynamic-mode sentinel mechanism is explicitly designed so that first-fire-post-compact invocations receive the full instruction expansion, ensuring that loop behavior is resilient to context window compaction without requiring the user to re-specify loop parameters.

MCP server integration and skill tool invocations are referenced in the loop and orchestration machinery as first-class dispatch mechanisms alongside direct tool calls, indicating that the permission layer's confirmation and denial logic applies uniformly across both MCP-sourced and built-in tools.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.152 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| h | UI dashboard script assembler (collapsible/copy/histogram interactions) |
| L | SQL keyword corpus assembler + side-question agent system-reminder injector |
| $ | Coordinator-mode subagent orchestration examples + PostgreSQL type corpus assembler |
| O | Simplified subagent dispatch example assembler |
| Z | Autonomous loop tick instruction assembler (dynamic-mode sentinel, monitor arming, stop protocol) |
| f | Subagent prompt-writing guidance assembler |
| b | Subtask block property constant corpus assembler |
| T | Pseudo-reference code constant corpus assembler |
| R | Reference rule ID constant corpus assembler |
| X | Dataset event name constant corpus assembler |
| Y | Daemon config reload telemetry handler |
| w | Background dispatch telemetry handler (SIGKILL escalation, low-memory, spare pool) |
| k76 | Minimal assembler call (no large strings, no telemetry) |
| M | Minimal assembler call (no large strings, no telemetry) |
| P | Minimal assembler call (no large strings, no telemetry) |
| j | Minimal assembler call (no large strings, no telemetry) |
| z | Minimal assembler call (no large strings, no telemetry) |
| J | Minimal assembler call (no large strings, no telemetry) |
| C | Minimal assembler call (no large strings, no telemetry) |
| y | Minimal assembler call (no large strings, no telemetry) |
| I | Minimal assembler call (no large strings, no telemetry) |
| V | Analytics dashboard CSS/HTML assembler |
| D | PostgreSQL SQLSTATE error code corpus assembler + spare pool spawn telemetry handler |
| rc_ | Tool-denial response policy injector |
| kV_ | Autonomous loop operational guidance assembler (scope, PR maintenance, pacing) |
| vJK | Files API Python documentation assembler |
| sy5 | Parallel batch orchestration instruction assembler |
| QJK | Claude Platform on AWS documentation assembler |
| th5 | Loop slash-command parser and dynamic/fixed-interval mode assembler |
| xJK | Claude API Ruby SDK documentation assembler |