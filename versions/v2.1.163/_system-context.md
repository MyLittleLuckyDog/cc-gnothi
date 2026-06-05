---
type: system-context
command: _system-context
cc_version: "2.1.163"
updated: "2026-06-05"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.163 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.163 System Context

> Analysis basis: CC v2.1.163 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.163 system context is assembled by combining outputs from several discrete internal functions, each contributing a distinct behavioral layer — role declaration, task guidance, tool policy, mode enforcement, and sub-agent orchestration rules. Together these form the effective "hardcoded personality" that CC presents before any user instruction or CLAUDE.md content is considered. The layer covers a broad surface: security-adjacent behaviors, output formatting discipline, plan-mode gating, side-question handling, sub-agent delegation patterns, self-pacing loop mechanics, and permission/confirmation policies for tool use. User instructions and CLAUDE.md can influence many defaults within this layer, but several constraints — most notably around plan-mode execution gating and side-question isolation — are treated as invariant regardless of downstream instruction.

---

## Hardcoded Constraints

- **Plan-mode execution gate**: When plan mode is active, CC is prohibited from performing any write operations, configuration changes, commit actions, or any non-read-only tool calls, regardless of any other instruction present in the conversation or in CLAUDE.md. This constraint is declared to supersede all other guidance. Only a single designated plan file may be edited. This restriction is absolute and cannot be unlocked by user instruction alone.

- **Re-entry plan evaluation requirement**: When CC re-enters plan mode after a prior planning session, it is required to re-read and critically evaluate any existing plan file before proceeding. It must determine whether the current request represents a continuation of the prior task or a new one, and must update the plan file accordingly before invoking any planning-completion signal. Skipping this evaluation step is not permitted.

- **Side-question agent isolation**: When a lightweight side-question agent is spawned to answer an incidental user query, that agent operates under a strict constraint set: no tools are available, no follow-up turns are permitted, and the agent must not represent itself as having been interrupted from other work or offer to take future actions. Responses must be grounded solely in already-available context. This behavior is hardcoded into the system-reminder tag injected for that agent type.

- **Sub-agent prompt completeness requirement**: When delegating work to a sub-agent, CC is required to supply the agent with sufficient context to operate independently — including relevant file paths, what has already been tried or ruled out, and the specific goal. Delegation phrases that push synthesis back onto the agent (i.e., asking the agent to "figure out what to do based on findings") are structurally discouraged by the system guidance.

- **Self-pacing loop termination protocol**: In autonomous loop mode, stopping the loop requires both omitting the scheduling call and explicitly canceling any armed monitoring task. The system context defines this as a two-step requirement; omitting either step leaves the loop in an indeterminate state.

- **Voice circuit-breaker suppression**: When voice input encounters repeated early failures, the system automatically suppresses new voice sessions until at least one successful session is established. This is a hardcoded fault-tolerance behavior not controllable via user preference in normal operation.

- **Scheduled task expiration**: Recurring scheduled tasks that exceed a defined age threshold are automatically deleted after one final execution. This lifecycle rule is enforced by the runtime, not by user configuration.

---

## Default Behaviors

- **Plan file management strategy**: By default, CC treats a re-entered planning session as a fresh start, requiring explicit evidence of continuity before modifying rather than replacing an existing plan. Users can implicitly influence this by framing their request as an explicit continuation, but the burden of disambiguation defaults to the model's judgment.

- **Sub-agent briefing style**: The default expectation for sub-agent prompts is a fully contextualized briefing analogous to onboarding a colleague unfamiliar with the conversation history. Users who delegate tasks without providing file paths, line numbers, prior findings, and task rationale will receive shallower agent output. This default favors specificity; terse command-style delegation is flagged as producing inferior results.

- **Self-pacing loop cadence**: When operating in autonomous loop mode without an armed event monitor, the default scheduling cadence is derived from what the model observes about the task rhythm. When a persistent event monitor is armed, the scheduling call serves as a fallback heartbeat with a recommended idle interval in the 20–30 minute range, explicitly to avoid cache-window overhead. Users can influence the cadence implicitly through the loop prompt, but the system context provides default guidance the model follows.

- **Side-question response scope**: The default for side-question agents is strict scope limitation — answer only from available context, never promise follow-up. Users cannot expand this scope for the side-question agent type; it is fully tool-less by design.

- **Remote-control session spawn mode**: The default spawn behavior for remote-control sessions is same-directory mode, with one session pre-created at startup. Users can override this to worktree mode (isolated git worktree per on-demand session) or single-session mode via CLI flags. The worktree mode requires an underlying git repository or appropriate hooks.

- **Remote-control session capacity**: A default maximum concurrent session count applies in worktree and same-directory modes. This can be overridden via a CLI flag at launch time.

- **Fullscreen rendering behavior**: On detected terminal environments where fullscreen rendering causes visual artifacts (specific iTerm2 integration mode, Windows-over-SSH via ConPTY), fullscreen is disabled by default. Users can restore fullscreen behavior by setting a designated environment variable.

- **MCP elicitation display**: When an MCP server triggers an elicitation event, CC shows the elicitation UI by default and records the response. This behavior is part of the MCP integration layer and follows the tool-permission model in effect.

---

## CLAUDE.md Redundancy Warning

- **Sub-agent briefing standards**: The system context already contains detailed guidance on how to write effective sub-agent prompts — emphasizing context richness, specificity, and avoiding synthesis delegation. Adding equivalent instructions to CLAUDE.md is redundant. If CLAUDE.md instructions conflict (e.g., encouraging terse delegation or minimal context), they may degrade sub-agent output quality by creating ambiguous instruction weight.

- **Plan-mode discipline**: The prohibition on write operations during plan mode is embedded in the runtime system context and cannot be meaningfully reinforced or overridden by CLAUDE.md. Adding plan-mode reminders to CLAUDE.md is neutral at best; any CLAUDE.md instruction that appears to authorize writes during plan mode will be ignored, as the system-level constraint is declared to supersede all other instructions.

- **Loop self-pacing guidance**: Default cadence recommendations and the two-step loop-termination protocol are already present in the system context. CLAUDE.md additions that specify loop timing or termination behavior are redundant unless they meaningfully diverge from the defaults (e.g., specifying a domain-specific preferred heartbeat interval). Conflicting timing instructions may produce inconsistent loop behavior.

- **Response scope for side questions**: The tool-less, single-turn constraint on side-question agents is system-enforced and cannot be expanded via CLAUDE.md. Instructions in CLAUDE.md directing CC to "always offer to investigate further" or similar will not apply to this agent type and may create user confusion when the side-question agent does not follow them.

- **Session and worktree defaults**: Remote-control spawn mode defaults are set at the CLI/system level. Attempting to configure spawn behavior via CLAUDE.md is ineffective; these are launch-time parameters.

---

## User Actionable Insights

1. **Plan mode is a hard wall, not a soft preference.** No instruction in CLAUDE.md or the conversation can authorize CC to perform writes while plan mode is active. If you need iterative edit-then-plan cycles, you must explicitly exit plan mode between phases — you cannot instruct CC to "just make this one small edit" while in plan mode.

2. **Re-entering plan mode requires an explicit continuity signal.** If you return to a planning session intending to extend a prior plan rather than replace it, state this explicitly. The default behavior is to treat re-entry as a fresh session; without a clear continuation signal, prior plan content may be overwritten.

3. **Sub-agent quality is directly proportional to brief quality.** The system context provides detailed internal guidance on what constitutes a good sub-agent prompt. Users who provide file paths, line numbers, prior findings, and explicit goals will get substantially better sub-agent output than users who issue high-level delegation instructions.

4. **Side-question agents are intentionally limited.** If you ask a side question while CC is working on a longer task, the answering agent has no tools and cannot take actions or promise follow-up. This is by design. If you need tool-assisted answers, ask them as primary-turn questions, not side questions.

5. **Loop mode has a built-in idle-tick cost model.** The system context explicitly guides CC to avoid excessively short heartbeat intervals when an event monitor is armed, specifically to avoid cache-window overhead. If you are running long autonomous loops, be aware that CC will apply its own judgment to cadence — you can influence this via the loop prompt but cannot fully override the cost-awareness heuristic.

6. **Stopping a loop requires two explicit steps.** Simply not issuing a reschedule call is insufficient. Any armed monitoring task must also be explicitly canceled. If you observe a loop that appears to have stopped but continues firing, a lingering monitor task is the likely cause.

7. **Voice input has an automatic circuit breaker.** Repeated voice input failures will cause CC to suspend new voice sessions automatically. This is not user-configurable in normal operation; recovery requires a successful voice session to reset the breaker.

8. **Fullscreen behavior is environment-detected, not preference-configured.** If you are in an affected terminal environment (iTerm2 tmux integration, Windows SSH), fullscreen is suppressed automatically. The override mechanism is an environment variable set before launch, not a runtime toggle.

9. **MCP elicitation is part of the tool-permission layer.** MCP server elicitation prompts are shown and recorded as part of normal operation. Users working with MCP servers should expect elicitation UI to appear as a standard interaction pattern, not an anomaly.

10. **System context is version-specific.** The behaviors documented here reflect bundle version 2.1.163. Behavioral details — including plan-mode rules, loop guidance, and sub-agent prompt standards — may change across versions. Users relying on specific behavioral guarantees should verify against the relevant bundle version.

---

## Tool & Permission Layer

CC's tool and permission model in this version operates across two primary modes: auto-allow and prompt-to-allow. The system context itself explains this distinction to the model, establishing when CC should proceed without user confirmation versus when it must pause and surface a permission request. This internal explanation is part of the assembled system context, meaning CC's understanding of its own permission model is baked into the system layer rather than inferred at runtime.

The `<system-reminder>` tag mechanism is used to inject behavioral constraints into specific agent instantiations — most visibly in the side-question agent pattern, where the tag carries the full constraint set (no tools, single turn, no action promises) as a self-contained policy block. This tag approach allows the system to instantiate agents with tightly scoped behavioral envelopes without relying on the outer conversation to carry those constraints.

MCP server integration is handled through dedicated event tracking: list-change events are monitored separately from elicitation events, with telemetry instrumentation at both points. This suggests the permission layer treats MCP server presence as a dynamic condition — the tool list can change mid-session, and the system is designed to respond to those changes rather than treat the tool set as static.

Context compression is acknowledged within the system layer as a background process. When compression occurs, CC is aware that earlier context may be summarized or truncated, and the system context prepares it to operate correctly under that condition rather than treating missing early context as an error state.

The scheduled-task subsystem (loop mode and event monitors) is integrated into the permission layer in the sense that armed persistent tasks continue to operate across turns and must be explicitly lifecycle-managed. The system context treats task cleanup as a user-facing responsibility surfaced through model behavior — CC is instructed to handle termination explicitly rather than relying on implicit session cleanup.

Hook events (such as worktree creation and removal) are part of the remote-control permission surface, enabling spawn-mode transitions that would otherwise require git repository structure. These hooks extend the effective permission boundary of what remote-control sessions can do in non-git environments.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.163 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| A | Primary assembler: syntax keyword lists (PowerShell verbs, SAS functions, async iterator runtime), plan-mode injection, remote-control CLI help, macOS plist template |
| _ | Secondary assembler: language keyword lists (Java, AspectJ, Pascal/Delphi, SAS DSL), self-pacing loop orchestration guidance |
| L | SQL keyword / type assembler: PostgreSQL DDL + DML keywords, side-question system-reminder injector |
| $ | Sub-agent delegation example assembler: fork/notify pattern examples, migration-review example, PostgreSQL type keyword list |
| M | Sub-agent prompt-writing guidance assembler: briefing standards, context-richness requirements, delegation anti-patterns |
| e | Voice input subsystem: circuit-breaker logic, session suppression, buffer-flush on ready, voice telemetry |
| x | IS/ECM system reference table assembler: SYSREF_* catalog identifiers for document/workflow system |
| _H | Unicode/character-map delta encoding table |
| M1 | Terminal environment detection: iTerm2 tmux fullscreen suppression, Windows SSH ConPTY suppression, environment variable override notice |
| d | Scheduled task lifecycle manager: age-out detection, final-fire-then-delete logic, task expiry telemetry |
| LH | MCP elicitation UI handler: elicitation display event, response capture telemetry |
| g | Background session socket cleanup: orphaned socket unlink handler |
| fH | MCP tool-list change monitor: dynamic MCP server list update handler |
| $H | Session resume handler: session-resumed telemetry emitter |
| A78 | Stub assembler (no large strings, no telemetry) |
| K49 | Stub assembler (no large strings, no telemetry) |
| s9 | Stub assembler (no large strings, no telemetry) |
| PC | Stub assembler (no large strings, no telemetry) |
| AiH | Stub assembler (no large strings, no telemetry) |
| s | Stub assembler (no large strings, no telemetry) |
| H78 | Stub assembler (no large strings, no telemetry) |
| _78 | Stub assembler (no large strings, no telemetry) |
| f49 | Stub assembler (no large strings, no telemetry) |
| l | Stub assembler (no large strings, no telemetry) |
| XE_ | Stub assembler (no large strings, no telemetry) |
| L49 | Stub assembler (no large strings, no telemetry) |
| r | Stub assembler (no large strings, no telemetry) |
| n | Stub assembler (no large strings, no telemetry) |
| a | Stub assembler (no large strings, no telemetry) |
| OH | Stub assembler (no large strings, no telemetry) |