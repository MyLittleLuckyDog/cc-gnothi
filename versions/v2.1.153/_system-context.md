---
type: system-context
command: _system-context
cc_version: "2.1.153"
updated: "2026-05-29"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.153 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.153 System Context

> Analysis basis: CC v2.1.153 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.153 system context is assembled from multiple discrete function-level string contributions that are concatenated at runtime to form the complete system prompt delivered to the model. These contributions collectively span security policy, role declaration, agentic tool behavior, task delegation guidance, autonomous loop orchestration, and subagent prompt-writing conventions. The system context layer sits below user instructions and CLAUDE.md: it establishes defaults and hard limits before any user-supplied configuration is considered. CLAUDE.md content can influence or override many default behaviors, but certain constraint categories are fixed regardless of user instruction.

---

## Hardcoded Constraints

- **Tool-denial workaround boundary**: When a tool invocation is denied, CC is permitted to attempt the same goal through reasonable alternative tools — for example, reaching for a less privileged reading tool instead of a more expansive one. However, it is absolutely prohibited from using any tool whose primary purpose differs from the original intent merely to achieve the denied effect as a side effect. If no legitimate alternative exists, CC must halt and surface the permission gap to the user rather than proceed through any circumvention path. This constraint is absolute and cannot be overridden by user instruction or CLAUDE.md.

- **Subagent context isolation**: When CC spawns a subagent with a fresh context (no conversation inheritance), the orchestrating agent is required to include all necessary background, constraints, and verification steps in the prompt itself. Subagents are prohibited from inheriting implicit assumptions from the parent conversation. This is a structural enforcement, not a style preference.

- **Autonomous action scope boundary**: During autonomous or timer-triggered loop execution, CC is restricted to continuing work that the conversation transcript explicitly authorizes. Inventing new work items, expanding scope, or making irreversible changes without clear prior authorization from the user is blocked by policy. The presence of a plausible justification for an action does not constitute authorization — only explicit conversational evidence does.

- **Side-question agent tool prohibition**: Lightweight agents spawned to handle a parallel user question while the main agent continues working are given zero tool access. These agents cannot read files, run commands, search, or take any action. They are restricted to responding solely from existing conversation context, and are prohibited from making promises to look things up or investigate further.

- **Loop termination hygiene**: When an autonomous loop is stopped, any persistent monitoring tasks that were armed during that loop's lifecycle must be cancelled as part of the stop action. Leaving orphaned monitors running after a loop ends is a policy violation, not merely bad practice.

---

## Default Behaviors

- **Autonomous loop pacing**: By default, CC selects its own delay intervals between loop iterations based on observed activity — longer delays for quiet states, shorter for active in-flight work. Users can influence this by specifying an explicit interval (e.g., a fixed cadence) when invoking the loop, or by allowing CC to operate in dynamic self-pacing mode. The fallback heartbeat when a persistent event monitor is armed defaults to a range of roughly twenty to thirty minutes.

- **Subagent prompt verbosity**: By default, CC writes fully self-contained prompts for subagents, briefing them as though they have no knowledge of the parent conversation. Users can influence the level of detail requested in the output (e.g., specifying word count caps), but the requirement to include all necessary context in the prompt is not adjustable.

- **PR maintenance behavior in autonomous mode**: By default, during autonomous checks, CC treats the active pull or merge request as a maintenance target — checking CI status, unresolved review threads, and branch staleness. Users can narrow this scope by structuring the loop prompt to focus on specific concerns, but the default is broad maintenance coverage.

- **Repeated idle reporting**: By default, CC produces a brief single-sentence report when no work is found during an autonomous check. After several consecutive idle results, it defaults to scaling back to minimal checks rather than continuing full audits. Users cannot disable the idle-reporting behavior, but can influence loop frequency to reduce its occurrence.

- **Subagent type selection**: Subagents default to a general-purpose type unless the orchestrating agent determines a more specialized type is a better fit. Users can guide specialization by describing the nature of the task in ways that make subagent type selection unambiguous.

- **Parallel work decomposition sizing**: When orchestrating a large parallelizable change, CC defaults to decomposing work into a number of units scaled to actual scope — fewer units for smaller change surfaces, more for large ones, with a bias toward per-directory or per-module slicing. Users can influence granularity through the framing of their instruction but cannot bypass the decomposition step itself.

- **End-to-end verification requirement in batch orchestration**: By default, CC attempts to identify a concrete end-to-end verification path for each batch work unit before spawning workers. If no path can be determined autonomously, CC defaults to pausing and asking the user rather than skipping verification. Users can explicitly authorize skipping end-to-end checks, in which case CC proceeds with unit tests only.

---

## CLAUDE.md Redundancy Warning

- **Subagent prompt-writing style**: The system context already contains detailed guidance on how to write effective delegation prompts — including the requirement to provide file paths, line numbers, and specific change descriptions rather than vague directives. Adding similar instructions to CLAUDE.md is largely redundant. Conflicting instructions (e.g., asking for shorter, less detailed subagent prompts) may degrade subagent performance in ways that are not immediately obvious.

- **Autonomous scope conservatism**: The system context already instructs CC to bias toward caution when determining whether an action falls within established authorization during autonomous operation. CLAUDE.md instructions that attempt to broaden autonomous scope (e.g., "feel free to push to branches without asking") may conflict with the hardcoded trust model and produce inconsistent behavior.

- **Idle loop behavior**: The system context already specifies the expected format and brevity of idle-state reports during autonomous checks. CLAUDE.md instructions to "provide a full summary of what you checked" or similar verbose reporting requests will directly conflict with the default, and the system prompt default may be partially overridden, producing mixed output.

- **Parallel work isolation requirement**: The system context already mandates that batch orchestration workers use isolated git worktrees and operate without shared state. CLAUDE.md instructions attempting to modify this (e.g., "workers can share a working directory") will conflict and may produce undefined behavior in multi-agent contexts.

- **Subagent result relay**: The system context already specifies how the orchestrating agent should handle and relay subagent results to the user. Adding relay formatting instructions in CLAUDE.md is neutral if consistent, but potentially conflicting if they specify a different structure for status tables or completion summaries.

- **Loop input parsing rules**: The system context embeds fixed rules for parsing loop invocation syntax, including how interval tokens are identified and how edge cases like ambiguous "every" clauses are resolved. CLAUDE.md cannot usefully supplement or override these parsing rules — they are interpreted before CLAUDE.md content is applied.

---

## User Actionable Insights

1. **Tool denial is a hard stop, not a suggestion.** If a tool is denied and no legitimate alternative exists, CC will surface the issue rather than attempt creative workarounds. Users who encounter this should explicitly grant the required permission or restructure the task — prompting CC to "find another way" is unlikely to succeed and will not cause it to bypass the intent of the denial.

2. **Autonomous loops respect prior authorization only.** CC will not expand its own work scope during timer-triggered autonomous execution. If a user wants CC to handle additional categories of work autonomously, those categories must be explicitly established in the conversation before the loop begins, not implied by the general nature of the task.

3. **Subagent prompts must be complete at dispatch time.** There is no mechanism for a subagent to query the parent for missing context mid-execution. Users who structure tasks as delegations should ensure the prompt contains everything the subagent needs — CC's defaults enforce this, but users can improve results by providing richer context about what has already been tried or ruled out.

4. **Side-question agents are intentionally limited.** When CC spawns a lightweight agent to answer a parallel question, that agent has no tool access by design. Users should not expect these agents to look up files, run checks, or take actions — they are knowledge-recall agents only. For anything requiring tool use, the main agent must handle it directly or a full subagent must be dispatched.

5. **Batch orchestration includes a mandatory planning phase.** CC will not immediately spawn parallel workers when given a large parallelizable task. It will first enter a research and planning phase, produce a plan, and request approval before spawning workers. Users who want to accelerate this should provide detailed scope information upfront to reduce the research burden.

6. **Event monitors must be explicitly stopped.** When a loop is terminated, any persistent event monitors armed during that loop are not automatically cancelled by the loop-stop action alone. Users should verify that monitors have been cancelled after stopping a loop to avoid unexpected wake-events firing against a stopped loop context.

7. **The system context is version-pinned.** These behaviors reflect v2.1.153 specifically. Bundle updates may alter loop pacing defaults, subagent isolation requirements, or workaround boundary definitions without notice. CLAUDE.md configurations that depend on specific system-context behaviors should be reviewed after CC version updates.

8. **Dynamic loop pacing is influenced by observable state, not user preference alone.** CC's self-pacing algorithm reads actual observed conditions (CI activity, in-flight PRs, recent changes) rather than following a fixed cadence. Users who want predictable cadence should specify an explicit interval at loop invocation rather than relying on dynamic mode.

---

## Tool & Permission Layer

The system context embeds a multi-tier tool permission model that CC uses to determine whether to proceed automatically or pause for user confirmation before executing tool calls.

**Auto-allow vs. prompt-to-allow**: Certain tool categories and specific invocation patterns are pre-authorized and execute without requiring per-call confirmation. Others — particularly those with broader filesystem scope, network access, or external service side effects — require explicit user confirmation before proceeding. The boundary between these tiers is defined in the system context and reflects the potential reversibility of the action.

**Hook event handling**: The system context describes a hook mechanism by which external events (CI completion signals, log line matches, file change detections, PR comments) can wake a sleeping loop iteration early. These hook events arrive as tagged notification messages and are handled before the normal loop continuation logic runs. The hook system is armed per-loop-iteration with a persistent flag and is designed to be idempotent — if a monitor is already running for an event type, CC skips re-arming rather than stacking monitors.

**System-reminder tag handling**: Certain system-level instructions are delivered to CC via a tagged reminder block rather than the main system prompt. These blocks carry constraints that apply to the specific invocation context — for example, the side-question agent context is delivered this way, complete with its tool-access restrictions and response format requirements. CC treats these tagged blocks as authoritative for the duration of the invocation.

**Context compression notice**: The system context includes provisions for how CC should behave when its conversation context has been compacted or summarized. Loop prompts are designed with a sentinel value that expands differently depending on whether the current firing is an initial invocation, a post-compaction firing, or a routine subsequent iteration — allowing CC to reconstruct necessary context without requiring the full original instruction to be re-passed each time.

**MCP server integration**: The permission model accommodates Model Context Protocol server connections, which may provide additional tools beyond CC's built-in set. These tools are subject to the same auto-allow / prompt-to-allow classification logic, with MCP-sourced tools generally requiring explicit per-call or session-level authorization unless configured otherwise.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.153 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `h` | Dashboard UI script assembler (collapsible panels, clipboard, histogram timezone rendering) |
| `L` | SQL keyword list assembler (PostgreSQL DML/DDL) + side-question system-reminder block |
| `$` | Coordinator-mode subagent delegation examples (fork-style with notification) |
| `O` | Lightweight subagent delegation examples (single-result, no notification) |
| `E` | Autonomous loop tick instruction block (event-gated, monitor arming, loop stop logic) |
| `f` | Subagent prompt-writing guidance block |
| `b` | Subtask block property constant list |
| `G` | Pseudoreference code constant list |
| `R` | Auto-numeration and validation rule ID constant list |
| `X` | Dataset event and selection route event constant list |
| `Y` | Daemon config reload telemetry handler |
| `w` | Background dispatch telemetry handler (SIGKILL escalation, low memory, spare process lifecycle) |
| `fL6` | Assembler call stub (no large strings, no telemetry) |
| `M` | Assembler call stub (no large strings, no telemetry) |
| `P` | Assembler call stub (no large strings, no telemetry) |
| `j` | Assembler call stub (no large strings, no telemetry) |
| `z` | Assembler call stub (no large strings, no telemetry) |
| `J` | Assembler call stub (no large strings, no telemetry) |
| `C` | Assembler call stub (no large strings, no telemetry) |
| `y` | Assembler call stub (no large strings, no telemetry) |
| `I` | Assembler call stub (no large strings, no telemetry) |
| `V` | Dashboard CSS stylesheet assembler (layout, component styling, color system) |
| `D` | PostgreSQL SQLSTATE error code constant list + background spare-spawn telemetry |
| `zn_` | Tool-denial workaround boundary policy block |
| `hv_` | Autonomous loop check instruction block (steward mode, PR maintenance, idle handling) |
| `Q$K` | Files API Python reference documentation block |
| `CN5` | Batch parallel work orchestration instruction block (plan/spawn/track phases) |
| `MOK` | Claude Platform on AWS reference documentation block |
| `bI5` | Self-pacing loop skill block + /loop slash command parsing and scheduling rules |
| `t$K` | Claude API Ruby SDK reference documentation block |