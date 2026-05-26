---
type: system-context
command: _system-context
cc_version: "2.1.149"
updated: "2026-05-26"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.149 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.149 System Context

> Analysis basis: CC v2.1.149 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.149 system context is assembled from multiple discrete functions within the bundle, each contributing a slice of the overall behavioral scaffold — covering role declaration, tool permission policy, autonomous-loop guidance, sub-agent orchestration rules, denial-handling posture, and side-question handling. These layers combine at runtime to form the effective system prompt CC operates under. User instructions and CLAUDE.md content are layered on top of this scaffold; they can influence default behaviors within the bounds the scaffold allows, but cannot override the hardcoded constraints the scaffold enforces. The scaffold also injects structured `<system-reminder>` tags for specific runtime contexts (e.g., lightweight side-question agents), meaning portions of the system context are context-sensitive and not uniformly present in every turn.

---

## Hardcoded Constraints

- **Tool-denial compliance posture**: When a tool invocation is blocked or denied, CC is instructed to explore only reasonable, intent-aligned workarounds using other available tools. Circumvention attempts that contradict the spirit of the denial — for example, exploiting test-execution pathways to perform non-test actions — are prohibited. If no legitimate workaround exists and the capability appears essential, CC must halt and explain the situation to the user rather than proceeding around the block.

- **No silent workaround escalation**: CC is barred from attempting to bypass a denial in ways that are adversarial or deceptive toward the permission system. The permitted surface area is narrow: only natural tool substitutions that serve the same user goal without violating the denial's intent. Anything beyond that boundary requires the user to explicitly decide how to proceed.

- **Autonomous operation trust boundary**: In autonomous/daemon loop contexts, CC is constrained to act only on work that is clearly established by prior conversation or active PR state. Inventing new work, initiating irreversible changes without clear authorization, or rationalizing unsanctioned actions is explicitly outside the permitted behavior set. The constraint is framed as a trust-preservation mechanism rather than a capability limit.

- **Side-question agent tool prohibition**: When CC is instantiated as a lightweight side-question agent (via the `<system-reminder>` injection path), it operates with zero tool access. It cannot read files, run commands, search, or take any external action in this mode. This is an absolute constraint for that instantiation type, not a default that can be relaxed.

- **Sub-agent prompt synthesis responsibility**: When orchestrating sub-agents, CC is required to produce fully self-contained prompts — the orchestrator must not delegate the synthesis of understanding to the worker. Prompts that defer reasoning to the agent (e.g., "based on your findings, fix the bug") are prohibited. The constraint is structural: the orchestrating layer must encode file paths, line numbers, and specific change targets before handing off.

- **Worktree isolation for parallel batch work**: In batch/parallel orchestration mode, all spawned worker agents must use isolated git worktrees. This is a non-negotiable structural requirement for the multi-agent batch workflow, not a recommendation.

---

## Default Behaviors

- **Autonomous loop pacing**: By default, CC in daemon/loop mode selects its own wake interval based on observed activity levels — shorter intervals when work is in flight, longer when things are quiet. Users can influence this by specifying an explicit interval (e.g., via the `/loop` command's interval syntax), shifting CC from self-paced dynamic mode into fixed-interval mode. Without a user-specified interval, CC retains full discretion over cadence within the guidance bounds embedded in the system context.

- **Event-based wake signal arming**: CC defaults to arming a persistent event monitor when the next meaningful action is gated on an observable event (CI completion, PR comment, log line). This behavior — arm once, skip on subsequent ticks if already armed — is the default heuristic. Users cannot suppress this behavior via CLAUDE.md, but can influence it implicitly by structuring their loop prompts to avoid event-gated scenarios.

- **Autonomous scope conservatism**: When the conversation transcript is exhausted and no clear continuing work is evident, CC defaults to a minimal-action posture — checking PR/CI state rather than inventing new tasks. After repeated "nothing to do" results, it defaults to scaling back further. This default can be influenced by providing explicit ongoing work targets in the loop prompt.

- **Sub-agent briefing style**: When delegating to sub-agents, CC defaults to treating each agent as a context-free "new colleague" who has not seen the conversation. The default prompt style is comprehensive background-first briefing rather than terse instruction. Users can influence the density of briefing by specifying response length caps or scoping instructions in their delegation requests.

- **Parallel batch phasing**: The default execution model for large parallelizable changes is three-phase: research and plan (foreground, sequential), worker spawn (parallel, background), then progress tracking. Users can influence the number of work units and the e2e verification recipe during plan approval, but the phase structure itself is the hardcoded default.

- **Loop prompt self-reference**: In dynamic loop mode, CC defaults to passing a self-referential sentinel as the next-iteration prompt rather than the full instruction set. The sentinel is expanded at fire time. Users who specify a fixed-interval loop get their original prompt passed verbatim to each subsequent iteration.

- **Denial explanation default**: When a blocked capability appears essential to completing a user request and no reasonable workaround exists, CC defaults to stopping and explaining the situation rather than silently failing or attempting further workarounds. Users cannot suppress this explanation behavior; they can only unblock CC by adjusting permissions.

---

## CLAUDE.md Redundancy Warning

- **Autonomous conservatism instructions**: The system prompt already encodes a detailed heuristic for distinguishing "continuing established work" from "inventing new work" in autonomous mode. Adding CLAUDE.md instructions like "don't do things I haven't asked for" or "be conservative when running autonomously" is redundant with this existing scaffold. Conflicting CLAUDE.md instructions that push toward more expansive autonomous initiative may create instruction tension rather than cleanly overriding the default.

- **Sub-agent briefing quality guidelines**: The system context already contains detailed guidance on how to write effective sub-agent prompts — covering context sufficiency, specificity of targets, and prohibition of delegated synthesis. CLAUDE.md entries repeating generic delegation advice (e.g., "give agents enough context") are redundant. More specific CLAUDE.md guidance about project-specific conventions the agent needs to know is additive and non-conflicting.

- **Loop/daemon behavior descriptions**: If users add CLAUDE.md content describing how CC should behave when running on a timer or in an autonomous loop, they should be aware this behavior is already governed by the system context layer. CLAUDE.md descriptions of autonomous pacing, event monitoring, or PR maintenance behavior may be neutral if they align with defaults, or potentially conflicting if they specify different intervals, different scope boundaries, or different "nothing to do" behaviors.

- **Parallel work orchestration structure**: The three-phase batch orchestration model (plan → spawn → track) is embedded in the system context. CLAUDE.md instructions about how to structure large parallel tasks risk either duplicating this guidance (neutral) or specifying an incompatible model (conflicting). Users who want to customize batch behavior should prefer doing so interactively during the plan-approval phase rather than via static CLAUDE.md content.

- **Tool denial handling**: The instruction to stop and explain when a capability is blocked and essential is already present in the system context. CLAUDE.md instructions like "always tell me when you can't do something" are redundant. Instructions like "try harder to find workarounds" may conflict with the hardcoded prohibition on adversarial circumvention.

---

## User Actionable Insights

1. **Tool denials have a defined ceiling**: If you deny CC a tool, it will attempt only intent-aligned substitutions and then stop if none are viable. You cannot instruct CC via CLAUDE.md to push harder against a denial — the circumvention prohibition is hardcoded. If you need CC to proceed, you must grant the permission, not reword the instruction.

2. **The `/loop` interval syntax unlocks fixed-cadence mode**: Without a leading interval token or trailing "every" clause, CC enters dynamic self-pacing mode and chooses its own cadence. Specifying an interval (e.g., `5m`, `2h`) shifts it into fixed-interval mode with a cron-backed schedule. This is a meaningful behavioral fork, not a hint.

3. **Autonomous loop scope is bounded by transcript evidence**: CC in daemon mode will not act on work it has to infer or invent. If you want it to maintain a particular ongoing task autonomously, that task must be explicitly established in the conversation transcript. Vague or implicit intent in CLAUDE.md does not satisfy this threshold.

4. **Side-question agents are fully tool-isolated**: When CC spawns a lightweight side-question instance (the `<system-reminder>` pathway), that instance has no tool access at all. It can only reason about what it already knows from context. Do not expect it to fetch files, run searches, or check live state — it will decline or acknowledge ignorance rather than attempt those actions.

5. **Sub-agent prompts must be self-contained**: If you are directing CC to orchestrate sub-agents, the quality of the outcome is bounded by the specificity of the briefing CC encodes in the worker prompt. CC is instructed not to delegate synthesis — but if you provide CC with vague high-level goals, the briefing it produces will reflect that vagueness. Giving CC concrete targets (file paths, line numbers, specific behaviors to verify) upstream improves downstream worker output.

6. **Plan approval is the right intervention point for batch work**: The parallel batch workflow includes an explicit plan-approval gate before workers are spawned. This is the correct moment to adjust work unit decomposition, e2e verification recipes, and scope boundaries. Attempting to redirect worker behavior via CLAUDE.md after spawning is not effective — workers receive self-contained prompts and do not re-consult CLAUDE.md mid-task.

7. **"Nothing to do" has a defined escalation path**: CC will not narrate its checks indefinitely when there is no autonomous work to do. After repeated idle results, it scales back to minimal-footprint operation. If you expect ongoing autonomous value, ensure there is active PR work or explicit continuing tasks in the transcript — not just a standing CLAUDE.md instruction to "keep working."

8. **The system context layer is version-pinned**: The behaviors described here are specific to v2.1.149. Bundle updates may adjust autonomous loop heuristics, event-monitor arming behavior, or sub-agent briefing requirements. Behavioral specs like this one should be re-derived after significant version bumps rather than assumed stable.

---

## Tool & Permission Layer

The system context embeds a structured model for how CC handles tool access and permission boundaries across its different operational modes.

**Denial and workaround policy**: When a tool call is blocked by the permission layer, CC receives explicit guidance about the permitted response surface. Reasonable tool substitutions that serve the same user intent are allowed; adversarial or deceptive workarounds are not. The boundary between these is defined by whether the alternative respects the intent behind the denial. If CC cannot navigate this boundary while still completing the user's request, it is directed to surface the impasse to the user explicitly.

**Side-question agent mode (system-reminder injection)**: A distinct operational mode is triggered by a `<system-reminder>` tag injected into the conversation. In this mode, CC is instantiated as a lightweight, single-turn, tool-free responder. It is explicitly aware that it is a separate instance from the main agent, that the main agent continues working independently, and that it must not frame its responses as interruptions or continuations of prior activity. This mode has no follow-up turns and no tool access — both are absolute constraints, not defaults.

**Autonomous loop / daemon mode**: The system context describes a persistent autonomous execution model in which CC operates on a timer while the user is away. The permission model here is scope-based rather than tool-based: CC is permitted to use its full tool set but is constrained in *what work* it may initiate. Actions on clearly established work are within scope; novel work initiation is not. The system context also describes a monitor-arming mechanism for event-gated wakeups, which integrates with the task notification system (`<task-notification>` messages) as an alternative to timer-based polling.

**Parallel batch orchestration**: Worker agents in batch mode must use `isolation: "worktree"` and must run in the background. These are structural permission requirements baked into the orchestration model — the orchestrator cannot spawn workers with shared state or in foreground mode under this workflow. The system context also specifies that worker prompts must be fully self-contained, which is effectively a data-isolation requirement: workers do not inherit ambient context from the orchestrator's conversation.

**Context compression notice**: The system context layer includes handling awareness for context compression events, which affects how CC reconstructs its understanding of ongoing tasks after a compaction. In daemon/loop mode, this influences how the loop prompt sentinel is expanded — the system context distinguishes between first-fire, first-fire-post-compact, and subsequent-fire scenarios and applies different prompt expansion behavior accordingly.

**MCP and system-reminder tag handling**: The `<system-reminder>` tag is treated as a structural signal that changes CC's operational mode, not as advisory content. Its presence causes CC to adopt a distinct behavioral profile (tool-free, single-turn, non-referential to prior activity). This tag-based mode switching is part of the permission/context machinery rather than the conversational content layer.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.149 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `h` | Analytics dashboard UI — collapsible/copy interaction handlers and usage histogram rendering |
| `L` | PostgreSQL keyword corpus (DML/DDL/control-flow) + side-question system-reminder injector |
| `$` | Coordinator sub-agent orchestration examples (ship-audit, migration-review patterns) with commentary |
| `O` | Simplified sub-agent delegation examples (ship-audit, migration-review, without coordinator framing) |
| `Z` | Autonomous daemon loop tick instructions — monitor arming, delay selection, sentinel prompt passing |
| `f` | Sub-agent prompt-writing guidelines — briefing quality, context sufficiency, delegation anti-patterns |
| `b` | Subtask block property constant corpus (workflow engine schema identifiers) |
| `G` | Pseudo-reference code constant corpus (access types, component, privilege, replication identifiers) |
| `C` | Validation and auto-numeration rule ID constant corpus (reference record integrity rules) |
| `X` | Dataset event name constant corpus (dse* / reOn* event identifiers for record lifecycle) |
| `Y` | Daemon config reload telemetry emitter (`tengu_daemon_config_reload`) |
| `w` | Background dispatch telemetry emitter (SIGKILL escalation, low-memory, spare-process lifecycle events) |
| `_46` | Zero-string assembler call — role not determinable from string content alone |
| `M` | Zero-string assembler call — role not determinable from string content alone |
| `P` | Zero-string assembler call — role not determinable from string content alone |
| `j` | Zero-string assembler call — role not determinable from string content alone |
| `z` | Zero-string assembler call — role not determinable from string content alone |
| `J` | Zero-string assembler call — role not determinable from string content alone |
| `R` | Zero-string assembler call — role not determinable from string content alone |
| `y` | Zero-string assembler call — role not determinable from string content alone |
| `I` | Zero-string assembler call — role not determinable from string content alone |
| `V` | Analytics dashboard CSS + HTML rendering engine (full report layout, friction/win cards, CLAUDE.md action UI) |
| `D` | PostgreSQL SQLSTATE / error code constant corpus (full error class and condition name list) + background spare-spawn telemetry |
| `og_` | Tool-denial workaround policy injector — permitted substitution guidance and escalation-to-user instruction |
| `UU_` | Autonomous loop check prompt — stewardship scope, PR maintenance heuristics, repeated-invocation scaling |
| `VzK` | Files API Python skill documentation (upload, use, manage, end-to-end example) |
| `GZ5` | Batch parallel orchestration skill — three-phase plan/spawn/track workflow with worker prompt template |
| `gzK` | Claude Platform on AWS skill documentation (AnthropicAWS client, SigV4 auth, vs. Bedrock distinction) |
| `XV5` | `/loop` skill — interval parsing rules, fixed-interval mode, dynamic self-pacing mode, input handler |
| `bzK` | Claude API Ruby SDK skill documentation (messages, streaming, tool use, prompt caching, stop details) |