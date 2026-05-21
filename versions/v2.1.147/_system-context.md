---
type: system-context
command: _system-context
cc_version: "2.1.147"
updated: "2026-05-22"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.147 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.147 System Context

> Analysis basis: CC v2.1.147 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.147 system context is assembled from multiple discrete functions combined at runtime into a unified behavioral layer. It covers four broad domains: tool permission and confirmation policy, agentic task delegation and subagent orchestration, response style and output quality defaults, and the side-question / lightweight-agent dispatch mechanism. This assembled context sits above user instructions and CLAUDE.md in the authority hierarchy for hardcoded constraints, but yields to both for configurable defaults. The system context also embeds runtime machinery descriptions — explaining to CC itself how scheduling, background agents, context compression, and MCP server tagging behave — making several behaviors self-documenting rather than opaque.

---

## Hardcoded Constraints

- **Tool denial circumvention boundary**: When a tool invocation is denied, CC is permitted to pursue the same goal through reasonable alternative tools that naturally accomplish the same end. However, using tools in ways that exploit unrelated capabilities to bypass the denial's intent is categorically blocked. The constraint is framed as an intent-honoring rule, not a narrow name-matching rule — the spirit of the denial governs, not merely its literal surface. If the capability appears essential to the user's request and no legitimate workaround exists, CC must halt and explain rather than improvise further. This restriction is absolute and not overridable by user instruction.

- **Side-question agent isolation**: When a lightweight parallel agent is spawned to answer a user question during an ongoing main-agent operation, that agent operates with zero tool access. It cannot read files, execute commands, search, or perform any side-effecting action. This is a structural constraint of the dispatch mechanism, not a policy preference. Responses from this agent are strictly bounded to knowledge already present in the conversation context.

- **Autonomous loop trust boundary**: In timer-invoked autonomous operation, CC is constrained to act only on work the conversation already established. Inventing new tasks, scope-creeping beyond the current branch or PR, or making irreversible changes without explicit prior authorization are blocked behaviors. The restriction is framed as a trust-preservation constraint — the system context explicitly identifies the asymmetry between the cost of overreach and the cost of restraint, treating unauthorized action as a trust-erosion event rather than a minor policy violation.

- **Delegation synthesis boundary**: When constructing prompts for subagents, CC is prohibited from delegating the synthesis or decision-making step itself. Prompts to subagents must reflect that CC has already done the analysis — they must include specific file paths, line numbers, or concrete targets. Instructions phrased to push reasoning onto the subagent rather than conveying concluded understanding are treated as inadequate delegation, not a permitted alternative. This is a quality-enforcement constraint embedded in the orchestration guidance.

- **Parallel worker isolation enforcement**: Background agents spawned for large parallel tasks must use worktree isolation. This is not a default preference but a required configuration — each worker operates in an independent git worktree with no shared mutable state with sibling workers. The constraint exists to preserve mergeability of each unit's output independently.

---

## Default Behaviors

- **Autonomous loop scope defaulting**: By default, when operating autonomously on a timer, CC prioritizes the active conversation's in-progress work (especially open PRs), then falls back to branch maintenance tasks. Users can influence prioritization by structuring conversation history or by explicitly scoping autonomous operation in their instructions, but the fallback order — conversation work first, PR maintenance second, explicit idle acknowledgment third — is the default cascade.

- **Loop scheduling cadence**: The default fallback heartbeat for self-paced loops with an active event monitor is biased toward the 1200–1800 second range. Without an event monitor, cadence is dynamically chosen based on observed branch activity. Users can influence this by specifying an explicit interval in loop invocations or by configuring event monitors that wake the loop earlier. The cache-aware delay guidance embedded in the tool description further shapes actual cadence.

- **Subagent prompt construction standard**: By default, CC is expected to construct fully self-contained subagent prompts that include full context, goals, conventions, and verification recipes. The default assumes the subagent has no visibility into the parent conversation. Users invoking delegation manually can override the level of context provided, but under-briefed prompts are treated as a quality failure by the system context's own guidance.

- **End-to-end verification in parallel orchestration**: When orchestrating large parallelizable changes, the default behavior is to determine and include a concrete end-to-end verification recipe before spawning workers. The default is to seek a runnable verification path; skipping e2e is only the default when the user explicitly authorizes it in response to a prompted choice. Users can influence this by responding to the two-to-three option prompt the orchestrator surfaces during the planning phase.

- **PR maintenance behavior during autonomous operation**: When reviewing a PR autonomously, the default resolution strategy for failing CI is to diagnose before acting — distinguishing transient failures (eligible for re-queue) from real failures (requiring a minimal fix). The default for review threads is to fetch, address, push, and resolve. The default for branch staleness is rebase, not merge. Users can influence these defaults by providing explicit SCM workflow preferences in CLAUDE.md.

- **Side-question response style**: The lightweight parallel agent dispatched for side questions defaults to a single direct response with no offers to follow up, no promises to investigate, and no hedged action language. Users cannot change this through instruction to the main agent; it is enforced structurally by the agent's own system context injection.

---

## CLAUDE.md Redundancy Warning

- **Autonomous operation scope instructions**: The system context already contains detailed guidance on what CC should and should not act on during timer-invoked autonomous loops, including the trust-preservation framing and the work-priority cascade. Adding autonomous-scope restrictions to CLAUDE.md may be redundant if they restate the same priority order. However, CLAUDE.md scope instructions that are *more specific* — naming particular branches, directories, or PR conditions — are not redundant and will usefully narrow the default behavior.

- **PR workflow preferences (rebase vs. merge, thread resolution)**: The system context already defaults CC to rebase over merge and to resolve review threads after pushing. Users who add equivalent instructions to CLAUDE.md are duplicating an existing default. Conflicting instructions (e.g., directing merge-based integration) will create instruction tension that may produce inconsistent behavior depending on which layer CC weights more heavily in context.

- **Subagent briefing quality instructions**: The system context already instructs CC to write fully self-contained, context-rich subagent prompts and explicitly prohibits delegation of synthesis. Adding CLAUDE.md instructions to "always provide full context to agents" or "include file paths in delegated tasks" is redundant with an already-active default. It is unlikely to cause conflict but adds no enforcement value.

- **Autonomous idle acknowledgment style**: The system context already specifies that when nothing actionable is found during an autonomous loop, CC should produce a single short acknowledgment and stop — no enumeration of what was checked, no forward-looking lists. Adding CLAUDE.md instructions about response verbosity for idle states is redundant. Instructions that contradict this (e.g., "always summarize what you checked") may override the default and produce the noisy behavior the system context is specifically designed to prevent.

- **Loop cadence and scheduling preferences**: Default loop timing behavior is already embedded in the system context's scheduling guidance. CLAUDE.md instructions about "check every N minutes" are redundant with explicit interval syntax available in the loop invocation itself, and may create ambiguity if they conflict with runtime interval parameters.

---

## User Actionable Insights

1. **Tool denial workarounds have a defined legitimacy boundary.** When CC encounters a denied tool, it will attempt reasonable alternatives but will not exploit unrelated capabilities to circumvent the denial's intent. Users who want to grant explicit permission for a specific alternative approach should do so directly rather than expecting CC to infer it — CC will halt and explain if no legitimate path exists.

2. **Side-question agents are permanently tool-free.** The parallel lightweight agent dispatched for mid-task questions has no tool access by design. Users should not expect it to look up files, run commands, or verify anything. If the question requires live data, it should be routed to the main agent or posed as a separate full task after the current operation completes.

3. **Autonomous loop behavior cannot be expanded beyond conversation-established scope by CLAUDE.md alone.** The trust boundary enforced during autonomous operation requires that work be traceable to prior explicit conversation context. A CLAUDE.md instruction saying "also maintain dependency updates" will not be treated as authorization for autonomous dependency work unless the conversation established it. Scope expansion for autonomous operation must be established in-conversation.

4. **The 1200–1800s fallback heartbeat is a cost-aware default, not an arbitrary number.** The system context frames this range as cache-window aware — idle ticks that fall outside the prompt cache window represent pure overhead. Users running loops on high-frequency tasks should use explicit short intervals in the loop invocation rather than relying on dynamic self-pacing.

5. **Parallel orchestration workers cannot ask the user questions.** The system context instructs CC to resolve all ambiguity about end-to-end verification before spawning workers, because workers are isolated and cannot prompt the user themselves. Users who want to influence how a parallel batch job verifies its work must do so during the planning-phase dialogue, before worker spawn.

6. **Rebase is the hardcoded default for branch synchronization in autonomous operation.** Users whose repositories use merge-based workflows should specify this explicitly in CLAUDE.md or in-conversation — but should be aware that a conflicting CLAUDE.md instruction may produce inconsistent behavior. The safest approach is to specify the preference at the start of the relevant conversation.

7. **Three consecutive idle autonomous-loop results trigger a scope-reduction heuristic.** After three sequential autonomous ticks with nothing to act on, the system context instructs CC to scale back to a minimal check-and-stop pattern. Users relying on long-running autonomous loops for monitoring tasks should ensure the loop has actionable signal (via an event monitor) or accept that the loop will naturally reduce its footprint during quiet periods.

8. **Subagent prompts must prove CC has done the synthesis.** The system context's delegation constraint means that vague or open-ended subagent prompts will be treated as quality failures. Users who manually invoke subagent delegation and want consistent results should structure requests to CC with enough specificity that CC can construct a concrete, pre-synthesized prompt — abstract questions produce shallow worker output.

9. **The `system-reminder` tag is a recognized injection point.** The side-question agent's context is delivered via a `system-reminder`-tagged block. Users and operators who construct custom tooling on top of CC should be aware that this tag has defined behavioral semantics in the system context layer — content within it is treated as authoritative framing for the agent's operational constraints.

10. **Version-specific: v2.1.147 embeds the Files API and Claude Platform on AWS documentation as skill content.** This means CC in this version has hardcoded reference knowledge about the Files API (including storage limits, beta header requirements, and download restrictions) and the AWS-hosted Claude Platform (including authentication chain, workspace ID requirements, and the distinction from Amazon Bedrock). Users asking CC about these topics get answers from embedded documentation, not live lookups — accuracy is pinned to the documentation state at bundle time.

---

## Tool & Permission Layer

The system context embeds two distinct permission-handling modes for tool invocations. In the first mode, tools are auto-allowed without user confirmation — this applies to low-risk or reversible actions where the overhead of confirmation exceeds the risk of proceeding. In the second mode, CC prompts before executing — this applies to actions with irreversible effects, elevated scope, or ambiguous authorization.

When a tool invocation is denied (by the user at a prompt or by policy), CC enters a defined resolution protocol: it may attempt the goal through alternative tools that are a natural fit for the same purpose, but it may not use unrelated tools in ways that circumvent the denial's intent. If no legitimate path exists, it must stop and surface the impasse to the user, including what it was attempting and why the capability is needed.

Hook events are recognized as a distinct execution pathway. The system context's background agent infrastructure includes telemetry instrumentation for process lifecycle events — including memory pressure signals, escalated termination events, spare-agent provisioning, and daemon configuration reload signals. These events feed into the scheduling and background dispatch layer rather than surfacing directly to users.

The `system-reminder` XML tag is a recognized context injection mechanism used to deliver operational constraints to lightweight parallel agents. Content delivered via this tag governs the agent's tool access (none), response style (single-turn, no action promises), and scope (conversation context only). This tag is distinct from user-role and assistant-role content and is processed as authoritative framing.

Context compression is handled transparently — the dynamic-mode loop sentinel expands at fire time to either the full loop instructions (on first fire or post-compaction fires) or a shorter pacing-specific reminder (on subsequent fires). This means loop behavior is resilient to context window compaction without requiring the user to re-specify the full instruction set on each iteration.

MCP server content and skill-tool invocations are recognized as separate execution pathways from direct tool calls. The orchestration layer distinguishes between slash-command-style prompts (routed to the Skill tool) and direct instructions (acted on inline), and this routing happens within the system context's scheduling machinery before user-visible behavior occurs.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.147 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| h | Dashboard UI script — collapsible sections, clipboard copy, timezone histogram rendering |
| L | PostgreSQL keyword list (DDL/DML/DCL) + side-question system-reminder injection block |
| $ | Coordinator-mode subagent dispatch examples (with notification and independent-review patterns) + PostgreSQL type keyword list |
| O | Simplified subagent dispatch examples (single-turn delegation, no notification pattern) + job-block property constants |
| V | Autonomous loop scheduling instructions — event monitor arming, heartbeat delay selection, sentinel prompt passing, loop termination |
| f | Subagent prompt-writing guidance — briefing quality standards, context requirements, delegation synthesis constraint |
| b | Subtask-block property constants for workflow/routing engine |
| T | Pseudoreference code constants for access/component/privilege resolution |
| C | Auto-numeration and validation rule ID constants for reference/record management |
| P | Dataset event (dse*/re*) constants and selection route event constants |
| Y | Daemon config-reload telemetry event handler |
| w | Background dispatch telemetry — SIGKILL escalation, low-memory signal, spare-agent enable/claim/fail events |
| j16 | No large strings; assembler call site (role indeterminate from content alone) |
| M | No large strings; assembler call site near daemon config area |
| X | No large strings; assembler call site in background infrastructure range |
| j | No large strings; assembler call site in background dispatch cluster |
| z | No large strings; assembler call site at high byte offset (post-daemon range) |
| J | No large strings; assembler call site near daemon config reload range |
| R | No large strings; assembler call site in mid-bundle infrastructure range |
| y | No large strings; assembler call site in post-daemon range |
| I | No large strings; assembler call site in pre-dashboard infrastructure range |
| Z | Dashboard HTML/CSS rendering — full report UI styles, navigation, stats display, CLAUDE.md action panel |
| D | PostgreSQL SQLSTATE / error code enumeration + background spare-agent spawn telemetry |
| em_ | Tool denial workaround policy — legitimate alternative tool use vs. intent-bypass prohibition, halt-and-explain instruction |
| cb_ | Autonomous loop check instructions — stewardship framing, actionable work criteria, PR maintenance protocol, repeated-invocation scope adjustment |
| $4K | Files API Python reference — upload, document/image use, list/retrieve/delete/download operations, end-to-end example |
| yO5 | Parallel batch orchestration skill — plan mode, work unit decomposition, e2e verification, worker spawn with worktree isolation, progress tracking |
| I4K | Claude Platform on AWS reference — client install, SigV4 auth, workspace ID config, Bedrock distinction, model ID format |
| Nz5 | Loop skill — self-paced dynamic mode instructions + `/loop` interval parsing and scheduling logic |
| W4K | Claude API Ruby SDK reference — client init, streaming, tool runner beta, prompt caching, stop details, error types |