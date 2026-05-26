---
type: system-context
command: _system-context
cc_version: "2.1.150"
updated: "2026-05-26"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.150 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.150 System Context

> Analysis basis: CC v2.1.150 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.150 system context is assembled from multiple cooperating function segments embedded in the bundle, each contributing distinct behavioral layers: security and permission policy, agentic role declarations, tool-use guidance, subagent orchestration protocols, and autonomous loop management. Together these segments form a layered instruction stack that is evaluated before any user instruction or CLAUDE.md content. The system context governs both interactive and autonomous operation modes, with explicit provisions for background agent spawning, self-paced scheduling, and event-driven wakeup patterns. User instructions and CLAUDE.md can influence default behaviors within this framework, but certain restrictions and structural assumptions remain fixed regardless of downstream configuration.

---

## Hardcoded Constraints

- **Tool denial compliance**: When a tool invocation is blocked or denied, CC is constrained to respect the intent behind that denial rather than circumventing it through alternative means. Reasonable workarounds using functionally equivalent tools are permitted (e.g., substituting one read-oriented command for another), but strategies that exploit unrelated tool capabilities to bypass the restriction's purpose are absolutely prohibited. If the capability is genuinely required, CC must halt and surface the situation to the user rather than proceed unilaterally.

- **Autonomous scope boundary**: In autonomous and background operation modes, CC is hardcoded to treat the existing conversation transcript as the authoritative scope boundary. Inventing new objectives, initiating irreversible changes not clearly sanctioned by prior conversation content, or extrapolating beyond established work are all structurally discouraged. The constraint is not overridable by loop configuration — the system context frames autonomous action as stewardship of established work, not independent initiative.

- **Side-question agent isolation**: When a lightweight parallel agent is spawned to answer an incidental user question, that agent is hardcoded to operate without any tools and without the ability to make promises of future action. It cannot read files, execute commands, or indicate that it will investigate further. This constraint is absolute for that agent class and is not configurable by the calling agent or the user.

- **Subagent context isolation**: When a subagent is spawned with a designated type (e.g., a code-reviewer role), it begins with no inherited context from the parent conversation. The parent agent is required to supply all necessary background in the subagent's prompt. This isolation is structural, not optional — the system context does not provide a passthrough mechanism for implicit context inheritance.

- **Autonomous loop termination protocol**: The mechanism for stopping a recurring autonomous loop requires explicit omission of the scheduling tool call combined with explicit cancellation of any armed event monitors. There is no passive or timeout-based termination — the loop continues until positively stopped. This protocol is hardcoded into the loop management layer.

- **Parallel batch worker isolation**: Workers spawned during large parallel change orchestration are required to use worktree isolation and background execution. The system context hardcodes this requirement; orchestrators cannot instruct workers to share state or run synchronously in parallel batches.

---

## Default Behaviors

- **Autonomous loop delay selection**: By default, CC selects fallback heartbeat delays in the range of roughly 20–30 minutes when an event monitor is active, scaling shorter when significant activity is in flight. Users can influence the cadence indirectly by adjusting the loop invocation parameters, but the system context provides explicit guidance that overrides purely arbitrary delay choices.

- **Subagent prompt construction**: By default, CC is expected to author fully self-contained prompts for any spawned subagent, including all relevant background, file paths, constraints, and verification recipes. Users can adjust the level of detail by framing the delegation request more or less specifically, but the default expectation is a complete briefing rather than a minimal instruction.

- **Autonomous PR maintenance behavior**: When no active conversation work remains, CC defaults to checking pull request status — CI results, unresolved review threads, and branch staleness — as a fallback activity during autonomous ticks. Users can implicitly suppress this by keeping the conversation transcript focused on non-PR work, but there is no explicit off-switch in the default configuration.

- **Autonomous inactivity reporting**: When genuinely nothing actionable is found across multiple consecutive autonomous ticks, CC defaults to a single brief status sentence and stops elaborating. After several consecutive idle results, it defaults to scaling back to a minimal check pattern. This behavior is adjustable by ensuring the transcript contains forward-looking work items.

- **Loop scheduling mode selection**: The scheduling system defaults to dynamic self-pacing when no explicit interval is provided, and to fixed-interval cron scheduling when a time expression is parsed from the input. Users can select between modes by including or omitting an interval token in the loop invocation.

- **Worker verification step**: During parallel batch orchestration, CC defaults to requiring a concrete end-to-end verification recipe before spawning workers. If no automated verification path is found, the default behavior is to ask the user to choose from enumerated options rather than skip verification silently.

- **Repeated autonomous check scoping**: On repeated autonomous invocations within the same session, CC defaults to adjusting its scope based on what prior autonomous checks already covered, avoiding redundant re-examination of areas recently addressed. This is a soft default that responds to transcript evidence.

---

## CLAUDE.md Redundancy Warning

- **Subagent briefing standards**: The system context already establishes that subagent prompts must be fully self-contained and include specific context (file paths, line numbers, prior findings, explicit goals). Adding general delegation guidance to CLAUDE.md is redundant. Instructions that contradict this standard — such as directing CC to write minimal or abstract subagent prompts — may conflict with the hardcoded expectation and produce degraded subagent behavior.

- **Autonomous loop restraint**: The system context already encodes a strong default toward conservative autonomous action, explicitly framing invented work as trust-eroding. CLAUDE.md instructions that reiterate "don't do things I didn't ask for" duplicate an existing default. Instructions that attempt to expand autonomous initiative beyond what the transcript supports may conflict with this structural framing.

- **PR maintenance as fallback activity**: The system context already configures PR maintenance (CI, review threads, branch hygiene) as the default fallback when no conversation work remains. CLAUDE.md entries instructing CC to check PR status during idle autonomous ticks are fully redundant. Those that specify a different fallback priority order may partially override or conflict with the embedded default.

- **Worktree isolation for parallel workers**: The system context already mandates isolation for parallel batch workers. CLAUDE.md instructions specifying worker isolation add no effect and are redundant. Instructions that attempt to disable isolation for batch workers will conflict with a hardcoded constraint.

- **Verification before spawning**: The system context already requires that an end-to-end verification recipe be established before workers are launched. CLAUDE.md instructions to "always verify changes" are redundant in the batch orchestration context. Instructions to skip verification may be overridden by the structural requirement to either find a recipe or ask the user.

- **Side-question agent capability restrictions**: The system context already hardcodes that lightweight side-question agents have no tools and no follow-up turns. CLAUDE.md instructions attempting to grant these agents file access or action capability have no effect — the constraint is structural.

---

## User Actionable Insights

1. **Tool denial workarounds have a defined boundary.** When CC declines to use a specific tool due to a permission denial, it will attempt reasonable functional substitutions but will not exploit unrelated capabilities to circumvent the restriction's intent. Users who need a blocked capability must explicitly re-authorize it or adjust permissions — there is no instruction that unlocks bypass behavior.

2. **Autonomous mode is scope-conservative by design.** The system context structurally biases autonomous operation toward continuing established work rather than generating new objectives. Users who want CC to take on genuinely new tasks during autonomous ticks should leave explicit, forward-looking instructions in the conversation transcript before going idle — ambient permission is insufficient.

3. **Subagent context does not flow automatically.** When CC spawns a subagent with a specific role type, that agent starts with a blank slate. Any background, findings, or prior conversation context must be explicitly included in the spawning prompt. Users relying on implicit context inheritance will find subagents producing generic or misaligned responses.

4. **Loop scheduling has two distinct modes.** Including a time expression in a loop invocation produces fixed-interval scheduling; omitting one produces dynamic self-pacing. Dynamic mode allows CC to choose delay lengths based on observed activity. Users who need predictable cadence should always supply an explicit interval; those who want adaptive behavior should omit it.

5. **Parallel batch orchestration requires a verification recipe.** Before workers are spawned for a large parallel change, the system context requires a concrete end-to-end verification path. If users do not specify one, CC will enumerate options and ask. Users can streamline this by including verification instructions (e.g., a test command or browser automation path) in the initial batch instruction.

6. **Consecutive idle autonomous ticks trigger scope reduction.** After multiple consecutive ticks with nothing actionable, CC reduces its autonomous check scope rather than continuing to narrate the absence of work. Users running long autonomous sessions on quiet branches should expect this behavior and can prevent premature scale-back by ensuring the transcript contains forward-looking items.

7. **The side-question agent is a fixed-capability class.** When CC spawns a lightweight agent to answer an incidental question in parallel, that agent is categorically tool-free and single-turn. This is not configurable. Users who need the side-question agent to look up file contents or run commands must instead route the question through the main agent or a fully-capable subagent.

8. **Version-specific note (v2.1.150):** This version contains explicit loop management instrumentation including event-monitor arming, dynamic sentinel expansion, and task-notification wakeup handling. These features were not documented in earlier bundle analyses. Users running long autonomous sessions benefit from understanding that event monitors armed with persistent mode act as primary wakeup signals, with time-based delays serving only as safety-net fallbacks.

---

## Tool & Permission Layer

The system context embeds a structured permission model governing how tool invocations are handled when access is restricted. When a tool call is denied, CC receives explicit guidance on the boundary between acceptable workarounds and prohibited circumvention — acceptable substitutions are those that use naturally equivalent tools; prohibited ones are those that exploit unrelated tool capabilities to achieve the same restricted effect. In all cases where the required capability cannot be obtained through acceptable means, CC is directed to surface the situation to the user and halt rather than proceed.

The autonomous loop machinery is also managed at the system context level. CC is given detailed instructions for how to arm event monitors with persistent mode, how to distinguish between event-driven wakeup (via task-notification messages) and time-based fallback wakeup, and how to handle the loop sentinel value that dynamically expands into full instructions at fire time. This sentinel mechanism means the loop prompt passed at scheduling time is intentionally minimal — full instruction expansion happens at runtime based on loop state (first fire, post-compaction fire, or subsequent fires).

The side-question agent mechanism introduces a sandboxed sub-instance that shares conversation context but operates with a strictly reduced capability set: no tools, no follow-up turns, and no ability to make action promises. This sub-instance is explicitly identified as separate from the main agent and is told not to frame its responses as if it had been interrupted.

The system-reminder XML tag is used to deliver the side-question agent's behavioral constraints inline, wrapped in a structured tag that CC recognizes as a system-level overlay rather than a user message. This tagging pattern allows the system context layer to inject behavioral modifications mid-conversation without requiring a full system prompt replacement.

Context compression events are handled by the loop infrastructure — when a compaction occurs between loop fires, the sentinel expansion logic detects this and injects the full loop instructions at the next fire rather than the abbreviated reminder, ensuring continuity across context window resets.

For parallel batch orchestration, the permission model requires all workers to operate in worktree isolation, preventing shared filesystem state between sibling workers. The orchestrator retains visibility into worker completion via background-agent notification events and is responsible for rendering progress tables and collecting PR URLs from worker results.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.150 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `h` | Dashboard UI JavaScript assembler (collapsible panels, clipboard copy, histogram rendering) |
| `L` | SQL keyword list assembler + side-question agent system-reminder template |
| `$` | Coordinator-mode subagent orchestration examples (ship-audit, migration-review patterns) |
| `O` | Lightweight subagent dispatch examples (single-tool delegation, code-reviewer pattern) |
| `Z` | Autonomous loop tick instruction assembler (monitor arming, sentinel scheduling, stop protocol) |
| `f` | Subagent prompt writing guidance assembler (briefing standards, delegation anti-patterns) |
| `b` | Subtask block property constant list assembler |
| `G` | Pseudo-reference code constant list assembler |
| `C` | Auto-numeration and record rule ID constant list assembler |
| `X` | Dataset event constant list assembler (dse/re event names) |
| `Y` | Daemon config reload telemetry handler |
| `w` | Background dispatch telemetry handler (sigkill escalation, low-memory, spare pool events) |
| `_46` | Minimal assembler stub (no large strings, no telemetry) |
| `M` | Minimal assembler stub (no large strings, no telemetry) |
| `P` | Minimal assembler stub (no large strings, no telemetry) |
| `j` | Minimal assembler stub (no large strings, no telemetry) |
| `z` | Minimal assembler stub (no large strings, no telemetry) |
| `J` | Minimal assembler stub (no large strings, no telemetry) |
| `R` | Minimal assembler stub (no large strings, no telemetry) |
| `y` | Minimal assembler stub (no large strings, no telemetry) |
| `I` | Minimal assembler stub (no large strings, no telemetry) |
| `V` | Analytics dashboard CSS and HTML assembler (stats display, CLAUDE.md action UI) |
| `D` | PostgreSQL SQLSTATE error code constant list assembler + spare pool spawn telemetry |
| `og_` | Tool denial workaround policy text assembler |
| `UU_` | Autonomous loop check instruction assembler (stewardship framing, PR maintenance, idle protocol) |
| `ZzK` | Files API Python documentation assembler |
| `WZ5` | Parallel batch orchestration instruction assembler (research/plan/spawn/track phases) |
| `FzK` | Claude Platform on AWS documentation assembler |
| `JV5` | Self-paced loop dynamic mode instruction assembler + loop slash-command parser |
| `CzK` | Claude API Ruby SDK documentation assembler |