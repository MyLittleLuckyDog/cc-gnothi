---
type: system-context
command: _system-context
cc_version: "2.1.154"
updated: "2026-05-29"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.154 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.154 System Context

> Analysis basis: CC v2.1.154 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.154 system context is assembled from multiple cooperating function layers within the bundle, each contributing distinct behavioral policies across areas such as tool permission handling, agentic task orchestration, autonomous loop management, and documentation self-awareness. These layers combine at runtime to form the complete instruction set CC operates under before any user instruction or CLAUDE.md content is applied. User instructions and CLAUDE.md content sit atop this foundation and can influence default behaviors within defined limits, but cannot override the hardcoded constraint layer. The system context is notably self-referential: it instructs CC to treat its own embedded documentation snapshot as potentially stale and to prefer live-fetched documentation over training-data recall when the two conflict.

---

## Hardcoded Constraints

- **Tool-denial bypass prohibition**: When a specific tool invocation is denied, CC is permitted to seek functionally equivalent outcomes through other legitimate tools already available. However, any attempt to circumvent the intent of a denial — for example, by disguising a disallowed action as something superficially different — is categorically blocked. If no legitimate path exists, CC must halt and explain the situation to the user rather than proceeding unilaterally. This constraint is absolute and cannot be overridden by user instruction.

- **Side-question agent isolation**: When CC spawns a lightweight parallel instance to handle an interrupting user question, that instance is prohibited from claiming continuity with the main agent's work state. It cannot reference what the main agent was "previously doing," cannot use tools, cannot make promises to investigate or take action, and must confine its response to a single turn using only information already present in the conversation context. These constraints are structurally enforced by the system-reminder tag injected at spawn time and are not adjustable by user instruction.

- **Autonomous loop scope boundary**: During timer-driven autonomous operation (when the user is away), CC is prohibited from inventing new work that lacks explicit grounding in the prior conversation transcript. Irreversible changes without clear prior authorization are blocked by behavioral policy. The constraint is expressed as a trust-erosion principle: actions that require reaching for justifications to proceed are defined as signals to stop, not continue. This is a behavioral absolute within the autonomous loop context.

- **Subagent prompt completeness requirement**: When delegating work to a subagent that starts without access to the current conversation context, CC is prohibited from writing prompts that push synthesis back onto the subagent (e.g., instructing it to "figure out" what to fix based on its own findings). Each subagent prompt must be self-contained and must encode the coordinator's understanding concretely, including relevant file paths, line numbers, and specific change targets. Vague delegation is treated as a policy violation, not merely a quality issue.

- **Documentation currency acknowledgment**: CC is prohibited from silently answering questions about its own configuration surface (commands, flags, settings keys, hook events) from training data alone when network access is available. If the live documentation cannot be reached, CC must explicitly disclose that its answer derives from potentially stale training data and direct the user to the authoritative documentation source. Presenting stale training-data answers as current without caveat is blocked.

- **Worktree isolation for parallel batch workers**: When orchestrating a large parallelizable change across a codebase, all spawned worker agents must use isolated git worktrees and must run in the background. This architectural constraint is hardcoded into the batch orchestration system context and cannot be relaxed by user instruction within that workflow.

---

## Default Behaviors

- **Autonomous loop pacing**: By default, when operating autonomously on a timer, CC selects a fallback heartbeat delay calibrated to observed branch activity (longer when quiet, shorter when there is significant work in flight), with a tighter range when an event-based monitor is also armed. Users can influence pacing implicitly by the density of in-flight work present in the conversation transcript, but the delay-selection logic itself is embedded in the system context and not directly user-configurable through instruction alone.

- **PR/branch maintenance scope during autonomous operation**: The default priority ordering during autonomous loops is: continue active conversation work first, then PR maintenance (CI, review threads, branch freshness), then idle sweep passes. Users can shift this emphasis by the content of the conversation transcript — a transcript with no active work signals that maintenance is the appropriate focus.

- **Subagent prompt briefing style**: The default expectation for subagent prompts is a fully briefed, self-contained specification, analogous to onboarding a capable colleague who has no prior context. Users can adjust the level of detail by specifying response-length constraints or scoping the subagent's task more narrowly, but the requirement for self-containedness is a default that persists unless the subagent type inherits conversation context by design.

- **Documentation lookup order**: By default, when answering questions about CC's own behavior or configuration, CC checks the live build configuration embedded in the prompt first, then bundled references, then fetches live documentation, and finally falls back to training data with an explicit caveat. Users cannot reorder this priority chain, but they can skip steps implicitly by asking questions that are already answered in the live build section.

- **Batch orchestration plan approval gate**: By default, the batch parallel-work orchestration workflow includes a mandatory plan-approval step before any worker agents are spawned. The user must approve the decomposed work plan before Phase 2 begins. This gate is on by default; users interact with it by reviewing and approving or modifying the plan.

- **Rebase-over-merge for branch updates**: During autonomous PR maintenance, when the branch has fallen behind its base branch, the default behavior is to rebase rather than merge. Users can influence this by project-level git configuration, but the default preference is encoded in the system context.

- **CI failure triage before action**: When autonomous operation encounters a failing CI job, the default behavior is to pull and diagnose the logs before taking any remediation action, distinguishing between transient failures (eligible for re-enqueue) and genuine failures (requiring a fix). Acting without diagnosis is not the default.

- **End-to-end verification requirement in batch work**: By default, the batch orchestration workflow requires the coordinator to determine a concrete end-to-end verification recipe before spawning workers. If no concrete path exists, the default behavior is to pause and ask the user rather than skip verification. Skipping e2e is permitted only when explicitly acknowledged.

---

## CLAUDE.md Redundancy Warning

- **Subagent briefing instructions**: The system context already establishes detailed guidance for how to write subagent prompts — including the requirement for self-containedness, concrete specifics, and the prohibition on delegating synthesis. Adding CLAUDE.md instructions that repeat this guidance is redundant. Conflicting CLAUDE.md instructions (e.g., "keep subagent prompts brief") may create instruction tension that degrades prompt quality without providing any net benefit.

- **Autonomous loop behavior guidance**: The autonomous loop's scope, priority ordering, and trust model are already defined in the system context. CLAUDE.md entries attempting to define "what to do when running autonomously" are likely redundant and may conflict with the embedded loop policy, particularly around the prohibition on inventing new work.

- **PR maintenance workflow steps**: The system context already specifies the sequence for CI triage, review-thread resolution, and branch-rebase behavior during autonomous operation. Duplicating these steps in CLAUDE.md is neutral at best. Instructions that contradict the embedded sequence (e.g., "merge instead of rebase") may produce inconsistent behavior depending on which instruction takes precedence in context.

- **Documentation-first lookup policy**: Users who add CLAUDE.md instructions telling CC to "check the docs before answering" about CC itself are duplicating a policy already embedded in the system context. This duplication is neutral but wasteful of CLAUDE.md space.

- **Batch work decomposition heuristics**: The system context already provides guidance on how to decompose large parallelizable changes into work units, including size-uniformity and independence requirements. CLAUDE.md entries encoding project-specific decomposition preferences (e.g., "slice by directory") are additive and non-conflicting, but generic decomposition heuristics that mirror the system context are redundant.

- **Tool-denial response behavior**: Users who add CLAUDE.md instructions like "if a tool is denied, explain why and stop" are approximating a policy already hardcoded in the constraint layer. The CLAUDE.md version is redundant; the hardcoded version takes precedence regardless.

---

## User Actionable Insights

1. **Tool denial handling cannot be overridden.** The policy governing what CC does when a tool invocation is denied is hardcoded. Users cannot instruct CC to silently skip denied tools, to attempt workarounds that circumvent the denial's intent, or to proceed without disclosure. If a workflow depends on a tool that may be denied, design the workflow to handle the halt gracefully.

2. **Side-question agents are structurally isolated.** When CC spawns a parallel instance to answer an interrupting question, that instance has no tools and no action capability. Users expecting the side-question agent to look something up, run a command, or take any action will be disappointed — this is a structural constraint, not a configuration choice.

3. **Autonomous loop trust model is asymmetric.** During autonomous operation, the cost of an unauthorized action is treated as higher than the cost of doing nothing. Users who want CC to be more aggressive autonomously should make their authorizations explicit in the conversation transcript before stepping away, rather than hoping CC will infer permission.

4. **Subagent prompt quality is a system-level expectation, not a style preference.** The system context encodes briefing quality as a behavioral requirement. Poorly briefed subagent prompts (vague, context-free, synthesis-delegating) are not merely suboptimal — they conflict with embedded policy. Users orchestrating multi-agent workflows benefit from understanding this expectation explicitly.

5. **CC treats its own training data about itself as unreliable.** This is not humility — it is a hardcoded epistemological policy. CC will not confidently answer questions about its own commands, flags, or settings from memory alone when network access is available. Users who observe CC fetching its own documentation rather than answering immediately are seeing this policy in action, not a bug.

6. **The batch orchestration e2e gate is mandatory by default.** Users invoking the batch parallel-work workflow who have no e2e verification path must explicitly acknowledge this to the coordinator. The workflow will pause and ask rather than assume skipping is acceptable.

7. **Live build configuration in the prompt is treated as ground truth.** For questions about what commands, settings, or features exist in the currently running CC instance, the embedded live-build snapshot takes precedence over both training data and fetched documentation. Users can rely on this for precise configuration introspection within a session.

8. **Rebase is the default branch-update strategy during autonomous operation.** Users who prefer merge-based workflows should be aware that the autonomous loop defaults to rebase when catching up a branch. This is version-specific to v2.1.154 and may change in future versions.

9. **CLAUDE.md cannot expand the tool-permission envelope beyond what the permission layer allows.** The hardcoded constraint layer sits below the CLAUDE.md layer. Instructions in CLAUDE.md that would require CC to bypass a tool denial or take an action prohibited by the constraint layer will be ineffective.

10. **Version-specific note — v2.1.154**: This version includes an explicit documentation-currency acknowledgment system (the live-sources reference table) and a structured fallback chain for answering self-referential questions. Users upgrading from earlier versions may notice CC being more explicit about citing documentation URLs and flagging stale-data caveats than prior versions.

---

## Tool & Permission Layer

The system context in v2.1.154 embeds a structured tool-permission model that governs how CC handles tool invocations across both interactive and autonomous operation modes.

**Denial and graceful degradation**: When a tool invocation is blocked, CC is instructed to attempt functionally equivalent alternatives through legitimately available tools before concluding the task is impossible. However, the equivalence must be genuine — workarounds that circumvent the denial's intent rather than routing around a surface-level limitation are prohibited. If no legitimate alternative exists, CC halts and presents the situation to the user for a decision.

**Side-question agent tool lockout**: The system-reminder tag injected into side-question agent contexts enforces a complete tool blackout for those instances. No file reads, no command execution, no search, no external actions of any kind are available to the lightweight parallel instance. This is structurally enforced at the prompt level, not by user-facing permission configuration.

**Autonomous loop tool scope**: During timer-driven autonomous operation, CC's tool usage is governed by the scope of work established in the prior conversation transcript. The loop policy instructs CC to treat actions outside that established scope as requiring explicit authorization, effectively making the conversation transcript function as a dynamic permission document for autonomous tool use.

**MCP server handling**: The live build configuration embedded in the system context includes a listing of configured MCP servers visible to CC at invocation time. CC is instructed to treat this listing as authoritative for the current session — if an MCP server is not in the list, it is treated as not available regardless of what training data suggests. The Claude Code configuration guide subcomponent instructs CC to surface this list when users ask about available MCP integrations.

**System-reminder tag semantics**: The system-reminder XML tag is used to inject behavioral constraints into specific agent contexts (notably the side-question agent). Content within this tag carries elevated behavioral authority for the agent instance that receives it, overriding default conversational behaviors for the duration of that instance's single-turn response.

**Hook event awareness**: The telemetry layer (visible through instrumentation events) indicates that the v2.1.154 bundle includes hooks for daemon configuration reload, background dispatch lifecycle events (including memory pressure and SIGKILL escalation), and background spare agent management (enable, claim, claim-failure). These hook points are part of the operational machinery CC is aware of but does not expose directly to user configuration through the system context layer alone.

**Context compression notice**: The autonomous loop system context includes explicit handling for the case where earlier autonomous-loop turns have been compressed out of the active context window. CC is instructed to adjust its scope assessment when it detects that prior autonomous invocations are no longer visible, avoiding duplicate work and recalibrating its understanding of what has already been completed.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.154 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| h | UI interaction JS (collapsible, clipboard, histogram rendering) |
| L | SQL keyword list + side-question agent system-reminder injector |
| $ | Coordinator-mode subagent usage examples (ship-audit, migration-review patterns) |
| O | Simplified subagent delegation examples (single-agent dispatch variant) |
| E | Autonomous loop heartbeat and event-monitor scheduling instructions |
| M | Subagent prompt-writing guidance (briefing principles, delegation anti-patterns) |
| b | Subtask block property constant definitions |
| T | Pseudoreference code constant definitions |
| R | Validation rule ID constant definitions |
| X | Dataset event (dse*/re*) and selection route event constant definitions |
| Y | Daemon config-reload telemetry hook |
| w | Background dispatch lifecycle telemetry hooks (sigkill, low-mem, spare pool) |
| NL6 | Assembler call stub (no large strings, no telemetry) |
| f | Assembler call stub (no large strings, no telemetry) |
| P | Assembler call stub (no large strings, no telemetry) |
| j | Assembler call stub (no large strings, no telemetry) |
| z | Assembler call stub (no large strings, no telemetry) |
| J | Assembler call stub (no large strings, no telemetry) |
| C | Assembler call stub (no large strings, no telemetry) |
| y | Assembler call stub (no large strings, no telemetry) |
| k | Assembler call stub (no large strings, no telemetry) |
| V | Analytics dashboard CSS/HTML renderer (usage stats, CLAUDE.md suggestion UI) |
| D | PostgreSQL SQLSTATE error code constant list + background spare spawn telemetry |
| Di_ | Tool-denial graceful-degradation and bypass-prohibition policy injector |
| NN_ | Autonomous loop behavioral policy (scope, trust model, PR maintenance, pacing) |
| aYK | Live documentation source URL table (Mintlify-based CC docs index) |
| kzK | Files API Python reference (upload, use, manage, download patterns) |
| qy5 | Batch parallel-work orchestration system context (3-phase: plan, spawn, track) |
| HDK | CC configuration self-help guide (staleness policy, lookup routing, answering style) |
| czK | Claude Platform on AWS reference (SigV4, workspace ID, client setup, IAM) |