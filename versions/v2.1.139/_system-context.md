---
type: system-context
command: _system-context
cc_version: "2.1.139"
updated: "2026-05-18"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.139 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.139 System Context

> Analysis basis: CC v2.1.139 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.139 system context is assembled by combining multiple distinct function outputs at runtime, each contributing a different behavioral layer: role declaration, tool permission policy, task-execution guidance, agentic orchestration instructions, and skill/MCP surface definitions. The resulting composite prompt governs how CC interprets user instructions, interacts with tools, delegates to subagents, and handles autonomous operation. User instructions and CLAUDE.md content are layered on top of this foundation but cannot override hardcoded constraints baked into the assembled context. Several behavioral defaults — particularly around agentic caution, tool confirmation, and output style — are pre-configured here and only need CLAUDE.md entries when a project genuinely departs from those defaults.

---

## Hardcoded Constraints

- **Tool denial response policy**: When CC is denied permission to use a specific tool, it is instructed to attempt the goal through reasonable alternative tools if such alternatives exist, but is explicitly prohibited from using permissioned capabilities (such as test execution) as a vector to perform unrelated or unauthorized actions. The line between legitimate workaround and intent circumvention is treated as an absolute constraint, not a judgment call.

- **Autonomous operation scope boundary**: During autonomous (timer-driven, user-absent) loops, CC is constrained to act only on work already established in the conversation transcript. Initiating new work, making irreversible changes without clear prior authorization, or pushing changes without confirming no one else has modified the branch are treated as trust-eroding behaviors to be avoided. This boundary is framed as a non-negotiable stewardship principle, not a soft default.

- **Subagent isolation requirement**: When spawning background worker agents for parallel batch operations, CC is required to use isolated worktrees and ensure each agent's prompt is fully self-contained. Agents are not permitted to rely on shared state with sibling units. This isolation requirement is architectural, not advisory.

- **Browser automation dialog prohibition**: CC is unconditionally blocked from triggering JavaScript alert, confirm, or prompt dialogs through browser automation actions. This restriction is absolute; there is no authorization pathway to override it, because such dialogs block all subsequent browser events and render the automation session unrecoverable.

- **Diagnostic-only process investigation**: When investigating potentially stuck or frozen sessions, CC is constrained to observation and reporting only. Sending signals to or killing other processes is explicitly outside the permitted action space, regardless of user instruction.

- **Tool denial transparency requirement**: If CC determines that a denied capability is genuinely essential to completing the user's request (and no reasonable workaround exists), it is required to stop and explain what it was attempting and why the permission matters, rather than silently degrading or fabricating a result. This transparency obligation is not user-configurable.

---

## Default Behaviors

- **Autonomous loop verbosity**: By default, when autonomous checks find nothing actionable, CC is configured to report this in a single brief sentence and stop — not to produce a summary of what was checked or speculate about future actions. Users can influence the loop's scope and cadence by adjusting the interval or prompt passed to the loop scheduler, but the minimal-output-on-idle behavior is the embedded default.

- **Agentic escalation threshold**: CC defaults to waiting for user input rather than proceeding when a situation falls ambiguously between "continuing established work" and "inventing new scope." This conservative default can be shifted by providing explicit written authorization in the conversation or CLAUDE.md for specific categories of autonomous action.

- **Parallel batch orchestration flow**: For large parallelizable changes, CC defaults to a three-phase pattern: research and planning (with explicit user approval gate), parallel worker spawning, and tracked progress reporting with a status table. Users can influence decomposition granularity and the end-to-end verification recipe, but the approval-gate structure is the default posture.

- **E2E verification before worker dispatch**: CC defaults to requiring a concrete, executable end-to-end test recipe before spawning batch workers. If no such path is discoverable, the default is to ask the user rather than skip verification. This behavior can be explicitly waived by the user during the planning phase, but the default is to seek verification.

- **Browser session startup context check**: CC defaults to querying the current browser tab state at the start of every automation session before taking any action. Users can redirect this to a specific tab by explicit instruction, but the context-first default is always applied.

- **Git history hygiene in autonomous mode**: When a branch has fallen behind its base during autonomous PR maintenance, CC defaults to rebasing rather than merging. This is a pre-set convention, though project-level CLAUDE.md can potentially specify an alternative merge strategy.

- **Loop self-pacing fallback cadence**: When no event-based wake signal is armed, the autonomous loop defaults to a relatively conservative heartbeat interval (on the order of twenty to thirty minutes) to avoid unnecessary overhead outside the prompt cache window. Users can tune this via the interval parameter passed to the loop scheduler.

- **Browser automation failure threshold**: CC defaults to stopping and requesting user guidance after two to three consecutive failed browser tool calls, rather than retrying indefinitely or exploring unrelated pages. Users cannot lower this threshold through CLAUDE.md but can raise it by explicitly instructing persistence.

---

## CLAUDE.md Redundancy Warning

- **Agentic caution and conservative scope**: The system context already embeds detailed guidance about avoiding unsanctioned new work during autonomous operation and erring toward waiting when scope is ambiguous. Adding generic "be careful" or "ask before acting" instructions to CLAUDE.md is fully redundant. Conflicting instructions that push toward more aggressive autonomy may partially override the conservative default and should be written with precision.

- **Subagent prompt completeness**: The instruction that each spawned agent's prompt must be fully self-contained — including goal, file scope, conventions, and verification recipe — is already present in the system context. CLAUDE.md entries repeating this are neutral at best; entries that contradict it (e.g., instructing agents to share state) will create instruction conflict.

- **Git rebase-over-merge preference**: The default preference for rebase over merge in PR maintenance workflows is already set. CLAUDE.md entries specifying rebase are redundant. Entries specifying merge-only workflows will override the default and may produce unintended history shapes if the user has not considered all autonomous-operation scenarios.

- **Minimal output on idle autonomous loops**: The default single-sentence idle response is already configured. CLAUDE.md instructions asking CC to "always summarize what was checked" directly conflict with this default and will produce verbosity the system prompt is specifically designed to suppress.

- **Browser tab context-first behavior**: The system context already mandates checking tab state before every automation session. Adding equivalent CLAUDE.md instructions is redundant. Contradictory instructions (e.g., "always reuse the last active tab") will conflict and may produce inconsistent behavior depending on instruction precedence.

- **Tool denial transparency**: The requirement to stop and explain when a denied tool is essential is already embedded. CLAUDE.md instructions telling CC to "never stop mid-task" may conflict with this mandatory transparency behavior.

---

## User Actionable Insights

1. **The tool-denial workaround boundary is fixed.** CC will attempt reasonable alternative tools when denied a specific capability, but it will not use unrelated permissioned capabilities as a workaround vector. No CLAUDE.md instruction can authorize this pattern. Design your permission grants with this in mind.

2. **Autonomous loop scope is transcript-bound by design.** Work that wasn't established in the conversation before the loop started will not be picked up autonomously. If you want CC to handle a category of work proactively, establish it explicitly in the conversation before going away — don't rely on CLAUDE.md alone to expand autonomous scope.

3. **The approval gate in batch orchestration is not skippable by default.** CC will pause for plan approval before spawning workers. If you want fully non-interactive batch runs, you must explicitly authorize auto-approval in the conversation; there is no CLAUDE.md flag to disable this gate permanently.

4. **Browser dialog-triggering actions are absolutely blocked.** No instruction — user, operator, or CLAUDE.md — can authorize CC to trigger JavaScript modal dialogs during browser automation. Design any browser-automation workflows to avoid dialog-dependent confirmation patterns entirely.

5. **Idle loop verbosity suppression is intentional.** If your monitoring setup expects rich status messages on every loop tick, you will need to add explicit output instructions — but be aware that very verbose loop output conflicts with the embedded default and may produce unpredictable formatting across ticks.

6. **Rebase is the autonomous git default.** If your project uses a merge-only policy, specify this in CLAUDE.md explicitly; otherwise autonomous PR maintenance will produce rebased history.

7. **The e2e verification ask is a feature, not friction.** When CC stops during batch planning to ask how to verify a change end-to-end, it is following an embedded policy designed to prevent unverified parallel deployments. Providing a clear e2e recipe upfront (in your initial batch instruction) skips this pause entirely.

8. **Three consecutive idle loop results trigger automatic scope reduction.** If your autonomous loop genuinely has nothing to do across three consecutive invocations, CC will self-reduce to minimal checking. This is not a bug; it is an embedded efficiency policy. Restart the loop with a more targeted prompt if the reduction happens prematurely.

9. **Diagnostic commands against other CC processes are read-only.** CC cannot be instructed to terminate or signal other processes even if they appear stuck. The `/stuck` skill is purely observational; any remediation requires the user to act directly.

10. **Version specificity matters for these constraints.** All behaviors documented here reflect v2.1.139 specifically. The obfuscated function identifiers in the Appendix will change across versions, and behavioral policies may be added, relaxed, or tightened in future bundles. Re-analyze after significant version bumps.

---

## Tool & Permission Layer

The system context embeds a multi-mode permission model that CC applies before executing any tool call. Two primary modes are described: an auto-allow mode, in which categories of pre-cleared tool actions proceed without per-call confirmation, and a prompt-to-allow mode, in which individual tool invocations require explicit user confirmation before execution. The boundary between these modes is configurable at the session or project level but has a conservative default (prompt-to-allow for consequential actions).

When a tool invocation is denied — either because the mode requires confirmation and the user declines, or because the action falls outside the permitted scope — CC is instructed to evaluate whether a reasonable alternative tool can achieve the same goal. If one exists, it may attempt it. If no reasonable alternative exists and the capability is essential, CC must surface this to the user and stop rather than proceed degraded or silently.

Hook event handling is described within the autonomous operation context: event-based monitors can be armed with persistence flags, and when a monitored event fires (such as CI completion, log pattern match, or file change), the autonomous loop is woken immediately rather than waiting for a timer expiry. The system context instructs CC to arm such monitors at most once per loop iteration and to check for an already-running monitor before arming a new one, preventing monitor proliferation.

MCP server tool surfaces (such as browser automation tools and Slack integration tools) are referenced by namespaced identifiers within skill definitions embedded in the system context. CC is instructed to use tool-search mechanisms to locate MCP tools that may not be pre-loaded, rather than assuming availability. The system-reminder tag pattern (used for injecting contextual notices mid-conversation, such as context compression warnings) is part of the assembled context machinery and signals to CC that certain metadata messages are system-generated rather than user-authored.

Context compression notices are handled as a recognized signal type: when CC receives a compression notice, it is expected to continue operating with the compressed context without treating the compression itself as an error or requesting clarification.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.139 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `$` | Assembler: subagent orchestration examples + PostgreSQL type keyword list |
| `T` | Assembler: pseudoreference code constants (reference/replication system) |
| `R` | Assembler: validation and business-rule ID constants |
| `lO` | Assembler: system context contributor (no large strings; structural/glue role) |
| `Q_` | Assembler: system context contributor (no large strings; structural/glue role) |
| `lRq` | Assembler: system context contributor (no large strings; structural/glue role) |
| `WY` | Assembler: system context contributor (no large strings; structural/glue role) |
| `D6` | Assembler: system context contributor (no large strings; structural/glue role) |
| `z` | Assembler: system context contributor (no large strings; structural/glue role) |
| `YU7` | Assembler: system context contributor (no large strings; structural/glue role) |
| `wU7` | Assembler: system context contributor (no large strings; structural/glue role) |
| `d_` | Assembler: system context contributor (no large strings; structural/glue role) |
| `OU7` | Assembler: system context contributor (no large strings; structural/glue role) |
| `HQ_` | Assembler: system context contributor (no large strings; structural/glue role) |
| `f88` | Assembler: system context contributor (no large strings; structural/glue role) |
| `CnH` | Assembler: system context contributor (no large strings; structural/glue role) |
| `zU7` | Assembler: system context contributor (no large strings; structural/glue role) |
| `oRq` | Assembler: system context contributor (no large strings; structural/glue role) |
| `aRq` | Assembler: system context contributor (no large strings; structural/glue role) |
| `q` | Assembler: language keyword/built-in lists (Maxima CAS, Rust stdlib, session analysis schema) |
| `Y` | Assembler: PostgreSQL SQLSTATE error code enumeration |
| `by_` | Assembler: tool-denial response policy and workaround boundary instruction |
| `KD_` | Assembler: autonomous loop behavioral policy (stewardship scope, PR maintenance, idle handling) |
| `Blq` | Assembler: Files API skill definition — Python (upload, use, manage) |
| `Lr7` | Assembler: batch parallel orchestration skill (plan/spawn/track phases) |
| `qnq` | Assembler: Claude Platform on AWS skill definition (SigV4, IAM, client setup) |
| `fo7` | Assembler: loop scheduler skill (`/loop` command parsing and self-pacing logic) |
| `olq` | Assembler: Claude API skill definition — Ruby (messages, streaming, tool use) |
| `ur7` | Assembler: `/stuck` diagnostic skill (frozen session investigation and Slack reporting) |
| `y61` | Assembler: Claude-in-Chrome browser automation skill (GIF recording, dialog policy, tab context) |