---
type: system-context
command: _system-context
cc_version: "2.1.168"
updated: "2026-06-11"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.168 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.168 System Context

> Analysis basis: CC v2.1.168 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.168 system context is assembled from multiple cooperating functions at bundle initialization time, each contributing a distinct behavioral layer: role declaration, task execution policy, tool permission scaffolding, sub-agent orchestration guidance, and UI/voice subsystem configuration. Together these layers constitute a composite system prompt that CC receives before any user message or CLAUDE.md content is applied. The system context governs both what CC does by default and what categories of instruction it will — or will not — accept from downstream sources. User instructions and CLAUDE.md content operate within, not above, this layer; certain behaviors encoded here are not addressable by either.

---

## Hardcoded Constraints

- **Plan-mode execution lock**: When CC enters plan mode at user direction, it is unconditionally prohibited from executing writes, mutations, configuration changes, or commits — regardless of any other instruction in scope. Read-only tool use is permitted; the single designated plan file is the only writable target. This restriction is described internally as superseding all other instructions, making it one of the strongest absolute constraints in the system context.

- **Plan-file exclusivity**: During active plan mode, CC is constrained to a single named output artifact for all planning work. It may not create, modify, or touch any other file. This is an absolute constraint, not a soft preference.

- **Side-question agent isolation**: When a lightweight parallel agent is spawned to handle a side question, that agent is hardcoded with zero tool access — it cannot read files, execute commands, perform searches, or take any system action whatsoever. This constraint is embedded in the agent's injected system reminder and is not configurable by the user who triggered the side question.

- **Side-question response finality**: The isolated side-question agent is constrained to a single response turn with no follow-up. It cannot offer to investigate further, promise future actions, or solicit clarification beyond what is answerable from existing context.

- **Sub-agent prompt integrity**: The orchestration layer enforces that sub-agents must receive fully self-contained prompts. The system context explicitly prohibits delegation patterns that push synthesis or understanding onto the sub-agent — the coordinating agent must resolve ambiguity before handoff. This is a behavioral norm enforced by instruction, not a hard runtime block, but it is pre-configured and not derived from user input.

- **Loop self-pacing discipline**: The autonomous loop mechanism operates under a hardcoded constraint that the coordinating agent must call the delay tool as the final action of each turn. Omitting this call is the designated termination signal. The structure — confirm, arm monitor if needed, then delay — is prescribed and not user-adjustable at the instruction level.

- **Scheduled task expiry enforcement**: Recurring scheduled tasks have a hardcoded age-out policy. Once a task exceeds its maximum age threshold, it is deleted after its final firing. Users cannot extend task lifetime beyond this ceiling through instruction.

- **Voice circuit-breaker suppression**: The voice input subsystem contains a hardcoded circuit-breaker that suppresses new voice sessions after a threshold of early failures within a measurement window. Session suppression continues until one successful session is observed. This is automatic and not bypassed by retrying without fixing the underlying issue.

- **Display environment detection**: CC automatically detects specific terminal environments (iTerm2 tmux integration mode, Windows-over-SSH ConPTY rendering) and disables fullscreen rendering. An environment variable override exists, but the detection and default suppression behavior is hardcoded.

---

## Default Behaviors

- **Plan-mode clarification posture**: By default, when in plan mode CC uses the designated clarification tool to gather all information it needs before proceeding, and bundles all clarifying questions into a single interaction. Users can influence the scope and framing of questions by providing more complete initial prompts, reducing the clarification burden.

- **Plan continuity evaluation**: When re-entering plan mode with an existing plan file present, CC defaults to evaluating whether the current request is a continuation of or a departure from the prior plan, then acts accordingly — overwriting for new tasks, refining for continuations. Users influence this by the framing of their request; explicitly signaling "continue" vs. a fresh task description steers the default evaluation.

- **Sub-agent briefing style**: CC defaults to treating sub-agents as context-free collaborators who need full situational briefings. The default prompt style favors specificity — file paths, line numbers, exact questions — over high-level delegation. Users who provide vague orchestration instructions will receive outputs that reflect this default (CC will attempt to fill in specificity itself rather than pass vague instructions downstream).

- **Fallback heartbeat cadence in loops**: For autonomous loop operations where an event monitor is the primary wake signal, the fallback heartbeat delay defaults to a range that avoids redundant cache-window polling. Users can influence the delay value by context (what was observed, what event is expected), but the default bias toward longer idle intervals is pre-set.

- **Worktree spawn mode**: The remote-control feature defaults to same-directory session spawning. Users can switch to worktree isolation mode (each on-demand session gets its own git worktree) or classic single-session mode via explicit flags or by pressing the runtime toggle key.

- **Remote session pre-creation**: A session is pre-created on remote-control startup so the workspace is immediately available. This default can be disabled via an explicit flag.

- **MCP elicitation UI**: When an MCP server triggers an elicitation event, CC displays the elicitation prompt to the user and captures the response. This behavior fires automatically on the relevant event; it is not something users opt into per-session.

- **Syntax highlighting vocabulary**: CC's code editor and display layer ships with hardcoded keyword lists for a wide range of languages (SQL dialects, Pascal/Delphi, SAS, PowerShell, and others). The set of recognized languages is fixed at this bundle version; users cannot add new language definitions at runtime without a bundle update.

---

## CLAUDE.md Redundancy Warning

- **Plan-mode behavioral rules**: The system context already fully specifies plan-mode behavior — what is read-only, what file may be written, how clarification should be gathered, and how re-entry should be handled. Adding plan-mode instructions to CLAUDE.md is largely redundant. Instructions that conflict with the hardcoded execution lock (e.g., "go ahead and make small edits even in plan mode") will fail silently or create instruction conflict, because the system-level constraint is described as superseding all others.

- **Sub-agent orchestration style**: The system context already provides detailed guidance on how to brief sub-agents, including the prohibition on delegating synthesis. CLAUDE.md instructions about "how to delegate tasks" or "how to write agent prompts" are redundant with this pre-existing layer. Conflicting instructions (e.g., "keep sub-agent prompts brief and high-level") may degrade output quality by pulling against the default briefing discipline.

- **Loop termination protocol**: The loop self-pacing structure — including when to arm monitors, how to confirm, and how to terminate — is pre-specified. CLAUDE.md loop instructions that attempt to redefine this protocol may conflict with the hardcoded turn-ending constraint.

- **Clarification bundling**: The default of collecting all clarifying questions in a single interaction is already set. CLAUDE.md instructions to "ask one question at a time" may conflict with this default, producing inconsistent behavior depending on which instruction wins at inference time.

- **Code display and syntax behavior**: Language keyword vocabularies and display rendering decisions are compile-time constants in this bundle. CLAUDE.md instructions about syntax highlighting preferences or display formatting have no effect on the underlying vocabulary tables.

---

## User Actionable Insights

1. **Plan-mode execution lock is truly absolute.** The system context explicitly states this constraint supersedes all other instructions. No CLAUDE.md entry, no inline user instruction, and no operator configuration can cause CC to perform writes during active plan mode. If you need CC to act, exit plan mode explicitly.

2. **Side-question agents have zero capability by design.** When CC spawns a lightweight agent to answer a side question, that agent has no tools. It can only answer from conversation context already in scope. Do not expect side-question responses to reflect file contents, command output, or any information not already present in the conversation.

3. **Sub-agent prompt quality is your responsibility.** The system context instructs CC to write specific, fully-contextualized sub-agent prompts — but if you give CC a vague top-level instruction, it must infer specificity, which introduces error. Providing explicit file paths, function names, and scoped questions in your instruction to CC directly improves sub-agent output quality.

4. **Loop operations have a built-in termination convention.** To stop an autonomous loop, the correct signal is to omit the delay-tool call. Understanding this means you can also recognize when a loop is not terminating correctly — if CC keeps calling the delay tool, it has not received or evaluated a stop condition.

5. **Event monitors and heartbeat delays are separate concerns.** In loop mode, an armed event monitor is the primary wake signal; the delay value is only a safety fallback. Setting a very short delay in a loop instruction does not make the loop more responsive to events — it only increases idle polling overhead.

6. **Remote-control worktree isolation requires a git repository.** The worktree spawn mode, which isolates each on-demand session into its own git worktree, has a hard prerequisite: the working directory must be a git repository, or WorktreeCreate/WorktreeRemove hooks must be configured. This is version-specific behavior for v2.1.168.

7. **MCP elicitation is event-driven and automatic.** If an MCP server you have configured sends an elicitation event, CC will display it. There is no per-session opt-out at the instruction level; the behavior is wired to the event.

8. **The `CLAUDE_CODE_NO_FLICKER=1` environment variable is the only override for display suppression.** If you are running CC in iTerm2 with tmux integration or over SSH on Windows, fullscreen is disabled by default. The environment variable is the designated escape hatch; instruction-level overrides have no effect on this rendering decision.

9. **Scheduled tasks expire by age, not just by explicit cancellation.** If you rely on long-running recurring tasks, be aware that the bundle enforces a maximum task age after which the task fires once more and is then deleted. Plan for task re-registration if your workflow duration may exceed this ceiling.

10. **CLAUDE.md is downstream of the system context.** In any conflict between a CLAUDE.md instruction and a system-context-level behavioral rule, the system context wins for hardcoded constraints and may win for strong defaults. Use CLAUDE.md to fill gaps and tune defaults — not to override fundamental behavioral architecture.

---

## Tool & Permission Layer

**Sub-agent orchestration model**: The system context embeds a detailed sub-agent dispatch model. The coordinating agent evaluates each task to decide whether to handle it directly or fork it to a named sub-agent. Forked agents receive a fully specified prompt and, optionally, a sub-agent type designation that starts the agent with a fresh context rather than inheriting the coordinator's conversation history. Results return asynchronously as user-role notification messages, not as inline coordinator output — the coordinator explicitly does not have findings until the notification arrives.

**Side-question agent injection**: A dedicated system-reminder tag pattern is used to inject behavioral constraints into lightweight side-question agents. This tag signals to the receiving agent its role, capability limits (no tools), response finality (single turn), and prohibited language patterns (no offers to investigate or take action). The tag is injected at spawn time and is not visible or modifiable by the end user.

**Event monitor / scheduled task machinery**: CC's loop infrastructure uses a persistent monitor tool that can be armed to watch for specific observable events (CI completion, log line matches, file changes, PR comments). The monitor delivers wake events as task-notification messages. A separate scheduling system handles recurring tasks with age-based expiry. The two systems are complementary: monitors respond to events, schedules provide time-based fallback.

**MCP server event handling**: Two telemetry-instrumented event points exist for MCP elicitation — one when the elicitation UI is shown and one when the user responds. A separate event fires when the MCP server list changes. These hooks indicate that MCP state changes and user interactions with MCP prompts are tracked as discrete telemetry events in this version.

**Voice input subsystem**: The voice layer implements a circuit-breaker pattern with telemetry instrumentation at multiple points: session start, early retry detection, circuit-breaker trip, recording completion, and silent-drop replay. The silent-drop handler detects audio stream failures (no data within a timeout window) and attempts session replay on a fresh connection. The circuit-breaker halts new sessions after repeated early failures and requires a successful session to reset.

**Display/rendering permission layer**: Terminal capability detection runs at startup and gates fullscreen rendering on environment type. The detection logic checks for specific terminal integration signals and suppresses potentially disruptive rendering modes automatically. The `CLAUDE_CODE_NO_FLICKER=1` environment variable is the designated permission override for users who have verified their terminal handles these modes correctly.

**Remote-control session permission modes**: The remote-control feature exposes a `--permission-mode` flag that governs the permission level of spawned sessions. The available modes are embedded in the CLI help text. Session capacity limits are also configurable, with a hardcoded default. These parameters constitute the user-facing permission surface for multi-session remote operation.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.168 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| A | Main system context assembler; contains language keyword tables (PowerShell verbs, SAS functions), plan-mode behavioral strings, remote-control CLI help, and macOS plist template |
| _ | Secondary context assembler; contains Java/AspectJ keyword table, Pascal/Delphi keyword table, SAS statement keyword table, and autonomous loop self-pacing behavioral strings |
| L | SQL/PostgreSQL keyword assembler; contains PostgreSQL DDL/DML keyword table, side-question agent system-reminder injection string, and PostgreSQL data type table |
| $ | Sub-agent orchestration guidance assembler; contains sub-agent dispatch examples and PostgreSQL type keyword table |
| M | Sub-agent prompt writing guidance assembler; contains briefing style and delegation discipline instructions |
| HH | Voice circuit-breaker and buffer-flush handler; telemetry: `tengu_voice_circuit_breaker_tripped`, `tengu_voice_recording_started`, `tengu_voice_stream_early_retry` |
| r | Voice silent-drop and no-audio detection handler; telemetry: `tengu_voice_silent_drop_replay`, `tengu_voice_recording_completed` |
| U | DIRECTUM/ECM system reference table assembler; contains SYSREF_* object type vocabulary |
| AH | Unicode/character encoding delta table (compact diff-encoded) |
| $1 | Terminal environment detection and fullscreen suppression handler; telemetry: `tengu_pewter_brook` |
| d | Scheduled task age-out and expiry handler; telemetry: `tengu_scheduled_task_fire`, `tengu_scheduled_task_expired` |
| fH | MCP elicitation UI event handler; telemetry: `tengu_mcp_elicitation_shown`, `tengu_mcp_elicitation_response` |
| Q | Background session socket cleanup handler; telemetry: `tengu_bg_adopt_sock_unlinked` |
| MH | MCP server list change event handler; telemetry: `tengu_mcp_list_changed` |
| Of8 | No large strings; assembler role undetermined from content alone |
| vL9 | No large strings; assembler role undetermined from content alone |
| S9 | No large strings; assembler role undetermined from content alone |
| gC | No large strings; assembler role undetermined from content alone |
| liH | No large strings; assembler role undetermined from content alone |
| a | No large strings; late-bundle assembler, role undetermined |
| Mf8 | No large strings; assembler role undetermined from content alone |
| $f8 | No large strings; assembler role undetermined from content alone |
| kL9 | No large strings; assembler role undetermined from content alone |
| c | No large strings; late-bundle assembler, role undetermined |
| zH | No large strings; assembler role undetermined from content alone |
| xE_ | No large strings; assembler role undetermined from content alone |
| IL9 | No large strings; assembler role undetermined from content alone |
| n | No large strings; late-bundle assembler, role undetermined |
| s | No large strings; assembler role undetermined from content alone |
| $H | No large strings; assembler role undetermined from content alone |