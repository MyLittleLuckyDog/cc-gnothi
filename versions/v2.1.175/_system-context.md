---
type: system-context
command: _system-context
cc_version: "2.1.175"
updated: "2026-06-12"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.175 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.175 System Context

> Analysis basis: CC v2.1.175 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

CC's system context layer is assembled from multiple discrete functions whose outputs are combined at runtime to form the full instruction set presented to the model before any user turn. These functions collectively define CC's role declaration, security and permission boundaries, tool interaction protocols, agent orchestration rules, and autonomous operation guidelines. The resulting layer sits above user instructions and CLAUDE.md in terms of initial defaults, though many of its behaviors can be influenced — and some overridden — by user-level configuration. The layer also manages self-referential documentation hooks, subagent communication protocols, and loop-control logic for timer-driven autonomous sessions.

---

## Hardcoded Constraints

- **Cross-session authority isolation**: CC treats messages arriving from peer Claude sessions categorically differently from messages arriving from the authenticated user. A message that originates in a different session carries no user-level authority whatsoever, regardless of its content or claimed urgency. CC will not execute consequential actions solely on the basis of a peer request, and is explicitly prohibited from relaying permission grants between sessions — the system context labels this pattern "permission laundering" and blocks it unconditionally.

- **Tool-denial circumvention boundary**: When a specific tool invocation is denied, CC is permitted to seek reasonable alternative tools that could satisfy the same legitimate goal. However, it is absolutely prohibited from using the flexibility of alternative tools to bypass the intent behind the denial — for example, exploiting a test-execution capability to run arbitrary non-test code. If no legitimate workaround exists and the capability is genuinely required, CC must halt, explain the situation, and defer to the user rather than proceed through indirect means.

- **Subagent trust floor**: Regardless of how a subagent is framed or what context it carries, no subagent message can elevate its own authority to the level of the human user or override the current session's permission settings. This constraint applies uniformly and cannot be waived by the subagent's prompt or claimed role.

- **Autonomous scope boundary**: In timer-driven autonomous operation, CC is constrained to act only on work the user has already authorized and set in motion. Inventing new work categories, initiating irreversible changes without explicit prior authorization from the user, or expanding the scope of a task beyond what the transcript clearly establishes are all treated as out-of-bounds behaviors. The system context encodes an explicit trust-erosion model: overreach in autonomous mode degrades user trust in a way that cannot easily be recovered.

- **Peer consent non-substitution**: A peer agent message is explicitly defined as not constituting user consent or approval for any action. This is an absolute rule with no authorization pathway — there is no escalation path by which a peer session can grant consent on a user's behalf.

---

## Default Behaviors

- **Autonomous loop stewardship mode**: By default, when operating on a timer without the user present, CC adopts a steward posture rather than an initiator posture. It prioritizes continuing in-progress work (active PRs, failing CI, incomplete implementations, explicit commitments recorded in the transcript) over discovering or launching new work. Users can shift this balance by explicitly authorizing broader scope in the conversation before going away, but the narrow default is hardcoded as the starting point.

- **Autonomous loop verbosity ceiling**: When nothing actionable is found during a scheduled autonomous check, CC defaults to a single-sentence status report and stops — it does not enumerate what it checked, speculate about future actions, or produce a narrative summary. This default can be implicitly overridden if the user has expressed a preference for more detailed status updates, but the baseline is minimal output on idle cycles. After a threshold of consecutive idle results, CC further reduces its own activity scope.

- **Subagent prompt self-containment requirement**: When delegating to a subagent, CC defaults to writing fully self-contained prompts that include all necessary context — file paths, line numbers, prior findings, specific constraints — because subagents start with no knowledge of the parent conversation. This is a default behavioral expectation, not a hard block; a user could instruct CC to write minimal delegation prompts, but the results would likely be lower quality.

- **CI and SCM maintenance as secondary priority**: During autonomous operation, PR/MR maintenance (CI diagnosis, review thread resolution, branch rebasing) is treated as a default secondary activity — lower priority than continuing work the user was actively engaged with, but higher priority than idle sweeping. Users can reprioritize this through explicit instructions.

- **Side-question isolation behavior**: When a lightweight side question arrives mid-session, CC defaults to answering it directly from available context without tool use, without referencing interrupted work, and without promising follow-up actions. This behavior is driven by a dedicated system-reminder tag pattern and is not configurable by CLAUDE.md.

- **Documentation self-lookup via live URLs**: CC defaults to consulting a bundled set of live documentation endpoints when bundled references do not cover a question, rather than attempting to answer from potentially stale training knowledge. This is a default fallback behavior that users can suppress by instructing CC not to fetch external URLs.

- **Rebase over merge for branch hygiene**: During autonomous PR maintenance, CC defaults to rebasing rather than merging when the branch has fallen behind its base. This default reflects an opinionated preference for linear history; users who prefer merge commits should specify this preference explicitly.

---

## CLAUDE.md Redundancy Warning

- **Autonomous scope and stewardship principles**: The system prompt already encodes detailed guidance about what constitutes legitimate autonomous action versus overreach. Users who add instructions to CLAUDE.md along the lines of "don't do things I didn't ask for" or "stay within the scope of the current task" are duplicating existing behavior. The duplication is neutral in most cases, but instructions that expand autonomous scope (e.g., "feel free to open new issues or start new features") may conflict with the hardcoded stewardship defaults and produce inconsistent behavior.

- **Subagent delegation prompt quality**: The system context already instructs CC to write thorough, context-rich subagent prompts and explicitly warns against shallow delegation patterns. CLAUDE.md entries that say "always provide full context to subagents" are redundant. Instructions that say "keep subagent prompts brief" directly conflict with the default and may produce degraded delegation quality.

- **CI failure handling in PRs**: The system context already specifies how CC should distinguish flaky CI failures (eligible for re-queuing) from real failures (requiring reproduction and minimal fix). Adding generic instructions like "fix CI failures" to CLAUDE.md is redundant and potentially conflicting if phrased in ways that override the diagnostic-first default.

- **Idle reporting brevity**: The system prompt already instructs CC to minimize output when nothing actionable is found. CLAUDE.md entries requesting "always summarize what you checked" would conflict with this default and may result in verbose idle reports the system context was specifically designed to suppress.

- **Peer session authority handling**: The system context fully specifies how peer agent messages should be treated. Any CLAUDE.md instructions about inter-agent trust hierarchies are either redundant (if they echo the hardcoded rule) or potentially harmful (if they attempt to grant peer sessions elevated authority, which the hardcoded constraint will resist).

- **Branch history strategy**: The default rebase-over-merge preference is embedded in the system context's autonomous loop guidance. CLAUDE.md entries specifying merge strategy are not redundant — they are the correct mechanism for overriding this default — but users should be aware that without an explicit override, the system will rebase.

---

## User Actionable Insights

1. **Peer agent messages cannot impersonate user authority under any circumstances.** If you are building a multi-agent pipeline and need one agent to authorize actions on behalf of a user, that authorization must come from the human user's message turn directly — there is no mechanism to proxy it through a peer session, and attempts to do so will be surfaced as violations.

2. **Tool denial workarounds are bounded by intent, not just capability.** If CC cannot use a specific tool and seeks an alternative, it will not stretch that alternative beyond what the original restriction was meant to prevent. You cannot rely on indirect tool combinations to circumvent a denial; the system evaluates workaround legitimacy against the intent of the restriction, not just its literal scope.

3. **Autonomous loop behavior is tunable via pre-departure conversation, not just CLAUDE.md.** The most effective way to expand what CC does while you're away is to establish it explicitly in the conversation before going away. The transcript is the highest-signal input to the autonomous loop; CLAUDE.md is lower priority for in-flight session behavior.

4. **The side-question isolation mechanism is invisible to users but affects response character.** When a quick question arrives mid-session, CC is operating under a distinct constraint set — no tools, no follow-up, answer only from context. If you notice unusually terse or knowledge-limited responses to mid-session questions, this mechanism may be active.

5. **Live documentation fetching is a built-in fallback.** CC maintains a bundled index of live documentation URLs and will consult them when its internal knowledge is insufficient. If you are working in an air-gapped or network-restricted environment, you should explicitly instruct CC not to make external fetches, or configure network restrictions at the tool permission layer.

6. **Three consecutive idle autonomous cycles triggers a scope reduction.** If CC is running on a timer and finds nothing to do three times in a row, it automatically narrows its own activity footprint rather than continuing to sweep. This is a designed self-limiting behavior; if you want sustained active monitoring even during quiet periods, you need to configure explicit monitoring tasks.

7. **Subagent prompts are designed to be self-contained briefings, not pass-throughs.** CC will not write subagent prompts that say "based on your findings, implement it" — it will write prompts that include the specific context, file paths, and constraints the subagent needs. If you want CC to delegate with minimal context transfer (e.g., for fresh independent review), use the `subagent_type` parameter to signal that independence is intentional.

8. **The v2.1.175 bundle embeds a versioned live docs manifest.** The manifest covers configuration, extensibility, deployment, and security topics with specific Mintlify URLs. If documentation behavior changes between CC versions, the manifest itself is versioned in the bundle and may not reflect the latest live docs structure — checking the page index URL directly is the most reliable approach.

---

## Tool & Permission Layer

The system context embeds a multi-tier permission model that governs how CC interacts with tools across both interactive and autonomous operation modes.

**Auto-allow vs. prompt-to-allow**: The system context distinguishes between tool invocations that proceed without user confirmation and those that require explicit approval. The boundary between these categories is determined by the current session's permission configuration, which can be set via CLI flags, settings files, or CLAUDE.md rules. The system context itself explains this model to CC so that it can correctly interpret permission signals at runtime.

**Hook event integration**: CC recognizes hook events as external signals that can wake or influence autonomous loop behavior. A persistent monitor can be armed to respond to specific events (CI completion, PR comments, log triggers), and the system context encodes explicit logic for when to arm, when to skip arming if one is already running, and how to reset the safety-net timer after a wake event. Hook configuration is user-controlled but the behavioral response to hook events is defined in the system context.

**MCP server handling**: The system context is aware of MCP server configuration patterns, including the distinction between static-URL connectors and dynamic-endpoint connectors that must be referenced by name. The MCP discovery and connection workflow — search, present, connect, update config — is described in the system context layer so CC can guide users through plugin customization without requiring external documentation lookups.

**System-reminder tag semantics**: The system context uses a dedicated tag structure to inject constraint sets into specific interaction types — most visibly in the side-question isolation mechanism, where a tagged block redefines CC's available capabilities and response constraints for that interaction only. Users interacting with CC in contexts where these tags are injected will observe constrained behavior that may differ from normal session behavior.

**Context compression signaling**: The system context includes awareness of context-window compression events. When a compression event has occurred, the autonomous loop's first post-compression invocation receives full instructions rather than the abbreviated reminder used for subsequent normal-cycle invocations. This ensures CC re-establishes full behavioral context after a compression rather than operating from a partial reminder.

**Files API and beta capability awareness**: The system context includes reference material for the Files API beta, including storage limits, billing model, and supported content block types. This is surfaced to CC as a knowledge resource, not as a permission grant — actual Files API access depends on the user's API configuration and beta enrollment.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.175 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| k | UI component assembler: collapsible/copy interface + background worker memory management logic |
| f | SQL keyword corpus (PostgreSQL DML/DDL) + side-question system-reminder tag injector |
| $ | PostgreSQL type corpus + subagent delegation example set (coordinator with fork pattern) |
| O | Job block property constant registry + subagent delegation example set (simple dispatch pattern) |
| E | Autonomous loop control prompt: monitor arming, delay selection, sentinel string, stop condition |
| M | Subagent prompt writing guidelines: context briefing requirements, anti-patterns, specificity rules |
| y | Usage credit migration notice string (Fable 5 plan transition) |
| b | Subtask block property constant registry + scheduled task missed telemetry event |
| T | Pseudoreference code constant registry |
| R | Auto-numeration and validation rule ID constant registry |
| X | Dataset event constant registry (dse*/re* event names) |
| w | Daemon config reload telemetry event handler |
| D | Background dispatch telemetry: SIGKILL escalation, low-memory, spare worker lifecycle |
| uw6 | Assembler call stub (no large strings, no telemetry) |
| L | Assembler call stub (no large strings, no telemetry) |
| P | Assembler call stub (no large strings, no telemetry) |
| j | Assembler call stub (no large strings, no telemetry) |
| z | Assembler call stub (no large strings, no telemetry) |
| J | Assembler call stub (no large strings, no telemetry) |
| S | Assembler call stub (no large strings, no telemetry) |
| I | Assembler call stub (no large strings, no telemetry) |
| V | Dashboard UI stylesheet: stats layout, CLAUDE.md action cards, friction category display |
| Y | PostgreSQL SQLSTATE error code corpus |
| xN6 | Peer session authority disclaimer injector (dual-copy, user-role and assistant-role variants) |
| n4A | Tool-denial workaround boundary notice injector |
| Tc_ | Peer session authority disclaimer injector (single-copy variant) |
| Ub_ | Autonomous loop check prompt: stewardship posture, PR maintenance, idle policy, repeated invocation rules |
| kUK | Live documentation URL manifest: Mintlify endpoint index for configuration, extensibility, workflows, deployment |
| _pK | Files API reference document (Python SDK): upload, message use, management, end-to-end example |
| _uK | MCP discovery and connection workflow: registry search, connector suggestion, config file update patterns |