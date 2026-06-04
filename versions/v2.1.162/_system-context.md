---
type: system-context
command: _system-context
cc_version: "2.1.162"
updated: "2026-06-04"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.162 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.162 System Context

> Analysis basis: CC v2.1.162 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.162 system context is assembled from multiple cooperating bundle functions that collectively define the behavioral envelope within which the assistant operates. The context covers domains including plan-mode enforcement, sub-agent orchestration, side-question handling, tool permission governance, scheduling and loop behavior, and voice input circuit-breaking. User instructions and CLAUDE.md content interact with this layer but cannot override its hardcoded constraints; defaults established here serve as the baseline that user configuration may adjust within permitted bounds. The system context is injected programmatically at session initialization and may be supplemented by `<system-reminder>` tags during runtime for specific sub-agent or side-question contexts.

---

## Hardcoded Constraints

- **Plan-mode execution block**: When plan mode is active, CC is prohibited from executing any tool that causes side effects — this includes file edits, configuration changes, shell commands with write semantics, and commit operations. This restriction supersedes all other instructions, including any directive in CLAUDE.md or an operator system prompt that would otherwise authorize action. The constraint is absolute for the duration of plan-mode activation and cannot be lifted by user instruction alone.

- **Plan-mode file scope**: While in plan mode, the only file CC is permitted to write to or modify is the designated plan file. All other filesystem interactions must be read-only. This is not a soft default — it is a bounded execution contract enforced by the system context regardless of task scope.

- **Sub-agent prompt completeness**: When CC delegates a task to a sub-agent, the orchestrating layer enforces the requirement that the delegated prompt be self-contained. The sub-agent is treated as having zero prior context from the parent session. Prompts that rely on implicit shared understanding or that defer synthesis back to the sub-agent ("based on your findings, fix it") violate the intended delegation model. This is a behavioral invariant of the orchestration layer.

- **Side-question agent tool isolation**: Sub-agents instantiated specifically to handle side questions operate under a hardcoded constraint: no tools are available to them. They cannot read files, run commands, perform searches, or take any system action. Their response must be derived entirely from conversation context already in scope. This constraint is injected via a `<system-reminder>` tag and cannot be altered by the primary session's instructions.

- **Side-question framing prohibition**: The side-question agent is explicitly prohibited from framing its response as if it were interrupted mid-task or resuming prior work. It must respond as a separate, independent instance. This framing constraint is enforced in the injected reminder and is not user-configurable.

- **Loop self-pacing termination protocol**: The self-pacing loop system enforces a specific termination contract — to stop a running loop, the loop must explicitly omit the continuation call and cancel any armed monitoring tasks. There is no passive timeout that substitutes for explicit termination. This structural requirement is hardcoded into the loop skill's operating instructions.

- **Voice circuit breaker**: The voice input subsystem enforces an automatic suppression policy when repeated early failures are detected within a session. Once the circuit breaker trips, new voice sessions are suppressed until at least one succeeds. This behavior is not user-configurable within a session and is governed by internal failure-rate thresholds.

- **Scheduled task expiry**: Recurring scheduled tasks have a maximum age enforced by the system. Tasks that age out are fired one final time and then deleted automatically. This lifecycle policy is hardcoded and does not require user action.

---

## Default Behaviors

- **Plan file management on re-entry**: When CC re-enters plan mode and a plan file already exists from a prior session, the default behavior is to evaluate the existing plan before taking any new planning action. The default decision logic distinguishes between a continuing task (modify and clean the existing plan) and a new or different task (overwrite the plan entirely). Users can influence which path is taken by being explicit about whether their request is a continuation or a fresh start — ambiguity defaults to treating it as a fresh session.

- **Sub-agent briefing style**: The default prompt-writing posture for sub-agent delegation is to treat the sub-agent as a capable but context-free peer — one who requires full situational background, explicit scope, and specific artifacts (file paths, line numbers, concrete questions). The default is toward over-specification rather than under-specification. Users can adjust the verbosity of delegation prompts, but reducing context below what the sub-agent needs to make independent judgments degrades output quality in a predictable way.

- **Loop wake signal selection**: The self-pacing loop defaults to using a persistent monitoring task as the primary wake signal when the next meaningful action is gated on an observable external event (CI completion, file change, log pattern). The fallback heartbeat delay defaults to a range designed to avoid redundant idle ticks beyond the context cache window. Users can influence the delay value and reason, but the architectural default favors event-driven wake-up over polling.

- **Remote control session spawning**: The default spawn mode for remote control sessions is same-directory. The default capacity and session pre-creation behavior are set at the system level. Users can override spawn mode (switching to worktree or session modes), capacity limits, and session naming via flags or environment variables.

- **Fullscreen rendering suppression**: CC automatically detects certain terminal integration environments (iTerm2 tmux integration, Windows-over-SSH via ConPTY) and disables fullscreen rendering by default to prevent visual artifacts. Users can override this suppression via an environment variable, accepting responsibility for any resulting rendering issues.

- **MCP elicitation interaction**: When an MCP server triggers an elicitation event, CC defaults to surfacing the elicitation dialog to the user and recording the response. The handling is event-driven and follows the MCP server's declared requirements. Users interact with this via the elicitation UI rather than by configuring the behavior directly.

---

## CLAUDE.md Redundancy Warning

- **Plan-mode behavior**: The system context fully specifies plan-mode constraints, including what is permitted, what is blocked, and how re-entry is handled. Adding plan-mode instructions to CLAUDE.md is largely redundant. Instructions that conflict with the hardcoded execution block (e.g., "always apply edits even in plan mode") will be overridden by the system constraint — they will not take effect and may create confusing apparent contradictions.

- **Sub-agent delegation style**: The system context already establishes a detailed posture for how sub-agent prompts should be written, emphasizing context completeness and avoiding deferred synthesis. CLAUDE.md instructions reiterating "be detailed in sub-agent prompts" are neutral redundancy. Instructions that contradict this (e.g., "keep sub-agent prompts brief") may degrade delegation quality without error feedback.

- **Loop continuation and termination**: The loop skill's operating contract — including how to arm monitors, reset the safety net, and terminate cleanly — is embedded in the system context. Users who add loop management instructions to CLAUDE.md risk creating instruction conflicts if their phrasing differs from the system-level protocol, particularly around termination semantics.

- **Side-question handling**: The system context already governs how side questions are handled, including the tool isolation constraint and framing prohibition. CLAUDE.md instructions about how CC should respond to questions asked mid-task are redundant if they merely restate these constraints. Instructions that assume tool availability for side-question responses will be silently voided by the injected `<system-reminder>` override.

- **Response completeness in delegation prompts**: The system context instructs CC to never delegate understanding — prompts must encode what has already been learned, not ask the sub-agent to infer it. CLAUDE.md entries like "include context in all prompts" are neutral redundancy. Entries like "let the agent figure out the approach" directly conflict with the hardcoded delegation model.

---

## User Actionable Insights

1. **Plan mode is an absolute execution boundary.** No user instruction, operator prompt, or CLAUDE.md entry can cause CC to execute side-effecting actions while plan mode is active. If CC appears to refuse edits, confirm whether plan mode is engaged before attempting to override through instruction.

2. **Sub-agent prompts must be self-contained by design.** If delegated sub-tasks return shallow or context-unaware results, the most likely cause is an under-specified delegation prompt, not a model capability issue. The system enforces this design pattern; users benefit from internalizing it when structuring complex multi-step tasks.

3. **Side-question agents have no tools.** When CC spawns a lightweight instance to answer a question posed during a long-running task, that instance cannot consult files or run commands. Answers are bounded by conversation context. Users should not expect side-question responses to reflect current filesystem state or command output.

4. **The loop system is event-driven, not purely time-driven.** Users operating `/loop`-style workflows gain efficiency by ensuring that observable events (CI signals, file changes) are available for the monitor to arm against. Pure time-based polling is the fallback, not the default.

5. **Voice input has a session-scoped circuit breaker.** Repeated microphone or stream failures within a session will cause voice input to be automatically paused. The recovery path is to address the underlying hardware or connectivity issue and retry — there is no in-session configuration toggle to disable the circuit breaker.

6. **Remote control session behavior is configurable at launch time, not runtime.** Spawn mode, capacity, and naming are set via flags when the remote control server starts. Users who need worktree isolation for concurrent sessions must specify this at invocation, not after sessions are active.

7. **Fullscreen suppression is environment-aware and overridable.** If CC is running in a terminal environment where fullscreen is being suppressed (iTerm2 tmux integration or Windows SSH), and the user wants to re-enable it, the `CLAUDE_CODE_NO_FLICKER=1` environment variable is the correct override path — not a CLAUDE.md instruction.

8. **MCP list changes are observable events.** The telemetry layer records when the MCP server list changes during a session. Users building integrations that depend on MCP server availability should account for the possibility of mid-session list changes and their effect on tool availability.

9. **Scheduled tasks have a system-enforced maximum lifespan.** Users relying on recurring scheduled tasks for long-running automation should be aware that tasks age out and are not renewed automatically. Automation that must persist beyond the expiry window needs to be re-registered.

10. **CLAUDE.md is most valuable for project-specific context, not behavioral overrides.** Because the system context already establishes detailed behavioral policies for delegation, planning, looping, and side-question handling, the highest-leverage use of CLAUDE.md is project knowledge (architecture notes, file layout, domain conventions) rather than behavioral re-instruction that may conflict silently.

---

## Tool & Permission Layer

The system context embeds a layered permission model that governs how tools are invoked and confirmed during task execution.

**Plan-mode tool gating** represents the strictest permission layer: in this mode, only read-only tools are permitted, and the plan file is the sole writable artifact. This gate is enforced before any other permission check and cannot be bypassed by downstream authorization.

**Sub-agent tool scoping** creates a second permission boundary: sub-agents spawned for side questions inherit an explicitly restricted tool set (no tools at all), while sub-agents spawned for delegation tasks inherit a tool set appropriate to their declared purpose. The system context communicates this scoping via injected `<system-reminder>` tags at sub-agent instantiation.

**Monitoring and scheduling tools** operate with a `persistent: true` semantic, meaning they survive individual turn boundaries and continue to fire events asynchronously. The loop system's design assumes that armed monitors deliver `<task-notification>` messages as user-role events, waking the loop without requiring explicit polling. The permission model for these tools is implicitly always-on once armed; explicit cancellation is required to stop them.

**MCP elicitation events** (`tengu_mcp_elicitation_shown`, `tengu_mcp_elicitation_response`) represent a distinct permission interaction surface: when an MCP server requests information from the user, the system surfaces a dialog and records the response. This flow is separate from the standard tool-call confirmation flow and is driven by the MCP server's declared schema rather than by CC's internal tool registry.

**Context compression** is handled transparently by the runtime; the system context does not expose a user-facing compression toggle, but the loop system's delay guidance explicitly accounts for the context cache window, suggesting the system context is aware of compression boundaries and designs pacing recommendations around them.

**Session resumption** is a tracked lifecycle event. When a session resumes after interruption, the system context layer re-establishes behavioral state, including any active plan-mode status, armed monitors, and scheduled task registrations that survived the session boundary.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.162 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| A | Primary assembler: plan-mode enforcement, loop skill, remote-control help text, macOS plist, language keyword tables (PowerShell verbs, SAS functions) |
| _ | Language keyword assembler: Java/AspectJ keywords, Pascal/Delphi keywords, SAS statements; loop self-pacing skill instructions |
| L | SQL keyword assembler (PostgreSQL DDL/DML/clauses); side-question system-reminder injector |
| $ | Sub-agent delegation example library; PostgreSQL data type keyword table |
| M | Sub-agent prompt-writing guidance assembler |
| s | Voice input circuit breaker and stream buffer handler |
| u | DIRECTUM/enterprise system reference table assembler (SYSREF_* identifiers) |
| AH | Unicode/character range delta-encoding table assembler |
| M1 | Terminal fullscreen suppression detector (iTerm2 tmux, Windows SSH/ConPTY) |
| l | Scheduled task expiry and final-fire handler |
| qH | MCP elicitation dialog event handler |
| g | Background session socket unlink handler |
| LH | MCP server list change event handler |
| _H | Session resumption event handler |
| e48 | Assembler stub (no large strings; no telemetry) |
| Hq9 | Assembler stub (no large strings; no telemetry) |
| Mq | Assembler stub (no large strings; no telemetry) |
| DC | Assembler stub (no large strings; no telemetry) |
| CnH | Assembler stub (no large strings; no telemetry) |
| r | Assembler stub (no large strings; no telemetry) |
| s48 | Assembler stub (no large strings; no telemetry) |
| t48 | Assembler stub (no large strings; no telemetry) |
| Aq9 | Assembler stub (no large strings; no telemetry) |
| d | Assembler stub (no large strings; no telemetry) |
| a0_ | Assembler stub (no large strings; no telemetry) |
| _q9 | Assembler stub (no large strings; no telemetry) |
| i | Assembler stub (no large strings; no telemetry) |
| a | Assembler stub (no large strings; no telemetry) |
| e | Assembler stub (no large strings; no telemetry) |
| $H | Assembler stub (no large strings; no telemetry) |