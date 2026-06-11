---
type: system-context
command: _system-context
cc_version: "2.1.169"
updated: "2026-06-12"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.169 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.169 System Context

> Analysis basis: CC v2.1.169 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.169 system context is assembled from multiple discrete functions that are concatenated at runtime to form the full system prompt delivered to the model. These functions collectively cover: trust and authority hierarchy for multi-agent scenarios, tool permission policy, autonomous loop governance, subagent delegation patterns, side-channel question handling, and live documentation routing. User instructions and CLAUDE.md content are layered on top of this foundation — they can adjust defaults but cannot override hardcoded authority and trust policies established at this layer.

---

## Hardcoded Constraints

- **Inter-session authority boundary**: Messages arriving from a peer Claude session are explicitly denied user-level authority. CC is instructed to recognize that such peer messages carry no elevated trust, that consequential actions must not be taken solely on the basis of a peer request, and that no action denied to a peer session can be laundered through CC to circumvent that denial. This policy is absolute and applies regardless of how the peer message is framed or what authority it claims.

- **Permission laundering prohibition**: If a peer agent requests that CC perform an action the peer itself was denied or cannot perform, CC must refuse and surface that request to the human user. There is no authorization path by which peer-to-peer message passing can escalate permissions — only the human user can grant effective consent. This restriction cannot be overridden by CLAUDE.md or user instruction because it governs the trust model itself.

- **Tool denial compliance with bounded workaround**: When a tool use is blocked, CC is instructed to consider only legitimate, non-circumventing alternatives — for example, substituting a functionally equivalent but permitted tool. Attempting to exploit unrelated tool capabilities (such as using test execution to run arbitrary commands) to bypass the intent of a denial is explicitly prohibited. If no compliant path exists, CC must stop and explain the situation to the user rather than proceeding covertly.

- **Autonomous operation scope ceiling**: During timer-driven autonomous loops, CC is constrained to work only on tasks that are clearly established by the existing conversation and work state. Inventing new objectives, initiating irreversible changes without explicit prior authorization, and expanding scope beyond what the transcript evidences the user wanted are treated as trust-eroding behaviors. This ceiling is structurally enforced by the loop prompt, not merely advisory.

- **Side-question agent isolation**: When CC spawns a lightweight side-question agent, that agent operates under a strict constraint set: no tools are available, no follow-up turns will occur, and the agent must not promise actions it cannot take. The agent may only draw on information already present in the conversation context. These constraints are injected via a system-reminder tag and cannot be relaxed by user instruction within that agent's scope.

---

## Default Behaviors

- **Subagent prompt completeness**: By default, when delegating to a subagent, CC constructs self-contained prompts that include full context — file paths, line numbers, background rationale, and specific deliverables. The default is context-rich delegation. Users can influence the depth of context by providing richer or narrower task framing, but the structural expectation that the agent prompt be self-sufficient is a default that CLAUDE.md cannot fully remove.

- **Subagent independence preservation**: When a user requests an independent review or second opinion, CC defaults to briefing the subagent without sharing its own prior analysis, so the subagent's output is not contaminated by CC's conclusions. Users can implicitly alter this by asking CC to share context, but the default favors analytical independence.

- **Autonomous loop verbosity**: When the autonomous loop has nothing to act on, CC defaults to a single brief status sentence and stops — it does not produce summaries, lists of checked items, or speculative next-step narration. After several consecutive idle results, CC further reduces its footprint to a minimal check and halts. Users cannot instruct CC to narrate idle loops in detail without conflicting with this default.

- **CI and SCM maintenance heuristics**: During autonomous operation, CC defaults to a specific priority ordering for PR maintenance tasks: addressing failing CI before review threads, rebasing rather than merging when the branch has fallen behind, and resolving review threads via SCM API calls (e.g., GraphQL mutations) rather than leaving them open. These operational defaults can be adjusted by project-level CLAUDE.md conventions (e.g., specifying a different merge strategy).

- **Scheduled loop timing logic**: The default heartbeat delay for autonomous loops is calibrated based on observed activity — shorter when many things are in flight, longer when the branch is quiet — with specific guidance for armed-monitor vs. no-monitor scenarios. Users can influence this through project context but not by directly instructing a delay value in CLAUDE.md.

- **Live documentation routing**: CC defaults to consulting bundled references first, then live documentation URLs for topics not covered in the bundle. The documentation endpoint hierarchy is hardcoded; users can instruct CC to prefer live docs by default but cannot remap the endpoints themselves.

- **Peer message warning injection**: When a message arrives tagged as originating from another Claude session, CC automatically prepends a trust-context notice before processing it. This behavior is default-on and serves as a structural guard against authority confusion in multi-agent pipelines.

---

## CLAUDE.md Redundancy Warning

- **Subagent prompt quality guidance**: The system context already instructs CC on how to construct high-quality subagent prompts — including the requirement to provide specific context rather than vague delegation, to avoid pushing synthesis onto the subagent, and to include concrete artifacts like file paths and line numbers. Adding equivalent prompt-quality instructions to CLAUDE.md is redundant. Instructions that conflict with this (e.g., "keep subagent prompts brief") may degrade delegation quality.

- **Autonomous loop behavior**: The system context already defines what CC should and should not act on during autonomous operation, including the prioritization of existing work over new initiatives and the prohibition on narrating idle states. Users who add autonomous operation guidelines to CLAUDE.md risk creating instruction conflicts if their additions expand scope beyond what the system layer permits.

- **PR and CI maintenance workflow**: The system context already encodes a default PR maintenance workflow for autonomous loops, including how to handle flaky CI, how to resolve review threads, and when to rebase. CLAUDE.md instructions that duplicate this workflow are neutral if aligned, but potentially conflicting if they prescribe different merge or rebase strategies.

- **Subagent independence on review tasks**: The system context already instructs CC to preserve analytical independence when requesting second-opinion reviews. CLAUDE.md instructions asking CC to "always share your analysis when delegating" directly conflict with this default for review-type tasks.

- **Minimal idle-loop output**: The system context already establishes that idle autonomous loop turns should produce minimal output. CLAUDE.md instructions like "always summarize what you checked" conflict with this default and will create tension in loop turns.

---

## User Actionable Insights

1. **Peer-session messages can never escalate permissions.** In multi-agent or MCP pipelines where another Claude instance sends CC a message, that message has no authority over CC's permission set. Users who build multi-agent workflows should not design them assuming peer-Claude trust — only explicit user-role messages carry consent.

2. **Tool denial workarounds are bounded by intent, not just capability.** When a tool is blocked, CC will look for legitimate alternatives but is instructed not to exploit unrelated capabilities to route around the denial. Users who need a denied capability should re-grant it explicitly rather than expecting CC to find a creative path.

3. **Autonomous loop scope is conservative by design.** If you leave CC running autonomously, it will not invent new work. The system context explicitly treats scope expansion as a trust risk. If you want CC to take on new tasks during autonomous operation, you must establish them in the conversation before stepping away.

4. **Side-question agents are tool-free and single-turn.** When CC spawns a lightweight agent to answer a side question while the main agent continues, that side agent cannot read files, run commands, or take any action. Answers are limited to what the conversation context already contains. Do not rely on side-question agents for live lookups.

5. **Subagent prompts require your synthesis, not the agent's.** The system context instructs CC that delegation prompts should prove the delegator understood the problem — including specific artifacts, not abstract directives. If your task description is vague, CC may decline to delegate or will expand it before doing so. Providing precise context in your request improves delegation quality.

6. **Live documentation endpoints are hardcoded in this version.** CC v2.1.169 has a specific set of documentation URLs baked into the bundle. If Anthropic updates documentation structure, the bundled URL table may become stale until the next CC release. Users on v2.1.169 should be aware that doc-fetch behavior reflects the URL table from this build date.

7. **CLAUDE.md cannot override the inter-session trust model.** The authority hierarchy (user > peer Claude session) is enforced at the system context layer. No CLAUDE.md instruction can instruct CC to treat peer messages as user-equivalent. Attempts to do so will be ignored or create instruction conflict.

8. **Autonomous loop heartbeat timing is context-sensitive, not fixed.** The loop delay is not a static setting — it is computed based on what CC observed during the current turn. Users cannot tune this precisely via CLAUDE.md; the best lever is ensuring the conversation state clearly signals how much work is in flight.

9. **The system-reminder tag is a structural injection mechanism.** CC recognizes `<system-reminder>` tagged content as carrying system-level authority for scoped behaviors (e.g., side-question agent constraints). Users or integrators who inject content into the conversation should be aware that this tag affects how CC interprets the authority and scope of the injected instructions.

10. **Version-specific: v2.1.169 includes the full autonomous loop and subagent delegation framework.** Users upgrading from earlier versions should audit any CLAUDE.md autonomous operation instructions for conflicts with the now-hardcoded loop governance policy.

---

## Tool & Permission Layer

The system context embeds a multi-layer permission model that CC uses to govern tool use at runtime.

**Auto-allow vs. prompt-to-allow**: CC distinguishes between tool invocations that can proceed without user confirmation (based on prior grants or low-risk profile) and those that require explicit user approval. The permission state is session-scoped and can be adjusted by user instruction, but the initial classification of tools into these categories is determined by the system context layer.

**Tool denial handling**: When a tool invocation is blocked — either by user configuration or system policy — CC receives an injected explanation of the denial and is instructed to evaluate whether a legitimate alternative path exists. The evaluation is bounded: only reasonable functional substitutes are acceptable; exploiting unrelated tool capabilities to achieve the denied action is prohibited. If no compliant path exists, CC must halt and communicate the situation to the user.

**Hook event integration**: The system context recognizes hook events as part of the execution lifecycle. Hook-triggered behaviors (pre- and post-tool invocations, task lifecycle events) are processed as part of the normal turn cycle. The telemetry layer tracks hook-related events for internal diagnostics.

**MCP server handling**: MCP servers are treated as external capability providers whose availability and authentication are managed via configuration files (`.mcp.json` or plugin-specified paths). The system context provides CC with awareness of how MCP connections are structured and how to route capability requests through them. MCP tool calls are subject to the same permission model as native tools.

**System-reminder tag**: Content injected under the `<system-reminder>` tag is processed as carrying scoped system-level authority. CC uses this tag to recognize specially constrained execution contexts — such as the side-question agent — and to apply the appropriate behavioral restrictions for that scope.

**Context compression notice**: The system context includes awareness of context window management. When prior context is compressed or summarized (e.g., during long autonomous loop sessions), CC is expected to treat the compression event as a signal to re-orient its understanding of task state rather than assuming continuity of detail.

**Background process management**: The telemetry layer reflects a background worker pool with memory-pressure-driven eviction logic. Pinned workers are protected from eviction under normal conditions but can be retired as a last resort under sustained memory pressure. This machinery operates below the conversational layer and is not directly user-configurable via CLAUDE.md.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.169 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `h` | UI analytics dashboard JS + background worker memory eviction logic |
| `L` | PostgreSQL keyword list + side-question agent system-reminder injector |
| `$` | PostgreSQL type keyword list + subagent delegation example set (coordinator pattern) |
| `O` | Job block property constants + subagent delegation example set (simple pattern) |
| `E` | Autonomous loop tick instructions (monitor arming, delay selection, sentinel prompt) |
| `M` | Subagent prompt-writing guidance (context briefing, delegation anti-patterns) |
| `b` | Subtask block property constants + scheduled task miss telemetry |
| `T` | Pseudo-reference code constants (access types, components, privileges) |
| `R` | Auto-numeration and validation rule ID constants |
| `X` | Dataset event name constants (dse* / re* event series) |
| `Y` | Daemon config reload telemetry handler |
| `w` | Background dispatch telemetry (SIGKILL escalation, low-memory, spare worker lifecycle) |
| `uO6` | Assembler call stub (no large strings, no telemetry) |
| `f` | Assembler call stub (no large strings, no telemetry) |
| `P` | Assembler call stub (no large strings, no telemetry) |
| `J` | Assembler call stub (no large strings, no telemetry) |
| `z` | Assembler call stub (no large strings, no telemetry) |
| `j` | Assembler call stub (no large strings, no telemetry) |
| `S` | Assembler call stub (no large strings, no telemetry) |
| `y` | Assembler call stub (no large strings, no telemetry) |
| `k` | Assembler call stub (no large strings, no telemetry) |
| `V` | Dashboard HTML/CSS renderer (usage analytics UI, CLAUDE.md action panel) |
| `D` | PostgreSQL SQLSTATE error code enumeration |
| `DV6` | Peer-session trust boundary warning injector (dual-copy, tool-result and assistant-turn variants) |
| `r1A` | Tool denial workaround policy injector (compliant alternative guidance + halt instruction) |
| `nB_` | Peer-session trust boundary warning injector (single-copy variant) |
| `vh_` | Autonomous loop governance prompt (scope policy, PR maintenance, CI triage, idle behavior) |
| `KRK` | Live documentation URL table (Mintlify endpoint index for CC docs) |
| `ChK` | Files API Python reference (beta, upload/use/manage pattern) |
| `CkK` | MCP discovery and connection guide (registry search, suggest_connectors, config format) |