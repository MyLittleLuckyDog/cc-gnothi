---
type: system-context
command: _system-context
cc_version: "2.1.161"
updated: "2026-06-03"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.161 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.161 System Context

> Analysis basis: CC v2.1.161 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.161 system context is assembled from multiple discrete function-level string segments that are concatenated at runtime into a unified system prompt delivered to the underlying model. These segments collectively govern security and trust policy, role and identity framing, tool invocation behavior, subagent orchestration guidance, autonomous loop operation, and documentation self-awareness. The assembled context sits above user instructions and CLAUDE.md in terms of priority for hardcoded constraints, but many of its default behaviors are designed to be tunable through user configuration. Understanding this layer helps distinguish what CC will always do from what it will do until told otherwise.

---

## Hardcoded Constraints

- **Tool-denial bypass prohibition**: When a tool call is blocked or denied, CC is constrained to seek alternative tools only through reasonable, intent-respecting means. Attempting to subvert the purpose of a denial — for example, by repurposing a permitted capability to perform an action that was explicitly disallowed — is categorically blocked. If no compliant path exists, CC must surface the limitation to the user and halt rather than proceed.

- **Subagent context isolation enforcement**: When spawning a subagent with a fresh context (i.e., one that does not inherit the parent conversation), CC is required to provide the subagent with a fully self-contained prompt that includes all necessary background, goals, and constraints. Relying on implicit shared state that the subagent cannot access is treated as a prompt construction error, not an acceptable shortcut.

- **Autonomous scope boundary**: During autonomous loop operation, CC is constrained to act only on work that the existing conversation transcript clearly establishes as authorized. Inventing new work items, initiating irreversible changes without documented user intent, or making judgment calls that require user decisions are all treated as out-of-scope actions. The constraint is absolute in the sense that the default is to wait or surface uncertainty; there is no "probably fine" override path.

- **Side-question agent tool restriction**: When CC spawns a lightweight parallel agent to answer an incidental user question without interrupting the main agent, that sub-instance is hardcoded to have no tool access. It cannot read files, run commands, search, or take any action. This constraint cannot be overridden by the spawning agent's instructions — the architecture enforces it structurally.

- **Knowledge currency acknowledgment**: CC is constrained to acknowledge when its training-data knowledge of its own configuration may be stale. It must not silently answer questions about commands, flags, or settings from training memory alone when live configuration data or documentation is available and contradicts or supersedes that memory.

- **Denial communication requirement**: When a blocked action prevents completing a user request, CC is required to explain what it was attempting and why the permission is needed, and to transfer the decision back to the user. Silent failure or opaque substitution is not permitted.

---

## Default Behaviors

- **Documentation freshness preference**: By default, CC prioritizes live-fetched documentation over training-data knowledge when answering questions about its own configuration. Users can influence this only indirectly (e.g., by operating in a network-restricted environment), at which point CC falls back to training data with an explicit staleness caveat. The fallback behavior — including the caveat language — is itself a default that users cannot suppress.

- **Subagent prompt verbosity**: CC defaults to writing fully self-contained subagent prompts that include goal context, background, file paths, line numbers, and explicit success criteria. Users can influence the level of detail by scoping tasks more narrowly, but the principle of not delegating synthesis or understanding to the subagent is a strong default that resists instruction to the contrary.

- **Autonomous loop reporting style**: When operating in autonomous/daemon mode and finding nothing actionable, CC defaults to a single-sentence status report and stops. It does not narrate its checking process or enumerate things it might do later. Users can influence task scope and loop cadence through configuration, but the minimal-reporting-when-idle behavior is the embedded default.

- **CI and PR maintenance priority ordering**: In autonomous mode, CC applies a default priority hierarchy — active conversation work first, then PR/CI maintenance, then opportunistic sweep work. Users can shift this by restructuring what is present in the conversation transcript, but the priority ladder itself is fixed in the system context.

- **Loop timing and heartbeat selection**: The autonomous loop defaults to choosing delay intervals based on observed activity level (shorter when work is in flight, longer on quiet branches), with a specific fallback range when an event-based monitor is armed. Users can influence this through loop configuration parameters, but the reasoning heuristic is embedded.

- **Parallel batch orchestration phasing**: When orchestrating large parallelizable changes, CC defaults to a research-and-plan phase before spawning workers, requiring plan approval before proceeding. Users can influence unit granularity and worker count, but the gated two-phase structure (plan then spawn) is the default workflow.

- **Worktree isolation for batch workers**: CC defaults to spawning batch worker agents with worktree isolation and background execution. This default can be overridden only if the task structure genuinely does not require isolation, but the system context frames worktree isolation as the expected norm.

- **E2E verification inclusion**: When planning batch work, CC defaults to identifying and specifying an end-to-end verification recipe for workers. If no automated path is found, the default is to ask the user rather than skip verification. Users can explicitly authorize skipping, but the default is to require it.

---

## CLAUDE.md Redundancy Warning

- **Subagent prompt completeness**: The system context already instructs CC to write fully self-contained subagent prompts including all relevant context. Adding instructions in CLAUDE.md such as "always give subagents full context" or "include file paths in agent prompts" is redundant. Conflicting instructions that encourage brevity in subagent prompts may create tension with the hardcoded guidance and produce inconsistent behavior.

- **Autonomous scope conservatism**: The system context already establishes that CC should lean toward established work rather than inventing new tasks during autonomous operation. CLAUDE.md entries that attempt to expand autonomous initiative (e.g., "feel free to refactor adjacent code you notice") may conflict with the embedded conservatism and produce unpredictable scope behavior depending on how the instruction conflict resolves.

- **Idle reporting minimalism**: The system context already instructs CC to report minimally when nothing is found during autonomous checks. Adding CLAUDE.md instructions like "always summarize what you checked" directly conflicts with this default and will override it — which may or may not be the user's intent.

- **Documentation self-check before answering**: The system context already instructs CC to consult live configuration and bundled references before answering questions about itself. CLAUDE.md instructions like "use your knowledge to answer Claude Code questions" are redundant at best and potentially counterproductive if they discourage the live-fetch behavior.

- **Plan approval gating for batch work**: The system context already requires user approval between planning and worker-spawning phases. CLAUDE.md instructions to "proceed without asking for confirmation" may or may not override this gate depending on how broadly CC interprets the instruction scope — users should be explicit if they want to waive the approval step for batch orchestration specifically.

- **Priority ordering in autonomous mode**: The system context already encodes a fixed priority ladder for autonomous work. CLAUDE.md instructions that attempt to reorder priorities (e.g., "always check CI first") introduce ambiguity rather than clean override, since the embedded heuristic and the CLAUDE.md instruction will compete.

---

## User Actionable Insights

1. **Tool denial is a hard stop, not a hint.** When CC tells you it cannot complete an action because a permission was denied, it has already determined that no compliant workaround exists. The appropriate response is to grant the permission, restructure the task, or accept the limitation — not to rephrase the request expecting CC to find a bypass.

2. **Subagent prompts require your context investment, not CC's improvisation.** The system context explicitly instructs CC not to delegate synthesis to subagents. If you give CC a vague high-level task to farm out, the embedded behavior will push it to ask you for specifics rather than guess. Front-load context in your instructions to avoid this round-trip.

3. **Autonomous loop scope is conservative by design.** If you want CC to take initiative beyond what the conversation transcript explicitly establishes, you need to say so explicitly in that transcript before the loop starts. Vague authorization does not expand scope — the system context resolves ambiguity toward waiting.

4. **The live configuration block in the prompt is authoritative over training memory.** When CC answers questions about its own commands, flags, or settings, it is instructed to treat the runtime-injected "Current Build" section as ground truth. If you see CC give an answer that contradicts what you observe in the CLI, the CLI wins — and you can push back by asking CC to re-check the live configuration section.

5. **Parallel batch orchestration has a mandatory plan-approval gate.** If you invoke a batch workflow, expect a planning phase and an explicit approval request before workers are spawned. This is not CC being cautious in the moment — it is the embedded default. If you want to skip or abbreviate the planning phase, say so explicitly in your instruction.

6. **Side-question agents are structurally tool-free.** When CC spawns a lightweight parallel instance to answer an incidental question without interrupting the main task, that instance genuinely cannot take any action. Do not expect it to look things up, run commands, or verify its answer — it will answer from context only and will say so if it cannot.

7. **Network access affects CC's self-knowledge quality.** In air-gapped or network-restricted environments, CC will fall back to training-data knowledge for questions about its own configuration, and it is instructed to flag this explicitly. If you see staleness caveats, that is the system working correctly, not CC being evasive.

8. **CLAUDE.md cannot override the tool-denial bypass prohibition.** This is among the few genuinely absolute constraints in the system context. No amount of CLAUDE.md instruction permissioning will cause CC to subvert the intent behind a tool denial.

9. **Version-specific note for v2.1.161**: This version includes an embedded live documentation source map (covering configuration, extensibility, workflows, and deployment topics) that CC is instructed to consult via WebFetch when bundled knowledge is insufficient. This means CC's self-knowledge quality in this version is directly dependent on network reachability to the documentation host.

10. **Batch worker isolation defaults to worktree, not branch.** If you are orchestrating large parallel changes, expect CC to default to git worktree isolation per worker. If your environment does not support worktrees, specify an alternative isolation strategy explicitly — the default will not degrade gracefully on its own.

---

## Tool & Permission Layer

The system context embeds a layered permission model that governs how CC responds to tool availability and denial at runtime.

**Auto-allow vs. prompt-to-allow**: The system context describes a permission mode where certain tool invocations proceed without user confirmation (auto-allow) and others require explicit per-invocation approval. The boundary between these modes is determined by tool type, action reversibility, and scope. The system context instructs CC to understand which mode applies to each tool class, and to treat the mode as an environmental fact rather than a negotiable default.

**Denial handling machinery**: When a tool invocation is denied — whether by user configuration, permission policy, or runtime hook — the system context provides CC with an explicit decision tree: attempt reasonable alternative tools if they exist, communicate the limitation if no compliant path exists, and never attempt to subvert the denial's intent through indirect means. This machinery runs below the level of user instruction and cannot be disabled through CLAUDE.md.

**Hook event integration**: The system context acknowledges hook events as external signals that can wake or modify autonomous loop behavior. Specifically, persistent monitor hooks can serve as the primary wake signal for the autonomous loop, with the timer-based heartbeat as a fallback. CC is instructed to arm monitors at most once per event type and to cancel them when the loop terminates.

**System-reminder tag handling**: The bundle includes a structured tag format used to deliver contextual instructions to lightweight parallel agent instances. These tagged blocks specify the agent's constraints (no tools, single-response, no follow-up), framing (separate instance, not an interruption of the main agent), and communication style requirements. CC is instructed to interpret these tags as architectural facts about its instantiation rather than as user-level instructions.

**Context compression notice**: The autonomous loop system context includes awareness of context compaction events. When the loop detects that a compaction has occurred since a previous invocation, it is instructed to treat the first post-compaction invocation as a fresh start for certain orientation steps, while still reading the compressed context summary to reconstruct task state.

**MCP server awareness**: The system context instructs CC to treat the list of configured MCP servers as part of the live build configuration (alongside slash commands and settings keys), meaning MCP server availability is presented to CC as a runtime fact to be consulted rather than assumed from training data.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.161 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `h` | Dashboard UI JavaScript assembler (collapsible panels, clipboard copy, histogram rendering) |
| `L` | SQL keyword / PostgreSQL token list assembler; also contains side-question system-reminder tag template |
| `$` | Coordinator subagent usage example assembler (fork-style orchestration with notification loop) |
| `O` | Simpler subagent usage example assembler (single-result delegation pattern) |
| `Z` | Autonomous loop tick instruction assembler (step sequencing, monitor arming, delay selection, sentinel prompt) |
| `M` | Subagent prompt-writing guidance assembler (briefing quality, context completeness, delegation anti-patterns) |
| `b` | Subtask block property constant list assembler |
| `G` | Pseudoreference code constant list assembler |
| `S` | Validation rule ID constant list assembler |
| `P` | Dataset event type constant list assembler |
| `D` | Daemon configuration reload telemetry handler |
| `w` | Background dispatch telemetry handler (SIGKILL escalation, low memory, spare agent lifecycle) |
| `h56` | Minimal assembler call (no large strings, no telemetry — likely a stub or passthrough) |
| `f` | Minimal assembler call (no large strings, no telemetry — likely a stub or passthrough) |
| `X` | Minimal assembler call (no large strings, no telemetry — likely a stub or passthrough) |
| `j` | Minimal assembler call (no large strings, no telemetry — likely a stub or passthrough) |
| `z` | Minimal assembler call (no large strings, no telemetry — likely a stub or passthrough) |
| `J` | Minimal assembler call (no large strings, no telemetry — likely a stub or passthrough) |
| `R` | Minimal assembler call (no large strings, no telemetry — likely a stub or passthrough) |
| `y` | Minimal assembler call (no large strings, no telemetry — likely a stub or passthrough) |
| `I` | Minimal assembler call (no large strings, no telemetry — likely a stub or passthrough) |
| `V` | Dashboard CSS stylesheet assembler (layout, typography, component styles for analytics UI) |
| `Y` | PostgreSQL SQLSTATE / error code constant list assembler |
| `Cs_` | Tool-denial bypass constraint injector (permission-boundary behavior after tool block) |
| `sZ_` | Autonomous loop check prompt assembler (stewardship framing, scope rules, PR/CI maintenance guidance) |
| `J0K` | Live documentation source map assembler (WebFetch URL table for CC docs by topic) |
| `l2K` | Files API Python reference assembler (beta SDK usage, upload/retrieve/delete patterns) |
| `fof` | Batch parallel orchestration prompt assembler (phase 1 plan, phase 2 spawn, phase 3 tracking) |
| `E0K` | CC configuration self-help skill assembler (knowledge-currency policy, lookup routing, answering style) |
| `OWK` | Claude Platform on AWS skill assembler (SigV4 auth, client setup, feature parity notes vs. Bedrock) |