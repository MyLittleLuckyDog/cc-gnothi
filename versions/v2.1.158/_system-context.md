---
type: system-context
command: _system-context
cc_version: "2.1.158"
updated: "2026-05-30"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.158 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.158 System Context

> Analysis basis: CC v2.1.158 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.158 system context is assembled from multiple distinct function-level string segments that are combined at runtime to produce the full system prompt delivered to the model. This composite structure covers several behavioral domains: tool permission and denial handling, autonomous loop orchestration, subagent delegation patterns, side-question isolation, configuration self-awareness, and live documentation retrieval. The system context layer sits below user instructions and CLAUDE.md in the authority hierarchy for defaults, but specific policies embedded within it — particularly around tool denial response behavior and autonomous operation scope — are not freely overridable. The relationship between the system context and CLAUDE.md is additive for most behavioral tuning but potentially conflicting where the system context encodes firm defaults about trust scope and action authorization.

---

## Hardcoded Constraints

- **Tool denial response behavior**: When a tool invocation is blocked or denied, CC is constrained to respond in a specific way: it may attempt to accomplish the underlying goal through alternative, reasonable tool paths, but it is explicitly prohibited from using circumvention strategies that subvert the intent behind the denial. The distinction between "reasonable workaround" and "bypass attempt" is encoded as a hard behavioral boundary. If no acceptable path exists, CC must halt and surface the blocked capability to the user rather than silently failing or proceeding through an illegitimate route. This constraint is absolute and does not have a user-configurable exception.

- **Side-question agent isolation**: When CC spawns a lightweight agent to handle a side question while a main task continues running, that isolated agent operates under strict behavioral constraints that are hardcoded into the injected context it receives: it has no tools available, it cannot promise future actions, it cannot reference a prior operational state, and it must resolve the question entirely within a single response turn. These constraints cannot be loosened by user instruction because they are injected as a scoped system-reminder block rather than a user-facing policy.

- **Autonomous loop scope limitation**: In autonomous or daemon-loop operation, CC is constrained to act only on work that is evidenced in the existing conversation transcript or the current branch's pull/merge request state. Inventing new work items, initiating unrequested features, or making irreversible changes without clear prior authorization are treated as trust-eroding behaviors that the system context explicitly marks as out-of-scope regardless of how long the loop has been running. This is a hardcoded disposition, not a default that can be toggled off.

- **Subagent context isolation**: When delegating to a subagent with a specified agent type, the subagent begins with no inherited conversation context. The system context encodes this isolation as an architectural fact, not a policy choice — the orchestrator is required to provide full briefing in the prompt because the subagent cannot access prior turns. Users cannot instruct CC to "share context" with subagents implicitly; all relevant context must be explicitly embedded in the delegation prompt.

- **Configuration self-knowledge staleness acknowledgment**: CC is hardcoded to treat its training-data knowledge of its own commands, flags, and settings as potentially stale. Before answering configuration questions, it is required to check the live build configuration injected into the prompt, then bundled references, then live documentation. This hierarchy is not user-adjustable — CC cannot be instructed to answer Claude Code configuration questions purely from training memory without this verification step.

- **Parallel batch worker isolation requirement**: When orchestrating large parallelizable changes, workers must use worktree isolation and background execution. This is encoded as a mandatory structural requirement for the batch orchestration pattern, not a suggestion.

---

## Default Behaviors

- **Tool denial escalation path**: By default, when CC encounters a denied tool call, it attempts one layer of reasonable alternative tooling before stopping and explaining the situation to the user. Users can influence how much explanation CC provides, but cannot remove the requirement to stop and surface the issue if no legitimate path exists.

- **Autonomous loop verbosity**: By default, when operating in an autonomous timer-driven loop with nothing actionable to do, CC produces a brief single-sentence acknowledgment and stops rather than narrating a detailed summary of what was checked. Users can adjust the reporting style through CLAUDE.md, but the default is deliberately minimal to avoid noise accumulation across repeated invocations.

- **Autonomous loop pacing and wake strategy**: The default behavior when a monitor or persistent watcher is armed is to use a longer fallback heartbeat interval; without one, CC adjusts the delay based on observed activity level. This pacing logic is a default that the loop orchestration prompt encodes but that users can influence by specifying explicit delay preferences.

- **Subagent prompt completeness**: By default, CC is instructed to write delegation prompts that are fully self-contained — including the goal, what has already been tried, relevant file paths, and explicit constraints on response length or format. The default pushes toward comprehensive briefing rather than terse delegation. Users can instruct CC to be more concise, but the system default biases toward over-informing subagents rather than under-informing them.

- **Live documentation retrieval preference**: By default, when answering questions about CC's own configuration, CC prefers fetching live documentation over answering from training data. If the network is unavailable, it falls back to training data but is required by default to explicitly caveat that the answer may be outdated. Users cannot suppress this caveat through CLAUDE.md without potentially conflicting with a hardcoded transparency policy.

- **Pull request maintenance in autonomous mode**: By default, autonomous loop operation includes checking CI status, unresolved review threads, and branch freshness on the current PR when the conversation transcript has no remaining work. This maintenance sweep is the default second-priority action. Teams can narrow autonomous scope via CLAUDE.md instructions, but the default is broad.

- **Batch orchestration phase gating**: By default, batch parallel work enters a planning phase before spawning workers, and spawning is gated on explicit plan approval. The default requires user sign-off on the decomposition before parallelism begins. This cannot be skipped without explicit user instruction to proceed without approval.

- **Configuration answer concreteness**: When answering configuration questions, CC defaults to showing exact commands, flag syntax, and settings file paths rather than paraphrased descriptions. This is a system-level default that CLAUDE.md instructions could potentially override toward more explanatory style, but doing so would conflict with the embedded guidance.

---

## CLAUDE.md Redundancy Warning

- **Autonomous scope conservatism**: The system context already encodes a strong default toward conservative action during autonomous operation — prioritizing established work over newly invented tasks. Adding CLAUDE.md instructions like "don't do work I haven't asked for" is redundant and likely neutral. However, adding instructions that expand autonomous scope (e.g., "feel free to refactor related code you notice") may conflict with the embedded conservatism default and produce inconsistent behavior depending on which instruction the model weights more heavily.

- **Subagent briefing style**: The system context already instructs CC to write comprehensive, context-rich delegation prompts for subagents. CLAUDE.md entries that say "always give subagents full context" are redundant. Entries that say "keep subagent prompts brief" may conflict with the default and produce underspecified delegation prompts.

- **PR maintenance during idle autonomous loops**: The system context already defines PR maintenance (CI checks, review thread resolution, branch freshness) as default autonomous behavior during idle periods. Adding CLAUDE.md instructions to "check CI during autonomous runs" is fully redundant. Teams that want to restrict this behavior should explicitly say so, as the default is broader than many users expect.

- **Staleness caveats on self-knowledge**: The system context already requires CC to caveat training-data answers about CC configuration with explicit uncertainty language. CLAUDE.md instructions to "be honest about what you don't know" are redundant in this domain. Instructions to "answer confidently" may suppress the caveats and conflict with the embedded transparency requirement.

- **Documentation-first lookup for CC config questions**: The system context already configures a specific lookup hierarchy (live build → bundled references → fetched docs → training data with caveat). CLAUDE.md instructions about how to answer configuration questions risk conflicting with this hierarchy unless they are written with awareness of it.

- **Batch parallelism worker isolation**: The system context already mandates worktree isolation and background execution for batch workers. CLAUDE.md instructions that specify isolation modes for large refactors are redundant if they match the default, or potentially conflicting if they specify different isolation strategies.

---

## User Actionable Insights

1. **Tool denial is a hard stop, not a soft suggestion.** When CC declines to proceed after a tool is denied, this is not timidity — it is enforced behavior. Users who want CC to proceed through alternative paths must either grant the missing permission or explicitly reframe the task, not simply repeat the instruction. Attempting to instruct CC to "just find a way" will not bypass the embedded constraint against circumvention.

2. **Side-question agents are genuinely stateless and tool-free.** When CC handles a side question via a lightweight spawned agent, that agent truly cannot look anything up, run any command, or carry any context from the main session. Users should frame side questions as things answerable from context already present in the conversation; anything requiring a file read or command execution will simply be unanswerable by the side agent.

3. **Autonomous loop behavior is scoped to evidence, not inference.** Users who deploy CC in autonomous timer-driven mode should understand that the embedded policy biases strongly against novel work initiation. If users want CC to proactively explore related improvements during idle periods, they should say so explicitly in their loop-launch prompt, understanding that this conflicts with the default conservative posture.

4. **Subagent prompts must be written by the orchestrator, not inherited.** There is no mechanism for a subagent to query the parent conversation for context it wasn't given. Every piece of information a subagent needs — file paths, what has been tried, conventions, verification steps — must be explicitly included in the delegation prompt. Users who write terse delegation prompts will get generic subagent output regardless of how rich the parent conversation context is.

5. **Live build configuration beats training memory for CC self-knowledge questions.** When asking CC about its own commands, flags, or settings, the most reliable answers come from the live build snapshot injected at invocation time. If a user is getting outdated answers about CC behavior, the cause may be a missing or stale live-build injection, not a model knowledge gap.

6. **The v2.1.158 live documentation URL set is embedded in the bundle.** CC carries a specific set of documentation URLs for self-lookup. Users can take advantage of this by asking CC to fetch current documentation rather than relying on training-data answers — the URL routing logic is hardcoded and will direct the fetch to the correct current-version page.

7. **Batch parallelism requires worktree isolation by design.** Users planning large parallel refactors should expect CC to enforce worktree-isolated, background-executed workers. Attempting to run parallel batch work without this structure (e.g., instructing CC to use in-place edits across parallel agents) conflicts with the embedded orchestration model and is likely to produce conflicts.

8. **PR maintenance is default autonomous behavior, not an opt-in.** Teams deploying CC in autonomous mode who do not want it touching CI, review threads, or branch mergeability during idle periods need to explicitly scope the autonomous behavior in their configuration. The default scope is broader than "just finish what I was doing."

9. **The Files API and platform-specific SDK skills are version-pinned in this bundle.** The embedded reference content for the Files API (Python) and platform-specific clients (including AWS-based access) reflects the state of those APIs at bundle build time. Users querying CC about these APIs should be aware that the embedded reference and the live documentation may diverge; fetching live docs is preferred over relying on the embedded reference for API-surface questions.

10. **Configuration question answers include an explicit staleness disclosure path.** If users ask CC about CC configuration and network access is unavailable, the embedded policy requires CC to say so and attach a caveat to training-data answers. Users who see this caveat should treat it as a signal to verify against the live documentation rather than a model limitation to work around.

---

## Tool & Permission Layer

The system context embeds several distinct machinery-level behaviors that govern how CC manages tools, permissions, and orchestration infrastructure.

**Tool denial and alternative-path logic**: The permission layer includes an explicit policy governing what CC should do when a specific tool invocation is blocked. The model is instructed to consider whether the underlying goal can be achieved through a different, naturally appropriate tool without circumventing the intent of the restriction. This logic is injected as a behavioral string that the model processes as part of its decision context when it encounters a denial event. The distinction between a legitimate alternative approach and a circumvention attempt is qualitative, not rule-based, and the model is expected to apply judgment.

**Side-question isolation via system-reminder injection**: The side-question handling mechanism injects a scoped `<system-reminder>` block into the lightweight agent's context. This block configures the agent's behavioral envelope: single-response constraint, no-tool constraint, no-action-promise constraint, and a specific identity framing that prevents the agent from treating itself as an interrupted version of the main agent. This is a runtime injection pattern, not a static system prompt, meaning it is assembled per-invocation.

**Autonomous loop orchestration**: The loop-management machinery includes structured instructions for how CC should schedule its own reinvocation: selecting delay intervals based on activity level, arming persistent monitors for event-driven wake, handling task-notification wake events differently from timer-based wake events, and terminating the loop cleanly. This orchestration logic is embedded as a large instruction block that the model receives when operating in daemon/autonomous mode.

**Subagent delegation machinery**: Two related instruction blocks cover subagent delegation — one for coordinator-pattern orchestration (where the coordinator relays results back to the user) and one for fire-and-forget background delegation. Both encode the prompt-writing discipline: full context transfer, explicit goal statement, output format specification, and the prohibition on delegating synthesis tasks rather than well-specified execution tasks.

**MCP and system-reminder tag handling**: The bundle includes handling for `<system-reminder>` tagged content, which is used to inject scoped behavioral modifications at specific points in a conversation (such as side-question handling). This tag-based injection mechanism allows the system context to be extended at runtime without modifying the base system prompt.

**Context compression notice**: The autonomous loop machinery references a "first fire post-compact" event state, indicating that the system context includes awareness of context window compression events. The loop sentinel string is designed to expand differently on the first invocation after a context compaction versus on a standard loop tick, allowing the model to re-orient itself after context loss.

**Live documentation routing**: An embedded URL table maps documentation topic categories (configuration, extensibility, workflows, deployment) to specific live documentation endpoints. This table functions as a routing layer that CC consults when answering self-referential questions about its own behavior, ensuring that fetches are directed to the correct current-version pages rather than guessed URLs.

**Background process telemetry hooks**: Several functions in the bundle carry telemetry event registrations for background process lifecycle events — including spare process management, low-memory conditions, and forceful process termination escalation. These hooks are infrastructure-level and are not exposed to users, but they indicate that the daemon/background execution layer has its own observability instrumentation separate from the model's behavioral telemetry.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.158 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `h` | Dashboard UI JavaScript — collapsible panel, clipboard copy, and usage histogram rendering logic |
| `L` | PostgreSQL keyword list (DDL/DML/DCL) + side-question system-reminder injection block |
| `$` | Coordinator-pattern subagent delegation examples with notification relay behavior |
| `O` | Background subagent delegation examples (fire-and-forget, no relay) |
| `E` | Autonomous loop orchestration instructions — scheduling, monitor arming, sentinel string handling |
| `M` | Subagent prompt-writing discipline guidance — context transfer and synthesis prohibition |
| `b` | Subtask block property constant list (workflow/BPM system artifact) |
| `G` | Pseudoreference code constant list (access control / component registry artifact) |
| `S` | Reference record validation rule ID constant list (BPM/record system artifact) |
| `X` | Dataset event name constant list (dse*/reOn* event identifiers, BPM artifact) |
| `Y` | Daemon configuration reload telemetry event registration |
| `w` | Background process lifecycle telemetry — SIGKILL escalation, low-memory, spare process pool management |
| `nL6` | Assembler call node — no large strings, no telemetry; likely a small utility or stub |
| `f` | Assembler call node — no large strings, no telemetry; likely a small utility or stub |
| `P` | Assembler call node — no large strings, no telemetry; likely a small utility or stub |
| `j` | Assembler call node — no large strings, no telemetry; likely a small utility or stub |
| `z` | Assembler call node — no large strings, no telemetry; likely a small utility or stub |
| `J` | Assembler call node — no large strings, no telemetry; likely a small utility or stub |
| `C` | Assembler call node — no large strings, no telemetry; likely a small utility or stub |
| `y` | Assembler call node — no large strings, no telemetry; likely a small utility or stub |
| `I` | Assembler call node — no large strings, no telemetry; likely a small utility or stub |
| `V` | Dashboard UI CSS — full stylesheet for the analytics/reporting HTML surface |
| `D` | PostgreSQL SQLSTATE error code constant list + background spare-process telemetry events |
| `ai_` | Tool denial response policy — alternative-path permission and circumvention prohibition |
| `SG_` | Autonomous loop behavioral instructions — scope definition, PR maintenance, repeated-invocation handling |
| `RwK` | Live documentation URL routing table — topic-to-URL mapping for CC self-knowledge fetches |
| `MDK` | Files API Python reference — upload, use-in-messages, manage, and end-to-end example patterns |
| `fh5` | Batch parallel orchestration instructions — research/plan/spawn/track phases, worker prompt template |
| `uwK` | CC configuration self-knowledge policy — staleness acknowledgment, lookup hierarchy, answer style |
| `NDK` | Claude Platform on AWS skill reference — client setup, authentication, feature parity notes |