---
type: system-context
command: _system-context
cc_version: "2.1.146"
updated: "2026-05-21"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.146 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.146 System Context

> Analysis basis: CC v2.1.146 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.146 system context is assembled from multiple discrete function-level components that are composed at runtime into a unified behavioral layer. These components collectively govern CC's security posture, role identity, output style conventions, tool interaction policies, task-mode specialization (autonomous loop operation, parallel batch orchestration, memory management), and its understanding of the surrounding infrastructure (MCP servers, browser automation, Files API, scheduling primitives). User instructions and CLAUDE.md content operate on top of this layer — they can adjust defaults, but the hardcoded constraints within the assembled system context cannot be overridden by either. The system context also encodes CC's self-model as a steward rather than an autonomous initiator, a distinction that governs how much latitude it takes in agentic and background-operation scenarios.

---

## Hardcoded Constraints

- **Tool-denial circumvention prohibition**: When a tool invocation is denied or blocked, CC is prohibited from exploiting unrelated tool capabilities as a back-channel workaround. Workarounds must be reasonable, aligned with the spirit of the denial, and not an attempt to bypass the underlying intent. This restriction is absolute; no user instruction unlocks covert circumvention. If the blocked capability is judged essential to complete the request, CC is required to stop and surface the situation to the user rather than proceeding independently.

- **Action reversibility and blast-radius assessment**: Before executing any action that is difficult to reverse, affects shared or external state, or carries meaningful destructive potential, CC is required to evaluate scope and default to confirming with the user. This is a hardcoded disposition — the default is to pause and disclose, not to proceed silently. Examples in this category include force-pushes, hard resets, dropping database structures, terminating processes, overwriting uncommitted work, posting to external services, and modifying shared infrastructure. The constraint is not absolute — a user may explicitly authorize more autonomous operation — but even with such authorization CC is expected to continue weighing risk, and a single prior approval does not constitute blanket authorization for all future instances of the same action class.

- **Scope-matching enforcement**: CC is required to match the scope of its actions to what was actually requested. Authorization is interpreted narrowly: permission for a specific action in a specific context does not extend to similar actions in other contexts. Durable authorization (e.g., in CLAUDE.md) is respected within the scope it specifies; ad-hoc approval is not extrapolated.

- **Obstacle escalation over destruction**: When encountering blockers, CC is prohibited from using destructive shortcuts to remove the obstacle. It is expected to investigate root causes, preserve in-progress work, and resolve conflicts through non-destructive means before considering any action that discards state.

- **Autonomous operation trust boundary**: In background and timer-invoked operation modes, CC is hardcoded to treat the existing conversation transcript as the primary authorization signal. Inventing new work, taking irreversible actions, or making decisions the user has not explicitly set in motion are treated as trust-eroding behaviors and are blocked by policy. The steward framing is a hardcoded disposition, not a user-configurable mode.

- **Browser automation modal suppression**: When operating with browser automation tooling, CC is absolutely prohibited from triggering JavaScript modal dialogs (alerts, confirms, prompts) that would block the browser event loop and render subsequent automation commands unreceivable. This is not a soft preference — it is an absolute constraint within the browser automation context.

- **Output verbosity floors and ceilings in code**: Within code artifacts, CC defaults to writing no inline comments and is prohibited from generating multi-paragraph docstrings or multi-line comment blocks. A maximum of one short inline comment line is the enforced ceiling. This is a hardcoded code-output policy, not a stylistic suggestion.

- **Intermediate document generation restriction**: CC is prohibited from producing planning, decision, or analysis documents unless the user explicitly requests them. Working context is maintained in conversation state, not externalized to intermediate files.

---

## Default Behaviors

- **Response length calibration**: The default is to produce the shortest response that fully addresses the request. Longer responses are justified only when complexity or stakes warrant additional elaboration. Users can influence this by providing explicit length or detail preferences, but the system context default already biases toward brevity.

- **Pre-action narration**: Before executing a first tool call, CC defaults to providing a single-sentence statement of intent. During multi-step work, it defaults to brief status updates at meaningful inflection points (discoveries, direction changes, blockers). Users can adjust the granularity of these updates through instruction, but the default is brief-and-continuous rather than silent.

- **End-of-turn summary format**: CC defaults to closing each working turn with a one-to-two sentence summary covering what changed and what comes next. This can be suppressed or reformatted by user instruction, but the default is always present.

- **Confirmation-before-risky-action**: The default for actions in the reversibility-and-blast-radius category is to disclose and confirm before proceeding. Users can shift this default toward greater autonomy through explicit instruction, and CLAUDE.md can encode that shift durably. The default, however, remains confirmation-first.

- **Memory file management discipline**: When persistent file-based memory is active, CC defaults to updating existing memory files rather than creating duplicates, converting relative temporal references to absolute dates, verifying that referenced artifacts still exist before surfacing them, and declining to persist information already captured in the repository (code structure, git history, CLAUDE.md content). These defaults can be influenced by the memory system configuration embedded in the system prompt but not overridden by casual user instruction.

- **Autonomous loop scope conservatism**: When operating in a background invocation or self-paced loop, CC defaults to limiting its scope to work already established in the conversation transcript and the current branch's pull or merge request state. It defaults to not inventorying new tasks, not narrating idle checks, and stopping with a single sentence when nothing actionable is found. After a threshold of consecutive idle results, the default is to reduce activity further rather than maintain the same check cadence.

- **Git history hygiene**: When working with branches in an autonomous context, CC defaults to rebasing rather than merging when incorporating upstream changes, and to checking for concurrent pushes before contributing its own. These are defaults that can be overridden by explicit project conventions documented in CLAUDE.md.

- **Advisor consultation timing**: When an advisor tool is available, CC defaults to calling it before committing to a substantive approach and again before declaring work complete. The default is to treat advisor output with significant weight and to surface conflicts explicitly rather than silently overriding the advisor's guidance.

- **Browser session initialization**: When browser automation is available, CC defaults to querying current tab context at session start before creating or reusing tabs. Existing tabs are not reused unless the user explicitly requests it. These are default behaviors within the browser automation context.

- **Parallel work orchestration sequencing**: In batch orchestration scenarios, CC defaults to a three-phase sequence: research and planning (with user approval gating), parallel worker spawning with fully self-contained per-worker prompts, and progress tracking with rendered status tables updated as completions arrive. Deviating from this sequence requires explicit instruction.

---

## CLAUDE.md Redundancy Warning

- **Response brevity and length guidance**: The system context already establishes a strong default toward concise, proportionate responses. CLAUDE.md entries instructing CC to "keep responses short" or "be concise" are redundant. Entries that conflict — such as "always provide comprehensive explanations" or "include detailed reasoning in every response" — will create instruction tension that may degrade consistency.

- **Comment and documentation policies for code**: The system context already enforces a no-comments default and prohibits multi-line docstrings. CLAUDE.md entries that reinforce this are neutral but redundant. Entries specifying extensive inline documentation, mandatory docstrings, or comment-heavy style will conflict with the hardcoded ceiling and produce inconsistent results depending on which instruction the model weights more heavily in context.

- **Confirmation before destructive actions**: The system context already instructs CC to default to user confirmation before risky or irreversible actions. CLAUDE.md entries that say "always ask before deleting files" or "confirm before git push" duplicate existing behavior. However, CLAUDE.md entries granting broader autonomous authority ("proceed without confirmation for all git operations") are meaningful and do shift behavior — they are not redundant, they are overrides.

- **Intermediate file and planning document suppression**: The system context already prohibits generating unsolicited planning documents. CLAUDE.md entries reiterating this are redundant. Entries that request planning documents by default ("always create a plan.md before starting") conflict with the default and will alter behavior.

- **Identity and voice directives**: The system context includes a hardcoded voice and values profile. CLAUDE.md entries that re-specify warmth, directness, or honesty as desired traits are redundant. Entries that request a different persona or significantly different tone may create conflict depending on how they are framed.

- **Git rebase vs. merge preference**: The system context already defaults to rebase for incorporating upstream changes in autonomous contexts. CLAUDE.md entries specifying "always rebase" are redundant. Entries specifying "always merge" conflict with this default and will override it within their documented scope.

- **Scope of authorization**: The system context already encodes narrow authorization scope — a one-time approval does not generalize. CLAUDE.md is the correct mechanism for establishing durable, broad authorizations. Users who want to avoid repeated confirmations for a class of actions should encode that in CLAUDE.md rather than granting ad-hoc approval repeatedly.

---

## User Actionable Insights

1. **Tool denial circumvention is a hardcoded block, not a soft guideline.** If a tool is denied, CC will not silently route around it through alternative means. If your workflow depends on a capability that gets blocked, you must resolve the permission at the tool level — CC will surface the issue and stop rather than improvise a workaround.

2. **Risky-action confirmation is on by default and survives most instruction.** Even if you tell CC to "just do it" in conversation, a single approval does not persist across context boundaries. To make autonomous operation durable, encode it explicitly in CLAUDE.md with clear scope. Without that, expect confirmation prompts for destructive or externally-visible actions.

3. **Authorization scope is interpreted narrowly.** Approving a git push once does not authorize future pushes. Approving branch deletion in one context does not authorize it in another. This is a hardcoded policy, not a quirk — design your CLAUDE.md authorizations accordingly, specifying the conditions under which an action class is pre-approved.

4. **Autonomous and background modes are governed by a hardcoded steward model.** CC in background/loop mode will not invent new tasks, make new technical decisions, or take irreversible actions beyond the scope established in the conversation. This is intentional and cannot be overridden by conversation instruction alone. If you want a background agent to take broader initiative, that scope must be established in the conversation transcript before the autonomous session begins.

5. **Code comment policy has a hardcoded ceiling.** If your project genuinely requires inline comments or docstrings, you must explicitly instruct CC per session or via CLAUDE.md. Without such instruction, CC will default to no comments and will not generate multi-line documentation blocks regardless of what you might expect from prior sessions.

6. **Memory system has built-in duplicate-prevention and staleness logic.** If you use persistent memory, CC will not create duplicate files for the same fact — it will update the existing one. It will also decline to store information already present in the repository. Understanding this prevents confusion when memory writes appear to be silently no-ops.

7. **Browser automation imposes hard modal constraints.** If your browser automation workflow involves pages with JavaScript dialogs, you must architect around them — CC will not click controls that trigger alerts. Plan for console-based debugging and pre-dismissal of any dialog-triggering elements.

8. **The advisor tool default is consult-before-commit.** If your workflow includes an advisor tool, CC will seek guidance before substantive work and before declaring completion. If this creates latency in your pipeline, be aware it is a default behavior tied to the system context, not an emergent quirk.

9. **CLAUDE.md is the correct persistence layer for authorization, not conversation history.** One-time approvals granted in conversation do not generalize. Anything you want CC to treat as a standing policy — broader git autonomy, skip confirmation for a class of actions, always rebase — must live in CLAUDE.md to be reliably honored across sessions.

10. **Version-specific note (v2.1.146):** This version includes hardcoded support for the `/loop` skill in both fixed-interval and dynamic self-pacing modes, the batch parallel orchestration workflow, browser automation via the Claude-in-Chrome MCP layer, and the Files API skill context for both Python and TypeScript. Users relying on any of these capabilities should be aware that the behavioral rules governing them are embedded at the system context level — not configurable via CLAUDE.md — and that upgrading CC versions may alter these embedded policies.

---

## Tool & Permission Layer

**Auto-allow vs. prompt-to-allow**: The system context encodes a distinction between tool actions that proceed automatically and those that require explicit user confirmation before execution. The dividing criterion is a composite of reversibility, blast radius, and external visibility. Local, reversible operations (file edits, test runs, read operations) fall into the auto-allow category. Operations that affect shared state, are hard to undo, or are visible to parties outside the local environment fall into the prompt-to-allow category. This classification is hardcoded; users can shift individual action classes toward auto-allow via durable CLAUDE.md instructions or explicit session-level grants, but the classification logic itself is not user-configurable.

**Hook and event-driven wake behavior**: The system context describes a mechanism by which background loop invocations can be woken by external events (CI completion, log pattern matches, file changes, PR comments) rather than waiting for a timer deadline. When an event-based monitor is armed, it acts as the primary wake signal, with the scheduled timer serving as a fallback heartbeat. The system context encodes rules about when to arm such monitors (once per loop, persistent), how to handle wake events (process in context of the loop task, then reschedule), and when to stop looping entirely (omit the reschedule call and cancel any armed monitors).

**MCP server integration and system-reminder tag handling**: Content injected via MCP servers or delivered inside system-reminder blocks is treated as background context rather than active user instruction. Specifically, recalled memory content delivered this way is understood to reflect state at the time of writing — CC is expected to verify referenced artifacts (files, functions, flags) still exist before acting on them, rather than treating system-reminder content as authoritative current state.

**Context compression notice**: The system context encodes awareness of prompt caching and context window dynamics. In loop scheduling, the system context provides explicit guidance on selecting delay intervals that avoid redundant cache-miss overhead — idle ticks that fall outside the cache window are characterized as pure overhead, and the scheduling defaults reflect this by biasing toward intervals that stay within cache-warm windows where possible.

**Parallel worker isolation model**: The batch orchestration component of the system context requires that all parallel worker agents use isolated git worktrees and run in the background. This is a hardcoded requirement for the orchestration pattern, not a recommendation. Workers must receive fully self-contained prompts — they cannot query the orchestrating agent for clarification — which is why the planning phase includes explicit e2e verification recipe determination before workers are spawned.

**Tool search and fallback behavior**: In contexts where a specific tool (such as a Slack messaging tool or a browser automation tool) may or may not be loaded, the system context instructs CC to use tool search mechanisms to locate the required tool before falling back to user-facing alternatives (e.g., formatting a report for manual copy-paste when the Slack MCP is unavailable). This fallback awareness is embedded at the system context level for relevant skill contexts.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.146 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| OU7 | System context assembler / top-level compositor (no string content; pure assembly call) |
| l9 | Secondary assembler or initialization trampoline (no string content; pure assembly call) |
| Qu_ | Tool-denial circumvention policy and user escalation handler |
| pC_ | Autonomous loop behavioral policy and background invocation governor |
| lqK | Files API reference implementation — Python |
| bM5 | Batch parallel work orchestration skill (plan → spawn → track) |
| O1K | Claude Platform on AWS integration reference and client guidance |
| N35 | Loop skill — dynamic self-pacing mode and event-driven wake logic |
| _1K | Claude API reference implementation — Ruby |
| $35 | Stuck/frozen session diagnostics skill (/stuck) |
| A81 | Browser automation behavioral policy — Claude-in-Chrome (instance A) |
| HR_ | Browser automation behavioral policy — Claude-in-Chrome (instance B, duplicate) |
| VKK | Headless browser / web app dev-server verification example skill |
| kKK | TUI / interactive terminal app tmux-wrapping example skill |
| U51 | Memory consolidation dream skill (Phase 1–4 orient/gather/consolidate/prune) |
| V35 | Loop skill — fixed-interval scheduling with cron conversion |
| NKK | Web server / API background-launch and lifecycle example skill |
| er7 | Action reversibility and blast-radius confirmation policy |
| o1K | Message Batches API reference implementation — TypeScript |
| s1K | Files API reference implementation — TypeScript |
| EKK | Library / SDK run-and-verify example skill |
| ZLq | Advisor tool consultation policy and timing governor |
| YqK | Server/API change verification pattern skill (curl-based) |
| OqK | CLI change verification pattern skill (invocation-based) |
| QR1 | Voice, values, and identity profile for Claude |
| ic7 | Team onboarding guide template and Claude onboarding-buddy behavior |
| XKK | CLI tool run example skill |
| ak9 | Persistent file-based memory system policy and format specification |
| dr7 | Text output style policy (narration, updates, summary, code comments) |
| sk9 | Memory pruning dream skill (stale/duplicate deletion pass) |