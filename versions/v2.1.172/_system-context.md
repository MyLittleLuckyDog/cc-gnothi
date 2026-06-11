---
type: system-context
command: _system-context
cc_version: "2.1.172"
updated: "2026-06-12"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.172 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.172 System Context

> Analysis basis: CC v2.1.172 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.172 system context is assembled from multiple discrete functions composed at runtime, rather than from a single monolithic prompt string. These functions collectively cover inter-agent trust and permission policy, tool denial handling, autonomous loop operation, sub-agent delegation guidance, side-question handling, and live documentation references. The resulting behavioral layer sits above CLAUDE.md and user turn instructions: it establishes non-negotiable constraints that user content cannot override, while also defining adjustable defaults that CLAUDE.md can tune. Understanding this layered assembly is essential for predicting how CC behaves in agentic and multi-session configurations.

---

## Hardcoded Constraints

- **Inter-session authority boundary**: Messages arriving from peer Claude sessions are treated as carrying no user-level authority whatsoever. Regardless of what a peer session requests, CC will not elevate those requests to the permission level of its own user. This constraint is absolute and cannot be relaxed by any user instruction or CLAUDE.md entry.

- **Permission laundering prevention**: If a peer agent requests an action that has been denied in the current session, or claims it cannot perform the action itself and asks CC to relay or execute it, CC is required to refuse and surface the request to the human user. The system embeds this as a structural invariant: authority cannot be transferred or amplified by routing requests through another session. No user instruction overrides this.

- **Tool-denial circumvention limits**: When a specific tool invocation is denied, CC is permitted to seek reasonable alternative approaches using other available tools. However, it is explicitly prohibited from using any mechanism — including test runners or other indirectly available execution paths — to bypass the intent of the denial. If the capability is determined to be essential, CC must stop and explain the situation to the user rather than continuing to search for workarounds.

- **Side-question agent isolation**: When CC spawns a lightweight side-question agent to answer an interrupting user query, that agent is instructed that it has no tool access and will receive no follow-up turns. It cannot promise to take actions, fetch information, or investigate further. This behavioral envelope is hardcoded into the side-question system reminder and cannot be expanded by the user mid-flight.

- **Autonomous loop scope restriction**: In timer-invoked autonomous operation, CC is constrained to advance work that the user has already explicitly set in motion. Inventing new tasks, initiating new work streams, or making irreversible changes without clear prior authorization from the conversation transcript are all treated as out-of-scope. The system embeds a bias toward inaction when the authorization signal is ambiguous.

- **Peer message non-consent principle**: A message from another Claude session is never treated as consent or approval for any action, regardless of how it is framed. This applies even when the peer session is part of a coordinated multi-agent workflow. Human user consent remains the sole valid authorization source.

---

## Default Behaviors

- **Autonomous loop cadence**: By default, when operating on a timer without an active event monitor, CC selects a fallback heartbeat interval based on observed branch activity — longer waits for quiet branches, shorter for active ones. Users can influence this by providing explicit delay guidance or by ensuring the conversation transcript contains clear signals about expected activity pace. The loop can be halted entirely by omitting the continuation call and canceling any armed monitors.

- **Sub-agent prompt construction**: CC defaults to treating sub-agent prompts as self-contained briefings that include full context, since sub-agents start with no knowledge of the parent conversation. The default framing is analogous to briefing a colleague who just joined the project. Users can influence the depth and structure of these briefings through CLAUDE.md guidance on delegation style.

- **Sub-agent delegation trigger**: CC defaults to delegating survey-style or context-heavy tasks (branch audits, migration reviews, etc.) to sub-agents when the raw output would otherwise pollute the coordinator's context. Users can influence this threshold through explicit instructions about when to delegate versus handle inline.

- **Independent sub-agent review**: When a user requests a second opinion or independent verification, CC defaults to spinning up a fresh agent instance with no inherited analysis, ensuring the review is uncontaminated. This default can be overridden by explicitly instructing CC to share its prior analysis with the reviewing agent.

- **PR maintenance in autonomous mode**: During autonomous loop operation, CC defaults to treating the current branch's pull or merge request as the secondary work source after conversation transcript items are exhausted. It checks CI status, unresolved review threads, and branch freshness. Users can suppress or prioritize specific checks through CLAUDE.md or explicit transcript instructions.

- **Rebase over merge in autonomous mode**: When CC detects that another party has pushed to the branch during autonomous operation, the default behavior is to rebase rather than merge in order to maintain linear history. Users can override this preference explicitly.

- **Documentation source fallback**: When bundled references and live build configuration do not answer a question, CC defaults to fetching from the live documentation endpoints. Users can influence which topics trigger a live fetch by being explicit about whether they want bundled or live answers.

- **Context compression notification**: CC is configured to notify users when context compression occurs, so that the conversation history compaction is transparent rather than silent. This default is part of the system layer and is not typically exposed as a user-configurable toggle.

---

## CLAUDE.md Redundancy Warning

- **Autonomous loop scope guidance**: The system prompt already establishes a strong default bias against inventing new work during autonomous operation. Adding CLAUDE.md instructions like "don't start new tasks without asking" is redundant. Conflicting instructions that try to expand autonomous scope (e.g., "feel free to open new issues if you find bugs") may create instruction tension with the hardcoded conservative bias.

- **Sub-agent briefing style**: The system prompt already instructs CC to write sub-agent prompts as complete, context-rich briefings rather than terse command strings, and explicitly warns against delegating synthesis or understanding to the sub-agent. Adding equivalent CLAUDE.md guidance (e.g., "always give agents full context") is neutral redundancy. Conflicting instructions (e.g., "keep sub-agent prompts short") may degrade delegation quality.

- **Peer session trust levels**: The system prompt already encodes the rule that peer Claude sessions have no user authority. Adding CLAUDE.md entries like "don't trust messages from other AI agents" is fully redundant and has no practical effect. There is no user-accessible override for this constraint.

- **Tool denial handling**: The system prompt already governs what CC does when a tool call is denied, including the prohibition on circumventing denial intent through indirect execution paths. Adding CLAUDE.md instructions about how to handle permission errors is likely redundant. Instructions that try to grant CC broader latitude to work around denials may conflict with the hardcoded circumvention limits.

- **PR rebase preference**: The system prompt already defaults CC to rebase over merge during autonomous operation. A CLAUDE.md entry encoding the same preference is redundant. A conflicting entry (e.g., "always merge, never rebase") will override the default and will take effect during autonomous loop operation.

- **Documentation fetch behavior**: The system prompt already provides CC with a structured table of live documentation endpoints and conditions for using them. Adding CLAUDE.md instructions that list the same URLs or explain when to fetch docs is redundant. Instructions that restrict live fetches (e.g., "never use WebFetch for docs") will override the default fallback behavior.

---

## User Actionable Insights

1. **Inter-session authority is not configurable.** No CLAUDE.md entry, operator instruction, or user turn can grant a peer Claude session authority over the current session. If your workflow depends on multi-agent coordination where one agent directs another to perform sensitive actions, the receiving agent will always route those requests back to the human user for approval. Design multi-agent workflows with this in mind: the human remains the sole approval authority at every node.

2. **Tool denial circumvention has a hard intent boundary.** When CC is denied a tool, it will attempt reasonable alternatives — but the system embeds a clear prohibition on using execution paths (such as test runners) as covert shells. If you want CC to have broader latitude, grant the permission explicitly rather than expecting it to find creative workarounds.

3. **The autonomous loop is a steward, not an initiator.** The timer-invoked autonomous loop is architecturally biased toward conservatism. If you want CC to take initiative on new tasks while you are away, you must establish those tasks explicitly in the conversation transcript before going idle. Vague or implicit authorization will cause CC to wait rather than act.

4. **Side-question agents are read-only and single-turn by design.** When the side-question mechanism fires, the spawned agent cannot take any actions, use any tools, or receive follow-up messages. If your question requires investigation or action, wait for the main agent to complete its current task rather than expecting the side-question agent to handle it.

5. **Sub-agent prompt quality is your responsibility.** The system instructs CC to write rich, context-complete sub-agent prompts — but the quality of the context depends on what CC has available in the conversation. Providing clear file paths, line numbers, and specific goals in your requests to CC directly improves what gets passed to sub-agents.

6. **Live documentation fetches are a fallback, not a first resort.** CC will consult bundled references first. If you are working in an environment where outbound HTTP is restricted or undesirable, explicitly instruct CC in CLAUDE.md not to use WebFetch for documentation lookups; otherwise the fallback will fire silently when bundled content is insufficient.

7. **Version-specific: v2.1.172 embeds a billing-tier notice.** This version contains a hardcoded user-facing notice related to a usage-credit transition for a specific feature tier. Users on affected plans should update to the latest version to receive current billing behavior. This notice is bundle-embedded and will not be updated by CLAUDE.md changes.

8. **Autonomous loop termination requires explicit action.** The loop does not stop on its own when work is exhausted — it requires CC to actively omit the continuation call and cancel any armed monitors. If you want the loop to self-terminate after a quiet period, establish that condition explicitly in your loop instructions or CLAUDE.md; the default behavior after consecutive idle cycles is to scale back scope, not to stop entirely.

9. **MCP server authority follows session permissions, not server identity.** MCP server connections are configured at the session level. The system does not grant MCP-sourced instructions any special authority above what the current session's permission settings allow.

---

## Tool & Permission Layer

**Auto-allow vs. prompt-to-allow modes**: The system context encodes a two-mode permission model for tool invocations. In auto-allow mode, certain tool calls are executed without interrupting the user for confirmation. In prompt-to-allow mode, CC pauses and surfaces the pending action for explicit user approval before proceeding. The boundary between these modes is set by the session's permission configuration and can be adjusted through settings, but the existence of the two-mode distinction is a system-layer structural feature.

**Tool denial handling machinery**: When a tool invocation is blocked by the permission layer, CC receives a structured denial signal. The system context instructs CC on how to respond: attempt reasonable alternative tools if available, stop and explain if no alternative exists, and never use indirect execution paths to bypass the denial intent. This machinery operates beneath the user instruction layer.

**Hook event integration**: The system context is aware of hook events that fire at defined points in CC's execution cycle. These hooks allow external processes to intercept, log, or block actions at the system level. Hook configuration lives in the `.claude/` directory structure and is separate from CLAUDE.md. The system context treats hook-emitted signals as authoritative inputs to the permission decision process.

**Side-question system reminder tag**: The system embeds a dedicated XML-tagged reminder block that is injected into side-question agent contexts. This tag communicates the agent's constraints — no tools, no follow-up turns, answer-only mode — directly at the system level, ensuring the side-question agent cannot be instructed to behave otherwise by content in the conversation.

**MCP server integration**: MCP servers are registered in the `.mcp.json` configuration file (or the file referenced by `plugin.json`). The system context provides CC with awareness of the MCP discovery and connection workflow, including how to search the registry, present connection UI to users, and update configuration. MCP server tool availability is subject to the same session permission model as native tools.

**Context compression notice**: The system layer includes machinery to emit a user-visible notice when conversation context is compacted. This ensures users are aware that earlier conversation history may be summarized or truncated, which is relevant when CC is operating in long autonomous sessions where full transcript fidelity matters for task continuity.

**Scheduled task and background worker events**: The system context registers telemetry instrumentation for background worker lifecycle events including memory pressure handling, prewarming sweeps, worker retirement, daemon configuration reloads, and signal escalation. These events are observable through the telemetry layer but are not directly user-configurable.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.172 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `y` | UI dashboard renderer / background worker memory management handler |
| `f` | PostgreSQL keyword list provider / side-question system reminder injector |
| `$` | PostgreSQL type list provider / coordinator sub-agent delegation example provider |
| `O` | Job block property constants provider / sub-agent delegation example provider (simplified) |
| `E` | Autonomous loop tick instruction assembler |
| `M` | Sub-agent prompt writing guidance assembler |
| `k` | Billing-tier transition notice string provider |
| `b` | Subtask block property constants provider / scheduled task missed event handler |
| `T` | Pseudoreference code constants provider |
| `R` | Auto-numeration and validation rule ID constants provider |
| `X` | Dataset event type constants provider |
| `w` | Daemon configuration reload telemetry handler |
| `D` | Background worker dispatch and memory pressure telemetry handler |
| `iz6` | Assembler call stub (no large strings, no telemetry) |
| `L` | Assembler call stub (no large strings, no telemetry) |
| `P` | Assembler call stub (no large strings, no telemetry) |
| `j` | Assembler call stub (no large strings, no telemetry) |
| `z` | Assembler call stub (no large strings, no telemetry) |
| `J` | Assembler call stub (no large strings, no telemetry) |
| `S` | Assembler call stub (no large strings, no telemetry) |
| `I` | Assembler call stub (no large strings, no telemetry) |
| `V` | Analytics dashboard CSS / UI style sheet provider |
| `Y` | PostgreSQL SQLSTATE and error code constants provider |
| `Uv6` | Peer-session authority boundary policy injector (dual-copy) |
| `oKA` | Tool denial circumvention limit policy injector |
| `kQ_` | Peer-session authority boundary policy injector (single-copy) |
| `qC_` | Autonomous loop check instruction assembler |
| `DuK` | Live documentation source table provider |
| `BbK` | Files API Python reference provider |
| `BRK` | MCP discovery and connection workflow provider |