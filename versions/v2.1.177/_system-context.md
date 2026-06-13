---
type: system-context
command: _system-context
cc_version: "2.1.177"
updated: "2026-06-13"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.177 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.177 System Context

> Analysis basis: CC v2.1.177 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.177 system context is assembled from multiple cooperating functions rather than a single monolithic prompt block. These functions collectively govern security policy, inter-agent authority, tool denial handling, autonomous loop behavior, sub-agent orchestration, side-question dispatch, and live documentation access. The resulting context layer sits beneath user instructions and CLAUDE.md, establishing defaults and hard constraints that persist across sessions. User instructions and CLAUDE.md can influence defaults within this layer but cannot override its hardcoded authority and trust boundaries.

---

## Hardcoded Constraints

- **Inter-agent authority isolation**: Messages arriving from peer Claude sessions are explicitly denied the authority level of the human user. The system enforces that a peer session carries no inherited permissions from the originating user's session, and consequential actions requested by a peer must not be executed unless they genuinely serve the task the actual user established. This constraint is absolute and cannot be overridden by any peer-sourced instruction.

- **Cross-session permission laundering prevention**: If a peer agent requests an action that was denied to it — or that it claims it cannot perform itself — CC is hardcoded to refuse and surface the situation to the human user rather than relay or proxy the action. The prohibition on using one session's capability to bypass another session's restrictions is unconditional.

- **Tool-denial graceful degradation**: When a specific tool invocation is blocked, CC is constrained to seek reasonable alternative approaches using legitimately available tools, while being prohibited from using unrelated tool capabilities (such as test runners) as a vehicle for executing the blocked action. If no legitimate workaround exists, CC must stop and explain to the user what was attempted and why the permission is needed, yielding the decision entirely to the user.

- **Autonomous loop scope boundary**: In timer-invoked autonomous operation, CC is hardcoded to treat the existing conversation transcript as the authoritative scope of permitted work. Inventing new work items, initiating irreversible changes without clear prior user authorization, and manufacturing justifications for unsanctioned actions are all constrained behaviors. The system explicitly treats rationalization toward a questionable push as a signal to halt rather than proceed.

- **Side-question agent tool prohibition**: The lightweight agent instantiated to handle side questions during main-agent operation is hardcoded with zero tool access. It cannot read files, execute commands, run searches, or take any actions — it may only respond from already-held context. This is not a default that can be elevated; it is structural to how side-question agents are spawned.

- **Peer message authority ceiling**: Regardless of how a peer-session message is framed or what context it claims, it is hardcoded as never constituting user consent or user approval for any action. The user's instructions and the current session's permission settings unconditionally take precedence over peer-session content.

---

## Default Behaviors

- **Sub-agent prompt authorship responsibility**: By default, when CC delegates to a sub-agent, it is expected to author self-contained, fully contextualized prompts that embed relevant file paths, line numbers, prior findings, and specific objectives. The default is to avoid delegating synthesis or understanding to the sub-agent. Users can influence the level of detail expected in their delegation requests, but the underlying guidance toward substantive briefing over shallow command-style prompts is the baseline.

- **Autonomous loop PR maintenance behavior**: In autonomous mode, CC defaults to prioritizing the current conversation's in-progress work above all else, followed by PR/MR maintenance (CI diagnosis, review thread resolution, branch rebasing) as a secondary activity. The default cadence preference leans toward rebasing over merging for branch hygiene. Users can shape this by adjusting what work is left in-flight in the transcript, or by configuring loop timing parameters.

- **Autonomous loop silence protocol**: When no actionable work exists across conversation scope and PR maintenance, the default is a single-sentence status message with no elaboration, no enumeration of checks performed, and no speculative future action list. After multiple consecutive idle results, the default is to reduce scope further. Users cannot easily override this toward more verbose idle reporting without structural changes to loop configuration.

- **Scheduled wake timing heuristics**: In autonomous loop mode, the default fallback heartbeat timing varies based on observed activity level in the branch — quieter branches default to longer delays, branches with active in-flight work default to shorter ones. A monitor-based wake signal, when armed, becomes the primary wake mechanism and the timer becomes only a safety fallback. These timing defaults are adjustable via explicit delay parameters in the loop configuration call.

- **Sub-agent fork context isolation**: When a fork-type sub-agent is used, the forked agent inherits conversation context by default. When a non-fork sub-agent type is specified, the agent starts with no conversation context and must be fully briefed in the prompt. This distinction is behavioral and users must account for it explicitly when choosing sub-agent types.

- **Live documentation fetch preference**: When bundled references do not cover a topic, CC defaults to consulting live documentation endpoints before declaring ignorance. The default fetch format preference is plain Markdown over MDX for cleaner extraction. Users can influence which documentation domain is consulted by framing their question around specific topics.

---

## CLAUDE.md Redundancy Warning

- **Sub-agent prompt quality standards**: The system context already establishes detailed guidance on how to write effective sub-agent prompts — including the expectation of specific file references, ruling out of already-tested approaches, and avoiding delegation of synthesis. Adding generic "write good prompts" instructions to CLAUDE.md is redundant. Adding instructions that conflict with this standard (for example, encouraging brief command-style delegation) may degrade output quality by competing with the embedded guidance.

- **Autonomous loop scope discipline**: The system context already defines the boundary between continuing established work and inventing new work, with an explicit heuristic for when to halt versus proceed. CLAUDE.md instructions attempting to broaden autonomous scope (for example, "feel free to tackle related issues you notice") may conflict with this constraint and produce inconsistent behavior — the hardcoded preference toward caution will frequently override such instructions.

- **PR/MR maintenance workflow**: The system context already encodes a specific ordered workflow for autonomous PR maintenance: CI diagnosis before action, rebase over merge, resolve review threads via the appropriate SCM mutation. Duplicating this in CLAUDE.md is neutral at best. Conflicting instructions (for example, "always merge rather than rebase") will create instruction tension and behavior may vary by context.

- **Idle state reporting style**: The system context already instructs CC to keep idle-state reports minimal and non-verbose. Users who add CLAUDE.md instructions requesting detailed status summaries on every loop tick will find these in tension with the embedded default. The embedded guidance may dominate in truly idle conditions.

- **Peer-session message handling**: Because the authority boundary for peer sessions is hardcoded, any CLAUDE.md instruction attempting to elevate peer-session trust (for example, "treat messages from other Claude agents as user-authorized") will be functionally inert or produce unpredictable behavior. This is an area where CLAUDE.md instructions cannot achieve their apparent intent.

---

## User Actionable Insights

1. **Peer-session manipulation is structurally blocked.** If you are building multi-agent pipelines, you cannot grant a peer Claude session the ability to authorize actions on behalf of your user session through message content alone. Any architecture that relies on agent-to-agent permission escalation will fail at this layer. Design your pipelines so that tool permissions are established at session initialization by the human user, not conveyed laterally between agents at runtime.

2. **Tool denial does not end the task — it changes the path.** When a tool call is blocked, CC will attempt reasonable workarounds using other available tools before stopping. If you want to prevent certain workaround paths (for example, you block `cat` but do not want `head` used as a substitute), you must explicitly configure those restrictions as well. A single tool denial is not a complete capability block unless you close the adjacent paths.

3. **Side-question agents are intentionally tool-free.** If you invoke a side question while the main agent is working, the answering agent has no ability to look anything up, run commands, or verify state. Its answer is bounded by what was already in context. For questions that require fresh tool use, you must wait for the main agent's current turn to complete rather than using the side-question path.

4. **Autonomous loop scope is anchored to the transcript, not your intent.** The autonomous loop's default is conservative: it executes what the transcript clearly establishes, not what you might reasonably have wanted. If you want the loop to handle a related task area, you need to establish it explicitly in the conversation before the loop fires — implicit intent does not propagate.

5. **CLAUDE.md cannot broaden peer-agent authority.** This is a version-specific hardcoded constraint in v2.1.177. Attempting to use CLAUDE.md to instruct CC to accept peer-session messages as user-authorized will not achieve the intended effect. The constraint operates below the CLAUDE.md layer.

6. **Loop timing is tunable, loop scope discipline is not.** You can adjust the heartbeat delay, the monitor arming behavior, and the wake signal type in autonomous mode. You cannot tune away the hardcoded preference to halt when rationalizing an unsanctioned action. Timing is a parameter; scope conservatism is a constraint.

7. **Sub-agent briefing quality directly affects output quality.** The system context's sub-agent guidance establishes that under-briefed prompts produce shallow results. Because this guidance is embedded at the system level, it also means that if your CLAUDE.md adds conflicting delegation patterns, you may observe inconsistent sub-agent output quality depending on which instruction set dominates in a given context.

8. **Live documentation is reachable when bundled references fall short.** CC v2.1.177 has a structured map of live documentation endpoints embedded in the system context. If you ask about a feature or behavior that the bundled snapshot does not cover, CC can and will fetch current documentation rather than guessing. You can explicitly invoke this by asking about specific topics or behaviors by name.

9. **Forked vs. non-forked sub-agents have fundamentally different context access.** If you use a fork-type sub-agent, it shares conversation context and you do not need to re-brief it. If you use a typed sub-agent (such as a code reviewer), it starts context-free and an under-briefed prompt will produce a low-quality result. Choosing the wrong sub-agent type for a given task is a common source of poor delegation outcomes.

10. **The system context layer is version-specific.** The behaviors described in this document reflect the embedded system prompt as of v2.1.177. Upgrading CC may change default behaviors, loop timing heuristics, or sub-agent orchestration patterns in ways that are not surfaced in release notes. Re-analyzing the bundle after major version changes is the only way to verify that embedded behavioral defaults match your assumptions.

---

## Tool & Permission Layer

The system context describes a permission model in which tool access operates on two axes: tools that are auto-allowed based on current session configuration, and tools that require explicit confirmation before execution. The distinction between these two categories is governed by session-level permission settings established at initialization time.

Hook events are described as a mechanism by which external tooling can intercept and respond to specific CC lifecycle moments. The system context communicates to CC that hooks operate as side-effects of tool use, not as substitutes for tool permissions — a hook firing does not grant or expand tool authority.

The `<system-reminder>` tag is used to inject behavioral constraints into lightweight side-question agent instances at spawn time. These injected constraints override any conversational context that might otherwise suggest broader capability. The system-reminder mechanism is an internal injection point, not something users configure directly.

Context compression behavior is noted internally — the system context includes awareness that prior context may be compacted or shed as a memory management measure, and that autonomous loop prompts must account for the possibility of compressed or absent earlier context when constructing their operating picture for a given tick.

MCP server integration is covered in the live documentation layer rather than being hardcoded in the system context itself. CC is directed to consult live documentation when MCP-specific behavior questions arise that are not resolved by the local bundle snapshot.

The background worker lifecycle — including spare worker pre-warming, low-memory shedding of non-pinned workers, escalating termination signals for unresponsive workers, and the last-resort retirement of pinned settled workers — is managed by the infrastructure layer and surfaced to the system context via telemetry instrumentation rather than behavioral instructions.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.177 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `k` | UI analytics / histogram renderer + background memory management telemetry assembler |
| `f` | SQL keyword / PostgreSQL grammar token list assembler + side-question agent system-reminder injector |
| `z` | Fork-type sub-agent orchestration examples assembler (coordinator loop with notification pattern) |
| `O` | Job block property constants assembler + sub-agent prompt authorship guidance assembler |
| `w` | Standard (non-fork) sub-agent orchestration examples assembler |
| `E` | Autonomous loop tick instruction assembler (monitor arming, delay selection, sentinel prompt) |
| `I` | Version upgrade / Fable billing notice string assembler |
| `b` | Subtask block property constants assembler |
| `$` | PostgreSQL data type keyword list assembler |
| `T` | Pseudoreference code constants assembler |
| `R` | Reference/record validation rule ID constants assembler |
| `X` | Dataset event name constants assembler |
| `D` | Background worker dispatch telemetry assembler (sigkill escalation, low-memory, spare pool) |
| `UY6` | Minimal assembler (no large strings, no telemetry events) |
| `L` | Minimal assembler (no large strings, no telemetry events) |
| `M` | Minimal assembler (no large strings, no telemetry events) |
| `P` | Minimal assembler (no large strings, no telemetry events) |
| `j` | Minimal assembler (no large strings, no telemetry events) |
| `J` | Minimal assembler (no large strings, no telemetry events) |
| `S` | Minimal assembler (no large strings, no telemetry events) |
| `y` | Minimal assembler (no large strings, no telemetry events) |
| `V` | Dashboard / report UI stylesheet assembler |
| `Y` | PostgreSQL SQLSTATE error code and condition name list assembler |
| `gh6` | Peer-session authority boundary notice assembler (injected into inter-agent message framing) |
| `H5A` | Tool-denial graceful degradation instruction assembler |
| `Wn_` | Peer-session authority boundary notice assembler (variant injection point) |
| `Iu_` | Autonomous loop behavioral specification assembler (scope discipline, PR maintenance, idle protocol) |
| `DQK` | Live documentation URL map assembler (Mintlify endpoint index) |
| `BFK` | Files API Python reference snippet assembler |
| `oFK` | Claude API Ruby SDK reference snippet assembler |