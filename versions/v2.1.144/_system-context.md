---
type: system-context
command: _system-context
cc_version: "2.1.144"
updated: "2026-05-19"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.144 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.144 System Context

> Analysis basis: CC v2.1.144 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.144 system context is assembled by combining the outputs of multiple dedicated assembler functions, each responsible for a distinct behavioral domain: role and voice declaration, action safety policy, tool permission mechanics, plan-mode workflow, autonomous operation rules, and specialized skill handlers (browser automation, batch orchestration, loop scheduling, memory consolidation, and various API reference skills). This layered assembly means the effective system prompt seen by the model is not a single static string but a composite constructed at runtime from modular components. User instructions and CLAUDE.md content are injected into this composite but operate within the constraints and defaults the assembled system context establishes. Understanding the modular structure helps explain why certain behaviors appear immutable while others are clearly tunable.

---

## Hardcoded Constraints

- **Plan-mode execution freeze**: When plan mode is active, the model is categorically prohibited from making any edits to any file except the designated plan file, running any tool that has side effects (including configuration changes and version-control commits), or otherwise altering system state. This constraint overrides all other instructions the model may have received, including user instructions issued earlier in the session. There is no authorization path that permits bypassing this freeze while plan mode remains active.

- **Risky-action confirmation requirement**: A hardcoded policy classifies actions by reversibility and blast radius. Actions affecting shared infrastructure, publishing content externally, destroying data, force-pushing version history, or sending communications on the user's behalf are designated as requiring explicit user confirmation before execution. A single prior approval does not constitute standing authorization; each occurrence in a new context requires fresh confirmation unless the user has issued a durable, scoped authorization in a file such as CLAUDE.md. This constraint exists at the system layer and cannot be silently bypassed by conversational instruction.

- **Destructive-shortcut prohibition**: The model is explicitly barred from using destructive operations as a workaround when encountering obstacles. Suppressing safety checks, deleting unexpected files without investigation, or discarding uncommitted work to resolve a conflict are categorically disallowed. The policy mandates root-cause investigation before any destructive remediation.

- **Denied-tool workaround scope limit**: When a tool invocation is denied, the model may attempt to accomplish the same goal through functionally equivalent means (e.g., using a different read utility), but is prohibited from using the denial as a prompt to exploit unrelated capabilities in ways that circumvent the intent of the restriction. If the capability is genuinely required, the model must halt and surface the situation to the user rather than proceeding covertly.

- **Autonomous-loop scope boundary**: During timer-driven autonomous operation (when the user is away), the model is constrained to continuing work that is demonstrably already in motion based on the conversation transcript. Initiating new work, making irreversible changes without clear prior authorization, or narrating hypothetical future actions when there is nothing actionable are all prohibited behaviors in this mode.

- **Browser-automation dialog prohibition**: The browser automation skill layer hardcodes a prohibition against triggering JavaScript alert, confirm, or prompt dialogs through any automated action, because such dialogs block the extension event loop. This is not a stylistic preference but a functional constraint embedded in the skill's instruction set.

- **Memory consolidation write scope**: During the memory-consolidation dream skill, the model is restricted to writing only within the designated memory directory. Broad transcript reads are prohibited; only narrow, targeted grep-style lookups are sanctioned to avoid excessive context consumption.

---

## Default Behaviors

- **Response length and tone**: By default CC targets the shortest response that is complete and accurate for the given context, scaling length upward only when complexity or stakes warrant it. Users can influence this by explicitly requesting more or less detail, or by establishing length preferences in CLAUDE.md.

- **Confirmation prompting for consequential actions**: The default is to pause and confirm before executing actions classified as risky (irreversible, externally visible, or destructive). Users can shift this default toward more autonomous operation by explicitly granting broader authorization, either conversationally or in CLAUDE.md. Even with that shift, the model is expected to remain attentive to risk rather than operating blindly.

- **Plan-file iterative workflow**: When plan mode is engaged, the default workflow involves an explore-update-ask loop: read code to build context, write findings incrementally into the plan file, and surface ambiguities to the user before proceeding. Users can influence the depth and cadence of this loop by providing richer upfront context, reducing the number of clarifying questions needed.

- **Autonomous PR maintenance priority**: During autonomous operation, the default priority order is: (1) continue in-progress work from the active conversation, (2) address open PR review threads and failing CI, (3) sweep for bugs or simplifications when everything else is idle. Users can narrow or expand this scope by adjusting what is established in the conversation transcript before going idle.

- **Loop scheduling default interval**: The `/loop` skill applies a system-defined default recurrence interval when the user does not specify one. Users can override this by supplying an explicit interval in the standard `[interval] <prompt>` syntax.

- **Browser tab handling**: At the start of each browser automation session, the default behavior is to query current tab context before creating new tabs. Users can direct the model to work with a specific existing tab by naming it explicitly.

- **Advisor consultation cadence**: The advisor tool skill defaults to requiring a consultation before substantive work begins and again before declaring a task complete, with at least one check-in for multi-step tasks. Users working on short reactive tasks implicitly reduce this cadence by keeping tasks small and tool-output-driven.

- **Git rebase over merge**: When the model detects that a branch has diverged from its base during autonomous operation, the default is to rebase rather than merge, preserving a clean linear history. This default can be overridden by project-level conventions specified in CLAUDE.md.

---

## CLAUDE.md Redundancy Warning

- **Action confirmation policy**: The system context already encodes a detailed risk-classification framework for confirming destructive, irreversible, or externally visible actions. Adding a generic "always ask before pushing" instruction to CLAUDE.md is redundant with existing defaults. However, adding a *scoped* authorization (e.g., "you may push to feature branches without confirmation") is additive and meaningful — it shifts the default for a specific action class.

- **Response conciseness**: The system voice layer already instructs CC to default to brief, complete responses and avoid padding. Reiterating "be concise" in CLAUDE.md is neutral redundancy. Conflicting instructions (e.g., "always provide extensive step-by-step explanations") may override the default or create tension depending on instruction priority resolution.

- **Avoid over-engineering**: The voice and values layer already encodes a preference for directness and doing the work before surfacing it, which implicitly discourages speculative or verbose output. Instructions in CLAUDE.md that mirror this (e.g., "don't add unnecessary abstractions") are redundant. Instructions that contradict it (e.g., "always include multiple implementation alternatives") may produce inconsistent behavior.

- **Honesty and uncertainty acknowledgment**: The system voice layer hardcodes a policy of stating uncertainty plainly rather than hedging. Adding "admit when you don't know" to CLAUDE.md duplicates an existing default and has no practical effect. It cannot produce a conflict because it aligns with the embedded policy.

- **External-action confirmation**: The risky-action policy in the system context already covers the domain of "ask before sending messages, posting to services, or modifying shared infrastructure." CLAUDE.md entries that restate this for specific services (e.g., "always confirm before posting to Slack") are redundant but harmless. They become meaningful only if they *expand* the default (granting pre-authorization for a specific channel) or *narrow* it (requiring confirmation even for actions the system context would permit without it).

- **Plan-mode behavior**: The plan-mode workflow (explore → update plan → ask user) is fully specified in the system context. Attempting to redefine plan-mode behavior in CLAUDE.md is likely to create instruction conflict rather than clean override, because the system context explicitly states that plan-mode restrictions supersede other instructions.

---

## User Actionable Insights

1. **Plan-mode restrictions are unconditional.** No user instruction, including instructions placed in CLAUDE.md, can authorize file edits or side-effecting tool calls while plan mode is active. If a workflow requires edits during planning, plan mode must be exited first.

2. **Single-instance approval does not generalize.** Approving a risky action (such as a force-push or external post) in one context does not create standing permission. Unless a durable, scoped authorization exists in CLAUDE.md, CC will re-confirm in each new context. Users who want fewer confirmation prompts should encode explicit scoped permissions in CLAUDE.md rather than expecting conversational approvals to carry forward.

3. **CLAUDE.md is most valuable for scoped overrides, not re-statements.** The system context already handles conciseness, honesty, confirmation defaults, and code quality. CLAUDE.md entries that restate these add no value. Entries that scope, extend, or narrow them (e.g., granting pre-authorization for a specific class of action, or specifying project-specific conventions) are genuinely additive.

4. **Autonomous mode is bounded by transcript evidence.** CC in autonomous/timer mode will not invent new work. The quality of autonomous operation is therefore directly proportional to how clearly the active conversation establishes what is in progress. Users who want effective autonomous sessions should ensure the transcript contains explicit statements of intent before going idle.

5. **Denied tools cannot be circumvented through capability exploitation.** If a tool is denied, CC is instructed to attempt only reasonable functional equivalents and to halt and report if the capability is truly required. Users who encounter unexpected halts after a denial should treat this as a signal to grant the specific permission, not as a bug.

6. **Browser automation sessions are stateless across sessions.** Tab IDs from previous sessions are never reused. Users scripting multi-session browser workflows must account for fresh tab-context queries at the start of each session.

7. **The loop skill's default cadence is system-defined and version-specific.** The default interval applied when no interval is specified in a `/loop` invocation is set in the v2.1.144 bundle. This value may change across versions. Users relying on a specific cadence should always supply an explicit interval rather than depending on the default.

8. **The advisor tool consultation pattern is a skill-layer default, not a hard constraint.** It can be influenced by task structure. Users who want fewer advisor interruptions on short tasks can keep tasks focused and tool-output-driven; the skill's own guidance acknowledges reduced value on short reactive tasks.

9. **Memory consolidation is a sandboxed operation.** The dream skill writes only within the designated memory directory and reads transcripts only through narrow targeted lookups. Users should not expect this skill to perform broad codebase analysis or cross-project synthesis — it is scoped to the memory store.

10. **Version-specific behavior exists in loop scheduling and batch orchestration.** The worker count ranges, cron rounding rules, and self-pacing delay guidance embedded in the v2.1.144 bundle are specific to this version. Users comparing behavior across CC versions should treat scheduling semantics as potentially version-variable.

---

## Tool & Permission Layer

The system context encodes a two-tier permission model for tool execution. Tools are classified at invocation time based on whether they have local-only reversible effects (read operations, local file edits, test runs) or whether they carry risk of irreversible or externally visible consequences. The first tier is auto-permitted; the second tier triggers a confirmation prompt unless a scoped pre-authorization is in effect.

When a tool call is explicitly denied, the permission layer injects a behavioral instruction that constrains how the model may respond to the denial: reasonable functional alternatives are permitted, but exploitation of unrelated capabilities to bypass the intent of the denial is prohibited. If no reasonable workaround exists, the model is required to surface the situation to the user and halt.

The system context also describes the behavior of hook events in the autonomous operation mode. Timer-driven invocations are treated as a fallback heartbeat; event-driven wake signals (such as CI completion notifications arriving as task-notification messages) take priority and reset the safety-net timer without requiring a full loop restart.

MCP server integrations are referenced in multiple skill contexts (browser automation via `mcp__claude-in-chrome__*` namespaced tools, Slack integration for the stuck-session diagnostic skill). The system context treats MCP tool availability as conditional — skills that depend on MCP tools include fallback behaviors for when those tools are not loaded.

The context compression and system-reminder tag mechanism is acknowledged implicitly through the plan-mode and autonomous-loop skills, which instruct the model to re-read the conversation transcript on each invocation. This design pattern is intended to maintain behavioral continuity across context windows where early instructions may have been compressed or summarized.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.144 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| A | Primary system context assembler; contains plan-mode prompts, PowerShell verb list, SAS/Maxima function lists, remote-control CLI help, and macOS plist template |
| ISq | System context assembler stub (no large strings; likely a conditional branch or empty-context path) |
| b6 | System context assembler stub (no large strings; likely utility or passthrough role) |
| OU7 | System context assembler stub (no large strings; likely conditional or version-gate function) |
| l | System context assembler stub (no large strings) |
| _H | System context assembler stub (no large strings) |
| t | System context assembler stub (no large strings) |
| e | System context assembler stub (no large strings) |
| zH | System context assembler stub (no large strings) |
| d | System context assembler stub (no large strings; very early bundle position suggests foundational utility) |
| q | Language keyword/built-in registry assembler; contains Maxima, Rust, and session-analysis JSON schema strings |
| WC_ | Denied-tool behavioral instruction injector |
| DS_ | Autonomous loop (steward-mode) behavioral policy assembler |
| xeq | Files API Python reference skill assembler |
| O15 | Batch parallel work orchestration skill assembler |
| teq | Claude Platform on AWS reference skill assembler |
| z95 | Dynamic self-pacing loop skill assembler (no-interval/event-gated mode) |
| ceq | Claude API Ruby reference skill assembler |
| B15 | Stuck-session diagnostic skill assembler |
| ao9 | Claude-in-Chrome browser automation skill assembler (instance A) |
| mk_ | Claude-in-Chrome browser automation skill assembler (instance B; duplicate content, likely for different invocation context) |
| a26 | Memory consolidation dream skill assembler |
| $95 | Fixed-interval loop scheduling skill assembler |
| uB7 | Risky-action confirmation and blast-radius policy assembler |
| mHK | Message Batches API TypeScript reference skill assembler |
| UHK | Files API TypeScript reference skill assembler |
| v99 | Advisor tool behavioral policy assembler |
| ttq | Server/API change verification pattern skill assembler |
| atq | CLI change verification pattern skill assembler |
| Kvq | Voice and values identity layer assembler |