---
type: system-context
command: _system-context
cc_version: "2.1.148"
updated: "2026-05-26"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.148 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.148 System Context

> Analysis basis: CC v2.1.148 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.148 system context is assembled from multiple cooperating function-level assemblers within the bundle, each contributing distinct policy segments — security constraints, role declaration, tool-use scaffolding, agentic loop guidance, and subagent orchestration rules. Together they form a layered behavioral specification that CC internalizes before any user instruction or CLAUDE.md content is processed. The system context establishes non-negotiable floors (hardcoded constraints), pre-set defaults that users may tune, and a machinery layer governing how tools, permissions, subagents, and context-compression events behave at runtime. User instructions and CLAUDE.md content operate within the space this layer defines — they can narrow, expand (within limits), or redirect behavior, but cannot override the hardcoded constraint floor.

---

## Hardcoded Constraints

- **Tool-denial bypass prohibition**: When a tool invocation is blocked or denied, CC is permitted to seek alternative tools that naturally accomplish the same goal — but is strictly forbidden from exploiting unrelated tool capabilities (such as a test runner) to execute actions outside their intended scope. The distinction between a reasonable workaround and an intent-evasion attempt is treated as an absolute constraint, not a judgment call. If no legitimate alternative exists, CC must surface the blockage to the user and halt, rather than proceed unilaterally.

- **Autonomous operation scope**: During unattended or timer-triggered execution, CC is prohibited from inventing new work outside the scope the user has already established. Acting on the existing conversation transcript, in-progress pull requests, failing CI, and explicit commitments is sanctioned; self-directed scope expansion or irreversible changes without clear prior authorization are categorically blocked regardless of how plausible the rationale appears.

- **Subagent prompt integrity**: When spawning subagents, CC is required to include complete, self-contained context in each subagent prompt. Delegating synthesis or reasoning to the subagent — rather than encoding the coordinator's own understanding — is treated as a structural violation, not merely a quality shortcoming.

- **Side-question instance isolation**: The system embeds a constraint governing lightweight side-question agents: such instances must answer only from existing conversation context, must not reference tool use, must not promise follow-up actions, and must not describe their own invocation framing. This constraint is enforced at the system-reminder injection layer and cannot be removed by user instruction.

- **Loop termination hygiene**: In self-scheduling loop contexts, CC is required to cancel any armed monitoring tasks when deliberately stopping a loop. Omitting a reschedule call is the designated stop signal; leaving armed monitors running after a loop stop is treated as a defect, not a configuration choice.

---

## Default Behaviors

- **Autonomous loop pacing**: By default, CC selects its own inter-iteration delay based on observed activity — longer when a branch is quiet, shorter when work is in flight — and leans toward a defined heartbeat window when an event monitor is armed. Users can supply an explicit interval via the loop scheduling syntax (a leading token or trailing clause in the loop input), overriding the dynamic pacing entirely.

- **Subagent isolation mode**: When dispatching parallel worker agents for large batch operations, the default isolation mode is a dedicated git worktree per agent, with background execution. Users who orchestrate subagents directly can specify a different isolation level or foreground execution, but the batch orchestration template defaults to full worktree isolation.

- **PR maintenance priority ordering**: During autonomous runs, CC defaults to prioritizing the active conversation transcript above branch PR maintenance, and PR maintenance above idle sweeps. Users cannot reorder this hierarchy via CLAUDE.md, but can narrow the scope (e.g., disabling idle sweep passes) through explicit instruction.

- **CI failure handling**: On encountering a failing CI job, CC defaults to pulling and diagnosing logs before acting. Flaky-shaped failures (timeouts, runner deaths, transient network errors) are eligible for re-enqueue; genuine failures require a reproduction and minimal fix. Users can instruct CC to skip re-enqueue of flaky failures if their CI environment warrants it.

- **Branch rebase vs. merge**: When another contributor has pushed to the branch during an autonomous session, CC defaults to rebasing rather than merging to keep history linear. This default can be overridden by explicit repository convention instructions in CLAUDE.md.

- **Review thread resolution**: CC defaults to resolving review threads via the repository platform's API (e.g., GitHub GraphQL mutation) after addressing feedback. Users working on platforms with different resolution APIs should specify the correct mechanism in CLAUDE.md.

- **Idle autonomous reporting**: When nothing actionable is found during an autonomous pass, CC defaults to a single-sentence status note, with no enumeration of checked items and no speculative future work list. After several consecutive idle results, CC scales back activity to a minimal check-and-stop pattern.

---

## CLAUDE.md Redundancy Warning

- **Autonomous scope discipline**: The system context already instructs CC to treat the active conversation transcript as the authoritative source of what is in-scope during autonomous operation, and to treat self-directed expansion as a trust violation. Adding instructions like "don't do anything outside what I've asked" to CLAUDE.md is redundant. Conflicting instructions that attempt to expand autonomous scope beyond the hardcoded principle may create unresolvable instruction tension.

- **Subagent prompt completeness**: The system context already requires that subagent prompts be fully self-contained — including goal, context, file references, and verification steps. Adding a CLAUDE.md instruction to "always write complete subagent prompts" duplicates existing policy with no practical effect. Instructions that contradict this (e.g., "keep subagent prompts brief") may degrade output quality by conflicting with the default.

- **Rebase-over-merge preference**: The system context defaults to rebase during autonomous branch operations. Many teams add this same preference to CLAUDE.md. Duplication is neutral if the instructions agree; if CLAUDE.md specifies merge, the explicit user instruction will override the default, which is the intended behavior.

- **CI log diagnosis before action**: The system context already establishes a diagnose-before-act pattern for failing CI jobs. Adding "always check logs before rerunning CI" to CLAUDE.md is redundant. It is not harmful unless the phrasing inadvertently restricts which diagnosis steps are permitted.

- **Loop idle behavior**: The system context already specifies the minimal idle reporting style (one sentence, no itemization). Users who add verbose "summarize what you checked" instructions to CLAUDE.md will override this default, producing chattier autonomous sessions than the hardcoded default intends.

- **Worktree isolation for batch workers**: The system context already mandates worktree isolation for parallel batch operations. Adding isolation instructions to CLAUDE.md is redundant for this mode. It may have effect for other custom subagent invocations not governed by the batch orchestration template.

---

## User Actionable Insights

1. **Tool-denial workarounds have a hard ceiling.** If a tool is blocked, CC will attempt reasonable alternatives but will never exploit unrelated tool capabilities to circumvent the block's intent. Users who need CC to perform a blocked action must explicitly grant the relevant permission — CLAUDE.md instructions to "find a way" do not override this constraint.

2. **The autonomous loop is steward-mode, not initiative-mode.** CC running on a timer will not invent new tasks, even if it detects what looks like an opportunity. Users who want proactive exploration must initiate it explicitly per session; it cannot be unlocked via CLAUDE.md.

3. **Loop intervals are fully user-controllable.** The dynamic pacing default is a fallback. Supplying an explicit interval (via the leading-token or trailing-clause syntax) locks the cadence regardless of observed activity. This is useful for high-frequency monitoring scenarios where the dynamic pacing would otherwise stretch delays.

4. **Side-question agents are tool-free by construction.** The system injects a constraint preventing side-question instances from using any tools or promising follow-up actions. Users who need a side query that requires file reads or command execution should not rely on the side-question pathway — they must use a full subagent invocation.

5. **Batch orchestration assumes worktree isolation.** Users triggering large parallel changes should be aware that each worker lands in its own isolated git worktree by default, producing separate PRs per work unit. Workflows that expect all changes in a single branch are not compatible with this mode without explicit override.

6. **CLAUDE.md cannot expand the autonomous trust floor.** The principle that autonomous operation must stay within established scope is a hardcoded constraint, not a default. No CLAUDE.md instruction can authorize CC to make irreversible changes or invent new work outside the conversation's established context.

7. **Review thread resolution is platform-specific by default.** CC's default assumes GitHub-style GraphQL mutation for thread resolution. Teams on GitLab, Bitbucket, or other platforms should specify the correct resolution mechanism in CLAUDE.md to avoid resolution failures during autonomous PR maintenance.

8. **Consecutive idle results trigger automatic scale-back.** If CC finds nothing to do across multiple autonomous passes, it reduces its activity automatically. Users who want sustained activity during idle periods must ensure there is a genuine open work item, or the loop will naturally wind down.

9. **Subagent prompts must encode the coordinator's understanding.** The system enforces that coordinators do not delegate synthesis. If a user's workflow involves CC writing subagent prompts, those prompts must contain explicit file paths, line references, and specific change descriptions — not open-ended instructions to "figure it out." This is a hard behavioral requirement, not a style preference.

10. **Version-specific note (v2.1.148):** The self-pacing loop machinery, the batch orchestration template with worktree isolation, and the side-question system-reminder injection are all present in this bundle version. Users who rely on these behaviors for production workflows should validate against the bundle version in use, as these assembler-level constructs are subject to change across versions.

---

## Tool & Permission Layer

**Tool denial and graceful degradation**: The system context embeds an explicit policy at the tool-execution layer: when a capability is withheld or denied, CC must inform the user of what it was attempting and why the permission is needed, then stop. It may not silently reroute through other tools in a way that circumvents the denial's intent. This policy is injected at the tool-call evaluation layer, not at the conversation layer, meaning it applies regardless of the conversational context surrounding the request.

**Side-question system-reminder injection**: A dedicated `<system-reminder>` block is injected into the context of lightweight side-question agent instances. This block constrains the instance to answer from existing context only, strips all tool availability, enforces single-turn response, and suppresses self-referential framing about the instance's own invocation. This injection happens at spawn time and is not visible to or controllable by the user.

**Background agent dispatch and lifecycle events**: The telemetry layer captures background agent lifecycle transitions including signal-escalation events, low-memory conditions, spare-agent enable/claim/claim-failure events, and daemon configuration reloads. These events are instrumented at the system level and inform the scheduler's behavior; they are not surfaced to the user in normal operation but are observable in telemetry pipelines.

**Subagent isolation and parallelism**: The batch orchestration layer enforces `isolation: "worktree"` and `run_in_background: true` for all parallel work units. The orchestrator is required to launch all agents in a single message block to maximize parallelism. Progress tracking is done via status table rendering, updated as completion notifications arrive.

**Event-gated monitoring (persistent monitors)**: The loop and self-pacing machinery supports arming persistent event monitors as primary wake signals. The scheduling tool's deadline then becomes a fallback heartbeat rather than the primary trigger. The system enforces an arm-once discipline: subsequent loop iterations must check whether a monitor is already running before arming a new one, to prevent monitor proliferation.

**Context compression notice**: The system context references a dynamic-mode sentinel value used in the loop's `prompt` field. When context is compacted, the sentinel expands at fire time to the appropriate full instruction set (first fire, first fire post-compact, or loop definition edited). This ensures loop continuity across context-window compression events without requiring the user to re-supply instructions.

**MCP and system-reminder tag handling**: System-reminder content is delivered via tagged XML-style blocks injected into the conversation at the system level. These blocks carry behavioral constraints that apply to the current instance and are not addressable or overridable through the normal conversation interface.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.148 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| h | Dashboard UI assembler — collapsible/copy controls and usage histogram rendering |
| L | SQL keyword / system-reminder assembler — PostgreSQL keyword list and side-question injection block |
| $ | Subagent prompt-writing guidance assembler — coordinator-mode examples with fork and review patterns |
| O | Single-turn subagent dispatch assembler — simplified subagent invocation examples |
| V | Autonomous loop step-instruction assembler — timer-based loop body with monitor arming and sentinel logic |
| f | Subagent prompt-writing principles assembler — briefing guidelines for coordinator-to-agent handoff |
| b | Subtask block property constants assembler — workflow subtask block field name registry |
| T | Pseudo-reference code constants assembler — system component pseudo-reference identifier list |
| C | Validation rule ID constants assembler — reference record rule identifier registry |
| P | Dataset event constants assembler — DSE lifecycle and selection route event name registry |
| Y | Daemon config reload telemetry assembler — `tengu_daemon_config_reload` event instrumentation |
| w | Background dispatch telemetry assembler — SIGKILL escalation, low-memory, spare-agent lifecycle events |
| j16 | Minimal assembler — no large strings or telemetry events; likely a stub or shim |
| M | Minimal assembler — no large strings or telemetry events; likely a lifecycle hook stub |
| X | Minimal assembler — no large strings or telemetry events |
| j | Minimal assembler — no large strings or telemetry events |
| z | Minimal assembler — no large strings or telemetry events |
| J | Minimal assembler — no large strings or telemetry events |
| R | Minimal assembler — no large strings or telemetry events |
| y | Minimal assembler — no large strings or telemetry events |
| I | Minimal assembler — no large strings or telemetry events |
| Z | Dashboard CSS assembler — full stylesheet for the analytics/reporting UI surface |
| D | PostgreSQL SQLSTATE and error code assembler — comprehensive error code constant registry; spare-agent spawn telemetry |
| em_ | Tool-denial graceful-degradation policy assembler — workaround permission and user-escalation constraint |
| cb_ | Autonomous loop check assembler — steward-mode behavioral policy, PR maintenance, idle handling |
| $4K | Files API Python documentation assembler — upload, reference, manage, and download skill content |
| yO5 | Batch parallel orchestration assembler — phase 1/2/3 plan-spawn-track workflow template |
| I4K | Claude Platform on AWS documentation assembler — SigV4 auth, IAM, client config skill content |
| Nz5 | Loop scheduling assembler — `/loop` parsing, fixed-interval mode, dynamic self-pacing mode |
| W4K | Claude API Ruby documentation assembler — client init, streaming, tool runner, prompt caching skill content |