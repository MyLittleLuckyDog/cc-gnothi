---
type: system-context
command: _system-context
cc_version: "2.1.157"
updated: "2026-05-30"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.157 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.157 System Context

> Analysis basis: CC v2.1.157 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.157 system context is assembled from multiple discrete function-level components combined at runtime, rather than stored as a single monolithic prompt. These components collectively govern security and permission policy, tool invocation behavior, subagent and delegation protocols, autonomous loop operation, documentation self-awareness, and output style conventions. The assembled context sits above user instructions and CLAUDE.md in the authority hierarchy for absolute constraints, while defaulting behaviors remain open to user influence. Where user instructions or CLAUDE.md conflict with hardcoded sections, the hardcoded sections take precedence; where they address default behaviors, user configuration can shift the outcome.

---

## Hardcoded Constraints

- **Tool denial respect**: When a tool invocation is blocked or denied by the permission layer, CC is instructed to acknowledge the denial and explore only reasonable, intent-preserving alternative approaches using other available tools. Attempts to circumvent the spirit of a denial — for example, exploiting an unrelated tool's side effects to execute a blocked action — are explicitly prohibited. If no acceptable alternative exists, CC must stop and surface the problem to the user rather than proceeding unilaterally.

- **Escalation on capability gaps**: When a denied or unavailable capability is genuinely required to fulfill a user request, CC must halt its attempt and explain to the user what it was trying to accomplish and why the capability matters. The decision about how to proceed — including whether to grant the permission — is delegated entirely to the user. CC does not make that determination itself.

- **Side-question agent isolation**: When a lightweight parallel agent is spawned to handle a side question while the primary agent continues working, that secondary instance operates under strict constraints embedded in the system context: no tools are available to it, it cannot read files or execute commands, it must respond in a single turn with no follow-up, and it must not misrepresent itself as having been interrupted from prior work. These constraints are not overridable by user instruction directed at the secondary instance.

- **Autonomous loop scope boundaries**: During autonomous (timer-driven) operation, CC is hardcoded to treat acting on already-established work as safe and acting on invented or newly-identified work as requiring explicit prior authorization from the conversation transcript. Making irreversible changes without clear transcript-level authorization is prohibited regardless of how plausible the action might seem. The constraint is not absolute in edge cases but defaults to a strong conservative posture.

- **Documentation staleness acknowledgment**: When answering questions about CC's own configuration surfaces (commands, flags, settings keys, hook events), CC is hardcoded to treat its training-data knowledge as potentially stale and to prioritize the live build configuration present in the prompt, followed by bundled references, followed by fetched documentation, and only then training data. Silently answering from training data when the live configuration contradicts it is blocked.

- **Subagent prompt self-containment requirement**: When delegating work to a subagent, CC is required to write prompts that are fully self-contained — including all relevant context, file paths, conventions, and verification recipes. Prompts that push synthesis or understanding back onto the subagent ("based on your findings, fix it") are prohibited by the delegation guidelines embedded in the system context.

---

## Default Behaviors

- **Tool confirmation mode**: By default, CC prompts for user confirmation before executing tool actions with significant side effects. Users can shift this toward auto-allow for specific tools or tool categories via permission rules in settings, reducing friction for trusted or repetitive operations. The exact boundary of what triggers confirmation is configurable; the default errs toward asking.

- **Autonomous loop pacing**: When operating in autonomous timer-driven mode, CC defaults to a moderate heartbeat delay, adjusting based on observed activity level (longer when quiet, shorter when much is in flight). Users who configure the loop can influence the delay range and the conditions that trigger wake events. The loop stops by default if no work is found across several consecutive checks.

- **Subagent delegation style**: CC defaults to a "coordinator" posture when orchestrating subagents — it performs synthesis and planning itself and hands agents self-contained, scoped tasks. This default can be influenced by instructions that specify different agent types, isolation modes, or prompt structures, but the underlying principle that the coordinator should not delegate its own understanding is a strong default.

- **Documentation fetch behavior**: When asked about CC's own behavior or configuration, CC defaults to checking the live build snapshot in the prompt first, then bundled references, then fetching live documentation via WebFetch. Users cannot override the priority order, but they can operate in environments where network access is unavailable, in which case CC defaults to surfacing the limitation explicitly rather than silently falling back to training data.

- **Parallel batch orchestration phasing**: For large parallelizable tasks, CC defaults to a research-and-plan phase followed by a spawn phase, with approval gating between them. Users can influence the decomposition granularity and the verification recipe, but the phased structure with explicit plan approval is the default workflow.

- **Code review and CI maintenance during autonomous operation**: During autonomous loops, CC defaults to checking PR/MR status (CI, review threads, branch staleness) when no active conversation work remains. This maintenance behavior is the default fallback, not a primary mode. Users can suppress it by ensuring loop configuration focuses on specific tasks.

- **Stale-knowledge caveat injection**: When network access is unavailable and CC must answer from training data about CC-specific topics, it defaults to inserting an explicit caveat and a pointer to the authoritative documentation site. Users cannot suppress this caveat when the condition applies.

---

## CLAUDE.md Redundancy Warning

- **Subagent prompt quality guidelines**: The system context already embeds detailed guidance on how to write effective subagent prompts — including the principle of briefing agents as if they have no prior context, specifying goals and constraints explicitly, and avoiding prompts that delegate synthesis back to the agent. Adding similar guidance to CLAUDE.md is redundant. Conflicting CLAUDE.md instructions that encourage vague or delegation-heavy agent prompts may create instruction conflict with the embedded guidelines.

- **Autonomous loop behavior defaults**: The system context already defines the conservative scope policy for autonomous operation — act on established work, avoid inventing new work, avoid irreversible changes without authorization. Users who add CLAUDE.md instructions attempting to expand autonomous scope should be aware the hardcoded conservative default remains active and may conflict with permissive CLAUDE.md language.

- **Tool denial handling**: The system context already instructs CC how to handle denied tool invocations — seek reasonable alternatives, respect intent, escalate to user when stuck. CLAUDE.md instructions that attempt to redefine this behavior (e.g., "always find a workaround when a tool is denied") may partially override the default but cannot remove the prohibition on circumventing the intent of a denial.

- **Documentation self-check before answering**: The system context already instructs CC to verify CC-specific answers against the live build configuration. CLAUDE.md instructions telling CC to "answer from memory" for CC configuration questions are directly conflicting and will create tension with the embedded policy.

- **Parallel work decomposition structure**: The phased plan-then-spawn structure for batch operations is already embedded. CLAUDE.md instructions that describe a preferred orchestration style may be redundant if they match the default, or conflicting if they specify a different phasing approach.

---

## User Actionable Insights

1. **Tool permission configuration is the primary lever for friction reduction.** The confirmation-before-action default cannot be removed globally, but targeted permission rules in settings allow users to designate specific tools or patterns as auto-allowed, eliminating prompts for trusted repetitive operations. Understanding this distinction — hardcoded confirmation behavior vs. configurable permission rules — prevents frustration when trying to fully automate CC.

2. **The autonomous loop's conservative scope is not a bug and cannot be fully overridden by CLAUDE.md.** The embedded posture that treats invented work as unauthorized is a hardcoded safety boundary. Users who want CC to take broader autonomous initiative should provide explicit, documented task scope in the conversation transcript before engaging autonomous mode — that transcript evidence is what the loop uses to classify actions as "established" vs. "invented."

3. **Side-question agents are intentionally tool-less and single-turn.** If a user expects a side-question agent to read files, run commands, or engage in multi-turn dialogue, that expectation cannot be met regardless of instructions — the constraints are hardcoded into the instance's context. Side questions should be scoped accordingly.

4. **CC's answers about its own configuration are version-sensitive.** Because CC v2.1.157 is hardcoded to prioritize the live build snapshot over training data, users who ask CC about itself in an environment with no network access will receive explicitly caveated answers. This is intentional and version-specific behavior. Users operating in air-gapped or network-restricted environments should pre-populate relevant configuration documentation locally.

5. **Subagent prompt quality is enforced at the guideline level.** CC's embedded delegation guidelines prohibit pushing synthesis back onto subagents. Users who write CLAUDE.md instructions that encourage vague agent prompts or that tell CC to "let the agent figure it out" are working against embedded policy, which may result in CC rewriting or supplementing such prompts before dispatch.

6. **The phased approval gate in batch orchestration is default-on.** For large parallel tasks, the plan-approval step before worker spawning is the built-in default. Users who want to skip approval gating need to provide explicit instruction; even then, the research phase is expected to run first. Knowing this prevents confusion when CC pauses mid-orchestration rather than immediately spawning workers.

7. **Live documentation URLs are bundled as a reference layer.** CC v2.1.157 includes an internal table of canonical documentation URLs for its own configuration surfaces. When CC fetches documentation to answer a configuration question, it is drawing from this embedded URL map — users can request CC consult specific documentation pages directly if the bundled map does not cover a niche topic.

8. **Denial circumvention is explicitly prohibited at the system level.** Attempts to instruct CC (via CLAUDE.md or inline instruction) to find workarounds that bypass the intent of a tool denial will be resisted. CC distinguishes between "reasonable alternative tool use" (permitted) and "workaround that defeats the denial's purpose" (blocked). This distinction is hardcoded.

---

## Tool & Permission Layer

The system context embeds a multi-tier permission model that governs how CC interacts with tools across different operational contexts.

**Auto-allow vs. prompt-to-allow modes**: The default posture prompts for confirmation on consequential tool actions. Permission rules configured in settings files can promote specific tools or action patterns to auto-allow status, bypassing the confirmation step. The system context describes this distinction to CC so it can correctly interpret its own permission environment at startup.

**Denial handling protocol**: When a tool call is blocked by a permission rule, the system context instructs CC on a specific response protocol — attempt reasonable alternatives using other available tools, respect the intent behind the denial, and escalate to the user if no acceptable alternative exists. This protocol is embedded at the system level and applies regardless of what CLAUDE.md or user instructions say about tool use.

**Hook event integration**: The system context acknowledges the existence of hook events that fire around tool invocations (before and after execution). Hook-generated signals can influence CC's behavior within a turn. The daemon configuration reload event indicates that hook and permission configurations can be updated at runtime without restarting the session.

**MCP server context**: Configured MCP servers are surfaced to CC as part of the live build snapshot injected into the system context. CC is instructed to consult this live list when answering questions about available MCP integrations, rather than relying on training-data assumptions about what servers might be configured.

**System-reminder tag handling**: The system context includes a structured tag format for delivering side-question prompts to lightweight parallel agent instances. These tagged sections carry their own constraint set (no tools, single-turn, no follow-up) and are processed as self-contained instruction contexts rather than extensions of the main conversation.

**Context compression behavior**: The autonomous loop instructions reference a "compact" event as a trigger condition, indicating the system context accounts for context window compression during long-running sessions. Post-compact behavior (re-expanding the full loop instructions on first fire after compaction) is handled automatically by the sentinel value mechanism described in the loop protocol.

**Background process management**: Telemetry events in the bundle indicate the permission layer includes process-level controls — signal escalation for hung background processes, low-memory condition handling, and spare instance lifecycle management (enable, claim, claim failure). These are infrastructure-level behaviors below the user-facing permission model but part of the same system context assembly.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.157 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| h | Dashboard UI script assembler (collapsible sections, clipboard copy, timezone histogram) |
| L | SQL keyword reference assembler + side-question system-reminder tag template |
| $ | Coordinator subagent usage examples (with notification turn model) + PostgreSQL type keyword list |
| O | Non-coordinator (simple) subagent usage examples + workflow block property list |
| E | Autonomous loop operational instructions (timer, monitor arming, sentinel prompt, stop protocol) |
| M | Subagent prompt-writing guidelines (context briefing, delegation anti-patterns) |
| b | Subtask block property constant list |
| G | Pseudoreference code constant list |
| S | Validation and auto-numeration rule ID constant list |
| X | Dataset event constant list (dse* and re* event names, route event constants) |
| Y | Daemon configuration reload telemetry event handler |
| w | Background process lifecycle telemetry handler (SIGKILL escalation, low-memory, spare instance management) |
| lL6 | Assembler call stub (no large strings, no telemetry) |
| f | Assembler call stub (no large strings, no telemetry) |
| P | Assembler call stub (no large strings, no telemetry) |
| j | Assembler call stub (no large strings, no telemetry) |
| z | Assembler call stub (no large strings, no telemetry) |
| J | Assembler call stub (no large strings, no telemetry) |
| C | Assembler call stub (no large strings, no telemetry) |
| y | Assembler call stub (no large strings, no telemetry) |
| k | Assembler call stub (no large strings, no telemetry) |
| V | Dashboard UI stylesheet assembler (layout, card components, histogram styling) |
| D | PostgreSQL SQLSTATE error code reference list + spare instance spawn telemetry |
| ri_ | Tool denial response protocol instruction block |
| IG_ | Autonomous loop check instructions (scope policy, PR maintenance, repeated invocation handling) |
| ywK | Live documentation URL reference table (configuration, extensibility, workflows, deployment) |
| KDK | Files API Python reference and code examples |
| qh5 | Batch parallel work orchestration protocol (plan-then-spawn phasing, worker instructions, progress tracking) |
| CwK | CC configuration self-help protocol (live build priority, documentation fetch strategy, staleness handling) |
| EDK | Claude Platform on AWS reference (SigV4 auth, model ID conventions, client setup, IAM guidance) |